import { useState, useEffect, useRef, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  CheckCircle2,
  Circle,
  X,
  ChevronDown,
  ChevronUp,
  PartyPopper,
} from "lucide-react";
import { useLocation } from "wouter";
import { CHECKLIST_ITEMS, GOALS } from "@/pages/OnboardingV2";
import type { ChecklistItem } from "@/pages/OnboardingV2";

interface OnboardingChecklistProps {
  accountId: number;
}

export default function OnboardingChecklist({ accountId }: OnboardingChecklistProps) {
  const [, navigate] = useLocation();
  const [dismissed, setDismissed] = useState(false);
  const [expanded, setExpanded] = useState(true);
  const [showCongrats, setShowCongrats] = useState(false);
  const prevCompletedRef = useRef<number | null>(null);
  const halfwayNotifiedRef = useRef(false);

  // Check localStorage for dismiss state (fallback for legacy + fast check)
  useEffect(() => {
    const key = `onboarding-dismissed-${accountId}`;
    if (localStorage.getItem(key) === "true") {
      setDismissed(true);
    }
    const halfwayKey = `onboarding-halfway-${accountId}`;
    if (localStorage.getItem(halfwayKey) === "true") {
      halfwayNotifiedRef.current = true;
    }
  }, [accountId]);

  // V1 onboarding status (still used for real-time step tracking)
  const { data: status, isLoading } = trpc.accounts.getOnboardingStatus.useQuery(
    { accountId },
    { enabled: !dismissed && !showCongrats }
  );

  const completeOnboarding = trpc.accounts.completeOnboarding.useMutation();
  const sendProgressEmail = trpc.accounts.sendOnboardingProgressEmail.useMutation();
  const dismissChecklist = trpc.accounts.dismissOnboardingChecklist.useMutation();
  const logEvent = trpc.accounts.logOnboardingEvent.useMutation();

  // Build personalized checklist from V2 goals if available
  const personalizedItems = useMemo(() => {
    // Default to showing all items in priority order
    const sorted = [...CHECKLIST_ITEMS].sort((a, b) => {
      const order = { required: 0, recommended: 1, optional: 2 };
      return order[a.priority] - order[b.priority];
    });
    return sorted;
  }, []);

  // Map V1 step IDs to V2 checklist item IDs for completion tracking
  const v1ToV2Map: Record<string, string> = {
    phone_connected: "setup_phone",
    payment_method_added: "add_payment",
    first_contact: "import_contacts",
    first_campaign: "create_campaign",
    automation_created: "create_workflow",
    pipeline_configured: "setup_pipeline",
    calendar_setup: "setup_calendar",
    team_invited: "invite_team",
  };

  // Build completion map from V1 status
  const completionMap = useMemo(() => {
    const map: Record<string, boolean> = {};
    if (status?.steps) {
      for (const step of status.steps) {
        const v2Id = v1ToV2Map[step.id];
        if (v2Id) map[v2Id] = step.complete;
      }
    }
    return map;
  }, [status]);

  const completedCount = Object.values(completionMap).filter(Boolean).length;
  const totalTracked = Object.keys(v1ToV2Map).length;
  const progressPercent = totalTracked > 0 ? Math.round((completedCount / totalTracked) * 100) : 0;

  // Track progress milestones
  useEffect(() => {
    if (!status) return;

    const { completedCount: v1Completed, totalCount, allComplete } = status;
    const pct = Math.round((v1Completed / totalCount) * 100);

    // 50% milestone email
    if (pct >= 50 && !halfwayNotifiedRef.current) {
      halfwayNotifiedRef.current = true;
      localStorage.setItem(`onboarding-halfway-${accountId}`, "true");
      sendProgressEmail.mutate(
        { accountId, milestone: "halfway" },
        {
          onSuccess: () => {
            toast.success(
              `Halfway there! You've completed ${v1Completed} of ${totalCount} steps. Keep going!`
            );
          },
        }
      );
    }

    // 100% completion
    if (
      allComplete &&
      prevCompletedRef.current !== null &&
      prevCompletedRef.current < totalCount
    ) {
      setShowCongrats(true);
      completeOnboarding.mutate(
        { accountId },
        {
          onSuccess: () => {
            sendProgressEmail.mutate({ accountId, milestone: "complete" });
          },
        }
      );
      setTimeout(() => {
        localStorage.setItem(`onboarding-dismissed-${accountId}`, "true");
        setDismissed(true);
        setShowCongrats(false);
      }, 5000);
    }

    prevCompletedRef.current = v1Completed;
  }, [status, accountId]);

  if (dismissed && !showCongrats) return null;

  // Congratulations card
  if (showCongrats) {
    return (
      <Card className="bg-card border-0 card-shadow overflow-hidden">
        <div className="h-1 bg-gradient-to-r from-emerald-400 via-emerald-500 to-emerald-600" />
        <CardContent className="pt-6 pb-6 px-5">
          <div className="flex flex-col items-center text-center gap-3">
            <div className="h-14 w-14 rounded-full bg-emerald-100 dark:bg-emerald-500/20 flex items-center justify-center animate-bounce">
              <PartyPopper className="h-7 w-7 text-emerald-600 dark:text-emerald-400" />
            </div>
            <h3 className="text-lg font-semibold text-foreground">
              Congratulations!
            </h3>
            <p className="text-sm text-muted-foreground max-w-sm">
              You've completed all onboarding steps! Your account is fully set up
              and ready to go. Time to start closing deals.
            </p>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-xs text-muted-foreground">{totalTracked}/{totalTracked} complete</span>
              <div className="h-2 w-24 bg-emerald-100 dark:bg-emerald-500/20 rounded-full overflow-hidden">
                <div className="h-full w-full bg-emerald-500 rounded-full" />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (isLoading) return <OnboardingChecklistSkeleton />;
  if (!status) return null;

  const { allComplete } = status;
  if (allComplete) return null;

  const handleDismiss = () => {
    localStorage.setItem(`onboarding-dismissed-${accountId}`, "true");
    setDismissed(true);
    // Also persist server-side
    dismissChecklist.mutate({ accountId });
    logEvent.mutate({ accountId, step: "checklist", action: "dismissed" });
  };

  // Show only items that have V1 tracking (the 8 core steps)
  const trackedItems = personalizedItems.filter((item) => {
    const v1Key = Object.entries(v1ToV2Map).find(([, v2]) => v2 === item.id)?.[0];
    return !!v1Key;
  });

  return (
    <Card className="bg-card border-0 card-shadow overflow-hidden">
      {/* Gold accent bar at top */}
      <div className="h-1 bg-gradient-to-r from-amber-400 via-amber-500 to-amber-600" />

      <CardContent className="pt-5 pb-4 px-5">
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <h3 className="text-base font-semibold text-foreground">
                Getting Started
              </h3>
              <span className="text-xs font-medium text-muted-foreground bg-muted/50 px-2 py-0.5 rounded-full">
                {completedCount}/{totalTracked} complete
              </span>
            </div>
            <p className="text-sm text-muted-foreground">
              Complete these steps to get the most out of your account
            </p>
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-muted-foreground hover:text-foreground"
              onClick={() => setExpanded(!expanded)}
            >
              {expanded ? (
                <ChevronUp className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-muted-foreground hover:text-foreground"
              onClick={handleDismiss}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Progress bar */}
        <div className="mb-4">
          <div className="h-2 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-amber-400 to-amber-500 rounded-full transition-all duration-500 ease-out"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>

        {/* Checklist steps */}
        {expanded && (
          <div className="space-y-1">
            {trackedItems.map((item) => {
              const isComplete = completionMap[item.id] ?? false;
              const Icon = item.icon;

              return (
                <div
                  key={item.id}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${
                    isComplete
                      ? "bg-emerald-500/10 border border-emerald-500/20"
                      : "hover:bg-muted/50 border border-transparent"
                  }`}
                >
                  {/* Status icon */}
                  {isComplete ? (
                    <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0" />
                  ) : (
                    <Circle className="h-5 w-5 text-muted-foreground/40 shrink-0" />
                  )}

                  {/* Step icon */}
                  <div
                    className={`h-8 w-8 rounded-lg flex items-center justify-center shrink-0 ${
                      isComplete
                        ? "bg-emerald-500/15 text-emerald-500"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                  </div>

                  {/* Label + description */}
                  <div className="flex-1 min-w-0">
                    <p
                      className={`text-sm font-medium ${
                        isComplete
                          ? "line-through text-muted-foreground"
                          : "text-foreground"
                      }`}
                    >
                      {item.label}
                    </p>
                    <p className={`text-xs truncate ${
                      isComplete
                        ? "text-muted-foreground/70"
                        : "text-muted-foreground"
                    }`}>
                      {item.description}
                    </p>
                  </div>

                  {/* Priority badge for required items */}
                  {!isComplete && item.priority === "required" && (
                    <Badge variant="outline" className="text-xs border-amber-500/30 text-amber-500 shrink-0">
                      Required
                    </Badge>
                  )}

                  {/* Action button */}
                  {!isComplete && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs px-3 shrink-0 border-amber-500/30 text-amber-600 dark:text-amber-400 hover:bg-amber-500/10 hover:border-amber-500/40"
                      onClick={() => navigate(item.route)}
                    >
                      Set Up
                    </Button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function OnboardingChecklistSkeleton() {
  return (
    <Card className="bg-card border-0 card-shadow overflow-hidden">
      <div className="h-1 bg-gradient-to-r from-amber-400 via-amber-500 to-amber-600" />
      <CardContent className="pt-5 pb-4 px-5">
        <div className="flex items-start justify-between mb-4">
          <div>
            <Skeleton className="h-5 w-32 mb-2" />
            <Skeleton className="h-4 w-64" />
          </div>
        </div>
        <Skeleton className="h-2 w-full rounded-full mb-4" />
        <div className="space-y-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 px-3 py-2.5">
              <Skeleton className="h-5 w-5 rounded-full" />
              <Skeleton className="h-8 w-8 rounded-lg" />
              <div className="flex-1">
                <Skeleton className="h-4 w-40 mb-1" />
                <Skeleton className="h-3 w-56" />
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
