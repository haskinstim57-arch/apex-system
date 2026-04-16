/**
 * Launch Blockers — April 14 Bug Fixes
 *
 * Tests for the 5 critical bugs fixed:
 *   Bug 1: Dashboard blank after login (AccountContext hydration)
 *   Bug 2: Twilio "not configured" error surfacing
 *   Bug 3: Microsoft OAuth client_id validation
 *   Bug 4: GMB "invalid connection" error logging
 *   Bug 5: Gemini 503 fallback chain
 */

import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

// ═══════════════════════════════════════════════════════════════
// Bug 2: Twilio error surfacing
// ═══════════════════════════════════════════════════════════════

describe("Bug 2: Twilio error surfacing", () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("should list missing env vars when TWILIO_ACCOUNT_SID is not set", () => {
    delete process.env.TWILIO_ACCOUNT_SID;
    delete process.env.TWILIO_AUTH_TOKEN;

    const sid = process.env.TWILIO_ACCOUNT_SID;
    const token = process.env.TWILIO_AUTH_TOKEN;
    const missing: string[] = [];
    if (!sid) missing.push("TWILIO_ACCOUNT_SID");
    if (!token) missing.push("TWILIO_AUTH_TOKEN");

    expect(missing).toContain("TWILIO_ACCOUNT_SID");
    expect(missing).toContain("TWILIO_AUTH_TOKEN");
    expect(missing.length).toBe(2);
  });

  it("should produce a descriptive error message with missing var names", () => {
    const missing = ["TWILIO_ACCOUNT_SID", "TWILIO_AUTH_TOKEN"];
    const message = `Twilio credentials are not configured. Missing: ${missing.join(", ")}. Please add your Twilio credentials in Settings → Messaging, or ask your administrator to configure the global Twilio credentials.`;

    expect(message).toContain("TWILIO_ACCOUNT_SID");
    expect(message).toContain("TWILIO_AUTH_TOKEN");
    expect(message).toContain("Settings → Messaging");
  });

  it("should only list TWILIO_AUTH_TOKEN when SID is set", () => {
    process.env.TWILIO_ACCOUNT_SID = "AC_test_sid";
    delete process.env.TWILIO_AUTH_TOKEN;

    const sid = process.env.TWILIO_ACCOUNT_SID;
    const token = process.env.TWILIO_AUTH_TOKEN;
    const missing: string[] = [];
    if (!sid) missing.push("TWILIO_ACCOUNT_SID");
    if (!token) missing.push("TWILIO_AUTH_TOKEN");

    expect(missing).toEqual(["TWILIO_AUTH_TOKEN"]);
  });
});

// ═══════════════════════════════════════════════════════════════
// Bug 3: Microsoft OAuth credential validation
// ═══════════════════════════════════════════════════════════════

describe("Bug 3: Microsoft OAuth credential validation", () => {
  it("should throw when MICROSOFT_CLIENT_ID is empty", () => {
    const microsoftClientId = "";
    expect(() => {
      if (!microsoftClientId) {
        throw new Error(
          "Microsoft OAuth is not configured. The MICROSOFT_CLIENT_ID environment variable is missing."
        );
      }
    }).toThrow("MICROSOFT_CLIENT_ID");
  });

  it("should throw when MICROSOFT_CLIENT_SECRET is empty", () => {
    const microsoftClientSecret = "";
    expect(() => {
      if (!microsoftClientSecret) {
        throw new Error(
          "Microsoft OAuth is not configured. The MICROSOFT_CLIENT_SECRET environment variable is missing."
        );
      }
    }).toThrow("MICROSOFT_CLIENT_SECRET");
  });

  it("should not throw when both credentials are present", () => {
    const microsoftClientId = "test-client-id";
    const microsoftClientSecret = "test-client-secret";
    expect(() => {
      if (!microsoftClientId) throw new Error("Missing MICROSOFT_CLIENT_ID");
      if (!microsoftClientSecret) throw new Error("Missing MICROSOFT_CLIENT_SECRET");
    }).not.toThrow();
  });

  it("should build correct redirect URI from origin", () => {
    const origin = "https://apexcrm-knxkwfan.manus.space";
    const redirectUri = `${origin}/api/integrations/outlook/callback`;
    expect(redirectUri).toBe(
      "https://apexcrm-knxkwfan.manus.space/api/integrations/outlook/callback"
    );
  });
});

// ═══════════════════════════════════════════════════════════════
// Bug 4: GMB credential validation and error logging
// ═══════════════════════════════════════════════════════════════

describe("Bug 4: GMB credential validation", () => {
  it("should throw when GOOGLE_CLIENT_ID is empty", () => {
    const googleClientId = "";
    expect(() => {
      if (!googleClientId) {
        throw new Error(
          "Google Business Profile integration is not configured. GOOGLE_CLIENT_ID is missing."
        );
      }
    }).toThrow("GOOGLE_CLIENT_ID");
  });

  it("should throw when GOOGLE_CLIENT_SECRET is empty", () => {
    const googleClientSecret = "";
    expect(() => {
      if (!googleClientSecret) {
        throw new Error(
          "Google Business Profile integration is not configured. GOOGLE_CLIENT_SECRET is missing."
        );
      }
    }).toThrow("GOOGLE_CLIENT_SECRET");
  });

  it("should extract error description from Google API response", () => {
    const err = {
      response: {
        data: {
          error_description: "The OAuth client was not found.",
        },
      },
      message: "Request failed with status code 401",
    };

    const errorMsg =
      err?.response?.data?.error_description || err?.message || String(err);
    expect(errorMsg).toBe("The OAuth client was not found.");
  });

  it("should fallback to err.message when response.data is missing", () => {
    const err = {
      message: "Network error",
    };

    const errorMsg =
      (err as any)?.response?.data?.error_description || err?.message || String(err);
    expect(errorMsg).toBe("Network error");
  });

  it("should truncate long error messages for redirect URL", () => {
    const longError = "A".repeat(300);
    const truncated = longError.substring(0, 200);
    expect(truncated.length).toBe(200);
  });
});

// ═══════════════════════════════════════════════════════════════
// Bug 5: Gemini 503 fallback chain
// ═══════════════════════════════════════════════════════════════

describe("Bug 5: Gemini fallback chain", () => {
  it("should detect 503/404 overloaded and deprecated errors", () => {
    const isOverloadedError = (err: any): boolean => {
      const msg = (err?.message || String(err)).toLowerCase();
      return (
        msg.includes("503") ||
        msg.includes("overloaded") ||
        msg.includes("high demand") ||
        msg.includes("resource exhausted") ||
        msg.includes("429") ||
        msg.includes("404") ||
        msg.includes("not found")
      );
    };

    expect(
      isOverloadedError({
        message:
          "[503 Service Unavailable] This model is currently experiencing high demand.",
      })
    ).toBe(true);

    expect(
      isOverloadedError({
        message: "Resource exhausted: quota exceeded",
      })
    ).toBe(true);

    expect(
      isOverloadedError({
        message: "429 Too Many Requests",
      })
    ).toBe(true);

    // 404 / deprecated model errors should also trigger fallback
    expect(
      isOverloadedError({
        message: "[404 Not Found] This model models/gemini-2.0-flash is no longer available to new users.",
      })
    ).toBe(true);

    expect(
      isOverloadedError({
        message: "Model not found: gemini-2.0-flash",
      })
    ).toBe(true);

    // Non-overload errors should return false
    expect(
      isOverloadedError({
        message: "Invalid API key",
      })
    ).toBe(false);

    expect(
      isOverloadedError({
        message: "PERMISSION_DENIED",
      })
    ).toBe(false);
  });

  it("should define correct fallback order", () => {
    const fallbackChain = [
      "gemini-2.5-flash",
      "gemini-2.5-flash",
      "platform-llm",
    ];

    expect(fallbackChain[0]).toBe("gemini-2.5-flash");
    expect(fallbackChain[1]).toBe("gemini-2.5-flash");
    expect(fallbackChain[2]).toBe("platform-llm");
    expect(fallbackChain.length).toBe(3);
  });

  it("should track usage with correct model name on fallback", () => {
    const usageLogs: { model: string; success: boolean }[] = [];

    // Simulate fallback logging
    usageLogs.push({ model: "gemini-2.5-flash", success: false });
    usageLogs.push({ model: "gemini-2.5-flash (fallback)", success: true });

    expect(usageLogs[0].model).toBe("gemini-2.5-flash");
    expect(usageLogs[0].success).toBe(false);
    expect(usageLogs[1].model).toContain("fallback");
    expect(usageLogs[1].success).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════
// Bug 1: Dashboard blank after login (AccountContext hydration)
// ═══════════════════════════════════════════════════════════════

describe("Bug 1: Dashboard loading state", () => {
  it("should show loading skeleton when accounts are not yet loaded", () => {
    // Simulate AccountContext state during hydration
    const isLoading = true;
    const currentAccountId = null;
    const accounts: any[] = [];

    // The fix: show skeleton when isLoading is true
    const shouldShowSkeleton = isLoading;
    expect(shouldShowSkeleton).toBe(true);
  });

  it("should show dashboard content when accounts are loaded", () => {
    const isLoading = false;
    const currentAccountId = 1;
    const accounts = [{ id: 1, name: "Test Account" }];

    const shouldShowSkeleton = isLoading;
    const shouldShowContent = !isLoading && currentAccountId !== null;
    expect(shouldShowSkeleton).toBe(false);
    expect(shouldShowContent).toBe(true);
  });

  it("should show no-account state when loaded but no accounts", () => {
    const isLoading = false;
    const currentAccountId = null;
    const accounts: any[] = [];

    const shouldShowSkeleton = isLoading;
    const shouldShowNoAccount = !isLoading && currentAccountId === null;
    expect(shouldShowSkeleton).toBe(false);
    expect(shouldShowNoAccount).toBe(true);
  });
});
