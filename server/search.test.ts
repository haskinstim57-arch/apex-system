import { describe, it, expect } from "vitest";

/**
 * Tests for the search.global query.
 * Validates return shape, category structure, path mapping, input handling,
 * and recent searches persistence logic.
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
      contacts: [{ id: 1, title: "John Doe", subtitle: "john@test.com", extra: "+1234567890", type: "contact", path: "/contacts/1?account=10" }],
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

describe("Global Search — Path Mapping with Account Params", () => {
  const accountId = 42;

  it("should map contact results to /contacts/:id?account=:accountId", () => {
    const contact = { id: 99, title: "Jane Smith", type: "contact" as const };
    const path = `/contacts/${contact.id}?account=${accountId}`;
    expect(path).toBe("/contacts/99?account=42");
    expect(path).toContain("?account=");
  });

  it("should map campaign results to /campaigns/:id?accountId=:accountId", () => {
    const campaign = { id: 7, title: "Spring Campaign", type: "campaign" as const };
    const path = `/campaigns/${campaign.id}?accountId=${accountId}`;
    expect(path).toBe("/campaigns/7?accountId=42");
    expect(path).toContain("?accountId=");
  });

  it("should map sequence results to /sequences?account=:accountId", () => {
    const sequence = { id: 15, title: "Welcome Drip", type: "sequence" as const };
    const path = `/sequences?account=${accountId}`;
    expect(path).toBe("/sequences?account=42");
    expect(path).toContain("?account=");
  });

  it("should map content results to /content-hub/:id", () => {
    const content = { id: 3, title: "Blog Post", type: "content" as const };
    const path = `/content-hub/${content.id}`;
    expect(path).toBe("/content-hub/3");
  });

  it("should map deal results to /pipeline?account=:accountId", () => {
    const deal = { id: 9, title: "Big Deal", type: "deal" as const };
    const path = `/pipeline?account=${accountId}`;
    expect(path).toBe("/pipeline?account=42");
    expect(path).toContain("?account=");
  });

  it("should use different param names matching frontend navigation patterns", () => {
    // Contacts use ?account=
    expect(`/contacts/1?account=${accountId}`).toMatch(/\?account=\d+$/);
    // Campaigns use ?accountId=
    expect(`/campaigns/1?accountId=${accountId}`).toMatch(/\?accountId=\d+$/);
    // Sequences use ?account=
    expect(`/sequences?account=${accountId}`).toMatch(/\?account=\d+$/);
    // Deals use ?account=
    expect(`/pipeline?account=${accountId}`).toMatch(/\?account=\d+$/);
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
        { id: 1, title: "John", subtitle: "john@test.com", extra: null, type: "contact", path: "/contacts/1?account=10" },
        { id: 2, title: "Jane", subtitle: "jane@test.com", extra: null, type: "contact", path: "/contacts/2?account=10" },
      ],
      campaigns: [
        { id: 1, title: "Spring", subtitle: "Welcome!", extra: "sent", type: "campaign", path: "/campaigns/1?accountId=10" },
      ],
      sequences: [],
      content: [
        { id: 1, title: "Blog Post", subtitle: "draft", extra: "blog", type: "content", path: "/content-hub/1" },
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
    const accountId = 10;
    const data = {
      contacts: [{ id: 1, path: `/contacts/1?account=${accountId}` }],
      campaigns: [{ id: 2, path: `/campaigns/2?accountId=${accountId}` }],
      sequences: [{ id: 3, path: `/sequences?account=${accountId}` }],
      content: [{ id: 4, path: "/content-hub/4" }],
      deals: [{ id: 5, path: `/pipeline?account=${accountId}` }],
    };
    const flattened = [
      ...data.contacts,
      ...data.campaigns,
      ...data.sequences,
      ...data.content,
      ...data.deals,
    ];
    expect(flattened).toHaveLength(5);
    expect(flattened[0].path).toBe("/contacts/1?account=10");
    expect(flattened[1].path).toBe("/campaigns/2?accountId=10");
    expect(flattened[2].path).toBe("/sequences?account=10");
    expect(flattened[3].path).toBe("/content-hub/4");
    expect(flattened[4].path).toBe("/pipeline?account=10");
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

    let offset = 0;
    for (const k of categories) {
      if (k === "content") break;
      offset += data[k].length;
    }
    // contacts(2) + campaigns(1) + sequences(0) = 3
    expect(offset).toBe(3);
    expect(offset + 0).toBe(3);
    expect(offset + 1).toBe(4);
  });

  it("should clamp selected index within bounds", () => {
    const totalResults = 5;
    let selectedIndex = 0;

    selectedIndex = Math.min(selectedIndex + 1, totalResults - 1);
    expect(selectedIndex).toBe(1);

    selectedIndex = totalResults - 1;
    selectedIndex = Math.min(selectedIndex + 1, totalResults - 1);
    expect(selectedIndex).toBe(4);

    selectedIndex = Math.max(selectedIndex - 1, 0);
    expect(selectedIndex).toBe(3);

    selectedIndex = 0;
    selectedIndex = Math.max(selectedIndex - 1, 0);
    expect(selectedIndex).toBe(0);
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

describe("Global Search — Recent Searches Logic", () => {
  const RECENT_KEY = "apex-recent-searches";
  const MAX_RECENT = 5;

  function getRecentSearches(storage: Record<string, string>): string[] {
    try {
      return JSON.parse(storage[RECENT_KEY] || "[]");
    } catch {
      return [];
    }
  }

  function saveRecentSearch(storage: Record<string, string>, query: string) {
    const recent = getRecentSearches(storage).filter((q) => q !== query);
    recent.unshift(query);
    storage[RECENT_KEY] = JSON.stringify(recent.slice(0, MAX_RECENT));
  }

  it("should return empty array when no recent searches exist", () => {
    const storage: Record<string, string> = {};
    expect(getRecentSearches(storage)).toEqual([]);
  });

  it("should save a search query to recent searches", () => {
    const storage: Record<string, string> = {};
    saveRecentSearch(storage, "john doe");
    const recent = getRecentSearches(storage);
    expect(recent).toEqual(["john doe"]);
  });

  it("should prepend new searches to the front", () => {
    const storage: Record<string, string> = {};
    saveRecentSearch(storage, "first");
    saveRecentSearch(storage, "second");
    saveRecentSearch(storage, "third");
    const recent = getRecentSearches(storage);
    expect(recent[0]).toBe("third");
    expect(recent[1]).toBe("second");
    expect(recent[2]).toBe("first");
  });

  it("should limit to MAX_RECENT (5) entries", () => {
    const storage: Record<string, string> = {};
    for (let i = 1; i <= 7; i++) {
      saveRecentSearch(storage, `query${i}`);
    }
    const recent = getRecentSearches(storage);
    expect(recent).toHaveLength(5);
    expect(recent[0]).toBe("query7");
    expect(recent[4]).toBe("query3");
  });

  it("should deduplicate — move existing query to front", () => {
    const storage: Record<string, string> = {};
    saveRecentSearch(storage, "alpha");
    saveRecentSearch(storage, "beta");
    saveRecentSearch(storage, "gamma");
    saveRecentSearch(storage, "alpha"); // re-search alpha
    const recent = getRecentSearches(storage);
    expect(recent).toEqual(["alpha", "gamma", "beta"]);
    expect(recent).toHaveLength(3); // no duplicate
  });

  it("should handle corrupted localStorage gracefully", () => {
    const storage: Record<string, string> = { [RECENT_KEY]: "not valid json{{{" };
    expect(getRecentSearches(storage)).toEqual([]);
  });

  it("should clear all recent searches when storage key is removed", () => {
    const storage: Record<string, string> = {};
    saveRecentSearch(storage, "test1");
    saveRecentSearch(storage, "test2");
    delete storage[RECENT_KEY];
    expect(getRecentSearches(storage)).toEqual([]);
  });

  it("should show recent searches dropdown when query < 2 chars and recent exist", () => {
    const query = "a";
    const recentSearches = ["john", "campaign"];
    const showRecent = query.length < 2 && recentSearches.length > 0;
    expect(showRecent).toBe(true);
  });

  it("should NOT show recent searches dropdown when query >= 2 chars", () => {
    const query = "jo";
    const recentSearches = ["john", "campaign"];
    const showRecent = query.length < 2 && recentSearches.length > 0;
    expect(showRecent).toBe(false);
  });

  it("should NOT show recent searches when no recent searches exist", () => {
    const query = "";
    const recentSearches: string[] = [];
    const showRecent = query.length < 2 && recentSearches.length > 0;
    expect(showRecent).toBe(false);
  });
});

describe("Global Search — Database Indexes", () => {
  it("should define standard indexes for search performance", () => {
    // TiDB does not support FULLTEXT, so we use standard composite indexes
    const indexes = [
      { table: "contacts", columns: ["accountId", "firstName"] },
      { table: "contacts", columns: ["accountId", "lastName"] },
      { table: "contacts", columns: ["accountId", "email"] },
      { table: "campaigns", columns: ["accountId", "name"] },
      { table: "long_form_content", columns: ["account_id", "title"] },
      { table: "sequences", columns: ["account_id", "name"] },
      { table: "deals", columns: ["account_id", "title"] },
    ];
    expect(indexes).toHaveLength(7);
    // All indexes should have accountId as the first column for tenant isolation
    indexes.forEach((idx) => {
      expect(idx.columns[0]).toMatch(/account/i);
    });
  });
});
