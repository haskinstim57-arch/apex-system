import { describe, expect, it } from "vitest";

describe("Square Environment Variables", () => {
  it("VITE_SQUARE_ENVIRONMENT is set", () => {
    const env = process.env.VITE_SQUARE_ENVIRONMENT;
    expect(env).toBeDefined();
    expect(["sandbox", "production"]).toContain(env);
  });

  it("VITE_SQUARE_APPLICATION_ID is set", () => {
    const env = process.env.VITE_SQUARE_APPLICATION_ID;
    expect(env).toBeDefined();
    expect(env!.length).toBeGreaterThan(0);
  });

  it("VITE_SQUARE_LOCATION_ID is set", () => {
    const env = process.env.VITE_SQUARE_LOCATION_ID;
    expect(env).toBeDefined();
    expect(env!.length).toBeGreaterThan(0);
  });
});
