import { useState, useCallback, useRef, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { useAccount } from "@/contexts/AccountContext";
import { useLocation } from "wouter";
import {
  ArrowLeft,
  Plus,
  Trash2,
  GripVertical,
  Save,
  Eye,
  Loader2,
  Type,
  Mail,
  Phone,
  ChevronDown,
  CheckSquare,
  CalendarDays,
  ExternalLink,
  Copy,
  Settings2,
  ClipboardList,
  MoveUp,
  MoveDown,
  Code,
  BarChart3,
  Users,
  TrendingUp,
  Link as LinkIcon,
  Upload,
} from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";

// ─── Types ───
interface ConditionRule {
  fieldId: string;
  operator: "equals" | "not_equals" | "contains" | "is_empty" | "is_not_empty";
  value?: string;
}

interface FormField {
  id: string;
  type: "text" | "email" | "phone" | "dropdown" | "checkbox" | "date" | "file";
  label: string;
  required: boolean;
  placeholder?: string;
  options?: string[];
  contactFieldMapping?: string;
  conditionRules?: ConditionRule[];
  acceptedFileTypes?: string;
  maxFileSizeMB?: number;
}

const CONDITION_OPERATORS = [
  { value: "equals", label: "Equals" },
  { value: "not_equals", label: "Does not equal" },
  { value: "contains", label: "Contains" },
  { value: "is_empty", label: "Is empty" },
  { value: "is_not_empty", label: "Is not empty" },
];

interface FormSettings {
  submitButtonText?: string;
  successMessage?: string;
  redirectUrl?: string;
  headerText?: string;
  description?: string;
  styling?: {
    primaryColor?: string;
    backgroundColor?: string;
    fontFamily?: string;
  };
}

const FIELD_TYPES = [
  { type: "text" as const, label: "Text", icon: Type },
  { type: "email" as const, label: "Email", icon: Mail },
  { type: "phone" as const, label: "Phone", icon: Phone },
  { type: "dropdown" as const, label: "Dropdown", icon: ChevronDown },
  { type: "checkbox" as const, label: "Checkbox", icon: CheckSquare },
  { type: "date" as const, label: "Date", icon: CalendarDays },
  { type: "file" as const, label: "File Upload", icon: Upload },
];

const FILE_TYPE_PRESETS = [
  { value: "", label: "Any file" },
  { value: "image/*", label: "Images only" },
  { value: ".pdf", label: "PDF only" },
  { value: "image/*,.pdf", label: "Images & PDFs" },
  { value: ".pdf,.doc,.docx", label: "Documents" },
  { value: ".pdf,.doc,.docx,.xls,.xlsx", label: "Documents & Spreadsheets" },
];

const CONTACT_FIELD_OPTIONS = [
  { value: "", label: "None" },
  { value: "firstName", label: "First Name" },
  { value: "lastName", label: "Last Name" },
  { value: "email", label: "Email" },
  { value: "phone", label: "Phone" },
  { value: "company", label: "Company" },
  { value: "title", label: "Job Title" },
  { value: "address", label: "Address" },
  { value: "leadSource", label: "Lead Source" },
];

// ─── Main Component ───
export default function FormBuilder({ id }: { id: number }) {
  const { currentAccountId } = useAccount();
  const [, navigate] = useLocation();
  const accountId = currentAccountId ?? 0;

  const [fields, setFields] = useState<FormField[]>([]);
  const [settings, setSettings] = useState<FormSettings>({});
  const [formName, setFormName] = useState("");
  const [submitAction, setSubmitAction] = useState<string>("create_contact");
  const [selectedFieldId, setSelectedFieldId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("builder");
  const [hasChanges, setHasChanges] = useState(false);
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);
  const initialized = useRef(false);

  const { data: form, isLoading } = trpc.forms.getById.useQuery(
    { accountId, formId: id },
    { enabled: accountId > 0 && id > 0 }
  );

  const { data: submissions } = trpc.forms.listSubmissionsWithContacts.useQuery(
    { accountId, formId: id, limit: 50, offset: 0 },
    { enabled: accountId > 0 && id > 0 && activeTab === "submissions" }
  );
  const [showEmbedDialog, setShowEmbedDialog] = useState(false);

  const { data: stats } = trpc.forms.submissionStats.useQuery(
    { accountId, formId: id },
    { enabled: accountId > 0 && id > 0 }
  );

  const utils = trpc.useUtils();

  const updateMutation = trpc.forms.update.useMutation({
    onSuccess: () => {
      utils.forms.getById.invalidate({ accountId, formId: id });
      utils.forms.list.invalidate({ accountId });
      setHasChanges(false);
      toast.success("Form saved");
    },
    onError: (err) => toast.error(err.message),
  });

  // Initialize from server data
  useEffect(() => {
    if (form && !initialized.current) {
      setFields(form.fields as FormField[]);
      setSettings((form.settings as FormSettings) ?? {});
      setFormName(form.name);
      setSubmitAction(form.submitAction);
      initialized.current = true;
    }
  }, [form]);

  const markChanged = useCallback(() => setHasChanges(true), []);

  // ─── Field Operations ───
  const addField = (type: FormField["type"]) => {
    const newField: FormField = {
      id: `field_${Date.now()}`,
      type,
      label: FIELD_TYPES.find((f) => f.type === type)?.label || "Field",
      required: false,
      placeholder: "",
      options: type === "dropdown" ? ["Option 1", "Option 2"] : undefined,
    };
    setFields((prev) => [...prev, newField]);
    setSelectedFieldId(newField.id);
    markChanged();
  };

  const updateField = (fieldId: string, updates: Partial<FormField>) => {
    setFields((prev) =>
      prev.map((f) => (f.id === fieldId ? { ...f, ...updates } : f))
    );
    markChanged();
  };

  const removeField = (fieldId: string) => {
    setFields((prev) => prev.filter((f) => f.id !== fieldId));
    if (selectedFieldId === fieldId) setSelectedFieldId(null);
    markChanged();
  };

  const moveField = (fromIdx: number, toIdx: number) => {
    if (toIdx < 0 || toIdx >= fields.length) return;
    setFields((prev) => {
      const next = [...prev];
      const [moved] = next.splice(fromIdx, 1);
      next.splice(toIdx, 0, moved);
      return next;
    });
    markChanged();
  };

  // ─── Drag and Drop ───
  const handleDragStart = (idx: number) => {
    setDragIdx(idx);
  };

  const handleDragOver = (e: React.DragEvent, idx: number) => {
    e.preventDefault();
    setDragOverIdx(idx);
  };

  const handleDrop = (idx: number) => {
    if (dragIdx !== null && dragIdx !== idx) {
      moveField(dragIdx, idx);
    }
    setDragIdx(null);
    setDragOverIdx(null);
  };

  const handleDragEnd = () => {
    setDragIdx(null);
    setDragOverIdx(null);
  };

  // ─── Save ───
  const handleSave = () => {
    updateMutation.mutate({
      accountId,
      formId: id,
      name: formName,
      fields,
      settings,
      submitAction: submitAction as "create_contact" | "update_contact" | "notify_only",
    });
  };

  const copyFormUrl = () => {
    if (!form) return;
    const url = `${window.location.origin}/f/${form.slug}`;
    navigator.clipboard.writeText(url);
    toast.success("Form URL copied to clipboard");
  };

  const selectedField = fields.find((f) => f.id === selectedFieldId);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!form) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3">
        <p className="text-muted-foreground">Form not found.</p>
        <Button variant="outline" size="sm" onClick={() => navigate("/forms")}>
          <ArrowLeft className="h-4 w-4 mr-1.5" />
          Back to Forms
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate("/forms")}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <Input
              value={formName}
              onChange={(e) => {
                setFormName(e.target.value);
                markChanged();
              }}
              className="text-lg font-bold border-none shadow-none px-0 h-auto focus-visible:ring-0"
              placeholder="Form name..."
            />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={copyFormUrl}>
            <Copy className="h-3.5 w-3.5 mr-1.5" />
            Copy URL
          </Button>
          <Button variant="outline" size="sm" onClick={() => setShowEmbedDialog(true)}>
            <Code className="h-3.5 w-3.5 mr-1.5" />
            Embed
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => window.open(`/f/${form.slug}`, "_blank")}
          >
            <Eye className="h-3.5 w-3.5 mr-1.5" />
            Preview
          </Button>
          <Button
            size="sm"
            onClick={handleSave}
            disabled={!hasChanges || updateMutation.isPending}
          >
            {updateMutation.isPending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
            ) : (
              <Save className="h-3.5 w-3.5 mr-1.5" />
            )}
            Save
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="builder">Builder</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
          <TabsTrigger value="submissions">
            Submissions
            {stats && stats.total > 0 && (
              <Badge variant="secondary" className="ml-1.5 text-[10px] px-1.5">
                {stats.total}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        {/* ─── Builder Tab ─── */}
        <TabsContent value="builder" className="mt-4">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Left: Field palette + field list */}
            <div className="lg:col-span-2 space-y-4">
              {/* Add Field Buttons */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Add Field</CardTitle>
                </CardHeader>
                <CardContent className="pb-3">
                  <div className="flex flex-wrap gap-2">
                    {FIELD_TYPES.map((ft) => (
                      <Button
                        key={ft.type}
                        variant="outline"
                        size="sm"
                        onClick={() => addField(ft.type)}
                        className="text-xs"
                      >
                        <ft.icon className="h-3.5 w-3.5 mr-1.5" />
                        {ft.label}
                      </Button>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Field List */}
              {fields.length === 0 ? (
                <Card>
                  <CardContent className="flex flex-col items-center justify-center py-12">
                    <ClipboardList className="h-10 w-10 text-muted-foreground/50 mb-3" />
                    <p className="text-sm text-muted-foreground">
                      No fields yet. Click the buttons above to add fields.
                    </p>
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-2">
                  {fields.map((field, idx) => (
                    <Card
                      key={field.id}
                      draggable
                      onDragStart={() => handleDragStart(idx)}
                      onDragOver={(e) => handleDragOver(e, idx)}
                      onDrop={() => handleDrop(idx)}
                      onDragEnd={handleDragEnd}
                      className={`transition-all cursor-pointer ${
                        selectedFieldId === field.id
                          ? "ring-2 ring-primary"
                          : ""
                      } ${dragOverIdx === idx ? "border-primary border-dashed" : ""} ${
                        dragIdx === idx ? "opacity-50" : ""
                      }`}
                      onClick={() => setSelectedFieldId(field.id)}
                    >
                      <CardContent className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          <GripVertical className="h-4 w-4 text-muted-foreground cursor-grab shrink-0" />
                          <div className="flex items-center gap-2 shrink-0">
                            {(() => {
                              const Icon =
                                FIELD_TYPES.find((f) => f.type === field.type)
                                  ?.icon || Type;
                              return (
                                <Icon className="h-4 w-4 text-muted-foreground" />
                              );
                            })()}
                            <Badge variant="outline" className="text-[10px]">
                              {field.type}
                            </Badge>
                          </div>
                          <span className="text-sm font-medium truncate flex-1">
                            {field.label}
                          </span>
                          {field.required && (
                            <Badge
                              variant="secondary"
                              className="text-[10px] shrink-0"
                            >
                              Required
                            </Badge>
                          )}
                          {field.contactFieldMapping && (
                            <Badge
                              variant="outline"
                              className="text-[10px] text-blue-600 shrink-0"
                            >
                              → {field.contactFieldMapping}
                            </Badge>
                          )}
                          {field.conditionRules && field.conditionRules.length > 0 && (
                            <Badge
                              variant="outline"
                              className="text-[10px] text-amber-600 shrink-0"
                            >
                              Conditional
                            </Badge>
                          )}
                          <div className="flex items-center gap-1 shrink-0">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 w-6 p-0"
                              onClick={(e) => {
                                e.stopPropagation();
                                moveField(idx, idx - 1);
                              }}
                              disabled={idx === 0}
                            >
                              <MoveUp className="h-3 w-3" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 w-6 p-0"
                              onClick={(e) => {
                                e.stopPropagation();
                                moveField(idx, idx + 1);
                              }}
                              disabled={idx === fields.length - 1}
                            >
                              <MoveDown className="h-3 w-3" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 w-6 p-0 text-red-500 hover:text-red-600"
                              onClick={(e) => {
                                e.stopPropagation();
                                removeField(field.id);
                              }}
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>

            {/* Right: Field Properties Panel */}
            <div>
              {selectedField ? (
                <Card className="sticky top-4">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                      <Settings2 className="h-4 w-4" />
                      Field Properties
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4 pb-4">
                    <div className="space-y-2">
                      <Label className="text-xs">Label</Label>
                      <Input
                        value={selectedField.label}
                        onChange={(e) =>
                          updateField(selectedField.id, {
                            label: e.target.value,
                          })
                        }
                      />
                    </div>

                    <div className="space-y-2">
                      <Label className="text-xs">Field Type</Label>
                      <Select
                        value={selectedField.type}
                        onValueChange={(v) =>
                          updateField(selectedField.id, {
                            type: v as FormField["type"],
                            options:
                              v === "dropdown"
                                ? selectedField.options || ["Option 1", "Option 2"]
                                : undefined,
                          })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {FIELD_TYPES.map((ft) => (
                            <SelectItem key={ft.type} value={ft.type}>
                              {ft.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label className="text-xs">Placeholder</Label>
                      <Input
                        value={selectedField.placeholder || ""}
                        onChange={(e) =>
                          updateField(selectedField.id, {
                            placeholder: e.target.value,
                          })
                        }
                        placeholder="Enter placeholder text..."
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <Label className="text-xs">Required</Label>
                      <Switch
                        checked={selectedField.required}
                        onCheckedChange={(checked) =>
                          updateField(selectedField.id, { required: checked })
                        }
                      />
                    </div>

                    <div className="space-y-2">
                      <Label className="text-xs">Map to Contact Field</Label>
                      <Select
                        value={selectedField.contactFieldMapping || "none"}
                        onValueChange={(v) =>
                          updateField(selectedField.id, {
                            contactFieldMapping: v === "none" ? undefined : v,
                          })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="None" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">None</SelectItem>
                          {CONTACT_FIELD_OPTIONS.filter((o) => o.value).map(
                            (opt) => (
                              <SelectItem key={opt.value} value={opt.value}>
                                {opt.label}
                              </SelectItem>
                            )
                          )}
                        </SelectContent>
                      </Select>
                      <p className="text-[10px] text-muted-foreground">
                        Maps this field's value to a contact property on
                        submission.
                      </p>
                    </div>

                    {/* File Upload Settings */}
                    {selectedField.type === "file" && (
                      <div className="space-y-3 border-t pt-3">
                        <Label className="text-xs font-medium">File Upload Settings</Label>
                        <div className="space-y-2">
                          <Label className="text-xs">Accepted File Types</Label>
                          <Select
                            value={selectedField.acceptedFileTypes || ""}
                            onValueChange={(v) =>
                              updateField(selectedField.id, {
                                acceptedFileTypes: v || undefined,
                              })
                            }
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Any file" />
                            </SelectTrigger>
                            <SelectContent>
                              {FILE_TYPE_PRESETS.map((preset) => (
                                <SelectItem key={preset.value || "any"} value={preset.value || "any_file"}>
                                  {preset.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label className="text-xs">Max File Size (MB)</Label>
                          <Select
                            value={String(selectedField.maxFileSizeMB || 10)}
                            onValueChange={(v) =>
                              updateField(selectedField.id, {
                                maxFileSizeMB: parseInt(v),
                              })
                            }
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="2">2 MB</SelectItem>
                              <SelectItem value="5">5 MB</SelectItem>
                              <SelectItem value="10">10 MB</SelectItem>
                              <SelectItem value="25">25 MB</SelectItem>
                              <SelectItem value="50">50 MB</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    )}

                    {/* Conditional Visibility Rules */}
                    <div className="space-y-2 border-t pt-3">
                      <div className="flex items-center justify-between">
                        <Label className="text-xs font-medium">Show When</Label>
                        {(!selectedField.conditionRules || selectedField.conditionRules.length === 0) && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-6 text-[10px]"
                            onClick={() => {
                              const otherFields = fields.filter((f) => f.id !== selectedField.id);
                              if (otherFields.length === 0) {
                                toast.error("Add more fields first");
                                return;
                              }
                              updateField(selectedField.id, {
                                conditionRules: [
                                  {
                                    fieldId: otherFields[0].id,
                                    operator: "is_not_empty" as const,
                                  },
                                ],
                              });
                            }}
                          >
                            <Plus className="h-3 w-3 mr-1" />
                            Add Condition
                          </Button>
                        )}
                      </div>
                      {selectedField.conditionRules && selectedField.conditionRules.length > 0 && (
                        <div className="space-y-2">
                          {selectedField.conditionRules.map((rule, ruleIdx) => {
                            const otherFields = fields.filter((f) => f.id !== selectedField.id);
                            const needsValue = rule.operator !== "is_empty" && rule.operator !== "is_not_empty";
                            const sourceField = fields.find((f) => f.id === rule.fieldId);
                            return (
                              <div key={ruleIdx} className="bg-muted/50 rounded-md p-2 space-y-2">
                                <div className="flex items-center justify-between">
                                  <span className="text-[10px] text-muted-foreground">Rule {ruleIdx + 1}</span>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-5 w-5 p-0"
                                    onClick={() => {
                                      const newRules = (selectedField.conditionRules || []).filter((_, i) => i !== ruleIdx);
                                      updateField(selectedField.id, {
                                        conditionRules: newRules.length > 0 ? newRules : undefined,
                                      });
                                    }}
                                  >
                                    <Trash2 className="h-3 w-3 text-red-500" />
                                  </Button>
                                </div>
                                <Select
                                  value={rule.fieldId}
                                  onValueChange={(v) => {
                                    const newRules = [...(selectedField.conditionRules || [])];
                                    newRules[ruleIdx] = { ...newRules[ruleIdx], fieldId: v };
                                    updateField(selectedField.id, { conditionRules: newRules });
                                  }}
                                >
                                  <SelectTrigger className="h-7 text-xs">
                                    <SelectValue placeholder="Select field" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {otherFields.map((f) => (
                                      <SelectItem key={f.id} value={f.id}>
                                        {f.label}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                                <Select
                                  value={rule.operator}
                                  onValueChange={(v) => {
                                    const newRules = [...(selectedField.conditionRules || [])];
                                    newRules[ruleIdx] = { ...newRules[ruleIdx], operator: v as ConditionRule["operator"] };
                                    updateField(selectedField.id, { conditionRules: newRules });
                                  }}
                                >
                                  <SelectTrigger className="h-7 text-xs">
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
                                {needsValue && (
                                  sourceField?.type === "dropdown" ? (
                                    <Select
                                      value={rule.value || ""}
                                      onValueChange={(v) => {
                                        const newRules = [...(selectedField.conditionRules || [])];
                                        newRules[ruleIdx] = { ...newRules[ruleIdx], value: v };
                                        updateField(selectedField.id, { conditionRules: newRules });
                                      }}
                                    >
                                      <SelectTrigger className="h-7 text-xs">
                                        <SelectValue placeholder="Select value" />
                                      </SelectTrigger>
                                      <SelectContent>
                                        {(sourceField.options || []).map((opt) => (
                                          <SelectItem key={opt} value={opt}>
                                            {opt}
                                          </SelectItem>
                                        ))}
                                      </SelectContent>
                                    </Select>
                                  ) : (
                                    <Input
                                      value={rule.value || ""}
                                      onChange={(e) => {
                                        const newRules = [...(selectedField.conditionRules || [])];
                                        newRules[ruleIdx] = { ...newRules[ruleIdx], value: e.target.value };
                                        updateField(selectedField.id, { conditionRules: newRules });
                                      }}
                                      placeholder="Value..."
                                      className="h-7 text-xs"
                                    />
                                  )
                                )}
                              </div>
                            );
                          })}
                          <Button
                            variant="outline"
                            size="sm"
                            className="w-full text-xs h-7"
                            onClick={() => {
                              const otherFields = fields.filter((f) => f.id !== selectedField.id);
                              if (otherFields.length === 0) return;
                              updateField(selectedField.id, {
                                conditionRules: [
                                  ...(selectedField.conditionRules || []),
                                  {
                                    fieldId: otherFields[0].id,
                                    operator: "is_not_empty" as const,
                                  },
                                ],
                              });
                            }}
                          >
                            <Plus className="h-3 w-3 mr-1" />
                            Add Rule (AND)
                          </Button>
                        </div>
                      )}
                      <p className="text-[10px] text-muted-foreground">
                        Field is hidden until all conditions are met.
                      </p>
                    </div>

                    {/* Dropdown Options */}
                    {selectedField.type === "dropdown" && (
                      <div className="space-y-2">
                        <Label className="text-xs">Options</Label>
                        {(selectedField.options || []).map((opt, optIdx) => (
                          <div key={optIdx} className="flex items-center gap-2">
                            <Input
                              value={opt}
                              onChange={(e) => {
                                const newOptions = [
                                  ...(selectedField.options || []),
                                ];
                                newOptions[optIdx] = e.target.value;
                                updateField(selectedField.id, {
                                  options: newOptions,
                                });
                              }}
                              className="text-xs"
                            />
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 w-7 p-0 shrink-0"
                              onClick={() => {
                                const newOptions = (
                                  selectedField.options || []
                                ).filter((_, i) => i !== optIdx);
                                updateField(selectedField.id, {
                                  options: newOptions,
                                });
                              }}
                            >
                              <Trash2 className="h-3 w-3 text-red-500" />
                            </Button>
                          </div>
                        ))}
                        <Button
                          variant="outline"
                          size="sm"
                          className="w-full text-xs"
                          onClick={() =>
                            updateField(selectedField.id, {
                              options: [
                                ...(selectedField.options || []),
                                `Option ${(selectedField.options?.length || 0) + 1}`,
                              ],
                            })
                          }
                        >
                          <Plus className="h-3 w-3 mr-1" />
                          Add Option
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ) : (
                <Card>
                  <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                    <Settings2 className="h-8 w-8 text-muted-foreground/50 mb-2" />
                    <p className="text-sm text-muted-foreground">
                      Select a field to edit its properties.
                    </p>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        </TabsContent>

        {/* ─── Settings Tab ─── */}
        <TabsContent value="settings" className="mt-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">
                  Form Settings
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 pb-4">
                <div className="space-y-2">
                  <Label className="text-xs">Submit Button Text</Label>
                  <Input
                    value={settings.submitButtonText || ""}
                    onChange={(e) => {
                      setSettings((s) => ({
                        ...s,
                        submitButtonText: e.target.value,
                      }));
                      markChanged();
                    }}
                    placeholder="Submit"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">Success Message</Label>
                  <Textarea
                    value={settings.successMessage || ""}
                    onChange={(e) => {
                      setSettings((s) => ({
                        ...s,
                        successMessage: e.target.value,
                      }));
                      markChanged();
                    }}
                    placeholder="Thank you! Your submission has been received."
                    rows={3}
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">Redirect URL (optional)</Label>
                  <Input
                    value={settings.redirectUrl || ""}
                    onChange={(e) => {
                      setSettings((s) => ({
                        ...s,
                        redirectUrl: e.target.value,
                      }));
                      markChanged();
                    }}
                    placeholder="https://example.com/thank-you"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">Submit Action</Label>
                  <Select
                    value={submitAction}
                    onValueChange={(v) => {
                      setSubmitAction(v);
                      markChanged();
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="create_contact">
                        Create Contact
                      </SelectItem>
                      <SelectItem value="update_contact">
                        Update Contact
                      </SelectItem>
                      <SelectItem value="notify_only">Notify Only</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">
                  Appearance
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 pb-4">
                <div className="space-y-2">
                  <Label className="text-xs">Header Text</Label>
                  <Input
                    value={settings.headerText || ""}
                    onChange={(e) => {
                      setSettings((s) => ({
                        ...s,
                        headerText: e.target.value,
                      }));
                      markChanged();
                    }}
                    placeholder="Contact Us"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">Description</Label>
                  <Textarea
                    value={settings.description || ""}
                    onChange={(e) => {
                      setSettings((s) => ({
                        ...s,
                        description: e.target.value,
                      }));
                      markChanged();
                    }}
                    placeholder="Fill out this form and we'll get back to you."
                    rows={2}
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">Primary Color</Label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={settings.styling?.primaryColor || "#2563eb"}
                      onChange={(e) => {
                        setSettings((s) => ({
                          ...s,
                          styling: {
                            ...s.styling,
                            primaryColor: e.target.value,
                          },
                        }));
                        markChanged();
                      }}
                      className="h-8 w-8 rounded border cursor-pointer"
                    />
                    <Input
                      value={settings.styling?.primaryColor || "#2563eb"}
                      onChange={(e) => {
                        setSettings((s) => ({
                          ...s,
                          styling: {
                            ...s.styling,
                            primaryColor: e.target.value,
                          },
                        }));
                        markChanged();
                      }}
                      className="flex-1"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">Background Color</Label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={settings.styling?.backgroundColor || "#ffffff"}
                      onChange={(e) => {
                        setSettings((s) => ({
                          ...s,
                          styling: {
                            ...s.styling,
                            backgroundColor: e.target.value,
                          },
                        }));
                        markChanged();
                      }}
                      className="h-8 w-8 rounded border cursor-pointer"
                    />
                    <Input
                      value={settings.styling?.backgroundColor || "#ffffff"}
                      onChange={(e) => {
                        setSettings((s) => ({
                          ...s,
                          styling: {
                            ...s.styling,
                            backgroundColor: e.target.value,
                          },
                        }));
                        markChanged();
                      }}
                      className="flex-1"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ─── Submissions Tab ─── */}
        <TabsContent value="submissions" className="mt-4 space-y-4">
          {/* Stats Cards */}
          {stats && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Card>
                <CardContent className="pt-4 pb-3 px-4">
                  <div className="flex items-center gap-2 text-muted-foreground mb-1">
                    <BarChart3 className="h-3.5 w-3.5" />
                    <span className="text-[10px] uppercase tracking-wider">Total</span>
                  </div>
                  <p className="text-2xl font-bold">{stats.total}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4 pb-3 px-4">
                  <div className="flex items-center gap-2 text-muted-foreground mb-1">
                    <Users className="h-3.5 w-3.5" />
                    <span className="text-[10px] uppercase tracking-wider">Conversion</span>
                  </div>
                  <p className="text-2xl font-bold">{stats.conversionRate}%</p>
                  <p className="text-[10px] text-muted-foreground">{stats.withContact} contacts created</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4 pb-3 px-4">
                  <div className="flex items-center gap-2 text-muted-foreground mb-1">
                    <TrendingUp className="h-3.5 w-3.5" />
                    <span className="text-[10px] uppercase tracking-wider">Last 7 Days</span>
                  </div>
                  <p className="text-2xl font-bold">{stats.last7Days}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4 pb-3 px-4">
                  <div className="flex items-center gap-2 text-muted-foreground mb-1">
                    <TrendingUp className="h-3.5 w-3.5" />
                    <span className="text-[10px] uppercase tracking-wider">Last 30 Days</span>
                  </div>
                  <p className="text-2xl font-bold">{stats.last30Days}</p>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Daily Chart (simple bar visualization) */}
          {stats && stats.daily && stats.daily.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Daily Submissions (Last 30 Days)</CardTitle>
              </CardHeader>
              <CardContent className="pb-4">
                <div className="flex items-end gap-[2px] h-24">
                  {(() => {
                    const maxCount = Math.max(...stats.daily.map((d: { day: string; count: number }) => d.count), 1);
                    return stats.daily.map((d: { day: string; count: number }) => (
                      <div
                        key={d.day}
                        className="flex-1 bg-primary/80 rounded-t-sm hover:bg-primary transition-colors cursor-pointer relative group"
                        style={{ height: `${Math.max((d.count / maxCount) * 100, 4)}%` }}
                        title={`${d.day}: ${d.count} submissions`}
                      >
                        <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-popover text-popover-foreground text-[10px] px-1.5 py-0.5 rounded shadow-md hidden group-hover:block whitespace-nowrap z-10">
                          {d.day}: {d.count}
                        </div>
                      </div>
                    ));
                  })()}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Submissions Table */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Recent Submissions</CardTitle>
            </CardHeader>
            <CardContent className="pb-4">
              {!submissions?.submissions.length ? (
                <div className="text-center py-8 text-muted-foreground text-sm">
                  No submissions yet.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[50px]">#</TableHead>
                        {fields.slice(0, 4).map((f) => (
                          <TableHead key={f.id} className="text-xs">
                            {f.label}
                          </TableHead>
                        ))}
                        <TableHead className="text-xs">Contact</TableHead>
                        <TableHead className="text-xs">Date</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {submissions.submissions.map((sub, idx) => {
                        const data = sub.data as Record<string, unknown>;
                        const contactName = sub.contactFirstName
                          ? `${sub.contactFirstName} ${sub.contactLastName || ""}`.trim()
                          : null;
                        return (
                          <TableRow key={sub.id}>
                            <TableCell className="text-xs text-muted-foreground">
                              {idx + 1}
                            </TableCell>
                            {fields.slice(0, 4).map((f) => (
                              <TableCell key={f.id} className="text-xs max-w-[150px] truncate">
                                {data[f.id] !== undefined
                                  ? String(data[f.id])
                                  : "\u2014"}
                              </TableCell>
                            ))}
                            <TableCell className="text-xs">
                              {sub.contactId ? (
                                <Link href={`/contacts/${sub.contactId}`}>
                                  <Badge variant="outline" className="text-[10px] cursor-pointer hover:bg-accent">
                                    {contactName || `#${sub.contactId}`}
                                  </Badge>
                                </Link>
                              ) : (
                                <span className="text-muted-foreground">\u2014</span>
                              )}
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground">
                              {new Date(sub.createdAt).toLocaleString()}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* ─── Embed Code Dialog ─── */}
      <Dialog open={showEmbedDialog} onOpenChange={setShowEmbedDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Embed Form</DialogTitle>
            <DialogDescription>
              Copy one of the embed options below to add this form to your website.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {/* iFrame embed */}
            <div className="space-y-2">
              <Label className="text-xs font-medium">iFrame Embed</Label>
              <div className="relative">
                <pre className="bg-muted rounded-md p-3 text-xs overflow-x-auto whitespace-pre-wrap break-all font-mono">
{`<iframe
  src="${window.location.origin}/f/${form?.slug}"
  width="100%"
  height="600"
  frameborder="0"
  style="border: none; border-radius: 8px;"
></iframe>`}
                </pre>
                <Button
                  variant="ghost"
                  size="sm"
                  className="absolute top-2 right-2 h-7"
                  onClick={() => {
                    navigator.clipboard.writeText(
                      `<iframe src="${window.location.origin}/f/${form?.slug}" width="100%" height="600" frameborder="0" style="border: none; border-radius: 8px;"></iframe>`
                    );
                    toast.success("iFrame code copied");
                  }}
                >
                  <Copy className="h-3 w-3 mr-1" />
                  Copy
                </Button>
              </div>
            </div>

            {/* JavaScript embed */}
            <div className="space-y-2">
              <Label className="text-xs font-medium">JavaScript Embed</Label>
              <div className="relative">
                <pre className="bg-muted rounded-md p-3 text-xs overflow-x-auto whitespace-pre-wrap break-all font-mono">
{`<div id="apex-form-${form?.id}"></div>
<script>
(function() {
  var d = document.getElementById('apex-form-${form?.id}');
  var f = document.createElement('iframe');
  f.src = '${window.location.origin}/f/${form?.slug}';
  f.width = '100%';
  f.height = '600';
  f.frameBorder = '0';
  f.style.border = 'none';
  f.style.borderRadius = '8px';
  d.appendChild(f);
})();
</script>`}
                </pre>
                <Button
                  variant="ghost"
                  size="sm"
                  className="absolute top-2 right-2 h-7"
                  onClick={() => {
                    navigator.clipboard.writeText(
                      `<div id="apex-form-${form?.id}"></div>\n<script>\n(function() {\n  var d = document.getElementById('apex-form-${form?.id}');\n  var f = document.createElement('iframe');\n  f.src = '${window.location.origin}/f/${form?.slug}';\n  f.width = '100%';\n  f.height = '600';\n  f.frameBorder = '0';\n  f.style.border = 'none';\n  f.style.borderRadius = '8px';\n  d.appendChild(f);\n})();\n</script>`
                    );
                    toast.success("JavaScript code copied");
                  }}
                >
                  <Copy className="h-3 w-3 mr-1" />
                  Copy
                </Button>
              </div>
            </div>

            {/* Direct link */}
            <div className="space-y-2">
              <Label className="text-xs font-medium">Direct Link</Label>
              <div className="flex items-center gap-2">
                <Input
                  readOnly
                  value={`${window.location.origin}/f/${form?.slug}`}
                  className="text-xs font-mono"
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    navigator.clipboard.writeText(
                      `${window.location.origin}/f/${form?.slug}`
                    );
                    toast.success("Link copied");
                  }}
                >
                  <Copy className="h-3 w-3" />
                </Button>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEmbedDialog(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
