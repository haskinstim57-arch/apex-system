/**
 * Balance Reconciliation Script
 *
 * Corrects accountBilling.currentBalance for all accounts affected by the
 * trackUsage sign-flip bug (which added costs instead of subtracting).
 *
 * The bug only affected the legacy trackUsage code path. chargeBeforeSend
 * events (voice_call_minute, ai_call_minute, sms_sent, and billedDispatch
 * email_sent) were decremented correctly and must NOT be double-corrected.
 *
 * trackUsage-path events are identified by:
 *   - eventType IN ('llm_request', 'power_dialer_call')
 *   - eventType = 'email_sent' AND metadata contains $.feature
 *     (billedDispatchEmail never sets $.feature; trackUsage does)
 *
 * Formula per account:
 *   correctBalance = currentBalance - (2 × trackUsageDebits)
 *
 * Rationale: if a trackUsage event should have subtracted $X, it instead
 * added $X — a delta of +2X. Subtracting 2X restores correctness.
 *
 * Dry-run (default):  pnpm tsx server/scripts/reconcileBalances.ts
 * Apply corrections:  pnpm tsx server/scripts/reconcileBalances.ts --apply
 *
 * Idempotency: If a balance_correction event already exists for an account,
 * the script skips that account on subsequent --apply runs.
 */
import "dotenv/config";
import { getDb } from "../db";
import {
  accountBilling,
  usageEvents,
  accounts,
} from "../../drizzle/schema";
import { eq, and, sql } from "drizzle-orm";

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

interface AccountReport {
  accountId: number;
  accountName: string;
  currentBalance: number;
  trackUsageDebits: number;
  correctBalance: number;
  delta: number;
  trackUsageEventCount: number;
  hasExistingCorrection: boolean;
}

// ─────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────

async function main() {
  const applyMode = process.argv.includes("--apply");

  console.log("╔══════════════════════════════════════════════════════════════╗");
  console.log("║  BALANCE RECONCILIATION — trackUsage sign-flip fix          ║");
  console.log(`║  Mode: ${applyMode ? "APPLY (will update balances)" : "DRY-RUN (report only)"}${"".padEnd(applyMode ? 20 : 24)}║`);
  console.log("╚══════════════════════════════════════════════════════════════╝");
  console.log();

  const db = await getDb();
  if (!db) {
    console.error("❌ Database not available. Check DATABASE_URL.");
    process.exit(1);
  }

  // ── 1. Get all accounts with billing rows ──────────────────────
  const billingRows = await db
    .select({
      accountId: accountBilling.accountId,
      currentBalance: accountBilling.currentBalance,
    })
    .from(accountBilling);

  if (billingRows.length === 0) {
    console.log("No accounts with billing records found. Nothing to do.");
    process.exit(0);
  }

  // Get account names
  const accountRows = await db
    .select({ id: accounts.id, name: accounts.name })
    .from(accounts);
  const accountNameMap = new Map(accountRows.map((a) => [a.id, a.name]));

  // ── 2. For each account, compute trackUsage-scoped debits ──────
  const report: AccountReport[] = [];
  let totalDelta = 0;
  let affectedCount = 0;

  for (const billing of billingRows) {
    const { accountId } = billing;
    const currentBalance = Number(billing.currentBalance);

    // 2a. trackUsage-path debits only:
    //   - eventType IN ('llm_request', 'power_dialer_call')
    //   - OR eventType = 'email_sent' AND metadata has $.feature
    //   - AND refunded = false
    const debitResult = await db.execute(sql`
      SELECT
        COALESCE(SUM(CAST(total_cost AS DECIMAL(10,4))), 0) AS trackUsageDebits,
        COUNT(*) AS eventCount
      FROM usage_events
      WHERE account_id = ${accountId}
        AND refunded = FALSE
        AND event_type != 'balance_correction'
        AND (
          event_type IN ('llm_request', 'power_dialer_call')
          OR (
            event_type = 'email_sent'
            AND JSON_EXTRACT(metadata, '$.feature') IS NOT NULL
          )
        )
    `);
    const row = (debitResult as any)[0]?.[0] ?? { trackUsageDebits: 0, eventCount: 0 };
    const trackUsageDebits = Number(row.trackUsageDebits ?? 0);
    const trackUsageEventCount = Number(row.eventCount ?? 0);

    // 2b. Check for existing balance_correction event (idempotency)
    const correctionCheck = await db
      .select({ id: usageEvents.id })
      .from(usageEvents)
      .where(
        and(
          eq(usageEvents.accountId, accountId),
          eq(usageEvents.eventType, "balance_correction")
        )
      )
      .limit(1);
    const hasExistingCorrection = correctionCheck.length > 0;

    // 2c. Compute corrected balance
    const delta = Math.round(2 * trackUsageDebits * 10000) / 10000;
    const correctBalance = Math.round((currentBalance - delta) * 10000) / 10000;

    report.push({
      accountId,
      accountName: accountNameMap.get(accountId) ?? `Account #${accountId}`,
      currentBalance,
      trackUsageDebits,
      correctBalance,
      delta,
      trackUsageEventCount,
      hasExistingCorrection,
    });

    if (Math.abs(delta) >= 0.0001) {
      affectedCount++;
      totalDelta += delta;
    }
  }

  // ── 3. Print report ────────────────────────────────────────────
  console.log("─".repeat(130));
  console.log(
    "Account ID".padEnd(12) +
    "Account Name".padEnd(30) +
    "Current Bal".padEnd(14) +
    "trackUsg Dbt".padEnd(14) +
    "Correct Bal".padEnd(14) +
    "Delta (drop)".padEnd(14) +
    "tU Events".padEnd(11) +
    "Corrected?"
  );
  console.log("─".repeat(130));

  for (const r of report) {
    const flag = r.delta >= 0.0001 ? " ⚠️" : "";
    const corrected = r.hasExistingCorrection ? "YES (skip)" : "no";
    console.log(
      String(r.accountId).padEnd(12) +
      r.accountName.substring(0, 28).padEnd(30) +
      `$${r.currentBalance.toFixed(4)}`.padEnd(14) +
      `$${r.trackUsageDebits.toFixed(4)}`.padEnd(14) +
      `$${r.correctBalance.toFixed(4)}`.padEnd(14) +
      `$${r.delta.toFixed(4)}`.padEnd(14) +
      String(r.trackUsageEventCount).padEnd(11) +
      corrected +
      flag
    );
  }

  console.log("─".repeat(130));
  console.log();
  console.log(`Total accounts scanned:    ${report.length}`);
  console.log(`Accounts with delta > 0:   ${affectedCount}`);
  console.log(`Total delta (balance drop): $${totalDelta.toFixed(4)}`);
  console.log();

  // ── 4. Apply corrections if --apply ────────────────────────────
  if (!applyMode) {
    console.log("🔍 DRY-RUN complete. Review the report above.");
    console.log("   To apply corrections, run:");
    console.log("   pnpm tsx server/scripts/reconcileBalances.ts --apply");
    process.exit(0);
  }

  // Apply mode
  let applied = 0;
  let skipped = 0;

  for (const r of report) {
    // Skip if no delta
    if (r.delta < 0.0001) {
      continue;
    }

    // Skip if already corrected (idempotency)
    if (r.hasExistingCorrection) {
      console.log(`⏭️  Skipping account ${r.accountId} (${r.accountName}) — already has balance_correction event`);
      skipped++;
      continue;
    }

    // Update the balance
    await db
      .update(accountBilling)
      .set({
        currentBalance: r.correctBalance.toFixed(4),
      })
      .where(eq(accountBilling.accountId, r.accountId));

    // Log a balance_correction usage event for audit trail + idempotency
    await db.insert(usageEvents).values({
      accountId: r.accountId,
      userId: null,
      eventType: "balance_correction",
      quantity: "1.0000",
      unitCost: r.delta.toFixed(6),
      totalCost: r.delta.toFixed(4),
      metadata: JSON.stringify({
        reason: "trackUsage sign flip fix",
        deltaApplied: r.delta,
        priorBalance: r.currentBalance,
        correctedBalance: r.correctBalance,
        trackUsageDebits: r.trackUsageDebits,
        trackUsageEventCount: r.trackUsageEventCount,
        correctedAt: new Date().toISOString(),
      }),
      invoiced: false,
      invoiceId: null,
      refunded: false,
    });

    console.log(
      `✅ Account ${r.accountId} (${r.accountName}): ` +
      `$${r.currentBalance.toFixed(4)} → $${r.correctBalance.toFixed(4)} ` +
      `(delta: -$${r.delta.toFixed(4)}, trackUsage events: ${r.trackUsageEventCount})`
    );
    applied++;
  }

  console.log();
  console.log("═".repeat(60));
  console.log(`Applied:    ${applied} account(s)`);
  console.log(`Skipped:    ${skipped} account(s) (already corrected)`);
  console.log(`No change:  ${report.length - applied - skipped} account(s)`);
  console.log("═".repeat(60));

  process.exit(0);
}

main().catch((err) => {
  console.error("❌ Fatal error:", err);
  process.exit(1);
});
