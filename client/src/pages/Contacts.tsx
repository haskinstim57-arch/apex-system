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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  ChevronLeft,
  ChevronRight,
  Filter,
  Loader2,
  MoreHorizontal,
  Plus,
  Search,
  Trash2,
  UserPlus,
  Eye,
  Pencil,
  PhoneForwarded,
  X,
} from "lucide-react";
import { useMemo, useState } from "react";
import { useLocation } from "wouter";
import { toast } from "sonner";

const STATUSES = [
  "new",
  "contacted",
  "qualified",
  "proposal",
  "negotiation",
  "won",
  "lost",
  "nurture",
] as const;

const STATUS_COLORS: Record<string, string> = {
  new: "bg-blue-500/15 text-blue-400 border-blue-500/30",
  contacted: "bg-amber-500/15 text-amber-400 border-amber-500/30",
  qualified: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  proposal: "bg-purple-500/15 text-purple-400 border-purple-500/30",
  negotiation: "bg-orange-500/15 text-orange-400 border-orange-500/30",
  won: "bg-green-500/15 text-green-300 border-green-500/30",
  lost: "bg-red-500/15 text-red-400 border-red-500/30",
  nurture: "bg-cyan-500/15 text-cyan-400 border-cyan-500/30",
};

const LEAD_SOURCES = [
  "Website",
  "Referral",
  "Social Media",
  "Cold Call",
  "Email Campaign",
  "Advertisement",
  "Walk-in",
  "Partner",
  "Event",
  "Other",
];

export default function Contacts() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const utils = trpc.useUtils();

  // Account selection — user's accounts
  const { data: userAccounts, isLoading: accountsLoading } =
    trpc.accounts.list.useQuery();
  const [selectedAccountId, setSelectedAccountId] = useState<number | null>(
    null
  );

  // Resolve account ID
  const accountId = useMemo(() => {
    if (selectedAccountId) return selectedAccountId;
    if (userAccounts && userAccounts.length > 0) return userAccounts[0].id;
    return null;
  }, [selectedAccountId, userAccounts]);

  // Filters
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [sourceFilter, setSourceFilter] = useState<string>("");
  const [showFilters, setShowFilters] = useState(false);
  const [page, setPage] = useState(0);
  const pageSize = 25;

  // Contacts query
  const { data: contactsData, isLoading: contactsLoading } =
    trpc.contacts.list.useQuery(
      {
        accountId: accountId!,
        search: search || undefined,
        status: (statusFilter as any) || undefined,
        leadSource: sourceFilter || undefined,
        limit: pageSize,
        offset: page * pageSize,
      },
      { enabled: !!accountId }
    );

  // Members for assignment
  const { data: members } = trpc.members.list.useQuery(
    { accountId: accountId! },
    { enabled: !!accountId }
  );

  // Dialogs
  const [createOpen, setCreateOpen] = useState(false);
  const [editContact, setEditContact] = useState<any>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<any>(null);

  // Create mutation
  const createMutation = trpc.contacts.create.useMutation({
    onSuccess: () => {
      toast.success("Contact created");
      utils.contacts.list.invalidate();
      utils.contacts.stats.invalidate();
      setCreateOpen(false);
    },
    onError: (err) => toast.error(err.message),
  });

  // Update mutation
  const updateMutation = trpc.contacts.update.useMutation({
    onSuccess: () => {
      toast.success("Contact updated");
      utils.contacts.list.invalidate();
      setEditContact(null);
    },
    onError: (err) => toast.error(err.message),
  });

  // Delete mutation
  const deleteMutation = trpc.contacts.delete.useMutation({
    onSuccess: () => {
      toast.success("Contact deleted");
      utils.contacts.list.invalidate();
      utils.contacts.stats.invalidate();
      setDeleteConfirm(null);
    },
    onError: (err) => toast.error(err.message),
  });

  // Assign mutation
  const assignMutation = trpc.contacts.assign.useMutation({
    onSuccess: () => {
      toast.success("Contact assigned");
      utils.contacts.list.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  const startAICallMutation = trpc.aiCalls.start.useMutation({
    onSuccess: () => {
      toast.success("AI call initiated successfully");
    },
    onError: (err) => toast.error(err.message),
  });

  // Stats
  const { data: stats } = trpc.contacts.stats.useQuery(
    { accountId: accountId! },
    { enabled: !!accountId }
  );

  const contacts = contactsData?.data ?? [];
  const total = contactsData?.total ?? 0;
  const totalPages = Math.ceil(total / pageSize);

  if (accountsLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!userAccounts || userAccounts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-center">
        <p className="text-muted-foreground mb-2">
          You don't have access to any accounts yet.
        </p>
        <p className="text-xs text-muted-foreground">
          Ask an admin to invite you to a sub-account.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Contacts</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {total} contact{total !== 1 ? "s" : ""} in this account
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Account selector */}
          {userAccounts.length > 1 && (
            <Select
              value={String(accountId)}
              onValueChange={(v) => {
                setSelectedAccountId(parseInt(v));
                setPage(0);
              }}
            >
              <SelectTrigger className="w-[180px] h-9 text-xs bg-card border-border/50">
                <SelectValue placeholder="Select account" />
              </SelectTrigger>
              <SelectContent>
                {userAccounts.map((acc) => (
                  <SelectItem key={acc.id} value={String(acc.id)}>
                    {acc.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <Button
            size="sm"
            onClick={() => setCreateOpen(true)}
            className="h-9 gap-1.5"
          >
            <Plus className="h-3.5 w-3.5" />
            Add Contact
          </Button>
        </div>
      </div>

      {/* Stats Row */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <MiniStat label="Total" value={stats.total} />
          <MiniStat label="New" value={stats.new} color="text-blue-400" />
          <MiniStat
            label="Qualified"
            value={stats.qualified}
            color="text-emerald-400"
          />
          <MiniStat label="Won" value={stats.won} color="text-green-300" />
        </div>
      )}

      {/* Search & Filters */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Search contacts..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(0);
            }}
            className="pl-9 h-9 text-sm bg-card border-border/50"
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="absolute right-3 top-1/2 -translate-y-1/2"
            >
              <X className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground" />
            </button>
          )}
        </div>
        <Button
          variant="outline"
          size="sm"
          className="h-9 gap-1.5 border-border/50"
          onClick={() => setShowFilters(!showFilters)}
        >
          <Filter className="h-3.5 w-3.5" />
          Filters
          {(statusFilter || sourceFilter) && (
            <Badge
              variant="secondary"
              className="h-4 w-4 p-0 flex items-center justify-center text-[10px] ml-1"
            >
              {(statusFilter ? 1 : 0) + (sourceFilter ? 1 : 0)}
            </Badge>
          )}
        </Button>
      </div>

      {/* Filter Row */}
      {showFilters && (
        <div className="flex items-center gap-3 p-3 rounded-lg bg-card border border-border/50">
          <Select
            value={statusFilter || "all"}
            onValueChange={(v) => {
              setStatusFilter(v === "all" ? "" : v);
              setPage(0);
            }}
          >
            <SelectTrigger className="w-[150px] h-8 text-xs">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              {STATUSES.map((s) => (
                <SelectItem key={s} value={s}>
                  {s.charAt(0).toUpperCase() + s.slice(1)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={sourceFilter || "all"}
            onValueChange={(v) => {
              setSourceFilter(v === "all" ? "" : v);
              setPage(0);
            }}
          >
            <SelectTrigger className="w-[150px] h-8 text-xs">
              <SelectValue placeholder="Lead Source" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Sources</SelectItem>
              {LEAD_SOURCES.map((s) => (
                <SelectItem key={s} value={s}>
                  {s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {(statusFilter || sourceFilter) && (
            <Button
              variant="ghost"
              size="sm"
              className="h-8 text-xs"
              onClick={() => {
                setStatusFilter("");
                setSourceFilter("");
                setPage(0);
              }}
            >
              Clear
            </Button>
          )}
        </div>
      )}

      {/* Table */}
      <Card className="border-border/50 bg-card overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="border-border/50 hover:bg-transparent">
                <TableHead className="text-xs font-medium text-muted-foreground">
                  Name
                </TableHead>
                <TableHead className="text-xs font-medium text-muted-foreground">
                  Email
                </TableHead>
                <TableHead className="text-xs font-medium text-muted-foreground">
                  Phone
                </TableHead>
                <TableHead className="text-xs font-medium text-muted-foreground">
                  Status
                </TableHead>
                <TableHead className="text-xs font-medium text-muted-foreground">
                  Source
                </TableHead>
                <TableHead className="text-xs font-medium text-muted-foreground">
                  Assigned To
                </TableHead>
                <TableHead className="text-xs font-medium text-muted-foreground w-[50px]">
                  Actions
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {contactsLoading ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-12">
                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground mx-auto" />
                  </TableCell>
                </TableRow>
              ) : contacts.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={7}
                    className="text-center py-12 text-muted-foreground text-sm"
                  >
                    {search || statusFilter || sourceFilter
                      ? "No contacts match your filters."
                      : "No contacts yet. Add your first contact to get started."}
                  </TableCell>
                </TableRow>
              ) : (
                contacts.map((contact) => {
                  const assignedMember = members?.find(
                    (m) => m.userId === contact.assignedUserId
                  );
                  return (
                    <TableRow
                      key={contact.id}
                      className="border-border/50 cursor-pointer hover:bg-muted/30"
                      onClick={() =>
                        navigate(
                          `/contacts/${contact.id}?account=${accountId}`
                        )
                      }
                    >
                      <TableCell className="font-medium text-sm">
                        {contact.firstName} {contact.lastName}
                        {contact.company && (
                          <span className="block text-xs text-muted-foreground">
                            {contact.company}
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {contact.email || "—"}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {contact.phone || "—"}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={`text-[10px] font-medium ${STATUS_COLORS[contact.status] || ""}`}
                        >
                          {contact.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {contact.leadSource || "—"}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {assignedMember?.userName || "Unassigned"}
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger
                            asChild
                            onClick={(e) => e.stopPropagation()}
                          >
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 w-7 p-0"
                            >
                              <MoreHorizontal className="h-3.5 w-3.5" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              onClick={(e) => {
                                e.stopPropagation();
                                navigate(
                                  `/contacts/${contact.id}?account=${accountId}`
                                );
                              }}
                            >
                              <Eye className="h-3.5 w-3.5 mr-2" />
                              View
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={(e) => {
                                e.stopPropagation();
                                setEditContact(contact);
                              }}
                            >
                              <Pencil className="h-3.5 w-3.5 mr-2" />
                              Edit
                            </DropdownMenuItem>
                            {contact.phone && (
                              <DropdownMenuItem
                                onClick={(e) => {
                                  e.stopPropagation();
                                  startAICallMutation.mutate({ accountId: accountId!, contactId: contact.id });
                                }}
                              >
                                <PhoneForwarded className="h-3.5 w-3.5 mr-2" />
                                Start AI Call
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              onClick={(e) => {
                                e.stopPropagation();
                                setDeleteConfirm(contact);
                              }}
                              className="text-destructive focus:text-destructive"
                            >
                              <Trash2 className="h-3.5 w-3.5 mr-2" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-border/50">
            <p className="text-xs text-muted-foreground">
              Showing {page * pageSize + 1}–
              {Math.min((page + 1) * pageSize, total)} of {total}
            </p>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0"
                disabled={page === 0}
                onClick={() => setPage(page - 1)}
              >
                <ChevronLeft className="h-3.5 w-3.5" />
              </Button>
              <span className="text-xs text-muted-foreground px-2">
                {page + 1} / {totalPages}
              </span>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0"
                disabled={page >= totalPages - 1}
                onClick={() => setPage(page + 1)}
              >
                <ChevronRight className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        )}
      </Card>

      {/* Create Contact Dialog */}
      <ContactFormDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        title="New Contact"
        description="Add a new contact to this account."
        accountId={accountId!}
        members={members ?? []}
        onSubmit={(data) => createMutation.mutate(data)}
        loading={createMutation.isPending}
      />

      {/* Edit Contact Dialog */}
      {editContact && (
        <ContactFormDialog
          open={!!editContact}
          onOpenChange={(open) => !open && setEditContact(null)}
          title="Edit Contact"
          description="Update contact information."
          accountId={accountId!}
          members={members ?? []}
          defaultValues={editContact}
          onSubmit={(data) =>
            updateMutation.mutate({
              id: editContact.id,
              accountId: accountId!,
              ...data,
            })
          }
          loading={updateMutation.isPending}
        />
      )}

      {/* Delete Confirmation */}
      <Dialog
        open={!!deleteConfirm}
        onOpenChange={(open) => !open && setDeleteConfirm(null)}
      >
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Delete Contact</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete{" "}
              <strong>
                {deleteConfirm?.firstName} {deleteConfirm?.lastName}
              </strong>
              ? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteConfirm(null)}
              className="border-border/50"
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() =>
                deleteMutation.mutate({
                  id: deleteConfirm.id,
                  accountId: accountId!,
                })
              }
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
              ) : (
                <Trash2 className="h-3.5 w-3.5 mr-1.5" />
              )}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Mini stat card ───
function MiniStat({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color?: string;
}) {
  return (
    <Card className="border-border/50 bg-card">
      <CardContent className="py-3 px-4">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className={`text-lg font-semibold ${color || ""}`}>{value}</p>
      </CardContent>
    </Card>
  );
}

// ─── Contact Form Dialog (Create + Edit) ───
function ContactFormDialog({
  open,
  onOpenChange,
  title,
  description,
  accountId,
  members,
  defaultValues,
  onSubmit,
  loading,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  accountId: number;
  members: any[];
  defaultValues?: any;
  onSubmit: (data: any) => void;
  loading: boolean;
}) {
  const [firstName, setFirstName] = useState(
    defaultValues?.firstName || ""
  );
  const [lastName, setLastName] = useState(defaultValues?.lastName || "");
  const [email, setEmail] = useState(defaultValues?.email || "");
  const [phone, setPhone] = useState(defaultValues?.phone || "");
  const [phoneError, setPhoneError] = useState("");
  const [company, setCompany] = useState(defaultValues?.company || "");
  const [jobTitle, setJobTitle] = useState(defaultValues?.title || "");
  const [leadSource, setLeadSource] = useState(
    defaultValues?.leadSource || ""
  );
  const [status, setStatus] = useState(defaultValues?.status || "new");
  const [assignedUserId, setAssignedUserId] = useState(
    defaultValues?.assignedUserId ? String(defaultValues.assignedUserId) : ""
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!firstName.trim() || !lastName.trim()) {
      toast.error("First name and last name are required");
      return;
    }
    // Validate phone if provided
    const trimmedPhone = phone.trim();
    if (trimmedPhone) {
      const e164Regex = /^\+[1-9]\d{1,14}$/;
      // Try to auto-normalize US numbers
      let normalized = trimmedPhone;
      if (!e164Regex.test(normalized)) {
        const digits = normalized.replace(/\D/g, "");
        if (digits.length === 10) normalized = `+1${digits}`;
        else if (digits.length === 11 && digits.startsWith("1")) normalized = `+${digits}`;
        else if (digits.length >= 7 && digits.length <= 15) normalized = `+${digits}`;
      }
      if (!e164Regex.test(normalized)) {
        setPhoneError("Phone must be E.164 format (e.g., +15551234567)");
        toast.error("Phone must be in E.164 format (e.g., +15551234567)");
        return;
      }
      setPhone(normalized);
    }
    setPhoneError("");
    const data: any = {
      accountId,
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      email: email.trim() || undefined,
      phone: trimmedPhone ? phone.trim() : undefined,
      company: company.trim() || undefined,
      title: jobTitle.trim() || undefined,
      leadSource: leadSource || undefined,
      status: status as any,
    };
    if (assignedUserId) {
      data.assignedUserId = parseInt(assignedUserId);
    }
    onSubmit(data);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">First Name *</Label>
              <Input
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder="John"
                className="h-9 text-sm"
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Last Name *</Label>
              <Input
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                placeholder="Doe"
                className="h-9 text-sm"
                required
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Email</Label>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="john@example.com"
                className="h-9 text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Phone</Label>
              <Input
                value={phone}
                onChange={(e) => {
                  setPhone(e.target.value);
                  setPhoneError("");
                }}
                placeholder="+15551234567"
                className={`h-9 text-sm ${phoneError ? "border-red-500" : ""}`}
              />
              {phoneError && (
                <p className="text-xs text-red-500">{phoneError}</p>
              )}
              <p className="text-xs text-muted-foreground">E.164 format: +1 followed by 10 digits</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Company</Label>
              <Input
                value={company}
                onChange={(e) => setCompany(e.target.value)}
                placeholder="Acme Corp"
                className="h-9 text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Job Title</Label>
              <Input
                value={jobTitle}
                onChange={(e) => setJobTitle(e.target.value)}
                placeholder="Loan Officer"
                className="h-9 text-sm"
              />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Status</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUSES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s.charAt(0).toUpperCase() + s.slice(1)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Lead Source</Label>
              <Select
                value={leadSource || "none"}
                onValueChange={(v) => setLeadSource(v === "none" ? "" : v)}
              >
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue placeholder="Select" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {LEAD_SOURCES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Assign To</Label>
              <Select
                value={assignedUserId || "unassigned"}
                onValueChange={(v) =>
                  setAssignedUserId(v === "unassigned" ? "" : v)
                }
              >
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue placeholder="Unassigned" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="unassigned">Unassigned</SelectItem>
                  {members.map((m) => (
                    <SelectItem key={m.userId} value={String(m.userId)}>
                      {m.userName || m.userEmail}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="border-border/50"
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading && (
                <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
              )}
              {defaultValues ? "Save Changes" : "Create Contact"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
