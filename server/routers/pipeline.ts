import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure } from "../_core/trpc";
import {
  listPipelines,
  getPipelineById,
  getOrCreateDefaultPipeline,
  listPipelineStages,
  listDeals,
  createDeal,
  getDealById,
  getDealByContactId,
  updateDeal,
  deleteDeal,
  getPipelineStageById,
  updatePipelineStage,
  insertPipelineStage,
  deletePipelineStage,
  countDealsByStage,
  getMaxStageSortOrder,
  getContactById,
  getMember,
  logContactActivity,
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

export const pipelineRouter = router({
  // ─── List pipelines for an account ───
  listPipelines: protectedProcedure
    .input(z.object({ accountId: z.number().int().positive() }))
    .query(async ({ ctx, input }) => {
      await requireAccountMember(ctx.user.id, input.accountId, ctx.user.role);
      return listPipelines(input.accountId);
    }),

  // ─── Get or create default pipeline (auto-provisions stages) ───
  getDefault: protectedProcedure
    .input(z.object({ accountId: z.number().int().positive() }))
    .query(async ({ ctx, input }) => {
      await requireAccountMember(ctx.user.id, input.accountId, ctx.user.role);
      const pipeline = await getOrCreateDefaultPipeline(input.accountId);
      const stages = await listPipelineStages(pipeline.id, input.accountId);
      return { pipeline, stages };
    }),

  // ─── List stages for a pipeline ───
  listStages: protectedProcedure
    .input(
      z.object({
        pipelineId: z.number().int().positive(),
        accountId: z.number().int().positive(),
      })
    )
    .query(async ({ ctx, input }) => {
      await requireAccountMember(ctx.user.id, input.accountId, ctx.user.role);
      const pipeline = await getPipelineById(input.pipelineId, input.accountId);
      if (!pipeline) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Pipeline not found" });
      }
      return listPipelineStages(input.pipelineId, input.accountId);
    }),

  // ─── List all deals for a pipeline (with contact info) ───
  listDeals: protectedProcedure
    .input(
      z.object({
        pipelineId: z.number().int().positive(),
        accountId: z.number().int().positive(),
      })
    )
    .query(async ({ ctx, input }) => {
      await requireAccountMember(ctx.user.id, input.accountId, ctx.user.role);
      return listDeals(input.pipelineId, input.accountId);
    }),

  // ─── Create a deal (add contact to pipeline) ───
  createDeal: protectedProcedure
    .input(
      z.object({
        accountId: z.number().int().positive(),
        pipelineId: z.number().int().positive(),
        stageId: z.number().int().positive(),
        contactId: z.number().int().positive(),
        title: z.string().max(500).optional(),
        value: z.number().int().min(0).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await requireAccountMember(ctx.user.id, input.accountId, ctx.user.role);

      // Verify pipeline belongs to account
      const pipeline = await getPipelineById(input.pipelineId, input.accountId);
      if (!pipeline) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Pipeline not found" });
      }

      // Verify stage belongs to pipeline
      const stage = await getPipelineStageById(input.stageId, input.accountId);
      if (!stage || stage.pipelineId !== input.pipelineId) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Stage not found in this pipeline" });
      }

      // Verify contact belongs to account
      const contact = await getContactById(input.contactId, input.accountId);
      if (!contact) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Contact not found" });
      }

      // Check if contact already has a deal in this pipeline
      const existing = await getDealByContactId(input.contactId, input.pipelineId, input.accountId);
      if (existing) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "This contact already has a deal in this pipeline",
        });
      }

      const stageName = stage.name;
      const { id } = await createDeal({
        accountId: input.accountId,
        pipelineId: input.pipelineId,
        stageId: input.stageId,
        contactId: input.contactId,
        title: input.title || `${contact.firstName} ${contact.lastName}`,
        value: input.value || 0,
      });

      // Log activity
      logContactActivity({
        contactId: input.contactId,
        accountId: input.accountId,
        activityType: "pipeline_stage_changed",
        description: `Deal added to pipeline "${pipeline.name}" at stage "${stageName}"`,
        metadata: JSON.stringify({ dealId: id, pipelineName: pipeline.name, toStage: stageName }),
      });

      return { id };
    }),

  // ─── Move deal to a different stage ───
  moveDeal: protectedProcedure
    .input(
      z.object({
        dealId: z.number().int().positive(),
        accountId: z.number().int().positive(),
        stageId: z.number().int().positive(),
        sortOrder: z.number().int().min(0).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await requireAccountMember(ctx.user.id, input.accountId, ctx.user.role);

      const deal = await getDealById(input.dealId, input.accountId);
      if (!deal) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Deal not found" });
      }

      // Verify new stage belongs to the same pipeline
      const newStage = await getPipelineStageById(input.stageId, input.accountId);
      if (!newStage || newStage.pipelineId !== deal.pipelineId) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Stage not found in this pipeline" });
      }

      const oldStageId = deal.stageId;
      const updateData: { stageId: number; sortOrder?: number } = { stageId: input.stageId };
      if (input.sortOrder !== undefined) {
        updateData.sortOrder = input.sortOrder;
      }

      await updateDeal(input.dealId, input.accountId, updateData);

      // Fire pipeline_stage_changed trigger if stage actually changed
      if (oldStageId !== input.stageId) {
        const oldStage = await getPipelineStageById(oldStageId, input.accountId);
        const fromStageName = oldStage?.name || "unknown";
        const toStageName = newStage.name;

        // Log activity
        logContactActivity({
          contactId: deal.contactId,
          accountId: input.accountId,
          activityType: "pipeline_stage_changed",
          description: `Deal moved from "${fromStageName}" to "${toStageName}"`,
          metadata: JSON.stringify({ dealId: input.dealId, fromStage: fromStageName, toStage: toStageName }),
        });

        import("../services/workflowTriggers").then(({ onPipelineStageChanged }) => {
          onPipelineStageChanged(
            input.accountId,
            deal.contactId,
            fromStageName,
            toStageName
          ).catch((err: unknown) =>
            console.error("[Trigger] onPipelineStageChanged error:", err)
          );
        });
      }

      return { success: true };
    }),

  // ─── Update deal details ───
  updateDeal: protectedProcedure
    .input(
      z.object({
        dealId: z.number().int().positive(),
        accountId: z.number().int().positive(),
        title: z.string().max(500).optional(),
        value: z.number().int().min(0).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await requireAccountMember(ctx.user.id, input.accountId, ctx.user.role);

      const deal = await getDealById(input.dealId, input.accountId);
      if (!deal) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Deal not found" });
      }

      const updateData: { title?: string; value?: number } = {};
      if (input.title !== undefined) updateData.title = input.title;
      if (input.value !== undefined) updateData.value = input.value;

      await updateDeal(input.dealId, input.accountId, updateData);
      return { success: true };
    }),

  // ─── Rename pipeline stages (used by onboarding wizard) ───
  renameStages: protectedProcedure
    .input(
      z.object({
        accountId: z.number().int().positive(),
        stages: z.array(
          z.object({
            id: z.number().int().positive(),
            name: z.string().min(1).max(255),
          })
        ),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await requireAccountMember(ctx.user.id, input.accountId, ctx.user.role);
      for (const stage of input.stages) {
        await updatePipelineStage(stage.id, input.accountId, { name: stage.name });
      }
      return { success: true };
    }),

  // ─── Add a new stage to a pipeline ───
  addStage: protectedProcedure
    .input(
      z.object({
        accountId: z.number().int().positive(),
        pipelineId: z.number().int().positive(),
        name: z.string().min(1).max(255),
        color: z.string().max(20).default("#6b7280"),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await requireAccountMember(ctx.user.id, input.accountId, ctx.user.role);

      const pipeline = await getPipelineById(input.pipelineId, input.accountId);
      if (!pipeline) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Pipeline not found" });
      }

      const maxOrder = await getMaxStageSortOrder(input.pipelineId);
      const { id } = await insertPipelineStage(
        input.pipelineId,
        input.accountId,
        input.name,
        input.color,
        maxOrder + 1
      );

      return { id, name: input.name, color: input.color, sortOrder: maxOrder + 1 };
    }),

  // ─── Delete a stage from a pipeline ───
  deleteStage: protectedProcedure
    .input(
      z.object({
        accountId: z.number().int().positive(),
        stageId: z.number().int().positive(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await requireAccountMember(ctx.user.id, input.accountId, ctx.user.role);

      const stage = await getPipelineStageById(input.stageId, input.accountId);
      if (!stage) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Stage not found" });
      }

      const dealCount = await countDealsByStage(input.stageId, input.accountId);
      if (dealCount > 0) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "Cannot delete a stage that contains deals. Move or delete the deals first.",
        });
      }

      await deletePipelineStage(input.stageId, input.accountId);
      return { success: true };
    }),

  // ─── Reorder stages by updating sortOrder ───
  reorderStages: protectedProcedure
    .input(
      z.object({
        accountId: z.number().int().positive(),
        stages: z.array(
          z.object({
            id: z.number().int().positive(),
            sortOrder: z.number().int().min(0),
          })
        ),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await requireAccountMember(ctx.user.id, input.accountId, ctx.user.role);
      for (const stage of input.stages) {
        await updatePipelineStage(stage.id, input.accountId, { sortOrder: stage.sortOrder });
      }
      return { success: true };
    }),

  // ─── Delete a deal ───
  deleteDeal: protectedProcedure
    .input(
      z.object({
        dealId: z.number().int().positive(),
        accountId: z.number().int().positive(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await requireAccountMember(ctx.user.id, input.accountId, ctx.user.role);

      const deal = await getDealById(input.dealId, input.accountId);
      if (!deal) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Deal not found" });
      }

      await deleteDeal(input.dealId, input.accountId);
      return { success: true };
    }),
});
