/**
 * Notification Delivery Logger
 *
 * Logs every push/email/SMS notification delivery to the notification_log table
 * for audit trail, monitoring, and debugging purposes.
 *
 * Also provides updateDeliveryStatus() for webhook-driven status updates
 * from SendGrid and Twilio.
 */

import { getDb } from "../db";
import { notificationLog } from "../../drizzle/schema";
import { eq, and, desc, sql } from "drizzle-orm";

export type NotificationChannel = "push" | "email" | "sms";
export type NotificationStatus = "sent" | "failed" | "skipped";

export interface LogNotificationParams {
  channel: NotificationChannel;
  eventType: string;
  accountId: number;
  userId?: number | null;
  recipient?: string | null;
  status: NotificationStatus;
  errorMessage?: string | null;
  provider?: string | null;
  title?: string | null;
  /** External message ID from provider (SendGrid x-message-id, Twilio SID) */
  externalMessageId?: string | null;
}

/**
 * Log a notification delivery event to the database.
 * Non-blocking — errors are caught and logged to console.
 */
export async function logNotificationDelivery(params: LogNotificationParams): Promise<void> {
  try {
    const db = await getDb();
    if (!db) {
      console.warn("[NotificationLogger] Database not available, skipping log");
      return;
    }

    await db.insert(notificationLog).values({
      channel: params.channel,
      eventType: params.eventType,
      accountId: params.accountId,
      userId: params.userId ?? null,
      recipient: params.recipient ?? null,
      status: params.status,
      errorMessage: params.errorMessage ?? null,
      provider: params.provider ?? null,
      title: params.title ?? null,
      externalMessageId: params.externalMessageId ?? null,
    });
  } catch (err: any) {
    console.error("[NotificationLogger] Failed to log notification:", err.message);
  }
}

/**
 * Update the delivery status of a notification log entry by external message ID.
 * Called by SendGrid/Twilio delivery status webhooks.
 *
 * @returns Number of rows updated (0 if no matching log found)
 */
export async function updateDeliveryStatus(
  externalMessageId: string,
  deliveryStatus: string,
  errorMessage?: string | null
): Promise<number> {
  try {
    const db = await getDb();
    if (!db) {
      console.warn("[NotificationLogger] Database not available, skipping status update");
      return 0;
    }

    const result = await db
      .update(notificationLog)
      .set({
        deliveryStatus,
        deliveryStatusUpdatedAt: new Date(),
        ...(errorMessage ? { errorMessage } : {}),
      })
      .where(eq(notificationLog.externalMessageId, externalMessageId));

    const rowsAffected = (result as any)?.[0]?.affectedRows ?? 0;
    return rowsAffected;
  } catch (err: any) {
    console.error("[NotificationLogger] Failed to update delivery status:", err.message);
    return 0;
  }
}

/**
 * Find a notification log entry by external message ID.
 */
export async function findByExternalMessageId(externalMessageId: string) {
  const db = await getDb();
  if (!db) return null;

  const rows = await db
    .select()
    .from(notificationLog)
    .where(eq(notificationLog.externalMessageId, externalMessageId))
    .limit(1);

  return rows[0] ?? null;
}

/**
 * Get recent notification logs for an account (admin use).
 */
export async function getRecentNotificationLogs(
  accountId: number,
  options: {
    limit?: number;
    channel?: NotificationChannel;
    status?: NotificationStatus;
  } = {}
) {
  const db = await getDb();
  if (!db) return [];

  const { limit = 50, channel, status } = options;

  const conditions = [eq(notificationLog.accountId, accountId)];
  if (channel) conditions.push(eq(notificationLog.channel, channel));
  if (status) conditions.push(eq(notificationLog.status, status));

  const logs = await db
    .select()
    .from(notificationLog)
    .where(and(...conditions))
    .orderBy(desc(notificationLog.createdAt))
    .limit(limit);

  return logs;
}

/**
 * Get delivery stats for an account (counts by channel and status).
 */
export async function getNotificationDeliveryStats(accountId: number) {
  const db = await getDb();
  if (!db) return { push: { sent: 0, failed: 0 }, email: { sent: 0, failed: 0 }, sms: { sent: 0, failed: 0 } };

  const rows = await db
    .select({
      channel: notificationLog.channel,
      status: notificationLog.status,
      count: sql<number>`count(*)`.as("count"),
    })
    .from(notificationLog)
    .where(eq(notificationLog.accountId, accountId))
    .groupBy(notificationLog.channel, notificationLog.status);

  const stats: Record<string, Record<string, number>> = {
    push: { sent: 0, failed: 0, skipped: 0 },
    email: { sent: 0, failed: 0, skipped: 0 },
    sms: { sent: 0, failed: 0, skipped: 0 },
  };

  for (const row of rows) {
    if (stats[row.channel]) {
      stats[row.channel][row.status] = Number(row.count);
    }
  }

  return stats;
}
