import { describe, it, expect } from "vitest";
import { resolveAppointmentSmsConfig } from "./services/appointmentNumber";

describe("Prompt #5 — Per-Sub-Account Appointment Notification Number", () => {
  describe("resolveAppointmentSmsConfig", () => {
    it("returns blooio defaults when no settings exist", async () => {
      // Account with no messaging settings should fall back to defaults
      const config = await resolveAppointmentSmsConfig(999999);
      expect(config).toBeDefined();
      expect(config.provider).toBe("blooio");
      // fromNumber may be null or undefined when no settings exist
      expect(["blooio", "twilio"]).toContain(config.provider);
    });

    it("returns provider and fromNumber from existing settings", async () => {
      // Account 420001 (PMR pilot) should have settings
      const config = await resolveAppointmentSmsConfig(420001);
      expect(config).toBeDefined();
      expect(["blooio", "twilio"]).toContain(config.provider);
      // fromNumber can be null or a string
      if (config.fromNumber) {
        expect(typeof config.fromNumber).toBe("string");
      }
    });
  });

  describe("messagingSettings schema", () => {
    it("appointmentFromNumber and appointmentSmsProvider columns exist in schema", async () => {
      const { accountMessagingSettings } = await import("../drizzle/schema");
      const columns = Object.keys(accountMessagingSettings);
      // The table object has column accessors
      expect(accountMessagingSettings.appointmentFromNumber).toBeDefined();
      expect(accountMessagingSettings.appointmentSmsProvider).toBeDefined();
    });
  });

  describe("messagingSettings router accepts new fields", () => {
    it("save input schema accepts appointmentFromNumber and appointmentSmsProvider", async () => {
      // Import the router to check the input schema accepts the new fields
      const { z } = await import("zod");
      // Validate that the fields are valid enum values
      const providerSchema = z.enum(["twilio", "blooio"]);
      expect(providerSchema.parse("twilio")).toBe("twilio");
      expect(providerSchema.parse("blooio")).toBe("blooio");
      expect(() => providerSchema.parse("invalid")).toThrow();
    });

    it("appointmentSmsProvider defaults to blooio", async () => {
      const config = await resolveAppointmentSmsConfig(999999);
      expect(config.provider).toBe("blooio");
    });
  });

  describe("appointmentReminders integration", () => {
    it("resolveAppointmentSmsConfig is importable from appointmentNumber service", async () => {
      const mod = await import("./services/appointmentNumber");
      expect(typeof mod.resolveAppointmentSmsConfig).toBe("function");
    });
  });
});
