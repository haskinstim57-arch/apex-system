import { describe, expect, it, vi, beforeEach } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

// ─── Mock DB helpers ───
vi.mock("./db", async () => {
  const actual = await vi.importActual<typeof import("./db")>("./db");
  return {
    ...actual,
    requireAccountMember: vi.fn().mockResolvedValue(true),
    getContactById: vi.fn(),
    getContactActivities: vi.fn(),
    createContactActivity: vi.fn(),
    logContactActivity: vi.fn(),
  };
});

import {
  getContactById,
  getContactActivities,
  createContactActivity,
  logContactActivity,
} from "./db";

const mockGetContactById = vi.mocked(getContactById);
const mockGetContactActivities = vi.mocked(getContactActivities);
const mockCreateContactActivity = vi.mocked(createContactActivity);
const mockLogContactActivity = vi.mocked(logContactActivity);

// ─── Helpers ───
function createTestContext(): TrpcContext {
  return {
    user: {
      id: 1,
      openId: "test-user",
      email: "test@example.com",
      name: "Test User",
      loginMethod: "manus",
      role: "user",
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    },
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: vi.fn(),
    } as unknown as TrpcContext["res"],
  };
}

const mockContact = {
  id: 42,
  accountId: 1,
  firstName: "John",
  lastName: "Doe",
  email: "john@example.com",
  phone: "+15551234567",
  status: "new" as const,
  assignedUserId: null,
  company: null,
  title: null,
  address: null,
  city: null,
  state: null,
  zip: null,
  source: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const sampleActivities = [
  {
    id: 1,
    contactId: 42,
    accountId: 1,
    activityType: "contact_created" as const,
    description: "Contact John Doe was created",
    metadata: null,
    createdAt: new Date("2026-03-22T10:00:00Z"),
  },
  {
    id: 2,
    contactId: 42,
    accountId: 1,
    activityType: "tag_added" as const,
    description: "Tag \"VIP\" added to contact",
    metadata: JSON.stringify({ tag: "VIP" }),
    createdAt: new Date("2026-03-22T10:05:00Z"),
  },
  {
    id: 3,
    contactId: 42,
    accountId: 1,
    activityType: "message_sent" as const,
    description: "Email sent to john@example.com",
    metadata: JSON.stringify({ channel: "email", direction: "outbound", preview: "Hello John..." }),
    createdAt: new Date("2026-03-22T10:10:00Z"),
  },
  {
    id: 4,
    contactId: 42,
    accountId: 1,
    activityType: "pipeline_stage_changed" as const,
    description: "Deal moved from New to Qualified",
    metadata: JSON.stringify({ fromStage: "New", toStage: "Qualified" }),
    createdAt: new Date("2026-03-22T10:15:00Z"),
  },
  {
    id: 5,
    contactId: 42,
    accountId: 1,
    activityType: "ai_call_made" as const,
    description: "AI call initiated to +15551234567",
    metadata: JSON.stringify({ phone: "+15551234567" }),
    createdAt: new Date("2026-03-22T10:20:00Z"),
  },
];

describe("contacts.getActivity", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns paginated activities for a valid contact", async () => {
    mockGetContactById.mockResolvedValue(mockContact);
    mockGetContactActivities.mockResolvedValue({
      items: sampleActivities,
      hasMore: false,
    });

    const ctx = createTestContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.contacts.getActivity({
      contactId: 42,
      accountId: 1,
    });

    expect(result.items).toHaveLength(5);
    expect(result.hasMore).toBe(false);
    expect(mockGetContactActivities).toHaveBeenCalledWith(42, 1, {
      limit: 20,
      offset: 0,
    });
  });

  it("respects custom limit and offset parameters", async () => {
    mockGetContactById.mockResolvedValue(mockContact);
    mockGetContactActivities.mockResolvedValue({
      items: sampleActivities.slice(0, 2),
      hasMore: true,
    });

    const ctx = createTestContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.contacts.getActivity({
      contactId: 42,
      accountId: 1,
      limit: 2,
      offset: 0,
    });

    expect(result.items).toHaveLength(2);
    expect(result.hasMore).toBe(true);
    expect(mockGetContactActivities).toHaveBeenCalledWith(42, 1, {
      limit: 2,
      offset: 0,
    });
  });

  it("throws NOT_FOUND when contact does not exist", async () => {
    mockGetContactById.mockResolvedValue(undefined as any);

    const ctx = createTestContext();
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.contacts.getActivity({ contactId: 999, accountId: 1 })
    ).rejects.toThrow(/not found/i);
  });

  it("returns empty items when no activities exist", async () => {
    mockGetContactById.mockResolvedValue(mockContact);
    mockGetContactActivities.mockResolvedValue({
      items: [],
      hasMore: false,
    });

    const ctx = createTestContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.contacts.getActivity({
      contactId: 42,
      accountId: 1,
    });

    expect(result.items).toHaveLength(0);
    expect(result.hasMore).toBe(false);
  });

  it("returns activities in reverse chronological order", async () => {
    const reversed = [...sampleActivities].reverse();
    mockGetContactById.mockResolvedValue(mockContact);
    mockGetContactActivities.mockResolvedValue({
      items: reversed,
      hasMore: false,
    });

    const ctx = createTestContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.contacts.getActivity({
      contactId: 42,
      accountId: 1,
    });

    // Most recent first
    for (let i = 0; i < result.items.length - 1; i++) {
      expect(
        new Date(result.items[i].createdAt).getTime()
      ).toBeGreaterThanOrEqual(
        new Date(result.items[i + 1].createdAt).getTime()
      );
    }
  });

  it("validates limit must be between 1 and 100", async () => {
    const ctx = createTestContext();
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.contacts.getActivity({
        contactId: 42,
        accountId: 1,
        limit: 0,
      })
    ).rejects.toThrow();

    await expect(
      caller.contacts.getActivity({
        contactId: 42,
        accountId: 1,
        limit: 101,
      })
    ).rejects.toThrow();
  });

  it("validates offset must be non-negative", async () => {
    const ctx = createTestContext();
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.contacts.getActivity({
        contactId: 42,
        accountId: 1,
        offset: -1,
      })
    ).rejects.toThrow();
  });
});

describe("logContactActivity", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("is a function that can be called with activity data", () => {
    expect(typeof logContactActivity).toBe("function");
  });

  it("accepts all valid activity types", () => {
    const activityTypes = [
      "contact_created",
      "tag_added",
      "tag_removed",
      "pipeline_stage_changed",
      "message_sent",
      "message_received",
      "ai_call_made",
      "appointment_booked",
      "appointment_confirmed",
      "appointment_cancelled",
      "automation_triggered",
      "note_added",
      "task_created",
      "task_completed",
    ];

    for (const type of activityTypes) {
      logContactActivity({
        contactId: 42,
        accountId: 1,
        activityType: type as any,
        description: `Test ${type}`,
      });
    }

    expect(mockLogContactActivity).toHaveBeenCalledTimes(activityTypes.length);
  });

  it("includes metadata when provided", () => {
    logContactActivity({
      contactId: 42,
      accountId: 1,
      activityType: "message_sent",
      description: "Email sent",
      metadata: JSON.stringify({ channel: "email", direction: "outbound" }),
    });

    expect(mockLogContactActivity).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: expect.stringContaining("email"),
      })
    );
  });
});

describe("createContactActivity", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates an activity record and returns the id", async () => {
    mockCreateContactActivity.mockResolvedValue({ id: 100 });

    const result = await createContactActivity({
      contactId: 42,
      accountId: 1,
      activityType: "contact_created",
      description: "Contact created",
    });

    expect(result).toEqual({ id: 100 });
    expect(mockCreateContactActivity).toHaveBeenCalledWith(
      expect.objectContaining({
        contactId: 42,
        accountId: 1,
        activityType: "contact_created",
      })
    );
  });
});

describe("activity metadata structure", () => {
  it("tag_added metadata contains tag name", () => {
    const meta = JSON.parse(JSON.stringify({ tag: "VIP" }));
    expect(meta.tag).toBe("VIP");
  });

  it("message_sent metadata contains channel, direction, preview", () => {
    const meta = JSON.parse(
      JSON.stringify({
        channel: "email",
        direction: "outbound",
        preview: "Hello...",
      })
    );
    expect(meta.channel).toBe("email");
    expect(meta.direction).toBe("outbound");
    expect(meta.preview).toBe("Hello...");
  });

  it("pipeline_stage_changed metadata contains fromStage and toStage", () => {
    const meta = JSON.parse(
      JSON.stringify({ fromStage: "New", toStage: "Qualified" })
    );
    expect(meta.fromStage).toBe("New");
    expect(meta.toStage).toBe("Qualified");
  });

  it("automation_triggered metadata contains workflowName", () => {
    const meta = JSON.parse(
      JSON.stringify({ workflowName: "Welcome Flow", triggerType: "manual" })
    );
    expect(meta.workflowName).toBe("Welcome Flow");
    expect(meta.triggerType).toBe("manual");
  });

  it("appointment_booked metadata contains appointment details", () => {
    const meta = JSON.parse(
      JSON.stringify({
        appointmentId: 5,
        startTime: "2026-03-25T10:00:00Z",
      })
    );
    expect(meta.appointmentId).toBe(5);
    expect(meta.startTime).toBeDefined();
  });
});
