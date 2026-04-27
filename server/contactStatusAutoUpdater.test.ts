import { describe, expect, it, vi, beforeEach } from "vitest";

// ─────────────────────────────────────────────
// Mock the database layer
// ─────────────────────────────────────────────
const mockUpdate = vi.fn().mockReturnValue({
  set: vi.fn().mockReturnValue({
    where: vi.fn().mockResolvedValue(undefined),
  }),
});

vi.mock("../drizzle/schema", () => ({
  contacts: {
    id: "contacts.id",
    status: "contacts.status",
  },
}));

vi.mock("./db", () => ({
  getDb: vi.fn().mockResolvedValue({
    update: (...args: unknown[]) => mockUpdate(...args),
  }),
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn((...args: unknown[]) => ({ type: "eq", args })),
  and: vi.fn((...args: unknown[]) => ({ type: "and", args })),
  inArray: vi.fn((...args: unknown[]) => ({ type: "inArray", args })),
}));

import { autoPromoteOnOutbound } from "./services/contactStatusAutoUpdater";
import { getDb } from "./db";

describe("autoPromoteOnOutbound", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset the mock chain
    mockUpdate.mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined),
      }),
    });
  });

  it("calls db.update with correct status and where clause for a valid contactId", async () => {
    await autoPromoteOnOutbound(42);

    expect(getDb).toHaveBeenCalledOnce();
    expect(mockUpdate).toHaveBeenCalledOnce();

    // Verify .set() was called with { status: "contacted" }
    const setCall = mockUpdate.mock.results[0].value.set;
    expect(setCall).toHaveBeenCalledWith({ status: "contacted" });

    // Verify .where() was called (with and(eq(...), inArray(...)))
    const whereCall = setCall.mock.results[0].value.where;
    expect(whereCall).toHaveBeenCalledOnce();
  });

  it("does not throw when db returns null", async () => {
    (getDb as any).mockResolvedValueOnce(null);

    // Should not throw
    await expect(autoPromoteOnOutbound(42)).resolves.toBeUndefined();
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("does not throw when db.update throws (error is caught)", async () => {
    mockUpdate.mockImplementationOnce(() => {
      throw new Error("DB connection lost");
    });

    // Should not throw — errors are caught internally
    await expect(autoPromoteOnOutbound(42)).resolves.toBeUndefined();
  });

  it("only targets new and uncontacted statuses via inArray", async () => {
    const { inArray } = await import("drizzle-orm");

    await autoPromoteOnOutbound(99);

    // inArray should be called with contacts.status and ["new", "uncontacted"]
    expect(inArray).toHaveBeenCalledWith(
      "contacts.status",
      ["new", "uncontacted"]
    );
  });
});

// ─────────────────────────────────────────────
// Integration: billedDispatch calls autoPromoteOnOutbound
// ─────────────────────────────────────────────
describe("billedDispatch integration with autoPromoteOnOutbound", () => {
  // We test that billedDispatchSMS and billedDispatchEmail call
  // autoPromoteOnOutbound when the send succeeds and contactId is present.

  const mockAutoPromote = vi.fn().mockResolvedValue(undefined);

  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it("billedDispatchSMS calls autoPromoteOnOutbound on successful send with contactId", async () => {
    // Mock dependencies
    vi.doMock("./services/messaging", () => ({
      dispatchSMS: vi.fn().mockResolvedValue({ success: true, externalId: "sms-1", provider: "blooio" }),
      dispatchEmail: vi.fn(),
    }));
    vi.doMock("./services/usageTracker", () => ({
      chargeBeforeSend: vi.fn().mockResolvedValue({ usageEventId: 1, totalCost: 0.01 }),
      reverseCharge: vi.fn(),
    }));
    vi.doMock("./services/contactStatusAutoUpdater", () => ({
      autoPromoteOnOutbound: mockAutoPromote,
    }));

    const { billedDispatchSMS } = await import("./services/billedDispatch");

    const result = await billedDispatchSMS({
      accountId: 1,
      to: "+15551234567",
      body: "Hello",
      contactId: 42,
    });

    expect(result.success).toBe(true);
    expect(mockAutoPromote).toHaveBeenCalledWith(42);
  });

  it("billedDispatchSMS does NOT call autoPromoteOnOutbound when send fails", async () => {
    vi.doMock("./services/messaging", () => ({
      dispatchSMS: vi.fn().mockResolvedValue({ success: false, error: "Provider down", provider: "blooio" }),
      dispatchEmail: vi.fn(),
    }));
    vi.doMock("./services/usageTracker", () => ({
      chargeBeforeSend: vi.fn().mockResolvedValue({ usageEventId: 2, totalCost: 0.01 }),
      reverseCharge: vi.fn(),
    }));
    vi.doMock("./services/contactStatusAutoUpdater", () => ({
      autoPromoteOnOutbound: mockAutoPromote,
    }));

    const { billedDispatchSMS } = await import("./services/billedDispatch");

    const result = await billedDispatchSMS({
      accountId: 1,
      to: "+15551234567",
      body: "Hello",
      contactId: 42,
    });

    expect(result.success).toBe(false);
    expect(mockAutoPromote).not.toHaveBeenCalled();
  });

  it("billedDispatchSMS does NOT call autoPromoteOnOutbound when contactId is missing", async () => {
    vi.doMock("./services/messaging", () => ({
      dispatchSMS: vi.fn().mockResolvedValue({ success: true, externalId: "sms-3", provider: "blooio" }),
      dispatchEmail: vi.fn(),
    }));
    vi.doMock("./services/usageTracker", () => ({
      chargeBeforeSend: vi.fn().mockResolvedValue({ usageEventId: 3, totalCost: 0.01 }),
      reverseCharge: vi.fn(),
    }));
    vi.doMock("./services/contactStatusAutoUpdater", () => ({
      autoPromoteOnOutbound: mockAutoPromote,
    }));

    const { billedDispatchSMS } = await import("./services/billedDispatch");

    const result = await billedDispatchSMS({
      accountId: 1,
      to: "+15551234567",
      body: "Hello",
      // no contactId
    });

    expect(result.success).toBe(true);
    expect(mockAutoPromote).not.toHaveBeenCalled();
  });

  it("billedDispatchEmail calls autoPromoteOnOutbound on successful send with contactId", async () => {
    vi.doMock("./services/messaging", () => ({
      dispatchSMS: vi.fn(),
      dispatchEmail: vi.fn().mockResolvedValue({ success: true, externalId: "email-1", provider: "sendgrid" }),
    }));
    vi.doMock("./services/usageTracker", () => ({
      chargeBeforeSend: vi.fn().mockResolvedValue({ usageEventId: 4, totalCost: 0.005 }),
      reverseCharge: vi.fn(),
    }));
    vi.doMock("./services/contactStatusAutoUpdater", () => ({
      autoPromoteOnOutbound: mockAutoPromote,
    }));

    const { billedDispatchEmail } = await import("./services/billedDispatch");

    const result = await billedDispatchEmail({
      accountId: 1,
      to: "test@example.com",
      subject: "Test",
      body: "Hello",
      contactId: 55,
    });

    expect(result.success).toBe(true);
    expect(mockAutoPromote).toHaveBeenCalledWith(55);
  });

  it("billedDispatchEmail does NOT call autoPromoteOnOutbound when send fails", async () => {
    vi.doMock("./services/messaging", () => ({
      dispatchSMS: vi.fn(),
      dispatchEmail: vi.fn().mockResolvedValue({ success: false, error: "Invalid email", provider: "sendgrid" }),
    }));
    vi.doMock("./services/usageTracker", () => ({
      chargeBeforeSend: vi.fn().mockResolvedValue({ usageEventId: 5, totalCost: 0.005 }),
      reverseCharge: vi.fn(),
    }));
    vi.doMock("./services/contactStatusAutoUpdater", () => ({
      autoPromoteOnOutbound: mockAutoPromote,
    }));

    const { billedDispatchEmail } = await import("./services/billedDispatch");

    const result = await billedDispatchEmail({
      accountId: 1,
      to: "test@example.com",
      subject: "Test",
      body: "Hello",
      contactId: 55,
    });

    expect(result.success).toBe(false);
    expect(mockAutoPromote).not.toHaveBeenCalled();
  });
});
