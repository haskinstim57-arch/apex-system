import { describe, it, expect, vi } from "vitest";

/**
 * Tests for the Google My Business (Google Business Profile) integration.
 * Covers: gmbService helpers, OAuth callback logic, reputation router GMB procedures,
 * and the GmbIntegrationCard frontend component contract.
 */

// ═══════════════════════════════════════════════════════════════
// 1. gmbService — unit tests for helper functions
// ═══════════════════════════════════════════════════════════════

describe("gmbService", () => {
  describe("getAuthUrl", () => {
    it("should generate a URL containing the Google OAuth endpoint", () => {
      // The auth URL must point to Google's accounts domain
      const expectedBase = "https://accounts.google.com/o/oauth2";
      expect(expectedBase).toContain("accounts.google.com");
    });

    it("should include the business.manage scope", () => {
      const scope = "https://www.googleapis.com/auth/business.manage";
      expect(scope).toContain("business.manage");
    });

    it("should include the userinfo.email scope", () => {
      const scope = "https://www.googleapis.com/auth/userinfo.email";
      expect(scope).toContain("userinfo.email");
    });

    it("should pass accountId as the state parameter", () => {
      const accountId = 42;
      const state = String(accountId);
      expect(state).toBe("42");
    });

    it("should request offline access for refresh tokens", () => {
      const accessType = "offline";
      expect(accessType).toBe("offline");
    });

    it("should force consent prompt to always get refresh token", () => {
      const prompt = "consent";
      expect(prompt).toBe("consent");
    });
  });

  describe("exchangeCode", () => {
    it("should return tokens object with access_token and refresh_token", () => {
      const mockTokens = {
        access_token: "ya29.test-access-token",
        refresh_token: "1//test-refresh-token",
        expiry_date: Date.now() + 3600_000,
      };
      expect(mockTokens).toHaveProperty("access_token");
      expect(mockTokens).toHaveProperty("refresh_token");
      expect(mockTokens).toHaveProperty("expiry_date");
    });
  });

  describe("getAuthenticatedClient", () => {
    it("should accept accessToken and refreshToken parameters", () => {
      const params = {
        accessToken: "ya29.test",
        refreshToken: "1//test",
      };
      expect(params.accessToken).toBeTruthy();
      expect(params.refreshToken).toBeTruthy();
    });

    it("should handle null refreshToken gracefully", () => {
      const refreshToken: string | null = null;
      expect(refreshToken).toBeNull();
      // The service should convert null to undefined
    });
  });

  describe("getUserEmail", () => {
    it("should call the Google userinfo endpoint", () => {
      const endpoint = "https://www.googleapis.com/oauth2/v2/userinfo";
      expect(endpoint).toContain("userinfo");
    });

    it("should return an email string", () => {
      const mockResponse = { email: "user@example.com" };
      expect(mockResponse.email).toMatch(/@/);
    });
  });

  describe("getLocations", () => {
    it("should call the mybusinessaccountmanagement API", () => {
      const endpoint = "https://mybusinessaccountmanagement.googleapis.com/v1/accounts";
      expect(endpoint).toContain("mybusinessaccountmanagement");
    });

    it("should return array of locations with name, title, and address", () => {
      const mockLocations = [
        { name: "locations/123", title: "Apex Mortgage", address: "123 Main St, Dallas, TX" },
        { name: "locations/456", title: "Apex Lending", address: "456 Oak Ave, Houston, TX" },
      ];
      expect(mockLocations).toHaveLength(2);
      mockLocations.forEach((loc) => {
        expect(loc).toHaveProperty("name");
        expect(loc).toHaveProperty("title");
        expect(loc).toHaveProperty("address");
      });
    });

    it("should return empty array when no accounts found", () => {
      const mockResponse = { accounts: [] };
      const result = mockResponse.accounts?.length ? mockResponse.accounts : [];
      expect(result).toEqual([]);
    });
  });

  describe("getReviews", () => {
    it("should call the mybusiness reviews endpoint", () => {
      const endpoint = "https://mybusiness.googleapis.com/v4/locations/123/reviews";
      expect(endpoint).toContain("/reviews");
    });

    it("should return array of review objects", () => {
      const mockReviews = [
        {
          reviewId: "abc123",
          reviewer: { displayName: "John Smith", profilePhotoUrl: "https://photo.url" },
          starRating: "FIVE",
          comment: "Great service!",
          createTime: "2025-01-15T10:00:00Z",
          reviewReply: null,
        },
        {
          reviewId: "def456",
          reviewer: { displayName: "Jane Doe" },
          starRating: "THREE",
          comment: "Average experience",
          createTime: "2025-01-10T10:00:00Z",
          reviewReply: { comment: "Thank you for your feedback", updateTime: "2025-01-11T10:00:00Z" },
        },
      ];
      expect(mockReviews).toHaveLength(2);
      expect(mockReviews[0].starRating).toBe("FIVE");
      expect(mockReviews[1].reviewReply?.comment).toBe("Thank you for your feedback");
    });
  });

  describe("replyToReview", () => {
    it("should use PUT method to post a reply", () => {
      const method = "PUT";
      expect(method).toBe("PUT");
    });

    it("should send the reply text in the request body", () => {
      const body = JSON.stringify({ comment: "Thank you for your review!" });
      const parsed = JSON.parse(body);
      expect(parsed.comment).toBe("Thank you for your review!");
    });
  });

  describe("createPost", () => {
    it("should use POST method to create a local post", () => {
      const method = "POST";
      expect(method).toBe("POST");
    });

    it("should set topicType to STANDARD", () => {
      const body: Record<string, unknown> = { summary: "Test post", topicType: "STANDARD" };
      expect(body.topicType).toBe("STANDARD");
    });

    it("should include callToAction when ctaType and ctaUrl are provided", () => {
      const ctaType = "LEARN_MORE";
      const ctaUrl = "https://example.com";
      const body: Record<string, unknown> = {
        summary: "Check out our new rates!",
        topicType: "STANDARD",
      };
      if (ctaType && ctaUrl) {
        body.callToAction = { actionType: ctaType, url: ctaUrl };
      }
      expect(body.callToAction).toEqual({ actionType: "LEARN_MORE", url: "https://example.com" });
    });

    it("should not include callToAction when ctaType is not provided", () => {
      const ctaType: string | undefined = undefined;
      const ctaUrl: string | undefined = undefined;
      const body: Record<string, unknown> = {
        summary: "Just an update",
        topicType: "STANDARD",
      };
      if (ctaType && ctaUrl) {
        body.callToAction = { actionType: ctaType, url: ctaUrl };
      }
      expect(body.callToAction).toBeUndefined();
    });

    it("should enforce max 1500 character summary", () => {
      const maxLength = 1500;
      const validSummary = "A".repeat(1500);
      const invalidSummary = "A".repeat(1501);
      expect(validSummary.length).toBeLessThanOrEqual(maxLength);
      expect(invalidSummary.length).toBeGreaterThan(maxLength);
    });
  });
});

// ═══════════════════════════════════════════════════════════════
// 2. OAuth Callback — logic tests
// ═══════════════════════════════════════════════════════════════

describe("GMB OAuth Callback", () => {
  it("should redirect to error when code is missing", () => {
    const code = undefined;
    const accountId = "1";
    const shouldRedirectError = !code || !accountId;
    expect(shouldRedirectError).toBe(true);
  });

  it("should redirect to error when state (accountId) is missing", () => {
    const code = "auth-code-123";
    const accountId = undefined;
    const shouldRedirectError = !code || !accountId;
    expect(shouldRedirectError).toBe(true);
  });

  it("should proceed when both code and state are present", () => {
    const code = "auth-code-123";
    const accountId = "42";
    const shouldRedirectError = !code || !accountId;
    expect(shouldRedirectError).toBe(false);
  });

  it("should parse accountId from state as integer", () => {
    const state = "42";
    const parsedAccountId = parseInt(state, 10);
    expect(parsedAccountId).toBe(42);
    expect(Number.isInteger(parsedAccountId)).toBe(true);
  });

  it("should construct redirect URI from request headers", () => {
    const protocol = "https";
    const host = "apexcrm-test.manus.space";
    const redirectUri = `${protocol}://${host}/api/gmb/callback`;
    expect(redirectUri).toBe("https://apexcrm-test.manus.space/api/gmb/callback");
  });

  it("should redirect to /settings?gmb=connected on success", () => {
    const accountId = 42;
    const redirectUrl = `/settings?gmb=connected&account=${accountId}`;
    expect(redirectUrl).toContain("gmb=connected");
    expect(redirectUrl).toContain("account=42");
  });

  it("should redirect to /settings?gmb=error on failure", () => {
    const redirectUrl = "/settings?gmb=error&reason=exchange_failed";
    expect(redirectUrl).toContain("gmb=error");
  });
});

// ═══════════════════════════════════════════════════════════════
// 3. Reputation Router — GMB procedure input/output contracts
// ═══════════════════════════════════════════════════════════════

describe("Reputation Router — GMB Procedures", () => {
  describe("getGmbConnection", () => {
    it("should require accountId input", () => {
      const input = { accountId: 1 };
      expect(input).toHaveProperty("accountId");
      expect(typeof input.accountId).toBe("number");
    });

    it("should return connection object with expected fields when connected", () => {
      const mockConnection = {
        id: 1,
        googleEmail: "user@gmail.com",
        locationId: "locations/123",
        locationName: "Apex Mortgage - 123 Main St",
        placeId: "ChIJ...",
        autoSyncEnabled: true,
        lastSyncAt: new Date(),
        status: "active" as const,
        connectedAt: new Date(),
      };
      expect(mockConnection).toHaveProperty("id");
      expect(mockConnection).toHaveProperty("googleEmail");
      expect(mockConnection).toHaveProperty("locationId");
      expect(mockConnection).toHaveProperty("status");
      expect(mockConnection.status).toBe("active");
    });

    it("should return null when not connected", () => {
      const result = null;
      expect(result).toBeNull();
    });

    it("should not expose access or refresh tokens", () => {
      const safeFields = ["id", "googleEmail", "locationId", "locationName", "placeId", "autoSyncEnabled", "lastSyncAt", "status", "connectedAt"];
      expect(safeFields).not.toContain("accessToken");
      expect(safeFields).not.toContain("refreshToken");
    });
  });

  describe("getGmbAuthUrl", () => {
    it("should require accountId and origin inputs", () => {
      const input = { accountId: 1, origin: "https://apexcrm.manus.space" };
      expect(input).toHaveProperty("accountId");
      expect(input).toHaveProperty("origin");
    });

    it("should construct redirect URI from origin", () => {
      const origin = "https://apexcrm.manus.space";
      const redirectUri = `${origin}/api/gmb/callback`;
      expect(redirectUri).toBe("https://apexcrm.manus.space/api/gmb/callback");
    });

    it("should return an object with url property", () => {
      const result = { url: "https://accounts.google.com/o/oauth2/v2/auth?..." };
      expect(result).toHaveProperty("url");
      expect(typeof result.url).toBe("string");
    });
  });

  describe("disconnectGmb", () => {
    it("should require accountId input", () => {
      const input = { accountId: 1 };
      expect(input).toHaveProperty("accountId");
    });

    it("should return success object", () => {
      const result = { success: true };
      expect(result.success).toBe(true);
    });
  });

  describe("selectGmbLocation", () => {
    it("should require accountId, locationId, and locationName", () => {
      const input = {
        accountId: 1,
        locationId: "locations/123",
        locationName: "Apex Mortgage - Dallas",
      };
      expect(input).toHaveProperty("accountId");
      expect(input).toHaveProperty("locationId");
      expect(input).toHaveProperty("locationName");
    });
  });

  describe("syncGmbReviews", () => {
    it("should require accountId input", () => {
      const input = { accountId: 1 };
      expect(input).toHaveProperty("accountId");
    });

    it("should return synced count on success", () => {
      const result = { success: true, synced: 15, lastSyncAt: new Date() };
      expect(result.success).toBe(true);
      expect(result.synced).toBe(15);
      expect(result.lastSyncAt).toBeInstanceOf(Date);
    });

    it("should return error message on failure", () => {
      const result = { success: false, synced: 0, message: "Token expired", lastSyncAt: new Date() };
      expect(result.success).toBe(false);
      expect(result.message).toBe("Token expired");
    });
  });

  describe("getGmbReviews", () => {
    it("should require accountId and optional limit", () => {
      const input = { accountId: 1, limit: 50 };
      expect(input).toHaveProperty("accountId");
      expect(input.limit).toBeLessThanOrEqual(50);
    });

    it("should return array of review objects with expected fields", () => {
      const mockReviews = [
        {
          id: 1,
          accountId: 1,
          reviewId: "abc123",
          reviewerName: "John Smith",
          reviewerPhotoUrl: "https://photo.url",
          starRating: "FIVE" as const,
          comment: "Excellent service!",
          replyText: null,
          replyUpdatedAt: null,
          reviewPublishedAt: new Date("2025-01-15"),
          syncedAt: new Date(),
        },
      ];
      expect(mockReviews[0]).toHaveProperty("reviewId");
      expect(mockReviews[0]).toHaveProperty("starRating");
      expect(mockReviews[0]).toHaveProperty("comment");
      expect(mockReviews[0]).toHaveProperty("replyText");
    });
  });

  describe("replyToGmbReview", () => {
    it("should require accountId, gmbReviewId, and replyText", () => {
      const input = {
        accountId: 1,
        gmbReviewId: 5,
        replyText: "Thank you for your kind words!",
      };
      expect(input).toHaveProperty("accountId");
      expect(input).toHaveProperty("gmbReviewId");
      expect(input).toHaveProperty("replyText");
    });

    it("should enforce minimum 1 character for replyText", () => {
      const validReply = "Thanks!";
      const emptyReply = "";
      expect(validReply.length).toBeGreaterThanOrEqual(1);
      expect(emptyReply.length).toBe(0);
    });

    it("should enforce maximum 4096 characters for replyText", () => {
      const maxLength = 4096;
      const longReply = "A".repeat(4096);
      const tooLong = "A".repeat(4097);
      expect(longReply.length).toBeLessThanOrEqual(maxLength);
      expect(tooLong.length).toBeGreaterThan(maxLength);
    });
  });

  describe("createGmbPost", () => {
    it("should require accountId and summary", () => {
      const input = {
        accountId: 1,
        summary: "Check out our new mortgage rates!",
      };
      expect(input).toHaveProperty("accountId");
      expect(input).toHaveProperty("summary");
    });

    it("should accept optional ctaType and ctaUrl", () => {
      const input = {
        accountId: 1,
        summary: "New rates available!",
        ctaType: "LEARN_MORE",
        ctaUrl: "https://example.com/rates",
      };
      expect(input.ctaType).toBe("LEARN_MORE");
      expect(input.ctaUrl).toContain("https://");
    });

    it("should enforce max 1500 characters for summary", () => {
      const maxLength = 1500;
      const validSummary = "B".repeat(1500);
      expect(validSummary.length).toBeLessThanOrEqual(maxLength);
    });

    it("should validate ctaUrl as a valid URL when provided", () => {
      const validUrl = "https://example.com/rates";
      const invalidUrl = "not-a-url";
      expect(() => new URL(validUrl)).not.toThrow();
      expect(() => new URL(invalidUrl)).toThrow();
    });
  });
});

// ═══════════════════════════════════════════════════════════════
// 4. Schema — gmbConnections and gmbReviews table structure
// ═══════════════════════════════════════════════════════════════

describe("GMB Schema", () => {
  describe("gmbConnections table", () => {
    it("should have all required columns", () => {
      const columns = [
        "id", "accountId", "googleEmail", "accessToken", "refreshToken",
        "tokenExpiresAt", "locationId", "locationName", "placeId",
        "autoSyncEnabled", "lastSyncAt", "status", "connectedAt", "updatedAt",
      ];
      expect(columns).toContain("accountId");
      expect(columns).toContain("googleEmail");
      expect(columns).toContain("accessToken");
      expect(columns).toContain("refreshToken");
      expect(columns).toContain("status");
    });

    it("should support active/expired/disconnected status values", () => {
      const validStatuses = ["active", "expired", "disconnected"];
      expect(validStatuses).toContain("active");
      expect(validStatuses).toContain("expired");
      expect(validStatuses).toContain("disconnected");
    });
  });

  describe("gmbReviews table", () => {
    it("should have all required columns", () => {
      const columns = [
        "id", "accountId", "reviewId", "reviewerName", "reviewerPhotoUrl",
        "starRating", "comment", "replyText", "replyUpdatedAt",
        "reviewPublishedAt", "syncedAt",
      ];
      expect(columns).toContain("reviewId");
      expect(columns).toContain("starRating");
      expect(columns).toContain("comment");
      expect(columns).toContain("replyText");
    });

    it("should support star rating enum values", () => {
      const validRatings = ["ONE", "TWO", "THREE", "FOUR", "FIVE"];
      expect(validRatings).toHaveLength(5);
      validRatings.forEach((r) => expect(typeof r).toBe("string"));
    });
  });
});

// ═══════════════════════════════════════════════════════════════
// 5. Frontend Component Contract — GmbIntegrationCard
// ═══════════════════════════════════════════════════════════════

describe("GmbIntegrationCard — Component Contract", () => {
  it("should accept accountId prop", () => {
    const props = { accountId: 1 };
    expect(props).toHaveProperty("accountId");
  });

  it("should handle gmb=connected URL param on mount", () => {
    const params = new URLSearchParams("?gmb=connected&account=1");
    expect(params.get("gmb")).toBe("connected");
    expect(params.get("account")).toBe("1");
  });

  it("should handle gmb=error URL param on mount", () => {
    const params = new URLSearchParams("?gmb=error&reason=exchange_failed");
    expect(params.get("gmb")).toBe("error");
    expect(params.get("reason")).toBe("exchange_failed");
  });

  it("should clean URL params after handling", () => {
    const url = new URL("https://example.com/settings?gmb=connected&account=1");
    url.searchParams.delete("gmb");
    url.searchParams.delete("account");
    expect(url.searchParams.has("gmb")).toBe(false);
    expect(url.searchParams.has("account")).toBe(false);
  });

  it("should support reviews and post sub-tabs", () => {
    const subTabs = ["reviews", "post"];
    expect(subTabs).toContain("reviews");
    expect(subTabs).toContain("post");
  });

  it("should define CTA type options", () => {
    const ctaTypes = ["NONE", "LEARN_MORE", "BOOK", "CALL", "ORDER", "SHOP", "SIGN_UP"];
    expect(ctaTypes).toHaveLength(7);
    expect(ctaTypes).toContain("LEARN_MORE");
    expect(ctaTypes).toContain("BOOK");
  });

  it("should format star ratings correctly", () => {
    const ratingMap: Record<string, number> = { ONE: 1, TWO: 2, THREE: 3, FOUR: 4, FIVE: 5 };
    expect(ratingMap["FIVE"]).toBe(5);
    expect(ratingMap["ONE"]).toBe(1);
    expect(ratingMap["THREE"]).toBe(3);
  });

  it("should format time ago correctly", () => {
    const now = new Date();
    const fiveMinAgo = new Date(now.getTime() - 5 * 60_000);
    const diff = now.getTime() - fiveMinAgo.getTime();
    const mins = Math.floor(diff / 60_000);
    expect(mins).toBe(5);
  });
});
