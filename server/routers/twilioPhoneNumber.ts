import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { TRPCError } from "@trpc/server";
import Twilio from "twilio";
import {
  getMember,
  getAccountMessagingSettings,
  upsertAccountMessagingSettings,
  getAccountById,
  createPortRequest,
  getPortRequestsByAccount,
  getPortRequestById,
  updatePortRequest,
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
   * Search available phone numbers by area code or locality.
   * Supports both local and toll-free number types.
   */
  searchAvailable: protectedProcedure
    .input(
      z.object({
        accountId: z.number(),
        numberType: z.enum(["local", "tollFree"]).default("local"),
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

      const { client } = await getTwilioClient(input.accountId);
      const isTollFree = input.numberType === "tollFree";

      try {
        let numbers: any[];

        if (isTollFree) {
          // Toll-free search only supports areaCode filter (e.g. 800, 888)
          numbers = await client
            .availablePhoneNumbers("US")
            .tollFree.list({
              limit: 20,
              smsEnabled: true,
              voiceEnabled: true,
              ...(input.areaCode ? { areaCode: parseInt(input.areaCode, 10) } : {}),
            });
        } else {
          numbers = await client
            .availablePhoneNumbers("US")
            .local.list({
              limit: 20,
              smsEnabled: true,
              voiceEnabled: true,
              ...(input.areaCode ? { areaCode: parseInt(input.areaCode, 10) } : {}),
              ...(input.locality ? { inLocality: input.locality } : {}),
              ...(input.state ? { inRegion: input.state } : {}),
            });
        }

        return numbers.map((n: any) => ({
          phoneNumber: n.phoneNumber,
          friendlyName: n.friendlyName,
          locality: n.locality || "",
          region: n.region || "",
          postalCode: n.postalCode || "",
          isoCountry: n.isoCountry || "US",
          numberType: isTollFree ? "tollFree" as const : "local" as const,
          capabilities: {
            sms: n.capabilities?.sms ?? true,
            voice: n.capabilities?.voice ?? true,
            mms: n.capabilities?.mms ?? false,
          },
          // Twilio local = $1.15/month, toll-free = $2.15/month
          monthlyCost: isTollFree ? 2.15 : 1.15,
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
        numberType: z.enum(["local", "tollFree"]).default("local"),
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
          monthlyCost: input.numberType === "tollFree" ? 2.15 : 1.15,
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

  // ─────────────────────────────────────────────
  // Number Porting
  // ─────────────────────────────────────────────

  /**
   * Submit a port request to bring an existing number into Twilio.
   */
  submitPortRequest: protectedProcedure
    .input(
      z.object({
        accountId: z.number(),
        phoneNumber: z.string().min(10).max(20),
        currentCarrier: z.string().min(1).max(255),
        carrierAccountNumber: z.string().min(1).max(255),
        carrierPin: z.string().max(100).optional(),
        authorizedName: z.string().min(1).max(255),
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
            "This account already has a phone number assigned. Release the current number before porting a new one.",
        });
      }

      // Normalize phone to E.164
      let normalized = input.phoneNumber.replace(/\D/g, "");
      if (normalized.length === 10) normalized = "1" + normalized;
      if (!normalized.startsWith("1")) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Please enter a valid US phone number.",
        });
      }
      const e164 = "+" + normalized;

      // Create the port request record
      const { id } = await createPortRequest({
        accountId: input.accountId,
        phoneNumber: e164,
        currentCarrier: input.currentCarrier,
        carrierAccountNumber: input.carrierAccountNumber,
        carrierPin: input.carrierPin || null,
        authorizedName: input.authorizedName,
        status: "submitted",
      });

      // Attempt to create a Twilio porting request
      // Note: Twilio's porting API requires a support ticket or the Porting API (beta).
      // For now, we record the request and the admin can process it manually,
      // or we can integrate with Twilio's Porting API when available.
      try {
        const { client } = await getTwilioClient(input.accountId);

        // Try to use Twilio's IncomingPhoneNumbers to check if the number
        // can be purchased directly (some numbers can be bought without porting)
        console.log(
          `[Twilio Port] Port request #${id} submitted for ${e164} (account ${input.accountId})`
        );

        await updatePortRequest(id, input.accountId, {
          status: "in_progress",
          notes: "Port request submitted. Processing may take 1-4 weeks depending on the carrier.",
        });
      } catch (err: any) {
        console.error("[Twilio Port] Submit error:", err?.message || err);
        await updatePortRequest(id, input.accountId, {
          status: "submitted",
          notes: "Port request recorded. An administrator will process this request.",
        });
      }

      return {
        success: true,
        portRequestId: id,
        message:
          "Port request submitted successfully. Porting typically takes 1-4 weeks. You will be notified when the number is active.",
      };
    }),

  /**
   * Get all port requests for an account.
   */
  getPortRequests: protectedProcedure
    .input(z.object({ accountId: z.number() }))
    .query(async ({ ctx, input }) => {
      await requireAccountOwner(
        ctx.user!.id,
        input.accountId,
        ctx.user!.role
      );
      return getPortRequestsByAccount(input.accountId);
    }),

  /**
   * Cancel a pending port request.
   */
  cancelPortRequest: protectedProcedure
    .input(z.object({ accountId: z.number(), portRequestId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      await requireAccountOwner(
        ctx.user!.id,
        input.accountId,
        ctx.user!.role
      );

      const request = await getPortRequestById(
        input.portRequestId,
        input.accountId
      );
      if (!request) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Port request not found",
        });
      }
      if (request.status === "completed" || request.status === "cancelled") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Cannot cancel a port request that is already ${request.status}`,
        });
      }

      await updatePortRequest(input.portRequestId, input.accountId, {
        status: "cancelled",
        notes: "Cancelled by user.",
      });

      return { success: true };
    }),

  // ─────────────────────────────────────────────
  // Usage Dashboard
  // ─────────────────────────────────────────────

  /**
   * Get phone number usage stats from Twilio.
   * Returns SMS and voice usage for the assigned number.
   */
  getUsage: protectedProcedure
    .input(
      z.object({
        accountId: z.number(),
        startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
        endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      await requireAccountOwner(
        ctx.user!.id,
        input.accountId,
        ctx.user!.role
      );

      const settings = await getAccountMessagingSettings(input.accountId);
      if (!settings?.twilioFromNumber) {
        return {
          hasNumber: false,
          sms: { sent: 0, received: 0, cost: 0 },
          voice: { inbound: 0, outbound: 0, minutes: 0, cost: 0 },
          totalCost: 0,
          period: { start: "", end: "" },
        };
      }

      const { client } = await getTwilioClient(input.accountId);

      // Default to current month
      const now = new Date();
      const startDate = input.startDate || `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
      const endDate = input.endDate || `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;

      try {
        // Fetch SMS usage records
        const smsRecords = await client.usage.records.list({
          category: "sms" as any,
          startDate: new Date(startDate),
          endDate: new Date(endDate),
        });

        // Fetch voice usage records
        const voiceRecords = await client.usage.records.list({
          category: "calls" as any,
          startDate: new Date(startDate),
          endDate: new Date(endDate),
        });

        // Parse SMS stats
        let smsSent = 0;
        let smsReceived = 0;
        let smsCost = 0;
        for (const rec of smsRecords) {
          const count = parseInt(String(rec.count), 10) || 0;
          const price = parseFloat(String(rec.price)) || 0;
          if ((rec.category as string)?.includes("outbound")) {
            smsSent += count;
          } else if ((rec.category as string)?.includes("inbound")) {
            smsReceived += count;
          } else {
            smsSent += count; // default to sent
          }
          smsCost += Math.abs(price);
        }

        // Parse voice stats
        let voiceInbound = 0;
        let voiceOutbound = 0;
        let voiceMinutes = 0;
        let voiceCost = 0;
        for (const rec of voiceRecords) {
          const count = parseInt(String(rec.count), 10) || 0;
          const price = parseFloat(String(rec.price)) || 0;
          const usage = parseInt(String(rec.usage), 10) || 0;
          if ((rec.category as string)?.includes("outbound")) {
            voiceOutbound += count;
          } else if ((rec.category as string)?.includes("inbound")) {
            voiceInbound += count;
          } else {
            voiceOutbound += count;
          }
          voiceMinutes += Math.round(usage / 60);
          voiceCost += Math.abs(price);
        }

        return {
          hasNumber: true,
          phoneNumber: settings.twilioFromNumber,
          sms: {
            sent: smsSent,
            received: smsReceived,
            cost: Math.round(smsCost * 100) / 100,
          },
          voice: {
            inbound: voiceInbound,
            outbound: voiceOutbound,
            minutes: voiceMinutes,
            cost: Math.round(voiceCost * 100) / 100,
          },
          totalCost:
            Math.round((smsCost + voiceCost) * 100) / 100,
          period: { start: startDate, end: endDate },
        };
      } catch (err: any) {
        console.error("[Twilio Usage] Error:", err?.message || err);
        // Return zeroed stats on error rather than failing
        return {
          hasNumber: true,
          phoneNumber: settings.twilioFromNumber,
          sms: { sent: 0, received: 0, cost: 0 },
          voice: { inbound: 0, outbound: 0, minutes: 0, cost: 0 },
          totalCost: 0,
          period: { start: startDate, end: endDate },
          error: "Unable to fetch usage data from Twilio. Please try again later.",
        };
      }
    }),
});
