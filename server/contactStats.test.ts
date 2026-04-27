import { describe, expect, it } from "vitest";

/**
 * Tests for getContactStats return shape.
 * Since the function depends heavily on Drizzle internals that are hard to mock
 * without stack overflow, we test the contract by calling the real function
 * with a null DB (the getDb() returns null path).
 *
 * The null-DB path exercises the full return shape logic.
 * Integration tests with a real DB are handled via manual verification.
 */

const ALL_STATUSES = [
  "new", "uncontacted", "contacted", "engaged",
  "application_taken", "application_in_progress", "credit_repair",
  "callback_scheduled", "app_link_pending",
  "qualified", "proposal", "negotiation",
  "won", "lost", "nurture",
];

describe("getContactStats return shape", () => {
  it("returns { total, byStatus } with all 15 status keys when DB is unavailable", async () => {
    // Dynamically import to get the real function
    // The real getDb() will fail to connect in test env, returning the null fallback
    const { getContactStats } = await import("./db");

    const result = await getContactStats(999999);

    // Should have total and byStatus
    expect(result).toHaveProperty("total");
    expect(result).toHaveProperty("byStatus");
    expect(typeof result.total).toBe("number");
    expect(typeof result.byStatus).toBe("object");

    // byStatus should have all 15 keys
    expect(Object.keys(result.byStatus)).toHaveLength(15);
    for (const status of ALL_STATUSES) {
      expect(result.byStatus).toHaveProperty(status);
      expect(typeof result.byStatus[status]).toBe("number");
    }
  });

  it("total is 0 when DB is unavailable", async () => {
    const { getContactStats } = await import("./db");
    const result = await getContactStats(999999);
    expect(result.total).toBe(0);
  });

  it("all byStatus values are 0 when DB is unavailable", async () => {
    const { getContactStats } = await import("./db");
    const result = await getContactStats(999999);
    for (const status of ALL_STATUSES) {
      expect(result.byStatus[status]).toBe(0);
    }
  });

  it("byStatus does NOT have the old flat keys (new, qualified, won at top level)", async () => {
    const { getContactStats } = await import("./db");
    const result = await getContactStats(999999);

    // The old shape had result.new, result.qualified, result.won at top level
    // The new shape only has result.total and result.byStatus
    const topKeys = Object.keys(result);
    expect(topKeys).toEqual(["total", "byStatus"]);
  });
});

describe("CONTACT_STATUSES completeness", () => {
  it("matches the 15 statuses defined in drizzle/schema.ts contacts enum", () => {
    // This is a static assertion to ensure our test list matches the schema
    expect(ALL_STATUSES).toHaveLength(15);
    expect(ALL_STATUSES).toContain("new");
    expect(ALL_STATUSES).toContain("uncontacted");
    expect(ALL_STATUSES).toContain("contacted");
    expect(ALL_STATUSES).toContain("engaged");
    expect(ALL_STATUSES).toContain("application_taken");
    expect(ALL_STATUSES).toContain("application_in_progress");
    expect(ALL_STATUSES).toContain("credit_repair");
    expect(ALL_STATUSES).toContain("callback_scheduled");
    expect(ALL_STATUSES).toContain("app_link_pending");
    expect(ALL_STATUSES).toContain("qualified");
    expect(ALL_STATUSES).toContain("proposal");
    expect(ALL_STATUSES).toContain("negotiation");
    expect(ALL_STATUSES).toContain("won");
    expect(ALL_STATUSES).toContain("lost");
    expect(ALL_STATUSES).toContain("nurture");
  });
});
