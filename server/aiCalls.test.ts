import { describe, expect, it, vi, beforeEach } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

// ─── Mock DB helpers ───
vi.mock("./db", async () => {
  const actual = await vi.importActual("./db");
  return {
    ...actual,
    getMember: vi.fn(),
    getAccountById: vi.fn(),
    getContactById: vi.fn(),
    createAICall: vi.fn(),
    updateAICall: vi.fn(),
    getAICallById: vi.fn(),
    listAICalls: vi.fn(),
    getAICallStats: vi.fn(),
    getAICallsByContact: vi.fn(),
    deleteAICall: vi.fn(),
    logContactActivity: vi.fn(),
    getAccountMessagingSettings: vi.fn(),
    getDb: vi.fn().mockResolvedValue(null),
  };
});

// ─── Mock VAPI service ───
vi.mock("./services/vapi", () => ({
  createVapiCall: vi.fn().mockResolvedValue({
    id: "vapi-call-123",
    status: "queued",
    phoneNumber: { number: "+15551234567" },
  }),
  getVapiCall: vi.fn(),
  resolveAssistantId: vi.fn().mockReturnValue("default-assistant-id"),
  mapVapiStatus: vi.fn().mockReturnValue("queued"),
  mapVapiEndedReason: vi.fn(),
  VapiApiError: class VapiApiError extends Error {
    statusCode: number;
    responseBody: string;
    constructor(msg: string, code: number, body: string) {
      super(msg);
      this.statusCode = code;
      this.responseBody = body;
    }
  },
}));

// ─── Mock usageTracker ───
vi.mock("./services/usageTracker", () => ({
  chargeBeforeSend: vi.fn().mockResolvedValue({
    usageEventId: 500,
    unitCost: 0.10,
    totalCost: 0.30,
    newBalance: 4.70,
  }),
  reverseCharge: vi.fn().mockResolvedValue(undefined),
}));

// ─── Mock messageQueue ───
vi.mock("./services/messageQueue", () => ({
  enqueueMessage: vi.fn().mockResolvedValue({ id: 1 }),
}));

// ─── Mock businessHours ───
vi.mock("./utils/businessHours", () => ({
  isWithinBusinessHours: vi.fn().mockReturnValue(true),
  getBusinessHoursBlockMessage: vi.fn().mockReturnValue("Outside business hours"),
  BUSINESS_HOURS: { start: 7, end: 22, timezone: "America/New_York" },
}));

import {
  getMember,
  getAccountById,
  getContactById,
  createAICall,
  updateAICall,
  getAccountMessagingSettings,
} from "./db";
import { createVapiCall, resolveAssistantId } from "./services/vapi";
import { chargeBeforeSend, reverseCharge } from "./services/usageTracker";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createMockContext(overrides?: Partial<AuthenticatedUser>): TrpcContext {
  const user: AuthenticatedUser = {
    id: 1,
    openId: "test-user",
    email: "test@example.com",
    name: "Test User",
    loginMethod: "manus",
    role: "user",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
    ...overrides,
  };
  return {
    user,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: () => {} } as TrpcContext["res"],
  };
}

function createAdminContext(): TrpcContext {
  return createMockContext({ role: "admin" });
}

function createUnauthContext(): TrpcContext {
  return {
    user: null,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: () => {} } as TrpcContext["res"],
  };
}

describe("aiCalls router", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Default mocks: admin context bypasses membership check
    (getAccountById as any).mockResolvedValue({
      id: 1,
      name: "Test Account",
      businessHoursConfig: null,
    });
    (getContactById as any).mockResolvedValue({
      id: 10,
      accountId: 1,
      firstName: "John",
      lastName: "Doe",
      phone: "+15551234567",
      leadSource: "website",
    });
    (createAICall as any).mockResolvedValue({ id: 100 });
    (updateAICall as any).mockResolvedValue(undefined);
  });

  describe("structure", () => {
    it("has all expected procedures", () => {
      const router = appRouter._def.procedures;
      expect(router).toHaveProperty("aiCalls.start");
      expect(router).toHaveProperty("aiCalls.bulkStart");
      expect(router).toHaveProperty("aiCalls.list");
      expect(router).toHaveProperty("aiCalls.get");
      expect(router).toHaveProperty("aiCalls.updateStatus");
      expect(router).toHaveProperty("aiCalls.stats");
    });
  });

  describe("authentication", () => {
    it("rejects unauthenticated users on start", async () => {
      const ctx = createUnauthContext();
      const caller = appRouter.createCaller(ctx);
      await expect(
        caller.aiCalls.start({ accountId: 1, contactId: 1 })
      ).rejects.toThrow();
    });

    it("rejects unauthenticated users on list", async () => {
      const ctx = createUnauthContext();
      const caller = appRouter.createCaller(ctx);
      await expect(
        caller.aiCalls.list({ accountId: 1 })
      ).rejects.toThrow();
    });

    it("rejects unauthenticated users on bulkStart", async () => {
      const ctx = createUnauthContext();
      const caller = appRouter.createCaller(ctx);
      await expect(
        caller.aiCalls.bulkStart({ accountId: 1, contactIds: [1, 2] })
      ).rejects.toThrow();
    });

    it("rejects unauthenticated users on stats", async () => {
      const ctx = createUnauthContext();
      const caller = appRouter.createCaller(ctx);
      await expect(
        caller.aiCalls.stats({ accountId: 1 })
      ).rejects.toThrow();
    });
  });

  describe("input validation", () => {
    it("requires accountId on start", async () => {
      const ctx = createAdminContext();
      const caller = appRouter.createCaller(ctx);
      await expect(
        // @ts-expect-error - testing missing field
        caller.aiCalls.start({ contactId: 1 })
      ).rejects.toThrow();
    });

    it("requires contactId on start", async () => {
      const ctx = createAdminContext();
      const caller = appRouter.createCaller(ctx);
      await expect(
        // @ts-expect-error - testing missing field
        caller.aiCalls.start({ accountId: 1 })
      ).rejects.toThrow();
    });

    it("requires contactIds array on bulkStart", async () => {
      const ctx = createAdminContext();
      const caller = appRouter.createCaller(ctx);
      await expect(
        // @ts-expect-error - testing missing field
        caller.aiCalls.bulkStart({ accountId: 1 })
      ).rejects.toThrow();
    });

    it("requires accountId on list", async () => {
      const ctx = createAdminContext();
      const caller = appRouter.createCaller(ctx);
      await expect(
        // @ts-expect-error - testing missing field
        caller.aiCalls.list({})
      ).rejects.toThrow();
    });

    it("validates status enum on updateStatus", async () => {
      const ctx = createAdminContext();
      const caller = appRouter.createCaller(ctx);
      await expect(
        caller.aiCalls.updateStatus({
          callId: 1,
          accountId: 1,
          status: "invalid_status" as any,
        })
      ).rejects.toThrow();
    });
  });

  // ─── Per-account VAPI config tests ───
  describe("per-account VAPI config", () => {
    it("uses account VAPI config when present", async () => {
      (getAccountMessagingSettings as any).mockResolvedValue({
        vapiApiKey: "acct-vapi-key-xyz",
        vapiPhoneNumberId: "acct-phone-id-abc",
        vapiAssistantIdOverride: "acct-assistant-override",
      });

      const ctx = createAdminContext();
      const caller = appRouter.createCaller(ctx);
      const result = await caller.aiCalls.start({ accountId: 1, contactId: 10 });

      expect(result.success).toBe(true);
      expect(createVapiCall).toHaveBeenCalledWith(
        expect.objectContaining({
          apiKey: "acct-vapi-key-xyz",
          phoneNumberId: "acct-phone-id-abc",
          assistantId: "acct-assistant-override",
        })
      );
      // resolveAssistantId should NOT be called when override is set
      expect(resolveAssistantId).not.toHaveBeenCalled();
    });

    it("falls back to ENV when account has no VAPI config", async () => {
      (getAccountMessagingSettings as any).mockResolvedValue(null);

      const ctx = createAdminContext();
      const caller = appRouter.createCaller(ctx);
      const result = await caller.aiCalls.start({ accountId: 1, contactId: 10 });

      expect(result.success).toBe(true);
      // Should use resolveAssistantId (lead-source-based) since no override
      expect(resolveAssistantId).toHaveBeenCalledWith("website");
      // apiKey should be ENV default (non-empty since ENV.vapiApiKey is set in test env)
      expect(createVapiCall).toHaveBeenCalledWith(
        expect.objectContaining({
          phoneNumberId: undefined, // no account override, falls back to VAPI_PHONE_NUMBER_ID_FALLBACK inside vapi.ts
        })
      );
    });

    it("throws PRECONDITION_FAILED when neither account nor ENV has VAPI key", async () => {
      // Mock account settings with no vapiApiKey
      (getAccountMessagingSettings as any).mockResolvedValue({
        vapiApiKey: null,
        vapiPhoneNumberId: null,
        vapiAssistantIdOverride: null,
      });

      // We need to also mock ENV.vapiApiKey to be empty
      // Since ENV is imported at module level, we mock the entire env module
      const envModule = await import("./_core/env");
      const originalVapiApiKey = envModule.ENV.vapiApiKey;
      envModule.ENV.vapiApiKey = "";

      try {
        const ctx = createAdminContext();
        const caller = appRouter.createCaller(ctx);
        await expect(
          caller.aiCalls.start({ accountId: 1, contactId: 10 })
        ).rejects.toThrow("VAPI API key is not configured");
      } finally {
        // Restore
        envModule.ENV.vapiApiKey = originalVapiApiKey;
      }
    });

    it("uses account assistant override instead of lead-source routing", async () => {
      (getAccountMessagingSettings as any).mockResolvedValue({
        vapiApiKey: "acct-key",
        vapiPhoneNumberId: null,
        vapiAssistantIdOverride: "custom-assistant-123",
      });

      const ctx = createAdminContext();
      const caller = appRouter.createCaller(ctx);
      await caller.aiCalls.start({ accountId: 1, contactId: 10 });

      expect(createVapiCall).toHaveBeenCalledWith(
        expect.objectContaining({
          assistantId: "custom-assistant-123",
        })
      );
    });

    it("uses lead-source routing when no assistant override", async () => {
      (getAccountMessagingSettings as any).mockResolvedValue({
        vapiApiKey: "acct-key",
        vapiPhoneNumberId: "phone-id",
        vapiAssistantIdOverride: null,
      });

      const ctx = createAdminContext();
      const caller = appRouter.createCaller(ctx);
      await caller.aiCalls.start({ accountId: 1, contactId: 10 });

      expect(resolveAssistantId).toHaveBeenCalledWith("website");
      expect(createVapiCall).toHaveBeenCalledWith(
        expect.objectContaining({
          assistantId: "default-assistant-id", // from mocked resolveAssistantId
        })
      );
    });

    it("passes account VAPI config through bulkStart", async () => {
      (getAccountMessagingSettings as any).mockResolvedValue({
        vapiApiKey: "bulk-acct-key",
        vapiPhoneNumberId: "bulk-phone-id",
        vapiAssistantIdOverride: null,
      });

      const ctx = createAdminContext();
      const caller = appRouter.createCaller(ctx);
      const result = await caller.aiCalls.bulkStart({
        accountId: 1,
        contactIds: [10],
      });

      expect(result.successCount).toBe(1);
      expect(createVapiCall).toHaveBeenCalledWith(
        expect.objectContaining({
          apiKey: "bulk-acct-key",
          phoneNumberId: "bulk-phone-id",
        })
      );
    });
  });

  describe("regular user access", () => {
    it("regular user is blocked from starting call without membership", async () => {
      const ctx = createMockContext();
      const caller = appRouter.createCaller(ctx);
      await expect(
        caller.aiCalls.start({ accountId: 999, contactId: 1 })
      ).rejects.toThrow();
    });

    it("regular user is blocked from listing calls without membership", async () => {
      const ctx = createMockContext();
      const caller = appRouter.createCaller(ctx);
      await expect(
        caller.aiCalls.list({ accountId: 999 })
      ).rejects.toThrow();
    });

    it("regular user is blocked from bulk start without membership", async () => {
      const ctx = createMockContext();
      const caller = appRouter.createCaller(ctx);
      await expect(
        caller.aiCalls.bulkStart({ accountId: 999, contactIds: [1, 2] })
      ).rejects.toThrow();
    });
  });
});
