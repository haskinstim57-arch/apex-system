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

          {/* Communication History */}
          <CommunicationHistory contactId={id} accountId={accountId} />
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

function CommunicationHistory({
  contactId,
  accountId,
}: {
  contactId: number;
  accountId: number;
}) {
  const { data: messages, isLoading } = trpc.messages.byContact.useQuery(
    { contactId, accountId },
    { enabled: !!accountId && !!contactId }
  );

  return (
    <Card className="border-border/50 bg-card">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <MessageSquare className="h-3.5 w-3.5" />
          Communication History
          {messages && messages.length > 0 && (
            <Badge variant="secondary" className="text-[10px] ml-1">
              {messages.length}
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center py-6">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : !messages || messages.length === 0 ? (
          <div className="text-center py-6">
            <Send className="h-6 w-6 mx-auto mb-2 text-muted-foreground/50" />
            <p className="text-sm text-muted-foreground">
              No messages yet. Send an email or SMS from the Messages page.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {messages.map((msg: any) => (
              <div
                key={msg.id}
                className="flex items-start gap-3 p-3 rounded-lg border border-border/30 bg-muted/20 hover:bg-muted/30 transition-colors"
              >
                <div className="shrink-0 mt-0.5">
                  {msg.direction === "outbound" ? (
                    <div className="p-1.5 rounded-md bg-blue-500/10">
                      <ArrowUpRight className="h-3.5 w-3.5 text-blue-400" />
                    </div>
                  ) : (
                    <div className="p-1.5 rounded-md bg-emerald-500/10">
                      <ArrowDownLeft className="h-3.5 w-3.5 text-emerald-400" />
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <Badge
                      variant="outline"
                      className={`text-[9px] ${
                        msg.type === "email"
                          ? "bg-blue-500/10 text-blue-400 border-blue-500/30"
                          : "bg-purple-500/10 text-purple-400 border-purple-500/30"
                      }`}
                    >
                      {msg.type === "email" ? (
                        <Mail className="h-2.5 w-2.5 mr-0.5" />
                      ) : (
                        <Phone className="h-2.5 w-2.5 mr-0.5" />
                      )}
                      {msg.type.toUpperCase()}
                    </Badge>
                    <Badge
                      variant="outline"
                      className={`text-[9px] ${MSG_STATUS_COLORS[msg.status] || ""}`}
                    >
                      {msg.status}
                    </Badge>
                    <span className="text-[10px] text-muted-foreground ml-auto">
                      {new Date(msg.createdAt).toLocaleString()}
                    </span>
                  </div>
                  {msg.subject && (
                    <p className="text-xs font-medium mb-0.5">{msg.subject}</p>
                  )}
                  <p className="text-xs text-muted-foreground line-clamp-2">
                    {msg.body}
                  </p>
                  <p className="text-[10px] text-muted-foreground mt-1">
                    {msg.direction === "outbound" ? "To: " : "From: "}
                    {msg.direction === "outbound"
                      ? msg.toAddress
                      : msg.fromAddress}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
