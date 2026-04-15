/**
 * Outlook / Microsoft Calendar Integration Service
 *
 * Handles Microsoft OAuth 2.0 flow, token refresh, event fetching,
 * event creation, and schedule availability queries via Microsoft Graph API.
 */

import { ENV } from "../_core/env";

const MS_AUTH_URL = "https://login.microsoftonline.com/common/oauth2/v2.0/authorize";
const MS_TOKEN_URL = "https://login.microsoftonline.com/common/oauth2/v2.0/token";
const MS_GRAPH_API = "https://graph.microsoft.com/v1.0";

const SCOPES = [
  "openid",
  "email",
  "offline_access",
  "Calendars.ReadWrite",
].join(" ");

// ─────────────────────────────────────────────
// OAuth Flow
// ─────────────────────────────────────────────

/**
 * Generate the Microsoft OAuth consent URL.
 */
export function getOutlookOAuthUrl(params: {
  accountId: number;
  userId: number;
  origin: string;
  redirectPath?: string;
}): string {
  // Validate Microsoft credentials are configured
  if (!ENV.microsoftClientId) {
    console.error("[Outlook OAuth] MICROSOFT_CLIENT_ID is not set in environment variables");
    throw new Error(
      "Microsoft OAuth is not configured. The MICROSOFT_CLIENT_ID environment variable is missing. Please contact your administrator."
    );
  }
  if (!ENV.microsoftClientSecret) {
    console.error("[Outlook OAuth] MICROSOFT_CLIENT_SECRET is not set in environment variables");
    throw new Error(
      "Microsoft OAuth is not configured. The MICROSOFT_CLIENT_SECRET environment variable is missing. Please contact your administrator."
    );
  }

  const state = JSON.stringify({
    accountId: params.accountId,
    userId: params.userId,
    origin: params.origin,
    redirectPath: params.redirectPath ?? "/settings",
  });

  const redirectUri = `${params.origin}/api/integrations/outlook/callback`;

  console.log(`[Outlook OAuth] Generating OAuth URL with client_id=${ENV.microsoftClientId.substring(0, 8)}..., redirect_uri=${redirectUri}`);

  const queryParams = new URLSearchParams({
    client_id: ENV.microsoftClientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: SCOPES,
    response_mode: "query",
    state,
  });

  return `${MS_AUTH_URL}?${queryParams.toString()}`;
}

/**
 * Exchange an authorization code for access + refresh tokens.
 */
export async function exchangeOutlookCode(
  code: string,
  redirectUri: string
): Promise<{
  accessToken: string;
  refreshToken: string | null;
  expiresIn: number;
}> {
  console.log(`[Outlook OAuth] Exchanging code for tokens. redirect_uri=${redirectUri}, client_id=${ENV.microsoftClientId.substring(0, 8)}...`);

  const res = await fetch(MS_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: ENV.microsoftClientId,
      client_secret: ENV.microsoftClientSecret,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    console.error(`[Outlook OAuth] Token exchange failed (HTTP ${res.status}): ${err}`);
    throw new Error(`Microsoft token exchange failed (HTTP ${res.status}): ${err}`);
  }

  const data = await res.json();
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token ?? null,
    expiresIn: data.expires_in,
  };
}

/**
 * Refresh an access token using a refresh token.
 */
export async function refreshOutlookToken(refreshToken: string): Promise<{
  accessToken: string;
  refreshToken: string | null;
  expiresIn: number;
}> {
  const res = await fetch(MS_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: ENV.microsoftClientId,
      client_secret: ENV.microsoftClientSecret,
      grant_type: "refresh_token",
      scope: SCOPES,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Microsoft token refresh failed: ${err}`);
  }

  const data = await res.json();
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token ?? null,
    expiresIn: data.expires_in,
  };
}

/**
 * Get the authenticated user's email from Microsoft Graph.
 */
export async function getOutlookUserEmail(accessToken: string): Promise<string> {
  const res = await fetch(`${MS_GRAPH_API}/me`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error("Failed to fetch Microsoft user info");
  const data = await res.json();
  return data.mail || data.userPrincipalName || "";
}

// ─────────────────────────────────────────────
// Calendar Events
// ─────────────────────────────────────────────

export interface OutlookCalendarEvent {
  id: string;
  subject: string;
  bodyPreview?: string;
  start: { dateTime: string; timeZone: string };
  end: { dateTime: string; timeZone: string };
  isCancelled: boolean;
  webLink?: string;
  showAs?: string;
}

/**
 * List events from an Outlook Calendar within a date range.
 */
export async function listOutlookEvents(
  accessToken: string,
  timeMin: string, // ISO 8601
  timeMax: string  // ISO 8601
): Promise<OutlookCalendarEvent[]> {
  const filter = `start/dateTime ge '${timeMin}' and end/dateTime le '${timeMax}'`;
  const params = new URLSearchParams({
    $filter: filter,
    $orderby: "start/dateTime",
    $top: "250",
  });

  const res = await fetch(
    `${MS_GRAPH_API}/me/calendarView?startDateTime=${encodeURIComponent(timeMin)}&endDateTime=${encodeURIComponent(timeMax)}&$top=250&$orderby=start/dateTime`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Failed to list Outlook events: ${err}`);
  }

  const data = await res.json();
  return data.value ?? [];
}

/**
 * Create an event on the user's Outlook Calendar.
 */
export async function createOutlookEvent(
  accessToken: string,
  event: {
    subject: string;
    body?: { contentType: "Text" | "HTML"; content: string };
    start: { dateTime: string; timeZone: string };
    end: { dateTime: string; timeZone: string };
    attendees?: { emailAddress: { address: string; name?: string }; type: "required" | "optional" }[];
  }
): Promise<OutlookCalendarEvent> {
  const res = await fetch(`${MS_GRAPH_API}/me/events`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(event),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Failed to create Outlook event: ${err}`);
  }

  return res.json();
}

/**
 * Query Outlook schedule availability to get busy time blocks.
 * Returns an array of { start, end } busy periods.
 */
export async function getOutlookBusyTimes(
  accessToken: string,
  email: string,
  timeMin: string,
  timeMax: string
): Promise<{ start: string; end: string }[]> {
  const res = await fetch(`${MS_GRAPH_API}/me/calendar/getSchedule`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      schedules: [email],
      startTime: { dateTime: timeMin, timeZone: "UTC" },
      endTime: { dateTime: timeMax, timeZone: "UTC" },
      availabilityViewInterval: 15,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Failed to query Outlook schedule: ${err}`);
  }

  const data = await res.json();
  const schedule = data.value?.[0];
  if (!schedule?.scheduleItems) return [];

  return schedule.scheduleItems
    .filter((item: any) => item.status === "busy" || item.status === "tentative" || item.status === "oof")
    .map((item: any) => ({
      start: item.start?.dateTime ?? "",
      end: item.end?.dateTime ?? "",
    }));
}
