import { useState, useEffect, useRef } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import {
  Phone,
  UserPlus,
  Megaphone,
  Zap,
  GitBranch,
  Calendar,
  Users,
  CheckCircle2,
  Circle,
  X,
  ChevronDown,
  ChevronUp,
  PartyPopper,
  CreditCard,
} from "lucide-react";
import { useLocation } from "wouter";

interface OnboardingChecklistProps {
  accountId: number;
}

/** Map step IDs to icons and navigation links */
const STEP_CONFIG: Record<
  string,
  { icon: React.ComponentType<{ className?: string }>; link: string; description: string }
> = {
  phone_connected: {
    icon: Phone,
    link: "/settings#phone",
    description: "Set up a phone number for SMS and AI calls",
  },
  payment_method_added: {
    icon: CreditCard,
    link: "/billing",
    description: "Add a payment method to enable messaging and AI calls",
  },
  first_contact: {
    icon: UserPlus,
    link: "/contacts",
    description: "Import or create your first lead",
  },
  first_campaign: {
    icon: Megaphone,
    link: "/campaigns",
    description: "Send an email or SMS campaign to your contacts",
  },
  automation_created: {
    icon: Zap,
    link: "/automations",
    description: "Create a workflow to automate follow-ups",
  },
  pipeline_configured: {
    icon: GitBranch,
    link: "/pipeline",
    description: "Set up your sales pipeline stages",
  },
  calendar_setup: {
    icon: Calendar,
    link: "/calendar",
    description: "Set up booking availability for appointments",
  },
  team_invited: {
    icon: Users,
    link: "/settings#team",
    description: "Invite a team member to collaborate",
  },
};

export default function OnboardingChecklist({ accountId }: OnboardingChecklistProps) {
  const [, navigate] = useLocation();
  const [dismissed, setDismissed] = useState(false);
  const [expanded, setExpanded] = useState(true);
  const [showCongrats, setShowCongrats] = useState(false);
  const prevCompletedRef = useRef<number | null>(null);
  const halfwayNotifiedRef = useRef(false);

  // Check localStorage for dismiss state
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

  const { data: status, isLoading } = trpc.accounts.getOnboardingStatus.useQuery(
    { accountId },
    { enabled: !dismissed && !showCongrats }
  );

  const completeOnboarding = trpc.accounts.completeOnboarding.useMutation();
  const sendProgressEmail = trpc.accounts.sendOnboardingProgressEmail.useMutation();

  // Track progress milestones and auto-complete
  useEffect(() => {
    if (!status) return;

    const { completedCount, totalCount, allComplete } = status;
    const progressPercent = Math.round((completedCount / totalCount) * 100);

    // 50% milestone email
    if (progressPercent >= 50 && !halfwayNotifiedRef.current) {
      halfwayNotifiedRef.current = true;
      localStorage.setItem(`onboarding-halfway-${accountId}`, "true");
      sendProgressEmail.mutate(
        { accountId, milestone: "halfway" },
        {
          onSuccess: () => {
            toast.success(
              `Halfway there! You've completed ${completedCount} of ${totalCount} steps. Keep going!`
            );
          },
        }
      );
    }

    // 100% completion — auto-dismiss + congratulations
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
      // Auto-dismiss after 5 seconds
      setTimeout(() => {
        localStorage.setItem(`onboarding-dismissed-${accountId}`, "true");
        setDismissed(true);
        setShowCongrats(false);
      }, 5000);
    }

    prevCompletedRef.current = completedCount;
  }, [status, accountId]);

  if (dismissed && !showCongrats) return null;

  // Congratulations card
  if (showCongrats) {
    return (
      <Card className="bg-card border-0 card-shadow overflow-hidden">
        <div className="h-1 bg-gradient-to-r from-emerald-400 via-emerald-500 to-emerald-600" />
        <CardContent className="pt-6 pb-6 px-5">
          <div className="flex flex-col items-center text-center gap-3">
            <div className="h-14 w-14 rounded-full bg-emerald-100 flex items-center justify-center animate-bounce">
              <PartyPopper className="h-7 w-7 text-emerald-600" />
            </div>
            <h3 className="text-lg font-semibold text-foreground">
              Congratulations!
            </h3>
            <p className="text-sm text-muted-foreground max-w-sm">
              You've completed all onboarding steps! Your account is fully set up
              and ready to go. Time to start closing deals.
            </p>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-xs text-muted-foreground">8/8 complete</span>
              <div className="h-2 w-24 bg-emerald-100 rounded-full overflow-hidden">
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

  const { steps, completedCount, totalCount, allComplete } = status;
  const progressPercent = Math.round((completedCount / totalCount) * 100);

  // All steps complete — show congrats handled above via useEffect
  if (allComplete) return null;

  const handleDismiss = () => {
    localStorage.setItem(`onboarding-dismissed-${accountId}`, "true");
    setDismissed(true);
  };

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
                {completedCount}/{totalCount} complete
              </span>
            </div>
            <p className="text-sm text-muted-foreground">
              Complete these steps to get the most out of Sterling Marketing
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
            {steps.map((step) => {
              const config = STEP_CONFIG[step.id];
              const Icon = config?.icon ?? Circle;
              const link = config?.link ?? "/settings";
              const description = config?.description ?? step.label;

              return (
                <div
                  key={step.id}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${
                    step.complete
                      ? "bg-emerald-500/10 border border-emerald-500/20"
                      : "hover:bg-muted/50 border border-transparent"
                  }`}
                >
                  {/* Status icon */}
                  {step.complete ? (
                    <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0" />
                  ) : (
                    <Circle className="h-5 w-5 text-muted-foreground/40 shrink-0" />
                  )}

                  {/* Step icon */}
                  <div
                    className={`h-8 w-8 rounded-lg flex items-center justify-center shrink-0 ${
                      step.complete
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
                        step.complete
                          ? "line-through text-muted-foreground"
                          : "text-foreground"
                      }`}
                    >
                      {step.label}
                    </p>
                    <p className={`text-xs truncate ${
                      step.complete
                        ? "text-muted-foreground/70"
                        : "text-muted-foreground"
                    }`}>
                      {description}
                    </p>
                  </div>

                  {/* Action button */}
                  {!step.complete && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs px-3 shrink-0 border-amber-500/30 text-amber-600 dark:text-amber-400 hover:bg-amber-500/10 hover:border-amber-500/40"
                      onClick={() => navigate(link)}
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
