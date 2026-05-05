/**
 * Vitest tests for the Message Queue Service
 *
 * Tests cover:
 * 1. enqueueMessage — creates queued messages with correct payloads
 * 2. processQueue — dispatches when business hours are open, skips when closed
 * 3. Retry logic — exponential backoff, max attempts, failure marking
 * 4. Payload types — SMS, email, AI call payloads
 */

import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

// ─────────────────────────────────────────────
// Mock DB helpers
// ─────────────────────────────────────────────
const mockCreateQueuedMessage = vi.fn();
const mockListAllPendingQueuedMessages = vi.fn();
const mockUpdateQueuedMessage = vi.fn();
const mockGetAccountMessagingSettings = vi.fn();
const mockCreateAICall = vi.fn();
const mockUpdateAICall = vi.fn();

vi.mock("../server/db", async (importOriginal) => {
  const actual = await importOriginal() as Record<string, unknown>;
  return {
    ...actual,
    createQueuedMessage: (...args: unknown[]) => mockCreateQueuedMessage(...args),
    listAllPendingQueuedMessages: (...args: unknown[]) => mockListAllPendingQueuedMessages(...args),
    updateQueuedMessage: (...args: unknown[]) => mockUpdateQueuedMessage(...args),
    getAccountMessagingSettings: (...args: unknown[]) => mockGetAccountMessagingSettings(...args),
    createAICall: (...args: unknown[]) => mockCreateAICall(...args),
    updateAICall: (...args: unknown[]) => mockUpdateAICall(...args),
  };
});

// ─────────────────────────────────────────────
// Mock business hours
// ─────────────────────────────────────────────
const mockIsWithinAccountBusinessHours = vi.fn();

vi.mock("../server/utils/businessHours", () => ({
  isWithinAccountBusinessHours: (...args: unknown[]) => mockIsWithinAccountBusinessHours(...args),
}));

// ─────────────────────────────────────────────
// Mock billed dispatch service
// ─────────────────────────────────────────────
const mockBilledDispatchSMS = vi.fn();
const mockBilledDispatchEmail = vi.fn();

vi.mock("../server/services/billedDispatch", () => ({
  billedDispatchSMS: (...args: unknown[]) => mockBilledDispatchSMS(...args),
  billedDispatchEmail: (...args: unknown[]) => mockBilledDispatchEmail(...args),
}));

// ─────────────────────────────────────────────
// Mock VAPI service
// ─────────────────────────────────────────────
const mockCreateVapiCall = vi.fn();

vi.mock("../server/services/vapi", () => ({
  createVapiCall: (...args: unknown[]) => mockCreateVapiCall(...args),
}));

// ─────────────────────────────────────────────
// Import the module under test (after mocks)
// ─────────────────────────────────────────────
import { enqueueMessage, processQueue } from "./services/messageQueue";

describe("Message Queue Service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ─────────────────────────────────────────────
  // enqueueMessage tests
  // ─────────────────────────────────────────────
  describe("enqueueMessage", () => {
    it("creates a queued SMS message with correct payload", async () => {
      mockCreateQueuedMessage.mockResolvedValue({ id: 42 });

      const result = await enqueueMessage({
        accountId: 1,
        contactId: 100,
        type: "sms",
        payload: { to: "+15551234567", body: "Hello from queue" },
        source: "test",
        initiatedById: 5,
      });

      expect(result).toEqual({ id: 42, queued: true });
      expect(mockCreateQueuedMessage).toHaveBeenCalledWith({
        accountId: 1,
        contactId: 100,
        type: "sms",
        payload: JSON.stringify({ to: "+15551234567", body: "Hello from queue" }),
        source: "test",
        initiatedById: 5,
        maxAttempts: 3,
      });
    });

    it("creates a queued email message with correct payload", async () => {
      mockCreateQueuedMessage.mockResolvedValue({ id: 43 });

      const result = await enqueueMessage({
        accountId: 2,
        type: "email",
        payload: {
          to: "test@example.com",
          subject: "Test Subject",
          body: "<p>Hello</p>",
        },
      });

      expect(result).toEqual({ id: 43, queued: true });
      expect(mockCreateQueuedMessage).toHaveBeenCalledWith({
        accountId: 2,
        contactId: undefined,
        type: "email",
        payload: JSON.stringify({
          to: "test@example.com",
          subject: "Test Subject",
          body: "<p>Hello</p>",
        }),
        source: "business_hours_queue",
        initiatedById: undefined,
        maxAttempts: 3,
      });
    });

    it("creates a queued AI call message", async () => {
      mockCreateQueuedMessage.mockResolvedValue({ id: 44 });

      const result = await enqueueMessage({
        accountId: 3,
        contactId: 200,
        type: "ai_call",
        payload: {
          contactId: 200,
          phoneNumber: "+15559876543",
          customerName: "John Doe",
          assistantId: "asst_123",
          initiatedById: 10,
        },
        maxAttempts: 5,
      });

      expect(result).toEqual({ id: 44, queued: true });
      expect(mockCreateQueuedMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          accountId: 3,
          contactId: 200,
          type: "ai_call",
          maxAttempts: 5,
        })
      );
    });

    it("defaults source to business_hours_queue when not provided", async () => {
      mockCreateQueuedMessage.mockResolvedValue({ id: 45 });

      await enqueueMessage({
        accountId: 1,
        type: "sms",
        payload: { to: "+15551111111", body: "test" },
      });

      expect(mockCreateQueuedMessage).toHaveBeenCalledWith(
        expect.objectContaining({ source: "business_hours_queue" })
      );
    });

    it("defaults maxAttempts to 3 when not provided", async () => {
      mockCreateQueuedMessage.mockResolvedValue({ id: 46 });

      await enqueueMessage({
        accountId: 1,
        type: "email",
        payload: { to: "a@b.com", subject: "x", body: "y" },
      });

      expect(mockCreateQueuedMessage).toHaveBeenCalledWith(
        expect.objectContaining({ maxAttempts: 3 })
      );
    });
  });

  // ─────────────────────────────────────────────
  // processQueue tests
  // ─────────────────────────────────────────────
  describe("processQueue", () => {
    it("returns zero stats when no pending messages exist", async () => {
      mockListAllPendingQueuedMessages.mockResolvedValue([]);

      const result = await processQueue();

      expect(result).toEqual({
        processed: 0,
        dispatched: 0,
        failed: 0,
        skipped: 0,
      });
    });

    it("skips messages when business hours are closed", async () => {
      mockListAllPendingQueuedMessages.mockResolvedValue([
        {
          id: 1,
          accountId: 10,
          type: "sms",
          payload: JSON.stringify({ to: "+15551234567", body: "Hello" }),
          attempts: 0,
          maxAttempts: 3,
          status: "pending",
        },
        {
          id: 2,
          accountId: 10,
          type: "email",
          payload: JSON.stringify({ to: "a@b.com", subject: "Hi", body: "Hey" }),
          attempts: 0,
          maxAttempts: 3,
          status: "pending",
        },
      ]);
      mockIsWithinAccountBusinessHours.mockResolvedValue(false);

      const result = await processQueue();

      expect(result.skipped).toBe(2);
      expect(result.processed).toBe(0);
      expect(result.dispatched).toBe(0);
      expect(mockBilledDispatchSMS).not.toHaveBeenCalled();
      expect(mockBilledDispatchEmail).not.toHaveBeenCalled();
    });

    it("dispatches SMS when business hours are open", async () => {
      mockListAllPendingQueuedMessages.mockResolvedValue([
        {
          id: 1,
          accountId: 10,
          type: "sms",
          payload: JSON.stringify({ to: "+15551234567", body: "Hello from queue" }),
          attempts: 0,
          maxAttempts: 3,
          status: "pending",
        },
      ]);
      mockIsWithinAccountBusinessHours.mockResolvedValue(true);
      mockBilledDispatchSMS.mockResolvedValue({ success: true, provider: "twilio" });

      const result = await processQueue();

      expect(result.dispatched).toBe(1);
      expect(result.processed).toBe(1);
      expect(mockBilledDispatchSMS).toHaveBeenCalledWith(
        expect.objectContaining({
          to: "+15551234567",
          body: "Hello from queue",
          accountId: 10,
        })
      );
      expect(mockUpdateQueuedMessage).toHaveBeenCalledWith(1, {
        status: "dispatched",
        attempts: 1,
        dispatchedAt: expect.any(Date),
        lastError: null,
      });
    });

    it("dispatches email when business hours are open", async () => {
      mockListAllPendingQueuedMessages.mockResolvedValue([
        {
          id: 2,
          accountId: 10,
          type: "email",
          payload: JSON.stringify({
            to: "test@example.com",
            subject: "Test",
            body: "<p>Hello</p>",
          }),
          attempts: 0,
          maxAttempts: 3,
          status: "pending",
        },
      ]);
      mockIsWithinAccountBusinessHours.mockResolvedValue(true);
      mockBilledDispatchEmail.mockResolvedValue({ success: true, provider: "sendgrid" });

      const result = await processQueue();

      expect(result.dispatched).toBe(1);
      expect(mockBilledDispatchEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: "test@example.com",
          subject: "Test",
          body: "<p>Hello</p>",
          accountId: 10,
        })
      );
    });

    it("marks message as failed after max attempts", async () => {
      mockListAllPendingQueuedMessages.mockResolvedValue([
        {
          id: 3,
          accountId: 10,
          type: "sms",
          payload: JSON.stringify({ to: "+15551234567", body: "Fail test" }),
          attempts: 2, // Already tried twice, maxAttempts=3
          maxAttempts: 3,
          status: "pending",
        },
      ]);
      mockIsWithinAccountBusinessHours.mockResolvedValue(true);
      mockBilledDispatchSMS.mockResolvedValue({ success: false, error: "Provider error" });

      const result = await processQueue();

      expect(result.failed).toBe(1);
      expect(mockUpdateQueuedMessage).toHaveBeenCalledWith(3, {
        status: "failed",
        attempts: 3,
        lastError: "Provider error",
      });
    });

    it("schedules retry with backoff when dispatch fails but attempts remain", async () => {
      mockListAllPendingQueuedMessages.mockResolvedValue([
        {
          id: 4,
          accountId: 10,
          type: "sms",
          payload: JSON.stringify({ to: "+15551234567", body: "Retry test" }),
          attempts: 0,
          maxAttempts: 3,
          status: "pending",
        },
      ]);
      mockIsWithinAccountBusinessHours.mockResolvedValue(true);
      mockBilledDispatchSMS.mockResolvedValue({ success: false, error: "Temporary failure" });

      const result = await processQueue();

      // Should not be counted as final failure since attempts remain
      expect(result.failed).toBe(0);
      expect(result.processed).toBe(1);
      expect(mockUpdateQueuedMessage).toHaveBeenCalledWith(4, {
        attempts: 1,
        lastError: "Temporary failure",
        nextAttemptAt: expect.any(Date),
      });

      // Verify backoff: attempt 1 → 2^1 * 60s = 120s
      const call = mockUpdateQueuedMessage.mock.calls[0];
      const nextAttemptAt = call[1].nextAttemptAt as Date;
      const now = Date.now();
      const diff = nextAttemptAt.getTime() - now;
      // Should be approximately 120 seconds (2 minutes) — allow 5s tolerance
      expect(diff).toBeGreaterThan(115_000);
      expect(diff).toBeLessThan(125_000);
    });

    it("handles multiple accounts with different business hours", async () => {
      mockListAllPendingQueuedMessages.mockResolvedValue([
        {
          id: 10,
          accountId: 100,
          type: "sms",
          payload: JSON.stringify({ to: "+15551111111", body: "Account 100" }),
          attempts: 0,
          maxAttempts: 3,
          status: "pending",
        },
        {
          id: 11,
          accountId: 200,
          type: "sms",
          payload: JSON.stringify({ to: "+15552222222", body: "Account 200" }),
          attempts: 0,
          maxAttempts: 3,
          status: "pending",
        },
      ]);

      // Account 100 is open, account 200 is closed
      mockIsWithinAccountBusinessHours.mockImplementation(async (accountId: number) => {
        return accountId === 100;
      });
      mockBilledDispatchSMS.mockResolvedValue({ success: true, provider: "twilio" });

      const result = await processQueue();

      expect(result.dispatched).toBe(1);
      expect(result.skipped).toBe(1);
      expect(mockBilledDispatchSMS).toHaveBeenCalledTimes(1);
      expect(mockBilledDispatchSMS).toHaveBeenCalledWith(
        expect.objectContaining({ to: "+15551111111" })
      );
    });

    it("handles DB fetch errors gracefully", async () => {
      mockListAllPendingQueuedMessages.mockRejectedValue(new Error("DB connection failed"));

      const result = await processQueue();

      expect(result).toEqual({
        processed: 0,
        dispatched: 0,
        failed: 0,
        skipped: 0,
      });
    });

    it("handles business hours check errors by treating as closed", async () => {
      mockListAllPendingQueuedMessages.mockResolvedValue([
        {
          id: 20,
          accountId: 300,
          type: "sms",
          payload: JSON.stringify({ to: "+15553333333", body: "BH error test" }),
          attempts: 0,
          maxAttempts: 3,
          status: "pending",
        },
      ]);
      mockIsWithinAccountBusinessHours.mockRejectedValue(new Error("BH check failed"));

      const result = await processQueue();

      expect(result.skipped).toBe(1);
      expect(result.dispatched).toBe(0);
    });

    it("handles invalid payload JSON gracefully", async () => {
      mockListAllPendingQueuedMessages.mockResolvedValue([
        {
          id: 30,
          accountId: 10,
          type: "sms",
          payload: "not valid json {{{",
          attempts: 2,
          maxAttempts: 3,
          status: "pending",
        },
      ]);
      mockIsWithinAccountBusinessHours.mockResolvedValue(true);

      const result = await processQueue();

      expect(result.failed).toBe(1);
      expect(mockUpdateQueuedMessage).toHaveBeenCalledWith(30, {
        status: "failed",
        attempts: 3,
        lastError: "Invalid payload JSON",
      });
    });

    it("dispatches AI call with per-account VAPI credentials", async () => {
      const aiCallPayload = {
        contactId: 500,
        phoneNumber: "+15559876543",
        customerName: "Jane Smith",
        assistantId: "asst_abc",
        initiatedById: 7,
        metadata: { leadSource: "facebook" },
      };

      mockListAllPendingQueuedMessages.mockResolvedValue([
        {
          id: 50,
          accountId: 420001,
          type: "ai_call",
          payload: JSON.stringify(aiCallPayload),
          attempts: 0,
          maxAttempts: 3,
          status: "pending",
        },
      ]);
      mockIsWithinAccountBusinessHours.mockResolvedValue(true);
      mockGetAccountMessagingSettings.mockResolvedValue({
        vapiApiKey: "per-account-key",
        vapiPhoneNumberId: "per-account-phone-id",
      });
      mockCreateAICall.mockResolvedValue({ id: 9001 });
      mockCreateVapiCall.mockResolvedValue({ id: "vapi_call_xyz" });

      const result = await processQueue();

      expect(result.dispatched).toBe(1);
      expect(mockGetAccountMessagingSettings).toHaveBeenCalledWith(420001);
      expect(mockCreateVapiCall).toHaveBeenCalledWith(
        expect.objectContaining({
          phoneNumber: "+15559876543",
          customerName: "Jane Smith",
          assistantId: "asst_abc",
          apiKey: "per-account-key",
          phoneNumberId: "per-account-phone-id",
          metadata: expect.objectContaining({
            apexAccountId: 420001,
            apexContactId: 500,
            apexCallId: 9001,
            leadSource: "facebook",
          }),
        })
      );
      expect(mockUpdateAICall).toHaveBeenCalledWith(9001, {
        externalCallId: "vapi_call_xyz",
        status: "calling",
      });
    });

    it("falls back to undefined credentials when account has no messaging settings", async () => {
      const aiCallPayload = {
        contactId: 600,
        phoneNumber: "+15551112222",
        customerName: "No Config User",
        assistantId: "asst_def",
        initiatedById: 8,
      };

      mockListAllPendingQueuedMessages.mockResolvedValue([
        {
          id: 51,
          accountId: 999,
          type: "ai_call",
          payload: JSON.stringify(aiCallPayload),
          attempts: 0,
          maxAttempts: 3,
          status: "pending",
        },
      ]);
      mockIsWithinAccountBusinessHours.mockResolvedValue(true);
      mockGetAccountMessagingSettings.mockResolvedValue(null);
      mockCreateAICall.mockResolvedValue({ id: 9002 });
      mockCreateVapiCall.mockResolvedValue({ id: "vapi_call_fallback" });

      const result = await processQueue();

      expect(result.dispatched).toBe(1);
      expect(mockCreateVapiCall).toHaveBeenCalledWith(
        expect.objectContaining({
          apiKey: undefined,
          phoneNumberId: undefined,
        })
      );
    });

    it("handles VAPI call failure gracefully and marks AI call as failed", async () => {
      const aiCallPayload = {
        contactId: 700,
        phoneNumber: "+15553334444",
        customerName: "Fail User",
        assistantId: "asst_ghi",
        initiatedById: 9,
      };

      mockListAllPendingQueuedMessages.mockResolvedValue([
        {
          id: 52,
          accountId: 420001,
          type: "ai_call",
          payload: JSON.stringify(aiCallPayload),
          attempts: 2,
          maxAttempts: 3,
          status: "pending",
        },
      ]);
      mockIsWithinAccountBusinessHours.mockResolvedValue(true);
      mockGetAccountMessagingSettings.mockResolvedValue({
        vapiApiKey: "key-123",
        vapiPhoneNumberId: "phone-456",
      });
      mockCreateAICall.mockResolvedValue({ id: 9003 });
      mockCreateVapiCall.mockRejectedValue(new Error("VAPI 400: Invalid number"));

      const result = await processQueue();

      expect(result.failed).toBe(1);
      expect(mockUpdateAICall).toHaveBeenCalledWith(9003, {
        status: "failed",
        errorMessage: "VAPI 400: Invalid number",
      });
    });
  });
});
