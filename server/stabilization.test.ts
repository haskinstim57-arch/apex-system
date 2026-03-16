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

// ─── SECTION 1: Admin Agency Scope ───

describe("Stabilization — Admin Agency Scope", () => {
  it("admin can list accounts without selecting one first", async () => {
    const ctx = createContext({ role: "admin", userId: 1 });
    const caller = appRouter.createCaller(ctx);

    // Admin in agency scope can still list all accounts
    const accounts = await caller.accounts.list();
    expect(Array.isArray(accounts)).toBe(true);
  });

  it("admin can view adminStats without selecting an account", async () => {
    const ctx = createContext({ role: "admin", userId: 1 });
    const caller = appRouter.createCaller(ctx);

    const stats = await caller.accounts.adminStats();
    expect(stats).toHaveProperty("totalAccounts");
    expect(stats).toHaveProperty("totalUsers");
  });

  it("admin impersonation overrides account context", async () => {
    const impersonationPayload = JSON.stringify({
      impersonatedAccountId: 99,
      impersonatedAccountName: "Impersonated Account",
      impersonatorUserId: 1,
      impersonatorName: "Admin",
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
    expect(status.impersonatedAccountId).toBe(99);
  });
});

// ─── SECTION 2: Contact Creation Scoping ───

describe("Stabilization — Contact Creation Scoping", () => {
  it("non-member cannot create a contact in an account they don't belong to", async () => {
    const ctx = createContext({ role: "user", userId: 9999 });
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.contacts.create({
        accountId: 1,
        firstName: "Test",
        lastName: "Contact",
        email: "test@example.com",
      })
    ).rejects.toThrow("You do not have access to this account");
  });

  it("admin can create a contact in any account", async () => {
    const ctx = createContext({ role: "admin", userId: 1 });
    const caller = appRouter.createCaller(ctx);

    // Admin bypass allows creation in any account
    const contact = await caller.contacts.create({
      accountId: 1,
      firstName: "Admin Created",
      lastName: "Contact",
      email: `admin-test-${Date.now()}@example.com`,
    });
    expect(contact).toHaveProperty("id");
    // contacts.create returns the raw DB row — field names may vary
    expect(contact.id).toBeGreaterThan(0);
  });
});

// ─── SECTION 3: Cross-Account Data Isolation ───

describe("Stabilization — Cross-Account Data Isolation", () => {
  it("user in account 1 cannot access contacts in account 2", async () => {
    const ctx = createContext({ role: "user", userId: 9999 });
    const caller = appRouter.createCaller(ctx);

    // User 9999 is not a member of account 2
    await expect(
      caller.contacts.list({ accountId: 2, limit: 10, offset: 0 })
    ).rejects.toThrow("You do not have access to this account");
  });

  it("user in account 1 cannot access messages in account 2", async () => {
    const ctx = createContext({ role: "user", userId: 9999 });
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.messages.list({ accountId: 2, limit: 10, offset: 0 })
    ).rejects.toThrow("You do not have access to this account");
  });

  it("user in account 1 cannot access campaigns in account 2", async () => {
    const ctx = createContext({ role: "user", userId: 9999 });
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.campaigns.list({ accountId: 2, limit: 10, offset: 0 })
    ).rejects.toThrow();
  });

  it("user in account 1 cannot access pipeline in account 2", async () => {
    const ctx = createContext({ role: "user", userId: 9999 });
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.pipeline.getDefault({ accountId: 2 })
    ).rejects.toThrow("You do not have access to this account");
  });

  it("user in account 1 cannot access automations in account 2", async () => {
    const ctx = createContext({ role: "user", userId: 9999 });
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.automations.list({ accountId: 2 })
    ).rejects.toThrow("You do not have access to this account");
  });

  it("user in account 1 cannot access AI calls in account 2", async () => {
    const ctx = createContext({ role: "user", userId: 9999 });
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.aiCalls.list({ accountId: 2, page: 1, limit: 10 })
    ).rejects.toThrow();
  });
});

// ─── SECTION 4: Admin-Only Routes ───

describe("Stabilization — Admin-Only Routes", () => {
  it("non-admin cannot access facebook page mappings", async () => {
    const ctx = createContext({ role: "user", userId: 2 });
    const caller = appRouter.createCaller(ctx);

    await expect(caller.facebookPages.list()).rejects.toThrow();
  });

  it("non-admin cannot start impersonation", async () => {
    const ctx = createContext({ role: "user", userId: 2 });
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.impersonation.start({ accountId: 1 })
    ).rejects.toThrow();
  });

  it("non-admin cannot view impersonation audit logs", async () => {
    const ctx = createContext({ role: "user", userId: 2 });
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.impersonation.auditLogs({ limit: 10, offset: 0 })
    ).rejects.toThrow();
  });

  it("admin can access impersonation audit logs", async () => {
    const ctx = createContext({ role: "admin", userId: 1 });
    const caller = appRouter.createCaller(ctx);

    const result = await caller.impersonation.auditLogs({ limit: 10, offset: 0 });
    // auditLogs returns an array directly
    expect(Array.isArray(result)).toBe(true);
  });
});

// ─── SECTION 5: Seed Data Idempotency ───

describe("Stabilization — Seed Data", () => {
  it("seed script file exists and has idempotency check", async () => {
    const fs = await import("fs");
    const seedContent = fs.readFileSync(
      "./server/seed-templates.mjs",
      "utf-8"
    );

    // Verify the idempotency check exists
    expect(seedContent).toContain("Seed skipped");
    expect(seedContent).toContain("existingCount >= templates.length");
  });
});
