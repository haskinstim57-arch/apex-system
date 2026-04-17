import { getDb } from "../db";
import {
  deals,
  pipelineStages,
  contacts,
  users,
  accountMembers,
} from "../../drizzle/schema";
import { and, eq, gte, lte, sql, count, desc, asc, ne, isNotNull } from "drizzle-orm";

// ─────────────────────────────────────────────
// Pipeline Summary Report Generator
// Builds HTML email + CSV for pipeline analytics.
// ─────────────────────────────────────────────

function fmtNum(n: number): string {
  return n.toLocaleString("en-US");
}

function fmtCurrency(cents: number): string {
  return `$${(cents / 100).toLocaleString("en-US", { minimumFractionDigits: 2 })}`;
}

function fmtPct(n: number): string {
  if (isNaN(n) || !isFinite(n)) return "0%";
  return `${Math.round(n)}%`;
}

const TH_STYLE = 'text-align:left;padding:10px 12px;border:1px solid #e5e7eb;font-size:13px;color:#6b7280;';
const TH_STYLE_R = 'text-align:right;padding:10px 12px;border:1px solid #e5e7eb;font-size:13px;color:#6b7280;';
const TD_STYLE = 'padding:10px 12px;border:1px solid #e5e7eb;';
const TD_STYLE_R = 'text-align:right;padding:10px 12px;border:1px solid #e5e7eb;';
const TD_STYLE_RB = 'text-align:right;padding:10px 12px;border:1px solid #e5e7eb;font-weight:600;';

function sectionHeader(title: string): string {
  return `<h2 style="color:#1a1a2e;margin:24px 0 12px;font-size:18px;border-bottom:2px solid #e5e7eb;padding-bottom:8px;">${title}</h2>`;
}

function rowBg(i: number): string {
  return i % 2 === 0 ? "" : ' style="background:#f8f9fa;"';
}

// ─── Section 1: Current Pipeline Snapshot ───

interface StageSnapshot {
  stageId: number;
  stageName: string;
  sortOrder: number;
  isWon: boolean;
  isLost: boolean;
  dealCount: number;
  totalValue: number;
  avgValue: number;
}

async function generateSnapshotSection(
  accountId: number,
  _endDate: Date
): Promise<{ html: string; stages: StageSnapshot[] }> {
  const db = (await getDb())!;

  // Get all stages for this account, sorted
  const stageRows = await db
    .select({
      id: pipelineStages.id,
      name: pipelineStages.name,
      sortOrder: pipelineStages.sortOrder,
      isWon: pipelineStages.isWon,
      isLost: pipelineStages.isLost,
    })
    .from(pipelineStages)
    .where(eq(pipelineStages.accountId, accountId))
    .orderBy(asc(pipelineStages.sortOrder));

  if (stageRows.length === 0) {
    return {
      html: sectionHeader("Current Pipeline Snapshot") +
        '<p style="color:#6b7280;font-size:14px;">No pipeline stages configured.</p>',
      stages: [],
    };
  }

  // Get deal counts and values per stage
  const dealStats = await db
    .select({
      stageId: deals.stageId,
      dealCount: count(),
      totalValue: sql<number>`COALESCE(SUM(${deals.value}), 0)`,
      avgValue: sql<number>`COALESCE(AVG(${deals.value}), 0)`,
    })
    .from(deals)
    .where(eq(deals.accountId, accountId))
    .groupBy(deals.stageId);

  const statsMap = new Map(dealStats.map((s) => [s.stageId, s]));

  const stages: StageSnapshot[] = stageRows.map((stage) => {
    const stats = statsMap.get(stage.id);
    return {
      stageId: stage.id,
      stageName: stage.name,
      sortOrder: stage.sortOrder,
      isWon: stage.isWon,
      isLost: stage.isLost,
      dealCount: stats?.dealCount ?? 0,
      totalValue: Number(stats?.totalValue ?? 0),
      avgValue: Number(stats?.avgValue ?? 0),
    };
  });

  let totalDeals = 0;
  let totalValue = 0;
  let rows = "";

  for (let i = 0; i < stages.length; i++) {
    const s = stages[i];
    totalDeals += s.dealCount;
    totalValue += s.totalValue;
    rows += `<tr${rowBg(i)}>
      <td style="${TD_STYLE}">${s.stageName}</td>
      <td style="${TD_STYLE_RB}">${fmtNum(s.dealCount)}</td>
      <td style="${TD_STYLE_RB}">${fmtCurrency(s.totalValue)}</td>
      <td style="${TD_STYLE_R}">${fmtCurrency(s.avgValue)}</td>
    </tr>`;
  }

  // Footer row
  rows += `<tr style="background:#f0f9ff;font-weight:700;">
    <td style="${TD_STYLE}">Total</td>
    <td style="${TD_STYLE_RB}">${fmtNum(totalDeals)}</td>
    <td style="${TD_STYLE_RB}">${fmtCurrency(totalValue)}</td>
    <td style="${TD_STYLE_R}">${totalDeals > 0 ? fmtCurrency(Math.round(totalValue / totalDeals)) : "$0.00"}</td>
  </tr>`;

  const html = sectionHeader("Current Pipeline Snapshot") + `
    <table style="width:100%;border-collapse:collapse;margin-bottom:16px;">
      <thead>
        <tr style="background:#f8f9fa;">
          <th style="${TH_STYLE}">Stage</th>
          <th style="${TH_STYLE_R}">Deals</th>
          <th style="${TH_STYLE_R}">Total Value</th>
          <th style="${TH_STYLE_R}">Avg Deal Value</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>`;

  return { html, stages };
}

// ─── Section 2: Period Activity ───

interface PeriodActivity {
  dealsCreated: number;
  dealsCreatedValue: number;
  dealsMovedForward: number;
  dealsClosedWon: number;
  dealsClosedWonValue: number;
  dealsClosedLost: number;
  dealsClosedLostValue: number;
  topLossReasons: { reason: string; count: number }[];
}

async function generateActivitySection(
  accountId: number,
  startDate: Date,
  endDate: Date,
  stages: StageSnapshot[]
): Promise<{ html: string; activity: PeriodActivity }> {
  const db = (await getDb())!;

  // Deals created in period
  const [created] = await db
    .select({
      count: count(),
      value: sql<number>`COALESCE(SUM(${deals.value}), 0)`,
    })
    .from(deals)
    .where(
      and(
        eq(deals.accountId, accountId),
        gte(deals.createdAt, startDate),
        lte(deals.createdAt, endDate)
      )
    );

  // Deals moved forward (stageChangedAt in period, not at creation time)
  // "Moved forward" = stageChangedAt in period AND stageChangedAt != createdAt
  const [movedForward] = await db
    .select({ count: count() })
    .from(deals)
    .where(
      and(
        eq(deals.accountId, accountId),
        gte(deals.stageChangedAt, startDate),
        lte(deals.stageChangedAt, endDate),
        sql`${deals.stageChangedAt} != ${deals.createdAt}`
      )
    );

  // Won stages
  const wonStageIds = stages.filter((s) => s.isWon).map((s) => s.stageId);
  const lostStageIds = stages.filter((s) => s.isLost).map((s) => s.stageId);

  let closedWon = { count: 0, value: 0 };
  let closedLost = { count: 0, value: 0 };

  if (wonStageIds.length > 0) {
    const [won] = await db
      .select({
        count: count(),
        value: sql<number>`COALESCE(SUM(${deals.value}), 0)`,
      })
      .from(deals)
      .where(
        and(
          eq(deals.accountId, accountId),
          sql`${deals.stageId} IN (${sql.join(wonStageIds.map(id => sql`${id}`), sql`, `)})`,
          gte(deals.stageChangedAt, startDate),
          lte(deals.stageChangedAt, endDate)
        )
      );
    closedWon = { count: won?.count ?? 0, value: Number(won?.value ?? 0) };
  }

  if (lostStageIds.length > 0) {
    const [lost] = await db
      .select({
        count: count(),
        value: sql<number>`COALESCE(SUM(${deals.value}), 0)`,
      })
      .from(deals)
      .where(
        and(
          eq(deals.accountId, accountId),
          sql`${deals.stageId} IN (${sql.join(lostStageIds.map(id => sql`${id}`), sql`, `)})`,
          gte(deals.stageChangedAt, startDate),
          lte(deals.stageChangedAt, endDate)
        )
      );
    closedLost = { count: lost?.count ?? 0, value: Number(lost?.value ?? 0) };
  }

  // Top loss reasons
  let topLossReasons: { reason: string; count: number }[] = [];
  if (lostStageIds.length > 0) {
    const lossReasonRows = await db
      .select({
        reason: deals.lossReason,
        count: count(),
      })
      .from(deals)
      .where(
        and(
          eq(deals.accountId, accountId),
          sql`${deals.stageId} IN (${sql.join(lostStageIds.map(id => sql`${id}`), sql`, `)})`,
          isNotNull(deals.lossReason),
          sql`${deals.lossReason} != ''`
        )
      )
      .groupBy(deals.lossReason)
      .orderBy(desc(count()))
      .limit(3);

    topLossReasons = lossReasonRows.map((r) => ({
      reason: r.reason || "Unknown",
      count: r.count,
    }));
  }

  const activity: PeriodActivity = {
    dealsCreated: created?.count ?? 0,
    dealsCreatedValue: Number(created?.value ?? 0),
    dealsMovedForward: movedForward?.count ?? 0,
    dealsClosedWon: closedWon.count,
    dealsClosedWonValue: closedWon.value,
    dealsClosedLost: closedLost.count,
    dealsClosedLostValue: closedLost.value,
    topLossReasons,
  };

  let lossReasonsHtml = "";
  if (topLossReasons.length > 0) {
    lossReasonsHtml = `<p style="color:#6b7280;font-size:12px;margin-top:4px;">Top loss reasons: ${topLossReasons.map((r) => `${r.reason} (${r.count})`).join(", ")}</p>`;
  }

  const html = sectionHeader("Period Activity") + `
    <table style="width:100%;border-collapse:collapse;margin-bottom:8px;">
      <tr>
        <td style="padding:12px;background:#eff6ff;border:1px solid #bfdbfe;border-radius:6px;text-align:center;width:25%;">
          <div style="font-size:12px;color:#6b7280;">Deals Created</div>
          <div style="font-size:20px;font-weight:700;color:#2563eb;">${fmtNum(activity.dealsCreated)}</div>
          <div style="font-size:11px;color:#6b7280;">${fmtCurrency(activity.dealsCreatedValue)}</div>
        </td>
        <td style="padding:12px;background:#fefce8;border:1px solid #fde68a;border-radius:6px;text-align:center;width:25%;">
          <div style="font-size:12px;color:#6b7280;">Moved Forward</div>
          <div style="font-size:20px;font-weight:700;color:#ca8a04;">${fmtNum(activity.dealsMovedForward)}</div>
        </td>
        <td style="padding:12px;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:6px;text-align:center;width:25%;">
          <div style="font-size:12px;color:#6b7280;">Closed Won</div>
          <div style="font-size:20px;font-weight:700;color:#16a34a;">${fmtNum(activity.dealsClosedWon)}</div>
          <div style="font-size:11px;color:#6b7280;">${fmtCurrency(activity.dealsClosedWonValue)}</div>
        </td>
        <td style="padding:12px;background:#fef2f2;border:1px solid #fecaca;border-radius:6px;text-align:center;width:25%;">
          <div style="font-size:12px;color:#6b7280;">Closed Lost</div>
          <div style="font-size:20px;font-weight:700;color:#dc2626;">${fmtNum(activity.dealsClosedLost)}</div>
          <div style="font-size:11px;color:#6b7280;">${fmtCurrency(activity.dealsClosedLostValue)}</div>
        </td>
      </tr>
    </table>
    ${lossReasonsHtml}`;

  return { html, activity };
}

// ─── Section 3: Conversion Funnel ───

async function generateFunnelSection(
  accountId: number,
  startDate: Date,
  endDate: Date,
  stages: StageSnapshot[]
): Promise<string> {
  const db = (await getDb())!;

  // Filter to non-won/non-lost stages for funnel, then add won at end
  const funnelStages = stages.filter((s) => !s.isWon && !s.isLost);
  const wonStages = stages.filter((s) => s.isWon);

  if (funnelStages.length < 2 && wonStages.length === 0) {
    return sectionHeader("Conversion Funnel") +
      '<p style="color:#6b7280;font-size:14px;">Not enough stages to calculate conversion funnel.</p>';
  }

  // For each consecutive stage pair, calculate conversion
  // "Deals that entered Stage A during period" / "Deals that reached Stage B"
  // Since we don't have full history, we approximate:
  // Stage A count = deals currently in stage A + deals that passed through A (now in later stages)
  // For simplicity: use current deal counts per stage
  const allFunnelStages = [...funnelStages, ...wonStages];

  let funnelRows = "";
  for (let i = 0; i < allFunnelStages.length - 1; i++) {
    const stageA = allFunnelStages[i];
    const stageB = allFunnelStages[i + 1];
    // Deals that are in stageB or any later stage = "reached B"
    const laterStages = allFunnelStages.slice(i + 1);
    const reachedB = laterStages.reduce((sum, s) => sum + s.dealCount, 0);
    // Deals in stageA or any later stage = "entered A"
    const enteredA = allFunnelStages.slice(i).reduce((sum, s) => sum + s.dealCount, 0);
    const conversionRate = enteredA > 0 ? (reachedB / enteredA) * 100 : 0;

    const bg = i % 2 === 0 ? "" : ' style="background:#f8f9fa;"';
    funnelRows += `<tr${bg}>
      <td style="${TD_STYLE}">${stageA.stageName} &rarr; ${stageB.stageName}</td>
      <td style="${TD_STYLE_RB}">${fmtPct(conversionRate)}</td>
    </tr>`;
  }

  // Overall win rate
  const wonCount = wonStages.reduce((sum, s) => sum + s.dealCount, 0);
  const lostStages = stages.filter((s) => s.isLost);
  const lostCount = lostStages.reduce((sum, s) => sum + s.dealCount, 0);
  const totalClosed = wonCount + lostCount;
  const winRate = totalClosed > 0 ? (wonCount / totalClosed) * 100 : 0;

  const html = sectionHeader("Conversion Funnel") + `
    <table style="width:100%;border-collapse:collapse;margin-bottom:12px;">
      <thead>
        <tr style="background:#f8f9fa;">
          <th style="${TH_STYLE}">Stage Transition</th>
          <th style="${TH_STYLE_R}">Conversion Rate</th>
        </tr>
      </thead>
      <tbody>${funnelRows}</tbody>
    </table>
    <table style="width:100%;border-collapse:collapse;margin-bottom:16px;">
      <tr>
        <td style="padding:14px;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:6px;text-align:center;">
          <div style="font-size:12px;color:#6b7280;">Overall Win Rate</div>
          <div style="font-size:24px;font-weight:700;color:#16a34a;">${fmtPct(winRate)}</div>
          <div style="font-size:11px;color:#6b7280;">${fmtNum(wonCount)} won / ${fmtNum(totalClosed)} closed</div>
        </td>
      </tr>
    </table>`;

  return html;
}

// ─── Section 4: Stale Deals ───

interface StaleDeal {
  dealId: number;
  contactName: string;
  stageName: string;
  daysStagnant: number;
  value: number;
  assignedUserName: string;
}

async function generateStaleDealSection(
  accountId: number,
  stages: StageSnapshot[]
): Promise<{ html: string; staleDeals: StaleDeal[] }> {
  const db = (await getDb())!;

  // Exclude won/lost stages
  const closedStageIds = stages.filter((s) => s.isWon || s.isLost).map((s) => s.stageId);
  const staleThreshold = new Date();
  staleThreshold.setDate(staleThreshold.getDate() - 14);

  let staleCondition = and(
    eq(deals.accountId, accountId),
    lte(deals.stageChangedAt, staleThreshold)
  );

  if (closedStageIds.length > 0) {
    staleCondition = and(
      staleCondition,
      sql`${deals.stageId} NOT IN (${sql.join(closedStageIds.map(id => sql`${id}`), sql`, `)})`
    );
  }

  const staleRows = await db
    .select({
      dealId: deals.id,
      dealTitle: deals.title,
      dealValue: deals.value,
      stageId: deals.stageId,
      stageChangedAt: deals.stageChangedAt,
      assignedUserId: deals.assignedUserId,
      contactFirstName: contacts.firstName,
      contactLastName: contacts.lastName,
    })
    .from(deals)
    .leftJoin(contacts, eq(deals.contactId, contacts.id))
    .where(staleCondition!)
    .orderBy(asc(deals.stageChangedAt))
    .limit(10);

  if (staleRows.length === 0) {
    return {
      html: sectionHeader("Stale Deals") +
        '<p style="color:#6b7280;font-size:14px;">No stale deals (all deals moved within the last 14 days).</p>',
      staleDeals: [],
    };
  }

  // Build stage name map
  const stageMap = new Map(stages.map((s) => [s.stageId, s.stageName]));

  // Get assigned user names
  const userIds = [...new Set(staleRows.filter((r) => r.assignedUserId).map((r) => r.assignedUserId!))];
  const userMap = new Map<number, string>();
  if (userIds.length > 0) {
    const userRows = await db
      .select({ id: users.id, name: users.name })
      .from(users)
      .where(sql`${users.id} IN (${sql.join(userIds.map(id => sql`${id}`), sql`, `)})`);
    for (const u of userRows) {
      userMap.set(u.id, u.name || "Unknown");
    }
  }

  const now = new Date();
  const staleDeals: StaleDeal[] = staleRows.map((r) => {
    const changedAt = r.stageChangedAt ? new Date(r.stageChangedAt) : new Date(0);
    const daysStagnant = Math.floor((now.getTime() - changedAt.getTime()) / (1000 * 60 * 60 * 24));
    return {
      dealId: r.dealId,
      contactName: [r.contactFirstName, r.contactLastName].filter(Boolean).join(" ") || "Unknown",
      stageName: stageMap.get(r.stageId) || "Unknown",
      daysStagnant,
      value: r.dealValue ?? 0,
      assignedUserName: r.assignedUserId ? (userMap.get(r.assignedUserId) || "Unassigned") : "Unassigned",
    };
  });

  // Get total stale count + value
  const [totalStale] = await db
    .select({
      count: count(),
      value: sql<number>`COALESCE(SUM(${deals.value}), 0)`,
    })
    .from(deals)
    .where(staleCondition!);

  let tableRows = "";
  for (let i = 0; i < staleDeals.length; i++) {
    const d = staleDeals[i];
    tableRows += `<tr${rowBg(i)}>
      <td style="${TD_STYLE}">${d.contactName}</td>
      <td style="${TD_STYLE}">${d.stageName}</td>
      <td style="${TD_STYLE_RB}">${d.daysStagnant}d</td>
      <td style="${TD_STYLE_RB}">${fmtCurrency(d.value)}</td>
      <td style="${TD_STYLE}">${d.assignedUserName}</td>
    </tr>`;
  }

  const html = sectionHeader("Stale Deals") + `
    <p style="color:#6b7280;font-size:13px;margin-bottom:8px;">
      ${fmtNum(totalStale?.count ?? 0)} stale deals totaling ${fmtCurrency(Number(totalStale?.value ?? 0))} (not moved in 14+ days)
    </p>
    <table style="width:100%;border-collapse:collapse;margin-bottom:16px;">
      <thead>
        <tr style="background:#f8f9fa;">
          <th style="${TH_STYLE}">Contact</th>
          <th style="${TH_STYLE}">Current Stage</th>
          <th style="${TH_STYLE_R}">Days Stagnant</th>
          <th style="${TH_STYLE_R}">Deal Value</th>
          <th style="${TH_STYLE}">Assigned To</th>
        </tr>
      </thead>
      <tbody>${tableRows}</tbody>
    </table>`;

  return { html, staleDeals };
}

// ─── Section 5: Top Performers ───

async function generatePerformersSection(
  accountId: number,
  startDate: Date,
  endDate: Date,
  stages: StageSnapshot[]
): Promise<string> {
  const db = (await getDb())!;

  // Check if account has >1 user
  const [memberCount] = await db
    .select({ count: count() })
    .from(accountMembers)
    .where(and(eq(accountMembers.accountId, accountId), eq(accountMembers.isActive, true)));

  if ((memberCount?.count ?? 0) <= 1) {
    return ""; // Skip section for single-user accounts
  }

  const wonStageIds = stages.filter((s) => s.isWon).map((s) => s.stageId);
  if (wonStageIds.length === 0) {
    return sectionHeader("Top Performers") +
      '<p style="color:#6b7280;font-size:14px;">No "Won" stage configured — cannot calculate performer stats.</p>';
  }

  // Get per-user stats for deals closed won in period
  const performerRows = await db
    .select({
      userId: deals.assignedUserId,
      dealsWon: count(),
      totalValue: sql<number>`COALESCE(SUM(${deals.value}), 0)`,
      avgDealSize: sql<number>`COALESCE(AVG(${deals.value}), 0)`,
    })
    .from(deals)
    .where(
      and(
        eq(deals.accountId, accountId),
        sql`${deals.stageId} IN (${sql.join(wonStageIds.map(id => sql`${id}`), sql`, `)})`,
        gte(deals.stageChangedAt, startDate),
        lte(deals.stageChangedAt, endDate),
        isNotNull(deals.assignedUserId)
      )
    )
    .groupBy(deals.assignedUserId)
    .orderBy(desc(sql`SUM(${deals.value})`));

  if (performerRows.length === 0) {
    return sectionHeader("Top Performers") +
      '<p style="color:#6b7280;font-size:14px;">No deals closed won by assigned users during this period.</p>';
  }

  // Get user names
  const userIds = performerRows.filter((r) => r.userId).map((r) => r.userId!);
  const userMap = new Map<number, string>();
  if (userIds.length > 0) {
    const userRows = await db
      .select({ id: users.id, name: users.name })
      .from(users)
      .where(sql`${users.id} IN (${sql.join(userIds.map(id => sql`${id}`), sql`, `)})`);
    for (const u of userRows) {
      userMap.set(u.id, u.name || "Unknown");
    }
  }

  let tableRows = "";
  for (let i = 0; i < performerRows.length; i++) {
    const p = performerRows[i];
    const userName = p.userId ? (userMap.get(p.userId) || "Unknown") : "Unassigned";
    tableRows += `<tr${rowBg(i)}>
      <td style="${TD_STYLE}">${userName}</td>
      <td style="${TD_STYLE_RB}">${fmtNum(p.dealsWon)}</td>
      <td style="${TD_STYLE_RB}">${fmtCurrency(Number(p.totalValue))}</td>
      <td style="${TD_STYLE_R}">${fmtCurrency(Number(p.avgDealSize))}</td>
    </tr>`;
  }

  return sectionHeader("Top Performers") + `
    <table style="width:100%;border-collapse:collapse;margin-bottom:16px;">
      <thead>
        <tr style="background:#f8f9fa;">
          <th style="${TH_STYLE}">Team Member</th>
          <th style="${TH_STYLE_R}">Deals Won</th>
          <th style="${TH_STYLE_R}">Total Value</th>
          <th style="${TH_STYLE_R}">Avg Deal Size</th>
        </tr>
      </thead>
      <tbody>${tableRows}</tbody>
    </table>`;
}

// ─── Main Pipeline Summary Generator ───

export interface PipelineSummaryData {
  accountId: number;
  accountName: string;
  periodDays: number;
  brandColor?: string;
  /** Override start/end for custom date ranges */
  startDate?: Date;
  endDate?: Date;
}

export async function generatePipelineSummaryReport(
  data: PipelineSummaryData
): Promise<{ html: string; csv: string }> {
  const { accountId, accountName, periodDays, brandColor } = data;
  const primaryColor = brandColor || "#c9a84c";

  const endDate = data.endDate || new Date();
  const startDate = data.startDate || new Date(endDate.getTime() - periodDays * 24 * 60 * 60 * 1000);

  const dateRange = `${startDate.toLocaleDateString("en-US", { month: "short", day: "numeric" })} — ${endDate.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`;

  // Generate all 5 sections
  const { html: snapshotHtml, stages } = await generateSnapshotSection(accountId, endDate);
  const { html: activityHtml, activity } = await generateActivitySection(accountId, startDate, endDate, stages);
  const funnelHtml = await generateFunnelSection(accountId, startDate, endDate, stages);
  const { html: staleHtml, staleDeals } = await generateStaleDealSection(accountId, stages);
  const performersHtml = await generatePerformersSection(accountId, startDate, endDate, stages);

  const html = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table style="width:100%;max-width:680px;margin:0 auto;background:#ffffff;">
    <tr>
      <td style="background:${primaryColor};padding:24px 32px;">
        <h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:700;">${accountName}</h1>
        <p style="margin:4px 0 0;color:rgba(255,255,255,0.85);font-size:14px;">Pipeline Summary Report</p>
      </td>
    </tr>
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
    <tr>
      <td style="padding:8px 32px 32px;">
        ${snapshotHtml}
        ${activityHtml}
        ${funnelHtml}
        ${staleHtml}
        ${performersHtml}
      </td>
    </tr>
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

  // ─── CSV ───
  let csv = "Section,Metric,Value\n";

  // Snapshot
  for (const s of stages) {
    csv += `Pipeline Snapshot,${s.stageName} - Deals,${s.dealCount}\n`;
    csv += `Pipeline Snapshot,${s.stageName} - Value,$${(s.totalValue / 100).toFixed(2)}\n`;
  }

  // Activity
  csv += `Period Activity,Deals Created,${activity.dealsCreated}\n`;
  csv += `Period Activity,Deals Created Value,$${(activity.dealsCreatedValue / 100).toFixed(2)}\n`;
  csv += `Period Activity,Deals Moved Forward,${activity.dealsMovedForward}\n`;
  csv += `Period Activity,Deals Closed Won,${activity.dealsClosedWon}\n`;
  csv += `Period Activity,Deals Closed Won Value,$${(activity.dealsClosedWonValue / 100).toFixed(2)}\n`;
  csv += `Period Activity,Deals Closed Lost,${activity.dealsClosedLost}\n`;
  csv += `Period Activity,Deals Closed Lost Value,$${(activity.dealsClosedLostValue / 100).toFixed(2)}\n`;

  // Loss reasons
  for (const r of activity.topLossReasons) {
    csv += `Loss Reasons,${r.reason},${r.count}\n`;
  }

  // Stale deals
  for (const d of staleDeals) {
    csv += `Stale Deals,${d.contactName} (${d.stageName}),${d.daysStagnant} days - $${(d.value / 100).toFixed(2)}\n`;
  }

  return { html, csv };
}

/**
 * Generate just the HTML section for embedding in the main report email.
 */
export async function generatePipelineSummarySection(
  accountId: number,
  days: number
): Promise<string> {
  const endDate = new Date();
  const startDate = new Date(endDate.getTime() - days * 24 * 60 * 60 * 1000);

  const { html: snapshotHtml, stages } = await generateSnapshotSection(accountId, endDate);
  const { html: activityHtml } = await generateActivitySection(accountId, startDate, endDate, stages);
  const funnelHtml = await generateFunnelSection(accountId, startDate, endDate, stages);
  const { html: staleHtml } = await generateStaleDealSection(accountId, stages);
  const performersHtml = await generatePerformersSection(accountId, startDate, endDate, stages);

  return snapshotHtml + activityHtml + funnelHtml + staleHtml + performersHtml;
}
