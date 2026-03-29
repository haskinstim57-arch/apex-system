import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { TRPCError } from "@trpc/server";
import {
  listQueuedMessages,
  cancelQueuedMessage,
  cancelAllPendingQueuedMessages,
  getQueuedMessageStats,
  retryQueuedMessage,
  getMember,
} from "../db";

// ─────────────────────────────────────────────
// Access control helper
// ─────────────────────────────────────────────
async function requireAccountAccess(userId: number, accountId: number, userRole: string) {
  if (userRole === "admin") return;
  const member = await getMember(accountId, userId);
  if (!member) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "You do not have access to this account.",
    });
  }
}

// ─────────────────────────────────────────────
// Message Queue Router
// ─────────────────────────────────────────────
export const messageQueueRouter = router({
  /** List queued messages for an account */
  list: protectedProcedure
    .input(
      z.object({
        accountId: z.number(),
        status: z.enum(["pending", "dispatched", "failed", "cancelled"]).optional(),
        limit: z.number().min(1).max(100).default(50),
        offset: z.number().min(0).default(0),
      })
    )
    .query(async ({ ctx, input }) => {
      await requireAccountAccess(ctx.user.id, input.accountId, ctx.user.role);
      return listQueuedMessages(input.accountId, {
        status: input.status,
        limit: input.limit,
        offset: input.offset,
      });
    }),

  /** Get queue stats for an account */
  stats: protectedProcedure
    .input(z.object({ accountId: z.number() }))
    .query(async ({ ctx, input }) => {
      await requireAccountAccess(ctx.user.id, input.accountId, ctx.user.role);
      return getQueuedMessageStats(input.accountId);
    }),

  /** Cancel a single queued message */
  cancel: protectedProcedure
    .input(
      z.object({
        accountId: z.number(),
        messageId: z.number(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await requireAccountAccess(ctx.user.id, input.accountId, ctx.user.role);
      await cancelQueuedMessage(input.messageId, input.accountId);
      return { success: true };
    }),

  /** Cancel all pending queued messages for an account */
  cancelAll: protectedProcedure
    .input(z.object({ accountId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      await requireAccountAccess(ctx.user.id, input.accountId, ctx.user.role);
      await cancelAllPendingQueuedMessages(input.accountId);
      return { success: true };
    }),

  /** Retry a failed queued message */
  retry: protectedProcedure
    .input(
      z.object({
        accountId: z.number(),
        messageId: z.number(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await requireAccountAccess(ctx.user.id, input.accountId, ctx.user.role);
      await retryQueuedMessage(input.messageId, input.accountId);
      return { success: true };
    }),
});
