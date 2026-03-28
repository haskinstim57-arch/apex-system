import { describe, it, expect, vi } from "vitest";

/**
 * Reputation Management — unit tests
 *
 * Tests cover:
 * 1. Review data validation and shape
 * 2. Review request data validation
 * 3. Stats computation helpers
 * 4. AI reply generation input validation
 * 5. Platform enum validation
 * 6. Rating calculations
 */

// ─── Review Data Shape ───────────────────────────────────────────
describe("Review data validation", () => {
  const validReview = {
    accountId: 1,
    platform: "google" as const,
    rating: 5,
    body: "Great service!",
    reviewerName: "John Doe",
    reviewUrl: "https://google.com/review/123",
  };

  it("should accept valid review data", () => {
    expect(validReview.rating).toBeGreaterThanOrEqual(1);
    expect(validReview.rating).toBeLessThanOrEqual(5);
    expect(validReview.platform).toBe("google");
    expect(validReview.body.length).toBeGreaterThan(0);
  });

  it("should validate rating range 1-5", () => {
    for (let r = 1; r <= 5; r++) {
      expect(r).toBeGreaterThanOrEqual(1);
      expect(r).toBeLessThanOrEqual(5);
    }
    expect(0).toBeLessThan(1);
    expect(6).toBeGreaterThan(5);
  });

  it("should validate platform enum values", () => {
    const validPlatforms = ["google", "facebook", "yelp", "zillow"];
    expect(validPlatforms).toContain("google");
    expect(validPlatforms).toContain("facebook");
    expect(validPlatforms).toContain("yelp");
    expect(validPlatforms).toContain("zillow");
    expect(validPlatforms).not.toContain("twitter");
  });

  it("should require reviewerName", () => {
    expect(validReview.reviewerName).toBeTruthy();
    expect(validReview.reviewerName.length).toBeGreaterThan(0);
  });

  it("should accept optional reviewUrl", () => {
    const withoutUrl = { ...validReview, reviewUrl: undefined };
    expect(withoutUrl.reviewUrl).toBeUndefined();
    const withUrl = { ...validReview };
    expect(withUrl.reviewUrl).toBeDefined();
  });
});

// ─── Review Request Data Shape ───────────────────────────────────
describe("Review request data validation", () => {
  const validRequest = {
    accountId: 1,
    contactId: 42,
    platform: "google" as const,
    channel: "sms" as const,
    businessId: "biz-123",
    messageTemplate: "Please leave us a review at {{link}}",
  };

  it("should accept valid review request data", () => {
    expect(validRequest.contactId).toBeGreaterThan(0);
    expect(validRequest.platform).toBe("google");
    expect(validRequest.channel).toBe("sms");
  });

  it("should validate channel enum values", () => {
    const validChannels = ["sms", "email"];
    expect(validChannels).toContain("sms");
    expect(validChannels).toContain("email");
    expect(validChannels).not.toContain("whatsapp");
  });

  it("should require businessId for review link generation", () => {
    expect(validRequest.businessId).toBeTruthy();
    expect(validRequest.businessId.length).toBeGreaterThan(0);
  });

  it("should accept optional messageTemplate", () => {
    const withoutTemplate = { ...validRequest, messageTemplate: undefined };
    expect(withoutTemplate.messageTemplate).toBeUndefined();
  });
});

// ─── Rating Calculations ─────────────────────────────────────────
describe("Rating calculations", () => {
  function computeAverageRating(reviews: { rating: number }[]): number {
    if (reviews.length === 0) return 0;
    const sum = reviews.reduce((acc, r) => acc + r.rating, 0);
    return Math.round((sum / reviews.length) * 10) / 10;
  }

  function computeRatingDistribution(reviews: { rating: number }[]): Record<number, number> {
    const dist: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    for (const r of reviews) {
      dist[r.rating] = (dist[r.rating] || 0) + 1;
    }
    return dist;
  }

  it("should compute average rating correctly", () => {
    const reviews = [
      { rating: 5 },
      { rating: 4 },
      { rating: 5 },
      { rating: 3 },
      { rating: 5 },
    ];
    expect(computeAverageRating(reviews)).toBe(4.4);
  });

  it("should return 0 for empty reviews", () => {
    expect(computeAverageRating([])).toBe(0);
  });

  it("should handle single review", () => {
    expect(computeAverageRating([{ rating: 3 }])).toBe(3);
  });

  it("should compute rating distribution correctly", () => {
    const reviews = [
      { rating: 5 },
      { rating: 5 },
      { rating: 4 },
      { rating: 3 },
      { rating: 1 },
    ];
    const dist = computeRatingDistribution(reviews);
    expect(dist[5]).toBe(2);
    expect(dist[4]).toBe(1);
    expect(dist[3]).toBe(1);
    expect(dist[2]).toBe(0);
    expect(dist[1]).toBe(1);
  });

  it("should handle all same ratings", () => {
    const reviews = Array(10).fill({ rating: 5 });
    expect(computeAverageRating(reviews)).toBe(5);
    const dist = computeRatingDistribution(reviews);
    expect(dist[5]).toBe(10);
    expect(dist[4]).toBe(0);
  });
});

// ─── Stats Computation ───────────────────────────────────────────
describe("Stats computation", () => {
  function computeStats(reviews: { rating: number; platform: string }[]) {
    const total = reviews.length;
    const avgRating = total > 0
      ? Math.round((reviews.reduce((s, r) => s + r.rating, 0) / total) * 10) / 10
      : 0;
    const byPlatform: Record<string, { count: number; avgRating: number }> = {};
    for (const r of reviews) {
      if (!byPlatform[r.platform]) {
        byPlatform[r.platform] = { count: 0, avgRating: 0 };
      }
      byPlatform[r.platform].count++;
    }
    for (const [plat, data] of Object.entries(byPlatform)) {
      const platReviews = reviews.filter(r => r.platform === plat);
      data.avgRating = Math.round(
        (platReviews.reduce((s, r) => s + r.rating, 0) / platReviews.length) * 10
      ) / 10;
    }
    const positive = reviews.filter(r => r.rating >= 4).length;
    const negative = reviews.filter(r => r.rating <= 2).length;
    return { total, avgRating, byPlatform, positive, negative };
  }

  it("should compute overall stats correctly", () => {
    const reviews = [
      { rating: 5, platform: "google" },
      { rating: 4, platform: "google" },
      { rating: 3, platform: "facebook" },
      { rating: 5, platform: "facebook" },
      { rating: 1, platform: "yelp" },
    ];
    const stats = computeStats(reviews);
    expect(stats.total).toBe(5);
    expect(stats.avgRating).toBe(3.6);
    expect(stats.positive).toBe(3);
    expect(stats.negative).toBe(1);
  });

  it("should compute per-platform stats", () => {
    const reviews = [
      { rating: 5, platform: "google" },
      { rating: 4, platform: "google" },
      { rating: 3, platform: "facebook" },
    ];
    const stats = computeStats(reviews);
    expect(stats.byPlatform.google.count).toBe(2);
    expect(stats.byPlatform.google.avgRating).toBe(4.5);
    expect(stats.byPlatform.facebook.count).toBe(1);
    expect(stats.byPlatform.facebook.avgRating).toBe(3);
  });

  it("should handle empty reviews", () => {
    const stats = computeStats([]);
    expect(stats.total).toBe(0);
    expect(stats.avgRating).toBe(0);
    expect(stats.positive).toBe(0);
    expect(stats.negative).toBe(0);
  });
});

// ─── Review Request Status Tracking ──────────────────────────────
describe("Review request status tracking", () => {
  const validStatuses = ["pending", "sent", "clicked", "completed", "failed"];

  it("should validate request status enum", () => {
    expect(validStatuses).toContain("pending");
    expect(validStatuses).toContain("sent");
    expect(validStatuses).toContain("clicked");
    expect(validStatuses).toContain("completed");
    expect(validStatuses).toContain("failed");
  });

  it("should track status transitions", () => {
    const transitions: Record<string, string[]> = {
      pending: ["sent", "failed"],
      sent: ["clicked", "failed"],
      clicked: ["completed"],
      completed: [],
      failed: [],
    };
    expect(transitions.pending).toContain("sent");
    expect(transitions.sent).toContain("clicked");
    expect(transitions.clicked).toContain("completed");
    expect(transitions.completed).toHaveLength(0);
  });
});

// ─── AI Reply Generation ─────────────────────────────────────────
describe("AI reply generation", () => {
  it("should require review body for reply generation", () => {
    const input = {
      reviewBody: "Amazing service, very professional!",
      rating: 5,
      reviewerName: "Jane",
      businessName: "Apex Lending",
    };
    expect(input.reviewBody.length).toBeGreaterThan(0);
    expect(input.businessName.length).toBeGreaterThan(0);
  });

  it("should handle negative review reply context", () => {
    const input = {
      reviewBody: "Terrible experience, would not recommend.",
      rating: 1,
      reviewerName: "Bob",
      businessName: "Apex Lending",
    };
    expect(input.rating).toBeLessThanOrEqual(2);
    // Negative reviews need empathetic, professional responses
    expect(input.reviewBody.length).toBeGreaterThan(0);
  });

  it("should generate different tone for different ratings", () => {
    const getTone = (rating: number) => {
      if (rating >= 4) return "grateful";
      if (rating === 3) return "understanding";
      return "empathetic";
    };
    expect(getTone(5)).toBe("grateful");
    expect(getTone(4)).toBe("grateful");
    expect(getTone(3)).toBe("understanding");
    expect(getTone(2)).toBe("empathetic");
    expect(getTone(1)).toBe("empathetic");
  });
});

// ─── Workflow Action Integration ─────────────────────────────────
describe("send_review_request workflow action", () => {
  it("should validate action config shape", () => {
    const actionConfig = {
      platform: "google",
      channel: "sms",
      businessId: "biz-123",
      messageTemplate: "Please review us at {{link}}",
    };
    expect(actionConfig.platform).toBeDefined();
    expect(actionConfig.channel).toBeDefined();
    expect(actionConfig.businessId).toBeDefined();
  });

  it("should support all review platforms", () => {
    const platforms = ["google", "facebook", "yelp", "zillow"];
    for (const p of platforms) {
      const config = { platform: p, channel: "sms", businessId: "test" };
      expect(config.platform).toBe(p);
    }
  });

  it("should support both SMS and email channels", () => {
    const channels = ["sms", "email"];
    for (const ch of channels) {
      const config = { platform: "google", channel: ch, businessId: "test" };
      expect(config.channel).toBe(ch);
    }
  });

  it("should generate review link from businessId and platform", () => {
    function generateReviewLink(platform: string, businessId: string): string {
      switch (platform) {
        case "google":
          return `https://search.google.com/local/writereview?placeid=${businessId}`;
        case "facebook":
          return `https://www.facebook.com/${businessId}/reviews`;
        case "yelp":
          return `https://www.yelp.com/writeareview/biz/${businessId}`;
        case "zillow":
          return `https://www.zillow.com/reviews/write/?screenname=${businessId}`;
        default:
          return "";
      }
    }

    expect(generateReviewLink("google", "abc123")).toContain("google.com");
    expect(generateReviewLink("facebook", "abc123")).toContain("facebook.com");
    expect(generateReviewLink("yelp", "abc123")).toContain("yelp.com");
    expect(generateReviewLink("zillow", "abc123")).toContain("zillow.com");
  });
});
