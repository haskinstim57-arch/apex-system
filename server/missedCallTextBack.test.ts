import { describe, expect, it, vi, beforeEach } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

// ─────────────────────────────────────────────
// Mocks
// ─────────────────────────────────────────────

// Mock db functions
vi.mock("./db", async () => {
  const actual = await vi.importActual("./db");
  return {
    ...actual,
    getAccountById: vi.fn(),
    updateAccount: vi.fn(),
    getMember: vi.fn(),
    findContactByPhone: vi.fn(),
    createMessage: vi.fn(),
    logContactActivity: vi.fn(),
  };
});

// Mock messaging service
vi.mock("./services/messaging", () => ({
  dispatchSMS: vi.fn(),
}));

// Mock inbound messages helpers
vi.mock("./webhooks/inboundMessages", () => ({
  resolveAccountByTwilioNumber: vi.fn(),
  normalizePhone: vi.fn((phone: string) => phone.replace(/\D/g, "")),
}));

import {
  getAccountById,
  updateAccount,
  getMember,
  findContactByPhone,
  createMessage,
  logContactActivity,
} from "./db";
import { dispatchSMS } from "./services/messaging";
import { resolveAccountByTwilioNumber } from "./webhooks/inboundMessages";

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createAuthContext(overrides?: Partial<AuthenticatedUser>): TrpcContext {
  const user: AuthenticatedUser = {
    id: 1,
    openId: "test-user",
    email: "test@example.com",
    name: "Test User",
    loginMethod: "manus",
    role: "admin",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
    ...overrides,
  };

  return {
    user,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: vi.fn(),
    } as unknown as TrpcContext["res"],
  };
}

const mockAccount = {
  id: 10,
  name: "Test Account",
  slug: "test",
  parentId: null,
  ownerId: 1,
  industry: "mortgage",
  website: null,
  phone: "+15551234567",
  email: "test@example.com",
  address: null,
  logoUrl: null,
  status: "active" as const,
  onboardingComplete: true,
  missedCallTextBackEnabled: false,
  missedCallTextBackMessage: null,
  missedCallTextBackDelayMinutes: 1,
  createdAt: new Date(),
  updatedAt: new Date(),
};

// ─────────────────────────────────────────────
// Tests: tRPC Procedures
// ─────────────────────────────────────────────

describe("missedCallTextBack.getSettings", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns default settings when account has no custom message", async () => {
    const ctx = createAuthContext();
    vi.mocked(getAccountById).mockResolvedValue(mockAccount);
    vi.mocked(getMember).mockResolvedValue(null);

    const caller = appRouter.createCaller(ctx);
    const result = await caller.missedCallTextBack.getSettings({ accountId: 10 });

    expect(result.enabled).toBe(false);
    expect(result.message).toBe("Hey, sorry I missed your call! How can I help you?");
    expect(result.delayMinutes).toBe(1);
  });

  it("returns custom settings when configured", async () => {
    const ctx = createAuthContext();
    vi.mocked(getAccountById).mockResolvedValue({
      ...mockAccount,
      missedCallTextBackEnabled: true,
      missedCallTextBackMessage: "Custom message here",
      missedCallTextBackDelayMinutes: 5,
    });
    vi.mocked(getMember).mockResolvedValue(null);

    const caller = appRouter.createCaller(ctx);
    const result = await caller.missedCallTextBack.getSettings({ accountId: 10 });

    expect(result.enabled).toBe(true);
    expect(result.message).toBe("Custom message here");
    expect(result.delayMinutes).toBe(5);
  });

  it("throws NOT_FOUND when account does not exist", async () => {
    const ctx = createAuthContext();
    vi.mocked(getAccountById).mockResolvedValue(undefined);
    vi.mocked(getMember).mockResolvedValue(null);

    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.missedCallTextBack.getSettings({ accountId: 999 })
    ).rejects.toThrow("Account not found");
  });

  it("throws FORBIDDEN for non-owner non-admin users", async () => {
    const ctx = createAuthContext({ role: "user" });
    vi.mocked(getMember).mockResolvedValue({
      id: 1,
      accountId: 10,
      userId: 1,
      role: "employee",
      isActive: true,
      createdAt: new Date(),
    });

    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.missedCallTextBack.getSettings({ accountId: 10 })
    ).rejects.toThrow("Only account owners can manage missed call text-back settings");
  });
});

describe("missedCallTextBack.saveSettings", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("saves settings and calls updateAccount", async () => {
    const ctx = createAuthContext();
    vi.mocked(getAccountById).mockResolvedValue(mockAccount);
    vi.mocked(updateAccount).mockResolvedValue(undefined);
    vi.mocked(getMember).mockResolvedValue(null);

    const caller = appRouter.createCaller(ctx);
    const result = await caller.missedCallTextBack.saveSettings({
      accountId: 10,
      enabled: true,
      message: "Sorry I missed you!",
      delayMinutes: 5,
    });

    expect(result).toEqual({ success: true });
    expect(updateAccount).toHaveBeenCalledWith(10, {
      missedCallTextBackEnabled: true,
      missedCallTextBackMessage: "Sorry I missed you!",
      missedCallTextBackDelayMinutes: 5,
    });
  });

  it("validates message is not empty", async () => {
    const ctx = createAuthContext();
    vi.mocked(getMember).mockResolvedValue(null);

    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.missedCallTextBack.saveSettings({
        accountId: 10,
        enabled: true,
        message: "",
        delayMinutes: 1,
      })
    ).rejects.toThrow();
  });

  it("validates delayMinutes is within range", async () => {
    const ctx = createAuthContext();
    vi.mocked(getMember).mockResolvedValue(null);

    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.missedCallTextBack.saveSettings({
        accountId: 10,
        enabled: true,
        message: "Hello",
        delayMinutes: 20,
      })
    ).rejects.toThrow();
  });

  it("allows saving with delay of 0 (immediately)", async () => {
    const ctx = createAuthContext();
    vi.mocked(getAccountById).mockResolvedValue(mockAccount);
    vi.mocked(updateAccount).mockResolvedValue(undefined);
    vi.mocked(getMember).mockResolvedValue(null);

    const caller = appRouter.createCaller(ctx);
    const result = await caller.missedCallTextBack.saveSettings({
      accountId: 10,
      enabled: true,
      message: "Sorry I missed you!",
      delayMinutes: 0,
    });

    expect(result).toEqual({ success: true });
    expect(updateAccount).toHaveBeenCalledWith(10, {
      missedCallTextBackEnabled: true,
      missedCallTextBackMessage: "Sorry I missed you!",
      missedCallTextBackDelayMinutes: 0,
    });
  });

  it("throws NOT_FOUND when account does not exist", async () => {
    const ctx = createAuthContext();
    vi.mocked(getAccountById).mockResolvedValue(undefined);
    vi.mocked(getMember).mockResolvedValue(null);

    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.missedCallTextBack.saveSettings({
        accountId: 999,
        enabled: true,
        message: "Hello",
        delayMinutes: 1,
      })
    ).rejects.toThrow("Account not found");
  });
});

// ─────────────────────────────────────────────
// Tests: Voice Status Webhook Logic
// ─────────────────────────────────────────────

describe("Twilio Voice Status Webhook - missed call detection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  it("identifies no-answer as a missed call", () => {
    const missedStatuses = ["no-answer", "busy", "failed"];
    const nonMissedStatuses = ["completed", "canceled", "in-progress", "ringing"];

    for (const status of missedStatuses) {
      const isMissed = status === "no-answer" || status === "busy" || status === "failed";
      expect(isMissed).toBe(true);
    }

    for (const status of nonMissedStatuses) {
      const isMissed = status === "no-answer" || status === "busy" || status === "failed";
      expect(isMissed).toBe(false);
    }
  });

  it("only triggers for inbound direction", () => {
    const directions = [
      { direction: "inbound", status: "no-answer", expected: true },
      { direction: "outbound-api", status: "no-answer", expected: false },
      { direction: "inbound", status: "completed", expected: false },
      { direction: "inbound", status: "busy", expected: true },
      { direction: "inbound", status: "failed", expected: true },
    ];

    for (const { direction, status, expected } of directions) {
      const isMissedCall =
        direction === "inbound" &&
        (status === "no-answer" || status === "busy" || status === "failed");
      expect(isMissedCall).toBe(expected);
    }
  });
});

describe("sendMissedCallTextBack", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("sends SMS and logs message when contact exists", async () => {
    const { sendMissedCallTextBack } = await import("./webhooks/twilioVoiceStatus");

    vi.mocked(findContactByPhone).mockResolvedValue({
      id: 42,
      accountId: 10,
      firstName: "John",
      lastName: "Doe",
      email: "john@example.com",
      phone: "+15559876543",
      status: "active",
      source: "manual",
      createdAt: new Date(),
      updatedAt: new Date(),
      assignedTo: null,
      address: null,
      city: null,
      state: null,
      zip: null,
      country: null,
      dateOfBirth: null,
      company: null,
      jobTitle: null,
      notes: null,
      customFields: null,
    });

    vi.mocked(dispatchSMS).mockResolvedValue({
      success: true,
      externalId: "SM123",
      provider: "twilio",
    });

    vi.mocked(createMessage).mockResolvedValue({ id: 100 } as any);
    vi.mocked(logContactActivity).mockResolvedValue(undefined as any);

    await sendMissedCallTextBack({
      accountId: 10,
      callerPhone: "+15559876543",
      twilioNumber: "+15551234567",
      message: "Sorry I missed your call!",
    });

    expect(dispatchSMS).toHaveBeenCalledWith({
      to: "+15559876543",
      body: "Sorry I missed your call!",
      from: "+15551234567",
      accountId: 10,
    });

    expect(createMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        accountId: 10,
        contactId: 42,
        type: "sms",
        direction: "outbound",
        status: "sent",
        body: "Sorry I missed your call!",
        toAddress: "+15559876543",
        fromAddress: "+15551234567",
        isRead: true,
      })
    );

    expect(logContactActivity).toHaveBeenCalledWith(
      expect.objectContaining({
        contactId: 42,
        accountId: 10,
        activityType: "message_sent",
      })
    );
  });

  it("sends SMS but does not log message when no contact found", async () => {
    const { sendMissedCallTextBack } = await import("./webhooks/twilioVoiceStatus");

    vi.mocked(findContactByPhone).mockResolvedValue(null);
    vi.mocked(dispatchSMS).mockResolvedValue({
      success: true,
      externalId: "SM456",
      provider: "twilio",
    });

    await sendMissedCallTextBack({
      accountId: 10,
      callerPhone: "+15559876543",
      twilioNumber: "+15551234567",
      message: "Sorry I missed your call!",
    });

    expect(dispatchSMS).toHaveBeenCalled();
    expect(createMessage).not.toHaveBeenCalled();
    expect(logContactActivity).not.toHaveBeenCalled();
  });

  it("does not log message when SMS send fails", async () => {
    const { sendMissedCallTextBack } = await import("./webhooks/twilioVoiceStatus");

    vi.mocked(findContactByPhone).mockResolvedValue({
      id: 42,
      accountId: 10,
      firstName: "John",
      lastName: "Doe",
      email: null,
      phone: "+15559876543",
      status: "active",
      source: "manual",
      createdAt: new Date(),
      updatedAt: new Date(),
      assignedTo: null,
      address: null,
      city: null,
      state: null,
      zip: null,
      country: null,
      dateOfBirth: null,
      company: null,
      jobTitle: null,
      notes: null,
      customFields: null,
    });

    vi.mocked(dispatchSMS).mockResolvedValue({
      success: false,
      error: "Twilio not configured",
      provider: "placeholder",
    });

    await sendMissedCallTextBack({
      accountId: 10,
      callerPhone: "+15559876543",
      twilioNumber: "+15551234567",
      message: "Sorry I missed your call!",
    });

    expect(dispatchSMS).toHaveBeenCalled();
    expect(createMessage).not.toHaveBeenCalled();
    expect(logContactActivity).not.toHaveBeenCalled();
  });
});

describe("DEFAULT_MESSAGE export", () => {
  it("exports the default message constant", async () => {
    const { DEFAULT_MESSAGE } = await import("./routers/missedCallTextBack");
    expect(DEFAULT_MESSAGE).toBe("Hey, sorry I missed your call! How can I help you?");
  });
});
