import { useState, useMemo, useCallback, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { useAccount } from "@/contexts/AccountContext";
import { toast } from "sonner";
import { useLocation } from "wouter";
import {
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  format,
  addMonths,
  subMonths,
  addWeeks,
  subWeeks,
  isSameMonth,
  isSameDay,
  isToday,
  setHours,
  setMinutes,
  setSeconds,
} from "date-fns";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  BookOpen,
  Clock,
  LayoutTemplate,
  CheckCircle,
  Share2,
  // Social Media icons
  Calendar,
  Palette,
  Copy,
  Save,
  Edit,
  Facebook,
  Instagram,
  Linkedin,
  Twitter,
  X,
  Hash,
  ImageIcon,
  ChevronLeft,
  ChevronRight,
  PhoneCall,
  GripVertical,
} from "lucide-react";

// ═══════════════════════════════════════════════════════════════════════════
// Social Media types & constants (migrated from SocialMedia.tsx)
// ═══════════════════════════════════════════════════════════════════════════

type Platform = "facebook" | "instagram" | "linkedin" | "twitter";
type Tone = "professional" | "casual" | "funny" | "inspiring" | "educational";

const PLATFORM_ICONS: Record<Platform, React.ReactNode> = {
  facebook: <Facebook className="h-4 w-4" />,
  instagram: <Instagram className="h-4 w-4" />,
  linkedin: <Linkedin className="h-4 w-4" />,
  twitter: <Twitter className="h-4 w-4" />,
};

const PLATFORM_COLORS: Record<Platform, string> = {
  facebook: "bg-blue-500/10 text-blue-600 border-blue-200",
  instagram: "bg-pink-500/10 text-pink-600 border-pink-200",
  linkedin: "bg-sky-500/10 text-sky-600 border-sky-200",
  twitter: "bg-gray-500/10 text-gray-600 border-gray-200",
};

const SOCIAL_STATUS_COLORS: Record<string, string> = {
  draft: "bg-gray-100 text-gray-600",
  scheduled: "bg-blue-100 text-blue-600",
  published: "bg-green-100 text-green-600",
  failed: "bg-red-100 text-red-600",
};

function copyToClipboard(text: string) {
  navigator.clipboard.writeText(text);
  toast.success("Copied to clipboard!");
}

// ═══════════════════════════════════════════════════════════════════════════
// Blog Articles Tab
// ═══════════════════════════════════════════════════════════════════════════

function BlogArticlesTab() {
  const { currentAccount } = useAccount();
  const accountId = currentAccount?.id;
  const [, navigate] = useLocation();

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
  const [genAiModel, setGenAiModel] = useState("gemini-2.5-flash");

  // Bulk generate dialog
  const [showBulkDialog, setShowBulkDialog] = useState(false);
  const [bulkTopics, setBulkTopics] = useState("");
  const [bulkWebResearch, setBulkWebResearch] = useState(false);
  const [bulkTemplateId, setBulkTemplateId] = useState<string>("none");
  const [bulkAiModel, setBulkAiModel] = useState("gemini-2.5-flash");

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

  function resetGenerateForm() {
    setGenTopic("");
    setGenCustomPrompt("");
    setGenWebResearch(false);
    setGenImage(false);
    setGenTemplateId("none");
    setGenAiModel("gemini-2.5-flash");
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
      aiModel: genAiModel,
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
      aiModel: bulkAiModel,
    });
  }

  function handleDelete(id: number) {
    if (!accountId) return;
    if (confirm("Are you sure you want to delete this content?")) {
      deleteMutation.mutate({ accountId, id });
    }
  }

  if (!accountId) return null;

  const items = contentQuery.data?.items ?? [];
  const total = contentQuery.data?.total ?? 0;
  const totalPages = Math.ceil(total / pageSize);
  const templates = templatesQuery.data ?? [];

  return (
    <div className="space-y-6">
      {/* Action Buttons */}
      <div className="flex flex-wrap gap-2">
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

            <div>
              <Label>AI Model</Label>
              <Select value={genAiModel} onValueChange={setGenAiModel}>
                <SelectTrigger>
                  <SelectValue placeholder="Select model" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="gemini-2.5-flash">
                    <div className="flex flex-col">
                      <span>Gemini 2.5 Flash</span>
                      <span className="text-xs text-muted-foreground">⚡ Fast · Lowest Cost</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="gemini-2.5-pro">
                    <div className="flex flex-col">
                      <span>Gemini 2.5 Pro</span>
                      <span className="text-xs text-muted-foreground">✨ Best Quality · High Cost</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="gpt-4o">
                    <div className="flex flex-col">
                      <span>GPT-4o</span>
                      <span className="text-xs text-muted-foreground">⚖️ Balanced · Medium Cost</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="gpt-4o-mini">
                    <div className="flex flex-col">
                      <span>GPT-4o Mini</span>
                      <span className="text-xs text-muted-foreground">⚡ Fast · Low Cost</span>
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
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

            <div>
              <Label>AI Model</Label>
              <Select value={bulkAiModel} onValueChange={setBulkAiModel}>
                <SelectTrigger>
                  <SelectValue placeholder="Select model" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="gemini-2.5-flash">
                    <div className="flex flex-col">
                      <span>Gemini 2.5 Flash</span>
                      <span className="text-xs text-muted-foreground">⚡ Fast · Lowest Cost</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="gemini-2.5-pro">
                    <div className="flex flex-col">
                      <span>Gemini 2.5 Pro</span>
                      <span className="text-xs text-muted-foreground">✨ Best Quality · High Cost</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="gpt-4o">
                    <div className="flex flex-col">
                      <span>GPT-4o</span>
                      <span className="text-xs text-muted-foreground">⚖️ Balanced · Medium Cost</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="gpt-4o-mini">
                    <div className="flex flex-col">
                      <span>GPT-4o Mini</span>
                      <span className="text-xs text-muted-foreground">⚡ Fast · Low Cost</span>
                    </div>
                  </SelectItem>
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
              disabled={!bulkTopics.trim() || bulkGenerateMutation.isPending}
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

// ═══════════════════════════════════════════════════════════════════════════
// Social Media — Content Generator Sub-tab
// ═══════════════════════════════════════════════════════════════════════════

function ContentGenerator() {
  const { currentAccountId: activeAccountId } = useAccount();
  const [platform, setPlatform] = useState<Platform>("facebook");
  const [topic, setTopic] = useState("");
  const [tone, setTone] = useState<Tone>("professional");
  const [additionalContext, setAdditionalContext] = useState("");
  const [variations, setVariations] = useState<any[]>([]);
  const [selectedVariation, setSelectedVariation] = useState<number | null>(null);
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [scheduledDate, setScheduledDate] = useState("");
  const [socialAiModel, setSocialAiModel] = useState("gemini-2.5-flash");
  const [socialWebResearch, setSocialWebResearch] = useState(false);
  // Bulk generate state
  const [bulkDialogOpen, setBulkDialogOpen] = useState(false);
  const [bulkTopics, setBulkTopics] = useState("");
  const [bulkPlatform, setBulkPlatform] = useState<Platform>("facebook");
  const [bulkTone, setBulkTone] = useState<Tone>("professional");
  const [bulkAiModel, setBulkAiModel] = useState("gemini-2.5-flash");
  const [bulkWebResearch, setBulkWebResearch] = useState(false);
  const [bulkProgress, setBulkProgress] = useState<{ current: number; total: number } | null>(null);
  const [bulkRunning, setBulkRunning] = useState(false);

  const generateMutation = trpc.socialContent.generatePost.useMutation({
    onSuccess: (data) => {
      setVariations(data.variations);
      setSelectedVariation(null);
      toast.success("Generated 3 post variations!");
    },
    onError: (err) => toast.error(err.message),
  });

  const saveDraftMutation = trpc.socialContent.saveDraft.useMutation({
    onSuccess: () => {
      toast.success("Post saved!");
      setSaveDialogOpen(false);
      setVariations([]);
      setTopic("");
      setAdditionalContext("");
    },
    onError: (err) => toast.error(err.message),
  });

  const handleGenerate = () => {
    if (!activeAccountId) return toast.error("Select a sub-account first");
    if (!topic.trim()) return toast.error("Enter a topic");
    generateMutation.mutate({
      accountId: activeAccountId,
      platform,
      topic: topic.trim(),
      tone,
      additionalContext: additionalContext.trim() || undefined,
      aiModel: socialAiModel,
      enableWebResearch: socialWebResearch,
    });
  };

  const handleSave = (status: "draft" | "scheduled") => {
    if (selectedVariation === null || !activeAccountId) return;
    const v = variations[selectedVariation];
    saveDraftMutation.mutate({
      accountId: activeAccountId,
      platform,
      content: v.content,
      hashtags: v.hashtags,
      imagePrompt: v.imagePrompt,
      topic,
      tone,
      generationPrompt: topic,
      scheduledAt: status === "scheduled" && scheduledDate ? new Date(scheduledDate).getTime() : undefined,
    });
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            AI Content Generator
          </CardTitle>
          <CardDescription>
            Generate engaging social media posts with AI. Choose your platform, topic, and tone to get 3 unique variations.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Platform</Label>
              <Select value={platform} onValueChange={(v) => setPlatform(v as Platform)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="facebook">
                    <span className="flex items-center gap-2"><Facebook className="h-4 w-4" /> Facebook</span>
                  </SelectItem>
                  <SelectItem value="instagram">
                    <span className="flex items-center gap-2"><Instagram className="h-4 w-4" /> Instagram</span>
                  </SelectItem>
                  <SelectItem value="linkedin">
                    <span className="flex items-center gap-2"><Linkedin className="h-4 w-4" /> LinkedIn</span>
                  </SelectItem>
                  <SelectItem value="twitter">
                    <span className="flex items-center gap-2"><Twitter className="h-4 w-4" /> Twitter/X</span>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Tone</Label>
              <Select value={tone} onValueChange={(v) => setTone(v as Tone)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="professional">Professional</SelectItem>
                  <SelectItem value="casual">Casual</SelectItem>
                  <SelectItem value="funny">Funny</SelectItem>
                  <SelectItem value="inspiring">Inspiring</SelectItem>
                  <SelectItem value="educational">Educational</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label>Topic / Subject</Label>
            <Input
              placeholder="e.g., First-time homebuyer tips, Refinancing benefits, Market update..."
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>Additional Context (optional)</Label>
            <Textarea
              placeholder="Add any specific details, stats, or angles you want included..."
              value={additionalContext}
              onChange={(e) => setAdditionalContext(e.target.value)}
              rows={3}
            />
          </div>
          {/* AI Model Selector */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>AI Model</Label>
              <Select value={socialAiModel} onValueChange={setSocialAiModel}>
                <SelectTrigger>
                  <SelectValue placeholder="Select model" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="gemini-2.5-flash">
                    <div className="flex flex-col">
                      <span>Gemini 2.5 Flash</span>
                      <span className="text-xs text-muted-foreground">⚡ Fast · Lowest Cost</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="gemini-2.5-pro">
                    <div className="flex flex-col">
                      <span>Gemini 2.5 Pro</span>
                      <span className="text-xs text-muted-foreground">✨ Best Quality · High Cost</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="gpt-4o">
                    <div className="flex flex-col">
                      <span>GPT-4o</span>
                      <span className="text-xs text-muted-foreground">⚖️ Balanced · Medium Cost</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="gpt-4o-mini">
                    <div className="flex flex-col">
                      <span>GPT-4o Mini</span>
                      <span className="text-xs text-muted-foreground">⚡ Fast · Low Cost</span>
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end">
              <div className="flex items-center justify-between w-full p-3 rounded-md border">
                <div>
                  <Label className="text-sm font-medium">Web Research</Label>
                  <p className="text-xs text-muted-foreground">Fetches current information before generating</p>
                </div>
                <Switch checked={socialWebResearch} onCheckedChange={setSocialWebResearch} />
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            <Button
              onClick={handleGenerate}
              disabled={generateMutation.isPending || !topic.trim()}
            >
              {generateMutation.isPending ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Generating...</>
              ) : (
                <><Sparkles className="h-4 w-4 mr-2" /> Generate 3 Variations</>
              )}
            </Button>
            <Button
              variant="outline"
              onClick={() => setBulkDialogOpen(true)}
            >
              <Layers className="h-4 w-4 mr-2" /> Bulk Generate
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Generated Variations */}
      {variations.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">Generated Variations</h3>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {variations.map((v, i) => (
              <Card
                key={i}
                className={`cursor-pointer transition-all ${
                  selectedVariation === i
                    ? "ring-2 ring-primary shadow-lg"
                    : "hover:shadow-md"
                }`}
                onClick={() => setSelectedVariation(i)}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <Badge variant="outline" className={PLATFORM_COLORS[platform]}>
                      {PLATFORM_ICONS[platform]}
                      <span className="ml-1 capitalize">{platform}</span>
                    </Badge>
                    <span className="text-sm text-muted-foreground">Variation {i + 1}</span>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="text-sm leading-relaxed whitespace-pre-wrap">{v.content}</p>
                  <Separator />
                  <div className="flex flex-wrap gap-1">
                    {v.hashtags.map((h: string, j: number) => (
                      <Badge key={j} variant="secondary" className="text-xs">
                        <Hash className="h-3 w-3 mr-0.5" />
                        {h}
                      </Badge>
                    ))}
                  </div>
                  {v.imagePrompt && (
                    <>
                      <Separator />
                      <div className="text-xs text-muted-foreground">
                        <div className="flex items-center gap-1 mb-1 font-medium">
                          <ImageIcon className="h-3 w-3" /> Image Prompt
                        </div>
                        <p className="line-clamp-2">{v.imagePrompt}</p>
                      </div>
                    </>
                  )}
                  <div className="flex flex-wrap gap-2 pt-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={(e) => {
                        e.stopPropagation();
                        const hashtagStr = v.hashtags.map((h: string) => `#${h}`).join(" ");
                        copyToClipboard(`${v.content}\n\n${hashtagStr}`);
                      }}
                    >
                      <Copy className="h-3 w-3 mr-1" /> Copy
                    </Button>
                    <Button
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedVariation(i);
                        setSaveDialogOpen(true);
                      }}
                    >
                      <Save className="h-3 w-3 mr-1" /> Save
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Save Dialog */}
      <Dialog open={saveDialogOpen} onOpenChange={setSaveDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Save Post</DialogTitle>
            <DialogDescription>Save as a draft or schedule it for later.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Schedule for (optional)</Label>
              <Input
                type="datetime-local"
                value={scheduledDate}
                onChange={(e) => setScheduledDate(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">Leave empty to save as draft</p>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => handleSave("draft")} disabled={saveDraftMutation.isPending}>
              <FileText className="h-4 w-4 mr-2" /> Save as Draft
            </Button>
            <Button onClick={() => handleSave(scheduledDate ? "scheduled" : "draft")} disabled={saveDraftMutation.isPending}>
              {saveDraftMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : scheduledDate ? (
                <Clock className="h-4 w-4 mr-2" />
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              {scheduledDate ? "Schedule" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk Generate Dialog */}
      <Dialog open={bulkDialogOpen} onOpenChange={(open) => {
        if (!open && !bulkRunning) {
          setBulkDialogOpen(false);
          setBulkTopics("");
          setBulkProgress(null);
          setBulkAiModel("gemini-2.5-flash");
          setBulkWebResearch(false);
        }
      }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Bulk Generate Social Posts</DialogTitle>
            <DialogDescription>Enter one topic per line (max 10). Each topic generates one post saved as a draft.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Topics (one per line)</Label>
              <Textarea
                placeholder={"First-time homebuyer tips\nRefinancing benefits\nMarket update Q2 2026"}
                value={bulkTopics}
                onChange={(e) => setBulkTopics(e.target.value)}
                rows={5}
                disabled={bulkRunning}
              />
              <p className="text-xs text-muted-foreground">
                {bulkTopics.split("\n").filter(l => l.trim()).length}/10 topics
              </p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Platform</Label>
                <Select value={bulkPlatform} onValueChange={(v) => setBulkPlatform(v as Platform)} disabled={bulkRunning}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="facebook">Facebook</SelectItem>
                    <SelectItem value="instagram">Instagram</SelectItem>
                    <SelectItem value="linkedin">LinkedIn</SelectItem>
                    <SelectItem value="twitter">Twitter/X</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Tone</Label>
                <Select value={bulkTone} onValueChange={(v) => setBulkTone(v as Tone)} disabled={bulkRunning}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="professional">Professional</SelectItem>
                    <SelectItem value="casual">Casual</SelectItem>
                    <SelectItem value="funny">Funny</SelectItem>
                    <SelectItem value="inspiring">Inspiring</SelectItem>
                    <SelectItem value="educational">Educational</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>AI Model</Label>
              <Select value={bulkAiModel} onValueChange={setBulkAiModel} disabled={bulkRunning}>
                <SelectTrigger><SelectValue placeholder="Select model" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="gemini-2.5-flash">
                    <div className="flex flex-col">
                      <span>Gemini 2.5 Flash</span>
                      <span className="text-xs text-muted-foreground">⚡ Fast · Lowest Cost</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="gemini-2.5-pro">
                    <div className="flex flex-col">
                      <span>Gemini 2.5 Pro</span>
                      <span className="text-xs text-muted-foreground">✨ Best Quality · High Cost</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="gpt-4o">
                    <div className="flex flex-col">
                      <span>GPT-4o</span>
                      <span className="text-xs text-muted-foreground">⚖️ Balanced · Medium Cost</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="gpt-4o-mini">
                    <div className="flex flex-col">
                      <span>GPT-4o Mini</span>
                      <span className="text-xs text-muted-foreground">⚡ Fast · Low Cost</span>
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center justify-between p-3 rounded-md border">
              <div>
                <Label className="text-sm font-medium">Web Research</Label>
                <p className="text-xs text-muted-foreground">Fetches current info for each topic</p>
              </div>
              <Switch checked={bulkWebResearch} onCheckedChange={setBulkWebResearch} disabled={bulkRunning} />
            </div>
            {bulkProgress && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span>Generating posts...</span>
                  <span className="font-medium">{bulkProgress.current}/{bulkProgress.total}</span>
                </div>
                <div className="w-full bg-muted rounded-full h-2">
                  <div
                    className="bg-primary h-2 rounded-full transition-all"
                    style={{ width: `${(bulkProgress.current / bulkProgress.total) * 100}%` }}
                  />
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBulkDialogOpen(false)} disabled={bulkRunning}>
              Cancel
            </Button>
            <Button
              disabled={bulkRunning || !bulkTopics.trim()}
              onClick={async () => {
                if (!activeAccountId) return toast.error("Select a sub-account first");
                const topicLines = bulkTopics.split("\n").map(l => l.trim()).filter(Boolean).slice(0, 10);
                if (topicLines.length === 0) return toast.error("Enter at least one topic");
                setBulkRunning(true);
                setBulkProgress({ current: 0, total: topicLines.length });
                let saved = 0;
                for (let i = 0; i < topicLines.length; i++) {
                  try {
                    const result = await generateMutation.mutateAsync({
                      accountId: activeAccountId,
                      platform: bulkPlatform,
                      topic: topicLines[i],
                      tone: bulkTone,
                      aiModel: bulkAiModel,
                      enableWebResearch: bulkWebResearch,
                    });
                    // Save first variation as draft
                    if (result.variations?.[0]) {
                      const v = result.variations[0];
                      await saveDraftMutation.mutateAsync({
                        accountId: activeAccountId,
                        platform: bulkPlatform,
                        content: v.content,
                        hashtags: v.hashtags,
                        topic: topicLines[i],
                        tone: bulkTone,
                        generationPrompt: topicLines[i],
                      });
                      saved++;
                    }
                  } catch (err: any) {
                    console.error(`Bulk generate failed for topic: ${topicLines[i]}`, err);
                  }
                  setBulkProgress({ current: i + 1, total: topicLines.length });
                }
                setBulkRunning(false);
                setBulkDialogOpen(false);
                setBulkTopics("");
                setBulkProgress(null);
                setVariations([]);
                toast.success(`Bulk generated ${saved} posts as drafts!`);
              }}
            >
              {bulkRunning ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Generating...</>
              ) : (
                <><Layers className="h-4 w-4 mr-2" /> Generate All</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Social Media — Content Calendar Sub-tab
// ═══════════════════════════════════════════════════════════════════════════

// Platform pill bg colors for calendar
const PILL_COLORS: Record<Platform, string> = {
  facebook: "bg-blue-500 text-white",
  instagram: "bg-pink-500 text-white",
  linkedin: "bg-indigo-500 text-white",
  twitter: "bg-sky-500 text-white",
};

function ContentCalendar() {
  const { currentAccountId: activeAccountId } = useAccount();
  const utils = trpc.useUtils();

  // Calendar state
  const [currentDate, setCurrentDate] = useState(() => new Date());
  const [calView, setCalView] = useState<"month" | "week">("month");
  const [genDialogOpen, setGenDialogOpen] = useState(false);

  // Generate calendar form state
  const [genPlatforms, setGenPlatforms] = useState<Platform[]>(["facebook", "instagram"]);
  const [genPostsPerPlatform, setGenPostsPerPlatform] = useState(3);
  const [genTopics, setGenTopics] = useState<string[]>([""]);
  const [genTone, setGenTone] = useState<Tone>("professional");
  const [genStartDate, setGenStartDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d.toISOString().split("T")[0];
  });
  const [genAiModel, setGenAiModel] = useState("gemini-2.5-flash");

  // Fetch ALL posts for the calendar (no status filter, high limit)
  const { data: postsData } = trpc.socialContent.getPosts.useQuery(
    { accountId: activeAccountId!, limit: 100, offset: 0 },
    { enabled: !!activeAccountId }
  );

  const updateMutation = trpc.socialContent.updatePost.useMutation({
    onSuccess: () => {
      utils.socialContent.getPosts.invalidate();
      toast.success("Post rescheduled!");
    },
    onError: (err: any) => toast.error(err.message),
  });

  const generateCalendarMutation = trpc.socialContent.generateContentCalendar.useMutation({
    onSuccess: (data: any) => {
      toast.success(`Generated ${data.posts.length} posts and saved to your calendar!`);
      utils.socialContent.getPosts.invalidate();
      setGenDialogOpen(false);
    },
    onError: (err: any) => toast.error(err.message),
  });

  // Split posts into scheduled vs unscheduled
  const allPosts = postsData?.posts ?? [];
  const scheduledPosts = allPosts.filter((p: any) => p.scheduledAt);
  const unscheduledPosts = allPosts.filter((p: any) => !p.scheduledAt && p.status === "draft");

  // Build postsByDate map
  const postsByDate = useMemo(() => {
    const map: Record<string, any[]> = {};
    for (const post of scheduledPosts) {
      const dateKey = format(new Date(post.scheduledAt as string | number | Date), "yyyy-MM-dd");
      if (!map[dateKey]) map[dateKey] = [];
      map[dateKey].push(post);
    }
    return map;
  }, [scheduledPosts]);

  // Calendar grid days
  const calendarDays = useMemo(() => {
    if (calView === "month") {
      const monthStart = startOfMonth(currentDate);
      const monthEnd = endOfMonth(currentDate);
      return eachDayOfInterval({
        start: startOfWeek(monthStart),
        end: endOfWeek(monthEnd),
      });
    } else {
      const weekStart = startOfWeek(currentDate);
      const weekEnd = endOfWeek(currentDate);
      return eachDayOfInterval({ start: weekStart, end: weekEnd });
    }
  }, [currentDate, calView]);

  // Navigation
  const goNext = () => {
    setCurrentDate(calView === "month" ? addMonths(currentDate, 1) : addWeeks(currentDate, 1));
  };
  const goPrev = () => {
    setCurrentDate(calView === "month" ? subMonths(currentDate, 1) : subWeeks(currentDate, 1));
  };

  // Drag handlers
  const handleDragStart = useCallback((e: React.DragEvent, postId: number) => {
    e.dataTransfer.setData("postId", postId.toString());
    e.dataTransfer.effectAllowed = "move";
  }, []);

  const handleDrop = useCallback((e: React.DragEvent, targetDate: Date) => {
    e.preventDefault();
    const postId = parseInt(e.dataTransfer.getData("postId"), 10);
    if (!postId || !activeAccountId) return;
    const noon = setSeconds(setMinutes(setHours(targetDate, 12), 0), 0);
    updateMutation.mutate({
      postId,
      accountId: activeAccountId,
      scheduledAt: noon.getTime(),
      status: "scheduled",
    });
  }, [activeAccountId, updateMutation]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  }, []);

  // Generate calendar form handlers
  const toggleGenPlatform = (p: Platform) => {
    setGenPlatforms((prev) =>
      prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]
    );
  };

  const handleGenerateCalendar = () => {
    if (!activeAccountId) return toast.error("Select a sub-account first");
    const validTopics = genTopics.filter((t) => t.trim());
    if (validTopics.length === 0) return toast.error("Add at least one topic");
    if (genPlatforms.length === 0) return toast.error("Select at least one platform");
    generateCalendarMutation.mutate({
      accountId: activeAccountId,
      platforms: genPlatforms,
      postsPerPlatform: genPostsPerPlatform,
      topics: validTopics,
      startDate: new Date(genStartDate).getTime(),
      tone: genTone,
      aiModel: genAiModel,
    });
  };

  const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  return (
    <div className="space-y-4">
      {/* Calendar Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={goPrev}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <h2 className="text-lg font-semibold min-w-[180px] text-center">
            {calView === "month"
              ? format(currentDate, "MMMM yyyy")
              : `Week of ${format(startOfWeek(currentDate), "MMM d, yyyy")}`}
          </h2>
          <Button variant="outline" size="icon" onClick={goNext}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-md border">
            <Button
              variant={calView === "month" ? "default" : "ghost"}
              size="sm"
              className="rounded-r-none"
              onClick={() => setCalView("month")}
            >
              Month
            </Button>
            <Button
              variant={calView === "week" ? "default" : "ghost"}
              size="sm"
              className="rounded-l-none"
              onClick={() => setCalView("week")}
            >
              Week
            </Button>
          </div>
          <Button onClick={() => setGenDialogOpen(true)}>
            <Sparkles className="h-4 w-4 mr-2" /> Generate Calendar
          </Button>
        </div>
      </div>

      {/* Day-of-week header */}
      <div className="grid grid-cols-7 gap-px bg-muted rounded-t-lg overflow-hidden">
        {DAY_NAMES.map((d) => (
          <div key={d} className="bg-card py-2 text-center text-xs font-medium text-muted-foreground">
            {d}
          </div>
        ))}
      </div>

      {/* Calendar Grid */}
      <div className={`grid grid-cols-7 gap-px bg-muted rounded-b-lg overflow-hidden`}>
        {calendarDays.map((day) => {
          const dateKey = format(day, "yyyy-MM-dd");
          const dayPosts = postsByDate[dateKey] || [];
          const inMonth = calView === "month" ? isSameMonth(day, currentDate) : true;
          const today = isToday(day);

          return (
            <div
              key={dateKey}
              className={`bg-card p-1.5 transition-colors ${
                calView === "week" ? "min-h-[200px]" : "min-h-[90px]"
              } ${
                !inMonth ? "opacity-40" : ""
              } ${
                today ? "ring-2 ring-primary ring-inset" : ""
              }`}
              onDragOver={handleDragOver}
              onDrop={(e) => handleDrop(e, day)}
            >
              <div className={`text-xs font-medium mb-1 ${
                today ? "text-primary font-bold" : "text-muted-foreground"
              }`}>
                {format(day, "d")}
              </div>
              <div className="space-y-0.5">
                {dayPosts.slice(0, calView === "week" ? 10 : 3).map((post: any) => (
                  <div
                    key={post.id}
                    draggable
                    onDragStart={(e) => handleDragStart(e, post.id)}
                    className={`text-[10px] leading-tight px-1.5 py-0.5 rounded cursor-grab active:cursor-grabbing truncate ${
                      PILL_COLORS[post.platform as Platform] || "bg-gray-500 text-white"
                    }`}
                    title={`${post.platform}: ${post.content?.slice(0, 80)}`}
                  >
                    {post.topic || post.content?.slice(0, 20) || post.platform}
                  </div>
                ))}
                {dayPosts.length > (calView === "week" ? 10 : 3) && (
                  <div className="text-[10px] text-muted-foreground px-1">
                    +{dayPosts.length - (calView === "week" ? 10 : 3)} more
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Unscheduled Drafts Pool */}
      {unscheduledPosts.length > 0 && (
        <Card>
          <CardHeader className="py-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <GripVertical className="h-4 w-4 text-muted-foreground" />
              Unscheduled Drafts ({unscheduledPosts.length})
            </CardTitle>
            <CardDescription className="text-xs">
              Drag posts onto a calendar day to schedule them
            </CardDescription>
          </CardHeader>
          <CardContent className="pb-3">
            <div className="flex gap-2 overflow-x-auto pb-2">
              {unscheduledPosts.map((post: any) => (
                <div
                  key={post.id}
                  draggable
                  onDragStart={(e) => handleDragStart(e, post.id)}
                  className={`flex-shrink-0 w-48 p-2 rounded-lg border cursor-grab active:cursor-grabbing hover:shadow-md transition-shadow`}
                >
                  <div className="flex items-center gap-1.5 mb-1">
                    <Badge variant="outline" className={`text-[10px] px-1 py-0 ${PLATFORM_COLORS[post.platform as Platform]}`}>
                      {post.platform}
                    </Badge>
                  </div>
                  <p className="text-xs line-clamp-2 text-muted-foreground">
                    {post.topic || post.content?.slice(0, 60)}
                  </p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Generate Content Calendar Dialog */}
      <Dialog open={genDialogOpen} onOpenChange={setGenDialogOpen}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-primary" />
              Generate Content Calendar
            </DialogTitle>
            <DialogDescription>
              Generate a week&apos;s worth of content across multiple platforms. Posts are automatically saved as scheduled drafts.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Platforms</Label>
              <div className="flex flex-wrap gap-2">
                {(["facebook", "instagram", "linkedin", "twitter"] as Platform[]).map((p) => (
                  <Button
                    key={p}
                    variant={genPlatforms.includes(p) ? "default" : "outline"}
                    size="sm"
                    onClick={() => toggleGenPlatform(p)}
                    className="gap-1"
                  >
                    {PLATFORM_ICONS[p]}
                    <span className="capitalize">{p === "twitter" ? "Twitter/X" : p}</span>
                  </Button>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-2">
                <Label>Posts/Platform</Label>
                <Select value={String(genPostsPerPlatform)} onValueChange={(v) => setGenPostsPerPlatform(Number(v))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {[1, 2, 3, 4, 5, 6, 7].map((n) => (
                      <SelectItem key={n} value={String(n)}>{n}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Tone</Label>
                <Select value={genTone} onValueChange={(v) => setGenTone(v as Tone)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="professional">Professional</SelectItem>
                    <SelectItem value="casual">Casual</SelectItem>
                    <SelectItem value="funny">Funny</SelectItem>
                    <SelectItem value="inspiring">Inspiring</SelectItem>
                    <SelectItem value="educational">Educational</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Start Date</Label>
                <Input type="date" value={genStartDate} onChange={(e) => setGenStartDate(e.target.value)} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>AI Model</Label>
              <Select value={genAiModel} onValueChange={setGenAiModel}>
                <SelectTrigger><SelectValue placeholder="Select model" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="gemini-2.5-flash">
                    <div className="flex flex-col">
                      <span>Gemini 2.5 Flash</span>
                      <span className="text-xs text-muted-foreground">⚡ Fast · Lowest Cost</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="gemini-2.5-pro">
                    <div className="flex flex-col">
                      <span>Gemini 2.5 Pro</span>
                      <span className="text-xs text-muted-foreground">✨ Best Quality · High Cost</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="gpt-4o">
                    <div className="flex flex-col">
                      <span>GPT-4o</span>
                      <span className="text-xs text-muted-foreground">⚖️ Balanced · Medium Cost</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="gpt-4o-mini">
                    <div className="flex flex-col">
                      <span>GPT-4o Mini</span>
                      <span className="text-xs text-muted-foreground">⚡ Fast · Low Cost</span>
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Topics</Label>
              {genTopics.map((t, i) => (
                <div key={i} className="flex gap-2">
                  <Input
                    placeholder={`Topic ${i + 1}...`}
                    value={t}
                    onChange={(e) => {
                      const updated = [...genTopics];
                      updated[i] = e.target.value;
                      setGenTopics(updated);
                    }}
                  />
                  {genTopics.length > 1 && (
                    <Button variant="ghost" size="icon" onClick={() => setGenTopics(genTopics.filter((_, j) => j !== i))}>
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              ))}
              <Button variant="outline" size="sm" onClick={() => setGenTopics([...genTopics, ""])}>
                <Plus className="h-4 w-4 mr-1" /> Add Topic
              </Button>
            </div>
            <Separator />
            <p className="text-sm text-muted-foreground">
              This will generate <strong>{genPlatforms.length * genPostsPerPlatform}</strong> posts total
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setGenDialogOpen(false)}>Cancel</Button>
            <Button
              onClick={handleGenerateCalendar}
              disabled={generateCalendarMutation.isPending || genPlatforms.length === 0}
            >
              {generateCalendarMutation.isPending ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Generating...</>
              ) : (
                <><Calendar className="h-4 w-4 mr-2" /> Generate Calendar</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Social Media — Posts Management Sub-tab
// ═══════════════════════════════════════════════════════════════════════════

function PostsManagement() {
  const { currentAccountId: activeAccountId } = useAccount();
  const [platformFilter, setPlatformFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [page, setPage] = useState(0);
  const [editingPost, setEditingPost] = useState<any>(null);
  const [editContent, setEditContent] = useState("");
  const [viewingPost, setViewingPost] = useState<any>(null);
  const pageSize = 20;

  const utils = trpc.useUtils();

  const { data, isLoading } = trpc.socialContent.getPosts.useQuery(
    {
      accountId: activeAccountId!,
      platform: platformFilter as any,
      status: statusFilter as any,
      limit: pageSize,
      offset: page * pageSize,
    },
    { enabled: !!activeAccountId }
  );

  const deleteMutation = trpc.socialContent.deletePost.useMutation({
    onSuccess: () => {
      toast.success("Post deleted");
      utils.socialContent.getPosts.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  const updateMutation = trpc.socialContent.updatePost.useMutation({
    onSuccess: () => {
      toast.success("Post updated");
      setEditingPost(null);
      utils.socialContent.getPosts.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  const totalPages = data ? Math.ceil(data.total / pageSize) : 0;

  return (
    <div className="space-y-6">
      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-wrap gap-4">
            <div className="space-y-1">
              <Label className="text-xs">Platform</Label>
              <Select value={platformFilter} onValueChange={(v) => { setPlatformFilter(v); setPage(0); }}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Platforms</SelectItem>
                  <SelectItem value="facebook">Facebook</SelectItem>
                  <SelectItem value="instagram">Instagram</SelectItem>
                  <SelectItem value="linkedin">LinkedIn</SelectItem>
                  <SelectItem value="twitter">Twitter/X</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Status</Label>
              <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(0); }}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="scheduled">Scheduled</SelectItem>
                  <SelectItem value="published">Published</SelectItem>
                  <SelectItem value="failed">Failed</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end ml-auto">
              <p className="text-sm text-muted-foreground">
                {data?.total ?? 0} post{(data?.total ?? 0) !== 1 ? "s" : ""}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Posts List */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : !data?.posts.length ? (
        <Card>
          <CardContent className="py-12 text-center">
            <FileText className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
            <h3 className="text-lg font-medium mb-2">No posts yet</h3>
            <p className="text-muted-foreground">
              Generate your first post using the Generator tab.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {data.posts.map((post: any) => (
            <Card key={post.id} className="hover:shadow-sm transition-shadow">
              <CardContent className="pt-4 pb-4">
                <div className="flex gap-3">
                  <div className="flex flex-col items-center gap-1">
                    <Badge variant="outline" className={PLATFORM_COLORS[post.platform as Platform]}>
                      {PLATFORM_ICONS[post.platform as Platform]}
                    </Badge>
                    <Badge className={`text-xs ${SOCIAL_STATUS_COLORS[post.status]}`}>
                      {post.status}
                    </Badge>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm line-clamp-3 mb-2">{post.content}</p>
                    <div className="flex flex-wrap gap-1 mb-2">
                      {(post.hashtags || []).slice(0, 8).map((h: string, j: number) => (
                        <span key={j} className="text-xs text-primary">#{h}</span>
                      ))}
                    </div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      {post.scheduledAt && (
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {new Date(post.scheduledAt).toLocaleString()}
                        </span>
                      )}
                      <span>Created {new Date(post.createdAt).toLocaleDateString()}</span>
                    </div>
                  </div>
                  <div className="flex flex-col gap-1">
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8"
                      onClick={() => setViewingPost(post)}
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                    {post.status !== "published" && (
                      <>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8"
                          onClick={() => {
                            setEditingPost(post);
                            setEditContent(post.content);
                          }}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8 text-destructive"
                          onClick={() => {
                            if (confirm("Delete this post?")) {
                              deleteMutation.mutate({ postId: post.id, accountId: activeAccountId! });
                            }
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 pt-4">
              <Button
                variant="outline"
                size="sm"
                disabled={page === 0}
                onClick={() => setPage(page - 1)}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-sm text-muted-foreground">
                Page {page + 1} of {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= totalPages - 1}
                onClick={() => setPage(page + 1)}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>
      )}

      {/* View Post Dialog */}
      <Dialog open={!!viewingPost} onOpenChange={() => setViewingPost(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {viewingPost && PLATFORM_ICONS[viewingPost.platform as Platform]}
              <span className="capitalize">{viewingPost?.platform} Post</span>
            </DialogTitle>
          </DialogHeader>
          {viewingPost && (
            <div className="space-y-4">
              <p className="text-sm whitespace-pre-wrap">{viewingPost.content}</p>
              <div className="flex flex-wrap gap-1">
                {(viewingPost.hashtags || []).map((h: string, j: number) => (
                  <Badge key={j} variant="secondary">#{h}</Badge>
                ))}
              </div>
              {viewingPost.imagePrompt && (
                <div className="p-3 bg-muted rounded-lg">
                  <p className="text-xs font-medium mb-1">Image Prompt:</p>
                  <p className="text-xs text-muted-foreground">{viewingPost.imagePrompt}</p>
                </div>
              )}
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <Badge className={SOCIAL_STATUS_COLORS[viewingPost.status]}>{viewingPost.status}</Badge>
                {viewingPost.scheduledAt && (
                  <span>Scheduled: {new Date(viewingPost.scheduledAt).toLocaleString()}</span>
                )}
              </div>
              <Button
                className="w-full"
                variant="outline"
                onClick={() => {
                  const hashtagStr = (viewingPost.hashtags || []).map((h: string) => `#${h}`).join(" ");
                  copyToClipboard(`${viewingPost.content}\n\n${hashtagStr}`);
                }}
              >
                <Copy className="h-4 w-4 mr-2" /> Copy Full Post
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Edit Post Dialog */}
      <Dialog open={!!editingPost} onOpenChange={() => setEditingPost(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Post</DialogTitle>
            <DialogDescription>Modify the post content before publishing.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <Textarea
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              rows={6}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingPost(null)}>Cancel</Button>
            <Button
              onClick={() => {
                if (!editingPost || !activeAccountId) return;
                updateMutation.mutate({
                  postId: editingPost.id,
                  accountId: activeAccountId,
                  content: editContent,
                });
              }}
              disabled={updateMutation.isPending}
            >
              {updateMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Social Media — Brand Voice Settings Sub-tab
// ═══════════════════════════════════════════════════════════════════════════

function BrandVoiceSettings() {
  const { currentAccountId: activeAccountId } = useAccount();
  const utils = trpc.useUtils();

  const { data, isLoading } = trpc.socialContent.getBrandVoice.useQuery(
    { accountId: activeAccountId! },
    { enabled: !!activeAccountId }
  );

  const updateMutation = trpc.socialContent.updateBrandVoice.useMutation({
    onSuccess: () => {
      toast.success("Brand voice settings saved!");
      utils.socialContent.getBrandVoice.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  const [industry, setIndustry] = useState("");
  const [targetAudience, setTargetAudience] = useState("");
  const [brandPersonality, setBrandPersonality] = useState("");
  const [preferredTone, setPreferredTone] = useState("professional");
  const [keyMessages, setKeyMessages] = useState<string[]>([""]);
  const [avoidTopics, setAvoidTopics] = useState<string[]>([""]);
  const [examplePosts, setExamplePosts] = useState<string[]>([""]);

  useEffect(() => {
    if (data) {
      setIndustry(data.industry || "");
      setTargetAudience(data.targetAudience || "");
      setBrandPersonality(data.brandPersonality || "");
      setPreferredTone(data.preferredTone || "professional");
      setKeyMessages(data.keyMessages?.length ? data.keyMessages : [""]);
      setAvoidTopics(data.avoidTopics?.length ? data.avoidTopics : [""]);
      setExamplePosts(data.examplePosts?.length ? data.examplePosts : [""]);
    }
  }, [data]);

  const handleSave = () => {
    if (!activeAccountId) return;
    updateMutation.mutate({
      accountId: activeAccountId,
      industry: industry.trim() || undefined,
      targetAudience: targetAudience.trim() || undefined,
      brandPersonality: brandPersonality.trim() || undefined,
      preferredTone,
      keyMessages: keyMessages.filter((m) => m.trim()),
      avoidTopics: avoidTopics.filter((t) => t.trim()),
      examplePosts: examplePosts.filter((p) => p.trim()),
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Palette className="h-5 w-5 text-primary" />
            Brand Voice Configuration
          </CardTitle>
          <CardDescription>
            Configure your brand&apos;s voice and personality. This information is used by the AI to generate content that matches your brand.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Industry</Label>
              <Input
                placeholder="e.g., Mortgage, Real Estate, Insurance..."
                value={industry}
                onChange={(e) => setIndustry(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Target Audience</Label>
              <Input
                placeholder="e.g., First-time homebuyers, Real estate investors..."
                value={targetAudience}
                onChange={(e) => setTargetAudience(e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Brand Personality</Label>
              <Input
                placeholder="e.g., Trustworthy, knowledgeable, approachable..."
                value={brandPersonality}
                onChange={(e) => setBrandPersonality(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Preferred Tone</Label>
              <Select value={preferredTone} onValueChange={setPreferredTone}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="professional">Professional</SelectItem>
                  <SelectItem value="casual">Casual</SelectItem>
                  <SelectItem value="funny">Funny</SelectItem>
                  <SelectItem value="inspiring">Inspiring</SelectItem>
                  <SelectItem value="educational">Educational</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <Separator />

          {/* Key Messages */}
          <div className="space-y-2">
            <Label>Key Messages / Selling Points</Label>
            <p className="text-xs text-muted-foreground">Core messages the AI should weave into content</p>
            {keyMessages.map((m, i) => (
              <div key={i} className="flex gap-2">
                <Input
                  placeholder={`Key message ${i + 1}...`}
                  value={m}
                  onChange={(e) => {
                    const updated = [...keyMessages];
                    updated[i] = e.target.value;
                    setKeyMessages(updated);
                  }}
                />
                {keyMessages.length > 1 && (
                  <Button variant="ghost" size="icon" onClick={() => setKeyMessages(keyMessages.filter((_, j) => j !== i))}>
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
            ))}
            <Button variant="outline" size="sm" onClick={() => setKeyMessages([...keyMessages, ""])}>
              <Plus className="h-4 w-4 mr-1" /> Add Message
            </Button>
          </div>

          {/* Avoid Topics */}
          <div className="space-y-2">
            <Label>Topics to Avoid</Label>
            <p className="text-xs text-muted-foreground">Topics the AI should never mention in generated content</p>
            {avoidTopics.map((t, i) => (
              <div key={i} className="flex gap-2">
                <Input
                  placeholder={`Topic to avoid ${i + 1}...`}
                  value={t}
                  onChange={(e) => {
                    const updated = [...avoidTopics];
                    updated[i] = e.target.value;
                    setAvoidTopics(updated);
                  }}
                />
                {avoidTopics.length > 1 && (
                  <Button variant="ghost" size="icon" onClick={() => setAvoidTopics(avoidTopics.filter((_, j) => j !== i))}>
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
            ))}
            <Button variant="outline" size="sm" onClick={() => setAvoidTopics([...avoidTopics, ""])}>
              <Plus className="h-4 w-4 mr-1" /> Add Topic
            </Button>
          </div>

          {/* Example Posts */}
          <div className="space-y-2">
            <Label>Example Posts (for style reference)</Label>
            <p className="text-xs text-muted-foreground">Paste examples of posts that match your desired style</p>
            {examplePosts.map((p, i) => (
              <div key={i} className="flex gap-2">
                <Textarea
                  placeholder={`Example post ${i + 1}...`}
                  value={p}
                  onChange={(e) => {
                    const updated = [...examplePosts];
                    updated[i] = e.target.value;
                    setExamplePosts(updated);
                  }}
                  rows={2}
                />
                {examplePosts.length > 1 && (
                  <Button variant="ghost" size="icon" onClick={() => setExamplePosts(examplePosts.filter((_, j) => j !== i))}>
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
            ))}
            <Button variant="outline" size="sm" onClick={() => setExamplePosts([...examplePosts, ""])}>
              <Plus className="h-4 w-4 mr-1" /> Add Example
            </Button>
          </div>

          <Separator />

          <Button onClick={handleSave} disabled={updateMutation.isPending}>
            {updateMutation.isPending ? (
              <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Saving...</>
            ) : (
              <><Save className="h-4 w-4 mr-2" /> Save Brand Voice</>
            )}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Social Media Tab (wraps all 4 sub-tabs)
// ═══════════════════════════════════════════════════════════════════════════

function SocialMediaTab() {
  return (
    <Tabs defaultValue="generator" className="space-y-6">
      <TabsList className="grid w-full grid-cols-4 lg:w-auto lg:inline-grid">
        <TabsTrigger value="generator" className="gap-1">
          <Sparkles className="h-4 w-4" />
          <span className="hidden sm:inline">Generator</span>
        </TabsTrigger>
        <TabsTrigger value="calendar" className="gap-1">
          <Calendar className="h-4 w-4" />
          <span className="hidden sm:inline">Calendar</span>
        </TabsTrigger>
        <TabsTrigger value="posts" className="gap-1">
          <FileText className="h-4 w-4" />
          <span className="hidden sm:inline">Posts</span>
        </TabsTrigger>
        <TabsTrigger value="brand-voice" className="gap-1">
          <Palette className="h-4 w-4" />
          <span className="hidden sm:inline">Brand Voice</span>
        </TabsTrigger>
      </TabsList>

      <TabsContent value="generator">
        <ContentGenerator />
      </TabsContent>
      <TabsContent value="calendar">
        <ContentCalendar />
      </TabsContent>
      <TabsContent value="posts">
        <PostsManagement />
      </TabsContent>
      <TabsContent value="brand-voice">
        <BrandVoiceSettings />
      </TabsContent>
    </Tabs>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Main Content Hub Page — Top-level Tabs
// ═══════════════════════════════════════════════════════════════════════════

export default function ContentHub() {
  const { currentAccountId: activeAccountId, isAgencyScope: isAgencyOverview } = useAccount();

  if (isAgencyOverview) {
    return (
      <div className="container py-8">
        <Card>
          <CardContent className="py-12 text-center">
            <BookOpen className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
            <h3 className="text-lg font-medium mb-2">Select a Sub-Account</h3>
            <p className="text-muted-foreground">
              Switch to a sub-account to access the content tools.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!activeAccountId) {
    return (
      <div className="container py-8">
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-7xl mx-auto">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <BookOpen className="h-6 w-6 text-primary" />
          Content Hub
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Generate, manage, and repurpose all your content — blog articles and social media — in one place.
        </p>
      </div>

      {/* Top-level Tabs */}
      <Tabs defaultValue="blog-articles" className="space-y-6">
        <TabsList>
          <TabsTrigger value="blog-articles" className="gap-2">
            <FileText className="h-4 w-4" />
            Blog Articles
          </TabsTrigger>
          <TabsTrigger value="social-media" className="gap-2">
            <Share2 className="h-4 w-4" />
            Social Media
          </TabsTrigger>
        </TabsList>

        <TabsContent value="blog-articles">
          <BlogArticlesTab />
        </TabsContent>

        <TabsContent value="social-media">
          <SocialMediaTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
