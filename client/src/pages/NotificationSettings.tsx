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
  const { currentAccountId } = useAccount();
  const [, navigate] = useLocation();
  const {
    isSupported,
    isSubscribed,
    permission,
    subscribe,
    unsubscribe,
    isLoading: pushLoading,
  } = usePushNotifications(currentAccountId ?? undefined);

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

  const handleSubscribe = useCallback(async () => {
    const result = await subscribe();
    if (result) {
      toast.success("Push notifications enabled");
    } else if (permission === "denied") {
      toast.error("Notifications are blocked. Please enable them in your browser settings.");
    }
  }, [subscribe, permission]);

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
    </div>
  );
}
