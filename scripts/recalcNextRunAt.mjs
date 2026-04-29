import { createConnection } from "mysql2/promise";

/**
 * Recalculate nextRunAt for all active scheduled reports using the
 * noon-UTC offset approach (matches the server code).
 */

function localHourToUTCHour(sendHour, timezone, candidateDate) {
  const noon = new Date(candidateDate);
  noon.setUTCHours(12, 0, 0, 0);
  const localHourAtNoonUTC = parseInt(
    new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      hour: "numeric",
      hour12: false,
    }).format(noon),
    10
  );
  const utcOffsetHours = localHourAtNoonUTC - 12;
  return ((sendHour - utcOffsetHours) % 24 + 24) % 24;
}

function calculateNextRunAt(frequency, sendHour, timezone, dayOfWeek, dayOfMonth) {
  const now = new Date();
  const next = new Date(now);

  if (frequency === "daily_activity" || frequency === "daily_marketing") {
    const hour = sendHour ?? 7;
    const utcHour = localHourToUTCHour(hour, timezone, next);
    next.setUTCHours(utcHour, 0, 0, 0);
    if (next <= now) {
      next.setUTCDate(next.getUTCDate() + 1);
      next.setUTCHours(localHourToUTCHour(hour, timezone, next), 0, 0, 0);
    }
    while (next.getUTCDay() === 0 || next.getUTCDay() === 6) {
      next.setUTCDate(next.getUTCDate() + 1);
      next.setUTCHours(localHourToUTCHour(hour, timezone, next), 0, 0, 0);
    }
  } else if (frequency === "daily") {
    next.setUTCHours(localHourToUTCHour(sendHour, timezone, next), 0, 0, 0);
    if (next <= now) {
      next.setUTCDate(next.getUTCDate() + 1);
      next.setUTCHours(localHourToUTCHour(sendHour, timezone, next), 0, 0, 0);
    }
  } else if (frequency === "weekly") {
    const targetDay = dayOfWeek ?? 1;
    next.setUTCHours(localHourToUTCHour(sendHour, timezone, next), 0, 0, 0);
    const currentDay = next.getUTCDay();
    let daysUntil = targetDay - currentDay;
    if (daysUntil <= 0) daysUntil += 7;
    if (daysUntil === 0 && next <= now) daysUntil = 7;
    next.setUTCDate(next.getUTCDate() + daysUntil);
    next.setUTCHours(localHourToUTCHour(sendHour, timezone, next), 0, 0, 0);
  } else if (frequency === "monthly") {
    const targetDate = Math.min(dayOfMonth ?? 1, 28);
    next.setUTCDate(targetDate);
    next.setUTCHours(localHourToUTCHour(sendHour, timezone, next), 0, 0, 0);
    if (next <= now) {
      next.setUTCMonth(next.getUTCMonth() + 1);
      next.setUTCDate(targetDate);
      next.setUTCHours(localHourToUTCHour(sendHour, timezone, next), 0, 0, 0);
    }
  }

  return next;
}

async function main() {
  const conn = await createConnection(process.env.DATABASE_URL);
  const [reports] = await conn.execute(
    "SELECT id, account_id, frequency, send_hour, timezone, day_of_week, day_of_month FROM scheduled_reports WHERE is_active = 1"
  );

  for (const report of reports) {
    const nextRunAt = calculateNextRunAt(
      report.frequency,
      report.send_hour,
      report.timezone,
      report.day_of_week,
      report.day_of_month
    );
    const localTime = new Date(nextRunAt).toLocaleString("en-US", { timeZone: report.timezone });
    console.log(`Report ${report.id} (${report.frequency}): next_run_at = ${nextRunAt.toISOString()} → ${localTime} ${report.timezone}`);
    await conn.execute("UPDATE scheduled_reports SET next_run_at = ? WHERE id = ?", [nextRunAt, report.id]);
  }

  console.log(`Updated ${reports.length} scheduled report(s)`);
  await conn.end();
}

main().catch((e) => console.error(e));
