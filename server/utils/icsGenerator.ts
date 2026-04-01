// ─────────────────────────────────────────────
// ICS Calendar File Generator
// Generates iCalendar (.ics) format strings for
// appointment booking confirmation emails.
// ─────────────────────────────────────────────

export interface ICSEventParams {
  /** Unique identifier for the event */
  uid: string;
  /** Event summary / title */
  summary: string;
  /** Event description (plain text) */
  description?: string;
  /** Event location */
  location?: string;
  /** Start time as Date object (UTC) */
  startTime: Date;
  /** End time as Date object (UTC) */
  endTime: Date;
  /** Organizer name */
  organizerName?: string;
  /** Organizer email */
  organizerEmail?: string;
  /** Attendee name */
  attendeeName?: string;
  /** Attendee email */
  attendeeEmail?: string;
}

/**
 * Format a Date to iCalendar DTSTART/DTEND format: YYYYMMDDTHHmmssZ
 */
function formatICSDate(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  const h = String(date.getUTCHours()).padStart(2, "0");
  const min = String(date.getUTCMinutes()).padStart(2, "0");
  const s = String(date.getUTCSeconds()).padStart(2, "0");
  return `${y}${m}${d}T${h}${min}${s}Z`;
}

/**
 * Escape special characters in iCalendar text fields.
 * Per RFC 5545: backslash, semicolon, comma, and newlines must be escaped.
 */
function escapeICSText(text: string): string {
  return text
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\n/g, "\\n");
}

/**
 * Generate an iCalendar (.ics) file content string for a single event.
 * Returns a valid RFC 5545 VCALENDAR with one VEVENT.
 */
export function generateICSEvent(params: ICSEventParams): string {
  const now = new Date();
  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Sterling Marketing//Booking Calendar//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:REQUEST",
    "BEGIN:VEVENT",
    `UID:${params.uid}`,
    `DTSTAMP:${formatICSDate(now)}`,
    `DTSTART:${formatICSDate(params.startTime)}`,
    `DTEND:${formatICSDate(params.endTime)}`,
    `SUMMARY:${escapeICSText(params.summary)}`,
  ];

  if (params.description) {
    lines.push(`DESCRIPTION:${escapeICSText(params.description)}`);
  }

  if (params.location) {
    lines.push(`LOCATION:${escapeICSText(params.location)}`);
  }

  if (params.organizerEmail) {
    const cn = params.organizerName ? `;CN=${escapeICSText(params.organizerName)}` : "";
    lines.push(`ORGANIZER${cn}:mailto:${params.organizerEmail}`);
  }

  if (params.attendeeEmail) {
    const cn = params.attendeeName ? `;CN=${escapeICSText(params.attendeeName)}` : "";
    lines.push(
      `ATTENDEE;PARTSTAT=ACCEPTED;RSVP=FALSE${cn}:mailto:${params.attendeeEmail}`
    );
  }

  // Add a 15-minute reminder alarm
  lines.push(
    "BEGIN:VALARM",
    "TRIGGER:-PT15M",
    "ACTION:DISPLAY",
    "DESCRIPTION:Appointment Reminder",
    "END:VALARM"
  );

  lines.push("END:VEVENT", "END:VCALENDAR");

  return lines.join("\r\n");
}

/**
 * Generate a base64-encoded ICS file content suitable for email attachments.
 */
export function generateICSBase64(params: ICSEventParams): string {
  const icsContent = generateICSEvent(params);
  return Buffer.from(icsContent, "utf-8").toString("base64");
}
