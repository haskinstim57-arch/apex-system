import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { checkAndMarkWorkflowExecution } from "./services/workflowDedup";

/**
 * Tests for the in-memory workflow dedup guard.
 *
 * NOTE: The dedup Map is module-level and persists across tests (Vitest caches modules).
 * Each test uses unique workflowId/contactId values to avoid cross-contamination.
 */

describe("workflowDedup — checkAndMarkWorkflowExecution", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("should allow the first execution for a workflow+contact pair", () => {
    const result = checkAndMarkWorkflowExecution(1001, 2001);
    expect(result).toBe(true);
  });

  it("should block duplicate execution within 2-minute window", () => {
    const first = checkAndMarkWorkflowExecution(1002, 2002);
    expect(first).toBe(true);

    const second = checkAndMarkWorkflowExecution(1002, 2002);
    expect(second).toBe(false);
  });

  it("should allow execution after 2-minute window expires", () => {
    const first = checkAndMarkWorkflowExecution(1003, 2003);
    expect(first).toBe(true);

    // Advance time past the 2-minute dedup window
    vi.advanceTimersByTime(2 * 60 * 1000 + 1);

    const second = checkAndMarkWorkflowExecution(1003, 2003);
    expect(second).toBe(true);
  });

  it("should allow different workflows for the same contact", () => {
    const r1 = checkAndMarkWorkflowExecution(1004, 2004);
    const r2 = checkAndMarkWorkflowExecution(1005, 2004);
    expect(r1).toBe(true);
    expect(r2).toBe(true);
  });

  it("should allow same workflow for different contacts", () => {
    const r1 = checkAndMarkWorkflowExecution(1006, 2005);
    const r2 = checkAndMarkWorkflowExecution(1006, 2006);
    expect(r1).toBe(true);
    expect(r2).toBe(true);
  });

  it("should still block within window even after allowing different pairs", () => {
    checkAndMarkWorkflowExecution(1007, 2007);
    checkAndMarkWorkflowExecution(1008, 2008);
    checkAndMarkWorkflowExecution(1009, 2009);

    // Try duplicate of first pair
    const dup = checkAndMarkWorkflowExecution(1007, 2007);
    expect(dup).toBe(false);
  });
});

describe("workflowDedup — Facebook lead scenario", () => {
  it("should prevent triple-trigger scenario (same workflow fires 3x for same contact)", () => {
    const workflowId = 3001;
    const contactId = 4001;

    // First trigger fires the workflow
    const first = checkAndMarkWorkflowExecution(workflowId, contactId);
    expect(first).toBe(true);

    // Second trigger (same workflow, same contact) should be blocked
    const second = checkAndMarkWorkflowExecution(workflowId, contactId);
    expect(second).toBe(false);

    // Third trigger (same workflow, same contact) should also be blocked
    const third = checkAndMarkWorkflowExecution(workflowId, contactId);
    expect(third).toBe(false);
  });

  it("should allow different workflows to fire for the same Facebook lead", () => {
    const contactId = 4002;

    // Workflow A: "Welcome email" triggered by contact_created
    const wfA = checkAndMarkWorkflowExecution(3002, contactId);
    expect(wfA).toBe(true);

    // Workflow B: "Facebook lead nurture" triggered by facebook_lead_received
    const wfB = checkAndMarkWorkflowExecution(3003, contactId);
    expect(wfB).toBe(true);

    // Workflow C: "Form follow-up" triggered by form_submitted
    const wfC = checkAndMarkWorkflowExecution(3004, contactId);
    expect(wfC).toBe(true);
  });
});
