import sgMail from "@sendgrid/mail";

// ─────────────────────────────────────────────
// SendGrid Email Service
// Sends emails via the SendGrid v3 API.
// Requires env vars: SENDGRID_API_KEY, SENDGRID_FROM_EMAIL
// Optional: SENDGRID_FROM_NAME
// ─────────────────────────────────────────────

let _initialized = false;

function ensureInitialized() {
  if (!_initialized) {
    const apiKey = process.env.SENDGRID_API_KEY;
    if (!apiKey) {
      throw new Error("[SendGrid] Missing SENDGRID_API_KEY environment variable");
    }
    sgMail.setApiKey(apiKey);
    _initialized = true;
  }
}

function getFromEmail(): string {
  const from = process.env.SENDGRID_FROM_EMAIL;
  if (!from) {
    throw new Error("[SendGrid] Missing SENDGRID_FROM_EMAIL environment variable");
  }
  return from;
}

function getFromName(): string {
  return process.env.SENDGRID_FROM_NAME || "Apex System";
}

export interface SendGridResult {
  success: boolean;
  externalId?: string;
  error?: string;
}

/**
 * Send an email via SendGrid.
 * @param to - Recipient email address
 * @param subject - Email subject line
 * @param body - Email body (HTML supported)
 * @param from - Optional override for sender email
 * @param fromName - Optional override for sender name
 */
export async function sendEmail(params: {
  to: string;
  subject: string;
  body: string;
  from?: string;
  fromName?: string;
}): Promise<SendGridResult> {
  // Guard: if SendGrid is not configured, log and return graceful failure
  if (!process.env.SENDGRID_API_KEY || !process.env.SENDGRID_FROM_EMAIL) {
    console.warn(
      "[SendGrid] Not configured — email will not be sent. Set SENDGRID_API_KEY and SENDGRID_FROM_EMAIL."
    );
    return {
      success: false,
      error: "SendGrid not configured",
    };
  }

  try {
    ensureInitialized();

    const msg = {
      to: params.to,
      from: {
        email: params.from || getFromEmail(),
        name: params.fromName || getFromName(),
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

    const [response] = await sgMail.send(msg);

    // SendGrid returns the message ID in the x-message-id header
    const messageId =
      response?.headers?.["x-message-id"] || `sg_${Date.now()}`;

    console.log(
      `[SendGrid] Email sent: messageId=${messageId} to=${params.to} subject="${params.subject}"`
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
 * Check if SendGrid is configured (all required env vars present).
 */
export function isSendGridConfigured(): boolean {
  return !!(process.env.SENDGRID_API_KEY && process.env.SENDGRID_FROM_EMAIL);
}
