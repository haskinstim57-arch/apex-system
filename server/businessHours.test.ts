import { describe, it, expect } from "vitest";
import {
  isWithinBusinessHours,
  getTimeInTimezone,
  getCurrentEasternTime,
  getBusinessHoursBlockMessage,
  getBusinessHoursLabel,
  enforceBusinessHours,
  resolveBusinessHours,
  BusinessHoursError,
  BUSINESS_HOURS,
  DEFAULT_BUSINESS_HOURS,
  type BusinessHoursConfig,
} from "./utils/businessHours";

// ─────────────────────────────────────────────
// Default Config Tests (backward compatibility)
// ─────────────────────────────────────────────
describe("Business Hours Enforcement — Default Config", () => {
  describe("BUSINESS_HOURS / DEFAULT_BUSINESS_HOURS constants", () => {
    it("should be configured for 7 AM - 10 PM ET, 7 days a week", () => {
      expect(DEFAULT_BUSINESS_HOURS.startHour).toBe(7);
      expect(DEFAULT_BUSINESS_HOURS.endHour).toBe(22);
      expect(DEFAULT_BUSINESS_HOURS.timezone).toBe("America/New_York");
      expect(DEFAULT_BUSINESS_HOURS.daysOfWeek).toEqual([0, 1, 2, 3, 4, 5, 6]);
    });

    it("should keep backward-compatible BUSINESS_HOURS with label", () => {
      expect(BUSINESS_HOURS.startHour).toBe(7);
      expect(BUSINESS_HOURS.endHour).toBe(22);
      expect(BUSINESS_HOURS.timezone).toBe("America/New_York");
      expect(BUSINESS_HOURS.label).toContain("7:00 AM");
      expect(BUSINESS_HOURS.label).toContain("10:00 PM");
      expect(BUSINESS_HOURS.label).toContain("Eastern");
    });
  });

  describe("getCurrentEasternTime (backward compat)", () => {
    it("should return hour, minute, dayOfWeek, and formatted string", () => {
      const result = getCurrentEasternTime();
      expect(result).toHaveProperty("hour");
      expect(result).toHaveProperty("minute");
      expect(result).toHaveProperty("dayOfWeek");
      expect(result).toHaveProperty("formatted");
      expect(typeof result.hour).toBe("number");
      expect(typeof result.minute).toBe("number");
      expect(result.hour).toBeGreaterThanOrEqual(0);
      expect(result.hour).toBeLessThanOrEqual(23);
      expect(result.dayOfWeek).toBeGreaterThanOrEqual(0);
      expect(result.dayOfWeek).toBeLessThanOrEqual(6);
    });

    it("should correctly convert a known UTC time to ET", () => {
      // March 26, 2026 at 15:00 UTC = 11:00 AM EDT (DST active in March)
      const utcDate = new Date("2026-03-26T15:00:00Z");
      const result = getCurrentEasternTime(utcDate);
      expect(result.hour).toBe(11);
      expect(result.minute).toBe(0);
    });

    it("should handle midnight UTC correctly", () => {
      // March 26, 2026 at 00:00 UTC = 8:00 PM EDT previous day (March 25)
      const utcDate = new Date("2026-03-26T00:00:00Z");
      const result = getCurrentEasternTime(utcDate);
      expect(result.hour).toBe(20); // 8 PM ET
    });
  });

  describe("isWithinBusinessHours — defaults (no config)", () => {
    it("should return true at 12:00 PM ET (noon) on a weekday", () => {
      // March 26, 2026 at 16:00 UTC = 12:00 PM EDT
      const noon = new Date("2026-03-26T16:00:00Z");
      expect(isWithinBusinessHours(null, noon)).toBe(true);
    });

    it("should return true at 7:00 AM ET (start of hours)", () => {
      // 7:00 AM EDT = 11:00 UTC
      const start = new Date("2026-03-26T11:00:00Z");
      expect(isWithinBusinessHours(null, start)).toBe(true);
    });

    it("should return true at 9:59 PM ET (just before closing)", () => {
      // 9:59 PM EDT = 01:59 UTC next day
      const beforeClose = new Date("2026-03-27T01:59:00Z");
      expect(isWithinBusinessHours(null, beforeClose)).toBe(true);
    });

    it("should return false at 10:00 PM ET (closing time)", () => {
      // 10:00 PM EDT = 02:00 UTC next day
      const atClose = new Date("2026-03-27T02:00:00Z");
      expect(isWithinBusinessHours(null, atClose)).toBe(false);
    });

    it("should return false at 6:59 AM ET (just before opening)", () => {
      // 6:59 AM EDT = 10:59 UTC
      const beforeOpen = new Date("2026-03-26T10:59:00Z");
      expect(isWithinBusinessHours(null, beforeOpen)).toBe(false);
    });

    it("should return false at 3:00 AM ET (middle of night)", () => {
      // 3:00 AM EDT = 07:00 UTC
      const nightTime = new Date("2026-03-26T07:00:00Z");
      expect(isWithinBusinessHours(null, nightTime)).toBe(false);
    });

    it("should return true on Saturday at 2:00 PM ET", () => {
      // March 28, 2026 is a Saturday. 2:00 PM EDT = 18:00 UTC
      const satAfternoon = new Date("2026-03-28T18:00:00Z");
      expect(isWithinBusinessHours(null, satAfternoon)).toBe(true);
    });

    it("should return true on Sunday at 10:00 AM ET", () => {
      // March 29, 2026 is a Sunday. 10:00 AM EDT = 14:00 UTC
      const sunMorning = new Date("2026-03-29T14:00:00Z");
      expect(isWithinBusinessHours(null, sunMorning)).toBe(true);
    });

    it("should return false at 11:30 PM ET on any day", () => {
      // 11:30 PM EDT = 03:30 UTC next day
      const lateNight = new Date("2026-03-27T03:30:00Z");
      expect(isWithinBusinessHours(null, lateNight)).toBe(false);
    });
  });

  describe("getBusinessHoursBlockMessage — defaults", () => {
    it("should return a message containing business hours info", () => {
      const msg = getBusinessHoursBlockMessage(null);
      expect(msg).toContain("7:00 AM");
      expect(msg).toContain("10:00 PM");
      expect(msg).toContain("business hours");
    });

    it("should include the current time in the message", () => {
      const msg = getBusinessHoursBlockMessage(null, new Date("2026-03-26T07:00:00Z"));
      expect(msg).toContain("business hours");
    });
  });

  describe("enforceBusinessHours — defaults", () => {
    it("should not throw during business hours", () => {
      // 12:00 PM EDT
      const noon = new Date("2026-03-26T16:00:00Z");
      expect(() => enforceBusinessHours(null, noon)).not.toThrow();
    });

    it("should throw BusinessHoursError outside business hours", () => {
      // 3:00 AM EDT
      const nightTime = new Date("2026-03-26T07:00:00Z");
      expect(() => enforceBusinessHours(null, nightTime)).toThrow(BusinessHoursError);
    });

    it("should throw with descriptive message", () => {
      const nightTime = new Date("2026-03-26T07:00:00Z");
      try {
        enforceBusinessHours(null, nightTime);
        expect.unreachable("Should have thrown");
      } catch (err) {
        expect(err).toBeInstanceOf(BusinessHoursError);
        expect((err as BusinessHoursError).message).toContain("business hours");
        expect((err as BusinessHoursError).isBusinessHoursError).toBe(true);
      }
    });
  });

  describe("Edge cases — defaults", () => {
    it("should handle DST transition correctly (EST to EDT)", () => {
      // Nov 1, 2026 at 06:00 UTC = 1:00 AM EST (after fall back)
      const fallBack = new Date("2026-11-01T06:00:00Z");
      const result = getCurrentEasternTime(fallBack);
      expect(result.hour).toBe(1);
      expect(isWithinBusinessHours(null, fallBack)).toBe(false); // 1 AM is outside hours
    });

    it("should handle New Year's Day (still open, 7 days a week)", () => {
      // Jan 1, 2027 at 17:00 UTC = 12:00 PM EST
      const newYears = new Date("2027-01-01T17:00:00Z");
      expect(isWithinBusinessHours(null, newYears)).toBe(true);
    });
  });
});

// ─────────────────────────────────────────────
// Per-Account Config Tests
// ─────────────────────────────────────────────
describe("Business Hours Enforcement — Per-Account Config", () => {
  describe("resolveBusinessHours", () => {
    it("should return defaults when config is null", () => {
      const resolved = resolveBusinessHours(null);
      expect(resolved).toEqual(DEFAULT_BUSINESS_HOURS);
    });

    it("should return defaults when config is undefined", () => {
      const resolved = resolveBusinessHours(undefined);
      expect(resolved).toEqual(DEFAULT_BUSINESS_HOURS);
    });

    it("should use custom config when provided", () => {
      const custom: BusinessHoursConfig = {
        timezone: "America/Chicago",
        startHour: 9,
        endHour: 17,
        daysOfWeek: [1, 2, 3, 4, 5],
      };
      const resolved = resolveBusinessHours(custom);
      expect(resolved).toEqual(custom);
    });

    it("should fill in missing fields with defaults", () => {
      const partial = {
        timezone: "",
        startHour: 8,
        endHour: 20,
        daysOfWeek: [],
      };
      const resolved = resolveBusinessHours(partial);
      expect(resolved.timezone).toBe("America/New_York"); // empty string falls back
      expect(resolved.startHour).toBe(8);
      expect(resolved.endHour).toBe(20);
      expect(resolved.daysOfWeek).toEqual([0, 1, 2, 3, 4, 5, 6]); // empty array falls back
    });
  });

  describe("isWithinBusinessHours — custom Pacific Time config", () => {
    const pacificConfig: BusinessHoursConfig = {
      timezone: "America/Los_Angeles",
      startHour: 9,
      endHour: 18,
      daysOfWeek: [1, 2, 3, 4, 5], // weekdays only
    };

    it("should return true at 12:00 PM PT on a weekday", () => {
      // March 26, 2026 (Thursday) at 19:00 UTC = 12:00 PM PDT
      const noon = new Date("2026-03-26T19:00:00Z");
      expect(isWithinBusinessHours(pacificConfig, noon)).toBe(true);
    });

    it("should return false at 8:59 AM PT (before opening)", () => {
      // 8:59 AM PDT = 15:59 UTC
      const beforeOpen = new Date("2026-03-26T15:59:00Z");
      expect(isWithinBusinessHours(pacificConfig, beforeOpen)).toBe(false);
    });

    it("should return true at 9:00 AM PT (opening time)", () => {
      // 9:00 AM PDT = 16:00 UTC
      const atOpen = new Date("2026-03-26T16:00:00Z");
      expect(isWithinBusinessHours(pacificConfig, atOpen)).toBe(true);
    });

    it("should return false at 6:00 PM PT (closing time)", () => {
      // 6:00 PM PDT = 01:00 UTC next day
      const atClose = new Date("2026-03-27T01:00:00Z");
      expect(isWithinBusinessHours(pacificConfig, atClose)).toBe(false);
    });

    it("should return false on Saturday (weekdays only)", () => {
      // March 28, 2026 is Saturday. 12:00 PM PDT = 19:00 UTC
      const satNoon = new Date("2026-03-28T19:00:00Z");
      expect(isWithinBusinessHours(pacificConfig, satNoon)).toBe(false);
    });

    it("should return false on Sunday (weekdays only)", () => {
      // March 29, 2026 is Sunday. 12:00 PM PDT = 19:00 UTC
      const sunNoon = new Date("2026-03-29T19:00:00Z");
      expect(isWithinBusinessHours(pacificConfig, sunNoon)).toBe(false);
    });
  });

  describe("isWithinBusinessHours — custom Central Time 24/7 config", () => {
    const centralConfig: BusinessHoursConfig = {
      timezone: "America/Chicago",
      startHour: 6,
      endHour: 23,
      daysOfWeek: [0, 1, 2, 3, 4, 5, 6],
    };

    it("should return true at 6:00 AM CT", () => {
      // March 26, 2026 at 11:00 UTC = 6:00 AM CDT
      const earlyMorning = new Date("2026-03-26T11:00:00Z");
      expect(isWithinBusinessHours(centralConfig, earlyMorning)).toBe(true);
    });

    it("should return false at 5:59 AM CT", () => {
      // 5:59 AM CDT = 10:59 UTC
      const tooEarly = new Date("2026-03-26T10:59:00Z");
      expect(isWithinBusinessHours(centralConfig, tooEarly)).toBe(false);
    });

    it("should return true at 10:59 PM CT", () => {
      // 10:59 PM CDT = 03:59 UTC next day
      const lateEvening = new Date("2026-03-27T03:59:00Z");
      expect(isWithinBusinessHours(centralConfig, lateEvening)).toBe(true);
    });

    it("should return false at 11:00 PM CT", () => {
      // 11:00 PM CDT = 04:00 UTC next day
      const atClose = new Date("2026-03-27T04:00:00Z");
      expect(isWithinBusinessHours(centralConfig, atClose)).toBe(false);
    });
  });

  describe("getBusinessHoursLabel", () => {
    it("should format default hours correctly", () => {
      const label = getBusinessHoursLabel(DEFAULT_BUSINESS_HOURS);
      expect(label).toContain("7:00 AM");
      expect(label).toContain("10:00 PM");
      expect(label).toContain("7 days a week");
    });

    it("should format weekday-only config correctly", () => {
      const config: BusinessHoursConfig = {
        timezone: "America/Los_Angeles",
        startHour: 9,
        endHour: 17,
        daysOfWeek: [1, 2, 3, 4, 5],
      };
      const label = getBusinessHoursLabel(config);
      expect(label).toContain("9:00 AM");
      expect(label).toContain("5:00 PM");
      expect(label).toContain("weekdays only");
    });

    it("should format custom day selection correctly", () => {
      const config: BusinessHoursConfig = {
        timezone: "America/Chicago",
        startHour: 10,
        endHour: 20,
        daysOfWeek: [1, 3, 5],
      };
      const label = getBusinessHoursLabel(config);
      expect(label).toContain("10:00 AM");
      expect(label).toContain("8:00 PM");
      expect(label).toContain("Mon");
      expect(label).toContain("Wed");
      expect(label).toContain("Fri");
    });

    it("should handle midnight and noon edge cases", () => {
      const config: BusinessHoursConfig = {
        timezone: "UTC",
        startHour: 0,
        endHour: 12,
        daysOfWeek: [0, 1, 2, 3, 4, 5, 6],
      };
      const label = getBusinessHoursLabel(config);
      expect(label).toContain("12:00 AM");
      expect(label).toContain("12:00 PM");
    });
  });

  describe("getTimeInTimezone", () => {
    it("should return correct time for Pacific timezone", () => {
      // March 26, 2026 at 19:00 UTC = 12:00 PM PDT
      const utcDate = new Date("2026-03-26T19:00:00Z");
      const result = getTimeInTimezone("America/Los_Angeles", utcDate);
      expect(result.hour).toBe(12);
      expect(result.minute).toBe(0);
    });

    it("should return correct time for Central timezone", () => {
      // March 26, 2026 at 17:00 UTC = 12:00 PM CDT
      const utcDate = new Date("2026-03-26T17:00:00Z");
      const result = getTimeInTimezone("America/Chicago", utcDate);
      expect(result.hour).toBe(12);
      expect(result.minute).toBe(0);
    });

    it("should return correct day of week", () => {
      // March 28, 2026 is a Saturday
      const satDate = new Date("2026-03-28T18:00:00Z");
      const result = getTimeInTimezone("America/New_York", satDate);
      expect(result.dayOfWeek).toBe(6); // Saturday
    });
  });

  describe("enforceBusinessHours — custom config", () => {
    const restrictiveConfig: BusinessHoursConfig = {
      timezone: "America/Los_Angeles",
      startHour: 10,
      endHour: 16,
      daysOfWeek: [1, 2, 3, 4, 5],
    };

    it("should not throw during custom business hours", () => {
      // March 26, 2026 (Thursday) at 20:00 UTC = 1:00 PM PDT
      const afternoon = new Date("2026-03-26T20:00:00Z");
      expect(() => enforceBusinessHours(restrictiveConfig, afternoon)).not.toThrow();
    });

    it("should throw outside custom business hours", () => {
      // March 26, 2026 at 16:00 UTC = 9:00 AM PDT (before 10 AM opening)
      const tooEarly = new Date("2026-03-26T16:00:00Z");
      expect(() => enforceBusinessHours(restrictiveConfig, tooEarly)).toThrow(BusinessHoursError);
    });

    it("should throw on weekends with weekday-only config", () => {
      // March 28, 2026 is Saturday. 1:00 PM PDT = 20:00 UTC
      const satAfternoon = new Date("2026-03-28T20:00:00Z");
      expect(() => enforceBusinessHours(restrictiveConfig, satAfternoon)).toThrow(BusinessHoursError);
    });
  });

  describe("getBusinessHoursBlockMessage — custom config", () => {
    it("should include custom hours in the block message", () => {
      const config: BusinessHoursConfig = {
        timezone: "America/Los_Angeles",
        startHour: 9,
        endHour: 17,
        daysOfWeek: [1, 2, 3, 4, 5],
      };
      const msg = getBusinessHoursBlockMessage(config);
      expect(msg).toContain("9:00 AM");
      expect(msg).toContain("5:00 PM");
      expect(msg).toContain("weekdays only");
      expect(msg).toContain("business hours");
    });
  });
});
