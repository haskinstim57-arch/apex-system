import { useState } from "react";
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

        {/* Google Placeholder */}
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
