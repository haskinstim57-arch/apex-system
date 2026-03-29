import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { useAccount } from "@/contexts/AccountContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import {
  ShieldCheck,
  PhoneOff,
  PhoneCall,
  MessageSquareOff,
  Download,
  Plus,
  Search,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  HelpCircle,
  ChevronLeft,
  ChevronRight,
  Ban,
  Bell,
  BarChart3,
  ScrollText,
} from "lucide-react";

export default function SmsCompliance() {
  const { currentAccountId: accountId } = useAccount();

  const [activeTab, setActiveTab] = useState("dashboard");
  const [optOutPage, setOptOutPage] = useState(1);
  const [optOutSearch, setOptOutSearch] = useState("");
  const [optOutFilter, setOptOutFilter] = useState<string>("all");
  const [logPage, setLogPage] = useState(1);
  const [logSearch, setLogSearch] = useState("");
  const [logEventType, setLogEventType] = useState<string>("all");
  const [periodDays, setPeriodDays] = useState(30);

  // Dialogs
  const [showAddOptOut, setShowAddOptOut] = useState(false);
  const [addPhone, setAddPhone] = useState("");
  const [addReason, setAddReason] = useState("");
  const [showOptInDialog, setShowOptInDialog] = useState(false);
  const [optInPhone, setOptInPhone] = useState("");
  const [optInId, setOptInId] = useState<number | null>(null);

  // Queries
  const statsQ = trpc.smsCompliance.stats.useQuery(
    { accountId: accountId!, periodDays },
    { enabled: !!accountId }
  );

  const optOutsQ = trpc.smsCompliance.listOptOuts.useQuery(
    {
      accountId: accountId!,
      page: optOutPage,
      limit: 20,
      search: optOutSearch || undefined,
      isActive: optOutFilter === "active" ? true : optOutFilter === "inactive" ? false : undefined,
    },
    { enabled: !!accountId }
  );

  const logsQ = trpc.smsCompliance.auditLog.useQuery(
    {
      accountId: accountId!,
      page: logPage,
      limit: 20,
      search: logSearch || undefined,
      eventType: logEventType !== "all" ? logEventType : undefined,
    },
    { enabled: !!accountId }
  );

  const eventTypesQ = trpc.smsCompliance.eventTypes.useQuery(undefined, { enabled: !!accountId });

  // Mutations
  const manualOptOut = trpc.smsCompliance.manualOptOut.useMutation({
    onSuccess: () => {
      toast.success("Phone added to opt-out list");
      setShowAddOptOut(false);
      setAddPhone("");
      setAddReason("");
      optOutsQ.refetch();
      statsQ.refetch();
    },
    onError: (err) => toast.error(err.message),
  });

  const manualOptIn = trpc.smsCompliance.manualOptIn.useMutation({
    onSuccess: () => {
      toast.success("Phone removed from opt-out list");
      setShowOptInDialog(false);
      setOptInPhone("");
      setOptInId(null);
      optOutsQ.refetch();
      statsQ.refetch();
    },
    onError: (err) => toast.error(err.message),
  });

  const exportOptOuts = trpc.smsCompliance.exportOptOuts.useMutation({
    onSuccess: (data) => {
      const blob = new Blob([data.csv], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `sms-opt-outs-${new Date().toISOString().split("T")[0]}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(`Exported ${data.count} records`);
    },
    onError: (err) => toast.error(err.message),
  });

  const stats = statsQ.data;

  const complianceRate = useMemo(() => {
    if (!stats) return 0;
    const totalEvents = stats.events.optOuts + stats.events.optIns + stats.events.helpRequests;
    const handled = stats.events.autoRepliesSent;
    return totalEvents > 0 ? Math.round((handled / totalEvents) * 100) : 100;
  }, [stats]);

  if (!accountId) {
    return (
      <div className="p-6 text-center text-muted-foreground">
        Please select a sub-account to manage SMS compliance.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <ShieldCheck className="h-6 w-6 text-emerald-500" />
            SMS Compliance
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            TCPA/CTIA compliant opt-out management, DND enforcement, and compliance reporting
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={String(periodDays)} onValueChange={(v) => setPeriodDays(Number(v))}>
            <SelectTrigger className="w-[130px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7">Last 7 days</SelectItem>
              <SelectItem value="30">Last 30 days</SelectItem>
              <SelectItem value="90">Last 90 days</SelectItem>
              <SelectItem value="365">Last year</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="dashboard" className="flex items-center gap-1.5">
            <BarChart3 className="h-4 w-4" />
            Dashboard
          </TabsTrigger>
          <TabsTrigger value="optouts" className="flex items-center gap-1.5">
            <PhoneOff className="h-4 w-4" />
            Opt-Out List
            {stats && stats.activeOptOuts > 0 && (
              <Badge variant="secondary" className="ml-1 text-xs">{stats.activeOptOuts}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="audit" className="flex items-center gap-1.5">
            <ScrollText className="h-4 w-4" />
            Audit Log
          </TabsTrigger>
        </TabsList>

        {/* ═══════════════ DASHBOARD TAB ═══════════════ */}
        <TabsContent value="dashboard" className="space-y-4 mt-4">
          {/* KPI Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="pt-4 pb-3 px-4">
                <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                  <PhoneOff className="h-4 w-4 text-red-500" />
                  Active Opt-Outs
                </div>
                <div className="text-2xl font-bold">{stats?.activeOptOuts ?? "—"}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  of {stats?.totalOptOuts ?? 0} total
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-4 pb-3 px-4">
                <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                  <MessageSquareOff className="h-4 w-4 text-amber-500" />
                  Messages Blocked
                </div>
                <div className="text-2xl font-bold">{stats?.events.messagesBlocked ?? "—"}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  in last {periodDays} days
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-4 pb-3 px-4">
                <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                  <Bell className="h-4 w-4 text-blue-500" />
                  Auto-Replies Sent
                </div>
                <div className="text-2xl font-bold">{stats?.events.autoRepliesSent ?? "—"}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  STOP/START/HELP responses
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-4 pb-3 px-4">
                <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                  <ShieldCheck className="h-4 w-4 text-emerald-500" />
                  Compliance Rate
                </div>
                <div className="text-2xl font-bold">{complianceRate}%</div>
                <p className="text-xs text-muted-foreground mt-1">
                  keywords auto-handled
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Event Breakdown */}
          <div className="grid md:grid-cols-2 gap-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Compliance Events ({periodDays}d)</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {[
                    { label: "Opt-Outs (STOP)", value: stats?.events.optOuts, icon: XCircle, color: "text-red-500" },
                    { label: "Opt-Ins (START)", value: stats?.events.optIns, icon: CheckCircle2, color: "text-emerald-500" },
                    { label: "HELP Requests", value: stats?.events.helpRequests, icon: HelpCircle, color: "text-blue-500" },
                    { label: "Manual Opt-Outs", value: stats?.events.manualOptOuts, icon: Ban, color: "text-orange-500" },
                    { label: "Manual Opt-Ins", value: stats?.events.manualOptIns, icon: PhoneCall, color: "text-teal-500" },
                    { label: "DND Set", value: stats?.events.dndSet, icon: AlertTriangle, color: "text-amber-500" },
                    { label: "DND Cleared", value: stats?.events.dndCleared, icon: CheckCircle2, color: "text-green-500" },
                  ].map((item) => (
                    <div key={item.label} className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-sm">
                        <item.icon className={`h-4 w-4 ${item.color}`} />
                        {item.label}
                      </div>
                      <span className="font-medium tabular-nums">{item.value ?? 0}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">DND Status Overview</CardTitle>
                <CardDescription>Contacts with Do Not Disturb enabled</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span>SMS Blocked</span>
                      <span className="font-medium">{stats?.dnd.smsBlocked ?? 0} contacts</span>
                    </div>
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full bg-red-500 rounded-full transition-all"
                        style={{
                          width: `${stats && stats.dnd.totalContacts > 0 ? (stats.dnd.smsBlocked / stats.dnd.totalContacts) * 100 : 0}%`,
                        }}
                      />
                    </div>
                  </div>
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span>Email Blocked</span>
                      <span className="font-medium">{stats?.dnd.emailBlocked ?? 0} contacts</span>
                    </div>
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full bg-amber-500 rounded-full transition-all"
                        style={{
                          width: `${stats && stats.dnd.totalContacts > 0 ? (stats.dnd.emailBlocked / stats.dnd.totalContacts) * 100 : 0}%`,
                        }}
                      />
                    </div>
                  </div>
                  <div className="pt-2 border-t">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Total Contacts</span>
                      <span className="font-medium">{stats?.dnd.totalContacts ?? 0}</span>
                    </div>
                  </div>
                </div>

                <div className="mt-6 p-3 bg-muted/50 rounded-lg">
                  <h4 className="text-sm font-medium mb-2">TCPA Compliance Keywords</h4>
                  <div className="space-y-1.5 text-xs text-muted-foreground">
                    <div className="flex gap-2">
                      <Badge variant="destructive" className="text-[10px] px-1.5">STOP</Badge>
                      <span>STOP, STOPALL, UNSUBSCRIBE, CANCEL, END, QUIT</span>
                    </div>
                    <div className="flex gap-2">
                      <Badge className="text-[10px] px-1.5 bg-emerald-600">START</Badge>
                      <span>START, UNSTOP, SUBSCRIBE, YES</span>
                    </div>
                    <div className="flex gap-2">
                      <Badge variant="secondary" className="text-[10px] px-1.5">HELP</Badge>
                      <span>HELP, INFO</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ═══════════════ OPT-OUT LIST TAB ═══════════════ */}
        <TabsContent value="optouts" className="space-y-4 mt-4">
          {/* Controls */}
          <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
            <div className="flex gap-2 flex-1">
              <div className="relative flex-1 max-w-sm">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by phone..."
                  value={optOutSearch}
                  onChange={(e) => { setOptOutSearch(e.target.value); setOptOutPage(1); }}
                  className="pl-9"
                />
              </div>
              <Select value={optOutFilter} onValueChange={(v) => { setOptOutFilter(v); setOptOutPage(1); }}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Records</SelectItem>
                  <SelectItem value="active">Opted Out</SelectItem>
                  <SelectItem value="inactive">Opted In</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => exportOptOuts.mutate({ accountId: accountId! })}
                disabled={exportOptOuts.isPending}
              >
                <Download className="h-4 w-4 mr-1" />
                Export CSV
              </Button>
              <Button size="sm" onClick={() => setShowAddOptOut(true)}>
                <Plus className="h-4 w-4 mr-1" />
                Add Opt-Out
              </Button>
            </div>
          </div>

          {/* Opt-Out Table */}
          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="text-left p-3 font-medium">Phone</th>
                      <th className="text-left p-3 font-medium">Contact</th>
                      <th className="text-left p-3 font-medium">Keyword</th>
                      <th className="text-left p-3 font-medium">Source</th>
                      <th className="text-left p-3 font-medium">Status</th>
                      <th className="text-left p-3 font-medium">Date</th>
                      <th className="text-right p-3 font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {optOutsQ.isLoading ? (
                      <tr>
                        <td colSpan={7} className="p-8 text-center text-muted-foreground">Loading...</td>
                      </tr>
                    ) : !optOutsQ.data?.optOuts.length ? (
                      <tr>
                        <td colSpan={7} className="p-8 text-center text-muted-foreground">
                          <ShieldCheck className="h-8 w-8 mx-auto mb-2 opacity-40" />
                          No opt-out records found
                        </td>
                      </tr>
                    ) : (
                      optOutsQ.data.optOuts.map((row) => (
                        <tr key={row.id} className="border-b hover:bg-muted/30">
                          <td className="p-3 font-mono text-xs">{row.phone}</td>
                          <td className="p-3">{row.contactName || <span className="text-muted-foreground">—</span>}</td>
                          <td className="p-3">
                            <Badge variant="outline" className="text-xs">{row.keyword}</Badge>
                          </td>
                          <td className="p-3 text-muted-foreground capitalize">{row.source.replace("_", " ")}</td>
                          <td className="p-3">
                            {row.isActive ? (
                              <Badge variant="destructive" className="text-xs">Opted Out</Badge>
                            ) : (
                              <Badge className="text-xs bg-emerald-600">Opted In</Badge>
                            )}
                          </td>
                          <td className="p-3 text-muted-foreground text-xs">
                            {new Date(row.createdAt).toLocaleDateString()}
                          </td>
                          <td className="p-3 text-right">
                            {row.isActive ? (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-xs"
                                onClick={() => {
                                  setOptInPhone(row.phone);
                                  setOptInId(row.contactId || null);
                                  setShowOptInDialog(true);
                                }}
                              >
                                Re-subscribe
                              </Button>
                            ) : (
                              <span className="text-xs text-muted-foreground">
                                {row.optedInAt ? `Opted in ${new Date(row.optedInAt).toLocaleDateString()}` : "—"}
                              </span>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {optOutsQ.data && optOutsQ.data.totalPages > 1 && (
                <div className="flex items-center justify-between px-4 py-3 border-t">
                  <span className="text-xs text-muted-foreground">
                    Page {optOutsQ.data.page} of {optOutsQ.data.totalPages} ({optOutsQ.data.total} records)
                  </span>
                  <div className="flex gap-1">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={optOutPage <= 1}
                      onClick={() => setOptOutPage((p) => p - 1)}
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={optOutPage >= (optOutsQ.data?.totalPages ?? 1)}
                      onClick={() => setOptOutPage((p) => p + 1)}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ═══════════════ AUDIT LOG TAB ═══════════════ */}
        <TabsContent value="audit" className="space-y-4 mt-4">
          {/* Controls */}
          <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by phone or description..."
                value={logSearch}
                onChange={(e) => { setLogSearch(e.target.value); setLogPage(1); }}
                className="pl-9"
              />
            </div>
            <Select value={logEventType} onValueChange={(v) => { setLogEventType(v); setLogPage(1); }}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="All Events" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Events</SelectItem>
                {eventTypesQ.data?.map((et) => (
                  <SelectItem key={et.value} value={et.value}>{et.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Audit Log Table */}
          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="text-left p-3 font-medium">Time</th>
                      <th className="text-left p-3 font-medium">Event</th>
                      <th className="text-left p-3 font-medium">Phone</th>
                      <th className="text-left p-3 font-medium">Description</th>
                    </tr>
                  </thead>
                  <tbody>
                    {logsQ.isLoading ? (
                      <tr>
                        <td colSpan={4} className="p-8 text-center text-muted-foreground">Loading...</td>
                      </tr>
                    ) : !logsQ.data?.logs.length ? (
                      <tr>
                        <td colSpan={4} className="p-8 text-center text-muted-foreground">
                          <ScrollText className="h-8 w-8 mx-auto mb-2 opacity-40" />
                          No compliance events found
                        </td>
                      </tr>
                    ) : (
                      logsQ.data.logs.map((log) => (
                        <tr key={log.id} className="border-b hover:bg-muted/30">
                          <td className="p-3 text-xs text-muted-foreground whitespace-nowrap">
                            {new Date(log.createdAt).toLocaleString()}
                          </td>
                          <td className="p-3">
                            <EventBadge type={log.eventType} />
                          </td>
                          <td className="p-3 font-mono text-xs">{log.phone}</td>
                          <td className="p-3 text-muted-foreground text-xs max-w-md truncate">
                            {log.description || "—"}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {logsQ.data && logsQ.data.totalPages > 1 && (
                <div className="flex items-center justify-between px-4 py-3 border-t">
                  <span className="text-xs text-muted-foreground">
                    Page {logsQ.data.page} of {logsQ.data.totalPages} ({logsQ.data.total} events)
                  </span>
                  <div className="flex gap-1">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={logPage <= 1}
                      onClick={() => setLogPage((p) => p - 1)}
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={logPage >= (logsQ.data?.totalPages ?? 1)}
                      onClick={() => setLogPage((p) => p + 1)}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* ═══════════════ ADD OPT-OUT DIALOG ═══════════════ */}
      <Dialog open={showAddOptOut} onOpenChange={setShowAddOptOut}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Manually Add to Opt-Out List</DialogTitle>
            <DialogDescription>
              Add a phone number to the SMS opt-out list. This will set DND status if a matching contact is found.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Phone Number (E.164 format)</Label>
              <Input
                placeholder="+15551234567"
                value={addPhone}
                onChange={(e) => setAddPhone(e.target.value)}
              />
            </div>
            <div>
              <Label>Reason (optional)</Label>
              <Input
                placeholder="Customer requested via email"
                value={addReason}
                onChange={(e) => setAddReason(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddOptOut(false)}>Cancel</Button>
            <Button
              variant="destructive"
              disabled={!addPhone.trim() || manualOptOut.isPending}
              onClick={() =>
                manualOptOut.mutate({
                  accountId: accountId!,
                  phone: addPhone.trim(),
                  reason: addReason || undefined,
                })
              }
            >
              {manualOptOut.isPending ? "Adding..." : "Add to Opt-Out List"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ═══════════════ RE-SUBSCRIBE DIALOG ═══════════════ */}
      <Dialog open={showOptInDialog} onOpenChange={setShowOptInDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Re-subscribe Phone Number</DialogTitle>
            <DialogDescription>
              Remove <span className="font-mono">{optInPhone}</span> from the opt-out list and clear DND status. Only do this if the contact has explicitly requested to re-subscribe.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowOptInDialog(false)}>Cancel</Button>
            <Button
              disabled={manualOptIn.isPending}
              onClick={() =>
                manualOptIn.mutate({
                  accountId: accountId!,
                  phone: optInPhone,
                  contactId: optInId || undefined,
                })
              }
            >
              {manualOptIn.isPending ? "Processing..." : "Confirm Re-subscribe"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Event Badge Component ───
function EventBadge({ type }: { type: string }) {
  const config: Record<string, { label: string; variant: "destructive" | "default" | "secondary" | "outline" }> = {
    opt_out: { label: "Opt-Out", variant: "destructive" },
    opt_in: { label: "Opt-In", variant: "default" },
    help_request: { label: "HELP", variant: "secondary" },
    dnd_set: { label: "DND Set", variant: "destructive" },
    dnd_cleared: { label: "DND Cleared", variant: "default" },
    message_blocked: { label: "Blocked", variant: "destructive" },
    auto_reply_sent: { label: "Auto-Reply", variant: "secondary" },
    manual_opt_out: { label: "Manual Opt-Out", variant: "outline" },
    manual_opt_in: { label: "Manual Opt-In", variant: "outline" },
  };

  const c = config[type] || { label: type, variant: "outline" as const };
  return <Badge variant={c.variant} className="text-xs">{c.label}</Badge>;
}
