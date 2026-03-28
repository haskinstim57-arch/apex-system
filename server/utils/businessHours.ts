/**
 * Business Hours Enforcement for AI Calls
 *
 * Supports per-account configuration with fallback to system defaults.
 * Default hours: 7 AM – 10 PM Eastern Time, 7 days a week.
 */

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

export interface BusinessHoursConfig {
  timezone: string;
  startHour: number;  // 0-23
  endHour: number;    // 0-23 (exclusive — calls blocked at this hour and after)
  daysOfWeek: number[]; // 0=Sunday, 1=Monday, ... 6=Saturday
}

// ─────────────────────────────────────────────
// System Defaults
// ─────────────────────────────────────────────

const EASTERN_TZ = "America/New_York";

/** Default business hours — used when account has no custom config */
export const DEFAULT_BUSINESS_HOURS: BusinessHoursConfig = {
  timezone: EASTERN_TZ,
  startHour: 7,   // 7:00 AM ET
  endHour: 22,    // 10:00 PM ET
  daysOfWeek: [0, 1, 2, 3, 4, 5, 6], // All 7 days
};

/** @deprecated Use DEFAULT_BUSINESS_HOURS instead. Kept for backward compatibility. */
export const BUSINESS_HOURS = {
  ...DEFAULT_BUSINESS_HOURS,
  label: "7:00 AM – 10:00 PM Eastern Time, 7 days a week",
} as const;

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

/**
 * Resolve the effective business hours config for an account.
 * If the account has a custom config, use it; otherwise fall back to defaults.
 */
export function resolveBusinessHours(
  accountConfig?: BusinessHoursConfig | null
): BusinessHoursConfig {
  if (!accountConfig) return DEFAULT_BUSINESS_HOURS;

  // Validate and merge with defaults for any missing fields
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

/**
 * Generate a human-readable label for a business hours config.
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
// Time Calculation
// ─────────────────────────────────────────────

/**
 * Get the current time in a specific timezone.
 * Returns { hour, minute, dayOfWeek, formatted }.
 */
export function getTimeInTimezone(
  timezone: string,
  now?: Date
): {
  hour: number;
  minute: number;
  dayOfWeek: number;
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

  const formatted = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    weekday: "long",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(date);

  return { hour, minute, dayOfWeek, formatted };
}

/**
 * @deprecated Use getTimeInTimezone instead. Kept for backward compatibility.
 */
export function getCurrentEasternTime(now?: Date) {
  return getTimeInTimezone(EASTERN_TZ, now);
}

// ─────────────────────────────────────────────
// Core Check
// ─────────────────────────────────────────────

/**
 * Check if the current time is within business hours for a given config.
 * Returns true if calls are allowed, false if outside hours.
 *
 * @param accountConfig - Per-account business hours config (null = use defaults)
 * @param now - Optional date for testing
 */
export function isWithinBusinessHours(
  accountConfig?: BusinessHoursConfig | null,
  now?: Date
): boolean {
  const config = resolveBusinessHours(accountConfig);
  const { hour, dayOfWeek } = getTimeInTimezone(config.timezone, now);

  // Check if the day is allowed
  if (!config.daysOfWeek.includes(dayOfWeek)) {
    return false;
  }

  // Check if the hour is within range: [startHour, endHour)
  return hour >= config.startHour && hour < config.endHour;
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
