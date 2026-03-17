import { describe, it, expect } from "vitest";

describe("VITE_APP_URL environment variable", () => {
  it("should be set and not empty", () => {
    const url = process.env.VITE_APP_URL;
    expect(url).toBeDefined();
    expect(url).not.toBe("");
  });

  it("should be a valid HTTPS URL", () => {
    const url = process.env.VITE_APP_URL!;
    expect(url).toMatch(/^https:\/\//);
  });

  it("should not point to localhost", () => {
    const url = process.env.VITE_APP_URL!;
    expect(url).not.toContain("localhost");
    expect(url).not.toContain("127.0.0.1");
  });

  it("should point to the production domain", () => {
    const url = process.env.VITE_APP_URL!;
    expect(url).toContain("apexcrm-knxkwfan.manus.space");
  });
});
