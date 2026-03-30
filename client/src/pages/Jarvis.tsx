import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { trpc } from "@/lib/trpc";
import { useAccount } from "@/contexts/AccountContext";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Streamdown } from "streamdown";
import {
  Bot,
  Send,
  Plus,
  Trash2,
  MessageSquare,
  Loader2,
  ChevronLeft,
} from "lucide-react";
import { toast } from "sonner";

interface JarvisMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
  tool_call_id?: string;
  tool_calls?: unknown[];
  timestamp?: number;
}

export default function Jarvis() {
  const { currentAccountId } = useAccount();
  const accountId = currentAccountId!;

  const [activeSessionId, setActiveSessionId] = useState<number | null>(null);
  const [input, setInput] = useState("");
  const [isThinking, setIsThinking] = useState(false);
  const [showSidebar, setShowSidebar] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // ── Queries ──
  const sessionsQuery = trpc.jarvis.listSessions.useQuery(
    { accountId },
    { enabled: !!accountId }
  );

  const sessionQuery = trpc.jarvis.getSession.useQuery(
    { accountId, sessionId: activeSessionId! },
    { enabled: !!accountId && !!activeSessionId }
  );

  const utils = trpc.useUtils();

  // ── Mutations ──
  const createSession = trpc.jarvis.createSession.useMutation({
    onSuccess: (data) => {
      setActiveSessionId(data.id);
      utils.jarvis.listSessions.invalidate({ accountId });
    },
  });

  const chatMutation = trpc.jarvis.chat.useMutation({
    onSuccess: () => {
      utils.jarvis.getSession.invalidate({ accountId, sessionId: activeSessionId! });
      utils.jarvis.listSessions.invalidate({ accountId });
    },
  });

  const deleteSession = trpc.jarvis.deleteSession.useMutation({
    onSuccess: () => {
      if (activeSessionId) {
        setActiveSessionId(null);
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

  // ── Auto-scroll ──
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isThinking]);

  // ── Handlers ──
  const handleNewChat = useCallback(async () => {
    try {
      await createSession.mutateAsync({ accountId });
    } catch {
      toast.error("Failed to create conversation");
    }
  }, [accountId, createSession]);

  const handleSend = useCallback(async () => {
    const trimmed = input.trim();
    if (!trimmed || !activeSessionId || isThinking) return;

    setInput("");
    setIsThinking(true);

    try {
      await chatMutation.mutateAsync({
        accountId,
        sessionId: activeSessionId,
        message: trimmed,
      });
    } catch {
      toast.error("Failed to get response. Please try again.");
    } finally {
      setIsThinking(false);
      inputRef.current?.focus();
    }
  }, [input, activeSessionId, isThinking, accountId, chatMutation]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend]
  );

  const handleDelete = useCallback(
    async (sessionId: number) => {
      try {
        await deleteSession.mutateAsync({ accountId, sessionId });
        toast.success("Conversation deleted");
      } catch {
        toast.error("Failed to delete conversation");
      }
    },
    [accountId, deleteSession]
  );

  // ── Session list ──
  const sessions = sessionsQuery.data ?? [];

  return (
    <div className="flex h-[calc(100vh-3.5rem)] overflow-hidden">
      {/* Sidebar — conversation list */}
      <div
        className={`${
          showSidebar ? "w-72" : "w-0"
        } transition-all duration-200 border-r border-border bg-muted/30 flex-shrink-0 overflow-hidden`}
      >
        <div className="flex flex-col h-full w-72">
          {/* Header */}
          <div className="p-3 border-b border-border flex items-center justify-between">
            <h2 className="font-semibold text-sm text-foreground">Conversations</h2>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={handleNewChat}
              disabled={createSession.isPending}
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>

          {/* Session list */}
          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {sessions.length === 0 && (
              <p className="text-xs text-muted-foreground text-center py-8">
                No conversations yet
              </p>
            )}
            {sessions.map((s: { id: number; title: string; updatedAt: Date }) => (
              <div
                key={s.id}
                className={`group flex items-center gap-2 px-3 py-2 rounded-md cursor-pointer text-sm transition-colors ${
                  activeSessionId === s.id
                    ? "bg-primary/10 text-primary font-medium"
                    : "hover:bg-muted text-foreground"
                }`}
                onClick={() => setActiveSessionId(s.id)}
              >
                <MessageSquare className="h-3.5 w-3.5 flex-shrink-0 opacity-60" />
                <span className="flex-1 truncate">{s.title}</span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDelete(s.id);
                  }}
                >
                  <Trash2 className="h-3 w-3 text-destructive" />
                </Button>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Main chat area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar */}
        <div className="h-12 border-b border-border flex items-center px-4 gap-3 flex-shrink-0">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => setShowSidebar(!showSidebar)}
          >
            <ChevronLeft
              className={`h-4 w-4 transition-transform ${
                showSidebar ? "" : "rotate-180"
              }`}
            />
          </Button>
          <div className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center">
              <Bot className="h-4 w-4 text-primary" />
            </div>
            <span className="font-semibold text-sm">Jarvis AI</span>
          </div>
          {activeSessionId && sessionQuery.data && (
            <span className="text-xs text-muted-foreground truncate ml-2">
              {sessionQuery.data.title}
            </span>
          )}
        </div>

        {/* Messages area */}
        <div className="flex-1 overflow-y-auto px-4 py-6">
          {!activeSessionId ? (
            <EmptyState onNewChat={handleNewChat} isCreating={createSession.isPending} />
          ) : (
            <div className="max-w-3xl mx-auto space-y-4">
              {messages.length === 0 && !isThinking && (
                <div className="text-center py-12">
                  <Bot className="h-10 w-10 mx-auto text-muted-foreground/40 mb-3" />
                  <p className="text-sm text-muted-foreground">
                    Ask me anything about your contacts, pipeline, campaigns, or automations.
                  </p>
                </div>
              )}

              {messages.map((msg, i) => (
                <MessageBubble key={i} message={msg} />
              ))}

              {isThinking && (
                <div className="flex items-start gap-3">
                  <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <Bot className="h-4 w-4 text-primary" />
                  </div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Thinking...
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* Input area */}
        {activeSessionId && (
          <div className="border-t border-border p-4 flex-shrink-0">
            <div className="max-w-3xl mx-auto flex gap-2">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask Jarvis anything..."
                rows={1}
                className="flex-1 resize-none rounded-lg border border-input bg-background px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1 placeholder:text-muted-foreground"
                disabled={isThinking}
              />
              <Button
                onClick={handleSend}
                disabled={!input.trim() || isThinking}
                size="icon"
                className="h-10 w-10 flex-shrink-0"
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Sub-components ──

function EmptyState({
  onNewChat,
  isCreating,
}: {
  onNewChat: () => void;
  isCreating: boolean;
}) {
  return (
    <div className="flex items-center justify-center h-full">
      <Card className="max-w-md w-full p-8 text-center border-dashed">
        <div className="h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
          <Bot className="h-7 w-7 text-primary" />
        </div>
        <h2 className="text-xl font-semibold mb-2">Meet Jarvis</h2>
        <p className="text-sm text-muted-foreground mb-6 leading-relaxed">
          Your AI-powered CRM assistant. Search contacts, send messages, view
          pipeline stats, trigger automations, and more — all through natural
          conversation.
        </p>
        <div className="grid grid-cols-2 gap-2 mb-6 text-xs text-muted-foreground">
          <div className="bg-muted/50 rounded-lg p-3 text-left">
            &ldquo;Show me my top 10 leads&rdquo;
          </div>
          <div className="bg-muted/50 rounded-lg p-3 text-left">
            &ldquo;Send an SMS to John Doe&rdquo;
          </div>
          <div className="bg-muted/50 rounded-lg p-3 text-left">
            &ldquo;What are my pipeline stats?&rdquo;
          </div>
          <div className="bg-muted/50 rounded-lg p-3 text-left">
            &ldquo;Create a contact for Jane Smith&rdquo;
          </div>
        </div>
        <Button onClick={onNewChat} disabled={isCreating} className="w-full">
          {isCreating ? (
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
          ) : (
            <Plus className="h-4 w-4 mr-2" />
          )}
          Start a conversation
        </Button>
      </Card>
    </div>
  );
}

function MessageBubble({ message }: { message: JarvisMessage }) {
  const isUser = message.role === "user";

  return (
    <div className={`flex items-start gap-3 ${isUser ? "flex-row-reverse" : ""}`}>
      <div
        className={`h-7 w-7 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${
          isUser
            ? "bg-foreground/10"
            : "bg-primary/10"
        }`}
      >
        {isUser ? (
          <span className="text-xs font-medium text-foreground">U</span>
        ) : (
          <Bot className="h-4 w-4 text-primary" />
        )}
      </div>
      <div
        className={`max-w-[80%] rounded-xl px-4 py-2.5 text-sm leading-relaxed ${
          isUser
            ? "bg-primary text-primary-foreground"
            : "bg-muted/60 text-foreground"
        }`}
      >
        {isUser ? (
          <p className="whitespace-pre-wrap">{message.content}</p>
        ) : (
          <div className="prose prose-sm dark:prose-invert max-w-none [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
            <Streamdown>{message.content}</Streamdown>
          </div>
        )}
      </div>
    </div>
  );
}
