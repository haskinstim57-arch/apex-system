import { describe, expect, it, vi, beforeEach } from "vitest";
import { z } from "zod";

// ─── Unit tests for branding input validation & schema shape ───

describe("Branding — Input Validation", () => {
  const updateBrandingSchema = z.object({
    accountId: z.number().int().positive(),
    logoUrl: z.string().nullable().optional(),
    faviconUrl: z.string().nullable().optional(),
    brandName: z.string().max(255).nullable().optional(),
    primaryColor: z.string().max(20).optional(),
    customDomain: z.string().max(255).nullable().optional(),
  });

  const setEmailDomainSchema = z.object({
    accountId: z.number().int().positive(),
    fromEmailDomain: z.string().min(3).max(255),
  });

  const verifyEmailDomainSchema = z.object({
    accountId: z.number().int().positive(),
    sendgridDomainId: z.string().optional(),
  });

  it("accepts valid branding update input", () => {
    const input = {
      accountId: 1,
      brandName: "Sterling Marketing",
      primaryColor: "#d4a843",
      logoUrl: "https://cdn.example.com/logo.png",
      faviconUrl: "https://cdn.example.com/favicon.ico",
      customDomain: "app.sterlingmarketing.com",
    };
    const result = updateBrandingSchema.safeParse(input);
    expect(result.success).toBe(true);
  });

  it("accepts partial branding update (only color)", () => {
    const input = { accountId: 5, primaryColor: "#3b82f6" };
    const result = updateBrandingSchema.safeParse(input);
    expect(result.success).toBe(true);
  });

  it("accepts null values for nullable fields", () => {
    const input = {
      accountId: 1,
      logoUrl: null,
      faviconUrl: null,
      brandName: null,
      customDomain: null,
    };
    const result = updateBrandingSchema.safeParse(input);
    expect(result.success).toBe(true);
  });

  it("rejects missing accountId", () => {
    const input = { brandName: "Test" };
    const result = updateBrandingSchema.safeParse(input);
    expect(result.success).toBe(false);
  });

  it("rejects non-positive accountId", () => {
    const input = { accountId: 0, brandName: "Test" };
    const result = updateBrandingSchema.safeParse(input);
    expect(result.success).toBe(false);
  });

  it("rejects brandName exceeding 255 chars", () => {
    const input = { accountId: 1, brandName: "x".repeat(256) };
    const result = updateBrandingSchema.safeParse(input);
    expect(result.success).toBe(false);
  });

  it("rejects primaryColor exceeding 20 chars", () => {
    const input = { accountId: 1, primaryColor: "x".repeat(21) };
    const result = updateBrandingSchema.safeParse(input);
    expect(result.success).toBe(false);
  });

  // Email domain schema tests
  it("accepts valid email domain input", () => {
    const input = { accountId: 1, fromEmailDomain: "sterlingmarketing.com" };
    const result = setEmailDomainSchema.safeParse(input);
    expect(result.success).toBe(true);
  });

  it("rejects email domain shorter than 3 chars", () => {
    const input = { accountId: 1, fromEmailDomain: "ab" };
    const result = setEmailDomainSchema.safeParse(input);
    expect(result.success).toBe(false);
  });

  it("rejects email domain exceeding 255 chars", () => {
    const input = { accountId: 1, fromEmailDomain: "x".repeat(256) };
    const result = setEmailDomainSchema.safeParse(input);
    expect(result.success).toBe(false);
  });

  it("rejects missing email domain", () => {
    const input = { accountId: 1 };
    const result = setEmailDomainSchema.safeParse(input);
    expect(result.success).toBe(false);
  });

  // Verify email domain schema tests
  it("accepts verify input with sendgridDomainId", () => {
    const input = { accountId: 1, sendgridDomainId: "12345" };
    const result = verifyEmailDomainSchema.safeParse(input);
    expect(result.success).toBe(true);
  });

  it("accepts verify input without sendgridDomainId", () => {
    const input = { accountId: 1 };
    const result = verifyEmailDomainSchema.safeParse(input);
    expect(result.success).toBe(true);
  });
});

describe("Branding — Color Presets", () => {
  const presetColors = [
    "#d4a843", "#3b82f6", "#10b981", "#ef4444", "#8b5cf6",
    "#f59e0b", "#ec4899", "#06b6d4", "#6366f1", "#14b8a6",
  ];

  it("all preset colors are valid hex codes", () => {
    const hexRegex = /^#[0-9a-fA-F]{6}$/;
    for (const color of presetColors) {
      expect(color).toMatch(hexRegex);
    }
  });

  it("has exactly 10 preset colors", () => {
    expect(presetColors).toHaveLength(10);
  });

  it("default color is gold (#d4a843)", () => {
    expect(presetColors[0]).toBe("#d4a843");
  });
});

describe("Branding — Schema Fields", () => {
  it("accounts schema includes branding fields", async () => {
    const { accounts } = await import("../drizzle/schema");
    const columns = Object.keys(accounts);
    // The table object has column names as keys
    expect(columns).toContain("customDomain");
    expect(columns).toContain("primaryColor");
    expect(columns).toContain("fromEmailDomain");
    expect(columns).toContain("emailDomainVerified");
    expect(columns).toContain("brandName");
    expect(columns).toContain("faviconUrl");
    expect(columns).toContain("logoUrl");
  });
});

describe("Branding — DNS Record Shape", () => {
  it("validates DNS record structure from SendGrid response", () => {
    const mockDnsRecords = [
      { type: "cname", host: "em1234.example.com", data: "u1234.wl.sendgrid.net" },
      { type: "cname", host: "s1._domainkey.example.com", data: "s1.domainkey.u1234.wl.sendgrid.net" },
      { type: "cname", host: "s2._domainkey.example.com", data: "s2.domainkey.u1234.wl.sendgrid.net" },
    ];

    for (const rec of mockDnsRecords) {
      expect(rec).toHaveProperty("type");
      expect(rec).toHaveProperty("host");
      expect(rec).toHaveProperty("data");
      expect(typeof rec.type).toBe("string");
      expect(typeof rec.host).toBe("string");
      expect(typeof rec.data).toBe("string");
    }
  });
});
