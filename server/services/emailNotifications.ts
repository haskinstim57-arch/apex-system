/**
 * Email Notification Channel Service
 *
 * Sends email notifications for each event type when the user has
 * enabled the "email" channel in their notification preferences.
 *
 * Uses the existing SendGrid integration via dispatchEmail().
 * Checks isChannelEnabled(prefs, eventType, "email") before sending.
 *
 * Email routing per knowledge:
 *   - Leads/appointments → haskinstim57@gmail.com
 *   - Dev/server → tariqhaskins@indigolabsai.com
 *   (Can be overridden per-user via their profile email)
 */

import { getDb } from "../db";
import { pushSubscriptions, users, accountMembers } from "../../drizzle/schema";
import { eq, and } from "drizzle-orm";
import { parseNotificationPreferences, isChannelEnabled } from "./pushBatcher";
import type { PushEventType, NotificationPreferences } from "./pushBatcher";
import { dispatchEmail } from "./messaging";

// ─── Email Templates ────────────────────────────────

interface EmailNotificationPayload {
  title: string;
  body: string;
  url?: string;
  contactName?: string;
}

/**
 * Build a styled HTML email for a notification event.
 */
function buildNotificationEmail(
  eventType: PushEventType,
  payload: EmailNotificationPayload,
  appUrl: string
): { subject: string; html: string } {
  const typeConfig: Record<PushEventType, { emoji: string; color: string; label: string }> = {
    inbound_sms: { emoji: "💬", color: "#3B82F6", label: "New SMS Message" },
    inbound_email: { emoji: "📧", color: "#8B5CF6", label: "New Email Received" },
    appointment_booked: { emoji: "📅", color: "#10B981", label: "Appointment Booked" },
    ai_call_completed: { emoji: "🤖", color: "#F59E0B", label: "AI Call Completed" },
    facebook_lead: { emoji: "📣", color: "#1D4ED8", label: "New Facebook Lead" },
    message_delivery_failure: { emoji: "⚠️", color: "#EF4444", label: "Message Delivery Failure" },
  };

  const config = typeConfig[eventType] || { emoji: "🔔", color: "#6B7280", label: "Notification" };
  const subject = `${config.emoji} ${payload.title}`;
  const actionUrl = payload.url ? `${appUrl}${payload.url}` : appUrl;

  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(payload.title)}</title>
</head>
<body style="margin:0;padding:0;background-color:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;">
  <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background-color:#f4f4f5;">
    <tr>
      <td align="center" style="padding:40px 20px;">
        <table role="presentation" cellpadding="0" cellspacing="0" width="560" style="max-width:560px;width:100%;background-color:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1);">
          <!-- Header -->
          <tr>
            <td style="background-color:${config.color};padding:24px 32px;">
              <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
                <tr>
                  <td>
                    <span style="font-size:14px;color:rgba(255,255,255,0.85);text-transform:uppercase;letter-spacing:1px;font-weight:600;">${escapeHtml(config.label)}</span>
                  </td>
                </tr>
                <tr>
                  <td style="padding-top:8px;">
                    <span style="font-size:20px;color:#ffffff;font-weight:700;">${escapeHtml(payload.title)}</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding:32px;">
              <p style="margin:0 0 16px;font-size:16px;line-height:1.6;color:#374151;">
                ${escapeHtml(payload.body)}
              </p>
              ${payload.contactName ? `
              <p style="margin:0 0 24px;font-size:14px;color:#6B7280;">
                Contact: <strong style="color:#111827;">${escapeHtml(payload.contactName)}</strong>
              </p>
              ` : ""}
              <table role="presentation" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="border-radius:8px;background-color:${config.color};">
                    <a href="${escapeHtml(actionUrl)}" target="_blank" style="display:inline-block;padding:12px 28px;font-size:14px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:8px;">
                      View Details &rarr;
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding:20px 32px;border-top:1px solid #e5e7eb;background-color:#f9fafb;">
              <p style="margin:0;font-size:12px;color:#9CA3AF;text-align:center;">
                You received this because email notifications are enabled for ${escapeHtml(config.label.toLowerCase())} events.
                <br>Manage your preferences in <a href="${escapeHtml(appUrl)}/settings" style="color:${config.color};text-decoration:underline;">Notification Settings</a>.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`.trim();

  return { subject, html };
}

/**
 * Build a batched/grouped email for multiple events of the same type.
 */
function buildBatchedNotificationEmail(
  eventType: PushEventType,
  eventCount: number,
  payloads: EmailNotificationPayload[],
  appUrl: string
): { subject: string; html: string } {
  const typeLabels: Record<PushEventType, { singular: string; plural: string; url: string }> = {
    inbound_sms: { singular: "new SMS message", plural: "new SMS messages", url: "/inbox" },
    inbound_email: { singular: "new email", plural: "new emails", url: "/inbox" },
    appointment_booked: { singular: "new appointment", plural: "new appointments", url: "/calendar" },
    ai_call_completed: { singular: "AI call completed", plural: "AI calls completed", url: "/ai-calls" },
    facebook_lead: { singular: "new Facebook lead", plural: "new Facebook leads", url: "/contacts" },
    message_delivery_failure: { singular: "message delivery failure", plural: "message delivery failures", url: "/message-queue" },
  };

  const label = typeLabels[eventType] || { singular: "notification", plural: "notifications", url: "/" };
  const noun = eventCount === 1 ? label.singular : label.plural;
  const title = `${eventCount} ${noun}`;

  // Build a summary body from payloads
  const names = payloads
    .filter((p) => p.contactName)
    .map((p) => p.contactName!)
    .slice(0, 5);
  const remaining = eventCount - names.length;
  let bodyText: string;
  if (names.length > 0) {
    bodyText = remaining > 0
      ? `From ${names.join(", ")} and ${remaining} more`
      : `From ${names.join(", ")}`;
  } else {
    bodyText = payloads[0]?.body || `You have ${eventCount} ${noun}`;
  }

  return buildNotificationEmail(
    eventType,
    { title, body: bodyText, url: label.url },
    appUrl
  );
}

// ─── Dispatch Logic ─────────────────────────────────

/**
 * Get all users in an account who have email notifications enabled for a given event type.
 * Returns their email addresses and user IDs.
 */
async function getEmailRecipientsForAccount(
  accountId: number,
  eventType: PushEventType
): Promise<Array<{ userId: number; email: string }>> {
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

  // Deduplicate by userId and check email channel preference
  const userPrefs = new Map<number, boolean>();
  for (const sub of subs) {
    if (userPrefs.has(sub.userId)) continue; // already processed
    const prefs = parseNotificationPreferences(sub.notificationPreferences);
    userPrefs.set(sub.userId, isChannelEnabled(prefs, eventType, "email"));
  }

  // If no subscriptions exist, check if there are account members who should receive emails
  // (fallback: account owners/managers get emails for their event types by default)
  if (subs.length === 0) {
    const members = await db
      .select({
        userId: accountMembers.userId,
        role: accountMembers.role,
      })
      .from(accountMembers)
      .where(
        and(
          eq(accountMembers.accountId, accountId),
        )
      );

    // For accounts with no push subscriptions, only send to owners/managers
    for (const member of members) {
      if (member.role === "owner" || member.role === "manager") {
        userPrefs.set(member.userId, true);
      }
    }
  }

  // Get email addresses for enabled users
  const enabledUserIds = Array.from(userPrefs.entries())
    .filter(([_, enabled]) => enabled)
    .map(([userId]) => userId);

  if (enabledUserIds.length === 0) return [];

  const recipients: Array<{ userId: number; email: string }> = [];
  for (const userId of enabledUserIds) {
    const [user] = await db
      .select({ email: users.email })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (user?.email) {
      recipients.push({ userId, email: user.email });
    }
  }

  return recipients;
}

/**
 * Send email notifications for a single event to all eligible users in an account.
 * Checks per-user notification preferences for the email channel.
 */
export async function sendEmailNotification(
  accountId: number,
  eventType: PushEventType,
  payload: EmailNotificationPayload
): Promise<{ sent: number; failed: number; externalIds: string[] }> {
  const recipients = await getEmailRecipientsForAccount(accountId, eventType);

  if (recipients.length === 0) {
    return { sent: 0, failed: 0, externalIds: [] };
  }

  const appUrl = process.env.VITE_APP_URL || "https://apexcrm-knxkwfan.manus.space";
  const { subject, html } = buildNotificationEmail(eventType, payload, appUrl);

  let sent = 0;
  let failed = 0;
  const externalIds: string[] = [];

  for (const recipient of recipients) {
    try {
      const result = await dispatchEmail({
        to: recipient.email,
        subject,
        body: html,
        accountId,
      });

      if (result.success) {
        sent++;
        if (result.externalId) externalIds.push(result.externalId);
        console.log(`[EmailNotify] Sent ${eventType} email to ${recipient.email} (user ${recipient.userId})`);
      } else {
        failed++;
        console.warn(`[EmailNotify] Failed to send ${eventType} email to ${recipient.email}: ${result.error}`);
      }
    } catch (err) {
      failed++;
      console.error(`[EmailNotify] Error sending ${eventType} email to ${recipient.email}:`, err);
    }
  }

  return { sent, failed, externalIds };
}

/**
 * Send batched email notifications for grouped events.
 * Used by the batch flush worker when multiple events of the same type are grouped.
 */
export async function sendBatchedEmailNotification(
  accountId: number,
  eventType: PushEventType,
  eventCount: number,
  payloads: EmailNotificationPayload[]
): Promise<{ sent: number; failed: number; externalIds: string[] }> {
  const recipients = await getEmailRecipientsForAccount(accountId, eventType);

  if (recipients.length === 0) {
    return { sent: 0, failed: 0, externalIds: [] };
  }

  const appUrl = process.env.VITE_APP_URL || "https://apexcrm-knxkwfan.manus.space";
  const { subject, html } = eventCount === 1 && payloads.length === 1
    ? buildNotificationEmail(eventType, payloads[0], appUrl)
    : buildBatchedNotificationEmail(eventType, eventCount, payloads, appUrl);

  let sent = 0;
  let failed = 0;
  const externalIds: string[] = [];

  for (const recipient of recipients) {
    try {
      const result = await dispatchEmail({
        to: recipient.email,
        subject,
        body: html,
        accountId,
      });

      if (result.success) {
        sent++;
        if (result.externalId) externalIds.push(result.externalId);
        console.log(`[EmailNotify] Sent batched ${eventType} email (${eventCount} events) to ${recipient.email}`);
      } else {
        failed++;
        console.warn(`[EmailNotify] Failed batched ${eventType} email to ${recipient.email}: ${result.error}`);
      }
    } catch (err) {
      failed++;
      console.error(`[EmailNotify] Error sending batched ${eventType} email to ${recipient.email}:`, err);
    }
  }

  return { sent, failed, externalIds };
}

// ─── Utility ────────────────────────────────────────

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

/**
 * Exported for testing
 */
export { buildNotificationEmail, buildBatchedNotificationEmail, getEmailRecipientsForAccount };
