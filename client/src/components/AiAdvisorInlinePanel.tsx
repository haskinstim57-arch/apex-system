import { trpc } from "@/lib/trpc";
import { useAccount } from "@/contexts/AccountContext";
import { useAiAdvisor } from "@/contexts/AiAdvisorContext";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import {
  Sparkles,
  RefreshCw,
  AlertTriangle,
  TrendingUp,
  ArrowRight,
  Zap,
  MessageSquare,
} from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { AIChatBox, type Message } from "@/components/AIChatBox";
import { toast } from "sonner";

// ─── Impact dot colors ───
const impactDot: Record<string, string> = {
  high: "bg-red-500",
  medium: "bg-amber-400",
  low: "bg-emerald-500",
};

const impactIcon: Record<string, typeof Zap> = {
  high: AlertTriangle,
  medium: TrendingUp,
  low: Sparkles,
};

// ─── Page-specific suggested chat prompts ───
// These change based on the current page so the user gets relevant quick-start questions.
const pageSuggestedPrompts: Record<string, string[]> = {
  dashboard: [
    "What's the most important thing I should do today?",
    "How is my account performing this week?",
    "What's my biggest growth opportunity right now?",
  ],
  contacts: [
    "Which contacts should I prioritize for outreach?",
    "How many leads have never been contacted?",
    "What's the best way to segment my contact list?",
  ],
  inbox: [
    "Which conversations need my attention most?",
    "How can I improve my response time?",
    "Should I set up an auto-reply workflow?",
  ],
  messages: [
    "Which conversations need my attention most?",
    "How can I improve my response time?",
    "Should I set up an auto-reply workflow?",
  ],
  "ai-calls": [
    "Why is my connect rate low and how do I fix it?",
    "What's the best time to run AI calls?",
    "How should I follow up on no-answer calls?",
  ],
  "power-dialer": [
    "Which contacts should I dial first?",
    "What's the best time to run a dialing session?",
    "How can I improve my connect rate today?",
  ],
  "dialer-analytics": [
    "What does my connect rate tell me?",
    "How do I improve my call performance metrics?",
    "What's a good benchmark for connect rate?",
  ],
  campaigns: [
    "What campaign should I run next?",
    "Which contacts haven't received any campaign yet?",
    "Should I use SMS or email for my next outreach?",
  ],
  automations: [
    "What automations am I missing?",
    "Why are my workflows failing?",
    "What's the most impactful workflow I could build?",
  ],
  pipeline: [
    "Which deals are most at risk of going cold?",
    "How do I move more deals to the next stage?",
    "What's my total pipeline value?",
  ],
  calendar: [
    "How do I fill my calendar faster?",
    "What's the best way to reduce appointment no-shows?",
    "How many appointments should I be booking per week?",
  ],
  analytics: [
    "What's my most important KPI to improve?",
    "How is my performance trending this month?",
    "What actions would move the needle most?",
  ],
  settings: [
    "What settings should I configure first?",
    "How do I set up missed-call text-back?",
    "What integrations would help my workflow?",
  ],
};

const defaultSuggestedPrompts = [
  "What should I focus on today?",
  "How's my pipeline looking?",
  "What's my best performing campaign?",
];

function getPageSuggestedPrompts(pageContext: string): string[] {
  if (pageSuggestedPrompts[pageContext]) {
    return pageSuggestedPrompts[pageContext];
  }
  // Handle sub-paths
  const base = pageContext.split("/")[0];
  return pageSuggestedPrompts[base] || defaultSuggestedPrompts;
}

// ─── Single insight row ───
function InsightRow({
  suggestion,
  onAction,
}: {
  suggestion: {
    id: string;
    title: string;
    explanation: string;
    impact: string;
    actionType: string;
    actionParams: Record<string, unknown>;
    confirmationMessage: string;
  };
  onAction: (s: typeof suggestion) => void;
}) {
  const Icon = impactIcon[suggestion.impact] || Sparkles;
  const isActionable = suggestion.actionType !== "info_only";
  const isNavigate = suggestion.actionType === "navigate";

  return (
    <div className="flex gap-3 group">
      {/* Colored dot indicator */}
      <div className="flex flex-col items-center pt-1 shrink-0">
        <div
          className={cn(
            "h-2 w-2 rounded-full shrink-0",
            impactDot[suggestion.impact] || "bg-gray-400"
          )}
        />
        <div className="w-px flex-1 bg-border mt-2 group-last:hidden" />
      </div>

      {/* Content */}
      <div className="pb-4 flex-1 min-w-0">
        <div className="flex items-start gap-1.5">
          <Icon className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-0.5" />
          <p className="text-[13px] font-semibold text-foreground leading-tight">
            {suggestion.title}
          </p>
        </div>
        <p className="text-[12px] text-muted-foreground mt-1 leading-relaxed">
          {suggestion.explanation}
        </p>
        {isActionable && (
          <button
            onClick={() => onAction(suggestion)}
            className="mt-2 flex items-center gap-1 text-[12px] font-medium text-primary hover:underline"
          >
            {isNavigate ? "Go to page" : "Execute"}
            <ArrowRight className="h-3 w-3" />
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Main Inline Panel ───
// ─── Action labels for toast messages ───
const actionLabels: Record<string, string> = {
  launch_campaign: "Opening Campaigns...",
  start_ai_calls: "Opening AI Calls...",
  create_workflow: "Opening Automations...",
  assign_contacts: "Opening Contacts...",
  move_pipeline_stage: "Opening Pipeline...",
  schedule_appointments: "Opening Calendar...",
  navigate: "Navigating...",
};

export function AiAdvisorInlinePanel() {
  const { currentAccountId } = useAccount();
  const { pageContext } = useAiAdvisor();
  const [, navigate] = useLocation();
  const [mode, setMode] = useState<"insights" | "chat">("insights");
  const historyLoaded = useRef(false);
  const [chatMessages, setChatMessages] = useState<Message[]>([
    {
      role: "system",
      content:
        "You are the AI Advisor for Apex System CRM. Help the user understand their data and take action.",
    },
  ]);

  // Load persisted chat history on mount
  const { data: chatHistory, isLoading: historyLoading } = trpc.aiAdvisor.getChatHistory.useQuery(
    { accountId: currentAccountId!, limit: 50 },
    { enabled: !!currentAccountId }
  );

  useEffect(() => {
    if (chatHistory && chatHistory.length > 0 && !historyLoaded.current) {
      historyLoaded.current = true;
      const restored: Message[] = [
        {
          role: "system",
          content:
            "You are the AI Advisor for Apex System CRM. Help the user understand their data and take action.",
        },
        ...chatHistory.map((m) => ({
          role: m.role as "user" | "assistant",
          content: m.content,
        })),
      ];
      setChatMessages(restored);
    }
  }, [chatHistory]);

  const clearHistory = trpc.aiAdvisor.clearChatHistory.useMutation({
    onSuccess: () => {
      historyLoaded.current = false;
      setChatMessages([
        {
          role: "system",
          content:
            "You are the AI Advisor for Apex System CRM. Help the user understand their data and take action.",
        },
      ]);
      toast.success("Chat history cleared");
    },
  });

  const {
    data,
    isLoading,
    refetch,
    isFetching,
  } = trpc.aiAdvisor.getSuggestions.useQuery(
    { accountId: currentAccountId!, pageContext },
    {
      enabled: !!currentAccountId && mode === "insights",
      staleTime: 60_000,
    }
  );

  const chatMutation = trpc.aiAdvisor.chat.useMutation({
    onSuccess: (res) => {
      setChatMessages((prev) => [
        ...prev,
        { role: "assistant", content: res.response },
      ]);
    },
  });

  const handleSendMessage = (content: string) => {
    if (!currentAccountId) return;
    const updated: Message[] = [...chatMessages, { role: "user", content }];
    setChatMessages(updated);
    chatMutation.mutate({
      accountId: currentAccountId,
      messages: updated.filter((m) => m.role !== "system"),
      pageContext,
    });
  };

  const handleAction = (suggestion: {
    actionType: string;
    actionParams: Record<string, unknown>;
    title?: string;
  }) => {
    const pathMap: Record<string, string> = {
      launch_campaign: "/campaigns",
      start_ai_calls: "/ai-calls",
      create_workflow: "/automations",
      assign_contacts: "/contacts",
      move_pipeline_stage: "/pipeline",
      schedule_appointments: "/calendar",
    };

    // Show toast confirmation
    const toastLabel = actionLabels[suggestion.actionType] || "Executing action...";
    toast.success(toastLabel, {
      description: suggestion.title || "AI Advisor suggestion executed",
      duration: 3000,
    });

    if (suggestion.actionType === "navigate") {
      navigate(suggestion.actionParams.path as string);
    } else {
      navigate(pathMap[suggestion.actionType] || "/");
    }
  };

  const pageLabel =
    pageContext.charAt(0).toUpperCase() + pageContext.slice(1).replace(/-/g, " ");

  const suggestions = data?.suggestions ?? [];
  const suggestedPrompts = getPageSuggestedPrompts(pageContext);

  return (
    <div className="h-full flex flex-col bg-card border-l">
      {/* ── Header ── */}
      <div className="px-4 py-3 border-b shrink-0">
        <div className="flex items-center gap-2 mb-3">
          {/* Pulsing live dot */}
          <span className="relative flex h-2.5 w-2.5 shrink-0">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-60" />
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-primary" />
          </span>
          <span className="text-[13px] font-bold text-foreground tracking-tight">
            AI Advisor
          </span>
          <span className="ml-auto text-[10px] font-medium uppercase tracking-wider text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
            {pageLabel}
          </span>
        </div>

        {/* Mode tabs */}
        <div className="flex gap-1 bg-muted rounded-lg p-0.5">
          <button
            onClick={() => setMode("insights")}
            className={cn(
              "flex-1 flex items-center justify-center gap-1.5 text-[11px] font-medium py-1.5 rounded-md transition-all",
              mode === "insights"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Sparkles className="h-3 w-3" />
            Insights
          </button>
          <button
            onClick={() => setMode("chat")}
            className={cn(
              "flex-1 flex items-center justify-center gap-1.5 text-[11px] font-medium py-1.5 rounded-md transition-all",
              mode === "chat"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <MessageSquare className="h-3 w-3" />
            Chat
          </button>
        </div>
      </div>

      {/* ── Content ── */}
      {mode === "insights" ? (
        <>
          <ScrollArea className="flex-1">
            <div className="px-4 pt-4">
              {isLoading ? (
                /* Enhanced loading skeleton with shimmer */
                <div className="space-y-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Sparkles className="h-4 w-4 text-primary animate-pulse" />
                    <span className="text-xs text-muted-foreground animate-pulse">Analyzing your account data...</span>
                  </div>
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="rounded-lg border bg-muted/30 p-3 space-y-2.5" style={{ animationDelay: `${i * 150}ms` }}>
                      <div className="flex items-start gap-2.5">
                        <div className="h-2 w-2 rounded-full bg-muted animate-pulse mt-1.5 shrink-0" />
                        <div className="flex-1 space-y-2">
                          <div className="h-3.5 bg-muted rounded animate-pulse" style={{ width: `${75 - i * 10}%` }} />
                          <div className="h-3 bg-muted rounded animate-pulse w-full" />
                          <div className="h-3 bg-muted rounded animate-pulse" style={{ width: `${60 + i * 5}%` }} />
                        </div>
                      </div>
                      <div className="flex justify-end">
                        <div className="h-6 w-20 bg-muted rounded animate-pulse" />
                      </div>
                    </div>
                  ))}
                  <div className="border-t pt-3 mt-3">
                    <div className="grid grid-cols-2 gap-2">
                      {[1, 2, 3, 4].map((i) => (
                        <div key={i} className="space-y-1">
                          <div className="h-2 bg-muted rounded animate-pulse w-16" />
                          <div className="h-3.5 bg-muted rounded animate-pulse w-10" />
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ) : suggestions.length > 0 ? (
                <div>
                  {suggestions.map((s: any) => (
                    <InsightRow
                      key={s.id}
                      suggestion={s}
                      onAction={handleAction}
                    />
                  ))}
                </div>
              ) : (
                <div className="text-center py-10">
                  <Sparkles className="h-8 w-8 mx-auto text-muted-foreground/20 mb-3" />
                  <p className="text-sm text-muted-foreground">
                    No insights available
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Your account looks great!
                  </p>
                </div>
              )}
            </div>
          </ScrollArea>

          {/* ── Stats strip ── */}
          {data?.context && (
            <div className="border-t px-4 py-2.5 grid grid-cols-2 gap-x-3 gap-y-1.5 shrink-0">
              {[
                { label: "Contacts", value: data.context.totalContacts },
                { label: "Uncontacted", value: data.context.uncontacted },
                { label: "Unread msgs", value: data.context.unreadMessages },
                { label: "Connect rate", value: `${data.context.connectRate}%` },
              ].map((stat) => (
                <div key={stat.label}>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider">
                    {stat.label}
                  </p>
                  <p className="text-[13px] font-bold text-foreground">
                    {stat.value}
                  </p>
                </div>
              ))}
            </div>
          )}

          {/* ── Refresh button ── */}
          <div className="px-4 pb-4 pt-2 shrink-0">
            <Button
              variant="outline"
              size="sm"
              className="w-full h-8 text-[12px] gap-1.5"
              onClick={() => refetch()}
              disabled={isFetching}
            >
              <RefreshCw
                className={cn("h-3 w-3", isFetching && "animate-spin")}
              />
              {isFetching ? "Refreshing..." : "Refresh Insights"}
            </Button>
          </div>
        </>
      ) : (
        /* Chat mode — suggested prompts are page-specific */
        <div className="flex flex-col flex-1 min-h-0">
          {chatMessages.length > 1 && (
            <div className="px-3 py-1.5 border-b flex justify-end shrink-0">
              <button
                onClick={() => currentAccountId && clearHistory.mutate({ accountId: currentAccountId })}
                className="text-[10px] text-muted-foreground hover:text-destructive transition-colors"
                disabled={clearHistory.isPending}
              >
                {clearHistory.isPending ? "Clearing..." : "Clear history"}
              </button>
            </div>
          )}
          <div className="flex-1 min-h-0">
            {historyLoading ? (
              <div className="flex items-center justify-center h-full">
                <div className="text-center space-y-2">
                  <MessageSquare className="h-6 w-6 mx-auto text-muted-foreground/30 animate-pulse" />
                  <p className="text-xs text-muted-foreground">Loading chat history...</p>
                </div>
              </div>
            ) : (
              <AIChatBox
                messages={chatMessages}
                onSendMessage={handleSendMessage}
                isLoading={chatMutation.isPending}
                placeholder={`Ask about ${pageLabel.toLowerCase()}...`}
                height="100%"
                emptyStateMessage={`Ask me anything about your ${pageLabel.toLowerCase()}`}
                suggestedPrompts={suggestedPrompts}
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}
