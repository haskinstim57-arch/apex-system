import { useState, useCallback } from "react";
import { trpc } from "@/lib/trpc";
import { useAccount } from "@/contexts/AccountContext";
import { toast } from "sonner";
import { useLocation, useParams } from "wouter";
import { Streamdown } from "streamdown";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Separator } from "@/components/ui/separator";
import {
  ArrowLeft,
  Eye,
  Edit,
  Save,
  Loader2,
  Download,
  Recycle,
  Clock,
  Hash,
  Globe,
  Type,
  Timer,
  CheckCircle,
  FileText,
  Mail,
  MessageSquare,
  Video,
  Image as ImageIcon,
  Clipboard,
  ExternalLink,
  Trash2,
} from "lucide-react";

const FORMAT_LABELS: Record<string, { label: string; icon: React.ReactNode }> = {
  "social-snippet": { label: "Social Snippet", icon: <MessageSquare className="h-4 w-4" /> },
  "email-summary": { label: "Email Summary", icon: <Mail className="h-4 w-4" /> },
  "short-form": { label: "Short-Form Article", icon: <FileText className="h-4 w-4" /> },
  "infographic-script": { label: "Infographic Script", icon: <ImageIcon className="h-4 w-4" /> },
  "video-script": { label: "Video Script", icon: <Video className="h-4 w-4" /> },
};

export default function ContentDetail() {
  const { currentAccount } = useAccount();
  const accountId = currentAccount?.id;
  const params = useParams<{ id: string }>();
  const contentId = Number(params.id);
  const [, navigate] = useLocation();

  // ─── State ──────────────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState("preview");
  const [editTitle, setEditTitle] = useState("");
  const [editContent, setEditContent] = useState("");
  const [isEditing, setIsEditing] = useState(false);

  // Repurpose dialog
  const [showRepurpose, setShowRepurpose] = useState(false);
  const [repurposeFormat, setRepurposeFormat] = useState<string>("social-snippet");
  const [repurposePlatform, setRepurposePlatform] = useState<string>("");

  // ─── Queries ────────────────────────────────────────────────────────────
  const contentQuery = trpc.longFormContent.getById.useQuery(
    { accountId: accountId!, id: contentId },
    {
      enabled: !!accountId && !!contentId,
      onSuccess: (data) => {
        if (!isEditing) {
          setEditTitle(data.title);
          setEditContent(data.content);
        }
      },
    }
  );

  const utils = trpc.useUtils();

  // ─── Mutations ──────────────────────────────────────────────────────────
  const updateMutation = trpc.longFormContent.update.useMutation({
    onSuccess: () => {
      toast.success("Content saved");
      setIsEditing(false);
      utils.longFormContent.getById.invalidate({ accountId: accountId!, id: contentId });
    },
    onError: (err) => toast.error(err.message),
  });

  const deleteMutation = trpc.longFormContent.delete.useMutation({
    onSuccess: () => {
      toast.success("Content deleted");
      navigate("/content-hub");
    },
    onError: (err) => toast.error(err.message),
  });

  const repurposeMutation = trpc.longFormContent.repurpose.useMutation({
    onSuccess: (data) => {
      toast.success(`${FORMAT_LABELS[data.format]?.label || data.format} generated`);
      setShowRepurpose(false);
      utils.longFormContent.getById.invalidate({ accountId: accountId!, id: contentId });
    },
    onError: (err) => toast.error(err.message),
  });

  // ─── Handlers ───────────────────────────────────────────────────────────
  function handleSave() {
    if (!accountId) return;
    updateMutation.mutate({
      accountId,
      id: contentId,
      title: editTitle,
      content: editContent,
    });
  }

  function handlePublish() {
    if (!accountId) return;
    updateMutation.mutate({
      accountId,
      id: contentId,
      status: "published",
    });
  }

  function handleUnpublish() {
    if (!accountId) return;
    updateMutation.mutate({
      accountId,
      id: contentId,
      status: "draft",
    });
  }

  function handleDelete() {
    if (!accountId) return;
    if (confirm("Are you sure you want to delete this article?")) {
      deleteMutation.mutate({ accountId, id: contentId });
    }
  }

  function handleRepurpose() {
    if (!accountId) return;
    repurposeMutation.mutate({
      accountId,
      contentId,
      format: repurposeFormat as any,
      platform: repurposePlatform || undefined,
    });
  }

  const handleExport = useCallback(
    (format: "markdown" | "html" | "text") => {
      const data = contentQuery.data;
      if (!data) return;

      let content: string;
      let filename: string;
      let mimeType: string;

      switch (format) {
        case "markdown":
          content = `# ${data.title}\n\n${data.content}`;
          filename = `${data.title.replace(/[^a-z0-9]/gi, "-").toLowerCase()}.md`;
          mimeType = "text/markdown";
          break;
        case "html":
          content = `<!DOCTYPE html>
<html>
<head><title>${data.title}</title></head>
<body>
<h1>${data.title}</h1>
${data.content
  .replace(/^### (.*$)/gm, "<h3>$1</h3>")
  .replace(/^## (.*$)/gm, "<h2>$1</h2>")
  .replace(/^# (.*$)/gm, "<h1>$1</h1>")
  .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
  .replace(/\*(.*?)\*/g, "<em>$1</em>")
  .replace(/\n\n/g, "</p><p>")
  .replace(/^/, "<p>")
  .replace(/$/, "</p>")}
</body>
</html>`;
          filename = `${data.title.replace(/[^a-z0-9]/gi, "-").toLowerCase()}.html`;
          mimeType = "text/html";
          break;
        case "text":
          content = `${data.title}\n${"=".repeat(data.title.length)}\n\n${data.content.replace(/[#*_`~\[\]()>|]/g, "")}`;
          filename = `${data.title.replace(/[^a-z0-9]/gi, "-").toLowerCase()}.txt`;
          mimeType = "text/plain";
          break;
      }

      const blob = new Blob([content], { type: mimeType });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(`Exported as ${format.toUpperCase()}`);
    },
    [contentQuery.data]
  );

  function copyToClipboard(text: string) {
    navigator.clipboard.writeText(text).then(() => {
      toast.success("Copied to clipboard");
    });
  }

  // ─── Loading / Error ────────────────────────────────────────────────────
  if (!accountId) {
    return (
      <div className="p-6 text-center text-muted-foreground">
        Select a sub-account to view content.
      </div>
    );
  }

  if (contentQuery.isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!contentQuery.data) {
    return (
      <div className="p-6 text-center">
        <p className="text-muted-foreground">Content not found</p>
        <Button variant="outline" className="mt-4" onClick={() => navigate("/content-hub")}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Content Hub
        </Button>
      </div>
    );
  }

  const data = contentQuery.data;
  const repurposed = data.repurposed || [];

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto">
      {/* Back + Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-3 min-w-0">
          <Button variant="ghost" size="icon" onClick={() => navigate("/content-hub")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="min-w-0">
            <h1 className="text-xl font-bold truncate max-w-[400px]">{data.title}</h1>
            <div className="flex items-center gap-2 mt-1">
              <Badge variant={data.status === "published" ? "default" : "secondary"}>
                {data.status === "published" ? (
                  <CheckCircle className="h-3 w-3 mr-1" />
                ) : (
                  <Clock className="h-3 w-3 mr-1" />
                )}
                {data.status}
              </Badge>
              <span className="text-xs text-muted-foreground">
                {new Date(data.createdAt).toLocaleDateString()}
              </span>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 w-full sm:w-auto">
          {data.status === "draft" ? (
            <Button size="sm" onClick={handlePublish} disabled={updateMutation.isPending}>
              <CheckCircle className="h-4 w-4 mr-1" />
              Publish
            </Button>
          ) : (
            <Button
              variant="outline"
              size="sm"
              onClick={handleUnpublish}
              disabled={updateMutation.isPending}
            >
              <Clock className="h-4 w-4 mr-1" />
              Unpublish
            </Button>
          )}

          <Button variant="outline" size="sm" onClick={() => setShowRepurpose(true)}>
            <Recycle className="h-4 w-4 mr-1" />
            Repurpose
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                <Download className="h-4 w-4 mr-1" />
                Export
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem onClick={() => handleExport("markdown")}>
                Markdown (.md)
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleExport("html")}>
                HTML (.html)
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleExport("text")}>
                Plain Text (.txt)
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <Button variant="destructive" size="sm" onClick={handleDelete}>
            <Trash2 className="h-4 w-4 mr-1" />
            Delete
          </Button>
        </div>
      </div>

      {/* Main content area */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-6">
        {/* Content tabs */}
        <div>
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="mb-4">
              <TabsTrigger value="preview" className="flex items-center gap-1">
                <Eye className="h-4 w-4" />
                Preview
              </TabsTrigger>
              <TabsTrigger value="edit" className="flex items-center gap-1">
                <Edit className="h-4 w-4" />
                Edit
              </TabsTrigger>
              {repurposed.length > 0 && (
                <TabsTrigger value="repurposed" className="flex items-center gap-1">
                  <Recycle className="h-4 w-4" />
                  Repurposed ({repurposed.length})
                </TabsTrigger>
              )}
            </TabsList>

            {/* Preview Tab (DEFAULT) */}
            <TabsContent value="preview">
              <Card>
                <CardContent className="pt-6">
                  {data.imageUrl && (
                    <img
                      src={data.imageUrl}
                      alt={data.title}
                      className="w-full max-h-[400px] object-cover rounded-lg mb-6"
                    />
                  )}
                  <article className="prose prose-sm sm:prose dark:prose-invert max-w-none">
                    <Streamdown>{data.content}</Streamdown>
                  </article>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Edit Tab */}
            <TabsContent value="edit">
              <Card>
                <CardContent className="pt-6 space-y-4">
                  <div>
                    <Label>Title</Label>
                    <Input
                      value={editTitle}
                      onChange={(e) => {
                        setEditTitle(e.target.value);
                        setIsEditing(true);
                      }}
                    />
                  </div>
                  <div>
                    <Label>Content (Markdown)</Label>
                    <Textarea
                      value={editContent}
                      onChange={(e) => {
                        setEditContent(e.target.value);
                        setIsEditing(true);
                      }}
                      rows={25}
                      className="font-mono text-sm"
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button onClick={handleSave} disabled={updateMutation.isPending || !isEditing}>
                      {updateMutation.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      ) : (
                        <Save className="h-4 w-4 mr-2" />
                      )}
                      Save Changes
                    </Button>
                    {isEditing && (
                      <Button
                        variant="outline"
                        onClick={() => {
                          setEditTitle(data.title);
                          setEditContent(data.content);
                          setIsEditing(false);
                        }}
                      >
                        Cancel
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Repurposed Tab */}
            <TabsContent value="repurposed">
              <div className="space-y-4">
                {repurposed.map((rp) => {
                  const fmt = FORMAT_LABELS[rp.format] || {
                    label: rp.format,
                    icon: <FileText className="h-4 w-4" />,
                  };
                  return (
                    <Card key={rp.id}>
                      <CardHeader className="pb-2">
                        <div className="flex items-center justify-between">
                          <CardTitle className="text-sm flex items-center gap-2">
                            {fmt.icon}
                            {fmt.label}
                            {rp.platform && (
                              <Badge variant="outline" className="text-xs">
                                {rp.platform}
                              </Badge>
                            )}
                          </CardTitle>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => copyToClipboard(rp.content)}
                          >
                            <Clipboard className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="prose prose-sm dark:prose-invert max-w-none">
                          <Streamdown>{rp.content}</Streamdown>
                        </div>
                        <p className="text-xs text-muted-foreground mt-3">
                          Generated {new Date(rp.createdAt).toLocaleString()}
                        </p>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </TabsContent>
          </Tabs>
        </div>

        {/* Stats Sidebar */}
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Generation Stats</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-2 text-muted-foreground">
                  <Type className="h-4 w-4" />
                  Word Count
                </span>
                <span className="font-medium">
                  {data.wordCount?.toLocaleString() ?? "—"}
                </span>
              </div>
              <Separator />
              <div className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-2 text-muted-foreground">
                  <Timer className="h-4 w-4" />
                  Generation Time
                </span>
                <span className="font-medium">
                  {data.generationTimeMs
                    ? `${(data.generationTimeMs / 1000).toFixed(1)}s`
                    : "—"}
                </span>
              </div>
              <Separator />
              <div className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-2 text-muted-foreground">
                  <Globe className="h-4 w-4" />
                  URLs Fetched
                </span>
                <span className="font-medium">{data.urlsFetched ?? 0}</span>
              </div>
              <Separator />
              <div className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-2 text-muted-foreground">
                  <Hash className="h-4 w-4" />
                  Total Tokens
                </span>
                <span className="font-medium">
                  {data.totalTokens?.toLocaleString() ?? "—"}
                </span>
              </div>
              {data.inputTokens != null && data.outputTokens != null && (
                <>
                  <Separator />
                  <div className="text-xs text-muted-foreground space-y-1">
                    <div className="flex justify-between">
                      <span>Input tokens</span>
                      <span>{data.inputTokens.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Output tokens</span>
                      <span>{data.outputTokens.toLocaleString()}</span>
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {data.aiModel && (
            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">AI Model</span>
                  <Badge variant="outline" className="text-xs">
                    {data.aiModel}
                  </Badge>
                </div>
              </CardContent>
            </Card>
          )}

          {data.topic && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Topic</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">{data.topic}</p>
              </CardContent>
            </Card>
          )}

          {data.imagePrompt && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Image Prompt</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {data.imagePrompt}
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* ─── Repurpose Dialog ──────────────────────────────────────────── */}
      <Dialog open={showRepurpose} onOpenChange={setShowRepurpose}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Recycle className="h-5 w-5 text-primary" />
              Repurpose Content
            </DialogTitle>
            <DialogDescription>
              Transform this article into a different format for other channels.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label>Output Format</Label>
              <Select value={repurposeFormat} onValueChange={setRepurposeFormat}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(FORMAT_LABELS).map(([key, { label, icon }]) => (
                    <SelectItem key={key} value={key}>
                      <span className="flex items-center gap-2">
                        {icon}
                        {label}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {repurposeFormat === "social-snippet" && (
              <div>
                <Label>Platform (optional)</Label>
                <Select value={repurposePlatform} onValueChange={setRepurposePlatform}>
                  <SelectTrigger>
                    <SelectValue placeholder="Any platform" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="any">Any platform</SelectItem>
                    <SelectItem value="facebook">Facebook</SelectItem>
                    <SelectItem value="instagram">Instagram</SelectItem>
                    <SelectItem value="linkedin">LinkedIn</SelectItem>
                    <SelectItem value="twitter">Twitter/X</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRepurpose(false)}>
              Cancel
            </Button>
            <Button onClick={handleRepurpose} disabled={repurposeMutation.isPending}>
              {repurposeMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Generating...
                </>
              ) : (
                <>
                  <Recycle className="h-4 w-4 mr-2" />
                  Repurpose
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
