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
import { Key, Zap, Copy, Eye, EyeOff, Trash2, Users } from "lucide-react";

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

type ChannelPref = { push: boolean; sms: boolean; email: boolean };

type PreferencesState = {
  inbound_sms: ChannelPref;
  inbound_email: ChannelPref;
  appointment_booked: ChannelPref;
  ai_call_completed: ChannelPref;
  facebook_lead: ChannelPref;
  quiet_hours_enabled: boolean;
  quiet_hours_start: string;
  quiet_hours_end: string;
  quiet_hours_timezone: string;
};

const DEFAULT_CHANNEL: ChannelPref = { push: true, sms: false, email: false };

const DEFAULT_PREFS: PreferencesState = {
  inbound_sms: { ...DEFAULT_CHANNEL },
  inbound_email: { ...DEFAULT_CHANNEL },
  appointment_booked: { ...DEFAULT_CHANNEL },
  ai_call_completed: { ...DEFAULT_CHANNEL },
  facebook_lead: { ...DEFAULT_CHANNEL },
  quiet_hours_enabled: false,
  quiet_hours_start: "22:00",
  quiet_hours_end: "07:00",
  quiet_hours_timezone: "America/New_York",
};

/** Normalize legacy boolean prefs to new channel format */
function normalizePrefs(raw: any): PreferencesState {
  const normalize = (val: any): ChannelPref => {
    if (typeof val === "boolean") return { push: val, sms: false, email: false };
    if (val && typeof val === "object") return {
      push: typeof val.push === "boolean" ? val.push : true,
      sms: typeof val.sms === "boolean" ? val.sms : false,
      email: typeof val.email === "boolean" ? val.email : false,
    };
    return { ...DEFAULT_CHANNEL };
  };
  return {
    inbound_sms: normalize(raw.inbound_sms),
    inbound_email: normalize(raw.inbound_email),
    appointment_booked: normalize(raw.appointment_booked),
    ai_call_completed: normalize(raw.ai_call_completed),
    facebook_lead: normalize(raw.facebook_lead),
    quiet_hours_enabled: typeof raw.quiet_hours_enabled === "boolean" ? raw.quiet_hours_enabled : false,
    quiet_hours_start: raw.quiet_hours_start || "22:00",
    quiet_hours_end: raw.quiet_hours_end || "07:00",
    quiet_hours_timezone: raw.quiet_hours_timezone || "America/New_York",
  };
}

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
    isVapidReady,
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

  // Sync fetched preferences into local state (normalize legacy boolean format)
  useEffect(() => {
    if (prefsData?.preferences) {
      setPrefs(normalizePrefs(prefsData.preferences));
      setHasChanges(false);
    }
  }, [prefsData]);

  const updatePref = useCallback((key: keyof PreferencesState, value: any) => {
    setPrefs((prev) => ({ ...prev, [key]: value }));
    setHasChanges(true);
  }, []);

  const updateChannel = useCallback(
    (eventKey: keyof PreferencesState, channel: "push" | "sms" | "email", value: boolean) => {
      setPrefs((prev) => {
        const current = prev[eventKey];
        if (typeof current === "object" && "push" in current) {
          return { ...prev, [eventKey]: { ...current, [channel]: value } };
        }
        return prev;
      });
      setHasChanges(true);
    },
    []
  );

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
      }
    } catch (err: any) {
      console.error("[Push] Subscribe error:", err);
      // Translate common DOMException names into user-friendly messages
      let message = err?.message || "Failed to enable push notifications";
      if (err?.name === "InvalidStateError" || message.includes("applicationServerKey")) {
        message = "VAPID key mismatch — ask your admin to reset subscriptions and try again.";
      } else if (err?.name === "NotAllowedError") {
        message = "Notification permission denied. Enable notifications in your browser/device settings.";
      }
      toast.error(message);
    }
  }, [subscribe, pushAccountId]);

  const handleUnsubscribe = useCallback(async () => {
    const result = await unsubscribe();
    if (result) {
      toast.success("Push notifications disabled");
    }
  }, [unsubscribe]);

  const allEnabled = EVENT_TYPES.every((e) => {
    const p = prefs[e.key];
    return typeof p === "object" && p.push && p.sms && p.email;
  });
  const noneEnabled = EVENT_TYPES.every((e) => {
    const p = prefs[e.key];
    return typeof p === "object" && !p.push && !p.sms && !p.email;
  });

  const toggleAll = useCallback(
    (enabled: boolean) => {
      const ch: ChannelPref = { push: enabled, sms: enabled, email: enabled };
      setPrefs((prev) => ({
        ...prev,
        inbound_sms: { ...ch },
        inbound_email: { ...ch },
        appointment_booked: { ...ch },
        ai_call_completed: { ...ch },
        facebook_lead: { ...ch },
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
      <div className="flex items-center justify-between">
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
        {isAdmin && (
          <Button variant="outline" size="sm" onClick={() => navigate("/settings/delivery-dashboard")}>
            <Bell className="h-4 w-4 mr-1" />
            Delivery Dashboard
          </Button>
        )}
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
                disabled={pushLoading || (!isSubscribed && !isVapidReady)}
              >
                {pushLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : isSubscribed ? (
                  "Disable"
                ) : !isVapidReady ? (
                  <><Loader2 className="h-3 w-3 animate-spin mr-1" /> Loading…</>
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

      {/* Personal SMS Phone Number */}
      <PersonalPhoneCard />

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
                Choose which channels to use for each event type. Rapid-fire events are automatically batched.
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
          {/* Channel column headers */}
          <div className="flex items-center justify-end gap-3 pb-1 pr-0.5">
            <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider w-12 text-center">Push</span>
            <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider w-12 text-center">SMS</span>
            <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider w-12 text-center">Email</span>
          </div>
          {EVENT_TYPES.map((event, idx) => {
            const channelPref = prefs[event.key] as ChannelPref;
            return (
              <React.Fragment key={event.key}>
                {idx > 0 && <Separator className="my-1" />}
                <div className="flex items-center justify-between py-2">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className={`h-8 w-8 rounded-lg ${event.bgColor} flex items-center justify-center shrink-0`}>
                      <event.icon className={`h-4 w-4 ${event.iconColor}`} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium">{event.label}</p>
                      <p className="text-xs text-muted-foreground truncate">{event.description}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <div className="w-12 flex justify-center">
                      <Switch
                        checked={channelPref?.push ?? true}
                        onCheckedChange={(checked) => updateChannel(event.key, "push", checked)}
                      />
                    </div>
                    <div className="w-12 flex justify-center">
                      <Switch
                        checked={channelPref?.sms ?? false}
                        onCheckedChange={(checked) => updateChannel(event.key, "sms", checked)}
                      />
                    </div>
                    <div className="w-12 flex justify-center">
                      <Switch
                        checked={channelPref?.email ?? false}
                        onCheckedChange={(checked) => updateChannel(event.key, "email", checked)}
                      />
                    </div>
                  </div>
                </div>
              </React.Fragment>
            );
          })}
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
  const { data: accounts } = trpc.accounts.list.useQuery(undefined, { staleTime: 0, refetchOnMount: true });
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
  const { data: accounts } = trpc.accounts.list.useQuery(undefined, { staleTime: 0, refetchOnMount: true });
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

  const parsedAccountId = parseInt(selectedAccountId) || 0;
  const { data: subCountData, refetch: refetchSubCount } = trpc.notifications.subscriptionCount.useQuery(
    { accountId: parsedAccountId },
    { enabled: parsedAccountId > 0, staleTime: 0, refetchOnMount: true }
  );

  const testMutation = trpc.notifications.testPushNotification.useMutation({
    onSuccess: (data) => {
      const acct = accounts?.find((a: any) => String(a.id) === selectedAccountId);
      setLastResult({
        ...data,
        accountName: acct?.name || `Account #${selectedAccountId}`,
        timestamp: new Date().toLocaleTimeString(),
      });
      refetchSubCount();
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

  const [smsResult, setSmsResult] = useState<{
    success: boolean;
    message: string;
    phone?: string;
    provider?: string;
    timestamp: string;
  } | null>(null);

  const testSmsMutation = trpc.notifications.testSmsNotification.useMutation({
    onSuccess: (data) => {
      setSmsResult({
        ...data,
        timestamp: new Date().toLocaleTimeString(),
      });
      if (data.success) {
        toast.success(data.message);
      } else {
        toast.warning(data.message);
      }
    },
    onError: (err) => {
      toast.error(err.message || "Test SMS failed");
    },
  });

  const [emailResult, setEmailResult] = useState<{
    success: boolean;
    message: string;
    email?: string;
    provider?: string;
    timestamp: string;
  } | null>(null);

  const testEmailMutation = trpc.notifications.testEmailNotification.useMutation({
    onSuccess: (data) => {
      setEmailResult({
        ...data,
        timestamp: new Date().toLocaleTimeString(),
      });
      if (data.success) {
        toast.success(data.message);
      } else {
        toast.warning(data.message);
      }
    },
    onError: (err) => {
      toast.error(err.message || "Test email failed");
    },
  });

  return (
    <Card className="border-0 card-shadow border-l-4 border-l-blue-500">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Zap className="h-4 w-4 text-blue-500" />
          Test Notifications
          <Badge variant="outline" className="text-[10px] ml-1">Admin</Badge>
        </CardTitle>
        <CardDescription className="text-xs">
          Send test notifications via Push, SMS, or Email to verify each channel is working for a specific account.
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
          {parsedAccountId > 0 && subCountData && (
            <Badge
              variant={subCountData.count > 0 ? "default" : "secondary"}
              className={`h-9 px-3 flex items-center gap-1.5 text-xs font-medium ${
                subCountData.count > 0
                  ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 border-green-200 dark:border-green-800"
                  : "bg-muted text-muted-foreground"
              }`}
            >
              <Users className="h-3 w-3" />
              {subCountData.count} sub{subCountData.count !== 1 ? "s" : ""}
            </Badge>
          )}
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
            Test Push
          </Button>
          <Button
            onClick={() => {
              const id = parseInt(selectedAccountId);
              if (!id || id <= 0) {
                toast.error("Select a sub-account first");
                return;
              }
              testSmsMutation.mutate({ accountId: id });
            }}
            disabled={testSmsMutation.isPending || !selectedAccountId}
            size="sm"
            variant="outline"
            className="bg-green-50 border-green-200 text-green-700 hover:bg-green-100 dark:bg-green-900/20 dark:border-green-800 dark:text-green-400 dark:hover:bg-green-900/30"
          >
            {testSmsMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <MessageSquare className="h-4 w-4 mr-2" />
            )}
            Test SMS
          </Button>
          <Button
            onClick={() => {
              const id = parseInt(selectedAccountId);
              if (!id || id <= 0) {
                toast.error("Select a sub-account first");
                return;
              }
              testEmailMutation.mutate({ accountId: id });
            }}
            disabled={testEmailMutation.isPending || !selectedAccountId}
            size="sm"
            variant="outline"
            className="bg-blue-50 border-blue-200 text-blue-700 hover:bg-blue-100 dark:bg-blue-900/20 dark:border-blue-800 dark:text-blue-400 dark:hover:bg-blue-900/30"
          >
            {testEmailMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <Mail className="h-4 w-4 mr-2" />
            )}
            Test Email
          </Button>
        </div>

        {lastResult && (
          <div className="bg-muted/50 rounded-lg p-3 space-y-2">
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2">
                <Zap className="h-3 w-3 text-blue-500" />
                <p className="text-xs font-medium">Push — {lastResult.accountName}</p>
              </div>
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

        {smsResult && (
          <div className="bg-muted/50 rounded-lg p-3 space-y-2">
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2">
                <MessageSquare className="h-3 w-3 text-green-500" />
                <p className="text-xs font-medium">SMS Test Result</p>
              </div>
              <p className="text-[10px] text-muted-foreground">{smsResult.timestamp}</p>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5">
                {smsResult.success ? (
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                ) : (
                  <AlertCircle className="h-4 w-4 text-red-500" />
                )}
                <span className={`text-sm font-medium ${smsResult.success ? "text-green-600" : "text-red-600"}`}>
                  {smsResult.success ? "Delivered" : "Failed"}
                </span>
              </div>
              {smsResult.phone && (
                <Badge variant="secondary" className="text-[10px]">
                  {smsResult.phone}
                </Badge>
              )}
              {smsResult.provider && (
                <Badge variant="outline" className="text-[10px]">
                  {smsResult.provider}
                </Badge>
              )}
            </div>
            <Separator />
            <p className="text-xs text-muted-foreground">{smsResult.message}</p>
          </div>
        )}

        {emailResult && (
          <div className="bg-muted/50 rounded-lg p-3 space-y-2">
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2">
                <Mail className="h-3 w-3 text-blue-500" />
                <p className="text-xs font-medium">Email Test Result</p>
              </div>
              <p className="text-[10px] text-muted-foreground">{emailResult.timestamp}</p>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5">
                {emailResult.success ? (
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                ) : (
                  <AlertCircle className="h-4 w-4 text-red-500" />
                )}
                <span className={`text-sm font-medium ${emailResult.success ? "text-green-600" : "text-red-600"}`}>
                  {emailResult.success ? "Delivered" : "Failed"}
                </span>
              </div>
              {emailResult.email && (
                <Badge variant="secondary" className="text-[10px]">
                  {emailResult.email}
                </Badge>
              )}
              {emailResult.provider && (
                <Badge variant="outline" className="text-[10px]">
                  {emailResult.provider}
                </Badge>
              )}
            </div>
            <Separator />
            <p className="text-xs text-muted-foreground">{emailResult.message}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Personal Phone Number Card ─────────────────────
function PersonalPhoneCard() {
  const { data: phoneData, isLoading } = trpc.notifications.getUserPhone.useQuery(undefined, {
    staleTime: 0,
    refetchOnMount: true,
  });
  const utils = trpc.useUtils();

  const [phone, setPhone] = useState("");
  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => {
    if (phoneData?.phone) {
      setPhone(phoneData.phone);
    }
  }, [phoneData]);

  const updatePhoneMutation = trpc.notifications.updateUserPhone.useMutation({
    onSuccess: (data) => {
      toast.success(data.phone ? "Personal phone number saved" : "Personal phone number removed");
      utils.notifications.getUserPhone.invalidate();
      setIsEditing(false);
    },
    onError: (err) => {
      toast.error(err.message || "Failed to update phone number");
    },
  });

  const handleSave = () => {
    const trimmed = phone.trim();
    updatePhoneMutation.mutate({ phone: trimmed || null });
  };

  const handleRemove = () => {
    setPhone("");
    updatePhoneMutation.mutate({ phone: null });
  };

  const hasPhone = !!phoneData?.phone;

  return (
    <Card className="border-0 card-shadow">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Phone className="h-4 w-4 text-muted-foreground" />
          Personal SMS Number
        </CardTitle>
        <CardDescription className="text-xs">
          Set your personal phone number to receive SMS notifications directly. If not set, SMS notifications will be sent to the account-level phone number.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {isLoading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading...
          </div>
        ) : !isEditing && hasPhone ? (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-lg bg-green-500/10 flex items-center justify-center">
                <Phone className="h-4 w-4 text-green-500" />
              </div>
              <div>
                <p className="text-sm font-medium font-mono">{phoneData.phone}</p>
                <p className="text-xs text-muted-foreground">SMS notifications will be sent here</p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="sm" className="text-xs" onClick={() => setIsEditing(true)}>
                Edit
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="text-xs text-red-500 hover:text-red-600"
                onClick={handleRemove}
                disabled={updatePhoneMutation.isPending}
              >
                {updatePhoneMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : "Remove"}
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Phone Number (E.164 format)</Label>
              <Input
                placeholder="+12125551234"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="font-mono text-sm"
              />
              <p className="text-[10px] text-muted-foreground">
                Include country code. Example: +12125551234 for US numbers.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                onClick={handleSave}
                disabled={!phone.trim() || updatePhoneMutation.isPending}
              >
                {updatePhoneMutation.isPending ? (
                  <Loader2 className="h-3 w-3 animate-spin mr-1" />
                ) : (
                  <Save className="h-3 w-3 mr-1" />
                )}
                Save
              </Button>
              {isEditing && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setIsEditing(false);
                    setPhone(phoneData?.phone || "");
                  }}
                >
                  Cancel
                </Button>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
