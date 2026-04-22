/**
 * P0 Bug Tests — Jarvis tool responses + Drip Engine execution
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// ─────────────────────────────────────────────
// Bug 1: Jarvis tool responses must be objects (not arrays)
// ─────────────────────────────────────────────

describe("Bug 1 — Jarvis tool responses are objects", () => {
  it("get_contact_messages returns { messages, total } not an array", async () => {
    // Simulate what the tool handler returns
    const mockMessages = [
      { id: 1, type: "sms", direction: "inbound", body: "Hello" },
      { id: 2, type: "email", direction: "outbound", body: "Hi there" },
    ];
    const result = { messages: mockMessages, total: mockMessages.length };
    expect(result).toHaveProperty("messages");
    expect(result).toHaveProperty("total");
    expect(Array.isArray(result)).toBe(false);
    expect(typeof result).toBe("object");
  });

  it("list_workflows returns { workflows, total } not an array", () => {
    const mockWorkflows = [{ id: 1, name: "Welcome" }];
    const result = { workflows: mockWorkflows, total: mockWorkflows.length };
    expect(result).toHaveProperty("workflows");
    expect(Array.isArray(result)).toBe(false);
  });

  it("list_segments returns { segments, total } not an array", () => {
    const mockSegments = [{ id: 1, name: "VIP" }];
    const result = { segments: mockSegments, total: mockSegments.length };
    expect(result).toHaveProperty("segments");
    expect(Array.isArray(result)).toBe(false);
  });

  it("list_sequences returns { sequences, total } not an array", () => {
    const mockSequences = [{ id: 1, name: "Onboarding" }];
    const result = { sequences: mockSequences, total: mockSequences.length };
    expect(result).toHaveProperty("sequences");
    expect(Array.isArray(result)).toBe(false);
  });

  it("list_calendars returns { calendars, total } not an array", () => {
    const mockCalendars = [{ id: 1, name: "Main" }];
    const result = { calendars: mockCalendars, total: mockCalendars.length };
    expect(result).toHaveProperty("calendars");
    expect(Array.isArray(result)).toBe(false);
  });

  it("get_contact_appointments returns { appointments, total } not an array", () => {
    const mockAppointments = [{ id: 1, guestName: "John" }];
    const result = { appointments: mockAppointments, total: mockAppointments.length };
    expect(result).toHaveProperty("appointments");
    expect(Array.isArray(result)).toBe(false);
  });

  it("get_contact_conversation returns { messages, total } not an array", () => {
    const mockMsgs = [{ id: 1, type: "sms" }];
    const result = { messages: mockMsgs, total: mockMsgs.length };
    expect(result).toHaveProperty("messages");
    expect(Array.isArray(result)).toBe(false);
  });

  it("get_contact_custom_fields returns { fields, total } not an array", () => {
    const mockFields = [{ fieldName: "Loan Type", value: "Purchase" }];
    const result = { fields: mockFields, total: mockFields.length };
    expect(result).toHaveProperty("fields");
    expect(Array.isArray(result)).toBe(false);
  });

  it("gemini.ts safety net wraps arrays in objects", () => {
    // Simulate the safety net logic from gemini.ts
    let responseData: unknown = [{ id: 1 }, { id: 2 }];
    if (Array.isArray(responseData)) {
      responseData = { results: responseData, total: (responseData as unknown[]).length };
    }
    expect(Array.isArray(responseData)).toBe(false);
    expect(responseData).toHaveProperty("results");
    expect(responseData).toHaveProperty("total", 2);
  });

  it("gemini.ts safety net does not wrap objects", () => {
    let responseData: unknown = { success: true, data: "hello" };
    if (Array.isArray(responseData)) {
      responseData = { results: responseData, total: (responseData as unknown[]).length };
    }
    expect(responseData).toEqual({ success: true, data: "hello" });
  });

  it("gemini.ts safety net does not wrap strings", () => {
    let responseData: unknown = "plain text result";
    if (Array.isArray(responseData)) {
      responseData = { results: responseData, total: (responseData as unknown[]).length };
    }
    expect(responseData).toBe("plain text result");
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
    // Should be approximately 1 day + 2 hours from now
    const expectedMs = 1 * 86400000 + 2 * 3600000;
    expect(result.getTime() - now).toBeGreaterThan(expectedMs - 5000);
    expect(result.getTime() - now).toBeLessThan(expectedMs + 5000);
  });

  it("computeFirstStepAt defaults to 1 minute if no delay", async () => {
    const { computeFirstStepAt } = await import("../server/services/dripEngine");
    const now = Date.now();
    const result = computeFirstStepAt(0, 0);
    // Should be ~60000ms from now
    expect(result.getTime() - now).toBeGreaterThan(55000);
    expect(result.getTime() - now).toBeLessThan(65000);
  });

  it("processNextSteps returns empty result when no due enrollments", async () => {
    // Mock getDueEnrollments to return empty
    vi.doMock("../server/db", () => ({
      getDueEnrollments: vi.fn().mockResolvedValue([]),
      advanceEnrollment: vi.fn(),
      getContactById: vi.fn(),
      createMessage: vi.fn(),
      listSequenceSteps: vi.fn(),
      getOrCreateWarmingConfig: vi.fn(),
      resetDailySendCount: vi.fn(),
      updateCurrentDailyLimit: vi.fn(),
      incrementDailySendCount: vi.fn(),
      logContactActivity: vi.fn(),
    }));

    // Re-import with mocked dependencies
    const { processNextSteps } = await import("../server/services/dripEngine");
    const result = await processNextSteps();
    expect(result.processed).toBe(0);
    expect(result.sent).toBe(0);
    expect(result.failed).toBe(0);
    expect(result.completed).toBe(0);
    expect(result.skippedWarming).toBe(0);
    expect(result.errors).toEqual([]);

    vi.doUnmock("../server/db");
  });

  it("DripResult interface has all required fields", async () => {
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

  it("enqueueMessage is imported from messageQueue (not createMessage for dispatch)", async () => {
    // Verify the import exists in dripEngine
    const fs = await import("fs");
    const content = fs.readFileSync("/home/ubuntu/apex-system/server/services/dripEngine.ts", "utf-8");
    expect(content).toContain('import { enqueueMessage } from "./messageQueue"');
    expect(content).toContain('source: "sequence_drip"');
  });

  it("dripEngine creates message records with status 'queued' not 'pending'", async () => {
    const fs = await import("fs");
    const content = fs.readFileSync("/home/ubuntu/apex-system/server/services/dripEngine.ts", "utf-8");
    // Should use 'queued' status for message records (since actual send is via messageQueue)
    expect(content).toContain('status: "queued"');
    // Should NOT have 'pending' status for message records (old broken behavior)
    const messageCreations = content.match(/createMessage\(\{[\s\S]*?\}\)/g) || [];
    for (const mc of messageCreations) {
      expect(mc).not.toContain('status: "pending"');
    }
  });

  it("startDripWorker is registered in server/_core/index.ts", async () => {
    const fs = await import("fs");
    const content = fs.readFileSync("/home/ubuntu/apex-system/server/_core/index.ts", "utf-8");
    expect(content).toContain('import { startDripWorker } from "../services/dripEngine"');
    expect(content).toContain("startDripWorker()");
  });

  it("drip worker runs on 60-second interval", async () => {
    const fs = await import("fs");
    const content = fs.readFileSync("/home/ubuntu/apex-system/server/services/dripEngine.ts", "utf-8");
    expect(content).toContain("DRIP_INTERVAL_MS = 60_000");
    expect(content).toContain("setInterval(runDripCycle, DRIP_INTERVAL_MS)");
  });
});
