import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure } from "../_core/trpc";
import {
  createMessage,
  getMessageById,
  listMessages,
  listMessagesByContact,
  updateMessageStatus,
  deleteMessage,
  getMessageStats,
  getContactById,
  getMember,
  createAuditLog,
} from "../db";
import { dispatchSMS, dispatchEmail } from "../services/messaging";

// ─── Tenant guard: verify user is a member of the account ───
// Platform admins (role='admin' on users table) bypass this check
async function requireAccountMember(
  userId: number,
  accountId: number,
  userRole?: string
) {
  if (userRole === "admin") {
    const member = await getMember(accountId, userId);
    if (member) return member;
    return { userId, accountId, role: "owner" as const, isActive: true };
  }

  const member = await getMember(accountId, userId);
  if (!member || !member.isActive) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "You do not have access to this account",
    });
  }
  return member;
}

const messageTypeEnum = z.enum(["email", "sms"]);
const messageDirectionEnum = z.enum(["outbound", "inbound"]);
const messageStatusEnum = z.enum([
  "pending",
  "sent",
  "delivered",
  "failed",
  "bounced",
]);

export const messagesRouter = router({
  // ─── Send a message (email or SMS) ───
  send: protectedProcedure
    .input(
      z.object({
        accountId: z.number().int().positive(),
        contactId: z.number().int().positive(),
        type: messageTypeEnum,
        subject: z.string().max(500).optional(),
        body: z.string().min(1).max(50000),
        toAddress: z.string().min(1).max(320),
        fromAddress: z.string().max(320).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await requireAccountMember(ctx.user.id, input.accountId, ctx.user.role);

      // Verify contact belongs to this account
      const contact = await getContactById(input.contactId, input.accountId);
      if (!contact) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Contact not found in this account",
        });
      }

      // Validate: email requires subject
      if (input.type === "email" && !input.subject) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Email messages require a subject",
        });
      }

      // Create the message record with pending status
      const { id } = await createMessage({
        accountId: input.accountId,
        contactId: input.contactId,
        userId: ctx.user.id,
        type: input.type,
        direction: "outbound",
        status: "pending",
        subject: input.subject || null,
        body: input.body,
        toAddress: input.toAddress,
        fromAddress: input.fromAddress || null,
      });

      // Dispatch through real provider (async, non-blocking)
      (async () => {
        try {
          let result;
          if (input.type === "sms") {
            result = await dispatchSMS({
              to: input.toAddress,
              body: input.body,
              accountId: input.accountId,
            });
          } else {
            result = await dispatchEmail({
              to: input.toAddress,
              subject: input.subject || "(no subject)",
              body: input.body,
              from: input.fromAddress || undefined,
              accountId: input.accountId,
            });
          }

          if (result.success) {
            await updateMessageStatus(id, "sent", {
              externalId: result.externalId,
              sentAt: new Date(),
            });
          } else {
            await updateMessageStatus(id, "failed", {
              errorMessage: result.error,
            });
          }
        } catch (err: any) {
          console.error(`[Messages] Provider dispatch failed for message ${id}:`, err);
          await updateMessageStatus(id, "failed", {
            errorMessage: err?.message || String(err),
          });
        }
      })();

      // Log the action
      await createAuditLog({
        accountId: input.accountId,
        userId: ctx.user.id,
        action: `message.${input.type}.sent`,
        resourceType: "message",
        resourceId: id,
        metadata: JSON.stringify({
          contactId: input.contactId,
          toAddress: input.toAddress,
          type: input.type,
        }),
      });

      return { id, status: "pending" as const };
    }),

  // ─── Log an inbound message ───
  logInbound: protectedProcedure
    .input(
      z.object({
        accountId: z.number().int().positive(),
        contactId: z.number().int().positive(),
        type: messageTypeEnum,
        subject: z.string().max(500).optional(),
        body: z.string().min(1).max(50000),
        fromAddress: z.string().min(1).max(320),
        toAddress: z.string().max(320).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await requireAccountMember(ctx.user.id, input.accountId, ctx.user.role);

      const contact = await getContactById(input.contactId, input.accountId);
      if (!contact) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Contact not found in this account",
        });
      }

      const { id } = await createMessage({
        accountId: input.accountId,
        contactId: input.contactId,
        userId: ctx.user.id,
        type: input.type,
        direction: "inbound",
        status: "delivered",
        subject: input.subject || null,
        body: input.body,
        toAddress: input.toAddress || "",
        fromAddress: input.fromAddress,
        deliveredAt: new Date(),
      });

      return { id };
    }),

  // ─── List messages for an account (with filters) ───
  list: protectedProcedure
    .input(
      z.object({
        accountId: z.number().int().positive(),
        contactId: z.number().int().positive().optional(),
        type: messageTypeEnum.optional(),
        direction: messageDirectionEnum.optional(),
        status: messageStatusEnum.optional(),
        search: z.string().optional(),
        limit: z.number().int().min(1).max(100).optional().default(50),
        offset: z.number().int().min(0).optional().default(0),
      })
    )
    .query(async ({ ctx, input }) => {
      await requireAccountMember(ctx.user.id, input.accountId, ctx.user.role);
      return listMessages(input);
    }),

  // ─── Get communication history for a specific contact ───
  byContact: protectedProcedure
    .input(
      z.object({
        accountId: z.number().int().positive(),
        contactId: z.number().int().positive(),
      })
    )
    .query(async ({ ctx, input }) => {
      await requireAccountMember(ctx.user.id, input.accountId, ctx.user.role);

      const contact = await getContactById(input.contactId, input.accountId);
      if (!contact) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Contact not found in this account",
        });
      }

      return listMessagesByContact(input.contactId, input.accountId);
    }),

  // ─── Get a single message ───
  get: protectedProcedure
    .input(
      z.object({
        id: z.number().int().positive(),
        accountId: z.number().int().positive(),
      })
    )
    .query(async ({ ctx, input }) => {
      await requireAccountMember(ctx.user.id, input.accountId, ctx.user.role);

      const message = await getMessageById(input.id, input.accountId);
      if (!message) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Message not found",
        });
      }
      return message;
    }),

  // ─── Update message status ───
  updateStatus: protectedProcedure
    .input(
      z.object({
        id: z.number().int().positive(),
        accountId: z.number().int().positive(),
        status: messageStatusEnum,
        externalId: z.string().optional(),
        errorMessage: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await requireAccountMember(ctx.user.id, input.accountId, ctx.user.role);

      const existing = await getMessageById(input.id, input.accountId);
      if (!existing) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Message not found",
        });
      }

      const extra: {
        externalId?: string;
        errorMessage?: string;
        sentAt?: Date;
        deliveredAt?: Date;
      } = {};
      if (input.externalId) extra.externalId = input.externalId;
      if (input.errorMessage) extra.errorMessage = input.errorMessage;
      if (input.status === "sent") extra.sentAt = new Date();
      if (input.status === "delivered") extra.deliveredAt = new Date();

      await updateMessageStatus(input.id, input.status, extra);
      return { success: true };
    }),

  // ─── Delete a message ───
  delete: protectedProcedure
    .input(
      z.object({
        id: z.number().int().positive(),
        accountId: z.number().int().positive(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const member = await requireAccountMember(
        ctx.user.id,
        input.accountId,
        ctx.user.role
      );

      // Only owner/manager can delete messages
      if (member.role === "employee") {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Employees cannot delete messages",
        });
      }

      const existing = await getMessageById(input.id, input.accountId);
      if (!existing) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Message not found",
        });
      }

      await deleteMessage(input.id, input.accountId);

      await createAuditLog({
        accountId: input.accountId,
        userId: ctx.user.id,
        action: "message.deleted",
        resourceType: "message",
        resourceId: input.id,
      });

      return { success: true };
    }),

  // ─── Message stats for an account ───
  stats: protectedProcedure
    .input(z.object({ accountId: z.number().int().positive() }))
    .query(async ({ ctx, input }) => {
      await requireAccountMember(ctx.user.id, input.accountId, ctx.user.role);
      return getMessageStats(input.accountId);
    }),
});
