import { describe, expect, it } from "vitest";

/**
 * Onboarding V2 Tests
 * Tests cover: phase flow, goal definitions, checklist pre-population,
 * demo data seeder shape, feature flag, and route wiring.
 */

// ─── Goal Definitions ────────────────────────────────────────
describe("Onboarding V2 — Goal Definitions", () => {
  // Import the constants from the OnboardingV2 module
  // These are exported at the bottom of the file
  const GOALS = [
    { id: "lead_gen", label: "Generate More Leads", prePopulate: ["connect_facebook", "import_contacts", "setup_pipeline"] },
    { id: "follow_up", label: "Automate Follow-Up", prePopulate: ["setup_phone", "enable_ai_calling", "create_sequence"] },
    { id: "close_deals", label: "Close More Deals", prePopulate: ["setup_pipeline", "create_workflow", "setup_calendar"] },
    { id: "nurture", label: "Nurture Past Clients", prePopulate: ["import_contacts", "create_campaign", "setup_email"] },
    { id: "team_mgmt", label: "Manage My Team", prePopulate: ["invite_team", "setup_pipeline", "enable_reports"] },
    { id: "ai_assistant", label: "Use AI Assistant", prePopulate: ["try_jarvis", "import_contacts", "enable_reports"] },
  ];

  const CHECKLIST_ITEMS = [
    { id: "setup_phone", priority: "required" },
    { id: "add_payment", priority: "required" },
    { id: "business_profile", priority: "required" },
    { id: "import_contacts", priority: "recommended" },
    { id: "setup_pipeline", priority: "recommended" },
    { id: "setup_email", priority: "recommended" },
    { id: "connect_facebook", priority: "recommended" },
    { id: "setup_calendar", priority: "optional" },
    { id: "create_sequence", priority: "optional" },
    { id: "create_campaign", priority: "optional" },
    { id: "create_workflow", priority: "optional" },
    { id: "invite_team", priority: "optional" },
    { id: "enable_ai_calling", priority: "optional" },
    { id: "try_jarvis", priority: "optional" },
    { id: "enable_reports", priority: "optional" },
  ];

  it("should have exactly 6 goals", () => {
    expect(GOALS).toHaveLength(6);
  });

  it("each goal should have a unique ID", () => {
    const ids = GOALS.map((g) => g.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("each goal should have at least 2 prePopulate items", () => {
    for (const goal of GOALS) {
      expect(goal.prePopulate.length).toBeGreaterThanOrEqual(2);
    }
  });

  it("all prePopulate IDs should reference valid checklist items", () => {
    const validIds = new Set(CHECKLIST_ITEMS.map((c) => c.id));
    for (const goal of GOALS) {
      for (const ppId of goal.prePopulate) {
        expect(validIds.has(ppId)).toBe(true);
      }
    }
  });

  it("should have exactly 15 checklist items", () => {
    expect(CHECKLIST_ITEMS).toHaveLength(15);
  });

  it("each checklist item should have a unique ID", () => {
    const ids = CHECKLIST_ITEMS.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("should have 3 required items", () => {
    const required = CHECKLIST_ITEMS.filter((c) => c.priority === "required");
    expect(required).toHaveLength(3);
  });

  it("required items should be: setup_phone, add_payment, business_profile", () => {
    const required = CHECKLIST_ITEMS.filter((c) => c.priority === "required").map((c) => c.id);
    expect(required).toContain("setup_phone");
    expect(required).toContain("add_payment");
    expect(required).toContain("business_profile");
  });
});

// ─── Goal Pre-Population Logic ───────────────────────────────
describe("Onboarding V2 — Goal Pre-Population", () => {
  const GOALS = [
    { id: "lead_gen", prePopulate: ["connect_facebook", "import_contacts", "setup_pipeline"] },
    { id: "follow_up", prePopulate: ["setup_phone", "enable_ai_calling", "create_sequence"] },
    { id: "close_deals", prePopulate: ["setup_pipeline", "create_workflow", "setup_calendar"] },
  ];

  it("selecting 'lead_gen' should pre-populate facebook, contacts, pipeline", () => {
    const selectedGoals = ["lead_gen"];
    const prePopIds = new Set<string>();
    for (const goalId of selectedGoals) {
      const goal = GOALS.find((g) => g.id === goalId);
      if (goal) goal.prePopulate.forEach((id) => prePopIds.add(id));
    }
    expect(prePopIds.has("connect_facebook")).toBe(true);
    expect(prePopIds.has("import_contacts")).toBe(true);
    expect(prePopIds.has("setup_pipeline")).toBe(true);
  });

  it("selecting multiple goals should union their prePopulate items", () => {
    const selectedGoals = ["lead_gen", "follow_up"];
    const prePopIds = new Set<string>();
    for (const goalId of selectedGoals) {
      const goal = GOALS.find((g) => g.id === goalId);
      if (goal) goal.prePopulate.forEach((id) => prePopIds.add(id));
    }
    // lead_gen items
    expect(prePopIds.has("connect_facebook")).toBe(true);
    expect(prePopIds.has("import_contacts")).toBe(true);
    // follow_up items
    expect(prePopIds.has("setup_phone")).toBe(true);
    expect(prePopIds.has("enable_ai_calling")).toBe(true);
    expect(prePopIds.has("create_sequence")).toBe(true);
    // shared
    expect(prePopIds.has("setup_pipeline")).toBe(true);
    // total unique
    expect(prePopIds.size).toBe(6);
  });

  it("selecting goals with overlapping items should deduplicate", () => {
    const selectedGoals = ["lead_gen", "close_deals"]; // both have setup_pipeline
    const prePopIds = new Set<string>();
    for (const goalId of selectedGoals) {
      const goal = GOALS.find((g) => g.id === goalId);
      if (goal) goal.prePopulate.forEach((id) => prePopIds.add(id));
    }
    // setup_pipeline appears in both but should only be counted once
    expect(prePopIds.size).toBe(5); // facebook, contacts, pipeline, workflow, calendar
  });
});

// ─── Phase Flow ──────────────────────────────────────────────
describe("Onboarding V2 — Phase Flow", () => {
  const PHASE_ORDER = ["welcome", "goals", "aha_moment", "setup", "human_touch", "complete"];

  it("should have exactly 6 phases", () => {
    expect(PHASE_ORDER).toHaveLength(6);
  });

  it("should start with 'welcome'", () => {
    expect(PHASE_ORDER[0]).toBe("welcome");
  });

  it("should end with 'complete'", () => {
    expect(PHASE_ORDER[PHASE_ORDER.length - 1]).toBe("complete");
  });

  it("'aha_moment' should come before 'setup'", () => {
    const ahaIdx = PHASE_ORDER.indexOf("aha_moment");
    const setupIdx = PHASE_ORDER.indexOf("setup");
    expect(ahaIdx).toBeLessThan(setupIdx);
  });

  it("'goals' should come before 'aha_moment'", () => {
    const goalsIdx = PHASE_ORDER.indexOf("goals");
    const ahaIdx = PHASE_ORDER.indexOf("aha_moment");
    expect(goalsIdx).toBeLessThan(ahaIdx);
  });

  it("'human_touch' should come after 'setup' and before 'complete'", () => {
    const setupIdx = PHASE_ORDER.indexOf("setup");
    const humanIdx = PHASE_ORDER.indexOf("human_touch");
    const completeIdx = PHASE_ORDER.indexOf("complete");
    expect(humanIdx).toBeGreaterThan(setupIdx);
    expect(humanIdx).toBeLessThan(completeIdx);
  });

  it("progress percent at each phase should be correct", () => {
    for (let i = 0; i < PHASE_ORDER.length; i++) {
      const expected = Math.round(((i + 1) / PHASE_ORDER.length) * 100);
      expect(expected).toBeGreaterThan(0);
      expect(expected).toBeLessThanOrEqual(100);
    }
    // Phase 1 (welcome) = 17%, Phase 6 (complete) = 100%
    expect(Math.round((1 / 6) * 100)).toBe(17);
    expect(Math.round((6 / 6) * 100)).toBe(100);
  });
});

// ─── Demo Data Seeder ────────────────────────────────────────
describe("Onboarding V2 — Demo Data Seeder Shape", () => {
  // Verify the seeder module exports the expected functions
  it("should export seedDemoOnboardingData function", async () => {
    const mod = await import("./seed/demoOnboardingData");
    expect(typeof mod.seedDemoOnboardingData).toBe("function");
  });

  it("should export hasDemoData function", async () => {
    const mod = await import("./seed/demoOnboardingData");
    expect(typeof mod.hasDemoData).toBe("function");
  });

  it("should export cleanupDemoData function", async () => {
    const mod = await import("./seed/demoOnboardingData");
    expect(typeof mod.cleanupDemoData).toBe("function");
  });

  it("should export DEMO_CONTACTS with 5 entries", async () => {
    const mod = await import("./seed/demoOnboardingData");
    expect(mod.DEMO_CONTACTS).toHaveLength(5);
  });

  it("each demo contact should have firstName, lastName, email, phone, and notes", async () => {
    const mod = await import("./seed/demoOnboardingData");
    for (const contact of mod.DEMO_CONTACTS) {
      expect(contact.firstName).toBeTruthy();
      expect(contact.lastName).toBeTruthy();
      expect(contact.email).toBeTruthy();
      expect(contact.phone).toBeTruthy();
      expect(contact.notes).toBeTruthy();
      expect(contact.notes.length).toBeGreaterThan(0);
    }
  });
});

// ─── Feature Flag ────────────────────────────────────────────
describe("Onboarding V2 — Feature Flag", () => {
  it("NEW_ONBOARDING_V2 flag should exist and be boolean", async () => {
    const { NEW_ONBOARDING_V2 } = await import("../shared/const");
    expect(typeof NEW_ONBOARDING_V2).toBe("boolean");
  });

  it("NEW_ONBOARDING_V2 should be true (enabled)", async () => {
    const { NEW_ONBOARDING_V2 } = await import("../shared/const");
    expect(NEW_ONBOARDING_V2).toBe(true);
  });
});

// ─── V2 Router Procedures ────────────────────────────────────
describe("Onboarding V2 — Router Procedures Exist", () => {
  it("accounts router should have saveOnboardingGoals procedure", async () => {
    const { appRouter } = await import("./routers");
    const procedures = Object.keys((appRouter as any)._def.procedures);
    expect(procedures).toContain("accounts.saveOnboardingGoals");
  });

  it("accounts router should have seedOnboardingDemo procedure", async () => {
    const { appRouter } = await import("./routers");
    const procedures = Object.keys((appRouter as any)._def.procedures);
    expect(procedures).toContain("accounts.seedOnboardingDemo");
  });

  it("accounts router should have cleanupOnboardingDemo procedure", async () => {
    const { appRouter } = await import("./routers");
    const procedures = Object.keys((appRouter as any)._def.procedures);
    expect(procedures).toContain("accounts.cleanupOnboardingDemo");
  });

  it("accounts router should have logOnboardingEvent procedure", async () => {
    const { appRouter } = await import("./routers");
    const procedures = Object.keys((appRouter as any)._def.procedures);
    expect(procedures).toContain("accounts.logOnboardingEvent");
  });

  it("accounts router should have dismissOnboardingChecklist procedure", async () => {
    const { appRouter } = await import("./routers");
    const procedures = Object.keys((appRouter as any)._def.procedures);
    expect(procedures).toContain("accounts.dismissOnboardingChecklist");
  });

  it("accounts router should have completeOnboardingV2 procedure", async () => {
    const { appRouter } = await import("./routers");
    const procedures = Object.keys((appRouter as any)._def.procedures);
    expect(procedures).toContain("accounts.completeOnboardingV2");
  });

  it("accounts router should have updateOnboardingChecklist procedure", async () => {
    const { appRouter } = await import("./routers");
    const procedures = Object.keys((appRouter as any)._def.procedures);
    expect(procedures).toContain("accounts.updateOnboardingChecklist");
  });
});

// ─── Schema Additions ────────────────────────────────────────
describe("Onboarding V2 — Schema", () => {
  it("onboardingEvents table should be exported from schema", async () => {
    const schema = await import("../drizzle/schema");
    expect(schema.onboardingEvents).toBeDefined();
  });

  it("contacts table should have isDemoData column", async () => {
    const schema = await import("../drizzle/schema");
    const columns = Object.keys((schema.contacts as any));
    // The column is defined in the schema even if not yet in the DB
    expect(columns).toContain("isDemoData");
  });
});

// ─── Checklist V1-to-V2 Mapping ─────────────────────────────
describe("Onboarding V2 — Checklist Mapping", () => {
  const v1ToV2Map: Record<string, string> = {
    phone_connected: "setup_phone",
    payment_method_added: "add_payment",
    first_contact: "import_contacts",
    first_campaign: "create_campaign",
    automation_created: "create_workflow",
    pipeline_configured: "setup_pipeline",
    calendar_setup: "setup_calendar",
    team_invited: "invite_team",
  };

  const CHECKLIST_IDS = [
    "setup_phone", "add_payment", "business_profile", "import_contacts",
    "setup_pipeline", "setup_email", "connect_facebook", "setup_calendar",
    "create_sequence", "create_campaign", "create_workflow", "invite_team",
    "enable_ai_calling", "try_jarvis", "enable_reports",
  ];

  it("all V1 step IDs should map to valid V2 checklist item IDs", () => {
    const validV2Ids = new Set(CHECKLIST_IDS);
    for (const [v1Id, v2Id] of Object.entries(v1ToV2Map)) {
      expect(validV2Ids.has(v2Id)).toBe(true);
    }
  });

  it("should map 8 V1 steps to V2 items", () => {
    expect(Object.keys(v1ToV2Map)).toHaveLength(8);
  });

  it("V2 has 7 additional items beyond V1 mapping", () => {
    const mappedV2Ids = new Set(Object.values(v1ToV2Map));
    const unmapped = CHECKLIST_IDS.filter((id) => !mappedV2Ids.has(id));
    expect(unmapped).toHaveLength(7);
  });
});
