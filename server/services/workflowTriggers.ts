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

/**
 * Fire when an inbound message (SMS or email) is received.
 * Matches workflows with triggerType = "inbound_message_received"
 * Optionally filters by channel ("sms" | "email") via triggerConfig.channel
 */
export async function onInboundMessageReceived(
  accountId: number,
  contactId: number,
  channel: "sms" | "email"
) {
  try {
    const workflows = await getActiveWorkflowsByTrigger(accountId, "inbound_message_received");
    for (const wf of workflows) {
      const config = wf.triggerConfig ? JSON.parse(wf.triggerConfig) : {};
      if (config.channel && config.channel !== channel) continue;
      await triggerWorkflow(wf, contactId, accountId, `inbound_message_received:${channel}`);
    }
    if (workflows.length > 0) {
      console.log(
        `[Triggers] inbound_message_received(${channel}): fired ${workflows.length} workflow(s) for contact ${contactId}`
      );
    }
  } catch (err) {
    console.error("[Triggers] onInboundMessageReceived error:", err);
  }
}

/**
 * Fire when an appointment is booked.
 * Matches workflows with triggerType = "appointment_booked"
 * Optionally filters by calendarId via triggerConfig.calendarId
 */
export async function onAppointmentBooked(
  accountId: number,
  contactId: number,
  appointmentId: number,
  calendarId: number
) {
  try {
    const workflows = await getActiveWorkflowsByTrigger(accountId, "appointment_booked");
    for (const wf of workflows) {
      const config = wf.triggerConfig ? JSON.parse(wf.triggerConfig) : {};
      if (config.calendarId && Number(config.calendarId) !== calendarId) continue;
      await triggerWorkflow(wf, contactId, accountId, `appointment_booked:${appointmentId}`);
    }
    if (workflows.length > 0) {
      console.log(
        `[Triggers] appointment_booked: fired ${workflows.length} workflow(s) for contact ${contactId}, appt ${appointmentId}`
      );
    }
  } catch (err) {
    console.error("[Triggers] onAppointmentBooked error:", err);
  }
}

/**
 * Fire when an appointment is cancelled.
 * Matches workflows with triggerType = "appointment_cancelled"
 */
export async function onAppointmentCancelled(
  accountId: number,
  contactId: number,
  appointmentId: number
) {
  try {
    const workflows = await getActiveWorkflowsByTrigger(accountId, "appointment_cancelled");
    for (const wf of workflows) {
      await triggerWorkflow(wf, contactId, accountId, `appointment_cancelled:${appointmentId}`);
    }
    if (workflows.length > 0) {
      console.log(
        `[Triggers] appointment_cancelled: fired ${workflows.length} workflow(s) for contact ${contactId}, appt ${appointmentId}`
      );
    }
  } catch (err) {
    console.error("[Triggers] onAppointmentCancelled error:", err);
  }
}

/**
 * Fire when a call is missed (no answer / busy / failed).
 * Matches workflows with triggerType = "missed_call"
 */
export async function onMissedCall(accountId: number, contactId: number) {
  try {
    const workflows = await getActiveWorkflowsByTrigger(accountId, "missed_call");
    for (const wf of workflows) {
      await triggerWorkflow(wf, contactId, accountId, "missed_call");
    }
    if (workflows.length > 0) {
      console.log(
        `[Triggers] missed_call: fired ${workflows.length} workflow(s) for contact ${contactId}`
      );
    }
  } catch (err) {
    console.error("[Triggers] onMissedCall error:", err);
  }
}

/**
 * Fire when a form is submitted (Facebook lead form, landing page, etc.).
 * Matches workflows with triggerType = "form_submitted"
 * Optionally filters by formId via triggerConfig.formId
 */
export async function onFormSubmitted(
  accountId: number,
  contactId: number,
  formId?: string
) {
  try {
    const workflows = await getActiveWorkflowsByTrigger(accountId, "form_submitted");
    for (const wf of workflows) {
      const config = wf.triggerConfig ? JSON.parse(wf.triggerConfig) : {};
      if (config.formId && formId && config.formId !== formId) continue;
      await triggerWorkflow(wf, contactId, accountId, `form_submitted${formId ? `:${formId}` : ""}`);
    }
    if (workflows.length > 0) {
      console.log(
        `[Triggers] form_submitted: fired ${workflows.length} workflow(s) for contact ${contactId}`
      );
    }
  } catch (err) {
    console.error("[Triggers] onFormSubmitted error:", err);
  }
}

/**
 * Fire for date-based triggers (e.g., contact created X days ago).
 * Matches workflows with triggerType = "date_trigger"
 * Filters by triggerConfig.field matching the matchedField parameter.
 * This is typically called by a scheduled cron job that scans contacts.
 */
export async function onDateTriggerCheck(
  accountId: number,
  contactId: number,
  matchedField: string
) {
  try {
    const workflows = await getActiveWorkflowsByTrigger(accountId, "date_trigger");
    for (const wf of workflows) {
      const config = wf.triggerConfig ? JSON.parse(wf.triggerConfig) : {};
      if (config.field && config.field !== matchedField) continue;
      await triggerWorkflow(wf, contactId, accountId, `date_trigger:${matchedField}`);
    }
    if (workflows.length > 0) {
      console.log(
        `[Triggers] date_trigger(${matchedField}): fired ${workflows.length} workflow(s) for contact ${contactId}`
      );
    }
  } catch (err) {
    console.error("[Triggers] onDateTriggerCheck error:", err);
  }
}
