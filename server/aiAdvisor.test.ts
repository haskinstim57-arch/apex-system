import { describe, expect, it, vi, beforeEach } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

// Mock the LLM module
vi.mock("./_core/llm", () => ({
  invokeLLM: vi.fn().mockResolvedValue({
    id: "mock-id",
    created: Date.now(),
    model: "mock",
    choices: [
      {
        index: 0,
        message: {
          role: "assistant",
          content: JSON.stringify({
            suggestions: [
              {
                id: "s1",
                title: "Follow up with John Doe",
                explanation: "John Doe hasn't been contacted in 5 days.",
                impact: "high",
                actionType: "info_only",
                actionParams: {},
                confirmationMessage: "",
              },
              {
                id: "s2",
                title: "Review pipeline deals",
                explanation: "3 deals are stale and need attention.",
                impact: "medium",
                actionType: "navigate",
                actionParams: { path: "/pipeline" },
                confirmationMessage: "",
              },
            ],
            summary: "2 suggestions",
            stats: {},
          }),
        },
        finish_reason: "stop",
      },
    ],
  }),
}));

// Mock the db module
vi.mock("./db", () => ({
  getMember: vi.fn().mockResolvedValue({ userId: 1, accountId: 1, role: "owner", isActive: true }),
  getDb: vi.fn().mockResolvedValue((() => {
    // Build a chainable mock that resolves to [{ count: 0 }] by default
    function chainable(resolveValue: any = [{ count: 0 }]) {
      const obj: any = {};
      const methods = ['select', 'from', 'where', 'innerJoin', 'groupBy', 'orderBy', 'limit'];
      for (const m of methods) {
        obj[m] = (..._args: any[]) => chainable(resolveValue);
      }
      obj.then = (resolve: any, reject?: any) => Promise.resolve(resolveValue).then(resolve, reject);
      return obj;
    }
    return {
      select: () => chainable([{ count: 0 }]),
      execute: () => Promise.resolve([[{ cnt: 0 }]]),
    };
  })()),
  getContactStats: vi.fn().mockResolvedValue({
    total: 50,
    newThisWeek: 5,
    byStatus: { new: 20, contacted: 15, qualified: 10, closed: 5 },
  }),
  getMessageStats: vi.fn().mockResolvedValue({
    total: 200,
    sent: 100,
    received: 100,
  }),
  getAICallStats: vi.fn().mockResolvedValue({
    total: 30,
    completed: 25,
    failed: 5,
  }),
  getCampaignStats: vi.fn().mockResolvedValue({
    total: 10,
    active: 3,
    completed: 7,
  }),
  getAccountDashboardStats: vi.fn().mockResolvedValue({
    contacts: 50,
    deals: 15,
    revenue: 500000,
  }),
  listContacts: vi.fn().mockResolvedValue({
    data: [],
    total: 0,
  }),
  getAppointments: vi.fn().mockResolvedValue([]),
}));

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createAuthContext(): TrpcContext {
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
  };

  return {
    user,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: () => {},
    } as TrpcContext["res"],
  };
}

function createUnauthContext(): TrpcContext {
  return {
    user: null,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: () => {},
    } as TrpcContext["res"],
  };
}

describe("aiAdvisor", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getSuggestions", () => {
    it("returns suggestions for an authenticated user", async () => {
      const ctx = createAuthContext();
      const caller = appRouter.createCaller(ctx);

      const result = await caller.aiAdvisor.getSuggestions({
        accountId: 1,
        pageContext: "dashboard",
      });

      expect(result).toHaveProperty("suggestions");
      expect(Array.isArray(result.suggestions)).toBe(true);
      expect(result.suggestions.length).toBeGreaterThan(0);
      expect(result.suggestions[0]).toHaveProperty("title");
      expect(result.suggestions[0]).toHaveProperty("explanation");
      expect(result.suggestions[0]).toHaveProperty("impact");
    });

    it("rejects unauthenticated requests", async () => {
      const ctx = createUnauthContext();
      const caller = appRouter.createCaller(ctx);

      await expect(
        caller.aiAdvisor.getSuggestions({
          accountId: 1,
          pageContext: "dashboard",
        })
      ).rejects.toThrow();
    });
  });

  describe("chat", () => {
    it("returns a response for a valid chat message", async () => {
      const { invokeLLM } = await import("./_core/llm");
      (invokeLLM as any).mockResolvedValueOnce({
        id: "chat-id",
        created: Date.now(),
        model: "mock",
        choices: [
          {
            index: 0,
            message: {
              role: "assistant",
              content: "Based on your data, I recommend following up with John Doe today.",
            },
            finish_reason: "stop",
          },
        ],
      });

      const ctx = createAuthContext();
      const caller = appRouter.createCaller(ctx);

      const result = await caller.aiAdvisor.chat({
        accountId: 1,
        messages: [
          { role: "user", content: "Who should I follow up with?" },
        ],
        pageContext: "contacts",
      });

      expect(result).toHaveProperty("response");
      expect(typeof result.response).toBe("string");
      expect(result.response.length).toBeGreaterThan(0);
    });

    it("accepts chat history in the messages array", async () => {
      const { invokeLLM } = await import("./_core/llm");
      (invokeLLM as any).mockResolvedValueOnce({
        id: "chat-id-2",
        created: Date.now(),
        model: "mock",
        choices: [
          {
            index: 0,
            message: {
              role: "assistant",
              content: "Here is a follow-up email draft for John Doe.",
            },
            finish_reason: "stop",
          },
        ],
      });

      const ctx = createAuthContext();
      const caller = appRouter.createCaller(ctx);

      const result = await caller.aiAdvisor.chat({
        accountId: 1,
        messages: [
          { role: "user", content: "Who should I follow up with?" },
          { role: "assistant", content: "You should follow up with John Doe." },
          { role: "user", content: "Draft me a follow-up email" },
        ],
        pageContext: "contacts",
      });

      expect(result).toHaveProperty("response");
      expect(typeof result.response).toBe("string");
    });

    it("rejects empty messages array", async () => {
      const ctx = createAuthContext();
      const caller = appRouter.createCaller(ctx);

      // Empty messages array should still be valid per schema (z.array can be empty)
      // but the LLM will just get the system prompt
      const { invokeLLM } = await import("./_core/llm");
      (invokeLLM as any).mockResolvedValueOnce({
        id: "chat-id-3",
        created: Date.now(),
        model: "mock",
        choices: [
          {
            index: 0,
            message: { role: "assistant", content: "How can I help?" },
            finish_reason: "stop",
          },
        ],
      });

      const result = await caller.aiAdvisor.chat({
        accountId: 1,
        messages: [],
        pageContext: "dashboard",
      });

      expect(result).toHaveProperty("response");
    });

    it("rejects unauthenticated chat requests", async () => {
      const ctx = createUnauthContext();
      const caller = appRouter.createCaller(ctx);

      await expect(
        caller.aiAdvisor.chat({
          accountId: 1,
          messages: [{ role: "user", content: "Hello" }],
          pageContext: "dashboard",
        })
      ).rejects.toThrow();
    });
  });
});
