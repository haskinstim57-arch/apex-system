import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { TRPCError } from "@trpc/server";
import {
  getAccountMessagingSettings,
  upsertAccountMessagingSettings,
  getAccountById,
  getMember,
} from "../db";

/**
 * Require the caller to be an owner of the account or an agency admin.
 */
async function requireAccountOwner(userId: number, accountId: number, role?: string) {
  if (role === "admin") return; // agency admins can manage any account
  const member = await getMember(accountId, userId);
  if (!member || member.role !== "owner") {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Only account owners can manage messaging settings",
    });
  }
}

export const messagingSettingsRouter = router({
  /** Get messaging settings for an account */
  get: protectedProcedure
    .input(z.object({ accountId: z.number() }))
    .query(async ({ ctx, input }) => {
      await requireAccountOwner(ctx.user!.id, input.accountId, ctx.user!.role);
      const settings = await getAccountMessagingSettings(input.accountId);
      if (!settings) {
        return {
          accountId: input.accountId,
          twilioAccountSid: null,
          twilioAuthToken: null,
          twilioFromNumber: null,
          sendgridApiKey: null,
          sendgridFromEmail: null,
          sendgridFromName: null,
        };
      }
      // Mask sensitive fields for display
      return {
        accountId: settings.accountId,
        twilioAccountSid: settings.twilioAccountSid,
        twilioAuthToken: settings.twilioAuthToken
          ? "••••" + settings.twilioAuthToken.slice(-4)
          : null,
        twilioFromNumber: settings.twilioFromNumber,
        sendgridApiKey: settings.sendgridApiKey
          ? "••••" + settings.sendgridApiKey.slice(-4)
          : null,
        sendgridFromEmail: settings.sendgridFromEmail,
        sendgridFromName: settings.sendgridFromName,
      };
    }),

  /** Save (create or update) messaging settings for an account */
  save: protectedProcedure
    .input(
      z.object({
        accountId: z.number(),
        twilioAccountSid: z.string().nullable().optional(),
        twilioAuthToken: z.string().nullable().optional(),
        twilioFromNumber: z.string().nullable().optional(),
        sendgridApiKey: z.string().nullable().optional(),
        sendgridFromEmail: z.string().email().nullable().optional(),
        sendgridFromName: z.string().nullable().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await requireAccountOwner(ctx.user!.id, input.accountId, ctx.user!.role);

      const account = await getAccountById(input.accountId);
      if (!account) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Account not found" });
      }

      const { accountId, ...data } = input;

      // Filter out masked values (don't overwrite with mask)
      const cleanData: Record<string, string | null> = {};
      for (const [key, value] of Object.entries(data)) {
        if (value !== undefined && !String(value).startsWith("••••")) {
          cleanData[key] = value;
        }
      }

      await upsertAccountMessagingSettings(accountId, cleanData);
      return { success: true };
    }),
});
