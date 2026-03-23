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
    createPortRequest: vi.fn(),
    getPortRequestsByAccount: vi.fn(),
    getPortRequestById: vi.fn(),
    updatePortRequest: vi.fn(),
  };
});

// Mock the twilio module
vi.mock("twilio", () => {
  const mockCreate = vi.fn();
  const mockRemove = vi.fn();
  const mockLocalList = vi.fn();
  const mockTollFreeList = vi.fn();
  const mockUsageList = vi.fn();
  const mockIncomingPhoneNumbers = vi.fn((sid: string) => ({
    remove: mockRemove,
  }));
  (mockIncomingPhoneNumbers as any).create = mockCreate;

  const mockAvailablePhoneNumbers = vi.fn(() => ({
    local: { list: mockLocalList },
    tollFree: { list: mockTollFreeList },
  }));

  const mockClient = {
    incomingPhoneNumbers: mockIncomingPhoneNumbers,
    availablePhoneNumbers: mockAvailablePhoneNumbers,
    usage: {
      records: {
        list: mockUsageList,
      },
    },
  };

  return {
    default: vi.fn(() => mockClient),
    __mockClient: mockClient,
    __mockCreate: mockCreate,
    __mockRemove: mockRemove,
    __mockLocalList: mockLocalList,
    __mockTollFreeList: mockTollFreeList,
    __mockUsageList: mockUsageList,
  };
});

import {
  getMember,
  getAccountMessagingSettings,
  upsertAccountMessagingSettings,
  createPortRequest,
  getPortRequestsByAccount,
  getPortRequestById,
  updatePortRequest,
} from "./db";

// Access mock functions from twilio mock
const twilioMock = await import("twilio");
const mockLocalList = (twilioMock as any).__mockLocalList as ReturnType<typeof vi.fn>;
const mockTollFreeList = (twilioMock as any).__mockTollFreeList as ReturnType<typeof vi.fn>;
const mockCreate = (twilioMock as any).__mockCreate as ReturnType<typeof vi.fn>;
const mockRemove = (twilioMock as any).__mockRemove as ReturnType<typeof vi.fn>;
const mockUsageList = (twilioMock as any).__mockUsageList as ReturnType<typeof vi.fn>;

const mockGetMember = getMember as ReturnType<typeof vi.fn>;
const mockGetSettings = getAccountMessagingSettings as ReturnType<typeof vi.fn>;
const mockUpsertSettings = upsertAccountMessagingSettings as ReturnType<typeof vi.fn>;
const mockCreatePortRequest = createPortRequest as ReturnType<typeof vi.fn>;
const mockGetPortRequests = getPortRequestsByAccount as ReturnType<typeof vi.fn>;
const mockGetPortRequestById = getPortRequestById as ReturnType<typeof vi.fn>;
const mockUpdatePortRequest = updatePortRequest as ReturnType<typeof vi.fn>;

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
    it("searches local numbers by area code", async () => {
      mockGetSettings.mockResolvedValue(null);
      mockLocalList.mockResolvedValue([
        {
          phoneNumber: "+13055551111",
          friendlyName: "(305) 555-1111",
          locality: "Miami",
          region: "FL",
          postalCode: "33101",
          isoCountry: "US",
          capabilities: { sms: true, voice: true, mms: true },
        },
      ]);

      const ctx = createAuthContext();
      const caller = appRouter.createCaller(ctx);
      const result = await caller.twilioPhoneNumber.searchAvailable({
        accountId: ACCOUNT_ID,
        numberType: "local",
        areaCode: "305",
      });

      expect(result).toHaveLength(1);
      expect(result[0].phoneNumber).toBe("+13055551111");
      expect(result[0].monthlyCost).toBe(1.15);
      expect(result[0].numberType).toBe("local");
      expect(mockLocalList).toHaveBeenCalled();
      expect(mockTollFreeList).not.toHaveBeenCalled();
    });

    it("searches toll-free numbers by area code", async () => {
      mockGetSettings.mockResolvedValue(null);
      mockTollFreeList.mockResolvedValue([
        {
          phoneNumber: "+18005551111",
          friendlyName: "(800) 555-1111",
          locality: "",
          region: "",
          postalCode: "",
          isoCountry: "US",
          capabilities: { sms: true, voice: true, mms: false },
        },
      ]);

      const ctx = createAuthContext();
      const caller = appRouter.createCaller(ctx);
      const result = await caller.twilioPhoneNumber.searchAvailable({
        accountId: ACCOUNT_ID,
        numberType: "tollFree",
        areaCode: "800",
      });

      expect(result).toHaveLength(1);
      expect(result[0].phoneNumber).toBe("+18005551111");
      expect(result[0].monthlyCost).toBe(2.15);
      expect(result[0].numberType).toBe("tollFree");
      expect(mockTollFreeList).toHaveBeenCalled();
      expect(mockLocalList).not.toHaveBeenCalled();
    });

    it("defaults to local when numberType is not specified", async () => {
      mockGetSettings.mockResolvedValue(null);
      mockLocalList.mockResolvedValue([]);

      const ctx = createAuthContext();
      const caller = appRouter.createCaller(ctx);
      const result = await caller.twilioPhoneNumber.searchAvailable({
        accountId: ACCOUNT_ID,
        areaCode: "512",
      });

      expect(result).toEqual([]);
      expect(mockLocalList).toHaveBeenCalled();
    });
  });

  describe("purchase", () => {
    it("purchases a number and stores it on the account", async () => {
      mockGetSettings.mockResolvedValue(null);
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
      expect(result.monthlyCost).toBe(1.15);
      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          phoneNumber: "+13055551111",
          smsUrl: "https://example.com/api/webhooks/twilio/inbound",
          statusCallback: "https://example.com/api/webhooks/twilio/voice-status",
        })
      );
    });

    it("returns correct cost for toll-free purchase", async () => {
      mockGetSettings.mockResolvedValue(null);
      mockCreate.mockResolvedValue({
        phoneNumber: "+18005551111",
        sid: "PNtf123",
      });
      mockUpsertSettings.mockResolvedValue({ id: 1 });

      const ctx = createAuthContext();
      const caller = appRouter.createCaller(ctx);
      const result = await caller.twilioPhoneNumber.purchase({
        accountId: ACCOUNT_ID,
        phoneNumber: "+18005551111",
        appUrl: "https://example.com",
        numberType: "tollFree",
      });

      expect(result.success).toBe(true);
      expect(result.monthlyCost).toBe(2.15);
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
      expect(mockRemove).not.toHaveBeenCalled();
    });
  });

  describe("submitPortRequest", () => {
    it("creates a port request successfully", async () => {
      mockGetSettings.mockResolvedValue(null); // No existing number
      mockCreatePortRequest.mockResolvedValue({ id: 42 });
      mockUpdatePortRequest.mockResolvedValue(undefined);

      const ctx = createAuthContext();
      const caller = appRouter.createCaller(ctx);
      const result = await caller.twilioPhoneNumber.submitPortRequest({
        accountId: ACCOUNT_ID,
        phoneNumber: "5551234567",
        currentCarrier: "AT&T",
        carrierAccountNumber: "ACC123",
        authorizedName: "John Doe",
        appUrl: "https://example.com",
      });

      expect(result.success).toBe(true);
      expect(result.portRequestId).toBe(42);
      expect(mockCreatePortRequest).toHaveBeenCalledWith(
        expect.objectContaining({
          accountId: ACCOUNT_ID,
          phoneNumber: "+15551234567",
          currentCarrier: "AT&T",
          carrierAccountNumber: "ACC123",
          authorizedName: "John Doe",
          status: "submitted",
        })
      );
    });

    it("rejects port request when account already has a number", async () => {
      mockGetSettings.mockResolvedValue({
        twilioFromNumber: "+15551234567",
        twilioPhoneSid: "PNexisting",
      });

      const ctx = createAuthContext();
      const caller = appRouter.createCaller(ctx);

      await expect(
        caller.twilioPhoneNumber.submitPortRequest({
          accountId: ACCOUNT_ID,
          phoneNumber: "5551234567",
          currentCarrier: "AT&T",
          carrierAccountNumber: "ACC123",
          authorizedName: "John Doe",
          appUrl: "https://example.com",
        })
      ).rejects.toThrow("already has a phone number");
    });
  });

  describe("getPortRequests", () => {
    it("returns port requests for an account", async () => {
      const mockRequests = [
        {
          id: 1,
          accountId: ACCOUNT_ID,
          phoneNumber: "+15551234567",
          currentCarrier: "AT&T",
          status: "in_progress",
          createdAt: new Date(),
        },
      ];
      mockGetPortRequests.mockResolvedValue(mockRequests);

      const ctx = createAuthContext();
      const caller = appRouter.createCaller(ctx);
      const result = await caller.twilioPhoneNumber.getPortRequests({
        accountId: ACCOUNT_ID,
      });

      expect(result).toEqual(mockRequests);
      expect(mockGetPortRequests).toHaveBeenCalledWith(ACCOUNT_ID);
    });
  });

  describe("cancelPortRequest", () => {
    it("cancels a pending port request", async () => {
      mockGetPortRequestById.mockResolvedValue({
        id: 1,
        accountId: ACCOUNT_ID,
        status: "submitted",
      });
      mockUpdatePortRequest.mockResolvedValue(undefined);

      const ctx = createAuthContext();
      const caller = appRouter.createCaller(ctx);
      const result = await caller.twilioPhoneNumber.cancelPortRequest({
        accountId: ACCOUNT_ID,
        portRequestId: 1,
      });

      expect(result.success).toBe(true);
      expect(mockUpdatePortRequest).toHaveBeenCalledWith(1, ACCOUNT_ID, {
        status: "cancelled",
        notes: "Cancelled by user.",
      });
    });

    it("rejects cancellation of completed port request", async () => {
      mockGetPortRequestById.mockResolvedValue({
        id: 1,
        accountId: ACCOUNT_ID,
        status: "completed",
      });

      const ctx = createAuthContext();
      const caller = appRouter.createCaller(ctx);

      await expect(
        caller.twilioPhoneNumber.cancelPortRequest({
          accountId: ACCOUNT_ID,
          portRequestId: 1,
        })
      ).rejects.toThrow("Cannot cancel");
    });

    it("rejects cancellation of non-existent port request", async () => {
      mockGetPortRequestById.mockResolvedValue(null);

      const ctx = createAuthContext();
      const caller = appRouter.createCaller(ctx);

      await expect(
        caller.twilioPhoneNumber.cancelPortRequest({
          accountId: ACCOUNT_ID,
          portRequestId: 999,
        })
      ).rejects.toThrow("Port request not found");
    });
  });

  describe("getUsage", () => {
    it("returns zeroed stats when no number is assigned", async () => {
      mockGetSettings.mockResolvedValue(null);

      const ctx = createAuthContext();
      const caller = appRouter.createCaller(ctx);
      const result = await caller.twilioPhoneNumber.getUsage({
        accountId: ACCOUNT_ID,
      });

      expect(result.hasNumber).toBe(false);
      expect(result.sms.sent).toBe(0);
      expect(result.voice.outbound).toBe(0);
      expect(result.totalCost).toBe(0);
    });

    it("returns usage data when number is assigned", async () => {
      mockGetSettings.mockResolvedValue({
        twilioFromNumber: "+13055551111",
        twilioPhoneSid: "PNabc123",
      });
      mockUsageList.mockResolvedValue([
        {
          category: "sms-outbound",
          count: "50",
          price: "-3.75",
          usage: "50",
        },
      ]);

      const ctx = createAuthContext();
      const caller = appRouter.createCaller(ctx);
      const result = await caller.twilioPhoneNumber.getUsage({
        accountId: ACCOUNT_ID,
        startDate: "2026-03-01",
        endDate: "2026-03-23",
      });

      expect(result.hasNumber).toBe(true);
      expect(result.phoneNumber).toBe("+13055551111");
      expect(result.period.start).toBe("2026-03-01");
      expect(result.period.end).toBe("2026-03-23");
    });

    it("returns zeroed stats on Twilio API error", async () => {
      mockGetSettings.mockResolvedValue({
        twilioFromNumber: "+13055551111",
        twilioPhoneSid: "PNabc123",
      });
      mockUsageList.mockRejectedValue(new Error("Twilio API error"));

      const ctx = createAuthContext();
      const caller = appRouter.createCaller(ctx);
      const result = await caller.twilioPhoneNumber.getUsage({
        accountId: ACCOUNT_ID,
      });

      expect(result.hasNumber).toBe(true);
      expect(result.totalCost).toBe(0);
      expect((result as any).error).toBeDefined();
    });
  });
});
