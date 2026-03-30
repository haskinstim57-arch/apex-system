import { describe, expect, it, vi, beforeEach } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

// ── Mock DB helpers so tests don't hit the real database ──
vi.mock("./db", async (importOriginal) => {
  const original = (await importOriginal()) as Record<string, unknown>;
  return {
    ...original,
    // Jarvis session helpers
    createJarvisSession: vi.fn().mockResolvedValue({ id: 1 }),
    getJarvisSession: vi.fn().mockResolvedValue({
      id: 1,
      accountId: 100,
      userId: 1,
      title: "Test conversation",
      messages: "[]",
      createdAt: new Date(),
      updatedAt: new Date(),
    }),
    updateJarvisSession: vi.fn().mockResolvedValue(undefined),
    listJarvisSessions: vi.fn().mockResolvedValue([
      { id: 1, title: "Test conversation", updatedAt: new Date() },
      { id: 2, title: "Another chat", updatedAt: new Date() },
    ]),
    deleteJarvisSession: vi.fn().mockResolvedValue(undefined),
    // Gemini usage helpers
    logGeminiUsage: vi.fn().mockResolvedValue(undefined),
    getGeminiUsageStats: vi.fn().mockResolvedValue({
      totalRequests: 42,
      totalPromptTokens: 12000,
      totalCompletionTokens: 8000,
      totalTokens: 20000,
      totalCost: "0.005400",
      successCount: 40,
      failCount: 2,
      dailyBreakdown: [
        { date: "2026-03-30", requests: 10, tokens: 5000, cost: "0.001350" },
        { date: "2026-03-29", requests: 8, tokens: 4000, cost: "0.001080" },
      ],
    }),
    // Account member check
    getMember: vi.fn().mockResolvedValue({
      userId: 1,
      accountId: 100,
      role: "owner",
      isActive: true,
    }),
  };
});

// ── Mock Gemini to avoid real API calls ──
vi.mock("./services/gemini", () => ({
  invokeGemini: vi.fn().mockResolvedValue({
    id: "gemini-test",
    created: Date.now(),
    model: "gemini-2.5-flash",
    choices: [
      {
        index: 0,
        message: {
          role: "assistant",
          content: "Hello! I'm Jarvis, your AI assistant. How can I help you today?",
          tool_calls: undefined,
        },
        finish_reason: "stop",
      },
    ],
  }),
  invokeGeminiWithRetry: vi.fn().mockResolvedValue({
    id: "gemini-test",
    created: Date.now(),
    model: "gemini-2.5-flash",
    choices: [
      {
        index: 0,
        message: {
          role: "assistant",
          content: JSON.stringify({
            suggestions: [
              { title: "Check Pipeline", description: "Review your deals", prompt: "Show pipeline", priority: "high" },
              { title: "Follow Up", description: "Contact stale leads", prompt: "Show stale leads", priority: "high" },
              { title: "Campaign Stats", description: "Review campaigns", prompt: "Show campaigns", priority: "medium" },
              { title: "New Contacts", description: "See recent leads", prompt: "Show new contacts", priority: "medium" },
            ],
          }),
          tool_calls: undefined,
        },
        finish_reason: "stop",
      },
    ],
  }),
}));

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createAuthContext(overrides?: Partial<AuthenticatedUser>): TrpcContext {
  const user: AuthenticatedUser = {
    id: 1,
    openId: "test-user-open-id",
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
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: vi.fn(),
    } as unknown as TrpcContext["res"],
  };
}

describe("jarvis router", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("jarvis.listSessions", () => {
    it("returns a list of sessions for the user", async () => {
      const ctx = createAuthContext();
      const caller = appRouter.createCaller(ctx);
      const result = await caller.jarvis.listSessions({ accountId: 100 });
      expect(Array.isArray(result)).toBe(true);
      expect(result).toHaveLength(2);
      expect(result[0]).toHaveProperty("id");
      expect(result[0]).toHaveProperty("title");
      expect(result[0]).toHaveProperty("updatedAt");
    });
  });

  describe("jarvis.createSession", () => {
    it("creates a new session and returns its id", async () => {
      const ctx = createAuthContext();
      const caller = appRouter.createCaller(ctx);
      const result = await caller.jarvis.createSession({ accountId: 100 });
      expect(result).toHaveProperty("id");
      expect(result.id).toBe(1);
    });

    it("creates a session with a custom title", async () => {
      const ctx = createAuthContext();
      const caller = appRouter.createCaller(ctx);
      const result = await caller.jarvis.createSession({
        accountId: 100,
        title: "My Custom Chat",
      });
      expect(result).toHaveProperty("id");
    });
  });

  describe("jarvis.getSession", () => {
    it("returns session with messages", async () => {
      const ctx = createAuthContext();
      const caller = appRouter.createCaller(ctx);
      const result = await caller.jarvis.getSession({
        accountId: 100,
        sessionId: 1,
      });
      expect(result).toHaveProperty("id", 1);
      expect(result).toHaveProperty("title", "Test conversation");
      expect(result).toHaveProperty("messages");
      expect(Array.isArray(result.messages)).toBe(true);
    });

    it("throws FORBIDDEN if session belongs to another user", async () => {
      const { getJarvisSession } = await import("./db");
      (getJarvisSession as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        id: 1,
        accountId: 100,
        userId: 999, // Different user
        title: "Other user's chat",
        messages: "[]",
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const ctx = createAuthContext();
      const caller = appRouter.createCaller(ctx);
      await expect(
        caller.jarvis.getSession({ accountId: 100, sessionId: 1 })
      ).rejects.toThrow("Not your session");
    });
  });

  describe("jarvis.chat", () => {
    it("sends a message and gets an AI response", async () => {
      const ctx = createAuthContext();
      const caller = appRouter.createCaller(ctx);
      const result = await caller.jarvis.chat({
        accountId: 100,
        sessionId: 1,
        message: "Show me my dashboard stats",
      });
      expect(result).toHaveProperty("reply");
      expect(typeof result.reply).toBe("string");
      expect(result.reply.length).toBeGreaterThan(0);
      expect(result).toHaveProperty("toolsUsed");
      expect(Array.isArray(result.toolsUsed)).toBe(true);
    });

    it("rejects empty messages", async () => {
      const ctx = createAuthContext();
      const caller = appRouter.createCaller(ctx);
      await expect(
        caller.jarvis.chat({
          accountId: 100,
          sessionId: 1,
          message: "",
        })
      ).rejects.toThrow();
    });
  });

  describe("jarvis.getRecommendations", () => {
    it("returns page-context-aware suggestions for dashboard", async () => {
      const ctx = createAuthContext();
      const caller = appRouter.createCaller(ctx);
      const result = await caller.jarvis.getRecommendations({
        accountId: 100,
        pageContext: "dashboard",
      });
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBeGreaterThan(0);
      expect(result[0]).toHaveProperty("title");
      expect(result[0]).toHaveProperty("description");
      expect(result[0]).toHaveProperty("prompt");
      expect(result[0]).toHaveProperty("priority");
    });

    it("returns suggestions for contacts page", async () => {
      const ctx = createAuthContext();
      const caller = appRouter.createCaller(ctx);
      const result = await caller.jarvis.getRecommendations({
        accountId: 100,
        pageContext: "contacts",
      });
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBeGreaterThan(0);
    });

    it("returns fallback suggestions for unknown page context", async () => {
      const ctx = createAuthContext();
      const caller = appRouter.createCaller(ctx);
      const result = await caller.jarvis.getRecommendations({
        accountId: 100,
        pageContext: "unknown-page",
      });
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBeGreaterThan(0);
    });
  });

  describe("jarvis.deleteSession", () => {
    it("deletes a session successfully", async () => {
      const ctx = createAuthContext();
      const caller = appRouter.createCaller(ctx);
      const result = await caller.jarvis.deleteSession({
        accountId: 100,
        sessionId: 1,
      });
      expect(result).toEqual({ success: true });
    });

    it("throws FORBIDDEN if deleting another user's session", async () => {
      const { getJarvisSession } = await import("./db");
      (getJarvisSession as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        id: 1,
        accountId: 100,
        userId: 999,
        title: "Other user's chat",
        messages: "[]",
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const ctx = createAuthContext();
      const caller = appRouter.createCaller(ctx);
      await expect(
        caller.jarvis.deleteSession({ accountId: 100, sessionId: 1 })
      ).rejects.toThrow("Not your session");
    });
  });

  describe("jarvis.getUsageStats", () => {
    it("returns usage stats for admin users", async () => {
      const ctx = createAuthContext({ role: "admin" });
      const caller = appRouter.createCaller(ctx);
      const result = await caller.jarvis.getUsageStats({ days: 30 });
      expect(result).toHaveProperty("totalRequests", 42);
      expect(result).toHaveProperty("totalTokens", 20000);
      expect(result).toHaveProperty("totalCost", "0.005400");
      expect(result).toHaveProperty("successCount", 40);
      expect(result).toHaveProperty("failCount", 2);
      expect(result).toHaveProperty("dailyBreakdown");
      expect(result.dailyBreakdown).toHaveLength(2);
    });

    it("rejects non-admin users", async () => {
      const ctx = createAuthContext({ role: "user" });
      const caller = appRouter.createCaller(ctx);
      await expect(
        caller.jarvis.getUsageStats({ days: 30 })
      ).rejects.toThrow("Admin access required");
    });

    it("accepts optional accountId filter", async () => {
      const ctx = createAuthContext({ role: "admin" });
      const caller = appRouter.createCaller(ctx);
      const result = await caller.jarvis.getUsageStats({ accountId: 100, days: 7 });
      expect(result).toHaveProperty("totalRequests");
    });
  });
});
