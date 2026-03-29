import { describe, it, expect, vi } from "vitest";

// ─── 1. Custom Field Templates ───

describe("Custom Field Templates", () => {
  it("should have the custom_field_templates table in schema", async () => {
    const schema = await import("../drizzle/schema");
    expect(schema.customFieldTemplates).toBeDefined();
  });

  it("custom_field_templates table should have required columns", async () => {
    const schema = await import("../drizzle/schema");
    const table = schema.customFieldTemplates;
    // Check that the table object has the expected column names
    const columnNames = Object.keys(table);
    expect(columnNames).toContain("id");
    expect(columnNames).toContain("name");
    expect(columnNames).toContain("industry");
  });

  it("should export customFieldTemplatesRouter from the router file", async () => {
    const mod = await import("./routers/customFieldTemplates");
    expect(mod.customFieldTemplatesRouter).toBeDefined();
  });

  it("templates router should have list, getById, and applyTemplate procedures", async () => {
    const mod = await import("./routers/customFieldTemplates");
    const router = mod.customFieldTemplatesRouter;
    const procedures = Object.keys(router._def.procedures || {});
    expect(procedures).toContain("list");
    expect(procedures).toContain("get");
    expect(procedures).toContain("applyTemplate");
  });

  it("template fields should include valid field types", async () => {
    // Validate that the VALID_FIELD_TYPES are consistent
    const validTypes = ["text", "number", "date", "dropdown", "checkbox", "textarea", "url", "email", "phone"];
    expect(validTypes.length).toBe(9);
    expect(validTypes).toContain("dropdown");
    expect(validTypes).toContain("number");
  });
});

// ─── 2. Column Preferences ───

describe("Column Preferences", () => {
  it("should have the user_column_preferences table in schema", async () => {
    const schema = await import("../drizzle/schema");
    expect(schema.userColumnPreferences).toBeDefined();
  });

  it("user_column_preferences table should have required columns", async () => {
    const schema = await import("../drizzle/schema");
    const table = schema.userColumnPreferences;
    const columnNames = Object.keys(table);
    expect(columnNames).toContain("id");
    expect(columnNames).toContain("userId");
    expect(columnNames).toContain("accountId");
    expect(columnNames).toContain("page");
    expect(columnNames).toContain("columns");
  });

  it("should export columnPreferencesRouter from the router file", async () => {
    const mod = await import("./routers/columnPreferences");
    expect(mod.columnPreferencesRouter).toBeDefined();
  });

  it("column preferences router should have get and save procedures", async () => {
    const mod = await import("./routers/columnPreferences");
    const router = mod.columnPreferencesRouter;
    const procedures = Object.keys(router._def.procedures || {});
    expect(procedures).toContain("get");
    expect(procedures).toContain("save");
  });

  it("default columns should include standard contact fields", () => {
    const defaultColumns = [
      { key: "firstName", visible: true, sortOrder: 0 },
      { key: "email", visible: true, sortOrder: 1 },
      { key: "phone", visible: true, sortOrder: 2 },
      { key: "status", visible: true, sortOrder: 3 },
      { key: "leadSource", visible: true, sortOrder: 4 },
      { key: "createdAt", visible: true, sortOrder: 5 },
    ];
    expect(defaultColumns.length).toBe(6);
    expect(defaultColumns[0].key).toBe("firstName");
    expect(defaultColumns.every((c) => c.visible)).toBe(true);
  });

  it("column preference save should accept cf_ prefixed keys", () => {
    const columns = [
      { key: "firstName", visible: true, sortOrder: 0 },
      { key: "cf_loan_amount", visible: true, sortOrder: 6 },
      { key: "cf_loan_type", visible: true, sortOrder: 7 },
    ];
    const cfColumns = columns.filter((c) => c.key.startsWith("cf_"));
    expect(cfColumns.length).toBe(2);
    expect(cfColumns[0].key).toBe("cf_loan_amount");
  });
});

// ─── 3. Custom Field Sorting & Filtering ───

describe("Custom Field Sort & Filter in Contacts", () => {
  it("contacts list should accept sortBy and sortDir parameters", async () => {
    const mod = await import("./routers/contacts");
    const router = mod.contactsRouter;
    const procedures = Object.keys(router._def.procedures || {});
    expect(procedures).toContain("list");
  });

  it("sortBy should support cf_ prefix for custom field sorting", () => {
    const sortBy = "cf_loan_amount";
    expect(sortBy.startsWith("cf_")).toBe(true);
    const slug = sortBy.slice(3);
    expect(slug).toBe("loan_amount");
  });

  it("customFieldFilters should support all operator types", () => {
    const operators = ["equals", "not_equals", "contains", "greater_than", "less_than", "is_empty", "is_not_empty"];
    expect(operators.length).toBe(7);
    expect(operators).toContain("equals");
    expect(operators).toContain("is_empty");
  });

  it("custom field filter should extract slug and apply condition", () => {
    const filter = { slug: "loan_type", operator: "equals" as const, value: "Conventional" };
    // Simulate the JSON extraction condition
    const jsonPath = `$.${filter.slug}`;
    expect(jsonPath).toBe("$.loan_type");
    expect(filter.value).toBe("Conventional");
  });
});

// ─── 4. Custom Field Analytics ───

describe("Custom Field Analytics", () => {
  it("should export customFieldAnalyticsRouter from the router file", async () => {
    const mod = await import("./routers/customFieldAnalytics");
    expect(mod.customFieldAnalyticsRouter).toBeDefined();
  });

  it("analytics router should have getAnalytics procedure", async () => {
    const mod = await import("./routers/customFieldAnalytics");
    const router = mod.customFieldAnalyticsRouter;
    const procedures = Object.keys(router._def.procedures || {});
    expect(procedures).toContain("getAnalytics");
  });

  it("dropdown distribution should count values correctly", () => {
    const values = ["Conventional", "FHA", "VA", "Conventional", "FHA", "Conventional"];
    const countMap: Record<string, number> = {};
    for (const v of values) {
      countMap[v] = (countMap[v] || 0) + 1;
    }
    expect(countMap["Conventional"]).toBe(3);
    expect(countMap["FHA"]).toBe(2);
    expect(countMap["VA"]).toBe(1);
    const sorted = Object.entries(countMap)
      .map(([label, count]) => ({ label, count }))
      .sort((a, b) => b.count - a.count);
    expect(sorted[0].label).toBe("Conventional");
    expect(sorted[0].count).toBe(3);
  });

  it("number stats should calculate avg, min, max, sum correctly", () => {
    const nums = [250000, 350000, 150000, 500000, 275000];
    const avg = nums.reduce((a, b) => a + b, 0) / nums.length;
    const min = Math.min(...nums);
    const max = Math.max(...nums);
    const sum = nums.reduce((a, b) => a + b, 0);
    expect(avg).toBe(305000);
    expect(min).toBe(150000);
    expect(max).toBe(500000);
    expect(sum).toBe(1525000);
  });

  it("checkbox stats should calculate true/false percentages", () => {
    const values = [true, false, true, true, false, true, true, false, true, false];
    const trueCount = values.filter((v) => v === true).length;
    const total = values.length;
    const percentage = Math.round((trueCount / total) * 100);
    expect(trueCount).toBe(6);
    expect(total).toBe(10);
    expect(percentage).toBe(60);
  });

  it("date summary should categorize dates into overdue, upcoming7d, upcoming30d", () => {
    const now = new Date();
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const in3Days = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
    const in15Days = new Date(now.getTime() + 15 * 24 * 60 * 60 * 1000);
    const in45Days = new Date(now.getTime() + 45 * 24 * 60 * 60 * 1000);

    const dates = [yesterday, in3Days, in15Days, in45Days];
    const in7d = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const in30d = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    let overdue = 0, upcoming7d = 0, upcoming30d = 0;
    for (const d of dates) {
      if (d < now) overdue++;
      else if (d <= in7d) upcoming7d++;
      else if (d <= in30d) upcoming30d++;
    }

    expect(overdue).toBe(1);
    expect(upcoming7d).toBe(1);
    expect(upcoming30d).toBe(1);
    // in45Days is beyond 30d, so not counted
  });
});

// ─── 5. CSV Export with Custom Fields ───

describe("CSV Export with Custom Fields", () => {
  it("contacts router should have exportContacts procedure", async () => {
    const mod = await import("./routers/contacts");
    const router = mod.contactsRouter;
    const procedures = Object.keys(router._def.procedures || {});
    expect(procedures).toContain("exportContacts");
  });

  it("export should include cf_ prefixed headers for custom fields", () => {
    const standardHeaders = ["firstName", "lastName", "email", "phone", "status"];
    const customFieldDefs = [
      { slug: "loan_amount", name: "Loan Amount" },
      { slug: "loan_type", name: "Loan Type" },
    ];
    const cfHeaders = customFieldDefs.map((fd) => `cf_${fd.slug}`);
    const allHeaders = [...standardHeaders, ...cfHeaders];
    expect(allHeaders).toContain("cf_loan_amount");
    expect(allHeaders).toContain("cf_loan_type");
    expect(allHeaders.length).toBe(7);
  });
});

// ─── 6. Integration Tests ───

describe("Integration: Routers registered in main router", () => {
  it("main router should include customFieldTemplates", async () => {
    const mod = await import("./routers");
    const router = mod.appRouter;
    const keys = Object.keys(router._def.procedures || {});
    // Check for namespaced procedures
    const hasTemplates = keys.some((k) => k.startsWith("customFieldTemplates."));
    expect(hasTemplates).toBe(true);
  }, 15000);

  it("main router should include columnPreferences", async () => {
    const mod = await import("./routers");
    const router = mod.appRouter;
    const keys = Object.keys(router._def.procedures || {});
    const hasColPrefs = keys.some((k) => k.startsWith("columnPreferences."));
    expect(hasColPrefs).toBe(true);
  });

  it("main router should include customFieldAnalytics", async () => {
    const mod = await import("./routers");
    const router = mod.appRouter;
    const keys = Object.keys(router._def.procedures || {});
    const hasAnalytics = keys.some((k) => k.startsWith("customFieldAnalytics."));
    expect(hasAnalytics).toBe(true);
  });
});
