import { describe, it, expect } from "vitest";
import {
  isWithinBusinessHours,
  getCurrentEasternTime,
  getBusinessHoursBlockMessage,
  enforceBusinessHours,
  BusinessHoursError,
  BUSINESS_HOURS,
} from "./utils/businessHours";

describe("Business Hours Enforcement", () => {
  describe("BUSINESS_HOURS config", () => {
    it("should be configured for 7 AM - 10 PM ET, 7 days a week", () => {
      expect(BUSINESS_HOURS.startHour).toBe(7);
      expect(BUSINESS_HOURS.endHour).toBe(22);
      expect(BUSINESS_HOURS.timezone).toBe("America/New_York");
      expect(BUSINESS_HOURS.daysOfWeek).toEqual([0, 1, 2, 3, 4, 5, 6]);
      expect(BUSINESS_HOURS.label).toContain("7:00 AM");
      expect(BUSINESS_HOURS.label).toContain("10:00 PM");
      expect(BUSINESS_HOURS.label).toContain("Eastern");
    });
  });

  describe("getCurrentEasternTime", () => {
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

  describe("isWithinBusinessHours", () => {
    it("should return true at 12:00 PM ET (noon) on a weekday", () => {
      // March 26, 2026 at 16:00 UTC = 12:00 PM EDT
      const noon = new Date("2026-03-26T16:00:00Z");
      expect(isWithinBusinessHours(noon)).toBe(true);
    });

    it("should return true at 7:00 AM ET (start of hours)", () => {
      // 7:00 AM EDT = 11:00 UTC
      const start = new Date("2026-03-26T11:00:00Z");
      expect(isWithinBusinessHours(start)).toBe(true);
    });

    it("should return true at 9:59 PM ET (just before closing)", () => {
      // 9:59 PM EDT = 01:59 UTC next day
      const beforeClose = new Date("2026-03-27T01:59:00Z");
      expect(isWithinBusinessHours(beforeClose)).toBe(true);
    });

    it("should return false at 10:00 PM ET (closing time)", () => {
      // 10:00 PM EDT = 02:00 UTC next day
      const atClose = new Date("2026-03-27T02:00:00Z");
      expect(isWithinBusinessHours(atClose)).toBe(false);
    });

    it("should return false at 6:59 AM ET (just before opening)", () => {
      // 6:59 AM EDT = 10:59 UTC
      const beforeOpen = new Date("2026-03-26T10:59:00Z");
      expect(isWithinBusinessHours(beforeOpen)).toBe(false);
    });

    it("should return false at 3:00 AM ET (middle of night)", () => {
      // 3:00 AM EDT = 07:00 UTC
      const nightTime = new Date("2026-03-26T07:00:00Z");
      expect(isWithinBusinessHours(nightTime)).toBe(false);
    });

    it("should return true on Saturday at 2:00 PM ET", () => {
      // March 28, 2026 is a Saturday. 2:00 PM EDT = 18:00 UTC
      const satAfternoon = new Date("2026-03-28T18:00:00Z");
      expect(isWithinBusinessHours(satAfternoon)).toBe(true);
    });

    it("should return true on Sunday at 10:00 AM ET", () => {
      // March 29, 2026 is a Sunday. 10:00 AM EDT = 14:00 UTC
      const sunMorning = new Date("2026-03-29T14:00:00Z");
      expect(isWithinBusinessHours(sunMorning)).toBe(true);
    });

    it("should return false at 11:30 PM ET on any day", () => {
      // 11:30 PM EDT = 03:30 UTC next day
      const lateNight = new Date("2026-03-27T03:30:00Z");
      expect(isWithinBusinessHours(lateNight)).toBe(false);
    });
  });

  describe("getBusinessHoursBlockMessage", () => {
    it("should return a message containing business hours info", () => {
      const msg = getBusinessHoursBlockMessage();
      expect(msg).toContain("7:00 AM");
      expect(msg).toContain("10:00 PM");
      expect(msg).toContain("Eastern Time");
      expect(msg).toContain("business hours");
    });

    it("should include the current time in the message", () => {
      const msg = getBusinessHoursBlockMessage(new Date("2026-03-26T07:00:00Z"));
      expect(msg).toContain("ET");
    });
  });

  describe("enforceBusinessHours", () => {
    it("should not throw during business hours", () => {
      // 12:00 PM EDT
      const noon = new Date("2026-03-26T16:00:00Z");
      expect(() => enforceBusinessHours(noon)).not.toThrow();
    });

    it("should throw BusinessHoursError outside business hours", () => {
      // 3:00 AM EDT
      const nightTime = new Date("2026-03-26T07:00:00Z");
      expect(() => enforceBusinessHours(nightTime)).toThrow(BusinessHoursError);
    });

    it("should throw with descriptive message", () => {
      const nightTime = new Date("2026-03-26T07:00:00Z");
      try {
        enforceBusinessHours(nightTime);
        expect.unreachable("Should have thrown");
      } catch (err) {
        expect(err).toBeInstanceOf(BusinessHoursError);
        expect((err as BusinessHoursError).message).toContain("business hours");
        expect((err as BusinessHoursError).isBusinessHoursError).toBe(true);
      }
    });
  });

  describe("Edge cases", () => {
    it("should handle DST transition correctly (EST to EDT)", () => {
      // In November when clocks fall back: 1:00 AM ET could be ambiguous
      // Nov 1, 2026 at 06:00 UTC = 1:00 AM EST (after fall back)
      const fallBack = new Date("2026-11-01T06:00:00Z");
      const result = getCurrentEasternTime(fallBack);
      expect(result.hour).toBe(1);
      expect(isWithinBusinessHours(fallBack)).toBe(false); // 1 AM is outside hours
    });

    it("should handle New Year's Day (still open, 7 days a week)", () => {
      // Jan 1, 2027 at 17:00 UTC = 12:00 PM EST
      const newYears = new Date("2027-01-01T17:00:00Z");
      expect(isWithinBusinessHours(newYears)).toBe(true);
    });
  });
});
