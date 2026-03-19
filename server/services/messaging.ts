import { sendSMS, isTwilioConfigured } from "./twilio";
import { sendEmail, isSendGridConfigured } from "./sendgrid";

// ─────────────────────────────────────────────
// Unified Messaging Dispatcher
// Routes SMS/Email through real providers when configured,
// falls back to logging when providers are not set up.
// ─────────────────────────────────────────────

export interface MessageSendResult {
  success: boolean;
  externalId?: string;
  error?: string;
  provider: "twilio" | "sendgrid" | "placeholder";
}

/**
 * Send an SMS message through the configured provider.
 * Uses per-account Twilio credentials if available, falls back to global.
 * Falls back to placeholder logging if neither is configured.
 */
export async function dispatchSMS(params: {
  to: string;
  body: string;
  from?: string;
  accountId?: number;
}): Promise<MessageSendResult> {
  // Always attempt sendSMS — it handles per-account → global fallback internally
  const result = await sendSMS(params.to, params.body, params.from, params.accountId);
  if (result.success || result.error !== "Twilio not configured") {
    return { ...result, provider: "twilio" };
  }

  // Placeholder fallback — neither per-account nor global configured
  console.warn(
    `[Messaging] SMS not sent (provider not configured): to=${params.to} body="${params.body.substring(0, 50)}..."`
  );
  return {
    success: false,
    error: "Provider not configured — set Twilio credentials in account settings or global environment variables",
    provider: "placeholder",
  };
}

/**
 * Send an email through the configured provider.
 * Uses per-account SendGrid credentials if available, falls back to global.
 * Falls back to placeholder logging if neither is configured.
 */
export async function dispatchEmail(params: {
  to: string;
  subject: string;
  body: string;
  from?: string;
  fromName?: string;
  accountId?: number;
  attachments?: Array<{
    content: string; // base64-encoded content
    filename: string;
    type: string; // MIME type
    disposition?: string;
  }>;
}): Promise<MessageSendResult> {
  // Always attempt sendEmail — it handles per-account → global fallback internally
  const result = await sendEmail({ ...params });
  if (result.success || result.error !== "SendGrid not configured") {
    return { ...result, provider: "sendgrid" };
  }

  // Placeholder fallback — neither per-account nor global configured
  console.warn(
    `[Messaging] Email not sent (provider not configured): to=${params.to} subject="${params.subject}"`
  );
  return {
    success: false,
    error: "Provider not configured — set SendGrid credentials in account settings or global environment variables",
    provider: "placeholder",
  };
}

/**
 * Check which providers are currently configured.
 */
export function getProviderStatus() {
  return {
    sms: isTwilioConfigured() ? "twilio" : "placeholder",
    email: isSendGridConfigured() ? "sendgrid" : "placeholder",
  };
}
