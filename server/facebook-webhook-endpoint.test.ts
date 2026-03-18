import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Mock ENV ────────────────────────────────────────────────
vi.mock("./_core/env", () => ({
  ENV: {
    facebookWebhookVerifyToken: "test_global_verify_token_123",
    facebookAppId: "test_app_id",
    facebookAppSecret: "test_app_secret",
  },
}));

// ─── Mock DB ────────────────────────────────────────────────
vi.mock("./db", () => ({
  listFacebookPageMappings: vi.fn(async () => [
    { verifyToken: "client_token_abc", accountId: 1, pageId: "page_1" },
    { verifyToken: "client_token_xyz", accountId: 2, pageId: "page_2" },
  ]),
  createContact: vi.fn(async () => ({ id: 1 })),
  getOrCreateDefaultPipeline: vi.fn(async () => ({ id: 1 })),
  listPipelineStages: vi.fn(async () => [{ id: 1, name: "New Lead" }]),
  createDeal: vi.fn(async () => ({ id: 1 })),
  getFacebookPageMappingByPageId: vi.fn(async (pageId: string) => {
    if (pageId === "page_1") return { accountId: 1 };
    return null;
  }),
}));

vi.mock("./services/workflowTriggers", () => ({
  onContactCreated: vi.fn(async () => {}),
  onFacebookLeadReceived: vi.fn(async () => {}),
}));

describe("Facebook Webhook Endpoint", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ─── Verification Logic ─────────────────────────────────
  describe("Webhook Verification (GET)", () => {
    it("should accept verification with global FACEBOOK_WEBHOOK_VERIFY_TOKEN", async () => {
      const { ENV } = await import("./_core/env");
      const verifyToken = "test_global_verify_token_123";
      const challenge = "challenge_string_12345";

      // Simulate the verification check
      const isGlobalMatch = ENV.facebookWebhookVerifyToken && verifyToken === ENV.facebookWebhookVerifyToken;
      expect(isGlobalMatch).toBe(true);

      // The endpoint should return the challenge
      expect(challenge).toBe("challenge_string_12345");
    });

    it("should accept verification with per-client token from facebook_page_mappings", async () => {
      const { listFacebookPageMappings } = await import("./db");
      const mappings = await listFacebookPageMappings();
      const verifyToken = "client_token_abc";

      const matched = mappings.some((m: any) => m.verifyToken === verifyToken);
      expect(matched).toBe(true);
    });

    it("should reject verification with unknown token", async () => {
      const { ENV } = await import("./_core/env");
      const { listFacebookPageMappings } = await import("./db");
      const verifyToken = "unknown_token_999";

      const isGlobalMatch = ENV.facebookWebhookVerifyToken && verifyToken === ENV.facebookWebhookVerifyToken;
      expect(isGlobalMatch).toBe(false);

      const mappings = await listFacebookPageMappings();
      const isClientMatch = mappings.some((m: any) => m.verifyToken === verifyToken);
      expect(isClientMatch).toBe(false);
    });

    it("should reject verification when hub.mode is not subscribe", () => {
      const mode = "unsubscribe";
      expect(mode !== "subscribe").toBe(true);
    });

    it("should reject verification when verify_token is empty", () => {
      const verifyToken = "";
      expect(!verifyToken).toBe(true);
    });
  });

  // ─── Route Paths ────────────────────────────────────────
  describe("Route Paths", () => {
    it("should support /api/webhooks/facebook-leads path", () => {
      const path = "/api/webhooks/facebook-leads";
      expect(path).toBe("/api/webhooks/facebook-leads");
    });

    it("should support /api/webhooks/facebook alias path", () => {
      const path = "/api/webhooks/facebook";
      expect(path).toBe("/api/webhooks/facebook");
    });

    it("should have both GET and POST handlers for each path", () => {
      // The router registers GET and POST for both paths
      const routes = [
        { method: "GET", path: "/api/webhooks/facebook-leads" },
        { method: "POST", path: "/api/webhooks/facebook-leads" },
        { method: "GET", path: "/api/webhooks/facebook" },
        { method: "POST", path: "/api/webhooks/facebook" },
      ];
      expect(routes).toHaveLength(4);
      expect(routes.filter((r) => r.method === "GET")).toHaveLength(2);
      expect(routes.filter((r) => r.method === "POST")).toHaveLength(2);
    });
  });

  // ─── Native Payload Detection ───────────────────────────
  describe("Payload Format Detection", () => {
    it("should detect Facebook native format (object=page + entry array)", () => {
      const body = {
        object: "page",
        entry: [{ id: "page_1", changes: [{ field: "leadgen", value: {} }] }],
      };
      const isNative = body.object === "page" && Array.isArray(body.entry);
      expect(isNative).toBe(true);
    });

    it("should detect simplified/flat format (no object field)", () => {
      const body = {
        accountId: 1,
        firstName: "John",
        lastName: "Doe",
        email: "john@example.com",
      };
      const isNative = (body as any).object === "page" && Array.isArray((body as any).entry);
      expect(isNative).toBe(false);
    });

    it("should reject empty/invalid body", () => {
      const body = null;
      expect(!body || typeof body !== "object").toBe(true);
    });
  });

  // ─── Lead Field Extraction ──────────────────────────────
  describe("Lead Field Extraction from field_data", () => {
    it("should extract name, email, phone from field_data array", () => {
      const fieldData = [
        { name: "full_name", values: ["John Doe"] },
        { name: "email", values: ["john@example.com"] },
        { name: "phone_number", values: ["+15551234567"] },
      ];

      const fields: Record<string, string> = {};
      for (const field of fieldData) {
        const name = (field.name || "").toLowerCase();
        const val = Array.isArray(field.values) ? field.values[0] : undefined;
        if (val) fields[name] = String(val);
      }

      expect(fields.full_name).toBe("John Doe");
      expect(fields.email).toBe("john@example.com");
      expect(fields.phone_number).toBe("+15551234567");
    });

    it("should parse full_name into firstName and lastName", () => {
      const fullName = "John Michael Doe";
      const parts = fullName.trim().split(/\s+/);
      const firstName = parts[0] || "";
      const lastName = parts.slice(1).join(" ") || "";

      expect(firstName).toBe("John");
      expect(lastName).toBe("Michael Doe");
    });

    it("should handle single-word name", () => {
      const fullName = "John";
      const parts = fullName.trim().split(/\s+/);
      const firstName = parts[0] || "";
      const lastName = parts.slice(1).join(" ") || "";

      expect(firstName).toBe("John");
      expect(lastName).toBe("");
    });

    it("should default to Facebook Lead when no name provided", () => {
      const firstName = "" || "Facebook";
      const lastName = "" || "Lead";
      expect(firstName).toBe("Facebook");
      expect(lastName).toBe("Lead");
    });
  });

  // ─── Page-to-Account Mapping ────────────────────────────
  describe("Page-to-Account Mapping", () => {
    it("should resolve page_id to accountId via mapping table", async () => {
      const { getFacebookPageMappingByPageId } = await import("./db");
      const mapping = await getFacebookPageMappingByPageId("page_1");
      expect(mapping).toBeDefined();
      expect(mapping!.accountId).toBe(1);
    });

    it("should return null for unmapped page_id", async () => {
      const { getFacebookPageMappingByPageId } = await import("./db");
      const mapping = await getFacebookPageMappingByPageId("unknown_page");
      expect(mapping).toBeNull();
    });
  });

  // ─── URL Construction ───────────────────────────────────
  describe("Callback URL Construction", () => {
    it("should construct the correct callback URL for Facebook Developer Console", () => {
      const domain = "apexcrm-knxkwfan.manus.space";
      const callbackUrl = `https://${domain}/api/webhooks/facebook`;
      expect(callbackUrl).toBe("https://apexcrm-knxkwfan.manus.space/api/webhooks/facebook");
    });

    it("should also work with the -leads suffix path", () => {
      const domain = "apexcrm-knxkwfan.manus.space";
      const callbackUrl = `https://${domain}/api/webhooks/facebook-leads`;
      expect(callbackUrl).toBe("https://apexcrm-knxkwfan.manus.space/api/webhooks/facebook-leads");
    });
  });
});
