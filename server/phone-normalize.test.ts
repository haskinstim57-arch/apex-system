import { describe, it, expect } from "vitest";

/**
 * Phone number normalization logic — mirrors the E.164 normalization
 * used in both the frontend (TestChannelsCard) and backend (updateUserPhone).
 */
function normalizePhoneToE164(phone: string | null): string | null {
  if (!phone) return null;
  let normalized = phone.trim();
  if (!normalized) return null;

  if (normalized.startsWith("+")) {
    return normalized; // Already has + prefix
  }

  const digits = normalized.replace(/\D/g, "");
  if (digits.length === 10) {
    return "+1" + digits; // US 10-digit → +1XXXXXXXXXX
  } else if (digits.length === 11 && digits.startsWith("1")) {
    return "+" + digits; // US 11-digit with leading 1 → +1XXXXXXXXXX
  } else {
    return "+" + digits; // Other → just prepend +
  }
}

describe("Phone Number E.164 Normalization", () => {
  it("should add +1 prefix to 10-digit US numbers", () => {
    expect(normalizePhoneToE164("4379743613")).toBe("+14379743613");
    expect(normalizePhoneToE164("2125551234")).toBe("+12125551234");
  });

  it("should add + prefix to 11-digit numbers starting with 1", () => {
    expect(normalizePhoneToE164("14379743613")).toBe("+14379743613");
    expect(normalizePhoneToE164("12125551234")).toBe("+12125551234");
  });

  it("should preserve numbers that already have + prefix", () => {
    expect(normalizePhoneToE164("+14379743613")).toBe("+14379743613");
    expect(normalizePhoneToE164("+442071234567")).toBe("+442071234567");
  });

  it("should strip non-digit characters before normalizing", () => {
    expect(normalizePhoneToE164("(437) 974-3613")).toBe("+14379743613");
    expect(normalizePhoneToE164("437-974-3613")).toBe("+14379743613");
    expect(normalizePhoneToE164("437.974.3613")).toBe("+14379743613");
  });

  it("should handle numbers with spaces", () => {
    expect(normalizePhoneToE164("437 974 3613")).toBe("+14379743613");
    expect(normalizePhoneToE164(" 4379743613 ")).toBe("+14379743613");
  });

  it("should handle null and empty values", () => {
    expect(normalizePhoneToE164(null)).toBeNull();
    expect(normalizePhoneToE164("")).toBeNull();
    expect(normalizePhoneToE164("  ")).toBeNull();
  });

  it("should handle international numbers without + prefix", () => {
    // 12 digits — not a US number
    expect(normalizePhoneToE164("442071234567")).toBe("+442071234567");
  });
});
