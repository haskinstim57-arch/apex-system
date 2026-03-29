/**
 * Business Hours Enforcement for AI Calls & Messaging
 *
 * Supports per-account configuration with per-day schedules.
 * Reads from accountMessagingSettings.businessHours JSON column.
 * Falls back to system defaults (7 AM – 10 PM ET, Mon-Fri; 8 AM – 8 PM Sat; closed Sun).
 */

import type { BusinessHoursSchedule } from "../../drizzle/schema";

// ─────────────────────────────────────────────
// Types (legacy — kept for backward compatibility)
// ─────────────────────────────────────────────

export interface BusinessHoursConfig {
  timezone: string;
  startHour: number;  // 0-23
  endHour: number;    // 0-23 (exclusive — calls blocked at this hour and after)
  daysOfWeek: number[]; // 0=Sunday, 1=Monday, ... 6=Saturday
}

export type { BusinessHoursSchedule };

// ─────────────────────────────────────────────
// Day Names
// ─────────────────────────────────────────────

const DAY_NAMES = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"] as const;

// ─────────────────────────────────────────────
// System Defaults
// ─────────────────────────────────────────────

const EASTERN_TZ = "America/New_York";

/** Default business hours schedule — used when account has no custom config */
export const DEFAULT_BUSINESS_HOURS_SCHEDULE: BusinessHoursSchedule = {
  enabled: true,
  timezone: EASTERN_TZ,
  schedule: {
    monday:    { open: true, start: "07:00", end: "22:00" },
    tuesday:   { open: true, start: "07:00", end: "22:00" },
    wednesday: { open: true, start: "07:00", end: "22:00" },
    thursday:  { open: true, start: "07:00", end: "22:00" },
    friday:    { open: true, start: "07:00", end: "22:00" },
    saturday:  { open: true, start: "08:00", end: "20:00" },
    sunday:    { open: false, start: "09:00", end: "17:00" },
  },
};

/** Default business hours — legacy flat format. Kept for backward compatibility. */
export const DEFAULT_BUSINESS_HOURS: BusinessHoursConfig = {
  timezone: EASTERN_TZ,
  startHour: 7,   // 7:00 AM ET
  endHour: 22,    // 10:00 PM ET
  daysOfWeek: [0, 1, 2, 3, 4, 5, 6], // All 7 days
};

/** @deprecated Use DEFAULT_BUSINESS_HOURS_SCHEDULE instead. Kept for backward compatibility. */
export const BUSINESS_HOURS = {
  ...DEFAULT_BUSINESS_HOURS,
  label: "7:00 AM – 10:00 PM Eastern Time, 7 days a week",
} as const;

// ─────────────────────────────────────────────
// Helpers — Resolve Config
// ─────────────────────────────────────────────

/**
 * Parse a business hours JSON string from the database into a BusinessHoursSchedule.
 * Returns null if the string is empty or invalid.
 */
export function parseBusinessHoursJson(json: string | null | undefined): BusinessHoursSchedule | null {
  if (!json) return null;
  try {
    const parsed = JSON.parse(json);
    if (typeof parsed !== "object" || parsed === null) return null;
    if (typeof parsed.enabled !== "boolean") return null;
    if (typeof parsed.timezone !== "string") return null;
    if (typeof parsed.schedule !== "object" || parsed.schedule === null) return null;
    return parsed as BusinessHoursSchedule;
  } catch {
    return null;
  }
}

/**
 * Resolve the effective business hours schedule for an account.
 * Accepts either the new per-day schedule or the legacy flat config.
 */
export function resolveBusinessHoursSchedule(
  scheduleConfig?: BusinessHoursSchedule | null
): BusinessHoursSchedule {
  if (!scheduleConfig) return DEFAULT_BUSINESS_HOURS_SCHEDULE;

  // Validate and merge with defaults for any missing days
  const resolvedSchedule: BusinessHoursSchedule["schedule"] = {};
  for (const day of DAY_NAMES) {
    const dayConfig = scheduleConfig.schedule?.[day];
    if (dayConfig && typeof dayConfig.open === "boolean") {
      resolvedSchedule[day] = {
        open: dayConfig.open,
        start: dayConfig.start || "07:00",
        end: dayConfig.end || "22:00",
      };
    } else {
      resolvedSchedule[day] = DEFAULT_BUSINESS_HOURS_SCHEDULE.schedule[day];
    }
  }

  return {
    enabled: scheduleConfig.enabled,
    timezone: scheduleConfig.timezone || EASTERN_TZ,
    schedule: resolvedSchedule,
  };
}

/**
 * Resolve the effective business hours config for an account (legacy flat format).
 * If the account has a custom config, use it; otherwise fall back to defaults.
 * @deprecated Use resolveBusinessHoursSchedule for new code.
 */
export function resolveBusinessHours(
  accountConfig?: BusinessHoursConfig | null
): BusinessHoursConfig {
  if (!accountConfig) return DEFAULT_BUSINESS_HOURS;

  return {
    timezone: accountConfig.timezone || DEFAULT_BUSINESS_HOURS.timezone,
    startHour:
      typeof accountConfig.startHour === "number"
        ? accountConfig.startHour
        : DEFAULT_BUSINESS_HOURS.startHour,
    endHour:
      typeof accountConfig.endHour === "number"
        ? accountConfig.endHour
        : DEFAULT_BUSINESS_HOURS.endHour,
    daysOfWeek:
      Array.isArray(accountConfig.daysOfWeek) && accountConfig.daysOfWeek.length > 0
        ? accountConfig.daysOfWeek
        : DEFAULT_BUSINESS_HOURS.daysOfWeek,
  };
}

// ─────────────────────────────────────────────
// Time Calculation
// ─────────────────────────────────────────────

/**
 * Get the current time in a specific timezone.
 * Returns { hour, minute, dayOfWeek, dayName, formatted }.
 */
export function getTimeInTimezone(
  timezone: string,
  now?: Date
): {
  hour: number;
  minute: number;
  dayOfWeek: number;
  dayName: string;
  formatted: string;
} {
  const date = now ?? new Date();

  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    hour: "numeric",
    minute: "numeric",
    weekday: "short",
    hour12: false,
  }).formatToParts(date);

  const hour = parseInt(parts.find((p) => p.type === "hour")?.value ?? "0", 10);
  const minute = parseInt(parts.find((p) => p.type === "minute")?.value ?? "0", 10);

  const dayStr = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    weekday: "long",
  }).format(date);

  const dayMap: Record<string, number> = {
    Sunday: 0, Monday: 1, Tuesday: 2, Wednesday: 3,
    Thursday: 4, Friday: 5, Saturday: 6,
  };
  const dayOfWeek = dayMap[dayStr] ?? 0;
  const dayName = DAY_NAMES[dayOfWeek];

  const formatted = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    weekday: "long",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(date);

  return { hour, minute, dayOfWeek, dayName, formatted };
}

/**
 * @deprecated Use getTimeInTimezone instead. Kept for backward compatibility.
 */
export function getCurrentEasternTime(now?: Date) {
  return getTimeInTimezone(EASTERN_TZ, now);
}

// ─────────────────────────────────────────────
// Parse Time String
// ─────────────────────────────────────────────

/**
 * Parse a "HH:MM" time string into { hour, minute }.
 */
export function parseTimeString(time: string): { hour: number; minute: number } {
  const [h, m] = time.split(":").map(Number);
  return { hour: h || 0, minute: m || 0 };
}

// ─────────────────────────────────────────────
// Core Check — New Per-Day Schedule Format
// ─────────────────────────────────────────────

/**
 * Check if the current time is within business hours using the per-day schedule format.
 * Returns true if messages/calls are allowed, false if outside hours.
 *
 * @param scheduleConfig - Per-account business hours schedule (null = use defaults)
 * @param now - Optional date for testing
 */
export function isWithinBusinessHoursSchedule(
  scheduleConfig?: BusinessHoursSchedule | null,
  now?: Date
): boolean {
  const config = resolveBusinessHoursSchedule(scheduleConfig);

  // If business hours are disabled, always allow
  if (!config.enabled) return true;

  const { hour, minute, dayName } = getTimeInTimezone(config.timezone, now);
  const dayConfig = config.schedule[dayName];

  // If no config for this day or day is closed, block
  if (!dayConfig || !dayConfig.open) return false;

  // Parse start/end times
  const start = parseTimeString(dayConfig.start || "00:00");
  const end = parseTimeString(dayConfig.end || "23:59");

  // Convert to minutes for comparison
  const currentMinutes = hour * 60 + minute;
  const startMinutes = start.hour * 60 + start.minute;
  const endMinutes = end.hour * 60 + end.minute;

  return currentMinutes >= startMinutes && currentMinutes < endMinutes;
}

/**
 * Check if the current time is within business hours.
 * Supports both the new per-day schedule format AND the legacy flat format.
 *
 * For new code: pass a BusinessHoursSchedule from accountMessagingSettings.businessHours
 * For legacy code: pass a BusinessHoursConfig from account.businessHoursConfig
 *
 * @param accountConfig - Per-account business hours config (null = use defaults)
 * @param now - Optional date for testing
 */
export function isWithinBusinessHours(
  accountConfig?: BusinessHoursConfig | BusinessHoursSchedule | null,
  now?: Date
): boolean {
  // Detect if this is the new schedule format (has 'enabled' and 'schedule' fields)
  if (accountConfig && "enabled" in accountConfig && "schedule" in accountConfig) {
    return isWithinBusinessHoursSchedule(accountConfig as BusinessHoursSchedule, now);
  }

  // Legacy flat format
  const config = resolveBusinessHours(accountConfig as BusinessHoursConfig | null);
  const { hour, dayOfWeek } = getTimeInTimezone(config.timezone, now);

  if (!config.daysOfWeek.includes(dayOfWeek)) return false;
  return hour >= config.startHour && hour < config.endHour;
}

// ─────────────────────────────────────────────
// Fetch from DB
// ─────────────────────────────────────────────

/**
 * Fetch the business hours schedule for an account from the database.
 * Returns the parsed BusinessHoursSchedule or null if not configured.
 */
export async function getAccountBusinessHours(accountId: number): Promise<BusinessHoursSchedule | null> {
  const { getAccountMessagingSettings } = await import("../db");
  const settings = await getAccountMessagingSettings(accountId);
  if (!settings?.businessHours) return null;
  return parseBusinessHoursJson(settings.businessHours);
}

/**
 * Check if the current time is within business hours for a specific account.
 * Fetches the config from the DB, falls back to defaults.
 *
 * @param accountId - The account ID to check
 * @param now - Optional date for testing
 */
export async function isWithinAccountBusinessHours(
  accountId: number,
  now?: Date
): Promise<boolean> {
  const schedule = await getAccountBusinessHours(accountId);
  return isWithinBusinessHoursSchedule(schedule, now);
}

// ─────────────────────────────────────────────
// Labels
// ─────────────────────────────────────────────

/**
 * Generate a human-readable label for a business hours config (legacy format).
 */
export function getBusinessHoursLabel(config: BusinessHoursConfig): string {
  const startFormatted = formatHour(config.startHour);
  const endFormatted = formatHour(config.endHour);

  const tzLabel = getTimezoneAbbreviation(config.timezone);

  const dayCount = config.daysOfWeek.length;
  let dayLabel: string;
  if (dayCount === 7) {
    dayLabel = "7 days a week";
  } else if (dayCount === 5 && !config.daysOfWeek.includes(0) && !config.daysOfWeek.includes(6)) {
    dayLabel = "weekdays only";
  } else {
    const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    dayLabel = config.daysOfWeek.map((d) => dayNames[d]).join(", ");
  }

  return `${startFormatted} – ${endFormatted} ${tzLabel}, ${dayLabel}`;
}

/**
 * Generate a human-readable label for a business hours schedule (new format).
 */
export function getBusinessHoursScheduleLabel(config: BusinessHoursSchedule): string {
  if (!config.enabled) return "No time restrictions (send any time)";

  const tzLabel = getTimezoneAbbreviation(config.timezone);
  const openDays = DAY_NAMES.filter((d) => config.schedule[d]?.open);

  if (openDays.length === 0) return `All days closed (${tzLabel})`;

  // Check if all open days share the same hours
  const hours = openDays.map((d) => `${config.schedule[d]?.start}-${config.schedule[d]?.end}`);
  const uniqueHours = Array.from(new Set(hours));

  if (uniqueHours.length === 1 && openDays.length === 7) {
    const day = config.schedule[openDays[0]];
    return `${day?.start} – ${day?.end} ${tzLabel}, 7 days a week`;
  }

  return `Custom schedule (${openDays.length} days, ${tzLabel})`;
}

function formatHour(hour: number): string {
  if (hour === 0) return "12:00 AM";
  if (hour === 12) return "12:00 PM";
  if (hour < 12) return `${hour}:00 AM`;
  return `${hour - 12}:00 PM`;
}

function getTimezoneAbbreviation(tz: string): string {
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      timeZoneName: "short",
    }).formatToParts(new Date());
    return parts.find((p) => p.type === "timeZoneName")?.value ?? tz;
  } catch {
    return tz;
  }
}

// ─────────────────────────────────────────────
// Block Message
// ─────────────────────────────────────────────

/**
 * Get a human-readable message about why a call was blocked.
 */
export function getBusinessHoursBlockMessage(
  accountConfig?: BusinessHoursConfig | null,
  now?: Date
): string {
  const config = resolveBusinessHours(accountConfig);
  const { formatted } = getTimeInTimezone(config.timezone, now);
  const label = getBusinessHoursLabel(config);
  return `AI calls are only allowed during business hours: ${label}. Current time is ${formatted}. Please try again during business hours.`;
}

// ─────────────────────────────────────────────
// Enforcement
// ─────────────────────────────────────────────

/**
 * Enforce business hours — throws an error if outside hours.
 * Use this as a guard at the top of any call initiation function.
 *
 * @param accountConfig - Per-account business hours config (null = use defaults)
 * @param now - Optional date for testing
 */
export function enforceBusinessHours(
  accountConfig?: BusinessHoursConfig | null,
  now?: Date
): void {
  if (!isWithinBusinessHours(accountConfig, now)) {
    throw new BusinessHoursError(getBusinessHoursBlockMessage(accountConfig, now));
  }
}

/**
 * Custom error class for business hours violations.
 */
export class BusinessHoursError extends Error {
  public readonly isBusinessHoursError = true;

  constructor(message: string) {
    super(message);
    this.name = "BusinessHoursError";
  }
}
