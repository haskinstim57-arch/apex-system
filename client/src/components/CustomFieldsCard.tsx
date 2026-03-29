import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
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
import { toast } from "sonner";
import {
  Database,
  Plus,
  Pencil,
  Trash2,
  GripVertical,
  Hash,
  Calendar,
  Type,
  CheckSquare,
  Link,
  Mail,
  Phone,
  AlignLeft,
  ChevronDown,
} from "lucide-react";

const FIELD_TYPES = [
  { value: "text", label: "Text", icon: Type },
  { value: "number", label: "Number", icon: Hash },
  { value: "date", label: "Date", icon: Calendar },
  { value: "dropdown", label: "Dropdown", icon: ChevronDown },
  { value: "checkbox", label: "Checkbox", icon: CheckSquare },
  { value: "textarea", label: "Text Area", icon: AlignLeft },
  { value: "url", label: "URL", icon: Link },
  { value: "email", label: "Email", icon: Mail },
  { value: "phone", label: "Phone", icon: Phone },
] as const;

type FieldType = (typeof FIELD_TYPES)[number]["value"];

interface FieldFormData {
  name: string;
  slug: string;
  type: FieldType;
  options: string[];
  required: boolean;
  sortOrder: number;
}

const defaultFormData: FieldFormData = {
  name: "",
  slug: "",
  type: "text",
  options: [],
  required: false,
  sortOrder: 0,
};

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "")
    .replace(/_+/g, "_");
}

export function CustomFieldsCard({ accountId }: { accountId: number }) {

  const utils = trpc.useUtils();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [formData, setFormData] = useState<FieldFormData>(defaultFormData);
  const [newOption, setNewOption] = useState("");
  const [autoSlug, setAutoSlug] = useState(true);

  const { data: fields = [], isLoading } = trpc.customFields.list.useQuery({ accountId });

  const createMut = trpc.customFields.create.useMutation({
    onSuccess: () => {
      utils.customFields.list.invalidate({ accountId });
      setDialogOpen(false);
      resetForm();
      toast.success("Custom field created");
    },
    onError: (err) => toast.error(err.message),
  });

  const updateMut = trpc.customFields.update.useMutation({
    onSuccess: () => {
      utils.customFields.list.invalidate({ accountId });
      setDialogOpen(false);
      resetForm();
      toast.success("Custom field updated");
    },
    onError: (err) => toast.error(err.message),
  });

  const deleteMut = trpc.customFields.delete.useMutation({
    onSuccess: () => {
      utils.customFields.list.invalidate({ accountId });
      setDeleteId(null);
      toast.success("Custom field deleted");
    },
    onError: (err) => toast.error(err.message),
  });

  const toggleMut = trpc.customFields.update.useMutation({
    onSuccess: () => {
      utils.customFields.list.invalidate({ accountId });
    },
    onError: (err) => toast.error(err.message),
  });

  function resetForm() {
    setFormData(defaultFormData);
    setEditingId(null);
    setAutoSlug(true);
    setNewOption("");
  }

  function openCreate() {
    resetForm();
    setFormData({ ...defaultFormData, sortOrder: fields.length });
    setDialogOpen(true);
  }

  function openEdit(field: (typeof fields)[number]) {
    setEditingId(field.id);
    setAutoSlug(false);
    setFormData({
      name: field.name,
      slug: field.slug,
      type: field.type as FieldType,
      options: field.options ? JSON.parse(field.options) : [],
      required: field.required,
      sortOrder: field.sortOrder,
    });
    setDialogOpen(true);
  }

  function handleSave() {
    if (!formData.name.trim() || !formData.slug.trim()) {
      toast.error("Name and slug are required");
      return;
    }
    if (formData.type === "dropdown" && formData.options.length === 0) {
      toast.error("Dropdown fields require at least one option");
      return;
    }

    if (editingId) {
      updateMut.mutate({
        id: editingId,
        accountId,
        name: formData.name,
        type: formData.type,
        options: formData.type === "dropdown" ? formData.options : undefined,
        required: formData.required,
        sortOrder: formData.sortOrder,
      });
    } else {
      createMut.mutate({
        accountId,
        name: formData.name,
        slug: formData.slug,
        type: formData.type,
        options: formData.type === "dropdown" ? formData.options : undefined,
        required: formData.required,
        sortOrder: formData.sortOrder,
      });
    }
  }

  function addOption() {
    const opt = newOption.trim();
    if (!opt) return;
    if (formData.options.includes(opt)) {
      toast.error("Duplicate option");
      return;
    }
    setFormData({ ...formData, options: [...formData.options, opt] });
    setNewOption("");
  }

  function removeOption(idx: number) {
    setFormData({ ...formData, options: formData.options.filter((_, i) => i !== idx) });
  }

  const typeIcon = (type: string) => {
    const ft = FIELD_TYPES.find((t) => t.value === type);
    if (!ft) return <Type className="h-3.5 w-3.5" />;
    const Icon = ft.icon;
    return <Icon className="h-3.5 w-3.5" />;
  };

  const typeLabel = (type: string) => {
    return FIELD_TYPES.find((t) => t.value === type)?.label || type;
  };

  const activeFields = fields.filter((f) => f.isActive);
  const inactiveFields = fields.filter((f) => !f.isActive);

  return (
    <>
      <Card className="bg-white border-0 card-shadow">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <div>
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Database className="h-4 w-4 text-muted-foreground" />
              Custom Fields
            </CardTitle>
            <CardDescription className="text-xs mt-1">
              Define custom data fields for contacts. These fields are enforced on create/update, available in CSV import/export, and usable in workflow and webhook conditions.
            </CardDescription>
          </div>
          <Button size="sm" onClick={openCreate}>
            <Plus className="h-3.5 w-3.5 mr-1" />
            Add Field
          </Button>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-xs text-muted-foreground py-4 text-center">Loading fields...</div>
          ) : fields.length === 0 ? (
            <div className="text-xs text-muted-foreground py-8 text-center">
              No custom fields defined yet. Click "Add Field" to create your first one.
            </div>
          ) : (
            <div className="space-y-1">
              {activeFields.map((field) => (
                <div
                  key={field.id}
                  className="flex items-center gap-3 px-3 py-2 rounded-md hover:bg-muted/50 group"
                >
                  <GripVertical className="h-3.5 w-3.5 text-muted-foreground/40 shrink-0" />
                  <div className="flex items-center gap-2 text-muted-foreground shrink-0">
                    {typeIcon(field.type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium truncate">{field.name}</span>
                      <code className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded font-mono">
                        {field.slug}
                      </code>
                      {field.required && (
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 border-orange-300 text-orange-600">
                          Required
                        </Badge>
                      )}
                    </div>
                    <div className="text-[10px] text-muted-foreground mt-0.5">
                      {typeLabel(field.type)}
                      {field.type === "dropdown" && field.options && (
                        <span> · {JSON.parse(field.options).length} options</span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => openEdit(field)}>
                      <Pencil className="h-3 w-3" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0"
                      onClick={() =>
                        toggleMut.mutate({
                          id: field.id,
                          accountId,
                          isActive: false,
                        })
                      }
                    >
                      <span className="text-[10px] text-muted-foreground">Disable</span>
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                      onClick={() => setDeleteId(field.id)}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              ))}

              {inactiveFields.length > 0 && (
                <div className="mt-3 pt-3 border-t">
                  <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1 px-3">
                    Disabled Fields
                  </div>
                  {inactiveFields.map((field) => (
                    <div
                      key={field.id}
                      className="flex items-center gap-3 px-3 py-2 rounded-md hover:bg-muted/50 opacity-50 group"
                    >
                      <div className="flex items-center gap-2 text-muted-foreground shrink-0">
                        {typeIcon(field.type)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <span className="text-sm truncate">{field.name}</span>
                        <code className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded font-mono ml-2">
                          {field.slug}
                        </code>
                      </div>
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2 text-xs"
                          onClick={() =>
                            toggleMut.mutate({
                              id: field.id,
                              accountId,
                              isActive: true,
                            })
                          }
                        >
                          Enable
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                          onClick={() => setDeleteId(field.id)}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={(open) => { if (!open) { setDialogOpen(false); resetForm(); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingId ? "Edit Custom Field" : "Create Custom Field"}</DialogTitle>
            <DialogDescription>
              {editingId
                ? "Update this field's configuration. The slug cannot be changed after creation."
                : "Define a new custom field for contacts in this account."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs">Field Name</Label>
              <Input
                placeholder="e.g. Loan Amount"
                value={formData.name}
                onChange={(e) => {
                  const name = e.target.value;
                  setFormData({
                    ...formData,
                    name,
                    slug: autoSlug && !editingId ? slugify(name) : formData.slug,
                  });
                }}
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Slug (API identifier)</Label>
              <Input
                placeholder="e.g. loan_amount"
                value={formData.slug}
                disabled={!!editingId}
                className={editingId ? "opacity-60" : ""}
                onChange={(e) => {
                  setAutoSlug(false);
                  setFormData({ ...formData, slug: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "_") });
                }}
              />
              <p className="text-[10px] text-muted-foreground">
                Use in CSV headers, API, and workflow conditions as <code>cf.{formData.slug || "slug"}</code>
              </p>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Field Type</Label>
              <Select
                value={formData.type}
                onValueChange={(v) => setFormData({ ...formData, type: v as FieldType })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {FIELD_TYPES.map((ft) => (
                    <SelectItem key={ft.value} value={ft.value}>
                      <span className="flex items-center gap-2">
                        <ft.icon className="h-3.5 w-3.5" />
                        {ft.label}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {formData.type === "dropdown" && (
              <div className="space-y-1.5">
                <Label className="text-xs">Dropdown Options</Label>
                <div className="flex gap-2">
                  <Input
                    placeholder="Add option..."
                    value={newOption}
                    onChange={(e) => setNewOption(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        addOption();
                      }
                    }}
                  />
                  <Button size="sm" variant="outline" onClick={addOption}>
                    Add
                  </Button>
                </div>
                {formData.options.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {formData.options.map((opt, idx) => (
                      <Badge key={idx} variant="secondary" className="text-xs gap-1 pr-1">
                        {opt}
                        <button
                          className="ml-1 hover:text-destructive"
                          onClick={() => removeOption(idx)}
                        >
                          ×
                        </button>
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div className="flex items-center gap-3">
              <Switch
                checked={formData.required}
                onCheckedChange={(checked) => setFormData({ ...formData, required: checked })}
              />
              <Label className="text-xs">Required field</Label>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => { setDialogOpen(false); resetForm(); }}>
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={createMut.isPending || updateMut.isPending}
            >
              {createMut.isPending || updateMut.isPending ? "Saving..." : editingId ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Custom Field</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this field definition. Existing contact data with this field will not be removed, but the field will no longer be enforced or displayed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteId && deleteMut.mutate({ id: deleteId, accountId })}
            >
              {deleteMut.isPending ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
