import { describe, it, expect } from "vitest";
import { isValidE164, normalizeToE164, E164_ERROR_MESSAGE } from "../shared/phone";

// ─────────────────────────────────────────────
// E.164 Phone Validation Tests
// ─────────────────────────────────────────────

describe("E.164 phone validation", () => {
  describe("isValidE164", () => {
    it("should accept valid US E.164 number", () => {
      expect(isValidE164("+15551234567")).toBe(true);
    });

    it("should accept valid UK E.164 number", () => {
      expect(isValidE164("+442071234567")).toBe(true);
    });

    it("should accept minimum length E.164 number", () => {
      expect(isValidE164("+12345678")).toBe(true);
    });

    it("should accept maximum length E.164 number (15 digits)", () => {
      expect(isValidE164("+123456789012345")).toBe(true);
    });

    it("should reject number without + prefix", () => {
      expect(isValidE164("15551234567")).toBe(false);
    });

    it("should reject number starting with +0", () => {
      expect(isValidE164("+05551234567")).toBe(false);
    });

    it("should reject empty string", () => {
      expect(isValidE164("")).toBe(false);
    });

    it("should reject number with spaces", () => {
      expect(isValidE164("+1 555 123 4567")).toBe(false);
    });

    it("should reject number with dashes", () => {
      expect(isValidE164("+1-555-123-4567")).toBe(false);
    });

    it("should reject number with parentheses", () => {
      expect(isValidE164("+(555) 123-4567")).toBe(false);
    });

    it("should reject number exceeding 15 digits", () => {
      expect(isValidE164("+1234567890123456")).toBe(false);
    });

    it("should handle leading/trailing whitespace", () => {
      expect(isValidE164("  +15551234567  ")).toBe(true);
    });
  });

  describe("normalizeToE164", () => {
    it("should return already valid E.164 as-is", () => {
      expect(normalizeToE164("+15551234567")).toBe("+15551234567");
    });

    it("should normalize 10-digit US number", () => {
      expect(normalizeToE164("5551234567")).toBe("+15551234567");
    });

    it("should normalize 11-digit US number starting with 1", () => {
      expect(normalizeToE164("15551234567")).toBe("+15551234567");
    });

    it("should normalize formatted US number (555) 123-4567", () => {
      expect(normalizeToE164("(555) 123-4567")).toBe("+15551234567");
    });

    it("should normalize formatted US number 555-123-4567", () => {
      expect(normalizeToE164("555-123-4567")).toBe("+15551234567");
    });

    it("should normalize formatted US number 1-555-123-4567", () => {
      expect(normalizeToE164("1-555-123-4567")).toBe("+15551234567");
    });

    it("should normalize number with dots 555.123.4567", () => {
      expect(normalizeToE164("555.123.4567")).toBe("+15551234567");
    });

    it("should normalize number with spaces 555 123 4567", () => {
      expect(normalizeToE164("555 123 4567")).toBe("+15551234567");
    });

    it("should return null for empty string", () => {
      expect(normalizeToE164("")).toBe(null);
    });

    it("should return null for too-short number", () => {
      expect(normalizeToE164("12345")).toBe(null);
    });

    it("should return null for letters", () => {
      expect(normalizeToE164("abcdefghij")).toBe(null);
    });

    it("should normalize international number with enough digits", () => {
      const result = normalizeToE164("442071234567");
      expect(result).toBe("+442071234567");
      expect(isValidE164(result!)).toBe(true);
    });
  });

  describe("E164_ERROR_MESSAGE", () => {
    it("should be a non-empty string", () => {
      expect(E164_ERROR_MESSAGE).toBeTruthy();
      expect(typeof E164_ERROR_MESSAGE).toBe("string");
    });

    it("should mention E.164", () => {
      expect(E164_ERROR_MESSAGE).toContain("E.164");
    });
  });
});

// ─────────────────────────────────────────────
// Webhook REST Endpoint Tests
// ─────────────────────────────────────────────

describe("VAPI webhook REST endpoint", () => {
  const WEBHOOK_URL = "http://localhost:3000/api/webhooks/vapi";

  it("should accept VAPI native format and return success/error", async () => {
    const res = await fetch(WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: {
          type: "end-of-call-report",
          call: {
            id: "vapi-test-123",
            status: "ended",
            endedReason: "assistant-ended",
            metadata: {
              apex_call_id: "99999",
            },
          },
          artifact: {
            transcript: "Hello, this is a test transcript.",
            recordingUrl: "https://example.com/recording.mp3",
          },
          analysis: {
            summary: "Test call summary",
          },
        },
      }),
    });

    expect(res.status).toBe(200);
    const data = await res.json();
    // Call won't be found (fake ID), but endpoint should respond properly
    expect(data).toHaveProperty("success");
  });

  it("should accept simplified/flat format and return success/error", async () => {
    const res = await fetch(WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        callId: "vapi-test-456",
        status: "ended",
        endedReason: "customer-ended",
        transcript: "Test transcript from n8n",
        recordingUrl: "https://example.com/recording2.mp3",
        summary: "Call went well",
        durationSeconds: 180,
      }),
    });

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toHaveProperty("success");
  });

  it("should accept status-update type payload", async () => {
    const res = await fetch(WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: {
          type: "status-update",
          call: {
            id: "vapi-test-789",
            status: "in-progress",
            metadata: {
              apex_call_id: "99999",
            },
          },
        },
      }),
    });

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toHaveProperty("success");
  });

  it("should accept transcript type payload", async () => {
    const res = await fetch(WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: {
          type: "transcript",
          call: {
            id: "vapi-test-abc",
            metadata: {
              apex_call_id: "99999",
            },
          },
          transcript: "Live transcript update...",
        },
      }),
    });

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toHaveProperty("success");
  });

  it("should handle empty body gracefully", async () => {
    const res = await fetch(WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(false);
  });

  it("should handle payload with apexCallId in simplified format", async () => {
    const res = await fetch(WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        apexCallId: 99999,
        status: "ended",
        endedReason: "assistant-ended",
        transcript: "Test",
      }),
    });

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toHaveProperty("success");
  });

  it("should handle payload with recording_url (snake_case)", async () => {
    const res = await fetch(WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        call_id: "vapi-test-snake",
        status: "ended",
        recording_url: "https://example.com/rec.mp3",
        duration_seconds: 60,
      }),
    });

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toHaveProperty("success");
  });
});
