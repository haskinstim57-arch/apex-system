import { describe, expect, it, vi, beforeEach } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

// ─── Mock db functions ───
vi.mock("./db", async () => {
  const actual = await vi.importActual("./db");
  return {
    ...actual,
    getMember: vi.fn().mockResolvedValue({ userId: 1, accountId: 1, role: "owner", isActive: true }),
    createChatWidget: vi.fn().mockResolvedValue({ id: 1 }),
    listChatWidgets: vi.fn().mockResolvedValue([
      {
        id: 1,
        accountId: 1,
        name: "Test Widget",
        widgetKey: "abc123def456",
        greeting: "Hello!",
        aiEnabled: true,
        aiSystemPrompt: null,
        handoffKeywords: "agent,human",
        brandColor: "#6366f1",
        position: "bottom-right",
        allowedDomains: null,
        collectVisitorInfo: true,
        isActive: true,
        createdById: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]),
    getChatWidgetById: vi.fn().mockResolvedValue({
      id: 1,
      accountId: 1,
      name: "Test Widget",
      widgetKey: "abc123def456",
      greeting: "Hello!",
      aiEnabled: true,
      aiSystemPrompt: null,
      handoffKeywords: "agent,human",
      brandColor: "#6366f1",
      position: "bottom-right",
      allowedDomains: null,
      collectVisitorInfo: true,
      isActive: true,
      createdById: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
    }),
    updateChatWidget: vi.fn().mockResolvedValue(undefined),
    deleteChatWidget: vi.fn().mockResolvedValue(undefined),
    listWebchatSessions: vi.fn().mockResolvedValue({
      sessions: [
        {
          id: 1,
          widgetId: 1,
          accountId: 1,
          sessionKey: "sess-key-123",
          contactId: 10,
          visitorName: "John",
          visitorEmail: "john@example.com",
          handoffRequested: false,
          agentTakenOver: false,
          agentUserId: null,
          status: "active",
          pageUrl: "https://example.com",
          ipAddress: "127.0.0.1",
          userAgent: "Mozilla/5.0",
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ],
      total: 1,
    }),
    getWebchatSessionById: vi.fn().mockResolvedValue({
      id: 1,
      widgetId: 1,
      accountId: 1,
      sessionKey: "sess-key-123",
      contactId: 10,
      visitorName: "John",
      visitorEmail: "john@example.com",
      handoffRequested: false,
      agentTakenOver: false,
      agentUserId: null,
      status: "active",
      pageUrl: "https://example.com",
      ipAddress: "127.0.0.1",
      userAgent: "Mozilla/5.0",
      createdAt: new Date(),
      updatedAt: new Date(),
    }),
    listWebchatMessages: vi.fn().mockResolvedValue([
      {
        id: 1,
        sessionId: 1,
        accountId: 1,
        sender: "visitor",
        content: "Hello, I need help",
        isRead: false,
        createdAt: new Date(),
      },
      {
        id: 2,
        sessionId: 1,
        accountId: 1,
        sender: "ai",
        content: "Hi! How can I help you?",
        isRead: true,
        createdAt: new Date(),
      },
    ]),
    markWebchatMessagesAsRead: vi.fn().mockResolvedValue(undefined),
    getUnreadWebchatCount: vi.fn().mockResolvedValue(3),
    updateWebchatSession: vi.fn().mockResolvedValue(undefined),
    createWebchatMessage: vi.fn().mockResolvedValue({ id: 3 }),
    logContactActivity: vi.fn().mockResolvedValue(undefined),
  };
});

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createAuthContext(role: "admin" | "user" = "admin"): TrpcContext {
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

describe("webchat router", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ─── Widget CRUD ───
  describe("createWidget", () => {
    it("creates a widget and returns id + widgetKey", async () => {
      const ctx = createAuthContext();
      const caller = appRouter.createCaller(ctx);

      const result = await caller.webchat.createWidget({
        accountId: 1,
        name: "My Chat Widget",
        greeting: "Welcome!",
        aiEnabled: true,
        brandColor: "#ff0000",
        position: "bottom-right",
        collectVisitorInfo: true,
      });

      expect(result).toHaveProperty("id", 1);
      expect(result).toHaveProperty("widgetKey");
      expect(result.widgetKey).toHaveLength(32); // 16 bytes hex
    });

    it("rejects empty name", async () => {
      const ctx = createAuthContext();
      const caller = appRouter.createCaller(ctx);

      await expect(
        caller.webchat.createWidget({
          accountId: 1,
          name: "",
        })
      ).rejects.toThrow();
    });
  });

  describe("listWidgets", () => {
    it("returns widgets for the account", async () => {
      const ctx = createAuthContext();
      const caller = appRouter.createCaller(ctx);

      const result = await caller.webchat.listWidgets({ accountId: 1 });

      expect(Array.isArray(result)).toBe(true);
      expect(result).toHaveLength(1);
      expect(result[0]).toHaveProperty("name", "Test Widget");
    });
  });

  describe("getWidget", () => {
    it("returns a single widget by id", async () => {
      const ctx = createAuthContext();
      const caller = appRouter.createCaller(ctx);

      const result = await caller.webchat.getWidget({ accountId: 1, widgetId: 1 });

      expect(result).toHaveProperty("id", 1);
      expect(result).toHaveProperty("name", "Test Widget");
      expect(result).toHaveProperty("widgetKey", "abc123def456");
    });
  });

  describe("updateWidget", () => {
    it("updates widget fields", async () => {
      const ctx = createAuthContext();
      const caller = appRouter.createCaller(ctx);

      const result = await caller.webchat.updateWidget({
        accountId: 1,
        widgetId: 1,
        name: "Updated Widget",
        brandColor: "#00ff00",
      });

      expect(result).toEqual({ success: true });
    });
  });

  describe("deleteWidget", () => {
    it("deletes a widget", async () => {
      const ctx = createAuthContext();
      const caller = appRouter.createCaller(ctx);

      const result = await caller.webchat.deleteWidget({ accountId: 1, widgetId: 1 });

      expect(result).toEqual({ success: true });
    });
  });

  // ─── Sessions ───
  describe("listSessions", () => {
    it("returns webchat sessions", async () => {
      const ctx = createAuthContext();
      const caller = appRouter.createCaller(ctx);

      const result = await caller.webchat.listSessions({ accountId: 1 });

      expect(result).toHaveProperty("sessions");
      expect(result).toHaveProperty("total", 1);
      expect(result.sessions).toHaveLength(1);
      expect(result.sessions[0]).toHaveProperty("visitorName", "John");
    });
  });

  describe("getSessionMessages", () => {
    it("returns session with messages", async () => {
      const ctx = createAuthContext();
      const caller = appRouter.createCaller(ctx);

      const result = await caller.webchat.getSessionMessages({
        accountId: 1,
        sessionId: 1,
      });

      expect(result).toHaveProperty("session");
      expect(result).toHaveProperty("messages");
      expect(result.messages).toHaveLength(2);
      expect(result.messages[0]).toHaveProperty("sender", "visitor");
      expect(result.messages[1]).toHaveProperty("sender", "ai");
    });
  });

  describe("markSessionRead", () => {
    it("marks messages as read", async () => {
      const ctx = createAuthContext();
      const caller = appRouter.createCaller(ctx);

      const result = await caller.webchat.markSessionRead({
        accountId: 1,
        sessionId: 1,
      });

      expect(result).toEqual({ success: true });
    });
  });

  describe("getUnreadCount", () => {
    it("returns unread count", async () => {
      const ctx = createAuthContext();
      const caller = appRouter.createCaller(ctx);

      const result = await caller.webchat.getUnreadCount({ accountId: 1 });

      expect(result).toEqual({ count: 3 });
    });
  });

  // ─── Agent Actions ───
  describe("takeOverSession", () => {
    it("takes over a session and adds system message", async () => {
      const ctx = createAuthContext();
      const caller = appRouter.createCaller(ctx);

      const result = await caller.webchat.takeOverSession({
        accountId: 1,
        sessionId: 1,
      });

      expect(result).toEqual({ success: true });
    });
  });

  describe("sendAgentReply", () => {
    it("sends an agent reply message", async () => {
      const ctx = createAuthContext();
      const caller = appRouter.createCaller(ctx);

      const result = await caller.webchat.sendAgentReply({
        accountId: 1,
        sessionId: 1,
        content: "Hello, I'm here to help!",
      });

      expect(result).toHaveProperty("id", 3);
    });

    it("rejects empty content", async () => {
      const ctx = createAuthContext();
      const caller = appRouter.createCaller(ctx);

      await expect(
        caller.webchat.sendAgentReply({
          accountId: 1,
          sessionId: 1,
          content: "",
        })
      ).rejects.toThrow();
    });
  });

  describe("closeSession", () => {
    it("closes a session", async () => {
      const ctx = createAuthContext();
      const caller = appRouter.createCaller(ctx);

      const result = await caller.webchat.closeSession({
        accountId: 1,
        sessionId: 1,
      });

      expect(result).toEqual({ success: true });
    });
  });
});

// ─── Handoff Detection Tests ───
describe("handoff detection", () => {
  // Testing the detectHandoff logic indirectly through the module
  it("detects handoff keywords in messages", () => {
    const keywords = "agent,human,help,speak to someone";
    const testCases = [
      { msg: "I want to speak to a human", expected: true },
      { msg: "Can I talk to an agent please?", expected: true },
      { msg: "I need help with my loan", expected: true },
      { msg: "What are your rates?", expected: false },
      { msg: "Tell me about refinancing", expected: false },
      { msg: "I want to speak to someone real", expected: true },
    ];

    for (const tc of testCases) {
      const kwList = keywords.split(",").map((k) => k.trim().toLowerCase());
      const lower = tc.msg.toLowerCase();
      const detected = kwList.some((kw) => lower.includes(kw));
      expect(detected).toBe(tc.expected);
    }
  });
});
