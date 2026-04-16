import {
  createWorkflow,
  createWorkflowStep,
  listWorkflows,
} from "../db";

/**
 * Auto-seeds the PMR Facebook Lead workflow for a new sub-account.
 * Skips if a workflow with the same name already exists.
 */
export async function seedPmrWorkflow(accountId: number, createdById: number) {
  // Check if already seeded
  const existing = await listWorkflows(accountId);
  const alreadyExists = existing.some(
    (w: any) => w.name === "Facebook Lead — PMR Auto-Router"
  );
  if (alreadyExists) {
    console.log(`[SeedPMR] Workflow already exists for account ${accountId}, skipping.`);
    return null;
  }

  // Create the workflow
  const { id: workflowId } = await createWorkflow({
    accountId,
    name: "Facebook Lead — PMR Auto-Router",
    description:
      "Tags incoming Facebook leads, notifies the team, creates a call task, then routes to AI calling after hours or ends for human follow-up during business hours.",
    triggerType: "facebook_lead_received",
    triggerConfig: null,
    createdById,
  });

  // Step 1: Tag as new_lead
  await createWorkflowStep({
    workflowId,
    stepType: "action",
    stepOrder: 1,
    name: "Tag: new_lead",
    actionConfig: JSON.stringify({ action: "add_tag", tag: "new_lead" }),
    conditionConfig: null,
    delayConfig: null,
  });

  // Step 2: Tag as facebook_lead
  await createWorkflowStep({
    workflowId,
    stepType: "action",
    stepOrder: 2,
    name: "Tag: facebook_lead",
    actionConfig: JSON.stringify({ action: "add_tag", tag: "facebook_lead" }),
    conditionConfig: null,
    delayConfig: null,
  });

  // Step 3: Create urgent call task
  await createWorkflowStep({
    workflowId,
    stepType: "action",
    stepOrder: 3,
    name: "Create call task",
    actionConfig: JSON.stringify({
      action: "create_task",
      title: "Call {{firstName}} {{lastName}} — New Facebook Lead",
      description:
        "Phone: {{phone}}\nEmail: {{email}}\n\nNew lead from Facebook. Call within 5 minutes.",
      priority: "high",
      dueDateOffsetMinutes: 5,
    }),
    conditionConfig: null,
    delayConfig: null,
  });

  // Step 4: Notify the team
  await createWorkflowStep({
    workflowId,
    stepType: "action",
    stepOrder: 4,
    name: "Notify team",
    actionConfig: JSON.stringify({
      action: "notify_user",
      message:
        "New Facebook lead: {{firstName}} {{lastName}} — {{phone}}. Call now!",
      notifyAll: true,
    }),
    conditionConfig: null,
    delayConfig: null,
  });

  // Step 5: Branch on business hours
  await createWorkflowStep({
    workflowId,
    stepType: "condition",
    stepOrder: 5,
    name: "Is it business hours?",
    conditionConfig: JSON.stringify({
      field: "business_hours",
      operator: "equals",
      value: "true",
      trueBranchStepOrder: 99,
      falseBranchStepOrder: 6,
    }),
    actionConfig: null,
    delayConfig: null,
  });

  // Step 6: AI calls after hours
  await createWorkflowStep({
    workflowId,
    stepType: "action",
    stepOrder: 6,
    name: "AI calls (after hours)",
    actionConfig: JSON.stringify({
      action: "start_ai_call",
      skipBusinessHoursCheck: true,
    }),
    conditionConfig: null,
    delayConfig: null,
  });

  console.log(`[SeedPMR] Workflow ${workflowId} created for account ${accountId}`);
  return workflowId;
}
