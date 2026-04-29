import { describe, it, expect } from "vitest";
import {
  calculateNextRunAt,
  getTimezoneOffsetForDate,
} from "./services/scheduledReportsCron";

/**
 * Tests for Scheduled Reports Timezone Fix (V2 — noon-UTC offset approach)
 *
 * Validates:
 * 1. getTimezoneOffsetForDate returns correct offsets for known timezones
 * 2. calculateNextRunAt produces correct next run times for all frequencies
 * 3. DST transitions are handled correctly (PDT vs PST, EDT vs EST)
 * 4. Weekend skipping works for daily_activity/daily_marketing
 */

describe("Scheduled Reports Timezone Fix", () => {
  describe("getTimezoneOffsetForDate", () => {
    it("should return -420 for America/Los_Angeles during PDT (summer)", () => {
      const date = new Date("2026-04-28T12:00:00Z");
      const offset = getTimezoneOffsetForDate("America/Los_Angeles", date);
      expect(offset).toBe(-420);
    });

    it("should return -480 for America/Los_Angeles during PST (winter)", () => {
      const date = new Date("2026-01-15T12:00:00Z");
      const offset = getTimezoneOffsetForDate("America/Los_Angeles", date);
      expect(offset).toBe(-480);
    });

    it("should return -240 for America/New_York during EDT (summer)", () => {
      const date = new Date("2026-07-15T12:00:00Z");
      const offset = getTimezoneOffsetForDate("America/New_York", date);
      expect(offset).toBe(-240);
    });

    it("should return -300 for America/New_York during EST (winter)", () => {
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

  describe("calculateNextRunAt — daily_activity", () => {
    it("should return next weekday at correct UTC hour for 7 AM Pacific (PDT)", () => {
      const result = calculateNextRunAt("daily_activity", 7, "America/Los_Angeles", null, null);
      expect(result.getTime()).toBeGreaterThan(Date.now());
      // 7 AM PDT = 14:00 UTC
      expect(result.getUTCHours()).toBe(14);
    });

    it("should skip weekends for daily_activity", () => {
      const result = calculateNextRunAt("daily_activity", 7, "America/Los_Angeles", null, null);
      const dayStr = new Intl.DateTimeFormat("en-US", { timeZone: "America/Los_Angeles", weekday: "short" }).format(result);
      expect(dayStr).not.toBe("Sat");
      expect(dayStr).not.toBe("Sun");
    });

    it("should use default hour 7 when sendHour is 0 (falsy)", () => {
      const result = calculateNextRunAt("daily_activity", 0, "America/New_York", null, null);
      expect(result.getTime()).toBeGreaterThan(Date.now());
    });
  });

  describe("calculateNextRunAt — daily", () => {
    it("should return next occurrence at sendHour in timezone", () => {
      const result = calculateNextRunAt("daily", 9, "America/New_York", null, null);
      expect(result.getTime()).toBeGreaterThan(Date.now());
      // 9 AM EDT = 13:00 UTC
      expect(result.getUTCHours()).toBe(13);
    });

    it("should produce correct UTC hour for 8 AM Eastern (EDT)", () => {
      const result = calculateNextRunAt("daily", 8, "America/New_York", null, null);
      expect(result.getTime()).toBeGreaterThan(Date.now());
      // 8 AM EDT = 12:00 UTC
      expect(result.getUTCHours()).toBe(12);
    });
  });

  describe("calculateNextRunAt — weekly", () => {
    it("should return next Monday at sendHour for weekly with dayOfWeek=1", () => {
      const result = calculateNextRunAt("weekly", 8, "America/Chicago", 1, null);
      expect(result.getTime()).toBeGreaterThan(Date.now());
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

  describe("DST regression — noon-UTC offset approach", () => {
    it("7 AM Pacific (PDT, April) should be 14:00 UTC, not 15:00", () => {
      const result = calculateNextRunAt("daily_activity", 7, "America/Los_Angeles", null, null);
      // PDT = UTC-7, so 7 AM PDT = 14:00 UTC
      expect(result.getUTCHours()).toBe(14);
    });

    it("8 AM Eastern (EDT, April) should be 12:00 UTC, not 13:00", () => {
      const result = calculateNextRunAt("daily", 8, "America/New_York", null, null);
      // EDT = UTC-4, so 8 AM EDT = 12:00 UTC
      expect(result.getUTCHours()).toBe(12);
    });

    it("7 AM Pacific should NOT be 07:00 UTC (old bug)", () => {
      const result = calculateNextRunAt("daily_activity", 7, "America/Los_Angeles", null, null);
      expect(result.getUTCHours()).not.toBe(7);
    });

    it("should produce correct UTC minutes (always :00)", () => {
      const result = calculateNextRunAt("daily", 9, "America/Chicago", null, null);
      expect(result.getUTCMinutes()).toBe(0);
      expect(result.getUTCSeconds()).toBe(0);
    });
  });
});
