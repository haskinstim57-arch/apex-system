import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

// Mock all db functions before importing the module under test
vi.mock("./db", async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return {
    ...actual,
    getActivePortRequests: vi.fn(),
    getAccountMessagingSettings: vi.fn(),
    upsertAccountMessagingSettings: vi.fn(),
    updatePortRequest: vi.fn(),
    createNotification: vi.fn(),
  };
});

// Mock twilio — factory must not reference outer variables (hoisting)
vi.mock("twilio", () => {
  const listFn = vi.fn();
  const updateFn = vi.fn();
  const incomingFn: any = vi.fn((sid: string) => ({ update: updateFn }));
  incomingFn.list = listFn;

  const client = { incomingPhoneNumbers: incomingFn };
  const TwilioFn = vi.fn(() => client);

  // Expose helpers for tests via the module itself
  return {
    default: TwilioFn,
    __mockList: listFn,
    __mockUpdate: updateFn,
    __mockIncomingPhoneNumbers: incomingFn,
  };
});

import {
  getActivePortRequests,
  getAccountMessagingSettings,
  upsertAccountMessagingSettings,
  updatePortRequest,
  createNotification,
} from "./db";
import {
  processActivePortRequests,
  startPortRequestPoller,
  stopPortRequestPoller,
} from "./services/portRequestPoller";

// Access mock helpers from the mocked module
import { __mockList, __mockUpdate } from "twilio";
const mockList = __mockList as ReturnType<typeof vi.fn>;
const mockUpdate = __mockUpdate as ReturnType<typeof vi.fn>;

const mockGetActivePortRequests = getActivePortRequests as ReturnType<typeof vi.fn>;
const mockGetSettings = getAccountMessagingSettings as ReturnType<typeof vi.fn>;
const mockUpsertSettings = upsertAccountMessagingSettings as ReturnType<typeof vi.fn>;
const mockUpdatePortRequest = updatePortRequest as ReturnType<typeof vi.fn>;
const mockCreateNotification = createNotification as ReturnType<typeof vi.fn>;

describe("Port Request Poller", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.TWILIO_ACCOUNT_SID = "ACtest123";
    process.env.TWILIO_AUTH_TOKEN = "testtoken123";
    process.env.VITE_APP_URL = "https://example.com";
  });

  afterEach(() => {
    stopPortRequestPoller();
  });

  describe("startPortRequestPoller / stopPortRequestPoller", () => {
    it("starts and stops without throwing", () => {
      expect(() => startPortRequestPoller()).not.toThrow();
      expect(() => stopPortRequestPoller()).not.toThrow();
    });

    it("is idempotent — calling start twice does not throw", () => {
      startPortRequestPoller();
      startPortRequestPoller(); // second call should be no-op
      stopPortRequestPoller();
    });
  });

  describe("processActivePortRequests", () => {
    it("does nothing when there are no active port requests", async () => {
      mockGetActivePortRequests.mockResolvedValue([]);
      await processActivePortRequests();
      expect(mockGetActivePortRequests).toHaveBeenCalled();
      expect(mockList).not.toHaveBeenCalled();
    });

    it("does nothing when getActivePortRequests returns null", async () => {
      mockGetActivePortRequests.mockResolvedValue(null);
      await processActivePortRequests();
      expect(mockList).not.toHaveBeenCalled();
    });

    it("handles db error gracefully", async () => {
      mockGetActivePortRequests.mockRejectedValue(new Error("DB down"));
      await expect(processActivePortRequests()).resolves.toBeUndefined();
    });

    it("completes a port when the number is found in Twilio", async () => {
      const request = {
        id: 1,
        accountId: 100,
        phoneNumber: "+15551234567",
        status: "in_progress",
        portingSid: null,
        createdAt: new Date(),
      };
      mockGetActivePortRequests.mockResolvedValue([request]);
      mockGetSettings.mockResolvedValue(null);
      mockList.mockResolvedValue([
        { sid: "PNabc123", phoneNumber: "+15551234567" },
      ]);
      mockUpdate.mockResolvedValue({});
      mockUpsertSettings.mockResolvedValue({});
      mockUpdatePortRequest.mockResolvedValue(undefined);
      mockCreateNotification.mockResolvedValue({ id: 1 });

      await processActivePortRequests();

      expect(mockUpsertSettings).toHaveBeenCalledWith(100, {
        twilioFromNumber: "+15551234567",
        twilioPhoneSid: "PNabc123",
      });

      expect(mockUpdatePortRequest).toHaveBeenCalledWith(1, 100, {
        status: "completed",
        portingSid: "PNabc123",
        notes: expect.stringContaining("Port completed successfully"),
      });

      expect(mockCreateNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          accountId: 100,
          title: "Phone Number Ported Successfully",
          link: "/settings",
        })
      );
    });

    it("advances submitted requests to in_progress when number not yet found", async () => {
      const request = {
        id: 2,
        accountId: 100,
        phoneNumber: "+15559876543",
        status: "submitted",
        portingSid: null,
        createdAt: new Date(),
      };
      mockGetActivePortRequests.mockResolvedValue([request]);
      mockGetSettings.mockResolvedValue(null);
      mockList.mockResolvedValue([]);
      mockUpdatePortRequest.mockResolvedValue(undefined);

      await processActivePortRequests();

      expect(mockUpdatePortRequest).toHaveBeenCalledWith(2, 100, {
        status: "in_progress",
        notes: expect.stringContaining("being processed"),
      });
    });

    it("marks port as failed after 45 days timeout", async () => {
      const oldDate = new Date();
      oldDate.setDate(oldDate.getDate() - 50);

      const request = {
        id: 3,
        accountId: 100,
        phoneNumber: "+15550001111",
        status: "in_progress",
        portingSid: null,
        createdAt: oldDate,
      };
      mockGetActivePortRequests.mockResolvedValue([request]);
      mockGetSettings.mockResolvedValue(null);
      mockList.mockResolvedValue([]);
      mockUpdatePortRequest.mockResolvedValue(undefined);
      mockCreateNotification.mockResolvedValue({ id: 1 });

      await processActivePortRequests();

      expect(mockUpdatePortRequest).toHaveBeenCalledWith(3, 100, {
        status: "failed",
        notes: expect.stringContaining("timed out after 45 days"),
      });

      expect(mockCreateNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          accountId: 100,
          title: "Port Request Failed",
        })
      );
    });

    it("cancels port request when account already has a number", async () => {
      const request = {
        id: 4,
        accountId: 100,
        phoneNumber: "+15552223333",
        status: "in_progress",
        portingSid: null,
        createdAt: new Date(),
      };
      mockGetActivePortRequests.mockResolvedValue([request]);
      mockGetSettings.mockResolvedValue({
        twilioFromNumber: "+15559999999",
        twilioPhoneSid: "PNexisting",
      });
      mockUpdatePortRequest.mockResolvedValue(undefined);
      mockCreateNotification.mockResolvedValue({ id: 1 });

      await processActivePortRequests();

      expect(mockUpdatePortRequest).toHaveBeenCalledWith(4, 100, {
        status: "cancelled",
        notes: expect.stringContaining("already has a phone number"),
      });

      expect(mockCreateNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "Port Request Cancelled",
        })
      );
    });

    it("configures webhooks when port completes and app URL is available", async () => {
      const request = {
        id: 5,
        accountId: 100,
        phoneNumber: "+15554445555",
        status: "in_progress",
        portingSid: null,
        createdAt: new Date(),
      };
      mockGetActivePortRequests.mockResolvedValue([request]);
      mockGetSettings.mockResolvedValue(null);
      mockList.mockResolvedValue([
        { sid: "PNnew456", phoneNumber: "+15554445555" },
      ]);
      mockUpdate.mockResolvedValue({});
      mockUpsertSettings.mockResolvedValue({});
      mockUpdatePortRequest.mockResolvedValue(undefined);
      mockCreateNotification.mockResolvedValue({ id: 1 });

      await processActivePortRequests();

      expect(mockUpdate).toHaveBeenCalledWith({
        smsUrl: "https://example.com/api/webhooks/twilio/inbound",
        smsMethod: "POST",
        statusCallback: "https://example.com/api/webhooks/twilio/voice-status",
        statusCallbackMethod: "POST",
      });
    });

    it("handles Twilio API errors gracefully without crashing", async () => {
      const request = {
        id: 6,
        accountId: 100,
        phoneNumber: "+15556667777",
        status: "in_progress",
        portingSid: null,
        createdAt: new Date(),
      };
      mockGetActivePortRequests.mockResolvedValue([request]);
      mockGetSettings.mockResolvedValue(null);
      mockList.mockRejectedValue(new Error("Twilio API timeout"));

      await expect(processActivePortRequests()).resolves.toBeUndefined();
    });

    it("skips requests when no Twilio credentials are available", async () => {
      delete process.env.TWILIO_ACCOUNT_SID;
      delete process.env.TWILIO_AUTH_TOKEN;

      const request = {
        id: 7,
        accountId: 100,
        phoneNumber: "+15558889999",
        status: "in_progress",
        portingSid: null,
        createdAt: new Date(),
      };
      mockGetActivePortRequests.mockResolvedValue([request]);
      mockGetSettings.mockResolvedValue(null);

      await processActivePortRequests();

      expect(mockList).not.toHaveBeenCalled();
      expect(mockUpdatePortRequest).not.toHaveBeenCalled();
    });
  });
});
