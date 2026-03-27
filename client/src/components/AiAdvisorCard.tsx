import { trpc } from "@/lib/trpc";
import { useAccount } from "@/contexts/AccountContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { RefreshCw, AlertTriangle, TrendingUp, Sparkles } from "lucide-react";
import { useLocation } from "wouter";
import { toast } from "sonner";

const actionLabels: Record<string, string> = {
  launch_campaign: "Opening Campaigns...",
  start_ai_calls: "Opening AI Calls...",
  create_workflow: "Opening Automations...",
  assign_contacts: "Opening Contacts...",
  move_pipeline_stage: "Opening Pipeline...",
  schedule_appointments: "Opening Calendar...",
  navigate: "Navigating...",
};

// ─── Impact styling ───
const impactDot: Record<string, string> = {
  high: "bg-red-500",
  medium: "bg-amber-400",
  low: "bg-emerald-500",
};

const impactIcon: Record<string, typeof Sparkles> = {
  high: AlertTriangle,
  medium: TrendingUp,
  low: Sparkles,
};

type Props = {
  pageContext: string;
  className?: string;
  title?: string;
};

export function AiAdvisorCard({ pageContext, className, title = "AI Advisor" }: Props) {
  const { currentAccountId } = useAccount();
  const [, navigate] = useLocation();

  const { data, isLoading, refetch, isFetching } = trpc.aiAdvisor.getSuggestions.useQuery(
    { accountId: currentAccountId!, pageContext },
    { enabled: !!currentAccountId, staleTime: 60_000 }
  );

  const suggestions = data?.suggestions ?? [];

  const handleAction = (suggestion: { actionType: string; actionParams: Record<string, unknown>; title?: string }) => {
    const pathMap: Record<string, string> = {
      navigate: suggestion.actionParams.path as string,
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

    navigate(pathMap[suggestion.actionType] || "/");
  };

  if (!currentAccountId) return null;

  return (
    <Card className={cn("border border-border/60 shadow-sm", className)}>
      <CardContent className="p-3 flex flex-col min-h-0">
        {/* Header */}
        <div className="flex items-center justify-between mb-2.5 shrink-0">
          <div className="flex items-center gap-1.5">
            <span className="relative flex h-2 w-2 shrink-0">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-60" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-primary" />
            </span>
            <span className="text-[12px] font-bold text-foreground">{title}</span>
          </div>
          <button
            onClick={() => refetch()}
            disabled={isFetching}
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            <RefreshCw className={cn("h-3 w-3", isFetching && "animate-spin")} />
          </button>
        </div>

        {/* Bullet list */}
        <div className="space-y-2.5">
          {isLoading ? (
            <>
              <div className="flex items-center gap-1.5 mb-1">
                <Sparkles className="h-3 w-3 text-primary animate-pulse" />
                <span className="text-[10px] text-muted-foreground animate-pulse">Analyzing...</span>
              </div>
              {[1, 2, 3].map((i) => (
                <div key={i} className="rounded-md border border-border/40 bg-muted/20 p-2 space-y-1.5" style={{ animationDelay: `${i * 120}ms` }}>
                  <div className="flex gap-2">
                    <div className="h-1.5 w-1.5 rounded-full bg-muted animate-pulse mt-1 shrink-0" />
                    <div className="flex-1 space-y-1">
                      <div className="h-3 bg-muted rounded animate-pulse" style={{ width: `${80 - i * 10}%` }} />
                      <div className="h-2.5 bg-muted rounded animate-pulse w-full" />
                    </div>
                  </div>
                </div>
              ))}
            </>
          ) : suggestions.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-2">
              All looking good — no actions needed.
            </p>
          ) : (
            suggestions.slice(0, 4).map((s: any) => {
              const Icon = impactIcon[s.impact] || Sparkles;
              const isActionable = s.actionType !== "info_only";
              return (
                <div key={s.id} className="flex gap-2 group">
                  {/* Colored dot */}
                  <div
                    className={cn(
                      "h-1.5 w-1.5 rounded-full shrink-0 mt-1",
                      impactDot[s.impact] || "bg-gray-400"
                    )}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] font-semibold text-foreground leading-snug">
                      {s.title}
                    </p>
                    <p className="text-[10px] text-muted-foreground mt-0.5 leading-relaxed">
                      {s.explanation}
                    </p>
                    {isActionable && (
                      <button
                        onClick={() => handleAction(s)}
                        className="mt-0.5 text-[10px] font-semibold text-primary hover:underline"
                      >
                        {s.actionType === "navigate" ? "Go to page →" : "Execute →"}
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer stats */}
        {data?.context && !isLoading && (
          <div className="mt-2 pt-2 border-t border-border/50 grid grid-cols-2 gap-x-2 gap-y-1 shrink-0">
            <div>
              <p className="text-[8px] uppercase tracking-wider text-muted-foreground font-semibold">Contacts</p>
              <p className="text-[11px] font-bold">{data.context.totalContacts}</p>
            </div>
            <div>
              <p className="text-[8px] uppercase tracking-wider text-muted-foreground font-semibold">Uncontacted</p>
              <p className="text-[11px] font-bold">{data.context.uncontacted}</p>
            </div>
            <div>
              <p className="text-[8px] uppercase tracking-wider text-muted-foreground font-semibold">Unread</p>
              <p className="text-[11px] font-bold">{data.context.unreadMessages}</p>
            </div>
            <div>
              <p className="text-[8px] uppercase tracking-wider text-muted-foreground font-semibold">Connect rate</p>
              <p className="text-[11px] font-bold">{data.context.connectRate}%</p>
            </div>
          </div>
        )}

        {/* Refresh button */}
        <Button
          variant="outline"
          size="sm"
          className="w-full h-6 text-[10px] gap-1 mt-2 shrink-0"
          onClick={() => refetch()}
          disabled={isFetching}
        >
          <RefreshCw className={cn("h-2.5 w-2.5", isFetching && "animate-spin")} />
          {isFetching ? "Refreshing..." : "Generate New Suggestions"}
        </Button>
      </CardContent>
    </Card>
  );
}
