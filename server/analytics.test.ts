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

// ═══════════════════════════════════════════════════════════════
// Advanced Analytics Tests (Campaign ROI, Workflow Performance,
// Revenue Attribution, CSV Export)
// ═══════════════════════════════════════════════════════════════

function createAuthContextForAdvanced(): TrpcContext {
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

function createUnauthContextForAdvanced(): TrpcContext {
  return {
    user: null,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: () => {} } as unknown as TrpcContext["res"],
  };
}

describe("analytics - advanced reporting", () => {
  describe("campaignROI", () => {
    it("requires authentication", async () => {
      const caller = appRouter.createCaller(createUnauthContextForAdvanced());
      await expect(caller.analytics.campaignROI({ accountId: 1, days: 30 })).rejects.toThrow();
    });

    it("returns array with ROI fields", async () => {
      const caller = appRouter.createCaller(createAuthContextForAdvanced());
      const result = await caller.analytics.campaignROI({ accountId: 1, days: 30 });
      expect(Array.isArray(result)).toBe(true);
      if (result.length > 0) {
        expect(result[0]).toHaveProperty("id");
        expect(result[0]).toHaveProperty("name");
        expect(result[0]).toHaveProperty("type");
        expect(result[0]).toHaveProperty("totalRecipients");
        expect(result[0]).toHaveProperty("delivered");
        expect(result[0]).toHaveProperty("opened");
        expect(result[0]).toHaveProperty("clicked");
        expect(result[0]).toHaveProperty("contactsGenerated");
        expect(result[0]).toHaveProperty("conversionRate");
        expect(result[0]).toHaveProperty("totalRevenue");
      }
    });

    it("accepts different day ranges", async () => {
      const caller = appRouter.createCaller(createAuthContextForAdvanced());
      const result7 = await caller.analytics.campaignROI({ accountId: 1, days: 7 });
      const result90 = await caller.analytics.campaignROI({ accountId: 1, days: 90 });
      expect(Array.isArray(result7)).toBe(true);
      expect(Array.isArray(result90)).toBe(true);
    });
  });

  describe("workflowPerformance", () => {
    it("requires authentication", async () => {
      const caller = appRouter.createCaller(createUnauthContextForAdvanced());
      await expect(caller.analytics.workflowPerformance({ accountId: 1, days: 30 })).rejects.toThrow();
    });

    it("returns array with workflow performance fields", async () => {
      const caller = appRouter.createCaller(createAuthContextForAdvanced());
      const result = await caller.analytics.workflowPerformance({ accountId: 1, days: 30 });
      expect(Array.isArray(result)).toBe(true);
      if (result.length > 0) {
        expect(result[0]).toHaveProperty("id");
        expect(result[0]).toHaveProperty("name");
        expect(result[0]).toHaveProperty("triggerType");
        expect(result[0]).toHaveProperty("isActive");
        expect(result[0]).toHaveProperty("totalExecutions");
        expect(result[0]).toHaveProperty("completedExecutions");
        expect(result[0]).toHaveProperty("failedExecutions");
        expect(result[0]).toHaveProperty("runningExecutions");
        expect(result[0]).toHaveProperty("completionRate");
        expect(result[0]).toHaveProperty("avgDurationSeconds");
        expect(result[0]).toHaveProperty("stepBreakdown");
        expect(Array.isArray(result[0].stepBreakdown)).toBe(true);
      }
    });
  });

  describe("revenueAttribution", () => {
    it("requires authentication", async () => {
      const caller = appRouter.createCaller(createUnauthContextForAdvanced());
      await expect(caller.analytics.revenueAttribution({ accountId: 1, days: 30 })).rejects.toThrow();
    });

    it("returns object with summary and bySource", async () => {
      const caller = appRouter.createCaller(createAuthContextForAdvanced());
      const result = await caller.analytics.revenueAttribution({ accountId: 1, days: 30 });
      expect(result).toHaveProperty("summary");
      expect(result).toHaveProperty("bySource");
      expect(result.summary).toHaveProperty("totalRevenue");
      expect(result.summary).toHaveProperty("totalDealRevenue");
      expect(result.summary).toHaveProperty("totalInvoiceCollected");
      expect(result.summary).toHaveProperty("sourceCount");
      expect(typeof result.summary.totalRevenue).toBe("number");
      expect(typeof result.summary.sourceCount).toBe("number");
      expect(Array.isArray(result.bySource)).toBe(true);
    });

    it("bySource entries have correct structure", async () => {
      const caller = appRouter.createCaller(createAuthContextForAdvanced());
      const result = await caller.analytics.revenueAttribution({ accountId: 1, days: 30 });
      if (result.bySource.length > 0) {
        const entry = result.bySource[0];
        expect(entry).toHaveProperty("source");
        expect(entry).toHaveProperty("dealCount");
        expect(entry).toHaveProperty("dealRevenue");
        expect(entry).toHaveProperty("invoiceCount");
        expect(entry).toHaveProperty("invoiceCollected");
        expect(entry).toHaveProperty("totalRevenue");
      }
    });
  });

  describe("exportCSV", () => {
    it("requires authentication", async () => {
      const caller = appRouter.createCaller(createUnauthContextForAdvanced());
      await expect(
        caller.analytics.exportCSV({ accountId: 1, days: 30, reportType: "kpis" })
      ).rejects.toThrow();
    });

    it("returns csv and filename for kpis report", async () => {
      const caller = appRouter.createCaller(createAuthContextForAdvanced());
      const result = await caller.analytics.exportCSV({
        accountId: 1,
        days: 30,
        reportType: "kpis",
      });
      expect(result).toHaveProperty("csv");
      expect(result).toHaveProperty("filename");
      expect(typeof result.csv).toBe("string");
      expect(result.csv.length).toBeGreaterThan(0);
      expect(result.filename).toContain("kpis");
      expect(result.filename).toContain(".csv");
    });

    it("returns csv for campaignROI report", async () => {
      const caller = appRouter.createCaller(createAuthContextForAdvanced());
      const result = await caller.analytics.exportCSV({
        accountId: 1,
        days: 30,
        reportType: "campaignROI",
      });
      expect(typeof result.csv).toBe("string");
      expect(result.filename).toContain("campaignROI");
    });

    it("returns csv for workflowPerformance report", async () => {
      const caller = appRouter.createCaller(createAuthContextForAdvanced());
      const result = await caller.analytics.exportCSV({
        accountId: 1,
        days: 30,
        reportType: "workflowPerformance",
      });
      expect(typeof result.csv).toBe("string");
      expect(result.filename).toContain("workflowPerformance");
    });

    it("returns csv for revenueAttribution report", async () => {
      const caller = appRouter.createCaller(createAuthContextForAdvanced());
      const result = await caller.analytics.exportCSV({
        accountId: 1,
        days: 30,
        reportType: "revenueAttribution",
      });
      expect(typeof result.csv).toBe("string");
      expect(result.filename).toContain("revenueAttribution");
    });

    it("csv content includes header row", async () => {
      const caller = appRouter.createCaller(createAuthContextForAdvanced());
      const result = await caller.analytics.exportCSV({
        accountId: 1,
        days: 30,
        reportType: "kpis",
      });
      const lines = result.csv.trim().split("\n");
      expect(lines.length).toBeGreaterThanOrEqual(1);
      expect(lines[0]).toContain(",");
    });

    it("rejects invalid report type", async () => {
      const caller = appRouter.createCaller(createAuthContextForAdvanced());
      await expect(
        caller.analytics.exportCSV({
          accountId: 1,
          days: 30,
          reportType: "invalid" as any,
        })
      ).rejects.toThrow();
    });
  });
});

// ─── Helper function unit tests ───

describe("analytics - helper functions", () => {
  describe("calcChange (mirrored)", () => {
    function calcChangeFn(current: number, previous: number): number {
      if (previous === 0) return current > 0 ? 100 : 0;
      return Math.round(((current - previous) / previous) * 100);
    }

    it("returns 0 when both values are 0", () => {
      expect(calcChangeFn(0, 0)).toBe(0);
    });

    it("returns 100 when previous is 0 and current > 0", () => {
      expect(calcChangeFn(10, 0)).toBe(100);
    });

    it("returns positive percentage for growth", () => {
      expect(calcChangeFn(150, 100)).toBe(50);
    });

    it("returns negative percentage for decline", () => {
      expect(calcChangeFn(50, 100)).toBe(-50);
    });

    it("returns 0 when current equals previous", () => {
      expect(calcChangeFn(100, 100)).toBe(0);
    });

    it("rounds to nearest integer", () => {
      expect(calcChangeFn(133, 100)).toBe(33);
    });
  });

  describe("getPeriodDates (mirrored)", () => {
    function getPeriodDatesFn(days: number) {
      const now = new Date();
      const periodStart = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
      const prevPeriodStart = new Date(periodStart.getTime() - days * 24 * 60 * 60 * 1000);
      return { now, periodStart, prevPeriodStart };
    }

    it("returns three date objects", () => {
      const { now, periodStart, prevPeriodStart } = getPeriodDatesFn(30);
      expect(now).toBeInstanceOf(Date);
      expect(periodStart).toBeInstanceOf(Date);
      expect(prevPeriodStart).toBeInstanceOf(Date);
    });

    it("periodStart is N days before now", () => {
      const days = 30;
      const { now, periodStart } = getPeriodDatesFn(days);
      const diffDays = Math.round((now.getTime() - periodStart.getTime()) / (24 * 60 * 60 * 1000));
      expect(diffDays).toBe(days);
    });

    it("prevPeriodStart is 2*N days before now", () => {
      const days = 30;
      const { now, prevPeriodStart } = getPeriodDatesFn(days);
      const diffDays = Math.round((now.getTime() - prevPeriodStart.getTime()) / (24 * 60 * 60 * 1000));
      expect(diffDays).toBe(days * 2);
    });
  });
});
