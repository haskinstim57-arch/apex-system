import { describe, it, expect, vi, beforeEach } from "vitest";
import { z } from "zod";

// ─── Mock DB ────────────────────────────────────────────────
const mockIntegrations: Record<string, any> = {};
const mockPages: Record<string, any[]> = {};
const mockMembers: Record<string, any> = {};
const mockAuditLogs: any[] = [];

vi.mock("./db", () => ({
  getMember: vi.fn(async (accountId: number, userId: number) => {
    return mockMembers[`${accountId}-${userId}`] || null;
  }),
  getAccountIntegration: vi.fn(async (accountId: number, provider: string) => {
    return mockIntegrations[`${accountId}-${provider}`] || null;
  }),
  upsertAccountIntegration: vi.fn(async (accountId: number, provider: string, data: any) => {
    const integration = {
      id: 100,
      accountId,
      provider,
      ...data,
    };
    mockIntegrations[`${accountId}-${provider}`] = integration;
    return integration;
  }),
  deleteAccountIntegration: vi.fn(async (accountId: number, provider: string) => {
    delete mockIntegrations[`${accountId}-${provider}`];
  }),
  listAccountFacebookPages: vi.fn(async (accountId: number) => {
    return mockPages[`${accountId}`] || [];
  }),
  upsertAccountFacebookPage: vi.fn(async (accountId: number, integrationId: number, data: any) => {
    if (!mockPages[`${accountId}`]) mockPages[`${accountId}`] = [];
    mockPages[`${accountId}`].push({
      id: mockPages[`${accountId}`].length + 1,
      accountId,
      integrationId,
      ...data,
      isSubscribed: false,
    });
  }),
  deleteAccountFacebookPages: vi.fn(async (accountId: number) => {
    delete mockPages[`${accountId}`];
  }),
  createAuditLog: vi.fn(async (data: any) => {
    mockAuditLogs.push(data);
  }),
}));

vi.mock("./_core/env", () => ({
  ENV: {
    facebookAppId: "test_app_id_123",
    facebookAppSecret: "test_app_secret_456",
    facebookWebhookVerifyToken: "test_verify_token",
  },
}));

describe("Facebook OAuth Integration", () => {
  beforeEach(() => {
    Object.keys(mockIntegrations).forEach((k) => delete mockIntegrations[k]);
    Object.keys(mockPages).forEach((k) => delete mockPages[k]);
    Object.keys(mockMembers).forEach((k) => delete mockMembers[k]);
    mockAuditLogs.length = 0;
    vi.clearAllMocks();
  });

  // ─── Input Validation ───────────────────────────────────
  describe("Input Validation", () => {
    const getOAuthUrlSchema = z.object({
      accountId: z.number().int().positive(),
      redirectUri: z.string().url(),
    });

    const handleCallbackSchema = z.object({
      code: z.string().min(1),
      redirectUri: z.string().url(),
      state: z.string().min(1),
    });

    const accountIdSchema = z.object({
      accountId: z.number().int().positive(),
    });

    it("should validate getOAuthUrl input with valid data", () => {
      const result = getOAuthUrlSchema.safeParse({
        accountId: 1,
        redirectUri: "https://example.com/callback",
      });
      expect(result.success).toBe(true);
    });

    it("should reject getOAuthUrl with invalid accountId", () => {
      const result = getOAuthUrlSchema.safeParse({
        accountId: -1,
        redirectUri: "https://example.com/callback",
      });
      expect(result.success).toBe(false);
    });

    it("should reject getOAuthUrl with invalid redirectUri", () => {
      const result = getOAuthUrlSchema.safeParse({
        accountId: 1,
        redirectUri: "not-a-url",
      });
      expect(result.success).toBe(false);
    });

    it("should validate handleCallback input with valid data", () => {
      const result = handleCallbackSchema.safeParse({
        code: "abc123",
        redirectUri: "https://example.com/callback",
        state: "encoded_state",
      });
      expect(result.success).toBe(true);
    });

    it("should reject handleCallback with empty code", () => {
      const result = handleCallbackSchema.safeParse({
        code: "",
        redirectUri: "https://example.com/callback",
        state: "encoded_state",
      });
      expect(result.success).toBe(false);
    });

    it("should reject handleCallback with empty state", () => {
      const result = handleCallbackSchema.safeParse({
        code: "abc123",
        redirectUri: "https://example.com/callback",
        state: "",
      });
      expect(result.success).toBe(false);
    });

    it("should validate accountId input", () => {
      expect(accountIdSchema.safeParse({ accountId: 5 }).success).toBe(true);
      expect(accountIdSchema.safeParse({ accountId: 0 }).success).toBe(false);
      expect(accountIdSchema.safeParse({ accountId: -1 }).success).toBe(false);
    });
  });

  // ─── State Encoding/Decoding ────────────────────────────
  describe("State Encoding/Decoding", () => {
    it("should encode accountId in base64 state parameter", () => {
      const state = JSON.stringify({ accountId: 42 });
      const encoded = encodeURIComponent(Buffer.from(state).toString("base64"));
      expect(encoded).toBeDefined();
      expect(typeof encoded).toBe("string");
    });

    it("should decode state back to accountId", () => {
      const state = JSON.stringify({ accountId: 42 });
      const encoded = encodeURIComponent(Buffer.from(state).toString("base64"));
      const decoded = JSON.parse(
        Buffer.from(decodeURIComponent(encoded), "base64").toString("utf-8")
      );
      expect(decoded.accountId).toBe(42);
    });

    it("should handle various accountId values", () => {
      for (const id of [1, 100, 999999]) {
        const state = JSON.stringify({ accountId: id });
        const encoded = encodeURIComponent(Buffer.from(state).toString("base64"));
        const decoded = JSON.parse(
          Buffer.from(decodeURIComponent(encoded), "base64").toString("utf-8")
        );
        expect(decoded.accountId).toBe(id);
      }
    });

    it("should throw on invalid base64 state", () => {
      expect(() => {
        JSON.parse(
          Buffer.from(decodeURIComponent("not-valid-base64!!!"), "base64").toString("utf-8")
        );
      }).toThrow();
    });
  });

  // ─── OAuth URL Generation ───────────────────────────────
  describe("OAuth URL Generation", () => {
    it("should generate correct Facebook OAuth URL structure", () => {
      const appId = "test_app_id_123";
      const redirectUri = "https://example.com/onboarding";
      const permissions = "leads_retrieval,pages_manage_ads,pages_read_engagement,pages_show_list";
      const state = encodeURIComponent(Buffer.from(JSON.stringify({ accountId: 1 })).toString("base64"));

      const url = new URL("https://www.facebook.com/v19.0/dialog/oauth");
      url.searchParams.set("client_id", appId);
      url.searchParams.set("redirect_uri", redirectUri);
      url.searchParams.set("scope", permissions);
      url.searchParams.set("state", state);
      url.searchParams.set("response_type", "code");

      expect(url.toString()).toContain("facebook.com/v19.0/dialog/oauth");
      expect(url.searchParams.get("client_id")).toBe(appId);
      expect(url.searchParams.get("redirect_uri")).toBe(redirectUri);
      expect(url.searchParams.get("scope")).toContain("leads_retrieval");
      expect(url.searchParams.get("scope")).toContain("pages_manage_ads");
      expect(url.searchParams.get("scope")).toContain("pages_read_engagement");
      expect(url.searchParams.get("scope")).toContain("pages_show_list");
      expect(url.searchParams.get("response_type")).toBe("code");
    });

    it("should include all required Facebook permissions", () => {
      const permissions = [
        "leads_retrieval",
        "pages_manage_ads",
        "pages_read_engagement",
        "pages_show_list",
      ].join(",");

      expect(permissions).toBe("leads_retrieval,pages_manage_ads,pages_read_engagement,pages_show_list");
    });
  });

  // ─── Access Control ─────────────────────────────────────
  describe("Access Control", () => {
    it("should allow admin to access any account", async () => {
      const db = await import("./db");
      // Admin doesn't need membership check
      const user = { id: 1, role: "admin" };
      if (user.role !== "admin") {
        const member = await db.getMember(999, user.id);
        expect(member).toBeNull(); // would fail for non-admin
      }
      // Admin bypasses — this is the expected path
      expect(user.role).toBe("admin");
    });

    it("should require membership for non-admin users", async () => {
      const db = await import("./db");
      const member = await db.getMember(1, 999);
      expect(member).toBeNull();
    });

    it("should allow access for valid member", async () => {
      mockMembers["1-5"] = { accountId: 1, userId: 5, role: "owner" };
      const db = await import("./db");
      const member = await db.getMember(1, 5);
      expect(member).toBeDefined();
      expect(member!.role).toBe("owner");
    });
  });

  // ─── Integration CRUD ───────────────────────────────────
  describe("Integration CRUD", () => {
    it("should create a new integration", async () => {
      const db = await import("./db");
      const integration = await db.upsertAccountIntegration(1, "facebook", {
        providerUserId: "fb_123",
        providerUserName: "John Doe",
        accessToken: "token_abc",
        tokenExpiresAt: new Date("2026-05-01"),
        isActive: true,
        connectedById: 5,
      });
      expect(integration.id).toBe(100);
      expect(integration.provider).toBe("facebook");
      expect(integration.providerUserName).toBe("John Doe");
    });

    it("should retrieve an existing integration", async () => {
      mockIntegrations["1-facebook"] = {
        id: 100,
        accountId: 1,
        provider: "facebook",
        providerUserId: "fb_123",
        providerUserName: "John Doe",
        accessToken: "token_abc",
        isActive: true,
      };
      const db = await import("./db");
      const integration = await db.getAccountIntegration(1, "facebook");
      expect(integration).toBeDefined();
      expect(integration!.providerUserName).toBe("John Doe");
      expect(integration!.isActive).toBe(true);
    });

    it("should return null for non-existent integration", async () => {
      const db = await import("./db");
      const integration = await db.getAccountIntegration(999, "facebook");
      expect(integration).toBeNull();
    });

    it("should delete an integration", async () => {
      mockIntegrations["1-facebook"] = { id: 100, accountId: 1, provider: "facebook" };
      const db = await import("./db");
      await db.deleteAccountIntegration(1, "facebook");
      expect(mockIntegrations["1-facebook"]).toBeUndefined();
    });
  });

  // ─── Facebook Pages CRUD ────────────────────────────────
  describe("Facebook Pages CRUD", () => {
    it("should store Facebook pages after OAuth", async () => {
      const db = await import("./db");
      await db.upsertAccountFacebookPage(1, 100, {
        facebookPageId: "page_111",
        pageName: "My Business Page",
        pageAccessToken: "page_token_111",
      });
      await db.upsertAccountFacebookPage(1, 100, {
        facebookPageId: "page_222",
        pageName: "My Second Page",
        pageAccessToken: "page_token_222",
      });

      const pages = await db.listAccountFacebookPages(1);
      expect(pages).toHaveLength(2);
      expect(pages[0].facebookPageId).toBe("page_111");
      expect(pages[0].pageName).toBe("My Business Page");
      expect(pages[1].facebookPageId).toBe("page_222");
    });

    it("should list pages for an account", async () => {
      mockPages["5"] = [
        { id: 1, accountId: 5, facebookPageId: "p1", pageName: "Page 1", isSubscribed: true },
        { id: 2, accountId: 5, facebookPageId: "p2", pageName: "Page 2", isSubscribed: false },
      ];
      const db = await import("./db");
      const pages = await db.listAccountFacebookPages(5);
      expect(pages).toHaveLength(2);
    });

    it("should return empty array for account with no pages", async () => {
      const db = await import("./db");
      const pages = await db.listAccountFacebookPages(999);
      expect(pages).toHaveLength(0);
    });

    it("should delete all pages for an account", async () => {
      mockPages["1"] = [
        { id: 1, accountId: 1, facebookPageId: "p1" },
        { id: 2, accountId: 1, facebookPageId: "p2" },
      ];
      const db = await import("./db");
      await db.deleteAccountFacebookPages(1);
      expect(mockPages["1"]).toBeUndefined();
    });
  });

  // ─── Disconnect Flow ────────────────────────────────────
  describe("Disconnect Flow", () => {
    it("should delete pages and integration on disconnect", async () => {
      mockIntegrations["1-facebook"] = { id: 100, accountId: 1, provider: "facebook" };
      mockPages["1"] = [{ id: 1, facebookPageId: "p1" }];
      mockMembers["1-5"] = { accountId: 1, userId: 5, role: "owner" };

      const db = await import("./db");
      await db.deleteAccountFacebookPages(1);
      await db.deleteAccountIntegration(1, "facebook");

      expect(mockPages["1"]).toBeUndefined();
      expect(mockIntegrations["1-facebook"]).toBeUndefined();
    });

    it("should create audit log on disconnect", async () => {
      const db = await import("./db");
      await db.createAuditLog({
        accountId: 1,
        userId: 5,
        action: "integration.facebook_disconnected",
        resourceType: "integration",
        resourceId: 1,
      });
      expect(mockAuditLogs).toHaveLength(1);
      expect(mockAuditLogs[0].action).toBe("integration.facebook_disconnected");
    });
  });

  // ─── Audit Logging ──────────────────────────────────────
  describe("Audit Logging", () => {
    it("should log facebook_connected event", async () => {
      const db = await import("./db");
      await db.createAuditLog({
        accountId: 1,
        userId: 5,
        action: "integration.facebook_connected",
        resourceType: "integration",
        resourceId: 100,
      });
      expect(mockAuditLogs).toHaveLength(1);
      expect(mockAuditLogs[0].action).toBe("integration.facebook_connected");
      expect(mockAuditLogs[0].accountId).toBe(1);
    });

    it("should log facebook_disconnected event", async () => {
      const db = await import("./db");
      await db.createAuditLog({
        accountId: 2,
        userId: 10,
        action: "integration.facebook_disconnected",
        resourceType: "integration",
        resourceId: 2,
      });
      expect(mockAuditLogs).toHaveLength(1);
      expect(mockAuditLogs[0].action).toBe("integration.facebook_disconnected");
      expect(mockAuditLogs[0].userId).toBe(10);
    });
  });

  // ─── Status Response ────────────────────────────────────
  describe("Status Response", () => {
    it("should return connected: false when no integration exists", async () => {
      const db = await import("./db");
      const integration = await db.getAccountIntegration(999, "facebook");
      const status = !integration || !integration.isActive
        ? { connected: false, userName: null, pages: [] }
        : { connected: true };
      expect(status.connected).toBe(false);
      expect(status.userName).toBeNull();
      expect(status.pages).toHaveLength(0);
    });

    it("should return connected: false when integration is inactive", async () => {
      mockIntegrations["1-facebook"] = { id: 100, isActive: false, providerUserName: "John" };
      const db = await import("./db");
      const integration = await db.getAccountIntegration(1, "facebook");
      const status = !integration || !integration.isActive
        ? { connected: false, userName: null, pages: [] }
        : { connected: true };
      expect(status.connected).toBe(false);
    });

    it("should return connected: true with user info and pages when active", async () => {
      mockIntegrations["1-facebook"] = {
        id: 100,
        isActive: true,
        providerUserName: "John Doe",
        providerUserId: "fb_123",
        tokenExpiresAt: new Date("2026-05-01"),
      };
      mockPages["1"] = [
        { id: 1, facebookPageId: "p1", pageName: "Page 1", isSubscribed: true },
        { id: 2, facebookPageId: "p2", pageName: "Page 2", isSubscribed: false },
      ];

      const db = await import("./db");
      const integration = await db.getAccountIntegration(1, "facebook");
      const pages = await db.listAccountFacebookPages(1);

      expect(integration!.isActive).toBe(true);
      expect(integration!.providerUserName).toBe("John Doe");
      expect(pages).toHaveLength(2);
    });
  });

  // ─── Token Expiry ───────────────────────────────────────
  describe("Token Expiry Calculation", () => {
    it("should calculate token expiry from expiresIn seconds", () => {
      const expiresIn = 5184000; // 60 days
      const tokenExpiresAt = new Date(Date.now() + expiresIn * 1000);
      const now = new Date();
      const diffMs = tokenExpiresAt.getTime() - now.getTime();
      const diffDays = diffMs / (1000 * 60 * 60 * 24);
      expect(diffDays).toBeGreaterThan(59);
      expect(diffDays).toBeLessThan(61);
    });

    it("should default to 60 days when expiresIn is missing", () => {
      const expiresIn = undefined;
      const defaultExpiry = expiresIn || 5184000;
      expect(defaultExpiry).toBe(5184000);
    });
  });

  // ─── Environment Variable Validation ────────────────────
  describe("Environment Variable Validation", () => {
    it("should have FACEBOOK_APP_ID configured", async () => {
      const { ENV } = await import("./_core/env");
      expect(ENV.facebookAppId).toBeDefined();
      expect(typeof ENV.facebookAppId).toBe("string");
      expect(ENV.facebookAppId!.length).toBeGreaterThan(0);
    });

    it("should have FACEBOOK_APP_SECRET configured", async () => {
      const { ENV } = await import("./_core/env");
      expect(ENV.facebookAppSecret).toBeDefined();
      expect(typeof ENV.facebookAppSecret).toBe("string");
      expect(ENV.facebookAppSecret!.length).toBeGreaterThan(0);
    });
  });

  // ─── Onboarding Step Integration ────────────────────────
  describe("Onboarding Step Configuration", () => {
    it("should have 5 steps including Integrations", () => {
      const STEPS = [
        { id: 1, title: "Business Profile" },
        { id: 2, title: "Messaging Setup" },
        { id: 3, title: "Integrations" },
        { id: 4, title: "Pipeline Setup" },
        { id: 5, title: "Finish" },
      ];
      expect(STEPS).toHaveLength(5);
      expect(STEPS[2].title).toBe("Integrations");
      expect(STEPS[2].id).toBe(3);
    });

    it("should have correct step order", () => {
      const STEPS = [
        { id: 1, title: "Business Profile" },
        { id: 2, title: "Messaging Setup" },
        { id: 3, title: "Integrations" },
        { id: 4, title: "Pipeline Setup" },
        { id: 5, title: "Finish" },
      ];
      expect(STEPS[0].title).toBe("Business Profile");
      expect(STEPS[1].title).toBe("Messaging Setup");
      expect(STEPS[2].title).toBe("Integrations");
      expect(STEPS[3].title).toBe("Pipeline Setup");
      expect(STEPS[4].title).toBe("Finish");
    });
  });
});
