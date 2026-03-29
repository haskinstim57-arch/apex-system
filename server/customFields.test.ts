import { describe, it, expect } from "vitest";
import {
  validateCustomFields,
  type CustomFieldDefRecord,
} from "./routers/customFields";
import {
  evaluateCondition,
  evaluateAllConditions,
} from "./services/webhookDispatcher";

// ─── Test Fixtures ──────────────────────────────────────────

function makeDef(
  overrides: Partial<CustomFieldDefRecord> & { slug: string; type: string }
): CustomFieldDefRecord {
  return {
    id: 1,
    name: overrides.slug.replace(/_/g, " "),
    required: false,
    isActive: true,
    options: null,
    ...overrides,
  } as CustomFieldDefRecord;
}

// ─── validateCustomFields ───────────────────────────────────

describe("Custom Fields — validateCustomFields", () => {
  it("passes through a valid text field", () => {
    const defs = [makeDef({ slug: "company_name", type: "text" })];
    const result = validateCustomFields({ company_name: "Acme Inc" }, defs);
    expect(result.company_name).toBe("Acme Inc");
  });

  it("passes through a valid number field", () => {
    const defs = [makeDef({ slug: "loan_amount", type: "number" })];
    const result = validateCustomFields({ loan_amount: 250000 }, defs);
    expect(result.loan_amount).toBe(250000);
  });

  it("coerces string numbers to numeric values", () => {
    const defs = [makeDef({ slug: "loan_amount", type: "number" })];
    const result = validateCustomFields({ loan_amount: "350000" }, defs);
    expect(result.loan_amount).toBe(350000);
  });

  it("rejects non-numeric values for number fields", () => {
    const defs = [makeDef({ slug: "loan_amount", type: "number" })];
    expect(() =>
      validateCustomFields({ loan_amount: "not-a-number" }, defs)
    ).toThrow(/must be a number/);
  });

  it("validates date fields accept valid dates", () => {
    const defs = [makeDef({ slug: "close_date", type: "date" })];
    const result = validateCustomFields({ close_date: "2025-06-15" }, defs);
    expect(result.close_date).toBe("2025-06-15");
  });

  it("rejects invalid date strings", () => {
    const defs = [makeDef({ slug: "close_date", type: "date" })];
    expect(() =>
      validateCustomFields({ close_date: "not-a-date" }, defs)
    ).toThrow(/must be a valid date/);
  });

  it("validates dropdown fields against allowed options", () => {
    const defs = [
      makeDef({
        slug: "loan_type",
        type: "dropdown",
        options: JSON.stringify(["Conventional", "FHA", "VA", "USDA"]),
      }),
    ];
    const result = validateCustomFields({ loan_type: "FHA" }, defs);
    expect(result.loan_type).toBe("FHA");
  });

  it("rejects dropdown values not in options list", () => {
    const defs = [
      makeDef({
        slug: "loan_type",
        type: "dropdown",
        options: JSON.stringify(["Conventional", "FHA", "VA"]),
      }),
    ];
    expect(() =>
      validateCustomFields({ loan_type: "Jumbo" }, defs)
    ).toThrow(/must be one of/);
  });

  it("coerces checkbox values to boolean", () => {
    const defs = [makeDef({ slug: "pre_approved", type: "checkbox" })];
    expect(validateCustomFields({ pre_approved: "true" }, defs).pre_approved).toBe(true);
    expect(validateCustomFields({ pre_approved: true }, defs).pre_approved).toBe(true);
    expect(validateCustomFields({ pre_approved: "1" }, defs).pre_approved).toBe(true);
    expect(validateCustomFields({ pre_approved: 1 }, defs).pre_approved).toBe(true);
    expect(validateCustomFields({ pre_approved: "false" }, defs).pre_approved).toBe(false);
    expect(validateCustomFields({ pre_approved: false }, defs).pre_approved).toBe(false);
  });

  it("validates URL fields", () => {
    const defs = [makeDef({ slug: "website", type: "url" })];
    const result = validateCustomFields(
      { website: "https://example.com" },
      defs
    );
    expect(result.website).toBe("https://example.com");
  });

  it("rejects invalid URLs", () => {
    const defs = [makeDef({ slug: "website", type: "url" })];
    expect(() =>
      validateCustomFields({ website: "not-a-url" }, defs)
    ).toThrow(/must be a valid URL/);
  });

  it("validates email fields", () => {
    const defs = [makeDef({ slug: "alt_email", type: "email" })];
    const result = validateCustomFields(
      { alt_email: "test@example.com" },
      defs
    );
    expect(result.alt_email).toBe("test@example.com");
  });

  it("rejects invalid email addresses", () => {
    const defs = [makeDef({ slug: "alt_email", type: "email" })];
    expect(() =>
      validateCustomFields({ alt_email: "not-an-email" }, defs)
    ).toThrow(/must be a valid email/);
  });

  it("passes through phone fields as strings", () => {
    const defs = [makeDef({ slug: "cell", type: "phone" })];
    const result = validateCustomFields({ cell: "+1-555-0123" }, defs);
    expect(result.cell).toBe("+1-555-0123");
  });

  it("passes through textarea fields", () => {
    const defs = [makeDef({ slug: "notes", type: "textarea" })];
    const result = validateCustomFields(
      { notes: "Long text content here..." },
      defs
    );
    expect(result.notes).toBe("Long text content here...");
  });

  it("enforces required fields when requireAll is true", () => {
    const defs = [
      makeDef({ slug: "loan_amount", type: "number", required: true }),
    ];
    expect(() =>
      validateCustomFields({}, defs, { requireAll: true })
    ).toThrow(/is required/);
  });

  it("does not enforce required fields when requireAll is false", () => {
    const defs = [
      makeDef({ slug: "loan_amount", type: "number", required: true }),
    ];
    const result = validateCustomFields({}, defs, { requireAll: false });
    expect(result).toEqual({});
  });

  it("allows unknown fields to pass through (e.g. integration data)", () => {
    const defs = [makeDef({ slug: "loan_amount", type: "number" })];
    const result = validateCustomFields(
      { loan_amount: 100000, fb_lead_id: "abc123" },
      defs
    );
    expect(result.loan_amount).toBe(100000);
    expect(result.fb_lead_id).toBe("abc123");
  });

  it("sets empty values to null for non-required fields", () => {
    const defs = [makeDef({ slug: "notes", type: "text" })];
    const result = validateCustomFields({ notes: "" }, defs);
    expect(result.notes).toBeNull();
  });

  it("skips inactive field definitions", () => {
    const defs = [
      makeDef({
        slug: "old_field",
        type: "text",
        isActive: false,
        required: true,
      }),
    ];
    // Should not throw even though field is required, because it's inactive
    const result = validateCustomFields({}, defs, { requireAll: true });
    expect(result).toEqual({});
  });

  it("handles multiple fields simultaneously", () => {
    const defs = [
      makeDef({ slug: "loan_amount", type: "number" }),
      makeDef({
        slug: "loan_type",
        type: "dropdown",
        options: JSON.stringify(["FHA", "VA"]),
      }),
      makeDef({ slug: "pre_approved", type: "checkbox" }),
      makeDef({ slug: "close_date", type: "date" }),
    ];
    const result = validateCustomFields(
      {
        loan_amount: 200000,
        loan_type: "FHA",
        pre_approved: true,
        close_date: "2025-12-01",
      },
      defs
    );
    expect(result.loan_amount).toBe(200000);
    expect(result.loan_type).toBe("FHA");
    expect(result.pre_approved).toBe(true);
    expect(result.close_date).toBe("2025-12-01");
  });
});

// ─── Schema validation ──────────────────────────────────────

describe("Custom Fields — Schema", () => {
  it("customFieldDefs table is importable from schema", async () => {
    const schema = await import("../drizzle/schema");
    expect(schema.customFieldDefs).toBeDefined();
  });

  it("customFieldDefs has expected columns", async () => {
    const schema = await import("../drizzle/schema");
    const table = schema.customFieldDefs;
    // Check that the table object has the expected column properties
    expect(table.accountId).toBeDefined();
    expect(table.name).toBeDefined();
    expect(table.slug).toBeDefined();
    expect(table.type).toBeDefined();
    expect(table.options).toBeDefined();
    expect(table.required).toBeDefined();
    expect(table.sortOrder).toBeDefined();
    expect(table.isActive).toBeDefined();
  });
});

// ─── Webhook condition evaluation with custom fields ────────

describe("Custom Fields — Webhook Condition Evaluation (cf. prefix)", () => {
  it("resolves cf.slug_name from customFields in payload data", () => {
    const condition = {
      field: "cf.loan_amount",
      operator: "greater_than" as const,
      value: "100000",
    };
    const data = {
      customFields: { loan_amount: 250000 },
    };
    expect(evaluateCondition(condition, data)).toBe(true);
  });

  it("resolves cf. fields from stringified customFields", () => {
    const condition = {
      field: "cf.loan_type",
      operator: "equals" as const,
      value: "FHA",
    };
    const data = {
      customFields: JSON.stringify({ loan_type: "FHA" }),
    };
    expect(evaluateCondition(condition, data)).toBe(true);
  });

  it("returns false when cf. field does not exist", () => {
    const condition = {
      field: "cf.nonexistent",
      operator: "equals" as const,
      value: "something",
    };
    const data = {
      customFields: { loan_amount: 100000 },
    };
    expect(evaluateCondition(condition, data)).toBe(false);
  });

  it("evaluates cf. fields with contains operator", () => {
    const condition = {
      field: "cf.notes",
      operator: "contains" as const,
      value: "urgent",
    };
    const data = {
      customFields: { notes: "This is an urgent lead" },
    };
    expect(evaluateCondition(condition, data)).toBe(true);
  });

  it("evaluates cf. fields with in operator", () => {
    const condition = {
      field: "cf.loan_type",
      operator: "in" as const,
      value: "FHA,VA,USDA",
    };
    const data = {
      customFields: { loan_type: "VA" },
    };
    expect(evaluateCondition(condition, data)).toBe(true);
  });

  it("evaluates cf. checkbox fields", () => {
    const condition = {
      field: "cf.pre_approved",
      operator: "equals" as const,
      value: "true",
    };
    const data = {
      customFields: { pre_approved: true },
    };
    expect(evaluateCondition(condition, data)).toBe(true);
  });

  it("falls back to customFields when standard path not found", () => {
    const condition = {
      field: "loan_amount",
      operator: "equals" as const,
      value: "250000",
    };
    const data = {
      customFields: { loan_amount: 250000 },
    };
    expect(evaluateCondition(condition, data)).toBe(true);
  });
});

// ─── Workflow engine custom field resolution ────────────────

describe("Custom Fields — Workflow Engine Integration", () => {
  it("resolveContactFieldValue handles cf. prefix in workflowEngine", async () => {
    const { resolveContactFieldValue } = await import(
      "./services/workflowEngine"
    );
    const contact: Record<string, unknown> = {
      id: 1,
      firstName: "John",
      lastName: "Doe",
      email: "john@example.com",
      customFields: JSON.stringify({ loan_amount: 350000, loan_type: "FHA" }),
    };
    expect(await resolveContactFieldValue(contact, "cf.loan_amount", 1)).toBe("350000");
    expect(await resolveContactFieldValue(contact, "cf.loan_type", 1)).toBe("FHA");
  });

  it("resolveContactFieldValue returns empty string for missing cf. field", async () => {
    const { resolveContactFieldValue } = await import(
      "./services/workflowEngine"
    );
    const contact: Record<string, unknown> = {
      id: 1,
      firstName: "John",
      lastName: "Doe",
      customFields: JSON.stringify({ loan_amount: 100000 }),
    };
    expect(await resolveContactFieldValue(contact, "cf.nonexistent", 1)).toBe("");
  });

  it("resolveContactFieldValue handles null customFields", async () => {
    const { resolveContactFieldValue } = await import(
      "./services/workflowEngine"
    );
    const contact: Record<string, unknown> = {
      id: 1,
      firstName: "John",
      lastName: "Doe",
      customFields: null,
    };
    expect(await resolveContactFieldValue(contact, "cf.anything", 1)).toBe("");
  });
});

// ─── CSV Export integration ─────────────────────────────────

describe("Custom Fields — CSV Export Format", () => {
  it("custom field values can be serialized for CSV", () => {
    const customFields = {
      loan_amount: 250000,
      loan_type: "FHA",
      pre_approved: true,
      close_date: "2025-06-15",
    };

    // Simulate CSV export: each custom field becomes a column
    const row: Record<string, string> = {};
    for (const [key, value] of Object.entries(customFields)) {
      row[`cf_${key}`] = String(value);
    }

    expect(row.cf_loan_amount).toBe("250000");
    expect(row.cf_loan_type).toBe("FHA");
    expect(row.cf_pre_approved).toBe("true");
    expect(row.cf_close_date).toBe("2025-06-15");
  });

  it("null custom field values serialize as empty string", () => {
    const customFields = { loan_amount: null, notes: undefined };
    const row: Record<string, string> = {};
    for (const [key, value] of Object.entries(customFields)) {
      row[`cf_${key}`] = value != null ? String(value) : "";
    }
    expect(row.cf_loan_amount).toBe("");
    expect(row.cf_notes).toBe("");
  });
});
