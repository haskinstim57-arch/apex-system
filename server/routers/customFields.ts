import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { TRPCError } from "@trpc/server";
import { getDb } from "../db";
import { customFieldDefs } from "../../drizzle/schema";
import { eq, and, asc } from "drizzle-orm";
import { requireAccountMember } from "./contacts";

// ─── Shared types ───

const FIELD_TYPES = [
  "text",
  "number",
  "date",
  "dropdown",
  "checkbox",
  "textarea",
  "url",
  "email",
  "phone",
] as const;

const visibilityRuleSchema = z.object({
  dependsOnSlug: z.string().min(1),
  operator: z.enum(["equals", "not_equals", "contains", "not_empty", "is_empty", "in"]),
  value: z.union([z.string(), z.number(), z.boolean(), z.array(z.string())]).optional(),
});

const fieldDefInput = z.object({
  name: z.string().min(1).max(100),
  slug: z
    .string()
    .min(1)
    .max(100)
    .regex(
      /^[a-z][a-z0-9_]*$/,
      "Slug must start with a letter and contain only lowercase letters, numbers, and underscores"
    ),
  type: z.enum(FIELD_TYPES),
  options: z.array(z.string().min(1).max(200)).optional(),
  required: z.boolean().optional().default(false),
  sortOrder: z.number().int().min(0).optional().default(0),
  visibilityRules: z.array(visibilityRuleSchema).optional(),
});

// ─── Validation helper (exported for use in contacts router) ───

export interface CustomFieldDefRecord {
  id: number;
  slug: string;
  name: string;
  type: string;
  options: string | null;
  required: boolean;
  isActive: boolean;
}

/**
 * Validate a customFields JSON object against the account's field definitions.
 * Returns the validated/coerced object or throws a TRPCError.
 */
export function validateCustomFields(
  customFieldsRaw: Record<string, unknown>,
  defs: CustomFieldDefRecord[],
  opts: { requireAll?: boolean } = {}
): Record<string, unknown> {
  const activeDefs = defs.filter((d) => d.isActive);
  const defMap = new Map(activeDefs.map((d) => [d.slug, d]));
  const result: Record<string, unknown> = {};

  // Check required fields
  if (opts.requireAll) {
    for (const def of activeDefs) {
      if (def.required) {
        const val = customFieldsRaw[def.slug];
        if (val === undefined || val === null || val === "") {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: `Custom field "${def.name}" is required`,
          });
        }
      }
    }
  }

  // Validate each provided field
  for (const [slug, value] of Object.entries(customFieldsRaw)) {
    const def = defMap.get(slug);
    if (!def) {
      // Allow unknown fields to pass through (e.g. fb_lead_id from integrations)
      result[slug] = value;
      continue;
    }

    // Skip empty values
    if (value === null || value === undefined || value === "") {
      if (def.required && opts.requireAll) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Custom field "${def.name}" is required`,
        });
      }
      result[slug] = null;
      continue;
    }

    // Type validation
    switch (def.type) {
      case "text":
      case "textarea":
        if (typeof value !== "string") {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: `Custom field "${def.name}" must be a text value`,
          });
        }
        result[slug] = value;
        break;

      case "number": {
        const num = typeof value === "string" ? parseFloat(value) : value;
        if (typeof num !== "number" || isNaN(num)) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: `Custom field "${def.name}" must be a number`,
          });
        }
        result[slug] = num;
        break;
      }

      case "date": {
        const dateStr = String(value);
        const parsed = new Date(dateStr);
        if (isNaN(parsed.getTime())) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: `Custom field "${def.name}" must be a valid date`,
          });
        }
        result[slug] = dateStr;
        break;
      }

      case "dropdown": {
        const options: string[] = def.options ? JSON.parse(def.options) : [];
        if (!options.includes(String(value))) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: `Custom field "${def.name}" must be one of: ${options.join(", ")}`,
          });
        }
        result[slug] = String(value);
        break;
      }

      case "checkbox":
        result[slug] =
          value === true || value === "true" || value === "1" || value === 1;
        break;

      case "url": {
        const urlStr = String(value);
        try {
          new URL(urlStr);
        } catch {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: `Custom field "${def.name}" must be a valid URL`,
          });
        }
        result[slug] = urlStr;
        break;
      }

      case "email": {
        const emailStr = String(value);
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailStr)) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: `Custom field "${def.name}" must be a valid email address`,
          });
        }
        result[slug] = emailStr;
        break;
      }

      case "phone":
        result[slug] = String(value);
        break;

      default:
        result[slug] = value;
    }
  }

  return result;
}

/**
 * Get active custom field definitions for an account (exported for use in other modules).
 */
export async function getAccountCustomFieldDefs(
  accountId: number
): Promise<CustomFieldDefRecord[]> {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(customFieldDefs)
    .where(
      and(
        eq(customFieldDefs.accountId, accountId),
        eq(customFieldDefs.isActive, true)
      )
    )
    .orderBy(asc(customFieldDefs.sortOrder), asc(customFieldDefs.id));
}

// ─── Router ───

export const customFieldsRouter = router({
  // List all field definitions for an account
  list: protectedProcedure
    .input(z.object({ accountId: z.number().int().positive() }))
    .query(async ({ ctx, input }) => {
      await requireAccountMember(ctx.user.id, input.accountId, ctx.user.role);
      const db = await getDb();
      if (!db) return [];
      return db
        .select()
        .from(customFieldDefs)
        .where(eq(customFieldDefs.accountId, input.accountId))
        .orderBy(asc(customFieldDefs.sortOrder), asc(customFieldDefs.id));
    }),

  // Create a new field definition
  create: protectedProcedure
    .input(
      z.object({
        accountId: z.number().int().positive(),
        ...fieldDefInput.shape,
      })
    )
    .mutation(async ({ ctx, input }) => {
      await requireAccountMember(ctx.user.id, input.accountId, ctx.user.role);
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      // Check for duplicate slug within account
      const existing = await db
        .select({ id: customFieldDefs.id })
        .from(customFieldDefs)
        .where(
          and(
            eq(customFieldDefs.accountId, input.accountId),
            eq(customFieldDefs.slug, input.slug)
          )
        )
        .limit(1);

      if (existing.length > 0) {
        throw new TRPCError({
          code: "CONFLICT",
          message: `A custom field with slug "${input.slug}" already exists`,
        });
      }

      const result = await db.insert(customFieldDefs).values({
        accountId: input.accountId,
        name: input.name,
        slug: input.slug,
        type: input.type,
        options:
          input.type === "dropdown" && input.options
            ? JSON.stringify(input.options)
            : null,
        required: input.required,
        sortOrder: input.sortOrder,
        visibilityRules:
          input.visibilityRules && input.visibilityRules.length > 0
            ? JSON.stringify(input.visibilityRules)
            : null,
      });

      return { id: result[0].insertId };
    }),

  // Update a field definition
  update: protectedProcedure
    .input(
      z.object({
        id: z.number().int().positive(),
        accountId: z.number().int().positive(),
        name: z.string().min(1).max(100).optional(),
        type: z.enum(FIELD_TYPES).optional(),
        options: z.array(z.string().min(1).max(200)).optional(),
        required: z.boolean().optional(),
        sortOrder: z.number().int().min(0).optional(),
        isActive: z.boolean().optional(),
        visibilityRules: z.array(visibilityRuleSchema).nullable().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await requireAccountMember(ctx.user.id, input.accountId, ctx.user.role);
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const existing = await db
        .select()
        .from(customFieldDefs)
        .where(
          and(
            eq(customFieldDefs.id, input.id),
            eq(customFieldDefs.accountId, input.accountId)
          )
        )
        .limit(1);

      if (existing.length === 0) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Custom field definition not found",
        });
      }

      const updateData: Record<string, unknown> = {};
      if (input.name !== undefined) updateData.name = input.name;
      if (input.type !== undefined) updateData.type = input.type;
      if (input.options !== undefined)
        updateData.options = JSON.stringify(input.options);
      if (input.required !== undefined) updateData.required = input.required;
      if (input.sortOrder !== undefined) updateData.sortOrder = input.sortOrder;
      if (input.isActive !== undefined) updateData.isActive = input.isActive;
      if (input.visibilityRules !== undefined) {
        updateData.visibilityRules =
          input.visibilityRules && input.visibilityRules.length > 0
            ? JSON.stringify(input.visibilityRules)
            : null;
      }

      await db
        .update(customFieldDefs)
        .set(updateData)
        .where(
          and(
            eq(customFieldDefs.id, input.id),
            eq(customFieldDefs.accountId, input.accountId)
          )
        );

      return { success: true };
    }),

  // Delete a field definition
  delete: protectedProcedure
    .input(
      z.object({
        id: z.number().int().positive(),
        accountId: z.number().int().positive(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await requireAccountMember(ctx.user.id, input.accountId, ctx.user.role);
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      await db
        .delete(customFieldDefs)
        .where(
          and(
            eq(customFieldDefs.id, input.id),
            eq(customFieldDefs.accountId, input.accountId)
          )
        );

      return { success: true };
    }),

  // Reorder field definitions (bulk update sort orders)
  reorder: protectedProcedure
    .input(
      z.object({
        accountId: z.number().int().positive(),
        order: z.array(
          z.object({
            id: z.number().int().positive(),
            sortOrder: z.number().int().min(0),
          })
        ),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await requireAccountMember(ctx.user.id, input.accountId, ctx.user.role);
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      for (const item of input.order) {
        await db
          .update(customFieldDefs)
          .set({ sortOrder: item.sortOrder })
          .where(
            and(
              eq(customFieldDefs.id, item.id),
              eq(customFieldDefs.accountId, input.accountId)
            )
          );
      }

      return { success: true };
    }),
});
