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
                title: "Follow up with John Doe",
                description: "John Doe hasn't been contacted in 5 days.",
                priority: "high",
                category: "follow-up",
              },
              {
                title: "Review pipeline deals",
                description: "3 deals are stale and need attention.",
                priority: "medium",
                category: "pipeline",
              },
            ],
          }),
        },
        finish_reason: "stop",
      },
    ],
  }),
}));

// Mock the db module
vi.mock("./db", () => ({
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
    data: [
      {
        id: 1,
        firstName: "John",
        lastName: "Doe",
        email: "john@example.com",
        phone: "+15551234567",
        status: "new",
        source: "website",
        assignedToName: "Agent Smith",
        lastActivityAt: new Date(),
        createdAt: new Date(),
      },
    ],
    total: 1,
  }),
  getAppointments: vi.fn().mockResolvedValue([
    {
      id: 1,
      title: "Consultation",
      startTime: new Date(),
      endTime: new Date(),
      status: "confirmed",
      contactName: "John Doe",
    },
  ]),
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
      expect(result.suggestions[0]).toHaveProperty("description");
      expect(result.suggestions[0]).toHaveProperty("priority");
      expect(result.suggestions[0]).toHaveProperty("category");
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
    it("returns a reply for a valid chat message", async () => {
      // Override the mock for chat (returns plain text, not JSON)
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
        message: "Who should I follow up with?",
        history: [],
        pageContext: "contacts",
      });

      expect(result).toHaveProperty("reply");
      expect(typeof result.reply).toBe("string");
      expect(result.reply.length).toBeGreaterThan(0);
    });

    it("accepts chat history in the request", async () => {
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
        message: "Draft me a follow-up email",
        history: [
          { role: "user", content: "Who should I follow up with?" },
          { role: "assistant", content: "You should follow up with John Doe." },
        ],
        pageContext: "contacts",
      });

      expect(result).toHaveProperty("reply");
      expect(typeof result.reply).toBe("string");
    });

    it("rejects empty messages", async () => {
      const ctx = createAuthContext();
      const caller = appRouter.createCaller(ctx);

      await expect(
        caller.aiAdvisor.chat({
          accountId: 1,
          message: "",
          history: [],
          pageContext: "dashboard",
        })
      ).rejects.toThrow();
    });

    it("rejects unauthenticated chat requests", async () => {
      const ctx = createUnauthContext();
      const caller = appRouter.createCaller(ctx);

      await expect(
        caller.aiAdvisor.chat({
          accountId: 1,
          message: "Hello",
          history: [],
          pageContext: "dashboard",
        })
      ).rejects.toThrow();
    });
  });
});
