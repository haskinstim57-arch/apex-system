import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Mock invokeLLM ────────────────────────────────────────────────────────
vi.mock("./_core/llm", () => ({
  invokeLLM: vi.fn().mockResolvedValue({
    choices: [
      {
        message: {
          content: JSON.stringify({
            subject: "Test Subject",
            previewText: "Test preview",
            body: "<p>Test email body</p>",
          }),
        },
      },
    ],
    usage: { prompt_tokens: 100, completion_tokens: 200, total_tokens: 300 },
  }),
}));

// ─── Mock trackUsage ───────────────────────────────────────────────────────
vi.mock("./services/usageTracker", () => ({
  trackUsage: vi.fn().mockResolvedValue(undefined),
}));

// ─── Mock messaging ────────────────────────────────────────────────────────
vi.mock("./services/messaging", () => ({
  dispatchEmail: vi.fn().mockResolvedValue({ success: true }),
}));

// ─── Mock fetch ────────────────────────────────────────────────────────────
vi.stubGlobal(
  "fetch",
  vi.fn().mockResolvedValue({
    ok: true,
    json: () => Promise.resolve({ jsonData: JSON.stringify({ results: [] }) }),
  })
);

// ─── Signature storage for mock DB ─────────────────────────────────────────
let signatureStore: Array<{
  id: number;
  accountId: number;
  name: string;
  html: string;
  isDefault: boolean;
  createdAt: Date;
  updatedAt: Date;
}> = [];
let nextSigId = 1;

// ─── Mock DB ───────────────────────────────────────────────────────────────
vi.mock("./db", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./db")>();
  return {
    ...actual,
    getDb: vi.fn().mockImplementation(() => ({
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockImplementation((table: any) => {
          // Return a chainable object that supports where → limit, where → orderBy → limit → offset
          return {
            where: vi.fn().mockImplementation((condition: any) => ({
              limit: vi.fn().mockImplementation(() => {
                // For signature queries, return from store
                return Promise.resolve(
                  signatureStore.filter((s) => s.accountId === 1).slice(0, 1)
                );
              }),
              orderBy: vi.fn().mockReturnValue({
                limit: vi.fn().mockReturnValue({
                  offset: vi.fn().mockResolvedValue([]),
                }),
              }),
            })),
            orderBy: vi.fn().mockReturnValue({
              limit: vi.fn().mockReturnValue({
                offset: vi.fn().mockResolvedValue([]),
              }),
            }),
          };
        }),
      }),
      insert: vi.fn().mockReturnValue({
        values: vi.fn().mockImplementation((vals: any) => {
          const id = nextSigId++;
          signatureStore.push({
            id,
            accountId: vals.accountId,
            name: vals.name,
            html: vals.html,
            isDefault: vals.isDefault || false,
            createdAt: new Date(),
            updatedAt: new Date(),
          });
          return Promise.resolve([{ insertId: id }]);
        }),
      }),
      update: vi.fn().mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue(undefined),
        }),
      }),
      delete: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined),
      }),
    })),
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

describe("emailContent signature procedures", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    signatureStore = [];
    nextSigId = 1;
  });

  describe("createSignature", () => {
    it("creates a signature and returns the id", async () => {
      const ctx = createTestContext();
      const caller = appRouter.createCaller(ctx);

      const result = await caller.emailContent.createSignature({
        accountId: 1,
        name: "Professional",
        html: '<table><tr><td><strong>John Doe</strong><br/>Loan Officer</td></tr></table>',
        isDefault: false,
      });

      expect(result).toHaveProperty("id");
      expect(typeof result.id).toBe("number");
    });

    it("rejects empty name", async () => {
      const ctx = createTestContext();
      const caller = appRouter.createCaller(ctx);

      await expect(
        caller.emailContent.createSignature({
          accountId: 1,
          name: "",
          html: "<p>Sig</p>",
          isDefault: false,
        })
      ).rejects.toThrow();
    });

    it("rejects empty html", async () => {
      const ctx = createTestContext();
      const caller = appRouter.createCaller(ctx);

      await expect(
        caller.emailContent.createSignature({
          accountId: 1,
          name: "Test",
          html: "",
          isDefault: false,
        })
      ).rejects.toThrow();
    });
  });

  describe("listSignatures", () => {
    it("returns signatures from the database", async () => {
      const ctx = createTestContext();
      const caller = appRouter.createCaller(ctx);

      const result = await caller.emailContent.listSignatures({
        accountId: 1,
      });

      // The mock DB returns from the chained query; result should be defined
      expect(result).toBeDefined();
    });
  });

  describe("updateSignature", () => {
    it("updates a signature when it exists", async () => {
      const ctx = createTestContext();
      const caller = appRouter.createCaller(ctx);

      // First create a signature so the mock store has one
      await caller.emailContent.createSignature({
        accountId: 1,
        name: "Original",
        html: "<p>Original</p>",
        isDefault: false,
      });

      // The update will query for existing — our mock returns from store
      const result = await caller.emailContent.updateSignature({
        accountId: 1,
        id: 1,
        name: "Updated Name",
        html: "<p>Updated HTML</p>",
      });

      expect(result).toEqual({ success: true });
    });
  });

  describe("deleteSignature", () => {
    it("deletes a signature when it exists", async () => {
      const ctx = createTestContext();
      const caller = appRouter.createCaller(ctx);

      // Create first
      await caller.emailContent.createSignature({
        accountId: 1,
        name: "To Delete",
        html: "<p>Delete me</p>",
        isDefault: false,
      });

      const result = await caller.emailContent.deleteSignature({
        accountId: 1,
        id: 1,
      });

      expect(result).toEqual({ success: true });
    });
  });

  describe("setDefaultSignature", () => {
    it("sets a signature as default", async () => {
      const ctx = createTestContext();
      const caller = appRouter.createCaller(ctx);

      // Create first
      await caller.emailContent.createSignature({
        accountId: 1,
        name: "My Sig",
        html: "<p>Sig</p>",
        isDefault: false,
      });

      const result = await caller.emailContent.setDefaultSignature({
        accountId: 1,
        id: 1,
      });

      expect(result).toEqual({ success: true });
    });
  });

  describe("input validation", () => {
    it("rejects signature name longer than 255 chars", async () => {
      const ctx = createTestContext();
      const caller = appRouter.createCaller(ctx);

      await expect(
        caller.emailContent.createSignature({
          accountId: 1,
          name: "a".repeat(256),
          html: "<p>Sig</p>",
          isDefault: false,
        })
      ).rejects.toThrow();
    });
  });
});
