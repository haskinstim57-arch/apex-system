import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { protectedProcedure, router } from "../_core/trpc";
import {
  createLeadRoutingRule,
  listLeadRoutingRules,
  getLeadRoutingRuleById,
  updateLeadRoutingRule,
  deleteLeadRoutingRule,
  createAuditLog,
  listMembers,
} from "../db";
import { requireAccountMember } from "./contacts";

export const leadRoutingRouter = router({
  // ─── List all routing rules for an account ───
  list: protectedProcedure
    .input(z.object({ accountId: z.number().int().positive() }))
    .query(async ({ ctx, input }) => {
      await requireAccountMember(ctx.user.id, input.accountId, ctx.user.role);
      return listLeadRoutingRules(input.accountId);
    }),

  // ─── Get a single routing rule ───
  get: protectedProcedure
    .input(
      z.object({
        id: z.number().int().positive(),
        accountId: z.number().int().positive(),
      })
    )
    .query(async ({ ctx, input }) => {
      await requireAccountMember(ctx.user.id, input.accountId, ctx.user.role);
      const rule = await getLeadRoutingRuleById(input.id, input.accountId);
      if (!rule) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Routing rule not found" });
      }
      return rule;
    }),

  // ─── Create a new routing rule ───
  create: protectedProcedure
    .input(
      z.object({
        accountId: z.number().int().positive(),
        name: z.string().min(1).max(255),
        strategy: z.enum(["round_robin", "capacity_based", "specific_user"]),
        assigneeIds: z.array(z.number().int().positive()).min(1),
        isActive: z.boolean().default(true),
        priority: z.number().int().min(0).default(0),
        conditions: z
          .object({
            leadSource: z.array(z.string()).optional(),
            tags: z.array(z.string()).optional(),
          })
          .optional(),
        maxLeadsPerUser: z.number().int().min(0).default(0),
        applyToCsvImport: z.boolean().default(true),
        applyToFacebookLeads: z.boolean().default(true),
        applyToManualCreate: z.boolean().default(false),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await requireAccountMember(ctx.user.id, input.accountId, ctx.user.role);

      // Validate that all assignee IDs are members of the account
      const members = await listMembers(input.accountId);
      const memberIds = new Set(members.map((m) => m.userId));
      for (const id of input.assigneeIds) {
        if (!memberIds.has(id)) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: `User ${id} is not a member of this account`,
          });
        }
      }

      const { id } = await createLeadRoutingRule({
        accountId: input.accountId,
        name: input.name,
        strategy: input.strategy,
        assigneeIds: JSON.stringify(input.assigneeIds),
        isActive: input.isActive,
        priority: input.priority,
        conditions: input.conditions ? JSON.stringify(input.conditions) : null,
        maxLeadsPerUser: input.maxLeadsPerUser,
        applyToCsvImport: input.applyToCsvImport,
        applyToFacebookLeads: input.applyToFacebookLeads,
        applyToManualCreate: input.applyToManualCreate,
        createdById: ctx.user.id,
      });

      await createAuditLog({
        accountId: input.accountId,
        userId: ctx.user.id,
        action: "lead_routing.create",
        resourceType: "lead_routing_rule",
        resourceId: id,
        metadata: JSON.stringify({ name: input.name, strategy: input.strategy }),
      });

      return { id };
    }),

  // ─── Update a routing rule ───
  update: protectedProcedure
    .input(
      z.object({
        id: z.number().int().positive(),
        accountId: z.number().int().positive(),
        name: z.string().min(1).max(255).optional(),
        strategy: z.enum(["round_robin", "capacity_based", "specific_user"]).optional(),
        assigneeIds: z.array(z.number().int().positive()).min(1).optional(),
        isActive: z.boolean().optional(),
        priority: z.number().int().min(0).optional(),
        conditions: z
          .object({
            leadSource: z.array(z.string()).optional(),
            tags: z.array(z.string()).optional(),
          })
          .nullable()
          .optional(),
        maxLeadsPerUser: z.number().int().min(0).optional(),
        applyToCsvImport: z.boolean().optional(),
        applyToFacebookLeads: z.boolean().optional(),
        applyToManualCreate: z.boolean().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await requireAccountMember(ctx.user.id, input.accountId, ctx.user.role);

      const existing = await getLeadRoutingRuleById(input.id, input.accountId);
      if (!existing) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Routing rule not found" });
      }

      // Validate assignees if being updated
      if (input.assigneeIds) {
        const members = await listMembers(input.accountId);
        const memberIds = new Set(members.map((m) => m.userId));
        for (const id of input.assigneeIds) {
          if (!memberIds.has(id)) {
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: `User ${id} is not a member of this account`,
            });
          }
        }
      }

      const updateData: Record<string, any> = {};
      if (input.name !== undefined) updateData.name = input.name;
      if (input.strategy !== undefined) updateData.strategy = input.strategy;
      if (input.assigneeIds !== undefined) updateData.assigneeIds = JSON.stringify(input.assigneeIds);
      if (input.isActive !== undefined) updateData.isActive = input.isActive;
      if (input.priority !== undefined) updateData.priority = input.priority;
      if (input.conditions !== undefined) {
        updateData.conditions = input.conditions ? JSON.stringify(input.conditions) : null;
      }
      if (input.maxLeadsPerUser !== undefined) updateData.maxLeadsPerUser = input.maxLeadsPerUser;
      if (input.applyToCsvImport !== undefined) updateData.applyToCsvImport = input.applyToCsvImport;
      if (input.applyToFacebookLeads !== undefined) updateData.applyToFacebookLeads = input.applyToFacebookLeads;
      if (input.applyToManualCreate !== undefined) updateData.applyToManualCreate = input.applyToManualCreate;

      await updateLeadRoutingRule(input.id, input.accountId, updateData);

      await createAuditLog({
        accountId: input.accountId,
        userId: ctx.user.id,
        action: "lead_routing.update",
        resourceType: "lead_routing_rule",
        resourceId: input.id,
        metadata: JSON.stringify(updateData),
      });

      return { success: true };
    }),

  // ─── Delete a routing rule ───
  delete: protectedProcedure
    .input(
      z.object({
        id: z.number().int().positive(),
        accountId: z.number().int().positive(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await requireAccountMember(ctx.user.id, input.accountId, ctx.user.role);

      const existing = await getLeadRoutingRuleById(input.id, input.accountId);
      if (!existing) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Routing rule not found" });
      }

      await deleteLeadRoutingRule(input.id, input.accountId);

      await createAuditLog({
        accountId: input.accountId,
        userId: ctx.user.id,
        action: "lead_routing.delete",
        resourceType: "lead_routing_rule",
        resourceId: input.id,
        metadata: JSON.stringify({ name: existing.name }),
      });

      return { success: true };
    }),

  // ─── Toggle active status ───
  toggleActive: protectedProcedure
    .input(
      z.object({
        id: z.number().int().positive(),
        accountId: z.number().int().positive(),
        isActive: z.boolean(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await requireAccountMember(ctx.user.id, input.accountId, ctx.user.role);

      const existing = await getLeadRoutingRuleById(input.id, input.accountId);
      if (!existing) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Routing rule not found" });
      }

      await updateLeadRoutingRule(input.id, input.accountId, {
        isActive: input.isActive,
      });

      return { success: true };
    }),
});
