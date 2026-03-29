/**
 * Push Notification Batching Service
 *
 * Groups rapid-fire events of the same type within a configurable time window
 * into a single push notification. For example, 10 Facebook leads arriving in
 * 30 seconds become one notification: "10 new Facebook leads received".
 *
 * Flow:
 * 1. Event handler calls `enqueuePushEvent(accountId, eventType, payload)`
 * 2. If no pending batch exists for (accountId, eventType), create one with flushAt = now + BATCH_WINDOW_MS
 * 3. If a pending batch exists, increment eventCount and append payload
 * 4. Background worker runs every FLUSH_INTERVAL_MS, finds batches where flushAt <= now, sends grouped push
 */

import { getDb } from "../db";
import { pushNotificationBatch, pushSubscriptions } from "../../drizzle/schema";
import { eq, and, lte, sql } from "drizzle-orm";
import { sendPushNotificationToAccountDirect } from "./webPush";

// ─── Configuration ───────────────────────────────────
/** Time window (ms) to accumulate events before flushing. Default: 30 seconds */
const BATCH_WINDOW_MS = 30_000;

/** How often the flush worker runs. Default: every 15 seconds */
const FLUSH_INTERVAL_MS = 15_000;

/** Maximum events to store payloads for (to prevent huge JSON blobs) */
const MAX_STORED_PAYLOADS = 20;

// ─── Event Types ─────────────────────────────────────
export type PushEventType =
  | "inbound_sms"
  | "inbound_email"
  | "appointment_booked"
  | "ai_call_completed"
  | "facebook_lead";

// ─── Notification Preferences ────────────────────────
export interface NotificationPreferences {
  inbound_sms: boolean;
  inbound_email: boolean;
  appointment_booked: boolean;
  ai_call_completed: boolean;
  facebook_lead: boolean;
  quiet_hours_enabled: boolean;
  quiet_hours_start: string; // "22:00"
  quiet_hours_end: string;   // "07:00"
  quiet_hours_timezone: string; // "America/New_York"
}

export const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferences = {
  inbound_sms: true,
  inbound_email: true,
  appointment_booked: true,
  ai_call_completed: true,
  facebook_lead: true,
  quiet_hours_enabled: false,
  quiet_hours_start: "22:00",
  quiet_hours_end: "07:00",
  quiet_hours_timezone: "America/New_York",
};

/**
 * Parse notification preferences from a JSON string, falling back to defaults
 */
export function parseNotificationPreferences(json: string | null): NotificationPreferences {
  if (!json) return { ...DEFAULT_NOTIFICATION_PREFERENCES };
  try {
    const parsed = JSON.parse(json);
    return { ...DEFAULT_NOTIFICATION_PREFERENCES, ...parsed };
  } catch {
    return { ...DEFAULT_NOTIFICATION_PREFERENCES };
  }
}

/**
 * Check if a specific event type is enabled for a given preferences config
 */
export function isEventTypeEnabled(
  prefs: NotificationPreferences,
  eventType: PushEventType
): boolean {
  return prefs[eventType] ?? true;
}

/**
 * Check if the current time falls within quiet hours for the given preferences
 */
export function isWithinQuietHours(prefs: NotificationPreferences, now?: Date): boolean {
  if (!prefs.quiet_hours_enabled) return false;

  const currentTime = now || new Date();
  const tz = prefs.quiet_hours_timezone || "America/New_York";

  // Get current time in the user's timezone
  let localTimeStr: string;
  try {
    localTimeStr = currentTime.toLocaleTimeString("en-US", {
      timeZone: tz,
      hour12: false,
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    // Invalid timezone, fall back to UTC
    localTimeStr = currentTime.toLocaleTimeString("en-US", {
      timeZone: "UTC",
      hour12: false,
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  const [currentHour, currentMinute] = localTimeStr.split(":").map(Number);
  const currentMinutes = currentHour * 60 + currentMinute;

  const [startH, startM] = prefs.quiet_hours_start.split(":").map(Number);
  const startMinutes = startH * 60 + startM;

  const [endH, endM] = prefs.quiet_hours_end.split(":").map(Number);
  const endMinutes = endH * 60 + endM;

  // Handle overnight quiet hours (e.g., 22:00 - 07:00)
  if (startMinutes > endMinutes) {
    // Overnight: quiet if current >= start OR current < end
    return currentMinutes >= startMinutes || currentMinutes < endMinutes;
  } else {
    // Same day: quiet if current >= start AND current < end
    return currentMinutes >= startMinutes && currentMinutes < endMinutes;
  }
}

// ─── Enqueue Event ───────────────────────────────────

interface EventPayload {
  title: string;
  body: string;
  url?: string;
  contactName?: string;
}

/**
 * Enqueue a push notification event for batching.
 * If a pending batch exists for this (accountId, eventType), it appends to it.
 * Otherwise creates a new batch with a flush window.
 */
export async function enqueuePushEvent(
  accountId: number,
  eventType: PushEventType,
  payload: EventPayload
): Promise<void> {
  const db = await getDb();
  if (!db) return;

  // Check if there's an existing pending batch for this account + event type
  const existing = await db
    .select()
    .from(pushNotificationBatch)
    .where(
      and(
        eq(pushNotificationBatch.accountId, accountId),
        eq(pushNotificationBatch.eventType, eventType),
        eq(pushNotificationBatch.status, "pending")
      )
    )
    .limit(1);

  if (existing.length > 0) {
    // Append to existing batch
    const batch = existing[0];
    let payloads: EventPayload[] = [];
    try {
      payloads = JSON.parse(batch.eventPayloads || "[]");
    } catch {
      payloads = [];
    }

    // Only store up to MAX_STORED_PAYLOADS to prevent huge blobs
    if (payloads.length < MAX_STORED_PAYLOADS) {
      payloads.push(payload);
    }

    await db
      .update(pushNotificationBatch)
      .set({
        eventCount: sql`${pushNotificationBatch.eventCount} + 1`,
        eventPayloads: JSON.stringify(payloads),
      })
      .where(eq(pushNotificationBatch.id, batch.id));
  } else {
    // Create new batch
    const now = new Date();
    const flushAt = new Date(now.getTime() + BATCH_WINDOW_MS);

    await db.insert(pushNotificationBatch).values({
      accountId,
      eventType,
      eventCount: 1,
      eventPayloads: JSON.stringify([payload]),
      status: "pending",
      windowStart: now,
      flushAt,
    });
  }
}

// ─── Flush Worker ────────────────────────────────────

/**
 * Build a grouped notification message from a batch
 */
function buildBatchNotification(
  eventType: PushEventType,
  eventCount: number,
  payloads: EventPayload[]
): { title: string; body: string; url: string; tag: string } {
  // Single event — use the original payload
  if (eventCount === 1 && payloads.length === 1) {
    return {
      title: payloads[0].title,
      body: payloads[0].body,
      url: payloads[0].url || "/",
      tag: `${eventType}-single`,
    };
  }

  // Multiple events — build grouped message
  const typeLabels: Record<PushEventType, { singular: string; plural: string; url: string }> = {
    inbound_sms: { singular: "new SMS", plural: "new SMS messages", url: "/inbox" },
    inbound_email: { singular: "new email", plural: "new emails", url: "/inbox" },
    appointment_booked: { singular: "new appointment", plural: "new appointments", url: "/calendar" },
    ai_call_completed: { singular: "AI call completed", plural: "AI calls completed", url: "/ai-calls" },
    facebook_lead: { singular: "new Facebook lead", plural: "new Facebook leads", url: "/contacts" },
  };

  const label = typeLabels[eventType] || { singular: "notification", plural: "notifications", url: "/" };
  const noun = eventCount === 1 ? label.singular : label.plural;

  // Build body with first few contact names
  const names = payloads
    .filter((p) => p.contactName)
    .map((p) => p.contactName)
    .slice(0, 3);

  let body: string;
  if (names.length > 0) {
    const remaining = eventCount - names.length;
    body = remaining > 0
      ? `From ${names.join(", ")} and ${remaining} more`
      : `From ${names.join(", ")}`;
  } else {
    body = payloads[0]?.body || `You have ${eventCount} ${noun}`;
  }

  return {
    title: `${eventCount} ${noun}`,
    body,
    url: label.url,
    tag: `${eventType}-batch`,
  };
}

/**
 * Process all pending batches that have reached their flush time.
 * Called by the background worker.
 */
export async function flushPendingBatches(): Promise<{ flushed: number; errors: number }> {
  const db = await getDb();
  if (!db) return { flushed: 0, errors: 0 };

  const now = new Date();

  // Find all pending batches where flushAt <= now
  const pendingBatches = await db
    .select()
    .from(pushNotificationBatch)
    .where(
      and(
        eq(pushNotificationBatch.status, "pending"),
        lte(pushNotificationBatch.flushAt, now)
      )
    )
    .limit(50); // Process up to 50 batches per cycle

  let flushed = 0;
  let errors = 0;

  for (const batch of pendingBatches) {
    try {
      let payloads: EventPayload[] = [];
      try {
        payloads = JSON.parse(batch.eventPayloads || "[]");
      } catch {
        payloads = [];
      }

      const notification = buildBatchNotification(
        batch.eventType as PushEventType,
        batch.eventCount,
        payloads
      );

      // Send the grouped notification to the account
      await sendPushNotificationToAccountDirect(batch.accountId, {
        title: notification.title,
        body: notification.body,
        url: notification.url,
        tag: notification.tag,
      });

      // Mark batch as sent
      await db
        .update(pushNotificationBatch)
        .set({ status: "sent", sentAt: now })
        .where(eq(pushNotificationBatch.id, batch.id));

      flushed++;
    } catch (err) {
      console.error(`[PushBatcher] Error flushing batch ${batch.id}:`, err);
      errors++;

      // Mark as expired to prevent infinite retries
      await db
        .update(pushNotificationBatch)
        .set({ status: "expired" })
        .where(eq(pushNotificationBatch.id, batch.id))
        .catch(() => {});
    }
  }

  if (flushed > 0 || errors > 0) {
    console.log(`[PushBatcher] Flushed ${flushed} batches, ${errors} errors`);
  }

  return { flushed, errors };
}

/**
 * Clean up old sent/expired batches (older than 7 days)
 */
export async function cleanupOldBatches(): Promise<number> {
  const db = await getDb();
  if (!db) return 0;

  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const result = await db
    .delete(pushNotificationBatch)
    .where(
      and(
        lte(pushNotificationBatch.createdAt, sevenDaysAgo),
        sql`${pushNotificationBatch.status} IN ('sent', 'expired')`
      )
    );

  return (result as any)[0]?.affectedRows || 0;
}

// ─── Background Worker ───────────────────────────────

let flushInterval: ReturnType<typeof setInterval> | null = null;
let cleanupInterval: ReturnType<typeof setInterval> | null = null;

/**
 * Start the batch flush worker
 */
export function startPushBatchWorker(): void {
  if (flushInterval) return; // Already running

  console.log(`[PushBatcher] Starting batch flush worker (every ${FLUSH_INTERVAL_MS / 1000}s)`);

  flushInterval = setInterval(async () => {
    try {
      await flushPendingBatches();
    } catch (err) {
      console.error("[PushBatcher] Flush worker error:", err);
    }
  }, FLUSH_INTERVAL_MS);

  // Cleanup old batches every 6 hours
  cleanupInterval = setInterval(async () => {
    try {
      const cleaned = await cleanupOldBatches();
      if (cleaned > 0) {
        console.log(`[PushBatcher] Cleaned up ${cleaned} old batches`);
      }
    } catch (err) {
      console.error("[PushBatcher] Cleanup error:", err);
    }
  }, 6 * 60 * 60 * 1000);
}

/**
 * Stop the batch flush worker
 */
export function stopPushBatchWorker(): void {
  if (flushInterval) {
    clearInterval(flushInterval);
    flushInterval = null;
  }
  if (cleanupInterval) {
    clearInterval(cleanupInterval);
    cleanupInterval = null;
  }
  console.log("[PushBatcher] Batch flush worker stopped");
}

// ─── Exported for testing ────────────────────────────
export { BATCH_WINDOW_MS, buildBatchNotification };
