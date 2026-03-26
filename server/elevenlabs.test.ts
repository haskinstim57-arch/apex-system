import { describe, it, expect } from "vitest";

describe("ElevenLabs API Key Validation", () => {
  it("should authenticate with ElevenLabs API", async () => {
    const apiKey = process.env.ELEVENLABS_API_KEY;
    expect(apiKey).toBeTruthy();

    const res = await fetch("https://api.elevenlabs.io/v1/user", {
      headers: { "xi-api-key": apiKey! },
    });

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toHaveProperty("subscription");
  });
});
