import 'dotenv/config';
import mysql from 'mysql2/promise';

const conn = await mysql.createConnection(process.env.DATABASE_URL);

const calendarId = 30001;
const date = "2026-04-28"; // Tuesday

// 1. Get calendar
const [calRows] = await conn.execute(`SELECT * FROM calendars WHERE id = ?`, [calendarId]);
const calendar = calRows[0];
console.log(`Calendar: ${calendar.name}, timezone: ${calendar.timezone}`);
console.log(`slotDuration: ${calendar.slotDurationMinutes}, buffer: ${calendar.bufferMinutes}`);
console.log(`minNoticeHours: ${calendar.minNoticeHours}, maxDaysAhead: ${calendar.maxDaysAhead}`);

// 2. Parse availability
const availability = JSON.parse(calendar.availabilityJson);
const dateObj = new Date(date + "T12:00:00Z");
const dayNames = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
const dayName = dayNames[dateObj.getUTCDay()];
console.log(`\nDate: ${date}, Day: ${dayName} (getUTCDay=${dateObj.getUTCDay()})`);
const daySlots = availability[dayName];
console.log(`Day slots:`, JSON.stringify(daySlots));
console.log(`isArray: ${Array.isArray(daySlots)}, length: ${daySlots?.length}`);

// 3. Generate raw slots
const slotDuration = calendar.slotDurationMinutes;
const bufferMinutes = calendar.bufferMinutes;
const slots = [];
for (const block of daySlots) {
  const [startH, startM] = block.start.split(":").map(Number);
  const [endH, endM] = block.end.split(":").map(Number);
  let currentMinutes = startH * 60 + startM;
  const blockEnd = endH * 60 + endM;
  while (currentMinutes + slotDuration <= blockEnd) {
    const slotStartH = Math.floor(currentMinutes / 60);
    const slotStartM = currentMinutes % 60;
    const slotEndMinutes = currentMinutes + slotDuration;
    const slotEndH = Math.floor(slotEndMinutes / 60);
    const slotEndM = slotEndMinutes % 60;
    const slotStart = `${String(slotStartH).padStart(2, "0")}:${String(slotStartM).padStart(2, "0")}`;
    const slotEnd = `${String(slotEndH).padStart(2, "0")}:${String(slotEndM).padStart(2, "0")}`;
    slots.push({ start: slotStart, end: slotEnd });
    currentMinutes += slotDuration + bufferMinutes;
  }
}
console.log(`\nRaw slots generated: ${slots.length}`);
console.log(slots.map(s => `${s.start}-${s.end}`).join(', '));

// 4. Check min-notice filtering
const now = new Date();
const minNoticeMs = calendar.minNoticeHours * 60 * 60 * 1000;
console.log(`\nNow: ${now.toISOString()}`);
console.log(`minNoticeHours: ${calendar.minNoticeHours}`);
console.log(`Min notice cutoff: ${new Date(now.getTime() + minNoticeMs).toISOString()}`);

const filteredSlots = slots.filter((slot) => {
  const slotTime = new Date(`${date}T${slot.start}:00Z`);
  const passes = slotTime.getTime() > now.getTime() + minNoticeMs;
  if (!passes) {
    console.log(`  FILTERED OUT: ${slot.start} (slot UTC: ${slotTime.toISOString()}, cutoff: ${new Date(now.getTime() + minNoticeMs).toISOString()})`);
  }
  return passes;
});
console.log(`\nSlots after min-notice filter: ${filteredSlots.length}`);
console.log(filteredSlots.map(s => `${s.start}-${s.end}`).join(', '));

// 5. Check timezone issue
console.log(`\n=== TIMEZONE ANALYSIS ===`);
console.log(`Calendar timezone: ${calendar.timezone}`);
console.log(`Working hours 09:00-17:00 are in ${calendar.timezone}`);
console.log(`But slot times are being treated as UTC in the code`);
console.log(`If timezone is America/Los_Angeles (UTC-7), then:`);
console.log(`  09:00 PDT = 16:00 UTC`);
console.log(`  17:00 PDT = 00:00 UTC (next day)`);
console.log(`The code creates slots as UTC times, but the working hours are local times.`);
console.log(`This means the min-notice filter compares UTC now against "local time treated as UTC".`);

// 6. Check maxDaysAhead
const requestedDate = new Date(date + "T00:00:00Z");
const maxDate = new Date(now.getTime() + calendar.maxDaysAhead * 24 * 60 * 60 * 1000);
console.log(`\n=== MAX DAYS AHEAD CHECK ===`);
console.log(`Requested date: ${requestedDate.toISOString()}`);
console.log(`Max allowed date: ${maxDate.toISOString()}`);
console.log(`Within range: ${requestedDate.getTime() <= maxDate.getTime()}`);

// 7. Check existing appointments
const [appts] = await conn.execute(
  `SELECT id, startTime, endTime, status FROM appointments WHERE calendarId = ? AND DATE(startTime) = ?`,
  [calendarId, date]
);
console.log(`\nExisting appointments on ${date}: ${appts.length}`);
for (const a of appts) {
  console.log(`  Appt ${a.id}: ${a.startTime} - ${a.endTime} (${a.status})`);
}

await conn.end();
