/**
 * Jarvis AI Assistant — Service Layer
 *
 * Manages conversations, orchestrates LLM calls with tool-calling,
 * and persists chat history to the jarvis_sessions table.
 */
import { invokeLLM } from "../_core/llm";
import type { Message, ToolCall, InvokeResult } from "../_core/llm";
import { JARVIS_TOOLS, executeTool } from "./jarvisTools";

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

function buildSystemPrompt(ctx: ChatContext): string {
  return `You are Jarvis, an AI assistant built into the Apex System CRM platform. You help loan officers manage their contacts, communications, pipeline, and automations.

Current user: ${ctx.userName}
Account ID: ${ctx.accountId}

Your capabilities:
- Search and manage contacts (create, update, tag, add notes)
- Send SMS and email messages to contacts
- View dashboard stats, contact stats, message stats, campaign stats
- View and manage the sales pipeline (deals, stages)
- List and trigger workflows/automations
- List segments and sequences, enroll contacts in sequences
- View calendars and appointments

Guidelines:
- Be concise and action-oriented. Loan officers are busy.
- When asked to do something, use the appropriate tool immediately.
- When showing contact info, format it clearly with names, emails, phones.
- When showing stats, present them in a readable format.
- If a tool returns an error, explain it clearly and suggest alternatives.
- Always confirm before sending messages (SMS/email) or making changes.
- Use markdown formatting for readability.
- If you need to look up a contact before performing an action, do so automatically.
- Never make up data — always use tools to fetch real information.`;
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
// CHAT — LLM + Tool Orchestration
// ═══════════════════════════════════════════════

const MAX_TOOL_ROUNDS = 6;

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
    const result: InvokeResult = await invokeLLM({
      messages: llmMessages,
      tools: JARVIS_TOOLS,
      tool_choice: "auto",
    });

    const choice = result.choices[0];
    if (!choice) {
      finalReply = "I encountered an issue processing your request. Please try again.";
      break;
    }

    const assistantMsg = choice.message;
    const toolCalls = assistantMsg.tool_calls;

    if (!toolCalls || toolCalls.length === 0) {
      finalReply = (typeof assistantMsg.content === "string" ? assistantMsg.content : "") || "";
      history.push({
        role: "assistant",
        content: finalReply,
        timestamp: Date.now(),
      });
      break;
    }

    const rawContent = assistantMsg.content;
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
    }

    if (round === MAX_TOOL_ROUNDS - 1) {
      const finalResult = await invokeLLM({
        messages: llmMessages,
        tools: JARVIS_TOOLS,
        tool_choice: "none",
      });
      const lastContent = finalResult.choices[0]?.message?.content;
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

  return { reply: finalReply, toolsUsed: uniqueTools };
}

// ═══════════════════════════════════════════════
// STREAMING CHAT — yields SSE-friendly events
// ═══════════════════════════════════════════════

const TOOL_DISPLAY: Record<string, string> = {
  search_contacts: "Searched contacts",
  get_contact_detail: "Fetched contact details",
  create_contact: "Created a contact",
  update_contact: "Updated contact info",
  add_contact_note: "Added a note",
  add_contact_tag: "Tagged a contact",
  send_sms: "Sent an SMS",
  send_email: "Sent an email",
  get_dashboard_stats: "Pulled dashboard stats",
  get_contact_stats: "Pulled contact stats",
  get_message_stats: "Pulled message stats",
  get_campaign_stats: "Pulled campaign stats",
  list_campaigns: "Listed campaigns",
  pipeline_overview: "Checked pipeline",
  list_pipeline_stages: "Listed pipeline stages",
  move_deal_stage: "Moved a deal",
  create_deal: "Created a deal",
  list_workflows: "Listed workflows",
  trigger_workflow: "Triggered a workflow",
  list_segments: "Listed segments",
  list_sequences: "Listed sequences",
  enroll_in_sequence: "Enrolled in sequence",
  get_calendar_appointments: "Checked appointments",
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
  "send_sms",
  "send_email",
  "move_deal_stage",
  "enroll_in_sequence",
  "trigger_workflow",
  "create_contact",
  "update_contact",
  "schedule_appointment",
]);

/**
 * Human-readable summary for confirmation cards.
 * Parses the tool args and returns a short description.
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
    case "schedule_appointment":
      return `Schedule appointment for contact #${args.contactId}${args.startTime ? ` at ${args.startTime}` : ""}`;
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
    // ── Non-streaming call for tool rounds, streaming for final text ──
    // We use non-streaming for tool-calling rounds because we need the full
    // tool_calls array before executing tools. Only the final text response streams.
    const isLastRound = round === MAX_TOOL_ROUNDS - 1;

    const result: InvokeResult = await invokeLLM({
      messages: llmMessages,
      tools: JARVIS_TOOLS,
      tool_choice: isLastRound ? "none" : "auto",
    });

    const choice = result.choices[0];
    if (!choice) {
      finalReply = "I encountered an issue processing your request. Please try again.";
      yield { type: "text_delta", data: { content: finalReply } };
      history.push({ role: "assistant", content: finalReply, timestamp: Date.now() });
      break;
    }

    const assistantMsg = choice.message;
    const toolCalls = assistantMsg.tool_calls;

    if (!toolCalls || toolCalls.length === 0) {
      // ── Final text response — stream it via SSE ──
      finalReply = (typeof assistantMsg.content === "string" ? assistantMsg.content : "") || "";

      // Stream the final text in chunks for a typing effect
      const chunkSize = 12;
      for (let i = 0; i < finalReply.length; i += chunkSize) {
        yield { type: "text_delta", data: { content: finalReply.slice(i, i + chunkSize) } };
      }

      history.push({ role: "assistant", content: finalReply, timestamp: Date.now() });
      break;
    }

    // ── Tool calling round ──
    const rawContent = assistantMsg.content;
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
          // User rejected — tell the LLM the action was cancelled
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
    }

    // If this was the last round, force a final text response
    if (isLastRound) {
      const finalResult = await invokeLLM({
        messages: llmMessages,
        tools: JARVIS_TOOLS,
        tool_choice: "none",
      });
      const lastContent = finalResult.choices[0]?.message?.content;
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
  yield { type: "done", data: { toolsUsed: uniqueTools } };
}
