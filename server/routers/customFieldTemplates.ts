import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { TRPCError } from "@trpc/server";
import { getDb } from "../db";
import { customFieldTemplates, customFieldDefs } from "../../drizzle/schema";
import { eq, and, asc } from "drizzle-orm";
import { requireAccountMember } from "./contacts";

// ─── Types ───

interface TemplateField {
  label: string;
  slug: string;
  type: string;
  options?: string[];
  required: boolean;
  sortOrder: number;
}

// ─── Router ───

export const customFieldTemplatesRouter = router({
  /** List all available templates (system + user-created) */
  list: protectedProcedure.query(async () => {
    const db = await getDb();
    if (!db) return [];
    return db
      .select()
      .from(customFieldTemplates)
      .orderBy(asc(customFieldTemplates.name));
  }),

  /** Get a single template by ID */
  get: protectedProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const [template] = await db
        .select()
        .from(customFieldTemplates)
        .where(eq(customFieldTemplates.id, input.id))
        .limit(1);
      if (!template) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Template not found",
        });
      }
      return template;
    }),

  /** Apply a template to an account — creates field definitions, skipping existing slugs */
  applyTemplate: protectedProcedure
    .input(
      z.object({
        templateId: z.number().int().positive(),
        accountId: z.number().int().positive(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await requireAccountMember(ctx.user.id, input.accountId, ctx.user.role);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      // Fetch the template
      const [template] = await db
        .select()
        .from(customFieldTemplates)
        .where(eq(customFieldTemplates.id, input.templateId))
        .limit(1);

      if (!template) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Template not found",
        });
      }

      const fields: TemplateField[] = JSON.parse(template.fields);

      // Get existing field slugs for this account
      const existingDefs = await db
        .select({ slug: customFieldDefs.slug })
        .from(customFieldDefs)
        .where(eq(customFieldDefs.accountId, input.accountId));

      const existingSlugs = new Set(existingDefs.map((d) => d.slug));

      // Insert fields that don't already exist
      let created = 0;
      let skipped = 0;

      for (const field of fields) {
        if (existingSlugs.has(field.slug)) {
          skipped++;
          continue;
        }

        await db.insert(customFieldDefs).values({
          accountId: input.accountId,
          name: field.label,
          slug: field.slug,
          type: field.type as any,
          options:
            field.type === "dropdown" && field.options
              ? JSON.stringify(field.options)
              : null,
          required: field.required ?? false,
          sortOrder: field.sortOrder ?? 0,
        });
        created++;
      }

      return { created, skipped, templateName: template.name };
    }),
});
