import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure } from "../_core/trpc";
import { requireAccountMember } from "./contacts";
import {
  listLeadScoringRules,
  getLeadScoringRuleById,
  createLeadScoringRule,
  updateLeadScoringRule,
  deleteLeadScoringRule,
  getLeadScoreHistory,
  getContactById,
  createAuditLog,
} from "../db";
import { manuallyAdjustLeadScore, getScoreTier } from "../services/leadScoringEngine";

const scoringEventEnum = z.enum([
  "contact_created",
  "tag_added",
  "pipeline_stage_changed",
  "inbound_message_received",
  "appointment_booked",
  "appointment_cancelled",
  "call_completed",
  "missed_call",
  "form_submitted",
  "email_opened",
  "link_clicked",
  "facebook_lead_received",
]);

const conditionSchema = z
  .object({
    field: z.string().optional(),
    operator: z
      .enum(["equals", "not_equals", "contains", "greater_than", "less_than"])
      .optional(),
    value: z.string().optional(),
    tag: z.string().optional(),
    toStatus: z.string().optional(),
    channel: z.enum(["sms", "email"]).optional(),
  })
  .optional()
  .nullable();

export const leadScoringRouter = router({
  // ─── List all scoring rules for an account ───
  listRules: protectedProcedure
    .input(z.object({ accountId: z.number().int().positive() }))
    .query(async ({ ctx, input }) => {
      await requireAccountMember(ctx.user.id, input.accountId, ctx.user.role);
      return listLeadScoringRules(input.accountId);
    }),

  // ─── Create a scoring rule ───
  createRule: protectedProcedure
    .input(
      z.object({
        accountId: z.number().int().positive(),
        name: z.string().min(1).max(255),
        event: scoringEventEnum,
        delta: z.number().int(),
        condition: conditionSchema,
        isActive: z.boolean().optional().default(true),
        sortOrder: z.number().int().optional().default(0),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const member = await requireAccountMember(ctx.user.id, input.accountId, ctx.user.role);
      if (member.role === "employee") {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Employees cannot manage scoring rules",
        });
      }

      const { id } = await createLeadScoringRule({
        accountId: input.accountId,
        name: input.name,
        event: input.event,
        delta: input.delta,
        condition: input.condition ?? null,
        isActive: input.isActive,
        sortOrder: input.sortOrder,
      });

      await createAuditLog({
        accountId: input.accountId,
        userId: ctx.user.id,
        action: "lead_scoring_rule.created",
        resourceType: "lead_scoring_rule",
        resourceId: id,
      });

      return { id };
    }),

  // ─── Update a scoring rule ───
  updateRule: protectedProcedure
    .input(
      z.object({
        id: z.number().int().positive(),
        accountId: z.number().int().positive(),
        name: z.string().min(1).max(255).optional(),
        event: scoringEventEnum.optional(),
        delta: z.number().int().optional(),
        condition: conditionSchema,
        isActive: z.boolean().optional(),
        sortOrder: z.number().int().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const member = await requireAccountMember(ctx.user.id, input.accountId, ctx.user.role);
      if (member.role === "employee") {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Employees cannot manage scoring rules",
        });
      }

      const existing = await getLeadScoringRuleById(input.id, input.accountId);
      if (!existing) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Scoring rule not found" });
      }

      const { id, accountId, ...updateData } = input;
      await updateLeadScoringRule(id, accountId, updateData as any);

      await createAuditLog({
        accountId: input.accountId,
        userId: ctx.user.id,
        action: "lead_scoring_rule.updated",
        resourceType: "lead_scoring_rule",
        resourceId: id,
      });

      return { success: true };
    }),

  // ─── Delete a scoring rule ───
  deleteRule: protectedProcedure
    .input(
      z.object({
        id: z.number().int().positive(),
        accountId: z.number().int().positive(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const member = await requireAccountMember(ctx.user.id, input.accountId, ctx.user.role);
      if (member.role === "employee") {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Employees cannot manage scoring rules",
        });
      }

      const existing = await getLeadScoringRuleById(input.id, input.accountId);
      if (!existing) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Scoring rule not found" });
      }

      await deleteLeadScoringRule(input.id, input.accountId);

      await createAuditLog({
        accountId: input.accountId,
        userId: ctx.user.id,
        action: "lead_scoring_rule.deleted",
        resourceType: "lead_scoring_rule",
        resourceId: input.id,
      });

      return { success: true };
    }),

  // ─── Get score history for a contact ───
  getHistory: protectedProcedure
    .input(
      z.object({
        contactId: z.number().int().positive(),
        accountId: z.number().int().positive(),
        limit: z.number().int().min(1).max(100).optional().default(50),
      })
    )
    .query(async ({ ctx, input }) => {
      await requireAccountMember(ctx.user.id, input.accountId, ctx.user.role);
      const contact = await getContactById(input.contactId, input.accountId);
      if (!contact) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Contact not found" });
      }
      return getLeadScoreHistory(input.contactId, input.accountId, input.limit);
    }),

  // ─── Manually adjust a contact's score ───
  adjustScore: protectedProcedure
    .input(
      z.object({
        contactId: z.number().int().positive(),
        accountId: z.number().int().positive(),
        delta: z.number().int(),
        reason: z.string().max(500).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await requireAccountMember(ctx.user.id, input.accountId, ctx.user.role);
      const contact = await getContactById(input.contactId, input.accountId);
      if (!contact) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Contact not found" });
      }

      const newScore = await manuallyAdjustLeadScore(
        input.contactId,
        input.accountId,
        input.delta,
        input.reason
      );

      await createAuditLog({
        accountId: input.accountId,
        userId: ctx.user.id,
        action: "contact.score_adjusted",
        resourceType: "contact",
        resourceId: input.contactId,
        metadata: JSON.stringify({ delta: input.delta, newScore, reason: input.reason }),
      });

      return { newScore };
    }),

  // ─── Get score tier info ───
  getTier: protectedProcedure
    .input(z.object({ score: z.number().int().min(0) }))
    .query(({ input }) => {
      return getScoreTier(input.score);
    }),
});
