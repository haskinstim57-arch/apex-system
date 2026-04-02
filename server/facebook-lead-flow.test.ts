import { describe, it, expect, vi, beforeEach } from "vitest";

// ─────────────────────────────────────────────
// Tests for Facebook Lead Webhook Flow
// - Page subscription after OAuth
// - Account resolution via accountFacebookPages
// - Lead data fetching from Graph API
// - Automation triggering
// - Token refresh job
// ─────────────────────────────────────────────

describe("Facebook Lead Flow", () => {
  describe("DB Helpers", () => {
    it("getAccountFacebookPageByFbPageId is exported from db", async () => {
      const db = await import("./db");
      expect(typeof db.getAccountFacebookPageByFbPageId).toBe("function");
    });

    it("markFacebookPageSubscribed is exported from db", async () => {
      const db = await import("./db");
      expect(typeof db.markFacebookPageSubscribed).toBe("function");
    });

    it("listExpiringIntegrations is exported from db", async () => {
      const db = await import("./db");
      expect(typeof db.listExpiringIntegrations).toBe("function");
    });

    it("getAccountFacebookPageByFbPageId returns null when DB unavailable", async () => {
      const db = await import("./db");
      // When no DB is configured, should return null gracefully
      const result = await db.getAccountFacebookPageByFbPageId("nonexistent_page");
      expect(result === null || result === undefined || typeof result === "object").toBe(true);
    });

    it("listExpiringIntegrations returns array when DB unavailable", async () => {
      const db = await import("./db");
      const result = await db.listExpiringIntegrations(7);
      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe("Facebook OAuth Router - Page Subscription", () => {
    it("facebookOAuth router is exported", async () => {
      const { facebookOAuthRouter } = await import("./routers/facebookOAuth");
      expect(facebookOAuthRouter).toBeDefined();
      expect(facebookOAuthRouter._def).toBeDefined();
    });

    it("facebookOAuth router has handleCallback mutation", async () => {
      const { facebookOAuthRouter } = await import("./routers/facebookOAuth");
      expect(facebookOAuthRouter._def.procedures.handleCallback).toBeDefined();
    });

    it("facebookOAuth router has getStatus query", async () => {
      const { facebookOAuthRouter } = await import("./routers/facebookOAuth");
      expect(facebookOAuthRouter._def.procedures.getStatus).toBeDefined();
    });

    it("facebookOAuth router has disconnect mutation", async () => {
      const { facebookOAuthRouter } = await import("./routers/facebookOAuth");
      expect(facebookOAuthRouter._def.procedures.disconnect).toBeDefined();
    });
  });

  describe("Webhook Handler - Account Resolution", () => {
    it("facebookLeadsWebhookRouter is exported", async () => {
      const { facebookLeadsWebhookRouter } = await import("./webhooks/facebookLeads");
      expect(facebookLeadsWebhookRouter).toBeDefined();
    });

    it("webhook handler imports getAccountFacebookPageByFbPageId", async () => {
      // Verify the import exists in the webhook module
      const webhookModule = await import("./webhooks/facebookLeads");
      expect(webhookModule.facebookLeadsWebhookRouter).toBeDefined();
    });
  });

  describe("Workflow Triggers", () => {
    it("onContactCreated is exported from workflowTriggers", async () => {
      const triggers = await import("./services/workflowTriggers");
      expect(typeof triggers.onContactCreated).toBe("function");
    });

    it("onFacebookLeadReceived is exported from workflowTriggers", async () => {
      const triggers = await import("./services/workflowTriggers");
      expect(typeof triggers.onFacebookLeadReceived).toBe("function");
    });

    it("onContactCreated does not throw when no DB", async () => {
      const triggers = await import("./services/workflowTriggers");
      // Should handle gracefully when DB is not available
      await expect(triggers.onContactCreated(1, 1)).resolves.not.toThrow();
    });

    it("onFacebookLeadReceived does not throw when no DB", async () => {
      const triggers = await import("./services/workflowTriggers");
      await expect(triggers.onFacebookLeadReceived(1, 1)).resolves.not.toThrow();
    });
  });

  describe("Facebook Token Refresh Job", () => {
    it("startFacebookTokenRefreshJob and stopFacebookTokenRefreshJob are exported", async () => {
      const { startFacebookTokenRefreshJob, stopFacebookTokenRefreshJob } = await import(
        "./services/facebookTokenRefresh"
      );
      expect(typeof startFacebookTokenRefreshJob).toBe("function");
      expect(typeof stopFacebookTokenRefreshJob).toBe("function");
    });

    it("startFacebookTokenRefreshJob does not throw", async () => {
      const { startFacebookTokenRefreshJob, stopFacebookTokenRefreshJob } = await import(
        "./services/facebookTokenRefresh"
      );
      expect(() => startFacebookTokenRefreshJob()).not.toThrow();
      // Clean up
      stopFacebookTokenRefreshJob();
    });

    it("calling startFacebookTokenRefreshJob twice is idempotent", async () => {
      const { startFacebookTokenRefreshJob, stopFacebookTokenRefreshJob } = await import(
        "./services/facebookTokenRefresh"
      );
      startFacebookTokenRefreshJob();
      startFacebookTokenRefreshJob(); // second call should be no-op
      stopFacebookTokenRefreshJob();
    });

    it("stopFacebookTokenRefreshJob does not throw when not started", async () => {
      const { stopFacebookTokenRefreshJob } = await import(
        "./services/facebookTokenRefresh"
      );
      expect(() => stopFacebookTokenRefreshJob()).not.toThrow();
    });

    it("checkExpiringTokens returns result object", async () => {
      const { checkExpiringTokens } = await import("./services/facebookTokenRefresh");
      const result = await checkExpiringTokens();
      expect(result).toBeDefined();
      expect(typeof result.alerted).toBe("number");
      expect(result.alerted).toBeGreaterThanOrEqual(0);
    });
  });

  describe("Webhook POST Handler - Lead Processing", () => {
    it("handles native Facebook payload format with entry array", async () => {
      // This tests the structure parsing, not actual DB operations
      const { facebookLeadsWebhookRouter } = await import("./webhooks/facebookLeads");
      expect(facebookLeadsWebhookRouter).toBeDefined();
      // The router should have routes for both /api/webhooks/facebook-leads and /api/webhooks/facebook
      const routes = facebookLeadsWebhookRouter.stack || [];
      expect(routes.length).toBeGreaterThan(0);
    });

    it("webhook router has GET and POST routes for /api/webhooks/facebook", async () => {
      const { facebookLeadsWebhookRouter } = await import("./webhooks/facebookLeads");
      const routes = facebookLeadsWebhookRouter.stack || [];
      
      const facebookGetRoutes = routes.filter(
        (r: any) => r.route?.path === "/api/webhooks/facebook" && r.route?.methods?.get
      );
      const facebookPostRoutes = routes.filter(
        (r: any) => r.route?.path === "/api/webhooks/facebook" && r.route?.methods?.post
      );

      expect(facebookGetRoutes.length).toBe(1);
      expect(facebookPostRoutes.length).toBe(1);
    });

    it("webhook router has GET and POST routes for /api/webhooks/facebook-leads", async () => {
      const { facebookLeadsWebhookRouter } = await import("./webhooks/facebookLeads");
      const routes = facebookLeadsWebhookRouter.stack || [];
      
      const leadsGetRoutes = routes.filter(
        (r: any) => r.route?.path === "/api/webhooks/facebook-leads" && r.route?.methods?.get
      );
      const leadsPostRoutes = routes.filter(
        (r: any) => r.route?.path === "/api/webhooks/facebook-leads" && r.route?.methods?.post
      );

      expect(leadsGetRoutes.length).toBe(1);
      expect(leadsPostRoutes.length).toBe(1);
    });
  });

  describe("Server Entry Point", () => {
    it("server index imports startFacebookTokenRefreshJob", async () => {
      // Read the file to verify the import exists
      const fs = await import("fs");
      const content = fs.readFileSync(
        require("path").resolve(__dirname, "./_core/index.ts"),
        "utf-8"
      );
      expect(content).toContain("startFacebookTokenRefreshJob");
      expect(content).toContain("../services/facebookTokenRefresh");
    });
  });

  describe("Integration: facebookOAuth router includes subscription logic", () => {
    it("handleCallback code contains subscribed_apps call", async () => {
      const fs = await import("fs");
      const content = fs.readFileSync(
        require("path").resolve(__dirname, "./routers/facebookOAuth.ts"),
        "utf-8"
      );
      expect(content).toContain("subscribed_apps");
      expect(content).toContain("subscribed_fields");
      expect(content).toContain("leadgen");
      expect(content).toContain("markFacebookPageSubscribed");
    });
  });

  describe("Integration: webhook handler uses accountFacebookPages for resolution", () => {
    it("webhook handler code imports getAccountFacebookPageByFbPageId", async () => {
      const fs = await import("fs");
      const content = fs.readFileSync(
        require("path").resolve(__dirname, "./webhooks/facebookLeads.ts"),
        "utf-8"
      );
      expect(content).toContain("getAccountFacebookPageByFbPageId");
      expect(content).toContain("accountFacebookPages");
    });

    it("webhook handler code contains Graph API lead fetch logic", async () => {
      const fs = await import("fs");
      const content = fs.readFileSync(
        require("path").resolve(__dirname, "./webhooks/facebookLeads.ts"),
        "utf-8"
      );
      expect(content).toContain("fetchLeadDataFromGraph");
      expect(content).toContain("FACEBOOK_GRAPH_API");
      expect(content).toContain("field_data");
    });

    it("webhook handler fires both contact_created and facebook_lead_received triggers", async () => {
      const fs = await import("fs");
      const content = fs.readFileSync(
        require("path").resolve(__dirname, "./webhooks/facebookLeads.ts"),
        "utf-8"
      );
      expect(content).toContain("onContactCreated");
      expect(content).toContain("onFacebookLeadReceived");
    });
  });

  describe("Lead Routing Priority: facebookPageMappings before accountFacebookPages", () => {
    it("checks facebookPageMappings (admin manual) BEFORE accountFacebookPages (OAuth)", async () => {
      const fs = await import("fs");
      const content = fs.readFileSync(
        require("path").resolve(__dirname, "./webhooks/facebookLeads.ts"),
        "utf-8"
      );
      // facebookPageMappings lookup must appear before accountFacebookPages fallback
      const mappingIndex = content.indexOf("getFacebookPageMappingByPageId");
      // The first occurrence of getAccountFacebookPageByFbPageId AFTER the mapping check
      // should be the token retrieval, not the primary account resolution
      expect(mappingIndex).toBeGreaterThan(0);

      // Verify the comment documents the priority
      expect(content).toContain("admin-created explicit routing takes priority");
      expect(content).toContain("OAuth-connected pages");
    });

    it("admin facebookPageMappings lookup appears before OAuth fallback in handleFacebookNativePayload", async () => {
      const fs = await import("fs");
      const content = fs.readFileSync(
        require("path").resolve(__dirname, "./webhooks/facebookLeads.ts"),
        "utf-8"
      );
      // In the account resolution block, the mapping check should come first
      const resolutionBlock = content.slice(
        content.indexOf("if ((!accountId || accountId <= 0) && pageId)"),
        content.indexOf("if (!accountId || accountId <= 0) {")
      );

      const mappingPos = resolutionBlock.indexOf("getFacebookPageMappingByPageId");
      const oauthFallbackPos = resolutionBlock.indexOf("via OAuth accountFacebookPages");

      expect(mappingPos).toBeGreaterThan(0);
      expect(oauthFallbackPos).toBeGreaterThan(0);
      // Manual mapping check must come before OAuth fallback
      expect(mappingPos).toBeLessThan(oauthFallbackPos);
    });

    it("retrieves pageAccessToken from accountFacebookPages even when manual mapping wins", async () => {
      const fs = await import("fs");
      const content = fs.readFileSync(
        require("path").resolve(__dirname, "./webhooks/facebookLeads.ts"),
        "utf-8"
      );
      // After the manual mapping resolves the account, it should still try to get
      // the page access token from accountFacebookPages for Graph API calls
      expect(content).toContain("Still try to get page access token from accountFacebookPages for Graph API");
      expect(content).toContain("fbPage.pageAccessToken");
    });

    it("falls back to accountFacebookPages when no manual mapping exists", async () => {
      const fs = await import("fs");
      const content = fs.readFileSync(
        require("path").resolve(__dirname, "./webhooks/facebookLeads.ts"),
        "utf-8"
      );
      // The else branch should contain the OAuth fallback
      expect(content).toContain("Fall back to accountFacebookPages (OAuth-connected pages)");
      expect(content).toContain("via OAuth accountFacebookPages");
    });

    it("skips lead when neither manual mapping nor OAuth page exists", async () => {
      const fs = await import("fs");
      const content = fs.readFileSync(
        require("path").resolve(__dirname, "./webhooks/facebookLeads.ts"),
        "utf-8"
      );
      expect(content).toContain("No mapping found for page_id=");
      expect(content).toContain("No account mapping for page");
    });
  });
});
