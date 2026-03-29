import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { TRPCError } from "@trpc/server";
import {
  createScheduledReport,
  listScheduledReports,
  getScheduledReport,
  updateScheduledReport,
  deleteScheduledReport,
  createAuditLog,
  getMember,
} from "../db";
import { calculateNextRunAt } from "../services/scheduledReportsCron";
import { generateReportEmailHTML, generateReportCSV } from "../services/reportEmailGenerator";
import { sendEmail } from "../services/sendgrid";
import { getDb } from "../db";
import { accounts } from "../../drizzle/schema";
import { eq } from "drizzle-orm";

// ─── Helpers ───

async function requireAccountMember(userId: number, accountId: number, userRole?: string) {
  if (userRole === "admin") {
    const member = await getMember(accountId, userId);
    if (member) return member;
    return { userId, accountId, role: "owner" as const, isActive: true };
  }
  const member = await getMember(accountId, userId);
  if (!member || !member.isActive) {
    throw new TRPCError({ code: "FORBIDDEN", message: "You do not have access to this account" });
  }
  return member;
}

// ─────────────────────────────────────────────
// Scheduled Reports Router
// CRUD for report schedules + preview + test send
// ─────────────────────────────────────────────

const VALID_REPORT_TYPES = ["kpis", "campaignROI", "workflowPerformance", "revenueAttribution"];
const VALID_FREQUENCIES = ["daily", "weekly", "monthly"] as const;
const VALID_TIMEZONES = [
  "America/New_York", "America/Chicago", "America/Denver", "America/Los_Angeles",
  "America/Phoenix", "America/Anchorage", "Pacific/Honolulu", "UTC",
  "Europe/London", "Europe/Paris", "Asia/Tokyo", "Australia/Sydney",
];

const scheduleInput = z.object({
  accountId: z.number(),
  name: z.string().min(1).max(255),
  frequency: z.enum(VALID_FREQUENCIES),
  dayOfWeek: z.number().min(0).max(6).optional(),
  dayOfMonth: z.number().min(1).max(28).optional(),
  sendHour: z.number().min(0).max(23),
  timezone: z.string().min(1).max(100),
  reportTypes: z.array(z.string()).min(1),
  recipients: z.array(z.string().email()).min(1).max(10),
  periodDays: z.number().min(1).max(365),
});

export const scheduledReportsRouter = router({
  /** List all scheduled reports for an account */
  list: protectedProcedure
    .input(z.object({ accountId: z.number() }))
    .query(async ({ ctx, input }) => {
      await requireAccountMember(ctx.user.id, input.accountId, ctx.user.role);
      return listScheduledReports(input.accountId);
    }),

  /** Get a single scheduled report */
  get: protectedProcedure
    .input(z.object({ accountId: z.number(), id: z.number() }))
    .query(async ({ ctx, input }) => {
      await requireAccountMember(ctx.user.id, input.accountId, ctx.user.role);
      const report = await getScheduledReport(input.id, input.accountId);
      if (!report) throw new TRPCError({ code: "NOT_FOUND", message: "Report schedule not found" });
      return report;
    }),

  /** Create a new scheduled report */
  create: protectedProcedure.input(scheduleInput).mutation(async ({ ctx, input }) => {
    await requireAccountMember(ctx.user.id, input.accountId, ctx.user.role);

    // Validate report types
    for (const rt of input.reportTypes) {
      if (!VALID_REPORT_TYPES.includes(rt)) {
        throw new TRPCError({ code: "BAD_REQUEST", message: `Invalid report type: ${rt}` });
      }
    }

    const nextRunAt = calculateNextRunAt(
      input.frequency,
      input.sendHour,
      input.timezone,
      input.dayOfWeek,
      input.dayOfMonth
    );

    const id = await createScheduledReport({
      accountId: input.accountId,
      name: input.name,
      frequency: input.frequency,
      dayOfWeek: input.dayOfWeek ?? null,
      dayOfMonth: input.dayOfMonth ?? null,
      sendHour: input.sendHour,
      timezone: input.timezone,
      reportTypes: input.reportTypes,
      recipients: input.recipients,
      periodDays: input.periodDays,
      isActive: true,
      nextRunAt,
      createdById: ctx.user.id,
    });

    await createAuditLog({
      accountId: input.accountId,
      userId: ctx.user.id,
      action: "scheduled_report.created",
      metadata: JSON.stringify({ name: input.name, frequency: input.frequency, recipients: input.recipients }),
    });

    return { id, nextRunAt };
  }),

  /** Update a scheduled report */
  update: protectedProcedure
    .input(z.object({ id: z.number() }).merge(scheduleInput))
    .mutation(async ({ ctx, input }) => {
      await requireAccountMember(ctx.user.id, input.accountId, ctx.user.role);

      const existing = await getScheduledReport(input.id, input.accountId);
      if (!existing) throw new TRPCError({ code: "NOT_FOUND", message: "Report schedule not found" });

      for (const rt of input.reportTypes) {
        if (!VALID_REPORT_TYPES.includes(rt)) {
          throw new TRPCError({ code: "BAD_REQUEST", message: `Invalid report type: ${rt}` });
        }
      }

      const nextRunAt = calculateNextRunAt(
        input.frequency,
        input.sendHour,
        input.timezone,
        input.dayOfWeek,
        input.dayOfMonth
      );

      await updateScheduledReport(input.id, input.accountId, {
        name: input.name,
        frequency: input.frequency,
        dayOfWeek: input.dayOfWeek ?? null,
        dayOfMonth: input.dayOfMonth ?? null,
        sendHour: input.sendHour,
        timezone: input.timezone,
        reportTypes: input.reportTypes,
        recipients: input.recipients,
        periodDays: input.periodDays,
        nextRunAt,
      });

      await createAuditLog({
        accountId: input.accountId,
        userId: ctx.user.id,
      action: "scheduled_report.updated",
      metadata: JSON.stringify({ id: input.id, name: input.name }),
      });

      return { success: true, nextRunAt };
    }),

  /** Toggle active/inactive */
  toggleActive: protectedProcedure
    .input(z.object({ accountId: z.number(), id: z.number(), isActive: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      await requireAccountMember(ctx.user.id, input.accountId, ctx.user.role);

      const existing = await getScheduledReport(input.id, input.accountId);
      if (!existing) throw new TRPCError({ code: "NOT_FOUND", message: "Report schedule not found" });

      const updates: any = { isActive: input.isActive };
      if (input.isActive) {
        updates.nextRunAt = calculateNextRunAt(
          existing.frequency,
          existing.sendHour,
          existing.timezone,
          existing.dayOfWeek,
          existing.dayOfMonth
        );
      }

      await updateScheduledReport(input.id, input.accountId, updates);

      await createAuditLog({
        accountId: input.accountId,
        userId: ctx.user.id,
      action: input.isActive ? "scheduled_report.activated" : "scheduled_report.deactivated",
      metadata: JSON.stringify({ id: input.id, name: existing.name }),
      });

      return { success: true };
    }),

  /** Delete a scheduled report */
  delete: protectedProcedure
    .input(z.object({ accountId: z.number(), id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      await requireAccountMember(ctx.user.id, input.accountId, ctx.user.role);

      const existing = await getScheduledReport(input.id, input.accountId);
      if (!existing) throw new TRPCError({ code: "NOT_FOUND", message: "Report schedule not found" });

      await deleteScheduledReport(input.id, input.accountId);

      await createAuditLog({
        accountId: input.accountId,
        userId: ctx.user.id,
      action: "scheduled_report.deleted",
      metadata: JSON.stringify({ id: input.id, name: existing.name }),
      });

      return { success: true };
    }),

  /** Send a test report immediately */
  sendTest: protectedProcedure
    .input(z.object({
      accountId: z.number(),
      id: z.number(),
      testEmail: z.string().email().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      await requireAccountMember(ctx.user.id, input.accountId, ctx.user.role);

      const report = await getScheduledReport(input.id, input.accountId);
      if (!report) throw new TRPCError({ code: "NOT_FOUND", message: "Report schedule not found" });

      const db = (await getDb())!;
      const [account] = await db
        .select({ name: accounts.name, primaryColor: accounts.primaryColor })
        .from(accounts)
        .where(eq(accounts.id, input.accountId));

      const accountName = account?.name || "Apex System";

      const htmlContent = await generateReportEmailHTML({
        accountId: input.accountId,
        accountName,
        reportName: `[TEST] ${report.name}`,
        reportTypes: report.reportTypes as string[],
        periodDays: report.periodDays,
        brandColor: account?.primaryColor || undefined,
      });

      const recipient = input.testEmail || (report.recipients as string[])[0];

      const result = await sendEmail({
        to: recipient,
        subject: `[TEST] ${report.name} — ${accountName} Analytics Report`,
        body: htmlContent,
        accountId: input.accountId,
      });

      if (!result.success) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: `Failed to send test: ${result.error}` });
      }

      return { success: true, sentTo: recipient };
    }),

  /** Preview report HTML (returns rendered HTML string) */
  preview: protectedProcedure
    .input(z.object({
      accountId: z.number(),
      reportTypes: z.array(z.string()).min(1),
      periodDays: z.number().min(1).max(365),
    }))
    .query(async ({ ctx, input }) => {
      await requireAccountMember(ctx.user.id, input.accountId, ctx.user.role);

      const db = (await getDb())!;
      const [account] = await db
        .select({ name: accounts.name, primaryColor: accounts.primaryColor })
        .from(accounts)
        .where(eq(accounts.id, input.accountId));

      const html = await generateReportEmailHTML({
        accountId: input.accountId,
        accountName: account?.name || "Apex System",
        reportName: "Preview Report",
        reportTypes: input.reportTypes,
        periodDays: input.periodDays,
        brandColor: account?.primaryColor || undefined,
      });

      return { html };
    }),

  /** Get available report types and timezones */
  options: protectedProcedure.query(async () => {
    return {
      reportTypes: [
        { value: "kpis", label: "Key Performance Indicators", description: "Contacts, messages, calls, pipeline, appointments" },
        { value: "campaignROI", label: "Campaign ROI", description: "Campaign delivery rates, recipients, and performance" },
        { value: "workflowPerformance", label: "Workflow Performance", description: "Execution counts, completion rates, failures" },
        { value: "revenueAttribution", label: "Revenue Attribution", description: "Revenue by source, deal and invoice totals" },
      ],
      frequencies: [
        { value: "daily", label: "Daily" },
        { value: "weekly", label: "Weekly" },
        { value: "monthly", label: "Monthly" },
      ],
      timezones: VALID_TIMEZONES.map((tz) => ({ value: tz, label: tz.replace(/_/g, " ") })),
      periodOptions: [
        { value: 7, label: "Last 7 days" },
        { value: 14, label: "Last 14 days" },
        { value: 30, label: "Last 30 days" },
        { value: 60, label: "Last 60 days" },
        { value: 90, label: "Last 90 days" },
      ],
    };
  }),
});
