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
  CalendarCheck,
  ArrowUpRight,
  Mail,
} from "lucide-react";
import { useAccount } from "@/contexts/AccountContext";
import { useMemo } from "react";
import OnboardingChecklist from "@/components/OnboardingChecklist";

export default function Home() {
  const { user } = useAuth();
  const { isAdmin, accounts, isAgencyScope, currentAccountId, currentAccount } = useAccount();

  // Admin stats — only fetch when in agency scope
  const { data: adminStats, isLoading: adminStatsLoading } = trpc.accounts.adminStats.useQuery(undefined, {
    enabled: isAdmin && isAgencyScope,
  });

  // Account-level stats — only fetch when a sub-account is selected
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
                iconColor="text-blue-600 bg-blue-50"
                description="Active sub-accounts"
                trend="+2 this month"
                trendUp
              />
              <StatsCard
                title="Total Users"
                value={adminStats?.totalUsers ?? 0}
                icon={Users}
                iconColor="text-purple-600 bg-purple-50"
                description="Across all accounts"
              />
              <StatsCard
                title="Active Accounts"
                value={adminStats?.activeAccounts ?? 0}
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
            </>
          )}
        </div>
      )}

      {/* ─── Onboarding Checklist (all users in sub-account mode) ─── */}
      {currentAccountId && (
        <OnboardingChecklist accountId={currentAccountId} />
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
                iconColor="text-blue-600 bg-blue-50"
                description="Contacts in this account"
              />
              <StatsCard
                title="Messages Sent"
                value={accountStats?.totalMessages ?? 0}
                icon={Mail}
                iconColor="text-emerald-600 bg-emerald-50"
                description="SMS + email combined"
              />
              <StatsCard
                title="AI Calls Made"
                value={accountStats?.totalCalls ?? 0}
                icon={Phone}
                iconColor="text-purple-600 bg-purple-50"
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

      {/* ─── Agency scope: sub-accounts grid ─── */}
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
                  <div className="flex flex-wrap items-center justify-between gap-2">
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

      {/* ─── Sub-account scope: Quick Overview ─── */}
      {currentAccountId && (
        <div>
          <h2 className="text-lg font-semibold tracking-tight text-foreground mb-4">
            Quick Overview
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <Card className="bg-white border-0 card-shadow">
              <CardContent className="pt-5 pb-4 px-5">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl flex items-center justify-center bg-blue-50 text-blue-600 shrink-0">
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
            <Card className="bg-white border-0 card-shadow">
              <CardContent className="pt-5 pb-4 px-5">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl flex items-center justify-center bg-emerald-50 text-emerald-600 shrink-0">
                    <CalendarCheck className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">Upcoming Appointments</p>
                    <p className="text-xs text-muted-foreground">
                      {accountStatsLoading ? "..." : `${accountStats?.totalAppointments ?? 0} booked`}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="bg-white border-0 card-shadow">
              <CardContent className="pt-5 pb-4 px-5">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl flex items-center justify-center bg-purple-50 text-purple-600 shrink-0">
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
              className="card-hover cursor-pointer bg-white border-0 card-shadow"
              onClick={() => {
                window.location.href = `/accounts/${account.id}`;
              }}
            >
              <CardHeader className="pb-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
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
