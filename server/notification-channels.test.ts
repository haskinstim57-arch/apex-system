import { describe, it, expect } from "vitest";
import {
  parseNotificationPreferences,
  isEventTypeEnabled,
  isChannelEnabled,
  DEFAULT_NOTIFICATION_PREFERENCES,
} from "./services/pushBatcher";

describe("Multi-Channel Notification Preferences", () => {
  describe("parseNotificationPreferences", () => {
    it("should return defaults when input is null", () => {
      const prefs = parseNotificationPreferences(null);
      expect(prefs.inbound_sms).toEqual({ push: true, sms: false, email: false });
      expect(prefs.facebook_lead).toEqual({ push: true, sms: false, email: false });
      expect(prefs.quiet_hours_enabled).toBe(false);
    });

    it("should return defaults when input is empty string", () => {
      const prefs = parseNotificationPreferences("");
      expect(prefs.inbound_sms).toEqual({ push: true, sms: false, email: false });
    });

    it("should return defaults when input is invalid JSON", () => {
      const prefs = parseNotificationPreferences("{bad json");
      expect(prefs.inbound_sms).toEqual({ push: true, sms: false, email: false });
    });

    it("should normalize legacy boolean true to { push: true, sms: false, email: false }", () => {
      const legacy = JSON.stringify({
        inbound_sms: true,
        inbound_email: false,
        appointment_booked: true,
        ai_call_completed: true,
        facebook_lead: false,
        quiet_hours_enabled: false,
        quiet_hours_start: "22:00",
        quiet_hours_end: "07:00",
        quiet_hours_timezone: "America/New_York",
      });
      const prefs = parseNotificationPreferences(legacy);
      expect(prefs.inbound_sms).toEqual({ push: true, sms: false, email: false });
      expect(prefs.inbound_email).toEqual({ push: false, sms: false, email: false });
      expect(prefs.facebook_lead).toEqual({ push: false, sms: false, email: false });
    });

    it("should parse new channel object format correctly", () => {
      const newFormat = JSON.stringify({
        inbound_sms: { push: true, sms: true, email: false },
        inbound_email: { push: false, sms: false, email: true },
        appointment_booked: { push: true, sms: false, email: true },
        ai_call_completed: { push: true, sms: false, email: false },
        facebook_lead: { push: true, sms: true, email: true },
        quiet_hours_enabled: true,
        quiet_hours_start: "23:00",
        quiet_hours_end: "08:00",
        quiet_hours_timezone: "America/Chicago",
      });
      const prefs = parseNotificationPreferences(newFormat);
      expect(prefs.inbound_sms).toEqual({ push: true, sms: true, email: false });
      expect(prefs.inbound_email).toEqual({ push: false, sms: false, email: true });
      expect(prefs.facebook_lead).toEqual({ push: true, sms: true, email: true });
      expect(prefs.quiet_hours_enabled).toBe(true);
      expect(prefs.quiet_hours_start).toBe("23:00");
      expect(prefs.quiet_hours_timezone).toBe("America/Chicago");
    });

    it("should handle partial channel objects with missing fields", () => {
      const partial = JSON.stringify({
        inbound_sms: { push: false },
        inbound_email: { sms: true },
        appointment_booked: {},
        ai_call_completed: true,
        facebook_lead: false,
      });
      const prefs = parseNotificationPreferences(partial);
      expect(prefs.inbound_sms).toEqual({ push: false, sms: false, email: false });
      expect(prefs.inbound_email).toEqual({ push: true, sms: true, email: false });
      expect(prefs.appointment_booked).toEqual({ push: true, sms: false, email: false });
      expect(prefs.ai_call_completed).toEqual({ push: true, sms: false, email: false });
      expect(prefs.facebook_lead).toEqual({ push: false, sms: false, email: false });
    });
  });

  describe("isEventTypeEnabled", () => {
    it("should check the push channel for new format", () => {
      const prefs = parseNotificationPreferences(
        JSON.stringify({
          inbound_sms: { push: true, sms: false, email: false },
          inbound_email: { push: false, sms: true, email: true },
          appointment_booked: { push: true, sms: false, email: false },
          ai_call_completed: { push: true, sms: false, email: false },
          facebook_lead: { push: true, sms: false, email: false },
        })
      );
      expect(isEventTypeEnabled(prefs, "inbound_sms")).toBe(true);
      expect(isEventTypeEnabled(prefs, "inbound_email")).toBe(false);
    });

    it("should return true for defaults", () => {
      const prefs = parseNotificationPreferences(null);
      expect(isEventTypeEnabled(prefs, "inbound_sms")).toBe(true);
      expect(isEventTypeEnabled(prefs, "facebook_lead")).toBe(true);
    });

    it("should handle legacy boolean format via normalization", () => {
      const prefs = parseNotificationPreferences(
        JSON.stringify({ inbound_sms: false, inbound_email: true, appointment_booked: true, ai_call_completed: true, facebook_lead: true })
      );
      expect(isEventTypeEnabled(prefs, "inbound_sms")).toBe(false);
      expect(isEventTypeEnabled(prefs, "inbound_email")).toBe(true);
    });
  });

  describe("isChannelEnabled", () => {
    it("should check specific channels", () => {
      const prefs = parseNotificationPreferences(
        JSON.stringify({
          inbound_sms: { push: true, sms: true, email: false },
          inbound_email: { push: false, sms: false, email: true },
          appointment_booked: { push: true, sms: false, email: false },
          ai_call_completed: { push: true, sms: false, email: false },
          facebook_lead: { push: true, sms: false, email: false },
        })
      );
      expect(isChannelEnabled(prefs, "inbound_sms", "push")).toBe(true);
      expect(isChannelEnabled(prefs, "inbound_sms", "sms")).toBe(true);
      expect(isChannelEnabled(prefs, "inbound_sms", "email")).toBe(false);
      expect(isChannelEnabled(prefs, "inbound_email", "push")).toBe(false);
      expect(isChannelEnabled(prefs, "inbound_email", "email")).toBe(true);
    });

    it("should return push=true for defaults", () => {
      const prefs = parseNotificationPreferences(null);
      expect(isChannelEnabled(prefs, "inbound_sms", "push")).toBe(true);
      expect(isChannelEnabled(prefs, "inbound_sms", "sms")).toBe(false);
      expect(isChannelEnabled(prefs, "inbound_sms", "email")).toBe(false);
    });
  });

  describe("DEFAULT_NOTIFICATION_PREFERENCES", () => {
    it("should have all event types with push=true, sms=false, email=false", () => {
      const eventTypes = ["inbound_sms", "inbound_email", "appointment_booked", "ai_call_completed", "facebook_lead"] as const;
      for (const et of eventTypes) {
        expect(DEFAULT_NOTIFICATION_PREFERENCES[et]).toEqual({ push: true, sms: false, email: false });
      }
    });

    it("should have quiet hours disabled by default", () => {
      expect(DEFAULT_NOTIFICATION_PREFERENCES.quiet_hours_enabled).toBe(false);
    });
  });
});
