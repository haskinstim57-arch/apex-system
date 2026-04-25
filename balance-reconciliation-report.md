# Balance Reconciliation Report — trackUsage Sign-Flip Fix

**Date:** April 25, 2026
**Mode:** DRY-RUN (no changes applied)

## Background

The `trackUsage` function in `usageTracker.ts` had a sign-flip bug where usage events were **adding** to account balances instead of **subtracting**. The fix (checkpoint `59ab7548`) corrected the operator from `+` to `-`. This reconciliation script corrects the historical balance drift caused by the bug.

**Formula:** `correctBalance = currentBalance - (2 × trackUsageDebits)`

The `2×` factor accounts for the fact that each event added $X instead of subtracting $X, creating a $2X delta per event.

**Scope:** Only events that flowed through the `trackUsage` code path are affected: `llm_request`, `power_dialer_call`, and `email_sent` events with `$.feature` metadata. Events from `chargeBeforeSend` (voice calls, SMS, billedDispatch emails) were always correct and are excluded.

## Per-Account Report

| Account ID | Account Name | Current Balance | trackUsage Debits | Correct Balance | Delta (Drop) | Events | Status |
|---|---|---|---|---|---|---|---|
| 100 | Account #100 | $0.5505 | $1.6980 | -$2.8455 | -$3.3960 | 75 | Needs correction |
| 450002 | Apex System | $0.5618 | $0.5960 | -$0.6302 | -$1.1920 | 12 | Needs correction |
| 390023 | Evol Hosang | $0.0000 | $0.0000 | $0.0000 | $0.0000 | 0 | No change needed |
| **420001** | **Premier Mortgage Resources** | **-$0.1070** | **$3.4180** | **-$6.9430** | **-$6.8360** | **45** | **Needs correction** |
| 1020001 | Sara Sucks Cocks | $0.1540 | $0.1540 | -$0.1540 | -$0.3080 | 4 | Needs correction |
| 999999 | Account #999999 | $0.0000 | $0.0000 | $0.0000 | $0.0000 | 0 | No change needed |
| 390025 | Kyle | $0.0000 | $0.0000 | $0.0000 | $0.0000 | 0 | No change needed |
| 10 | Account #10 | $0.0000 | $0.0000 | $0.0000 | $0.0000 | 0 | No change needed |

## Summary

| Metric | Value |
|---|---|
| Total accounts scanned | 8 |
| Accounts needing correction | 4 |
| Total balance delta | -$11.7320 |

## PMR Analysis (Account 420001)

Premier Mortgage Resources currently shows **-$0.11** balance. The reconciliation reveals that $3.42 in trackUsage debits were incorrectly added instead of subtracted, creating a **$6.84 delta**. After correction, PMR's balance would be **-$6.94**.

This means PMR's -$0.11 is **not** the correctly reconciled value — it is still inflated by the sign-flip bug. The true balance after correcting for all 45 affected events would be -$6.94, meaning PMR has consumed $6.94 more than their prepaid credit.

**Interpretation:** PMR needs a top-up. The sign-flip fix is now live (since checkpoint `59ab7548`), so new usage events are correctly debiting. But the historical balance needs this one-time correction to reflect reality.

## Next Steps

1. Review this report and confirm the corrections look correct
2. Run `pnpm tsx server/scripts/reconcileBalances.ts --apply` to apply corrections
3. The script is idempotent — it creates a `balance_correction` usage event per account and skips on re-run
4. After applying, PMR (and other accounts) will need balance top-ups to resume usage
