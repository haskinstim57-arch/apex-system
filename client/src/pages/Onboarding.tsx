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
} from "lucide-react";

const STEPS = [
  { id: 1, title: "Business Profile", icon: Building2 },
  { id: 2, title: "Messaging Setup", icon: Mail },
  { id: 3, title: "Pipeline Setup", icon: Kanban },
  { id: 4, title: "Finish", icon: Rocket },
];

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
  const [stageNames, setStageNames] = useState<{ id: number; name: string }[]>([]);
  const [isEditingStages, setIsEditingStages] = useState(false);

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
      setStageNames(
        pipelineData.stages.map((s: any) => ({ id: s.id, name: s.name }))
      );
    }
  }, [pipelineData]);

  // Mutations
  const updateAccount = trpc.accounts.update.useMutation();
  const saveMessaging = trpc.messagingSettings.save.useMutation();
  const renameStages = trpc.pipeline.renameStages.useMutation();
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
      setStep(2);
    } catch (err: any) {
      toast.error(err.message || "Failed to save business profile");
    }
  };

  // ─── Step 2: Save Messaging ───
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
    setStep(3);
  };

  const handleSkipMessaging = () => {
    setStep(3);
  };

  // ─── Step 3: Save Pipeline ───
  const handleSavePipeline = async () => {
    if (!currentAccountId) return;
    if (isEditingStages && stageNames.length > 0) {
      try {
        await renameStages.mutateAsync({
          accountId: currentAccountId,
          stages: stageNames,
        });
        toast.success("Pipeline stages updated");
      } catch (err: any) {
        toast.error(err.message || "Failed to update pipeline stages");
      }
    }
    setStep(4);
  };

  const handleUseDefaults = () => {
    setIsEditingStages(false);
    if (pipelineData?.stages) {
      setStageNames(
        pipelineData.stages.map((s: any) => ({ id: s.id, name: s.name }))
      );
    }
    setStep(4);
  };

  // ─── Step 4: Complete ───
  const handleComplete = async () => {
    if (!currentAccountId) return;
    try {
      await completeOnboarding.mutateAsync({ accountId: currentAccountId });
      toast.success("Onboarding complete! Welcome to Apex System.");
      setLocation("/");
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
      <div className="border-b border-border/50 bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center">
              <Zap className="h-4 w-4 text-primary-foreground" />
            </div>
            <span className="font-semibold tracking-tight text-sm">
              Apex System
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

            <Card className="border-border/50 bg-card">
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

        {/* ─── STEP 2: Messaging Setup ─── */}
        {step === 2 && (
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
            <Card className="border-border/50 bg-card">
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
            <Card className="border-border/50 bg-card">
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
              <Button variant="ghost" onClick={() => setStep(1)}>
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

        {/* ─── STEP 3: Pipeline Setup ─── */}
        {step === 3 && (
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

            <Card className="border-border/50 bg-card">
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
                          backgroundColor:
                            pipelineData?.stages?.[idx]?.color || "#6b7280",
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
                    </div>
                  ))}
                  {stageNames.length === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      Loading pipeline stages...
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>

            <div className="flex justify-between">
              <Button variant="ghost" onClick={() => setStep(2)}>
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
                  disabled={renameStages.isPending}
                  className="min-w-[140px]"
                >
                  {renameStages.isPending ? (
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

        {/* ─── STEP 4: Finish ─── */}
        {step === 4 && (
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

            <Card className="border-border/50 bg-card max-w-md mx-auto">
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
                onClick={() => setStep(3)}
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
