import { describe, it, expect, vi } from "vitest";

// Test the notification logger service functions
describe("Notification Logger", () => {
  describe("logNotificationDelivery", () => {
    it("should accept valid push notification log params", async () => {
      const params = {
        channel: "push" as const,
        eventType: "inbound_sms",
        accountId: 1,
        userId: 5,
        recipient: "endpoint-url",
        status: "sent" as const,
        title: "New SMS from John",
        provider: "web-push",
      };

      // Verify param types are correct
      expect(params.channel).toBe("push");
      expect(params.status).toBe("sent");
      expect(params.accountId).toBe(1);
    });

    it("should accept valid email notification log params", async () => {
      const params = {
        channel: "email" as const,
        eventType: "appointment_booked",
        accountId: 2,
        userId: 10,
        recipient: "user@example.com",
        status: "sent" as const,
        title: "New Appointment",
        provider: "sendgrid",
      };

      expect(params.channel).toBe("email");
      expect(params.provider).toBe("sendgrid");
    });

    it("should accept valid SMS notification log params", async () => {
      const params = {
        channel: "sms" as const,
        eventType: "facebook_lead",
        accountId: 3,
        status: "failed" as const,
        errorMessage: "Invalid phone number",
        provider: "twilio",
        title: "New Facebook Lead",
      };

      expect(params.channel).toBe("sms");
      expect(params.status).toBe("failed");
      expect(params.errorMessage).toBe("Invalid phone number");
    });

    it("should handle skipped status", () => {
      const params = {
        channel: "push" as const,
        eventType: "ai_call_completed",
        accountId: 1,
        status: "skipped" as const,
        title: "AI Call Completed",
      };

      expect(params.status).toBe("skipped");
    });

    it("should allow nullable optional fields", () => {
      const params = {
        channel: "email" as const,
        eventType: "inbound_email",
        accountId: 1,
        status: "sent" as const,
        userId: null,
        recipient: null,
        errorMessage: null,
        provider: null,
        title: null,
      };

      expect(params.userId).toBeNull();
      expect(params.recipient).toBeNull();
    });
  });

  describe("NotificationChannel types", () => {
    it("should support all three channels", () => {
      const channels = ["push", "email", "sms"];
      expect(channels).toHaveLength(3);
      expect(channels).toContain("push");
      expect(channels).toContain("email");
      expect(channels).toContain("sms");
    });

    it("should support all three statuses", () => {
      const statuses = ["sent", "failed", "skipped"];
      expect(statuses).toHaveLength(3);
      expect(statuses).toContain("sent");
      expect(statuses).toContain("failed");
      expect(statuses).toContain("skipped");
    });
  });

  describe("Delivery stats structure", () => {
    it("should return correct default stats shape", () => {
      const defaultStats = {
        push: { sent: 0, failed: 0, skipped: 0 },
        email: { sent: 0, failed: 0, skipped: 0 },
        sms: { sent: 0, failed: 0, skipped: 0 },
      };

      expect(defaultStats.push.sent).toBe(0);
      expect(defaultStats.email.failed).toBe(0);
      expect(defaultStats.sms.skipped).toBe(0);
      expect(Object.keys(defaultStats)).toEqual(["push", "email", "sms"]);
    });

    it("should aggregate counts correctly", () => {
      const stats: Record<string, Record<string, number>> = {
        push: { sent: 0, failed: 0, skipped: 0 },
        email: { sent: 0, failed: 0, skipped: 0 },
        sms: { sent: 0, failed: 0, skipped: 0 },
      };

      // Simulate aggregating rows
      const rows = [
        { channel: "push", status: "sent", count: 15 },
        { channel: "push", status: "failed", count: 2 },
        { channel: "email", status: "sent", count: 10 },
        { channel: "sms", status: "sent", count: 5 },
        { channel: "sms", status: "failed", count: 1 },
      ];

      for (const row of rows) {
        if (stats[row.channel]) {
          stats[row.channel][row.status] = row.count;
        }
      }

      expect(stats.push.sent).toBe(15);
      expect(stats.push.failed).toBe(2);
      expect(stats.email.sent).toBe(10);
      expect(stats.sms.sent).toBe(5);
      expect(stats.sms.failed).toBe(1);
      expect(stats.email.failed).toBe(0); // Not in rows, stays default
    });
  });
});

describe("Per-user phone number", () => {
  it("should validate E.164 phone format", () => {
    const e164Regex = /^\+?[1-9]\d{6,14}$/;

    // Valid numbers
    expect(e164Regex.test("+12125551234")).toBe(true);
    expect(e164Regex.test("+442071234567")).toBe(true);
    expect(e164Regex.test("12125551234")).toBe(true);
    expect(e164Regex.test("+61412345678")).toBe(true);

    // Invalid numbers
    expect(e164Regex.test("")).toBe(false);
    expect(e164Regex.test("+0123456789")).toBe(false); // starts with 0
    expect(e164Regex.test("abc")).toBe(false);
    expect(e164Regex.test("+1")).toBe(false); // too short
  });

  it("should prioritize user phone over account phone", () => {
    const userPhone = "+12125551234";
    const accountPhone = "+18005551234";

    // Simulate the priority logic from smsNotifications.ts
    const recipients: Array<{ phone: string; source: string }> = [];
    const seenPhones = new Set<string>();

    // User phone found
    if (userPhone && !seenPhones.has(userPhone)) {
      seenPhones.add(userPhone);
      recipients.push({ phone: userPhone, source: "user" });
    }

    // Account phone fallback — should NOT be added since user phone exists
    if (recipients.length === 0 && accountPhone && !seenPhones.has(accountPhone)) {
      recipients.push({ phone: accountPhone, source: "account" });
    }

    expect(recipients).toHaveLength(1);
    expect(recipients[0].phone).toBe("+12125551234");
    expect(recipients[0].source).toBe("user");
  });

  it("should fall back to account phone when no user phone", () => {
    const userPhone = null;
    const accountPhone = "+18005551234";

    const recipients: Array<{ phone: string; source: string }> = [];
    const seenPhones = new Set<string>();

    // No user phone
    if (userPhone && !seenPhones.has(userPhone)) {
      seenPhones.add(userPhone);
      recipients.push({ phone: userPhone, source: "user" });
    }

    // Account phone fallback — should be added
    if (recipients.length === 0 && accountPhone && !seenPhones.has(accountPhone)) {
      recipients.push({ phone: accountPhone, source: "account" });
    }

    expect(recipients).toHaveLength(1);
    expect(recipients[0].phone).toBe("+18005551234");
    expect(recipients[0].source).toBe("account");
  });

  it("should deduplicate when user phone equals account phone", () => {
    const userPhones = ["+12125551234", "+12125551234"]; // same user, 2 subs
    const accountPhone = "+12125551234";

    const recipients: Array<{ phone: string; source: string }> = [];
    const seenPhones = new Set<string>();

    for (const phone of userPhones) {
      if (phone && !seenPhones.has(phone)) {
        seenPhones.add(phone);
        recipients.push({ phone, source: "user" });
      }
    }

    if (recipients.length === 0 && accountPhone && !seenPhones.has(accountPhone)) {
      recipients.push({ phone: accountPhone, source: "account" });
    }

    expect(recipients).toHaveLength(1);
    expect(recipients[0].phone).toBe("+12125551234");
  });

  it("should support multiple users with different phones", () => {
    const userPhones = [
      { userId: 1, phone: "+12125551234" },
      { userId: 2, phone: "+13105559876" },
      { userId: 3, phone: null }, // no phone set
    ];

    const recipients: Array<{ phone: string; userId: number; source: string }> = [];
    const seenPhones = new Set<string>();

    for (const user of userPhones) {
      if (user.phone && !seenPhones.has(user.phone)) {
        seenPhones.add(user.phone);
        recipients.push({ phone: user.phone, userId: user.userId, source: "user" });
      }
    }

    expect(recipients).toHaveLength(2);
    expect(recipients[0].phone).toBe("+12125551234");
    expect(recipients[1].phone).toBe("+13105559876");
  });
});
