import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  Activity,
  DollarSign,
  Zap,
  AlertTriangle,
  CheckCircle,
  XCircle,
  TrendingUp,
  Clock,
  BarChart3,
} from "lucide-react";

export default function GeminiUsage() {
  const [days, setDays] = useState(30);

  const { data, isLoading, refetch } = trpc.jarvis.getUsageStats.useQuery(
    { days },
    { retry: 1 }
  );

  const stats = useMemo(() => {
    if (!data) return null;
    return {
      totalRequests: data.totalRequests ?? 0,
      totalPromptTokens: data.totalPromptTokens ?? 0,
      totalCompletionTokens: data.totalCompletionTokens ?? 0,
      totalTokens: data.totalTokens ?? 0,
      totalCost: parseFloat(data.totalCost ?? "0"),
      successCount: data.successCount ?? 0,
      failCount: data.failCount ?? 0,
      successRate: data.totalRequests > 0
        ? ((data.successCount ?? 0) / data.totalRequests * 100).toFixed(1)
        : "0",
      dailyBreakdown: data.dailyBreakdown ?? [],
    };
  }, [data]);

  const maxDailyTokens = useMemo(() => {
    if (!stats?.dailyBreakdown?.length) return 1;
    return Math.max(...stats.dailyBreakdown.map(d => d.tokens), 1);
  }, [stats]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Gemini API Usage</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Monitor Jarvis AI token consumption and estimated costs
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Select value={String(days)} onValueChange={(v) => setDays(Number(v))}>
            <SelectTrigger className="w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7">Last 7 days</SelectItem>
              <SelectItem value="14">Last 14 days</SelectItem>
              <SelectItem value="30">Last 30 days</SelectItem>
              <SelectItem value="90">Last 90 days</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            Refresh
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i} className="animate-pulse">
              <CardHeader className="pb-2">
                <div className="h-4 bg-muted rounded w-24" />
              </CardHeader>
              <CardContent>
                <div className="h-8 bg-muted rounded w-16 mb-2" />
                <div className="h-3 bg-muted rounded w-32" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : stats ? (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Total Requests</CardTitle>
                <Activity className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.totalRequests.toLocaleString()}</div>
                <div className="flex items-center gap-2 mt-1">
                  <Badge variant={stats.failCount > 0 ? "destructive" : "secondary"} className="text-[10px]">
                    {stats.successCount} ok / {stats.failCount} failed
                  </Badge>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Total Tokens</CardTitle>
                <Zap className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.totalTokens.toLocaleString()}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  {stats.totalPromptTokens.toLocaleString()} input / {stats.totalCompletionTokens.toLocaleString()} output
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Estimated Cost</CardTitle>
                <DollarSign className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">${stats.totalCost.toFixed(4)}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  Gemini 2.5 Flash pricing
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Success Rate</CardTitle>
                {Number(stats.successRate) >= 95 ? (
                  <CheckCircle className="h-4 w-4 text-green-500" />
                ) : Number(stats.successRate) >= 80 ? (
                  <AlertTriangle className="h-4 w-4 text-yellow-500" />
                ) : (
                  <XCircle className="h-4 w-4 text-red-500" />
                )}
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.successRate}%</div>
                <p className="text-xs text-muted-foreground mt-1">
                  {stats.totalRequests > 0 ? "Based on all requests" : "No data yet"}
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Daily Breakdown */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
                Daily Usage Breakdown
              </CardTitle>
              <CardDescription>Token consumption per day</CardDescription>
            </CardHeader>
            <CardContent>
              {stats.dailyBreakdown.length === 0 ? (
                <div className="text-center py-12">
                  <Clock className="h-8 w-8 mx-auto text-muted-foreground/40 mb-3" />
                  <p className="text-sm text-muted-foreground">No usage data yet</p>
                  <p className="text-xs text-muted-foreground/60 mt-1">
                    Usage will appear here after Jarvis processes requests
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {/* Table header */}
                  <div className="grid grid-cols-[120px_1fr_100px_100px_80px] gap-2 text-xs font-medium text-muted-foreground pb-2 border-b">
                    <span>Date</span>
                    <span>Tokens</span>
                    <span className="text-right">Requests</span>
                    <span className="text-right">Cost</span>
                    <span className="text-right">Status</span>
                  </div>
                  {stats.dailyBreakdown.map((day) => (
                    <div key={day.date} className="grid grid-cols-[120px_1fr_100px_100px_80px] gap-2 items-center text-sm py-1.5">
                      <span className="text-muted-foreground font-mono text-xs">{day.date}</span>
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-5 bg-muted rounded-full overflow-hidden">
                          <div
                            className="h-full bg-primary/70 rounded-full transition-all"
                            style={{ width: `${Math.max((day.tokens / maxDailyTokens) * 100, 2)}%` }}
                          />
                        </div>
                        <span className="text-xs text-muted-foreground w-16 text-right shrink-0">
                          {day.tokens.toLocaleString()}
                        </span>
                      </div>
                      <span className="text-right text-xs">{day.requests}</span>
                      <span className="text-right text-xs font-mono">${parseFloat(day.cost).toFixed(4)}</span>
                      <div className="flex justify-end">
                        <TrendingUp className="h-3.5 w-3.5 text-green-500" />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Pricing Info */}
          <Card className="bg-muted/30">
            <CardContent className="pt-6">
              <div className="flex items-start gap-3">
                <DollarSign className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium">Gemini 2.5 Flash Pricing</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Input: $0.15 per 1M tokens | Output: $0.60 per 1M tokens | 
                    Costs are estimated based on token counts reported by the API.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </>
      ) : (
        <Card>
          <CardContent className="py-12 text-center">
            <AlertTriangle className="h-8 w-8 mx-auto text-muted-foreground/40 mb-3" />
            <p className="text-sm text-muted-foreground">Unable to load usage data</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
