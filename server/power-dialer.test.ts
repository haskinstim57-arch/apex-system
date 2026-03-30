import { describe, expect, it, vi, beforeEach } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

// ─── Mock DB helpers ───
vi.mock("./db", async () => {
  const actual = await vi.importActual<typeof import("./db")>("./db");
  return {
    ...actual,
    // Dialer sessions
    createDialerSession: vi.fn().mockResolvedValue({ id: 1 }),
    getDialerSessionById: vi.fn().mockResolvedValue(null),
    listDialerSessions: vi.fn().mockResolvedValue({ data: [], total: 0 }),
    updateDialerSession: vi.fn().mockResolvedValue(undefined),
    deleteDialerSession: vi.fn().mockResolvedValue(undefined),
    // Dialer scripts
    createDialerScript: vi.fn().mockResolvedValue({ id: 1 }),
    getDialerScriptById: vi.fn().mockResolvedValue(null),
    listDialerScripts: vi.fn().mockResolvedValue([]),
    updateDialerScript: vi.fn().mockResolvedValue(undefined),
    deleteDialerScript: vi.fn().mockResolvedValue(undefined),
    // Auth/access
    getMember: vi.fn().mockResolvedValue({ id: 1, role: "owner", isActive: true }),
    // Accounts
    getAccountById: vi.fn().mockResolvedValue({
      id: 1,
      name: "Test Account",
      businessHoursConfig: null,
      voiceAgentEnabled: true,
    }),
    getDialerAnalytics: vi.fn().mockResolvedValue({ totalCalls: 0, answered: 0, noAnswer: 0 }),
    // Contacts
    getContactById: vi.fn().mockResolvedValue(null),
    listContacts: vi.fn().mockResolvedValue({ data: [], total: 0 }),
    // AI Calls
    createAICall: vi.fn().mockResolvedValue({ id: 100 }),
    updateAICall: vi.fn().mockResolvedValue(undefined),
    // Activity
    logContactActivity: vi.fn(),
    createContactNote: vi.fn().mockResolvedValue({ id: 1 }),
  };
});

// ─── Mock message queue service ───
vi.mock("./services/messageQueue", () => ({
  enqueueMessage: vi.fn().mockResolvedValue({ id: 1 }),
}));

// ─── Mock business hours util ───
vi.mock("./utils/businessHours", () => ({
  isWithinBusinessHours: vi.fn().mockReturnValue(true),
  getBusinessHoursBlockMessage: vi.fn().mockReturnValue("Outside business hours"),
}));

// ─── Mock VAPI service ───
vi.mock("./services/vapi", () => ({
  createVapiCall: vi.fn().mockResolvedValue({ id: "vapi-123", status: "queued" }),
  resolveAssistantId: vi.fn().mockReturnValue("assistant-123"),
  mapVapiStatus: vi.fn().mockReturnValue("queued"),
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

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createTestContext(overrides?: Partial<AuthenticatedUser>): TrpcContext {
  const user: AuthenticatedUser = {
    id: 1,
    openId: "test-user",
    email: "test@example.com",
    name: "Test User",
    loginMethod: "email",
    role: "user",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
    ...overrides,
  };

  return {
    user,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: vi.fn() } as unknown as TrpcContext["res"],
  };
}

describe("Power Dialer - Session Management", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates a dialer session with valid input", async () => {
    const ctx = createTestContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.powerDialer.createSession({
      accountId: 1,
      contactIds: [10, 20, 30],
    });

    expect(result).toHaveProperty("id");
    expect(result).toHaveProperty("totalContacts", 3);
  });

  it("creates a session with a script ID", async () => {
    const ctx = createTestContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.powerDialer.createSession({
      accountId: 1,
      contactIds: [10, 20],
      scriptId: 5,
    });

    expect(result).toHaveProperty("id");
    expect(result).toHaveProperty("totalContacts", 2);
  });

  it("rejects session creation with empty contact list", async () => {
    const ctx = createTestContext();
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.powerDialer.createSession({
        accountId: 1,
        contactIds: [],
      })
    ).rejects.toThrow();
  });

  it("lists sessions for an account", async () => {
    const ctx = createTestContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.powerDialer.listSessions({
      accountId: 1,
    });

    expect(result).toHaveProperty("data");
    expect(result).toHaveProperty("total");
    expect(Array.isArray(result.data)).toBe(true);
  });

  it("returns not found for non-existent session", async () => {
    const ctx = createTestContext();
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.powerDialer.getSession({ id: 999, accountId: 1 })
    ).rejects.toThrow("Session not found");
  });

  it("completes a session", async () => {
    const { getDialerSessionById } = await import("./db");
    (getDialerSessionById as any).mockResolvedValueOnce({
      id: 1,
      accountId: 1,
      userId: 1,
      contactIds: JSON.stringify([10, 20]),
      status: "active",
      currentIndex: 1,
      results: JSON.stringify([{ contactId: 10, disposition: "answered", notes: "" }]),
      totalContacts: 2,
      createdAt: new Date(),
    });

    const ctx = createTestContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.powerDialer.completeSession({
      sessionId: 1,
      accountId: 1,
    });

    expect(result).toEqual({ success: true, totalProcessed: 1 });
  });

  it("pauses and resumes a session", async () => {
    const { getDialerSessionById, updateDialerSession } = await import("./db");

    // First call: pause (active -> paused)
    (getDialerSessionById as any).mockResolvedValueOnce({
      id: 1,
      accountId: 1,
      userId: 1,
      status: "active",
      contactIds: JSON.stringify([10, 20]),
      currentIndex: 0,
      results: JSON.stringify([]),
      totalContacts: 2,
      createdAt: new Date(),
    });

    const ctx = createTestContext();
    const caller = appRouter.createCaller(ctx);

    const pauseResult = await caller.powerDialer.pauseSession({
      sessionId: 1,
      accountId: 1,
    });

    expect(pauseResult.status).toBe("paused");

    // Second call: resume (paused -> active)
    (getDialerSessionById as any).mockResolvedValueOnce({
      id: 1,
      accountId: 1,
      userId: 1,
      status: "paused",
      contactIds: JSON.stringify([10, 20]),
      currentIndex: 0,
      results: JSON.stringify([]),
      totalContacts: 2,
      createdAt: new Date(),
    });

    const resumeResult = await caller.powerDialer.pauseSession({
      sessionId: 1,
      accountId: 1,
    });

    expect(resumeResult.status).toBe("active");
  });
});

describe("Power Dialer - Disposition Recording", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("records a disposition and advances to next contact", async () => {
    const { getDialerSessionById, updateDialerSession, createContactNote } = await import("./db");

    (getDialerSessionById as any).mockResolvedValueOnce({
      id: 1,
      accountId: 1,
      userId: 1,
      contactIds: JSON.stringify([10, 20, 30]),
      status: "active",
      currentIndex: 0,
      results: JSON.stringify([]),
      totalContacts: 3,
      createdAt: new Date(),
    });

    const ctx = createTestContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.powerDialer.recordDisposition({
      sessionId: 1,
      accountId: 1,
      contactId: 10,
      disposition: "answered",
      notes: "Great call",
      callId: 100,
    });

    expect(result.nextIndex).toBe(1);
    expect(result.isComplete).toBe(false);
    expect(result.totalProcessed).toBe(1);
    expect(updateDialerSession).toHaveBeenCalled();
    expect(createContactNote).toHaveBeenCalled();
  });

  it("completes session when last contact is processed", async () => {
    const { getDialerSessionById, updateDialerSession } = await import("./db");

    (getDialerSessionById as any).mockResolvedValueOnce({
      id: 1,
      accountId: 1,
      userId: 1,
      contactIds: JSON.stringify([10]),
      status: "active",
      currentIndex: 0,
      results: JSON.stringify([]),
      totalContacts: 1,
      createdAt: new Date(),
    });

    const ctx = createTestContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.powerDialer.recordDisposition({
      sessionId: 1,
      accountId: 1,
      contactId: 10,
      disposition: "no_answer",
    });

    expect(result.isComplete).toBe(true);
    expect(result.nextIndex).toBe(1);
  });

  it("records skip disposition", async () => {
    const { getDialerSessionById } = await import("./db");

    (getDialerSessionById as any).mockResolvedValueOnce({
      id: 1,
      accountId: 1,
      userId: 1,
      contactIds: JSON.stringify([10, 20]),
      status: "active",
      currentIndex: 0,
      results: JSON.stringify([]),
      totalContacts: 2,
      createdAt: new Date(),
    });

    const ctx = createTestContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.powerDialer.recordDisposition({
      sessionId: 1,
      accountId: 1,
      contactId: 10,
      disposition: "skipped",
    });

    expect(result.nextIndex).toBe(1);
    expect(result.isComplete).toBe(false);
  });
});

describe("Power Dialer - Call Initiation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("initiates a call to a contact with a phone number", async () => {
    const { getContactById } = await import("./db");

    (getContactById as any).mockResolvedValueOnce({
      id: 10,
      firstName: "John",
      lastName: "Smith",
      phone: "+15551234567",
      email: "john@test.com",
      accountId: 1,
      leadSource: "facebook",
    });

    const ctx = createTestContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.powerDialer.initiateCall({
      sessionId: 1,
      accountId: 1,
      contactId: 10,
    });

    expect(result.success).toBe(true);
    expect(result.callId).toBeDefined();
    expect(result.externalCallId).toBe("vapi-123");
  });

  it("fails when contact has no phone number", async () => {
    const { getContactById } = await import("./db");

    (getContactById as any).mockResolvedValueOnce({
      id: 10,
      firstName: "John",
      lastName: "Smith",
      phone: null,
      email: "john@test.com",
      accountId: 1,
    });

    const ctx = createTestContext();
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.powerDialer.initiateCall({
        sessionId: 1,
        accountId: 1,
        contactId: 10,
      })
    ).rejects.toThrow("Contact has no phone number");
  });

  it("fails when contact is not found", async () => {
    const { getContactById } = await import("./db");
    (getContactById as any).mockResolvedValueOnce(null);

    const ctx = createTestContext();
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.powerDialer.initiateCall({
        sessionId: 1,
        accountId: 1,
        contactId: 999,
      })
    ).rejects.toThrow("Contact not found");
  });
});

describe("Power Dialer - Script Management", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates a call script", async () => {
    const ctx = createTestContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.powerDialer.createScript({
      accountId: 1,
      name: "Test Script",
      content: "Hello, this is a test script for the power dialer.",
    });

    expect(result).toHaveProperty("id");
  });

  it("lists scripts for an account", async () => {
    const ctx = createTestContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.powerDialer.listScripts({ accountId: 1 });

    expect(Array.isArray(result)).toBe(true);
  });

  it("returns not found for non-existent script", async () => {
    const ctx = createTestContext();
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.powerDialer.getScript({ id: 999, accountId: 1 })
    ).rejects.toThrow("Script not found");
  });

  it("updates a script", async () => {
    const { getDialerScriptById } = await import("./db");

    (getDialerScriptById as any).mockResolvedValueOnce({
      id: 1,
      accountId: 1,
      name: "Old Name",
      content: "Old content",
      createdById: 1,
      createdAt: new Date(),
    });

    const ctx = createTestContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.powerDialer.updateScript({
      id: 1,
      accountId: 1,
      name: "Updated Name",
      content: "Updated content",
    });

    expect(result).toEqual({ success: true });
  });

  it("deletes a script", async () => {
    const { getDialerScriptById } = await import("./db");

    (getDialerScriptById as any).mockResolvedValueOnce({
      id: 1,
      accountId: 1,
      name: "To Delete",
      content: "Content",
      createdById: 1,
      createdAt: new Date(),
    });

    const ctx = createTestContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.powerDialer.deleteScript({
      id: 1,
      accountId: 1,
    });

    expect(result).toEqual({ success: true });
  });

  it("rejects script creation with empty name", async () => {
    const ctx = createTestContext();
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.powerDialer.createScript({
        accountId: 1,
        name: "",
        content: "Some content",
      })
    ).rejects.toThrow();
  });

  it("rejects script creation with empty content", async () => {
    const ctx = createTestContext();
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.powerDialer.createScript({
        accountId: 1,
        name: "Valid Name",
        content: "",
      })
    ).rejects.toThrow();
  });
});

describe("Power Dialer - Access Control", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("allows admin users to access any account", async () => {
    const ctx = createTestContext({ role: "admin" });
    const caller = appRouter.createCaller(ctx);

    // Admin should not throw even without membership
    const result = await caller.powerDialer.listSessions({ accountId: 999 });
    expect(result).toHaveProperty("data");
  });

  it("denies access to users without membership", async () => {
    const { getMember } = await import("./db");
    (getMember as any).mockResolvedValueOnce(null);

    const ctx = createTestContext({ role: "user" });
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.powerDialer.listSessions({ accountId: 999 })
    ).rejects.toThrow("You do not have access to this account");
  });
});

describe("Power Dialer - Contact Filtering", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("fetches contacts by tag and filters to those with phone numbers", async () => {
    const { listContacts } = await import("./db");

    (listContacts as any).mockResolvedValueOnce({
      data: [
        { id: 1, phone: "+15551234567", firstName: "John" },
        { id: 2, phone: null, firstName: "Jane" },
        { id: 3, phone: "+15559876543", firstName: "Bob" },
      ],
      total: 3,
    });

    const ctx = createTestContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.powerDialer.getContactsByTag({
      accountId: 1,
      tag: "lead",
    });

    expect(result.contacts).toHaveLength(2);
    expect(result.total).toBe(2);
    expect(result.contacts.every((c: any) => c.phone)).toBe(true);
  });
});
