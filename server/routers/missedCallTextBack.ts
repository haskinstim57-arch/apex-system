import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { TRPCError } from "@trpc/server";
import { getAccountById, updateAccount, getMember } from "../db";

const DEFAULT_MESSAGE = "Hey, sorry I missed your call! How can I help you?";

/**
 * Require the caller to be an owner of the account or an agency admin.
 */
async function requireAccountOwner(userId: number, accountId: number, role?: string) {
  if (role === "admin") return;
  const member = await getMember(accountId, userId);
  if (!member || member.role !== "owner") {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Only account owners can manage missed call text-back settings",
    });
  }
}

export const missedCallTextBackRouter = router({
  /** Get missed call text-back settings for an account */
  getSettings: protectedProcedure
    .input(z.object({ accountId: z.number().int().positive() }))
    .query(async ({ ctx, input }) => {
      await requireAccountOwner(ctx.user!.id, input.accountId, ctx.user!.role);
      const account = await getAccountById(input.accountId);
      if (!account) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Account not found" });
      }
      return {
        enabled: account.missedCallTextBackEnabled,
        message: account.missedCallTextBackMessage ?? DEFAULT_MESSAGE,
        delayMinutes: account.missedCallTextBackDelayMinutes,
      };
    }),

  /** Save missed call text-back settings for an account */
  saveSettings: protectedProcedure
    .input(
      z.object({
        accountId: z.number().int().positive(),
        enabled: z.boolean(),
        message: z.string().min(1).max(500),
        delayMinutes: z.number().int().min(0).max(10),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await requireAccountOwner(ctx.user!.id, input.accountId, ctx.user!.role);
      const account = await getAccountById(input.accountId);
      if (!account) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Account not found" });
      }

      await updateAccount(input.accountId, {
        missedCallTextBackEnabled: input.enabled,
        missedCallTextBackMessage: input.message,
        missedCallTextBackDelayMinutes: input.delayMinutes,
      });

      console.log(
        `[MissedCallTextBack] Settings updated for account ${input.accountId}: enabled=${input.enabled} delay=${input.delayMinutes}min`
      );

      return { success: true };
    }),
});

export { DEFAULT_MESSAGE };
