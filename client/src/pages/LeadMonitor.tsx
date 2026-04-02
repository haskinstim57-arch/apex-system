import React, { useState, useEffect, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Activity,
  Clock,
  TrendingUp,
  RefreshCw,
  Bell,
  BellOff,
  ChevronLeft,
  ChevronRight,
  Eye,
  Filter,
  Zap,
  BarChart3,
} from "lucide-react";

// ─── Status badge helper ───
function StatusBadge({ status }: { status: string }) {
  switch (status) {
    case "success":
      return (
        <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 border-0">
          <CheckCircle2 className="w-3 h-3 mr-1" />
          Success
        </Badge>
      );
    case "failure":
      return (
        <Badge className="bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 border-0">
          <XCircle className="w-3 h-3 mr-1" />
          Failed
        </Badge>
      );
    case "partial":
      return (
        <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 border-0">
          <AlertTriangle className="w-3 h-3 mr-1" />
          Partial
        </Badge>
      );
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
}

// ─── Routing method label ───
function RoutingMethodLabel({ method }: { method: string }) {
  const labels: Record<string, { label: string; color: string }> = {
    manual_mapping: { label: "Admin Mapping", color: "text-blue-600 dark:text-blue-400" },
    oauth_page: { label: "OAuth Page", color: "text-purple-600 dark:text-purple-400" },
    payload_explicit: { label: "Payload", color: "text-gray-600 dark:text-gray-400" },
    poller: { label: "Poller", color: "text-teal-600 dark:text-teal-400" },
    unknown: { label: "Unknown", color: "text-gray-400" },
  };
  const info = labels[method] || labels.unknown;
  return <span className={`text-xs font-medium ${info.color}`}>{info.label}</span>;
}

// ─── Simple bar chart using divs ───
function MiniBarChart({ data }: { data: Array<{ hour: string; success: number; failure: number; partial: number }> }) {
  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-40 text-muted-foreground text-sm">
        No data yet — events will appear as leads are processed
      </div>
    );
  }

  const maxVal = Math.max(...data.map((d) => d.success + d.failure + d.partial), 1);

  return (
    <div className="flex items-end gap-[2px] h-40 w-full">
      {data.map((d, i) => {
        const total = d.success + d.failure + d.partial;
        const successH = (d.success / maxVal) * 100;
        const failureH = (d.failure / maxVal) * 100;
        const partialH = (d.partial / maxVal) * 100;
        const hour = d.hour.split(" ")[1] || d.hour;

        return (
          <Tooltip key={i}>
            <TooltipTrigger asChild>
              <div className="flex flex-col items-center flex-1 min-w-0 cursor-pointer">
                <div className="flex flex-col-reverse w-full rounded-t" style={{ height: `${Math.max(((total / maxVal) * 100), 2)}%` }}>
                  {d.success > 0 && (
                    <div
                      className="bg-emerald-500 rounded-t first:rounded-b"
                      style={{ height: `${successH / (successH + failureH + partialH) * 100}%`, minHeight: "2px" }}
                    />
                  )}
                  {d.partial > 0 && (
                    <div
                      className="bg-amber-500"
                      style={{ height: `${partialH / (successH + failureH + partialH) * 100}%`, minHeight: "2px" }}
                    />
                  )}
                  {d.failure > 0 && (
                    <div
                      className="bg-red-500 rounded-t"
                      style={{ height: `${failureH / (successH + failureH + partialH) * 100}%`, minHeight: "2px" }}
                    />
                  )}
                </div>
              </div>
            </TooltipTrigger>
            <TooltipContent side="top" className="text-xs">
              <div className="font-medium">{d.hour}</div>
              <div className="text-emerald-500">Success: {d.success}</div>
              {d.failure > 0 && <div className="text-red-500">Failed: {d.failure}</div>}
              {d.partial > 0 && <div className="text-amber-500">Partial: {d.partial}</div>}
            </TooltipContent>
          </Tooltip>
        );
      })}
    </div>
  );
}

// ─── Main Component ───
export default function LeadMonitor() {
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [page, setPage] = useState(0);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const PAGE_SIZE = 20;

  // ─── Queries ───
  const overview = trpc.leadMonitor.getOverview.useQuery(
    { hoursBack: 168 },
    { refetchInterval: autoRefresh ? 30_000 : false }
  );

  const timeSeries = trpc.leadMonitor.getTimeSeries.useQuery(
    { hoursBack: 48 },
    { refetchInterval: autoRefresh ? 30_000 : false }
  );

  const recentEvents = trpc.leadMonitor.getRecentEvents.useQuery(
    {
      limit: PAGE_SIZE,
      offset: page * PAGE_SIZE,
      status: statusFilter === "all" ? undefined : (statusFilter as any),
    },
    { refetchInterval: autoRefresh ? 30_000 : false }
  );

  const failures = trpc.leadMonitor.getFailures.useQuery(undefined, {
    refetchInterval: autoRefresh ? 30_000 : false,
  });

  const methodBreakdown = trpc.leadMonitor.getMethodBreakdown.useQuery(
    { hoursBack: 168 },
    { refetchInterval: autoRefresh ? 60_000 : false }
  );

  // ─── Mutations ───
  const utils = trpc.useUtils();
  const ackOne = trpc.leadMonitor.acknowledgeFailure.useMutation({
    onSuccess: () => {
      utils.leadMonitor.getFailures.invalidate();
      utils.leadMonitor.getOverview.invalidate();
    },
  });
  const ackAll = trpc.leadMonitor.acknowledgeAll.useMutation({
    onSuccess: () => {
      utils.leadMonitor.getFailures.invalidate();
      utils.leadMonitor.getOverview.invalidate();
    },
  });

  const stats = overview.data;
  const isLoading = overview.isLoading;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Lead Routing Monitor</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Real-time tracking of Facebook lead routing success rates and failures
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setAutoRefresh(!autoRefresh)}
            className={autoRefresh ? "text-emerald-600" : "text-muted-foreground"}
          >
            {autoRefresh ? <Activity className="w-4 h-4 mr-1.5 animate-pulse" /> : <RefreshCw className="w-4 h-4 mr-1.5" />}
            {autoRefresh ? "Live" : "Paused"}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              utils.leadMonitor.getOverview.invalidate();
              utils.leadMonitor.getTimeSeries.invalidate();
              utils.leadMonitor.getRecentEvents.invalidate();
              utils.leadMonitor.getFailures.invalidate();
              utils.leadMonitor.getMethodBreakdown.invalidate();
            }}
          >
            <RefreshCw className="w-4 h-4 mr-1.5" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Events (7d)</p>
                <p className="text-3xl font-bold mt-1">
                  {isLoading ? "—" : stats?.totalEvents.toLocaleString()}
                </p>
              </div>
              <div className="h-12 w-12 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                <BarChart3 className="w-6 h-6 text-blue-600 dark:text-blue-400" />
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              {stats?.last24hEvents ?? 0} in last 24h
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Success Rate</p>
                <p className={`text-3xl font-bold mt-1 ${
                  (stats?.successRate ?? 100) >= 95
                    ? "text-emerald-600"
                    : (stats?.successRate ?? 100) >= 80
                    ? "text-amber-600"
                    : "text-red-600"
                }`}>
                  {isLoading ? "—" : `${stats?.successRate}%`}
                </p>
              </div>
              <div className="h-12 w-12 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
                <TrendingUp className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              {stats?.successCount ?? 0} success / {stats?.failureCount ?? 0} failed
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Avg Response Time</p>
                <p className="text-3xl font-bold mt-1">
                  {isLoading ? "—" : `${stats?.avgResponseTimeMs ?? 0}ms`}
                </p>
              </div>
              <div className="h-12 w-12 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
                <Clock className="w-6 h-6 text-purple-600 dark:text-purple-400" />
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              From webhook receipt to contact creation
            </p>
          </CardContent>
        </Card>

        <Card className={stats?.unacknowledgedFailures && stats.unacknowledgedFailures > 0 ? "border-red-300 dark:border-red-800" : ""}>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Unresolved Failures</p>
                <p className={`text-3xl font-bold mt-1 ${
                  (stats?.unacknowledgedFailures ?? 0) > 0 ? "text-red-600" : "text-emerald-600"
                }`}>
                  {isLoading ? "—" : stats?.unacknowledgedFailures}
                </p>
              </div>
              <div className={`h-12 w-12 rounded-full flex items-center justify-center ${
                (stats?.unacknowledgedFailures ?? 0) > 0
                  ? "bg-red-100 dark:bg-red-900/30"
                  : "bg-emerald-100 dark:bg-emerald-900/30"
              }`}>
                {(stats?.unacknowledgedFailures ?? 0) > 0 ? (
                  <Bell className="w-6 h-6 text-red-600 dark:text-red-400 animate-pulse" />
                ) : (
                  <BellOff className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
                )}
              </div>
            </div>
            {(stats?.unacknowledgedFailures ?? 0) > 0 && (
              <Button
                variant="outline"
                size="sm"
                className="mt-2 text-xs"
                onClick={() => ackAll.mutate()}
                disabled={ackAll.isPending}
              >
                Acknowledge All
              </Button>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Time Series Chart */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Lead Routing Activity (48h)</CardTitle>
          <CardDescription>Hourly breakdown of routing events by status</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4 mb-3 text-xs">
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded bg-emerald-500" />
              <span className="text-muted-foreground">Success</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded bg-red-500" />
              <span className="text-muted-foreground">Failed</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded bg-amber-500" />
              <span className="text-muted-foreground">Partial</span>
            </div>
          </div>
          <MiniBarChart data={timeSeries.data || []} />
        </CardContent>
      </Card>

      {/* Routing Method Breakdown + Failure Alerts side by side */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Routing Method Breakdown */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Routing Method Breakdown (7d)</CardTitle>
          </CardHeader>
          <CardContent>
            {methodBreakdown.data && methodBreakdown.data.length > 0 ? (
              <div className="space-y-3">
                {methodBreakdown.data.map((m: any) => {
                  const total = Number(m.total) || 0;
                  const success = Number(m.successCount) || 0;
                  const failure = Number(m.failureCount) || 0;
                  const rate = total > 0 ? Math.round((success / total) * 100) : 0;
                  return (
                    <div key={m.routingMethod} className="flex items-center gap-3">
                      <div className="w-28">
                        <RoutingMethodLabel method={m.routingMethod} />
                      </div>
                      <div className="flex-1">
                        <div className="h-2 bg-muted rounded-full overflow-hidden">
                          <div
                            className="h-full bg-emerald-500 rounded-full"
                            style={{ width: `${rate}%` }}
                          />
                        </div>
                      </div>
                      <div className="text-xs text-muted-foreground w-24 text-right">
                        {success}/{total} ({rate}%)
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No routing data yet</p>
            )}
          </CardContent>
        </Card>

        {/* Unresolved Failures */}
        <Card className={(failures.data?.length ?? 0) > 0 ? "border-red-200 dark:border-red-900" : ""}>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-red-500" />
                Unresolved Failures
              </CardTitle>
              {(failures.data?.length ?? 0) > 0 && (
                <Badge variant="destructive" className="text-xs">
                  {failures.data?.length}
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {failures.data && failures.data.length > 0 ? (
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {failures.data.slice(0, 10).map((f: any) => (
                  <div
                    key={f.id}
                    className="flex items-start justify-between p-2 rounded bg-red-50 dark:bg-red-950/20 border border-red-100 dark:border-red-900/50"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-medium truncate">
                        Lead: {f.leadId || "unknown"} | Page: {f.pageId || "unknown"}
                      </div>
                      <div className="text-xs text-red-600 dark:text-red-400 mt-0.5 truncate">
                        {f.errorMessage || "No error details"}
                      </div>
                      <div className="text-[10px] text-muted-foreground mt-0.5">
                        {new Date(f.createdAt).toLocaleString()}
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="ml-2 h-7 text-xs shrink-0"
                      onClick={() => ackOne.mutate({ eventId: f.id })}
                      disabled={ackOne.isPending}
                    >
                      Ack
                    </Button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-6 text-muted-foreground">
                <CheckCircle2 className="w-8 h-8 text-emerald-500 mb-2" />
                <p className="text-sm">All clear — no unresolved failures</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent Events Table */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Recent Events</CardTitle>
            <div className="flex items-center gap-2">
              <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(0); }}>
                <SelectTrigger className="w-32 h-8 text-xs">
                  <Filter className="w-3 h-3 mr-1" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="success">Success</SelectItem>
                  <SelectItem value="failure">Failed</SelectItem>
                  <SelectItem value="partial">Partial</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[60px]">Status</TableHead>
                  <TableHead>Lead ID</TableHead>
                  <TableHead>Page ID</TableHead>
                  <TableHead>Account</TableHead>
                  <TableHead>Method</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead className="text-right">Response</TableHead>
                  <TableHead>Time</TableHead>
                  <TableHead>Error</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recentEvents.isLoading ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                      Loading events...
                    </TableCell>
                  </TableRow>
                ) : recentEvents.data && recentEvents.data.length > 0 ? (
                  recentEvents.data.map((event: any) => (
                    <TableRow key={event.id} className={event.status === "failure" ? "bg-red-50/50 dark:bg-red-950/10" : ""}>
                      <TableCell>
                        <StatusBadge status={event.status} />
                      </TableCell>
                      <TableCell className="font-mono text-xs max-w-[120px] truncate">
                        {event.leadId || "—"}
                      </TableCell>
                      <TableCell className="font-mono text-xs max-w-[120px] truncate">
                        {event.pageId || "—"}
                      </TableCell>
                      <TableCell className="text-xs">
                        {event.accountId || "—"}
                      </TableCell>
                      <TableCell>
                        <RoutingMethodLabel method={event.routingMethod} />
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {event.source?.replace("webhook_", "").replace("_", " ") || "—"}
                      </TableCell>
                      <TableCell className="text-right text-xs font-mono">
                        {event.responseTimeMs != null ? `${event.responseTimeMs}ms` : "—"}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                        {new Date(event.createdAt).toLocaleString()}
                      </TableCell>
                      <TableCell className="text-xs text-red-600 dark:text-red-400 max-w-[200px] truncate">
                        {event.errorMessage || "—"}
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                      No events found
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between mt-3">
            <p className="text-xs text-muted-foreground">
              Page {page + 1} · Showing {recentEvents.data?.length ?? 0} events
            </p>
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage(Math.max(0, page - 1))}
                disabled={page === 0}
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage(page + 1)}
                disabled={(recentEvents.data?.length ?? 0) < PAGE_SIZE}
              >
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
