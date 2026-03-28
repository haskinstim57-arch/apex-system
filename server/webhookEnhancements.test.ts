import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Test: Condition Evaluation Engine ────────────────────────
describe("Webhook Condition Evaluation", () => {
  let evaluateCondition: typeof import("./services/webhookDispatcher").evaluateCondition;
  let evaluateAllConditions: typeof import("./services/webhookDispatcher").evaluateAllConditions;

  beforeEach(async () => {
    const mod = await import("./services/webhookDispatcher");
    evaluateCondition = mod.evaluateCondition;
    evaluateAllConditions = mod.evaluateAllConditions;
  });

  it("equals operator matches exact string values", () => {
    expect(
      evaluateCondition(
        { field: "contact.leadSource", operator: "equals", value: "Facebook" },
        { contact: { leadSource: "Facebook" } }
      )
    ).toBe(true);
    expect(
      evaluateCondition(
        { field: "contact.leadSource", operator: "equals", value: "Facebook" },
        { contact: { leadSource: "Google" } }
      )
    ).toBe(false);
  });

  it("not_equals operator rejects matching values", () => {
    expect(
      evaluateCondition(
        { field: "contact.status", operator: "not_equals", value: "won" },
        { contact: { status: "new" } }
      )
    ).toBe(true);
    expect(
      evaluateCondition(
        { field: "contact.status", operator: "not_equals", value: "won" },
        { contact: { status: "won" } }
      )
    ).toBe(false);
  });

  it("contains operator checks substring (case-insensitive)", () => {
    expect(
      evaluateCondition(
        { field: "contact.email", operator: "contains", value: "gmail" },
        { contact: { email: "john@gmail.com" } }
      )
    ).toBe(true);
    expect(
      evaluateCondition(
        { field: "contact.email", operator: "contains", value: "yahoo" },
        { contact: { email: "john@gmail.com" } }
      )
    ).toBe(false);
  });

  it("contains operator checks array membership", () => {
    expect(
      evaluateCondition(
        { field: "tags", operator: "contains", value: "VIP" },
        { tags: ["VIP", "Hot Lead"] }
      )
    ).toBe(true);
    expect(
      evaluateCondition(
        { field: "tags", operator: "contains", value: "Cold" },
        { tags: ["VIP", "Hot Lead"] }
      )
    ).toBe(false);
  });

  it("not_contains operator rejects substring", () => {
    expect(
      evaluateCondition(
        { field: "contact.email", operator: "not_contains", value: "spam" },
        { contact: { email: "john@gmail.com" } }
      )
    ).toBe(true);
  });

  it("greater_than and less_than operators compare numbers", () => {
    expect(
      evaluateCondition(
        { field: "review.rating", operator: "greater_than", value: "3" },
        { review: { rating: 5 } }
      )
    ).toBe(true);
    expect(
      evaluateCondition(
        { field: "review.rating", operator: "less_than", value: "3" },
        { review: { rating: 1 } }
      )
    ).toBe(true);
    expect(
      evaluateCondition(
        { field: "review.rating", operator: "greater_than", value: "3" },
        { review: { rating: 2 } }
      )
    ).toBe(false);
  });

  it("in operator checks comma-separated list", () => {
    expect(
      evaluateCondition(
        { field: "contact.status", operator: "in", value: "new, qualified, won" },
        { contact: { status: "qualified" } }
      )
    ).toBe(true);
    expect(
      evaluateCondition(
        { field: "contact.status", operator: "in", value: "new, qualified, won" },
        { contact: { status: "lost" } }
      )
    ).toBe(false);
  });

  it("not_in operator excludes comma-separated list", () => {
    expect(
      evaluateCondition(
        { field: "contact.status", operator: "not_in", value: "lost, nurture" },
        { contact: { status: "new" } }
      )
    ).toBe(true);
    expect(
      evaluateCondition(
        { field: "contact.status", operator: "not_in", value: "lost, nurture" },
        { contact: { status: "lost" } }
      )
    ).toBe(false);
  });

  it("is_empty operator checks for null/undefined/empty values", () => {
    expect(
      evaluateCondition(
        { field: "contact.phone", operator: "is_empty", value: "" },
        { contact: { phone: null } }
      )
    ).toBe(true);
    expect(
      evaluateCondition(
        { field: "contact.phone", operator: "is_empty", value: "" },
        { contact: { phone: "" } }
      )
    ).toBe(true);
    expect(
      evaluateCondition(
        { field: "contact.phone", operator: "is_empty", value: "" },
        { contact: {} }
      )
    ).toBe(true);
    expect(
      evaluateCondition(
        { field: "contact.phone", operator: "is_empty", value: "" },
        { contact: { phone: "555-1234" } }
      )
    ).toBe(false);
  });

  it("is_not_empty operator checks for non-empty values", () => {
    expect(
      evaluateCondition(
        { field: "contact.email", operator: "is_not_empty", value: "" },
        { contact: { email: "test@test.com" } }
      )
    ).toBe(true);
    expect(
      evaluateCondition(
        { field: "contact.email", operator: "is_not_empty", value: "" },
        { contact: { email: "" } }
      )
    ).toBe(false);
  });

  it("resolves deeply nested field paths", () => {
    expect(
      evaluateCondition(
        { field: "data.custom.nested.value", operator: "equals", value: "deep" },
        { data: { custom: { nested: { value: "deep" } } } }
      )
    ).toBe(true);
  });

  it("handles missing field paths gracefully", () => {
    expect(
      evaluateCondition(
        { field: "nonexistent.path", operator: "equals", value: "anything" },
        { contact: { name: "John" } }
      )
    ).toBe(false);
  });

  it("evaluateAllConditions returns true when no conditions", () => {
    expect(evaluateAllConditions(null, { contact: { name: "John" } })).toBe(true);
    expect(evaluateAllConditions([], { contact: { name: "John" } })).toBe(true);
    expect(evaluateAllConditions(undefined, { contact: { name: "John" } })).toBe(true);
  });

  it("evaluateAllConditions uses AND logic (all must pass)", () => {
    const conditions = [
      { field: "contact.leadSource", operator: "equals" as const, value: "Facebook" },
      { field: "contact.status", operator: "equals" as const, value: "new" },
    ];
    expect(
      evaluateAllConditions(conditions, {
        contact: { leadSource: "Facebook", status: "new" },
      })
    ).toBe(true);
    expect(
      evaluateAllConditions(conditions, {
        contact: { leadSource: "Facebook", status: "won" },
      })
    ).toBe(false);
  });
});

// ─── Test: HMAC Signature ─────────────────────────────────────
describe("HMAC Signature Computation", () => {
  it("produces consistent SHA-256 HMAC", async () => {
    const { computeHmacSignature } = await import("./services/webhookDispatcher");
    const sig1 = computeHmacSignature("secret123", '{"event":"test"}');
    const sig2 = computeHmacSignature("secret123", '{"event":"test"}');
    expect(sig1).toBe(sig2);
    expect(sig1).toHaveLength(64); // SHA-256 hex = 64 chars
  });

  it("different secrets produce different signatures", async () => {
    const { computeHmacSignature } = await import("./services/webhookDispatcher");
    const sig1 = computeHmacSignature("secret1", "body");
    const sig2 = computeHmacSignature("secret2", "body");
    expect(sig1).not.toBe(sig2);
  });
});

// ─── Test: API Key Generation ─────────────────────────────────
describe("API Key Generation", () => {
  it("generates keys with ak_ prefix", async () => {
    const { generateApiKey } = await import("./routers/apiKeys");
    const { fullKey, keyHash, keyPrefix } = generateApiKey();
    expect(fullKey.startsWith("ak_")).toBe(true);
    expect(fullKey.length).toBe(43); // "ak_" + 40 hex chars
    expect(keyPrefix).toBe(fullKey.slice(0, 11));
    expect(keyHash).toHaveLength(64); // SHA-256 hex
  });

  it("generates unique keys each time", async () => {
    const { generateApiKey } = await import("./routers/apiKeys");
    const key1 = generateApiKey();
    const key2 = generateApiKey();
    expect(key1.fullKey).not.toBe(key2.fullKey);
    expect(key1.keyHash).not.toBe(key2.keyHash);
  });

  it("hashApiKey produces consistent hashes", async () => {
    const { hashApiKey, generateApiKey } = await import("./routers/apiKeys");
    const { fullKey, keyHash } = generateApiKey();
    expect(hashApiKey(fullKey)).toBe(keyHash);
  });
});

// ─── Test: Webhook Secret Generation ──────────────────────────
describe("Webhook Secret Generation", () => {
  it("generates 64-char hex secrets", async () => {
    const { generateWebhookSecret } = await import("./services/webhookDispatcher");
    const secret = generateWebhookSecret();
    expect(secret).toHaveLength(64);
    expect(/^[0-9a-f]+$/.test(secret)).toBe(true);
  });

  it("generates unique secrets", async () => {
    const { generateWebhookSecret } = await import("./services/webhookDispatcher");
    const s1 = generateWebhookSecret();
    const s2 = generateWebhookSecret();
    expect(s1).not.toBe(s2);
  });
});

// ─── Test: Schema Validation ──────────────────────────────────
describe("Schema Exports", () => {
  it("exports webhookDeliveryLogs table", async () => {
    const schema = await import("../drizzle/schema");
    expect(schema.webhookDeliveryLogs).toBeDefined();
  });

  it("exports apiKeys table", async () => {
    const schema = await import("../drizzle/schema");
    expect(schema.apiKeys).toBeDefined();
  });

  it("exports inboundRequestLogs table", async () => {
    const schema = await import("../drizzle/schema");
    expect(schema.inboundRequestLogs).toBeDefined();
  });

  it("outboundWebhooks table has conditions column", async () => {
    const schema = await import("../drizzle/schema");
    expect(schema.outboundWebhooks.conditions).toBeDefined();
  });
});

// ─── Test: Webhook Event Types ────────────────────────────────
describe("Webhook Event Types", () => {
  it("WebhookEvent type covers all expected events", async () => {
    // This is a compile-time check — if the type is wrong, TS will fail
    const events: import("./services/webhookDispatcher").WebhookEvent[] = [
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
    expect(events).toHaveLength(13);
  });
});

// ─── Test: Condition Edge Cases ───────────────────────────────
describe("Condition Edge Cases", () => {
  let evaluateCondition: typeof import("./services/webhookDispatcher").evaluateCondition;

  beforeEach(async () => {
    const mod = await import("./services/webhookDispatcher");
    evaluateCondition = mod.evaluateCondition;
  });

  it("handles numeric string comparison for equals", () => {
    expect(
      evaluateCondition(
        { field: "rating", operator: "equals", value: "5" },
        { rating: 5 }
      )
    ).toBe(true);
  });

  it("handles empty array for is_empty", () => {
    expect(
      evaluateCondition(
        { field: "tags", operator: "is_empty", value: "" },
        { tags: [] }
      )
    ).toBe(true);
  });

  it("handles non-empty array for is_not_empty", () => {
    expect(
      evaluateCondition(
        { field: "tags", operator: "is_not_empty", value: "" },
        { tags: ["VIP"] }
      )
    ).toBe(true);
  });

  it("unknown operator defaults to pass", () => {
    expect(
      evaluateCondition(
        { field: "x", operator: "unknown_op" as any, value: "y" },
        { x: "z" }
      )
    ).toBe(true);
  });
});
