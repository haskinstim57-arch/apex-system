import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import {
  Building2,
  Users,
  Activity,
  TrendingUp,
  TrendingDown,
  Phone,
  MessageSquare,
  CalendarCheck,
  ArrowUpRight,
  Mail,
  Send,
  CheckCircle2,
  XCircle,
  Clock,
  FileText,
  Zap,
  Bot,
  Sparkles,
  ListOrdered,
  BarChart3,
  CalendarPlus,
} from "lucide-react";
import { useAccount } from "@/contexts/AccountContext";
import { useMemo } from "react";
import { Link } from "wouter";
import OnboardingChecklist from "@/components/OnboardingChecklist";
import JarvisTaskQueue from "@/components/JarvisTaskQueue";

export default function Home() {
  const { user } = useAuth();
  const { isAdmin, accounts, isAgencyScope, currentAccountId, currentAccount, isLoading: accountLoading } = useAccount();

  // Admin stats — only fetch when in agency scope
  const { data: adminStats, isLoading: adminStatsLoading } = trpc.accounts.adminStats.useQuery(undefined, {
    enabled: isAdmin && isAgencyScope,
    staleTime: 30000,
  });

  // Account-level stats — only fetch when a sub-account is selected
  const stableAccountId = useMemo(() => currentAccountId, [currentAccountId]);
  const { data: accountStats, isLoading: accountStatsLoading } =
    trpc.accounts.accountDashboardStats.useQuery(
      { accountId: stableAccountId! },
      { enabled: !!stableAccountId, staleTime: 30000 }
    );

  // Activity feed — only fetch when a sub-account is selected
  const { data: activityFeed, isLoading: feedLoading } =
    trpc.dashboard.getActivityFeed.useQuery(
      { accountId: stableAccountId!, limit: 12 },
      { enabled: !!stableAccountId, refetchInterval: 30000 }
    );

  const greeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 18) return "Good afternoon";
    return "Good evening";
  };

  // ─── Full-page skeleton while AccountContext is still hydrating ───
  // This prevents the blank dashboard flash after login when accounts haven't loaded yet.
  if (accountLoading) {
    return (
      <div className="space-y-6">
        <div className="flex flex-col gap-2">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-4 w-48" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatsCardSkeleton />
          <StatsCardSkeleton />
          <StatsCardSkeleton />
          <StatsCardSkeleton />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
          <Card className="lg:col-span-3 bg-card border-0 card-shadow">
            <CardContent className="pt-6">
              <div className="space-y-3">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="flex items-start gap-3">
                    <Skeleton className="h-8 w-8 rounded-lg shrink-0" />
                    <div className="flex-1 space-y-1.5">
                      <Skeleton className="h-3.5 w-3/4" />
                      <Skeleton className="h-3 w-1/3" />
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
          <Card className="lg:col-span-2 bg-card border-0 card-shadow">
            <CardContent className="pt-6">
              <div className="space-y-3">
                {[...Array(4)].map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full rounded-lg" />
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div>
          <h1 className="!text-[28px]">
            {greeting()}, {user?.name?.split(" ")[0] || "there"}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {isAdmin && isAgencyScope
              ? "Here\u2019s an overview of your platform."
              : currentAccount
                ? `Managing ${currentAccount.name}`
                : "Here\u2019s what\u2019s happening with your accounts."}
          </p>
        </div>
      </div>

      {/* ─── Agency Overview KPI Cards (only in agency scope) ─── */}
      {isAdmin && isAgencyScope && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {adminStatsLoading ? (
            <>
              <StatsCardSkeleton />
              <StatsCardSkeleton />
              <StatsCardSkeleton />
              <StatsCardSkeleton />
            </>
          ) : (
            <>
              <StatsCard
                title="Total Accounts"
                value={adminStats?.totalAccounts ?? 0}
                icon={Building2}
                iconColor="text-blue-600 bg-blue-100/80"
                description="Active sub-accounts"
                trend="+2 this month"
                trendUp
              />
              <StatsCard
                title="Total Users"
                value={adminStats?.totalUsers ?? 0}
                icon={Users}
                iconColor="text-purple-600 bg-purple-100/80"
                description="Across all accounts"
              />
              <StatsCard
                title="Active Accounts"
                value={adminStats?.activeAccounts ?? 0}
                icon={Activity}
                iconColor="text-emerald-600 bg-emerald-100/80"
                description="Currently active"
              />
              <StatsCard
                title="Platform Health"
                value="99.9%"
                icon={TrendingUp}
                iconColor="text-primary bg-primary/10"
                description="System uptime"
              />
            </>
          )}
        </div>
      )}

      {/* ─── Onboarding Checklist (all users in sub-account mode) ─── */}
      {currentAccountId && (
        <OnboardingChecklist accountId={currentAccountId} />
      )}

      {/* ─── Jarvis Task Queue (when account is selected) ─── */}
      {currentAccountId && (
        <JarvisTaskQueue accountId={currentAccountId} />
      )}

      {/* ─── Sub-Account KPI Cards (when account is selected) ─── */}
      {currentAccountId && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {accountStatsLoading ? (
            <>
              <StatsCardSkeleton />
              <StatsCardSkeleton />
              <StatsCardSkeleton />
              <StatsCardSkeleton />
            </>
          ) : (
            <>
              <StatsCard
                title="Total Contacts"
                value={accountStats?.totalContacts ?? 0}
                icon={Users}
                iconColor="text-blue-600 bg-blue-100/80"
                description="Contacts in this account"
              />
              <StatsCard
                title="Messages Sent"
                value={accountStats?.totalMessages ?? 0}
                icon={Mail}
                iconColor="text-emerald-600 bg-emerald-100/80"
                description="SMS + email combined"
              />
              <StatsCard
                title="AI Calls Made"
                value={accountStats?.totalCalls ?? 0}
                icon={Phone}
                iconColor="text-purple-600 bg-purple-100/80"
                description="Calls made"
              />
              <StatsCard
                title="Appointments Booked"
                value={accountStats?.totalAppointments ?? 0}
                icon={CalendarCheck}
                iconColor="text-primary bg-primary/10"
                description="Total appointments"
              />
            </>
          )}
        </div>
      )}

      {/* ─── Middle row: Activity Feed + Quick Actions ─── */}
      {currentAccountId && (
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
          {/* AI Activity Feed — 60% */}
          <Card className="lg:col-span-3 bg-card dark:bg-card border-0 card-shadow">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                  <Activity className="h-4 w-4 text-primary" />
                  Activity Feed
                </CardTitle>
                <Badge variant="outline" className="text-[10px] font-medium">
                  Live
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              {feedLoading ? (
                <div className="space-y-3">
                  {[...Array(5)].map((_, i) => (
                    <div key={i} className="flex items-start gap-3">
                      <Skeleton className="h-8 w-8 rounded-lg shrink-0" />
                      <div className="flex-1 space-y-1.5">
                        <Skeleton className="h-3.5 w-3/4" />
                        <Skeleton className="h-3 w-1/3" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : !activityFeed || activityFeed.length === 0 ? (
                <div className="text-center py-8">
                  <Activity className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
                  <p className="text-sm text-muted-foreground">No recent activity yet.</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Send a message, create content, or enroll contacts in a sequence to see activity here.
                  </p>
                </div>
              ) : (
                <div className="space-y-1">
                  {activityFeed.map((item, idx) => (
                    <ActivityItem key={`${item.type}-${item.id}-${idx}`} item={item} />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Jarvis Quick Actions — 40% */}
          <Card className="lg:col-span-2 bg-card dark:bg-card border-0 card-shadow">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <Bot className="h-4 w-4 text-primary" />
                Jarvis Quick Actions
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground mb-4">
                Click a prompt to open Jarvis with a pre-filled question.
              </p>
              <div className="space-y-2">
                <QuickActionButton
                  icon={BarChart3}
                  label="Show my message stats"
                  prompt="Show me a summary of my message stats for this week"
                  color="text-blue-600 bg-blue-50 dark:bg-blue-950/30"
                />
                <QuickActionButton
                  icon={Users}
                  label="Find uncontacted leads"
                  prompt="Find contacts that haven't been contacted in the last 30 days"
                  color="text-emerald-600 bg-emerald-50 dark:bg-emerald-950/30"
                />
                <QuickActionButton
                  icon={Sparkles}
                  label="Draft a follow-up email"
                  prompt="Draft a professional follow-up email for a lead who hasn't responded in 2 weeks"
                  color="text-purple-600 bg-purple-50 dark:bg-purple-950/30"
                />
                <QuickActionButton
                  icon={ListOrdered}
                  label="Check sequence performance"
                  prompt="Show me the performance of my active sequences"
                  color="text-amber-600 bg-amber-50 dark:bg-amber-950/30"
                />
                <QuickActionButton
                  icon={Phone}
                  label="Review recent AI calls"
                  prompt="Summarize the outcomes of my recent AI calls"
                  color="text-rose-600 bg-rose-50 dark:bg-rose-950/30"
                />
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ─── Agency scope: sub-accounts grid ─── */}
      {isAdmin && isAgencyScope && accounts && accounts.length > 0 && (
        <div>
          <h2 className="!text-lg mb-4">Sub-Accounts</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {accounts.slice(0, 12).map((account) => (
              <Card
                key={account.id}
                className="card-hover cursor-pointer bg-card dark:bg-card border-0 card-shadow"
                onClick={() => {
                  window.location.href = `/contacts`;
                }}
              >
                <CardHeader className="pb-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <CardTitle className="!text-sm font-medium text-foreground">
                      {account.name}
                    </CardTitle>
                    <Badge
                      variant={
                        account.status === "active" ? "default" : "secondary"
                      }
                      className={`text-[11px] h-5 rounded-full px-2.5 font-medium ${
                        account.status === "active"
                          ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-800"
                          : "bg-muted/50 text-muted-foreground border-border dark:bg-gray-800 dark:text-gray-400"
                      }`}
                    >
                      {account.status}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-xs text-muted-foreground">
                    {account.industry || "Mortgage"}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* ─── Sub-account scope: Quick Overview ─── */}
      {currentAccountId && (
        <div>
          <h2 className="!text-lg mb-4">Quick Overview</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <Card className="bg-card dark:bg-card border-0 card-shadow">
              <CardContent className="pt-5 pb-4 px-5">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl flex items-center justify-center bg-blue-100/80 text-blue-600 dark:bg-blue-950/30 shrink-0">
                    <MessageSquare className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">Active Campaigns</p>
                    <p className="text-xs text-muted-foreground">
                      {accountStatsLoading ? "..." : `${accountStats?.activeCampaigns ?? 0} running`}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="bg-card dark:bg-card border-0 card-shadow">
              <CardContent className="pt-5 pb-4 px-5">
                {accountStats && !accountStats.hasCalendar ? (
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-xl flex items-center justify-center bg-amber-100/80 text-amber-600 dark:bg-amber-950/30 shrink-0">
                      <CalendarPlus className="h-5 w-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground">Set Up Calendar</p>
                      <p className="text-xs text-muted-foreground">No calendar configured yet</p>
                    </div>
                    <Link href="/calendar">
                      <Button variant="outline" size="sm" className="shrink-0 text-xs">
                        Set Up
                      </Button>
                    </Link>
                  </div>
                ) : (
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-xl flex items-center justify-center bg-emerald-100/80 text-emerald-600 dark:bg-emerald-950/30 shrink-0">
                      <CalendarCheck className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-foreground">Upcoming Appointments</p>
                      <p className="text-xs text-muted-foreground">
                        {accountStatsLoading ? "..." : `${accountStats?.totalAppointments ?? 0} booked`}
                      </p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
            <Card className="bg-card dark:bg-card border-0 card-shadow">
              <CardContent className="pt-5 pb-4 px-5">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl flex items-center justify-center bg-purple-100/80 text-purple-600 dark:bg-purple-950/30 shrink-0">
                    <Phone className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">AI Call Activity</p>
                    <p className="text-xs text-muted-foreground">
                      {accountStatsLoading ? "..." : `${accountStats?.totalCalls ?? 0} calls made`}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* ─── Non-admin with no account selected: show account list ─── */}
      {!isAdmin && !currentAccountId && accounts && accounts.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {accounts.map((account) => (
            <Card
              key={account.id}
              className="card-hover cursor-pointer bg-card dark:bg-card border-0 card-shadow"
              onClick={() => {
                window.location.href = `/accounts/${account.id}`;
              }}
            >
              <CardHeader className="pb-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <CardTitle className="!text-sm font-medium text-foreground">
                    {account.name}
                  </CardTitle>
                  <Badge
                    variant={
                      account.status === "active" ? "default" : "secondary"
                    }
                    className={`text-[11px] h-5 rounded-full px-2.5 font-medium ${
                      account.status === "active"
                        ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-400"
                        : "bg-muted/50 text-muted-foreground border-border dark:bg-gray-800 dark:text-gray-400"
                    }`}
                  >
                    {account.status}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground">
                  {account.industry || "Mortgage"}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

/* ─── Activity Feed Item ─── */
function ActivityItem({ item }: { item: { type: string; subType: string | null; status: string | null; description: string | null; createdAt: Date | string | null } }) {
  const getIcon = () => {
    switch (item.type) {
      case "message":
        if (item.status === "failed") return <XCircle className="h-4 w-4 text-red-500" />;
        if (item.status === "delivered") return <CheckCircle2 className="h-4 w-4 text-emerald-500" />;
        return <Send className="h-4 w-4 text-blue-500" />;
      case "content":
        return <FileText className="h-4 w-4 text-purple-500" />;
      case "enrollment":
        return <Zap className="h-4 w-4 text-amber-500" />;
      case "call":
        return <Phone className="h-4 w-4 text-rose-500" />;
      default:
        return <Activity className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getIconBg = () => {
    switch (item.type) {
      case "message":
        if (item.status === "failed") return "bg-red-50 dark:bg-red-950/30";
        if (item.status === "delivered") return "bg-emerald-50 dark:bg-emerald-950/30";
        return "bg-blue-50 dark:bg-blue-950/30";
      case "content":
        return "bg-purple-50 dark:bg-purple-950/30";
      case "enrollment":
        return "bg-amber-50 dark:bg-amber-950/30";
      case "call":
        return "bg-rose-50 dark:bg-rose-950/30";
      default:
        return "bg-muted";
    }
  };

  const relativeTime = (date: Date | string | null) => {
    if (!date) return "";
    const now = Date.now();
    const then = new Date(date).getTime();
    const diffMs = now - then;
    const diffMin = Math.floor(diffMs / 60000);
    if (diffMin < 1) return "just now";
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHr = Math.floor(diffMin / 60);
    if (diffHr < 24) return `${diffHr}h ago`;
    const diffDay = Math.floor(diffHr / 24);
    if (diffDay < 7) return `${diffDay}d ago`;
    return new Date(date).toLocaleDateString();
  };

  return (
    <div className="flex items-start gap-3 py-2 px-2 rounded-lg hover:bg-muted/50 transition-colors">
      <div className={`h-8 w-8 rounded-lg flex items-center justify-center shrink-0 ${getIconBg()}`}>
        {getIcon()}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm text-foreground leading-snug truncate">
          {item.description || "Activity"}
        </p>
        <p className="text-[11px] text-muted-foreground mt-0.5 flex items-center gap-1">
          <Clock className="h-3 w-3" />
          {relativeTime(item.createdAt)}
        </p>
      </div>
    </div>
  );
}

/* ─── Quick Action Button ─── */
function QuickActionButton({
  icon: Icon,
  label,
  prompt,
  color,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  prompt: string;
  color: string;
}) {
  const handleClick = () => {
    // Dispatch a custom event that JarvisPanel can listen for
    window.dispatchEvent(
      new CustomEvent("jarvis-quick-action", { detail: { prompt } })
    );
  };

  return (
    <button
      onClick={handleClick}
      className="w-full flex items-center gap-3 p-3 rounded-lg border border-border/50 hover:border-primary/30 hover:bg-muted/50 transition-all text-left group"
    >
      <div className={`h-9 w-9 rounded-lg flex items-center justify-center shrink-0 ${color}`}>
        <Icon className="h-4 w-4" />
      </div>
      <span className="text-sm font-medium text-foreground group-hover:text-primary transition-colors">
        {label}
      </span>
      <ArrowUpRight className="h-3.5 w-3.5 text-muted-foreground ml-auto opacity-0 group-hover:opacity-100 transition-opacity" />
    </button>
  );
}

/* ─── Stats Card ─── */
function StatsCard({
  title,
  value,
  icon: Icon,
  iconColor,
  description,
  trend,
  trendUp,
}: {
  title: string;
  value: number | string;
  icon: React.ComponentType<{ className?: string }>;
  iconColor?: string;
  description: string;
  trend?: string;
  trendUp?: boolean;
}) {
  return (
    <Card className="bg-card dark:bg-card border-0 card-shadow">
      <CardContent className="pt-5 pb-4 px-5">
        <div className="flex items-start justify-between">
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              {title}
            </p>
            <p className="text-[28px] font-bold tracking-tight text-foreground leading-none">
              {typeof value === "number" ? value.toLocaleString() : value}
            </p>
            <p className="text-xs text-muted-foreground">{description}</p>
          </div>
          <div
            className={`h-10 w-10 rounded-xl flex items-center justify-center shrink-0 ${iconColor || "bg-muted/50 text-muted-foreground"}`}
          >
            <Icon className="h-5 w-5" />
          </div>
        </div>
        {trend && (
          <div className="mt-3 pt-3 border-t border-border/50">
            <div className="flex items-center gap-1">
              {trendUp !== undefined && (
                trendUp ? (
                  <ArrowUpRight className="h-3.5 w-3.5 text-emerald-600" />
                ) : (
                  <TrendingDown className="h-3.5 w-3.5 text-red-500" />
                )
              )}
              <p className={`text-xs font-medium ${trendUp ? "text-emerald-600" : "text-red-500"}`}>
                {trend}
              </p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function StatsCardSkeleton() {
  return (
    <Card className="bg-card dark:bg-card border-0 card-shadow">
      <CardContent className="pt-5 pb-4 px-5">
        <div className="flex items-start justify-between">
          <div className="space-y-3">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-8 w-16" />
            <Skeleton className="h-3 w-24" />
          </div>
          <Skeleton className="h-10 w-10 rounded-xl" />
        </div>
      </CardContent>
    </Card>
  );
}
