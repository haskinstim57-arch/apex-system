import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { TRPCError } from "@trpc/server";
import { desc, eq, sql, and } from "drizzle-orm";
import {
  messages,
  contacts,
  longFormContent,
  socialPosts,
  sequenceEnrollments,
  sequences,
  aiCalls,
} from "../../drizzle/schema";

/**
 * Dashboard router — provides the AI Activity Feed for the home page.
 * Returns a time-sorted list of recent account activity items.
 */
export const dashboardRouter = router({
  /**
   * getActivityFeed — returns the last N activity items for a sub-account,
   * merged from messages, content, sequence enrollments, and AI calls.
   */
  getActivityFeed: protectedProcedure
    .input(
      z.object({
        accountId: z.number().int().positive(),
        limit: z.number().int().min(1).max(30).default(10),
      })
    )
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];

      const { accountId, limit } = input;

      // 1. Recent messages (sent/delivered/failed) with contact name
      const recentMessages = await db
        .select({
          id: messages.id,
          type: sql<string>`'message'`.as("type"),
          subType: messages.type,
          status: messages.status,
          contactName: sql<string>`COALESCE(CONCAT(${contacts.firstName}, ' ', ${contacts.lastName}), 'Unknown')`,
          description: sql<string>`CASE 
            WHEN ${messages.status} = 'delivered' THEN CONCAT(UPPER(LEFT(${messages.type}, 1)), SUBSTRING(${messages.type}, 2), ' delivered to ', COALESCE(CONCAT(${contacts.firstName}, ' ', ${contacts.lastName}), 'contact'))
            WHEN ${messages.status} = 'sent' THEN CONCAT(UPPER(LEFT(${messages.type}, 1)), SUBSTRING(${messages.type}, 2), ' sent to ', COALESCE(CONCAT(${contacts.firstName}, ' ', ${contacts.lastName}), 'contact'))
            WHEN ${messages.status} = 'failed' THEN CONCAT(UPPER(LEFT(${messages.type}, 1)), SUBSTRING(${messages.type}, 2), ' failed for ', COALESCE(CONCAT(${contacts.firstName}, ' ', ${contacts.lastName}), 'contact'))
            ELSE CONCAT(UPPER(LEFT(${messages.type}, 1)), SUBSTRING(${messages.type}, 2), ' to ', COALESCE(CONCAT(${contacts.firstName}, ' ', ${contacts.lastName}), 'contact'))
          END`,
          createdAt: messages.createdAt,
        })
        .from(messages)
        .leftJoin(contacts, eq(messages.contactId, contacts.id))
        .where(eq(messages.accountId, accountId))
        .orderBy(desc(messages.createdAt))
        .limit(limit);

      // 2. Recent content (blog posts + social posts)
      const recentContent = await db
        .select({
          id: longFormContent.id,
          type: sql<string>`'content'`.as("type"),
          subType: sql<string>`'blog'`,
          status: longFormContent.status,
          contactName: sql<string>`''`,
          description: sql<string>`CONCAT('Blog article created: "', LEFT(${longFormContent.title}, 60), '"')`,
          createdAt: longFormContent.createdAt,
        })
        .from(longFormContent)
        .where(eq(longFormContent.accountId, accountId))
        .orderBy(desc(longFormContent.createdAt))
        .limit(5);

      const recentSocial = await db
        .select({
          id: socialPosts.id,
          type: sql<string>`'content'`.as("type"),
          subType: sql<string>`'social'`,
          status: socialPosts.status,
          contactName: sql<string>`''`,
          description: sql<string>`CONCAT('Social post created for ', ${socialPosts.platform})`,
          createdAt: socialPosts.createdAt,
        })
        .from(socialPosts)
        .where(eq(socialPosts.accountId, accountId))
        .orderBy(desc(socialPosts.createdAt))
        .limit(5);

      // 3. Recent sequence enrollments
      const recentEnrollments = await db
        .select({
          id: sequenceEnrollments.id,
          type: sql<string>`'enrollment'`.as("type"),
          subType: sql<string>`'sequence'`,
          status: sequenceEnrollments.status,
          contactName: sql<string>`COALESCE(CONCAT(${contacts.firstName}, ' ', ${contacts.lastName}), 'Unknown')`,
          description: sql<string>`CONCAT(COALESCE(CONCAT(${contacts.firstName}, ' ', ${contacts.lastName}), 'Contact'), ' enrolled in "', ${sequences.name}, '"')`,
          createdAt: sequenceEnrollments.enrolledAt,
        })
        .from(sequenceEnrollments)
        .leftJoin(contacts, eq(sequenceEnrollments.contactId, contacts.id))
        .leftJoin(sequences, eq(sequenceEnrollments.sequenceId, sequences.id))
        .where(eq(sequenceEnrollments.accountId, accountId))
        .orderBy(desc(sequenceEnrollments.enrolledAt))
        .limit(5);

      // 4. Recent AI calls
      const recentCalls = await db
        .select({
          id: aiCalls.id,
          type: sql<string>`'call'`.as("type"),
          subType: sql<string>`'ai_call'`,
          status: aiCalls.status,
          contactName: sql<string>`COALESCE(CONCAT(${contacts.firstName}, ' ', ${contacts.lastName}), 'Unknown')`,
          description: sql<string>`CONCAT('AI call ', ${aiCalls.status}, ' with ', COALESCE(CONCAT(${contacts.firstName}, ' ', ${contacts.lastName}), 'contact'))`,
          createdAt: aiCalls.createdAt,
        })
        .from(aiCalls)
        .leftJoin(contacts, eq(aiCalls.contactId, contacts.id))
        .where(eq(aiCalls.accountId, accountId))
        .orderBy(desc(aiCalls.createdAt))
        .limit(5);

      // Merge all items, sort by createdAt desc, take top N
      const allItems = [
        ...recentMessages,
        ...recentContent,
        ...recentSocial,
        ...recentEnrollments,
        ...recentCalls,
      ];

      allItems.sort((a, b) => {
        const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return bTime - aTime;
      });

      return allItems.slice(0, limit);
    }),
});
