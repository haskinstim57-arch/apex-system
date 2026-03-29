import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure } from "../_core/trpc";
import { requireAccountMember } from "./contacts";
import {
  createSegment,
  listSegments,
  getSegmentById,
  updateSegment,
  deleteSegment,
  resolveSegmentContacts,
  refreshSegmentCount,
  listContacts,
  type SegmentFilterConfig,
} from "../db";

// ─── Zod schema for filter config ───
const filterConfigSchema = z.object({
  status: z.string().optional(),
  leadSource: z.string().optional(),
  tags: z.array(z.string()).optional(),
  tagsAny: z.array(z.string()).optional(),
  assignedUserId: z.number().int().positive().optional(),
  search: z.string().optional(),
  scoreMin: z.number().int().optional(),
  scoreMax: z.number().int().optional(),
  createdAfter: z.string().optional(),
  createdBefore: z.string().optional(),
  hasEmail: z.boolean().optional(),
  hasPhone: z.boolean().optional(),
  customFieldFilters: z
    .array(
      z.object({
        slug: z.string(),
        operator: z.enum([
          "equals",
          "not_equals",
          "contains",
          "greater_than",
          "less_than",
          "is_empty",
          "is_not_empty",
        ]),
        value: z.string().optional(),
      })
    )
    .optional(),
});

export const segmentsRouter = router({
  // ─── Create segment ───
  create: protectedProcedure
    .input(
      z.object({
        accountId: z.number().int().positive(),
        name: z.string().min(1).max(150),
        description: z.string().max(500).optional(),
        icon: z.string().max(50).optional(),
        color: z.string().max(30).optional(),
        filterConfig: filterConfigSchema,
      })
    )
    .mutation(async ({ ctx, input }) => {
      await requireAccountMember(ctx.user.id, input.accountId, ctx.user.role);

      // Compute initial count
      const { total } = await resolveSegmentContacts(
        input.accountId,
        input.filterConfig as SegmentFilterConfig,
        { countOnly: true }
      );

      const { id } = await createSegment({
        accountId: input.accountId,
        name: input.name,
        description: input.description ?? null,
        icon: input.icon ?? null,
        color: input.color ?? null,
        filterConfig: JSON.stringify(input.filterConfig),
        isPreset: false,
        contactCount: total,
        countRefreshedAt: new Date(),
        createdById: ctx.user.id,
      });

      return { id, contactCount: total };
    }),

  // ─── List segments for account ───
  list: protectedProcedure
    .input(z.object({ accountId: z.number().int().positive() }))
    .query(async ({ ctx, input }) => {
      await requireAccountMember(ctx.user.id, input.accountId, ctx.user.role);
      const segments = await listSegments(input.accountId);
      return segments.map((s) => ({
        ...s,
        filterConfig: s.filterConfig ? JSON.parse(s.filterConfig) : {},
      }));
    }),

  // ─── Get single segment ───
  get: protectedProcedure
    .input(
      z.object({
        id: z.number().int().positive(),
        accountId: z.number().int().positive(),
      })
    )
    .query(async ({ ctx, input }) => {
      await requireAccountMember(ctx.user.id, input.accountId, ctx.user.role);
      const segment = await getSegmentById(input.id, input.accountId);
      if (!segment) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Segment not found" });
      }
      return {
        ...segment,
        filterConfig: segment.filterConfig ? JSON.parse(segment.filterConfig) : {},
      };
    }),

  // ─── Update segment ───
  update: protectedProcedure
    .input(
      z.object({
        id: z.number().int().positive(),
        accountId: z.number().int().positive(),
        name: z.string().min(1).max(150).optional(),
        description: z.string().max(500).optional().nullable(),
        icon: z.string().max(50).optional().nullable(),
        color: z.string().max(30).optional().nullable(),
        filterConfig: filterConfigSchema.optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await requireAccountMember(ctx.user.id, input.accountId, ctx.user.role);

      const existing = await getSegmentById(input.id, input.accountId);
      if (!existing) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Segment not found" });
      }
      if (existing.isPreset) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Cannot modify preset segments",
        });
      }

      const updates: Record<string, unknown> = {};
      if (input.name !== undefined) updates.name = input.name;
      if (input.description !== undefined) updates.description = input.description;
      if (input.icon !== undefined) updates.icon = input.icon;
      if (input.color !== undefined) updates.color = input.color;
      if (input.filterConfig !== undefined) {
        updates.filterConfig = JSON.stringify(input.filterConfig);
        // Recompute count
        const { total } = await resolveSegmentContacts(
          input.accountId,
          input.filterConfig as SegmentFilterConfig,
          { countOnly: true }
        );
        updates.contactCount = total;
        updates.countRefreshedAt = new Date();
      }

      await updateSegment(input.id, input.accountId, updates as any);
      return { success: true };
    }),

  // ─── Delete segment ───
  delete: protectedProcedure
    .input(
      z.object({
        id: z.number().int().positive(),
        accountId: z.number().int().positive(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await requireAccountMember(ctx.user.id, input.accountId, ctx.user.role);

      const existing = await getSegmentById(input.id, input.accountId);
      if (!existing) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Segment not found" });
      }
      if (existing.isPreset) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Cannot delete preset segments",
        });
      }

      await deleteSegment(input.id, input.accountId);
      return { success: true };
    }),

  // ─── Get contacts matching a segment ───
  getContacts: protectedProcedure
    .input(
      z.object({
        id: z.number().int().positive(),
        accountId: z.number().int().positive(),
        limit: z.number().int().min(1).max(100).optional().default(50),
        offset: z.number().int().min(0).optional().default(0),
      })
    )
    .query(async ({ ctx, input }) => {
      await requireAccountMember(ctx.user.id, input.accountId, ctx.user.role);

      const segment = await getSegmentById(input.id, input.accountId);
      if (!segment) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Segment not found" });
      }

      const filterConfig: SegmentFilterConfig = segment.filterConfig
        ? JSON.parse(segment.filterConfig)
        : {};

      // Use the existing listContacts with the segment's filters
      const result = await listContacts({
        accountId: input.accountId,
        search: filterConfig.search,
        status: filterConfig.status,
        leadSource: filterConfig.leadSource,
        assignedUserId: filterConfig.assignedUserId,
        customFieldFilters: filterConfig.customFieldFilters as any,
        limit: input.limit,
        offset: input.offset,
      });

      return result;
    }),

  // ─── Refresh segment contact count ───
  refreshCount: protectedProcedure
    .input(
      z.object({
        id: z.number().int().positive(),
        accountId: z.number().int().positive(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await requireAccountMember(ctx.user.id, input.accountId, ctx.user.role);
      const count = await refreshSegmentCount(input.id, input.accountId);
      return { count: count ?? 0 };
    }),

  // ─── Resolve segment contact IDs (for campaign/workflow targeting) ───
  resolveContactIds: protectedProcedure
    .input(
      z.object({
        id: z.number().int().positive(),
        accountId: z.number().int().positive(),
      })
    )
    .query(async ({ ctx, input }) => {
      await requireAccountMember(ctx.user.id, input.accountId, ctx.user.role);

      const segment = await getSegmentById(input.id, input.accountId);
      if (!segment) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Segment not found" });
      }

      const filterConfig: SegmentFilterConfig = segment.filterConfig
        ? JSON.parse(segment.filterConfig)
        : {};

      const { ids, total } = await resolveSegmentContacts(input.accountId, filterConfig);
      return { ids, total };
    }),

  // ─── Preview: evaluate a filter config without saving ───
  preview: protectedProcedure
    .input(
      z.object({
        accountId: z.number().int().positive(),
        filterConfig: filterConfigSchema,
      })
    )
    .query(async ({ ctx, input }) => {
      await requireAccountMember(ctx.user.id, input.accountId, ctx.user.role);
      const { total } = await resolveSegmentContacts(
        input.accountId,
        input.filterConfig as SegmentFilterConfig,
        { countOnly: true }
      );
      return { count: total };
    }),
});
