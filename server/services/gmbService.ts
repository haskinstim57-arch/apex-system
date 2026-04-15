import { google } from "googleapis";
import { ENV } from "../_core/env";

/**
 * Google My Business (Google Business Profile) Service
 *
 * Handles OAuth2 flow, location listing, review fetching,
 * review replies, and local post creation via the GBP APIs.
 */

function createOAuth2Client(redirectUri?: string) {
  if (!ENV.googleClientId) {
    console.error("[GMB] GOOGLE_CLIENT_ID is not set in environment variables");
    throw new Error("Google Business Profile integration is not configured. GOOGLE_CLIENT_ID is missing.");
  }
  if (!ENV.googleClientSecret) {
    console.error("[GMB] GOOGLE_CLIENT_SECRET is not set in environment variables");
    throw new Error("Google Business Profile integration is not configured. GOOGLE_CLIENT_SECRET is missing.");
  }
  return new google.auth.OAuth2(
    ENV.googleClientId,
    ENV.googleClientSecret,
    redirectUri
  );
}

/**
 * Generate the Google OAuth consent URL.
 * `state` carries the accountId so the callback can associate the token.
 */
export function getAuthUrl(accountId: number, redirectUri: string): string {
  const client = createOAuth2Client(redirectUri);
  return client.generateAuthUrl({
    access_type: "offline",
    scope: [
      "https://www.googleapis.com/auth/business.manage",
      "https://www.googleapis.com/auth/userinfo.email",
    ],
    state: String(accountId),
    prompt: "consent", // force refresh token every time
  });
}

/**
 * Exchange an authorization code for tokens.
 */
export async function exchangeCode(code: string, redirectUri: string) {
  console.log(`[GMB] Exchanging code for tokens. redirect_uri=${redirectUri}`);
  try {
    const client = createOAuth2Client(redirectUri);
    const { tokens } = await client.getToken(code);
    console.log(`[GMB] Token exchange successful. Has access_token: ${!!tokens.access_token}, Has refresh_token: ${!!tokens.refresh_token}`);
    return tokens;
  } catch (err: any) {
    console.error(`[GMB] Token exchange failed:`, err?.response?.data || err?.message || err);
    throw new Error(`Google token exchange failed: ${err?.response?.data?.error_description || err?.message || "Unknown error"}`);
  }
}

/**
 * Build an authenticated OAuth2 client from stored tokens.
 */
export function getAuthenticatedClient(accessToken: string, refreshToken: string | null) {
  const client = createOAuth2Client();
  client.setCredentials({
    access_token: accessToken,
    refresh_token: refreshToken || undefined,
  });
  return client;
}

/**
 * Get the current access token, refreshing if needed.
 */
async function getToken(auth: ReturnType<typeof getAuthenticatedClient>): Promise<string> {
  const { token } = await auth.getAccessToken();
  if (!token) throw new Error("Failed to get access token — token may be expired");
  return token;
}

/**
 * Fetch the user's Google account email from the OAuth token.
 */
export async function getUserEmail(accessToken: string): Promise<string> {
  const res = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error(`Failed to fetch user info: ${res.status}`);
  const data = await res.json();
  return data.email;
}

/**
 * List all Google Business Profile locations for the authenticated account.
 * Returns an array of { name, title, address }.
 */
export async function getLocations(accessToken: string, refreshToken: string | null) {
  const auth = getAuthenticatedClient(accessToken, refreshToken);
  const token = await getToken(auth);

  // Step 1: Get accounts
  console.log(`[GMB] Fetching business accounts...`);
  const accountsRes = await fetch(
    "https://mybusinessaccountmanagement.googleapis.com/v1/accounts",
    { headers: { Authorization: `Bearer ${token}` } }
  );
  if (!accountsRes.ok) {
    const err = await accountsRes.text();
    console.error(`[GMB] Failed to fetch accounts (HTTP ${accountsRes.status}):`, err);
    throw new Error(`Failed to fetch GMB accounts: ${accountsRes.status} — ${err}`);
  }
  const accountsData = await accountsRes.json();
  if (!accountsData.accounts?.length) return [];

  const accountName = accountsData.accounts[0].name;

  // Step 2: Get locations for the first account
  const locRes = await fetch(
    `https://mybusinessbusinessinformation.googleapis.com/v1/${accountName}/locations?readMask=name,title,storefrontAddress`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  if (!locRes.ok) {
    const err = await locRes.text();
    throw new Error(`Failed to fetch locations: ${locRes.status} — ${err}`);
  }
  const locData = await locRes.json();
  return (locData.locations || []).map((loc: any) => ({
    name: loc.name, // e.g. "locations/12345"
    title: loc.title, // e.g. "Apex Mortgage"
    address: loc.storefrontAddress
      ? [
          loc.storefrontAddress.addressLines?.join(", "),
          loc.storefrontAddress.locality,
          loc.storefrontAddress.administrativeArea,
          loc.storefrontAddress.postalCode,
        ]
          .filter(Boolean)
          .join(", ")
      : null,
  }));
}

/**
 * Fetch reviews for a specific location.
 */
export async function getReviews(accessToken: string, refreshToken: string | null, locationId: string) {
  const auth = getAuthenticatedClient(accessToken, refreshToken);
  const token = await getToken(auth);

  const res = await fetch(
    `https://mybusiness.googleapis.com/v4/${locationId}/reviews?pageSize=50&orderBy=updateTime desc`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Failed to fetch reviews: ${res.status} — ${err}`);
  }
  const data = await res.json();
  return data.reviews || [];
}

/**
 * Reply to a specific review.
 */
export async function replyToReview(
  accessToken: string,
  refreshToken: string | null,
  locationId: string,
  reviewId: string,
  replyText: string
) {
  const auth = getAuthenticatedClient(accessToken, refreshToken);
  const token = await getToken(auth);

  const res = await fetch(
    `https://mybusiness.googleapis.com/v4/${locationId}/reviews/${reviewId}/reply`,
    {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ comment: replyText }),
    }
  );
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Failed to reply to review: ${res.status} — ${err}`);
  }
  return res.json();
}

/**
 * Create a local post on the Google Business Profile.
 */
export async function createPost(
  accessToken: string,
  refreshToken: string | null,
  locationId: string,
  summary: string,
  ctaType?: string,
  ctaUrl?: string
) {
  const auth = getAuthenticatedClient(accessToken, refreshToken);
  const token = await getToken(auth);

  const body: Record<string, unknown> = {
    summary,
    topicType: "STANDARD",
  };
  if (ctaType && ctaUrl) {
    body.callToAction = { actionType: ctaType, url: ctaUrl };
  }

  const res = await fetch(
    `https://mybusiness.googleapis.com/v4/${locationId}/localPosts`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    }
  );
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Failed to create post: ${res.status} — ${err}`);
  }
  return res.json();
}
