/**
 * Jarvis Report Tools — Tests
 *
 * Covers:
 * 1. Tool definitions exist for all 4 report tools
 * 2. System prompt includes report instructions
 * 3. getDailyActivityDateWindow logic
 * 4. executeTool returns correct shapes for report tools
 * 5. email_report tool sends via SendGrid
 */
import { describe, expect, it, vi, beforeEach } from "vitest";
import { JARVIS_TOOLS } from "./services/jarvisTools";
import { buildSystemPrompt } from "./services/jarvisService";
import { getDailyActivityDateWindow } from "./services/reportEmailGenerator";

// ═══════════════════════════════════════════════
// 1. Tool Definitions
// ═══════════════════════════════════════════════

describe("Jarvis Report Tool Definitions", () => {
  const toolNames = JARVIS_TOOLS.map((t) => t.function.name);

  it("includes generate_daily_activity_report tool", () => {
    expect(toolNames).toContain("generate_daily_activity_report");
  });

  it("includes generate_pipeline_summary tool", () => {
    expect(toolNames).toContain("generate_pipeline_summary");
  });

  it("includes get_usage_report tool", () => {
    expect(toolNames).toContain("get_usage_report");
  });

  it("includes email_report tool", () => {
    expect(toolNames).toContain("email_report");
  });

  it("generate_daily_activity_report has optional date parameter", () => {
    const tool = JARVIS_TOOLS.find((t) => t.function.name === "generate_daily_activity_report");
    expect(tool).toBeDefined();
    const params = tool!.function.parameters as any;
    expect(params.properties.date).toBeDefined();
    expect(params.required).not.toContain("date");
  });

  it("generate_pipeline_summary requires startDate and endDate", () => {
    const tool = JARVIS_TOOLS.find((t) => t.function.name === "generate_pipeline_summary");
    expect(tool).toBeDefined();
    const params = tool!.function.parameters as any;
    expect(params.properties.startDate).toBeDefined();
    expect(params.properties.endDate).toBeDefined();
    expect(params.required).toContain("startDate");
    expect(params.required).toContain("endDate");
  });

  it("get_usage_report has period enum parameter", () => {
    const tool = JARVIS_TOOLS.find((t) => t.function.name === "get_usage_report");
    expect(tool).toBeDefined();
    const params = tool!.function.parameters as any;
    expect(params.properties.period.enum).toEqual(["today", "week", "month"]);
  });

  it("email_report requires reportHtml, recipientEmails, and subject", () => {
    const tool = JARVIS_TOOLS.find((t) => t.function.name === "email_report");
    expect(tool).toBeDefined();
    const params = tool!.function.parameters as any;
    expect(params.required).toContain("reportHtml");
    expect(params.required).toContain("recipientEmails");
    expect(params.required).toContain("subject");
    expect(params.properties.note).toBeDefined(); // optional note
  });
});

// ═══════════════════════════════════════════════
// 2. System Prompt
// ═══════════════════════════════════════════════

describe("Jarvis System Prompt — Report Instructions", () => {
  const prompt = buildSystemPrompt({
    accountId: 1,
    userId: 1,
    userName: "Test User",
  });

  it("mentions generate_daily_activity_report tool", () => {
    expect(prompt).toContain("generate_daily_activity_report");
  });

  it("mentions generate_pipeline_summary tool", () => {
    expect(prompt).toContain("generate_pipeline_summary");
  });

  it("mentions get_usage_report tool", () => {
    expect(prompt).toContain("get_usage_report");
  });

  it("mentions email_report tool", () => {
    expect(prompt).toContain("email_report");
  });

  it("instructs Jarvis to use tools rather than answering from memory", () => {
    expect(prompt).toContain("use the appropriate generate_* or get_usage_report tool rather than answering from memory");
  });

  it("instructs Jarvis to suggest scheduling or emailing after showing a report", () => {
    expect(prompt).toContain("Would you like this scheduled daily");
    expect(prompt).toContain("Want me to email this to someone");
  });

  it("mentions report content sections: hot leads, disposition trends, appointments, AI call outcomes, sequences", () => {
    expect(prompt).toContain("hot leads");
    expect(prompt).toContain("disposition trends");
    expect(prompt).toContain("appointments booked");
    expect(prompt).toContain("AI call outcomes");
    expect(prompt).toContain("sequence activity");
  });

  it("mentions pipeline report sections: velocity, at-risk", () => {
    expect(prompt).toContain("velocity metric");
    expect(prompt).toContain("at-risk high-value deals");
  });

  it("notes email_report is not billed to client", () => {
    expect(prompt).toContain("NOT billed to the client");
  });
});

// ═══════════════════════════════════════════════
// 3. getDailyActivityDateWindow Logic
// ═══════════════════════════════════════════════

describe("getDailyActivityDateWindow", () => {
  it("returns null for Saturday", () => {
    // April 19, 2026 is a Sunday — let's use a known Saturday
    const sat = new Date("2026-04-18T12:00:00");
    expect(getDailyActivityDateWindow(sat)).toBeNull();
  });

  it("returns null for Sunday", () => {
    const sun = new Date("2026-04-19T12:00:00");
    expect(getDailyActivityDateWindow(sun)).toBeNull();
  });

  it("returns previous day for Tuesday-Friday", () => {
    // April 21, 2026 is a Tuesday
    const tue = new Date("2026-04-21T12:00:00");
    const result = getDailyActivityDateWindow(tue);
    expect(result).not.toBeNull();
    // Should cover Monday April 20
    expect(result!.startDate.getDate()).toBe(20);
    expect(result!.endDate.getDate()).toBe(20);
  });

  it("returns Friday-Sunday for Monday", () => {
    // April 20, 2026 is a Monday
    const mon = new Date("2026-04-20T12:00:00");
    const result = getDailyActivityDateWindow(mon);
    expect(result).not.toBeNull();
    // Should cover Friday April 17 to Sunday April 19
    expect(result!.startDate.getDate()).toBe(17);
    expect(result!.endDate.getDate()).toBe(19);
  });
});

// ═══════════════════════════════════════════════
// 4. Tool Executor — Shape Validation
// ═══════════════════════════════════════════════

describe("Jarvis Report Tool Executor — Shape Validation", () => {
  // We can't easily test the full executor without a DB, but we can verify
  // the tool definitions have correct schemas and the executor has cases

  it("all 4 report tool names have corresponding case in executeTool", async () => {
    // Read the source to verify cases exist
    const fs = await import("fs");
    const source = fs.readFileSync("server/services/jarvisTools.ts", "utf-8");

    expect(source).toContain('case "generate_daily_activity_report"');
    expect(source).toContain('case "generate_pipeline_summary"');
    expect(source).toContain('case "get_usage_report"');
    expect(source).toContain('case "email_report"');
  });

  it("generate_daily_activity_report executor calls generateDailyActivityReport", async () => {
    const fs = await import("fs");
    const source = fs.readFileSync("server/services/jarvisTools.ts", "utf-8");

    // Find the case block and verify it calls the generator
    const caseStart = source.indexOf('case "generate_daily_activity_report"');
    const caseEnd = source.indexOf('case "generate_pipeline_summary"');
    const caseBlock = source.slice(caseStart, caseEnd);

    expect(caseBlock).toContain("generateDailyActivityReport");
    expect(caseBlock).toContain("reportType: \"daily_activity\"");
    expect(caseBlock).toContain("suggestFollowUp");
  });

  it("generate_pipeline_summary executor calls generatePipelineSummaryReport", async () => {
    const fs = await import("fs");
    const source = fs.readFileSync("server/services/jarvisTools.ts", "utf-8");

    const caseStart = source.indexOf('case "generate_pipeline_summary"');
    const caseEnd = source.indexOf('case "get_usage_report"');
    const caseBlock = source.slice(caseStart, caseEnd);

    expect(caseBlock).toContain("generatePipelineSummaryReport");
    expect(caseBlock).toContain("reportType: \"pipeline_summary\"");
    expect(caseBlock).toContain("suggestFollowUp");
  });

  it("get_usage_report executor queries usageEvents and accountBilling", async () => {
    const fs = await import("fs");
    const source = fs.readFileSync("server/services/jarvisTools.ts", "utf-8");

    const caseStart = source.indexOf('case "get_usage_report"');
    const caseEnd = source.indexOf('case "email_report"');
    const caseBlock = source.slice(caseStart, caseEnd);

    expect(caseBlock).toContain("usageEvents");
    expect(caseBlock).toContain("accountBilling");
    expect(caseBlock).toContain("reportType: \"usage\"");
    expect(caseBlock).toContain("currentBalance");
    expect(caseBlock).toContain("breakdown");
  });

  it("email_report executor calls sendEmail for each recipient", async () => {
    const fs = await import("fs");
    const source = fs.readFileSync("server/services/jarvisTools.ts", "utf-8");

    const caseStart = source.indexOf('case "email_report"');
    const caseEnd = source.indexOf("default:");
    const caseBlock = source.slice(caseStart, caseEnd);

    expect(caseBlock).toContain("sendEmail");
    expect(caseBlock).toContain("recipientEmails");
    expect(caseBlock).toContain("for (const email of recipientEmails)");
  });
});

// ═══════════════════════════════════════════════
// 5. Report Content Improvements — Verify Sections Exist
// ═══════════════════════════════════════════════

describe("Report Content Improvements — Section Verification", () => {
  it("daily activity report includes hot leads section", async () => {
    const fs = await import("fs");
    const source = fs.readFileSync("server/services/reportEmailGenerator.ts", "utf-8");
    expect(source).toContain("Hot Leads");
    expect(source).toContain("hotLeads");
  });

  it("daily activity report includes dispositions trend section", async () => {
    const fs = await import("fs");
    const source = fs.readFileSync("server/services/reportEmailGenerator.ts", "utf-8");
    expect(source).toContain("Dispositions Trend");
    expect(source).toContain("7-Day");
  });

  it("daily activity report includes appointments booked section", async () => {
    const fs = await import("fs");
    const source = fs.readFileSync("server/services/reportEmailGenerator.ts", "utf-8");
    expect(source).toContain("Appointments Booked");
  });

  it("daily activity report includes AI call outcomes section", async () => {
    const fs = await import("fs");
    const source = fs.readFileSync("server/services/reportEmailGenerator.ts", "utf-8");
    expect(source).toContain("AI Call Outcomes");
    expect(source).toContain("noAnswerRate");
  });

  it("daily activity report includes sequences section", async () => {
    const fs = await import("fs");
    const source = fs.readFileSync("server/services/reportEmailGenerator.ts", "utf-8");
    expect(source).toContain("Sequences Activity");
    expect(source).toContain("activatedCount");
  });

  it("pipeline summary report includes velocity section", async () => {
    const fs = await import("fs");
    const source = fs.readFileSync("server/services/pipelineSummaryReport.ts", "utf-8");
    expect(source).toContain("Pipeline Velocity");
    expect(source).toContain("avgDays");
  });

  it("pipeline summary report includes at-risk deals section", async () => {
    const fs = await import("fs");
    const source = fs.readFileSync("server/services/pipelineSummaryReport.ts", "utf-8");
    expect(source).toContain("At-Risk");
    expect(source).toContain("atRiskValueThreshold");
  });
});
