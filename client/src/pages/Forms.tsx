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
import { toast } from "sonner";

export default function Forms() {
  const { currentAccountId } = useAccount();
  const [, navigate] = useLocation();
  const [createOpen, setCreateOpen] = useState(false);
  const [newFormName, setNewFormName] = useState("");
  const [newFormAction, setNewFormAction] = useState<string>("create_contact");
  const [deleteId, setDeleteId] = useState<number | null>(null);

  const accountId = currentAccountId ?? 0;

  const { data: forms, isLoading } = trpc.forms.list.useQuery(
    { accountId },
    { enabled: accountId > 0 }
  );

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
      submitAction: newFormAction as "create_contact" | "update_contact" | "notify_only",
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

      {/* Forms Grid */}
      {isLoading ? (
        <div className="flex items-center justify-center h-48">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : !forms?.length ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <ClipboardList className="h-12 w-12 text-muted-foreground/50 mb-4" />
            <h3 className="text-lg font-medium mb-1">No forms yet</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Create your first form to start capturing leads.
            </p>
            <Button onClick={() => setCreateOpen(true)} size="sm">
              <Plus className="h-4 w-4 mr-1.5" />
              Create Form
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {forms.map((form) => (
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
                    <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                      <DropdownMenuItem onClick={() => navigate(`/forms/${form.id}`)}>
                        <Edit className="h-3.5 w-3.5 mr-2" />
                        Edit
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => copyFormUrl(form.slug)}>
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
              onClick={() => deleteId && deleteMutation.mutate({ accountId, formId: deleteId })}
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
