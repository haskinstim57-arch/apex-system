import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure } from "../_core/trpc";
import {
  getConversations,
  getThread,
  markMessagesAsRead,
  getUnreadMessageCount,
  createMessage,
  getContactById,
  getMember,
  createAuditLog,
  logContactActivity,
} from "../db";
import { dispatchSMS, dispatchEmail } from "../services/messaging";

// ─── Tenant guard ───
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

export const inboxRouter = router({
  // ─── List conversations (contacts with messages) ───
  getConversations: protectedProcedure
    .input(
      z.object({
        accountId: z.number().int().positive(),
        type: z.enum(["email", "sms"]).optional(),
        unreadOnly: z.boolean().optional(),
        search: z.string().optional(),
        limit: z.number().int().min(1).max(100).optional().default(50),
        offset: z.number().int().min(0).optional().default(0),
      })
    )
    .query(async ({ ctx, input }) => {
      await requireAccountMember(ctx.user.id, input.accountId, ctx.user.role);
      return getConversations(input);
    }),

  // ─── Get full message thread for a contact ───
  getThread: protectedProcedure
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
      return getThread(input.contactId, input.accountId);
    }),

  // ─── Mark all messages for a contact as read ───
  markAsRead: protectedProcedure
    .input(
      z.object({
        accountId: z.number().int().positive(),
        contactId: z.number().int().positive(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await requireAccountMember(ctx.user.id, input.accountId, ctx.user.role);
      await markMessagesAsRead(input.contactId, input.accountId);
      return { success: true };
    }),

  // ─── Send a reply from the inbox ───
  sendReply: protectedProcedure
    .input(
      z.object({
        accountId: z.number().int().positive(),
        contactId: z.number().int().positive(),
        type: z.enum(["email", "sms"]),
        subject: z.string().max(500).optional(),
        body: z.string().min(1).max(50000),
        provider: z.enum(["twilio", "blooio"]).optional(),
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

      // Determine the toAddress based on channel type
      let toAddress: string;
      if (input.type === "sms") {
        if (!contact.phone) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Contact does not have a phone number for SMS",
          });
        }
        toAddress = contact.phone;
      } else {
        if (!contact.email) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Contact does not have an email address",
          });
        }
        toAddress = contact.email;
      }

      if (input.type === "email" && !input.subject) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Email replies require a subject",
        });
      }

      // Create the message record (outbound = isRead true by default)
      const { id } = await createMessage({
        accountId: input.accountId,
        contactId: input.contactId,
        userId: ctx.user.id,
        type: input.type,
        direction: "outbound",
        status: "pending",
        subject: input.subject || null,
        body: input.body,
        toAddress,
        fromAddress: null,
        isRead: true,
      });

      // Dispatch through provider (async, non-blocking)
      (async () => {
        try {
          let result;
          if (input.type === "sms") {
            result = await dispatchSMS({
              to: toAddress,
              body: input.body,
              accountId: input.accountId,
              provider: input.provider,
            });
          } else {
            result = await dispatchEmail({
              to: toAddress,
              subject: input.subject || "(no subject)",
              body: input.body,
              accountId: input.accountId,
            });
          }

          if (result.success) {
            const { updateMessageStatus } = await import("../db");
            await updateMessageStatus(id, "sent", {
              externalId: result.externalId,
              sentAt: new Date(),
            });
          } else {
            const { updateMessageStatus } = await import("../db");
            await updateMessageStatus(id, "failed", {
              errorMessage: result.error,
            });
          }
        } catch (err: any) {
          console.error(`[Inbox] Provider dispatch failed for message ${id}:`, err);
          const { updateMessageStatus } = await import("../db");
          await updateMessageStatus(id, "failed", {
            errorMessage: err?.message || String(err),
          });
        }
      })();

      await createAuditLog({
        accountId: input.accountId,
        userId: ctx.user.id,
        action: `inbox.reply.${input.type}`,
        resourceType: "message",
        resourceId: id,
        metadata: JSON.stringify({
          contactId: input.contactId,
          toAddress,
          type: input.type,
        }),
      });

      // Log contact activity
      logContactActivity({
        contactId: input.contactId,
        accountId: input.accountId,
        activityType: "message_sent",
        description: `${input.type.toUpperCase()} reply sent to ${toAddress}`,
        metadata: JSON.stringify({
          messageId: id,
          channel: input.type,
          direction: "outbound",
          preview: input.body.substring(0, 150),
          source: "inbox",
        }),
      });

      return { id, status: "pending" as const };
    }),

  // ─── Get unread message count for sidebar badge ───
  getUnreadCount: protectedProcedure
    .input(z.object({ accountId: z.number().int().positive() }))
    .query(async ({ ctx, input }) => {
      await requireAccountMember(ctx.user.id, input.accountId, ctx.user.role);
      const count = await getUnreadMessageCount(input.accountId);
      return { count };
    }),
});
