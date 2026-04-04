import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Test the pure functions (template builders) ───

// We need to import the module to test the template builders.
// Since the module has side-effect imports (db, schema), we mock those.
vi.mock("../drizzle/schema", () => ({
  pushSubscriptions: {},
  users: {},
  accountMembers: {},
}));

vi.mock("./db", () => ({
  getDb: vi.fn().mockResolvedValue(null),
}));

vi.mock("./services/messaging", () => ({
  dispatchEmail: vi.fn().mockResolvedValue({ success: true, provider: "sendgrid" }),
}));

// Import after mocks
const { buildNotificationEmail, buildBatchedNotificationEmail } = await import(
  "./services/emailNotifications"
);

// ─── buildNotificationEmail ────────────────────────

describe("buildNotificationEmail", () => {
  const appUrl = "https://test.example.com";

  it("generates correct subject with emoji for inbound_sms", () => {
    const result = buildNotificationEmail(
      "inbound_sms",
      { title: "New SMS from John", body: "Hey, are you available?", url: "/inbox/123", contactName: "John" },
      appUrl
    );
    expect(result.subject).toBe("💬 New SMS from John");
    expect(result.html).toContain("New SMS from John");
    expect(result.html).toContain("Hey, are you available?");
    expect(result.html).toContain("John");
    expect(result.html).toContain("https://test.example.com/inbox/123");
  });

  it("generates correct subject for appointment_booked", () => {
    const result = buildNotificationEmail(
      "appointment_booked",
      { title: "New Appointment", body: "Jane Doe booked for March 15", url: "/calendar" },
      appUrl
    );
    expect(result.subject).toBe("📅 New Appointment");
    expect(result.html).toContain("Jane Doe booked for March 15");
    expect(result.html).toContain("https://test.example.com/calendar");
  });

  it("generates correct subject for facebook_lead", () => {
    const result = buildNotificationEmail(
      "facebook_lead",
      { title: "New Lead: Alice", body: "From Facebook Mortgage Campaign", contactName: "Alice" },
      appUrl
    );
    expect(result.subject).toBe("📣 New Lead: Alice");
    expect(result.html).toContain("Alice");
    expect(result.html).toContain("Facebook Mortgage Campaign");
  });

  it("generates correct subject for ai_call_completed", () => {
    const result = buildNotificationEmail(
      "ai_call_completed",
      { title: "AI Call Completed", body: "Call with Bob lasted 5 minutes" },
      appUrl
    );
    expect(result.subject).toBe("🤖 AI Call Completed");
    expect(result.html).toContain("Call with Bob lasted 5 minutes");
  });

  it("generates correct subject for inbound_email", () => {
    const result = buildNotificationEmail(
      "inbound_email",
      { title: "New Email from Client", body: "Subject: Loan Application" },
      appUrl
    );
    expect(result.subject).toBe("📧 New Email from Client");
    expect(result.html).toContain("Loan Application");
  });

  it("uses appUrl as fallback when no url in payload", () => {
    const result = buildNotificationEmail(
      "inbound_sms",
      { title: "Test", body: "Test body" },
      appUrl
    );
    expect(result.html).toContain("https://test.example.com");
  });

  it("includes settings link in footer", () => {
    const result = buildNotificationEmail(
      "inbound_sms",
      { title: "Test", body: "Test body" },
      appUrl
    );
    expect(result.html).toContain("Notification Settings");
    expect(result.html).toContain("https://test.example.com/settings");
  });

  it("escapes HTML in payload fields", () => {
    const result = buildNotificationEmail(
      "inbound_sms",
      { title: "Test <script>alert('xss')</script>", body: "Body with <b>tags</b>", contactName: "John & Jane" },
      appUrl
    );
    expect(result.html).not.toContain("<script>");
    expect(result.html).toContain("&lt;script&gt;");
    expect(result.html).toContain("John &amp; Jane");
  });

  it("omits contact name section when not provided", () => {
    const result = buildNotificationEmail(
      "inbound_sms",
      { title: "Test", body: "No contact" },
      appUrl
    );
    expect(result.html).not.toContain("Contact:");
  });

  it("includes contact name section when provided", () => {
    const result = buildNotificationEmail(
      "inbound_sms",
      { title: "Test", body: "With contact", contactName: "Alice" },
      appUrl
    );
    expect(result.html).toContain("Contact:");
    expect(result.html).toContain("Alice");
  });
});

// ─── buildBatchedNotificationEmail ─────────────────

describe("buildBatchedNotificationEmail", () => {
  const appUrl = "https://test.example.com";

  it("uses grouped template even for count=1", () => {
    const result = buildBatchedNotificationEmail(
      "inbound_sms",
      1,
      [{ title: "New SMS from John", body: "Hey there", contactName: "John" }],
      appUrl
    );
    expect(result.subject).toBe("💬 1 new SMS message");
    expect(result.html).toContain("John");
  });

  it("builds grouped subject for multiple SMS events", () => {
    const payloads = [
      { title: "New SMS", body: "Msg 1", contactName: "Alice" },
      { title: "New SMS", body: "Msg 2", contactName: "Bob" },
      { title: "New SMS", body: "Msg 3", contactName: "Charlie" },
    ];
    const result = buildBatchedNotificationEmail("inbound_sms", 3, payloads, appUrl);
    expect(result.subject).toBe("💬 3 new SMS messages");
    expect(result.html).toContain("Alice");
    expect(result.html).toContain("Bob");
    expect(result.html).toContain("Charlie");
  });

  it("builds grouped subject for Facebook leads with overflow", () => {
    const payloads = Array.from({ length: 10 }, (_, i) => ({
      title: "New Lead",
      body: `Lead ${i + 1}`,
      contactName: `Lead ${i + 1}`,
    }));
    const result = buildBatchedNotificationEmail("facebook_lead", 10, payloads, appUrl);
    expect(result.subject).toBe("📣 10 new Facebook leads");
    expect(result.html).toContain("Lead 1");
    expect(result.html).toContain("5 more");
  });

  it("builds grouped subject for appointments", () => {
    const payloads = [
      { title: "Appt", body: "Booked", contactName: "Jane" },
      { title: "Appt", body: "Booked", contactName: "Mike" },
    ];
    const result = buildBatchedNotificationEmail("appointment_booked", 2, payloads, appUrl);
    expect(result.subject).toBe("📅 2 new appointments");
    expect(result.html).toContain("Jane");
    expect(result.html).toContain("Mike");
  });

  it("builds grouped subject for AI calls", () => {
    const payloads = [
      { title: "Call", body: "Done", contactName: "Tom" },
      { title: "Call", body: "Done", contactName: "Sam" },
    ];
    const result = buildBatchedNotificationEmail("ai_call_completed", 2, payloads, appUrl);
    expect(result.subject).toBe("🤖 2 AI calls completed");
  });

  it("handles empty payloads for batched events", () => {
    const result = buildBatchedNotificationEmail("inbound_sms", 5, [], appUrl);
    expect(result.subject).toBe("💬 5 new SMS messages");
    expect(result.html).toContain("5 new SMS messages");
  });

  it("handles payloads without contact names", () => {
    const payloads = [
      { title: "Email", body: "Subject: Hello" },
      { title: "Email", body: "Subject: World" },
    ];
    const result = buildBatchedNotificationEmail("inbound_email", 2, payloads, appUrl);
    expect(result.subject).toBe("📧 2 new emails");
    expect(result.html).toContain("Subject: Hello");
  });
});

// ─── Event type coverage ───────────────────────────

describe("All event types produce valid emails", () => {
  const appUrl = "https://test.example.com";
  const eventTypes = [
    "inbound_sms",
    "inbound_email",
    "appointment_booked",
    "ai_call_completed",
    "facebook_lead",
  ] as const;

  for (const eventType of eventTypes) {
    it(`generates valid HTML for ${eventType}`, () => {
      const result = buildNotificationEmail(
        eventType,
        { title: `Test ${eventType}`, body: `Body for ${eventType}` },
        appUrl
      );
      expect(result.subject).toBeTruthy();
      expect(result.html).toContain("<!DOCTYPE html>");
      expect(result.html).toContain("</html>");
      expect(result.html).toContain(`Test ${eventType}`);
      expect(result.html).toContain(`Body for ${eventType}`);
    });

    it(`generates valid batched HTML for ${eventType}`, () => {
      const result = buildBatchedNotificationEmail(
        eventType,
        3,
        [
          { title: "T1", body: "B1", contactName: "A" },
          { title: "T2", body: "B2", contactName: "B" },
          { title: "T3", body: "B3", contactName: "C" },
        ],
        appUrl
      );
      expect(result.subject).toBeTruthy();
      expect(result.html).toContain("<!DOCTYPE html>");
    });
  }
});
