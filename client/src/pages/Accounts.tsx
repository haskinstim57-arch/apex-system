import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  Building2,
  Plus,
  Search,
  MoreVertical,
  Trash2,
  ExternalLink,
  Users,
  Mail,
  Calendar,
  LogIn,
  Send,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useState } from "react";
import { useLocation } from "wouter";
import { toast } from "sonner";

export default function Accounts() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [createOpen, setCreateOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newIndustry, setNewIndustry] = useState("mortgage");
  const [newOwnerEmail, setNewOwnerEmail] = useState("");
  const [newStatus, setNewStatus] = useState<"active" | "suspended">("active");
  const [deleteId, setDeleteId] = useState<number | null>(null);

  const isAdmin = user?.role === "admin";

  const { data: accounts, isLoading } = trpc.accounts.list.useQuery();
  const utils = trpc.useUtils();

  const createMutation = trpc.accounts.create.useMutation({
    onSuccess: () => {
      utils.accounts.list.invalidate();
      utils.accounts.adminStats.invalidate();
      setCreateOpen(false);
      setNewName("");
      setNewIndustry("mortgage");
      setNewOwnerEmail("");
      setNewStatus("active");
      toast.success("Sub-account created successfully");
    },
    onError: (err) => {
      toast.error("Failed to create account", { description: err.message });
    },
  });

  const impersonateMutation = trpc.impersonation.start.useMutation({
    onSuccess: (data) => {
      toast.success(`Now viewing as ${data.accountName}`);
      // Redirect to contacts page with the impersonated account selected
      setLocation("/contacts");
    },
    onError: (err) => {
      toast.error("Failed to impersonate", { description: err.message });
    },
  });

  const resendMutation = trpc.invitations.resend.useMutation({
    onSuccess: () => {
      toast.success("Invitation email resent successfully");
    },
    onError: (err) => {
      toast.error("Failed to resend invitation", { description: err.message });
    },
  });

  const deleteMutation = trpc.accounts.delete.useMutation({
    onSuccess: () => {
      utils.accounts.list.invalidate();
      utils.accounts.adminStats.invalidate();
      setDeleteId(null);
      toast.success("Account deleted");
    },
    onError: (err) => {
      toast.error("Failed to delete account", { description: err.message });
    },
  });

  const updateMutation = trpc.accounts.update.useMutation({
    onSuccess: () => {
      utils.accounts.list.invalidate();
      toast.success("Account status updated");
    },
    onError: (err) => {
      toast.error("Failed to update account", { description: err.message });
    },
  });

  const filteredAccounts = accounts?.filter((a) => {
    const matchesSearch = a.name.toLowerCase().includes(search.toLowerCase()) ||
      (a.ownerEmail ?? "").toLowerCase().includes(search.toLowerCase()) ||
      (a.ownerName ?? "").toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === "all" || a.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const handleCreate = () => {
    if (!newName.trim() || !newOwnerEmail.trim()) return;
    createMutation.mutate({
      name: newName.trim(),
      ownerEmail: newOwnerEmail.trim(),
      industry: newIndustry,
      status: newStatus,
    });
  };

  if (!isAdmin) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="text-center space-y-2">
          <Building2 className="h-12 w-12 text-muted-foreground/30 mx-auto" />
          <h2 className="text-lg font-medium">Access Restricted</h2>
          <p className="text-sm text-muted-foreground">
            Only agency administrators can manage sub-accounts.
          </p>
        </div>
      </div>
    );
  }

  const activeCount = accounts?.filter((a) => a.status === "active").length ?? 0;
  const suspendedCount = accounts?.filter((a) => a.status === "suspended").length ?? 0;

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Sub-Accounts
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage client accounts, assign owners, and control access.
          </p>
        </div>

        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-2">
              <Plus className="h-4 w-4" />
              New Sub-Account
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Create Sub-Account</DialogTitle>
              <DialogDescription>
                Set up a new client account. The owner will be assigned automatically.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label htmlFor="name">Account Name *</Label>
                <Input
                  id="name"
                  placeholder="e.g. Smith Mortgage Team"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="ownerEmail">Owner Email *</Label>
                <Input
                  id="ownerEmail"
                  type="email"
                  placeholder="owner@example.com"
                  value={newOwnerEmail}
                  onChange={(e) => setNewOwnerEmail(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  If this user hasn't signed up yet, an invitation will be sent automatically.
                </p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="industry">Industry</Label>
                  <Select value={newIndustry} onValueChange={setNewIndustry}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="mortgage">Mortgage</SelectItem>
                      <SelectItem value="real_estate">Real Estate</SelectItem>
                      <SelectItem value="insurance">Insurance</SelectItem>
                      <SelectItem value="financial_services">
                        Financial Services
                      </SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="status">Status</Label>
                  <Select
                    value={newStatus}
                    onValueChange={(v) => setNewStatus(v as "active" | "suspended")}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="suspended">Suspended</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setCreateOpen(false)}
              >
                Cancel
              </Button>
              <Button
                onClick={handleCreate}
                disabled={
                  !newName.trim() ||
                  !newOwnerEmail.trim() ||
                  createMutation.isPending
                }
              >
                {createMutation.isPending ? "Creating..." : "Create Account"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
        <Card className="bg-white border-0 card-shadow">
          <CardContent className="pt-4 pb-3 px-4">
            <p className="text-xs text-muted-foreground mb-1">Total Accounts</p>
            <p className="text-xl font-semibold">{accounts?.length ?? 0}</p>
          </CardContent>
        </Card>
        <Card className="bg-white border-0 card-shadow">
          <CardContent className="pt-4 pb-3 px-4">
            <p className="text-xs text-muted-foreground mb-1">Active</p>
            <p className="text-xl font-semibold text-green-600">{activeCount}</p>
          </CardContent>
        </Card>
        <Card className="bg-white border-0 card-shadow">
          <CardContent className="pt-4 pb-3 px-4">
            <p className="text-xs text-muted-foreground mb-1">Suspended</p>
            <p className="text-xl font-semibold text-orange-600">{suspendedCount}</p>
          </CardContent>
        </Card>
      </div>

      {/* Search + Filter */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by name or owner..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-9 bg-muted/50 border-border/50"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-[140px] h-9 bg-muted/50 border-border/50">
            <SelectValue placeholder="All statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="suspended">Suspended</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Accounts Table */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-16 bg-muted/30 animate-pulse rounded-lg border border-border/30"
            />
          ))}
        </div>
      ) : filteredAccounts && filteredAccounts.length > 0 ? (
        <div className="border border-border/50 rounded-lg overflow-hidden overflow-x-auto">
          {/* Table Header */}
          <div className="grid grid-cols-[1fr_1fr_120px_140px_48px] gap-4 px-5 py-3 bg-muted/30 text-xs font-medium text-muted-foreground uppercase tracking-wider border-b border-border/30 min-w-[600px]">
            <span>Account</span>
            <span>Owner</span>
            <span>Status</span>
            <span>Created</span>
            <span></span>
          </div>

          {/* Table Rows */}
          {filteredAccounts.map((account) => (
            <div
              key={account.id}
              className="grid grid-cols-[1fr_1fr_120px_140px_48px] gap-4 px-5 py-3.5 items-center border-b border-border/20 last:border-b-0 hover:bg-muted/20 transition-colors group min-w-[600px]"
            >
              {/* Account Name + Industry */}
              <div
                className="flex items-center gap-3 cursor-pointer min-w-0"
                onClick={() => setLocation(`/accounts/${account.id}`)}
              >
                <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                  <Building2 className="h-4 w-4 text-primary" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{account.name}</p>
                  <p className="text-xs text-muted-foreground capitalize">
                    {account.industry?.replace("_", " ") || "Mortgage"}
                  </p>
                </div>
              </div>

              {/* Owner */}
              <div className="min-w-0">
                {account.ownerName ? (
                  <>
                    <p className="text-sm truncate">{account.ownerName}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {account.ownerEmail || account.email || "—"}
                    </p>
                  </>
                ) : (
                  <>
                    <div className="flex items-center gap-2">
                      <Badge
                        variant="secondary"
                        className="text-[10px] h-5 bg-yellow-500/10 text-yellow-600 border-yellow-200"
                      >
                        Pending
                      </Badge>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 px-2 text-[10px] gap-1 text-primary hover:text-primary/80"
                        disabled={resendMutation.isPending}
                        onClick={(e) => {
                          e.stopPropagation();
                          resendMutation.mutate({ accountId: account.id });
                        }}
                      >
                        <Send className="h-3 w-3" />
                        {resendMutation.isPending ? "Sending..." : "Resend"}
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground truncate mt-0.5">
                      {account.email || "—"}
                    </p>
                  </>
                )}
              </div>

              {/* Status */}
              <div>
                <Badge
                  variant={account.status === "active" ? "default" : "secondary"}
                  className={`text-[10px] h-5 cursor-pointer ${
                    account.status === "active"
                      ? "bg-green-500/10 text-green-600 border-green-200 hover:bg-green-500/20"
                      : account.status === "suspended"
                        ? "bg-orange-500/10 text-orange-600 border-orange-200 hover:bg-orange-500/20"
                        : ""
                  }`}
                  onClick={() => {
                    const newStatus = account.status === "active" ? "suspended" : "active";
                    updateMutation.mutate({ id: account.id, status: newStatus });
                  }}
                >
                  {account.status}
                </Badge>
              </div>

              {/* Created Date */}
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Calendar className="h-3 w-3" />
                {new Date(account.createdAt).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })}
              </div>

              {/* Actions */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <MoreVertical className="h-3.5 w-3.5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem
                    onClick={() => setLocation(`/accounts/${account.id}`)}
                  >
                    <ExternalLink className="mr-2 h-3.5 w-3.5" />
                    View Details
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => {
                      const newStatus = account.status === "active" ? "suspended" : "active";
                      updateMutation.mutate({ id: account.id, status: newStatus });
                    }}
                  >
                    <Users className="mr-2 h-3.5 w-3.5" />
                    {account.status === "active" ? "Suspend" : "Activate"}
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => {
                      impersonateMutation.mutate({ accountId: account.id });
                    }}
                    disabled={impersonateMutation.isPending}
                  >
                    <LogIn className="mr-2 h-3.5 w-3.5" />
                    Login as Client
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    className="text-destructive focus:text-destructive"
                    onClick={() => setDeleteId(account.id)}
                  >
                    <Trash2 className="mr-2 h-3.5 w-3.5" />
                    Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <Building2 className="h-12 w-12 text-muted-foreground/30 mb-4" />
          <h3 className="text-lg font-medium">No sub-accounts yet</h3>
          <p className="text-sm text-muted-foreground mt-1 max-w-sm">
            Create your first client sub-account to start managing teams and contacts.
          </p>
        </div>
      )}

      {/* Delete Confirmation */}
      <AlertDialog
        open={deleteId !== null}
        onOpenChange={(open) => !open && setDeleteId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Sub-Account</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this sub-account and all associated
              data including contacts, members, and invitations. This action
              cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (deleteId) deleteMutation.mutate({ id: deleteId });
              }}
            >
              {deleteMutation.isPending ? "Deleting..." : "Delete Account"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
