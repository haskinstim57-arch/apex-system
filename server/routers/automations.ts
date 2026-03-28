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
} from "../db";

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
]);

const actionTypeEnum = z.enum([
  "send_sms",
  "send_email",
  "start_ai_call",
  "add_tag",
  "remove_tag",
  "update_contact_field",
  "create_task",
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
});
