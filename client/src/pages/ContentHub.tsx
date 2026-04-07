import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { useAccount } from "@/contexts/AccountContext";
import { toast } from "sonner";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  FileText,
  Plus,
  Search,
  Loader2,
  Sparkles,
  Layers,
  Trash2,
  Eye,
  MoreHorizontal,
  Globe,
  BookOpen,
  Clock,
  Hash,
  LayoutTemplate,
  CheckCircle,
  XCircle,
  ArrowUpRight,
} from "lucide-react";

export default function ContentHub() {
  const { currentAccount } = useAccount();
  const accountId = currentAccount?.id;
  const [, navigate] = useLocation();

  // ─── State ──────────────────────────────────────────────────────────────
  const [statusFilter, setStatusFilter] = useState<"all" | "draft" | "published">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [page, setPage] = useState(0);
  const pageSize = 20;

  // Generate dialog
  const [showGenerateDialog, setShowGenerateDialog] = useState(false);
  const [genTopic, setGenTopic] = useState("");
  const [genCustomPrompt, setGenCustomPrompt] = useState("");
  const [genWebResearch, setGenWebResearch] = useState(false);
  const [genImage, setGenImage] = useState(false);
  const [genTemplateId, setGenTemplateId] = useState<string>("none");

  // Bulk generate dialog
  const [showBulkDialog, setShowBulkDialog] = useState(false);
  const [bulkTopics, setBulkTopics] = useState("");
  const [bulkWebResearch, setBulkWebResearch] = useState(false);
  const [bulkTemplateId, setBulkTemplateId] = useState<string>("none");

  // ─── Queries ────────────────────────────────────────────────────────────
  const stableSearch = useMemo(() => searchQuery, [searchQuery]);

  const contentQuery = trpc.longFormContent.list.useQuery(
    {
      accountId: accountId!,
      status: statusFilter,
      limit: pageSize,
      offset: page * pageSize,
      search: stableSearch || undefined,
    },
    { enabled: !!accountId }
  );

  const templatesQuery = trpc.longFormContent.listTemplates.useQuery(
    { accountId: accountId! },
    { enabled: !!accountId }
  );

  const utils = trpc.useUtils();

  // ─── Mutations ──────────────────────────────────────────────────────────
  const generateMutation = trpc.longFormContent.generate.useMutation({
    onSuccess: (data) => {
      toast.success(`"${data.title}" generated successfully`);
      utils.longFormContent.list.invalidate();
      setShowGenerateDialog(false);
      resetGenerateForm();
      navigate(`/content-hub/${data.id}`);
    },
    onError: (err) => toast.error(err.message),
  });

  const bulkGenerateMutation = trpc.longFormContent.bulkGenerate.useMutation({
    onSuccess: (data) => {
      toast.success(
        `Bulk generation complete: ${data.successCount}/${data.totalTopics} succeeded`
      );
      utils.longFormContent.list.invalidate();
      setShowBulkDialog(false);
      setBulkTopics("");
    },
    onError: (err) => toast.error(err.message),
  });

  const deleteMutation = trpc.longFormContent.delete.useMutation({
    onSuccess: () => {
      toast.success("Content deleted");
      utils.longFormContent.list.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  const seedMutation = trpc.longFormContent.seedTemplates.useMutation({
    onSuccess: (data) => {
      toast.success(data.message);
      utils.longFormContent.listTemplates.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  // ─── Handlers ───────────────────────────────────────────────────────────
  function resetGenerateForm() {
    setGenTopic("");
    setGenCustomPrompt("");
    setGenWebResearch(false);
    setGenImage(false);
    setGenTemplateId("none");
  }

  function handleGenerate() {
    if (!accountId || !genTopic.trim()) return;
    generateMutation.mutate({
      accountId,
      topic: genTopic.trim(),
      customPrompt: genCustomPrompt.trim() || undefined,
      enableWebResearch: genWebResearch,
      shouldGenerateImage: genImage,
      templateId: genTemplateId !== "none" ? Number(genTemplateId) : undefined,
    });
  }

  function handleBulkGenerate() {
    if (!accountId) return;
    const topics = bulkTopics
      .split("\n")
      .map((t) => t.trim())
      .filter((t) => t.length > 0);
    if (topics.length === 0) {
      toast.error("Enter at least one topic");
      return;
    }
    if (topics.length > 20) {
      toast.error("Maximum 20 topics per batch");
      return;
    }
    bulkGenerateMutation.mutate({
      accountId,
      topics,
      enableWebResearch: bulkWebResearch,
      templateId: bulkTemplateId !== "none" ? Number(bulkTemplateId) : undefined,
    });
  }

  function handleDelete(id: number) {
    if (!accountId) return;
    if (confirm("Are you sure you want to delete this content?")) {
      deleteMutation.mutate({ accountId, id });
    }
  }

  // ─── Render ─────────────────────────────────────────────────────────────
  if (!accountId) {
    return (
      <div className="p-6 text-center text-muted-foreground">
        Select a sub-account to manage content.
      </div>
    );
  }

  const items = contentQuery.data?.items ?? [];
  const total = contentQuery.data?.total ?? 0;
  const totalPages = Math.ceil(total / pageSize);
  const templates = templatesQuery.data ?? [];

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <BookOpen className="h-6 w-6 text-primary" />
            Content Hub
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Generate, manage, and repurpose long-form blog content with AI
          </p>
        </div>
        <div className="flex flex-wrap gap-2 w-full sm:w-auto">
          <Button
            variant="outline"
            size="sm"
            onClick={() => seedMutation.mutate()}
            disabled={seedMutation.isPending}
          >
            {seedMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin mr-1" />
            ) : (
              <LayoutTemplate className="h-4 w-4 mr-1" />
            )}
            Seed Templates
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowBulkDialog(true)}
          >
            <Layers className="h-4 w-4 mr-1" />
            Bulk Generate
          </Button>
          <Button size="sm" onClick={() => setShowGenerateDialog(true)}>
            <Plus className="h-4 w-4 mr-1" />
            New Article
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-4 pb-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by title or topic..."
                className="pl-9"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setPage(0);
                }}
              />
            </div>
            <Select
              value={statusFilter}
              onValueChange={(v) => {
                setStatusFilter(v as any);
                setPage(0);
              }}
            >
              <SelectTrigger className="w-full sm:w-[160px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="published">Published</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Content Table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="min-w-[250px]">Title</TableHead>
                  <TableHead className="min-w-[120px]">Status</TableHead>
                  <TableHead className="min-w-[100px]">Words</TableHead>
                  <TableHead className="min-w-[120px]">Created</TableHead>
                  <TableHead className="min-w-[80px] text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {contentQuery.isLoading ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-12">
                      <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
                    </TableCell>
                  </TableRow>
                ) : items.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-12">
                      <div className="flex flex-col items-center gap-2 text-muted-foreground">
                        <FileText className="h-10 w-10 opacity-40" />
                        <p className="font-medium">No content yet</p>
                        <p className="text-sm">
                          Click "New Article" to generate your first blog post
                        </p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  items.map((item) => (
                    <TableRow
                      key={item.id}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => navigate(`/content-hub/${item.id}`)}
                    >
                      <TableCell>
                        <div className="flex items-start gap-3">
                          {item.imageUrl ? (
                            <img
                              src={item.imageUrl}
                              alt=""
                              className="w-12 h-12 rounded object-cover flex-shrink-0"
                            />
                          ) : (
                            <div className="w-12 h-12 rounded bg-muted flex items-center justify-center flex-shrink-0">
                              <FileText className="h-5 w-5 text-muted-foreground" />
                            </div>
                          )}
                          <div className="min-w-0">
                            <p className="font-medium truncate max-w-[300px]">
                              {item.title}
                            </p>
                            <p className="text-xs text-muted-foreground truncate max-w-[300px]">
                              {item.topic}
                            </p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            item.status === "published" ? "default" : "secondary"
                          }
                          className="text-xs"
                        >
                          {item.status === "published" ? (
                            <CheckCircle className="h-3 w-3 mr-1" />
                          ) : (
                            <Clock className="h-3 w-3 mr-1" />
                          )}
                          {item.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm">
                          {item.wordCount?.toLocaleString() ?? "—"}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm text-muted-foreground">
                          {new Date(item.createdAt).toLocaleDateString()}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              onClick={(e) => {
                                e.stopPropagation();
                                navigate(`/content-hub/${item.id}`);
                              }}
                            >
                              <Eye className="h-4 w-4 mr-2" />
                              View
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              className="text-destructive"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDelete(item.id);
                              }}
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t">
              <p className="text-sm text-muted-foreground">
                Showing {page * pageSize + 1}–{Math.min((page + 1) * pageSize, total)} of{" "}
                {total}
              </p>
              <div className="flex gap-1">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page === 0}
                  onClick={() => setPage((p) => p - 1)}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= totalPages - 1}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ─── Generate Dialog ─────────────────────────────────────────────── */}
      <Dialog open={showGenerateDialog} onOpenChange={setShowGenerateDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              Generate New Article
            </DialogTitle>
            <DialogDescription>
              AI will generate a comprehensive blog post based on your topic and settings.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label>Topic *</Label>
              <Input
                placeholder="e.g., First-Time Homebuyer Guide for 2026"
                value={genTopic}
                onChange={(e) => setGenTopic(e.target.value)}
              />
            </div>

            <div>
              <Label>Template</Label>
              <Select value={genTemplateId} onValueChange={setGenTemplateId}>
                <SelectTrigger>
                  <SelectValue placeholder="No template" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No template</SelectItem>
                  {templates.map((t) => (
                    <SelectItem key={t.id} value={String(t.id)}>
                      {t.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Custom Instructions (optional)</Label>
              <Textarea
                placeholder="Any specific instructions for the AI..."
                value={genCustomPrompt}
                onChange={(e) => setGenCustomPrompt(e.target.value)}
                rows={3}
              />
            </div>

            <Separator />

            <div className="flex items-center justify-between">
              <div>
                <Label className="text-sm font-medium">Web Research</Label>
                <p className="text-xs text-muted-foreground">
                  Search the web for up-to-date information
                </p>
              </div>
              <Switch checked={genWebResearch} onCheckedChange={setGenWebResearch} />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <Label className="text-sm font-medium">Generate Featured Image</Label>
                <p className="text-xs text-muted-foreground">
                  AI-generate a featured image for the article
                </p>
              </div>
              <Switch checked={genImage} onCheckedChange={setGenImage} />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowGenerateDialog(false);
                resetGenerateForm();
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleGenerate}
              disabled={!genTopic.trim() || generateMutation.isPending}
            >
              {generateMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Generating...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4 mr-2" />
                  Generate
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Bulk Generate Dialog ────────────────────────────────────────── */}
      <Dialog open={showBulkDialog} onOpenChange={setShowBulkDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Layers className="h-5 w-5 text-primary" />
              Bulk Generate Articles
            </DialogTitle>
            <DialogDescription>
              Enter one topic per line (max 20). Each topic will generate a separate article.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label>Topics (one per line) *</Label>
              <Textarea
                placeholder={`First-Time Homebuyer Tips\nHow to Improve Your Credit Score\nUnderstanding Mortgage Rates in 2026`}
                value={bulkTopics}
                onChange={(e) => setBulkTopics(e.target.value)}
                rows={8}
              />
              <p className="text-xs text-muted-foreground mt-1">
                {bulkTopics.split("\n").filter((t) => t.trim()).length} topic(s) entered
              </p>
            </div>

            <div>
              <Label>Template</Label>
              <Select value={bulkTemplateId} onValueChange={setBulkTemplateId}>
                <SelectTrigger>
                  <SelectValue placeholder="No template" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No template</SelectItem>
                  {templates.map((t) => (
                    <SelectItem key={t.id} value={String(t.id)}>
                      {t.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <Label className="text-sm font-medium">Web Research</Label>
                <p className="text-xs text-muted-foreground">
                  Research each topic before generating
                </p>
              </div>
              <Switch checked={bulkWebResearch} onCheckedChange={setBulkWebResearch} />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowBulkDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleBulkGenerate}
              disabled={
                !bulkTopics.trim() || bulkGenerateMutation.isPending
              }
            >
              {bulkGenerateMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Generating...
                </>
              ) : (
                <>
                  <Layers className="h-4 w-4 mr-2" />
                  Generate All
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
