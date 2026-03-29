import { getDb } from "../db";
import {
  contacts,
  smsOptOuts,
  smsComplianceLogs,
} from "../../drizzle/schema";
import { eq, and } from "drizzle-orm";

// ─────────────────────────────────────────────
// SMS Compliance Service
// Handles STOP/HELP/opt-out keyword detection,
// auto-replies, DND status management, and
// compliance audit logging.
// ─────────────────────────────────────────────

/**
 * Keywords that trigger an opt-out (STOP).
 * TCPA/CTIA requires handling these exact keywords.
 */
export const OPT_OUT_KEYWORDS = [
  "stop",
  "stopall",
  "unsubscribe",
  "cancel",
  "end",
  "quit",
];

/**
 * Keywords that trigger an opt-in (re-subscribe).
 */
export const OPT_IN_KEYWORDS = ["start", "unstop", "subscribe", "yes"];

/**
 * Keywords that trigger a HELP response.
 */
export const HELP_KEYWORDS = ["help", "info"];

/**
 * Standard TCPA-compliant auto-reply messages.
 */
export const AUTO_REPLIES = {
  optOut:
    "You have been unsubscribed and will no longer receive SMS messages from us. Reply START to re-subscribe.",
  optIn:
    "You have been re-subscribed and will now receive SMS messages from us. Reply STOP to unsubscribe at any time.",
  help: "For help, contact us at support. Reply STOP to unsubscribe from SMS messages.",
};

export type ComplianceAction =
  | "opt_out"
  | "opt_in"
  | "help_request"
  | "none";

export interface ComplianceResult {
  action: ComplianceAction;
  autoReply: string | null;
  keyword: string | null;
  /** Whether the inbound message should still be processed normally */
  continueProcessing: boolean;
}

/**
 * Detect if an inbound SMS body contains a compliance keyword.
 * Per TCPA/CTIA guidelines, the keyword must be the ENTIRE message body
 * (trimmed, case-insensitive).
 */
export function detectComplianceKeyword(body: string): ComplianceResult {
  const normalized = body.trim().toLowerCase();

  if (OPT_OUT_KEYWORDS.includes(normalized)) {
    return {
      action: "opt_out",
      autoReply: AUTO_REPLIES.optOut,
      keyword: normalized.toUpperCase(),
      continueProcessing: false,
    };
  }

  if (OPT_IN_KEYWORDS.includes(normalized)) {
    return {
      action: "opt_in",
      autoReply: AUTO_REPLIES.optIn,
      keyword: normalized.toUpperCase(),
      continueProcessing: false,
    };
  }

  if (HELP_KEYWORDS.includes(normalized)) {
    return {
      action: "help_request",
      autoReply: AUTO_REPLIES.help,
      keyword: normalized.toUpperCase(),
      continueProcessing: true, // HELP messages still get logged as inbound
    };
  }

  return {
    action: "none",
    autoReply: null,
    keyword: null,
    continueProcessing: true,
  };
}

/**
 * Process an opt-out event:
 * 1. Set contact DND status to dnd_sms (or dnd_all if already dnd_email)
 * 2. Create/reactivate opt-out record
 * 3. Log compliance event
 */
export async function processOptOut(params: {
  accountId: number;
  contactId: number | null;
  phone: string;
  keyword: string;
  source?: "inbound_sms" | "manual" | "import" | "api";
}): Promise<void> {
  const db = await getDb();
  if (!db) return;

  const { accountId, contactId, phone, keyword, source = "inbound_sms" } = params;

  // 1. Update contact DND status
  if (contactId) {
    const [contact] = await db
      .select({ dndStatus: contacts.dndStatus })
      .from(contacts)
      .where(and(eq(contacts.id, contactId), eq(contacts.accountId, accountId)));

    if (contact) {
      const newDnd =
        contact.dndStatus === "dnd_email" ? "dnd_all" : "dnd_sms";
      await db
        .update(contacts)
        .set({ dndStatus: newDnd })
        .where(and(eq(contacts.id, contactId), eq(contacts.accountId, accountId)));
    }
  }

  // 2. Create opt-out record (or reactivate existing one)
  const existing = await db
    .select()
    .from(smsOptOuts)
    .where(and(eq(smsOptOuts.phone, phone), eq(smsOptOuts.accountId, accountId)));

  if (existing.length > 0 && !existing[0].isActive) {
    // Reactivate existing opt-out
    await db
      .update(smsOptOuts)
      .set({ isActive: true, keyword, optedInAt: null })
      .where(eq(smsOptOuts.id, existing[0].id));
  } else if (existing.length === 0) {
    // Create new opt-out record
    await db.insert(smsOptOuts).values({
      accountId,
      contactId,
      phone,
      keyword,
      source,
      isActive: true,
    });
  }

  // 3. Log compliance event
  await logComplianceEvent({
    accountId,
    contactId,
    phone,
    eventType: source === "manual" ? "manual_opt_out" : "opt_out",
    keyword,
    description: `Contact opted out via ${keyword} (${source})`,
  });

  // 4. Log DND set event
  if (contactId) {
    await logComplianceEvent({
      accountId,
      contactId,
      phone,
      eventType: "dnd_set",
      keyword,
      description: `DND status set to SMS block for contact ${contactId}`,
    });
  }
}

/**
 * Process an opt-in event:
 * 1. Clear contact DND status
 * 2. Deactivate opt-out record
 * 3. Log compliance event
 */
export async function processOptIn(params: {
  accountId: number;
  contactId: number | null;
  phone: string;
  keyword: string;
  source?: "inbound_sms" | "manual" | "api";
}): Promise<void> {
  const db = await getDb();
  if (!db) return;

  const { accountId, contactId, phone, keyword, source = "inbound_sms" } = params;

  // 1. Update contact DND status
  if (contactId) {
    const [contact] = await db
      .select({ dndStatus: contacts.dndStatus })
      .from(contacts)
      .where(and(eq(contacts.id, contactId), eq(contacts.accountId, accountId)));

    if (contact) {
      const newDnd =
        contact.dndStatus === "dnd_all" ? "dnd_email" : "active";
      await db
        .update(contacts)
        .set({ dndStatus: newDnd })
        .where(and(eq(contacts.id, contactId), eq(contacts.accountId, accountId)));
    }
  }

  // 2. Deactivate opt-out record
  const existing = await db
    .select()
    .from(smsOptOuts)
    .where(
      and(
        eq(smsOptOuts.phone, phone),
        eq(smsOptOuts.accountId, accountId),
        eq(smsOptOuts.isActive, true)
      )
    );

  if (existing.length > 0) {
    await db
      .update(smsOptOuts)
      .set({ isActive: false, optedInAt: new Date() })
      .where(eq(smsOptOuts.id, existing[0].id));
  }

  // 3. Log compliance event
  await logComplianceEvent({
    accountId,
    contactId,
    phone,
    eventType: source === "manual" ? "manual_opt_in" : "opt_in",
    keyword,
    description: `Contact opted in via ${keyword} (${source})`,
  });

  // 4. Log DND cleared event
  if (contactId) {
    await logComplianceEvent({
      accountId,
      contactId,
      phone,
      eventType: "dnd_cleared",
      keyword,
      description: `DND status cleared for contact ${contactId}`,
    });
  }
}

/**
 * Process a HELP request — just log it.
 */
export async function processHelpRequest(params: {
  accountId: number;
  contactId: number | null;
  phone: string;
}): Promise<void> {
  await logComplianceEvent({
    accountId: params.accountId,
    contactId: params.contactId,
    phone: params.phone,
    eventType: "help_request",
    keyword: "HELP",
    description: `HELP keyword received from ${params.phone}`,
  });
}

/**
 * Check if a phone number is opted out (DND) for a given account.
 * Returns true if the phone should NOT receive SMS.
 */
export async function isPhoneOptedOut(
  phone: string,
  accountId: number
): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;

  // Check opt-out table first (fastest)
  const optOut = await db
    .select({ id: smsOptOuts.id })
    .from(smsOptOuts)
    .where(
      and(
        eq(smsOptOuts.phone, phone),
        eq(smsOptOuts.accountId, accountId),
        eq(smsOptOuts.isActive, true)
      )
    );

  return optOut.length > 0;
}

/**
 * Check if a contact has DND set for SMS.
 * Returns true if the contact should NOT receive SMS.
 */
export async function isContactDndSms(
  contactId: number,
  accountId: number
): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;

  const [contact] = await db
    .select({ dndStatus: contacts.dndStatus })
    .from(contacts)
    .where(and(eq(contacts.id, contactId), eq(contacts.accountId, accountId)));

  if (!contact) return false;

  return contact.dndStatus === "dnd_sms" || contact.dndStatus === "dnd_all";
}

/**
 * Check if a contact has DND set for Email.
 * Returns true if the contact should NOT receive email.
 */
export async function isContactDndEmail(
  contactId: number,
  accountId: number
): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;

  const [contact] = await db
    .select({ dndStatus: contacts.dndStatus })
    .from(contacts)
    .where(and(eq(contacts.id, contactId), eq(contacts.accountId, accountId)));

  if (!contact) return false;

  return contact.dndStatus === "dnd_email" || contact.dndStatus === "dnd_all";
}

/**
 * Log a message_blocked compliance event when DND prevents sending.
 */
export async function logMessageBlocked(params: {
  accountId: number;
  contactId: number;
  phone: string;
  reason: string;
}): Promise<void> {
  await logComplianceEvent({
    accountId: params.accountId,
    contactId: params.contactId,
    phone: params.phone,
    eventType: "message_blocked",
    description: `SMS blocked: ${params.reason}`,
  });
}

/**
 * Log an auto-reply sent event.
 */
export async function logAutoReplySent(params: {
  accountId: number;
  contactId: number | null;
  phone: string;
  replyType: string;
}): Promise<void> {
  await logComplianceEvent({
    accountId: params.accountId,
    contactId: params.contactId,
    phone: params.phone,
    eventType: "auto_reply_sent",
    keyword: params.replyType,
    description: `Auto-reply sent: ${params.replyType} confirmation to ${params.phone}`,
  });
}

// ─── Internal helper ───

async function logComplianceEvent(params: {
  accountId: number;
  contactId: number | null;
  phone: string;
  eventType:
    | "opt_out"
    | "opt_in"
    | "help_request"
    | "dnd_set"
    | "dnd_cleared"
    | "message_blocked"
    | "auto_reply_sent"
    | "manual_opt_out"
    | "manual_opt_in";
  keyword?: string;
  description?: string;
  metadata?: string;
}): Promise<void> {
  try {
    const db = await getDb();
    if (!db) return;

    await db.insert(smsComplianceLogs).values({
      accountId: params.accountId,
      contactId: params.contactId,
      phone: params.phone,
      eventType: params.eventType,
      keyword: params.keyword || null,
      description: params.description || null,
      metadata: params.metadata || null,
    });
  } catch (err) {
    console.error("[SMS Compliance] Failed to log compliance event:", err);
  }
}
