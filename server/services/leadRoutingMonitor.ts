/**
 * Lead Routing Monitor Service
 * Tracks every Facebook lead routing attempt (success + failure) for real-time dashboards.
 * Fires alerts on failures via in-app notifications + push.
 */
import { eq, desc, sql, and, gte, lte, count } from "drizzle-orm";
import { leadRoutingEvents, type InsertLeadRoutingEvent } from "../../drizzle/schema";
import { createNotification } from "../db";
import { sendPushNotificationToAccount } from "./webPush";
import { notifyOwner } from "../_core/notification";

// Lazy DB import to avoid circular deps
async function getDb() {
  const { getDb: _getDb } = await import("../db");
  return _getDb();
}

// ─────────────────────────────────────────────
// Log a routing event
// ─────────────────────────────────────────────
export async function logRoutingEvent(
  event: Omit<InsertLeadRoutingEvent, "id" | "createdAt">
): Promise<number> {
  const db = await getDb();
  if (!db) {
    console.error("[LeadRoutingMonitor] DB not available, cannot log event");
    return 0;
  }

  try {
    const [result] = await db.insert(leadRoutingEvents).values(event).$returningId();
    const eventId = result.id;

    // Fire alert on failure (async, non-blocking)
    if (event.status === "failure") {
      fireFailureAlert(event).catch((err) =>
        console.error("[LeadRoutingMonitor] Alert error:", err)
      );
    }

    return eventId;
  } catch (err) {
    console.error("[LeadRoutingMonitor] Error logging event:", err);
    return 0;
  }
}

// ─────────────────────────────────────────────
// Get overview stats (for dashboard cards)
// ─────────────────────────────────────────────
export interface RoutingOverview {
  totalEvents: number;
  successCount: number;
  failureCount: number;
  partialCount: number;
  successRate: number;
  avgResponseTimeMs: number;
  unacknowledgedFailures: number;
  last24hEvents: number;
  last24hFailures: number;
}

export async function getRoutingOverview(
  hoursBack = 24 * 7 // default 7 days
): Promise<RoutingOverview> {
  const db = await getDb();
  if (!db) {
    return {
      totalEvents: 0,
      successCount: 0,
      failureCount: 0,
      partialCount: 0,
      successRate: 100,
      avgResponseTimeMs: 0,
      unacknowledgedFailures: 0,
      last24hEvents: 0,
      last24hFailures: 0,
    };
  }

  const cutoff = new Date(Date.now() - hoursBack * 60 * 60 * 1000);
  const cutoff24h = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const [stats] = await db
    .select({
      totalEvents: count(),
      successCount: sql<number>`SUM(CASE WHEN ${leadRoutingEvents.status} = 'success' THEN 1 ELSE 0 END)`,
      failureCount: sql<number>`SUM(CASE WHEN ${leadRoutingEvents.status} = 'failure' THEN 1 ELSE 0 END)`,
      partialCount: sql<number>`SUM(CASE WHEN ${leadRoutingEvents.status} = 'partial' THEN 1 ELSE 0 END)`,
      avgResponseTimeMs: sql<number>`AVG(${leadRoutingEvents.responseTimeMs})`,
    })
    .from(leadRoutingEvents)
    .where(gte(leadRoutingEvents.createdAt, cutoff));

  const [unack] = await db
    .select({ cnt: count() })
    .from(leadRoutingEvents)
    .where(
      and(
        eq(leadRoutingEvents.status, "failure"),
        eq(leadRoutingEvents.acknowledged, false)
      )
    );

  const [last24h] = await db
    .select({
      total: count(),
      failures: sql<number>`SUM(CASE WHEN ${leadRoutingEvents.status} = 'failure' THEN 1 ELSE 0 END)`,
    })
    .from(leadRoutingEvents)
    .where(gte(leadRoutingEvents.createdAt, cutoff24h));

  const total = Number(stats.totalEvents) || 0;
  const success = Number(stats.successCount) || 0;
  const failure = Number(stats.failureCount) || 0;
  const partial = Number(stats.partialCount) || 0;

  return {
    totalEvents: total,
    successCount: success,
    failureCount: failure,
    partialCount: partial,
    successRate: total > 0 ? Math.round((success / total) * 10000) / 100 : 100,
    avgResponseTimeMs: Math.round(Number(stats.avgResponseTimeMs) || 0),
    unacknowledgedFailures: Number(unack.cnt) || 0,
    last24hEvents: Number(last24h.total) || 0,
    last24hFailures: Number(last24h.failures) || 0,
  };
}

// ─────────────────────────────────────────────
// Get recent events (paginated)
// ─────────────────────────────────────────────
export async function getRecentEvents(opts: {
  limit?: number;
  offset?: number;
  status?: "success" | "failure" | "partial";
}) {
  const db = await getDb();
  if (!db) return [];

  const { limit = 50, offset = 0, status } = opts;

  const conditions = [];
  if (status) {
    conditions.push(eq(leadRoutingEvents.status, status));
  }

  return db
    .select()
    .from(leadRoutingEvents)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(leadRoutingEvents.createdAt))
    .limit(Math.min(limit, 100))
    .offset(offset);
}

// ─────────────────────────────────────────────
// Get time-series data for charts
// ─────────────────────────────────────────────
export interface TimeSeriesPoint {
  hour: string;
  success: number;
  failure: number;
  partial: number;
}

export async function getTimeSeries(hoursBack = 48): Promise<TimeSeriesPoint[]> {
  const db = await getDb();
  if (!db) return [];

  const cutoff = new Date(Date.now() - hoursBack * 60 * 60 * 1000);
  const cutoffStr = cutoff.toISOString().slice(0, 19).replace('T', ' ');

  // Use raw SQL to avoid only_full_group_by issues with Drizzle's column aliasing
  const rows = await db.execute(
    sql`SELECT
      DATE_FORMAT(created_at, '%Y-%m-%d %H:00') AS hour_bucket,
      SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) AS success_count,
      SUM(CASE WHEN status = 'failure' THEN 1 ELSE 0 END) AS failure_count,
      SUM(CASE WHEN status = 'partial' THEN 1 ELSE 0 END) AS partial_count
    FROM lead_routing_events
    WHERE created_at >= ${cutoffStr}
    GROUP BY hour_bucket
    ORDER BY hour_bucket`
  );

  const resultRows = (rows as any)[0] as any[] || [];
  return resultRows.map((r: any) => ({
    hour: String(r.hour_bucket),
    success: Number(r.success_count) || 0,
    failure: Number(r.failure_count) || 0,
    partial: Number(r.partial_count) || 0,
  }));
}

// ─────────────────────────────────────────────
// Get unacknowledged failures
// ─────────────────────────────────────────────
export async function getUnacknowledgedFailures(limit = 50) {
  const db = await getDb();
  if (!db) return [];

  return db
    .select()
    .from(leadRoutingEvents)
    .where(
      and(
        eq(leadRoutingEvents.status, "failure"),
        eq(leadRoutingEvents.acknowledged, false)
      )
    )
    .orderBy(desc(leadRoutingEvents.createdAt))
    .limit(limit);
}

// ─────────────────────────────────────────────
// Acknowledge a failure
// ─────────────────────────────────────────────
export async function acknowledgeFailure(eventId: number): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;

  await db
    .update(leadRoutingEvents)
    .set({ acknowledged: true })
    .where(eq(leadRoutingEvents.id, eventId));

  return true;
}

// ─────────────────────────────────────────────
// Acknowledge all failures
// ─────────────────────────────────────────────
export async function acknowledgeAllFailures(): Promise<number> {
  const db = await getDb();
  if (!db) return 0;

  const result = await db
    .update(leadRoutingEvents)
    .set({ acknowledged: true })
    .where(
      and(
        eq(leadRoutingEvents.status, "failure"),
        eq(leadRoutingEvents.acknowledged, false)
      )
    );

  return Number((result as any)[0]?.affectedRows) || 0;
}

// ─────────────────────────────────────────────
// Get routing method breakdown
// ─────────────────────────────────────────────
export async function getRoutingMethodBreakdown(hoursBack = 24 * 7) {
  const db = await getDb();
  if (!db) return [];

  const cutoff = new Date(Date.now() - hoursBack * 60 * 60 * 1000);

  return db
    .select({
      routingMethod: leadRoutingEvents.routingMethod,
      total: count(),
      successCount: sql<number>`SUM(CASE WHEN ${leadRoutingEvents.status} = 'success' THEN 1 ELSE 0 END)`,
      failureCount: sql<number>`SUM(CASE WHEN ${leadRoutingEvents.status} = 'failure' THEN 1 ELSE 0 END)`,
    })
    .from(leadRoutingEvents)
    .where(gte(leadRoutingEvents.createdAt, cutoff))
    .groupBy(leadRoutingEvents.routingMethod);
}

// ─────────────────────────────────────────────
// Fire failure alert (in-app + push + owner notification)
// ─────────────────────────────────────────────
async function fireFailureAlert(
  event: Omit<InsertLeadRoutingEvent, "id" | "createdAt">
) {
  const errorSnippet = event.errorMessage
    ? event.errorMessage.substring(0, 200)
    : "Unknown error";

  const title = "⚠ Facebook Lead Routing Failed";
  const body = `Lead ${event.leadId || "unknown"} from page ${event.pageId || "unknown"} failed to route. Error: ${errorSnippet}`;

  // 1. Notify platform owner
  try {
    await notifyOwner({ title, content: body });
  } catch (err) {
    console.error("[LeadRoutingMonitor] Owner notification failed:", err);
  }

  // 2. If we know the target account, send in-app + push notification there too
  if (event.accountId && event.accountId > 0) {
    try {
      await createNotification({
        accountId: event.accountId,
        userId: null, // account-wide
        type: "lead_routing_failure",
        title,
        body,
        link: "/settings/lead-monitor",
      });
    } catch (err) {
      console.error("[LeadRoutingMonitor] In-app notification failed:", err);
    }

    try {
      await sendPushNotificationToAccount(event.accountId, {
        title,
        body,
        url: "/settings/lead-monitor",
        tag: `lead-routing-failure-${event.leadId || Date.now()}`,
      });
    } catch (err) {
      console.error("[LeadRoutingMonitor] Push notification failed:", err);
    }
  }

  console.warn(
    `[LeadRoutingMonitor] ALERT: Lead routing failure — page=${event.pageId}, lead=${event.leadId}, error=${errorSnippet}`
  );
}
