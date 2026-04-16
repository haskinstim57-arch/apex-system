import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { useAccount } from "@/contexts/AccountContext";
import { useLocation } from "wouter";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import {
  Building2,
  Phone,
  Mail,
  Globe,
  Briefcase,
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  Zap,
  Eye,
  EyeOff,
  Kanban,
  Pencil,
  RotateCcw,
  Rocket,
  Link2,
  Loader2,
  ExternalLink,
  MapPin,
  Trash2,
  Plus,
  CreditCard,
} from "lucide-react";
import { SquareCardForm } from "@/components/SquareCardForm";

const STEPS = [
  { id: 1, title: "Business Profile", icon: Building2 },
  { id: 2, title: "Payment Setup", icon: CreditCard },
  { id: 3, title: "Messaging Setup", icon: Mail },
  { id: 4, title: "Integrations", icon: Link2 },
  { id: 5, title: "Pipeline Setup", icon: Kanban },
  { id: 6, title: "Finish", icon: Rocket },
];

/** Inline Facebook logo SVG */
function FacebookIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
    </svg>
  );
}

const INDUSTRIES = [
  "mortgage",
  "real_estate",
  "insurance",
  "financial_services",
  "legal",
  "healthcare",
  "technology",
  "consulting",
  "other",
];

const INDUSTRY_LABELS: Record<string, string> = {
  mortgage: "Mortgage",
  real_estate: "Real Estate",
  insurance: "Insurance",
  financial_services: "Financial Services",
  legal: "Legal",
  healthcare: "Healthcare",
  technology: "Technology",
  consulting: "Consulting",
  other: "Other",
};

export default function Onboarding() {
  const [, setLocation] = useLocation();
  const { currentAccountId, currentAccount } = useAccount();
  const [step, setStep] = useState(1);

  // Step 1: Business Profile
  const [businessName, setBusinessName] = useState("");
  const [businessPhone, setBusinessPhone] = useState("");
  const [businessWebsite, setBusinessWebsite] = useState("");
  const [businessIndustry, setBusinessIndustry] = useState("mortgage");

  // Step 2: Messaging
  const [twilioAccountSid, setTwilioAccountSid] = useState("");
  const [twilioAuthToken, setTwilioAuthToken] = useState("");
  const [twilioFromNumber, setTwilioFromNumber] = useState("");
  const [sendgridApiKey, setSendgridApiKey] = useState("");
  const [sendgridFromEmail, setSendgridFromEmail] = useState("");
  const [sendgridFromName, setSendgridFromName] = useState("");
  const [showTwilioToken, setShowTwilioToken] = useState(false);
  const [showSendgridKey, setShowSendgridKey] = useState(false);

  // Step 3: Pipeline
  const [stageNames, setStageNames] = useState<{ id: number; name: string; color: string; isNew?: boolean }[]>([]);
  const [isEditingStages, setIsEditingStages] = useState(false);
  const [originalStageIds, setOriginalStageIds] = useState<Set<number>>(new Set());

  // Pre-fill from existing account data
  useEffect(() => {
    if (currentAccount) {
      setBusinessName((currentAccount as any).name || "");
      setBusinessPhone((currentAccount as any).phone || "");
      setBusinessWebsite((currentAccount as any).website || "");
      setBusinessIndustry((currentAccount as any).industry || "mortgage");
    }
  }, [currentAccount]);

  // Fetch existing messaging settings
  const { data: msgSettings } = trpc.messagingSettings.get.useQuery(
    { accountId: currentAccountId! },
    { enabled: !!currentAccountId }
  );

  useEffect(() => {
    if (msgSettings) {
      setTwilioAccountSid(msgSettings.twilioAccountSid || "");
      setTwilioAuthToken(msgSettings.twilioAuthToken || "");
      setTwilioFromNumber(msgSettings.twilioFromNumber || "");
      setSendgridApiKey(msgSettings.sendgridApiKey || "");
      setSendgridFromEmail(msgSettings.sendgridFromEmail || "");
      setSendgridFromName(msgSettings.sendgridFromName || "");
    }
  }, [msgSettings]);

  // Fetch pipeline stages
  const { data: pipelineData } = trpc.pipeline.getDefault.useQuery(
    { accountId: currentAccountId! },
    { enabled: !!currentAccountId }
  );

  useEffect(() => {
    if (pipelineData?.stages) {
      const mapped = pipelineData.stages.map((s: any) => ({ id: s.id, name: s.name, color: s.color || "#6b7280" }));
      setStageNames(mapped);
      setOriginalStageIds(new Set(mapped.map((s: any) => s.id)));
    }
  }, [pipelineData]);

  // Mutations
  const utils = trpc.useUtils();
  const updateAccount = trpc.accounts.update.useMutation();
  const saveMessaging = trpc.messagingSettings.save.useMutation();
  const renameStages = trpc.pipeline.renameStages.useMutation();
  const addStageMut = trpc.pipeline.addStage.useMutation();
  const deleteStageMut = trpc.pipeline.deleteStage.useMutation();
  const completeOnboarding = trpc.accounts.completeOnboarding.useMutation();

  const progress = (step / STEPS.length) * 100;

  // ─── Step 1: Save Business Profile ───
  const handleSaveBusinessProfile = async () => {
    if (!currentAccountId) return;
    if (!businessName.trim()) {
      toast.error("Business name is required");
      return;
    }
    try {
      await updateAccount.mutateAsync({
        id: currentAccountId,
        name: businessName.trim(),
        phone: businessPhone.trim() || undefined,
        website: businessWebsite.trim() || undefined,
        industry: businessIndustry,
      });
      toast.success("Business profile saved");
      setStep(2); // Go to Payment Setup
    } catch (err: any) {
      toast.error(err.message || "Failed to save business profile");
    }
  };

  // ─── Step 2: Payment Setup ───
  const [cardSaved, setCardSaved] = useState(false);
  const [depositDone, setDepositDone] = useState(false);
  const initialDepositMut = trpc.billing.initialDeposit.useMutation({
    onSuccess: () => {
      setDepositDone(true);
      toast.success("$10.00 initial deposit added to your account balance");
    },
    onError: (err) => {
      toast.error(err.message || "Failed to process initial deposit");
    },
  });

  const handleCardSaved = async () => {
    setCardSaved(true);
    if (currentAccountId) {
      initialDepositMut.mutate({ accountId: currentAccountId });
    }
  };

  // ─── Step 3: Save Messaging ───
  const handleSaveMessaging = async () => {
    if (!currentAccountId) return;
    try {
      await saveMessaging.mutateAsync({
        accountId: currentAccountId,
        twilioAccountSid: twilioAccountSid || null,
        twilioAuthToken: twilioAuthToken || null,
        twilioFromNumber: twilioFromNumber || null,
        sendgridApiKey: sendgridApiKey || null,
        sendgridFromEmail: sendgridFromEmail || null,
        sendgridFromName: sendgridFromName || null,
      });
      toast.success("Messaging settings saved");
    } catch (err: any) {
      toast.error(err.message || "Failed to save messaging settings");
    }
    setStep(4);
  };

  const handleSkipMessaging = () => {
    setStep(4);
  };

  // ─── Step 4: Skip Integrations ───
  const handleSkipIntegrations = () => {
    setStep(5);
  };

  // ─── Step 5: Save Pipeline ───
  const [isSavingPipeline, setIsSavingPipeline] = useState(false);
  const handleSavePipeline = async () => {
    if (!currentAccountId || !pipelineData?.pipeline) return;
    if (isEditingStages && stageNames.length > 0) {
      setIsSavingPipeline(true);
      try {
        // 1. Delete stages that were removed
        const currentIds = new Set(stageNames.filter(s => !s.isNew).map(s => s.id));
        for (const origId of originalStageIds) {
          if (!currentIds.has(origId)) {
            await deleteStageMut.mutateAsync({ accountId: currentAccountId, stageId: origId });
          }
        }

        // 2. Add new stages
        for (const stage of stageNames) {
          if (stage.isNew) {
            await addStageMut.mutateAsync({
              accountId: currentAccountId,
              pipelineId: pipelineData.pipeline.id,
              name: stage.name,
              color: stage.color,
            });
          }
        }

        // 3. Rename existing stages that changed
        const existingChanged = stageNames.filter(s => !s.isNew && originalStageIds.has(s.id));
        if (existingChanged.length > 0) {
          await renameStages.mutateAsync({
            accountId: currentAccountId,
            stages: existingChanged.map(s => ({ id: s.id, name: s.name })),
          });
        }

        toast.success("Pipeline stages updated");
        utils.pipeline.getDefault.invalidate({ accountId: currentAccountId });
      } catch (err: any) {
        toast.error(err.message || "Failed to update pipeline stages");
        setIsSavingPipeline(false);
        return;
      }
      setIsSavingPipeline(false);
    }
    setStep(6);
  };

  const handleUseDefaults = () => {
    setIsEditingStages(false);
    if (pipelineData?.stages) {
      setStageNames(
        pipelineData.stages.map((s: any) => ({ id: s.id, name: s.name, color: s.color || "#6b7280" }))
      );
    }
    setStep(6);
  };

  const STAGE_COLORS = ["#3b82f6", "#8b5cf6", "#f59e0b", "#10b981", "#ef4444", "#ec4899", "#06b6d4", "#f97316"];
  let nextTempId = -1;
  const handleAddStage = () => {
    const color = STAGE_COLORS[stageNames.length % STAGE_COLORS.length];
    setStageNames(prev => [...prev, { id: nextTempId--, name: "New Stage", color, isNew: true }]);
  };
  const handleRemoveStage = (idx: number) => {
    setStageNames(prev => prev.filter((_, i) => i !== idx));
  };

  // ─── Step 6: Complete ───
  const handleComplete = async () => {
    if (!currentAccountId) return;
    try {
      await completeOnboarding.mutateAsync({ accountId: currentAccountId });
      // Invalidate AND refetch the accounts list cache so DashboardLayout sees
      // the updated onboardingComplete flag and does NOT redirect back to /onboarding.
      await utils.accounts.list.refetch();
      toast.success("Onboarding complete! Welcome to Sterling Marketing.");
      // Small delay to ensure React state has propagated before navigating
      setTimeout(() => setLocation("/"), 300);
    } catch (err: any) {
      toast.error(err.message || "Failed to complete onboarding");
    }
  };

  if (!currentAccountId) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <Card className="max-w-md w-full border-border/50">
          <CardContent className="pt-6 text-center">
            <p className="text-muted-foreground">
              No account selected. Please contact your administrator.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Top bar */}
      <div className="border-b bg-card/50 border-0 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center">
              <Zap className="h-4 w-4 text-primary-foreground" />
            </div>
            <span className="font-semibold tracking-tight text-sm">
              Sterling Marketing
            </span>
          </div>
          <Badge variant="outline" className="text-xs">
            Step {step} of {STEPS.length}
          </Badge>
        </div>
      </div>

      {/* Progress */}
      <div className="max-w-3xl mx-auto w-full px-4 pt-6">
        <Progress value={progress} className="h-1.5" />
        <div className="flex justify-between mt-3 mb-8">
          {STEPS.map((s) => {
            const StepIcon = s.icon;
            const isActive = s.id === step;
            const isComplete = s.id < step;
            return (
              <div
                key={s.id}
                className={`flex items-center gap-2 text-xs transition-colors ${
                  isActive
                    ? "text-primary font-medium"
                    : isComplete
                      ? "text-muted-foreground"
                      : "text-muted-foreground/50"
                }`}
              >
                <div
                  className={`h-7 w-7 rounded-full flex items-center justify-center transition-colors ${
                    isActive
                      ? "bg-primary text-primary-foreground"
                      : isComplete
                        ? "bg-primary/20 text-primary"
                        : "bg-muted text-muted-foreground/50"
                  }`}
                >
                  {isComplete ? (
                    <CheckCircle2 className="h-3.5 w-3.5" />
                  ) : (
                    <StepIcon className="h-3.5 w-3.5" />
                  )}
                </div>
                <span className="hidden sm:inline">{s.title}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Content */}
      <div className="max-w-3xl mx-auto w-full px-4 pb-12 flex-1">
        {/* ─── STEP 1: Business Profile ─── */}
        {step === 1 && (
          <div className="space-y-6 animate-in fade-in duration-300">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">
                Set up your business profile
              </h1>
              <p className="text-sm text-muted-foreground mt-1">
                Tell us about your business so we can personalize your
                experience.
              </p>
            </div>

            <Card className="bg-card border-0 card-shadow">
              <CardContent className="pt-6 space-y-5">
                <div className="space-y-2">
                  <Label htmlFor="businessName" className="text-sm font-medium">
                    <Building2 className="h-3.5 w-3.5 inline mr-1.5 text-muted-foreground" />
                    Business Name <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="businessName"
                    placeholder="Acme Lending Group"
                    value={businessName}
                    onChange={(e) => setBusinessName(e.target.value)}
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="businessPhone" className="text-sm font-medium">
                      <Phone className="h-3.5 w-3.5 inline mr-1.5 text-muted-foreground" />
                      Phone Number
                    </Label>
                    <Input
                      id="businessPhone"
                      placeholder="+1 (555) 123-4567"
                      value={businessPhone}
                      onChange={(e) => setBusinessPhone(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="businessWebsite" className="text-sm font-medium">
                      <Globe className="h-3.5 w-3.5 inline mr-1.5 text-muted-foreground" />
                      Website
                    </Label>
                    <Input
                      id="businessWebsite"
                      placeholder="https://yourbusiness.com"
                      value={businessWebsite}
                      onChange={(e) => setBusinessWebsite(e.target.value)}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="businessIndustry" className="text-sm font-medium">
                    <Briefcase className="h-3.5 w-3.5 inline mr-1.5 text-muted-foreground" />
                    Industry
                  </Label>
                  <Select
                    value={businessIndustry}
                    onValueChange={setBusinessIndustry}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select industry" />
                    </SelectTrigger>
                    <SelectContent>
                      {INDUSTRIES.map((ind) => (
                        <SelectItem key={ind} value={ind}>
                          {INDUSTRY_LABELS[ind]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>

            <div className="flex justify-end">
              <Button
                onClick={handleSaveBusinessProfile}
                disabled={updateAccount.isPending}
                className="min-w-[140px]"
              >
                {updateAccount.isPending ? (
                  <span className="flex items-center gap-2">
                    <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
                    Saving...
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    Continue
                    <ArrowRight className="h-4 w-4" />
                  </span>
                )}
              </Button>
            </div>
          </div>
        )}

        {/* ─── STEP 2: Payment Setup ─── */}
        {step === 2 && (
          <div className="space-y-6 animate-in fade-in duration-300">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">
                Set up your payment method
              </h1>
              <p className="text-sm text-muted-foreground mt-1">
                A valid credit card is required to access the platform. You will be charged a $10.00 initial deposit, which will be added to your account balance for usage (emails, SMS, AI calls).
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Left Column: Pricing Info */}
              <div className="space-y-4">
                <Card className="bg-card border-0 card-shadow h-full">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Zap className="h-4 w-4 text-primary" />
                      Pay As You Go
                    </CardTitle>
                    <CardDescription className="text-xs">
                      Your balance is only used when you consume services.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Emails</span>
                        <span className="font-medium">$0.001 / email</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">SMS Messages</span>
                        <span className="font-medium">$0.015 / segment</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">AI Content Generation</span>
                        <span className="font-medium">$0.05 / request</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Power Dialer</span>
                        <span className="font-medium">$0.02 / minute</span>
                      </div>
                    </div>
                    
                    <div className="bg-muted/50 p-3 rounded-md text-xs text-muted-foreground mt-4">
                      <p className="flex items-start gap-2">
                        <CheckCircle2 className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5" />
                        <span>Your card will be automatically recharged when your balance falls below $1.00.</span>
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Right Column: Square Form */}
              <div>
                <Card className="bg-card border-0 card-shadow h-full">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <CreditCard className="h-4 w-4 text-primary" />
                      Payment Details
                    </CardTitle>
                    <CardDescription className="text-xs">
                      Secure payment processing via Square.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {cardSaved && depositDone ? (
                      <div className="flex flex-col items-center justify-center py-8 text-center space-y-3">
                        <div className="h-12 w-12 rounded-full bg-green-500/10 flex items-center justify-center">
                          <CheckCircle2 className="h-6 w-6 text-green-500" />
                        </div>
                        <div>
                          <p className="font-medium">Payment Method Saved</p>
                          <p className="text-xs text-muted-foreground mt-1">
                            $10.00 deposit added to your balance.
                          </p>
                        </div>
                      </div>
                    ) : (
                      <div className="min-h-[250px]">
                        {currentAccountId ? (
                          <SquareCardForm 
                            accountId={currentAccountId} 
                            onSuccess={handleCardSaved}
                            hideCancel={true}
                            submitText="Save Card & Pay $10 Deposit"
                          />
                        ) : (
                          <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
                            Loading account details...
                          </div>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            </div>

            <div className="flex justify-between pt-4">
              <Button variant="ghost" onClick={() => setStep(1)}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back
              </Button>
              <Button
                onClick={() => setStep(3)}
                disabled={!cardSaved || !depositDone}
                className="min-w-[140px]"
              >
                <span className="flex items-center gap-2">
                  Continue
                  <ArrowRight className="h-4 w-4" />
                </span>
              </Button>
            </div>
          </div>
        )}

        {/* ─── STEP 3: Messaging Setup ─── */}
        {step === 3 && (
          <div className="space-y-6 animate-in fade-in duration-300">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">
                Configure messaging
              </h1>
              <p className="text-sm text-muted-foreground mt-1">
                Set up SMS and email credentials so your account can send
                messages. You can skip this and configure later in Settings.
              </p>
            </div>

            {/* Twilio */}
            <Card className="bg-card border-0 card-shadow">
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2">
                  <Phone className="h-4 w-4 text-muted-foreground" />
                  <CardTitle className="text-sm font-medium">
                    Twilio SMS
                  </CardTitle>
                </div>
                <CardDescription className="text-xs">
                  Required to send SMS messages from your own phone number.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-xs">Account SID</Label>
                  <Input
                    placeholder="ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                    value={twilioAccountSid}
                    onChange={(e) => setTwilioAccountSid(e.target.value)}
                    className="font-mono text-sm"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">Auth Token</Label>
                  <div className="relative">
                    <Input
                      type={showTwilioToken ? "text" : "password"}
                      placeholder="Enter your Twilio auth token"
                      value={twilioAuthToken}
                      onChange={(e) => setTwilioAuthToken(e.target.value)}
                      className="font-mono text-sm pr-10"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
                      onClick={() => setShowTwilioToken(!showTwilioToken)}
                    >
                      {showTwilioToken ? (
                        <EyeOff className="h-3.5 w-3.5" />
                      ) : (
                        <Eye className="h-3.5 w-3.5" />
                      )}
                    </Button>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">From Phone Number</Label>
                  <Input
                    placeholder="+15551234567"
                    value={twilioFromNumber}
                    onChange={(e) => setTwilioFromNumber(e.target.value)}
                    className="font-mono text-sm"
                  />
                </div>
              </CardContent>
            </Card>

            {/* SendGrid */}
            <Card className="bg-card border-0 card-shadow">
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  <CardTitle className="text-sm font-medium">
                    SendGrid Email
                  </CardTitle>
                </div>
                <CardDescription className="text-xs">
                  Required to send emails from your own domain.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-xs">API Key</Label>
                  <div className="relative">
                    <Input
                      type={showSendgridKey ? "text" : "password"}
                      placeholder="SG.xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                      value={sendgridApiKey}
                      onChange={(e) => setSendgridApiKey(e.target.value)}
                      className="font-mono text-sm pr-10"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
                      onClick={() => setShowSendgridKey(!showSendgridKey)}
                    >
                      {showSendgridKey ? (
                        <EyeOff className="h-3.5 w-3.5" />
                      ) : (
                        <Eye className="h-3.5 w-3.5" />
                      )}
                    </Button>
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-xs">From Email</Label>
                    <Input
                      type="email"
                      placeholder="noreply@yourdomain.com"
                      value={sendgridFromEmail}
                      onChange={(e) => setSendgridFromEmail(e.target.value)}
                      className="text-sm"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs">From Name</Label>
                    <Input
                      placeholder="Your Company"
                      value={sendgridFromName}
                      onChange={(e) => setSendgridFromName(e.target.value)}
                      className="text-sm"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="flex justify-between">
              <Button variant="ghost" onClick={() => setStep(2)}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back
              </Button>
              <div className="flex gap-3">
                <Button variant="outline" onClick={handleSkipMessaging}>
                  Skip for now
                </Button>
                <Button
                  onClick={handleSaveMessaging}
                  disabled={saveMessaging.isPending}
                  className="min-w-[140px]"
                >
                  {saveMessaging.isPending ? (
                    <span className="flex items-center gap-2">
                      <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
                      Saving...
                    </span>
                  ) : (
                    <span className="flex items-center gap-2">
                      Save & Continue
                      <ArrowRight className="h-4 w-4" />
                    </span>
                  )}
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* ─── STEP 4: Integrations ─── */}
        {step === 4 && (
          <div className="space-y-6 animate-in fade-in duration-300">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">
                Connect Your Integrations
              </h1>
              <p className="text-sm text-muted-foreground mt-1">
                Connect your social media accounts to enable lead automation.
              </p>
            </div>

            {/* Facebook Card */}
            <Card className="bg-card border-0 card-shadow">
              <CardContent className="pt-6">
                <div className="flex items-start gap-4">
                  <div className="h-12 w-12 rounded-xl bg-blue-500/10 flex items-center justify-center shrink-0">
                    <FacebookIcon className="h-6 w-6 text-blue-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-semibold">Facebook & Instagram Leads</h3>
                    <p className="text-xs text-muted-foreground mt-1">
                      Automatically capture leads from your Facebook Lead Ads and create contacts.
                    </p>
                    <FacebookConnectButton accountId={currentAccountId!} />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Google Card (Placeholder) */}
            <Card className="bg-card border-0 card-shadow opacity-70">
              <CardContent className="pt-6">
                <div className="flex items-start gap-4">
                  <div className="h-12 w-12 rounded-xl bg-muted flex items-center justify-center shrink-0">
                    <MapPin className="h-6 w-6 text-muted-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-semibold">Google My Business</h3>
                      <Badge variant="secondary" className="text-[10px] px-1.5">
                        Coming Soon
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      Sync reviews and manage your Google presence.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="flex justify-between">
              <Button variant="ghost" onClick={() => setStep(3)}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back
              </Button>
              <div className="flex gap-3">
                <Button variant="outline" onClick={handleSkipIntegrations}>
                  Skip for now
                </Button>
                <Button onClick={() => setStep(5)} className="min-w-[140px]">
                  <span className="flex items-center gap-2">
                    Continue
                    <ArrowRight className="h-4 w-4" />
                  </span>
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* ─── STEP 5: Pipeline Setup ─── */}
        {step === 5 && (
          <div className="space-y-6 animate-in fade-in duration-300">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">
                Set up your pipeline
              </h1>
              <p className="text-sm text-muted-foreground mt-1">
                Your sales pipeline tracks leads through each stage. You can
                customize the stage names or use the defaults.
              </p>
            </div>

            <Card className="bg-card border-0 card-shadow">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Kanban className="h-4 w-4 text-muted-foreground" />
                    <CardTitle className="text-sm font-medium">
                      Pipeline Stages
                    </CardTitle>
                  </div>
                  {!isEditingStages ? (
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-xs h-7"
                      onClick={() => setIsEditingStages(true)}
                    >
                      <Pencil className="h-3 w-3 mr-1" />
                      Customize
                    </Button>
                  ) : (
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-xs h-7"
                      onClick={() => {
                        setIsEditingStages(false);
                        if (pipelineData?.stages) {
                          setStageNames(
                            pipelineData.stages.map((s: any) => ({
                              id: s.id,
                              name: s.name,
                              color: s.color || "#6b7280",
                            }))
                          );
                        }
                      }}
                    >
                      <RotateCcw className="h-3 w-3 mr-1" />
                      Reset
                    </Button>
                  )}
                </div>
                <CardDescription className="text-xs">
                  {isEditingStages
                    ? "Rename the stages below to match your workflow."
                    : "These are the default stages. Click Customize to rename them."}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {stageNames.map((stage, idx) => (
                    <div key={stage.id} className="flex items-center gap-3">
                      <div
                        className="h-3 w-3 rounded-full shrink-0"
                        style={{
                          backgroundColor: stage.color || "#6b7280",
                        }}
                      />
                      {isEditingStages ? (
                        <Input
                          value={stage.name}
                          onChange={(e) => {
                            const updated = [...stageNames];
                            updated[idx] = {
                              ...updated[idx],
                              name: e.target.value,
                            };
                            setStageNames(updated);
                          }}
                          className="text-sm h-9"
                        />
                      ) : (
                        <span className="text-sm text-foreground">
                          {stage.name}
                        </span>
                      )}
                      <Badge
                        variant="outline"
                        className="text-[10px] ml-auto shrink-0"
                      >
                        {idx + 1}
                      </Badge>
                      {isEditingStages && stageNames.length > 1 && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive shrink-0"
                          onClick={() => handleRemoveStage(idx)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                  ))}
                  {isEditingStages && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full mt-2 text-xs"
                      onClick={handleAddStage}
                    >
                      <Plus className="h-3.5 w-3.5 mr-1" />
                      Add Stage
                    </Button>
                  )}
                  {stageNames.length === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      Loading pipeline stages...
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>

            <div className="flex justify-between">
              <Button variant="ghost" onClick={() => setStep(4)}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back
              </Button>
              <div className="flex gap-3">
                {!isEditingStages && (
                  <Button variant="outline" onClick={handleUseDefaults}>
                    Use Defaults
                  </Button>
                )}
                <Button
                  onClick={handleSavePipeline}
                  disabled={isSavingPipeline}
                  className="min-w-[140px]"
                >
                  {isSavingPipeline ? (
                    <span className="flex items-center gap-2">
                      <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
                      Saving...
                    </span>
                  ) : (
                    <span className="flex items-center gap-2">
                      {isEditingStages ? "Save & Continue" : "Continue"}
                      <ArrowRight className="h-4 w-4" />
                    </span>
                  )}
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* ─── STEP 6: Finish ─── */}
        {step === 6 && (
          <div className="space-y-8 animate-in fade-in duration-300">
            <div className="text-center pt-8">
              <div className="mx-auto h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center mb-6">
                <CheckCircle2 className="h-8 w-8 text-primary" />
              </div>
              <h1 className="text-2xl font-semibold tracking-tight">
                You're all set!
              </h1>
              <p className="text-sm text-muted-foreground mt-2 max-w-md mx-auto">
                Your account is configured and ready to go. You can always
                update these settings later from the Settings page.
              </p>
            </div>

            <Card className="bg-card border-0 card-shadow max-w-md mx-auto">
              <CardContent className="pt-6">
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">
                      Business Profile
                    </span>
                    <CheckCircle2 className="h-4 w-4 text-primary" />
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">
                      Payment Setup
                    </span>
                    {cardSaved ? (
                      <CheckCircle2 className="h-4 w-4 text-primary" />
                    ) : (
                      <Badge variant="secondary" className="text-[10px]">Pending</Badge>
                    )}
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">
                      Messaging Setup
                    </span>
                    {twilioAccountSid || sendgridApiKey ? (
                      <CheckCircle2 className="h-4 w-4 text-primary" />
                    ) : (
                      <Badge variant="secondary" className="text-[10px]">
                        Skipped
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">
                      Integrations
                    </span>
                    <CheckCircle2 className="h-4 w-4 text-primary" />
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">
                      Pipeline Setup
                    </span>
                    <CheckCircle2 className="h-4 w-4 text-primary" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="flex flex-col items-center gap-3">
              <Button
                size="lg"
                onClick={handleComplete}
                disabled={completeOnboarding.isPending}
                className="min-w-[200px]"
              >
                {completeOnboarding.isPending ? (
                  <span className="flex items-center gap-2">
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                    Finishing...
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    <Rocket className="h-4 w-4" />
                    Go to Dashboard
                  </span>
                )}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setStep(5)}
                className="text-xs text-muted-foreground"
              >
                <ArrowLeft className="h-3 w-3 mr-1" />
                Go back and review
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Facebook Connect Button — handles OAuth popup flow.
 * Used in onboarding step 3 and Settings integrations tab.
 */
function FacebookConnectButton({ accountId }: { accountId: number }) {
  const [isConnecting, setIsConnecting] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [connectedName, setConnectedName] = useState<string | null>(null);

  const utils = trpc.useUtils();

  // Check current status
  const { data: fbStatus } = trpc.facebookOAuth.getStatus.useQuery(
    { accountId },
    { enabled: !!accountId }
  );

  useEffect(() => {
    if (fbStatus?.connected) {
      setIsConnected(true);
      setConnectedName(fbStatus.userName || null);
    }
  }, [fbStatus]);

  const callbackMutation = trpc.facebookOAuth.handleCallback.useMutation({
    onSuccess: (result) => {
      setIsConnected(true);
      setConnectedName(result.facebookUserName || null);
      setIsConnecting(false);
      toast.success(
        `Facebook connected! ${result.pagesCount} page${result.pagesCount !== 1 ? "s" : ""} imported.`
      );
      utils.facebookOAuth.getStatus.invalidate({ accountId });
    },
    onError: (err) => {
      setIsConnecting(false);
      toast.error(err.message || "Failed to connect Facebook");
    },
  });

  const handleConnect = async () => {
    setIsConnecting(true);
    const redirectUri = `${window.location.origin}/onboarding`;

    try {
      // Get the OAuth URL from the server
      const result = await utils.client.facebookOAuth.getOAuthUrl.query({
        accountId,
        redirectUri,
      });

      // Open popup
      const width = 600;
      const height = 700;
      const left = window.screenX + (window.outerWidth - width) / 2;
      const top = window.screenY + (window.outerHeight - height) / 2;
      const popup = window.open(
        result.url,
        "facebook-oauth",
        `width=${width},height=${height},left=${left},top=${top},toolbar=no,menubar=no`
      );

      if (!popup) {
        toast.error("Popup blocked. Please allow popups for this site.");
        setIsConnecting(false);
        return;
      }

      // Poll for the popup to redirect back with the code
      const pollInterval = setInterval(() => {
        try {
          if (popup.closed) {
            clearInterval(pollInterval);
            setIsConnecting(false);
            return;
          }
          const popupUrl = popup.location.href;
          if (popupUrl.includes(window.location.origin)) {
            const url = new URL(popupUrl);
            const code = url.searchParams.get("code");
            const state = url.searchParams.get("state");
            popup.close();
            clearInterval(pollInterval);

            if (code && state) {
              callbackMutation.mutate({ code, redirectUri, state });
            } else {
              setIsConnecting(false);
              const errorReason = url.searchParams.get("error_reason");
              if (errorReason === "user_denied") {
                toast.info("Facebook connection cancelled");
              } else {
                toast.error("Facebook authorization failed");
              }
            }
          }
        } catch {
          // Cross-origin error — popup is still on Facebook's domain, keep polling
        }
      }, 500);
    } catch (err: any) {
      setIsConnecting(false);
      toast.error(err.message || "Failed to start Facebook connection");
    }
  };

  if (isConnected) {
    return (
      <div className="mt-3 flex items-center gap-2">
        <Badge className="bg-green-500/10 text-green-500 border-green-200 text-xs">
          <CheckCircle2 className="h-3 w-3 mr-1" />
          Connected{connectedName ? ` as ${connectedName}` : ""}
        </Badge>
      </div>
    );
  }

  return (
    <Button
      variant="outline"
      size="sm"
      className="mt-3 text-xs border-blue-200 text-blue-600 hover:bg-blue-500/10"
      onClick={handleConnect}
      disabled={isConnecting || callbackMutation.isPending}
    >
      {isConnecting || callbackMutation.isPending ? (
        <>
          <Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" />
          Connecting...
        </>
      ) : (
        <>
          <ExternalLink className="h-3.5 w-3.5 mr-2" />
          Connect Facebook
        </>
      )}
    </Button>
  );
}
