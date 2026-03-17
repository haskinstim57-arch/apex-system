import Twilio from "twilio";
import { getAccountMessagingSettings } from "../db";

// ─────────────────────────────────────────────
// Twilio SMS Service
// Sends SMS messages via the Twilio REST API.
// Supports per-account credentials with fallback to global env vars.
// ─────────────────────────────────────────────

let _globalClient: ReturnType<typeof Twilio> | null = null;

function getGlobalClient(): ReturnType<typeof Twilio> {
  if (!_globalClient) {
    const sid = process.env.TWILIO_ACCOUNT_SID;
    const token = process.env.TWILIO_AUTH_TOKEN;
    if (!sid || !token) {
      throw new Error(
        "[Twilio] Missing TWILIO_ACCOUNT_SID or TWILIO_AUTH_TOKEN environment variables"
      );
    }
    _globalClient = Twilio(sid, token);
  }
  return _globalClient;
}

/** Get the default "from" phone number from env */
function getGlobalFromNumber(): string {
  const from = process.env.TWILIO_FROM_NUMBER;
  if (!from) {
    throw new Error("[Twilio] Missing TWILIO_FROM_NUMBER environment variable");
  }
  return from;
}

export interface TwilioSendResult {
  success: boolean;
  externalId?: string;
  error?: string;
}

/**
 * Resolve Twilio credentials for a given account.
 * Priority: per-account settings > global env vars.
 * Returns null if neither is configured.
 */
async function resolveCredentials(accountId?: number): Promise<{
  client: ReturnType<typeof Twilio>;
  fromNumber: string;
} | null> {
  // Try per-account credentials first
  if (accountId) {
    try {
      const settings = await getAccountMessagingSettings(accountId);
      if (
        settings?.twilioAccountSid &&
        settings?.twilioAuthToken &&
        settings?.twilioFromNumber
      ) {
        const client = Twilio(settings.twilioAccountSid, settings.twilioAuthToken);
        return { client, fromNumber: settings.twilioFromNumber };
      }
    } catch (err) {
      console.warn(`[Twilio] Failed to load per-account settings for account ${accountId}:`, err);
    }
  }

  // Fall back to global env vars
  if (
    process.env.TWILIO_ACCOUNT_SID &&
    process.env.TWILIO_AUTH_TOKEN &&
    process.env.TWILIO_FROM_NUMBER
  ) {
    return { client: getGlobalClient(), fromNumber: getGlobalFromNumber() };
  }

  return null;
}

/**
 * Send an SMS via Twilio.
 * @param to - E.164 phone number (e.g. +15551234567)
 * @param body - Message body (max 1600 chars for SMS)
 * @param from - Optional override for the sender number
 * @param accountId - Optional account ID for per-account credentials
 */
export async function sendSMS(
  to: string,
  body: string,
  from?: string,
  accountId?: number
): Promise<TwilioSendResult> {
  const creds = await resolveCredentials(accountId);

  if (!creds) {
    console.warn(
      "[Twilio] Not configured — SMS will not be sent. Set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM_NUMBER."
    );
    return {
      success: false,
      error: "Twilio not configured",
    };
  }

  try {
    const message = await creds.client.messages.create({
      to,
      from: from || creds.fromNumber,
      body,
    });

    console.log(
      `[Twilio] SMS sent: sid=${message.sid} to=${to} status=${message.status}${accountId ? ` account=${accountId}` : ""}`
    );

    return {
      success: true,
      externalId: message.sid,
    };
  } catch (err: any) {
    const errorMsg = err?.message || String(err);
    console.error(`[Twilio] SMS send failed to=${to}: ${errorMsg}`);
    return {
      success: false,
      error: errorMsg,
    };
  }
}

/**
 * Check if Twilio is configured (global env vars present).
 * Note: per-account credentials are checked at send time.
 */
export function isTwilioConfigured(): boolean {
  return !!(
    process.env.TWILIO_ACCOUNT_SID &&
    process.env.TWILIO_AUTH_TOKEN &&
    process.env.TWILIO_FROM_NUMBER
  );
}
