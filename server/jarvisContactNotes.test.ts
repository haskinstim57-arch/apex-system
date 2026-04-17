/**
 * Vitest tests for Jarvis reading contact notes via get_contact_detail
 *
 * Tests verify:
 * 1. get_contact_detail tool definition exists with correct schema
 * 2. executeJarvisTool returns notes array in get_contact_detail response
 * 3. System prompt includes notes & disposition awareness guidance
 */
import { describe, expect, it, vi } from "vitest";
import { JARVIS_TOOLS } from "./services/jarvisTools";

// ── Mock DB helpers ──
vi.mock("./db", async (importOriginal) => {
  const original = (await importOriginal()) as Record<string, unknown>;
  return {
    ...original,
    getContactById: vi.fn().mockResolvedValue({
      id: 42,
      accountId: 100,
      firstName: "John",
      lastName: "Doe",
      email: "john@example.com",
      phone: "+15551234567",
      status: "contacted",
      leadSource: "facebook",
      createdAt: new Date("2026-01-15"),
    }),
    getContactTags: vi.fn().mockResolvedValue([
      { tag: "VIP" },
      { tag: "Mortgage" },
    ]),
    listMessagesByContact: vi.fn().mockResolvedValue([
      {
        id: 1,
        type: "sms",
        direction: "outbound",
        subject: null,
        body: "Hi John, following up on your application.",
        status: "delivered",
        createdAt: new Date("2026-03-01"),
      },
    ]),
    getContactEnrollments: vi.fn().mockResolvedValue([]),
    listContactNotes: vi.fn().mockResolvedValue([
      {
        id: 10,
        contactId: 42,
        authorId: 1,
        content: "[Left Voicemail] Called at 2pm, went to voicemail",
        isPinned: false,
        createdAt: new Date("2026-03-20"),
        updatedAt: new Date("2026-03-20"),
        authorName: "Tim Haskins",
        authorEmail: "tim@example.com",
      },
      {
        id: 11,
        contactId: 42,
        authorId: 1,
        content: "Interested in 30-year fixed rate",
        isPinned: true,
        createdAt: new Date("2026-03-18"),
        updatedAt: new Date("2026-03-18"),
        authorName: "Tim Haskins",
        authorEmail: "tim@example.com",
      },
    ]),
    getMember: vi.fn().mockResolvedValue({
      userId: 1,
      accountId: 100,
      role: "owner",
      isActive: true,
    }),
  };
});

// Mock other services to prevent side effects
vi.mock("./services/messaging", () => ({
  dispatchSMS: vi.fn().mockResolvedValue({ success: true }),
  dispatchEmail: vi.fn().mockResolvedValue({ success: true }),
}));
vi.mock("./services/workflowEngine", () => ({
  triggerWorkflow: vi.fn().mockResolvedValue({ success: true }),
}));
vi.mock("./services/contentGenerator", () => ({
  generateSocialPost: vi.fn().mockResolvedValue({ content: "test post" }),
}));
vi.mock("../_core/llm", () => ({
  invokeLLM: vi.fn().mockResolvedValue({
    choices: [{ message: { content: "test" } }],
  }),
}));
vi.mock("./services/usageTracker", () => ({
  trackUsage: vi.fn().mockResolvedValue(undefined),
}));

describe("Jarvis — Contact Notes in get_contact_detail", () => {
  it("get_contact_detail tool definition exists in JARVIS_TOOLS", () => {
    const toolNames = JARVIS_TOOLS.map((t) => t.function.name);
    expect(toolNames).toContain("get_contact_detail");
  });

  it("get_contact_detail tool requires contactId parameter", () => {
    const tool = JARVIS_TOOLS.find(
      (t) => t.function.name === "get_contact_detail"
    );
    expect(tool).toBeDefined();
    const params = tool!.function.parameters as any;
    expect(params.required).toContain("contactId");
  });

  it("executeJarvisTool returns notes in get_contact_detail response", async () => {
    const { executeTool } = await import("./services/jarvisTools");
    const result = await executeTool(
      "get_contact_detail",
      { contactId: 42 },
      100, // accountId
      1 // userId
    );

    expect(result).toHaveProperty("notes");
    expect(Array.isArray(result.notes)).toBe(true);
    expect(result.notes).toHaveLength(2);

    // Check first note structure
    const note = result.notes[0];
    expect(note).toHaveProperty("id", 10);
    expect(note).toHaveProperty("body", "[Left Voicemail] Called at 2pm, went to voicemail");
    expect(note).toHaveProperty("disposition");
    expect(note).toHaveProperty("createdAt");
    expect(note).toHaveProperty("createdByUserId", 1);
    expect(note).toHaveProperty("authorName", "Tim Haskins");
  });

  it("notes include authorName for display", async () => {
    const { executeTool } = await import("./services/jarvisTools");
    const result = await executeTool(
      "get_contact_detail",
      { contactId: 42 },
      100,
      1
    );

    expect(result.notes[0].authorName).toBe("Tim Haskins");
    expect(result.notes[1].authorName).toBe("Tim Haskins");
  });

  it("system prompt includes notes & disposition awareness section", async () => {
    const { buildSystemPrompt } = await import("./services/jarvisService");
    const prompt = buildSystemPrompt({
      accountId: 100,
      userId: 1,
      userName: "Test User",
    });
    expect(prompt).toContain("NOTES & DISPOSITION AWARENESS");
    expect(prompt).toContain("get_contact_detail");
    expect(prompt).toContain("disposition");
    expect(prompt).toContain("voicemail_full");
    expect(prompt).toContain("re-engagement sequence");
  });
});
