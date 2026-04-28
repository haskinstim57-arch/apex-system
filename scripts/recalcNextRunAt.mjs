import { createConnection } from "mysql2/promise";

// Inline the timezone logic since we can't easily import TS in .mjs
function getTimezoneOffsetForDate(timezone, date) {
  try {
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
    const get = (type) => parseInt(parts.find((p) => p.type === type)?.value || "0");
    const localYear = get("year");
    const localMonth = get("month") - 1;
    const localDay = get("day");
    let localHour = get("hour");
    if (localHour === 24) localHour = 0;
    const localMinute = get("minute");
    const localSecond = get("second");
    const localAsUTC = Date.UTC(localYear, localMonth, localDay, localHour, localMinute, localSecond);
    return (localAsUTC - date.getTime()) / 60000;
  } catch {
    return 0;
  }
}

function localHourToUTC(sendHour, timezone, baseDate) {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour12: false,
  });
  const parts = formatter.formatToParts(baseDate);
  const get = (type) => parseInt(parts.find((p) => p.type === type)?.value || "0");
  const localYear = get("year");
  const localMonth = get("month") - 1;
  const localDay = get("day");
  const approxUTC = new Date(Date.UTC(localYear, localMonth, localDay, sendHour, 0, 0));
  const offset = getTimezoneOffsetForDate(timezone, approxUTC);
  return new Date(Date.UTC(localYear, localMonth, localDay, sendHour, 0, 0) - offset * 60000);
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
