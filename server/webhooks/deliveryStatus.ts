import { Router } from "express";
import { updateDeliveryStatus } from "../services/notificationLogger";
import { getDb } from "../db";
import { messages } from "../../drizzle/schema";
import { eq } from "drizzle-orm";

// ─────────────────────────────────────────────
// Delivery Status Webhooks
// POST /api/webhooks/sendgrid/status  — SendGrid Event Webhook
// POST /api/webhooks/twilio/status    — Twilio SMS Status Callback
// ─────────────────────────────────────────────

export const deliveryStatusRouter = Router();

// ─── SendGrid Event Webhook ─────────────────────────
// SendGrid sends an array of event objects.
// Relevant events: delivered, bounce, dropped, deferred, open, click, spamreport, unsubscribe
// Docs: https://docs.sendgrid.com/for-developers/tracking-events/event
//
// Each event has:
//   sg_message_id: string (matches our externalMessageId — note: SendGrid appends ".filter..." suffix)
//   event: string (delivered, bounce, dropped, deferred, open, click, etc.)
//   reason?: string (bounce/drop reason)
//   response?: string (SMTP response)
//   timestamp: number (Unix timestamp)

/** Normalize SendGrid event name to a consistent delivery status */
function normalizeSendGridEvent(event: string): string {
  const map: Record<string, string> = {
    processed: "processed",
    delivered: "delivered",
    bounce: "bounced",
    dropped: "dropped",
    deferred: "deferred",
    open: "opened",
    click: "clicked",
    spamreport: "spam_reported",
    unsubscribe: "unsubscribed",
    group_unsubscribe: "unsubscribed",
    group_resubscribe: "resubscribed",
  };
  return map[event] || event;
}

/** Extract the base message ID from SendGrid's sg_message_id (strip .filter... suffix) */
function extractSendGridMessageId(sgMessageId: string): string {
  // SendGrid appends ".filter0034p1mdw1-..." to the message ID
  // Our stored externalMessageId is the base part before the first dot
  // But sometimes the x-message-id header stored at send time already has the full form
  // So we try both: the full ID and the base part
  return sgMessageId.split(".")[0];
}

/** Priority of delivery events — higher = more final */
const SENDGRID_EVENT_PRIORITY: Record<string, number> = {
  processed: 1,
  deferred: 2,
  delivered: 5,
  opened: 6,
  clicked: 7,
  bounced: 10,
  dropped: 10,
  spam_reported: 10,
  unsubscribed: 10,
};

deliveryStatusRouter.post("/api/webhooks/sendgrid/status", async (req, res) => {
  try {
    const events = req.body;

    if (!Array.isArray(events)) {
      console.warn("[DeliveryStatus] SendGrid webhook received non-array body");
      return res.status(400).json({ error: "Expected array of events" });
    }

    console.log(`[DeliveryStatus] SendGrid webhook received ${events.length} event(s)`);

    let processed = 0;
    let matched = 0;

    for (const event of events) {
      const sgMessageId = event.sg_message_id;
      const eventName = event.event;

      if (!sgMessageId || !eventName) {
        continue;
      }

      processed++;

      const deliveryStatus = normalizeSendGridEvent(eventName);
      const errorMessage = event.reason || event.response || null;

      // Try matching with the full sg_message_id first, then the base part
      const baseId = extractSendGridMessageId(sgMessageId);
      
      let rowsUpdated = await updateDeliveryStatus(sgMessageId, deliveryStatus, errorMessage);
      
      if (rowsUpdated === 0 && baseId !== sgMessageId) {
        rowsUpdated = await updateDeliveryStatus(baseId, deliveryStatus, errorMessage);
      }

      if (rowsUpdated > 0) {
        matched++;
        console.log(
          `[DeliveryStatus] SendGrid: updated ${rowsUpdated} row(s) for messageId=${baseId} status=${deliveryStatus}`
        );
      }

      // ── Bridge to messages table ──
      const sgId = baseId;
      const sgMsgStatus =
        eventName === "delivered" ? "delivered" as const :
        eventName === "bounce" || eventName === "dropped" ? "bounced" as const :
        eventName === "deferred" ? "sent" as const : null;

      if (sgId && sgMsgStatus) {
        try {
          const db = await getDb();
          if (db) {
            await db.update(messages)
              .set({
                status: sgMsgStatus,
                errorMessage: event.reason || undefined,
                deliveredAt: sgMsgStatus === "delivered" ? new Date() : undefined,
              })
              .where(eq(messages.externalId, sgId));

            if (sgMsgStatus === "bounced") {
              const { checkAndAlertFailureThreshold } = await import("../services/messageFailureAlerts");
              await checkAndAlertFailureThreshold(sgId, "bounce").catch(() => {});

              const { scheduleRetryByExternalId } = await import("../services/messageRetryWorker");
              await scheduleRetryByExternalId(sgId, "bounce").catch(() => {});
            }
          }
        } catch (bridgeErr: any) {
          console.error(`[DeliveryStatus] SendGrid bridge to messages table failed:`, bridgeErr.message);
        }
      }
    }

    console.log(
      `[DeliveryStatus] SendGrid webhook processed: ${processed} events, ${matched} matched notification logs`
    );

    return res.status(200).json({ processed, matched });
  } catch (err: any) {
    console.error("[DeliveryStatus] SendGrid webhook error:", err.message);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// ─── Twilio SMS Status Callback ─────────────────────
// Twilio sends a POST with form-urlencoded data for each status change.
// Relevant fields:
//   MessageSid: string (matches our externalMessageId)
//   MessageStatus: string (queued, sent, delivered, undelivered, failed)
//   ErrorCode?: string
//   ErrorMessage?: string
//
// Docs: https://www.twilio.com/docs/messaging/guides/track-outbound-message-status

/** Normalize Twilio status to a consistent delivery status */
function normalizeTwilioStatus(status: string): string {
  const map: Record<string, string> = {
    queued: "queued",
    sending: "sending",
    sent: "sent",
    delivered: "delivered",
    undelivered: "undelivered",
    failed: "failed",
    receiving: "receiving",
    received: "received",
    accepted: "accepted",
    read: "read",
  };
  return map[status] || status;
}

deliveryStatusRouter.post("/api/webhooks/twilio/status", async (req, res) => {
  try {
    const { MessageSid, MessageStatus, ErrorCode, ErrorMessage } = req.body;

    if (!MessageSid || !MessageStatus) {
      console.warn("[DeliveryStatus] Twilio webhook missing MessageSid or MessageStatus");
      return res.status(400).json({ error: "Missing MessageSid or MessageStatus" });
    }

    console.log(
      `[DeliveryStatus] Twilio webhook: sid=${MessageSid} status=${MessageStatus}${ErrorCode ? ` error=${ErrorCode}` : ""}`
    );

    const deliveryStatus = normalizeTwilioStatus(MessageStatus);
    const errorMessage = ErrorCode
      ? `${ErrorCode}: ${ErrorMessage || "Unknown error"}`
      : null;

    const rowsUpdated = await updateDeliveryStatus(MessageSid, deliveryStatus, errorMessage);

    if (rowsUpdated > 0) {
      console.log(
        `[DeliveryStatus] Twilio: updated ${rowsUpdated} row(s) for sid=${MessageSid} status=${deliveryStatus}`
      );
    } else {
      console.log(
        `[DeliveryStatus] Twilio: no matching notification_log for sid=${MessageSid} (may be a non-notification SMS)`
      );
    }

    // ── Bridge to messages table ──
    const externalId = MessageSid;
    if (externalId) {
      const msgStatus =
        MessageStatus === "delivered" ? "delivered" as const :
        MessageStatus === "failed" || MessageStatus === "undelivered" ? "failed" as const :
        MessageStatus === "sent" ? "sent" as const : null;

      if (msgStatus) {
        try {
          const db = await getDb();
          if (db) {
            await db.update(messages)
              .set({
                status: msgStatus,
                errorMessage: ErrorCode ? `[${ErrorCode}] ${ErrorMessage || ""}`.trim() : undefined,
                deliveredAt: msgStatus === "delivered" ? new Date() : undefined,
              })
              .where(eq(messages.externalId, externalId));

            // If failed, check failure threshold and schedule retry
            if (msgStatus === "failed") {
              const { checkAndAlertFailureThreshold } = await import("../services/messageFailureAlerts");
              await checkAndAlertFailureThreshold(externalId, ErrorCode).catch(() => {});

              // Schedule retry for transient errors
              const { scheduleRetryByExternalId } = await import("../services/messageRetryWorker");
              await scheduleRetryByExternalId(externalId, ErrorCode ? `[${ErrorCode}]` : undefined).catch(() => {});
            }
          }
        } catch (bridgeErr: any) {
          console.error(`[DeliveryStatus] Twilio bridge to messages table failed:`, bridgeErr.message);
        }
      }
    }

    // Twilio expects a 200 or 204 response
    return res.status(200).send("<Response></Response>");
  } catch (err: any) {
    console.error("[DeliveryStatus] Twilio webhook error:", err.message);
    return res.status(500).json({ error: "Internal server error" });
  }
});
