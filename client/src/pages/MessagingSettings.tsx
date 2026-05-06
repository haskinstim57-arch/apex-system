import { useState, useEffect, useMemo, useCallback } from "react";
import { trpc } from "@/lib/trpc";
import { useAccount } from "@/contexts/AccountContext";
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
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import {
  ArrowLeft,
  Phone,
  Mail,
  Save,
  Eye,
  EyeOff,
  CheckCircle2,
  AlertCircle,
  Clock,
  MessageSquare,
} from "lucide-react";
import { useLocation } from "wouter";

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

interface DaySchedule {
  open: boolean;
  start?: string;
  end?: string;
}

interface BusinessHoursConfig {
  enabled: boolean;
  timezone: string;
  schedule: Record<string, DaySchedule>;
}

// ─────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────

const DAYS = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
] as const;

const DAY_LABELS: Record<string, string> = {
  monday: "Monday",
  tuesday: "Tuesday",
  wednesday: "Wednesday",
  thursday: "Thursday",
  friday: "Friday",
  saturday: "Saturday",
  sunday: "Sunday",
};

const DAY_SHORT: Record<string, string> = {
  monday: "Mon",
  tuesday: "Tue",
  wednesday: "Wed",
  thursday: "Thu",
  friday: "Fri",
  saturday: "Sat",
  sunday: "Sun",
};

/** Common US timezones + a few international ones */
const TIMEZONES = [
  { value: "America/New_York", label: "Eastern Time (ET)" },
  { value: "America/Chicago", label: "Central Time (CT)" },
  { value: "America/Denver", label: "Mountain Time (MT)" },
  { value: "America/Los_Angeles", label: "Pacific Time (PT)" },
  { value: "America/Anchorage", label: "Alaska Time (AKT)" },
  { value: "Pacific/Honolulu", label: "Hawaii Time (HT)" },
  { value: "America/Phoenix", label: "Arizona (no DST)" },
  { value: "UTC", label: "UTC" },
  { value: "Europe/London", label: "London (GMT/BST)" },
  { value: "Europe/Paris", label: "Central European (CET)" },
  { value: "Asia/Tokyo", label: "Japan (JST)" },
  { value: "Australia/Sydney", label: "Sydney (AEST)" },
];

/** Generate time options in 30-minute increments */
function generateTimeOptions(): { value: string; label: string }[] {
  const options: { value: string; label: string }[] = [];
  for (let h = 0; h < 24; h++) {
    for (const m of [0, 30]) {
      const hh = String(h).padStart(2, "0");
      const mm = String(m).padStart(2, "0");
      const value = `${hh}:${mm}`;
      const period = h < 12 ? "AM" : "PM";
      const displayH = h === 0 ? 12 : h > 12 ? h - 12 : h;
      const label = `${displayH}:${mm} ${period}`;
      options.push({ value, label });
    }
  }
  return options;
}

const TIME_OPTIONS = generateTimeOptions();

const DEFAULT_BUSINESS_HOURS: BusinessHoursConfig = {
  enabled: true,
  timezone: "America/New_York",
  schedule: {
    monday: { open: true, start: "07:00", end: "22:00" },
    tuesday: { open: true, start: "07:00", end: "22:00" },
    wednesday: { open: true, start: "07:00", end: "22:00" },
    thursday: { open: true, start: "07:00", end: "22:00" },
    friday: { open: true, start: "07:00", end: "22:00" },
    saturday: { open: true, start: "08:00", end: "20:00" },
    sunday: { open: false, start: "09:00", end: "17:00" },
  },
};

// ─────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────

export default function MessagingSettings() {
  const [, setLocation] = useLocation();
  const { currentAccountId, currentAccount } = useAccount();

  const {
    data: settings,
    isLoading,
    refetch,
  } = trpc.messagingSettings.get.useQuery(
    { accountId: currentAccountId! },
    { enabled: !!currentAccountId }
  );

  const saveMutation = trpc.messagingSettings.save.useMutation({
    onSuccess: () => {
      toast.success("Messaging settings saved successfully");
      refetch();
    },
    onError: (err) => {
      toast.error(err.message || "Failed to save settings");
    },
  });

  const saveBusinessHoursMutation =
    trpc.messagingSettings.saveBusinessHours.useMutation({
      onSuccess: () => {
        toast.success("Business hours saved successfully");
        refetch();
      },
      onError: (err) => {
        toast.error(err.message || "Failed to save business hours");
      },
    });

  // Form state — messaging credentials
  const [twilioAccountSid, setTwilioAccountSid] = useState("");
  const [twilioAuthToken, setTwilioAuthToken] = useState("");
  const [twilioFromNumber, setTwilioFromNumber] = useState("");
  const [sendgridApiKey, setSendgridApiKey] = useState("");
  const [sendgridFromEmail, setSendgridFromEmail] = useState("");
  const [sendgridFromName, setSendgridFromName] = useState("");
  const [blooioApiKey, setBlooioApiKey] = useState("");

  // Form state — business hours
  const [businessHours, setBusinessHours] =
    useState<BusinessHoursConfig>(DEFAULT_BUSINESS_HOURS);

  // Visibility toggles for sensitive fields
  const [showTwilioToken, setShowTwilioToken] = useState(false);
  const [showSendgridKey, setShowSendgridKey] = useState(false);
  const [showBlooioKey, setShowBlooioKey] = useState(false);

  // Populate form when settings load
  useEffect(() => {
    if (settings) {
      setTwilioAccountSid(settings.twilioAccountSid || "");
      setTwilioAuthToken(settings.twilioAuthToken || "");
      setTwilioFromNumber(settings.twilioFromNumber || "");
      setSendgridApiKey(settings.sendgridApiKey || "");
      setSendgridFromEmail(settings.sendgridFromEmail || "");
      setSendgridFromName(settings.sendgridFromName || "");
      setBlooioApiKey(settings.blooioApiKey || "");
      if (settings.businessHours) {
        setBusinessHours(settings.businessHours as BusinessHoursConfig);
      }
    }
  }, [settings]);

  // ─── Business hours helpers ───

  const updateDay = useCallback(
    (day: string, field: keyof DaySchedule, value: boolean | string) => {
      setBusinessHours((prev) => ({
        ...prev,
        schedule: {
          ...prev.schedule,
          [day]: {
            ...prev.schedule[day],
            [field]: value,
          },
        },
      }));
    },
    []
  );

  const applyToAllDays = useCallback(
    (sourceDay: string) => {
      const source = businessHours.schedule[sourceDay];
      if (!source) return;
      setBusinessHours((prev) => {
        const newSchedule = { ...prev.schedule };
        for (const day of DAYS) {
          newSchedule[day] = { ...source };
        }
        return { ...prev, schedule: newSchedule };
      });
      toast.info(
        `Applied ${DAY_LABELS[sourceDay]}'s schedule to all days`
      );
    },
    [businessHours.schedule]
  );

  const applyToWeekdays = useCallback(
    (sourceDay: string) => {
      const source = businessHours.schedule[sourceDay];
      if (!source) return;
      setBusinessHours((prev) => {
        const newSchedule = { ...prev.schedule };
        for (const day of ["monday", "tuesday", "wednesday", "thursday", "friday"]) {
          newSchedule[day] = { ...source };
        }
        return { ...prev, schedule: newSchedule };
      });
      toast.info(
        `Applied ${DAY_LABELS[sourceDay]}'s schedule to weekdays`
      );
    },
    [businessHours.schedule]
  );

  // ─── Save handlers ───

  const handleSaveCredentials = () => {
    if (!currentAccountId) return;
    saveMutation.mutate({
      accountId: currentAccountId,
      twilioAccountSid: twilioAccountSid || null,
      twilioAuthToken: twilioAuthToken || null,
      twilioFromNumber: twilioFromNumber || null,
      sendgridApiKey: sendgridApiKey || null,
      sendgridFromEmail: sendgridFromEmail || null,
      sendgridFromName: sendgridFromName || null,
      blooioApiKey: blooioApiKey || null,
    });
  };

  const handleSaveBusinessHours = () => {
    if (!currentAccountId) return;
    // Validate: ensure at least one day is open if enabled
    if (businessHours.enabled) {
      const hasOpenDay = DAYS.some((d) => businessHours.schedule[d]?.open);
      if (!hasOpenDay) {
        toast.error(
          "At least one day must be open when business hours are enabled"
        );
        return;
      }
      // Validate time ranges
      for (const day of DAYS) {
        const ds = businessHours.schedule[day];
        if (ds?.open && ds.start && ds.end && ds.start >= ds.end) {
          toast.error(
            `${DAY_LABELS[day]}: start time must be before end time`
          );
          return;
        }
      }
    }
    saveBusinessHoursMutation.mutate({
      accountId: currentAccountId,
      businessHours: {
        enabled: businessHours.enabled,
        timezone: businessHours.timezone,
        schedule: {
          monday: businessHours.schedule.monday || { open: false },
          tuesday: businessHours.schedule.tuesday || { open: false },
          wednesday: businessHours.schedule.wednesday || { open: false },
          thursday: businessHours.schedule.thursday || { open: false },
          friday: businessHours.schedule.friday || { open: false },
          saturday: businessHours.schedule.saturday || { open: false },
          sunday: businessHours.schedule.sunday || { open: false },
        },
      },
    });
  };

  // ─── Derived state ───

  const twilioConfigured = !!(
    settings?.twilioAccountSid &&
    settings?.twilioAuthToken &&
    settings?.twilioFromNumber
  );

  const sendgridConfigured = !!(
    settings?.sendgridApiKey && settings?.sendgridFromEmail
  );

  const blooioConfigured = !!settings?.blooioApiKey;

  const openDayCount = useMemo(
    () => DAYS.filter((d) => businessHours.schedule[d]?.open).length,
    [businessHours.schedule]
  );

  // ─── Render ───

  if (!currentAccountId) {
    return (
      <div className="space-y-6 max-w-3xl">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => setLocation("/settings")}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              Messaging Settings
            </h1>
          </div>
        </div>
        <Card className="bg-card border-0 card-shadow">
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">
              Please select an account to configure messaging settings.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={() => setLocation("/settings")}
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Messaging Settings
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Configure SMS, email, and business hours for{" "}
            <span className="font-medium text-foreground">
              {currentAccount?.name || "this account"}
            </span>
          </p>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          <Skeleton className="h-48 w-full" />
          <Skeleton className="h-48 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      ) : (
        <>
          {/* ─── Twilio SMS Settings ─── */}
          <Card className="bg-card border-0 card-shadow">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Phone className="h-4 w-4 text-muted-foreground" />
                  <CardTitle className="text-sm font-medium">
                    Twilio SMS
                  </CardTitle>
                </div>
                <Badge
                  variant={twilioConfigured ? "default" : "secondary"}
                  className="text-xs"
                >
                  {twilioConfigured ? (
                    <span className="flex items-center gap-1">
                      <CheckCircle2 className="h-3 w-3" /> Configured
                    </span>
                  ) : (
                    <span className="flex items-center gap-1">
                      <AlertCircle className="h-3 w-3" /> Not configured
                    </span>
                  )}
                </Badge>
              </div>
              <CardDescription className="text-xs">
                Enter your Twilio credentials to send SMS from this account's
                own phone number. If left blank, the system will use global
                credentials.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="twilioAccountSid" className="text-xs">
                  Account SID
                </Label>
                <Input
                  id="twilioAccountSid"
                  placeholder="ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                  value={twilioAccountSid}
                  onChange={(e) => setTwilioAccountSid(e.target.value)}
                  className="font-mono text-sm"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="twilioAuthToken" className="text-xs">
                  Auth Token
                </Label>
                <div className="relative">
                  <Input
                    id="twilioAuthToken"
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
                <Label htmlFor="twilioFromNumber" className="text-xs">
                  From Phone Number
                </Label>
                <Input
                  id="twilioFromNumber"
                  placeholder="+15551234567"
                  value={twilioFromNumber}
                  onChange={(e) => setTwilioFromNumber(e.target.value)}
                  className="font-mono text-sm"
                />
                <p className="text-xs text-muted-foreground">
                  Must be a Twilio phone number in E.164 format
                </p>
              </div>
            </CardContent>
          </Card>

          <Separator className="bg-border/30" />

          {/* ─── SendGrid Email Settings ─── */}
          <Card className="bg-card border-0 card-shadow">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  <CardTitle className="text-sm font-medium">
                    SendGrid Email
                  </CardTitle>
                </div>
                <Badge
                  variant={sendgridConfigured ? "default" : "secondary"}
                  className="text-xs"
                >
                  {sendgridConfigured ? (
                    <span className="flex items-center gap-1">
                      <CheckCircle2 className="h-3 w-3" /> Configured
                    </span>
                  ) : (
                    <span className="flex items-center gap-1">
                      <AlertCircle className="h-3 w-3" /> Not configured
                    </span>
                  )}
                </Badge>
              </div>
              <CardDescription className="text-xs">
                Enter your SendGrid credentials to send emails from this
                account's own domain. If left blank, the system will use global
                credentials.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="sendgridApiKey" className="text-xs">
                  API Key
                </Label>
                <div className="relative">
                  <Input
                    id="sendgridApiKey"
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
              <div className="space-y-2">
                <Label htmlFor="sendgridFromEmail" className="text-xs">
                  From Email Address
                </Label>
                <Input
                  id="sendgridFromEmail"
                  type="email"
                  placeholder="noreply@yourdomain.com"
                  value={sendgridFromEmail}
                  onChange={(e) => setSendgridFromEmail(e.target.value)}
                  className="text-sm"
                />
                <p className="text-xs text-muted-foreground">
                  Must be a verified sender in your SendGrid account
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="sendgridFromName" className="text-xs">
                  From Name (optional)
                </Label>
                <Input
                  id="sendgridFromName"
                  placeholder="Your Company Name"
                  value={sendgridFromName}
                  onChange={(e) => setSendgridFromName(e.target.value)}
                  className="text-sm"
                />
              </div>
            </CardContent>
          </Card>

          <Separator className="bg-border/30" />

          {/* ─── Blooio SMS Settings ─── */}
          <Card className="bg-card border-0 card-shadow">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <MessageSquare className="h-4 w-4 text-muted-foreground" />
                  <CardTitle className="text-sm font-medium">
                    Blooio SMS / iMessage
                  </CardTitle>
                </div>
                <Badge
                  variant={blooioConfigured ? "default" : "secondary"}
                  className="text-xs"
                >
                  {blooioConfigured ? (
                    <span className="flex items-center gap-1">
                      <CheckCircle2 className="h-3 w-3" /> Configured
                    </span>
                  ) : (
                    <span className="flex items-center gap-1">
                      <AlertCircle className="h-3 w-3" /> Not configured
                    </span>
                  )}
                </Badge>
              </div>
              <CardDescription className="text-xs">
                Enter your Blooio API key to send SMS and iMessage from this
                account. If left blank, the system will use the global API key.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="blooioApiKey" className="text-xs">
                  API Key
                </Label>
                <div className="relative">
                  <Input
                    id="blooioApiKey"
                    type={showBlooioKey ? "text" : "password"}
                    placeholder="api_xxxxxxxxxxxxxxxxxxxxxxxxxx"
                    value={blooioApiKey}
                    onChange={(e) => setBlooioApiKey(e.target.value)}
                    className="font-mono text-sm pr-10"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
                    onClick={() => setShowBlooioKey(!showBlooioKey)}
                  >
                    {showBlooioKey ? (
                      <EyeOff className="h-3.5 w-3.5" />
                    ) : (
                      <Eye className="h-3.5 w-3.5" />
                    )}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Get your API key from{" "}
                  <a
                    href="https://app.blooio.com"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary underline"
                  >
                    app.blooio.com
                  </a>
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Save Credentials Button */}
          <div className="flex justify-end">
            <Button
              onClick={handleSaveCredentials}
              disabled={saveMutation.isPending}
              className="min-w-[120px]"
            >
              {saveMutation.isPending ? (
                <span className="flex items-center gap-2">
                  <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
                  Saving...
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <Save className="h-3.5 w-3.5" />
                  Save Credentials
                </span>
              )}
            </Button>
          </div>

          <Separator className="bg-border/30" />

          {/* ─── Business Hours ─── */}
          <Card className="bg-card border-0 card-shadow">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <CardTitle className="text-sm font-medium">
                    AI Business Hours
                  </CardTitle>
                </div>
                <div className="flex items-center gap-2">
                  <Label
                    htmlFor="bh-enabled"
                    className="text-xs text-muted-foreground cursor-pointer"
                  >
                    {businessHours.enabled ? "Enforced" : "Disabled"}
                  </Label>
                  <Switch
                    id="bh-enabled"
                    checked={businessHours.enabled}
                    onCheckedChange={(checked) =>
                      setBusinessHours((prev) => ({
                        ...prev,
                        enabled: checked,
                      }))
                    }
                  />
                </div>
              </div>
              <CardDescription className="text-xs">
                {businessHours.enabled
                  ? `AI calls and automated messages will only be sent during the hours below. ${openDayCount} of 7 days are open.`
                  : "Business hours enforcement is disabled. AI calls and automated messages can be sent at any time."}
              </CardDescription>
            </CardHeader>

            {businessHours.enabled && (
              <CardContent className="space-y-5">
                {/* Timezone selector */}
                <div className="space-y-2">
                  <Label className="text-xs font-medium">Timezone</Label>
                  <Select
                    value={businessHours.timezone}
                    onValueChange={(tz) =>
                      setBusinessHours((prev) => ({
                        ...prev,
                        timezone: tz,
                      }))
                    }
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select timezone" />
                    </SelectTrigger>
                    <SelectContent>
                      {TIMEZONES.map((tz) => (
                        <SelectItem key={tz.value} value={tz.value}>
                          {tz.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Per-day schedule */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between mb-2">
                    <Label className="text-xs font-medium">
                      Weekly Schedule
                    </Label>
                  </div>

                  <div className="rounded-lg border border-border/50 divide-y divide-border/30">
                    {DAYS.map((day) => {
                      const ds = businessHours.schedule[day] || {
                        open: false,
                        start: "09:00",
                        end: "17:00",
                      };
                      return (
                        <div
                          key={day}
                          className={`flex items-center gap-3 px-3 py-2.5 transition-colors ${
                            ds.open
                              ? "bg-card"
                              : "bg-muted/30"
                          }`}
                        >
                          {/* Day toggle */}
                          <div className="flex items-center gap-2 w-24 shrink-0">
                            <Switch
                              checked={ds.open}
                              onCheckedChange={(checked) =>
                                updateDay(day, "open", checked)
                              }
                              className="scale-90"
                            />
                            <span
                              className={`text-sm font-medium ${
                                ds.open
                                  ? "text-foreground"
                                  : "text-muted-foreground"
                              }`}
                            >
                              {DAY_SHORT[day]}
                            </span>
                          </div>

                          {/* Time pickers */}
                          {ds.open ? (
                            <div className="flex items-center gap-2 flex-1">
                              <Select
                                value={ds.start || "09:00"}
                                onValueChange={(v) =>
                                  updateDay(day, "start", v)
                                }
                              >
                                <SelectTrigger className="w-[110px] h-8 text-xs">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {TIME_OPTIONS.map((t) => (
                                    <SelectItem
                                      key={t.value}
                                      value={t.value}
                                    >
                                      {t.label}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <span className="text-xs text-muted-foreground">
                                to
                              </span>
                              <Select
                                value={ds.end || "17:00"}
                                onValueChange={(v) =>
                                  updateDay(day, "end", v)
                                }
                              >
                                <SelectTrigger className="w-[110px] h-8 text-xs">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {TIME_OPTIONS.map((t) => (
                                    <SelectItem
                                      key={t.value}
                                      value={t.value}
                                    >
                                      {t.label}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>

                              {/* Quick-apply buttons (only on first row or weekday) */}
                              <div className="flex items-center gap-1 ml-auto">
                                {day === "monday" && (
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    className="h-6 text-[10px] px-2 text-muted-foreground hover:text-foreground"
                                    onClick={() => applyToWeekdays(day)}
                                  >
                                    Apply to weekdays
                                  </Button>
                                )}
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  className="h-6 text-[10px] px-2 text-muted-foreground hover:text-foreground"
                                  onClick={() => applyToAllDays(day)}
                                >
                                  Apply to all
                                </Button>
                              </div>
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground italic">
                              Closed
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </CardContent>
            )}
          </Card>

          {/* Business Hours Preview */}
          {businessHours.enabled && (() => {
            const openDays = DAYS.filter((d) => businessHours.schedule[d]?.open);
            if (openDays.length === 0) return null;
            const starts = openDays.map((d) => businessHours.schedule[d]?.start || "09:00");
            const ends = openDays.map((d) => businessHours.schedule[d]?.end || "17:00");
            const earliest = starts.sort()[0];
            const latest = ends.sort().reverse()[0];
            const fmt = (t: string) => {
              const [hh, mm] = t.split(":").map(Number);
              const period = hh < 12 ? "AM" : "PM";
              const displayH = hh === 0 ? 12 : hh > 12 ? hh - 12 : hh;
              return `${displayH}:${String(mm).padStart(2, "0")} ${period}`;
            };
            const dayNames = openDays.map((d) => DAY_SHORT[d]);
            const daysSummary = dayNames.length === 7
              ? "every day"
              : dayNames.length === 5 && openDays.every((d) => ["monday","tuesday","wednesday","thursday","friday"].includes(d))
                ? "Mon–Fri"
                : dayNames.join(", ");
            const tzLabel = TIMEZONES.find((tz) => tz.value === businessHours.timezone)?.label || businessHours.timezone;
            return (
              <div className="rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/30 p-3">
                <p className="text-xs text-blue-700 dark:text-blue-400 leading-relaxed">
                  <strong>Preview:</strong> AI calls will be made {daysSummary}, {fmt(earliest)} – {fmt(latest)} in {tzLabel}.
                </p>
              </div>
            );
          })()}

          {/* Save Business Hours Button */}
          <div className="flex justify-end">
            <Button
              onClick={handleSaveBusinessHours}
              disabled={saveBusinessHoursMutation.isPending}
              className="min-w-[160px]"
            >
              {saveBusinessHoursMutation.isPending ? (
                <span className="flex items-center gap-2">
                  <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
                  Saving...
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <Clock className="h-3.5 w-3.5" />
                  Save Business Hours
                </span>
              )}
            </Button>
          </div>

          {/* Info note */}
          <Card className="border-border/50 bg-muted/30">
            <CardContent className="pt-4 pb-4">
              <p className="text-xs text-muted-foreground leading-relaxed">
                <strong>How it works:</strong> When this account sends SMS or
                email messages (manual, campaigns, or automations), the system
                will use the credentials configured here. If no credentials are
                set, the system falls back to the global agency credentials. You
                can configure just SMS, just email, or both. Business hours
                control when AI calls and automated messages are allowed — when
                enabled, messages outside the configured hours will be queued or
                blocked.
              </p>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
