import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { eq, and, or, sql, inArray, isNull } from "drizzle-orm";
import { protectedProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { requireAccountMember } from "./contacts";
import {
  contacts,
  contactTags,
  contactNotes,
  messages,
  campaignRecipients,
  aiCalls,
  workflowExecutions,
  tasks,
  deals,
  appointments,
  contactActivities,
  formSubmissions,
  reviewRequests,
  reviews,
  dialerSessions,
  jarvisTaskQueue,
  sequenceEnrollments,
  leadScoreHistory,
  invoices,
  smsOptOuts,
  smsComplianceLogs,
  queuedMessages,
  emailDrafts,
  auditLogs,
} from "../../drizzle/schema";

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

interface DuplicateGroup {
  key: string; // e.g. "email:john@example.com" or "phone:+15551234567"
  matchType: "email" | "phone";
  matchValue: string;
  contacts: {
    id: number;
    firstName: string;
    lastName: string;
    email: string | null;
    phone: string | null;
    leadSource: string | null;
    status: string;
    company: string | null;
    createdAt: Date;
    updatedAt: Date;
  }[];
  score: number; // 100 = exact email match, 80 = exact phone match
}

// ─────────────────────────────────────────────
// Router
// ─────────────────────────────────────────────

export const contactMergeRouter = router({
  /**
   * Scan for duplicate contacts within the active account.
   * Groups contacts by matching email or phone.
   * Excludes soft-deleted contacts.
   */
  findDuplicates: protectedProcedure
    .input(
      z.object({
        accountId: z.number().int().positive(),
        matchBy: z
          .enum(["email", "phone", "both"])
          .default("both")
          .optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      await requireAccountMember(ctx.user.id, input.accountId, ctx.user.role);
      const accountId = input.accountId;
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });

      const matchBy = input?.matchBy ?? "both";

      // Get all non-deleted contacts for this account
      const allContacts = await db
        .select({
          id: contacts.id,
          firstName: contacts.firstName,
          lastName: contacts.lastName,
          email: contacts.email,
          phone: contacts.phone,
          leadSource: contacts.leadSource,
          status: contacts.status,
          company: contacts.company,
          title: contacts.title,
          address: contacts.address,
          city: contacts.city,
          state: contacts.state,
          zip: contacts.zip,
          dateOfBirth: contacts.dateOfBirth,
          customFields: contacts.customFields,
          assignedUserId: contacts.assignedUserId,
          createdAt: contacts.createdAt,
          updatedAt: contacts.updatedAt,
        })
        .from(contacts)
        .where(
          and(
            eq(contacts.accountId, accountId),
            isNull(contacts.deletedAt)
          )
        );

      const groups: Map<string, DuplicateGroup> = new Map();

      // Group by email
      if (matchBy === "email" || matchBy === "both") {
        const emailMap = new Map<string, typeof allContacts>();
        for (const c of allContacts) {
          if (!c.email) continue;
          const normalizedEmail = c.email.toLowerCase().trim();
          if (!emailMap.has(normalizedEmail)) {
            emailMap.set(normalizedEmail, []);
          }
          emailMap.get(normalizedEmail)!.push(c);
        }
        for (const [email, contactList] of Array.from(emailMap.entries())) {
          if (contactList.length < 2) continue;
          const key = `email:${email}`;
          groups.set(key, {
            key,
            matchType: "email",
            matchValue: email,
            contacts: contactList.map((c: any) => ({
              id: c.id,
              firstName: c.firstName,
              lastName: c.lastName,
              email: c.email,
              phone: c.phone,
              leadSource: c.leadSource,
              status: c.status,
              company: c.company,
              createdAt: c.createdAt,
              updatedAt: c.updatedAt,
            })),
            score: 100, // Exact email match = highest confidence
          });
        }
      }

      // Group by phone
      if (matchBy === "phone" || matchBy === "both") {
        const phoneMap = new Map<string, typeof allContacts>();
        for (const c of allContacts) {
          if (!c.phone) continue;
          // Normalize phone: strip all non-digits
          const normalizedPhone = c.phone.replace(/\D/g, "");
          if (normalizedPhone.length < 7) continue; // Skip too-short numbers
          if (!phoneMap.has(normalizedPhone)) {
            phoneMap.set(normalizedPhone, []);
          }
          phoneMap.get(normalizedPhone)!.push(c);
        }
        for (const [phone, contactList] of Array.from(phoneMap.entries())) {
          if (contactList.length < 2) continue;
          const key = `phone:${phone}`;
          // Don't add if already grouped by email (same contacts)
          if (!groups.has(key)) {
            groups.set(key, {
              key,
              matchType: "phone",
              matchValue: phone,
              contacts: contactList.map((c: any) => ({
                id: c.id,
                firstName: c.firstName,
                lastName: c.lastName,
                email: c.email,
                phone: c.phone,
                leadSource: c.leadSource,
                status: c.status,
                company: c.company,
                createdAt: c.createdAt,
                updatedAt: c.updatedAt,
              })),
              score: 80, // Phone match = high confidence
            });
          }
        }
      }

      // Sort by score descending, then by number of duplicates
      const result = Array.from(groups.values()).sort(
        (a, b) => b.score - a.score || b.contacts.length - a.contacts.length
      );

      return {
        totalGroups: result.length,
        totalDuplicates: result.reduce((sum, g) => sum + g.contacts.length - 1, 0),
        groups: result,
      };
    }),

  /**
   * Get detailed info for a merge preview (related record counts for each contact)
   */
  mergePreview: protectedProcedure
    .input(
      z.object({
        accountId: z.number().int().positive(),
        contactIds: z.array(z.number()).min(2).max(10),
      })
    )
    .query(async ({ ctx, input }) => {
      await requireAccountMember(ctx.user.id, input.accountId, ctx.user.role);
      const accountId = input.accountId;
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });

      const contactList = await db
        .select()
        .from(contacts)
        .where(
          and(
            eq(contacts.accountId, accountId),
            inArray(contacts.id, input.contactIds),
            isNull(contacts.deletedAt)
          )
        );

      if (contactList.length !== input.contactIds.length) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Some contacts not found or not in your account",
        });
      }

      // Get related record counts for each contact
      const previews = await Promise.all(
        contactList.map(async (c: any) => {
          const [
            tagsCount,
            notesCount,
            messagesCount,
            campaignsCount,
            callsCount,
            workflowsCount,
            tasksCount,
            dealsCount,
            appointmentsCount,
            activitiesCount,
            submissionsCount,
            reviewReqCount,
            reviewsCount,
          ] = await Promise.all([
            db.select({ count: sql<number>`count(*)` }).from(contactTags).where(eq(contactTags.contactId, c.id)),
            db.select({ count: sql<number>`count(*)` }).from(contactNotes).where(eq(contactNotes.contactId, c.id)),
            db.select({ count: sql<number>`count(*)` }).from(messages).where(eq(messages.contactId, c.id)),
            db.select({ count: sql<number>`count(*)` }).from(campaignRecipients).where(eq(campaignRecipients.contactId, c.id)),
            db.select({ count: sql<number>`count(*)` }).from(aiCalls).where(eq(aiCalls.contactId, c.id)),
            db.select({ count: sql<number>`count(*)` }).from(workflowExecutions).where(eq(workflowExecutions.contactId, c.id)),
            db.select({ count: sql<number>`count(*)` }).from(tasks).where(eq(tasks.contactId, c.id)),
            db.select({ count: sql<number>`count(*)` }).from(deals).where(eq(deals.contactId, c.id)),
            db.select({ count: sql<number>`count(*)` }).from(appointments).where(eq(appointments.contactId, c.id)),
            db.select({ count: sql<number>`count(*)` }).from(contactActivities).where(eq(contactActivities.contactId, c.id)),
            db.select({ count: sql<number>`count(*)` }).from(formSubmissions).where(eq(formSubmissions.contactId, c.id)),
            db.select({ count: sql<number>`count(*)` }).from(reviewRequests).where(eq(reviewRequests.contactId, c.id)),
            db.select({ count: sql<number>`count(*)` }).from(reviews).where(eq(reviews.contactId, c.id)),
          ]);

          return {
            contact: c,
            relatedCounts: {
              tags: Number(tagsCount[0]?.count ?? 0),
              notes: Number(notesCount[0]?.count ?? 0),
              messages: Number(messagesCount[0]?.count ?? 0),
              campaigns: Number(campaignsCount[0]?.count ?? 0),
              calls: Number(callsCount[0]?.count ?? 0),
              workflows: Number(workflowsCount[0]?.count ?? 0),
              tasks: Number(tasksCount[0]?.count ?? 0),
              deals: Number(dealsCount[0]?.count ?? 0),
              appointments: Number(appointmentsCount[0]?.count ?? 0),
              activities: Number(activitiesCount[0]?.count ?? 0),
              submissions: Number(submissionsCount[0]?.count ?? 0),
              reviewRequests: Number(reviewReqCount[0]?.count ?? 0),
              reviews: Number(reviewsCount[0]?.count ?? 0),
            },
            totalRelated:
              Number(tagsCount[0]?.count ?? 0) +
              Number(notesCount[0]?.count ?? 0) +
              Number(messagesCount[0]?.count ?? 0) +
              Number(campaignsCount[0]?.count ?? 0) +
              Number(callsCount[0]?.count ?? 0) +
              Number(workflowsCount[0]?.count ?? 0) +
              Number(tasksCount[0]?.count ?? 0) +
              Number(dealsCount[0]?.count ?? 0) +
              Number(appointmentsCount[0]?.count ?? 0) +
              Number(activitiesCount[0]?.count ?? 0) +
              Number(submissionsCount[0]?.count ?? 0) +
              Number(reviewReqCount[0]?.count ?? 0) +
              Number(reviewsCount[0]?.count ?? 0),
          };
        })
      );

      return { previews };
    }),

  /**
   * Merge contacts: keep the winner, reassign all related records from losers,
   * SOFT-DELETE losers (set deletedAt), and create an audit log entry.
   * Field overrides let the user pick which value to keep for each field.
   */
  merge: protectedProcedure
    .input(
      z.object({
        accountId: z.number().int().positive(),
        winnerId: z.number(),
        loserIds: z.array(z.number()).min(1).max(9),
        /** Optional field overrides: pick specific values from any contact */
        fieldOverrides: z
          .object({
            firstName: z.string().optional(),
            lastName: z.string().optional(),
            email: z.string().nullable().optional(),
            phone: z.string().nullable().optional(),
            leadSource: z.string().nullable().optional(),
            status: z.string().optional(),
            company: z.string().nullable().optional(),
            title: z.string().nullable().optional(),
            address: z.string().nullable().optional(),
            city: z.string().nullable().optional(),
            state: z.string().nullable().optional(),
            zip: z.string().nullable().optional(),
            assignedUserId: z.number().nullable().optional(),
          })
          .optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await requireAccountMember(ctx.user.id, input.accountId, ctx.user.role);
      const accountId = input.accountId;
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });

      const { winnerId, loserIds, fieldOverrides } = input;
      const userId = ctx.user?.id ?? null;

      // Validate winner and losers belong to the account and are not deleted
      const allIds = [winnerId, ...loserIds];
      const found = await db
        .select({ id: contacts.id, customFields: contacts.customFields, firstName: contacts.firstName, lastName: contacts.lastName })
        .from(contacts)
        .where(
          and(
            eq(contacts.accountId, accountId),
            inArray(contacts.id, allIds),
            isNull(contacts.deletedAt)
          )
        );

      if (found.length !== allIds.length) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Some contacts not found, already deleted, or not in your account",
        });
      }

      // Ensure winner and losers are different
      if (loserIds.includes(winnerId)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Winner cannot be in the loser list",
        });
      }

      const winnerRecord = found.find((c) => c.id === winnerId);
      const loserRecords = found.filter((c) => c.id !== winnerId);

      // ── 1. Merge custom fields (winner priority, fill gaps from losers) ──
      let mergedCustomFields: Record<string, unknown> = {};
      try {
        // Start with loser fields (oldest first so newer losers override older)
        for (const loserId of loserIds) {
          const loser = found.find((c) => c.id === loserId);
          if (loser?.customFields) {
            const parsed = JSON.parse(loser.customFields);
            if (typeof parsed === "object" && parsed !== null) {
              mergedCustomFields = { ...mergedCustomFields, ...parsed };
            }
          }
        }
        // Winner fields override everything
        if (winnerRecord?.customFields) {
          const parsed = JSON.parse(winnerRecord.customFields);
          if (typeof parsed === "object" && parsed !== null) {
            mergedCustomFields = { ...mergedCustomFields, ...parsed };
          }
        }
      } catch {
        // If parsing fails, just keep winner's custom fields
      }

      // ── 2. Update winner contact with field overrides + merged custom fields ──
      const updateData: Record<string, unknown> = {};
      if (fieldOverrides) {
        for (const [key, value] of Object.entries(fieldOverrides)) {
          if (value !== undefined) {
            updateData[key] = value;
          }
        }
      }
      updateData.customFields = JSON.stringify(mergedCustomFields);

      if (Object.keys(updateData).length > 0) {
        await db
          .update(contacts)
          .set(updateData)
          .where(eq(contacts.id, winnerId));
      }

      // ── 3. Reassign all related records from losers to winner ──
      const reassignedCounts: Record<string, number> = {};

      for (const loserId of loserIds) {
        // ─── Contact Tags — deduplicate: get winner's existing tags, only move non-duplicate ───
        const winnerTags = await db
          .select({ tag: contactTags.tag })
          .from(contactTags)
          .where(eq(contactTags.contactId, winnerId));
        const winnerTagSet = new Set<string>(winnerTags.map((t: { tag: string }) => t.tag));

        const loserTags = await db
          .select({ id: contactTags.id, tag: contactTags.tag })
          .from(contactTags)
          .where(eq(contactTags.contactId, loserId));

        for (const lt of loserTags) {
          if (winnerTagSet.has(lt.tag)) {
            // Duplicate tag — delete it
            await db.delete(contactTags).where(eq(contactTags.id, lt.id));
          } else {
            // Move to winner
            await db
              .update(contactTags)
              .set({ contactId: winnerId })
              .where(eq(contactTags.id, lt.id));
            winnerTagSet.add(lt.tag);
          }
        }
        reassignedCounts.tags = (reassignedCounts.tags ?? 0) + loserTags.length;

        // ─── Contact Notes ───
        const notesResult = await db
          .update(contactNotes)
          .set({ contactId: winnerId })
          .where(eq(contactNotes.contactId, loserId));
        reassignedCounts.notes = (reassignedCounts.notes ?? 0) + (notesResult[0]?.affectedRows ?? 0);

        // ─── Messages ───
        const msgsResult = await db
          .update(messages)
          .set({ contactId: winnerId })
          .where(eq(messages.contactId, loserId));
        reassignedCounts.messages = (reassignedCounts.messages ?? 0) + (msgsResult[0]?.affectedRows ?? 0);

        // ─── Campaign Recipients ───
        await db
          .update(campaignRecipients)
          .set({ contactId: winnerId })
          .where(eq(campaignRecipients.contactId, loserId));

        // ─── AI Calls ───
        const callsResult = await db
          .update(aiCalls)
          .set({ contactId: winnerId })
          .where(eq(aiCalls.contactId, loserId));
        reassignedCounts.calls = (reassignedCounts.calls ?? 0) + (callsResult[0]?.affectedRows ?? 0);

        // ─── Workflow Executions ───
        await db
          .update(workflowExecutions)
          .set({ contactId: winnerId })
          .where(eq(workflowExecutions.contactId, loserId));

        // ─── Tasks ───
        await db
          .update(tasks)
          .set({ contactId: winnerId })
          .where(eq(tasks.contactId, loserId));

        // ─── Deals ───
        const dealsResult = await db
          .update(deals)
          .set({ contactId: winnerId })
          .where(eq(deals.contactId, loserId));
        reassignedCounts.deals = (reassignedCounts.deals ?? 0) + (dealsResult[0]?.affectedRows ?? 0);

        // ─── Appointments ───
        await db
          .update(appointments)
          .set({ contactId: winnerId })
          .where(eq(appointments.contactId, loserId));

        // ─── Contact Activities ───
        await db
          .update(contactActivities)
          .set({ contactId: winnerId })
          .where(eq(contactActivities.contactId, loserId));

        // ─── Form Submissions ───
        await db
          .update(formSubmissions)
          .set({ contactId: winnerId })
          .where(eq(formSubmissions.contactId, loserId));

        // ─── Review Requests ───
        await db
          .update(reviewRequests)
          .set({ contactId: winnerId })
          .where(eq(reviewRequests.contactId, loserId));

        // ─── Reviews ───
        await db
          .update(reviews)
          .set({ contactId: winnerId })
          .where(eq(reviews.contactId, loserId));

        // ─── Jarvis Task Queue ───
        await db
          .update(jarvisTaskQueue)
          .set({ contactId: winnerId })
          .where(eq(jarvisTaskQueue.contactId, loserId));

        // ─── Sequence Enrollments ───
        await db
          .update(sequenceEnrollments)
          .set({ contactId: winnerId })
          .where(eq(sequenceEnrollments.contactId, loserId));

        // ─── Lead Score History ───
        await db
          .update(leadScoreHistory)
          .set({ contactId: winnerId })
          .where(eq(leadScoreHistory.contactId, loserId));

        // ─── Invoices ───
        await db
          .update(invoices)
          .set({ contactId: winnerId })
          .where(eq(invoices.contactId, loserId));

        // ─── SMS Opt-Outs (nullable contactId) ───
        await db
          .update(smsOptOuts)
          .set({ contactId: winnerId })
          .where(eq(smsOptOuts.contactId, loserId));

        // ─── SMS Compliance Logs (nullable contactId) ───
        await db
          .update(smsComplianceLogs)
          .set({ contactId: winnerId })
          .where(eq(smsComplianceLogs.contactId, loserId));

        // ─── Queued Messages (nullable contactId) ───
        await db
          .update(queuedMessages)
          .set({ contactId: winnerId })
          .where(eq(queuedMessages.contactId, loserId));

        // ─── Email Drafts (nullable contactId) ───
        await db
          .update(emailDrafts)
          .set({ contactId: winnerId })
          .where(eq(emailDrafts.contactId, loserId));

        // ─── Dialer Sessions — update contactIds JSON array ───
        const allSessions = await db
          .select({ id: dialerSessions.id, contactIds: dialerSessions.contactIds })
          .from(dialerSessions)
          .where(eq(dialerSessions.accountId, accountId));

        for (const session of allSessions) {
          try {
            const ids: number[] = JSON.parse(session.contactIds);
            if (ids.includes(loserId)) {
              const updatedIds = ids.map((id) => (id === loserId ? winnerId : id));
              // Deduplicate
              const uniqueIds = Array.from(new Set(updatedIds));
              await db
                .update(dialerSessions)
                .set({ contactIds: JSON.stringify(uniqueIds) })
                .where(eq(dialerSessions.id, session.id));
            }
          } catch {
            // Skip malformed JSON
          }
        }

        // ── 4. Log merge activity on the winner's timeline ──
        const loserInfo = loserRecords.find((r) => r.id === loserId);
        await db.insert(contactActivities).values({
          contactId: winnerId,
          accountId,
          activityType: "note_added",
          description: `Contact merged: #${loserId} (${loserInfo?.firstName ?? ""} ${loserInfo?.lastName ?? ""}) merged into this contact. All records reassigned.`,
          createdAt: new Date(),
        });

        // ── 5. SOFT-DELETE loser contact (set deletedAt instead of hard delete) ──
        await db
          .update(contacts)
          .set({ deletedAt: new Date() })
          .where(eq(contacts.id, loserId));
      }

      // ── 6. Create audit log entry for the merge ──
      const loserNames = loserRecords.map((r) => `#${r.id} (${r.firstName} ${r.lastName})`).join(", ");
      await db.insert(auditLogs).values({
        accountId,
        userId,
        action: "contact_merge",
        resourceType: "contact",
        resourceId: winnerId,
        metadata: JSON.stringify({
          winnerId,
          loserIds,
          loserNames,
          fieldOverrides: fieldOverrides ?? {},
          reassignedCounts,
          mergedAt: new Date().toISOString(),
        }),
        createdAt: new Date(),
      });

      return {
        success: true,
        winnerId,
        mergedCount: loserIds.length,
        message: `Successfully merged ${loserIds.length} contact(s) into #${winnerId} (${winnerRecord?.firstName} ${winnerRecord?.lastName}). Source contacts soft-deleted.`,
      };
    }),
});
