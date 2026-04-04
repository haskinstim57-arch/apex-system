/**
 * SMS Notification Channel Service
 *
 * Sends SMS notifications for each event type when the user has
 * enabled the "sms" channel in their notification preferences.
 *
 * Uses the existing Blooio integration via dispatchSMS().
 * Checks isChannelEnabled(prefs, eventType, "sms") before sending.
 *
 * SMS recipients are resolved in priority order:
 * 1. Per-user phone numbers from the users table (if set)
 * 2. Account-level phone from the accounts table (fallback)
 * Falls back to account members who are owners/managers if no push
 * subscriptions exist.
 */

import { getDb } from "../db";
import { pushSubscriptions, accounts, accountMembers, users } from "../../drizzle/schema";
import { eq } from "drizzle-orm";
import { parseNotificationPreferences, isChannelEnabled } from "./pushBatcher";
import type { PushEventType } from "./pushBatcher";
import { dispatchSMS } from "./messaging";

// ─── SMS Templates ─────────────────────────────────

interface SmsNotificationPayload {
  title: string;
  body: string;
  url?: string;
  contactName?: string;
}

/**
 * Build a concise SMS message for a notification event.
 * SMS messages are kept under 160 chars when possible for single-segment delivery.
 */
function buildNotificationSms(
  eventType: PushEventType,
  payload: SmsNotificationPayload,
  appUrl: string
): string {
  const typeEmoji: Record<PushEventType, string> = {
    inbound_sms: "💬",
    inbound_email: "📧",
    appointment_booked: "📅",
    ai_call_completed: "🤖",
    facebook_lead: "📣",
  };

  const emoji = typeEmoji[eventType] || "🔔";

  // Build concise message
  let message = `${emoji} ${payload.title}`;

  if (payload.contactName) {
    message += ` — ${payload.contactName}`;
  }

  // Add body if there's room (keep under ~300 chars total for 2-segment max)
  const bodySnippet = payload.body.length > 100
    ? payload.body.substring(0, 97) + "..."
    : payload.body;

  if (message.length + bodySnippet.length + 2 < 300) {
    message += `\n${bodySnippet}`;
  }

  // Add link if provided
  if (payload.url) {
    const fullUrl = `${appUrl}${payload.url}`;
    message += `\n${fullUrl}`;
  }

  return message;
}

/**
 * Build a batched SMS message for multiple events of the same type.
 */
function buildBatchedNotificationSms(
  eventType: PushEventType,
  eventCount: number,
  payloads: SmsNotificationPayload[],
  appUrl: string
): string {
  const typeLabels: Record<PushEventType, { singular: string; plural: string; url: string }> = {
    inbound_sms: { singular: "new SMS", plural: "new SMS messages", url: "/inbox" },
    inbound_email: { singular: "new email", plural: "new emails", url: "/inbox" },
    appointment_booked: { singular: "new appointment", plural: "new appointments", url: "/calendar" },
    ai_call_completed: { singular: "AI call completed", plural: "AI calls completed", url: "/ai-calls" },
    facebook_lead: { singular: "new Facebook lead", plural: "new Facebook leads", url: "/contacts" },
  };

  const typeEmoji: Record<PushEventType, string> = {
    inbound_sms: "💬",
    inbound_email: "📧",
    appointment_booked: "📅",
    ai_call_completed: "🤖",
    facebook_lead: "📣",
  };

  // For single events, use the detailed template
  if (eventCount === 1 && payloads.length === 1) {
    return buildNotificationSms(eventType, payloads[0], appUrl);
  }

  const label = typeLabels[eventType] || { singular: "notification", plural: "notifications", url: "/" };
  const emoji = typeEmoji[eventType] || "🔔";
  const noun = eventCount === 1 ? label.singular : label.plural;

  let message = `${emoji} ${eventCount} ${noun}`;

  // Add contact names if available
  const names = payloads
    .filter((p) => p.contactName)
    .map((p) => p.contactName!)
    .slice(0, 3);
  const remaining = eventCount - names.length;

  if (names.length > 0) {
    message += remaining > 0
      ? `\nFrom: ${names.join(", ")} +${remaining} more`
      : `\nFrom: ${names.join(", ")}`;
  }

  // Add link
  message += `\n${appUrl}${label.url}`;

  return message;
}

// ─── Dispatch Logic ─────────────────────────────────

/**
 * Get the account phone number for SMS notification delivery.
 * Returns the phone from the accounts table.
 */
async function getAccountPhone(accountId: number): Promise<string | null> {
  const db = await getDb();
  if (!db) return null;

  const [account] = await db
    .select({ phone: accounts.phone })
    .from(accounts)
    .where(eq(accounts.id, accountId))
    .limit(1);

  return account?.phone || null;
}

/**
 * Get all users in an account who have SMS notifications enabled for a given event type.
 * First checks per-user phone numbers, then falls back to account-level phone.
 * Returns unique phone numbers to avoid duplicate SMS.
 */
async function getSmsRecipientsForAccount(
  accountId: number,
  eventType: PushEventType
): Promise<Array<{ phone: string; userId?: number; source: string }>> {
  const db = await getDb();
  if (!db) return [];

  // Get all push subscriptions for this account (they store notification preferences)
  const subs = await db
    .select({
      userId: pushSubscriptions.userId,
      notificationPreferences: pushSubscriptions.notificationPreferences,
    })
    .from(pushSubscriptions)
    .where(eq(pushSubscriptions.accountId, accountId));

  // Collect user IDs that have SMS enabled
  const smsEnabledUserIds: number[] = [];

  if (subs.length > 0) {
    for (const sub of subs) {
      const prefs = parseNotificationPreferences(sub.notificationPreferences);
      if (isChannelEnabled(prefs, eventType, "sms")) {
        smsEnabledUserIds.push(sub.userId);
      }
    }
  } else {
    // No subscriptions — check if there are owners/managers (default: SMS enabled for them)
    const members = await db
      .select({ userId: accountMembers.userId, role: accountMembers.role })
      .from(accountMembers)
      .where(eq(accountMembers.accountId, accountId));

    for (const m of members) {
      if (m.role === "owner" || m.role === "manager") {
        smsEnabledUserIds.push(m.userId);
      }
    }
  }

  if (smsEnabledUserIds.length === 0) return [];

  // Try to get per-user phone numbers first
  const recipients: Array<{ phone: string; userId?: number; source: string }> = [];
  const seenPhones = new Set<string>();

  for (const userId of smsEnabledUserIds) {
    const [user] = await db
      .select({ phone: users.phone })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (user?.phone && !seenPhones.has(user.phone)) {
      seenPhones.add(user.phone);
      recipients.push({ phone: user.phone, userId, source: "user" });
    }
  }

  // If no per-user phones found, fall back to account-level phone
  if (recipients.length === 0) {
    const accountPhone = await getAccountPhone(accountId);
    if (accountPhone && !seenPhones.has(accountPhone)) {
      recipients.push({ phone: accountPhone, source: "account" });
    }
  }

  return recipients;
}

/**
 * Send SMS notifications for a single event to all eligible recipients in an account.
 * Checks per-user notification preferences for the SMS channel.
 */
export async function sendSmsNotification(
  accountId: number,
  eventType: PushEventType,
  payload: SmsNotificationPayload
): Promise<{ sent: number; failed: number; externalIds: string[] }> {
  const recipients = await getSmsRecipientsForAccount(accountId, eventType);

  if (recipients.length === 0) {
    return { sent: 0, failed: 0, externalIds: [] };
  }

  const appUrl = process.env.VITE_APP_URL || "https://apexcrm-knxkwfan.manus.space";
  const message = buildNotificationSms(eventType, payload, appUrl);

  let sent = 0;
  let failed = 0;
  const externalIds: string[] = [];

  for (const recipient of recipients) {
    try {
      const result = await dispatchSMS({
        to: recipient.phone,
        body: message,
        accountId,
      });

      if (result.success) {
        sent++;
        if (result.externalId) externalIds.push(result.externalId);
        console.log(`[SmsNotify] Sent ${eventType} SMS to ${recipient.phone} (${recipient.source})`);
      } else {
        failed++;
        console.warn(`[SmsNotify] Failed to send ${eventType} SMS to ${recipient.phone}: ${result.error}`);
      }
    } catch (err) {
      failed++;
      console.error(`[SmsNotify] Error sending ${eventType} SMS to ${recipient.phone}:`, err);
    }
  }

  return { sent, failed, externalIds };
}

/**
 * Send batched SMS notifications for grouped events.
 * Used by the batch flush worker when multiple events of the same type are grouped.
 */
export async function sendBatchedSmsNotification(
  accountId: number,
  eventType: PushEventType,
  eventCount: number,
  payloads: SmsNotificationPayload[]
): Promise<{ sent: number; failed: number; externalIds: string[] }> {
  const recipients = await getSmsRecipientsForAccount(accountId, eventType);

  if (recipients.length === 0) {
    return { sent: 0, failed: 0, externalIds: [] };
  }

  const appUrl = process.env.VITE_APP_URL || "https://apexcrm-knxkwfan.manus.space";
  const message = buildBatchedNotificationSms(eventType, eventCount, payloads, appUrl);

  let sent = 0;
  let failed = 0;
  const externalIds: string[] = [];

  for (const recipient of recipients) {
    try {
      const result = await dispatchSMS({
        to: recipient.phone,
        body: message,
        accountId,
      });

      if (result.success) {
        sent++;
        if (result.externalId) externalIds.push(result.externalId);
        console.log(`[SmsNotify] Sent batched ${eventType} SMS (${eventCount} events) to ${recipient.phone}`);
      } else {
        failed++;
        console.warn(`[SmsNotify] Failed batched ${eventType} SMS to ${recipient.phone}: ${result.error}`);
      }
    } catch (err) {
      failed++;
      console.error(`[SmsNotify] Error sending batched ${eventType} SMS to ${recipient.phone}:`, err);
    }
  }

  return { sent, failed, externalIds };
}

/**
 * Exported for testing
 */
export { buildNotificationSms, buildBatchedNotificationSms, getSmsRecipientsForAccount };
