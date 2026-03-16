import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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

export default function Home() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";

  // Admin stats
  const { data: adminStats } = trpc.accounts.adminStats.useQuery(undefined, {
    enabled: isAdmin,
  });

  // User's accounts
  const { data: accounts } = trpc.accounts.list.useQuery();

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
          {isAdmin
            ? "Here\u2019s an overview of your platform."
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

      {/* User's Accounts */}
      {!isAdmin && accounts && accounts.length > 0 && (
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

      {/* Quick Actions / Module Placeholders */}
      <div>
        <h2 className="text-lg font-medium tracking-tight mb-4">
          Quick Overview
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <QuickStatCard
            title="Contacts"
            value="--"
            icon={Users}
            subtitle="Total contacts"
          />
          <QuickStatCard
            title="Messages"
            value="--"
            icon={MessageSquare}
            subtitle="Sent this month"
          />
          <QuickStatCard
            title="AI Calls"
            value="--"
            icon={Phone}
            subtitle="Calls made"
          />
          <QuickStatCard
            title="Campaigns"
            value="--"
            icon={BarChart3}
            subtitle="Active campaigns"
          />
        </div>
      </div>
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
