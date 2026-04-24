import { Router, Request, Response } from "express";
import {
  getAccountById,
  findContactByPhone,
  createMessage,
  logContactActivity,
  createNotification,
  getMessageByCallSid,
  updateMessage,
  getAccountMessagingSettings,
} from "../db";
import { billedDispatchSMS } from "../services/billedDispatch";
import { chargeBeforeSend, reverseCharge } from "../services/usageTracker";
import { resolveAccountByTwilioNumber, normalizePhone } from "./inboundMessages";
import { ENV } from "../_core/env";
import twilio from "twilio";

// ─────────────────────────────────────────────
// Twilio Voice Status Callback Webhook
// POST /api/webhooks/twilio/voice-status
//
// Handles two distinct flows:
//   1. INBOUND missed calls → text-back feature
//   2. OUTBOUND click-to-call → duration reconciliation & billing
// ─────────────────────────────────────────────

export const twilioVoiceStatusRouter = Router();

/**
 * Verify the Twilio webhook signature using X-Twilio-Signature header.
 * Returns true if valid, false otherwise.
 */
export async function verifyTwilioSignature(
  req: Request,
  authToken: string
): Promise<boolean> {
  const signature = req.headers["x-twilio-signature"] as string | undefined;
  if (!signature) return false;

  // Build the full URL Twilio used when generating the signature
  const protocol = req.headers["x-forwarded-proto"] || req.protocol || "https";
  const host = req.headers["x-forwarded-host"] || req.headers["host"] || "";
  const fullUrl = `${protocol}://${host}${req.originalUrl}`;

  return twilio.validateRequest(authToken, signature, fullUrl, req.body || {});
}

twilioVoiceStatusRouter.post(
  "/api/webhooks/twilio/voice-status",
  async (req: Request, res: Response) => {
    try {
      const {
        CallSid,
        CallStatus,
        CallDuration,
        From,
        To,
        Direction,
        RecordingUrl,
        RecordingSid,
      } = req.body;

      console.log(
        `[Twilio Voice Status] sid=${CallSid} status=${CallStatus} duration=${CallDuration ?? "N/A"} from=${From} to=${To} direction=${Direction}`
      );

      // ── Route: outbound-api calls are click-to-call → reconciliation ──
      if (Direction === "outbound-api") {
        await handleClickToCallStatus(req, res, {
          CallSid,
          CallStatus,
          CallDuration: CallDuration ? parseInt(CallDuration, 10) : 0,
          From,
          To,
          RecordingUrl,
          RecordingSid,
        });
        return;
      }

      // ── Route: inbound missed calls → text-back ──
      const isMissedCall =
        Direction === "inbound" &&
        (CallStatus === "no-answer" || CallStatus === "busy" || CallStatus === "failed");

      if (!isMissedCall) {
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

      const callerPhone = normalizePhone(From);

      console.log(
        `[Twilio Voice Status] Missed call from ${callerPhone} to account ${accountId}. Scheduling text-back in ${delayMinutes} min.`
      );

      // Create in-app notification for missed call
      createNotification({
        accountId,
        userId: null,
        type: "missed_call",
        title: `Missed call`,
        body: `Missed call from ${callerPhone}`,
        link: `/inbox`,
      }).catch((err) =>
        console.error("[Twilio Voice Status] Notification error:", err)
      );

      // Fire missed_call automation trigger if we have a matching contact
      const missedCallContact = await findContactByPhone(callerPhone, accountId);
      if (missedCallContact) {
        import("../services/workflowTriggers")
          .then(({ onMissedCall }) =>
            onMissedCall(accountId, missedCallContact.id)
          )
          .catch((err) =>
            console.error("[Twilio Voice Status] Trigger error:", err)
          );
      }

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

// ─────────────────────────────────────────────
// Click-to-Call Status Reconciliation
// ─────────────────────────────────────────────

interface ClickToCallStatusParams {
  CallSid: string;
  CallStatus: string;
  CallDuration: number;
  From: string;
  To: string;
  RecordingUrl?: string;
  RecordingSid?: string;
}

/**
 * Handle outbound click-to-call status updates.
 *
 * On "completed":
 *   - Compute actualMinutes = ceil(CallDuration / 60)
 *   - If actualMinutes > 1: charge extra (actualMinutes - 1) minutes
 *   - If actualMinutes === 0 (never connected): reverse the 1-min deposit
 *   - Update message status to "sent", store RecordingUrl in metadata
 *
 * On "failed" / "no-answer" / "busy" / "canceled":
 *   - Reverse the 1-min deposit
 *   - Update message status to "failed"
 */
export async function handleClickToCallStatus(
  req: Request,
  res: Response,
  params: ClickToCallStatusParams
) {
  const { CallSid, CallStatus, CallDuration, RecordingUrl, RecordingSid, From, To } = params;

  // 1. Find the message row by callSid
  const msg = await getMessageByCallSid(CallSid);
  if (!msg) {
    console.warn(`[VoiceStatus] No message found for CallSid=${CallSid} — ignoring`);
    res.status(200).json({ received: true, action: "no-message" });
    return;
  }

  // 2. Verify Twilio signature
  const settings = await getAccountMessagingSettings(msg.accountId);
  if (settings?.twilioAuthToken) {
    const isValid = await verifyTwilioSignature(req, settings.twilioAuthToken);
    if (!isValid) {
      console.warn(`[VoiceStatus] Invalid Twilio signature for CallSid=${CallSid}`);
      res.status(403).json({ error: "Invalid Twilio signature" });
      return;
    }
  }

  // 3. Extract the usageEventId from message metadata
  let existingMeta: Record<string, any> = {};
  try {
    existingMeta = msg.metadata ? JSON.parse(msg.metadata) : {};
  } catch {
    existingMeta = {};
  }
  const usageEventId: number | undefined = existingMeta.usageEventId;

  // 4. Handle based on CallStatus
  const isTerminalFailure =
    CallStatus === "failed" ||
    CallStatus === "no-answer" ||
    CallStatus === "busy" ||
    CallStatus === "canceled";

  if (CallStatus === "completed") {
    const actualMinutes = CallDuration > 0 ? Math.ceil(CallDuration / 60) : 0;

    console.log(
      `[VoiceStatus] Call completed: sid=${CallSid} duration=${CallDuration}s actualMinutes=${actualMinutes}`
    );

    if (actualMinutes === 0 && usageEventId) {
      // Call never truly connected — reverse the 1-min deposit
      await reverseCharge(usageEventId);
      console.log(`[VoiceStatus] Reversed 1-min deposit for 0-duration call, usageEventId=${usageEventId}`);
    } else if (actualMinutes > 1 && usageEventId) {
      // Charge the EXTRA minutes (actualMinutes - 1) beyond the 1-min deposit
      const extraMinutes = actualMinutes - 1;
      try {
        await chargeBeforeSend(
          msg.accountId,
          "voice_call_minute",
          extraMinutes,
          { contactId: msg.contactId, callSid: CallSid, reconciliation: true },
          msg.userId
        );
        console.log(
          `[VoiceStatus] Charged ${extraMinutes} extra minutes for CallSid=${CallSid} accountId=${msg.accountId}`
        );
      } catch (err: any) {
        // Log but don't fail — the call already happened
        console.error(
          `[VoiceStatus] Failed to charge extra minutes for CallSid=${CallSid}: ${err.message}`
        );
      }
    }
    // actualMinutes === 1 → deposit was exact, nothing to do

    // Update message to "sent" with duration + recording info
    const updatedMeta = {
      ...existingMeta,
      callDurationSeconds: CallDuration,
      callDurationMinutes: actualMinutes,
      ...(RecordingUrl ? { recordingUrl: RecordingUrl } : {}),
      ...(RecordingSid ? { recordingSid: RecordingSid } : {}),
    };

    await updateMessage(msg.id, {
      status: "sent",
      sentAt: new Date(),
      metadata: JSON.stringify(updatedMeta),
    });

    // Fire call_completed automation trigger
    import("../services/workflowTriggers")
      .then(({ onCallCompleted }) => onCallCompleted(msg.accountId, msg.contactId))
      .catch((err) =>
        console.error("[VoiceStatus] call_completed trigger error:", err)
      );

    res.status(200).json({
      received: true,
      action: "reconciled",
      actualMinutes,
    });
  } else if (isTerminalFailure) {
    console.log(
      `[VoiceStatus] Call ${CallStatus}: sid=${CallSid} — reversing deposit`
    );

    // Reverse the 1-min deposit
    if (usageEventId) {
      await reverseCharge(usageEventId);
      console.log(`[VoiceStatus] Reversed deposit for ${CallStatus} call, usageEventId=${usageEventId}`);
    }

    // Update message to "failed"
    const updatedMeta = {
      ...existingMeta,
      callStatus: CallStatus,
      callDurationSeconds: 0,
    };

    await updateMessage(msg.id, {
      status: "failed",
      errorMessage: `Call ${CallStatus}`,
      metadata: JSON.stringify(updatedMeta),
    });

    res.status(200).json({
      received: true,
      action: "failed",
      callStatus: CallStatus,
    });
  } else {
    // Intermediate statuses (initiated, ringing, in-progress) — just acknowledge
    console.log(`[VoiceStatus] Intermediate status ${CallStatus} for CallSid=${CallSid}`);
    res.status(200).json({ received: true, action: "intermediate" });
  }
}

// ─────────────────────────────────────────────
// Missed Call Text-Back
// ─────────────────────────────────────────────

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

  // Send the SMS (billed to account)
  const result = await billedDispatchSMS({
    accountId,
    to: callerPhone,
    body: message,
    contactId: contact?.id,
    userId: 0,
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
      isRead: true,
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
