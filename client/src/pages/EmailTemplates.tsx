import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useAccount } from "@/contexts/AccountContext";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Plus,
  MoreVertical,
  Pencil,
  Trash2,
  Copy,
  Mail,
  FileText,
} from "lucide-react";
import { toast } from "sonner";

export default function EmailTemplates() {
  const { currentAccount } = useAccount();
  const [, navigate] = useLocation();
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [newSubject, setNewSubject] = useState("");
  const [deleteId, setDeleteId] = useState<number | null>(null);

  const accountId = currentAccount?.id;

  const { data: templates, isLoading } = trpc.emailTemplates.list.useQuery(
    { accountId: accountId! },
    { enabled: !!accountId }
  );

  const utils = trpc.useUtils();

  const createMutation = trpc.emailTemplates.create.useMutation({
    onSuccess: (data) => {
      toast.success("Template created");
      setShowCreate(false);
      setNewName("");
      setNewSubject("");
      utils.emailTemplates.list.invalidate();
      navigate(`/email-templates/${data.id}`);
    },
    onError: (err) => toast.error(err.message),
  });

  const deleteMutation = trpc.emailTemplates.delete.useMutation({
    onSuccess: () => {
      toast.success("Template deleted");
      setDeleteId(null);
      utils.emailTemplates.list.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  const duplicateMutation = trpc.emailTemplates.create.useMutation({
    onSuccess: (data) => {
      toast.success("Template duplicated");
      utils.emailTemplates.list.invalidate();
      navigate(`/email-templates/${data.id}`);
    },
    onError: (err) => toast.error(err.message),
  });

  function handleDuplicate(template: NonNullable<typeof templates>[0]) {
    if (!accountId) return;
    duplicateMutation.mutate({
      accountId,
      name: `${template.name} (Copy)`,
      subject: template.subject,
      htmlContent: template.htmlContent ?? undefined,
      jsonBlocks: template.jsonBlocks ?? undefined,
    });
  }

  function formatDate(date: Date | string) {
    return new Date(date).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  }

  if (!accountId) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        Select an account to manage email templates
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Email Templates</h1>
          <p className="text-muted-foreground mt-1">
            Create and manage reusable email templates for campaigns and automations
          </p>
        </div>
        <Button onClick={() => setShowCreate(true)} className="gap-2">
          <Plus className="h-4 w-4" />
          New Template
        </Button>
      </div>

      {/* Template Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="animate-pulse">
              <CardHeader className="pb-3">
                <div className="h-5 bg-muted rounded w-3/4" />
              </CardHeader>
              <CardContent>
                <div className="h-4 bg-muted rounded w-1/2 mb-2" />
                <div className="h-4 bg-muted rounded w-1/3" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : !templates?.length ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <div className="rounded-full bg-muted p-4 mb-4">
              <Mail className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-semibold mb-1">No templates yet</h3>
            <p className="text-muted-foreground text-sm mb-4 max-w-sm">
              Create your first email template to use in campaigns and automations.
              Templates support merge tags for personalization.
            </p>
            <Button onClick={() => setShowCreate(true)} className="gap-2">
              <Plus className="h-4 w-4" />
              Create Template
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {templates.map((template) => (
            <Card
              key={template.id}
              className="group cursor-pointer hover:border-apex-gold/40 transition-colors"
              onClick={() => navigate(`/email-templates/${template.id}`)}
            >
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2 min-w-0">
                    <FileText className="h-4 w-4 text-apex-gold shrink-0" />
                    <CardTitle className="text-base truncate">
                      {template.name}
                    </CardTitle>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(`/email-templates/${template.id}`);
                        }}
                      >
                        <Pencil className="h-4 w-4 mr-2" />
                        Edit
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDuplicate(template);
                        }}
                      >
                        <Copy className="h-4 w-4 mr-2" />
                        Duplicate
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        className="text-destructive"
                        onClick={(e) => {
                          e.stopPropagation();
                          setDeleteId(template.id);
                        }}
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                {template.subject && (
                  <p className="text-sm text-muted-foreground truncate mb-1">
                    Subject: {template.subject}
                  </p>
                )}
                <p className="text-xs text-muted-foreground">
                  Updated {formatDate(template.updatedAt)}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create Dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Email Template</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Template Name</Label>
              <Input
                placeholder="e.g., Welcome Email, Follow-up Sequence"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Default Subject Line</Label>
              <Input
                placeholder="e.g., Welcome to our team!"
                value={newSubject}
                onChange={(e) => setNewSubject(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>
              Cancel
            </Button>
            <Button
              disabled={!newName.trim() || createMutation.isPending}
              onClick={() =>
                createMutation.mutate({
                  accountId: accountId!,
                  name: newName.trim(),
                  subject: newSubject.trim(),
                })
              }
            >
              {createMutation.isPending ? "Creating..." : "Create & Edit"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteId !== null} onOpenChange={() => setDeleteId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Template</DialogTitle>
          </DialogHeader>
          <p className="text-muted-foreground">
            Are you sure you want to delete this template? This action cannot be undone.
            Campaigns and automations using this template will fall back to their inline content.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteId(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={deleteMutation.isPending}
              onClick={() => deleteId && deleteMutation.mutate({ id: deleteId })}
            >
              {deleteMutation.isPending ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
