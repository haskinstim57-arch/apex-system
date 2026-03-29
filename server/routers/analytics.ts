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
  workflows,
  workflowExecutions,
  workflowExecutionSteps,
  invoices,
} from "../../drizzle/schema";
import { and, eq, gte, lte, sql, count, desc, isNotNull } from "drizzle-orm";

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

  // ─── Advanced Reporting ───

  /** Campaign ROI tracking — contacts generated, conversion, revenue per campaign */
  campaignROI: protectedProcedure.input(periodInput).query(async ({ ctx, input }) => {
    await requireAccountMember(ctx.user.id, input.accountId, ctx.user.role);
    const db = (await getDb())!;
    const { periodStart } = getPeriodDates(input.days);

    const campRows = await db
      .select()
      .from(campaigns)
      .where(
        and(
          eq(campaigns.accountId, input.accountId),
          gte(campaigns.createdAt, periodStart)
        )
      )
      .orderBy(desc(campaigns.createdAt))
      .limit(50);

    if (campRows.length === 0) return [];

    const results = [];
    for (const camp of campRows) {
      // Recipient stats
      const recipientStats = await db
        .select({ status: campaignRecipients.status, count: count() })
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
      const opened = statusMap["opened"] ?? 0;
      const clicked = statusMap["clicked"] ?? 0;

      // Contacts created from this campaign (via leadSource matching campaign name)
      const [contactsGenerated] = await db
        .select({ count: count() })
        .from(contacts)
        .where(
          and(
            eq(contacts.accountId, input.accountId),
            eq(contacts.leadSource, `campaign:${camp.id}`)
          )
        );

      // Revenue from deals linked to contacts generated by this campaign
      const [revenueResult] = await db.execute(
        sql`SELECT COALESCE(SUM(d.value), 0) AS revenue
            FROM deals d
            INNER JOIN contacts c ON d.contact_id = c.id
            WHERE d.account_id = ${input.accountId}
              AND c.leadSource = ${`campaign:${camp.id}`}`
      );
      const revenue = Number((revenueResult as any)?.revenue ?? 0);

      // Paid invoices from contacts in this campaign
      const [invoiceResult] = await db.execute(
        sql`SELECT COALESCE(SUM(i.amount_paid), 0) AS collected
            FROM invoices i
            INNER JOIN contacts c ON i.contact_id = c.id
            WHERE i.account_id = ${input.accountId}
              AND i.status = 'paid'
              AND c.leadSource = ${`campaign:${camp.id}`}`
      );
      const collected = Number((invoiceResult as any)?.collected ?? 0);

      const conversionRate = totalRecipients > 0
        ? Math.round(((contactsGenerated?.count ?? 0) / totalRecipients) * 100)
        : 0;

      results.push({
        id: camp.id,
        name: camp.name,
        type: camp.type,
        status: camp.status,
        totalRecipients,
        delivered,
        opened,
        clicked,
        contactsGenerated: contactsGenerated?.count ?? 0,
        conversionRate,
        dealRevenue: revenue,
        invoiceCollected: collected,
        totalRevenue: revenue + collected,
        createdAt: camp.createdAt,
      });
    }

    return results;
  }),

  /** Workflow performance metrics — executions, completion rate, avg duration, step breakdown */
  workflowPerformance: protectedProcedure.input(periodInput).query(async ({ ctx, input }) => {
    await requireAccountMember(ctx.user.id, input.accountId, ctx.user.role);
    const db = (await getDb())!;
    const { periodStart } = getPeriodDates(input.days);

    // Get all active workflows for this account
    const wfRows = await db
      .select()
      .from(workflows)
      .where(eq(workflows.accountId, input.accountId))
      .orderBy(desc(workflows.createdAt));

    if (wfRows.length === 0) return [];

    const results = [];
    for (const wf of wfRows) {
      // Execution counts in period
      const [totalExecs] = await db
        .select({ count: count() })
        .from(workflowExecutions)
        .where(
          and(
            eq(workflowExecutions.workflowId, wf.id),
            eq(workflowExecutions.accountId, input.accountId),
            gte(workflowExecutions.startedAt, periodStart)
          )
        );

      const [completedExecs] = await db
        .select({ count: count() })
        .from(workflowExecutions)
        .where(
          and(
            eq(workflowExecutions.workflowId, wf.id),
            eq(workflowExecutions.accountId, input.accountId),
            eq(workflowExecutions.status, "completed"),
            gte(workflowExecutions.startedAt, periodStart)
          )
        );

      const [failedExecs] = await db
        .select({ count: count() })
        .from(workflowExecutions)
        .where(
          and(
            eq(workflowExecutions.workflowId, wf.id),
            eq(workflowExecutions.accountId, input.accountId),
            eq(workflowExecutions.status, "failed"),
            gte(workflowExecutions.startedAt, periodStart)
          )
        );

      // Avg duration (completed only, in seconds)
      const [avgDuration] = await db.execute(
        sql`SELECT AVG(TIMESTAMPDIFF(SECOND, startedAt, completedAt)) AS avgSec
            FROM workflow_executions
            WHERE workflowId = ${wf.id}
              AND accountId = ${input.accountId}
              AND status = 'completed'
              AND completedAt IS NOT NULL
              AND startedAt >= ${periodStart}`
      );

      // Step-level breakdown
      const stepRows = await db.execute(
        sql`SELECT wes.actionType, wes.status, COUNT(*) AS cnt
            FROM workflow_execution_steps wes
            INNER JOIN workflow_executions we ON wes.executionId = we.id
            WHERE we.workflowId = ${wf.id}
              AND we.accountId = ${input.accountId}
              AND we.startedAt >= ${periodStart}
            GROUP BY wes.actionType, wes.status`
      );

      const stepBreakdown: Record<string, { total: number; completed: number; failed: number }> = {};
      for (const row of (stepRows[0] as unknown as any[])) {
        const action = row.actionType || "unknown";
        if (!stepBreakdown[action]) stepBreakdown[action] = { total: 0, completed: 0, failed: 0 };
        stepBreakdown[action].total += Number(row.cnt);
        if (row.status === "completed") stepBreakdown[action].completed += Number(row.cnt);
        if (row.status === "failed") stepBreakdown[action].failed += Number(row.cnt);
      }

      const total = totalExecs?.count ?? 0;
      const completed = completedExecs?.count ?? 0;
      const failed = failedExecs?.count ?? 0;
      const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0;

      results.push({
        id: wf.id,
        name: wf.name,
        triggerType: wf.triggerType,
        isActive: wf.isActive,
        totalExecutions: total,
        completedExecutions: completed,
        failedExecutions: failed,
        runningExecutions: total - completed - failed,
        completionRate,
        avgDurationSeconds: Number((avgDuration as any)?.avgSec ?? 0),
        stepBreakdown: Object.entries(stepBreakdown).map(([action, stats]) => ({
          action,
          ...stats,
          successRate: stats.total > 0 ? Math.round((stats.completed / stats.total) * 100) : 0,
        })),
      });
    }

    return results;
  }),

  /** Revenue attribution — by lead source, campaign, and workflow */
  revenueAttribution: protectedProcedure.input(periodInput).query(async ({ ctx, input }) => {
    await requireAccountMember(ctx.user.id, input.accountId, ctx.user.role);
    const db = (await getDb())!;
    const { periodStart } = getPeriodDates(input.days);

    // Revenue by lead source (from deals)
    const bySourceRows = await db.execute(
      sql`SELECT COALESCE(c.leadSource, 'Unknown') AS source,
                 COUNT(DISTINCT d.id) AS dealCount,
                 COALESCE(SUM(d.value), 0) AS dealRevenue
          FROM deals d
          INNER JOIN contacts c ON d.contact_id = c.id
          WHERE d.account_id = ${input.accountId}
            AND d.created_at >= ${periodStart}
          GROUP BY c.leadSource
          ORDER BY dealRevenue DESC`
    );

    const bySource = (bySourceRows[0] as unknown as any[]).map((r: any) => ({
      source: String(r.source || "Unknown"),
      dealCount: Number(r.dealCount),
      dealRevenue: Number(r.dealRevenue),
    }));

    // Revenue from paid invoices by lead source
    const invoiceBySourceRows = await db.execute(
      sql`SELECT COALESCE(c.leadSource, 'Unknown') AS source,
                 COUNT(DISTINCT i.id) AS invoiceCount,
                 COALESCE(SUM(i.amount_paid), 0) AS collected
          FROM invoices i
          INNER JOIN contacts c ON i.contact_id = c.id
          WHERE i.account_id = ${input.accountId}
            AND i.status = 'paid'
            AND i.paid_at >= ${periodStart}
          GROUP BY c.leadSource
          ORDER BY collected DESC`
    );

    const invoiceBySource = (invoiceBySourceRows[0] as unknown as any[]).map((r: any) => ({
      source: String(r.source || "Unknown"),
      invoiceCount: Number(r.invoiceCount),
      collected: Number(r.collected),
    }));

    // Merge deal revenue + invoice revenue by source
    const sourceMap = new Map<string, { source: string; dealCount: number; dealRevenue: number; invoiceCount: number; invoiceCollected: number; totalRevenue: number }>();
    for (const s of bySource) {
      sourceMap.set(s.source, {
        source: s.source,
        dealCount: s.dealCount,
        dealRevenue: s.dealRevenue,
        invoiceCount: 0,
        invoiceCollected: 0,
        totalRevenue: s.dealRevenue,
      });
    }
    for (const s of invoiceBySource) {
      const existing = sourceMap.get(s.source);
      if (existing) {
        existing.invoiceCount = s.invoiceCount;
        existing.invoiceCollected = s.collected;
        existing.totalRevenue = existing.dealRevenue + s.collected;
      } else {
        sourceMap.set(s.source, {
          source: s.source,
          dealCount: 0,
          dealRevenue: 0,
          invoiceCount: s.invoiceCount,
          invoiceCollected: s.collected,
          totalRevenue: s.collected,
        });
      }
    }

    const attributionBySource = Array.from(sourceMap.values()).sort((a, b) => b.totalRevenue - a.totalRevenue);

    // Total revenue summary
    const totalDealRevenue = attributionBySource.reduce((sum, s) => sum + s.dealRevenue, 0);
    const totalInvoiceCollected = attributionBySource.reduce((sum, s) => sum + s.invoiceCollected, 0);

    return {
      bySource: attributionBySource,
      summary: {
        totalDealRevenue,
        totalInvoiceCollected,
        totalRevenue: totalDealRevenue + totalInvoiceCollected,
        sourceCount: attributionBySource.length,
      },
    };
  }),

  /** Export report data as CSV */
  exportCSV: protectedProcedure
    .input(
      z.object({
        accountId: z.number(),
        days: z.number().min(1).max(365).default(30),
        reportType: z.enum(["kpis", "campaignROI", "workflowPerformance", "revenueAttribution"]),
      })
    )
    .query(async ({ ctx, input }) => {
      await requireAccountMember(ctx.user.id, input.accountId, ctx.user.role);
      const db = (await getDb())!;
      const { periodStart } = getPeriodDates(input.days);

      let csvContent = "";

      if (input.reportType === "kpis") {
        // Build KPI CSV from the same queries
        const [totalContacts] = await db.select({ count: count() }).from(contacts).where(eq(contacts.accountId, input.accountId));
        const [newContacts] = await db.select({ count: count() }).from(contacts).where(and(eq(contacts.accountId, input.accountId), gte(contacts.createdAt, periodStart)));
        const [msgSent] = await db.select({ count: count() }).from(messages).where(and(eq(messages.accountId, input.accountId), eq(messages.direction, "outbound"), gte(messages.createdAt, periodStart)));
        const [callsMade] = await db.select({ count: count() }).from(aiCalls).where(and(eq(aiCalls.accountId, input.accountId), gte(aiCalls.createdAt, periodStart)));
        const [pipeVal] = await db.select({ total: sql<number>`COALESCE(SUM(${deals.value}), 0)` }).from(deals).where(eq(deals.accountId, input.accountId));
        const [appts] = await db.select({ count: count() }).from(appointments).where(and(eq(appointments.accountId, input.accountId), gte(appointments.createdAt, periodStart)));

        csvContent = "Metric,Value\n";
        csvContent += `Total Contacts,${totalContacts?.count ?? 0}\n`;
        csvContent += `New Contacts (${input.days}d),${newContacts?.count ?? 0}\n`;
        csvContent += `Messages Sent,${msgSent?.count ?? 0}\n`;
        csvContent += `AI Calls Made,${callsMade?.count ?? 0}\n`;
        csvContent += `Pipeline Value,$${Number(pipeVal?.total ?? 0).toLocaleString()}\n`;
        csvContent += `Appointments Booked,${appts?.count ?? 0}\n`;
      } else if (input.reportType === "campaignROI") {
        const campRows = await db.select().from(campaigns).where(and(eq(campaigns.accountId, input.accountId), gte(campaigns.createdAt, periodStart))).orderBy(desc(campaigns.createdAt)).limit(50);

        csvContent = "Campaign,Type,Status,Recipients,Delivered,Opened,Clicked,Contacts Generated,Conversion Rate,Deal Revenue,Invoice Collected,Total Revenue\n";
        for (const camp of campRows) {
          const recipientStats = await db.select({ status: campaignRecipients.status, count: count() }).from(campaignRecipients).where(eq(campaignRecipients.campaignId, camp.id)).groupBy(campaignRecipients.status);
          const statusMap: Record<string, number> = {};
          let total = 0;
          for (const s of recipientStats) { statusMap[s.status] = s.count; total += s.count; }
          const delivered = (statusMap["delivered"] ?? 0) + (statusMap["opened"] ?? 0) + (statusMap["clicked"] ?? 0);
          const opened = statusMap["opened"] ?? 0;
          const clicked = statusMap["clicked"] ?? 0;
          const [cg] = await db.select({ count: count() }).from(contacts).where(and(eq(contacts.accountId, input.accountId), eq(contacts.leadSource, `campaign:${camp.id}`)));
          const convRate = total > 0 ? Math.round(((cg?.count ?? 0) / total) * 100) : 0;
          csvContent += `"${camp.name}",${camp.type},${camp.status},${total},${delivered},${opened},${clicked},${cg?.count ?? 0},${convRate}%,0,0,0\n`;
        }
      } else if (input.reportType === "workflowPerformance") {
        const wfRows = await db.select().from(workflows).where(eq(workflows.accountId, input.accountId));

        csvContent = "Workflow,Trigger,Active,Total Executions,Completed,Failed,Completion Rate,Avg Duration (s)\n";
        for (const wf of wfRows) {
          const [t] = await db.select({ count: count() }).from(workflowExecutions).where(and(eq(workflowExecutions.workflowId, wf.id), gte(workflowExecutions.startedAt, periodStart)));
          const [c] = await db.select({ count: count() }).from(workflowExecutions).where(and(eq(workflowExecutions.workflowId, wf.id), eq(workflowExecutions.status, "completed"), gte(workflowExecutions.startedAt, periodStart)));
          const [f] = await db.select({ count: count() }).from(workflowExecutions).where(and(eq(workflowExecutions.workflowId, wf.id), eq(workflowExecutions.status, "failed"), gte(workflowExecutions.startedAt, periodStart)));
          const total = t?.count ?? 0;
          const completed = c?.count ?? 0;
          const failed = f?.count ?? 0;
          const rate = total > 0 ? Math.round((completed / total) * 100) : 0;
          csvContent += `"${wf.name}",${wf.triggerType},${wf.isActive},${total},${completed},${failed},${rate}%,0\n`;
        }
      } else if (input.reportType === "revenueAttribution") {
        const rows = await db.execute(
          sql`SELECT COALESCE(c.leadSource, 'Unknown') AS source,
                     COUNT(DISTINCT d.id) AS dealCount,
                     COALESCE(SUM(d.value), 0) AS revenue
              FROM deals d
              INNER JOIN contacts c ON d.contact_id = c.id
              WHERE d.account_id = ${input.accountId}
                AND d.created_at >= ${periodStart}
              GROUP BY c.leadSource
              ORDER BY revenue DESC`
        );

        csvContent = "Source,Deals,Revenue\n";
        for (const r of (rows[0] as unknown as any[])) {
          csvContent += `"${r.source}",${r.dealCount},$${Number(r.revenue).toLocaleString()}\n`;
        }
      }

      return { csv: csvContent, filename: `${input.reportType}_${input.days}d_report.csv` };
    }),
});
