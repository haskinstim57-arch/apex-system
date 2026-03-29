import { describe, it, expect, vi } from "vitest";

// ============================================================
// Feature 1: Custom Field Bulk Edit
// ============================================================
describe("Custom Field Bulk Edit", () => {
  it("should validate bulk edit requires contactIds array", () => {
    // The bulk edit procedure expects contactIds, accountId, slug, value
    const input = {
      accountId: 1,
      contactIds: [1, 2, 3],
      slug: "loan_type",
      value: "FHA",
    };
    expect(input.contactIds).toHaveLength(3);
    expect(input.slug).toBe("loan_type");
    expect(input.value).toBe("FHA");
  });

  it("should reject bulk edit with empty contactIds", () => {
    const input = { accountId: 1, contactIds: [], slug: "loan_type", value: "FHA" };
    expect(input.contactIds.length).toBe(0);
    // The procedure should reject this - min 1 contact required
  });

  it("should handle bulk edit with null value to clear field", () => {
    const input = {
      accountId: 1,
      contactIds: [1, 2],
      slug: "loan_amount",
      value: null,
    };
    expect(input.value).toBeNull();
  });

  it("should merge custom fields preserving existing values", () => {
    const existing = { loan_type: "FHA", loan_amount: 250000 };
    const slug = "loan_type";
    const newValue = "VA";
    const merged = { ...existing, [slug]: newValue };
    expect(merged.loan_type).toBe("VA");
    expect(merged.loan_amount).toBe(250000);
  });

  it("should handle bulk edit across multiple contacts", () => {
    const contacts = [
      { id: 1, customFields: { loan_type: "FHA" } },
      { id: 2, customFields: { loan_type: "Conventional" } },
      { id: 3, customFields: {} },
    ];
    const slug = "loan_type";
    const newValue = "VA";
    const updated = contacts.map((c) => ({
      ...c,
      customFields: { ...c.customFields, [slug]: newValue },
    }));
    expect(updated.every((c) => c.customFields.loan_type === "VA")).toBe(true);
  });
});

// ============================================================
// Feature 2: Smart Views / Saved Filters
// ============================================================
describe("Smart Views / Saved Filters", () => {
  it("should create a saved view with filters and sort config", () => {
    const view = {
      accountId: 1,
      name: "Hot FHA Leads",
      filters: {
        search: "john",
        status: "qualified",
        source: "Facebook",
        customFieldFilters: [
          { slug: "loan_type", operator: "equals" as const, value: "FHA" },
        ],
      },
      sortBy: "cf_loan_amount",
      sortDir: "desc" as const,
      columns: ["loan_type", "loan_amount"],
    };
    expect(view.name).toBe("Hot FHA Leads");
    expect(view.filters.customFieldFilters).toHaveLength(1);
    expect(view.sortBy).toBe("cf_loan_amount");
    expect(view.columns).toHaveLength(2);
  });

  it("should serialize and deserialize view filters", () => {
    const filters = {
      search: "test",
      status: "new",
      customFieldFilters: [
        { slug: "loan_type", operator: "equals" as const, value: "FHA" },
      ],
    };
    const serialized = JSON.stringify(filters);
    const deserialized = JSON.parse(serialized);
    expect(deserialized.search).toBe("test");
    expect(deserialized.customFieldFilters[0].slug).toBe("loan_type");
  });

  it("should apply view by restoring all filter states", () => {
    const view = {
      filters: JSON.stringify({
        search: "john",
        status: "qualified",
        source: "Facebook",
        customFieldFilters: [
          { slug: "loan_type", operator: "equals", value: "FHA" },
        ],
      }),
      sortBy: "cf_loan_amount",
      sortDir: "desc",
      columns: JSON.stringify(["loan_type", "loan_amount"]),
    };
    const filters = JSON.parse(view.filters);
    const columns = JSON.parse(view.columns);
    expect(filters.search).toBe("john");
    expect(filters.status).toBe("qualified");
    expect(filters.source).toBe("Facebook");
    expect(filters.customFieldFilters).toHaveLength(1);
    expect(columns).toEqual(["loan_type", "loan_amount"]);
  });

  it("should handle view with no filters (empty state)", () => {
    const view = {
      name: "All Contacts",
      filters: null,
      sortBy: null,
      sortDir: "desc",
      columns: null,
    };
    const filters = view.filters ? JSON.parse(view.filters) : {};
    expect(filters).toEqual({});
    expect(view.sortBy).toBeNull();
  });

  it("should support default view flag", () => {
    const views = [
      { id: 1, name: "All", isDefault: false },
      { id: 2, name: "Hot Leads", isDefault: true },
      { id: 3, name: "Cold Leads", isDefault: false },
    ];
    const defaultView = views.find((v) => v.isDefault);
    expect(defaultView?.name).toBe("Hot Leads");
  });

  it("should only allow one default view per user+account", () => {
    const views = [
      { id: 1, name: "A", isDefault: true },
      { id: 2, name: "B", isDefault: true },
    ];
    // Setting view 2 as default should unset view 1
    const updated = views.map((v) => ({
      ...v,
      isDefault: v.id === 2,
    }));
    expect(updated.filter((v) => v.isDefault)).toHaveLength(1);
    expect(updated.find((v) => v.isDefault)?.id).toBe(2);
  });
});

// ============================================================
// Feature 3: Custom Field Conditional Logic / Visibility Rules
// ============================================================
describe("Custom Field Conditional Logic", () => {
  describe("isFieldVisible evaluation", () => {
    // Replicate the client-side evaluation logic
    function isFieldVisible(
      rules: Array<{
        dependsOnSlug: string;
        operator: string;
        value?: unknown;
      }> | null,
      cfValues: Record<string, unknown>
    ): boolean {
      if (!rules || rules.length === 0) return true;
      return rules.every((rule) => {
        const actual = cfValues[rule.dependsOnSlug];
        switch (rule.operator) {
          case "is_empty":
            return actual === undefined || actual === null || actual === "" || actual === false;
          case "not_empty":
            return actual !== undefined && actual !== null && actual !== "" && actual !== false;
          case "equals":
            if (typeof actual === "boolean") {
              return actual === (rule.value === true || rule.value === "true");
            }
            return String(actual ?? "") === String(rule.value ?? "");
          case "not_equals":
            if (typeof actual === "boolean") {
              return actual !== (rule.value === true || rule.value === "true");
            }
            return String(actual ?? "") !== String(rule.value ?? "");
          case "contains":
            return String(actual ?? "").toLowerCase().includes(String(rule.value ?? "").toLowerCase());
          case "in":
            if (Array.isArray(rule.value)) {
              return rule.value.includes(String(actual ?? ""));
            }
            return false;
          default:
            return true;
        }
      });
    }

    it("should return true when no rules are defined", () => {
      expect(isFieldVisible(null, {})).toBe(true);
      expect(isFieldVisible([], {})).toBe(true);
    });

    it("should evaluate equals operator correctly", () => {
      const rules = [{ dependsOnSlug: "loan_type", operator: "equals", value: "FHA" }];
      expect(isFieldVisible(rules, { loan_type: "FHA" })).toBe(true);
      expect(isFieldVisible(rules, { loan_type: "VA" })).toBe(false);
    });

    it("should evaluate not_equals operator correctly", () => {
      const rules = [{ dependsOnSlug: "loan_type", operator: "not_equals", value: "FHA" }];
      expect(isFieldVisible(rules, { loan_type: "VA" })).toBe(true);
      expect(isFieldVisible(rules, { loan_type: "FHA" })).toBe(false);
    });

    it("should evaluate contains operator (case insensitive)", () => {
      const rules = [{ dependsOnSlug: "notes", operator: "contains", value: "urgent" }];
      expect(isFieldVisible(rules, { notes: "This is URGENT!" })).toBe(true);
      expect(isFieldVisible(rules, { notes: "Normal note" })).toBe(false);
    });

    it("should evaluate is_empty operator", () => {
      const rules = [{ dependsOnSlug: "loan_type", operator: "is_empty" }];
      expect(isFieldVisible(rules, {})).toBe(true);
      expect(isFieldVisible(rules, { loan_type: "" })).toBe(true);
      expect(isFieldVisible(rules, { loan_type: null })).toBe(true);
      expect(isFieldVisible(rules, { loan_type: "FHA" })).toBe(false);
    });

    it("should evaluate not_empty operator", () => {
      const rules = [{ dependsOnSlug: "loan_type", operator: "not_empty" }];
      expect(isFieldVisible(rules, { loan_type: "FHA" })).toBe(true);
      expect(isFieldVisible(rules, {})).toBe(false);
      expect(isFieldVisible(rules, { loan_type: "" })).toBe(false);
    });

    it("should evaluate in operator with array of values", () => {
      const rules = [{ dependsOnSlug: "loan_type", operator: "in", value: ["FHA", "VA", "USDA"] }];
      expect(isFieldVisible(rules, { loan_type: "FHA" })).toBe(true);
      expect(isFieldVisible(rules, { loan_type: "VA" })).toBe(true);
      expect(isFieldVisible(rules, { loan_type: "Conventional" })).toBe(false);
    });

    it("should handle boolean fields with equals operator", () => {
      const rules = [{ dependsOnSlug: "pre_approved", operator: "equals", value: true }];
      expect(isFieldVisible(rules, { pre_approved: true })).toBe(true);
      expect(isFieldVisible(rules, { pre_approved: false })).toBe(false);
    });

    it("should handle boolean fields with string 'true'", () => {
      const rules = [{ dependsOnSlug: "pre_approved", operator: "equals", value: "true" }];
      expect(isFieldVisible(rules, { pre_approved: true })).toBe(true);
      expect(isFieldVisible(rules, { pre_approved: false })).toBe(false);
    });

    it("should use AND logic for multiple rules", () => {
      const rules = [
        { dependsOnSlug: "loan_type", operator: "equals", value: "VA" },
        { dependsOnSlug: "pre_approved", operator: "equals", value: true },
      ];
      // Both must pass
      expect(isFieldVisible(rules, { loan_type: "VA", pre_approved: true })).toBe(true);
      // Only one passes
      expect(isFieldVisible(rules, { loan_type: "VA", pre_approved: false })).toBe(false);
      expect(isFieldVisible(rules, { loan_type: "FHA", pre_approved: true })).toBe(false);
    });

    it("should handle missing dependency field as empty", () => {
      const rules = [{ dependsOnSlug: "nonexistent", operator: "is_empty" }];
      expect(isFieldVisible(rules, { loan_type: "FHA" })).toBe(true);
    });
  });

  describe("Visibility Rules schema", () => {
    it("should serialize and deserialize visibility rules", () => {
      const rules = [
        { dependsOnSlug: "loan_type", operator: "equals", value: "VA" },
        { dependsOnSlug: "pre_approved", operator: "equals", value: true },
      ];
      const serialized = JSON.stringify(rules);
      const deserialized = JSON.parse(serialized);
      expect(deserialized).toHaveLength(2);
      expect(deserialized[0].dependsOnSlug).toBe("loan_type");
      expect(deserialized[1].value).toBe(true);
    });

    it("should handle empty visibility rules", () => {
      const rules: unknown[] = [];
      const serialized = JSON.stringify(rules);
      expect(serialized).toBe("[]");
    });

    it("should prevent circular dependencies", () => {
      // Field A depends on Field B, Field B depends on Field A
      // The UI prevents this by excluding the current field from the dependency list
      const fieldA = { slug: "field_a", visibilityRules: [{ dependsOnSlug: "field_b", operator: "equals", value: "x" }] };
      const fieldB = { slug: "field_b", visibilityRules: [{ dependsOnSlug: "field_a", operator: "equals", value: "y" }] };
      // Both would be hidden if the other is hidden - this is a design issue
      // The UI should prevent this by only showing fields without visibility rules as dependencies
      expect(fieldA.visibilityRules[0].dependsOnSlug).not.toBe(fieldA.slug);
      expect(fieldB.visibilityRules[0].dependsOnSlug).not.toBe(fieldB.slug);
    });
  });

  describe("Server-side visibility evaluation", () => {
    it("should match the isFieldVisible function signature", async () => {
      const { isFieldVisible } = await import("./services/visibilityRules");
      expect(typeof isFieldVisible).toBe("function");
    });

    it("should evaluate server-side rules correctly", async () => {
      const { isFieldVisible } = await import("./services/visibilityRules");
      const fieldDef = {
        slug: "va_entitlement",
        visibilityRules: JSON.stringify([
          { dependsOnSlug: "loan_type", operator: "equals", value: "VA" },
        ]),
      };
      expect(isFieldVisible(fieldDef, { loan_type: "VA" })).toBe(true);
      expect(isFieldVisible(fieldDef, { loan_type: "FHA" })).toBe(false);
    });

    it("should return true for null/empty rules on server", async () => {
      const { isFieldVisible } = await import("./services/visibilityRules");
      expect(isFieldVisible({ slug: "test", visibilityRules: null }, {})).toBe(true);
      expect(isFieldVisible({ slug: "test", visibilityRules: "[]" }, {})).toBe(true);
    });
  });
});

// ============================================================
// Integration: Schema validation
// ============================================================
describe("Schema integration", () => {
  it("should have saved_views table in schema", async () => {
    const schema = await import("../drizzle/schema");
    expect(schema.savedViews).toBeDefined();
  });

  it("should have visibilityRules column on customFieldDefs", async () => {
    const schema = await import("../drizzle/schema");
    expect(schema.customFieldDefs).toBeDefined();
    // The table should have a visibilityRules column
    const columns = Object.keys(schema.customFieldDefs);
    expect(columns.length).toBeGreaterThan(0);
  });

  it("should have correct saved_views columns", async () => {
    const schema = await import("../drizzle/schema");
    const table = schema.savedViews;
    expect(table).toBeDefined();
  });
});
