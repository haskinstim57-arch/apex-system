import { getDb } from "../db";
import {
  usageEvents,
  billingRates,
  accountBilling,
  type InsertUsageEvent,
  type BillingRate,
  type AccountBillingRow,
} from "../../drizzle/schema";
import { eq, sql } from "drizzle-orm";

/**
 * Supported billable event types — must match the usageEvents.eventType enum.
 */
export type UsageEventType =
  | "sms_sent"
  | "email_sent"
  | "ai_call_minute"
  | "voice_call_minute"
  | "llm_request"
  | "power_dialer_call";

/**
 * Cost-field mapping: maps each event type to the corresponding column
 * in the billingRates table.
 */
const RATE_COLUMN_MAP: Record<UsageEventType, keyof BillingRate> = {
  sms_sent: "smsCostPerUnit",
  email_sent: "emailCostPerUnit",
  ai_call_minute: "aiCallCostPerMinute",
  voice_call_minute: "voiceCallCostPerMinute",
  llm_request: "llmCostPerRequest",
  power_dialer_call: "powerDialerCostPerCall",
};

interface TrackUsageParams {
  accountId: number;
  userId?: number;
  eventType: UsageEventType;
  /** Number of units consumed (e.g. 1 SMS, 2.5 minutes) */
  quantity: number;
  /** Optional JSON-serializable metadata (contactId, messageId, callId, etc.) */
  metadata?: Record<string, unknown>;
}

/**
 * Record a billable usage event for a sub-account.
 *
 * 1. Look up (or auto-create) the account's billing config.
 * 2. Resolve the per-unit cost from the assigned billing rate.
 * 3. Insert a usage_events row.
 * 4. Increment the account's running balance.
 * 5. Return the event + new balance.
 *
 * This function is fire-and-forget safe — callers should `await` but
 * failures here must never block the primary action (SMS send, call, etc.).
 */
export async function trackUsage(params: TrackUsageParams) {
  const { accountId, userId, eventType, quantity, metadata } = params;

  const db = await getDb();
  if (!db) {
    console.error("[usageTracker] Database not available — skipping tracking");
    return null;
  }

  try {
    // ── 1. Ensure accountBilling row exists ──────────────────────────
    const billingRows: AccountBillingRow[] = await db
      .select()
      .from(accountBilling)
      .where(eq(accountBilling.accountId, accountId));
    let billing = billingRows[0];

    if (!billing) {
      // Auto-create with the default rate
      const defaultRateRows: BillingRate[] = await db
        .select()
        .from(billingRates)
        .where(eq(billingRates.isDefault, true));
      const defaultRate = defaultRateRows[0];

      if (!defaultRate) {
        console.error("[usageTracker] No default billing rate found — skipping tracking");
        return null;
      }

      await db.insert(accountBilling).values({
        accountId,
        billingRateId: defaultRate.id,
        currentBalance: "0.0000",
        autoInvoiceThreshold: "50.0000",
      });

      const refreshedRows: AccountBillingRow[] = await db
        .select()
        .from(accountBilling)
        .where(eq(accountBilling.accountId, accountId));
      billing = refreshedRows[0];

      if (!billing) {
        console.error("[usageTracker] Failed to create accountBilling row");
        return null;
      }
    }

    // ── 2. Resolve the per-unit cost ─────────────────────────────────
    const rateRows: BillingRate[] = await db
      .select()
      .from(billingRates)
      .where(eq(billingRates.id, billing.billingRateId));
    const rate = rateRows[0];

    if (!rate) {
      console.error(`[usageTracker] Billing rate ${billing.billingRateId} not found`);
      return null;
    }

    const rateColumn = RATE_COLUMN_MAP[eventType];
    const unitCost = Number(rate[rateColumn]);
    const totalCost = Math.round(quantity * unitCost * 10000) / 10000; // 4 decimal places

    // ── 3. Insert usage event ────────────────────────────────────────
    const eventRow: InsertUsageEvent = {
      accountId,
      userId: userId ?? null,
      eventType,
      quantity: quantity.toFixed(4),
      unitCost: unitCost.toFixed(6),
      totalCost: totalCost.toFixed(4),
      metadata: metadata ? JSON.stringify(metadata) : null,
      invoiced: false,
      invoiceId: null,
    };

    await db.insert(usageEvents).values(eventRow);

    // ── 4. Increment running balance ─────────────────────────────────
    await db
      .update(accountBilling)
      .set({
        currentBalance: sql`${accountBilling.currentBalance} + ${totalCost.toFixed(4)}`,
      })
      .where(eq(accountBilling.accountId, accountId));

    // Refresh balance
    const updatedRows = await db
      .select({ currentBalance: accountBilling.currentBalance })
      .from(accountBilling)
      .where(eq(accountBilling.accountId, accountId));
    const newBalance = Number(updatedRows[0]?.currentBalance ?? 0);

    console.log(
      `[usageTracker] ${eventType} accountId=${accountId} qty=${quantity} cost=$${totalCost} balance=$${newBalance}`
    );

    // ── 5. Check auto-invoice threshold (fire-and-forget) ───────────
    // Import dynamically to avoid circular dependency
    import("./invoiceService").then(({ checkAutoInvoice }) => {
      checkAutoInvoice(accountId).catch((err: unknown) => {
        console.error(`[usageTracker] Auto-invoice check failed for account ${accountId}:`, err);
      });
    }).catch(() => {});

    return {
      unitCost,
      totalCost,
      newBalance,
    };
  } catch (error) {
    console.error(`[usageTracker] Error tracking ${eventType} for account ${accountId}:`, error);
    return null;
  }
}

/**
 * Get the current billing summary for an account.
 */
export async function getAccountBillingSummary(accountId: number) {
  const db = await getDb();
  if (!db) return null;

  const billingRows: AccountBillingRow[] = await db
    .select()
    .from(accountBilling)
    .where(eq(accountBilling.accountId, accountId));
  const billing = billingRows[0];

  if (!billing) return null;

  const rateRows: BillingRate[] = await db
    .select()
    .from(billingRates)
    .where(eq(billingRates.id, billing.billingRateId));
  const rate = rateRows[0];

  return { billing, rate };
}
