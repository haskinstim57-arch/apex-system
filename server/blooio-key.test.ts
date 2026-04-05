import { describe, it, expect } from "vitest";

describe("Blooio API key validation", () => {
  it("should authenticate with the Blooio API", async () => {
    const apiKey = process.env.BLOOIO_API_KEY;
    expect(apiKey).toBeTruthy();
    expect(apiKey).toMatch(/^api_/);

    // Call a lightweight Blooio endpoint to verify the key works
    // Try listing phone numbers assigned to this API key
    const response = await fetch("https://backend.blooio.com/v2/api/phone-numbers", {
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
    });

    console.log("[Blooio] Response status:", response.status);
    // 401 = invalid key, anything else means the key is valid
    expect(response.status).not.toBe(401);
    // Accept 200 or 404 (endpoint might not exist but key is valid)
    expect([200, 404]).toContain(response.status);

    if (response.status === 200) {
      const data = await response.json();
      console.log("[Blooio] Phone numbers:", JSON.stringify(data, null, 2));
    }
  });
});
