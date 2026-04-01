import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { publicProcedure, protectedProcedure, adminProcedure, router } from "../_core/trpc";
import * as db from "../db";
import bcrypt from "bcryptjs";
import { sdk } from "../_core/sdk";
import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import { getSessionCookieOptions } from "../_core/cookies";
import { randomUUID } from "crypto";
import { nanoid } from "nanoid";
import { dispatchEmail } from "../services/messaging";

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
   * Public: Accept an invitation and set a password (for new sub-account users).
   * Creates the user if they don't exist, sets password, adds as member, marks invitation accepted.
   */
  acceptInviteWithPassword: publicProcedure
    .input(
      z.object({
        token: z.string().min(1),
        name: z.string().min(1, "Name is required"),
        password: z.string().min(8, "Password must be at least 8 characters"),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const invitation = await db.getInvitationByToken(input.token);

      if (!invitation) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "This invitation link has expired or is invalid. Please contact your administrator.",
        });
      }

      if (invitation.status !== "pending") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `This invitation has already been ${invitation.status}. Please contact your administrator.`,
        });
      }

      if (new Date() > invitation.expiresAt) {
        await db.updateInvitationStatus(invitation.id, "expired");
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "This invitation link has expired. Please contact your administrator to resend it.",
        });
      }

      const hash = await bcrypt.hash(input.password, SALT_ROUNDS);

      // Check if user already exists by email
      let user = await db.getUserByEmail(invitation.email);

      if (user) {
        // Update existing user with name and password
        await db.updateUser(user.id, { name: input.name });
        await db.setUserPassword(user.id, hash);
      } else {
        // Create new user with email/password credentials
        const openId = `email_${randomUUID()}`;
        await db.upsertUser({
          openId,
          name: input.name,
          email: invitation.email,
          passwordHash: hash,
          loginMethod: "email",
          role: "user",
        });
        user = await db.getUserByEmail(invitation.email);
        if (!user) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Failed to create user account.",
          });
        }
      }

      // Check if already a member
      const existingMember = await db.getMember(invitation.accountId, user.id);
      if (!existingMember) {
        await db.addMember({
          accountId: invitation.accountId,
          userId: user.id,
          role: invitation.role,
          isActive: true,
        });
      }

      // If owner invitation, set ownerId on account
      if (invitation.role === "owner") {
        await db.updateAccount(invitation.accountId, { ownerId: user.id });
      }

      // Mark invitation as accepted
      await db.updateInvitationStatus(invitation.id, "accepted", new Date());

      await db.createAuditLog({
        accountId: invitation.accountId,
        userId: user.id,
        action: "invitation.accepted",
        resourceType: "invitation",
        resourceId: invitation.id,
      });

      // Create session and set cookie so user is logged in immediately
      const sessionToken = await sdk.createSessionToken(user.openId, {
        name: user.name || "",
        expiresInMs: ONE_YEAR_MS,
      });

      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.cookie(COOKIE_NAME, sessionToken, {
        ...cookieOptions,
        maxAge: ONE_YEAR_MS,
      });

      return {
        success: true,
        accountId: invitation.accountId,
        accountName: (await db.getAccountById(invitation.accountId))?.name || "Unknown",
      };
    }),

  /**
   * Public: Request a password reset email.
   */
  forgotPassword: publicProcedure
    .input(
      z.object({
        email: z.string().email(),
      })
    )
    .mutation(async ({ input }) => {
      // Always return success to prevent email enumeration
      const user = await db.getUserByEmail(input.email);
      if (!user || !user.passwordHash) {
        // Don't reveal whether the email exists
        return { success: true };
      }

      // Generate reset token (1 hour expiry)
      const token = nanoid(48);
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

      await db.createPasswordResetToken({
        userId: user.id,
        token,
        expiresAt,
      });

      // Send reset email
      const baseUrl = process.env.VITE_APP_URL || "http://localhost:5000";
      const resetUrl = `${baseUrl}/reset-password?token=${token}`;

      try {
        await dispatchEmail({
          to: input.email,
          subject: "Reset Your Password — Sterling Marketing",
          body: [
            `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">`,
            `<h2 style="color: #0c5ab0;">Password Reset Request</h2>`,
            `<p>We received a request to reset the password for your Sterling Marketing account.</p>`,
            `<p>Click the button below to set a new password:</p>`,
            `<p style="text-align: center; margin: 30px 0;">`,
            `<a href="${resetUrl}" style="background-color: #0c5ab0; color: #fff; padding: 14px 32px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">Reset Password</a>`,
            `</p>`,
            `<p style="color: #888; font-size: 13px;">Or copy this link: ${resetUrl}</p>`,
            `<p style="color: #888; font-size: 13px;">This link expires in 1 hour.</p>`,
            `<p style="color: #888; font-size: 13px;">If you didn't request this, you can safely ignore this email.</p>`,
            `<hr style="border: 1px solid #333;">`,
            `<p style="color: #888; font-size: 12px;">&mdash; Sterling Marketing</p>`,
            `</div>`,
          ].join("\n"),
        });
      } catch (err: any) {
        console.error("[ForgotPassword] Failed to send reset email:", err?.message || err);
      }

      return { success: true };
    }),

  /**
   * Public: Validate a password reset token.
   */
  validateResetToken: publicProcedure
    .input(z.object({ token: z.string().min(1) }))
    .query(async ({ input }) => {
      const resetToken = await db.getPasswordResetToken(input.token);
      if (!resetToken) {
        return { valid: false, email: null };
      }
      if (resetToken.usedAt || new Date() > resetToken.expiresAt) {
        return { valid: false, email: null };
      }
      const user = await db.getUserById(resetToken.userId);
      return { valid: true, email: user?.email || null };
    }),

  /**
   * Public: Reset password using a valid token.
   */
  resetPasswordWithToken: publicProcedure
    .input(
      z.object({
        token: z.string().min(1),
        newPassword: z.string().min(8, "Password must be at least 8 characters"),
      })
    )
    .mutation(async ({ input }) => {
      const resetToken = await db.getPasswordResetToken(input.token);

      if (!resetToken) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "This reset link is invalid. Please request a new one.",
        });
      }

      if (resetToken.usedAt) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "This reset link has already been used. Please request a new one.",
        });
      }

      if (new Date() > resetToken.expiresAt) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "This reset link has expired. Please request a new one.",
        });
      }

      const hash = await bcrypt.hash(input.newPassword, SALT_ROUNDS);
      await db.setUserPassword(resetToken.userId, hash);
      await db.markPasswordResetTokenUsed(resetToken.id);

      return { success: true };
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
