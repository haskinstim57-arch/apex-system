import { useState, useMemo, useEffect, useCallback } from "react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/_core/hooks/useAuth";
import { useAccount } from "@/contexts/AccountContext";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DollarSign,
  Receipt,
  TrendingUp,
  CreditCard,
  Send,
  FileText,
  AlertCircle,
  CheckCircle2,
  Clock,
  Ban,
  ExternalLink,
  Loader2,
  Building2,
  Settings2,
  Plus,
  Trash2,
  Star,
  ShieldAlert,
} from "lucide-react";
import { toast } from "sonner";
import RebillingSettings from "@/components/RebillingSettings";
import { SquareCardForm } from "@/components/SquareCardForm";
import { Switch } from "@/components/ui/switch";
import { Progress } from "@/components/ui/progress";
import { RefreshCw, Zap, Wallet, Lock } from "lucide-react";

// ─────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  }).format(amount);
}

function formatDate(date: string | Date | null): string {
  if (!date) return "—";
  return new Date(date).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatDateTime(date: string | Date | null): string {
  if (!date) return "—";
  return new Date(date).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function statusBadge(status: string) {
  const map: Record<string, { variant: "default" | "secondary" | "destructive" | "outline"; icon: React.ReactNode }> = {
    draft: { variant: "secondary", icon: <FileText className="h-3 w-3" /> },
    sent: { variant: "default", icon: <Send className="h-3 w-3" /> },
    paid: { variant: "outline", icon: <CheckCircle2 className="h-3 w-3 text-emerald-500" /> },
    overdue: { variant: "destructive", icon: <AlertCircle className="h-3 w-3" /> },
    void: { variant: "secondary", icon: <Ban className="h-3 w-3" /> },
  };
  const s = map[status] || { variant: "secondary" as const, icon: null };
  return (
    <Badge variant={s.variant} className="gap-1 capitalize">
      {s.icon}
      {status}
    </Badge>
  );
}

// ─────────────────────────────────────────────
// SQUARE WEB PAYMENTS SDK TYPES
// ─────────────────────────────────────────────

declare global {
  interface Window {
    Square?: {
      payments: (appId: string, locationId: string) => Promise<any>;
    };
  }
}

// ─────────────────────────────────────────────
// PAST DUE BANNER
// ─────────────────────────────────────────────

function PastDueBanner({ overdueCount }: { overdueCount: number }) {
  if (overdueCount <= 0) return null;
  return (
    <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 flex items-start gap-3">
      <ShieldAlert className="h-5 w-5 text-destructive mt-0.5 flex-shrink-0" />
      <div>
        <p className="font-semibold text-destructive">
          {overdueCount} overdue invoice{overdueCount > 1 ? "s" : ""}
        </p>
        <p className="text-sm text-muted-foreground mt-1">
          Please add a payment method and pay outstanding invoices to avoid service interruption.
        </p>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// SQUARE CARD FORM COMPONENT
// ─────────────────────────────────────────────

// SquareCardForm is now imported from @/components/SquareCardForm

// ─────────────────────────────────────────────
// SUB-ACCOUNT BILLING VIEW
// ─────────────────────────────────────────────

function SubAccountBilling({ accountId }: { accountId: number }) {
  const utils = trpc.useUtils();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [billingEmail, setBillingEmail] = useState("");
  const [threshold, setThreshold] = useState("");
  const [addCardOpen, setAddCardOpen] = useState(false);
  const [addFundsOpen, setAddFundsOpen] = useState(false);
  const [addFundsAmount, setAddFundsAmount] = useState<number | null>(null);
  const [addFundsCustom, setAddFundsCustom] = useState("");
  const [rechargeAmountLocal, setRechargeAmountLocal] = useState<number | null>(null);
  const [rechargeAmountCustom, setRechargeAmountCustom] = useState("");
  const [thresholdLocal, setThresholdLocal] = useState<number | null>(null);
  const [thresholdCustom, setThresholdCustom] = useState("");
  const [rechargeEnabledLocal, setRechargeEnabledLocal] = useState<boolean | null>(null);
  const [settingsDirty, setSettingsDirty] = useState(false);

  // Role check: employees get read-only view
  const { data: membership } = trpc.members.myMembership.useQuery(
    { accountId },
    { retry: 1 }
  );
  const { isAdmin } = useAccount();
  const isEmployee = !isAdmin && membership?.role === "employee";
  const canEditBilling = !isEmployee;

  const { data: summary, isLoading: summaryLoading } = trpc.billing.getUsageSummary.useQuery(
    { accountId },
    { retry: 1 }
  );

  const { data: billingStatus } = trpc.billing.getBillingStatus.useQuery(
    { accountId },
    { retry: 1 }
  );

  const { data: paymentMethodsList } = trpc.billing.getPaymentMethods.useQuery(
    { accountId },
    { retry: 1 }
  );

  const { data: invoiceData, isLoading: invoicesLoading } = trpc.billing.getInvoices.useQuery(
    { accountId, limit: 20, offset: 0 },
    { retry: 1 }
  );

  const { data: recentEvents } = trpc.billing.getUsageEvents.useQuery(
    { accountId, limit: 10 },
    { retry: 1 }
  );

  const { data: autoRecharge } = trpc.billing.getAutoRechargeSettings.useQuery(
    { accountId },
    { retry: 1 }
  );

  const updateAutoRecharge = trpc.billing.updateAutoRechargeSettings.useMutation({
    onSuccess: () => {
      toast.success("Auto-recharge settings saved");
      setSettingsDirty(false);
      utils.billing.getAutoRechargeSettings.invalidate();
      utils.billing.getBalancePill.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  const addFundsMut = trpc.billing.addFunds.useMutation({
    onSuccess: (data) => {
      toast.success(`Added ${formatCurrency(addFundsResolvedCents / 100)} to your balance`);
      setAddFundsOpen(false);
      setAddFundsAmount(null);
      setAddFundsCustom("");
      utils.billing.getUsageSummary.invalidate();
      utils.billing.getBalancePill.invalidate();
      utils.billing.getAutoRechargeSettings.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  // Sync local state from server data
  useEffect(() => {
    if (autoRecharge && rechargeAmountLocal === null) {
      const serverCents = autoRecharge.autoRechargeAmountCents;
      const AMOUNT_PRESETS_CENTS = [1000, 2500, 5000, 10000, 25000, 50000];
      if (AMOUNT_PRESETS_CENTS.includes(serverCents)) {
        setRechargeAmountLocal(serverCents);
      } else {
        setRechargeAmountLocal(-1); // custom
        setRechargeAmountCustom(String(serverCents / 100));
      }
    }
    if (autoRecharge && thresholdLocal === null) {
      const serverThreshold = autoRecharge.autoRechargeThreshold;
      const THRESHOLD_PRESETS = [1, 5, 10, 25, 50];
      if (THRESHOLD_PRESETS.includes(serverThreshold)) {
        setThresholdLocal(serverThreshold);
      } else {
        setThresholdLocal(-1); // custom
        setThresholdCustom(String(serverThreshold));
      }
    }
    if (autoRecharge && rechargeEnabledLocal === null) {
      setRechargeEnabledLocal(autoRecharge.autoRechargeEnabled);
    }
  }, [autoRecharge, rechargeAmountLocal, thresholdLocal, rechargeEnabledLocal]);

  // Resolve add funds amount
  const addFundsResolvedCents = addFundsAmount === -1
    ? Math.round(Number(addFundsCustom) * 100)
    : (addFundsAmount ?? 0);
  const addFundsValid = addFundsResolvedCents >= 500 && addFundsResolvedCents <= 100000;

  const chargeInvoiceMut = trpc.billing.chargeInvoice.useMutation({
    onSuccess: (data) => {
      toast.success("Payment successful!");
      utils.billing.getInvoices.invalidate();
      utils.billing.getBillingStatus.invalidate();
      utils.billing.getUsageSummary.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  const payInvoice = trpc.billing.payInvoice.useMutation({
    onSuccess: (data) => {
      if (data.paymentLinkUrl) {
        window.open(data.paymentLinkUrl, "_blank");
        toast.success("Payment link opened in new tab");
      }
      utils.billing.getInvoices.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  const removePaymentMethodMut = trpc.billing.removePaymentMethod.useMutation({
    onSuccess: () => {
      toast.success("Card removed");
      utils.billing.getPaymentMethods.invalidate();
      utils.billing.getBillingStatus.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  const setDefaultMut = trpc.billing.setDefaultPaymentMethod.useMutation({
    onSuccess: () => {
      toast.success("Default card updated");
      utils.billing.getPaymentMethods.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  const updateSettings = trpc.billing.updateBillingSettings.useMutation({
    onSuccess: () => {
      toast.success("Billing settings updated");
      setSettingsOpen(false);
      utils.billing.getUsageSummary.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  const handleCardAdded = useCallback(() => {
    setAddCardOpen(false);
    utils.billing.getPaymentMethods.invalidate();
    utils.billing.getBillingStatus.invalidate();
  }, [utils]);

  if (summaryLoading) {
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const hasCards = (paymentMethodsList?.length || 0) > 0;

  return (
    <div className="space-y-6">
      {/* Past Due Banner */}
      {billingStatus?.billingPastDue && (
        <PastDueBanner overdueCount={billingStatus.overdueCount} />
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Billing & Usage</h1>
          <p className="text-muted-foreground">Track your usage, manage payment methods, and view invoices</p>
        </div>
        <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
          <DialogTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setBillingEmail(summary?.billingEmail || "");
                setThreshold(String(summary?.autoInvoiceThreshold || 50));
              }}
            >
              <Settings2 className="h-4 w-4 mr-2" />
              Billing Settings
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Billing Settings</DialogTitle>
              <DialogDescription>
                Configure your billing email and auto-invoice threshold.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Billing Email</Label>
                <Input
                  type="email"
                  value={billingEmail}
                  onChange={(e) => setBillingEmail(e.target.value)}
                  placeholder="billing@company.com"
                />
              </div>
              <div className="space-y-2">
                <Label>Auto-Invoice Threshold ($)</Label>
                <Input
                  type="number"
                  value={threshold}
                  onChange={(e) => setThreshold(e.target.value)}
                  min={0}
                  step={5}
                />
                <p className="text-xs text-muted-foreground">
                  An invoice will be automatically generated when your balance reaches this amount.
                </p>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setSettingsOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={() =>
                  updateSettings.mutate({
                    accountId,
                    billingEmail: billingEmail || undefined,
                    autoInvoiceThreshold: Number(threshold) || undefined,
                  })
                }
                disabled={updateSettings.isPending}
              >
                {updateSettings.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Save
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Current Balance</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(summary?.currentBalance || 0)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Auto-invoice at {formatCurrency(summary?.autoInvoiceThreshold || 50)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Billing Rate</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary?.rateName || "Standard"}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {summary?.rates
                ? `SMS: ${formatCurrency(summary.rates.sms)} · Email: ${formatCurrency(summary.rates.email)}`
                : "Default rates applied"}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Payment Method</CardTitle>
            <CreditCard className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {hasCards ? `${paymentMethodsList!.length} card${paymentMethodsList!.length > 1 ? "s" : ""}` : "None"}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {hasCards
                ? "Card on file — invoices auto-charged"
                : "Add a card to enable auto-pay"}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Real-time Usage Meter */}
      {summary && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base">Balance Meter</CardTitle>
                <CardDescription>Current balance relative to auto-invoice threshold</CardDescription>
              </div>
              <Badge
                variant={(() => {
                  const pct = ((summary.currentBalance || 0) / (summary.autoInvoiceThreshold || 50)) * 100;
                  if (pct >= 80) return "destructive";
                  if (pct >= 50) return "secondary";
                  return "outline";
                })()}
                className="gap-1"
              >
                <TrendingUp className="h-3 w-3" />
                {Math.round(((summary.currentBalance || 0) / (summary.autoInvoiceThreshold || 50)) * 100)}% of threshold
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <Progress
                value={Math.min(((summary.currentBalance || 0) / (summary.autoInvoiceThreshold || 50)) * 100, 100)}
                className="h-3"
              />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>{formatCurrency(0)}</span>
                <span>Threshold: {formatCurrency(summary.autoInvoiceThreshold || 50)}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Auto-Recharge & Add Funds */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Zap className="h-4 w-4 text-amber-500" />
                Auto-Recharge & Funds
              </CardTitle>
              <CardDescription>
                {canEditBilling
                  ? "Manage automatic top-ups and manually add funds"
                  : "View auto-recharge settings (contact an owner or manager to change)"}
              </CardDescription>
            </div>
            {isEmployee && (
              <Badge variant="secondary" className="gap-1">
                <Lock className="h-3 w-3" />
                Read-only
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Toggle */}
          <div className="flex items-center justify-between">
            <div>
              <Label className="text-sm font-medium">Auto-Recharge</Label>
              <p className="text-xs text-muted-foreground mt-0.5">
                Automatically top up when balance drops below threshold
              </p>
            </div>
            <Switch
              checked={rechargeEnabledLocal ?? autoRecharge?.autoRechargeEnabled ?? false}
              onCheckedChange={(checked) => {
                setRechargeEnabledLocal(checked);
                setSettingsDirty(true);
              }}
              disabled={!canEditBilling || updateAutoRecharge.isPending}
            />
          </div>

          {/* Recharge Amount Presets */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Recharge Amount</Label>
            <div className="flex flex-wrap gap-2">
              {[1000, 2500, 5000, 10000, 25000, 50000].map((cents) => (
                <Button
                  key={cents}
                  type="button"
                  size="sm"
                  variant={rechargeAmountLocal === cents ? "default" : "outline"}
                  className={cn(
                    "min-w-[70px]",
                    rechargeAmountLocal === cents && "ring-2 ring-primary/30"
                  )}
                  disabled={!canEditBilling}
                  onClick={() => {
                    setRechargeAmountLocal(cents);
                    setRechargeAmountCustom("");
                    setSettingsDirty(true);
                  }}
                >
                  ${cents / 100}
                </Button>
              ))}
              <Button
                type="button"
                size="sm"
                variant={rechargeAmountLocal === -1 ? "default" : "outline"}
                disabled={!canEditBilling}
                onClick={() => {
                  setRechargeAmountLocal(-1);
                  setSettingsDirty(true);
                }}
              >
                Custom
              </Button>
            </div>
            {rechargeAmountLocal === -1 && (
              <div className="flex items-center gap-2 mt-2">
                <span className="text-sm text-muted-foreground">$</span>
                <Input
                  type="number"
                  min={5}
                  max={1000}
                  step={1}
                  value={rechargeAmountCustom}
                  onChange={(e) => {
                    setRechargeAmountCustom(e.target.value);
                    setSettingsDirty(true);
                  }}
                  placeholder="5 - 1000"
                  className="w-32"
                  disabled={!canEditBilling}
                />
              </div>
            )}
            <p className="text-xs text-muted-foreground">
              Amount charged to your default card each recharge
            </p>
          </div>

          {/* Threshold Presets */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Trigger When Balance Below</Label>
            <div className="flex flex-wrap gap-2">
              {[1, 5, 10, 25, 50].map((val) => (
                <Button
                  key={val}
                  type="button"
                  size="sm"
                  variant={thresholdLocal === val ? "default" : "outline"}
                  className={cn(
                    "min-w-[60px]",
                    thresholdLocal === val && "ring-2 ring-primary/30"
                  )}
                  disabled={!canEditBilling}
                  onClick={() => {
                    setThresholdLocal(val);
                    setThresholdCustom("");
                    setSettingsDirty(true);
                  }}
                >
                  ${val}
                </Button>
              ))}
              <Button
                type="button"
                size="sm"
                variant={thresholdLocal === -1 ? "default" : "outline"}
                disabled={!canEditBilling}
                onClick={() => {
                  setThresholdLocal(-1);
                  setSettingsDirty(true);
                }}
              >
                Custom
              </Button>
            </div>
            {thresholdLocal === -1 && (
              <div className="flex items-center gap-2 mt-2">
                <span className="text-sm text-muted-foreground">$</span>
                <Input
                  type="number"
                  min={1}
                  max={500}
                  step={1}
                  value={thresholdCustom}
                  onChange={(e) => {
                    setThresholdCustom(e.target.value);
                    setSettingsDirty(true);
                  }}
                  placeholder="1 - 500"
                  className="w-32"
                  disabled={!canEditBilling}
                />
              </div>
            )}
            <p className="text-xs text-muted-foreground">
              Auto-recharge triggers when balance drops below this amount
            </p>
          </div>

          {/* Recharge attempts today */}
          {(autoRecharge?.rechargeAttemptsToday ?? 0) > 0 && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <RefreshCw className="h-3 w-3" />
              {autoRecharge!.rechargeAttemptsToday} recharge attempt{autoRecharge!.rechargeAttemptsToday !== 1 ? "s" : ""} today
              {autoRecharge!.rechargeAttemptsToday >= 3 && (
                <Badge variant="destructive" className="text-[10px] ml-1">Limit reached</Badge>
              )}
            </div>
          )}

          {/* Action buttons */}
          <div className="flex flex-wrap gap-3 pt-2 border-t">
            <Button
              onClick={() => {
                const resolvedAmountCents = rechargeAmountLocal === -1
                  ? Math.round(Number(rechargeAmountCustom) * 100)
                  : (rechargeAmountLocal ?? 1000);
                const resolvedThreshold = thresholdLocal === -1
                  ? Number(thresholdCustom)
                  : (thresholdLocal ?? 10);
                updateAutoRecharge.mutate({
                  accountId,
                  autoRechargeEnabled: rechargeEnabledLocal ?? false,
                  autoRechargeAmountCents: resolvedAmountCents,
                  autoRechargeThreshold: resolvedThreshold,
                });
              }}
              disabled={!canEditBilling || !settingsDirty || updateAutoRecharge.isPending}
            >
              {updateAutoRecharge.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Save Settings
            </Button>
            {hasCards && (
              <Button
                variant="outline"
                onClick={() => setAddFundsOpen(true)}
                disabled={!canEditBilling}
              >
                <Wallet className="h-4 w-4 mr-2" />
                Add Funds
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Add Funds Modal */}
      <Dialog open={addFundsOpen} onOpenChange={setAddFundsOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Wallet className="h-5 w-5" />
              Add Funds
            </DialogTitle>
            <DialogDescription>
              Charge your card on file to top up your balance immediately.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <Label className="text-sm font-medium">Select Amount</Label>
            <div className="grid grid-cols-3 gap-2">
              {[1000, 2500, 5000, 10000, 25000, 50000].map((cents) => (
                <Button
                  key={cents}
                  type="button"
                  variant={addFundsAmount === cents ? "default" : "outline"}
                  className={cn(
                    addFundsAmount === cents && "ring-2 ring-primary/30"
                  )}
                  onClick={() => {
                    setAddFundsAmount(cents);
                    setAddFundsCustom("");
                  }}
                >
                  ${cents / 100}
                </Button>
              ))}
            </div>
            <div className="space-y-2">
              <Label className="text-sm">Or enter custom amount</Label>
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">$</span>
                <Input
                  type="number"
                  min={5}
                  max={1000}
                  step={1}
                  value={addFundsCustom}
                  onChange={(e) => {
                    setAddFundsCustom(e.target.value);
                    setAddFundsAmount(-1);
                  }}
                  placeholder="5 - 1000"
                  className="w-40"
                />
              </div>
            </div>
            {addFundsResolvedCents > 0 && (
              <div className="rounded-lg border bg-muted/50 p-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Amount to charge:</span>
                  <span className="font-semibold">{formatCurrency(addFundsResolvedCents / 100)}</span>
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddFundsOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => addFundsMut.mutate({ accountId, amountCents: addFundsResolvedCents })}
              disabled={!addFundsValid || addFundsMut.isPending}
            >
              {addFundsMut.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Add {addFundsValid ? formatCurrency(addFundsResolvedCents / 100) : "Funds"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Payment Methods */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Payment Methods</CardTitle>
              <CardDescription>Manage your cards on file for automatic payments</CardDescription>
            </div>
            {!addCardOpen && (
              <Button size="sm" onClick={() => setAddCardOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Add Card
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {addCardOpen ? (
            <SquareCardForm
              accountId={accountId}
              onSuccess={handleCardAdded}
              onCancel={() => setAddCardOpen(false)}
            />
          ) : !paymentMethodsList?.length ? (
            <div className="text-center py-8 text-muted-foreground">
              <CreditCard className="h-10 w-10 mx-auto mb-2 opacity-50" />
              <p>No payment methods on file.</p>
              <p className="text-sm mt-1">Add a card to enable automatic invoice payments.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {paymentMethodsList.map((pm) => (
                <div
                  key={pm.id}
                  className="flex items-center justify-between p-3 rounded-lg border bg-card"
                >
                  <div className="flex items-center gap-3">
                    <CreditCard className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">
                          {pm.brand} ****{pm.last4}
                        </span>
                        {pm.isDefault && (
                          <Badge variant="secondary" className="text-xs gap-1">
                            <Star className="h-3 w-3" />
                            Default
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Expires {String(pm.expMonth).padStart(2, "0")}/{pm.expYear}
                        {pm.cardholderName ? ` · ${pm.cardholderName}` : ""}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    {!pm.isDefault && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() =>
                          setDefaultMut.mutate({
                            paymentMethodId: pm.id,
                            accountId,
                          })
                        }
                        disabled={setDefaultMut.isPending}
                      >
                        Set Default
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-destructive hover:text-destructive"
                      onClick={() =>
                        removePaymentMethodMut.mutate({
                          paymentMethodId: pm.id,
                          accountId,
                        })
                      }
                      disabled={removePaymentMethodMut.isPending}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Usage Breakdown */}
      {summary?.breakdown && summary.breakdown.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Current Usage Breakdown</CardTitle>
            <CardDescription>Unbilled usage for the current period</CardDescription>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <Table className="min-w-[500px]">
              <TableHeader>
                <TableRow>
                  <TableHead>Service</TableHead>
                  <TableHead className="text-right">Quantity</TableHead>
                  <TableHead className="text-right">Events</TableHead>
                  <TableHead className="text-right">Cost</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {summary.breakdown.map((item) => (
                  <TableRow key={item.eventType}>
                    <TableCell className="font-medium">{item.label}</TableCell>
                    <TableCell className="text-right">{item.quantity.toFixed(2)}</TableCell>
                    <TableCell className="text-right">{item.count}</TableCell>
                    <TableCell className="text-right">{formatCurrency(item.cost)}</TableCell>
                  </TableRow>
                ))}
                <TableRow className="font-bold">
                  <TableCell>Total</TableCell>
                  <TableCell />
                  <TableCell />
                  <TableCell className="text-right">
                    {formatCurrency(summary.breakdown.reduce((s, i) => s + i.cost, 0))}
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Invoices */}
      <Card>
        <CardHeader>
          <CardTitle>Invoices</CardTitle>
          <CardDescription>
            {invoiceData?.total
              ? `${invoiceData.total} invoice${invoiceData.total !== 1 ? "s" : ""}`
              : "No invoices yet"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {invoicesLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : !invoiceData?.invoices.length ? (
            <div className="text-center py-8 text-muted-foreground">
              <Receipt className="h-10 w-10 mx-auto mb-2 opacity-50" />
              <p>No invoices yet. Invoices are generated automatically when your usage reaches the threshold.</p>
            </div>
          ) : (
            <Table className="min-w-[500px]">
              <TableHeader>
                <TableRow>
                  <TableHead>Invoice #</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Due Date</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invoiceData.invoices.map((inv) => (
                  <TableRow key={inv.id}>
                    <TableCell className="font-mono text-sm">{inv.invoiceNumber}</TableCell>
                    <TableCell>{formatDate(inv.createdAt)}</TableCell>
                    <TableCell>{formatDate(inv.dueDate)}</TableCell>
                    <TableCell className="font-medium">{formatCurrency(inv.amount)}</TableCell>
                    <TableCell>{statusBadge(inv.status)}</TableCell>
                    <TableCell className="text-right">
                      {(inv.status === "sent" || inv.status === "overdue") && hasCards ? (
                        <Button
                          size="sm"
                          onClick={() => chargeInvoiceMut.mutate({ invoiceId: inv.id })}
                          disabled={chargeInvoiceMut.isPending}
                        >
                          {chargeInvoiceMut.isPending ? (
                            <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                          ) : (
                            <CreditCard className="h-3 w-3 mr-1" />
                          )}
                          Pay Now
                        </Button>
                      ) : (inv.status === "sent" || inv.status === "overdue") && inv.squarePaymentLinkUrl ? (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => window.open(inv.squarePaymentLinkUrl!, "_blank")}
                        >
                          <ExternalLink className="h-3 w-3 mr-1" />
                          Pay via Link
                        </Button>
                      ) : (inv.status === "sent" || inv.status === "overdue") ? (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => payInvoice.mutate({ invoiceId: inv.id })}
                          disabled={payInvoice.isPending}
                        >
                          {payInvoice.isPending ? (
                            <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                          ) : (
                            <ExternalLink className="h-3 w-3 mr-1" />
                          )}
                          Get Payment Link
                        </Button>
                      ) : null}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Recent Activity */}
      {recentEvents && recentEvents.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
            <CardDescription>Last 10 billable events</CardDescription>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <Table className="min-w-[500px]">
              <TableHeader>
                <TableRow>
                  <TableHead>Event</TableHead>
                  <TableHead>Quantity</TableHead>
                  <TableHead>Unit Cost</TableHead>
                  <TableHead>Total</TableHead>
                  <TableHead>Time</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recentEvents.map((event) => (
                  <TableRow key={event.id}>
                    <TableCell>{event.label}</TableCell>
                    <TableCell>{event.quantity.toFixed(2)}</TableCell>
                    <TableCell>{formatCurrency(event.unitCost)}</TableCell>
                    <TableCell>{formatCurrency(event.totalCost)}</TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {formatDateTime(event.createdAt)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────
// AGENCY ADMIN BILLING VIEW
// ─────────────────────────────────────────────

function AgencyBilling() {
  const utils = trpc.useUtils();
  const [rateDialogOpen, setRateDialogOpen] = useState(false);
  const [invoiceDialogOpen, setInvoiceDialogOpen] = useState(false);
  const [selectedAccountId, setSelectedAccountId] = useState<number | null>(null);
  const [invoiceFilter, setInvoiceFilter] = useState<string>("all");
  const [rebillingDialogOpen, setRebillingDialogOpen] = useState(false);
  const [rebillingAccountId, setRebillingAccountId] = useState<number | null>(null);
  const [rebillingAccountName, setRebillingAccountName] = useState<string>("");

  // Rate form state
  const [rateName, setRateName] = useState("Standard");
  const [rateId, setRateId] = useState<number | undefined>(undefined);
  const [smsCost, setSmsCost] = useState("0.015");
  const [emailCost, setEmailCost] = useState("0.003");
  const [aiCallCost, setAiCallCost] = useState("0.12");
  const [voiceCallCost, setVoiceCallCost] = useState("0.05");
  const [llmCost, setLlmCost] = useState("0.008");
  const [dialerCost, setDialerCost] = useState("0.025");

  const { data: overview, isLoading: overviewLoading } = trpc.billing.getAgencyOverview.useQuery(
    undefined,
    { retry: 1 }
  );

  const { data: rates } = trpc.billing.getBillingRates.useQuery(undefined, { retry: 1 });

  const { data: allInvoices } = trpc.billing.getAllInvoices.useQuery(
    {
      limit: 50,
      offset: 0,
      status: invoiceFilter === "all" ? undefined : (invoiceFilter as any),
    },
    { retry: 1 }
  );

  const upsertRate = trpc.billing.upsertBillingRate.useMutation({
    onSuccess: () => {
      toast.success("Billing rate saved");
      setRateDialogOpen(false);
      utils.billing.getBillingRates.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  const generateInvoice = trpc.billing.generateAndSendInvoice.useMutation({
    onSuccess: (data) => {
      toast.success(`Invoice #${data.invoiceId} generated — ${formatCurrency(data.amount)}`);
      setInvoiceDialogOpen(false);
      utils.billing.getAgencyOverview.invalidate();
      utils.billing.getAllInvoices.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  const markPaid = trpc.billing.markPaid.useMutation({
    onSuccess: () => {
      toast.success("Invoice marked as paid");
      utils.billing.getAllInvoices.invalidate();
      utils.billing.getAgencyOverview.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  const voidInv = trpc.billing.voidInvoice.useMutation({
    onSuccess: () => {
      toast.success("Invoice voided");
      utils.billing.getAllInvoices.invalidate();
      utils.billing.getAgencyOverview.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  const assignRate = trpc.billing.assignBillingRate.useMutation({
    onSuccess: () => {
      toast.success("Billing rate assigned");
      utils.billing.getAgencyOverview.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  function openRateEditor(rate?: typeof rates extends (infer T)[] | undefined ? T : never) {
    if (rate) {
      setRateId(rate.id);
      setRateName(rate.name);
      setSmsCost(String(rate.smsCostPerUnit));
      setEmailCost(String(rate.emailCostPerUnit));
      setAiCallCost(String(rate.aiCallCostPerMinute));
      setVoiceCallCost(String(rate.voiceCallCostPerMinute));
      setLlmCost(String(rate.llmCostPerRequest));
      setDialerCost(String(rate.powerDialerCostPerCall));
    } else {
      setRateId(undefined);
      setRateName("");
      setSmsCost("0.015");
      setEmailCost("0.003");
      setAiCallCost("0.12");
      setVoiceCallCost("0.05");
      setLlmCost("0.008");
      setDialerCost("0.025");
    }
    setRateDialogOpen(true);
  }

  if (overviewLoading) {
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const totals = overview?.totals;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Agency Billing</h1>
          <p className="text-muted-foreground">
            Manage billing rates, invoices, and payments across all sub-accounts
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => openRateEditor()}>
            <Settings2 className="h-4 w-4 mr-2" />
            New Rate
          </Button>
        </div>
      </div>

      {/* Totals Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Unbilled</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-600">
              {formatCurrency(totals?.totalUnbilledBalance || 0)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Across {totals?.totalAccounts || 0} accounts
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Invoiced</CardTitle>
            <Receipt className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(totals?.totalInvoiced || 0)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Paid</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-600">
              {formatCurrency(totals?.totalPaid || 0)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Outstanding</CardTitle>
            <AlertCircle className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">
              {formatCurrency(totals?.totalOutstanding || 0)}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Billing Rates */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Billing Rates</CardTitle>
              <CardDescription>Configure pricing tiers for sub-accounts</CardDescription>
            </div>
            <Button size="sm" variant="outline" onClick={() => openRateEditor()}>
              Add Rate
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {!rates?.length ? (
            <p className="text-muted-foreground text-center py-4">No billing rates configured</p>
          ) : (
            <Table className="min-w-[500px]">
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead className="text-right">SMS</TableHead>
                  <TableHead className="text-right">Email</TableHead>
                  <TableHead className="text-right">AI Call/min</TableHead>
                  <TableHead className="text-right">Voice/min</TableHead>
                  <TableHead className="text-right">LLM Req</TableHead>
                  <TableHead className="text-right">Dialer</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rates.map((rate) => (
                  <TableRow key={rate.id}>
                    <TableCell className="font-medium">
                      {rate.name}
                      {rate.isDefault && (
                        <Badge variant="secondary" className="ml-2 text-xs">Default</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">${rate.smsCostPerUnit.toFixed(4)}</TableCell>
                    <TableCell className="text-right">${rate.emailCostPerUnit.toFixed(4)}</TableCell>
                    <TableCell className="text-right">${rate.aiCallCostPerMinute.toFixed(4)}</TableCell>
                    <TableCell className="text-right">${rate.voiceCallCostPerMinute.toFixed(4)}</TableCell>
                    <TableCell className="text-right">${rate.llmCostPerRequest.toFixed(4)}</TableCell>
                    <TableCell className="text-right">${rate.powerDialerCostPerCall.toFixed(4)}</TableCell>
                    <TableCell className="text-right">
                      <Button size="sm" variant="ghost" onClick={() => openRateEditor(rate)}>
                        Edit
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Sub-Account Billing Overview */}
      <Card>
        <CardHeader>
          <CardTitle>Sub-Account Balances</CardTitle>
          <CardDescription>Current unbilled balance per sub-account</CardDescription>
        </CardHeader>
        <CardContent>
          {!overview?.accounts.length ? (
            <p className="text-muted-foreground text-center py-4">No sub-accounts found</p>
          ) : (
            <Table className="min-w-[500px]">
              <TableHeader>
                <TableRow>
                  <TableHead>Account</TableHead>
                  <TableHead className="text-right">Unbilled</TableHead>
                  <TableHead className="text-right">Total Invoiced</TableHead>
                  <TableHead className="text-right">Paid</TableHead>
                  <TableHead className="text-right">Outstanding</TableHead>
                  <TableHead>Rate</TableHead>
                  <TableHead className="text-center">Markup</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {overview.accounts.map((acct) => (
                  <TableRow key={acct.accountId}>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        <Building2 className="h-4 w-4 text-muted-foreground" />
                        {acct.accountName}
                      </div>
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {formatCurrency(acct.currentBalance)}
                    </TableCell>
                    <TableCell className="text-right">{formatCurrency(acct.totalInvoiced)}</TableCell>
                    <TableCell className="text-right text-emerald-600">
                      {formatCurrency(acct.totalPaid)}
                    </TableCell>
                    <TableCell className="text-right text-destructive">
                      {formatCurrency(acct.totalOutstanding)}
                    </TableCell>
                    <TableCell>
                      <Select
                        value={String(acct.billingRateId || "")}
                        onValueChange={(val) =>
                          assignRate.mutate({
                            accountId: acct.accountId,
                            billingRateId: parseInt(val),
                          })
                        }
                      >
                        <SelectTrigger className="w-[130px] h-8">
                          <SelectValue placeholder="Assign rate" />
                        </SelectTrigger>
                        <SelectContent>
                          {rates?.map((r) => (
                            <SelectItem key={r.id} value={String(r.id)}>
                              {r.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell className="text-center">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setRebillingAccountId(acct.accountId);
                          setRebillingAccountName(acct.accountName);
                          setRebillingDialogOpen(true);
                        }}
                      >
                        <Settings2 className="h-3 w-3 mr-1" />
                        Configure
                      </Button>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={acct.currentBalance <= 0}
                        onClick={() => {
                          setSelectedAccountId(acct.accountId);
                          setInvoiceDialogOpen(true);
                        }}
                      >
                        <Receipt className="h-3 w-3 mr-1" />
                        Invoice
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* All Invoices */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>All Invoices</CardTitle>
              <CardDescription>Invoices across all sub-accounts</CardDescription>
            </div>
            <Select value={invoiceFilter} onValueChange={setInvoiceFilter}>
              <SelectTrigger className="w-[140px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="sent">Sent</SelectItem>
                <SelectItem value="paid">Paid</SelectItem>
                <SelectItem value="overdue">Overdue</SelectItem>
                <SelectItem value="void">Void</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {!allInvoices?.length ? (
            <div className="text-center py-8 text-muted-foreground">
              <Receipt className="h-10 w-10 mx-auto mb-2 opacity-50" />
              <p>No invoices found</p>
            </div>
          ) : (
            <Table className="min-w-[500px]">
              <TableHeader>
                <TableRow>
                  <TableHead>Invoice #</TableHead>
                  <TableHead>Account</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Due</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {allInvoices.map((inv) => (
                  <TableRow key={inv.id}>
                    <TableCell className="font-mono text-sm">{inv.invoiceNumber}</TableCell>
                    <TableCell>{inv.accountName}</TableCell>
                    <TableCell>{formatDate(inv.createdAt)}</TableCell>
                    <TableCell>{formatDate(inv.dueDate)}</TableCell>
                    <TableCell className="font-medium">{formatCurrency(inv.amount)}</TableCell>
                    <TableCell>{statusBadge(inv.status)}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex gap-1 justify-end">
                        {(inv.status === "sent" || inv.status === "overdue") && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => markPaid.mutate({ invoiceId: inv.id })}
                            disabled={markPaid.isPending}
                          >
                            <CheckCircle2 className="h-3 w-3 mr-1" />
                            Mark Paid
                          </Button>
                        )}
                        {inv.status !== "paid" && inv.status !== "void" && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-destructive"
                            onClick={() => voidInv.mutate({ invoiceId: inv.id })}
                            disabled={voidInv.isPending}
                          >
                            <Ban className="h-3 w-3 mr-1" />
                            Void
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Rate Editor Dialog */}
      <Dialog open={rateDialogOpen} onOpenChange={setRateDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{rateId ? "Edit" : "New"} Billing Rate</DialogTitle>
            <DialogDescription>
              Set per-unit pricing for each billable service.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-4">
            <div className="space-y-1">
              <Label>Rate Name</Label>
              <Input value={rateName} onChange={(e) => setRateName(e.target.value)} placeholder="e.g. Premium" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">SMS (per msg)</Label>
                <Input type="number" step="0.001" value={smsCost} onChange={(e) => setSmsCost(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Email (per msg)</Label>
                <Input type="number" step="0.001" value={emailCost} onChange={(e) => setEmailCost(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">AI Call (per min)</Label>
                <Input type="number" step="0.001" value={aiCallCost} onChange={(e) => setAiCallCost(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Voice Call (per min)</Label>
                <Input type="number" step="0.001" value={voiceCallCost} onChange={(e) => setVoiceCallCost(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">LLM Request</Label>
                <Input type="number" step="0.001" value={llmCost} onChange={(e) => setLlmCost(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Power Dialer (per call)</Label>
                <Input type="number" step="0.001" value={dialerCost} onChange={(e) => setDialerCost(e.target.value)} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRateDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() =>
                upsertRate.mutate({
                  id: rateId,
                  name: rateName,
                  smsCostPerUnit: Number(smsCost),
                  emailCostPerUnit: Number(emailCost),
                  aiCallCostPerMinute: Number(aiCallCost),
                  voiceCallCostPerMinute: Number(voiceCallCost),
                  llmCostPerRequest: Number(llmCost),
                  powerDialerCostPerCall: Number(dialerCost),
                })
              }
              disabled={upsertRate.isPending || !rateName}
            >
              {upsertRate.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {rateId ? "Update" : "Create"} Rate
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Generate Invoice Dialog */}
      <Dialog open={invoiceDialogOpen} onOpenChange={setInvoiceDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Generate Invoice</DialogTitle>
            <DialogDescription>
              This will gather all unbilled usage events for the selected account and create an invoice.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <p className="text-sm">
              Account:{" "}
              <span className="font-medium">
                {overview?.accounts.find((a) => a.accountId === selectedAccountId)?.accountName || "—"}
              </span>
            </p>
            <p className="text-sm mt-1">
              Current balance:{" "}
              <span className="font-medium">
                {formatCurrency(
                  overview?.accounts.find((a) => a.accountId === selectedAccountId)?.currentBalance || 0
                )}
              </span>
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setInvoiceDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="outline"
              onClick={() =>
                selectedAccountId &&
                generateInvoice.mutate({ accountId: selectedAccountId, sendImmediately: false })
              }
              disabled={generateInvoice.isPending}
            >
              {generateInvoice.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Generate Draft
            </Button>
            <Button
              onClick={() =>
                selectedAccountId &&
                generateInvoice.mutate({ accountId: selectedAccountId, sendImmediately: true })
              }
              disabled={generateInvoice.isPending}
            >
              {generateInvoice.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Generate & Send
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Rebilling Settings Dialog */}
      <Dialog open={rebillingDialogOpen} onOpenChange={setRebillingDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Rebilling Settings</DialogTitle>
            <DialogDescription>
              Configure markup multipliers for {rebillingAccountName || "this account"}
            </DialogDescription>
          </DialogHeader>
          {rebillingAccountId && (
            <RebillingSettings
              accountId={rebillingAccountId}
              accountName={rebillingAccountName}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─────────────────────────────────────────────
// MAIN BILLING PAGE
// ─────────────────────────────────────────────

export default function Billing() {
  const { isAdmin, isAgencyScope, currentAccountId } = useAccount();

  // Agency admin in agency scope → show agency billing overview
  if (isAdmin && isAgencyScope) {
    return <AgencyBilling />;
  }

  // Sub-account selected → show sub-account billing
  if (currentAccountId) {
    return <SubAccountBilling accountId={currentAccountId} />;
  }

  // Fallback
  return (
    <div className="flex items-center justify-center min-h-[40vh]">
      <div className="text-center text-muted-foreground">
        <CreditCard className="h-10 w-10 mx-auto mb-2 opacity-50" />
        <p>Select a sub-account to view billing, or switch to Agency Overview.</p>
      </div>
    </div>
  );
}
