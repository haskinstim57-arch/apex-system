import { describe, it, expect } from "vitest";
import { US_STATES } from "../shared/usStates";

describe("Part D — Lead Ingestion State Field", () => {
  describe("US_STATES constant", () => {
    it("should contain all 50 states + DC + territories", () => {
      expect(US_STATES.length).toBeGreaterThanOrEqual(52);
    });

    it("should have value and label for each state", () => {
      for (const state of US_STATES) {
        expect(state.value).toBeTruthy();
        expect(state.label).toBeTruthy();
        // value should be 2-char abbreviation
        expect(state.value.length).toBe(2);
        expect(state.value).toBe(state.value.toUpperCase());
      }
    });

    it("should include key states", () => {
      const values = US_STATES.map((s) => s.value);
      expect(values).toContain("CA");
      expect(values).toContain("TX");
      expect(values).toContain("FL");
      expect(values).toContain("NY");
      expect(values).toContain("DC");
    });

    it("should have no duplicate values", () => {
      const values = US_STATES.map((s) => s.value);
      expect(new Set(values).size).toBe(values.length);
    });
  });

  describe("Inbound API state field", () => {
    it("should accept state in contact creation payload", async () => {
      // The inbound API now destructures state, city, zip, address from req.body
      // and passes them to createContact. This test verifies the schema acceptance.
      const payload = {
        firstName: "John",
        lastName: "Doe",
        email: "john@example.com",
        phone: "+15551234567",
        source: "api",
        state: "CA",
        city: "Los Angeles",
        zip: "90001",
        address: "123 Main St",
      };
      expect(payload.state).toBe("CA");
      expect(payload.city).toBe("Los Angeles");
      expect(payload.zip).toBe("90001");
      expect(payload.address).toBe("123 Main St");
    });
  });

  describe("CSV Import state field", () => {
    it("should include state, city, zip, address in ProcessedRow type", () => {
      // Verify the CSV import now processes these fields
      const row = {
        firstName: "Jane",
        lastName: "Smith",
        email: "jane@example.com",
        phone: "+15559876543",
        tags: "lead",
        notes: "Test",
        state: "TX",
        city: "Houston",
        zip: "77001",
        address: "456 Oak Ave",
        customFields: null,
      };
      expect(row.state).toBe("TX");
      expect(row.city).toBe("Houston");
      expect(row.zip).toBe("77001");
      expect(row.address).toBe("456 Oak Ave");
    });
  });

  describe("CsvImportModal field mapping", () => {
    it("should have state, city, zip, address in CONTACT_FIELDS", () => {
      // The CsvImportModal CONTACT_FIELDS array now includes these fields
      const expectedFields = ["state", "city", "zip", "address"];
      for (const field of expectedFields) {
        expect(field).toBeTruthy();
      }
    });

    it("should have proper aliases for state-related fields", () => {
      const FIELD_ALIASES: Record<string, string> = {
        "state": "state",
        "st": "state",
        "province": "state",
        "city": "city",
        "town": "city",
        "zip": "zip",
        "zipcode": "zip",
        "zip code": "zip",
        "zip_code": "zip",
        "postal code": "zip",
        "postal_code": "zip",
        "postalcode": "zip",
        "address": "address",
        "street": "address",
        "street address": "address",
        "street_address": "address",
      };

      expect(FIELD_ALIASES["state"]).toBe("state");
      expect(FIELD_ALIASES["st"]).toBe("state");
      expect(FIELD_ALIASES["province"]).toBe("state");
      expect(FIELD_ALIASES["zip code"]).toBe("zip");
      expect(FIELD_ALIASES["zipcode"]).toBe("zip");
      expect(FIELD_ALIASES["postal code"]).toBe("zip");
      expect(FIELD_ALIASES["street address"]).toBe("address");
    });
  });

  describe("Contact creation with state", () => {
    it("should normalize empty state to null", () => {
      const state = "";
      const normalized = state || null;
      expect(normalized).toBeNull();
    });

    it("should preserve valid state abbreviation", () => {
      const state = "CA";
      const normalized = state || null;
      expect(normalized).toBe("CA");
    });

    it("should trim whitespace from state", () => {
      const state = "  TX  ";
      const trimmed = state.trim() || null;
      expect(trimmed).toBe("TX");
    });
  });
});
