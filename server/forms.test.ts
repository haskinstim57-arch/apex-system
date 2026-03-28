import { describe, expect, it } from "vitest";

// ═══════════════════════════════════════════
// Unit tests for Form Builder utilities
// Tests slug generation, field validation, and contact field mapping logic
// ═══════════════════════════════════════════

// ─── Slug generation logic (mirrors server/routers/forms.ts generateSlug) ───
function generateSlug(name: string): string {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 80) +
    "-" +
    Math.random().toString(36).slice(2, 8)
  );
}

describe("generateSlug", () => {
  it("converts name to lowercase kebab-case with random suffix", () => {
    const slug = generateSlug("Home Buyer Inquiry");
    expect(slug).toMatch(/^home-buyer-inquiry-[a-z0-9]+$/);
  });

  it("strips special characters", () => {
    const slug = generateSlug("Contact Us! (2024)");
    expect(slug).toMatch(/^contact-us-2024-[a-z0-9]+$/);
  });

  it("handles empty-ish names", () => {
    const slug = generateSlug("   ");
    // Should produce just the random suffix
    expect(slug).toMatch(/^-?[a-z0-9]+$/);
  });

  it("truncates long names to 80 chars before suffix", () => {
    const longName = "A".repeat(200);
    const slug = generateSlug(longName);
    const basePart = slug.split("-").slice(0, -1).join("-");
    expect(basePart.length).toBeLessThanOrEqual(80);
  });

  it("generates unique slugs for same name", () => {
    const slug1 = generateSlug("Test Form");
    const slug2 = generateSlug("Test Form");
    expect(slug1).not.toBe(slug2);
  });
});

// ─── Field validation logic ───
interface FormField {
  id: string;
  type: "text" | "email" | "phone" | "dropdown" | "checkbox" | "date";
  label: string;
  required: boolean;
  placeholder?: string;
  options?: string[];
  contactFieldMapping?: string;
}

function validateFormData(
  fields: FormField[],
  data: Record<string, unknown>
): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const field of fields) {
    const val = data[field.id];
    if (field.required && (val === undefined || val === "" || val === null)) {
      errors[field.id] = `${field.label} is required`;
    }
    if (field.type === "email" && val && typeof val === "string") {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val)) {
        errors[field.id] = "Please enter a valid email";
      }
    }
  }
  return errors;
}

describe("validateFormData", () => {
  const fields: FormField[] = [
    { id: "f1", type: "text", label: "Name", required: true },
    { id: "f2", type: "email", label: "Email", required: true },
    { id: "f3", type: "phone", label: "Phone", required: false },
    { id: "f4", type: "dropdown", label: "State", required: true, options: ["CA", "TX"] },
    { id: "f5", type: "checkbox", label: "Agree", required: false },
  ];

  it("returns no errors for valid complete data", () => {
    const data = { f1: "John", f2: "john@test.com", f3: "555-1234", f4: "CA", f5: true };
    expect(validateFormData(fields, data)).toEqual({});
  });

  it("returns error for missing required text field", () => {
    const data = { f2: "john@test.com", f4: "CA" };
    const errors = validateFormData(fields, data);
    expect(errors.f1).toBe("Name is required");
  });

  it("returns error for missing required email field", () => {
    const data = { f1: "John", f4: "CA" };
    const errors = validateFormData(fields, data);
    expect(errors.f2).toBe("Email is required");
  });

  it("returns error for invalid email format", () => {
    const data = { f1: "John", f2: "not-an-email", f4: "CA" };
    const errors = validateFormData(fields, data);
    expect(errors.f2).toBe("Please enter a valid email");
  });

  it("does not error on optional empty fields", () => {
    const data = { f1: "John", f2: "john@test.com", f4: "TX" };
    const errors = validateFormData(fields, data);
    expect(errors.f3).toBeUndefined();
    expect(errors.f5).toBeUndefined();
  });

  it("returns error for empty string on required field", () => {
    const data = { f1: "", f2: "john@test.com", f4: "CA" };
    const errors = validateFormData(fields, data);
    expect(errors.f1).toBe("Name is required");
  });

  it("returns error for null on required field", () => {
    const data = { f1: null, f2: "john@test.com", f4: "CA" };
    const errors = validateFormData(fields, data);
    expect(errors.f1).toBe("Name is required");
  });

  it("returns multiple errors at once", () => {
    const data = {};
    const errors = validateFormData(fields, data);
    expect(Object.keys(errors).length).toBe(3); // f1, f2, f4 are required
  });

  it("accepts valid email formats", () => {
    const data = { f1: "John", f2: "user+tag@sub.domain.com", f4: "CA" };
    const errors = validateFormData(fields, data);
    expect(errors.f2).toBeUndefined();
  });
});

// ─── Contact field mapping extraction ───
function extractContactFieldMappings(
  fields: FormField[],
  data: Record<string, unknown>
): Record<string, string> {
  const mappings: Record<string, string> = {};
  for (const field of fields) {
    if (field.contactFieldMapping && data[field.id] !== undefined) {
      mappings[field.contactFieldMapping] = String(data[field.id]);
    }
  }
  return mappings;
}

describe("extractContactFieldMappings", () => {
  const fields: FormField[] = [
    { id: "f1", type: "text", label: "First Name", required: true, contactFieldMapping: "firstName" },
    { id: "f2", type: "text", label: "Last Name", required: true, contactFieldMapping: "lastName" },
    { id: "f3", type: "email", label: "Email", required: true, contactFieldMapping: "email" },
    { id: "f4", type: "phone", label: "Phone", required: false, contactFieldMapping: "phone" },
    { id: "f5", type: "text", label: "Notes", required: false }, // No mapping
  ];

  it("extracts mapped fields from submission data", () => {
    const data = { f1: "John", f2: "Doe", f3: "john@test.com", f4: "555-1234", f5: "Some notes" };
    const mappings = extractContactFieldMappings(fields, data);
    expect(mappings).toEqual({
      firstName: "John",
      lastName: "Doe",
      email: "john@test.com",
      phone: "555-1234",
    });
  });

  it("skips fields without contactFieldMapping", () => {
    const data = { f1: "John", f5: "Notes" };
    const mappings = extractContactFieldMappings(fields, data);
    expect(mappings).not.toHaveProperty("notes");
    expect(mappings.firstName).toBe("John");
  });

  it("skips fields with undefined data", () => {
    const data = { f1: "John" };
    const mappings = extractContactFieldMappings(fields, data);
    expect(mappings).toEqual({ firstName: "John" });
    expect(mappings).not.toHaveProperty("lastName");
    expect(mappings).not.toHaveProperty("email");
  });

  it("converts non-string values to string", () => {
    const data = { f1: 123, f3: true };
    const mappings = extractContactFieldMappings(fields, data);
    expect(mappings.firstName).toBe("123");
    expect(mappings.email).toBe("true");
  });

  it("returns empty object when no fields have mappings", () => {
    const noMappingFields: FormField[] = [
      { id: "f1", type: "text", label: "Notes", required: false },
    ];
    const data = { f1: "Some notes" };
    expect(extractContactFieldMappings(noMappingFields, data)).toEqual({});
  });
});
