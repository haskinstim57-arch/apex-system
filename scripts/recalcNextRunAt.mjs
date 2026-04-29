import { createConnection } from "mysql2/promise";

/**
 * Recalculate nextRunAt for all active scheduled reports using the
 * robust iterative timezone conversion (matches the server code).
 */

function localHourToUTC(sendHour, timezone, baseDate) {
  const dateFormatter = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour12: false,
  });
  const dateParts = dateFormatter.formatToParts(baseDate);
  const getDate = (type) => parseInt(dateParts.find((p) => p.type === type)?.value || "0");
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
    const getP = (type) => parseInt(localParts.find((p) => p.type === type)?.value || "0");
    let localHour = getP("hour");
    if (localHour === 24) localHour = 0;
    const localDayCheck = getP("day");

    if (localHour === sendHour && localDayCheck === localDay) break;

    let adjustHours = sendHour - localHour;
    if (adjustHours > 12) adjustHours -= 24;
    if (adjustHours < -12) adjustHours += 24;

    if (localDayCheck !== localDay) {
      const dayDiff = localDay - localDayCheck;
      adjustHours += dayDiff * 24;
    }

    guess = new Date(guess.getTime() + adjustHours * 3600000);
  }

  return guess;
}

function getDayOfWeekInTimezone(date, timezone) {
  const formatter = new Intl.DateTimeFormat("en-US", { timeZone: timezone, weekday: "short" });
  const dayStr = formatter.format(date);
  const dayMap = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  return dayMap[dayStr] ?? date.getUTCDay();
}

function calculateNextRunAt(frequency, sendHour, timezone, dayOfWeek, dayOfMonth) {
  const now = new Date();
  if (frequency === "daily_activity" || frequency === "daily_marketing") {
    const hour = sendHour ?? 7;
    let next = localHourToUTC(hour, timezone, now);
    if (next <= now) {
      const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
      next = localHourToUTC(hour, timezone, tomorrow);
    }
    let localDay = getDayOfWeekInTimezone(next, timezone);
    while (localDay === 0 || localDay === 6) {
      next = new Date(next.getTime() + 24 * 60 * 60 * 1000);
      next = localHourToUTC(hour, timezone, next);
      localDay = getDayOfWeekInTimezone(next, timezone);
    }
    return next;
  } else if (frequency === "daily") {
    let next = localHourToUTC(sendHour, timezone, now);
    if (next <= now) {
      const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
      next = localHourToUTC(sendHour, timezone, tomorrow);
    }
    return next;
  } else if (frequency === "weekly") {
    const targetDay = dayOfWeek ?? 1;
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
    const targetDate = Math.min(dayOfMonth ?? 1, 28);
    const formatter = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit", hour12: false,
    });
    const parts = formatter.formatToParts(now);
    const get = (type) => parseInt(parts.find((p) => p.type === type)?.value || "0");
    let localYear = get("year");
    let localMonth = get("month") - 1;
    let candidate = new Date(Date.UTC(localYear, localMonth, targetDate, sendHour, 0, 0));
    let next = localHourToUTC(sendHour, timezone, candidate);
    if (next <= now) {
      localMonth++;
      if (localMonth > 11) { localMonth = 0; localYear++; }
      candidate = new Date(Date.UTC(localYear, localMonth, targetDate, sendHour, 0, 0));
      next = localHourToUTC(sendHour, timezone, candidate);
    }
    return next;
  }
  return new Date(now.getTime() + 24 * 60 * 60 * 1000);
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
