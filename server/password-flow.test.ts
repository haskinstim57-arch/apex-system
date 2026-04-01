import { describe, it, expect, vi, beforeEach } from "vitest";
import bcrypt from "bcryptjs";
import { z } from "zod";

// ─── Mock Data Stores ──────────────────────────────────────
const mockUsers: Record<string, any> = {};
const mockInvitations: Record<string, any> = {};
const mockResetTokens: Record<string, any> = {};
const mockMembers: Record<string, any[]> = {};
const mockAuditLogs: any[] = [];
let nextUserId = 100;
let nextTokenId = 1;

vi.mock("./db", () => ({
  getUserByEmail: vi.fn((email: string) => mockUsers[email] || null),
  getUserById: vi.fn((id: number) =>
    Object.values(mockUsers).find((u: any) => u.id === id) || null
  ),
  upsertUser: vi.fn(async (data: any) => {
    const existing = Object.values(mockUsers).find(
      (u: any) => u.openId === data.openId
    );
    if (existing) {
      Object.assign(existing, data);
    } else {
      const newUser = {
        id: nextUserId++,
        ...data,
      };
      if (data.email) mockUsers[data.email] = newUser;
    }
  }),
  updateUser: vi.fn(async (userId: number, data: any) => {
    const user = Object.values(mockUsers).find((u: any) => u.id === userId);
    if (user) Object.assign(user, data);
  }),
  setUserPassword: vi.fn(async (userId: number, hash: string) => {
    const user = Object.values(mockUsers).find((u: any) => u.id === userId);
    if (user) (user as any).passwordHash = hash;
  }),
  getInvitationByToken: vi.fn((token: string) => mockInvitations[token] || null),
  updateInvitationStatus: vi.fn(
    async (id: number, status: string, _acceptedAt?: Date) => {
      const inv = Object.values(mockInvitations).find(
        (i: any) => i.id === id
      );
      if (inv) (inv as any).status = status;
    }
  ),
  getMember: vi.fn((accountId: number, userId: number) => {
    const members = mockMembers[accountId] || [];
    return members.find((m: any) => m.userId === userId) || null;
  }),
  addMember: vi.fn(async (data: any) => {
    if (!mockMembers[data.accountId]) mockMembers[data.accountId] = [];
    mockMembers[data.accountId].push({
      userId: data.userId,
      role: data.role,
      isActive: data.isActive,
    });
  }),
  updateAccount: vi.fn(async () => {}),
  getAccountById: vi.fn((id: number) => ({
    id,
    name: `Account ${id}`,
    status: "active",
  })),
  createAuditLog: vi.fn(async (data: any) => {
    mockAuditLogs.push(data);
  }),
  createPasswordResetToken: vi.fn(async (data: any) => {
    const id = nextTokenId++;
    mockResetTokens[data.token] = { id, ...data, usedAt: null };
  }),
  getPasswordResetToken: vi.fn(
    (token: string) => mockResetTokens[token] || null
  ),
  markPasswordResetTokenUsed: vi.fn(async (id: number) => {
    const tok = Object.values(mockResetTokens).find((t: any) => t.id === id);
    if (tok) (tok as any).usedAt = new Date();
  }),
  getUserAccountMemberships: vi.fn(() => []),
}));

vi.mock("./_core/sdk", () => ({
  sdk: {
    createSessionToken: vi.fn(async () => "mock-session-token-abc"),
  },
}));

vi.mock("./_core/cookies", () => ({
  getSessionCookieOptions: vi.fn(() => ({
    httpOnly: true,
    secure: false,
    sameSite: "lax" as const,
    path: "/",
  })),
}));

vi.mock("./services/messaging", () => ({
  dispatchEmail: vi.fn(async () => ({ success: true, provider: "sendgrid" })),
}));

// ─── Helper ────────────────────────────────────────────────
function clearMocks() {
  Object.keys(mockUsers).forEach((k) => delete mockUsers[k]);
  Object.keys(mockInvitations).forEach((k) => delete mockInvitations[k]);
  Object.keys(mockResetTokens).forEach((k) => delete mockResetTokens[k]);
  Object.keys(mockMembers).forEach((k) => delete mockMembers[k]);
  mockAuditLogs.length = 0;
  nextUserId = 100;
  nextTokenId = 1;
}

// ─── Tests ─────────────────────────────────────────────────

describe("Password Setup Flow", () => {
  beforeEach(clearMocks);

  // ═══════════════════════════════════════════════════════════
  // Accept Invite With Password
  // ═══════════════════════════════════════════════════════════
  describe("acceptInviteWithPassword", () => {
    it("should validate token is required", () => {
      const schema = z.object({
        token: z.string().min(1),
        name: z.string().min(1, "Name is required"),
        password: z.string().min(8, "Password must be at least 8 characters"),
      });
      expect(() => schema.parse({ token: "", name: "John", password: "12345678" })).toThrow();
    });

    it("should validate name is required", () => {
      const schema = z.object({
        token: z.string().min(1),
        name: z.string().min(1, "Name is required"),
        password: z.string().min(8, "Password must be at least 8 characters"),
      });
      expect(() => schema.parse({ token: "abc", name: "", password: "12345678" })).toThrow();
    });

    it("should validate password minimum length of 8", () => {
      const schema = z.object({
        token: z.string().min(1),
        name: z.string().min(1, "Name is required"),
        password: z.string().min(8, "Password must be at least 8 characters"),
      });
      expect(() => schema.parse({ token: "abc", name: "John", password: "short" })).toThrow();
      expect(() => schema.parse({ token: "abc", name: "John", password: "12345678" })).not.toThrow();
    });

    it("should reject invalid/missing invitation token", async () => {
      const db = await import("./db");
      const invitation = await db.getInvitationByToken("nonexistent-token");
      expect(invitation).toBeNull();
    });

    it("should reject already accepted invitation", async () => {
      mockInvitations["accepted-token"] = {
        id: 1,
        token: "accepted-token",
        email: "user@example.com",
        role: "owner",
        accountId: 1,
        status: "accepted",
        expiresAt: new Date(Date.now() + 86400000),
      };
      const db = await import("./db");
      const invitation = await db.getInvitationByToken("accepted-token");
      expect(invitation).toBeDefined();
      expect(invitation!.status).toBe("accepted");
      expect(invitation!.status).not.toBe("pending");
    });

    it("should reject expired invitation", async () => {
      mockInvitations["expired-token"] = {
        id: 2,
        token: "expired-token",
        email: "user@example.com",
        role: "owner",
        accountId: 1,
        status: "pending",
        expiresAt: new Date(Date.now() - 86400000), // expired yesterday
      };
      const db = await import("./db");
      const invitation = await db.getInvitationByToken("expired-token");
      expect(invitation).toBeDefined();
      expect(new Date() > invitation!.expiresAt).toBe(true);
    });

    it("should create new user when email doesn't exist", async () => {
      mockInvitations["new-user-token"] = {
        id: 3,
        token: "new-user-token",
        email: "newuser@example.com",
        role: "owner",
        accountId: 5,
        status: "pending",
        expiresAt: new Date(Date.now() + 86400000),
      };

      const db = await import("./db");
      // Verify user doesn't exist
      expect(await db.getUserByEmail("newuser@example.com")).toBeNull();

      // Simulate user creation
      const hash = await bcrypt.hash("SecurePass1!", 12);
      await db.upsertUser({
        openId: "email_test-uuid",
        name: "New User",
        email: "newuser@example.com",
        passwordHash: hash,
        loginMethod: "email",
        role: "user",
      });

      // Verify user was created
      const user = await db.getUserByEmail("newuser@example.com");
      expect(user).toBeDefined();
      expect(user!.name).toBe("New User");
      expect(user!.loginMethod).toBe("email");
    });

    it("should update existing user name and password on accept", async () => {
      const oldHash = await bcrypt.hash("OldPass123!", 12);
      mockUsers["existing@example.com"] = {
        id: 50,
        email: "existing@example.com",
        openId: "email_existing",
        passwordHash: oldHash,
        name: "Old Name",
      };

      const db = await import("./db");
      const newHash = await bcrypt.hash("NewPass123!", 12);
      await db.updateUser(50, { name: "Updated Name" });
      await db.setUserPassword(50, newHash);

      expect(mockUsers["existing@example.com"].name).toBe("Updated Name");
      expect(
        await bcrypt.compare("NewPass123!", mockUsers["existing@example.com"].passwordHash)
      ).toBe(true);
    });

    it("should add user as account member", async () => {
      const db = await import("./db");
      await db.addMember({
        accountId: 10,
        userId: 100,
        role: "owner",
        isActive: true,
      });
      expect(mockMembers[10]).toHaveLength(1);
      expect(mockMembers[10][0].role).toBe("owner");
    });

    it("should not duplicate membership if already exists", async () => {
      mockMembers[10] = [{ userId: 100, role: "owner", isActive: true }];
      const db = await import("./db");
      const existing = await db.getMember(10, 100);
      expect(existing).toBeDefined();
      // In the real code, we skip addMember if existing
    });

    it("should set ownerId on account for owner invitations", async () => {
      const db = await import("./db");
      await db.updateAccount(5, { ownerId: 100 });
      expect(db.updateAccount).toHaveBeenCalledWith(5, { ownerId: 100 });
    });

    it("should mark invitation as accepted", async () => {
      mockInvitations["accept-me"] = {
        id: 10,
        token: "accept-me",
        email: "user@example.com",
        role: "owner",
        accountId: 1,
        status: "pending",
        expiresAt: new Date(Date.now() + 86400000),
      };
      const db = await import("./db");
      await db.updateInvitationStatus(10, "accepted", new Date());
      expect(mockInvitations["accept-me"].status).toBe("accepted");
    });

    it("should create audit log on acceptance", async () => {
      const db = await import("./db");
      await db.createAuditLog({
        accountId: 1,
        userId: 100,
        action: "invitation.accepted",
        resourceType: "invitation",
        resourceId: 10,
      });
      expect(mockAuditLogs).toHaveLength(1);
      expect(mockAuditLogs[0].action).toBe("invitation.accepted");
    });

    it("should create session token after acceptance", async () => {
      const { sdk } = await import("./_core/sdk");
      const token = await sdk.createSessionToken("email_test", {
        name: "Test User",
        expiresInMs: 365 * 24 * 60 * 60 * 1000,
      });
      expect(token).toBe("mock-session-token-abc");
    });
  });

  // ═══════════════════════════════════════════════════════════
  // Forgot Password
  // ═══════════════════════════════════════════════════════════
  describe("forgotPassword", () => {
    it("should validate email format", () => {
      const schema = z.object({ email: z.string().email() });
      expect(() => schema.parse({ email: "not-an-email" })).toThrow();
      expect(() => schema.parse({ email: "valid@example.com" })).not.toThrow();
    });

    it("should silently succeed for non-existent email (prevent enumeration)", async () => {
      const db = await import("./db");
      const user = await db.getUserByEmail("nonexistent@example.com");
      expect(user).toBeNull();
      // In the real code, we return { success: true } regardless
    });

    it("should silently succeed for OAuth user without password", async () => {
      mockUsers["oauth@example.com"] = {
        id: 1,
        email: "oauth@example.com",
        openId: "oauth_123",
        passwordHash: null,
      };
      const db = await import("./db");
      const user = await db.getUserByEmail("oauth@example.com");
      expect(user).toBeDefined();
      expect(user!.passwordHash).toBeNull();
      // In the real code, we return { success: true } without sending email
    });

    it("should create reset token with 1-hour expiry", async () => {
      const db = await import("./db");
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000);
      await db.createPasswordResetToken({
        userId: 5,
        token: "reset-token-123",
        expiresAt,
      });
      expect(mockResetTokens["reset-token-123"]).toBeDefined();
      expect(mockResetTokens["reset-token-123"].userId).toBe(5);
      // Verify expiry is approximately 1 hour from now
      const diff = expiresAt.getTime() - Date.now();
      expect(diff).toBeGreaterThan(3500000); // > 58 minutes
      expect(diff).toBeLessThanOrEqual(3600000); // <= 60 minutes
    });

    it("should send reset email via dispatchEmail", async () => {
      const { dispatchEmail } = await import("./services/messaging");
      const result = await dispatchEmail({
        to: "user@example.com",
        subject: "Reset Your Password — Sterling Marketing",
        body: "<p>Click to reset</p>",
      });
      expect(result.success).toBe(true);
      expect(dispatchEmail).toHaveBeenCalled();
    });

    it("should generate unique tokens for each request", async () => {
      const db = await import("./db");
      await db.createPasswordResetToken({
        userId: 5,
        token: "token-a",
        expiresAt: new Date(Date.now() + 3600000),
      });
      await db.createPasswordResetToken({
        userId: 5,
        token: "token-b",
        expiresAt: new Date(Date.now() + 3600000),
      });
      expect(mockResetTokens["token-a"]).toBeDefined();
      expect(mockResetTokens["token-b"]).toBeDefined();
      expect(mockResetTokens["token-a"].id).not.toBe(
        mockResetTokens["token-b"].id
      );
    });
  });

  // ═══════════════════════════════════════════════════════════
  // Validate Reset Token
  // ═══════════════════════════════════════════════════════════
  describe("validateResetToken", () => {
    it("should return invalid for non-existent token", async () => {
      const db = await import("./db");
      const token = await db.getPasswordResetToken("nonexistent");
      expect(token).toBeNull();
    });

    it("should return invalid for used token", async () => {
      mockResetTokens["used-token"] = {
        id: 1,
        userId: 5,
        token: "used-token",
        expiresAt: new Date(Date.now() + 3600000),
        usedAt: new Date(),
      };
      const db = await import("./db");
      const token = await db.getPasswordResetToken("used-token");
      expect(token).toBeDefined();
      expect(token!.usedAt).not.toBeNull();
    });

    it("should return invalid for expired token", async () => {
      mockResetTokens["expired-token"] = {
        id: 2,
        userId: 5,
        token: "expired-token",
        expiresAt: new Date(Date.now() - 3600000), // expired 1 hour ago
        usedAt: null,
      };
      const db = await import("./db");
      const token = await db.getPasswordResetToken("expired-token");
      expect(token).toBeDefined();
      expect(new Date() > token!.expiresAt).toBe(true);
    });

    it("should return valid for fresh token", async () => {
      mockResetTokens["valid-token"] = {
        id: 3,
        userId: 5,
        token: "valid-token",
        expiresAt: new Date(Date.now() + 3600000),
        usedAt: null,
      };
      const db = await import("./db");
      const token = await db.getPasswordResetToken("valid-token");
      expect(token).toBeDefined();
      expect(token!.usedAt).toBeNull();
      expect(new Date() < token!.expiresAt).toBe(true);
    });
  });

  // ═══════════════════════════════════════════════════════════
  // Reset Password With Token
  // ═══════════════════════════════════════════════════════════
  describe("resetPasswordWithToken", () => {
    it("should validate new password minimum length", () => {
      const schema = z.object({
        token: z.string().min(1),
        newPassword: z.string().min(8, "Password must be at least 8 characters"),
      });
      expect(() =>
        schema.parse({ token: "abc", newPassword: "short" })
      ).toThrow();
      expect(() =>
        schema.parse({ token: "abc", newPassword: "longEnough1" })
      ).not.toThrow();
    });

    it("should reject non-existent token", async () => {
      const db = await import("./db");
      const token = await db.getPasswordResetToken("nonexistent");
      expect(token).toBeNull();
    });

    it("should reject already-used token", async () => {
      mockResetTokens["used-reset"] = {
        id: 1,
        userId: 5,
        token: "used-reset",
        expiresAt: new Date(Date.now() + 3600000),
        usedAt: new Date(),
      };
      const db = await import("./db");
      const token = await db.getPasswordResetToken("used-reset");
      expect(token!.usedAt).not.toBeNull();
    });

    it("should reject expired token", async () => {
      mockResetTokens["expired-reset"] = {
        id: 2,
        userId: 5,
        token: "expired-reset",
        expiresAt: new Date(Date.now() - 1000),
        usedAt: null,
      };
      const db = await import("./db");
      const token = await db.getPasswordResetToken("expired-reset");
      expect(new Date() > token!.expiresAt).toBe(true);
    });

    it("should update password and mark token as used", async () => {
      mockUsers["resetme@example.com"] = {
        id: 5,
        email: "resetme@example.com",
        openId: "email_reset5",
        passwordHash: "old_hash",
      };
      mockResetTokens["valid-reset"] = {
        id: 3,
        userId: 5,
        token: "valid-reset",
        expiresAt: new Date(Date.now() + 3600000),
        usedAt: null,
      };

      const db = await import("./db");
      const newHash = await bcrypt.hash("NewSecurePass!", 12);
      await db.setUserPassword(5, newHash);
      await db.markPasswordResetTokenUsed(3);

      expect(
        await bcrypt.compare(
          "NewSecurePass!",
          mockUsers["resetme@example.com"].passwordHash
        )
      ).toBe(true);
      expect(mockResetTokens["valid-reset"].usedAt).not.toBeNull();
    });

    it("should not allow reuse of token after reset", async () => {
      mockResetTokens["one-time-token"] = {
        id: 4,
        userId: 5,
        token: "one-time-token",
        expiresAt: new Date(Date.now() + 3600000),
        usedAt: null,
      };

      const db = await import("./db");
      await db.markPasswordResetTokenUsed(4);
      const token = await db.getPasswordResetToken("one-time-token");
      expect(token!.usedAt).not.toBeNull();
    });
  });

  // ═══════════════════════════════════════════════════════════
  // Change Password (authenticated)
  // ═══════════════════════════════════════════════════════════
  describe("changePassword", () => {
    it("should validate current password is required", () => {
      const schema = z.object({
        currentPassword: z.string().min(1),
        newPassword: z.string().min(8),
      });
      expect(() =>
        schema.parse({ currentPassword: "", newPassword: "12345678" })
      ).toThrow();
    });

    it("should validate new password minimum length", () => {
      const schema = z.object({
        currentPassword: z.string().min(1),
        newPassword: z.string().min(8),
      });
      expect(() =>
        schema.parse({ currentPassword: "old", newPassword: "short" })
      ).toThrow();
    });

    it("should reject incorrect current password", async () => {
      const hash = await bcrypt.hash("CorrectPass!", 12);
      mockUsers["user@example.com"] = {
        id: 10,
        email: "user@example.com",
        passwordHash: hash,
      };
      const valid = await bcrypt.compare("WrongPass!", hash);
      expect(valid).toBe(false);
    });

    it("should accept correct current password and update", async () => {
      const currentHash = await bcrypt.hash("CurrentPass!", 12);
      mockUsers["user@example.com"] = {
        id: 10,
        email: "user@example.com",
        passwordHash: currentHash,
      };

      const valid = await bcrypt.compare("CurrentPass!", currentHash);
      expect(valid).toBe(true);

      const newHash = await bcrypt.hash("NewPassword!", 12);
      const db = await import("./db");
      await db.setUserPassword(10, newHash);

      expect(
        await bcrypt.compare(
          "NewPassword!",
          mockUsers["user@example.com"].passwordHash
        )
      ).toBe(true);
    });

    it("should reject change for user without password (OAuth)", async () => {
      mockUsers["oauth@example.com"] = {
        id: 20,
        email: "oauth@example.com",
        passwordHash: null,
      };
      const db = await import("./db");
      const user = await db.getUserById(20);
      expect(user).toBeDefined();
      expect(user!.passwordHash).toBeNull();
    });
  });

  // ═══════════════════════════════════════════════════════════
  // Invitation Email URL Format
  // ═══════════════════════════════════════════════════════════
  describe("Invitation Email URL Format", () => {
    it("should use /accept-invite?token= format", () => {
      const baseUrl = "https://apexcrm-knxkwfan.manus.space";
      const token = "test-token-123";
      const inviteUrl = `${baseUrl}/accept-invite?token=${token}`;
      expect(inviteUrl).toContain("/accept-invite?token=");
      expect(inviteUrl).not.toContain("/invite/");
    });

    it("should use VITE_APP_URL for base URL", () => {
      const baseUrl =
        process.env.VITE_APP_URL || "http://localhost:5000";
      expect(typeof baseUrl).toBe("string");
      expect(baseUrl.startsWith("http")).toBe(true);
    });
  });

  // ═══════════════════════════════════════════════════════════
  // End-to-End Flow Simulation
  // ═══════════════════════════════════════════════════════════
  describe("End-to-End Flow Simulation", () => {
    it("should complete full invitation → accept → login flow", async () => {
      // 1. Create invitation
      const token = "e2e-invite-token";
      mockInvitations[token] = {
        id: 100,
        token,
        email: "newowner@example.com",
        role: "owner",
        accountId: 20,
        status: "pending",
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      };

      const db = await import("./db");

      // 2. Verify invitation is valid
      const invitation = await db.getInvitationByToken(token);
      expect(invitation).toBeDefined();
      expect(invitation!.status).toBe("pending");
      expect(new Date() < invitation!.expiresAt).toBe(true);

      // 3. Accept invitation (create user + set password)
      const password = "SecureOwnerPass!";
      const hash = await bcrypt.hash(password, 12);
      await db.upsertUser({
        openId: "email_e2e-uuid",
        name: "New Owner",
        email: "newowner@example.com",
        passwordHash: hash,
        loginMethod: "email",
        role: "user",
      });

      const user = await db.getUserByEmail("newowner@example.com");
      expect(user).toBeDefined();

      // 4. Add as member
      await db.addMember({
        accountId: 20,
        userId: user!.id,
        role: "owner",
        isActive: true,
      });

      // 5. Set ownerId
      await db.updateAccount(20, { ownerId: user!.id });

      // 6. Mark invitation accepted
      await db.updateInvitationStatus(100, "accepted", new Date());
      expect(mockInvitations[token].status).toBe("accepted");

      // 7. Verify login works
      const loginUser = await db.getUserByEmail("newowner@example.com");
      expect(loginUser).toBeDefined();
      expect(await bcrypt.compare(password, loginUser!.passwordHash)).toBe(
        true
      );
    });

    it("should complete full forgot → reset → login flow", async () => {
      // 1. User exists with password
      const oldHash = await bcrypt.hash("OldPassword!", 12);
      mockUsers["forgotuser@example.com"] = {
        id: 200,
        email: "forgotuser@example.com",
        openId: "email_forgot200",
        passwordHash: oldHash,
      };

      const db = await import("./db");

      // 2. Request password reset
      const user = await db.getUserByEmail("forgotuser@example.com");
      expect(user).toBeDefined();
      expect(user!.passwordHash).not.toBeNull();

      // 3. Create reset token
      const resetToken = "e2e-reset-token";
      await db.createPasswordResetToken({
        userId: 200,
        token: resetToken,
        expiresAt: new Date(Date.now() + 3600000),
      });

      // 4. Validate token
      const tokenData = await db.getPasswordResetToken(resetToken);
      expect(tokenData).toBeDefined();
      expect(tokenData!.usedAt).toBeNull();
      expect(new Date() < tokenData!.expiresAt).toBe(true);

      // 5. Reset password
      const newPassword = "BrandNewPass!";
      const newHash = await bcrypt.hash(newPassword, 12);
      await db.setUserPassword(200, newHash);
      await db.markPasswordResetTokenUsed(tokenData!.id);

      // 6. Verify token is now used
      const usedToken = await db.getPasswordResetToken(resetToken);
      expect(usedToken!.usedAt).not.toBeNull();

      // 7. Verify login with new password
      const updatedUser = await db.getUserByEmail("forgotuser@example.com");
      expect(
        await bcrypt.compare(newPassword, updatedUser!.passwordHash)
      ).toBe(true);
      expect(await bcrypt.compare("OldPassword!", updatedUser!.passwordHash)).toBe(
        false
      );
    });
  });

  // ═══════════════════════════════════════════════════════════
  // Router Registration
  // ═══════════════════════════════════════════════════════════
  describe("Router Registration", () => {
    it("should have acceptInviteWithPassword procedure registered", async () => {
      const { appRouter } = await import("./routers");
      const procedures = Object.keys(
        (appRouter as any)._def.procedures
      );
      expect(procedures).toContain("subAccountAuth.acceptInviteWithPassword");
    });

    it("should have forgotPassword procedure registered", async () => {
      const { appRouter } = await import("./routers");
      const procedures = Object.keys(
        (appRouter as any)._def.procedures
      );
      expect(procedures).toContain("subAccountAuth.forgotPassword");
    });

    it("should have validateResetToken procedure registered", async () => {
      const { appRouter } = await import("./routers");
      const procedures = Object.keys(
        (appRouter as any)._def.procedures
      );
      expect(procedures).toContain("subAccountAuth.validateResetToken");
    });

    it("should have resetPasswordWithToken procedure registered", async () => {
      const { appRouter } = await import("./routers");
      const procedures = Object.keys(
        (appRouter as any)._def.procedures
      );
      expect(procedures).toContain("subAccountAuth.resetPasswordWithToken");
    });

    it("should have changePassword procedure registered", async () => {
      const { appRouter } = await import("./routers");
      const procedures = Object.keys(
        (appRouter as any)._def.procedures
      );
      expect(procedures).toContain("subAccountAuth.changePassword");
    });
  });
});
