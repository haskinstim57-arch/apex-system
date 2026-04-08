import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { getDb } from "../db";
import { recurringContentPlans } from "../../drizzle/schema";
import { eq, and, desc } from "drizzle-orm";
import { computeNextRunAt, runRecurringPlan } from "../services/recurringContentWorker";
import { TRPCError } from "@trpc/server";
import { requireAccountMember } from "./contacts";

export const recurringContentPlansRouter = router({
  list: protectedProcedure
    .input(z.object({ accountId: z.number() }))
    .query(async ({ ctx, input }) => {
      await requireAccountMember(ctx.user!.id, input.accountId, ctx.user!.role);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
      return db
        .select()
        .from(recurringContentPlans)
        .where(eq(recurringContentPlans.accountId, input.accountId))
        .orderBy(desc(recurringContentPlans.createdAt));
    }),

  create: protectedProcedure
    .input(
      z.object({
        accountId: z.number(),
        name: z.string().min(1).max(255),
        contentType: z.enum(["blog", "social"]),
        platform: z.string().optional(),
        frequency: z.enum(["daily", "weekly", "biweekly", "monthly"]),
        postsPerCycle: z.number().min(1).max(10).default(1),
        topicTemplate: z.string().min(1),
        customPrompt: z.string().optional(),
        aiModel: z.string().optional(),
        enableWebResearch: z.boolean().default(false),
        enableImageGeneration: z.boolean().default(false),
        tone: z.string().default("professional"),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await requireAccountMember(ctx.user!.id, input.accountId, ctx.user!.role);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
      const nextRunAt = computeNextRunAt(input.frequency);
      const [result] = await db.insert(recurringContentPlans).values({
        accountId: input.accountId,
        name: input.name,
        contentType: input.contentType,
        platform: input.platform,
        frequency: input.frequency,
        postsPerCycle: input.postsPerCycle,
        topicTemplate: input.topicTemplate,
        customPrompt: input.customPrompt,
        aiModel: input.aiModel,
        enableWebResearch: input.enableWebResearch,
        enableImageGeneration: input.enableImageGeneration,
        tone: input.tone,
        nextRunAt,
      });
      return { id: result.insertId };
    }),

  update: protectedProcedure
    .input(
      z.object({
        accountId: z.number(),
        id: z.number(),
        name: z.string().optional(),
        frequency: z.enum(["daily", "weekly", "biweekly", "monthly"]).optional(),
        postsPerCycle: z.number().min(1).max(10).optional(),
        topicTemplate: z.string().optional(),
        customPrompt: z.string().optional(),
        aiModel: z.string().optional(),
        enableWebResearch: z.boolean().optional(),
        enableImageGeneration: z.boolean().optional(),
        tone: z.string().optional(),
        isActive: z.boolean().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await requireAccountMember(ctx.user!.id, input.accountId, ctx.user!.role);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
      const { id, accountId, ...data } = input;
      const updates: Record<string, any> = { ...data };
      if (data.frequency) {
        updates.nextRunAt = computeNextRunAt(data.frequency);
      }
      await db
        .update(recurringContentPlans)
        .set(updates)
        .where(
          and(
            eq(recurringContentPlans.id, id),
            eq(recurringContentPlans.accountId, accountId)
          )
        );
      return { success: true };
    }),

  delete: protectedProcedure
    .input(z.object({ accountId: z.number(), id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      await requireAccountMember(ctx.user!.id, input.accountId, ctx.user!.role);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
      await db
        .delete(recurringContentPlans)
        .where(
          and(
            eq(recurringContentPlans.id, input.id),
            eq(recurringContentPlans.accountId, input.accountId)
          )
        );
      return { success: true };
    }),

  runNow: protectedProcedure
    .input(z.object({ accountId: z.number(), id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      await requireAccountMember(ctx.user!.id, input.accountId, ctx.user!.role);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
      const [plan] = await db
        .select()
        .from(recurringContentPlans)
        .where(
          and(
            eq(recurringContentPlans.id, input.id),
            eq(recurringContentPlans.accountId, input.accountId)
          )
        );
      if (!plan) throw new TRPCError({ code: "NOT_FOUND", message: "Plan not found" });
      const results = await runRecurringPlan(plan);
      return results;
    }),
});
