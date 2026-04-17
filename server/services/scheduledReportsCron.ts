import {
  listDueScheduledReports,
  updateScheduledReport,
  createNotification,
} from "../db";
import { getDb } from "../db";
import { accounts } from "../../drizzle/schema";
import { eq } from "drizzle-orm";
import { sendEmail } from "./sendgrid";
import { generateReportEmailHTML, generateReportCSV, generateDailyActivityReport, getDailyActivityDateWindow } from "./reportEmailGenerator";

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

/** Calculate the next run time based on frequency */
export function calculateNextRunAt(
  frequency: "daily" | "weekly" | "monthly" | "daily_activity",
  sendHour: number,
  timezone: string,
  dayOfWeek?: number | null,
  dayOfMonth?: number | null
): Date {
  const now = new Date();

  // We'll calculate in UTC and adjust for timezone offset
  // For simplicity, use a fixed offset approach
  const next = new Date(now);

  if (frequency === "daily_activity") {
    // Daily activity reports only run Mon-Fri at sendHour (default 7 AM)
    const hour = sendHour ?? 7;
    next.setUTCHours(hour, 0, 0, 0);
    if (next <= now) {
      next.setUTCDate(next.getUTCDate() + 1);
    }
    // Skip Saturday (6) and Sunday (0)
    while (next.getUTCDay() === 0 || next.getUTCDay() === 6) {
      next.setUTCDate(next.getUTCDate() + 1);
    }
  } else if (frequency === "daily") {
    // Next occurrence at sendHour
    next.setUTCHours(sendHour, 0, 0, 0);
    if (next <= now) {
      next.setUTCDate(next.getUTCDate() + 1);
    }
  } else if (frequency === "weekly") {
    const targetDay = dayOfWeek ?? 1; // Default Monday
    next.setUTCHours(sendHour, 0, 0, 0);
    const currentDay = next.getUTCDay();
    let daysUntil = targetDay - currentDay;
    if (daysUntil <= 0) daysUntil += 7;
    if (daysUntil === 0 && next <= now) daysUntil = 7;
    next.setUTCDate(next.getUTCDate() + daysUntil);
  } else if (frequency === "monthly") {
    const targetDate = Math.min(dayOfMonth ?? 1, 28); // Cap at 28 to avoid month-end issues
    next.setUTCHours(sendHour, 0, 0, 0);
    next.setUTCDate(targetDate);
    if (next <= now) {
      next.setUTCMonth(next.getUTCMonth() + 1);
      next.setUTCDate(targetDate);
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
  frequency: "daily" | "weekly" | "monthly" | "daily_activity";
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

  // ─── Daily Activity Report (special handling) ───
  if (report.reportTypes.includes("daily_activity")) {
    const dateWindow = getDailyActivityDateWindow(new Date());
    if (!dateWindow) {
      // Weekend — skip silently
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
      subject: `${report.name} — ${accountName} Analytics Report`,
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
