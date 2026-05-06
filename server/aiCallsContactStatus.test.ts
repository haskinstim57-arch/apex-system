/**
 * Vitest tests for Prompt DD — VAPI call ends → auto-update contact status
 *
 * Tests cover:
 * 1. Completed call (customer-ended-call) → contact moves to "contacted"
 * 2. No-answer → contact moves to "uncontacted"
 * 3. Contact already at "qualified" doesn't get downgraded
 * 4. Voicemail → contact moves to "uncontacted"
 */

import { describe, expect, it, vi, beforeEach } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

// ─── Mock DB helpers ───
const mockGetAICallById = vi.fn();
const mockUpdateAICall = vi.fn();
const mockGetContactById = vi.fn();
const mockUpdateContact = vi.fn();

vi.mock("./db", async () => {
  const actual = await vi.importActual("./db");
  return {
    ...actual,
    getAICallById: (...args: unknown[]) => mockGetAICallById(...args),
    updateAICall: (...args: unknown[]) => mockUpdateAICall(...args),
    getContactById: (...args: unknown[]) => mockGetContactById(...args),
    updateContact: (...args: unknown[]) => mockUpdateContact(...args),
    getMember: vi.fn(),
    getAccountById: vi.fn(),
    createAICall: vi.fn(),
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
  createVapiCall: vi.fn(),
  getVapiCall: vi.fn(),
  resolveAssistantId: vi.fn().mockReturnValue("default-assistant-id"),
  mapVapiStatus: vi.fn().mockReturnValue("queued"),
  mapVapiEndedReason: vi.fn().mockReturnValue("completed"),
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

function createUnauthContext(): TrpcContext {
  return {
    user: null,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: () => {} } as TrpcContext["res"],
  };
}

describe("VAPI webhook → contact status auto-update", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const baseCall = {
    id: 100,
    accountId: 420001,
    contactId: 500,
    status: "calling",
    externalCallId: "vapi-123",
  };

  function makeWebhookInput(endedReason: string) {
    return {
      message: {
        type: "end-of-call-report",
        call: {
          id: "vapi-123",
          endedReason,
          metadata: { apex_call_id: "100" },
        },
        artifact: { transcript: "Hello..." },
        analysis: { summary: "Call summary" },
      },
    };
  }

  it("completed call (customer-ended-call) → contact moves to 'contacted'", async () => {
    mockGetAICallById.mockResolvedValue(baseCall);
    mockUpdateAICall.mockResolvedValue(undefined);
    mockGetContactById.mockResolvedValue({
      id: 500,
      accountId: 420001,
      status: "new",
    });
    mockUpdateContact.mockResolvedValue(undefined);

    const ctx = createUnauthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.aiCalls.webhook(makeWebhookInput("customer-ended-call"));

    expect(result.success).toBe(true);
    expect(mockUpdateContact).toHaveBeenCalledWith(500, 420001, { status: "contacted" });
  });

  it("no-answer → contact moves to 'uncontacted'", async () => {
    mockGetAICallById.mockResolvedValue(baseCall);
    mockUpdateAICall.mockResolvedValue(undefined);
    mockGetContactById.mockResolvedValue({
      id: 500,
      accountId: 420001,
      status: "new",
    });
    mockUpdateContact.mockResolvedValue(undefined);

    const ctx = createUnauthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.aiCalls.webhook(makeWebhookInput("customer-did-not-answer"));

    expect(result.success).toBe(true);
    expect(mockUpdateContact).toHaveBeenCalledWith(500, 420001, { status: "uncontacted" });
  });

  it("voicemail → contact moves to 'uncontacted'", async () => {
    mockGetAICallById.mockResolvedValue(baseCall);
    mockUpdateAICall.mockResolvedValue(undefined);
    mockGetContactById.mockResolvedValue({
      id: 500,
      accountId: 420001,
      status: "new",
    });
    mockUpdateContact.mockResolvedValue(undefined);

    const ctx = createUnauthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.aiCalls.webhook(makeWebhookInput("voicemail"));

    expect(result.success).toBe(true);
    expect(mockUpdateContact).toHaveBeenCalledWith(500, 420001, { status: "uncontacted" });
  });

  it("contact already at 'qualified' does NOT get downgraded to 'contacted'", async () => {
    mockGetAICallById.mockResolvedValue(baseCall);
    mockUpdateAICall.mockResolvedValue(undefined);
    mockGetContactById.mockResolvedValue({
      id: 500,
      accountId: 420001,
      status: "qualified",
    });
    mockUpdateContact.mockResolvedValue(undefined);

    const ctx = createUnauthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.aiCalls.webhook(makeWebhookInput("assistant-ended-call"));

    expect(result.success).toBe(true);
    // "contacted" rank (2) < "qualified" rank (6) → no update
    expect(mockUpdateContact).not.toHaveBeenCalled();
  });

  it("assistant-ended-call → contact moves from 'uncontacted' to 'contacted'", async () => {
    mockGetAICallById.mockResolvedValue(baseCall);
    mockUpdateAICall.mockResolvedValue(undefined);
    mockGetContactById.mockResolvedValue({
      id: 500,
      accountId: 420001,
      status: "uncontacted",
    });
    mockUpdateContact.mockResolvedValue(undefined);

    const ctx = createUnauthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.aiCalls.webhook(makeWebhookInput("assistant-ended-call"));

    expect(result.success).toBe(true);
    expect(mockUpdateContact).toHaveBeenCalledWith(500, 420001, { status: "contacted" });
  });

  it("unknown endedReason does NOT update contact status", async () => {
    mockGetAICallById.mockResolvedValue(baseCall);
    mockUpdateAICall.mockResolvedValue(undefined);
    mockGetContactById.mockResolvedValue({
      id: 500,
      accountId: 420001,
      status: "new",
    });

    const ctx = createUnauthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.aiCalls.webhook(makeWebhookInput("pipeline-error-openai-llm-failed"));

    expect(result.success).toBe(true);
    expect(mockUpdateContact).not.toHaveBeenCalled();
  });
});
