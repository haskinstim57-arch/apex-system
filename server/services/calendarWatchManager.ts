/**
 * Calendar Watch Manager
 *
 * Handles registering and unregistering push notification watches
 * for Google Calendar and Outlook Calendar integrations.
 *
 * Called from:
 * - OAuth callback (after connecting a calendar) → register watch
 * - Disconnect flow → unregister watch
 * - calendarSync router → manual re-register
 */

import crypto from "crypto";
import {
  createCalendarWatch,
  getCalendarWatchByIntegration,
  deleteCalendarWatchByIntegration,
  deleteExternalCalendarEventsByUser,
  decryptCalendarTokens,
} from "../db";

/**
 * Register a Google Calendar push notification watch.
 */
export async function registerGoogleWatch(params: {
  integrationId: number;
  userId: number;
  accountId: number;
  accessToken: string;
  calendarId: string;
  webhookBaseUrl: string;
}): Promise<{ success: boolean; error?: string }> {
  try {
    // Check if a watch already exists for this integration
    const existing = await getCalendarWatchByIntegration(params.integrationId);
    if (existing) {
      console.log(
        `[CalendarWatchManager] Watch already exists for integration ${params.integrationId}`
      );
      return { success: true };
    }

    const channelId = crypto.randomUUID();
    const channelToken = crypto.randomUUID();
    const webhookUrl = `${params.webhookBaseUrl}/api/webhooks/google-calendar`;

    const res = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(
        params.calendarId
      )}/events/watch`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${params.accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          id: channelId,
          type: "web_hook",
          address: webhookUrl,
          token: channelToken,
          params: {
            ttl: String(7 * 24 * 60 * 60), // 7 days in seconds
          },
        }),
      }
    );

    if (!res.ok) {
      const err = await res.text();
      console.error("[CalendarWatchManager] Google watch registration failed:", err);
      return { success: false, error: `Google watch failed: ${err}` };
    }

    const data = await res.json();
    const expiresAt = new Date(parseInt(data.expiration));

    await createCalendarWatch({
      userId: params.userId,
      accountId: params.accountId,
      integrationId: params.integrationId,
      provider: "google",
      watchId: channelId,
      resourceId: data.resourceId,
      channelToken,
      expiresAt,
    });

    console.log(
      `[CalendarWatchManager] Registered Google watch for integration ${params.integrationId}, expires: ${expiresAt.toISOString()}`
    );
    return { success: true };
  } catch (err: any) {
    console.error("[CalendarWatchManager] Google watch error:", err.message);
    return { success: false, error: err.message };
  }
}

/**
 * Register a Microsoft Outlook subscription for calendar change notifications.
 */
export async function registerOutlookSubscription(params: {
  integrationId: number;
  userId: number;
  accountId: number;
  accessToken: string;
  webhookBaseUrl: string;
}): Promise<{ success: boolean; error?: string }> {
  try {
    // Check if a subscription already exists
    const existing = await getCalendarWatchByIntegration(params.integrationId);
    if (existing) {
      console.log(
        `[CalendarWatchManager] Subscription already exists for integration ${params.integrationId}`
      );
      return { success: true };
    }

    const webhookUrl = `${params.webhookBaseUrl}/api/webhooks/outlook-calendar`;
    // Max 4230 minutes (~2.94 days)
    const expiresAt = new Date(Date.now() + 4230 * 60 * 1000);

    const res = await fetch(
      "https://graph.microsoft.com/v1.0/subscriptions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${params.accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          changeType: "created,updated,deleted",
          notificationUrl: webhookUrl,
          resource: "/me/events",
          expirationDateTime: expiresAt.toISOString(),
          clientState: `apex-${params.userId}-${params.accountId}`,
        }),
      }
    );

    if (!res.ok) {
      const err = await res.text();
      console.error("[CalendarWatchManager] Outlook subscription failed:", err);
      return { success: false, error: `Outlook subscription failed: ${err}` };
    }

    const data = await res.json();

    await createCalendarWatch({
      userId: params.userId,
      accountId: params.accountId,
      integrationId: params.integrationId,
      provider: "outlook",
      watchId: data.id,
      resourceId: null,
      channelToken: null,
      expiresAt: new Date(data.expirationDateTime),
    });

    console.log(
      `[CalendarWatchManager] Registered Outlook subscription for integration ${params.integrationId}`
    );
    return { success: true };
  } catch (err: any) {
    console.error("[CalendarWatchManager] Outlook subscription error:", err.message);
    return { success: false, error: err.message };
  }
}

/**
 * Unregister a watch/subscription when disconnecting a calendar.
 * Also clears the cached external events.
 */
export async function unregisterWatch(params: {
  integrationId: number;
  userId: number;
  accountId: number;
  provider: "google" | "outlook";
  accessToken?: string;
}): Promise<void> {
  try {
    const watch = await getCalendarWatchByIntegration(params.integrationId);

    if (watch && params.accessToken) {
      // Try to stop the watch/subscription (best effort)
      try {
        if (params.provider === "google") {
          await fetch("https://www.googleapis.com/calendar/v3/channels/stop", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${params.accessToken}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              id: watch.watchId,
              resourceId: watch.resourceId,
            }),
          });
        } else if (params.provider === "outlook") {
          await fetch(
            `https://graph.microsoft.com/v1.0/subscriptions/${watch.watchId}`,
            {
              method: "DELETE",
              headers: {
                Authorization: `Bearer ${params.accessToken}`,
              },
            }
          );
        }
      } catch {
        // Ignore — watch may already be expired
      }
    }

    // Delete the watch record
    await deleteCalendarWatchByIntegration(params.integrationId);

    // Clear cached external events
    await deleteExternalCalendarEventsByUser(
      params.userId,
      params.accountId,
      params.provider
    );

    console.log(
      `[CalendarWatchManager] Unregistered ${params.provider} watch for integration ${params.integrationId}`
    );
  } catch (err: any) {
    console.error("[CalendarWatchManager] Unregister error:", err.message);
  }
}
