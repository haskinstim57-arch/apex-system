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

  // Placeholder fallback — log and simulate success
  console.log(
    `[Messaging] SMS placeholder: to=${params.to} body="${params.body.substring(0, 50)}..."`
  );
  return {
    success: true,
    externalId: `placeholder_sms_${Date.now()}`,
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

  // Placeholder fallback — log and simulate success
  console.log(
    `[Messaging] Email placeholder: to=${params.to} subject="${params.subject}"`
  );
  return {
    success: true,
    externalId: `placeholder_email_${Date.now()}`,
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
