// Verify the timezone fix by simulating what getAvailableSlots now does

const timezone = "America/Los_Angeles";
const date = "2026-04-28"; // Tuesday

// Simulate getTimezoneOffsetMinutes
function getTimezoneOffsetMinutes(tz, dateStr) {
  try {
    const refDate = new Date(`${dateStr}T12:00:00Z`);
    const formatter = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    });
    const parts = formatter.formatToParts(refDate);
    const get = (type) => parts.find((p) => p.type === type)?.value || "0";
    const localDate = new Date(
      `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}:${get("second")}Z`
    );
    return Math.round((localDate.getTime() - refDate.getTime()) / 60000);
  } catch {
    return 0;
  }
}

function localTimeToUTC(dateStr, time, tzOffsetMinutes) {
  const [h, m] = time.split(":").map(Number);
  const localMinutes = h * 60 + m;
  const utcMinutes = localMinutes - tzOffsetMinutes;
  const base = new Date(`${dateStr}T00:00:00Z`);
  return new Date(base.getTime() + utcMinutes * 60000);
}

const tzOffset = getTimezoneOffsetMinutes(timezone, date);
console.log(`Timezone: ${timezone}`);
console.log(`Date: ${date}`);
console.log(`TZ offset: ${tzOffset} minutes (${tzOffset / 60} hours)`);

// Simulate slot generation
const daySlots = [{ start: "09:00", end: "17:00" }];
const slotDuration = 30;
const bufferMinutes = 15;
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

    const slotStartUTC = localTimeToUTC(date, slotStart, tzOffset);
    const slotEndUTC = localTimeToUTC(date, slotEnd, tzOffset);

    slots.push({
      start: slotStart,
      end: slotEnd,
      startUTC: slotStartUTC.getTime(),
      endUTC: slotEndUTC.getTime(),
    });

    currentMinutes += slotDuration + bufferMinutes;
  }
}

console.log(`\nGenerated ${slots.length} slots:`);
for (const s of slots) {
  console.log(`  ${s.start}-${s.end} (local) → UTC: ${new Date(s.startUTC).toISOString()} - ${new Date(s.endUTC).toISOString()}`);
}

// Simulate min-notice filter (24 hours)
const now = new Date();
const minNoticeHours = 24;
const minNoticeMs = minNoticeHours * 60 * 60 * 1000;
const cutoff = new Date(now.getTime() + minNoticeMs);

console.log(`\nNow: ${now.toISOString()}`);
console.log(`Min-notice cutoff (24h): ${cutoff.toISOString()}`);

const filtered = slots.filter((s) => s.startUTC > now.getTime() + minNoticeMs);
console.log(`\nSlots after min-notice filter: ${filtered.length}`);
for (const s of filtered) {
  console.log(`  ${s.start}-${s.end} (local) → UTC: ${new Date(s.startUTC).toISOString()}`);
}
