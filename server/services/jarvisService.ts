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
