/**
 * Twilio SMS Provider
 *
 * Sends SMS via Twilio REST API using per-account credentials
 * stored in accountMessagingSettings.
 */
import { getAccountMessagingSettings } from "../db";

export interface TwilioSmsResult {
  success: boolean;
  externalId?: string;
  error?: string;
}

/**
 * Send an SMS via Twilio REST API.
 * Fetches twilioAccountSid, twilioAuthToken, twilioFromNumber from the account's messaging settings.
 */
export async function sendSMSViaTwilio(
  to: string,
  body: string,
  accountId: number,
  from?: string
): Promise<TwilioSmsResult> {
  const settings = await getAccountMessagingSettings(accountId);
  if (!settings?.twilioAccountSid || !settings?.twilioAuthToken) {
    return {
      success: false,
      error: "Twilio not configured for this account — set Account SID and Auth Token in Messaging Settings",
    };
  }

  const fromNumber = from || settings.twilioFromNumber;
  if (!fromNumber) {
    return {
      success: false,
      error: "No Twilio from-number configured — set a Twilio phone number in Messaging Settings",
    };
  }

  const sid = settings.twilioAccountSid;
  const token = settings.twilioAuthToken;
  const url = `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`;

  try {
    const authHeader = Buffer.from(`${sid}:${token}`).toString("base64");
    const formBody = new URLSearchParams({
      To: to,
      From: fromNumber,
      Body: body,
    });

    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Basic ${authHeader}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: formBody.toString(),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error(`[TwilioSMS] API error: ${response.status}`, data);
      return {
        success: false,
        error: data.message || `Twilio API error: ${response.status}`,
      };
    }

    console.log(`[TwilioSMS] Sent to=${to} sid=${data.sid}`);
    return {
      success: true,
      externalId: data.sid,
    };
  } catch (err: any) {
    console.error("[TwilioSMS] Network error:", err);
    return {
      success: false,
      error: err.message || "Twilio SMS send failed",
    };
  }
}
