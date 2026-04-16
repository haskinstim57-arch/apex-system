import { TRPCError } from "@trpc/server";
import { z } from "zod";
import {
  protectedProcedure,
  adminProcedure,
  router,
} from "../_core/trpc";
import { supportTickets } from "../../drizzle/schema";
import { eq, and, desc } from "drizzle-orm";
import { sendEmail } from "../services/sendgrid";
import * as dbHelpers from "../db";
import { getDb } from "../db";

export const supportRouter = router({
  /** Submit a new support ticket */
  submit: protectedProcedure
    .input(
      z.object({
        accountId: z.number().int().positive(),
        subject: z.string().min(1).max(500),
        category: z.enum(["bug", "feature", "billing", "general"]),
        message: z.string().min(1).max(5000),
        screenshotUrl: z.string().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      // Verify user is a member of this account
      const member = await dbHelpers.getMember(input.accountId, ctx.user.id);
      if (!member || !member.isActive) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You do not have access to this account.",
        });
      }

      // Get account info for the email
      const account = await dbHelpers.getAccountById(input.accountId);

      // Insert the ticket
      const db = await getDb();
      const [result] = await db!.insert(supportTickets).values({
        accountId: input.accountId,
        userId: ctx.user.id,
        subject: input.subject,
        category: input.category,
        message: input.message,
        screenshotUrl: input.screenshotUrl || null,
        status: "open",
      });

      const ticketId = result.insertId;

      // Send email notification to agency admin
      const categoryLabels: Record<string, string> = {
        bug: "Bug Report",
        feature: "Feature Request",
        billing: "Billing Question",
        general: "General",
      };

      try {
        // Get the OWNER email (agency admin)
        const ownerEmail = process.env.SENDGRID_FROM_EMAIL;
        if (ownerEmail) {
          await sendEmail({
            to: ownerEmail,
            subject: `[Support Ticket #${ticketId}] ${input.subject}`,
            body: [
              `New support ticket submitted:`,
              ``,
              `Ticket ID: #${ticketId}`,
              `Account: ${account?.name || `ID ${input.accountId}`}`,
              `Submitted by: ${ctx.user.name || ctx.user.email || `User #${ctx.user.id}`}`,
              `Category: ${categoryLabels[input.category] || input.category}`,
              `Subject: ${input.subject}`,
              ``,
              `Message:`,
              input.message,
              ``,
              input.screenshotUrl ? `Screenshot: ${input.screenshotUrl}` : "",
              ``,
              `Log in to the admin panel to respond.`,
            ]
              .filter(Boolean)
              .join("\n"),
          });
        }
      } catch (err) {
        // Don't fail the ticket creation if email fails
        console.error("[Support] Failed to send notification email:", err);
      }

      return { ticketId, success: true };
    }),

  /** List tickets for the current user in an account */
  list: protectedProcedure
    .input(
      z.object({
        accountId: z.number().int().positive(),
      })
    )
    .query(async ({ input, ctx }) => {
      // Verify membership
      const member = await dbHelpers.getMember(input.accountId, ctx.user.id);
      if (!member || !member.isActive) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You do not have access to this account.",
        });
      }

      // Regular users see only their own tickets; owners/managers see all account tickets
      const isManager = ["owner", "manager"].includes(member.role);

      const db = await getDb();
      const tickets = await db!
        .select()
        .from(supportTickets)
        .where(
          isManager
            ? eq(supportTickets.accountId, input.accountId)
            : and(
                eq(supportTickets.accountId, input.accountId),
                eq(supportTickets.userId, ctx.user.id)
              )
        )
        .orderBy(desc(supportTickets.createdAt));

      return tickets;
    }),

  /** Admin: list all tickets across all accounts */
  listAll: adminProcedure
    .input(
      z.object({
        status: z.enum(["open", "in_progress", "resolved", "closed"]).optional(),
      }).optional()
    )
    .query(async ({ input }) => {
      const conditions = input?.status
        ? eq(supportTickets.status, input.status)
        : undefined;

      const db = await getDb();
      const tickets = await db!
        .select()
        .from(supportTickets)
        .where(conditions)
        .orderBy(desc(supportTickets.createdAt));

      return tickets;
    }),

  /** Admin/Owner: update ticket status */
  updateStatus: protectedProcedure
    .input(
      z.object({
        ticketId: z.number().int().positive(),
        status: z.enum(["open", "in_progress", "resolved", "closed"]),
        adminNotes: z.string().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      // Get the ticket first
      const db = await getDb();
      const [ticket] = await db!
        .select()
        .from(supportTickets)
        .where(eq(supportTickets.id, input.ticketId));

      if (!ticket) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Ticket not found." });
      }

      // Only admin or account owner/manager can update status
      if (ctx.user.role !== "admin") {
        const member = await dbHelpers.getMember(ticket.accountId, ctx.user.id);
        if (!member || !["owner", "manager"].includes(member.role)) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "Only admins and account managers can update ticket status.",
          });
        }
      }

      await db!
        .update(supportTickets)
        .set({
          status: input.status,
          ...(input.adminNotes !== undefined ? { adminNotes: input.adminNotes } : {}),
        })
        .where(eq(supportTickets.id, input.ticketId));

      return { success: true };
    }),
});
