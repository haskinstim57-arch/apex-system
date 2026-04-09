import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useAccount } from "@/contexts/AccountContext";
import { useLocation } from "wouter";
import {
  Plus,
  FileText,
  MoreHorizontal,
  Trash2,
  Edit,
  Copy,
  ExternalLink,
  Eye,
  EyeOff,
  Loader2,
  ClipboardList,
  BarChart3,
  LayoutTemplate,
  FlaskConical,
  Upload,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";

const TEMPLATE_COLORS: Record<string, string> = {
  Mortgage: "bg-blue-100 text-blue-700",
  General: "bg-green-100 text-green-700",
  Referral: "bg-red-100 text-red-700",
};

export default function Forms() {
  const { currentAccountId } = useAccount();
  const [, navigate] = useLocation();
  const [createOpen, setCreateOpen] = useState(false);
  const [newFormName, setNewFormName] = useState("");
  const [newFormAction, setNewFormAction] = useState<string>("create_contact");
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [abTestFormId, setAbTestFormId] = useState<number | null>(null);
  const [abVariantName, setAbVariantName] = useState("");
  const [activeTab, setActiveTab] = useState("forms");

  const accountId = currentAccountId ?? 0;

  const { data: formsList, isLoading } = trpc.forms.list.useQuery(
    { accountId },
    { enabled: accountId > 0 }
  );

  const { data: templates } = trpc.forms.listTemplates.useQuery(undefined, {
    enabled: activeTab === "templates",
  });

  const utils = trpc.useUtils();

  const createMutation = trpc.forms.create.useMutation({
    onSuccess: (result) => {
      utils.forms.list.invalidate({ accountId });
      setCreateOpen(false);
      setNewFormName("");
      toast.success("Form created");
      navigate(`/forms/${result.id}`);
    },
    onError: (err) => toast.error(err.message),
  });

  const createFromTemplateMutation = trpc.forms.createFromTemplate.useMutation({
    onSuccess: (result) => {
      utils.forms.list.invalidate({ accountId });
      toast.success("Form created from template");
      navigate(`/forms/${result.id}`);
    },
    onError: (err) => toast.error(err.message),
  });

  const duplicateMutation = trpc.forms.duplicate.useMutation({
    onSuccess: (result) => {
      utils.forms.list.invalidate({ accountId });
      setAbTestFormId(null);
      setAbVariantName("");
      toast.success("A/B variant created");
      navigate(`/forms/${result.id}`);
    },
    onError: (err) => toast.error(err.message),
  });

  const deleteMutation = trpc.forms.delete.useMutation({
    onSuccess: () => {
      utils.forms.list.invalidate({ accountId });
      setDeleteId(null);
      toast.success("Form deleted");
    },
    onError: (err) => toast.error(err.message),
  });

  const toggleMutation = trpc.forms.update.useMutation({
    onSuccess: () => {
      utils.forms.list.invalidate({ accountId });
      toast.success("Form updated");
    },
    onError: (err) => toast.error(err.message),
  });

  const handleCreate = () => {
    if (!newFormName.trim()) return;
    createMutation.mutate({
      accountId,
      name: newFormName.trim(),
      fields: [
        {
          id: "field_1",
          type: "text",
          label: "First Name",
          required: true,
          placeholder: "Enter your first name",
          contactFieldMapping: "firstName",
        },
        {
          id: "field_2",
          type: "text",
          label: "Last Name",
          required: true,
          placeholder: "Enter your last name",
          contactFieldMapping: "lastName",
        },
        {
          id: "field_3",
          type: "email",
          label: "Email",
          required: true,
          placeholder: "you@example.com",
          contactFieldMapping: "email",
        },
        {
          id: "field_4",
          type: "phone",
          label: "Phone",
          required: false,
          placeholder: "(555) 123-4567",
          contactFieldMapping: "phone",
        },
      ],
      submitAction: newFormAction as
        | "create_contact"
        | "update_contact"
        | "notify_only",
    });
  };

  const copyFormUrl = (slug: string) => {
    const url = `${window.location.origin}/f/${slug}`;
    navigator.clipboard.writeText(url);
    toast.success("Form URL copied to clipboard");
  };

  if (!accountId) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        Select an account to manage forms.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Forms</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Build and manage lead capture forms for your account.
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)} size="sm">
          <Plus className="h-4 w-4 mr-1.5" />
          New Form
        </Button>
      </div>

      {/* Tabs: My Forms | Templates */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="forms" className="gap-1.5">
            <ClipboardList className="h-3.5 w-3.5" />
            My Forms
          </TabsTrigger>
          <TabsTrigger value="templates" className="gap-1.5">
            <LayoutTemplate className="h-3.5 w-3.5" />
            Templates
          </TabsTrigger>
        </TabsList>

        {/* My Forms Tab */}
        <TabsContent value="forms" className="mt-4">
          {isLoading ? (
            <div className="flex items-center justify-center h-48">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : !formsList?.length ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-16">
                <ClipboardList className="h-12 w-12 text-muted-foreground/50 mb-4" />
                <h3 className="text-lg font-medium mb-1">No forms yet</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Create your first form or start from a template.
                </p>
                <div className="flex gap-2">
                  <Button onClick={() => setCreateOpen(true)} size="sm">
                    <Plus className="h-4 w-4 mr-1.5" />
                    Create Form
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setActiveTab("templates")}
                  >
                    <LayoutTemplate className="h-4 w-4 mr-1.5" />
                    Browse Templates
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {formsList.map((form) => (
                <Card
                  key={form.id}
                  className="group hover:shadow-md transition-shadow cursor-pointer"
                  onClick={() => navigate(`/forms/${form.id}`)}
                >
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4 text-primary" />
                        <CardTitle className="text-sm font-medium line-clamp-1">
                          {form.name}
                        </CardTitle>
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger
                          asChild
                          onClick={(e) => e.stopPropagation()}
                        >
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent
                          align="end"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <DropdownMenuItem
                            onClick={() => navigate(`/forms/${form.id}`)}
                          >
                            <Edit className="h-3.5 w-3.5 mr-2" />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => copyFormUrl(form.slug)}
                          >
                            <Copy className="h-3.5 w-3.5 mr-2" />
                            Copy URL
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() =>
                              window.open(`/f/${form.slug}`, "_blank")
                            }
                          >
                            <ExternalLink className="h-3.5 w-3.5 mr-2" />
                            Preview
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => {
                              setAbTestFormId(form.id);
                              setAbVariantName(`${form.name} (Variant B)`);
                            }}
                          >
                            <FlaskConical className="h-3.5 w-3.5 mr-2" />
                            Create A/B Variant
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() =>
                              duplicateMutation.mutate({
                                accountId,
                                formId: form.id,
                              })
                            }
                          >
                            <Copy className="h-3.5 w-3.5 mr-2" />
                            Duplicate
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() =>
                              toggleMutation.mutate({
                                accountId,
                                formId: form.id,
                                isActive: !form.isActive,
                              })
                            }
                          >
                            {form.isActive ? (
                              <>
                                <EyeOff className="h-3.5 w-3.5 mr-2" />
                                Deactivate
                              </>
                            ) : (
                              <>
                                <Eye className="h-3.5 w-3.5 mr-2" />
                                Activate
                              </>
                            )}
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className="text-red-600"
                            onClick={() => setDeleteId(form.id)}
                          >
                            <Trash2 className="h-3.5 w-3.5 mr-2" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                    <CardDescription className="text-xs mt-1">
                      {(form.fields as unknown[])?.length ?? 0} fields &middot;{" "}
                      {form.submitAction.replace(/_/g, " ")}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <div className="flex items-center justify-between">
                      <Badge
                        variant={form.isActive ? "default" : "secondary"}
                        className="text-[10px]"
                      >
                        {form.isActive ? "Active" : "Inactive"}
                      </Badge>
                      <span className="text-[10px] text-muted-foreground">
                        {new Date(form.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Templates Tab */}
        <TabsContent value="templates" className="mt-4">
          {!templates ? (
            <div className="flex items-center justify-center h-48">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Start with a pre-built template and customize it to fit your
                needs.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {templates.map((tpl) => (
                  <Card
                    key={tpl.id}
                    className="hover:shadow-md transition-shadow"
                  >
                    <CardHeader className="pb-2">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-2">
                          <LayoutTemplate className="h-4 w-4 text-primary" />
                          <CardTitle className="text-sm font-medium">
                            {tpl.name}
                          </CardTitle>
                        </div>
                        <Badge
                          variant="secondary"
                          className={`text-[10px] ${TEMPLATE_COLORS[tpl.category] || "bg-muted text-foreground"}`}
                        >
                          {tpl.category}
                        </Badge>
                      </div>
                      <CardDescription className="text-xs mt-1">
                        {tpl.description}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-muted-foreground">
                          {tpl.fieldCount} fields
                        </span>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs"
                          onClick={() =>
                            createFromTemplateMutation.mutate({
                              accountId,
                              templateId: tpl.id,
                            })
                          }
                          disabled={createFromTemplateMutation.isPending}
                        >
                          {createFromTemplateMutation.isPending ? (
                            <Loader2 className="h-3 w-3 animate-spin mr-1" />
                          ) : (
                            <Plus className="h-3 w-3 mr-1" />
                          )}
                          Use Template
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Create Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Form</DialogTitle>
            <DialogDescription>
              Give your form a name and choose what happens when it's submitted.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Form Name</Label>
              <Input
                placeholder="e.g., Home Buyer Inquiry"
                value={newFormName}
                onChange={(e) => setNewFormName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleCreate()}
              />
            </div>
            <div className="space-y-2">
              <Label>Submit Action</Label>
              <Select value={newFormAction} onValueChange={setNewFormAction}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="create_contact">Create Contact</SelectItem>
                  <SelectItem value="update_contact">Update Contact</SelectItem>
                  <SelectItem value="notify_only">Notify Only</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {newFormAction === "create_contact"
                  ? "Creates a new contact in your CRM when the form is submitted."
                  : newFormAction === "update_contact"
                    ? "Updates an existing contact if found by email/phone, otherwise creates new."
                    : "Only records the submission and notifies you. No contact is created."}
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleCreate}
              disabled={!newFormName.trim() || createMutation.isPending}
            >
              {createMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-1.5" />
              ) : null}
              Create & Edit
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* A/B Test Variant Dialog */}
      <Dialog
        open={abTestFormId !== null}
        onOpenChange={() => {
          setAbTestFormId(null);
          setAbVariantName("");
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FlaskConical className="h-5 w-5 text-purple-600" />
              Create A/B Test Variant
            </DialogTitle>
            <DialogDescription>
              This will duplicate the form so you can make changes and compare
              conversion rates between the two versions. Share both form URLs to
              split traffic.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Variant Name</Label>
              <Input
                placeholder="e.g., Mortgage Inquiry (Variant B)"
                value={abVariantName}
                onChange={(e) => setAbVariantName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && abTestFormId && abVariantName.trim()) {
                    duplicateMutation.mutate({
                      accountId,
                      formId: abTestFormId,
                      name: abVariantName.trim(),
                      isAbVariant: true,
                    });
                  }
                }}
              />
            </div>
            <div className="rounded-lg bg-purple-50 border border-purple-200 p-3">
              <h4 className="text-xs font-medium text-purple-800 mb-1">
                A/B Testing Tips
              </h4>
              <ul className="text-xs text-purple-700 space-y-1">
                <li>
                  &bull; Change only one element at a time (headline, button
                  text, field order)
                </li>
                <li>
                  &bull; Share both form URLs equally to get a fair comparison
                </li>
                <li>
                  &bull; Compare conversion rates in the Submissions tab of each
                  form
                </li>
                <li>
                  &bull; Run the test for at least 100 submissions per variant
                  for reliable data
                </li>
              </ul>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setAbTestFormId(null);
                setAbVariantName("");
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (abTestFormId && abVariantName.trim()) {
                  duplicateMutation.mutate({
                    accountId,
                    formId: abTestFormId,
                    name: abVariantName.trim(),
                    isAbVariant: true,
                  });
                }
              }}
              disabled={
                !abVariantName.trim() || duplicateMutation.isPending
              }
              className="bg-purple-600 hover:bg-purple-700"
            >
              {duplicateMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-1.5" />
              ) : (
                <FlaskConical className="h-4 w-4 mr-1.5" />
              )}
              Create Variant
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <Dialog open={deleteId !== null} onOpenChange={() => setDeleteId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Form</DialogTitle>
            <DialogDescription>
              Are you sure? This will permanently delete this form and all its
              submissions. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteId(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() =>
                deleteId &&
                deleteMutation.mutate({ accountId, formId: deleteId })
              }
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-1.5" />
              ) : null}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
