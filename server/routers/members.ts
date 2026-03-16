import { TRPCError } from "@trpc/server";
import { z } from "zod";
import {
  protectedProcedure,
  adminProcedure,
  router,
} from "../_core/trpc";
import * as db from "../db";

/** Ensure the current user is an owner/manager of the given account */
async function requireManageAccess(userId: number, accountId: number) {
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
      message: "Only owners and managers can manage team members.",
    });
  }
  return member;
}

export const membersRouter = router({
  /** List all members of an account */
  list: protectedProcedure
    .input(z.object({ accountId: z.number().int().positive() }))
    .query(async ({ input, ctx }) => {
      // Admin can view any account; others need membership
      if (ctx.user.role !== "admin") {
        const member = await db.getMember(input.accountId, ctx.user.id);
        if (!member || !member.isActive) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "You do not have access to this account.",
          });
        }
      }
      return db.listMembers(input.accountId);
    }),

  /** Update a member's role */
  updateRole: protectedProcedure
    .input(
      z.object({
        accountId: z.number().int().positive(),
        userId: z.number().int().positive(),
        role: z.enum(["owner", "manager", "employee"]),
      })
    )
    .mutation(async ({ input, ctx }) => {
      if (ctx.user.role !== "admin") {
        await requireManageAccess(ctx.user.id, input.accountId);
      }

      // Prevent changing own role
      if (input.userId === ctx.user.id) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "You cannot change your own role.",
        });
      }

      await db.updateMemberRole(input.accountId, input.userId, input.role);

      await db.createAuditLog({
        accountId: input.accountId,
        userId: ctx.user.id,
        action: "member.role_updated",
        resourceType: "user",
        resourceId: input.userId,
        metadata: JSON.stringify({ newRole: input.role }),
      });

      return { success: true };
    }),

  /** Toggle member active status */
  toggleStatus: protectedProcedure
    .input(
      z.object({
        accountId: z.number().int().positive(),
        userId: z.number().int().positive(),
        isActive: z.boolean(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      if (ctx.user.role !== "admin") {
        await requireManageAccess(ctx.user.id, input.accountId);
      }

      if (input.userId === ctx.user.id) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "You cannot deactivate yourself.",
        });
      }

      await db.updateMemberStatus(
        input.accountId,
        input.userId,
        input.isActive
      );

      await db.createAuditLog({
        accountId: input.accountId,
        userId: ctx.user.id,
        action: input.isActive ? "member.activated" : "member.deactivated",
        resourceType: "user",
        resourceId: input.userId,
      });

      return { success: true };
    }),

  /** Remove a member from an account */
  remove: protectedProcedure
    .input(
      z.object({
        accountId: z.number().int().positive(),
        userId: z.number().int().positive(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      if (ctx.user.role !== "admin") {
        await requireManageAccess(ctx.user.id, input.accountId);
      }

      if (input.userId === ctx.user.id) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "You cannot remove yourself.",
        });
      }

      await db.removeMember(input.accountId, input.userId);

      await db.createAuditLog({
        accountId: input.accountId,
        userId: ctx.user.id,
        action: "member.removed",
        resourceType: "user",
        resourceId: input.userId,
      });

      return { success: true };
    }),

  /** Get current user's membership for a specific account */
  myMembership: protectedProcedure
    .input(z.object({ accountId: z.number().int().positive() }))
    .query(async ({ input, ctx }) => {
      return db.getMember(input.accountId, ctx.user.id);
    }),
});
