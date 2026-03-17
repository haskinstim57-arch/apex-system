import sgMail, { MailService } from "@sendgrid/mail";
import { getAccountMessagingSettings } from "../db";

// ─────────────────────────────────────────────
// SendGrid Email Service
// Sends emails via the SendGrid v3 API.
// Supports per-account credentials with fallback to global env vars.
// ─────────────────────────────────────────────

let _globalInitialized = false;

// Startup check: warn immediately if SENDGRID_API_KEY is not set
if (!process.env.SENDGRID_API_KEY) {
  console.warn("[WARN] SENDGRID_API_KEY is not set \u2014 emails will not be delivered.");
}

function ensureGlobalInitialized() {
  if (!_globalInitialized) {
    const apiKey = process.env.SENDGRID_API_KEY;
    if (!apiKey) {
      throw new Error("[SendGrid] Missing SENDGRID_API_KEY environment variable");
    }
    sgMail.setApiKey(apiKey);
    _globalInitialized = true;
  }
}

const FALLBACK_FROM_EMAIL = "noreply@apexsystem.io";

function getGlobalFromEmail(): string {
  const from = process.env.SENDGRID_FROM_EMAIL;
  if (!from) {
    console.warn(`[SendGrid] SENDGRID_FROM_EMAIL is not set \u2014 using fallback: ${FALLBACK_FROM_EMAIL}`);
    return FALLBACK_FROM_EMAIL;
  }
  return from;
}

function getGlobalFromName(): string {
  return process.env.SENDGRID_FROM_NAME || "Apex System";
}

/**
 * Resolve SendGrid credentials for a given account.
 * Priority: per-account settings > global env vars.
 * Returns null if neither is configured.
 */
async function resolveCredentials(accountId?: number): Promise<{
  mailService: MailService;
  fromEmail: string;
  fromName: string;
} | null> {
  // Try per-account credentials first
  if (accountId) {
    try {
      const settings = await getAccountMessagingSettings(accountId);
      if (settings?.sendgridApiKey && settings?.sendgridFromEmail) {
        const accountMailService = new MailService();
        accountMailService.setApiKey(settings.sendgridApiKey);
        return {
          mailService: accountMailService,
          fromEmail: settings.sendgridFromEmail,
          fromName: settings.sendgridFromName || "Apex System",
        };
      }
    } catch (err) {
      console.warn(`[SendGrid] Failed to load per-account settings for account ${accountId}:`, err);
    }
  }

  // Fall back to global env vars (SENDGRID_FROM_EMAIL has a fallback default)
  if (process.env.SENDGRID_API_KEY) {
    ensureGlobalInitialized();
    return {
      mailService: sgMail,
      fromEmail: getGlobalFromEmail(),
      fromName: getGlobalFromName(),
    };
  }

  return null;
}

export interface SendGridResult {
  success: boolean;
  externalId?: string;
  error?: string;
}

/**
 * Send an email via SendGrid.
 * @param params.to - Recipient email address
 * @param params.subject - Email subject line
 * @param params.body - Email body (HTML supported)
 * @param params.from - Optional override for sender email
 * @param params.fromName - Optional override for sender name
 * @param params.accountId - Optional account ID for per-account credentials
 */
export async function sendEmail(params: {
  to: string;
  subject: string;
  body: string;
  from?: string;
  fromName?: string;
  accountId?: number;
}): Promise<SendGridResult> {
  const creds = await resolveCredentials(params.accountId);

  if (!creds) {
    console.warn(
      "[SendGrid] Not configured — email will not be sent. Set SENDGRID_API_KEY and SENDGRID_FROM_EMAIL."
    );
    return {
      success: false,
      error: "SendGrid not configured",
    };
  }

  try {
    const msg = {
      to: params.to,
      from: {
        email: params.from || creds.fromEmail,
        name: params.fromName || creds.fromName,
      },
      subject: params.subject,
      // Detect if body contains HTML tags; if so, send as HTML + text fallback
      ...(/<[a-z][\s\S]*>/i.test(params.body)
        ? {
            html: params.body,
            text: params.body.replace(/<[^>]*>/g, ""), // strip tags for plain text
          }
        : {
            text: params.body,
          }),
    };

    const [response] = await creds.mailService.send(msg);

    // SendGrid returns the message ID in the x-message-id header
    const messageId =
      response?.headers?.["x-message-id"] || `sg_${Date.now()}`;

    console.log(
      `[SendGrid] Email sent: messageId=${messageId} to=${params.to} subject="${params.subject}"${params.accountId ? ` account=${params.accountId}` : ""}`
    );

    return {
      success: true,
      externalId: String(messageId),
    };
  } catch (err: any) {
    const errorMsg =
      err?.response?.body?.errors?.[0]?.message || err?.message || String(err);
    console.error(`[SendGrid] Email send failed to=${params.to}: ${errorMsg}`);
    return {
      success: false,
      error: errorMsg,
    };
  }
}

/**
 * Check if SendGrid is configured (global env vars present).
 * Note: per-account credentials are checked at send time.
 */
export function isSendGridConfigured(): boolean {
  return !!process.env.SENDGRID_API_KEY;
}
