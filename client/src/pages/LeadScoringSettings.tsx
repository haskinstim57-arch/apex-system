import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { useAccount } from "@/contexts/AccountContext";
import { NoAccountSelected } from "@/components/NoAccountSelected";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Zap,
  Plus,
  Pencil,
  Trash2,
  Loader2,
  ArrowLeft,
  TrendingUp,
  TrendingDown,
  Info,
  GripVertical,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { toast } from "sonner";
import { useLocation } from "wouter";

// ─── Constants ───

const SCORING_EVENTS = [
  { value: "contact_created", label: "Contact Created", description: "When a new contact is added" },
  { value: "tag_added", label: "Tag Added", description: "When a tag is applied to a contact" },
  { value: "pipeline_stage_changed", label: "Pipeline Stage Changed", description: "When a contact moves to a new stage" },
  { value: "inbound_message_received", label: "Inbound Message Received", description: "When a contact replies via SMS or email" },
  { value: "appointment_booked", label: "Appointment Booked", description: "When a contact books an appointment" },
  { value: "appointment_cancelled", label: "Appointment Cancelled", description: "When a contact cancels an appointment" },
  { value: "call_completed", label: "Call Completed", description: "When a call with a contact finishes" },
  { value: "missed_call", label: "Missed Call", description: "When a call from a contact is missed" },
  { value: "form_submitted", label: "Form Submitted", description: "When a contact submits a form" },
  { value: "email_opened", label: "Email Opened", description: "When a contact opens an email" },
  { value: "link_clicked", label: "Link Clicked", description: "When a contact clicks a link" },
  { value: "facebook_lead_received", label: "Facebook Lead Received", description: "When a lead comes in from Facebook" },
] as const;

const CONDITION_OPERATORS = [
  { value: "equals", label: "Equals" },
  { value: "not_equals", label: "Not Equals" },
  { value: "contains", label: "Contains" },
  { value: "greater_than", label: "Greater Than" },
  { value: "less_than", label: "Less Than" },
] as const;

const CHANNELS = [
  { value: "sms", label: "SMS" },
  { value: "email", label: "Email" },
] as const;

type ScoringEvent = (typeof SCORING_EVENTS)[number]["value"];

interface RuleCondition {
  field?: string;
  operator?: "equals" | "not_equals" | "contains" | "greater_than" | "less_than";
  value?: string;
  tag?: string;
  toStatus?: string;
  channel?: "sms" | "email";
}

interface RuleFormState {
  name: string;
  event: ScoringEvent;
  delta: number;
  isActive: boolean;
  conditionType: "none" | "tag" | "stage" | "channel" | "field";
  condition: RuleCondition;
}

const DEFAULT_FORM: RuleFormState = {
  name: "",
  event: "contact_created",
  delta: 10,
  isActive: true,
  conditionType: "none",
  condition: {},
};

// ─── Helper: event-specific condition types ───
function getAvailableConditionTypes(event: ScoringEvent) {
  const types: { value: string; label: string }[] = [
    { value: "none", label: "No condition (always fires)" },
  ];
  if (event === "tag_added") {
    types.push({ value: "tag", label: "Specific tag" });
  }
  if (event === "pipeline_stage_changed") {
    types.push({ value: "stage", label: "Specific stage" });
  }
  if (event === "inbound_message_received") {
    types.push({ value: "channel", label: "Specific channel" });
  }
  // All events support field-based conditions
  types.push({ value: "field", label: "Contact field condition" });
  return types;
}

// ─── Helper: build condition JSON from form state ───
function buildCondition(form: RuleFormState): RuleCondition | null {
  if (form.conditionType === "none") return null;
  if (form.conditionType === "tag") return { tag: form.condition.tag || "" };
  if (form.conditionType === "stage") return { toStatus: form.condition.toStatus || "" };
  if (form.conditionType === "channel") return { channel: form.condition.channel };
  if (form.conditionType === "field") {
    return {
      field: form.condition.field || "",
      operator: (form.condition.operator || "equals") as RuleCondition["operator"],
      value: form.condition.value || "",
    };
  }
  return null;
}

// ─── Helper: parse condition from API into form state ───
function parseConditionToForm(condition: unknown): { conditionType: RuleFormState["conditionType"]; condition: RuleCondition } {
  if (!condition || typeof condition !== "object") {
    return { conditionType: "none", condition: {} };
  }
  const c = condition as RuleCondition;
  if (c.tag) return { conditionType: "tag", condition: c };
  if (c.toStatus) return { conditionType: "stage", condition: c };
  if (c.channel) return { conditionType: "channel", condition: c };
  if (c.field) return { conditionType: "field", condition: c };
  return { conditionType: "none", condition: {} };
}

// ─── Score Tier Badge ───
function ScoreDeltaBadge({ delta }: { delta: number }) {
  if (delta > 0) {
    return (
      <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-50 gap-1 font-mono text-xs">
        <TrendingUp className="h-3 w-3" />
        +{delta}
      </Badge>
    );
  }
  if (delta < 0) {
    return (
      <Badge className="bg-red-50 text-red-700 border-red-200 hover:bg-red-50 gap-1 font-mono text-xs">
        <TrendingDown className="h-3 w-3" />
        {delta}
      </Badge>
    );
  }
  return (
    <Badge variant="secondary" className="gap-1 font-mono text-xs">
      0
    </Badge>
  );
}

// ─── Condition Summary ───
function ConditionSummary({ condition }: { condition: unknown }) {
  if (!condition || typeof condition !== "object") {
    return <span className="text-muted-foreground italic text-xs">Always fires</span>;
  }
  const c = condition as RuleCondition;
  if (c.tag) {
    return (
      <span className="text-xs">
        When tag = <Badge variant="outline" className="text-[10px] h-4 px-1">{c.tag}</Badge>
      </span>
    );
  }
  if (c.toStatus) {
    return (
      <span className="text-xs">
        When stage = <Badge variant="outline" className="text-[10px] h-4 px-1">{c.toStatus}</Badge>
      </span>
    );
  }
  if (c.channel) {
    return (
      <span className="text-xs">
        When channel = <Badge variant="outline" className="text-[10px] h-4 px-1 uppercase">{c.channel}</Badge>
      </span>
    );
  }
  if (c.field && c.operator && c.value !== undefined) {
    return (
      <span className="text-xs">
        When <code className="bg-muted px-1 rounded text-[10px]">{c.field}</code>{" "}
        <span className="text-muted-foreground">{c.operator.replace("_", " ")}</span>{" "}
        <Badge variant="outline" className="text-[10px] h-4 px-1">{c.value}</Badge>
      </span>
    );
  }
  return <span className="text-muted-foreground italic text-xs">Always fires</span>;
}

// ─── Main Component ───
export default function LeadScoringSettings() {
  const { currentAccountId: accountId } = useAccount();
  const [, setLocation] = useLocation();
  const utils = trpc.useUtils();

  // State
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<any | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<any | null>(null);
  const [form, setForm] = useState<RuleFormState>({ ...DEFAULT_FORM });
  const [expandedInfo, setExpandedInfo] = useState<number | null>(null);

  // Queries
  const { data: rules, isLoading } = trpc.leadScoring.listRules.useQuery(
    { accountId: accountId! },
    { enabled: !!accountId }
  );

  // Mutations
  const createMutation = trpc.leadScoring.createRule.useMutation({
    onSuccess: () => {
      toast.success("Scoring rule created");
      utils.leadScoring.listRules.invalidate();
      closeDialog();
    },
    onError: (err) => toast.error(err.message),
  });

  const updateMutation = trpc.leadScoring.updateRule.useMutation({
    onSuccess: () => {
      toast.success("Scoring rule updated");
      utils.leadScoring.listRules.invalidate();
      closeDialog();
    },
    onError: (err) => toast.error(err.message),
  });

  const deleteMutation = trpc.leadScoring.deleteRule.useMutation({
    onSuccess: () => {
      toast.success("Scoring rule deleted");
      utils.leadScoring.listRules.invalidate();
      setDeleteConfirm(null);
    },
    onError: (err) => toast.error(err.message),
  });

  const toggleMutation = trpc.leadScoring.updateRule.useMutation({
    onSuccess: () => {
      utils.leadScoring.listRules.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  // Helpers
  function openCreate() {
    setEditingRule(null);
    setForm({ ...DEFAULT_FORM });
    setDialogOpen(true);
  }

  function openEdit(rule: any) {
    setEditingRule(rule);
    const { conditionType, condition } = parseConditionToForm(rule.condition);
    setForm({
      name: rule.name,
      event: rule.event,
      delta: rule.delta,
      isActive: rule.isActive,
      conditionType,
      condition,
    });
    setDialogOpen(true);
  }

  function closeDialog() {
    setDialogOpen(false);
    setEditingRule(null);
    setForm({ ...DEFAULT_FORM });
  }

  function handleSubmit() {
    if (!form.name.trim()) {
      toast.error("Rule name is required");
      return;
    }
    if (form.delta === 0) {
      toast.error("Score delta cannot be zero");
      return;
    }

    const condition = buildCondition(form);

    if (editingRule) {
      updateMutation.mutate({
        id: editingRule.id,
        accountId: accountId!,
        name: form.name.trim(),
        event: form.event,
        delta: form.delta,
        condition: condition,
        isActive: form.isActive,
      });
    } else {
      createMutation.mutate({
        accountId: accountId!,
        name: form.name.trim(),
        event: form.event,
        delta: form.delta,
        condition: condition,
        isActive: form.isActive,
      });
    }
  }

  function handleToggle(rule: any) {
    toggleMutation.mutate({
      id: rule.id,
      accountId: accountId!,
      isActive: !rule.isActive,
    });
  }

  // Stats
  const activeCount = useMemo(() => rules?.filter((r: any) => r.isActive).length ?? 0, [rules]);
  const totalRules = rules?.length ?? 0;
  const positiveRules = useMemo(() => rules?.filter((r: any) => r.delta > 0).length ?? 0, [rules]);
  const negativeRules = useMemo(() => rules?.filter((r: any) => r.delta < 0).length ?? 0, [rules]);

  if (!accountId) {
    return <NoAccountSelected />;
  }

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="sm"
          className="h-8 w-8 p-0"
          onClick={() => setLocation("/settings")}
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
            <Zap className="h-5 w-5 text-amber-500" />
            Lead Scoring Rules
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Define rules that automatically adjust contact scores based on their actions and engagement.
          </p>
        </div>
        <Button size="sm" className="h-9 gap-1.5" onClick={openCreate}>
          <Plus className="h-3.5 w-3.5" />
          New Rule
        </Button>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="bg-card border-0 card-shadow">
          <CardContent className="py-3 px-4">
            <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Total Rules</p>
            <p className="text-lg font-bold">{totalRules}</p>
          </CardContent>
        </Card>
        <Card className="bg-card border-0 card-shadow">
          <CardContent className="py-3 px-4">
            <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Active</p>
            <p className="text-lg font-bold text-emerald-600">{activeCount}</p>
          </CardContent>
        </Card>
        <Card className="bg-card border-0 card-shadow">
          <CardContent className="py-3 px-4">
            <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Boost Rules</p>
            <p className="text-lg font-bold text-blue-600">{positiveRules}</p>
          </CardContent>
        </Card>
        <Card className="bg-card border-0 card-shadow">
          <CardContent className="py-3 px-4">
            <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Penalty Rules</p>
            <p className="text-lg font-bold text-red-600">{negativeRules}</p>
          </CardContent>
        </Card>
      </div>

      {/* Scoring Tiers Reference */}
      <Card className="bg-card border-0 card-shadow">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Info className="h-4 w-4 text-muted-foreground" />
            Score Tiers Reference
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-4 gap-3">
            <div className="flex items-center gap-2 p-2.5 rounded-lg bg-slate-50 border border-slate-200">
              <div className="h-2.5 w-2.5 rounded-full bg-slate-400" />
              <div>
                <p className="text-xs font-semibold text-slate-600">Cold</p>
                <p className="text-[10px] text-slate-500">0–19 pts</p>
              </div>
            </div>
            <div className="flex items-center gap-2 p-2.5 rounded-lg bg-amber-50 border border-amber-200">
              <div className="h-2.5 w-2.5 rounded-full bg-amber-400" />
              <div>
                <p className="text-xs font-semibold text-amber-600">Warm</p>
                <p className="text-[10px] text-amber-500">20–49 pts</p>
              </div>
            </div>
            <div className="flex items-center gap-2 p-2.5 rounded-lg bg-orange-50 border border-orange-200">
              <div className="h-2.5 w-2.5 rounded-full bg-orange-400" />
              <div>
                <p className="text-xs font-semibold text-orange-600">Hot</p>
                <p className="text-[10px] text-orange-500">50–79 pts</p>
              </div>
            </div>
            <div className="flex items-center gap-2 p-2.5 rounded-lg bg-red-50 border border-red-200">
              <div className="h-2.5 w-2.5 rounded-full bg-red-500" />
              <div>
                <p className="text-xs font-semibold text-red-600">On Fire</p>
                <p className="text-[10px] text-red-500">80+ pts</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Rules List */}
      <Card className="bg-card border-0 card-shadow">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium">Scoring Rules</CardTitle>
          <CardDescription className="text-xs">
            Rules are evaluated in order when events occur. Each matching rule adjusts the contact's score by its delta.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : !rules || rules.length === 0 ? (
            <div className="text-center py-12">
              <Zap className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-sm font-medium text-muted-foreground">No scoring rules yet</p>
              <p className="text-xs text-muted-foreground mt-1 mb-4">
                Create your first rule to start automatically scoring leads.
              </p>
              <Button size="sm" onClick={openCreate} className="gap-1.5">
                <Plus className="h-3.5 w-3.5" />
                Create First Rule
              </Button>
            </div>
          ) : (
            <div className="space-y-2">
              {rules.map((rule: any, idx: number) => {
                const eventInfo = SCORING_EVENTS.find((e) => e.value === rule.event);
                const isExpanded = expandedInfo === rule.id;

                return (
                  <div
                    key={rule.id}
                    className={`group rounded-lg border transition-all ${
                      rule.isActive
                        ? "border-border/50 bg-card hover:border-border"
                        : "border-border/30 bg-muted/30 opacity-70"
                    }`}
                  >
                    {/* Main row */}
                    <div className="flex items-center gap-3 px-4 py-3">
                      <div className="text-muted-foreground/40 shrink-0">
                        <GripVertical className="h-4 w-4" />
                      </div>

                      {/* Toggle */}
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <div>
                              <Switch
                                checked={rule.isActive}
                                onCheckedChange={() => handleToggle(rule)}
                                className="data-[state=checked]:bg-emerald-500"
                              />
                            </div>
                          </TooltipTrigger>
                          <TooltipContent side="top">
                            <p className="text-xs">{rule.isActive ? "Disable rule" : "Enable rule"}</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium truncate">{rule.name}</p>
                          <ScoreDeltaBadge delta={rule.delta} />
                        </div>
                        <div className="flex items-center gap-2 mt-0.5">
                          <Badge variant="outline" className="text-[10px] h-4 px-1.5 font-normal">
                            {eventInfo?.label || rule.event}
                          </Badge>
                          <ConditionSummary condition={rule.condition} />
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0"
                          onClick={() => setExpandedInfo(isExpanded ? null : rule.id)}
                        >
                          {isExpanded ? (
                            <ChevronUp className="h-3.5 w-3.5" />
                          ) : (
                            <ChevronDown className="h-3.5 w-3.5" />
                          )}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0"
                          onClick={() => openEdit(rule)}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                          onClick={() => setDeleteConfirm(rule)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>

                    {/* Expanded detail */}
                    {isExpanded && (
                      <div className="px-4 pb-3 pt-0 border-t border-border/30">
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-3 text-xs">
                          <div>
                            <p className="text-muted-foreground font-medium mb-0.5">Event</p>
                            <p>{eventInfo?.label || rule.event}</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground font-medium mb-0.5">Description</p>
                            <p>{eventInfo?.description || "—"}</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground font-medium mb-0.5">Score Change</p>
                            <p className={rule.delta > 0 ? "text-emerald-600" : rule.delta < 0 ? "text-red-600" : ""}>
                              {rule.delta > 0 ? "+" : ""}{rule.delta} points
                            </p>
                          </div>
                          <div>
                            <p className="text-muted-foreground font-medium mb-0.5">Created</p>
                            <p>{new Date(rule.createdAt).toLocaleDateString()}</p>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ─── Create / Edit Dialog ─── */}
      <Dialog open={dialogOpen} onOpenChange={(open) => !open && closeDialog()}>
        <DialogContent className="sm:max-w-[520px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Zap className="h-4 w-4 text-amber-500" />
              {editingRule ? "Edit Scoring Rule" : "New Scoring Rule"}
            </DialogTitle>
            <DialogDescription>
              {editingRule
                ? "Update this rule's trigger event, conditions, and score delta."
                : "Define when and how much a contact's score should change."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Rule Name */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Rule Name *</Label>
              <Input
                placeholder="e.g. Boost on appointment booked"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="h-9 text-sm"
              />
            </div>

            {/* Event + Delta Row */}
            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2 space-y-1.5">
                <Label className="text-xs font-medium">Trigger Event *</Label>
                <Select
                  value={form.event}
                  onValueChange={(v) => {
                    const newEvent = v as ScoringEvent;
                    // Reset condition type if it's no longer valid for the new event
                    const available = getAvailableConditionTypes(newEvent);
                    const stillValid = available.some((a) => a.value === form.conditionType);
                    setForm({
                      ...form,
                      event: newEvent,
                      conditionType: stillValid ? form.conditionType : "none",
                      condition: stillValid ? form.condition : {},
                    });
                  }}
                >
                  <SelectTrigger className="h-9 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SCORING_EVENTS.map((e) => (
                      <SelectItem key={e.value} value={e.value}>
                        <span className="text-sm">{e.label}</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Score Delta *</Label>
                <div className="relative">
                  <Input
                    type="number"
                    value={form.delta}
                    onChange={(e) => setForm({ ...form, delta: parseInt(e.target.value) || 0 })}
                    className={`h-9 text-sm font-mono ${
                      form.delta > 0
                        ? "text-emerald-600 border-emerald-200"
                        : form.delta < 0
                          ? "text-red-600 border-red-200"
                          : ""
                    }`}
                  />
                  <div className="absolute right-2 top-1/2 -translate-y-1/2">
                    {form.delta > 0 ? (
                      <TrendingUp className="h-3.5 w-3.5 text-emerald-500" />
                    ) : form.delta < 0 ? (
                      <TrendingDown className="h-3.5 w-3.5 text-red-500" />
                    ) : null}
                  </div>
                </div>
                <p className="text-[10px] text-muted-foreground">
                  Positive = boost, negative = penalty
                </p>
              </div>
            </div>

            {/* Condition Type */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Condition</Label>
              <Select
                value={form.conditionType}
                onValueChange={(v) =>
                  setForm({
                    ...form,
                    conditionType: v as RuleFormState["conditionType"],
                    condition: {},
                  })
                }
              >
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {getAvailableConditionTypes(form.event).map((ct) => (
                    <SelectItem key={ct.value} value={ct.value}>
                      {ct.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Condition Fields */}
            {form.conditionType === "tag" && (
              <div className="space-y-1.5 pl-3 border-l-2 border-amber-200">
                <Label className="text-xs font-medium">Tag Name</Label>
                <Input
                  placeholder="e.g. VIP, Hot Lead"
                  value={form.condition.tag || ""}
                  onChange={(e) =>
                    setForm({ ...form, condition: { ...form.condition, tag: e.target.value } })
                  }
                  className="h-9 text-sm"
                />
              </div>
            )}

            {form.conditionType === "stage" && (
              <div className="space-y-1.5 pl-3 border-l-2 border-amber-200">
                <Label className="text-xs font-medium">Pipeline Stage</Label>
                <Input
                  placeholder="e.g. qualified, proposal"
                  value={form.condition.toStatus || ""}
                  onChange={(e) =>
                    setForm({ ...form, condition: { ...form.condition, toStatus: e.target.value } })
                  }
                  className="h-9 text-sm"
                />
              </div>
            )}

            {form.conditionType === "channel" && (
              <div className="space-y-1.5 pl-3 border-l-2 border-amber-200">
                <Label className="text-xs font-medium">Channel</Label>
                <Select
                  value={form.condition.channel || "sms"}
                  onValueChange={(v) =>
                    setForm({
                      ...form,
                      condition: { ...form.condition, channel: v as "sms" | "email" },
                    })
                  }
                >
                  <SelectTrigger className="h-9 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CHANNELS.map((ch) => (
                      <SelectItem key={ch.value} value={ch.value}>
                        {ch.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {form.conditionType === "field" && (
              <div className="space-y-3 pl-3 border-l-2 border-amber-200">
                <div className="grid grid-cols-3 gap-2">
                  <div className="space-y-1">
                    <Label className="text-[10px] font-medium">Field</Label>
                    <Input
                      placeholder="e.g. status"
                      value={form.condition.field || ""}
                      onChange={(e) =>
                        setForm({ ...form, condition: { ...form.condition, field: e.target.value } })
                      }
                      className="h-8 text-xs"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[10px] font-medium">Operator</Label>
                    <Select
                      value={form.condition.operator || "equals"}
                      onValueChange={(v) =>
                        setForm({ ...form, condition: { ...form.condition, operator: v as RuleCondition["operator"] } })
                      }
                    >
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {CONDITION_OPERATORS.map((op) => (
                          <SelectItem key={op.value} value={op.value}>
                            {op.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[10px] font-medium">Value</Label>
                    <Input
                      placeholder="e.g. qualified"
                      value={form.condition.value || ""}
                      onChange={(e) =>
                        setForm({ ...form, condition: { ...form.condition, value: e.target.value } })
                      }
                      className="h-8 text-xs"
                    />
                  </div>
                </div>
              </div>
            )}

            <Separator />

            {/* Active Toggle */}
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-xs font-medium">Rule Active</Label>
                <p className="text-[10px] text-muted-foreground">
                  Inactive rules are saved but won't fire on events.
                </p>
              </div>
              <Switch
                checked={form.isActive}
                onCheckedChange={(checked) => setForm({ ...form, isActive: checked })}
                className="data-[state=checked]:bg-emerald-500"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={closeDialog} className="border-border/50">
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={createMutation.isPending || updateMutation.isPending}
            >
              {(createMutation.isPending || updateMutation.isPending) && (
                <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
              )}
              {editingRule ? "Save Changes" : "Create Rule"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Delete Confirmation ─── */}
      <AlertDialog open={!!deleteConfirm} onOpenChange={(open) => !open && setDeleteConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Scoring Rule</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete <strong>{deleteConfirm?.name}</strong>? This action cannot
              be undone. Existing contact scores will not be affected.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (deleteConfirm) {
                  deleteMutation.mutate({
                    id: deleteConfirm.id,
                    accountId: accountId!,
                  });
                }
              }}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending && (
                <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
              )}
              Delete Rule
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
