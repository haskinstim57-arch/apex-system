import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createAdminContext(): TrpcContext {
  const user: AuthenticatedUser = {
    id: 1,
    openId: "admin-user",
    email: "admin@example.com",
    name: "Admin User",
    loginMethod: "manus",
    role: "admin",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };
  return {
    user,
    req: {
      headers: { cookie: "" },
    } as any,
    res: {
      clearCookie: () => {},
    } as any,
  };
}

function createNonAdminContext(): TrpcContext {
  const user: AuthenticatedUser = {
    id: 2,
    openId: "regular-user",
    email: "user@example.com",
    name: "Regular User",
    loginMethod: "manus",
    role: "user",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };
  return {
    user,
    req: {
      headers: { cookie: "" },
    } as any,
    res: {
      clearCookie: () => {},
    } as any,
  };
}

function createUnauthContext(): TrpcContext {
  return {
    user: null,
    req: {
      headers: { cookie: "" },
    } as any,
    res: {
      clearCookie: () => {},
    } as any,
  };
}

describe("leadMonitor router", () => {
  const caller = (ctx: TrpcContext) => appRouter.createCaller(ctx);

  // ─── Admin access tests ───
  describe("getOverview", () => {
    it("returns overview stats for admin users", async () => {
      const ctx = createAdminContext();
      const result = await caller(ctx).leadMonitor.getOverview({ hoursBack: 168 });
      expect(result).toHaveProperty("totalEvents");
      expect(result).toHaveProperty("successRate");
      expect(result).toHaveProperty("successCount");
      expect(result).toHaveProperty("failureCount");
      expect(result).toHaveProperty("avgResponseTimeMs");
      expect(result).toHaveProperty("unacknowledgedFailures");
      expect(result).toHaveProperty("last24hEvents");
      expect(typeof result.totalEvents).toBe("number");
      expect(typeof result.successRate).toBe("number");
      expect(result.successRate).toBeGreaterThanOrEqual(0);
      expect(result.successRate).toBeLessThanOrEqual(100);
    });

    it("rejects non-admin users", async () => {
      const ctx = createNonAdminContext();
      await expect(
        caller(ctx).leadMonitor.getOverview({ hoursBack: 168 })
      ).rejects.toThrow("admin-only");
    });

    it("rejects unauthenticated users", async () => {
      const ctx = createUnauthContext();
      await expect(
        caller(ctx).leadMonitor.getOverview({ hoursBack: 168 })
      ).rejects.toThrow();
    });
  });

  describe("getRecentEvents", () => {
    it("returns paginated events for admin", async () => {
      const ctx = createAdminContext();
      const result = await caller(ctx).leadMonitor.getRecentEvents({
        limit: 10,
        offset: 0,
      });
      expect(Array.isArray(result)).toBe(true);
    });

    it("supports status filter", async () => {
      const ctx = createAdminContext();
      const result = await caller(ctx).leadMonitor.getRecentEvents({
        limit: 10,
        offset: 0,
        status: "failure",
      });
      expect(Array.isArray(result)).toBe(true);
      // All returned events should be failures (if any exist)
      for (const event of result) {
        expect(event.status).toBe("failure");
      }
    });

    it("rejects non-admin users", async () => {
      const ctx = createNonAdminContext();
      await expect(
        caller(ctx).leadMonitor.getRecentEvents({ limit: 10, offset: 0 })
      ).rejects.toThrow("admin-only");
    });
  });

  describe("getTimeSeries", () => {
    it("returns time series data for admin", async () => {
      const ctx = createAdminContext();
      const result = await caller(ctx).leadMonitor.getTimeSeries({ hoursBack: 24 });
      expect(Array.isArray(result)).toBe(true);
      // Each point should have the expected shape
      for (const point of result) {
        expect(point).toHaveProperty("hour");
        expect(point).toHaveProperty("success");
        expect(point).toHaveProperty("failure");
        expect(point).toHaveProperty("partial");
      }
    });

    it("rejects non-admin users", async () => {
      const ctx = createNonAdminContext();
      await expect(
        caller(ctx).leadMonitor.getTimeSeries({ hoursBack: 24 })
      ).rejects.toThrow("admin-only");
    });
  });

  describe("getFailures", () => {
    it("returns unacknowledged failures for admin", async () => {
      const ctx = createAdminContext();
      const result = await caller(ctx).leadMonitor.getFailures();
      expect(Array.isArray(result)).toBe(true);
      // All returned events should be failures
      for (const event of result) {
        expect(event.status).toBe("failure");
        expect(event.acknowledged).toBe(false);
      }
    });

    it("rejects non-admin users", async () => {
      const ctx = createNonAdminContext();
      await expect(
        caller(ctx).leadMonitor.getFailures()
      ).rejects.toThrow("admin-only");
    });
  });

  describe("acknowledgeAll", () => {
    it("acknowledges all failures for admin", async () => {
      const ctx = createAdminContext();
      const result = await caller(ctx).leadMonitor.acknowledgeAll();
      expect(result).toHaveProperty("acknowledged");
      expect(typeof result.acknowledged).toBe("number");
    });

    it("rejects non-admin users", async () => {
      const ctx = createNonAdminContext();
      await expect(
        caller(ctx).leadMonitor.acknowledgeAll()
      ).rejects.toThrow("admin-only");
    });
  });

  describe("getMethodBreakdown", () => {
    it("returns routing method breakdown for admin", async () => {
      const ctx = createAdminContext();
      const result = await caller(ctx).leadMonitor.getMethodBreakdown({ hoursBack: 168 });
      expect(Array.isArray(result)).toBe(true);
      for (const item of result) {
        expect(item).toHaveProperty("routingMethod");
        expect(item).toHaveProperty("total");
        expect(item).toHaveProperty("successCount");
        expect(item).toHaveProperty("failureCount");
      }
    });

    it("rejects non-admin users", async () => {
      const ctx = createNonAdminContext();
      await expect(
        caller(ctx).leadMonitor.getMethodBreakdown({ hoursBack: 168 })
      ).rejects.toThrow("admin-only");
    });
  });
});
