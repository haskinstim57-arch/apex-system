/**
 * Recurring Content Worker
 * Runs every hour, checks for due recurring content plans, and generates content.
 */
import { getDb } from "../db";
import { recurringContentPlans, socialPosts } from "../../drizzle/schema";
import { lte, eq, and } from "drizzle-orm";
import { invokeLLM } from "../_core/llm";
import { generateLongFormContent } from "./longFormContentService";
import { generateSocialPost } from "./contentGenerator";

// ─── Exported helpers ───────────────────────────────────────────────────────

export function computeNextRunAt(frequency: string): Date {
  const now = new Date();
  switch (frequency) {
    case "daily":
      return new Date(now.getTime() + 86400000);
    case "weekly":
      return new Date(now.getTime() + 7 * 86400000);
    case "biweekly":
      return new Date(now.getTime() + 14 * 86400000);
    case "monthly":
      return new Date(now.getTime() + 30 * 86400000);
    default:
      return new Date(now.getTime() + 7 * 86400000);
  }
}

// ─── Run a single plan ──────────────────────────────────────────────────────

export async function runRecurringPlan(
  plan: typeof recurringContentPlans.$inferSelect
): Promise<Array<{ topic: string; status: "success" | "failed"; id?: number; error?: string }>> {
  const results: Array<{ topic: string; status: "success" | "failed"; id?: number; error?: string }> = [];

  // Use LLM to expand topicTemplate into N distinct topics
  let topics: string[] = [];
  try {
    const topicsResponse = await invokeLLM({
      model: plan.aiModel || "gemini-2.5-flash",
      messages: [
        {
          role: "system",
          content: "You are a content strategist. Generate distinct, specific topic ideas based on a template.",
        },
        {
          role: "user",
          content: `Generate exactly ${plan.postsPerCycle} distinct, specific topic ideas based on this template: "${plan.topicTemplate}". Return ONLY a JSON array of strings, no explanation. Example: ["Topic 1", "Topic 2"]`,
        },
      ],
    });

    const raw = topicsResponse.choices?.[0]?.message?.content;
    const rawStr = typeof raw === "string" ? raw : JSON.stringify(raw);
    const match = rawStr?.match(/\[[\s\S]*\]/);
    topics = match ? JSON.parse(match[0]) : [plan.topicTemplate];
  } catch {
    topics = [plan.topicTemplate];
  }
  topics = topics.slice(0, plan.postsPerCycle);

  for (const topic of topics) {
    try {
      if (plan.contentType === "blog") {
        const result = await generateLongFormContent({
          accountId: plan.accountId,
          topic,
          customPrompt: plan.customPrompt,
          aiModel: plan.aiModel || "gemini-2.5-flash",
          enableWebResearch: plan.enableWebResearch,
          shouldGenerateImage: plan.enableImageGeneration,
        });
        results.push({ topic, status: "success", id: result.id });
      } else {
        // Social post
        const post = await generateSocialPost({
          accountId: plan.accountId,
          platform: (plan.platform as any) || "instagram",
          tone: (plan.tone as any) || "professional",
          topic,
          aiModel: plan.aiModel || "gemini-2.5-flash",
          enableWebResearch: plan.enableWebResearch ?? false,
          variationsCount: 1,
        });

        // Save first variation as draft in socialPosts table
        const db = await getDb();
        if (db && post.variations.length > 0) {
          const variation = post.variations[0];
          const [saved] = await db.insert(socialPosts).values({
            accountId: plan.accountId,
            createdByUserId: 0, // system-generated
            platform: (plan.platform as any) || "instagram",
            content: variation.content,
            hashtags: JSON.stringify(variation.hashtags),
            imageUrl: variation.imageUrl || null,
            imagePrompt: variation.imagePrompt || null,
            status: "draft",
            tone: plan.tone || "professional",
            topic,
          });
          results.push({ topic, status: "success", id: saved?.insertId });
        } else {
          results.push({ topic, status: "failed", error: "Database unavailable or no variations generated" });
        }
      }
    } catch (err: any) {
      results.push({ topic, status: "failed", error: err.message });
    }
  }

  // Update plan stats
  const db = await getDb();
  if (db) {
    await db
      .update(recurringContentPlans)
      .set({
        lastRunAt: new Date(),
        nextRunAt: computeNextRunAt(plan.frequency),
        runCount: (plan.runCount || 0) + 1,
        lastRunResult: JSON.stringify({
          generated: results.filter((r) => r.status === "success").length,
          failed: results.filter((r) => r.status === "failed").length,
          topics: results,
        }),
      })
      .where(eq(recurringContentPlans.id, plan.id));
  }

  return results;
}

// ─── Process all due plans ──────────────────────────────────────────────────

export async function processDueRecurringPlans(): Promise<void> {
  const db = await getDb();
  if (!db) return;

  const now = new Date();
  const duePlans = await db
    .select()
    .from(recurringContentPlans)
    .where(
      and(
        eq(recurringContentPlans.isActive, true),
        lte(recurringContentPlans.nextRunAt, now)
      )
    );

  for (const plan of duePlans) {
    try {
      console.log(`[RecurringContent] Running plan ${plan.id}: "${plan.name}"`);
      await runRecurringPlan(plan);
      console.log(`[RecurringContent] Plan ${plan.id} completed`);
    } catch (err) {
      console.error(`[RecurringContent] Plan ${plan.id} failed:`, err);
    }
  }
}

// ─── Worker start ───────────────────────────────────────────────────────────

export function startRecurringContentWorker(): void {
  console.log("[RecurringContent] Worker started (interval: 1 hour)");
  // Run once on startup after a short delay
  setTimeout(() => processDueRecurringPlans().catch(console.error), 30_000);
  // Then every hour
  setInterval(() => processDueRecurringPlans().catch(console.error), 60 * 60 * 1000);
}

// Export test helpers
export const _test = { computeNextRunAt };
