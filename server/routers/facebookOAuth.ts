import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { ENV } from "../_core/env";
import * as db from "../db";
import { TRPCError } from "@trpc/server";

// ─────────────────────────────────────────────
// Facebook OAuth Router
// Handles Facebook OAuth flow, token exchange,
// page fetching, and integration management.
// ─────────────────────────────────────────────

const FACEBOOK_GRAPH_API = "https://graph.facebook.com/v19.0";

const FACEBOOK_PERMISSIONS = [
  "leads_retrieval",
  "pages_manage_ads",
  "pages_read_engagement",
  "pages_show_list",
].join(",");

/**
 * Helper: require that the user has access to the given account
 */
async function requireAccountAccess(userId: number, accountId: number) {
  const member = await db.getMember(accountId, userId);
  if (!member) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "You do not have access to this account",
    });
  }
}

export const facebookOAuthRouter = router({
  /**
   * Generate a Facebook OAuth URL for the user to authorize.
   * The frontend opens this URL in a popup or redirects to it.
   * `redirectUri` must be passed from the frontend (using window.location.origin).
   */
  getOAuthUrl: protectedProcedure
    .input(
      z.object({
        accountId: z.number().int().positive(),
        redirectUri: z.string().url(),
      })
    )
    .query(async ({ input, ctx }) => {
      if (ctx.user.role !== "admin") {
        await requireAccountAccess(ctx.user.id, input.accountId);
      }

      if (!ENV.facebookAppId) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "Facebook App ID is not configured. Please contact your administrator.",
        });
      }

      // Encode accountId in the state parameter so we know which account to link after callback
      const state = JSON.stringify({ accountId: input.accountId });
      const encodedState = encodeURIComponent(Buffer.from(state).toString("base64"));

      const url = new URL("https://www.facebook.com/v19.0/dialog/oauth");
      url.searchParams.set("client_id", ENV.facebookAppId);
      url.searchParams.set("redirect_uri", input.redirectUri);
      url.searchParams.set("scope", FACEBOOK_PERMISSIONS);
      url.searchParams.set("state", encodedState);
      url.searchParams.set("response_type", "code");

      return { url: url.toString() };
    }),

  /**
   * Handle the OAuth callback — exchange code for tokens, fetch user info & pages.
   */
  handleCallback: protectedProcedure
    .input(
      z.object({
        code: z.string().min(1),
        redirectUri: z.string().url(),
        state: z.string().min(1),
      })
    )
    .mutation(async ({ input, ctx }) => {
      // Decode state to get accountId
      let accountId: number;
      try {
        const decoded = JSON.parse(
          Buffer.from(decodeURIComponent(input.state), "base64").toString("utf-8")
        );
        accountId = decoded.accountId;
      } catch {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Invalid state parameter",
        });
      }

      if (ctx.user.role !== "admin") {
        await requireAccountAccess(ctx.user.id, accountId);
      }

      if (!ENV.facebookAppId || !ENV.facebookAppSecret) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "Facebook credentials are not configured.",
        });
      }

      // Step 1: Exchange code for short-lived access token
      const tokenUrl = new URL(`${FACEBOOK_GRAPH_API}/oauth/access_token`);
      tokenUrl.searchParams.set("client_id", ENV.facebookAppId);
      tokenUrl.searchParams.set("redirect_uri", input.redirectUri);
      tokenUrl.searchParams.set("client_secret", ENV.facebookAppSecret);
      tokenUrl.searchParams.set("code", input.code);

      const tokenRes = await fetch(tokenUrl.toString());
      const tokenData = await tokenRes.json();

      if (tokenData.error) {
        console.error("[Facebook OAuth] Token exchange error:", tokenData.error);
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: tokenData.error.message || "Failed to exchange Facebook authorization code",
        });
      }

      const shortLivedToken = tokenData.access_token;

      // Step 2: Exchange for long-lived token (60-day expiry)
      const longLivedUrl = new URL(`${FACEBOOK_GRAPH_API}/oauth/access_token`);
      longLivedUrl.searchParams.set("grant_type", "fb_exchange_token");
      longLivedUrl.searchParams.set("client_id", ENV.facebookAppId);
      longLivedUrl.searchParams.set("client_secret", ENV.facebookAppSecret);
      longLivedUrl.searchParams.set("fb_exchange_token", shortLivedToken);

      const longLivedRes = await fetch(longLivedUrl.toString());
      const longLivedData = await longLivedRes.json();

      if (longLivedData.error) {
        console.error("[Facebook OAuth] Long-lived token error:", longLivedData.error);
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Failed to obtain long-lived Facebook token",
        });
      }

      const accessToken = longLivedData.access_token;
      const expiresIn = longLivedData.expires_in || 5184000; // Default 60 days
      const tokenExpiresAt = new Date(Date.now() + expiresIn * 1000);

      // Step 3: Fetch Facebook user info
      const meRes = await fetch(
        `${FACEBOOK_GRAPH_API}/me?fields=id,name&access_token=${accessToken}`
      );
      const meData = await meRes.json();

      if (meData.error) {
        console.error("[Facebook OAuth] User info error:", meData.error);
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Failed to fetch Facebook user info",
        });
      }

      // Step 4: Save integration
      const integration = await db.upsertAccountIntegration(accountId, "facebook", {
        providerUserId: meData.id,
        providerUserName: meData.name,
        accessToken,
        tokenExpiresAt,
        isActive: true,
        connectedById: ctx.user.id,
      });

      // Step 5: Fetch and store Facebook Pages
      const pagesRes = await fetch(
        `${FACEBOOK_GRAPH_API}/me/accounts?fields=id,name,access_token&access_token=${accessToken}`
      );
      const pagesData = await pagesRes.json();

      if (pagesData.data && Array.isArray(pagesData.data)) {
        for (const page of pagesData.data) {
          const pageRow = await db.upsertAccountFacebookPage(accountId, integration.id, {
            facebookPageId: page.id,
            pageName: page.name || null,
            pageAccessToken: page.access_token || null,
          });

          // Subscribe the page to leadgen webhooks
          if (page.access_token) {
            try {
              const subRes = await fetch(
                `${FACEBOOK_GRAPH_API}/${page.id}/subscribed_apps`,
                {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    subscribed_fields: ["leadgen"],
                    access_token: page.access_token,
                  }),
                }
              );
              const subData = await subRes.json();
              if (subData.success) {
                await db.markFacebookPageSubscribed(pageRow.id, true);
                console.log(
                  `[Facebook OAuth] Subscribed page ${page.id} (${page.name}) to leadgen webhooks`
                );
              } else {
                console.warn(
                  `[Facebook OAuth] Failed to subscribe page ${page.id}:`,
                  subData.error || subData
                );
              }
            } catch (subErr) {
              console.error(
                `[Facebook OAuth] Error subscribing page ${page.id} to leadgen:`,
                subErr
              );
            }
          }
        }
      }

      // Create audit log
      await db.createAuditLog({
        accountId,
        userId: ctx.user.id,
        action: "integration.facebook_connected",
        resourceType: "integration",
        resourceId: integration.id,
      });

      return {
        success: true,
        facebookUserName: meData.name,
        pagesCount: pagesData.data?.length || 0,
      };
    }),

  /**
   * Get the current Facebook integration status for an account.
   */
  getStatus: protectedProcedure
    .input(z.object({ accountId: z.number().int().positive() }))
    .query(async ({ input, ctx }) => {
      if (ctx.user.role !== "admin") {
        await requireAccountAccess(ctx.user.id, input.accountId);
      }

      const integration = await db.getAccountIntegration(input.accountId, "facebook");
      if (!integration || !integration.isActive) {
        return { connected: false, userName: null, pages: [] };
      }

      const pages = await db.listAccountFacebookPages(input.accountId);

      return {
        connected: true,
        userName: integration.providerUserName,
        userId: integration.providerUserId,
        tokenExpiresAt: integration.tokenExpiresAt,
        pages: pages.map((p) => ({
          id: p.id,
          facebookPageId: p.facebookPageId,
          pageName: p.pageName,
          isSubscribed: p.isSubscribed,
        })),
      };
    }),

  /**
   * List Facebook pages for an account.
   */
  listPages: protectedProcedure
    .input(z.object({ accountId: z.number().int().positive() }))
    .query(async ({ input, ctx }) => {
      if (ctx.user.role !== "admin") {
        await requireAccountAccess(ctx.user.id, input.accountId);
      }

      const pages = await db.listAccountFacebookPages(input.accountId);
      return { pages };
    }),

  /**
   * Disconnect Facebook integration for an account.
   */
  disconnect: protectedProcedure
    .input(z.object({ accountId: z.number().int().positive() }))
    .mutation(async ({ input, ctx }) => {
      if (ctx.user.role !== "admin") {
        await requireAccountAccess(ctx.user.id, input.accountId);
      }

      // Delete pages first, then the integration
      await db.deleteAccountFacebookPages(input.accountId);
      await db.deleteAccountIntegration(input.accountId, "facebook");

      await db.createAuditLog({
        accountId: input.accountId,
        userId: ctx.user.id,
        action: "integration.facebook_disconnected",
        resourceType: "integration",
        resourceId: input.accountId,
      });

      return { success: true };
    }),
});
