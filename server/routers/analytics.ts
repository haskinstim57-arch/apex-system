import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { TRPCError } from "@trpc/server";
import { getMember, getDb } from "../db";
import {
  contacts,
  messages,
  aiCalls,
  deals,
  pipelineStages,
  appointments,
  campaigns,
  campaignRecipients,
} from "../../drizzle/schema";
import { and, eq, gte, lte, sql, count } from "drizzle-orm";

// ─── Helpers ───

async function requireAccountMember(userId: number, accountId: number, userRole?: string) {
  if (userRole === "admin") {
    const member = await getMember(accountId, userId);
    if (member) return member;
    // Admin can access any account even without membership
    return { userId, accountId, role: "owner" as const, isActive: true };
  }
  const member = await getMember(accountId, userId);
  if (!member || !member.isActive) {
    throw new TRPCError({ code: "FORBIDDEN", message: "You do not have access to this account" });
  }
  return member;
}

const periodInput = z.object({
  accountId: z.number(),
  days: z.number().min(1).max(365).default(30),
});

function getPeriodDates(days: number) {
  const now = new Date();
  const periodStart = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
  const prevPeriodStart = new Date(periodStart.getTime() - days * 24 * 60 * 60 * 1000);
  return { now, periodStart, prevPeriodStart };
}

function calcChange(current: number, previous: number): number {
  if (previous === 0) return current > 0 ? 100 : 0;
  return Math.round(((current - previous) / previous) * 100);
}

// ─── Router ───

export const analyticsRouter = router({
  /** KPI summary cards with period-over-period change */
  kpis: protectedProcedure.input(periodInput).query(async ({ ctx, input }) => {
    await requireAccountMember(ctx.user.id, input.accountId, ctx.user.role);
    const db = (await getDb())!;
    const { periodStart, prevPeriodStart } = getPeriodDates(input.days);

    // Total contacts
    const [totalContacts] = await db
      .select({ count: count() })
      .from(contacts)
      .where(eq(contacts.accountId, input.accountId));

    // New contacts this period
    const [newContactsCurrent] = await db
      .select({ count: count() })
      .from(contacts)
      .where(
        and(
          eq(contacts.accountId, input.accountId),
          gte(contacts.createdAt, periodStart)
        )
      );

    // New contacts previous period
    const [newContactsPrev] = await db
      .select({ count: count() })
      .from(contacts)
      .where(
        and(
          eq(contacts.accountId, input.accountId),
          gte(contacts.createdAt, prevPeriodStart),
          lte(contacts.createdAt, periodStart)
        )
      );

    // Messages sent this period (outbound only)
    const [msgCurrent] = await db
      .select({ count: count() })
      .from(messages)
      .where(
        and(
          eq(messages.accountId, input.accountId),
          eq(messages.direction, "outbound"),
          gte(messages.createdAt, periodStart)
        )
      );

    const [msgPrev] = await db
      .select({ count: count() })
      .from(messages)
      .where(
        and(
          eq(messages.accountId, input.accountId),
          eq(messages.direction, "outbound"),
          gte(messages.createdAt, prevPeriodStart),
          lte(messages.createdAt, periodStart)
        )
      );

    // AI Calls this period
    const [callsCurrent] = await db
      .select({ count: count() })
      .from(aiCalls)
      .where(
        and(
          eq(aiCalls.accountId, input.accountId),
          gte(aiCalls.createdAt, periodStart)
        )
      );

    const [callsPrev] = await db
      .select({ count: count() })
      .from(aiCalls)
      .where(
        and(
          eq(aiCalls.accountId, input.accountId),
          gte(aiCalls.createdAt, prevPeriodStart),
          lte(aiCalls.createdAt, periodStart)
        )
      );

    // Completed calls for completion rate
    const [callsCompleted] = await db
      .select({ count: count() })
      .from(aiCalls)
      .where(
        and(
          eq(aiCalls.accountId, input.accountId),
          eq(aiCalls.status, "completed"),
          gte(aiCalls.createdAt, periodStart)
        )
      );

    // Pipeline value (total deal value)
    const [pipelineValue] = await db
      .select({ total: sql<number>`COALESCE(SUM(${deals.value}), 0)` })
      .from(deals)
      .where(eq(deals.accountId, input.accountId));

    const [pipelineValuePrev] = await db
      .select({ total: sql<number>`COALESCE(SUM(${deals.value}), 0)` })
      .from(deals)
      .where(
        and(
          eq(deals.accountId, input.accountId),
          lte(deals.createdAt, periodStart)
        )
      );

    // Appointments booked this period
    const [apptsCurrent] = await db
      .select({ count: count() })
      .from(appointments)
      .where(
        and(
          eq(appointments.accountId, input.accountId),
          gte(appointments.createdAt, periodStart)
        )
      );

    const [apptsPrev] = await db
      .select({ count: count() })
      .from(appointments)
      .where(
        and(
          eq(appointments.accountId, input.accountId),
          gte(appointments.createdAt, prevPeriodStart),
          lte(appointments.createdAt, periodStart)
        )
      );

    // Campaigns sent this period
    const [campsCurrent] = await db
      .select({ count: count() })
      .from(campaigns)
      .where(
        and(
          eq(campaigns.accountId, input.accountId),
          eq(campaigns.status, "sent"),
          gte(campaigns.createdAt, periodStart)
        )
      );

    const [campsPrev] = await db
      .select({ count: count() })
      .from(campaigns)
      .where(
        and(
          eq(campaigns.accountId, input.accountId),
          eq(campaigns.status, "sent"),
          gte(campaigns.createdAt, prevPeriodStart),
          lte(campaigns.createdAt, periodStart)
        )
      );

    const callsCurrentCount = callsCurrent?.count ?? 0;
    const completedCount = callsCompleted?.count ?? 0;
    const completionRate = callsCurrentCount > 0 ? Math.round((completedCount / callsCurrentCount) * 100) : 0;

    return {
      totalContacts: totalContacts?.count ?? 0,
      newContacts: newContactsCurrent?.count ?? 0,
      contactsChange: calcChange(newContactsCurrent?.count ?? 0, newContactsPrev?.count ?? 0),
      messagesSent: msgCurrent?.count ?? 0,
      messagesChange: calcChange(msgCurrent?.count ?? 0, msgPrev?.count ?? 0),
      aiCallsMade: callsCurrentCount,
      callCompletionRate: completionRate,
      callsChange: calcChange(callsCurrentCount, callsPrev?.count ?? 0),
      pipelineValue: Number(pipelineValue?.total) || 0,
      pipelineChange: calcChange(Number(pipelineValue?.total) || 0, Number(pipelineValuePrev?.total) || 0),
      appointmentsBooked: apptsCurrent?.count ?? 0,
      appointmentsChange: calcChange(apptsCurrent?.count ?? 0, apptsPrev?.count ?? 0),
      campaignsSent: campsCurrent?.count ?? 0,
      campaignsChange: calcChange(campsCurrent?.count ?? 0, campsPrev?.count ?? 0),
    };
  }),

  /** Contacts growth — new contacts per day */
  contactsGrowth: protectedProcedure.input(periodInput).query(async ({ ctx, input }) => {
    await requireAccountMember(ctx.user.id, input.accountId, ctx.user.role);
    const db = (await getDb())!;
    const { periodStart } = getPeriodDates(input.days);

    const rows = await db.execute(
      sql`SELECT DATE_FORMAT(createdAt, '%Y-%m-%d') AS d, COUNT(*) AS cnt
          FROM contacts
          WHERE accountId = ${input.accountId} AND createdAt >= ${periodStart}
          GROUP BY d ORDER BY d`
    );

    return (rows[0] as unknown as any[]).map((r: any) => ({ date: String(r.d), count: Number(r.cnt) }));
  }),

  /** Messages by channel — SMS vs email per day */
  messagesByChannel: protectedProcedure.input(periodInput).query(async ({ ctx, input }) => {
    await requireAccountMember(ctx.user.id, input.accountId, ctx.user.role);
    const db = (await getDb())!;
    const { periodStart } = getPeriodDates(input.days);

    const rows = await db.execute(
      sql`SELECT DATE_FORMAT(createdAt, '%Y-%m-%d') AS d, type, COUNT(*) AS cnt
          FROM messages
          WHERE accountId = ${input.accountId} AND direction = 'outbound' AND createdAt >= ${periodStart}
          GROUP BY d, type ORDER BY d`
    );

    // Pivot into { date, sms, email }
    const dateMap = new Map<string, { date: string; sms: number; email: number }>();
    for (const row of rows[0] as unknown as any[]) {
      const dateStr = String(row.d);
      if (!dateMap.has(dateStr)) {
        dateMap.set(dateStr, { date: dateStr, sms: 0, email: 0 });
      }
      const entry = dateMap.get(dateStr)!;
      if (row.type === "sms") entry.sms = Number(row.cnt);
      else if (row.type === "email") entry.email = Number(row.cnt);
    }
    return Array.from(dateMap.values());
  }),

  /** Call outcomes — completed / no-answer / failed */
  callOutcomes: protectedProcedure.input(periodInput).query(async ({ ctx, input }) => {
    await requireAccountMember(ctx.user.id, input.accountId, ctx.user.role);
    const db = (await getDb())!;
    const { periodStart } = getPeriodDates(input.days);

    const rows = await db
      .select({
        status: aiCalls.status,
        count: count(),
      })
      .from(aiCalls)
      .where(
        and(
          eq(aiCalls.accountId, input.accountId),
          gte(aiCalls.createdAt, periodStart)
        )
      )
      .groupBy(aiCalls.status);

    return rows.map((r) => ({ status: r.status, count: r.count }));
  }),

  /** Pipeline by stage — deal count and value per stage */
  pipelineByStage: protectedProcedure.input(periodInput).query(async ({ ctx, input }) => {
    await requireAccountMember(ctx.user.id, input.accountId, ctx.user.role);
    const db = (await getDb())!;

    const rows = await db
      .select({
        stageId: deals.stageId,
        stageName: pipelineStages.name,
        stageColor: pipelineStages.color,
        dealCount: count(),
        totalValue: sql<number>`COALESCE(SUM(${deals.value}), 0)`,
      })
      .from(deals)
      .innerJoin(pipelineStages, eq(deals.stageId, pipelineStages.id))
      .where(eq(deals.accountId, input.accountId))
      .groupBy(deals.stageId, pipelineStages.name, pipelineStages.color);

    return rows.map((r) => ({
      stageId: r.stageId,
      stageName: r.stageName,
      stageColor: r.stageColor,
      dealCount: r.dealCount,
      totalValue: r.totalValue,
    }));
  }),

  /** Campaign performance — each campaign with stats */
  campaignPerformance: protectedProcedure.input(periodInput).query(async ({ ctx, input }) => {
    await requireAccountMember(ctx.user.id, input.accountId, ctx.user.role);
    const db = (await getDb())!;
    const { periodStart } = getPeriodDates(input.days);

    // Get campaigns in period
    const campRows = await db
      .select()
      .from(campaigns)
      .where(
        and(
          eq(campaigns.accountId, input.accountId),
          gte(campaigns.createdAt, periodStart)
        )
      )
      .orderBy(sql`${campaigns.createdAt} DESC`)
      .limit(20);

    if (campRows.length === 0) return [];

    const results = [];
    for (const camp of campRows) {
      // Get recipient stats
      const recipientStats = await db
        .select({
          status: campaignRecipients.status,
          count: count(),
        })
        .from(campaignRecipients)
        .where(eq(campaignRecipients.campaignId, camp.id))
        .groupBy(campaignRecipients.status);

      const statusMap: Record<string, number> = {};
      let totalRecipients = 0;
      for (const s of recipientStats) {
        statusMap[s.status] = s.count;
        totalRecipients += s.count;
      }

      const delivered = (statusMap["delivered"] ?? 0) + (statusMap["opened"] ?? 0) + (statusMap["clicked"] ?? 0);
      const deliveryRate = totalRecipients > 0 ? Math.round((delivered / totalRecipients) * 100) : 0;
      const replied = statusMap["clicked"] ?? 0;
      const replyRate = totalRecipients > 0 ? Math.round((replied / totalRecipients) * 100) : 0;

      results.push({
        id: camp.id,
        name: camp.name,
        type: camp.type,
        status: camp.status,
        sentCount: totalRecipients,
        deliveryRate,
        replyRate,
        createdAt: camp.createdAt,
      });
    }

    return results;
  }),

  /** Appointments by status — confirmed / pending / cancelled */
  appointmentsByStatus: protectedProcedure.input(periodInput).query(async ({ ctx, input }) => {
    await requireAccountMember(ctx.user.id, input.accountId, ctx.user.role);
    const db = (await getDb())!;
    const { periodStart } = getPeriodDates(input.days);

    const rows = await db
      .select({
        status: appointments.status,
        count: count(),
      })
      .from(appointments)
      .where(
        and(
          eq(appointments.accountId, input.accountId),
          gte(appointments.createdAt, periodStart)
        )
      )
      .groupBy(appointments.status);

    return rows.map((r) => ({ status: r.status, count: r.count }));
  }),
});
