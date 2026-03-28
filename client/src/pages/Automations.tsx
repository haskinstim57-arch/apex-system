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
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  ArrowDown,
  ArrowRight,
  CheckCircle2,
  Clock,
  Loader2,
  Mail,
  MessageSquare,
  Pencil,
  Phone,
  Play,
  Plus,
  Tag,
  Trash2,
  UserCog,
  XCircle,
  Zap,
  ClipboardList,
  AlertCircle,
  ChevronDown,
  ChevronRight as ChevronRightIcon,
  Eye,
  Pause,
  RotateCcw,
} from "lucide-react";
import { useMemo, useState, useCallback } from "react";
import { useAccount } from "@/contexts/AccountContext";
import { NoAccountSelected } from "@/components/NoAccountSelected";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { FileText, Palette, GitBranch } from "lucide-react";
import { toast } from "sonner";

// ─── Constants ───
const TRIGGER_TYPES = [
  { value: "contact_created", label: "Contact Created", icon: Plus },
  { value: "tag_added", label: "Tag Added", icon: Tag },
  { value: "pipeline_stage_changed", label: "Pipeline Stage Changed", icon: ArrowRight },
  { value: "facebook_lead_received", label: "Facebook Lead Received", icon: Zap },
  { value: "manual", label: "Manual Trigger", icon: Play },
] as const;

const ACTION_TYPES = [
  { value: "send_sms", label: "Send SMS", icon: MessageSquare },
  { value: "send_email", label: "Send Email", icon: Mail },
  { value: "start_ai_call", label: "Start AI Call", icon: Phone },
  { value: "add_tag", label: "Add Tag", icon: Tag },
  { value: "remove_tag", label: "Remove Tag", icon: Tag },
  { value: "update_contact_field", label: "Update Contact Field", icon: UserCog },
  { value: "create_task", label: "Create Task", icon: ClipboardList },
] as const;

const DELAY_TYPES = [
  { value: "minutes", label: "Minutes" },
  { value: "hours", label: "Hours" },
  { value: "days", label: "Days" },
] as const;

const PIPELINE_STAGES = [
  "new", "contacted", "qualified", "proposal", "negotiation", "won", "lost", "nurture",
] as const;

const CONTACT_FIELDS = [
  { value: "status", label: "Pipeline Status" },
  { value: "leadSource", label: "Lead Source" },
  { value: "company", label: "Company" },
  { value: "title", label: "Title" },
  { value: "city", label: "City" },
  { value: "state", label: "State" },
] as const;

const CONDITION_FIELDS = [
  { value: "status", label: "Pipeline Status" },
  { value: "leadSource", label: "Lead Source" },
  { value: "email", label: "Email" },
  { value: "phone", label: "Phone" },
  { value: "company", label: "Company" },
  { value: "title", label: "Title" },
  { value: "city", label: "City" },
  { value: "state", label: "State" },
  { value: "firstName", label: "First Name" },
  { value: "lastName", label: "Last Name" },
  { value: "has_tag", label: "Has Tag (comma-separated)" },
] as const;

const CONDITION_OPERATORS = [
  { value: "equals", label: "Equals" },
  { value: "not_equals", label: "Does Not Equal" },
  { value: "contains", label: "Contains" },
  { value: "not_contains", label: "Does Not Contain" },
  { value: "starts_with", label: "Starts With" },
  { value: "ends_with", label: "Ends With" },
  { value: "is_empty", label: "Is Empty" },
  { value: "is_not_empty", label: "Is Not Empty" },
  { value: "greater_than", label: "Greater Than" },
  { value: "less_than", label: "Less Than" },
] as const;

// ─── Main Component ───
export default function Automations() {
  const { user } = useAuth();
  const utils = trpc.useUtils();
  const { currentAccountId: accountId, isLoading: accountsLoading } = useAccount();

  // View state
  const [view, setView] = useState<"list" | "builder" | "logs">("list");
  const [selectedWorkflowId, setSelectedWorkflowId] = useState<number | null>(null);

  // Workflows list
  const { data: workflows, isLoading: workflowsLoading } =
    trpc.automations.list.useQuery(
      { accountId: accountId! },
      { enabled: !!accountId }
    );

  // Create dialog
  const [createOpen, setCreateOpen] = useState(false);

  if (!accountId) {
    return <NoAccountSelected />;
  }

  return (
    <div className="p-3 sm:p-6 space-y-4 sm:space-y-6 max-w-[1400px] mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Automations</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Create trigger-based workflows to automate your pipeline
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          {/* Account selector removed — use sidebar AccountSwitcher */}

          {/* View tabs */}
          <div className="flex bg-muted rounded-lg p-0.5">
            <button
              onClick={() => { setView("list"); setSelectedWorkflowId(null); }}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                view === "list" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Workflows
            </button>
            <button
              onClick={() => setView("logs")}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                view === "logs" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Execution Logs
            </button>
          </div>

          {view === "list" && (
            <>
              <TemplatesDropdown accountId={accountId} onCreated={(id) => {
                setSelectedWorkflowId(id);
                setView("builder");
                utils.automations.list.invalidate();
              }} />
              <Button onClick={() => setCreateOpen(true)} size="sm">
                <Plus className="h-4 w-4 mr-1" /> New Workflow
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Content */}
      {view === "list" && !selectedWorkflowId ? (
        <WorkflowsList
          accountId={accountId}
          workflows={workflows ?? []}
          loading={workflowsLoading}
          onSelect={(id) => { setSelectedWorkflowId(id); setView("builder"); }}
          onRefresh={() => utils.automations.list.invalidate()}
        />
      ) : view === "builder" && selectedWorkflowId ? (
        <WorkflowBuilder
          accountId={accountId}
          workflowId={selectedWorkflowId}
          onBack={() => { setSelectedWorkflowId(null); setView("list"); }}
        />
      ) : view === "logs" ? (
        <ExecutionLogs accountId={accountId} />
      ) : null}

      {/* Create dialog */}
      <CreateWorkflowDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        accountId={accountId!}
        onCreated={(id) => {
          setSelectedWorkflowId(id);
          setView("builder");
          utils.automations.list.invalidate();
        }}
      />
    </div>
  );
}

// ═══════════════════════════════════════════
// WORKFLOWS LIST
// ═══════════════════════════════════════════
function WorkflowsList({
  accountId,
  workflows,
  loading,
  onSelect,
  onRefresh,
}: {
  accountId: number;
  workflows: any[];
  loading: boolean;
  onSelect: (id: number) => void;
  onRefresh: () => void;
}) {
  const toggleMutation = trpc.automations.toggle.useMutation({
    onSuccess: (data) => {
      toast.success(data.isActive ? "Workflow activated" : "Workflow deactivated");
      onRefresh();
    },
    onError: (err) => toast.error(err.message),
  });

  const deleteMutation = trpc.automations.delete.useMutation({
    onSuccess: () => {
      toast.success("Workflow deleted");
      onRefresh();
    },
    onError: (err) => toast.error(err.message),
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (workflows.length === 0) {
    return (
      <Card>
        <CardContent className="py-16 text-center">
          <Zap className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
          <h3 className="text-lg font-medium mb-2">No workflows yet</h3>
          <p className="text-sm text-muted-foreground mb-4">
            Create your first automation workflow or use a pre-built template.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid gap-4">
      {workflows.map((wf) => {
        const triggerInfo = TRIGGER_TYPES.find((t) => t.value === wf.triggerType);
        const TriggerIcon = triggerInfo?.icon ?? Zap;
        return (
          <Card
            key={wf.id}
            className="hover:border-primary/30 transition-colors cursor-pointer"
            onClick={() => onSelect(wf.id)}
          >
            <CardContent className="py-4 px-5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    <TriggerIcon className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-medium">{wf.name}</h3>
                      <Badge
                        variant={wf.isActive ? "default" : "secondary"}
                        className="text-[10px] px-1.5"
                      >
                        {wf.isActive ? "Active" : "Inactive"}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Trigger: {triggerInfo?.label ?? wf.triggerType} · {wf.executionCount} executions
                      {wf.lastExecutedAt && (
                        <> · Last run: {new Date(wf.lastExecutedAt).toLocaleDateString()}</>
                      )}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                  <Switch
                    checked={wf.isActive}
                    onCheckedChange={() =>
                      toggleMutation.mutate({ id: wf.id, accountId })
                    }
                    disabled={toggleMutation.isPending}
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-destructive hover:text-destructive"
                    onClick={() => {
                      if (confirm("Delete this workflow?")) {
                        deleteMutation.mutate({ id: wf.id, accountId });
                      }
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

// ═══════════════════════════════════════════
// CREATE WORKFLOW DIALOG
// ═══════════════════════════════════════════
function CreateWorkflowDialog({
  open,
  onOpenChange,
  accountId,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  accountId: number;
  onCreated: (id: number) => void;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [triggerType, setTriggerType] = useState("contact_created");
  const [triggerTag, setTriggerTag] = useState("");
  const [triggerToStatus, setTriggerToStatus] = useState("");

  const createMutation = trpc.automations.create.useMutation({
    onSuccess: (data) => {
      toast.success("Workflow created");
      onOpenChange(false);
      onCreated(data.id);
      // Reset form
      setName("");
      setDescription("");
      setTriggerType("contact_created");
      setTriggerTag("");
      setTriggerToStatus("");
    },
    onError: (err) => toast.error(err.message),
  });

  const buildTriggerConfig = () => {
    if (triggerType === "tag_added" && triggerTag) {
      return JSON.stringify({ tag: triggerTag });
    }
    if (triggerType === "pipeline_stage_changed" && triggerToStatus) {
      return JSON.stringify({ toStatus: triggerToStatus });
    }
    return undefined;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Create Workflow</DialogTitle>
          <DialogDescription>
            Set up a new automation workflow with a trigger.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Workflow Name</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., New Lead Follow-up"
            />
          </div>
          <div>
            <Label>Description (optional)</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What does this workflow do?"
              rows={2}
            />
          </div>
          <div>
            <Label>Trigger</Label>
            <Select value={triggerType} onValueChange={setTriggerType}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TRIGGER_TYPES.map((t) => (
                  <SelectItem key={t.value} value={t.value}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {triggerType === "tag_added" && (
            <div>
              <Label>Tag Name (leave empty for any tag)</Label>
              <Input
                value={triggerTag}
                onChange={(e) => setTriggerTag(e.target.value)}
                placeholder="e.g., hot-lead"
              />
            </div>
          )}
          {triggerType === "pipeline_stage_changed" && (
            <div>
              <Label>Target Stage (leave empty for any change)</Label>
              <Select value={triggerToStatus} onValueChange={setTriggerToStatus}>
                <SelectTrigger>
                  <SelectValue placeholder="Any stage" />
                </SelectTrigger>
                <SelectContent>
                  {PIPELINE_STAGES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s.charAt(0).toUpperCase() + s.slice(1)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={() =>
              createMutation.mutate({
                accountId,
                name,
                description: description || undefined,
                triggerType: triggerType as any,
                triggerConfig: buildTriggerConfig(),
              })
            }
            disabled={!name.trim() || createMutation.isPending}
          >
            {createMutation.isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
            Create Workflow
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ═══════════════════════════════════════════
// WORKFLOW BUILDER
// ═══════════════════════════════════════════
function WorkflowBuilder({
  accountId,
  workflowId,
  onBack,
}: {
  accountId: number;
  workflowId: number;
  onBack: () => void;
}) {
  const utils = trpc.useUtils();
  const { data: workflow, isLoading } = trpc.automations.get.useQuery(
    { id: workflowId, accountId },
    { enabled: !!workflowId }
  );

  const [addStepOpen, setAddStepOpen] = useState(false);
  const [editStepId, setEditStepId] = useState<number | null>(null);

  const toggleMutation = trpc.automations.toggle.useMutation({
    onSuccess: (data) => {
      toast.success(data.isActive ? "Workflow activated" : "Workflow deactivated");
      utils.automations.get.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  const deleteStepMutation = trpc.automations.deleteStep.useMutation({
    onSuccess: () => {
      toast.success("Step removed");
      utils.automations.get.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  // Manual trigger
  const [triggerContactId, setTriggerContactId] = useState("");
  const [triggerOpen, setTriggerOpen] = useState(false);

  const triggerManualMutation = trpc.automations.triggerManual.useMutation({
    onSuccess: (data) => {
      toast.success(`Workflow triggered! Execution #${data.executionId}`);
      setTriggerOpen(false);
      setTriggerContactId("");
    },
    onError: (err) => toast.error(err.message),
  });

  if (isLoading || !workflow) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const triggerInfo = TRIGGER_TYPES.find((t) => t.value === workflow.triggerType);
  const TriggerIcon = triggerInfo?.icon ?? Zap;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={onBack} className="h-8 w-8">
            <ChevronRightIcon className="h-4 w-4 rotate-180" />
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold">{workflow.name}</h2>
              <Badge variant={workflow.isActive ? "default" : "secondary"}>
                {workflow.isActive ? "Active" : "Inactive"}
              </Badge>
            </div>
            {workflow.description && (
              <p className="text-sm text-muted-foreground mt-0.5">{workflow.description}</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {workflow.triggerType === "manual" && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setTriggerOpen(true)}
            >
              <Play className="h-4 w-4 mr-1" /> Run Manually
            </Button>
          )}
          <Switch
            checked={workflow.isActive}
            onCheckedChange={() =>
              toggleMutation.mutate({ id: workflowId, accountId })
            }
            disabled={toggleMutation.isPending}
          />
        </div>
      </div>

      {/* Trigger card */}
      <Card className="border-primary/30">
        <CardContent className="py-4 px-5">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center">
              <TriggerIcon className="h-4 w-4 text-primary" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider">Trigger</p>
              <p className="font-medium text-sm">{triggerInfo?.label ?? workflow.triggerType}</p>
              {workflow.triggerConfig && (
                <p className="text-xs text-muted-foreground mt-0.5">
                  Config: {workflow.triggerConfig}
                </p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Steps */}
      <div className="space-y-3">
        {workflow.steps && workflow.steps.length > 0 ? (
          workflow.steps.map((step: any, index: number) => (
            <div key={step.id}>
              {/* Connector line */}
              <div className="flex justify-center py-1">
                <ArrowDown className="h-4 w-4 text-muted-foreground/50" />
              </div>
              <StepCard
                step={step}
                index={index}
                accountId={accountId}
                workflowId={workflowId}
                onEdit={() => setEditStepId(step.id)}
                onDelete={() =>
                  deleteStepMutation.mutate({
                    accountId,
                    workflowId,
                    stepId: step.id,
                  })
                }
              />
            </div>
          ))
        ) : (
          <Card className="border-dashed">
            <CardContent className="py-8 text-center text-muted-foreground">
              <p className="text-sm">No steps yet. Add an action or delay to get started.</p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Add step button */}
      <div className="flex justify-center">
        <div className="flex justify-center py-1">
          <ArrowDown className="h-4 w-4 text-muted-foreground/50" />
        </div>
      </div>
      <div className="flex justify-center">
        <Button variant="outline" onClick={() => setAddStepOpen(true)} className="gap-1">
          <Plus className="h-4 w-4" /> Add Step
        </Button>
      </div>

      {/* Add step dialog */}
      <AddStepDialog
        open={addStepOpen}
        onOpenChange={setAddStepOpen}
        accountId={accountId}
        workflowId={workflowId}
        onAdded={() => utils.automations.get.invalidate()}
      />

      {/* Edit step dialog */}
      {editStepId && (
        <EditStepDialog
          open={!!editStepId}
          onOpenChange={(open) => { if (!open) setEditStepId(null); }}
          accountId={accountId}
          workflowId={workflowId}
          stepId={editStepId}
          step={workflow.steps?.find((s: any) => s.id === editStepId)}
          onUpdated={() => { setEditStepId(null); utils.automations.get.invalidate(); }}
        />
      )}

      {/* Manual trigger dialog */}
      <Dialog open={triggerOpen} onOpenChange={setTriggerOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Run Workflow Manually</DialogTitle>
            <DialogDescription>Enter a contact ID to run this workflow for.</DialogDescription>
          </DialogHeader>
          <div>
            <Label>Contact ID</Label>
            <Input
              type="number"
              value={triggerContactId}
              onChange={(e) => setTriggerContactId(e.target.value)}
              placeholder="e.g., 42"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTriggerOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() =>
                triggerManualMutation.mutate({
                  accountId,
                  workflowId,
                  contactId: parseInt(triggerContactId),
                })
              }
              disabled={!triggerContactId || triggerManualMutation.isPending}
            >
              {triggerManualMutation.isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              Run
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ═══════════════════════════════════════════
// STEP CARD
// ═══════════════════════════════════════════
function StepCard({
  step,
  index,
  accountId,
  workflowId,
  onEdit,
  onDelete,
}: {
  step: any;
  index: number;
  accountId: number;
  workflowId: number;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const getStepInfo = () => {
    if (step.stepType === "delay") {
      return {
        label: `Wait ${step.delayValue} ${step.delayType}`,
        icon: Clock,
        color: "text-amber-600",
        bg: "bg-amber-500/10",
      };
    }
    if (step.stepType === "condition") {
      const condConfig = step.conditionConfig ? JSON.parse(step.conditionConfig) : {};
      const fieldLabel = CONDITION_FIELDS.find((f) => f.value === condConfig.field)?.label ?? condConfig.field;
      const opLabel = CONDITION_OPERATORS.find((o) => o.value === condConfig.operator)?.label ?? condConfig.operator;
      return {
        label: `If ${fieldLabel} ${opLabel}${condConfig.value ? ` "${condConfig.value}"` : ""}`,
        icon: GitBranch,
        color: "text-purple-600",
        bg: "bg-purple-500/10",
      };
    }
    const action = ACTION_TYPES.find((a) => a.value === step.actionType);
    return {
      label: action?.label ?? step.actionType,
      icon: action?.icon ?? Zap,
      color: "text-blue-600",
      bg: "bg-blue-500/10",
    };
  };

  const info = getStepInfo();
  const StepIcon = info.icon;
  const config = step.config ? JSON.parse(step.config) : {};

  return (
    <Card className="hover:border-muted-foreground/30 transition-colors">
      <CardContent className="py-3 px-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground font-mono w-5 text-center">
                {index + 1}
              </span>
              <div className={`h-8 w-8 rounded-lg ${info.bg} flex items-center justify-center`}>
                <StepIcon className={`h-4 w-4 ${info.color}`} />
              </div>
            </div>
            <div>
              <p className="font-medium text-sm">{info.label}</p>
              {step.stepType === "action" && Object.keys(config).length > 0 && (
                <p className="text-xs text-muted-foreground mt-0.5 max-w-[400px] truncate">
                  {formatConfig(step.actionType, config)}
                </p>
              )}
              {step.stepType === "condition" && step.conditionConfig && (
                <p className="text-xs text-muted-foreground mt-0.5 max-w-[400px] truncate">
                  {formatConditionConfig(JSON.parse(step.conditionConfig))}
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onEdit}>
              <Pencil className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-destructive hover:text-destructive"
              onClick={onDelete}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function formatConditionConfig(conditionConfig: Record<string, unknown>): string {
  const field = CONDITION_FIELDS.find((f) => f.value === conditionConfig.field)?.label ?? String(conditionConfig.field);
  const op = CONDITION_OPERATORS.find((o) => o.value === conditionConfig.operator)?.label ?? String(conditionConfig.operator);
  const val = conditionConfig.value ? ` "${conditionConfig.value}"` : "";
  const branches: string[] = [];
  if (conditionConfig.trueBranchStepOrder) branches.push(`True→Step ${conditionConfig.trueBranchStepOrder}`);
  if (conditionConfig.falseBranchStepOrder) branches.push(`False→Step ${conditionConfig.falseBranchStepOrder}`);
  return `${field} ${op}${val}${branches.length ? " | " + branches.join(", ") : ""}`;
}

function formatConfig(actionType: string, config: Record<string, unknown>): string {
  switch (actionType) {
    case "send_sms":
      return `Message: "${(config.message as string)?.substring(0, 60) ?? ""}..."`;
    case "send_email":
      return config.templateId ? `Using template #${config.templateId}` : `Subject: "${config.subject ?? ""}"`;
    case "add_tag":
    case "remove_tag":
      return `Tag: ${config.tag ?? ""}`;
    case "update_contact_field":
      return `${config.field} → ${config.value}`;
    case "create_task":
      return `Task: "${config.title ?? ""}"`;
    case "start_ai_call":
      return "Calls contact via VAPI";
    default:
      return JSON.stringify(config).substring(0, 60);
  }
}

// ═══════════════════════════════════════════
// ADD STEP DIALOG
// ═══════════════════════════════════════════
function AddStepDialog({
  open,
  onOpenChange,
  accountId,
  workflowId,
  onAdded,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  accountId: number;
  workflowId: number;
  onAdded: () => void;
}) {
  const [stepType, setStepType] = useState<"action" | "delay" | "condition">("action");
  const [actionType, setActionType] = useState("send_sms");
  const [delayType, setDelayType] = useState("minutes");
  const [delayValue, setDelayValue] = useState("5");

  // Action configs
  const [smsMessage, setSmsMessage] = useState("");
  const [emailSubject, setEmailSubject] = useState("");
  const [emailBody, setEmailBody] = useState("");
  const [addStepTemplateId, setAddStepTemplateId] = useState<number | null>(null);
  const [tagName, setTagName] = useState("");
  const [contactField, setContactField] = useState("status");
  const [contactFieldValue, setContactFieldValue] = useState("");
  const [taskTitle, setTaskTitle] = useState("");
  const [taskDescription, setTaskDescription] = useState("");
  const [taskPriority, setTaskPriority] = useState("medium");
  const [taskDueInDays, setTaskDueInDays] = useState("1");

  // Condition configs
  const [condField, setCondField] = useState("status");
  const [condOperator, setCondOperator] = useState("equals");
  const [condValue, setCondValue] = useState("");
  const [condTrueBranch, setCondTrueBranch] = useState("");
  const [condFalseBranch, setCondFalseBranch] = useState("");

  const addStepMutation = trpc.automations.addStep.useMutation({
    onSuccess: () => {
      toast.success("Step added");
      onOpenChange(false);
      onAdded();
      resetForm();
    },
    onError: (err) => toast.error(err.message),
  });

  const resetForm = () => {
    setStepType("action");
    setActionType("send_sms");
    setDelayType("minutes");
    setDelayValue("5");
    setSmsMessage("");
    setEmailSubject("");
    setEmailBody("");
    setAddStepTemplateId(null);
    setTagName("");
    setContactField("status");
    setContactFieldValue("");
    setTaskTitle("");
    setTaskDescription("");
    setTaskPriority("medium");
    setTaskDueInDays("1");
    setCondField("status");
    setCondOperator("equals");
    setCondValue("");
    setCondTrueBranch("");
    setCondFalseBranch("");
  };

  const buildConditionConfig = () => {
    return JSON.stringify({
      field: condField,
      operator: condOperator,
      value: condValue,
      ...(condTrueBranch ? { trueBranchStepOrder: parseInt(condTrueBranch) } : {}),
      ...(condFalseBranch ? { falseBranchStepOrder: parseInt(condFalseBranch) } : {}),
    });
  };

  const buildConfig = () => {
    if (stepType === "delay" || stepType === "condition") return undefined;
    switch (actionType) {
      case "send_sms":
        return JSON.stringify({ message: smsMessage });
      case "send_email":
        return JSON.stringify({
          subject: emailSubject,
          body: emailBody,
          ...(addStepTemplateId ? { templateId: addStepTemplateId } : {}),
        });
      case "add_tag":
      case "remove_tag":
        return JSON.stringify({ tag: tagName });
      case "update_contact_field":
        return JSON.stringify({ field: contactField, value: contactFieldValue });
      case "create_task":
        return JSON.stringify({
          title: taskTitle,
          description: taskDescription,
          priority: taskPriority,
          dueInDays: parseInt(taskDueInDays) || 1,
        });
      case "start_ai_call":
        return JSON.stringify({});
      default:
        return undefined;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add Step</DialogTitle>
          <DialogDescription>Add an action or delay to your workflow.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          {/* Step type toggle */}
          <div>
            <Label>Step Type</Label>
            <div className="flex gap-2 mt-1">
              <Button
                variant={stepType === "action" ? "default" : "outline"}
                size="sm"
                onClick={() => setStepType("action")}
              >
                <Zap className="h-4 w-4 mr-1" /> Action
              </Button>
              <Button
                variant={stepType === "delay" ? "default" : "outline"}
                size="sm"
                onClick={() => setStepType("delay")}
              >
                <Clock className="h-4 w-4 mr-1" /> Delay
              </Button>
              <Button
                variant={stepType === "condition" ? "default" : "outline"}
                size="sm"
                onClick={() => setStepType("condition")}
              >
                <GitBranch className="h-4 w-4 mr-1" /> Condition
              </Button>
            </div>
          </div>

          {stepType === "action" ? (
            <>
              <div>
                <Label>Action Type</Label>
                <Select value={actionType} onValueChange={setActionType}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ACTION_TYPES.map((a) => (
                      <SelectItem key={a.value} value={a.value}>
                        {a.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Action-specific config */}
              {actionType === "send_sms" && (
                <div>
                  <Label>SMS Message</Label>
                  <Textarea
                    value={smsMessage}
                    onChange={(e) => setSmsMessage(e.target.value)}
                    placeholder="Hi {{firstName}}, thanks for your interest..."
                    rows={3}
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Variables: {"{{firstName}}"}, {"{{lastName}}"}, {"{{fullName}}"}, {"{{phone}}"}, {"{{email}}"}
                  </p>
                </div>
              )}

              {actionType === "send_email" && (
                <>
                  <EmailTemplateSelector
                    accountId={accountId}
                    selectedId={addStepTemplateId}
                    onSelect={(id) => setAddStepTemplateId(id)}
                  />
                  {!addStepTemplateId && (
                    <>
                      <div>
                        <Label>Subject</Label>
                        <Input
                          value={emailSubject}
                          onChange={(e) => setEmailSubject(e.target.value)}
                          placeholder="Follow-up: {{firstName}}"
                        />
                      </div>
                      <div>
                        <Label>Body</Label>
                        <Textarea
                          value={emailBody}
                          onChange={(e) => setEmailBody(e.target.value)}
                          placeholder="Hi {{firstName}},\n\nThank you for..."
                          rows={4}
                        />
                      </div>
                    </>
                  )}
                  {addStepTemplateId && (
                    <p className="text-xs text-muted-foreground">
                      The selected email template will be used. Merge tags will be replaced with contact data.
                    </p>
                  )}
                </>
              )}

              {(actionType === "add_tag" || actionType === "remove_tag") && (
                <div>
                  <Label>Tag Name</Label>
                  <Input
                    value={tagName}
                    onChange={(e) => setTagName(e.target.value)}
                    placeholder="e.g., hot-lead"
                  />
                </div>
              )}

              {actionType === "update_contact_field" && (
                <>
                  <div>
                    <Label>Field</Label>
                    <Select value={contactField} onValueChange={setContactField}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {CONTACT_FIELDS.map((f) => (
                          <SelectItem key={f.value} value={f.value}>
                            {f.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Value</Label>
                    {contactField === "status" ? (
                      <Select value={contactFieldValue} onValueChange={setContactFieldValue}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select status" />
                        </SelectTrigger>
                        <SelectContent>
                          {PIPELINE_STAGES.map((s) => (
                            <SelectItem key={s} value={s}>
                              {s.charAt(0).toUpperCase() + s.slice(1)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <Input
                        value={contactFieldValue}
                        onChange={(e) => setContactFieldValue(e.target.value)}
                        placeholder="New value"
                      />
                    )}
                  </div>
                </>
              )}

              {actionType === "create_task" && (
                <>
                  <div>
                    <Label>Task Title</Label>
                    <Input
                      value={taskTitle}
                      onChange={(e) => setTaskTitle(e.target.value)}
                      placeholder="Follow up with {{firstName}}"
                    />
                  </div>
                  <div>
                    <Label>Description (optional)</Label>
                    <Textarea
                      value={taskDescription}
                      onChange={(e) => setTaskDescription(e.target.value)}
                      placeholder="Details about the task..."
                      rows={2}
                    />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <Label>Priority</Label>
                      <Select value={taskPriority} onValueChange={setTaskPriority}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="low">Low</SelectItem>
                          <SelectItem value="medium">Medium</SelectItem>
                          <SelectItem value="high">High</SelectItem>
                          <SelectItem value="urgent">Urgent</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Due In (days)</Label>
                      <Input
                        type="number"
                        value={taskDueInDays}
                        onChange={(e) => setTaskDueInDays(e.target.value)}
                        min="1"
                      />
                    </div>
                  </div>
                </>
              )}

              {actionType === "start_ai_call" && (
                <div className="rounded-lg bg-muted/50 p-3">
                  <p className="text-sm text-muted-foreground">
                    This action will start an AI call via VAPI to the contact's phone number.
                    The assistant is automatically selected based on the contact's lead source.
                  </p>
                </div>
              )}
            </>
          ) : stepType === "delay" ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label>Wait</Label>
                <Input
                  type="number"
                  value={delayValue}
                  onChange={(e) => setDelayValue(e.target.value)}
                  min="1"
                />
              </div>
              <div>
                <Label>Unit</Label>
                <Select value={delayType} onValueChange={setDelayType}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DELAY_TYPES.map((d) => (
                      <SelectItem key={d.value} value={d.value}>
                        {d.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          ) : (
            /* Condition step config */
            <div className="space-y-4">
              <div className="rounded-lg border border-purple-500/30 bg-purple-500/5 p-4 space-y-3">
                <div className="flex items-center gap-2 mb-1">
                  <GitBranch className="h-4 w-4 text-purple-500" />
                  <span className="text-sm font-medium text-purple-400">If / Else Condition</span>
                </div>
                <div>
                  <Label>Contact Field</Label>
                  <Select value={condField} onValueChange={setCondField}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CONDITION_FIELDS.map((f) => (
                        <SelectItem key={f.value} value={f.value}>
                          {f.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Operator</Label>
                  <Select value={condOperator} onValueChange={setCondOperator}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CONDITION_OPERATORS.map((o) => (
                        <SelectItem key={o.value} value={o.value}>
                          {o.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {condOperator !== "is_empty" && condOperator !== "is_not_empty" && (
                  <div>
                    <Label>Value</Label>
                    {condField === "status" ? (
                      <Select value={condValue} onValueChange={setCondValue}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select status" />
                        </SelectTrigger>
                        <SelectContent>
                          {PIPELINE_STAGES.map((s) => (
                            <SelectItem key={s} value={s}>
                              {s.charAt(0).toUpperCase() + s.slice(1)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <Input
                        value={condValue}
                        onChange={(e) => setCondValue(e.target.value)}
                        placeholder={condField === "has_tag" ? "e.g., hot-lead" : "Compare value"}
                      />
                    )}
                  </div>
                )}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="rounded-lg border border-green-500/30 bg-green-500/5 p-3">
                  <Label className="text-green-400 text-xs font-medium">TRUE Branch → Go to Step #</Label>
                  <Input
                    type="number"
                    value={condTrueBranch}
                    onChange={(e) => setCondTrueBranch(e.target.value)}
                    placeholder="Step order (optional)"
                    min="1"
                    className="mt-1"
                  />
                  <p className="text-xs text-muted-foreground mt-1">Leave empty to continue to next step</p>
                </div>
                <div className="rounded-lg border border-red-500/30 bg-red-500/5 p-3">
                  <Label className="text-red-400 text-xs font-medium">FALSE Branch → Go to Step #</Label>
                  <Input
                    type="number"
                    value={condFalseBranch}
                    onChange={(e) => setCondFalseBranch(e.target.value)}
                    placeholder="Step order (optional)"
                    min="1"
                    className="mt-1"
                  />
                  <p className="text-xs text-muted-foreground mt-1">Leave empty to continue to next step</p>
                </div>
              </div>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={() =>
              addStepMutation.mutate({
                accountId,
                workflowId,
                stepType,
                actionType: stepType === "action" ? (actionType as any) : undefined,
                delayType: stepType === "delay" ? (delayType as any) : undefined,
                delayValue: stepType === "delay" ? parseInt(delayValue) : undefined,
                config: buildConfig(),
                conditionConfig: stepType === "condition" ? buildConditionConfig() : undefined,
              })
            }
            disabled={addStepMutation.isPending}
          >
            {addStepMutation.isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
            Add Step
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ═══════════════════════════════════════════
// EDIT STEP DIALOG
// ═══════════════════════════════════════════
function EditStepDialog({
  open,
  onOpenChange,
  accountId,
  workflowId,
  stepId,
  step,
  onUpdated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  accountId: number;
  workflowId: number;
  stepId: number;
  step: any;
  onUpdated: () => void;
}) {
  const config = step?.config ? JSON.parse(step.config) : {};
  const condConfig = step?.conditionConfig ? JSON.parse(step.conditionConfig) : {};

  const [smsMessage, setSmsMessage] = useState(config.message ?? "");
  const [emailSubject, setEmailSubject] = useState(config.subject ?? "");
  const [emailBody, setEmailBody] = useState(config.body ?? "");
  const [editStepTemplateId, setEditStepTemplateId] = useState<number | null>(config.templateId ?? null);
  const [tagName, setTagName] = useState(config.tag ?? "");
  const [contactField, setContactField] = useState(config.field ?? "status");
  const [contactFieldValue, setContactFieldValue] = useState(config.value ?? "");
  const [taskTitle, setTaskTitle] = useState(config.title ?? "");
  const [taskDescription, setTaskDescription] = useState(config.description ?? "");
  const [taskPriority, setTaskPriority] = useState(config.priority ?? "medium");
  const [taskDueInDays, setTaskDueInDays] = useState(String(config.dueInDays ?? 1));
  const [delayValue, setDelayValue] = useState(String(step?.delayValue ?? 5));
  const [delayType, setDelayType] = useState(step?.delayType ?? "minutes");

  // Condition edit state
  const [condField, setCondField] = useState(condConfig.field ?? "status");
  const [condOperator, setCondOperator] = useState(condConfig.operator ?? "equals");
  const [condValue, setCondValue] = useState(condConfig.value ?? "");
  const [condTrueBranch, setCondTrueBranch] = useState(String(condConfig.trueBranchStepOrder ?? ""));
  const [condFalseBranch, setCondFalseBranch] = useState(String(condConfig.falseBranchStepOrder ?? ""));

  const updateMutation = trpc.automations.updateStep.useMutation({
    onSuccess: () => {
      toast.success("Step updated");
      onUpdated();
    },
    onError: (err) => toast.error(err.message),
  });

  const buildConditionConfig = () => {
    return JSON.stringify({
      field: condField,
      operator: condOperator,
      value: condValue,
      ...(condTrueBranch ? { trueBranchStepOrder: parseInt(condTrueBranch) } : {}),
      ...(condFalseBranch ? { falseBranchStepOrder: parseInt(condFalseBranch) } : {}),
    });
  };

  const buildConfig = () => {
    if (step?.stepType === "delay" || step?.stepType === "condition") return undefined;
    switch (step?.actionType) {
      case "send_sms":
        return JSON.stringify({ message: smsMessage });
      case "send_email":
        return JSON.stringify({
          subject: emailSubject,
          body: emailBody,
          ...(editStepTemplateId ? { templateId: editStepTemplateId } : {}),
        });
      case "add_tag":
      case "remove_tag":
        return JSON.stringify({ tag: tagName });
      case "update_contact_field":
        return JSON.stringify({ field: contactField, value: contactFieldValue });
      case "create_task":
        return JSON.stringify({
          title: taskTitle,
          description: taskDescription,
          priority: taskPriority,
          dueInDays: parseInt(taskDueInDays) || 1,
        });
      default:
        return undefined;
    }
  };

  if (!step) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Step</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {step.stepType === "delay" ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label>Wait</Label>
                <Input
                  type="number"
                  value={delayValue}
                  onChange={(e) => setDelayValue(e.target.value)}
                  min="1"
                />
              </div>
              <div>
                <Label>Unit</Label>
                <Select value={delayType} onValueChange={setDelayType}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DELAY_TYPES.map((d) => (
                      <SelectItem key={d.value} value={d.value}>
                        {d.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          ) : step.stepType === "condition" ? (
            <div className="space-y-4">
              <div className="rounded-lg border border-purple-500/30 bg-purple-500/5 p-4 space-y-3">
                <div className="flex items-center gap-2 mb-1">
                  <GitBranch className="h-4 w-4 text-purple-500" />
                  <span className="text-sm font-medium text-purple-400">If / Else Condition</span>
                </div>
                <div>
                  <Label>Contact Field</Label>
                  <Select value={condField} onValueChange={setCondField}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CONDITION_FIELDS.map((f) => (
                        <SelectItem key={f.value} value={f.value}>
                          {f.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Operator</Label>
                  <Select value={condOperator} onValueChange={setCondOperator}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CONDITION_OPERATORS.map((o) => (
                        <SelectItem key={o.value} value={o.value}>
                          {o.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {condOperator !== "is_empty" && condOperator !== "is_not_empty" && (
                  <div>
                    <Label>Value</Label>
                    {condField === "status" ? (
                      <Select value={condValue} onValueChange={setCondValue}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select status" />
                        </SelectTrigger>
                        <SelectContent>
                          {PIPELINE_STAGES.map((s) => (
                            <SelectItem key={s} value={s}>
                              {s.charAt(0).toUpperCase() + s.slice(1)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <Input
                        value={condValue}
                        onChange={(e) => setCondValue(e.target.value)}
                        placeholder={condField === "has_tag" ? "e.g., hot-lead" : "Compare value"}
                      />
                    )}
                  </div>
                )}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="rounded-lg border border-green-500/30 bg-green-500/5 p-3">
                  <Label className="text-green-400 text-xs font-medium">TRUE Branch → Go to Step #</Label>
                  <Input
                    type="number"
                    value={condTrueBranch}
                    onChange={(e) => setCondTrueBranch(e.target.value)}
                    placeholder="Step order (optional)"
                    min="1"
                    className="mt-1"
                  />
                  <p className="text-xs text-muted-foreground mt-1">Leave empty to continue to next step</p>
                </div>
                <div className="rounded-lg border border-red-500/30 bg-red-500/5 p-3">
                  <Label className="text-red-400 text-xs font-medium">FALSE Branch → Go to Step #</Label>
                  <Input
                    type="number"
                    value={condFalseBranch}
                    onChange={(e) => setCondFalseBranch(e.target.value)}
                    placeholder="Step order (optional)"
                    min="1"
                    className="mt-1"
                  />
                  <p className="text-xs text-muted-foreground mt-1">Leave empty to continue to next step</p>
                </div>
              </div>
            </div>
          ) : (
            <>
              {step.actionType === "send_sms" && (
                <div>
                  <Label>SMS Message</Label>
                  <Textarea
                    value={smsMessage}
                    onChange={(e) => setSmsMessage(e.target.value)}
                    rows={3}
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Variables: {"{{firstName}}"}, {"{{lastName}}"}, {"{{fullName}}"}
                  </p>
                </div>
              )}
              {step.actionType === "send_email" && (
                <>
                  <EmailTemplateSelector
                    accountId={accountId}
                    selectedId={editStepTemplateId}
                    onSelect={(id) => setEditStepTemplateId(id)}
                  />
                  {!editStepTemplateId && (
                    <>
                      <div>
                        <Label>Subject</Label>
                        <Input value={emailSubject} onChange={(e) => setEmailSubject(e.target.value)} />
                      </div>
                      <div>
                        <Label>Body</Label>
                        <Textarea value={emailBody} onChange={(e) => setEmailBody(e.target.value)} rows={4} />
                      </div>
                    </>
                  )}
                  {editStepTemplateId && (
                    <p className="text-xs text-muted-foreground">
                      The selected email template will be used. Merge tags will be replaced with contact data.
                    </p>
                  )}
                </>
              )}
              {(step.actionType === "add_tag" || step.actionType === "remove_tag") && (
                <div>
                  <Label>Tag Name</Label>
                  <Input value={tagName} onChange={(e) => setTagName(e.target.value)} />
                </div>
              )}
              {step.actionType === "update_contact_field" && (
                <>
                  <div>
                    <Label>Field</Label>
                    <Select value={contactField} onValueChange={setContactField}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {CONTACT_FIELDS.map((f) => (
                          <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Value</Label>
                    <Input value={contactFieldValue} onChange={(e) => setContactFieldValue(e.target.value)} />
                  </div>
                </>
              )}
              {step.actionType === "create_task" && (
                <>
                  <div>
                    <Label>Task Title</Label>
                    <Input value={taskTitle} onChange={(e) => setTaskTitle(e.target.value)} />
                  </div>
                  <div>
                    <Label>Description</Label>
                    <Textarea value={taskDescription} onChange={(e) => setTaskDescription(e.target.value)} rows={2} />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <Label>Priority</Label>
                      <Select value={taskPriority} onValueChange={setTaskPriority}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="low">Low</SelectItem>
                          <SelectItem value="medium">Medium</SelectItem>
                          <SelectItem value="high">High</SelectItem>
                          <SelectItem value="urgent">Urgent</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Due In (days)</Label>
                      <Input type="number" value={taskDueInDays} onChange={(e) => setTaskDueInDays(e.target.value)} min="1" />
                    </div>
                  </div>
                </>
              )}
              {step.actionType === "start_ai_call" && (
                <div className="rounded-lg bg-muted/50 p-3">
                  <p className="text-sm text-muted-foreground">
                    AI Call configuration is automatic based on the contact's lead source.
                  </p>
                </div>
              )}
            </>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            onClick={() => {
              const updateData: any = {
                accountId,
                workflowId,
                stepId,
              };
              if (step.stepType === "delay") {
                updateData.delayType = delayType;
                updateData.delayValue = parseInt(delayValue);
              } else if (step.stepType === "condition") {
                updateData.conditionConfig = buildConditionConfig();
              } else {
                updateData.config = buildConfig();
              }
              updateMutation.mutate(updateData);
            }}
            disabled={updateMutation.isPending}
          >
            {updateMutation.isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
            Save Changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ═══════════════════════════════════════════
// EXECUTION LOGS
// ═══════════════════════════════════════════
function ExecutionLogs({ accountId }: { accountId: number }) {
  const [statusFilter, setStatusFilter] = useState("");
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const { data, isLoading } = trpc.automations.listAllExecutions.useQuery({
    accountId,
    status: statusFilter || undefined,
    limit: 50,
  });

  // Get workflows for name lookup
  const { data: workflows } = trpc.automations.list.useQuery({ accountId });
  const workflowMap = useMemo(() => {
    const map: Record<number, string> = {};
    workflows?.forEach((wf) => { map[wf.id] = wf.name; });
    return map;
  }, [workflows]);

  const statusIcon = (status: string) => {
    switch (status) {
      case "completed": return <CheckCircle2 className="h-4 w-4 text-green-600" />;
      case "running": return <Loader2 className="h-4 w-4 text-blue-600 animate-spin" />;
      case "failed": return <XCircle className="h-4 w-4 text-red-500" />;
      case "paused": return <Pause className="h-4 w-4 text-amber-600" />;
      case "cancelled": return <AlertCircle className="h-4 w-4 text-muted-foreground" />;
      default: return <Clock className="h-4 w-4 text-muted-foreground" />;
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-3">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-[160px]">
            <SelectValue placeholder="All statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="running">Running</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
            <SelectItem value="failed">Failed</SelectItem>
            <SelectItem value="cancelled">Cancelled</SelectItem>
          </SelectContent>
        </Select>
        <span className="text-sm text-muted-foreground">
          {data?.total ?? 0} execution{(data?.total ?? 0) !== 1 ? "s" : ""}
        </span>
      </div>

      {data?.executions.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            No execution logs found.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {data?.executions.map((exec) => (
            <Card key={exec.id}>
              <CardContent className="py-3 px-4">
                <div
                  className="flex items-center justify-between cursor-pointer"
                  onClick={() => setExpandedId(expandedId === exec.id ? null : exec.id)}
                >
                  <div className="flex items-center gap-3">
                    {statusIcon(exec.status)}
                    <div>
                      <p className="font-medium text-sm">
                        {workflowMap[exec.workflowId] ?? `Workflow #${exec.workflowId}`}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Contact #{exec.contactId} · Step {exec.currentStep}/{exec.totalSteps} ·{" "}
                        {new Date(exec.startedAt).toLocaleString()}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge
                      variant={
                        exec.status === "completed" ? "default" :
                        exec.status === "failed" ? "destructive" : "secondary"
                      }
                      className="text-[10px]"
                    >
                      {exec.status}
                    </Badge>
                    {expandedId === exec.id ? (
                      <ChevronDown className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <ChevronRightIcon className="h-4 w-4 text-muted-foreground" />
                    )}
                  </div>
                </div>
                {expandedId === exec.id && (
                  <ExecutionDetail executionId={exec.id} accountId={accountId} />
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════
// EXECUTION DETAIL (expandable)
// ═══════════════════════════════════════════
function ExecutionDetail({
  executionId,
  accountId,
}: {
  executionId: number;
  accountId: number;
}) {
  const { data, isLoading } = trpc.automations.getExecution.useQuery({
    executionId,
    accountId,
  });

  if (isLoading) {
    return (
      <div className="pt-3 flex items-center gap-2 text-muted-foreground text-sm">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading steps...
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="pt-3 mt-3 border-t border-border/50">
      {data.errorMessage && (
        <div className="mb-3 rounded-lg bg-destructive/10 p-2 text-xs text-destructive">
          {data.errorMessage}
        </div>
      )}
      <div className="space-y-2">
        {data.steps?.map((step: any) => (
          <div key={step.id} className="flex items-center gap-3 text-sm">
            <span className="font-mono text-xs text-muted-foreground w-4 text-center">
              {step.stepOrder}
            </span>
            {step.status === "completed" ? (
              <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />
            ) : step.status === "failed" ? (
              <XCircle className="h-3.5 w-3.5 text-red-500" />
            ) : step.status === "running" ? (
              <Loader2 className="h-3.5 w-3.5 text-blue-600 animate-spin" />
            ) : (
              <Clock className="h-3.5 w-3.5 text-muted-foreground" />
            )}
            <span className="text-muted-foreground">
              {step.stepType === "delay" ? "Delay" : step.actionType?.replace(/_/g, " ")}
            </span>
            <Badge variant="outline" className="text-[10px] ml-auto">
              {step.status}
            </Badge>
            {step.errorMessage && (
              <span className="text-xs text-destructive truncate max-w-[200px]">
                {step.errorMessage}
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════
// TEMPLATES DROPDOWN
// ═══════════════════════════════════════════
function TemplatesDropdown({
  accountId,
  onCreated,
}: {
  accountId: number | null;
  onCreated: (id: number) => void;
}) {
  const { data: templates } = trpc.automations.listTemplates.useQuery();
  const provisionMutation = trpc.automations.provisionTemplate.useMutation({
    onSuccess: (data) => {
      toast.success("Template workflow created! Review the steps and activate it when ready.");
      onCreated(data.workflowId);
    },
    onError: (err) => toast.error(err.message),
  });

  if (!templates || templates.length === 0) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm">
          <FileText className="h-4 w-4 mr-1" /> Templates
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-72">
        {templates.map((t) => {
          const triggerInfo = TRIGGER_TYPES.find((tr) => tr.value === t.triggerType);
          const TriggerIcon = triggerInfo?.icon ?? Zap;
          return (
            <DropdownMenuItem
              key={t.id}
              onClick={() => {
                if (!accountId) {
                  toast.error("Select an account first");
                  return;
                }
                provisionMutation.mutate({
                  accountId,
                  templateId: t.id,
                });
              }}
              className="flex flex-col items-start gap-1 py-3 cursor-pointer"
            >
              <div className="flex items-center gap-2">
                <TriggerIcon className="h-4 w-4 text-primary" />
                <span className="font-medium text-sm">{t.name}</span>
              </div>
              <span className="text-xs text-muted-foreground pl-6">
                {t.description}
              </span>
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}


// ═══════════════════════════════════════════
// EMAIL TEMPLATE SELECTOR (shared by Add/Edit step dialogs)
// ═══════════════════════════════════════════
function EmailTemplateSelector({
  accountId,
  selectedId,
  onSelect,
}: {
  accountId: number;
  selectedId: number | null;
  onSelect: (id: number | null) => void;
}) {
  const { data: templates } = trpc.emailTemplates.list.useQuery(
    { accountId },
    { enabled: !!accountId }
  );

  if (!templates || templates.length === 0) return null;

  return (
    <div className="space-y-2">
      <Label className="flex items-center gap-2">
        <Palette className="h-4 w-4" />
        Use Email Template
      </Label>
      <Select
        value={selectedId ? String(selectedId) : "none"}
        onValueChange={(v) => onSelect(v === "none" ? null : Number(v))}
      >
        <SelectTrigger>
          <SelectValue placeholder="No template (write custom)" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="none">No template (write custom)</SelectItem>
          {templates.map((t) => (
            <SelectItem key={t.id} value={String(t.id)}>
              {t.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
