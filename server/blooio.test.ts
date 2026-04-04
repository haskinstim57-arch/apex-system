import { describe, it, expect } from "vitest";

describe("Blooio API Key Validation", () => {
  it("should have BLOOIO_API_KEY environment variable set", () => {
    const apiKey = process.env.BLOOIO_API_KEY;
    expect(apiKey).toBeDefined();
    expect(apiKey).not.toBe("");
    expect(apiKey!.startsWith("api_")).toBe(true);
  });

  it("should authenticate with Blooio API", async () => {
    const apiKey = process.env.BLOOIO_API_KEY;
    if (!apiKey) {
      throw new Error("BLOOIO_API_KEY not set");
    }

    // Use a lightweight GET request to validate the API key
    // We'll try to get chats list which should return 200 if key is valid
    const response = await fetch("https://backend.blooio.com/v2/api/chats?limit=1", {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
    });

    // 200 = valid key, 401 = invalid key
    expect(response.status).not.toBe(401);
    // Accept 200 or any non-auth-error status
    expect([200, 201, 204, 404].includes(response.status) || response.ok).toBe(true);
  }, 15000);
});
