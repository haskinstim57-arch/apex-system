import { describe, it, expect } from "vitest";
import { listLocations, isSquareConfigured, verifyWebhookSignature } from "./services/square";

describe("Square Integration", () => {
  it("should have Square configured", () => {
    expect(isSquareConfigured()).toBe(true);
  });

  it("should list locations with valid credentials", async () => {
    const locations = await listLocations();
    expect(Array.isArray(locations)).toBe(true);
    expect(locations.length).toBeGreaterThan(0);
    console.log(`[Square] Found ${locations.length} location(s):`, locations.map(l => ({
      id: l.id,
      name: l.name,
      status: l.status,
    })));
  });

  it("should verify webhook signature correctly", () => {
    const body = '{"type":"payment.completed"}';
    const url = "https://example.com/api/webhooks/square";
    
    // Create a valid signature
    const crypto = require("crypto");
    const key = process.env.SQUARE_WEBHOOK_SIGNATURE_KEY || "test-key";
    const hmac = crypto.createHmac("sha256", key);
    hmac.update(url + body);
    const validSig = hmac.digest("base64");

    const result = verifyWebhookSignature(body, validSig, url);
    expect(result).toBe(true);

    // Invalid signature should fail
    const invalidResult = verifyWebhookSignature(body, "invalid-signature", url);
    expect(invalidResult).toBe(false);
  });
});
