import { describe, expect, it } from "vitest";
import { evaluateConditionOperator } from "./services/workflowEngine";

// ═══════════════════════════════════════════
// Unit tests for evaluateConditionOperator
// ═══════════════════════════════════════════

describe("evaluateConditionOperator", () => {
  // ─── equals ───
  describe("equals", () => {
    it("returns true when values match (case-insensitive)", () => {
      expect(evaluateConditionOperator("New", "equals", "new")).toBe(true);
    });
    it("returns false when values differ", () => {
      expect(evaluateConditionOperator("contacted", "equals", "new")).toBe(false);
    });
    it("returns true for exact match", () => {
      expect(evaluateConditionOperator("hello", "equals", "hello")).toBe(true);
    });
  });

  // ─── not_equals ───
  describe("not_equals", () => {
    it("returns true when values differ", () => {
      expect(evaluateConditionOperator("contacted", "not_equals", "new")).toBe(true);
    });
    it("returns false when values match (case-insensitive)", () => {
      expect(evaluateConditionOperator("New", "not_equals", "new")).toBe(false);
    });
  });

  // ─── contains ───
  describe("contains", () => {
    it("returns true when field contains the value", () => {
      expect(evaluateConditionOperator("hot-lead,vip", "contains", "hot-lead")).toBe(true);
    });
    it("returns false when field does not contain the value", () => {
      expect(evaluateConditionOperator("cold-lead", "contains", "hot-lead")).toBe(false);
    });
    it("is case-insensitive", () => {
      expect(evaluateConditionOperator("Hot-Lead", "contains", "hot-lead")).toBe(true);
    });
  });

  // ─── not_contains ───
  describe("not_contains", () => {
    it("returns true when field does not contain the value", () => {
      expect(evaluateConditionOperator("cold-lead", "not_contains", "hot-lead")).toBe(true);
    });
    it("returns false when field contains the value", () => {
      expect(evaluateConditionOperator("hot-lead,vip", "not_contains", "hot-lead")).toBe(false);
    });
  });

  // ─── greater_than ───
  describe("greater_than", () => {
    it("compares numbers correctly (true)", () => {
      expect(evaluateConditionOperator("100", "greater_than", "50")).toBe(true);
    });
    it("compares numbers correctly (false)", () => {
      expect(evaluateConditionOperator("10", "greater_than", "50")).toBe(false);
    });
    it("falls back to lexicographic for non-numeric", () => {
      expect(evaluateConditionOperator("b", "greater_than", "a")).toBe(true);
    });
  });

  // ─── less_than ───
  describe("less_than", () => {
    it("compares numbers correctly (true)", () => {
      expect(evaluateConditionOperator("10", "less_than", "50")).toBe(true);
    });
    it("compares numbers correctly (false)", () => {
      expect(evaluateConditionOperator("100", "less_than", "50")).toBe(false);
    });
  });

  // ─── is_empty ───
  describe("is_empty", () => {
    it("returns true for empty string", () => {
      expect(evaluateConditionOperator("", "is_empty", "")).toBe(true);
    });
    it("returns true for whitespace-only string", () => {
      expect(evaluateConditionOperator("   ", "is_empty", "")).toBe(true);
    });
    it("returns false for non-empty string", () => {
      expect(evaluateConditionOperator("hello", "is_empty", "")).toBe(false);
    });
  });

  // ─── is_not_empty ───
  describe("is_not_empty", () => {
    it("returns true for non-empty string", () => {
      expect(evaluateConditionOperator("hello", "is_not_empty", "")).toBe(true);
    });
    it("returns false for empty string", () => {
      expect(evaluateConditionOperator("", "is_not_empty", "")).toBe(false);
    });
  });

  // ─── starts_with ───
  describe("starts_with", () => {
    it("returns true when field starts with value", () => {
      expect(evaluateConditionOperator("facebook_ad", "starts_with", "facebook")).toBe(true);
    });
    it("returns false when field does not start with value", () => {
      expect(evaluateConditionOperator("google_ad", "starts_with", "facebook")).toBe(false);
    });
    it("is case-insensitive", () => {
      expect(evaluateConditionOperator("Facebook_Ad", "starts_with", "facebook")).toBe(true);
    });
  });

  // ─── ends_with ───
  describe("ends_with", () => {
    it("returns true when field ends with value", () => {
      expect(evaluateConditionOperator("john@gmail.com", "ends_with", "gmail.com")).toBe(true);
    });
    it("returns false when field does not end with value", () => {
      expect(evaluateConditionOperator("john@yahoo.com", "ends_with", "gmail.com")).toBe(false);
    });
  });

  // ─── unknown operator ───
  describe("unknown operator", () => {
    it("returns false for unknown operator", () => {
      expect(evaluateConditionOperator("test", "unknown_op", "test")).toBe(false);
    });
  });

  // ─── edge cases ───
  describe("edge cases", () => {
    it("handles null-like fieldValue gracefully", () => {
      // evaluateConditionOperator receives strings, but test empty
      expect(evaluateConditionOperator("", "equals", "")).toBe(true);
    });
    it("equals with different casing", () => {
      expect(evaluateConditionOperator("QUALIFIED", "equals", "qualified")).toBe(true);
    });
    it("contains with partial match", () => {
      expect(evaluateConditionOperator("hot-lead,warm-lead,cold-lead", "contains", "warm")).toBe(true);
    });
    it("greater_than with equal values returns false", () => {
      expect(evaluateConditionOperator("50", "greater_than", "50")).toBe(false);
    });
    it("less_than with equal values returns false", () => {
      expect(evaluateConditionOperator("50", "less_than", "50")).toBe(false);
    });
  });
});
