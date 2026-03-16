import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { publicProcedure, protectedProcedure, adminProcedure, router } from "../_core/trpc";
import * as db from "../db";
import bcrypt from "bcryptjs";
import { sdk } from "../_core/sdk";
import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import { getSessionCookieOptions } from "../_core/cookies";
import { randomUUID } from "crypto";

const SALT_ROUNDS = 12;

export const subAccountAuthRouter = router({
  /**
   * Sub-account user login via email + password.
   * Returns user info + account memberships on success.
   * Sets session cookie.
   */
  login: publicProcedure
    .input(
      z.object({
        email: z.string().email(),
        password: z.string().min(1),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const user = await db.getUserByEmail(input.email);

      if (!user || !user.passwordHash) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "Invalid email or password",
        });
      }

      const valid = await bcrypt.compare(input.password, user.passwordHash);
      if (!valid) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "Invalid email or password",
        });
      }

      // Get account memberships
      const memberships = await db.getUserAccountMemberships(user.id);

      if (memberships.length === 0) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "No active account memberships found",
        });
      }

      // Check at least one active account
      const activeMemberships = memberships.filter(
        (m) => m.accountStatus === "active"
      );
      if (activeMemberships.length === 0) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "All associated accounts are suspended",
        });
      }

      // Create session token using the SDK
      const sessionToken = await sdk.createSessionToken(user.openId, {
        name: user.name || "",
        expiresInMs: ONE_YEAR_MS,
      });

      // Set cookie
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.cookie(COOKIE_NAME, sessionToken, {
        ...cookieOptions,
        maxAge: ONE_YEAR_MS,
      });

      // Update last signed in
      await db.upsertUser({
        openId: user.openId,
        lastSignedIn: new Date(),
        loginMethod: "email",
      });

      return {
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
        },
        memberships: activeMemberships.map((m) => ({
          accountId: m.accountId,
          accountName: m.accountName,
          accountSlug: m.accountSlug,
          memberRole: m.memberRole,
        })),
      };
    }),

  /**
   * Get current user's account memberships.
   * Used after login to determine which accounts the user can access.
   */
  myAccounts: protectedProcedure.query(async ({ ctx }) => {
    const memberships = await db.getUserAccountMemberships(ctx.user.id);
    return memberships
      .filter((m) => m.accountStatus === "active")
      .map((m) => ({
        accountId: m.accountId,
        accountName: m.accountName,
        accountSlug: m.accountSlug,
        memberRole: m.memberRole,
      }));
  }),

  /**
   * Admin: Set password for a sub-account user.
   * Used when creating/onboarding sub-account owners and employees.
   */
  setPassword: adminProcedure
    .input(
      z.object({
        userId: z.number().int().positive(),
        password: z.string().min(8, "Password must be at least 8 characters"),
      })
    )
    .mutation(async ({ input }) => {
      const user = await db.getUserById(input.userId);
      if (!user) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "User not found",
        });
      }

      const hash = await bcrypt.hash(input.password, SALT_ROUNDS);
      await db.setUserPassword(user.id, hash);

      return { success: true };
    }),

  /**
   * Sub-account user: Change own password.
   */
  changePassword: protectedProcedure
    .input(
      z.object({
        currentPassword: z.string().min(1),
        newPassword: z.string().min(8, "Password must be at least 8 characters"),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const user = await db.getUserById(ctx.user.id);
      if (!user || !user.passwordHash) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Password login not configured for this account",
        });
      }

      const valid = await bcrypt.compare(input.currentPassword, user.passwordHash);
      if (!valid) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "Current password is incorrect",
        });
      }

      const hash = await bcrypt.hash(input.newPassword, SALT_ROUNDS);
      await db.setUserPassword(ctx.user.id, hash);

      return { success: true };
    }),

  /**
   * Admin: Create a sub-account user with email/password credentials.
   * Creates the user, sets their password, and adds them as a member of the specified account.
   */
  createSubAccountUser: adminProcedure
    .input(
      z.object({
        name: z.string().min(1),
        email: z.string().email(),
        password: z.string().min(8, "Password must be at least 8 characters"),
        accountId: z.number().int().positive(),
        memberRole: z.enum(["owner", "manager", "employee"]).default("employee"),
      })
    )
    .mutation(async ({ input }) => {
      // Check if email already exists
      const existing = await db.getUserByEmail(input.email);
      if (existing) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "A user with this email already exists",
        });
      }

      // Check account exists
      const account = await db.getAccountById(input.accountId);
      if (!account) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Account not found",
        });
      }

      // Create user with a unique openId for email-based users
      const openId = `email_${randomUUID()}`;
      const hash = await bcrypt.hash(input.password, SALT_ROUNDS);

      await db.upsertUser({
        openId,
        name: input.name,
        email: input.email,
        passwordHash: hash,
        loginMethod: "email",
        role: "user", // Sub-account users are always "user" role at platform level
      });

      const user = await db.getUserByEmail(input.email);
      if (!user) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to create user",
        });
      }

      // Add as account member
      await db.addMember({
        accountId: input.accountId,
        userId: user.id,
        role: input.memberRole,
        isActive: true,
      });

      return {
        userId: user.id,
        email: input.email,
        accountId: input.accountId,
        memberRole: input.memberRole,
      };
    }),

  /**
   * Admin: Reset a user's password.
   */
  resetPassword: adminProcedure
    .input(
      z.object({
        userId: z.number().int().positive(),
        newPassword: z.string().min(8, "Password must be at least 8 characters"),
      })
    )
    .mutation(async ({ input }) => {
      const user = await db.getUserById(input.userId);
      if (!user) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "User not found",
        });
      }

      const hash = await bcrypt.hash(input.newPassword, SALT_ROUNDS);
      await db.setUserPassword(user.id, hash);

      return { success: true };
    }),
});
