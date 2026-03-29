import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure } from "../_core/trpc";
import { requireAccountMember } from "./contacts";
import { getDb } from "../db";

async function db() {
  const d = await getDb();
  if (!d) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
  return d;
}
import { savedViews } from "../../drizzle/schema";
import { eq, and, desc } from "drizzle-orm";

const filterSchema = z.object({
  search: z.string().optional(),
  status: z.string().optional(),
  source: z.string().optional(),
  customFieldFilters: z
    .array(
      z.object({
        slug: z.string(),
        operator: z.enum(["equals", "not_equals", "contains", "gt", "lt"]),
        value: z.string(),
      })
    )
    .optional(),
});

export const savedViewsRouter = router({
  /** List all saved views for the current user + account */
  list: protectedProcedure
    .input(z.object({ accountId: z.number().int().positive() }))
    .query(async ({ input, ctx }) => {
      await requireAccountMember(ctx.user.id, input.accountId, ctx.user.role);
      const d = await db();
      const rows = await d
        .select()
        .from(savedViews)
        .where(
          and(
            eq(savedViews.userId, ctx.user.id),
            eq(savedViews.accountId, input.accountId)
          )
        )
        .orderBy(desc(savedViews.updatedAt));

      return rows.map((r) => ({
        ...r,
        filters: r.filters ? JSON.parse(r.filters) : null,
        columns: r.columns ? JSON.parse(r.columns) : null,
      }));
    }),

  /** Create a new saved view */
  create: protectedProcedure
    .input(
      z.object({
        accountId: z.number().int().positive(),
        name: z.string().min(1).max(100),
        icon: z.string().max(50).optional(),
        filters: filterSchema.optional(),
        columns: z.array(z.string()).optional(),
        sortBy: z.string().max(100).optional(),
        sortDir: z.enum(["asc", "desc"]).optional(),
        isDefault: z.boolean().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const userId = ctx.user.id;
      await requireAccountMember(userId, input.accountId, ctx.user.role);
      const d = await db();

      // If setting as default, unset any existing default
      if (input.isDefault) {
        await d
          .update(savedViews)
          .set({ isDefault: false })
          .where(
            and(
              eq(savedViews.userId, userId),
              eq(savedViews.accountId, input.accountId),
              eq(savedViews.isDefault, true)
            )
          );
      }

      const [row] = await d.insert(savedViews).values({
        userId,
        accountId: input.accountId,
        name: input.name,
        icon: input.icon || null,
        filters: input.filters ? JSON.stringify(input.filters) : null,
        columns: input.columns ? JSON.stringify(input.columns) : null,
        sortBy: input.sortBy || null,
        sortDir: input.sortDir || "desc",
        isDefault: input.isDefault || false,
      });

      return { id: row.insertId };
    }),

  /** Update an existing saved view */
  update: protectedProcedure
    .input(
      z.object({
        id: z.number().int().positive(),
        accountId: z.number().int().positive(),
        name: z.string().min(1).max(100).optional(),
        icon: z.string().max(50).optional(),
        filters: filterSchema.optional(),
        columns: z.array(z.string()).optional(),
        sortBy: z.string().max(100).optional(),
        sortDir: z.enum(["asc", "desc"]).optional(),
        isDefault: z.boolean().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const userId = ctx.user.id;
      await requireAccountMember(userId, input.accountId, ctx.user.role);
      const d = await db();

      // Verify ownership
      const [existing] = await d
        .select()
        .from(savedViews)
        .where(
          and(
            eq(savedViews.id, input.id),
            eq(savedViews.userId, userId),
            eq(savedViews.accountId, input.accountId)
          )
        );
      if (!existing) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Saved view not found." });
      }

      // If setting as default, unset any existing default
      if (input.isDefault) {
        await d
          .update(savedViews)
          .set({ isDefault: false })
          .where(
            and(
              eq(savedViews.userId, userId),
              eq(savedViews.accountId, input.accountId),
              eq(savedViews.isDefault, true)
            )
          );
      }

      const updates: Record<string, unknown> = {};
      if (input.name !== undefined) updates.name = input.name;
      if (input.icon !== undefined) updates.icon = input.icon;
      if (input.filters !== undefined) updates.filters = JSON.stringify(input.filters);
      if (input.columns !== undefined) updates.columns = JSON.stringify(input.columns);
      if (input.sortBy !== undefined) updates.sortBy = input.sortBy;
      if (input.sortDir !== undefined) updates.sortDir = input.sortDir;
      if (input.isDefault !== undefined) updates.isDefault = input.isDefault;

      await d.update(savedViews).set(updates).where(eq(savedViews.id, input.id));

      return { success: true };
    }),

  /** Delete a saved view */
  delete: protectedProcedure
    .input(
      z.object({
        id: z.number().int().positive(),
        accountId: z.number().int().positive(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const userId = ctx.user.id;
      await requireAccountMember(userId, input.accountId, ctx.user.role);
      const d = await db();

      const [existing] = await d
        .select()
        .from(savedViews)
        .where(
          and(
            eq(savedViews.id, input.id),
            eq(savedViews.userId, userId),
            eq(savedViews.accountId, input.accountId)
          )
        );
      if (!existing) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Saved view not found." });
      }

      await d.delete(savedViews).where(eq(savedViews.id, input.id));
      return { success: true };
    }),

  /** Set a view as the default (and unset others) */
  setDefault: protectedProcedure
    .input(
      z.object({
        id: z.number().int().positive().nullable(), // null = clear default
        accountId: z.number().int().positive(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const userId = ctx.user.id;
      await requireAccountMember(userId, input.accountId, ctx.user.role);
      const d = await db();

      // Unset all defaults for this user+account
      await d
        .update(savedViews)
        .set({ isDefault: false })
        .where(
          and(
            eq(savedViews.userId, userId),
            eq(savedViews.accountId, input.accountId)
          )
        );

      // Set the new default if provided
      if (input.id !== null) {
        await d
          .update(savedViews)
          .set({ isDefault: true })
          .where(
            and(
              eq(savedViews.id, input.id),
              eq(savedViews.userId, userId),
              eq(savedViews.accountId, input.accountId)
            )
          );
      }

      return { success: true };
    }),
});
