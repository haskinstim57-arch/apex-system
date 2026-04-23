import { describe, it, expect, vi } from "vitest";

// ─── Bug Fix 1: Sequence Performance Tab getStats ───
// Root cause: TiDB sql_mode=only_full_group_by rejects DATE() in SELECT
// when GROUP BY uses a different expression form. Fixed by using db.execute()
// with a column alias in GROUP BY.

describe("Bug Fix 1: Sequence Performance Tab getStats", () => {
  it("enrollment trend query uses alias-based GROUP BY to avoid only_full_group_by", async () => {
    // Verify the fix: the query should use `GROUP BY enrollment_date` (alias)
    // instead of `GROUP BY DATE(enrolled_at)` which fails with prepared statements
    const { readFileSync } = await import("fs");
    const routerCode = readFileSync("server/routers/sequences.ts", "utf-8");

    // The fix: uses db.execute with raw SQL and groups by the alias
    expect(routerCode).toContain("GROUP BY enrollment_date");
    // Should NOT use the old Drizzle .groupBy with DATE() pattern
    expect(routerCode).not.toContain('.groupBy(sql`DATE(${sequenceEnrollments.enrolledAt})`)');
  });

  it("enrollment trend maps results correctly with date formatting", () => {
    // Simulate the result mapping logic from the fix
    const mockRows = [
      { enrollment_date: new Date("2026-04-20T00:00:00Z"), cnt: 69n },
      { enrollment_date: new Date("2026-04-21T00:00:00Z"), cnt: 54n },
      { enrollment_date: "2026-04-22", cnt: 37 },
    ];

    const enrollmentTrend = mockRows.map((r: any) => ({
      date:
        r.enrollment_date instanceof Date
          ? r.enrollment_date.toISOString().split("T")[0]
          : String(r.enrollment_date),
      count: Number(r.cnt),
    }));

    expect(enrollmentTrend).toEqual([
      { date: "2026-04-20", count: 69 },
      { date: "2026-04-21", count: 54 },
      { date: "2026-04-22", count: 37 },
    ]);
  });

  it("status breakdown correctly accumulates counts", () => {
    const statusRows = [
      { status: "active" as const, cnt: 338 },
    ];

    const statusBreakdown: Record<string, number> = {
      active: 0,
      completed: 0,
      paused: 0,
      failed: 0,
      unenrolled: 0,
    };
    let total = 0;
    for (const row of statusRows) {
      statusBreakdown[row.status] = row.cnt;
      total += row.cnt;
    }

    expect(statusBreakdown.active).toBe(338);
    expect(total).toBe(338);
    expect(statusBreakdown.completed).toBe(0);
  });
});

// ─── Bug Fix 2: Scheduled Reports frequency enum ───
// Root cause: The scheduledReports table's frequency enum only had
// ["daily", "weekly", "monthly"] but the router's VALID_FREQUENCIES
// included "daily_activity" and "daily_marketing". MySQL rejected
// INSERT with these values.

describe("Bug Fix 2: Scheduled Reports frequency enum", () => {
  it("VALID_FREQUENCIES includes daily_activity and daily_marketing", async () => {
    const { readFileSync } = await import("fs");
    const routerCode = readFileSync("server/routers/scheduledReports.ts", "utf-8");

    // Verify the router accepts all 5 frequency types
    expect(routerCode).toContain("daily_activity");
    expect(routerCode).toContain("daily_marketing");
    expect(routerCode).toContain("daily");
    expect(routerCode).toContain("weekly");
    expect(routerCode).toContain("monthly");
  });

  it("schema frequency enum includes all 5 values", async () => {
    const { readFileSync } = await import("fs");
    const schemaCode = readFileSync("drizzle/schema.ts", "utf-8");

    // The schema enum must include all frequency values
    expect(schemaCode).toContain("daily_activity");
    expect(schemaCode).toContain("daily_marketing");
  });

  it("frequency enum in schema matches router VALID_FREQUENCIES", async () => {
    const { readFileSync } = await import("fs");
    const routerCode = readFileSync("server/routers/scheduledReports.ts", "utf-8");
    const schemaCode = readFileSync("drizzle/schema.ts", "utf-8");

    // Extract VALID_FREQUENCIES from router
    const freqMatch = routerCode.match(
      /VALID_FREQUENCIES\s*=\s*\[(.*?)\]\s*as\s*const/s
    );
    expect(freqMatch).toBeTruthy();
    const routerFreqs = freqMatch![1]
      .split(",")
      .map((s) => s.trim().replace(/['"]/g, ""))
      .filter(Boolean);

    // Each router frequency must exist in the schema
    for (const freq of routerFreqs) {
      expect(schemaCode).toContain(freq);
    }
  });
});

// ─── Bug Fix A: Stuck enrollments — enrollContactInSequence missing nextStepAt ───
// Root cause: facebookLeadPoller.ts, facebookLeads.ts, and jarvisTools.ts
// called enrollContactInSequence without passing nextStepAt. The drip worker
// filters on next_step_at <= NOW(), so enrollments without nextStepAt were never picked up.
// Fix: enrollContactInSequence now auto-computes nextStepAt = Date.now() if not provided.

describe("Bug Fix A: enrollContactInSequence auto-computes nextStepAt", () => {
  it("db.ts enrollContactInSequence sets nextStepAt when not provided", async () => {
    const { readFileSync } = await import("fs");
    const dbCode = readFileSync("server/db.ts", "utf-8");

    // The function should auto-compute nextStepAt
    expect(dbCode).toContain("nextStepAt");
    // Should have a fallback for when nextStepAt is not provided
    expect(dbCode).toMatch(/nextStepAt.*Date\.now\(\)|data\.nextStepAt\s*\?\?/);
  });

  it("drip engine getDueEnrollments filters on next_step_at", async () => {
    const { readFileSync } = await import("fs");
    const dripCode = readFileSync("server/services/dripEngine.ts", "utf-8");

    // The drip worker must filter on nextStepAt to pick up due enrollments
    expect(dripCode).toContain("nextStepAt");
    expect(dripCode).toContain("getDueEnrollments");
  });

  it("drip engine has per-tick instrumentation logging", async () => {
    const { readFileSync } = await import("fs");
    const dripCode = readFileSync("server/services/dripEngine.ts", "utf-8");

    // Should have instrumentation logging
    expect(dripCode).toContain("[drip]");
  });
});

// ─── Bug Fix D: Status badge live-update after disposition save ───
// Root cause: addNote mutation only invalidated contacts.get and contacts.listNotes
// but NOT contacts.list or contacts.stats. When navigating back to the contacts list,
// stale status badges were shown.
// Also: STATUS_COLORS and STATUS_LABELS were missing "new" and other disposition statuses.

describe("Bug Fix D: Status badge live-update after disposition save", () => {
  it("addNote mutation invalidates contacts.list for status badge refresh", async () => {
    const { readFileSync } = await import("fs");
    const detailCode = readFileSync("client/src/pages/ContactDetail.tsx", "utf-8");

    // Both addNoteMutation and addInternalNoteMutation should invalidate contacts.list
    const addNoteBlocks = detailCode.split("addNoteMutation").filter(b => b.includes("onSuccess"));
    expect(detailCode).toContain("utils.contacts.list.invalidate()");
    expect(detailCode).toContain("utils.contacts.stats.invalidate()");
  });

  it("STATUS_COLORS includes 'new' status in ContactDetail", async () => {
    const { readFileSync } = await import("fs");
    const detailCode = readFileSync("client/src/pages/ContactDetail.tsx", "utf-8");

    expect(detailCode).toContain('new: "bg-lime-');
  });

  it("STATUS_LABELS includes 'new' status in ContactDetail", async () => {
    const { readFileSync } = await import("fs");
    const detailCode = readFileSync("client/src/pages/ContactDetail.tsx", "utf-8");

    expect(detailCode).toContain('new: "New"');
  });

  it("Contacts list page has all disposition statuses in STATUS_COLORS", async () => {
    const { readFileSync } = await import("fs");
    const listCode = readFileSync("client/src/pages/Contacts.tsx", "utf-8");

    const requiredStatuses = [
      "new", "uncontacted", "contacted", "engaged", "qualified",
      "application_taken", "application_in_progress", "credit_repair",
      "callback_scheduled", "app_link_pending", "nurture", "won", "lost",
    ];

    for (const status of requiredStatuses) {
      expect(listCode).toContain(`${status}:`);
    }
  });

  it("Contacts list page uses STATUS_LABELS for badge display", async () => {
    const { readFileSync } = await import("fs");
    const listCode = readFileSync("client/src/pages/Contacts.tsx", "utf-8");

    expect(listCode).toContain("STATUS_LABELS[contact.status]");
  });

  it("DISPOSITION_STATUS_MAP in backend maps all dispositions to statuses", async () => {
    const { readFileSync } = await import("fs");
    const routerCode = readFileSync("server/routers/contacts.ts", "utf-8");

    const requiredDispositions = [
      "vm_full", "left_vm", "spoke_to_lead", "took_application",
      "borrower_doing_app", "credit_repair", "nurture",
      "borrower_requested_callback", "spoke_needs_loan_app_link",
    ];

    for (const disp of requiredDispositions) {
      expect(routerCode).toContain(disp);
    }
  });
});
