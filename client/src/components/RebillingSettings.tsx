import { useState, useEffect, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Loader2, Save, RotateCcw, MessageSquare, Mail, Phone, Bot, Cpu, PhoneCall } from "lucide-react";
import { toast } from "sonner";

interface RebillingSettingsProps {
  accountId: number;
  accountName?: string;
}

interface ServiceConfig {
  key: string;
  label: string;
  icon: React.ReactNode;
  markupField: string;
  enabledField: string;
  baseCostLabel: string;
  baseCost: number;
  unit: string;
}

const BASE_COSTS: Record<string, { cost: number; unit: string; label: string }> = {
  sms: { cost: 0.015, unit: "per SMS", label: "SMS Messages" },
  email: { cost: 0.003, unit: "per email", label: "Emails" },
  aiCall: { cost: 0.15, unit: "per minute", label: "AI Calls" },
  voiceCall: { cost: 0.05, unit: "per minute", label: "Voice Calls" },
  llm: { cost: 0.02, unit: "per request", label: "AI Requests" },
  dialer: { cost: 0.03, unit: "per call", label: "Power Dialer" },
};

export default function RebillingSettings({ accountId, accountName }: RebillingSettingsProps) {
  const { data: settings, isLoading } = trpc.billing.getRebillingSettings.useQuery({ accountId });
  const utils = trpc.useUtils();
  const updateSettings = trpc.billing.updateRebillingSettings.useMutation({
    onSuccess: () => {
      utils.billing.getRebillingSettings.invalidate({ accountId });
      toast.success("Rebilling settings saved");
    },
    onError: (err) => toast.error(err.message),
  });

  // Local state for each service
  const [smsMarkup, setSmsMarkup] = useState(1.1);
  const [emailMarkup, setEmailMarkup] = useState(1.1);
  const [aiCallMarkup, setAiCallMarkup] = useState(1.1);
  const [voiceCallMarkup, setVoiceCallMarkup] = useState(1.1);
  const [llmMarkup, setLlmMarkup] = useState(1.1);
  const [dialerMarkup, setDialerMarkup] = useState(1.1);

  const [smsEnabled, setSmsEnabled] = useState(true);
  const [emailEnabled, setEmailEnabled] = useState(true);
  const [aiCallEnabled, setAiCallEnabled] = useState(true);
  const [voiceCallEnabled, setVoiceCallEnabled] = useState(true);
  const [llmEnabled, setLlmEnabled] = useState(true);
  const [dialerEnabled, setDialerEnabled] = useState(true);

  // Sync from server
  useEffect(() => {
    if (settings) {
      setSmsMarkup(settings.smsMarkup);
      setEmailMarkup(settings.emailMarkup);
      setAiCallMarkup(settings.aiCallMarkup);
      setVoiceCallMarkup(settings.voiceCallMarkup);
      setLlmMarkup(settings.llmMarkup);
      setDialerMarkup(settings.dialerMarkup);
      setSmsEnabled(settings.smsRebillingEnabled);
      setEmailEnabled(settings.emailRebillingEnabled);
      setAiCallEnabled(settings.aiCallRebillingEnabled);
      setVoiceCallEnabled(settings.voiceCallRebillingEnabled);
      setLlmEnabled(settings.llmRebillingEnabled);
      setDialerEnabled(settings.dialerRebillingEnabled);
    }
  }, [settings]);

  const services: ServiceConfig[] = useMemo(() => [
    {
      key: "sms",
      label: "SMS Messages",
      icon: <MessageSquare className="h-4 w-4" />,
      markupField: "smsMarkup",
      enabledField: "smsRebillingEnabled",
      baseCostLabel: "$0.015 / SMS",
      baseCost: BASE_COSTS.sms.cost,
      unit: BASE_COSTS.sms.unit,
    },
    {
      key: "email",
      label: "Emails",
      icon: <Mail className="h-4 w-4" />,
      markupField: "emailMarkup",
      enabledField: "emailRebillingEnabled",
      baseCostLabel: "$0.003 / email",
      baseCost: BASE_COSTS.email.cost,
      unit: BASE_COSTS.email.unit,
    },
    {
      key: "aiCall",
      label: "AI Calls",
      icon: <Bot className="h-4 w-4" />,
      markupField: "aiCallMarkup",
      enabledField: "aiCallRebillingEnabled",
      baseCostLabel: "$0.150 / min",
      baseCost: BASE_COSTS.aiCall.cost,
      unit: BASE_COSTS.aiCall.unit,
    },
    {
      key: "voiceCall",
      label: "Voice Calls",
      icon: <Phone className="h-4 w-4" />,
      markupField: "voiceCallMarkup",
      enabledField: "voiceCallRebillingEnabled",
      baseCostLabel: "$0.050 / min",
      baseCost: BASE_COSTS.voiceCall.cost,
      unit: BASE_COSTS.voiceCall.unit,
    },
    {
      key: "llm",
      label: "AI Requests",
      icon: <Cpu className="h-4 w-4" />,
      markupField: "llmMarkup",
      enabledField: "llmRebillingEnabled",
      baseCostLabel: "$0.020 / req",
      baseCost: BASE_COSTS.llm.cost,
      unit: BASE_COSTS.llm.unit,
    },
    {
      key: "dialer",
      label: "Power Dialer",
      icon: <PhoneCall className="h-4 w-4" />,
      markupField: "dialerMarkup",
      enabledField: "dialerRebillingEnabled",
      baseCostLabel: "$0.030 / call",
      baseCost: BASE_COSTS.dialer.cost,
      unit: BASE_COSTS.dialer.unit,
    },
  ], []);

  const getMarkup = (key: string): number => {
    const map: Record<string, number> = { sms: smsMarkup, email: emailMarkup, aiCall: aiCallMarkup, voiceCall: voiceCallMarkup, llm: llmMarkup, dialer: dialerMarkup };
    return map[key] ?? 1.1;
  };

  const setMarkup = (key: string, val: number) => {
    const map: Record<string, (v: number) => void> = { sms: setSmsMarkup, email: setEmailMarkup, aiCall: setAiCallMarkup, voiceCall: setVoiceCallMarkup, llm: setLlmMarkup, dialer: setDialerMarkup };
    map[key]?.(val);
  };

  const getEnabled = (key: string): boolean => {
    const map: Record<string, boolean> = { sms: smsEnabled, email: emailEnabled, aiCall: aiCallEnabled, voiceCall: voiceCallEnabled, llm: llmEnabled, dialer: dialerEnabled };
    return map[key] ?? true;
  };

  const setEnabled = (key: string, val: boolean) => {
    const map: Record<string, (v: boolean) => void> = { sms: setSmsEnabled, email: setEmailEnabled, aiCall: setAiCallEnabled, voiceCall: setVoiceCallEnabled, llm: setLlmEnabled, dialer: setDialerEnabled };
    map[key]?.(val);
  };

  const handleSave = () => {
    updateSettings.mutate({
      accountId,
      smsMarkup,
      emailMarkup,
      aiCallMarkup,
      voiceCallMarkup,
      llmMarkup,
      dialerMarkup,
      smsRebillingEnabled: smsEnabled,
      emailRebillingEnabled: emailEnabled,
      aiCallRebillingEnabled: aiCallEnabled,
      voiceCallRebillingEnabled: voiceCallEnabled,
      llmRebillingEnabled: llmEnabled,
      dialerRebillingEnabled: dialerEnabled,
    });
  };

  const handleResetAll = () => {
    setSmsMarkup(1.1); setEmailMarkup(1.1); setAiCallMarkup(1.1);
    setVoiceCallMarkup(1.1); setLlmMarkup(1.1); setDialerMarkup(1.1);
    setSmsEnabled(true); setEmailEnabled(true); setAiCallEnabled(true);
    setVoiceCallEnabled(true); setLlmEnabled(true); setDialerEnabled(true);
  };

  // Calculate total estimated monthly profit based on $10 spend
  const estimatedProfit = useMemo(() => {
    let totalProfit = 0;
    for (const svc of services) {
      if (!getEnabled(svc.key)) continue;
      const markup = getMarkup(svc.key);
      const profitPerUnit = svc.baseCost * (markup - 1);
      totalProfit += profitPerUnit;
    }
    return totalProfit;
  }, [smsMarkup, emailMarkup, aiCallMarkup, voiceCallMarkup, llmMarkup, dialerMarkup, smsEnabled, emailEnabled, aiCallEnabled, voiceCallEnabled, llmEnabled, dialerEnabled, services]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg">Rebilling & Markup</CardTitle>
            <CardDescription>
              Set per-service markup multipliers for {accountName || "this account"}. The markup is applied on top of your base cost.
            </CardDescription>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handleResetAll}>
              <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
              Reset
            </Button>
            <Button size="sm" onClick={handleSave} disabled={updateSettings.isPending}>
              {updateSettings.isPending ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Save className="h-3.5 w-3.5 mr-1.5" />}
              Save
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Service rows */}
        {services.map((svc) => {
          const markup = getMarkup(svc.key);
          const enabled = getEnabled(svc.key);
          const chargedCost = svc.baseCost * markup;
          const profit = svc.baseCost * (markup - 1);
          const marginPct = ((markup - 1) * 100).toFixed(0);

          return (
            <div
              key={svc.key}
              className={`rounded-lg border p-4 transition-opacity ${!enabled ? "opacity-50" : ""}`}
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2.5">
                  <div className="flex items-center justify-center w-8 h-8 rounded-md bg-muted">
                    {svc.icon}
                  </div>
                  <div>
                    <div className="font-medium text-sm">{svc.label}</div>
                    <div className="text-xs text-muted-foreground">Base: {svc.baseCostLabel}</div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Badge variant={enabled ? "default" : "secondary"} className="text-xs">
                    {enabled ? `${marginPct}% margin` : "Disabled"}
                  </Badge>
                  <Switch
                    checked={enabled}
                    onCheckedChange={(val) => setEnabled(svc.key, val)}
                  />
                </div>
              </div>

              {enabled && (
                <div className="space-y-3">
                  {/* Slider */}
                  <div className="flex items-center gap-4">
                    <span className="text-xs text-muted-foreground w-10">1.00x</span>
                    <Slider
                      value={[markup]}
                      min={1}
                      max={5}
                      step={0.05}
                      onValueChange={([val]) => setMarkup(svc.key, val)}
                      className="flex-1"
                    />
                    <span className="text-xs text-muted-foreground w-10 text-right">5.00x</span>
                    <span className="text-sm font-mono font-semibold w-14 text-right">
                      {markup.toFixed(2)}x
                    </span>
                  </div>

                  {/* Cost breakdown */}
                  <div className="grid grid-cols-3 gap-2 text-xs">
                    <div className="bg-muted/50 rounded-md p-2 text-center">
                      <div className="text-muted-foreground mb-0.5">Your Cost</div>
                      <div className="font-mono font-medium">${svc.baseCost.toFixed(3)}</div>
                    </div>
                    <div className="bg-muted/50 rounded-md p-2 text-center">
                      <div className="text-muted-foreground mb-0.5">Client Pays</div>
                      <div className="font-mono font-medium">${chargedCost.toFixed(3)}</div>
                    </div>
                    <div className="bg-emerald-50 dark:bg-emerald-950/30 rounded-md p-2 text-center">
                      <div className="text-emerald-600 dark:text-emerald-400 mb-0.5">Your Profit</div>
                      <div className="font-mono font-medium text-emerald-700 dark:text-emerald-300">
                        +${profit.toFixed(4)}
                      </div>
                    </div>
                  </div>

                  {/* $10 estimate */}
                  <div className="text-xs text-muted-foreground text-center">
                    If client spends $10 on {svc.label.toLowerCase()}: you earn{" "}
                    <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                      ${((10 / chargedCost) * profit).toFixed(2)}
                    </span>{" "}
                    profit (~{Math.floor(10 / chargedCost)} {svc.unit.replace("per ", "").replace("/ ", "")}{svc.key === "sms" ? "" : "s"})
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
