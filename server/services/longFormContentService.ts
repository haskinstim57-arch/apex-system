/**
 * Extracted long-form content generation service.
 * Can be called from tRPC procedures or background workers (no ctx needed).
 */
import { getDb } from "../db";
import {
  longFormContent,
  contentBrandVoice,
  contentTemplates,
} from "../../drizzle/schema";
import { eq } from "drizzle-orm";
import { invokeLLM } from "../_core/llm";
import { ENV } from "../_core/env";

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
      console.warn(`[longFormContentService] Web research failed: ${response.status}`);
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
    console.error("[longFormContentService] Web research error:", err);
    return { context: "", urlsFetched: 0, urlsFailed: 0, webSearches: 1 };
  }
}

function countWords(text: string): number {
  return text
    .replace(/[#*_`~\[\]()>|]/g, "")
    .split(/\s+/)
    .filter((w) => w.length > 0).length;
}

// ─── Main generation function ───────────────────────────────────────────────

export interface GenerateLongFormContentParams {
  accountId: number;
  topic: string;
  customPrompt?: string | null;
  aiModel?: string;
  enableWebResearch?: boolean | null;
  shouldGenerateImage?: boolean | null;
  templateId?: number;
}

export interface GenerateLongFormContentResult {
  id: number;
  title: string;
  content: string;
  metaDescription: string;
  imageUrl: string | null;
  imagePrompt: string;
  wordCount: number;
  generationTimeMs: number;
}

export async function generateLongFormContent(
  params: GenerateLongFormContentParams
): Promise<GenerateLongFormContentResult> {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");

  const startTime = Date.now();

  // Get brand voice
  const [brandVoice] = await db
    .select()
    .from(contentBrandVoice)
    .where(eq(contentBrandVoice.accountId, params.accountId))
    .limit(1);

  // Get template if specified
  let templatePrompt = "";
  let templateStructure = "";
  if (params.templateId) {
    const [template] = await db
      .select()
      .from(contentTemplates)
      .where(eq(contentTemplates.id, params.templateId))
      .limit(1);
    if (template) {
      templatePrompt = template.prompt
        ? template.prompt.replace(/\{\{topic\}\}/g, params.topic)
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
  if (params.enableWebResearch) {
    const research = await fetchWebResearch(params.topic);
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
    params.customPrompt ||
    `Write a comprehensive, well-researched blog post about "${params.topic}".`;

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
    model: params.aiModel || "gemini-2.5-flash",
    messages: [
      { role: "system", content: systemPrompt },
      {
        role: "user",
        content: `Generate a long-form blog post about: ${params.topic}`,
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
              description: "The full blog post content in Markdown format",
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
          required: ["title", "content", "metaDescription", "imagePrompt"],
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
    throw new Error("Failed to parse LLM response");
  }

  const generationTimeMs = Date.now() - startTime;
  const wordCount = countWords(parsed.content);
  const inputTokens = response.usage?.prompt_tokens ?? 0;
  const outputTokens = response.usage?.completion_tokens ?? 0;
  const totalTokens = response.usage?.total_tokens ?? 0;

  // Generate image if requested
  let imageUrl: string | null = null;
  if (params.shouldGenerateImage && parsed.imagePrompt) {
    try {
      const { generateImage } = await import("../_core/imageGeneration");
      const imgResult = await generateImage({ prompt: parsed.imagePrompt });
      const tempUrl = imgResult.url;
      if (tempUrl) {
        try {
          const { storagePut } = await import("../storage");
          const imgResponse = await fetch(tempUrl);
          const buffer = Buffer.from(await imgResponse.arrayBuffer());
          const key = `content-images/${Date.now()}-${Math.random().toString(36).slice(2)}.jpg`;
          const stored = await storagePut(key, buffer, "image/jpeg");
          imageUrl = stored.url ?? tempUrl;
        } catch (err) {
          console.error("[longFormContentService] Image storage upload failed:", err);
          imageUrl = tempUrl;
        }
      }
    } catch (err) {
      console.error("[longFormContentService] Image generation failed:", err);
    }
  }

  // Save to database (no userId since this can be called from a worker)
  const [result] = await db.insert(longFormContent).values({
    accountId: params.accountId,
    createdByUserId: 0, // system-generated
    title: parsed.title,
    topic: params.topic,
    content: parsed.content,
    imageUrl,
    imagePrompt: parsed.imagePrompt,
    status: "draft",
    aiModel: params.aiModel || "gemini-2.5-flash",
    customPrompt: params.customPrompt || null,
    inputTokens,
    outputTokens,
    totalTokens,
    urlsFetched,
    urlsFailed,
    webSearches,
    wordCount,
    generationTimeMs,
  });

  return {
    id: result.insertId,
    title: parsed.title,
    content: parsed.content,
    metaDescription: parsed.metaDescription,
    imageUrl,
    imagePrompt: parsed.imagePrompt,
    wordCount,
    generationTimeMs,
  };
}
