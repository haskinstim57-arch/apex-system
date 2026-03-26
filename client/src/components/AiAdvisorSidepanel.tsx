import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { useAccount } from "@/contexts/AccountContext";
import { useAiAdvisor } from "@/contexts/AiAdvisorContext";
import { AIChatBox, type Message } from "@/components/AIChatBox";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";
import {
  Sparkles,
  X,
  MessageSquare,
  Lightbulb,
  ChevronRight,
  Zap,
  AlertTriangle,
  TrendingUp,
  ArrowRight,
  Loader2,
  RefreshCw,
} from "lucide-react";
import { useLocation } from "wouter";

// ─── Types ───

type Suggestion = {
  id: string;
  title: string;
  explanation: string;
  impact: string;
  actionType: string;
  actionParams: Record<string, unknown>;
  confirmationMessage: string;
};

// ─── Suggestion Card ───

function SuggestionCard({
  suggestion,
  onExecute,
}: {
  suggestion: Suggestion;
  onExecute: (suggestion: Suggestion) => void;
}) {
  const impactColors: Record<string, string> = {
    high: "bg-red-50 text-red-700 border-red-200",
    medium: "bg-amber-50 text-amber-700 border-amber-200",
    low: "bg-emerald-50 text-emerald-700 border-emerald-200",
  };

  const impactIcons: Record<string, typeof Zap> = {
    high: AlertTriangle,
    medium: TrendingUp,
    low: Sparkles,
  };

  const ImpactIcon = impactIcons[suggestion.impact] || Sparkles;
  const isActionable = suggestion.actionType !== "info_only";

  return (
    <Card className="bg-white border border-border/50 shadow-sm hover:shadow-md transition-shadow">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-start gap-2 flex-1 min-w-0">
            <ImpactIcon className="h-4 w-4 mt-0.5 shrink-0 text-muted-foreground" />
            <h4 className="text-sm font-medium text-foreground leading-tight">
              {suggestion.title}
            </h4>
          </div>
          <Badge
            className={cn(
              "text-[10px] h-5 rounded-full px-2 font-medium shrink-0 border",
              impactColors[suggestion.impact] || impactColors.low
            )}
          >
            {suggestion.impact}
          </Badge>
        </div>

        <p className="text-xs text-muted-foreground leading-relaxed">
          {suggestion.explanation}
        </p>

        {isActionable && (
          <Button
            size="sm"
            variant={suggestion.actionType === "navigate" ? "outline" : "default"}
            className="w-full h-8 text-xs gap-1.5"
            onClick={() => onExecute(suggestion)}
          >
            {suggestion.actionType === "navigate" ? (
              <>
                Go to page
                <ArrowRight className="h-3 w-3" />
              </>
            ) : (
              <>
                <Zap className="h-3 w-3" />
                Execute
              </>
            )}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Main AI Advisor Sidepanel ───

export function AiAdvisorSidepanel() {
  const { isOpen, setIsOpen, toggle, pageContext, mode, setMode } = useAiAdvisor();
  const { currentAccountId } = useAccount();
  const [, navigate] = useLocation();

  // Chat state
  const [chatMessages, setChatMessages] = useState<Message[]>([
    {
      role: "system",
      content: "You are the AI Advisor for Apex System CRM. Help the user understand their data and take action.",
    },
  ]);

  // Confirmation dialog
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    suggestion: {
      id: string;
      title: string;
      confirmationMessage: string;
      actionType: string;
      actionParams: Record<string, unknown>;
    } | null;
  }>({ open: false, suggestion: null });

  // Suggestions query
  const {
    data: suggestionsData,
    isLoading: suggestionsLoading,
    refetch: refetchSuggestions,
  } = trpc.aiAdvisor.getSuggestions.useQuery(
    { accountId: currentAccountId!, pageContext },
    { enabled: !!currentAccountId && isOpen && mode === "suggestions", staleTime: 60_000 }
  );

  // Chat mutation
  const chatMutation = trpc.aiAdvisor.chat.useMutation({
    onSuccess: (data) => {
      setChatMessages((prev) => [
        ...prev,
        { role: "assistant", content: data.response },
      ]);
    },
  });

  // Reset chat when switching accounts
  useEffect(() => {
    setChatMessages([
      {
        role: "system",
        content: "You are the AI Advisor for Apex System CRM. Help the user understand their data and take action.",
      },
    ]);
  }, [currentAccountId]);

  const handleSendMessage = (content: string) => {
    if (!currentAccountId) return;
    const newMessages: Message[] = [
      ...chatMessages,
      { role: "user", content },
    ];
    setChatMessages(newMessages);
    chatMutation.mutate({
      accountId: currentAccountId,
      messages: newMessages.filter((m) => m.role !== "system"),
      pageContext,
    });
  };

  const handleExecuteSuggestion = (suggestion: {
    id: string;
    title: string;
    confirmationMessage: string;
    actionType: string;
    actionParams: Record<string, unknown>;
  }) => {
    if (suggestion.actionType === "navigate") {
      const path = suggestion.actionParams.path as string;
      if (path) navigate(path);
      return;
    }

    if (suggestion.confirmationMessage) {
      setConfirmDialog({ open: true, suggestion });
    } else {
      executeAction(suggestion);
    }
  };

  const executeAction = (suggestion: {
    actionType: string;
    actionParams: Record<string, unknown>;
  }) => {
    // Navigate to the relevant page with action context
    // The actual execution would call the appropriate tRPC mutation
    switch (suggestion.actionType) {
      case "launch_campaign":
        navigate("/campaigns");
        break;
      case "start_ai_calls":
        navigate("/ai-calls");
        break;
      case "create_workflow":
        navigate("/automations");
        break;
      case "assign_contacts":
        navigate("/contacts");
        break;
      case "move_pipeline_stage":
        navigate("/pipeline");
        break;
      case "schedule_appointments":
        navigate("/calendar");
        break;
      default:
        break;
    }
    setConfirmDialog({ open: false, suggestion: null });
  };

  if (!currentAccountId) return null;

  return (
    <>
      {/* Floating toggle button */}
      {!isOpen && (
        <button
          onClick={toggle}
          className="fixed bottom-6 right-6 z-50 flex items-center gap-2 bg-primary text-primary-foreground shadow-lg rounded-full pl-4 pr-5 py-3 hover:shadow-xl transition-all hover:scale-105 active:scale-95"
        >
          <Sparkles className="h-5 w-5" />
          <span className="text-sm font-medium">AI Advisor</span>
        </button>
      )}

      {/* Sidepanel */}
      <div
        className={cn(
          "fixed top-0 right-0 z-50 h-full w-[380px] bg-background border-l shadow-2xl transition-transform duration-300 ease-in-out flex flex-col",
          isOpen ? "translate-x-0" : "translate-x-full"
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b bg-card">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <Sparkles className="h-4 w-4 text-primary" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-foreground">AI Advisor</h3>
              <p className="text-[10px] text-muted-foreground">
                {suggestionsData?.context
                  ? `${suggestionsData.context.totalContacts} contacts | ${suggestionsData.context.connectRate}% connect rate`
                  : "Analyzing your account..."}
              </p>
            </div>
          </div>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setIsOpen(false)}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Mode tabs */}
        <div className="flex border-b px-2 bg-card">
          <button
            onClick={() => setMode("suggestions")}
            className={cn(
              "flex items-center gap-1.5 px-3 py-2.5 text-xs font-medium border-b-2 transition-colors",
              mode === "suggestions"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            <Lightbulb className="h-3.5 w-3.5" />
            Suggestions
          </button>
          <button
            onClick={() => setMode("chat")}
            className={cn(
              "flex items-center gap-1.5 px-3 py-2.5 text-xs font-medium border-b-2 transition-colors",
              mode === "chat"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            <MessageSquare className="h-3.5 w-3.5" />
            Chat
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden">
          {mode === "suggestions" ? (
            <div className="h-full flex flex-col">
              {/* Refresh button */}
              <div className="flex items-center justify-between px-4 py-2 border-b bg-muted/30">
                <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">
                  {pageContext.charAt(0).toUpperCase() + pageContext.slice(1)} Insights
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 px-2 text-[10px] gap-1"
                  onClick={() => refetchSuggestions()}
                  disabled={suggestionsLoading}
                >
                  <RefreshCw className={cn("h-3 w-3", suggestionsLoading && "animate-spin")} />
                  Refresh
                </Button>
              </div>

              <ScrollArea className="flex-1">
                <div className="p-4 space-y-3">
                  {suggestionsLoading ? (
                    <>
                      {[1, 2, 3].map((i) => (
                        <Card key={i} className="bg-white border border-border/50">
                          <CardContent className="p-4 space-y-3">
                            <div className="flex items-center gap-2">
                              <div className="h-4 w-4 rounded bg-muted animate-pulse" />
                              <div className="h-4 flex-1 rounded bg-muted animate-pulse" />
                            </div>
                            <div className="h-8 rounded bg-muted animate-pulse" />
                            <div className="h-8 rounded bg-muted animate-pulse" />
                          </CardContent>
                        </Card>
                      ))}
                    </>
                  ) : suggestionsData?.suggestions?.length ? (
                    suggestionsData.suggestions.map((suggestion: any) => (
                      <SuggestionCard
                        key={suggestion.id}
                        suggestion={suggestion}
                        onExecute={handleExecuteSuggestion}
                      />
                    ))
                  ) : (
                    <div className="text-center py-12">
                      <Sparkles className="h-8 w-8 mx-auto text-muted-foreground/30 mb-3" />
                      <p className="text-sm text-muted-foreground">No suggestions right now</p>
                      <p className="text-xs text-muted-foreground mt-1">Your account looks great!</p>
                    </div>
                  )}
                </div>
              </ScrollArea>
            </div>
          ) : (
            <AIChatBox
              messages={chatMessages}
              onSendMessage={handleSendMessage}
              isLoading={chatMutation.isPending}
              placeholder="Ask about your account..."
              height="100%"
              emptyStateMessage="Ask me anything about your CRM data"
              suggestedPrompts={[
                "How can I improve my connect rate?",
                "Which leads should I prioritize?",
                "Summarize my performance this week",
              ]}
            />
          )}
        </div>
      </div>

      {/* Backdrop overlay when open */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/20 backdrop-blur-sm"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Confirmation Dialog */}
      <AlertDialog
        open={confirmDialog.open}
        onOpenChange={(open) => {
          if (!open) setConfirmDialog({ open: false, suggestion: null });
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Zap className="h-5 w-5 text-primary" />
              Confirm Action
            </AlertDialogTitle>
            <AlertDialogDescription className="text-sm leading-relaxed">
              {confirmDialog.suggestion?.confirmationMessage}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (confirmDialog.suggestion) {
                  executeAction(confirmDialog.suggestion);
                }
              }}
            >
              Confirm & Execute
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
