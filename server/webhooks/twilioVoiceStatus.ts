import { Router, Request, Response } from "express";
import {
  getAccountById,
  findContactByPhone,
  createMessage,
  logContactActivity,
} from "../db";
import { dispatchSMS } from "../services/messaging";
import { resolveAccountByTwilioNumber, normalizePhone } from "./inboundMessages";

// ─────────────────────────────────────────────
// Twilio Voice Status Callback Webhook
// POST /api/webhooks/twilio/voice-status
//
// Twilio sends this when a call's status changes.
// We detect missed calls (no-answer, busy, failed)
// and trigger the text-back feature if enabled.
// ─────────────────────────────────────────────

export const twilioVoiceStatusRouter = Router();

/**
 * Twilio Voice Status Callback
 * Twilio sends form-encoded data with fields:
 * - CallSid: unique call ID
 * - CallStatus: completed, no-answer, busy, failed, canceled
 * - From: caller phone number (E.164)
 * - To: called Twilio number (E.164)
 * - Direction: inbound or outbound-api
 * - CallDuration: duration in seconds (only for completed calls)
 */
twilioVoiceStatusRouter.post(
  "/api/webhooks/twilio/voice-status",
  async (req: Request, res: Response) => {
    try {
      const { CallSid, CallStatus, From, To, Direction } = req.body;

      console.log(
        `[Twilio Voice Status] sid=${CallSid} status=${CallStatus} from=${From} to=${To} direction=${Direction}`
      );

      // Only process inbound missed calls
      const isMissedCall =
        Direction === "inbound" &&
        (CallStatus === "no-answer" || CallStatus === "busy" || CallStatus === "failed");

      if (!isMissedCall) {
        // Not a missed call — acknowledge and move on
        res.status(200).json({ received: true, action: "none" });
        return;
      }

      // Resolve which account this call belongs to
      const accountId = await resolveAccountByTwilioNumber(To);
      if (!accountId) {
        console.warn(
          `[Twilio Voice Status] No account found for Twilio number ${To}`
        );
        res.status(200).json({ received: true, action: "none" });
        return;
      }

      // Check if missed call text-back is enabled for this account
      const account = await getAccountById(accountId);
      if (!account || !account.missedCallTextBackEnabled) {
        console.log(
          `[Twilio Voice Status] Text-back disabled for account ${accountId}`
        );
        res.status(200).json({ received: true, action: "disabled" });
        return;
      }

      const message =
        account.missedCallTextBackMessage ||
        "Hey, sorry I missed your call! How can I help you?";
      const delayMinutes = account.missedCallTextBackDelayMinutes ?? 1;
      const delayMs = delayMinutes * 60 * 1000;

      // Find or note the caller as a contact
      const callerPhone = normalizePhone(From);

      console.log(
        `[Twilio Voice Status] Missed call from ${callerPhone} to account ${accountId}. Scheduling text-back in ${delayMinutes} min.`
      );

      // Schedule the text-back (fire-and-forget with delay)
      setTimeout(async () => {
        try {
          await sendMissedCallTextBack({
            accountId,
            callerPhone,
            twilioNumber: To,
            message,
          });
        } catch (err) {
          console.error(
            `[Twilio Voice Status] Text-back failed for ${callerPhone} account ${accountId}:`,
            err
          );
        }
      }, delayMs);

      res.status(200).json({
        received: true,
        action: "text-back-scheduled",
        delayMinutes,
      });
    } catch (err: any) {
      console.error("[Twilio Voice Status] Webhook error:", err);
      res.status(500).json({ error: "Internal server error" });
    }
  }
);

/**
 * Send the missed call text-back SMS and log it to the contact's thread.
 */
async function sendMissedCallTextBack(params: {
  accountId: number;
  callerPhone: string;
  twilioNumber: string;
  message: string;
}) {
  const { accountId, callerPhone, twilioNumber, message } = params;

  // Find the contact by phone number
  const contact = await findContactByPhone(callerPhone, accountId);

  // Send the SMS
  const result = await dispatchSMS({
    to: callerPhone,
    body: message,
    from: twilioNumber,
    accountId,
  });

  if (!result.success) {
    console.error(
      `[MissedCallTextBack] SMS send failed to ${callerPhone}: ${result.error}`
    );
    return;
  }

  console.log(
    `[MissedCallTextBack] SMS sent to ${callerPhone} for account ${accountId} (sid=${result.externalId})`
  );

  // Log the message to the contact's thread if we have a contact
  if (contact) {
    const { id: messageId } = await createMessage({
      accountId,
      contactId: contact.id,
      userId: 0, // system-generated
      type: "sms",
      direction: "outbound",
      status: "sent",
      subject: null,
      body: message,
      toAddress: callerPhone,
      fromAddress: twilioNumber,
      externalId: result.externalId || null,
      isRead: true, // outbound messages are read by default
      deliveredAt: new Date(),
    });

    // Log contact activity
    logContactActivity({
      contactId: contact.id,
      accountId,
      activityType: "message_sent",
      description: `Missed call text-back SMS sent to ${callerPhone}`,
      metadata: JSON.stringify({
        messageId,
        channel: "sms",
        direction: "outbound",
        preview: message.substring(0, 150),
        trigger: "missed_call_text_back",
      }),
    });

    console.log(
      `[MissedCallTextBack] Message logged to contact ${contact.id} thread (messageId=${messageId})`
    );
  } else {
    console.log(
      `[MissedCallTextBack] No contact found for ${callerPhone} in account ${accountId} — SMS sent but not logged to thread`
    );
  }
}

// Export for testing
export { sendMissedCallTextBack };
