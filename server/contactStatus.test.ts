import { describe, it, expect } from "vitest";
import { contacts } from "../drizzle/schema";
import { CONTACT_STATUSES } from "../client/src/lib/contactStatus";

describe("contact status taxonomy", () => {
  it("client CONTACT_STATUSES matches drizzle contacts.status enum exactly", () => {
    // Drizzle stores enum values on the column config
    const schemaEnum = (contacts.status as any).enumValues as string[];
    expect([...schemaEnum].sort()).toEqual([...CONTACT_STATUSES].sort());
  });

  it("CONTACT_STATUSES has exactly 15 values", () => {
    expect(CONTACT_STATUSES).toHaveLength(15);
  });

  it("all expected statuses are present", () => {
    const expected = [
      "new", "uncontacted", "contacted", "engaged",
      "application_taken", "application_in_progress", "credit_repair",
      "callback_scheduled", "app_link_pending",
      "qualified", "proposal", "negotiation",
      "won", "lost", "nurture",
    ];
    for (const status of expected) {
      expect(CONTACT_STATUSES).toContain(status);
    }
  });
});
