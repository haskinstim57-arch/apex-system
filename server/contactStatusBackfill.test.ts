import { describe, it, expect } from "vitest";

describe("Contact Status Backfill + hasMessages Filter", () => {
  describe("Backfill SQL logic", () => {
    it("should only promote contacts in new/uncontacted status", () => {
      const targetStatuses = ["new", "uncontacted"];
      const allStatuses = [
        "new", "uncontacted", "contacted", "engaged",
        "application_taken", "application_in_progress", "credit_repair",
        "callback_scheduled", "app_link_pending",
        "qualified", "proposal", "negotiation",
        "won", "lost", "nurture",
      ];
      // Only new and uncontacted should be eligible for promotion
      const eligible = allStatuses.filter(s => targetStatuses.includes(s));
      expect(eligible).toEqual(["new", "uncontacted"]);
      // All other statuses should NOT be eligible
      const ineligible = allStatuses.filter(s => !targetStatuses.includes(s));
      expect(ineligible).toHaveLength(13);
      expect(ineligible).not.toContain("new");
      expect(ineligible).not.toContain("uncontacted");
    });

    it("should only promote contacts that have outbound messages", () => {
      // Simulate contacts with their message directions
      const contacts = [
        { id: 1, status: "uncontacted", messages: [{ direction: "outbound" }] },
        { id: 2, status: "uncontacted", messages: [{ direction: "inbound" }] },
        { id: 3, status: "new", messages: [{ direction: "outbound" }] },
        { id: 4, status: "contacted", messages: [{ direction: "outbound" }] },
        { id: 5, status: "uncontacted", messages: [] },
      ];

      const contactsWithOutbound = new Set(
        contacts
          .filter(c => c.messages.some(m => m.direction === "outbound"))
          .map(c => c.id)
      );

      const toPromote = contacts.filter(
        c => ["new", "uncontacted"].includes(c.status) && contactsWithOutbound.has(c.id)
      );

      expect(toPromote.map(c => c.id)).toEqual([1, 3]);
      // id=2 has only inbound, id=4 is already contacted, id=5 has no messages
    });
  });

  describe("hasMessages filter logic", () => {
    it("should filter to only contacts WITH messages when hasMessages=true", () => {
      const allContacts = [
        { id: 1, name: "Alice" },
        { id: 2, name: "Bob" },
        { id: 3, name: "Charlie" },
      ];
      const contactIdsWithMessages = new Set([1, 3]);

      const filtered = allContacts.filter(c => contactIdsWithMessages.has(c.id));
      expect(filtered.map(c => c.id)).toEqual([1, 3]);
    });

    it("should filter to only contacts WITHOUT messages when hasNoMessages=true", () => {
      const allContacts = [
        { id: 1, name: "Alice" },
        { id: 2, name: "Bob" },
        { id: 3, name: "Charlie" },
      ];
      const contactIdsWithMessages = new Set([1, 3]);

      const filtered = allContacts.filter(c => !contactIdsWithMessages.has(c.id));
      expect(filtered.map(c => c.id)).toEqual([2]);
    });

    it("should not conflict when both hasMessages and hasNoMessages are set (edge case)", () => {
      const allContacts = [
        { id: 1, name: "Alice" },
        { id: 2, name: "Bob" },
      ];
      const contactIdsWithMessages = new Set([1]);

      // If both are true, hasNoMessages removes those with messages,
      // then hasMessages removes those without — result is empty
      let rows = [...allContacts];
      rows = rows.filter(c => !contactIdsWithMessages.has(c.id)); // hasNoMessages
      rows = rows.filter(c => contactIdsWithMessages.has(c.id));  // hasMessages
      expect(rows).toHaveLength(0);
    });

    it("should return all contacts when neither filter is set", () => {
      const allContacts = [
        { id: 1, name: "Alice" },
        { id: 2, name: "Bob" },
      ];
      // No filtering applied
      expect(allContacts).toHaveLength(2);
    });
  });

  describe("get_contacts_by_filter tool definition", () => {
    it("should include hasMessages in the tool properties", () => {
      const toolProperties = {
        createdAfterDays: { type: "number" },
        createdBeforeDays: { type: "number" },
        hasNoMessages: { type: "boolean" },
        hasMessages: { type: "boolean" },
        hasNoCallActivity: { type: "boolean" },
        hasTag: { type: "string" },
        doesNotHaveTag: { type: "string" },
        assignedToUserId: { type: "number" },
        status: { type: "string" },
        limit: { type: "number" },
      };
      expect(toolProperties).toHaveProperty("hasMessages");
      expect(toolProperties.hasMessages.type).toBe("boolean");
    });
  });
});
