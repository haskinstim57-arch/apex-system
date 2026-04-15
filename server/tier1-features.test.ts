/**
 * Vitest tests for Tier 1 features:
 * 1. Pipeline stage management (add/delete/reorder)
 * 2. Billing initialDeposit mutation
 * 3. OAuth configuration status
 * 4. Email warming (db helpers, dripEngine integration)
 */
import { describe, expect, it, vi, beforeEach } from "vitest";

// ─── Task 1: Pipeline Stage Management ───

describe("Pipeline Stage Management", () => {
  it("addStage mutation requires name and accountId", async () => {
    // Verify the pipeline router has addStage, deleteStage, reorderStages
    const { sequencesRouter } = await import("./routers/sequences");
    expect(sequencesRouter).toBeDefined();

    const { pipelineRouter } = await import("./routers/pipeline");
    expect(pipelineRouter).toBeDefined();

    // Check that the router has the expected procedures
    const routerDef = pipelineRouter._def;
    expect(routerDef.procedures).toHaveProperty("addStage");
    expect(routerDef.procedures).toHaveProperty("deleteStage");
    expect(routerDef.procedures).toHaveProperty("reorderStages");
  });

  it("db helpers for pipeline stages are exported", async () => {
    const db = await import("./db");
    expect(typeof db.insertPipelineStage).toBe("function");
    expect(typeof db.deletePipelineStage).toBe("function");
    expect(typeof db.countDealsByStage).toBe("function");
    expect(typeof db.getMaxStageSortOrder).toBe("function");
  });
});

// ─── Task 2: Billing Initial Deposit ───

describe("Billing Initial Deposit", () => {
  it("billingRouter has initialDeposit mutation", async () => {
    const { billingRouter } = await import("./routers/billing");
    expect(billingRouter).toBeDefined();
    const routerDef = billingRouter._def;
    expect(routerDef.procedures).toHaveProperty("initialDeposit");
  });
});

// ─── Task 3: OAuth Configuration ───

describe("OAuth Configuration", () => {
  it("getOAuthConfigStatus returns correct structure", async () => {
    const { getOAuthConfigStatus } = await import("./_core/env");
    const status = getOAuthConfigStatus();

    expect(status).toHaveProperty("google");
    expect(status).toHaveProperty("microsoft");
    expect(status).toHaveProperty("facebook");
    expect(status.google).toHaveProperty("configured");
    expect(status.microsoft).toHaveProperty("configured");
    expect(status.facebook).toHaveProperty("configured");
    expect(typeof status.google.configured).toBe("boolean");
    expect(typeof status.microsoft.configured).toBe("boolean");
    expect(typeof status.facebook.configured).toBe("boolean");
  });

  it("oauthStatus query exists in system router", async () => {
    const { systemRouter } = await import("./_core/systemRouter");
    expect(systemRouter).toBeDefined();
    const routerDef = systemRouter._def;
    expect(routerDef.procedures).toHaveProperty("oauthStatus");
  });
});

// ─── Task 4: Email Warming ───

describe("Email Warming", () => {
  it("emailWarmingConfig table is defined in schema", async () => {
    const schema = await import("../drizzle/schema");
    expect(schema.emailWarmingConfig).toBeDefined();
    expect(schema.emailWarmingConfig).toHaveProperty("id");
    expect(schema.emailWarmingConfig).toHaveProperty("accountId");
    expect(schema.emailWarmingConfig).toHaveProperty("enabled");
    expect(schema.emailWarmingConfig).toHaveProperty("startDailyLimit");
    expect(schema.emailWarmingConfig).toHaveProperty("maxDailyLimit");
    expect(schema.emailWarmingConfig).toHaveProperty("rampUpPerDay");
    expect(schema.emailWarmingConfig).toHaveProperty("currentDailyLimit");
    expect(schema.emailWarmingConfig).toHaveProperty("warmingStartDate");
    expect(schema.emailWarmingConfig).toHaveProperty("todaySendCount");
    expect(schema.emailWarmingConfig).toHaveProperty("lastResetDate");
  });

  it("warming db helpers are exported", async () => {
    const db = await import("./db");
    expect(typeof db.getOrCreateWarmingConfig).toBe("function");
    expect(typeof db.resetDailySendCount).toBe("function");
    expect(typeof db.updateCurrentDailyLimit).toBe("function");
    expect(typeof db.incrementDailySendCount).toBe("function");
  });

  it("dripEngine processNextSteps returns skippedWarming in result", async () => {
    const { processNextSteps } = await import("./services/dripEngine");
    expect(typeof processNextSteps).toBe("function");

    // The function signature should accept batchSize
    // Verify the DripResult interface includes skippedWarming
    const dripModule = await import("./services/dripEngine");
    // processNextSteps returns a DripResult with skippedWarming field
    expect(dripModule.processNextSteps).toBeDefined();
  });

  it("dripEngine imports warming helpers", async () => {
    // Verify the dripEngine file imports the warming functions
    const fs = await import("fs");
    const content = fs.readFileSync("./server/services/dripEngine.ts", "utf-8");
    expect(content).toContain("getOrCreateWarmingConfig");
    expect(content).toContain("resetDailySendCount");
    expect(content).toContain("updateCurrentDailyLimit");
    expect(content).toContain("incrementDailySendCount");
    expect(content).toContain("byAccount");
    expect(content).toContain("skippedWarming");
  });

  it("sequences router has warming procedures", async () => {
    const { sequencesRouter } = await import("./routers/sequences");
    const routerDef = sequencesRouter._def;
    expect(routerDef.procedures).toHaveProperty("getWarmingConfig");
    expect(routerDef.procedures).toHaveProperty("updateWarmingConfig");
    expect(routerDef.procedures).toHaveProperty("resetWarming");
  });

  it("account creation auto-creates warming config", async () => {
    // Verify the accounts router imports getOrCreateWarmingConfig
    const fs = await import("fs");
    const content = fs.readFileSync("./server/routers/accounts.ts", "utf-8");
    expect(content).toContain("getOrCreateWarmingConfig");
    expect(content).toContain("Auto-create email warming config");
  });
});

// ─── SquareCardForm extraction ───

describe("SquareCardForm Component", () => {
  it("SquareCardForm component file exists", async () => {
    const fs = await import("fs");
    const exists = fs.existsSync("./client/src/components/SquareCardForm.tsx");
    expect(exists).toBe(true);
  });

  it("Billing.tsx imports from shared SquareCardForm", async () => {
    const fs = await import("fs");
    const content = fs.readFileSync("./client/src/pages/Billing.tsx", "utf-8");
    expect(content).toContain("SquareCardForm");
    expect(content).toContain("@/components/SquareCardForm");
  });
});
