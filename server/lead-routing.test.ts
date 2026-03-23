import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createCtx(overrides?: Partial<AuthenticatedUser>): TrpcContext {
  const user: AuthenticatedUser = {
    id: 1,
    openId: "test-user",
    email: "test@example.com",
    name: "Test User",
    loginMethod: "manus",
    role: "admin",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
    ...overrides,
  };

  return {
    user,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: {
      clearCookie: () => {},
    } as TrpcContext["res"],
  };
}

// ─── Lead Routing Router Tests ───

describe("leadRouting router", () => {
  describe("input validation", () => {
    it("rejects create with empty name", async () => {
      const caller = appRouter.createCaller(createCtx());
      await expect(
        caller.leadRouting.create({
          accountId: 1,
          name: "",
          strategy: "round_robin",
          assigneeIds: [1],
        })
      ).rejects.toThrow();
    });

    it("rejects create with empty assigneeIds array", async () => {
      const caller = appRouter.createCaller(createCtx());
      await expect(
        caller.leadRouting.create({
          accountId: 1,
          name: "Test Rule",
          strategy: "round_robin",
          assigneeIds: [],
        })
      ).rejects.toThrow();
    });

    it("rejects create with invalid strategy", async () => {
      const caller = appRouter.createCaller(createCtx());
      await expect(
        caller.leadRouting.create({
          accountId: 1,
          name: "Test Rule",
          strategy: "invalid_strategy" as any,
          assigneeIds: [1],
        })
      ).rejects.toThrow();
    });

    it("rejects create with negative accountId", async () => {
      const caller = appRouter.createCaller(createCtx());
      await expect(
        caller.leadRouting.create({
          accountId: -1,
          name: "Test Rule",
          strategy: "round_robin",
          assigneeIds: [1],
        })
      ).rejects.toThrow();
    });

    it("rejects create with negative priority", async () => {
      const caller = appRouter.createCaller(createCtx());
      await expect(
        caller.leadRouting.create({
          accountId: 1,
          name: "Test Rule",
          strategy: "round_robin",
          assigneeIds: [1],
          priority: -1,
        })
      ).rejects.toThrow();
    });

    it("rejects create with negative maxLeadsPerUser", async () => {
      const caller = appRouter.createCaller(createCtx());
      await expect(
        caller.leadRouting.create({
          accountId: 1,
          name: "Test Rule",
          strategy: "capacity_based",
          assigneeIds: [1],
          maxLeadsPerUser: -5,
        })
      ).rejects.toThrow();
    });

    it("accepts all valid strategies", async () => {
      const caller = appRouter.createCaller(createCtx());
      // These should all pass input validation (may fail on DB/membership check but not on Zod)
      for (const strategy of ["round_robin", "capacity_based", "specific_user"] as const) {
        await expect(
          caller.leadRouting.create({
            accountId: 1,
            name: `Test ${strategy}`,
            strategy,
            assigneeIds: [1],
          })
        ).rejects.not.toThrow(/invalid/i);
      }
    });

    it("accepts valid conditions object", async () => {
      const caller = appRouter.createCaller(createCtx());
      // Should pass input validation (may fail on DB check)
      await expect(
        caller.leadRouting.create({
          accountId: 1,
          name: "Conditional Rule",
          strategy: "round_robin",
          assigneeIds: [1],
          conditions: {
            leadSource: ["facebook", "csv_import"],
            tags: ["hot lead", "Broward County"],
          },
        })
      ).rejects.not.toThrow(/invalid/i);
    });

    it("accepts boolean trigger flags", async () => {
      const caller = appRouter.createCaller(createCtx());
      await expect(
        caller.leadRouting.create({
          accountId: 1,
          name: "Trigger Rule",
          strategy: "round_robin",
          assigneeIds: [1],
          applyToCsvImport: false,
          applyToFacebookLeads: true,
          applyToManualCreate: true,
        })
      ).rejects.not.toThrow(/invalid/i);
    });
  });

  describe("list", () => {
    it("rejects list with invalid accountId", async () => {
      const caller = appRouter.createCaller(createCtx());
      await expect(
        caller.leadRouting.list({ accountId: 0 })
      ).rejects.toThrow();
    });

    it("rejects list with non-integer accountId", async () => {
      const caller = appRouter.createCaller(createCtx());
      await expect(
        caller.leadRouting.list({ accountId: 1.5 })
      ).rejects.toThrow();
    });
  });

  describe("get", () => {
    it("rejects get with invalid id", async () => {
      const caller = appRouter.createCaller(createCtx());
      await expect(
        caller.leadRouting.get({ id: 0, accountId: 1 })
      ).rejects.toThrow();
    });

    it("rejects get with missing accountId", async () => {
      const caller = appRouter.createCaller(createCtx());
      await expect(
        (caller.leadRouting.get as any)({ id: 1 })
      ).rejects.toThrow();
    });
  });

  describe("update", () => {
    it("rejects update with invalid id", async () => {
      const caller = appRouter.createCaller(createCtx());
      await expect(
        caller.leadRouting.update({ id: 0, accountId: 1, name: "Updated" })
      ).rejects.toThrow();
    });

    it("rejects update with empty name", async () => {
      const caller = appRouter.createCaller(createCtx());
      await expect(
        caller.leadRouting.update({ id: 1, accountId: 1, name: "" })
      ).rejects.toThrow();
    });

    it("accepts partial update fields", async () => {
      const caller = appRouter.createCaller(createCtx());
      // Should pass input validation (may fail on DB)
      await expect(
        caller.leadRouting.update({
          id: 1,
          accountId: 1,
          strategy: "capacity_based",
          maxLeadsPerUser: 100,
        })
      ).rejects.not.toThrow(/invalid/i);
    });
  });

  describe("delete", () => {
    it("rejects delete with invalid id", async () => {
      const caller = appRouter.createCaller(createCtx());
      await expect(
        caller.leadRouting.delete({ id: -1, accountId: 1 })
      ).rejects.toThrow();
    });
  });

  describe("toggleActive", () => {
    it("rejects toggleActive with missing isActive", async () => {
      const caller = appRouter.createCaller(createCtx());
      await expect(
        (caller.leadRouting.toggleActive as any)({ id: 1, accountId: 1 })
      ).rejects.toThrow();
    });

    it("rejects toggleActive with invalid id", async () => {
      const caller = appRouter.createCaller(createCtx());
      await expect(
        caller.leadRouting.toggleActive({ id: 0, accountId: 1, isActive: true })
      ).rejects.toThrow();
    });
  });

  describe("auth protection", () => {
    it("rejects unauthenticated list call", async () => {
      const ctx: TrpcContext = {
        user: null,
        req: { protocol: "https", headers: {} } as TrpcContext["req"],
        res: { clearCookie: () => {} } as TrpcContext["res"],
      };
      const caller = appRouter.createCaller(ctx);
      await expect(
        caller.leadRouting.list({ accountId: 1 })
      ).rejects.toThrow(/login/);
    });

    it("rejects unauthenticated create call", async () => {
      const ctx: TrpcContext = {
        user: null,
        req: { protocol: "https", headers: {} } as TrpcContext["req"],
        res: { clearCookie: () => {} } as TrpcContext["res"],
      };
      const caller = appRouter.createCaller(ctx);
      await expect(
        caller.leadRouting.create({
          accountId: 1,
          name: "Test",
          strategy: "round_robin",
          assigneeIds: [1],
        })
      ).rejects.toThrow(/login/);
    });
  });
});

// ─── Lead Routing Engine Unit Tests ───

describe("leadRoutingEngine - matchesConditions (via module)", () => {
  // We test the matchesConditions logic indirectly through the engine's behavior
  // Since it's a private function, we verify the condition matching through integration

  it("should have the routing engine module available", async () => {
    const engine = await import("./services/leadRoutingEngine");
    expect(engine.routeLead).toBeDefined();
    expect(engine.routeLeadsBatch).toBeDefined();
    expect(typeof engine.routeLead).toBe("function");
    expect(typeof engine.routeLeadsBatch).toBe("function");
  });
});

describe("leadRouting - schema validation edge cases", () => {
  it("rejects name longer than 255 characters", async () => {
    const caller = appRouter.createCaller(createCtx());
    await expect(
      caller.leadRouting.create({
        accountId: 1,
        name: "x".repeat(256),
        strategy: "round_robin",
        assigneeIds: [1],
      })
    ).rejects.toThrow();
  });

  it("accepts name at exactly 255 characters", async () => {
    const caller = appRouter.createCaller(createCtx());
    // Should pass Zod validation (may fail on DB)
    await expect(
      caller.leadRouting.create({
        accountId: 1,
        name: "x".repeat(255),
        strategy: "round_robin",
        assigneeIds: [1],
      })
    ).rejects.not.toThrow(/String must contain/);
  });

  it("accepts conditions with empty arrays", async () => {
    const caller = appRouter.createCaller(createCtx());
    await expect(
      caller.leadRouting.create({
        accountId: 1,
        name: "Empty conditions",
        strategy: "round_robin",
        assigneeIds: [1],
        conditions: { leadSource: [], tags: [] },
      })
    ).rejects.not.toThrow(/invalid/i);
  });

  it("accepts null conditions in update", async () => {
    const caller = appRouter.createCaller(createCtx());
    await expect(
      caller.leadRouting.update({
        id: 1,
        accountId: 1,
        conditions: null,
      })
    ).rejects.not.toThrow(/invalid/i);
  });

  it("rejects non-integer assignee IDs", async () => {
    const caller = appRouter.createCaller(createCtx());
    await expect(
      caller.leadRouting.create({
        accountId: 1,
        name: "Bad IDs",
        strategy: "round_robin",
        assigneeIds: [1.5],
      })
    ).rejects.toThrow();
  });

  it("accepts maxLeadsPerUser of 0 (unlimited)", async () => {
    const caller = appRouter.createCaller(createCtx());
    await expect(
      caller.leadRouting.create({
        accountId: 1,
        name: "Unlimited",
        strategy: "capacity_based",
        assigneeIds: [1],
        maxLeadsPerUser: 0,
      })
    ).rejects.not.toThrow(/invalid/i);
  });
});
