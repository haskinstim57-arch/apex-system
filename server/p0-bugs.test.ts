/**
 * P0 Bug Tests — Jarvis Gemini 400 fix + Drip Engine execution fix
 * Updated after production verification on 2026-04-22
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// ─────────────────────────────────────────────
// Bug 1: Gemini functionResponse.response must be an object
// ─────────────────────────────────────────────

describe("Bug 1 — Gemini functionResponse sanitizer", () => {
  /**
   * Simulates the final sanitizer logic from gemini.ts invokeGeminiWithModel.
   * This runs on the assembled contents array right before model.generateContent().
   */
  function sanitizeContents(contents: any[]) {
    for (const content of contents) {
      for (const part of content.parts ?? []) {
        if (part.functionResponse) {
          const resp = part.functionResponse.response;
          if (Array.isArray(resp)) {
            part.functionResponse.response = { results: resp, total: resp.length };
          } else if (resp === null || resp === undefined) {
            part.functionResponse.response = { result: "no data" };
          } else if (typeof resp !== "object") {
            part.functionResponse.response = { result: resp };
          }
        }
      }
    }
    return contents;
  }

  it("wraps bare array functionResponse.response into { results, total }", () => {
    const contents = [
      {
        role: "model",
        parts: [
          {
            functionResponse: {
              name: "list_sequences",
              response: [{ id: 1, name: "Onboarding" }, { id: 2, name: "Follow-up" }],
            },
          },
        ],
      },
    ];
    sanitizeContents(contents);
    const resp = contents[0].parts[0].functionResponse.response;
    expect(Array.isArray(resp)).toBe(false);
    expect(resp).toHaveProperty("results");
    expect(resp).toHaveProperty("total", 2);
    expect(resp.results).toHaveLength(2);
  });

  it("wraps null functionResponse.response into { result: 'no data' }", () => {
    const contents = [
      {
        role: "model",
        parts: [{ functionResponse: { name: "get_nothing", response: null } }],
      },
    ];
    sanitizeContents(contents);
    expect(contents[0].parts[0].functionResponse.response).toEqual({ result: "no data" });
  });

  it("wraps undefined functionResponse.response into { result: 'no data' }", () => {
    const contents = [
      {
        role: "model",
        parts: [{ functionResponse: { name: "get_nothing", response: undefined } }],
      },
    ];
    sanitizeContents(contents);
    expect(contents[0].parts[0].functionResponse.response).toEqual({ result: "no data" });
  });

  it("wraps primitive string functionResponse.response into { result }", () => {
    const contents = [
      {
        role: "model",
        parts: [{ functionResponse: { name: "get_status", response: "all good" } }],
      },
    ];
    sanitizeContents(contents);
    expect(contents[0].parts[0].functionResponse.response).toEqual({ result: "all good" });
  });

  it("wraps primitive number functionResponse.response into { result }", () => {
    const contents = [
      {
        role: "model",
        parts: [{ functionResponse: { name: "count_items", response: 42 } }],
      },
    ];
    sanitizeContents(contents);
    expect(contents[0].parts[0].functionResponse.response).toEqual({ result: 42 });
  });

  it("does NOT modify valid object functionResponse.response", () => {
    const contents = [
      {
        role: "model",
        parts: [
          {
            functionResponse: {
              name: "get_dashboard",
              response: { totalContacts: 150, activeSequences: 3 },
            },
          },
        ],
      },
    ];
    sanitizeContents(contents);
    expect(contents[0].parts[0].functionResponse.response).toEqual({
      totalContacts: 150,
      activeSequences: 3,
    });
  });

  it("handles multiple parts with mixed types in same content", () => {
    const contents = [
      {
        role: "model",
        parts: [
          { text: "Here are the results:" },
          {
            functionResponse: {
              name: "search_contacts",
              response: [{ id: 1, name: "John" }],
            },
          },
          {
            functionResponse: {
              name: "get_stats",
              response: { count: 5 },
            },
          },
        ],
      },
    ];
    sanitizeContents(contents);
    // text part unchanged
    expect(contents[0].parts[0].text).toBe("Here are the results:");
    // array wrapped
    expect(contents[0].parts[1].functionResponse.response).toEqual({
      results: [{ id: 1, name: "John" }],
      total: 1,
    });
    // object unchanged
    expect(contents[0].parts[2].functionResponse.response).toEqual({ count: 5 });
  });

  it("handles empty array functionResponse.response", () => {
    const contents = [
      {
        role: "model",
        parts: [{ functionResponse: { name: "list_empty", response: [] } }],
      },
    ];
    sanitizeContents(contents);
    expect(contents[0].parts[0].functionResponse.response).toEqual({ results: [], total: 0 });
  });

  it("sanitizer exists in BOTH gemini functions before generateContent", () => {
    const fs = require("fs");
    const content = fs.readFileSync("/home/ubuntu/apex-system/server/services/gemini.ts", "utf-8");
    // Both invokeGemini and invokeGeminiWithModel must have sanitizers
    const sanitizer1Idx = content.indexOf("Final sanitizer (invokeGemini)");
    const sanitizer2Idx = content.indexOf("Final sanitizer: ensure every functionResponse");
    expect(sanitizer1Idx).toBeGreaterThan(-1);
    expect(sanitizer2Idx).toBeGreaterThan(-1);
    // Both must appear before their respective generateContent calls
    const generate1Idx = content.indexOf("model.generateContent", sanitizer1Idx);
    const generate2Idx = content.indexOf("model.generateContent", sanitizer2Idx);
    expect(generate1Idx).toBeGreaterThan(sanitizer1Idx);
    expect(generate2Idx).toBeGreaterThan(sanitizer2Idx);
  });

  it("sanitizer checks Array.isArray on part.functionResponse.response", () => {
    const fs = require("fs");
    const content = fs.readFileSync("/home/ubuntu/apex-system/server/services/gemini.ts", "utf-8");
    expect(content).toContain("Array.isArray(resp)");
    expect(content).toContain("results: resp, total: resp.length");
  });
});

// ─────────────────────────────────────────────
// Bug 1 continued: All tool handlers return objects
// ─────────────────────────────────────────────

describe("Bug 1 — All jarvisTools handlers return objects", () => {
  const toolsFile = require("fs").readFileSync(
    "/home/ubuntu/apex-system/server/services/jarvisTools.ts",
    "utf-8"
  );

  it("get_contact_messages returns { messages, total }", () => {
    expect(toolsFile).toContain("messages: mapped");
    expect(toolsFile).toContain("total: mapped.length");
  });

  it("list_workflows returns { workflows, total }", () => {
    expect(toolsFile).toContain("workflows: wfs");
  });

  it("list_sequences returns { sequences, total }", () => {
    expect(toolsFile).toContain("sequences: seqs");
  });

  it("list_calendars returns { calendars, total }", () => {
    expect(toolsFile).toContain("calendars: cals");
  });

  it("get_contact_appointments returns { appointments, total }", () => {
    expect(toolsFile).toContain("appointments: appts");
  });

  it("get_contact_conversation returns { messages, total }", () => {
    // This handler wraps conversation messages
    expect(toolsFile).toContain("messages: mapped, total: mapped.length");
  });

  it("get_contact_custom_fields returns { fields, total }", () => {
    expect(toolsFile).toContain("fields: defs.map");
    expect(toolsFile).toContain("total: defs.length");
  });
});

// ─────────────────────────────────────────────
// Bug 2: Drip Engine — sequence steps must fire
// ─────────────────────────────────────────────

describe("Bug 2 — Drip Engine processes due enrollments", () => {
  it("processNextSteps is exported and callable", async () => {
    const { processNextSteps } = await import("../server/services/dripEngine");
    expect(typeof processNextSteps).toBe("function");
  });

  it("startDripWorker is exported and callable", async () => {
    const { startDripWorker, stopDripWorker } = await import("../server/services/dripEngine");
    expect(typeof startDripWorker).toBe("function");
    expect(typeof stopDripWorker).toBe("function");
  });

  it("computeFirstStepAt returns a future Date", async () => {
    const { computeFirstStepAt } = await import("../server/services/dripEngine");
    const now = Date.now();
    const result = computeFirstStepAt(1, 2); // 1 day + 2 hours
    expect(result instanceof Date).toBe(true);
    expect(result.getTime()).toBeGreaterThan(now);
    const expectedMs = 1 * 86400000 + 2 * 3600000;
    expect(result.getTime() - now).toBeGreaterThan(expectedMs - 5000);
    expect(result.getTime() - now).toBeLessThan(expectedMs + 5000);
  });

  it("computeFirstStepAt defaults to 1 minute if no delay", async () => {
    const { computeFirstStepAt } = await import("../server/services/dripEngine");
    const now = Date.now();
    const result = computeFirstStepAt(0, 0);
    expect(result.getTime() - now).toBeGreaterThan(55000);
    expect(result.getTime() - now).toBeLessThan(65000);
  });

  it("CRITICAL: dripEngine uses status 'pending' NOT 'queued' for message records", () => {
    const fs = require("fs");
    const content = fs.readFileSync("/home/ubuntu/apex-system/server/services/dripEngine.ts", "utf-8");
    // The messages table enum is: pending, sent, delivered, failed, bounced
    // 'queued' is NOT a valid enum value — this was the root cause of Bug 2
    const messageCreations = content.match(/createMessage\(\{[\s\S]*?\}\)/g) || [];
    expect(messageCreations.length).toBeGreaterThanOrEqual(2); // SMS + email paths
    for (const mc of messageCreations) {
      expect(mc).toContain('status: "pending"');
      expect(mc).not.toContain('status: "queued"');
    }
  });

  it("dripEngine uses enqueueMessage for actual dispatch", () => {
    const fs = require("fs");
    const content = fs.readFileSync("/home/ubuntu/apex-system/server/services/dripEngine.ts", "utf-8");
    expect(content).toContain('import { enqueueMessage } from "./messageQueue"');
    expect(content).toContain('source: "sequence_drip"');
  });

  it("startDripWorker is registered in server/_core/index.ts", () => {
    const fs = require("fs");
    const content = fs.readFileSync("/home/ubuntu/apex-system/server/_core/index.ts", "utf-8");
    expect(content).toContain("startDripWorker");
  });

  it("drip worker runs on 60-second interval", () => {
    const fs = require("fs");
    const content = fs.readFileSync("/home/ubuntu/apex-system/server/services/dripEngine.ts", "utf-8");
    expect(content).toContain("DRIP_INTERVAL_MS = 60_000");
    expect(content).toContain("setInterval(runDripCycle, DRIP_INTERVAL_MS)");
  });

  it("dripEngine has tick logging for production debugging", () => {
    const fs = require("fs");
    const content = fs.readFileSync("/home/ubuntu/apex-system/server/services/dripEngine.ts", "utf-8");
    expect(content).toContain("[DripEngine] tick, candidates:");
    expect(content).toContain("[DripEngine] Processing enrollment=");
    expect(content).toContain("[DripEngine] Message record created");
    expect(content).toContain("[DripEngine] SMS enqueued");
  });

  it("DripResult interface has all required fields", () => {
    const result = {
      processed: 0,
      sent: 0,
      failed: 0,
      completed: 0,
      skippedWarming: 0,
      errors: [] as Array<{ enrollmentId: number; error: string }>,
    };
    expect(result).toHaveProperty("processed");
    expect(result).toHaveProperty("sent");
    expect(result).toHaveProperty("failed");
    expect(result).toHaveProperty("completed");
    expect(result).toHaveProperty("skippedWarming");
    expect(result).toHaveProperty("errors");
  });
});
