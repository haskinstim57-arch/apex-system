import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { getDb } from "../db";
import { contacts, customFieldDefs } from "../../drizzle/schema";
import { eq, and, sql } from "drizzle-orm";
import { requireAccountMember } from "./contacts";

// ─── Types ───

interface DropdownDistribution {
  fieldId: number;
  name: string;
  slug: string;
  values: { label: string; count: number }[];
  total: number;
}

interface NumberStats {
  fieldId: number;
  name: string;
  slug: string;
  avg: number;
  min: number;
  max: number;
  sum: number;
  count: number;
}

interface CheckboxStats {
  fieldId: number;
  name: string;
  slug: string;
  trueCount: number;
  falseCount: number;
  total: number;
  percentage: number;
}

interface DateSummary {
  fieldId: number;
  name: string;
  slug: string;
  upcoming7d: number;
  upcoming30d: number;
  overdue: number;
  total: number;
}

// ─── Router ───

export const customFieldAnalyticsRouter = router({
  /** Get analytics for all custom fields in an account */
  getAnalytics: protectedProcedure
    .input(
      z.object({
        accountId: z.number().int().positive(),
      })
    )
    .query(async ({ ctx, input }) => {
      await requireAccountMember(ctx.user.id, input.accountId, ctx.user.role);
      const db = await getDb();
      if (!db) {
        return {
          dropdowns: [] as DropdownDistribution[],
          numbers: [] as NumberStats[],
          checkboxes: [] as CheckboxStats[],
          dates: [] as DateSummary[],
        };
      }

      // Get all active custom field definitions for this account
      const defs = await db
        .select()
        .from(customFieldDefs)
        .where(
          and(
            eq(customFieldDefs.accountId, input.accountId),
            eq(customFieldDefs.isActive, true)
          )
        );

      // Get all contacts with customFields for this account
      const allContacts = await db
        .select({ customFields: contacts.customFields })
        .from(contacts)
        .where(eq(contacts.accountId, input.accountId));

      // Parse all customFields JSON
      const parsedContacts = allContacts.map((c) => {
        try {
          return c.customFields ? JSON.parse(c.customFields) : {};
        } catch {
          return {};
        }
      });

      const dropdowns: DropdownDistribution[] = [];
      const numbers: NumberStats[] = [];
      const checkboxes: CheckboxStats[] = [];
      const dates: DateSummary[] = [];

      for (const def of defs) {
        const values = parsedContacts
          .map((cf) => cf[def.slug])
          .filter((v) => v !== undefined && v !== null && v !== "");

        if (def.type === "dropdown") {
          const countMap: Record<string, number> = {};
          for (const v of values) {
            const key = String(v);
            countMap[key] = (countMap[key] || 0) + 1;
          }
          const sorted = Object.entries(countMap)
            .map(([label, count]) => ({ label, count }))
            .sort((a, b) => b.count - a.count);

          dropdowns.push({
            fieldId: def.id,
            name: def.name,
            slug: def.slug,
            values: sorted,
            total: values.length,
          });
        } else if (def.type === "number") {
          const nums = values.map(Number).filter((n) => !isNaN(n));
          if (nums.length > 0) {
            numbers.push({
              fieldId: def.id,
              name: def.name,
              slug: def.slug,
              avg: nums.reduce((a, b) => a + b, 0) / nums.length,
              min: Math.min(...nums),
              max: Math.max(...nums),
              sum: nums.reduce((a, b) => a + b, 0),
              count: nums.length,
            });
          }
        } else if (def.type === "checkbox") {
          const trueCount = values.filter(
            (v) => v === true || v === "true" || v === 1 || v === "1"
          ).length;
          const total = parsedContacts.length; // all contacts, not just those with value
          checkboxes.push({
            fieldId: def.id,
            name: def.name,
            slug: def.slug,
            trueCount,
            falseCount: total - trueCount,
            total,
            percentage: total > 0 ? Math.round((trueCount / total) * 100) : 0,
          });
        } else if (def.type === "date") {
          const now = new Date();
          const in7d = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
          const in30d = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

          let upcoming7d = 0;
          let upcoming30d = 0;
          let overdue = 0;

          for (const v of values) {
            const d = new Date(v);
            if (isNaN(d.getTime())) continue;
            if (d < now) {
              overdue++;
            } else if (d <= in7d) {
              upcoming7d++;
            } else if (d <= in30d) {
              upcoming30d++;
            }
          }

          dates.push({
            fieldId: def.id,
            name: def.name,
            slug: def.slug,
            upcoming7d,
            upcoming30d,
            overdue,
            total: values.length,
          });
        }
      }

      return { dropdowns, numbers, checkboxes, dates };
    }),
});
