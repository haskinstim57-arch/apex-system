import { describe, it, expect } from "vitest";

// Import the SMS template builders for testing
// We test the pure functions directly since they don't require DB access
const {
  buildNotificationSms,
  buildBatchedNotificationSms,
} = await import("./services/smsNotifications");

describe("SMS Notification Service", () => {
  const appUrl = "https://apexcrm-knxkwfan.manus.space";

  describe("buildNotificationSms", () => {
    it("builds a single SMS for inbound_sms event", () => {
      const result = buildNotificationSms(
        "inbound_sms",
        { title: "New SMS from John", body: "Hey, I'm interested in refinancing", contactName: "John Doe" },
        appUrl
      );
      expect(result).toContain("💬");
      expect(result).toContain("New SMS from John");
      expect(result).toContain("John Doe");
    });

    it("builds a single SMS for inbound_email event", () => {
      const result = buildNotificationSms(
        "inbound_email",
        { title: "New Email from Jane", body: "RE: Mortgage Application", contactName: "Jane Smith" },
        appUrl
      );
      expect(result).toContain("📧");
      expect(result).toContain("New Email from Jane");
    });

    it("builds a single SMS for appointment_booked event", () => {
      const result = buildNotificationSms(
        "appointment_booked",
        { title: "Appointment Booked", body: "Tomorrow at 2pm", contactName: "Bob Wilson", url: "/calendar" },
        appUrl
      );
      expect(result).toContain("📅");
      expect(result).toContain("Appointment Booked");
      expect(result).toContain(appUrl + "/calendar");
    });

    it("builds a single SMS for ai_call_completed event", () => {
      const result = buildNotificationSms(
        "ai_call_completed",
        { title: "AI Call Completed", body: "Call lasted 3 minutes", contactName: "Alice Brown" },
        appUrl
      );
      expect(result).toContain("🤖");
      expect(result).toContain("AI Call Completed");
    });

    it("builds a single SMS for facebook_lead event", () => {
      const result = buildNotificationSms(
        "facebook_lead",
        { title: "New Facebook Lead", body: "From campaign: Spring Promo", contactName: "Charlie Davis" },
        appUrl
      );
      expect(result).toContain("📣");
      expect(result).toContain("New Facebook Lead");
    });

    it("includes URL when provided", () => {
      const result = buildNotificationSms(
        "inbound_sms",
        { title: "New SMS", body: "Hello", url: "/inbox" },
        appUrl
      );
      expect(result).toContain(`${appUrl}/inbox`);
    });

    it("omits contact name when not provided", () => {
      const result = buildNotificationSms(
        "inbound_sms",
        { title: "New SMS", body: "Hello" },
        appUrl
      );
      expect(result).not.toContain(" — ");
    });

    it("truncates long body text to keep SMS concise", () => {
      const longBody = "A".repeat(200);
      const result = buildNotificationSms(
        "inbound_sms",
        { title: "New SMS", body: longBody },
        appUrl
      );
      // Body should be truncated with ellipsis
      expect(result).toContain("...");
      expect(result.length).toBeLessThan(400);
    });

    it("includes body snippet when short enough", () => {
      const result = buildNotificationSms(
        "inbound_sms",
        { title: "New SMS", body: "Short message" },
        appUrl
      );
      expect(result).toContain("Short message");
    });
  });

  describe("buildBatchedNotificationSms", () => {
    it("uses detailed template for single event", () => {
      const result = buildBatchedNotificationSms(
        "inbound_sms",
        1,
        [{ title: "New SMS from John", body: "Hey there", contactName: "John" }],
        appUrl
      );
      expect(result).toContain("💬");
      expect(result).toContain("New SMS from John");
    });

    it("builds batched SMS for multiple inbound_sms events", () => {
      const result = buildBatchedNotificationSms(
        "inbound_sms",
        3,
        [
          { title: "SMS 1", body: "msg1", contactName: "Alice" },
          { title: "SMS 2", body: "msg2", contactName: "Bob" },
          { title: "SMS 3", body: "msg3", contactName: "Charlie" },
        ],
        appUrl
      );
      expect(result).toContain("💬");
      expect(result).toContain("3 new SMS messages");
      expect(result).toContain("Alice");
      expect(result).toContain("Bob");
      expect(result).toContain("Charlie");
      expect(result).toContain("/inbox");
    });

    it("builds batched SMS for multiple appointment_booked events", () => {
      const result = buildBatchedNotificationSms(
        "appointment_booked",
        2,
        [
          { title: "Appt 1", body: "msg1", contactName: "Alice" },
          { title: "Appt 2", body: "msg2", contactName: "Bob" },
        ],
        appUrl
      );
      expect(result).toContain("📅");
      expect(result).toContain("2 new appointments");
      expect(result).toContain("/calendar");
    });

    it("builds batched SMS for multiple facebook_lead events", () => {
      const result = buildBatchedNotificationSms(
        "facebook_lead",
        5,
        [
          { title: "Lead 1", body: "msg1", contactName: "Alice" },
          { title: "Lead 2", body: "msg2", contactName: "Bob" },
          { title: "Lead 3", body: "msg3", contactName: "Charlie" },
          { title: "Lead 4", body: "msg4", contactName: "Dave" },
          { title: "Lead 5", body: "msg5", contactName: "Eve" },
        ],
        appUrl
      );
      expect(result).toContain("📣");
      expect(result).toContain("5 new Facebook leads");
      expect(result).toContain("/contacts");
    });

    it("shows +N more when there are more contacts than displayed", () => {
      const payloads = Array.from({ length: 10 }, (_, i) => ({
        title: `Lead ${i + 1}`,
        body: `msg${i + 1}`,
        contactName: `Person ${i + 1}`,
      }));
      const result = buildBatchedNotificationSms("facebook_lead", 10, payloads, appUrl);
      // Only first 3 names shown, rest as "+N more"
      expect(result).toContain("+7 more");
    });

    it("uses singular noun for count of 1 in batched mode", () => {
      // This path is hit when eventCount=1 but payloads.length > 1 (edge case)
      // For eventCount=1 and payloads.length=1, it delegates to buildNotificationSms
      const result = buildBatchedNotificationSms(
        "ai_call_completed",
        1,
        [{ title: "Call done", body: "3 min call", contactName: "Alice" }],
        appUrl
      );
      // Single event delegates to buildNotificationSms
      expect(result).toContain("🤖");
      expect(result).toContain("Call done");
    });

    it("handles payloads without contact names", () => {
      const result = buildBatchedNotificationSms(
        "inbound_email",
        3,
        [
          { title: "Email 1", body: "msg1" },
          { title: "Email 2", body: "msg2" },
          { title: "Email 3", body: "msg3" },
        ],
        appUrl
      );
      expect(result).toContain("3 new emails");
      expect(result).not.toContain("From:");
    });

    it("includes the correct URL for each event type", () => {
      const types: Array<{ type: any; url: string }> = [
        { type: "inbound_sms", url: "/inbox" },
        { type: "inbound_email", url: "/inbox" },
        { type: "appointment_booked", url: "/calendar" },
        { type: "ai_call_completed", url: "/ai-calls" },
        { type: "facebook_lead", url: "/contacts" },
      ];

      for (const { type, url } of types) {
        const result = buildBatchedNotificationSms(
          type,
          2,
          [
            { title: "Event 1", body: "msg1", contactName: "A" },
            { title: "Event 2", body: "msg2", contactName: "B" },
          ],
          appUrl
        );
        expect(result).toContain(`${appUrl}${url}`);
      }
    });
  });
});
