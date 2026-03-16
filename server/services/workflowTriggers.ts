import { getActiveWorkflowsByTrigger } from "../db";
import { triggerWorkflow } from "./workflowEngine";

// ─────────────────────────────────────────────
// Workflow Trigger Service
// Called from existing modules to fire matching workflows
// ─────────────────────────────────────────────

/**
 * Fire when a new contact is created.
 * Matches workflows with triggerType = "contact_created"
 */
export async function onContactCreated(accountId: number, contactId: number) {
  try {
    const workflows = await getActiveWorkflowsByTrigger(accountId, "contact_created");
    for (const wf of workflows) {
      await triggerWorkflow(wf, contactId, accountId, "contact_created");
    }
    if (workflows.length > 0) {
      console.log(
        `[Triggers] contact_created: fired ${workflows.length} workflow(s) for contact ${contactId}`
      );
    }
  } catch (err) {
    console.error("[Triggers] onContactCreated error:", err);
  }
}

/**
 * Fire when a tag is added to a contact.
 * Matches workflows with triggerType = "tag_added"
 * and triggerConfig.tag matches the added tag.
 */
export async function onTagAdded(accountId: number, contactId: number, tag: string) {
  try {
    const workflows = await getActiveWorkflowsByTrigger(accountId, "tag_added");
    for (const wf of workflows) {
      // Check if the trigger config matches the tag
      const config = wf.triggerConfig ? JSON.parse(wf.triggerConfig) : {};
      if (config.tag && config.tag !== tag) continue; // Skip if tag doesn't match
      await triggerWorkflow(wf, contactId, accountId, `tag_added:${tag}`);
    }
  } catch (err) {
    console.error("[Triggers] onTagAdded error:", err);
  }
}

/**
 * Fire when a contact's pipeline stage (status) changes.
 * Matches workflows with triggerType = "pipeline_stage_changed"
 * and triggerConfig.fromStatus / triggerConfig.toStatus match.
 */
export async function onPipelineStageChanged(
  accountId: number,
  contactId: number,
  fromStatus: string,
  toStatus: string
) {
  try {
    const workflows = await getActiveWorkflowsByTrigger(accountId, "pipeline_stage_changed");
    for (const wf of workflows) {
      const config = wf.triggerConfig ? JSON.parse(wf.triggerConfig) : {};
      // If config specifies a toStatus, only fire if it matches
      if (config.toStatus && config.toStatus !== toStatus) continue;
      // If config specifies a fromStatus, only fire if it matches
      if (config.fromStatus && config.fromStatus !== fromStatus) continue;
      await triggerWorkflow(
        wf,
        contactId,
        accountId,
        `pipeline_stage_changed:${fromStatus}->${toStatus}`
      );
    }
  } catch (err) {
    console.error("[Triggers] onPipelineStageChanged error:", err);
  }
}

/**
 * Fire when a Facebook lead is received.
 * Matches workflows with triggerType = "facebook_lead_received"
 */
export async function onFacebookLeadReceived(accountId: number, contactId: number) {
  try {
    const workflows = await getActiveWorkflowsByTrigger(accountId, "facebook_lead_received");
    for (const wf of workflows) {
      await triggerWorkflow(wf, contactId, accountId, "facebook_lead_received");
    }
    if (workflows.length > 0) {
      console.log(
        `[Triggers] facebook_lead_received: fired ${workflows.length} workflow(s) for contact ${contactId}`
      );
    }
  } catch (err) {
    console.error("[Triggers] onFacebookLeadReceived error:", err);
  }
}

/**
 * Fire when an AI call is completed (ended via VAPI webhook or sync).
 * Matches workflows with triggerType = "call_completed"
 */
export async function onCallCompleted(accountId: number, contactId: number) {
  try {
    const workflows = await getActiveWorkflowsByTrigger(accountId, "call_completed");
    for (const wf of workflows) {
      await triggerWorkflow(wf, contactId, accountId, "call_completed");
    }
    if (workflows.length > 0) {
      console.log(
        `[Triggers] call_completed: fired ${workflows.length} workflow(s) for contact ${contactId}`
      );
    }
  } catch (err) {
    console.error("[Triggers] onCallCompleted error:", err);
  }
}
