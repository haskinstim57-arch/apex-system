import { describe, expect, it } from "vitest";

describe("Google OAuth Secret Validation", () => {
  it("GOOGLE_CLIENT_ID is set and has valid format", () => {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    expect(clientId).toBeDefined();
    expect(clientId!.length).toBeGreaterThan(10);
    // Google client IDs end with .apps.googleusercontent.com
    expect(clientId).toMatch(/\.apps\.googleusercontent\.com$/);
  });

  it("GOOGLE_CLIENT_SECRET is set and has valid format", () => {
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    expect(clientSecret).toBeDefined();
    expect(clientSecret!.length).toBeGreaterThan(10);
    // Google client secrets start with GOCSPX-
    expect(clientSecret).toMatch(/^GOCSPX-/);
  });

  it("Google OAuth credentials are accessible via ENV helper", async () => {
    const { ENV } = await import("./_core/env");
    expect(ENV.googleClientId).toBeTruthy();
    expect(ENV.googleClientSecret).toBeTruthy();
    expect(ENV.googleClientId).toMatch(/\.apps\.googleusercontent\.com$/);
  });
});
