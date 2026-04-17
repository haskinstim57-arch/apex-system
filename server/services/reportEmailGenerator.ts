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
} from "../../drizzle/schema";
import { and, eq, gte, lte, sql, count, desc, isNotNull } from "drizzle-orm";
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
