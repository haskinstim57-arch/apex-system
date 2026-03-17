import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
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
import { Checkbox } from "@/components/ui/checkbox";
import {
  ChevronLeft,
  ChevronRight,
  Filter,
  Loader2,
  Mic,
  Phone,
  PhoneCall,
  PhoneForwarded,
  PhoneMissed,
  PhoneOff,
  Play,
  RefreshCw,
  Search,
  Trash2,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Users,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useAccount } from "@/contexts/AccountContext";
import { NoAccountSelected } from "@/components/NoAccountSelected";
import { toast } from "sonner";

const STATUS_CONFIG: Record<
  string,
  { label: string; color: string; icon: any }
> = {
  queued: {
    label: "Queued",
    color: "bg-blue-500/15 text-blue-400 border-blue-500/30",
    icon: Clock,
  },
  calling: {
    label: "Calling",
    color: "bg-amber-500/15 text-amber-400 border-amber-500/30",
    icon: PhoneCall,
  },
  completed: {
    label: "Completed",
    color: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
    icon: CheckCircle2,
  },
  failed: {
    label: "Failed",
    color: "bg-red-500/15 text-red-400 border-red-500/30",
    icon: XCircle,
  },
  no_answer: {
    label: "No Answer",
    color: "bg-orange-500/15 text-orange-400 border-orange-500/30",
    icon: PhoneMissed,
  },
  busy: {
    label: "Busy",
    color: "bg-purple-500/15 text-purple-400 border-purple-500/30",
    icon: PhoneOff,
  },
  cancelled: {
    label: "Cancelled",
    color: "bg-zinc-500/15 text-zinc-400 border-zinc-500/30",
    icon: AlertCircle,
  },
};

export default function AICalls() {
  const { user } = useAuth();
  const utils = trpc.useUtils();
  const { currentAccountId: accountId, isLoading: accountsLoading } = useAccount();

  // Filters
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [page, setPage] = useState(1);
  const pageSize = 20;

  // AI Calls query
  const { data: callsData, isLoading: callsLoading } =
    trpc.aiCalls.list.useQuery(
      {
        accountId: accountId!,
        page,
        limit: pageSize,
        status: statusFilter || undefined,
        search: search || undefined,
      },
      { enabled: !!accountId }
    );

  // Stats
  const { data: stats } = trpc.aiCalls.stats.useQuery(
    { accountId: accountId! },
    { enabled: !!accountId }
  );

  // Contacts for the "Start Call" dialog
  const { data: contactsData } = trpc.contacts.list.useQuery(
    { accountId: accountId!, limit: 100 },
    { enabled: !!accountId }
  );

  // Mutations
  const startCallMutation = trpc.aiCalls.start.useMutation({
    onSuccess: () => {
      toast.success("AI call initiated successfully");
      utils.aiCalls.list.invalidate();
      utils.aiCalls.stats.invalidate();
      setStartCallOpen(false);
      setSelectedContact(null);
    },
    onError: (err) => toast.error(err.message),
  });

  const bulkCallMutation = trpc.aiCalls.bulkStart.useMutation({
    onSuccess: (result) => {
      toast.success(
        `Bulk calls initiated: ${result.successCount} started, ${result.failCount} failed`
      );
      utils.aiCalls.list.invalidate();
      utils.aiCalls.stats.invalidate();
      setBulkCallOpen(false);
      setSelectedContactIds([]);
      setBulkSearch("");
    },
    onError: (err) => toast.error(err.message),
  });

  const deleteCallMutation = trpc.aiCalls.delete.useMutation({
    onSuccess: () => {
      toast.success("Call record deleted");
      utils.aiCalls.list.invalidate();
      utils.aiCalls.stats.invalidate();
      setDeleteConfirm(null);
    },
    onError: (err) => toast.error(err.message),
  });

  const syncStatusMutation = trpc.aiCalls.syncStatus.useMutation({
    onSuccess: (result) => {
      if (result.success) {
        toast.success(
          `Call synced: ${result.status}${
            result.hasTranscript ? " (transcript available)" : ""
          }${result.hasRecording ? " (recording available)" : ""}`
        );
        utils.aiCalls.list.invalidate();
        utils.aiCalls.stats.invalidate();
        // Refresh the detail dialog data
        if (callDetailOpen) {
          utils.aiCalls.get.invalidate({ id: callDetailOpen.id, accountId: accountId! });
        }
      } else {
        toast.error(result.error || "Failed to sync call status");
      }
    },
    onError: (err) => toast.error(err.message),
  });

  // Dialogs
  const [startCallOpen, setStartCallOpen] = useState(false);
  const [bulkCallOpen, setBulkCallOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<any>(null);
  const [callDetailOpen, setCallDetailOpen] = useState<any>(null);
  const [selectedContact, setSelectedContact] = useState<number | null>(null);
  const [selectedContactIds, setSelectedContactIds] = useState<number[]>([]);
  const [bulkSearch, setBulkSearch] = useState("");
  const [contactSearch, setContactSearch] = useState("");

  const contacts = contactsData?.data ?? [];
  const calls = callsData?.data ?? [];
  const totalCalls = callsData?.total ?? 0;
  const totalPages = Math.ceil(totalCalls / pageSize);

  // Auto-refresh calls that are in active state (queued/calling)
  useEffect(() => {
    const hasActiveCalls = calls.some(
      (c: any) => c.status === "queued" || c.status === "calling"
    );
    if (!hasActiveCalls || !accountId) return;

    const interval = setInterval(() => {
      utils.aiCalls.list.invalidate();
      utils.aiCalls.stats.invalidate();
    }, 10000); // Poll every 10 seconds

    return () => clearInterval(interval);
  }, [calls, accountId, utils]);

  // Filter contacts for bulk call dialog
  const filteredBulkContacts = useMemo(() => {
    if (!bulkSearch) return contacts.filter((c: any) => c.phone);
    const q = bulkSearch.toLowerCase();
    return contacts.filter(
      (c: any) =>
        c.phone &&
        (`${c.firstName} ${c.lastName}`.toLowerCase().includes(q) ||
          c.phone?.includes(q) ||
          c.email?.toLowerCase().includes(q))
    );
  }, [contacts, bulkSearch]);

  // Filter contacts for start call dialog
  const filteredContacts = useMemo(() => {
    if (!contactSearch) return contacts.filter((c: any) => c.phone);
    const q = contactSearch.toLowerCase();
    return contacts.filter(
      (c: any) =>
        c.phone &&
        (`${c.firstName} ${c.lastName}`.toLowerCase().includes(q) ||
          c.phone?.includes(q))
    );
  }, [contacts, contactSearch]);

  const formatDuration = (seconds: number) => {
    if (!seconds) return "--";
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  const formatDate = (d: any) => {
    if (!d) return "--";
    return new Date(d).toLocaleString();
  };

  if (!accountId) {
    return <NoAccountSelected />;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">AI Calls</h1>
          <p className="text-sm text-muted-foreground">
            {totalCalls} call{totalCalls !== 1 ? "s" : ""} in this account
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Account selector removed — use sidebar AccountSwitcher */}
          <Button
            variant="outline"
            onClick={() => setBulkCallOpen(true)}
            className="gap-2"
          >
            <Users className="h-4 w-4" />
            Bulk Call
          </Button>
          <Button
            onClick={() => setStartCallOpen(true)}
            className="gap-2 bg-primary text-primary-foreground hover:bg-primary/90"
          >
            <PhoneForwarded className="h-4 w-4" />
            Start AI Call
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
          <Card className="bg-card/50 border-border/50">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10">
                  <Phone className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.total}</p>
                  <p className="text-xs text-muted-foreground">Total Calls</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-card/50 border-border/50">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-emerald-500/10">
                  <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.completed}</p>
                  <p className="text-xs text-muted-foreground">Completed</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-card/50 border-border/50">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-amber-500/10">
                  <PhoneCall className="h-4 w-4 text-amber-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.calling + stats.queued}</p>
                  <p className="text-xs text-muted-foreground">In Progress</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-card/50 border-border/50">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-red-500/10">
                  <XCircle className="h-4 w-4 text-red-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{(stats.failed ?? 0) + (stats.noAnswer ?? 0) + (stats.busy ?? 0)}</p>
                  <p className="text-xs text-muted-foreground">Failed / Missed</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-card/50 border-border/50">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-blue-500/10">
                  <Clock className="h-4 w-4 text-blue-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold">
                    {formatDuration(stats.avgDuration ?? 0)}
                  </p>
                  <p className="text-xs text-muted-foreground">Avg Duration</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Search and Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search calls..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="pl-10"
          />
        </div>
        <Select
          value={statusFilter}
          onValueChange={(v) => {
            setStatusFilter(v === "all" ? "" : v);
            setPage(1);
          }}
        >
          <SelectTrigger className="w-[180px]">
            <Filter className="h-4 w-4 mr-2" />
            <SelectValue placeholder="All Statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            {Object.entries(STATUS_CONFIG).map(([key, cfg]) => (
              <SelectItem key={key} value={key}>
                {cfg.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Call History Table */}
      <Card className="bg-card/50 border-border/50">
        <Table>
          <TableHeader>
            <TableRow className="border-border/50 hover:bg-transparent">
              <TableHead>Contact</TableHead>
              <TableHead>Phone</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Duration</TableHead>
              <TableHead>Started</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {callsLoading ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-12">
                  <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
                </TableCell>
              </TableRow>
            ) : calls.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={6}
                  className="text-center py-12 text-muted-foreground"
                >
                  <Phone className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>No calls yet. Start an AI call to get going.</p>
                </TableCell>
              </TableRow>
            ) : (
              calls.map((call: any) => {
                const statusCfg = STATUS_CONFIG[call.status] || STATUS_CONFIG.queued;
                const StatusIcon = statusCfg.icon;
                // Find contact name from contacts list
                const contact = contacts.find((c: any) => c.id === call.contactId);
                const contactName = contact
                  ? `${contact.firstName} ${contact.lastName}`
                  : `Contact #${call.contactId}`;

                return (
                  <TableRow
                    key={call.id}
                    className="border-border/50 cursor-pointer hover:bg-muted/30"
                    onClick={() => setCallDetailOpen(call)}
                  >
                    <TableCell className="font-medium">{contactName}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {call.phoneNumber}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={`${statusCfg.color} gap-1`}
                      >
                        <StatusIcon className="h-3 w-3" />
                        {statusCfg.label}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatDuration(call.durationSeconds)}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {formatDate(call.startedAt || call.createdAt)}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-red-400"
                        onClick={(e) => {
                          e.stopPropagation();
                          setDeleteConfirm(call);
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </Card>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Page {page} of {totalPages} ({totalCalls} total)
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* ── START AI CALL DIALOG ── */}
      <Dialog open={startCallOpen} onOpenChange={setStartCallOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <PhoneForwarded className="h-5 w-5 text-primary" />
              Start AI Call
            </DialogTitle>
            <DialogDescription>
              Select a contact to call with the AI voice agent.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search contacts..."
                value={contactSearch}
                onChange={(e) => setContactSearch(e.target.value)}
                className="pl-10"
              />
            </div>
            <div className="max-h-[300px] overflow-y-auto space-y-1 border rounded-lg p-2 border-border/50">
              {filteredContacts.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No contacts with phone numbers found.
                </p>
              ) : (
                filteredContacts.map((contact: any) => (
                  <div
                    key={contact.id}
                    className={`flex items-center justify-between p-3 rounded-lg cursor-pointer transition-colors ${
                      selectedContact === contact.id
                        ? "bg-primary/10 border border-primary/30"
                        : "hover:bg-muted/30"
                    }`}
                    onClick={() => setSelectedContact(contact.id)}
                  >
                    <div>
                      <p className="font-medium text-sm">
                        {contact.firstName} {contact.lastName}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {contact.phone}
                      </p>
                    </div>
                    {selectedContact === contact.id && (
                      <CheckCircle2 className="h-4 w-4 text-primary" />
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setStartCallOpen(false);
                setSelectedContact(null);
                setContactSearch("");
              }}
            >
              Cancel
            </Button>
            <Button
              disabled={!selectedContact || startCallMutation.isPending}
              onClick={() => {
                if (selectedContact && accountId) {
                  startCallMutation.mutate({
                    accountId,
                    contactId: selectedContact,
                  });
                }
              }}
              className="gap-2"
            >
              {startCallMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Phone className="h-4 w-4" />
              )}
              Start Call
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── BULK AI CALL DIALOG ── */}
      <Dialog open={bulkCallOpen} onOpenChange={setBulkCallOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users className="h-5 w-5 text-primary" />
              Bulk AI Calls
            </DialogTitle>
            <DialogDescription>
              Select multiple contacts to call with the AI voice agent.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search contacts..."
                value={bulkSearch}
                onChange={(e) => setBulkSearch(e.target.value)}
                className="pl-10"
              />
            </div>

            {/* Select All */}
            <div className="flex items-center justify-between px-2">
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <Checkbox
                  checked={
                    filteredBulkContacts.length > 0 &&
                    filteredBulkContacts.every((c: any) =>
                      selectedContactIds.includes(c.id)
                    )
                  }
                  onCheckedChange={(checked) => {
                    if (checked) {
                      setSelectedContactIds(
                        filteredBulkContacts.map((c: any) => c.id)
                      );
                    } else {
                      setSelectedContactIds([]);
                    }
                  }}
                />
                Select All ({filteredBulkContacts.length})
              </label>
              <Badge variant="outline" className="text-xs">
                {selectedContactIds.length} selected
              </Badge>
            </div>

            <div className="max-h-[300px] overflow-y-auto space-y-1 border rounded-lg p-2 border-border/50">
              {filteredBulkContacts.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No contacts with phone numbers found.
                </p>
              ) : (
                filteredBulkContacts.map((contact: any) => (
                  <label
                    key={contact.id}
                    className="flex items-center gap-3 p-3 rounded-lg cursor-pointer hover:bg-muted/30 transition-colors"
                  >
                    <Checkbox
                      checked={selectedContactIds.includes(contact.id)}
                      onCheckedChange={(checked) => {
                        setSelectedContactIds((prev) =>
                          checked
                            ? [...prev, contact.id]
                            : prev.filter((id) => id !== contact.id)
                        );
                      }}
                    />
                    <div className="flex-1">
                      <p className="font-medium text-sm">
                        {contact.firstName} {contact.lastName}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {contact.phone}
                      </p>
                    </div>
                  </label>
                ))
              )}
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setBulkCallOpen(false);
                setSelectedContactIds([]);
                setBulkSearch("");
              }}
            >
              Cancel
            </Button>
            <Button
              disabled={
                selectedContactIds.length === 0 || bulkCallMutation.isPending
              }
              onClick={() => {
                if (accountId && selectedContactIds.length > 0) {
                  bulkCallMutation.mutate({
                    accountId,
                    contactIds: selectedContactIds,
                  });
                }
              }}
              className="gap-2"
            >
              {bulkCallMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Phone className="h-4 w-4" />
              )}
              Call {selectedContactIds.length} Contact
              {selectedContactIds.length !== 1 ? "s" : ""}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── CALL DETAIL DIALOG ── */}
      <Dialog
        open={!!callDetailOpen}
        onOpenChange={() => setCallDetailOpen(null)}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Phone className="h-5 w-5 text-primary" />
              Call Details
            </DialogTitle>
          </DialogHeader>
          {callDetailOpen && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Contact</p>
                  <p className="font-medium text-sm">
                    {(() => {
                      const c = contacts.find(
                        (c: any) => c.id === callDetailOpen.contactId
                      );
                      return c
                        ? `${c.firstName} ${c.lastName}`
                        : `Contact #${callDetailOpen.contactId}`;
                    })()}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Phone</p>
                  <p className="font-medium text-sm">
                    {callDetailOpen.phoneNumber}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Status</p>
                  <Badge
                    variant="outline"
                    className={`${
                      STATUS_CONFIG[callDetailOpen.status]?.color || ""
                    } gap-1`}
                  >
                    {STATUS_CONFIG[callDetailOpen.status]?.label ||
                      callDetailOpen.status}
                  </Badge>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Duration</p>
                  <p className="font-medium text-sm">
                    {formatDuration(callDetailOpen.durationSeconds)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Started</p>
                  <p className="text-sm">
                    {formatDate(
                      callDetailOpen.startedAt || callDetailOpen.createdAt
                    )}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Ended</p>
                  <p className="text-sm">
                    {formatDate(callDetailOpen.endedAt)}
                  </p>
                </div>
                {callDetailOpen.sentiment && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">
                      Sentiment
                    </p>
                    <Badge
                      variant="outline"
                      className={
                        callDetailOpen.sentiment === "positive"
                          ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30"
                          : callDetailOpen.sentiment === "negative"
                          ? "bg-red-500/15 text-red-400 border-red-500/30"
                          : "bg-zinc-500/15 text-zinc-400 border-zinc-500/30"
                      }
                    >
                      {callDetailOpen.sentiment}
                    </Badge>
                  </div>
                )}
                {callDetailOpen.externalCallId && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">
                      Call ID
                    </p>
                    <p className="text-xs font-mono text-muted-foreground truncate">
                      {callDetailOpen.externalCallId}
                    </p>
                  </div>
                )}
              </div>

              {/* Transcript */}
              {callDetailOpen.transcript && (
                <div>
                  <p className="text-xs text-muted-foreground mb-2">
                    Transcript
                  </p>
                  <div className="bg-muted/30 rounded-lg p-3 text-sm max-h-[200px] overflow-y-auto">
                    {callDetailOpen.transcript}
                  </div>
                </div>
              )}

              {/* Summary */}
              {callDetailOpen.summary && (
                <div>
                  <p className="text-xs text-muted-foreground mb-2">Summary</p>
                  <div className="bg-muted/30 rounded-lg p-3 text-sm">
                    {callDetailOpen.summary}
                  </div>
                </div>
              )}

              {/* Recording */}
              {callDetailOpen.recordingUrl && (
                <div>
                  <p className="text-xs text-muted-foreground mb-2">
                    Recording
                  </p>
                  <Button variant="outline" size="sm" className="gap-2" asChild>
                    <a
                      href={callDetailOpen.recordingUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <Play className="h-3 w-3" />
                      Play Recording
                    </a>
                  </Button>
                </div>
              )}

              {/* Error */}
              {callDetailOpen.errorMessage && (
                <div>
                  <p className="text-xs text-muted-foreground mb-2">Error</p>
                  <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 text-sm text-red-400">
                    {callDetailOpen.errorMessage}
                  </div>
                </div>
              )}

              {/* Sync from VAPI button — shown when call has an external ID */}
              {callDetailOpen.externalCallId && (
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-2 w-full"
                    disabled={syncStatusMutation.isPending}
                    onClick={() => {
                      if (accountId) {
                        syncStatusMutation.mutate({
                          id: callDetailOpen.id,
                          accountId,
                        });
                      }
                    }}
                  >
                    {syncStatusMutation.isPending ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <RefreshCw className="h-3 w-3" />
                    )}
                    Sync from VAPI
                  </Button>
                </div>
              )}

              {/* No data yet notice */}
              {!callDetailOpen.transcript &&
                !callDetailOpen.recordingUrl &&
                !callDetailOpen.summary &&
                (callDetailOpen.status === "queued" || callDetailOpen.status === "calling") && (
                  <div className="bg-muted/20 border border-border/50 rounded-lg p-4 text-center">
                    <Mic className="h-5 w-5 mx-auto mb-2 text-muted-foreground animate-pulse" />
                    <p className="text-sm text-muted-foreground">
                      Call is in progress. Transcript, recording, and summary will appear once the call ends.
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Click "Sync from VAPI" to fetch the latest status.
                    </p>
                  </div>
                )}
            </div>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setCallDetailOpen(null)}
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── DELETE CONFIRMATION ── */}
      <Dialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete Call Record</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this call record? This action
              cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteConfirm(null)}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={deleteCallMutation.isPending}
              onClick={() => {
                if (deleteConfirm && accountId) {
                  deleteCallMutation.mutate({
                    id: deleteConfirm.id,
                    accountId,
                  });
                }
              }}
            >
              {deleteCallMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                "Delete"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
