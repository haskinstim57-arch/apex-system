import {
  createWorkflow,
  createWorkflowStep,
  listWorkflows,
  updateWorkflow,
} from "../db";

// ─────────────────────────────────────────────
// Workflow Templates
// Pre-built workflow templates that can be provisioned for accounts.
// ─────────────────────────────────────────────

/**
 * Check if a Facebook Lead Follow-Up workflow already exists for the account.
 * Looks for any workflow with triggerType = "facebook_lead_received".
 */
async function hasFacebookLeadWorkflow(accountId: number): Promise<boolean> {
  const allWorkflows = await listWorkflows(accountId);
  return allWorkflows.some((w) => w.triggerType === "facebook_lead_received");
}

/**
 * Provision the "Facebook Lead Follow-Up" workflow template for an account.
 *
 * Workflow structure:
 * 1. [Action] Send SMS — welcome message with first name
 * 2. [Delay]  Wait 5 minutes
 * 3. [Action] Start AI Call — VAPI call to the lead
 *
 * Trigger: facebook_lead_received
 * The workflow is created as ACTIVE by default.
 *
 * Returns the workflow ID, or null if the template already exists.
 */
export async function provisionFacebookLeadFollowUp(
  accountId: number,
  createdById: number
): Promise<{ workflowId: number; alreadyExists: boolean }> {
  // Don't duplicate — check if one already exists
  if (await hasFacebookLeadWorkflow(accountId)) {
    return { workflowId: 0, alreadyExists: true };
  }

  // 1. Create the workflow
  const { id: workflowId } = await createWorkflow({
    accountId,
    name: "Facebook Lead Follow-Up",
    description:
      "Automatically sends a welcome SMS and starts an AI call when a new Facebook lead arrives. Edit the SMS message and timing to match your follow-up strategy.",
    triggerType: "facebook_lead_received",
    triggerConfig: null,
    createdById,
    isActive: false, // Created inactive — user activates after reviewing
  });

  // 2. Step 1: Send SMS
  await createWorkflowStep({
    workflowId,
    stepOrder: 1,
    stepType: "action",
    actionType: "send_sms",
    delayType: null,
    delayValue: null,
    config: JSON.stringify({
      message:
        "Hi {{firstName}}, thank you for your interest! We received your information and a loan specialist will be reaching out to you shortly. If you'd like to schedule a consultation now, reply BOOK.",
    }),
  });

  // 3. Step 2: Wait 5 minutes
  await createWorkflowStep({
    workflowId,
    stepOrder: 2,
    stepType: "delay",
    actionType: null,
    delayType: "minutes",
    delayValue: 5,
    config: null,
  });

  // 4. Step 3: Start AI Call
  await createWorkflowStep({
    workflowId,
    stepOrder: 3,
    stepType: "action",
    actionType: "start_ai_call",
    delayType: null,
    delayValue: null,
    config: JSON.stringify({
      note: "VAPI will use the Facebook lead assistant (VAPI_AGENT_ID) to call the lead.",
    }),
  });

  console.log(
    `[Workflow Templates] Provisioned "Facebook Lead Follow-Up" workflow (id=${workflowId}) for account ${accountId}`
  );

  return { workflowId, alreadyExists: false };
}

/**
 * List of all available workflow templates.
 * Used by the UI to show a "Templates" menu.
 */
export const WORKFLOW_TEMPLATES = [
  {
    id: "facebook_lead_followup",
    name: "Facebook Lead Follow-Up",
    description:
      "Sends a welcome SMS immediately, waits 5 minutes, then starts an AI call via VAPI.",
    triggerType: "facebook_lead_received" as const,
    steps: [
      { type: "action", action: "send_sms", label: "Send welcome SMS" },
      { type: "delay", delay: "5 minutes", label: "Wait 5 minutes" },
      { type: "action", action: "start_ai_call", label: "Start AI Call (VAPI)" },
    ],
  },
];
