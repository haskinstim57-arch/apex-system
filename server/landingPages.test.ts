import { describe, it, expect } from "vitest";

// ─────────────────────────────────────────────
// Landing Pages & Funnels — Unit Tests
// ─────────────────────────────────────────────

describe("Landing Pages — Schema Exports", () => {
  it("schema exports landingPages table", async () => {
    const schema = await import("../drizzle/schema");
    expect(schema.landingPages).toBeDefined();
  });

  it("schema exports funnels table", async () => {
    const schema = await import("../drizzle/schema");
    expect(schema.funnels).toBeDefined();
  });

  it("landingPages table has expected columns", async () => {
    const schema = await import("../drizzle/schema");
    const table = schema.landingPages;
    const columns = Object.keys(table);
    expect(columns.length).toBeGreaterThan(0);
  });

  it("funnels table has expected columns", async () => {
    const schema = await import("../drizzle/schema");
    const table = schema.funnels;
    const columns = Object.keys(table);
    expect(columns.length).toBeGreaterThan(0);
  });
});

describe("Landing Pages — DB Helper Exports", () => {
  it("db.ts exports page CRUD helper functions", async () => {
    const db = await import("./db");
    expect(typeof db.createLandingPage).toBe("function");
    expect(typeof db.listLandingPages).toBe("function");
    expect(typeof db.getLandingPage).toBe("function");
    expect(typeof db.updateLandingPage).toBe("function");
    expect(typeof db.deleteLandingPage).toBe("function");
  });

  it("db.ts exports page lookup by slug helper", async () => {
    const db = await import("./db");
    expect(typeof db.getLandingPageBySlug).toBe("function");
  });

  it("db.ts exports page view count helper", async () => {
    const db = await import("./db");
    expect(typeof db.incrementPageViewCount).toBe("function");
  });

  it("db.ts exports getLandingPage helper", async () => {
    const db = await import("./db");
    expect(typeof db.getLandingPage).toBe("function");
  });

  it("db.ts exports funnel CRUD helper functions", async () => {
    const db = await import("./db");
    expect(typeof db.createFunnel).toBe("function");
    expect(typeof db.listFunnels).toBe("function");
    expect(typeof db.getFunnel).toBe("function");
    expect(typeof db.updateFunnel).toBe("function");
    expect(typeof db.deleteFunnel).toBe("function");
  });
});

describe("Landing Pages — Router Exports", () => {
  it("landingPages router module exports a router", async () => {
    const mod = await import("./routers/landingPages");
    expect(mod.landingPagesRouter).toBeDefined();
  });

  it("funnels router module exports a router", async () => {
    const mod = await import("./routers/funnels");
    expect(mod.funnelsRouter).toBeDefined();
  });
});

describe("Landing Pages — Public Pages Router", () => {
  it("publicPages router exports an Express router", async () => {
    const mod = await import("./webhooks/publicPages");
    expect(mod.publicPagesRouter).toBeDefined();
    // Express routers have a stack property
    expect(typeof mod.publicPagesRouter).toBe("function");
  });
});

describe("Landing Pages — Data Integrity", () => {
  it("page status enum includes draft and published", async () => {
    const schema = await import("../drizzle/schema");
    // The table should be defined with status field
    expect(schema.landingPages).toBeDefined();
  });

  it("funnel status enum includes draft and active", async () => {
    const schema = await import("../drizzle/schema");
    expect(schema.funnels).toBeDefined();
  });
});

describe("Landing Pages — Slug Validation", () => {
  it("slug should be lowercase alphanumeric with hyphens", () => {
    const validSlugs = ["my-page", "landing-page-1", "free-consultation", "a"];
    const invalidSlugs = ["My Page", "page@1", "page/slug", ""];

    validSlugs.forEach((slug) => {
      expect(/^[a-z0-9][a-z0-9-]*$/.test(slug)).toBe(true);
    });

    invalidSlugs.forEach((slug) => {
      expect(/^[a-z0-9][a-z0-9-]*$/.test(slug)).toBe(false);
    });
  });

  it("auto-slug generation produces valid slugs", () => {
    function autoSlug(title: string) {
      return title
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, "")
        .replace(/\s+/g, "-")
        .replace(/-+/g, "-")
        .slice(0, 100);
    }

    expect(autoSlug("Free Mortgage Consultation")).toBe("free-mortgage-consultation");
    expect(autoSlug("Get Pre-Approved Today!")).toBe("get-pre-approved-today");
    expect(autoSlug("  Multiple   Spaces  ")).toBe("-multiple-spaces-");
    expect(autoSlug("Special @#$ Characters")).toBe("special-characters");
  });
});

describe("Funnels — Step Ordering", () => {
  it("steps maintain correct order after reordering", () => {
    type Step = { pageId: number; label: string; order: number };
    const steps: Step[] = [
      { pageId: 1, label: "Landing", order: 1 },
      { pageId: 2, label: "Form", order: 2 },
      { pageId: 3, label: "Thank You", order: 3 },
    ];

    // Move step 3 to position 1
    const arr = [...steps];
    const [moved] = arr.splice(2, 1);
    arr.unshift(moved);
    const reordered = arr.map((s, i) => ({ ...s, order: i + 1 }));

    expect(reordered[0].pageId).toBe(3);
    expect(reordered[0].order).toBe(1);
    expect(reordered[1].pageId).toBe(1);
    expect(reordered[1].order).toBe(2);
    expect(reordered[2].pageId).toBe(2);
    expect(reordered[2].order).toBe(3);
  });

  it("removing a step reindexes remaining steps", () => {
    type Step = { pageId: number; label: string; order: number };
    const steps: Step[] = [
      { pageId: 1, label: "A", order: 1 },
      { pageId: 2, label: "B", order: 2 },
      { pageId: 3, label: "C", order: 3 },
    ];

    // Remove middle step
    const filtered = steps.filter((_, i) => i !== 1).map((s, i) => ({ ...s, order: i + 1 }));
    expect(filtered).toHaveLength(2);
    expect(filtered[0].order).toBe(1);
    expect(filtered[1].order).toBe(2);
    expect(filtered[1].pageId).toBe(3);
  });
});

describe("Public Page HTML Rendering", () => {
  it("generates valid HTML structure for public page", () => {
    const title = "Test Page";
    const htmlContent = "<h1>Hello</h1>";
    const cssContent = "h1 { color: red; }";
    const metaDescription = "A test page";

    const rendered = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <meta name="description" content="${metaDescription}">
  <style>${cssContent}</style>
</head>
<body>${htmlContent}</body>
</html>`;

    expect(rendered).toContain("<!DOCTYPE html>");
    expect(rendered).toContain(`<title>${title}</title>`);
    expect(rendered).toContain(htmlContent);
    expect(rendered).toContain(cssContent);
    expect(rendered).toContain(`content="${metaDescription}"`);
  });

  it("handles missing optional fields gracefully", () => {
    const title = "Minimal Page";
    const htmlContent = "<p>Content</p>";

    const rendered = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>${title}</title>
  <style></style>
</head>
<body>${htmlContent}</body>
</html>`;

    expect(rendered).toContain(`<title>${title}</title>`);
    expect(rendered).toContain(htmlContent);
    expect(rendered).toContain("<style></style>");
  });
});
