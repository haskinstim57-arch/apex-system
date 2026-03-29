import { useState, useMemo, useCallback } from "react";
import { trpc } from "@/lib/trpc";
import { useAccount } from "@/contexts/AccountContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  Download,
  FileText,
  Activity,
  Target,
  Zap,
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
  Treemap,
} from "recharts";
import { toast } from "sonner";

// ─── Period Options ───
const PERIOD_OPTIONS = [
  { value: "7", label: "Last 7 days" },
  { value: "30", label: "Last 30 days" },
  { value: "60", label: "Last 60 days" },
  { value: "90", label: "Last 90 days" },
  { value: "180", label: "Last 6 months" },
  { value: "365", label: "Last year" },
];

// ─── Chart Colors ───
const CHART_COLORS = {
  gold: "oklch(0.82 0.12 85)",
  blue: "oklch(0.70 0.15 250)",
  green: "oklch(0.72 0.17 155)",
  red: "oklch(0.65 0.22 25)",
  purple: "oklch(0.75 0.12 300)",
  cyan: "oklch(0.75 0.12 220)",
  amber: "oklch(0.80 0.14 75)",
  teal: "oklch(0.72 0.12 180)",
};

const PIE_COLORS = [
  CHART_COLORS.green,
  CHART_COLORS.blue,
  CHART_COLORS.red,
  CHART_COLORS.gold,
  CHART_COLORS.purple,
  CHART_COLORS.cyan,
  CHART_COLORS.amber,
  CHART_COLORS.teal,
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
          <span className="font-medium">
            {typeof p.value === "number" ? p.value.toLocaleString() : p.value}
          </span>
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
              {suffix && (
                <span className="text-sm text-muted-foreground ml-1">{suffix}</span>
              )}
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
                  {isNeutral
                    ? "No change"
                    : `${isPositive ? "+" : ""}${change}% vs prev period`}
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
  actions,
}: {
  title: string;
  children: React.ReactNode;
  loading?: boolean;
  empty?: boolean;
  emptyMessage?: string;
  className?: string;
  actions?: React.ReactNode;
}) {
  return (
    <Card className={`bg-white border-0 card-shadow ${className ?? ""}`}>
      <CardHeader className="pb-2 pt-4 px-5">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            {title}
          </CardTitle>
          {actions}
        </div>
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

function formatCurrencyFull(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

function formatDate(dateStr: string): string {
  try {
    const d = new Date(dateStr + "T00:00:00");
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  } catch {
    return dateStr;
  }
}

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${Math.round(seconds)}s`;
  if (seconds < 3600) return `${Math.round(seconds / 60)}m`;
  return `${(seconds / 3600).toFixed(1)}h`;
}

// ─── Export helper ───
function downloadCSV(csv: string, filename: string) {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// ─── Main Component ───
export default function Analytics() {
  const { currentAccountId, isLoading: accountsLoading } = useAccount();
  const [days, setDays] = useState(30);
  const [activeTab, setActiveTab] = useState("overview");
  const stableAccountId = useMemo(() => currentAccountId, [currentAccountId]);
  const enabled = !!stableAccountId;

  // ─── Overview Queries ───
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

  // ─── Advanced Queries ───
  const { data: campaignROI, isLoading: roiLoading } =
    trpc.analytics.campaignROI.useQuery(
      { accountId: stableAccountId!, days },
      { enabled: enabled && (activeTab === "campaigns" || activeTab === "overview") }
    );

  const { data: workflowPerf, isLoading: wfLoading } =
    trpc.analytics.workflowPerformance.useQuery(
      { accountId: stableAccountId!, days },
      { enabled: enabled && (activeTab === "workflows" || activeTab === "overview") }
    );

  const { data: revenueAttr, isLoading: revenueLoading } =
    trpc.analytics.revenueAttribution.useQuery(
      { accountId: stableAccountId!, days },
      { enabled: enabled && (activeTab === "revenue" || activeTab === "overview") }
    );

  // ─── CSV Export ───
  const handleExport = useCallback(
    async (reportType: "kpis" | "campaignROI" | "workflowPerformance" | "revenueAttribution") => {
      if (!stableAccountId) return;
      try {
        const result = await (trpc as any).analytics.exportCSV.query({
          accountId: stableAccountId,
          days,
          reportType,
        });
        if (result?.csv) {
          downloadCSV(result.csv, result.filename);
          toast.success(`Downloaded ${result.filename}`);
        }
      } catch {
        toast.error("Could not generate report");
      }
    },
    [stableAccountId, days]
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

  // Revenue attribution chart data
  const revenueChartData = (revenueAttr?.bySource ?? [])
    .slice(0, 10)
    .map((s) => ({
      name: s.source.replace("campaign:", "Campaign #"),
      deals: s.dealRevenue,
      invoices: s.invoiceCollected,
      total: s.totalRevenue,
    }));

  // Workflow summary for overview
  const wfSummary = useMemo(() => {
    if (!workflowPerf?.length) return null;
    const totalExecs = workflowPerf.reduce((s, w) => s + w.totalExecutions, 0);
    const totalCompleted = workflowPerf.reduce((s, w) => s + w.completedExecutions, 0);
    const totalFailed = workflowPerf.reduce((s, w) => s + w.failedExecutions, 0);
    const avgRate =
      totalExecs > 0 ? Math.round((totalCompleted / totalExecs) * 100) : 0;
    return { totalExecs, totalCompleted, totalFailed, avgRate, count: workflowPerf.length };
  }, [workflowPerf]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-[28px] font-bold tracking-tight text-foreground">
            Analytics
          </h1>
          <p className="text-sm text-muted-foreground">
            Performance overview and advanced reporting
          </p>
        </div>
        <div className="flex items-center gap-2">
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
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="bg-white border border-border">
          <TabsTrigger value="overview" className="gap-1.5">
            <BarChart3 className="h-3.5 w-3.5" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="campaigns" className="gap-1.5">
            <Target className="h-3.5 w-3.5" />
            Campaign ROI
          </TabsTrigger>
          <TabsTrigger value="workflows" className="gap-1.5">
            <Zap className="h-3.5 w-3.5" />
            Workflows
          </TabsTrigger>
          <TabsTrigger value="revenue" className="gap-1.5">
            <DollarSign className="h-3.5 w-3.5" />
            Revenue
          </TabsTrigger>
        </TabsList>

        {/* ═══════════════════════ OVERVIEW TAB ═══════════════════════ */}
        <TabsContent value="overview" className="space-y-6 mt-4">
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
            <ChartCard
              title="Contacts Growth"
              loading={contactsGrowthLoading}
              empty={contactsChartData.length === 0}
              emptyMessage="No new contacts in this period"
              actions={
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => handleExport("kpis")}
                >
                  <Download className="h-3 w-3 mr-1" />
                  CSV
                </Button>
              }
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
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                  />
                  <YAxis
                    tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                    allowDecimals={false}
                  />
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

            <ChartCard
              title="Messages by Channel"
              loading={messagesLoading}
              empty={messagesChartData.length === 0}
              emptyMessage="No outbound messages in this period"
            >
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={messagesChartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                  />
                  <YAxis
                    tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                    allowDecimals={false}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend wrapperStyle={{ fontSize: 12, color: "var(--muted-foreground)" }} />
                  <Bar
                    dataKey="sms"
                    name="SMS"
                    fill={CHART_COLORS.blue}
                    radius={[2, 2, 0, 0]}
                    stackId="a"
                  />
                  <Bar
                    dataKey="email"
                    name="Email"
                    fill={CHART_COLORS.green}
                    radius={[2, 2, 0, 0]}
                    stackId="a"
                  />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>
          </div>

          {/* Charts Row 2 */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
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

            <ChartCard
              title="Pipeline by Stage"
              loading={pipelineLoading}
              empty={pipelineData.length === 0}
              emptyMessage="No deals in pipeline"
            >
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={pipelineData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis
                    type="number"
                    tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                    allowDecimals={false}
                  />
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
                      <Cell
                        key={i}
                        fill={entry.color || PIE_COLORS[i % PIE_COLORS.length]}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>
          </div>

          {/* Charts Row 3 */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <ChartCard
              title="Appointments by Status"
              loading={appointmentsLoading}
              empty={appointmentsData.length === 0}
              emptyMessage="No appointments in this period"
            >
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={appointmentsData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis
                    dataKey="name"
                    tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                  />
                  <YAxis
                    tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                    allowDecimals={false}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar
                    dataKey="count"
                    name="Appointments"
                    fill={CHART_COLORS.purple}
                    radius={[4, 4, 0, 0]}
                  >
                    {appointmentsData.map((entry, i) => {
                      const statusColors: Record<string, string> = {
                        Confirmed: CHART_COLORS.green,
                        Pending: CHART_COLORS.gold,
                        Cancelled: CHART_COLORS.red,
                      };
                      return (
                        <Cell
                          key={i}
                          fill={
                            statusColors[entry.name] ||
                            PIE_COLORS[i % PIE_COLORS.length]
                          }
                        />
                      );
                    })}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>

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
                      <th className="text-left py-2 px-2 font-medium text-muted-foreground">
                        Campaign
                      </th>
                      <th className="text-left py-2 px-2 font-medium text-muted-foreground">
                        Type
                      </th>
                      <th className="text-right py-2 px-2 font-medium text-muted-foreground">
                        Sent
                      </th>
                      <th className="text-right py-2 px-2 font-medium text-muted-foreground">
                        Delivery
                      </th>
                      <th className="text-right py-2 px-2 font-medium text-muted-foreground">
                        Engage
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {(campaignPerformance ?? []).slice(0, 8).map((c) => (
                      <tr
                        key={c.id}
                        className="border-b border-border/50 hover:bg-accent"
                      >
                        <td className="py-2 px-2 font-medium truncate max-w-[140px]">
                          {c.name}
                        </td>
                        <td className="py-2 px-2">
                          <Badge variant="outline" className="text-[10px] uppercase">
                            {c.type}
                          </Badge>
                        </td>
                        <td className="py-2 px-2 text-right">{c.sentCount}</td>
                        <td className="py-2 px-2 text-right">
                          <span
                            className={
                              c.deliveryRate >= 80
                                ? "text-emerald-600"
                                : c.deliveryRate >= 50
                                  ? "text-yellow-600"
                                  : "text-red-500"
                            }
                          >
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

          {/* Call Completion Rate */}
          {kpis && (
            <Card className="bg-white border-0 card-shadow">
              <CardContent className="pt-5 pb-4 px-5">
                <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                  <div className="flex-1">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">
                      AI Call Completion Rate
                    </p>
                    <div className="flex items-baseline gap-2">
                      <span className="text-3xl font-semibold">
                        {kpis.callCompletionRate}%
                      </span>
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

          {/* Quick Summary Cards for Advanced Sections */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Revenue Summary */}
            <Card
              className="bg-white border-0 card-shadow cursor-pointer hover:shadow-md transition-shadow"
              onClick={() => setActiveTab("revenue")}
            >
              <CardContent className="pt-5 pb-4 px-5">
                <div className="flex items-center gap-3 mb-3">
                  <div className="h-9 w-9 rounded-lg flex items-center justify-center bg-emerald-50">
                    <DollarSign className="h-4 w-4 text-emerald-600" />
                  </div>
                  <div>
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      Total Revenue
                    </p>
                    <p className="text-xl font-semibold">
                      {revenueLoading ? (
                        <Skeleton className="h-6 w-20 inline-block" />
                      ) : (
                        formatCurrency(revenueAttr?.summary?.totalRevenue ?? 0)
                      )}
                    </p>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  From {revenueAttr?.summary?.sourceCount ?? 0} sources{" "}
                  <span className="text-primary">View details →</span>
                </p>
              </CardContent>
            </Card>

            {/* Workflow Summary */}
            <Card
              className="bg-white border-0 card-shadow cursor-pointer hover:shadow-md transition-shadow"
              onClick={() => setActiveTab("workflows")}
            >
              <CardContent className="pt-5 pb-4 px-5">
                <div className="flex items-center gap-3 mb-3">
                  <div className="h-9 w-9 rounded-lg flex items-center justify-center bg-purple-50">
                    <Zap className="h-4 w-4 text-purple-600" />
                  </div>
                  <div>
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      Workflow Executions
                    </p>
                    <p className="text-xl font-semibold">
                      {wfLoading ? (
                        <Skeleton className="h-6 w-20 inline-block" />
                      ) : (
                        (wfSummary?.totalExecs ?? 0).toLocaleString()
                      )}
                    </p>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  {wfSummary?.avgRate ?? 0}% completion rate{" "}
                  <span className="text-primary">View details →</span>
                </p>
              </CardContent>
            </Card>

            {/* Campaign ROI Summary */}
            <Card
              className="bg-white border-0 card-shadow cursor-pointer hover:shadow-md transition-shadow"
              onClick={() => setActiveTab("campaigns")}
            >
              <CardContent className="pt-5 pb-4 px-5">
                <div className="flex items-center gap-3 mb-3">
                  <div className="h-9 w-9 rounded-lg flex items-center justify-center bg-blue-50">
                    <Target className="h-4 w-4 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      Campaign ROI
                    </p>
                    <p className="text-xl font-semibold">
                      {roiLoading ? (
                        <Skeleton className="h-6 w-20 inline-block" />
                      ) : (
                        `${campaignROI?.length ?? 0} campaigns`
                      )}
                    </p>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  Track contacts generated & revenue{" "}
                  <span className="text-primary">View details →</span>
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Custom Field Analytics */}
          {stableAccountId && <CustomFieldAnalytics accountId={stableAccountId} />}
        </TabsContent>

        {/* ═══════════════════════ CAMPAIGN ROI TAB ═══════════════════════ */}
        <TabsContent value="campaigns" className="space-y-6 mt-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold">Campaign ROI Tracking</h2>
              <p className="text-sm text-muted-foreground">
                Contacts generated, conversion rates, and revenue per campaign
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleExport("campaignROI")}
            >
              <Download className="h-3.5 w-3.5 mr-1.5" />
              Export CSV
            </Button>
          </div>

          {/* Campaign ROI Summary Cards */}
          {!roiLoading && campaignROI && campaignROI.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <KpiCard
                title="Total Campaigns"
                value={campaignROI.length}
                icon={Send}
              />
              <KpiCard
                title="Total Recipients"
                value={campaignROI.reduce((s, c) => s + c.totalRecipients, 0)}
                icon={Users}
              />
              <KpiCard
                title="Contacts Generated"
                value={campaignROI.reduce((s, c) => s + c.contactsGenerated, 0)}
                icon={Target}
              />
              <KpiCard
                title="Total Revenue"
                value={formatCurrency(
                  campaignROI.reduce((s, c) => s + c.totalRevenue, 0)
                )}
                icon={DollarSign}
              />
            </div>
          )}

          {/* Campaign ROI Table */}
          <ChartCard
            title="Campaign Breakdown"
            loading={roiLoading}
            empty={!campaignROI?.length}
            emptyMessage="No campaigns found in this period"
          >
            <div className="overflow-x-auto -mx-1">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-2.5 px-2 font-medium text-muted-foreground">
                      Campaign
                    </th>
                    <th className="text-left py-2.5 px-2 font-medium text-muted-foreground">
                      Type
                    </th>
                    <th className="text-right py-2.5 px-2 font-medium text-muted-foreground">
                      Recipients
                    </th>
                    <th className="text-right py-2.5 px-2 font-medium text-muted-foreground">
                      Delivered
                    </th>
                    <th className="text-right py-2.5 px-2 font-medium text-muted-foreground">
                      Opened
                    </th>
                    <th className="text-right py-2.5 px-2 font-medium text-muted-foreground">
                      Clicked
                    </th>
                    <th className="text-right py-2.5 px-2 font-medium text-muted-foreground">
                      Leads
                    </th>
                    <th className="text-right py-2.5 px-2 font-medium text-muted-foreground">
                      Conv %
                    </th>
                    <th className="text-right py-2.5 px-2 font-medium text-muted-foreground">
                      Revenue
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {(campaignROI ?? []).map((c) => (
                    <tr
                      key={c.id}
                      className="border-b border-border/50 hover:bg-accent"
                    >
                      <td className="py-2.5 px-2 font-medium truncate max-w-[160px]">
                        {c.name}
                      </td>
                      <td className="py-2.5 px-2">
                        <Badge variant="outline" className="text-[10px] uppercase">
                          {c.type}
                        </Badge>
                      </td>
                      <td className="py-2.5 px-2 text-right">
                        {c.totalRecipients.toLocaleString()}
                      </td>
                      <td className="py-2.5 px-2 text-right">
                        {c.delivered.toLocaleString()}
                      </td>
                      <td className="py-2.5 px-2 text-right">{c.opened}</td>
                      <td className="py-2.5 px-2 text-right">{c.clicked}</td>
                      <td className="py-2.5 px-2 text-right font-medium">
                        {c.contactsGenerated}
                      </td>
                      <td className="py-2.5 px-2 text-right">
                        <span
                          className={
                            c.conversionRate >= 10
                              ? "text-emerald-600 font-medium"
                              : c.conversionRate >= 5
                                ? "text-yellow-600"
                                : "text-muted-foreground"
                          }
                        >
                          {c.conversionRate}%
                        </span>
                      </td>
                      <td className="py-2.5 px-2 text-right font-medium">
                        {formatCurrency(c.totalRevenue)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </ChartCard>

          {/* Campaign Conversion Funnel Chart */}
          {campaignROI && campaignROI.length > 0 && (
            <ChartCard
              title="Top Campaigns by Revenue"
              empty={false}
            >
              <ResponsiveContainer width="100%" height={280}>
                <BarChart
                  data={campaignROI
                    .sort((a, b) => b.totalRevenue - a.totalRevenue)
                    .slice(0, 10)
                    .map((c) => ({
                      name:
                        c.name.length > 20
                          ? c.name.substring(0, 20) + "..."
                          : c.name,
                      revenue: c.totalRevenue,
                      leads: c.contactsGenerated,
                    }))}
                  layout="vertical"
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis
                    type="number"
                    tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                    tickFormatter={(v) => formatCurrency(v)}
                  />
                  <YAxis
                    type="category"
                    dataKey="name"
                    tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                    width={140}
                  />
                  <Tooltip
                    content={({ active, payload, label }) => {
                      if (!active || !payload?.length) return null;
                      const d = payload[0]?.payload;
                      return (
                        <div className="bg-popover text-popover-foreground border border-border rounded-lg px-3 py-2 text-xs shadow-lg">
                          <p className="font-medium mb-1">{label}</p>
                          <p>Revenue: {formatCurrency(d?.revenue ?? 0)}</p>
                          <p>Leads: {d?.leads}</p>
                        </div>
                      );
                    }}
                  />
                  <Bar
                    dataKey="revenue"
                    name="Revenue"
                    fill={CHART_COLORS.green}
                    radius={[0, 4, 4, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>
          )}
        </TabsContent>

        {/* ═══════════════════════ WORKFLOWS TAB ═══════════════════════ */}
        <TabsContent value="workflows" className="space-y-6 mt-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold">Workflow Performance</h2>
              <p className="text-sm text-muted-foreground">
                Execution rates, completion times, and step-level breakdown
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleExport("workflowPerformance")}
            >
              <Download className="h-3.5 w-3.5 mr-1.5" />
              Export CSV
            </Button>
          </div>

          {/* Workflow Summary Cards */}
          {!wfLoading && wfSummary && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <KpiCard
                title="Active Workflows"
                value={wfSummary.count}
                icon={Zap}
              />
              <KpiCard
                title="Total Executions"
                value={wfSummary.totalExecs}
                icon={Activity}
              />
              <KpiCard
                title="Completed"
                value={wfSummary.totalCompleted}
                icon={CalendarCheck}
              />
              <KpiCard
                title="Completion Rate"
                value={`${wfSummary.avgRate}%`}
                icon={TrendingUp}
              />
            </div>
          )}

          {/* Workflow Performance Table */}
          <ChartCard
            title="Workflow Breakdown"
            loading={wfLoading}
            empty={!workflowPerf?.length}
            emptyMessage="No workflows found for this account"
          >
            <div className="overflow-x-auto -mx-1">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-2.5 px-2 font-medium text-muted-foreground">
                      Workflow
                    </th>
                    <th className="text-left py-2.5 px-2 font-medium text-muted-foreground">
                      Trigger
                    </th>
                    <th className="text-center py-2.5 px-2 font-medium text-muted-foreground">
                      Status
                    </th>
                    <th className="text-right py-2.5 px-2 font-medium text-muted-foreground">
                      Executions
                    </th>
                    <th className="text-right py-2.5 px-2 font-medium text-muted-foreground">
                      Completed
                    </th>
                    <th className="text-right py-2.5 px-2 font-medium text-muted-foreground">
                      Failed
                    </th>
                    <th className="text-right py-2.5 px-2 font-medium text-muted-foreground">
                      Rate
                    </th>
                    <th className="text-right py-2.5 px-2 font-medium text-muted-foreground">
                      Avg Time
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {(workflowPerf ?? []).map((wf) => (
                    <tr
                      key={wf.id}
                      className="border-b border-border/50 hover:bg-accent"
                    >
                      <td className="py-2.5 px-2 font-medium truncate max-w-[160px]">
                        {wf.name}
                      </td>
                      <td className="py-2.5 px-2">
                        <Badge variant="outline" className="text-[10px]">
                          {wf.triggerType.replace(/_/g, " ")}
                        </Badge>
                      </td>
                      <td className="py-2.5 px-2 text-center">
                        <Badge
                          variant={wf.isActive ? "default" : "secondary"}
                          className="text-[10px]"
                        >
                          {wf.isActive ? "Active" : "Paused"}
                        </Badge>
                      </td>
                      <td className="py-2.5 px-2 text-right">
                        {wf.totalExecutions.toLocaleString()}
                      </td>
                      <td className="py-2.5 px-2 text-right text-emerald-600">
                        {wf.completedExecutions}
                      </td>
                      <td className="py-2.5 px-2 text-right text-red-500">
                        {wf.failedExecutions}
                      </td>
                      <td className="py-2.5 px-2 text-right">
                        <span
                          className={
                            wf.completionRate >= 80
                              ? "text-emerald-600 font-medium"
                              : wf.completionRate >= 50
                                ? "text-yellow-600"
                                : "text-red-500"
                          }
                        >
                          {wf.completionRate}%
                        </span>
                      </td>
                      <td className="py-2.5 px-2 text-right text-muted-foreground">
                        {formatDuration(wf.avgDurationSeconds)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </ChartCard>

          {/* Workflow Execution Chart */}
          {workflowPerf && workflowPerf.length > 0 && (
            <ChartCard title="Execution Status by Workflow" empty={false}>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart
                  data={workflowPerf.slice(0, 10).map((wf) => ({
                    name:
                      wf.name.length > 18
                        ? wf.name.substring(0, 18) + "..."
                        : wf.name,
                    completed: wf.completedExecutions,
                    failed: wf.failedExecutions,
                    running: wf.runningExecutions,
                  }))}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis
                    dataKey="name"
                    tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
                    angle={-20}
                    textAnchor="end"
                    height={60}
                  />
                  <YAxis
                    tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                    allowDecimals={false}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend
                    wrapperStyle={{ fontSize: 12, color: "var(--muted-foreground)" }}
                  />
                  <Bar
                    dataKey="completed"
                    name="Completed"
                    fill={CHART_COLORS.green}
                    stackId="a"
                    radius={[0, 0, 0, 0]}
                  />
                  <Bar
                    dataKey="failed"
                    name="Failed"
                    fill={CHART_COLORS.red}
                    stackId="a"
                    radius={[0, 0, 0, 0]}
                  />
                  <Bar
                    dataKey="running"
                    name="Running"
                    fill={CHART_COLORS.blue}
                    stackId="a"
                    radius={[2, 2, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>
          )}

          {/* Step-Level Breakdown for Top Workflow */}
          {workflowPerf &&
            workflowPerf.length > 0 &&
            workflowPerf[0].stepBreakdown.length > 0 && (
              <ChartCard
                title={`Step Breakdown: ${workflowPerf[0].name}`}
                empty={false}
              >
                <div className="overflow-x-auto -mx-1">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="text-left py-2 px-2 font-medium text-muted-foreground">
                          Action Type
                        </th>
                        <th className="text-right py-2 px-2 font-medium text-muted-foreground">
                          Total
                        </th>
                        <th className="text-right py-2 px-2 font-medium text-muted-foreground">
                          Completed
                        </th>
                        <th className="text-right py-2 px-2 font-medium text-muted-foreground">
                          Failed
                        </th>
                        <th className="text-right py-2 px-2 font-medium text-muted-foreground">
                          Success Rate
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {workflowPerf[0].stepBreakdown.map((step) => (
                        <tr
                          key={step.action}
                          className="border-b border-border/50 hover:bg-accent"
                        >
                          <td className="py-2 px-2 font-medium">
                            {step.action.replace(/_/g, " ")}
                          </td>
                          <td className="py-2 px-2 text-right">{step.total}</td>
                          <td className="py-2 px-2 text-right text-emerald-600">
                            {step.completed}
                          </td>
                          <td className="py-2 px-2 text-right text-red-500">
                            {step.failed}
                          </td>
                          <td className="py-2 px-2 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <div className="w-16 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                                <div
                                  className="h-full rounded-full"
                                  style={{
                                    width: `${step.successRate}%`,
                                    backgroundColor:
                                      step.successRate >= 80
                                        ? CHART_COLORS.green
                                        : step.successRate >= 50
                                          ? CHART_COLORS.gold
                                          : CHART_COLORS.red,
                                  }}
                                />
                              </div>
                              <span className="text-muted-foreground">
                                {step.successRate}%
                              </span>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </ChartCard>
            )}
        </TabsContent>

        {/* ═══════════════════════ REVENUE TAB ═══════════════════════ */}
        <TabsContent value="revenue" className="space-y-6 mt-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold">Revenue Attribution</h2>
              <p className="text-sm text-muted-foreground">
                Track revenue by lead source, campaign, and channel
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleExport("revenueAttribution")}
            >
              <Download className="h-3.5 w-3.5 mr-1.5" />
              Export CSV
            </Button>
          </div>

          {/* Revenue Summary Cards */}
          {!revenueLoading && revenueAttr && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <KpiCard
                title="Total Revenue"
                value={formatCurrency(revenueAttr.summary.totalRevenue)}
                icon={DollarSign}
              />
              <KpiCard
                title="Deal Revenue"
                value={formatCurrency(revenueAttr.summary.totalDealRevenue)}
                icon={Target}
              />
              <KpiCard
                title="Invoice Collected"
                value={formatCurrency(revenueAttr.summary.totalInvoiceCollected)}
                icon={FileText}
              />
              <KpiCard
                title="Revenue Sources"
                value={revenueAttr.summary.sourceCount}
                icon={Activity}
              />
            </div>
          )}

          {/* Revenue by Source Chart */}
          <ChartCard
            title="Revenue by Source"
            loading={revenueLoading}
            empty={revenueChartData.length === 0}
            emptyMessage="No revenue data available for this period"
          >
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={revenueChartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis
                  dataKey="name"
                  tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
                  angle={-20}
                  textAnchor="end"
                  height={60}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                  tickFormatter={(v) => formatCurrency(v)}
                />
                <Tooltip
                  content={({ active, payload, label }) => {
                    if (!active || !payload?.length) return null;
                    const d = payload[0]?.payload;
                    return (
                      <div className="bg-popover text-popover-foreground border border-border rounded-lg px-3 py-2 text-xs shadow-lg">
                        <p className="font-medium mb-1">{label}</p>
                        <p>Deal Revenue: {formatCurrency(d?.deals ?? 0)}</p>
                        <p>Invoice Collected: {formatCurrency(d?.invoices ?? 0)}</p>
                        <p className="font-medium mt-1">
                          Total: {formatCurrency(d?.total ?? 0)}
                        </p>
                      </div>
                    );
                  }}
                />
                <Legend
                  wrapperStyle={{ fontSize: 12, color: "var(--muted-foreground)" }}
                />
                <Bar
                  dataKey="deals"
                  name="Deal Revenue"
                  fill={CHART_COLORS.blue}
                  stackId="a"
                  radius={[0, 0, 0, 0]}
                />
                <Bar
                  dataKey="invoices"
                  name="Invoice Collected"
                  fill={CHART_COLORS.green}
                  stackId="a"
                  radius={[2, 2, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>

          {/* Revenue Attribution Table */}
          <ChartCard
            title="Source Breakdown"
            loading={revenueLoading}
            empty={!revenueAttr?.bySource?.length}
            emptyMessage="No revenue sources found"
          >
            <div className="overflow-x-auto -mx-1">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-2.5 px-2 font-medium text-muted-foreground">
                      Source
                    </th>
                    <th className="text-right py-2.5 px-2 font-medium text-muted-foreground">
                      Deals
                    </th>
                    <th className="text-right py-2.5 px-2 font-medium text-muted-foreground">
                      Deal Revenue
                    </th>
                    <th className="text-right py-2.5 px-2 font-medium text-muted-foreground">
                      Invoices
                    </th>
                    <th className="text-right py-2.5 px-2 font-medium text-muted-foreground">
                      Collected
                    </th>
                    <th className="text-right py-2.5 px-2 font-medium text-muted-foreground">
                      Total Revenue
                    </th>
                    <th className="text-right py-2.5 px-2 font-medium text-muted-foreground">
                      Share
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {(revenueAttr?.bySource ?? []).map((s, i) => {
                    const share =
                      revenueAttr?.summary?.totalRevenue &&
                      revenueAttr.summary.totalRevenue > 0
                        ? Math.round(
                            (s.totalRevenue / revenueAttr.summary.totalRevenue) * 100
                          )
                        : 0;
                    return (
                      <tr
                        key={i}
                        className="border-b border-border/50 hover:bg-accent"
                      >
                        <td className="py-2.5 px-2">
                          <div className="flex items-center gap-2">
                            <span
                              className="w-2 h-2 rounded-full inline-block"
                              style={{
                                backgroundColor:
                                  PIE_COLORS[i % PIE_COLORS.length],
                              }}
                            />
                            <span className="font-medium">
                              {s.source.replace("campaign:", "Campaign #")}
                            </span>
                          </div>
                        </td>
                        <td className="py-2.5 px-2 text-right">{s.dealCount}</td>
                        <td className="py-2.5 px-2 text-right">
                          {formatCurrency(s.dealRevenue)}
                        </td>
                        <td className="py-2.5 px-2 text-right">
                          {s.invoiceCount}
                        </td>
                        <td className="py-2.5 px-2 text-right">
                          {formatCurrency(s.invoiceCollected)}
                        </td>
                        <td className="py-2.5 px-2 text-right font-medium">
                          {formatCurrency(s.totalRevenue)}
                        </td>
                        <td className="py-2.5 px-2 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <div className="w-12 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                              <div
                                className="h-full rounded-full"
                                style={{
                                  width: `${share}%`,
                                  backgroundColor:
                                    PIE_COLORS[i % PIE_COLORS.length],
                                }}
                              />
                            </div>
                            <span className="text-muted-foreground w-8 text-right">
                              {share}%
                            </span>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </ChartCard>

          {/* Revenue Pie Chart */}
          {revenueAttr && revenueAttr.bySource.length > 0 && (
            <ChartCard title="Revenue Distribution" empty={false}>
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie
                    data={revenueAttr.bySource.slice(0, 8).map((s) => ({
                      name: s.source.replace("campaign:", "Campaign #"),
                      value: s.totalRevenue,
                    }))}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={3}
                    dataKey="value"
                    nameKey="name"
                    label={({ name, percent }) =>
                      `${name.length > 15 ? name.substring(0, 15) + "..." : name} ${(percent * 100).toFixed(0)}%`
                    }
                    labelLine={true}
                  >
                    {revenueAttr.bySource.slice(0, 8).map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value: number) => [
                      formatCurrency(value),
                      "Revenue",
                    ]}
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
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
