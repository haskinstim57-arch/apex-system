import { useState, useMemo, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { useAccount } from "@/contexts/AccountContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { toast } from "sonner";
import {
  Plus,
  MoreVertical,
  Mail,
  MessageSquare,
  Clock,
  Play,
  Pause,
  Trash2,
  Edit,
  Users,
  ArrowUp,
  ArrowDown,
  ChevronLeft,
  Zap,
  Send,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Settings2,
  Copy,
  TrendingUp,
  Activity,
} from "lucide-react";

// ─── Types ───
interface SequenceStep {
  id: number;
  sequenceId: number;
  position: number;
  delayDays: number;
  delayHours: number;
  messageType: "sms" | "email";
  subject: string | null;
  content: string;
  templateId: number | null;
}

interface Sequence {
  id: number;
  accountId: number;
  name: string;
  description: string | null;
  status: "active" | "paused" | "draft" | "archived";
  stepCount: number;
  activeEnrollments: number;
  completedCount: number;
  steps?: SequenceStep[];
}

// ─── Helper: detect template sequences ───
function isTemplate(name: string): boolean {
  return name.includes("[TEMPLATE]");
}

// ─── Main Component ───
export default function Sequences() {
  const { user } = useAuth();
  const { currentAccountId: accountId } = useAccount();

  const [view, setView] = useState<"list" | "builder">("list");
  const [selectedSequenceId, setSelectedSequenceId] = useState<number | null>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState<number | null>(null);
  // pendingConfigureId: after cloning a template, auto-open Configure dialog
  const [pendingConfigureId, setPendingConfigureId] = useState<number | null>(null);

  // ─── Queries ───
  const { data: sequences = [], isLoading } = trpc.sequences.list.useQuery(
    { accountId: accountId! },
    { enabled: !!accountId }
  );

  const utils = trpc.useUtils();

  // ─── Mutations ───
  const createMutation = trpc.sequences.create.useMutation({
    onSuccess: (data) => {
      utils.sequences.list.invalidate();
      setShowCreateDialog(false);
      setSelectedSequenceId(data.id);
      setView("builder");
      toast.success("Sequence created — now add steps to your drip sequence.");
    },
  });

  const updateMutation = trpc.sequences.update.useMutation({
    onSuccess: () => {
      utils.sequences.list.invalidate();
      if (selectedSequenceId) utils.sequences.get.invalidate({ id: selectedSequenceId, accountId: accountId! });
    },
  });

  const deleteMutation = trpc.sequences.delete.useMutation({
    onSuccess: () => {
      utils.sequences.list.invalidate();
      setShowDeleteDialog(null);
      if (view === "builder") {
        setView("list");
        setSelectedSequenceId(null);
      }
      toast.success("Sequence deleted");
    },
  });

  // ─── Clone Mutation ───
  const cloneMutation = trpc.sequences.clone.useMutation({
    onSuccess: (data) => {
      utils.sequences.list.invalidate();
      toast.success(`Cloned as "${data.name}" — it's in Draft status`);
      setSelectedSequenceId(data.id);
      setView("builder");
      // If the original was a template, auto-open configure dialog
      if (data.isTemplate) {
        setPendingConfigureId(data.id);
      }
    },
  });

  // ─── Stats ───
  const stats = useMemo(() => {
    const total = sequences.length;
    const active = sequences.filter((s: Sequence) => s.status === "active").length;
    const totalEnrolled = sequences.reduce((sum: number, s: Sequence) => sum + s.activeEnrollments, 0);
    const totalCompleted = sequences.reduce((sum: number, s: Sequence) => sum + s.completedCount, 0);
    return { total, active, totalEnrolled, totalCompleted };
  }, [sequences]);

  if (!accountId) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        Select a sub-account to manage sequences.
      </div>
    );
  }

  if (view === "builder" && selectedSequenceId) {
    return (
      <SequenceBuilder
        sequenceId={selectedSequenceId}
        accountId={accountId}
        pendingConfigureId={pendingConfigureId}
        onClearPendingConfigure={() => setPendingConfigureId(null)}
        onBack={() => {
          setView("list");
          setSelectedSequenceId(null);
          setPendingConfigureId(null);
        }}
        onClone={(seqId: number) => {
          cloneMutation.mutate({ sequenceId: seqId, accountId });
        }}
        isCloning={cloneMutation.isPending}
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Drip Sequences</h1>
          <p className="text-muted-foreground mt-1">
            Automated email & SMS drip campaigns that nurture contacts over time
          </p>
        </div>
        <Button onClick={() => setShowCreateDialog(true)}>
          <Plus className="h-4 w-4 mr-2" />
          New Sequence
        </Button>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="text-sm text-muted-foreground">Total Sequences</div>
            <div className="text-2xl font-bold">{stats.total}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="text-sm text-muted-foreground">Active</div>
            <div className="text-2xl font-bold text-green-600">{stats.active}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="text-sm text-muted-foreground">Enrolled Contacts</div>
            <div className="text-2xl font-bold text-blue-600">{stats.totalEnrolled}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="text-sm text-muted-foreground">Completed</div>
            <div className="text-2xl font-bold text-purple-600">{stats.totalCompleted}</div>
          </CardContent>
        </Card>
      </div>

      {/* Sequence List */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="h-24" />
            </Card>
          ))}
        </div>
      ) : sequences.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
              <Zap className="h-8 w-8 text-primary" />
            </div>
            <h3 className="text-lg font-semibold mb-2">No sequences yet</h3>
            <p className="text-muted-foreground max-w-md mb-4">
              Create your first drip sequence to automatically nurture contacts with timed email and SMS messages.
            </p>
            <Button onClick={() => setShowCreateDialog(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Create First Sequence
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {sequences.map((seq: Sequence) => (
            <Card
              key={seq.id}
              className="cursor-pointer hover:border-primary/30 transition-colors"
              onClick={() => {
                setSelectedSequenceId(seq.id);
                setView("builder");
              }}
            >
              <CardContent className="flex items-center justify-between py-4">
                <div className="flex items-center gap-4 min-w-0">
                  <div
                    className={`h-10 w-10 rounded-lg flex items-center justify-center shrink-0 ${
                      seq.status === "active"
                        ? "bg-green-500/10 text-green-600"
                        : seq.status === "paused"
                        ? "bg-yellow-500/10 text-yellow-600"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    <Send className="h-5 w-5" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold truncate">{seq.name}</h3>
                      <StatusBadge status={seq.status} />
                      {isTemplate(seq.name) && (
                        <Badge className="bg-yellow-500/15 text-yellow-600 border-yellow-300 text-[10px] px-1.5 py-0">
                          TEMPLATE
                        </Badge>
                      )}
                    </div>
                    {seq.description && (
                      <p className="text-sm text-muted-foreground truncate mt-0.5">
                        {seq.description}
                      </p>
                    )}
                    <div className="flex items-center gap-4 mt-1 text-xs text-muted-foreground">
                      <span>{seq.stepCount} step{seq.stepCount !== 1 ? "s" : ""}</span>
                      <span>{seq.activeEnrollments} enrolled</span>
                      <span>{seq.completedCount} completed</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      {seq.status === "active" ? (
                        <DropdownMenuItem
                          onClick={(e) => {
                            e.stopPropagation();
                            updateMutation.mutate({ id: seq.id, accountId, status: "paused" });
                          }}
                        >
                          <Pause className="h-4 w-4 mr-2" />
                          Pause
                        </DropdownMenuItem>
                      ) : (
                        <DropdownMenuItem
                          onClick={(e) => {
                            e.stopPropagation();
                            updateMutation.mutate({ id: seq.id, accountId, status: "active" });
                          }}
                        >
                          <Play className="h-4 w-4 mr-2" />
                          Activate
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuItem
                        onClick={(e) => {
                          e.stopPropagation();
                          cloneMutation.mutate({ sequenceId: seq.id, accountId });
                        }}
                        disabled={cloneMutation.isPending}
                      >
                        <Copy className="h-4 w-4 mr-2" />
                        Clone Sequence
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        className="text-destructive"
                        onClick={(e) => {
                          e.stopPropagation();
                          setShowDeleteDialog(seq.id);
                        }}
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create Dialog */}
      <CreateSequenceDialog
        open={showCreateDialog}
        onClose={() => setShowCreateDialog(false)}
        onSubmit={(name, description) => {
          createMutation.mutate({ accountId, name, description });
        }}
        isLoading={createMutation.isPending}
      />

      {/* Delete Confirmation */}
      <AlertDialog open={!!showDeleteDialog} onOpenChange={() => setShowDeleteDialog(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Sequence?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the sequence, all its steps, and unenroll all contacts. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (showDeleteDialog) deleteMutation.mutate({ id: showDeleteDialog, accountId });
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ─── Status Badge ───
function StatusBadge({ status }: { status: string }) {
  const config: Record<string, { label: string; className: string }> = {
    active: { label: "Active", className: "bg-green-500/10 text-green-700 border-green-200" },
    paused: { label: "Paused", className: "bg-yellow-500/10 text-yellow-700 border-yellow-200" },
    draft: { label: "Draft", className: "bg-muted text-muted-foreground" },
    archived: { label: "Archived", className: "bg-muted text-muted-foreground" },
  };
  const c = config[status] || config.draft;
  return <Badge variant="outline" className={c.className}>{c.label}</Badge>;
}

// ─── Create Dialog ───
function CreateSequenceDialog({
  open,
  onClose,
  onSubmit,
  isLoading,
}: {
  open: boolean;
  onClose: () => void;
  onSubmit: (name: string, description?: string) => void;
  isLoading: boolean;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create New Sequence</DialogTitle>
          <DialogDescription>
            Set up a new email/SMS drip sequence to nurture your contacts.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div>
            <Label>Sequence Name</Label>
            <Input
              placeholder="e.g., New Lead Nurture, Post-Application Follow-up"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1"
            />
          </div>
          <div>
            <Label>Description (optional)</Label>
            <Textarea
              placeholder="Describe the purpose of this sequence..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="mt-1"
              rows={3}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={() => onSubmit(name, description || undefined)}
            disabled={!name.trim() || isLoading}
          >
            {isLoading ? "Creating..." : "Create Sequence"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Configure Event Dialog ───
function ConfigureEventDialog({
  open,
  onClose,
  sequenceId,
  accountId,
  stepCount,
}: {
  open: boolean;
  onClose: () => void;
  sequenceId: number;
  accountId: number;
  stepCount: number;
}) {
  const [eventDate, setEventDate] = useState("");
  const [eventTime, setEventTime] = useState("");
  const [joinLink, setJoinLink] = useState("");
  const [calendarLink, setCalendarLink] = useState("");
  const utils = trpc.useUtils();

  const updatePlaceholders = trpc.sequences.updatePlaceholders.useMutation({
    onSuccess: (data) => {
      utils.sequences.get.invalidate({ id: sequenceId, accountId });
      toast.success(`All steps updated (${data.updatedSteps} steps modified)`);
      onClose();
      setEventDate("");
      setEventTime("");
      setJoinLink("");
      setCalendarLink("");
    },
    onError: (err) => {
      toast.error(err.message || "Failed to update steps");
    },
  });

  const handleSubmit = () => {
    const replacements: { placeholder: string; value: string }[] = [];
    if (eventDate.trim()) replacements.push({ placeholder: "[WEBINAR DATE]", value: eventDate.trim() });
    if (eventTime.trim()) replacements.push({ placeholder: "[WEBINAR TIME]", value: eventTime.trim() });
    if (joinLink.trim()) replacements.push({ placeholder: "[WEBINAR LINK]", value: joinLink.trim() });
    if (calendarLink.trim()) replacements.push({ placeholder: "[CALENDAR LINK]", value: calendarLink.trim() });

    if (replacements.length === 0) {
      toast.error("Please fill in at least one field");
      return;
    }

    updatePlaceholders.mutate({ sequenceId, accountId, replacements });
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => { if (!isOpen) onClose(); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings2 className="h-5 w-5" />
            Configure Webinar Event
          </DialogTitle>
          <DialogDescription>
            Update the date, time, and link for this event. All steps will be updated automatically.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div>
            <Label>Event Date</Label>
            <Input
              placeholder="e.g. Tuesday, April 15th at 7:00 PM EST"
              value={eventDate}
              onChange={(e) => setEventDate(e.target.value)}
              className="mt-1"
            />
            <p className="text-xs text-muted-foreground mt-1">Replaces [WEBINAR DATE] in all steps</p>
          </div>
          <div>
            <Label>Event Time</Label>
            <Input
              placeholder="e.g. 7:00 PM EST"
              value={eventTime}
              onChange={(e) => setEventTime(e.target.value)}
              className="mt-1"
            />
            <p className="text-xs text-muted-foreground mt-1">Replaces [WEBINAR TIME] in all steps</p>
          </div>
          <div>
            <Label>Join Link</Label>
            <Input
              placeholder="e.g. https://zoom.us/j/..."
              value={joinLink}
              onChange={(e) => setJoinLink(e.target.value)}
              className="mt-1"
            />
            <p className="text-xs text-muted-foreground mt-1">Replaces [WEBINAR LINK] in all steps</p>
          </div>
          <div>
            <Label>Calendar Link</Label>
            <Input
              placeholder="e.g. https://calendly.com/..."
              value={calendarLink}
              onChange={(e) => setCalendarLink(e.target.value)}
              className="mt-1"
            />
            <p className="text-xs text-muted-foreground mt-1">Replaces [CALENDAR LINK] in all steps</p>
          </div>
          <div className="rounded-md bg-muted/50 p-3 text-sm text-muted-foreground">
            This will update all <strong>{stepCount}</strong> step{stepCount !== 1 ? "s" : ""} in this sequence.
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={updatePlaceholders.isPending}
          >
            {updatePlaceholders.isPending ? "Updating..." : "Update All Steps"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Sequence Builder ───
function SequenceBuilder({
  sequenceId,
  accountId,
  pendingConfigureId,
  onClearPendingConfigure,
  onBack,
  onClone,
  isCloning,
}: {
  sequenceId: number;
  accountId: number;
  pendingConfigureId: number | null;
  onClearPendingConfigure: () => void;
  onBack: () => void;
  onClone: (seqId: number) => void;
  isCloning: boolean;
}) {
  const utils = trpc.useUtils();

  const { data: sequence, isLoading } = trpc.sequences.get.useQuery(
    { id: sequenceId, accountId },
    { enabled: !!sequenceId }
  );

  const [activeTab, setActiveTab] = useState<string>("steps");
  const [showStepDialog, setShowStepDialog] = useState(false);
  const [editingStep, setEditingStep] = useState<SequenceStep | null>(null);
  const [showEnrollments, setShowEnrollments] = useState(false);
  const [isEditingName, setIsEditingName] = useState(false);
  const [editName, setEditName] = useState("");
  const [showConfigureDialog, setShowConfigureDialog] = useState(false);

  // Auto-open Configure dialog for pending template clones
  useEffect(() => {
    if (pendingConfigureId && pendingConfigureId === sequenceId && sequence) {
      setShowConfigureDialog(true);
      onClearPendingConfigure();
    }
  }, [pendingConfigureId, sequenceId, sequence, onClearPendingConfigure]);

  const updateSeq = trpc.sequences.update.useMutation({
    onSuccess: () => {
      utils.sequences.get.invalidate({ id: sequenceId, accountId });
      utils.sequences.list.invalidate();
      setIsEditingName(false);
    },
  });

  const addStep = trpc.sequences.addStep.useMutation({
    onSuccess: () => {
      utils.sequences.get.invalidate({ id: sequenceId, accountId });
      setShowStepDialog(false);
      setEditingStep(null);
      toast.success("Step added");
    },
  });

  const updateStep = trpc.sequences.updateStep.useMutation({
    onSuccess: () => {
      utils.sequences.get.invalidate({ id: sequenceId, accountId });
      setShowStepDialog(false);
      setEditingStep(null);
      toast.success("Step updated");
    },
  });

  const deleteStep = trpc.sequences.deleteStep.useMutation({
    onSuccess: () => {
      utils.sequences.get.invalidate({ id: sequenceId, accountId });
      toast.success("Step removed");
    },
  });

  const reorderSteps = trpc.sequences.reorderSteps.useMutation({
    onSuccess: () => {
      utils.sequences.get.invalidate({ id: sequenceId, accountId });
    },
  });

  if (isLoading || !sequence) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-48 bg-muted animate-pulse rounded" />
        <div className="h-64 bg-muted animate-pulse rounded" />
      </div>
    );
  }

  const steps = (sequence.steps || []) as SequenceStep[];
  const seqIsTemplate = isTemplate(sequence.name);

  function moveStep(index: number, direction: "up" | "down") {
    const newOrder = [...steps];
    const swapIdx = direction === "up" ? index - 1 : index + 1;
    if (swapIdx < 0 || swapIdx >= newOrder.length) return;
    [newOrder[index], newOrder[swapIdx]] = [newOrder[swapIdx], newOrder[index]];
    reorderSteps.mutate({
      sequenceId,
      accountId,
      stepIds: newOrder.map((s) => s.id),
    });
  }

  // Compute cumulative delay for timeline
  function getCumulativeDelay(index: number): string {
    let totalHours = 0;
    for (let i = 0; i <= index; i++) {
      totalHours += (steps[i].delayDays * 24) + steps[i].delayHours;
    }
    if (totalHours === 0) return "Immediately";
    const days = Math.floor(totalHours / 24);
    const hours = totalHours % 24;
    const parts: string[] = [];
    if (days > 0) parts.push(`${days}d`);
    if (hours > 0) parts.push(`${hours}h`);
    return parts.join(" ") + " after enrollment";
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={onBack}>
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <div>
            {isEditingName ? (
              <div className="flex items-center gap-2">
                <Input
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="h-8 text-lg font-bold w-64"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && editName.trim()) {
                      updateSeq.mutate({ id: sequenceId, accountId, name: editName });
                    }
                    if (e.key === "Escape") setIsEditingName(false);
                  }}
                />
                <Button
                  size="sm"
                  onClick={() => {
                    if (editName.trim()) updateSeq.mutate({ id: sequenceId, accountId, name: editName });
                  }}
                >
                  Save
                </Button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <h1
                  className="text-2xl font-bold tracking-tight cursor-pointer hover:text-primary transition-colors"
                  onClick={() => {
                    setEditName(sequence.name);
                    setIsEditingName(true);
                  }}
                >
                  {sequence.name}
                </h1>
                {seqIsTemplate && (
                  <Badge className="bg-yellow-500/15 text-yellow-600 border-yellow-300 text-[10px] px-1.5 py-0">
                    TEMPLATE
                  </Badge>
                )}
              </div>
            )}
            <div className="flex items-center gap-2 mt-1">
              <StatusBadge status={sequence.status} />
              <span className="text-sm text-muted-foreground">
                {steps.length} step{steps.length !== 1 ? "s" : ""} · {sequence.activeEnrollments} enrolled · {sequence.completedCount} completed
              </span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {seqIsTemplate && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowConfigureDialog(true)}
            >
              <Settings2 className="h-4 w-4 mr-2" />
              Configure Event
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => onClone(sequenceId)}
            disabled={isCloning}
          >
            <Copy className="h-4 w-4 mr-2" />
            {isCloning ? "Cloning..." : "Clone"}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowEnrollments(!showEnrollments)}
          >
            <Users className="h-4 w-4 mr-2" />
            Enrollments
          </Button>
          {sequence.status === "active" ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => updateSeq.mutate({ id: sequenceId, accountId, status: "paused" })}
            >
              <Pause className="h-4 w-4 mr-2" />
              Pause
            </Button>
          ) : (
            <Button
              size="sm"
              onClick={() => updateSeq.mutate({ id: sequenceId, accountId, status: "active" })}
              disabled={steps.length === 0}
            >
              <Play className="h-4 w-4 mr-2" />
              Activate
            </Button>
          )}
        </div>
      </div>

      {/* Enrollment Panel */}
      {showEnrollments && (
        <EnrollmentPanel sequenceId={sequenceId} accountId={accountId} />
      )}

      {/* Tabs: Steps | Performance */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="steps">Steps</TabsTrigger>
          <TabsTrigger value="performance">Performance</TabsTrigger>
        </TabsList>

        <TabsContent value="steps">
          {/* Steps Timeline */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg">Sequence Steps</CardTitle>
                  <CardDescription>
                    Messages are sent in order with configured delays between each step.
                  </CardDescription>
                </div>
                <Button
                  size="sm"
                  onClick={() => {
                    setEditingStep(null);
                    setShowStepDialog(true);
                  }}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Step
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {steps.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center border-2 border-dashed rounded-lg">
                  <Clock className="h-10 w-10 text-muted-foreground mb-3" />
                  <h3 className="font-semibold mb-1">No steps yet</h3>
                  <p className="text-sm text-muted-foreground mb-4 max-w-sm">
                    Add your first step to start building the drip sequence timeline.
                  </p>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setEditingStep(null);
                      setShowStepDialog(true);
                    }}
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Add First Step
                  </Button>
                </div>
              ) : (
                <div className="relative">
                  {/* Timeline line */}
                  <div className="absolute left-6 top-0 bottom-0 w-0.5 bg-border" />

                  <div className="space-y-0">
                    {steps.map((step, index) => (
                      <div key={step.id} className="relative flex gap-4 pb-6 last:pb-0">
                        {/* Timeline dot */}
                        <div
                          className={`relative z-10 h-12 w-12 rounded-full flex items-center justify-center shrink-0 border-2 ${
                            step.messageType === "email"
                              ? "bg-blue-500/10 border-blue-300 text-blue-600"
                              : "bg-green-500/10 border-green-300 text-green-600"
                          }`}
                        >
                          {step.messageType === "email" ? (
                            <Mail className="h-5 w-5" />
                          ) : (
                            <MessageSquare className="h-5 w-5" />
                          )}
                        </div>

                        {/* Step Card */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between bg-card border rounded-lg p-4 hover:border-primary/30 transition-colors">
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="text-xs font-medium text-muted-foreground uppercase">
                                  Step {step.position}
                                </span>
                                <Badge variant="outline" className="text-xs">
                                  {step.messageType === "email" ? "Email" : "SMS"}
                                </Badge>
                                <span className="text-xs text-muted-foreground flex items-center gap-1">
                                  <Clock className="h-3 w-3" />
                                  {step.delayDays > 0 || step.delayHours > 0
                                    ? `Wait ${step.delayDays > 0 ? `${step.delayDays}d` : ""}${step.delayHours > 0 ? ` ${step.delayHours}h` : ""}`
                                    : "No delay"}
                                </span>
                                <span className="text-xs text-primary/70">
                                  ({getCumulativeDelay(index)})
                                </span>
                              </div>
                              {step.subject && (
                                <div className="text-sm font-medium mb-1 truncate">
                                  Subject: {step.subject}
                                </div>
                              )}
                              <p className="text-sm text-muted-foreground line-clamp-2">
                                {step.content}
                              </p>
                            </div>
                            <div className="flex items-center gap-1 ml-3 shrink-0">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7"
                                disabled={index === 0}
                                onClick={() => moveStep(index, "up")}
                              >
                                <ArrowUp className="h-3.5 w-3.5" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7"
                                disabled={index === steps.length - 1}
                                onClick={() => moveStep(index, "down")}
                              >
                                <ArrowDown className="h-3.5 w-3.5" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7"
                                onClick={() => {
                                  setEditingStep(step);
                                  setShowStepDialog(true);
                                }}
                              >
                                <Edit className="h-3.5 w-3.5" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-destructive hover:text-destructive"
                                onClick={() => {
                                  deleteStep.mutate({ id: step.id, sequenceId, accountId });
                                }}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Add step at end */}
                  <div className="relative flex gap-4 pt-2">
                    <div className="relative z-10 h-12 w-12 rounded-full flex items-center justify-center shrink-0 border-2 border-dashed border-muted-foreground/30 text-muted-foreground">
                      <Plus className="h-5 w-5" />
                    </div>
                    <Button
                      variant="outline"
                      className="border-dashed"
                      onClick={() => {
                        setEditingStep(null);
                        setShowStepDialog(true);
                      }}
                    >
                      Add Another Step
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Merge Tags Reference */}
          <Card className="mt-4">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Available Merge Tags</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {[
                  "{{firstName}}",
                  "{{lastName}}",
                  "{{email}}",
                  "{{phone}}",
                  "{{company}}",
                  "{{status}}",
                  "{{leadSource}}",
                ].map((tag) => (
                  <Badge
                    key={tag}
                    variant="secondary"
                    className="cursor-pointer hover:bg-primary/10"
                    onClick={() => {
                      navigator.clipboard.writeText(tag);
                      toast.success(`${tag} copied to clipboard`);
                    }}
                  >
                    {tag}
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="performance">
          <PerformanceTab sequenceId={sequenceId} accountId={accountId} steps={steps} />
        </TabsContent>
      </Tabs>

      {/* Step Dialog */}
      <StepEditorDialog
        open={showStepDialog}
        onClose={() => {
          setShowStepDialog(false);
          setEditingStep(null);
        }}
        step={editingStep}
        nextPosition={steps.length + 1}
        onSubmit={(data) => {
          if (editingStep) {
            updateStep.mutate({
              id: editingStep.id,
              sequenceId,
              accountId,
              ...data,
            });
          } else {
            addStep.mutate({
              sequenceId,
              accountId,
              position: steps.length + 1,
              ...data,
            });
          }
        }}
        isLoading={addStep.isPending || updateStep.isPending}
      />

      {/* Configure Event Dialog */}
      <ConfigureEventDialog
        open={showConfigureDialog}
        onClose={() => setShowConfigureDialog(false)}
        sequenceId={sequenceId}
        accountId={accountId}
        stepCount={steps.length}
      />
    </div>
  );
}

// ─── Performance Tab ───
function PerformanceTab({
  sequenceId,
  accountId,
  steps,
}: {
  sequenceId: number;
  accountId: number;
  steps: SequenceStep[];
}) {
  const { data: stats, isLoading } = trpc.sequences.getStats.useQuery(
    { sequenceId, accountId },
    { enabled: !!sequenceId }
  );

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {[1, 2, 3, 4, 5].map((i) => (
            <Card key={i}>
              <CardContent className="pt-4 pb-4">
                <Skeleton className="h-4 w-20 mb-2" />
                <Skeleton className="h-8 w-16" />
              </CardContent>
            </Card>
          ))}
        </div>
        <Skeleton className="h-48 w-full rounded-lg" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Skeleton className="h-48 rounded-lg" />
          <Skeleton className="h-48 rounded-lg" />
        </div>
      </div>
    );
  }

  if (!stats || stats.statusBreakdown.total === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-16 text-center">
          <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
            <TrendingUp className="h-8 w-8 text-primary" />
          </div>
          <h3 className="text-lg font-semibold mb-2">No enrollment data yet</h3>
          <p className="text-muted-foreground max-w-md">
            Enroll contacts in this sequence to start seeing performance metrics. Data will appear here once contacts begin progressing through the steps.
          </p>
        </CardContent>
      </Card>
    );
  }

  const { statusBreakdown, completionRate, stepDistribution, sourceBreakdown, enrollmentTrend, avgCompletionHours } = stats;
  const avgDays = avgCompletionHours != null ? (avgCompletionHours / 24).toFixed(1) : "N/A";

  // Build step distribution map for quick lookup
  const stepCountMap: Record<number, number> = {};
  for (const sd of stepDistribution) {
    stepCountMap[sd.step] = sd.count;
  }
  const maxStepCount = Math.max(1, ...stepDistribution.map((s) => s.count));

  // Source breakdown
  const totalSources = Object.values(sourceBreakdown).reduce((a, b) => a + b, 0);
  const sourceConfig: { key: string; label: string; color: string }[] = [
    { key: "manual", label: "Manual", color: "bg-blue-500" },
    { key: "workflow", label: "Workflow", color: "bg-green-500" },
    { key: "campaign", label: "Campaign", color: "bg-orange-500" },
    { key: "api", label: "API", color: "bg-purple-500" },
  ];

  // Enrollment trend — last 14 days for display
  const trendDays: { date: string; count: number; label: string }[] = [];
  const trendMap: Record<string, number> = {};
  for (const t of enrollmentTrend) {
    trendMap[t.date] = t.count;
  }
  for (let i = 13; i >= 0; i--) {
    const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
    const dateStr = d.toISOString().split("T")[0];
    trendDays.push({
      date: dateStr,
      count: trendMap[dateStr] || 0,
      label: d.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
    });
  }
  const maxTrend = Math.max(1, ...trendDays.map((d) => d.count));
  const totalTrend30 = enrollmentTrend.reduce((sum, t) => sum + t.count, 0);

  return (
    <div className="space-y-4">
      {/* Row 1: Stat Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
              <Users className="h-4 w-4" />
              Total Enrolled
            </div>
            <div className="text-2xl font-bold">{statusBreakdown.total}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
              <Activity className="h-4 w-4 text-green-600" />
              Active
            </div>
            <div className="text-2xl font-bold text-green-600">{statusBreakdown.active}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
              <CheckCircle2 className="h-4 w-4 text-purple-600" />
              Completed
            </div>
            <div className="text-2xl font-bold text-purple-600">{statusBreakdown.completed}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
              <TrendingUp className="h-4 w-4 text-blue-600" />
              Completion Rate
            </div>
            <div className="text-2xl font-bold text-blue-600">{completionRate}%</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
              <Clock className="h-4 w-4" />
              Avg. Time
            </div>
            <div className="text-2xl font-bold">{avgDays === "N/A" ? "N/A" : `${avgDays}d`}</div>
          </CardContent>
        </Card>
      </div>

      {/* Row 2: Step-by-Step Progress */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Where Contacts Are in the Sequence</CardTitle>
          <CardDescription>Active contacts distributed across each step</CardDescription>
        </CardHeader>
        <CardContent>
          {steps.length === 0 ? (
            <p className="text-sm text-muted-foreground">No steps in this sequence.</p>
          ) : (
            <div className="space-y-3">
              {steps.map((step) => {
                const cnt = stepCountMap[step.position] || 0;
                const pct = maxStepCount > 0 ? (cnt / maxStepCount) * 100 : 0;
                return (
                  <div key={step.id} className="flex items-center gap-3">
                    <div className="w-24 shrink-0 text-sm text-muted-foreground">
                      <span className="font-medium">Step {step.position}</span>
                      <span className="ml-1 text-xs">
                        {step.messageType === "email" ? "📧" : "💬"}
                      </span>
                    </div>
                    <div className="flex-1 h-6 bg-muted rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${
                          step.messageType === "email" ? "bg-blue-500" : "bg-green-500"
                        }`}
                        style={{ width: `${Math.max(pct, cnt > 0 ? 2 : 0)}%` }}
                      />
                    </div>
                    <div className="w-10 text-right text-sm font-medium">{cnt}</div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Row 3: Trend + Sources */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Enrollment Trend */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Enrollment Trend</CardTitle>
            <CardDescription>{totalTrend30} enrollments in the last 30 days</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-end gap-[3px] h-32">
              {trendDays.map((day) => {
                const heightPct = maxTrend > 0 ? (day.count / maxTrend) * 100 : 0;
                return (
                  <div
                    key={day.date}
                    className="flex-1 bg-primary/80 hover:bg-primary rounded-t transition-colors cursor-default"
                    style={{ height: `${Math.max(heightPct, day.count > 0 ? 4 : 1)}%` }}
                    title={`${day.label}: ${day.count} enrollment${day.count !== 1 ? "s" : ""}`}
                  />
                );
              })}
            </div>
            <div className="flex justify-between mt-2 text-[10px] text-muted-foreground">
              <span>{trendDays[0]?.label}</span>
              <span>{trendDays[trendDays.length - 1]?.label}</span>
            </div>
          </CardContent>
        </Card>

        {/* Enrollment Sources */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Enrollment Sources</CardTitle>
            <CardDescription>How contacts were enrolled</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {sourceConfig.map(({ key, label, color }) => {
                const cnt = sourceBreakdown[key as keyof typeof sourceBreakdown] || 0;
                const pct = totalSources > 0 ? (cnt / totalSources) * 100 : 0;
                return (
                  <div key={key} className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <span>{label}</span>
                      <span className="font-medium">{cnt}</span>
                    </div>
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${color}`}
                        style={{ width: `${Math.max(pct, cnt > 0 ? 2 : 0)}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// ─── Step Editor Dialog ───
function StepEditorDialog({
  open,
  onClose,
  step,
  nextPosition,
  onSubmit,
  isLoading,
}: {
  open: boolean;
  onClose: () => void;
  step: SequenceStep | null;
  nextPosition: number;
  onSubmit: (data: {
    delayDays: number;
    delayHours: number;
    messageType: "sms" | "email";
    subject?: string;
    content: string;
  }) => void;
  isLoading: boolean;
}) {
  const [messageType, setMessageType] = useState<"sms" | "email">(step?.messageType || "email");
  const [delayDays, setDelayDays] = useState(step?.delayDays || 0);
  const [delayHours, setDelayHours] = useState(step?.delayHours || 0);
  const [subject, setSubject] = useState(step?.subject || "");
  const [content, setContent] = useState(step?.content || "");

  // Reset form when dialog opens
  const resetForm = () => {
    setMessageType(step?.messageType || "email");
    setDelayDays(step?.delayDays || 0);
    setDelayHours(step?.delayHours || 0);
    setSubject(step?.subject || "");
    setContent(step?.content || "");
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(isOpen) => {
        if (isOpen) resetForm();
        else onClose();
      }}
    >
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{step ? `Edit Step ${step.position}` : `Add Step ${nextPosition}`}</DialogTitle>
          <DialogDescription>
            Configure the message type, delay, and content for this step.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          {/* Message Type */}
          <div>
            <Label>Message Type</Label>
            <Select value={messageType} onValueChange={(v) => setMessageType(v as "sms" | "email")}>
              <SelectTrigger className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="email">
                  <div className="flex items-center gap-2">
                    <Mail className="h-4 w-4" />
                    Email
                  </div>
                </SelectItem>
                <SelectItem value="sms">
                  <div className="flex items-center gap-2">
                    <MessageSquare className="h-4 w-4" />
                    SMS
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Delay */}
          <div>
            <Label>Delay Before Sending</Label>
            <div className="flex items-center gap-3 mt-1">
              <div className="flex items-center gap-1.5">
                <Input
                  type="number"
                  min={0}
                  value={delayDays}
                  onChange={(e) => setDelayDays(parseInt(e.target.value) || 0)}
                  className="w-20"
                />
                <span className="text-sm text-muted-foreground">days</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Input
                  type="number"
                  min={0}
                  max={23}
                  value={delayHours}
                  onChange={(e) => setDelayHours(parseInt(e.target.value) || 0)}
                  className="w-20"
                />
                <span className="text-sm text-muted-foreground">hours</span>
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {delayDays === 0 && delayHours === 0
                ? "This step will send immediately (or right after the previous step)."
                : `Wait ${delayDays > 0 ? `${delayDays} day${delayDays > 1 ? "s" : ""}` : ""}${delayDays > 0 && delayHours > 0 ? " and " : ""}${delayHours > 0 ? `${delayHours} hour${delayHours > 1 ? "s" : ""}` : ""} before sending.`}
            </p>
          </div>

          {/* Subject (email only) */}
          {messageType === "email" && (
            <div>
              <Label>Subject Line</Label>
              <Input
                placeholder="e.g., Just checking in, {{firstName}}!"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="mt-1"
              />
            </div>
          )}

          {/* Content */}
          <div>
            <Label>Message Content</Label>
            <Textarea
              placeholder={
                messageType === "email"
                  ? "Hi {{firstName}},\n\nI wanted to follow up on..."
                  : "Hi {{firstName}}! Just wanted to check in about..."
              }
              value={content}
              onChange={(e) => setContent(e.target.value)}
              className="mt-1 min-h-[120px]"
              rows={messageType === "email" ? 8 : 4}
            />
            {messageType === "sms" && (
              <p className="text-xs text-muted-foreground mt-1">
                {content.length}/160 characters{content.length > 160 ? " (multi-segment)" : ""}
              </p>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={() =>
              onSubmit({
                delayDays,
                delayHours,
                messageType,
                subject: messageType === "email" ? subject : undefined,
                content,
              })
            }
            disabled={!content.trim() || isLoading}
          >
            {isLoading ? "Saving..." : step ? "Update Step" : "Add Step"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Enrollment Panel ───
function EnrollmentPanel({
  sequenceId,
  accountId,
}: {
  sequenceId: number;
  accountId: number;
}) {
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const utils = trpc.useUtils();
  const { data: enrollments = [], isLoading } = trpc.sequences.listEnrollments.useQuery(
    {
      sequenceId,
      accountId,
      status: statusFilter !== "all" ? (statusFilter as any) : undefined,
    },
    { enabled: !!sequenceId }
  );

  const unenrollMutation = trpc.sequences.unenroll.useMutation({
    onSuccess: () => {
      utils.sequences.listEnrollments.invalidate();
      utils.sequences.get.invalidate({ id: sequenceId, accountId });
      toast.success("Contact unenrolled");
    },
  });

  const statusIcon = (status: string) => {
    switch (status) {
      case "active":
        return <Play className="h-3.5 w-3.5 text-green-600" />;
      case "completed":
        return <CheckCircle2 className="h-3.5 w-3.5 text-purple-600" />;
      case "paused":
        return <Pause className="h-3.5 w-3.5 text-yellow-600" />;
      case "failed":
        return <XCircle className="h-3.5 w-3.5 text-red-600" />;
      case "unenrolled":
        return <AlertCircle className="h-3.5 w-3.5 text-muted-foreground" />;
      default:
        return null;
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">Enrollments</CardTitle>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-36 h-8">
              <SelectValue placeholder="Filter status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
              <SelectItem value="paused">Paused</SelectItem>
              <SelectItem value="failed">Failed</SelectItem>
              <SelectItem value="unenrolled">Unenrolled</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-12 bg-muted animate-pulse rounded" />
            ))}
          </div>
        ) : enrollments.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Users className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p>No enrollments found.</p>
          </div>
        ) : (
          <div className="space-y-2 max-h-80 overflow-y-auto">
            {enrollments.map((e: any) => (
              <div
                key={e.id}
                className="flex items-center justify-between p-3 rounded-lg border bg-card"
              >
                <div className="flex items-center gap-3">
                  {statusIcon(e.status)}
                  <div>
                    <div className="text-sm font-medium">Contact #{e.contactId}</div>
                    <div className="text-xs text-muted-foreground">
                      Step {e.currentStep}/{sequenceId} · Enrolled{" "}
                      {new Date(e.enrolledAt).toLocaleDateString()}
                    </div>
                  </div>
                </div>
                {e.status === "active" && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-destructive hover:text-destructive"
                    onClick={() => unenrollMutation.mutate({ enrollmentId: e.id, accountId })}
                  >
                    Unenroll
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
