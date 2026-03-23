/**
 * Calendar Watch Renewal Service
 *
 * Background job that runs every 6 hours to check for expiring
 * Google Calendar watches and Outlook subscriptions, and renews them
 * before they expire.
 *
 * Google watches expire after 7 days max.
 * Outlook subscriptions expire after 4230 minutes (~2.94 days) max.
 *
 * We renew watches that expire within the next 12 hours to ensure
 * continuous real-time sync.
 */

import {
  getExpiringCalendarWatches,
  getCalendarIntegration,
  updateCalendarWatch,
  deleteCalendarWatch,
  decryptCalendarTokens,
  updateCalendarIntegration,
} from "../db";
import { refreshGoogleToken } from "../services/googleCalendar";
import { refreshOutlookToken } from "../services/outlookCalendar";
import crypto from "crypto";

const SIX_HOURS = 6 * 60 * 60 * 1000;
const TWELVE_HOURS = 12 * 60 * 60 * 1000;

let intervalHandle: ReturnType<typeof setInterval> | null = null;

/**
 * Start the calendar watch renewal background job.
 * Runs every 6 hours.
 */
export function startCalendarWatchRenewal() {
  console.log("[CalendarWatchRenewal] Starting background job (6h interval)");

  // Run once on startup (after a short delay to let server settle)
  setTimeout(() => {
    renewExpiringWatches().catch((err) =>
      console.error("[CalendarWatchRenewal] Initial run error:", err.message)
    );
  }, 30_000);

  // Then run every 6 hours
  intervalHandle = setInterval(() => {
    renewExpiringWatches().catch((err) =>
      console.error("[CalendarWatchRenewal] Scheduled run error:", err.message)
    );
  }, SIX_HOURS);
}

export function stopCalendarWatchRenewal() {
  if (intervalHandle) {
    clearInterval(intervalHandle);
    intervalHandle = null;
    console.log("[CalendarWatchRenewal] Stopped");
  }
}

/**
 * Find all watches expiring within the next 12 hours and renew them.
 */
export async function renewExpiringWatches() {
  const cutoff = new Date(Date.now() + TWELVE_HOURS);
  const expiringWatches = await getExpiringCalendarWatches(cutoff);

  if (expiringWatches.length === 0) {
    console.log("[CalendarWatchRenewal] No expiring watches found");
    return;
  }

  console.log(
    `[CalendarWatchRenewal] Found ${expiringWatches.length} expiring watches to renew`
  );

  for (const watch of expiringWatches) {
    try {
      // Get the integration to get access token
      const integration = await getCalendarIntegration(
        watch.integrationId,
        watch.userId
      );
      if (!integration || !integration.isActive) {
        console.warn(
          `[CalendarWatchRenewal] Integration ${watch.integrationId} not found or inactive, deleting watch`
        );
        await deleteCalendarWatch(watch.id);
        continue;
      }

      // Get valid access token
      const accessToken = await getValidAccessToken(integration);

      if (watch.provider === "google") {
        await renewGoogleWatch(watch, integration, accessToken);
      } else if (watch.provider === "outlook") {
        await renewOutlookSubscription(watch, integration, accessToken);
      }
    } catch (err: any) {
      console.error(
        `[CalendarWatchRenewal] Failed to renew watch ${watch.id} (${watch.provider}):`,
        err.message
      );
    }
  }
}

/**
 * Renew a Google Calendar watch by stopping the old one and creating a new one.
 */
async function renewGoogleWatch(
  watch: { id: number; watchId: string; resourceId: string | null; integrationId: number; userId: number; accountId: number },
  integration: { externalCalendarId: string },
  accessToken: string
) {
  // Stop the existing watch (best effort — may already be expired)
  try {
    await fetch("https://www.googleapis.com/calendar/v3/channels/stop", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        id: watch.watchId,
        resourceId: watch.resourceId,
      }),
    });
  } catch {
    // Ignore — watch may already be expired
  }

  // Create a new watch
  const newChannelId = crypto.randomUUID();
  const channelToken = crypto.randomUUID();
  const webhookUrl = `${process.env.VITE_APP_URL || ""}/api/webhooks/google-calendar`;

  const res = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(
      integration.externalCalendarId
    )}/events/watch`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        id: newChannelId,
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
    throw new Error(`Google watch renewal failed: ${err}`);
  }

  const data = await res.json();
  const expiresAt = new Date(parseInt(data.expiration));

  // Update the watch record
  await updateCalendarWatch(watch.id, {
    watchId: newChannelId,
    resourceId: data.resourceId,
    channelToken,
    expiresAt,
  });

  console.log(
    `[CalendarWatchRenewal] Renewed Google watch ${watch.id}, new expiry: ${expiresAt.toISOString()}`
  );
}

/**
 * Renew an Outlook subscription by updating its expiration.
 */
async function renewOutlookSubscription(
  watch: { id: number; watchId: string; userId: number; accountId: number },
  _integration: { externalCalendarId: string },
  accessToken: string
) {
  // Outlook subscriptions can be renewed by PATCHing the expiration
  // Max lifetime is 4230 minutes (~2.94 days)
  const newExpiry = new Date(Date.now() + 4230 * 60 * 1000);

  const res = await fetch(
    `https://graph.microsoft.com/v1.0/subscriptions/${watch.watchId}`,
    {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        expirationDateTime: newExpiry.toISOString(),
      }),
    }
  );

  if (!res.ok) {
    const errText = await res.text();

    // If subscription not found, it expired — we need to recreate it
    if (res.status === 404) {
      console.warn(
        `[CalendarWatchRenewal] Outlook subscription ${watch.watchId} not found, recreating...`
      );
      await recreateOutlookSubscription(watch, accessToken);
      return;
    }

    throw new Error(`Outlook subscription renewal failed: ${errText}`);
  }

  // Update the watch record with new expiry
  await updateCalendarWatch(watch.id, {
    expiresAt: newExpiry,
  });

  console.log(
    `[CalendarWatchRenewal] Renewed Outlook subscription ${watch.id}, new expiry: ${newExpiry.toISOString()}`
  );
}

/**
 * Recreate an Outlook subscription that has expired.
 */
async function recreateOutlookSubscription(
  watch: { id: number; watchId: string; userId: number; accountId: number },
  accessToken: string
) {
  const webhookUrl = `${process.env.VITE_APP_URL || ""}/api/webhooks/outlook-calendar`;
  const expiresAt = new Date(Date.now() + 4230 * 60 * 1000);

  const res = await fetch(
    "https://graph.microsoft.com/v1.0/subscriptions",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        changeType: "created,updated,deleted",
        notificationUrl: webhookUrl,
        resource: "/me/events",
        expirationDateTime: expiresAt.toISOString(),
        clientState: `apex-${watch.userId}-${watch.accountId}`,
      }),
    }
  );

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Failed to recreate Outlook subscription: ${err}`);
  }

  const data = await res.json();

  // Update the watch record with new subscription ID and expiry
  await updateCalendarWatch(watch.id, {
    watchId: data.id,
    expiresAt: new Date(data.expirationDateTime),
  });

  console.log(
    `[CalendarWatchRenewal] Recreated Outlook subscription ${watch.id}, new ID: ${data.id}`
  );
}

/**
 * Get a valid access token, refreshing if expired.
 */
async function getValidAccessToken(integration: {
  id: number;
  userId: number;
  provider: "google" | "outlook";
  accessToken: string;
  refreshToken: string | null;
  tokenExpiresAt: Date | null;
}): Promise<string> {
  const tokens = decryptCalendarTokens(integration);

  // Check if token is still valid (with 5-min buffer)
  if (integration.tokenExpiresAt) {
    const expiresAt = new Date(integration.tokenExpiresAt).getTime();
    if (expiresAt > Date.now() + 5 * 60 * 1000) {
      return tokens.accessToken;
    }
  }

  if (!tokens.refreshToken) {
    throw new Error("No refresh token available");
  }

  if (integration.provider === "google") {
    const result = await refreshGoogleToken(tokens.refreshToken);
    await updateCalendarIntegration(integration.id, integration.userId, {
      accessToken: result.accessToken,
      tokenExpiresAt: new Date(Date.now() + result.expiresIn * 1000),
    });
    return result.accessToken;
  } else {
    const result = await refreshOutlookToken(tokens.refreshToken);
    const updateData: any = {
      accessToken: result.accessToken,
      tokenExpiresAt: new Date(Date.now() + result.expiresIn * 1000),
    };
    if (result.refreshToken) {
      updateData.refreshToken = result.refreshToken;
    }
    await updateCalendarIntegration(
      integration.id,
      integration.userId,
      updateData
    );
    return result.accessToken;
  }
}
