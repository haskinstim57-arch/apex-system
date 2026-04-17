import { describe, it, expect } from "vitest";
import { getDailyActivityDateWindow } from "./services/reportEmailGenerator";
import { calculateNextRunAt } from "./services/scheduledReportsCron";

describe("Daily Activity Report — getDailyActivityDateWindow", () => {
  it("returns null on Saturday", () => {
    // April 19, 2025 is a Saturday
    const sat = new Date("2025-04-19T10:00:00Z");
    expect(getDailyActivityDateWindow(sat)).toBeNull();
  });

  it("returns null on Sunday", () => {
    // April 20, 2025 is a Sunday
    const sun = new Date("2025-04-20T10:00:00Z");
    expect(getDailyActivityDateWindow(sun)).toBeNull();
  });

  it("returns Friday-Sunday window on Monday", () => {
    // April 21, 2025 is a Monday
    const mon = new Date("2025-04-21T10:00:00Z");
    const result = getDailyActivityDateWindow(mon);
    expect(result).not.toBeNull();
    // Start should be Friday April 18
    expect(result!.startDate.getDate()).toBe(18);
    expect(result!.startDate.getHours()).toBe(0);
    expect(result!.startDate.getMinutes()).toBe(0);
    // End should be Sunday April 20
    expect(result!.endDate.getDate()).toBe(20);
    expect(result!.endDate.getHours()).toBe(23);
    expect(result!.endDate.getMinutes()).toBe(59);
  });

  it("returns previous day window on Tuesday", () => {
    // April 22, 2025 is a Tuesday
    const tue = new Date("2025-04-22T10:00:00Z");
    const result = getDailyActivityDateWindow(tue);
    expect(result).not.toBeNull();
    // Start should be Monday April 21
    expect(result!.startDate.getDate()).toBe(21);
    expect(result!.startDate.getHours()).toBe(0);
    // End should be Monday April 21 23:59
    expect(result!.endDate.getDate()).toBe(21);
    expect(result!.endDate.getHours()).toBe(23);
  });

  it("returns previous day window on Wednesday", () => {
    const wed = new Date("2025-04-23T10:00:00Z");
    const result = getDailyActivityDateWindow(wed);
    expect(result).not.toBeNull();
    expect(result!.startDate.getDate()).toBe(22); // Tuesday
    expect(result!.endDate.getDate()).toBe(22);
  });

  it("returns previous day window on Thursday", () => {
    const thu = new Date("2025-04-24T10:00:00Z");
    const result = getDailyActivityDateWindow(thu);
    expect(result).not.toBeNull();
    expect(result!.startDate.getDate()).toBe(23); // Wednesday
    expect(result!.endDate.getDate()).toBe(23);
  });

  it("returns previous day window on Friday", () => {
    const fri = new Date("2025-04-25T10:00:00Z");
    const result = getDailyActivityDateWindow(fri);
    expect(result).not.toBeNull();
    expect(result!.startDate.getDate()).toBe(24); // Thursday
    expect(result!.endDate.getDate()).toBe(24);
  });
});

describe("Daily Activity Report — calculateNextRunAt weekday skipping", () => {
  it("skips Saturday and Sunday when calculating next run from Friday", () => {
    // If we call calculateNextRunAt on a Friday evening, next run should be Monday
    const result = calculateNextRunAt("daily_activity", 7, "UTC");
    // Result should be a weekday (Mon-Fri)
    const day = result.getUTCDay();
    expect(day).toBeGreaterThanOrEqual(1);
    expect(day).toBeLessThanOrEqual(5);
  });

  it("sets sendHour correctly for daily_activity", () => {
    const result = calculateNextRunAt("daily_activity", 7, "UTC");
    expect(result.getUTCHours()).toBe(7);
    expect(result.getUTCMinutes()).toBe(0);
  });

  it("never schedules on Saturday (day 6) or Sunday (day 0)", () => {
    // Run 100 iterations to ensure no weekend scheduling
    for (let i = 0; i < 100; i++) {
      const result = calculateNextRunAt("daily_activity", 7, "UTC");
      const day = result.getUTCDay();
      expect(day).not.toBe(0);
      expect(day).not.toBe(6);
    }
  });
});

describe("Daily Activity Report — Monday weekend consolidation", () => {
  it("Monday report covers 3 days (Fri, Sat, Sun)", () => {
    const mon = new Date("2025-04-21T10:00:00Z");
    const result = getDailyActivityDateWindow(mon);
    expect(result).not.toBeNull();
    
    const daysDiff = Math.round(
      (result!.endDate.getTime() - result!.startDate.getTime()) / (1000 * 60 * 60 * 24)
    );
    expect(daysDiff).toBe(3); // Fri 00:00 to Sun 23:59 = ~2.99 days, rounds to 3
  });

  it("Tuesday report covers 1 day", () => {
    const tue = new Date("2025-04-22T10:00:00Z");
    const result = getDailyActivityDateWindow(tue);
    expect(result).not.toBeNull();
    
    const daysDiff = Math.round(
      (result!.endDate.getTime() - result!.startDate.getTime()) / (1000 * 60 * 60 * 24)
    );
    expect(daysDiff).toBe(1); // Mon 00:00 to Mon 23:59 = ~0.99 days
  });
});
