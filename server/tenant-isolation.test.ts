import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext, ImpersonationContext } from "./_core/context";

// ─── Helpers ───

const NO_IMPERSONATION: ImpersonationContext = {
  isImpersonating: false,
  impersonatedAccountId: null,
  impersonatedAccountName: null,
  impersonatorUserId: null,
  impersonatorName: null,
};

type CookieCall = { name: string; value?: string; options?: Record<string, unknown> };

function createContext(overrides: {
  role?: "admin" | "user";
  userId?: number;
  impersonation?: ImpersonationContext;
  cookieHeader?: string;
}): TrpcContext {
  const cookies: CookieCall[] = [];
  const user = {
    id: overrides.userId ?? 1,
    openId: `user-${overrides.userId ?? 1}`,
    email: `user${overrides.userId ?? 1}@test.com`,
    name: `Test User ${overrides.userId ?? 1}`,
    loginMethod: "manus" as const,
    role: overrides.role ?? "user",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };

  return {
    user,
    impersonation: overrides.impersonation ?? NO_IMPERSONATION,
    req: {
      protocol: "https",
      headers: {
        cookie: overrides.cookieHeader ?? "",
      },
    } as TrpcContext["req"],
    res: {
      clearCookie: (name: string, options: Record<string, unknown>) => {
        cookies.push({ name, options });
      },
      cookie: (name: string, value: string, options: Record<string, unknown>) => {
        cookies.push({ name, value, options });
      },
    } as TrpcContext["res"],
  };
}

// ─── SECTION 1: Admin vs Client access ───

describe("Tenant Isolation — Admin Access", () => {
  it("admin can list all accounts", async () => {
    const ctx = createContext({ role: "admin", userId: 1 });
    const caller = appRouter.createCaller(ctx);

    const accounts = await caller.accounts.list();
    expect(Array.isArray(accounts)).toBe(true);
  });

  it("admin can access adminStats", async () => {
    const ctx = createContext({ role: "admin", userId: 1 });
    const caller = appRouter.createCaller(ctx);

    const stats = await caller.accounts.adminStats();
    expect(stats).toHaveProperty("totalAccounts");
    expect(stats).toHaveProperty("totalUsers");
    expect(stats).toHaveProperty("activeAccounts");
  });

  it("non-admin cannot access adminStats", async () => {
    const ctx = createContext({ role: "user", userId: 2 });
    const caller = appRouter.createCaller(ctx);

    await expect(caller.accounts.adminStats()).rejects.toThrow();
  });
});

// ─── SECTION 2: Contact scoping ───

describe("Tenant Isolation — Contact Scoping", () => {
  it("non-member user cannot list contacts for an account they don't belong to", async () => {
    const ctx = createContext({ role: "user", userId: 9999 });
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.contacts.list({ accountId: 1, limit: 10, offset: 0 })
    ).rejects.toThrow("You do not have access to this account");
  });

  it("admin can list contacts for any account", async () => {
    const ctx = createContext({ role: "admin", userId: 1 });
    const caller = appRouter.createCaller(ctx);

    const result = await caller.contacts.list({ accountId: 1, limit: 10, offset: 0 });
    expect(result).toHaveProperty("data");
    expect(result).toHaveProperty("total");
  });
});

// ─── SECTION 3: Messages scoping ───

describe("Tenant Isolation — Messages Scoping", () => {
  it("non-member user cannot list messages for an account they don't belong to", async () => {
    const ctx = createContext({ role: "user", userId: 9999 });
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.messages.list({ accountId: 1, limit: 10, offset: 0 })
    ).rejects.toThrow("You do not have access to this account");
  });

  it("admin can list messages for any account", async () => {
    const ctx = createContext({ role: "admin", userId: 1 });
    const caller = appRouter.createCaller(ctx);

    const result = await caller.messages.list({ accountId: 1, limit: 10, offset: 0 });
    expect(result).toHaveProperty("messages");
    expect(result).toHaveProperty("total");
  });
});

// ─── SECTION 4: Campaigns scoping ───

describe("Tenant Isolation — Campaigns Scoping", () => {
  it("non-member user cannot list campaigns for an account they don't belong to", async () => {
    const ctx = createContext({ role: "user", userId: 9999 });
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.campaigns.list({ accountId: 1, limit: 10, offset: 0 })
    ).rejects.toThrow();
  });

  it("admin can list campaigns for any account", async () => {
    const ctx = createContext({ role: "admin", userId: 1 });
    const caller = appRouter.createCaller(ctx);

    // listCampaigns returns { data, total }
    const result = await caller.campaigns.list({ accountId: 1, limit: 10, offset: 0 });
    expect(result).toHaveProperty("data");
    expect(result).toHaveProperty("total");
  });
});

// ─── SECTION 5: Pipeline scoping ───

describe("Tenant Isolation — Pipeline Scoping", () => {
  it("non-member user cannot access pipeline for an account they don't belong to", async () => {
    const ctx = createContext({ role: "user", userId: 9999 });
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.pipeline.getDefault({ accountId: 1 })
    ).rejects.toThrow("You do not have access to this account");
  });

  it("admin can access pipeline for any account", async () => {
    const ctx = createContext({ role: "admin", userId: 1 });
    const caller = appRouter.createCaller(ctx);

    const result = await caller.pipeline.getDefault({ accountId: 1 });
    expect(result).toHaveProperty("pipeline");
    expect(result).toHaveProperty("stages");
  });
});

// ─── SECTION 6: Automations scoping ───

describe("Tenant Isolation — Automations Scoping", () => {
  it("non-member user cannot list automations for an account they don't belong to", async () => {
    const ctx = createContext({ role: "user", userId: 9999 });
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.automations.list({ accountId: 1 })
    ).rejects.toThrow("You do not have access to this account");
  });

  it("admin can list automations for any account", async () => {
    const ctx = createContext({ role: "admin", userId: 1 });
    const caller = appRouter.createCaller(ctx);

    const result = await caller.automations.list({ accountId: 1 });
    expect(Array.isArray(result)).toBe(true);
  });
});

// ─── SECTION 7: AI Calls scoping ───

describe("Tenant Isolation — AI Calls Scoping", () => {
  it("non-member user cannot list AI calls for an account they don't belong to", async () => {
    const ctx = createContext({ role: "user", userId: 9999 });
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.aiCalls.list({ accountId: 1, page: 1, limit: 10 })
    ).rejects.toThrow();
  });

  it("admin can list AI calls for any account", async () => {
    const ctx = createContext({ role: "admin", userId: 1 });
    const caller = appRouter.createCaller(ctx);

    // listAICalls returns { data, total }
    const result = await caller.aiCalls.list({ accountId: 1, page: 1, limit: 10 });
    expect(result).toHaveProperty("data");
    expect(result).toHaveProperty("total");
  });
});

// ─── SECTION 8: Impersonation context ───

describe("Tenant Isolation — Impersonation", () => {
  it("impersonation status reads from cookie header, not ctx.impersonation", async () => {
    // The status procedure reads cookies from req.headers.cookie, not ctx.impersonation
    const impersonationPayload = JSON.stringify({
      impersonatedAccountId: 42,
      impersonatedAccountName: "Test Client",
      impersonatorUserId: 1,
      impersonatorName: "Admin User",
    });
    const cookieHeader = `apex_impersonation=${encodeURIComponent(impersonationPayload)}`;

    const ctx = createContext({
      role: "admin",
      userId: 1,
      cookieHeader,
    });
    const caller = appRouter.createCaller(ctx);

    const status = await caller.impersonation.status();
    expect(status.isImpersonating).toBe(true);
    expect(status.impersonatedAccountId).toBe(42);
    expect(status.impersonatedAccountName).toBe("Test Client");
  });

  it("impersonation status returns inactive when no cookie", async () => {
    const ctx = createContext({ role: "admin", userId: 1 });
    const caller = appRouter.createCaller(ctx);

    const status = await caller.impersonation.status();
    expect(status.isImpersonating).toBe(false);
  });

  it("impersonation status is a protectedProcedure (non-admin can call but gets inactive)", async () => {
    // status is protectedProcedure, not adminProcedure — any logged-in user can check
    // but without the cookie they'll get isImpersonating: false
    const ctx = createContext({ role: "user", userId: 2 });
    const caller = appRouter.createCaller(ctx);

    const status = await caller.impersonation.status();
    expect(status.isImpersonating).toBe(false);
  });

  it("non-admin cannot start impersonation", async () => {
    const ctx = createContext({ role: "user", userId: 2 });
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.impersonation.start({ accountId: 1 })
    ).rejects.toThrow();
  });
});

// ─── SECTION 9: Facebook Pages admin-only ───

describe("Tenant Isolation — Facebook Pages Admin Only", () => {
  it("non-admin cannot list facebook page mappings", async () => {
    const ctx = createContext({ role: "user", userId: 2 });
    const caller = appRouter.createCaller(ctx);

    await expect(caller.facebookPages.list()).rejects.toThrow();
  });

  it("admin can list facebook page mappings", async () => {
    const ctx = createContext({ role: "admin", userId: 1 });
    const caller = appRouter.createCaller(ctx);

    // facebookPages.list returns { mappings }
    const result = await caller.facebookPages.list();
    expect(result).toHaveProperty("mappings");
    expect(Array.isArray(result.mappings)).toBe(true);
  });
});

// ─── SECTION 10: Unauthenticated access ───

describe("Tenant Isolation — Unauthenticated", () => {
  it("unauthenticated user cannot access protected routes", async () => {
    const ctx: TrpcContext = {
      user: null,
      impersonation: NO_IMPERSONATION,
      req: { protocol: "https", headers: {} } as TrpcContext["req"],
      res: {
        clearCookie: () => {},
        cookie: () => {},
      } as TrpcContext["res"],
    };
    const caller = appRouter.createCaller(ctx);

    await expect(caller.accounts.list()).rejects.toThrow();
    await expect(
      caller.contacts.list({ accountId: 1, limit: 10, offset: 0 })
    ).rejects.toThrow();
  });
});
