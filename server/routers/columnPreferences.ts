import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { getDb } from "../db";
import { userColumnPreferences } from "../../drizzle/schema";
import { eq, and } from "drizzle-orm";
import { requireAccountMember } from "./contacts";

// ─── Default columns for the contacts page ───

const DEFAULT_CONTACTS_COLUMNS = [
  { key: "firstName", visible: true, sortOrder: 0 },
  { key: "email", visible: true, sortOrder: 1 },
  { key: "phone", visible: true, sortOrder: 2 },
  { key: "status", visible: true, sortOrder: 3 },
  { key: "leadSource", visible: true, sortOrder: 4 },
  { key: "createdAt", visible: true, sortOrder: 5 },
];

// ─── Router ───

export const columnPreferencesRouter = router({
  /** Get column preferences for a page (returns defaults if none saved) */
  get: protectedProcedure
    .input(
      z.object({
        accountId: z.number().int().positive(),
        page: z.string().min(1).max(50),
      })
    )
    .query(async ({ ctx, input }) => {
      await requireAccountMember(ctx.user.id, input.accountId, ctx.user.role);
      const db = await getDb();
      if (!db) return { columns: DEFAULT_CONTACTS_COLUMNS };

      const [pref] = await db
        .select()
        .from(userColumnPreferences)
        .where(
          and(
            eq(userColumnPreferences.userId, ctx.user.id),
            eq(userColumnPreferences.accountId, input.accountId),
            eq(userColumnPreferences.page, input.page)
          )
        )
        .limit(1);

      if (!pref) {
        return { columns: DEFAULT_CONTACTS_COLUMNS };
      }

      return { columns: JSON.parse(pref.columns) };
    }),

  /** Save column preferences for a page (upsert) */
  save: protectedProcedure
    .input(
      z.object({
        accountId: z.number().int().positive(),
        page: z.string().min(1).max(50),
        columns: z.array(
          z.object({
            key: z.string().min(1),
            visible: z.boolean(),
            width: z.number().int().positive().optional(),
            sortOrder: z.number().int().min(0),
          })
        ),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await requireAccountMember(ctx.user.id, input.accountId, ctx.user.role);
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const columnsJson = JSON.stringify(input.columns);

      // Check if preference already exists
      const [existing] = await db
        .select({ id: userColumnPreferences.id })
        .from(userColumnPreferences)
        .where(
          and(
            eq(userColumnPreferences.userId, ctx.user.id),
            eq(userColumnPreferences.accountId, input.accountId),
            eq(userColumnPreferences.page, input.page)
          )
        )
        .limit(1);

      if (existing) {
        await db
          .update(userColumnPreferences)
          .set({ columns: columnsJson })
          .where(eq(userColumnPreferences.id, existing.id));
      } else {
        await db.insert(userColumnPreferences).values({
          userId: ctx.user.id,
          accountId: input.accountId,
          page: input.page,
          columns: columnsJson,
        });
      }

      return { success: true };
    }),
});
