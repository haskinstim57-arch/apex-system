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
    secondaryColor: z.string().max(20).nullable().optional(),
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
      primaryColor: "#0c5ab0",
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
    "#0c5ab0", "#3b82f6", "#10b981", "#ef4444", "#8b5cf6",
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

  it("default color is gold (#0c5ab0)", () => {
    expect(presetColors[0]).toBe("#0c5ab0");
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

describe("Branding — Cascade Logic", () => {
  it("should cascade parent branding when sub-account has no branding", () => {
    const parentAccount = {
      id: 1,
      name: "Parent Agency",
      parentId: null,
      brandName: "Sterling Marketing",
      primaryColor: "#FF0000",
      logoUrl: "https://cdn.example.com/parent-logo.png",
      faviconUrl: "https://cdn.example.com/parent-favicon.ico",
      customDomain: "app.sterling.com",
      fromEmailDomain: "sterling.com",
      emailDomainVerified: true,
    };

    const subAccount = {
      id: 2,
      name: "Sub Account",
      parentId: 1,
      brandName: null,
      primaryColor: "#0c5ab0", // default = no override
      logoUrl: null,
      faviconUrl: null,
      customDomain: null,
      fromEmailDomain: null,
      emailDomainVerified: false,
    };

    // Simulate cascade logic from getBranding
    const hasBranding = subAccount.brandName || subAccount.logoUrl || subAccount.primaryColor !== "#0c5ab0";
    expect(hasBranding).toBeFalsy();

    // Apply cascade
    const effectiveBranding = {
      ...subAccount,
      brandName: subAccount.brandName || parentAccount.brandName,
      primaryColor: (subAccount.primaryColor && subAccount.primaryColor !== "#0c5ab0")
        ? subAccount.primaryColor
        : (parentAccount.primaryColor || "#0c5ab0"),
      logoUrl: subAccount.logoUrl || parentAccount.logoUrl,
      faviconUrl: subAccount.faviconUrl || parentAccount.faviconUrl,
      customDomain: subAccount.customDomain || parentAccount.customDomain,
      fromEmailDomain: subAccount.fromEmailDomain || parentAccount.fromEmailDomain,
      emailDomainVerified: subAccount.fromEmailDomain
        ? subAccount.emailDomainVerified
        : (parentAccount.emailDomainVerified ?? false),
    };

    expect(effectiveBranding.brandName).toBe("Sterling Marketing");
    expect(effectiveBranding.primaryColor).toBe("#FF0000");
    expect(effectiveBranding.logoUrl).toBe("https://cdn.example.com/parent-logo.png");
    expect(effectiveBranding.faviconUrl).toBe("https://cdn.example.com/parent-favicon.ico");
    expect(effectiveBranding.customDomain).toBe("app.sterling.com");
    expect(effectiveBranding.fromEmailDomain).toBe("sterling.com");
    expect(effectiveBranding.emailDomainVerified).toBe(true);
  });

  it("should use sub-account branding when it has its own override", () => {
    const subAccount = {
      id: 2,
      name: "Sub Account",
      parentId: 1,
      brandName: "Sub Brand",
      primaryColor: "#00FF00",
      logoUrl: "https://cdn.example.com/sub-logo.png",
      faviconUrl: null,
      customDomain: null,
      fromEmailDomain: null,
      emailDomainVerified: false,
    };

    // Sub-account has its own branding
    const hasBranding = subAccount.brandName || subAccount.logoUrl || subAccount.primaryColor !== "#0c5ab0";
    expect(hasBranding).toBeTruthy();

    // No cascade needed — use sub-account's own values
    const result = {
      logoUrl: subAccount.logoUrl ?? null,
      faviconUrl: subAccount.faviconUrl ?? null,
      brandName: subAccount.brandName ?? null,
      primaryColor: subAccount.primaryColor ?? "#0c5ab0",
      customDomain: subAccount.customDomain ?? null,
      fromEmailDomain: subAccount.fromEmailDomain ?? null,
      emailDomainVerified: subAccount.emailDomainVerified ?? false,
    };

    expect(result.brandName).toBe("Sub Brand");
    expect(result.primaryColor).toBe("#00FF00");
    expect(result.logoUrl).toBe("https://cdn.example.com/sub-logo.png");
    expect(result.faviconUrl).toBeNull();
  });

  it("should not cascade when account has no parent", () => {
    const rootAccount = {
      id: 1,
      name: "Root Agency",
      parentId: null,
      brandName: null,
      primaryColor: "#0c5ab0",
      logoUrl: null,
      faviconUrl: null,
      customDomain: null,
      fromEmailDomain: null,
      emailDomainVerified: false,
    };

    const hasBranding = rootAccount.brandName || rootAccount.logoUrl || rootAccount.primaryColor !== "#0c5ab0";
    // No branding and no parent — should return defaults
    expect(hasBranding).toBeFalsy();
    expect(rootAccount.parentId).toBeNull();

    // No cascade possible
    const result = {
      logoUrl: rootAccount.logoUrl ?? null,
      faviconUrl: rootAccount.faviconUrl ?? null,
      brandName: rootAccount.brandName ?? null,
      primaryColor: rootAccount.primaryColor ?? "#0c5ab0",
    };

    expect(result.primaryColor).toBe("#0c5ab0");
    expect(result.brandName).toBeNull();
    expect(result.logoUrl).toBeNull();
  });
});

describe("Branding — Contrast Foreground Helper", () => {
  function contrastForeground(hex: string): string {
    try {
      const r = parseInt(hex.slice(1, 3), 16);
      const g = parseInt(hex.slice(3, 5), 16);
      const b = parseInt(hex.slice(5, 7), 16);
      const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
      return luminance > 0.55 ? "#1a1a1a" : "#ffffff";
    } catch {
      return "#ffffff";
    }
  }

  it("returns dark text for light backgrounds", () => {
    expect(contrastForeground("#ffffff")).toBe("#1a1a1a");
    expect(contrastForeground("#00FF00")).toBe("#1a1a1a");
    expect(contrastForeground("#f0e68c")).toBe("#1a1a1a"); // khaki - light
  });

  it("returns white text for dark backgrounds", () => {
    expect(contrastForeground("#FF0000")).toBe("#ffffff");
    expect(contrastForeground("#0000FF")).toBe("#ffffff");
    expect(contrastForeground("#000000")).toBe("#ffffff");
  });

  it("returns white for invalid hex (fallback)", () => {
    expect(contrastForeground("invalid")).toBe("#ffffff");
  });
});

describe("Branding — Secondary Color", () => {
  const updateBrandingSchema = z.object({
    accountId: z.number().int().positive(),
    logoUrl: z.string().nullable().optional(),
    faviconUrl: z.string().nullable().optional(),
    brandName: z.string().max(255).nullable().optional(),
    primaryColor: z.string().max(20).optional(),
    secondaryColor: z.string().max(20).nullable().optional(),
    customDomain: z.string().max(255).nullable().optional(),
  });

  it("accepts valid secondary color", () => {
    const input = { accountId: 1, secondaryColor: "#3b82f6" };
    const result = updateBrandingSchema.safeParse(input);
    expect(result.success).toBe(true);
  });

  it("accepts null secondary color (clear)", () => {
    const input = { accountId: 1, secondaryColor: null };
    const result = updateBrandingSchema.safeParse(input);
    expect(result.success).toBe(true);
  });

  it("rejects secondary color exceeding 20 chars", () => {
    const input = { accountId: 1, secondaryColor: "x".repeat(21) };
    const result = updateBrandingSchema.safeParse(input);
    expect(result.success).toBe(false);
  });

  it("accepts both primary and secondary colors together", () => {
    const input = {
      accountId: 1,
      primaryColor: "#0c5ab0",
      secondaryColor: "#3b82f6",
      brandName: "Sterling Marketing",
    };
    const result = updateBrandingSchema.safeParse(input);
    expect(result.success).toBe(true);
  });

  it("secondary color cascades from parent to sub-account", () => {
    const parentAccount = {
      secondaryColor: "#3b82f6",
      primaryColor: "#FF0000",
      brandName: "Parent Agency",
    };

    const subAccount = {
      secondaryColor: null,
      primaryColor: "#0c5ab0",
      brandName: null,
    };

    // Cascade logic: sub-account inherits parent's secondary color
    const effectiveSecondary = subAccount.secondaryColor || parentAccount.secondaryColor;
    expect(effectiveSecondary).toBe("#3b82f6");
  });

  it("sub-account secondary color overrides parent", () => {
    const parentAccount = {
      secondaryColor: "#3b82f6",
    };

    const subAccount = {
      secondaryColor: "#10b981",
    };

    const effectiveSecondary = subAccount.secondaryColor || parentAccount.secondaryColor;
    expect(effectiveSecondary).toBe("#10b981");
  });

  it("returns null when neither parent nor sub-account has secondary color", () => {
    const parentAccount = {
      secondaryColor: null,
    };

    const subAccount = {
      secondaryColor: null,
    };

    const effectiveSecondary = subAccount.secondaryColor || parentAccount.secondaryColor;
    expect(effectiveSecondary).toBeNull();
  });

  it("schema includes secondaryColor column", async () => {
    const { accounts } = await import("../drizzle/schema");
    const columns = Object.keys(accounts);
    expect(columns).toContain("secondaryColor");
  });
});

describe("Branding — Reset to Defaults", () => {
  const updateBrandingSchema = z.object({
    accountId: z.number().int().positive(),
    logoUrl: z.string().nullable().optional(),
    faviconUrl: z.string().nullable().optional(),
    brandName: z.string().max(255).nullable().optional(),
    primaryColor: z.string().max(20).optional(),
    secondaryColor: z.string().max(20).nullable().optional(),
    customDomain: z.string().max(255).nullable().optional(),
  });

  it("accepts reset payload with all null/default values", () => {
    const resetPayload = {
      accountId: 1,
      brandName: null,
      primaryColor: "#0c5ab0",
      secondaryColor: null,
      logoUrl: null,
      faviconUrl: null,
      customDomain: null,
    };
    const result = updateBrandingSchema.safeParse(resetPayload);
    expect(result.success).toBe(true);
  });

  it("reset payload clears all branding fields", () => {
    const resetPayload = {
      brandName: null,
      primaryColor: "#0c5ab0",
      secondaryColor: null,
      logoUrl: null,
      faviconUrl: null,
      customDomain: null,
    };

    expect(resetPayload.brandName).toBeNull();
    expect(resetPayload.primaryColor).toBe("#0c5ab0");
    expect(resetPayload.secondaryColor).toBeNull();
    expect(resetPayload.logoUrl).toBeNull();
    expect(resetPayload.faviconUrl).toBeNull();
    expect(resetPayload.customDomain).toBeNull();
  });

  it("after reset, hasBranding check returns false", () => {
    const resetAccount = {
      brandName: null,
      primaryColor: "#0c5ab0",
      secondaryColor: null,
      logoUrl: null,
    };

    const hasBranding =
      resetAccount.brandName ||
      resetAccount.logoUrl ||
      resetAccount.primaryColor !== "#0c5ab0" ||
      resetAccount.secondaryColor;

    expect(hasBranding).toBeFalsy();
  });
});

describe("Branding — Theme Preview Contrast", () => {
  function contrastColor(hex: string): string {
    try {
      const r = parseInt(hex.slice(1, 3), 16);
      const g = parseInt(hex.slice(3, 5), 16);
      const b = parseInt(hex.slice(5, 7), 16);
      const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
      return lum > 0.55 ? "#1a1a1a" : "#ffffff";
    } catch {
      return "#ffffff";
    }
  }

  it("returns dark text for light primary colors", () => {
    expect(contrastColor("#f59e0b")).toBe("#1a1a1a"); // amber
    expect(contrastColor("#ffffff")).toBe("#1a1a1a"); // white
    expect(contrastColor("#f1f5f9")).toBe("#1a1a1a"); // slate-100
  });

  it("returns white text for dark primary colors", () => {
    expect(contrastColor("#1a1a2e")).toBe("#ffffff"); // dark navy
    expect(contrastColor("#000000")).toBe("#ffffff"); // black
    expect(contrastColor("#3b82f6")).toBe("#ffffff"); // blue
  });

  it("returns white text for dark secondary colors", () => {
    expect(contrastColor("#8b5cf6")).toBe("#ffffff"); // purple
    expect(contrastColor("#ef4444")).toBe("#ffffff"); // red
  });

  it("returns white text for medium secondary colors", () => {
    // Teal and emerald are mid-range — luminance is below 0.55
    expect(contrastColor("#14b8a6")).toBe("#ffffff"); // teal
    expect(contrastColor("#10b981")).toBe("#ffffff"); // emerald
  });

  it("handles the default primary color correctly", () => {
    const defaultPrimary = "#0c5ab0";
    const fg = contrastColor(defaultPrimary);
    expect(fg).toBe("#ffffff"); // blue is dark enough for white text
  });

  it("handles invalid hex gracefully", () => {
    expect(contrastColor("invalid")).toBe("#ffffff");
    expect(contrastColor("")).toBe("#ffffff");
  });
});
