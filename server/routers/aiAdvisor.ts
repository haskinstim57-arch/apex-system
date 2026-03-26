import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { TRPCError } from "@trpc/server";
import { getMember, getDb } from "../db";
import { invokeLLM, type Message } from "../_core/llm";
import {
  contacts,
  messages,
  aiCalls,
  deals,
  pipelineStages,
  appointments,
  campaigns,
  campaignRecipients,
  workflows,
  workflowExecutions,
} from "../../drizzle/schema";
import { and, eq, gte, lte, sql, count } from "drizzle-orm";

// ─── Helpers ───

async function requireAccountMember(userId: number, accountId: number, userRole?: string) {
  if (userRole === "admin") {
    const member = await getMember(accountId, userId);
    if (member) return member;
    return { userId, accountId, role: "owner" as const, isActive: true };
  }
  const member = await getMember(accountId, userId);
  if (!member || !member.isActive) {
    throw new TRPCError({ code: "FORBIDDEN", message: "You do not have access to this account" });
  }
  return member;
}

// ─── Gather account context for AI ───

async function gatherAccountContext(accountId: number, pageContext?: string) {
  const db = (await getDb())!;
  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  // Contacts
  const [totalContacts] = await db
    .select({ count: count() })
    .from(contacts)
    .where(eq(contacts.accountId, accountId));

  const [newContacts7d] = await db
    .select({ count: count() })
    .from(contacts)
    .where(and(eq(contacts.accountId, accountId), gte(contacts.createdAt, sevenDaysAgo)));

  const [uncontactedLeads] = await db.execute(
    sql`SELECT COUNT(*) AS cnt FROM contacts c
        WHERE c.accountId = ${accountId}
        AND c.id NOT IN (SELECT DISTINCT contactId FROM messages WHERE accountId = ${accountId})
        AND c.id NOT IN (SELECT DISTINCT contactId FROM ai_calls WHERE accountId = ${accountId})`
  );

  // Messages
  const [msgSent7d] = await db
    .select({ count: count() })
    .from(messages)
    .where(and(eq(messages.accountId, accountId), eq(messages.direction, "outbound"), gte(messages.createdAt, sevenDaysAgo)));

  const [msgReceived7d] = await db
    .select({ count: count() })
    .from(messages)
    .where(and(eq(messages.accountId, accountId), eq(messages.direction, "inbound"), gte(messages.createdAt, sevenDaysAgo)));

  const [unreadMessages] = await db
    .select({ count: count() })
    .from(messages)
    .where(and(eq(messages.accountId, accountId), eq(messages.direction, "inbound"), eq(messages.isRead, false)));

  // AI Calls
  const [calls7d] = await db
    .select({ count: count() })
    .from(aiCalls)
    .where(and(eq(aiCalls.accountId, accountId), gte(aiCalls.createdAt, sevenDaysAgo)));

  const [callsCompleted7d] = await db
    .select({ count: count() })
    .from(aiCalls)
    .where(and(eq(aiCalls.accountId, accountId), eq(aiCalls.status, "completed"), gte(aiCalls.createdAt, sevenDaysAgo)));

  const [callsNoAnswer7d] = await db
    .select({ count: count() })
    .from(aiCalls)
    .where(and(eq(aiCalls.accountId, accountId), eq(aiCalls.status, "no_answer"), gte(aiCalls.createdAt, sevenDaysAgo)));

  // Appointments
  const [appts7d] = await db
    .select({ count: count() })
    .from(appointments)
    .where(and(eq(appointments.accountId, accountId), gte(appointments.createdAt, sevenDaysAgo)));

  const [appts30d] = await db
    .select({ count: count() })
    .from(appointments)
    .where(and(eq(appointments.accountId, accountId), gte(appointments.createdAt, thirtyDaysAgo)));

  // Pipeline
  const pipelineData = await db
    .select({
      stageName: pipelineStages.name,
      dealCount: count(),
      totalValue: sql<number>`COALESCE(SUM(${deals.value}), 0)`,
    })
    .from(deals)
    .innerJoin(pipelineStages, eq(deals.stageId, pipelineStages.id))
    .where(eq(deals.accountId, accountId))
    .groupBy(pipelineStages.name);

  // Campaigns (last 30 days)
  const recentCampaigns = await db
    .select({
      id: campaigns.id,
      name: campaigns.name,
      type: campaigns.type,
      status: campaigns.status,
      totalRecipients: campaigns.totalRecipients,
      sentCount: campaigns.sentCount,
    })
    .from(campaigns)
    .where(and(eq(campaigns.accountId, accountId), gte(campaigns.createdAt, thirtyDaysAgo)))
    .orderBy(sql`${campaigns.createdAt} DESC`)
    .limit(5);

  // Workflows
  const [activeWorkflows] = await db
    .select({ count: count() })
    .from(workflows)
    .where(and(eq(workflows.accountId, accountId), eq(workflows.isActive, true)));

  const [failedExecutions7d] = await db
    .select({ count: count() })
    .from(workflowExecutions)
    .where(and(eq(workflowExecutions.accountId, accountId), eq(workflowExecutions.status, "failed"), gte(workflowExecutions.startedAt, sevenDaysAgo)));

  const uncontactedCount = (uncontactedLeads as any)?.[0]?.cnt ?? 0;
  const callsTotal = calls7d?.count ?? 0;
  const completed = callsCompleted7d?.count ?? 0;
  const noAnswer = callsNoAnswer7d?.count ?? 0;
  const connectRate = callsTotal > 0 ? Math.round((completed / callsTotal) * 100) : 0;

  return {
    contacts: {
      total: totalContacts?.count ?? 0,
      newLast7Days: newContacts7d?.count ?? 0,
      uncontacted: Number(uncontactedCount),
    },
    messages: {
      sentLast7Days: msgSent7d?.count ?? 0,
      receivedLast7Days: msgReceived7d?.count ?? 0,
      unread: unreadMessages?.count ?? 0,
    },
    calls: {
      totalLast7Days: callsTotal,
      completed,
      noAnswer,
      connectRate,
    },
    appointments: {
      last7Days: appts7d?.count ?? 0,
      last30Days: appts30d?.count ?? 0,
    },
    pipeline: pipelineData.map((s) => ({
      stage: s.stageName,
      deals: s.dealCount,
      value: Number(s.totalValue),
    })),
    campaigns: recentCampaigns.map((c) => ({
      name: c.name,
      type: c.type,
      status: c.status,
      recipients: c.totalRecipients,
      sent: c.sentCount,
    })),
    workflows: {
      active: activeWorkflows?.count ?? 0,
      failedExecutionsLast7Days: failedExecutions7d?.count ?? 0,
    },
    currentPage: pageContext || "dashboard",
  };
}

// ─── Build system prompt ───

function buildSystemPrompt(context: Awaited<ReturnType<typeof gatherAccountContext>>): string {
  return `You are the AI Advisor for Apex System CRM. You analyze account data and suggest specific, actionable improvements the user can execute immediately.

CURRENT ACCOUNT DATA:
- Contacts: ${context.contacts.total} total, ${context.contacts.newLast7Days} new (7d), ${context.contacts.uncontacted} never contacted
- Messages: ${context.messages.sentLast7Days} sent (7d), ${context.messages.receivedLast7Days} received (7d), ${context.messages.unread} unread
- AI Calls: ${context.calls.totalLast7Days} calls (7d), ${context.calls.connectRate}% connect rate, ${context.calls.noAnswer} no-answer
- Appointments: ${context.appointments.last7Days} booked (7d), ${context.appointments.last30Days} booked (30d)
- Pipeline: ${context.pipeline.map((s) => `${s.stage}: ${s.deals} deals ($${s.value})`).join(", ") || "No deals"}
- Recent Campaigns: ${context.campaigns.map((c) => `"${c.name}" (${c.type}, ${c.status}, ${c.sent}/${c.recipients} sent)`).join("; ") || "None"}
- Workflows: ${context.workflows.active} active, ${context.workflows.failedExecutionsLast7Days} failed executions (7d)
- Current Page: ${context.currentPage}

RULES:
1. Generate 3-5 specific, data-driven suggestions based on the actual numbers above
2. Each suggestion MUST reference real data (e.g., "You have 42 uncontacted leads" not "You might have leads")
3. Prioritize by impact: revenue-generating actions first, then engagement, then maintenance
4. Be specific about what will happen if the action is executed
5. Match suggestions to the current page context when possible
6. Keep language conversational but professional — you're a smart sales coach
7. If data shows a problem (low connect rate, unread messages, failed workflows), surface it as the top suggestion

RESPONSE FORMAT:
Return a JSON object with this exact structure:
{
  "suggestions": [
    {
      "id": "unique-id",
      "title": "Short action title (max 60 chars)",
      "explanation": "2-3 sentences explaining what the data shows and why this action matters",
      "impact": "high" | "medium" | "low",
      "actionType": "launch_campaign" | "start_ai_calls" | "create_workflow" | "assign_contacts" | "move_pipeline_stage" | "create_tasks" | "schedule_appointments" | "navigate" | "info_only",
      "actionParams": { ... action-specific parameters ... },
      "confirmationMessage": "Exact message to show user before executing (e.g., 'This will send an SMS campaign to 47 contacts...')"
    }
  ]
}

ACTION TYPES AND THEIR PARAMS:
- "launch_campaign": { "type": "sms"|"email", "targetTag": "...", "targetCount": N, "suggestedMessage": "..." }
- "start_ai_calls": { "targetTag": "...", "targetCount": N, "reason": "..." }
- "assign_contacts": { "criteria": "...", "count": N }
- "navigate": { "path": "/inbox" | "/contacts" | "/campaigns" | "/automations" | etc. }
- "info_only": {} (just informational, no execute button)`;
}

// ─── Router ───

export const aiAdvisorRouter = router({
  /** Get AI-generated suggestions based on account data and current page */
  getSuggestions: protectedProcedure
    .input(
      z.object({
        accountId: z.number(),
        pageContext: z.string().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      await requireAccountMember(ctx.user.id, input.accountId, ctx.user.role);

      const context = await gatherAccountContext(input.accountId, input.pageContext);
      const systemPrompt = buildSystemPrompt(context);

      try {
        const result = await invokeLLM({
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: `Analyze my account data and give me your top suggestions for the ${input.pageContext || "dashboard"} page. Return JSON only.` },
          ],
          responseFormat: { type: "json_object" },
        });

        const content = result.choices?.[0]?.message?.content;
        const text = typeof content === "string" ? content : Array.isArray(content) ? content.map((c) => ("text" in c ? c.text : "")).join("") : "";

        try {
          const parsed = JSON.parse(text);
          return {
            suggestions: parsed.suggestions || [],
            context: {
              totalContacts: context.contacts.total,
              uncontacted: context.contacts.uncontacted,
              unreadMessages: context.messages.unread,
              connectRate: context.calls.connectRate,
              appointmentsThisWeek: context.appointments.last7Days,
            },
          };
        } catch {
          return {
            suggestions: [
              {
                id: "parse-error",
                title: "AI analysis available",
                explanation: text.slice(0, 500),
                impact: "medium" as const,
                actionType: "info_only" as const,
                actionParams: {},
                confirmationMessage: "",
              },
            ],
            context: {
              totalContacts: context.contacts.total,
              uncontacted: context.contacts.uncontacted,
              unreadMessages: context.messages.unread,
              connectRate: context.calls.connectRate,
              appointmentsThisWeek: context.appointments.last7Days,
            },
          };
        }
      } catch (error: any) {
        // If LLM is not configured, return helpful fallback suggestions based on raw data
        return buildFallbackSuggestions(context);
      }
    }),

  /** Freeform chat with AI about the account */
  chat: protectedProcedure
    .input(
      z.object({
        accountId: z.number(),
        messages: z.array(
          z.object({
            role: z.enum(["system", "user", "assistant"]),
            content: z.string(),
          })
        ),
        pageContext: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await requireAccountMember(ctx.user.id, input.accountId, ctx.user.role);

      const context = await gatherAccountContext(input.accountId, input.pageContext);

      const systemMessage: Message = {
        role: "system",
        content: `You are the AI Advisor for Apex System CRM. You help users understand their CRM data and suggest actions.

CURRENT ACCOUNT DATA:
- ${context.contacts.total} contacts (${context.contacts.uncontacted} never contacted)
- ${context.messages.unread} unread messages
- ${context.calls.connectRate}% call connect rate (${context.calls.totalLast7Days} calls this week)
- ${context.appointments.last7Days} appointments this week
- ${context.workflows.active} active workflows, ${context.workflows.failedExecutionsLast7Days} failed (7d)
- Pipeline: ${context.pipeline.map((s) => `${s.stage}: ${s.deals} deals`).join(", ") || "Empty"}

Answer questions about the account data, suggest improvements, and help the user take action. Be specific and reference the actual numbers. Keep responses concise and actionable.`,
      };

      const llmMessages: Message[] = [systemMessage, ...input.messages];

      const result = await invokeLLM({ messages: llmMessages });

      const content = result.choices?.[0]?.message?.content;
      const text = typeof content === "string" ? content : Array.isArray(content) ? content.map((c) => ("text" in c ? c.text : "")).join("") : "";

      return { response: text };
    }),
});

// ─── Fallback suggestions when LLM is unavailable ───

function buildFallbackSuggestions(context: Awaited<ReturnType<typeof gatherAccountContext>>) {
  const suggestions: Array<{
    id: string;
    title: string;
    explanation: string;
    impact: string;
    actionType: string;
    actionParams: Record<string, unknown>;
    confirmationMessage: string;
  }> = [];

  if (context.messages.unread > 0) {
    suggestions.push({
      id: "unread-messages",
      title: `${context.messages.unread} unread messages waiting`,
      explanation: `You have ${context.messages.unread} unread inbound messages. Responding quickly increases conversion rates by up to 391%.`,
      impact: "high",
      actionType: "navigate",
      actionParams: { path: "/inbox" },
      confirmationMessage: "",
    });
  }

  if (context.contacts.uncontacted > 10) {
    suggestions.push({
      id: "uncontacted-leads",
      title: `${context.contacts.uncontacted} leads never contacted`,
      explanation: `You have ${context.contacts.uncontacted} contacts who have never received a message or call. Starting an outreach campaign could generate new appointments.`,
      impact: "high",
      actionType: "start_ai_calls",
      actionParams: { targetCount: Math.min(context.contacts.uncontacted, 50), reason: "uncontacted leads" },
      confirmationMessage: `This will start AI calls to up to ${Math.min(context.contacts.uncontacted, 50)} contacts who haven't been contacted yet.`,
    });
  }

  if (context.calls.connectRate < 30 && context.calls.totalLast7Days > 5) {
    suggestions.push({
      id: "low-connect-rate",
      title: `Connect rate is only ${context.calls.connectRate}%`,
      explanation: `Your AI call connect rate this week is ${context.calls.connectRate}% (${context.calls.completed} connected out of ${context.calls.totalLast7Days}). Try calling between 10 AM-12 PM for better results.`,
      impact: "medium",
      actionType: "info_only",
      actionParams: {},
      confirmationMessage: "",
    });
  }

  if (context.workflows.failedExecutionsLast7Days > 0) {
    suggestions.push({
      id: "failed-workflows",
      title: `${context.workflows.failedExecutionsLast7Days} workflow executions failed`,
      explanation: `${context.workflows.failedExecutionsLast7Days} automation workflows failed in the last 7 days. Check the automation logs to identify and fix the issue.`,
      impact: "high",
      actionType: "navigate",
      actionParams: { path: "/automations" },
      confirmationMessage: "",
    });
  }

  if (context.appointments.last7Days === 0 && context.contacts.total > 0) {
    suggestions.push({
      id: "no-appointments",
      title: "No appointments booked this week",
      explanation: `You have ${context.contacts.total} contacts but zero appointments this week. Consider launching a campaign or starting AI calls to book meetings.`,
      impact: "high",
      actionType: "launch_campaign",
      actionParams: { type: "sms", targetCount: Math.min(context.contacts.total, 50), suggestedMessage: "Hi {{firstName}}, I'd love to schedule a quick call. When works best for you?" },
      confirmationMessage: `This will create an SMS campaign targeting up to ${Math.min(context.contacts.total, 50)} contacts to book appointments.`,
    });
  }

  if (suggestions.length === 0) {
    suggestions.push({
      id: "all-good",
      title: "Your account is in good shape",
      explanation: `${context.contacts.total} contacts, ${context.appointments.last7Days} appointments this week, ${context.workflows.active} active workflows. Keep up the momentum!`,
      impact: "low",
      actionType: "info_only",
      actionParams: {},
      confirmationMessage: "",
    });
  }

  return {
    suggestions,
    context: {
      totalContacts: context.contacts.total,
      uncontacted: context.contacts.uncontacted,
      unreadMessages: context.messages.unread,
      connectRate: context.calls.connectRate,
      appointmentsThisWeek: context.appointments.last7Days,
    },
  };
}
