import { trpc } from "@/lib/trpc";
import { useAccount } from "@/contexts/AccountContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Phone,
  PhoneCall,
  PhoneOff,
  PhoneMissed,
  Voicemail,
  SkipForward,
  AlertCircle,
  Activity,
  Users,
  TrendingUp,
  Download,
  CalendarDays,
} from "lucide-react";
import {
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
  AreaChart,
  Area,
} from "recharts";
import { useState, useMemo } from "react";

// ─── Period Options ───
const PERIOD_OPTIONS = [
  { value: "7", label: "Last 7 days" },
  { value: "14", label: "Last 14 days" },
  { value: "30", label: "Last 30 days" },
  { value: "60", label: "Last 60 days" },
  { value: "90", label: "Last 90 days" },
];

// ─── Chart Colors ───
const COLORS = {
  answered: "#10b981",
  noAnswer: "#f59e0b",
  leftVoicemail: "#6366f1",
  notInterested: "#ef4444",
  callbackRequested: "#3b82f6",
  skipped: "#94a3b8",
  failed: "#dc2626",
};

const DISPOSITION_LABELS: Record<string, string> = {
  answered: "Answered",
  noAnswer: "No Answer",
  leftVoicemail: "Left Voicemail",
  notInterested: "Not Interested",
  callbackRequested: "Callback Requested",
  skipped: "Skipped",
  failed: "Failed",
};

export default function DialerAnalytics() {
  const { currentAccountId } = useAccount();
  const [period, setPeriod] = useState("30");

  const startDate = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - parseInt(period));
    return d.toISOString();
  }, [period]);

  const { data: analytics, isLoading } = trpc.powerDialer.getAnalytics.useQuery(
    {
      accountId: currentAccountId!,
      startDate,
    },
    { enabled: !!currentAccountId, staleTime: 30_000 }
  );

  // Get member names for the per-user table
  const { data: members } = trpc.members.list.useQuery(
    { accountId: currentAccountId! },
    { enabled: !!currentAccountId }
  );

  const memberMap = useMemo(() => {
    const map: Record<number, string> = {};
    if (members) {
      for (const m of members) {
        map[m.userId] = m.userName || m.userEmail || `User ${m.userId}`;
      }
    }
    return map;
  }, [members]);

  // Prepare pie chart data
  const pieData = useMemo(() => {
    if (!analytics?.summary) return [];
    const s = analytics.summary;
    return [
      { name: "Answered", value: s.answered, color: COLORS.answered },
      { name: "No Answer", value: s.noAnswer, color: COLORS.noAnswer },
      { name: "Left Voicemail", value: s.leftVoicemail, color: COLORS.leftVoicemail },
      { name: "Not Interested", value: s.notInterested, color: COLORS.notInterested },
      { name: "Callback Requested", value: s.callbackRequested, color: COLORS.callbackRequested },
      { name: "Skipped", value: s.skipped, color: COLORS.skipped },
      { name: "Failed", value: s.failed, color: COLORS.failed },
    ].filter((d) => d.value > 0);
  }, [analytics]);

  // Export CSV
  function exportCSV() {
    if (!analytics) return;
    const rows = [
      ["Metric", "Value"],
      ["Total Sessions", analytics.summary.totalSessions],
      ["Total Calls", analytics.summary.totalCalls],
      ["Answered", analytics.summary.answered],
      ["No Answer", analytics.summary.noAnswer],
      ["Left Voicemail", analytics.summary.leftVoicemail],
      ["Not Interested", analytics.summary.notInterested],
      ["Callback Requested", analytics.summary.callbackRequested],
      ["Skipped", analytics.summary.skipped],
      ["Failed", analytics.summary.failed],
      ["Connect Rate", `${analytics.summary.connectRate}%`],
      [],
      ["Date", "Total Calls", "Answered", "No Answer"],
      ...analytics.daily.map((d) => [d.date, d.totalCalls, d.answered, d.noAnswer]),
      [],
      ["User", "Sessions", "Total Calls", "Answered", "No Answer", "Voicemails", "Callbacks"],
      ...analytics.perUser.map((u) => [
        memberMap[u.userId] || `User ${u.userId}`,
        u.sessions,
        u.totalCalls,
        u.answered,
        u.noAnswer,
        u.leftVoicemail,
        u.callbackRequested,
      ]),
    ];
    const csv = rows.map((r) => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `dialer-analytics-${period}d.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  if (!currentAccountId) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        Select an account to view dialer analytics.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Dialer Analytics</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Track call volume, connect rates, and team performance
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger className="w-[160px]">
              <CalendarDays className="h-4 w-4 mr-2" />
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
          <Button variant="outline" size="sm" onClick={exportCSV} disabled={!analytics}>
            <Download className="h-4 w-4 mr-1.5" />
            Export CSV
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="p-5">
                <Skeleton className="h-4 w-24 mb-2" />
                <Skeleton className="h-8 w-16" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : !analytics ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-muted-foreground">
            <Activity className="h-12 w-12 mb-3 opacity-40" />
            <p className="text-lg font-medium">No dialer data yet</p>
            <p className="text-sm mt-1">Start a power dialer session to see analytics here.</p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <SummaryCard
              icon={Phone}
              label="Total Calls"
              value={analytics.summary.totalCalls}
              color="text-slate-700"
              bgColor="bg-slate-100"
            />
            <SummaryCard
              icon={PhoneCall}
              label="Answered"
              value={analytics.summary.answered}
              color="text-emerald-600"
              bgColor="bg-emerald-50"
              badge={`${analytics.summary.connectRate}% connect rate`}
              badgeColor="bg-emerald-100 text-emerald-700"
            />
            <SummaryCard
              icon={PhoneMissed}
              label="No Answer"
              value={analytics.summary.noAnswer}
              color="text-amber-600"
              bgColor="bg-amber-50"
            />
            <SummaryCard
              icon={Activity}
              label="Sessions"
              value={analytics.summary.totalSessions}
              color="text-blue-600"
              bgColor="bg-blue-50"
              badge={`${analytics.summary.completedSessions} completed`}
              badgeColor="bg-blue-100 text-blue-700"
            />
          </div>

          {/* Secondary Stats */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <MiniStat
              icon={Voicemail}
              label="Voicemails"
              value={analytics.summary.leftVoicemail}
              color="text-indigo-600"
            />
            <MiniStat
              icon={PhoneOff}
              label="Not Interested"
              value={analytics.summary.notInterested}
              color="text-red-500"
            />
            <MiniStat
              icon={TrendingUp}
              label="Callbacks"
              value={analytics.summary.callbackRequested}
              color="text-blue-500"
            />
            <MiniStat
              icon={SkipForward}
              label="Skipped"
              value={analytics.summary.skipped}
              color="text-slate-400"
            />
            <MiniStat
              icon={AlertCircle}
              label="Failed"
              value={analytics.summary.failed}
              color="text-red-600"
            />
          </div>

          {/* Charts Row */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Disposition Pie Chart */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-semibold">Disposition Breakdown</CardTitle>
              </CardHeader>
              <CardContent>
                {pieData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={280}>
                    <PieChart>
                      <Pie
                        data={pieData}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={100}
                        paddingAngle={2}
                        dataKey="value"
                      >
                        {pieData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip
                        formatter={(value: number) => [value, "Calls"]}
                        contentStyle={{
                          borderRadius: "8px",
                          border: "1px solid var(--border)",
                          fontSize: "12px",
                        }}
                      />
                      <Legend
                        verticalAlign="bottom"
                        height={36}
                        formatter={(value) => (
                          <span className="text-xs text-muted-foreground">{value}</span>
                        )}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-[280px] text-muted-foreground text-sm">
                    No disposition data available
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Daily Call Volume Chart */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-semibold">Daily Call Volume</CardTitle>
              </CardHeader>
              <CardContent>
                {analytics.daily.length > 0 ? (
                  <ResponsiveContainer width="100%" height={280}>
                    <AreaChart data={analytics.daily}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                      <XAxis
                        dataKey="date"
                        tick={{ fontSize: 11 }}
                        tickFormatter={(v) => {
                          const d = new Date(v);
                          return `${d.getMonth() + 1}/${d.getDate()}`;
                        }}
                      />
                      <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                      <Tooltip
                        contentStyle={{
                          borderRadius: "8px",
                          border: "1px solid var(--border)",
                          fontSize: "12px",
                        }}
                        labelFormatter={(v) => new Date(v).toLocaleDateString()}
                      />
                      <Area
                        type="monotone"
                        dataKey="totalCalls"
                        name="Total Calls"
                        stroke="#6366f1"
                        fill="#6366f1"
                        fillOpacity={0.1}
                        strokeWidth={2}
                      />
                      <Area
                        type="monotone"
                        dataKey="answered"
                        name="Answered"
                        stroke="#10b981"
                        fill="#10b981"
                        fillOpacity={0.1}
                        strokeWidth={2}
                      />
                      <Area
                        type="monotone"
                        dataKey="noAnswer"
                        name="No Answer"
                        stroke="#f59e0b"
                        fill="#f59e0b"
                        fillOpacity={0.05}
                        strokeWidth={2}
                      />
                      <Legend
                        verticalAlign="bottom"
                        height={36}
                        formatter={(value) => (
                          <span className="text-xs text-muted-foreground">{value}</span>
                        )}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-[280px] text-muted-foreground text-sm">
                    No daily data available
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Per-User Performance Table */}
          {analytics.perUser.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  Team Performance
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-left">
                        <th className="py-2.5 px-3 font-medium text-muted-foreground">User</th>
                        <th className="py-2.5 px-3 font-medium text-muted-foreground text-center">Sessions</th>
                        <th className="py-2.5 px-3 font-medium text-muted-foreground text-center">Total Calls</th>
                        <th className="py-2.5 px-3 font-medium text-muted-foreground text-center">Answered</th>
                        <th className="py-2.5 px-3 font-medium text-muted-foreground text-center">No Answer</th>
                        <th className="py-2.5 px-3 font-medium text-muted-foreground text-center">Voicemails</th>
                        <th className="py-2.5 px-3 font-medium text-muted-foreground text-center">Callbacks</th>
                        <th className="py-2.5 px-3 font-medium text-muted-foreground text-center">Connect Rate</th>
                      </tr>
                    </thead>
                    <tbody>
                      {analytics.perUser.map((user) => {
                        const connectRate =
                          user.totalCalls > 0
                            ? Math.round((user.answered / user.totalCalls) * 100)
                            : 0;
                        return (
                          <tr key={user.userId} className="border-b last:border-0 hover:bg-muted/30">
                            <td className="py-2.5 px-3 font-medium">
                              {memberMap[user.userId] || `User ${user.userId}`}
                            </td>
                            <td className="py-2.5 px-3 text-center">{user.sessions}</td>
                            <td className="py-2.5 px-3 text-center font-semibold">{user.totalCalls}</td>
                            <td className="py-2.5 px-3 text-center">
                              <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200">
                                {user.answered}
                              </Badge>
                            </td>
                            <td className="py-2.5 px-3 text-center">
                              <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">
                                {user.noAnswer}
                              </Badge>
                            </td>
                            <td className="py-2.5 px-3 text-center">{user.leftVoicemail}</td>
                            <td className="py-2.5 px-3 text-center">{user.callbackRequested}</td>
                            <td className="py-2.5 px-3 text-center">
                              <Badge
                                variant="outline"
                                className={
                                  connectRate >= 50
                                    ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                    : connectRate >= 25
                                      ? "bg-amber-50 text-amber-700 border-amber-200"
                                      : "bg-red-50 text-red-600 border-red-200"
                                }
                              >
                                {connectRate}%
                              </Badge>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}

// ─── Helper Components ───

function SummaryCard({
  icon: Icon,
  label,
  value,
  color,
  bgColor,
  badge,
  badgeColor,
}: {
  icon: any;
  label: string;
  value: number;
  color: string;
  bgColor: string;
  badge?: string;
  badgeColor?: string;
}) {
  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            {label}
          </span>
          <div className={`h-8 w-8 rounded-lg ${bgColor} flex items-center justify-center`}>
            <Icon className={`h-4 w-4 ${color}`} />
          </div>
        </div>
        <p className="text-2xl font-bold">{value.toLocaleString()}</p>
        {badge && (
          <Badge variant="outline" className={`mt-2 text-[10px] ${badgeColor}`}>
            {badge}
          </Badge>
        )}
      </CardContent>
    </Card>
  );
}

function MiniStat({
  icon: Icon,
  label,
  value,
  color,
}: {
  icon: any;
  label: string;
  value: number;
  color: string;
}) {
  return (
    <Card>
      <CardContent className="p-3 flex items-center gap-3">
        <Icon className={`h-4 w-4 ${color} shrink-0`} />
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground truncate">{label}</p>
          <p className="text-lg font-semibold">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}
