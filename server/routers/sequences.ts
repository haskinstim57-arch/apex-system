import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure } from "../_core/trpc";
import { requireAccountMember } from "./contacts";
import {
  createSequence,
  listSequences,
  getSequenceById,
  updateSequence,
  deleteSequence,
  listSequenceSteps,
  createSequenceStep,
  updateSequenceStep,
  deleteSequenceStep,
  reorderSequenceSteps,
  enrollContactInSequence,
  unenrollContact,
  listSequenceEnrollments,
  getContactEnrollments,
  getDb,
  logContactActivity,
  getOrCreateWarmingConfig,
} from "../db";
import { computeFirstStepAt } from "../services/dripEngine";
import { sequenceSteps, sequenceEnrollments, messages } from "../../drizzle/schema";
import { eq, and, sql, count, gte, inArray, isNotNull } from "drizzle-orm";

export const sequencesRouter = router({
  /** List all sequences for an account */
  list: protectedProcedure
    .input(z.object({ accountId: z.number().int().positive() }))
    .query(async ({ input, ctx }) => {
      await requireAccountMember(ctx.user.id, input.accountId, ctx.user.role);
      return listSequences(input.accountId);
    }),

  /** Get a single sequence with its steps */
  get: protectedProcedure
    .input(z.object({ id: z.number().int().positive(), accountId: z.number().int().positive() }))
    .query(async ({ input, ctx }) => {
      await requireAccountMember(ctx.user.id, input.accountId, ctx.user.role);
      const seq = await getSequenceById(input.id, input.accountId);
      if (!seq) throw new TRPCError({ code: "NOT_FOUND", message: "Sequence not found" });
      const steps = await listSequenceSteps(input.id);
      return { ...seq, steps };
    }),

  /** Create a new sequence */
  create: protectedProcedure
    .input(
      z.object({
        accountId: z.number().int().positive(),
        name: z.string().min(1).max(255),
        description: z.string().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      await requireAccountMember(ctx.user.id, input.accountId, ctx.user.role);
      const { id } = await createSequence({
        accountId: input.accountId,
        name: input.name,
        description: input.description || null,
        createdById: ctx.user.id,
      });
      return { id };
    }),

  /** Update sequence name, description, or status */
  update: protectedProcedure
    .input(
      z.object({
        id: z.number().int().positive(),
        accountId: z.number().int().positive(),
        name: z.string().min(1).max(255).optional(),
        description: z.string().optional(),
        status: z.enum(["active", "paused", "draft", "archived"]).optional(),
        activateAt: z.string().datetime().nullable().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      await requireAccountMember(ctx.user.id, input.accountId, ctx.user.role);
      const data: Record<string, unknown> = {};
      if (input.name !== undefined) data.name = input.name;
      if (input.description !== undefined) data.description = input.description;
      if (input.status !== undefined) data.status = input.status;
      if (input.activateAt !== undefined) data.activateAt = input.activateAt ? new Date(input.activateAt) : null;
      await updateSequence(input.id, input.accountId, data as any);
      return { success: true };
    }),

  /** Delete a sequence and all its steps/enrollments */
  delete: protectedProcedure
    .input(z.object({ id: z.number().int().positive(), accountId: z.number().int().positive() }))
    .mutation(async ({ input, ctx }) => {
      await requireAccountMember(ctx.user.id, input.accountId, ctx.user.role);
      await deleteSequence(input.id, input.accountId);
      return { success: true };
    }),

  // ─── Steps ───

  /** Add a step to a sequence */
  addStep: protectedProcedure
    .input(
      z.object({
        sequenceId: z.number().int().positive(),
        accountId: z.number().int().positive(),
        position: z.number().int().positive(),
        delayDays: z.number().int().min(0).default(0),
        delayHours: z.number().int().min(0).max(23).default(0),
        messageType: z.enum(["sms", "email"]),
        subject: z.string().max(500).optional(),
        content: z.string().min(1),
        templateId: z.number().int().positive().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      await requireAccountMember(ctx.user.id, input.accountId, ctx.user.role);
      const seq = await getSequenceById(input.sequenceId, input.accountId);
      if (!seq) throw new TRPCError({ code: "NOT_FOUND", message: "Sequence not found" });
      const { id } = await createSequenceStep({
        sequenceId: input.sequenceId,
        position: input.position,
        delayDays: input.delayDays,
        delayHours: input.delayHours,
        messageType: input.messageType,
        subject: input.subject || null,
        content: input.content,
        templateId: input.templateId || null,
      });
      return { id };
    }),

  /** Update a step */
  updateStep: protectedProcedure
    .input(
      z.object({
        id: z.number().int().positive(),
        sequenceId: z.number().int().positive(),
        accountId: z.number().int().positive(),
        delayDays: z.number().int().min(0).optional(),
        delayHours: z.number().int().min(0).max(23).optional(),
        messageType: z.enum(["sms", "email"]).optional(),
        subject: z.string().max(500).optional(),
        content: z.string().min(1).optional(),
        templateId: z.number().int().positive().nullable().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      await requireAccountMember(ctx.user.id, input.accountId, ctx.user.role);
      const data: Record<string, unknown> = {};
      if (input.delayDays !== undefined) data.delayDays = input.delayDays;
      if (input.delayHours !== undefined) data.delayHours = input.delayHours;
      if (input.messageType !== undefined) data.messageType = input.messageType;
      if (input.subject !== undefined) data.subject = input.subject;
      if (input.content !== undefined) data.content = input.content;
      if (input.templateId !== undefined) data.templateId = input.templateId;
      await updateSequenceStep(input.id, input.sequenceId, data as any);
      return { success: true };
    }),

  /** Delete a step (auto-reorders remaining) */
  deleteStep: protectedProcedure
    .input(
      z.object({
        id: z.number().int().positive(),
        sequenceId: z.number().int().positive(),
        accountId: z.number().int().positive(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      await requireAccountMember(ctx.user.id, input.accountId, ctx.user.role);
      await deleteSequenceStep(input.id, input.sequenceId);
      return { success: true };
    }),

  /** Reorder steps */
  reorderSteps: protectedProcedure
    .input(
      z.object({
        sequenceId: z.number().int().positive(),
        accountId: z.number().int().positive(),
        stepIds: z.array(z.number().int().positive()),
      })
    )
    .mutation(async ({ input, ctx }) => {
      await requireAccountMember(ctx.user.id, input.accountId, ctx.user.role);
      await reorderSequenceSteps(input.sequenceId, input.stepIds);
      return { success: true };
    }),

  // ─── Enrollments ───

  /** Enroll a contact in a sequence */
  enroll: protectedProcedure
    .input(
      z.object({
        sequenceId: z.number().int().positive(),
        contactId: z.number().int().positive(),
        accountId: z.number().int().positive(),
        source: z.enum(["manual", "workflow", "campaign", "api"]).default("manual"),
        sourceId: z.number().int().positive().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      await requireAccountMember(ctx.user.id, input.accountId, ctx.user.role);
      const seq = await getSequenceById(input.sequenceId, input.accountId);
      if (!seq) throw new TRPCError({ code: "NOT_FOUND", message: "Sequence not found" });
      if (seq.status !== "active" && seq.status !== "draft") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Sequence is not active" });
      }
      // Get first step to compute delay
      const steps = await listSequenceSteps(input.sequenceId);
      const firstStep = steps[0];
      const nextStepAt = firstStep
        ? computeFirstStepAt(firstStep.delayDays, firstStep.delayHours)
        : new Date(Date.now() + 60000);

      const { id, alreadyEnrolled } = await enrollContactInSequence({
        sequenceId: input.sequenceId,
        contactId: input.contactId,
        accountId: input.accountId,
        currentStep: 0,
        status: "active",
        nextStepAt,
        enrollmentSource: input.source,
        sourceId: input.sourceId || null,
      });

      if (!alreadyEnrolled) {
        await logContactActivity({
          contactId: input.contactId,
          accountId: input.accountId,
          activityType: "automation_triggered",
          description: `Enrolled in sequence "${seq.name}"`,
          metadata: JSON.stringify({
            sequenceId: seq.id,
            sequenceName: seq.name,
            source: input.source,
          }),
        });
      }

      return { id, alreadyEnrolled };
    }),

  /** Bulk enroll multiple contacts */
  bulkEnroll: protectedProcedure
    .input(
      z.object({
        sequenceId: z.number().int().positive(),
        contactIds: z.array(z.number().int().positive()),
        accountId: z.number().int().positive(),
        source: z.enum(["manual", "workflow", "campaign", "api"]).default("manual"),
      })
    )
    .mutation(async ({ input, ctx }) => {
      await requireAccountMember(ctx.user.id, input.accountId, ctx.user.role);
      const seq = await getSequenceById(input.sequenceId, input.accountId);
      if (!seq) throw new TRPCError({ code: "NOT_FOUND", message: "Sequence not found" });

      const steps = await listSequenceSteps(input.sequenceId);
      const firstStep = steps[0];
      const nextStepAt = firstStep
        ? computeFirstStepAt(firstStep.delayDays, firstStep.delayHours)
        : new Date(Date.now() + 60000);

      let enrolled = 0;
      let skipped = 0;
      for (const contactId of input.contactIds) {
        const { alreadyEnrolled } = await enrollContactInSequence({
          sequenceId: input.sequenceId,
          contactId,
          accountId: input.accountId,
          currentStep: 0,
          status: "active",
          nextStepAt,
          enrollmentSource: input.source,
        });
        if (alreadyEnrolled) {
          skipped++;
        } else {
          enrolled++;
        }
      }
      return { enrolled, skipped };
    }),

  /** Unenroll a contact */
  unenroll: protectedProcedure
    .input(
      z.object({
        enrollmentId: z.number().int().positive(),
        accountId: z.number().int().positive(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      await requireAccountMember(ctx.user.id, input.accountId, ctx.user.role);
      await unenrollContact(input.enrollmentId, input.accountId);
      return { success: true };
    }),

  /** List enrollments for a sequence */
  listEnrollments: protectedProcedure
    .input(
      z.object({
        sequenceId: z.number().int().positive(),
        accountId: z.number().int().positive(),
        status: z.enum(["active", "completed", "paused", "failed", "unenrolled"]).optional(),
      })
    )
    .query(async ({ input, ctx }) => {
      await requireAccountMember(ctx.user.id, input.accountId, ctx.user.role);
      return listSequenceEnrollments(input.sequenceId, input.accountId, input.status);
    }),

  /** Get enrollments for a specific contact */
  contactEnrollments: protectedProcedure
    .input(
      z.object({
        contactId: z.number().int().positive(),
        accountId: z.number().int().positive(),
      })
    )
    .query(async ({ input, ctx }) => {
      await requireAccountMember(ctx.user.id, input.accountId, ctx.user.role);
      return getContactEnrollments(input.contactId, input.accountId);
    }),

  // ─── Webinar Config ───

  /** Replace placeholders in all steps of a sequence */
  updatePlaceholders: protectedProcedure
    .input(
      z.object({
        sequenceId: z.number().int().positive(),
        accountId: z.number().int().positive(),
        replacements: z.array(
          z.object({
            placeholder: z.string(),
            value: z.string(),
          })
        ),
      })
    )
    .mutation(async ({ input, ctx }) => {
      await requireAccountMember(ctx.user.id, input.accountId, ctx.user.role);
      const seq = await getSequenceById(input.sequenceId, input.accountId);
      if (!seq) throw new TRPCError({ code: "NOT_FOUND", message: "Sequence not found" });
      const steps = await listSequenceSteps(input.sequenceId);
      let updatedSteps = 0;
      for (const step of steps) {
        let content = step.content;
        let subject = step.subject || "";
        let changed = false;
        for (const { placeholder, value } of input.replacements) {
          if (content.includes(placeholder)) {
            content = content.split(placeholder).join(value);
            changed = true;
          }
          if (subject.includes(placeholder)) {
            subject = subject.split(placeholder).join(value);
            changed = true;
          }
        }
        if (changed) {
          const data: Record<string, unknown> = { content };
          if (step.subject !== null) data.subject = subject;
          await updateSequenceStep(step.id, input.sequenceId, data as any);
          updatedSteps++;
        }
      }
      return { updatedSteps };
    }),

  // ─── Performance Stats ───

  /** Get performance statistics for a sequence */
  getStats: protectedProcedure
    .input(
      z.object({
        sequenceId: z.number().int().positive(),
        accountId: z.number().int().positive(),
      })
    )
    .query(async ({ input, ctx }) => {
      await requireAccountMember(ctx.user.id, input.accountId, ctx.user.role);
      const db = (await getDb())!;

      // 1. Status breakdown
      const statusRows = await db
        .select({
          status: sequenceEnrollments.status,
          cnt: count(),
        })
        .from(sequenceEnrollments)
        .where(
          and(
            eq(sequenceEnrollments.sequenceId, input.sequenceId),
            eq(sequenceEnrollments.accountId, input.accountId)
          )
        )
        .groupBy(sequenceEnrollments.status);

      const statusBreakdown = {
        active: 0,
        completed: 0,
        paused: 0,
        failed: 0,
        unenrolled: 0,
      };
      let total = 0;
      for (const row of statusRows) {
        statusBreakdown[row.status] = row.cnt;
        total += row.cnt;
      }

      // 2. Completion rate (exclude unenrolled from denominator)
      const denominator = total - statusBreakdown.unenrolled;
      const completionRate =
        denominator > 0
          ? Math.round((statusBreakdown.completed / denominator) * 1000) / 10
          : 0;

      // 3. Step distribution
      const stepRows = await db
        .select({
          step: sequenceEnrollments.currentStep,
          cnt: count(),
        })
        .from(sequenceEnrollments)
        .where(
          and(
            eq(sequenceEnrollments.sequenceId, input.sequenceId),
            eq(sequenceEnrollments.accountId, input.accountId),
            eq(sequenceEnrollments.status, "active")
          )
        )
        .groupBy(sequenceEnrollments.currentStep);

      const stepDistribution = stepRows.map((r) => ({
        step: r.step,
        count: r.cnt,
      }));

      // 4. Enrollment source breakdown
      const sourceRows = await db
        .select({
          source: sequenceEnrollments.enrollmentSource,
          cnt: count(),
        })
        .from(sequenceEnrollments)
        .where(
          and(
            eq(sequenceEnrollments.sequenceId, input.sequenceId),
            eq(sequenceEnrollments.accountId, input.accountId)
          )
        )
        .groupBy(sequenceEnrollments.enrollmentSource);

      const sourceBreakdown: Record<string, number> = {
        manual: 0,
        workflow: 0,
        campaign: 0,
        api: 0,
      };
      for (const row of sourceRows) {
        if (row.source) sourceBreakdown[row.source] = row.cnt;
      }

      // 5. Enrollment trend — last 30 days
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const trendResult = await db.execute(
        sql`SELECT DATE(${sequenceEnrollments.enrolledAt}) as enrollment_date, COUNT(*) as cnt
            FROM ${sequenceEnrollments}
            WHERE ${sequenceEnrollments.sequenceId} = ${input.sequenceId}
              AND ${sequenceEnrollments.accountId} = ${input.accountId}
              AND ${sequenceEnrollments.enrolledAt} >= ${thirtyDaysAgo}
            GROUP BY enrollment_date
            ORDER BY enrollment_date`
      );

      const enrollmentTrend = (trendResult[0] as any[]).map((r: any) => ({
        date: r.enrollment_date instanceof Date
          ? r.enrollment_date.toISOString().split('T')[0]
          : String(r.enrollment_date),
        count: Number(r.cnt),
      }));

      // 6. Average time to complete (hours)
      const avgResult = await db
        .select({
          avgHours:
            sql<number>`AVG(TIMESTAMPDIFF(HOUR, ${sequenceEnrollments.enrolledAt}, ${sequenceEnrollments.completedAt}))`.as(
              "avgHours"
            ),
        })
        .from(sequenceEnrollments)
        .where(
          and(
            eq(sequenceEnrollments.sequenceId, input.sequenceId),
            eq(sequenceEnrollments.accountId, input.accountId),
            eq(sequenceEnrollments.status, "completed")
          )
        );

      const avgCompletionHours = avgResult[0]?.avgHours ?? null;

      return {
        statusBreakdown: { ...statusBreakdown, total },
        completionRate,
        stepDistribution,
        sourceBreakdown,
        enrollmentTrend,
        avgCompletionHours,
      };
    }),

  // ─── Step-Level Analytics ───

  getStepAnalytics: protectedProcedure
    .input(z.object({ sequenceId: z.number(), accountId: z.number() }))
    .query(async ({ input, ctx }) => {
      await requireAccountMember(ctx.user!.id, input.accountId, ctx.user!.role);
      const db = await getDb();
      if (!db) return [];

      // Get all steps for context
      const steps = await listSequenceSteps(input.sequenceId);
      if (steps.length === 0) return [];

      const stepIds = steps.map((s) => s.id);

      // Get message stats grouped by step position
      const msgStats = await db
        .select({
          stepPosition: messages.sequenceStepPosition,
          sent: count(),
          delivered: sql<number>`SUM(CASE WHEN ${messages.status} = 'delivered' THEN 1 ELSE 0 END)`,
          failed: sql<number>`SUM(CASE WHEN ${messages.status} = 'failed' THEN 1 ELSE 0 END)`,
        })
        .from(messages)
        .where(
          and(
            eq(messages.accountId, input.accountId),
            isNotNull(messages.sequenceStepId),
            inArray(messages.sequenceStepId, stepIds)
          )
        )
        .groupBy(messages.sequenceStepPosition);

      const statsMap = new Map(
        msgStats.map((r) => [r.stepPosition, r])
      );

      // For reply rate: count inbound messages from contacts who received a step message
      // For each step, find contacts who got that step, then count inbound messages after
      const replyMap = new Map<number, number>();
      for (const step of steps) {
        const replyResult = await db
          .select({ replyCount: sql<number>`COUNT(DISTINCT inb.contactId)` })
          .from(
            sql`(
              SELECT m1.contactId, m1.createdAt as sentAt
              FROM messages m1
              WHERE m1.accountId = ${input.accountId}
                AND m1.sequence_step_id = ${step.id}
                AND m1.direction = 'outbound'
            ) AS outb`
          )
          .innerJoin(
            sql`messages AS inb`,
            sql`inb.contactId = outb.contactId AND inb.direction = 'inbound' AND inb.createdAt > outb.sentAt AND inb.createdAt <= DATE_ADD(outb.sentAt, INTERVAL 48 HOUR)`
          );
        replyMap.set(step.position, Number(replyResult[0]?.replyCount ?? 0));
      }

      return steps.map((step) => {
        const stat = statsMap.get(step.position);
        const sent = Number(stat?.sent ?? 0);
        const delivered = Number(stat?.delivered ?? 0);
        const failed = Number(stat?.failed ?? 0);
        const replyCount = replyMap.get(step.position) ?? 0;
        return {
          position: step.position,
          messageType: step.messageType,
          delayDays: step.delayDays,
          content: step.content,
          subject: step.subject,
          sent,
          delivered,
          failed,
          deliveryRate: sent > 0 ? Math.round((delivered / sent) * 100) : 0,
          replyCount,
          replyRate: sent > 0 ? Math.round((replyCount / sent) * 100) : 0,
        };
      });
    }),

  // ─── Clone Sequence ───

  /** Clone a sequence with all its steps */
  clone: protectedProcedure
    .input(
      z.object({
        sequenceId: z.number().int().positive(),
        accountId: z.number().int().positive(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      await requireAccountMember(ctx.user.id, input.accountId, ctx.user.role);
      const seq = await getSequenceById(input.sequenceId, input.accountId);
      if (!seq) throw new TRPCError({ code: "NOT_FOUND", message: "Sequence not found" });

      const steps = await listSequenceSteps(input.sequenceId);

      // Create the clone
      const newName = `Copy of ${seq.name}`;
      const { id: newId } = await createSequence({
        accountId: input.accountId,
        name: newName,
        description: seq.description || null,
        createdById: ctx.user.id,
      });

      // Copy all steps
      for (const step of steps) {
        await createSequenceStep({
          sequenceId: newId,
          position: step.position,
          delayDays: step.delayDays,
          delayHours: step.delayHours,
          messageType: step.messageType,
          subject: step.subject || null,
          content: step.content,
          templateId: step.templateId || null,
        });
      }

      return { id: newId, name: newName, isTemplate: seq.name.includes("[TEMPLATE]") };
    }),

  // ─── Email Warming ───

  /** Get warming config for an account */
  getWarmingConfig: protectedProcedure
    .input(z.object({ accountId: z.number().int().positive() }))
    .query(async ({ input, ctx }) => {
      await requireAccountMember(ctx.user.id, input.accountId, ctx.user.role);
      const config = await getOrCreateWarmingConfig(input.accountId);
      // Calculate days since warming started
      const daysSinceStart = Math.floor(
        (Date.now() - config.warmingStartDate.getTime()) / 86400000
      );
      return {
        ...config,
        daysSinceStart,
        warmingComplete: config.currentDailyLimit >= config.maxDailyLimit,
      };
    }),

  /** Update warming config settings */
  updateWarmingConfig: protectedProcedure
    .input(
      z.object({
        accountId: z.number().int().positive(),
        enabled: z.boolean().optional(),
        startDailyLimit: z.number().int().min(1).max(1000).optional(),
        maxDailyLimit: z.number().int().min(1).max(10000).optional(),
        rampUpPerDay: z.number().int().min(1).max(100).optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      await requireAccountMember(ctx.user.id, input.accountId, ctx.user.role);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });

      const { emailWarmingConfig } = await import("../../drizzle/schema");
      const config = await getOrCreateWarmingConfig(input.accountId);

      const updates: Record<string, unknown> = {};
      if (input.enabled !== undefined) updates.enabled = input.enabled;
      if (input.startDailyLimit !== undefined) updates.startDailyLimit = input.startDailyLimit;
      if (input.maxDailyLimit !== undefined) updates.maxDailyLimit = input.maxDailyLimit;
      if (input.rampUpPerDay !== undefined) updates.rampUpPerDay = input.rampUpPerDay;

      if (Object.keys(updates).length > 0) {
        await db
          .update(emailWarmingConfig)
          .set(updates)
          .where(eq(emailWarmingConfig.id, config.id));
      }

      return { success: true };
    }),

  /** Reset warming — restart the warming period from day 0 */
  resetWarming: protectedProcedure
    .input(z.object({ accountId: z.number().int().positive() }))
    .mutation(async ({ input, ctx }) => {
      await requireAccountMember(ctx.user.id, input.accountId, ctx.user.role);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });

      const { emailWarmingConfig } = await import("../../drizzle/schema");
      const config = await getOrCreateWarmingConfig(input.accountId);

      await db
        .update(emailWarmingConfig)
        .set({
          warmingStartDate: new Date(),
          currentDailyLimit: config.startDailyLimit,
          todaySendCount: 0,
          lastResetDate: null,
        })
        .where(eq(emailWarmingConfig.id, config.id));

      return { success: true };
    }),
});
