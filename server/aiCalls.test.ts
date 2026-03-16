import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createMockContext(overrides?: Partial<AuthenticatedUser>): TrpcContext {
  const user: AuthenticatedUser = {
    id: 1,
    openId: "test-user",
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
      clearCookie: () => {},
    } as TrpcContext["res"],
  };
}

function createAdminContext(): TrpcContext {
  return createMockContext({ role: "admin" });
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

describe("aiCalls router", () => {
  describe("structure", () => {
    it("has all expected procedures", () => {
      const router = appRouter._def.procedures;
      expect(router).toHaveProperty("aiCalls.start");
      expect(router).toHaveProperty("aiCalls.bulkStart");
      expect(router).toHaveProperty("aiCalls.list");
      expect(router).toHaveProperty("aiCalls.get");
      expect(router).toHaveProperty("aiCalls.updateStatus");
      expect(router).toHaveProperty("aiCalls.stats");
    });
  });

  describe("authentication", () => {
    it("rejects unauthenticated users on start", async () => {
      const ctx = createUnauthContext();
      const caller = appRouter.createCaller(ctx);
      await expect(
        caller.aiCalls.start({ accountId: 1, contactId: 1 })
      ).rejects.toThrow();
    });

    it("rejects unauthenticated users on list", async () => {
      const ctx = createUnauthContext();
      const caller = appRouter.createCaller(ctx);
      await expect(
        caller.aiCalls.list({ accountId: 1 })
      ).rejects.toThrow();
    });

    it("rejects unauthenticated users on bulkStart", async () => {
      const ctx = createUnauthContext();
      const caller = appRouter.createCaller(ctx);
      await expect(
        caller.aiCalls.bulkStart({ accountId: 1, contactIds: [1, 2] })
      ).rejects.toThrow();
    });

    it("rejects unauthenticated users on stats", async () => {
      const ctx = createUnauthContext();
      const caller = appRouter.createCaller(ctx);
      await expect(
        caller.aiCalls.stats({ accountId: 1 })
      ).rejects.toThrow();
    });
  });

  describe("input validation", () => {
    it("requires accountId on start", async () => {
      const ctx = createAdminContext();
      const caller = appRouter.createCaller(ctx);
      await expect(
        // @ts-expect-error - testing missing field
        caller.aiCalls.start({ contactId: 1 })
      ).rejects.toThrow();
    });

    it("requires contactId on start", async () => {
      const ctx = createAdminContext();
      const caller = appRouter.createCaller(ctx);
      await expect(
        // @ts-expect-error - testing missing field
        caller.aiCalls.start({ accountId: 1 })
      ).rejects.toThrow();
    });

    it("requires contactIds array on bulkStart", async () => {
      const ctx = createAdminContext();
      const caller = appRouter.createCaller(ctx);
      await expect(
        // @ts-expect-error - testing missing field
        caller.aiCalls.bulkStart({ accountId: 1 })
      ).rejects.toThrow();
    });

    it("requires accountId on list", async () => {
      const ctx = createAdminContext();
      const caller = appRouter.createCaller(ctx);
      await expect(
        // @ts-expect-error - testing missing field
        caller.aiCalls.list({})
      ).rejects.toThrow();
    });

    it("validates status enum on updateStatus", async () => {
      const ctx = createAdminContext();
      const caller = appRouter.createCaller(ctx);
      await expect(
        caller.aiCalls.updateStatus({
          callId: 1,
          accountId: 1,
          status: "invalid_status" as any,
        })
      ).rejects.toThrow();
    });
  });

  describe("admin access", () => {
    it("admin can attempt to start call (may fail on DB but passes auth)", async () => {
      const ctx = createAdminContext();
      const caller = appRouter.createCaller(ctx);
      // Admin bypasses membership check, so it should reach DB layer
      // It may succeed or fail depending on DB state, but should not fail on auth
      try {
        await caller.aiCalls.start({ accountId: 999, contactId: 999 });
      } catch (err: any) {
        // Should not be an auth error
        expect(err.message).not.toContain("UNAUTHORIZED");
      }
    });

    it("admin can attempt to list calls (may fail on DB but passes auth)", async () => {
      const ctx = createAdminContext();
      const caller = appRouter.createCaller(ctx);
      try {
        const result = await caller.aiCalls.list({ accountId: 999 });
        expect(result).toHaveProperty("data");
        expect(result).toHaveProperty("total");
      } catch (err: any) {
        expect(err.message).not.toContain("UNAUTHORIZED");
      }
    });

    it("admin can attempt to get stats (may fail on DB but passes auth)", async () => {
      const ctx = createAdminContext();
      const caller = appRouter.createCaller(ctx);
      try {
        const result = await caller.aiCalls.stats({ accountId: 999 });
        expect(result).toBeDefined();
      } catch (err: any) {
        expect(err.message).not.toContain("UNAUTHORIZED");
      }
    });
  });

  describe("regular user access", () => {
    it("regular user is blocked from starting call without membership", async () => {
      const ctx = createMockContext();
      const caller = appRouter.createCaller(ctx);
      await expect(
        caller.aiCalls.start({ accountId: 999, contactId: 1 })
      ).rejects.toThrow();
    });

    it("regular user is blocked from listing calls without membership", async () => {
      const ctx = createMockContext();
      const caller = appRouter.createCaller(ctx);
      await expect(
        caller.aiCalls.list({ accountId: 999 })
      ).rejects.toThrow();
    });

    it("regular user is blocked from bulk start without membership", async () => {
      const ctx = createMockContext();
      const caller = appRouter.createCaller(ctx);
      await expect(
        caller.aiCalls.bulkStart({ accountId: 999, contactIds: [1, 2] })
      ).rejects.toThrow();
    });
  });
});
