import { describe, it, expect } from "vitest";
import {
  calculateNextRunAt,
  getTimezoneOffsetForDate,
  localHourToUTC,
} from "./services/scheduledReportsCron";

/**
 * Tests for Prompt V — Timezone-aware calculateNextRunAt
 *
 * Validates:
 * 1. getTimezoneOffsetForDate returns correct offsets for known timezones
 * 2. localHourToUTC correctly converts local hours to UTC
 * 3. calculateNextRunAt produces correct next run times for all frequencies
 * 4. DST transitions are handled correctly
 * 5. Weekend skipping works in local timezone for daily_activity/daily_marketing
 */

describe("Prompt V — Scheduled Reports Timezone Fix", () => {
  describe("getTimezoneOffsetForDate", () => {
    it("should return -420 for America/Los_Angeles during PDT (summer)", () => {
      // April 28, 2026 — PDT is active (UTC-7 = -420 minutes)
      const date = new Date("2026-04-28T12:00:00Z");
      const offset = getTimezoneOffsetForDate("America/Los_Angeles", date);
      expect(offset).toBe(-420);
    });

    it("should return -480 for America/Los_Angeles during PST (winter)", () => {
      // January 15, 2026 — PST is active (UTC-8 = -480 minutes)
      const date = new Date("2026-01-15T12:00:00Z");
      const offset = getTimezoneOffsetForDate("America/Los_Angeles", date);
      expect(offset).toBe(-480);
    });

    it("should return -240 for America/New_York during EDT (summer)", () => {
      // July 15, 2026 — EDT is active (UTC-4 = -240 minutes)
      const date = new Date("2026-07-15T12:00:00Z");
      const offset = getTimezoneOffsetForDate("America/New_York", date);
      expect(offset).toBe(-240);
    });

    it("should return -300 for America/New_York during EST (winter)", () => {
      // January 15, 2026 — EST is active (UTC-5 = -300 minutes)
      const date = new Date("2026-01-15T12:00:00Z");
      const offset = getTimezoneOffsetForDate("America/New_York", date);
      expect(offset).toBe(-300);
    });

    it("should return 0 for UTC", () => {
      const date = new Date("2026-04-28T12:00:00Z");
      const offset = getTimezoneOffsetForDate("UTC", date);
      expect(offset).toBe(0);
    });

    it("should return 0 for invalid timezone (fallback)", () => {
      const date = new Date("2026-04-28T12:00:00Z");
      const offset = getTimezoneOffsetForDate("Invalid/Timezone", date);
      expect(offset).toBe(0);
    });

    it("should return -300 for America/Chicago during CDT (summer)", () => {
      const date = new Date("2026-06-15T12:00:00Z");
      const offset = getTimezoneOffsetForDate("America/Chicago", date);
      expect(offset).toBe(-300);
    });

    it("should return -360 for America/Chicago during CST (winter)", () => {
      const date = new Date("2026-01-15T12:00:00Z");
      const offset = getTimezoneOffsetForDate("America/Chicago", date);
      expect(offset).toBe(-360);
    });
  });

  describe("localHourToUTC", () => {
    it("should convert 7 AM Pacific (PDT) to 14:00 UTC", () => {
      // April 29, 2026 — PDT active
      const baseDate = new Date("2026-04-29T00:00:00Z");
      const result = localHourToUTC(7, "America/Los_Angeles", baseDate);
      expect(result.getUTCHours()).toBe(14);
      expect(result.getUTCMinutes()).toBe(0);
    });

    it("should convert 7 AM Pacific (PST) to 15:00 UTC", () => {
      // January 15, 2026 — PST active
      const baseDate = new Date("2026-01-15T00:00:00Z");
      const result = localHourToUTC(7, "America/Los_Angeles", baseDate);
      expect(result.getUTCHours()).toBe(15);
      expect(result.getUTCMinutes()).toBe(0);
    });

    it("should convert 8 AM Eastern (EDT) to 12:00 UTC", () => {
      // July 15, 2026 — EDT active
      const baseDate = new Date("2026-07-15T00:00:00Z");
      const result = localHourToUTC(8, "America/New_York", baseDate);
      expect(result.getUTCHours()).toBe(12);
      expect(result.getUTCMinutes()).toBe(0);
    });

    it("should convert 8 AM Eastern (EST) to 13:00 UTC", () => {
      // January 15, 2026 — EST active
      const baseDate = new Date("2026-01-15T00:00:00Z");
      const result = localHourToUTC(8, "America/New_York", baseDate);
      expect(result.getUTCHours()).toBe(13);
      expect(result.getUTCMinutes()).toBe(0);
    });

    it("should convert 12 PM UTC to 12:00 UTC", () => {
      const baseDate = new Date("2026-04-29T00:00:00Z");
      const result = localHourToUTC(12, "UTC", baseDate);
      expect(result.getUTCHours()).toBe(12);
    });

    it("should handle midnight (hour 0) correctly", () => {
      const baseDate = new Date("2026-04-29T12:00:00Z");
      const result = localHourToUTC(0, "America/Los_Angeles", baseDate);
      // 0:00 Pacific (PDT) = 07:00 UTC
      expect(result.getUTCHours()).toBe(7);
    });
  });

  describe("calculateNextRunAt — daily_activity", () => {
    it("should return next weekday at 7 AM Pacific for daily_activity", () => {
      const result = calculateNextRunAt("daily_activity", 7, "America/Los_Angeles", null, null);
      // Should be in the future
      expect(result.getTime()).toBeGreaterThan(Date.now());
      // Verify it's 7 AM Pacific
      const localStr = result.toLocaleString("en-US", { timeZone: "America/Los_Angeles", hour: "numeric", hour12: false });
      expect(localStr).toContain("7");
    });

    it("should skip weekends for daily_activity", () => {
      const result = calculateNextRunAt("daily_activity", 7, "America/Los_Angeles", null, null);
      // Get the day of week in Pacific time
      const dayStr = new Intl.DateTimeFormat("en-US", { timeZone: "America/Los_Angeles", weekday: "short" }).format(result);
      expect(dayStr).not.toBe("Sat");
      expect(dayStr).not.toBe("Sun");
    });

    it("should use default hour 7 when sendHour is 0", () => {
      // sendHour 0 is falsy, should use ?? 7 default
      const result = calculateNextRunAt("daily_activity", 0, "America/New_York", null, null);
      // With sendHour 0 (midnight), it should still work
      expect(result.getTime()).toBeGreaterThan(Date.now());
    });
  });

  describe("calculateNextRunAt — daily", () => {
    it("should return next occurrence at sendHour in timezone", () => {
      const result = calculateNextRunAt("daily", 9, "America/New_York", null, null);
      expect(result.getTime()).toBeGreaterThan(Date.now());
      // Verify it's 9 AM Eastern
      const parts = new Intl.DateTimeFormat("en-US", {
        timeZone: "America/New_York",
        hour: "numeric",
        hour12: false,
      }).formatToParts(result);
      const hour = parseInt(parts.find((p) => p.type === "hour")?.value || "0");
      expect(hour).toBe(9);
    });
  });

  describe("calculateNextRunAt — weekly", () => {
    it("should return next Monday at sendHour for weekly with dayOfWeek=1", () => {
      const result = calculateNextRunAt("weekly", 8, "America/Chicago", 1, null);
      expect(result.getTime()).toBeGreaterThan(Date.now());
      // Verify it's a Monday in Chicago time
      const dayStr = new Intl.DateTimeFormat("en-US", { timeZone: "America/Chicago", weekday: "long" }).format(result);
      expect(dayStr).toBe("Monday");
    });

    it("should return next Friday at sendHour for weekly with dayOfWeek=5", () => {
      const result = calculateNextRunAt("weekly", 10, "America/Los_Angeles", 5, null);
      expect(result.getTime()).toBeGreaterThan(Date.now());
      const dayStr = new Intl.DateTimeFormat("en-US", { timeZone: "America/Los_Angeles", weekday: "long" }).format(result);
      expect(dayStr).toBe("Friday");
    });

    it("should default to Monday when dayOfWeek is null", () => {
      const result = calculateNextRunAt("weekly", 8, "UTC", null, null);
      expect(result.getTime()).toBeGreaterThan(Date.now());
      const dayStr = new Intl.DateTimeFormat("en-US", { timeZone: "UTC", weekday: "long" }).format(result);
      expect(dayStr).toBe("Monday");
    });
  });

  describe("calculateNextRunAt — monthly", () => {
    it("should return next 1st of month at sendHour", () => {
      const result = calculateNextRunAt("monthly", 9, "America/New_York", null, 1);
      expect(result.getTime()).toBeGreaterThan(Date.now());
      // Verify it's the 1st in Eastern time
      const parts = new Intl.DateTimeFormat("en-US", {
        timeZone: "America/New_York",
        day: "numeric",
      }).formatToParts(result);
      const day = parseInt(parts.find((p) => p.type === "day")?.value || "0");
      expect(day).toBe(1);
    });

    it("should cap dayOfMonth at 28", () => {
      const result = calculateNextRunAt("monthly", 9, "UTC", null, 31);
      expect(result.getTime()).toBeGreaterThan(Date.now());
      const parts = new Intl.DateTimeFormat("en-US", {
        timeZone: "UTC",
        day: "numeric",
      }).formatToParts(result);
      const day = parseInt(parts.find((p) => p.type === "day")?.value || "0");
      expect(day).toBe(28);
    });

    it("should default to 1st when dayOfMonth is null", () => {
      const result = calculateNextRunAt("monthly", 9, "UTC", null, null);
      expect(result.getTime()).toBeGreaterThan(Date.now());
      const parts = new Intl.DateTimeFormat("en-US", {
        timeZone: "UTC",
        day: "numeric",
      }).formatToParts(result);
      const day = parseInt(parts.find((p) => p.type === "day")?.value || "0");
      expect(day).toBe(1);
    });
  });

  describe("calculateNextRunAt — daily_marketing", () => {
    it("should behave same as daily_activity (weekdays only)", () => {
      const result = calculateNextRunAt("daily_marketing", 7, "America/Los_Angeles", null, null);
      expect(result.getTime()).toBeGreaterThan(Date.now());
      const dayStr = new Intl.DateTimeFormat("en-US", { timeZone: "America/Los_Angeles", weekday: "short" }).format(result);
      expect(dayStr).not.toBe("Sat");
      expect(dayStr).not.toBe("Sun");
    });
  });

  describe("regression — old bug: sendHour treated as UTC", () => {
    it("7 AM Pacific should NOT be 07:00 UTC", () => {
      const result = calculateNextRunAt("daily_activity", 7, "America/Los_Angeles", null, null);
      // If the bug existed, the UTC hour would be 7. With the fix, it should be 14 (PDT).
      expect(result.getUTCHours()).toBe(14);
    });

    it("8 AM Eastern should NOT be 08:00 UTC", () => {
      const result = calculateNextRunAt("daily", 8, "America/New_York", null, null);
      // EDT: 8 AM Eastern = 12:00 UTC
      expect(result.getUTCHours()).toBe(12);
    });
  });
});
