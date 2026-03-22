import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
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
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import {
  ArrowLeft,
  ArrowDownLeft,
  ArrowUpRight,
  Building2,
  Calendar,
  Loader2,
  Mail,
  MapPin,
  MessageSquare,
  MoreHorizontal,
  Pencil,
  Phone,
  PhoneForwarded,
  Pin,
  PinOff,
  Plus,
  Send,
  Tag,
  Trash2,
  User,
  UserPlus,
  X,
  Briefcase,
  Clock,
  GitBranch,
  Zap,
  CheckCircle2,
  XCircle,
  PhoneCall,
  ChevronDown,
  History,
} from "lucide-react";
import { useState } from "react";
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

export default function ContactDetail({
  id,
  accountId,
}: {
  id: number;
  accountId: number;
}) {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const utils = trpc.useUtils();

  // Data queries
  const {
    data: contact,
    isLoading,
    error,
  } = trpc.contacts.get.useQuery({ id, accountId });

  const { data: tags } = trpc.contacts.getTags.useQuery(
    { contactId: id, accountId },
    { enabled: !!contact }
  );

  const { data: notes } = trpc.contacts.listNotes.useQuery(
    { contactId: id, accountId },
    { enabled: !!contact }
  );

  const { data: members } = trpc.members.list.useQuery(
    { accountId },
    { enabled: !!contact }
  );

  // State
  const [editOpen, setEditOpen] = useState(false);
  const [newTag, setNewTag] = useState("");
  const [newNote, setNewNote] = useState("");

  // Mutations
  const updateMutation = trpc.contacts.update.useMutation({
    onSuccess: () => {
      toast.success("Contact updated");
      utils.contacts.get.invalidate({ id, accountId });
      setEditOpen(false);
    },
    onError: (err) => toast.error(err.message),
  });

  const assignMutation = trpc.contacts.assign.useMutation({
    onSuccess: () => {
      toast.success("Contact reassigned");
      utils.contacts.get.invalidate({ id, accountId });
    },
    onError: (err) => toast.error(err.message),
  });

  const addTagMutation = trpc.contacts.addTag.useMutation({
    onSuccess: () => {
      utils.contacts.getTags.invalidate({ contactId: id, accountId });
      setNewTag("");
    },
    onError: (err) => toast.error(err.message),
  });

  const removeTagMutation = trpc.contacts.removeTag.useMutation({
    onSuccess: () => {
      utils.contacts.getTags.invalidate({ contactId: id, accountId });
    },
    onError: (err) => toast.error(err.message),
  });

  const addNoteMutation = trpc.contacts.addNote.useMutation({
    onSuccess: () => {
      toast.success("Note added");
      utils.contacts.listNotes.invalidate({ contactId: id, accountId });
      setNewNote("");
    },
    onError: (err) => toast.error(err.message),
  });

  const updateNoteMutation = trpc.contacts.updateNote.useMutation({
    onSuccess: () => {
      utils.contacts.listNotes.invalidate({ contactId: id, accountId });
    },
    onError: (err) => toast.error(err.message),
  });

  const deleteNoteMutation = trpc.contacts.deleteNote.useMutation({
    onSuccess: () => {
      toast.success("Note deleted");
      utils.contacts.listNotes.invalidate({ contactId: id, accountId });
    },
    onError: (err) => toast.error(err.message),
  });

  const startAICallMutation = trpc.aiCalls.start.useMutation({
    onSuccess: () => {
      toast.success("AI call initiated successfully");
    },
    onError: (err) => toast.error(err.message),
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !contact) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-center">
        <p className="text-muted-foreground mb-4">Contact not found.</p>
        <Button variant="outline" onClick={() => navigate("/contacts")}>
          <ArrowLeft className="h-3.5 w-3.5 mr-1.5" />
          Back to Contacts
        </Button>
      </div>
    );
  }

  const assignedMember = members?.find(
    (m) => m.userId === contact.assignedUserId
  );

  return (
    <div className="space-y-6">
      {/* Back + Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-4">
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0 mt-1"
            onClick={() => navigate("/contacts")}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-semibold tracking-tight">
                {contact.firstName} {contact.lastName}
              </h1>
              <Badge
                variant="outline"
                className={`text-[10px] font-medium ${STATUS_COLORS[contact.status] || ""}`}
              >
                {contact.status}
              </Badge>
            </div>
            {contact.company && (
              <p className="text-sm text-muted-foreground mt-0.5">
                {contact.title ? `${contact.title} at ` : ""}
                {contact.company}
              </p>
            )}
            <p className="text-xs text-muted-foreground mt-1">
              Added {new Date(contact.createdAt).toLocaleDateString()}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {contact.phone && (
            <Button
              variant="outline"
              size="sm"
              className="h-8 gap-1.5 border-primary/30 text-primary hover:bg-primary/10"
              disabled={startAICallMutation.isPending}
              onClick={() => {
                if (accountId) {
                  startAICallMutation.mutate({ accountId, contactId: contact.id });
                }
              }}
            >
              {startAICallMutation.isPending ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <PhoneForwarded className="h-3 w-3" />
              )}
              AI Call
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            className="h-8 gap-1.5 border-border/50"
            onClick={() => setEditOpen(true)}
          >
            <Pencil className="h-3 w-3" />
            Edit
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column — Contact Info */}
        <div className="lg:col-span-1 space-y-4">
          {/* Contact Details Card */}
          <Card className="border-border/50 bg-card">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">
                Contact Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <InfoRow
                icon={Mail}
                label="Email"
                value={contact.email || "—"}
              />
              <InfoRow
                icon={Phone}
                label="Phone"
                value={contact.phone || "—"}
              />
              <InfoRow
                icon={Building2}
                label="Company"
                value={contact.company || "—"}
              />
              <InfoRow
                icon={Briefcase}
                label="Title"
                value={contact.title || "—"}
              />
              <Separator className="bg-border/50" />
              <InfoRow
                icon={MapPin}
                label="Address"
                value={
                  [contact.address, contact.city, contact.state, contact.zip]
                    .filter(Boolean)
                    .join(", ") || "—"
                }
              />
              <InfoRow
                icon={Calendar}
                label="Lead Source"
                value={contact.leadSource || "—"}
              />
            </CardContent>
          </Card>

          {/* Assignment Card */}
          <Card className="border-border/50 bg-card">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">
                Assigned To
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Select
                value={
                  contact.assignedUserId
                    ? String(contact.assignedUserId)
                    : "unassigned"
                }
                onValueChange={(v) => {
                  assignMutation.mutate({
                    id: contact.id,
                    accountId,
                    assignedUserId:
                      v === "unassigned" ? null : parseInt(v),
                  });
                }}
              >
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue placeholder="Unassigned" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="unassigned">Unassigned</SelectItem>
                  {members?.map((m) => (
                    <SelectItem key={m.userId} value={String(m.userId)}>
                      {m.userName || m.userEmail}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </CardContent>
          </Card>

          {/* Tags Card */}
          <Card className="border-border/50 bg-card">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Tag className="h-3.5 w-3.5" />
                Tags
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex flex-wrap gap-1.5">
                {tags?.map((t) => (
                  <Badge
                    key={t.tag}
                    variant="secondary"
                    className="text-xs gap-1 pr-1"
                  >
                    {t.tag}
                    <button
                      onClick={() =>
                        removeTagMutation.mutate({
                          contactId: id,
                          accountId,
                          tag: t.tag,
                        })
                      }
                      className="ml-0.5 hover:text-destructive"
                    >
                      <X className="h-2.5 w-2.5" />
                    </button>
                  </Badge>
                ))}
                {(!tags || tags.length === 0) && (
                  <p className="text-xs text-muted-foreground">No tags</p>
                )}
              </div>
              <div className="flex gap-1.5">
                <Input
                  value={newTag}
                  onChange={(e) => setNewTag(e.target.value)}
                  placeholder="Add tag..."
                  className="h-8 text-xs flex-1"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && newTag.trim()) {
                      e.preventDefault();
                      addTagMutation.mutate({
                        contactId: id,
                        accountId,
                        tag: newTag.trim(),
                      });
                    }
                  }}
                />
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 w-8 p-0 border-border/50"
                  disabled={!newTag.trim()}
                  onClick={() => {
                    if (newTag.trim()) {
                      addTagMutation.mutate({
                        contactId: id,
                        accountId,
                        tag: newTag.trim(),
                      });
                    }
                  }}
                >
                  <Plus className="h-3 w-3" />
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Column — Notes + Activity */}
        <div className="lg:col-span-2 space-y-4">
          {/* Add Note */}
          <Card className="border-border/50 bg-card">
            <CardContent className="pt-4 pb-3">
              <div className="space-y-2">
                <Textarea
                  value={newNote}
                  onChange={(e) => setNewNote(e.target.value)}
                  placeholder="Write a note about this contact..."
                  className="min-h-[80px] text-sm resize-none bg-muted/30 border-border/50"
                />
                <div className="flex justify-end">
                  <Button
                    size="sm"
                    className="h-8 gap-1.5"
                    disabled={!newNote.trim() || addNoteMutation.isPending}
                    onClick={() => {
                      if (newNote.trim()) {
                        addNoteMutation.mutate({
                          contactId: id,
                          accountId,
                          content: newNote.trim(),
                        });
                      }
                    }}
                  >
                    {addNoteMutation.isPending && (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    )}
                    Add Note
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Notes List */}
          <div className="space-y-3">
            <h3 className="text-sm font-medium text-muted-foreground">
              Notes ({notes?.length || 0})
            </h3>
            {notes && notes.length > 0 ? (
              notes.map((note) => (
                <Card
                  key={note.id}
                  className={`border-border/50 bg-card ${note.isPinned ? "border-primary/30" : ""}`}
                >
                  <CardContent className="pt-3 pb-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        {note.isPinned && (
                          <Badge
                            variant="outline"
                            className="text-[9px] mb-2 border-primary/30 text-primary"
                          >
                            <Pin className="h-2.5 w-2.5 mr-0.5" />
                            Pinned
                          </Badge>
                        )}
                        <p className="text-sm whitespace-pre-wrap">
                          {note.content}
                        </p>
                        <div className="flex items-center gap-2 mt-2">
                          <p className="text-[10px] text-muted-foreground">
                            {note.authorName || "Unknown"} &middot;{" "}
                            {new Date(note.createdAt).toLocaleString()}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-0.5 shrink-0">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0"
                          onClick={() =>
                            updateNoteMutation.mutate({
                              noteId: note.id,
                              accountId,
                              isPinned: !note.isPinned,
                            })
                          }
                        >
                          {note.isPinned ? (
                            <PinOff className="h-3 w-3 text-primary" />
                          ) : (
                            <Pin className="h-3 w-3 text-muted-foreground" />
                          )}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                          onClick={() =>
                            deleteNoteMutation.mutate({
                              noteId: note.id,
                              accountId,
                            })
                          }
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            ) : (
              <Card className="border-border/50 bg-card">
                <CardContent className="py-8 text-center">
                  <p className="text-sm text-muted-foreground">
                    No notes yet. Add a note above to get started.
                  </p>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Activity Timeline */}
          <ActivityTimeline contactId={id} accountId={accountId} />
        </div>
      </div>

      {/* Edit Dialog */}
      <EditContactDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        contact={contact}
        accountId={accountId}
        members={members ?? []}
        onSubmit={(data) =>
          updateMutation.mutate({ id: contact.id, accountId, ...data })
        }
        loading={updateMutation.isPending}
      />
    </div>
  );
}

function InfoRow({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <Icon className="h-3.5 w-3.5 text-muted-foreground mt-0.5 shrink-0" />
      <div className="min-w-0">
        <p className="text-[10px] text-muted-foreground uppercase tracking-wider">
          {label}
        </p>
        <p className="text-sm truncate">{value}</p>
      </div>
    </div>
  );
}

function EditContactDialog({
  open,
  onOpenChange,
  contact,
  accountId,
  members,
  onSubmit,
  loading,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contact: any;
  accountId: number;
  members: any[];
  onSubmit: (data: any) => void;
  loading: boolean;
}) {
  const [firstName, setFirstName] = useState(contact.firstName);
  const [lastName, setLastName] = useState(contact.lastName);
  const [email, setEmail] = useState(contact.email || "");
  const [phone, setPhone] = useState(contact.phone || "");
  const [company, setCompany] = useState(contact.company || "");
  const [jobTitle, setJobTitle] = useState(contact.title || "");
  const [leadSource, setLeadSource] = useState(contact.leadSource || "");
  const [status, setStatus] = useState(contact.status);
  const [address, setAddress] = useState(contact.address || "");
  const [city, setCity] = useState(contact.city || "");
  const [state, setState] = useState(contact.state || "");
  const [zip, setZip] = useState(contact.zip || "");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!firstName.trim() || !lastName.trim()) {
      toast.error("First name and last name are required");
      return;
    }
    onSubmit({
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      email: email.trim() || undefined,
      phone: phone.trim() || undefined,
      company: company.trim() || null,
      title: jobTitle.trim() || null,
      leadSource: leadSource || null,
      status,
      address: address.trim() || null,
      city: city.trim() || null,
      state: state.trim() || null,
      zip: zip.trim() || null,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle>Edit Contact</DialogTitle>
          <DialogDescription>
            Update contact information for {contact.firstName}{" "}
            {contact.lastName}.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">First Name *</Label>
              <Input
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                className="h-9 text-sm"
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Last Name *</Label>
              <Input
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
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
                className="h-9 text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Phone</Label>
              <Input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="h-9 text-sm"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Company</Label>
              <Input
                value={company}
                onChange={(e) => setCompany(e.target.value)}
                className="h-9 text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Job Title</Label>
              <Input
                value={jobTitle}
                onChange={(e) => setJobTitle(e.target.value)}
                className="h-9 text-sm"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
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
          </div>
          <Separator className="bg-border/50" />
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5 col-span-2">
              <Label className="text-xs">Address</Label>
              <Input
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                className="h-9 text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">City</Label>
              <Input
                value={city}
                onChange={(e) => setCity(e.target.value)}
                className="h-9 text-sm"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">State</Label>
                <Input
                  value={state}
                  onChange={(e) => setState(e.target.value)}
                  className="h-9 text-sm"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">ZIP</Label>
                <Input
                  value={zip}
                  onChange={(e) => setZip(e.target.value)}
                  className="h-9 text-sm"
                />
              </div>
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
              Save Changes
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

const MSG_STATUS_COLORS: Record<string, string> = {
  pending: "bg-amber-500/15 text-amber-400 border-amber-500/30",
  sent: "bg-blue-500/15 text-blue-400 border-blue-500/30",
  delivered: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  failed: "bg-red-500/15 text-red-400 border-red-500/30",
  bounced: "bg-orange-500/15 text-orange-400 border-orange-500/30",
};

// ─── Activity Timeline ───

const ACTIVITY_ICONS: Record<string, { icon: React.ElementType; color: string; bg: string }> = {
  contact_created: { icon: UserPlus, color: "text-emerald-400", bg: "bg-emerald-500/15" },
  tag_added: { icon: Tag, color: "text-blue-400", bg: "bg-blue-500/15" },
  tag_removed: { icon: Tag, color: "text-orange-400", bg: "bg-orange-500/15" },
  pipeline_stage_changed: { icon: GitBranch, color: "text-purple-400", bg: "bg-purple-500/15" },
  message_sent: { icon: ArrowUpRight, color: "text-blue-400", bg: "bg-blue-500/15" },
  message_received: { icon: ArrowDownLeft, color: "text-emerald-400", bg: "bg-emerald-500/15" },
  ai_call_made: { icon: PhoneCall, color: "text-amber-400", bg: "bg-amber-500/15" },
  appointment_booked: { icon: Calendar, color: "text-cyan-400", bg: "bg-cyan-500/15" },
  appointment_confirmed: { icon: CheckCircle2, color: "text-emerald-400", bg: "bg-emerald-500/15" },
  appointment_cancelled: { icon: XCircle, color: "text-red-400", bg: "bg-red-500/15" },
  automation_triggered: { icon: Zap, color: "text-yellow-400", bg: "bg-yellow-500/15" },
  note_added: { icon: Pencil, color: "text-slate-400", bg: "bg-slate-500/15" },
  task_created: { icon: CheckCircle2, color: "text-indigo-400", bg: "bg-indigo-500/15" },
  task_completed: { icon: CheckCircle2, color: "text-emerald-400", bg: "bg-emerald-500/15" },
};

const DEFAULT_ICON = { icon: Clock, color: "text-muted-foreground", bg: "bg-muted" };

function ActivityTimeline({
  contactId,
  accountId,
}: {
  contactId: number;
  accountId: number;
}) {
  const [limit] = useState(25);
  const [offset, setOffset] = useState(0);

  const { data, isLoading } = trpc.contacts.getActivity.useQuery(
    { contactId, accountId, limit, offset },
    { enabled: !!accountId && !!contactId }
  );

  const activities = data?.items || [];
  const hasMore = data?.hasMore || false;

  function formatTimeAgo(dateStr: string | Date) {
    const d = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    if (diffMin < 1) return "Just now";
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHr = Math.floor(diffMin / 60);
    if (diffHr < 24) return `${diffHr}h ago`;
    const diffDay = Math.floor(diffHr / 24);
    if (diffDay < 7) return `${diffDay}d ago`;
    return d.toLocaleDateString();
  }

  function getMetadata(activity: any) {
    if (!activity.metadata) return null;
    try {
      return typeof activity.metadata === "string"
        ? JSON.parse(activity.metadata)
        : activity.metadata;
    } catch {
      return null;
    }
  }

  return (
    <Card className="border-border/50 bg-card">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <History className="h-3.5 w-3.5" />
          Activity Timeline
          {activities.length > 0 && (
            <Badge variant="secondary" className="text-[10px] ml-1">
              {activities.length}{hasMore ? "+" : ""}
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center py-6">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : activities.length === 0 ? (
          <div className="text-center py-6">
            <History className="h-6 w-6 mx-auto mb-2 text-muted-foreground/50" />
            <p className="text-sm text-muted-foreground">
              No activity recorded yet.
            </p>
          </div>
        ) : (
          <div className="relative">
            {/* Vertical line */}
            <div className="absolute left-[15px] top-2 bottom-2 w-px bg-border/50" />

            <div className="space-y-0">
              {activities.map((activity: any, idx: number) => {
                const config = ACTIVITY_ICONS[activity.activityType] || DEFAULT_ICON;
                const IconComponent = config.icon;
                const meta = getMetadata(activity);
                const isLast = idx === activities.length - 1;

                return (
                  <div
                    key={activity.id}
                    className={`relative flex items-start gap-3 py-3 ${!isLast ? "" : ""}`}
                  >
                    {/* Icon */}
                    <div
                      className={`relative z-10 shrink-0 p-1.5 rounded-full ${config.bg} border border-border/30`}
                    >
                      <IconComponent className={`h-3.5 w-3.5 ${config.color}`} />
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0 pt-0.5">
                      <p className="text-xs leading-relaxed">
                        {activity.description}
                      </p>

                      {/* Extra metadata badges */}
                      {meta && (
                        <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                          {meta.channel && (
                            <Badge
                              variant="outline"
                              className={`text-[9px] ${
                                meta.channel === "email"
                                  ? "bg-blue-500/10 text-blue-400 border-blue-500/30"
                                  : "bg-purple-500/10 text-purple-400 border-purple-500/30"
                              }`}
                            >
                              {meta.channel === "email" ? (
                                <Mail className="h-2.5 w-2.5 mr-0.5" />
                              ) : (
                                <Phone className="h-2.5 w-2.5 mr-0.5" />
                              )}
                              {meta.channel.toUpperCase()}
                            </Badge>
                          )}
                          {meta.direction && (
                            <Badge
                              variant="outline"
                              className={`text-[9px] ${
                                meta.direction === "inbound"
                                  ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                                  : "bg-blue-500/10 text-blue-400 border-blue-500/30"
                              }`}
                            >
                              {meta.direction === "inbound" ? (
                                <ArrowDownLeft className="h-2.5 w-2.5 mr-0.5" />
                              ) : (
                                <ArrowUpRight className="h-2.5 w-2.5 mr-0.5" />
                              )}
                              {meta.direction}
                            </Badge>
                          )}
                          {meta.fromStage && meta.toStage && (
                            <Badge
                              variant="outline"
                              className="text-[9px] bg-purple-500/10 text-purple-400 border-purple-500/30"
                            >
                              {meta.fromStage} → {meta.toStage}
                            </Badge>
                          )}
                          {meta.tag && (
                            <Badge
                              variant="outline"
                              className="text-[9px] bg-blue-500/10 text-blue-400 border-blue-500/30"
                            >
                              <Tag className="h-2.5 w-2.5 mr-0.5" />
                              {meta.tag}
                            </Badge>
                          )}
                          {meta.workflowName && (
                            <Badge
                              variant="outline"
                              className="text-[9px] bg-yellow-500/10 text-yellow-400 border-yellow-500/30"
                            >
                              <Zap className="h-2.5 w-2.5 mr-0.5" />
                              {meta.workflowName}
                            </Badge>
                          )}
                          {meta.preview && (
                            <p className="text-[10px] text-muted-foreground line-clamp-1 w-full mt-0.5">
                              "{meta.preview}"
                            </p>
                          )}
                        </div>
                      )}

                      <p className="text-[10px] text-muted-foreground mt-1">
                        {formatTimeAgo(activity.createdAt)}
                        <span className="mx-1">&middot;</span>
                        {new Date(activity.createdAt).toLocaleString()}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Load More */}
            {hasMore && (
              <div className="flex justify-center pt-3">
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-xs gap-1.5 text-muted-foreground hover:text-foreground"
                  onClick={() => setOffset((prev) => prev + limit)}
                >
                  <ChevronDown className="h-3.5 w-3.5" />
                  Load more activity
                </Button>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
