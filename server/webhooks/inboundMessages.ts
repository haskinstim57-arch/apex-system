import { Router, Request, Response } from "express";
import {
  createMessage,
  findContactByPhone,
  findContactByEmail,
  getAccountMessagingSettings,
} from "../db";
import { getDb } from "../db";
import { accountMessagingSettings } from "../../drizzle/schema";
import { eq, isNotNull } from "drizzle-orm";

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
      // against per-account Twilio settings
      const accountId = await resolveAccountByTwilioNumber(To);

      if (!accountId) {
        console.warn(
          `[Twilio Inbound] No account found for Twilio number ${To}`
        );
        // Still return 200 to prevent Twilio from retrying
        res.status(200).json({ received: true, matched: false });
        return;
      }

      // Find the contact by phone number
      const normalizedPhone = normalizePhone(From);
      const contact = await findContactByPhone(normalizedPhone, accountId);

      if (!contact) {
        console.warn(
          `[Twilio Inbound] No contact found for phone ${normalizedPhone} in account ${accountId}`
        );
        // Return 200 — message received but no matching contact
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

      res.status(200).json({ received: true, matched: true, messageId: id });
    } catch (err: any) {
      console.error("[SendGrid Inbound] Webhook error:", err);
      res.status(500).json({ error: "Internal server error" });
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
