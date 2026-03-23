import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { nanoid } from "nanoid";
import {
  protectedProcedure,
  publicProcedure,
  router,
} from "../_core/trpc";
import * as db from "../db";
import { dispatchEmail } from "../services/messaging";

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

      // Send invitation email
      const baseUrl = process.env.VITE_APP_URL || "http://localhost:5000";
      const inviteUrl = `${baseUrl}/accept-invite?token=${token}`;
      const inviterName = ctx.user.name || "An administrator";

      let emailSent = false;
      try {
        console.log(
          `[INVITE] Attempting to send email to: ${input.email} from: ${process.env.SENDGRID_FROM_EMAIL || '(not set)'}`
        );
        const emailResult = await dispatchEmail({
          to: input.email,
          subject: `You've been invited to join ${account.name}`,
          body: [
            `Hi,`,
            ``,
            `${inviterName} has invited you to join ${account.name} on Apex System as a${input.role === "owner" ? "n" : ""} ${input.role}.`,
            ``,
            input.message ? `Message from ${inviterName}: "${input.message}"` : "",
            input.message ? "" : "",
            `Click the link below to accept the invitation:`,
            inviteUrl,
            ``,
            `This invitation expires in 7 days.`,
            ``,
            `\u2014 Apex System`,
          ]
            .filter((line) => line !== "" || true)
            .join("\n"),
        });

        console.log(
          `[INVITE] dispatchEmail result: ${JSON.stringify(emailResult)}`
        );
        emailSent = emailResult.success;
        if (!emailResult.success) {
          console.error(
            `[Invitations] Email dispatch failed for ${input.email}: ${emailResult.error}`
          );
        } else {
          console.log(
            `[Invitations] Invitation email sent to ${input.email} for account ${account.name}`
          );
        }
      } catch (err: any) {
        console.error(
          `[Invitations] Unexpected error sending invitation email to ${input.email}:`,
          err?.response?.body || err?.message || err
        );
      }

      return { id: result.id, emailSent, token };
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

      // If this is an owner invitation, set the user as the account owner
      if (invitation.role === "owner") {
        await db.updateAccount(invitation.accountId, {
          ownerId: ctx.user.id,
        });
      }

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

  /** Resend an invitation email for a pending account (admin only) */
  resend: protectedProcedure
    .input(
      z.object({
        accountId: z.number().int().positive(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      // Only admins can resend from the Sub-Accounts page
      if (ctx.user.role !== "admin") {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Only administrators can resend invitations.",
        });
      }

      const account = await db.getAccountById(input.accountId);
      if (!account) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Account not found." });
      }

      // Find the most recent pending invitation for this account
      const allInvitations = await db.listInvitations(input.accountId);
      const pendingInvite = allInvitations.find((inv) => inv.status === "pending");

      if (!pendingInvite) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "No pending invitation found for this account.",
        });
      }

      // Generate a new token and extend expiry
      const newToken = nanoid(32);
      const newExpiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days

      // Revoke old invitation and create a fresh one
      await db.updateInvitationStatus(pendingInvite.id, "revoked");
      const newInvite = await db.createInvitation({
        accountId: input.accountId,
        invitedById: ctx.user.id,
        email: pendingInvite.email,
        role: pendingInvite.role,
        token: newToken,
        status: "pending",
        message: `Reminder: You've been invited to join ${account.name}.`,
        expiresAt: newExpiresAt,
      });

      // Send the email
      const baseUrl = process.env.VITE_APP_URL || "http://localhost:5000";
      const inviteUrl = `${baseUrl}/accept-invite?token=${newToken}`;
      const inviterName = ctx.user.name || "An administrator";

      let emailSent = false;
      try {
        console.log(
          `[INVITE-RESEND] Attempting to send email to: ${pendingInvite.email} from: ${process.env.SENDGRID_FROM_EMAIL || '(not set)'}`
        );
        const emailResult = await dispatchEmail({
          to: pendingInvite.email,
          subject: `Reminder: You've been invited to join ${account.name} on Apex System`,
          body: [
            `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">`,
            `<h2 style="color: #d4a843;">Invitation Reminder</h2>`,
            `<p>${inviterName} has re-sent your invitation to join <strong>${account.name}</strong> on Apex System as a${pendingInvite.role === "owner" ? "n" : ""} ${pendingInvite.role}.</p>`,
            `<p>Click the button below to accept the invitation and set up your account:</p>`,
            `<p style="text-align: center; margin: 30px 0;">`,
            `<a href="${inviteUrl}" style="background-color: #d4a843; color: #000; padding: 12px 30px; text-decoration: none; border-radius: 6px; font-weight: bold;">Accept Invitation</a>`,
            `</p>`,
            `<p style="color: #888; font-size: 13px;">Or copy this link: ${inviteUrl}</p>`,
            `<p style="color: #888; font-size: 13px;">This invitation expires in 30 days.</p>`,
            `<hr style="border: 1px solid #333;">`,
            `<p style="color: #888; font-size: 12px;">&mdash; Apex System</p>`,
            `</div>`,
          ].join("\n"),
        });

        console.log(
          `[INVITE-RESEND] dispatchEmail result: ${JSON.stringify(emailResult)}`
        );
        emailSent = emailResult.success;
        if (!emailResult.success) {
          console.error(
            `[Invitations] Resend email failed for ${pendingInvite.email}: ${emailResult.error}`
          );
        } else {
          console.log(
            `[Invitations] Invitation re-sent to ${pendingInvite.email} for account ${account.name}`
          );
        }
      } catch (err: any) {
        console.error(
          `[Invitations] Unexpected error resending invitation email to ${pendingInvite.email}:`,
          err?.response?.body || err?.message || err
        );
      }

      await db.createAuditLog({
        accountId: input.accountId,
        userId: ctx.user.id,
        action: "invitation.resent",
        resourceType: "invitation",
        resourceId: newInvite.id,
        metadata: JSON.stringify({
          email: pendingInvite.email,
          role: pendingInvite.role,
          emailSent,
        }),
      });

      return { success: true, emailSent, token: newToken };
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
