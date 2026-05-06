import { describe, it, expect } from "vitest";

/**
 * Tests for the business hours preview logic used in MessagingSettings.tsx.
 * We extract the pure logic here for testability.
 */

const DAYS = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
] as const;

const DAY_SHORT: Record<string, string> = {
  monday: "Mon",
  tuesday: "Tue",
  wednesday: "Wed",
  thursday: "Thu",
  friday: "Fri",
  saturday: "Sat",
  sunday: "Sun",
};

const TIMEZONES = [
  { value: "America/New_York", label: "Eastern Time (ET)" },
  { value: "America/Chicago", label: "Central Time (CT)" },
  { value: "America/Denver", label: "Mountain Time (MT)" },
  { value: "America/Los_Angeles", label: "Pacific Time (PT)" },
  { value: "America/Anchorage", label: "Alaska Time (AKT)" },
  { value: "Pacific/Honolulu", label: "Hawaii Time (HT)" },
  { value: "America/Phoenix", label: "Arizona (no DST)" },
  { value: "UTC", label: "UTC" },
];

interface DaySchedule {
  open: boolean;
  start?: string;
  end?: string;
}

interface BusinessHoursConfig {
  enabled: boolean;
  timezone: string;
  schedule: Record<string, DaySchedule>;
}

function formatTime(t: string): string {
  const [hh, mm] = t.split(":").map(Number);
  const period = hh < 12 ? "AM" : "PM";
  const displayH = hh === 0 ? 12 : hh > 12 ? hh - 12 : hh;
  return `${displayH}:${String(mm).padStart(2, "0")} ${period}`;
}

function getBusinessHoursPreview(config: BusinessHoursConfig): string | null {
  if (!config.enabled) return null;

  const openDays = DAYS.filter((d) => config.schedule[d]?.open);
  if (openDays.length === 0) return null;

  const starts = openDays.map((d) => config.schedule[d]?.start || "09:00");
  const ends = openDays.map((d) => config.schedule[d]?.end || "17:00");
  const earliest = starts.sort()[0];
  const latest = ends.sort().reverse()[0];

  const dayNames = openDays.map((d) => DAY_SHORT[d]);
  const daysSummary =
    dayNames.length === 7
      ? "every day"
      : dayNames.length === 5 &&
          openDays.every((d) =>
            ["monday", "tuesday", "wednesday", "thursday", "friday"].includes(d)
          )
        ? "Mon\u2013Fri"
        : dayNames.join(", ");

  const tzLabel =
    TIMEZONES.find((tz) => tz.value === config.timezone)?.label ||
    config.timezone;

  return `AI calls will be made ${daysSummary}, ${formatTime(earliest)} \u2013 ${formatTime(latest)} in ${tzLabel}.`;
}

describe("Business Hours Preview", () => {
  it("returns null when disabled", () => {
    const config: BusinessHoursConfig = {
      enabled: false,
      timezone: "America/New_York",
      schedule: {
        monday: { open: true, start: "09:00", end: "17:00" },
      },
    };
    expect(getBusinessHoursPreview(config)).toBeNull();
  });

  it("returns null when no days are open", () => {
    const config: BusinessHoursConfig = {
      enabled: true,
      timezone: "America/New_York",
      schedule: {
        monday: { open: false },
        tuesday: { open: false },
        wednesday: { open: false },
        thursday: { open: false },
        friday: { open: false },
        saturday: { open: false },
        sunday: { open: false },
      },
    };
    expect(getBusinessHoursPreview(config)).toBeNull();
  });

  it("shows Mon–Fri for standard weekdays", () => {
    const config: BusinessHoursConfig = {
      enabled: true,
      timezone: "America/Los_Angeles",
      schedule: {
        monday: { open: true, start: "09:00", end: "17:00" },
        tuesday: { open: true, start: "09:00", end: "17:00" },
        wednesday: { open: true, start: "09:00", end: "17:00" },
        thursday: { open: true, start: "09:00", end: "17:00" },
        friday: { open: true, start: "09:00", end: "17:00" },
        saturday: { open: false },
        sunday: { open: false },
      },
    };
    const result = getBusinessHoursPreview(config);
    expect(result).toBe(
      "AI calls will be made Mon\u2013Fri, 9:00 AM \u2013 5:00 PM in Pacific Time (PT)."
    );
  });

  it("shows 'every day' when all 7 days are open", () => {
    const config: BusinessHoursConfig = {
      enabled: true,
      timezone: "America/New_York",
      schedule: {
        monday: { open: true, start: "07:00", end: "22:00" },
        tuesday: { open: true, start: "07:00", end: "22:00" },
        wednesday: { open: true, start: "07:00", end: "22:00" },
        thursday: { open: true, start: "07:00", end: "22:00" },
        friday: { open: true, start: "07:00", end: "22:00" },
        saturday: { open: true, start: "08:00", end: "20:00" },
        sunday: { open: true, start: "09:00", end: "18:00" },
      },
    };
    const result = getBusinessHoursPreview(config);
    expect(result).toBe(
      "AI calls will be made every day, 7:00 AM \u2013 10:00 PM in Eastern Time (ET)."
    );
  });

  it("lists individual days when not standard weekdays", () => {
    const config: BusinessHoursConfig = {
      enabled: true,
      timezone: "America/Chicago",
      schedule: {
        monday: { open: true, start: "08:00", end: "18:00" },
        tuesday: { open: false },
        wednesday: { open: true, start: "08:00", end: "18:00" },
        thursday: { open: false },
        friday: { open: true, start: "08:00", end: "18:00" },
        saturday: { open: false },
        sunday: { open: false },
      },
    };
    const result = getBusinessHoursPreview(config);
    expect(result).toBe(
      "AI calls will be made Mon, Wed, Fri, 8:00 AM \u2013 6:00 PM in Central Time (CT)."
    );
  });

  it("uses earliest start and latest end across different day schedules", () => {
    const config: BusinessHoursConfig = {
      enabled: true,
      timezone: "UTC",
      schedule: {
        monday: { open: true, start: "06:00", end: "14:00" },
        tuesday: { open: true, start: "10:00", end: "22:00" },
        wednesday: { open: false },
        thursday: { open: false },
        friday: { open: false },
        saturday: { open: false },
        sunday: { open: false },
      },
    };
    const result = getBusinessHoursPreview(config);
    expect(result).toBe(
      "AI calls will be made Mon, Tue, 6:00 AM \u2013 10:00 PM in UTC."
    );
  });

  it("formats midnight correctly", () => {
    expect(formatTime("00:00")).toBe("12:00 AM");
    expect(formatTime("00:30")).toBe("12:30 AM");
  });

  it("formats noon correctly", () => {
    expect(formatTime("12:00")).toBe("12:00 PM");
    expect(formatTime("12:30")).toBe("12:30 PM");
  });

  it("formats PM times correctly", () => {
    expect(formatTime("13:00")).toBe("1:00 PM");
    expect(formatTime("22:00")).toBe("10:00 PM");
    expect(formatTime("23:30")).toBe("11:30 PM");
  });

  it("falls back to timezone value when not in TIMEZONES list", () => {
    const config: BusinessHoursConfig = {
      enabled: true,
      timezone: "Asia/Kolkata",
      schedule: {
        monday: { open: true, start: "09:00", end: "17:00" },
        tuesday: { open: false },
        wednesday: { open: false },
        thursday: { open: false },
        friday: { open: false },
        saturday: { open: false },
        sunday: { open: false },
      },
    };
    const result = getBusinessHoursPreview(config);
    expect(result).toContain("Asia/Kolkata");
  });
});
