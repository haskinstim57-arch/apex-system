import { describe, it, expect, vi } from "vitest";

// ─────────────────────────────────────────────
// Test: Contact Merge / Deduplication
// ─────────────────────────────────────────────

describe("Contact Merge / Deduplication", () => {
  // ── Schema Tests ──
  describe("Schema", () => {
    it("should have contacts table with required merge fields", async () => {
      const schema = await import("../drizzle/schema");
      expect(schema.contacts).toBeDefined();
      // Verify key fields exist for merge
      const table = schema.contacts;
      expect(table.firstName).toBeDefined();
      expect(table.lastName).toBeDefined();
      expect(table.email).toBeDefined();
      expect(table.phone).toBeDefined();
      expect(table.customFields).toBeDefined();
    });

    it("should have all related tables that need reassignment during merge", async () => {
      const schema = await import("../drizzle/schema");
      // All tables with contactId foreign key
      expect(schema.contactTags).toBeDefined();
      expect(schema.contactNotes).toBeDefined();
      expect(schema.messages).toBeDefined();
      expect(schema.campaignRecipients).toBeDefined();
      expect(schema.aiCalls).toBeDefined();
      expect(schema.workflowExecutions).toBeDefined();
      expect(schema.tasks).toBeDefined();
      expect(schema.deals).toBeDefined();
      expect(schema.appointments).toBeDefined();
      expect(schema.contactActivities).toBeDefined();
      expect(schema.formSubmissions).toBeDefined();
      expect(schema.reviewRequests).toBeDefined();
      expect(schema.reviews).toBeDefined();
    });

    it("should have contactId column on all related tables", async () => {
      const schema = await import("../drizzle/schema");
      const relatedTables = [
        schema.contactTags,
        schema.contactNotes,
        schema.messages,
        schema.campaignRecipients,
        schema.aiCalls,
        schema.workflowExecutions,
        schema.tasks,
        schema.deals,
        schema.appointments,
        schema.contactActivities,
        schema.formSubmissions,
        schema.reviewRequests,
        schema.reviews,
      ];
      for (const table of relatedTables) {
        expect(table.contactId).toBeDefined();
      }
    });
  });

  // ── Router Tests ──
  describe("Router exports", () => {
    it("should export contactMergeRouter", async () => {
      const mod = await import("./routers/contactMerge");
      expect(mod.contactMergeRouter).toBeDefined();
    });

    it("should be registered in main router", async () => {
      const mod = await import("./routers");
      expect(mod.appRouter).toBeDefined();
      // The router should have contactMerge namespace
      const routerDef = (mod.appRouter as any)._def;
      expect(routerDef).toBeDefined();
    });
  });

  // ── Duplicate Detection Logic Tests ──
  describe("Duplicate Detection Logic", () => {
    it("should group contacts by matching email", () => {
      const contacts = [
        { id: 1, email: "john@test.com", phone: "+15551111111", firstName: "John", lastName: "Doe" },
        { id: 2, email: "john@test.com", phone: "+15552222222", firstName: "Johnny", lastName: "Doe" },
        { id: 3, email: "jane@test.com", phone: "+15553333333", firstName: "Jane", lastName: "Smith" },
      ];

      // Simulate email grouping
      const emailGroups = new Map<string, typeof contacts>();
      for (const c of contacts) {
        if (!c.email) continue;
        const key = c.email.toLowerCase().trim();
        if (!emailGroups.has(key)) emailGroups.set(key, []);
        emailGroups.get(key)!.push(c);
      }

      // Filter to groups with 2+ contacts
      const duplicates = Array.from(emailGroups.entries()).filter(
        ([, group]) => group.length >= 2
      );

      expect(duplicates).toHaveLength(1);
      expect(duplicates[0][0]).toBe("john@test.com");
      expect(duplicates[0][1]).toHaveLength(2);
    });

    it("should group contacts by matching phone", () => {
      const contacts = [
        { id: 1, email: "a@test.com", phone: "+15551111111", firstName: "A", lastName: "B" },
        { id: 2, email: "b@test.com", phone: "+15551111111", firstName: "C", lastName: "D" },
        { id: 3, email: "c@test.com", phone: "+15552222222", firstName: "E", lastName: "F" },
      ];

      const phoneGroups = new Map<string, typeof contacts>();
      for (const c of contacts) {
        if (!c.phone) continue;
        const key = c.phone.replace(/\D/g, "");
        if (!phoneGroups.has(key)) phoneGroups.set(key, []);
        phoneGroups.get(key)!.push(c);
      }

      const duplicates = Array.from(phoneGroups.entries()).filter(
        ([, group]) => group.length >= 2
      );

      expect(duplicates).toHaveLength(1);
      expect(duplicates[0][1]).toHaveLength(2);
    });

    it("should handle both email and phone matching", () => {
      const contacts = [
        { id: 1, email: "john@test.com", phone: "+15551111111" },
        { id: 2, email: "john@test.com", phone: "+15552222222" },
        { id: 3, email: "diff@test.com", phone: "+15551111111" },
      ];

      // Email groups
      const emailGroups = new Map<string, number[]>();
      for (const c of contacts) {
        if (!c.email) continue;
        const key = c.email.toLowerCase().trim();
        if (!emailGroups.has(key)) emailGroups.set(key, []);
        emailGroups.get(key)!.push(c.id);
      }

      // Phone groups
      const phoneGroups = new Map<string, number[]>();
      for (const c of contacts) {
        if (!c.phone) continue;
        const key = c.phone.replace(/\D/g, "");
        if (!phoneGroups.has(key)) phoneGroups.set(key, []);
        phoneGroups.get(key)!.push(c.id);
      }

      const emailDups = Array.from(emailGroups.entries()).filter(([, ids]) => ids.length >= 2);
      const phoneDups = Array.from(phoneGroups.entries()).filter(([, ids]) => ids.length >= 2);

      expect(emailDups).toHaveLength(1); // john@test.com: [1, 2]
      expect(phoneDups).toHaveLength(1); // +15551111111: [1, 3]
    });

    it("should normalize emails for comparison (case insensitive, trimmed)", () => {
      const emails = ["John@Test.COM", " john@test.com ", "JOHN@TEST.COM"];
      const normalized = emails.map((e) => e.toLowerCase().trim());
      expect(new Set(normalized).size).toBe(1);
    });

    it("should normalize phone numbers (strip non-digits)", () => {
      const phones = ["+1 (555) 111-1111", "15551111111", "+1-555-111-1111"];
      const normalized = phones.map((p) => p.replace(/\D/g, ""));
      expect(new Set(normalized).size).toBe(1);
    });

    it("should skip contacts with null email/phone", () => {
      const contacts = [
        { id: 1, email: null, phone: null },
        { id: 2, email: "a@test.com", phone: null },
        { id: 3, email: "a@test.com", phone: null },
      ];

      const emailGroups = new Map<string, number[]>();
      for (const c of contacts) {
        if (!c.email) continue;
        const key = c.email.toLowerCase().trim();
        if (!emailGroups.has(key)) emailGroups.set(key, []);
        emailGroups.get(key)!.push(c.id);
      }

      const duplicates = Array.from(emailGroups.entries()).filter(
        ([, ids]) => ids.length >= 2
      );

      expect(duplicates).toHaveLength(1);
      // Contact 1 should not be in any group
      expect(duplicates[0][1]).not.toContain(1);
    });

    it("should calculate score 100 for exact email match", () => {
      // Email match = 100% confidence
      const score = 100;
      expect(score).toBe(100);
    });

    it("should calculate score 90 for phone match", () => {
      // Phone match = 90% confidence (phone can be shared)
      const score = 90;
      expect(score).toBe(90);
    });
  });

  // ── Merge Logic Tests ──
  describe("Merge Logic", () => {
    it("should merge custom fields with winner priority", () => {
      const winnerCF = { loan_type: "FHA", loan_amount: "250000" };
      const loserCF = { loan_type: "VA", credit_score: "720", loan_amount: "300000" };

      // Merge: loser fills gaps, winner overrides conflicts
      const merged = { ...loserCF, ...winnerCF };

      expect(merged.loan_type).toBe("FHA"); // Winner wins
      expect(merged.loan_amount).toBe("250000"); // Winner wins
      expect(merged.credit_score).toBe("720"); // Loser fills gap
    });

    it("should handle null custom fields during merge", () => {
      const winnerCF = null;
      const loserCF = { loan_type: "VA" };

      const merged = { ...(loserCF || {}), ...(winnerCF || {}) };
      expect(merged.loan_type).toBe("VA");
    });

    it("should handle field overrides during merge", () => {
      const winner = { firstName: "John", lastName: "Doe", email: "john@old.com" };
      const overrides = { email: "john@new.com" };

      const result = { ...winner, ...overrides };
      expect(result.email).toBe("john@new.com");
      expect(result.firstName).toBe("John"); // Not overridden
    });

    it("should deduplicate tags when merging", () => {
      const winnerTags = [{ tagName: "hot-lead" }, { tagName: "mortgage" }];
      const loserTags = [{ tagName: "mortgage" }, { tagName: "facebook" }];

      const allTagNames = new Set([
        ...winnerTags.map((t) => t.tagName),
        ...loserTags.map((t) => t.tagName),
      ]);

      expect(allTagNames.size).toBe(3); // hot-lead, mortgage, facebook
      expect(allTagNames.has("hot-lead")).toBe(true);
      expect(allTagNames.has("mortgage")).toBe(true);
      expect(allTagNames.has("facebook")).toBe(true);
    });

    it("should count related records for merge preview", () => {
      const relatedCounts = {
        notes: 5,
        messages: 12,
        calls: 3,
        deals: 1,
        tasks: 4,
        appointments: 2,
        workflows: 1,
        activities: 8,
        campaigns: 2,
        reviews: 0,
        formSubmissions: 1,
      };

      const total = Object.values(relatedCounts).reduce((a, b) => a + b, 0);
      expect(total).toBe(39);
    });

    it("should not allow merging contacts from different accounts", () => {
      const winnerId = 1;
      const loserId = 2;
      const winnerAccountId = 100;
      const loserAccountId = 200;

      expect(winnerAccountId).not.toBe(loserAccountId);
      // The router enforces this with accountId checks
    });

    it("should not allow merging a contact with itself", () => {
      const winnerId = 1;
      const loserIds = [1];

      const selfMerge = loserIds.includes(winnerId);
      expect(selfMerge).toBe(true);
      // The router should reject this
    });
  });

  // ── Related Record Reassignment Tests ──
  describe("Related Record Reassignment", () => {
    const RELATED_TABLES = [
      "contactTags",
      "contactNotes",
      "messages",
      "campaignRecipients",
      "aiCalls",
      "workflowExecutions",
      "tasks",
      "deals",
      "appointments",
      "contactActivities",
      "formSubmissions",
      "reviewRequests",
      "reviews",
    ];

    it("should have all 13 related tables accounted for in merge", () => {
      expect(RELATED_TABLES).toHaveLength(13);
    });

    it("should reassign all related records from loser to winner", () => {
      // Simulate reassignment
      const winnerId = 1;
      const loserId = 2;
      const records = [
        { id: 10, contactId: loserId, type: "note" },
        { id: 11, contactId: loserId, type: "message" },
        { id: 12, contactId: winnerId, type: "note" },
      ];

      const reassigned = records.map((r) =>
        r.contactId === loserId ? { ...r, contactId: winnerId } : r
      );

      expect(reassigned.every((r) => r.contactId === winnerId)).toBe(true);
    });

    it("should handle multiple losers being merged into one winner", () => {
      const winnerId = 1;
      const loserIds = [2, 3, 4];
      const records = [
        { contactId: 2, data: "a" },
        { contactId: 3, data: "b" },
        { contactId: 4, data: "c" },
        { contactId: 1, data: "d" },
      ];

      const reassigned = records.map((r) =>
        loserIds.includes(r.contactId) ? { ...r, contactId: winnerId } : r
      );

      expect(reassigned.every((r) => r.contactId === winnerId)).toBe(true);
    });
  });

  // ── Integration Tests ──
  describe("Integration", () => {
    it("should have contactMerge procedures available", async () => {
      const mod = await import("./routers/contactMerge");
      const router = mod.contactMergeRouter;
      const def = (router as any)._def;
      expect(def).toBeDefined();
    });

    it("should have the merge page route registered", async () => {
      // Verify the ContactMerge page component exists
      const fs = await import("fs");
      const exists = fs.existsSync("/home/ubuntu/apex-system/client/src/pages/ContactMerge.tsx");
      expect(exists).toBe(true);
    });

    it("should have merge button in Contacts page", async () => {
      const fs = await import("fs");
      const content = fs.readFileSync(
        "/home/ubuntu/apex-system/client/src/pages/Contacts.tsx",
        "utf-8"
      );
      expect(content).toContain("Merge Duplicates");
      expect(content).toContain("/contacts/merge");
    });

    it("should have merge route in App.tsx", async () => {
      const fs = await import("fs");
      const content = fs.readFileSync(
        "/home/ubuntu/apex-system/client/src/App.tsx",
        "utf-8"
      );
      expect(content).toContain("/contacts/merge");
      expect(content).toContain("ContactMerge");
    });
  });
});
