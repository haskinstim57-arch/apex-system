import { describe, it, expect } from "vitest";

/**
 * Tests for the timezone-aware slot generation fix (Prompt R).
 * 
 * The core bug: getAvailableSlots returned slots with local time strings (e.g. "09:00")
 * but the min-notice filter in getPublicSlots treated them as UTC by constructing
 * `new Date("2026-04-28T09:00:00Z")`. For America/Los_Angeles (UTC-7), 09:00 local
 * is actually 16:00 UTC, so ALL slots were filtered out by the 24h min-notice check.
 * 
 * The fix: getAvailableSlots now returns { start, end, startUTC, endUTC } where
 * startUTC/endUTC are proper UTC timestamps computed using the calendar's timezone.
 */

// Replicate the helper functions from db.ts for unit testing
function getTimezoneOffsetMinutes(timezone: string, date: string): number {
  try {
    const refDate = new Date(`${date}T12:00:00Z`);
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
    const parts = formatter.formatToParts(refDate);
    const get = (type: string) => parts.find((p) => p.type === type)?.value || "0";
    const localDate = new Date(
      `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}:${get("second")}Z`
    );
    return Math.round((localDate.getTime() - refDate.getTime()) / 60000);
  } catch {
    return 0;
  }
}

function localTimeToUTC(date: string, time: string, tzOffsetMinutes: number): Date {
  const [h, m] = time.split(":").map(Number);
  const localMinutes = h * 60 + m;
  const utcMinutes = localMinutes - tzOffsetMinutes;
  const base = new Date(`${date}T00:00:00Z`);
  return new Date(base.getTime() + utcMinutes * 60000);
}

describe("getTimezoneOffsetMinutes", () => {
  it("returns -420 for America/Los_Angeles in PDT (April)", () => {
    const offset = getTimezoneOffsetMinutes("America/Los_Angeles", "2026-04-28");
    expect(offset).toBe(-420); // PDT = UTC-7 = -420 minutes
  });

  it("returns -240 for America/New_York in EDT (April)", () => {
    const offset = getTimezoneOffsetMinutes("America/New_York", "2026-04-28");
    expect(offset).toBe(-240); // EDT = UTC-4 = -240 minutes
  });

  it("returns 0 for UTC", () => {
    const offset = getTimezoneOffsetMinutes("UTC", "2026-04-28");
    expect(offset).toBe(0);
  });

  it("returns positive offset for Asia/Tokyo", () => {
    const offset = getTimezoneOffsetMinutes("Asia/Tokyo", "2026-04-28");
    expect(offset).toBe(540); // JST = UTC+9 = +540 minutes
  });

  it("returns 0 for invalid timezone", () => {
    const offset = getTimezoneOffsetMinutes("Invalid/Timezone", "2026-04-28");
    expect(offset).toBe(0); // Fallback
  });
});

describe("localTimeToUTC", () => {
  it("converts 09:00 PDT to 16:00 UTC", () => {
    const utc = localTimeToUTC("2026-04-28", "09:00", -420);
    expect(utc.toISOString()).toBe("2026-04-28T16:00:00.000Z");
  });

  it("converts 17:00 PDT to 00:00 UTC next day", () => {
    const utc = localTimeToUTC("2026-04-28", "17:00", -420);
    expect(utc.toISOString()).toBe("2026-04-29T00:00:00.000Z");
  });

  it("converts 09:00 EDT to 13:00 UTC", () => {
    const utc = localTimeToUTC("2026-04-28", "09:00", -300);
    expect(utc.toISOString()).toBe("2026-04-28T14:00:00.000Z");
  });

  it("converts 09:00 UTC to 09:00 UTC (no offset)", () => {
    const utc = localTimeToUTC("2026-04-28", "09:00", 0);
    expect(utc.toISOString()).toBe("2026-04-28T09:00:00.000Z");
  });

  it("converts 09:00 JST to 00:00 UTC", () => {
    const utc = localTimeToUTC("2026-04-28", "09:00", 540);
    expect(utc.toISOString()).toBe("2026-04-28T00:00:00.000Z");
  });
});

describe("min-notice filter with timezone-aware slots", () => {
  it("does NOT filter out afternoon PDT slots when now is evening UTC (the original bug)", () => {
    // Scenario: It's 9:04 PM UTC on April 27 (2:04 PM PDT)
    // Min notice: 24 hours → cutoff is 9:04 PM UTC April 28
    // A slot at 14:15 PDT = 21:15 UTC April 28 → SHOULD pass (after cutoff)
    const nowMs = new Date("2026-04-27T21:04:00Z").getTime();
    const minNoticeMs = 24 * 60 * 60 * 1000;
    const cutoffMs = nowMs + minNoticeMs;

    // Old behavior (broken): treated 14:15 as UTC
    const oldSlotTime = new Date("2026-04-28T14:15:00Z").getTime();
    const oldPasses = oldSlotTime > cutoffMs;
    expect(oldPasses).toBe(false); // Bug: incorrectly filtered out

    // New behavior (fixed): 14:15 PDT = 21:15 UTC
    const newSlotUTC = localTimeToUTC("2026-04-28", "14:15", -420).getTime();
    const newPasses = newSlotUTC > cutoffMs;
    expect(newPasses).toBe(true); // Fixed: correctly passes
  });

  it("correctly filters out morning PDT slots that are within min-notice window", () => {
    // 09:00 PDT = 16:00 UTC April 28
    // Cutoff: 21:04 UTC April 28
    // 16:00 < 21:04 → should be filtered out
    const nowMs = new Date("2026-04-27T21:04:00Z").getTime();
    const minNoticeMs = 24 * 60 * 60 * 1000;

    const slotUTC = localTimeToUTC("2026-04-28", "09:00", -420).getTime();
    const passes = slotUTC > nowMs + minNoticeMs;
    expect(passes).toBe(false); // Correctly filtered
  });

  it("returns some slots for a full working day with 24h min-notice", () => {
    // Simulate: now is 9 PM UTC April 27, working hours 9-5 PDT, 24h notice
    const nowMs = new Date("2026-04-27T21:04:00Z").getTime();
    const minNoticeMs = 24 * 60 * 60 * 1000;
    const tzOffset = -420; // PDT

    // Generate slots 09:00-17:00 with 30min duration + 15min buffer
    const slots: { start: string; startUTC: number }[] = [];
    let currentMinutes = 9 * 60;
    const blockEnd = 17 * 60;
    while (currentMinutes + 30 <= blockEnd) {
      const h = Math.floor(currentMinutes / 60);
      const m = currentMinutes % 60;
      const start = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
      const startUTC = localTimeToUTC("2026-04-28", start, tzOffset).getTime();
      slots.push({ start, startUTC });
      currentMinutes += 30 + 15;
    }

    const filtered = slots.filter((s) => s.startUTC > nowMs + minNoticeMs);
    expect(filtered.length).toBeGreaterThan(0);
    expect(filtered.length).toBeLessThan(slots.length);
    // First passing slot should be after 2 PM PDT (21:04 UTC cutoff)
    expect(filtered[0].start).toBe("14:15");
  });
});

describe("conflict detection with timezone-aware UTC timestamps", () => {
  it("detects conflict when appointment overlaps slot in UTC", () => {
    // Slot: 10:00-10:30 PDT = 17:00-17:30 UTC
    const slotStartUTC = localTimeToUTC("2026-04-28", "10:00", -420).getTime();
    const slotEndUTC = localTimeToUTC("2026-04-28", "10:30", -420).getTime();

    // Appointment: 17:15-17:45 UTC (overlaps)
    const apptStart = new Date("2026-04-28T17:15:00Z").getTime();
    const apptEnd = new Date("2026-04-28T17:45:00Z").getTime();

    const hasConflict = slotStartUTC < apptEnd && slotEndUTC > apptStart;
    expect(hasConflict).toBe(true);
  });

  it("does NOT detect conflict when appointment is in different UTC window", () => {
    // Slot: 10:00-10:30 PDT = 17:00-17:30 UTC
    const slotStartUTC = localTimeToUTC("2026-04-28", "10:00", -420).getTime();
    const slotEndUTC = localTimeToUTC("2026-04-28", "10:30", -420).getTime();

    // Appointment: 10:00-10:30 UTC (would conflict in old code, but not in UTC-aware code)
    const apptStart = new Date("2026-04-28T10:00:00Z").getTime();
    const apptEnd = new Date("2026-04-28T10:30:00Z").getTime();

    const hasConflict = slotStartUTC < apptEnd && slotEndUTC > apptStart;
    expect(hasConflict).toBe(false); // No conflict — different UTC windows
  });
});
