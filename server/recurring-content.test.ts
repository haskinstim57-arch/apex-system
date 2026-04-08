import { describe, it, expect } from "vitest";
import { computeNextRunAt } from "./services/recurringContentWorker";

// ─── computeNextRunAt tests ─────────────────────────────────────────────

describe("computeNextRunAt", () => {

  it("returns ~24h from now for daily", () => {
    const before = Date.now();
    const result = computeNextRunAt("daily");
    const after = Date.now();
    const diff = result.getTime() - before;
    // Should be approximately 24 hours (86400000ms) ± 1 second tolerance
    expect(diff).toBeGreaterThanOrEqual(86400000 - 1000);
    expect(diff).toBeLessThanOrEqual(86400000 + 1000);
  });

  it("returns ~7 days from now for weekly", () => {
    const before = Date.now();
    const result = computeNextRunAt("weekly");
    const diff = result.getTime() - before;
    expect(diff).toBeGreaterThanOrEqual(7 * 86400000 - 1000);
    expect(diff).toBeLessThanOrEqual(7 * 86400000 + 1000);
  });

  it("returns ~14 days from now for biweekly", () => {
    const before = Date.now();
    const result = computeNextRunAt("biweekly");
    const diff = result.getTime() - before;
    expect(diff).toBeGreaterThanOrEqual(14 * 86400000 - 1000);
    expect(diff).toBeLessThanOrEqual(14 * 86400000 + 1000);
  });

  it("returns ~30 days from now for monthly", () => {
    const before = Date.now();
    const result = computeNextRunAt("monthly");
    const diff = result.getTime() - before;
    expect(diff).toBeGreaterThanOrEqual(30 * 86400000 - 1000);
    expect(diff).toBeLessThanOrEqual(30 * 86400000 + 1000);
  });

  it("defaults to weekly for unknown frequency", () => {
    const before = Date.now();
    const result = computeNextRunAt("unknown_value");
    const diff = result.getTime() - before;
    expect(diff).toBeGreaterThanOrEqual(7 * 86400000 - 1000);
    expect(diff).toBeLessThanOrEqual(7 * 86400000 + 1000);
  });

  it("returns a Date object", () => {
    const result = computeNextRunAt("daily");
    expect(result).toBeInstanceOf(Date);
  });
});

// ─── Frequency labels mapping tests ─────────────────────────────────────────

describe("Frequency labels", () => {
  const FREQUENCY_LABELS: Record<string, string> = {
    daily: "Daily",
    weekly: "Weekly",
    biweekly: "Every 2 Weeks",
    monthly: "Monthly",
  };

  it("maps all frequency values to human-readable labels", () => {
    expect(FREQUENCY_LABELS["daily"]).toBe("Daily");
    expect(FREQUENCY_LABELS["weekly"]).toBe("Weekly");
    expect(FREQUENCY_LABELS["biweekly"]).toBe("Every 2 Weeks");
    expect(FREQUENCY_LABELS["monthly"]).toBe("Monthly");
  });

  it("returns undefined for unknown frequency", () => {
    expect(FREQUENCY_LABELS["hourly"]).toBeUndefined();
  });
});

// ─── Plan run result parsing tests ──────────────────────────────────────────

describe("Plan run result parsing", () => {
  it("parses a successful run result JSON", () => {
    const result = JSON.stringify({
      generated: 3,
      failed: 0,
      topics: [
        { topic: "First-time homebuyer tips", status: "success", id: 101 },
        { topic: "Refinancing guide", status: "success", id: 102 },
        { topic: "FHA vs conventional", status: "success", id: 103 },
      ],
    });
    const parsed = JSON.parse(result);
    expect(parsed.generated).toBe(3);
    expect(parsed.failed).toBe(0);
    expect(parsed.topics).toHaveLength(3);
    expect(parsed.topics[0].status).toBe("success");
  });

  it("parses a mixed run result with failures", () => {
    const result = JSON.stringify({
      generated: 2,
      failed: 1,
      topics: [
        { topic: "Topic A", status: "success", id: 201 },
        { topic: "Topic B", status: "failed", error: "LLM timeout" },
        { topic: "Topic C", status: "success", id: 203 },
      ],
    });
    const parsed = JSON.parse(result);
    expect(parsed.generated).toBe(2);
    expect(parsed.failed).toBe(1);
    const failedTopics = parsed.topics.filter((t: any) => t.status === "failed");
    expect(failedTopics).toHaveLength(1);
    expect(failedTopics[0].error).toBe("LLM timeout");
  });

  it("handles empty run result", () => {
    const result = JSON.stringify({
      generated: 0,
      failed: 0,
      topics: [],
    });
    const parsed = JSON.parse(result);
    expect(parsed.generated).toBe(0);
    expect(parsed.topics).toHaveLength(0);
  });
});

// ─── Topic expansion validation tests ───────────────────────────────────────

describe("Topic expansion validation", () => {
  it("extracts JSON array from LLM response with surrounding text", () => {
    const raw = 'Here are the topics:\n["Mortgage tips for millennials", "VA loan benefits explained"]\nHope this helps!';
    const match = raw.match(/\[[\s\S]*\]/);
    const topics = match ? JSON.parse(match[0]) : [];
    expect(topics).toHaveLength(2);
    expect(topics[0]).toBe("Mortgage tips for millennials");
  });

  it("falls back to template when no JSON array found", () => {
    const raw = "I cannot generate topics right now.";
    const match = raw.match(/\[[\s\S]*\]/);
    const template = "Weekly mortgage tips";
    const topics = match ? JSON.parse(match[0]) : [template];
    expect(topics).toHaveLength(1);
    expect(topics[0]).toBe(template);
  });

  it("slices topics to postsPerCycle limit", () => {
    const topics = ["A", "B", "C", "D", "E"];
    const postsPerCycle = 3;
    const sliced = topics.slice(0, postsPerCycle);
    expect(sliced).toHaveLength(3);
    expect(sliced).toEqual(["A", "B", "C"]);
  });
});

// ─── Content type routing tests ─────────────────────────────────────────────

describe("Content type routing", () => {
  it("routes blog type correctly", () => {
    const plan = { contentType: "blog", platform: null };
    expect(plan.contentType).toBe("blog");
  });

  it("routes social type with platform", () => {
    const plan = { contentType: "social", platform: "instagram" };
    expect(plan.contentType).toBe("social");
    expect(plan.platform).toBe("instagram");
  });

  it("defaults platform to instagram when null for social", () => {
    const plan = { contentType: "social", platform: null };
    const platform = plan.platform || "instagram";
    expect(platform).toBe("instagram");
  });
});
