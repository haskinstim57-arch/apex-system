import { describe, it, expect, vi } from "vitest";
import {
  provisionFacebookLeadFollowUp,
  WORKFLOW_TEMPLATES,
} from "./services/workflowTemplates";

// ─── Mock DB helpers ───
const mockWorkflows: any[] = [];
let nextId = 100;
let nextStepId = 200;

vi.mock("./db", () => ({
  listWorkflows: vi.fn(async (accountId: number) => mockWorkflows.filter((w: any) => w.accountId === accountId)),
  createWorkflow: vi.fn(async (data: any) => {
    const id = nextId++;
    mockWorkflows.push({ id, ...data });
    return { id };
  }),
  createWorkflowStep: vi.fn(async (data: any) => {
    const id = nextStepId++;
    return { id };
  }),
  updateWorkflow: vi.fn(async () => {}),
}));

describe("Workflow Templates", () => {
  describe("WORKFLOW_TEMPLATES constant", () => {
    it("should have at least one template", () => {
      expect(WORKFLOW_TEMPLATES.length).toBeGreaterThanOrEqual(1);
    });

    it("should include facebook_lead_followup template", () => {
      const fb = WORKFLOW_TEMPLATES.find((t) => t.id === "facebook_lead_followup");
      expect(fb).toBeDefined();
      expect(fb!.name).toBe("Facebook Lead Follow-Up");
      expect(fb!.triggerType).toBe("facebook_lead_received");
    });

    it("should define 3 steps for facebook_lead_followup", () => {
      const fb = WORKFLOW_TEMPLATES.find((t) => t.id === "facebook_lead_followup");
      expect(fb!.steps).toHaveLength(3);
      expect(fb!.steps[0].type).toBe("action");
      expect(fb!.steps[0].action).toBe("send_sms");
      expect(fb!.steps[1].type).toBe("delay");
      expect(fb!.steps[2].type).toBe("action");
      expect(fb!.steps[2].action).toBe("start_ai_call");
    });
  });

  describe("provisionFacebookLeadFollowUp", () => {
    it("should create a workflow with 3 steps", async () => {
      // Clear mock state
      mockWorkflows.length = 0;

      const result = await provisionFacebookLeadFollowUp(1, 99);

      expect(result.alreadyExists).toBe(false);
      expect(result.workflowId).toBeGreaterThan(0);

      // Verify the workflow was created
      const { createWorkflow, createWorkflowStep } = await import("./db");
      expect(createWorkflow).toHaveBeenCalledWith(
        expect.objectContaining({
          accountId: 1,
          name: "Facebook Lead Follow-Up",
          triggerType: "facebook_lead_received",
          createdById: 99,
          isActive: false,
        })
      );

      // Should have created 3 steps
      expect(createWorkflowStep).toHaveBeenCalledTimes(3);

      // Step 1: Send SMS
      expect(createWorkflowStep).toHaveBeenCalledWith(
        expect.objectContaining({
          stepOrder: 1,
          stepType: "action",
          actionType: "send_sms",
        })
      );

      // Step 2: Delay 5 minutes
      expect(createWorkflowStep).toHaveBeenCalledWith(
        expect.objectContaining({
          stepOrder: 2,
          stepType: "delay",
          delayType: "minutes",
          delayValue: 5,
        })
      );

      // Step 3: Start AI Call
      expect(createWorkflowStep).toHaveBeenCalledWith(
        expect.objectContaining({
          stepOrder: 3,
          stepType: "action",
          actionType: "start_ai_call",
        })
      );
    });

    it("should not duplicate if a facebook workflow already exists", async () => {
      // The workflow from the previous test is still in mockWorkflows
      // It has triggerType: "facebook_lead_received"
      const result = await provisionFacebookLeadFollowUp(1, 99);

      expect(result.alreadyExists).toBe(true);
      expect(result.workflowId).toBe(0);
    });

    it("should create for a different account even if one exists for another", async () => {
      // mockWorkflows has a workflow for accountId=1
      // Requesting for accountId=2 should work
      const result = await provisionFacebookLeadFollowUp(2, 50);

      expect(result.alreadyExists).toBe(false);
      expect(result.workflowId).toBeGreaterThan(0);
    });

    it("should include SMS template with {{firstName}} variable", async () => {
      mockWorkflows.length = 0;
      const { createWorkflowStep } = await import("./db");
      (createWorkflowStep as any).mockClear();

      await provisionFacebookLeadFollowUp(3, 1);

      // Check the SMS step config contains {{firstName}}
      const smsCall = (createWorkflowStep as any).mock.calls.find(
        (call: any[]) => call[0].actionType === "send_sms"
      );
      expect(smsCall).toBeDefined();
      const config = JSON.parse(smsCall[0].config);
      expect(config.message).toContain("{{firstName}}");
    });

    it("should create workflow as inactive by default", async () => {
      mockWorkflows.length = 0;
      const { createWorkflow } = await import("./db");
      (createWorkflow as any).mockClear();

      await provisionFacebookLeadFollowUp(4, 1);

      expect(createWorkflow).toHaveBeenCalledWith(
        expect.objectContaining({
          isActive: false,
        })
      );
    });
  });
});
