/**
 * Facebook Token Health Monitor
 *
 * Runs a daily health check on all connected Facebook page tokens.
 * - Tests each token against the Graph API (/me endpoint)
 * - Attempts to refresh long-lived tokens when they're close to expiry
 * - Fires multi-channel alerts when a token is dead or expiring
 * - Logs all events to system_events table for Jarvis
 */

import { getDb } from "../db";
import { accountFacebookPages, systemEvents } from "../../drizzle/schema";
import { isNotNull, and, sql, eq } from "drizzle-orm";
import { createNotification } from "../db";
import { notifyOwner } from "../_core/notification";
import { sendPushNotificationToAccount } from "./webPush";

const FACEBOOK_GRAPH_API = "https://graph.facebook.com/v19.0";
const HEALTH_CHECK_INTERVAL_MS = 24 * 60 * 60 * 1000; // 24 hours
const TOKEN_EXPIRY_WARNING_DAYS = 7; // Warn when token expires within 7 days

let healthCheckTimer: ReturnType<typeof setInterval> | null = null;

interface TokenHealthResult {
  pageId: string;
  pageName: string | null;
  accountId: number;
  status: "healthy" | "expiring" | "dead" | "error";
  expiresAt?: Date;
  error?: string;
}

/**
 * Start the daily token health monitor.
 */
export function startFacebookTokenHealthMonitor() {
  console.log("[TokenHealthMonitor] Starting daily health check");

  healthCheckTimer = setInterval(async () => {
    try {
      await checkAllTokens();
    } catch (err) {
      console.error("[TokenHealthMonitor] Health check error:", err);
    }
  }, HEALTH_CHECK_INTERVAL_MS);

  // Run first check 2 minutes after startup (let everything initialize)
  setTimeout(() => {
    checkAllTokens().catch((err) =>
      console.error("[TokenHealthMonitor] Initial check error:", err)
    );
  }, 120_000);
}

/**
 * Stop the token health monitor.
 */
export function stopFacebookTokenHealthMonitor() {
  if (healthCheckTimer) {
    clearInterval(healthCheckTimer);
    healthCheckTimer = null;
    console.log("[TokenHealthMonitor] Stopped");
  }
}

/**
 * Check all connected Facebook page tokens.
 * Can be called on-demand from a tRPC procedure.
 */
export async function checkAllTokens(): Promise<TokenHealthResult[]> {
  const db = await getDb();
  if (!db) return [];

  const pages = await db
    .select()
    .from(accountFacebookPages)
    .where(
      and(
        isNotNull(accountFacebookPages.pageAccessToken),
        sql`${accountFacebookPages.pageAccessToken} != ''`
      )
    );

  if (pages.length === 0) {
    console.log("[TokenHealthMonitor] No connected pages to check");
    return [];
  }

  const results: TokenHealthResult[] = [];

  for (const page of pages) {
    try {
      const result = await checkPageToken(page);
      results.push(result);

      if (result.status === "dead" || result.status === "error") {
        await handleDeadToken(page, result);
      } else if (result.status === "expiring") {
        await handleExpiringToken(page, result);
      }
    } catch (err: any) {
      console.error(`[TokenHealthMonitor] Error checking page ${page.facebookPageId}:`, err);
      results.push({
        pageId: page.facebookPageId,
        pageName: page.pageName,
        accountId: page.accountId,
        status: "error",
        error: err.message,
      });
    }
  }

  // Log summary to system_events
  const healthy = results.filter((r) => r.status === "healthy").length;
  const expiring = results.filter((r) => r.status === "expiring").length;
  const dead = results.filter((r) => r.status === "dead" || r.status === "error").length;

  console.log(
    `[TokenHealthMonitor] Health check complete: ${healthy} healthy, ${expiring} expiring, ${dead} dead/error out of ${results.length} pages`
  );

  if (dead > 0 || expiring > 0) {
    try {
      // Log a summary event for each affected account
      const affectedAccounts = new Set(
        results.filter((r) => r.status !== "healthy").map((r) => r.accountId)
      );
      for (const accountId of Array.from(affectedAccounts)) {
        const accountResults = results.filter((r) => r.accountId === accountId && r.status !== "healthy");
        await db.insert(systemEvents).values({
          accountId,
          eventType: "facebook_token_health_check",
          severity: dead > 0 ? "critical" : "warning",
          title: `Facebook token health check: ${accountResults.length} issue(s)`,
          details: JSON.stringify(accountResults),
        });
      }
    } catch (e: any) {
      console.error("[TokenHealthMonitor] Failed to log system event:", e.message);
    }
  }

  return results;
}

/**
 * Check a single page token by calling the Graph API /me endpoint.
 */
async function checkPageToken(page: {
  id: number;
  accountId: number;
  facebookPageId: string;
  pageName: string | null;
  pageAccessToken: string | null;
}): Promise<TokenHealthResult> {
  if (!page.pageAccessToken) {
    return {
      pageId: page.facebookPageId,
      pageName: page.pageName,
      accountId: page.accountId,
      status: "dead",
      error: "No access token stored",
    };
  }

  try {
    // Test the token with /me endpoint
    const meRes = await fetch(
      `${FACEBOOK_GRAPH_API}/me?access_token=${page.pageAccessToken}&fields=id,name`
    );
    const meData = await meRes.json();

    if (meData.error) {
      return {
        pageId: page.facebookPageId,
        pageName: page.pageName,
        accountId: page.accountId,
        status: "dead",
        error: `${meData.error.message} (code: ${meData.error.code})`,
      };
    }

    // Check token debug info for expiry
    const debugRes = await fetch(
      `${FACEBOOK_GRAPH_API}/debug_token?input_token=${page.pageAccessToken}&access_token=${page.pageAccessToken}`
    );
    const debugData = await debugRes.json();

    if (debugData.data) {
      const { expires_at, is_valid } = debugData.data;

      if (!is_valid) {
        return {
          pageId: page.facebookPageId,
          pageName: page.pageName,
          accountId: page.accountId,
          status: "dead",
          error: "Token marked as invalid by Facebook",
        };
      }

      if (expires_at && expires_at > 0) {
        const expiresDate = new Date(expires_at * 1000);
        const daysUntilExpiry = (expiresDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24);

        if (daysUntilExpiry <= 0) {
          return {
            pageId: page.facebookPageId,
            pageName: page.pageName,
            accountId: page.accountId,
            status: "dead",
            expiresAt: expiresDate,
            error: "Token has expired",
          };
        }

        if (daysUntilExpiry <= TOKEN_EXPIRY_WARNING_DAYS) {
          return {
            pageId: page.facebookPageId,
            pageName: page.pageName,
            accountId: page.accountId,
            status: "expiring",
            expiresAt: expiresDate,
          };
        }
      }
      // expires_at === 0 means the token never expires (page tokens from long-lived user tokens)
    }

    return {
      pageId: page.facebookPageId,
      pageName: page.pageName,
      accountId: page.accountId,
      status: "healthy",
    };
  } catch (err: any) {
    return {
      pageId: page.facebookPageId,
      pageName: page.pageName,
      accountId: page.accountId,
      status: "error",
      error: `Network error: ${err.message}`,
    };
  }
}

/**
 * Handle a dead token — fire multi-channel alerts.
 */
async function handleDeadToken(
  page: { accountId: number; facebookPageId: string; pageName: string | null },
  result: TokenHealthResult
): Promise<void> {
  const title = `CRITICAL: Facebook token DEAD for ${page.pageName || page.facebookPageId}`;
  const body = `The Facebook access token for "${page.pageName}" is invalid or expired. ` +
    `Lead ingestion will fail until this is fixed. ` +
    `Go to Settings > Integrations > Facebook > Disconnect & Reconnect. ` +
    `Error: ${result.error}`;

  const promises: Promise<any>[] = [];

  // Notify platform owner
  promises.push(
    notifyOwner({ title, content: body }).catch((e) =>
      console.error("[TokenHealthMonitor] notifyOwner failed:", e.message)
    )
  );

  // In-app notification
  promises.push(
    createNotification({
      accountId: page.accountId,
      type: "system_alert",
      title,
      body,
      link: "/settings",
    }).catch((e) =>
      console.error("[TokenHealthMonitor] notification failed:", e.message)
    )
  );

  // Push notification
  promises.push(
    sendPushNotificationToAccount(page.accountId, {
      title: "Facebook Token DEAD",
      body: `Token expired for ${page.pageName}. Reconnect in Settings.`,
      url: "/settings",
      eventType: "system_alert",
    }).catch((e) =>
      console.error("[TokenHealthMonitor] push failed:", e.message)
    )
  );

  await Promise.allSettled(promises);
  console.log(`[TokenHealthMonitor] Dead token alerts sent for page ${page.facebookPageId}`);
}

/**
 * Handle an expiring token — send warning alerts and attempt refresh.
 */
async function handleExpiringToken(
  page: {
    id: number;
    accountId: number;
    facebookPageId: string;
    pageName: string | null;
    pageAccessToken: string | null;
  },
  result: TokenHealthResult
): Promise<void> {
  const daysLeft = result.expiresAt
    ? Math.ceil((result.expiresAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    : "unknown";

  // Attempt to refresh the token
  let refreshed = false;
  if (page.pageAccessToken) {
    try {
      const refreshRes = await fetch(
        `${FACEBOOK_GRAPH_API}/oauth/access_token?grant_type=fb_exchange_token&client_id=${process.env.FACEBOOK_APP_ID || ""}&client_secret=${process.env.FACEBOOK_APP_SECRET || ""}&fb_exchange_token=${page.pageAccessToken}`
      );
      const refreshData = await refreshRes.json();

      if (refreshData.access_token && !refreshData.error) {
        // Update the token in the database
        const db = await getDb();
        if (db) {
          await db
            .update(accountFacebookPages)
            .set({ pageAccessToken: refreshData.access_token })
            .where(eq(accountFacebookPages.id, page.id));
          refreshed = true;
          console.log(`[TokenHealthMonitor] Token refreshed for page ${page.facebookPageId}`);

          // Log refresh event
          await db.insert(systemEvents).values({
            accountId: page.accountId,
            eventType: "facebook_token_refreshed",
            severity: "info",
            title: `Facebook token auto-refreshed for ${page.pageName}`,
            details: JSON.stringify({
              pageId: page.facebookPageId,
              previousExpiry: result.expiresAt,
            }),
          });
        }
      }
    } catch (err: any) {
      console.warn(`[TokenHealthMonitor] Token refresh failed for page ${page.facebookPageId}:`, err.message);
    }
  }

  if (!refreshed) {
    // Send warning notification
    const title = `WARNING: Facebook token expiring in ${daysLeft} days for ${page.pageName || page.facebookPageId}`;
    const body = `The Facebook access token for "${page.pageName}" will expire in ${daysLeft} days. ` +
      `Auto-refresh was attempted but failed. ` +
      `Please go to Settings > Integrations > Facebook > Disconnect & Reconnect to get a fresh token.`;

    await createNotification({
      accountId: page.accountId,
      type: "system_alert",
      title,
      body,
      link: "/settings",
    }).catch((e) =>
      console.error("[TokenHealthMonitor] expiring notification failed:", e.message)
    );

    await notifyOwner({ title, content: body }).catch((e) =>
      console.error("[TokenHealthMonitor] expiring notifyOwner failed:", e.message)
    );
  }
}
