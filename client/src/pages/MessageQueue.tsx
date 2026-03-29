import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { useAccount } from "@/contexts/AccountContext";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import {
  Clock,
  Mail,
  Phone,
  PhoneCall,
  RefreshCw,
  Trash2,
  XCircle,
  CheckCircle2,
  AlertTriangle,
  Ban,
  RotateCcw,
} from "lucide-react";

// ─────────────────────────────────────────────
// Status badge helper
// ─────────────────────────────────────────────
function StatusBadge({ status }: { status: string }) {
  switch (status) {
    case "pending":
      return (
        <Badge variant="outline" className="bg-amber-500/10 text-amber-600 border-amber-500/30">
          <Clock className="h-3 w-3 mr-1" /> Pending
        </Badge>
      );
    case "dispatched":
      return (
        <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 border-emerald-500/30">
          <CheckCircle2 className="h-3 w-3 mr-1" /> Dispatched
        </Badge>
      );
    case "failed":
      return (
        <Badge variant="outline" className="bg-red-500/10 text-red-600 border-red-500/30">
          <AlertTriangle className="h-3 w-3 mr-1" /> Failed
        </Badge>
      );
    case "cancelled":
      return (
        <Badge variant="outline" className="bg-zinc-500/10 text-zinc-500 border-zinc-500/30">
          <Ban className="h-3 w-3 mr-1" /> Cancelled
        </Badge>
      );
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
}

// ─────────────────────────────────────────────
// Type icon helper
// ─────────────────────────────────────────────
function TypeIcon({ type }: { type: string }) {
  switch (type) {
    case "sms":
      return <Phone className="h-4 w-4 text-blue-500" />;
    case "email":
      return <Mail className="h-4 w-4 text-purple-500" />;
    case "ai_call":
      return <PhoneCall className="h-4 w-4 text-emerald-500" />;
    default:
      return <Clock className="h-4 w-4" />;
  }
}

// ─────────────────────────────────────────────
// Payload summary helper
// ─────────────────────────────────────────────
function getPayloadSummary(type: string, payloadStr: string): string {
  try {
    const payload = JSON.parse(payloadStr);
    switch (type) {
      case "sms":
        return `To: ${payload.to || "?"} — ${(payload.body || "").slice(0, 60)}${(payload.body || "").length > 60 ? "…" : ""}`;
      case "email":
        return `To: ${payload.to || "?"} — ${payload.subject || "(no subject)"}`;
      case "ai_call":
        return `${payload.customerName || "Unknown"} — ${payload.phoneNumber || "?"}`;
      default:
        return payloadStr.slice(0, 80);
    }
  } catch {
    return payloadStr.slice(0, 80);
  }
}

// ─────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────
export default function MessageQueue() {
  const { currentAccountId: selectedAccountId } = useAccount();
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [page, setPage] = useState(0);
  const LIMIT = 25;

  const utils = trpc.useUtils();

  // Fetch stats
  const statsQuery = trpc.messageQueue.stats.useQuery(
    { accountId: selectedAccountId! },
    { enabled: !!selectedAccountId }
  );

  // Fetch list
  const listQuery = trpc.messageQueue.list.useQuery(
    {
      accountId: selectedAccountId!,
      status: statusFilter === "all" ? undefined : (statusFilter as any),
      limit: LIMIT,
      offset: page * LIMIT,
    },
    { enabled: !!selectedAccountId, refetchInterval: 15_000 }
  );

  // Mutations
  const cancelMutation = trpc.messageQueue.cancel.useMutation({
    onSuccess: () => {
      toast.success("Message cancelled");
      utils.messageQueue.list.invalidate();
      utils.messageQueue.stats.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  const cancelAllMutation = trpc.messageQueue.cancelAll.useMutation({
    onSuccess: () => {
      toast.success("All pending messages cancelled");
      utils.messageQueue.list.invalidate();
      utils.messageQueue.stats.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  const retryMutation = trpc.messageQueue.retry.useMutation({
    onSuccess: () => {
      toast.success("Message re-queued for retry");
      utils.messageQueue.list.invalidate();
      utils.messageQueue.stats.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  const stats = statsQuery.data;
  const messages = listQuery.data?.data ?? [];
  const total = listQuery.data?.total ?? 0;
  const totalPages = Math.ceil(total / LIMIT);

  // Stable memoized values
  const hasMessages = useMemo(() => messages.length > 0, [messages.length]);

  if (!selectedAccountId) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            Select a sub-account to view the message queue.
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-6xl">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Message Queue</h1>
        <p className="text-muted-foreground mt-1">
          Messages held outside business hours are automatically dispatched when hours resume.
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-amber-500/10 flex items-center justify-center">
                <Clock className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {stats ? stats.pending : <Skeleton className="h-7 w-8 inline-block" />}
                </p>
                <p className="text-xs text-muted-foreground">Pending</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                <CheckCircle2 className="h-5 w-5 text-emerald-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {stats ? stats.dispatched : <Skeleton className="h-7 w-8 inline-block" />}
                </p>
                <p className="text-xs text-muted-foreground">Dispatched</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-red-500/10 flex items-center justify-center">
                <AlertTriangle className="h-5 w-5 text-red-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {stats ? stats.failed : <Skeleton className="h-7 w-8 inline-block" />}
                </p>
                <p className="text-xs text-muted-foreground">Failed</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-zinc-500/10 flex items-center justify-center">
                <Ban className="h-5 w-5 text-zinc-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {stats ? stats.cancelled : <Skeleton className="h-7 w-8 inline-block" />}
                </p>
                <p className="text-xs text-muted-foreground">Cancelled</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters & Actions */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <CardTitle className="text-lg">Queued Messages</CardTitle>
              <CardDescription>
                {total} message{total !== 1 ? "s" : ""} total
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(0); }}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="Filter status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="dispatched">Dispatched</SelectItem>
                  <SelectItem value="failed">Failed</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
              <Button
                variant="outline"
                size="icon"
                onClick={() => {
                  utils.messageQueue.list.invalidate();
                  utils.messageQueue.stats.invalidate();
                }}
              >
                <RefreshCw className="h-4 w-4" />
              </Button>
              {stats && stats.pending > 0 && (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="destructive" size="sm">
                      <XCircle className="h-4 w-4 mr-1" /> Cancel All Pending
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Cancel all pending messages?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This will cancel all {stats.pending} pending message{stats.pending !== 1 ? "s" : ""}. They will not be dispatched when business hours resume.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Keep Messages</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={() => cancelAllMutation.mutate({ accountId: selectedAccountId! })}
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      >
                        Cancel All
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {listQuery.isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : !hasMessages ? (
            <div className="py-12 text-center text-muted-foreground">
              <Clock className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p className="font-medium">No queued messages</p>
              <p className="text-sm mt-1">
                Messages sent outside business hours will appear here automatically.
              </p>
            </div>
          ) : (
            <>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[60px]">Type</TableHead>
                      <TableHead>Details</TableHead>
                      <TableHead className="w-[120px]">Status</TableHead>
                      <TableHead className="w-[100px]">Attempts</TableHead>
                      <TableHead className="w-[160px]">Created</TableHead>
                      <TableHead className="w-[100px] text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {messages.map((msg) => (
                      <TableRow key={msg.id}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <TypeIcon type={msg.type} />
                            <span className="text-xs font-medium uppercase">{msg.type.replace("_", " ")}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <p className="text-sm truncate max-w-[300px]">
                            {getPayloadSummary(msg.type, msg.payload)}
                          </p>
                          {msg.lastError && (
                            <p className="text-xs text-red-500 mt-0.5 truncate max-w-[300px]">
                              {msg.lastError}
                            </p>
                          )}
                        </TableCell>
                        <TableCell>
                          <StatusBadge status={msg.status} />
                        </TableCell>
                        <TableCell>
                          <span className="text-sm text-muted-foreground">
                            {msg.attempts}/{msg.maxAttempts}
                          </span>
                        </TableCell>
                        <TableCell>
                          <span className="text-sm text-muted-foreground">
                            {new Date(msg.createdAt).toLocaleString()}
                          </span>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            {msg.status === "pending" && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() =>
                                  cancelMutation.mutate({
                                    accountId: selectedAccountId!,
                                    messageId: msg.id,
                                  })
                                }
                                disabled={cancelMutation.isPending}
                                title="Cancel"
                              >
                                <Trash2 className="h-4 w-4 text-red-500" />
                              </Button>
                            )}
                            {msg.status === "failed" && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() =>
                                  retryMutation.mutate({
                                    accountId: selectedAccountId!,
                                    messageId: msg.id,
                                  })
                                }
                                disabled={retryMutation.isPending}
                                title="Retry"
                              >
                                <RotateCcw className="h-4 w-4 text-blue-500" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between mt-4">
                  <p className="text-sm text-muted-foreground">
                    Page {page + 1} of {totalPages}
                  </p>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage((p) => Math.max(0, p - 1))}
                      disabled={page === 0}
                    >
                      Previous
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                      disabled={page >= totalPages - 1}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
