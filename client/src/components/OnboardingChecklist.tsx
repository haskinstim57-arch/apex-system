import { useState, useEffect, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Phone,
  Mail,
  UserPlus,
  Calendar,
  PhoneMissed,
  Megaphone,
  Zap,
  CheckCircle2,
  Circle,
  X,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { useLocation } from "wouter";

interface OnboardingChecklistProps {
  accountId: number;
}

interface ChecklistStep {
  key: string;
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  link: string;
  completedKey: keyof OnboardingStatus;
}

interface OnboardingStatus {
  hasPhoneNumber: boolean;
  hasEmail: boolean;
  hasContact: boolean;
  hasCalendar: boolean;
  hasMissedCallTextBack: boolean;
  hasCampaign: boolean;
  hasWorkflow: boolean;
}

const CHECKLIST_STEPS: ChecklistStep[] = [
  {
    key: "phone",
    label: "Get a Phone Number",
    description: "Set up a phone number for SMS and AI calls",
    icon: Phone,
    link: "/settings#phone",
    completedKey: "hasPhoneNumber",
  },
  {
    key: "email",
    label: "Connect Your Email",
    description: "Configure SendGrid for email campaigns",
    icon: Mail,
    link: "/settings#email",
    completedKey: "hasEmail",
  },
  {
    key: "contact",
    label: "Add Your First Contact",
    description: "Import or create your first lead",
    icon: UserPlus,
    link: "/contacts",
    completedKey: "hasContact",
  },
  {
    key: "calendar",
    label: "Create a Calendar",
    description: "Set up booking availability for appointments",
    icon: Calendar,
    link: "/calendar",
    completedKey: "hasCalendar",
  },
  {
    key: "missedCall",
    label: "Set Up Missed Call Text-Back",
    description: "Auto-reply to missed calls with a text message",
    icon: PhoneMissed,
    link: "/settings#missed-call",
    completedKey: "hasMissedCallTextBack",
  },
  {
    key: "campaign",
    label: "Launch Your First Campaign",
    description: "Send an email or SMS campaign to your contacts",
    icon: Megaphone,
    link: "/campaigns",
    completedKey: "hasCampaign",
  },
  {
    key: "workflow",
    label: "Build Your First Automation",
    description: "Create a workflow to automate follow-ups",
    icon: Zap,
    link: "/automations",
    completedKey: "hasWorkflow",
  },
];

export default function OnboardingChecklist({ accountId }: OnboardingChecklistProps) {
  const [, navigate] = useLocation();
  const [dismissed, setDismissed] = useState(false);
  const [expanded, setExpanded] = useState(true);

  // Check localStorage for dismiss state
  useEffect(() => {
    const key = `onboarding-dismissed-${accountId}`;
    const stored = localStorage.getItem(key);
    if (stored === "true") {
      setDismissed(true);
    }
  }, [accountId]);

  const stableAccountId = useMemo(() => accountId, [accountId]);

  const { data: status, isLoading } = trpc.accounts.getOnboardingStatus.useQuery(
    { accountId: stableAccountId },
    { enabled: !dismissed }
  );

  if (dismissed) return null;
  if (isLoading) return <OnboardingChecklistSkeleton />;
  if (!status) return null;

  const completedCount = CHECKLIST_STEPS.filter(
    (step) => status[step.completedKey]
  ).length;
  const totalSteps = CHECKLIST_STEPS.length;
  const progressPercent = Math.round((completedCount / totalSteps) * 100);

  // All steps complete — hide permanently
  if (completedCount === totalSteps) return null;

  const handleDismiss = () => {
    const key = `onboarding-dismissed-${accountId}`;
    localStorage.setItem(key, "true");
    setDismissed(true);
  };

  return (
    <Card className="bg-white border-0 card-shadow overflow-hidden">
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
                {completedCount}/{totalSteps} complete
              </span>
            </div>
            <p className="text-sm text-muted-foreground">
              Complete these steps to get the most out of Apex System
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
          <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-amber-400 to-amber-500 rounded-full transition-all duration-500 ease-out"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>

        {/* Checklist steps */}
        {expanded && (
          <div className="space-y-1">
            {CHECKLIST_STEPS.map((step) => {
              const isComplete = status[step.completedKey];
              const Icon = step.icon;

              return (
                <div
                  key={step.key}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${
                    isComplete
                      ? "bg-emerald-50/50"
                      : "hover:bg-gray-50"
                  }`}
                >
                  {/* Status icon */}
                  {isComplete ? (
                    <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0" />
                  ) : (
                    <Circle className="h-5 w-5 text-gray-300 shrink-0" />
                  )}

                  {/* Step icon */}
                  <div
                    className={`h-8 w-8 rounded-lg flex items-center justify-center shrink-0 ${
                      isComplete
                        ? "bg-emerald-100 text-emerald-600"
                        : "bg-gray-100 text-gray-500"
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                  </div>

                  {/* Label + description */}
                  <div className="flex-1 min-w-0">
                    <p
                      className={`text-sm font-medium ${
                        isComplete
                          ? "text-emerald-700 line-through"
                          : "text-foreground"
                      }`}
                    >
                      {step.label}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">
                      {step.description}
                    </p>
                  </div>

                  {/* Action button */}
                  {!isComplete && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs px-3 shrink-0 border-amber-300 text-amber-700 hover:bg-amber-50 hover:border-amber-400"
                      onClick={() => navigate(step.link)}
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
    <Card className="bg-white border-0 card-shadow overflow-hidden">
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
          {Array.from({ length: 4 }).map((_, i) => (
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
