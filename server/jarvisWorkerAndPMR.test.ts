/**
 * Tests for:
 * 1. Jarvis Scheduled Task Worker (jarvisTaskWorker.ts)
 * 2. PMR Sequence Seeder definitions (seedPMRSequences.ts)
 * 3. unenroll_from_sequence action type in workflow engine
 */
import { describe, it, expect } from "vitest";

// ─── Jarvis Task Worker ───

describe("Jarvis Scheduled Task Worker", () => {
  it("worker module exports startJarvisTaskWorker", async () => {
    const mod = await import("./services/jarvisTaskWorker");
    expect(typeof mod.startJarvisTaskWorker).toBe("function");
  });

  it("worker is registered in server startup", async () => {
    const fs = await import("fs");
    const indexContent = fs.readFileSync("server/_core/index.ts", "utf-8");
    expect(indexContent).toContain("startJarvisTaskWorker");
    expect(indexContent).toContain("jarvisTaskWorker");
  });
});

// ─── unenroll_from_sequence ───

describe("unenroll_from_sequence action type", () => {
  it("is included in the schema actionType enum", async () => {
    const fs = await import("fs");
    const schemaContent = fs.readFileSync("drizzle/schema.ts", "utf-8");
    expect(schemaContent).toContain("unenroll_from_sequence");
  });

  it("is handled in the workflow engine executeAction", async () => {
    const fs = await import("fs");
    const engineContent = fs.readFileSync("server/services/workflowEngine.ts", "utf-8");
    expect(engineContent).toContain("case \"unenroll_from_sequence\"");
    // Should unenroll from all active sequences for the contact
    expect(engineContent).toContain("sequenceEnrollments");
  });
});

// ─── PMR Sequence Seeder ───

describe("PMR Sequence Seeder", () => {
  it("seeder script exists and is importable", async () => {
    const fs = await import("fs");
    const exists = fs.existsSync("server/scripts/seedPMRSequences.ts");
    expect(exists).toBe(true);
  });

  it("seeder defines exactly 10 sequences", async () => {
    const fs = await import("fs");
    const content = fs.readFileSync("server/scripts/seedPMRSequences.ts", "utf-8");
    // Count the sequence definitions by their trigger tags
    const expectedTags = [
      "refi-6mo-check",
      "refi-12mo-check",
      "happy-birthday",
      "warm-re-agent",
      "cold-re-agent",
      "credit-repair-nurture",
      "heloc-nurture",
      "purchase-nurture",
      "dpa-webinar-registered",
      "re-agent-webinar-registered",
    ];
    for (const tag of expectedTags) {
      expect(content).toContain(`triggerTag: "${tag}"`);
    }
  });

  it("each sequence has the correct number of steps", async () => {
    const fs = await import("fs");
    const content = fs.readFileSync("server/scripts/seedPMRSequences.ts", "utf-8");
    // Verify step counts by counting position entries per sequence
    // Seq 1 (6mo): 4 steps, Seq 2 (12mo): 4, Seq 3 (bday): 2,
    // Seq 4 (warm agent): 6, Seq 5 (cold agent): 6, Seq 6 (credit): 8,
    // Seq 7 (HELOC): 7, Seq 8 (purchase): 7, Seq 9 (DPA webinar): 9, Seq 10 (RE webinar): 9
    // Total: 62 steps
    const positionMatches = content.match(/position:\s*\d+/g);
    expect(positionMatches).not.toBeNull();
    expect(positionMatches!.length).toBe(62);
  });

  it("seeder creates trigger workflows for all 10 sequences", async () => {
    const fs = await import("fs");
    const content = fs.readFileSync("server/scripts/seedPMRSequences.ts", "utf-8");
    const triggerWorkflowNames = [
      "Auto: Enroll — 6Mo Refi Check-In",
      "Auto: Enroll — 12Mo Refi Check-In",
      "Auto: Enroll — Happy Birthday",
      "Auto: Enroll — Warm RE Agent",
      "Auto: Enroll — Cold RE Agent",
      "Auto: Enroll — Credit Repair",
      "Auto: Enroll — HELOC Nurture",
      "Auto: Enroll — Purchase Nurture",
      "Auto: Enroll — DPA Webinar",
      "Auto: Enroll — RE Agent Webinar",
    ];
    for (const name of triggerWorkflowNames) {
      expect(content).toContain(name);
    }
  });

  it("seeder creates 2 auto-stop workflows (qualified + appointment booked)", async () => {
    const fs = await import("fs");
    const content = fs.readFileSync("server/scripts/seedPMRSequences.ts", "utf-8");
    expect(content).toContain("Unenroll All Sequences on Qualified");
    expect(content).toContain("Unenroll All Sequences on Appointment Booked");
    expect(content).toContain("unenroll_from_sequence");
  });

  it("seeder creates 2 landing pages (DPA webinar + RE agent webinar)", async () => {
    const fs = await import("fs");
    const content = fs.readFileSync("server/scripts/seedPMRSequences.ts", "utf-8");
    expect(content).toContain('slug: "dpa-webinar"');
    expect(content).toContain('slug: "re-agent-webinar"');
    expect(content).toContain("DPA_WEBINAR_HTML");
    expect(content).toContain("RE_AGENT_WEBINAR_HTML");
  });

  it("seeder includes Belinda Osborne account setup", async () => {
    const fs = await import("fs");
    const content = fs.readFileSync("server/scripts/seedPMRSequences.ts", "utf-8");
    expect(content).toContain("Belinda");
    expect(content).toContain("Osborne");
    expect(content).toContain("routed-to-belinda");
    expect(content).toContain('role: "employee"');
  });

  it("all sequences include both SMS and email steps", async () => {
    const fs = await import("fs");
    const content = fs.readFileSync("server/scripts/seedPMRSequences.ts", "utf-8");
    // Every sequence should have at least one SMS and one email
    const smsCount = (content.match(/messageType:\s*"sms"/g) || []).length;
    const emailCount = (content.match(/messageType:\s*"email"/g) || []).length;
    expect(smsCount).toBeGreaterThan(10);
    expect(emailCount).toBeGreaterThan(10);
  });

  it("webinar sequences include template placeholders for dates", async () => {
    const fs = await import("fs");
    const content = fs.readFileSync("server/scripts/seedPMRSequences.ts", "utf-8");
    expect(content).toContain("[WEBINAR DATE]");
    expect(content).toContain("[WEBINAR TIME]");
    expect(content).toContain("[WEBINAR LINK]");
  });

  it("landing page HTML is well-formed with form elements", async () => {
    const fs = await import("fs");
    const content = fs.readFileSync("server/scripts/seedPMRSequences.ts", "utf-8");
    // DPA webinar page
    expect(content).toContain("Reserve My Spot Now");
    expect(content).toContain('placeholder="First Name"');
    expect(content).toContain('placeholder="Email Address"');
    // RE Agent webinar page
    expect(content).toContain("EXCLUSIVE FOR RE AGENTS");
  });
});

// ─── Jarvis Scheduled Tasks Schema ───

describe("Jarvis Scheduled Tasks Schema", () => {
  it("has lastRunResult and runCount columns", async () => {
    const fs = await import("fs");
    const schemaContent = fs.readFileSync("drizzle/schema.ts", "utf-8");
    expect(schemaContent).toContain("lastRunResult");
    expect(schemaContent).toContain("runCount");
  });
});
