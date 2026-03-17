import { describe, it, expect } from "vitest";

describe("SendGrid Secret Validation", () => {
  it("SENDGRID_API_KEY environment variable is set", () => {
    expect(process.env.SENDGRID_API_KEY).toBeDefined();
    expect(process.env.SENDGRID_API_KEY!.startsWith("SG.")).toBe(true);
  });

  it("SENDGRID_FROM_EMAIL environment variable is set", () => {
    expect(process.env.SENDGRID_FROM_EMAIL).toBeDefined();
    expect(process.env.SENDGRID_FROM_EMAIL).toContain("@");
  });

  it("SENDGRID_FROM_NAME environment variable is set", () => {
    expect(process.env.SENDGRID_FROM_NAME).toBeDefined();
    expect(process.env.SENDGRID_FROM_NAME!.length).toBeGreaterThan(0);
  });

  it("SendGrid API key is valid (lightweight API call)", async () => {
    const response = await fetch("https://api.sendgrid.com/v3/scopes", {
      method: "GET",
      headers: {
        Authorization: `Bearer ${process.env.SENDGRID_API_KEY}`,
        "Content-Type": "application/json",
      },
    });
    // 200 = valid key, 401 = invalid key
    expect(response.status).toBe(200);
  });
});
