import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { TRPCError } from "@trpc/server";
import Twilio from "twilio";
import {
  getMember,
  getAccountMessagingSettings,
  upsertAccountMessagingSettings,
  getAccountById,
} from "../db";

// ─────────────────────────────────────────────
// Twilio Phone Number Management
// Search, purchase, and release phone numbers
// directly from the CRM.
// ─────────────────────────────────────────────

/**
 * Resolve Twilio client for an account.
 * Priority: per-account credentials > global env vars.
 */
async function getTwilioClient(accountId: number): Promise<{
  client: ReturnType<typeof Twilio>;
  accountSid: string;
}> {
  // Try per-account credentials first
  const settings = await getAccountMessagingSettings(accountId);
  if (settings?.twilioAccountSid && settings?.twilioAuthToken) {
    return {
      client: Twilio(settings.twilioAccountSid, settings.twilioAuthToken),
      accountSid: settings.twilioAccountSid,
    };
  }

  // Fall back to global env vars
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  if (!sid || !token) {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message:
        "Twilio is not configured. Please set up Twilio credentials in Messaging Settings first, or contact your administrator.",
    });
  }
  return { client: Twilio(sid, token), accountSid: sid };
}

/**
 * Require the caller to be an owner of the account or an agency admin.
 */
async function requireAccountOwner(
  userId: number,
  accountId: number,
  role?: string
) {
  if (role === "admin") return;
  const member = await getMember(accountId, userId);
  if (!member || member.role !== "owner") {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Only account owners can manage phone numbers",
    });
  }
}

export const twilioPhoneNumberRouter = router({
  /**
   * Get the currently assigned phone number for an account.
   */
  getAssigned: protectedProcedure
    .input(z.object({ accountId: z.number() }))
    .query(async ({ ctx, input }) => {
      await requireAccountOwner(
        ctx.user!.id,
        input.accountId,
        ctx.user!.role
      );
      const settings = await getAccountMessagingSettings(input.accountId);
      if (!settings?.twilioFromNumber) {
        return { hasNumber: false as const, phoneNumber: null, phoneSid: null };
      }
      return {
        hasNumber: true as const,
        phoneNumber: settings.twilioFromNumber,
        phoneSid: settings.twilioPhoneSid ?? null,
      };
    }),

  /**
   * Search available local phone numbers by area code or locality.
   */
  searchAvailable: protectedProcedure
    .input(
      z.object({
        accountId: z.number(),
        areaCode: z.string().regex(/^\d{3}$/).optional(),
        locality: z.string().max(100).optional(),
        state: z.string().max(2).optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      await requireAccountOwner(
        ctx.user!.id,
        input.accountId,
        ctx.user!.role
      );

      const { client, accountSid } = await getTwilioClient(input.accountId);

      try {
        let query = client
          .availablePhoneNumbers("US")
          .local.list({
            limit: 20,
            smsEnabled: true,
            voiceEnabled: true,
            ...(input.areaCode ? { areaCode: parseInt(input.areaCode, 10) } : {}),
            ...(input.locality ? { inLocality: input.locality } : {}),
            ...(input.state ? { inRegion: input.state } : {}),
          });

        const numbers = await query;

        return numbers.map((n) => ({
          phoneNumber: n.phoneNumber,
          friendlyName: n.friendlyName,
          locality: n.locality,
          region: n.region,
          postalCode: n.postalCode,
          isoCountry: n.isoCountry,
          capabilities: {
            sms: n.capabilities.sms,
            voice: n.capabilities.voice,
            mms: n.capabilities.mms,
          },
          // Twilio local numbers cost $1.15/month
          monthlyCost: 1.15,
        }));
      } catch (err: any) {
        console.error("[Twilio Phone] Search error:", err?.message || err);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message:
            err?.message || "Failed to search available phone numbers",
        });
      }
    }),

  /**
   * Purchase a phone number and assign it to the account.
   * Configures SMS and voice webhooks automatically.
   */
  purchase: protectedProcedure
    .input(
      z.object({
        accountId: z.number(),
        phoneNumber: z.string().min(10).max(20),
        appUrl: z.string().url(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await requireAccountOwner(
        ctx.user!.id,
        input.accountId,
        ctx.user!.role
      );

      // Check that account doesn't already have a number
      const existing = await getAccountMessagingSettings(input.accountId);
      if (existing?.twilioFromNumber) {
        throw new TRPCError({
          code: "CONFLICT",
          message:
            "This account already has a phone number assigned. Release the current number before purchasing a new one.",
        });
      }

      const { client } = await getTwilioClient(input.accountId);

      // Build webhook URLs
      const baseUrl = input.appUrl.replace(/\/$/, "");
      const smsWebhookUrl = `${baseUrl}/api/webhooks/twilio/inbound`;
      const voiceStatusUrl = `${baseUrl}/api/webhooks/twilio/voice-status`;

      try {
        const purchased = await client.incomingPhoneNumbers.create({
          phoneNumber: input.phoneNumber,
          smsUrl: smsWebhookUrl,
          smsMethod: "POST",
          statusCallback: voiceStatusUrl,
          statusCallbackMethod: "POST",
        });

        console.log(
          `[Twilio Phone] Purchased ${purchased.phoneNumber} (SID: ${purchased.sid}) for account ${input.accountId}`
        );

        // Store the number and SID on the account's messaging settings
        await upsertAccountMessagingSettings(input.accountId, {
          twilioFromNumber: purchased.phoneNumber,
          twilioPhoneSid: purchased.sid,
        });

        return {
          success: true,
          phoneNumber: purchased.phoneNumber,
          phoneSid: purchased.sid,
          monthlyCost: 1.15,
        };
      } catch (err: any) {
        console.error("[Twilio Phone] Purchase error:", err?.message || err);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: err?.message || "Failed to purchase phone number",
        });
      }
    }),

  /**
   * Release (delete) the currently assigned phone number.
   */
  release: protectedProcedure
    .input(z.object({ accountId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      await requireAccountOwner(
        ctx.user!.id,
        input.accountId,
        ctx.user!.role
      );

      const settings = await getAccountMessagingSettings(input.accountId);
      if (!settings?.twilioFromNumber) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "No phone number is assigned to this account",
        });
      }

      if (!settings.twilioPhoneSid) {
        // No SID stored — just clear the number from settings
        await upsertAccountMessagingSettings(input.accountId, {
          twilioFromNumber: null,
          twilioPhoneSid: null,
        });
        return { success: true, released: settings.twilioFromNumber };
      }

      const { client } = await getTwilioClient(input.accountId);

      try {
        await client
          .incomingPhoneNumbers(settings.twilioPhoneSid)
          .remove();

        console.log(
          `[Twilio Phone] Released ${settings.twilioFromNumber} (SID: ${settings.twilioPhoneSid}) for account ${input.accountId}`
        );
      } catch (err: any) {
        console.error("[Twilio Phone] Release error:", err?.message || err);
        // If the number is already gone from Twilio, still clear it locally
        if (err?.status !== 404) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: err?.message || "Failed to release phone number",
          });
        }
      }

      // Clear the number from account settings
      await upsertAccountMessagingSettings(input.accountId, {
        twilioFromNumber: null,
        twilioPhoneSid: null,
      });

      return { success: true, released: settings.twilioFromNumber };
    }),
});
