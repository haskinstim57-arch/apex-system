import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
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
} from "@/components/ui/alert-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import {
  Facebook,
  Plus,
  Pencil,
  Trash2,
  Copy,
  ExternalLink,
  ArrowLeft,
  ShieldCheck,
  Link2,
} from "lucide-react";
import { useLocation } from "wouter";

// ─────────────────────────────────────────────
// Facebook Pages Settings Panel
// Admin-only: manage facebook_page_mappings
// ─────────────────────────────────────────────

type MappingFormData = {
  facebookPageId: string;
  accountId: string;
  pageName: string;
  verifyToken: string;
};

const emptyForm: MappingFormData = {
  facebookPageId: "",
  accountId: "",
  pageName: "",
  verifyToken: "",
};

export default function FacebookPages() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const isAdmin = user?.role === "admin";

  // State
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<MappingFormData>(emptyForm);
  const [deleteId, setDeleteId] = useState<number | null>(null);

  // Queries
  const mappingsQuery = trpc.facebookPages.list.useQuery();
  const accountsQuery = trpc.accounts.list.useQuery();
  const utils = trpc.useUtils();

  // Mutations
  const createMutation = trpc.facebookPages.create.useMutation({
    onSuccess: () => {
      toast.success("Facebook page mapping created");
      utils.facebookPages.list.invalidate();
      closeDialog();
    },
    onError: (err) => toast.error(err.message),
  });

  const updateMutation = trpc.facebookPages.update.useMutation({
    onSuccess: () => {
      toast.success("Mapping updated");
      utils.facebookPages.list.invalidate();
      closeDialog();
    },
    onError: (err) => toast.error(err.message),
  });

  const deleteMutation = trpc.facebookPages.delete.useMutation({
    onSuccess: () => {
      toast.success("Mapping deleted");
      utils.facebookPages.list.invalidate();
      setDeleteId(null);
    },
    onError: (err) => toast.error(err.message),
  });

  // Build account lookup map
  const accountMap = useMemo(() => {
    const map = new Map<number, string>();
    if (accountsQuery.data) {
      for (const a of accountsQuery.data) {
        map.set(a.id, a.name);
      }
    }
    return map;
  }, [accountsQuery.data]);

  const mappings = mappingsQuery.data?.mappings ?? [];

  // Handlers
  function openCreate() {
    setEditingId(null);
    setForm(emptyForm);
    setDialogOpen(true);
  }

  function openEdit(mapping: any) {
    setEditingId(mapping.id);
    setForm({
      facebookPageId: mapping.facebookPageId,
      accountId: String(mapping.accountId),
      pageName: mapping.pageName || "",
      verifyToken: mapping.verifyToken || "",
    });
    setDialogOpen(true);
  }

  function closeDialog() {
    setDialogOpen(false);
    setEditingId(null);
    setForm(emptyForm);
  }

  function handleSubmit() {
    if (!form.facebookPageId.trim()) {
      toast.error("Facebook Page ID is required");
      return;
    }
    if (!form.accountId) {
      toast.error("Please select a sub-account");
      return;
    }

    if (editingId) {
      updateMutation.mutate({
        id: editingId,
        facebookPageId: form.facebookPageId.trim(),
        accountId: parseInt(form.accountId),
        pageName: form.pageName.trim() || undefined,
        verifyToken: form.verifyToken.trim() || undefined,
      });
    } else {
      createMutation.mutate({
        facebookPageId: form.facebookPageId.trim(),
        accountId: parseInt(form.accountId),
        pageName: form.pageName.trim() || undefined,
        verifyToken: form.verifyToken.trim() || undefined,
      });
    }
  }

  function copyToClipboard(text: string) {
    navigator.clipboard.writeText(text);
    toast.success("Copied to clipboard");
  }

  if (!isAdmin) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">
          Admin access required to manage Facebook page mappings.
        </p>
      </div>
    );
  }

  const isSaving = createMutation.isPending || updateMutation.isPending;

  return (
    <div className="space-y-4 sm:space-y-6 max-w-4xl">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => setLocation("/settings")}
          className="h-8 w-8 rounded-lg border border-border/50 flex items-center justify-center hover:bg-accent transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div className="flex-1">
          <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
            <Facebook className="h-5 w-5 text-blue-500" />
            Facebook Pages
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Map Facebook page IDs to sub-accounts for lead routing and webhook
            verification.
          </p>
        </div>
        <Button onClick={openCreate} size="sm" className="gap-1.5">
          <Plus className="h-3.5 w-3.5" />
          Add Mapping
        </Button>
      </div>

      {/* Webhook endpoint info */}
      <Card className="border-border/50 bg-card">
        <CardContent className="pt-4 pb-4 px-5">
          <div className="flex items-start gap-3">
            <div className="h-8 w-8 rounded-lg bg-blue-500/10 flex items-center justify-center shrink-0 mt-0.5">
              <Link2 className="h-4 w-4 text-blue-500" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium">Webhook Endpoint</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Use this URL in each client's Facebook App webhook settings.
                Each client sets their own verify token.
              </p>
              <div className="flex items-center gap-2 mt-2">
                <code className="text-xs bg-muted px-2 py-1 rounded font-mono truncate">
                  {window.location.origin}/api/webhooks/facebook-leads
                </code>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0 shrink-0"
                  onClick={() =>
                    copyToClipboard(
                      `${window.location.origin}/api/webhooks/facebook-leads`
                    )
                  }
                >
                  <Copy className="h-3 w-3" />
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Mappings table */}
      <Card className="border-border/50 bg-card">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium">
            Page Mappings
          </CardTitle>
          <CardDescription className="text-xs">
            {mappings.length} mapping{mappings.length !== 1 ? "s" : ""}{" "}
            configured
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {mappingsQuery.isLoading ? (
            <div className="p-6 space-y-3">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : mappings.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 px-6 text-center">
              <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center mb-3">
                <Facebook className="h-5 w-5 text-muted-foreground" />
              </div>
              <p className="text-sm font-medium">No mappings yet</p>
              <p className="text-xs text-muted-foreground mt-1 max-w-sm">
                Add a mapping to connect a Facebook page to a sub-account. Leads
                from that page will be automatically routed to the correct
                account.
              </p>
              <Button
                onClick={openCreate}
                variant="outline"
                size="sm"
                className="mt-4 gap-1.5"
              >
                <Plus className="h-3.5 w-3.5" />
                Add First Mapping
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="text-xs">Page Name</TableHead>
                    <TableHead className="text-xs">Facebook Page ID</TableHead>
                    <TableHead className="text-xs">Sub-Account</TableHead>
                    <TableHead className="text-xs">Verify Token</TableHead>
                    <TableHead className="text-xs">Created</TableHead>
                    <TableHead className="text-xs text-right">
                      Actions
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {mappings.map((mapping) => (
                    <TableRow key={mapping.id}>
                      <TableCell className="font-medium text-sm">
                        {mapping.pageName || (
                          <span className="text-muted-foreground italic">
                            Unnamed
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5">
                          <code className="text-xs font-mono bg-muted px-1.5 py-0.5 rounded">
                            {mapping.facebookPageId}
                          </code>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-5 w-5 p-0"
                            onClick={() =>
                              copyToClipboard(mapping.facebookPageId)
                            }
                          >
                            <Copy className="h-2.5 w-2.5" />
                          </Button>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className="text-xs font-normal"
                        >
                          {accountMap.get(mapping.accountId) ||
                            `Account #${mapping.accountId}`}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {mapping.verifyToken ? (
                          <div className="flex items-center gap-1.5">
                            <ShieldCheck className="h-3 w-3 text-green-500" />
                            <span className="text-xs text-muted-foreground font-mono">
                              {mapping.verifyToken.slice(0, 8)}
                              {mapping.verifyToken.length > 8 ? "..." : ""}
                            </span>
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground italic">
                            Not set
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {new Date(mapping.createdAt).toLocaleDateString()}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0"
                            onClick={() => openEdit(mapping)}
                          >
                            <Pencil className="h-3 w-3" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                            onClick={() => setDeleteId(mapping.id)}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create / Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingId ? "Edit Page Mapping" : "Add Page Mapping"}
            </DialogTitle>
            <DialogDescription>
              {editingId
                ? "Update the mapping between a Facebook page and a sub-account."
                : "Connect a Facebook page to a sub-account so leads are automatically routed."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="pageName" className="text-xs">
                Page Name
              </Label>
              <Input
                id="pageName"
                placeholder="e.g. Premier Mortgage Resources"
                value={form.pageName}
                onChange={(e) =>
                  setForm((f) => ({ ...f, pageName: e.target.value }))
                }
              />
              <p className="text-[11px] text-muted-foreground">
                A friendly name for your reference.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="facebookPageId" className="text-xs">
                Facebook Page ID <span className="text-destructive">*</span>
              </Label>
              <Input
                id="facebookPageId"
                placeholder="e.g. 123456789012345"
                value={form.facebookPageId}
                onChange={(e) =>
                  setForm((f) => ({ ...f, facebookPageId: e.target.value }))
                }
                disabled={!!editingId}
              />
              <p className="text-[11px] text-muted-foreground">
                Found in Facebook Business Suite under Page Settings → Page ID.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="accountId" className="text-xs">
                Sub-Account <span className="text-destructive">*</span>
              </Label>
              <Select
                value={form.accountId}
                onValueChange={(val) =>
                  setForm((f) => ({ ...f, accountId: val }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a sub-account" />
                </SelectTrigger>
                <SelectContent>
                  {accountsQuery.data?.map((account: { id: number; name: string }) => (
                    <SelectItem
                      key={account.id}
                      value={String(account.id)}
                    >
                      {account.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-[11px] text-muted-foreground">
                Leads from this page will be routed to this sub-account.
              </p>
            </div>

            <Separator className="bg-border/50" />

            <div className="space-y-2">
              <Label htmlFor="verifyToken" className="text-xs">
                Webhook Verify Token
              </Label>
              <Input
                id="verifyToken"
                placeholder="e.g. my_secret_verify_token"
                value={form.verifyToken}
                onChange={(e) =>
                  setForm((f) => ({ ...f, verifyToken: e.target.value }))
                }
              />
              <p className="text-[11px] text-muted-foreground">
                The token this client set in their Facebook App's webhook
                configuration. Must match exactly.
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={closeDialog} disabled={isSaving}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={isSaving}>
              {isSaving
                ? "Saving..."
                : editingId
                  ? "Update Mapping"
                  : "Create Mapping"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog
        open={deleteId !== null}
        onOpenChange={(open) => !open && setDeleteId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this mapping?</AlertDialogTitle>
            <AlertDialogDescription>
              Leads from this Facebook page will no longer be routed to the
              associated sub-account. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteId && deleteMutation.mutate({ id: deleteId })}
            >
              {deleteMutation.isPending ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
