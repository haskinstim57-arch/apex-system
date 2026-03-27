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
  aiAdvisorMessages,
} from "../../drizzle/schema";
import { and, eq, gte, lte, sql, count, desc } from "drizzle-orm";

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

// ─── Gather FULL account context for AI ───

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

  // Upcoming appointments (next 7 days)
  const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  const [upcomingAppts] = await db
    .select({ count: count() })
    .from(appointments)
    .where(and(eq(appointments.accountId, accountId), gte(appointments.startTime, now), lte(appointments.startTime, sevenDaysFromNow)));

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

  const [totalPipelineValue] = await db
    .select({ total: sql<number>`COALESCE(SUM(${deals.value}), 0)` })
    .from(deals)
    .where(eq(deals.accountId, accountId));

  const [totalDeals] = await db
    .select({ count: count() })
    .from(deals)
    .where(eq(deals.accountId, accountId));

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

  const [draftCampaigns] = await db
    .select({ count: count() })
    .from(campaigns)
    .where(and(eq(campaigns.accountId, accountId), eq(campaigns.status, "draft")));

  const [scheduledCampaigns] = await db
    .select({ count: count() })
    .from(campaigns)
    .where(and(eq(campaigns.accountId, accountId), eq(campaigns.status, "scheduled")));

  // Workflows
  const [activeWorkflows] = await db
    .select({ count: count() })
    .from(workflows)
    .where(and(eq(workflows.accountId, accountId), eq(workflows.isActive, true)));

  const [inactiveWorkflows] = await db
    .select({ count: count() })
    .from(workflows)
    .where(and(eq(workflows.accountId, accountId), eq(workflows.isActive, false)));

  const [failedExecutions7d] = await db
    .select({ count: count() })
    .from(workflowExecutions)
    .where(and(eq(workflowExecutions.accountId, accountId), eq(workflowExecutions.status, "failed"), gte(workflowExecutions.startedAt, sevenDaysAgo)));

  const [successfulExecutions7d] = await db
    .select({ count: count() })
    .from(workflowExecutions)
    .where(and(eq(workflowExecutions.accountId, accountId), eq(workflowExecutions.status, "completed"), gte(workflowExecutions.startedAt, sevenDaysAgo)));

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
      upcoming: upcomingAppts?.count ?? 0,
    },
    pipeline: pipelineData.map((s) => ({
      stage: s.stageName,
      deals: s.dealCount,
      value: Number(s.totalValue),
    })),
    pipelineSummary: {
      totalDeals: totalDeals?.count ?? 0,
      totalValue: Number(totalPipelineValue?.total ?? 0),
    },
    campaigns: recentCampaigns.map((c) => ({
      name: c.name,
      type: c.type,
      status: c.status,
      recipients: c.totalRecipients,
      sent: c.sentCount,
    })),
    campaignSummary: {
      drafts: draftCampaigns?.count ?? 0,
      scheduled: scheduledCampaigns?.count ?? 0,
    },
    workflows: {
      active: activeWorkflows?.count ?? 0,
      inactive: inactiveWorkflows?.count ?? 0,
      failedExecutionsLast7Days: failedExecutions7d?.count ?? 0,
      successfulExecutionsLast7Days: successfulExecutions7d?.count ?? 0,
    },
    currentPage: pageContext || "dashboard",
  };
}

// ─── Page-specific system prompt builder ───
// Each page gets a focused prompt that tells the LLM what to concentrate on,
// what data is most relevant, and what kinds of suggestions to generate.

function buildSystemPrompt(context: Awaited<ReturnType<typeof gatherAccountContext>>): string {
  const page = context.currentPage;

  // Shared data block used by all pages
  const sharedData = `
FULL ACCOUNT SNAPSHOT:
- Contacts: ${context.contacts.total} total, ${context.contacts.newLast7Days} new (7d), ${context.contacts.uncontacted} never contacted
- Messages: ${context.messages.sentLast7Days} sent (7d), ${context.messages.receivedLast7Days} received (7d), ${context.messages.unread} unread
- AI Calls: ${context.calls.totalLast7Days} calls (7d), ${context.calls.connectRate}% connect rate, ${context.calls.noAnswer} no-answer
- Appointments: ${context.appointments.last7Days} booked (7d), ${context.appointments.last30Days} booked (30d), ${context.appointments.upcoming} upcoming
- Pipeline: ${context.pipeline.map((s) => `${s.stage}: ${s.deals} deals ($${s.value.toLocaleString()})`).join(", ") || "No deals"} | Total: ${context.pipelineSummary.totalDeals} deals ($${context.pipelineSummary.totalValue.toLocaleString()})
- Campaigns (30d): ${context.campaigns.map((c) => `"${c.name}" (${c.type}, ${c.status}, ${c.sent}/${c.recipients} sent)`).join("; ") || "None"} | Drafts: ${context.campaignSummary.drafts}, Scheduled: ${context.campaignSummary.scheduled}
- Workflows: ${context.workflows.active} active, ${context.workflows.inactive} inactive, ${context.workflows.failedExecutionsLast7Days} failed (7d), ${context.workflows.successfulExecutionsLast7Days} successful (7d)`.trim();

  // Per-page focus instructions
  const pageFocusMap: Record<string, string> = {
    dashboard: `The user is on the DASHBOARD (overview) page. Give a broad health-check across all areas of the account. Surface the single most critical issue first (e.g. unread messages, failed workflows, uncontacted leads), then give a balanced mix of suggestions covering engagement, pipeline, and automation health.`,

    contacts: `The user is on the CONTACTS page. Focus ONLY on contact-related suggestions:
- Uncontacted leads that need outreach (${context.contacts.uncontacted} never contacted)
- New contacts added recently (${context.contacts.newLast7Days} in 7d) that haven't been engaged
- Segmentation or tagging opportunities to improve targeting
- Suggestions to start AI calls or SMS campaigns specifically for contact lists
- Data hygiene (duplicates, missing info) if relevant
Do NOT suggest pipeline or campaign analytics improvements here — keep it contacts-focused.`,

    inbox: `The user is on the INBOX / CONVERSATIONS page. Focus ONLY on messaging and conversation suggestions:
- There are ${context.messages.unread} unread inbound messages — urgency and response time matter
- Outbound vs inbound ratio (${context.messages.sentLast7Days} sent vs ${context.messages.receivedLast7Days} received in 7d)
- Suggest template responses, quick-reply strategies, or workflow triggers for common replies
- Flag if response rate or engagement looks low
- Suggest moving hot conversations to pipeline deals or booking appointments
Do NOT suggest call campaigns or pipeline stages here — keep it inbox-focused.`,

    "ai-calls": `The user is on the AI CALLS page. Focus ONLY on call performance and outreach suggestions:
- Connect rate is ${context.calls.connectRate}% (${context.calls.completed} connected, ${context.calls.noAnswer} no-answer out of ${context.calls.totalLast7Days} calls in 7d)
- Best times to call, retry strategies for no-answers
- ${context.contacts.uncontacted} uncontacted leads that could be targeted with AI calls
- Script or goal improvements if connect rate is low
- Suggest follow-up SMS after no-answer calls to increase engagement
Do NOT suggest campaign or pipeline changes here — keep it call-focused.`,

    "power-dialer": `The user is on the POWER DIALER page. Focus ONLY on manual dialing efficiency and performance:
- Connect rate context: ${context.calls.connectRate}% overall (7d)
- Suggest prioritizing which contact segments to dial (e.g. warm leads, recent opt-ins)
- Recommend optimal call windows and list ordering strategies
- Flag if no-answer rate is high (${context.calls.noAnswer} no-answers in 7d) and suggest voicemail drop strategies
- Suggest pairing power dialer sessions with follow-up SMS workflows
Do NOT suggest AI call campaigns or email campaigns here — keep it power-dialer-focused.`,

    "dialer-analytics": `The user is on the DIALER ANALYTICS page. Focus ONLY on analyzing and improving dialing performance metrics:
- Connect rate is ${context.calls.connectRate}% — benchmark is typically 30-40% for warm lists
- ${context.calls.completed} completed vs ${context.calls.noAnswer} no-answer calls in 7d
- Suggest what the data means and what to change (call times, list quality, script)
- Identify trends and recommend A/B testing different call approaches
- Suggest exporting or segmenting data for deeper analysis
Do NOT suggest unrelated CRM actions — keep it analytics and dialing performance focused.`,

    campaigns: `The user is on the CAMPAIGNS page. Focus ONLY on campaign creation, performance, and optimization:
- Recent campaigns: ${context.campaigns.map((c) => `"${c.name}" ${c.sent}/${c.recipients} sent (${c.status})`).join("; ") || "None in 30d"}
- ${context.campaignSummary.drafts} draft campaigns sitting unsent — suggest reviewing and launching them
- ${context.campaignSummary.scheduled} scheduled campaigns coming up
- ${context.contacts.uncontacted} uncontacted leads who haven't received any campaign
- Suggest new campaign ideas based on the account's engagement data
- Recommend SMS vs email based on what's performing
Do NOT suggest pipeline or call analytics here — keep it campaigns-focused.`,

    automations: `The user is on the AUTOMATIONS / WORKFLOWS page. Focus ONLY on workflow health and automation opportunities:
- ${context.workflows.active} active workflows, ${context.workflows.inactive} inactive (consider reactivating or deleting)
- ${context.workflows.failedExecutionsLast7Days} failed workflow executions in 7d — this is critical if > 0
- ${context.workflows.successfulExecutionsLast7Days} successful executions in 7d
- Suggest automation gaps: e.g. no follow-up after no-answer calls, no welcome sequence for new contacts
- Recommend triggers that could be added based on account activity patterns
Do NOT suggest manual campaigns or pipeline moves here — keep it automation-focused.`,

    pipeline: `The user is on the PIPELINE page. Focus ONLY on deal progression and revenue suggestions:
- Pipeline breakdown: ${context.pipeline.map((s) => `${s.stage}: ${s.deals} deals ($${s.value.toLocaleString()})`).join(", ") || "No deals"}
- Total pipeline value: $${context.pipelineSummary.totalValue.toLocaleString()} across ${context.pipelineSummary.totalDeals} deals
- Identify stages with too many stalled deals and suggest follow-up actions
- Suggest moving deals forward with specific next steps (call, appointment, proposal)
- Flag if pipeline is empty or thin and recommend adding contacts as deals
- Recommend appointment booking for deals stuck in early stages
Do NOT suggest campaign blasts or workflow fixes here — keep it pipeline and deal-focused.`,

    calendar: `The user is on the CALENDAR / APPOINTMENTS page. Focus ONLY on appointment scheduling and booking optimization:
- ${context.appointments.last7Days} appointments booked in the last 7 days
- ${context.appointments.last30Days} appointments in the last 30 days
- ${context.appointments.upcoming} upcoming appointments in the next 7 days
- Suggest filling calendar gaps with outreach to warm leads
- Recommend reminder workflows for upcoming appointments to reduce no-shows
- If appointment volume is low, suggest launching a booking campaign
- Flag if there are pipeline deals with no associated appointment
Do NOT suggest call analytics or campaign performance here — keep it calendar and scheduling focused.`,

    analytics: `The user is on the ANALYTICS page. Focus ONLY on performance trends, KPIs, and data-driven improvements:
- Connect rate: ${context.calls.connectRate}% (7d) — is this trending up or down?
- Message engagement: ${context.messages.sentLast7Days} sent, ${context.messages.receivedLast7Days} received (7d)
- Appointment conversion: ${context.appointments.last7Days} this week vs ${context.appointments.last30Days} this month
- Pipeline value: $${context.pipelineSummary.totalValue.toLocaleString()} across ${context.pipelineSummary.totalDeals} deals
- Suggest which metrics to focus on improving and why
- Recommend specific actions that would move the needle on key KPIs
Do NOT suggest tactical one-off actions here — focus on strategic, data-driven insights.`,

    messages: `The user is on the MESSAGES page. Focus ONLY on message history, conversation quality, and follow-up:
- ${context.messages.unread} unread messages need attention
- ${context.messages.sentLast7Days} sent vs ${context.messages.receivedLast7Days} received in 7d
- Suggest follow-up sequences for conversations that have gone cold
- Recommend template creation for frequently sent messages
- Flag contacts who replied but haven't been responded to
Do NOT suggest call campaigns or pipeline changes here — keep it messaging-focused.`,

    settings: `The user is on the SETTINGS page. Focus ONLY on account configuration and setup improvements:
- ${context.workflows.active} active workflows — suggest reviewing automation settings
- ${context.campaigns.length > 0 ? "Campaigns are active" : "No recent campaigns"} — suggest checking sending limits and compliance settings
- Recommend setting up missed-call text-back if not already configured
- Suggest reviewing notification preferences and team member access
- Flag any configuration gaps that could be limiting performance
Keep suggestions practical and settings-relevant.`,
  };

  // Match page to focus instructions, with smart fallback for sub-paths
  let pageFocus = pageFocusMap[page];
  if (!pageFocus) {
    // Handle sub-paths like /settings/messaging, /campaigns/123, etc.
    const baseRoute = page.split("/")[0];
    pageFocus = pageFocusMap[baseRoute] || pageFocusMap["dashboard"];
  }

  return `You are the AI Advisor for Apex System CRM. You analyze account data and give specific, actionable suggestions tailored to the page the user is currently viewing.

${sharedData}

CURRENT PAGE: ${page}

YOUR FOCUS FOR THIS PAGE:
${pageFocus}

RULES:
1. Generate 3-5 suggestions that are SPECIFICALLY relevant to the current page — not generic account advice
2. Each suggestion MUST reference real data from the account snapshot above (e.g., "You have 42 uncontacted leads" not "You might have leads")
3. Prioritize by impact: revenue-generating actions first, then engagement, then maintenance
4. Be specific about what will happen if the action is executed
5. Keep language conversational but professional — you're a smart sales coach
6. If data shows a critical problem relevant to this page (e.g. unread messages on inbox, failed workflows on automations), surface it as the top suggestion
7. Do NOT give suggestions that belong to a completely different page — stay focused on what's visible and actionable HERE

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
            {
              role: "user",
              content: `I am on the ${input.pageContext || "dashboard"} page. Analyze my account data and give me your top suggestions specifically for what I can do on this page right now. Return JSON only.`,
            },
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
        // If LLM is not configured, return page-specific fallback suggestions
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
      const page = input.pageContext || "dashboard";

      const systemMessage: Message = {
        role: "system",
        content: `You are the AI Advisor for Apex System CRM. You help users understand their CRM data and suggest actions. The user is currently on the ${page} page, so bias your answers toward what's relevant there.

CURRENT ACCOUNT DATA:
- ${context.contacts.total} contacts (${context.contacts.uncontacted} never contacted, ${context.contacts.newLast7Days} new in 7d)
- ${context.messages.unread} unread messages (${context.messages.sentLast7Days} sent, ${context.messages.receivedLast7Days} received in 7d)
- ${context.calls.connectRate}% call connect rate (${context.calls.totalLast7Days} calls this week, ${context.calls.noAnswer} no-answer)
- ${context.appointments.last7Days} appointments this week, ${context.appointments.upcoming} upcoming
- ${context.workflows.active} active workflows, ${context.workflows.failedExecutionsLast7Days} failed (7d)
- Pipeline: ${context.pipeline.map((s) => `${s.stage}: ${s.deals} deals ($${s.value.toLocaleString()})`).join(", ") || "Empty"} | Total: $${context.pipelineSummary.totalValue.toLocaleString()}
- Campaigns (30d): ${context.campaigns.map((c) => `"${c.name}" ${c.sent}/${c.recipients} (${c.status})`).join("; ") || "None"}

Answer questions about the account data, suggest improvements, and help the user take action. Be specific and reference the actual numbers. Keep responses concise and actionable. When relevant, tie your answer back to what the user can do on the ${page} page.`,
      };

      const llmMessages: Message[] = [systemMessage, ...input.messages];

      const result = await invokeLLM({ messages: llmMessages });

      const content = result.choices?.[0]?.message?.content;
      const text = typeof content === "string" ? content : Array.isArray(content) ? content.map((c) => ("text" in c ? c.text : "")).join("") : "";

      // Persist both user and assistant messages
      const db = (await getDb())!;
      const lastUserMsg = input.messages[input.messages.length - 1];
      if (lastUserMsg && lastUserMsg.role === "user") {
        await db.insert(aiAdvisorMessages).values({
          accountId: input.accountId,
          userId: ctx.user.id,
          role: "user",
          content: lastUserMsg.content,
          pageContext: input.pageContext || "dashboard",
        });
      }
      if (text) {
        await db.insert(aiAdvisorMessages).values({
          accountId: input.accountId,
          userId: ctx.user.id,
          role: "assistant",
          content: text,
          pageContext: input.pageContext || "dashboard",
        });
      }

      return { response: text };
    }),

  /** Load persisted chat history for the current user + account */
  getChatHistory: protectedProcedure
    .input(
      z.object({
        accountId: z.number(),
        limit: z.number().min(1).max(200).optional().default(50),
      })
    )
    .query(async ({ ctx, input }) => {
      await requireAccountMember(ctx.user.id, input.accountId, ctx.user.role);
      const db = (await getDb())!;

      const rows = await db
        .select()
        .from(aiAdvisorMessages)
        .where(
          and(
            eq(aiAdvisorMessages.accountId, input.accountId),
            eq(aiAdvisorMessages.userId, ctx.user.id)
          )
        )
        .orderBy(desc(aiAdvisorMessages.createdAt))
        .limit(input.limit);

      // Return in chronological order (oldest first)
      return rows.reverse().map((r) => ({
        role: r.role as "user" | "assistant",
        content: r.content,
        pageContext: r.pageContext,
        createdAt: r.createdAt,
      }));
    }),

  /** Clear chat history for the current user + account */
  clearChatHistory: protectedProcedure
    .input(z.object({ accountId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      await requireAccountMember(ctx.user.id, input.accountId, ctx.user.role);
      const db = (await getDb())!;

      await db
        .delete(aiAdvisorMessages)
        .where(
          and(
            eq(aiAdvisorMessages.accountId, input.accountId),
            eq(aiAdvisorMessages.userId, ctx.user.id)
          )
        );

      return { success: true };
    }),
});

// ─── Page-specific fallback suggestions when LLM is unavailable ───

function buildFallbackSuggestions(context: Awaited<ReturnType<typeof gatherAccountContext>>) {
  const page = context.currentPage;

  const suggestions: Array<{
    id: string;
    title: string;
    explanation: string;
    impact: string;
    actionType: string;
    actionParams: Record<string, unknown>;
    confirmationMessage: string;
  }> = [];

  // ── INBOX page ──
  if (page === "inbox" || page === "messages") {
    if (context.messages.unread > 0) {
      suggestions.push({
        id: "unread-messages",
        title: `${context.messages.unread} unread messages need replies`,
        explanation: `You have ${context.messages.unread} unread inbound messages in your inbox. Responding quickly increases conversion rates by up to 391%. Don't let leads go cold.`,
        impact: "high",
        actionType: "info_only",
        actionParams: {},
        confirmationMessage: "",
      });
    }
    const ratio = context.messages.receivedLast7Days > 0
      ? Math.round((context.messages.sentLast7Days / context.messages.receivedLast7Days) * 100)
      : 0;
    if (context.messages.receivedLast7Days > 0 && ratio < 80) {
      suggestions.push({
        id: "reply-ratio",
        title: "Reply rate is below 80% this week",
        explanation: `You sent ${context.messages.sentLast7Days} messages but received ${context.messages.receivedLast7Days} inbound. A low reply ratio suggests some conversations are being missed. Consider setting up an auto-reply workflow.`,
        impact: "medium",
        actionType: "navigate",
        actionParams: { path: "/automations" },
        confirmationMessage: "",
      });
    }
    if (context.contacts.uncontacted > 0) {
      suggestions.push({
        id: "start-conversations",
        title: `${context.contacts.uncontacted} contacts have never been messaged`,
        explanation: `There are ${context.contacts.uncontacted} contacts in your CRM who haven't received any message or call. Start a conversation to move them into your pipeline.`,
        impact: "medium",
        actionType: "launch_campaign",
        actionParams: { type: "sms", targetCount: Math.min(context.contacts.uncontacted, 50), suggestedMessage: "Hi {{firstName}}, just reaching out — would love to connect!" },
        confirmationMessage: `This will create an SMS campaign targeting up to ${Math.min(context.contacts.uncontacted, 50)} uncontacted leads.`,
      });
    }
  }

  // ── CONTACTS page ──
  else if (page === "contacts") {
    if (context.contacts.uncontacted > 10) {
      suggestions.push({
        id: "uncontacted-leads",
        title: `${context.contacts.uncontacted} leads have never been contacted`,
        explanation: `You have ${context.contacts.uncontacted} contacts who have never received a message or call. Launch an outreach campaign or start AI calls to engage them before they go cold.`,
        impact: "high",
        actionType: "start_ai_calls",
        actionParams: { targetCount: Math.min(context.contacts.uncontacted, 50), reason: "uncontacted leads" },
        confirmationMessage: `This will start AI calls to up to ${Math.min(context.contacts.uncontacted, 50)} contacts who haven't been contacted yet.`,
      });
    }
    if (context.contacts.newLast7Days > 0) {
      suggestions.push({
        id: "new-contacts-outreach",
        title: `${context.contacts.newLast7Days} new contacts added this week`,
        explanation: `You added ${context.contacts.newLast7Days} new contacts in the last 7 days. Send a welcome message or add them to an onboarding workflow while they're still warm.`,
        impact: "high",
        actionType: "launch_campaign",
        actionParams: { type: "sms", targetCount: context.contacts.newLast7Days, suggestedMessage: "Hi {{firstName}}, welcome! I'd love to schedule a quick call to learn more about your goals." },
        confirmationMessage: `This will send a welcome SMS to ${context.contacts.newLast7Days} new contacts added this week.`,
      });
    }
    if (context.contacts.total > 0 && context.campaigns.length === 0) {
      suggestions.push({
        id: "no-campaigns",
        title: "No campaigns sent in the last 30 days",
        explanation: `You have ${context.contacts.total} contacts but no campaigns in the last 30 days. Regular outreach keeps your list engaged and drives appointments.`,
        impact: "medium",
        actionType: "navigate",
        actionParams: { path: "/campaigns" },
        confirmationMessage: "",
      });
    }
  }

  // ── AI CALLS page ──
  else if (page === "ai-calls") {
    if (context.calls.connectRate < 30 && context.calls.totalLast7Days > 5) {
      suggestions.push({
        id: "low-connect-rate",
        title: `Connect rate is only ${context.calls.connectRate}% — needs improvement`,
        explanation: `Your AI call connect rate this week is ${context.calls.connectRate}% (${context.calls.completed} connected out of ${context.calls.totalLast7Days}). Try calling between 10 AM–12 PM or 4–6 PM for better answer rates.`,
        impact: "high",
        actionType: "info_only",
        actionParams: {},
        confirmationMessage: "",
      });
    }
    if (context.calls.noAnswer > 0) {
      suggestions.push({
        id: "no-answer-followup",
        title: `Follow up ${context.calls.noAnswer} no-answer calls with SMS`,
        explanation: `${context.calls.noAnswer} calls went unanswered this week. Sending an automatic SMS after a no-answer can recover up to 30% of missed connections.`,
        impact: "high",
        actionType: "navigate",
        actionParams: { path: "/automations" },
        confirmationMessage: "",
      });
    }
    if (context.contacts.uncontacted > 0) {
      suggestions.push({
        id: "call-uncontacted",
        title: `${context.contacts.uncontacted} leads ready to call`,
        explanation: `There are ${context.contacts.uncontacted} contacts who have never been called or messaged. Start an AI call campaign to reach them while they're still in your pipeline.`,
        impact: "high",
        actionType: "start_ai_calls",
        actionParams: { targetCount: Math.min(context.contacts.uncontacted, 50), reason: "uncontacted leads" },
        confirmationMessage: `This will start AI calls to up to ${Math.min(context.contacts.uncontacted, 50)} uncontacted leads.`,
      });
    }
  }

  // ── POWER DIALER page ──
  else if (page === "power-dialer" || page === "dialer-analytics") {
    if (context.calls.connectRate < 30 && context.calls.totalLast7Days > 0) {
      suggestions.push({
        id: "dialer-connect-rate",
        title: `${context.calls.connectRate}% connect rate — prioritize warm leads`,
        explanation: `Your connect rate is ${context.calls.connectRate}% this week. Sort your dialer list by most recent activity or opt-in date to reach the warmest leads first and improve your rate.`,
        impact: "high",
        actionType: "info_only",
        actionParams: {},
        confirmationMessage: "",
      });
    }
    if (context.calls.noAnswer > 3) {
      suggestions.push({
        id: "voicemail-strategy",
        title: `${context.calls.noAnswer} no-answers — set up voicemail drops`,
        explanation: `${context.calls.noAnswer} calls went unanswered this week. Configure a pre-recorded voicemail drop to save time and ensure every no-answer still gets a touchpoint.`,
        impact: "medium",
        actionType: "info_only",
        actionParams: {},
        confirmationMessage: "",
      });
    }
    suggestions.push({
      id: "dialer-session-tip",
      title: "Best dialing windows: 10 AM–12 PM and 4–6 PM",
      explanation: `Research shows contact rates are 2–3x higher during mid-morning and late afternoon. Schedule your power dialer sessions during these windows for maximum efficiency.`,
      impact: "low",
      actionType: "info_only",
      actionParams: {},
      confirmationMessage: "",
    });
  }

  // ── CAMPAIGNS page ──
  else if (page === "campaigns") {
    if (context.campaignSummary.drafts > 0) {
      suggestions.push({
        id: "draft-campaigns",
        title: `${context.campaignSummary.drafts} draft campaigns sitting unsent`,
        explanation: `You have ${context.campaignSummary.drafts} campaign drafts that haven't been sent yet. Review and launch them to start driving engagement — every day they sit unsent is a missed opportunity.`,
        impact: "high",
        actionType: "info_only",
        actionParams: {},
        confirmationMessage: "",
      });
    }
    if (context.contacts.uncontacted > 0) {
      suggestions.push({
        id: "campaign-uncontacted",
        title: `${context.contacts.uncontacted} contacts never received a campaign`,
        explanation: `${context.contacts.uncontacted} contacts have never been messaged or called. Create a targeted campaign to introduce yourself and start the conversation.`,
        impact: "high",
        actionType: "launch_campaign",
        actionParams: { type: "sms", targetCount: Math.min(context.contacts.uncontacted, 100), suggestedMessage: "Hi {{firstName}}, I wanted to reach out personally — do you have 5 minutes this week?" },
        confirmationMessage: `This will create an SMS campaign targeting up to ${Math.min(context.contacts.uncontacted, 100)} uncontacted contacts.`,
      });
    }
    if (context.appointments.last7Days === 0 && context.contacts.total > 0) {
      suggestions.push({
        id: "booking-campaign",
        title: "No appointments booked this week — launch a booking campaign",
        explanation: `Zero appointments were booked in the last 7 days. A targeted SMS campaign with a direct booking link can quickly fill your calendar.`,
        impact: "high",
        actionType: "launch_campaign",
        actionParams: { type: "sms", targetCount: Math.min(context.contacts.total, 50), suggestedMessage: "Hi {{firstName}}, I'd love to schedule a quick call. When works best for you? Book here: {{bookingLink}}" },
        confirmationMessage: `This will create an SMS booking campaign targeting up to ${Math.min(context.contacts.total, 50)} contacts.`,
      });
    }
  }

  // ── AUTOMATIONS page ──
  else if (page === "automations") {
    if (context.workflows.failedExecutionsLast7Days > 0) {
      suggestions.push({
        id: "failed-workflows",
        title: `${context.workflows.failedExecutionsLast7Days} workflow executions failed this week`,
        explanation: `${context.workflows.failedExecutionsLast7Days} automation workflows failed in the last 7 days. Failed workflows mean contacts aren't getting follow-ups. Check the execution logs and fix the broken steps.`,
        impact: "high",
        actionType: "info_only",
        actionParams: {},
        confirmationMessage: "",
      });
    }
    if (context.workflows.inactive > 0) {
      suggestions.push({
        id: "inactive-workflows",
        title: `${context.workflows.inactive} workflows are turned off`,
        explanation: `You have ${context.workflows.inactive} inactive workflows. Review them — some may be paused accidentally, and reactivating them could restore automated follow-ups you're missing.`,
        impact: "medium",
        actionType: "info_only",
        actionParams: {},
        confirmationMessage: "",
      });
    }
    if (context.calls.noAnswer > 0) {
      suggestions.push({
        id: "no-answer-automation",
        title: "Create a no-answer SMS follow-up workflow",
        explanation: `${context.calls.noAnswer} calls went unanswered this week. An automated SMS sent 5 minutes after a no-answer call can recover up to 30% of missed connections — and you don't have one set up yet.`,
        impact: "high",
        actionType: "create_workflow",
        actionParams: { trigger: "call_no_answer", action: "send_sms" },
        confirmationMessage: "This will open the workflow builder pre-configured for a no-answer SMS follow-up.",
      });
    }
    if (context.contacts.newLast7Days > 0 && context.workflows.active < 3) {
      suggestions.push({
        id: "welcome-workflow",
        title: "Set up a welcome sequence for new contacts",
        explanation: `You added ${context.contacts.newLast7Days} new contacts this week but only have ${context.workflows.active} active workflows. A welcome sequence (SMS + call + follow-up) can automatically nurture new leads without manual effort.`,
        impact: "medium",
        actionType: "create_workflow",
        actionParams: { trigger: "contact_created", action: "welcome_sequence" },
        confirmationMessage: "This will open the workflow builder pre-configured for a new contact welcome sequence.",
      });
    }
  }

  // ── PIPELINE page ──
  else if (page === "pipeline") {
    if (context.pipelineSummary.totalDeals === 0) {
      suggestions.push({
        id: "empty-pipeline",
        title: "Your pipeline is empty — add deals from contacts",
        explanation: `You have ${context.contacts.total} contacts but no deals in your pipeline. Start converting your best leads into pipeline deals to track and close revenue.`,
        impact: "high",
        actionType: "navigate",
        actionParams: { path: "/contacts" },
        confirmationMessage: "",
      });
    } else {
      suggestions.push({
        id: "pipeline-value",
        title: `$${context.pipelineSummary.totalValue.toLocaleString()} in pipeline across ${context.pipelineSummary.totalDeals} deals`,
        explanation: `Review each stage and identify deals that have been stalled the longest. A quick follow-up call or appointment can move deals forward and protect your pipeline value.`,
        impact: "medium",
        actionType: "info_only",
        actionParams: {},
        confirmationMessage: "",
      });
    }
    if (context.appointments.last7Days === 0 && context.pipelineSummary.totalDeals > 0) {
      suggestions.push({
        id: "pipeline-appointments",
        title: "No appointments booked — schedule calls for stalled deals",
        explanation: `You have ${context.pipelineSummary.totalDeals} deals in your pipeline but zero appointments this week. Book calls with your top deals to keep momentum going.`,
        impact: "high",
        actionType: "navigate",
        actionParams: { path: "/calendar" },
        confirmationMessage: "",
      });
    }
  }

  // ── CALENDAR page ──
  else if (page === "calendar") {
    if (context.appointments.upcoming === 0) {
      suggestions.push({
        id: "no-upcoming-appts",
        title: "No upcoming appointments scheduled",
        explanation: `Your calendar is empty for the next 7 days. Launch an outreach campaign or start AI calls to book meetings with your ${context.contacts.total} contacts.`,
        impact: "high",
        actionType: "launch_campaign",
        actionParams: { type: "sms", targetCount: Math.min(context.contacts.total, 50), suggestedMessage: "Hi {{firstName}}, I'd love to connect this week. When works best for you? {{bookingLink}}" },
        confirmationMessage: `This will create an SMS booking campaign targeting up to ${Math.min(context.contacts.total, 50)} contacts.`,
      });
    } else {
      suggestions.push({
        id: "upcoming-appts",
        title: `${context.appointments.upcoming} appointments coming up — send reminders`,
        explanation: `You have ${context.appointments.upcoming} appointments scheduled in the next 7 days. Set up automated reminder messages (24h and 1h before) to reduce no-shows.`,
        impact: "medium",
        actionType: "navigate",
        actionParams: { path: "/automations" },
        confirmationMessage: "",
      });
    }
    if (context.appointments.last7Days < context.appointments.last30Days / 4) {
      suggestions.push({
        id: "booking-pace",
        title: "Appointment booking pace is slowing down",
        explanation: `You booked ${context.appointments.last7Days} appointments this week vs an average of ${Math.round(context.appointments.last30Days / 4)} per week this month. Consider a re-engagement campaign to pick up the pace.`,
        impact: "medium",
        actionType: "navigate",
        actionParams: { path: "/campaigns" },
        confirmationMessage: "",
      });
    }
  }

  // ── ANALYTICS page ──
  else if (page === "analytics") {
    suggestions.push({
      id: "analytics-connect-rate",
      title: `Call connect rate: ${context.calls.connectRate}% — ${context.calls.connectRate >= 30 ? "on target" : "below benchmark"}`,
      explanation: `Your connect rate is ${context.calls.connectRate}% this week (benchmark: 30–40%). ${context.calls.connectRate < 30 ? "Try calling during 10 AM–12 PM or 4–6 PM windows and ensure your caller ID is recognizable." : "Keep it up — consistent outreach is driving results."}`,
      impact: context.calls.connectRate < 30 ? "high" : "low",
      actionType: "info_only",
      actionParams: {},
      confirmationMessage: "",
    });
    if (context.messages.unread > 0) {
      suggestions.push({
        id: "analytics-unread",
        title: `${context.messages.unread} unread messages affecting engagement metrics`,
        explanation: `Unread messages drag down your response rate KPI. Clearing your inbox and setting up auto-reply workflows will improve your engagement analytics over time.`,
        impact: "medium",
        actionType: "navigate",
        actionParams: { path: "/inbox" },
        confirmationMessage: "",
      });
    }
    suggestions.push({
      id: "analytics-pipeline",
      title: `Pipeline: $${context.pipelineSummary.totalValue.toLocaleString()} across ${context.pipelineSummary.totalDeals} deals`,
      explanation: `Track pipeline velocity — how quickly deals move from stage to stage. If deals are stalling, add follow-up tasks or appointment bookings to accelerate the close rate.`,
      impact: "medium",
      actionType: "navigate",
      actionParams: { path: "/pipeline" },
      confirmationMessage: "",
    });
  }

  // ── DASHBOARD (default) ──
  else {
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
        explanation: `Your AI call connect rate this week is ${context.calls.connectRate}% (${context.calls.completed} connected out of ${context.calls.totalLast7Days}). Try calling between 10 AM–12 PM for better results.`,
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
