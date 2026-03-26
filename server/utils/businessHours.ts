/**
 * Business Hours Enforcement for AI Calls
 *
 * Hours: 7 AM – 10 PM Eastern Time, 7 days a week (including weekends).
 * All AI outbound calls must be blocked outside these hours.
 */

// Eastern Time zone identifier
const EASTERN_TZ = "America/New_York";

/** Business hours configuration */
export const BUSINESS_HOURS = {
  timezone: EASTERN_TZ,
  startHour: 7,   // 7:00 AM ET
  endHour: 22,    // 10:00 PM ET (calls blocked at 22:00 and after)
  daysOfWeek: [0, 1, 2, 3, 4, 5, 6] as readonly number[], // All 7 days (0=Sunday)
  label: "7:00 AM – 10:00 PM Eastern Time, 7 days a week",
} as const;

/**
 * Get the current hour in Eastern Time.
 * Returns { hour, minute, dayOfWeek } in ET.
 */
export function getCurrentEasternTime(now?: Date): {
  hour: number;
  minute: number;
  dayOfWeek: number;
  formatted: string;
} {
  const date = now ?? new Date();

  // Use Intl to get the correct ET hour (handles DST automatically)
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: EASTERN_TZ,
    hour: "numeric",
    minute: "numeric",
    weekday: "short",
    hour12: false,
  }).formatToParts(date);

  const hour = parseInt(parts.find((p) => p.type === "hour")?.value ?? "0", 10);
  const minute = parseInt(parts.find((p) => p.type === "minute")?.value ?? "0", 10);

  // Get day of week in ET
  const etDayStr = new Intl.DateTimeFormat("en-US", {
    timeZone: EASTERN_TZ,
    weekday: "long",
  }).format(date);

  const dayMap: Record<string, number> = {
    Sunday: 0, Monday: 1, Tuesday: 2, Wednesday: 3,
    Thursday: 4, Friday: 5, Saturday: 6,
  };
  const dayOfWeek = dayMap[etDayStr] ?? 0;

  // Human-readable format
  const formatted = new Intl.DateTimeFormat("en-US", {
    timeZone: EASTERN_TZ,
    weekday: "long",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(date);

  return { hour, minute, dayOfWeek, formatted };
}

/**
 * Check if the current time is within business hours.
 * Returns true if calls are allowed, false if outside hours.
 */
export function isWithinBusinessHours(now?: Date): boolean {
  const { hour, dayOfWeek } = getCurrentEasternTime(now);

  // Check if the day is allowed
  if (!BUSINESS_HOURS.daysOfWeek.includes(dayOfWeek)) {
    return false;
  }

  // Check if the hour is within range: [startHour, endHour)
  // 7 AM (7) to 10 PM (22) — hour must be >= 7 and < 22
  return hour >= BUSINESS_HOURS.startHour && hour < BUSINESS_HOURS.endHour;
}

/**
 * Get a human-readable message about why a call was blocked.
 */
export function getBusinessHoursBlockMessage(now?: Date): string {
  const { formatted } = getCurrentEasternTime(now);
  return `AI calls are only allowed during business hours: ${BUSINESS_HOURS.label}. Current time is ${formatted} ET. Please try again during business hours.`;
}

/**
 * Enforce business hours — throws an error if outside hours.
 * Use this as a guard at the top of any call initiation function.
 */
export function enforceBusinessHours(now?: Date): void {
  if (!isWithinBusinessHours(now)) {
    throw new BusinessHoursError(getBusinessHoursBlockMessage(now));
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
