import { useState, useMemo, useCallback, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { useAccount } from "@/contexts/AccountContext";
import { useAuth } from "@/_core/hooks/useAuth";
import { EmailPreview } from "@/components/EmailPreview";
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
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
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
  Mail,
  Send,
  User,
  AlertTriangle,
  ExternalLink,
  Users,
  ChevronDown,
  ChevronUp,
  Check,
  XCircle,
  PenLine,
  Star,
  Type,
} from "lucide-react";
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
  const [bulkGenerateImage, setBulkGenerateImage] = useState(false);

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
      shouldGenerateImage: bulkGenerateImage,
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
      <Dialog open={showBulkDialog} onOpenChange={(open) => {
        setShowBulkDialog(open);
        if (!open) {
          setBulkGenerateImage(false);
        }
      }}>
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

            <div className="flex items-center justify-between">
              <div>
                <Label className="text-sm font-medium">Generate Featured Image</Label>
                <p className="text-xs text-muted-foreground">
                  Creates an AI image for each article (uses extra credits)
                </p>
              </div>
              <Switch checked={bulkGenerateImage} onCheckedChange={setBulkGenerateImage} />
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
  const [socialVariations, setSocialVariations] = useState(3);
  const [socialGenerateImage, setSocialGenerateImage] = useState(false);
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
      toast.success(`Generated ${data.variations.length} post${data.variations.length === 1 ? "" : " variations"}!`);
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
      variationsCount: socialVariations,
      shouldGenerateImage: socialGenerateImage,
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
          <div className="space-y-2">
            <Label>Number of Posts</Label>
            <div className="flex gap-1">
              {[1, 2, 3].map((n) => (
                <Button
                  key={n}
                  type="button"
                  size="sm"
                  variant={socialVariations === n ? "default" : "outline"}
                  className="flex-1"
                  onClick={() => setSocialVariations(n)}
                >
                  {n}
                </Button>
              ))}
            </div>
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
          <div className="flex items-center justify-between p-3 rounded-md border">
            <div>
              <Label className="text-sm font-medium">Generate Featured Image</Label>
              <p className="text-xs text-muted-foreground">Creates an AI image for each post (uses extra credits)</p>
            </div>
            <Switch checked={socialGenerateImage} onCheckedChange={setSocialGenerateImage} />
          </div>

          <div className="flex flex-wrap gap-3">
            <Button
              onClick={handleGenerate}
              disabled={generateMutation.isPending || !topic.trim()}
            >
              {generateMutation.isPending ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Generating...</>
              ) : (
                <><Sparkles className="h-4 w-4 mr-2" /> Generate {socialVariations} {socialVariations === 1 ? "Post" : "Posts"}</>
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
          <div className={`grid gap-4 ${variations.length === 1 ? "grid-cols-1" : variations.length === 2 ? "grid-cols-1 lg:grid-cols-2" : "grid-cols-1 lg:grid-cols-3"}`}>
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
                  {v.imageUrl && (
                    <img
                      src={v.imageUrl}
                      alt="Generated post image"
                      className="rounded-lg w-full object-cover max-h-48"
                    />
                  )}
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
                  {!v.imageUrl && v.imagePrompt && (
                    <>
                      <Separator />
                      <div className="text-xs text-muted-foreground italic">
                        <div className="flex items-center gap-1 mb-1 font-medium not-italic">
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
// Email Tab — AI Email Generator + Drafts
// ═══════════════════════════════════════════════════════════════════════════

const EMAIL_TEMPLATE_OPTIONS = [
  { value: "newsletter", label: "Newsletter", desc: "200–350 word branded update" },
  { value: "nurture", label: "Nurture", desc: "Value-first lead nurturing" },
  { value: "follow_up", label: "Follow-Up", desc: "Reference a past conversation" },
  { value: "introduction", label: "Introduction", desc: "First-touch outreach" },
  { value: "promotional", label: "Promotional", desc: "Offer with urgency + CTA" },
  { value: "re_engagement", label: "Re-Engagement", desc: "Win back cold contacts" },
  { value: "custom", label: "Custom", desc: "Your own instructions" },
] as const;

const EMAIL_TONE_OPTIONS = [
  { value: "professional", label: "Professional" },
  { value: "friendly", label: "Friendly" },
  { value: "casual", label: "Casual" },
  { value: "urgent", label: "Urgent" },
  { value: "empathetic", label: "Empathetic" },
] as const;

// ─── Signatures Sub-Tab Component ────────────────────────────────────────────
function EmailSignaturesTab() {
  const { currentAccountId: accountId } = useAccount();
  const utils = trpc.useUtils();

  const [editingSignature, setEditingSignature] = useState<{ id?: number; name: string; html: string; isDefault: boolean } | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);
  const [previewHtml, setPreviewHtml] = useState<string | null>(null);

  const signaturesQuery = trpc.emailContent.listSignatures.useQuery(
    { accountId: accountId! },
    { enabled: !!accountId }
  );

  const createMutation = trpc.emailContent.createSignature.useMutation({
    onSuccess: () => {
      toast.success("Signature created!");
      setEditingSignature(null);
      utils.emailContent.listSignatures.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  const updateMutation = trpc.emailContent.updateSignature.useMutation({
    onSuccess: () => {
      toast.success("Signature updated!");
      setEditingSignature(null);
      utils.emailContent.listSignatures.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  const deleteMutation = trpc.emailContent.deleteSignature.useMutation({
    onSuccess: () => {
      toast.success("Signature deleted");
      setDeleteConfirmId(null);
      utils.emailContent.listSignatures.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  const setDefaultMutation = trpc.emailContent.setDefaultSignature.useMutation({
    onSuccess: () => {
      toast.success("Default signature updated");
      utils.emailContent.listSignatures.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  const handleSave = () => {
    if (!accountId || !editingSignature) return;
    if (!editingSignature.name.trim() || !editingSignature.html.trim()) {
      toast.error("Name and HTML content are required");
      return;
    }
    if (editingSignature.id) {
      updateMutation.mutate({
        accountId,
        id: editingSignature.id,
        name: editingSignature.name.trim(),
        html: editingSignature.html.trim(),
        isDefault: editingSignature.isDefault,
      });
    } else {
      createMutation.mutate({
        accountId,
        name: editingSignature.name.trim(),
        html: editingSignature.html.trim(),
        isDefault: editingSignature.isDefault,
      });
    }
  };

  const signatures = signaturesQuery.data || [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <PenLine className="h-5 w-5" />
            Email Signatures
          </h3>
          <p className="text-sm text-muted-foreground mt-1">
            Create reusable HTML signatures that auto-append to generated emails.
          </p>
        </div>
        <Button onClick={() => setEditingSignature({ name: "", html: "", isDefault: signatures.length === 0 })}>
          <Plus className="h-4 w-4 mr-1" />
          New Signature
        </Button>
      </div>

      {/* Signatures List */}
      {signaturesQuery.isLoading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : signatures.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <PenLine className="h-10 w-10 mx-auto text-muted-foreground/40 mb-3" />
            <p className="text-muted-foreground">No signatures yet. Create one to auto-append to your emails.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {signatures.map((sig) => (
            <Card key={sig.id} className={sig.isDefault ? "border-primary/50 ring-1 ring-primary/20" : ""}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base flex items-center gap-2">
                    {sig.name}
                    {sig.isDefault && (
                      <Badge variant="secondary" className="text-xs gap-1">
                        <Star className="h-3 w-3 fill-current" />
                        Default
                      </Badge>
                    )}
                  </CardTitle>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => setEditingSignature({ id: sig.id, name: sig.name, html: sig.html, isDefault: sig.isDefault })}>
                        <Edit className="h-4 w-4 mr-2" /> Edit
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => setPreviewHtml(sig.html)}>
                        <Eye className="h-4 w-4 mr-2" /> Preview
                      </DropdownMenuItem>
                      {!sig.isDefault && (
                        <DropdownMenuItem onClick={() => accountId && setDefaultMutation.mutate({ accountId, id: sig.id })}>
                          <Star className="h-4 w-4 mr-2" /> Set as Default
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuItem className="text-destructive" onClick={() => setDeleteConfirmId(sig.id)}>
                        <Trash2 className="h-4 w-4 mr-2" /> Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
                <CardDescription className="text-xs">
                  Created {new Date(sig.createdAt).toLocaleDateString()}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div
                  className="border rounded-md p-3 bg-muted/30 text-sm max-h-32 overflow-hidden relative"
                  dangerouslySetInnerHTML={{ __html: sig.html }}
                />
                <div className="absolute bottom-0 left-0 right-0 h-8 bg-gradient-to-t from-muted/30 to-transparent pointer-events-none" style={{ position: 'relative', marginTop: '-2rem' }} />
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create/Edit Signature Dialog */}
      <Dialog open={!!editingSignature} onOpenChange={(open) => !open && setEditingSignature(null)}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <PenLine className="h-5 w-5 text-primary" />
              {editingSignature?.id ? "Edit Signature" : "Create Signature"}
            </DialogTitle>
            <DialogDescription>
              Write your signature in HTML. Use inline styles for best email client compatibility.
            </DialogDescription>
          </DialogHeader>

          {editingSignature && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Signature Name</Label>
                <Input
                  placeholder="e.g., Professional, Casual, Holiday..."
                  value={editingSignature.name}
                  onChange={(e) => setEditingSignature({ ...editingSignature, name: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label>HTML Content</Label>
                <Textarea
                  className="font-mono text-sm min-h-[200px]"
                  placeholder='<table cellpadding="0" cellspacing="0" style="font-family: Arial, sans-serif;">&#10;  <tr>&#10;    <td style="padding-right: 15px; border-right: 2px solid #0066cc;">&#10;      <strong>Your Name</strong><br/>&#10;      <span style="color: #666;">Title | Company</span>&#10;    </td>&#10;    <td style="padding-left: 15px;">&#10;      <span style="color: #666;">📞 (555) 123-4567</span><br/>&#10;      <a href="mailto:you@company.com" style="color: #0066cc;">you@company.com</a>&#10;    </td>&#10;  </tr>&#10;</table>'
                  value={editingSignature.html}
                  onChange={(e) => setEditingSignature({ ...editingSignature, html: e.target.value })}
                />
              </div>

              <div className="flex items-center gap-2">
                <Switch
                  checked={editingSignature.isDefault}
                  onCheckedChange={(checked) => setEditingSignature({ ...editingSignature, isDefault: checked })}
                />
                <Label className="cursor-pointer">Set as default signature</Label>
              </div>

              {/* Live Preview */}
              {editingSignature.html.trim() && (
                <div className="space-y-2">
                  <Label className="text-muted-foreground">Live Preview</Label>
                  <div className="border rounded-md p-4 bg-white">
                    <div dangerouslySetInnerHTML={{ __html: editingSignature.html }} />
                  </div>
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingSignature(null)}>Cancel</Button>
            <Button
              onClick={handleSave}
              disabled={createMutation.isPending || updateMutation.isPending}
            >
              {(createMutation.isPending || updateMutation.isPending) ? (
                <><Loader2 className="h-4 w-4 animate-spin mr-1" /> Saving...</>
              ) : (
                <><Save className="h-4 w-4 mr-1" /> {editingSignature?.id ? "Update" : "Create"}</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Preview Dialog */}
      <Dialog open={!!previewHtml} onOpenChange={(open) => !open && setPreviewHtml(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Signature Preview</DialogTitle>
          </DialogHeader>
          <div className="border rounded-md p-6 bg-white">
            <div dangerouslySetInnerHTML={{ __html: previewHtml || "" }} />
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteConfirmId} onOpenChange={(open) => !open && setDeleteConfirmId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Signature</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this signature? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => accountId && deleteConfirmId && deleteMutation.mutate({ accountId, id: deleteConfirmId })}
              disabled={deleteMutation.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Trash2 className="h-4 w-4 mr-1" />}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ─── Email Generator + Drafts Sub-Tab ────────────────────────────────────────
function EmailGeneratorTab() {
  const { currentAccountId: accountId, currentAccount } = useAccount();
  const { user } = useAuth();
  const utils = trpc.useUtils();

  // Generator state
  const [emailTemplateType, setEmailTemplateType] = useState("newsletter");
  const [emailTone, setEmailTone] = useState("professional");
  const [emailTopic, setEmailTopic] = useState("");
  const [emailCustomInstructions, setEmailCustomInstructions] = useState("");
  const [emailAiModel, setEmailAiModel] = useState("gemini-2.5-flash");
  const [showCustomInstructions, setShowCustomInstructions] = useState(false);

  // Contact-based generation
  const [useContact, setUseContact] = useState(false);
  const [contactSearch, setContactSearch] = useState("");
  const [selectedContact, setSelectedContact] = useState<{ id: number; name: string; email: string | null } | null>(null);
  const [showContactDropdown, setShowContactDropdown] = useState(false);

  // Generated email preview
  const [generatedEmail, setGeneratedEmail] = useState<{ subject: string; previewText: string; body: string; contactName: string | null } | null>(null);
  const [showSource, setShowSource] = useState(false);

  // Send confirmation (for generated email send)
  const [sendConfirmDraftId, setSendConfirmDraftId] = useState<number | null>(null);
  const [sendConfirmInfo, setSendConfirmInfo] = useState<{ name: string; email: string } | null>(null);

  // Bulk email state
  const [bulkDialogOpen, setBulkDialogOpen] = useState(false);
  const [bulkStep, setBulkStep] = useState<1 | 2 | 3>(1);
  const [bulkContactSearch, setBulkContactSearch] = useState("");
  const [bulkSelectedContacts, setBulkSelectedContacts] = useState<Array<{ id: number; name: string; email: string | null }>>([]); 
  const [bulkTemplateType, setBulkTemplateType] = useState("newsletter");
  const [bulkTone, setBulkTone] = useState("professional");
  const [bulkTopic, setBulkTopic] = useState("");
  const [bulkCustomInstructions, setBulkCustomInstructions] = useState("");
  const [bulkAiModel, setBulkAiModel] = useState("gemini-2.5-flash");
  const [bulkIncludeHistory, setBulkIncludeHistory] = useState(false);
  const [bulkResults, setBulkResults] = useState<Array<{ contactId: number; contactName: string; contactEmail: string | null; subject: string; previewText: string; body: string; draftId: number | null; error: string | null }>>([]);
  const [bulkExpandedIdx, setBulkExpandedIdx] = useState<number | null>(null);
  const [bulkSendConfirmOpen, setBulkSendConfirmOpen] = useState(false);

  // Contact search query
  const contactsQuery = trpc.contacts.list.useQuery(
    { accountId: accountId!, search: contactSearch, limit: 8 },
    { enabled: !!accountId && useContact && contactSearch.length >= 2 }
  );

  // Bulk contact search query
  const bulkContactsQuery = trpc.contacts.list.useQuery(
    { accountId: accountId!, search: bulkContactSearch, limit: 20 },
    { enabled: !!accountId && bulkDialogOpen && bulkStep === 1 }
  );

  // Mutations
  const generateMutation = trpc.emailContent.generateEmail.useMutation({
    onSuccess: (data) => {
      setGeneratedEmail(data);
      toast.success("Email generated!");
    },
    onError: (err) => toast.error(err.message),
  });

  const saveDraftMutation = trpc.emailContent.saveDraft.useMutation({
    onSuccess: () => {
      toast.success("Draft saved!");
      utils.emailContent.getDrafts.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  const sendEmailMutation = trpc.emailContent.sendEmail.useMutation({
    onSuccess: () => {
      toast.success("Email sent!");
      setSendConfirmDraftId(null);
      setSendConfirmInfo(null);
      utils.emailContent.getDrafts.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  const bulkGenerateMutation = trpc.emailContent.bulkGenerateEmails.useMutation({
    onSuccess: (data) => {
      setBulkResults(data.results);
      toast.success(`Generated ${data.totalGenerated} emails${data.totalFailed > 0 ? `, ${data.totalFailed} failed` : ""}`);
      utils.emailContent.getDrafts.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  const bulkSendMutation = trpc.emailContent.bulkSendEmails.useMutation({
    onSuccess: (data) => {
      toast.success(`Sent ${data.totalSent} emails${data.totalFailed > 0 ? `, ${data.totalFailed} failed` : ""}`);
      setBulkSendConfirmOpen(false);
      utils.emailContent.getDrafts.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  const handleGenerate = () => {
    if (!accountId || !emailTopic.trim()) return;
    generateMutation.mutate({
      accountId,
      templateType: emailTemplateType as any,
      tone: emailTone as any,
      topic: emailTopic.trim(),
      customInstructions: emailCustomInstructions.trim() || undefined,
      contactId: selectedContact?.id,
      includeConversationHistory: useContact && !!selectedContact,
      aiModel: emailAiModel,
    });
  };

  const handleSaveDraft = () => {
    if (!accountId || !generatedEmail) return;
    saveDraftMutation.mutate({
      accountId,
      contactId: selectedContact?.id,
      subject: generatedEmail.subject,
      body: generatedEmail.body,
      previewText: generatedEmail.previewText,
      templateType: emailTemplateType,
      tone: emailTone,
      topic: emailTopic,
      aiModel: emailAiModel,
    });
  };

  const handleSendGenerated = () => {
    // First save the draft, then send it
    if (!accountId || !generatedEmail || !selectedContact?.email) return;
    setSendConfirmInfo({ name: selectedContact.name || "Contact", email: selectedContact.email });
    // We'll save and send after confirmation
    setSendConfirmDraftId(-1); // -1 = generated email, not yet saved
  };

  const confirmSendGenerated = async () => {
    if (!accountId || !generatedEmail) return;
    try {
      const { id } = await saveDraftMutation.mutateAsync({
        accountId,
        contactId: selectedContact?.id,
        subject: generatedEmail.subject,
        body: generatedEmail.body,
        previewText: generatedEmail.previewText,
        templateType: emailTemplateType,
        tone: emailTone,
        topic: emailTopic,
        aiModel: emailAiModel,
      });
      await sendEmailMutation.mutateAsync({ accountId, draftId: id });
    } catch {
      // errors handled by mutation callbacks
    }
  };

  const localCopyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copied!`);
  };

  const toggleBulkContact = (contact: { id: number; name: string; email: string | null }) => {
    setBulkSelectedContacts((prev) => {
      const exists = prev.find((c) => c.id === contact.id);
      if (exists) return prev.filter((c) => c.id !== contact.id);
      return [...prev, contact];
    });
  };

  const handleBulkGenerate = () => {
    if (!accountId || !bulkTopic.trim() || bulkSelectedContacts.length === 0) return;
    bulkGenerateMutation.mutate({
      accountId,
      contactIds: bulkSelectedContacts.map((c) => c.id),
      templateType: bulkTemplateType as any,
      tone: bulkTone as any,
      topic: bulkTopic.trim(),
      customInstructions: bulkCustomInstructions.trim() || undefined,
      includeConversationHistory: bulkIncludeHistory,
      aiModel: bulkAiModel,
      saveDrafts: true,
    });
  };

  const handleBulkSendAll = () => {
    const sendable = bulkResults.filter((r) => !r.error && r.draftId && r.contactEmail);
    if (sendable.length === 0) {
      toast.error("No sendable emails");
      return;
    }
    setBulkSendConfirmOpen(true);
  };

  const confirmBulkSend = () => {
    if (!accountId) return;
    const draftIds = bulkResults
      .filter((r) => !r.error && r.draftId)
      .map((r) => r.draftId!)
      .filter(Boolean);
    bulkSendMutation.mutate({ accountId, draftIds });
  };

  const resetBulkDialog = () => {
    setBulkStep(1);
    setBulkContactSearch("");
    setBulkSelectedContacts([]);
    setBulkTemplateType("newsletter");
    setBulkTone("professional");
    setBulkTopic("");
    setBulkCustomInstructions("");
    setBulkAiModel("gemini-2.5-flash");
    setBulkIncludeHistory(false);
    setBulkResults([]);
    setBulkExpandedIdx(null);
    setBulkSendConfirmOpen(false);
  };

  return (
    <div className="space-y-8">
      {/* Section A \u2014 AI Email Generator */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5 text-primary" />
            AI Email Generator
          </CardTitle>
          <CardDescription>
            Generate professional emails with AI. Optionally personalize based on a contact's conversation history.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Row 1: Template Type + Tone */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Template Type</Label>
              <Select value={emailTemplateType} onValueChange={setEmailTemplateType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {EMAIL_TEMPLATE_OPTIONS.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      <div className="flex flex-col">
                        <span>{t.label}</span>
                        <span className="text-xs text-muted-foreground">{t.desc}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Tone</Label>
              <Select value={emailTone} onValueChange={setEmailTone}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {EMAIL_TONE_OPTIONS.map((t) => (
                    <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Row 2: Topic */}
          <div className="space-y-2">
            <Label>Topic / Subject</Label>
            <Input
              placeholder="e.g., Spring mortgage rates update, Follow up from our call..."
              value={emailTopic}
              onChange={(e) => setEmailTopic(e.target.value)}
            />
          </div>

          {/* Row 3: AI Model */}
          <div className="space-y-2">
            <Label>AI Model</Label>
            <Select value={emailAiModel} onValueChange={setEmailAiModel}>
              <SelectTrigger><SelectValue /></SelectTrigger>
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

          {/* Custom Instructions (collapsible) */}
          <div className="space-y-2">
            <button
              type="button"
              onClick={() => setShowCustomInstructions(!showCustomInstructions)}
              className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1"
            >
              {showCustomInstructions ? "▾" : "▸"} Custom Instructions {emailTemplateType === "custom" && "(recommended)"}
            </button>
            {(showCustomInstructions || emailTemplateType === "custom") && (
              <Textarea
                placeholder="Add specific instructions for the AI (e.g., mention a specific product, include a discount code, reference an event)..."
                value={emailCustomInstructions}
                onChange={(e) => setEmailCustomInstructions(e.target.value)}
                rows={3}
              />
            )}
          </div>

          {/* Contact-based generation */}
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <Switch checked={useContact} onCheckedChange={(v) => { setUseContact(v); if (!v) { setSelectedContact(null); setContactSearch(""); } }} />
              <Label className="cursor-pointer">Generate from contact conversation</Label>
            </div>
            {useContact && (
              <div className="relative">
                {selectedContact ? (
                  <div className="flex items-center gap-2 p-2 border rounded-md bg-muted/30">
                    <User className="h-4 w-4 text-muted-foreground" />
                    <Badge variant="secondary" className="gap-1">
                      {selectedContact.name}
                      {selectedContact.email && <span className="text-xs opacity-70">({selectedContact.email})</span>}
                    </Badge>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0 ml-auto"
                      onClick={() => { setSelectedContact(null); setContactSearch(""); }}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                ) : (
                  <div>
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Search contacts by name, email, or phone..."
                        className="pl-9"
                        value={contactSearch}
                        onChange={(e) => { setContactSearch(e.target.value); setShowContactDropdown(true); }}
                        onFocus={() => setShowContactDropdown(true)}
                        onBlur={() => setTimeout(() => setShowContactDropdown(false), 200)}
                      />
                    </div>
                    {showContactDropdown && contactSearch.length >= 2 && (
                      <div className="absolute z-50 w-full mt-1 bg-popover text-popover-foreground border rounded-md shadow-lg max-h-48 overflow-y-auto">
                        {contactsQuery.isLoading ? (
                          <div className="p-3 text-center text-sm text-muted-foreground">
                            <Loader2 className="h-4 w-4 animate-spin inline mr-1" /> Searching...
                          </div>
                        ) : contactsQuery.data?.data && contactsQuery.data.data.length > 0 ? (
                          contactsQuery.data.data.map((c) => (
                            <button
                              key={c.id}
                              type="button"
                              className="w-full text-left px-3 py-2 hover:bg-accent hover:text-accent-foreground text-sm flex items-center gap-2"
                              onMouseDown={(e) => e.preventDefault()}
                              onClick={() => {
                                setSelectedContact({ id: c.id, name: `${c.firstName} ${c.lastName}`.trim(), email: c.email });
                                setContactSearch("");
                                setShowContactDropdown(false);
                              }}
                            >
                              <User className="h-3 w-3 text-muted-foreground" />
                              <span>{c.firstName} {c.lastName}</span>
                              {c.email && <span className="text-xs text-muted-foreground ml-auto">{c.email}</span>}
                            </button>
                          ))
                        ) : (
                          <div className="p-3 text-center text-sm text-muted-foreground">No contacts found</div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Generate Buttons */}
          <div className="flex flex-wrap gap-3">
            <Button
              onClick={handleGenerate}
              disabled={!emailTopic.trim() || generateMutation.isPending}
            >
              {generateMutation.isPending ? (
                <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Generating...</>
              ) : (
                <><Sparkles className="h-4 w-4 mr-2" /> Generate Email</>
              )}
            </Button>
            <Button
              variant="outline"
              onClick={() => setBulkDialogOpen(true)}
            >
              <Users className="h-4 w-4 mr-2" /> Bulk Email
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Generated Email Preview */}
      {generatedEmail && (
        <Card className="border-primary/20">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Eye className="h-5 w-5 text-primary" />
              Generated Email Preview
              {generatedEmail.contactName && (
                <Badge variant="outline" className="ml-2 font-normal">
                  <User className="h-3 w-3 mr-1" /> For: {generatedEmail.contactName}
                </Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <EmailPreview
              subject={generatedEmail.subject}
              previewText={generatedEmail.previewText}
              body={generatedEmail.body}
              senderName={user?.name || "You"}
              senderEmail={user?.email || "you@company.com"}
              recipientName={generatedEmail.contactName || "Recipient"}
              recipientEmail={selectedContact?.email || "recipient@email.com"}
              showActions={true}
            />

            {/* Actions */}
            <div className="flex flex-wrap gap-3 pt-2">
              <Button onClick={handleSaveDraft} disabled={saveDraftMutation.isPending} variant="outline">
                {saveDraftMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
                Save as Draft
              </Button>
              <Button
                onClick={handleSendGenerated}
                disabled={!selectedContact?.email || sendEmailMutation.isPending}
                title={!selectedContact?.email ? "Select a contact with an email address to send" : ""}
              >
                {sendEmailMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Send className="h-4 w-4 mr-2" />}
                Send Now
              </Button>
              <Button variant="ghost" onClick={() => localCopyToClipboard(generatedEmail.body, "Email body")}>
                <Copy className="h-4 w-4 mr-2" /> Copy Body
              </Button>
            </div>
          </CardContent>
        </Card>
      )}



      {/* Send Confirmation Dialog */}
      <AlertDialog open={sendConfirmDraftId !== null} onOpenChange={(open) => { if (!open) { setSendConfirmDraftId(null); setSendConfirmInfo(null); } }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Send className="h-5 w-5" /> Confirm Send
            </AlertDialogTitle>
            <AlertDialogDescription>
              {sendConfirmInfo && (
                <>Send this email to <strong>{sendConfirmInfo.name}</strong>? The email will be delivered via your configured email provider.</>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (sendConfirmDraftId === -1) {
                  confirmSendGenerated();
                } else if (accountId && sendConfirmDraftId) {
                  sendEmailMutation.mutate({ accountId, draftId: sendConfirmDraftId });
                }
              }}
            >
              {sendEmailMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Send className="h-4 w-4 mr-2" />}
              Send Email
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ─── Bulk Email Dialog ─── */}
      <Dialog open={bulkDialogOpen} onOpenChange={(open) => { if (!open) resetBulkDialog(); setBulkDialogOpen(open); }}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users className="h-5 w-5 text-primary" />
              Bulk Email Generation
            </DialogTitle>
            <DialogDescription>
              {bulkStep === 1 && "Step 1 of 3 — Select contacts to email"}
              {bulkStep === 2 && "Step 2 of 3 — Configure email settings"}
              {bulkStep === 3 && "Step 3 of 3 — Review generated emails"}
            </DialogDescription>
          </DialogHeader>

          {/* Step indicators */}
          <div className="flex items-center gap-2 mb-4">
            {[1, 2, 3].map((s) => (
              <div key={s} className="flex items-center gap-2">
                <div className={`h-8 w-8 rounded-full flex items-center justify-center text-sm font-medium ${
                  bulkStep >= s ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                }`}>{s}</div>
                {s < 3 && <div className={`h-0.5 w-8 ${bulkStep > s ? "bg-primary" : "bg-muted"}`} />}
              </div>
            ))}
            <span className="text-sm text-muted-foreground ml-2">
              {bulkStep === 1 && "Select Contacts"}
              {bulkStep === 2 && "Email Settings"}
              {bulkStep === 3 && "Review & Send"}
            </span>
          </div>

          {/* Step 1: Contact Selection */}
          {bulkStep === 1 && (
            <div className="space-y-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search contacts by name, email, or company..."
                  value={bulkContactSearch}
                  onChange={(e) => setBulkContactSearch(e.target.value)}
                  className="pl-10"
                />
              </div>

              {bulkSelectedContacts.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  <Badge variant="secondary" className="font-medium">
                    {bulkSelectedContacts.length} selected
                  </Badge>
                  {bulkSelectedContacts.map((c) => (
                    <Badge key={c.id} variant="outline" className="flex items-center gap-1">
                      {c.name}
                      {!c.email && <AlertTriangle className="h-3 w-3 text-amber-500" />}
                      <button onClick={() => toggleBulkContact(c)} className="ml-1 hover:text-destructive">
                        <XCircle className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                  <button onClick={() => setBulkSelectedContacts([])} className="text-xs text-muted-foreground hover:text-destructive">
                    Clear all
                  </button>
                </div>
              )}

              <ScrollArea className="h-[320px] border rounded-lg">
                {bulkContactsQuery.isLoading ? (
                  <div className="flex items-center justify-center h-full">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : bulkContactsQuery.data?.data && bulkContactsQuery.data.data.length > 0 ? (
                  <div className="divide-y">
                    {/* Select all on page */}
                    <div className="flex items-center gap-3 p-3 bg-muted/50">
                      <Checkbox
                        checked={
                          bulkContactsQuery.data.data.length > 0 &&
                          bulkContactsQuery.data.data.every((c: any) =>
                            bulkSelectedContacts.some((sc) => sc.id === c.id)
                          )
                        }
                        onCheckedChange={(checked) => {
                          if (checked) {
                            const newContacts = bulkContactsQuery.data!.data
                              .filter((c: any) => !bulkSelectedContacts.some((sc) => sc.id === c.id))
                              .map((c: any) => ({
                                id: c.id,
                                name: `${c.firstName} ${c.lastName}`.trim(),
                                email: c.email,
                              }));
                            setBulkSelectedContacts((prev) => [...prev, ...newContacts]);
                          } else {
                            const pageIds = new Set(bulkContactsQuery.data!.data.map((c: any) => c.id));
                            setBulkSelectedContacts((prev) => prev.filter((c) => !pageIds.has(c.id)));
                          }
                        }}
                      />
                      <span className="text-sm font-medium">Select all on this page</span>
                    </div>
                    {bulkContactsQuery.data.data.map((c: any) => {
                      const isSelected = bulkSelectedContacts.some((sc) => sc.id === c.id);
                      const contactName = `${c.firstName} ${c.lastName}`.trim();
                      return (
                        <div
                          key={c.id}
                          className={`flex items-center gap-3 p-3 cursor-pointer hover:bg-muted/50 transition-colors ${
                            isSelected ? "bg-primary/5" : ""
                          }`}
                          onClick={() => toggleBulkContact({ id: c.id, name: contactName, email: c.email })}
                        >
                          <Checkbox checked={isSelected} />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-sm">{contactName}</span>
                              {!c.email && <Badge variant="outline" className="text-xs text-amber-600">No email</Badge>}
                            </div>
                            <div className="flex items-center gap-3 text-xs text-muted-foreground">
                              {c.email && <span>{c.email}</span>}
                              {c.company && <span>· {c.company}</span>}
                              {c.title && <span>· {c.title}</span>}
                            </div>
                          </div>
                          {isSelected && <Check className="h-4 w-4 text-primary" />}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                    <Users className="h-8 w-8 mb-2" />
                    <p className="text-sm">{bulkContactSearch.length < 2 ? "Type to search contacts" : "No contacts found"}</p>
                  </div>
                )}
              </ScrollArea>
            </div>
          )}

          {/* Step 2: Email Configuration */}
          {bulkStep === 2 && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Template Type</Label>
                  <Select value={bulkTemplateType} onValueChange={setBulkTemplateType}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {EMAIL_TEMPLATE_OPTIONS.map((t) => (
                        <SelectItem key={t.value} value={t.value}>
                          <div className="flex flex-col">
                            <span>{t.label}</span>
                            <span className="text-xs text-muted-foreground">{t.desc}</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Tone</Label>
                  <Select value={bulkTone} onValueChange={setBulkTone}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {EMAIL_TONE_OPTIONS.map((t) => (
                        <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Topic / Subject</Label>
                <Input
                  placeholder="e.g., New rate drop announcement, Q2 market update..."
                  value={bulkTopic}
                  onChange={(e) => setBulkTopic(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label>AI Model</Label>
                <Select value={bulkAiModel} onValueChange={setBulkAiModel}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="gemini-2.5-flash">
                      <div className="flex flex-col"><span>Gemini 2.5 Flash</span><span className="text-xs text-muted-foreground">⚡ Fast · Lowest Cost</span></div>
                    </SelectItem>
                    <SelectItem value="gemini-2.5-pro">
                      <div className="flex flex-col"><span>Gemini 2.5 Pro</span><span className="text-xs text-muted-foreground">✨ Best Quality · High Cost</span></div>
                    </SelectItem>
                    <SelectItem value="gpt-4o">
                      <div className="flex flex-col"><span>GPT-4o</span><span className="text-xs text-muted-foreground">⚖️ Balanced · Medium Cost</span></div>
                    </SelectItem>
                    <SelectItem value="gpt-4o-mini">
                      <div className="flex flex-col"><span>GPT-4o Mini</span><span className="text-xs text-muted-foreground">⚡ Fast · Low Cost</span></div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Custom Instructions (optional)</Label>
                <Textarea
                  placeholder="Any specific instructions for the AI..."
                  value={bulkCustomInstructions}
                  onChange={(e) => setBulkCustomInstructions(e.target.value)}
                  rows={3}
                />
              </div>

              <div className="flex items-center gap-3">
                <Switch checked={bulkIncludeHistory} onCheckedChange={setBulkIncludeHistory} />
                <Label>Include conversation history for personalization</Label>
              </div>

              <div className="rounded-lg bg-muted/50 p-3">
                <p className="text-sm text-muted-foreground">
                  <strong>{bulkSelectedContacts.length}</strong> contacts selected.
                  {bulkSelectedContacts.filter((c) => !c.email).length > 0 && (
                    <span className="text-amber-600 ml-1">
                      {bulkSelectedContacts.filter((c) => !c.email).length} without email (will generate but cannot send).
                    </span>
                  )}
                  Each contact will receive a personalized email.
                </p>
              </div>
            </div>
          )}

          {/* Step 3: Results & Preview */}
          {bulkStep === 3 && (
            <div className="space-y-4">
              {bulkGenerateMutation.isPending ? (
                <div className="space-y-4 py-8">
                  <div className="flex flex-col items-center gap-3">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    <p className="text-sm font-medium">Generating personalized emails...</p>
                    <p className="text-xs text-muted-foreground">
                      This may take a moment for {bulkSelectedContacts.length} contacts
                    </p>
                  </div>
                  <Progress value={undefined} className="w-full" />
                </div>
              ) : bulkResults.length > 0 ? (
                <>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Badge variant="secondary">
                        {bulkResults.filter((r) => !r.error).length} generated
                      </Badge>
                      {bulkResults.filter((r) => r.error).length > 0 && (
                        <Badge variant="destructive">
                          {bulkResults.filter((r) => r.error).length} failed
                        </Badge>
                      )}
                    </div>
                  </div>

                  <ScrollArea className="h-[400px]">
                    <div className="space-y-2">
                      {bulkResults.map((result, idx) => (
                        <div key={idx} className={`border rounded-lg overflow-hidden ${
                          result.error ? "border-destructive/30 bg-destructive/5" : "border-border"
                        }`}>
                          <div
                            className="flex items-center gap-3 p-3 cursor-pointer hover:bg-muted/50"
                            onClick={() => setBulkExpandedIdx(bulkExpandedIdx === idx ? null : idx)}
                          >
                            {result.error ? (
                              <XCircle className="h-4 w-4 text-destructive shrink-0" />
                            ) : (
                              <Check className="h-4 w-4 text-green-600 shrink-0" />
                            )}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="font-medium text-sm">{result.contactName}</span>
                                {result.contactEmail && (
                                  <span className="text-xs text-muted-foreground">{result.contactEmail}</span>
                                )}
                              </div>
                              {result.error ? (
                                <p className="text-xs text-destructive">{result.error}</p>
                              ) : (
                                <p className="text-xs text-muted-foreground truncate">{result.subject}</p>
                              )}
                            </div>
                            {bulkExpandedIdx === idx ? (
                              <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0" />
                            ) : (
                              <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
                            )}
                          </div>
                          {bulkExpandedIdx === idx && !result.error && (
                            <div className="border-t p-4 space-y-3">
                              <EmailPreview
                                subject={result.subject}
                                previewText={result.previewText || ""}
                                body={result.body}
                                senderName={user?.name || "You"}
                                senderEmail={user?.email || "you@company.com"}
                                recipientName={result.contactName}
                                recipientEmail={result.contactEmail || "recipient@email.com"}
                                showActions={true}
                                compact={true}
                              />
                              <div className="flex gap-2">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => localCopyToClipboard(result.body, "Email body")}
                                >
                                  <Copy className="h-3 w-3 mr-1" /> Copy
                                </Button>
                                {result.draftId && result.contactEmail && (
                                  <Button
                                    size="sm"
                                    onClick={() => {
                                      setSendConfirmDraftId(result.draftId!);
                                      setSendConfirmInfo({ name: result.contactName, email: result.contactEmail! });
                                    }}
                                  >
                                    <Send className="h-3 w-3 mr-1" /> Send
                                  </Button>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <p>Click "Generate All" to create personalized emails</p>
                </div>
              )}
            </div>
          )}

          <DialogFooter className="flex justify-between sm:justify-between">
            <div>
              {bulkStep > 1 && bulkStep < 3 && (
                <Button variant="ghost" onClick={() => setBulkStep((s) => (s - 1) as 1 | 2 | 3)}>
                  <ChevronLeft className="h-4 w-4 mr-1" /> Back
                </Button>
              )}
              {bulkStep === 3 && !bulkGenerateMutation.isPending && bulkResults.length === 0 && (
                <Button variant="ghost" onClick={() => setBulkStep(2)}>
                  <ChevronLeft className="h-4 w-4 mr-1" /> Back
                </Button>
              )}
            </div>
            <div className="flex gap-2">
              {bulkStep === 1 && (
                <Button
                  onClick={() => setBulkStep(2)}
                  disabled={bulkSelectedContacts.length === 0}
                >
                  Next: Configure <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              )}
              {bulkStep === 2 && (
                <Button
                  onClick={() => { setBulkStep(3); handleBulkGenerate(); }}
                  disabled={!bulkTopic.trim() || bulkGenerateMutation.isPending}
                >
                  <Sparkles className="h-4 w-4 mr-1" /> Generate {bulkSelectedContacts.length} Emails
                </Button>
              )}
              {bulkStep === 3 && bulkResults.length > 0 && !bulkGenerateMutation.isPending && (
                <>
                  <Button
                    variant="outline"
                    onClick={() => { toast.success(`${bulkResults.filter((r) => r.draftId).length} drafts saved`); setBulkDialogOpen(false); resetBulkDialog(); }}
                  >
                    <Save className="h-4 w-4 mr-1" /> Close (Drafts Saved)
                  </Button>
                  <Button
                    onClick={handleBulkSendAll}
                    disabled={bulkSendMutation.isPending || bulkResults.filter((r) => !r.error && r.draftId && r.contactEmail).length === 0}
                  >
                    {bulkSendMutation.isPending ? (
                      <><Loader2 className="h-4 w-4 animate-spin mr-1" /> Sending...</>
                    ) : (
                      <><Send className="h-4 w-4 mr-1" /> Send All ({bulkResults.filter((r) => !r.error && r.draftId && r.contactEmail).length})</>
                    )}
                  </Button>
                </>
              )}
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk Send Confirmation */}
      <AlertDialog open={bulkSendConfirmOpen} onOpenChange={setBulkSendConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Send className="h-5 w-5 text-primary" />
              Confirm Bulk Send
            </AlertDialogTitle>
            <AlertDialogDescription>
              You are about to send <strong>{bulkResults.filter((r) => !r.error && r.draftId && r.contactEmail).length}</strong> personalized emails.
              This action cannot be undone. Each contact will receive their individually generated email.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmBulkSend} disabled={bulkSendMutation.isPending}>
              {bulkSendMutation.isPending ? (
                <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Sending...</>
              ) : (
                <><Send className="h-4 w-4 mr-2" /> Send All Emails</>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ─── Email Drafts Sub-Tab ───────────────────────────────────────────────
function EmailDraftsTab() {
  const { currentAccountId: accountId } = useAccount();
  const { user } = useAuth();
  const utils = trpc.useUtils();

  const [draftsPage, setDraftsPage] = useState(0);
  const [viewDraft, setViewDraft] = useState<any | null>(null);
  const [editDraft, setEditDraft] = useState<any | null>(null);
  const [editSubject, setEditSubject] = useState("");
  const [editBody, setEditBody] = useState("");
  const [sendConfirmDraftId, setSendConfirmDraftId] = useState<number | null>(null);
  const [sendConfirmInfo, setSendConfirmInfo] = useState<{ name: string; email: string } | null>(null);

  const draftsQuery = trpc.emailContent.getDrafts.useQuery(
    { accountId: accountId!, limit: 20, offset: draftsPage * 20 },
    { enabled: !!accountId }
  );

  const updateDraftMutation = trpc.emailContent.updateDraft.useMutation({
    onSuccess: () => {
      toast.success("Draft updated!");
      setEditDraft(null);
      utils.emailContent.getDrafts.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  const deleteDraftMutation = trpc.emailContent.deleteDraft.useMutation({
    onSuccess: () => {
      toast.success("Draft deleted");
      utils.emailContent.getDrafts.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  const sendEmailMutation = trpc.emailContent.sendEmail.useMutation({
    onSuccess: () => {
      toast.success("Email sent!");
      setSendConfirmDraftId(null);
      setSendConfirmInfo(null);
      utils.emailContent.getDrafts.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  const handleSendDraft = (draft: any) => {
    const contactName = draft.contactName || "Contact";
    setSendConfirmDraftId(draft.id);
    setSendConfirmInfo({ name: contactName, email: "(loaded from contact record)" });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <FileText className="h-5 w-5" />
          Saved Drafts
        </h3>
      </div>

      {draftsQuery.isLoading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : !draftsQuery.data?.drafts.length ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Mail className="h-10 w-10 mx-auto text-muted-foreground/40 mb-3" />
            <p className="text-muted-foreground">No drafts yet. Generate an email and save it as a draft.</p>
          </CardContent>
        </Card>
      ) : (
        <>
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Subject</TableHead>
                  <TableHead>Template</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {draftsQuery.data.drafts.map((draft) => (
                  <TableRow key={draft.id}>
                    <TableCell className="max-w-[200px] truncate font-medium">{draft.subject}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs capitalize">
                        {draft.templateType.replace("_", " ")}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm">
                      {draft.contactName || <span className="text-muted-foreground">—</span>}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {new Date(draft.createdAt).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      <Badge variant={draft.status === "sent" ? "default" : "secondary"} className={draft.status === "sent" ? "bg-green-600" : ""}>
                        {draft.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm"><MoreHorizontal className="h-4 w-4" /></Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => setViewDraft(draft)}>
                            <Eye className="h-4 w-4 mr-2" /> View
                          </DropdownMenuItem>
                          {draft.status !== "sent" && (
                            <DropdownMenuItem onClick={() => {
                              setEditDraft(draft);
                              setEditSubject(draft.subject);
                              setEditBody(draft.body);
                            }}>
                              <Edit className="h-4 w-4 mr-2" /> Edit
                            </DropdownMenuItem>
                          )}
                          {draft.status !== "sent" && draft.contactId && (
                            <DropdownMenuItem onClick={() => handleSendDraft(draft)}>
                              <Send className="h-4 w-4 mr-2" /> Send
                            </DropdownMenuItem>
                          )}
                          {draft.status !== "sent" && (
                            <DropdownMenuItem
                              className="text-destructive"
                              onClick={() => {
                                if (accountId) deleteDraftMutation.mutate({ accountId, id: draft.id });
                              }}
                            >
                              <Trash2 className="h-4 w-4 mr-2" /> Delete
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>

          {draftsQuery.data.total > 20 && (
            <div className="flex justify-center gap-2">
              <Button variant="outline" size="sm" disabled={draftsPage === 0} onClick={() => setDraftsPage((p) => p - 1)}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-sm text-muted-foreground flex items-center">
                Page {draftsPage + 1} of {Math.ceil(draftsQuery.data.total / 20)}
              </span>
              <Button variant="outline" size="sm" disabled={(draftsPage + 1) * 20 >= draftsQuery.data.total} onClick={() => setDraftsPage((p) => p + 1)}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          )}
        </>
      )}

      {/* View Draft Dialog */}
      <Dialog open={!!viewDraft} onOpenChange={(open) => { if (!open) setViewDraft(null); }}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              Email Draft Preview
              {viewDraft && (
                <div className="flex gap-2 ml-2">
                  <Badge variant="outline" className="capitalize font-normal">{viewDraft.templateType?.replace("_", " ")}</Badge>
                  <Badge variant={viewDraft.status === "sent" ? "default" : "secondary"} className={viewDraft.status === "sent" ? "bg-green-600 font-normal" : "font-normal"}>{viewDraft.status}</Badge>
                </div>
              )}
            </DialogTitle>
            <DialogDescription>Preview how this email appears in inbox</DialogDescription>
          </DialogHeader>
          {viewDraft && (
            <EmailPreview
              subject={viewDraft.subject}
              previewText={viewDraft.previewText || ""}
              body={viewDraft.body}
              senderName={user?.name || "You"}
              senderEmail={user?.email || "you@company.com"}
              recipientName={viewDraft.contactName || "Recipient"}
              recipientEmail="recipient@email.com"
              date={viewDraft.createdAt ? new Date(viewDraft.createdAt) : new Date()}
              showActions={true}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Edit Draft Dialog */}
      <Dialog open={!!editDraft} onOpenChange={(open) => { if (!open) setEditDraft(null); }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit Draft</DialogTitle>
            <DialogDescription>Update the email subject and body</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Subject</Label>
              <Input value={editSubject} onChange={(e) => setEditSubject(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Body (HTML)</Label>
              <Textarea value={editBody} onChange={(e) => setEditBody(e.target.value)} rows={10} className="font-mono text-sm" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDraft(null)}>Cancel</Button>
            <Button
              onClick={() => {
                if (accountId && editDraft) {
                  updateDraftMutation.mutate({
                    accountId,
                    id: editDraft.id,
                    subject: editSubject,
                    body: editBody,
                  });
                }
              }}
              disabled={updateDraftMutation.isPending}
            >
              {updateDraftMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Send Confirmation Dialog */}
      <AlertDialog open={sendConfirmDraftId !== null} onOpenChange={(open) => { if (!open) { setSendConfirmDraftId(null); setSendConfirmInfo(null); } }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Send className="h-5 w-5" /> Confirm Send
            </AlertDialogTitle>
            <AlertDialogDescription>
              {sendConfirmInfo && (
                <>Send this email to <strong>{sendConfirmInfo.name}</strong>? The email will be delivered via your configured email provider.</>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (accountId && sendConfirmDraftId) {
                  sendEmailMutation.mutate({ accountId, draftId: sendConfirmDraftId });
                }
              }}
            >
              {sendEmailMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Send className="h-4 w-4 mr-2" />}
              Send Email
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ─── Email Tab Wrapper with Sub-Tabs ─────────────────────────────────────────
function EmailTab() {
  return (
    <Tabs defaultValue="generator" className="space-y-6">
      <TabsList className="grid w-full grid-cols-3 lg:w-auto lg:inline-grid">
        <TabsTrigger value="generator" className="gap-1">
          <Sparkles className="h-4 w-4" />
          <span className="hidden sm:inline">Generator</span>
        </TabsTrigger>
        <TabsTrigger value="drafts" className="gap-1">
          <FileText className="h-4 w-4" />
          <span className="hidden sm:inline">Drafts</span>
        </TabsTrigger>
        <TabsTrigger value="signatures" className="gap-1">
          <PenLine className="h-4 w-4" />
          <span className="hidden sm:inline">Signatures</span>
        </TabsTrigger>
      </TabsList>

      <TabsContent value="generator">
        <EmailGeneratorTab />
      </TabsContent>
      <TabsContent value="drafts">
        <EmailDraftsTab />
      </TabsContent>
      <TabsContent value="signatures">
        <EmailSignaturesTab />
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
          Generate, manage, and repurpose all your content — blog articles, social media, and email — in one place.
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
          <TabsTrigger value="email" className="gap-2">
            <Mail className="h-4 w-4" />
            Email
          </TabsTrigger>
        </TabsList>

        <TabsContent value="blog-articles">
          <BlogArticlesTab />
        </TabsContent>

        <TabsContent value="social-media">
          <SocialMediaTab />
        </TabsContent>

        <TabsContent value="email">
          <EmailTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
