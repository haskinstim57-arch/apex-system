import { describe, it, expect } from "vitest";
import { evaluateDateCondition } from "./services/dateTriggerCron";

// ═══════════════════════════════════════════
// Unit tests for evaluateDateCondition
// ═══════════════════════════════════════════

describe("evaluateDateCondition", () => {
  // ─── is_today ───
  describe("is_today", () => {
    it("returns true when field date is today", () => {
      const today = new Date();
      expect(evaluateDateCondition(today, "is_today")).toBe(true);
    });

    it("returns false when field date is yesterday", () => {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      expect(evaluateDateCondition(yesterday, "is_today")).toBe(false);
    });

    it("returns false when field date is tomorrow", () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      expect(evaluateDateCondition(tomorrow, "is_today")).toBe(false);
    });

    it("returns false when field value is null", () => {
      expect(evaluateDateCondition(null, "is_today")).toBe(false);
    });

    it("returns false when field value is undefined", () => {
      expect(evaluateDateCondition(undefined, "is_today")).toBe(false);
    });
  });

  // ─── days_before ───
  describe("days_before", () => {
    it("returns true when field date is exactly X days in the future", () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 7);
      expect(evaluateDateCondition(futureDate, "days_before", "7")).toBe(true);
    });

    it("returns false when field date is not exactly X days in the future", () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 5);
      expect(evaluateDateCondition(futureDate, "days_before", "7")).toBe(false);
    });

    it("returns false when value is 0", () => {
      const today = new Date();
      expect(evaluateDateCondition(today, "days_before", "0")).toBe(false);
    });

    it("returns false when value is negative", () => {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      expect(evaluateDateCondition(yesterday, "days_before", "-1")).toBe(false);
    });

    it("returns false when field value is null", () => {
      expect(evaluateDateCondition(null, "days_before", "7")).toBe(false);
    });
  });

  // ─── days_after ───
  describe("days_after", () => {
    it("returns true when field date was exactly X days ago", () => {
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 30);
      expect(evaluateDateCondition(pastDate, "days_after", "30")).toBe(true);
    });

    it("returns false when field date was not exactly X days ago", () => {
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 28);
      expect(evaluateDateCondition(pastDate, "days_after", "30")).toBe(false);
    });

    it("returns false when value is 0", () => {
      const today = new Date();
      expect(evaluateDateCondition(today, "days_after", "0")).toBe(false);
    });

    it("returns false when field value is null", () => {
      expect(evaluateDateCondition(null, "days_after", "30")).toBe(false);
    });
  });

  // ─── unknown operator ───
  describe("unknown operator", () => {
    it("returns false for unknown operator", () => {
      const today = new Date();
      expect(evaluateDateCondition(today, "unknown_op")).toBe(false);
    });
  });

  // ─── edge cases ───
  describe("edge cases", () => {
    it("handles 1 day before correctly", () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      expect(evaluateDateCondition(tomorrow, "days_before", "1")).toBe(true);
    });

    it("handles 1 day after correctly", () => {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      expect(evaluateDateCondition(yesterday, "days_after", "1")).toBe(true);
    });

    it("handles large day values", () => {
      const farFuture = new Date();
      farFuture.setDate(farFuture.getDate() + 365);
      expect(evaluateDateCondition(farFuture, "days_before", "365")).toBe(true);
    });

    it("handles non-numeric value for days_before", () => {
      const today = new Date();
      expect(evaluateDateCondition(today, "days_before", "abc")).toBe(false);
    });

    it("handles non-numeric value for days_after", () => {
      const today = new Date();
      expect(evaluateDateCondition(today, "days_after", "abc")).toBe(false);
    });
  });
});
