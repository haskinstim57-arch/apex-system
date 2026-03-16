import Twilio from "twilio";

// ─────────────────────────────────────────────
// Twilio SMS Service
// Sends SMS messages via the Twilio REST API.
// Requires env vars: TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM_NUMBER
// ─────────────────────────────────────────────

let _client: ReturnType<typeof Twilio> | null = null;

function getClient(): ReturnType<typeof Twilio> {
  if (!_client) {
    const sid = process.env.TWILIO_ACCOUNT_SID;
    const token = process.env.TWILIO_AUTH_TOKEN;
    if (!sid || !token) {
      throw new Error(
        "[Twilio] Missing TWILIO_ACCOUNT_SID or TWILIO_AUTH_TOKEN environment variables"
      );
    }
    _client = Twilio(sid, token);
  }
  return _client;
}

/** Get the default "from" phone number from env */
function getFromNumber(): string {
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
 * Send an SMS via Twilio.
 * @param to - E.164 phone number (e.g. +15551234567)
 * @param body - Message body (max 1600 chars for SMS)
 * @param from - Optional override for the sender number
 */
export async function sendSMS(
  to: string,
  body: string,
  from?: string
): Promise<TwilioSendResult> {
  // Guard: if Twilio is not configured, log and return graceful failure
  if (
    !process.env.TWILIO_ACCOUNT_SID ||
    !process.env.TWILIO_AUTH_TOKEN ||
    !process.env.TWILIO_FROM_NUMBER
  ) {
    console.warn(
      "[Twilio] Not configured — SMS will not be sent. Set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM_NUMBER."
    );
    return {
      success: false,
      error: "Twilio not configured",
    };
  }

  try {
    const client = getClient();
    const message = await client.messages.create({
      to,
      from: from || getFromNumber(),
      body,
    });

    console.log(
      `[Twilio] SMS sent: sid=${message.sid} to=${to} status=${message.status}`
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
 * Check if Twilio is configured (all required env vars present).
 */
export function isTwilioConfigured(): boolean {
  return !!(
    process.env.TWILIO_ACCOUNT_SID &&
    process.env.TWILIO_AUTH_TOKEN &&
    process.env.TWILIO_FROM_NUMBER
  );
}
