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

/**
 * Convert a desired local hour (in a given IANA timezone) to the equivalent UTC time,
 * accounting for DST. Returns the UTC Date for "today at sendHour:00 in timezone".
 *
 * Uses an iterative correction approach: starts with a naive UTC guess, checks what
 * local hour it maps to, and adjusts until the local hour matches. This is immune to
 * offset calculation bugs and handles DST transitions correctly.
 */
export function localHourToUTC(sendHour: number, timezone: string, baseDate: Date): Date {
  // Get what "today" is in the target timezone
  const dateFormatter = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour12: false,
  });
  const dateParts = dateFormatter.formatToParts(baseDate);
  const getDate = (type: string) => parseInt(dateParts.find((p) => p.type === type)?.value || "0");
  const localYear = getDate("year");
  const localMonth = getDate("month") - 1;
  const localDay = getDate("day");

  // Start with a naive guess: treat sendHour as if it were UTC
  let guess = new Date(Date.UTC(localYear, localMonth, localDay, sendHour, 0, 0));

  // Formatter to check what local time our guess maps to
  const checkFormatter = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

  // Iterate up to 3 times to converge (usually converges in 1)
  for (let i = 0; i < 3; i++) {
    const localParts = checkFormatter.formatToParts(guess);
    const getP = (type: string) => parseInt(localParts.find((p) => p.type === type)?.value || "0");
    let localHour = getP("hour");
    if (localHour === 24) localHour = 0; // midnight edge case
    const localDayCheck = getP("day");

    // Check both hour AND day match
    if (localHour === sendHour && localDayCheck === localDay) break;

    // Calculate adjustment needed
    let adjustHours = sendHour - localHour;
    if (adjustHours > 12) adjustHours -= 24;
    if (adjustHours < -12) adjustHours += 24;

    // Also correct for day mismatch (can happen near midnight with large offsets)
    if (localDayCheck !== localDay) {
      const dayDiff = localDay - localDayCheck;
      adjustHours += dayDiff * 24;
    }

    guess = new Date(guess.getTime() + adjustHours * 3600000);
  }

  return guess;
}

/**
 * Get the day of week in the target timezone for a given UTC date.
 */
function getDayOfWeekInTimezone(date: Date, timezone: string): number {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    weekday: "short",
  });
  const dayStr = formatter.format(date);
  const dayMap: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  return dayMap[dayStr] ?? date.getUTCDay();
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

  if (frequency === "daily_activity" || frequency === "daily_marketing") {
    // Daily activity/marketing reports only run Mon-Fri at sendHour in the account's timezone
    const hour = sendHour ?? 7;
    let next = localHourToUTC(hour, timezone, now);
    if (next <= now) {
      // Move to next day
      const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
      next = localHourToUTC(hour, timezone, tomorrow);
    }
    // Skip Saturday (6) and Sunday (0) in the local timezone
    let localDay = getDayOfWeekInTimezone(next, timezone);
    while (localDay === 0 || localDay === 6) {
      next = new Date(next.getTime() + 24 * 60 * 60 * 1000);
      // Recalculate to handle DST transitions on the new day
      next = localHourToUTC(hour, timezone, next);
      localDay = getDayOfWeekInTimezone(next, timezone);
    }
    return next;
  } else if (frequency === "daily") {
    // Next occurrence at sendHour in the account's timezone
    let next = localHourToUTC(sendHour, timezone, now);
    if (next <= now) {
      const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
      next = localHourToUTC(sendHour, timezone, tomorrow);
    }
    return next;
  } else if (frequency === "weekly") {
    const targetDay = dayOfWeek ?? 1; // Default Monday
    let next = localHourToUTC(sendHour, timezone, now);
    const currentLocalDay = getDayOfWeekInTimezone(next, timezone);
    let daysUntil = targetDay - currentLocalDay;
    if (daysUntil < 0) daysUntil += 7;
    if (daysUntil === 0 && next <= now) daysUntil = 7;
    if (daysUntil > 0) {
      const targetDate = new Date(now.getTime() + daysUntil * 24 * 60 * 60 * 1000);
      next = localHourToUTC(sendHour, timezone, targetDate);
    }
    return next;
  } else if (frequency === "monthly") {
    const targetDate = Math.min(dayOfMonth ?? 1, 28); // Cap at 28 to avoid month-end issues
    // Get current local date in timezone
    const formatter = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour12: false,
    });
    const parts = formatter.formatToParts(now);
    const get = (type: string) => parseInt(parts.find((p) => p.type === type)?.value || "0");
    let localYear = get("year");
    let localMonth = get("month") - 1;

    // Build the target date in the local timezone
    let candidate = new Date(Date.UTC(localYear, localMonth, targetDate, sendHour, 0, 0));
    let next = localHourToUTC(sendHour, timezone, candidate);
    if (next <= now) {
      // Move to next month
      localMonth++;
      if (localMonth > 11) {
        localMonth = 0;
        localYear++;
      }
      candidate = new Date(Date.UTC(localYear, localMonth, targetDate, sendHour, 0, 0));
      next = localHourToUTC(sendHour, timezone, candidate);
    }
    return next;
  }

  // Fallback (shouldn't reach here)
  return new Date(now.getTime() + 24 * 60 * 60 * 1000);
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
