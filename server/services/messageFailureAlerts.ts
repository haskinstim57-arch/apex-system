import { getDb } from "../db";
import { messages } from "../../drizzle/schema";
import { and, eq, gte, count } from "drizzle-orm";

// ─────────────────────────────────────────────
// Message Failure Alerts
// Monitors failure rates per account and triggers
// push notifications when threshold is exceeded.
// ─────────────────────────────────────────────

const FAILURE_THRESHOLD = 5; // failures before alerting
const WINDOW_MINUTES = 60; // within this many minutes
const ALERT_COOLDOWN_MS = 60 * 60 * 1000; // don't re-alert same account within 1 hour

// In-memory cooldown tracker (resets on server restart — acceptable)
const lastAlertTime = new Map<number, number>();

/**
 * Check if an account has exceeded the failure threshold and send an alert if so.
 * Called from webhook handlers after a message status is set to "failed" or "bounced".
 */
export async function checkAndAlertFailureThreshold(
  externalId: string,
  errorCode?: string
) {
  const db = await getDb();
  if (!db) return;

  // Find the message by externalId to get accountId
  const [msg] = await db
    .select({ accountId: messages.accountId })
    .from(messages)
    .where(eq(messages.externalId, externalId))
    .limit(1);
  if (!msg) return;

  const accountId = msg.accountId;

  // Check cooldown
  const last = lastAlertTime.get(accountId) || 0;
  if (Date.now() - last < ALERT_COOLDOWN_MS) return;

  // Count failures in the last WINDOW_MINUTES for this account
  const windowStart = new Date(Date.now() - WINDOW_MINUTES * 60 * 1000);
  const [{ failureCount }] = await db
    .select({ failureCount: count() })
    .from(messages)
    .where(
      and(
        eq(messages.accountId, accountId),
        eq(messages.status, "failed"),
        gte(messages.updatedAt, windowStart)
      )
    );

  if (failureCount >= FAILURE_THRESHOLD) {
    lastAlertTime.set(accountId, Date.now());

    // Send alert via push notification system
    try {
      const { enqueuePushEvent } = await import("./pushBatcher");
      await enqueuePushEvent(accountId, "message_delivery_failure", {
        title: `⚠️ Message Delivery Alert`,
        body: `${failureCount} messages failed to deliver in the last hour. Check your messaging settings or contact support.`,
        url: "/message-queue",
      });
    } catch {
      // fire and forget — push may not be configured
    }

    console.log(
      `[FailureAlert] Sent alert to account ${accountId} — ${failureCount} failures in ${WINDOW_MINUTES}min`
    );
  }
}
