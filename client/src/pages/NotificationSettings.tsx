import React, { useState, useEffect, useCallback } from "react";
import { trpc } from "@/lib/trpc";
import { useAccount } from "@/contexts/AccountContext";
import { usePushNotifications } from "@/hooks/usePushNotifications";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Bell,
  BellOff,
  MessageSquare,
  Mail,
  CalendarCheck,
  Phone,
  Facebook,
  Moon,
  ArrowLeft,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Smartphone,
  Shield,
  Save,
} from "lucide-react";
import { useLocation } from "wouter";
import { toast } from "sonner";
import { useAuth } from "@/_core/hooks/useAuth";
import { Key, Zap, Copy, Eye, EyeOff, Trash2 } from "lucide-react";

// Event type configuration
const EVENT_TYPES = [
  {
    key: "inbound_sms" as const,
    label: "Inbound SMS",
    description: "New text messages from contacts",
    icon: MessageSquare,
    iconColor: "text-green-500",
    bgColor: "bg-green-500/10",
  },
  {
    key: "inbound_email" as const,
    label: "Inbound Email",
    description: "New email replies from contacts",
    icon: Mail,
    iconColor: "text-blue-500",
    bgColor: "bg-blue-500/10",
  },
  {
    key: "appointment_booked" as const,
    label: "Appointment Booked",
    description: "New appointments scheduled via AI or calendar",
    icon: CalendarCheck,
    iconColor: "text-purple-500",
    bgColor: "bg-purple-500/10",
  },
  {
    key: "ai_call_completed" as const,
    label: "AI Call Completed",
    description: "AI voice calls that have ended",
    icon: Phone,
    iconColor: "text-orange-500",
    bgColor: "bg-orange-500/10",
  },
  {
    key: "facebook_lead" as const,
    label: "Facebook Lead",
    description: "New leads from Facebook ad forms",
    icon: Facebook,
    iconColor: "text-indigo-500",
    bgColor: "bg-indigo-500/10",
  },
];

// Common IANA timezones
const TIMEZONES = [
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "America/Phoenix",
  "America/Anchorage",
  "Pacific/Honolulu",
  "America/Toronto",
  "America/Vancouver",
  "Europe/London",
  "Europe/Paris",
  "Europe/Berlin",
  "Asia/Tokyo",
  "Asia/Shanghai",
  "Asia/Kolkata",
  "Australia/Sydney",
  "Pacific/Auckland",
];

type PreferencesState = {
  inbound_sms: boolean;
  inbound_email: boolean;
  appointment_booked: boolean;
  ai_call_completed: boolean;
  facebook_lead: boolean;
  quiet_hours_enabled: boolean;
  quiet_hours_start: string;
  quiet_hours_end: string;
  quiet_hours_timezone: string;
};

const DEFAULT_PREFS: PreferencesState = {
  inbound_sms: true,
  inbound_email: true,
  appointment_booked: true,
  ai_call_completed: true,
  facebook_lead: true,
  quiet_hours_enabled: false,
  quiet_hours_start: "22:00",
  quiet_hours_end: "07:00",
  quiet_hours_timezone: "America/New_York",
};

export default function NotificationSettings() {
  const { currentAccountId, accounts } = useAccount();
  const [, navigate] = useLocation();
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  // For push subscriptions, use currentAccountId if available,
  // otherwise fall back to the first account (admins in agency scope)
  const pushAccountId = currentAccountId ?? accounts?.[0]?.id ?? undefined;
  const {
    isSupported,
    isSubscribed,
    permission,
    subscribe,
    unsubscribe,
    isLoading: pushLoading,
  } = usePushNotifications(pushAccountId);

  const [prefs, setPrefs] = useState<PreferencesState>(DEFAULT_PREFS);
  const [hasChanges, setHasChanges] = useState(false);

  // Fetch current preferences
  const { data: prefsData, isLoading: prefsLoading } = trpc.notifications.getPreferences.useQuery(
    { accountId: currentAccountId! },
    { enabled: !!currentAccountId }
  );

  // Update mutation
  const updatePrefsMutation = trpc.notifications.updatePreferences.useMutation({
    onSuccess: () => {
      toast.success("Notification preferences saved");
      setHasChanges(false);
    },
    onError: (err) => {
      toast.error(err.message || "Failed to save preferences");
    },
  });

  // Sync fetched preferences into local state
  useEffect(() => {
    if (prefsData?.preferences) {
      setPrefs(prefsData.preferences as PreferencesState);
      setHasChanges(false);
    }
  }, [prefsData]);

  const updatePref = useCallback((key: keyof PreferencesState, value: boolean | string) => {
    setPrefs((prev) => ({ ...prev, [key]: value }));
    setHasChanges(true);
  }, []);

  const handleSave = useCallback(() => {
    if (!currentAccountId) return;
    updatePrefsMutation.mutate({
      accountId: currentAccountId,
      preferences: prefs,
    });
  }, [currentAccountId, prefs, updatePrefsMutation]);

  const [justEnabled, setJustEnabled] = useState(false);

  const handleSubscribe = useCallback(async () => {
    if (!pushAccountId) {
      toast.error("No account available. Please select a sub-account first.");
      return;
    }
    try {
      const result = await subscribe();
      if (result) {
        setJustEnabled(true);
        toast.success("Push notifications enabled!");
      } else if (permission === "denied") {
        toast.error("Notifications are blocked. Please enable them in your browser/device settings.");
      } else {
        toast.error("Failed to enable notifications. Check that VAPID keys are configured and you have a sub-account selected.");
      }
    } catch (err: any) {
      console.error("[Push] Subscribe error:", err);
      toast.error(err?.message || "Failed to enable push notifications");
    }
  }, [subscribe, permission, pushAccountId]);

  const handleUnsubscribe = useCallback(async () => {
    const result = await unsubscribe();
    if (result) {
      toast.success("Push notifications disabled");
    }
  }, [unsubscribe]);

  const allEnabled = EVENT_TYPES.every((e) => prefs[e.key]);
  const noneEnabled = EVENT_TYPES.every((e) => !prefs[e.key]);

  const toggleAll = useCallback(
    (enabled: boolean) => {
      setPrefs((prev) => ({
        ...prev,
        inbound_sms: enabled,
        inbound_email: enabled,
        appointment_booked: enabled,
        ai_call_completed: enabled,
        facebook_lead: enabled,
      }));
      setHasChanges(true);
    },
    []
  );

  if (!currentAccountId) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">Please select an account first.</p>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate("/settings")} className="shrink-0">
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-xl font-semibold">Push Notification Settings</h1>
          <p className="text-sm text-muted-foreground">
            Control which events trigger push notifications and set quiet hours.
          </p>
        </div>
      </div>

      {/* Push Subscription Status */}
      <Card className="border-0 card-shadow">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Smartphone className="h-4 w-4 text-muted-foreground" />
            Device Subscription
          </CardTitle>
          <CardDescription className="text-xs">
            Enable push notifications on this device to receive real-time alerts.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!isSupported ? (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription className="text-xs">
                Push notifications are not supported in this browser. Try Chrome, Edge, or Firefox.
              </AlertDescription>
            </Alert>
          ) : permission === "denied" ? (
            <Alert variant="destructive">
              <Shield className="h-4 w-4" />
              <AlertDescription className="text-xs">
                Notifications are blocked by your browser. Open browser settings to allow notifications for this site.
              </AlertDescription>
            </Alert>
          ) : (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {isSubscribed ? (
                  <div className="h-9 w-9 rounded-lg bg-green-500/10 flex items-center justify-center">
                    <Bell className="h-4 w-4 text-green-500" />
                  </div>
                ) : (
                  <div className="h-9 w-9 rounded-lg bg-muted flex items-center justify-center">
                    <BellOff className="h-4 w-4 text-muted-foreground" />
                  </div>
                )}
                <div>
                  <p className="text-sm font-medium">
                    {isSubscribed ? "Notifications Active" : "Notifications Off"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {isSubscribed
                      ? "This device will receive push notifications"
                      : "Enable to receive alerts on this device"}
                  </p>
                </div>
              </div>
              <Button
                variant={isSubscribed ? "outline" : "default"}
                size="sm"
                onClick={isSubscribed ? handleUnsubscribe : handleSubscribe}
                disabled={pushLoading}
              >
                {pushLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : isSubscribed ? (
                  "Disable"
                ) : (
                  "Enable"
                )}
              </Button>
            </div>
          )}

          {isSubscribed && prefsData && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <CheckCircle2 className="h-3 w-3 text-green-500" />
              <span>
                Subscription active
                {prefsData.hasSubscription ? " — preferences synced" : " — using defaults"}
              </span>
            </div>
          )}

          {/* Post-enable confirmation message */}
          {isSubscribed && justEnabled && (
            <Alert className="border-green-200 bg-green-50 dark:bg-green-950/20 dark:border-green-800">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              <AlertDescription className="text-xs text-green-800 dark:text-green-300 space-y-2">
                <p className="font-medium">You're all set! Push notifications are now active on this device.</p>
                <p>
                  You can manage your notification preferences anytime by returning to{" "}
                  <strong>Settings → Notifications</strong>. From here you can:
                </p>
                <ul className="list-disc list-inside space-y-0.5 ml-1">
                  <li>Choose which events trigger notifications (SMS, email, leads, etc.)</li>
                  <li>Set quiet hours to pause alerts during off-hours</li>
                  <li>Disable notifications on this device at any time</li>
                </ul>
                <Button
                  variant="ghost"
                  size="sm"
                  className="mt-1 h-6 text-xs text-green-700 dark:text-green-400 hover:text-green-900 px-0"
                  onClick={() => setJustEnabled(false)}
                >
                  Got it, dismiss
                </Button>
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Event Type Toggles */}
      <Card className="border-0 card-shadow">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Bell className="h-4 w-4 text-muted-foreground" />
                Notification Types
              </CardTitle>
              <CardDescription className="text-xs mt-1">
                Choose which events send push notifications. Rapid-fire events are automatically batched.
              </CardDescription>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="text-xs"
              onClick={() => toggleAll(noneEnabled || !allEnabled)}
            >
              {allEnabled ? "Disable All" : "Enable All"}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-1">
          {EVENT_TYPES.map((event, idx) => (
            <React.Fragment key={event.key}>
              {idx > 0 && <Separator className="my-1" />}
              <div className="flex items-center justify-between py-2">
                <div className="flex items-center gap-3">
                  <div className={`h-8 w-8 rounded-lg ${event.bgColor} flex items-center justify-center`}>
                    <event.icon className={`h-4 w-4 ${event.iconColor}`} />
                  </div>
                  <div>
                    <p className="text-sm font-medium">{event.label}</p>
                    <p className="text-xs text-muted-foreground">{event.description}</p>
                  </div>
                </div>
                <Switch
                  checked={prefs[event.key]}
                  onCheckedChange={(checked) => updatePref(event.key, checked)}
                />
              </div>
            </React.Fragment>
          ))}
        </CardContent>
      </Card>

      {/* Quiet Hours */}
      <Card className="border-0 card-shadow">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Moon className="h-4 w-4 text-muted-foreground" />
            Quiet Hours
          </CardTitle>
          <CardDescription className="text-xs">
            Pause push notifications during specific hours. Events are still recorded — you just
            won't be interrupted.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label className="text-sm">Enable Quiet Hours</Label>
              <p className="text-xs text-muted-foreground">
                Suppress notifications during the configured window
              </p>
            </div>
            <Switch
              checked={prefs.quiet_hours_enabled}
              onCheckedChange={(checked) => updatePref("quiet_hours_enabled", checked)}
            />
          </div>

          {prefs.quiet_hours_enabled && (
            <>
              <Separator />
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Start Time</Label>
                  <Input
                    type="time"
                    value={prefs.quiet_hours_start}
                    onChange={(e) => updatePref("quiet_hours_start", e.target.value)}
                    className="h-9"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">End Time</Label>
                  <Input
                    type="time"
                    value={prefs.quiet_hours_end}
                    onChange={(e) => updatePref("quiet_hours_end", e.target.value)}
                    className="h-9"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Timezone</Label>
                <Select
                  value={prefs.quiet_hours_timezone}
                  onValueChange={(val) => updatePref("quiet_hours_timezone", val)}
                >
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TIMEZONES.map((tz) => (
                      <SelectItem key={tz} value={tz}>
                        {tz.replace(/_/g, " ")}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="bg-muted/50 rounded-lg p-3">
                <p className="text-xs text-muted-foreground">
                  Notifications will be silenced from{" "}
                  <span className="font-medium text-foreground">{prefs.quiet_hours_start}</span> to{" "}
                  <span className="font-medium text-foreground">{prefs.quiet_hours_end}</span>{" "}
                  ({prefs.quiet_hours_timezone.replace(/_/g, " ")}). Events during this window are
                  still logged — you'll see them in your notification center when you return.
                </p>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Batching Info */}
      <Card className="border-0 card-shadow">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Shield className="h-4 w-4 text-muted-foreground" />
            Smart Batching
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-muted-foreground leading-relaxed">
            When multiple events of the same type fire within a short window (e.g., 10 Facebook
            leads arriving at once), they are automatically grouped into a single summary
            notification instead of flooding your device. This happens transparently — no
            configuration needed.
          </p>
          <div className="mt-3 grid grid-cols-3 gap-2">
            <div className="bg-muted/50 rounded-lg p-2 text-center">
              <p className="text-lg font-semibold">15s</p>
              <p className="text-[10px] text-muted-foreground">Batch Window</p>
            </div>
            <div className="bg-muted/50 rounded-lg p-2 text-center">
              <p className="text-lg font-semibold">Auto</p>
              <p className="text-[10px] text-muted-foreground">Grouping</p>
            </div>
            <div className="bg-muted/50 rounded-lg p-2 text-center">
              <p className="text-lg font-semibold">5</p>
              <p className="text-[10px] text-muted-foreground">Event Types</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Save Button */}
      {hasChanges && (
        <div className="sticky bottom-4 flex justify-end">
          <Button
            onClick={handleSave}
            disabled={updatePrefsMutation.isPending}
            className="shadow-lg"
          >
            {updatePrefsMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <Save className="h-4 w-4 mr-2" />
            )}
            Save Preferences
          </Button>
        </div>
      )}

      {prefsLoading && (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      )}

      {/* Admin-only: VAPID Configuration */}
      {isAdmin && <VapidConfigCard />}

      {/* Admin-only: Test Push Diagnostic */}
      {isAdmin && <TestPushCard />}

      {/* Admin-only: Reset Subscriptions */}
      {isAdmin && <ResetSubscriptionsCard />}
    </div>
  );
}

// ─── Admin-only: VAPID Key Generation ───
function VapidConfigCard() {
  const [keys, setKeys] = useState<{ publicKey: string; privateKey: string; instructions: string } | null>(null);
  const [showPrivate, setShowPrivate] = useState(false);

  const generateMutation = trpc.notifications.generateVapidKeys.useMutation({
    onSuccess: (data) => {
      setKeys(data);
      toast.success("VAPID keys generated — copy them into your environment variables");
    },
    onError: (err) => {
      toast.error(err.message || "Failed to generate VAPID keys");
    },
  });

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copied to clipboard`);
  };

  return (
    <Card className="border-0 card-shadow border-l-4 border-l-amber-500">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Key className="h-4 w-4 text-amber-500" />
          VAPID Configuration
          <Badge variant="outline" className="text-[10px] ml-1">Admin</Badge>
        </CardTitle>
        <CardDescription className="text-xs">
          Generate VAPID keys for Web Push. These must be set as environment variables
          (VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT) for push notifications to work.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {!keys ? (
          <Button
            onClick={() => generateMutation.mutate()}
            disabled={generateMutation.isPending}
            variant="outline"
            className="w-full"
          >
            {generateMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <Key className="h-4 w-4 mr-2" />
            )}
            Generate New VAPID Keys
          </Button>
        ) : (
          <div className="space-y-3">
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription className="text-xs">
                Copy these keys and set them as environment variables. They will not be shown again.
              </AlertDescription>
            </Alert>

            <div className="space-y-2">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">VAPID_PUBLIC_KEY</Label>
                <div className="flex gap-2">
                  <Input
                    readOnly
                    value={keys.publicKey}
                    className="h-8 text-xs font-mono bg-muted"
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 shrink-0"
                    onClick={() => copyToClipboard(keys.publicKey, "Public key")}
                  >
                    <Copy className="h-3 w-3" />
                  </Button>
                </div>
              </div>

              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">VAPID_PRIVATE_KEY</Label>
                <div className="flex gap-2">
                  <Input
                    readOnly
                    type={showPrivate ? "text" : "password"}
                    value={keys.privateKey}
                    className="h-8 text-xs font-mono bg-muted"
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 shrink-0"
                    onClick={() => setShowPrivate(!showPrivate)}
                  >
                    {showPrivate ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 shrink-0"
                    onClick={() => copyToClipboard(keys.privateKey, "Private key")}
                  >
                    <Copy className="h-3 w-3" />
                  </Button>
                </div>
              </div>

              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">VAPID_SUBJECT</Label>
                <Input
                  readOnly
                  value="mailto:admin@yourdomain.com"
                  className="h-8 text-xs font-mono bg-muted"
                />
              </div>
            </div>

            <div className="bg-muted/50 rounded-lg p-3">
              <p className="text-xs text-muted-foreground leading-relaxed">
                Set these three values as environment variables in Settings → Secrets, then restart the server.
              </p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Admin-only: Reset Subscriptions ───
function ResetSubscriptionsCard() {
  const { data: accounts } = trpc.accounts.list.useQuery();
  const [selectedAccountId, setSelectedAccountId] = useState<string>("");

  const clearMutation = trpc.notifications.clearSubscriptions.useMutation({
    onSuccess: (data) => {
      const acct = accounts?.find((a: any) => String(a.id) === selectedAccountId);
      localStorage.removeItem("push-notification-subscribed");
      toast.success(`Subscriptions cleared (${data.deleted} removed) for ${acct?.name || `Account #${selectedAccountId}`} — click Enable to re-subscribe.`);
    },
    onError: (err) => {
      toast.error(err.message || "Failed to clear subscriptions");
    },
  });

  return (
    <Card className="border-0 card-shadow border-l-4 border-l-red-400">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Trash2 className="h-4 w-4 text-red-400" />
          Reset Subscriptions
          <Badge variant="outline" className="text-[10px] ml-1">Admin</Badge>
        </CardTitle>
        <CardDescription className="text-xs">
          Purge all push subscriptions for an account so users can re-subscribe cleanly. Use this when subscriptions become stale or invalid.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex gap-2">
          <Select value={selectedAccountId} onValueChange={setSelectedAccountId}>
            <SelectTrigger className="h-9 flex-1">
              <SelectValue placeholder="Select a sub-account..." />
            </SelectTrigger>
            <SelectContent>
              {accounts?.map((acct: any) => (
                <SelectItem key={acct.id} value={String(acct.id)}>
                  <span className="font-medium">{acct.name}</span>
                  <span className="text-muted-foreground ml-2 text-xs">ID: {acct.id}</span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            onClick={() => {
              const id = parseInt(selectedAccountId);
              if (!id || id <= 0) {
                toast.error("Select a sub-account first");
                return;
              }
              clearMutation.mutate({ accountId: id });
            }}
            disabled={clearMutation.isPending || !selectedAccountId}
            variant="destructive"
            size="sm"
          >
            {clearMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <Trash2 className="h-4 w-4 mr-2" />
            )}
            Reset All
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Admin-only: Test Push Diagnostic ───
function TestPushCard() {
  const { data: accounts } = trpc.accounts.list.useQuery();
  const [selectedAccountId, setSelectedAccountId] = useState<string>("");
  const [lastResult, setLastResult] = useState<{
    sent: number;
    failed: number;
    vapidConfigured: boolean;
    subscriptionCount: number;
    message: string;
    accountName: string;
    timestamp: string;
  } | null>(null);

  const testMutation = trpc.notifications.testPushNotification.useMutation({
    onSuccess: (data) => {
      const acct = accounts?.find((a: any) => String(a.id) === selectedAccountId);
      setLastResult({
        ...data,
        accountName: acct?.name || `Account #${selectedAccountId}`,
        timestamp: new Date().toLocaleTimeString(),
      });
      if (data.sent > 0) {
        toast.success(data.message);
      } else {
        toast.warning(data.message);
      }
    },
    onError: (err) => {
      toast.error(err.message || "Test push failed");
    },
  });

  return (
    <Card className="border-0 card-shadow border-l-4 border-l-blue-500">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Zap className="h-4 w-4 text-blue-500" />
          Test Push Notification
          <Badge variant="outline" className="text-[10px] ml-1">Admin</Badge>
        </CardTitle>
        <CardDescription className="text-xs">
          Send a test push notification to all subscriptions for a specific account to verify the pipeline is working.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          <Select value={selectedAccountId} onValueChange={setSelectedAccountId}>
            <SelectTrigger className="h-9 flex-1">
              <SelectValue placeholder="Select a sub-account..." />
            </SelectTrigger>
            <SelectContent>
              {accounts?.map((acct: any) => (
                <SelectItem key={acct.id} value={String(acct.id)}>
                  <span className="font-medium">{acct.name}</span>
                  <span className="text-muted-foreground ml-2 text-xs">ID: {acct.id}</span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            onClick={() => {
              const id = parseInt(selectedAccountId);
              if (!id || id <= 0) {
                toast.error("Select a sub-account first");
                return;
              }
              testMutation.mutate({ accountId: id });
            }}
            disabled={testMutation.isPending || !selectedAccountId}
            size="sm"
          >
            {testMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <Zap className="h-4 w-4 mr-2" />
            )}
            Send Test
          </Button>
        </div>

        {lastResult && (
          <div className="bg-muted/50 rounded-lg p-3 space-y-2">
            <div className="flex items-center justify-between mb-1">
              <p className="text-xs font-medium">{lastResult.accountName}</p>
              <p className="text-[10px] text-muted-foreground">{lastResult.timestamp}</p>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="text-center">
                <p className="text-lg font-semibold">{lastResult.subscriptionCount}</p>
                <p className="text-[10px] text-muted-foreground">Subscriptions</p>
              </div>
              <div className="text-center">
                <p className={`text-lg font-semibold ${lastResult.vapidConfigured ? "text-green-500" : "text-red-500"}`}>
                  {lastResult.vapidConfigured ? "Yes" : "No"}
                </p>
                <p className="text-[10px] text-muted-foreground">VAPID Configured</p>
              </div>
              <div className="text-center">
                <p className="text-lg font-semibold text-green-500">{lastResult.sent}</p>
                <p className="text-[10px] text-muted-foreground">Sent</p>
              </div>
              <div className="text-center">
                <p className={`text-lg font-semibold ${lastResult.failed > 0 ? "text-red-500" : "text-muted-foreground"}`}>
                  {lastResult.failed}
                </p>
                <p className="text-[10px] text-muted-foreground">Failed</p>
              </div>
            </div>
            <Separator />
            <p className="text-xs text-muted-foreground">{lastResult.message}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
