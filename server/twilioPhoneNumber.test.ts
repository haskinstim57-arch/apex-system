import { describe, expect, it, vi, beforeEach } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

// Mock the db functions used by the router
vi.mock("./db", async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return {
    ...actual,
    getMember: vi.fn(),
    getAccountMessagingSettings: vi.fn(),
    upsertAccountMessagingSettings: vi.fn(),
    getAccountById: vi.fn(),
  };
});

// Mock the twilio module
vi.mock("twilio", () => {
  const mockCreate = vi.fn();
  const mockRemove = vi.fn();
  const mockList = vi.fn();
  const mockIncomingPhoneNumbers = vi.fn((sid: string) => ({
    remove: mockRemove,
  }));
  (mockIncomingPhoneNumbers as any).create = mockCreate;

  const mockAvailablePhoneNumbers = vi.fn(() => ({
    local: { list: mockList },
  }));

  const mockClient = {
    incomingPhoneNumbers: mockIncomingPhoneNumbers,
    availablePhoneNumbers: mockAvailablePhoneNumbers,
  };

  return {
    default: vi.fn(() => mockClient),
    __mockClient: mockClient,
    __mockCreate: mockCreate,
    __mockRemove: mockRemove,
    __mockList: mockList,
  };
});

import {
  getMember,
  getAccountMessagingSettings,
  upsertAccountMessagingSettings,
} from "./db";

// Access mock functions from twilio mock
const twilioMock = await import("twilio");
const mockList = (twilioMock as any).__mockList as ReturnType<typeof vi.fn>;
const mockCreate = (twilioMock as any).__mockCreate as ReturnType<typeof vi.fn>;
const mockRemove = (twilioMock as any).__mockRemove as ReturnType<typeof vi.fn>;

const mockGetMember = getMember as ReturnType<typeof vi.fn>;
const mockGetSettings = getAccountMessagingSettings as ReturnType<typeof vi.fn>;
const mockUpsertSettings = upsertAccountMessagingSettings as ReturnType<typeof vi.fn>;

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createAuthContext(role: "admin" | "user" = "user"): TrpcContext {
  const user: AuthenticatedUser = {
    id: 1,
    openId: "test-user",
    email: "test@example.com",
    name: "Test User",
    loginMethod: "manus",
    role,
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };

  return {
    user,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: vi.fn() } as unknown as TrpcContext["res"],
  };
}

const ACCOUNT_ID = 100;

describe("twilioPhoneNumber", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: user is an owner of the account
    mockGetMember.mockResolvedValue({
      userId: 1,
      accountId: ACCOUNT_ID,
      role: "owner",
      isActive: true,
    });
    // Default: Twilio env vars are set
    process.env.TWILIO_ACCOUNT_SID = "ACtest123";
    process.env.TWILIO_AUTH_TOKEN = "testtoken123";
    process.env.TWILIO_FROM_NUMBER = "+15551234567";
  });

  describe("getAssigned", () => {
    it("returns hasNumber: false when no number is assigned", async () => {
      mockGetSettings.mockResolvedValue(null);

      const ctx = createAuthContext();
      const caller = appRouter.createCaller(ctx);
      const result = await caller.twilioPhoneNumber.getAssigned({ accountId: ACCOUNT_ID });

      expect(result).toEqual({
        hasNumber: false,
        phoneNumber: null,
        phoneSid: null,
      });
    });

    it("returns the assigned number when one exists", async () => {
      mockGetSettings.mockResolvedValue({
        twilioFromNumber: "+13055551234",
        twilioPhoneSid: "PN123abc",
      });

      const ctx = createAuthContext();
      const caller = appRouter.createCaller(ctx);
      const result = await caller.twilioPhoneNumber.getAssigned({ accountId: ACCOUNT_ID });

      expect(result).toEqual({
        hasNumber: true,
        phoneNumber: "+13055551234",
        phoneSid: "PN123abc",
      });
    });

    it("rejects non-owner access", async () => {
      mockGetMember.mockResolvedValue({
        userId: 1,
        accountId: ACCOUNT_ID,
        role: "employee",
        isActive: true,
      });

      const ctx = createAuthContext();
      const caller = appRouter.createCaller(ctx);

      await expect(
        caller.twilioPhoneNumber.getAssigned({ accountId: ACCOUNT_ID })
      ).rejects.toThrow("Only account owners can manage phone numbers");
    });

    it("allows admin access", async () => {
      mockGetMember.mockResolvedValue(null);
      mockGetSettings.mockResolvedValue(null);

      const ctx = createAuthContext("admin");
      const caller = appRouter.createCaller(ctx);
      const result = await caller.twilioPhoneNumber.getAssigned({ accountId: ACCOUNT_ID });

      expect(result.hasNumber).toBe(false);
    });
  });

  describe("searchAvailable", () => {
    it("searches by area code", async () => {
      mockGetSettings.mockResolvedValue(null); // No per-account creds, use global
      mockList.mockResolvedValue([
        {
          phoneNumber: "+13055551111",
          friendlyName: "(305) 555-1111",
          locality: "Miami",
          region: "FL",
          postalCode: "33101",
          isoCountry: "US",
          capabilities: { sms: true, voice: true, mms: true },
        },
        {
          phoneNumber: "+13055552222",
          friendlyName: "(305) 555-2222",
          locality: "Miami",
          region: "FL",
          postalCode: "33102",
          isoCountry: "US",
          capabilities: { sms: true, voice: true, mms: false },
        },
      ]);

      const ctx = createAuthContext();
      const caller = appRouter.createCaller(ctx);
      const result = await caller.twilioPhoneNumber.searchAvailable({
        accountId: ACCOUNT_ID,
        areaCode: "305",
      });

      expect(result).toHaveLength(2);
      expect(result[0].phoneNumber).toBe("+13055551111");
      expect(result[0].locality).toBe("Miami");
      expect(result[0].monthlyCost).toBe(1.15);
      expect(result[0].capabilities.sms).toBe(true);
    });

    it("searches by location", async () => {
      mockGetSettings.mockResolvedValue(null);
      mockList.mockResolvedValue([]);

      const ctx = createAuthContext();
      const caller = appRouter.createCaller(ctx);
      const result = await caller.twilioPhoneNumber.searchAvailable({
        accountId: ACCOUNT_ID,
        locality: "Austin",
        state: "TX",
      });

      expect(result).toEqual([]);
      expect(mockList).toHaveBeenCalled();
    });
  });

  describe("purchase", () => {
    it("purchases a number and stores it on the account", async () => {
      mockGetSettings.mockResolvedValue(null); // No existing number
      mockCreate.mockResolvedValue({
        phoneNumber: "+13055551111",
        sid: "PNabc123",
      });
      mockUpsertSettings.mockResolvedValue({ id: 1 });

      const ctx = createAuthContext();
      const caller = appRouter.createCaller(ctx);
      const result = await caller.twilioPhoneNumber.purchase({
        accountId: ACCOUNT_ID,
        phoneNumber: "+13055551111",
        appUrl: "https://example.com",
      });

      expect(result.success).toBe(true);
      expect(result.phoneNumber).toBe("+13055551111");
      expect(result.phoneSid).toBe("PNabc123");
      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          phoneNumber: "+13055551111",
          smsUrl: "https://example.com/api/webhooks/twilio/inbound",
          statusCallback: "https://example.com/api/webhooks/twilio/voice-status",
        })
      );
      expect(mockUpsertSettings).toHaveBeenCalledWith(ACCOUNT_ID, {
        twilioFromNumber: "+13055551111",
        twilioPhoneSid: "PNabc123",
      });
    });

    it("rejects purchase when account already has a number", async () => {
      mockGetSettings.mockResolvedValue({
        twilioFromNumber: "+15551234567",
        twilioPhoneSid: "PNexisting",
      });

      const ctx = createAuthContext();
      const caller = appRouter.createCaller(ctx);

      await expect(
        caller.twilioPhoneNumber.purchase({
          accountId: ACCOUNT_ID,
          phoneNumber: "+13055551111",
          appUrl: "https://example.com",
        })
      ).rejects.toThrow("already has a phone number");
    });
  });

  describe("release", () => {
    it("releases a number and clears it from the account", async () => {
      mockGetSettings.mockResolvedValue({
        twilioFromNumber: "+13055551111",
        twilioPhoneSid: "PNabc123",
      });
      mockRemove.mockResolvedValue(undefined);
      mockUpsertSettings.mockResolvedValue({ id: 1 });

      const ctx = createAuthContext();
      const caller = appRouter.createCaller(ctx);
      const result = await caller.twilioPhoneNumber.release({ accountId: ACCOUNT_ID });

      expect(result.success).toBe(true);
      expect(result.released).toBe("+13055551111");
      expect(mockUpsertSettings).toHaveBeenCalledWith(ACCOUNT_ID, {
        twilioFromNumber: null,
        twilioPhoneSid: null,
      });
    });

    it("rejects release when no number is assigned", async () => {
      mockGetSettings.mockResolvedValue(null);

      const ctx = createAuthContext();
      const caller = appRouter.createCaller(ctx);

      await expect(
        caller.twilioPhoneNumber.release({ accountId: ACCOUNT_ID })
      ).rejects.toThrow("No phone number is assigned");
    });

    it("clears number locally even if no SID is stored", async () => {
      mockGetSettings.mockResolvedValue({
        twilioFromNumber: "+13055551111",
        twilioPhoneSid: null,
      });
      mockUpsertSettings.mockResolvedValue({ id: 1 });

      const ctx = createAuthContext();
      const caller = appRouter.createCaller(ctx);
      const result = await caller.twilioPhoneNumber.release({ accountId: ACCOUNT_ID });

      expect(result.success).toBe(true);
      expect(mockRemove).not.toHaveBeenCalled(); // No SID, so no Twilio API call
    });
  });
});
