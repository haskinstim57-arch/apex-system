import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
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
import {
  MessageCircle,
  Plus,
  Copy,
  Trash2,
  Edit3,
  Code2,
  CheckCircle2,
  Loader2,
  Eye,
  EyeOff,
} from "lucide-react";
import { toast } from "sonner";

export function WebchatWidgetsCard({ accountId }: { accountId: number }) {
  const utils = trpc.useUtils();
  const widgetsList = trpc.webchat.listWidgets.useQuery({ accountId });

  const [showCreate, setShowCreate] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [showEmbed, setShowEmbed] = useState(false);
  const [showDelete, setShowDelete] = useState(false);
  const [selectedWidget, setSelectedWidget] = useState<any>(null);
  const [embedCode, setEmbedCode] = useState("");

  // Create form state
  const [name, setName] = useState("");
  const [greeting, setGreeting] = useState("Hi there! How can we help you today?");
  const [aiEnabled, setAiEnabled] = useState(true);
  const [aiSystemPrompt, setAiSystemPrompt] = useState("");
  const [handoffKeywords, setHandoffKeywords] = useState("agent,human,help,speak to someone,real person,representative");
  const [brandColor, setBrandColor] = useState("#6366f1");
  const [position, setPosition] = useState<"bottom-right" | "bottom-left">("bottom-right");
  const [allowedDomains, setAllowedDomains] = useState("");
  const [collectVisitorInfo, setCollectVisitorInfo] = useState(true);

  const createMutation = trpc.webchat.createWidget.useMutation({
    onSuccess: (data) => {
      toast.success("Widget created successfully!");
      utils.webchat.listWidgets.invalidate({ accountId });
      setShowCreate(false);
      resetForm();
      // Show embed code
      const origin = window.location.origin;
      setEmbedCode(`<script src="${origin}/api/webchat/widget.js?key=${data.widgetKey}"></script>`);
      setShowEmbed(true);
    },
    onError: (err) => toast.error(err.message || "Failed to create widget"),
  });

  const updateMutation = trpc.webchat.updateWidget.useMutation({
    onSuccess: () => {
      toast.success("Widget updated!");
      utils.webchat.listWidgets.invalidate({ accountId });
      setShowEdit(false);
    },
    onError: (err) => toast.error(err.message || "Failed to update widget"),
  });

  const deleteMutation = trpc.webchat.deleteWidget.useMutation({
    onSuccess: () => {
      toast.success("Widget deleted");
      utils.webchat.listWidgets.invalidate({ accountId });
      setShowDelete(false);
      setSelectedWidget(null);
    },
    onError: (err) => toast.error(err.message || "Failed to delete widget"),
  });

  function resetForm() {
    setName("");
    setGreeting("Hi there! How can we help you today?");
    setAiEnabled(true);
    setAiSystemPrompt("");
    setHandoffKeywords("agent,human,help,speak to someone,real person,representative");
    setBrandColor("#6366f1");
    setPosition("bottom-right");
    setAllowedDomains("");
    setCollectVisitorInfo(true);
  }

  function openEditDialog(widget: any) {
    setSelectedWidget(widget);
    setName(widget.name);
    setGreeting(widget.greeting || "");
    setAiEnabled(widget.aiEnabled);
    setAiSystemPrompt(widget.aiSystemPrompt || "");
    setHandoffKeywords(widget.handoffKeywords || "");
    setBrandColor(widget.brandColor || "#6366f1");
    setPosition(widget.position || "bottom-right");
    setAllowedDomains(widget.allowedDomains || "");
    setCollectVisitorInfo(widget.collectVisitorInfo);
    setShowEdit(true);
  }

  function showEmbedCode(widget: any) {
    const origin = window.location.origin;
    setEmbedCode(`<script src="${origin}/api/webchat/widget.js?key=${widget.widgetKey}"></script>`);
    setShowEmbed(true);
  }

  function copyToClipboard(text: string) {
    navigator.clipboard.writeText(text).then(() => {
      toast.success("Copied to clipboard!");
    });
  }

  const widgets = widgetsList.data || [];

  return (
    <>
      <Card className="bg-card border-0 card-shadow">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <MessageCircle className="h-4 w-4 text-indigo-500" />
                Webchat Widgets
              </CardTitle>
              <CardDescription className="text-xs mt-1">
                Embed an AI-powered chat widget on your website to capture leads and provide instant support.
              </CardDescription>
            </div>
            <Button size="sm" onClick={() => { resetForm(); setShowCreate(true); }}>
              <Plus className="h-3.5 w-3.5 mr-1" /> New Widget
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {widgetsList.isLoading ? (
            <div className="flex items-center justify-center py-8 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin mr-2" /> Loading...
            </div>
          ) : widgets.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <MessageCircle className="h-8 w-8 mx-auto mb-2 opacity-40" />
              <p className="text-sm">No webchat widgets yet.</p>
              <p className="text-xs mt-1">Create one to start capturing leads from your website.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {widgets.map((w: any) => (
                <div
                  key={w.id}
                  className="flex items-center gap-3 p-3 rounded-lg border border-border/50 hover:border-border transition-colors"
                >
                  <div
                    className="h-10 w-10 rounded-lg flex items-center justify-center shrink-0"
                    style={{ backgroundColor: (w.brandColor || "#6366f1") + "15" }}
                  >
                    <MessageCircle className="h-5 w-5" style={{ color: w.brandColor || "#6366f1" }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h4 className="text-sm font-medium truncate">{w.name}</h4>
                      <Badge variant={w.isActive ? "default" : "secondary"} className="text-[10px] px-1.5 py-0">
                        {w.isActive ? "Active" : "Inactive"}
                      </Badge>
                      {w.aiEnabled && (
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-indigo-600 border-indigo-200">
                          AI
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5 truncate">
                      {w.position === "bottom-left" ? "Bottom-left" : "Bottom-right"} &middot; Key: {w.widgetKey.substring(0, 8)}...
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      title="Get embed code"
                      onClick={() => showEmbedCode(w)}
                    >
                      <Code2 className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      title="Edit widget"
                      onClick={() => openEditDialog(w)}
                    >
                      <Edit3 className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive hover:text-destructive"
                      title="Delete widget"
                      onClick={() => { setSelectedWidget(w); setShowDelete(true); }}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ─── Create Widget Dialog ─── */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create Webchat Widget</DialogTitle>
            <DialogDescription>
              Configure your AI chat widget for embedding on external websites.
            </DialogDescription>
          </DialogHeader>
          <WidgetForm
            name={name} setName={setName}
            greeting={greeting} setGreeting={setGreeting}
            aiEnabled={aiEnabled} setAiEnabled={setAiEnabled}
            aiSystemPrompt={aiSystemPrompt} setAiSystemPrompt={setAiSystemPrompt}
            handoffKeywords={handoffKeywords} setHandoffKeywords={setHandoffKeywords}
            brandColor={brandColor} setBrandColor={setBrandColor}
            position={position} setPosition={setPosition}
            allowedDomains={allowedDomains} setAllowedDomains={setAllowedDomains}
            collectVisitorInfo={collectVisitorInfo} setCollectVisitorInfo={setCollectVisitorInfo}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
            <Button
              onClick={() => createMutation.mutate({
                accountId, name, greeting, aiEnabled, aiSystemPrompt: aiSystemPrompt || undefined,
                handoffKeywords, brandColor, position, allowedDomains: allowedDomains || undefined,
                collectVisitorInfo,
              })}
              disabled={!name.trim() || createMutation.isPending}
            >
              {createMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
              Create Widget
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Edit Widget Dialog ─── */}
      <Dialog open={showEdit} onOpenChange={setShowEdit}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Widget</DialogTitle>
            <DialogDescription>Update your webchat widget configuration.</DialogDescription>
          </DialogHeader>
          <WidgetForm
            name={name} setName={setName}
            greeting={greeting} setGreeting={setGreeting}
            aiEnabled={aiEnabled} setAiEnabled={setAiEnabled}
            aiSystemPrompt={aiSystemPrompt} setAiSystemPrompt={setAiSystemPrompt}
            handoffKeywords={handoffKeywords} setHandoffKeywords={setHandoffKeywords}
            brandColor={brandColor} setBrandColor={setBrandColor}
            position={position} setPosition={setPosition}
            allowedDomains={allowedDomains} setAllowedDomains={setAllowedDomains}
            collectVisitorInfo={collectVisitorInfo} setCollectVisitorInfo={setCollectVisitorInfo}
          />
          <div className="flex items-center gap-2 pt-2 border-t">
            <Label className="text-sm">Widget Active</Label>
            <Switch
              checked={selectedWidget?.isActive ?? true}
              onCheckedChange={(checked) => {
                if (selectedWidget) {
                  updateMutation.mutate({
                    accountId, widgetId: selectedWidget.id, isActive: checked,
                  });
                }
              }}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEdit(false)}>Cancel</Button>
            <Button
              onClick={() => {
                if (!selectedWidget) return;
                updateMutation.mutate({
                  accountId, widgetId: selectedWidget.id,
                  name, greeting, aiEnabled, aiSystemPrompt: aiSystemPrompt || undefined,
                  handoffKeywords, brandColor, position, allowedDomains: allowedDomains || undefined,
                  collectVisitorInfo,
                });
              }}
              disabled={!name.trim() || updateMutation.isPending}
            >
              {updateMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Embed Code Dialog ─── */}
      <Dialog open={showEmbed} onOpenChange={setShowEmbed}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Code2 className="h-5 w-5 text-indigo-500" />
              Embed Code
            </DialogTitle>
            <DialogDescription>
              Copy this script tag and paste it into your website's HTML, just before the closing &lt;/body&gt; tag.
            </DialogDescription>
          </DialogHeader>
          <div className="relative">
            <pre className="bg-muted rounded-lg p-4 text-xs font-mono overflow-x-auto whitespace-pre-wrap break-all">
              {embedCode}
            </pre>
            <Button
              variant="outline"
              size="sm"
              className="absolute top-2 right-2"
              onClick={() => copyToClipboard(embedCode)}
            >
              <Copy className="h-3.5 w-3.5 mr-1" /> Copy
            </Button>
          </div>
          <div className="bg-indigo-50 rounded-lg p-3 text-xs text-indigo-700 space-y-1">
            <p className="font-medium">How it works:</p>
            <ul className="list-disc pl-4 space-y-0.5">
              <li>The widget appears as a floating chat bubble on your website</li>
              <li>Visitors can chat with your AI assistant in real-time</li>
              <li>New visitors are automatically created as contacts in your CRM</li>
              <li>When a visitor asks for a human agent, you'll see it in your Inbox</li>
              <li>All conversations are logged and trigger your configured workflows</li>
            </ul>
          </div>
          <DialogFooter>
            <Button onClick={() => setShowEmbed(false)}>Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Delete Confirmation ─── */}
      <AlertDialog open={showDelete} onOpenChange={setShowDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Widget</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{selectedWidget?.name}"? The widget will stop working on any website where it's embedded.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (selectedWidget) {
                  deleteMutation.mutate({ accountId, widgetId: selectedWidget.id });
                }
              }}
            >
              {deleteMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

// ─── Shared Widget Form Fields ───
function WidgetForm({
  name, setName,
  greeting, setGreeting,
  aiEnabled, setAiEnabled,
  aiSystemPrompt, setAiSystemPrompt,
  handoffKeywords, setHandoffKeywords,
  brandColor, setBrandColor,
  position, setPosition,
  allowedDomains, setAllowedDomains,
  collectVisitorInfo, setCollectVisitorInfo,
}: {
  name: string; setName: (v: string) => void;
  greeting: string; setGreeting: (v: string) => void;
  aiEnabled: boolean; setAiEnabled: (v: boolean) => void;
  aiSystemPrompt: string; setAiSystemPrompt: (v: string) => void;
  handoffKeywords: string; setHandoffKeywords: (v: string) => void;
  brandColor: string; setBrandColor: (v: string) => void;
  position: "bottom-right" | "bottom-left"; setPosition: (v: "bottom-right" | "bottom-left") => void;
  allowedDomains: string; setAllowedDomains: (v: string) => void;
  collectVisitorInfo: boolean; setCollectVisitorInfo: (v: boolean) => void;
}) {
  return (
    <div className="space-y-4">
      <div>
        <Label className="text-sm">Widget Name *</Label>
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g., Main Website Chat"
          className="mt-1"
        />
      </div>

      <div>
        <Label className="text-sm">Greeting Message</Label>
        <Textarea
          value={greeting}
          onChange={(e) => setGreeting(e.target.value)}
          placeholder="Hi there! How can we help you today?"
          className="mt-1"
          rows={2}
        />
      </div>

      <div className="flex items-center justify-between">
        <div>
          <Label className="text-sm">AI Auto-Responses</Label>
          <p className="text-xs text-muted-foreground">Let AI respond to visitor messages automatically</p>
        </div>
        <Switch checked={aiEnabled} onCheckedChange={setAiEnabled} />
      </div>

      {aiEnabled && (
        <div>
          <Label className="text-sm">AI System Prompt (optional)</Label>
          <Textarea
            value={aiSystemPrompt}
            onChange={(e) => setAiSystemPrompt(e.target.value)}
            placeholder="You are a helpful mortgage assistant..."
            className="mt-1"
            rows={3}
          />
          <p className="text-xs text-muted-foreground mt-1">
            Customize how the AI responds. Leave blank for default behavior.
          </p>
        </div>
      )}

      <div>
        <Label className="text-sm">Human Handoff Keywords</Label>
        <Input
          value={handoffKeywords}
          onChange={(e) => setHandoffKeywords(e.target.value)}
          placeholder="agent,human,help,speak to someone"
          className="mt-1"
        />
        <p className="text-xs text-muted-foreground mt-1">
          Comma-separated words that trigger human agent notification.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label className="text-sm">Brand Color</Label>
          <div className="flex items-center gap-2 mt-1">
            <input
              type="color"
              value={brandColor}
              onChange={(e) => setBrandColor(e.target.value)}
              className="h-9 w-12 rounded border cursor-pointer"
            />
            <Input
              value={brandColor}
              onChange={(e) => setBrandColor(e.target.value)}
              className="flex-1"
              maxLength={20}
            />
          </div>
        </div>
        <div>
          <Label className="text-sm">Position</Label>
          <Select value={position} onValueChange={(v) => setPosition(v as any)}>
            <SelectTrigger className="mt-1">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="bottom-right">Bottom Right</SelectItem>
              <SelectItem value="bottom-left">Bottom Left</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <div>
          <Label className="text-sm">Collect Visitor Info</Label>
          <p className="text-xs text-muted-foreground">Ask for name and email before chat starts</p>
        </div>
        <Switch checked={collectVisitorInfo} onCheckedChange={setCollectVisitorInfo} />
      </div>

      <div>
        <Label className="text-sm">Allowed Domains (optional)</Label>
        <Input
          value={allowedDomains}
          onChange={(e) => setAllowedDomains(e.target.value)}
          placeholder="example.com, mysite.com"
          className="mt-1"
        />
        <p className="text-xs text-muted-foreground mt-1">
          Comma-separated domains. Leave empty to allow all domains.
        </p>
      </div>
    </div>
  );
}
