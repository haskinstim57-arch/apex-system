import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Loader2,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  Eye,
  RotateCw,
  CheckCircle,
  XCircle,
  Clock,
} from "lucide-react";
import { toast } from "sonner";

interface WebhookDeliveryLogsProps {
  accountId: number;
  webhookId: number;
  webhookName: string;
  open: boolean;
  onClose: () => void;
}

export function WebhookDeliveryLogs({
  accountId,
  webhookId,
  webhookName,
  open,
  onClose,
}: WebhookDeliveryLogsProps) {
  const [page, setPage] = useState(1);
  const [filter, setFilter] = useState<string>("all");
  const [detailLog, setDetailLog] = useState<any>(null);

  const successFilter = filter === "success" ? true : filter === "failed" ? false : undefined;

  const logsQuery = trpc.webhooks.deliveryLogs.useQuery(
    { accountId, webhookId, page, limit: 15, successFilter },
    { enabled: open }
  );

  const retryMutation = trpc.webhooks.retryDelivery.useMutation({
    onSuccess: (result) => {
      if (result.success) {
        toast.success(`Retry successful! Status: ${result.statusCode}`);
      } else {
        toast.error(`Retry failed: ${result.error || `Status ${result.statusCode}`}`);
      }
      logsQuery.refetch();
    },
    onError: (err) => toast.error(err.message),
  });

  const logs = logsQuery.data?.logs || [];
  const total = logsQuery.data?.total || 0;
  const totalPages = Math.ceil(total / 15);

  return (
    <>
      <Dialog open={open} onOpenChange={onClose}>
        <DialogContent className="max-w-4xl max-h-[85vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="text-base flex items-center gap-2">
              Delivery Logs
              <Badge variant="outline" className="text-xs font-normal">
                {webhookName}
              </Badge>
            </DialogTitle>
          </DialogHeader>

          {/* Filters */}
          <div className="flex items-center justify-between gap-3 pb-2">
            <div className="flex items-center gap-2">
              <Select value={filter} onValueChange={(v) => { setFilter(v); setPage(1); }}>
                <SelectTrigger className="h-8 w-[140px] text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Deliveries</SelectItem>
                  <SelectItem value="success">Successful</SelectItem>
                  <SelectItem value="failed">Failed</SelectItem>
                </SelectContent>
              </Select>
              <span className="text-xs text-muted-foreground">{total} total</span>
            </div>
            <Button
              size="sm"
              variant="ghost"
              className="h-8"
              onClick={() => logsQuery.refetch()}
              disabled={logsQuery.isFetching}
            >
              <RefreshCw className={`h-3.5 w-3.5 ${logsQuery.isFetching ? "animate-spin" : ""}`} />
            </Button>
          </div>

          {/* Table */}
          <div className="flex-1 overflow-auto border rounded-lg">
            {logsQuery.isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : logs.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                <Clock className="h-8 w-8 mb-2 opacity-30" />
                <p className="text-sm">No delivery logs yet</p>
                <p className="text-xs mt-1">Logs will appear here after webhooks are triggered.</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="text-xs">
                    <TableHead className="w-[50px]">Status</TableHead>
                    <TableHead>Event</TableHead>
                    <TableHead>Response</TableHead>
                    <TableHead className="w-[80px]">Latency</TableHead>
                    <TableHead>Time</TableHead>
                    <TableHead className="w-[100px] text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {logs.map((log: any) => (
                    <TableRow key={log.id} className="text-xs">
                      <TableCell>
                        {log.success ? (
                          <CheckCircle className="h-4 w-4 text-green-500" />
                        ) : (
                          <XCircle className="h-4 w-4 text-red-500" />
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-[10px]">
                          {log.event}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {log.responseStatus ? (
                          <Badge
                            variant="outline"
                            className={`text-[10px] ${
                              log.responseStatus >= 200 && log.responseStatus < 300
                                ? "bg-green-500/10 text-green-600 border-green-500/20"
                                : log.responseStatus >= 400
                                ? "bg-red-500/10 text-red-600 border-red-500/20"
                                : "bg-yellow-500/10 text-yellow-600 border-yellow-500/20"
                            }`}
                          >
                            HTTP {log.responseStatus}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground italic">
                            {log.errorMessage ? log.errorMessage.slice(0, 30) : "No response"}
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        <span className={`font-mono ${(log.latencyMs || 0) > 5000 ? "text-red-500" : ""}`}>
                          {log.latencyMs != null ? `${log.latencyMs}ms` : "—"}
                        </span>
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        {new Date(log.createdAt).toLocaleString(undefined, {
                          month: "short",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                          second: "2-digit",
                        })}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-6 w-6 p-0"
                            title="View details"
                            onClick={() => setDetailLog(log)}
                          >
                            <Eye className="h-3 w-3" />
                          </Button>
                          {!log.success && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-6 w-6 p-0"
                              title="Retry delivery"
                              onClick={() =>
                                retryMutation.mutate({ accountId, logId: log.id })
                              }
                              disabled={retryMutation.isPending}
                            >
                              <RotateCw
                                className={`h-3 w-3 ${retryMutation.isPending ? "animate-spin" : ""}`}
                              />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-2">
              <span className="text-xs text-muted-foreground">
                Page {page} of {totalPages}
              </span>
              <div className="flex items-center gap-1">
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 w-7 p-0"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => p - 1)}
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 w-7 p-0"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => p + 1)}
                >
                  <ChevronRight className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Detail View Dialog */}
      <Dialog open={!!detailLog} onOpenChange={() => setDetailLog(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-auto">
          <DialogHeader>
            <DialogTitle className="text-base">Delivery Detail</DialogTitle>
          </DialogHeader>
          {detailLog && (
            <div className="space-y-4">
              {/* Summary */}
              <div className="grid grid-cols-3 gap-3">
                <div className="p-3 bg-muted/30 rounded-lg">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Status</p>
                  <div className="flex items-center gap-1.5 mt-1">
                    {detailLog.success ? (
                      <CheckCircle className="h-4 w-4 text-green-500" />
                    ) : (
                      <XCircle className="h-4 w-4 text-red-500" />
                    )}
                    <span className="text-sm font-medium">
                      {detailLog.success ? "Success" : "Failed"}
                    </span>
                  </div>
                </div>
                <div className="p-3 bg-muted/30 rounded-lg">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wide">HTTP Status</p>
                  <p className="text-sm font-medium mt-1">
                    {detailLog.responseStatus || "N/A"}
                  </p>
                </div>
                <div className="p-3 bg-muted/30 rounded-lg">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Latency</p>
                  <p className="text-sm font-medium mt-1">
                    {detailLog.latencyMs != null ? `${detailLog.latencyMs}ms` : "N/A"}
                  </p>
                </div>
              </div>

              {/* URL */}
              <div>
                <p className="text-xs font-medium mb-1">Request URL</p>
                <code className="block text-xs bg-muted p-2 rounded font-mono break-all">
                  {detailLog.requestUrl}
                </code>
              </div>

              {/* Error */}
              {detailLog.errorMessage && (
                <div>
                  <p className="text-xs font-medium mb-1 text-red-600">Error</p>
                  <code className="block text-xs bg-red-500/5 border border-red-500/20 p-2 rounded font-mono break-all">
                    {detailLog.errorMessage}
                  </code>
                </div>
              )}

              {/* Request Headers */}
              {detailLog.requestHeaders && (
                <div>
                  <p className="text-xs font-medium mb-1">Request Headers</p>
                  <pre className="text-[11px] bg-muted p-3 rounded font-mono overflow-auto max-h-32">
                    {JSON.stringify(detailLog.requestHeaders, null, 2)}
                  </pre>
                </div>
              )}

              {/* Request Body */}
              {detailLog.requestBody && (
                <div>
                  <p className="text-xs font-medium mb-1">Request Body</p>
                  <pre className="text-[11px] bg-muted p-3 rounded font-mono overflow-auto max-h-48">
                    {JSON.stringify(detailLog.requestBody, null, 2)}
                  </pre>
                </div>
              )}

              {/* Response Body */}
              {detailLog.responseBody && (
                <div>
                  <p className="text-xs font-medium mb-1">Response Body</p>
                  <pre className="text-[11px] bg-muted p-3 rounded font-mono overflow-auto max-h-48">
                    {detailLog.responseBody}
                  </pre>
                </div>
              )}

              {/* Timestamp */}
              <p className="text-xs text-muted-foreground">
                Delivered at: {new Date(detailLog.createdAt).toLocaleString()}
              </p>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
