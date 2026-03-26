import { useState, useRef, useEffect } from "react";
import { useAiAdvisor } from "@/contexts/AiAdvisorContext";
import { useAccount } from "@/contexts/AccountContext";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import {
  Sparkles,
  X,
  Send,
  Loader2,
  Lightbulb,
  MessageSquare,
  ArrowRight,
  Phone,
  Users,
  Zap,
  BarChart3,
  Target,
} from "lucide-react";
import { Streamdown } from "streamdown";

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

const CATEGORY_ICONS: Record<string, React.ElementType> = {
  "follow-up": Phone,
  pipeline: Target,
  campaign: Zap,
  call: Phone,
  general: BarChart3,
};

const PRIORITY_COLORS: Record<string, string> = {
  high: "bg-red-100 text-red-700 border-red-200",
  medium: "bg-amber-100 text-amber-700 border-amber-200",
  low: "bg-emerald-100 text-emerald-700 border-emerald-200",
};

/**
 * Floating AI Advisor button + slide-out sidepanel.
 * Renders at the bottom-right of the viewport.
 */
export function AiAdvisorSidepanel() {
  const { isOpen, activeTab, pageContext, open, close, setActiveTab } =
    useAiAdvisor();
  const { currentAccountId } = useAccount();

  if (!currentAccountId) return null;

  return (
    <>
      {/* Floating trigger button */}
      {!isOpen && (
        <button
          onClick={open}
          className="fixed bottom-6 right-6 z-50 flex items-center gap-2 rounded-full bg-primary px-4 py-3 text-primary-foreground shadow-lg hover:shadow-xl transition-all hover:scale-105 active:scale-95"
          aria-label="Open AI Advisor"
        >
          <Sparkles className="h-5 w-5" />
          <span className="text-sm font-medium hidden sm:inline">AI Advisor</span>
        </button>
      )}

      {/* Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/20 backdrop-blur-[2px] transition-opacity"
          onClick={close}
        />
      )}

      {/* Sidepanel */}
      <div
        className={cn(
          "fixed top-0 right-0 z-50 h-full w-full sm:w-[420px] bg-background border-l border-border shadow-2xl transition-transform duration-300 ease-in-out flex flex-col",
          isOpen ? "translate-x-0" : "translate-x-full"
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-muted/30">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <Sparkles className="h-4 w-4 text-primary" />
            </div>
            <div>
              <h2 className="text-sm font-semibold">AI Advisor</h2>
              <p className="text-[10px] text-muted-foreground">
                Your CRM copilot
              </p>
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={close} className="h-8 w-8">
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-border">
          <button
            onClick={() => setActiveTab("suggestions")}
            className={cn(
              "flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-medium transition-colors",
              activeTab === "suggestions"
                ? "text-primary border-b-2 border-primary"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Lightbulb className="h-3.5 w-3.5" />
            Suggestions
          </button>
          <button
            onClick={() => setActiveTab("chat")}
            className={cn(
              "flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-medium transition-colors",
              activeTab === "chat"
                ? "text-primary border-b-2 border-primary"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <MessageSquare className="h-3.5 w-3.5" />
            Chat
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden">
          {activeTab === "suggestions" ? (
            <SuggestionsTab
              accountId={currentAccountId}
              pageContext={pageContext}
            />
          ) : (
            <ChatTab
              accountId={currentAccountId}
              pageContext={pageContext}
            />
          )}
        </div>
      </div>
    </>
  );
}

// ─────────────────────────────────────────────
// SUGGESTIONS TAB
// ─────────────────────────────────────────────

function SuggestionsTab({
  accountId,
  pageContext,
}: {
  accountId: number;
  pageContext: string;
}) {
  const { data, isLoading, refetch } = trpc.aiAdvisor.getSuggestions.useQuery(
    { accountId, pageContext },
    { staleTime: 5 * 60 * 1000, refetchOnWindowFocus: false }
  );

  return (
    <ScrollArea className="h-full">
      <div className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground">
            Personalized suggestions based on your data
          </p>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => refetch()}
            disabled={isLoading}
            className="h-7 text-xs"
          >
            {isLoading ? (
              <Loader2 className="h-3 w-3 animate-spin mr-1" />
            ) : null}
            Refresh
          </Button>
        </div>

        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="rounded-lg border border-border p-3 space-y-2 animate-pulse"
              >
                <div className="h-4 bg-muted rounded w-3/4" />
                <div className="h-3 bg-muted rounded w-full" />
                <div className="h-3 bg-muted rounded w-1/2" />
              </div>
            ))}
          </div>
        ) : data?.suggestions?.length ? (
          <div className="space-y-2.5">
            {data.suggestions.map((s: any, i: number) => {
              const Icon = CATEGORY_ICONS[s.category] || Lightbulb;
              return (
                <div
                  key={i}
                  className="rounded-lg border border-border p-3 hover:bg-muted/30 transition-colors group"
                >
                  <div className="flex items-start gap-2.5">
                    <div className="h-7 w-7 rounded-md bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                      <Icon className="h-3.5 w-3.5 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="text-sm font-medium leading-tight">
                          {s.title}
                        </p>
                        <Badge
                          variant="outline"
                          className={cn(
                            "text-[10px] px-1.5 h-4 shrink-0",
                            PRIORITY_COLORS[s.priority]
                          )}
                        >
                          {s.priority}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground leading-relaxed">
                        {s.description}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center mb-3">
              <Lightbulb className="h-6 w-6 text-muted-foreground" />
            </div>
            <p className="text-sm font-medium text-muted-foreground">
              No suggestions yet
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Add more contacts and data to get personalized insights.
            </p>
          </div>
        )}
      </div>
    </ScrollArea>
  );
}

// ─────────────────────────────────────────────
// CHAT TAB
// ─────────────────────────────────────────────

function ChatTab({
  accountId,
  pageContext,
}: {
  accountId: number;
  pageContext: string;
}) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  const chatMutation = trpc.aiAdvisor.chat.useMutation({
    onSuccess: (data) => {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: data.reply },
      ]);
    },
    onError: () => {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "Sorry, I encountered an error. Please try again.",
        },
      ]);
    },
  });

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, chatMutation.isPending]);

  const handleSend = () => {
    const trimmed = input.trim();
    if (!trimmed || chatMutation.isPending) return;

    const newMessages: ChatMessage[] = [
      ...messages,
      { role: "user", content: trimmed },
    ];
    setMessages(newMessages);
    setInput("");

    chatMutation.mutate({
      accountId,
      message: trimmed,
      history: messages,
      pageContext,
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Messages area */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center py-12">
            <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center mb-3">
              <Sparkles className="h-6 w-6 text-primary" />
            </div>
            <p className="text-sm font-medium">How can I help?</p>
            <p className="text-xs text-muted-foreground mt-1 max-w-[260px]">
              Ask me about your pipeline, contacts, follow-ups, or anything CRM-related.
            </p>
            <div className="mt-4 space-y-1.5 w-full max-w-[280px]">
              {[
                "Who should I follow up with today?",
                "Summarize my pipeline status",
                "Draft a follow-up email for my newest lead",
              ].map((q) => (
                <button
                  key={q}
                  onClick={() => {
                    setInput(q);
                  }}
                  className="w-full text-left text-xs px-3 py-2 rounded-lg border border-border hover:bg-muted/50 transition-colors flex items-center gap-2"
                >
                  <ArrowRight className="h-3 w-3 text-muted-foreground shrink-0" />
                  <span className="text-muted-foreground">{q}</span>
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((msg, i) => (
            <div
              key={i}
              className={cn(
                "flex gap-2",
                msg.role === "user" ? "justify-end" : "justify-start"
              )}
            >
              {msg.role === "assistant" && (
                <div className="h-6 w-6 rounded-md bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                  <Sparkles className="h-3 w-3 text-primary" />
                </div>
              )}
              <div
                className={cn(
                  "max-w-[85%] rounded-lg px-3 py-2 text-sm",
                  msg.role === "user"
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted"
                )}
              >
                {msg.role === "assistant" ? (
                  <div className="prose prose-sm max-w-none dark:prose-invert [&_p]:mb-1 [&_ul]:mt-1 [&_li]:text-sm">
                    <Streamdown>{msg.content}</Streamdown>
                  </div>
                ) : (
                  <p className="whitespace-pre-wrap">{msg.content}</p>
                )}
              </div>
              {msg.role === "user" && (
                <div className="h-6 w-6 rounded-md bg-muted flex items-center justify-center shrink-0 mt-0.5">
                  <Users className="h-3 w-3 text-muted-foreground" />
                </div>
              )}
            </div>
          ))
        )}

        {chatMutation.isPending && (
          <div className="flex gap-2 justify-start">
            <div className="h-6 w-6 rounded-md bg-primary/10 flex items-center justify-center shrink-0">
              <Sparkles className="h-3 w-3 text-primary" />
            </div>
            <div className="bg-muted rounded-lg px-3 py-2">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            </div>
          </div>
        )}
      </div>

      {/* Input area */}
      <div className="border-t border-border p-3">
        <div className="flex gap-2">
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask the AI Advisor..."
            className="min-h-[40px] max-h-[120px] resize-none text-sm"
            rows={1}
          />
          <Button
            size="icon"
            onClick={handleSend}
            disabled={!input.trim() || chatMutation.isPending}
            className="h-10 w-10 shrink-0"
          >
            {chatMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
