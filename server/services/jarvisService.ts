/**
 * Jarvis AI Assistant — Service Layer
 *
 * Manages conversations, orchestrates LLM calls with tool-calling,
 * and persists chat history to the jarvis_sessions table.
 *
 * Uses the Google Gemini SDK directly (via gemini.ts) for all LLM calls,
 * bypassing the built-in invokeLLM wrapper.
 */
import { invokeGeminiWithRetry } from "./gemini";
import type { Message, ToolCall, InvokeResult } from "../_core/llm";
import { JARVIS_TOOLS, executeTool } from "./jarvisTools";
import { trackUsage } from "./usageTracker";
import { getDb } from "../db";
import { jarvisToolUsage } from "../../drizzle/schema";
import { eq, and, sql } from "drizzle-orm";

// ═══════════════════════════════════════════════
// TOOL USAGE TRACKING (internal helper)
// ═══════════════════════════════════════════════

async function trackToolUsageInternal(accountId: number, toolName: string) {
  try {
    const db = (await getDb())!;
    const existing = await db.select().from(jarvisToolUsage)
      .where(and(
        eq(jarvisToolUsage.accountId, accountId),
        eq(jarvisToolUsage.toolName, toolName)
      ));
    if (existing.length > 0) {
      await db.update(jarvisToolUsage)
        .set({
          usageCount: sql`${jarvisToolUsage.usageCount} + 1`,
          lastUsedAt: new Date(),
        })
        .where(eq(jarvisToolUsage.id, existing[0].id));
    } else {
      await db.insert(jarvisToolUsage).values({
        accountId,
        toolName,
        usageCount: 1,
        lastUsedAt: new Date(),
      });
    }
  } catch {
    // Silently fail — analytics should never break chat
  }
}

// ═══════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════

export interface JarvisMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
  tool_call_id?: string;
  tool_calls?: ToolCall[];
  timestamp?: number;
}

export interface JarvisSession {
  id: number;
  accountId: number;
  userId: number;
  title: string;
  messages: JarvisMessage[];
  createdAt: Date;
  updatedAt: Date;
}

interface ChatContext {
  accountId: number;
  userId: number;
  userName: string;
}

// ═══════════════════════════════════════════════
// SYSTEM PROMPT
// ═══════════════════════════════════════════════

export function buildSystemPrompt(ctx: ChatContext): string {
  return `You are Jarvis, an AI assistant built into the Sterling Marketing CRM platform. You help loan officers manage their contacts, communications, pipeline, and automations.

Current user: ${ctx.userName}
Account ID: ${ctx.accountId}

Your capabilities:
- Search and manage contacts (create, update, tag, add notes, filter by date/messages/calls)
- Send SMS and email messages to contacts (individual and bulk)
- View dashboard stats, contact stats, message stats, campaign stats, analytics
- View and manage the sales pipeline (create deals, move deals between stages, update deal values)
- List and trigger workflows/automations
- List segments and sequences, enroll contacts in sequences
- View calendars, check appointment availability, and book appointments
- Generate content: social media posts, blog articles, email drafts
- Schedule social posts for future publishing
- Repurpose blog posts into different formats (social snippets, email summaries, short-form, video scripts)
- Send email drafts directly to contacts
- Create, send, and pause campaigns (email and SMS)
- View inbox conversations and full contact message threads
- Read and update custom fields on contacts
- Check lead scores with grade breakdown and history
- Initiate AI voice calls via VAPI (with business hours enforcement)
- View AI call history with summaries and durations
- Schedule recurring tasks (e.g., "Send me a pipeline summary every Monday at 9am")
- List and cancel scheduled tasks
- List team members and assign contacts to specific users
- Submit support tickets for bugs, features, or billing issues
- Check the account's email warming status and daily limits
- Read contact notes (including dispositions) when fetching contact details
- Generate on-demand reports: daily activity, pipeline summary, and usage/billing breakdown
- Email reports directly to anyone from the chat

REPORTS:
- When the user asks for a report, daily summary, activity breakdown, pipeline overview, or usage/billing info, use the appropriate generate_* or get_usage_report tool rather than answering from memory.
- After showing a report, proactively suggest: "Would you like this scheduled daily?" or "Want me to email this to someone?"
- The generate_daily_activity_report tool returns a full HTML report with inbound calls, outbound SMS/email, contact updates, dispositions, hot leads, disposition trends vs 7-day average, appointments booked, AI call outcomes, and sequence activity.
- The generate_pipeline_summary tool returns pipeline snapshot, period activity, velocity metric, conversion funnel, stale deals, at-risk high-value deals, and top performers.
- The get_usage_report tool shows billing breakdown by category (SMS, email, AI calls, etc.) with current balance.
- Use email_report to send any generated report as a formatted email. This uses the system sender and is NOT billed to the client.

NOTES & DISPOSITION AWARENESS:
- When you fetch a contact's details via get_contact_detail, the response includes their recent notes with disposition labels.
- Valid dispositions: voicemail_full, left_voicemail, no_answer, answered, callback_requested, wrong_number, do_not_call, appointment_set, not_interested, other.
- Use these notes to understand the contact's engagement history before taking action.
- If you see 3+ consecutive notes with dispositions like "voicemail_full" or "no_answer", recommend moving the contact to a re-engagement sequence or flag them for manual review.
- On inbound call context, always check the contact's notes first to understand prior interactions.
- When creating notes via add_note tool, include a disposition when the note is about a call or contact attempt outcome.

CRITICAL: You MUST use your tools to answer questions. Never describe what you would do — just do it. If asked to find contacts, call search_contacts or get_contacts_by_filter immediately. If asked to send an SMS, call send_sms immediately. If asked for analytics, call get_analytics immediately. You have real tools connected to a live CRM database. Use them. NEVER say "I would need to..." or "I can help you by..." — instead, CALL THE TOOL and return the real results.

Guidelines:
- Be concise and action-oriented. Loan officers are busy.
- When asked to do something, use the appropriate tool IMMEDIATELY — do not describe what you would do.
- When showing contact info, format it clearly with names, emails, phones.
- When showing stats, present them in a readable format with markdown tables.
- If a tool returns an error, explain it clearly and suggest alternatives.
- The system handles confirmation for destructive actions — just call the tool.
- Use markdown formatting for readability.
- If you need to look up a contact before performing an action, do so automatically.
- Never make up data — always use tools to fetch real information.
- Chain multiple tool calls when needed — e.g., search for a contact first, then send them a message.

CONTACT SEARCH STRATEGY:
- When searching for contacts, always use partial name matching. The search is fuzzy and case-insensitive.
- If the user says a name like "test thailer", search for the full phrase first. If that returns 0 results, the system will automatically retry with each word separately ("test" and "thailer").
- If you still get 0 results, try searching with just the first name or just the last name as separate calls.
- Never give up after one search attempt — try at least 2-3 variations before telling the user you can't find the contact.
- Common misspellings happen — try partial matches (e.g., if "thailer" fails, try "thai" or "thail").`;
}

// ═══════════════════════════════════════════════
// CONVERSATION MANAGEMENT (in-memory + DB)
// ═══════════════════════════════════════════════

async function getDbHelpers() {
  const db = await import("../db");
  return {
    createJarvisSession: db.createJarvisSession,
    getJarvisSession: db.getJarvisSession,
    updateJarvisSession: db.updateJarvisSession,
    listJarvisSessions: db.listJarvisSessions,
    deleteJarvisSession: db.deleteJarvisSession,
  };
}

export async function createSession(
  accountId: number,
  userId: number,
  title?: string
): Promise<{ id: number }> {
  const db = await getDbHelpers();
  return db.createJarvisSession({
    accountId,
    userId,
    title: title || "New conversation",
    messages: "[]",
  });
}

export async function getSession(
  sessionId: number,
  accountId: number
): Promise<JarvisSession | null> {
  const db = await getDbHelpers();
  const row = await db.getJarvisSession(sessionId, accountId);
  if (!row) return null;
  let messages: JarvisMessage[] = [];
  try {
    messages = JSON.parse(row.messages || "[]");
  } catch {
    messages = [];
  }
  return {
    id: row.id,
    accountId: row.accountId,
    userId: row.userId,
    title: row.title || "Untitled",
    messages,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export async function listSessions(
  accountId: number,
  userId: number
): Promise<Array<{ id: number; title: string; updatedAt: Date }>> {
  const db = await getDbHelpers();
  return db.listJarvisSessions(accountId, userId);
}

export async function deleteSession(
  sessionId: number,
  accountId: number
): Promise<void> {
  const db = await getDbHelpers();
  await db.deleteJarvisSession(sessionId, accountId);
}

// ═══════════════════════════════════════════════
// CHAT — Gemini + Tool Orchestration
// ═══════════════════════════════════════════════

const MAX_TOOL_ROUNDS = 10;

export async function chat(
  sessionId: number,
  userMessage: string,
  ctx: ChatContext
): Promise<{ reply: string; toolsUsed: string[] }> {
  const db = await getDbHelpers();

  const session = await getSession(sessionId, ctx.accountId);
  if (!session) throw new Error("Session not found");

  const history = session.messages;

  history.push({
    role: "user",
    content: userMessage,
    timestamp: Date.now(),
  });

  const systemMsg: Message = {
    role: "system",
    content: buildSystemPrompt(ctx),
  };

  const trimmedHistory = history.slice(-40);
  const llmMessages: Message[] = [
    systemMsg,
    ...trimmedHistory.map(m => {
      if (m.role === "tool") {
        return {
          role: "tool" as const,
          content: m.content,
          tool_call_id: m.tool_call_id,
        } as any;
      }
      if (m.role === "assistant" && m.tool_calls && m.tool_calls.length > 0) {
        return {
          role: "assistant" as const,
          content: m.content || "",
          tool_calls: m.tool_calls,
        } as any;
      }
      return {
        role: m.role as "user" | "assistant",
        content: m.content,
      };
    }),
  ];

  const toolsUsed: string[] = [];
  let finalReply = "";

  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    let result: InvokeResult;
    try {
      result = await invokeGeminiWithRetry({
        messages: llmMessages,
        tools: JARVIS_TOOLS,
        tool_choice: "auto",
        _tracking: { accountId: ctx.accountId, userId: ctx.userId, endpoint: "chat" },
      });
    } catch (err: any) {
      console.error("[Jarvis] Gemini chat error:", err.message || err);
      finalReply = `I ran into an issue: ${err.message || "Unknown error"}. Please try again.`;
      history.push({ role: "assistant", content: finalReply, timestamp: Date.now() });
      break;
    }

    const choice = result?.choices?.[0];
    if (!choice) {
      finalReply = "I encountered an issue processing your request. Please try again.";
      break;
    }

    const assistantMsg = choice.message;
    const toolCalls = assistantMsg?.tool_calls;

    if (!toolCalls || toolCalls.length === 0) {
      finalReply = (typeof assistantMsg?.content === "string" ? assistantMsg.content : "") || "";
      history.push({
        role: "assistant",
        content: finalReply,
        timestamp: Date.now(),
      });
      break;
    }

    const rawContent = assistantMsg?.content;
    const contentStr = typeof rawContent === "string" ? rawContent : "";
    const assistantHistoryMsg: JarvisMessage = {
      role: "assistant",
      content: contentStr,
      tool_calls: toolCalls,
      timestamp: Date.now(),
    };
    history.push(assistantHistoryMsg);
    llmMessages.push({
      role: "assistant",
      content: contentStr,
      tool_calls: toolCalls,
    } as any);

    for (const tc of toolCalls) {
      const toolName = tc.function.name;
      toolsUsed.push(toolName);

      let toolResult: unknown;
      try {
        const args = JSON.parse(tc.function.arguments || "{}");
        toolResult = await executeTool(toolName, args, {
          accountId: ctx.accountId,
          userId: ctx.userId,
        });
      } catch (err: any) {
        toolResult = { error: err.message || "Tool execution failed" };
      }

      const toolResultStr = JSON.stringify(toolResult);

      history.push({
        role: "tool",
        content: toolResultStr,
        tool_call_id: tc.id,
        timestamp: Date.now(),
      });
      llmMessages.push({
        role: "tool",
        content: toolResultStr,
        tool_call_id: tc.id,
      } as any);

      // Track tool usage for analytics (fire-and-forget)
      trackToolUsageInternal(ctx.accountId, toolName).catch(() => {});
    }

    if (round === MAX_TOOL_ROUNDS - 1) {
      let finalResult: InvokeResult;
      try {
        finalResult = await invokeGeminiWithRetry({
          messages: llmMessages,
          tools: JARVIS_TOOLS,
          tool_choice: "none",
          _tracking: { accountId: ctx.accountId, userId: ctx.userId, endpoint: "chat_final" },
        });
      } catch {
        finalResult = { choices: [{ message: { content: "I completed the requested actions." } }] } as any;
      }
      const lastContent = finalResult?.choices?.[0]?.message?.content;
      finalReply = (typeof lastContent === "string" ? lastContent : "") || "I completed the requested actions.";
      history.push({
        role: "assistant",
        content: finalReply,
        timestamp: Date.now(),
      });
    }
  }

  let title = session.title;
  if (title === "New conversation" && history.filter(m => m.role === "user").length === 1) {
    title = userMessage.substring(0, 80) || "New conversation";
  }

  await db.updateJarvisSession(sessionId, ctx.accountId, {
    messages: JSON.stringify(history),
    title,
  });

  const uniqueTools = Array.from(new Set(toolsUsed));

  // Track LLM usage (fire-and-forget) — count each LLM round as 1 request
  const llmRoundsUsed = toolsUsed.length > 0 ? toolsUsed.length + 1 : 1;
  trackUsage({
    accountId: ctx.accountId,
    userId: ctx.userId,
    eventType: "llm_request",
    quantity: llmRoundsUsed,
    metadata: { sessionId, toolsUsed: uniqueTools },
  }).catch(() => {});

  return { reply: finalReply, toolsUsed: uniqueTools };
}

// ═══════════════════════════════════════════════
// STREAMING CHAT — yields SSE-friendly events
// ═══════════════════════════════════════════════

const TOOL_DISPLAY: Record<string, string> = {
  // Dashboard & Stats
  get_dashboard_stats: "Pulled dashboard stats",
  get_contact_stats: "Pulled contact stats",
  get_message_stats: "Pulled message stats",
  get_campaign_stats: "Pulled campaign stats",
  get_analytics: "Pulled analytics",
  // Contacts
  search_contacts: "Searched contacts",
  get_contact_detail: "Fetched contact details",
  create_contact: "Created a contact",
  update_contact: "Updated contact info",
  add_contact_note: "Added a note",
  add_contact_tag: "Tagged a contact",
  manage_contact_tags: "Managed contact tags",
  get_contact_messages: "Fetched contact messages",
  get_contacts_by_filter: "Filtered contacts",
  // Messaging
  send_sms: "Sent an SMS",
  send_email: "Sent an email",
  bulk_send_sms: "Sent bulk SMS",
  // Campaigns
  list_campaigns: "Listed campaigns",
  create_campaign: "Created a campaign",
  send_campaign: "Sent a campaign",
  pause_campaign: "Paused a campaign",
  // Pipeline
  get_pipeline_overview: "Checked pipeline",
  move_deal_stage: "Moved a deal",
  create_deal: "Created a deal",
  update_deal: "Updated a deal",
  // Workflows
  list_workflows: "Listed workflows",
  trigger_workflow: "Triggered a workflow",
  // Segments & Sequences
  list_segments: "Listed segments",
  list_sequences: "Listed sequences",
  enroll_in_sequence: "Enrolled in sequence",
  // Calendar & Appointments
  list_calendars: "Listed calendars",
  get_contact_appointments: "Checked appointments",
  check_appointment_availability: "Checked availability",
  book_appointment: "Booked appointment",
  // Content Creation
  generate_social_post: "Generated social post",
  schedule_social_post: "Scheduled social post",
  generate_blog_post: "Generated blog post",
  generate_email_draft: "Generated email draft",
  send_email_draft: "Sent email draft",
  repurpose_blog_post: "Repurposed blog post",
  // Inbox
  get_inbox_conversations: "Fetched inbox conversations",
  get_contact_conversation: "Fetched contact conversation",
  // Custom Fields
  get_contact_custom_fields: "Fetched custom fields",
  update_contact_custom_field: "Updated custom field",
  // Lead Scoring
  get_contact_lead_score: "Checked lead score",
  // Voice Calls
  initiate_ai_voice_call: "Initiated AI voice call",
  get_ai_call_history: "Fetched call history",
  // Scheduled Tasks
  schedule_recurring_task: "Scheduled recurring task",
  cancel_scheduled_task: "Cancelled scheduled task",
  list_scheduled_tasks: "Listed scheduled tasks",
  // Team Members
  list_team_members: "Listed team members",
  // Support Tickets
  submit_support_ticket: "Submitted support ticket",
  // Email Warming
  get_email_warming_status: "Checked email warming status",
};

export type StreamEvent =
  | { type: "tool_start"; data: { name: string; displayName: string } }
  | { type: "tool_result"; data: { name: string; displayName: string; success: boolean } }
  | { type: "text_delta"; data: { content: string } }
  | { type: "confirmation_required"; data: { requestId: string; name: string; displayName: string; summary: string; args: Record<string, unknown> } }
  | { type: "confirmation_result"; data: { requestId: string; approved: boolean; name: string; displayName: string } }
  | { type: "done"; data: { toolsUsed: string[] } }
  | { type: "error"; data: { message: string } };

// ── Critical tools that require user confirmation before execution ──
const CRITICAL_TOOLS = new Set([
  // Messaging
  "send_sms",
  "send_email",
  "bulk_send_sms",
  "send_email_draft",
  // Contact mutations
  "create_contact",
  "update_contact",
  "manage_contact_tags",
  "add_contact_note",
  "update_contact_custom_field",
  // Pipeline
  "move_deal_stage",
  "create_deal",
  "update_deal",
  // Workflows & Sequences
  "enroll_in_sequence",
  "trigger_workflow",
  // Appointments
  "book_appointment",
  // Campaigns
  "create_campaign",
  "send_campaign",
  "pause_campaign",
  // Voice Calls
  "initiate_ai_voice_call",
  // Scheduled Tasks
  "schedule_recurring_task",
  "cancel_scheduled_task",
  // Support Tickets
  "submit_support_ticket",
]);

/**
 * Human-readable summary for confirmation cards.
 */
function buildConfirmationSummary(toolName: string, args: Record<string, unknown>): string {
  switch (toolName) {
    case "send_sms":
      return `Send SMS to contact #${args.contactId}${args.body ? `: "${String(args.body).substring(0, 60)}${String(args.body).length > 60 ? "..." : ""}"` : ""}`;
    case "send_email":
      return `Send email to contact #${args.contactId}${args.subject ? ` — Subject: "${args.subject}"` : ""}`;
    case "move_deal_stage":
      return `Move deal #${args.dealId} to stage #${args.stageId}`;
    case "enroll_in_sequence":
      return `Enroll contact #${args.contactId} in sequence #${args.sequenceId}`;
    case "trigger_workflow":
      return `Trigger workflow #${args.workflowId} for contact #${args.contactId}`;
    case "create_contact":
      return `Create new contact: ${args.firstName || ""} ${args.lastName || ""}${args.email ? ` (${args.email})` : ""}`.trim();
    case "update_contact":
      return `Update contact #${args.contactId}: ${Object.keys(args).filter(k => k !== "contactId").join(", ")}`;
    case "bulk_send_sms":
      return `Send bulk SMS to ${(args.contactIds as number[])?.length ?? 0} contacts: "${String(args.body || "").substring(0, 60)}${String(args.body || "").length > 60 ? "..." : ""}"`;
    case "manage_contact_tags":
      return `${args.action === "add" ? "Add" : "Remove"} tag "${args.tag}" ${args.action === "add" ? "to" : "from"} contact #${args.contactId}`;
    case "add_contact_note":
      return `Add note to contact #${args.contactId}: "${String(args.content || "").substring(0, 60)}${String(args.content || "").length > 60 ? "..." : ""}"`;
    case "book_appointment":
      return `Book appointment for contact #${args.contactId}${args.startTime ? ` at ${args.startTime}` : ""}`;
    case "send_email_draft":
      return `Send email draft #${args.draftId} to the associated contact`;
    case "create_deal":
      return `Create deal "${args.title || "Untitled"}" for contact #${args.contactId}${args.value ? ` ($${args.value})` : ""}`;
    case "update_deal":
      return `Update deal #${args.dealId}: ${Object.keys(args).filter(k => k !== "dealId").join(", ")}`;
    case "update_contact_custom_field":
      return `Set custom field "${args.fieldKey}" to "${args.value}" on contact #${args.contactId}`;
    case "create_campaign":
      return `Create ${args.type} campaign "${args.name || "Untitled"}"`;
    case "send_campaign":
      return `Send campaign #${args.campaignId}`;
    case "pause_campaign":
      return `Pause campaign #${args.campaignId}`;
    case "initiate_ai_voice_call":
      return `Initiate AI voice call to contact #${args.contactId}`;
    case "schedule_recurring_task":
      return `Schedule recurring task "${args.name || "Untitled"}": ${args.scheduleDescription || args.cronExpression}`;
    case "cancel_scheduled_task":
      return `Cancel scheduled task #${args.taskId}`;
    case "submit_support_ticket":
      return `Submit support ticket: "${args.subject}"`;
    default:
      return `Execute ${TOOL_DISPLAY[toolName] || toolName}`;
  }
}

// ── Pending confirmation store (keyed by requestId) ──
const pendingConfirmations = new Map<string, {
  resolve: (approved: boolean) => void;
  timer: ReturnType<typeof setTimeout>;
}>();

/** Called by the /api/jarvis/confirm endpoint */
export function resolveConfirmation(requestId: string, approved: boolean): boolean {
  const pending = pendingConfirmations.get(requestId);
  if (!pending) return false;
  clearTimeout(pending.timer);
  pendingConfirmations.delete(requestId);
  pending.resolve(approved);
  return true;
}

/** Wait for user to approve/reject. Times out after 120s → auto-reject. */
function waitForConfirmation(requestId: string): Promise<boolean> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      pendingConfirmations.delete(requestId);
      resolve(false); // auto-reject on timeout
    }, 120_000);
    pendingConfirmations.set(requestId, { resolve, timer });
  });
}

let confirmationCounter = 0;
function nextRequestId(): string {
  return `confirm_${Date.now()}_${++confirmationCounter}`;
}

export async function* chatStream(
  sessionId: number,
  userMessage: string,
  ctx: ChatContext
): AsyncGenerator<StreamEvent> {
  const db = await getDbHelpers();

  const session = await getSession(sessionId, ctx.accountId);
  if (!session) {
    yield { type: "error", data: { message: "Session not found" } };
    return;
  }

  const history = session.messages;
  history.push({ role: "user", content: userMessage, timestamp: Date.now() });

  const systemMsg: Message = { role: "system", content: buildSystemPrompt(ctx) };
  const trimmedHistory = history.slice(-40);
  const llmMessages: Message[] = [
    systemMsg,
    ...trimmedHistory.map(m => {
      if (m.role === "tool") {
        return { role: "tool" as const, content: m.content, tool_call_id: m.tool_call_id } as any;
      }
      if (m.role === "assistant" && m.tool_calls && m.tool_calls.length > 0) {
        return { role: "assistant" as const, content: m.content || "", tool_calls: m.tool_calls } as any;
      }
      return { role: m.role as "user" | "assistant", content: m.content };
    }),
  ];

  const toolsUsed: string[] = [];
  let finalReply = "";

  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    const isLastRound = round === MAX_TOOL_ROUNDS - 1;

    let result: InvokeResult;
    try {
      result = await invokeGeminiWithRetry({
        messages: llmMessages,
        tools: JARVIS_TOOLS,
        tool_choice: isLastRound ? "none" : "auto",
        _tracking: { accountId: ctx.accountId, userId: ctx.userId, endpoint: "chat_stream" },
      });
    } catch (err: any) {
      console.error("[Jarvis] Gemini stream error:", err.message || err);
      const errorMsg = `I ran into an issue: ${err.message || "Unknown error"}. Please try again.`;
      yield { type: "text_delta", data: { content: errorMsg } };
      history.push({ role: "assistant", content: errorMsg, timestamp: Date.now() });
      await db.updateJarvisSession(sessionId, ctx.accountId, {
        messages: JSON.stringify(history),
        title: session.title,
      });
      yield { type: "done", data: { toolsUsed: [] } };
      return;
    }

    const choice = result?.choices?.[0];
    if (!choice) {
      finalReply = "I encountered an issue processing your request. Please try again.";
      yield { type: "text_delta", data: { content: finalReply } };
      history.push({ role: "assistant", content: finalReply, timestamp: Date.now() });
      break;
    }

    const assistantMsg = choice.message;
    const toolCalls = assistantMsg?.tool_calls;

    if (!toolCalls || toolCalls.length === 0) {
      // ── Final text response — stream it via SSE ──
      finalReply = (typeof assistantMsg?.content === "string" ? assistantMsg.content : "") || "";

      // Stream the final text in chunks for a typing effect
      const chunkSize = 12;
      for (let i = 0; i < finalReply.length; i += chunkSize) {
        yield { type: "text_delta", data: { content: finalReply.slice(i, i + chunkSize) } };
      }

      history.push({ role: "assistant", content: finalReply, timestamp: Date.now() });
      break;
    }

    // ── Tool calling round ──
    const rawContent = assistantMsg?.content;
    const contentStr = typeof rawContent === "string" ? rawContent : "";
    history.push({ role: "assistant", content: contentStr, tool_calls: toolCalls, timestamp: Date.now() });
    llmMessages.push({ role: "assistant", content: contentStr, tool_calls: toolCalls } as any);

    for (const tc of toolCalls) {
      const toolName = tc.function.name;
      const displayName = TOOL_DISPLAY[toolName] || toolName;
      toolsUsed.push(toolName);

      const args = JSON.parse(tc.function.arguments || "{}");

      // ── Confirmation gate for critical tools ──
      if (CRITICAL_TOOLS.has(toolName)) {
        const requestId = nextRequestId();
        const summary = buildConfirmationSummary(toolName, args);

        yield {
          type: "confirmation_required",
          data: { requestId, name: toolName, displayName, summary, args },
        };

        // Pause the generator until user approves or rejects (or 120s timeout)
        const approved = await waitForConfirmation(requestId);

        yield {
          type: "confirmation_result",
          data: { requestId, approved, name: toolName, displayName },
        };

        if (!approved) {
          const rejectedResult = JSON.stringify({ cancelled: true, reason: "User rejected this action" });
          history.push({ role: "tool", content: rejectedResult, tool_call_id: tc.id, timestamp: Date.now() });
          llmMessages.push({ role: "tool", content: rejectedResult, tool_call_id: tc.id } as any);
          continue;
        }
      }

      yield { type: "tool_start", data: { name: toolName, displayName } };

      let toolResult: unknown;
      let success = true;
      try {
        toolResult = await executeTool(toolName, args, {
          accountId: ctx.accountId,
          userId: ctx.userId,
        });
      } catch (err: any) {
        toolResult = { error: err.message || "Tool execution failed" };
        success = false;
      }

      const toolResultStr = JSON.stringify(toolResult);
      history.push({ role: "tool", content: toolResultStr, tool_call_id: tc.id, timestamp: Date.now() });
      llmMessages.push({ role: "tool", content: toolResultStr, tool_call_id: tc.id } as any);

      yield { type: "tool_result", data: { name: toolName, displayName, success } };

      // Track tool usage for analytics (fire-and-forget)
      if (success) {
        trackToolUsageInternal(ctx.accountId, toolName).catch(() => {});
      }
    }

    // If this was the last round, force a final text response
    if (isLastRound) {
      let finalResult: InvokeResult;
      try {
        finalResult = await invokeGeminiWithRetry({
          messages: llmMessages,
          tools: JARVIS_TOOLS,
          tool_choice: "none",
          _tracking: { accountId: ctx.accountId, userId: ctx.userId, endpoint: "chat_stream_final" },
        });
      } catch {
        finalResult = { choices: [{ message: { content: "I completed the requested actions." } }] } as any;
      }
      const lastContent = finalResult?.choices?.[0]?.message?.content;
      finalReply = (typeof lastContent === "string" ? lastContent : "") || "I completed the requested actions.";

      const chunkSize = 12;
      for (let i = 0; i < finalReply.length; i += chunkSize) {
        yield { type: "text_delta", data: { content: finalReply.slice(i, i + chunkSize) } };
      }

      history.push({ role: "assistant", content: finalReply, timestamp: Date.now() });
    }
  }

  // ── Persist ──
  let title = session.title;
  if (title === "New conversation" && history.filter(m => m.role === "user").length === 1) {
    title = userMessage.substring(0, 80) || "New conversation";
  }

  await db.updateJarvisSession(sessionId, ctx.accountId, {
    messages: JSON.stringify(history),
    title,
  });

  const uniqueTools = Array.from(new Set(toolsUsed));

  // Track LLM usage (fire-and-forget) — count each LLM round as 1 request
  const llmRoundsUsed = toolsUsed.length > 0 ? toolsUsed.length + 1 : 1;
  trackUsage({
    accountId: ctx.accountId,
    userId: ctx.userId,
    eventType: "llm_request",
    quantity: llmRoundsUsed,
    metadata: { sessionId, toolsUsed: uniqueTools },
  }).catch(() => {});

  yield { type: "done", data: { toolsUsed: uniqueTools } };
}
