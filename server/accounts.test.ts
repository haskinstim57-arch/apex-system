import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

// ─── Test Helpers ───

function createMockContext(
  userOverrides: Partial<AuthenticatedUser> = {}
): TrpcContext {
  const user: AuthenticatedUser = {
    id: 1,
    openId: "test-admin-user",
    email: "admin@apex.test",
    name: "Test Admin",
    loginMethod: "manus",
    role: "admin",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
    ...userOverrides,
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

function createUnauthenticatedContext(): TrpcContext {
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

// ─── Auth Tests ───

describe("auth.me", () => {
  it("returns null for unauthenticated users", async () => {
    const ctx = createUnauthenticatedContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.auth.me();
    expect(result).toBeNull();
  });

  it("returns user data for authenticated users", async () => {
    const ctx = createMockContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.auth.me();
    expect(result).toBeDefined();
    expect(result?.email).toBe("admin@apex.test");
    expect(result?.role).toBe("admin");
  });
});

// ─── RBAC Guard Tests ───

describe("RBAC: admin-only procedures", () => {
  it("blocks non-admin users from creating accounts", async () => {
    const ctx = createMockContext({ role: "user", id: 99 });
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.accounts.create({
        name: "Test Account",
        ownerId: 99,
      })
    ).rejects.toThrow();
  });

  it("blocks unauthenticated users from creating accounts", async () => {
    const ctx = createUnauthenticatedContext();
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.accounts.create({
        name: "Test Account",
        ownerId: 1,
      })
    ).rejects.toThrow();
  });

  it("blocks non-admin users from deleting accounts", async () => {
    const ctx = createMockContext({ role: "user", id: 99 });
    const caller = appRouter.createCaller(ctx);

    await expect(caller.accounts.delete({ id: 1 })).rejects.toThrow();
  });

  it("blocks non-admin users from viewing admin stats", async () => {
    const ctx = createMockContext({ role: "user", id: 99 });
    const caller = appRouter.createCaller(ctx);

    await expect(caller.accounts.adminStats()).rejects.toThrow();
  });
});

// ─── Protected Procedure Tests ───

describe("RBAC: protected procedures", () => {
  it("blocks unauthenticated users from listing accounts", async () => {
    const ctx = createUnauthenticatedContext();
    const caller = appRouter.createCaller(ctx);

    await expect(caller.accounts.list()).rejects.toThrow();
  });

  it("blocks unauthenticated users from listing members", async () => {
    const ctx = createUnauthenticatedContext();
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.members.list({ accountId: 1 })
    ).rejects.toThrow();
  });

  it("blocks unauthenticated users from creating invitations", async () => {
    const ctx = createUnauthenticatedContext();
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.invitations.create({
        accountId: 1,
        email: "test@test.com",
        role: "employee",
      })
    ).rejects.toThrow();
  });

  it("blocks unauthenticated users from accepting invitations", async () => {
    const ctx = createUnauthenticatedContext();
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.invitations.accept({ token: "fake-token" })
    ).rejects.toThrow();
  });
});

// ─── Input Validation Tests ───

describe("input validation", () => {
  it("rejects empty account name", async () => {
    const ctx = createMockContext();
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.accounts.create({
        name: "",
        ownerId: 1,
      })
    ).rejects.toThrow();
  });

  it("rejects invalid email in invitation", async () => {
    const ctx = createMockContext();
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.invitations.create({
        accountId: 1,
        email: "not-an-email",
        role: "employee",
      })
    ).rejects.toThrow();
  });

  it("rejects invalid role in member update", async () => {
    const ctx = createMockContext();
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.members.updateRole({
        accountId: 1,
        userId: 2,
        role: "superadmin" as any,
      })
    ).rejects.toThrow();
  });

  it("rejects negative account ID", async () => {
    const ctx = createMockContext();
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.accounts.get({ id: -1 })
    ).rejects.toThrow();
  });
});

// ─── Self-Action Prevention Tests ───

describe("self-action prevention", () => {
  it("prevents user from changing their own role", async () => {
    const ctx = createMockContext({ id: 5 });
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.members.updateRole({
        accountId: 1,
        userId: 5,
        role: "owner",
      })
    ).rejects.toThrow("You cannot change your own role");
  });

  it("prevents user from removing themselves", async () => {
    const ctx = createMockContext({ id: 5 });
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.members.remove({
        accountId: 1,
        userId: 5,
      })
    ).rejects.toThrow("You cannot remove yourself");
  });

  it("prevents user from deactivating themselves", async () => {
    const ctx = createMockContext({ id: 5 });
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.members.toggleStatus({
        accountId: 1,
        userId: 5,
        isActive: false,
      })
    ).rejects.toThrow("You cannot deactivate yourself");
  });
});

// ─── Public Procedure Tests ───

describe("public procedures", () => {
  it("allows unauthenticated users to view invitation by token", async () => {
    const ctx = createUnauthenticatedContext();
    const caller = appRouter.createCaller(ctx);

    // Should throw NOT_FOUND (not UNAUTHORIZED), proving the procedure is public
    await expect(
      caller.invitations.getByToken({ token: "nonexistent-token" })
    ).rejects.toThrow("Invitation not found");
  });
});

// ─── Router Structure Tests ───

describe("router structure", () => {
  it("has all expected routers", () => {
    const procedures = Object.keys(appRouter._def.procedures);
    expect(procedures).toContain("auth.me");
    expect(procedures).toContain("auth.logout");
    expect(procedures).toContain("accounts.create");
    expect(procedures).toContain("accounts.list");
    expect(procedures).toContain("accounts.get");
    expect(procedures).toContain("accounts.update");
    expect(procedures).toContain("accounts.delete");
    expect(procedures).toContain("accounts.adminStats");
    expect(procedures).toContain("members.list");
    expect(procedures).toContain("members.updateRole");
    expect(procedures).toContain("members.toggleStatus");
    expect(procedures).toContain("members.remove");
    expect(procedures).toContain("members.myMembership");
    expect(procedures).toContain("invitations.create");
    expect(procedures).toContain("invitations.accept");
    expect(procedures).toContain("invitations.getByToken");
    expect(procedures).toContain("invitations.list");
    expect(procedures).toContain("invitations.revoke");
  });
});
