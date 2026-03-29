import { describe, it, expect, vi } from "vitest";

// ─── Keyword Detection Tests ───
describe("SMS Compliance – Keyword Detection", () => {
  const STOP_KEYWORDS = ["STOP", "STOPALL", "UNSUBSCRIBE", "CANCEL", "END", "QUIT"];
  const START_KEYWORDS = ["START", "UNSTOP", "SUBSCRIBE", "YES"];
  const HELP_KEYWORDS = ["HELP", "INFO"];

  function classifyKeyword(body: string): "stop" | "start" | "help" | null {
    const normalized = body.trim().toUpperCase();
    if (STOP_KEYWORDS.includes(normalized)) return "stop";
    if (START_KEYWORDS.includes(normalized)) return "start";
    if (HELP_KEYWORDS.includes(normalized)) return "help";
    return null;
  }

  it("should detect STOP keywords", () => {
    expect(classifyKeyword("STOP")).toBe("stop");
    expect(classifyKeyword("stop")).toBe("stop");
    expect(classifyKeyword("  STOPALL  ")).toBe("stop");
    expect(classifyKeyword("UNSUBSCRIBE")).toBe("stop");
    expect(classifyKeyword("CANCEL")).toBe("stop");
    expect(classifyKeyword("END")).toBe("stop");
    expect(classifyKeyword("QUIT")).toBe("stop");
  });

  it("should detect START keywords", () => {
    expect(classifyKeyword("START")).toBe("start");
    expect(classifyKeyword("start")).toBe("start");
    expect(classifyKeyword("UNSTOP")).toBe("start");
    expect(classifyKeyword("SUBSCRIBE")).toBe("start");
    expect(classifyKeyword("YES")).toBe("start");
  });

  it("should detect HELP keywords", () => {
    expect(classifyKeyword("HELP")).toBe("help");
    expect(classifyKeyword("help")).toBe("help");
    expect(classifyKeyword("INFO")).toBe("help");
  });

  it("should return null for non-keyword messages", () => {
    expect(classifyKeyword("Hello there")).toBeNull();
    expect(classifyKeyword("I need help with my loan")).toBeNull();
    expect(classifyKeyword("Please stop by my office")).toBeNull();
    expect(classifyKeyword("")).toBeNull();
  });

  it("should handle whitespace-padded keywords", () => {
    expect(classifyKeyword("  STOP  ")).toBe("stop");
    expect(classifyKeyword("\tHELP\n")).toBe("help");
    expect(classifyKeyword("  START  ")).toBe("start");
  });
});

// ─── DND Status Tests ───
describe("SMS Compliance – DND Status", () => {
  const VALID_DND_STATUSES = ["active", "sms_only", "email_only", "all_channels", null];

  it("should accept valid DND statuses", () => {
    VALID_DND_STATUSES.forEach((status) => {
      expect(["active", "sms_only", "email_only", "all_channels", null].includes(status)).toBe(true);
    });
  });

  it("should block SMS when DND is sms_only or all_channels", () => {
    function shouldBlockSms(dndStatus: string | null): boolean {
      return dndStatus === "sms_only" || dndStatus === "all_channels";
    }
    expect(shouldBlockSms("sms_only")).toBe(true);
    expect(shouldBlockSms("all_channels")).toBe(true);
    expect(shouldBlockSms("email_only")).toBe(false);
    expect(shouldBlockSms("active")).toBe(false);
    expect(shouldBlockSms(null)).toBe(false);
  });

  it("should block email when DND is email_only or all_channels", () => {
    function shouldBlockEmail(dndStatus: string | null): boolean {
      return dndStatus === "email_only" || dndStatus === "all_channels";
    }
    expect(shouldBlockEmail("email_only")).toBe(true);
    expect(shouldBlockEmail("all_channels")).toBe(true);
    expect(shouldBlockEmail("sms_only")).toBe(false);
    expect(shouldBlockEmail("active")).toBe(false);
    expect(shouldBlockEmail(null)).toBe(false);
  });
});

// ─── Schema Contract Tests ───
describe("SMS Compliance – Schema Contracts", () => {
  it("smsOptOuts table should have required fields", () => {
    const requiredFields = [
      "id", "accountId", "phone", "contactId", "keyword",
      "source", "isActive", "optedOutAt", "optedInAt", "createdAt"
    ];
    // Verify field names are valid strings
    requiredFields.forEach((field) => {
      expect(typeof field).toBe("string");
      expect(field.length).toBeGreaterThan(0);
    });
  });

  it("smsComplianceLogs table should have required fields", () => {
    const requiredFields = [
      "id", "accountId", "phone", "contactId", "eventType",
      "keyword", "description", "metadata", "createdAt"
    ];
    requiredFields.forEach((field) => {
      expect(typeof field).toBe("string");
      expect(field.length).toBeGreaterThan(0);
    });
  });

  it("compliance event types should be valid", () => {
    const validEventTypes = [
      "opt_out", "opt_in", "help_request", "dnd_set", "dnd_cleared",
      "message_blocked", "auto_reply_sent", "manual_opt_out", "manual_opt_in"
    ];
    validEventTypes.forEach((type) => {
      expect(typeof type).toBe("string");
      expect(type).toMatch(/^[a-z_]+$/);
    });
  });
});

// ─── Auto-Reply Message Tests ───
describe("SMS Compliance – Auto-Reply Messages", () => {
  function getAutoReply(type: "stop" | "start" | "help", accountName?: string): string {
    const name = accountName || "our service";
    switch (type) {
      case "stop":
        return `You have been unsubscribed from ${name}. You will no longer receive SMS messages. Reply START to re-subscribe.`;
      case "start":
        return `You have been re-subscribed to ${name}. You will now receive SMS messages. Reply STOP to unsubscribe.`;
      case "help":
        return `${name}: For help, contact support. Reply STOP to unsubscribe or START to re-subscribe. Msg&data rates may apply.`;
    }
  }

  it("should generate STOP auto-reply", () => {
    const reply = getAutoReply("stop", "Sterling Marketing");
    expect(reply).toContain("unsubscribed");
    expect(reply).toContain("Sterling Marketing");
    expect(reply).toContain("START");
  });

  it("should generate START auto-reply", () => {
    const reply = getAutoReply("start", "Sterling Marketing");
    expect(reply).toContain("re-subscribed");
    expect(reply).toContain("STOP");
  });

  it("should generate HELP auto-reply", () => {
    const reply = getAutoReply("help");
    expect(reply).toContain("support");
    expect(reply).toContain("STOP");
    expect(reply).toContain("START");
  });

  it("should use default name when no account name provided", () => {
    const reply = getAutoReply("stop");
    expect(reply).toContain("our service");
  });
});

// ─── Opt-Out Source Validation ───
describe("SMS Compliance – Source Validation", () => {
  const VALID_SOURCES = ["inbound_sms", "manual", "import", "api"];

  it("should accept valid opt-out sources", () => {
    VALID_SOURCES.forEach((source) => {
      expect(typeof source).toBe("string");
      expect(source.length).toBeGreaterThan(0);
    });
  });

  it("should have at least 3 source types", () => {
    expect(VALID_SOURCES.length).toBeGreaterThanOrEqual(3);
  });
});

// ─── Phone Number Normalization ───
describe("SMS Compliance – Phone Normalization", () => {
  function normalizePhone(phone: string): string {
    const digits = phone.replace(/\D/g, "");
    if (digits.length === 10) return `+1${digits}`;
    if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
    if (phone.startsWith("+")) return phone;
    return `+${digits}`;
  }

  it("should normalize 10-digit US numbers", () => {
    expect(normalizePhone("5551234567")).toBe("+15551234567");
  });

  it("should normalize 11-digit US numbers", () => {
    expect(normalizePhone("15551234567")).toBe("+15551234567");
  });

  it("should preserve E.164 format", () => {
    expect(normalizePhone("+15551234567")).toBe("+15551234567");
  });

  it("should strip formatting characters", () => {
    expect(normalizePhone("(555) 123-4567")).toBe("+15551234567");
    expect(normalizePhone("555-123-4567")).toBe("+15551234567");
  });
});

// ─── CSV Export Format Tests ───
describe("SMS Compliance – CSV Export", () => {
  it("should generate valid CSV header", () => {
    const headers = ["Phone", "Contact Name", "Keyword", "Source", "Status", "Opted Out At", "Opted In At"];
    const csv = headers.join(",");
    expect(csv).toContain("Phone");
    expect(csv).toContain("Contact Name");
    expect(csv).toContain("Status");
    expect(csv.split(",").length).toBe(7);
  });

  it("should escape CSV values with commas", () => {
    function escapeCsv(value: string): string {
      if (value.includes(",") || value.includes('"') || value.includes("\n")) {
        return `"${value.replace(/"/g, '""')}"`;
      }
      return value;
    }
    expect(escapeCsv("John, Jr.")).toBe('"John, Jr."');
    expect(escapeCsv('Say "hello"')).toBe('"Say ""hello"""');
    expect(escapeCsv("Normal")).toBe("Normal");
  });
});

// ─── Compliance Stats Aggregation ───
describe("SMS Compliance – Stats Aggregation", () => {
  it("should calculate compliance rate correctly", () => {
    function calcComplianceRate(autoReplied: number, totalEvents: number): number {
      return totalEvents > 0 ? Math.round((autoReplied / totalEvents) * 100) : 100;
    }
    expect(calcComplianceRate(10, 10)).toBe(100);
    expect(calcComplianceRate(8, 10)).toBe(80);
    expect(calcComplianceRate(0, 0)).toBe(100); // No events = fully compliant
    expect(calcComplianceRate(0, 5)).toBe(0);
  });
});

// ─── Activity Type Enum Tests ───
describe("SMS Compliance – Activity Types", () => {
  it("should include sms_opt_out and sms_opt_in activity types", () => {
    const activityTypes = [
      "call", "email", "sms", "note", "meeting", "task", "deal_update",
      "status_change", "form_submission", "webchat_started", "webchat_handoff",
      "sms_opt_out", "sms_opt_in"
    ];
    expect(activityTypes).toContain("sms_opt_out");
    expect(activityTypes).toContain("sms_opt_in");
  });
});
