import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { useAccount } from "@/contexts/AccountContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { Loader2, Bell, Mail, MessageSquare, Send, CheckCircle, XCircle, AlertTriangle, RefreshCw, ArrowLeft, Copy, ExternalLink, Settings } from "lucide-react";
import { useLocation } from "wouter";

type ChannelFilter = "all" | "push" | "email" | "sms";
type StatusFilter = "all" | "sent" | "failed" | "skipped";

export default function NotificationDeliveryDashboard() {
  const { user } = useAuth();
  const { accounts } = useAccount();
  const [, setLocation] = useLocation();
  const isAdmin = user?.role === "admin";

  const [selectedAccountId, setSelectedAccountId] = useState<number | null>(null);
  const [channelFilter, setChannelFilter] = useState<ChannelFilter>("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

  // Use first account as default
  const accountId = selectedAccountId ?? accounts?.[0]?.id ?? null;

  const { data: stats, isLoading: statsLoading, refetch: refetchStats } = trpc.notifications.deliveryStats.useQuery(
    { accountId: accountId! },
    { enabled: isAdmin && !!accountId, staleTime: 0, refetchOnMount: true }
  );

  const { data: logs, isLoading: logsLoading, refetch: refetchLogs } = trpc.notifications.deliveryLogs.useQuery(
    {
      accountId: accountId!,
      limit: 100,
      ...(channelFilter !== "all" ? { channel: channelFilter } : {}),
      ...(statusFilter !== "all" ? { status: statusFilter as "sent" | "failed" | "skipped" } : {}),
    },
    { enabled: isAdmin && !!accountId, staleTime: 0, refetchOnMount: true }
  );

  const handleRefresh = () => {
    refetchStats();
    refetchLogs();
  };

  if (!isAdmin) {
    return (
      <div className="container max-w-4xl py-8">
        <p className="text-muted-foreground">Admin access required.</p>
      </div>
    );
  }

  const channelIcon = (channel: string) => {
    switch (channel) {
      case "push": return <Bell className="h-4 w-4" />;
      case "email": return <Mail className="h-4 w-4" />;
      case "sms": return <MessageSquare className="h-4 w-4" />;
      default: return <Send className="h-4 w-4" />;
    }
  };

  const statusBadge = (status: string) => {
    switch (status) {
      case "sent":
        return <Badge variant="default" className="bg-emerald-500/10 text-emerald-600 border-emerald-200"><CheckCircle className="h-3 w-3 mr-1" />Sent</Badge>;
      case "failed":
        return <Badge variant="destructive" className="bg-red-500/10 text-red-600 border-red-200"><XCircle className="h-3 w-3 mr-1" />Failed</Badge>;
      case "skipped":
        return <Badge variant="secondary" className="bg-amber-500/10 text-amber-600 border-amber-200"><AlertTriangle className="h-3 w-3 mr-1" />Skipped</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const deliveryStatusBadge = (deliveryStatus: string | null) => {
    if (!deliveryStatus) return null;
    const colors: Record<string, string> = {
      delivered: "bg-emerald-500/10 text-emerald-600 border-emerald-200",
      bounced: "bg-red-500/10 text-red-600 border-red-200",
      dropped: "bg-red-500/10 text-red-600 border-red-200",
      deferred: "bg-amber-500/10 text-amber-600 border-amber-200",
      opened: "bg-blue-500/10 text-blue-600 border-blue-200",
      clicked: "bg-purple-500/10 text-purple-600 border-purple-200",
      undelivered: "bg-red-500/10 text-red-600 border-red-200",
      failed: "bg-red-500/10 text-red-600 border-red-200",
      sent: "bg-emerald-500/10 text-emerald-600 border-emerald-200",
    };
    return (
      <Badge variant="outline" className={colors[deliveryStatus] || "bg-gray-500/10 text-gray-600 border-gray-200"}>
        {deliveryStatus}
      </Badge>
    );
  };

  // Compute totals from stats
  const totals = useMemo(() => {
    if (!stats) return { total: 0, sent: 0, failed: 0, skipped: 0 };
    const channels = ["push", "email", "sms"] as const;
    let sent = 0, failed = 0, skipped = 0;
    for (const ch of channels) {
      const s = (stats as any)[ch];
      if (s) {
        sent += s.sent || 0;
        failed += s.failed || 0;
        skipped += s.skipped || 0;
      }
    }
    return { total: sent + failed + skipped, sent, failed, skipped };
  }, [stats]);

  return (
    <div className="container max-w-6xl py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => setLocation("/settings/notifications")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Notification Delivery Dashboard</h1>
            <p className="text-sm text-muted-foreground">Monitor push, email, and SMS notification delivery across accounts</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {accounts && accounts.length > 0 && (
            <Select value={String(accountId)} onValueChange={(v) => setSelectedAccountId(Number(v))}>
              <SelectTrigger className="w-[220px]">
                <SelectValue placeholder="Select account" />
              </SelectTrigger>
              <SelectContent>
                {accounts.map((a: any) => (
                  <SelectItem key={a.id} value={String(a.id)}>{a.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <Button variant="outline" size="sm" onClick={handleRefresh}>
            <RefreshCw className="h-4 w-4 mr-1" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Stats Overview Cards */}
      {statsLoading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <>
          {/* Summary Row */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="pt-4 pb-3 px-4">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Total Sent</p>
                <p className="text-3xl font-bold mt-1">{totals.total.toLocaleString()}</p>
                <p className="text-xs text-muted-foreground mt-1">All channels combined</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 pb-3 px-4">
                <p className="text-xs font-medium text-emerald-600 uppercase tracking-wider">Delivered</p>
                <p className="text-3xl font-bold mt-1 text-emerald-600">{totals.sent.toLocaleString()}</p>
                <p className="text-xs text-muted-foreground mt-1">{totals.total > 0 ? ((totals.sent / totals.total) * 100).toFixed(1) : 0}% success rate</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 pb-3 px-4">
                <p className="text-xs font-medium text-red-600 uppercase tracking-wider">Failed</p>
                <p className="text-3xl font-bold mt-1 text-red-600">{totals.failed.toLocaleString()}</p>
                <p className="text-xs text-muted-foreground mt-1">{totals.total > 0 ? ((totals.failed / totals.total) * 100).toFixed(1) : 0}% failure rate</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 pb-3 px-4">
                <p className="text-xs font-medium text-amber-600 uppercase tracking-wider">Skipped</p>
                <p className="text-3xl font-bold mt-1 text-amber-600">{totals.skipped.toLocaleString()}</p>
                <p className="text-xs text-muted-foreground mt-1">Preference-based or DND</p>
              </CardContent>
            </Card>
          </div>

          {/* Per-Channel Breakdown */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {(["push", "email", "sms"] as const).map((channel) => {
              const s = stats ? (stats as any)[channel] : { sent: 0, failed: 0, skipped: 0 };
              const total = (s?.sent || 0) + (s?.failed || 0) + (s?.skipped || 0);
              const successRate = total > 0 ? ((s?.sent || 0) / total * 100).toFixed(1) : "0.0";
              return (
                <Card key={channel}>
                  <CardHeader className="pb-2">
                    <CardTitle className="flex items-center gap-2 text-base">
                      {channelIcon(channel)}
                      <span className="capitalize">{channel}</span>
                    </CardTitle>
                    <CardDescription>{total.toLocaleString()} total notifications</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {/* Progress bar */}
                      <div className="flex h-2 rounded-full overflow-hidden bg-muted">
                        {total > 0 && (
                          <>
                            <div className="bg-emerald-500 transition-all" style={{ width: `${(s?.sent || 0) / total * 100}%` }} />
                            <div className="bg-red-500 transition-all" style={{ width: `${(s?.failed || 0) / total * 100}%` }} />
                            <div className="bg-amber-400 transition-all" style={{ width: `${(s?.skipped || 0) / total * 100}%` }} />
                          </>
                        )}
                      </div>
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span className="text-emerald-600">{s?.sent || 0} sent</span>
                        <span className="text-red-600">{s?.failed || 0} failed</span>
                        <span className="text-amber-600">{s?.skipped || 0} skipped</span>
                      </div>
                      <p className="text-xs text-muted-foreground">{successRate}% success rate</p>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </>
      )}

      {/* Delivery Log Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Delivery Log</CardTitle>
              <CardDescription>Recent notification delivery attempts</CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Select value={channelFilter} onValueChange={(v) => setChannelFilter(v as ChannelFilter)}>
                <SelectTrigger className="w-[130px]">
                  <SelectValue placeholder="Channel" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Channels</SelectItem>
                  <SelectItem value="push">Push</SelectItem>
                  <SelectItem value="email">Email</SelectItem>
                  <SelectItem value="sms">SMS</SelectItem>
                </SelectContent>
              </Select>
              <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as StatusFilter)}>
                <SelectTrigger className="w-[120px]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="sent">Sent</SelectItem>
                  <SelectItem value="failed">Failed</SelectItem>
                  <SelectItem value="skipped">Skipped</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {logsLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : !logs || logs.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Send className="h-8 w-8 mx-auto mb-2 opacity-40" />
              <p>No delivery logs found</p>
              <p className="text-xs mt-1">Notification delivery events will appear here</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left">
                    <th className="pb-2 pr-3 font-medium text-muted-foreground">Channel</th>
                    <th className="pb-2 pr-3 font-medium text-muted-foreground">Event Type</th>
                    <th className="pb-2 pr-3 font-medium text-muted-foreground">Status</th>
                    <th className="pb-2 pr-3 font-medium text-muted-foreground">Delivery</th>
                    <th className="pb-2 pr-3 font-medium text-muted-foreground">Recipient</th>
                    <th className="pb-2 pr-3 font-medium text-muted-foreground">Provider</th>
                    <th className="pb-2 pr-3 font-medium text-muted-foreground">Title</th>
                    <th className="pb-2 font-medium text-muted-foreground">Time</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map((log: any) => (
                    <tr key={log.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                      <td className="py-2.5 pr-3">
                        <div className="flex items-center gap-1.5">
                          {channelIcon(log.channel)}
                          <span className="capitalize text-xs">{log.channel}</span>
                        </div>
                      </td>
                      <td className="py-2.5 pr-3">
                        <span className="text-xs font-mono bg-muted px-1.5 py-0.5 rounded">
                          {log.eventType?.replace(/_/g, " ") || "—"}
                        </span>
                      </td>
                      <td className="py-2.5 pr-3">{statusBadge(log.status)}</td>
                      <td className="py-2.5 pr-3">{deliveryStatusBadge(log.deliveryStatus)}</td>
                      <td className="py-2.5 pr-3">
                        <span className="text-xs text-muted-foreground max-w-[180px] truncate block">
                          {log.recipient || "—"}
                        </span>
                      </td>
                      <td className="py-2.5 pr-3">
                        <span className="text-xs text-muted-foreground">{log.provider || "—"}</span>
                      </td>
                      <td className="py-2.5 pr-3">
                        <span className="text-xs max-w-[200px] truncate block">{log.title || "—"}</span>
                      </td>
                      <td className="py-2.5">
                        <span className="text-xs text-muted-foreground whitespace-nowrap">
                          {log.createdAt ? new Date(log.createdAt).toLocaleString() : "—"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
      {/* Webhook Configuration */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Webhook Configuration
          </CardTitle>
          <CardDescription>
            Configure delivery status webhooks to track email and SMS delivery in real-time.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* SendGrid */}
          <div className="space-y-2">
            <h3 className="text-sm font-medium flex items-center gap-2">
              <Mail className="h-4 w-4 text-blue-500" />
              SendGrid Event Webhook
            </h3>
            <p className="text-xs text-muted-foreground">
              In your SendGrid dashboard, go to Settings → Mail Settings → Event Webhook. Set the HTTP POST URL below and enable: Delivered, Bounced, Dropped, Deferred, Opened, Clicked, Spam Report.
            </p>
            <div className="flex items-center gap-2">
              <code className="flex-1 text-xs bg-muted px-3 py-2 rounded font-mono break-all">
                {window.location.origin}/api/webhooks/sendgrid/delivery-status
              </code>
              <Button
                variant="outline"
                size="icon"
                className="shrink-0"
                onClick={() => {
                  navigator.clipboard.writeText(`${window.location.origin}/api/webhooks/sendgrid/delivery-status`);
                  toast.success("SendGrid webhook URL copied");
                }}
              >
                <Copy className="h-4 w-4" />
              </Button>
            </div>
            <a
              href="https://app.sendgrid.com/settings/mail_settings"
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-primary hover:underline inline-flex items-center gap-1"
            >
              Open SendGrid Mail Settings <ExternalLink className="h-3 w-3" />
            </a>
          </div>

          <Separator />

          {/* Twilio */}
          <div className="space-y-2">
            <h3 className="text-sm font-medium flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-red-500" />
              Twilio SMS Status Callback
            </h3>
            <p className="text-xs text-muted-foreground">
              Twilio StatusCallback is automatically configured when sending SMS. The callback URL below is injected into every outbound SMS request.
            </p>
            <div className="flex items-center gap-2">
              <code className="flex-1 text-xs bg-muted px-3 py-2 rounded font-mono break-all">
                {window.location.origin}/api/webhooks/twilio/delivery-status
              </code>
              <Button
                variant="outline"
                size="icon"
                className="shrink-0"
                onClick={() => {
                  navigator.clipboard.writeText(`${window.location.origin}/api/webhooks/twilio/delivery-status`);
                  toast.success("Twilio webhook URL copied");
                }}
              >
                <Copy className="h-4 w-4" />
              </Button>
            </div>
            <div className="flex items-center gap-1.5">
              <CheckCircle className="h-3.5 w-3.5 text-emerald-500" />
              <span className="text-xs text-emerald-600">Auto-configured — no manual setup required</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
