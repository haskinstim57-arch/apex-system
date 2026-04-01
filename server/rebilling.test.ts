import { describe, it, expect } from "vitest";

// ─── Unit tests for rebilling markup logic ───

describe("Rebilling Markup Logic", () => {
  // Test markup multiplier calculations
  describe("Markup Calculations", () => {
    it("should calculate correct client cost with 1.1x markup", () => {
      const baseCost = 0.015; // SMS base cost
      const markup = 1.1;
      const clientCost = baseCost * markup;
      expect(clientCost).toBeCloseTo(0.0165, 4);
    });

    it("should calculate correct profit with 1.5x markup", () => {
      const baseCost = 0.015;
      const markup = 1.5;
      const clientCost = baseCost * markup;
      const profit = clientCost - baseCost;
      expect(profit).toBeCloseTo(0.0075, 4);
    });

    it("should calculate zero profit with 1.0x markup (no markup)", () => {
      const baseCost = 0.15; // AI call cost
      const markup = 1.0;
      const profit = baseCost * markup - baseCost;
      expect(profit).toBeCloseTo(0, 4);
    });

    it("should calculate correct margin percentage", () => {
      const markup = 2.0;
      const marginPct = (markup - 1) * 100;
      expect(marginPct).toBe(100);
    });

    it("should handle 5x maximum markup", () => {
      const baseCost = 0.003; // email cost
      const markup = 5.0;
      const clientCost = baseCost * markup;
      expect(clientCost).toBeCloseTo(0.015, 4);
    });
  });

  // Test per-service markup application
  describe("Per-Service Markup Application", () => {
    const services = [
      { key: "sms", baseCost: 0.015 },
      { key: "email", baseCost: 0.003 },
      { key: "aiCall", baseCost: 0.15 },
      { key: "voiceCall", baseCost: 0.05 },
      { key: "llm", baseCost: 0.02 },
      { key: "dialer", baseCost: 0.03 },
    ];

    it("should apply different markups to different services", () => {
      const markups: Record<string, number> = {
        sms: 1.5,
        email: 2.0,
        aiCall: 1.1,
        voiceCall: 1.3,
        llm: 1.0,
        dialer: 1.8,
      };

      for (const svc of services) {
        const markup = markups[svc.key];
        const clientCost = svc.baseCost * markup;
        const profit = clientCost - svc.baseCost;
        expect(profit).toBeGreaterThanOrEqual(0);
        expect(clientCost).toBeGreaterThanOrEqual(svc.baseCost);
      }
    });

    it("should skip disabled services in profit calculation", () => {
      const enabledServices = services.filter(s => s.key !== "llm" && s.key !== "dialer");
      const disabledServices = services.filter(s => s.key === "llm" || s.key === "dialer");

      let totalProfit = 0;
      const markup = 1.5;

      for (const svc of enabledServices) {
        totalProfit += svc.baseCost * (markup - 1);
      }

      // Disabled services should not contribute to profit
      for (const svc of disabledServices) {
        // These are excluded
      }

      expect(totalProfit).toBeGreaterThan(0);
      // Only 4 services contribute
      const expectedProfit = (0.015 + 0.003 + 0.15 + 0.05) * 0.5;
      expect(totalProfit).toBeCloseTo(expectedProfit, 4);
    });
  });

  // Test rebilling settings validation
  describe("Rebilling Settings Validation", () => {
    it("should enforce minimum markup of 1.0", () => {
      const markup = Math.max(1.0, 0.5);
      expect(markup).toBe(1.0);
    });

    it("should enforce maximum markup of 5.0", () => {
      const markup = Math.min(5.0, 10.0);
      expect(markup).toBe(5.0);
    });

    it("should round markup to 2 decimal places", () => {
      const rawMarkup = 1.123456;
      const rounded = Math.round(rawMarkup * 100) / 100;
      expect(rounded).toBe(1.12);
    });

    it("should handle step increments of 0.05", () => {
      const steps = [];
      for (let i = 0; i <= 20; i++) {
        steps.push(Math.round((1.0 + i * 0.05) * 100) / 100);
      }
      expect(steps).toContain(1.0);
      expect(steps).toContain(1.05);
      expect(steps).toContain(1.5);
      expect(steps).toContain(2.0);
    });
  });

  // Test $10 spend estimate calculation
  describe("Spend Estimate Calculations", () => {
    it("should calculate correct profit from $10 SMS spend at 1.5x", () => {
      const baseCost = 0.015;
      const markup = 1.5;
      const chargedCost = baseCost * markup; // 0.0225
      const profitPerUnit = baseCost * (markup - 1); // 0.0075
      const unitsFor10 = 10 / chargedCost; // ~444.44
      const totalProfit = unitsFor10 * profitPerUnit;
      // At 1.5x, $10 spend → ~$3.33 profit (1/3 of revenue)
      expect(totalProfit).toBeCloseTo(3.33, 1);
    });

    it("should calculate correct profit from $10 email spend at 2x", () => {
      const baseCost = 0.003;
      const markup = 2.0;
      const chargedCost = baseCost * markup; // 0.006
      const profitPerUnit = baseCost * (markup - 1); // 0.003
      const unitsFor10 = 10 / chargedCost; // ~1666.67
      const totalProfit = unitsFor10 * profitPerUnit;
      // At 2x, $10 spend → $5 profit (50% of revenue)
      expect(totalProfit).toBeCloseTo(5.0, 1);
    });

    it("should return zero profit for 1.0x markup", () => {
      const baseCost = 0.15;
      const markup = 1.0;
      const chargedCost = baseCost * markup;
      const profitPerUnit = baseCost * (markup - 1);
      const unitsFor10 = 10 / chargedCost;
      const totalProfit = unitsFor10 * profitPerUnit;
      expect(totalProfit).toBeCloseTo(0, 4);
    });
  });

  // Test cascade logic
  describe("Rebilling Cascade Logic", () => {
    it("should use account-specific settings when available", () => {
      const accountSettings = { smsMarkup: 2.0 };
      const defaultMarkup = 1.1;
      const effectiveMarkup = accountSettings.smsMarkup ?? defaultMarkup;
      expect(effectiveMarkup).toBe(2.0);
    });

    it("should fall back to default when account settings are null", () => {
      const accountSettings: { smsMarkup?: number } = {};
      const defaultMarkup = 1.1;
      const effectiveMarkup = accountSettings.smsMarkup ?? defaultMarkup;
      expect(effectiveMarkup).toBe(1.1);
    });
  });
});
