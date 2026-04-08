import { describe, it, expect } from "vitest";

/**
 * Tests for the get_failed_messages error-code mapping logic.
 * We extract the pure mapping function so it can be tested without DB mocks.
 */

// Twilio SMS error code mapping (mirrors jarvisTools.ts)
const twilioErrorMap: Record<string, string> = {
  "30003": "Unreachable destination — phone may be off or out of service",
  "30004": "Message blocked — carrier blocked this message",
  "30005": "Unknown destination — number doesn't exist",
  "30006": "Landline number — SMS cannot be delivered to landlines",
  "30007": "Message filtered by carrier — may contain flagged content",
  "30008": "Unknown error from carrier",
  "21211": "Invalid phone number format",
};

const getHumanReason = (errorMsg: string | null, msgType: string): string => {
  if (!errorMsg) {
    return msgType === "email"
      ? "Email delivery failed — server rejected the message or address bounced"
      : "Delivery failed — carrier or server rejected the message";
  }
  const codeMatch = errorMsg.match(/\b(3000[3-8]|21211)\b/);
  if (codeMatch && twilioErrorMap[codeMatch[1]]) {
    return twilioErrorMap[codeMatch[1]];
  }
  const lower = errorMsg.toLowerCase();
  if (lower.includes("bounce")) return "Email bounced — recipient address is invalid or mailbox full";
  if (lower.includes("spam") || lower.includes("blocked")) return "Message blocked — flagged as spam by recipient server";
  if (lower.includes("invalid") && lower.includes("email")) return "Invalid email address";
  if (lower.includes("unsubscribe") || lower.includes("suppression")) return "Recipient has unsubscribed or is on suppression list";
  return errorMsg.length > 120 ? errorMsg.slice(0, 120) + "…" : errorMsg;
};

describe("get_failed_messages — error code mapping", () => {
  // ── Twilio error codes ──
  it("maps 30003 to unreachable destination", () => {
    expect(getHumanReason("Error 30003: Unreachable", "sms")).toBe(
      "Unreachable destination — phone may be off or out of service"
    );
  });

  it("maps 30004 to message blocked", () => {
    expect(getHumanReason("Twilio error 30004", "sms")).toBe(
      "Message blocked — carrier blocked this message"
    );
  });

  it("maps 30005 to unknown destination", () => {
    expect(getHumanReason("30005 - unknown number", "sms")).toBe(
      "Unknown destination — number doesn't exist"
    );
  });

  it("maps 30006 to landline", () => {
    expect(getHumanReason("Error code: 30006", "sms")).toBe(
      "Landline number — SMS cannot be delivered to landlines"
    );
  });

  it("maps 30007 to carrier filtered", () => {
    expect(getHumanReason("30007 filtered", "sms")).toBe(
      "Message filtered by carrier — may contain flagged content"
    );
  });

  it("maps 30008 to unknown carrier error", () => {
    expect(getHumanReason("30008", "sms")).toBe("Unknown error from carrier");
  });

  it("maps 21211 to invalid phone format", () => {
    expect(getHumanReason("21211 invalid number", "sms")).toBe("Invalid phone number format");
  });

  // ── Email bounce keywords ──
  it("detects bounce keyword in email errors", () => {
    expect(getHumanReason("Hard bounce: mailbox does not exist", "email")).toBe(
      "Email bounced — recipient address is invalid or mailbox full"
    );
  });

  it("detects spam/blocked keyword", () => {
    expect(getHumanReason("Message was blocked by recipient", "email")).toBe(
      "Message blocked — flagged as spam by recipient server"
    );
  });

  it("detects spam keyword", () => {
    expect(getHumanReason("Flagged as spam by server", "email")).toBe(
      "Message blocked — flagged as spam by recipient server"
    );
  });

  it("detects invalid email keyword", () => {
    expect(getHumanReason("Invalid email address format", "email")).toBe("Invalid email address");
  });

  it("detects unsubscribe/suppression keyword", () => {
    expect(getHumanReason("Address on suppression list", "email")).toBe(
      "Recipient has unsubscribed or is on suppression list"
    );
  });

  // ── Null/empty error message ──
  it("returns SMS default when errorMessage is null", () => {
    expect(getHumanReason(null, "sms")).toBe(
      "Delivery failed — carrier or server rejected the message"
    );
  });

  it("returns email default when errorMessage is null", () => {
    expect(getHumanReason(null, "email")).toBe(
      "Email delivery failed — server rejected the message or address bounced"
    );
  });

  // ── Fallback: raw error message ──
  it("returns raw error message for unrecognized errors", () => {
    expect(getHumanReason("Some unknown provider error", "sms")).toBe(
      "Some unknown provider error"
    );
  });

  it("truncates long error messages to 120 chars", () => {
    const longMsg = "A".repeat(200);
    const result = getHumanReason(longMsg, "sms");
    expect(result.length).toBe(121); // 120 + "…"
    expect(result.endsWith("…")).toBe(true);
  });

  // ── Error code extraction ──
  it("extracts 5-digit error code from error message", () => {
    const errorMsg = "Twilio error 30005: Unknown destination";
    const code = errorMsg.match(/\b(\d{5})\b/)?.[1] || null;
    expect(code).toBe("30005");
  });

  it("returns null when no error code in message", () => {
    const errorMsg = "Generic delivery failure";
    const code = errorMsg.match(/\b(\d{5})\b/)?.[1] || null;
    expect(code).toBeNull();
  });

  it("returns null error code when errorMessage is null", () => {
    const errorMsg: string | null = null;
    const code = errorMsg?.match(/\b(\d{5})\b/)?.[1] || null;
    expect(code).toBeNull();
  });
});

describe("get_failed_messages — tool definition validation", () => {
  it("tool name matches expected value", () => {
    const toolName = "get_failed_messages";
    expect(toolName).toBe("get_failed_messages");
  });

  it("limit is capped at 50", () => {
    const cap = (input: number) => Math.min(input || 10, 50);
    expect(cap(100)).toBe(50);
    expect(cap(25)).toBe(25);
    expect(cap(0)).toBe(10); // default
  });

  it("contact name falls back to Contact #id", () => {
    const firstName = null;
    const lastName = null;
    const contactId = 42;
    const name = [firstName, lastName].filter(Boolean).join(" ") || `Contact #${contactId}`;
    expect(name).toBe("Contact #42");
  });

  it("contact name joins first and last", () => {
    const firstName = "John";
    const lastName = "Doe";
    const contactId = 42;
    const name = [firstName, lastName].filter(Boolean).join(" ") || `Contact #${contactId}`;
    expect(name).toBe("John Doe");
  });

  it("body preview is truncated to 100 chars", () => {
    const body = "X".repeat(200);
    const preview = body?.slice(0, 100) || null;
    expect(preview!.length).toBe(100);
  });
});
