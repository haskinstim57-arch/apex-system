import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { trpc } from "@/lib/trpc";
import { useAccount } from "@/contexts/AccountContext";
import { Button } from "@/components/ui/button";
import { Streamdown } from "streamdown";
import { useIsMobile } from "@/hooks/useMobile";
import {
  Bot,
  Send,
  Plus,
  Trash2,
  MessageSquare,
  Loader2,
  ChevronRight,
  ChevronLeft,
  Lightbulb,
  Sparkles,
  CheckCircle2,
  XCircle,
  ChevronDown,
  ChevronUp,
  Zap,
  ArrowRight,
  History,
  X,
} from "lucide-react";
import { toast } from "sonner";

// ═══════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════

interface JarvisMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
  tool_call_id?: string;
  tool_calls?: Array<{ id: string; function: { name: string; arguments: string } }>;
  timestamp?: number;
}

interface Suggestion {
  title: string;
  description: string;
  prompt: string;
  priority: "high" | "medium" | "low";
}

interface ToolEvent {
  name: string;
  displayName: string;
  success?: boolean;
  status: "running" | "done" | "error";
}

type PanelMode = "suggestions" | "chat";

const PANEL_COLLAPSED_KEY = "jarvis-panel-collapsed";
const PANEL_WIDTH = 380;

// ═══════════════════════════════════════════════
// TOOL NAME DISPLAY MAP
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

// ═══════════════════════════════════════════════
// SSE STREAM CONSUMER
// ═══════════════════════════════════════════════

interface StreamCallbacks {
  onToolStart: (name: string, displayName: string) => void;
  onToolResult: (name: string, displayName: string, success: boolean) => void;
  onTextDelta: (content: string) => void;
  onDone: (toolsUsed: string[]) => void;
  onError: (message: string) => void;
}

async function streamChat(
  accountId: number,
  sessionId: number,
  message: string,
  callbacks: StreamCallbacks,
  signal?: AbortSignal
) {
  const res = await fetch("/api/jarvis/stream", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ accountId, sessionId, message }),
    credentials: "include",
    signal,
  });

  if (!res.ok) {
    callbacks.onError(`Request failed: ${res.status}`);
    return;
  }

  const reader = res.body?.getReader();
  if (!reader) {
    callbacks.onError("No response body");
    return;
  }

  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";

    let eventType = "";
    for (const line of lines) {
      if (line.startsWith("event: ")) {
        eventType = line.slice(7).trim();
      } else if (line.startsWith("data: ") && eventType) {
        try {
          const data = JSON.parse(line.slice(6));
          switch (eventType) {
            case "tool_start":
              callbacks.onToolStart(data.name, data.displayName);
              break;
            case "tool_result":
              callbacks.onToolResult(data.name, data.displayName, data.success);
              break;
            case "text_delta":
              callbacks.onTextDelta(data.content);
              break;
            case "done":
              callbacks.onDone(data.toolsUsed);
              break;
            case "error":
              callbacks.onError(data.message);
              break;
          }
        } catch {}
        eventType = "";
      } else if (line === "") {
        eventType = "";
      }
    }
  }
}

// ═══════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════

export function JarvisPanel({ pageContext }: { pageContext: string }) {
  const { currentAccountId } = useAccount();
  const accountId = currentAccountId!;
  const isMobile = useIsMobile();

  const [collapsed, setCollapsed] = useState(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem(PANEL_COLLAPSED_KEY) === "true";
  });
  const [mobileOpen, setMobileOpen] = useState(false);
  const [mode, setMode] = useState<PanelMode>("suggestions");
  const [activeSessionId, setActiveSessionId] = useState<number | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [input, setInput] = useState("");
  const [isThinking, setIsThinking] = useState(false);
  const [streamingText, setStreamingText] = useState("");
  const [activeTools, setActiveTools] = useState<ToolEvent[]>([]);
  const [lastToolsUsed, setLastToolsUsed] = useState<string[]>([]);
  const [showTools, setShowTools] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Persist collapsed state (desktop only)
  useEffect(() => {
    if (!isMobile) {
      localStorage.setItem(PANEL_COLLAPSED_KEY, collapsed.toString());
    }
  }, [collapsed, isMobile]);

  // ── Queries ──
  const recommendationsQuery = trpc.jarvis.getRecommendations.useQuery(
    { accountId, pageContext },
    { enabled: !!accountId && mode === "suggestions" && (!collapsed || mobileOpen) }
  );

  const sessionsQuery = trpc.jarvis.listSessions.useQuery(
    { accountId },
    { enabled: !!accountId && (!collapsed || mobileOpen) }
  );

  const sessionQuery = trpc.jarvis.getSession.useQuery(
    { accountId, sessionId: activeSessionId! },
    { enabled: !!accountId && !!activeSessionId && mode === "chat" && (!collapsed || mobileOpen) }
  );

  const utils = trpc.useUtils();

  // ── Mutations ──
  const createSession = trpc.jarvis.createSession.useMutation({
    onSuccess: (data) => {
      setActiveSessionId(data.id);
      setMode("chat");
      setShowHistory(false);
      utils.jarvis.listSessions.invalidate({ accountId });
    },
  });

  const deleteSession = trpc.jarvis.deleteSession.useMutation({
    onSuccess: (_, vars) => {
      if (activeSessionId === vars.sessionId) {
        setActiveSessionId(null);
        setMode("suggestions");
      }
      utils.jarvis.listSessions.invalidate({ accountId });
    },
  });

  // ── Derived state ──
  const messages: JarvisMessage[] = useMemo(() => {
    if (!sessionQuery.data?.messages) return [];
    return sessionQuery.data.messages.filter(
      (m: JarvisMessage) => m.role === "user" || m.role === "assistant"
    );
  }, [sessionQuery.data?.messages]);

  const suggestions: Suggestion[] = recommendationsQuery.data ?? [];
  const sessions = sessionsQuery.data ?? [];

  // ── Auto-scroll ──
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isThinking, streamingText, activeTools]);

  // ── Streaming send handler ──
  const handleSend = useCallback(async () => {
    const trimmed = input.trim();
    if (!trimmed || !activeSessionId || isThinking) return;

    setInput("");
    setIsThinking(true);
    setStreamingText("");
    setActiveTools([]);
    setLastToolsUsed([]);
    setShowTools(false);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      await streamChat(
        accountId,
        activeSessionId,
        trimmed,
        {
          onToolStart: (name, displayName) => {
            setActiveTools((prev) => [...prev, { name, displayName, status: "running" }]);
          },
          onToolResult: (name, displayName, success) => {
            setActiveTools((prev) =>
              prev.map((t) =>
                t.name === name && t.status === "running"
                  ? { ...t, success, status: success ? "done" : "error" }
                  : t
              )
            );
          },
          onTextDelta: (content) => {
            setStreamingText((prev) => prev + content);
          },
          onDone: (toolsUsed) => {
            setLastToolsUsed(toolsUsed);
            setShowTools(toolsUsed.length > 0);
            // Refresh the session to get the persisted messages
            utils.jarvis.getSession.invalidate({ accountId, sessionId: activeSessionId });
            utils.jarvis.listSessions.invalidate({ accountId });
          },
          onError: (message) => {
            toast.error(message || "Failed to get response");
          },
        },
        controller.signal
      );
    } catch (err: any) {
      if (err.name !== "AbortError") {
        toast.error("Failed to get response. Please try again.");
      }
    } finally {
      setIsThinking(false);
      setStreamingText("");
      setActiveTools([]);
      abortRef.current = null;
      inputRef.current?.focus();
    }
  }, [input, activeSessionId, isThinking, accountId, utils]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend]
  );

  const handleNewChat = useCallback(async () => {
    try {
      await createSession.mutateAsync({ accountId });
    } catch {
      toast.error("Failed to create conversation");
    }
  }, [accountId, createSession]);

  const handleSuggestionClick = useCallback(
    async (prompt: string) => {
      try {
        const session = await createSession.mutateAsync({ accountId });
        setInput("");
        setIsThinking(true);
        setStreamingText("");
        setActiveTools([]);
        setLastToolsUsed([]);
        setShowTools(false);

        const controller = new AbortController();
        abortRef.current = controller;

        await streamChat(
          accountId,
          session.id,
          prompt,
          {
            onToolStart: (name, displayName) => {
              setActiveTools((prev) => [...prev, { name, displayName, status: "running" }]);
            },
            onToolResult: (name, displayName, success) => {
              setActiveTools((prev) =>
                prev.map((t) =>
                  t.name === name && t.status === "running"
                    ? { ...t, success, status: success ? "done" : "error" }
                    : t
                )
              );
            },
            onTextDelta: (content) => {
              setStreamingText((prev) => prev + content);
            },
            onDone: (toolsUsed) => {
              setLastToolsUsed(toolsUsed);
              setShowTools(toolsUsed.length > 0);
              utils.jarvis.getSession.invalidate({ accountId, sessionId: session.id });
              utils.jarvis.listSessions.invalidate({ accountId });
            },
            onError: (message) => {
              toast.error(message || "Failed to get response");
            },
          },
          controller.signal
        );
      } catch (err: any) {
        if (err.name !== "AbortError") {
          toast.error("Failed to start conversation");
        }
      } finally {
        setIsThinking(false);
        setStreamingText("");
        setActiveTools([]);
        abortRef.current = null;
      }
    },
    [accountId, createSession, utils]
  );

  const handleDelete = useCallback(
    async (sessionId: number, e: React.MouseEvent) => {
      e.stopPropagation();
      try {
        await deleteSession.mutateAsync({ accountId, sessionId });
        toast.success("Conversation deleted");
      } catch {
        toast.error("Failed to delete");
      }
    },
    [accountId, deleteSession]
  );

  const handleResumeSession = useCallback(
    (sessionId: number) => {
      setActiveSessionId(sessionId);
      setMode("chat");
      setShowHistory(false);
    },
    []
  );

  // ── Suggested follow-up prompts based on last response ──
  const followUpPrompts = useMemo(() => {
    if (messages.length === 0) return [];
    const lastAssistant = [...messages].reverse().find((m) => m.role === "assistant");
    if (!lastAssistant) return [];
    const content = lastAssistant.content.toLowerCase();

    const prompts: string[] = [];
    if (content.includes("contact") || content.includes("lead")) {
      prompts.push("Show me more details about this contact");
      prompts.push("Send a follow-up message to them");
    }
    if (content.includes("pipeline") || content.includes("deal") || content.includes("stage")) {
      prompts.push("Move this deal to the next stage");
      prompts.push("Show me stale deals");
    }
    if (content.includes("campaign") || content.includes("sent") || content.includes("message")) {
      prompts.push("Show me campaign performance stats");
      prompts.push("Draft a follow-up message");
    }
    if (content.includes("appointment") || content.includes("calendar") || content.includes("schedule")) {
      prompts.push("Show my available time slots");
      prompts.push("Schedule a new appointment");
    }
    if (content.includes("workflow") || content.includes("automation")) {
      prompts.push("Trigger this workflow for a contact");
      prompts.push("List all active workflows");
    }
    if (prompts.length === 0) {
      prompts.push("Tell me more");
      prompts.push("What else can you help with?");
    }
    return prompts.slice(0, 3);
  }, [messages]);

  // ═══════════════════════════════════════════════
  // MOBILE: Floating button + bottom sheet
  // ═══════════════════════════════════════════════

  if (isMobile) {
    return (
      <>
        {/* Floating trigger button */}
        {!mobileOpen && (
          <button
            onClick={() => setMobileOpen(true)}
            className="fixed bottom-5 right-5 z-50 h-12 w-12 rounded-full bg-primary text-primary-foreground shadow-lg flex items-center justify-center hover:scale-105 active:scale-95 transition-transform"
            aria-label="Open Jarvis"
          >
            <Bot className="h-5 w-5" />
          </button>
        )}

        {/* Bottom sheet overlay */}
        {mobileOpen && (
          <div className="fixed inset-0 z-50 flex flex-col">
            {/* Backdrop */}
            <div
              className="flex-shrink-0 bg-black/40 backdrop-blur-sm"
              style={{ height: "10vh" }}
              onClick={() => setMobileOpen(false)}
            />
            {/* Sheet */}
            <div className="flex-1 bg-background rounded-t-2xl shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-bottom duration-300">
              {/* Handle + header */}
              <div className="flex items-center justify-between px-4 pt-3 pb-2 border-b border-border shrink-0">
                <div className="flex items-center gap-2">
                  <div className="h-7 w-7 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Bot className="h-4 w-4 text-primary" />
                  </div>
                  <span className="font-semibold text-sm">Jarvis</span>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => { setMode("suggestions"); setShowHistory(false); }}
                    className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
                      mode === "suggestions" ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <Lightbulb className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => setMode("chat")}
                    className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
                      mode === "chat" ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <MessageSquare className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => setMobileOpen(false)}
                    className="p-1 rounded text-muted-foreground hover:text-foreground ml-1"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {/* Content — reuse the same panel content */}
              <PanelContent
                mode={mode}
                setMode={setMode}
                collapsed={false}
                suggestions={suggestions}
                recommendationsLoading={recommendationsQuery.isLoading}
                sessions={sessions}
                showHistory={showHistory}
                setShowHistory={setShowHistory}
                activeSessionId={activeSessionId}
                sessionQuery={sessionQuery}
                messages={messages}
                isThinking={isThinking}
                streamingText={streamingText}
                activeTools={activeTools}
                lastToolsUsed={lastToolsUsed}
                showTools={showTools}
                setShowTools={setShowTools}
                followUpPrompts={followUpPrompts}
                input={input}
                setInput={setInput}
                inputRef={inputRef}
                messagesEndRef={messagesEndRef}
                handleSend={handleSend}
                handleKeyDown={handleKeyDown}
                handleNewChat={handleNewChat}
                handleSuggestionClick={handleSuggestionClick}
                handleDelete={handleDelete}
                handleResumeSession={handleResumeSession}
                createSessionPending={createSession.isPending}
                pageContext={pageContext}
              />
            </div>
          </div>
        )}
      </>
    );
  }

  // ═══════════════════════════════════════════════
  // DESKTOP: Collapsed state — thin vertical strip
  // ═══════════════════════════════════════════════

  if (collapsed) {
    return (
      <div className="w-10 border-l border-border bg-muted/20 flex flex-col items-center py-3 shrink-0">
        <button
          onClick={() => setCollapsed(false)}
          className="group flex flex-col items-center gap-2 text-muted-foreground hover:text-primary transition-colors"
          title="Open Jarvis"
        >
          <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
            <Bot className="h-4 w-4 text-primary" />
          </div>
          <ChevronLeft className="h-3 w-3" />
        </button>
      </div>
    );
  }

  // ═══════════════════════════════════════════════
  // DESKTOP: Expanded panel
  // ═══════════════════════════════════════════════

  return (
    <div
      className="border-l border-border bg-background flex flex-col shrink-0 overflow-hidden"
      style={{ width: PANEL_WIDTH }}
    >
      {/* Panel Header */}
      <div className="h-12 border-b border-border flex items-center justify-between px-3 shrink-0">
        <div className="flex items-center gap-2">
          <div className="h-7 w-7 rounded-lg bg-primary/10 flex items-center justify-center">
            <Bot className="h-4 w-4 text-primary" />
          </div>
          <span className="font-semibold text-sm text-foreground">Jarvis</span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => { setMode("suggestions"); setShowHistory(false); }}
            className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
              mode === "suggestions" ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground"
            }`}
            title="Suggestions"
          >
            <Lightbulb className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => setMode("chat")}
            className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
              mode === "chat" ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground"
            }`}
            title="Chat"
          >
            <MessageSquare className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => setCollapsed(true)}
            className="p-1 rounded text-muted-foreground hover:text-foreground transition-colors ml-1"
            title="Collapse panel"
          >
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      <PanelContent
        mode={mode}
        setMode={setMode}
        collapsed={collapsed}
        suggestions={suggestions}
        recommendationsLoading={recommendationsQuery.isLoading}
        sessions={sessions}
        showHistory={showHistory}
        setShowHistory={setShowHistory}
        activeSessionId={activeSessionId}
        sessionQuery={sessionQuery}
        messages={messages}
        isThinking={isThinking}
        streamingText={streamingText}
        activeTools={activeTools}
        lastToolsUsed={lastToolsUsed}
        showTools={showTools}
        setShowTools={setShowTools}
        followUpPrompts={followUpPrompts}
        input={input}
        setInput={setInput}
        inputRef={inputRef}
        messagesEndRef={messagesEndRef}
        handleSend={handleSend}
        handleKeyDown={handleKeyDown}
        handleNewChat={handleNewChat}
        handleSuggestionClick={handleSuggestionClick}
        handleDelete={handleDelete}
        handleResumeSession={handleResumeSession}
        createSessionPending={createSession.isPending}
        pageContext={pageContext}
      />
    </div>
  );
}

// ═══════════════════════════════════════════════
// SHARED PANEL CONTENT (used by both desktop & mobile)
// ═══════════════════════════════════════════════

interface PanelContentProps {
  mode: PanelMode;
  setMode: (m: PanelMode) => void;
  collapsed: boolean;
  suggestions: Suggestion[];
  recommendationsLoading: boolean;
  sessions: Array<{ id: number; title: string; updatedAt: Date }>;
  showHistory: boolean;
  setShowHistory: (v: boolean) => void;
  activeSessionId: number | null;
  sessionQuery: any;
  messages: JarvisMessage[];
  isThinking: boolean;
  streamingText: string;
  activeTools: ToolEvent[];
  lastToolsUsed: string[];
  showTools: boolean;
  setShowTools: (v: boolean) => void;
  followUpPrompts: string[];
  input: string;
  setInput: (v: string) => void;
  inputRef: React.RefObject<HTMLTextAreaElement | null>;
  messagesEndRef: React.RefObject<HTMLDivElement | null>;
  handleSend: () => void;
  handleKeyDown: (e: React.KeyboardEvent) => void;
  handleNewChat: () => void;
  handleSuggestionClick: (prompt: string) => void;
  handleDelete: (sessionId: number, e: React.MouseEvent) => void;
  handleResumeSession: (sessionId: number) => void;
  createSessionPending: boolean;
  pageContext: string;
}

function PanelContent(props: PanelContentProps) {
  const {
    mode, setMode, suggestions, recommendationsLoading, sessions,
    showHistory, setShowHistory, activeSessionId, sessionQuery,
    messages, isThinking, streamingText, activeTools,
    lastToolsUsed, showTools, setShowTools, followUpPrompts,
    input, setInput, inputRef, messagesEndRef,
    handleSend, handleKeyDown, handleNewChat, handleSuggestionClick,
    handleDelete, handleResumeSession, createSessionPending, pageContext,
  } = props;

  return (
    <>
      {/* ═══════════════════════════════════════════════ */}
      {/* SUGGESTIONS MODE */}
      {/* ═══════════════════════════════════════════════ */}
      {mode === "suggestions" && (
        <div className="flex-1 overflow-y-auto">
          <div className="px-3 pt-3 pb-2">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
              Suggestions for {pageContext}
            </p>
          </div>

          <div className="px-3 space-y-2 pb-3">
            {recommendationsLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : suggestions.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-8">
                No suggestions for this page
              </p>
            ) : (
              suggestions.map((s, i) => (
                <SuggestionCard
                  key={i}
                  suggestion={s}
                  onClick={() => handleSuggestionClick(s.prompt)}
                  isLoading={createSessionPending || isThinking}
                />
              ))
            )}
          </div>

          {sessions.length > 0 && (
            <div className="border-t border-border px-3 py-3">
              <button
                onClick={() => setShowHistory(!showHistory)}
                className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors w-full"
              >
                <History className="h-3 w-3" />
                Recent conversations ({sessions.length})
                {showHistory ? <ChevronUp className="h-3 w-3 ml-auto" /> : <ChevronDown className="h-3 w-3 ml-auto" />}
              </button>
              {showHistory && (
                <div className="mt-2 space-y-1">
                  {sessions.slice(0, 5).map((s) => (
                    <div
                      key={s.id}
                      className="group flex items-center gap-2 px-2 py-1.5 rounded-md cursor-pointer text-xs hover:bg-muted transition-colors"
                      onClick={() => handleResumeSession(s.id)}
                    >
                      <MessageSquare className="h-3 w-3 text-muted-foreground shrink-0" />
                      <span className="truncate flex-1 text-foreground">{s.title}</span>
                      <button
                        onClick={(e) => handleDelete(s.id, e)}
                        className="opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <Trash2 className="h-3 w-3 text-destructive" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="border-t border-border p-3">
            <Button
              variant="outline"
              size="sm"
              className="w-full text-xs"
              onClick={() => {
                setMode("chat");
                if (!activeSessionId) handleNewChat();
              }}
            >
              <MessageSquare className="h-3.5 w-3.5 mr-1.5" />
              Open Chat
            </Button>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════ */}
      {/* CHAT MODE */}
      {/* ═══════════════════════════════════════════════ */}
      {mode === "chat" && (
        <>
          {/* Chat header bar */}
          <div className="h-10 border-b border-border flex items-center justify-between px-3 shrink-0 bg-muted/20">
            <div className="flex items-center gap-2 min-w-0">
              {activeSessionId && sessionQuery.data ? (
                <span className="text-xs text-muted-foreground truncate">
                  {sessionQuery.data.title}
                </span>
              ) : (
                <span className="text-xs text-muted-foreground">No active conversation</span>
              )}
            </div>
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleNewChat} disabled={createSessionPending} title="New conversation">
                <Plus className="h-3.5 w-3.5" />
              </Button>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setShowHistory(!showHistory)} title="Conversation history">
                <History className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>

          {/* History dropdown */}
          {showHistory && (
            <div className="border-b border-border bg-muted/30 max-h-48 overflow-y-auto">
              <div className="p-2 space-y-0.5">
                {sessions.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-3">No conversations yet</p>
                ) : (
                  sessions.map((s) => (
                    <div
                      key={s.id}
                      className={`group flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer text-xs transition-colors ${
                        activeSessionId === s.id ? "bg-primary/10 text-primary font-medium" : "hover:bg-muted text-foreground"
                      }`}
                      onClick={() => handleResumeSession(s.id)}
                    >
                      <MessageSquare className="h-3 w-3 shrink-0 opacity-60" />
                      <span className="truncate flex-1">{s.title}</span>
                      <button onClick={(e) => handleDelete(s.id, e)} className="opacity-0 group-hover:opacity-100 transition-opacity">
                        <Trash2 className="h-3 w-3 text-destructive" />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* Messages area */}
          <div className="flex-1 overflow-y-auto px-3 py-4">
            {!activeSessionId ? (
              <ChatEmptyState onNewChat={handleNewChat} isCreating={createSessionPending} />
            ) : (
              <div className="space-y-3">
                {messages.length === 0 && !isThinking && !streamingText && (
                  <div className="text-center py-8">
                    <Bot className="h-8 w-8 mx-auto text-muted-foreground/40 mb-2" />
                    <p className="text-xs text-muted-foreground">Ask me anything about your CRM data.</p>
                  </div>
                )}

                {messages.map((msg, i) => (
                  <ChatBubble key={i} message={msg} />
                ))}

                {/* Live tool execution cards */}
                {activeTools.length > 0 && (
                  <LiveToolCards tools={activeTools} />
                )}

                {/* Streaming text */}
                {streamingText && (
                  <div className="flex items-start gap-2">
                    <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                      <Bot className="h-3 w-3 text-primary" />
                    </div>
                    <div className="max-w-[85%] rounded-xl px-3 py-2 text-xs leading-relaxed bg-muted/60 text-foreground">
                      <div className="prose prose-xs dark:prose-invert max-w-none [&>*:first-child]:mt-0 [&>*:last-child]:mb-0 [&_p]:text-xs [&_li]:text-xs [&_h1]:text-sm [&_h2]:text-xs [&_h3]:text-xs [&_code]:text-[10px] [&_table]:text-[10px]">
                        <Streamdown>{streamingText}</Streamdown>
                      </div>
                    </div>
                  </div>
                )}

                {/* Tool execution cards (after response complete) */}
                {!isThinking && showTools && lastToolsUsed.length > 0 && (
                  <ToolCards tools={lastToolsUsed} onDismiss={() => setShowTools(false)} />
                )}

                {/* Thinking indicator */}
                {isThinking && !streamingText && activeTools.length === 0 && <ThinkingIndicator />}

                {/* Suggested follow-up prompts */}
                {!isThinking && followUpPrompts.length > 0 && messages.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {followUpPrompts.map((prompt, i) => (
                      <button
                        key={i}
                        onClick={() => {
                          setInput(prompt);
                          inputRef.current?.focus();
                        }}
                        className="text-[11px] px-2.5 py-1 rounded-full border border-border bg-muted/40 text-muted-foreground hover:bg-primary/10 hover:text-primary hover:border-primary/30 transition-colors"
                      >
                        {prompt}
                      </button>
                    ))}
                  </div>
                )}

                <div ref={messagesEndRef} />
              </div>
            )}
          </div>

          {/* Input area */}
          {activeSessionId && (
            <div className="border-t border-border p-2.5 shrink-0">
              <div className="flex gap-1.5">
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Ask Jarvis..."
                  rows={1}
                  className="flex-1 resize-none rounded-lg border border-input bg-background px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1 placeholder:text-muted-foreground min-h-[36px] max-h-[80px]"
                  disabled={isThinking}
                  style={{ overflow: "auto" }}
                />
                <Button onClick={handleSend} disabled={!input.trim() || isThinking} size="icon" className="h-9 w-9 shrink-0">
                  <Send className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </>
  );
}

// ═══════════════════════════════════════════════
// SUB-COMPONENTS
// ═══════════════════════════════════════════════

function SuggestionCard({
  suggestion,
  onClick,
  isLoading,
}: {
  suggestion: Suggestion;
  onClick: () => void;
  isLoading: boolean;
}) {
  const priorityDot = {
    high: "bg-red-500",
    medium: "bg-amber-500",
    low: "bg-emerald-500",
  }[suggestion.priority];

  return (
    <button
      onClick={onClick}
      disabled={isLoading}
      className="w-full text-left p-3 rounded-lg border border-border bg-card hover:bg-accent/50 hover:border-primary/30 transition-all group disabled:opacity-50"
    >
      <div className="flex items-start gap-2.5">
        <div className={`h-2 w-2 rounded-full mt-1.5 shrink-0 ${priorityDot}`} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-semibold text-foreground truncate">{suggestion.title}</p>
            <ArrowRight className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
          </div>
          <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-2 leading-relaxed">
            {suggestion.description}
          </p>
        </div>
      </div>
    </button>
  );
}

function ChatEmptyState({ onNewChat, isCreating }: { onNewChat: () => void; isCreating: boolean }) {
  return (
    <div className="flex flex-col items-center justify-center h-full text-center px-4">
      <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center mb-3">
        <Sparkles className="h-6 w-6 text-primary" />
      </div>
      <h3 className="text-sm font-semibold mb-1">Start a conversation</h3>
      <p className="text-[11px] text-muted-foreground mb-4 max-w-[240px] leading-relaxed">
        Ask Jarvis to search contacts, send messages, check your pipeline, or manage automations.
      </p>
      <Button size="sm" onClick={onNewChat} disabled={isCreating} className="text-xs">
        {isCreating ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : <Plus className="h-3.5 w-3.5 mr-1.5" />}
        New conversation
      </Button>
    </div>
  );
}

function ChatBubble({ message }: { message: JarvisMessage }) {
  const isUser = message.role === "user";

  return (
    <div className={`flex items-start gap-2 ${isUser ? "flex-row-reverse" : ""}`}>
      <div
        className={`h-6 w-6 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${
          isUser ? "bg-foreground/10" : "bg-primary/10"
        }`}
      >
        {isUser ? (
          <span className="text-[10px] font-medium text-foreground">U</span>
        ) : (
          <Bot className="h-3 w-3 text-primary" />
        )}
      </div>
      <div
        className={`max-w-[85%] rounded-xl px-3 py-2 text-xs leading-relaxed ${
          isUser ? "bg-primary text-primary-foreground" : "bg-muted/60 text-foreground"
        }`}
      >
        {isUser ? (
          <p className="whitespace-pre-wrap">{message.content}</p>
        ) : (
          <div className="prose prose-xs dark:prose-invert max-w-none [&>*:first-child]:mt-0 [&>*:last-child]:mb-0 [&_p]:text-xs [&_li]:text-xs [&_h1]:text-sm [&_h2]:text-xs [&_h3]:text-xs [&_code]:text-[10px] [&_table]:text-[10px]">
            <Streamdown>{message.content}</Streamdown>
          </div>
        )}
      </div>
    </div>
  );
}

/** Live tool execution cards — shown during streaming */
function LiveToolCards({ tools }: { tools: ToolEvent[] }) {
  return (
    <div className="ml-8 space-y-1">
      {tools.map((tool, i) => (
        <div
          key={i}
          className="flex items-center gap-1.5 text-[10px] bg-muted/40 rounded px-2 py-1 animate-in fade-in duration-300"
        >
          {tool.status === "running" ? (
            <Loader2 className="h-3 w-3 text-primary animate-spin shrink-0" />
          ) : tool.status === "done" ? (
            <CheckCircle2 className="h-3 w-3 text-emerald-500 shrink-0" />
          ) : (
            <XCircle className="h-3 w-3 text-destructive shrink-0" />
          )}
          <span className={tool.status === "running" ? "text-foreground" : "text-muted-foreground"}>
            {tool.displayName}
          </span>
        </div>
      ))}
    </div>
  );
}

/** Static tool cards — shown after response is complete */
function ToolCards({ tools, onDismiss }: { tools: string[]; onDismiss: () => void }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="ml-8">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-1.5 text-[10px] font-medium text-muted-foreground hover:text-foreground transition-colors"
      >
        <Zap className="h-3 w-3 text-primary" />
        {tools.length} tool{tools.length !== 1 ? "s" : ""} used
        {expanded ? <ChevronUp className="h-2.5 w-2.5" /> : <ChevronDown className="h-2.5 w-2.5" />}
      </button>
      {expanded && (
        <div className="mt-1.5 space-y-1">
          {tools.map((tool, i) => (
            <div key={i} className="flex items-center gap-1.5 text-[10px] text-muted-foreground bg-muted/40 rounded px-2 py-1">
              <CheckCircle2 className="h-3 w-3 text-emerald-500 shrink-0" />
              <span>{TOOL_DISPLAY[tool] || tool}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ThinkingIndicator() {
  return (
    <div className="flex items-start gap-2">
      <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
        <Bot className="h-3 w-3 text-primary" />
      </div>
      <div className="flex items-center gap-2 bg-muted/60 rounded-xl px-3 py-2">
        <div className="flex gap-1">
          <span className="h-1.5 w-1.5 rounded-full bg-primary/60 animate-bounce" style={{ animationDelay: "0ms" }} />
          <span className="h-1.5 w-1.5 rounded-full bg-primary/60 animate-bounce" style={{ animationDelay: "150ms" }} />
          <span className="h-1.5 w-1.5 rounded-full bg-primary/60 animate-bounce" style={{ animationDelay: "300ms" }} />
        </div>
        <span className="text-[11px] text-muted-foreground">Jarvis is thinking...</span>
      </div>
    </div>
  );
}
