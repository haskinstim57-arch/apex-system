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
 * Falls back to placeholder logging if Twilio is not configured.
 */
export async function dispatchSMS(params: {
  to: string;
  body: string;
  from?: string;
}): Promise<MessageSendResult> {
  if (isTwilioConfigured()) {
    const result = await sendSMS(params.to, params.body, params.from);
    return { ...result, provider: "twilio" };
  }

  // Placeholder fallback — provider not configured, report failure
  console.warn(
    `[Messaging] SMS not sent (provider not configured): to=${params.to} body="${params.body.substring(0, 50)}..."`
  );
  return {
    success: false,
    error: "Provider not configured — set TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN in environment variables",
    provider: "placeholder",
  };
}

/**
 * Send an email through the configured provider.
 * Falls back to placeholder logging if SendGrid is not configured.
 */
export async function dispatchEmail(params: {
  to: string;
  subject: string;
  body: string;
  from?: string;
  fromName?: string;
}): Promise<MessageSendResult> {
  if (isSendGridConfigured()) {
    const result = await sendEmail(params);
    return { ...result, provider: "sendgrid" };
  }

  // Placeholder fallback — provider not configured, report failure
  console.warn(
    `[Messaging] Email not sent (provider not configured): to=${params.to} subject="${params.subject}"`
  );
  return {
    success: false,
    error: "Provider not configured — set SENDGRID_API_KEY in environment variables",
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
