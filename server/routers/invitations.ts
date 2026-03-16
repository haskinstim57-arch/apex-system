import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { nanoid } from "nanoid";
import {
  protectedProcedure,
  publicProcedure,
  router,
} from "../_core/trpc";
import * as db from "../db";

/** Ensure the current user is an owner/manager of the given account */
async function requireInviteAccess(userId: number, accountId: number) {
  const member = await db.getMember(accountId, userId);
  if (!member || !member.isActive) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "You do not have access to this account.",
    });
  }
  if (!["owner", "manager"].includes(member.role)) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Only owners and managers can send invitations.",
    });
  }
  return member;
}

export const invitationsRouter = router({
  /** Create an invitation to join an account */
  create: protectedProcedure
    .input(
      z.object({
        accountId: z.number().int().positive(),
        email: z.string().email().max(320),
        role: z.enum(["owner", "manager", "employee"]).default("employee"),
        message: z.string().max(500).optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      // Only admin or account owner/manager can invite
      if (ctx.user.role !== "admin") {
        await requireInviteAccess(ctx.user.id, input.accountId);
      }

      // Check if account exists
      const account = await db.getAccountById(input.accountId);
      if (!account) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Account not found.",
        });
      }

      // Check if user is already a member
      const existingUser = await db.getUserByEmail(input.email);
      if (existingUser) {
        const existingMember = await db.getMember(
          input.accountId,
          existingUser.id
        );
        if (existingMember) {
          throw new TRPCError({
            code: "CONFLICT",
            message: "This user is already a member of this account.",
          });
        }
      }

      const token = nanoid(32);
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

      const result = await db.createInvitation({
        accountId: input.accountId,
        invitedById: ctx.user.id,
        email: input.email,
        role: input.role,
        token,
        status: "pending",
        message: input.message ?? null,
        expiresAt,
      });

      await db.createAuditLog({
        accountId: input.accountId,
        userId: ctx.user.id,
        action: "invitation.created",
        resourceType: "invitation",
        resourceId: result.id,
        metadata: JSON.stringify({
          email: input.email,
          role: input.role,
        }),
      });

      return { id: result.id, token };
    }),

  /** Accept an invitation (authenticated user) */
  accept: protectedProcedure
    .input(z.object({ token: z.string().min(1) }))
    .mutation(async ({ input, ctx }) => {
      const invitation = await db.getInvitationByToken(input.token);

      if (!invitation) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Invitation not found.",
        });
      }

      if (invitation.status !== "pending") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `This invitation has already been ${invitation.status}.`,
        });
      }

      if (new Date() > invitation.expiresAt) {
        await db.updateInvitationStatus(invitation.id, "expired");
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "This invitation has expired.",
        });
      }

      // Check if already a member
      const existingMember = await db.getMember(
        invitation.accountId,
        ctx.user.id
      );
      if (existingMember) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "You are already a member of this account.",
        });
      }

      // Add user as member
      await db.addMember({
        accountId: invitation.accountId,
        userId: ctx.user.id,
        role: invitation.role,
        isActive: true,
      });

      // Mark invitation as accepted
      await db.updateInvitationStatus(
        invitation.id,
        "accepted",
        new Date()
      );

      await db.createAuditLog({
        accountId: invitation.accountId,
        userId: ctx.user.id,
        action: "invitation.accepted",
        resourceType: "invitation",
        resourceId: invitation.id,
      });

      return { success: true, accountId: invitation.accountId };
    }),

  /** Get invitation details by token (public — for invite landing page) */
  getByToken: publicProcedure
    .input(z.object({ token: z.string().min(1) }))
    .query(async ({ input }) => {
      const invitation = await db.getInvitationByToken(input.token);
      if (!invitation) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Invitation not found.",
        });
      }

      const account = await db.getAccountById(invitation.accountId);

      return {
        id: invitation.id,
        email: invitation.email,
        role: invitation.role,
        status: invitation.status,
        message: invitation.message,
        expiresAt: invitation.expiresAt,
        accountName: account?.name ?? "Unknown",
      };
    }),

  /** List invitations for an account */
  list: protectedProcedure
    .input(z.object({ accountId: z.number().int().positive() }))
    .query(async ({ input, ctx }) => {
      if (ctx.user.role !== "admin") {
        await requireInviteAccess(ctx.user.id, input.accountId);
      }
      return db.listInvitations(input.accountId);
    }),

  /** Revoke a pending invitation */
  revoke: protectedProcedure
    .input(
      z.object({
        accountId: z.number().int().positive(),
        invitationId: z.number().int().positive(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      if (ctx.user.role !== "admin") {
        await requireInviteAccess(ctx.user.id, input.accountId);
      }

      await db.updateInvitationStatus(input.invitationId, "revoked");

      await db.createAuditLog({
        accountId: input.accountId,
        userId: ctx.user.id,
        action: "invitation.revoked",
        resourceType: "invitation",
        resourceId: input.invitationId,
      });

      return { success: true };
    }),
});
