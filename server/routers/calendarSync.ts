/**
 * Calendar Sync Router — Google & Outlook Calendar Integration
 *
 * Provides tRPC procedures for:
 * - Getting OAuth URLs for Google/Outlook
 * - Listing connected calendar integrations
 * - Disconnecting integrations
 * - Fetching external events (for calendar grid overlay)
 * - Querying busy times (for booking page slot filtering)
 * - Syncing new appointments to external calendars
 */

import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { protectedProcedure, publicProcedure } from "../_core/trpc";
import {
  getCalendarIntegrations,
  getCalendarIntegrationByProvider,
  getActiveCalendarIntegrations,
  deleteCalendarIntegration,
  decryptCalendarTokens,
  updateCalendarIntegration,
} from "../db";
import {
  getGoogleOAuthUrl,
  listGoogleEvents,
  getGoogleBusyTimes,
  createGoogleEvent,
  refreshGoogleToken,
} from "../services/googleCalendar";
import {
  getOutlookOAuthUrl,
  listOutlookEvents,
  getOutlookBusyTimes,
  createOutlookEvent,
  refreshOutlookToken,
} from "../services/outlookCalendar";

/**
 * Helper: get a valid access token for an integration, refreshing if expired.
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

  // Token expired or about to expire — refresh it
  if (!tokens.refreshToken) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: `${integration.provider} refresh token not available. Please reconnect.`,
    });
  }

  try {
    let newAccessToken: string;
    let expiresIn: number;
    let newRefreshToken: string | null = null;

    if (integration.provider === "google") {
      const result = await refreshGoogleToken(tokens.refreshToken);
      newAccessToken = result.accessToken;
      expiresIn = result.expiresIn;
    } else {
      const result = await refreshOutlookToken(tokens.refreshToken);
      newAccessToken = result.accessToken;
      expiresIn = result.expiresIn;
      newRefreshToken = result.refreshToken;
    }

    // Update stored tokens
    const updateData: Parameters<typeof updateCalendarIntegration>[2] = {
      accessToken: newAccessToken,
      tokenExpiresAt: new Date(Date.now() + expiresIn * 1000),
    };
    if (newRefreshToken) {
      updateData.refreshToken = newRefreshToken;
    }

    await updateCalendarIntegration(integration.id, integration.userId, updateData);

    return newAccessToken;
  } catch (err: any) {
    console.error(`[CalendarSync] Token refresh failed for ${integration.provider}:`, err.message);
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: `Failed to refresh ${integration.provider} token. Please reconnect.`,
    });
  }
}

export const calendarSyncRouter = {
  /** Get OAuth URL for Google Calendar */
  getGoogleOAuthUrl: protectedProcedure
    .input(z.object({ accountId: z.number().int().positive(), origin: z.string() }))
    .query(({ ctx, input }) => {
      return {
        url: getGoogleOAuthUrl({
          accountId: input.accountId,
          userId: ctx.user.id,
          origin: input.origin,
        }),
      };
    }),

  /** Get OAuth URL for Outlook Calendar */
  getOutlookOAuthUrl: protectedProcedure
    .input(z.object({ accountId: z.number().int().positive(), origin: z.string() }))
    .query(({ ctx, input }) => {
      return {
        url: getOutlookOAuthUrl({
          accountId: input.accountId,
          userId: ctx.user.id,
          origin: input.origin,
        }),
      };
    }),

  /** List all calendar integrations for the current user */
  listIntegrations: protectedProcedure
    .input(z.object({ accountId: z.number().int().positive() }))
    .query(async ({ ctx, input }) => {
    const integrations = await getCalendarIntegrations(ctx.user.id, input.accountId);
    // Return without tokens for security
    return integrations.map((i) => ({
      id: i.id,
      provider: i.provider,
      externalEmail: i.externalEmail,
      externalCalendarId: i.externalCalendarId,
      isActive: i.isActive,
      tokenExpiresAt: i.tokenExpiresAt,
      createdAt: i.createdAt,
    }));
  }),

  /** Disconnect a calendar integration */
  disconnect: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      await deleteCalendarIntegration(input.id, ctx.user.id);
      return { success: true };
    }),

  /** Fetch external calendar events for the calendar grid overlay */
  listExternalEvents: protectedProcedure
    .input(
      z.object({
        accountId: z.number().int().positive(),
        timeMin: z.string(), // ISO 8601
        timeMax: z.string(), // ISO 8601
      })
    )
    .query(async ({ ctx, input }) => {
      const integrations = await getCalendarIntegrations(ctx.user.id, input.accountId);
      const allEvents: {
        provider: string;
        id: string;
        title: string;
        start: string;
        end: string;
        allDay: boolean;
      }[] = [];

      for (const integration of integrations) {
        if (!integration.isActive) continue;
        try {
          const accessToken = await getValidAccessToken(integration);

          if (integration.provider === "google") {
            const events = await listGoogleEvents(
              accessToken,
              integration.externalCalendarId,
              input.timeMin,
              input.timeMax
            );
            for (const e of events) {
              if (e.status === "cancelled") continue;
              allEvents.push({
                provider: "google",
                id: e.id,
                title: e.summary || "(No title)",
                start: e.start.dateTime || e.start.date || "",
                end: e.end.dateTime || e.end.date || "",
                allDay: !e.start.dateTime,
              });
            }
          } else if (integration.provider === "outlook") {
            const events = await listOutlookEvents(
              accessToken,
              input.timeMin,
              input.timeMax
            );
            for (const e of events) {
              if (e.isCancelled) continue;
              allEvents.push({
                provider: "outlook",
                id: e.id,
                title: e.subject || "(No title)",
                start: e.start.dateTime,
                end: e.end.dateTime,
                allDay: false,
              });
            }
          }
        } catch (err: any) {
          console.error(`[CalendarSync] Failed to fetch events from ${integration.provider}:`, err.message);
          // Don't fail the whole request if one integration fails
        }
      }

      return allEvents;
    }),

  /**
   * Get busy times from all connected external calendars for an account.
   * Used by the booking page to filter out unavailable slots.
   * This is a public procedure — it takes accountId directly.
   */
  getBusyTimes: publicProcedure
    .input(
      z.object({
        accountId: z.number(),
        timeMin: z.string(),
        timeMax: z.string(),
      })
    )
    .query(async ({ input }) => {
      const integrations = await getActiveCalendarIntegrations(input.accountId);
      const busyBlocks: { start: string; end: string }[] = [];

      for (const integration of integrations) {
        try {
          const accessToken = await getValidAccessToken(integration);

          if (integration.provider === "google") {
            const busy = await getGoogleBusyTimes(
              accessToken,
              integration.externalCalendarId,
              input.timeMin,
              input.timeMax
            );
            busyBlocks.push(...busy);
          } else if (integration.provider === "outlook") {
            const busy = await getOutlookBusyTimes(
              accessToken,
              integration.externalEmail || "",
              input.timeMin,
              input.timeMax
            );
            busyBlocks.push(...busy);
          }
        } catch (err: any) {
          console.error(`[CalendarSync] Failed to fetch busy times from ${integration.provider}:`, err.message);
        }
      }

      return busyBlocks;
    }),

  /** Sync a new appointment to all connected external calendars */
  syncAppointmentToExternal: protectedProcedure
    .input(
      z.object({
        accountId: z.number().int().positive(),
        summary: z.string(),
        description: z.string().optional(),
        startDateTime: z.string(), // ISO 8601
        endDateTime: z.string(),   // ISO 8601
        timeZone: z.string().default("UTC"),
        guestEmail: z.string().optional(),
        guestName: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const integrations = await getCalendarIntegrations(ctx.user.id, input.accountId);
      const results: { provider: string; success: boolean; error?: string }[] = [];

      for (const integration of integrations) {
        if (!integration.isActive) continue;
        try {
          const accessToken = await getValidAccessToken(integration);

          if (integration.provider === "google") {
            await createGoogleEvent(accessToken, integration.externalCalendarId, {
              summary: input.summary,
              description: input.description,
              start: { dateTime: input.startDateTime, timeZone: input.timeZone },
              end: { dateTime: input.endDateTime, timeZone: input.timeZone },
              attendees: input.guestEmail ? [{ email: input.guestEmail }] : undefined,
            });
            results.push({ provider: "google", success: true });
          } else if (integration.provider === "outlook") {
            await createOutlookEvent(accessToken, {
              subject: input.summary,
              body: input.description
                ? { contentType: "Text", content: input.description }
                : undefined,
              start: { dateTime: input.startDateTime, timeZone: input.timeZone },
              end: { dateTime: input.endDateTime, timeZone: input.timeZone },
              attendees: input.guestEmail
                ? [
                    {
                      emailAddress: {
                        address: input.guestEmail,
                        name: input.guestName,
                      },
                      type: "required",
                    },
                  ]
                : undefined,
            });
            results.push({ provider: "outlook", success: true });
          }
        } catch (err: any) {
          console.error(`[CalendarSync] Failed to sync to ${integration.provider}:`, err.message);
          results.push({ provider: integration.provider, success: false, error: err.message });
        }
      }

      return results;
    }),
};
