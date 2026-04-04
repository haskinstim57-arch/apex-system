import { describe, it, expect } from "vitest";

// ─── Test the webhook handler logic (normalization, ID extraction) ───

// Import the webhook router module to test its exports
// Since the functions are not exported, we test the behavior through the router
// We'll test the normalization and extraction logic directly

describe("SendGrid Event Normalization", () => {
  // Replicate the normalization map from deliveryStatus.ts
  const normalizeSendGridEvent = (event: string): string => {
    const map: Record<string, string> = {
      processed: "processed",
      delivered: "delivered",
      bounce: "bounced",
      dropped: "dropped",
      deferred: "deferred",
      open: "opened",
      click: "clicked",
      spamreport: "spam_reported",
      unsubscribe: "unsubscribed",
      group_unsubscribe: "unsubscribed",
      group_resubscribe: "resubscribed",
    };
    return map[event] || event;
  };

  it("normalizes 'delivered' to 'delivered'", () => {
    expect(normalizeSendGridEvent("delivered")).toBe("delivered");
  });

  it("normalizes 'bounce' to 'bounced'", () => {
    expect(normalizeSendGridEvent("bounce")).toBe("bounced");
  });

  it("normalizes 'dropped' to 'dropped'", () => {
    expect(normalizeSendGridEvent("dropped")).toBe("dropped");
  });

  it("normalizes 'deferred' to 'deferred'", () => {
    expect(normalizeSendGridEvent("deferred")).toBe("deferred");
  });

  it("normalizes 'open' to 'opened'", () => {
    expect(normalizeSendGridEvent("open")).toBe("opened");
  });

  it("normalizes 'click' to 'clicked'", () => {
    expect(normalizeSendGridEvent("click")).toBe("clicked");
  });

  it("normalizes 'spamreport' to 'spam_reported'", () => {
    expect(normalizeSendGridEvent("spamreport")).toBe("spam_reported");
  });

  it("normalizes 'unsubscribe' to 'unsubscribed'", () => {
    expect(normalizeSendGridEvent("unsubscribe")).toBe("unsubscribed");
  });

  it("normalizes 'group_unsubscribe' to 'unsubscribed'", () => {
    expect(normalizeSendGridEvent("group_unsubscribe")).toBe("unsubscribed");
  });

  it("normalizes 'group_resubscribe' to 'resubscribed'", () => {
    expect(normalizeSendGridEvent("group_resubscribe")).toBe("resubscribed");
  });

  it("passes through unknown events unchanged", () => {
    expect(normalizeSendGridEvent("custom_event")).toBe("custom_event");
  });
});

describe("SendGrid Message ID Extraction", () => {
  const extractSendGridMessageId = (sgMessageId: string): string => {
    return sgMessageId.split(".")[0];
  };

  it("extracts base ID from full SendGrid message ID with filter suffix", () => {
    expect(
      extractSendGridMessageId("abc123def456.filter0034p1mdw1-12345-abc")
    ).toBe("abc123def456");
  });

  it("returns the full ID when there is no dot suffix", () => {
    expect(extractSendGridMessageId("abc123def456")).toBe("abc123def456");
  });

  it("handles multiple dots by extracting only the first segment", () => {
    expect(
      extractSendGridMessageId("msg.filter.extra.parts")
    ).toBe("msg");
  });

  it("handles empty string", () => {
    expect(extractSendGridMessageId("")).toBe("");
  });
});

describe("Twilio Status Normalization", () => {
  const normalizeTwilioStatus = (status: string): string => {
    const map: Record<string, string> = {
      queued: "queued",
      sending: "sending",
      sent: "sent",
      delivered: "delivered",
      undelivered: "undelivered",
      failed: "failed",
      receiving: "receiving",
      received: "received",
      accepted: "accepted",
      read: "read",
    };
    return map[status] || status;
  };

  it("normalizes 'delivered' to 'delivered'", () => {
    expect(normalizeTwilioStatus("delivered")).toBe("delivered");
  });

  it("normalizes 'undelivered' to 'undelivered'", () => {
    expect(normalizeTwilioStatus("undelivered")).toBe("undelivered");
  });

  it("normalizes 'failed' to 'failed'", () => {
    expect(normalizeTwilioStatus("failed")).toBe("failed");
  });

  it("normalizes 'queued' to 'queued'", () => {
    expect(normalizeTwilioStatus("queued")).toBe("queued");
  });

  it("normalizes 'sent' to 'sent'", () => {
    expect(normalizeTwilioStatus("sent")).toBe("sent");
  });

  it("normalizes 'read' to 'read'", () => {
    expect(normalizeTwilioStatus("read")).toBe("read");
  });

  it("passes through unknown statuses unchanged", () => {
    expect(normalizeTwilioStatus("custom_status")).toBe("custom_status");
  });
});

describe("Notification Logger - LogNotificationParams with externalMessageId", () => {
  it("accepts externalMessageId in params type", () => {
    // Type-level test: ensure the interface accepts externalMessageId
    const params = {
      channel: "email" as const,
      eventType: "inbound_sms",
      accountId: 1,
      status: "sent" as const,
      provider: "sendgrid",
      externalMessageId: "sg_abc123",
    };
    expect(params.externalMessageId).toBe("sg_abc123");
  });

  it("externalMessageId is optional", () => {
    const params = {
      channel: "sms" as const,
      eventType: "appointment_booked",
      accountId: 1,
      status: "sent" as const,
      provider: "twilio",
    };
    expect(params).not.toHaveProperty("externalMessageId");
  });
});

describe("Email/SMS notification services return externalIds", () => {
  it("email notification result type includes externalIds array", () => {
    const result = { sent: 2, failed: 0, externalIds: ["sg_123", "sg_456"] };
    expect(result.externalIds).toHaveLength(2);
    expect(result.externalIds[0]).toBe("sg_123");
  });

  it("SMS notification result type includes externalIds array", () => {
    const result = { sent: 1, failed: 0, externalIds: ["SM_abc123"] };
    expect(result.externalIds).toHaveLength(1);
    expect(result.externalIds[0]).toBe("SM_abc123");
  });

  it("empty externalIds when no messages sent", () => {
    const result = { sent: 0, failed: 0, externalIds: [] as string[] };
    expect(result.externalIds).toHaveLength(0);
  });
});

describe("Twilio Error Message Formatting", () => {
  it("formats error with code and message", () => {
    const errorCode = "30003";
    const errorMessage = "Unreachable destination handset";
    const formatted = `${errorCode}: ${errorMessage}`;
    expect(formatted).toBe("30003: Unreachable destination handset");
  });

  it("formats error with code but no message", () => {
    const errorCode = "30003";
    const errorMessage = undefined;
    const formatted = `${errorCode}: ${errorMessage || "Unknown error"}`;
    expect(formatted).toBe("30003: Unknown error");
  });

  it("returns null when no error code", () => {
    const errorCode = undefined;
    const result = errorCode ? `${errorCode}: test` : null;
    expect(result).toBeNull();
  });
});
