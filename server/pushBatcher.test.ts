import { describe, it, expect } from "vitest";
import {
  parseNotificationPreferences,
  isEventTypeEnabled,
  isWithinQuietHours,
  DEFAULT_NOTIFICATION_PREFERENCES,
  buildBatchNotification,
  BATCH_WINDOW_MS,
} from "./services/pushBatcher";
import type { NotificationPreferences, PushEventType } from "./services/pushBatcher";

// ─── parseNotificationPreferences ───────────────────

describe("parseNotificationPreferences", () => {
  it("returns defaults when json is null", () => {
    const prefs = parseNotificationPreferences(null);
    expect(prefs).toEqual(DEFAULT_NOTIFICATION_PREFERENCES);
  });

  it("returns defaults when json is empty string", () => {
    const prefs = parseNotificationPreferences("");
    expect(prefs).toEqual(DEFAULT_NOTIFICATION_PREFERENCES);
  });

  it("returns defaults when json is invalid", () => {
    const prefs = parseNotificationPreferences("{invalid json}");
    expect(prefs).toEqual(DEFAULT_NOTIFICATION_PREFERENCES);
  });

  it("merges partial preferences with defaults", () => {
    const prefs = parseNotificationPreferences(
      JSON.stringify({ inbound_sms: false, quiet_hours_enabled: true })
    );
    // Legacy boolean false normalizes to { push: false, sms: false, email: false }
    expect(prefs.inbound_sms).toEqual({ push: false, sms: false, email: false });
    expect(prefs.quiet_hours_enabled).toBe(true);
    // Defaults preserved
    expect(prefs.inbound_email).toEqual({ push: true, sms: false, email: false });
    expect(prefs.appointment_booked).toEqual({ push: true, sms: false, email: false });
    expect(prefs.quiet_hours_start).toBe("22:00");
  });

  it("parses a full preferences object", () => {
    const full: NotificationPreferences = {
      inbound_sms: { push: false, sms: true, email: false },
      inbound_email: { push: false, sms: false, email: true },
      appointment_booked: { push: true, sms: false, email: false },
      ai_call_completed: { push: false, sms: false, email: false },
      facebook_lead: { push: true, sms: true, email: true },
      message_delivery_failure: { push: true, sms: false, email: true },
      quiet_hours_enabled: true,
      quiet_hours_start: "23:00",
      quiet_hours_end: "06:00",
      quiet_hours_timezone: "America/Chicago",
    };
    const prefs = parseNotificationPreferences(JSON.stringify(full));
    expect(prefs).toEqual(full);
  });
});

// ─── isEventTypeEnabled ─────────────────────────────

describe("isEventTypeEnabled", () => {
  it("returns true for enabled event types", () => {
    const prefs = { ...DEFAULT_NOTIFICATION_PREFERENCES };
    expect(isEventTypeEnabled(prefs, "inbound_sms")).toBe(true);
    expect(isEventTypeEnabled(prefs, "inbound_email")).toBe(true);
    expect(isEventTypeEnabled(prefs, "appointment_booked")).toBe(true);
    expect(isEventTypeEnabled(prefs, "ai_call_completed")).toBe(true);
    expect(isEventTypeEnabled(prefs, "facebook_lead")).toBe(true);
    expect(isEventTypeEnabled(prefs, "message_delivery_failure")).toBe(true);
  });

  it("returns false for disabled event types", () => {
    const prefs: NotificationPreferences = {
      ...DEFAULT_NOTIFICATION_PREFERENCES,
      inbound_sms: { push: false, sms: false, email: false },
      facebook_lead: { push: false, sms: true, email: true },
    };
    // isEventTypeEnabled checks the push channel only
    expect(isEventTypeEnabled(prefs, "inbound_sms")).toBe(false);
    expect(isEventTypeEnabled(prefs, "facebook_lead")).toBe(false);
    // Others still enabled
    expect(isEventTypeEnabled(prefs, "inbound_email")).toBe(true);
  });

  it("defaults to true for unknown event types", () => {
    const prefs = { ...DEFAULT_NOTIFICATION_PREFERENCES };
    // Cast to test fallback behavior
    expect(isEventTypeEnabled(prefs, "unknown_type" as PushEventType)).toBe(true);
  });
});

// ─── isWithinQuietHours ─────────────────────────────

describe("isWithinQuietHours", () => {
  it("returns false when quiet hours are disabled", () => {
    const prefs = { ...DEFAULT_NOTIFICATION_PREFERENCES, quiet_hours_enabled: false };
    expect(isWithinQuietHours(prefs)).toBe(false);
  });

  it("detects overnight quiet hours (22:00 - 07:00) — at 23:00", () => {
    const prefs: NotificationPreferences = {
      ...DEFAULT_NOTIFICATION_PREFERENCES,
      quiet_hours_enabled: true,
      quiet_hours_start: "22:00",
      quiet_hours_end: "07:00",
      quiet_hours_timezone: "UTC",
    };
    // 23:00 UTC — should be within quiet hours
    const at2300 = new Date("2026-03-29T23:00:00Z");
    expect(isWithinQuietHours(prefs, at2300)).toBe(true);
  });

  it("detects overnight quiet hours (22:00 - 07:00) — at 03:00", () => {
    const prefs: NotificationPreferences = {
      ...DEFAULT_NOTIFICATION_PREFERENCES,
      quiet_hours_enabled: true,
      quiet_hours_start: "22:00",
      quiet_hours_end: "07:00",
      quiet_hours_timezone: "UTC",
    };
    // 03:00 UTC — should be within quiet hours
    const at0300 = new Date("2026-03-30T03:00:00Z");
    expect(isWithinQuietHours(prefs, at0300)).toBe(true);
  });

  it("detects overnight quiet hours (22:00 - 07:00) — at 12:00 (outside)", () => {
    const prefs: NotificationPreferences = {
      ...DEFAULT_NOTIFICATION_PREFERENCES,
      quiet_hours_enabled: true,
      quiet_hours_start: "22:00",
      quiet_hours_end: "07:00",
      quiet_hours_timezone: "UTC",
    };
    // 12:00 UTC — should NOT be within quiet hours
    const at1200 = new Date("2026-03-29T12:00:00Z");
    expect(isWithinQuietHours(prefs, at1200)).toBe(false);
  });

  it("detects same-day quiet hours (13:00 - 14:00) — at 13:30 (inside)", () => {
    const prefs: NotificationPreferences = {
      ...DEFAULT_NOTIFICATION_PREFERENCES,
      quiet_hours_enabled: true,
      quiet_hours_start: "13:00",
      quiet_hours_end: "14:00",
      quiet_hours_timezone: "UTC",
    };
    const at1330 = new Date("2026-03-29T13:30:00Z");
    expect(isWithinQuietHours(prefs, at1330)).toBe(true);
  });

  it("detects same-day quiet hours (13:00 - 14:00) — at 14:00 (boundary, outside)", () => {
    const prefs: NotificationPreferences = {
      ...DEFAULT_NOTIFICATION_PREFERENCES,
      quiet_hours_enabled: true,
      quiet_hours_start: "13:00",
      quiet_hours_end: "14:00",
      quiet_hours_timezone: "UTC",
    };
    const at1400 = new Date("2026-03-29T14:00:00Z");
    expect(isWithinQuietHours(prefs, at1400)).toBe(false);
  });

  it("handles timezone conversion — ET quiet hours at 23:00 UTC (18:00 ET in March)", () => {
    const prefs: NotificationPreferences = {
      ...DEFAULT_NOTIFICATION_PREFERENCES,
      quiet_hours_enabled: true,
      quiet_hours_start: "22:00",
      quiet_hours_end: "07:00",
      quiet_hours_timezone: "America/New_York",
    };
    // March 29, 2026 23:00 UTC = 19:00 ET (EDT) — NOT within quiet hours
    const at2300utc = new Date("2026-03-29T23:00:00Z");
    expect(isWithinQuietHours(prefs, at2300utc)).toBe(false);
  });

  it("handles timezone conversion — ET quiet hours at 03:00 UTC (23:00 ET in March)", () => {
    const prefs: NotificationPreferences = {
      ...DEFAULT_NOTIFICATION_PREFERENCES,
      quiet_hours_enabled: true,
      quiet_hours_start: "22:00",
      quiet_hours_end: "07:00",
      quiet_hours_timezone: "America/New_York",
    };
    // March 30, 2026 03:00 UTC = 23:00 ET (EDT) — WITHIN quiet hours
    const at0300utc = new Date("2026-03-30T03:00:00Z");
    expect(isWithinQuietHours(prefs, at0300utc)).toBe(true);
  });

  it("falls back to UTC for invalid timezone", () => {
    const prefs: NotificationPreferences = {
      ...DEFAULT_NOTIFICATION_PREFERENCES,
      quiet_hours_enabled: true,
      quiet_hours_start: "22:00",
      quiet_hours_end: "07:00",
      quiet_hours_timezone: "Invalid/Timezone",
    };
    // 23:00 UTC — should be within quiet hours (falls back to UTC)
    const at2300 = new Date("2026-03-29T23:00:00Z");
    expect(isWithinQuietHours(prefs, at2300)).toBe(true);
  });
});

// ─── buildBatchNotification ─────────────────────────

describe("buildBatchNotification", () => {
  it("returns original payload for single event", () => {
    const result = buildBatchNotification("inbound_sms", 1, [
      { title: "New SMS from John", body: "Hey, are you available?", url: "/inbox/123", contactName: "John" },
    ]);
    expect(result.title).toBe("New SMS from John");
    expect(result.body).toBe("Hey, are you available?");
    expect(result.url).toBe("/inbox/123");
    expect(result.tag).toBe("inbound_sms-single");
  });

  it("builds grouped notification for multiple SMS events", () => {
    const payloads = [
      { title: "New SMS", body: "Message 1", contactName: "Alice" },
      { title: "New SMS", body: "Message 2", contactName: "Bob" },
      { title: "New SMS", body: "Message 3", contactName: "Charlie" },
    ];
    const result = buildBatchNotification("inbound_sms", 3, payloads);
    expect(result.title).toBe("3 new SMS messages");
    expect(result.body).toContain("Alice");
    expect(result.body).toContain("Bob");
    expect(result.body).toContain("Charlie");
    expect(result.url).toBe("/inbox");
    expect(result.tag).toBe("inbound_sms-batch");
  });

  it("builds grouped notification for many Facebook leads", () => {
    const payloads = Array.from({ length: 10 }, (_, i) => ({
      title: "New Lead",
      body: `Lead ${i + 1}`,
      contactName: `Lead ${i + 1}`,
    }));
    const result = buildBatchNotification("facebook_lead", 10, payloads);
    expect(result.title).toBe("10 new Facebook leads");
    // Shows first 3 names + remaining count
    expect(result.body).toContain("Lead 1");
    expect(result.body).toContain("Lead 2");
    expect(result.body).toContain("Lead 3");
    expect(result.body).toContain("7 more");
    expect(result.url).toBe("/contacts");
    expect(result.tag).toBe("facebook_lead-batch");
  });

  it("builds grouped notification for appointments", () => {
    const payloads = [
      { title: "Appointment", body: "Booked", contactName: "Jane" },
      { title: "Appointment", body: "Booked", contactName: "Mike" },
    ];
    const result = buildBatchNotification("appointment_booked", 2, payloads);
    expect(result.title).toBe("2 new appointments");
    expect(result.body).toContain("Jane");
    expect(result.body).toContain("Mike");
    expect(result.url).toBe("/calendar");
    expect(result.tag).toBe("appointment_booked-batch");
  });

  it("builds grouped notification for AI calls", () => {
    const payloads = [
      { title: "Call", body: "Completed", contactName: "Tom" },
      { title: "Call", body: "Completed" },
    ];
    const result = buildBatchNotification("ai_call_completed", 2, payloads);
    expect(result.title).toBe("2 AI calls completed");
    expect(result.body).toContain("Tom");
    expect(result.body).toContain("1 more");
    expect(result.url).toBe("/ai-calls");
  });

  it("handles payloads without contact names", () => {
    const payloads = [
      { title: "New Email", body: "Subject: Hello" },
      { title: "New Email", body: "Subject: World" },
    ];
    const result = buildBatchNotification("inbound_email", 2, payloads);
    expect(result.title).toBe("2 new emails");
    // Falls back to first payload body since no names
    expect(result.body).toBe("Subject: Hello");
    expect(result.url).toBe("/inbox");
  });

  it("handles empty payloads array for multiple events", () => {
    const result = buildBatchNotification("inbound_sms", 5, []);
    expect(result.title).toBe("5 new SMS messages");
    expect(result.body).toBe("You have 5 new SMS messages");
  });

  it("uses default url '/' for single event with no url", () => {
    const result = buildBatchNotification("inbound_sms", 1, [
      { title: "Test", body: "Test body" },
    ]);
    expect(result.url).toBe("/");
  });
});

// ─── BATCH_WINDOW_MS configuration ─────────────────

describe("BATCH_WINDOW_MS", () => {
  it("is set to 30 seconds", () => {
    expect(BATCH_WINDOW_MS).toBe(30_000);
  });
});

// ─── Integration: preferences + quiet hours ─────────

describe("Preferences + Quiet Hours integration", () => {
  it("event disabled + outside quiet hours = should not send", () => {
    const prefs: NotificationPreferences = {
      ...DEFAULT_NOTIFICATION_PREFERENCES,
      inbound_sms: { push: false, sms: false, email: false },
      quiet_hours_enabled: false,
    };
    expect(isEventTypeEnabled(prefs, "inbound_sms")).toBe(false);
    expect(isWithinQuietHours(prefs)).toBe(false);
    // Logic: if !isEventTypeEnabled → skip (don't send)
  });

  it("event enabled + within quiet hours = should not send", () => {
    const prefs: NotificationPreferences = {
      ...DEFAULT_NOTIFICATION_PREFERENCES,
      inbound_sms: { push: true, sms: false, email: false },
      quiet_hours_enabled: true,
      quiet_hours_start: "00:00",
      quiet_hours_end: "23:59",
      quiet_hours_timezone: "UTC",
    };
    const now = new Date("2026-03-29T12:00:00Z");
    expect(isEventTypeEnabled(prefs, "inbound_sms")).toBe(true);
    expect(isWithinQuietHours(prefs, now)).toBe(true);
    // Logic: if isWithinQuietHours → suppress
  });

  it("event enabled + outside quiet hours = should send", () => {
    const prefs: NotificationPreferences = {
      ...DEFAULT_NOTIFICATION_PREFERENCES,
      inbound_sms: { push: true, sms: false, email: false },
      quiet_hours_enabled: true,
      quiet_hours_start: "22:00",
      quiet_hours_end: "07:00",
      quiet_hours_timezone: "UTC",
    };
    const now = new Date("2026-03-29T12:00:00Z");
    expect(isEventTypeEnabled(prefs, "inbound_sms")).toBe(true);
    expect(isWithinQuietHours(prefs, now)).toBe(false);
    // Logic: enabled + not quiet → send
  });

  it("all events disabled = nothing should send", () => {
    const prefs: NotificationPreferences = {
      ...DEFAULT_NOTIFICATION_PREFERENCES,
      inbound_sms: { push: false, sms: false, email: false },
      inbound_email: { push: false, sms: false, email: false },
      appointment_booked: { push: false, sms: false, email: false },
      ai_call_completed: { push: false, sms: false, email: false },
      facebook_lead: { push: false, sms: false, email: false },
    };
    const eventTypes: PushEventType[] = [
      "inbound_sms", "inbound_email", "appointment_booked", "ai_call_completed", "facebook_lead"
    ];
    for (const et of eventTypes) {
      expect(isEventTypeEnabled(prefs, et)).toBe(false);
    }
  });
});
