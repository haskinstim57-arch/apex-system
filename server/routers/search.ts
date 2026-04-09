import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { getDb } from "../db";
import { requireAccountMember } from "./contacts";
import {
  contacts,
  campaigns,
  sequences,
  longFormContent,
  deals,
  pipelineStages,
} from "../../drizzle/schema";
import { eq, and, or, like, sql } from "drizzle-orm";

export const searchRouter = router({
  global: protectedProcedure
    .input(
      z.object({
        query: z.string().min(1).max(100),
        accountId: z.number().int().positive(),
        limit: z.number().int().min(1).max(10).default(5),
      })
    )
    .query(async ({ ctx, input }) => {
      const { query, accountId, limit } = input;
      await requireAccountMember(ctx.user.id, accountId, ctx.user.role);

      const db = await getDb();
      if (!db) {
        return {
          contacts: [],
          campaigns: [],
          sequences: [],
          content: [],
          deals: [],
          total: 0,
        };
      }

      const q = `%${query}%`;

      const [
        contactResults,
        campaignResults,
        sequenceResults,
        contentResults,
        dealResults,
      ] = await Promise.all([
        // Contacts: search name, email, phone
        db
          .select({
            id: contacts.id,
            title: sql<string>`CONCAT(${contacts.firstName}, ' ', ${contacts.lastName})`,
            subtitle: contacts.email,
            extra: contacts.phone,
          })
          .from(contacts)
          .where(
            and(
              eq(contacts.accountId, accountId),
              or(
                like(contacts.firstName, q),
                like(contacts.lastName, q),
                like(contacts.email, q),
                like(contacts.phone, q),
                like(
                  sql`CONCAT(${contacts.firstName}, ' ', ${contacts.lastName})`,
                  q
                )
              )
            )
          )
          .limit(limit),

        // Campaigns: search name, subject
        db
          .select({
            id: campaigns.id,
            title: campaigns.name,
            subtitle: campaigns.subject,
            extra: campaigns.status,
          })
          .from(campaigns)
          .where(
            and(
              eq(campaigns.accountId, accountId),
              or(like(campaigns.name, q), like(campaigns.subject, q))
            )
          )
          .limit(limit),

        // Sequences: search name
        db
          .select({
            id: sequences.id,
            title: sequences.name,
            subtitle: sequences.status,
            extra: sql<string>`NULL`,
          })
          .from(sequences)
          .where(
            and(eq(sequences.accountId, accountId), like(sequences.name, q))
          )
          .limit(limit),

        // Content (long-form): search title/topic
        db
          .select({
            id: longFormContent.id,
            title: longFormContent.title,
            subtitle: longFormContent.status,
            extra: sql<string>`'blog'`,
          })
          .from(longFormContent)
          .where(
            and(
              eq(longFormContent.accountId, accountId),
              or(
                like(longFormContent.title, q),
                like(longFormContent.topic, q)
              )
            )
          )
          .limit(limit),

        // Deals: search title, join pipeline_stages for stage name
        db
          .select({
            id: deals.id,
            title: deals.title,
            subtitle: pipelineStages.name,
            extra: sql<string>`CONCAT('$', ${deals.value})`,
          })
          .from(deals)
          .leftJoin(pipelineStages, eq(deals.stageId, pipelineStages.id))
          .where(
            and(eq(deals.accountId, accountId), like(deals.title, q))
          )
          .limit(limit),
      ]);

      return {
        contacts: contactResults.map((r) => ({
          ...r,
          type: "contact" as const,
          path: `/contacts/${r.id}?account=${accountId}`,
        })),
        campaigns: campaignResults.map((r) => ({
          ...r,
          type: "campaign" as const,
          path: `/campaigns/${r.id}?accountId=${accountId}`,
        })),
        sequences: sequenceResults.map((r) => ({
          ...r,
          type: "sequence" as const,
          path: `/sequences?account=${accountId}`,
        })),
        content: contentResults.map((r) => ({
          ...r,
          type: "content" as const,
          path: `/content-hub/${r.id}`,
        })),
        deals: dealResults.map((r) => ({
          ...r,
          type: "deal" as const,
          path: `/pipeline?account=${accountId}`,
        })),
        total:
          contactResults.length +
          campaignResults.length +
          sequenceResults.length +
          contentResults.length +
          dealResults.length,
      };
    }),
});
