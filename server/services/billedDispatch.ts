/**
 * Billed Dispatch Service
 *
 * Wraps dispatchSMS and dispatchEmail with charge-before-send billing enforcement.
 * Every client-initiated send MUST go through these functions.
 *
 * System emails (support notifications, report delivery, auth emails) should
 * continue using raw dispatchEmail directly — they are NOT billed to clients.
 */
import { dispatchSMS, dispatchEmail, type MessageSendResult } from "./messaging";
import { chargeBeforeSend, reverseCharge } from "./usageTracker";

// ─────────────────────────────────────────────
// BILLED SMS
// ─────────────────────────────────────────────

interface BilledSMSParams {
  accountId: number;
  to: string;
  body: string;
  from?: string;
  contactId?: number;
  userId?: number;
  skipDndCheck?: boolean;
  metadata?: Record<string, unknown>;
  /** SMS provider to use: "twilio" or "blooio". Defaults to blooio. */
  provider?: "twilio" | "blooio";
}

export interface BilledSendResult extends MessageSendResult {
  usageEventId?: number;
  totalCost?: number;
}

/**
 * Charge the account, then send SMS. Reverse charge on send failure.
 * Throws PAYMENT_REQUIRED or PAYMENT_METHOD_REQUIRED if billing fails.
 */
export async function billedDispatchSMS(params: BilledSMSParams): Promise<BilledSendResult> {
  const { accountId, to, body, from, contactId, userId, skipDndCheck, metadata } = params;

  // 1. Charge before send
  const charge = await chargeBeforeSend(
    accountId,
    "sms_sent",
    1,
    { contactId, to, ...metadata },
    userId
  );

  // 2. Dispatch the SMS
  const result = await dispatchSMS({
    to,
    body,
    from,
    accountId,
    contactId,
    skipDndCheck,
    provider: params.provider,
  });

  // 3. Reverse charge on failure
  if (!result.success) {
    await reverseCharge(charge.usageEventId);
    console.warn(
      `[billedDispatch] SMS send failed, charge reversed: accountId=${accountId} to=${to} error=${result.error}`
    );
  }

  return {
    ...result,
    usageEventId: charge.usageEventId,
    totalCost: charge.totalCost,
  };
}

// ─────────────────────────────────────────────
// BILLED EMAIL
// ─────────────────────────────────────────────

interface BilledEmailParams {
  accountId: number;
  to: string;
  subject: string;
  body: string;
  from?: string;
  fromName?: string;
  userId?: number;
  contactId?: number;
  metadata?: Record<string, unknown>;
  attachments?: Array<{
    content: string;
    filename: string;
    type: string;
    disposition?: string;
  }>;
}

/**
 * Charge the account, then send email. Reverse charge on send failure.
 * Throws PAYMENT_REQUIRED or PAYMENT_METHOD_REQUIRED if billing fails.
 */
export async function billedDispatchEmail(params: BilledEmailParams): Promise<BilledSendResult> {
  const { accountId, to, subject, body, from, fromName, userId, contactId, metadata, attachments } = params;

  // 1. Charge before send
  const charge = await chargeBeforeSend(
    accountId,
    "email_sent",
    1,
    { contactId, to, subject, ...metadata },
    userId
  );

  // 2. Dispatch the email
  const result = await dispatchEmail({
    to,
    subject,
    body,
    from,
    fromName,
    accountId,
    attachments,
  });

  // 3. Reverse charge on failure
  if (!result.success) {
    await reverseCharge(charge.usageEventId);
    console.warn(
      `[billedDispatch] Email send failed, charge reversed: accountId=${accountId} to=${to} error=${result.error}`
    );
  }

  return {
    ...result,
    usageEventId: charge.usageEventId,
    totalCost: charge.totalCost,
  };
}

// ─────────────────────────────────────────────
// CAMPAIGN BATCH DISPATCH
// ─────────────────────────────────────────────

export interface CampaignRecipientResult {
  contactId: number;
  success: boolean;
  error?: string;
  status: "sent" | "failed" | "failed_insufficient_balance";
  usageEventId?: number;
}

/**
 * Send a campaign message to a single recipient with billing.
 * Returns a structured result instead of throwing, so the campaign loop
 * can continue processing remaining recipients.
 */
export async function billedCampaignSMS(params: {
  accountId: number;
  contactId: number;
  to: string;
  body: string;
  from?: string;
  userId?: number;
}): Promise<CampaignRecipientResult> {
  try {
    const result = await billedDispatchSMS({
      accountId: params.accountId,
      to: params.to,
      body: params.body,
      from: params.from,
      contactId: params.contactId,
      userId: params.userId,
    });

    return {
      contactId: params.contactId,
      success: result.success,
      error: result.error,
      status: result.success ? "sent" : "failed",
      usageEventId: result.usageEventId,
    };
  } catch (err: any) {
    // Billing error — mark as insufficient balance
    if (err.message?.includes("Insufficient balance") || err.message?.includes("PAYMENT_METHOD_REQUIRED") || err.message?.includes("billing")) {
      return {
        contactId: params.contactId,
        success: false,
        error: err.message,
        status: "failed_insufficient_balance",
      };
    }
    return {
      contactId: params.contactId,
      success: false,
      error: err.message || "Unknown error",
      status: "failed",
    };
  }
}

export async function billedCampaignEmail(params: {
  accountId: number;
  contactId: number;
  to: string;
  subject: string;
  body: string;
  from?: string;
  fromName?: string;
  userId?: number;
}): Promise<CampaignRecipientResult> {
  try {
    const result = await billedDispatchEmail({
      accountId: params.accountId,
      to: params.to,
      subject: params.subject,
      body: params.body,
      from: params.from,
      fromName: params.fromName,
      contactId: params.contactId,
      userId: params.userId,
    });

    return {
      contactId: params.contactId,
      success: result.success,
      error: result.error,
      status: result.success ? "sent" : "failed",
      usageEventId: result.usageEventId,
    };
  } catch (err: any) {
    if (err.message?.includes("Insufficient balance") || err.message?.includes("PAYMENT_METHOD_REQUIRED") || err.message?.includes("billing")) {
      return {
        contactId: params.contactId,
        success: false,
        error: err.message,
        status: "failed_insufficient_balance",
      };
    }
    return {
      contactId: params.contactId,
      success: false,
      error: err.message || "Unknown error",
      status: "failed",
    };
  }
}
