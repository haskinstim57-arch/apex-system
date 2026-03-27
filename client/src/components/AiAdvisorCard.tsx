import { trpc } from "@/lib/trpc";
import { useAccount } from "@/contexts/AccountContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { RefreshCw, AlertTriangle, TrendingUp, Sparkles } from "lucide-react";
import { useLocation } from "wouter";

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

  const handleAction = (suggestion: { actionType: string; actionParams: Record<string, unknown> }) => {
    const pathMap: Record<string, string> = {
      navigate: suggestion.actionParams.path as string,
      launch_campaign: "/campaigns",
      start_ai_calls: "/ai-calls",
      create_workflow: "/automations",
      assign_contacts: "/contacts",
      move_pipeline_stage: "/pipeline",
      schedule_appointments: "/calendar",
    };
    navigate(pathMap[suggestion.actionType] || "/");
  };

  if (!currentAccountId) return null;

  return (
    <Card className={cn("border border-border/60 shadow-lg max-h-[calc(100vh-6rem)] flex flex-col overflow-hidden", className)}>
      <CardContent className="p-4 flex flex-col min-h-0 overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-3 shrink-0">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2 w-2 shrink-0">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-60" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-primary" />
            </span>
            <span className="text-[13px] font-bold text-foreground">{title}</span>
          </div>
          <button
            onClick={() => refetch()}
            disabled={isFetching}
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            <RefreshCw className={cn("h-3.5 w-3.5", isFetching && "animate-spin")} />
          </button>
        </div>

        {/* Bullet list */}
        <div className="space-y-3">
          {isLoading ? (
            <>
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex gap-2.5">
                  <div className="h-2 w-2 rounded-full bg-muted animate-pulse mt-1.5 shrink-0" />
                  <div className="flex-1 space-y-1.5">
                    <div className="h-3 bg-muted rounded animate-pulse w-4/5" />
                    <div className="h-3 bg-muted rounded animate-pulse w-full" />
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
                <div key={s.id} className="flex gap-2.5 group">
                  {/* Colored dot */}
                  <div
                    className={cn(
                      "h-2 w-2 rounded-full shrink-0 mt-1.5",
                      impactDot[s.impact] || "bg-gray-400"
                    )}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start gap-1">
                      <Icon className="h-3 w-3 text-muted-foreground shrink-0 mt-0.5" />
                      <p className="text-[12px] font-semibold text-foreground leading-snug">
                        {s.title}
                      </p>
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">
                      {s.explanation}
                    </p>
                    {isActionable && (
                      <button
                        onClick={() => handleAction(s)}
                        className="mt-1 text-[11px] font-semibold text-primary hover:underline"
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
          <div className="mt-3 pt-3 border-t border-border/50 grid grid-cols-2 gap-x-3 gap-y-1 shrink-0">
            <div>
              <p className="text-[9px] uppercase tracking-wider text-muted-foreground font-semibold">Contacts</p>
              <p className="text-[12px] font-bold">{data.context.totalContacts}</p>
            </div>
            <div>
              <p className="text-[9px] uppercase tracking-wider text-muted-foreground font-semibold">Uncontacted</p>
              <p className="text-[12px] font-bold">{data.context.uncontacted}</p>
            </div>
            <div>
              <p className="text-[9px] uppercase tracking-wider text-muted-foreground font-semibold">Unread</p>
              <p className="text-[12px] font-bold">{data.context.unreadMessages}</p>
            </div>
            <div>
              <p className="text-[9px] uppercase tracking-wider text-muted-foreground font-semibold">Connect rate</p>
              <p className="text-[12px] font-bold">{data.context.connectRate}%</p>
            </div>
          </div>
        )}

        {/* Refresh button */}
        <Button
          variant="outline"
          size="sm"
          className="w-full h-7 text-[11px] gap-1.5 mt-3 shrink-0"
          onClick={() => refetch()}
          disabled={isFetching}
        >
          <RefreshCw className={cn("h-3 w-3", isFetching && "animate-spin")} />
          {isFetching ? "Refreshing..." : "Refresh Insights"}
        </Button>
      </CardContent>
    </Card>
  );
}
