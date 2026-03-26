import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { nanoid } from "nanoid";
import {
  protectedProcedure,
  adminProcedure,
  router,
} from "../_core/trpc";
import * as db from "../db";
import { eq } from "drizzle-orm";
import { dispatchEmail } from "../services/messaging";

// ─────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────

function generateSlug(name: string): string {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") +
    "-" +
    nanoid(6)
  );
}

/** Ensure the current user is an owner/manager of the given account */
async function requireAccountAccess(
  userId: number,
  accountId: number,
  requiredRoles: ("owner" | "manager" | "employee")[] = [
    "owner",
    "manager",
    "employee",
  ]
) {
  const member = await db.getMember(accountId, userId);
  if (!member || !member.isActive) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "You do not have access to this account.",
    });
  }
  if (!requiredRoles.includes(member.role)) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: `This action requires one of: ${requiredRoles.join(", ")}`,
    });
  }
  return member;
}

// ─────────────────────────────────────────────
// ACCOUNTS ROUTER
// ─────────────────────────────────────────────

export const accountsRouter = router({
  /** Create a new sub-account (admin only) */
  create: adminProcedure
    .input(
      z.object({
        name: z.string().min(1).max(255),
        ownerEmail: z.string().email().max(320),
        industry: z.string().max(100).optional(),
        website: z.string().max(500).optional(),
        phone: z.string().max(30).optional(),
        status: z.enum(["active", "suspended"]).default("active"),
        parentId: z.number().int().positive().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const slug = generateSlug(input.name);

      const result = await db.createAccount({
        name: input.name,
        slug,
        parentId: input.parentId ?? null,
        // ownerId is always null at creation — the real owner is assigned
        // only when they accept the invitation via invitations.accept
        ownerId: null,
        industry: input.industry ?? "mortgage",
        website: input.website ?? null,
        phone: input.phone ?? null,
        email: input.ownerEmail,
        status: input.status,
      });

      // Always create an invitation for the owner email
      const token = nanoid(32);
      const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days
      await db.createInvitation({
        accountId: result.id,
        invitedById: ctx.user.id,
        email: input.ownerEmail,
        role: "owner",
        token,
        status: "pending",
        message: `You've been assigned as the owner of ${input.name}.`,
        expiresAt,
      });

      // Send invitation email to the owner
      let emailSent = false;
      const baseUrl = process.env.VITE_APP_URL || "http://localhost:5000";
      const inviteUrl = `${baseUrl}/accept-invite?token=${token}`;
      const inviterName = ctx.user.name || "An administrator";

      try {
        console.log(
          `[INVITE] Attempting to send email to: ${input.ownerEmail} from: ${process.env.SENDGRID_FROM_EMAIL || '(not set)'}`
        );
        const emailResult = await dispatchEmail({
          to: input.ownerEmail,
          subject: `You've been invited to join ${input.name} on Apex System`,
          body: [
            `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">`,
            `<h2 style="color: #d4a843;">You're Invited!</h2>`,
            `<p>${inviterName} has invited you to join <strong>${input.name}</strong> on Apex System as an owner.</p>`,
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
          `[INVITE] dispatchEmail result: ${JSON.stringify(emailResult)}`
        );
        emailSent = emailResult.success;
        if (!emailResult.success) {
          console.error(
            `[Accounts] Invitation email failed for ${input.ownerEmail}: ${emailResult.error}`
          );
        } else {
          console.log(
            `[Accounts] Invitation email sent to ${input.ownerEmail} for account ${input.name}`
          );
        }
      } catch (err: any) {
        console.error(
          `[Accounts] Unexpected error sending invitation email to ${input.ownerEmail}:`,
          err?.response?.body || err?.message || err
        );
      }

      await db.createAuditLog({
        accountId: result.id,
        userId: ctx.user.id,
        action: "account.created",
        resourceType: "account",
        resourceId: result.id,
        metadata: JSON.stringify({ name: input.name, ownerEmail: input.ownerEmail }),
      });

      return { ...result, emailSent, inviteToken: token };
    }),

  /** List all accounts (admin) or user's accounts */
  list: protectedProcedure.query(async ({ ctx }) => {
    console.log(`[accounts.list] userId=${ctx.user.id} email=${ctx.user.email} role=${ctx.user.role}`);
    if (ctx.user.role === "admin") {
      const results = await db.listAccountsWithOwner();
      console.log(`[accounts.list] Admin path returned ${results.length} accounts`);
      return results;
    }
    const results = await db.listAccountsForUserWithOwner(ctx.user.id);
    console.log(`[accounts.list] User path returned ${results.length} accounts for userId=${ctx.user.id}`);
    return results;
  }),

  /** Get a single account by ID (with access check) */
  get: protectedProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .query(async ({ input, ctx }) => {
      const account = await db.getAccountById(input.id);
      if (!account) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Account not found" });
      }

      // Admin can see all; others need membership
      if (ctx.user.role !== "admin") {
        await requireAccountAccess(ctx.user.id, input.id);
      }

      const stats = await db.getAccountStats(input.id);
      return { ...account, ...stats };
    }),

  /** Update account details (owner/manager or admin) */
  update: protectedProcedure
    .input(
      z.object({
        id: z.number().int().positive(),
        name: z.string().min(1).max(255).optional(),
        industry: z.string().max(100).optional(),
        website: z.string().max(500).optional(),
        phone: z.string().max(30).optional(),
        email: z.string().email().max(320).optional(),
        address: z.string().optional(),
        status: z.enum(["active", "suspended", "pending"]).optional(),
        logoUrl: z.string().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      if (ctx.user.role !== "admin") {
        await requireAccountAccess(ctx.user.id, input.id, ["owner", "manager"]);
      }

      const { id, ...data } = input;
      await db.updateAccount(id, data);

      await db.createAuditLog({
        accountId: id,
        userId: ctx.user.id,
        action: "account.updated",
        resourceType: "account",
        resourceId: id,
        metadata: JSON.stringify(data),
      });

      return { success: true };
    }),

  /** Delete an account (admin only) */
  delete: adminProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ input, ctx }) => {
      await db.deleteAccount(input.id);

      await db.createAuditLog({
        userId: ctx.user.id,
        action: "account.deleted",
        resourceType: "account",
        resourceId: input.id,
      });

      return { success: true };
    }),

  /** Admin dashboard stats */
  adminStats: adminProcedure.query(async () => {
    return db.getAdminStats();
  }),

  /** Get dashboard stats for a specific account */
  accountDashboardStats: protectedProcedure
    .input(z.object({ accountId: z.number().int().positive() }))
    .query(async ({ input, ctx }) => {
      // Admins can view any account; clients need membership
      if (ctx.user.role !== "admin") {
        await requireAccountAccess(ctx.user.id, input.accountId, ["owner", "manager", "employee"]);
      }
      return db.getAccountDashboardStats(input.accountId);
    }),

  /** Get onboarding checklist status for a sub-account */
  getOnboardingStatus: protectedProcedure
    .input(z.object({ accountId: z.number().int().positive() }))
    .query(async ({ input, ctx }) => {
      // Verify access
      if (ctx.user.role !== "admin") {
        await requireAccountAccess(ctx.user.id, input.accountId, ["owner", "manager", "employee"]);
      }
      const database = await db.getDb();
      if (!database) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
      const { accounts, contacts, calendars, campaigns, workflows, accountMessagingSettings } = await import("../../drizzle/schema");
      const { count } = await import("drizzle-orm");

      // 1. Get account record
      const [account] = await database
        .select({
          phone: accounts.phone,
          missedCallTextBackEnabled: accounts.missedCallTextBackEnabled,
        })
        .from(accounts)
        .where(eq(accounts.id, input.accountId))
        .limit(1);

      // 2. Get messaging settings (sendgridFromEmail)
      const [msgSettings] = await database
        .select({ sendgridFromEmail: accountMessagingSettings.sendgridFromEmail })
        .from(accountMessagingSettings)
        .where(eq(accountMessagingSettings.accountId, input.accountId))
        .limit(1);

      // 3. Count contacts
      const [contactCount] = await database
        .select({ cnt: count() })
        .from(contacts)
        .where(eq(contacts.accountId, input.accountId));

      // 4. Count calendars
      const [calendarCount] = await database
        .select({ cnt: count() })
        .from(calendars)
        .where(eq(calendars.accountId, input.accountId));

      // 5. Count campaigns
      const [campaignCount] = await database
        .select({ cnt: count() })
        .from(campaigns)
        .where(eq(campaigns.accountId, input.accountId));

      // 6. Count workflows
      const [workflowCount] = await database
        .select({ cnt: count() })
        .from(workflows)
        .where(eq(workflows.accountId, input.accountId));

      return {
        hasPhoneNumber: !!account?.phone,
        hasEmail: !!msgSettings?.sendgridFromEmail,
        hasContact: (contactCount?.cnt ?? 0) > 0,
        hasCalendar: (calendarCount?.cnt ?? 0) > 0,
        hasMissedCallTextBack: !!account?.missedCallTextBackEnabled,
        hasCampaign: (campaignCount?.cnt ?? 0) > 0,
        hasWorkflow: (workflowCount?.cnt ?? 0) > 0,
      };
    }),

  /** Mark onboarding as complete for a sub-account */
  completeOnboarding: protectedProcedure
    .input(z.object({ accountId: z.number().int().positive() }))
    .mutation(async ({ input, ctx }) => {
      // Only owners/admins can complete onboarding
      if (ctx.user.role !== "admin") {
        await requireAccountAccess(ctx.user.id, input.accountId, ["owner"]);
      }

      await db.updateAccount(input.accountId, { onboardingComplete: true });

      await db.createAuditLog({
        accountId: input.accountId,
        userId: ctx.user.id,
        action: "account.onboarding_completed",
        resourceType: "account",
        resourceId: input.accountId,
      });

      return { success: true };
    }),

  /** Get voice agent status for an account */
  getVoiceAgentStatus: protectedProcedure
    .input(z.object({ accountId: z.number() }))
    .query(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin") {
        await requireAccountAccess(ctx.user.id, input.accountId, ["owner", "manager"]);
      }
      const account = await db.getAccountById(input.accountId);
      if (!account) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Account not found." });
      }
      return {
        voiceAgentEnabled: (account as any).voiceAgentEnabled ?? false,
        vapiAssistantId: (account as any).vapiAssistantId ?? null,
        vapiPhoneNumber: (account as any).vapiPhoneNumber ?? null,
        elevenLabsVoiceId: (account as any).elevenLabsVoiceId ?? null,
      };
    }),

  /** Toggle AI voice calling on/off for an account */
  toggleVoiceAgent: protectedProcedure
    .input(
      z.object({
        accountId: z.number(),
        enabled: z.boolean(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Only account owners and platform admins can toggle
      if (ctx.user.role !== "admin") {
        await requireAccountAccess(ctx.user.id, input.accountId, ["owner"]);
      }

      await db.updateAccount(input.accountId, {
        voiceAgentEnabled: input.enabled,
      } as any);

      await db.createAuditLog({
        accountId: input.accountId,
        userId: ctx.user.id,
        action: input.enabled ? "voice_agent.enabled" : "voice_agent.disabled",
        resourceType: "account",
        resourceId: input.accountId,
      });

      return { success: true, enabled: input.enabled };
    }),
});
