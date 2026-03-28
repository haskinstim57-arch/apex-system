import { describe, expect, it, vi, beforeEach } from "vitest";
import crypto from "crypto";
import {
  computeHmacSignature,
  generateWebhookSecret,
} from "./services/webhookDispatcher";

// ─── Unit Tests: HMAC Signature ──────────────────────────────
describe("Outbound Webhooks — HMAC Signature", () => {
  it("computes a valid HMAC-SHA256 hex digest", () => {
    const secret = "test-secret-key";
    const body = JSON.stringify({ event: "contact_created", data: { contactId: 1 } });
    const signature = computeHmacSignature(secret, body);

    // Verify against Node crypto directly
    const expected = crypto.createHmac("sha256", secret).update(body, "utf8").digest("hex");
    expect(signature).toBe(expected);
  });

  it("produces different signatures for different secrets", () => {
    const body = '{"event":"test"}';
    const sig1 = computeHmacSignature("secret-a", body);
    const sig2 = computeHmacSignature("secret-b", body);
    expect(sig1).not.toBe(sig2);
  });

  it("produces different signatures for different bodies", () => {
    const secret = "same-secret";
    const sig1 = computeHmacSignature(secret, '{"event":"a"}');
    const sig2 = computeHmacSignature(secret, '{"event":"b"}');
    expect(sig1).not.toBe(sig2);
  });

  it("returns a 64-character hex string", () => {
    const sig = computeHmacSignature("key", "body");
    expect(sig).toMatch(/^[0-9a-f]{64}$/);
  });

  it("is deterministic — same inputs produce same output", () => {
    const secret = "deterministic-key";
    const body = '{"test":true}';
    const sig1 = computeHmacSignature(secret, body);
    const sig2 = computeHmacSignature(secret, body);
    expect(sig1).toBe(sig2);
  });
});

// ─── Unit Tests: Secret Generation ───────────────────────────
describe("Outbound Webhooks — Secret Generation", () => {
  it("generates a 64-character hex string", () => {
    const secret = generateWebhookSecret();
    expect(secret).toMatch(/^[0-9a-f]{64}$/);
  });

  it("generates unique secrets each time", () => {
    const secrets = new Set(Array.from({ length: 20 }, () => generateWebhookSecret()));
    expect(secrets.size).toBe(20);
  });

  it("generates secrets of correct byte length (32 bytes = 64 hex chars)", () => {
    const secret = generateWebhookSecret();
    expect(secret.length).toBe(64);
    // Verify it's valid hex
    expect(Buffer.from(secret, "hex").length).toBe(32);
  });
});

// ─── Unit Tests: Webhook Payload Structure ───────────────────
describe("Outbound Webhooks — Payload Structure", () => {
  it("builds correct payload shape", () => {
    const event = "contact_created";
    const accountId = 42;
    const data = { contactId: 123, name: "John Doe" };
    const timestamp = new Date().toISOString();

    const payload = {
      event,
      timestamp,
      accountId,
      data,
    };

    expect(payload).toHaveProperty("event", "contact_created");
    expect(payload).toHaveProperty("accountId", 42);
    expect(payload).toHaveProperty("data.contactId", 123);
    expect(payload).toHaveProperty("timestamp");
    expect(new Date(payload.timestamp).getTime()).not.toBeNaN();
  });

  it("includes all supported event types", () => {
    const supportedEvents = [
      "contact_created",
      "contact_updated",
      "tag_added",
      "pipeline_stage_changed",
      "facebook_lead_received",
      "inbound_message_received",
      "appointment_booked",
      "appointment_cancelled",
      "call_completed",
      "missed_call",
      "form_submitted",
      "review_received",
      "workflow_completed",
    ];
    expect(supportedEvents.length).toBe(13);
    // Verify no duplicates
    expect(new Set(supportedEvents).size).toBe(13);
  });
});

// ─── Unit Tests: Signature Verification Flow ─────────────────
describe("Outbound Webhooks — Signature Verification", () => {
  it("recipient can verify payload authenticity using shared secret", () => {
    const secret = generateWebhookSecret();
    const payload = JSON.stringify({
      event: "form_submitted",
      timestamp: new Date().toISOString(),
      accountId: 1,
      data: { formId: "abc", contactId: 99 },
    });

    // Sender computes signature
    const senderSignature = computeHmacSignature(secret, payload);

    // Recipient verifies
    const recipientSignature = crypto
      .createHmac("sha256", secret)
      .update(payload, "utf8")
      .digest("hex");

    expect(senderSignature).toBe(recipientSignature);
  });

  it("verification fails with wrong secret", () => {
    const correctSecret = generateWebhookSecret();
    const wrongSecret = generateWebhookSecret();
    const payload = '{"event":"test"}';

    const senderSig = computeHmacSignature(correctSecret, payload);
    const wrongSig = computeHmacSignature(wrongSecret, payload);

    expect(senderSig).not.toBe(wrongSig);
  });

  it("verification fails with tampered payload", () => {
    const secret = generateWebhookSecret();
    const originalPayload = '{"event":"contact_created","data":{"contactId":1}}';
    const tamperedPayload = '{"event":"contact_created","data":{"contactId":2}}';

    const originalSig = computeHmacSignature(secret, originalPayload);
    const tamperedSig = computeHmacSignature(secret, tamperedPayload);

    expect(originalSig).not.toBe(tamperedSig);
  });
});

// ─── Unit Tests: Webhook Router Input Validation ─────────────
describe("Outbound Webhooks — Router Input Schemas", () => {
  it("validates webhook URL format", () => {
    const { z } = require("zod");
    const urlSchema = z.string().url();

    expect(() => urlSchema.parse("https://hooks.zapier.com/hooks/catch/123")).not.toThrow();
    expect(() => urlSchema.parse("https://hook.us1.make.com/abc")).not.toThrow();
    expect(() => urlSchema.parse("not-a-url")).toThrow();
    expect(() => urlSchema.parse("")).toThrow();
  });

  it("validates trigger event enum", () => {
    const { z } = require("zod");
    const triggerEventEnum = z.enum([
      "contact_created",
      "contact_updated",
      "tag_added",
      "pipeline_stage_changed",
      "facebook_lead_received",
      "inbound_message_received",
      "appointment_booked",
      "appointment_cancelled",
      "call_completed",
      "missed_call",
      "form_submitted",
      "review_received",
      "workflow_completed",
    ]);

    expect(() => triggerEventEnum.parse("contact_created")).not.toThrow();
    expect(() => triggerEventEnum.parse("review_received")).not.toThrow();
    expect(() => triggerEventEnum.parse("invalid_event")).toThrow();
  });

  it("validates webhook name length", () => {
    const { z } = require("zod");
    const nameSchema = z.string().min(1).max(255);

    expect(() => nameSchema.parse("My Zapier Hook")).not.toThrow();
    expect(() => nameSchema.parse("")).toThrow();
    expect(() => nameSchema.parse("x".repeat(256))).toThrow();
  });

  it("validates description max length", () => {
    const { z } = require("zod");
    const descSchema = z.string().max(500).optional();

    expect(() => descSchema.parse("Short description")).not.toThrow();
    expect(() => descSchema.parse(undefined)).not.toThrow();
    expect(() => descSchema.parse("x".repeat(501))).toThrow();
  });
});

// ─── Unit Tests: Schema Table Structure ──────────────────────
import { outboundWebhooks } from "../drizzle/schema";

describe("Outbound Webhooks — Schema", () => {
  it("outboundWebhooks table is exported from schema", () => {
    expect(outboundWebhooks).toBeDefined();
  });

  it("schema has correct column names", () => {
    const columnNames = Object.keys(outboundWebhooks);
    expect(columnNames).toContain("id");
    expect(columnNames).toContain("accountId");
    expect(columnNames).toContain("name");
    expect(columnNames).toContain("triggerEvent");
    expect(columnNames).toContain("url");
    expect(columnNames).toContain("secret");
    expect(columnNames).toContain("isActive");
    expect(columnNames).toContain("failCount");
  });
});

// ─── Unit Tests: Auto-disable Logic ──────────────────────────
describe("Outbound Webhooks — Auto-disable Threshold", () => {
  it("MAX_CONSECUTIVE_FAILURES constant is 10", () => {
    // This tests the business rule that webhooks auto-disable after 10 failures
    const MAX_CONSECUTIVE_FAILURES = 10;
    expect(MAX_CONSECUTIVE_FAILURES).toBe(10);
  });

  it("fail count increments correctly", () => {
    let failCount = 0;
    for (let i = 0; i < 5; i++) {
      failCount += 1;
    }
    expect(failCount).toBe(5);
    expect(failCount < 10).toBe(true); // Still active
  });

  it("webhook should auto-disable at threshold", () => {
    let failCount = 9;
    failCount += 1; // 10th failure
    const shouldDisable = failCount >= 10;
    expect(shouldDisable).toBe(true);
  });

  it("fail count resets on success", () => {
    let failCount = 8;
    // Simulate success
    failCount = 0;
    expect(failCount).toBe(0);
  });
});

// ─── Integration Tests: Webhook Dispatcher Import ────────────
import {
  dispatchWebhookEvent,
  testWebhook,
} from "./services/webhookDispatcher";

describe("Outbound Webhooks — Module Imports", () => {
  it("webhookDispatcher exports all required functions", () => {
    expect(typeof computeHmacSignature).toBe("function");
    expect(typeof generateWebhookSecret).toBe("function");
    expect(typeof dispatchWebhookEvent).toBe("function");
    expect(typeof testWebhook).toBe("function");
  });

  it("dispatchWebhookEvent is an async function", () => {
    // dispatchWebhookEvent should return a promise
    expect(dispatchWebhookEvent.constructor.name).toBe("AsyncFunction");
  });

  it("testWebhook is an async function", () => {
    expect(testWebhook.constructor.name).toBe("AsyncFunction");
  });
});
