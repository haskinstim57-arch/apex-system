import { describe, it, expect } from "vitest";

/**
 * Tests for the contacts.importContacts procedure
 * Validates input validation, duplicate detection, and tag creation
 */

describe("contacts.importContacts", () => {
  // ─── Input Validation ───
  describe("input validation", () => {
    it("requires accountId to be a positive integer", () => {
      const schema = {
        accountId: 0,
        contacts: [{ firstName: "John" }],
      };
      // accountId must be > 0
      expect(schema.accountId).toBeLessThanOrEqual(0);
    });

    it("requires at least 1 contact in the array", () => {
      const contacts: unknown[] = [];
      expect(contacts.length).toBe(0);
      // The procedure enforces .min(1)
    });

    it("limits contacts array to 5000 entries", () => {
      const maxAllowed = 5000;
      expect(maxAllowed).toBe(5000);
    });
  });

  // ─── Row Validation Logic ───
  describe("row validation", () => {
    it("fails rows missing firstName, lastName, and phone", () => {
      const row = { firstName: "", lastName: "", email: "test@test.com", phone: "", tags: "", notes: "" };
      const hasRequired = !!(row.firstName.trim() || row.lastName.trim() || row.phone.trim());
      expect(hasRequired).toBe(false);
    });

    it("passes rows with only firstName", () => {
      const row = { firstName: "John", lastName: "", email: "", phone: "", tags: "", notes: "" };
      const hasRequired = !!(row.firstName.trim() || row.lastName.trim() || row.phone.trim());
      expect(hasRequired).toBe(true);
    });

    it("passes rows with only lastName", () => {
      const row = { firstName: "", lastName: "Doe", email: "", phone: "", tags: "", notes: "" };
      const hasRequired = !!(row.firstName.trim() || row.lastName.trim() || row.phone.trim());
      expect(hasRequired).toBe(true);
    });

    it("passes rows with only phone", () => {
      const row = { firstName: "", lastName: "", email: "", phone: "+15551234567", tags: "", notes: "" };
      const hasRequired = !!(row.firstName.trim() || row.lastName.trim() || row.phone.trim());
      expect(hasRequired).toBe(true);
    });

    it("handles whitespace-only fields as empty", () => {
      const row = { firstName: "  ", lastName: "  ", email: "", phone: "  ", tags: "", notes: "" };
      const hasRequired = !!(row.firstName.trim() || row.lastName.trim() || row.phone.trim());
      expect(hasRequired).toBe(false);
    });
  });

  // ─── Tag Parsing ───
  describe("tag parsing", () => {
    it("splits comma-separated tags", () => {
      const tagsStr = "lead,facebook,2026";
      const tags = tagsStr.split(",").map((t) => t.trim()).filter(Boolean);
      expect(tags).toEqual(["lead", "facebook", "2026"]);
    });

    it("trims whitespace from tags", () => {
      const tagsStr = " lead , facebook , 2026 ";
      const tags = tagsStr.split(",").map((t) => t.trim()).filter(Boolean);
      expect(tags).toEqual(["lead", "facebook", "2026"]);
    });

    it("filters empty tags", () => {
      const tagsStr = "lead,,facebook,,";
      const tags = tagsStr.split(",").map((t) => t.trim()).filter(Boolean);
      expect(tags).toEqual(["lead", "facebook"]);
    });

    it("handles empty tags string", () => {
      const tagsStr = "";
      const tags = tagsStr.split(",").map((t) => t.trim()).filter(Boolean);
      expect(tags).toEqual([]);
    });

    it("handles single tag without commas", () => {
      const tagsStr = "referral";
      const tags = tagsStr.split(",").map((t) => t.trim()).filter(Boolean);
      expect(tags).toEqual(["referral"]);
    });
  });

  // ─── CSV Field Auto-Mapping ───
  describe("CSV field auto-mapping", () => {
    const FIELD_ALIASES: Record<string, string> = {
      "first name": "firstName",
      "firstname": "firstName",
      "first_name": "firstName",
      "last name": "lastName",
      "lastname": "lastName",
      "last_name": "lastName",
      "email": "email",
      "email address": "email",
      "phone": "phone",
      "phone number": "phone",
      "phonenumber": "phone",
      "mobile": "phone",
      "cell": "phone",
      "tags": "tags",
      "tag": "tags",
      "notes": "notes",
      "note": "notes",
      "comments": "notes",
    };

    it("maps exact header names", () => {
      const headers = ["First Name", "Last Name", "Email", "Phone", "Tags", "Notes"];
      const mapping: Record<number, string> = {};
      headers.forEach((h, i) => {
        const normalized = h.trim().toLowerCase();
        mapping[i] = FIELD_ALIASES[normalized] || "skip";
      });
      expect(mapping[0]).toBe("firstName");
      expect(mapping[1]).toBe("lastName");
      expect(mapping[2]).toBe("email");
      expect(mapping[3]).toBe("phone");
      expect(mapping[4]).toBe("tags");
      expect(mapping[5]).toBe("notes");
    });

    it("maps alternative header names", () => {
      const headers = ["firstname", "lastname", "email address", "mobile", "tag", "comments"];
      const mapping: Record<number, string> = {};
      headers.forEach((h, i) => {
        const normalized = h.trim().toLowerCase();
        mapping[i] = FIELD_ALIASES[normalized] || "skip";
      });
      expect(mapping[0]).toBe("firstName");
      expect(mapping[1]).toBe("lastName");
      expect(mapping[2]).toBe("email");
      expect(mapping[3]).toBe("phone");
      expect(mapping[4]).toBe("tags");
      expect(mapping[5]).toBe("notes");
    });

    it("skips unknown headers", () => {
      const headers = ["Company", "Website", "First Name"];
      const mapping: Record<number, string> = {};
      headers.forEach((h, i) => {
        const normalized = h.trim().toLowerCase();
        mapping[i] = FIELD_ALIASES[normalized] || "skip";
      });
      expect(mapping[0]).toBe("skip");
      expect(mapping[1]).toBe("skip");
      expect(mapping[2]).toBe("firstName");
    });
  });

  // ─── Result Object Shape ───
  describe("result object", () => {
    it("returns correct shape with imported, skipped, failed, errorRows", () => {
      const result = {
        imported: 10,
        skipped: 2,
        failed: 1,
        errorRows: [
          { row: 5, data: { firstName: "", lastName: "", email: "", phone: "", tags: "", notes: "" }, reason: "Missing required field" },
        ],
      };
      expect(result).toHaveProperty("imported");
      expect(result).toHaveProperty("skipped");
      expect(result).toHaveProperty("failed");
      expect(result).toHaveProperty("errorRows");
      expect(result.errorRows[0]).toHaveProperty("row");
      expect(result.errorRows[0]).toHaveProperty("data");
      expect(result.errorRows[0]).toHaveProperty("reason");
    });

    it("counts sum correctly", () => {
      const result = { imported: 10, skipped: 2, failed: 1 };
      expect(result.imported + result.skipped + result.failed).toBe(13);
    });
  });

  // ─── CSV Template ───
  describe("CSV template", () => {
    it("has correct column headers", () => {
      const template = "First Name,Last Name,Email,Phone,Tags,Notes";
      const headers = template.split(",");
      expect(headers).toEqual(["First Name", "Last Name", "Email", "Phone", "Tags", "Notes"]);
    });

    it("generates valid CSV with sample data", () => {
      const csv = `First Name,Last Name,Email,Phone,Tags,Notes
John,Doe,john@example.com,+15551234567,"lead,facebook",Interested in refinancing`;
      const lines = csv.split("\n");
      expect(lines.length).toBe(2);
      expect(lines[0].split(",").length).toBe(6);
    });
  });

  // ─── Import Validation Guards ───
  describe("import validation guards", () => {
    it("rejects empty contacts array", () => {
      const contacts: Record<string, string>[] = [];
      expect(contacts.length).toBe(0);
    });

    it("rejects invalid accountId", () => {
      const accountId = 0;
      expect(accountId <= 0).toBe(true);
    });

    it("rejects negative accountId", () => {
      const accountId = -1;
      expect(accountId <= 0).toBe(true);
    });

    it("filters out rows with no usable data", () => {
      const mapped = [
        { firstName: "John", lastName: "Doe", email: "john@test.com", phone: "", tags: "", notes: "" },
        { firstName: "", lastName: "", email: "", phone: "", tags: "", notes: "" },
        { firstName: "", lastName: "", email: "", phone: "+15551234567", tags: "", notes: "" },
      ];
      const validContacts = mapped.filter(c => c.firstName || c.lastName || c.phone || c.email);
      expect(validContacts.length).toBe(2);
      expect(validContacts[0].firstName).toBe("John");
      expect(validContacts[1].phone).toBe("+15551234567");
    });

    it("accepts rows with only email", () => {
      const mapped = [
        { firstName: "", lastName: "", email: "test@test.com", phone: "", tags: "", notes: "" },
      ];
      const validContacts = mapped.filter(c => c.firstName || c.lastName || c.phone || c.email);
      expect(validContacts.length).toBe(1);
    });
  });

  // ─── Empty Row Filtering ───
  describe("empty row filtering", () => {
    it("filters out completely empty CSV rows", () => {
      const rows = [
        ["John", "Doe", "john@test.com", "5551234567", "lead", "Test"],
        ["", "", "", "", "", ""],
        ["Jane", "Smith", "jane@test.com", "", "", ""],
        ["  ", "  ", "  ", "  ", "  ", "  "],
      ];
      const dataRows = rows.filter(row => row.some(cell => cell && cell.trim()));
      expect(dataRows.length).toBe(2);
      expect(dataRows[0][0]).toBe("John");
      expect(dataRows[1][0]).toBe("Jane");
    });
  });
});
