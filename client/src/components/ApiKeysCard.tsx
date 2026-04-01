import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Key,
  Plus,
  Loader2,
  Copy,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Clock,
  Shield,
  ChevronLeft,
  ChevronRight,
  Eye,
} from "lucide-react";
import { toast } from "sonner";

const AVAILABLE_PERMISSIONS = [
  { value: "contacts:create", label: "Create Contacts", description: "Push new contacts into the CRM" },
  { value: "contacts:read", label: "Read Contacts", description: "Fetch contact data (future)" },
  { value: "events:create", label: "Create Events", description: "Push custom events" },
  { value: "*", label: "Full Access", description: "All current and future permissions" },
] as const;

interface ApiKeysCardProps {
  accountId: number;
}

export function ApiKeysCard({ accountId }: ApiKeysCardProps) {
  const utils = trpc.useUtils();
  const keysList = trpc.apiKeys.list.useQuery({ accountId });
  const [showCreate, setShowCreate] = useState(false);
  const [revokeId, setRevokeId] = useState<number | null>(null);
  const [showNewKey, setShowNewKey] = useState<{ fullKey: string; name: string } | null>(null);
  const [showLogs, setShowLogs] = useState(false);

  // Create form state
  const [name, setName] = useState("");
  const [selectedPermissions, setSelectedPermissions] = useState<string[]>(["contacts:create"]);

  const createKey = trpc.apiKeys.create.useMutation({
    onSuccess: (data) => {
      setShowNewKey({ fullKey: data.fullKey, name: data.name });
      utils.apiKeys.list.invalidate({ accountId });
      resetForm();
    },
    onError: (err) => toast.error(err.message),
  });

  const revokeKey = trpc.apiKeys.revoke.useMutation({
    onSuccess: () => {
      toast.success("API key revoked");
      utils.apiKeys.list.invalidate({ accountId });
      setRevokeId(null);
    },
    onError: (err) => toast.error(err.message),
  });

  function resetForm() {
    setShowCreate(false);
    setName("");
    setSelectedPermissions(["contacts:create"]);
  }

  function togglePermission(perm: string) {
    if (perm === "*") {
      setSelectedPermissions(selectedPermissions.includes("*") ? [] : ["*"]);
      return;
    }
    setSelectedPermissions((prev) =>
      prev.includes(perm) ? prev.filter((p) => p !== perm) : [...prev.filter((p) => p !== "*"), perm]
    );
  }

  const keys = keysList.data || [];
  const activeKeys = keys.filter((k) => !k.revokedAt);
  const revokedKeys = keys.filter((k) => k.revokedAt);

  return (
    <>
      <Card className="bg-white border-0 card-shadow">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Key className="h-4 w-4 text-muted-foreground" />
                API Keys
              </CardTitle>
              <CardDescription className="text-xs mt-1">
                Generate API keys for external services to push data into Sterling Marketing via REST endpoints.
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setShowLogs(true)}
                className="text-xs"
              >
                <Eye className="h-3.5 w-3.5 mr-1" /> View Logs
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setShowCreate(true)}
                disabled={showCreate}
              >
                <Plus className="h-3.5 w-3.5 mr-1" /> Create Key
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Create Form */}
          {showCreate && (
            <div className="p-4 border rounded-lg space-y-3 bg-muted/30">
              <p className="text-sm font-medium">New API Key</p>
              <div>
                <Label className="text-xs">Name</Label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Landing Page Integration"
                  className="h-8 text-sm"
                />
              </div>
              <div>
                <Label className="text-xs">Permissions</Label>
                <div className="mt-1.5 space-y-2">
                  {AVAILABLE_PERMISSIONS.map((perm) => (
                    <label
                      key={perm.value}
                      className="flex items-start gap-2 p-2 border rounded-lg hover:bg-muted/30 cursor-pointer transition-colors"
                    >
                      <Checkbox
                        checked={
                          selectedPermissions.includes(perm.value) ||
                          (perm.value !== "*" && selectedPermissions.includes("*"))
                        }
                        onCheckedChange={() => togglePermission(perm.value)}
                        disabled={perm.value !== "*" && selectedPermissions.includes("*")}
                        className="mt-0.5"
                      />
                      <div>
                        <p className="text-xs font-medium">{perm.label}</p>
                        <p className="text-[10px] text-muted-foreground">{perm.description}</p>
                      </div>
                    </label>
                  ))}
                </div>
              </div>
              <div className="flex gap-2 justify-end">
                <Button size="sm" variant="ghost" onClick={resetForm}>
                  Cancel
                </Button>
                <Button
                  size="sm"
                  onClick={() =>
                    createKey.mutate({
                      accountId,
                      name,
                      permissions: selectedPermissions,
                    })
                  }
                  disabled={createKey.isPending || !name || selectedPermissions.length === 0}
                >
                  {createKey.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />}
                  Generate Key
                </Button>
              </div>
            </div>
          )}

          {/* Active Keys */}
          {keysList.isLoading ? (
            <div className="flex items-center justify-center py-6">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : activeKeys.length === 0 && !showCreate ? (
            <div className="text-center py-6">
              <Shield className="h-10 w-10 text-muted-foreground/30 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">No API keys created</p>
              <p className="text-xs text-muted-foreground mt-1">
                Create an API key to allow external services to push contacts and events into Sterling Marketing.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {activeKeys.map((key) => (
                <div
                  key={key.id}
                  className="p-3 border rounded-lg bg-white flex items-center justify-between gap-3"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{key.name}</span>
                      <Badge variant="outline" className="text-[10px] bg-green-500/10 text-green-600 border-green-500/20">
                        Active
                      </Badge>
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <code className="text-xs font-mono text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                        {key.keyPrefix}••••••••••••
                      </code>
                      <div className="flex items-center gap-1 flex-wrap">
                        {(key.permissions as string[]).map((p) => (
                          <Badge key={p} variant="outline" className="text-[10px]">
                            {p}
                          </Badge>
                        ))}
                      </div>
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-[10px] text-muted-foreground">
                      <span>Created: {new Date(key.createdAt).toLocaleDateString()}</span>
                      {key.lastUsedAt && (
                        <span>Last used: {new Date(key.lastUsedAt).toLocaleString()}</span>
                      )}
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-red-500 hover:text-red-600 text-xs"
                    onClick={() => setRevokeId(key.id)}
                  >
                    Revoke
                  </Button>
                </div>
              ))}
            </div>
          )}

          {/* Revoked Keys */}
          {revokedKeys.length > 0 && (
            <div className="pt-2">
              <p className="text-xs font-medium text-muted-foreground mb-2">Revoked Keys</p>
              <div className="space-y-1">
                {revokedKeys.map((key) => (
                  <div
                    key={key.id}
                    className="p-2 border rounded-lg bg-muted/30 opacity-60 flex items-center justify-between"
                  >
                    <div>
                      <span className="text-xs">{key.name}</span>
                      <code className="text-[10px] font-mono text-muted-foreground ml-2">
                        {key.keyPrefix}••••
                      </code>
                    </div>
                    <Badge variant="outline" className="text-[10px] bg-red-500/10 text-red-600 border-red-500/20">
                      Revoked
                    </Badge>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* API Documentation */}
          {activeKeys.length > 0 && (
            <div className="p-3 bg-blue-500/5 border border-blue-500/20 rounded-lg">
              <p className="text-xs font-medium text-blue-600 mb-1">Inbound API Endpoints</p>
              <div className="space-y-1.5 text-xs text-muted-foreground">
                <div>
                  <code className="bg-muted px-1.5 py-0.5 rounded text-[10px] font-mono">
                    POST /api/inbound/contacts
                  </code>
                  <span className="ml-1.5">Create a contact. Body: {"{"} firstName, lastName, email, phone, source, tags {"}"}</span>
                </div>
                <div>
                  <code className="bg-muted px-1.5 py-0.5 rounded text-[10px] font-mono">
                    POST /api/inbound/events
                  </code>
                  <span className="ml-1.5">Push a custom event. Body: {"{"} contactId, event, data {"}"}</span>
                </div>
                <p className="mt-1">
                  Include <code className="bg-muted px-1 rounded">X-API-Key: ak_your_key_here</code> in the request header.
                  Rate limit: 60 requests/minute per key.
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* New Key Reveal Dialog */}
      <Dialog open={!!showNewKey} onOpenChange={() => setShowNewKey(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-base flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-500" />
              API Key Created
            </DialogTitle>
            <DialogDescription>
              Copy your API key now. It will not be shown again.
            </DialogDescription>
          </DialogHeader>
          {showNewKey && (
            <div className="space-y-3">
              <div>
                <Label className="text-xs">Key Name</Label>
                <p className="text-sm font-medium">{showNewKey.name}</p>
              </div>
              <div>
                <Label className="text-xs">API Key</Label>
                <div className="flex items-center gap-2 mt-1">
                  <code className="flex-1 text-xs font-mono bg-muted p-2.5 rounded border break-all">
                    {showNewKey.fullKey}
                  </code>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      navigator.clipboard.writeText(showNewKey.fullKey);
                      toast.success("API key copied to clipboard");
                    }}
                  >
                    <Copy className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
              <div className="p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 text-yellow-600 shrink-0 mt-0.5" />
                <p className="text-xs text-yellow-700">
                  Store this key securely. For security reasons, the full key cannot be retrieved after closing this dialog.
                </p>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button onClick={() => setShowNewKey(null)}>Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Revoke Confirmation */}
      <AlertDialog open={!!revokeId} onOpenChange={() => setRevokeId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Revoke API Key</AlertDialogTitle>
            <AlertDialogDescription>
              Revoking this key will immediately stop all requests using it. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700"
              onClick={() => {
                if (revokeId) revokeKey.mutate({ accountId, keyId: revokeId });
              }}
            >
              {revokeKey.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />}
              Revoke Key
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Inbound Request Logs Dialog */}
      <InboundLogsDialog
        accountId={accountId}
        open={showLogs}
        onClose={() => setShowLogs(false)}
      />
    </>
  );
}

// ─── Inbound Request Logs Dialog ──────────────────────────────
function InboundLogsDialog({
  accountId,
  open,
  onClose,
}: {
  accountId: number;
  open: boolean;
  onClose: () => void;
}) {
  const [page, setPage] = useState(1);

  const logsQuery = trpc.apiKeys.inboundLogs.useQuery(
    { accountId, page, limit: 15 },
    { enabled: open }
  );

  const logs = logsQuery.data?.logs || [];
  const total = logsQuery.data?.total || 0;
  const totalPages = Math.ceil(total / 15);

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="text-base">Inbound Request Logs</DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-auto border rounded-lg">
          {logsQuery.isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : logs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <Clock className="h-8 w-8 mb-2 opacity-30" />
              <p className="text-sm">No inbound requests yet</p>
              <p className="text-xs mt-1">Logs will appear here when external services use your API keys.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="text-xs">
                  <TableHead className="w-[50px]">Status</TableHead>
                  <TableHead>Endpoint</TableHead>
                  <TableHead>Response</TableHead>
                  <TableHead>IP</TableHead>
                  <TableHead>Time</TableHead>
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
                      <code className="text-[10px] font-mono bg-muted px-1 rounded">
                        {log.method} {log.endpoint}
                      </code>
                      {log.errorMessage && (
                        <p className="text-[10px] text-red-500 mt-0.5 truncate max-w-[200px]">
                          {log.errorMessage}
                        </p>
                      )}
                    </TableCell>
                    <TableCell>
                      {log.responseStatus && (
                        <Badge
                          variant="outline"
                          className={`text-[10px] ${
                            log.responseStatus >= 200 && log.responseStatus < 300
                              ? "bg-green-500/10 text-green-600"
                              : "bg-red-500/10 text-red-600"
                          }`}
                        >
                          {log.responseStatus}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <span className="font-mono text-[10px]">{log.ipAddress || "—"}</span>
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {new Date(log.createdAt).toLocaleString(undefined, {
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>

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
  );
}
