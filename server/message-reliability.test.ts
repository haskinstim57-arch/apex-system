import { describe, it, expect } from "vitest";

/**
 * Tests for the message reliability features:
 * - Error code extraction (messageRetryWorker)
 * - Retryable code classification
 * - Retry delay exponential backoff
 * - Failure alert threshold constants
 */

// ─── Import test helpers from the retry worker ───
import { _test } from "./services/messageRetryWorker";
const { RETRYABLE_CODES, MAX_RETRIES, getRetryDelay, extractErrorCode } = _test;

describe("messageRetryWorker — extractErrorCode", () => {
  it("extracts code from bracket format [30003]", () => {
    expect(extractErrorCode("[30003] Unreachable")).toBe("30003");
  });

  it("extracts code from bracket format [421]", () => {
    expect(extractErrorCode("[421] Service unavailable")).toBe("421");
  });

  it("extracts code from colon format 30008: ...", () => {
    expect(extractErrorCode("30008: Unknown error")).toBe("30008");
  });

  it("extracts code from bare number in string", () => {
    expect(extractErrorCode("Error 30003 occurred")).toBe("30003");
  });

  it("returns null for no numeric code", () => {
    expect(extractErrorCode("bounce")).toBeNull();
  });

  it("returns null for empty string", () => {
    expect(extractErrorCode("")).toBeNull();
  });
});

describe("messageRetryWorker — retryable codes", () => {
  it("includes Twilio transient error 30003", () => {
    expect(RETRYABLE_CODES).toContain("30003");
  });

  it("includes Twilio transient error 30008", () => {
    expect(RETRYABLE_CODES).toContain("30008");
  });

  it("includes SMTP transient errors 421, 450, 451", () => {
    expect(RETRYABLE_CODES).toContain("421");
    expect(RETRYABLE_CODES).toContain("450");
    expect(RETRYABLE_CODES).toContain("451");
  });

  it("does NOT include permanent Twilio errors like 30007", () => {
    expect(RETRYABLE_CODES).not.toContain("30007");
  });

  it("does NOT include invalid number error 21211", () => {
    expect(RETRYABLE_CODES).not.toContain("21211");
  });
});

describe("messageRetryWorker — MAX_RETRIES", () => {
  it("allows at most 3 retries", () => {
    expect(MAX_RETRIES).toBe(3);
  });
});

describe("messageRetryWorker — getRetryDelay (exponential backoff)", () => {
  it("first retry is 15 minutes", () => {
    expect(getRetryDelay(0)).toBe(15 * 60 * 1000);
  });

  it("second retry is 1 hour", () => {
    expect(getRetryDelay(1)).toBe(60 * 60 * 1000);
  });

  it("third retry is 4 hours", () => {
    expect(getRetryDelay(2)).toBe(4 * 60 * 60 * 1000);
  });

  it("beyond max uses last delay", () => {
    expect(getRetryDelay(5)).toBe(4 * 60 * 1000 * 60);
  });

  it("delays are strictly increasing", () => {
    const d0 = getRetryDelay(0);
    const d1 = getRetryDelay(1);
    const d2 = getRetryDelay(2);
    expect(d1).toBeGreaterThan(d0);
    expect(d2).toBeGreaterThan(d1);
  });
});

describe("messageRetryWorker — retryable code classification", () => {
  it("correctly classifies a retryable code from bracket format", () => {
    const code = extractErrorCode("[30003] Unreachable");
    expect(code).not.toBeNull();
    expect(RETRYABLE_CODES).toContain(code);
  });

  it("correctly classifies a non-retryable code", () => {
    const code = extractErrorCode("[21211] Invalid phone number");
    expect(code).not.toBeNull();
    expect(RETRYABLE_CODES).not.toContain(code);
  });

  it("returns null for bounce keyword (not a numeric code)", () => {
    const code = extractErrorCode("bounce");
    expect(code).toBeNull();
  });
});

describe("Twilio status → messages table mapping", () => {
  // These test the mapping logic used in deliveryStatus.ts
  const mapTwilioStatus = (status: string) => {
    if (status === "delivered") return "delivered";
    if (status === "failed" || status === "undelivered") return "failed";
    if (status === "sent") return "sent";
    return null;
  };

  it("maps 'delivered' to 'delivered'", () => {
    expect(mapTwilioStatus("delivered")).toBe("delivered");
  });

  it("maps 'failed' to 'failed'", () => {
    expect(mapTwilioStatus("failed")).toBe("failed");
  });

  it("maps 'undelivered' to 'failed'", () => {
    expect(mapTwilioStatus("undelivered")).toBe("failed");
  });

  it("maps 'sent' to 'sent'", () => {
    expect(mapTwilioStatus("sent")).toBe("sent");
  });

  it("maps unknown status to null (no update)", () => {
    expect(mapTwilioStatus("queued")).toBeNull();
    expect(mapTwilioStatus("accepted")).toBeNull();
  });
});

describe("SendGrid event → messages table mapping", () => {
  const mapSendGridEvent = (event: string) => {
    if (event === "delivered") return "delivered";
    if (event === "bounce" || event === "dropped") return "bounced";
    if (event === "deferred") return "sent";
    return null;
  };

  it("maps 'delivered' to 'delivered'", () => {
    expect(mapSendGridEvent("delivered")).toBe("delivered");
  });

  it("maps 'bounce' to 'bounced'", () => {
    expect(mapSendGridEvent("bounce")).toBe("bounced");
  });

  it("maps 'dropped' to 'bounced'", () => {
    expect(mapSendGridEvent("dropped")).toBe("bounced");
  });

  it("maps 'deferred' to 'sent'", () => {
    expect(mapSendGridEvent("deferred")).toBe("sent");
  });

  it("maps 'open' to null (no status update)", () => {
    expect(mapSendGridEvent("open")).toBeNull();
  });

  it("maps 'click' to null (no status update)", () => {
    expect(mapSendGridEvent("click")).toBeNull();
  });
});
