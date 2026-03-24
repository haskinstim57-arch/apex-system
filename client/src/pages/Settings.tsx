import React, { useState, useMemo } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
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
  ArrowRightLeft,
  BarChart3,
  Route,
  Shuffle,
  Users2,
  MessageSquareText,
  PhoneCall,
  PhoneIncoming,
  PhoneOutgoing,
  Send,
  Inbox,
  CalendarRange,
  Info,
  Ban,
  Timer,
  FileText,
  Plus,
  Edit3,
  Copy,
} from "lucide-react";
import { toast } from "sonner";
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
      <Card className="bg-white border-0 card-shadow">
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
      <Card className="bg-white border-0 card-shadow">
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
                isAccountOwner && !isAdmin ? "bg-amber-500/20 text-amber-600 border-amber-200" : ""
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
        <Card className="bg-white border-0 card-shadow">
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

      {/* Call Scripts — visible to account owners and admins with an account selected */}
      {currentAccountId && (
        <CallScriptsCard accountId={currentAccountId} />
      )}

      {/* Lead Routing Rules — visible to account owners and admins with an account selected */}
      {currentAccountId && (
        <LeadRoutingRulesCard accountId={currentAccountId} />
      )}

      {/* Admin Integrations */}
      {isAdmin && (
        <Card className="bg-white border-0 card-shadow">
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
        <Card className="bg-white border-0 card-shadow opacity-60">
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
        <Card className="bg-white border-0 card-shadow opacity-60">
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
    <Card className="bg-white border-0 card-shadow">
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
            <Alert className="py-2 border-green-200 bg-green-500/10">
              <CheckCircle2 className="h-4 w-4 text-green-500" />
              <AlertDescription className="text-sm text-green-600">
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
  const [showWebhookInfo, setShowWebhookInfo] = useState(false);
  const utils = trpc.useUtils();

  const { data: fbStatus, isLoading } = trpc.facebookOAuth.getStatus.useQuery(
    { accountId },
    { enabled: !!accountId }
  );

  const { data: webhookInfo } = trpc.facebookOAuth.getWebhookInfo.useQuery(
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
    <Card className="bg-white border-0 card-shadow">
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
                  <Badge variant="outline" className="text-[10px] bg-green-500/10 text-green-500 border-green-200">
                    <CheckCircle2 className="h-3 w-3 mr-1" />
                    Connected
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    as {fbStatus.userName}
                  </span>
                </div>
                {fbStatus.pages && fbStatus.pages.length > 0 && (
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">
                      {fbStatus.pages.length} page{fbStatus.pages.length !== 1 ? "s" : ""} linked
                    </p>
                    <div className="space-y-1">
                      {fbStatus.pages.map((page: any) => (
                        <div key={page.id} className="flex items-center gap-2 text-xs">
                          <div className={`h-1.5 w-1.5 rounded-full ${page.isSubscribed ? 'bg-green-500' : 'bg-amber-500'}`} />
                          <span className="text-muted-foreground">{page.pageName || page.facebookPageId}</span>
                          {page.isSubscribed ? (
                            <span className="text-[10px] text-green-600">Subscribed</span>
                          ) : (
                            <span className="text-[10px] text-amber-600">Not subscribed</span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-xs"
                    onClick={() => setShowWebhookInfo(!showWebhookInfo)}
                  >
                    <Link2 className="h-3 w-3 mr-1" />
                    Webhook Setup
                  </Button>
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
                {showWebhookInfo && (
                  <div className="mt-2 p-3 rounded-lg bg-muted/50 border border-border/50 space-y-3">
                    <p className="text-xs font-medium">Facebook App Webhook Configuration</p>
                    <p className="text-[11px] text-muted-foreground">Enter these values in your Facebook App → Products → Webhooks → Edit Subscription:</p>
                    <div className="space-y-2">
                      <div>
                        <p className="text-[11px] text-muted-foreground mb-1">Callback URL</p>
                        <div className="flex items-center gap-1.5">
                          <code className="text-[11px] bg-white px-2 py-1 rounded border font-mono truncate flex-1">
                            {window.location.origin}/api/webhooks/facebook
                          </code>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0 shrink-0"
                            onClick={() => {
                              navigator.clipboard.writeText(`${window.location.origin}/api/webhooks/facebook`);
                              toast.success("Copied!");
                            }}
                          >
                            <Copy className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                      <div>
                        <p className="text-[11px] text-muted-foreground mb-1">Verify Token</p>
                        <div className="flex items-center gap-1.5">
                          <code className="text-[11px] bg-white px-2 py-1 rounded border font-mono flex-1">
                            {webhookInfo?.verifyToken || "(not configured)"}
                          </code>
                          {webhookInfo?.verifyToken && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 w-6 p-0 shrink-0"
                              onClick={() => {
                                navigator.clipboard.writeText(webhookInfo.verifyToken!);
                                toast.success("Copied!");
                              }}
                            >
                              <Copy className="h-3 w-3" />
                            </Button>
                          )}
                        </div>
                      </div>
                      <div className="text-[11px] text-muted-foreground">
                        <strong>Subscribed Fields:</strong> leadgen
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="mt-1 space-y-2">
                <p className="text-xs text-muted-foreground">
                  Capture leads from Facebook Lead Ads automatically.
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-xs border-blue-200 text-blue-600 hover:bg-blue-500/10"
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
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-xs"
                    onClick={() => setShowWebhookInfo(!showWebhookInfo)}
                  >
                    <Link2 className="h-3 w-3 mr-1" />
                    Webhook Setup
                  </Button>
                </div>
                {showWebhookInfo && (
                  <div className="mt-2 p-3 rounded-lg bg-muted/50 border border-border/50 space-y-3">
                    <p className="text-xs font-medium">Facebook App Webhook Configuration</p>
                    <p className="text-[11px] text-muted-foreground">Enter these values in your Facebook App → Products → Webhooks → Edit Subscription:</p>
                    <div className="space-y-2">
                      <div>
                        <p className="text-[11px] text-muted-foreground mb-1">Callback URL</p>
                        <div className="flex items-center gap-1.5">
                          <code className="text-[11px] bg-white px-2 py-1 rounded border font-mono truncate flex-1">
                            {window.location.origin}/api/webhooks/facebook
                          </code>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0 shrink-0"
                            onClick={() => {
                              navigator.clipboard.writeText(`${window.location.origin}/api/webhooks/facebook`);
                              toast.success("Copied!");
                            }}
                          >
                            <Copy className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                      <div>
                        <p className="text-[11px] text-muted-foreground mb-1">Verify Token</p>
                        <div className="flex items-center gap-1.5">
                          <code className="text-[11px] bg-white px-2 py-1 rounded border font-mono flex-1">
                            {webhookInfo?.verifyToken || "(not configured)"}
                          </code>
                          {webhookInfo?.verifyToken && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 w-6 p-0 shrink-0"
                              onClick={() => {
                                navigator.clipboard.writeText(webhookInfo.verifyToken!);
                                toast.success("Copied!");
                              }}
                            >
                              <Copy className="h-3 w-3" />
                            </Button>
                          )}
                        </div>
                      </div>
                      <div className="text-[11px] text-muted-foreground">
                        <strong>Subscribed Fields:</strong> leadgen
                      </div>
                    </div>
                  </div>
                )}
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
      disconnectMutation.mutate({ id, accountId });
    }
  };

  return (
    <Card className="bg-white border-0 card-shadow">
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
                  <Badge variant="outline" className="text-[10px] bg-green-500/10 text-green-500 border-green-200">
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
                  className="text-xs border-blue-200 text-blue-600 hover:bg-blue-500/10"
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
                  <Badge variant="outline" className="text-[10px] bg-green-500/10 text-green-500 border-green-200">
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
      <Card className="bg-white border-0 card-shadow">
        <CardContent className="py-8 flex items-center justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-white border-0 card-shadow">
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
                    ? "bg-amber-500/20 border-amber-500/50 text-amber-600"
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
            <div className="flex items-center gap-1.5 text-xs text-emerald-600">
              <CheckCircle2 className="h-3.5 w-3.5" />
              Settings saved
            </div>
          )}
          {saveMutation.isError && (
            <div className="flex items-center gap-1.5 text-xs text-red-500">
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
  const [showPortModal, setShowPortModal] = useState(false);
  const [activeTab, setActiveTab] = useState("manage");
  const [selectedNumber, setSelectedNumber] = useState<{
    phoneNumber: string;
    friendlyName: string;
    locality: string;
    region: string;
    monthlyCost: number;
    numberType: string;
  } | null>(null);

  // Search state
  const [searchMode, setSearchMode] = useState<"areaCode" | "location">("areaCode");
  const [numberType, setNumberType] = useState<"local" | "tollFree">("local");
  const [areaCode, setAreaCode] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [searchTriggered, setSearchTriggered] = useState(false);

  // Port form state
  const [portPhone, setPortPhone] = useState("");
  const [portCarrier, setPortCarrier] = useState("");
  const [portAccountNum, setPortAccountNum] = useState("");
  const [portPin, setPortPin] = useState("");
  const [portName, setPortName] = useState("");

  // Usage date range
  const [usagePeriod, setUsagePeriod] = useState<"current" | "last" | "custom">("current");

  const utils = trpc.useUtils();

  // Get assigned number
  const { data: assigned, isLoading: assignedLoading } =
    trpc.twilioPhoneNumber.getAssigned.useQuery(
      { accountId },
      { enabled: !!accountId }
    );

  // Search available numbers (with numberType)
  const searchInput = searchTriggered
    ? {
        accountId,
        numberType,
        ...(searchMode === "areaCode" && areaCode.length === 3
          ? { areaCode }
          : {}),
        ...(searchMode === "location" && numberType === "local" && city ? { locality: city } : {}),
        ...(searchMode === "location" && numberType === "local" && state ? { state } : {}),
      }
    : null;

  const { data: availableNumbers, isLoading: searching, error: searchError } =
    trpc.twilioPhoneNumber.searchAvailable.useQuery(searchInput as any, {
      enabled: !!searchInput && searchTriggered,
    });

  // Port requests — auto-refresh every 30s when there are active requests
  const { data: portRequests } = trpc.twilioPhoneNumber.getPortRequests.useQuery(
    { accountId },
    {
      enabled: !!accountId,
      refetchInterval: (query) => {
        const data = query.state.data as any[] | undefined;
        const hasActive = data?.some((pr: any) => pr.status === "submitted" || pr.status === "in_progress");
        return hasActive ? 30_000 : false;
      },
    }
  );

  // Usage data
  const usageDates = useMemo(() => {
    const now = new Date();
    if (usagePeriod === "last") {
      const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const lastDay = new Date(now.getFullYear(), now.getMonth(), 0);
      return {
        startDate: `${lastMonth.getFullYear()}-${String(lastMonth.getMonth() + 1).padStart(2, "0")}-01`,
        endDate: `${lastDay.getFullYear()}-${String(lastDay.getMonth() + 1).padStart(2, "0")}-${String(lastDay.getDate()).padStart(2, "0")}`,
      };
    }
    // current month
    return {
      startDate: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`,
      endDate: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`,
    };
  }, [usagePeriod]);

  const { data: usageData, isLoading: usageLoading } =
    trpc.twilioPhoneNumber.getUsage.useQuery(
      { accountId, ...usageDates },
      { enabled: !!accountId && assigned?.hasNumber === true && activeTab === "usage" }
    );

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
      numberType: (num as any).numberType || numberType,
    });
    setShowConfirmPurchase(true);
  }

  function handleConfirmPurchase() {
    if (!selectedNumber) return;
    purchaseMutation.mutate({
      accountId,
      phoneNumber: selectedNumber.phoneNumber,
      appUrl: window.location.origin,
      numberType: (selectedNumber.numberType as "local" | "tollFree") || "local",
    });
  }

  function handleRelease() {
    releaseMutation.mutate({ accountId });
  }

  // Port mutations
  const submitPortMutation = trpc.twilioPhoneNumber.submitPortRequest.useMutation({
    onSuccess: () => {
      utils.twilioPhoneNumber.getPortRequests.invalidate({ accountId });
      setShowPortModal(false);
      setPortPhone(""); setPortCarrier(""); setPortAccountNum(""); setPortPin(""); setPortName("");
    },
  });

  const cancelPortMutation = trpc.twilioPhoneNumber.cancelPortRequest.useMutation({
    onSuccess: () => {
      utils.twilioPhoneNumber.getPortRequests.invalidate({ accountId });
    },
  });

  function handleSubmitPort() {
    if (!portPhone || !portCarrier || !portAccountNum || !portName) return;
    submitPortMutation.mutate({
      accountId,
      phoneNumber: portPhone,
      currentCarrier: portCarrier,
      carrierAccountNumber: portAccountNum,
      carrierPin: portPin || undefined,
      authorizedName: portName,
      appUrl: window.location.origin,
    });
  }

  const portStatusColors: Record<string, string> = {
    draft: "bg-muted text-muted-foreground",
    submitted: "bg-blue-500/10 text-blue-500",
    in_progress: "bg-amber-500/10 text-amber-500",
    completed: "bg-emerald-500/10 text-emerald-500",
    failed: "bg-destructive/10 text-destructive",
    cancelled: "bg-muted text-muted-foreground",
  };

  return (
    <>
      <Card className="bg-white border-0 card-shadow">
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
          ) : (
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="grid w-full grid-cols-3 mb-4">
                <TabsTrigger value="manage" className="text-xs">Manage</TabsTrigger>
                <TabsTrigger value="porting" className="text-xs">Porting</TabsTrigger>
                <TabsTrigger value="usage" className="text-xs" disabled={!assigned?.hasNumber}>Usage</TabsTrigger>
              </TabsList>

              {/* ── Manage Tab ── */}
              <TabsContent value="manage" className="mt-0">
                {assigned?.hasNumber ? (
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
                        This number is billed to your Twilio account.
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
                        Get a new number or port an existing one.
                      </p>
                    </div>
                    <div className="flex gap-2 mt-2 flex-wrap justify-center">
                      <Button onClick={() => setShowSearchModal(true)}>
                        <Phone className="h-4 w-4 mr-2" />
                        Get a Phone Number
                      </Button>
                      <Button variant="outline" onClick={() => setShowPortModal(true)}>
                        <ArrowRightLeft className="h-4 w-4 mr-2" />
                        Port Existing Number
                      </Button>
                    </div>
                  </div>
                )}
              </TabsContent>

              {/* ── Porting Tab ── */}
              <TabsContent value="porting" className="mt-0">
                <div className="space-y-4">
                  {!assigned?.hasNumber && (
                    <Button
                      variant="outline"
                      className="w-full"
                      onClick={() => setShowPortModal(true)}
                    >
                      <ArrowRightLeft className="h-4 w-4 mr-2" />
                      Port an Existing Number
                    </Button>
                  )}

                  {portRequests && portRequests.length > 0 ? (
                    <div className="space-y-2">
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                        Port Requests
                      </p>
                      {portRequests.map((pr: any) => (
                        <div
                          key={pr.id}
                          className="flex flex-wrap items-center justify-between p-3 rounded-lg border border-border/50 gap-y-1"
                        >
                          <div className="flex items-center gap-3">
                            <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                              <ArrowRightLeft className="h-4 w-4 text-primary" />
                            </div>
                            <div>
                              <p className="text-sm font-medium">
                                {formatPhoneNumber(pr.phoneNumber)}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {pr.currentCarrier} &middot; {new Date(pr.createdAt).toLocaleDateString()}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge
                              variant="secondary"
                              className={`text-[10px] ${portStatusColors[pr.status] || ""}`}
                            >
                              {pr.status.replace("_", " ")}
                            </Badge>
                            {(pr.status === "submitted" || pr.status === "in_progress") && (
                              <span className="relative flex h-2 w-2" title="Auto-checking status">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
                                <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500" />
                              </span>
                            )}
                            {(pr.status === "submitted" || pr.status === "in_progress") && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 px-2 text-destructive hover:text-destructive"
                                onClick={() => cancelPortMutation.mutate({ accountId, portRequestId: pr.id })}
                                disabled={cancelPortMutation.isPending}
                              >
                                <Ban className="h-3 w-3" />
                              </Button>
                            )}
                          </div>
                          {pr.notes && (
                            <p className="w-full text-[11px] text-muted-foreground pl-12 leading-relaxed">
                              {pr.notes}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="flex flex-col items-center py-6 text-center">
                      <ArrowRightLeft className="h-8 w-8 text-muted-foreground/30 mb-2" />
                      <p className="text-sm text-muted-foreground">No port requests yet.</p>
                      <p className="text-xs text-muted-foreground/70 mt-1">
                        Port an existing number to keep your current phone number.
                      </p>
                    </div>
                  )}

                  <div className="rounded-lg bg-muted/30 p-3">
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      <span className="font-medium text-foreground">How porting works: </span>
                      Number porting transfers your existing phone number from your current carrier to Twilio.
                      The process typically takes 1-4 weeks. During this time, your number remains active with your current carrier.
                      Once porting completes, the number will be <strong>automatically assigned</strong> to your account and configured for SMS and voice.
                    </p>
                  </div>
                </div>
              </TabsContent>

              {/* ── Usage Tab ── */}
              <TabsContent value="usage" className="mt-0">
                {assigned?.hasNumber ? (
                  <div className="space-y-4">
                    {/* Period selector */}
                    <div className="flex gap-2">
                      <Button
                        variant={usagePeriod === "current" ? "default" : "outline"}
                        size="sm"
                        onClick={() => setUsagePeriod("current")}
                      >
                        This Month
                      </Button>
                      <Button
                        variant={usagePeriod === "last" ? "default" : "outline"}
                        size="sm"
                        onClick={() => setUsagePeriod("last")}
                      >
                        Last Month
                      </Button>
                    </div>

                    {usageLoading ? (
                      <div className="flex items-center justify-center py-8">
                        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                        <span className="ml-2 text-sm text-muted-foreground">Loading usage data...</span>
                      </div>
                    ) : usageData ? (
                      <>
                        {/* Total cost banner */}
                        <div className="rounded-lg bg-primary/5 border border-primary/20 p-4">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-xs text-muted-foreground">Total Usage Cost</p>
                              <p className="text-2xl font-bold text-primary">
                                ${usageData.totalCost.toFixed(2)}
                              </p>
                            </div>
                            <div className="text-right">
                              <p className="text-xs text-muted-foreground">Period</p>
                              <p className="text-xs font-medium">
                                {usageData.period.start} to {usageData.period.end}
                              </p>
                            </div>
                          </div>
                        </div>

                        {/* SMS stats */}
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                          <div className="rounded-lg border border-border/50 p-3">
                            <div className="flex items-center gap-2 mb-2">
                              <Send className="h-4 w-4 text-blue-500" />
                              <span className="text-xs text-muted-foreground">SMS Sent</span>
                            </div>
                            <p className="text-xl font-bold">{usageData.sms.sent}</p>
                          </div>
                          <div className="rounded-lg border border-border/50 p-3">
                            <div className="flex items-center gap-2 mb-2">
                              <Inbox className="h-4 w-4 text-emerald-500" />
                              <span className="text-xs text-muted-foreground">SMS Received</span>
                            </div>
                            <p className="text-xl font-bold">{usageData.sms.received}</p>
                          </div>
                          <div className="rounded-lg border border-border/50 p-3">
                            <div className="flex items-center gap-2 mb-2">
                              <DollarSign className="h-4 w-4 text-amber-500" />
                              <span className="text-xs text-muted-foreground">SMS Cost</span>
                            </div>
                            <p className="text-xl font-bold">${usageData.sms.cost.toFixed(2)}</p>
                          </div>
                        </div>

                        {/* Voice stats */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                          <div className="rounded-lg border border-border/50 p-3">
                            <div className="flex items-center gap-2 mb-2">
                              <PhoneOutgoing className="h-4 w-4 text-blue-500" />
                              <span className="text-xs text-muted-foreground">Outbound Calls</span>
                            </div>
                            <p className="text-xl font-bold">{usageData.voice.outbound}</p>
                          </div>
                          <div className="rounded-lg border border-border/50 p-3">
                            <div className="flex items-center gap-2 mb-2">
                              <PhoneIncoming className="h-4 w-4 text-emerald-500" />
                              <span className="text-xs text-muted-foreground">Inbound Calls</span>
                            </div>
                            <p className="text-xl font-bold">{usageData.voice.inbound}</p>
                          </div>
                          <div className="rounded-lg border border-border/50 p-3">
                            <div className="flex items-center gap-2 mb-2">
                              <Timer className="h-4 w-4 text-purple-500" />
                              <span className="text-xs text-muted-foreground">Minutes</span>
                            </div>
                            <p className="text-xl font-bold">{usageData.voice.minutes}</p>
                          </div>
                          <div className="rounded-lg border border-border/50 p-3">
                            <div className="flex items-center gap-2 mb-2">
                              <DollarSign className="h-4 w-4 text-amber-500" />
                              <span className="text-xs text-muted-foreground">Voice Cost</span>
                            </div>
                            <p className="text-xl font-bold">${usageData.voice.cost.toFixed(2)}</p>
                          </div>
                        </div>

                        {(usageData as any).error && (
                          <Alert>
                            <Info className="h-4 w-4" />
                            <AlertDescription className="text-xs">
                              {(usageData as any).error}
                            </AlertDescription>
                          </Alert>
                        )}
                      </>
                    ) : null}
                  </div>
                ) : (
                  <div className="flex flex-col items-center py-6 text-center">
                    <BarChart3 className="h-8 w-8 text-muted-foreground/30 mb-2" />
                    <p className="text-sm text-muted-foreground">No phone number assigned.</p>
                    <p className="text-xs text-muted-foreground/70 mt-1">
                      Assign a phone number to view usage statistics.
                    </p>
                  </div>
                )}
              </TabsContent>
            </Tabs>
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
              Search for available phone numbers by area code or location.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 flex-1 overflow-hidden flex flex-col">
            {/* Number type toggle */}
            <div className="flex gap-2 p-1 rounded-lg bg-muted/50">
              <button
                className={`flex-1 text-xs font-medium py-2 px-3 rounded-md transition-all ${
                  numberType === "local"
                    ? "bg-background shadow-sm text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
                onClick={() => {
                  setNumberType("local");
                  setSearchTriggered(false);
                }}
              >
                Local ($1.15/mo)
              </button>
              <button
                className={`flex-1 text-xs font-medium py-2 px-3 rounded-md transition-all ${
                  numberType === "tollFree"
                    ? "bg-background shadow-sm text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
                onClick={() => {
                  setNumberType("tollFree");
                  setSearchMode("areaCode");
                  setSearchTriggered(false);
                }}
              >
                Toll-Free ($2.15/mo)
              </button>
            </div>

            {/* Search mode tabs (only for local) */}
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
              {numberType === "local" && (
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
              )}
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
                  This number will be billed to your Twilio account at ${selectedNumber?.monthlyCost.toFixed(2)}/month.
                  {selectedNumber?.numberType === "tollFree" ? " Toll-free numbers include free inbound calls." : ""}
                  {" "}SMS and voice usage are billed separately. The number will be
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

      {/* Port Number Modal */}
      <Dialog
        open={showPortModal}
        onOpenChange={(open) => {
          setShowPortModal(open);
          if (!open) {
            setPortPhone(""); setPortCarrier(""); setPortAccountNum(""); setPortPin(""); setPortName("");
          }
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Port an Existing Number</DialogTitle>
            <DialogDescription>
              Transfer your existing phone number from your current carrier to Twilio.
              This process typically takes 1-4 weeks.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Phone Number *</Label>
                <Input
                  placeholder="(555) 123-4567"
                  value={portPhone}
                  onChange={(e) => setPortPhone(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Current Carrier *</Label>
                <Input
                  placeholder="e.g. AT&T, Verizon"
                  value={portCarrier}
                  onChange={(e) => setPortCarrier(e.target.value)}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Carrier Account Number *</Label>
                <Input
                  placeholder="Your account number"
                  value={portAccountNum}
                  onChange={(e) => setPortAccountNum(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Carrier PIN (optional)</Label>
                <Input
                  placeholder="Account PIN/passcode"
                  value={portPin}
                  onChange={(e) => setPortPin(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Authorized Name *</Label>
              <Input
                placeholder="Name on the carrier account"
                value={portName}
                onChange={(e) => setPortName(e.target.value)}
              />
            </div>

            <div className="rounded-lg bg-amber-500/5 border border-amber-500/20 p-3">
              <p className="text-xs text-muted-foreground leading-relaxed">
                <span className="font-medium text-amber-500">Important: </span>
                Ensure the phone number, account number, and authorized name match your current carrier records exactly.
                Incorrect information may delay or prevent the port.
              </p>
            </div>

            {submitPortMutation.error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription className="text-xs">
                  {submitPortMutation.error.message}
                </AlertDescription>
              </Alert>
            )}

            {submitPortMutation.isSuccess && (
              <Alert>
                <CheckCircle className="h-4 w-4 text-emerald-500" />
                <AlertDescription className="text-xs">
                  Port request submitted successfully! You will be notified when the number is active.
                </AlertDescription>
              </Alert>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPortModal(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSubmitPort}
              disabled={!portPhone || !portCarrier || !portAccountNum || !portName || submitPortMutation.isPending}
            >
              {submitPortMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Submitting...
                </>
              ) : (
                <>
                  <ArrowRightLeft className="h-4 w-4 mr-2" />
                  Submit Port Request
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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


// ─── Call Scripts Card ───
function CallScriptsCard({ accountId }: { accountId: number }) {
  const [showCreate, setShowCreate] = useState(false);
  const [editingScript, setEditingScript] = useState<any>(null);
  const [name, setName] = useState("");
  const [content, setContent] = useState("");
  const [deleteId, setDeleteId] = useState<number | null>(null);

  const scriptsQuery = trpc.powerDialer.listScripts.useQuery({ accountId });
  const createMutation = trpc.powerDialer.createScript.useMutation({
    onSuccess: () => {
      scriptsQuery.refetch();
      setShowCreate(false);
      setName("");
      setContent("");
    },
  });
  const updateMutation = trpc.powerDialer.updateScript.useMutation({
    onSuccess: () => {
      scriptsQuery.refetch();
      setEditingScript(null);
      setName("");
      setContent("");
    },
  });
  const deleteMutation = trpc.powerDialer.deleteScript.useMutation({
    onSuccess: () => {
      scriptsQuery.refetch();
      setDeleteId(null);
    },
  });

  const handleSave = () => {
    if (!name.trim() || !content.trim()) return;
    if (editingScript) {
      updateMutation.mutate({
        id: editingScript.id,
        accountId,
        name: name.trim(),
        content: content.trim(),
      });
    } else {
      createMutation.mutate({
        accountId,
        name: name.trim(),
        content: content.trim(),
      });
    }
  };

  const handleEdit = (script: any) => {
    setEditingScript(script);
    setName(script.name);
    setContent(script.content);
    setShowCreate(true);
  };

  return (
    <Card className="bg-white border-0 card-shadow">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <FileText className="h-4 w-4 text-muted-foreground" />
              Call Scripts
            </CardTitle>
            <CardDescription className="text-xs mt-1">
              Create call scripts for your Power Dialer sessions.
            </CardDescription>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              setEditingScript(null);
              setName("");
              setContent("");
              setShowCreate(true);
            }}
          >
            <Plus className="h-3.5 w-3.5 mr-1" />
            New Script
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {scriptsQuery.isLoading ? (
          <div className="flex items-center justify-center py-4">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : scriptsQuery.data && scriptsQuery.data.length > 0 ? (
          scriptsQuery.data.map((script: any) => (
            <div
              key={script.id}
              className="flex items-start justify-between p-3 rounded-lg border bg-muted/20"
            >
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium">{script.name}</p>
                <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                  {script.content}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Created {new Date(script.createdAt).toLocaleDateString()}
                </p>
              </div>
              <div className="flex items-center gap-1 ml-3 shrink-0">
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 w-7 p-0"
                  onClick={() => handleEdit(script)}
                >
                  <Edit3 className="h-3.5 w-3.5" />
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 w-7 p-0 text-red-500 hover:text-red-600"
                  onClick={() => setDeleteId(script.id)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          ))
        ) : (
          <p className="text-sm text-muted-foreground text-center py-4">
            No call scripts yet. Create one to use in your Power Dialer sessions.
          </p>
        )}
      </CardContent>

      {/* Create/Edit Dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingScript ? "Edit Call Script" : "Create Call Script"}
            </DialogTitle>
            <DialogDescription>
              {editingScript
                ? "Update the script name and content."
                : "Write a script that your team can follow during Power Dialer sessions."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Script Name</Label>
              <Input
                placeholder="e.g., Initial Contact Script"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Script Content</Label>
              <Textarea
                placeholder="Write your call script here..."
                value={content}
                onChange={(e) => setContent(e.target.value)}
                rows={10}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={
                !name.trim() ||
                !content.trim() ||
                createMutation.isPending ||
                updateMutation.isPending
              }
            >
              {(createMutation.isPending || updateMutation.isPending) && (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              )}
              {editingScript ? "Update Script" : "Create Script"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Call Script</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this script? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700"
              onClick={() => {
                if (deleteId) deleteMutation.mutate({ id: deleteId, accountId });
              }}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-1" />
              ) : (
                <Trash2 className="h-4 w-4 mr-1" />
              )}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}


// ─── Lead Routing Rules Card ───
function LeadRoutingRulesCard({ accountId }: { accountId: number }) {
  const [showCreate, setShowCreate] = useState(false);
  const [editingRule, setEditingRule] = useState<any>(null);
  const [deleteId, setDeleteId] = useState<number | null>(null);

  // Form state
  const [name, setName] = useState("");
  const [strategy, setStrategy] = useState<"round_robin" | "capacity_based" | "specific_user">("round_robin");
  const [selectedAssignees, setSelectedAssignees] = useState<number[]>([]);
  const [priority, setPriority] = useState(0);
  const [maxLeadsPerUser, setMaxLeadsPerUser] = useState(0);
  const [applyToCsvImport, setApplyToCsvImport] = useState(true);
  const [applyToFacebookLeads, setApplyToFacebookLeads] = useState(true);
  const [applyToManualCreate, setApplyToManualCreate] = useState(false);
  const [conditionLeadSources, setConditionLeadSources] = useState("");
  const [conditionTags, setConditionTags] = useState("");

  const rulesQuery = trpc.leadRouting.list.useQuery({ accountId });
  const membersQuery = trpc.members.list.useQuery({ accountId });

  const createMutation = trpc.leadRouting.create.useMutation({
    onSuccess: () => {
      rulesQuery.refetch();
      resetForm();
    },
  });
  const updateMutation = trpc.leadRouting.update.useMutation({
    onSuccess: () => {
      rulesQuery.refetch();
      resetForm();
    },
  });
  const deleteMutation = trpc.leadRouting.delete.useMutation({
    onSuccess: () => {
      rulesQuery.refetch();
      setDeleteId(null);
    },
  });
  const toggleMutation = trpc.leadRouting.toggleActive.useMutation({
    onSuccess: () => rulesQuery.refetch(),
  });

  const resetForm = () => {
    setShowCreate(false);
    setEditingRule(null);
    setName("");
    setStrategy("round_robin");
    setSelectedAssignees([]);
    setPriority(0);
    setMaxLeadsPerUser(0);
    setApplyToCsvImport(true);
    setApplyToFacebookLeads(true);
    setApplyToManualCreate(false);
    setConditionLeadSources("");
    setConditionTags("");
  };

  const handleEdit = (rule: any) => {
    setEditingRule(rule);
    setName(rule.name);
    setStrategy(rule.strategy);
    const assigneeIds = typeof rule.assigneeIds === "string" ? JSON.parse(rule.assigneeIds) : rule.assigneeIds;
    setSelectedAssignees(Array.isArray(assigneeIds) ? assigneeIds : []);
    setPriority(rule.priority || 0);
    setMaxLeadsPerUser(rule.maxLeadsPerUser || 0);
    setApplyToCsvImport(rule.applyToCsvImport ?? true);
    setApplyToFacebookLeads(rule.applyToFacebookLeads ?? true);
    setApplyToManualCreate(rule.applyToManualCreate ?? false);
    const conditions = typeof rule.conditions === "string" ? JSON.parse(rule.conditions) : rule.conditions;
    setConditionLeadSources(conditions?.leadSource?.join(", ") || "");
    setConditionTags(conditions?.tags?.join(", ") || "");
    setShowCreate(true);
  };

  const handleSave = () => {
    if (!name.trim() || selectedAssignees.length === 0) return;

    const conditions: { leadSource?: string[]; tags?: string[] } = {};
    if (conditionLeadSources.trim()) {
      conditions.leadSource = conditionLeadSources.split(",").map((s) => s.trim()).filter(Boolean);
    }
    if (conditionTags.trim()) {
      conditions.tags = conditionTags.split(",").map((s) => s.trim()).filter(Boolean);
    }

    const payload = {
      accountId,
      name: name.trim(),
      strategy,
      assigneeIds: selectedAssignees,
      priority,
      maxLeadsPerUser,
      applyToCsvImport,
      applyToFacebookLeads,
      applyToManualCreate,
      conditions: Object.keys(conditions).length > 0 ? conditions : undefined,
    };

    if (editingRule) {
      updateMutation.mutate({ id: editingRule.id, ...payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  const toggleAssignee = (userId: number) => {
    setSelectedAssignees((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    );
  };

  const members = membersQuery.data || [];
  const rules = rulesQuery.data || [];

  const strategyLabels: Record<string, string> = {
    round_robin: "Round Robin",
    capacity_based: "Capacity Based",
    specific_user: "Specific User",
  };

  const strategyDescriptions: Record<string, string> = {
    round_robin: "Distributes leads evenly across assignees in rotation",
    capacity_based: "Assigns to the team member with the fewest leads (respects max cap)",
    specific_user: "Always assigns to the first selected team member",
  };

  return (
    <Card className="bg-white border-0 card-shadow">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Route className="h-4 w-4 text-muted-foreground" />
              Lead Routing Rules
            </CardTitle>
            <CardDescription className="text-xs">
              Automatically assign new leads to team members based on rules.
            </CardDescription>
          </div>
          <Button
            size="sm"
            onClick={() => {
              resetForm();
              setShowCreate(true);
            }}
          >
            <Plus className="h-4 w-4 mr-1" />
            New Rule
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {rulesQuery.isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : rules.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Shuffle className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No routing rules yet</p>
            <p className="text-xs mt-1">Create a rule to automatically assign new leads to team members.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {rules.map((rule: any) => {
              const assigneeIds = typeof rule.assigneeIds === "string" ? JSON.parse(rule.assigneeIds) : rule.assigneeIds;
              const conditions = typeof rule.conditions === "string" ? JSON.parse(rule.conditions) : rule.conditions;
              const assigneeNames = (Array.isArray(assigneeIds) ? assigneeIds : [])
                .map((id: number) => {
                  const m = members.find((m: any) => m.userId === id);
                  return m ? (m.userName || m.userEmail || `User ${id}`) : `User ${id}`;
                })
                .join(", ");

              const triggers = [];
              if (rule.applyToCsvImport) triggers.push("CSV Import");
              if (rule.applyToFacebookLeads) triggers.push("Facebook Leads");
              if (rule.applyToManualCreate) triggers.push("Manual Create");

              return (
                <div
                  key={rule.id}
                  className={`border rounded-lg p-4 transition-colors ${
                    rule.isActive ? "border-border" : "border-border/50 opacity-60"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="text-sm font-medium truncate">{rule.name}</h4>
                        <Badge variant={rule.isActive ? "default" : "secondary"} className="text-[10px] px-1.5 py-0">
                          {rule.isActive ? "Active" : "Inactive"}
                        </Badge>
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                          {strategyLabels[rule.strategy] || rule.strategy}
                        </Badge>
                      </div>
                      <div className="text-xs text-muted-foreground space-y-0.5">
                        <p>
                          <Users2 className="h-3 w-3 inline mr-1" />
                          {assigneeNames || "No assignees"}
                        </p>
                        {triggers.length > 0 && (
                          <p>Triggers: {triggers.join(", ")}</p>
                        )}
                        {conditions?.leadSource?.length > 0 && (
                          <p>Lead sources: {conditions.leadSource.join(", ")}</p>
                        )}
                        {conditions?.tags?.length > 0 && (
                          <p>Tags: {conditions.tags.join(", ")}</p>
                        )}
                        {rule.maxLeadsPerUser > 0 && (
                          <p>Max per user: {rule.maxLeadsPerUser}</p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0"
                        onClick={() =>
                          toggleMutation.mutate({
                            id: rule.id,
                            accountId,
                            isActive: !rule.isActive,
                          })
                        }
                        disabled={toggleMutation.isPending}
                      >
                        {rule.isActive ? (
                          <ToggleRight className="h-4 w-4 text-green-600" />
                        ) : (
                          <ToggleLeft className="h-4 w-4 text-muted-foreground" />
                        )}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0"
                        onClick={() => handleEdit(rule)}
                      >
                        <Edit3 className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0 text-red-500 hover:text-red-600"
                        onClick={() => setDeleteId(rule.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>

      {/* Create / Edit Dialog */}
      <Dialog open={showCreate} onOpenChange={(open) => !open && resetForm()}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingRule ? "Edit Routing Rule" : "Create Routing Rule"}</DialogTitle>
            <DialogDescription>
              {editingRule
                ? "Update the lead routing rule settings."
                : "Set up a rule to automatically assign new leads to team members."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2 max-h-[60vh] overflow-y-auto">
            {/* Rule Name */}
            <div className="space-y-2">
              <Label>Rule Name</Label>
              <Input
                placeholder="e.g., Facebook Leads Round Robin"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>

            {/* Strategy */}
            <div className="space-y-2">
              <Label>Distribution Strategy</Label>
              <Select value={strategy} onValueChange={(v: any) => setStrategy(v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="round_robin">Round Robin</SelectItem>
                  <SelectItem value="capacity_based">Capacity Based</SelectItem>
                  <SelectItem value="specific_user">Specific User</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">{strategyDescriptions[strategy]}</p>
            </div>

            {/* Assignees */}
            <div className="space-y-2">
              <Label>Assign To</Label>
              {membersQuery.isLoading ? (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Loader2 className="h-3 w-3 animate-spin" /> Loading team members...
                </div>
              ) : members.length === 0 ? (
                <p className="text-xs text-muted-foreground">No team members found. Invite employees first.</p>
              ) : (
                <div className="border rounded-lg p-2 space-y-1 max-h-40 overflow-y-auto">
                  {members.map((m: any) => (
                    <button
                      key={m.userId}
                      type="button"
                      onClick={() => toggleAssignee(m.userId)}
                      className={`flex items-center gap-2 w-full px-2 py-1.5 rounded text-left text-sm transition-colors ${
                        selectedAssignees.includes(m.userId)
                          ? "bg-primary/10 text-primary"
                          : "hover:bg-accent"
                      }`}
                    >
                      <div
                        className={`h-4 w-4 rounded border flex items-center justify-center ${
                          selectedAssignees.includes(m.userId)
                            ? "bg-primary border-primary"
                            : "border-muted-foreground/30"
                        }`}
                      >
                        {selectedAssignees.includes(m.userId) && (
                          <CheckCircle2 className="h-3 w-3 text-white" />
                        )}
                      </div>
                      <span>{m.userName || m.userEmail || `User ${m.userId}`}</span>
                      <Badge variant="outline" className="text-[10px] ml-auto">
                        {m.role}
                      </Badge>
                    </button>
                  ))}
                </div>
              )}
              {selectedAssignees.length > 0 && (
                <p className="text-xs text-muted-foreground">
                  {selectedAssignees.length} team member{selectedAssignees.length > 1 ? "s" : ""} selected
                </p>
              )}
            </div>

            {/* Capacity Limit */}
            {strategy === "capacity_based" && (
              <div className="space-y-2">
                <Label>Max Leads Per User (0 = unlimited)</Label>
                <Input
                  type="number"
                  min={0}
                  value={maxLeadsPerUser}
                  onChange={(e) => setMaxLeadsPerUser(parseInt(e.target.value) || 0)}
                />
              </div>
            )}

            {/* Priority */}
            <div className="space-y-2">
              <Label>Priority (higher = checked first)</Label>
              <Input
                type="number"
                min={0}
                value={priority}
                onChange={(e) => setPriority(parseInt(e.target.value) || 0)}
              />
            </div>

            <Separator />

            {/* Trigger Sources */}
            <div className="space-y-2">
              <Label>Apply To</Label>
              <div className="space-y-2">
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input
                    type="checkbox"
                    checked={applyToCsvImport}
                    onChange={(e) => setApplyToCsvImport(e.target.checked)}
                    className="rounded border-muted-foreground/30"
                  />
                  CSV Imports
                </label>
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input
                    type="checkbox"
                    checked={applyToFacebookLeads}
                    onChange={(e) => setApplyToFacebookLeads(e.target.checked)}
                    className="rounded border-muted-foreground/30"
                  />
                  Facebook Lead Ads
                </label>
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input
                    type="checkbox"
                    checked={applyToManualCreate}
                    onChange={(e) => setApplyToManualCreate(e.target.checked)}
                    className="rounded border-muted-foreground/30"
                  />
                  Manual Contact Creation
                </label>
              </div>
            </div>

            <Separator />

            {/* Conditions (optional) */}
            <div className="space-y-2">
              <Label>Conditions (optional)</Label>
              <p className="text-xs text-muted-foreground">
                Only route leads matching these conditions. Leave blank to route all leads.
              </p>
              <div className="space-y-2">
                <div>
                  <Label className="text-xs">Lead Sources (comma-separated)</Label>
                  <Input
                    placeholder="e.g., facebook, csv_import, referral"
                    value={conditionLeadSources}
                    onChange={(e) => setConditionLeadSources(e.target.value)}
                  />
                </div>
                <div>
                  <Label className="text-xs">Tags (comma-separated)</Label>
                  <Input
                    placeholder="e.g., hot lead, Broward County"
                    value={conditionTags}
                    onChange={(e) => setConditionTags(e.target.value)}
                  />
                </div>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={resetForm}>
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={
                !name.trim() ||
                selectedAssignees.length === 0 ||
                createMutation.isPending ||
                updateMutation.isPending
              }
            >
              {(createMutation.isPending || updateMutation.isPending) && (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              )}
              {editingRule ? "Update Rule" : "Create Rule"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Routing Rule</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this routing rule? New leads will no longer be automatically assigned by this rule.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700"
              onClick={() => {
                if (deleteId) deleteMutation.mutate({ id: deleteId, accountId });
              }}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-1" />
              ) : (
                <Trash2 className="h-4 w-4 mr-1" />
              )}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
