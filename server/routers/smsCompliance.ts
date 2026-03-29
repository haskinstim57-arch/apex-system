import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { protectedProcedure, router } from "../_core/trpc";
import { getDb, createAuditLog } from "../db";
import {
  contacts,
  smsOptOuts,
  smsComplianceLogs,
  accountMembers,
} from "../../drizzle/schema";
import { eq, and, desc, sql, like, or, count } from "drizzle-orm";
import {
  processOptOut,
  processOptIn,
} from "../services/smsCompliance";

// ─── Auth helper ───
async function requireAccountMember(userId: number, accountId: number) {
  const db = await getDb();
  if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
  const [member] = await db
    .select()
    .from(accountMembers)
    .where(and(eq(accountMembers.userId, userId), eq(accountMembers.accountId, accountId)));
  if (!member || !member.isActive)
    throw new TRPCError({ code: "FORBIDDEN", message: "Not a member of this account" });
  return member;
}

export const smsComplianceRouter = router({
  /**
   * List opt-outs with search, filter, and pagination
   */
  listOptOuts: protectedProcedure
    .input(
      z.object({
        accountId: z.number(),
        page: z.number().min(1).default(1),
        limit: z.number().min(1).max(100).default(25),
        search: z.string().optional(),
        isActive: z.boolean().optional(),
        source: z.enum(["inbound_sms", "manual", "import", "api"]).optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      await requireAccountMember(ctx.user.id, input.accountId);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const conditions = [eq(smsOptOuts.accountId, input.accountId)];

      if (input.isActive !== undefined) {
        conditions.push(eq(smsOptOuts.isActive, input.isActive));
      }
      if (input.source) {
        conditions.push(eq(smsOptOuts.source, input.source));
      }
      if (input.search) {
        conditions.push(like(smsOptOuts.phone, `%${input.search}%`));
      }

      const [totalResult] = await db
        .select({ count: count() })
        .from(smsOptOuts)
        .where(and(...conditions));

      const total = totalResult?.count ?? 0;
      const offset = (input.page - 1) * input.limit;

      const rows = await db
        .select({
          id: smsOptOuts.id,
          accountId: smsOptOuts.accountId,
          contactId: smsOptOuts.contactId,
          phone: smsOptOuts.phone,
          keyword: smsOptOuts.keyword,
          source: smsOptOuts.source,
          isActive: smsOptOuts.isActive,
          optedInAt: smsOptOuts.optedInAt,
          createdAt: smsOptOuts.createdAt,
        })
        .from(smsOptOuts)
        .where(and(...conditions))
        .orderBy(desc(smsOptOuts.createdAt))
        .limit(input.limit)
        .offset(offset);

      // Fetch contact names for linked records
      const contactIds = rows.filter((r) => r.contactId).map((r) => r.contactId!);
      let contactMap: Record<number, { firstName: string; lastName: string }> = {};
      if (contactIds.length > 0) {
        const contactRows = await db
          .select({
            id: contacts.id,
            firstName: contacts.firstName,
            lastName: contacts.lastName,
          })
          .from(contacts)
          .where(
            and(
              eq(contacts.accountId, input.accountId),
              sql`${contacts.id} IN (${sql.join(contactIds.map((id) => sql`${id}`), sql`, `)})`
            )
          );
        for (const c of contactRows) {
          contactMap[c.id] = { firstName: c.firstName, lastName: c.lastName };
        }
      }

      return {
        optOuts: rows.map((r) => ({
          ...r,
          contactName: r.contactId && contactMap[r.contactId]
            ? `${contactMap[r.contactId].firstName} ${contactMap[r.contactId].lastName}`
            : null,
        })),
        total,
        page: input.page,
        totalPages: Math.ceil(total / input.limit),
      };
    }),

  /**
   * Compliance stats dashboard
   */
  stats: protectedProcedure
    .input(z.object({ accountId: z.number(), periodDays: z.number().min(1).max(365).default(30) }))
    .query(async ({ ctx, input }) => {
      await requireAccountMember(ctx.user.id, input.accountId);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const since = new Date(Date.now() - input.periodDays * 86400000);

      // Active opt-outs count
      const [activeOptOuts] = await db
        .select({ count: count() })
        .from(smsOptOuts)
        .where(and(eq(smsOptOuts.accountId, input.accountId), eq(smsOptOuts.isActive, true)));

      // Total opt-outs ever
      const [totalOptOuts] = await db
        .select({ count: count() })
        .from(smsOptOuts)
        .where(eq(smsOptOuts.accountId, input.accountId));

      // Events in period by type
      const eventCounts = await db
        .select({
          eventType: smsComplianceLogs.eventType,
          count: count(),
        })
        .from(smsComplianceLogs)
        .where(
          and(
            eq(smsComplianceLogs.accountId, input.accountId),
            sql`${smsComplianceLogs.createdAt} >= ${since}`
          )
        )
        .groupBy(smsComplianceLogs.eventType);

      const eventMap: Record<string, number> = {};
      for (const e of eventCounts) {
        eventMap[e.eventType] = e.count;
      }

      // DND contacts count
      const [dndSms] = await db
        .select({ count: count() })
        .from(contacts)
        .where(
          and(
            eq(contacts.accountId, input.accountId),
            or(eq(contacts.dndStatus, "dnd_sms"), eq(contacts.dndStatus, "dnd_all"))
          )
        );

      const [dndEmail] = await db
        .select({ count: count() })
        .from(contacts)
        .where(
          and(
            eq(contacts.accountId, input.accountId),
            or(eq(contacts.dndStatus, "dnd_email"), eq(contacts.dndStatus, "dnd_all"))
          )
        );

      const [totalContacts] = await db
        .select({ count: count() })
        .from(contacts)
        .where(eq(contacts.accountId, input.accountId));

      return {
        activeOptOuts: activeOptOuts?.count ?? 0,
        totalOptOuts: totalOptOuts?.count ?? 0,
        periodDays: input.periodDays,
        events: {
          optOuts: eventMap["opt_out"] || 0,
          optIns: eventMap["opt_in"] || 0,
          helpRequests: eventMap["help_request"] || 0,
          messagesBlocked: eventMap["message_blocked"] || 0,
          autoRepliesSent: eventMap["auto_reply_sent"] || 0,
          manualOptOuts: eventMap["manual_opt_out"] || 0,
          manualOptIns: eventMap["manual_opt_in"] || 0,
          dndSet: eventMap["dnd_set"] || 0,
          dndCleared: eventMap["dnd_cleared"] || 0,
        },
        dnd: {
          smsBlocked: dndSms?.count ?? 0,
          emailBlocked: dndEmail?.count ?? 0,
          totalContacts: totalContacts?.count ?? 0,
        },
      };
    }),

  /**
   * Compliance audit log with pagination
   */
  auditLog: protectedProcedure
    .input(
      z.object({
        accountId: z.number(),
        page: z.number().min(1).default(1),
        limit: z.number().min(1).max(100).default(25),
        eventType: z.string().optional(),
        search: z.string().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      await requireAccountMember(ctx.user.id, input.accountId);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const conditions = [eq(smsComplianceLogs.accountId, input.accountId)];

      if (input.eventType) {
        conditions.push(eq(smsComplianceLogs.eventType, input.eventType as any));
      }
      if (input.search) {
        conditions.push(
          or(
            like(smsComplianceLogs.phone, `%${input.search}%`),
            like(smsComplianceLogs.description, `%${input.search}%`)
          )!
        );
      }

      const [totalResult] = await db
        .select({ count: count() })
        .from(smsComplianceLogs)
        .where(and(...conditions));

      const total = totalResult?.count ?? 0;
      const offset = (input.page - 1) * input.limit;

      const rows = await db
        .select()
        .from(smsComplianceLogs)
        .where(and(...conditions))
        .orderBy(desc(smsComplianceLogs.createdAt))
        .limit(input.limit)
        .offset(offset);

      return {
        logs: rows,
        total,
        page: input.page,
        totalPages: Math.ceil(total / input.limit),
      };
    }),

  /**
   * Manually add a phone to the opt-out list
   */
  manualOptOut: protectedProcedure
    .input(
      z.object({
        accountId: z.number(),
        phone: z.string().min(1),
        contactId: z.number().optional(),
        reason: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await requireAccountMember(ctx.user.id, input.accountId);

      await processOptOut({
        accountId: input.accountId,
        contactId: input.contactId || null,
        phone: input.phone,
        keyword: "MANUAL",
        source: "manual",
      });

      await createAuditLog({
        accountId: input.accountId,
        userId: ctx.user.id,
        action: "sms_compliance.manual_opt_out",
        resourceType: "sms_opt_out",
        metadata: JSON.stringify({ phone: input.phone, contactId: input.contactId, reason: input.reason }),
      });

      return { success: true };
    }),

  /**
   * Manually re-subscribe a phone (opt-in)
   */
  manualOptIn: protectedProcedure
    .input(
      z.object({
        accountId: z.number(),
        phone: z.string().min(1),
        contactId: z.number().optional(),
        reason: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await requireAccountMember(ctx.user.id, input.accountId);

      await processOptIn({
        accountId: input.accountId,
        contactId: input.contactId || null,
        phone: input.phone,
        keyword: "MANUAL",
        source: "manual",
      });

      await createAuditLog({
        accountId: input.accountId,
        userId: ctx.user.id,
        action: "sms_compliance.manual_opt_in",
        resourceType: "sms_opt_out",
        metadata: JSON.stringify({ phone: input.phone, contactId: input.contactId, reason: input.reason }),
      });

      return { success: true };
    }),

  /**
   * Update a contact's DND status directly
   */
  updateContactDnd: protectedProcedure
    .input(
      z.object({
        accountId: z.number(),
        contactId: z.number(),
        dndStatus: z.enum(["active", "dnd_sms", "dnd_email", "dnd_all"]),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await requireAccountMember(ctx.user.id, input.accountId);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const [contact] = await db
        .select({ id: contacts.id, phone: contacts.phone, dndStatus: contacts.dndStatus })
        .from(contacts)
        .where(and(eq(contacts.id, input.contactId), eq(contacts.accountId, input.accountId)));

      if (!contact) throw new TRPCError({ code: "NOT_FOUND", message: "Contact not found" });

      await db
        .update(contacts)
        .set({ dndStatus: input.dndStatus })
        .where(eq(contacts.id, input.contactId));

      await createAuditLog({
        accountId: input.accountId,
        userId: ctx.user.id,
        action: "sms_compliance.update_dnd",
        resourceType: "contact",
        resourceId: input.contactId,
        metadata: JSON.stringify({
          previousDnd: contact.dndStatus,
          newDnd: input.dndStatus,
        }),
      });

      return { success: true, previousDnd: contact.dndStatus, newDnd: input.dndStatus };
    }),

  /**
   * Export opt-out list as CSV
   */
  exportOptOuts: protectedProcedure
    .input(z.object({ accountId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      await requireAccountMember(ctx.user.id, input.accountId);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const rows = await db
        .select({
          phone: smsOptOuts.phone,
          keyword: smsOptOuts.keyword,
          source: smsOptOuts.source,
          isActive: smsOptOuts.isActive,
          optedInAt: smsOptOuts.optedInAt,
          createdAt: smsOptOuts.createdAt,
        })
        .from(smsOptOuts)
        .where(eq(smsOptOuts.accountId, input.accountId))
        .orderBy(desc(smsOptOuts.createdAt));

      // Build CSV
      const headers = ["Phone", "Keyword", "Source", "Status", "Opted Out At", "Opted In At"];
      const csvRows = rows.map((r) => [
        r.phone,
        r.keyword,
        r.source,
        r.isActive ? "Opted Out" : "Opted In",
        r.createdAt ? new Date(r.createdAt).toISOString() : "",
        r.optedInAt ? new Date(r.optedInAt).toISOString() : "",
      ]);

      const csv = [headers.join(","), ...csvRows.map((r) => r.join(","))].join("\n");

      return { csv, count: rows.length };
    }),

  /**
   * Get compliance event types for filter dropdown
   */
  eventTypes: protectedProcedure.query(async () => {
    return [
      { value: "opt_out", label: "Opt-Out (STOP)" },
      { value: "opt_in", label: "Opt-In (START)" },
      { value: "help_request", label: "HELP Request" },
      { value: "dnd_set", label: "DND Set" },
      { value: "dnd_cleared", label: "DND Cleared" },
      { value: "message_blocked", label: "Message Blocked" },
      { value: "auto_reply_sent", label: "Auto-Reply Sent" },
      { value: "manual_opt_out", label: "Manual Opt-Out" },
      { value: "manual_opt_in", label: "Manual Opt-In" },
    ];
  }),
});
