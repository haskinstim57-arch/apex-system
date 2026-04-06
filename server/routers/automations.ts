import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure } from "../_core/trpc";
import {
  createWorkflow,
  listWorkflows,
  getWorkflowById,
  updateWorkflow,
  deleteWorkflow,
  createWorkflowStep,
  listWorkflowSteps,
  updateWorkflowStep,
  deleteWorkflowStep,
  getWorkflowStepById,
  listWorkflowExecutions,
  listAccountExecutions,
  getWorkflowExecutionById,
  listWorkflowExecutionSteps,
  updateWorkflowExecution,
  getMember,
  createAuditLog,
  logContactActivity,
  getExecutionStats,
  getExecutionHistoryWithWorkflow,
  createContact,
} from "../db";
import { onFacebookLeadReceived } from "../services/workflowTriggers";

// ─── Tenant guard ───
async function requireAccountMember(userId: number, accountId: number, userRole?: string) {
  if (userRole === "admin") {
    const member = await getMember(accountId, userId);
    if (member) return member;
    return { userId, accountId, role: "owner" as const, isActive: true };
  }
  const member = await getMember(accountId, userId);
  if (!member || !member.isActive) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "You do not have access to this account",
    });
  }
  return member;
}

// ─── Zod schemas ───
const triggerTypeEnum = z.enum([
  "contact_created",
  "tag_added",
  "pipeline_stage_changed",
  "facebook_lead_received",
  "manual",
  "inbound_message_received",
  "appointment_booked",
  "appointment_cancelled",
  "call_completed",
  "missed_call",
  "form_submitted",
  "date_trigger",
  "score_changed",
]);

const actionTypeEnum = z.enum([
  "send_sms",
  "send_email",
  "start_ai_call",
  "add_tag",
  "remove_tag",
  "update_contact_field",
  "create_task",
  "add_to_campaign",
  "assign_pipeline_stage",
  "notify_user",
  "send_review_request",
  "enroll_in_sequence",
]);

const delayTypeEnum = z.enum(["minutes", "hours", "days"]);

const conditionOperatorEnum = z.enum([
  "equals",
  "not_equals",
  "contains",
  "not_contains",
  "greater_than",
  "less_than",
  "is_empty",
  "is_not_empty",
  "exists",
  "not_exists",
  "starts_with",
  "ends_with",
]);

const conditionConfigSchema = z.object({
  field: z.string().min(1),
  operator: conditionOperatorEnum,
  value: z.string().optional().default(""),
  trueBranchStepOrder: z.number().int().positive().optional(),
  falseBranchStepOrder: z.number().int().positive().optional(),
});

export const automationsRouter = router({
  // ─── Create workflow ───
  create: protectedProcedure
    .input(
      z.object({
        accountId: z.number().int().positive(),
        name: z.string().min(1).max(255),
        description: z.string().optional(),
        triggerType: triggerTypeEnum,
        triggerConfig: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await requireAccountMember(ctx.user.id, input.accountId, ctx.user.role);
      const { id } = await createWorkflow({
        ...input,
        triggerConfig: input.triggerConfig ?? null,
        description: input.description ?? null,
        createdById: ctx.user.id,
      });
      await createAuditLog({
        accountId: input.accountId,
        userId: ctx.user.id,
        action: "workflow.created",
        resourceType: "workflow",
        resourceId: id,
      });
      return { id };
    }),

  // ─── List workflows ───
  list: protectedProcedure
    .input(z.object({ accountId: z.number().int().positive() }))
    .query(async ({ ctx, input }) => {
      await requireAccountMember(ctx.user.id, input.accountId, ctx.user.role);
      return listWorkflows(input.accountId);
    }),

  // ─── Get single workflow with steps ───
  get: protectedProcedure
    .input(
      z.object({
        id: z.number().int().positive(),
        accountId: z.number().int().positive(),
      })
    )
    .query(async ({ ctx, input }) => {
      await requireAccountMember(ctx.user.id, input.accountId, ctx.user.role);
      const workflow = await getWorkflowById(input.id, input.accountId);
      if (!workflow) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Workflow not found" });
      }
      const steps = await listWorkflowSteps(input.id);
      return { ...workflow, steps };
    }),

  // ─── Update workflow ───
  update: protectedProcedure
    .input(
      z.object({
        id: z.number().int().positive(),
        accountId: z.number().int().positive(),
        name: z.string().min(1).max(255).optional(),
        description: z.string().optional().nullable(),
        triggerType: triggerTypeEnum.optional(),
        triggerConfig: z.string().optional().nullable(),
        isActive: z.boolean().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await requireAccountMember(ctx.user.id, input.accountId, ctx.user.role);
      const existing = await getWorkflowById(input.id, input.accountId);
      if (!existing) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Workflow not found" });
      }
      const { id, accountId, ...updateData } = input;
      const cleanData: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(updateData)) {
        if (value !== undefined) cleanData[key] = value;
      }
      if (Object.keys(cleanData).length > 0) {
        await updateWorkflow(id, accountId, cleanData as any);
      }
      await createAuditLog({
        accountId,
        userId: ctx.user.id,
        action: "workflow.updated",
        resourceType: "workflow",
        resourceId: id,
      });
      return { success: true };
    }),

  // ─── Delete workflow ───
  delete: protectedProcedure
    .input(
      z.object({
        id: z.number().int().positive(),
        accountId: z.number().int().positive(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await requireAccountMember(ctx.user.id, input.accountId, ctx.user.role);
      const existing = await getWorkflowById(input.id, input.accountId);
      if (!existing) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Workflow not found" });
      }
      await deleteWorkflow(input.id, input.accountId);
      await createAuditLog({
        accountId: input.accountId,
        userId: ctx.user.id,
        action: "workflow.deleted",
        resourceType: "workflow",
        resourceId: input.id,
      });
      return { success: true };
    }),

  // ─── Toggle workflow active/inactive ───
  toggle: protectedProcedure
    .input(
      z.object({
        id: z.number().int().positive(),
        accountId: z.number().int().positive(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await requireAccountMember(ctx.user.id, input.accountId, ctx.user.role);
      const existing = await getWorkflowById(input.id, input.accountId);
      if (!existing) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Workflow not found" });
      }
      // Must have at least one step to activate
      if (!existing.isActive) {
        const steps = await listWorkflowSteps(input.id);
        if (steps.length === 0) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Cannot activate a workflow with no steps",
          });
        }
      }
      await updateWorkflow(input.id, input.accountId, {
        isActive: !existing.isActive,
      });
      return { isActive: !existing.isActive };
    }),

  // ═══════════════════════════════════════════
  // STEPS
  // ═══════════════════════════════════════════

  // ─── Add step to workflow ───
  addStep: protectedProcedure
    .input(
      z.object({
        accountId: z.number().int().positive(),
        workflowId: z.number().int().positive(),
        stepType: z.enum(["action", "delay", "condition"]),
        actionType: actionTypeEnum.optional(),
        delayType: delayTypeEnum.optional(),
        delayValue: z.number().int().positive().optional(),
        config: z.string().optional(),
        conditionConfig: z.string().optional(),
        nextStepId: z.number().int().positive().optional().nullable(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await requireAccountMember(ctx.user.id, input.accountId, ctx.user.role);
      const workflow = await getWorkflowById(input.workflowId, input.accountId);
      if (!workflow) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Workflow not found" });
      }

      // Validate step type requirements
      if (input.stepType === "action" && !input.actionType) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Action type is required for action steps",
        });
      }
      if (input.stepType === "delay" && (!input.delayType || !input.delayValue)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Delay type and value are required for delay steps",
        });
      }
      if (input.stepType === "condition") {
        if (!input.conditionConfig) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Condition config is required for condition steps",
          });
        }
        try {
          const parsed = JSON.parse(input.conditionConfig);
          conditionConfigSchema.parse(parsed);
        } catch (e) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Invalid condition config: must include field and operator",
          });
        }
      }

      // Get next step order
      const existingSteps = await listWorkflowSteps(input.workflowId);
      const nextOrder = existingSteps.length + 1;

      const { id } = await createWorkflowStep({
        workflowId: input.workflowId,
        stepOrder: nextOrder,
        stepType: input.stepType,
        actionType: input.stepType === "action" ? input.actionType! : null,
        delayType: input.stepType === "delay" ? input.delayType! : null,
        delayValue: input.stepType === "delay" ? input.delayValue! : null,
        config: input.config ?? null,
        conditionConfig: input.stepType === "condition" ? (input.conditionConfig ?? null) : null,
        nextStepId: input.nextStepId ?? null,
      });

      return { id, stepOrder: nextOrder };
    }),

  // ─── Update step ───
  updateStep: protectedProcedure
    .input(
      z.object({
        accountId: z.number().int().positive(),
        workflowId: z.number().int().positive(),
        stepId: z.number().int().positive(),
        stepType: z.enum(["action", "delay", "condition"]).optional(),
        actionType: actionTypeEnum.optional().nullable(),
        delayType: delayTypeEnum.optional().nullable(),
        delayValue: z.number().int().positive().optional().nullable(),
        config: z.string().optional().nullable(),
        conditionConfig: z.string().optional().nullable(),
        nextStepId: z.number().int().positive().optional().nullable(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await requireAccountMember(ctx.user.id, input.accountId, ctx.user.role);
      const workflow = await getWorkflowById(input.workflowId, input.accountId);
      if (!workflow) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Workflow not found" });
      }
      const step = await getWorkflowStepById(input.stepId);
      if (!step || step.workflowId !== input.workflowId) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Step not found" });
      }
      const { accountId, workflowId, stepId, ...updateData } = input;
      const cleanData: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(updateData)) {
        if (value !== undefined) cleanData[key] = value;
      }
      if (Object.keys(cleanData).length > 0) {
        await updateWorkflowStep(stepId, cleanData as any);
      }
      return { success: true };
    }),

  // ─── Delete step ───
  deleteStep: protectedProcedure
    .input(
      z.object({
        accountId: z.number().int().positive(),
        workflowId: z.number().int().positive(),
        stepId: z.number().int().positive(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await requireAccountMember(ctx.user.id, input.accountId, ctx.user.role);
      const workflow = await getWorkflowById(input.workflowId, input.accountId);
      if (!workflow) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Workflow not found" });
      }
      const step = await getWorkflowStepById(input.stepId);
      if (!step || step.workflowId !== input.workflowId) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Step not found" });
      }

      await deleteWorkflowStep(input.stepId);

      // Reorder remaining steps
      const remaining = await listWorkflowSteps(input.workflowId);
      for (let i = 0; i < remaining.length; i++) {
        if (remaining[i].stepOrder !== i + 1) {
          await updateWorkflowStep(remaining[i].id, { stepOrder: i + 1 });
        }
      }

      return { success: true };
    }),

  // ─── Reorder steps ───
  reorderSteps: protectedProcedure
    .input(
      z.object({
        accountId: z.number().int().positive(),
        workflowId: z.number().int().positive(),
        stepIds: z.array(z.number().int().positive()),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await requireAccountMember(ctx.user.id, input.accountId, ctx.user.role);
      const workflow = await getWorkflowById(input.workflowId, input.accountId);
      if (!workflow) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Workflow not found" });
      }
      for (let i = 0; i < input.stepIds.length; i++) {
        await updateWorkflowStep(input.stepIds[i], { stepOrder: i + 1 });
      }
      return { success: true };
    }),

  // ═══════════════════════════════════════════
  // EXECUTIONS
  // ═══════════════════════════════════════════

  // ─── List executions for a workflow ───
  listExecutions: protectedProcedure
    .input(
      z.object({
        accountId: z.number().int().positive(),
        workflowId: z.number().int().positive(),
        limit: z.number().int().min(1).max(100).optional().default(50),
        offset: z.number().int().min(0).optional().default(0),
      })
    )
    .query(async ({ ctx, input }) => {
      await requireAccountMember(ctx.user.id, input.accountId, ctx.user.role);
      return listWorkflowExecutions(input.workflowId, input.accountId, {
        limit: input.limit,
        offset: input.offset,
      });
    }),

  // ─── List all executions for account (execution logs) ───
  listAllExecutions: protectedProcedure
    .input(
      z.object({
        accountId: z.number().int().positive(),
        status: z.string().optional(),
        limit: z.number().int().min(1).max(100).optional().default(50),
        offset: z.number().int().min(0).optional().default(0),
      })
    )
    .query(async ({ ctx, input }) => {
      await requireAccountMember(ctx.user.id, input.accountId, ctx.user.role);
      return listAccountExecutions(input.accountId, {
        limit: input.limit,
        offset: input.offset,
        status: input.status,
      });
    }),

  // ─── Get execution detail with steps ───
  getExecution: protectedProcedure
    .input(
      z.object({
        accountId: z.number().int().positive(),
        executionId: z.number().int().positive(),
      })
    )
    .query(async ({ ctx, input }) => {
      await requireAccountMember(ctx.user.id, input.accountId, ctx.user.role);
      const execution = await getWorkflowExecutionById(input.executionId);
      if (!execution || execution.accountId !== input.accountId) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Execution not found" });
      }
      const steps = await listWorkflowExecutionSteps(input.executionId);
      return { ...execution, steps };
    }),

  // ─── Cancel a running execution ───
  cancelExecution: protectedProcedure
    .input(
      z.object({
        accountId: z.number().int().positive(),
        executionId: z.number().int().positive(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await requireAccountMember(ctx.user.id, input.accountId, ctx.user.role);
      const execution = await getWorkflowExecutionById(input.executionId);
      if (!execution || execution.accountId !== input.accountId) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Execution not found" });
      }
      if (execution.status !== "running") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Can only cancel running executions",
        });
      }
      await updateWorkflowExecution(input.executionId, {
        status: "cancelled",
        completedAt: new Date(),
      });
      return { success: true };
    }),

  // ─── Manually trigger a workflow for a contact ───
  triggerManual: protectedProcedure
    .input(
      z.object({
        accountId: z.number().int().positive(),
        workflowId: z.number().int().positive(),
        contactId: z.number().int().positive(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await requireAccountMember(ctx.user.id, input.accountId, ctx.user.role);
      const workflow = await getWorkflowById(input.workflowId, input.accountId);
      if (!workflow) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Workflow not found" });
      }
      if (workflow.triggerType !== "manual") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "This workflow does not support manual triggering",
        });
      }

      // Import and use the execution engine
      const { triggerWorkflow } = await import("../services/workflowEngine");
      const executionId = await triggerWorkflow(
        workflow,
        input.contactId,
        input.accountId,
        "manual"
      );

      // Log activity
      logContactActivity({
        contactId: input.contactId,
        accountId: input.accountId,
        activityType: "automation_triggered",
        description: `Workflow "${workflow.name}" triggered manually`,
        metadata: JSON.stringify({ workflowId: workflow.id, workflowName: workflow.name, triggerType: "manual", executionId }),
      });

      return { executionId };
    }),

  // ═══════════════════════════════════════════
  // TEMPLATES
  // ═══════════════════════════════════════════

  // ─── List available templates ───
  listTemplates: protectedProcedure.query(async () => {
    const { WORKFLOW_TEMPLATES } = await import("../services/workflowTemplates");
    return WORKFLOW_TEMPLATES;
  }),

  // ─── Provision a template workflow ───
  provisionTemplate: protectedProcedure
    .input(
      z.object({
        accountId: z.number().int().positive(),
        templateId: z.string().min(1),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await requireAccountMember(ctx.user.id, input.accountId, ctx.user.role);

      if (input.templateId === "facebook_lead_followup") {
        const { provisionFacebookLeadFollowUp } = await import(
          "../services/workflowTemplates"
        );
        const result = await provisionFacebookLeadFollowUp(
          input.accountId,
          ctx.user.id
        );
        if (result.alreadyExists) {
          throw new TRPCError({
            code: "CONFLICT",
            message:
              "A Facebook Lead Follow-Up workflow already exists for this account",
          });
        }
        return { workflowId: result.workflowId };
      }

      throw new TRPCError({
        code: "NOT_FOUND",
        message: `Unknown template: ${input.templateId}`,
      });
    }),

  // ═══════════════════════════════════════════
  // EXECUTION HISTORY DASHBOARD
  // ═══════════════════════════════════════════

  // ─── Get execution stats (aggregated counts, success rate, by trigger) ───
  executionStats: protectedProcedure
    .input(z.object({ accountId: z.number().int().positive() }))
    .query(async ({ ctx, input }) => {
      await requireAccountMember(ctx.user.id, input.accountId, ctx.user.role);
      return getExecutionStats(input.accountId);
    }),

  // ─── Get execution history with workflow names (for dashboard table) ───
  executionHistory: protectedProcedure
    .input(
      z.object({
        accountId: z.number().int().positive(),
        status: z.string().optional(),
        workflowId: z.number().int().positive().optional(),
        limit: z.number().int().min(1).max(100).optional().default(50),
        offset: z.number().int().min(0).optional().default(0),
      })
    )
    .query(async ({ ctx, input }) => {
      await requireAccountMember(ctx.user.id, input.accountId, ctx.user.role);
      return getExecutionHistoryWithWorkflow(input.accountId, {
        limit: input.limit,
        offset: input.offset,
        status: input.status,
        workflowId: input.workflowId,
      });
    }),

  /**
   * Admin-only: Install a pre-built workflow template for an account.
   * Currently supports: "facebook_lead_pmr" — full Facebook lead routing
   * with tagging, task creation, human notification during hours, AI calling after hours.
   */
  installPresetWorkflow: protectedProcedure
    .input(
      z.object({
        accountId: z.number().int().positive(),
        preset: z.enum(["facebook_lead_pmr", "webinar_registration", "appointment_no_show"]),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin") {
        throw new TRPCError({ code: "FORBIDDEN", message: "Admin access required" });
      }

      await requireAccountMember(ctx.user.id, input.accountId, ctx.user.role);

      if (input.preset === "facebook_lead_pmr") {
        // Create the workflow
        const { id: workflowId } = await createWorkflow({
          accountId: input.accountId,
          name: "Facebook Lead \u2014 PMR Auto-Router",
          description:
            "Tags incoming Facebook leads, notifies the team, creates a call task, then routes to AI calling after hours or ends for human follow-up during business hours.",
          triggerType: "facebook_lead_received",
          triggerConfig: null,
          createdById: ctx.user.id,
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
            title: "Call {{firstName}} {{lastName}} \u2014 New Facebook Lead",
            description: "Phone: {{phone}}\nEmail: {{email}}\n\nNew lead from Facebook. Call within 5 minutes.",
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
            message: "New Facebook lead: {{firstName}} {{lastName}} \u2014 {{phone}}. Call now!",
            notifyAll: true,
          }),
          conditionConfig: null,
          delayConfig: null,
        });

        // Step 5: Branch on business hours
        // TRUE (during hours) \u2192 step 99 (doesn't exist) \u2192 workflow ends, human handles it
        // FALSE (after hours) \u2192 step 6 \u2192 AI calls
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

        return {
          success: true,
          workflowId,
          message: "PMR Facebook Lead workflow installed. Activate it in Automations when ready.",
        };
      }

      // ─── Webinar Registration Preset ───
      if (input.preset === "webinar_registration") {
        const { id: workflowId } = await createWorkflow({
          accountId: input.accountId,
          name: "Webinar Registration Follow-Up",
          triggerType: "form_submitted",
          isActive: false,
          createdById: ctx.user.id,
        });

        // Step 1: Tag as webinar_registrant
        await createWorkflowStep({
          workflowId,
          stepType: "action",
          stepOrder: 1,
          name: "Tag: webinar_registrant",
          actionConfig: JSON.stringify({ action: "add_tag", tag: "webinar_registrant" }),
          conditionConfig: null,
          delayConfig: null,
        });

        // Step 2: Send confirmation email
        await createWorkflowStep({
          workflowId,
          stepType: "action",
          stepOrder: 2,
          name: "Send confirmation email",
          actionConfig: JSON.stringify({
            action: "send_email",
            subject: "You're registered! Webinar details inside",
            body: "Hi {{firstName}},\n\nYou're confirmed for the upcoming webinar. We'll send you a reminder before it starts.\n\nLooking forward to seeing you there!",
          }),
          conditionConfig: null,
          delayConfig: null,
        });

        // Step 3: Notify the team
        await createWorkflowStep({
          workflowId,
          stepType: "action",
          stepOrder: 3,
          name: "Notify team",
          actionConfig: JSON.stringify({
            action: "notify_user",
            message: "New webinar registration: {{firstName}} {{lastName}} — {{email}}",
            notifyAll: true,
          }),
          conditionConfig: null,
          delayConfig: null,
        });

        // Step 4: Wait 1 hour then send SMS reminder
        await createWorkflowStep({
          workflowId,
          stepType: "delay",
          stepOrder: 4,
          name: "Wait 1 hour",
          delayConfig: JSON.stringify({ delayMinutes: 60 }),
          actionConfig: null,
          conditionConfig: null,
        });

        // Step 5: Send SMS reminder
        await createWorkflowStep({
          workflowId,
          stepType: "action",
          stepOrder: 5,
          name: "Send SMS reminder",
          actionConfig: JSON.stringify({
            action: "send_sms",
            body: "Hi {{firstName}}, just confirming your webinar registration! Save the date — we'll send a link before the event. Reply STOP to opt out.",
          }),
          conditionConfig: null,
          delayConfig: null,
        });

        // Step 6: Create follow-up task
        await createWorkflowStep({
          workflowId,
          stepType: "action",
          stepOrder: 6,
          name: "Create follow-up task",
          actionConfig: JSON.stringify({
            action: "create_task",
            title: "Follow up with {{firstName}} {{lastName}} after webinar",
            description: "Webinar registrant. Follow up post-event to gauge interest and schedule a consultation.",
            priority: "medium",
            dueDateOffsetMinutes: 1440, // 24 hours
          }),
          conditionConfig: null,
          delayConfig: null,
        });

        return {
          success: true,
          workflowId,
          message: "Webinar Registration workflow installed. Activate it in Automations when ready.",
        };
      }

      // ─── Appointment No-Show Preset ───
      if (input.preset === "appointment_no_show") {
        const { id: workflowId } = await createWorkflow({
          accountId: input.accountId,
          name: "Appointment No-Show Re-Engagement",
          triggerType: "appointment_cancelled",
          isActive: false,
          createdById: ctx.user.id,
        });

        // Step 1: Tag as no_show
        await createWorkflowStep({
          workflowId,
          stepType: "action",
          stepOrder: 1,
          name: "Tag: no_show",
          actionConfig: JSON.stringify({ action: "add_tag", tag: "no_show" }),
          conditionConfig: null,
          delayConfig: null,
        });

        // Step 2: Notify the team
        await createWorkflowStep({
          workflowId,
          stepType: "action",
          stepOrder: 2,
          name: "Notify team",
          actionConfig: JSON.stringify({
            action: "notify_user",
            message: "Appointment no-show: {{firstName}} {{lastName}} — {{phone}}. Re-engagement needed.",
            notifyAll: true,
          }),
          conditionConfig: null,
          delayConfig: null,
        });

        // Step 3: Wait 30 minutes
        await createWorkflowStep({
          workflowId,
          stepType: "delay",
          stepOrder: 3,
          name: "Wait 30 minutes",
          delayConfig: JSON.stringify({ delayMinutes: 30 }),
          actionConfig: null,
          conditionConfig: null,
        });

        // Step 4: Send re-engagement SMS
        await createWorkflowStep({
          workflowId,
          stepType: "action",
          stepOrder: 4,
          name: "Send re-engagement SMS",
          actionConfig: JSON.stringify({
            action: "send_sms",
            body: "Hi {{firstName}}, we noticed you missed your appointment. No worries! Would you like to reschedule? Reply YES and we'll get you set up. Reply STOP to opt out.",
          }),
          conditionConfig: null,
          delayConfig: null,
        });

        // Step 5: Wait 24 hours
        await createWorkflowStep({
          workflowId,
          stepType: "delay",
          stepOrder: 5,
          name: "Wait 24 hours",
          delayConfig: JSON.stringify({ delayMinutes: 1440 }),
          actionConfig: null,
          conditionConfig: null,
        });

        // Step 6: Send follow-up email
        await createWorkflowStep({
          workflowId,
          stepType: "action",
          stepOrder: 6,
          name: "Send follow-up email",
          actionConfig: JSON.stringify({
            action: "send_email",
            subject: "We missed you — let's reschedule",
            body: "Hi {{firstName}},\n\nWe're sorry we missed you at your appointment. Life gets busy — we totally understand!\n\nWe'd love to help you get back on track. Click below to reschedule at a time that works for you.\n\nLooking forward to connecting!",
          }),
          conditionConfig: null,
          delayConfig: null,
        });

        // Step 7: Create re-engagement task
        await createWorkflowStep({
          workflowId,
          stepType: "action",
          stepOrder: 7,
          name: "Create re-engagement task",
          actionConfig: JSON.stringify({
            action: "create_task",
            title: "Re-engage {{firstName}} {{lastName}} — Appointment No-Show",
            description: "Contact missed their appointment. SMS and email sent. Follow up with a personal call to reschedule.",
            priority: "high",
            dueDateOffsetMinutes: 2880, // 48 hours
          }),
          conditionConfig: null,
          delayConfig: null,
        });

        // Step 8: Branch on business hours for AI call
        await createWorkflowStep({
          workflowId,
          stepType: "condition",
          stepOrder: 8,
          name: "Is it business hours?",
          conditionConfig: JSON.stringify({
            field: "business_hours",
            operator: "equals",
            value: "true",
            trueBranchStepOrder: 9,
            falseBranchStepOrder: 99,
          }),
          actionConfig: null,
          delayConfig: null,
        });

        // Step 9: AI call during business hours
        await createWorkflowStep({
          workflowId,
          stepType: "action",
          stepOrder: 9,
          name: "AI call to reschedule",
          actionConfig: JSON.stringify({
            action: "start_ai_call",
            skipBusinessHoursCheck: true,
          }),
          conditionConfig: null,
          delayConfig: null,
        });

        return {
          success: true,
          workflowId,
          message: "Appointment No-Show workflow installed. Activate it in Automations when ready.",
        };
      }

      throw new TRPCError({ code: "BAD_REQUEST", message: "Unknown preset" });
    }),

  /**
   * Admin-only: Simulate a test Facebook lead to verify the PMR workflow fires correctly.
   * Creates a fake contact and triggers the facebook_lead_received event.
   */
  simulateTestLead: protectedProcedure
    .input(
      z.object({
        accountId: z.number().int().positive(),
        firstName: z.string().optional().default("Test"),
        lastName: z.string().optional().default("Lead"),
        email: z.string().optional().default("testlead@example.com"),
        phone: z.string().optional().default("+15555550199"),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin") {
        throw new TRPCError({ code: "FORBIDDEN", message: "Admin access required" });
      }
      await requireAccountMember(ctx.user.id, input.accountId, ctx.user.role);

      // Create a test contact
      const { id: contactId } = await createContact({
        accountId: input.accountId,
        firstName: input.firstName,
        lastName: input.lastName,
        email: input.email,
        phone: input.phone,
        leadSource: "facebook",
        status: "new",
        customFields: JSON.stringify({
          fb_lead_id: `test_${Date.now()}`,
          fb_campaign_id: "test_campaign",
          fb_form_id: "test_form",
          fb_form_loan_type: "Conventional",
          fb_form_property_state: "California",
        }),
      });

      // Fire the facebook_lead_received trigger
      await onFacebookLeadReceived(input.accountId, contactId);

      await logContactActivity({
        contactId,
        accountId: input.accountId,
        type: "workflow_triggered",
        description: "Simulated Facebook lead — triggered PMR workflow for testing",
        performedById: ctx.user.id,
      });

      return {
        success: true,
        contactId,
        message: `Test lead created (ID: ${contactId}) and facebook_lead_received trigger fired. Check workflow execution logs.`,
      };
    }),
});
