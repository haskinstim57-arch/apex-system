import {
  getWorkflowById,
  listWorkflowSteps,
  createWorkflowExecution,
  updateWorkflowExecution,
  createWorkflowExecutionStep,
  updateWorkflowExecutionStep,
  getPendingExecutions,
  updateWorkflow,
  getContactById,
  createMessage,
  createAICall,
  updateContact,
  createTask,
} from "../db";
import type { Workflow, WorkflowStep } from "../../drizzle/schema";
import { createVapiCall, resolveAssistantId } from "./vapi";

// ─────────────────────────────────────────────
// Workflow Execution Engine
// Processes workflow steps sequentially with delay support
// ─────────────────────────────────────────────

const POLL_INTERVAL_MS = 15_000; // 15 seconds
let pollingTimer: ReturnType<typeof setInterval> | null = null;

/** Start the background worker that polls for pending executions */
export function startWorkflowWorker() {
  if (pollingTimer) return;
  console.log("[WorkflowEngine] Starting background worker");
  pollingTimer = setInterval(async () => {
    try {
      await processPendingExecutions();
    } catch (err) {
      console.error("[WorkflowEngine] Worker error:", err);
    }
  }, POLL_INTERVAL_MS);
  // Run once immediately
  processPendingExecutions().catch((err) =>
    console.error("[WorkflowEngine] Initial run error:", err)
  );
}

/** Stop the background worker */
export function stopWorkflowWorker() {
  if (pollingTimer) {
    clearInterval(pollingTimer);
    pollingTimer = null;
    console.log("[WorkflowEngine] Stopped background worker");
  }
}

/** Trigger a workflow for a specific contact */
export async function triggerWorkflow(
  workflow: Workflow,
  contactId: number,
  accountId: number,
  triggeredBy: string
): Promise<number> {
  const steps = await listWorkflowSteps(workflow.id);
  if (steps.length === 0) {
    throw new Error("Workflow has no steps");
  }

  // Create the execution record
  const { id: executionId } = await createWorkflowExecution({
    workflowId: workflow.id,
    accountId,
    contactId,
    status: "running",
    currentStep: 1,
    totalSteps: steps.length,
    triggeredBy,
  });

  // Create execution step records for all steps
  for (const step of steps) {
    await createWorkflowExecutionStep({
      executionId,
      stepId: step.id,
      stepOrder: step.stepOrder,
      stepType: step.stepType,
      actionType: step.actionType,
      status: "pending",
    });
  }

  // Update workflow stats
  await updateWorkflow(workflow.id, accountId, {
    executionCount: (workflow.executionCount ?? 0) + 1,
    lastExecutedAt: new Date(),
  });

  console.log(
    `[WorkflowEngine] Triggered workflow ${workflow.id} for contact ${contactId}, execution ${executionId}`
  );

  // Process the first step immediately (don't wait for polling)
  processExecution(executionId).catch((err) =>
    console.error(`[WorkflowEngine] Immediate processing error for execution ${executionId}:`, err)
  );

  return executionId;
}

/** Process all pending executions that are ready */
async function processPendingExecutions() {
  const pending = await getPendingExecutions();
  if (pending.length === 0) return;

  console.log(`[WorkflowEngine] Processing ${pending.length} pending executions`);

  for (const execution of pending) {
    try {
      await processExecution(execution.id);
    } catch (err) {
      console.error(`[WorkflowEngine] Error processing execution ${execution.id}:`, err);
      await updateWorkflowExecution(execution.id, {
        status: "failed",
        errorMessage: err instanceof Error ? err.message : String(err),
        completedAt: new Date(),
      });
    }
  }
}

/** Process a single execution — execute the current step */
async function processExecution(executionId: number) {
  const { getWorkflowExecutionById, listWorkflowExecutionSteps } = await import("../db");
  const execution = await getWorkflowExecutionById(executionId);
  if (!execution || execution.status !== "running") return;

  // Get the workflow steps
  const steps = await listWorkflowSteps(execution.workflowId);
  const execSteps = await listWorkflowExecutionSteps(executionId);

  const currentStepIndex = execution.currentStep - 1;
  if (currentStepIndex >= steps.length) {
    // All steps completed
    await updateWorkflowExecution(executionId, {
      status: "completed",
      completedAt: new Date(),
    });
    return;
  }

  const step = steps[currentStepIndex];
  const execStep = execSteps.find((es) => es.stepOrder === step.stepOrder);
  if (!execStep) return;

  // Mark step as running
  await updateWorkflowExecutionStep(execStep.id, {
    status: "running",
    startedAt: new Date(),
  });

  try {
    if (step.stepType === "delay") {
      // Calculate when the next step should execute
      const delayMs = calculateDelayMs(step.delayType!, step.delayValue!);
      const nextStepAt = new Date(Date.now() + delayMs);

      await updateWorkflowExecutionStep(execStep.id, {
        status: "completed",
        completedAt: new Date(),
        result: JSON.stringify({ delayType: step.delayType, delayValue: step.delayValue }),
      });

      // Move to next step with a scheduled time
      await updateWorkflowExecution(executionId, {
        currentStep: execution.currentStep + 1,
        nextStepAt,
      });

      console.log(
        `[WorkflowEngine] Execution ${executionId}: delay step completed, next at ${nextStepAt.toISOString()}`
      );
    } else if (step.stepType === "action") {
      // Execute the action
      const result = await executeAction(step, execution.contactId, execution.accountId);

      await updateWorkflowExecutionStep(execStep.id, {
        status: "completed",
        completedAt: new Date(),
        result: JSON.stringify(result),
      });

      // Move to next step immediately
      const nextStep = execution.currentStep + 1;
      if (nextStep > steps.length) {
        await updateWorkflowExecution(executionId, {
          currentStep: nextStep,
          status: "completed",
          completedAt: new Date(),
          nextStepAt: null,
        });
        console.log(`[WorkflowEngine] Execution ${executionId}: all steps completed`);
      } else {
        await updateWorkflowExecution(executionId, {
          currentStep: nextStep,
          nextStepAt: null, // Process immediately
        });
        // Process next step immediately (recursive)
        await processExecution(executionId);
      }
    }
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    await updateWorkflowExecutionStep(execStep.id, {
      status: "failed",
      completedAt: new Date(),
      errorMessage: errorMsg,
    });
    await updateWorkflowExecution(executionId, {
      status: "failed",
      errorMessage: `Step ${step.stepOrder} failed: ${errorMsg}`,
      completedAt: new Date(),
    });
    console.error(`[WorkflowEngine] Execution ${executionId} step ${step.stepOrder} failed:`, err);
  }
}

/** Calculate delay in milliseconds */
function calculateDelayMs(delayType: string, delayValue: number): number {
  switch (delayType) {
    case "minutes":
      return delayValue * 60 * 1000;
    case "hours":
      return delayValue * 60 * 60 * 1000;
    case "days":
      return delayValue * 24 * 60 * 60 * 1000;
    default:
      return delayValue * 60 * 1000; // default to minutes
  }
}

/** Execute a single action step */
async function executeAction(
  step: WorkflowStep,
  contactId: number,
  accountId: number
): Promise<Record<string, unknown>> {
  const config = step.config ? JSON.parse(step.config) : {};
  const contact = await getContactById(contactId, accountId);
  if (!contact) {
    throw new Error(`Contact ${contactId} not found in account ${accountId}`);
  }

  switch (step.actionType) {
    case "send_sms": {
      if (!contact.phone) throw new Error("Contact has no phone number");
      const { id } = await createMessage({
        accountId,
        contactId,
        userId: 0, // system user
        type: "sms",
        direction: "outbound",
        status: "pending",
        body: interpolateTemplate(config.message || "", contact),
        toAddress: contact.phone,
      });
      return { messageId: id, type: "sms", to: contact.phone };
    }

    case "send_email": {
      if (!contact.email) throw new Error("Contact has no email address");
      const { id } = await createMessage({
        accountId,
        contactId,
        userId: 0, // system user
        type: "email",
        direction: "outbound",
        status: "pending",
        subject: interpolateTemplate(config.subject || "", contact),
        body: interpolateTemplate(config.body || "", contact),
        toAddress: contact.email,
      });
      return { messageId: id, type: "email", to: contact.email };
    }

    case "start_ai_call": {
      if (!contact.phone) throw new Error("Contact has no phone number");
      const assistantId = resolveAssistantId(contact.leadSource);
      const { id: callId } = await createAICall({
        accountId,
        contactId,
        initiatedById: 0, // system
        phoneNumber: contact.phone,
        status: "queued",
        direction: "outbound",
        assistantId,
      });
      try {
        const vapiResponse = await createVapiCall({
          phoneNumber: contact.phone,
          customerName: `${contact.firstName} ${contact.lastName}`,
          assistantId,
          metadata: {
            apexAccountId: accountId,
            apexContactId: contactId,
            apexCallId: callId,
            leadSource: contact.leadSource ?? undefined,
          },
        });
        // Update with VAPI external ID
        const { updateAICall } = await import("../db");
        await updateAICall(callId, {
          externalCallId: vapiResponse.id,
          status: "calling",
        });
        return { callId, vapiCallId: vapiResponse.id, status: "calling" };
      } catch (err) {
        const { updateAICall } = await import("../db");
        await updateAICall(callId, {
          status: "failed",
          errorMessage: err instanceof Error ? err.message : String(err),
        });
        throw err;
      }
    }

    case "add_tag": {
      const tag = config.tag;
      if (!tag) throw new Error("No tag specified in step config");
      const { addContactTag } = await import("../db");
      await addContactTag(contactId, tag);
      return { action: "add_tag", tag };
    }

    case "remove_tag": {
      const tag = config.tag;
      if (!tag) throw new Error("No tag specified in step config");
      const { removeContactTag } = await import("../db");
      await removeContactTag(contactId, tag);
      return { action: "remove_tag", tag };
    }

    case "update_contact_field": {
      const { field, value } = config;
      if (!field) throw new Error("No field specified in step config");
      const updateData: Record<string, unknown> = {};
      updateData[field] = value;
      await updateContact(contactId, accountId, updateData as any);
      return { action: "update_contact_field", field, value };
    }

    case "create_task": {
      const { id } = await createTask({
        accountId,
        contactId,
        title: interpolateTemplate(config.title || "Follow up", contact),
        description: interpolateTemplate(config.description || "", contact),
        priority: config.priority || "medium",
        dueAt: config.dueInDays
          ? new Date(Date.now() + config.dueInDays * 24 * 60 * 60 * 1000)
          : null,
        source: "workflow",
      });
      return { taskId: id, action: "create_task" };
    }

    default:
      throw new Error(`Unknown action type: ${step.actionType}`);
  }
}

/** Replace {{firstName}}, {{lastName}}, {{email}}, {{phone}} placeholders */
function interpolateTemplate(
  template: string,
  contact: { firstName: string; lastName: string; email?: string | null; phone?: string | null }
): string {
  return template
    .replace(/\{\{firstName\}\}/g, contact.firstName || "")
    .replace(/\{\{lastName\}\}/g, contact.lastName || "")
    .replace(/\{\{email\}\}/g, contact.email || "")
    .replace(/\{\{phone\}\}/g, contact.phone || "")
    .replace(/\{\{fullName\}\}/g, `${contact.firstName} ${contact.lastName}`.trim());
}
