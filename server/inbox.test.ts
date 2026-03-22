import { describe, expect, it, vi, beforeEach } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

// ─── Mock DB helpers ───
vi.mock("./db", async () => {
  const actual = await vi.importActual("./db");
  return {
    ...actual,
    getMember: vi.fn(),
    getConversations: vi.fn(),
    getThread: vi.fn(),
    markMessagesAsRead: vi.fn(),
    getUnreadMessageCount: vi.fn(),
    getContactById: vi.fn(),
    createMessage: vi.fn(),
    createAuditLog: vi.fn(),
  };
});

// ─── Mock messaging service ───
vi.mock("./services/messaging", () => ({
  dispatchSMS: vi.fn().mockResolvedValue({ success: true, externalId: "sms-123" }),
  dispatchEmail: vi.fn().mockResolvedValue({ success: true, externalId: "email-456" }),
}));

import {
  getMember,
  getConversations,
  getThread,
  markMessagesAsRead,
  getUnreadMessageCount,
  getContactById,
  createMessage,
  createAuditLog,
} from "./db";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createAuthContext(overrides?: Partial<AuthenticatedUser>): TrpcContext {
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
    res: { clearCookie: vi.fn() } as unknown as TrpcContext["res"],
  };
}

function createAdminContext(): TrpcContext {
  return createAuthContext({ role: "admin" });
}

const mockConversations = {
  conversations: [
    {
      contactId: 10,
      contactName: "John Doe",
      contactEmail: "john@example.com",
      contactPhone: "+15551234567",
      contactAvatar: null,
      unreadCount: 3,
      lastMessageAt: new Date("2026-03-22T10:00:00Z"),
      latestMessage: {
        id: 100,
        type: "sms",
        direction: "inbound",
        subject: null,
        body: "Hey, I need help with my application",
        isRead: false,
        createdAt: new Date("2026-03-22T10:00:00Z"),
      },
    },
    {
      contactId: 20,
      contactName: "Jane Smith",
      contactEmail: "jane@example.com",
      contactPhone: null,
      contactAvatar: null,
      unreadCount: 0,
      lastMessageAt: new Date("2026-03-21T15:30:00Z"),
      latestMessage: {
        id: 99,
        type: "email",
        direction: "outbound",
        subject: "Loan Update",
        body: "Your loan application has been approved",
        isRead: true,
        createdAt: new Date("2026-03-21T15:30:00Z"),
      },
    },
  ],
  total: 2,
};

const mockThread = [
  {
    id: 98,
    accountId: 1,
    contactId: 10,
    userId: 1,
    type: "sms",
    direction: "inbound",
    status: "delivered",
    subject: null,
    body: "Hi, I have a question about rates",
    toAddress: "+15559999999",
    fromAddress: "+15551234567",
    externalId: null,
    errorMessage: null,
    sentAt: null,
    deliveredAt: new Date("2026-03-22T09:00:00Z"),
    isRead: true,
    readAt: new Date("2026-03-22T09:05:00Z"),
    createdAt: new Date("2026-03-22T09:00:00Z"),
    updatedAt: new Date("2026-03-22T09:00:00Z"),
  },
  {
    id: 99,
    accountId: 1,
    contactId: 10,
    userId: 1,
    type: "sms",
    direction: "outbound",
    status: "sent",
    subject: null,
    body: "Sure! Current rates are 6.5% for 30yr fixed.",
    toAddress: "+15551234567",
    fromAddress: "+15559999999",
    externalId: "sms-abc",
    errorMessage: null,
    sentAt: new Date("2026-03-22T09:30:00Z"),
    deliveredAt: null,
    isRead: true,
    readAt: null,
    createdAt: new Date("2026-03-22T09:30:00Z"),
    updatedAt: new Date("2026-03-22T09:30:00Z"),
  },
  {
    id: 100,
    accountId: 1,
    contactId: 10,
    userId: 1,
    type: "sms",
    direction: "inbound",
    status: "delivered",
    subject: null,
    body: "Hey, I need help with my application",
    toAddress: "+15559999999",
    fromAddress: "+15551234567",
    externalId: null,
    errorMessage: null,
    sentAt: null,
    deliveredAt: new Date("2026-03-22T10:00:00Z"),
    isRead: false,
    readAt: null,
    createdAt: new Date("2026-03-22T10:00:00Z"),
    updatedAt: new Date("2026-03-22T10:00:00Z"),
  },
];

beforeEach(() => {
  vi.clearAllMocks();
  // Default: user is a member
  (getMember as any).mockResolvedValue({
    userId: 1,
    accountId: 1,
    role: "owner",
    isActive: true,
  });
});

describe("inbox.getConversations", () => {
  it("returns conversations for a valid account member", async () => {
    (getConversations as any).mockResolvedValue(mockConversations);
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.inbox.getConversations({ accountId: 1 });

    expect(result.conversations).toHaveLength(2);
    expect(result.total).toBe(2);
    expect(result.conversations[0].contactName).toBe("John Doe");
    expect(result.conversations[0].unreadCount).toBe(3);
    expect(getConversations).toHaveBeenCalledWith(
      expect.objectContaining({ accountId: 1 })
    );
  });

  it("filters by type when specified", async () => {
    (getConversations as any).mockResolvedValue({ conversations: [], total: 0 });
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    await caller.inbox.getConversations({ accountId: 1, type: "sms" });

    expect(getConversations).toHaveBeenCalledWith(
      expect.objectContaining({ accountId: 1, type: "sms" })
    );
  });

  it("filters unread only when specified", async () => {
    (getConversations as any).mockResolvedValue({ conversations: [], total: 0 });
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    await caller.inbox.getConversations({ accountId: 1, unreadOnly: true });

    expect(getConversations).toHaveBeenCalledWith(
      expect.objectContaining({ accountId: 1, unreadOnly: true })
    );
  });

  it("passes search parameter", async () => {
    (getConversations as any).mockResolvedValue({ conversations: [], total: 0 });
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    await caller.inbox.getConversations({ accountId: 1, search: "john" });

    expect(getConversations).toHaveBeenCalledWith(
      expect.objectContaining({ search: "john" })
    );
  });

  it("rejects non-member access", async () => {
    (getMember as any).mockResolvedValue(null);
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.inbox.getConversations({ accountId: 999 })
    ).rejects.toThrow(/access/i);
  });

  it("allows admin access", async () => {
    (getConversations as any).mockResolvedValue({ conversations: [], total: 0 });
    const ctx = createAdminContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.inbox.getConversations({ accountId: 1 });
    expect(result.total).toBe(0);
  });
});

describe("inbox.getThread", () => {
  it("returns message thread for a valid contact", async () => {
    (getContactById as any).mockResolvedValue({
      id: 10,
      accountId: 1,
      firstName: "John",
      lastName: "Doe",
    });
    (getThread as any).mockResolvedValue(mockThread);
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.inbox.getThread({ accountId: 1, contactId: 10 });

    expect(result).toHaveLength(3);
    expect(result[0].direction).toBe("inbound");
    expect(result[1].direction).toBe("outbound");
    expect(result[2].direction).toBe("inbound");
  });

  it("throws NOT_FOUND for non-existent contact", async () => {
    (getContactById as any).mockResolvedValue(null);
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.inbox.getThread({ accountId: 1, contactId: 999 })
    ).rejects.toThrow(/not found/i);
  });

  it("rejects non-member access", async () => {
    (getMember as any).mockResolvedValue(null);
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.inbox.getThread({ accountId: 999, contactId: 10 })
    ).rejects.toThrow(/access/i);
  });
});

describe("inbox.markAsRead", () => {
  it("marks messages as read for a contact", async () => {
    (markMessagesAsRead as any).mockResolvedValue(undefined);
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.inbox.markAsRead({ accountId: 1, contactId: 10 });

    expect(result).toEqual({ success: true });
    expect(markMessagesAsRead).toHaveBeenCalledWith(10, 1);
  });

  it("rejects non-member access", async () => {
    (getMember as any).mockResolvedValue(null);
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.inbox.markAsRead({ accountId: 999, contactId: 10 })
    ).rejects.toThrow(/access/i);
  });
});

describe("inbox.sendReply", () => {
  beforeEach(() => {
    (getContactById as any).mockResolvedValue({
      id: 10,
      accountId: 1,
      firstName: "John",
      lastName: "Doe",
      email: "john@example.com",
      phone: "+15551234567",
    });
    (createMessage as any).mockResolvedValue({ id: 200 });
    (createAuditLog as any).mockResolvedValue(undefined);
  });

  it("sends an SMS reply", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.inbox.sendReply({
      accountId: 1,
      contactId: 10,
      type: "sms",
      body: "Thanks for reaching out!",
    });

    expect(result.id).toBe(200);
    expect(result.status).toBe("pending");
    expect(createMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "sms",
        direction: "outbound",
        body: "Thanks for reaching out!",
        toAddress: "+15551234567",
        isRead: true,
      })
    );
    expect(createAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "inbox.reply.sms",
        resourceType: "message",
        resourceId: 200,
      })
    );
  });

  it("sends an email reply with subject", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.inbox.sendReply({
      accountId: 1,
      contactId: 10,
      type: "email",
      subject: "Re: Loan Application",
      body: "Your application is being processed.",
    });

    expect(result.id).toBe(200);
    expect(createMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "email",
        direction: "outbound",
        subject: "Re: Loan Application",
        toAddress: "john@example.com",
      })
    );
  });

  it("rejects email reply without subject", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.inbox.sendReply({
        accountId: 1,
        contactId: 10,
        type: "email",
        body: "No subject here",
      })
    ).rejects.toThrow(/subject/i);
  });

  it("rejects SMS when contact has no phone", async () => {
    (getContactById as any).mockResolvedValue({
      id: 10,
      accountId: 1,
      firstName: "John",
      lastName: "Doe",
      email: "john@example.com",
      phone: null,
    });
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.inbox.sendReply({
        accountId: 1,
        contactId: 10,
        type: "sms",
        body: "Hello",
      })
    ).rejects.toThrow(/phone/i);
  });

  it("rejects email when contact has no email", async () => {
    (getContactById as any).mockResolvedValue({
      id: 10,
      accountId: 1,
      firstName: "John",
      lastName: "Doe",
      email: null,
      phone: "+15551234567",
    });
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.inbox.sendReply({
        accountId: 1,
        contactId: 10,
        type: "email",
        subject: "Test",
        body: "Hello",
      })
    ).rejects.toThrow(/email/i);
  });

  it("rejects for non-existent contact", async () => {
    (getContactById as any).mockResolvedValue(null);
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.inbox.sendReply({
        accountId: 1,
        contactId: 999,
        type: "sms",
        body: "Hello",
      })
    ).rejects.toThrow(/not found/i);
  });

  it("rejects non-member access", async () => {
    (getMember as any).mockResolvedValue(null);
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.inbox.sendReply({
        accountId: 999,
        contactId: 10,
        type: "sms",
        body: "Hello",
      })
    ).rejects.toThrow(/access/i);
  });
});

describe("inbox.getUnreadCount", () => {
  it("returns unread count for an account", async () => {
    (getUnreadMessageCount as any).mockResolvedValue(7);
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.inbox.getUnreadCount({ accountId: 1 });

    expect(result.count).toBe(7);
    expect(getUnreadMessageCount).toHaveBeenCalledWith(1);
  });

  it("returns zero when no unread messages", async () => {
    (getUnreadMessageCount as any).mockResolvedValue(0);
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.inbox.getUnreadCount({ accountId: 1 });

    expect(result.count).toBe(0);
  });

  it("rejects non-member access", async () => {
    (getMember as any).mockResolvedValue(null);
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.inbox.getUnreadCount({ accountId: 999 })
    ).rejects.toThrow(/access/i);
  });
});

describe("inbound webhook helpers", () => {
  it("normalizePhone handles various formats", async () => {
    const { normalizePhone } = await import("./webhooks/inboundMessages");
    expect(normalizePhone("+15551234567")).toBe("+15551234567");
    expect(normalizePhone("15551234567")).toBe("+15551234567");
    expect(normalizePhone("5551234567")).toBe("+15551234567");
    expect(normalizePhone("(555) 123-4567")).toBe("+15551234567");
    expect(normalizePhone("+44 20 7946 0958")).toBe("+442079460958");
  });

  it("extractEmail handles plain email and Name <email> format", async () => {
    const { extractEmail } = await import("./webhooks/inboundMessages");
    expect(extractEmail("john@example.com")).toBe("john@example.com");
    expect(extractEmail("John Doe <john@example.com>")).toBe("john@example.com");
    expect(extractEmail("  JOHN@EXAMPLE.COM  ")).toBe("john@example.com");
  });
});
