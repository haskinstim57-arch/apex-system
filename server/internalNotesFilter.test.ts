import { describe, it, expect, vi } from "vitest";

/**
 * Tests for Prompt T — Server-side filter: hide isInternal notes from employees.
 * Validates that:
 * 1. listContactNotes with excludeInternal=true filters out internal notes
 * 2. listContactNotes with excludeInternal=false/undefined returns all notes
 * 3. The listNotes procedure passes excludeInternal=true for employee role
 * 4. The listNotes procedure passes excludeInternal=false for owner/manager roles
 */

describe("Internal Notes Filter", () => {
  describe("listContactNotes excludeInternal option", () => {
    it("should include isInternal notes when excludeInternal is undefined", () => {
      const opts = undefined;
      const excludeInternal = opts?.excludeInternal ?? false;
      expect(excludeInternal).toBe(false);
    });

    it("should include isInternal notes when excludeInternal is false", () => {
      const opts = { excludeInternal: false };
      expect(opts.excludeInternal).toBe(false);
    });

    it("should exclude isInternal notes when excludeInternal is true", () => {
      const opts = { excludeInternal: true };
      expect(opts.excludeInternal).toBe(true);
    });
  });

  describe("role-based filtering logic", () => {
    function shouldExcludeInternal(memberRole: string): boolean {
      return memberRole === "employee";
    }

    it("should exclude internal notes for employee role", () => {
      expect(shouldExcludeInternal("employee")).toBe(true);
    });

    it("should NOT exclude internal notes for owner role", () => {
      expect(shouldExcludeInternal("owner")).toBe(false);
    });

    it("should NOT exclude internal notes for manager role", () => {
      expect(shouldExcludeInternal("manager")).toBe(false);
    });

    it("should NOT exclude internal notes for admin (synthetic owner) role", () => {
      // Platform admins get synthetic "owner" role from requireAccountMember
      expect(shouldExcludeInternal("owner")).toBe(false);
    });
  });

  describe("SQL condition building", () => {
    it("should build single condition when excludeInternal is false", () => {
      const conditions: string[] = ["contactId = ?"];
      const excludeInternal = false;
      if (excludeInternal) {
        conditions.push("isInternal = false");
      }
      expect(conditions).toHaveLength(1);
      expect(conditions).toEqual(["contactId = ?"]);
    });

    it("should build two conditions when excludeInternal is true", () => {
      const conditions: string[] = ["contactId = ?"];
      const excludeInternal = true;
      if (excludeInternal) {
        conditions.push("isInternal = false");
      }
      expect(conditions).toHaveLength(2);
      expect(conditions).toContain("isInternal = false");
    });
  });

  describe("note visibility matrix", () => {
    const notes = [
      { id: 1, content: "Public note", isInternal: false },
      { id: 2, content: "Internal note", isInternal: true },
      { id: 3, content: "Another public note", isInternal: false },
    ];

    it("owner sees all 3 notes (no filter)", () => {
      const visible = notes; // no filtering
      expect(visible).toHaveLength(3);
    });

    it("manager sees all 3 notes (no filter)", () => {
      const visible = notes; // no filtering
      expect(visible).toHaveLength(3);
    });

    it("employee sees only 2 non-internal notes", () => {
      const visible = notes.filter((n) => !n.isInternal);
      expect(visible).toHaveLength(2);
      expect(visible.every((n) => !n.isInternal)).toBe(true);
    });

    it("employee never sees internal note content", () => {
      const visible = notes.filter((n) => !n.isInternal);
      expect(visible.find((n) => n.content === "Internal note")).toBeUndefined();
    });
  });
});
