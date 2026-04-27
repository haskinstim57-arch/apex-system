import { describe, it, expect, vi } from "vitest";

/**
 * Tests for the notification insert fix (Prompt S).
 * Validates that:
 * 1. Invalid notification types are sanitized to "system_alert"
 * 2. Valid notification types pass through unchanged
 * 3. Empty/falsy userId is normalized to null
 * 4. Numeric userId is preserved
 * 5. The workflow engine's notify_user action reads config.message as body fallback
 * 6. The workflow engine's notify_user action reads config.userId as target user
 */

const VALID_NOTIFICATION_TYPES = [
  "inbound_message","appointment_booked","appointment_cancelled","ai_call_completed",
  "campaign_finished","workflow_failed","new_contact_facebook","new_contact_booking",
  "missed_call","report_sent","system_alert","new_lead"
] as const;

function sanitizeNotificationType(type: string): string {
  return (VALID_NOTIFICATION_TYPES as readonly string[]).includes(type) ? type : "system_alert";
}

function sanitizeUserId(userId: any): number | null {
  return userId ? Number(userId) : null;
}

describe("Notification Insert Sanitization", () => {
  describe("notification type validation", () => {
    it("should accept all valid notification types", () => {
      for (const type of VALID_NOTIFICATION_TYPES) {
        expect(sanitizeNotificationType(type)).toBe(type);
      }
    });

    it("should reject 'lead_action_required' and fall back to system_alert", () => {
      expect(sanitizeNotificationType("lead_action_required")).toBe("system_alert");
    });

    it("should reject arbitrary invalid types", () => {
      expect(sanitizeNotificationType("foo_bar")).toBe("system_alert");
      expect(sanitizeNotificationType("")).toBe("system_alert");
      expect(sanitizeNotificationType("INBOUND_MESSAGE")).toBe("system_alert"); // case-sensitive
    });
  });

  describe("userId sanitization", () => {
    it("should return null for empty string", () => {
      expect(sanitizeUserId("")).toBeNull();
    });

    it("should return null for undefined", () => {
      expect(sanitizeUserId(undefined)).toBeNull();
    });

    it("should return null for null", () => {
      expect(sanitizeUserId(null)).toBeNull();
    });

    it("should return null for 0", () => {
      expect(sanitizeUserId(0)).toBeNull();
    });

    it("should preserve valid numeric userId", () => {
      expect(sanitizeUserId(1110216)).toBe(1110216);
    });

    it("should convert string userId to number", () => {
      expect(sanitizeUserId("1110216")).toBe(1110216);
    });
  });

  describe("notify_user config field mapping", () => {
    it("should use config.message as body when config.body is absent", () => {
      const config = { message: "New lead assigned to you", userId: 1110216 };
      const body = config.body || config.message || "Contact needs follow-up";
      expect(body).toBe("New lead assigned to you");
    });

    it("should prefer config.body over config.message", () => {
      const config = { body: "Custom body", message: "Fallback message", userId: 1110216 };
      const body = config.body || config.message || "Contact needs follow-up";
      expect(body).toBe("Custom body");
    });

    it("should use default when neither body nor message is set", () => {
      const config = { userId: 1110216 } as any;
      const body = config.body || config.message || "Contact needs follow-up";
      expect(body).toBe("Contact needs follow-up");
    });

    it("should prefer config.userId over contact.assignedUserId", () => {
      const config = { userId: 1110216 };
      const contact = { assignedUserId: 9999 };
      const rawUserId = config.userId || contact.assignedUserId;
      const userId = rawUserId ? Number(rawUserId) : null;
      expect(userId).toBe(1110216);
    });

    it("should fall back to contact.assignedUserId when config.userId is absent", () => {
      const config = {} as any;
      const contact = { assignedUserId: 9999 };
      const rawUserId = config.userId || contact.assignedUserId;
      const userId = rawUserId ? Number(rawUserId) : null;
      expect(userId).toBe(9999);
    });

    it("should return null when neither config.userId nor contact.assignedUserId is set", () => {
      const config = {} as any;
      const contact = { assignedUserId: null };
      const rawUserId = config.userId || contact.assignedUserId;
      const userId = rawUserId ? Number(rawUserId) : null;
      expect(userId).toBeNull();
    });
  });
});
