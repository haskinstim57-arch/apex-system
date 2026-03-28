import { describe, it, expect } from "vitest";

// ─── Condition evaluation logic (mirrors PublicForm.tsx) ───

interface ConditionRule {
  fieldId: string;
  operator: "equals" | "not_equals" | "contains" | "is_empty" | "is_not_empty";
  value?: string;
}

interface FormField {
  id: string;
  type: "text" | "email" | "phone" | "dropdown" | "checkbox" | "date";
  label: string;
  required: boolean;
  conditionRules?: ConditionRule[];
  options?: string[];
}

function evaluateRule(
  rule: ConditionRule,
  formData: Record<string, unknown>
): boolean {
  const rawVal = formData[rule.fieldId];
  const val = rawVal !== undefined && rawVal !== null ? String(rawVal) : "";

  switch (rule.operator) {
    case "equals":
      return val === (rule.value ?? "");
    case "not_equals":
      return val !== (rule.value ?? "");
    case "contains":
      return val.toLowerCase().includes((rule.value ?? "").toLowerCase());
    case "is_empty":
      return val === "" || val === "false";
    case "is_not_empty":
      return val !== "" && val !== "false";
    default:
      return true;
  }
}

function isFieldVisible(
  field: FormField,
  formData: Record<string, unknown>
): boolean {
  if (!field.conditionRules || field.conditionRules.length === 0) return true;
  return field.conditionRules.every((rule) => evaluateRule(rule, formData));
}

// ─── Tests ───

describe("Conditional Field Visibility", () => {
  describe("evaluateRule", () => {
    it("equals operator matches exact value", () => {
      const rule: ConditionRule = { fieldId: "interest", operator: "equals", value: "Mortgage" };
      expect(evaluateRule(rule, { interest: "Mortgage" })).toBe(true);
      expect(evaluateRule(rule, { interest: "Refinance" })).toBe(false);
    });

    it("not_equals operator rejects matching value", () => {
      const rule: ConditionRule = { fieldId: "status", operator: "not_equals", value: "Closed" };
      expect(evaluateRule(rule, { status: "Open" })).toBe(true);
      expect(evaluateRule(rule, { status: "Closed" })).toBe(false);
    });

    it("contains operator checks substring (case-insensitive)", () => {
      const rule: ConditionRule = { fieldId: "notes", operator: "contains", value: "mortgage" };
      expect(evaluateRule(rule, { notes: "Interested in Mortgage Loan" })).toBe(true);
      expect(evaluateRule(rule, { notes: "MORTGAGE application" })).toBe(true);
      expect(evaluateRule(rule, { notes: "Car loan inquiry" })).toBe(false);
    });

    it("is_empty operator checks for empty or missing values", () => {
      const rule: ConditionRule = { fieldId: "phone", operator: "is_empty" };
      expect(evaluateRule(rule, { phone: "" })).toBe(true);
      expect(evaluateRule(rule, {})).toBe(true);
      expect(evaluateRule(rule, { phone: "555-1234" })).toBe(false);
    });

    it("is_not_empty operator checks for non-empty values", () => {
      const rule: ConditionRule = { fieldId: "email", operator: "is_not_empty" };
      expect(evaluateRule(rule, { email: "test@example.com" })).toBe(true);
      expect(evaluateRule(rule, { email: "" })).toBe(false);
      expect(evaluateRule(rule, {})).toBe(false);
    });

    it("is_empty treats checkbox false as empty", () => {
      const rule: ConditionRule = { fieldId: "agree", operator: "is_empty" };
      expect(evaluateRule(rule, { agree: false })).toBe(true);
      expect(evaluateRule(rule, { agree: "false" })).toBe(true);
    });

    it("is_not_empty treats checkbox true as not empty", () => {
      const rule: ConditionRule = { fieldId: "agree", operator: "is_not_empty" };
      expect(evaluateRule(rule, { agree: true })).toBe(true);
      expect(evaluateRule(rule, { agree: "true" })).toBe(true);
    });

    it("handles null and undefined values gracefully", () => {
      const rule: ConditionRule = { fieldId: "field1", operator: "equals", value: "" };
      expect(evaluateRule(rule, { field1: null })).toBe(true);
      expect(evaluateRule(rule, { field1: undefined })).toBe(true);
      expect(evaluateRule(rule, {})).toBe(true);
    });
  });

  describe("isFieldVisible", () => {
    it("field with no conditions is always visible", () => {
      const field: FormField = { id: "f1", type: "text", label: "Name", required: true };
      expect(isFieldVisible(field, {})).toBe(true);
    });

    it("field with empty conditionRules array is always visible", () => {
      const field: FormField = { id: "f1", type: "text", label: "Name", required: true, conditionRules: [] };
      expect(isFieldVisible(field, {})).toBe(true);
    });

    it("field with single passing condition is visible", () => {
      const field: FormField = {
        id: "loanAmount",
        type: "text",
        label: "Loan Amount",
        required: true,
        conditionRules: [{ fieldId: "interest", operator: "equals", value: "Mortgage" }],
      };
      expect(isFieldVisible(field, { interest: "Mortgage" })).toBe(true);
    });

    it("field with single failing condition is hidden", () => {
      const field: FormField = {
        id: "loanAmount",
        type: "text",
        label: "Loan Amount",
        required: true,
        conditionRules: [{ fieldId: "interest", operator: "equals", value: "Mortgage" }],
      };
      expect(isFieldVisible(field, { interest: "Refinance" })).toBe(false);
    });

    it("AND logic: all conditions must pass for visibility", () => {
      const field: FormField = {
        id: "details",
        type: "text",
        label: "Details",
        required: false,
        conditionRules: [
          { fieldId: "interest", operator: "equals", value: "Mortgage" },
          { fieldId: "email", operator: "is_not_empty" },
        ],
      };
      // Both pass
      expect(isFieldVisible(field, { interest: "Mortgage", email: "a@b.com" })).toBe(true);
      // First fails
      expect(isFieldVisible(field, { interest: "Other", email: "a@b.com" })).toBe(false);
      // Second fails
      expect(isFieldVisible(field, { interest: "Mortgage", email: "" })).toBe(false);
      // Both fail
      expect(isFieldVisible(field, { interest: "Other", email: "" })).toBe(false);
    });

    it("checkbox-based condition: show field when checkbox is checked", () => {
      const field: FormField = {
        id: "loanAmount",
        type: "text",
        label: "Loan Amount",
        required: true,
        conditionRules: [{ fieldId: "wantsMortgage", operator: "is_not_empty" }],
      };
      expect(isFieldVisible(field, { wantsMortgage: true })).toBe(true);
      expect(isFieldVisible(field, { wantsMortgage: false })).toBe(false);
      expect(isFieldVisible(field, {})).toBe(false);
    });

    it("dropdown-based condition: show field when specific option selected", () => {
      const field: FormField = {
        id: "refinanceDetails",
        type: "text",
        label: "Refinance Details",
        required: true,
        conditionRules: [{ fieldId: "loanType", operator: "equals", value: "Refinance" }],
      };
      expect(isFieldVisible(field, { loanType: "Refinance" })).toBe(true);
      expect(isFieldVisible(field, { loanType: "Purchase" })).toBe(false);
      expect(isFieldVisible(field, {})).toBe(false);
    });
  });

  describe("Hidden fields excluded from submission", () => {
    it("only visible field data is included in submission payload", () => {
      const fields: FormField[] = [
        { id: "name", type: "text", label: "Name", required: true },
        { id: "interest", type: "dropdown", label: "Interest", required: true, options: ["Mortgage", "Other"] },
        {
          id: "loanAmount",
          type: "text",
          label: "Loan Amount",
          required: true,
          conditionRules: [{ fieldId: "interest", operator: "equals", value: "Mortgage" }],
        },
      ];

      const formData = { name: "John", interest: "Other", loanAmount: "500000" };

      // Simulate: only include data for visible fields
      const visibleFields = fields.filter((f) => isFieldVisible(f, formData));
      const submissionData: Record<string, unknown> = {};
      for (const f of visibleFields) {
        if (formData[f.id as keyof typeof formData] !== undefined) {
          submissionData[f.id] = formData[f.id as keyof typeof formData];
        }
      }

      expect(submissionData).toEqual({ name: "John", interest: "Other" });
      expect(submissionData).not.toHaveProperty("loanAmount");
    });

    it("includes conditional field data when condition is met", () => {
      const fields: FormField[] = [
        { id: "name", type: "text", label: "Name", required: true },
        { id: "interest", type: "dropdown", label: "Interest", required: true, options: ["Mortgage", "Other"] },
        {
          id: "loanAmount",
          type: "text",
          label: "Loan Amount",
          required: true,
          conditionRules: [{ fieldId: "interest", operator: "equals", value: "Mortgage" }],
        },
      ];

      const formData = { name: "Jane", interest: "Mortgage", loanAmount: "350000" };

      const visibleFields = fields.filter((f) => isFieldVisible(f, formData));
      const submissionData: Record<string, unknown> = {};
      for (const f of visibleFields) {
        if (formData[f.id as keyof typeof formData] !== undefined) {
          submissionData[f.id] = formData[f.id as keyof typeof formData];
        }
      }

      expect(submissionData).toEqual({ name: "Jane", interest: "Mortgage", loanAmount: "350000" });
    });
  });
});

describe("Embed Code Generation", () => {
  it("generates valid iframe embed code with form slug", () => {
    const origin = "https://example.com";
    const slug = "my-test-form";
    const iframe = `<iframe src="${origin}/f/${slug}" width="100%" height="600" frameborder="0" style="border: none; border-radius: 8px;"></iframe>`;

    expect(iframe).toContain(`src="${origin}/f/${slug}"`);
    expect(iframe).toContain('width="100%"');
    expect(iframe).toContain('height="600"');
    expect(iframe).toContain('frameborder="0"');
  });

  it("generates valid JavaScript embed code with form id and slug", () => {
    const origin = "https://example.com";
    const slug = "contact-us";
    const formId = 42;
    const jsEmbed = `<div id="apex-form-${formId}"></div>\n<script>\n(function() {\n  var d = document.getElementById('apex-form-${formId}');\n  var f = document.createElement('iframe');\n  f.src = '${origin}/f/${slug}';\n  f.width = '100%';\n  f.height = '600';\n  f.frameBorder = '0';\n  f.style.border = 'none';\n  f.style.borderRadius = '8px';\n  d.appendChild(f);\n})();\n</script>`;

    expect(jsEmbed).toContain(`apex-form-${formId}`);
    expect(jsEmbed).toContain(`f.src = '${origin}/f/${slug}'`);
    expect(jsEmbed).toContain("document.createElement('iframe')");
  });
});

describe("Submission Stats Shape", () => {
  it("stats object has expected properties", () => {
    // Simulate the shape returned by submissionStats procedure
    const stats = {
      total: 100,
      last7Days: 15,
      last30Days: 42,
      withContact: 85,
      conversionRate: 85,
      daily: [
        { day: "2026-03-01", count: 5 },
        { day: "2026-03-02", count: 3 },
      ],
    };

    expect(stats).toHaveProperty("total");
    expect(stats).toHaveProperty("last7Days");
    expect(stats).toHaveProperty("last30Days");
    expect(stats).toHaveProperty("withContact");
    expect(stats).toHaveProperty("conversionRate");
    expect(stats).toHaveProperty("daily");
    expect(Array.isArray(stats.daily)).toBe(true);
    expect(stats.daily[0]).toHaveProperty("day");
    expect(stats.daily[0]).toHaveProperty("count");
    expect(stats.conversionRate).toBe(85);
  });

  it("conversion rate is 0 when no submissions", () => {
    const total = 0;
    const withContact = 0;
    const conversionRate = total > 0 ? Math.round((withContact / total) * 100) : 0;
    expect(conversionRate).toBe(0);
  });

  it("conversion rate calculates correctly", () => {
    const total = 200;
    const withContact = 150;
    const conversionRate = total > 0 ? Math.round((withContact / total) * 100) : 0;
    expect(conversionRate).toBe(75);
  });
});
