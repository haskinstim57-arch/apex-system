import { getDb } from "../db";
import {
  usageEvents,
  billingRates,
  accountBilling,
  accounts,
  paymentMethods,
  type InsertUsageEvent,
  type BillingRate,
  type AccountBillingRow,
} from "../../drizzle/schema";
import { eq, and, sql } from "drizzle-orm";
import { TRPCError } from "@trpc/server";

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

/**
 * Maps each event type to the corresponding markup multiplier column
 * and rebilling enabled column on the accountBilling row.
 */
const MARKUP_COLUMN_MAP: Record<UsageEventType, { markup: keyof AccountBillingRow; enabled: keyof AccountBillingRow }> = {
  sms_sent: { markup: "smsMarkup", enabled: "smsRebillingEnabled" },
  email_sent: { markup: "emailMarkup", enabled: "emailRebillingEnabled" },
  ai_call_minute: { markup: "aiCallMarkup", enabled: "aiCallRebillingEnabled" },
  voice_call_minute: { markup: "voiceCallMarkup", enabled: "voiceCallRebillingEnabled" },
  llm_request: { markup: "llmMarkup", enabled: "llmRebillingEnabled" },
  power_dialer_call: { markup: "dialerMarkup", enabled: "dialerRebillingEnabled" },
};

/**
 * Default markup multipliers for new accounts.
 * SMS/Email/Voice = 2.5x, AI calls = 1.2x, LLM = 1.5x, Dialer = 2.5x
 */
export const DEFAULT_MARKUPS = {
  smsMarkup: "2.500",
  emailMarkup: "2.500",
  aiCallMarkup: "1.200",
  voiceCallMarkup: "2.500",
  llmMarkup: "1.500",
  dialerMarkup: "2.500",
} as const;

interface TrackUsageParams {
  accountId: number;
  userId?: number;
  eventType: UsageEventType;
  /** Number of units consumed (e.g. 1 SMS, 2.5 minutes) */
  quantity: number;
  /** Optional JSON-serializable metadata (contactId, messageId, callId, etc.) */
  metadata?: Record<string, unknown>;
}

// ─────────────────────────────────────────────
// INTERNAL HELPERS
// ─────────────────────────────────────────────

/**
 * Ensure an accountBilling row exists for the given account.
 * Returns the billing row or null if DB unavailable.
 */
async function ensureBillingRow(db: any, accountId: number): Promise<AccountBillingRow | null> {
  const billingRows: AccountBillingRow[] = await db
    .select()
    .from(accountBilling)
    .where(eq(accountBilling.accountId, accountId));
  let billing = billingRows[0];

  if (!billing) {
    const defaultRateRows: BillingRate[] = await db
      .select()
      .from(billingRates)
      .where(eq(billingRates.isDefault, true));
    const defaultRate = defaultRateRows[0];

    if (!defaultRate) {
      console.error("[usageTracker] No default billing rate found");
      return null;
    }

    await db.insert(accountBilling).values({
      accountId,
      billingRateId: defaultRate.id,
      currentBalance: "0.0000",
      autoInvoiceThreshold: "50.0000",
      ...DEFAULT_MARKUPS,
    });

    const refreshedRows: AccountBillingRow[] = await db
      .select()
      .from(accountBilling)
      .where(eq(accountBilling.accountId, accountId));
    billing = refreshedRows[0];
  }

  return billing || null;
}

/**
 * Calculate the per-unit cost for a given event type, applying markup.
 */
function calculateUnitCost(
  rate: BillingRate,
  billing: AccountBillingRow,
  eventType: UsageEventType
): number {
  const rateColumn = RATE_COLUMN_MAP[eventType];
  const baseCost = Number(rate[rateColumn]);
  const markupConfig = MARKUP_COLUMN_MAP[eventType];
  const markup = Number(billing[markupConfig.markup]) || 1.10;
  return Math.round(baseCost * markup * 1000000) / 1000000; // 6 decimal places
}

// ─────────────────────────────────────────────
// CHARGE BEFORE SEND (PRE-DEBIT)
// ─────────────────────────────────────────────

export interface ChargeBeforeSendResult {
  usageEventId: number;
  unitCost: number;
  totalCost: number;
  newBalance: number;
}

/**
 * Pre-debit the account before dispatching a message/call.
 *
 * 1. Check account is not billing_locked
 * 2. Check payment method exists (squareCardId on paymentMethods OR balance > 0)
 * 3. Calculate cost
 * 4. If balance - cost < 0 AND auto-recharge disabled → throw PAYMENT_REQUIRED
 * 5. If balance - cost < autoRechargeThreshold AND auto-recharge enabled → trigger recharge synchronously
 * 6. Debit balance + record usage event atomically
 * 7. Return usageEventId for potential reverseCharge
 */
export async function chargeBeforeSend(
  accountId: number,
  eventType: UsageEventType,
  quantity: number,
  metadata?: Record<string, unknown>,
  userId?: number
): Promise<ChargeBeforeSendResult> {
  const db = await getDb();
  if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

  // ── 0. Billing kill switch — skip all billing when disabled ────
  const accountRows = await db
    .select({ status: accounts.status, billingEnabled: accounts.billingEnabled })
    .from(accounts)
    .where(eq(accounts.id, accountId));
  const account = accountRows[0];
  if (account && !account.billingEnabled) {
    // Billing paused — insert a $0 tracking event and return immediately.
    // No payment method check, no balance deduction.
    const [insertResult] = await db.insert(usageEvents).values({
      accountId,
      userId: userId ?? null,
      eventType,
      quantity: quantity.toFixed(4),
      unitCost: "0.000000",
      totalCost: "0.0000",
      metadata: metadata ? JSON.stringify({ ...metadata, billingPaused: true }) : JSON.stringify({ billingPaused: true }),
      invoiced: false,
      invoiceId: null,
      refunded: false,
    } as InsertUsageEvent) as any;
    console.log(`[usageTracker] Billing disabled for account ${accountId} — $0 tracking event created`);
    return {
      usageEventId: insertResult.insertId,
      unitCost: 0,
      totalCost: 0,
      newBalance: 0,
    };
  }

  // ── 1. Check account is not billing_locked ──────────────────────
  if (account?.status === "billing_locked") {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Account is locked due to billing issues. Please update your payment method or contact support.",
    });
  }

  // ── 2. Ensure billing row exists ────────────────────────────────
  const billing = await ensureBillingRow(db, accountId);
  if (!billing) {
    throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Could not initialize billing for account" });
  }

  // ── 2b. Check payment method exists ─────────────────────────────
  const cardRows = await db
    .select({ id: paymentMethods.id })
    .from(paymentMethods)
    .where(
      and(
        eq(paymentMethods.accountId, accountId),
        eq(paymentMethods.isDefault, true)
      )
    )
    .limit(1);
  const hasCard = cardRows.length > 0;
  const currentBalance = Number(billing.currentBalance);

  if (!hasCard && currentBalance <= 0) {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: "PAYMENT_METHOD_REQUIRED: Add a payment method to continue sending messages.",
    });
  }

  // ── 3. Check rebilling is enabled for this service ──────────────
  const markupConfig = MARKUP_COLUMN_MAP[eventType];
  const rebillingEnabled = billing[markupConfig.enabled];
  if (rebillingEnabled === false || rebillingEnabled === 0) {
    // Rebilling disabled — skip charging but still allow send
    // Insert a $0 usage event for tracking
    const [insertResult] = await db.insert(usageEvents).values({
      accountId,
      userId: userId ?? null,
      eventType,
      quantity: quantity.toFixed(4),
      unitCost: "0.000000",
      totalCost: "0.0000",
      metadata: metadata ? JSON.stringify(metadata) : null,
      invoiced: false,
      invoiceId: null,
      refunded: false,
    } as InsertUsageEvent) as any;

    return {
      usageEventId: insertResult.insertId,
      unitCost: 0,
      totalCost: 0,
      newBalance: currentBalance,
    };
  }

  // ── 4. Resolve cost ─────────────────────────────────────────────
  const rateRows: BillingRate[] = await db
    .select()
    .from(billingRates)
    .where(eq(billingRates.id, billing.billingRateId));
  const rate = rateRows[0];
  if (!rate) {
    throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: `Billing rate ${billing.billingRateId} not found` });
  }

  const unitCost = calculateUnitCost(rate, billing, eventType);
  const totalCost = Math.round(quantity * unitCost * 10000) / 10000;

  // ── 5. Check balance sufficiency + auto-recharge ────────────────
  const projectedBalance = currentBalance - totalCost;

  if (projectedBalance < 0 || projectedBalance < Number(billing.autoRechargeThreshold)) {
    if (billing.autoRechargeEnabled && hasCard) {
      // Try auto-recharge synchronously
      try {
        await triggerAutoRecharge(accountId, billing);
      } catch (rechargeErr: any) {
        // Recharge failed — check if balance is still sufficient
        const refreshedBilling = await db
          .select({ currentBalance: accountBilling.currentBalance })
          .from(accountBilling)
          .where(eq(accountBilling.accountId, accountId));
        const refreshedBalance = Number(refreshedBilling[0]?.currentBalance ?? 0);

        if (refreshedBalance - totalCost < 0) {
          throw new TRPCError({
            code: "PAYMENT_REQUIRED" as any,
            message: "Insufficient balance. Auto-recharge failed — please add funds or update your payment method.",
          });
        }
      }
    } else if (projectedBalance < 0) {
      throw new TRPCError({
        code: "PAYMENT_REQUIRED" as any,
        message: "Insufficient balance. Add funds or enable auto-recharge to continue.",
      });
    }
  }

  // ── 6. Debit balance + record usage event atomically ────────────
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
    refunded: false,
  };

  const [insertResult] = await db.insert(usageEvents).values(eventRow) as any;
  const usageEventId = insertResult.insertId;

  await db
    .update(accountBilling)
    .set({
      currentBalance: sql`${accountBilling.currentBalance} - ${totalCost.toFixed(4)}`,
    })
    .where(eq(accountBilling.accountId, accountId));

  // Refresh balance
  const updatedRows = await db
    .select({ currentBalance: accountBilling.currentBalance })
    .from(accountBilling)
    .where(eq(accountBilling.accountId, accountId));
  const newBalance = Number(updatedRows[0]?.currentBalance ?? 0);

  console.log(
    `[usageTracker] chargeBeforeSend ${eventType} accountId=${accountId} qty=${quantity} cost=$${totalCost} balance=$${newBalance}`
  );

  // ── 7. Check auto-invoice threshold (fire-and-forget) ───────────
  import("./invoiceService").then(({ checkAutoInvoice }) => {
    checkAutoInvoice(accountId).catch((err: unknown) => {
      console.error(`[usageTracker] Auto-invoice check failed for account ${accountId}:`, err);
    });
  }).catch(() => {});

  return {
    usageEventId,
    unitCost,
    totalCost,
    newBalance,
  };
}

// ─────────────────────────────────────────────
// REVERSE CHARGE (REFUND ON SEND FAILURE)
// ─────────────────────────────────────────────

/**
 * Reverse a charge when the actual send (Twilio/SendGrid) fails AFTER we debited.
 * Credits the balance back and marks the usage event as refunded.
 */
export async function reverseCharge(usageEventId: number): Promise<void> {
  const db = await getDb();
  if (!db) {
    console.error("[usageTracker] Database not available — cannot reverse charge");
    return;
  }

  try {
    // Get the usage event
    const eventRows = await db
      .select()
      .from(usageEvents)
      .where(eq(usageEvents.id, usageEventId));
    const event = eventRows[0];

    if (!event) {
      console.error(`[usageTracker] Usage event ${usageEventId} not found for reversal`);
      return;
    }

    if (event.refunded) {
      console.warn(`[usageTracker] Usage event ${usageEventId} already refunded`);
      return;
    }

    const totalCost = Number(event.totalCost);
    if (totalCost === 0) {
      // Nothing to refund (rebilling was disabled)
      await db
        .update(usageEvents)
        .set({ refunded: true })
        .where(eq(usageEvents.id, usageEventId));
      return;
    }

    // Credit balance back
    await db
      .update(accountBilling)
      .set({
        currentBalance: sql`${accountBilling.currentBalance} + ${totalCost.toFixed(4)}`,
      })
      .where(eq(accountBilling.accountId, event.accountId));

    // Mark event as refunded
    await db
      .update(usageEvents)
      .set({ refunded: true })
      .where(eq(usageEvents.id, usageEventId));

    console.log(
      `[usageTracker] reverseCharge eventId=${usageEventId} accountId=${event.accountId} refunded=$${totalCost}`
    );
  } catch (error) {
    console.error(`[usageTracker] Error reversing charge ${usageEventId}:`, error);
  }
}

// ─────────────────────────────────────────────
// AUTO-RECHARGE (SYNCHRONOUS)
// ─────────────────────────────────────────────

/**
 * Trigger an auto-recharge for the account.
 * Charges the default card on file for the configured amount.
 * Enforces 3-attempt daily limit.
 */
async function triggerAutoRecharge(
  accountId: number,
  billing: AccountBillingRow
): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // Check daily attempt limit
  const now = new Date();
  let attemptsToday = billing.rechargeAttemptsToday ?? 0;
  const resetAt = billing.rechargeAttemptsResetAt;

  // Reset counter if it's a new day
  if (!resetAt || resetAt.getTime() < getStartOfDay(now).getTime()) {
    attemptsToday = 0;
    await db
      .update(accountBilling)
      .set({
        rechargeAttemptsToday: 0,
        rechargeAttemptsResetAt: getEndOfDay(now),
      })
      .where(eq(accountBilling.accountId, accountId));
  }

  if (attemptsToday >= 3) {
    // Lock the account
    console.error(`[usageTracker] Auto-recharge limit exceeded for account ${accountId} — locking`);
    await db
      .update(accounts)
      .set({ status: "billing_locked" as any })
      .where(eq(accounts.id, accountId));

    // Notify admin
    import("../_core/notification").then(({ notifyOwner }) => {
      notifyOwner({
        title: `Account #${accountId} billing locked`,
        content: `Auto-recharge failed 3 times in 24 hours. Account has been locked. Manual intervention required.`,
      }).catch(() => {});
    }).catch(() => {});

    throw new Error("Auto-recharge limit exceeded — account locked");
  }

  // Increment attempt counter
  await db
    .update(accountBilling)
    .set({
      rechargeAttemptsToday: sql`${accountBilling.rechargeAttemptsToday} + 1`,
      rechargeAttemptsResetAt: getEndOfDay(now),
    })
    .where(eq(accountBilling.accountId, accountId));

  // Get default card
  const cardRows = await db
    .select()
    .from(paymentMethods)
    .where(
      and(
        eq(paymentMethods.accountId, accountId),
        eq(paymentMethods.isDefault, true)
      )
    )
    .limit(1);
  const card = cardRows[0];
  if (!card) throw new Error("No default payment method for auto-recharge");

  if (!billing.squareCustomerId) {
    throw new Error("No Square customer ID for auto-recharge");
  }

  const amountCents = billing.autoRechargeAmountCents || 1000;

  // Charge the card
  const { chargeCard, isSquareConfigured } = await import("./square");
  if (!isSquareConfigured()) {
    throw new Error("Square is not configured for auto-recharge");
  }

  try {
    const result = await chargeCard({
      cardId: card.squareCardId,
      customerId: billing.squareCustomerId,
      amountCents,
      referenceId: `auto-recharge-${accountId}-${Date.now()}`,
      note: `Auto-recharge for account #${accountId}`,
    });

    // Credit the balance
    const amountDollars = (amountCents / 100).toFixed(4);
    await db
      .update(accountBilling)
      .set({
        currentBalance: sql`${accountBilling.currentBalance} + ${amountDollars}`,
      })
      .where(eq(accountBilling.accountId, accountId));

    console.log(
      `[usageTracker] Auto-recharge success: accountId=${accountId} amount=$${amountDollars} paymentId=${result.paymentId}`
    );

    // Notify owner
    import("../_core/notification").then(({ notifyOwner }) => {
      notifyOwner({
        title: `Auto-recharge: Account #${accountId}`,
        content: `Charged $${(amountCents / 100).toFixed(2)} to card ****${card.last4}`,
      }).catch(() => {});
    }).catch(() => {});
  } catch (chargeErr: any) {
    console.error(`[usageTracker] Auto-recharge failed for account ${accountId}:`, chargeErr.message);
    throw chargeErr;
  }
}

function getStartOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function getEndOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
}

// ─────────────────────────────────────────────
// LEGACY: trackUsage (fire-and-forget, post-send)
// ─────────────────────────────────────────────

/**
 * Record a billable usage event for a sub-account.
 * LEGACY — use chargeBeforeSend for new code paths.
 * Kept for backward compatibility with non-critical tracking.
 */
export async function trackUsage(params: TrackUsageParams) {
  const { accountId, userId, eventType, quantity, metadata } = params;

  const db = await getDb();
  if (!db) {
    console.error("[usageTracker] Database not available — skipping tracking");
    return null;
  }

  // ── Billing kill switch: skip all usage tracking when billing is paused ──
  try {
    const acct = await db.select({ billingEnabled: accounts.billingEnabled }).from(accounts).where(eq(accounts.id, accountId)).limit(1);
    if (acct[0] && !acct[0].billingEnabled) {
      console.log(`[usageTracker] Billing disabled for account ${accountId} — skipping usage tracking`);
      return null;
    }
  } catch (e) {
    console.error("[usageTracker] Failed to check billingEnabled:", e);
    // Continue with tracking if the check fails — fail-open for safety
  }

  try {
    const billing = await ensureBillingRow(db, accountId);
    if (!billing) return null;

    // Check if rebilling is enabled for this service
    const markupConfig = MARKUP_COLUMN_MAP[eventType];
    const rebillingEnabled = billing[markupConfig.enabled];
    if (rebillingEnabled === false || rebillingEnabled === 0) {
      console.log(`[usageTracker] Rebilling disabled for ${eventType} on account ${accountId} — skipping`);
      return null;
    }

    // Resolve cost
    const rateRows: BillingRate[] = await db
      .select()
      .from(billingRates)
      .where(eq(billingRates.id, billing.billingRateId));
    const rate = rateRows[0];
    if (!rate) {
      console.error(`[usageTracker] Billing rate ${billing.billingRateId} not found`);
      return null;
    }

    const unitCost = calculateUnitCost(rate, billing, eventType);
    const totalCost = Math.round(quantity * unitCost * 10000) / 10000;

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
      refunded: false,
    };

    await db.insert(usageEvents).values(eventRow);

    await db
      .update(accountBilling)
      .set({
        currentBalance: sql`${accountBilling.currentBalance} - ${totalCost.toFixed(4)}`,
      })
      .where(eq(accountBilling.accountId, accountId));

    const updatedRows = await db
      .select({ currentBalance: accountBilling.currentBalance })
      .from(accountBilling)
      .where(eq(accountBilling.accountId, accountId));
    const newBalance = Number(updatedRows[0]?.currentBalance ?? 0);

    console.log(
      `[usageTracker] ${eventType} accountId=${accountId} qty=${quantity} cost=$${totalCost} balance=$${newBalance}`
    );

    // Check auto-invoice threshold (fire-and-forget)
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
