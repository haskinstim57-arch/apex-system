import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createMockContext(overrides?: Partial<AuthenticatedUser>): TrpcContext {
  const user: AuthenticatedUser = {
    id: 1,
    openId: "test-admin-1",
    email: "admin@example.com",
    name: "Test Admin",
    loginMethod: "manus",
    role: "admin",
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

describe("accounts router", () => {
  describe("create input validation", () => {
    it("rejects create with empty name", async () => {
      const ctx = createMockContext();
      const caller = appRouter.createCaller(ctx);

      await expect(
        caller.accounts.create({
          name: "",
          ownerEmail: "owner@example.com",
        })
      ).rejects.toThrow();
    });

    it("rejects create with invalid owner email", async () => {
      const ctx = createMockContext();
      const caller = appRouter.createCaller(ctx);

      await expect(
        caller.accounts.create({
          name: "Test Account",
          ownerEmail: "not-an-email",
        })
      ).rejects.toThrow();
    });

    it("rejects create with invalid status", async () => {
      const ctx = createMockContext();
      const caller = appRouter.createCaller(ctx);

      await expect(
        caller.accounts.create({
          name: "Test Account",
          ownerEmail: "owner@example.com",
          status: "invalid" as any,
        })
      ).rejects.toThrow();
    });

    it("accepts valid active status and creates account", async () => {
      const ctx = createMockContext();
      const caller = appRouter.createCaller(ctx);

      const result = await caller.accounts.create({
        name: "Test Account Active",
        ownerEmail: "owner-active@example.com",
        status: "active",
      });
      expect(result).toBeDefined();
      expect(result.id).toBeGreaterThan(0);
    });

    it("accepts valid suspended status and creates account", async () => {
      const ctx = createMockContext();
      const caller = appRouter.createCaller(ctx);

      const result = await caller.accounts.create({
        name: "Test Account Suspended",
        ownerEmail: "owner-suspended@example.com",
        status: "suspended",
      });
      expect(result).toBeDefined();
      expect(result.id).toBeGreaterThan(0);
    });

    it("accepts optional industry field and creates account", async () => {
      const ctx = createMockContext();
      const caller = appRouter.createCaller(ctx);

      const result = await caller.accounts.create({
        name: "Test Account Industry",
        ownerEmail: "owner-industry@example.com",
        industry: "real_estate",
      });
      expect(result).toBeDefined();
      expect(result.id).toBeGreaterThan(0);
    });
  });

  describe("RBAC - admin-only access", () => {
    it("rejects non-admin user from creating accounts", async () => {
      const ctx = createMockContext({ role: "user" });
      const caller = appRouter.createCaller(ctx);

      await expect(
        caller.accounts.create({
          name: "Test Account",
          ownerEmail: "owner@example.com",
        })
      ).rejects.toThrow();
    });

    it("rejects unauthenticated user from creating accounts", async () => {
      const ctx = createUnauthContext();
      const caller = appRouter.createCaller(ctx);

      await expect(
        caller.accounts.create({
          name: "Test Account",
          ownerEmail: "owner@example.com",
        })
      ).rejects.toThrow();
    });

    it("rejects non-admin user from deleting accounts", async () => {
      const ctx = createMockContext({ role: "user" });
      const caller = appRouter.createCaller(ctx);

      await expect(
        caller.accounts.delete({ id: 1 })
      ).rejects.toThrow();
    });

    it("rejects unauthenticated user from listing accounts", async () => {
      const ctx = createUnauthContext();
      const caller = appRouter.createCaller(ctx);

      await expect(
        caller.accounts.list()
      ).rejects.toThrow();
    });

    it("rejects unauthenticated user from getting admin stats", async () => {
      const ctx = createUnauthContext();
      const caller = appRouter.createCaller(ctx);

      await expect(
        caller.accounts.adminStats()
      ).rejects.toThrow();
    });

    it("rejects non-admin from admin stats", async () => {
      const ctx = createMockContext({ role: "user" });
      const caller = appRouter.createCaller(ctx);

      await expect(
        caller.accounts.adminStats()
      ).rejects.toThrow();
    });
  });

  describe("update input validation", () => {
    it("rejects update with invalid id", async () => {
      const ctx = createMockContext();
      const caller = appRouter.createCaller(ctx);

      await expect(
        caller.accounts.update({ id: -1, name: "Updated" })
      ).rejects.toThrow();
    });

    it("rejects update with empty name", async () => {
      const ctx = createMockContext();
      const caller = appRouter.createCaller(ctx);

      await expect(
        caller.accounts.update({ id: 1, name: "" })
      ).rejects.toThrow();
    });

    it("rejects update with invalid status", async () => {
      const ctx = createMockContext();
      const caller = appRouter.createCaller(ctx);

      await expect(
        caller.accounts.update({ id: 1, status: "invalid" as any })
      ).rejects.toThrow();
    });
  });

  describe("get input validation", () => {
    it("rejects get with invalid id", async () => {
      const ctx = createMockContext();
      const caller = appRouter.createCaller(ctx);

      await expect(
        caller.accounts.get({ id: -1 })
      ).rejects.toThrow();
    });

    it("rejects get with zero id", async () => {
      const ctx = createMockContext();
      const caller = appRouter.createCaller(ctx);

      await expect(
        caller.accounts.get({ id: 0 })
      ).rejects.toThrow();
    });
  });

  describe("delete input validation", () => {
    it("rejects delete with invalid id", async () => {
      const ctx = createMockContext();
      const caller = appRouter.createCaller(ctx);

      await expect(
        caller.accounts.delete({ id: -1 })
      ).rejects.toThrow();
    });
  });

  describe("router structure", () => {
    it("has accounts router on appRouter", () => {
      const router = appRouter._def.record;
      expect(router.accounts).toBeDefined();
    });

    it("accounts router has all required procedures", async () => {
      const ctx = createMockContext();
      const caller = appRouter.createCaller(ctx);
      expect(typeof caller.accounts.create).toBe("function");
      expect(typeof caller.accounts.list).toBe("function");
      expect(typeof caller.accounts.get).toBe("function");
      expect(typeof caller.accounts.update).toBe("function");
      expect(typeof caller.accounts.delete).toBe("function");
      expect(typeof caller.accounts.adminStats).toBe("function");
    });

    it("has members router on appRouter", () => {
      const router = appRouter._def.record;
      expect(router.members).toBeDefined();
    });

    it("members router has all required procedures", async () => {
      const ctx = createMockContext();
      const caller = appRouter.createCaller(ctx);
      expect(typeof caller.members.list).toBe("function");
      expect(typeof caller.members.updateRole).toBe("function");
      expect(typeof caller.members.toggleStatus).toBe("function");
      expect(typeof caller.members.remove).toBe("function");
      expect(typeof caller.members.myMembership).toBe("function");
    });

    it("has invitations router on appRouter", () => {
      const router = appRouter._def.record;
      expect(router.invitations).toBeDefined();
    });

    it("invitations router has all required procedures", async () => {
      const ctx = createMockContext();
      const caller = appRouter.createCaller(ctx);
      expect(typeof caller.invitations.create).toBe("function");
      expect(typeof caller.invitations.accept).toBe("function");
      expect(typeof caller.invitations.getByToken).toBe("function");
      expect(typeof caller.invitations.list).toBe("function");
      expect(typeof caller.invitations.revoke).toBe("function");
    });
  });

  describe("members RBAC", () => {
    it("rejects unauthenticated user from listing members", async () => {
      const ctx = createUnauthContext();
      const caller = appRouter.createCaller(ctx);

      await expect(
        caller.members.list({ accountId: 1 })
      ).rejects.toThrow();
    });

    it("rejects self role change", async () => {
      const ctx = createMockContext();
      const caller = appRouter.createCaller(ctx);

      await expect(
        caller.members.updateRole({
          accountId: 1,
          userId: 1, // same as ctx.user.id
          role: "employee",
        })
      ).rejects.toThrow("You cannot change your own role.");
    });

    it("rejects self removal", async () => {
      const ctx = createMockContext();
      const caller = appRouter.createCaller(ctx);

      await expect(
        caller.members.remove({
          accountId: 1,
          userId: 1, // same as ctx.user.id
        })
      ).rejects.toThrow("You cannot remove yourself.");
    });

    it("rejects self deactivation", async () => {
      const ctx = createMockContext();
      const caller = appRouter.createCaller(ctx);

      await expect(
        caller.members.toggleStatus({
          accountId: 1,
          userId: 1, // same as ctx.user.id
          isActive: false,
        })
      ).rejects.toThrow("You cannot deactivate yourself.");
    });
  });

  describe("invitations input validation", () => {
    it("rejects invitation with invalid email", async () => {
      const ctx = createMockContext();
      const caller = appRouter.createCaller(ctx);

      await expect(
        caller.invitations.create({
          accountId: 1,
          email: "not-valid",
          role: "employee",
        })
      ).rejects.toThrow();
    });

    it("rejects invitation with empty token", async () => {
      const ctx = createMockContext();
      const caller = appRouter.createCaller(ctx);

      await expect(
        caller.invitations.accept({ token: "" })
      ).rejects.toThrow();
    });

    it("rejects invitation with invalid accountId", async () => {
      const ctx = createMockContext();
      const caller = appRouter.createCaller(ctx);

      await expect(
        caller.invitations.create({
          accountId: -1,
          email: "test@example.com",
          role: "employee",
        })
      ).rejects.toThrow();
    });

    it("rejects invitation with invalid role", async () => {
      const ctx = createMockContext();
      const caller = appRouter.createCaller(ctx);

      await expect(
        caller.invitations.create({
          accountId: 1,
          email: "test@example.com",
          role: "superadmin" as any,
        })
      ).rejects.toThrow();
    });
  });
});
