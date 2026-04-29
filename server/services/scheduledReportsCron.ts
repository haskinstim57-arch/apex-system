import {
  listDueScheduledReports,
  updateScheduledReport,
  createNotification,
} from "../db";
import { getDb } from "../db";
import { accounts } from "../../drizzle/schema";
import { eq } from "drizzle-orm";
import { sendEmail } from "./sendgrid";
import { generateReportEmailHTML, generateReportCSV, generateDailyActivityReport, getDailyActivityDateWindow, generateDailyMarketingReport, getDailyMarketingDateWindow, getWeekendReportSubject } from "./reportEmailGenerator";

// ─────────────────────────────────────────────
// Scheduled Reports Cron Job
// Runs every 5 minutes, finds reports where
// nextRunAt <= now and isActive = true,
// then generates and emails the analytics summary.
// ─────────────────────────────────────────────

const CRON_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes
let cronTimer: ReturnType<typeof setInterval> | null = null;

/** Start the scheduled reports cron job */
export function startScheduledReportsCron() {
  if (cronTimer) return;
  console.log("[ScheduledReportsCron] Starting background worker (5m interval)");
  cronTimer = setInterval(async () => {
    try {
      await processScheduledReports();
    } catch (err) {
      console.error("[ScheduledReportsCron] Worker error:", err);
    }
  }, CRON_INTERVAL_MS);
  // Run once after a short delay to let DB connections warm up
  setTimeout(() => {
    processScheduledReports().catch((err) =>
      console.error("[ScheduledReportsCron] Initial run error:", err)
    );
  }, 30_000);
}

/** Stop the scheduled reports cron job */
export function stopScheduledReportsCron() {
  if (cronTimer) {
    clearInterval(cronTimer);
    cronTimer = null;
    console.log("[ScheduledReportsCron] Stopped background worker");
  }
}

/**
 * Get the UTC offset in minutes for a given IANA timezone at a specific date.
 * Positive = behind UTC (e.g., America/New_York = +240 or +300)
 * Uses Intl.DateTimeFormat to determine the local time in the target timezone.
 */
export function getTimezoneOffsetForDate(timezone: string, date: Date): number {
  try {
    // Get the time parts in the target timezone
    const formatter = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    });
    const parts = formatter.formatToParts(date);
    const get = (type: string) => parseInt(parts.find((p) => p.type === type)?.value || "0");
    const localYear = get("year");
    const localMonth = get("month") - 1;
    const localDay = get("day");
    let localHour = get("hour");
    if (localHour === 24) localHour = 0; // midnight edge case
    const localMinute = get("minute");
    const localSecond = get("second");

    // Build a UTC date from the local parts
    const localAsUTC = Date.UTC(localYear, localMonth, localDay, localHour, localMinute, localSecond);
    // The offset is the difference between the local interpretation and actual UTC
    return (localAsUTC - date.getTime()) / 60000;
  } catch {
    // If timezone is invalid, default to UTC (offset 0)
    console.warn(`[ScheduledReportsCron] Invalid timezone "${timezone}", defaulting to UTC`);
    return 0;
  }
}

/** Calculate the next run time based on frequency, with proper timezone handling */
export function calculateNextRunAt(
  frequency: "daily" | "weekly" | "monthly" | "daily_activity" | "daily_marketing",
  sendHour: number,
  timezone: string,
  dayOfWeek?: number | null,
  dayOfMonth?: number | null
): Date {
  const now = new Date();

  /**
   * Convert a local sendHour to the correct UTC hour for a given candidate date.
   * Uses Intl.DateTimeFormat against the candidate date so DST is respected.
   *
   * Approach: check what local hour noon-UTC corresponds to on the candidate date.
   * offset = localHourAtNoonUTC - 12
   * e.g. PDT (UTC-7): noon UTC → 5 AM local → offset = 5 - 12 = -7
   * e.g. PST (UTC-8): noon UTC → 4 AM local → offset = 4 - 12 = -8
   * UTC hour = local sendHour - offset (mod 24)
   */
  function localHourToUTCHour(candidateDate: Date): number {
    // Reference: noon UTC on the candidate date — safely inside any day regardless of DST gaps
    const noon = new Date(candidateDate);
    noon.setUTCHours(12, 0, 0, 0);

    // What local hour does noon UTC correspond to in the target timezone?
    const localHourAtNoonUTC = parseInt(
      new Intl.DateTimeFormat("en-US", {
        timeZone: timezone,
        hour: "numeric",
        hour12: false,
      }).format(noon),
      10
    );

    const utcOffsetHours = localHourAtNoonUTC - 12;

    // UTC hour = local sendHour - offset (mod 24)
    return ((sendHour - utcOffsetHours) % 24 + 24) % 24;
  }

  const next = new Date(now);

  if (frequency === "daily_activity" || frequency === "daily_marketing") {
    const hour = sendHour ?? 7;
    // Temporarily override sendHour for the closure
    const origSendHour = sendHour;
    sendHour = hour;
    const utcHour = localHourToUTCHour(next);
    next.setUTCHours(utcHour, 0, 0, 0);
    if (next <= now) {
      next.setUTCDate(next.getUTCDate() + 1);
      // Recompute UTC hour for the new date (DST may have changed)
      next.setUTCHours(localHourToUTCHour(next), 0, 0, 0);
    }
    // Skip Saturday (6) and Sunday (0)
    while (next.getUTCDay() === 0 || next.getUTCDay() === 6) {
      next.setUTCDate(next.getUTCDate() + 1);
      next.setUTCHours(localHourToUTCHour(next), 0, 0, 0);
    }
    sendHour = origSendHour;
  } else if (frequency === "daily") {
    next.setUTCHours(localHourToUTCHour(next), 0, 0, 0);
    if (next <= now) {
      next.setUTCDate(next.getUTCDate() + 1);
      next.setUTCHours(localHourToUTCHour(next), 0, 0, 0);
    }
  } else if (frequency === "weekly") {
    const targetDay = dayOfWeek ?? 1;
    next.setUTCHours(localHourToUTCHour(next), 0, 0, 0);
    const currentDay = next.getUTCDay();
    let daysUntil = targetDay - currentDay;
    if (daysUntil <= 0) daysUntil += 7;
    if (daysUntil === 0 && next <= now) daysUntil = 7;
    next.setUTCDate(next.getUTCDate() + daysUntil);
    next.setUTCHours(localHourToUTCHour(next), 0, 0, 0);
  } else if (frequency === "monthly") {
    const targetDate = Math.min(dayOfMonth ?? 1, 28);
    next.setUTCDate(targetDate);
    next.setUTCHours(localHourToUTCHour(next), 0, 0, 0);
    if (next <= now) {
      next.setUTCMonth(next.getUTCMonth() + 1);
      next.setUTCDate(targetDate);
      next.setUTCHours(localHourToUTCHour(next), 0, 0, 0);
    }
  }

  return next;
}

/** Process all due scheduled reports */
async function processScheduledReports() {
  const dueReports = await listDueScheduledReports();
  if (dueReports.length === 0) return;

  console.log(`[ScheduledReportsCron] Found ${dueReports.length} report(s) due for delivery`);

  for (const report of dueReports) {
    try {
      await executeReport(report);
    } catch (err: any) {
      console.error(`[ScheduledReportsCron] Error processing report ${report.id}:`, err);
      await updateScheduledReport(report.id, report.accountId, {
        lastRunAt: new Date(),
        lastRunStatus: "failed",
        lastRunError: err?.message || String(err),
        nextRunAt: calculateNextRunAt(
          report.frequency,
          report.sendHour,
          report.timezone,
          report.dayOfWeek,
          report.dayOfMonth
        ),
      });
    }
  }
}

/** Execute a single scheduled report */
async function executeReport(report: {
  id: number;
  accountId: number;
  name: string;
  frequency: "daily" | "weekly" | "monthly" | "daily_activity" | "daily_marketing";
  sendHour: number;
  timezone: string;
  dayOfWeek: number | null;
  dayOfMonth: number | null;
  reportTypes: string[];
  recipients: string[];
  periodDays: number;
}) {
  const db = (await getDb())!;

  // Get account name for branding
  const [account] = await db
    .select({ name: accounts.name, primaryColor: accounts.primaryColor })
    .from(accounts)
    .where(eq(accounts.id, report.accountId));

  const accountName = account?.name || "Sterling Marketing";
  const brandColor = account?.primaryColor || undefined;

  console.log(
    `[ScheduledReportsCron] Generating report "${report.name}" for account ${report.accountId} (${accountName})`
  );

  let htmlContent: string;
  let attachments: Array<{ content: string; filename: string; type: string }> | undefined;
  let emailSubject = `${report.name} — ${accountName} Analytics Report`;

  // ─── Daily Activity Report (special handling) ───
  if (report.reportTypes.includes("daily_activity")) {
    const dateWindow = getDailyActivityDateWindow(new Date());
    if (!dateWindow) {
      console.log(`[ScheduledReportsCron] Skipping daily_activity on weekend`);
      await updateScheduledReport(report.id, report.accountId, {
        lastRunAt: new Date(),
        lastRunStatus: "success",
        lastRunError: null,
        nextRunAt: calculateNextRunAt(report.frequency, report.sendHour, report.timezone, report.dayOfWeek, report.dayOfMonth),
      });
      return;
    }

    const result = await generateDailyActivityReport(
      report.accountId,
      dateWindow.startDate,
      dateWindow.endDate,
      accountName,
      brandColor
    );
    htmlContent = result.html;
    attachments = [
      {
        content: Buffer.from(result.csv).toString("base64"),
        filename: `daily-activity-report.csv`,
        type: "text/csv",
      },
    ];

    // If Monday (weekend consolidation), use weekend subject line
    const now = new Date();
    if (now.getDay() === 1) {
      emailSubject = getWeekendReportSubject(dateWindow.startDate, dateWindow.endDate);
    }
  } else if (report.reportTypes.includes("daily_marketing")) {
    // ─── Daily Marketing Report ───
    const dateWindow = getDailyMarketingDateWindow(new Date());
    if (!dateWindow) {
      console.log(`[ScheduledReportsCron] Skipping daily_marketing on weekend`);
      await updateScheduledReport(report.id, report.accountId, {
        lastRunAt: new Date(),
        lastRunStatus: "success",
        lastRunError: null,
        nextRunAt: calculateNextRunAt(report.frequency, report.sendHour, report.timezone, report.dayOfWeek, report.dayOfMonth),
      });
      return;
    }

    const result = await generateDailyMarketingReport(
      report.accountId,
      dateWindow.startDate,
      dateWindow.endDate,
      accountName,
      brandColor
    );
    htmlContent = result.html;
    attachments = [
      {
        content: Buffer.from(result.csv).toString("base64"),
        filename: `daily-marketing-report.csv`,
        type: "text/csv",
      },
    ];
    emailSubject = `Daily Marketing Report — ${accountName}`;

    // If Monday (weekend consolidation), use weekend subject line
    const now = new Date();
    if (now.getDay() === 1) {
      emailSubject = getWeekendReportSubject(dateWindow.startDate, dateWindow.endDate);
    }
  } else {
    // ─── Standard report types ───
    htmlContent = await generateReportEmailHTML({
      accountId: report.accountId,
      accountName,
      reportName: report.name,
      reportTypes: report.reportTypes,
      periodDays: report.periodDays,
      brandColor,
    });

    if (report.reportTypes.includes("kpis")) {
      const csvContent = await generateReportCSV(report.accountId, report.periodDays, "kpis");
      attachments = [
        {
          content: Buffer.from(csvContent).toString("base64"),
          filename: `analytics-report-${report.periodDays}d.csv`,
          type: "text/csv",
        },
      ];
    }
  }

  // Send to all recipients
  let successCount = 0;
  let lastError = "";

  for (const recipient of report.recipients) {
    const result = await sendEmail({
      to: recipient,
      subject: emailSubject,
      body: htmlContent,
      accountId: report.accountId,
      attachments,
    });

    if (result.success) {
      successCount++;
    } else {
      lastError = result.error || "Unknown error";
      console.error(
        `[ScheduledReportsCron] Failed to send to ${recipient}: ${lastError}`
      );
    }
  }

  const allSuccess = successCount === report.recipients.length;

  // Update the schedule
  await updateScheduledReport(report.id, report.accountId, {
    lastRunAt: new Date(),
    lastRunStatus: allSuccess ? "success" : "partial",
    lastRunError: allSuccess ? null : `${successCount}/${report.recipients.length} delivered. Last error: ${lastError}`,
    nextRunAt: calculateNextRunAt(
      report.frequency,
      report.sendHour,
      report.timezone,
      report.dayOfWeek,
      report.dayOfMonth
    ),
  });

  console.log(
    `[ScheduledReportsCron] Report "${report.name}" delivered to ${successCount}/${report.recipients.length} recipients`
  );

  // Create in-app notification
  createNotification({
    accountId: report.accountId,
    userId: null,
    type: "report_sent",
    title: `Scheduled report "${report.name}" sent`,
    body: `Delivered to ${successCount}/${report.recipients.length} recipients`,
    link: "/settings",
  }).catch((err) =>
    console.error("[ScheduledReportsCron] Notification error:", err)
  );
}
