import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { TRPCError } from "@trpc/server";
import {
  getAccountMessagingSettings,
  upsertAccountMessagingSettings,
  getAccountById,
  getMember,
} from "../db";
import {
  DEFAULT_BUSINESS_HOURS_SCHEDULE,
  parseBusinessHoursJson,
} from "../utils/businessHours";

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

// ─────────────────────────────────────────────
// Zod schema for business hours schedule validation
// ─────────────────────────────────────────────

const dayScheduleSchema = z.object({
  open: z.boolean(),
  start: z.string().regex(/^\d{2}:\d{2}$/, "Must be HH:MM format").optional(),
  end: z.string().regex(/^\d{2}:\d{2}$/, "Must be HH:MM format").optional(),
});

const businessHoursSchema = z.object({
  enabled: z.boolean(),
  timezone: z.string().min(1, "Timezone is required"),
  schedule: z.object({
    monday: dayScheduleSchema,
    tuesday: dayScheduleSchema,
    wednesday: dayScheduleSchema,
    thursday: dayScheduleSchema,
    friday: dayScheduleSchema,
    saturday: dayScheduleSchema,
    sunday: dayScheduleSchema,
  }),
});

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
          blooioApiKey: null,
          appointmentFromNumber: null,
          appointmentSmsProvider: "blooio" as const,
          businessHours: DEFAULT_BUSINESS_HOURS_SCHEDULE,
        };
      }
      // Parse business hours JSON
      const businessHours = parseBusinessHoursJson(settings.businessHours) ?? DEFAULT_BUSINESS_HOURS_SCHEDULE;

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
        blooioApiKey: settings.blooioApiKey
          ? "••••" + settings.blooioApiKey.slice(-4)
          : null,
        appointmentFromNumber: settings.appointmentFromNumber ?? null,
        appointmentSmsProvider: (settings.appointmentSmsProvider as "twilio" | "blooio") ?? "blooio",
        businessHours,
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
        blooioApiKey: z.string().nullable().optional(),
        appointmentFromNumber: z.string().nullable().optional(),
        appointmentSmsProvider: z.enum(["twilio", "blooio"]).optional(),
        businessHours: businessHoursSchema.optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await requireAccountOwner(ctx.user!.id, input.accountId, ctx.user!.role);

      const account = await getAccountById(input.accountId);
      if (!account) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Account not found" });
      }

      const { accountId, businessHours, ...data } = input;

      // Filter out masked values (don't overwrite with mask)
      const cleanData: Record<string, string | null> = {};
      for (const [key, value] of Object.entries(data)) {
        if (value !== undefined && !String(value).startsWith("••••")) {
          cleanData[key] = value;
        }
      }

      // Serialize business hours to JSON string if provided
      if (businessHours !== undefined) {
        cleanData.businessHours = JSON.stringify(businessHours);
      }

      await upsertAccountMessagingSettings(accountId, cleanData);
      return { success: true };
    }),

  /** Save only business hours (dedicated endpoint for the business hours UI) */
  saveBusinessHours: protectedProcedure
    .input(
      z.object({
        accountId: z.number(),
        businessHours: businessHoursSchema,
      })
    )
    .mutation(async ({ ctx, input }) => {
      await requireAccountOwner(ctx.user!.id, input.accountId, ctx.user!.role);

      const account = await getAccountById(input.accountId);
      if (!account) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Account not found" });
      }

      await upsertAccountMessagingSettings(input.accountId, {
        businessHours: JSON.stringify(input.businessHours),
      });

      return { success: true };
    }),
});
