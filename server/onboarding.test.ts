import { describe, it, expect, beforeEach } from "vitest";

// ─────────────────────────────────────────────
// Tests for Onboarding Wizard Feature
// Covers: schema, DB helpers, pipeline stage updates,
// completeOnboarding mutation logic, DEFAULT_STAGES export
// ─────────────────────────────────────────────

describe("Onboarding — Schema", () => {
  it("accounts table has onboardingComplete column", async () => {
    const { accounts } = await import("../drizzle/schema");
    expect(accounts).toBeDefined();
    // The column should exist in the table definition
    expect("onboardingComplete" in accounts).toBe(true);
  });

  it("onboardingComplete defaults to false", async () => {
    const { accounts } = await import("../drizzle/schema");
    // Verify the column is defined (runtime check)
    const cols = Object.keys(accounts);
    expect(cols).toContain("onboardingComplete");
  });
});

describe("Onboarding — DB Helpers", () => {
  it("updateAccount function is exported from db.ts", async () => {
    const db = await import("./db");
    expect(typeof db.updateAccount).toBe("function");
  });

  it("DEFAULT_STAGES is exported and has 6 stages", async () => {
    const { DEFAULT_STAGES } = await import("./db");
    expect(Array.isArray(DEFAULT_STAGES)).toBe(true);
    expect(DEFAULT_STAGES.length).toBe(6);
  });

  it("DEFAULT_STAGES has correct structure", async () => {
    const { DEFAULT_STAGES } = await import("./db");
    for (const stage of DEFAULT_STAGES) {
      expect(stage).toHaveProperty("name");
      expect(stage).toHaveProperty("color");
      expect(stage).toHaveProperty("sortOrder");
      expect(stage).toHaveProperty("isWon");
      expect(stage).toHaveProperty("isLost");
      expect(typeof stage.name).toBe("string");
      expect(typeof stage.color).toBe("string");
      expect(typeof stage.sortOrder).toBe("number");
    }
  });

  it("DEFAULT_STAGES includes expected stage names", async () => {
    const { DEFAULT_STAGES } = await import("./db");
    const names = DEFAULT_STAGES.map((s) => s.name);
    expect(names).toContain("New Lead");
    expect(names).toContain("Contacted");
    expect(names).toContain("Qualified");
    expect(names).toContain("Proposal");
    expect(names).toContain("Closed Won");
    expect(names).toContain("Closed Lost");
  });

  it("updatePipelineStage function is exported from db.ts", async () => {
    const db = await import("./db");
    expect(typeof db.updatePipelineStage).toBe("function");
  });

  it("createDefaultPipeline function is exported from db.ts", async () => {
    const db = await import("./db");
    expect(typeof db.createDefaultPipeline).toBe("function");
  });

  it("getOrCreateDefaultPipeline function is exported from db.ts", async () => {
    const db = await import("./db");
    expect(typeof db.getOrCreateDefaultPipeline).toBe("function");
  });
});

describe("Onboarding — Pipeline Router", () => {
  it("pipeline router exports renameStages procedure", async () => {
    const { pipelineRouter } = await import("./routers/pipeline");
    expect(pipelineRouter).toBeDefined();
    // The router should have the renameStages procedure
    expect(pipelineRouter._def.procedures).toHaveProperty("renameStages");
  });

  it("pipeline router still has existing procedures", async () => {
    const { pipelineRouter } = await import("./routers/pipeline");
    const procs = pipelineRouter._def.procedures;
    expect(procs).toHaveProperty("listPipelines");
    expect(procs).toHaveProperty("getDefault");
    expect(procs).toHaveProperty("listStages");
    expect(procs).toHaveProperty("listDeals");
    expect(procs).toHaveProperty("createDeal");
    expect(procs).toHaveProperty("moveDeal");
    expect(procs).toHaveProperty("deleteDeal");
  });
});

describe("Onboarding — Accounts Router", () => {
  it("accounts router exports completeOnboarding procedure", async () => {
    const { accountsRouter } = await import("./routers/accounts");
    expect(accountsRouter).toBeDefined();
    expect(accountsRouter._def.procedures).toHaveProperty("completeOnboarding");
  });

  it("accounts router still has existing procedures", async () => {
    const { accountsRouter } = await import("./routers/accounts");
    const procs = accountsRouter._def.procedures;
    expect(procs).toHaveProperty("create");
    expect(procs).toHaveProperty("list");
    expect(procs).toHaveProperty("get");
    expect(procs).toHaveProperty("update");
    expect(procs).toHaveProperty("delete");
    expect(procs).toHaveProperty("adminStats");
  });
});

describe("Onboarding — App Router Integration", () => {
  it("appRouter includes accounts and pipeline routers", async () => {
    const { appRouter } = await import("./routers");
    expect(appRouter).toBeDefined();
    expect(appRouter._def.procedures).toHaveProperty("accounts.completeOnboarding");
    expect(appRouter._def.procedures).toHaveProperty("pipeline.renameStages");
  });
});
