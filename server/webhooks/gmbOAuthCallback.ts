import { Router } from "express";
import { getDb } from "../db";
import { gmbConnections } from "../../drizzle/schema";
import { eq } from "drizzle-orm";
import { exchangeCode, getUserEmail } from "../services/gmbService";

export const gmbOAuthCallbackRouter = Router();

/**
 * GET /api/gmb/callback
 *
 * Google redirects here after the user authorizes.
 * `code` is the authorization code, `state` carries the accountId.
 */
gmbOAuthCallbackRouter.get("/api/gmb/callback", async (req, res) => {
  const { code, state: accountId } = req.query;

  if (!code || !accountId) {
    return res.redirect("/settings?gmb=error&reason=missing_params");
  }

  try {
    const db = await getDb();
    if (!db) {
      return res.redirect("/settings?gmb=error&reason=db_unavailable");
    }

    // Build the redirect URI from the request origin
    const protocol = req.headers["x-forwarded-proto"] || req.protocol || "https";
    const host = req.headers["x-forwarded-host"] || req.headers.host;
    const redirectUri = `${protocol}://${host}/api/gmb/callback`;

    // Exchange code for tokens
    const tokens = await exchangeCode(code as string, redirectUri);

    if (!tokens.access_token) {
      return res.redirect("/settings?gmb=error&reason=no_access_token");
    }

    // Get the Google account email
    const email = await getUserEmail(tokens.access_token);

    const parsedAccountId = parseInt(accountId as string, 10);

    // Check if connection already exists for this account
    const [existing] = await db
      .select()
      .from(gmbConnections)
      .where(eq(gmbConnections.accountId, parsedAccountId))
      .limit(1);

    if (existing) {
      // Update existing connection
      await db
        .update(gmbConnections)
        .set({
          googleEmail: email,
          accessToken: tokens.access_token,
          refreshToken: tokens.refresh_token || existing.refreshToken,
          tokenExpiresAt: tokens.expiry_date ? new Date(tokens.expiry_date) : new Date(Date.now() + 3600_000),
          status: "active",
        })
        .where(eq(gmbConnections.id, existing.id));
    } else {
      // Create new connection
      await db.insert(gmbConnections).values({
        accountId: parsedAccountId,
        googleEmail: email,
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token || null,
        tokenExpiresAt: tokens.expiry_date ? new Date(tokens.expiry_date) : new Date(Date.now() + 3600_000),
      });
    }

    res.redirect(`/settings?gmb=connected&account=${parsedAccountId}`);
  } catch (err) {
    console.error("[GMB OAuth] Error:", err);
    res.redirect("/settings?gmb=error&reason=exchange_failed");
  }
});
