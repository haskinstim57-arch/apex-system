/**
 * Google Calendar Push Notification Webhook
 *
 * Receives push notifications from Google Calendar when events change.
 * Google sends a POST with headers:
 *   X-Goog-Channel-ID: the watch channel ID
 *   X-Goog-Resource-ID: the resource being watched
 *   X-Goog-Resource-State: "sync" (initial) or "exists" (change)
 *   X-Goog-Channel-Token: the channel token we set
 *
 * On receiving a notification, we fetch changed events and update the cache.
 */

import { Router } from "express";
import {
  getCalendarWatchByWatchId,
  getCalendarIntegration,
  upsertExternalCalendarEvent,
  deleteExternalCalendarEvent,
  decryptCalendarTokens,
  updateCalendarIntegration,
} from "../db";
import { refreshGoogleToken, listGoogleEvents } from "../services/googleCalendar";

export const googleCalendarWebhookRouter = Router();

googleCalendarWebhookRouter.post(
  "/api/webhooks/google-calendar",
  async (req, res) => {
    try {
      const channelId = req.headers["x-goog-channel-id"] as string;
      const resourceState = req.headers["x-goog-resource-state"] as string;
      const channelToken = req.headers["x-goog-channel-token"] as string;

      console.log(`[GoogleCalendarWebhook] Received notification: state=${resourceState}, channelId=${channelId}`);

      // Respond immediately — Google expects a 200 within seconds
      res.status(200).send("OK");

      // "sync" is the initial verification — nothing to do
      if (resourceState === "sync") {
        console.log("[GoogleCalendarWebhook] Sync notification (initial handshake), ignoring.");
        return;
      }

      if (!channelId) {
        console.warn("[GoogleCalendarWebhook] Missing channel ID");
        return;
      }

      // Look up the watch
      const watch = await getCalendarWatchByWatchId(channelId);
      if (!watch) {
        console.warn(`[GoogleCalendarWebhook] No watch found for channelId=${channelId}`);
        return;
      }

      // Verify channel token if set
      if (watch.channelToken && channelToken !== watch.channelToken) {
        console.warn("[GoogleCalendarWebhook] Channel token mismatch");
        return;
      }

      // Get the calendar integration to fetch events
      const integration = await getCalendarIntegration(watch.integrationId, watch.userId);
      if (!integration) {
        console.warn(`[GoogleCalendarWebhook] Integration not found for watch ${watch.id}`);
        return;
      }

      // Get a valid access token
      let accessToken: string;
      try {
        accessToken = await getValidAccessTokenForWebhook(integration);
      } catch (err: any) {
        console.error("[GoogleCalendarWebhook] Failed to get access token:", err.message);
        return;
      }

      // Fetch recent events (last 24h to next 30 days to capture changes)
      const timeMin = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const timeMax = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

      const events = await listGoogleEvents(
        accessToken,
        integration.externalCalendarId,
        timeMin,
        timeMax
      );

      console.log(`[GoogleCalendarWebhook] Fetched ${events.length} events for user ${watch.userId}`);

      // Sync each event to the cache
      for (const event of events) {
        const startStr = event.start.dateTime || event.start.date || "";
        const endStr = event.end.dateTime || event.end.date || "";
        const allDay = !event.start.dateTime;

        if (event.status === "cancelled") {
          // Remove cancelled events from cache
          await deleteExternalCalendarEvent(
            watch.userId,
            watch.accountId,
            "google",
            event.id
          );
        } else {
          // Upsert event into cache
          await upsertExternalCalendarEvent({
            userId: watch.userId,
            accountId: watch.accountId,
            provider: "google",
            externalEventId: event.id,
            title: event.summary || "(No title)",
            startTime: new Date(startStr),
            endTime: new Date(endStr),
            allDay,
            status: event.status || "confirmed",
            syncedAt: new Date(),
          });
        }
      }

      console.log(`[GoogleCalendarWebhook] Sync complete for user ${watch.userId}`);
    } catch (err: any) {
      console.error("[GoogleCalendarWebhook] Error processing notification:", err.message);
      // Don't send error response — we already sent 200
    }
  }
);

/**
 * Get a valid access token for webhook processing (no tRPC context available).
 */
async function getValidAccessTokenForWebhook(integration: {
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

  // Token expired — refresh it
  if (!tokens.refreshToken) {
    throw new Error("No refresh token available");
  }

  const result = await refreshGoogleToken(tokens.refreshToken);

  // Update stored tokens
  await updateCalendarIntegration(integration.id, integration.userId, {
    accessToken: result.accessToken,
    tokenExpiresAt: new Date(Date.now() + result.expiresIn * 1000),
  });

  return result.accessToken;
}
