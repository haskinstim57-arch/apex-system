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
import { chargeBeforeSend } from "../services/usageTracker";

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

      // Pre-check balance before creating the message row.
      // chargeBeforeSend throws PAYMENT_REQUIRED if insufficient funds.
      // We charge here (deducting balance), then skip the charge inside
      // billedDispatch by using raw dispatch. If the pre-check passes,
      // we know the account can afford this send.
      const rateType = input.type === "sms" ? "sms_sent" as const : "email_sent" as const;
      let preCharge: { usageEventId: number; totalCost: number };
      try {
        preCharge = await chargeBeforeSend(
          input.accountId,
          rateType,
          1,
          { contactId: input.contactId, to: toAddress, source: "inbox" },
          ctx.user.id
        );
      } catch (err: any) {
        // Re-throw billing errors as TRPCError so the client gets a clean error
        if (err?.code === "PAYMENT_REQUIRED" || err?.message?.includes("Insufficient balance") || err?.message?.includes("PAYMENT_METHOD_REQUIRED")) {
          throw new TRPCError({
            code: "PAYMENT_REQUIRED" as any,
            message: err.message || "Insufficient balance to send this message. Please add funds.",
          });
        }
        throw err;
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

      // Dispatch through provider (async, non-blocking).
      // Balance was already deducted by chargeBeforeSend above, so we use
      // raw dispatchSMS/dispatchEmail here. If the provider fails, we
      // reverse the charge.
      const { dispatchSMS, dispatchEmail } = await import("../services/messaging");
      const { reverseCharge } = await import("../services/usageTracker");
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
            // Auto-promote contact status from new/uncontacted → contacted
            const { autoPromoteOnOutbound } = await import("../services/contactStatusAutoUpdater");
            autoPromoteOnOutbound(input.contactId).catch(() => {});
          } else {
            // Provider returned failure — reverse the charge
            await reverseCharge(preCharge.usageEventId);
            console.warn(`[Inbox] Send failed, charge reversed: messageId=${id} error=${result.error}`);
            const { updateMessageStatus } = await import("../db");
            await updateMessageStatus(id, "failed", {
              errorMessage: result.error,
            });
          }
        } catch (err: any) {
          // Provider threw — reverse the charge
          await reverseCharge(preCharge.usageEventId).catch(() => {});
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
