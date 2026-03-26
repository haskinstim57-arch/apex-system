import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { invokeLLM } from "../_core/llm";
import * as db from "../db";
import { TRPCError } from "@trpc/server";

// ─────────────────────────────────────────────
// SYSTEM PROMPT
// ─────────────────────────────────────────────

const SYSTEM_PROMPT = `You are the Apex System AI Advisor — a smart CRM copilot built into the Apex System platform for loan officers and real estate professionals.

Your job is to help users get more out of their CRM by:
- Analyzing their account data (contacts, deals, campaigns, calls, appointments) and providing actionable insights
- Suggesting next best actions based on pipeline status, follow-up gaps, and lead activity
- Answering questions about how to use CRM features
- Helping draft messages, emails, and call scripts
- Identifying opportunities they might be missing

PERSONALITY:
- Be direct, concise, and action-oriented
- Use data to back up suggestions when available
- Format responses with clear headers and bullet points when listing multiple items
- Keep responses focused — no fluff

CONTEXT:
You will receive a JSON summary of the user's current account data as context. Use it to give personalized, data-driven advice. If you don't have enough data to answer, say so and suggest what the user should do.

When suggesting actions, be specific: mention contact names, deal amounts, dates, etc. from the data provided.`;

// ─────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────

async function buildAccountContext(accountId: number) {
  try {
    const [
      contactStats,
      messageStats,
      aiCallStats,
      campaignStats,
      accountDashboard,
    ] = await Promise.all([
      db.getContactStats(accountId),
      db.getMessageStats(accountId),
      db.getAICallStats(accountId),
      db.getCampaignStats(accountId),
      db.getAccountDashboardStats(accountId),
    ]);

    // Get recent contacts (last 10 added)
    const recentContacts = await db.listContacts({
      accountId,
      limit: 10,
      offset: 0,
    });

    // Get upcoming appointments
    const now = new Date();
    const weekFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const appointments = await db.getAppointments(accountId, {
      startDate: now,
      endDate: weekFromNow,
    });

    return {
      contacts: contactStats,
      messages: messageStats,
      aiCalls: aiCallStats,
      campaigns: campaignStats,
      dashboard: accountDashboard,
      recentContacts: recentContacts.data.map((c: any) => ({
        id: c.id,
        name: `${c.firstName || ""} ${c.lastName || ""}`.trim(),
        email: c.email,
        phone: c.phone,
        status: c.status,
        source: c.source,
        assignedTo: c.assignedToName,
        lastActivity: c.lastActivityAt,
        createdAt: c.createdAt,
      })),
      upcomingAppointments: appointments.map((a: any) => ({
        id: a.id,
        title: a.title,
        startTime: a.startTime,
        endTime: a.endTime,
        status: a.status,
        contactName: a.contactName,
      })),
    };
  } catch (error) {
    console.error("[AI Advisor] Error building context:", error);
    return { error: "Could not load full account data" };
  }
}

// ─────────────────────────────────────────────
// SUGGESTIONS GENERATOR
// ─────────────────────────────────────────────

async function generateSuggestions(accountId: number, pageContext: string) {
  const context = await buildAccountContext(accountId);

  const result = await invokeLLM({
    messages: [
      {
        role: "system",
        content: `You are the Apex System AI Advisor. Based on the account data and current page context, generate 3-5 quick actionable suggestions. Each suggestion should be specific and immediately actionable.

Return a JSON array of objects with this schema:
[{ "title": "short title", "description": "1-2 sentence explanation", "priority": "high" | "medium" | "low", "category": "follow-up" | "pipeline" | "campaign" | "call" | "general" }]

Only return the JSON array, no other text.`,
      },
      {
        role: "user",
        content: `Account data:\n${JSON.stringify(context, null, 2)}\n\nCurrent page: ${pageContext}`,
      },
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "suggestions",
        strict: true,
        schema: {
          type: "object",
          properties: {
            suggestions: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  title: { type: "string" },
                  description: { type: "string" },
                  priority: { type: "string", enum: ["high", "medium", "low"] },
                  category: { type: "string", enum: ["follow-up", "pipeline", "campaign", "call", "general"] },
                },
                required: ["title", "description", "priority", "category"],
                additionalProperties: false,
              },
            },
          },
          required: ["suggestions"],
          additionalProperties: false,
        },
      },
    },
  });

  const content = result.choices[0]?.message?.content;
  if (typeof content === "string") {
    try {
      const parsed = JSON.parse(content);
      return parsed.suggestions || parsed;
    } catch {
      return [];
    }
  }
  return [];
}

// ─────────────────────────────────────────────
// ROUTER
// ─────────────────────────────────────────────

export const aiAdvisorRouter = router({
  /** Get AI-generated suggestions for the current page context */
  getSuggestions: protectedProcedure
    .input(
      z.object({
        accountId: z.number(),
        pageContext: z.string().default("dashboard"),
      })
    )
    .query(async ({ input }) => {
      const suggestions = await generateSuggestions(
        input.accountId,
        input.pageContext
      );
      return { suggestions };
    }),

  /** Send a chat message to the AI Advisor and get a response */
  chat: protectedProcedure
    .input(
      z.object({
        accountId: z.number(),
        message: z.string().min(1).max(2000),
        history: z
          .array(
            z.object({
              role: z.enum(["user", "assistant"]),
              content: z.string(),
            })
          )
          .default([]),
        pageContext: z.string().default("dashboard"),
      })
    )
    .mutation(async ({ input }) => {
      const context = await buildAccountContext(input.accountId);

      const messages: Array<{ role: "system" | "user" | "assistant"; content: string }> = [
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "user",
          content: `[ACCOUNT CONTEXT]\n${JSON.stringify(context, null, 2)}\n\n[CURRENT PAGE]: ${input.pageContext}`,
        },
        { role: "assistant", content: "I've reviewed your account data. How can I help?" },
        ...input.history.map((m) => ({
          role: m.role as "user" | "assistant",
          content: m.content,
        })),
        { role: "user", content: input.message },
      ];

      const result = await invokeLLM({ messages });

      const responseContent = result.choices[0]?.message?.content;
      const reply =
        typeof responseContent === "string"
          ? responseContent
          : Array.isArray(responseContent)
            ? responseContent
                .filter((c): c is { type: "text"; text: string } => c.type === "text")
                .map((c) => c.text)
                .join("")
            : "I'm sorry, I couldn't generate a response. Please try again.";

      return { reply };
    }),
});
