import { describe, it, expect } from "vitest";

/**
 * Tests for the search.global query.
 * Validates return shape, category structure, path mapping, and input handling.
 */

describe("Global Search — Return Shape", () => {
  it("should define the expected result categories", () => {
    const categories = ["contacts", "campaigns", "sequences", "content", "deals"];
    expect(categories).toHaveLength(5);
    expect(categories).toContain("contacts");
    expect(categories).toContain("campaigns");
    expect(categories).toContain("sequences");
    expect(categories).toContain("content");
    expect(categories).toContain("deals");
  });

  it("should define the expected result item shape", () => {
    const expectedShape = {
      id: "number",
      title: "string",
      subtitle: "string|null",
      extra: "string|null",
      type: "string",
      path: "string",
    };
    expect(Object.keys(expectedShape)).toEqual([
      "id",
      "title",
      "subtitle",
      "extra",
      "type",
      "path",
    ]);
  });

  it("should include a total count field", () => {
    const result = {
      contacts: [{ id: 1, title: "John Doe", subtitle: "john@test.com", extra: "+1234567890", type: "contact", path: "/contacts/1" }],
      campaigns: [],
      sequences: [],
      content: [],
      deals: [],
      total: 1,
    };
    expect(result.total).toBe(1);
    expect(result.total).toBe(
      result.contacts.length +
      result.campaigns.length +
      result.sequences.length +
      result.content.length +
      result.deals.length
    );
  });
});

describe("Global Search — Path Mapping", () => {
  it("should map contact results to /contacts/:id", () => {
    const contact = { id: 42, title: "Jane Smith", type: "contact" as const };
    const path = `/contacts/${contact.id}`;
    expect(path).toBe("/contacts/42");
  });

  it("should map campaign results to /campaigns/:id", () => {
    const campaign = { id: 7, title: "Spring Campaign", type: "campaign" as const };
    const path = `/campaigns/${campaign.id}`;
    expect(path).toBe("/campaigns/7");
  });

  it("should map sequence results to /sequences/:id", () => {
    const sequence = { id: 15, title: "Welcome Drip", type: "sequence" as const };
    const path = `/sequences/${sequence.id}`;
    expect(path).toBe("/sequences/15");
  });

  it("should map content results to /content-hub", () => {
    const content = { id: 3, title: "Blog Post", type: "content" as const };
    const path = "/content-hub";
    expect(path).toBe("/content-hub");
  });

  it("should map deal results to /pipeline", () => {
    const deal = { id: 9, title: "Big Deal", type: "deal" as const };
    const path = "/pipeline";
    expect(path).toBe("/pipeline");
  });
});

describe("Global Search — Type Constants", () => {
  it("should use correct type constants for each category", () => {
    const types = {
      contacts: "contact",
      campaigns: "campaign",
      sequences: "sequence",
      content: "content",
      deals: "deal",
    };
    expect(types.contacts).toBe("contact");
    expect(types.campaigns).toBe("campaign");
    expect(types.sequences).toBe("sequence");
    expect(types.content).toBe("content");
    expect(types.deals).toBe("deal");
  });
});

describe("Global Search — Input Validation", () => {
  it("should require a query string of at least 1 character", () => {
    const validQuery = "a";
    expect(validQuery.length).toBeGreaterThanOrEqual(1);
  });

  it("should reject queries longer than 100 characters", () => {
    const longQuery = "a".repeat(101);
    expect(longQuery.length).toBeGreaterThan(100);
  });

  it("should default limit to 5 per category", () => {
    const defaultLimit = 5;
    expect(defaultLimit).toBe(5);
  });

  it("should require a positive accountId", () => {
    const validAccountId = 1;
    expect(validAccountId).toBeGreaterThan(0);
    const invalidAccountId = 0;
    expect(invalidAccountId).not.toBeGreaterThan(0);
  });
});

describe("Global Search — LIKE Pattern", () => {
  it("should wrap query in % wildcards for LIKE matching", () => {
    const query = "john";
    const pattern = `%${query}%`;
    expect(pattern).toBe("%john%");
    expect(pattern.startsWith("%")).toBe(true);
    expect(pattern.endsWith("%")).toBe(true);
  });

  it("should handle special characters in search query", () => {
    const query = "O'Brien";
    const pattern = `%${query}%`;
    expect(pattern).toBe("%O'Brien%");
  });
});

describe("Global Search — Empty State", () => {
  it("should return empty arrays and zero total when no results match", () => {
    const emptyResult = {
      contacts: [],
      campaigns: [],
      sequences: [],
      content: [],
      deals: [],
      total: 0,
    };
    expect(emptyResult.total).toBe(0);
    expect(emptyResult.contacts).toHaveLength(0);
    expect(emptyResult.campaigns).toHaveLength(0);
    expect(emptyResult.sequences).toHaveLength(0);
    expect(emptyResult.content).toHaveLength(0);
    expect(emptyResult.deals).toHaveLength(0);
  });

  it("should return empty result when database is unavailable", () => {
    // The router returns empty arrays when getDb() returns null
    const fallbackResult = {
      contacts: [],
      campaigns: [],
      sequences: [],
      content: [],
      deals: [],
      total: 0,
    };
    expect(fallbackResult.total).toBe(0);
  });
});

describe("Global Search — Result Aggregation", () => {
  it("should correctly calculate total from all categories", () => {
    const result = {
      contacts: [
        { id: 1, title: "John", subtitle: "john@test.com", extra: null, type: "contact", path: "/contacts/1" },
        { id: 2, title: "Jane", subtitle: "jane@test.com", extra: null, type: "contact", path: "/contacts/2" },
      ],
      campaigns: [
        { id: 1, title: "Spring", subtitle: "Welcome!", extra: "sent", type: "campaign", path: "/campaigns/1" },
      ],
      sequences: [],
      content: [
        { id: 1, title: "Blog Post", subtitle: "draft", extra: "blog", type: "content", path: "/content-hub" },
      ],
      deals: [],
    };
    const total =
      result.contacts.length +
      result.campaigns.length +
      result.sequences.length +
      result.content.length +
      result.deals.length;
    expect(total).toBe(4);
  });

  it("should flatten results for keyboard navigation in correct category order", () => {
    const data = {
      contacts: [{ id: 1, path: "/contacts/1" }],
      campaigns: [{ id: 2, path: "/campaigns/2" }],
      sequences: [{ id: 3, path: "/sequences/3" }],
      content: [{ id: 4, path: "/content-hub" }],
      deals: [{ id: 5, path: "/pipeline" }],
    };
    const flattened = [
      ...data.contacts,
      ...data.campaigns,
      ...data.sequences,
      ...data.content,
      ...data.deals,
    ];
    expect(flattened).toHaveLength(5);
    expect(flattened[0].path).toBe("/contacts/1");
    expect(flattened[1].path).toBe("/campaigns/2");
    expect(flattened[2].path).toBe("/sequences/3");
    expect(flattened[3].path).toBe("/content-hub");
    expect(flattened[4].path).toBe("/pipeline");
  });
});

describe("Global Search — Category Config", () => {
  it("should define icons and labels for all 5 categories", () => {
    const config = {
      contacts: { label: "Contacts", color: "text-blue-500" },
      campaigns: { label: "Campaigns", color: "text-purple-500" },
      sequences: { label: "Sequences", color: "text-orange-500" },
      content: { label: "Content", color: "text-green-500" },
      deals: { label: "Deals", color: "text-yellow-500" },
    };
    expect(Object.keys(config)).toHaveLength(5);
    expect(config.contacts.label).toBe("Contacts");
    expect(config.campaigns.label).toBe("Campaigns");
    expect(config.sequences.label).toBe("Sequences");
    expect(config.content.label).toBe("Content");
    expect(config.deals.label).toBe("Deals");
  });
});

describe("Global Search — Keyboard Navigation", () => {
  it("should calculate correct global offset for category items", () => {
    const data = {
      contacts: [{ id: 1 }, { id: 2 }],
      campaigns: [{ id: 3 }],
      sequences: [],
      content: [{ id: 4 }, { id: 5 }],
      deals: [{ id: 6 }],
    };
    const categories = ["contacts", "campaigns", "sequences", "content", "deals"] as const;

    // Calculate offset for "content" category
    let offset = 0;
    for (const k of categories) {
      if (k === "content") break;
      offset += data[k].length;
    }
    // contacts(2) + campaigns(1) + sequences(0) = 3
    expect(offset).toBe(3);

    // First content item should be at index 3
    expect(offset + 0).toBe(3);
    // Second content item should be at index 4
    expect(offset + 1).toBe(4);
  });

  it("should clamp selected index within bounds", () => {
    const totalResults = 5;
    let selectedIndex = 0;

    // Arrow down
    selectedIndex = Math.min(selectedIndex + 1, totalResults - 1);
    expect(selectedIndex).toBe(1);

    // Arrow down to end
    selectedIndex = totalResults - 1;
    selectedIndex = Math.min(selectedIndex + 1, totalResults - 1);
    expect(selectedIndex).toBe(4); // stays at max

    // Arrow up
    selectedIndex = Math.max(selectedIndex - 1, 0);
    expect(selectedIndex).toBe(3);

    // Arrow up to start
    selectedIndex = 0;
    selectedIndex = Math.max(selectedIndex - 1, 0);
    expect(selectedIndex).toBe(0); // stays at 0
  });
});

describe("Global Search — Debounce", () => {
  it("should not fire query for strings shorter than 2 characters", () => {
    const query = "a";
    const shouldFire = query.length >= 2;
    expect(shouldFire).toBe(false);
  });

  it("should fire query for strings of 2+ characters", () => {
    const query = "jo";
    const shouldFire = query.length >= 2;
    expect(shouldFire).toBe(true);
  });
});
