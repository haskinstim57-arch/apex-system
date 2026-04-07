import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure } from "../_core/trpc";
import { getDb } from "../db";
import { requireAccountMember } from "./contacts";
import { socialPosts, contentBrandVoice } from "../../drizzle/schema";
import { eq, and, desc, sql } from "drizzle-orm";
import {
  generateSocialPost,
  generateContentCalendar,
  type Platform,
  type Tone,
} from "../services/contentGenerator";
import { trackUsage } from "../services/usageTracker";

const platformEnum = z.enum(["facebook", "instagram", "linkedin", "twitter"]);
const toneEnum = z.enum(["professional", "casual", "funny", "inspiring", "educational"]);
const statusEnum = z.enum(["draft", "scheduled", "published", "failed"]);

export const socialContentRouter = router({
  // ─── Generate post variations ───────────────────────────────────────────
  generatePost: protectedProcedure
    .input(
      z.object({
        accountId: z.number(),
        platform: platformEnum,
        topic: z.string().min(1).max(500),
        tone: toneEnum,
        additionalContext: z.string().optional(),
        aiModel: z.string().optional(),
        enableWebResearch: z.boolean().optional().default(false),
        variationsCount: z.number().min(1).max(3).optional().default(3),
        shouldGenerateImage: z.boolean().optional().default(false),
      })
    )
    .mutation(async ({ input, ctx }) => {
      await requireAccountMember(ctx.user!.id, input.accountId, ctx.user!.role);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

      // Get brand voice for account
      const [brandVoice] = await db
        .select()
        .from(contentBrandVoice)
        .where(eq(contentBrandVoice.accountId, input.accountId))
        .limit(1);

      // Get account context
      const accountRows = await db.execute(
        sql`SELECT name, industry FROM accounts WHERE id = ${input.accountId} LIMIT 1`
      );
      const account = (accountRows as any)[0]?.[0];

      const result = await generateSocialPost({
        accountId: input.accountId,
        platform: input.platform as Platform,
        topic: input.topic,
        tone: input.tone as Tone,
        additionalContext: input.additionalContext,
        brandVoice: brandVoice || undefined,
        accountContext: account
          ? { businessName: account.name, industry: account.industry }
          : undefined,
        aiModel: input.aiModel,
        enableWebResearch: input.enableWebResearch,
        variationsCount: input.variationsCount,
      });

      // Generate images if requested
      if (input.shouldGenerateImage) {
        const { generateImage } = await import("../_core/imageGeneration");
        const { storagePut } = await import("../storage");
        for (const variation of result.variations) {
          if (variation.imagePrompt) {
            try {
              const img = await generateImage({ prompt: variation.imagePrompt });
              const tempUrl = img.url;
              if (tempUrl) {
                const response = await fetch(tempUrl);
                const buffer = Buffer.from(await response.arrayBuffer());
                const key = `social-images/${Date.now()}-${Math.random().toString(36).slice(2)}.jpg`;
                const stored = await storagePut(key, buffer, "image/jpeg");
                variation.imageUrl = stored.url ?? tempUrl;
              }
            } catch (err) {
              console.error("[socialContent] Image storage failed:", err);
              variation.imageUrl = null;
            }
          }
        }
      }

      // Track LLM usage
      await trackUsage({
        accountId: input.accountId,
        userId: ctx.user!.id,
        eventType: "llm_request",
        quantity: 1,
        metadata: { feature: "social_content_generation", platform: input.platform },
      }).catch((err) => console.error("[socialContent] Usage tracking failed:", err));

      return result;
    }),

  // ─── Save post as draft ─────────────────────────────────────────────────
  saveDraft: protectedProcedure
    .input(
      z.object({
        accountId: z.number(),
        platform: platformEnum,
        content: z.string().min(1),
        hashtags: z.array(z.string()),
        imageUrl: z.string().optional(),
        imagePrompt: z.string().optional(),
        scheduledAt: z.number().optional(), // UTC timestamp ms
        topic: z.string().optional(),
        tone: z.string().optional(),
        generationPrompt: z.string().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      await requireAccountMember(ctx.user!.id, input.accountId, ctx.user!.role);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

      const status = input.scheduledAt ? "scheduled" : "draft";

      const [result] = await db.insert(socialPosts).values({
        accountId: input.accountId,
        createdByUserId: ctx.user!.id,
        platform: input.platform,
        content: input.content,
        hashtags: JSON.stringify(input.hashtags),
        imageUrl: input.imageUrl || null,
        imagePrompt: input.imagePrompt || null,
        status,
        scheduledAt: input.scheduledAt ? new Date(input.scheduledAt) : null,
        generationPrompt: input.generationPrompt || null,
        tone: input.tone || null,
        topic: input.topic || null,
      });

      return { id: result.insertId, status };
    }),

  // ─── Get all posts for account ──────────────────────────────────────────
  getPosts: protectedProcedure
    .input(
      z.object({
        accountId: z.number(),
        platform: z.enum(["facebook", "instagram", "linkedin", "twitter", "all"]).optional(),
        status: z.enum(["draft", "scheduled", "published", "failed", "all"]).optional(),
        limit: z.number().min(1).max(100).default(20),
        offset: z.number().min(0).default(0),
      })
    )
    .query(async ({ input, ctx }) => {
      await requireAccountMember(ctx.user!.id, input.accountId, ctx.user!.role);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

      const conditions = [eq(socialPosts.accountId, input.accountId)];
      if (input.platform && input.platform !== "all") {
        conditions.push(eq(socialPosts.platform, input.platform as any));
      }
      if (input.status && input.status !== "all") {
        conditions.push(eq(socialPosts.status, input.status as any));
      }

      const posts = await db
        .select()
        .from(socialPosts)
        .where(and(...conditions))
        .orderBy(desc(socialPosts.createdAt))
        .limit(input.limit)
        .offset(input.offset);

      // Get total count
      const [countResult] = await db
        .select({ count: sql<number>`COUNT(*)` })
        .from(socialPosts)
        .where(and(...conditions));

      return {
        posts: posts.map((p) => ({
          ...p,
          hashtags: p.hashtags ? JSON.parse(p.hashtags) : [],
        })),
        total: countResult?.count ?? 0,
      };
    }),

  // ─── Update post ────────────────────────────────────────────────────────
  updatePost: protectedProcedure
    .input(
      z.object({
        postId: z.number(),
        accountId: z.number(),
        content: z.string().optional(),
        hashtags: z.array(z.string()).optional(),
        scheduledAt: z.number().nullable().optional(), // UTC timestamp ms
        status: z.enum(["draft", "scheduled"]).optional(),
        imageUrl: z.string().nullable().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      await requireAccountMember(ctx.user!.id, input.accountId, ctx.user!.role);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

      // Verify post belongs to account
      const [existing] = await db
        .select()
        .from(socialPosts)
        .where(and(eq(socialPosts.id, input.postId), eq(socialPosts.accountId, input.accountId)))
        .limit(1);

      if (!existing) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Post not found" });
      }

      if (existing.status === "published") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Cannot edit a published post" });
      }

      const updates: Record<string, any> = {};
      if (input.content !== undefined) updates.content = input.content;
      if (input.hashtags !== undefined) updates.hashtags = JSON.stringify(input.hashtags);
      if (input.scheduledAt !== undefined) {
        updates.scheduledAt = input.scheduledAt ? new Date(input.scheduledAt) : null;
      }
      if (input.status !== undefined) updates.status = input.status;
      if (input.imageUrl !== undefined) updates.imageUrl = input.imageUrl;

      if (Object.keys(updates).length > 0) {
        await db
          .update(socialPosts)
          .set(updates)
          .where(eq(socialPosts.id, input.postId));
      }

      return { success: true };
    }),

  // ─── Delete post ────────────────────────────────────────────────────────
  deletePost: protectedProcedure
    .input(z.object({ postId: z.number(), accountId: z.number() }))
    .mutation(async ({ input, ctx }) => {
      await requireAccountMember(ctx.user!.id, input.accountId, ctx.user!.role);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

      const [existing] = await db
        .select()
        .from(socialPosts)
        .where(and(eq(socialPosts.id, input.postId), eq(socialPosts.accountId, input.accountId)))
        .limit(1);

      if (!existing) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Post not found" });
      }

      await db.delete(socialPosts).where(eq(socialPosts.id, input.postId));
      return { success: true };
    }),

  // ─── Get brand voice settings ───────────────────────────────────────────
  getBrandVoice: protectedProcedure
    .input(z.object({ accountId: z.number() }))
    .query(async ({ input, ctx }) => {
      await requireAccountMember(ctx.user!.id, input.accountId, ctx.user!.role);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

      const [bv] = await db
        .select()
        .from(contentBrandVoice)
        .where(eq(contentBrandVoice.accountId, input.accountId))
        .limit(1);

      if (!bv) {
        return {
          accountId: input.accountId,
          industry: null,
          targetAudience: null,
          brandPersonality: null,
          keyMessages: [],
          avoidTopics: [],
          preferredTone: "professional",
          examplePosts: [],
        };
      }

      return {
        ...bv,
        keyMessages: bv.keyMessages ? JSON.parse(bv.keyMessages) : [],
        avoidTopics: bv.avoidTopics ? JSON.parse(bv.avoidTopics) : [],
        examplePosts: bv.examplePosts ? JSON.parse(bv.examplePosts) : [],
      };
    }),

  // ─── Update brand voice settings ────────────────────────────────────────
  updateBrandVoice: protectedProcedure
    .input(
      z.object({
        accountId: z.number(),
        industry: z.string().optional(),
        targetAudience: z.string().optional(),
        brandPersonality: z.string().optional(),
        keyMessages: z.array(z.string()).optional(),
        avoidTopics: z.array(z.string()).optional(),
        preferredTone: z.string().optional(),
        examplePosts: z.array(z.string()).optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      await requireAccountMember(ctx.user!.id, input.accountId, ctx.user!.role);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

      const values: Record<string, any> = {
        accountId: input.accountId,
      };
      if (input.industry !== undefined) values.industry = input.industry;
      if (input.targetAudience !== undefined) values.targetAudience = input.targetAudience;
      if (input.brandPersonality !== undefined) values.brandPersonality = input.brandPersonality;
      if (input.keyMessages !== undefined) values.keyMessages = JSON.stringify(input.keyMessages);
      if (input.avoidTopics !== undefined) values.avoidTopics = JSON.stringify(input.avoidTopics);
      if (input.preferredTone !== undefined) values.preferredTone = input.preferredTone;
      if (input.examplePosts !== undefined) values.examplePosts = JSON.stringify(input.examplePosts);

      // Upsert
      const [existing] = await db
        .select({ id: contentBrandVoice.id })
        .from(contentBrandVoice)
        .where(eq(contentBrandVoice.accountId, input.accountId))
        .limit(1);

      if (existing) {
        const { accountId, ...updateValues } = values;
        await db
          .update(contentBrandVoice)
          .set(updateValues)
          .where(eq(contentBrandVoice.accountId, input.accountId));
      } else {
        await db.insert(contentBrandVoice).values(values as any);
      }

      return { success: true };
    }),

  // ─── Generate content calendar ──────────────────────────────────────────
  generateContentCalendar: protectedProcedure
    .input(
      z.object({
        accountId: z.number(),
        platforms: z.array(platformEnum).min(1),
        postsPerPlatform: z.number().min(1).max(7),
        topics: z.array(z.string()).min(1),
        startDate: z.number(), // UTC timestamp ms
        tone: toneEnum,
        aiModel: z.string().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      await requireAccountMember(ctx.user!.id, input.accountId, ctx.user!.role);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

      // Get brand voice
      const [brandVoice] = await db
        .select()
        .from(contentBrandVoice)
        .where(eq(contentBrandVoice.accountId, input.accountId))
        .limit(1);

      // Get account context
      const accountRows = await db.execute(
        sql`SELECT name, industry FROM accounts WHERE id = ${input.accountId} LIMIT 1`
      );
      const account = (accountRows as any)[0]?.[0];

      const result = await generateContentCalendar({
        accountId: input.accountId,
        platforms: input.platforms as Platform[],
        postsPerPlatform: input.postsPerPlatform,
        topics: input.topics,
        tone: input.tone as Tone,
        brandVoice: brandVoice || undefined,
        accountContext: account
          ? { businessName: account.name, industry: account.industry }
          : undefined,
        aiModel: input.aiModel,
      });

      // Track LLM usage — one request per platform
      const totalRequests = input.platforms.length;
      await trackUsage({
        accountId: input.accountId,
        userId: ctx.user!.id,
        eventType: "llm_request",
        quantity: totalRequests,
        metadata: {
          feature: "social_content_calendar",
          platforms: input.platforms,
          postsPerPlatform: input.postsPerPlatform,
        },
      }).catch((err) => console.error("[socialContent] Usage tracking failed:", err));

      // Save all generated posts as drafts with scheduled dates
      const startDate = new Date(input.startDate);
      const savedPosts: Array<{ id: number; platform: string; scheduledAt: Date }> = [];

      for (let i = 0; i < result.posts.length; i++) {
        const post = result.posts[i];
        // Distribute posts across the week starting from startDate
        const dayOffset = Math.floor(i / input.platforms.length);
        const scheduledDate = new Date(startDate);
        scheduledDate.setDate(scheduledDate.getDate() + dayOffset);
        // Stagger times: 9am, 12pm, 3pm, 6pm
        const timeSlots = [9, 12, 15, 18];
        scheduledDate.setHours(timeSlots[i % timeSlots.length], 0, 0, 0);

        const [insertResult] = await db.insert(socialPosts).values({
          accountId: input.accountId,
          createdByUserId: ctx.user!.id,
          platform: post.platform,
          content: post.content,
          hashtags: JSON.stringify(post.hashtags),
          imagePrompt: post.imagePrompt,
          status: "scheduled",
          scheduledAt: scheduledDate,
          tone: input.tone,
          topic: post.topic,
        });

        savedPosts.push({
          id: insertResult.insertId,
          platform: post.platform,
          scheduledAt: scheduledDate,
        });
      }

      return { posts: result.posts, savedPosts };
    }),
});
