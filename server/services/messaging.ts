import { sendSMSViaBlooio, isBlooioConfigured } from "./blooio";
import { sendEmail, isSendGridConfigured } from "./sendgrid";
import { isPhoneOptedOut, logMessageBlocked } from "./smsCompliance";

// ─────────────────────────────────────────────
// Unified Messaging Dispatcher
// Routes SMS through Blooio, Email through SendGrid.
// Falls back to logging when providers are not set up.
// ─────────────────────────────────────────────

export interface MessageSendResult {
  success: boolean;
  externalId?: string;
  error?: string;
  provider: "blooio" | "sendgrid" | "placeholder";
}

/**
 * Send an SMS message through the configured provider (Blooio).
 * Uses per-account Blooio API key if available, falls back to global.
 * Falls back to placeholder logging if neither is configured.
 */
export async function dispatchSMS(params: {
  to: string;
  body: string;
  from?: string;
  accountId?: number;
  contactId?: number;
  /** Set to true to bypass DND check (e.g. for compliance auto-replies) */
  skipDndCheck?: boolean;
}): Promise<MessageSendResult> {
  // ─── DND / Opt-Out Enforcement ───
  if (!params.skipDndCheck && params.accountId) {
    try {
      const optedOut = await isPhoneOptedOut(params.to, params.accountId);
      if (optedOut) {
        console.warn(
          `[Messaging] SMS blocked by DND/opt-out: to=${params.to} account=${params.accountId}`
        );
        if (params.contactId) {
          logMessageBlocked({
            accountId: params.accountId,
            contactId: params.contactId,
            phone: params.to,
            reason: "Phone number is on the opt-out list (DND)",
          }).catch((err) => console.error("[Messaging] Failed to log blocked message:", err));
        }
        return {
          success: false,
          error: "Message blocked: recipient has opted out of SMS (DND)",
          provider: "blooio",
        };
      }
    } catch (err) {
      // Don't block sending if the DND check itself fails
      console.error("[Messaging] DND check error (allowing send):", err);
    }
  }

  // Send via Blooio — it handles per-account → global fallback internally
  const result = await sendSMSViaBlooio(params.to, params.body, params.accountId);
  if (result.success || result.error !== "Blooio not configured") {
    return { ...result, provider: "blooio" };
  }

  // Placeholder fallback — neither per-account nor global configured
  console.warn(
    `[Messaging] SMS not sent (provider not configured): to=${params.to} body="${params.body.substring(0, 50)}..."`
  );
  return {
    success: false,
    error: "Provider not configured — set Blooio API key in account settings or global environment variables",
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
    sms: isBlooioConfigured() ? "blooio" : "placeholder",
    email: isSendGridConfigured() ? "sendgrid" : "placeholder",
  };
}
