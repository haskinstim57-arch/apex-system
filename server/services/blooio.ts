import { getAccountMessagingSettings } from "../db";

// ─────────────────────────────────────────────
// Blooio SMS / iMessage Service
// Sends messages via the Blooio REST API (v2).
// Supports per-account API keys with fallback to global env var.
// Docs: https://docs.blooio.com/
// ─────────────────────────────────────────────

const BLOOIO_BASE_URL = "https://backend.blooio.com/v2/api";

export interface BlooioSendResult {
  success: boolean;
  externalId?: string;
  error?: string;
}

/**
 * Resolve Blooio API key for a given account.
 * Priority: per-account settings > global env var.
 * Returns null if neither is configured.
 */
async function resolveApiKey(accountId?: number): Promise<string | null> {
  // Try per-account credentials first
  if (accountId) {
    try {
      const settings = await getAccountMessagingSettings(accountId);
      if (settings?.blooioApiKey) {
        console.log(`[Blooio] Using per-account API key for account ${accountId} (key starts with: ${settings.blooioApiKey.substring(0, 8)}...)`);
        return settings.blooioApiKey;
      }
    } catch (err) {
      console.warn(`[Blooio] Failed to load per-account settings for account ${accountId}:`, err);
    }
  }

  // Fall back to global env var
  if (process.env.BLOOIO_API_KEY) {
    console.log(`[Blooio] Using global API key (key starts with: ${process.env.BLOOIO_API_KEY.substring(0, 8)}...)`);
    return process.env.BLOOIO_API_KEY;
  }

  return null;
}

/**
 * Normalize a phone number to E.164 format for Blooio.
 * Ensures the number starts with +1 for US numbers.
 */
function normalizePhone(phone: string): string {
  // Strip all non-digit characters
  const digits = phone.replace(/\D/g, "");

  // If it already has country code (11 digits starting with 1), add +
  if (digits.length === 11 && digits.startsWith("1")) {
    return `+${digits}`;
  }
  // If it's 10 digits (US number without country code), add +1
  if (digits.length === 10) {
    return `+1${digits}`;
  }
  // If it already starts with +, return as-is
  if (phone.startsWith("+")) {
    return phone;
  }
  // Default: prepend + if it looks like it has a country code
  return `+${digits}`;
}

/**
 * Send an SMS/iMessage via Blooio.
 * @param to - Phone number (will be normalized to E.164)
 * @param body - Message body
 * @param accountId - Optional account ID for per-account credentials
 */
export async function sendSMSViaBlooio(
  to: string,
  body: string,
  accountId?: number
): Promise<BlooioSendResult> {
  const apiKey = await resolveApiKey(accountId);

  if (!apiKey) {
    console.warn(
      "[Blooio] Not configured — SMS will not be sent. Set BLOOIO_API_KEY environment variable."
    );
    return {
      success: false,
      error: "Blooio not configured",
    };
  }

  try {
    const normalizedTo = normalizePhone(to);
    // chatId is the URL-encoded phone number
    const chatId = encodeURIComponent(normalizedTo);

    const response = await fetch(`${BLOOIO_BASE_URL}/chats/${chatId}/messages`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        text: body,
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      let errorMessage: string;
      try {
        const parsed = JSON.parse(errorBody);
        errorMessage = parsed.message || parsed.error || errorBody;
      } catch {
        errorMessage = errorBody;
      }
      console.error(
        `[Blooio] SMS send failed: status=${response.status} to=${normalizedTo} error=${errorMessage}${accountId ? ` account=${accountId}` : ""}`
      );
      return {
        success: false,
        error: `Blooio API error (${response.status}): ${errorMessage}`,
      };
    }

    const data = await response.json();
    console.log(
      `[Blooio] SMS sent: messageId=${data.message_id || "unknown"} to=${normalizedTo} status=${data.status || "queued"}${accountId ? ` account=${accountId}` : ""}`
    );

    return {
      success: true,
      externalId: data.message_id,
    };
  } catch (err: any) {
    const errorMsg = err?.message || String(err);
    console.error(`[Blooio] SMS send failed to=${to}: ${errorMsg}`);
    return {
      success: false,
      error: errorMsg,
    };
  }
}

/**
 * Check if Blooio is configured (global env var present).
 * Note: per-account credentials are checked at send time.
 */
export function isBlooioConfigured(): boolean {
  return !!process.env.BLOOIO_API_KEY;
}
