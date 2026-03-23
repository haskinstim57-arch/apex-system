import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Building2,
  Users,
  Activity,
  TrendingUp,
  TrendingDown,
  Phone,
  MessageSquare,
  BarChart3,
  ArrowUpRight,
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
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div>
          <h1 className="text-[28px] font-bold tracking-tight text-foreground">
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

      {/* Admin Stats */}
      {isAdmin && adminStats && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatsCard
            title="Total Accounts"
            value={adminStats.totalAccounts}
            icon={Building2}
            iconColor="text-blue-600 bg-blue-50"
            description="Active sub-accounts"
            trend="+2 this month"
            trendUp
          />
          <StatsCard
            title="Total Users"
            value={adminStats.totalUsers}
            icon={Users}
            iconColor="text-purple-600 bg-purple-50"
            description="Across all accounts"
          />
          <StatsCard
            title="Active Accounts"
            value={adminStats.activeAccounts}
            icon={Activity}
            iconColor="text-emerald-600 bg-emerald-50"
            description="Currently active"
          />
          <StatsCard
            title="Platform Health"
            value="99.9%"
            icon={TrendingUp}
            iconColor="text-primary bg-primary/10"
            description="System uptime"
          />
        </div>
      )}

      {/* Agency scope: show accounts overview for admins */}
      {isAdmin && isAgencyScope && accounts && accounts.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold tracking-tight text-foreground mb-4">
            Sub-Accounts
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {accounts.slice(0, 12).map((account) => (
              <Card
                key={account.id}
                className="card-hover cursor-pointer bg-white border-0 card-shadow"
                onClick={() => {
                  window.location.href = `/contacts`;
                }}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-medium text-foreground">
                      {account.name}
                    </CardTitle>
                    <Badge
                      variant={
                        account.status === "active" ? "default" : "secondary"
                      }
                      className={`text-[11px] h-5 rounded-full px-2.5 font-medium ${
                        account.status === "active"
                          ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                          : "bg-gray-50 text-gray-600 border-gray-200"
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

      {/* User's Accounts (clients only, no account selected) */}
      {!isAdmin && !currentAccountId && accounts && accounts.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {accounts.map((account) => (
            <Card
              key={account.id}
              className="card-hover cursor-pointer bg-white border-0 card-shadow"
              onClick={() => {
                window.location.href = `/accounts/${account.id}`;
              }}
            >
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-medium text-foreground">
                    {account.name}
                  </CardTitle>
                  <Badge
                    variant={
                      account.status === "active" ? "default" : "secondary"
                    }
                    className={`text-[11px] h-5 rounded-full px-2.5 font-medium ${
                      account.status === "active"
                        ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                        : "bg-gray-50 text-gray-600 border-gray-200"
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

      {/* Quick Overview — shows real stats when account is selected */}
      {currentAccountId && (
        <div>
          <h2 className="text-lg font-semibold tracking-tight text-foreground mb-4">
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
                <StatsCard
                  title="Contacts"
                  value={accountStats?.totalContacts ?? 0}
                  icon={Users}
                  iconColor="text-blue-600 bg-blue-50"
                  description="Total contacts"
                />
                <StatsCard
                  title="Messages"
                  value={accountStats?.totalMessages ?? 0}
                  icon={MessageSquare}
                  iconColor="text-emerald-600 bg-emerald-50"
                  description="Total sent"
                />
                <StatsCard
                  title="AI Calls"
                  value={accountStats?.totalCalls ?? 0}
                  icon={Phone}
                  iconColor="text-purple-600 bg-purple-50"
                  description="Calls made"
                />
                <StatsCard
                  title="Campaigns"
                  value={accountStats?.activeCampaigns ?? 0}
                  icon={BarChart3}
                  iconColor="text-primary bg-primary/10"
                  description="Active campaigns"
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
    <Card className="bg-white border-0 card-shadow">
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
            className={`h-10 w-10 rounded-xl flex items-center justify-center shrink-0 ${iconColor || "bg-gray-50 text-gray-500"}`}
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
    <Card className="bg-white border-0 card-shadow">
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
