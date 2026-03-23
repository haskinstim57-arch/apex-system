import { useState, useEffect } from "react";
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
} from "lucide-react";
import { useLocation } from "wouter";

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

  // Form state
  const [twilioAccountSid, setTwilioAccountSid] = useState("");
  const [twilioAuthToken, setTwilioAuthToken] = useState("");
  const [twilioFromNumber, setTwilioFromNumber] = useState("");
  const [sendgridApiKey, setSendgridApiKey] = useState("");
  const [sendgridFromEmail, setSendgridFromEmail] = useState("");
  const [sendgridFromName, setSendgridFromName] = useState("");

  // Visibility toggles for sensitive fields
  const [showTwilioToken, setShowTwilioToken] = useState(false);
  const [showSendgridKey, setShowSendgridKey] = useState(false);

  // Populate form when settings load
  useEffect(() => {
    if (settings) {
      setTwilioAccountSid(settings.twilioAccountSid || "");
      setTwilioAuthToken(settings.twilioAuthToken || "");
      setTwilioFromNumber(settings.twilioFromNumber || "");
      setSendgridApiKey(settings.sendgridApiKey || "");
      setSendgridFromEmail(settings.sendgridFromEmail || "");
      setSendgridFromName(settings.sendgridFromName || "");
    }
  }, [settings]);

  const handleSave = () => {
    if (!currentAccountId) return;
    saveMutation.mutate({
      accountId: currentAccountId,
      twilioAccountSid: twilioAccountSid || null,
      twilioAuthToken: twilioAuthToken || null,
      twilioFromNumber: twilioFromNumber || null,
      sendgridApiKey: sendgridApiKey || null,
      sendgridFromEmail: sendgridFromEmail || null,
      sendgridFromName: sendgridFromName || null,
    });
  };

  const twilioConfigured = !!(
    settings?.twilioAccountSid &&
    settings?.twilioAuthToken &&
    settings?.twilioFromNumber
  );

  const sendgridConfigured = !!(
    settings?.sendgridApiKey && settings?.sendgridFromEmail
  );

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
        <Card className="bg-white border-0 card-shadow">
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
            Configure SMS and email credentials for{" "}
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
        </div>
      ) : (
        <>
          {/* Twilio SMS Settings */}
          <Card className="bg-white border-0 card-shadow">
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

          {/* SendGrid Email Settings */}
          <Card className="bg-white border-0 card-shadow">
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

          {/* Save Button */}
          <div className="flex justify-end">
            <Button
              onClick={handleSave}
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
                  Save Settings
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
                can configure just SMS, just email, or both.
              </p>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
