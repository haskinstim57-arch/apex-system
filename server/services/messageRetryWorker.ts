import { getDb } from "../db";
import { messages } from "../../drizzle/schema";
import { and, eq, lte, lt, isNotNull } from "drizzle-orm";
import { dispatchSMS, dispatchEmail } from "./messaging";

// ─────────────────────────────────────────────
// Message Retry Worker
// Automatically retries failed messages with transient
// error codes using exponential backoff.
// ─────────────────────────────────────────────

// Error codes that are worth retrying (transient carrier errors)
const RETRYABLE_CODES = ["30003", "30008", "421", "450", "451"];
const MAX_RETRIES = 3;

// Retry delay: attempt 1 = 15min, attempt 2 = 1hr, attempt 3 = 4hr
function getRetryDelay(retryCount: number): number {
  const delays = [15 * 60 * 1000, 60 * 60 * 1000, 4 * 60 * 60 * 1000];
  return delays[retryCount] || delays[delays.length - 1];
}

/**
 * Extract a numeric error code from an error message string.
 * Handles formats like "[30003] ...", "30003: ...", or bare "30003".
 */
function extractErrorCode(errorStr: string): string | null {
  const bracketMatch = errorStr.match(/\[(\d+)\]/);
  if (bracketMatch) return bracketMatch[1];
  const colonMatch = errorStr.match(/^(\d+):/);
  if (colonMatch) return colonMatch[1];
  const bareMatch = errorStr.match(/\b(\d{3,5})\b/);
  if (bareMatch) return bareMatch[1];
  return null;
}

/**
 * Schedule a retry for a message by its database ID.
 * Only schedules if the error code is retryable and max retries not exceeded.
 */
export async function scheduleRetry(messageId: number, errorCode?: string) {
  if (!errorCode) return;

  const code = extractErrorCode(errorCode);
  if (!code || !RETRYABLE_CODES.includes(code)) return;

  const db = await getDb();
  if (!db) return;

  const [msg] = await db
    .select()
    .from(messages)
    .where(eq(messages.id, messageId))
    .limit(1);
  if (!msg || (msg.retryCount ?? 0) >= MAX_RETRIES) return;

  const nextRetry = new Date(Date.now() + getRetryDelay(msg.retryCount ?? 0));
  await db
    .update(messages)
    .set({ retryAt: nextRetry })
    .where(eq(messages.id, messageId));

  console.log(
    `[RetryWorker] Scheduled retry ${(msg.retryCount ?? 0) + 1}/${MAX_RETRIES} for message ${messageId} at ${nextRetry.toISOString()}`
  );
}

/**
 * Schedule a retry for a message by its externalId (from webhook).
 * Looks up the message first, then delegates to scheduleRetry.
 */
export async function scheduleRetryByExternalId(
  externalId: string,
  errorCode?: string
) {
  if (!errorCode) return;

  const db = await getDb();
  if (!db) return;

  const [msg] = await db
    .select({ id: messages.id })
    .from(messages)
    .where(eq(messages.externalId, externalId))
    .limit(1);

  if (msg) {
    await scheduleRetry(msg.id, errorCode);
  }
}

/**
 * Process all messages that are due for retry.
 * Called periodically by the worker interval.
 */
export async function processDueRetries() {
  const db = await getDb();
  if (!db) return { retried: 0, failed: 0 };

  const now = new Date();

  // Find messages due for retry
  const dueMessages = await db
    .select()
    .from(messages)
    .where(
      and(
        eq(messages.status, "failed"),
        isNotNull(messages.retryAt),
        lte(messages.retryAt, now),
        lt(messages.retryCount, MAX_RETRIES)
      )
    )
    .limit(50);

  if (dueMessages.length === 0) return { retried: 0, failed: 0 };

  let retried = 0;
  let failed = 0;

  for (const msg of dueMessages) {
    try {
      // Clear retryAt first to prevent double-processing
      await db
        .update(messages)
        .set({
          retryAt: null,
          retryCount: (msg.retryCount ?? 0) + 1,
          status: "pending",
        })
        .where(eq(messages.id, msg.id));

      // Re-send via the same channel
      if (msg.type === "sms") {
        await dispatchSMS({
          to: msg.toAddress,
          body: msg.body,
          accountId: msg.accountId,
          contactId: msg.contactId,
        });
      } else if (msg.type === "email") {
        await dispatchEmail({
          to: msg.toAddress,
          subject: msg.subject || "(No subject)",
          body: msg.body,
          accountId: msg.accountId,
        });
      }

      retried++;
      console.log(
        `[RetryWorker] Retried message ${msg.id} (attempt ${(msg.retryCount ?? 0) + 1})`
      );
    } catch (err: any) {
      failed++;
      // Mark failed again — if it's retryable and under max, scheduleRetry will re-queue it
      await db
        .update(messages)
        .set({ status: "failed", errorMessage: err.message })
        .where(eq(messages.id, msg.id));
    }
  }

  if (retried > 0 || failed > 0) {
    console.log(
      `[RetryWorker] Processed ${dueMessages.length} due retries: ${retried} retried, ${failed} failed`
    );
  }

  return { retried, failed };
}

/**
 * Start the message retry worker.
 * Checks for due retries every 15 minutes.
 */
export function startMessageRetryWorker() {
  setInterval(processDueRetries, 15 * 60 * 1000);
  console.log(
    "[RetryWorker] Message retry worker started — checks every 15 minutes"
  );
}

// Export constants for testing
export const _test = { RETRYABLE_CODES, MAX_RETRIES, getRetryDelay, extractErrorCode };
