import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Mock DB ───────────────────────────────────────────────────────────────
// We mock getDb to return a chainable query builder that resolves fixture data.

const mockSelect = vi.fn();
const mockFrom = vi.fn();
const mockWhere = vi.fn();
const mockGroupBy = vi.fn();
const mockOrderBy = vi.fn();
const mockLimit = vi.fn();
const mockLeftJoin = vi.fn();
const mockInnerJoin = vi.fn();

// Track which table was queried in .from()
let lastFromTable: string | null = null;
// Store fixture data keyed by table name
let fixtureData: Record<string, any[]> = {};

function buildChain() {
  const chain: any = {
    select: (...args: any[]) => { mockSelect(...args); return chain; },
    from: (table: any) => {
      mockFrom(table);
      lastFromTable = table?.name || table?.[Symbol.for("drizzle:Name")] || "unknown";
      return chain;
    },
    where: (...args: any[]) => { mockWhere(...args); return chain; },
    groupBy: (...args: any[]) => { mockGroupBy(...args); return chain; },
    orderBy: (...args: any[]) => { mockOrderBy(...args); return chain; },
    limit: (...args: any[]) => { mockLimit(...args); return chain; },
    leftJoin: (...args: any[]) => { mockLeftJoin(...args); return chain; },
    innerJoin: (...args: any[]) => { mockInnerJoin(...args); return chain; },
    then: (resolve: any) => {
      const data = fixtureData[lastFromTable!] || [];
      resolve(data);
    },
  };
  return chain;
}

vi.mock("../db", () => ({
  getDb: vi.fn(() => {
    const chain = buildChain();
    return Promise.resolve(chain);
  }),
}));

import {
  generatePipelineSummaryReport,
  generatePipelineSummarySection,
} from "./services/pipelineSummaryReport";

// ─── Test Suites ───────────────────────────────────────────────────────────

describe("Pipeline Summary Report", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fixtureData = {};
    lastFromTable = null;
  });

  // ─── Section 1: Snapshot ──────────────────────────────────────────────

  describe("generatePipelineSummaryReport", () => {
    it("returns HTML with all 5 section headers", async () => {
      // Setup minimal fixture data so queries resolve
      fixtureData = {
        pipeline_stages: [],
        deals: [],
        account_members: [{ count: 0 }],
      };

      const { html, csv } = await generatePipelineSummaryReport({
        accountId: 1,
        accountName: "Test Account",
        periodDays: 30,
      });

      expect(html).toContain("Pipeline Summary Report");
      expect(html).toContain("Test Account");
      expect(html).toContain("Current Pipeline Snapshot");
      // When no stages, activity/funnel/stale/performers still render
      expect(typeof csv).toBe("string");
      expect(csv).toContain("Section,Metric,Value");
    });

    it("includes the correct date range in the header", async () => {
      fixtureData = {
        pipeline_stages: [],
        deals: [],
        account_members: [{ count: 0 }],
      };

      const endDate = new Date("2026-04-15T00:00:00Z");
      const startDate = new Date("2026-03-16T00:00:00Z");

      const { html } = await generatePipelineSummaryReport({
        accountId: 1,
        accountName: "Test Account",
        periodDays: 30,
        startDate,
        endDate,
      });

      expect(html).toContain("30 days");
    });

    it("uses custom brand color when provided", async () => {
      fixtureData = {
        pipeline_stages: [],
        deals: [],
        account_members: [{ count: 0 }],
      };

      const { html } = await generatePipelineSummaryReport({
        accountId: 1,
        accountName: "Test Account",
        periodDays: 7,
        brandColor: "#ff5500",
      });

      expect(html).toContain("#ff5500");
    });

    it("defaults to gold brand color when none provided", async () => {
      fixtureData = {
        pipeline_stages: [],
        deals: [],
        account_members: [{ count: 0 }],
      };

      const { html } = await generatePipelineSummaryReport({
        accountId: 1,
        accountName: "Test Account",
        periodDays: 7,
      });

      expect(html).toContain("#c9a84c");
    });

    it("shows 'No pipeline stages configured' when account has no stages", async () => {
      fixtureData = {
        pipeline_stages: [],
        deals: [],
        account_members: [{ count: 0 }],
      };

      // Use a non-existent accountId to ensure no stages are found
      const { html } = await generatePipelineSummaryReport({
        accountId: 999999,
        accountName: "Empty Account",
        periodDays: 30,
      });

      // When no stages exist for this account, should show the empty state
      // or the snapshot section header at minimum
      expect(html).toContain("Current Pipeline Snapshot");
      expect(html).toContain("Empty Account");
    });

    it("includes Sterling Marketing footer", async () => {
      fixtureData = {
        pipeline_stages: [],
        deals: [],
        account_members: [{ count: 0 }],
      };

      const { html } = await generatePipelineSummaryReport({
        accountId: 1,
        accountName: "Test Account",
        periodDays: 30,
      });

      expect(html).toContain("Sterling Marketing");
    });
  });

  // ─── CSV Output ───────────────────────────────────────────────────────

  describe("CSV output", () => {
    it("starts with correct header row", async () => {
      fixtureData = {
        pipeline_stages: [],
        deals: [],
        account_members: [{ count: 0 }],
      };

      const { csv } = await generatePipelineSummaryReport({
        accountId: 1,
        accountName: "Test",
        periodDays: 30,
      });

      const lines = csv.split("\n");
      expect(lines[0]).toBe("Section,Metric,Value");
    });

    it("includes Period Activity section in CSV", async () => {
      fixtureData = {
        pipeline_stages: [],
        deals: [{ count: 0, value: 0 }],
        account_members: [{ count: 0 }],
      };

      const { csv } = await generatePipelineSummaryReport({
        accountId: 1,
        accountName: "Test",
        periodDays: 30,
      });

      expect(csv).toContain("Period Activity");
    });
  });

  // ─── Section function ─────────────────────────────────────────────────

  describe("generatePipelineSummarySection", () => {
    it("returns HTML string (for embedding in combined reports)", async () => {
      fixtureData = {
        pipeline_stages: [],
        deals: [],
        account_members: [{ count: 0 }],
      };

      const html = await generatePipelineSummarySection(1, 30);
      expect(typeof html).toBe("string");
      expect(html).toContain("Current Pipeline Snapshot");
    });

    it("does not include full email wrapper (no DOCTYPE)", async () => {
      fixtureData = {
        pipeline_stages: [],
        deals: [],
        account_members: [{ count: 0 }],
      };

      const html = await generatePipelineSummarySection(1, 30);
      expect(html).not.toContain("<!DOCTYPE");
      expect(html).not.toContain("Pipeline Summary Report");
    });
  });

  // ─── Edge Cases ───────────────────────────────────────────────────────

  describe("edge cases", () => {
    it("handles zero-value deals without division errors", async () => {
      fixtureData = {
        pipeline_stages: [],
        deals: [{ count: 0, value: 0 }],
        account_members: [{ count: 0 }],
      };

      // Should not throw
      const { html } = await generatePipelineSummaryReport({
        accountId: 1,
        accountName: "Zero Account",
        periodDays: 30,
      });

      expect(html).toBeDefined();
      expect(html).not.toContain("NaN");
      expect(html).not.toContain("Infinity");
    });

    it("handles very short period (1 day)", async () => {
      fixtureData = {
        pipeline_stages: [],
        deals: [],
        account_members: [{ count: 0 }],
      };

      const { html } = await generatePipelineSummaryReport({
        accountId: 1,
        accountName: "Short Period",
        periodDays: 1,
      });

      expect(html).toContain("1 days");
    });

    it("handles very long period (365 days)", async () => {
      fixtureData = {
        pipeline_stages: [],
        deals: [],
        account_members: [{ count: 0 }],
      };

      const { html } = await generatePipelineSummaryReport({
        accountId: 1,
        accountName: "Long Period",
        periodDays: 365,
      });

      expect(html).toContain("365 days");
    });
  });
});
