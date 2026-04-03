import { describe, it, expect } from "vitest";

describe("VAPID Configuration", () => {
  it("should have VAPID_PUBLIC_KEY set", () => {
    const key = process.env.VAPID_PUBLIC_KEY;
    expect(key).toBeDefined();
    expect(key!.length).toBeGreaterThan(10);
    // VAPID public keys are base64url encoded
    expect(key).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it("should have VAPID_PRIVATE_KEY set", () => {
    const key = process.env.VAPID_PRIVATE_KEY;
    expect(key).toBeDefined();
    expect(key!.length).toBeGreaterThan(10);
    expect(key).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it("should have VAPID_SUBJECT set as mailto:", () => {
    const subject = process.env.VAPID_SUBJECT;
    expect(subject).toBeDefined();
    expect(subject).toMatch(/^mailto:.+@.+/);
  });
});
