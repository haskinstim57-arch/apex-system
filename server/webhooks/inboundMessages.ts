import { Router, Request, Response } from "express";
import {
  createMessage,
  findContactByPhone,
  findContactByEmail,
  getAccountById,
  getAccountMessagingSettings,
  logContactActivity,
  createNotification,
} from "../db";
import { sendPushNotificationToAccount } from "../services/webPush";
import { getDb } from "../db";
import { accountMessagingSettings } from "../../drizzle/schema";
import { eq, isNotNull } from "drizzle-orm";
import {
  detectComplianceKeyword,
  processOptOut,
  processOptIn,
  processHelpRequest,
  logAutoReplySent,
} from "../services/smsCompliance";
import { billedDispatchSMS } from "../services/billedDispatch";
import { dispatchSMS } from "../services/messaging";

// ─────────────────────────────────────────────
// Inbound Message Webhooks
// POST /api/webhooks/twilio/inbound  — Twilio SMS
// POST /api/webhooks/sendgrid/inbound — SendGrid Inbound Parse
// ─────────────────────────────────────────────

export const inboundMessageRouter = Router();

/**
 * Twilio Inbound SMS Webhook
 * Twilio sends form-encoded data with fields:
 * - From: sender phone number (E.164)
 * - To: Twilio number that received the message
 * - Body: message text
 * - MessageSid: unique message ID
 * - AccountSid: Twilio account SID
 */
inboundMessageRouter.post(
  "/api/webhooks/twilio/inbound",
  async (req: Request, res: Response) => {
    try {
      const { From, To, Body, MessageSid } = req.body;

      if (!From || !Body) {
        console.warn("[Twilio Inbound] Missing From or Body in webhook payload");
        res.status(400).json({ error: "Missing required fields" });
        return;
      }

      console.log(
        `[Twilio Inbound] SMS from=${From} to=${To} sid=${MessageSid} body="${Body.substring(0, 50)}..."`
      );

      // Find which account this message belongs to by matching the "To" number
      const accountId = await resolveAccountByTwilioNumber(To);

      if (!accountId) {
        console.warn(
          `[Twilio Inbound] No account found for Twilio number ${To}`
        );
        res.status(200).json({ received: true, matched: false });
        return;
      }

      const normalizedPhone = normalizePhone(From);
      const contact = await findContactByPhone(normalizedPhone, accountId);

      // ─── SMS Compliance Keyword Detection ───
      const compliance = detectComplianceKeyword(Body);

      if (compliance.action !== "none") {
        console.log(
          `[Twilio Inbound] Compliance keyword detected: ${compliance.keyword} action=${compliance.action} phone=${normalizedPhone}`
        );

        // Process the compliance action
        if (compliance.action === "opt_out") {
          await processOptOut({
            accountId,
            contactId: contact?.id || null,
            phone: normalizedPhone,
            keyword: compliance.keyword!,
            source: "inbound_sms",
          });
        } else if (compliance.action === "opt_in") {
          await processOptIn({
            accountId,
            contactId: contact?.id || null,
            phone: normalizedPhone,
            keyword: compliance.keyword!,
            source: "inbound_sms",
          });
        } else if (compliance.action === "help_request") {
          await processHelpRequest({
            accountId,
            contactId: contact?.id || null,
            phone: normalizedPhone,
          });
        }

        // Send auto-reply via Twilio
        if (compliance.autoReply) {
          try {
            // Compliance auto-replies are billed to the account
            await billedDispatchSMS({
              accountId,
              to: From,
              body: compliance.autoReply,
              contactId: contact?.id,
              userId: 0,
            });
            await logAutoReplySent({
              accountId,
              contactId: contact?.id || null,
              phone: normalizedPhone,
              replyType: compliance.action,
            });
            console.log(
              `[Twilio Inbound] Auto-reply sent for ${compliance.action} to ${From}`
            );
          } catch (replyErr) {
            console.error("[Twilio Inbound] Failed to send auto-reply:", replyErr);
          }
        }

        // Log the compliance keyword as an inbound message for audit
        if (contact) {
          await createMessage({
            accountId,
            contactId: contact.id,
            userId: contact.assignedUserId || 0,
            type: "sms",
            direction: "inbound",
            status: "delivered",
            subject: null,
            body: Body,
            toAddress: To || "",
            fromAddress: From,
            externalId: MessageSid || null,
            isRead: false,
            deliveredAt: new Date(),
          });

          logContactActivity({
            contactId: contact.id,
            accountId,
            activityType: compliance.action === "opt_out" ? "sms_opt_out" : compliance.action === "opt_in" ? "sms_opt_in" : "message_received",
            description: `SMS compliance: ${compliance.keyword} keyword received from ${From}`,
            metadata: JSON.stringify({
              channel: "sms",
              keyword: compliance.keyword,
              action: compliance.action,
            }),
          });
        }

        // If this is a STOP/opt-out or opt-in, don't continue normal processing
        if (!compliance.continueProcessing) {
          // Create notification for the assigned agent
          if (contact) {
            console.log(`[Twilio Inbound] Creating notification: accountId=${accountId} type=inbound_message (compliance ${compliance.action}) contactId=${contact.id} assignedUserId=${contact.assignedUserId}`);
            createNotification({
              accountId,
              userId: contact.assignedUserId || null,
              type: "inbound_message",
              title: `SMS ${compliance.action === "opt_out" ? "Opt-Out" : "Opt-In"}: ${contact.firstName || From}`,
              body: `${contact.firstName || "Contact"} sent "${Body}" — ${compliance.action === "opt_out" ? "DND enabled" : "DND cleared"}`,
              link: `/contacts/${contact.id}`,
            }).catch((err) => console.error("[Twilio Inbound] Notification error:", err));
          }

          res.type("text/xml").status(200).send("<Response></Response>");
          return;
        }
      }

      // ─── Normal inbound message processing ───

      if (!contact) {
        console.warn(
          `[Twilio Inbound] No contact found for phone ${normalizedPhone} in account ${accountId}`
        );
        res.status(200).json({ received: true, matched: false });
        return;
      }

      // Create inbound message record
      const { id } = await createMessage({
        accountId,
        contactId: contact.id,
        userId: contact.assignedUserId || 0,
        type: "sms",
        direction: "inbound",
        status: "delivered",
        subject: null,
        body: Body,
        toAddress: To || "",
        fromAddress: From,
        externalId: MessageSid || null,
        isRead: false,
        deliveredAt: new Date(),
      });

      console.log(
        `[Twilio Inbound] Created inbound SMS message id=${id} contact=${contact.id} account=${accountId}`
      );

      // Log contact activity
      logContactActivity({
        contactId: contact.id,
        accountId,
        activityType: "message_received",
        description: `Inbound SMS from ${From}`,
        metadata: JSON.stringify({ messageId: id, channel: "sms", direction: "inbound", preview: Body.substring(0, 150) }),
      });

      // Create in-app notification
      console.log(`[Twilio Inbound] Creating notification: accountId=${accountId} type=inbound_message contactId=${contact.id} assignedUserId=${contact.assignedUserId}`);
      createNotification({
        accountId,
        userId: contact.assignedUserId || null,
        type: "inbound_message",
        title: `New SMS from ${contact.firstName || From}`,
        body: Body.substring(0, 200),
        link: `/inbox`,
      }).catch((err) => console.error("[Twilio Inbound] Notification error:", err));

      // Send push notification
      sendPushNotificationToAccount(accountId, {
        title: `New SMS from ${contact.firstName || From}`,
        body: Body.substring(0, 100),
        url: `/contacts/${contact.id}`,
        tag: `inbound-sms-${contact.id}`,
        eventType: "inbound_sms",
        contactName: contact.firstName ? `${contact.firstName} ${contact.lastName || ""}`.trim() : From,
      }).catch((err) => console.error("[Twilio Inbound] Push notification error:", err));

      // Fire inbound_message_received automation trigger (non-blocking)
      import("../services/workflowTriggers")
        .then(({ onInboundMessageReceived }) =>
          onInboundMessageReceived(accountId, contact.id, "sms")
        )
        .catch((err) =>
          console.error("[Twilio Inbound] Trigger error:", err)
        );

      // Auto-stop nurture sequences on inbound SMS reply (non-blocking)
      import("../services/sequenceAutoStop")
        .then(({ onInboundSmsAutoStop }) =>
          onInboundSmsAutoStop(accountId, contact.id)
        )
        .catch((err) =>
          console.error("[Twilio Inbound] Sequence auto-stop error:", err)
        );

      // Return TwiML empty response (no auto-reply)
      res.type("text/xml").status(200).send("<Response></Response>");
    } catch (err: any) {
      console.error("[Twilio Inbound] Webhook error:", err);
      res.status(500).json({ error: "Internal server error" });
    }
  }
);

/**
 * SendGrid Inbound Parse Webhook
 * SendGrid sends multipart form data with fields:
 * - from: sender email
 * - to: recipient email
 * - subject: email subject
 * - text: plain text body
 * - html: HTML body (optional)
 * - envelope: JSON string with from/to arrays
 */
inboundMessageRouter.post(
  "/api/webhooks/sendgrid/inbound",
  async (req: Request, res: Response) => {
    try {
      const { from, to, subject, text, html, envelope } = req.body;

      if (!from) {
        console.warn("[SendGrid Inbound] Missing from field in webhook payload");
        res.status(400).json({ error: "Missing required fields" });
        return;
      }

      // Extract email address from "Name <email>" format
      const senderEmail = extractEmail(from);
      const recipientEmail = to ? extractEmail(to) : null;

      console.log(
        `[SendGrid Inbound] Email from=${senderEmail} to=${recipientEmail} subject="${subject?.substring(0, 50)}"`
      );

      // Resolve account by matching recipient email against account settings
      const accountId = await resolveAccountByEmail(recipientEmail || "");

      if (!accountId) {
        console.warn(
          `[SendGrid Inbound] No account found for recipient ${recipientEmail}`
        );
        res.status(200).json({ received: true, matched: false });
        return;
      }

      // Find contact by sender email
      const contact = await findContactByEmail(senderEmail, accountId);

      if (!contact) {
        console.warn(
          `[SendGrid Inbound] No contact found for email ${senderEmail} in account ${accountId}`
        );
        res.status(200).json({ received: true, matched: false });
        return;
      }

      // Use text body, fall back to html
      const messageBody = text || html || "(empty message)";

      const { id } = await createMessage({
        accountId,
        contactId: contact.id,
        userId: contact.assignedUserId || 0,
        type: "email",
        direction: "inbound",
        status: "delivered",
        subject: subject || null,
        body: messageBody,
        toAddress: recipientEmail || "",
        fromAddress: senderEmail,
        isRead: false,
        deliveredAt: new Date(),
      });

      console.log(
        `[SendGrid Inbound] Created inbound email message id=${id} contact=${contact.id} account=${accountId}`
      );

      // Log contact activity
      logContactActivity({
        contactId: contact.id,
        accountId,
        activityType: "message_received",
        description: `Inbound email from ${senderEmail}${subject ? `: ${subject}` : ""}`,
        metadata: JSON.stringify({ messageId: id, channel: "email", direction: "inbound", preview: messageBody.substring(0, 150) }),
      });

      // Create in-app notification
      console.log(`[SendGrid Inbound] Creating notification: accountId=${accountId} type=inbound_message contactId=${contact.id} assignedUserId=${contact.assignedUserId}`);
      createNotification({
        accountId,
        userId: contact.assignedUserId || null,
        type: "inbound_message",
        title: `New email from ${contact.firstName || senderEmail}`,
        body: subject ? subject.substring(0, 200) : messageBody.substring(0, 200),
        link: `/inbox`,
      }).catch((err) => console.error("[SendGrid Inbound] Notification error:", err));

      // Send push notification
      sendPushNotificationToAccount(accountId, {
        title: `New email from ${contact.firstName || senderEmail}`,
        body: subject ? subject.substring(0, 100) : messageBody.substring(0, 100),
        url: `/contacts/${contact.id}`,
        tag: `inbound-email-${contact.id}`,
        eventType: "inbound_email",
        contactName: contact.firstName ? `${contact.firstName} ${contact.lastName || ""}`.trim() : senderEmail,
      }).catch((err) => console.error("[SendGrid Inbound] Push notification error:", err));

      // Fire inbound_message_received automation trigger (non-blocking)
      import("../services/workflowTriggers")
        .then(({ onInboundMessageReceived }) =>
          onInboundMessageReceived(accountId, contact.id, "email")
        )
        .catch((err) =>
          console.error("[SendGrid Inbound] Trigger error:", err)
        );

      // Auto-stop nurture sequences on inbound email reply (non-blocking)
      import("../services/sequenceAutoStop")
        .then(({ onInboundEmailAutoStop }) =>
          onInboundEmailAutoStop(accountId, contact.id)
        )
        .catch((err) =>
          console.error("[SendGrid Inbound] Sequence auto-stop error:", err)
        );

      res.status(200).json({ received: true, matched: true, messageId: id });
    } catch (err: any) {
      console.error("[SendGrid Inbound] Webhook error:", err);
      res.status(500).json({ error: "Internal server error" });
    }
  }
);

/**
 * Blooio Inbound SMS/iMessage Webhook
 *
 * Configure in Blooio dashboard: webhook URL =
 *   https://<host>/api/webhooks/blooio/inbound/<accountId>
 *
 * Blooio v2 webhook payload (verify against docs.blooio.com — adjust field names if different):
 *   { from: "+1...", to: "+1...", body: "text", id: "blooio-msg-id", type: "sms"|"imessage" }
 */
inboundMessageRouter.post(
  "/api/webhooks/blooio/inbound/:accountId",
  async (req: Request, res: Response) => {
    try {
      const accountId = parseInt(req.params.accountId, 10);
      if (!accountId || isNaN(accountId)) {
        console.warn("[Blooio Inbound] Invalid accountId in URL");
        res.status(400).json({ error: "Invalid accountId" });
        return;
      }

      // Blooio's exact payload field names — verify against their docs and adjust if needed.
      // Common variants: { from, to, body, id, type } or { sender, recipient, text, messageId }
      const body = req.body ?? {};
      const From = body.from || body.sender || body.From;
      const To = body.to || body.recipient || body.To;
      const Body = body.body || body.text || body.message || body.Body;
      const MessageId = body.id || body.messageId || body.MessageSid;
      const channel: "sms" | "imessage" = body.type === "imessage" ? "imessage" : "sms";

      if (!From || !Body) {
        console.warn("[Blooio Inbound] Missing from or body in payload", body);
        res.status(200).json({ ok: false, reason: "missing fields" });
        return;
      }

      console.log(
        `[Blooio Inbound] account=${accountId} from=${From} to=${To} id=${MessageId} body="${String(Body).substring(0, 50)}..."`
      );

      // Verify account exists
      const account = await getAccountById(accountId);
      if (!account) {
        console.warn(`[Blooio Inbound] Account ${accountId} not found`);
        res.status(404).json({ error: "Account not found" });
        return;
      }

      // Look up contact by phone within this account (mirrors Twilio handler)
      const normalizedPhone = normalizePhone(From);
      const contact = await findContactByPhone(normalizedPhone, accountId);
      if (!contact) {
        console.warn(
          `[Blooio Inbound] No contact found for ${normalizedPhone} in account ${accountId}`
        );
        // Still 200 so Blooio doesn't retry — we just have nothing to attach the message to
        res.status(200).json({ ok: true, contactFound: false });
        return;
      }

      // Create the inbound message record
      const { id } = await createMessage({
        accountId,
        contactId: contact.id,
        userId: contact.assignedUserId || 0,
        type: "sms",
        direction: "inbound",
        status: "delivered",
        subject: null,
        body: String(Body),
        toAddress: To || "",
        fromAddress: From,
        externalId: MessageId ? String(MessageId) : null,
        isRead: false,
        deliveredAt: new Date(),
        metadata: JSON.stringify({ provider: "blooio", channel }),
      });

      console.log(
        `[Blooio Inbound] Created inbound ${channel} message id=${id} contact=${contact.id} account=${accountId}`
      );

      // Activity timeline
      logContactActivity({
        contactId: contact.id,
        accountId,
        activityType: "message_received",
        description: `Inbound ${channel.toUpperCase()} from ${From}`,
        metadata: JSON.stringify({
          messageId: id,
          channel,
          direction: "inbound",
          provider: "blooio",
          preview: String(Body).substring(0, 150),
        }),
      });

      // Notification (mirror Twilio handler)
      console.log(
        `[Blooio Inbound] Creating notification: accountId=${accountId} type=inbound_message contactId=${contact.id} assignedUserId=${contact.assignedUserId}`
      );
      createNotification({
        accountId,
        userId: contact.assignedUserId || null,
        type: "inbound_message",
        title: `New ${channel.toUpperCase()} from ${contact.firstName || From}`,
        body: String(Body).substring(0, 200),
        link: `/inbox`,
      }).catch((err) =>
        console.error("[Blooio Inbound] Notification error:", err)
      );

      // Send push notification
      sendPushNotificationToAccount(accountId, {
        title: `New ${channel.toUpperCase()} from ${contact.firstName || From}`,
        body: String(Body).substring(0, 100),
        url: `/contacts/${contact.id}`,
        tag: `inbound-${channel}-${contact.id}`,
        eventType: "inbound_sms",
        contactName: contact.firstName
          ? `${contact.firstName} ${contact.lastName || ""}`.trim()
          : From,
      }).catch((err) =>
        console.error("[Blooio Inbound] Push notification error:", err)
      );

      // Fire workflow trigger (non-blocking)
      import("../services/workflowTriggers")
        .then(({ onInboundMessageReceived }) =>
          onInboundMessageReceived(accountId, contact.id, "sms")
        )
        .catch((err) =>
          console.error("[Blooio Inbound] Workflow trigger error:", err)
        );

      // Auto-stop nurture sequences on inbound reply (non-blocking)
      import("../services/sequenceAutoStop")
        .then(({ onInboundSmsAutoStop }) =>
          onInboundSmsAutoStop(accountId, contact.id)
        )
        .catch((err) =>
          console.error("[Blooio Inbound] Sequence auto-stop error:", err)
        );

      res.status(200).json({ ok: true, messageId: id });
    } catch (err: any) {
      console.error("[Blooio Inbound] Handler error:", err);
      // Still 200 so Blooio doesn't retry on our internal errors
      res.status(200).json({
        ok: false,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }
);

// ─── Helpers ───

/**
 * Normalize phone number to a consistent format for lookup.
 * Strips everything except digits and leading +.
 */
function normalizePhone(phone: string): string {
  // Keep only digits and leading +
  const cleaned = phone.replace(/[^\d+]/g, "");
  // If it starts with 1 and is 11 digits, add +
  if (cleaned.length === 11 && cleaned.startsWith("1")) {
    return `+${cleaned}`;
  }
  // If it's 10 digits (US), add +1
  if (cleaned.length === 10) {
    return `+1${cleaned}`;
  }
  return cleaned.startsWith("+") ? cleaned : `+${cleaned}`;
}

/**
 * Extract email address from a string like "John Doe <john@example.com>"
 */
function extractEmail(raw: string): string {
  const match = raw.match(/<([^>]+)>/);
  return match ? match[1].toLowerCase() : raw.trim().toLowerCase();
}

/**
 * Resolve which account a Twilio number belongs to by checking
 * per-account messaging settings.
 */
async function resolveAccountByTwilioNumber(
  twilioNumber: string
): Promise<number | null> {
  const db = await getDb();
  if (!db) return null;

  const normalized = normalizePhone(twilioNumber);

  // Check all account messaging settings for matching Twilio number
  const rows = await db
    .select()
    .from(accountMessagingSettings)
    .where(isNotNull(accountMessagingSettings.twilioFromNumber));

  for (const row of rows) {
    if (row.twilioFromNumber && normalizePhone(row.twilioFromNumber) === normalized) {
      return row.accountId;
    }
  }

  return null;
}

/**
 * Resolve which account an inbound email belongs to.
 * Matches against account email addresses.
 */
async function resolveAccountByEmail(
  recipientEmail: string
): Promise<number | null> {
  const db = await getDb();
  if (!db) return null;

  // Check account messaging settings for matching SendGrid from email
  const rows = await db
    .select()
    .from(accountMessagingSettings)
    .where(isNotNull(accountMessagingSettings.sendgridFromEmail));

  const normalizedRecipient = recipientEmail.toLowerCase();

  for (const row of rows) {
    if (
      row.sendgridFromEmail &&
      row.sendgridFromEmail.toLowerCase() === normalizedRecipient
    ) {
      return row.accountId;
    }
  }

  return null;
}

// Export helpers for testing
export { normalizePhone, extractEmail, resolveAccountByTwilioNumber, resolveAccountByEmail };
