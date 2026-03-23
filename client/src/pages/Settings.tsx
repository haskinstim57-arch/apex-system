import { useState } from "react";
import React from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Shield,
  User,
  Bell,
  Key,
  Palette,
  Facebook,
  MessageSquare,
  ChevronRight,
  Lock,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Link2,
  ExternalLink,
  MapPin,
  Unlink,
  CalendarDays,
  RefreshCw,
  PhoneMissed,
  ToggleLeft,
  ToggleRight,
  Clock,
  Save,
  Phone,
  Search,
  Trash2,
  DollarSign,
  CheckCircle,
  XCircle,
} from "lucide-react";
import { useLocation } from "wouter";
import { useAccount } from "@/contexts/AccountContext";

function IntegrationLink({
  icon: Icon,
  label,
  description,
  href,
  iconColor = "text-muted-foreground",
}: {
  icon: React.ElementType;
  label: string;
  description: string;
  href: string;
  iconColor?: string;
}) {
  const [, setLocation] = useLocation();
  return (
    <button
      onClick={() => setLocation(href)}
      className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg hover:bg-accent transition-colors text-left group"
    >
      <div className="h-8 w-8 rounded-lg bg-muted flex items-center justify-center shrink-0">
        <Icon className={`h-4 w-4 ${iconColor}`} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium">{label}</p>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
    </button>
  );
}

export default function SettingsPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const { currentAccountId, currentAccount } = useAccount();

  // Determine the user's role within the active account context
  const isAccountOwner = currentAccount && currentAccount.ownerId === user?.id;
  const displayRole = isAdmin
    ? "Admin"
    : isAccountOwner
      ? "Account Owner"
      : user?.role || "user";
  const displayRoleDescription = isAdmin
    ? "Full platform access as administrator"
    : isAccountOwner
      ? "Owner of the active sub-account"
      : "Standard user access";
  // Show messaging settings link to account owners or admins with an account selected
  const showMessagingSettings = !!currentAccountId;

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Manage your profile and account preferences.
        </p>
      </div>

      {/* Profile Section */}
      <Card className="border-border/50 bg-card">
        <CardHeader>
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <User className="h-4 w-4 text-muted-foreground" />
            Profile
          </CardTitle>
          <CardDescription className="text-xs">
            Your personal information and login details.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4">
            <Avatar className="h-16 w-16 border-2 border-border/50">
              <AvatarFallback className="text-lg font-semibold bg-primary/10 text-primary">
                {user?.name?.charAt(0).toUpperCase() || "U"}
              </AvatarFallback>
            </Avatar>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-medium">{user?.name || "User"}</h3>
                {isAdmin && (
                  <Badge
                    variant="outline"
                    className="text-[10px] px-1.5 h-4 border-primary/30 text-primary"
                  >
                    Admin
                  </Badge>
                )}
              </div>
              <p className="text-sm text-muted-foreground">{user?.email || "No email"}</p>
              <p className="text-xs text-muted-foreground mt-1">
                Member since{" "}
                {user?.createdAt
                  ? new Date(user.createdAt).toLocaleDateString("en-US", {
                      month: "long",
                      year: "numeric",
                    })
                  : "Unknown"}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Security Section */}
      <Card className="border-border/50 bg-card">
        <CardHeader>
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Shield className="h-4 w-4 text-muted-foreground" />
            Security
          </CardTitle>
          <CardDescription className="text-xs">
            Authentication and access control settings.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between py-2">
            <div>
              <p className="text-sm font-medium">Authentication Method</p>
              <p className="text-xs text-muted-foreground">
                {user?.loginMethod || "OAuth"} authentication
              </p>
            </div>
            <Badge variant="outline" className="text-xs">
              Active
            </Badge>
          </div>
          <Separator className="bg-border/50" />
          <div className="flex items-center justify-between py-2">
            <div>
              <p className="text-sm font-medium">Platform Role</p>
              <p className="text-xs text-muted-foreground">
                {displayRoleDescription}
              </p>
            </div>
            <Badge
              variant={isAdmin ? "default" : isAccountOwner ? "default" : "secondary"}
              className={`text-xs capitalize ${
                isAccountOwner && !isAdmin ? "bg-amber-500/20 text-amber-400 border-amber-500/30" : ""
              }`}
            >
              {displayRole}
            </Badge>
          </div>
          <Separator className="bg-border/50" />
          <div className="flex items-center justify-between py-2">
            <div>
              <p className="text-sm font-medium">Last Sign In</p>
              <p className="text-xs text-muted-foreground">
                {user?.lastSignedIn
                  ? new Date(user.lastSignedIn).toLocaleString()
                  : "Unknown"}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Change Password Section — only for email-authenticated users */}
      {user?.loginMethod === "email" && <ChangePasswordCard />}

      {/* Phone Number — visible to anyone with an account selected */}
      {currentAccountId && (
        <PhoneNumberCard accountId={currentAccountId} />
      )}

      {/* Messaging Settings — visible to anyone with an account selected */}
      {showMessagingSettings && (
        <Card className="border-border/50 bg-card">
          <CardHeader>
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-muted-foreground" />
              Messaging
            </CardTitle>
            <CardDescription className="text-xs">
              Configure SMS and email credentials for your account.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-1 -mt-2">
            <IntegrationLink
              icon={MessageSquare}
              label="Messaging Credentials"
              description="Configure Twilio and SendGrid for this account"
              href="/settings/messaging"
              iconColor="text-emerald-500"
            />
          </CardContent>
        </Card>
      )}

      {/* Account Integrations — visible to anyone with an account selected */}
      {currentAccountId && (
        <FacebookIntegrationCard accountId={currentAccountId} />
      )}

      {/* Calendar Sync — visible to anyone with an account selected */}
      {currentAccountId && (
        <CalendarSyncCard accountId={currentAccountId} />
      )}

      {/* Missed Call Text-Back — visible to anyone with an account selected */}
      {currentAccountId && (
        <MissedCallTextBackCard accountId={currentAccountId} />
      )}

      {/* Admin Integrations */}
      {isAdmin && (
        <Card className="border-border/50 bg-card">
          <CardHeader>
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Palette className="h-4 w-4 text-muted-foreground" />
              Admin Integrations
            </CardTitle>
            <CardDescription className="text-xs">
              Manage platform-level service connections.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-1 -mt-2">
            <IntegrationLink
              icon={Facebook}
              label="Facebook Pages"
              description="Map Facebook pages to sub-accounts for lead routing"
              href="/settings/facebook-pages"
              iconColor="text-blue-500"
            />
          </CardContent>
        </Card>
      )}

      {/* Placeholder sections for future modules */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Card className="border-border/50 bg-card opacity-60">
          <CardContent className="pt-5 pb-4 px-5">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-lg bg-muted flex items-center justify-center">
                <Bell className="h-4 w-4 text-muted-foreground" />
              </div>
              <div>
                <p className="text-sm font-medium">Notifications</p>
                <p className="text-xs text-muted-foreground">Coming soon</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-border/50 bg-card opacity-60">
          <CardContent className="pt-5 pb-4 px-5">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-lg bg-muted flex items-center justify-center">
                <Key className="h-4 w-4 text-muted-foreground" />
              </div>
              <div>
                <p className="text-sm font-medium">API Keys</p>
                <p className="text-xs text-muted-foreground">Coming soon</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function ChangePasswordCard() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const changeMutation = trpc.subAccountAuth.changePassword.useMutation({
    onSuccess: () => {
      setSuccess(true);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setError("");
      // Hide success after 3 seconds
      setTimeout(() => setSuccess(false), 3000);
    },
    onError: (err) => {
      setError(err.message || "Failed to change password");
      setSuccess(false);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess(false);

    if (!currentPassword) {
      setError("Please enter your current password");
      return;
    }

    if (newPassword.length < 8) {
      setError("New password must be at least 8 characters");
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("New passwords do not match");
      return;
    }

    if (currentPassword === newPassword) {
      setError("New password must be different from current password");
      return;
    }

    changeMutation.mutate({ currentPassword, newPassword });
  };

  return (
    <Card className="border-border/50 bg-card">
      <CardHeader>
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Lock className="h-4 w-4 text-muted-foreground" />
          Change Password
        </CardTitle>
        <CardDescription className="text-xs">
          Update your account password. You'll need to enter your current
          password first.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4 max-w-sm">
          {error && (
            <Alert variant="destructive" className="py-2">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription className="text-sm">{error}</AlertDescription>
            </Alert>
          )}

          {success && (
            <Alert className="py-2 border-green-500/30 bg-green-500/10">
              <CheckCircle2 className="h-4 w-4 text-green-500" />
              <AlertDescription className="text-sm text-green-400">
                Password changed successfully!
              </AlertDescription>
            </Alert>
          )}

          <div className="space-y-2">
            <Label htmlFor="currentPassword" className="text-xs">
              Current Password
            </Label>
            <Input
              id="currentPassword"
              type="password"
              placeholder="Enter current password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              autoComplete="current-password"
              disabled={changeMutation.isPending}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="newPassword" className="text-xs">
              New Password
            </Label>
            <Input
              id="newPassword"
              type="password"
              placeholder="Min. 8 characters"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              autoComplete="new-password"
              disabled={changeMutation.isPending}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirmNewPassword" className="text-xs">
              Confirm New Password
            </Label>
            <Input
              id="confirmNewPassword"
              type="password"
              placeholder="Re-enter new password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              autoComplete="new-password"
              disabled={changeMutation.isPending}
            />
          </div>

          <Button
            type="submit"
            size="sm"
            disabled={changeMutation.isPending}
          >
            {changeMutation.isPending ? (
              <>
                <Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" />
                Updating...
              </>
            ) : (
              "Update Password"
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

/** Inline Facebook logo SVG */
function FacebookLogo({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
    </svg>
  );
}

function FacebookIntegrationCard({ accountId }: { accountId: number }) {
  const [isConnecting, setIsConnecting] = useState(false);
  const utils = trpc.useUtils();

  const { data: fbStatus, isLoading } = trpc.facebookOAuth.getStatus.useQuery(
    { accountId },
    { enabled: !!accountId }
  );

  const disconnectMutation = trpc.facebookOAuth.disconnect.useMutation({
    onSuccess: () => {
      utils.facebookOAuth.getStatus.invalidate({ accountId });
    },
  });

  const callbackMutation = trpc.facebookOAuth.handleCallback.useMutation({
    onSuccess: (result) => {
      setIsConnecting(false);
      utils.facebookOAuth.getStatus.invalidate({ accountId });
      // toast imported at top
      import("sonner").then(({ toast }) => {
        toast.success(
          `Facebook connected! ${result.pagesCount} page${result.pagesCount !== 1 ? "s" : ""} imported.`
        );
      });
    },
    onError: (err) => {
      setIsConnecting(false);
      import("sonner").then(({ toast }) => {
        toast.error(err.message || "Failed to connect Facebook");
      });
    },
  });

  const handleConnect = async () => {
    setIsConnecting(true);
    const redirectUri = `${window.location.origin}/settings`;

    try {
      const result = await utils.client.facebookOAuth.getOAuthUrl.query({
        accountId,
        redirectUri,
      });

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
        import("sonner").then(({ toast }) => {
          toast.error("Popup blocked. Please allow popups for this site.");
        });
        setIsConnecting(false);
        return;
      }

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
            }
          }
        } catch {
          // Cross-origin — still on Facebook's domain
        }
      }, 500);
    } catch (err: any) {
      setIsConnecting(false);
      import("sonner").then(({ toast }) => {
        toast.error(err.message || "Failed to start Facebook connection");
      });
    }
  };

  const handleDisconnect = () => {
    if (window.confirm("Are you sure you want to disconnect Facebook? This will remove all linked pages.")) {
      disconnectMutation.mutate({ accountId });
    }
  };

  return (
    <Card className="border-border/50 bg-card">
      <CardHeader>
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Link2 className="h-4 w-4 text-muted-foreground" />
          Integrations
        </CardTitle>
        <CardDescription className="text-xs">
          Connect external services to enable lead automation and sync.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Facebook */}
        <div className="flex items-start gap-4 p-3 rounded-lg border border-border/50">
          <div className="h-10 w-10 rounded-lg bg-blue-500/10 flex items-center justify-center shrink-0">
            <FacebookLogo className="h-5 w-5 text-blue-500" />
          </div>
          <div className="flex-1 min-w-0">
            <h4 className="text-sm font-medium">Facebook & Instagram Leads</h4>
            {isLoading ? (
              <p className="text-xs text-muted-foreground mt-1">Checking status...</p>
            ) : fbStatus?.connected ? (
              <div className="mt-1 space-y-2">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-[10px] bg-green-500/10 text-green-500 border-green-500/30">
                    <CheckCircle2 className="h-3 w-3 mr-1" />
                    Connected
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    as {fbStatus.userName}
                  </span>
                </div>
                {fbStatus.pages && fbStatus.pages.length > 0 && (
                  <p className="text-xs text-muted-foreground">
                    {fbStatus.pages.length} page{fbStatus.pages.length !== 1 ? "s" : ""} linked
                  </p>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  className="text-xs text-destructive border-destructive/30 hover:bg-destructive/10"
                  onClick={handleDisconnect}
                  disabled={disconnectMutation.isPending}
                >
                  {disconnectMutation.isPending ? (
                    <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                  ) : (
                    <Unlink className="h-3 w-3 mr-1" />
                  )}
                  Disconnect
                </Button>
              </div>
            ) : (
              <div className="mt-1">
                <p className="text-xs text-muted-foreground mb-2">
                  Capture leads from Facebook Lead Ads automatically.
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  className="text-xs border-blue-500/30 text-blue-400 hover:bg-blue-500/10"
                  onClick={handleConnect}
                  disabled={isConnecting || callbackMutation.isPending}
                >
                  {isConnecting || callbackMutation.isPending ? (
                    <>
                      <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                      Connecting...
                    </>
                  ) : (
                    <>
                      <ExternalLink className="h-3 w-3 mr-1" />
                      Connect Facebook
                    </>
                  )}
                </Button>
              </div>
            )}
          </div>
        </div>

        {/* Google My Business Placeholder */}
        <div className="flex items-start gap-4 p-3 rounded-lg border border-border/50 opacity-60">
          <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center shrink-0">
            <MapPin className="h-5 w-5 text-muted-foreground" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h4 className="text-sm font-medium">Google My Business</h4>
              <Badge variant="secondary" className="text-[10px]">
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
  );
}

/** Google Calendar SVG icon */
function GoogleCalendarIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none">
      <rect x="3" y="3" width="18" height="18" rx="3" fill="#4285F4" />
      <rect x="5" y="8" width="14" height="12" rx="1" fill="white" />
      <rect x="3" y="3" width="18" height="5" rx="2" fill="#4285F4" />
      <circle cx="8" cy="6" r="1" fill="white" />
      <circle cx="16" cy="6" r="1" fill="white" />
      <rect x="7" y="11" width="3" height="2" rx="0.5" fill="#4285F4" />
      <rect x="7" y="15" width="3" height="2" rx="0.5" fill="#4285F4" />
      <rect x="12" y="11" width="3" height="2" rx="0.5" fill="#4285F4" />
      <rect x="12" y="15" width="3" height="2" rx="0.5" fill="#34A853" />
    </svg>
  );
}

/** Outlook Calendar SVG icon */
function OutlookCalendarIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none">
      <rect x="3" y="3" width="18" height="18" rx="3" fill="#0078D4" />
      <rect x="5" y="8" width="14" height="12" rx="1" fill="white" />
      <rect x="3" y="3" width="18" height="5" rx="2" fill="#0078D4" />
      <circle cx="8" cy="6" r="1" fill="white" />
      <circle cx="16" cy="6" r="1" fill="white" />
      <rect x="7" y="11" width="3" height="2" rx="0.5" fill="#0078D4" />
      <rect x="7" y="15" width="3" height="2" rx="0.5" fill="#0078D4" />
      <rect x="12" y="11" width="3" height="2" rx="0.5" fill="#0078D4" />
      <rect x="12" y="15" width="3" height="2" rx="0.5" fill="#50E6FF" />
    </svg>
  );
}

function CalendarSyncCard({ accountId }: { accountId: number }) {
  const utils = trpc.useUtils();

  // Fetch connected calendar integrations
  const { data: integrations, isLoading } = trpc.calendarSync.listIntegrations.useQuery(
    { accountId },
    { enabled: !!accountId }
  );

  const googleIntegration = integrations?.find((i) => i.provider === "google");
  const outlookIntegration = integrations?.find((i) => i.provider === "outlook");

  const disconnectMutation = trpc.calendarSync.disconnect.useMutation({
    onSuccess: () => {
      utils.calendarSync.listIntegrations.invalidate({ accountId });
      import("sonner").then(({ toast }) => {
        toast.success("Calendar disconnected successfully.");
      });
    },
    onError: (err) => {
      import("sonner").then(({ toast }) => {
        toast.error(err.message || "Failed to disconnect calendar");
      });
    },
  });

  const handleConnectGoogle = async () => {
    try {
      const result = await utils.client.calendarSync.getGoogleOAuthUrl.query({
        accountId,
        origin: window.location.origin,
      });
      window.location.href = result.url;
    } catch (err: any) {
      import("sonner").then(({ toast }) => {
        toast.error(err.message || "Failed to start Google Calendar connection");
      });
    }
  };

  const handleConnectOutlook = async () => {
    try {
      const result = await utils.client.calendarSync.getOutlookOAuthUrl.query({
        accountId,
        origin: window.location.origin,
      });
      window.location.href = result.url;
    } catch (err: any) {
      import("sonner").then(({ toast }) => {
        toast.error(err.message || "Failed to start Outlook Calendar connection");
      });
    }
  };

  const handleDisconnect = (id: number, provider: string) => {
    if (window.confirm(`Are you sure you want to disconnect your ${provider === "google" ? "Google" : "Outlook"} Calendar?`)) {
      disconnectMutation.mutate({ id });
    }
  };

  return (
    <Card className="border-border/50 bg-card">
      <CardHeader>
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <CalendarDays className="h-4 w-4 text-muted-foreground" />
          Calendar Sync
        </CardTitle>
        <CardDescription className="text-xs">
          Connect your external calendars to automatically sync appointments and block busy times on your booking page.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Google Calendar */}
        <div className="flex items-start gap-4 p-3 rounded-lg border border-border/50">
          <div className="h-10 w-10 rounded-lg bg-blue-500/10 flex items-center justify-center shrink-0">
            <GoogleCalendarIcon className="h-6 w-6" />
          </div>
          <div className="flex-1 min-w-0">
            <h4 className="text-sm font-medium">Google Calendar</h4>
            {isLoading ? (
              <p className="text-xs text-muted-foreground mt-1">Checking status...</p>
            ) : googleIntegration ? (
              <div className="mt-1 space-y-2">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-[10px] bg-green-500/10 text-green-500 border-green-500/30">
                    <CheckCircle2 className="h-3 w-3 mr-1" />
                    Connected
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    {googleIntegration.externalEmail}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Appointments will sync to your Google Calendar and busy times will block booking slots.
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  className="text-xs text-destructive border-destructive/30 hover:bg-destructive/10"
                  onClick={() => handleDisconnect(googleIntegration.id, "google")}
                  disabled={disconnectMutation.isPending}
                >
                  {disconnectMutation.isPending ? (
                    <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                  ) : (
                    <Unlink className="h-3 w-3 mr-1" />
                  )}
                  Disconnect
                </Button>
              </div>
            ) : (
              <div className="mt-1">
                <p className="text-xs text-muted-foreground mb-2">
                  Sync appointments and block busy times from your Google Calendar.
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  className="text-xs border-blue-500/30 text-blue-400 hover:bg-blue-500/10"
                  onClick={handleConnectGoogle}
                >
                  <ExternalLink className="h-3 w-3 mr-1" />
                  Connect Google Calendar
                </Button>
              </div>
            )}
          </div>
        </div>

        {/* Outlook Calendar */}
        <div className="flex items-start gap-4 p-3 rounded-lg border border-border/50">
          <div className="h-10 w-10 rounded-lg bg-sky-500/10 flex items-center justify-center shrink-0">
            <OutlookCalendarIcon className="h-6 w-6" />
          </div>
          <div className="flex-1 min-w-0">
            <h4 className="text-sm font-medium">Outlook Calendar</h4>
            {isLoading ? (
              <p className="text-xs text-muted-foreground mt-1">Checking status...</p>
            ) : outlookIntegration ? (
              <div className="mt-1 space-y-2">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-[10px] bg-green-500/10 text-green-500 border-green-500/30">
                    <CheckCircle2 className="h-3 w-3 mr-1" />
                    Connected
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    {outlookIntegration.externalEmail}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Appointments will sync to your Outlook Calendar and busy times will block booking slots.
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  className="text-xs text-destructive border-destructive/30 hover:bg-destructive/10"
                  onClick={() => handleDisconnect(outlookIntegration.id, "outlook")}
                  disabled={disconnectMutation.isPending}
                >
                  {disconnectMutation.isPending ? (
                    <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                  ) : (
                    <Unlink className="h-3 w-3 mr-1" />
                  )}
                  Disconnect
                </Button>
              </div>
            ) : (
              <div className="mt-1">
                <p className="text-xs text-muted-foreground mb-2">
                  Sync appointments and block busy times from your Outlook Calendar.
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  className="text-xs border-sky-500/30 text-sky-400 hover:bg-sky-500/10"
                  onClick={handleConnectOutlook}
                >
                  <ExternalLink className="h-3 w-3 mr-1" />
                  Connect Outlook Calendar
                </Button>
              </div>
            )}
          </div>
        </div>

        {/* Info note */}
        <div className="text-xs text-muted-foreground bg-muted/50 rounded-lg p-3">
          <p className="flex items-start gap-2">
            <RefreshCw className="h-3.5 w-3.5 mt-0.5 shrink-0" />
            <span>
              When connected, new appointments booked through your booking page will automatically appear in your external calendar.
              Busy times from your external calendar will also block those slots on your booking page.
            </span>
          </p>
        </div>
      </CardContent>
    </Card>
  );
}


function MissedCallTextBackCard({ accountId }: { accountId: number }) {
  const utils = trpc.useUtils();
  const { data: settings, isLoading } = trpc.missedCallTextBack.getSettings.useQuery(
    { accountId },
    { refetchOnWindowFocus: false }
  );

  const [enabled, setEnabled] = React.useState(false);
  const [message, setMessage] = React.useState(
    "Hey, sorry I missed your call! How can I help you?"
  );
  const [delayMinutes, setDelayMinutes] = React.useState(1);
  const [hasChanges, setHasChanges] = React.useState(false);

  // Sync state from server
  React.useEffect(() => {
    if (settings) {
      setEnabled(settings.enabled);
      setMessage(settings.message);
      setDelayMinutes(settings.delayMinutes);
      setHasChanges(false);
    }
  }, [settings]);

  const saveMutation = trpc.missedCallTextBack.saveSettings.useMutation({
    onSuccess: () => {
      utils.missedCallTextBack.getSettings.invalidate({ accountId });
      setHasChanges(false);
    },
  });

  const handleSave = () => {
    saveMutation.mutate({
      accountId,
      enabled,
      message: message.trim(),
      delayMinutes,
    });
  };

  const handleToggle = () => {
    setEnabled(!enabled);
    setHasChanges(true);
  };

  if (isLoading) {
    return (
      <Card className="border-border/50 bg-card">
        <CardContent className="py-8 flex items-center justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-border/50 bg-card">
      <CardHeader>
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <PhoneMissed className="h-4 w-4 text-muted-foreground" />
          Missed Call Text-Back
        </CardTitle>
        <CardDescription className="text-xs">
          Automatically send a text message when an inbound call is missed.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Enable/Disable Toggle */}
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label className="text-sm font-medium">Enable Text-Back</Label>
            <p className="text-xs text-muted-foreground">
              Send an automatic SMS to callers when you miss their call
            </p>
          </div>
          <button
            onClick={handleToggle}
            className="relative focus:outline-none"
            aria-label="Toggle missed call text-back"
          >
            {enabled ? (
              <ToggleRight className="h-8 w-8 text-amber-500 transition-colors" />
            ) : (
              <ToggleLeft className="h-8 w-8 text-muted-foreground transition-colors" />
            )}
          </button>
        </div>

        <Separator />

        {/* Message Text */}
        <div className="space-y-2">
          <Label htmlFor="textback-message" className="text-sm font-medium flex items-center gap-1.5">
            <MessageSquare className="h-3.5 w-3.5" />
            Message
          </Label>
          <textarea
            id="textback-message"
            value={message}
            onChange={(e) => {
              setMessage(e.target.value);
              setHasChanges(true);
            }}
            placeholder="Hey, sorry I missed your call! How can I help you?"
            rows={3}
            maxLength={500}
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring resize-none"
          />
          <p className="text-xs text-muted-foreground text-right">
            {message.length}/500 characters
          </p>
        </div>

        {/* Delay Selector */}
        <div className="space-y-2">
          <Label className="text-sm font-medium flex items-center gap-1.5">
            <Clock className="h-3.5 w-3.5" />
            Delay Before Sending
          </Label>
          <div className="flex gap-2">
            {[
              { value: 0, label: "Immediately" },
              { value: 1, label: "1 minute" },
              { value: 5, label: "5 minutes" },
            ].map((option) => (
              <button
                key={option.value}
                onClick={() => {
                  setDelayMinutes(option.value);
                  setHasChanges(true);
                }}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors border ${
                  delayMinutes === option.value
                    ? "bg-amber-500/20 border-amber-500/50 text-amber-400"
                    : "bg-muted/50 border-border text-muted-foreground hover:bg-muted"
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        {/* Save Button */}
        <div className="flex items-center justify-between pt-2">
          {saveMutation.isSuccess && !hasChanges && (
            <div className="flex items-center gap-1.5 text-xs text-emerald-400">
              <CheckCircle2 className="h-3.5 w-3.5" />
              Settings saved
            </div>
          )}
          {saveMutation.isError && (
            <div className="flex items-center gap-1.5 text-xs text-red-400">
              <AlertCircle className="h-3.5 w-3.5" />
              Failed to save
            </div>
          )}
          {!saveMutation.isSuccess && !saveMutation.isError && <div />}
          <Button
            onClick={handleSave}
            disabled={!hasChanges || saveMutation.isPending || !message.trim()}
            size="sm"
            className="bg-amber-600 hover:bg-amber-700 text-white"
          >
            {saveMutation.isPending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
            ) : (
              <Save className="h-3.5 w-3.5 mr-1.5" />
            )}
            Save Settings
          </Button>
        </div>

        {/* Info note */}
        <div className="rounded-lg bg-muted/30 p-3 mt-2">
          <p className="text-xs text-muted-foreground leading-relaxed">
            <span className="font-medium text-foreground">Setup required: </span>
            <span>
              Configure your Twilio number's voice status callback URL to{" "}
              <code className="text-xs bg-muted px-1 py-0.5 rounded">
                {window.location.origin}/api/webhooks/twilio/voice-status
              </code>{" "}
              in your Twilio console for this feature to work.
            </span>
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

// ─────────────────────────────────────────────
// Phone Number Management Card
// ─────────────────────────────────────────────

const US_STATES = [
  { code: "AL", name: "Alabama" }, { code: "AK", name: "Alaska" }, { code: "AZ", name: "Arizona" },
  { code: "AR", name: "Arkansas" }, { code: "CA", name: "California" }, { code: "CO", name: "Colorado" },
  { code: "CT", name: "Connecticut" }, { code: "DE", name: "Delaware" }, { code: "FL", name: "Florida" },
  { code: "GA", name: "Georgia" }, { code: "HI", name: "Hawaii" }, { code: "ID", name: "Idaho" },
  { code: "IL", name: "Illinois" }, { code: "IN", name: "Indiana" }, { code: "IA", name: "Iowa" },
  { code: "KS", name: "Kansas" }, { code: "KY", name: "Kentucky" }, { code: "LA", name: "Louisiana" },
  { code: "ME", name: "Maine" }, { code: "MD", name: "Maryland" }, { code: "MA", name: "Massachusetts" },
  { code: "MI", name: "Michigan" }, { code: "MN", name: "Minnesota" }, { code: "MS", name: "Mississippi" },
  { code: "MO", name: "Missouri" }, { code: "MT", name: "Montana" }, { code: "NE", name: "Nebraska" },
  { code: "NV", name: "Nevada" }, { code: "NH", name: "New Hampshire" }, { code: "NJ", name: "New Jersey" },
  { code: "NM", name: "New Mexico" }, { code: "NY", name: "New York" }, { code: "NC", name: "North Carolina" },
  { code: "ND", name: "North Dakota" }, { code: "OH", name: "Ohio" }, { code: "OK", name: "Oklahoma" },
  { code: "OR", name: "Oregon" }, { code: "PA", name: "Pennsylvania" }, { code: "RI", name: "Rhode Island" },
  { code: "SC", name: "South Carolina" }, { code: "SD", name: "South Dakota" }, { code: "TN", name: "Tennessee" },
  { code: "TX", name: "Texas" }, { code: "UT", name: "Utah" }, { code: "VT", name: "Vermont" },
  { code: "VA", name: "Virginia" }, { code: "WA", name: "Washington" }, { code: "WV", name: "West Virginia" },
  { code: "WI", name: "Wisconsin" }, { code: "WY", name: "Wyoming" }, { code: "DC", name: "Washington DC" },
];

function formatPhoneNumber(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 11 && digits.startsWith("1")) {
    return `+1 (${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
  }
  if (digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
  return phone;
}

function PhoneNumberCard({ accountId }: { accountId: number }) {
  const [showSearchModal, setShowSearchModal] = useState(false);
  const [showReleaseDialog, setShowReleaseDialog] = useState(false);
  const [showConfirmPurchase, setShowConfirmPurchase] = useState(false);
  const [selectedNumber, setSelectedNumber] = useState<{
    phoneNumber: string;
    friendlyName: string;
    locality: string;
    region: string;
    monthlyCost: number;
  } | null>(null);

  // Search state
  const [searchMode, setSearchMode] = useState<"areaCode" | "location">("areaCode");
  const [areaCode, setAreaCode] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [searchTriggered, setSearchTriggered] = useState(false);

  const utils = trpc.useUtils();

  // Get assigned number
  const { data: assigned, isLoading: assignedLoading } =
    trpc.twilioPhoneNumber.getAssigned.useQuery(
      { accountId },
      { enabled: !!accountId }
    );

  // Search available numbers
  const searchInput = searchTriggered
    ? {
        accountId,
        ...(searchMode === "areaCode" && areaCode.length === 3
          ? { areaCode }
          : {}),
        ...(searchMode === "location" && city ? { locality: city } : {}),
        ...(searchMode === "location" && state ? { state } : {}),
      }
    : null;

  const { data: availableNumbers, isLoading: searching, error: searchError } =
    trpc.twilioPhoneNumber.searchAvailable.useQuery(searchInput as any, {
      enabled: !!searchInput && searchTriggered,
    });

  // Purchase mutation
  const purchaseMutation = trpc.twilioPhoneNumber.purchase.useMutation({
    onSuccess: () => {
      utils.twilioPhoneNumber.getAssigned.invalidate({ accountId });
      setShowSearchModal(false);
      setShowConfirmPurchase(false);
      setSelectedNumber(null);
      resetSearch();
    },
  });

  // Release mutation
  const releaseMutation = trpc.twilioPhoneNumber.release.useMutation({
    onSuccess: () => {
      utils.twilioPhoneNumber.getAssigned.invalidate({ accountId });
      setShowReleaseDialog(false);
    },
  });

  function resetSearch() {
    setAreaCode("");
    setCity("");
    setState("");
    setSearchTriggered(false);
    setSelectedNumber(null);
  }

  function handleSearch() {
    if (searchMode === "areaCode" && areaCode.length !== 3) return;
    if (searchMode === "location" && !city && !state) return;
    setSearchTriggered(true);
  }

  function handleSelectNumber(num: typeof availableNumbers extends (infer T)[] | undefined ? T : never) {
    if (!num) return;
    setSelectedNumber({
      phoneNumber: num.phoneNumber,
      friendlyName: num.friendlyName,
      locality: num.locality,
      region: num.region,
      monthlyCost: num.monthlyCost,
    });
    setShowConfirmPurchase(true);
  }

  function handleConfirmPurchase() {
    if (!selectedNumber) return;
    purchaseMutation.mutate({
      accountId,
      phoneNumber: selectedNumber.phoneNumber,
      appUrl: window.location.origin,
    });
  }

  function handleRelease() {
    releaseMutation.mutate({ accountId });
  }

  return (
    <>
      <Card className="border-border/50 bg-card">
        <CardHeader>
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Phone className="h-4 w-4 text-muted-foreground" />
            Phone Number
          </CardTitle>
          <CardDescription className="text-xs">
            Manage the phone number used for SMS and calls in this account.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {assignedLoading ? (
            <div className="flex items-center gap-2 py-3">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Loading...</span>
            </div>
          ) : assigned?.hasNumber ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                    <Phone className="h-5 w-5 text-emerald-500" />
                  </div>
                  <div>
                    <p className="text-base font-semibold tracking-tight">
                      {formatPhoneNumber(assigned.phoneNumber!)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Active &middot; Used for SMS &amp; voice
                    </p>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-destructive hover:text-destructive hover:bg-destructive/10"
                  onClick={() => setShowReleaseDialog(true)}
                >
                  <Trash2 className="h-4 w-4 mr-1" />
                  Release
                </Button>
              </div>
              <div className="rounded-lg bg-muted/30 p-3">
                <p className="text-xs text-muted-foreground leading-relaxed">
                  <span className="font-medium text-foreground">Billing: </span>
                  This number costs approximately $1.15/month, billed to your Twilio account.
                  SMS and voice usage are billed separately by Twilio.
                </p>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center py-6 gap-3">
              <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center">
                <Phone className="h-5 w-5 text-muted-foreground" />
              </div>
              <div className="text-center">
                <p className="text-sm font-medium">No phone number assigned</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Get a local phone number to send SMS and receive calls.
                </p>
              </div>
              <Button
                onClick={() => setShowSearchModal(true)}
                className="mt-2"
              >
                <Phone className="h-4 w-4 mr-2" />
                Get a Phone Number
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Search & Purchase Modal */}
      <Dialog
        open={showSearchModal}
        onOpenChange={(open) => {
          setShowSearchModal(open);
          if (!open) resetSearch();
        }}
      >
        <DialogContent className="max-w-lg max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>Get a Phone Number</DialogTitle>
            <DialogDescription>
              Search for available local phone numbers by area code or location.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 flex-1 overflow-hidden flex flex-col">
            {/* Search mode tabs */}
            <div className="flex gap-2">
              <Button
                variant={searchMode === "areaCode" ? "default" : "outline"}
                size="sm"
                onClick={() => {
                  setSearchMode("areaCode");
                  setSearchTriggered(false);
                }}
              >
                By Area Code
              </Button>
              <Button
                variant={searchMode === "location" ? "default" : "outline"}
                size="sm"
                onClick={() => {
                  setSearchMode("location");
                  setSearchTriggered(false);
                }}
              >
                By Location
              </Button>
            </div>

            {/* Search inputs */}
            {searchMode === "areaCode" ? (
              <div className="flex gap-2">
                <Input
                  placeholder="Enter area code (e.g. 305)"
                  value={areaCode}
                  onChange={(e) => {
                    const val = e.target.value.replace(/\D/g, "").slice(0, 3);
                    setAreaCode(val);
                    setSearchTriggered(false);
                  }}
                  className="flex-1"
                  maxLength={3}
                />
                <Button
                  onClick={handleSearch}
                  disabled={areaCode.length !== 3 || searching}
                >
                  {searching ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Search className="h-4 w-4" />
                  )}
                </Button>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="flex gap-2">
                  <Input
                    placeholder="City (optional)"
                    value={city}
                    onChange={(e) => {
                      setCity(e.target.value);
                      setSearchTriggered(false);
                    }}
                    className="flex-1"
                  />
                  <Select
                    value={state}
                    onValueChange={(val) => {
                      setState(val);
                      setSearchTriggered(false);
                    }}
                  >
                    <SelectTrigger className="w-[140px]">
                      <SelectValue placeholder="State" />
                    </SelectTrigger>
                    <SelectContent>
                      {US_STATES.map((s) => (
                        <SelectItem key={s.code} value={s.code}>
                          {s.code} — {s.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button
                  onClick={handleSearch}
                  disabled={(!city && !state) || searching}
                  className="w-full"
                >
                  {searching ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <Search className="h-4 w-4 mr-2" />
                  )}
                  Search Numbers
                </Button>
              </div>
            )}

            {/* Error */}
            {searchError && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription className="text-xs">
                  {searchError.message}
                </AlertDescription>
              </Alert>
            )}

            {/* Results */}
            {searchTriggered && (
              <div className="flex-1 overflow-y-auto -mx-1 px-1">
                {searching ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                    <span className="ml-2 text-sm text-muted-foreground">
                      Searching available numbers...
                    </span>
                  </div>
                ) : availableNumbers && availableNumbers.length > 0 ? (
                  <div className="space-y-1.5">
                    <p className="text-xs text-muted-foreground mb-2">
                      {availableNumbers.length} number{availableNumbers.length !== 1 ? "s" : ""} found
                    </p>
                    {availableNumbers.map((num) => (
                      <button
                        key={num.phoneNumber}
                        onClick={() => handleSelectNumber(num)}
                        className="w-full flex items-center justify-between p-3 rounded-lg border border-border/50 hover:border-primary/50 hover:bg-accent/50 transition-all text-left group"
                      >
                        <div className="flex items-center gap-3">
                          <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                            <Phone className="h-4 w-4 text-primary" />
                          </div>
                          <div>
                            <p className="text-sm font-medium">
                              {formatPhoneNumber(num.phoneNumber)}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {num.locality ? `${num.locality}, ` : ""}
                              {num.region || ""}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-semibold text-emerald-500">
                            ${num.monthlyCost.toFixed(2)}
                          </p>
                          <p className="text-[10px] text-muted-foreground">/month</p>
                        </div>
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="flex flex-col items-center py-8 text-center">
                    <XCircle className="h-8 w-8 text-muted-foreground/50 mb-2" />
                    <p className="text-sm text-muted-foreground">
                      No numbers found for this search.
                    </p>
                    <p className="text-xs text-muted-foreground/70 mt-1">
                      Try a different area code or location.
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Purchase Confirmation Dialog */}
      <AlertDialog
        open={showConfirmPurchase}
        onOpenChange={(open) => {
          setShowConfirmPurchase(open);
          if (!open) setSelectedNumber(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Purchase</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3">
                <p>You are about to purchase the following phone number:</p>
                <div className="rounded-lg bg-muted/50 p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Number</span>
                    <span className="text-sm font-semibold text-foreground">
                      {selectedNumber
                        ? formatPhoneNumber(selectedNumber.phoneNumber)
                        : ""}
                    </span>
                  </div>
                  {selectedNumber?.locality && (
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Location</span>
                      <span className="text-sm text-foreground">
                        {selectedNumber.locality}
                        {selectedNumber.region ? `, ${selectedNumber.region}` : ""}
                      </span>
                    </div>
                  )}
                  <Separator className="bg-border/50" />
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Monthly cost</span>
                    <span className="text-sm font-semibold text-emerald-500">
                      ${selectedNumber?.monthlyCost.toFixed(2)}/month
                    </span>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  This number will be billed to your Twilio account at $1.15/month.
                  SMS and voice usage are billed separately. The number will be
                  automatically configured for inbound SMS and voice webhooks.
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={purchaseMutation.isPending}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmPurchase}
              disabled={purchaseMutation.isPending}
              className="bg-primary"
            >
              {purchaseMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Purchasing...
                </>
              ) : (
                <>
                  <DollarSign className="h-4 w-4 mr-1" />
                  Confirm Purchase
                </>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
          {purchaseMutation.error && (
            <Alert variant="destructive" className="mt-2">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription className="text-xs">
                {purchaseMutation.error.message}
              </AlertDescription>
            </Alert>
          )}
        </AlertDialogContent>
      </AlertDialog>

      {/* Release Confirmation Dialog */}
      <AlertDialog
        open={showReleaseDialog}
        onOpenChange={setShowReleaseDialog}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Release Phone Number</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to release{" "}
              <span className="font-semibold text-foreground">
                {assigned?.phoneNumber
                  ? formatPhoneNumber(assigned.phoneNumber)
                  : "this number"}
              </span>
              ? This action cannot be undone. The number will be returned to
              Twilio's pool and may be assigned to someone else. All inbound
              SMS and calls to this number will stop working.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={releaseMutation.isPending}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRelease}
              disabled={releaseMutation.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {releaseMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Releasing...
                </>
              ) : (
                <>
                  <Trash2 className="h-4 w-4 mr-1" />
                  Release Number
                </>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
          {releaseMutation.error && (
            <Alert variant="destructive" className="mt-2">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription className="text-xs">
                {releaseMutation.error.message}
              </AlertDescription>
            </Alert>
          )}
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
