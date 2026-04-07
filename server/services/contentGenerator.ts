import { invokeLLM } from "../_core/llm";
import { ENV } from "../_core/env";

// ─── Types ──────────────────────────────────────────────────────────────────

export type Platform = "facebook" | "instagram" | "linkedin" | "twitter";
export type Tone = "professional" | "casual" | "funny" | "inspiring" | "educational";

export interface BrandVoice {
  industry?: string | null;
  targetAudience?: string | null;
  brandPersonality?: string | null;
  keyMessages?: string | null; // JSON array string
  avoidTopics?: string | null; // JSON array string
  preferredTone?: string | null;
  examplePosts?: string | null; // JSON array string
}

export interface AccountContext {
  businessName: string;
  industry?: string | null;
}

export interface GeneratedPost {
  content: string;
  hashtags: string[];
  imagePrompt: string;
}

export interface GeneratePostResult {
  variations: GeneratedPost[];
}

// ─── Platform-specific rules ────────────────────────────────────────────────

const PLATFORM_RULES: Record<Platform, string> = {
  twitter:
    "Max 280 characters. Punchy and direct. 2-3 hashtags max. No fluff.",
  instagram:
    "Engaging caption 150-300 words. 10-15 relevant hashtags. Emoji-friendly. Story-driven.",
  facebook:
    "Conversational 100-200 words. 2-3 hashtags. Ask a question to drive engagement.",
  linkedin:
    "Professional tone. 150-300 words. Industry insights. 3-5 hashtags. No excessive emoji.",
};

const PLATFORM_CHAR_LIMITS: Record<Platform, number> = {
  twitter: 280,
  instagram: 2200,
  facebook: 63206,
  linkedin: 3000,
};

// ─── Helpers ────────────────────────────────────────────────────────────────

function parseJsonArray(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function buildBrandVoiceSection(bv: BrandVoice | undefined): string {
  if (!bv) return "No brand voice configured. Use a professional, helpful tone.";

  const parts: string[] = [];
  if (bv.industry) parts.push(`Industry: ${bv.industry}`);
  if (bv.targetAudience) parts.push(`Target audience: ${bv.targetAudience}`);
  if (bv.brandPersonality) parts.push(`Brand personality: ${bv.brandPersonality}`);

  const keyMessages = parseJsonArray(bv.keyMessages);
  if (keyMessages.length) parts.push(`Key messages: ${keyMessages.join(", ")}`);

  const avoidTopics = parseJsonArray(bv.avoidTopics);
  if (avoidTopics.length) parts.push(`Topics to avoid: ${avoidTopics.join(", ")}`);

  const examplePosts = parseJsonArray(bv.examplePosts);
  if (examplePosts.length) {
    parts.push(`Example posts for style reference:\n${examplePosts.map((p, i) => `  ${i + 1}. "${p}"`).join("\n")}`);
  }

  return parts.length ? parts.join("\n") : "No brand voice configured. Use a professional, helpful tone.";
}

// ─── Web Research Helper ────────────────────────────────────────────────────

async function fetchSocialWebResearch(topic: string): Promise<string> {
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
      console.warn(`[contentGenerator] Web research failed: ${response.status}`);
      return "";
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
    for (const result of (Array.isArray(results) ? results : []).slice(0, 3)) {
      const title = result.title || result.name || "";
      const snippet = result.snippet || result.description || result.content || "";
      if (title || snippet) {
        snippets.push(`Source: ${title}\n${snippet}`);
      }
    }

    return snippets.length
      ? `\n\nWEB RESEARCH CONTEXT (use these facts to make the post more current and credible):\n${snippets.join("\n\n---\n\n")}`
      : "";
  } catch (err) {
    console.error("[contentGenerator] Web research error:", err);
    return "";
  }
}

// ─── Main generator ─────────────────────────────────────────────────────────

export async function generateSocialPost(params: {
  accountId: number;
  platform: Platform;
  topic: string;
  tone: Tone;
  additionalContext?: string;
  brandVoice?: BrandVoice;
  accountContext?: AccountContext;
  aiModel?: string;
  enableWebResearch?: boolean;
}): Promise<GeneratePostResult> {
  const { platform, topic, tone, additionalContext, brandVoice, accountContext, aiModel, enableWebResearch } = params;

  const businessName = accountContext?.businessName || "the business";
  const brandSection = buildBrandVoiceSection(brandVoice);
  const charLimit = PLATFORM_CHAR_LIMITS[platform];

  const systemPrompt = `You are a social media content expert specializing in creating high-engagement posts for ${accountContext?.industry || "business"} companies.

Business: ${businessName}

BRAND VOICE:
${brandSection}

TONE: ${tone}

PLATFORM RULES (${platform}):
${PLATFORM_RULES[platform]}
Character limit: ${charLimit} characters for the main content (excluding hashtags for Instagram).

INSTRUCTIONS:
- Generate exactly 3 unique variations of a social media post about the given topic.
- Each variation should have a different angle or hook while maintaining the same core message.
- Include relevant hashtags for each variation.
- For each variation, provide a detailed image prompt describing the ideal visual to accompany the post.
- The image prompt should be descriptive enough for an AI image generator (describe composition, style, colors, mood).
- Ensure all content is original, engaging, and appropriate for the platform.
- Do NOT include the hashtags inside the main content text for any platform. Return them separately.
${additionalContext ? `\nADDITIONAL CONTEXT: ${additionalContext}` : ""}

Return your response as valid JSON matching this exact schema.`;

  // Optionally fetch web research
  let researchContext = "";
  if (enableWebResearch) {
    researchContext = await fetchSocialWebResearch(topic);
  }

  const finalSystemPrompt = researchContext ? systemPrompt + researchContext : systemPrompt;

  const response = await invokeLLM({
    model: aiModel || "gemini-2.5-flash",
    messages: [
      { role: "system", content: finalSystemPrompt },
      { role: "user", content: `Generate 3 social media post variations about: ${topic}` },
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "social_posts",
        strict: true,
        schema: {
          type: "object",
          properties: {
            posts: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  content: {
                    type: "string",
                    description: "The main post text content without hashtags",
                  },
                  hashtags: {
                    type: "array",
                    items: { type: "string" },
                    description: "Array of hashtags without the # symbol",
                  },
                  imagePrompt: {
                    type: "string",
                    description: "Detailed prompt for generating an accompanying image",
                  },
                },
                required: ["content", "hashtags", "imagePrompt"],
                additionalProperties: false,
              },
            },
          },
          required: ["posts"],
          additionalProperties: false,
        },
      },
    },
  });

  const rawContent = response.choices?.[0]?.message?.content;
  const raw = typeof rawContent === "string" ? rawContent : JSON.stringify(rawContent);
  if (!raw) {
    throw new Error("LLM returned empty response");
  }

  let parsed: { posts: GeneratedPost[] };
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("Failed to parse LLM response as JSON");
  }

  if (!parsed.posts || !Array.isArray(parsed.posts) || parsed.posts.length === 0) {
    throw new Error("LLM returned invalid post structure");
  }

  // Normalize hashtags (remove # prefix if present)
  const variations: GeneratedPost[] = parsed.posts.slice(0, 3).map((post) => ({
    content: post.content || "",
    hashtags: (post.hashtags || []).map((h: string) => h.replace(/^#/, "")),
    imagePrompt: post.imagePrompt || "",
  }));

  return { variations };
}

// ─── Content Calendar Generator ─────────────────────────────────────────────

export async function generateContentCalendar(params: {
  accountId: number;
  platforms: Platform[];
  postsPerPlatform: number;
  topics: string[];
  tone: Tone;
  brandVoice?: BrandVoice;
  accountContext?: AccountContext;
  aiModel?: string;
}): Promise<{ posts: Array<GeneratedPost & { platform: Platform; topic: string }> }> {
  const { platforms, postsPerPlatform, topics, tone, brandVoice, accountContext, aiModel } = params;

  const businessName = accountContext?.businessName || "the business";
  const brandSection = buildBrandVoiceSection(brandVoice);
  const totalPosts = platforms.length * postsPerPlatform;

  const systemPrompt = `You are a social media content calendar expert for ${accountContext?.industry || "business"} companies.

Business: ${businessName}

BRAND VOICE:
${brandSection}

TONE: ${tone}

Generate a content calendar with ${totalPosts} posts total:
${platforms.map((p) => `- ${postsPerPlatform} posts for ${p} (rules: ${PLATFORM_RULES[p]})`).join("\n")}

Topics to cover: ${topics.join(", ")}

For each post, provide the platform, topic, content, hashtags, and an image prompt.
Distribute topics evenly across the posts. Vary the angles and hooks.
Do NOT include hashtags inside the main content text. Return them separately.

Return your response as valid JSON matching this exact schema.`;

  const response = await invokeLLM({
    model: aiModel || "gemini-2.5-flash",
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: `Generate a content calendar with ${totalPosts} posts across ${platforms.join(", ")} about: ${topics.join(", ")}` },
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "content_calendar",
        strict: true,
        schema: {
          type: "object",
          properties: {
            posts: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  platform: {
                    type: "string",
                    description: "The social media platform",
                  },
                  topic: {
                    type: "string",
                    description: "The topic of this post",
                  },
                  content: {
                    type: "string",
                    description: "The main post text content without hashtags",
                  },
                  hashtags: {
                    type: "array",
                    items: { type: "string" },
                    description: "Array of hashtags without the # symbol",
                  },
                  imagePrompt: {
                    type: "string",
                    description: "Detailed prompt for generating an accompanying image",
                  },
                },
                required: ["platform", "topic", "content", "hashtags", "imagePrompt"],
                additionalProperties: false,
              },
            },
          },
          required: ["posts"],
          additionalProperties: false,
        },
      },
    },
  });

  const rawContent2 = response.choices?.[0]?.message?.content;
  const raw = typeof rawContent2 === "string" ? rawContent2 : JSON.stringify(rawContent2);
  if (!raw) throw new Error("LLM returned empty response");

  let parsed: { posts: Array<GeneratedPost & { platform: string; topic: string }> };
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("Failed to parse LLM calendar response as JSON");
  }

  // Normalize
  const posts = (parsed.posts || []).map((p) => ({
    platform: p.platform as Platform,
    topic: p.topic || "",
    content: p.content || "",
    hashtags: (p.hashtags || []).map((h: string) => h.replace(/^#/, "")),
    imagePrompt: p.imagePrompt || "",
  }));

  return { posts };
}
