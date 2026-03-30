import { useState, useEffect, useRef, useCallback, useMemo, Component, type ReactNode } from "react";
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
  ShieldAlert,
  ShieldCheck,
  ShieldX,
  Clock,
  AlertTriangle,
  RefreshCw,
} from "lucide-react";
import { toast } from "sonner";

// ═══════════════════════════════════════════════
// ERROR BOUNDARY
// ═══════════════════════════════════════════════

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class JarvisErrorBoundary extends Component<
  { children: ReactNode; onRetry?: () => void },
  ErrorBoundaryState
> {
  constructor(props: { children: ReactNode; onRetry?: () => void }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error("[JarvisPanel] Error caught by boundary:", error, info);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
    this.props.onRetry?.();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center h-full text-center px-4 py-8">
          <div className="h-12 w-12 rounded-xl bg-destructive/10 flex items-center justify-center mb-3">
            <AlertTriangle className="h-6 w-6 text-destructive" />
          </div>
          <h3 className="text-sm font-semibold mb-1">Jarvis encountered an error</h3>
          <p className="text-[11px] text-muted-foreground mb-4 max-w-[240px] leading-relaxed">
            Something went wrong. Click below to retry.
          </p>
          <Button size="sm" onClick={this.handleRetry} className="text-xs">
            <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
            Retry
          </Button>
        </div>
      );
    }
    return this.props.children;
  }
}

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

interface PendingConfirmation {
  requestId: string;
  name: string;
  displayName: string;
  summary: string;
  args: Record<string, unknown>;
  timestamp: number;
}

type PanelMode = "suggestions" | "chat";

const PANEL_COLLAPSED_KEY = "jarvis-panel-collapsed";
const ACTIVE_SESSION_KEY = "jarvis-active-session";
const PANEL_WIDTH = 380;

// ═══════════════════════════════════════════════
// TOOL NAME DISPLAY MAP
// ═══════════════════════════════════════════════

const TOOL_DISPLAY: Record<string, string> = {
  search_contacts: "Searched contacts",
  get_contact_detail: "Fetched contact details",
  create_contact: "Created a contact",
  update_contact: "Updated contact info",
  get_communication_history: "Fetched messages",
  send_sms: "Sent SMS",
  send_email: "Sent email",
  get_pipeline_overview: "Checked pipeline",
  move_deal_stage: "Moved deal stage",
  get_dashboard_stats: "Fetched dashboard stats",
  get_contact_stats: "Fetched contact stats",
  get_message_stats: "Fetched message stats",
  get_campaign_stats: "Fetched campaign stats",
  list_campaigns: "Listed campaigns",
  list_workflows: "Listed workflows",
  trigger_workflow: "Triggered workflow",
  list_sequences: "Listed sequences",
  enroll_in_sequence: "Enrolled in sequence",
  get_tags: "Fetched tags",
  list_segments: "Listed segments",
  get_appointments: "Fetched appointments",
  get_available_slots: "Checked availability",
  schedule_appointment: "Scheduled appointment",
  add_contact_note: "Added note",
  log_activity: "Logged activity",
  get_contacts_by_filter: "Filtered contacts",
  get_analytics: "Fetched analytics",
  bulk_send_sms: "Sent bulk SMS",
  trigger_automation: "Triggered automation",
};

// ═══════════════════════════════════════════════
// SSE STREAM CONSUMER
// ═══════════════════════════════════════════════

interface StreamCallbacks {
  onToolStart: (name: string, displayName: string) => void;
  onToolResult: (name: string, displayName: string, success: boolean) => void;
  onTextDelta: (content: string) => void;
  onConfirmationRequired: (data: { requestId: string; name: string; displayName: string; summary: string; args: Record<string, unknown> }) => void;
  onConfirmationResult: (data: { requestId: string; approved: boolean; name: string; displayName: string }) => void;
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
  let res: Response;
  try {
    res = await fetch("/api/jarvis/stream", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ accountId, sessionId, message }),
      credentials: "include",
      signal,
    });
  } catch (err: any) {
    if (err?.name === "AbortError") throw err;
    callbacks.onError("Network error. Please check your connection and try again.");
    return;
  }

  if (!res.ok) {
    callbacks.onError(`Request failed (${res.status}). Please try again.`);
    return;
  }

  const reader = res.body?.getReader();
  if (!reader) {
    callbacks.onError("No response body");
    return;
  }

  const decoder = new TextDecoder();
  let buffer = "";

  try {
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
                callbacks.onToolStart(data?.name ?? "unknown", data?.displayName ?? "Processing...");
                break;
              case "tool_result":
                callbacks.onToolResult(data?.name ?? "unknown", data?.displayName ?? "Done", data?.success ?? false);
                break;
              case "text_delta":
                callbacks.onTextDelta(data?.content ?? "");
                break;
              case "done":
                callbacks.onDone(data?.toolsUsed ?? []);
                break;
              case "error":
                callbacks.onError(data?.message ?? "An unknown error occurred");
                break;
              case "confirmation_required":
                callbacks.onConfirmationRequired({
                  requestId: data?.requestId ?? "",
                  name: data?.name ?? "unknown",
                  displayName: data?.displayName ?? "Action",
                  summary: data?.summary ?? "Confirm this action?",
                  args: data?.args ?? {},
                });
                break;
              case "confirmation_result":
                callbacks.onConfirmationResult({
                  requestId: data?.requestId ?? "",
                  approved: data?.approved ?? false,
                  name: data?.name ?? "unknown",
                  displayName: data?.displayName ?? "Action",
                });
                break;
            }
          } catch {
            // Ignore malformed JSON lines
          }
          eventType = "";
        } else if (line === "") {
          eventType = "";
        }
      }
    }
  } catch (err: any) {
    if (err?.name === "AbortError") throw err;
    callbacks.onError("Stream interrupted. Please try again.");
  }
}

// ═══════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════

export function JarvisPanel({ pageContext }: { pageContext: string }) {
  return (
    <JarvisErrorBoundary>
      <JarvisPanelInner pageContext={pageContext} />
    </JarvisErrorBoundary>
  );
}

function JarvisPanelInner({ pageContext }: { pageContext: string }) {
  const { currentAccountId } = useAccount();
  const accountId = currentAccountId!;
  const isMobile = useIsMobile();

  const [collapsed, setCollapsed] = useState(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem(PANEL_COLLAPSED_KEY) === "true";
  });
  const [mobileOpen, setMobileOpen] = useState(false);
  // ── Restore active session from localStorage ──
  const [mode, setMode] = useState<PanelMode>(() => {
    if (typeof window === "undefined") return "suggestions";
    const stored = localStorage.getItem(`${ACTIVE_SESSION_KEY}-${accountId}`);
    return stored ? "chat" : "suggestions";
  });
  const [activeSessionId, setActiveSessionId] = useState<number | null>(() => {
    if (typeof window === "undefined") return null;
    const stored = localStorage.getItem(`${ACTIVE_SESSION_KEY}-${accountId}`);
    return stored ? parseInt(stored, 10) : null;
  });
  const [showHistory, setShowHistory] = useState(false);
  const [input, setInput] = useState("");
  const [isThinking, setIsThinking] = useState(false);
  const [streamingText, setStreamingText] = useState("");
  const [activeTools, setActiveTools] = useState<ToolEvent[]>([]);
  const [lastToolsUsed, setLastToolsUsed] = useState<string[]>([]);
  const [showTools, setShowTools] = useState(false);
  const [pendingConfirmation, setPendingConfirmation] = useState<PendingConfirmation | null>(null);
  const [resolvedConfirmations, setResolvedConfirmations] = useState<Array<{ requestId: string; approved: boolean; name: string; displayName: string }>>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  // ── Confirm/Reject handler ──
  const handleConfirm = useCallback(async (requestId: string, approved: boolean) => {
    try {
      await fetch("/api/jarvis/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requestId, approved }),
        credentials: "include",
      });
      setPendingConfirmation(null);
    } catch {
      toast.error("Failed to send confirmation");
    }
  }, []);

  // Persist collapsed state (desktop only)
  useEffect(() => {
    if (!isMobile) {
      localStorage.setItem(PANEL_COLLAPSED_KEY, collapsed.toString());
    }
  }, [collapsed, isMobile]);

  // Persist active session ID to localStorage
  useEffect(() => {
    if (activeSessionId) {
      localStorage.setItem(`${ACTIVE_SESSION_KEY}-${accountId}`, String(activeSessionId));
    } else {
      localStorage.removeItem(`${ACTIVE_SESSION_KEY}-${accountId}`);
    }
  }, [activeSessionId, accountId]);

  // ── Queries ──
  const recommendationsQuery = trpc.jarvis.getRecommendations.useQuery(
    { accountId, pageContext },
    { enabled: !!accountId && mode === "suggestions" && (!collapsed || mobileOpen), retry: 1 }
  );

  const sessionsQuery = trpc.jarvis.listSessions.useQuery(
    { accountId },
    { enabled: !!accountId && (!collapsed || mobileOpen), retry: 1 }
  );

  const sessionQuery = trpc.jarvis.getSession.useQuery(
    { accountId, sessionId: activeSessionId! },
    { enabled: !!accountId && !!activeSessionId && mode === "chat" && (!collapsed || mobileOpen), retry: 1 }
  );

  // Validate restored session still exists — if not, fall back to suggestions
  useEffect(() => {
    if (activeSessionId && sessionsQuery.data && Array.isArray(sessionsQuery.data)) {
      const exists = sessionsQuery.data.some((s: any) => s.id === activeSessionId);
      if (!exists) {
        setActiveSessionId(null);
        setMode("suggestions");
        localStorage.removeItem(`${ACTIVE_SESSION_KEY}-${accountId}`);
      }
    }
  }, [activeSessionId, sessionsQuery.data, accountId]);

  const utils = trpc.useUtils();

  // ── Mutations ──
  const createSession = trpc.jarvis.createSession.useMutation({
    onSuccess: (data) => {
      if (data?.id) {
        setActiveSessionId(data.id);
        setMode("chat");
        setShowHistory(false);
        utils.jarvis.listSessions.invalidate({ accountId });
      }
    },
  });

  const deleteSession = trpc.jarvis.deleteSession.useMutation({
    onSuccess: (_, vars) => {
      if (activeSessionId === vars?.sessionId) {
        setActiveSessionId(null);
        setMode("suggestions");
      }
      utils.jarvis.listSessions.invalidate({ accountId });
    },
  });

  // ── Derived state with null safety ──
  const messages: JarvisMessage[] = useMemo(() => {
    const raw = sessionQuery.data?.messages;
    if (!raw || !Array.isArray(raw)) return [];
    return raw.filter(
      (m: JarvisMessage) => m?.role === "user" || m?.role === "assistant"
    );
  }, [sessionQuery.data?.messages]);

  const suggestions: Suggestion[] = useMemo(() => {
    const data = recommendationsQuery.data;
    if (!data || !Array.isArray(data)) return [];
    return data;
  }, [recommendationsQuery.data]);

  const sessions = useMemo(() => {
    const data = sessionsQuery.data;
    if (!data || !Array.isArray(data)) return [];
    return data;
  }, [sessionsQuery.data]);

  // ── Auto-scroll ──
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isThinking, streamingText, activeTools]);

  // ── Build stream callbacks (shared between handleSend and handleSuggestionClick) ──
  const buildStreamCallbacks = useCallback(
    (targetSessionId: number): StreamCallbacks => ({
      onToolStart: (name, displayName) => {
        setActiveTools((prev) => [...prev, { name, displayName, status: "running" }]);
      },
      onToolResult: (name, displayName, success) => {
        setActiveTools((prev) =>
          (prev ?? []).map((t) =>
            t.name === name && t.status === "running"
              ? { ...t, success, status: success ? "done" : "error" }
              : t
          )
        );
      },
      onTextDelta: (content) => {
        setStreamingText((prev) => (prev ?? "") + (content ?? ""));
      },
      onConfirmationRequired: (data) => {
        setPendingConfirmation({ ...data, timestamp: Date.now() });
      },
      onConfirmationResult: (data) => {
        setPendingConfirmation(null);
        setResolvedConfirmations((prev) => [...(prev ?? []), data]);
      },
      onDone: (toolsUsed) => {
        setLastToolsUsed(toolsUsed ?? []);
        setShowTools((toolsUsed ?? []).length > 0);
        utils.jarvis.getSession.invalidate({ accountId, sessionId: targetSessionId });
        utils.jarvis.listSessions.invalidate({ accountId });
      },
      onError: (message) => {
        // Show error as an assistant message in the chat instead of a toast
        toast.error(message || "Failed to get response");
      },
    }),
    [accountId, utils]
  );

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
    setPendingConfirmation(null);
    setResolvedConfirmations([]);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      await streamChat(
        accountId,
        activeSessionId,
        trimmed,
        buildStreamCallbacks(activeSessionId),
        controller.signal
      );
    } catch (err: any) {
      if (err?.name !== "AbortError") {
        toast.error("Failed to get response. Please try again.");
      }
    } finally {
      setIsThinking(false);
      setStreamingText("");
      setActiveTools([]);
      setPendingConfirmation(null);
      abortRef.current = null;
      inputRef.current?.focus();
    }
  }, [input, activeSessionId, isThinking, accountId, buildStreamCallbacks]);

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
        if (!session?.id) {
          toast.error("Failed to create conversation");
          return;
        }
        setInput("");
        setIsThinking(true);
        setStreamingText("");
        setActiveTools([]);
        setLastToolsUsed([]);
        setShowTools(false);
        setPendingConfirmation(null);
        setResolvedConfirmations([]);

        const controller = new AbortController();
        abortRef.current = controller;

        await streamChat(
          accountId,
          session.id,
          prompt,
          buildStreamCallbacks(session.id),
          controller.signal
        );
      } catch (err: any) {
        if (err?.name !== "AbortError") {
          toast.error("Failed to start conversation");
        }
      } finally {
        setIsThinking(false);
        setStreamingText("");
        setActiveTools([]);
        setPendingConfirmation(null);
        abortRef.current = null;
      }
    },
    [accountId, createSession, buildStreamCallbacks]
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
    if (!messages || messages.length === 0) return [];
    const lastAssistant = [...messages].reverse().find((m) => m?.role === "assistant");
    if (!lastAssistant?.content) return [];
    const content = (lastAssistant.content ?? "").toLowerCase();

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

              {/* Content */}
              <PanelContent
                mode={mode}
                setMode={setMode}
                collapsed={false}
                suggestions={suggestions}
                recommendationsLoading={recommendationsQuery.isLoading}
                recommendationsError={recommendationsQuery.isError}
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
                pendingConfirmation={pendingConfirmation}
                resolvedConfirmations={resolvedConfirmations}
                handleConfirm={handleConfirm}
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
        recommendationsError={recommendationsQuery.isError}
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
        pendingConfirmation={pendingConfirmation}
        resolvedConfirmations={resolvedConfirmations}
        handleConfirm={handleConfirm}
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
  recommendationsError: boolean;
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
  pendingConfirmation: PendingConfirmation | null;
  resolvedConfirmations: Array<{ requestId: string; approved: boolean; name: string; displayName: string }>;
  handleConfirm: (requestId: string, approved: boolean) => void;
}

function PanelContent(props: PanelContentProps) {
  const {
    mode, setMode, suggestions, recommendationsLoading, recommendationsError, sessions,
    showHistory, setShowHistory, activeSessionId, sessionQuery,
    messages, isThinking, streamingText, activeTools,
    lastToolsUsed, showTools, setShowTools, followUpPrompts,
    input, setInput, inputRef, messagesEndRef,
    handleSend, handleKeyDown, handleNewChat, handleSuggestionClick,
    handleDelete, handleResumeSession, createSessionPending, pageContext,
    pendingConfirmation, resolvedConfirmations, handleConfirm,
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
              /* Skeleton loading cards */
              <div className="space-y-2">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="w-full p-3 rounded-lg border border-border bg-card animate-pulse">
                    <div className="flex items-start gap-2.5">
                      <div className="h-2 w-2 rounded-full mt-1.5 shrink-0 bg-muted-foreground/20" />
                      <div className="flex-1 min-w-0 space-y-2">
                        <div className="h-3 bg-muted-foreground/20 rounded w-3/4" />
                        <div className="h-2.5 bg-muted-foreground/10 rounded w-full" />
                        <div className="h-2.5 bg-muted-foreground/10 rounded w-2/3" />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : recommendationsError ? (
              <div className="text-center py-8">
                <AlertTriangle className="h-5 w-5 mx-auto text-muted-foreground/40 mb-2" />
                <p className="text-xs text-muted-foreground">Could not load recommendations</p>
                <p className="text-[10px] text-muted-foreground/60 mt-1">Try switching pages or refreshing</p>
              </div>
            ) : (suggestions ?? []).length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-8">
                No suggestions for this page
              </p>
            ) : (
              (suggestions ?? []).map((s, i) => (
                <SuggestionCard
                  key={i}
                  suggestion={s}
                  onClick={() => handleSuggestionClick(s?.prompt ?? "")}
                  isLoading={createSessionPending || isThinking}
                />
              ))
            )}
          </div>

          {(sessions ?? []).length > 0 && (
            <div className="border-t border-border px-3 py-3">
              <button
                onClick={() => setShowHistory(!showHistory)}
                className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors w-full"
              >
                <History className="h-3 w-3" />
                Recent conversations ({(sessions ?? []).length})
                {showHistory ? <ChevronUp className="h-3 w-3 ml-auto" /> : <ChevronDown className="h-3 w-3 ml-auto" />}
              </button>
              {showHistory && (
                <div className="mt-2 space-y-1">
                  {(sessions ?? []).slice(0, 5).map((s) => (
                    <div
                      key={s?.id}
                      className="group flex items-center gap-2 px-2 py-1.5 rounded-md cursor-pointer text-xs hover:bg-muted transition-colors"
                      onClick={() => handleResumeSession(s?.id)}
                    >
                      <MessageSquare className="h-3 w-3 text-muted-foreground shrink-0" />
                      <span className="truncate flex-1 text-foreground">{s?.title ?? "Untitled"}</span>
                      <button
                        onClick={(e) => handleDelete(s?.id, e)}
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
                  {sessionQuery.data?.title ?? "Conversation"}
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
                {(sessions ?? []).length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-3">No conversations yet</p>
                ) : (
                  (sessions ?? []).map((s) => (
                    <div
                      key={s?.id}
                      className={`group flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer text-xs transition-colors ${
                        activeSessionId === s?.id ? "bg-primary/10 text-primary font-medium" : "hover:bg-muted text-foreground"
                      }`}
                      onClick={() => handleResumeSession(s?.id)}
                    >
                      <MessageSquare className="h-3 w-3 shrink-0 opacity-60" />
                      <span className="truncate flex-1">{s?.title ?? "Untitled"}</span>
                      <button onClick={(e) => handleDelete(s?.id, e)} className="opacity-0 group-hover:opacity-100 transition-opacity">
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
                {(messages ?? []).length === 0 && !isThinking && !streamingText && (
                  <div className="text-center py-8">
                    <Bot className="h-8 w-8 mx-auto text-muted-foreground/40 mb-2" />
                    <p className="text-xs text-muted-foreground">Ask me anything about your CRM data.</p>
                  </div>
                )}

                {(messages ?? []).map((msg, i) => (
                  <ChatBubble key={i} message={msg} />
                ))}

                {/* Live tool execution cards */}
                {(activeTools ?? []).length > 0 && (
                  <LiveToolCards tools={activeTools ?? []} />
                )}

                {/* Resolved confirmation cards */}
                {(resolvedConfirmations ?? []).map((rc) => (
                  <ResolvedConfirmationCard key={rc?.requestId} data={rc} />
                ))}

                {/* Pending confirmation card */}
                {pendingConfirmation && (
                  <ConfirmationCard
                    confirmation={pendingConfirmation}
                    onConfirm={handleConfirm}
                  />
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
                {!isThinking && showTools && (lastToolsUsed ?? []).length > 0 && (
                  <ToolCards tools={lastToolsUsed ?? []} onDismiss={() => setShowTools(false)} />
                )}

                {/* Thinking indicator with active tool name */}
                {isThinking && !streamingText && (
                  <ThinkingIndicator activeTool={(activeTools ?? []).find((t) => t?.status === "running")} />
                )}

                {/* Suggested follow-up prompts */}
                {!isThinking && (followUpPrompts ?? []).length > 0 && (messages ?? []).length > 0 && (
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {(followUpPrompts ?? []).map((prompt, i) => (
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
              {/* Show disabled state hint when thinking */}
              {isThinking && (
                <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground mb-1.5 px-1">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  <span>Jarvis is working{pendingConfirmation ? " — waiting for your approval" : ""}...</span>
                </div>
              )}
              <div className="flex gap-1.5">
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={isThinking ? "Waiting for Jarvis..." : "Ask Jarvis..."}
                  rows={1}
                  className="flex-1 resize-none rounded-lg border border-input bg-background px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1 placeholder:text-muted-foreground min-h-[36px] max-h-[80px] disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={isThinking}
                  style={{ overflow: "auto" }}
                />
                <Button onClick={handleSend} disabled={!input.trim() || isThinking} size="icon" className="h-9 w-9 shrink-0">
                  {isThinking ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
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
  }[suggestion?.priority ?? "low"] ?? "bg-emerald-500";

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
            <p className="text-xs font-semibold text-foreground truncate">{suggestion?.title ?? "Suggestion"}</p>
            <ArrowRight className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
          </div>
          <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-2 leading-relaxed">
            {suggestion?.description ?? ""}
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
  const isUser = message?.role === "user";
  const content = message?.content ?? "";

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
          <p className="whitespace-pre-wrap">{content}</p>
        ) : (
          <div className="prose prose-xs dark:prose-invert max-w-none [&>*:first-child]:mt-0 [&>*:last-child]:mb-0 [&_p]:text-xs [&_li]:text-xs [&_h1]:text-sm [&_h2]:text-xs [&_h3]:text-xs [&_code]:text-[10px] [&_table]:text-[10px]">
            <Streamdown>{content}</Streamdown>
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
      {(tools ?? []).map((tool, i) => (
        <div
          key={i}
          className="flex items-center gap-1.5 text-[10px] bg-muted/40 rounded px-2 py-1 animate-in fade-in duration-300"
        >
          {tool?.status === "running" ? (
            <Loader2 className="h-3 w-3 text-primary animate-spin shrink-0" />
          ) : tool?.status === "done" ? (
            <CheckCircle2 className="h-3 w-3 text-emerald-500 shrink-0" />
          ) : (
            <XCircle className="h-3 w-3 text-destructive shrink-0" />
          )}
          <span className={tool?.status === "running" ? "text-foreground" : "text-muted-foreground"}>
            {tool?.displayName ?? "Processing..."}
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
        {(tools ?? []).length} tool{(tools ?? []).length !== 1 ? "s" : ""} used
        {expanded ? <ChevronUp className="h-2.5 w-2.5" /> : <ChevronDown className="h-2.5 w-2.5" />}
      </button>
      {expanded && (
        <div className="mt-1.5 space-y-1">
          {(tools ?? []).map((tool, i) => (
            <div key={i} className="flex items-center gap-1.5 text-[10px] text-muted-foreground bg-muted/40 rounded px-2 py-1">
              <CheckCircle2 className="h-3 w-3 text-emerald-500 shrink-0" />
              <span>{TOOL_DISPLAY[tool] ?? tool ?? "Unknown tool"}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ThinkingIndicator({ activeTool }: { activeTool?: ToolEvent }) {
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
        <span className="text-[11px] text-muted-foreground">
          {activeTool?.displayName
            ? `${activeTool.displayName}...`
            : "Jarvis is thinking..."}
        </span>
      </div>
    </div>
  );
}

/** Confirmation card — pauses execution until user approves or rejects */
function ConfirmationCard({
  confirmation,
  onConfirm,
}: {
  confirmation: PendingConfirmation;
  onConfirm: (requestId: string, approved: boolean) => void;
}) {
  const [deciding, setDeciding] = useState(false);

  const handleAction = async (approved: boolean) => {
    setDeciding(true);
    await onConfirm(confirmation?.requestId ?? "", approved);
  };

  // Format args for display — with null safety
  const argEntries = Object.entries(confirmation?.args ?? {}).filter(
    ([, v]) => v !== undefined && v !== null && v !== ""
  );

  return (
    <div className="ml-8 animate-in fade-in slide-in-from-bottom-2 duration-300">
      <div className="rounded-lg border-2 border-amber-500/40 bg-amber-500/5 overflow-hidden">
        {/* Header */}
        <div className="flex items-center gap-2 px-3 py-2 bg-amber-500/10 border-b border-amber-500/20">
          <ShieldAlert className="h-4 w-4 text-amber-500 shrink-0" />
          <span className="text-xs font-semibold text-amber-600 dark:text-amber-400">
            Confirmation Required
          </span>
        </div>

        {/* Body */}
        <div className="px-3 py-2.5 space-y-2">
          <p className="text-xs text-foreground font-medium">
            {confirmation?.summary ?? "Confirm this action?"}
          </p>

          {/* Action details */}
          <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
            <Zap className="h-3 w-3 text-primary shrink-0" />
            <span>{confirmation?.displayName ?? "Action"}</span>
          </div>

          {/* Args preview */}
          {argEntries.length > 0 && (
            <div className="bg-muted/40 rounded-md px-2.5 py-2 space-y-1">
              {argEntries.slice(0, 5).map(([key, value]) => (
                <div key={key} className="flex items-start gap-2 text-[10px]">
                  <span className="text-muted-foreground font-medium shrink-0 min-w-[60px]">
                    {key.replace(/_/g, " ")}:
                  </span>
                  <span className="text-foreground truncate">
                    {typeof value === "string" ? value : JSON.stringify(value)}
                  </span>
                </div>
              ))}
              {argEntries.length > 5 && (
                <p className="text-[10px] text-muted-foreground">
                  +{argEntries.length - 5} more parameters
                </p>
              )}
            </div>
          )}

          {/* Action buttons */}
          <div className="flex items-center gap-2 pt-1">
            <Button
              size="sm"
              variant="default"
              className="h-7 text-xs flex-1 bg-emerald-600 hover:bg-emerald-700 text-white"
              onClick={() => handleAction(true)}
              disabled={deciding}
            >
              {deciding ? (
                <Loader2 className="h-3 w-3 animate-spin mr-1" />
              ) : (
                <ShieldCheck className="h-3 w-3 mr-1" />
              )}
              Approve
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs flex-1 border-destructive/30 text-destructive hover:bg-destructive/10"
              onClick={() => handleAction(false)}
              disabled={deciding}
            >
              <ShieldX className="h-3 w-3 mr-1" />
              Reject
            </Button>
          </div>

          {/* Timer hint */}
          <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
            <Clock className="h-3 w-3" />
            <span>Waiting for your decision — Jarvis is paused</span>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Resolved confirmation card — shows after user approved/rejected */
function ResolvedConfirmationCard({
  data,
}: {
  data: { requestId: string; approved: boolean; name: string; displayName: string };
}) {
  return (
    <div className="ml-8">
      <div
        className={`flex items-center gap-1.5 text-[10px] rounded px-2 py-1 ${
          data?.approved
            ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
            : "bg-destructive/10 text-destructive"
        }`}
      >
        {data?.approved ? (
          <ShieldCheck className="h-3 w-3 shrink-0" />
        ) : (
          <ShieldX className="h-3 w-3 shrink-0" />
        )}
        <span className="font-medium">
          {data?.approved ? "Approved" : "Rejected"}: {data?.displayName ?? "Action"}
        </span>
      </div>
    </div>
  );
}
