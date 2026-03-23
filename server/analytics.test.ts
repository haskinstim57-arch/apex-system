import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createAuthContext(): TrpcContext {
  const user: AuthenticatedUser = {
    id: 1,
    openId: "analytics-test-user",
    email: "analytics@example.com",
    name: "Analytics Test",
    loginMethod: "manus",
    role: "admin",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };

  return {
    user,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: () => {} } as unknown as TrpcContext["res"],
  };
}

function createUnauthContext(): TrpcContext {
  return {
    user: null,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: () => {} } as unknown as TrpcContext["res"],
  };
}

describe("analytics", () => {
  describe("kpis", () => {
    it("requires authentication", async () => {
      const caller = appRouter.createCaller(createUnauthContext());
      await expect(caller.analytics.kpis({ accountId: 1, days: 30 })).rejects.toThrow();
    });

    it("returns KPI data structure with all expected fields", async () => {
      const caller = appRouter.createCaller(createAuthContext());
      const result = await caller.analytics.kpis({ accountId: 1, days: 30 });
      expect(result).toHaveProperty("totalContacts");
      expect(result).toHaveProperty("newContacts");
      expect(result).toHaveProperty("contactsChange");
      expect(result).toHaveProperty("messagesSent");
      expect(result).toHaveProperty("messagesChange");
      expect(result).toHaveProperty("aiCallsMade");
      expect(result).toHaveProperty("callCompletionRate");
      expect(result).toHaveProperty("callsChange");
      expect(result).toHaveProperty("pipelineValue");
      expect(result).toHaveProperty("pipelineChange");
      expect(result).toHaveProperty("appointmentsBooked");
      expect(result).toHaveProperty("appointmentsChange");
      expect(result).toHaveProperty("campaignsSent");
      expect(result).toHaveProperty("campaignsChange");
      expect(typeof result.totalContacts).toBe("number");
      expect(typeof result.contactsChange).toBe("number");
    });
  });

  describe("contactsGrowth", () => {
    it("requires authentication", async () => {
      const caller = appRouter.createCaller(createUnauthContext());
      await expect(caller.analytics.contactsGrowth({ accountId: 1, days: 30 })).rejects.toThrow();
    });

    it("returns array of date/count objects", async () => {
      const caller = appRouter.createCaller(createAuthContext());
      const result = await caller.analytics.contactsGrowth({ accountId: 1, days: 7 });
      expect(Array.isArray(result)).toBe(true);
      if (result.length > 0) {
        expect(result[0]).toHaveProperty("date");
        expect(result[0]).toHaveProperty("count");
      }
    });
  });

  describe("messagesByChannel", () => {
    it("requires authentication", async () => {
      const caller = appRouter.createCaller(createUnauthContext());
      await expect(caller.analytics.messagesByChannel({ accountId: 1, days: 30 })).rejects.toThrow();
    });

    it("returns array with date/sms/email fields", async () => {
      const caller = appRouter.createCaller(createAuthContext());
      const result = await caller.analytics.messagesByChannel({ accountId: 1, days: 30 });
      expect(Array.isArray(result)).toBe(true);
      if (result.length > 0) {
        expect(result[0]).toHaveProperty("date");
        expect(result[0]).toHaveProperty("sms");
        expect(result[0]).toHaveProperty("email");
      }
    });
  });

  describe("callOutcomes", () => {
    it("requires authentication", async () => {
      const caller = appRouter.createCaller(createUnauthContext());
      await expect(caller.analytics.callOutcomes({ accountId: 1, days: 30 })).rejects.toThrow();
    });

    it("returns array with status/count fields", async () => {
      const caller = appRouter.createCaller(createAuthContext());
      const result = await caller.analytics.callOutcomes({ accountId: 1, days: 30 });
      expect(Array.isArray(result)).toBe(true);
      if (result.length > 0) {
        expect(result[0]).toHaveProperty("status");
        expect(result[0]).toHaveProperty("count");
      }
    });
  });

  describe("pipelineByStage", () => {
    it("requires authentication", async () => {
      const caller = appRouter.createCaller(createUnauthContext());
      await expect(caller.analytics.pipelineByStage({ accountId: 1, days: 30 })).rejects.toThrow();
    });

    it("returns array with stageName/dealCount/totalValue fields", async () => {
      const caller = appRouter.createCaller(createAuthContext());
      const result = await caller.analytics.pipelineByStage({ accountId: 1, days: 30 });
      expect(Array.isArray(result)).toBe(true);
      if (result.length > 0) {
        expect(result[0]).toHaveProperty("stageName");
        expect(result[0]).toHaveProperty("dealCount");
        expect(result[0]).toHaveProperty("totalValue");
      }
    });
  });

  describe("campaignPerformance", () => {
    it("requires authentication", async () => {
      const caller = appRouter.createCaller(createUnauthContext());
      await expect(caller.analytics.campaignPerformance({ accountId: 1, days: 30 })).rejects.toThrow();
    });

    it("returns array with campaign performance fields", async () => {
      const caller = appRouter.createCaller(createAuthContext());
      const result = await caller.analytics.campaignPerformance({ accountId: 1, days: 30 });
      expect(Array.isArray(result)).toBe(true);
      if (result.length > 0) {
        expect(result[0]).toHaveProperty("id");
        expect(result[0]).toHaveProperty("name");
        expect(result[0]).toHaveProperty("sentCount");
        expect(result[0]).toHaveProperty("deliveryRate");
        expect(result[0]).toHaveProperty("replyRate");
      }
    });
  });

  describe("appointmentsByStatus", () => {
    it("requires authentication", async () => {
      const caller = appRouter.createCaller(createUnauthContext());
      await expect(caller.analytics.appointmentsByStatus({ accountId: 1, days: 30 })).rejects.toThrow();
    });

    it("returns array with status/count fields", async () => {
      const caller = appRouter.createCaller(createAuthContext());
      const result = await caller.analytics.appointmentsByStatus({ accountId: 1, days: 30 });
      expect(Array.isArray(result)).toBe(true);
      if (result.length > 0) {
        expect(result[0]).toHaveProperty("status");
        expect(result[0]).toHaveProperty("count");
      }
    });
  });

  describe("input validation", () => {
    it("rejects days over 365", async () => {
      const caller = appRouter.createCaller(createAuthContext());
      await expect(caller.analytics.kpis({ accountId: 1, days: 999 })).rejects.toThrow();
    });

    it("rejects missing accountId", async () => {
      const caller = appRouter.createCaller(createAuthContext());
      await expect(caller.analytics.kpis({ days: 30 } as any)).rejects.toThrow();
    });
  });
});
