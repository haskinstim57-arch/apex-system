import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { useAccount } from "@/contexts/AccountContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Users,
  MessageSquare,
  Phone,
  DollarSign,
  CalendarCheck,
  Send,
  TrendingUp,
  TrendingDown,
  Minus,
  BarChart3,
} from "lucide-react";
import { CustomFieldAnalytics } from "@/components/CustomFieldAnalytics";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

// ─── Period Options ───
const PERIOD_OPTIONS = [
  { value: "7", label: "Last 7 days" },
  { value: "30", label: "Last 30 days" },
  { value: "60", label: "Last 60 days" },
  { value: "90", label: "Last 90 days" },
];

// ─── Chart Colors ───
const CHART_COLORS = {
  gold: "oklch(0.82 0.12 85)",
  blue: "oklch(0.70 0.15 250)",
  green: "oklch(0.72 0.17 155)",
  red: "oklch(0.65 0.22 25)",
  purple: "oklch(0.75 0.12 300)",
  cyan: "oklch(0.75 0.12 220)",
};

const PIE_COLORS = [
  CHART_COLORS.green,
  CHART_COLORS.blue,
  CHART_COLORS.red,
  CHART_COLORS.gold,
  CHART_COLORS.purple,
  CHART_COLORS.cyan,
];

// ─── Custom Tooltip ───
function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-popover text-popover-foreground border border-border rounded-lg px-3 py-2 text-xs shadow-lg">
      <p className="font-medium mb-1">{label}</p>
      {payload.map((p: any, i: number) => (
        <div key={i} className="flex items-center gap-2">
          <span
            className="w-2 h-2 rounded-full inline-block"
            style={{ backgroundColor: p.color }}
          />
          <span className="text-muted-foreground">{p.name}:</span>
          <span className="font-medium">{typeof p.value === "number" ? p.value.toLocaleString() : p.value}</span>
        </div>
      ))}
    </div>
  );
}

// ─── KPI Card ───
function KpiCard({
  title,
  value,
  change,
  icon: Icon,
  suffix,
  loading,
}: {
  title: string;
  value: number | string;
  change?: number;
  icon: React.ComponentType<{ className?: string }>;
  suffix?: string;
  loading?: boolean;
}) {
  if (loading) {
    return (
      <Card className="bg-white border-0 card-shadow">
        <CardContent className="pt-5 pb-4 px-5">
          <div className="flex items-start justify-between">
            <div className="space-y-2">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-7 w-16" />
              <Skeleton className="h-3 w-24" />
            </div>
            <Skeleton className="h-9 w-9 rounded-lg" />
          </div>
        </CardContent>
      </Card>
    );
  }

  const isPositive = (change ?? 0) > 0;
  const isNeutral = change === 0 || change === undefined;

  return (
    <Card className="bg-white border-0 card-shadow">
      <CardContent className="pt-5 pb-4 px-5">
        <div className="flex items-start justify-between">
          <div className="space-y-1.5">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              {title}
            </p>
            <p className="text-2xl font-semibold tracking-tight">
              {typeof value === "number" ? value.toLocaleString() : value}
              {suffix && <span className="text-sm text-muted-foreground ml-1">{suffix}</span>}
            </p>
            {change !== undefined && (
              <div className="flex items-center gap-1">
                {isNeutral ? (
                  <Minus className="h-3 w-3 text-muted-foreground" />
                ) : isPositive ? (
                  <TrendingUp className="h-3 w-3 text-emerald-600" />
                ) : (
                  <TrendingDown className="h-3 w-3 text-red-500" />
                )}
                <span
                  className={`text-xs font-medium ${
                    isNeutral
                      ? "text-muted-foreground"
                      : isPositive
                        ? "text-emerald-600"
                        : "text-red-500"
                  }`}
                >
                  {isNeutral ? "No change" : `${isPositive ? "+" : ""}${change}% vs prev period`}
                </span>
              </div>
            )}
          </div>
          <div className="h-9 w-9 rounded-lg flex items-center justify-center bg-primary/10">
            <Icon className="h-4 w-4 text-primary" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Chart Card Wrapper ───
function ChartCard({
  title,
  children,
  loading,
  empty,
  emptyMessage,
  className,
}: {
  title: string;
  children: React.ReactNode;
  loading?: boolean;
  empty?: boolean;
  emptyMessage?: string;
  className?: string;
}) {
  return (
    <Card className={`bg-white border-0 card-shadow ${className ?? ""}`}>
      <CardHeader className="pb-2 pt-4 px-5">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
      </CardHeader>
      <CardContent className="px-5 pb-4">
        {loading ? (
          <div className="space-y-3">
            <Skeleton className="h-[200px] w-full rounded-lg" />
          </div>
        ) : empty ? (
          <div className="h-[200px] flex items-center justify-center text-sm text-muted-foreground">
            {emptyMessage || "No data available for this period"}
          </div>
        ) : (
          children
        )}
      </CardContent>
    </Card>
  );
}

// ─── Format helpers ───
function formatCurrency(val: number): string {
  if (val >= 1_000_000) return `$${(val / 1_000_000).toFixed(1)}M`;
  if (val >= 1_000) return `$${(val / 1_000).toFixed(0)}K`;
  return `$${val.toLocaleString()}`;
}

function formatDate(dateStr: string): string {
  try {
    const d = new Date(dateStr + "T00:00:00");
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  } catch {
    return dateStr;
  }
}

// ─── Main Component ───
export default function Analytics() {
  const { currentAccountId, isLoading: accountsLoading } = useAccount();
  const [days, setDays] = useState(30);

  const stableAccountId = useMemo(() => currentAccountId, [currentAccountId]);
  const enabled = !!stableAccountId;

  // ─── Queries ───
  const { data: kpis, isLoading: kpisLoading } = trpc.analytics.kpis.useQuery(
    { accountId: stableAccountId!, days },
    { enabled }
  );

  const { data: contactsGrowth, isLoading: contactsGrowthLoading } =
    trpc.analytics.contactsGrowth.useQuery(
      { accountId: stableAccountId!, days },
      { enabled }
    );

  const { data: messagesByChannel, isLoading: messagesLoading } =
    trpc.analytics.messagesByChannel.useQuery(
      { accountId: stableAccountId!, days },
      { enabled }
    );

  const { data: callOutcomes, isLoading: callsLoading } =
    trpc.analytics.callOutcomes.useQuery(
      { accountId: stableAccountId!, days },
      { enabled }
    );

  const { data: pipelineByStage, isLoading: pipelineLoading } =
    trpc.analytics.pipelineByStage.useQuery(
      { accountId: stableAccountId!, days },
      { enabled }
    );

  const { data: campaignPerformance, isLoading: campaignsLoading } =
    trpc.analytics.campaignPerformance.useQuery(
      { accountId: stableAccountId!, days },
      { enabled }
    );

  const { data: appointmentsByStatus, isLoading: appointmentsLoading } =
    trpc.analytics.appointmentsByStatus.useQuery(
      { accountId: stableAccountId!, days },
      { enabled }
    );

  // ─── No account selected ───
  if (!accountsLoading && !stableAccountId) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="text-center space-y-2">
          <BarChart3 className="h-12 w-12 text-muted-foreground mx-auto" />
          <h2 className="text-lg font-semibold">Select an Account</h2>
          <p className="text-sm text-muted-foreground">
            Choose a sub-account from the sidebar to view analytics.
          </p>
        </div>
      </div>
    );
  }

  // ─── Formatted chart data ───
  const contactsChartData = (contactsGrowth ?? []).map((d) => ({
    ...d,
    date: formatDate(d.date),
  }));

  const messagesChartData = (messagesByChannel ?? []).map((d) => ({
    ...d,
    date: formatDate(d.date),
  }));

  const callOutcomesData = (callOutcomes ?? []).map((d) => ({
    name: d.status.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
    value: d.count,
  }));

  const pipelineData = (pipelineByStage ?? []).map((d) => ({
    name: d.stageName,
    deals: d.dealCount,
    value: d.totalValue,
    color: d.stageColor,
  }));

  const appointmentsData = (appointmentsByStatus ?? []).map((d) => ({
    name: d.status.replace(/\b\w/g, (c) => c.toUpperCase()),
    count: d.count,
  }));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-[28px] font-bold tracking-tight text-foreground">Analytics</h1>
          <p className="text-sm text-muted-foreground">
            Performance overview for the selected period
          </p>
        </div>
        <Select value={String(days)} onValueChange={(v) => setDays(Number(v))}>
          <SelectTrigger className="w-[180px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PERIOD_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        <KpiCard
          title="Total Contacts"
          value={kpis?.totalContacts ?? 0}
          change={kpis?.contactsChange}
          icon={Users}
          loading={kpisLoading}
        />
        <KpiCard
          title="Messages Sent"
          value={kpis?.messagesSent ?? 0}
          change={kpis?.messagesChange}
          icon={MessageSquare}
          loading={kpisLoading}
        />
        <KpiCard
          title="AI Calls"
          value={kpis?.aiCallsMade ?? 0}
          change={kpis?.callsChange}
          icon={Phone}
          loading={kpisLoading}
        />
        <KpiCard
          title="Pipeline Value"
          value={formatCurrency(kpis?.pipelineValue ?? 0)}
          change={kpis?.pipelineChange}
          icon={DollarSign}
          loading={kpisLoading}
        />
        <KpiCard
          title="Appointments"
          value={kpis?.appointmentsBooked ?? 0}
          change={kpis?.appointmentsChange}
          icon={CalendarCheck}
          loading={kpisLoading}
        />
        <KpiCard
          title="Campaigns Sent"
          value={kpis?.campaignsSent ?? 0}
          change={kpis?.campaignsChange}
          icon={Send}
          loading={kpisLoading}
        />
      </div>

      {/* Charts Row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Contacts Growth — Area Chart */}
        <ChartCard
          title="Contacts Growth"
          loading={contactsGrowthLoading}
          empty={contactsChartData.length === 0}
          emptyMessage="No new contacts in this period"
        >
          <ResponsiveContainer width="100%" height={240}>
            <AreaChart data={contactsChartData}>
              <defs>
                <linearGradient id="contactsGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={CHART_COLORS.gold} stopOpacity={0.3} />
                  <stop offset="95%" stopColor={CHART_COLORS.gold} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="date" tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} />
              <YAxis tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} allowDecimals={false} />
              <Tooltip content={<CustomTooltip />} />
              <Area
                type="monotone"
                dataKey="count"
                name="New Contacts"
                stroke={CHART_COLORS.gold}
                fill="url(#contactsGrad)"
                strokeWidth={2}
              />
            </AreaChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* Messages by Channel — Stacked Bar */}
        <ChartCard
          title="Messages by Channel"
          loading={messagesLoading}
          empty={messagesChartData.length === 0}
          emptyMessage="No outbound messages in this period"
        >
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={messagesChartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="date" tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} />
              <YAxis tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} allowDecimals={false} />
              <Tooltip content={<CustomTooltip />} />
              <Legend
                wrapperStyle={{ fontSize: 12, color: "var(--muted-foreground)" }}
              />
              <Bar dataKey="sms" name="SMS" fill={CHART_COLORS.blue} radius={[2, 2, 0, 0]} stackId="a" />
              <Bar dataKey="email" name="Email" fill={CHART_COLORS.green} radius={[2, 2, 0, 0]} stackId="a" />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      {/* Charts Row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Call Outcomes — Pie Chart */}
        <ChartCard
          title="Call Outcomes"
          loading={callsLoading}
          empty={callOutcomesData.length === 0}
          emptyMessage="No AI calls in this period"
        >
          <ResponsiveContainer width="100%" height={240}>
            <PieChart>
              <Pie
                data={callOutcomesData}
                cx="50%"
                cy="50%"
                innerRadius={55}
                outerRadius={90}
                paddingAngle={3}
                dataKey="value"
                nameKey="name"
                label={({ name, percent }) =>
                  `${name} ${(percent * 100).toFixed(0)}%`
                }
                labelLine={false}
              >
                {callOutcomesData.map((_, i) => (
                  <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip
                formatter={(value: number) => [value.toLocaleString(), "Calls"]}
                contentStyle={{
                  backgroundColor: "var(--popover)",
                  border: "1px solid var(--border)",
                  borderRadius: 8,
                  color: "var(--popover-foreground)",
                  fontSize: 12,
                }}
              />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* Pipeline by Stage — Horizontal Bar */}
        <ChartCard
          title="Pipeline by Stage"
          loading={pipelineLoading}
          empty={pipelineData.length === 0}
          emptyMessage="No deals in pipeline"
        >
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={pipelineData} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis type="number" tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} allowDecimals={false} />
              <YAxis
                type="category"
                dataKey="name"
                tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                width={100}
              />
              <Tooltip
                content={({ active, payload, label }) => {
                  if (!active || !payload?.length) return null;
                  const d = payload[0]?.payload;
                  return (
                    <div className="bg-popover text-popover-foreground border border-border rounded-lg px-3 py-2 text-xs shadow-lg">
                      <p className="font-medium mb-1">{label}</p>
                      <p>Deals: {d?.deals}</p>
                      <p>Value: {formatCurrency(d?.value ?? 0)}</p>
                    </div>
                  );
                }}
              />
              <Bar dataKey="deals" name="Deals" radius={[0, 4, 4, 0]}>
                {pipelineData.map((entry, i) => (
                  <Cell key={i} fill={entry.color || PIE_COLORS[i % PIE_COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      {/* Charts Row 3 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Appointments by Status — Bar Chart */}
        <ChartCard
          title="Appointments by Status"
          loading={appointmentsLoading}
          empty={appointmentsData.length === 0}
          emptyMessage="No appointments in this period"
        >
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={appointmentsData}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="name" tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} />
              <YAxis tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} allowDecimals={false} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="count" name="Appointments" fill={CHART_COLORS.purple} radius={[4, 4, 0, 0]}>
                {appointmentsData.map((entry, i) => {
                  const statusColors: Record<string, string> = {
                    Confirmed: CHART_COLORS.green,
                    Pending: CHART_COLORS.gold,
                    Cancelled: CHART_COLORS.red,
                  };
                  return (
                    <Cell
                      key={i}
                      fill={statusColors[entry.name] || PIE_COLORS[i % PIE_COLORS.length]}
                    />
                  );
                })}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* Campaign Performance — Table */}
        <ChartCard
          title="Campaign Performance"
          loading={campaignsLoading}
          empty={!campaignPerformance?.length}
          emptyMessage="No campaigns in this period"
        >
          <div className="overflow-x-auto -mx-1">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-2 px-2 font-medium text-muted-foreground">Campaign</th>
                  <th className="text-left py-2 px-2 font-medium text-muted-foreground">Type</th>
                  <th className="text-right py-2 px-2 font-medium text-muted-foreground">Sent</th>
                  <th className="text-right py-2 px-2 font-medium text-muted-foreground">Delivery</th>
                  <th className="text-right py-2 px-2 font-medium text-muted-foreground">Engage</th>
                </tr>
              </thead>
              <tbody>
                {(campaignPerformance ?? []).slice(0, 8).map((c) => (
                  <tr key={c.id} className="border-b border-border/50 hover:bg-accent">
                    <td className="py-2 px-2 font-medium truncate max-w-[140px]">{c.name}</td>
                    <td className="py-2 px-2">
                      <Badge variant="outline" className="text-[10px] uppercase">
                        {c.type}
                      </Badge>
                    </td>
                    <td className="py-2 px-2 text-right">{c.sentCount}</td>
                    <td className="py-2 px-2 text-right">
                      <span className={c.deliveryRate >= 80 ? "text-emerald-600" : c.deliveryRate >= 50 ? "text-yellow-600" : "text-red-500"}>
                        {c.deliveryRate}%
                      </span>
                    </td>
                    <td className="py-2 px-2 text-right">{c.replyRate}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </ChartCard>
      </div>

      {/* Call Completion Rate Card */}
      {kpis && (
        <Card className="bg-white border-0 card-shadow">
          <CardContent className="pt-5 pb-4 px-5">
            <div className="flex flex-col sm:flex-row sm:items-center gap-4">
              <div className="flex-1">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">
                  AI Call Completion Rate
                </p>
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-semibold">{kpis.callCompletionRate}%</span>
                  <span className="text-sm text-muted-foreground">
                    of {kpis.aiCallsMade} calls completed successfully
                  </span>
                </div>
              </div>
              <div className="w-full sm:w-64 h-3 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${kpis.callCompletionRate}%`,
                    backgroundColor: CHART_COLORS.green,
                  }}
                />
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Custom Field Analytics */}
      {stableAccountId && (
        <CustomFieldAnalytics accountId={stableAccountId} />
      )}
    </div>
  );
}
