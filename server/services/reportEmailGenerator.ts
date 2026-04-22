import { getDb } from "../db";
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
  accounts,
  contactActivities,
  contactNotes,
  sequenceEnrollments,
  sequences,
  jarvisTaskQueue,
} from "../../drizzle/schema";
import { and, eq, gte, lte, sql, count, desc, asc, isNotNull, inArray } from "drizzle-orm";
import { generatePipelineSummarySection } from "./pipelineSummaryReport";

// ─────────────────────────────────────────────
// Report Email Generator
// Builds HTML email content from analytics data
// for scheduled report delivery.
// ─────────────────────────────────────────────

function calcChange(current: number, previous: number): number {
  if (previous === 0) return current > 0 ? 100 : 0;
  return Math.round(((current - previous) / previous) * 100);
}

function getPeriodDates(days: number) {
  const now = new Date();
  const periodStart = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
  const prevPeriodStart = new Date(periodStart.getTime() - days * 24 * 60 * 60 * 1000);
  return { now, periodStart, prevPeriodStart };
}

function changeArrow(change: number): string {
  if (change > 0) return `<span style="color:#16a34a;">&#9650; ${change}%</span>`;
  if (change < 0) return `<span style="color:#dc2626;">&#9660; ${Math.abs(change)}%</span>`;
  return `<span style="color:#6b7280;">&#8212; 0%</span>`;
}

function fmtNum(n: number): string {
  return n.toLocaleString("en-US");
}

function fmtCurrency(cents: number): string {
  return `$${(cents / 100).toLocaleString("en-US", { minimumFractionDigits: 2 })}`;
}

// ─── KPI Report Section ───

async function generateKPISection(accountId: number, days: number): Promise<string> {
  const db = (await getDb())!;
  const { periodStart, prevPeriodStart } = getPeriodDates(days);

  const [totalContacts] = await db.select({ count: count() }).from(contacts).where(eq(contacts.accountId, accountId));
  const [newCurrent] = await db.select({ count: count() }).from(contacts).where(and(eq(contacts.accountId, accountId), gte(contacts.createdAt, periodStart)));
  const [newPrev] = await db.select({ count: count() }).from(contacts).where(and(eq(contacts.accountId, accountId), gte(contacts.createdAt, prevPeriodStart), lte(contacts.createdAt, periodStart)));
  const [msgCurrent] = await db.select({ count: count() }).from(messages).where(and(eq(messages.accountId, accountId), eq(messages.direction, "outbound"), gte(messages.createdAt, periodStart)));
  const [msgPrev] = await db.select({ count: count() }).from(messages).where(and(eq(messages.accountId, accountId), eq(messages.direction, "outbound"), gte(messages.createdAt, prevPeriodStart), lte(messages.createdAt, periodStart)));
  const [callsCurrent] = await db.select({ count: count() }).from(aiCalls).where(and(eq(aiCalls.accountId, accountId), gte(aiCalls.createdAt, periodStart)));
  const [callsPrev] = await db.select({ count: count() }).from(aiCalls).where(and(eq(aiCalls.accountId, accountId), gte(aiCalls.createdAt, prevPeriodStart), lte(aiCalls.createdAt, periodStart)));
  const [pipeVal] = await db.select({ total: sql<number>`COALESCE(SUM(${deals.value}), 0)` }).from(deals).where(eq(deals.accountId, accountId));
  const [apptsCurrent] = await db.select({ count: count() }).from(appointments).where(and(eq(appointments.accountId, accountId), gte(appointments.createdAt, periodStart)));
  const [apptsPrev] = await db.select({ count: count() }).from(appointments).where(and(eq(appointments.accountId, accountId), gte(appointments.createdAt, prevPeriodStart), lte(appointments.createdAt, periodStart)));

  const contactsChange = calcChange(newCurrent?.count ?? 0, newPrev?.count ?? 0);
  const messagesChange = calcChange(msgCurrent?.count ?? 0, msgPrev?.count ?? 0);
  const callsChange = calcChange(callsCurrent?.count ?? 0, callsPrev?.count ?? 0);
  const apptsChange = calcChange(apptsCurrent?.count ?? 0, apptsPrev?.count ?? 0);

  return `
    <h2 style="color:#1a1a2e;margin:24px 0 12px;font-size:18px;border-bottom:2px solid #e5e7eb;padding-bottom:8px;">Key Performance Indicators</h2>
    <table style="width:100%;border-collapse:collapse;margin-bottom:16px;">
      <thead>
        <tr style="background:#f8f9fa;">
          <th style="text-align:left;padding:10px 12px;border:1px solid #e5e7eb;font-size:13px;color:#6b7280;">Metric</th>
          <th style="text-align:right;padding:10px 12px;border:1px solid #e5e7eb;font-size:13px;color:#6b7280;">Value</th>
          <th style="text-align:right;padding:10px 12px;border:1px solid #e5e7eb;font-size:13px;color:#6b7280;">vs Previous Period</th>
        </tr>
      </thead>
      <tbody>
        <tr><td style="padding:10px 12px;border:1px solid #e5e7eb;">Total Contacts</td><td style="text-align:right;padding:10px 12px;border:1px solid #e5e7eb;font-weight:600;">${fmtNum(totalContacts?.count ?? 0)}</td><td style="text-align:right;padding:10px 12px;border:1px solid #e5e7eb;">—</td></tr>
        <tr style="background:#f8f9fa;"><td style="padding:10px 12px;border:1px solid #e5e7eb;">New Contacts (${days}d)</td><td style="text-align:right;padding:10px 12px;border:1px solid #e5e7eb;font-weight:600;">${fmtNum(newCurrent?.count ?? 0)}</td><td style="text-align:right;padding:10px 12px;border:1px solid #e5e7eb;">${changeArrow(contactsChange)}</td></tr>
        <tr><td style="padding:10px 12px;border:1px solid #e5e7eb;">Messages Sent</td><td style="text-align:right;padding:10px 12px;border:1px solid #e5e7eb;font-weight:600;">${fmtNum(msgCurrent?.count ?? 0)}</td><td style="text-align:right;padding:10px 12px;border:1px solid #e5e7eb;">${changeArrow(messagesChange)}</td></tr>
        <tr style="background:#f8f9fa;"><td style="padding:10px 12px;border:1px solid #e5e7eb;">AI Calls Made</td><td style="text-align:right;padding:10px 12px;border:1px solid #e5e7eb;font-weight:600;">${fmtNum(callsCurrent?.count ?? 0)}</td><td style="text-align:right;padding:10px 12px;border:1px solid #e5e7eb;">${changeArrow(callsChange)}</td></tr>
        <tr><td style="padding:10px 12px;border:1px solid #e5e7eb;">Pipeline Value</td><td style="text-align:right;padding:10px 12px;border:1px solid #e5e7eb;font-weight:600;">${fmtCurrency(Number(pipeVal?.total ?? 0))}</td><td style="text-align:right;padding:10px 12px;border:1px solid #e5e7eb;">—</td></tr>
        <tr style="background:#f8f9fa;"><td style="padding:10px 12px;border:1px solid #e5e7eb;">Appointments Booked</td><td style="text-align:right;padding:10px 12px;border:1px solid #e5e7eb;font-weight:600;">${fmtNum(apptsCurrent?.count ?? 0)}</td><td style="text-align:right;padding:10px 12px;border:1px solid #e5e7eb;">${changeArrow(apptsChange)}</td></tr>
      </tbody>
    </table>`;
}

// ─── Campaign ROI Section ───

async function generateCampaignROISection(accountId: number, days: number): Promise<string> {
  const db = (await getDb())!;
  const { periodStart } = getPeriodDates(days);

  const campaignRows = await db
    .select({
      id: campaigns.id,
      name: campaigns.name,
      type: campaigns.type,
      sentCount: campaigns.sentCount,
      totalRecipients: campaigns.totalRecipients,
    })
    .from(campaigns)
    .where(and(eq(campaigns.accountId, accountId), gte(campaigns.createdAt, periodStart)))
    .orderBy(desc(campaigns.sentCount))
    .limit(10);

  if (campaignRows.length === 0) {
    return `<h2 style="color:#1a1a2e;margin:24px 0 12px;font-size:18px;border-bottom:2px solid #e5e7eb;padding-bottom:8px;">Campaign ROI</h2><p style="color:#6b7280;font-size:14px;">No campaigns sent during this period.</p>`;
  }

  let rows = "";
  let totalSent = 0;
  let totalRecipients = 0;

  for (let i = 0; i < campaignRows.length; i++) {
    const c = campaignRows[i];
    const sent = c.sentCount ?? 0;
    const recipients = c.totalRecipients ?? 0;
    totalSent += sent;
    totalRecipients += recipients;
    const bg = i % 2 === 0 ? "" : ' style="background:#f8f9fa;"';
    rows += `<tr${bg}>
      <td style="padding:10px 12px;border:1px solid #e5e7eb;">${c.name}</td>
      <td style="text-align:center;padding:10px 12px;border:1px solid #e5e7eb;">${c.type}</td>
      <td style="text-align:right;padding:10px 12px;border:1px solid #e5e7eb;">${fmtNum(recipients)}</td>
      <td style="text-align:right;padding:10px 12px;border:1px solid #e5e7eb;">${fmtNum(sent)}</td>
      <td style="text-align:right;padding:10px 12px;border:1px solid #e5e7eb;">${recipients > 0 ? Math.round((sent / recipients) * 100) : 0}%</td>
    </tr>`;
  }

  return `
    <h2 style="color:#1a1a2e;margin:24px 0 12px;font-size:18px;border-bottom:2px solid #e5e7eb;padding-bottom:8px;">Campaign ROI</h2>
    <p style="color:#6b7280;font-size:13px;margin-bottom:8px;">${campaignRows.length} campaigns · ${fmtNum(totalSent)} sent of ${fmtNum(totalRecipients)} recipients</p>
    <table style="width:100%;border-collapse:collapse;margin-bottom:16px;">
      <thead>
        <tr style="background:#f8f9fa;">
          <th style="text-align:left;padding:10px 12px;border:1px solid #e5e7eb;font-size:13px;color:#6b7280;">Campaign</th>
          <th style="text-align:center;padding:10px 12px;border:1px solid #e5e7eb;font-size:13px;color:#6b7280;">Type</th>
          <th style="text-align:right;padding:10px 12px;border:1px solid #e5e7eb;font-size:13px;color:#6b7280;">Recipients</th>
          <th style="text-align:right;padding:10px 12px;border:1px solid #e5e7eb;font-size:13px;color:#6b7280;">Sent</th>
          <th style="text-align:right;padding:10px 12px;border:1px solid #e5e7eb;font-size:13px;color:#6b7280;">Delivery %</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>`;
}

// ─── Workflow Performance Section ───

async function generateWorkflowSection(accountId: number, days: number): Promise<string> {
  const db = (await getDb())!;
  const { periodStart } = getPeriodDates(days);

  const wfRows = await db
    .select({
      id: workflows.id,
      name: workflows.name,
      triggerType: workflows.triggerType,
      isActive: workflows.isActive,
    })
    .from(workflows)
    .where(eq(workflows.accountId, accountId))
    .limit(20);

  if (wfRows.length === 0) {
    return `<h2 style="color:#1a1a2e;margin:24px 0 12px;font-size:18px;border-bottom:2px solid #e5e7eb;padding-bottom:8px;">Workflow Performance</h2><p style="color:#6b7280;font-size:14px;">No workflows configured.</p>`;
  }

  let rows = "";
  let totalExec = 0;
  let totalCompleted = 0;
  let totalFailed = 0;

  for (let i = 0; i < wfRows.length; i++) {
    const wf = wfRows[i];
    const [execCount] = await db.select({ count: count() }).from(workflowExecutions).where(and(eq(workflowExecutions.workflowId, wf.id), gte(workflowExecutions.startedAt, periodStart)));
    const [completedCount] = await db.select({ count: count() }).from(workflowExecutions).where(and(eq(workflowExecutions.workflowId, wf.id), eq(workflowExecutions.status, "completed"), gte(workflowExecutions.startedAt, periodStart)));
    const [failedCount] = await db.select({ count: count() }).from(workflowExecutions).where(and(eq(workflowExecutions.workflowId, wf.id), eq(workflowExecutions.status, "failed"), gte(workflowExecutions.startedAt, periodStart)));

    const execs = execCount?.count ?? 0;
    const completed = completedCount?.count ?? 0;
    const failed = failedCount?.count ?? 0;
    const rate = execs > 0 ? Math.round((completed / execs) * 100) : 0;
    totalExec += execs;
    totalCompleted += completed;
    totalFailed += failed;

    const bg = i % 2 === 0 ? "" : ' style="background:#f8f9fa;"';
    const statusBadge = wf.isActive
      ? '<span style="color:#16a34a;font-weight:600;">Active</span>'
      : '<span style="color:#6b7280;">Inactive</span>';

    rows += `<tr${bg}>
      <td style="padding:10px 12px;border:1px solid #e5e7eb;">${wf.name}</td>
      <td style="text-align:center;padding:10px 12px;border:1px solid #e5e7eb;">${statusBadge}</td>
      <td style="text-align:right;padding:10px 12px;border:1px solid #e5e7eb;">${fmtNum(execs)}</td>
      <td style="text-align:right;padding:10px 12px;border:1px solid #e5e7eb;">${fmtNum(completed)}</td>
      <td style="text-align:right;padding:10px 12px;border:1px solid #e5e7eb;">${fmtNum(failed)}</td>
      <td style="text-align:right;padding:10px 12px;border:1px solid #e5e7eb;">${rate}%</td>
    </tr>`;
  }

  return `
    <h2 style="color:#1a1a2e;margin:24px 0 12px;font-size:18px;border-bottom:2px solid #e5e7eb;padding-bottom:8px;">Workflow Performance</h2>
    <p style="color:#6b7280;font-size:13px;margin-bottom:8px;">${wfRows.length} workflows · ${fmtNum(totalExec)} executions · ${fmtNum(totalCompleted)} completed · ${fmtNum(totalFailed)} failed</p>
    <table style="width:100%;border-collapse:collapse;margin-bottom:16px;">
      <thead>
        <tr style="background:#f8f9fa;">
          <th style="text-align:left;padding:10px 12px;border:1px solid #e5e7eb;font-size:13px;color:#6b7280;">Workflow</th>
          <th style="text-align:center;padding:10px 12px;border:1px solid #e5e7eb;font-size:13px;color:#6b7280;">Status</th>
          <th style="text-align:right;padding:10px 12px;border:1px solid #e5e7eb;font-size:13px;color:#6b7280;">Executions</th>
          <th style="text-align:right;padding:10px 12px;border:1px solid #e5e7eb;font-size:13px;color:#6b7280;">Completed</th>
          <th style="text-align:right;padding:10px 12px;border:1px solid #e5e7eb;font-size:13px;color:#6b7280;">Failed</th>
          <th style="text-align:right;padding:10px 12px;border:1px solid #e5e7eb;font-size:13px;color:#6b7280;">Rate</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>`;
}

// ─── Revenue Attribution Section ───

async function generateRevenueSection(accountId: number, days: number): Promise<string> {
  const db = (await getDb())!;
  const { periodStart } = getPeriodDates(days);

  // Deal revenue by source
  const dealsBySource = await db
    .select({
      source: contacts.leadSource,
      dealCount: count(),
      revenue: sql<number>`COALESCE(SUM(${deals.value}), 0)`,
    })
    .from(deals)
    .innerJoin(contacts, eq(deals.contactId, contacts.id))
    .where(and(eq(deals.accountId, accountId), gte(deals.createdAt, periodStart)))
    .groupBy(contacts.leadSource)
    .orderBy(desc(sql`SUM(${deals.value})`))
    .limit(10);

  // Invoice revenue
  const [invoiceStats] = await db
    .select({
      total: sql<number>`COALESCE(SUM(${invoices.total}), 0)`,
      collected: sql<number>`COALESCE(SUM(${invoices.amountPaid}), 0)`,
      count: count(),
    })
    .from(invoices)
    .where(and(eq(invoices.accountId, accountId), gte(invoices.createdAt, periodStart)));

  const totalDealRevenue = dealsBySource.reduce((sum, r) => sum + Number(r.revenue), 0);
  const totalInvoiceCollected = Number(invoiceStats?.collected ?? 0);
  const totalRevenue = totalDealRevenue + totalInvoiceCollected;

  let sourceRows = "";
  for (let i = 0; i < dealsBySource.length; i++) {
    const s = dealsBySource[i];
    const bg = i % 2 === 0 ? "" : ' style="background:#f8f9fa;"';
    sourceRows += `<tr${bg}>
      <td style="padding:10px 12px;border:1px solid #e5e7eb;">${s.source || "Unknown"}</td>
      <td style="text-align:right;padding:10px 12px;border:1px solid #e5e7eb;">${fmtNum(s.dealCount)}</td>
      <td style="text-align:right;padding:10px 12px;border:1px solid #e5e7eb;font-weight:600;">${fmtCurrency(Number(s.revenue))}</td>
    </tr>`;
  }

  return `
    <h2 style="color:#1a1a2e;margin:24px 0 12px;font-size:18px;border-bottom:2px solid #e5e7eb;padding-bottom:8px;">Revenue Attribution</h2>
    <table style="width:100%;border-collapse:collapse;margin-bottom:12px;">
      <tr>
        <td style="padding:12px;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:6px;text-align:center;width:33%;">
          <div style="font-size:12px;color:#6b7280;">Total Revenue</div>
          <div style="font-size:20px;font-weight:700;color:#16a34a;">${fmtCurrency(totalRevenue)}</div>
        </td>
        <td style="padding:12px;background:#eff6ff;border:1px solid #bfdbfe;border-radius:6px;text-align:center;width:33%;">
          <div style="font-size:12px;color:#6b7280;">Deal Revenue</div>
          <div style="font-size:20px;font-weight:700;color:#2563eb;">${fmtCurrency(totalDealRevenue)}</div>
        </td>
        <td style="padding:12px;background:#fefce8;border:1px solid #fde68a;border-radius:6px;text-align:center;width:33%;">
          <div style="font-size:12px;color:#6b7280;">Invoice Collected</div>
          <div style="font-size:20px;font-weight:700;color:#ca8a04;">${fmtCurrency(totalInvoiceCollected)}</div>
        </td>
      </tr>
    </table>
    ${dealsBySource.length > 0 ? `
    <table style="width:100%;border-collapse:collapse;margin-bottom:16px;">
      <thead>
        <tr style="background:#f8f9fa;">
          <th style="text-align:left;padding:10px 12px;border:1px solid #e5e7eb;font-size:13px;color:#6b7280;">Source</th>
          <th style="text-align:right;padding:10px 12px;border:1px solid #e5e7eb;font-size:13px;color:#6b7280;">Deals</th>
          <th style="text-align:right;padding:10px 12px;border:1px solid #e5e7eb;font-size:13px;color:#6b7280;">Revenue</th>
        </tr>
      </thead>
      <tbody>${sourceRows}</tbody>
    </table>` : '<p style="color:#6b7280;font-size:14px;">No deal revenue by source during this period.</p>'}`;
}

// ─── Main Generator ───

export interface ReportEmailData {
  accountId: number;
  accountName: string;
  reportName: string;
  reportTypes: string[];
  periodDays: number;
  brandColor?: string;
}

export async function generateReportEmailHTML(data: ReportEmailData): Promise<string> {
  const { accountId, accountName, reportName, reportTypes, periodDays, brandColor } = data;
  const primaryColor = brandColor || "#c9a84c";
  const now = new Date();
  const periodStart = new Date(now.getTime() - periodDays * 24 * 60 * 60 * 1000);
  const dateRange = `${periodStart.toLocaleDateString("en-US", { month: "short", day: "numeric" })} — ${now.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`;

  let sections = "";

  for (const reportType of reportTypes) {
    switch (reportType) {
      case "kpis":
        sections += await generateKPISection(accountId, periodDays);
        break;
      case "campaignROI":
        sections += await generateCampaignROISection(accountId, periodDays);
        break;
      case "workflowPerformance":
        sections += await generateWorkflowSection(accountId, periodDays);
        break;
      case "revenueAttribution":
        sections += await generateRevenueSection(accountId, periodDays);
        break;
      case "pipeline_summary":
        sections += await generatePipelineSummarySection(accountId, periodDays);
        break;
    }
  }

  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table style="width:100%;max-width:680px;margin:0 auto;background:#ffffff;">
    <!-- Header -->
    <tr>
      <td style="background:${primaryColor};padding:24px 32px;">
        <h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:700;">${accountName}</h1>
        <p style="margin:4px 0 0;color:rgba(255,255,255,0.85);font-size:14px;">${reportName}</p>
      </td>
    </tr>
    <!-- Period Badge -->
    <tr>
      <td style="padding:20px 32px 0;">
        <table style="width:100%;">
          <tr>
            <td style="background:#f8f9fa;border:1px solid #e5e7eb;border-radius:8px;padding:12px 16px;">
              <span style="font-size:13px;color:#6b7280;">Reporting Period:</span>
              <span style="font-size:13px;font-weight:600;color:#1a1a2e;margin-left:8px;">${dateRange} (${periodDays} days)</span>
            </td>
          </tr>
        </table>
      </td>
    </tr>
    <!-- Report Sections -->
    <tr>
      <td style="padding:8px 32px 32px;">
        ${sections}
      </td>
    </tr>
    <!-- Footer -->
    <tr>
      <td style="background:#f8f9fa;padding:16px 32px;border-top:1px solid #e5e7eb;">
        <p style="margin:0;font-size:12px;color:#9ca3af;text-align:center;">
          This report was automatically generated by Sterling Marketing.
          To manage your report schedules, visit Settings &rarr; Scheduled Reports.
        </p>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

/**
 * Generate a CSV attachment for a report section.
 */
export async function generateReportCSV(
  accountId: number,
  periodDays: number,
  reportType: string
): Promise<string> {
  const db = (await getDb())!;
  const { periodStart } = getPeriodDates(periodDays);

  if (reportType === "kpis") {
    const [totalContacts] = await db.select({ count: count() }).from(contacts).where(eq(contacts.accountId, accountId));
    const [newContacts] = await db.select({ count: count() }).from(contacts).where(and(eq(contacts.accountId, accountId), gte(contacts.createdAt, periodStart)));
    const [msgSent] = await db.select({ count: count() }).from(messages).where(and(eq(messages.accountId, accountId), eq(messages.direction, "outbound"), gte(messages.createdAt, periodStart)));
    const [callsMade] = await db.select({ count: count() }).from(aiCalls).where(and(eq(aiCalls.accountId, accountId), gte(aiCalls.createdAt, periodStart)));
    const [pipeVal] = await db.select({ total: sql<number>`COALESCE(SUM(${deals.value}), 0)` }).from(deals).where(eq(deals.accountId, accountId));
    const [appts] = await db.select({ count: count() }).from(appointments).where(and(eq(appointments.accountId, accountId), gte(appointments.createdAt, periodStart)));

    return `Metric,Value\nTotal Contacts,${totalContacts?.count ?? 0}\nNew Contacts,${newContacts?.count ?? 0}\nMessages Sent,${msgSent?.count ?? 0}\nAI Calls,${callsMade?.count ?? 0}\nPipeline Value,$${((Number(pipeVal?.total ?? 0)) / 100).toFixed(2)}\nAppointments,${appts?.count ?? 0}`;
  }

  if (reportType === "pipeline_summary") {
    const { generatePipelineSummaryReport } = await import("./pipelineSummaryReport");
    const { csv } = await generatePipelineSummaryReport({
      accountId,
      accountName: "Report",
      periodDays,
    });
    return csv;
  }

  return `Report,${reportType}\nPeriod,${periodDays} days\nGenerated,${new Date().toISOString()}`;
}


// ─── Daily Activity Report ───

export async function generateDailyActivityReport(
  accountId: number,
  startDate: Date,
  endDate: Date,
  accountName: string,
  brandColor?: string
): Promise<{ html: string; csv: string }> {
  const db = (await getDb())!;
  const primaryColor = brandColor || "#c9a84c";

  const startStr = startDate.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
  const endStr = endDate.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" });
  const isMultiDay = startDate.toDateString() !== endDate.toDateString();
  const dateRange = isMultiDay ? `${startStr} \u2014 ${endStr}` : startStr + ", " + endDate.getFullYear();

  // ─── 1. Inbound Calls ───
  const inboundCalls = await db
    .select({
      callId: aiCalls.id,
      contactId: aiCalls.contactId,
      firstName: contacts.firstName,
      lastName: contacts.lastName,
      status: aiCalls.status,
      durationSeconds: aiCalls.durationSeconds,
      startedAt: aiCalls.startedAt,
      recordingUrl: aiCalls.recordingUrl,
    })
    .from(aiCalls)
    .leftJoin(contacts, eq(aiCalls.contactId, contacts.id))
    .where(
      and(
        eq(aiCalls.accountId, accountId),
        eq(aiCalls.direction, "inbound"),
        gte(aiCalls.createdAt, startDate),
        lte(aiCalls.createdAt, endDate)
      )
    )
    .orderBy(desc(aiCalls.createdAt))
    .limit(50);

  let inboundCallsHtml = "";
  if (inboundCalls.length === 0) {
    inboundCallsHtml = `<p style="color:#6b7280;font-size:14px;">No inbound calls during this period.</p>`;
  } else {
    let rows = "";
    for (let i = 0; i < inboundCalls.length; i++) {
      const c = inboundCalls[i];
      const bg = i % 2 === 0 ? "" : ' style="background:#f8f9fa;"';
      const name = [c.firstName, c.lastName].filter(Boolean).join(" ") || "Unknown";
      const time = c.startedAt ? new Date(c.startedAt).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }) : "\u2014";
      const dur = c.durationSeconds ? `${Math.floor(c.durationSeconds / 60)}m ${c.durationSeconds % 60}s` : "\u2014";
      const recording = c.recordingUrl ? `<a href="${c.recordingUrl}" style="color:${primaryColor};">\u25B6 Play</a>` : "\u2014";
      rows += `<tr${bg}>
        <td style="padding:8px 12px;border:1px solid #e5e7eb;">${name}</td>
        <td style="text-align:center;padding:8px 12px;border:1px solid #e5e7eb;">${time}</td>
        <td style="text-align:center;padding:8px 12px;border:1px solid #e5e7eb;">${dur}</td>
        <td style="text-align:center;padding:8px 12px;border:1px solid #e5e7eb;"><span style="color:${c.status === "completed" ? "#16a34a" : "#dc2626"};font-weight:600;">${c.status}</span></td>
        <td style="text-align:center;padding:8px 12px;border:1px solid #e5e7eb;">${recording}</td>
      </tr>`;
    }
    inboundCallsHtml = `
      <p style="color:#6b7280;font-size:13px;margin-bottom:8px;">${inboundCalls.length} inbound call${inboundCalls.length !== 1 ? "s" : ""}</p>
      <table style="width:100%;border-collapse:collapse;margin-bottom:16px;">
        <thead><tr style="background:#f8f9fa;">
          <th style="text-align:left;padding:8px 12px;border:1px solid #e5e7eb;font-size:13px;color:#6b7280;">Contact</th>
          <th style="text-align:center;padding:8px 12px;border:1px solid #e5e7eb;font-size:13px;color:#6b7280;">Time</th>
          <th style="text-align:center;padding:8px 12px;border:1px solid #e5e7eb;font-size:13px;color:#6b7280;">Duration</th>
          <th style="text-align:center;padding:8px 12px;border:1px solid #e5e7eb;font-size:13px;color:#6b7280;">Status</th>
          <th style="text-align:center;padding:8px 12px;border:1px solid #e5e7eb;font-size:13px;color:#6b7280;">Recording</th>
        </tr></thead>
        <tbody>${rows}</tbody>
      </table>`;
  }

  // ─── 2. Outbound SMS ───
  const [smsStats] = await db
    .select({ count: count() })
    .from(messages)
    .where(and(eq(messages.accountId, accountId), eq(messages.type, "sms"), eq(messages.direction, "outbound"), gte(messages.createdAt, startDate), lte(messages.createdAt, endDate)));

  const [smsDelivered] = await db
    .select({ count: count() })
    .from(messages)
    .where(and(eq(messages.accountId, accountId), eq(messages.type, "sms"), eq(messages.direction, "outbound"), eq(messages.status, "delivered"), gte(messages.createdAt, startDate), lte(messages.createdAt, endDate)));

  const [smsFailed] = await db
    .select({ count: count() })
    .from(messages)
    .where(and(eq(messages.accountId, accountId), eq(messages.type, "sms"), eq(messages.direction, "outbound"), eq(messages.status, "failed"), gte(messages.createdAt, startDate), lte(messages.createdAt, endDate)));

  const smsTotal = smsStats?.count ?? 0;
  const smsDeliveredCount = smsDelivered?.count ?? 0;
  const smsFailedCount = smsFailed?.count ?? 0;
  const smsDeliveryRate = smsTotal > 0 ? Math.round((smsDeliveredCount / smsTotal) * 100) : 0;

  const outboundSmsHtml = `
    <table style="width:100%;border-collapse:collapse;margin-bottom:16px;">
      <tr>
        <td style="padding:12px;background:#eff6ff;border:1px solid #bfdbfe;border-radius:6px;text-align:center;width:33%;">
          <div style="font-size:12px;color:#6b7280;">Total Sent</div>
          <div style="font-size:20px;font-weight:700;color:#2563eb;">${fmtNum(smsTotal)}</div>
        </td>
        <td style="padding:12px;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:6px;text-align:center;width:33%;">
          <div style="font-size:12px;color:#6b7280;">Delivered</div>
          <div style="font-size:20px;font-weight:700;color:#16a34a;">${fmtNum(smsDeliveredCount)} (${smsDeliveryRate}%)</div>
        </td>
        <td style="padding:12px;background:#fef2f2;border:1px solid #fecaca;border-radius:6px;text-align:center;width:33%;">
          <div style="font-size:12px;color:#6b7280;">Failed</div>
          <div style="font-size:20px;font-weight:700;color:#dc2626;">${fmtNum(smsFailedCount)}</div>
        </td>
      </tr>
    </table>`;

  // ─── 3. Outbound Email ───
  const [emailStats] = await db
    .select({ count: count() })
    .from(messages)
    .where(and(eq(messages.accountId, accountId), eq(messages.type, "email"), eq(messages.direction, "outbound"), gte(messages.createdAt, startDate), lte(messages.createdAt, endDate)));

  const [emailOpened] = await db
    .select({ count: count() })
    .from(messages)
    .where(and(eq(messages.accountId, accountId), eq(messages.type, "email"), eq(messages.direction, "outbound"), isNotNull(messages.readAt), gte(messages.createdAt, startDate), lte(messages.createdAt, endDate)));

  const emailTotal = emailStats?.count ?? 0;
  const emailOpenedCount = emailOpened?.count ?? 0;
  const emailOpenRate = emailTotal > 0 ? Math.round((emailOpenedCount / emailTotal) * 100) : 0;

  const outboundEmailHtml = `
    <table style="width:100%;border-collapse:collapse;margin-bottom:16px;">
      <tr>
        <td style="padding:12px;background:#eff6ff;border:1px solid #bfdbfe;border-radius:6px;text-align:center;width:50%;">
          <div style="font-size:12px;color:#6b7280;">Emails Sent</div>
          <div style="font-size:20px;font-weight:700;color:#2563eb;">${fmtNum(emailTotal)}</div>
        </td>
        <td style="padding:12px;background:#fefce8;border:1px solid #fde68a;border-radius:6px;text-align:center;width:50%;">
          <div style="font-size:12px;color:#6b7280;">Open Rate</div>
          <div style="font-size:20px;font-weight:700;color:#ca8a04;">${emailOpenRate}% (${fmtNum(emailOpenedCount)} opened)</div>
        </td>
      </tr>
    </table>`;

  // ─── 4. Contact Updates ───
  const activityRows = await db
    .select({
      id: contactActivities.id,
      contactId: contactActivities.contactId,
      activityType: contactActivities.activityType,
      description: contactActivities.description,
      createdAt: contactActivities.createdAt,
    })
    .from(contactActivities)
    .where(and(eq(contactActivities.accountId, accountId), gte(contactActivities.createdAt, startDate), lte(contactActivities.createdAt, endDate)))
    .orderBy(desc(contactActivities.createdAt))
    .limit(30);

  let contactUpdatesHtml = "";
  if (activityRows.length === 0) {
    contactUpdatesHtml = `<p style="color:#6b7280;font-size:14px;">No contact updates during this period.</p>`;
  } else {
    const typeCounts: Record<string, number> = {};
    for (const a of activityRows) {
      typeCounts[a.activityType] = (typeCounts[a.activityType] || 0) + 1;
    }
    const typeLabels: Record<string, string> = {
      contact_created: "Contacts Created", tag_added: "Tags Added", tag_removed: "Tags Removed",
      pipeline_stage_changed: "Stage Changes", note_added: "Notes Added", message_sent: "Messages Sent",
      message_received: "Messages Received", ai_call_made: "AI Calls Made",
      appointment_booked: "Appointments Booked", lead_score_changed: "Lead Score Changes",
    };
    let summaryRows = "";
    let idx = 0;
    for (const [type, cnt] of Object.entries(typeCounts).sort((a, b) => b[1] - a[1])) {
      const bg = idx % 2 === 0 ? "" : ' style="background:#f8f9fa;"';
      summaryRows += `<tr${bg}><td style="padding:8px 12px;border:1px solid #e5e7eb;">${typeLabels[type] || type}</td><td style="text-align:right;padding:8px 12px;border:1px solid #e5e7eb;font-weight:600;">${fmtNum(cnt)}</td></tr>`;
      idx++;
    }
    contactUpdatesHtml = `
      <p style="color:#6b7280;font-size:13px;margin-bottom:8px;">${activityRows.length} activities recorded</p>
      <table style="width:100%;border-collapse:collapse;margin-bottom:16px;">
        <thead><tr style="background:#f8f9fa;">
          <th style="text-align:left;padding:8px 12px;border:1px solid #e5e7eb;font-size:13px;color:#6b7280;">Activity Type</th>
          <th style="text-align:right;padding:8px 12px;border:1px solid #e5e7eb;font-size:13px;color:#6b7280;">Count</th>
        </tr></thead>
        <tbody>${summaryRows}</tbody>
      </table>`;
  }

  // ─── 5. Dispositions Summary ───
  const noteRows = await db
    .select({ id: contactNotes.id, content: contactNotes.content, createdAt: contactNotes.createdAt })
    .from(contactNotes)
    .innerJoin(contacts, eq(contactNotes.contactId, contacts.id))
    .where(and(eq(contacts.accountId, accountId), gte(contactNotes.createdAt, startDate), lte(contactNotes.createdAt, endDate)))
    .limit(500);

  const dispositionCounts: Record<string, number> = {};
  for (const note of noteRows) {
    const match = note.content.match(/^\[([^\]]+)\]/);
    if (match) {
      dispositionCounts[match[1].trim()] = (dispositionCounts[match[1].trim()] || 0) + 1;
    }
  }

  let dispositionsHtml = "";
  const dispEntries = Object.entries(dispositionCounts).sort((a, b) => b[1] - a[1]);
  if (dispEntries.length === 0) {
    dispositionsHtml = `<p style="color:#6b7280;font-size:14px;">No dispositions recorded during this period.</p>`;
  } else {
    let dispRows = "";
    for (let i = 0; i < dispEntries.length; i++) {
      const [label, cnt] = dispEntries[i];
      const bg = i % 2 === 0 ? "" : ' style="background:#f8f9fa;"';
      dispRows += `<tr${bg}><td style="padding:8px 12px;border:1px solid #e5e7eb;">${label}</td><td style="text-align:right;padding:8px 12px;border:1px solid #e5e7eb;font-weight:600;">${fmtNum(cnt)}</td></tr>`;
    }
    dispositionsHtml = `
      <table style="width:100%;border-collapse:collapse;margin-bottom:16px;">
        <thead><tr style="background:#f8f9fa;">
          <th style="text-align:left;padding:8px 12px;border:1px solid #e5e7eb;font-size:13px;color:#6b7280;">Disposition</th>
          <th style="text-align:right;padding:8px 12px;border:1px solid #e5e7eb;font-size:13px;color:#6b7280;">Count</th>
        </tr></thead>
        <tbody>${dispRows}</tbody>
      </table>`;
  }

  // ─── 6. Hot Leads (Immediate Follow-up) ───
  const hotLeadNotes = await db
    .select({
      contactId: contactNotes.contactId,
      firstName: contacts.firstName,
      lastName: contacts.lastName,
      phone: contacts.phone,
      disposition: contactNotes.disposition,
    })
    .from(contactNotes)
    .innerJoin(contacts, eq(contactNotes.contactId, contacts.id))
    .where(
      and(
        eq(contacts.accountId, accountId),
        gte(contactNotes.createdAt, startDate),
        lte(contactNotes.createdAt, endDate),
        sql`${contactNotes.disposition} IN ('left_voicemail', 'no_answer', 'callback_requested', 'voicemail_full')`
      )
    );

  // Group by contact and count attempts
  const hotLeadMap = new Map<number, { name: string; phone: string; attempts: number; hasCallback: boolean }>();
  for (const n of hotLeadNotes) {
    const existing = hotLeadMap.get(n.contactId);
    const isCallback = n.disposition === "callback_requested";
    if (existing) {
      existing.attempts++;
      if (isCallback) existing.hasCallback = true;
    } else {
      hotLeadMap.set(n.contactId, {
        name: [n.firstName, n.lastName].filter(Boolean).join(" ") || "Unknown",
        phone: n.phone || "—",
        attempts: 1,
        hasCallback: isCallback,
      });
    }
  }
  // Filter: 3+ attempts OR callback requested
  const hotLeads = [...hotLeadMap.entries()]
    .filter(([, v]) => v.attempts >= 3 || v.hasCallback)
    .sort((a, b) => (b[1].hasCallback ? 1 : 0) - (a[1].hasCallback ? 1 : 0) || b[1].attempts - a[1].attempts)
    .slice(0, 15);

  let hotLeadsHtml = "";
  if (hotLeads.length === 0) {
    hotLeadsHtml = `<p style="color:#6b7280;font-size:14px;">No hot leads flagged during this period.</p>`;
  } else {
    let hlRows = "";
    for (let i = 0; i < hotLeads.length; i++) {
      const [, lead] = hotLeads[i];
      const bg = i % 2 === 0 ? "" : ' style="background:#f8f9fa;"';
      const flag = lead.hasCallback
        ? '<span style="background:#fef3c7;color:#92400e;padding:2px 6px;border-radius:4px;font-size:11px;font-weight:600;">CALLBACK</span>'
        : `<span style="background:#fee2e2;color:#991b1b;padding:2px 6px;border-radius:4px;font-size:11px;font-weight:600;">${lead.attempts}x VM/NA</span>`;
      hlRows += `<tr${bg}><td style="padding:8px 12px;border:1px solid #e5e7eb;">${lead.name}</td><td style="padding:8px 12px;border:1px solid #e5e7eb;">${lead.phone}</td><td style="text-align:center;padding:8px 12px;border:1px solid #e5e7eb;">${flag}</td></tr>`;
    }
    hotLeadsHtml = `
      <p style="color:#6b7280;font-size:13px;margin-bottom:8px;">${hotLeads.length} contact${hotLeads.length !== 1 ? "s" : ""} flagged for immediate follow-up</p>
      <table style="width:100%;border-collapse:collapse;margin-bottom:16px;">
        <thead><tr style="background:#f8f9fa;">
          <th style="text-align:left;padding:8px 12px;border:1px solid #e5e7eb;font-size:13px;color:#6b7280;">Contact</th>
          <th style="text-align:left;padding:8px 12px;border:1px solid #e5e7eb;font-size:13px;color:#6b7280;">Phone</th>
          <th style="text-align:center;padding:8px 12px;border:1px solid #e5e7eb;font-size:13px;color:#6b7280;">Flag</th>
        </tr></thead>
        <tbody>${hlRows}</tbody>
      </table>`;
  }

  // ─── 7. Dispositions Trend (vs 7-day average) ───
  const sevenDaysAgo = new Date(startDate.getTime() - 7 * 24 * 60 * 60 * 1000);
  const prevNotes = await db
    .select({ disposition: contactNotes.disposition })
    .from(contactNotes)
    .innerJoin(contacts, eq(contactNotes.contactId, contacts.id))
    .where(
      and(
        eq(contacts.accountId, accountId),
        gte(contactNotes.createdAt, sevenDaysAgo),
        lte(contactNotes.createdAt, startDate),
        isNotNull(contactNotes.disposition)
      )
    )
    .limit(2000);

  const prevDispCounts: Record<string, number> = {};
  for (const n of prevNotes) {
    if (n.disposition) prevDispCounts[n.disposition] = (prevDispCounts[n.disposition] || 0) + 1;
  }
  // Calculate days in previous period for daily average
  const prevDays = Math.max(1, Math.round((startDate.getTime() - sevenDaysAgo.getTime()) / (1000 * 60 * 60 * 24)));
  const reportDays = Math.max(1, Math.round((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)));

  // Build current period disposition counts from the disposition field
  const currentDispFromField: Record<string, number> = {};
  const currentNotes = await db
    .select({ disposition: contactNotes.disposition })
    .from(contactNotes)
    .innerJoin(contacts, eq(contactNotes.contactId, contacts.id))
    .where(
      and(
        eq(contacts.accountId, accountId),
        gte(contactNotes.createdAt, startDate),
        lte(contactNotes.createdAt, endDate),
        isNotNull(contactNotes.disposition)
      )
    )
    .limit(2000);
  for (const n of currentNotes) {
    if (n.disposition) currentDispFromField[n.disposition] = (currentDispFromField[n.disposition] || 0) + 1;
  }

  let trendHtml = "";
  const allDisps = new Set([...Object.keys(currentDispFromField), ...Object.keys(prevDispCounts)]);
  if (allDisps.size === 0) {
    trendHtml = `<p style="color:#6b7280;font-size:14px;">No disposition trend data available.</p>`;
  } else {
    const dispLabels: Record<string, string> = {
      left_voicemail: "Left Voicemail", no_answer: "No Answer", answered: "Answered",
      callback_requested: "Callback Requested", voicemail_full: "Voicemail Full",
      wrong_number: "Wrong Number", do_not_call: "Do Not Call",
      appointment_set: "Appointment Set", not_interested: "Not Interested", other: "Other",
    };
    let trendRows = "";
    let idx = 0;
    for (const disp of [...allDisps].sort()) {
      const current = currentDispFromField[disp] || 0;
      const prevAvgDaily = (prevDispCounts[disp] || 0) / prevDays;
      const currentDaily = current / reportDays;
      let changeStr = "—";
      if (prevAvgDaily > 0) {
        const pctChange = Math.round(((currentDaily - prevAvgDaily) / prevAvgDaily) * 100);
        if (pctChange > 0) changeStr = `<span style="color:#dc2626;">\u25B2 ${pctChange}%</span>`;
        else if (pctChange < 0) changeStr = `<span style="color:#16a34a;">\u25BC ${Math.abs(pctChange)}%</span>`;
        else changeStr = `<span style="color:#6b7280;">— 0%</span>`;
      } else if (current > 0) {
        changeStr = `<span style="color:#6b7280;">New</span>`;
      }
      const bg = idx % 2 === 0 ? "" : ' style="background:#f8f9fa;"';
      trendRows += `<tr${bg}><td style="padding:8px 12px;border:1px solid #e5e7eb;">${dispLabels[disp] || disp}</td><td style="text-align:right;padding:8px 12px;border:1px solid #e5e7eb;font-weight:600;">${fmtNum(current)}</td><td style="text-align:right;padding:8px 12px;border:1px solid #e5e7eb;">${changeStr}</td></tr>`;
      idx++;
    }
    trendHtml = `
      <table style="width:100%;border-collapse:collapse;margin-bottom:16px;">
        <thead><tr style="background:#f8f9fa;">
          <th style="text-align:left;padding:8px 12px;border:1px solid #e5e7eb;font-size:13px;color:#6b7280;">Disposition</th>
          <th style="text-align:right;padding:8px 12px;border:1px solid #e5e7eb;font-size:13px;color:#6b7280;">Count</th>
          <th style="text-align:right;padding:8px 12px;border:1px solid #e5e7eb;font-size:13px;color:#6b7280;">vs 7-Day Avg</th>
        </tr></thead>
        <tbody>${trendRows}</tbody>
      </table>`;
  }

  // ─── 8. Appointments Booked ───
  const apptRows = await db
    .select({
      id: appointments.id,
      guestName: appointments.guestName,
      guestEmail: appointments.guestEmail,
      startTime: appointments.startTime,
      endTime: appointments.endTime,
      status: appointments.status,
    })
    .from(appointments)
    .where(
      and(
        eq(appointments.accountId, accountId),
        gte(appointments.createdAt, startDate),
        lte(appointments.createdAt, endDate)
      )
    )
    .orderBy(asc(appointments.startTime))
    .limit(30);

  let appointmentsHtml = "";
  if (apptRows.length === 0) {
    appointmentsHtml = `<p style="color:#6b7280;font-size:14px;">No appointments booked during this period.</p>`;
  } else {
    let apptTableRows = "";
    for (let i = 0; i < apptRows.length; i++) {
      const a = apptRows[i];
      const bg = i % 2 === 0 ? "" : ' style="background:#f8f9fa;"';
      const time = a.startTime ? new Date(a.startTime).toLocaleString("en-US", { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : "—";
      const statusColor = a.status === "confirmed" ? "#16a34a" : a.status === "cancelled" ? "#dc2626" : "#ca8a04";
      apptTableRows += `<tr${bg}><td style="padding:8px 12px;border:1px solid #e5e7eb;">${a.guestName}</td><td style="padding:8px 12px;border:1px solid #e5e7eb;">${time}</td><td style="text-align:center;padding:8px 12px;border:1px solid #e5e7eb;"><span style="color:${statusColor};font-weight:600;">${a.status}</span></td></tr>`;
    }
    appointmentsHtml = `
      <p style="color:#6b7280;font-size:13px;margin-bottom:8px;">${apptRows.length} appointment${apptRows.length !== 1 ? "s" : ""} booked</p>
      <table style="width:100%;border-collapse:collapse;margin-bottom:16px;">
        <thead><tr style="background:#f8f9fa;">
          <th style="text-align:left;padding:8px 12px;border:1px solid #e5e7eb;font-size:13px;color:#6b7280;">Guest</th>
          <th style="text-align:left;padding:8px 12px;border:1px solid #e5e7eb;font-size:13px;color:#6b7280;">Time</th>
          <th style="text-align:center;padding:8px 12px;border:1px solid #e5e7eb;font-size:13px;color:#6b7280;">Status</th>
        </tr></thead>
        <tbody>${apptTableRows}</tbody>
      </table>`;
  }

  // ─── 9. AI Call Outcomes Summary ───
  const allCalls = await db
    .select({
      status: aiCalls.status,
      durationSeconds: aiCalls.durationSeconds,
    })
    .from(aiCalls)
    .where(
      and(
        eq(aiCalls.accountId, accountId),
        gte(aiCalls.createdAt, startDate),
        lte(aiCalls.createdAt, endDate)
      )
    );

  let aiCallOutcomesHtml = "";
  if (allCalls.length === 0) {
    aiCallOutcomesHtml = `<p style="color:#6b7280;font-size:14px;">No AI calls during this period.</p>`;
  } else {
    const statusCounts: Record<string, number> = {};
    let totalDuration = 0;
    let callsWithDuration = 0;
    for (const c of allCalls) {
      statusCounts[c.status] = (statusCounts[c.status] || 0) + 1;
      if (c.durationSeconds > 0) {
        totalDuration += c.durationSeconds;
        callsWithDuration++;
      }
    }
    const totalCalls = allCalls.length;
    const noAnswerCount = (statusCounts["no_answer"] || 0) + (statusCounts["busy"] || 0);
    const noAnswerRate = totalCalls > 0 ? Math.round((noAnswerCount / totalCalls) * 100) : 0;
    const avgDuration = callsWithDuration > 0 ? Math.round(totalDuration / callsWithDuration) : 0;
    const avgMin = Math.floor(avgDuration / 60);
    const avgSec = avgDuration % 60;
    const mostCommon = Object.entries(statusCounts).sort((a, b) => b[1] - a[1])[0];

    const statusLabels: Record<string, string> = {
      completed: "Completed", failed: "Failed", no_answer: "No Answer",
      busy: "Busy", cancelled: "Cancelled", queued: "Queued", calling: "In Progress",
    };

    let outcomeRows = "";
    let oi = 0;
    for (const [status, cnt] of Object.entries(statusCounts).sort((a, b) => b[1] - a[1])) {
      const bg = oi % 2 === 0 ? "" : ' style="background:#f8f9fa;"';
      const pct = Math.round((cnt / totalCalls) * 100);
      outcomeRows += `<tr${bg}><td style="padding:8px 12px;border:1px solid #e5e7eb;">${statusLabels[status] || status}</td><td style="text-align:right;padding:8px 12px;border:1px solid #e5e7eb;font-weight:600;">${fmtNum(cnt)}</td><td style="text-align:right;padding:8px 12px;border:1px solid #e5e7eb;">${pct}%</td></tr>`;
      oi++;
    }

    aiCallOutcomesHtml = `
      <table style="width:100%;border-collapse:collapse;margin-bottom:12px;">
        <tr>
          <td style="padding:12px;background:#eff6ff;border:1px solid #bfdbfe;border-radius:6px;text-align:center;width:25%;">
            <div style="font-size:12px;color:#6b7280;">Total Calls</div>
            <div style="font-size:20px;font-weight:700;color:#2563eb;">${fmtNum(totalCalls)}</div>
          </td>
          <td style="padding:12px;background:#fef2f2;border:1px solid #fecaca;border-radius:6px;text-align:center;width:25%;">
            <div style="font-size:12px;color:#6b7280;">No-Answer Rate</div>
            <div style="font-size:20px;font-weight:700;color:#dc2626;">${noAnswerRate}%</div>
          </td>
          <td style="padding:12px;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:6px;text-align:center;width:25%;">
            <div style="font-size:12px;color:#6b7280;">Avg Duration</div>
            <div style="font-size:20px;font-weight:700;color:#16a34a;">${avgMin}m ${avgSec}s</div>
          </td>
          <td style="padding:12px;background:#fefce8;border:1px solid #fde68a;border-radius:6px;text-align:center;width:25%;">
            <div style="font-size:12px;color:#6b7280;">Most Common</div>
            <div style="font-size:16px;font-weight:700;color:#ca8a04;">${statusLabels[mostCommon[0]] || mostCommon[0]}</div>
          </td>
        </tr>
      </table>
      <table style="width:100%;border-collapse:collapse;margin-bottom:16px;">
        <thead><tr style="background:#f8f9fa;">
          <th style="text-align:left;padding:8px 12px;border:1px solid #e5e7eb;font-size:13px;color:#6b7280;">Outcome</th>
          <th style="text-align:right;padding:8px 12px;border:1px solid #e5e7eb;font-size:13px;color:#6b7280;">Count</th>
          <th style="text-align:right;padding:8px 12px;border:1px solid #e5e7eb;font-size:13px;color:#6b7280;">%</th>
        </tr></thead>
        <tbody>${outcomeRows}</tbody>
      </table>`;
  }

  // ─── 10. Sequences Activated/Completed ───
  const [seqActivated] = await db
    .select({ count: count() })
    .from(sequenceEnrollments)
    .where(
      and(
        eq(sequenceEnrollments.accountId, accountId),
        gte(sequenceEnrollments.enrolledAt, startDate),
        lte(sequenceEnrollments.enrolledAt, endDate)
      )
    );
  const [seqCompleted] = await db
    .select({ count: count() })
    .from(sequenceEnrollments)
    .where(
      and(
        eq(sequenceEnrollments.accountId, accountId),
        gte(sequenceEnrollments.completedAt, startDate),
        lte(sequenceEnrollments.completedAt, endDate)
      )
    );

  // Get top sequences by enrollment count
  const topSeqs = await db
    .select({
      sequenceId: sequenceEnrollments.sequenceId,
      seqName: sequences.name,
      enrollCount: count(),
    })
    .from(sequenceEnrollments)
    .innerJoin(sequences, eq(sequenceEnrollments.sequenceId, sequences.id))
    .where(
      and(
        eq(sequenceEnrollments.accountId, accountId),
        gte(sequenceEnrollments.enrolledAt, startDate),
        lte(sequenceEnrollments.enrolledAt, endDate)
      )
    )
    .groupBy(sequenceEnrollments.sequenceId, sequences.name)
    .orderBy(desc(count()))
    .limit(5);

  let sequencesHtml = "";
  const activatedCount = seqActivated?.count ?? 0;
  const completedCount = seqCompleted?.count ?? 0;
  if (activatedCount === 0 && completedCount === 0) {
    sequencesHtml = `<p style="color:#6b7280;font-size:14px;">No sequence activity during this period.</p>`;
  } else {
    let seqRows = "";
    for (let i = 0; i < topSeqs.length; i++) {
      const s = topSeqs[i];
      const bg = i % 2 === 0 ? "" : ' style="background:#f8f9fa;"';
      seqRows += `<tr${bg}><td style="padding:8px 12px;border:1px solid #e5e7eb;">${s.seqName}</td><td style="text-align:right;padding:8px 12px;border:1px solid #e5e7eb;font-weight:600;">${fmtNum(s.enrollCount)}</td></tr>`;
    }
    sequencesHtml = `
      <table style="width:100%;border-collapse:collapse;margin-bottom:12px;">
        <tr>
          <td style="padding:12px;background:#eff6ff;border:1px solid #bfdbfe;border-radius:6px;text-align:center;width:50%;">
            <div style="font-size:12px;color:#6b7280;">Enrollments Activated</div>
            <div style="font-size:20px;font-weight:700;color:#2563eb;">${fmtNum(activatedCount)}</div>
          </td>
          <td style="padding:12px;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:6px;text-align:center;width:50%;">
            <div style="font-size:12px;color:#6b7280;">Sequences Completed</div>
            <div style="font-size:20px;font-weight:700;color:#16a34a;">${fmtNum(completedCount)}</div>
          </td>
        </tr>
      </table>
      ${topSeqs.length > 0 ? `
      <table style="width:100%;border-collapse:collapse;margin-bottom:16px;">
        <thead><tr style="background:#f8f9fa;">
          <th style="text-align:left;padding:8px 12px;border:1px solid #e5e7eb;font-size:13px;color:#6b7280;">Sequence</th>
          <th style="text-align:right;padding:8px 12px;border:1px solid #e5e7eb;font-size:13px;color:#6b7280;">Enrollments</th>
        </tr></thead>
        <tbody>${seqRows}</tbody>
      </table>` : ""}`;
  }

  // ─── 11. Application Emails Sent ───
  const [appLinkTasks] = await db
    .select({ count: count() })
    .from(jarvisTaskQueue)
    .where(
      and(
        eq(jarvisTaskQueue.accountId, accountId),
        eq(jarvisTaskQueue.taskType, "send_application_link"),
        gte(jarvisTaskQueue.createdAt, startDate),
        lte(jarvisTaskQueue.createdAt, endDate)
      )
    );
  const [appLinkCompleted] = await db
    .select({ count: count() })
    .from(jarvisTaskQueue)
    .where(
      and(
        eq(jarvisTaskQueue.accountId, accountId),
        eq(jarvisTaskQueue.taskType, "send_application_link"),
        eq(jarvisTaskQueue.status, "completed"),
        gte(jarvisTaskQueue.createdAt, startDate),
        lte(jarvisTaskQueue.createdAt, endDate)
      )
    );
  const appLinkTotal = appLinkTasks?.count ?? 0;
  const appLinkCompletedCount = appLinkCompleted?.count ?? 0;
  const appLinkPending = appLinkTotal - appLinkCompletedCount;

  const appLinksHtml = `
    <table style="width:100%;border-collapse:collapse;margin-bottom:16px;">
      <tr>
        <td style="padding:12px;background:#eff6ff;border:1px solid #bfdbfe;border-radius:6px;text-align:center;width:33%;">
          <div style="font-size:12px;color:#6b7280;">Total Queued</div>
          <div style="font-size:20px;font-weight:700;color:#2563eb;">${fmtNum(appLinkTotal)}</div>
        </td>
        <td style="padding:12px;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:6px;text-align:center;width:33%;">
          <div style="font-size:12px;color:#6b7280;">Sent</div>
          <div style="font-size:20px;font-weight:700;color:#16a34a;">${fmtNum(appLinkCompletedCount)}</div>
        </td>
        <td style="padding:12px;background:#fefce8;border:1px solid #fde68a;border-radius:6px;text-align:center;width:33%;">
          <div style="font-size:12px;color:#6b7280;">Pending</div>
          <div style="font-size:20px;font-weight:700;color:#ca8a04;">${fmtNum(appLinkPending)}</div>
        </td>
      </tr>
    </table>`;

  // ─── 12. Lead Source Breakdown ───
  const newContactsInPeriod = await db
    .select({
      leadSource: contacts.leadSource,
      cnt: count(),
    })
    .from(contacts)
    .where(
      and(
        eq(contacts.accountId, accountId),
        gte(contacts.createdAt, startDate),
        lte(contacts.createdAt, endDate)
      )
    )
    .groupBy(contacts.leadSource)
    .orderBy(desc(count()));

  let leadSourceHtml = "";
  const totalNewLeads = newContactsInPeriod.reduce((s, r) => s + (r.cnt ?? 0), 0);
  if (totalNewLeads === 0) {
    leadSourceHtml = `<p style="color:#6b7280;font-size:14px;">No new leads during this period.</p>`;
  } else {
    let lsRows = "";
    for (let i = 0; i < newContactsInPeriod.length; i++) {
      const r = newContactsInPeriod[i];
      const bg = i % 2 === 0 ? "" : ' style="background:#f8f9fa;"';
      const pct = Math.round(((r.cnt ?? 0) / totalNewLeads) * 100);
      lsRows += `<tr${bg}><td style="padding:8px 12px;border:1px solid #e5e7eb;">${r.leadSource || "Unknown"}</td><td style="text-align:right;padding:8px 12px;border:1px solid #e5e7eb;font-weight:600;">${fmtNum(r.cnt ?? 0)}</td><td style="text-align:right;padding:8px 12px;border:1px solid #e5e7eb;">${pct}%</td></tr>`;
    }
    leadSourceHtml = `
      <p style="color:#6b7280;font-size:13px;margin-bottom:8px;">${fmtNum(totalNewLeads)} new lead${totalNewLeads !== 1 ? "s" : ""}</p>
      <table style="width:100%;border-collapse:collapse;margin-bottom:16px;">
        <thead><tr style="background:#f8f9fa;">
          <th style="text-align:left;padding:8px 12px;border:1px solid #e5e7eb;font-size:13px;color:#6b7280;">Source</th>
          <th style="text-align:right;padding:8px 12px;border:1px solid #e5e7eb;font-size:13px;color:#6b7280;">Count</th>
          <th style="text-align:right;padding:8px 12px;border:1px solid #e5e7eb;font-size:13px;color:#6b7280;">%</th>
        </tr></thead>
        <tbody>${lsRows}</tbody>
      </table>`;
  }

  // ─── 13. Per-Contact Activity Summary ───
  const contactActivityRows = await db
    .select({
      contactId: contactActivities.contactId,
      firstName: contacts.firstName,
      lastName: contacts.lastName,
      phone: contacts.phone,
      activityType: contactActivities.activityType,
    })
    .from(contactActivities)
    .innerJoin(contacts, eq(contactActivities.contactId, contacts.id))
    .where(
      and(
        eq(contactActivities.accountId, accountId),
        gte(contactActivities.createdAt, startDate),
        lte(contactActivities.createdAt, endDate)
      )
    )
    .limit(500);

  const contactMap = new Map<number, { name: string; phone: string; count: number; types: Set<string> }>();
  for (const row of contactActivityRows) {
    const existing = contactMap.get(row.contactId);
    if (existing) {
      existing.count++;
      existing.types.add(row.activityType);
    } else {
      contactMap.set(row.contactId, {
        name: [row.firstName, row.lastName].filter(Boolean).join(" ") || "Unknown",
        phone: row.phone || "\u2014",
        count: 1,
        types: new Set([row.activityType]),
      });
    }
  }

  const topActiveContacts = [...contactMap.entries()]
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 15);

  let perContactHtml = "";
  if (topActiveContacts.length === 0) {
    perContactHtml = `<p style="color:#6b7280;font-size:14px;">No per-contact activity during this period.</p>`;
  } else {
    const typeShort: Record<string, string> = {
      contact_created: "Created", note_added: "Note", message_sent: "Msg Out",
      message_received: "Msg In", ai_call_made: "AI Call", appointment_booked: "Appt",
      tag_added: "Tag", pipeline_stage_changed: "Stage\u0394", lead_score_changed: "Score\u0394",
    };
    let pcRows = "";
    for (let i = 0; i < topActiveContacts.length; i++) {
      const [, c] = topActiveContacts[i];
      const bg = i % 2 === 0 ? "" : ' style="background:#f8f9fa;"';
      const typeList = [...c.types].map(t => typeShort[t] || t).join(", ");
      pcRows += `<tr${bg}><td style="padding:8px 12px;border:1px solid #e5e7eb;">${c.name}</td><td style="padding:8px 12px;border:1px solid #e5e7eb;">${c.phone}</td><td style="text-align:right;padding:8px 12px;border:1px solid #e5e7eb;font-weight:600;">${c.count}</td><td style="padding:8px 12px;border:1px solid #e5e7eb;font-size:12px;">${typeList}</td></tr>`;
    }
    perContactHtml = `
      <p style="color:#6b7280;font-size:13px;margin-bottom:8px;">Top ${topActiveContacts.length} most active contacts</p>
      <table style="width:100%;border-collapse:collapse;margin-bottom:16px;">
        <thead><tr style="background:#f8f9fa;">
          <th style="text-align:left;padding:8px 12px;border:1px solid #e5e7eb;font-size:13px;color:#6b7280;">Contact</th>
          <th style="text-align:left;padding:8px 12px;border:1px solid #e5e7eb;font-size:13px;color:#6b7280;">Phone</th>
          <th style="text-align:right;padding:8px 12px;border:1px solid #e5e7eb;font-size:13px;color:#6b7280;">Activities</th>
          <th style="text-align:left;padding:8px 12px;border:1px solid #e5e7eb;font-size:13px;color:#6b7280;">Types</th>
        </tr></thead>
        <tbody>${pcRows}</tbody>
      </table>`;
  }

  // ─── Assemble HTML ───
  const html = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table style="width:100%;max-width:680px;margin:0 auto;background:#ffffff;">
    <tr>
      <td style="background:${primaryColor};padding:24px 32px;">
        <h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:700;">${accountName}</h1>
        <p style="margin:4px 0 0;color:rgba(255,255,255,0.85);font-size:14px;">Daily Activity Report</p>
      </td>
    </tr>
    <tr>
      <td style="padding:20px 32px 0;">
        <table style="width:100%;"><tr>
          <td style="background:#f8f9fa;border:1px solid #e5e7eb;border-radius:8px;padding:12px 16px;">
            <span style="font-size:13px;color:#6b7280;">Reporting Period:</span>
            <span style="font-size:13px;font-weight:600;color:#1a1a2e;margin-left:8px;">${dateRange}</span>
          </td>
        </tr></table>
      </td>
    </tr>
    <tr>
      <td style="padding:8px 32px 32px;">
        <h2 style="color:#1a1a2e;margin:24px 0 12px;font-size:18px;border-bottom:2px solid #e5e7eb;padding-bottom:8px;">\u{1F4DE} Inbound Calls</h2>
        ${inboundCallsHtml}
        <h2 style="color:#1a1a2e;margin:24px 0 12px;font-size:18px;border-bottom:2px solid #e5e7eb;padding-bottom:8px;">\u{1F4AC} Outbound SMS</h2>
        ${outboundSmsHtml}
        <h2 style="color:#1a1a2e;margin:24px 0 12px;font-size:18px;border-bottom:2px solid #e5e7eb;padding-bottom:8px;">\u{1F4E7} Outbound Email</h2>
        ${outboundEmailHtml}
        <h2 style="color:#1a1a2e;margin:24px 0 12px;font-size:18px;border-bottom:2px solid #e5e7eb;padding-bottom:8px;">\u{1F4CB} Contact Updates</h2>
        ${contactUpdatesHtml}
        <h2 style="color:#1a1a2e;margin:24px 0 12px;font-size:18px;border-bottom:2px solid #e5e7eb;padding-bottom:8px;">\u{1F3F7}\uFE0F Dispositions Summary</h2>
        ${dispositionsHtml}
        <h2 style="color:#1a1a2e;margin:24px 0 12px;font-size:18px;border-bottom:2px solid #e5e7eb;padding-bottom:8px;">\u{1F525} Hot Leads (Immediate Follow-up)</h2>
        ${hotLeadsHtml}
        <h2 style="color:#1a1a2e;margin:24px 0 12px;font-size:18px;border-bottom:2px solid #e5e7eb;padding-bottom:8px;">\u{1F4CA} Dispositions Trend (vs 7-Day Avg)</h2>
        ${trendHtml}
        <h2 style="color:#1a1a2e;margin:24px 0 12px;font-size:18px;border-bottom:2px solid #e5e7eb;padding-bottom:8px;">\u{1F4C5} Appointments Booked</h2>
        ${appointmentsHtml}
        <h2 style="color:#1a1a2e;margin:24px 0 12px;font-size:18px;border-bottom:2px solid #e5e7eb;padding-bottom:8px;">\u{1F916} AI Call Outcomes</h2>
        ${aiCallOutcomesHtml}
        <h2 style="color:#1a1a2e;margin:24px 0 12px;font-size:18px;border-bottom:2px solid #e5e7eb;padding-bottom:8px;">\u{1F504} Sequences Activity</h2>
        ${sequencesHtml}
        <h2 style="color:#1a1a2e;margin:24px 0 12px;font-size:18px;border-bottom:2px solid #e5e7eb;padding-bottom:8px;">\u{1F4E9} Application Emails Sent</h2>
        ${appLinksHtml}
        <h2 style="color:#1a1a2e;margin:24px 0 12px;font-size:18px;border-bottom:2px solid #e5e7eb;padding-bottom:8px;">\u{1F4C8} Lead Source Breakdown</h2>
        ${leadSourceHtml}
        <h2 style="color:#1a1a2e;margin:24px 0 12px;font-size:18px;border-bottom:2px solid #e5e7eb;padding-bottom:8px;">\u{1F464} Per-Contact Activity</h2>
        ${perContactHtml}
      </td>
    </tr>
    <tr>
      <td style="background:#f8f9fa;padding:16px 32px;border-top:1px solid #e5e7eb;">
        <p style="margin:0;font-size:12px;color:#9ca3af;text-align:center;">
          This report was automatically generated by Sterling Marketing.
          To manage your report schedules, visit Settings \u2192 Scheduled Reports.
        </p>
      </td>
    </tr>
  </table>
</body>
</html>`;

  // ─── CSV ───
  let csv = "Section,Metric,Value\n";
  csv += `Inbound Calls,Total,${inboundCalls.length}\n`;
  csv += `Outbound SMS,Total Sent,${smsTotal}\n`;
  csv += `Outbound SMS,Delivered,${smsDeliveredCount}\n`;
  csv += `Outbound SMS,Failed,${smsFailedCount}\n`;
  csv += `Outbound SMS,Delivery Rate,${smsDeliveryRate}%\n`;
  csv += `Outbound Email,Total Sent,${emailTotal}\n`;
  csv += `Outbound Email,Opened,${emailOpenedCount}\n`;
  csv += `Outbound Email,Open Rate,${emailOpenRate}%\n`;
  csv += `Contact Updates,Total Activities,${activityRows.length}\n`;
  for (const [label, cnt] of dispEntries) {
    csv += `Dispositions,${label},${cnt}\n`;
  }
  // Hot leads
  csv += `Hot Leads,Flagged Count,${hotLeads.length}\n`;
  for (const [, lead] of hotLeads) {
    csv += `Hot Leads,${lead.name},${lead.hasCallback ? "Callback Requested" : lead.attempts + "x VM/NA"}\n`;
  }
  // Dispositions trend
  for (const disp of [...allDisps].sort()) {
    const current = currentDispFromField[disp] || 0;
    const prevAvgDaily = (prevDispCounts[disp] || 0) / prevDays;
    const currentDaily = current / reportDays;
    const pctChange = prevAvgDaily > 0 ? Math.round(((currentDaily - prevAvgDaily) / prevAvgDaily) * 100) : 0;
    csv += `Dispositions Trend,${disp},${current} (${pctChange >= 0 ? "+" : ""}${pctChange}% vs avg)\n`;
  }
  // Appointments
  csv += `Appointments,Total Booked,${apptRows.length}\n`;
  // AI Call Outcomes
  csv += `AI Calls,Total,${allCalls.length}\n`;
  // Sequences
  csv += `Sequences,Activated,${activatedCount}\n`;
  csv += `Sequences,Completed,${completedCount}\n`;
  // Application Emails
  csv += `Application Emails,Total Queued,${appLinkTotal}\n`;
  csv += `Application Emails,Sent,${appLinkCompletedCount}\n`;
  csv += `Application Emails,Pending,${appLinkPending}\n`;
  // Lead Source Breakdown
  csv += `Lead Source,Total New Leads,${totalNewLeads}\n`;
  for (const r of newContactsInPeriod) {
    csv += `Lead Source,${r.leadSource || "Unknown"},${r.cnt ?? 0}\n`;
  }
  // Per-Contact Activity
  for (const [, c] of topActiveContacts) {
    csv += `Per-Contact Activity,${c.name},${c.count} activities\n`;
  }

  return { html, csv };
}

/**
 * Calculate the daily_activity date window based on the current day of week.
 * - Tue-Fri: previous business day (single day)
 * - Mon: Fri+Sat+Sun combined (3-day weekend consolidation)
 * - Sat/Sun: returns null (no report)
 */
export function getDailyActivityDateWindow(now: Date): { startDate: Date; endDate: Date } | null {
  const day = now.getDay(); // 0=Sun, 1=Mon, ..., 6=Sat

  if (day === 0 || day === 6) {
    // Saturday or Sunday — no report
    return null;
  }

  if (day === 1) {
    // Monday — cover Friday 00:00 to Sunday 23:59:59
    const friday = new Date(now);
    friday.setDate(friday.getDate() - 3);
    friday.setHours(0, 0, 0, 0);

    const sunday = new Date(now);
    sunday.setDate(sunday.getDate() - 1);
    sunday.setHours(23, 59, 59, 999);

    return { startDate: friday, endDate: sunday };
  }

  // Tue-Fri — cover previous day 00:00 to 23:59:59
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  yesterday.setHours(0, 0, 0, 0);

  const yesterdayEnd = new Date(yesterday);
  yesterdayEnd.setHours(23, 59, 59, 999);

  return { startDate: yesterday, endDate: yesterdayEnd };
}


/**
 * Build the weekend marketing report subject line.
 * "Weekend Marketing Report — Fri, Apr 18 to Sun, Apr 20"
 */
export function getWeekendReportSubject(startDate: Date, endDate: Date): string {
  const fmt = (d: Date) =>
    d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
  return `Weekend Marketing Report — ${fmt(startDate)} to ${fmt(endDate)}`;
}

/**
 * Generate a lightweight Daily Marketing Report (Tue-Fri 7 AM).
 * Contents: new leads yesterday, lead source breakdown, app emails sent, appointments booked.
 */
export async function generateDailyMarketingReport(
  accountId: number,
  startDate: Date,
  endDate: Date,
  accountName: string,
  brandColor?: string
): Promise<{ html: string; csv: string }> {
  const db = (await getDb())!;
  const primaryColor = brandColor || "#c9a84c";

  const startStr = startDate.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
  const endStr = endDate.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" });
  const isMultiDay = startDate.toDateString() !== endDate.toDateString();
  const dateRange = isMultiDay ? `${startStr} — ${endStr}` : startStr + ", " + endDate.getFullYear();

  // ─── 1. New Leads ───
  const [newLeadsCount] = await db
    .select({ count: count() })
    .from(contacts)
    .where(and(eq(contacts.accountId, accountId), gte(contacts.createdAt, startDate), lte(contacts.createdAt, endDate)));

  const newLeadsTotal = newLeadsCount?.count ?? 0;

  // ─── 2. Lead Source Breakdown ───
  const leadSources = await db
    .select({ leadSource: contacts.leadSource, cnt: count() })
    .from(contacts)
    .where(and(eq(contacts.accountId, accountId), gte(contacts.createdAt, startDate), lte(contacts.createdAt, endDate)))
    .groupBy(contacts.leadSource)
    .orderBy(desc(count()));

  let leadSourceRows = "";
  for (let i = 0; i < leadSources.length; i++) {
    const r = leadSources[i];
    const bg = i % 2 === 0 ? "" : ' style="background:#f8f9fa;"';
    const pct = newLeadsTotal > 0 ? Math.round(((r.cnt ?? 0) / newLeadsTotal) * 100) : 0;
    leadSourceRows += `<tr${bg}><td style="padding:8px 12px;border:1px solid #e5e7eb;">${r.leadSource || "Unknown"}</td><td style="text-align:right;padding:8px 12px;border:1px solid #e5e7eb;font-weight:600;">${fmtNum(r.cnt ?? 0)}</td><td style="text-align:right;padding:8px 12px;border:1px solid #e5e7eb;">${pct}%</td></tr>`;
  }

  // ─── 3. Application Emails Sent ───
  const [appLinkTasks] = await db
    .select({ count: count() })
    .from(jarvisTaskQueue)
    .where(and(eq(jarvisTaskQueue.accountId, accountId), eq(jarvisTaskQueue.taskType, "send_application_link"), gte(jarvisTaskQueue.createdAt, startDate), lte(jarvisTaskQueue.createdAt, endDate)));
  const [appLinkDone] = await db
    .select({ count: count() })
    .from(jarvisTaskQueue)
    .where(and(eq(jarvisTaskQueue.accountId, accountId), eq(jarvisTaskQueue.taskType, "send_application_link"), eq(jarvisTaskQueue.status, "completed"), gte(jarvisTaskQueue.createdAt, startDate), lte(jarvisTaskQueue.createdAt, endDate)));
  const appTotal = appLinkTasks?.count ?? 0;
  const appSent = appLinkDone?.count ?? 0;

  // ─── 4. Appointments Booked ───
  const apptRows = await db
    .select({
      guestName: appointments.guestName,
      startTime: appointments.startTime,
      status: appointments.status,
    })
    .from(appointments)
    .where(and(eq(appointments.accountId, accountId), gte(appointments.createdAt, startDate), lte(appointments.createdAt, endDate)))
    .orderBy(asc(appointments.startTime))
    .limit(20);

  let apptsHtml = "";
  if (apptRows.length === 0) {
    apptsHtml = `<p style="color:#6b7280;font-size:14px;">No appointments booked.</p>`;
  } else {
    let aRows = "";
    for (let i = 0; i < apptRows.length; i++) {
      const a = apptRows[i];
      const bg = i % 2 === 0 ? "" : ' style="background:#f8f9fa;"';
      const time = a.startTime ? new Date(a.startTime).toLocaleString("en-US", { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : "\u2014";
      const statusColor = a.status === "confirmed" ? "#16a34a" : a.status === "cancelled" ? "#dc2626" : "#ca8a04";
      aRows += `<tr${bg}><td style="padding:8px 12px;border:1px solid #e5e7eb;">${a.guestName}</td><td style="padding:8px 12px;border:1px solid #e5e7eb;">${time}</td><td style="text-align:center;padding:8px 12px;border:1px solid #e5e7eb;"><span style="color:${statusColor};font-weight:600;">${a.status}</span></td></tr>`;
    }
    apptsHtml = `
      <p style="color:#6b7280;font-size:13px;margin-bottom:8px;">${apptRows.length} appointment${apptRows.length !== 1 ? "s" : ""}</p>
      <table style="width:100%;border-collapse:collapse;margin-bottom:16px;">
        <thead><tr style="background:#f8f9fa;">
          <th style="text-align:left;padding:8px 12px;border:1px solid #e5e7eb;font-size:13px;color:#6b7280;">Guest</th>
          <th style="text-align:left;padding:8px 12px;border:1px solid #e5e7eb;font-size:13px;color:#6b7280;">Time</th>
          <th style="text-align:center;padding:8px 12px;border:1px solid #e5e7eb;font-size:13px;color:#6b7280;">Status</th>
        </tr></thead>
        <tbody>${aRows}</tbody>
      </table>`;
  }

  // ─── Assemble HTML ───
  const html = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table style="width:100%;max-width:680px;margin:0 auto;background:#ffffff;">
    <tr>
      <td style="background:${primaryColor};padding:24px 32px;">
        <h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:700;">${accountName}</h1>
        <p style="margin:4px 0 0;color:rgba(255,255,255,0.85);font-size:14px;">Daily Marketing Report</p>
      </td>
    </tr>
    <tr>
      <td style="padding:20px 32px 0;">
        <table style="width:100%;"><tr>
          <td style="background:#f8f9fa;border:1px solid #e5e7eb;border-radius:8px;padding:12px 16px;">
            <span style="font-size:13px;color:#6b7280;">Reporting Period:</span>
            <span style="font-size:13px;font-weight:600;color:#1a1a2e;margin-left:8px;">${dateRange}</span>
          </td>
        </tr></table>
      </td>
    </tr>
    <tr>
      <td style="padding:8px 32px 32px;">
        <h2 style="color:#1a1a2e;margin:24px 0 12px;font-size:18px;border-bottom:2px solid #e5e7eb;padding-bottom:8px;">\u{1F4CA} New Leads</h2>
        <table style="width:100%;border-collapse:collapse;margin-bottom:16px;">
          <tr>
            <td style="padding:16px;background:#eff6ff;border:1px solid #bfdbfe;border-radius:6px;text-align:center;">
              <div style="font-size:14px;color:#6b7280;">New Leads Received</div>
              <div style="font-size:28px;font-weight:700;color:#2563eb;">${fmtNum(newLeadsTotal)}</div>
            </td>
          </tr>
        </table>

        <h2 style="color:#1a1a2e;margin:24px 0 12px;font-size:18px;border-bottom:2px solid #e5e7eb;padding-bottom:8px;">\u{1F4C8} Lead Source Breakdown</h2>
        ${leadSources.length === 0
          ? '<p style="color:#6b7280;font-size:14px;">No new leads during this period.</p>'
          : `<table style="width:100%;border-collapse:collapse;margin-bottom:16px;">
              <thead><tr style="background:#f8f9fa;">
                <th style="text-align:left;padding:8px 12px;border:1px solid #e5e7eb;font-size:13px;color:#6b7280;">Source</th>
                <th style="text-align:right;padding:8px 12px;border:1px solid #e5e7eb;font-size:13px;color:#6b7280;">Count</th>
                <th style="text-align:right;padding:8px 12px;border:1px solid #e5e7eb;font-size:13px;color:#6b7280;">%</th>
              </tr></thead>
              <tbody>${leadSourceRows}</tbody>
            </table>`}

        <h2 style="color:#1a1a2e;margin:24px 0 12px;font-size:18px;border-bottom:2px solid #e5e7eb;padding-bottom:8px;">\u{1F4E9} Application Emails</h2>
        <table style="width:100%;border-collapse:collapse;margin-bottom:16px;">
          <tr>
            <td style="padding:12px;background:#eff6ff;border:1px solid #bfdbfe;border-radius:6px;text-align:center;width:50%;">
              <div style="font-size:12px;color:#6b7280;">Queued</div>
              <div style="font-size:20px;font-weight:700;color:#2563eb;">${fmtNum(appTotal)}</div>
            </td>
            <td style="padding:12px;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:6px;text-align:center;width:50%;">
              <div style="font-size:12px;color:#6b7280;">Sent</div>
              <div style="font-size:20px;font-weight:700;color:#16a34a;">${fmtNum(appSent)}</div>
            </td>
          </tr>
        </table>

        <h2 style="color:#1a1a2e;margin:24px 0 12px;font-size:18px;border-bottom:2px solid #e5e7eb;padding-bottom:8px;">\u{1F4C5} Appointments Booked</h2>
        ${apptsHtml}
      </td>
    </tr>
    <tr>
      <td style="background:#f8f9fa;padding:16px 32px;border-top:1px solid #e5e7eb;">
        <p style="margin:0;font-size:12px;color:#9ca3af;text-align:center;">
          This report was automatically generated by Sterling Marketing.
          To manage your report schedules, visit Settings \u2192 Scheduled Reports.
        </p>
      </td>
    </tr>
  </table>
</body>
</html>`;

  // ─── CSV ───
  let csv = "Section,Metric,Value\n";
  csv += `New Leads,Total,${newLeadsTotal}\n`;
  for (const r of leadSources) {
    csv += `Lead Source,${r.leadSource || "Unknown"},${r.cnt ?? 0}\n`;
  }
  csv += `Application Emails,Queued,${appTotal}\n`;
  csv += `Application Emails,Sent,${appSent}\n`;
  csv += `Appointments,Total,${apptRows.length}\n`;

  return { html, csv };
}

/**
 * Calculate the daily_marketing date window.
 * Same logic as daily_activity — Tue-Fri covers previous day, Mon covers Fri-Sun.
 * Sat/Sun returns null (no report).
 */
export function getDailyMarketingDateWindow(now: Date): { startDate: Date; endDate: Date } | null {
  return getDailyActivityDateWindow(now);
}
