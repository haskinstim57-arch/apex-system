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
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
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
  CalendarClock,
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
  Webhook,
  Zap,
  Eye,
  EyeOff,
  RotateCw,
  Activity,
  AlertTriangle,
  History,
  Filter,
  MessageCircle,
  Pencil,
} from "lucide-react";
import { toast } from "sonner";
import { useLocation } from "wouter";
import { WebhookDeliveryLogs } from "@/components/WebhookDeliveryLogs";
import { WebhookConditionsEditor, WebhookConditionsBadges } from "@/components/WebhookConditionsEditor";
import type { WebhookCondition } from "@/components/WebhookConditionsEditor";
import { ApiKeysCard } from "@/components/ApiKeysCard";
import { AgencyBrandingCard } from "@/components/AgencyBrandingCard";
import { ThemePreview } from "@/components/ThemePreview";
import { WebchatWidgetsCard } from "@/components/WebchatWidgetsCard";
import { CustomFieldsCard } from "@/components/CustomFieldsCard";

import { useAccount } from "@/contexts/AccountContext";
import { GmbIntegrationCard as GmbIntegrationInline } from "@/components/GmbIntegrationCard";

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
  const { currentAccountId, currentAccount, isImpersonating } = useAccount();

  // When admin is viewing a sub-account, show that account's profile instead of admin's
  // Check both impersonation (cookie-based) and account selection (localStorage-based)
  const isViewingSubAccount = isAdmin && !!currentAccountId;
  const subAccountOwnerName = currentAccount?.ownerName as string | undefined;
  const subAccountOwnerEmail = currentAccount?.ownerEmail as string | undefined;
  const subAccountName = currentAccount?.name as string | undefined;
  const subAccountIndustry = currentAccount?.industry as string | undefined;
  const subAccountCreatedAt = currentAccount?.createdAt as string | number | undefined;
  const [, setLocation] = useLocation();

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

  const [activeTab, setActiveTab] = useState("general");

  const settingsTabs = useMemo(() => {
    const tabs = [
      { id: "general", label: "General", icon: User },
      ...(currentAccountId ? [{ id: "messaging", label: "Messaging", icon: MessageSquare }] : []),
      ...(currentAccountId ? [{ id: "integrations", label: "Integrations", icon: Link2 }] : []),
      ...(currentAccountId ? [{ id: "ai-voice", label: "AI & Voice", icon: Phone }] : []),
      ...(currentAccountId ? [{ id: "automation", label: "Automation", icon: Zap }] : []),
      { id: "notifications", label: "Notifications", icon: Bell },
      ...(isAdmin ? [{ id: "admin", label: "Admin", icon: Shield }] : []),
    ];
    return tabs;
  }, [currentAccountId, isAdmin]);

  return (
    <div className="space-y-6 w-full">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Manage your profile and account preferences.
        </p>
      </div>

      {/* Tab Bar */}
      <div className="border-b border-border">
        <nav className="flex gap-1 overflow-x-auto pb-px -mb-px" aria-label="Settings tabs">
          {settingsTabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
                  isActive
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"
                }`}
              >
                <Icon className="h-4 w-4" />
                {tab.label}
              </button>
            );
          })}
        </nav>
      </div>

      {/* ═══ General Tab ═══ */}
      {activeTab === "general" && (
        <div className="space-y-6">

      {/* Profile Section — shows sub-account info when admin is viewing a sub-account */}
      {isViewingSubAccount ? (
        <>
          {/* Sub-Account Details */}
          <Card className="bg-card border-0 card-shadow">
            <CardHeader>
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Shield className="h-4 w-4 text-muted-foreground" />
                Sub-Account Details
              </CardTitle>
              <CardDescription className="text-xs">
                Company information for this sub-account.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Company Name</p>
                  <p className="text-sm font-medium">{subAccountName || "—"}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Industry</p>
                  <p className="text-sm font-medium capitalize">{subAccountIndustry?.replace(/_/g, " ") || "—"}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Status</p>
                  <Badge variant="outline" className="text-xs capitalize">
                    {(currentAccount?.status as string) || "active"}
                  </Badge>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Created</p>
                  <p className="text-sm font-medium">
                    {subAccountCreatedAt
                      ? new Date(subAccountCreatedAt).toLocaleDateString("en-US", {
                          month: "long",
                          day: "numeric",
                          year: "numeric",
                        })
                      : "—"}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Sub-Account Owner */}
          <Card className="bg-card border-0 card-shadow">
            <CardHeader>
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <User className="h-4 w-4 text-muted-foreground" />
                Account Owner
              </CardTitle>
              <CardDescription className="text-xs">
                The owner of this sub-account.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-4">
                <Avatar className="h-16 w-16 border-2 border-border/50">
                  <AvatarFallback className="text-lg font-semibold bg-amber-500/10 text-amber-600">
                    {subAccountOwnerName?.charAt(0).toUpperCase() || "O"}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-medium">{subAccountOwnerName || "No owner assigned"}</h3>
                    <Badge
                      variant="outline"
                      className="text-[10px] px-1.5 h-4 bg-amber-500/20 text-amber-600 border-amber-200"
                    >
                      Owner
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">{subAccountOwnerEmail || "No email"}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Admin viewing notice */}
          <Alert className="border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950/30">
            <Info className="h-4 w-4 text-blue-600 dark:text-blue-400" />
            <AlertDescription className="text-xs text-blue-700 dark:text-blue-300">
              You are viewing this sub-account as an admin. Your own profile is visible in the agency-level settings.
            </AlertDescription>
          </Alert>
        </>
      ) : (
        <Card className="bg-card border-0 card-shadow">
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
      )}

      {/* Security Section — hidden when viewing sub-account (admin's auth details are irrelevant) */}
      {!isViewingSubAccount && (
        <Card className="bg-card border-0 card-shadow">
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
      )}

      {/* Change Password Section — only for email-authenticated users, hidden in sub-account view */}
      {!isViewingSubAccount && user?.loginMethod === "email" && <ChangePasswordCard />}

      {/* Phone Number — visible to anyone with an account selected */}
      {currentAccountId && (
        <PhoneNumberCard accountId={currentAccountId} />
      )}

      {/* Agency Branding */}
      {currentAccountId && (
        <>
          <AgencyBrandingCard accountId={currentAccountId} />
          <ThemePreviewWrapper accountId={currentAccountId} />
        </>
      )}

        </div>
      )}

      {/* ═══ Messaging Tab ═══ */}
      {activeTab === "messaging" && currentAccountId && (
        <div className="space-y-6">
          <Card className="bg-card border-0 card-shadow">
            <CardHeader>
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <MessageSquare className="h-4 w-4 text-emerald-500" />
                Messaging Credentials
              </CardTitle>
              <CardDescription className="text-xs">
                Configure Twilio and SendGrid for SMS and email delivery.
              </CardDescription>
            </CardHeader>
            <CardContent className="-mt-2">
              <IntegrationLink
                icon={MessageSquare}
                label="Configure Messaging"
                description="Set up Twilio SID/Auth Token and SendGrid API key"
                href="/settings/messaging"
                iconColor="text-emerald-500"
              />
            </CardContent>
          </Card>
          <MissedCallTextBackCard accountId={currentAccountId} />
          <WebchatWidgetsCard accountId={currentAccountId} />
          <SmsTemplatesCard accountId={currentAccountId} />
          <AppointmentNotificationsCard accountId={currentAccountId} />
        </div>
      )}

      {/* ═══ Integrations Tab ═══ */}
      {activeTab === "integrations" && currentAccountId && (
        <div className="space-y-6">
          <FacebookIntegrationCard accountId={currentAccountId} />
          <GmbIntegrationInline accountId={currentAccountId} />
          <CalendarSyncCard accountId={currentAccountId} />
          <OutboundWebhooksCard accountId={currentAccountId} />
          <ApiKeysCard accountId={currentAccountId} />
        </div>
      )}

      {/* ═══ AI & Voice Tab ═══ */}
      {activeTab === "ai-voice" && currentAccountId && (
        <div className="space-y-6">
          <AIVoiceCallingCard accountId={currentAccountId} />
          <CallScriptsCard accountId={currentAccountId} />
        </div>
      )}

      {/* ═══ Automation Tab ═══ */}
      {activeTab === "automation" && currentAccountId && (
        <div className="space-y-6">
          <LeadRoutingRulesCard accountId={currentAccountId} />
          <Card className="bg-card border-0 card-shadow">
            <CardHeader>
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Zap className="h-4 w-4 text-amber-500" />
                Lead Scoring
              </CardTitle>
              <CardDescription className="text-xs">
                Automatically score contacts based on their engagement and actions.
              </CardDescription>
            </CardHeader>
            <CardContent className="-mt-2">
              <IntegrationLink
                icon={Zap}
                label="Scoring Rules"
                description="Create and manage lead scoring rules for this account"
                href="/settings/lead-scoring"
                iconColor="text-amber-500"
              />
            </CardContent>
          </Card>
          <CustomFieldsCard accountId={currentAccountId} />

        </div>
      )}

      {/* ═══ Notifications Tab ═══ */}
      {activeTab === "notifications" && (
        <div className="space-y-6">
          <Card className="bg-card border-0 card-shadow cursor-pointer hover:shadow-md transition-shadow" onClick={() => setLocation("/settings/notifications")}>
            <CardContent className="pt-5 pb-4 px-5">
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Bell className="h-4 w-4 text-primary" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium">Push Notifications</p>
                  <p className="text-xs text-muted-foreground">Manage alerts & quiet hours</p>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </div>
            </CardContent>
          </Card>
          <Card className="bg-card border-0 card-shadow cursor-pointer hover:shadow-md transition-shadow" onClick={() => setLocation("/settings/notification-log")}>
            <CardContent className="pt-5 pb-4 px-5">
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-lg bg-blue-500/10 flex items-center justify-center">
                  <Bell className="h-4 w-4 text-blue-500" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium">Notification Log</p>
                  <p className="text-xs text-muted-foreground">View full notification history</p>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </div>
            </CardContent>
          </Card>
          {isAdmin && (
            <Card className="bg-card border-0 card-shadow cursor-pointer hover:shadow-md transition-shadow" onClick={() => setLocation("/settings/delivery-dashboard")}>
              <CardContent className="pt-5 pb-4 px-5">
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-lg bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                    <BarChart3 className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium">Delivery Dashboard</p>
                    <p className="text-xs text-muted-foreground">Monitor notification delivery rates</p>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* ═══ Admin Tab ═══ */}
      {activeTab === "admin" && isAdmin && (
        <div className="space-y-6">
          <Card className="bg-card border-0 card-shadow">
            <CardHeader>
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Palette className="h-4 w-4 text-muted-foreground" />
                Admin Integrations
              </CardTitle>
              <CardDescription className="text-xs">
                Manage platform-level service connections.
              </CardDescription>
            </CardHeader>
            <CardContent className="-mt-2">
              <IntegrationLink
                icon={Facebook}
                label="Facebook Pages"
                description="Map Facebook pages to sub-accounts for lead routing"
                href="/settings/facebook-pages"
                iconColor="text-blue-500"
              />
            </CardContent>
          </Card>
          <Card className="bg-card border-0 card-shadow cursor-pointer hover:shadow-md transition-shadow" onClick={() => setLocation("/settings/ai-usage")}>
            <CardContent className="pt-5 pb-4 px-5">
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Activity className="h-4 w-4 text-primary" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium">AI Usage Monitor</p>
                  <p className="text-xs text-muted-foreground">Track Gemini API tokens & costs</p>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </div>
            </CardContent>
          </Card>
          <Card className="bg-card border-0 card-shadow cursor-pointer hover:shadow-md transition-shadow" onClick={() => setLocation("/settings/lead-monitor")}>
            <CardContent className="pt-5 pb-4 px-5">
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
                  <Activity className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium">Lead Routing Monitor</p>
                  <p className="text-xs text-muted-foreground">Track Facebook lead routing success rates & failures</p>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </div>
            </CardContent>
          </Card>
        </div>
      )}
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
    <Card className="bg-card border-0 card-shadow">
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
  const [syncResult, setSyncResult] = useState<{ leadsFound: number; leadsCreated: number } | null>(null);
  const utils = trpc.useUtils();

  const { data: fbStatus, isLoading } = trpc.facebookOAuth.getStatus.useQuery(
    { accountId },
    { enabled: !!accountId }
  );

  const { data: webhookInfo } = trpc.facebookOAuth.getWebhookInfo.useQuery(
    { accountId },
    { enabled: !!accountId }
  );

  const syncLeadsMutation = trpc.facebookOAuth.syncLeads.useMutation({
    onSuccess: (result) => {
      setSyncResult({ leadsFound: result.leadsFound, leadsCreated: result.leadsCreated });
      if (result.leadsCreated > 0) {
        toast.success(`Synced ${result.leadsCreated} new lead${result.leadsCreated !== 1 ? "s" : ""} from Facebook!`);
      } else {
        toast.info(`No new leads found. Checked ${result.formsChecked} form${result.formsChecked !== 1 ? "s" : ""}.`);
      }
    },
    onError: (err) => {
      toast.error(err.message || "Failed to sync leads");
    },
  });

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
    <Card className="bg-card border-0 card-shadow">
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
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-xs border-green-200 text-green-600 hover:bg-green-500/10"
                    onClick={() => syncLeadsMutation.mutate({ accountId })}
                    disabled={syncLeadsMutation.isPending}
                  >
                    {syncLeadsMutation.isPending ? (
                      <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                    ) : (
                      <RefreshCw className="h-3 w-3 mr-1" />
                    )}
                    {syncLeadsMutation.isPending ? "Syncing..." : "Sync Leads"}
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
                {syncResult && (
                  <div className="mt-1 text-[11px] text-muted-foreground">
                    Last sync: {syncResult.leadsFound} found, {syncResult.leadsCreated} new
                  </div>
                )}
                <div className="mt-1 flex items-center gap-1.5 text-[11px] text-muted-foreground">
                  <div className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse" />
                  Auto-polling every 60s
                </div>
                {showWebhookInfo && (
                  <div className="mt-2 p-3 rounded-lg bg-muted/50 border border-border/50 space-y-3">
                    <p className="text-xs font-medium">Facebook App Webhook Configuration</p>
                    <p className="text-[11px] text-muted-foreground">Enter these values in your Facebook App → Products → Webhooks → Edit Subscription:</p>
                    <div className="space-y-2">
                      <div>
                        <p className="text-[11px] text-muted-foreground mb-1">Callback URL</p>
                        <div className="flex items-center gap-1.5">
                          <code className="text-[11px] bg-card px-2 py-1 rounded border font-mono truncate flex-1">
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
                          <code className="text-[11px] bg-card px-2 py-1 rounded border font-mono flex-1">
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
                          <code className="text-[11px] bg-card px-2 py-1 rounded border font-mono truncate flex-1">
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
                          <code className="text-[11px] bg-card px-2 py-1 rounded border font-mono flex-1">
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

  // Check OAuth configuration status
  const { data: oauthStatus } = trpc.system.oauthStatus.useQuery();

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
    <Card className="bg-card border-0 card-shadow">
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
                {oauthStatus && !oauthStatus.google.configured ? (
                  <div className="text-xs text-amber-500 bg-amber-500/10 rounded-md p-2 flex items-center gap-2">
                    <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                    <span>Google Calendar integration is not configured. Contact your administrator to set up Google OAuth credentials.</span>
                  </div>
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-xs border-blue-200 text-blue-600 hover:bg-blue-500/10"
                    onClick={handleConnectGoogle}
                  >
                    <ExternalLink className="h-3 w-3 mr-1" />
                    Connect Google Calendar
                  </Button>
                )}
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
                {oauthStatus && !oauthStatus.microsoft.configured ? (
                  <div className="text-xs text-amber-500 bg-amber-500/10 rounded-md p-2 flex items-center gap-2">
                    <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                    <span>Outlook Calendar integration is not configured. Contact your administrator to set up Microsoft OAuth credentials.</span>
                  </div>
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-xs border-sky-500/30 text-sky-400 hover:bg-sky-500/10"
                    onClick={handleConnectOutlook}
                  >
                    <ExternalLink className="h-3 w-3 mr-1" />
                    Connect Outlook Calendar
                  </Button>
                )}
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
      <Card className="bg-card border-0 card-shadow">
        <CardContent className="py-8 flex items-center justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-card border-0 card-shadow">
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
  const [digitFilter, setDigitFilter] = useState("");

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
        ...(digitFilter.trim() ? { contains: digitFilter.trim() } : {}),
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
      <Card className="bg-card border-0 card-shadow">
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
              <TabsList className="grid w-full grid-cols-1 sm:grid-cols-3 mb-4">
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
                        <div className="grid grid-cols-1 sm:grid-cols-1 sm:grid-cols-3 gap-3">
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

            {/* Digit Filter */}
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Filter by digits (optional)</label>
              <Input
                placeholder="e.g. 777 or 1234"
                value={digitFilter}
                onChange={(e) => {
                  const val = e.target.value.replace(/[^\d*]/g, "").slice(0, 10);
                  setDigitFilter(val);
                  setSearchTriggered(false);
                }}
                className="font-mono"
                maxLength={10}
              />
              <p className="text-[10px] text-muted-foreground">
                Twilio will match numbers containing these digits anywhere in the number
              </p>
            </div>

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
    <Card className="bg-card border-0 card-shadow">
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
    <Card className="bg-card border-0 card-shadow">
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


function AIVoiceCallingCard({ accountId }: { accountId: number }) {
  const utils = trpc.useUtils();

  const { data: voiceStatus, isLoading } = trpc.accounts.getVoiceAgentStatus.useQuery(
    { accountId },
    { refetchOnWindowFocus: false }
  );

  const toggleMutation = trpc.accounts.toggleVoiceAgent.useMutation({
    onMutate: async ({ enabled }) => {
      await utils.accounts.getVoiceAgentStatus.cancel({ accountId });
      const prev = utils.accounts.getVoiceAgentStatus.getData({ accountId });
      utils.accounts.getVoiceAgentStatus.setData({ accountId }, (old: any) =>
        old ? { ...old, voiceAgentEnabled: enabled } : old
      );
      return { prev };
    },
    onError: (_err, _vars, context) => {
      if (context?.prev) {
        utils.accounts.getVoiceAgentStatus.setData({ accountId }, context.prev);
      }
      toast.error("Failed to update AI voice calling status.");
    },
    onSuccess: (data) => {
      toast.success(
        data.enabled
          ? "AI Voice Calling has been enabled."
          : "AI Voice Calling has been disabled."
      );
    },
    onSettled: () => {
      utils.accounts.getVoiceAgentStatus.invalidate({ accountId });
    },
  });

  const isEnabled = voiceStatus?.voiceAgentEnabled ?? false;
  const hasAssistant = !!voiceStatus?.vapiAssistantId;

  return (
    <Card className="bg-card border-0 card-shadow">
      <CardHeader>
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <PhoneCall className="h-4 w-4 text-muted-foreground" />
          AI Voice Calling
        </CardTitle>
        <CardDescription className="text-xs">
          Control whether the AI voice agent can make outbound calls for this account.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading ? (
          <div className="flex items-center gap-2 py-2">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            <span className="text-sm text-muted-foreground">Loading voice agent status...</span>
          </div>
        ) : (
          <>
            {/* Main Toggle */}
            <div className="flex items-center justify-between py-3 px-4 rounded-lg bg-muted/50 border border-border/50">
              <div className="flex items-center gap-3">
                <div
                  className={`h-10 w-10 rounded-lg flex items-center justify-center ${
                    isEnabled
                      ? "bg-emerald-500/10 text-emerald-600"
                      : "bg-red-500/10 text-red-500"
                  }`}
                >
                  {isEnabled ? (
                    <PhoneCall className="h-5 w-5" />
                  ) : (
                    <Ban className="h-5 w-5" />
                  )}
                </div>
                <div>
                  <p className="text-sm font-medium">
                    AI Voice Agent is{" "}
                    <span
                      className={
                        isEnabled ? "text-emerald-600" : "text-red-500"
                      }
                    >
                      {isEnabled ? "Active" : "Disabled"}
                    </span>
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {isEnabled
                      ? "The AI can make outbound calls to contacts during business hours (7 AM – 10 PM ET)."
                      : "All AI outbound calls are blocked. Workflows and manual triggers will not initiate calls."}
                  </p>
                </div>
              </div>
              <Button
                variant={isEnabled ? "destructive" : "default"}
                size="sm"
                onClick={() =>
                  toggleMutation.mutate({
                    accountId,
                    enabled: !isEnabled,
                  })
                }
                disabled={toggleMutation.isPending}
                className="min-w-[100px]"
              >
                {toggleMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-1" />
                ) : isEnabled ? (
                  <Ban className="h-4 w-4 mr-1" />
                ) : (
                  <CheckCircle className="h-4 w-4 mr-1" />
                )}
                {isEnabled ? "Disable" : "Enable"}
              </Button>
            </div>

            {/* Status Details */}
            <div className="space-y-2">
              <div className="flex items-center justify-between py-1.5">
                <span className="text-xs text-muted-foreground">Voice Agent Configured</span>
                {hasAssistant ? (
                  <Badge variant="outline" className="text-xs text-emerald-600 border-emerald-200 bg-emerald-50">
                    <CheckCircle className="h-3 w-3 mr-1" />
                    Yes
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-xs text-amber-600 border-amber-200 bg-amber-50">
                    <AlertCircle className="h-3 w-3 mr-1" />
                    Not Set Up
                  </Badge>
                )}
              </div>
              <Separator className="bg-border/50" />
              <div className="flex items-center justify-between py-1.5">
                <span className="text-xs text-muted-foreground">Business Hours</span>
                <span className="text-xs font-medium">7:00 AM – 10:00 PM ET, 7 days/week</span>
              </div>
              <Separator className="bg-border/50" />
              <div className="flex items-center justify-between py-1.5">
                <span className="text-xs text-muted-foreground">Phone Number</span>
                <span className="text-xs font-medium">
                  {voiceStatus?.vapiPhoneNumber || "Not assigned"}
                </span>
              </div>
            </div>

            {/* Warning when disabled */}
            {!isEnabled && (
              <Alert className="border-amber-200 bg-amber-50">
                <AlertCircle className="h-4 w-4 text-amber-600" />
                <AlertDescription className="text-xs text-amber-800">
                  While disabled, all AI voice calls from workflows, power dialer, and manual triggers will be blocked for this account.
                </AlertDescription>
              </Alert>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}


// ─── Outbound Webhooks Card ──────────────────────────────────
const TRIGGER_EVENTS = [
  { value: "contact_created", label: "Contact Created" },
  { value: "contact_updated", label: "Contact Updated" },
  { value: "tag_added", label: "Tag Added" },
  { value: "pipeline_stage_changed", label: "Pipeline Stage Changed" },
  { value: "facebook_lead_received", label: "Facebook Lead Received" },
  { value: "inbound_message_received", label: "Inbound Message Received" },
  { value: "appointment_booked", label: "Appointment Booked" },
  { value: "appointment_cancelled", label: "Appointment Cancelled" },
  { value: "call_completed", label: "Call Completed" },
  { value: "missed_call", label: "Missed Call" },
  { value: "form_submitted", label: "Form Submitted" },
  { value: "review_received", label: "Review Received" },
  { value: "workflow_completed", label: "Workflow Completed" },
] as const;

function OutboundWebhooksCard({ accountId }: { accountId: number }) {
  const utils = trpc.useUtils();
  const webhooksList = trpc.webhooks.list.useQuery({ accountId });
  const [showCreate, setShowCreate] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [revealedSecrets, setRevealedSecrets] = useState<Set<number>>(new Set());
  const [logsWebhook, setLogsWebhook] = useState<{ id: number; name: string } | null>(null);

  // Create form state
  const [name, setName] = useState("");
  const [triggerEvent, setTriggerEvent] = useState<string>("");
  const [url, setUrl] = useState("");
  const [description, setDescription] = useState("");
  const [conditions, setConditions] = useState<WebhookCondition[]>([]);

  // Edit form state
  const [editName, setEditName] = useState("");
  const [editTriggerEvent, setEditTriggerEvent] = useState<string>("");
  const [editUrl, setEditUrl] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editConditions, setEditConditions] = useState<WebhookCondition[]>([]);

  const createWebhook = trpc.webhooks.create.useMutation({
    onSuccess: (data) => {
      toast.success("Webhook created! Signing secret: " + data.secret.slice(0, 8) + "...");
      utils.webhooks.list.invalidate({ accountId });
      resetCreateForm();
    },
    onError: (err) => toast.error(err.message),
  });

  const updateWebhook = trpc.webhooks.update.useMutation({
    onSuccess: () => {
      toast.success("Webhook updated");
      utils.webhooks.list.invalidate({ accountId });
      setEditingId(null);
    },
    onError: (err) => toast.error(err.message),
  });

  const deleteWebhook = trpc.webhooks.delete.useMutation({
    onSuccess: () => {
      toast.success("Webhook deleted");
      utils.webhooks.list.invalidate({ accountId });
      setDeleteId(null);
    },
    onError: (err) => toast.error(err.message),
  });

  const testWebhook = trpc.webhooks.test.useMutation({
    onSuccess: (result) => {
      if (result.success) {
        toast.success(`Test successful! Status: ${result.statusCode}`);
      } else {
        toast.error(`Test failed: ${result.error || `Status ${result.statusCode}`}`);
      }
    },
    onError: (err) => toast.error(err.message),
  });

  const regenerateSecret = trpc.webhooks.regenerateSecret.useMutation({
    onSuccess: (data) => {
      toast.success("New secret: " + data.secret.slice(0, 8) + "...");
      utils.webhooks.list.invalidate({ accountId });
    },
    onError: (err) => toast.error(err.message),
  });

  function resetCreateForm() {
    setShowCreate(false);
    setName("");
    setTriggerEvent("");
    setUrl("");
    setDescription("");
    setConditions([]);
  }

  function startEdit(wh: any) {
    setEditingId(wh.id);
    setEditName(wh.name);
    setEditTriggerEvent(wh.triggerEvent);
    setEditUrl(wh.url);
    setEditDescription(wh.description || "");
    setEditConditions(wh.conditions || []);
  }

  function toggleSecretVisibility(id: number) {
    setRevealedSecrets((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const webhooks = webhooksList.data || [];

  return (
    <>
      <Card className="bg-card border-0 card-shadow">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Webhook className="h-4 w-4 text-muted-foreground" />
                Outbound Webhooks
              </CardTitle>
              <CardDescription className="text-xs mt-1">
                Send CRM events to Zapier, Make, n8n, or any HTTP endpoint. Payloads are signed with HMAC-SHA256.
              </CardDescription>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setShowCreate(true)}
              disabled={showCreate}
            >
              <Plus className="h-3.5 w-3.5 mr-1" /> Add Webhook
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Create Form */}
          {showCreate && (
            <div className="p-4 border rounded-lg space-y-3 bg-muted/30">
              <p className="text-sm font-medium">New Webhook</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Name</Label>
                  <Input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Zapier New Lead"
                    className="h-8 text-sm"
                  />
                </div>
                <div>
                  <Label className="text-xs">Trigger Event</Label>
                  <Select value={triggerEvent} onValueChange={setTriggerEvent}>
                    <SelectTrigger className="h-8 text-sm">
                      <SelectValue placeholder="Select event..." />
                    </SelectTrigger>
                    <SelectContent>
                      {TRIGGER_EVENTS.map((e) => (
                        <SelectItem key={e.value} value={e.value}>
                          {e.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label className="text-xs">Webhook URL</Label>
                <Input
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="https://hooks.zapier.com/hooks/catch/..."
                  className="h-8 text-sm"
                />
              </div>
              <div>
                <Label className="text-xs">Description (optional)</Label>
                <Input
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Sends new leads to our Zapier automation"
                  className="h-8 text-sm"
                />
              </div>
              <WebhookConditionsEditor conditions={conditions} onChange={setConditions} />
              <div className="flex gap-2 justify-end">
                <Button size="sm" variant="ghost" onClick={resetCreateForm}>
                  Cancel
                </Button>
                <Button
                  size="sm"
                  onClick={() =>
                    createWebhook.mutate({
                      accountId,
                      name,
                      triggerEvent: triggerEvent as any,
                      url,
                      description: description || undefined,
                      conditions: conditions.length > 0 ? conditions as any : undefined,
                    })
                  }
                  disabled={createWebhook.isPending || !name || !triggerEvent || !url}
                >
                  {createWebhook.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />}
                  Create Webhook
                </Button>
              </div>
            </div>
          )}

          {/* Webhook List */}
          {webhooksList.isLoading ? (
            <div className="flex items-center justify-center py-6">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : webhooks.length === 0 && !showCreate ? (
            <div className="text-center py-6">
              <Zap className="h-10 w-10 text-muted-foreground/30 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">No webhooks configured</p>
              <p className="text-xs text-muted-foreground mt-1">
                Add a webhook to send CRM events to external services like Zapier, Make, or n8n.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {webhooks.map((wh) => (
                <div
                  key={wh.id}
                  className={`p-3 border rounded-lg transition-colors ${
                    wh.isActive ? "bg-card" : "bg-muted/30 opacity-70"
                  }`}
                >
                  {editingId === wh.id ? (
                    /* Edit Mode */
                    <div className="space-y-3">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <Label className="text-xs">Name</Label>
                          <Input
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            className="h-8 text-sm"
                          />
                        </div>
                        <div>
                          <Label className="text-xs">Trigger Event</Label>
                          <Select value={editTriggerEvent} onValueChange={setEditTriggerEvent}>
                            <SelectTrigger className="h-8 text-sm">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {TRIGGER_EVENTS.map((e) => (
                                <SelectItem key={e.value} value={e.value}>
                                  {e.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      <div>
                        <Label className="text-xs">URL</Label>
                        <Input
                          value={editUrl}
                          onChange={(e) => setEditUrl(e.target.value)}
                          className="h-8 text-sm"
                        />
                      </div>
                      <div>
                        <Label className="text-xs">Description</Label>
                        <Input
                          value={editDescription}
                          onChange={(e) => setEditDescription(e.target.value)}
                          className="h-8 text-sm"
                        />
                      </div>
                      <WebhookConditionsEditor conditions={editConditions} onChange={setEditConditions} />
                      <div className="flex gap-2 justify-end">
                        <Button size="sm" variant="ghost" onClick={() => setEditingId(null)}>
                          Cancel
                        </Button>
                        <Button
                          size="sm"
                          onClick={() =>
                            updateWebhook.mutate({
                              accountId,
                              webhookId: wh.id,
                              name: editName,
                              triggerEvent: editTriggerEvent as any,
                              url: editUrl,
                              description: editDescription || undefined,
                              conditions: editConditions as any,
                            })
                          }
                          disabled={updateWebhook.isPending}
                        >
                          {updateWebhook.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />}
                          Save
                        </Button>
                      </div>
                    </div>
                  ) : (
                    /* Display Mode */
                    <>
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-medium">{wh.name}</span>
                            <Badge
                              variant="outline"
                              className={`text-[10px] ${
                                wh.isActive
                                  ? "bg-green-500/10 text-green-600 border-green-500/20"
                                  : "bg-muted/500/10 text-muted-foreground border-gray-500/20"
                              }`}
                            >
                              {wh.isActive ? "Active" : "Paused"}
                            </Badge>
                            <Badge variant="outline" className="text-[10px] bg-blue-500/10 text-blue-600 border-blue-500/20">
                              {TRIGGER_EVENTS.find((e) => e.value === wh.triggerEvent)?.label || wh.triggerEvent}
                            </Badge>
                            {wh.failCount > 0 && (
                              <Badge variant="outline" className="text-[10px] bg-red-500/10 text-red-600 border-red-500/20">
                                <AlertTriangle className="h-2.5 w-2.5 mr-0.5" />
                                {wh.failCount} fail{wh.failCount > 1 ? "s" : ""}
                              </Badge>
                            )}
                          </div>
                          {wh.description && (
                            <p className="text-xs text-muted-foreground mt-0.5">{wh.description}</p>
                          )}
                          <WebhookConditionsBadges conditions={wh.conditions as any} />
                          <p className="text-xs text-muted-foreground mt-1 font-mono truncate">
                            {wh.url}
                          </p>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 w-7 p-0"
                            title={wh.isActive ? "Pause" : "Enable"}
                            onClick={() =>
                              updateWebhook.mutate({
                                accountId,
                                webhookId: wh.id,
                                isActive: !wh.isActive,
                              })
                            }
                          >
                            {wh.isActive ? (
                              <Activity className="h-3.5 w-3.5 text-green-600" />
                            ) : (
                              <Activity className="h-3.5 w-3.5 text-muted-foreground" />
                            )}
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 w-7 p-0"
                            title="Send test"
                            onClick={() => testWebhook.mutate({ accountId, webhookId: wh.id })}
                            disabled={testWebhook.isPending}
                          >
                            {testWebhook.isPending ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <Zap className="h-3.5 w-3.5 text-yellow-600" />
                            )}
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 w-7 p-0"
                            title="Delivery logs"
                            onClick={() => setLogsWebhook({ id: wh.id, name: wh.name })}
                          >
                            <History className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 w-7 p-0"
                            title="Edit"
                            onClick={() => startEdit(wh)}
                          >
                            <Edit3 className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 w-7 p-0 text-red-500 hover:text-red-600"
                            title="Delete"
                            onClick={() => setDeleteId(wh.id)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>

                      {/* Secret + Meta Row */}
                      <div className="mt-2 flex items-center gap-3 text-xs text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <span className="font-medium">Secret:</span>
                          <code className="bg-muted px-1.5 py-0.5 rounded text-[10px] font-mono">
                            {revealedSecrets.has(wh.id)
                              ? wh.secret
                              : wh.secret.slice(0, 8) + "••••••••"}
                          </code>
                          <button
                            onClick={() => toggleSecretVisibility(wh.id)}
                            className="hover:text-foreground transition-colors"
                            title={revealedSecrets.has(wh.id) ? "Hide" : "Reveal"}
                          >
                            {revealedSecrets.has(wh.id) ? (
                              <EyeOff className="h-3 w-3" />
                            ) : (
                              <Eye className="h-3 w-3" />
                            )}
                          </button>
                          <button
                            onClick={() => {
                              navigator.clipboard.writeText(wh.secret);
                              toast.success("Secret copied");
                            }}
                            className="hover:text-foreground transition-colors"
                            title="Copy secret"
                          >
                            <Copy className="h-3 w-3" />
                          </button>
                          <button
                            onClick={() =>
                              regenerateSecret.mutate({ accountId, webhookId: wh.id })
                            }
                            className="hover:text-foreground transition-colors"
                            title="Regenerate secret"
                            disabled={regenerateSecret.isPending}
                          >
                            <RotateCw className={`h-3 w-3 ${regenerateSecret.isPending ? "animate-spin" : ""}`} />
                          </button>
                        </div>
                        {wh.lastTriggeredAt && (
                          <span>
                            Last fired: {new Date(wh.lastTriggeredAt).toLocaleString()}
                          </span>
                        )}
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Verification Guide */}
          {webhooks.length > 0 && (
            <div className="p-3 bg-blue-500/5 border border-blue-500/20 rounded-lg">
              <p className="text-xs font-medium text-blue-600 mb-1">Verifying Webhook Signatures</p>
              <p className="text-xs text-muted-foreground">
                Each payload includes an <code className="bg-muted px-1 rounded">X-Webhook-Signature</code> header.
                Verify by computing <code className="bg-muted px-1 rounded">HMAC-SHA256(secret, rawBody)</code> and comparing
                it to the header value. The <code className="bg-muted px-1 rounded">X-Webhook-Event</code> header contains the event type.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Delivery Logs Dialog */}
      {logsWebhook && (
        <WebhookDeliveryLogs
          accountId={accountId}
          webhookId={logsWebhook.id}
          webhookName={logsWebhook.name}
          open={!!logsWebhook}
          onClose={() => setLogsWebhook(null)}
        />
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Webhook</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove this webhook. Events will no longer be sent to the configured URL.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700"
              onClick={() => {
                if (deleteId) deleteWebhook.mutate({ accountId, webhookId: deleteId });
              }}
            >
              {deleteWebhook.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}


/** SMS Templates CRUD card for the Messaging tab */
function SmsTemplatesCard({ accountId }: { accountId: number }) {
  const utils = trpc.useUtils();
  const { data: templates = [], isLoading } = trpc.smsTemplates.list.useQuery({ accountId });
  const [showCreate, setShowCreate] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<{ id: number; name: string; body: string } | null>(null);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [formName, setFormName] = useState("");
  const [formBody, setFormBody] = useState("");

  const createMutation = trpc.smsTemplates.create.useMutation({
    onSuccess: () => {
      toast.success("SMS template created");
      setShowCreate(false);
      setFormName("");
      setFormBody("");
      utils.smsTemplates.list.invalidate({ accountId });
    },
    onError: (err) => toast.error(err.message),
  });

  const updateMutation = trpc.smsTemplates.update.useMutation({
    onSuccess: () => {
      toast.success("SMS template updated");
      setEditingTemplate(null);
      setFormName("");
      setFormBody("");
      utils.smsTemplates.list.invalidate({ accountId });
    },
    onError: (err) => toast.error(err.message),
  });

  const deleteMutation = trpc.smsTemplates.delete.useMutation({
    onSuccess: () => {
      toast.success("SMS template deleted");
      setDeleteId(null);
      utils.smsTemplates.list.invalidate({ accountId });
    },
    onError: (err) => toast.error(err.message),
  });

  return (
    <>
      <Card className="bg-card border-0 card-shadow">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <MessageCircle className="h-4 w-4 text-blue-500" />
                SMS Templates
              </CardTitle>
              <CardDescription className="text-xs mt-1">
                Reusable SMS templates for quick messaging from the contact popover.
              </CardDescription>
            </div>
            <Button size="sm" className="h-8 gap-1.5" onClick={() => { setShowCreate(true); setFormName(""); setFormBody(""); }}>
              <Plus className="h-3.5 w-3.5" />
              New
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-6">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : templates.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">
              No SMS templates yet. Create one to speed up messaging.
            </p>
          ) : (
            <div className="space-y-2">
              {templates.map((t: any) => (
                <div key={t.id} className="flex items-start justify-between gap-3 p-3 rounded-lg bg-muted/30 border border-border/30">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{t.name}</p>
                    <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{t.body}</p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0"
                      onClick={() => { setEditingTemplate({ id: t.id, name: t.name, body: t.body }); setFormName(t.name); setFormBody(t.body); }}
                    >
                      <Pencil className="h-3 w-3" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                      onClick={() => setDeleteId(t.id)}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create / Edit Dialog */}
      <Dialog
        open={showCreate || !!editingTemplate}
        onOpenChange={(open) => { if (!open) { setShowCreate(false); setEditingTemplate(null); } }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editingTemplate ? "Edit SMS Template" : "New SMS Template"}</DialogTitle>
            <DialogDescription>
              {editingTemplate ? "Update the template name and body." : "Create a reusable SMS template."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="text-xs">Template Name</Label>
              <Input
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="e.g., Follow-up after call"
              />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs">Message Body</Label>
                <span className={`text-[10px] ${formBody.length > 160 ? "text-orange-400" : "text-muted-foreground"}`}>
                  {formBody.length}/160
                </span>
              </div>
              <Textarea
                value={formBody}
                onChange={(e) => setFormBody(e.target.value)}
                placeholder="Hi {{first_name}}, just following up..."
                rows={4}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => { setShowCreate(false); setEditingTemplate(null); }}>Cancel</Button>
            <Button
              size="sm"
              disabled={!formName.trim() || !formBody.trim() || createMutation.isPending || updateMutation.isPending}
              onClick={() => {
                if (editingTemplate) {
                  updateMutation.mutate({ id: editingTemplate.id, accountId, name: formName.trim(), body: formBody.trim() });
                } else {
                  createMutation.mutate({ accountId, name: formName.trim(), body: formBody.trim() });
                }
              }}
            >
              {(createMutation.isPending || updateMutation.isPending) && <Loader2 className="h-3 w-3 animate-spin mr-1.5" />}
              {editingTemplate ? "Save Changes" : "Create Template"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={(open) => { if (!open) setDeleteId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete SMS Template?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. The template will be permanently removed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => { if (deleteId) deleteMutation.mutate({ id: deleteId, accountId }); }}
            >
              {deleteMutation.isPending && <Loader2 className="h-3 w-3 animate-spin mr-1.5" />}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

/** Appointment Notifications card for the Messaging tab */
function AppointmentNotificationsCard({ accountId }: { accountId: number }) {
  const { data: settings, isLoading } = trpc.messagingSettings.get.useQuery({ accountId });
  const utils = trpc.useUtils();
  const [fromNumber, setFromNumber] = useState("");
  const [provider, setProvider] = useState<"twilio" | "blooio">("blooio");
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    if (settings && !initialized) {
      setFromNumber(settings.appointmentFromNumber ?? "");
      setProvider((settings.appointmentSmsProvider as "twilio" | "blooio") ?? "blooio");
      setInitialized(true);
    }
  }, [settings, initialized]);

  const saveMutation = trpc.messagingSettings.save.useMutation({
    onSuccess: () => {
      utils.messagingSettings.get.invalidate({ accountId });
      toast.success("Appointment notification settings saved");
    },
    onError: (err) => toast.error(err.message),
  });

  const handleSave = () => {
    saveMutation.mutate({
      accountId,
      appointmentFromNumber: fromNumber.trim() || null,
      appointmentSmsProvider: provider,
    });
  };

  const isDirty =
    fromNumber !== (settings?.appointmentFromNumber ?? "") ||
    provider !== ((settings?.appointmentSmsProvider as "twilio" | "blooio") ?? "blooio");

  if (isLoading) {
    return (
      <Card className="bg-card border-0 card-shadow">
        <CardContent className="py-8 text-center text-muted-foreground text-sm">
          Loading...
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-card border-0 card-shadow">
      <CardHeader>
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <CalendarClock className="h-4 w-4 text-violet-500" />
          Appointment Notifications
        </CardTitle>
        <CardDescription className="text-xs">
          Set a dedicated phone number for appointment reminder and confirmation SMS.
          If left blank, the default Twilio number from Messaging Credentials is used.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label className="text-xs">Appointment From Number</Label>
          <Input
            placeholder="+15551234567 (E.164 format)"
            value={fromNumber}
            onChange={(e) => setFromNumber(e.target.value)}
            className="h-8 text-sm"
          />
          <p className="text-[10px] text-muted-foreground">
            This number will be used as the sender for appointment reminders and booking confirmations.
          </p>
        </div>

        <div className="space-y-2">
          <Label className="text-xs">SMS Provider</Label>
          <RadioGroup
            value={provider}
            onValueChange={(v) => setProvider(v as "twilio" | "blooio")}
            className="flex gap-4"
          >
            <div className="flex items-center gap-2">
              <RadioGroupItem value="blooio" id="appt-blooio" />
              <Label htmlFor="appt-blooio" className="text-xs font-normal cursor-pointer">
                Blooio (iMessage)
              </Label>
            </div>
            <div className="flex items-center gap-2">
              <RadioGroupItem value="twilio" id="appt-twilio" />
              <Label htmlFor="appt-twilio" className="text-xs font-normal cursor-pointer">
                Twilio
              </Label>
            </div>
          </RadioGroup>
        </div>

        <Button
          size="sm"
          onClick={handleSave}
          disabled={!isDirty || saveMutation.isPending}
          className="h-7 text-xs"
        >
          {saveMutation.isPending ? "Saving..." : "Save"}
        </Button>
      </CardContent>
    </Card>
  );
}

/** Wrapper that fetches branding and passes it to ThemePreview */
function ThemePreviewWrapper({ accountId }: { accountId: number }) {
  const { data: branding } = trpc.accounts.getBranding.useQuery({ accountId });
  return (
    <ThemePreview
      primaryColor={branding?.primaryColor ?? "#0c5ab0"}
      secondaryColor={branding?.secondaryColor ?? ""}
      brandName={branding?.brandName ?? ""}
    />
  );
}
