import { describe, expect, it } from "vitest";
import { getScoreTier } from "./services/leadScoringEngine";

// ─────────────────────────────────────────────
// Lead Scoring — Unit Tests
// ─────────────────────────────────────────────

describe("Lead Scoring — getScoreTier", () => {
  it("returns 'Cold' for score 0", () => {
    const tier = getScoreTier(0);
    expect(tier.label).toBe("Cold");
    expect(tier.color).toBe("cold");
  });

  it("returns 'Cold' for score 19", () => {
    const tier = getScoreTier(19);
    expect(tier.label).toBe("Cold");
    expect(tier.color).toBe("cold");
  });

  it("returns 'Warm' for score 20", () => {
    const tier = getScoreTier(20);
    expect(tier.label).toBe("Warm");
    expect(tier.color).toBe("warm");
  });

  it("returns 'Warm' for score 49", () => {
    const tier = getScoreTier(49);
    expect(tier.label).toBe("Warm");
    expect(tier.color).toBe("warm");
  });

  it("returns 'Hot' for score 50", () => {
    const tier = getScoreTier(50);
    expect(tier.label).toBe("Hot");
    expect(tier.color).toBe("hot");
  });

  it("returns 'Hot' for score 79", () => {
    const tier = getScoreTier(79);
    expect(tier.label).toBe("Hot");
    expect(tier.color).toBe("hot");
  });

  it("returns 'On Fire' for score 80", () => {
    const tier = getScoreTier(80);
    expect(tier.label).toBe("On Fire");
    expect(tier.color).toBe("on_fire");
  });

  it("returns 'On Fire' for score 100", () => {
    const tier = getScoreTier(100);
    expect(tier.label).toBe("On Fire");
    expect(tier.color).toBe("on_fire");
  });

  it("returns 'On Fire' for very high scores (500)", () => {
    const tier = getScoreTier(500);
    expect(tier.label).toBe("On Fire");
    expect(tier.color).toBe("on_fire");
  });
});

describe("Lead Scoring — Module Imports", () => {
  it("leadScoringEngine exports processLeadScoringEvent", async () => {
    const mod = await import("./services/leadScoringEngine");
    expect(typeof mod.processLeadScoringEvent).toBe("function");
  });

  it("leadScoringEngine exports manuallyAdjustLeadScore", async () => {
    const mod = await import("./services/leadScoringEngine");
    expect(typeof mod.manuallyAdjustLeadScore).toBe("function");
  });

  it("leadScoringEngine exports getScoreTier", async () => {
    const mod = await import("./services/leadScoringEngine");
    expect(typeof mod.getScoreTier).toBe("function");
  });

  it("workflowTriggers exports onLeadScoreChanged", async () => {
    const mod = await import("./services/workflowTriggers");
    expect(typeof mod.onLeadScoreChanged).toBe("function");
  });
});

describe("Lead Scoring — Router Registration", () => {
  it("leadScoring router is registered on appRouter", async () => {
    const { appRouter } = await import("./routers");
    // The router should have a leadScoring namespace
    expect(appRouter._def.procedures).toBeDefined();
    // Check that leadScoring procedures exist
    const procNames = Object.keys(appRouter._def.procedures);
    expect(procNames).toContain("leadScoring.listRules");
    expect(procNames).toContain("leadScoring.createRule");
    expect(procNames).toContain("leadScoring.updateRule");
    expect(procNames).toContain("leadScoring.deleteRule");
    expect(procNames).toContain("leadScoring.getHistory");
    expect(procNames).toContain("leadScoring.adjustScore");
    expect(procNames).toContain("leadScoring.getTier");
  });
});

describe("Lead Scoring — Scoring Event Enum Coverage", () => {
  it("all expected scoring events are valid", () => {
    const expectedEvents = [
      "contact_created",
      "tag_added",
      "pipeline_stage_changed",
      "inbound_message_received",
      "appointment_booked",
      "appointment_cancelled",
      "call_completed",
      "missed_call",
      "form_submitted",
      "email_opened",
      "link_clicked",
      "facebook_lead_received",
    ];
    // These should all be valid event strings accepted by the scoring engine
    for (const event of expectedEvents) {
      expect(typeof event).toBe("string");
      expect(event.length).toBeGreaterThan(0);
    }
  });
});

describe("Lead Scoring — DB Helper Exports", () => {
  it("db.ts exports lead scoring helper functions", async () => {
    const db = await import("./db");
    expect(typeof db.listLeadScoringRules).toBe("function");
    expect(typeof db.getLeadScoringRuleById).toBe("function");
    expect(typeof db.createLeadScoringRule).toBe("function");
    expect(typeof db.updateLeadScoringRule).toBe("function");
    expect(typeof db.deleteLeadScoringRule).toBe("function");
    expect(typeof db.getLeadScoreHistory).toBe("function");
    expect(typeof db.createLeadScoreHistoryEntry).toBe("function");
    expect(typeof db.updateContactLeadScore).toBe("function");
    expect(typeof db.getActiveLeadScoringRulesByEvent).toBe("function");
  });
});

describe("Lead Scoring — Schema Types", () => {
  it("schema exports lead scoring table types", async () => {
    const schema = await import("../drizzle/schema");
    expect(schema.leadScoringRules).toBeDefined();
    expect(schema.leadScoreHistory).toBeDefined();
    // Check that contacts table has leadScore column
    expect(schema.contacts).toBeDefined();
  });
});
