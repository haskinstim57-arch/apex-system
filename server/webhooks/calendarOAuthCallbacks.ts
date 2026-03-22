/**
 * Calendar OAuth Callback Routes
 *
 * Express routes that handle the OAuth redirect from Google and Outlook.
 * These are NOT tRPC procedures because OAuth providers redirect via GET requests.
 *
 * Routes:
 *   GET /api/integrations/google/callback  — Google OAuth callback
 *   GET /api/integrations/outlook/callback — Outlook OAuth callback
 */

import { Router } from "express";
import {
  exchangeGoogleCode,
  getGoogleUserEmail,
} from "../services/googleCalendar";
import {
  exchangeOutlookCode,
  getOutlookUserEmail,
} from "../services/outlookCalendar";
import {
  createCalendarIntegration,
  getCalendarIntegrationByProvider,
  updateCalendarIntegration,
} from "../db";

export const calendarOAuthCallbackRouter = Router();

// ─── Google OAuth Callback ───
calendarOAuthCallbackRouter.get(
  "/api/integrations/google/callback",
  async (req, res) => {
    try {
      const { code, state } = req.query;

      if (!code || typeof code !== "string") {
        return res.status(400).send("Missing authorization code");
      }

      let stateData: { accountId: number; userId: number; origin: string; redirectPath?: string };
      try {
        stateData = JSON.parse(decodeURIComponent(state as string));
      } catch {
        return res.status(400).send("Invalid state parameter");
      }

      const redirectUri = `${stateData.origin}/api/integrations/google/callback`;

      // Exchange code for tokens
      const { accessToken, refreshToken, expiresIn } = await exchangeGoogleCode(code, redirectUri);

      // Get user email
      const email = await getGoogleUserEmail(accessToken);

      // Store integration (upsert: update if exists, create if not)
      const existing = await getCalendarIntegrationByProvider(stateData.userId, stateData.accountId, "google");
      if (existing) {
        await updateCalendarIntegration(existing.id, stateData.userId, {
          accessToken,
          refreshToken,
          tokenExpiresAt: new Date(Date.now() + expiresIn * 1000),
          externalEmail: email,
          externalCalendarId: "primary",
          isActive: true,
        });
      } else {
        await createCalendarIntegration({
          userId: stateData.userId,
          accountId: stateData.accountId,
          provider: "google",
          accessToken,
          refreshToken,
          tokenExpiresAt: new Date(Date.now() + expiresIn * 1000),
          externalEmail: email,
          externalCalendarId: "primary",
          isActive: true,
        });
      }

      // Redirect back to the app
      const redirectPath = stateData.redirectPath || "/settings";
      res.redirect(`${stateData.origin}${redirectPath}?calendarConnected=google`);
    } catch (err: any) {
      console.error("[CalendarOAuth] Google callback error:", err.message);
      const origin = tryParseOrigin(req.query.state as string);
      if (origin) {
        res.redirect(`${origin}/settings?calendarError=google`);
      } else {
        res.status(500).send("Failed to connect Google Calendar. Please try again.");
      }
    }
  }
);

// ─── Outlook OAuth Callback ───
calendarOAuthCallbackRouter.get(
  "/api/integrations/outlook/callback",
  async (req, res) => {
    try {
      const { code, state } = req.query;

      if (!code || typeof code !== "string") {
        return res.status(400).send("Missing authorization code");
      }

      let stateData: { accountId: number; userId: number; origin: string; redirectPath?: string };
      try {
        stateData = JSON.parse(decodeURIComponent(state as string));
      } catch {
        return res.status(400).send("Invalid state parameter");
      }

      const redirectUri = `${stateData.origin}/api/integrations/outlook/callback`;

      // Exchange code for tokens
      const { accessToken, refreshToken, expiresIn } = await exchangeOutlookCode(code, redirectUri);

      // Get user email
      const email = await getOutlookUserEmail(accessToken);

      // Store integration (upsert: update if exists, create if not)
      const existing = await getCalendarIntegrationByProvider(stateData.userId, stateData.accountId, "outlook");
      if (existing) {
        await updateCalendarIntegration(existing.id, stateData.userId, {
          accessToken,
          refreshToken,
          tokenExpiresAt: new Date(Date.now() + expiresIn * 1000),
          externalEmail: email,
          externalCalendarId: "default",
          isActive: true,
        });
      } else {
        await createCalendarIntegration({
          userId: stateData.userId,
          accountId: stateData.accountId,
          provider: "outlook",
          accessToken,
          refreshToken,
          tokenExpiresAt: new Date(Date.now() + expiresIn * 1000),
          externalEmail: email,
          externalCalendarId: "default",
          isActive: true,
        });
      }

      // Redirect back to the app
      const redirectPath = stateData.redirectPath || "/settings";
      res.redirect(`${stateData.origin}${redirectPath}?calendarConnected=outlook`);
    } catch (err: any) {
      console.error("[CalendarOAuth] Outlook callback error:", err.message);
      const origin = tryParseOrigin(req.query.state as string);
      if (origin) {
        res.redirect(`${origin}/settings?calendarError=outlook`);
      } else {
        res.status(500).send("Failed to connect Outlook Calendar. Please try again.");
      }
    }
  }
);

/** Helper to extract origin from state for error redirects */
function tryParseOrigin(stateStr: string | undefined): string | null {
  if (!stateStr) return null;
  try {
    const data = JSON.parse(decodeURIComponent(stateStr));
    return data.origin || null;
  } catch {
    return null;
  }
}
