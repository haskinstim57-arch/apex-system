import { describe, expect, it, beforeAll, afterAll } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

// ─────────────────────────────────────────────
// Test helpers
// ─────────────────────────────────────────────

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createAdminContext(): TrpcContext {
  const user: AuthenticatedUser = {
    id: 1,
    openId: "admin-test-fb-pages",
    email: "admin@test.com",
    name: "Admin User",
    loginMethod: "manus",
    role: "admin",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };

  return {
    user,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: {
      clearCookie: () => {},
    } as TrpcContext["res"],
  };
}

function createNonAdminContext(): TrpcContext {
  const user: AuthenticatedUser = {
    id: 2,
    openId: "user-test-fb-pages",
    email: "user@test.com",
    name: "Regular User",
    loginMethod: "manus",
    role: "user",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };

  return {
    user,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: {
      clearCookie: () => {},
    } as TrpcContext["res"],
  };
}

// ─────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────

describe("facebookPages router", () => {
  const adminCaller = appRouter.createCaller(createAdminContext());
  const userCaller = appRouter.createCaller(createNonAdminContext());
  const testPageId = `test_page_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  let createdId: number;

  // ── Access control ──────────────────────────

  it("rejects non-admin users on list", async () => {
    await expect(userCaller.facebookPages.list()).rejects.toThrow();
  });

  it("rejects non-admin users on create", async () => {
    await expect(
      userCaller.facebookPages.create({
        facebookPageId: "blocked",
        accountId: 1,
      })
    ).rejects.toThrow();
  });

  // ── CRUD operations ─────────────────────────

  it("lists mappings (initially may be empty or have existing data)", async () => {
    const result = await adminCaller.facebookPages.list();
    expect(result).toHaveProperty("mappings");
    expect(Array.isArray(result.mappings)).toBe(true);
  });

  it("creates a new mapping", async () => {
    const result = await adminCaller.facebookPages.create({
      facebookPageId: testPageId,
      accountId: 1,
      pageName: "Test Page",
      verifyToken: "test_token_123",
    });
    expect(result.success).toBe(true);
    expect(result.id).toBeGreaterThan(0);
    createdId = result.id;
  });

  it("rejects duplicate page IDs", async () => {
    await expect(
      adminCaller.facebookPages.create({
        facebookPageId: testPageId,
        accountId: 1,
      })
    ).rejects.toThrow(/already mapped/i);
  });

  it("retrieves mapping by page ID", async () => {
    const result = await adminCaller.facebookPages.getByPageId({
      facebookPageId: testPageId,
    });
    expect(result.mapping).not.toBeNull();
    expect(result.mapping?.facebookPageId).toBe(testPageId);
    expect(result.mapping?.pageName).toBe("Test Page");
    expect(result.mapping?.verifyToken).toBe("test_token_123");
    expect(result.mapping?.accountId).toBe(1);
  });

  it("updates an existing mapping", async () => {
    const result = await adminCaller.facebookPages.update({
      id: createdId,
      pageName: "Updated Page Name",
      verifyToken: "new_token_456",
    });
    expect(result.success).toBe(true);

    // Verify update persisted
    const check = await adminCaller.facebookPages.getByPageId({
      facebookPageId: testPageId,
    });
    expect(check.mapping?.pageName).toBe("Updated Page Name");
    expect(check.mapping?.verifyToken).toBe("new_token_456");
  });

  it("filters list by accountId", async () => {
    const result = await adminCaller.facebookPages.list({ accountId: 1 });
    expect(result.mappings.length).toBeGreaterThan(0);
    for (const m of result.mappings) {
      expect(m.accountId).toBe(1);
    }
  });

  it("deletes a mapping", async () => {
    const result = await adminCaller.facebookPages.delete({ id: createdId });
    expect(result.success).toBe(true);

    // Verify deletion
    const check = await adminCaller.facebookPages.getByPageId({
      facebookPageId: testPageId,
    });
    expect(check.mapping).toBeNull();
  });

  // ── Validation ──────────────────────────────

  it("rejects create with empty page ID", async () => {
    await expect(
      adminCaller.facebookPages.create({
        facebookPageId: "",
        accountId: 1,
      })
    ).rejects.toThrow();
  });

  it("rejects create with invalid accountId", async () => {
    await expect(
      adminCaller.facebookPages.create({
        facebookPageId: "valid_page",
        accountId: 0,
      })
    ).rejects.toThrow();
  });
});
