/**
 * Lead Notification Service
 * Sends instant SMS (Blooio) + email (SendGrid) to designated account members
 * when a new Facebook lead comes in. Also creates in-app notifications.
 *
 * NOT hardcoded — uses account member lookup from the database.
 * Recipients are all active members of the account with phone/email on file.
 */

import { sendSMSViaBlooio } from "./blooio";
import { dispatchEmail } from "./messaging";
import { sendPushNotificationToAccount } from "./webPush";
import { listMembers, createNotification, getDb } from "../db";
import { users } from "../../drizzle/schema";
import { inArray } from "drizzle-orm";

interface LeadInfo {
  contactId: number;
  name: string;
  email: string;
  phone: string;
  accountId: number;
  source?: string;
  timestamp?: Date;
}

/**
 * Notify all account members about a new lead via SMS, email, and in-app notification.
 */
export async function notifyLeadRecipients(lead: LeadInfo): Promise<void> {
  const { accountId, name, email, phone, contactId, source, timestamp } = lead;
  const leadTime = timestamp
    ? timestamp.toLocaleString("en-US", { timeZone: "America/Los_Angeles" })
    : new Date().toLocaleString("en-US", { timeZone: "America/Los_Angeles" });

  // Get all active members of this account
  const members = await listMembers(accountId);
  if (!members || members.length === 0) {
    console.warn(`[LeadNotify] No members found for account ${accountId}`);
    return;
  }

  // Get user phone numbers (listMembers doesn't include phone, so we query directly)
  const db = await getDb();
  if (!db) return;

  const userIds = members.filter((m) => m.isActive).map((m) => m.userId);
  if (userIds.length === 0) return;

  const userRecords = await db
    .select({ id: users.id, name: users.name, email: users.email, phone: users.phone })
    .from(users)
    .where(inArray(users.id, userIds));

  const userMap = new Map(userRecords.map((u) => [u.id, u]));

  // Build notification content
  const smsBody = [
    "NEW LEAD",
    `Name: ${name || "Unknown"}`,
    `Email: ${email || "N/A"}`,
    `Phone: ${phone || "N/A"}`,
    `Time: ${leadTime}`,
    source ? `Source: ${source}` : "",
    "Call them NOW!",
  ]
    .filter(Boolean)
    .join("\n");

  const emailSubject = `New Lead: ${name || "Unknown"} - Call Now!`;
  const emailHtml = buildLeadEmailHtml({ name, email, phone, leadTime, source });

  // Send to each member
  const promises: Promise<void>[] = [];

  for (const member of members) {
    if (!member.isActive) continue;
    const user = userMap.get(member.userId);
    if (!user) continue;

    // SMS via Blooio
    if (user.phone) {
      promises.push(
        sendSMSViaBlooio(user.phone, smsBody, accountId)
          .then((result) => {
            console.log(`[LeadNotify] SMS sent to ${user.name} (${user.phone}): ${result.success ? "OK" : result.error}`);
          })
          .catch((err) => {
            console.error(`[LeadNotify] SMS failed for ${user.name}:`, err.message);
          })
      );
    }

    // Email via SendGrid
    if (user.email) {
      promises.push(
        dispatchEmail({
          to: user.email,
          subject: emailSubject,
          body: emailHtml,
          accountId,
        })
          .then((result) => {
            console.log(`[LeadNotify] Email sent to ${user.name} (${user.email}): ${result.success ? "OK" : result.error}`);
          })
          .catch((err) => {
            console.error(`[LeadNotify] Email failed for ${user.name}:`, err.message);
          })
      );
    }
  }

  // In-app notification (visible to all account members)
  promises.push(
    createNotification({
      accountId,
      type: "new_lead",
      title: `New Lead: ${name || "Unknown"}`,
      body: `${email || ""} | ${phone || ""} | ${leadTime}`,
      link: `/contacts/${contactId}`,
    })
      .then(() => console.log(`[LeadNotify] In-app notification created for account ${accountId}`))
      .catch((err: any) => console.error(`[LeadNotify] In-app notification failed:`, err.message))
  );

  // Push notification (uses facebook_lead event type which is already registered in PushEventType)
  promises.push(
    sendPushNotificationToAccount(accountId, {
      title: `New Lead: ${name || "Unknown"}`,
      body: `${phone || email || "No contact info"} - Call now!`,
      url: `/contacts/${contactId}`,
      eventType: "facebook_lead",
      contactName: name || "Unknown",
    })
      .then(() => console.log(`[LeadNotify] Push notification enqueued for account ${accountId}`))
      .catch((err: any) => console.error(`[LeadNotify] Push failed:`, err.message))
  );

  await Promise.allSettled(promises);
  console.log(`[LeadNotify] All notifications dispatched for lead ${name} (account ${accountId})`);
}

/**
 * Build a styled HTML email for lead notifications.
 */
function buildLeadEmailHtml(params: {
  name: string;
  email: string;
  phone: string;
  leadTime: string;
  source?: string;
}): string {
  const { name, email, phone, leadTime, source } = params;
  const phoneLink = phone ? `<a href="tel:${phone}" style="color: #1a56db;">${phone}</a>` : "N/A";
  const sourceRow = source
    ? `<tr><td style="padding: 8px 0; font-weight: bold; color: #374151;">Source:</td><td style="padding: 8px 0; color: #111827;">${source}</td></tr>`
    : "";

  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background: #1a56db; color: white; padding: 20px; border-radius: 8px 8px 0 0;">
        <h2 style="margin: 0;">New Lead Alert</h2>
      </div>
      <div style="background: #f9fafb; padding: 24px; border: 1px solid #e5e7eb; border-radius: 0 0 8px 8px;">
        <table style="width: 100%; border-collapse: collapse;">
          <tr>
            <td style="padding: 8px 0; font-weight: bold; color: #374151; width: 100px;">Name:</td>
            <td style="padding: 8px 0; color: #111827;">${name || "Unknown"}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; font-weight: bold; color: #374151;">Email:</td>
            <td style="padding: 8px 0; color: #111827;">${email || "N/A"}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; font-weight: bold; color: #374151;">Phone:</td>
            <td style="padding: 8px 0; color: #111827;">${phoneLink}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; font-weight: bold; color: #374151;">Time:</td>
            <td style="padding: 8px 0; color: #111827;">${leadTime}</td>
          </tr>
          ${sourceRow}
        </table>
        <div style="margin-top: 20px; padding: 16px; background: #fef3c7; border-radius: 6px; border: 1px solid #f59e0b;">
          <strong style="color: #92400e;">Speed to lead matters!</strong>
          <p style="margin: 4px 0 0; color: #92400e;">Call this lead within 5 minutes for the best chance of conversion.</p>
        </div>
      </div>
    </div>
  `;
}
