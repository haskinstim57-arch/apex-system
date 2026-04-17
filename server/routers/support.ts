import { TRPCError } from "@trpc/server";
import { z } from "zod";
import {
  protectedProcedure,
  adminProcedure,
  router,
} from "../_core/trpc";
import { supportTickets, supportTicketReplies } from "../../drizzle/schema";
import { eq, and, desc } from "drizzle-orm";
import * as dbHelpers from "../db";
import { getDb } from "../db";
import { notifyNewTicket, notifyClientReply, notifyStaffReply } from "../services/supportNotifications";
import { getUserById } from "../db";

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

      // Send email notification to configured admin emails
      try {
        await notifyNewTicket({
          ticketId,
          subject: input.subject,
          category: input.category,
          message: input.message,
          accountName: account?.name || `Account #${input.accountId}`,
          submitterName: ctx.user.name || "Unknown",
          submitterEmail: ctx.user.email || "",
        });
      } catch (err) {
        // Don't fail the ticket creation if email fails
        console.error("[Support] Failed to send notification email:", err);
      }

      return { ticketId, success: true };
    }),

  /** Reply to a support ticket */
  reply: protectedProcedure
    .input(
      z.object({
        ticketId: z.number().int().positive(),
        body: z.string().min(1).max(5000),
        authorType: z.enum(["client", "apex_staff"]),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();

      // Get the ticket
      const [ticket] = await db!
        .select()
        .from(supportTickets)
        .where(eq(supportTickets.id, input.ticketId));

      if (!ticket) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Ticket not found." });
      }

      // Verify access: admin can reply as apex_staff, account members can reply as client
      if (input.authorType === "apex_staff") {
        if (ctx.user.role !== "admin") {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "Only admins can reply as Apex staff.",
          });
        }
      } else {
        // Client reply — verify membership
        const member = await dbHelpers.getMember(ticket.accountId, ctx.user.id);
        if (!member || !member.isActive) {
          // Also allow admin to reply as client (for testing)
          if (ctx.user.role !== "admin") {
            throw new TRPCError({
              code: "FORBIDDEN",
              message: "You do not have access to this ticket.",
            });
          }
        }
      }

      // Insert the reply
      const [result] = await db!.insert(supportTicketReplies).values({
        ticketId: input.ticketId,
        userId: ctx.user.id,
        authorType: input.authorType,
        body: input.body,
      });

      // If ticket was resolved/closed and client replies, reopen it
      if (input.authorType === "client" && ["resolved", "closed"].includes(ticket.status)) {
        await db!
          .update(supportTickets)
          .set({ status: "open" })
          .where(eq(supportTickets.id, input.ticketId));
      }

      // Send email notifications based on who replied
      if (input.authorType === "client") {
        // Client replied → notify admin list
        try {
          const account = await dbHelpers.getAccountById(ticket.accountId);
          await notifyClientReply({
            ticketId: ticket.id,
            ticketSubject: ticket.subject,
            replyBody: input.body,
            accountName: account?.name || `Account #${ticket.accountId}`,
            replierName: ctx.user.name || "Unknown",
          });
        } catch (err) {
          console.error("[Support] Failed to send client reply notification:", err);
        }
      } else if (input.authorType === "apex_staff") {
        // Staff replied → notify the ticket submitter (client)
        try {
          const ticketOwner = await getUserById(ticket.userId);
          if (ticketOwner?.email) {
            await notifyStaffReply({
              ticketId: ticket.id,
              ticketSubject: ticket.subject,
              replyBody: input.body,
              staffName: ctx.user.name || "Apex Support",
              clientEmail: ticketOwner.email,
              clientName: ticketOwner.name || "there",
            });
          }
        } catch (err) {
          console.error("[Support] Failed to send staff reply notification:", err);
        }
      }

      return { replyId: result.insertId, success: true };
    }),

  /** Get a single ticket by ID (with replies) */
  getById: protectedProcedure
    .input(
      z.object({
        ticketId: z.number().int().positive(),
      })
    )
    .query(async ({ input, ctx }) => {
      const db = await getDb();

      const [ticket] = await db!
        .select()
        .from(supportTickets)
        .where(eq(supportTickets.id, input.ticketId));

      if (!ticket) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Ticket not found." });
      }

      // Verify access: admin or account member
      if (ctx.user.role !== "admin") {
        const member = await dbHelpers.getMember(ticket.accountId, ctx.user.id);
        if (!member || !member.isActive) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "You do not have access to this ticket.",
          });
        }
      }

      // Get submitter info
      const submitter = await getUserById(ticket.userId);

      // Get all replies
      const replies = await db!
        .select()
        .from(supportTicketReplies)
        .where(eq(supportTicketReplies.ticketId, input.ticketId))
        .orderBy(supportTicketReplies.createdAt);

      return {
        ...ticket,
        submitterName: submitter?.name || "Unknown",
        submitterEmail: submitter?.email || "",
        replies,
      };
    }),

  /** List replies for a ticket */
  listReplies: protectedProcedure
    .input(
      z.object({
        ticketId: z.number().int().positive(),
      })
    )
    .query(async ({ input, ctx }) => {
      const db = await getDb();

      // Get the ticket to verify access
      const [ticket] = await db!
        .select()
        .from(supportTickets)
        .where(eq(supportTickets.id, input.ticketId));

      if (!ticket) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Ticket not found." });
      }

      // Verify access: admin or account member
      if (ctx.user.role !== "admin") {
        const member = await dbHelpers.getMember(ticket.accountId, ctx.user.id);
        if (!member || !member.isActive) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "You do not have access to this ticket.",
          });
        }
      }

      const replies = await db!
        .select()
        .from(supportTicketReplies)
        .where(eq(supportTicketReplies.ticketId, input.ticketId))
        .orderBy(supportTicketReplies.createdAt);

      return replies;
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
