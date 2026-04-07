import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure } from "../_core/trpc";
import { getDb } from "../db";
import { requireAccountMember } from "./contacts";
import {
  longFormContent,
  contentTemplates,
  repurposedContent,
  contentBrandVoice,
} from "../../drizzle/schema";
import { eq, and, desc, sql, isNull, or } from "drizzle-orm";
import { invokeLLM } from "../_core/llm";
import { trackUsage } from "../services/usageTracker";
import { ENV } from "../_core/env";

// ─── Constants ──────────────────────────────────────────────────────────────

const REPURPOSE_FORMATS = [
  "social-snippet",
  "email-summary",
  "short-form",
  "infographic-script",
  "video-script",
] as const;

type RepurposeFormat = (typeof REPURPOSE_FORMATS)[number];

const DEFAULT_TEMPLATES = [
  {
    name: "Product Review",
    description: "In-depth review of a product or service with pros, cons, and verdict",
    category: "review",
    prompt: "Write a comprehensive product review about {{topic}}. Include an introduction, key features, pros and cons, comparison with alternatives, and a final verdict with rating. Use a balanced, objective tone while being engaging.",
    structure: { sections: ["Introduction", "Key Features", "Pros", "Cons", "Comparison", "Verdict"] },
  },
  {
    name: "How-To Guide",
    description: "Step-by-step tutorial with actionable instructions",
    category: "tutorial",
    prompt: "Write a detailed how-to guide about {{topic}}. Include a brief introduction explaining why this matters, prerequisites if any, numbered step-by-step instructions, tips and common mistakes to avoid, and a conclusion with next steps.",
    structure: { sections: ["Introduction", "Prerequisites", "Step-by-Step Instructions", "Tips & Pitfalls", "Conclusion"] },
  },
  {
    name: "Listicle",
    description: "Numbered list article with detailed explanations for each item",
    category: "listicle",
    prompt: "Write an engaging listicle about {{topic}}. Include 7-10 items, each with a catchy subheading, 2-3 paragraphs of explanation, and practical takeaways. Open with a compelling introduction and close with a summary.",
    structure: { sections: ["Introduction", "List Items (7-10)", "Summary"] },
  },
  {
    name: "Comparison",
    description: "Side-by-side comparison of two or more options",
    category: "comparison",
    prompt: "Write a thorough comparison article about {{topic}}. Compare key features, pricing, ease of use, pros and cons of each option. Include a comparison table and a recommendation based on different use cases.",
    structure: { sections: ["Introduction", "Overview of Options", "Feature Comparison", "Pricing", "Pros & Cons", "Recommendation"] },
  },
  {
    name: "Tutorial",
    description: "Technical tutorial with code examples or detailed procedures",
    category: "tutorial",
    prompt: "Write a comprehensive tutorial about {{topic}}. Include background context, detailed instructions with examples, troubleshooting tips, and advanced techniques. Make it accessible for beginners while providing value for intermediate readers.",
    structure: { sections: ["Background", "Getting Started", "Core Tutorial", "Advanced Techniques", "Troubleshooting", "Next Steps"] },
  },
  {
    name: "Case Study",
    description: "Real-world example showcasing results and lessons learned",
    category: "case-study",
    prompt: "Write a compelling case study about {{topic}}. Include the challenge/problem, the approach taken, implementation details, measurable results, and key takeaways. Use data and specific examples to support claims.",
    structure: { sections: ["Challenge", "Approach", "Implementation", "Results", "Key Takeaways"] },
  },
  {
    name: "News Article",
    description: "Timely news coverage with analysis and expert perspective",
    category: "news",
    prompt: "Write a professional news article about {{topic}}. Follow the inverted pyramid structure: lead with the most important information, then provide context, quotes/expert opinions, background, and implications. Maintain objectivity.",
    structure: { sections: ["Lead", "Context", "Expert Analysis", "Background", "Implications"] },
  },
  {
    name: "Opinion",
    description: "Thought leadership piece with a clear stance and supporting arguments",
    category: "opinion",
    prompt: "Write a persuasive opinion article about {{topic}}. State your thesis clearly, provide 3-4 strong supporting arguments with evidence, address counterarguments, and conclude with a call to action. Be authoritative but respectful of other viewpoints.",
    structure: { sections: ["Thesis", "Supporting Arguments", "Counterarguments", "Conclusion & CTA"] },
  },
];

// ─── Helpers ────────────────────────────────────────────────────────────────

async function fetchWebResearch(topic: string): Promise<{
  context: string;
  urlsFetched: number;
  urlsFailed: number;
  webSearches: number;
}> {
  try {
    const baseUrl = ENV.forgeApiUrl?.endsWith("/")
      ? ENV.forgeApiUrl
      : `${ENV.forgeApiUrl}/`;
    const fullUrl = new URL(
      "webdevtoken.v1.WebDevService/CallApi",
      baseUrl
    ).toString();

    const response = await fetch(fullUrl, {
      method: "POST",
      headers: {
        accept: "application/json",
        "content-type": "application/json",
        "connect-protocol-version": "1",
        authorization: `Bearer ${ENV.forgeApiKey}`,
      },
      body: JSON.stringify({
        apiId: "omni_search",
        query: { q: topic, search_type: "info", num: 3 },
      }),
    });

    if (!response.ok) {
      console.warn(`[longFormContent] Web research failed: ${response.status}`);
      return { context: "", urlsFetched: 0, urlsFailed: 0, webSearches: 1 };
    }

    const payload = await response.json();
    let data: any;
    if (payload && typeof payload === "object" && "jsonData" in payload) {
      try {
        data = JSON.parse(payload.jsonData ?? "{}");
      } catch {
        data = payload.jsonData;
      }
    } else {
      data = payload;
    }

    // Extract relevant snippets from search results
    const results = data?.results || data?.organic_results || data?.items || [];
    const snippets: string[] = [];
    let fetched = 0;
    let failed = 0;

    for (const result of (Array.isArray(results) ? results : []).slice(0, 3)) {
      try {
        const title = result.title || result.name || "";
        const snippet = result.snippet || result.description || result.content || "";
        const url = result.link || result.url || "";
        if (title || snippet) {
          snippets.push(`Source: ${title}\nURL: ${url}\n${snippet}`);
          fetched++;
        }
      } catch {
        failed++;
      }
    }

    return {
      context: snippets.length
        ? `\n\nWEB RESEARCH CONTEXT:\n${snippets.join("\n\n---\n\n")}`
        : "",
      urlsFetched: fetched,
      urlsFailed: failed,
      webSearches: 1,
    };
  } catch (err) {
    console.error("[longFormContent] Web research error:", err);
    return { context: "", urlsFetched: 0, urlsFailed: 0, webSearches: 1 };
  }
}

function countWords(text: string): number {
  return text
    .replace(/[#*_`~\[\]()>|]/g, "")
    .split(/\s+/)
    .filter((w) => w.length > 0).length;
}

// ─── Repurpose prompt builders ──────────────────────────────────────────────

const REPURPOSE_PROMPTS: Record<RepurposeFormat, (title: string) => string> = {
  "social-snippet": (title) =>
    `Convert the following blog post into a concise, engaging social media post (max 280 characters). Include a hook and call to action. The original title is "${title}".`,
  "email-summary": (title) =>
    `Convert the following blog post into a professional email newsletter summary (150-250 words). Include a subject line suggestion, key takeaways, and a CTA to read the full article. The original title is "${title}".`,
  "short-form": (title) =>
    `Condense the following blog post into a short-form article (300-500 words) that captures the key points. Maintain the core message and value. The original title is "${title}".`,
  "infographic-script": (title) =>
    `Extract the key data points, statistics, and main ideas from the following blog post and organize them into an infographic script with sections, bullet points, and suggested visual elements. The original title is "${title}".`,
  "video-script": (title) =>
    `Convert the following blog post into a 2-3 minute video script with an intro hook, main talking points, and outro with CTA. Include speaker notes and suggested B-roll descriptions. The original title is "${title}".`,
};

// ─── Router ─────────────────────────────────────────────────────────────────

export const longFormContentRouter = router({
  // ─── Generate a single blog post ──────────────────────────────────────────
  generate: protectedProcedure
    .input(
      z.object({
        accountId: z.number(),
        topic: z.string().min(1).max(1000),
        customPrompt: z.string().optional(),
        aiModel: z.string().optional(),
        shouldGenerateImage: z.boolean().optional().default(false),
        enableWebResearch: z.boolean().optional().default(false),
        templateId: z.number().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      await requireAccountMember(ctx.user!.id, input.accountId, ctx.user!.role);
      const db = await getDb();
      if (!db)
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Database unavailable",
        });

      const startTime = Date.now();

      // Get brand voice
      const [brandVoice] = await db
        .select()
        .from(contentBrandVoice)
        .where(eq(contentBrandVoice.accountId, input.accountId))
        .limit(1);

      // Get template if specified
      let templatePrompt = "";
      let templateStructure = "";
      if (input.templateId) {
        const [template] = await db
          .select()
          .from(contentTemplates)
          .where(eq(contentTemplates.id, input.templateId))
          .limit(1);
        if (template) {
          templatePrompt = template.prompt
            ? template.prompt.replace(/\{\{topic\}\}/g, input.topic)
            : "";
          if (template.structure) {
            const struct =
              typeof template.structure === "string"
                ? JSON.parse(template.structure)
                : template.structure;
            if (struct.sections) {
              templateStructure = `\n\nARTICLE STRUCTURE:\nOrganize the article using these sections:\n${(struct.sections as string[]).map((s: string, i: number) => `${i + 1}. ${s}`).join("\n")}`;
            }
          }
        }
      }

      // Web research
      let researchContext = "";
      let urlsFetched = 0;
      let urlsFailed = 0;
      let webSearches = 0;
      if (input.enableWebResearch) {
        const research = await fetchWebResearch(input.topic);
        researchContext = research.context;
        urlsFetched = research.urlsFetched;
        urlsFailed = research.urlsFailed;
        webSearches = research.webSearches;
      }

      // Build brand voice section
      let brandSection = "";
      if (brandVoice) {
        const parts: string[] = [];
        if (brandVoice.industry) parts.push(`Industry: ${brandVoice.industry}`);
        if (brandVoice.targetAudience)
          parts.push(`Target audience: ${brandVoice.targetAudience}`);
        if (brandVoice.brandPersonality)
          parts.push(`Brand personality: ${brandVoice.brandPersonality}`);
        if (brandVoice.preferredTone)
          parts.push(`Preferred tone: ${brandVoice.preferredTone}`);
        if (parts.length) brandSection = `\n\nBRAND VOICE:\n${parts.join("\n")}`;
      }

      const baseInstruction =
        templatePrompt ||
        input.customPrompt ||
        `Write a comprehensive, well-researched blog post about "${input.topic}".`;

      const systemPrompt = `You are an expert content writer and SEO specialist. Generate a high-quality, long-form blog post in Markdown format.

INSTRUCTIONS:
${baseInstruction}${templateStructure}${brandSection}${researchContext}

REQUIREMENTS:
- Write in Markdown format with proper headings (##, ###), paragraphs, lists, and emphasis.
- Include a compelling title as the first H1 heading.
- Aim for 1000-2000 words of substantive content.
- Use engaging hooks, data points, and actionable insights.
- Include a meta description suggestion at the end.
- Make the content SEO-friendly with natural keyword usage.
- End with a strong conclusion and call to action.

Return your response as valid JSON.`;

      const response = await invokeLLM({
        messages: [
          { role: "system", content: systemPrompt },
          {
            role: "user",
            content: `Generate a long-form blog post about: ${input.topic}`,
          },
        ],
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "blog_post",
            strict: true,
            schema: {
              type: "object",
              properties: {
                title: {
                  type: "string",
                  description: "The blog post title",
                },
                content: {
                  type: "string",
                  description:
                    "The full blog post content in Markdown format",
                },
                metaDescription: {
                  type: "string",
                  description: "SEO meta description (150-160 chars)",
                },
                imagePrompt: {
                  type: "string",
                  description:
                    "A detailed prompt for generating a featured image",
                },
              },
              required: [
                "title",
                "content",
                "metaDescription",
                "imagePrompt",
              ],
              additionalProperties: false,
            },
          },
        },
      });

      const rawContent = response.choices?.[0]?.message?.content;
      const raw =
        typeof rawContent === "string" ? rawContent : JSON.stringify(rawContent);
      if (!raw) throw new Error("LLM returned empty response");

      let parsed: {
        title: string;
        content: string;
        metaDescription: string;
        imagePrompt: string;
      };
      try {
        parsed = JSON.parse(raw);
      } catch {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to parse LLM response",
        });
      }

      const generationTimeMs = Date.now() - startTime;
      const wordCount = countWords(parsed.content);
      const inputTokens = response.usage?.prompt_tokens ?? 0;
      const outputTokens = response.usage?.completion_tokens ?? 0;
      const totalTokens = response.usage?.total_tokens ?? 0;

      // Generate image if requested
      let imageUrl: string | null = null;
      if (input.shouldGenerateImage && parsed.imagePrompt) {
        try {
          const { generateImage } = await import("../_core/imageGeneration");
          const result = await generateImage({ prompt: parsed.imagePrompt });
          imageUrl = result.url ?? null;
        } catch (err) {
          console.error("[longFormContent] Image generation failed:", err);
        }
      }

      // Save to database
      const [result] = await db.insert(longFormContent).values({
        accountId: input.accountId,
        createdByUserId: ctx.user!.id,
        title: parsed.title,
        topic: input.topic,
        content: parsed.content,
        imageUrl,
        imagePrompt: parsed.imagePrompt,
        status: "draft",
        aiModel: input.aiModel || "gemini-2.5-flash",
        customPrompt: input.customPrompt || null,
        inputTokens,
        outputTokens,
        totalTokens,
        urlsFetched,
        urlsFailed,
        webSearches,
        wordCount,
        generationTimeMs,
      });

      // Track usage
      await trackUsage({
        accountId: input.accountId,
        userId: ctx.user!.id,
        eventType: "llm_request",
        quantity: 1,
        metadata: {
          feature: "long_form_content_generation",
          topic: input.topic,
          wordCount,
        },
      }).catch((err) =>
        console.error("[longFormContent] Usage tracking failed:", err)
      );

      return {
        id: result.insertId,
        title: parsed.title,
        content: parsed.content,
        metaDescription: parsed.metaDescription,
        imageUrl,
        imagePrompt: parsed.imagePrompt,
        wordCount,
        generationTimeMs,
        inputTokens,
        outputTokens,
        totalTokens,
        urlsFetched,
        urlsFailed,
        webSearches,
      };
    }),

  // ─── Bulk generate multiple blog posts ────────────────────────────────────
  bulkGenerate: protectedProcedure
    .input(
      z.object({
        accountId: z.number(),
        topics: z.array(z.string().min(1).max(1000)).min(1).max(20),
        customPrompt: z.string().optional(),
        aiModel: z.string().optional(),
        enableWebResearch: z.boolean().optional().default(false),
        templateId: z.number().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      await requireAccountMember(ctx.user!.id, input.accountId, ctx.user!.role);

      const results: Array<{
        topic: string;
        success: boolean;
        id?: number;
        title?: string;
        error?: string;
      }> = [];

      for (const topic of input.topics) {
        try {
          // Re-use the generate logic by calling the internal function
          const db = await getDb();
          if (!db) throw new Error("Database unavailable");

          const startTime = Date.now();

          // Get brand voice
          const [brandVoice] = await db
            .select()
            .from(contentBrandVoice)
            .where(eq(contentBrandVoice.accountId, input.accountId))
            .limit(1);

          // Get template
          let templatePrompt = "";
          let templateStructure = "";
          if (input.templateId) {
            const [template] = await db
              .select()
              .from(contentTemplates)
              .where(eq(contentTemplates.id, input.templateId))
              .limit(1);
            if (template) {
              templatePrompt = template.prompt
                ? template.prompt.replace(/\{\{topic\}\}/g, topic)
                : "";
              if (template.structure) {
                const struct =
                  typeof template.structure === "string"
                    ? JSON.parse(template.structure)
                    : template.structure;
                if (struct.sections) {
                  templateStructure = `\n\nARTICLE STRUCTURE:\n${(struct.sections as string[]).map((s: string, i: number) => `${i + 1}. ${s}`).join("\n")}`;
                }
              }
            }
          }

          // Web research
          let researchContext = "";
          let urlsFetched = 0;
          let urlsFailed = 0;
          let webSearches = 0;
          if (input.enableWebResearch) {
            const research = await fetchWebResearch(topic);
            researchContext = research.context;
            urlsFetched = research.urlsFetched;
            urlsFailed = research.urlsFailed;
            webSearches = research.webSearches;
          }

          let brandSection = "";
          if (brandVoice) {
            const parts: string[] = [];
            if (brandVoice.industry)
              parts.push(`Industry: ${brandVoice.industry}`);
            if (brandVoice.targetAudience)
              parts.push(`Target audience: ${brandVoice.targetAudience}`);
            if (brandVoice.brandPersonality)
              parts.push(`Brand personality: ${brandVoice.brandPersonality}`);
            if (brandVoice.preferredTone)
              parts.push(`Preferred tone: ${brandVoice.preferredTone}`);
            if (parts.length)
              brandSection = `\n\nBRAND VOICE:\n${parts.join("\n")}`;
          }

          const baseInstruction =
            templatePrompt ||
            input.customPrompt ||
            `Write a comprehensive, well-researched blog post about "${topic}".`;

          const systemPrompt = `You are an expert content writer and SEO specialist. Generate a high-quality, long-form blog post in Markdown format.

INSTRUCTIONS:
${baseInstruction}${templateStructure}${brandSection}${researchContext}

REQUIREMENTS:
- Write in Markdown format with proper headings (##, ###), paragraphs, lists, and emphasis.
- Include a compelling title as the first H1 heading.
- Aim for 1000-2000 words of substantive content.
- Use engaging hooks, data points, and actionable insights.
- Make the content SEO-friendly with natural keyword usage.
- End with a strong conclusion and call to action.

Return your response as valid JSON.`;

          const response = await invokeLLM({
            messages: [
              { role: "system", content: systemPrompt },
              {
                role: "user",
                content: `Generate a long-form blog post about: ${topic}`,
              },
            ],
            response_format: {
              type: "json_schema",
              json_schema: {
                name: "blog_post",
                strict: true,
                schema: {
                  type: "object",
                  properties: {
                    title: { type: "string", description: "The blog post title" },
                    content: {
                      type: "string",
                      description: "The full blog post content in Markdown format",
                    },
                    metaDescription: {
                      type: "string",
                      description: "SEO meta description",
                    },
                    imagePrompt: {
                      type: "string",
                      description: "Featured image prompt",
                    },
                  },
                  required: [
                    "title",
                    "content",
                    "metaDescription",
                    "imagePrompt",
                  ],
                  additionalProperties: false,
                },
              },
            },
          });

          const rawContent = response.choices?.[0]?.message?.content;
          const raw =
            typeof rawContent === "string"
              ? rawContent
              : JSON.stringify(rawContent);
          if (!raw) throw new Error("LLM returned empty response");

          const parsed = JSON.parse(raw);
          const generationTimeMs = Date.now() - startTime;
          const wordCount = countWords(parsed.content);

          const [insertResult] = await db.insert(longFormContent).values({
            accountId: input.accountId,
            createdByUserId: ctx.user!.id,
            title: parsed.title,
            topic,
            content: parsed.content,
            imagePrompt: parsed.imagePrompt,
            status: "draft",
            aiModel: input.aiModel || "gemini-2.5-flash",
            customPrompt: input.customPrompt || null,
            inputTokens: response.usage?.prompt_tokens ?? 0,
            outputTokens: response.usage?.completion_tokens ?? 0,
            totalTokens: response.usage?.total_tokens ?? 0,
            urlsFetched,
            urlsFailed,
            webSearches,
            wordCount,
            generationTimeMs,
          });

          results.push({
            topic,
            success: true,
            id: insertResult.insertId,
            title: parsed.title,
          });
        } catch (err: any) {
          results.push({
            topic,
            success: false,
            error: err.message || "Generation failed",
          });
        }
      }

      // Track usage for all successful generations
      const successCount = results.filter((r) => r.success).length;
      if (successCount > 0) {
        await trackUsage({
          accountId: input.accountId,
          userId: ctx.user!.id,
          eventType: "llm_request",
          quantity: successCount,
          metadata: {
            feature: "bulk_content_generation",
            topicCount: input.topics.length,
            successCount,
          },
        }).catch((err) =>
          console.error("[longFormContent] Bulk usage tracking failed:", err)
        );
      }

      return { results, totalTopics: input.topics.length, successCount };
    }),

  // ─── Repurpose content ────────────────────────────────────────────────────
  repurpose: protectedProcedure
    .input(
      z.object({
        accountId: z.number(),
        contentId: z.number(),
        format: z.enum(REPURPOSE_FORMATS),
        platform: z.string().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      await requireAccountMember(ctx.user!.id, input.accountId, ctx.user!.role);
      const db = await getDb();
      if (!db)
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Database unavailable",
        });

      // Fetch original content
      const [original] = await db
        .select()
        .from(longFormContent)
        .where(
          and(
            eq(longFormContent.id, input.contentId),
            eq(longFormContent.accountId, input.accountId)
          )
        )
        .limit(1);

      if (!original) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Original content not found",
        });
      }

      const promptBuilder = REPURPOSE_PROMPTS[input.format];
      const systemPrompt = promptBuilder(original.title);

      const response = await invokeLLM({
        messages: [
          { role: "system", content: systemPrompt },
          {
            role: "user",
            content: `Here is the blog post to repurpose:\n\n${original.content}`,
          },
        ],
      });

      const rawContent = response.choices?.[0]?.message?.content;
      const generatedContent =
        typeof rawContent === "string" ? rawContent : JSON.stringify(rawContent);

      if (!generatedContent) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "LLM returned empty response",
        });
      }

      // Save repurposed content
      const [result] = await db.insert(repurposedContent).values({
        accountId: input.accountId,
        originalContentId: input.contentId,
        format: input.format,
        content: generatedContent,
        platform: input.platform || null,
      });

      // Track usage
      await trackUsage({
        accountId: input.accountId,
        userId: ctx.user!.id,
        eventType: "llm_request",
        quantity: 1,
        metadata: {
          feature: "content_repurpose",
          format: input.format,
          originalContentId: input.contentId,
        },
      }).catch((err) =>
        console.error("[longFormContent] Repurpose usage tracking failed:", err)
      );

      return {
        id: result.insertId,
        format: input.format,
        content: generatedContent,
        platform: input.platform || null,
      };
    }),

  // ─── Seed default templates ───────────────────────────────────────────────
  seedTemplates: protectedProcedure.mutation(async ({ ctx }) => {
    const db = await getDb();
    if (!db)
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Database unavailable",
      });

    // Check if templates already exist
    const existing = await db
      .select({ count: sql<number>`COUNT(*)` })
      .from(contentTemplates)
      .where(isNull(contentTemplates.accountId));
    const count = existing[0]?.count ?? 0;

    if (count >= DEFAULT_TEMPLATES.length) {
      return { seeded: 0, message: "Default templates already exist" };
    }

    let seeded = 0;
    for (const tmpl of DEFAULT_TEMPLATES) {
      // Check if this specific template already exists
      const [exists] = await db
        .select({ id: contentTemplates.id })
        .from(contentTemplates)
        .where(
          and(
            isNull(contentTemplates.accountId),
            eq(contentTemplates.name, tmpl.name)
          )
        )
        .limit(1);

      if (!exists) {
        await db.insert(contentTemplates).values({
          accountId: null,
          name: tmpl.name,
          description: tmpl.description,
          category: tmpl.category,
          prompt: tmpl.prompt,
          structure: JSON.stringify(tmpl.structure),
          isPublic: true,
        });
        seeded++;
      }
    }

    return { seeded, message: `Seeded ${seeded} default templates` };
  }),

  // ─── List content ─────────────────────────────────────────────────────────
  list: protectedProcedure
    .input(
      z.object({
        accountId: z.number(),
        status: z.enum(["draft", "published", "all"]).optional().default("all"),
        limit: z.number().min(1).max(100).default(20),
        offset: z.number().min(0).default(0),
        search: z.string().optional(),
      })
    )
    .query(async ({ input, ctx }) => {
      await requireAccountMember(ctx.user!.id, input.accountId, ctx.user!.role);
      const db = await getDb();
      if (!db)
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Database unavailable",
        });

      const conditions = [eq(longFormContent.accountId, input.accountId)];
      if (input.status && input.status !== "all") {
        conditions.push(eq(longFormContent.status, input.status as any));
      }
      if (input.search) {
        conditions.push(
          sql`(${longFormContent.title} LIKE ${"%" + input.search + "%"} OR ${longFormContent.topic} LIKE ${"%" + input.search + "%"})`
        );
      }

      const items = await db
        .select()
        .from(longFormContent)
        .where(and(...conditions))
        .orderBy(desc(longFormContent.createdAt))
        .limit(input.limit)
        .offset(input.offset);

      const [countResult] = await db
        .select({ count: sql<number>`COUNT(*)` })
        .from(longFormContent)
        .where(and(...conditions));

      return {
        items,
        total: countResult?.count ?? 0,
      };
    }),

  // ─── Get single content ───────────────────────────────────────────────────
  getById: protectedProcedure
    .input(z.object({ accountId: z.number(), id: z.number() }))
    .query(async ({ input, ctx }) => {
      await requireAccountMember(ctx.user!.id, input.accountId, ctx.user!.role);
      const db = await getDb();
      if (!db)
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Database unavailable",
        });

      const [item] = await db
        .select()
        .from(longFormContent)
        .where(
          and(
            eq(longFormContent.id, input.id),
            eq(longFormContent.accountId, input.accountId)
          )
        )
        .limit(1);

      if (!item) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Content not found" });
      }

      // Get repurposed content for this article
      const repurposed = await db
        .select()
        .from(repurposedContent)
        .where(
          and(
            eq(repurposedContent.originalContentId, input.id),
            eq(repurposedContent.accountId, input.accountId)
          )
        )
        .orderBy(desc(repurposedContent.createdAt));

      return { ...item, repurposed };
    }),

  // ─── Update content ───────────────────────────────────────────────────────
  update: protectedProcedure
    .input(
      z.object({
        accountId: z.number(),
        id: z.number(),
        title: z.string().optional(),
        content: z.string().optional(),
        status: z.enum(["draft", "published"]).optional(),
        imageUrl: z.string().nullable().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      await requireAccountMember(ctx.user!.id, input.accountId, ctx.user!.role);
      const db = await getDb();
      if (!db)
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Database unavailable",
        });

      const [existing] = await db
        .select()
        .from(longFormContent)
        .where(
          and(
            eq(longFormContent.id, input.id),
            eq(longFormContent.accountId, input.accountId)
          )
        )
        .limit(1);

      if (!existing) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Content not found" });
      }

      const updates: Record<string, any> = {};
      if (input.title !== undefined) updates.title = input.title;
      if (input.content !== undefined) {
        updates.content = input.content;
        updates.wordCount = countWords(input.content);
      }
      if (input.status !== undefined) updates.status = input.status;
      if (input.imageUrl !== undefined) updates.imageUrl = input.imageUrl;

      if (Object.keys(updates).length > 0) {
        await db
          .update(longFormContent)
          .set(updates)
          .where(eq(longFormContent.id, input.id));
      }

      return { success: true };
    }),

  // ─── Delete content ───────────────────────────────────────────────────────
  delete: protectedProcedure
    .input(z.object({ accountId: z.number(), id: z.number() }))
    .mutation(async ({ input, ctx }) => {
      await requireAccountMember(ctx.user!.id, input.accountId, ctx.user!.role);
      const db = await getDb();
      if (!db)
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Database unavailable",
        });

      // Delete repurposed content first
      await db
        .delete(repurposedContent)
        .where(
          and(
            eq(repurposedContent.originalContentId, input.id),
            eq(repurposedContent.accountId, input.accountId)
          )
        );

      await db
        .delete(longFormContent)
        .where(
          and(
            eq(longFormContent.id, input.id),
            eq(longFormContent.accountId, input.accountId)
          )
        );

      return { success: true };
    }),

  // ─── List templates ───────────────────────────────────────────────────────
  listTemplates: protectedProcedure
    .input(z.object({ accountId: z.number() }))
    .query(async ({ input, ctx }) => {
      await requireAccountMember(ctx.user!.id, input.accountId, ctx.user!.role);
      const db = await getDb();
      if (!db)
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Database unavailable",
        });

      // Get global templates + account-specific templates
      const templates = await db
        .select()
        .from(contentTemplates)
        .where(
          or(
            isNull(contentTemplates.accountId),
            eq(contentTemplates.accountId, input.accountId)
          )
        )
        .orderBy(contentTemplates.name);

      return templates.map((t) => ({
        ...t,
        structure:
          typeof t.structure === "string"
            ? JSON.parse(t.structure)
            : t.structure,
      }));
    }),

  // ─── Get repurposed content for an article ────────────────────────────────
  getRepurposed: protectedProcedure
    .input(z.object({ accountId: z.number(), contentId: z.number() }))
    .query(async ({ input, ctx }) => {
      await requireAccountMember(ctx.user!.id, input.accountId, ctx.user!.role);
      const db = await getDb();
      if (!db)
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Database unavailable",
        });

      const items = await db
        .select()
        .from(repurposedContent)
        .where(
          and(
            eq(repurposedContent.originalContentId, input.contentId),
            eq(repurposedContent.accountId, input.accountId)
          )
        )
        .orderBy(desc(repurposedContent.createdAt));

      return items;
    }),
});
