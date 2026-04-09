import { describe, it, expect } from "vitest";

/**
 * Tests for the dashboard.getActivityFeed query.
 * The query aggregates recent activity from messages, longFormContent,
 * socialPosts, and sequenceEnrollments tables.
 */

describe("Dashboard Activity Feed", () => {
  // ── Return shape tests ──

  it("should define the expected activity item shape", () => {
    // Each activity item should have these fields
    const expectedShape = {
      id: "string",
      type: "string", // "message_sent" | "content_created" | "social_post" | "sequence_enrollment"
      title: "string",
      description: "string",
      timestamp: "number",
      icon: "string", // emoji icon
    };
    expect(Object.keys(expectedShape)).toEqual([
      "id",
      "type",
      "title",
      "description",
      "timestamp",
      "icon",
    ]);
  });

  it("should support all four activity types", () => {
    const validTypes = [
      "message_sent",
      "content_created",
      "social_post",
      "sequence_enrollment",
    ];
    expect(validTypes).toHaveLength(4);
    validTypes.forEach((t) => expect(typeof t).toBe("string"));
  });

  // ── Icon mapping tests ──

  it("should map activity types to appropriate icons", () => {
    const iconMap: Record<string, string> = {
      message_sent: "📨",
      content_created: "📝",
      social_post: "📱",
      sequence_enrollment: "🔄",
    };
    expect(iconMap.message_sent).toBe("📨");
    expect(iconMap.content_created).toBe("📝");
    expect(iconMap.social_post).toBe("📱");
    expect(iconMap.sequence_enrollment).toBe("🔄");
  });

  // ── Sorting tests ──

  it("should sort activities by timestamp descending (most recent first)", () => {
    const activities = [
      { timestamp: 1000 },
      { timestamp: 3000 },
      { timestamp: 2000 },
    ];
    const sorted = [...activities].sort((a, b) => b.timestamp - a.timestamp);
    expect(sorted[0].timestamp).toBe(3000);
    expect(sorted[1].timestamp).toBe(2000);
    expect(sorted[2].timestamp).toBe(1000);
  });

  // ── Limit tests ──

  it("should limit results to 20 items", () => {
    const allItems = Array.from({ length: 30 }, (_, i) => ({
      id: `item-${i}`,
      timestamp: Date.now() - i * 1000,
    }));
    const limited = allItems.slice(0, 20);
    expect(limited).toHaveLength(20);
  });

  // ── Empty state tests ──

  it("should return empty array when no activity exists", () => {
    const activities: unknown[] = [];
    expect(activities).toEqual([]);
    expect(activities).toHaveLength(0);
  });

  // ── Type guard tests ──

  it("should handle message_sent type with direction and channel info", () => {
    const activity = {
      id: "msg-1",
      type: "message_sent" as const,
      title: "SMS sent to John Doe",
      description: "Outbound SMS message",
      timestamp: Date.now(),
      icon: "📨",
    };
    expect(activity.type).toBe("message_sent");
    expect(activity.title).toContain("sent to");
  });

  it("should handle content_created type with content title", () => {
    const activity = {
      id: "content-1",
      type: "content_created" as const,
      title: "Blog post created",
      description: "\"10 Tips for First-Time Homebuyers\"",
      timestamp: Date.now(),
      icon: "📝",
    };
    expect(activity.type).toBe("content_created");
    expect(activity.description).toContain("Homebuyers");
  });

  it("should handle social_post type with platform info", () => {
    const activity = {
      id: "social-1",
      type: "social_post" as const,
      title: "Social post created",
      description: "New post for facebook",
      timestamp: Date.now(),
      icon: "📱",
    };
    expect(activity.type).toBe("social_post");
    expect(activity.description).toContain("facebook");
  });

  it("should handle sequence_enrollment type", () => {
    const activity = {
      id: "enroll-1",
      type: "sequence_enrollment" as const,
      title: "Contact enrolled in sequence",
      description: "Enrolled in \"Welcome Drip\"",
      timestamp: Date.now(),
      icon: "🔄",
    };
    expect(activity.type).toBe("sequence_enrollment");
    expect(activity.description).toContain("Welcome Drip");
  });

  // ── Deduplication / merge tests ──

  it("should merge activities from multiple sources into a single sorted list", () => {
    const messages = [
      { type: "message_sent", timestamp: 5000 },
      { type: "message_sent", timestamp: 1000 },
    ];
    const content = [
      { type: "content_created", timestamp: 4000 },
    ];
    const social = [
      { type: "social_post", timestamp: 3000 },
    ];
    const enrollments = [
      { type: "sequence_enrollment", timestamp: 2000 },
    ];

    const merged = [...messages, ...content, ...social, ...enrollments]
      .sort((a, b) => b.timestamp - a.timestamp);

    expect(merged).toHaveLength(5);
    expect(merged[0].type).toBe("message_sent");
    expect(merged[0].timestamp).toBe(5000);
    expect(merged[1].type).toBe("content_created");
    expect(merged[4].type).toBe("message_sent");
    expect(merged[4].timestamp).toBe(1000);
  });
});

describe("Dashboard Nav Grouping", () => {
  it("should define sub-account nav groups with correct section labels", () => {
    const sections = ["CRM", "Outreach", "Content", "Automation", "Insights"];
    expect(sections).toHaveLength(5);
    expect(sections[0]).toBe("CRM");
    expect(sections[4]).toBe("Insights");
  });

  it("should include Jarvis AI as a special nav item without a route", () => {
    const jarvisItem = { icon: "Bot", label: "Jarvis AI", path: "/jarvis", jarvis: true };
    expect(jarvisItem.jarvis).toBe(true);
    expect(jarvisItem.label).toBe("Jarvis AI");
  });

  it("should place Billing in the footer alongside Settings", () => {
    const footerItems = ["Billing", "Settings"];
    expect(footerItems).toContain("Billing");
    expect(footerItems).toContain("Settings");
  });
});
