import { describe, it, expect } from "vitest";
import { generateICSEvent, generateICSBase64 } from "./utils/icsGenerator";

describe("ICS Calendar File Generator", () => {
  const baseParams = {
    uid: "appointment-42@apexsystem",
    summary: "Appointment: Consultation Call",
    startTime: new Date("2026-04-15T14:00:00Z"),
    endTime: new Date("2026-04-15T14:30:00Z"),
  };

  describe("generateICSEvent", () => {
    it("should generate a valid VCALENDAR with VEVENT", () => {
      const ics = generateICSEvent(baseParams);

      expect(ics).toContain("BEGIN:VCALENDAR");
      expect(ics).toContain("END:VCALENDAR");
      expect(ics).toContain("BEGIN:VEVENT");
      expect(ics).toContain("END:VEVENT");
      expect(ics).toContain("VERSION:2.0");
      expect(ics).toContain("PRODID:-//Apex System//Booking Calendar//EN");
      expect(ics).toContain("CALSCALE:GREGORIAN");
      expect(ics).toContain("METHOD:REQUEST");
    });

    it("should include the correct UID", () => {
      const ics = generateICSEvent(baseParams);
      expect(ics).toContain("UID:appointment-42@apexsystem");
    });

    it("should format DTSTART and DTEND in UTC iCalendar format", () => {
      const ics = generateICSEvent(baseParams);
      expect(ics).toContain("DTSTART:20260415T140000Z");
      expect(ics).toContain("DTEND:20260415T143000Z");
    });

    it("should include DTSTAMP in UTC format", () => {
      const ics = generateICSEvent(baseParams);
      // DTSTAMP should match pattern YYYYMMDDTHHmmssZ
      expect(ics).toMatch(/DTSTAMP:\d{8}T\d{6}Z/);
    });

    it("should include the SUMMARY", () => {
      const ics = generateICSEvent(baseParams);
      expect(ics).toContain("SUMMARY:Appointment: Consultation Call");
    });

    it("should include DESCRIPTION when provided", () => {
      const ics = generateICSEvent({
        ...baseParams,
        description: "Meeting with John Doe to discuss mortgage options",
      });
      expect(ics).toContain(
        "DESCRIPTION:Meeting with John Doe to discuss mortgage options"
      );
    });

    it("should not include event-level DESCRIPTION when not provided", () => {
      const ics = generateICSEvent(baseParams);
      // The VALARM has its own DESCRIPTION:Appointment Reminder
      // But the event-level DESCRIPTION should not be present
      const lines = ics.split("\r\n");
      const eventLines: string[] = [];
      let inAlarm = false;
      for (const line of lines) {
        if (line === "BEGIN:VALARM") inAlarm = true;
        if (!inAlarm) eventLines.push(line);
        if (line === "END:VALARM") inAlarm = false;
      }
      const eventContent = eventLines.join("\r\n");
      expect(eventContent).not.toContain("DESCRIPTION:");
    });

    it("should include LOCATION when provided", () => {
      const ics = generateICSEvent({
        ...baseParams,
        location: "123 Main St, Suite 100",
      });
      expect(ics).toContain("LOCATION:123 Main St\\, Suite 100");
    });

    it("should not include LOCATION when not provided", () => {
      const ics = generateICSEvent(baseParams);
      expect(ics).not.toContain("LOCATION:");
    });

    it("should include ORGANIZER with CN when provided", () => {
      const ics = generateICSEvent({
        ...baseParams,
        organizerName: "Tim Haskins",
        organizerEmail: "tim@example.com",
      });
      expect(ics).toContain(
        "ORGANIZER;CN=Tim Haskins:mailto:tim@example.com"
      );
    });

    it("should include ORGANIZER without CN when only email provided", () => {
      const ics = generateICSEvent({
        ...baseParams,
        organizerEmail: "tim@example.com",
      });
      expect(ics).toContain("ORGANIZER:mailto:tim@example.com");
    });

    it("should include ATTENDEE with CN when provided", () => {
      const ics = generateICSEvent({
        ...baseParams,
        attendeeName: "Jane Smith",
        attendeeEmail: "jane@example.com",
      });
      expect(ics).toContain(
        "ATTENDEE;PARTSTAT=ACCEPTED;RSVP=FALSE;CN=Jane Smith:mailto:jane@example.com"
      );
    });

    it("should include a 15-minute VALARM reminder", () => {
      const ics = generateICSEvent(baseParams);
      expect(ics).toContain("BEGIN:VALARM");
      expect(ics).toContain("TRIGGER:-PT15M");
      expect(ics).toContain("ACTION:DISPLAY");
      expect(ics).toContain("DESCRIPTION:Appointment Reminder");
      expect(ics).toContain("END:VALARM");
    });

    it("should escape special characters in text fields", () => {
      const ics = generateICSEvent({
        ...baseParams,
        summary: "Meeting; with commas, and backslash\\",
        description: "Line 1\nLine 2; semicolons, commas",
      });
      expect(ics).toContain(
        "SUMMARY:Meeting\\; with commas\\, and backslash\\\\"
      );
      expect(ics).toContain(
        "DESCRIPTION:Line 1\\nLine 2\\; semicolons\\, commas"
      );
    });

    it("should use CRLF line endings per RFC 5545", () => {
      const ics = generateICSEvent(baseParams);
      // The output should use \r\n between lines
      expect(ics).toContain("\r\n");
      const lines = ics.split("\r\n");
      expect(lines[0]).toBe("BEGIN:VCALENDAR");
    });

    it("should handle midnight times correctly", () => {
      const ics = generateICSEvent({
        ...baseParams,
        startTime: new Date("2026-01-01T00:00:00Z"),
        endTime: new Date("2026-01-01T01:00:00Z"),
      });
      expect(ics).toContain("DTSTART:20260101T000000Z");
      expect(ics).toContain("DTEND:20260101T010000Z");
    });

    it("should handle end-of-day times correctly", () => {
      const ics = generateICSEvent({
        ...baseParams,
        startTime: new Date("2026-12-31T23:00:00Z"),
        endTime: new Date("2026-12-31T23:59:00Z"),
      });
      expect(ics).toContain("DTSTART:20261231T230000Z");
      expect(ics).toContain("DTEND:20261231T235900Z");
    });
  });

  describe("generateICSBase64", () => {
    it("should return a valid base64 string", () => {
      const base64 = generateICSBase64(baseParams);
      // Should be valid base64 (only contains base64 characters)
      expect(base64).toMatch(/^[A-Za-z0-9+/=]+$/);
    });

    it("should decode back to valid ICS content", () => {
      const base64 = generateICSBase64(baseParams);
      const decoded = Buffer.from(base64, "base64").toString("utf-8");
      expect(decoded).toContain("BEGIN:VCALENDAR");
      expect(decoded).toContain("END:VCALENDAR");
      expect(decoded).toContain("BEGIN:VEVENT");
      expect(decoded).toContain("UID:appointment-42@apexsystem");
    });

    it("should produce non-empty output", () => {
      const base64 = generateICSBase64(baseParams);
      expect(base64.length).toBeGreaterThan(100);
    });

    it("should include all event details when decoded", () => {
      const base64 = generateICSBase64({
        ...baseParams,
        description: "Test meeting",
        organizerName: "Organizer",
        organizerEmail: "org@test.com",
        attendeeName: "Guest",
        attendeeEmail: "guest@test.com",
      });
      const decoded = Buffer.from(base64, "base64").toString("utf-8");
      expect(decoded).toContain("SUMMARY:Appointment: Consultation Call");
      expect(decoded).toContain("DESCRIPTION:Test meeting");
      expect(decoded).toContain("ORGANIZER;CN=Organizer:mailto:org@test.com");
      expect(decoded).toContain("ATTENDEE;PARTSTAT=ACCEPTED;RSVP=FALSE;CN=Guest:mailto:guest@test.com");
    });
  });
});
