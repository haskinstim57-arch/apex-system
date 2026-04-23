import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { TRPCError } from "@trpc/server";
import {
  getContactById,
  getUserById,
  getAccountMessagingSettings,
  getMember,
  createMessage,
  logContactActivity,
} from "../db";
import { chargeBeforeSend, reverseCharge } from "../services/usageTracker";
import { ENV } from "../_core/env";

// ─────────────────────────────────────────────
// Twilio Click-to-Call Router
//
// Bridges the logged-in user's cell phone to the contact's phone
// via Twilio Programmable Voice. Flow:
//   1. Twilio calls the user's phone first
//   2. When user answers, TwiML <Dial>s the contact's number
// ─────────────────────────────────────────────

async function requireAccountAccess(userId: number, accountId: number, role: string) {
  if (role === "admin") return;
  const member = await getMember(userId, accountId);
  if (!member) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Not a member of this account" });
  }
}

export const twilioCallsRouter = router({
  /**
   * Initiate a click-to-call via Twilio.
   * Calls the user's phone first, then bridges to the contact.
   */
  clickToCall: protectedProcedure
    .input(
      z.object({
        accountId: z.number().int().positive(),
        contactId: z.number().int().positive(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await requireAccountAccess(ctx.user.id, input.accountId, ctx.user.role);

      // 1. Get user's phone number
      const user = await getUserById(ctx.user.id);
      if (!user?.phone) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Your profile does not have a phone number. Add one in Settings → Profile to use click-to-call.",
        });
      }

      // 2. Get contact's phone number
      const contact = await getContactById(input.contactId, input.accountId);
      if (!contact) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Contact not found" });
      }
      if (!contact.phone) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Contact does not have a phone number",
        });
      }

      // 3. Get Twilio credentials
      const settings = await getAccountMessagingSettings(input.accountId);
      if (!settings?.twilioAccountSid || !settings?.twilioAuthToken || !settings?.twilioFromNumber) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "Twilio voice is not configured for this account. Set Account SID, Auth Token, and From Number in Messaging Settings.",
        });
      }

      // 4. Charge 1 minute deposit
      let charge;
      try {
        charge = await chargeBeforeSend(
          input.accountId,
          "voice_call_minute",
          1,
          { contactId: input.contactId, userPhone: user.phone, contactPhone: contact.phone },
          ctx.user.id
        );
      } catch (err: any) {
        throw new TRPCError({
          code: "PAYMENT_REQUIRED",
          message: err.message || "Insufficient balance for voice call",
        });
      }

      // 5. Build TwiML callback URL
      const baseUrl = ENV.appUrl;
      if (!baseUrl) {
        await reverseCharge(charge.usageEventId);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "App URL not configured — cannot generate TwiML callback",
        });
      }
      const twimlUrl = `${baseUrl}/api/webhooks/twilio/click-to-call-twiml?to=${encodeURIComponent(contact.phone)}&callerId=${encodeURIComponent(settings.twilioFromNumber)}`;
      const statusCallbackUrl = `${baseUrl}/api/webhooks/twilio/voice-status`;

      // 6. Initiate call to user's phone via Twilio REST API
      const sid = settings.twilioAccountSid;
      const token = settings.twilioAuthToken;
      const url = `https://api.twilio.com/2010-04-01/Accounts/${sid}/Calls.json`;

      try {
        const authHeader = Buffer.from(`${sid}:${token}`).toString("base64");
        const formBody = new URLSearchParams({
          To: user.phone,
          From: settings.twilioFromNumber,
          Url: twimlUrl,
          StatusCallback: statusCallbackUrl,
          StatusCallbackEvent: "initiated ringing answered completed",
          StatusCallbackMethod: "POST",
        });

        const response = await fetch(url, {
          method: "POST",
          headers: {
            Authorization: `Basic ${authHeader}`,
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: formBody.toString(),
        });

        const data = await response.json();

        if (!response.ok) {
          await reverseCharge(charge.usageEventId);
          console.error(`[TwilioCalls] API error: ${response.status}`, data);
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: data.message || `Twilio API error: ${response.status}`,
          });
        }

        // 7. Log the call as an outbound message
        const contactName = `${contact.firstName || ""} ${contact.lastName || ""}`.trim();
        await createMessage({
          accountId: input.accountId,
          contactId: input.contactId,
          userId: ctx.user.id,
          type: "call",
          direction: "outbound",
          status: "pending",
          subject: `Click-to-call: ${user.name || "Agent"} → ${contactName || contact.phone}`,
          body: `Outbound call initiated via Twilio bridge. Call SID: ${data.sid}`,
          toAddress: contact.phone,
          fromAddress: settings.twilioFromNumber,
          isRead: true,
        });

        await logContactActivity(input.contactId, input.accountId, "call_initiated", {
          callSid: data.sid,
          method: "twilio_bridge",
          agentPhone: user.phone,
          contactPhone: contact.phone,
        });

        console.log(
          `[TwilioCalls] Click-to-call initiated: user=${user.phone} → contact=${contact.phone} callSid=${data.sid}`
        );

        return {
          callSid: data.sid,
          message: `Calling your phone (${user.phone})... When you answer, you'll be connected to ${contactName || contact.phone}.`,
        };
      } catch (err: any) {
        if (err instanceof TRPCError) throw err;
        await reverseCharge(charge.usageEventId);
        console.error("[TwilioCalls] Network error:", err);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: err.message || "Failed to initiate Twilio call",
        });
      }
    }),
});
