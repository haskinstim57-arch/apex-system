import { useState, useEffect, useCallback, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { useAccount } from "@/contexts/AccountContext";
import { useAuth } from "@/_core/hooks/useAuth";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  Zap,
  Loader2,
  Rocket,
  Target,
  Users,
  Phone,
  BarChart3,
  Bot,
  MessageSquare,
  Calendar,
  TrendingUp,
  Shield,
  Heart,
  Sparkles,
  CreditCard,
  Building2,
  Mail,
} from "lucide-react";
import { SquareCardForm } from "@/components/SquareCardForm";

// ─── GOAL DEFINITIONS ────────────────────────────────────────
type GoalDef = {
  id: string;
  label: string;
  description: string;
  icon: React.ElementType;
  prePopulate: string[]; // checklist item IDs this goal enables
};

const GOALS: GoalDef[] = [
  {
    id: "lead_gen",
    label: "Generate More Leads",
    description: "Facebook ads, landing pages, and lead capture forms",
    icon: Target,
    prePopulate: ["connect_facebook", "import_contacts", "setup_pipeline"],
  },
  {
    id: "follow_up",
    label: "Automate Follow-Up",
    description: "AI calls, drip sequences, and missed-call text-back",
    icon: Bot,
    prePopulate: ["setup_phone", "enable_ai_calling", "create_sequence"],
  },
  {
    id: "close_deals",
    label: "Close More Deals",
    description: "Pipeline management, task tracking, and deal velocity",
    icon: TrendingUp,
    prePopulate: ["setup_pipeline", "create_workflow", "setup_calendar"],
  },
  {
    id: "nurture",
    label: "Nurture Past Clients",
    description: "Email campaigns, birthday reminders, and re-engagement",
    icon: Heart,
    prePopulate: ["import_contacts", "create_campaign", "setup_email"],
  },
  {
    id: "team_mgmt",
    label: "Manage My Team",
    description: "Round-robin leads, performance reports, and permissions",
    icon: Users,
    prePopulate: ["invite_team", "setup_pipeline", "enable_reports"],
  },
  {
    id: "ai_assistant",
    label: "Use AI Assistant",
    description: "Jarvis for reports, contact lookup, and task automation",
    icon: Sparkles,
    prePopulate: ["try_jarvis", "import_contacts", "enable_reports"],
  },
];

// ─── CHECKLIST ITEMS ─────────────────────────────────────────
type ChecklistItem = {
  id: string;
  label: string;
  description: string;
  route: string;
  icon: React.ElementType;
  priority: "required" | "recommended" | "optional";
};

const CHECKLIST_ITEMS: ChecklistItem[] = [
  { id: "setup_phone", label: "Connect a phone number", description: "Enable SMS and AI calling", route: "/settings/messaging", icon: Phone, priority: "required" },
  { id: "add_payment", label: "Add a payment method", description: "Required for SMS, email, and AI usage", route: "/billing", icon: CreditCard, priority: "required" },
  { id: "business_profile", label: "Complete business profile", description: "Name, address, and branding", route: "/settings/general", icon: Building2, priority: "required" },
  { id: "import_contacts", label: "Import your contacts", description: "Upload CSV or add manually", route: "/contacts", icon: Users, priority: "recommended" },
  { id: "setup_pipeline", label: "Set up your pipeline", description: "Customize deal stages", route: "/pipeline", icon: BarChart3, priority: "recommended" },
  { id: "setup_email", label: "Configure email sender", description: "Verify your sending domain", route: "/settings/messaging", icon: Mail, priority: "recommended" },
  { id: "connect_facebook", label: "Connect Facebook", description: "Import leads automatically", route: "/settings/integrations", icon: Target, priority: "recommended" },
  { id: "setup_calendar", label: "Set up calendar", description: "Enable appointment booking", route: "/calendar", icon: Calendar, priority: "optional" },
  { id: "create_sequence", label: "Create a drip sequence", description: "Automate follow-up messages", route: "/sequences", icon: MessageSquare, priority: "optional" },
  { id: "create_campaign", label: "Send your first campaign", description: "Email or SMS blast", route: "/campaigns", icon: Mail, priority: "optional" },
  { id: "create_workflow", label: "Build an automation", description: "Trigger-based workflows", route: "/automations", icon: Zap, priority: "optional" },
  { id: "invite_team", label: "Invite a team member", description: "Add employees or managers", route: "/settings/team", icon: Users, priority: "optional" },
  { id: "enable_ai_calling", label: "Enable AI voice agent", description: "Automated outbound calls", route: "/settings/voice-agent", icon: Bot, priority: "optional" },
  { id: "try_jarvis", label: "Try Jarvis AI assistant", description: "Ask for a report or contact info", route: "/jarvis", icon: Sparkles, priority: "optional" },
  { id: "enable_reports", label: "Review your first report", description: "Daily activity or pipeline summary", route: "/reports", icon: BarChart3, priority: "optional" },
];

// ─── ONBOARDING PHASES ───────────────────────────────────────
type OnboardingPhase =
  | "welcome"
  | "goals"
  | "aha_moment"
  | "setup"
  | "human_touch"
  | "complete";

const PHASE_ORDER: OnboardingPhase[] = [
  "welcome",
  "goals",
  "aha_moment",
  "setup",
  "human_touch",
  "complete",
];

// ─── MAIN COMPONENT ─────────────────────────────────────────
export default function OnboardingV2() {
  const { currentAccountId, currentAccount } = useAccount();
  const { user } = useAuth();
  const [, navigate] = useLocation();

  const [phase, setPhase] = useState<OnboardingPhase>("welcome");
  const [selectedGoals, setSelectedGoals] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [demoSeeded, setDemoSeeded] = useState(false);

  // Setup phase fields
  const [businessName, setBusinessName] = useState("");
  const [businessPhone, setBusinessPhone] = useState("");
  const [businessEmail, setBusinessEmail] = useState("");

  // tRPC mutations
  const saveGoals = trpc.accounts.saveOnboardingGoals.useMutation();
  const seedDemo = trpc.accounts.seedOnboardingDemo.useMutation();
  const logEvent = trpc.accounts.logOnboardingEvent.useMutation();
  const completeOnboarding = trpc.accounts.completeOnboardingV2.useMutation();

  const accountId = currentAccountId ?? 0;

  // Pre-fill business name from account
  useEffect(() => {
    if (currentAccount?.name) {
      setBusinessName(currentAccount.name);
    }
    if (user?.email) {
      setBusinessEmail(user.email);
    }
  }, [currentAccount, user]);

  // Log phase views
  useEffect(() => {
    if (!accountId) return;
    logEvent.mutate({ accountId, step: phase, action: "viewed" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, accountId]);

  const phaseIndex = PHASE_ORDER.indexOf(phase);
  const progressPercent = Math.round(((phaseIndex + 1) / PHASE_ORDER.length) * 100);

  const goNext = useCallback(() => {
    const idx = PHASE_ORDER.indexOf(phase);
    if (idx < PHASE_ORDER.length - 1) {
      setPhase(PHASE_ORDER[idx + 1]);
    }
  }, [phase]);

  const goBack = useCallback(() => {
    const idx = PHASE_ORDER.indexOf(phase);
    if (idx > 0) {
      setPhase(PHASE_ORDER[idx - 1]);
    }
  }, [phase]);

  // ─── PHASE 1: WELCOME ──────────────────────────────────────
  const WelcomePhase = () => (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
      <div className="mb-8">
        <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center mx-auto mb-6 shadow-lg shadow-amber-500/20">
          <Rocket className="w-10 h-10 text-white" />
        </div>
        <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
          Welcome to Apex System
        </h1>
        <p className="text-lg text-muted-foreground max-w-lg mx-auto mb-2">
          Your AI-powered CRM is about to change how you close loans.
        </p>
        <p className="text-muted-foreground max-w-md mx-auto">
          In the next 3 minutes, you'll see exactly how Apex System works with your leads — then we'll set up the essentials.
        </p>
      </div>

      {/* Outcome stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-2xl mx-auto mb-10">
        {[
          { stat: "3x", label: "faster lead response", icon: Zap },
          { stat: "40%", label: "more appointments booked", icon: Calendar },
          { stat: "2hrs", label: "saved per day on follow-up", icon: TrendingUp },
        ].map((item) => (
          <div
            key={item.label}
            className="flex flex-col items-center p-4 rounded-xl border border-border/50 bg-card/50"
          >
            <item.icon className="w-5 h-5 text-amber-500 mb-2" />
            <span className="text-2xl font-bold text-foreground">{item.stat}</span>
            <span className="text-xs text-muted-foreground">{item.label}</span>
          </div>
        ))}
      </div>

      <Button
        size="lg"
        className="bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white px-8 py-3 text-lg shadow-lg shadow-amber-500/20"
        onClick={goNext}
      >
        Let's Go <ArrowRight className="ml-2 w-5 h-5" />
      </Button>
    </div>
  );

  // ─── PHASE 2: GOALS ────────────────────────────────────────
  const GoalsPhase = () => {
    const toggleGoal = (goalId: string) => {
      setSelectedGoals((prev) =>
        prev.includes(goalId) ? prev.filter((g) => g !== goalId) : [...prev, goalId]
      );
    };

    const handleContinue = async () => {
      if (selectedGoals.length === 0) {
        toast.error("Select at least one goal to continue");
        return;
      }
      setIsSubmitting(true);
      try {
        await saveGoals.mutateAsync({ accountId, goals: selectedGoals });
        goNext();
      } catch {
        toast.error("Failed to save goals");
      } finally {
        setIsSubmitting(false);
      }
    };

    return (
      <div className="max-w-3xl mx-auto px-4">
        <div className="text-center mb-8">
          <h2 className="text-2xl md:text-3xl font-bold text-foreground mb-2">
            What do you want to accomplish?
          </h2>
          <p className="text-muted-foreground">
            Select your top priorities — we'll customize your setup and checklist.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-8">
          {GOALS.map((goal) => {
            const isSelected = selectedGoals.includes(goal.id);
            return (
              <button
                key={goal.id}
                onClick={() => toggleGoal(goal.id)}
                className={`relative flex flex-col items-start p-4 rounded-xl border-2 transition-all text-left ${
                  isSelected
                    ? "border-amber-500 bg-amber-500/10 shadow-md shadow-amber-500/10"
                    : "border-border/50 bg-card/50 hover:border-border hover:bg-card"
                }`}
              >
                {isSelected && (
                  <div className="absolute top-2 right-2">
                    <CheckCircle2 className="w-5 h-5 text-amber-500" />
                  </div>
                )}
                <goal.icon
                  className={`w-8 h-8 mb-3 ${isSelected ? "text-amber-500" : "text-muted-foreground"}`}
                />
                <span className="font-semibold text-foreground text-sm">{goal.label}</span>
                <span className="text-xs text-muted-foreground mt-1">{goal.description}</span>
              </button>
            );
          })}
        </div>

        <div className="flex items-center justify-between">
          <Button variant="ghost" onClick={goBack}>
            <ArrowLeft className="mr-2 w-4 h-4" /> Back
          </Button>
          <div className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground">
              {selectedGoals.length} selected
            </span>
            <Button
              onClick={handleContinue}
              disabled={isSubmitting || selectedGoals.length === 0}
              className="bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white"
            >
              {isSubmitting ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : null}
              Continue <ArrowRight className="ml-2 w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>
    );
  };

  // ─── PHASE 3: AHA MOMENT ───────────────────────────────────
  const AhaMomentPhase = () => {
    const [demoLoading, setDemoLoading] = useState(false);
    const [showDemo, setShowDemo] = useState(demoSeeded);

    const handleSeedDemo = async () => {
      setDemoLoading(true);
      try {
        const result = await seedDemo.mutateAsync({ accountId });
        setDemoSeeded(true);
        setShowDemo(true);
        if (result.alreadySeeded) {
          toast.info("Demo data already loaded");
        } else {
          toast.success("Demo contacts loaded — try asking Jarvis about them!");
        }
      } catch {
        toast.error("Failed to load demo data");
      } finally {
        setDemoLoading(false);
      }
    };

    return (
      <div className="max-w-3xl mx-auto px-4">
        <div className="text-center mb-8">
          <h2 className="text-2xl md:text-3xl font-bold text-foreground mb-2">
            See Apex System in action
          </h2>
          <p className="text-muted-foreground">
            We've loaded 5 sample leads into your account. Watch how the AI handles them.
          </p>
        </div>

        {!showDemo ? (
          <div className="flex flex-col items-center">
            <Card className="w-full max-w-md border-border/50 bg-card/50 mb-6">
              <CardContent className="p-6 text-center">
                <Bot className="w-12 h-12 text-amber-500 mx-auto mb-4" />
                <h3 className="font-semibold text-foreground mb-2">Load Demo Leads</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  We'll add 5 realistic loan officer leads with notes, messages, and dispositions.
                  You can remove them anytime.
                </p>
                <Button
                  onClick={handleSeedDemo}
                  disabled={demoLoading}
                  className="bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white"
                >
                  {demoLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  ) : (
                    <Sparkles className="w-4 h-4 mr-2" />
                  )}
                  Load Demo Data
                </Button>
              </CardContent>
            </Card>
            <Button variant="ghost" onClick={goNext} className="text-muted-foreground">
              Skip this step <ArrowRight className="ml-2 w-4 h-4" />
            </Button>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Demo loaded confirmation */}
            <Card className="border-amber-500/30 bg-amber-500/5">
              <CardContent className="p-5">
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-lg bg-amber-500/20 flex items-center justify-center flex-shrink-0">
                    <CheckCircle2 className="w-5 h-5 text-amber-500" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-foreground mb-1">Demo leads loaded!</h3>
                    <p className="text-sm text-muted-foreground">
                      5 sample contacts are now in your CRM. Here's what you can try:
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Try-it suggestions */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {[
                {
                  title: "Ask Jarvis for a report",
                  description: "\"Show me yesterday's activity report\"",
                  icon: Sparkles,
                  route: "/jarvis",
                },
                {
                  title: "View your contacts",
                  description: "See the 5 demo leads with notes & messages",
                  icon: Users,
                  route: "/contacts",
                },
                {
                  title: "Check the pipeline",
                  description: "See deals at different stages",
                  icon: BarChart3,
                  route: "/pipeline",
                },
                {
                  title: "Open a contact profile",
                  description: "See communication history & dispositions",
                  icon: MessageSquare,
                  route: "/contacts",
                },
              ].map((item) => (
                <button
                  key={item.title}
                  onClick={() => {
                    toast.info(`Try this after onboarding: go to ${item.route}`);
                  }}
                  className="flex items-start gap-3 p-4 rounded-xl border border-border/50 bg-card/50 hover:bg-card hover:border-border transition-all text-left"
                >
                  <item.icon className="w-5 h-5 text-amber-500 mt-0.5 flex-shrink-0" />
                  <div>
                    <span className="font-medium text-foreground text-sm block">{item.title}</span>
                    <span className="text-xs text-muted-foreground">{item.description}</span>
                  </div>
                </button>
              ))}
            </div>

            <div className="flex items-center justify-between pt-4">
              <Button variant="ghost" onClick={goBack}>
                <ArrowLeft className="mr-2 w-4 h-4" /> Back
              </Button>
              <Button
                onClick={goNext}
                className="bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white"
              >
                Continue to Setup <ArrowRight className="ml-2 w-4 h-4" />
              </Button>
            </div>
          </div>
        )}
      </div>
    );
  };

  // ─── PHASE 4: SETUP (stripped-down essentials) ─────────────
  const SetupPhase = () => {
    const [paymentDone, setPaymentDone] = useState(false);

    return (
      <div className="max-w-2xl mx-auto px-4">
        <div className="text-center mb-8">
          <h2 className="text-2xl md:text-3xl font-bold text-foreground mb-2">
            Quick setup — just the essentials
          </h2>
          <p className="text-muted-foreground">
            We only need 3 things to get you started. Everything else can wait.
          </p>
        </div>

        <div className="space-y-4">
          {/* Business Info */}
          <Card className="border-border/50 bg-card/50">
            <CardContent className="p-5">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-8 h-8 rounded-lg bg-amber-500/20 flex items-center justify-center">
                  <Building2 className="w-4 h-4 text-amber-500" />
                </div>
                <div>
                  <h3 className="font-semibold text-foreground text-sm">Business Info</h3>
                  <p className="text-xs text-muted-foreground">We'll use this for your emails and branding</p>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Business Name</Label>
                  <Input
                    value={businessName}
                    onChange={(e) => setBusinessName(e.target.value)}
                    placeholder="Your Company"
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label className="text-xs">Business Phone</Label>
                  <Input
                    value={businessPhone}
                    onChange={(e) => setBusinessPhone(e.target.value)}
                    placeholder="(555) 123-4567"
                    className="mt-1"
                  />
                </div>
                <div className="sm:col-span-2">
                  <Label className="text-xs">Business Email</Label>
                  <Input
                    value={businessEmail}
                    onChange={(e) => setBusinessEmail(e.target.value)}
                    placeholder="you@company.com"
                    className="mt-1"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Payment Method */}
          <Card className="border-border/50 bg-card/50">
            <CardContent className="p-5">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-8 h-8 rounded-lg bg-amber-500/20 flex items-center justify-center">
                  <CreditCard className="w-4 h-4 text-amber-500" />
                </div>
                <div>
                  <h3 className="font-semibold text-foreground text-sm">Payment Method</h3>
                  <p className="text-xs text-muted-foreground">Required for SMS, email, and AI calling usage</p>
                </div>
                {paymentDone && (
                  <Badge className="ml-auto bg-green-500/20 text-green-400 border-green-500/30">
                    <CheckCircle2 className="w-3 h-3 mr-1" /> Added
                  </Badge>
                )}
              </div>
              {!paymentDone ? (
                <div className="bg-background/50 rounded-lg p-4 border border-border/30">
                  <p className="text-xs text-muted-foreground mb-3">
                    Your card is securely processed by Square. You'll only be charged for usage (SMS, email, AI calls).
                  </p>
                  <SquareCardForm
                    accountId={accountId}
                    onSuccess={() => {
                      setPaymentDone(true);
                      toast.success("Payment method added!");
                    }}
                    onError={(msg) => toast.error(msg || "Payment setup failed")}
                  />
                </div>
              ) : (
                <p className="text-sm text-green-400">
                  Payment method saved. You can manage it later in Billing settings.
                </p>
              )}
            </CardContent>
          </Card>

          {/* Phone number info */}
          <Card className="border-border/50 bg-card/50">
            <CardContent className="p-5">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-amber-500/20 flex items-center justify-center">
                  <Phone className="w-4 h-4 text-amber-500" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-foreground text-sm">Phone Number</h3>
                  <p className="text-xs text-muted-foreground">
                    We'll assign a phone number for you after setup. You can port your own number later.
                  </p>
                </div>
                <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30 text-xs">
                  Auto-assigned
                </Badge>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="flex items-center justify-between mt-8">
          <Button variant="ghost" onClick={goBack}>
            <ArrowLeft className="mr-2 w-4 h-4" /> Back
          </Button>
          <Button
            onClick={goNext}
            className="bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white"
          >
            Continue <ArrowRight className="ml-2 w-4 h-4" />
          </Button>
        </div>
      </div>
    );
  };

  // ─── PHASE 5: HUMAN TOUCH ──────────────────────────────────
  const HumanTouchPhase = () => {
    const [bookingRequested, setBookingRequested] = useState(false);

    return (
      <div className="max-w-2xl mx-auto px-4">
        <div className="text-center mb-8">
          <h2 className="text-2xl md:text-3xl font-bold text-foreground mb-2">
            You're not alone in this
          </h2>
          <p className="text-muted-foreground">
            Our team is here to help you get the most out of Apex System.
          </p>
        </div>

        <div className="space-y-4">
          {/* Onboarding call CTA */}
          <Card className="border-amber-500/30 bg-gradient-to-br from-amber-500/5 to-amber-600/5">
            <CardContent className="p-6 text-center">
              <div className="w-14 h-14 rounded-2xl bg-amber-500/20 flex items-center justify-center mx-auto mb-4">
                <Calendar className="w-7 h-7 text-amber-500" />
              </div>
              <h3 className="text-lg font-semibold text-foreground mb-2">
                Book a free onboarding call
              </h3>
              <p className="text-sm text-muted-foreground mb-4 max-w-md mx-auto">
                A 15-minute call with our team to walk through your account, import your contacts, and set up your first campaign.
              </p>
              {!bookingRequested ? (
                <Button
                  onClick={() => {
                    setBookingRequested(true);
                    toast.success("We'll reach out to schedule your call!");
                    logEvent.mutate({
                      accountId,
                      step: "human_touch",
                      action: "booking_requested",
                    });
                  }}
                  className="bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white"
                >
                  <Calendar className="w-4 h-4 mr-2" /> Request a Call
                </Button>
              ) : (
                <div className="flex items-center justify-center gap-2 text-green-400">
                  <CheckCircle2 className="w-5 h-5" />
                  <span className="font-medium">Call requested — we'll be in touch!</span>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Support channels */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Card className="border-border/50 bg-card/50">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-blue-500/20 flex items-center justify-center">
                    <MessageSquare className="w-4 h-4 text-blue-400" />
                  </div>
                  <div>
                    <h4 className="font-medium text-foreground text-sm">Live Chat Support</h4>
                    <p className="text-xs text-muted-foreground">Available in the bottom-right corner</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="border-border/50 bg-card/50">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-purple-500/20 flex items-center justify-center">
                    <Shield className="w-4 h-4 text-purple-400" />
                  </div>
                  <div>
                    <h4 className="font-medium text-foreground text-sm">Knowledge Base</h4>
                    <p className="text-xs text-muted-foreground">Guides, tutorials, and FAQs</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        <div className="flex items-center justify-between mt-8">
          <Button variant="ghost" onClick={goBack}>
            <ArrowLeft className="mr-2 w-4 h-4" /> Back
          </Button>
          <Button
            onClick={async () => {
              setIsSubmitting(true);
              try {
                await completeOnboarding.mutateAsync({ accountId });
                goNext();
              } catch {
                toast.error("Failed to complete onboarding");
              } finally {
                setIsSubmitting(false);
              }
            }}
            disabled={isSubmitting}
            className="bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white"
          >
            {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
            Finish Setup <ArrowRight className="ml-2 w-4 h-4" />
          </Button>
        </div>
      </div>
    );
  };

  // ─── PHASE 6: COMPLETE ─────────────────────────────────────
  const CompletePhase = () => {
    // Build personalized checklist based on selected goals
    const personalizedItems = useMemo(() => {
      const goalPrePopIds = new Set<string>();
      for (const goalId of selectedGoals) {
        const goal = GOALS.find((g) => g.id === goalId);
        if (goal) goal.prePopulate.forEach((id) => goalPrePopIds.add(id));
      }

      // Required items always show first, then goal-relevant, then others
      return CHECKLIST_ITEMS.sort((a, b) => {
        const priorityOrder = { required: 0, recommended: 1, optional: 2 };
        const aRelevant = goalPrePopIds.has(a.id) ? 0 : 1;
        const bRelevant = goalPrePopIds.has(b.id) ? 0 : 1;
        if (a.priority !== b.priority) return priorityOrder[a.priority] - priorityOrder[b.priority];
        return aRelevant - bRelevant;
      });
    }, [selectedGoals]);

    return (
      <div className="max-w-2xl mx-auto px-4 text-center">
        <div className="mb-8">
          <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-green-400 to-green-600 flex items-center justify-center mx-auto mb-6 shadow-lg shadow-green-500/20">
            <CheckCircle2 className="w-10 h-10 text-white" />
          </div>
          <h2 className="text-2xl md:text-3xl font-bold text-foreground mb-2">
            You're all set!
          </h2>
          <p className="text-muted-foreground max-w-md mx-auto">
            Your account is ready. We've created a personalized checklist on your dashboard to help you unlock everything.
          </p>
        </div>

        {/* Quick preview of checklist */}
        <Card className="border-border/50 bg-card/50 text-left mb-8">
          <CardContent className="p-5">
            <h3 className="font-semibold text-foreground text-sm mb-3">
              Your personalized next steps
            </h3>
            <div className="space-y-2">
              {personalizedItems.slice(0, 5).map((item) => (
                <div key={item.id} className="flex items-center gap-3 py-1">
                  <div className="w-5 h-5 rounded-full border-2 border-border/50 flex-shrink-0" />
                  <span className="text-sm text-foreground">{item.label}</span>
                  {item.priority === "required" && (
                    <Badge variant="outline" className="text-xs ml-auto border-amber-500/30 text-amber-500">
                      Required
                    </Badge>
                  )}
                </div>
              ))}
              {personalizedItems.length > 5 && (
                <p className="text-xs text-muted-foreground pl-8">
                  +{personalizedItems.length - 5} more on your dashboard
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        <Button
          size="lg"
          onClick={() => navigate("/dashboard")}
          className="bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white px-8 py-3 text-lg shadow-lg shadow-amber-500/20"
        >
          Go to Dashboard <ArrowRight className="ml-2 w-5 h-5" />
        </Button>
      </div>
    );
  };

  // ─── RENDER ────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Progress bar */}
      <div className="sticky top-0 z-50 bg-background/80 backdrop-blur-sm border-b border-border/30">
        <div className="max-w-4xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-muted-foreground">
              Step {phaseIndex + 1} of {PHASE_ORDER.length}
            </span>
            <span className="text-xs text-muted-foreground">{progressPercent}%</span>
          </div>
          <Progress value={progressPercent} className="h-1.5" />
        </div>
      </div>

      {/* Phase content */}
      <div className="flex-1 py-8 md:py-12">
        {phase === "welcome" && <WelcomePhase />}
        {phase === "goals" && <GoalsPhase />}
        {phase === "aha_moment" && <AhaMomentPhase />}
        {phase === "setup" && <SetupPhase />}
        {phase === "human_touch" && <HumanTouchPhase />}
        {phase === "complete" && <CompletePhase />}
      </div>
    </div>
  );
}

// ─── EXPORTED CONSTANTS for use in OnboardingChecklist ────────
export { CHECKLIST_ITEMS, GOALS };
export type { ChecklistItem, GoalDef };
