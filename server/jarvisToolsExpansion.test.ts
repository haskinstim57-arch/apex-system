/**
 * Vitest tests for the Jarvis AI Tools Expansion
 *
 * Tests verify:
 * 1. All new tool definitions exist in JARVIS_TOOLS
 * 2. CRITICAL_TOOLS set contains the right new tools
 * 3. TOOL_DISPLAY map has entries for all new tools
 * 4. System prompt includes new capability descriptions
 */
import { describe, expect, it } from "vitest";
import { JARVIS_TOOLS } from "./services/jarvisTools";

// ── Helper ──
function getToolNames(): string[] {
  return JARVIS_TOOLS.map((t) => t.function.name);
}

describe("Jarvis Tools Expansion — Tool Definitions", () => {
  const toolNames = getToolNames();

  // Part 1 — Content Creation Tools
  it("includes generate_social_post tool", () => {
    expect(toolNames).toContain("generate_social_post");
    const tool = JARVIS_TOOLS.find((t) => t.function.name === "generate_social_post");
    expect(tool).toBeDefined();
    const params = tool!.function.parameters as any;
    expect(params.required).toContain("platform");
    expect(params.required).toContain("topic");
    expect(params.required).toContain("tone");
  });

  it("includes schedule_social_post tool", () => {
    expect(toolNames).toContain("schedule_social_post");
    const tool = JARVIS_TOOLS.find((t) => t.function.name === "schedule_social_post");
    const params = tool!.function.parameters as any;
    expect(params.required).toContain("postId");
    expect(params.required).toContain("scheduledAt");
  });

  it("includes generate_blog_post tool", () => {
    expect(toolNames).toContain("generate_blog_post");
    const tool = JARVIS_TOOLS.find((t) => t.function.name === "generate_blog_post");
    const params = tool!.function.parameters as any;
    expect(params.required).toContain("topic");
  });

  it("includes generate_email_draft tool", () => {
    expect(toolNames).toContain("generate_email_draft");
    const tool = JARVIS_TOOLS.find((t) => t.function.name === "generate_email_draft");
    const params = tool!.function.parameters as any;
    expect(params.required).toContain("templateType");
    expect(params.required).toContain("tone");
    expect(params.required).toContain("topic");
  });

  it("includes send_email_draft tool", () => {
    expect(toolNames).toContain("send_email_draft");
    const tool = JARVIS_TOOLS.find((t) => t.function.name === "send_email_draft");
    const params = tool!.function.parameters as any;
    expect(params.required).toContain("draftId");
  });

  it("includes repurpose_blog_post tool", () => {
    expect(toolNames).toContain("repurpose_blog_post");
    const tool = JARVIS_TOOLS.find((t) => t.function.name === "repurpose_blog_post");
    const params = tool!.function.parameters as any;
    expect(params.required).toContain("contentId");
    expect(params.required).toContain("format");
  });

  // Part 2 — Campaign Tools
  it("includes create_campaign tool", () => {
    expect(toolNames).toContain("create_campaign");
    const tool = JARVIS_TOOLS.find((t) => t.function.name === "create_campaign");
    const params = tool!.function.parameters as any;
    expect(params.required).toContain("name");
    expect(params.required).toContain("type");
    expect(params.required).toContain("body");
  });

  it("includes send_campaign tool", () => {
    expect(toolNames).toContain("send_campaign");
    const tool = JARVIS_TOOLS.find((t) => t.function.name === "send_campaign");
    const params = tool!.function.parameters as any;
    expect(params.required).toContain("campaignId");
  });

  it("includes pause_campaign tool", () => {
    expect(toolNames).toContain("pause_campaign");
  });

  // Part 3 — Appointment Booking
  it("includes check_appointment_availability tool", () => {
    expect(toolNames).toContain("check_appointment_availability");
    const tool = JARVIS_TOOLS.find((t) => t.function.name === "check_appointment_availability");
    const params = tool!.function.parameters as any;
    expect(params.required).toContain("calendarId");
    expect(params.required).toContain("date");
  });

  it("includes book_appointment tool", () => {
    expect(toolNames).toContain("book_appointment");
    const tool = JARVIS_TOOLS.find((t) => t.function.name === "book_appointment");
    const params = tool!.function.parameters as any;
    expect(params.required).toContain("calendarId");
    expect(params.required).toContain("contactId");
    expect(params.required).toContain("startTime");
    expect(params.required).toContain("endTime");
  });

  // Part 4 — Pipeline (expanded)
  it("includes create_deal tool", () => {
    expect(toolNames).toContain("create_deal");
    const tool = JARVIS_TOOLS.find((t) => t.function.name === "create_deal");
    const params = tool!.function.parameters as any;
    expect(params.required).toContain("contactId");
    expect(params.required).toContain("title");
  });

  it("includes update_deal tool", () => {
    expect(toolNames).toContain("update_deal");
    const tool = JARVIS_TOOLS.find((t) => t.function.name === "update_deal");
    const params = tool!.function.parameters as any;
    expect(params.required).toContain("dealId");
  });

  // Part 5 — Inbox
  it("includes get_inbox_conversations tool", () => {
    expect(toolNames).toContain("get_inbox_conversations");
  });

  it("includes get_contact_conversation tool", () => {
    expect(toolNames).toContain("get_contact_conversation");
    const tool = JARVIS_TOOLS.find((t) => t.function.name === "get_contact_conversation");
    const params = tool!.function.parameters as any;
    expect(params.required).toContain("contactId");
  });

  // Part 6 — Custom Fields
  it("includes get_contact_custom_fields tool", () => {
    expect(toolNames).toContain("get_contact_custom_fields");
    const tool = JARVIS_TOOLS.find((t) => t.function.name === "get_contact_custom_fields");
    const params = tool!.function.parameters as any;
    expect(params.required).toContain("contactId");
  });

  it("includes update_contact_custom_field tool", () => {
    expect(toolNames).toContain("update_contact_custom_field");
    const tool = JARVIS_TOOLS.find((t) => t.function.name === "update_contact_custom_field");
    const params = tool!.function.parameters as any;
    expect(params.required).toContain("contactId");
    expect(params.required).toContain("fieldKey");
    expect(params.required).toContain("value");
  });

  // Part 7 — Lead Scoring
  it("includes get_contact_lead_score tool", () => {
    expect(toolNames).toContain("get_contact_lead_score");
    const tool = JARVIS_TOOLS.find((t) => t.function.name === "get_contact_lead_score");
    const params = tool!.function.parameters as any;
    expect(params.required).toContain("contactId");
  });

  // Part 8 — Voice Calls
  it("includes initiate_ai_voice_call tool", () => {
    expect(toolNames).toContain("initiate_ai_voice_call");
    const tool = JARVIS_TOOLS.find((t) => t.function.name === "initiate_ai_voice_call");
    const params = tool!.function.parameters as any;
    expect(params.required).toContain("contactId");
  });

  it("includes get_ai_call_history tool", () => {
    expect(toolNames).toContain("get_ai_call_history");
  });
});

describe("Jarvis Tools Expansion — All tools have valid schema", () => {
  it("every tool has type 'function' and a name", () => {
    for (const tool of JARVIS_TOOLS) {
      expect(tool.type).toBe("function");
      expect(tool.function.name).toBeTruthy();
      expect(tool.function.description).toBeTruthy();
      expect(tool.function.parameters).toBeDefined();
    }
  });

  it("no duplicate tool names", () => {
    const names = getToolNames();
    const unique = new Set(names);
    expect(unique.size).toBe(names.length);
  });

  it("total tool count is at least 40 (original ~20 + new ~20)", () => {
    expect(JARVIS_TOOLS.length).toBeGreaterThanOrEqual(40);
  });
});

describe("Jarvis Tools Expansion — CRITICAL_TOOLS and TOOL_DISPLAY", () => {
  // We can't import CRITICAL_TOOLS directly (it's a const in jarvisService),
  // but we can verify the file content programmatically
  it("jarvisService.ts contains all new critical tools", async () => {
    const fs = await import("fs");
    const content = fs.readFileSync("server/services/jarvisService.ts", "utf-8");

    const expectedCritical = [
      "send_email_draft",
      "create_campaign",
      "send_campaign",
      "pause_campaign",
      "book_appointment",
      "create_deal",
      "update_deal",
      "update_contact_custom_field",
      "initiate_ai_voice_call",
    ];

    for (const tool of expectedCritical) {
      expect(content).toContain(`"${tool}"`);
    }
  });

  it("jarvisService.ts TOOL_DISPLAY contains entries for all new tools", async () => {
    const fs = await import("fs");
    const content = fs.readFileSync("server/services/jarvisService.ts", "utf-8");

    const expectedDisplay = [
      "generate_social_post",
      "schedule_social_post",
      "generate_blog_post",
      "generate_email_draft",
      "send_email_draft",
      "repurpose_blog_post",
      "create_campaign",
      "send_campaign",
      "pause_campaign",
      "check_appointment_availability",
      "book_appointment",
      "create_deal",
      "update_deal",
      "get_inbox_conversations",
      "get_contact_conversation",
      "get_contact_custom_fields",
      "update_contact_custom_field",
      "get_contact_lead_score",
      "initiate_ai_voice_call",
      "get_ai_call_history",
    ];

    for (const tool of expectedDisplay) {
      expect(content).toContain(tool);
    }
  });

  it("system prompt includes new capability descriptions", async () => {
    const fs = await import("fs");
    const content = fs.readFileSync("server/services/jarvisService.ts", "utf-8");

    expect(content).toContain("Generate content: social media posts, blog articles, email drafts");
    expect(content).toContain("Repurpose blog posts into different formats");
    expect(content).toContain("Create, send, and pause campaigns");
    expect(content).toContain("check appointment availability, and book appointments");
    expect(content).toContain("Read and update custom fields on contacts");
    expect(content).toContain("Check lead scores with grade breakdown");
    expect(content).toContain("Initiate AI voice calls via VAPI");
    expect(content).toContain("View AI call history");
  });
});
