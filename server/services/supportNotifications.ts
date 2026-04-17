import { ENV } from "../_core/env";
import { sendEmail } from "./sendgrid";

/**
 * Parse the SUPPORT_NOTIFICATION_EMAILS env var into an array of emails.
 */
export function getSupportNotificationEmails(): string[] {
  const raw = ENV.supportNotificationEmails;
  if (!raw) return [];
  return raw
    .split(",")
    .map((e) => e.trim())
    .filter((e) => e.length > 0);
}

/**
 * Send email notification to all configured admin emails when a new support ticket is created.
 */
export async function notifyNewTicket(params: {
  ticketId: number;
  subject: string;
  category: string;
  message: string;
  accountName: string;
  submitterName: string;
  submitterEmail: string;
}): Promise<void> {
  const emails = getSupportNotificationEmails();
  if (emails.length === 0) {
    console.warn("[SupportNotify] No notification emails configured, skipping.");
    return;
  }

  const categoryLabels: Record<string, string> = {
    bug: "Bug Report",
    feature: "Feature Request",
    billing: "Billing Question",
    general: "General",
  };

  const ticketUrl = ENV.appUrl
    ? `${ENV.appUrl}/admin/support`
    : "";

  const htmlBody = `
<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto;">
  <div style="background: #1a1a2e; color: #ffffff; padding: 20px 24px; border-radius: 8px 8px 0 0;">
    <h2 style="margin: 0; font-size: 18px;">New Support Ticket #${params.ticketId}</h2>
  </div>
  <div style="border: 1px solid #e5e7eb; border-top: none; padding: 24px; border-radius: 0 0 8px 8px;">
    <table style="width: 100%; border-collapse: collapse; margin-bottom: 16px;">
      <tr>
        <td style="padding: 8px 0; color: #6b7280; font-size: 14px; width: 120px;">Subject:</td>
        <td style="padding: 8px 0; font-weight: 600;">${escapeHtml(params.subject)}</td>
      </tr>
      <tr>
        <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Category:</td>
        <td style="padding: 8px 0;">${categoryLabels[params.category] || params.category}</td>
      </tr>
      <tr>
        <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Account:</td>
        <td style="padding: 8px 0;">${escapeHtml(params.accountName)}</td>
      </tr>
      <tr>
        <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Submitted by:</td>
        <td style="padding: 8px 0;">${escapeHtml(params.submitterName)} (${escapeHtml(params.submitterEmail)})</td>
      </tr>
    </table>
    <div style="background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 6px; padding: 16px; margin-bottom: 16px;">
      <p style="margin: 0 0 4px 0; color: #6b7280; font-size: 12px; text-transform: uppercase; letter-spacing: 0.05em;">Message</p>
      <p style="margin: 0; white-space: pre-wrap;">${escapeHtml(params.message)}</p>
    </div>
    ${ticketUrl ? `<a href="${ticketUrl}" style="display: inline-block; background: #2563eb; color: #ffffff; padding: 10px 20px; border-radius: 6px; text-decoration: none; font-weight: 500;">View in Admin Panel</a>` : ""}
  </div>
</div>`;

  const plainBody = [
    `New Support Ticket #${params.ticketId}`,
    ``,
    `Subject: ${params.subject}`,
    `Category: ${categoryLabels[params.category] || params.category}`,
    `Account: ${params.accountName}`,
    `Submitted by: ${params.submitterName} (${params.submitterEmail})`,
    ``,
    `Message:`,
    params.message,
    ``,
    ticketUrl ? `View ticket: ${ticketUrl}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  for (const email of emails) {
    try {
      await sendEmail({
        to: email,
        subject: `[Apex Support] New ticket #${params.ticketId} from ${params.accountName}: ${params.subject}`,
        body: plainBody,
      });
      console.log(`[SupportNotify] New ticket email sent to ${email}`);
    } catch (err) {
      console.error(`[SupportNotify] Failed to send new ticket email to ${email}:`, err);
    }
  }
}

/**
 * Send email notification when a client replies to a support ticket.
 */
export async function notifyClientReply(params: {
  ticketId: number;
  ticketSubject: string;
  replyBody: string;
  accountName: string;
  replierName: string;
}): Promise<void> {
  const emails = getSupportNotificationEmails();
  if (emails.length === 0) return;

  const ticketUrl = ENV.appUrl
    ? `${ENV.appUrl}/admin/support`
    : "";

  const plainBody = [
    `Client reply on Support Ticket #${params.ticketId}`,
    ``,
    `Ticket: ${params.ticketSubject}`,
    `Account: ${params.accountName}`,
    `Reply from: ${params.replierName}`,
    ``,
    `Reply:`,
    params.replyBody,
    ``,
    ticketUrl ? `View ticket: ${ticketUrl}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  for (const email of emails) {
    try {
      await sendEmail({
        to: email,
        subject: `[Apex Support] Reply on ticket #${params.ticketId}: ${params.ticketSubject}`,
        body: plainBody,
      });
      console.log(`[SupportNotify] Client reply email sent to ${email}`);
    } catch (err) {
      console.error(`[SupportNotify] Failed to send reply email to ${email}:`, err);
    }
  }
}

/**
 * Send email notification to the ticket submitter when Apex staff replies.
 */
export async function notifyStaffReply(params: {
  ticketId: number;
  ticketSubject: string;
  replyBody: string;
  staffName: string;
  clientEmail: string;
  clientName: string;
}): Promise<void> {
  if (!params.clientEmail) {
    console.warn("[SupportNotify] No client email for staff reply notification, skipping.");
    return;
  }

  const ticketUrl = ENV.appUrl
    ? `${ENV.appUrl}/support`
    : "";

  const plainBody = [
    `Apex Systems Support — Reply on Ticket #${params.ticketId}`,
    ``,
    `Hi ${params.clientName || "there"},`,
    ``,
    `${params.staffName || "Apex Support"} has replied to your support ticket:`,
    `"${params.ticketSubject}"`,
    ``,
    `Reply:`,
    params.replyBody,
    ``,
    ticketUrl ? `View your ticket: ${ticketUrl}` : "",
    ``,
    `— Apex Systems Support Team`,
  ]
    .filter(Boolean)
    .join("\n");

  try {
    await sendEmail({
      to: params.clientEmail,
      subject: `[Apex Support] Reply on your ticket #${params.ticketId}: ${params.ticketSubject}`,
      body: plainBody,
    });
    console.log(`[SupportNotify] Staff reply email sent to ${params.clientEmail}`);
  } catch (err) {
    console.error(`[SupportNotify] Failed to send staff reply email to ${params.clientEmail}:`, err);
  }
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
