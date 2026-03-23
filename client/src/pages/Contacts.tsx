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
import { useState } from "react";
import { useLocation } from "wouter";
import { toast } from "sonner";
import { useAccount } from "@/contexts/AccountContext";
import { NoAccountSelected } from "@/components/NoAccountSelected";

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
  new: "bg-blue-50 text-blue-700 border-blue-200",
  contacted: "bg-amber-50 text-amber-700 border-amber-200",
  qualified: "bg-emerald-50 text-emerald-700 border-emerald-200",
  proposal: "bg-purple-50 text-purple-700 border-purple-200",
  negotiation: "bg-orange-50 text-orange-700 border-orange-200",
  won: "bg-green-50 text-green-700 border-green-200",
  lost: "bg-red-50 text-red-700 border-red-200",
  nurture: "bg-cyan-50 text-cyan-700 border-cyan-200",
};

const LEAD_SOURCES = [
  "Facebook",
  "Instagram",
  "Google Ads",
  "TikTok",
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
  const { currentAccountId: accountId, isLoading: accountsLoading, accounts: userAccounts } = useAccount();

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

  if (!accountId) {
    return <NoAccountSelected />;
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[28px] font-bold tracking-tight text-foreground">Contacts</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {total} contact{total !== 1 ? "s" : ""} in this account
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Account selector removed — use sidebar AccountSwitcher instead */}
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
          <MiniStat label="New" value={stats.new} color="text-blue-600" />
          <MiniStat
            label="Qualified"
            value={stats.qualified}
            color="text-emerald-600"
          />
          <MiniStat label="Won" value={stats.won} color="text-green-600" />
        </div>
      )}

      {/* Search & Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
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
        <div className="flex flex-wrap items-center gap-3 p-3 rounded-lg bg-card border border-border/50">
          <Select
            value={statusFilter || "all"}
            onValueChange={(v) => {
              setStatusFilter(v === "all" ? "" : v);
              setPage(0);
            }}
          >
            <SelectTrigger className="w-full sm:w-[150px] h-8 text-xs">
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
            <SelectTrigger className="w-full sm:w-[150px] h-8 text-xs">
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
      <Card className="bg-white border-0 card-shadow overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-secondary hover:bg-secondary border-b border-border">
                <TableHead className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                  Name
                </TableHead>
                <TableHead className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                  Email
                </TableHead>
                <TableHead className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                  Phone
                </TableHead>
                <TableHead className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                  Status
                </TableHead>
                <TableHead className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                  Source
                </TableHead>
                <TableHead className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                  Assigned To
                </TableHead>
                <TableHead className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider w-[50px]">
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
                      className="border-b border-border/50 cursor-pointer hover:bg-accent h-14"
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
    <Card className="bg-white border-0 card-shadow">
      <CardContent className="py-3 px-4">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{label}</p>
        <p className={`text-lg font-bold ${color || "text-foreground"}`}>{value}</p>
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
