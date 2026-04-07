import { describe, expect, it, vi, beforeEach } from "vitest";

// ─── Mock invokeLLM ────────────────────────────────────────────────────────
vi.mock("./_core/llm", () => ({
  invokeLLM: vi.fn().mockResolvedValue({
    choices: [
      {
        message: {
          content: JSON.stringify({
            title: "Test Blog Post Title",
            content:
              "## Introduction\n\nThis is a test blog post about homebuying.\n\n## Key Points\n\n- Point one\n- Point two\n\n## Conclusion\n\nGreat article.",
            metaDescription: "A comprehensive guide to test topics",
            imagePrompt: "A beautiful landscape for the blog post",
          }),
        },
      },
    ],
    usage: {
      prompt_tokens: 500,
      completion_tokens: 1000,
      total_tokens: 1500,
    },
  }),
}));

// ─── Mock trackUsage ───────────────────────────────────────────────────────
vi.mock("./services/usageTracker", () => ({
  trackUsage: vi.fn().mockResolvedValue(undefined),
}));

// ─── Mock image generation ─────────────────────────────────────────────────
vi.mock("./_core/imageGeneration", () => ({
  generateImage: vi.fn().mockResolvedValue({ url: "https://example.com/image.png" }),
}));

// ─── Mock fetch for web research ───────────────────────────────────────────
vi.stubGlobal(
  "fetch",
  vi.fn().mockResolvedValue({
    ok: true,
    json: () =>
      Promise.resolve({
        jsonData: JSON.stringify({
          results: [
            {
              title: "Research Result 1",
              snippet: "Some useful information",
              link: "https://example.com/1",
            },
          ],
        }),
      }),
  })
);

// ─── Mock DB ───────────────────────────────────────────────────────────────
vi.mock("./db", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./db")>();
  return {
    ...actual,
    getDb: vi.fn().mockResolvedValue({
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
            orderBy: vi.fn().mockReturnValue({
              limit: vi.fn().mockReturnValue({
                offset: vi.fn().mockResolvedValue([]),
              }),
            }),
          }),
          orderBy: vi.fn().mockReturnValue({
            limit: vi.fn().mockReturnValue({
              offset: vi.fn().mockResolvedValue([]),
            }),
          }),
        }),
      }),
      insert: vi.fn().mockReturnValue({
        values: vi.fn().mockResolvedValue([{ insertId: 1 }]),
      }),
      update: vi.fn().mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue(undefined),
        }),
      }),
      delete: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined),
      }),
    }),
    getMember: vi.fn().mockResolvedValue({
      userId: 1,
      accountId: 1,
      role: "owner",
      isActive: true,
    }),
  };
});

// ─── Imports after mocks ───────────────────────────────────────────────────
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

// ─── Test context factory ──────────────────────────────────────────────────
function createTestContext(): TrpcContext {
  return {
    user: {
      id: 1,
      openId: "test-user-123",
      email: "test@example.com",
      name: "Test User",
      loginMethod: "manus",
      role: "admin",
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
    impersonation: {
      isImpersonating: false,
      impersonatedAccountId: null,
      impersonatedAccountName: null,
      impersonatorUserId: null,
      impersonatorName: null,
    },
  };
}

describe("longFormContent router", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("generate", () => {
    it("generates a blog post and returns structured result", async () => {
      const ctx = createTestContext();
      const caller = appRouter.createCaller(ctx);

      const result = await caller.longFormContent.generate({
        accountId: 1,
        topic: "First-Time Homebuyer Guide",
        enableWebResearch: false,
        shouldGenerateImage: false,
      });

      expect(result).toBeDefined();
      expect(result.title).toBe("Test Blog Post Title");
      expect(result.content).toContain("Introduction");
      expect(result.metaDescription).toBe("A comprehensive guide to test topics");
      expect(result.wordCount).toBeGreaterThan(0);
      expect(result.id).toBe(1);
      expect(result.inputTokens).toBe(500);
      expect(result.outputTokens).toBe(1000);
      expect(result.totalTokens).toBe(1500);
    });

    it("rejects empty topic", async () => {
      const ctx = createTestContext();
      const caller = appRouter.createCaller(ctx);

      await expect(
        caller.longFormContent.generate({
          accountId: 1,
          topic: "",
        })
      ).rejects.toThrow();
    });

    it("tracks usage after generation", async () => {
      const { trackUsage } = await import("./services/usageTracker");
      const ctx = createTestContext();
      const caller = appRouter.createCaller(ctx);

      await caller.longFormContent.generate({
        accountId: 1,
        topic: "Test Topic",
      });

      expect(trackUsage).toHaveBeenCalledWith(
        expect.objectContaining({
          accountId: 1,
          userId: 1,
          eventType: "llm_request",
          quantity: 1,
          metadata: expect.objectContaining({
            feature: "long_form_content_generation",
          }),
        })
      );
    });
  });

  describe("bulkGenerate", () => {
    it("generates multiple blog posts", async () => {
      const ctx = createTestContext();
      const caller = appRouter.createCaller(ctx);

      const result = await caller.longFormContent.bulkGenerate({
        accountId: 1,
        topics: ["Topic 1", "Topic 2"],
      });

      expect(result).toBeDefined();
      expect(result.totalTopics).toBe(2);
      expect(result.results).toHaveLength(2);
      expect(result.results[0].success).toBe(true);
      expect(result.results[1].success).toBe(true);
    });

    it("rejects more than 20 topics", async () => {
      const ctx = createTestContext();
      const caller = appRouter.createCaller(ctx);
      const topics = Array.from({ length: 21 }, (_, i) => `Topic ${i + 1}`);

      await expect(
        caller.longFormContent.bulkGenerate({
          accountId: 1,
          topics,
        })
      ).rejects.toThrow();
    });

    it("rejects empty topics array", async () => {
      const ctx = createTestContext();
      const caller = appRouter.createCaller(ctx);

      await expect(
        caller.longFormContent.bulkGenerate({
          accountId: 1,
          topics: [],
        })
      ).rejects.toThrow();
    });
  });

  describe("repurpose", () => {
    it("repurposes content to social snippet format", async () => {
      // Override the mock to return an existing content item
      const { getDb } = await import("./db");
      const mockDb = await (getDb as any)();
      mockDb.select.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([
              {
                id: 1,
                accountId: 1,
                title: "Test Blog Post",
                content: "This is the content of the blog post.",
                status: "draft",
              },
            ]),
          }),
        }),
      });

      // Mock LLM for repurpose (returns plain text, not JSON)
      const { invokeLLM } = await import("./_core/llm");
      (invokeLLM as any).mockResolvedValueOnce({
        choices: [
          {
            message: {
              content:
                "Check out our latest guide on homebuying! #realestate #firsttimehomebuyer",
            },
          },
        ],
      });

      const ctx = createTestContext();
      const caller = appRouter.createCaller(ctx);

      const result = await caller.longFormContent.repurpose({
        accountId: 1,
        contentId: 1,
        format: "social-snippet",
      });

      expect(result).toBeDefined();
      expect(result.format).toBe("social-snippet");
      expect(result.content).toContain("homebuying");
      expect(result.id).toBe(1);
    });

    it("validates format enum", async () => {
      const ctx = createTestContext();
      const caller = appRouter.createCaller(ctx);

      await expect(
        caller.longFormContent.repurpose({
          accountId: 1,
          contentId: 1,
          format: "invalid-format" as any,
        })
      ).rejects.toThrow();
    });
  });

  describe("seedTemplates", () => {
    it("seeds default templates", async () => {
      const ctx = createTestContext();
      const caller = appRouter.createCaller(ctx);

      const result = await caller.longFormContent.seedTemplates();

      expect(result).toBeDefined();
      expect(result.seeded).toBeGreaterThanOrEqual(0);
      expect(result.message).toBeDefined();
    });
  });

  describe("input validation", () => {
    it("rejects topic longer than 1000 characters", async () => {
      const ctx = createTestContext();
      const caller = appRouter.createCaller(ctx);

      await expect(
        caller.longFormContent.generate({
          accountId: 1,
          topic: "a".repeat(1001),
        })
      ).rejects.toThrow();
    });

    it("validates accountId is a number", async () => {
      const ctx = createTestContext();
      const caller = appRouter.createCaller(ctx);

      await expect(
        caller.longFormContent.generate({
          accountId: "not-a-number" as any,
          topic: "Test",
        })
      ).rejects.toThrow();
    });
  });
});
