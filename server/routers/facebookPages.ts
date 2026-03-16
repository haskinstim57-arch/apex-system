import { z } from "zod";
import { adminProcedure, router } from "../_core/trpc";
import * as db from "../db";

// ─────────────────────────────────────────────
// Facebook Page Mappings Router
// Admin-only CRUD for mapping Facebook page IDs
// to sub-accounts with per-client verify tokens.
// ─────────────────────────────────────────────

export const facebookPagesRouter = router({
  /** List all Facebook page mappings (optionally filter by accountId) */
  list: adminProcedure
    .input(
      z
        .object({
          accountId: z.number().optional(),
        })
        .optional()
    )
    .query(async ({ input }) => {
      const mappings = await db.listFacebookPageMappings(input?.accountId);
      return { mappings };
    }),

  /** Get a single mapping by its Facebook page ID */
  getByPageId: adminProcedure
    .input(z.object({ facebookPageId: z.string().min(1) }))
    .query(async ({ input }) => {
      const mapping = await db.getFacebookPageMappingByPageId(
        input.facebookPageId
      );
      return { mapping };
    }),

  /** Create a new Facebook page → sub-account mapping */
  create: adminProcedure
    .input(
      z.object({
        facebookPageId: z.string().min(1, "Facebook Page ID is required"),
        accountId: z.number().min(1, "Sub-account is required"),
        pageName: z.string().optional(),
        verifyToken: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      // Check for duplicate page ID
      const existing = await db.getFacebookPageMappingByPageId(
        input.facebookPageId
      );
      if (existing) {
        throw new Error(
          `Facebook Page ID "${input.facebookPageId}" is already mapped.`
        );
      }

      const row = await db.createFacebookPageMapping({
        facebookPageId: input.facebookPageId,
        accountId: input.accountId,
        pageName: input.pageName || null,
        verifyToken: input.verifyToken || null,
      });
      return { id: row.id, success: true };
    }),

  /** Update an existing mapping (page name, account, verify token) */
  update: adminProcedure
    .input(
      z.object({
        id: z.number(),
        facebookPageId: z.string().min(1).optional(),
        accountId: z.number().min(1).optional(),
        pageName: z.string().optional(),
        verifyToken: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const { id, ...updates } = input;
      await db.updateFacebookPageMapping(id, updates);
      return { success: true };
    }),

  /** Delete a mapping */
  delete: adminProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      await db.deleteFacebookPageMapping(input.id);
      return { success: true };
    }),
});
