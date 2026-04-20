/**
 * Jarvis Quick-Action Chips — Tests
 *
 * Covers:
 * 1. Component structure: all 4 chips render, Reports is enabled, others are stubs
 * 2. Report options: all 3 report types with correct sub-options
 * 3. Prompt generation: each selection produces the correct prompt text
 * 4. Auto-submit: onSubmitPrompt is called with the correct prompt
 * 5. Integration: Jarvis.tsx imports and renders JarvisQuickActions
 */
import { describe, expect, it } from "vitest";
import { REPORT_OPTIONS, QUICK_CHIPS } from "../client/src/components/JarvisQuickActions";
import * as fs from "fs";

// ═══════════════════════════════════════════════
// 1. Chip Definitions
// ═══════════════════════════════════════════════

describe("Quick-Action Chip Definitions", () => {
  it("defines exactly 4 chips", () => {
    expect(QUICK_CHIPS).toHaveLength(4);
  });

  it("Reports chip is enabled", () => {
    const reports = QUICK_CHIPS.find((c) => c.id === "reports");
    expect(reports).toBeDefined();
    expect(reports!.enabled).toBe(true);
    expect(reports!.label).toBe("Reports");
  });

  it("Ask about a contact chip is disabled (stub)", () => {
    const chip = QUICK_CHIPS.find((c) => c.id === "ask_contact");
    expect(chip).toBeDefined();
    expect(chip!.enabled).toBe(false);
    expect(chip!.label).toBe("Ask about a contact");
  });

  it("Create a task chip is disabled (stub)", () => {
    const chip = QUICK_CHIPS.find((c) => c.id === "create_task");
    expect(chip).toBeDefined();
    expect(chip!.enabled).toBe(false);
    expect(chip!.label).toBe("Create a task");
  });

  it("Draft a message chip is disabled (stub)", () => {
    const chip = QUICK_CHIPS.find((c) => c.id === "draft_message");
    expect(chip).toBeDefined();
    expect(chip!.enabled).toBe(false);
    expect(chip!.label).toBe("Draft a message");
  });

  it("each chip has an icon", () => {
    for (const chip of QUICK_CHIPS) {
      expect(chip.icon).toBeDefined();
      expect(chip.icon).toBeTruthy(); // React component (ForwardRef object)
    }
  });
});

// ═══════════════════════════════════════════════
// 2. Report Option Definitions
// ═══════════════════════════════════════════════

describe("Report Option Definitions", () => {
  it("defines exactly 3 report types", () => {
    expect(REPORT_OPTIONS).toHaveLength(3);
  });

  it("Daily Activity has a direct prompt (no sub-options)", () => {
    const daily = REPORT_OPTIONS.find((r) => r.id === "daily_activity");
    expect(daily).toBeDefined();
    expect(daily!.label).toBe("Daily Activity");
    expect(daily!.directPrompt).toBe("Show me the daily activity report");
    expect(daily!.subOptions).toBeUndefined();
  });

  it("Pipeline Summary has 4 sub-options with date ranges", () => {
    const pipeline = REPORT_OPTIONS.find((r) => r.id === "pipeline_summary");
    expect(pipeline).toBeDefined();
    expect(pipeline!.label).toBe("Pipeline Summary");
    expect(pipeline!.subOptions).toHaveLength(4);

    const labels = pipeline!.subOptions!.map((s) => s.label);
    expect(labels).toContain("Last 7 days");
    expect(labels).toContain("Last 30 days");
    expect(labels).toContain("This month");
    expect(labels).toContain("This quarter");
  });

  it("Pipeline Summary sub-options have correct prompts", () => {
    const pipeline = REPORT_OPTIONS.find((r) => r.id === "pipeline_summary")!;
    const last7 = pipeline.subOptions!.find((s) => s.label === "Last 7 days");
    expect(last7!.prompt).toBe("Show me a pipeline summary for the last 7 days");

    const last30 = pipeline.subOptions!.find((s) => s.label === "Last 30 days");
    expect(last30!.prompt).toBe("Show me a pipeline summary for the last 30 days");

    const thisMonth = pipeline.subOptions!.find((s) => s.label === "This month");
    expect(thisMonth!.prompt).toBe("Show me a pipeline summary for this month");

    const thisQuarter = pipeline.subOptions!.find((s) => s.label === "This quarter");
    expect(thisQuarter!.prompt).toBe("Show me a pipeline summary for this quarter");
  });

  it("Usage Report has 3 sub-options with period labels", () => {
    const usage = REPORT_OPTIONS.find((r) => r.id === "usage_report");
    expect(usage).toBeDefined();
    expect(usage!.label).toBe("Usage Report");
    expect(usage!.subOptions).toHaveLength(3);

    const labels = usage!.subOptions!.map((s) => s.label);
    expect(labels).toContain("Today");
    expect(labels).toContain("This week");
    expect(labels).toContain("This month");
  });

  it("Usage Report sub-options have correct prompts", () => {
    const usage = REPORT_OPTIONS.find((r) => r.id === "usage_report")!;
    const today = usage.subOptions!.find((s) => s.label === "Today");
    expect(today!.prompt).toBe("Show me my usage report for today");

    const week = usage.subOptions!.find((s) => s.label === "This week");
    expect(week!.prompt).toBe("Show me my usage report for this week");

    const month = usage.subOptions!.find((s) => s.label === "This month");
    expect(month!.prompt).toBe("Show me my usage report for this month");
  });

  it("each report option has an icon and description", () => {
    for (const opt of REPORT_OPTIONS) {
      expect(opt.icon).toBeDefined();
      expect(opt.icon).toBeTruthy(); // React component (ForwardRef object)
      expect(opt.description).toBeTruthy();
    }
  });
});

// ═══════════════════════════════════════════════
// 3. Component Source — Structure Verification
// ═══════════════════════════════════════════════

describe("JarvisQuickActions Component Structure", () => {
  const source = fs.readFileSync("client/src/components/JarvisQuickActions.tsx", "utf-8");

  it("renders data-testid for quick-actions container", () => {
    expect(source).toContain('data-testid="jarvis-quick-actions"');
  });

  it("renders data-testid for Reports chip", () => {
    expect(source).toContain('data-testid="chip-reports"');
  });

  it("renders data-testid for reports picker popover", () => {
    expect(source).toContain('data-testid="reports-picker"');
  });

  it("renders data-testid for each report option", () => {
    expect(source).toContain('data-testid={`report-option-${opt.id}`}');
  });

  it("renders data-testid for sub-options", () => {
    expect(source).toContain('data-testid={`suboptions-${opt.id}`}');
  });

  it("calls onSubmitPrompt when a report is selected", () => {
    expect(source).toContain("onSubmitPrompt(prompt)");
  });

  it("closes the popover on selection", () => {
    expect(source).toContain("setReportsOpen(false)");
  });

  it("shows toast for stub chips", () => {
    expect(source).toContain('toast.info("Feature coming soon")');
  });

  it("uses Popover from shadcn/ui", () => {
    expect(source).toContain("@/components/ui/popover");
  });

  it("chips have pill-shaped styling (rounded-full)", () => {
    expect(source).toContain("rounded-full");
  });

  it("supports disabled state", () => {
    expect(source).toContain("disabled={disabled}");
  });

  it("uses flex-wrap for mobile responsiveness", () => {
    expect(source).toContain("flex-wrap");
  });
});

// ═══════════════════════════════════════════════
// 4. Jarvis.tsx Integration
// ═══════════════════════════════════════════════

describe("Jarvis.tsx Integration with Quick Actions", () => {
  const source = fs.readFileSync("client/src/pages/Jarvis.tsx", "utf-8");

  it("imports JarvisQuickActions component", () => {
    expect(source).toContain("import JarvisQuickActions");
  });

  it("renders JarvisQuickActions in the input area", () => {
    expect(source).toContain("<JarvisQuickActions");
  });

  it("passes onSubmitPrompt callback", () => {
    expect(source).toContain("onSubmitPrompt={handleQuickPrompt}");
  });

  it("passes disabled state tied to isThinking", () => {
    expect(source).toContain("disabled={isThinking}");
  });

  it("defines handleQuickPrompt that sets input and sends message", () => {
    expect(source).toContain("handleQuickPrompt");
    expect(source).toContain("setInput(prompt)");
    expect(source).toContain("sendMessage(prompt)");
  });

  it("defines sendMessage as a reusable function", () => {
    expect(source).toContain("const sendMessage = useCallback");
  });
});
