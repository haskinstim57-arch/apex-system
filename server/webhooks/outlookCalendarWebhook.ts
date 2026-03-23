/**
 * Outlook Calendar Push Notification Webhook
 *
 * Receives change notifications from Microsoft Graph subscriptions.
 * Microsoft sends:
 *   1. A validation request (POST with ?validationToken=...) — must respond with the token as plain text
 *   2. Change notifications (POST with body containing value[].resourceData)
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
import { refreshOutlookToken, listOutlookEvents } from "../services/outlookCalendar";

export const outlookCalendarWebhookRouter = Router();

outlookCalendarWebhookRouter.post(
  "/api/webhooks/outlook-calendar",
  async (req, res) => {
    try {
      // ─── Microsoft Validation Handshake ───
      // When creating a subscription, Microsoft sends a POST with ?validationToken=...
      // We must respond with the token as plain text and 200 status
      const validationToken = req.query.validationToken as string | undefined;
      if (validationToken) {
        console.log("[OutlookCalendarWebhook] Validation handshake received");
        res.status(200).contentType("text/plain").send(validationToken);
        return;
      }

      // ─── Change Notification ───
      // Respond immediately — Microsoft expects a 202 within 3 seconds
      res.status(202).send("Accepted");

      const notifications = req.body?.value;
      if (!Array.isArray(notifications) || notifications.length === 0) {
        console.warn("[OutlookCalendarWebhook] No notifications in body");
        return;
      }

      for (const notification of notifications) {
        try {
          const subscriptionId = notification.subscriptionId;
          const changeType = notification.changeType; // created, updated, deleted

          console.log(
            `[OutlookCalendarWebhook] Received: changeType=${changeType}, subscriptionId=${subscriptionId}`
          );

          if (!subscriptionId) continue;

          // Look up the watch by subscription ID
          const watch = await getCalendarWatchByWatchId(subscriptionId);
          if (!watch) {
            console.warn(
              `[OutlookCalendarWebhook] No watch found for subscriptionId=${subscriptionId}`
            );
            continue;
          }

          // Get the calendar integration
          const integration = await getCalendarIntegration(
            watch.integrationId,
            watch.userId
          );
          if (!integration) {
            console.warn(
              `[OutlookCalendarWebhook] Integration not found for watch ${watch.id}`
            );
            continue;
          }

          // Get a valid access token
          let accessToken: string;
          try {
            accessToken = await getValidAccessTokenForWebhook(integration);
          } catch (err: any) {
            console.error(
              "[OutlookCalendarWebhook] Failed to get access token:",
              err.message
            );
            continue;
          }

          // Fetch recent events (last 24h to next 30 days)
          const timeMin = new Date(
            Date.now() - 24 * 60 * 60 * 1000
          ).toISOString();
          const timeMax = new Date(
            Date.now() + 30 * 24 * 60 * 60 * 1000
          ).toISOString();

          const events = await listOutlookEvents(accessToken, timeMin, timeMax);

          console.log(
            `[OutlookCalendarWebhook] Fetched ${events.length} events for user ${watch.userId}`
          );

          // Sync each event to the cache
          for (const event of events) {
            if (event.isCancelled) {
              await deleteExternalCalendarEvent(
                watch.userId,
                watch.accountId,
                "outlook",
                event.id
              );
            } else {
              await upsertExternalCalendarEvent({
                userId: watch.userId,
                accountId: watch.accountId,
                provider: "outlook",
                externalEventId: event.id,
                title: event.subject || "(No title)",
                startTime: new Date(event.start.dateTime),
                endTime: new Date(event.end.dateTime),
                allDay: false,
                status: event.showAs === "free" ? "tentative" : "confirmed",
                syncedAt: new Date(),
              });
            }
          }

          console.log(
            `[OutlookCalendarWebhook] Sync complete for user ${watch.userId}`
          );
        } catch (err: any) {
          console.error(
            "[OutlookCalendarWebhook] Error processing notification:",
            err.message
          );
        }
      }
    } catch (err: any) {
      console.error(
        "[OutlookCalendarWebhook] Error:",
        err.message
      );
      // Don't send error — we already sent 202
    }
  }
);

/**
 * Get a valid access token for webhook processing (no tRPC context).
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

  const result = await refreshOutlookToken(tokens.refreshToken);

  // Update stored tokens
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
