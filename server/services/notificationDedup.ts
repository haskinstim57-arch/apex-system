/**
 * Notification Deduplication Service
 *
 * Every notification send records a row in notification_audit_log.
 * Rejects sends where (accountId, eventType, dedupeKey, channel) already
 * exists within the last DEDUP_WINDOW_SECONDS.
 *
 * Usage:
 *   const allowed = await checkAndRecordNotification({
 *     accountId: 1, eventType: "facebook_lead", channel: "push",
 *     dedupeKey: "fb-lead-123",
 *   });
 *   if (!allowed) return; // duplicate — skip send
 */

import { getDb } from "../db";
import { notificationAuditLog } from "../../drizzle/schema";
import { and, eq, gte } from "drizzle-orm";

/** Window in seconds — reject duplicate sends within this period */
const DEDUP_WINDOW_SECONDS = 60;

export interface DedupeCheckParams {
  accountId: number;
  userId?: number | null;
  eventType: string;
  channel: "push" | "email" | "sms" | "in_app";
  dedupeKey: string;
  metadata?: Record<string, any>;
}

/**
 * Check if this notification was already sent recently, and if not, record it.
 * Returns true if the notification is ALLOWED (not a duplicate).
 * Returns false if it's a DUPLICATE and should be skipped.
 */
export async function checkAndRecordNotification(params: DedupeCheckParams): Promise<boolean> {
  try {
    const db = await getDb();
    if (!db) {
      // If DB is unavailable, allow the send (fail-open)
      console.warn("[NotificationDedup] Database not available, allowing send (fail-open)");
      return true;
    }

    const windowStart = new Date(Date.now() - DEDUP_WINDOW_SECONDS * 1000);

    // Check for existing send within the dedup window
    const existing = await db
      .select({ id: notificationAuditLog.id })
      .from(notificationAuditLog)
      .where(
        and(
          eq(notificationAuditLog.accountId, params.accountId),
          eq(notificationAuditLog.eventType, params.eventType),
          eq(notificationAuditLog.channel, params.channel),
          eq(notificationAuditLog.dedupeKey, params.dedupeKey),
          gte(notificationAuditLog.sentAt, windowStart)
        )
      )
      .limit(1);

    if (existing.length > 0) {
      console.log(
        `[NotificationDedup] DUPLICATE blocked: ${params.channel}/${params.eventType}/${params.dedupeKey} for account ${params.accountId}`
      );
      return false;
    }

    // Record this send
    await db.insert(notificationAuditLog).values({
      accountId: params.accountId,
      userId: params.userId ?? null,
      eventType: params.eventType,
      channel: params.channel,
      dedupeKey: params.dedupeKey,
      metadata: params.metadata ? JSON.stringify(params.metadata) : null,
    });

    return true;
  } catch (err: any) {
    // Fail-open: if dedup check fails, allow the send
    console.error("[NotificationDedup] Error during dedup check, allowing send:", err.message);
    return true;
  }
}

/**
 * Record a notification send without dedup checking.
 * Use this for audit trail only (when you've already decided to send).
 */
export async function recordNotificationSend(params: DedupeCheckParams): Promise<void> {
  try {
    const db = await getDb();
    if (!db) return;

    await db.insert(notificationAuditLog).values({
      accountId: params.accountId,
      userId: params.userId ?? null,
      eventType: params.eventType,
      channel: params.channel,
      dedupeKey: params.dedupeKey,
      metadata: params.metadata ? JSON.stringify(params.metadata) : null,
    });
  } catch (err: any) {
    console.error("[NotificationDedup] Error recording send:", err.message);
  }
}

/**
 * Clean up old audit log entries (older than 30 days).
 * Call from a periodic cleanup worker.
 */
export async function cleanupOldAuditLogs(): Promise<number> {
  try {
    const db = await getDb();
    if (!db) return 0;

    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const result = await db
      .delete(notificationAuditLog)
      .where(
        and(
          gte(notificationAuditLog.sentAt, new Date(0)), // always true, just for type safety
          // sentAt < thirtyDaysAgo
          gte(thirtyDaysAgo, notificationAuditLog.sentAt as any)
        )
      );

    return (result as any)[0]?.affectedRows || 0;
  } catch (err: any) {
    console.error("[NotificationDedup] Error cleaning up audit logs:", err.message);
    return 0;
  }
}

// Export the window constant for testing
export { DEDUP_WINDOW_SECONDS };
