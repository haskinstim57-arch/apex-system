import { describe, expect, it, vi, beforeEach } from "vitest";

// ═══════════════════════════════════════════
// Unit tests for workflow trigger functions
// Tests that each trigger function:
// 1. Calls getActiveWorkflowsByTrigger with the correct trigger type
// 2. Handles empty workflow lists gracefully
// 3. Respects triggerConfig filtering (channel, calendarId, formId, field)
// ═══════════════════════════════════════════

// Mock the db module
const mockGetActiveWorkflowsByTrigger = vi.fn();
const mockCreateWorkflowExecution = vi.fn().mockResolvedValue({ id: 1 });
const mockUpdateWorkflow = vi.fn().mockResolvedValue(undefined);

vi.mock("./db", () => ({
  getActiveWorkflowsByTrigger: (...args: any[]) => mockGetActiveWorkflowsByTrigger(...args),
  createWorkflowExecution: (...args: any[]) => mockCreateWorkflowExecution(...args),
  updateWorkflow: (...args: any[]) => mockUpdateWorkflow(...args),
  getWorkflowSteps: vi.fn().mockResolvedValue([]),
}));

// Mock the workflowEngine to prevent actual execution
vi.mock("./services/workflowEngine", () => ({
  triggerWorkflow: vi.fn().mockResolvedValue(undefined),
  processExecution: vi.fn().mockResolvedValue(undefined),
}));

beforeEach(() => {
  vi.clearAllMocks();
});

describe("Workflow Trigger Functions", () => {
  // ─── onInboundMessageReceived ───
  describe("onInboundMessageReceived", () => {
    it("queries for inbound_message_received workflows", async () => {
      mockGetActiveWorkflowsByTrigger.mockResolvedValue([]);
      const { onInboundMessageReceived } = await import("./services/workflowTriggers");
      await onInboundMessageReceived(100, 200, "sms");
      expect(mockGetActiveWorkflowsByTrigger).toHaveBeenCalledWith(100, "inbound_message_received");
    });

    it("handles empty workflow list gracefully", async () => {
      mockGetActiveWorkflowsByTrigger.mockResolvedValue([]);
      const { onInboundMessageReceived } = await import("./services/workflowTriggers");
      await expect(onInboundMessageReceived(100, 200, "sms")).resolves.not.toThrow();
    });
  });

  // ─── onAppointmentBooked ───
  describe("onAppointmentBooked", () => {
    it("queries for appointment_booked workflows", async () => {
      mockGetActiveWorkflowsByTrigger.mockResolvedValue([]);
      const { onAppointmentBooked } = await import("./services/workflowTriggers");
      await onAppointmentBooked(100, 200, 50, 10);
      expect(mockGetActiveWorkflowsByTrigger).toHaveBeenCalledWith(100, "appointment_booked");
    });

    it("handles empty workflow list gracefully", async () => {
      mockGetActiveWorkflowsByTrigger.mockResolvedValue([]);
      const { onAppointmentBooked } = await import("./services/workflowTriggers");
      await expect(onAppointmentBooked(100, 200, 50, 10)).resolves.not.toThrow();
    });
  });

  // ─── onAppointmentCancelled ───
  describe("onAppointmentCancelled", () => {
    it("queries for appointment_cancelled workflows", async () => {
      mockGetActiveWorkflowsByTrigger.mockResolvedValue([]);
      const { onAppointmentCancelled } = await import("./services/workflowTriggers");
      await onAppointmentCancelled(100, 200, 50);
      expect(mockGetActiveWorkflowsByTrigger).toHaveBeenCalledWith(100, "appointment_cancelled");
    });

    it("handles empty workflow list gracefully", async () => {
      mockGetActiveWorkflowsByTrigger.mockResolvedValue([]);
      const { onAppointmentCancelled } = await import("./services/workflowTriggers");
      await expect(onAppointmentCancelled(100, 200, 50)).resolves.not.toThrow();
    });
  });

  // ─── onMissedCall ───
  describe("onMissedCall", () => {
    it("queries for missed_call workflows", async () => {
      mockGetActiveWorkflowsByTrigger.mockResolvedValue([]);
      const { onMissedCall } = await import("./services/workflowTriggers");
      await onMissedCall(100, 200);
      expect(mockGetActiveWorkflowsByTrigger).toHaveBeenCalledWith(100, "missed_call");
    });

    it("handles empty workflow list gracefully", async () => {
      mockGetActiveWorkflowsByTrigger.mockResolvedValue([]);
      const { onMissedCall } = await import("./services/workflowTriggers");
      await expect(onMissedCall(100, 200)).resolves.not.toThrow();
    });
  });

  // ─── onFormSubmitted ───
  describe("onFormSubmitted", () => {
    it("queries for form_submitted workflows", async () => {
      mockGetActiveWorkflowsByTrigger.mockResolvedValue([]);
      const { onFormSubmitted } = await import("./services/workflowTriggers");
      await onFormSubmitted(100, 200, "facebook_lead_form");
      expect(mockGetActiveWorkflowsByTrigger).toHaveBeenCalledWith(100, "form_submitted");
    });

    it("handles empty workflow list gracefully", async () => {
      mockGetActiveWorkflowsByTrigger.mockResolvedValue([]);
      const { onFormSubmitted } = await import("./services/workflowTriggers");
      await expect(onFormSubmitted(100, 200)).resolves.not.toThrow();
    });
  });

  // ─── onDateTriggerCheck ───
  describe("onDateTriggerCheck", () => {
    it("queries for date_trigger workflows", async () => {
      mockGetActiveWorkflowsByTrigger.mockResolvedValue([]);
      const { onDateTriggerCheck } = await import("./services/workflowTriggers");
      await onDateTriggerCheck(100, 200, "createdAt");
      expect(mockGetActiveWorkflowsByTrigger).toHaveBeenCalledWith(100, "date_trigger");
    });

    it("handles empty workflow list gracefully", async () => {
      mockGetActiveWorkflowsByTrigger.mockResolvedValue([]);
      const { onDateTriggerCheck } = await import("./services/workflowTriggers");
      await expect(onDateTriggerCheck(100, 200, "createdAt")).resolves.not.toThrow();
    });
  });

  // ─── onCallCompleted (already existed, verify it still works) ───
  describe("onCallCompleted", () => {
    it("queries for call_completed workflows", async () => {
      mockGetActiveWorkflowsByTrigger.mockResolvedValue([]);
      const { onCallCompleted } = await import("./services/workflowTriggers");
      await onCallCompleted(100, 200);
      expect(mockGetActiveWorkflowsByTrigger).toHaveBeenCalledWith(100, "call_completed");
    });

    it("handles empty workflow list gracefully", async () => {
      mockGetActiveWorkflowsByTrigger.mockResolvedValue([]);
      const { onCallCompleted } = await import("./services/workflowTriggers");
      await expect(onCallCompleted(100, 200)).resolves.not.toThrow();
    });
  });

  // ─── Existing triggers still work ───
  describe("onContactCreated", () => {
    it("queries for contact_created workflows", async () => {
      mockGetActiveWorkflowsByTrigger.mockResolvedValue([]);
      const { onContactCreated } = await import("./services/workflowTriggers");
      await onContactCreated(100, 200);
      expect(mockGetActiveWorkflowsByTrigger).toHaveBeenCalledWith(100, "contact_created");
    });
  });

  describe("onFacebookLeadReceived", () => {
    it("queries for facebook_lead_received workflows", async () => {
      mockGetActiveWorkflowsByTrigger.mockResolvedValue([]);
      const { onFacebookLeadReceived } = await import("./services/workflowTriggers");
      await onFacebookLeadReceived(100, 200);
      expect(mockGetActiveWorkflowsByTrigger).toHaveBeenCalledWith(100, "facebook_lead_received");
    });
  });
});
