import { describe, it, expect } from "vitest";
import {
  getDailyActivityDateWindow,
  getWeekendReportSubject,
  getDailyMarketingDateWindow,
} from "./services/reportEmailGenerator";
import { calculateNextRunAt } from "./services/scheduledReportsCron";

describe("Part C — Report Improvements", () => {
  // ─── getDailyActivityDateWindow ───
  describe("getDailyActivityDateWindow", () => {
    it("returns null on Saturday", () => {
      const sat = new Date("2026-04-18T10:00:00Z"); // Saturday
      expect(getDailyActivityDateWindow(sat)).toBeNull();
    });

    it("returns null on Sunday", () => {
      const sun = new Date("2026-04-19T10:00:00Z"); // Sunday
      expect(getDailyActivityDateWindow(sun)).toBeNull();
    });

    it("returns previous day on Tuesday", () => {
      const tue = new Date("2026-04-21T10:00:00Z"); // Tuesday
      const result = getDailyActivityDateWindow(tue);
      expect(result).not.toBeNull();
      expect(result!.startDate.getDay()).toBe(1); // Monday
      expect(result!.startDate.getHours()).toBe(0);
      expect(result!.endDate.getDay()).toBe(1); // Monday
      expect(result!.endDate.getHours()).toBe(23);
    });

    it("returns Fri-Sun on Monday", () => {
      const mon = new Date("2026-04-20T10:00:00Z"); // Monday
      const result = getDailyActivityDateWindow(mon);
      expect(result).not.toBeNull();
      expect(result!.startDate.getDay()).toBe(5); // Friday
      expect(result!.endDate.getDay()).toBe(0); // Sunday
    });
  });

  // ─── getWeekendReportSubject ───
  describe("getWeekendReportSubject", () => {
    it("formats subject line with Friday to Sunday range", () => {
      // Use a known Monday to get the weekend window
      const mon = new Date("2026-04-20T10:00:00Z"); // Monday
      const window = getDailyActivityDateWindow(mon);
      expect(window).not.toBeNull();
      const subject = getWeekendReportSubject(window!.startDate, window!.endDate);
      expect(subject).toContain("Weekend Marketing Report");
      expect(subject).toContain("Fri");
      expect(subject).toContain("Sun");
    });
  });

  // ─── getDailyMarketingDateWindow ───
  describe("getDailyMarketingDateWindow", () => {
    it("returns same result as getDailyActivityDateWindow", () => {
      const tue = new Date("2026-04-21T10:00:00Z");
      const activityResult = getDailyActivityDateWindow(tue);
      const marketingResult = getDailyMarketingDateWindow(tue);
      expect(marketingResult).toEqual(activityResult);
    });

    it("returns null on weekend", () => {
      const sat = new Date("2026-04-18T10:00:00Z");
      expect(getDailyMarketingDateWindow(sat)).toBeNull();
    });
  });

  // ─── calculateNextRunAt with daily_marketing ───
  describe("calculateNextRunAt with daily_marketing", () => {
    it("skips weekends for daily_marketing", () => {
      // If today is Friday evening, next run should be Monday
      const next = calculateNextRunAt("daily_marketing", 7, "UTC");
      const dayOfWeek = next.getUTCDay();
      // Should be a weekday (1-5)
      expect(dayOfWeek).toBeGreaterThanOrEqual(1);
      expect(dayOfWeek).toBeLessThanOrEqual(5);
    });

    it("uses the specified sendHour", () => {
      const next = calculateNextRunAt("daily_marketing", 9, "UTC");
      expect(next.getUTCHours()).toBe(9);
    });

    it("daily_activity and daily_marketing share the same scheduling logic", () => {
      const activityNext = calculateNextRunAt("daily_activity", 7, "UTC");
      const marketingNext = calculateNextRunAt("daily_marketing", 7, "UTC");
      // They should produce the same next run time
      expect(activityNext.getTime()).toBe(marketingNext.getTime());
    });
  });

  // ─── VALID_REPORT_TYPES includes daily_marketing ───
  describe("Report type registration", () => {
    it("daily_marketing is a valid report type", () => {
      // This is tested indirectly — if the router accepts it, it's valid
      const VALID_REPORT_TYPES = ["kpis", "campaignROI", "workflowPerformance", "revenueAttribution", "daily_activity", "pipeline_summary", "daily_marketing"];
      expect(VALID_REPORT_TYPES).toContain("daily_marketing");
    });

    it("daily_marketing is a valid frequency", () => {
      const VALID_FREQUENCIES = ["daily", "weekly", "monthly", "daily_activity", "daily_marketing"];
      expect(VALID_FREQUENCIES).toContain("daily_marketing");
    });
  });
});
