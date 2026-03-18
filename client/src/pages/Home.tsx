import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Building2,
  Users,
  UserPlus,
  Activity,
  TrendingUp,
  Phone,
  MessageSquare,
  BarChart3,
} from "lucide-react";
import { useAccount } from "@/contexts/AccountContext";
import { useMemo } from "react";

export default function Home() {
  const { user } = useAuth();
  const { isAdmin, accounts, isAgencyScope, currentAccountId, currentAccount } = useAccount();

  // Admin stats
  const { data: adminStats } = trpc.accounts.adminStats.useQuery(undefined, {
    enabled: isAdmin,
  });

  // Account-level stats (when an account is selected)
  const stableAccountId = useMemo(() => currentAccountId, [currentAccountId]);
  const { data: accountStats, isLoading: accountStatsLoading } =
    trpc.accounts.accountDashboardStats.useQuery(
      { accountId: stableAccountId! },
      { enabled: !!stableAccountId }
    );

  const greeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 18) return "Good afternoon";
    return "Good evening";
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">
          {greeting()}, {user?.name?.split(" ")[0] || "there"}
        </h1>
        <p className="text-sm text-muted-foreground">
          {isAdmin && isAgencyScope
            ? "Here\u2019s an overview of your platform."
            : currentAccount
              ? `Managing ${currentAccount.name}`
              : "Here\u2019s what\u2019s happening with your accounts."}
        </p>
      </div>

      {/* Admin Stats */}
      {isAdmin && adminStats && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatsCard
            title="Total Accounts"
            value={adminStats.totalAccounts}
            icon={Building2}
            description="Active sub-accounts"
            trend="+2 this month"
          />
          <StatsCard
            title="Total Users"
            value={adminStats.totalUsers}
            icon={Users}
            description="Across all accounts"
          />
          <StatsCard
            title="Active Accounts"
            value={adminStats.activeAccounts}
            icon={Activity}
            description="Currently active"
            highlight
          />
          <StatsCard
            title="Platform Health"
            value="99.9%"
            icon={TrendingUp}
            description="System uptime"
          />
        </div>
      )}

      {/* Agency scope: show accounts overview for admins */}
      {isAdmin && isAgencyScope && accounts && accounts.length > 0 && (
        <div>
          <h2 className="text-lg font-medium tracking-tight mb-4">
            Sub-Accounts
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {accounts.slice(0, 12).map((account) => (
              <Card
                key={account.id}
                className="card-hover cursor-pointer border-border/50 bg-card"
                onClick={() => {
                  window.location.href = `/contacts`;
                }}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-medium">
                      {account.name}
                    </CardTitle>
                    <Badge
                      variant={
                        account.status === "active" ? "default" : "secondary"
                      }
                      className="text-[10px] h-5"
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

      {/* User's Accounts (clients only, no account selected) */}
      {!isAdmin && !currentAccountId && accounts && accounts.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {accounts.map((account) => (
            <Card
              key={account.id}
              className="card-hover cursor-pointer border-border/50 bg-card"
              onClick={() => {
                window.location.href = `/accounts/${account.id}`;
              }}
            >
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-medium">
                    {account.name}
                  </CardTitle>
                  <Badge
                    variant={
                      account.status === "active" ? "default" : "secondary"
                    }
                    className="text-[10px] h-5"
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

      {/* Quick Overview — shows real stats when account is selected */}
      {currentAccountId && (
        <div>
          <h2 className="text-lg font-medium tracking-tight mb-4">
            Quick Overview
          </h2>
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
                <QuickStatCard
                  title="Contacts"
                  value={accountStats?.totalContacts?.toLocaleString() ?? "0"}
                  icon={Users}
                  subtitle="Total contacts"
                />
                <QuickStatCard
                  title="Messages"
                  value={accountStats?.totalMessages?.toLocaleString() ?? "0"}
                  icon={MessageSquare}
                  subtitle="Total sent"
                />
                <QuickStatCard
                  title="AI Calls"
                  value={accountStats?.totalCalls?.toLocaleString() ?? "0"}
                  icon={Phone}
                  subtitle="Calls made"
                />
                <QuickStatCard
                  title="Campaigns"
                  value={accountStats?.activeCampaigns?.toLocaleString() ?? "0"}
                  icon={BarChart3}
                  subtitle="Active campaigns"
                />
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function StatsCard({
  title,
  value,
  icon: Icon,
  description,
  trend,
  highlight,
}: {
  title: string;
  value: number | string;
  icon: React.ComponentType<{ className?: string }>;
  description: string;
  trend?: string;
  highlight?: boolean;
}) {
  return (
    <Card
      className={`border-border/50 bg-card ${highlight ? "border-primary/20" : ""}`}
    >
      <CardContent className="pt-5 pb-4 px-5">
        <div className="flex items-start justify-between">
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              {title}
            </p>
            <p className="text-2xl font-semibold tracking-tight">{value}</p>
            <p className="text-xs text-muted-foreground">{description}</p>
          </div>
          <div
            className={`h-9 w-9 rounded-lg flex items-center justify-center ${highlight ? "bg-primary/10" : "bg-muted"}`}
          >
            <Icon
              className={`h-4 w-4 ${highlight ? "text-primary" : "text-muted-foreground"}`}
            />
          </div>
        </div>
        {trend && (
          <div className="mt-3 pt-3 border-t border-border/50">
            <p className="text-xs text-primary font-medium">{trend}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function QuickStatCard({
  title,
  value,
  icon: Icon,
  subtitle,
}: {
  title: string;
  value: string;
  icon: React.ComponentType<{ className?: string }>;
  subtitle: string;
}) {
  return (
    <Card className="border-border/50 bg-card">
      <CardContent className="pt-5 pb-4 px-5">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center shrink-0">
            <Icon className="h-4.5 w-4.5 text-muted-foreground" />
          </div>
          <div>
            <p className="text-lg font-semibold tracking-tight">{value}</p>
            <p className="text-xs text-muted-foreground">{subtitle}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function StatsCardSkeleton() {
  return (
    <Card className="border-border/50 bg-card">
      <CardContent className="pt-5 pb-4 px-5">
        <div className="flex items-center gap-3">
          <Skeleton className="h-10 w-10 rounded-lg" />
          <div className="space-y-2">
            <Skeleton className="h-5 w-16" />
            <Skeleton className="h-3 w-24" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
