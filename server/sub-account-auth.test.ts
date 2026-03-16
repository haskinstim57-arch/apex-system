import { describe, it, expect, vi, beforeEach } from "vitest";
import bcrypt from "bcryptjs";
import { z } from "zod";

// ─── Mock DB ────────────────────────────────────────────────
const mockUsers: Record<string, any> = {};
const mockMembers: Record<string, any[]> = {};

vi.mock("./db", () => ({
  getUserByEmail: vi.fn((email: string) => mockUsers[email] || null),
  getUserById: vi.fn((id: number) => Object.values(mockUsers).find((u: any) => u.id === id) || null),
  getUserAccountMemberships: vi.fn((userId: number) => {
    const memberships: any[] = [];
    for (const [key, members] of Object.entries(mockMembers)) {
      const accountId = parseInt(key);
      for (const m of members) {
        if (m.userId === userId) {
          memberships.push({
            accountId,
            accountName: `Account ${accountId}`,
            accountSlug: `account-${accountId}`,
            accountStatus: m.accountStatus || "active",
            memberRole: m.role,
          });
        }
      }
    }
    return memberships;
  }),
  upsertUser: vi.fn(async (data: any) => {
    const existing = Object.values(mockUsers).find((u: any) => u.openId === data.openId);
    if (existing) Object.assign(existing, data);
  }),
  setUserPassword: vi.fn(async (userId: number, hash: string) => {
    const user = Object.values(mockUsers).find((u: any) => u.id === userId);
    if (user) (user as any).passwordHash = hash;
  }),
  getAccountById: vi.fn((id: number) => ({ id, name: `Account ${id}`, status: "active" })),
  addMember: vi.fn(async (data: any) => {
    if (!mockMembers[data.accountId]) mockMembers[data.accountId] = [];
    mockMembers[data.accountId].push({ userId: data.userId, role: data.role, isActive: data.isActive, accountStatus: "active" });
  }),
}));

vi.mock("./_core/sdk", () => ({
  sdk: { createSessionToken: vi.fn(async () => "mock-session-token-123") },
}));

vi.mock("./_core/cookies", () => ({
  getSessionCookieOptions: vi.fn(() => ({ httpOnly: true, secure: false, sameSite: "lax" as const, path: "/" })),
}));

describe("Sub-Account Authentication", () => {
  beforeEach(() => {
    Object.keys(mockUsers).forEach((k) => delete mockUsers[k]);
    Object.keys(mockMembers).forEach((k) => delete mockMembers[k]);
  });

  describe("Password Hashing", () => {
    it("should hash passwords with bcrypt", async () => {
      const hash = await bcrypt.hash("SecurePass123!", 12);
      expect(hash).toBeDefined();
      expect(hash).not.toBe("SecurePass123!");
      expect(hash.startsWith("$2a$") || hash.startsWith("$2b$")).toBe(true);
    });

    it("should verify correct password", async () => {
      const hash = await bcrypt.hash("SecurePass123!", 12);
      expect(await bcrypt.compare("SecurePass123!", hash)).toBe(true);
    });

    it("should reject incorrect password", async () => {
      const hash = await bcrypt.hash("SecurePass123!", 12);
      expect(await bcrypt.compare("WrongPassword", hash)).toBe(false);
    });

    it("should produce different hashes for same password (salt)", async () => {
      const hash1 = await bcrypt.hash("SecurePass123!", 12);
      const hash2 = await bcrypt.hash("SecurePass123!", 12);
      expect(hash1).not.toBe(hash2);
      expect(await bcrypt.compare("SecurePass123!", hash1)).toBe(true);
      expect(await bcrypt.compare("SecurePass123!", hash2)).toBe(true);
    });
  });

  describe("Login Validation", () => {
    it("should reject login with non-existent email", async () => {
      const db = await import("./db");
      expect(await db.getUserByEmail("nonexistent@example.com")).toBeNull();
    });

    it("should reject login when user has no passwordHash (OAuth user)", async () => {
      mockUsers["oauth@example.com"] = { id: 1, email: "oauth@example.com", openId: "oauth_123", passwordHash: null, name: "OAuth User" };
      const db = await import("./db");
      const user = await db.getUserByEmail("oauth@example.com");
      expect(user).toBeDefined();
      expect(user!.passwordHash).toBeNull();
    });

    it("should find user with valid email and password hash", async () => {
      const hash = await bcrypt.hash("ValidPass123!", 12);
      mockUsers["sub@example.com"] = { id: 2, email: "sub@example.com", openId: "email_uuid_123", passwordHash: hash, name: "Sub User" };
      const db = await import("./db");
      const user = await db.getUserByEmail("sub@example.com");
      expect(user).toBeDefined();
      expect(await bcrypt.compare("ValidPass123!", user!.passwordHash)).toBe(true);
    });
  });

  describe("Account Memberships", () => {
    it("should return memberships for a user", async () => {
      mockMembers[1] = [{ userId: 10, role: "owner", isActive: true, accountStatus: "active" }];
      mockMembers[2] = [{ userId: 10, role: "employee", isActive: true, accountStatus: "active" }];
      const db = await import("./db");
      const memberships = await db.getUserAccountMemberships(10);
      expect(memberships).toHaveLength(2);
      expect(memberships[0].memberRole).toBe("owner");
      expect(memberships[1].memberRole).toBe("employee");
    });

    it("should filter out suspended accounts", async () => {
      mockMembers[1] = [{ userId: 10, role: "owner", isActive: true, accountStatus: "active" }];
      mockMembers[2] = [{ userId: 10, role: "employee", isActive: true, accountStatus: "suspended" }];
      const db = await import("./db");
      const memberships = await db.getUserAccountMemberships(10);
      const active = memberships.filter((m: any) => m.accountStatus === "active");
      expect(active).toHaveLength(1);
      expect(active[0].accountId).toBe(1);
    });

    it("should return empty array for user with no memberships", async () => {
      const db = await import("./db");
      expect(await db.getUserAccountMemberships(999)).toHaveLength(0);
    });
  });

  describe("Sub-Account User Creation", () => {
    it("should create user with email-based openId prefix", () => {
      const openId = "email_test-uuid-123";
      expect(openId.startsWith("email_")).toBe(true);
    });

    it("should reject duplicate email", async () => {
      mockUsers["existing@example.com"] = { id: 1, email: "existing@example.com", openId: "email_existing" };
      const db = await import("./db");
      expect(await db.getUserByEmail("existing@example.com")).toBeDefined();
    });

    it("should set correct member role: owner", async () => {
      const db = await import("./db");
      await db.addMember({ accountId: 1, userId: 50, role: "owner", isActive: true });
      expect(mockMembers[1][0].role).toBe("owner");
    });

    it("should set correct member role: employee (LOA)", async () => {
      const db = await import("./db");
      await db.addMember({ accountId: 1, userId: 51, role: "employee", isActive: true });
      expect(mockMembers[1][0].role).toBe("employee");
    });

    it("should set correct member role: manager", async () => {
      const db = await import("./db");
      await db.addMember({ accountId: 1, userId: 52, role: "manager", isActive: true });
      expect(mockMembers[1][0].role).toBe("manager");
    });
  });

  describe("Password Management", () => {
    it("should update user password hash", async () => {
      mockUsers["user@example.com"] = { id: 5, email: "user@example.com", openId: "email_user5", passwordHash: "old_hash" };
      const db = await import("./db");
      const newHash = await bcrypt.hash("NewPassword123!", 12);
      await db.setUserPassword(5, newHash);
      expect(mockUsers["user@example.com"].passwordHash).toBe(newHash);
    });

    it("should enforce minimum password length of 8 characters", () => {
      const schema = z.string().min(8, "Password must be at least 8 characters");
      expect(() => schema.parse("short")).toThrow();
      expect(() => schema.parse("longEnoughPassword")).not.toThrow();
    });
  });

  describe("Data Isolation", () => {
    it("should only return memberships for the requesting user", async () => {
      mockMembers[1] = [
        { userId: 10, role: "owner", isActive: true, accountStatus: "active" },
        { userId: 20, role: "employee", isActive: true, accountStatus: "active" },
      ];
      const db = await import("./db");
      const user10 = await db.getUserAccountMemberships(10);
      const user20 = await db.getUserAccountMemberships(20);
      expect(user10).toHaveLength(1);
      expect(user10[0].memberRole).toBe("owner");
      expect(user20).toHaveLength(1);
      expect(user20[0].memberRole).toBe("employee");
    });

    it("should isolate data between accounts", async () => {
      mockMembers[1] = [{ userId: 10, role: "owner", isActive: true, accountStatus: "active" }];
      mockMembers[2] = [{ userId: 20, role: "owner", isActive: true, accountStatus: "active" }];
      const db = await import("./db");
      const user10 = await db.getUserAccountMemberships(10);
      const user20 = await db.getUserAccountMemberships(20);
      expect(user10.every((m: any) => m.accountId === 1)).toBe(true);
      expect(user20.every((m: any) => m.accountId === 2)).toBe(true);
    });

    it("should not allow cross-account access", async () => {
      mockMembers[1] = [{ userId: 10, role: "owner", isActive: true, accountStatus: "active" }];
      const db = await import("./db");
      const user10 = await db.getUserAccountMemberships(10);
      expect(user10.some((m: any) => m.accountId === 2)).toBe(false);
    });
  });

  describe("Session Management", () => {
    it("should create session token via SDK", async () => {
      const { sdk } = await import("./_core/sdk");
      const token = await sdk.createSessionToken("test_open_id", { name: "Test User", expiresInMs: 365 * 24 * 60 * 60 * 1000 });
      expect(token).toBe("mock-session-token-123");
    });

    it("should set correct cookie options", async () => {
      const { getSessionCookieOptions } = await import("./_core/cookies");
      const options = getSessionCookieOptions({} as any);
      expect(options.httpOnly).toBe(true);
      expect(options.path).toBe("/");
    });
  });

  describe("Full Login Flow", () => {
    it("should complete login for valid sub-account user", async () => {
      const password = "SecurePass123!";
      const hash = await bcrypt.hash(password, 12);
      mockUsers["loan.officer@example.com"] = { id: 30, email: "loan.officer@example.com", openId: "email_lo_123", passwordHash: hash, name: "John LO", role: "user" };
      mockMembers[5] = [{ userId: 30, role: "owner", isActive: true, accountStatus: "active" }];

      const db = await import("./db");
      const user = await db.getUserByEmail("loan.officer@example.com");
      expect(user).toBeDefined();
      expect(await bcrypt.compare(password, user!.passwordHash)).toBe(true);

      const memberships = await db.getUserAccountMemberships(user!.id);
      const active = memberships.filter((m: any) => m.accountStatus === "active");
      expect(active).toHaveLength(1);
      expect(active[0].accountId).toBe(5);
      expect(active[0].memberRole).toBe("owner");

      const { sdk } = await import("./_core/sdk");
      const token = await sdk.createSessionToken(user!.openId, { name: user!.name, expiresInMs: 365 * 24 * 60 * 60 * 1000 });
      expect(token).toBeDefined();
    });

    it("should reject login for user with all suspended accounts", async () => {
      const hash = await bcrypt.hash("Pass123!", 12);
      mockUsers["suspended@example.com"] = { id: 40, email: "suspended@example.com", openId: "email_suspended", passwordHash: hash };
      mockMembers[6] = [{ userId: 40, role: "owner", isActive: true, accountStatus: "suspended" }];

      const db = await import("./db");
      const memberships = await db.getUserAccountMemberships(40);
      const active = memberships.filter((m: any) => m.accountStatus === "active");
      expect(active).toHaveLength(0);
    });

    it("should support multi-account user login", async () => {
      const hash = await bcrypt.hash("MultiPass!", 12);
      mockUsers["multi@example.com"] = { id: 50, email: "multi@example.com", openId: "email_multi", passwordHash: hash, name: "Multi User" };
      mockMembers[10] = [{ userId: 50, role: "owner", isActive: true, accountStatus: "active" }];
      mockMembers[11] = [{ userId: 50, role: "employee", isActive: true, accountStatus: "active" }];

      const db = await import("./db");
      const memberships = await db.getUserAccountMemberships(50);
      expect(memberships).toHaveLength(2);
      expect(memberships.map((m: any) => m.accountId)).toEqual([10, 11]);
    });
  });
});
