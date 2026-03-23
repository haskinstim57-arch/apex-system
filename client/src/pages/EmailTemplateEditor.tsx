import { useState, useEffect, useMemo, useCallback } from "react";
import { trpc } from "@/lib/trpc";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  ArrowLeft,
  Save,
  Plus,
  Trash2,
  ChevronUp,
  ChevronDown,
  Type,
  Heading,
  Image,
  MousePointerClick,
  Minus,
  AlignLeft,
  Eye,
  Pencil,
  Tag,
} from "lucide-react";
import { toast } from "sonner";

// ─────────────────────────────────────────────
// Block Types
// ─────────────────────────────────────────────

export interface HeaderBlock {
  type: "header";
  id: string;
  text: string;
  level: 1 | 2 | 3;
  align: "left" | "center" | "right";
  color: string;
}

export interface TextBlock {
  type: "text";
  id: string;
  content: string;
  align: "left" | "center" | "right";
  fontSize: number;
  color: string;
}

export interface ButtonBlock {
  type: "button";
  id: string;
  text: string;
  url: string;
  bgColor: string;
  textColor: string;
  align: "left" | "center" | "right";
  borderRadius: number;
}

export interface ImageBlock {
  type: "image";
  id: string;
  src: string;
  alt: string;
  width: string;
  align: "left" | "center" | "right";
}

export interface DividerBlock {
  type: "divider";
  id: string;
  color: string;
  thickness: number;
}

export interface FooterBlock {
  type: "footer";
  id: string;
  text: string;
  align: "left" | "center" | "right";
  color: string;
  fontSize: number;
}

export type EmailBlock =
  | HeaderBlock
  | TextBlock
  | ButtonBlock
  | ImageBlock
  | DividerBlock
  | FooterBlock;

// ─────────────────────────────────────────────
// Merge Tags
// ─────────────────────────────────────────────

const MERGE_TAGS = [
  { tag: "{{contact.firstName}}", label: "First Name" },
  { tag: "{{contact.lastName}}", label: "Last Name" },
  { tag: "{{contact.fullName}}", label: "Full Name" },
  { tag: "{{contact.email}}", label: "Email" },
  { tag: "{{contact.phone}}", label: "Phone" },
  { tag: "{{contact.company}}", label: "Company" },
];

// ─────────────────────────────────────────────
// Block Defaults
// ─────────────────────────────────────────────

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

function defaultBlock(type: EmailBlock["type"]): EmailBlock {
  switch (type) {
    case "header":
      return { type: "header", id: uid(), text: "Your Heading", level: 1, align: "center", color: "#ffffff" };
    case "text":
      return { type: "text", id: uid(), content: "Enter your text here...", align: "left", fontSize: 16, color: "#d4d4d4" };
    case "button":
      return { type: "button", id: uid(), text: "Click Here", url: "https://", bgColor: "#c8a45a", textColor: "#000000", align: "center", borderRadius: 6 };
    case "image":
      return { type: "image", id: uid(), src: "", alt: "Image", width: "100%", align: "center" };
    case "divider":
      return { type: "divider", id: uid(), color: "#333333", thickness: 1 };
    case "footer":
      return { type: "footer", id: uid(), text: "© 2026 Your Company. All rights reserved.", align: "center", color: "#888888", fontSize: 12 };
  }
}

// ─────────────────────────────────────────────
// HTML Renderer
// ─────────────────────────────────────────────

function blocksToHtml(blocks: EmailBlock[]): string {
  const bodyContent = blocks
    .map((block) => {
      switch (block.type) {
        case "header": {
          const tag = `h${block.level}`;
          const fontSize = block.level === 1 ? 28 : block.level === 2 ? 22 : 18;
          return `<${tag} style="margin:0;padding:16px 24px;text-align:${block.align};color:${block.color};font-size:${fontSize}px;font-weight:700;font-family:Arial,sans-serif;">${escapeHtml(block.text)}</${tag}>`;
        }
        case "text":
          return `<div style="padding:12px 24px;text-align:${block.align};color:${block.color};font-size:${block.fontSize}px;line-height:1.6;font-family:Arial,sans-serif;">${escapeHtml(block.content).replace(/\n/g, "<br>")}</div>`;
        case "button":
          return `<div style="padding:16px 24px;text-align:${block.align};"><a href="${escapeHtml(block.url)}" style="display:inline-block;padding:12px 28px;background-color:${block.bgColor};color:${block.textColor};text-decoration:none;border-radius:${block.borderRadius}px;font-size:16px;font-weight:600;font-family:Arial,sans-serif;">${escapeHtml(block.text)}</a></div>`;
        case "image":
          return block.src
            ? `<div style="padding:12px 24px;text-align:${block.align};"><img src="${escapeHtml(block.src)}" alt="${escapeHtml(block.alt)}" style="max-width:${block.width};height:auto;border:0;" /></div>`
            : `<div style="padding:12px 24px;text-align:${block.align};color:#666;font-style:italic;font-family:Arial,sans-serif;">[Image placeholder]</div>`;
        case "divider":
          return `<div style="padding:8px 24px;"><hr style="border:none;border-top:${block.thickness}px solid ${block.color};margin:0;" /></div>`;
        case "footer":
          return `<div style="padding:16px 24px;text-align:${block.align};color:${block.color};font-size:${block.fontSize}px;line-height:1.5;font-family:Arial,sans-serif;">${escapeHtml(block.text).replace(/\n/g, "<br>")}</div>`;
      }
    })
    .join("\n");

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background-color:#1a1a2e;font-family:Arial,sans-serif;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#1a1a2e;">
<tr><td align="center" style="padding:24px 16px;">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="background-color:#222240;border-radius:8px;overflow:hidden;max-width:600px;width:100%;">
<tr><td>
${bodyContent}
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    // Preserve merge tags — unescape them back
    .replace(/\{\{(contact\.\w+)\}\}/g, "{{$1}}");
}

// ─────────────────────────────────────────────
// Block Editor Component
// ─────────────────────────────────────────────

function BlockEditor({
  block,
  onChange,
  onDelete,
  onMoveUp,
  onMoveDown,
  isFirst,
  isLast,
}: {
  block: EmailBlock;
  onChange: (updated: EmailBlock) => void;
  onDelete: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  isFirst: boolean;
  isLast: boolean;
}) {
  const [expanded, setExpanded] = useState(false);

  const blockIcon = {
    header: <Heading className="h-4 w-4" />,
    text: <Type className="h-4 w-4" />,
    button: <MousePointerClick className="h-4 w-4" />,
    image: <Image className="h-4 w-4" />,
    divider: <Minus className="h-4 w-4" />,
    footer: <AlignLeft className="h-4 w-4" />,
  }[block.type];

  const blockLabel = {
    header: "Header",
    text: "Text",
    button: "Button",
    image: "Image",
    divider: "Divider",
    footer: "Footer",
  }[block.type];

  function insertMergeTag(tag: string) {
    if (block.type === "header") {
      onChange({ ...block, text: block.text + tag });
    } else if (block.type === "text") {
      onChange({ ...block, content: block.content + tag });
    } else if (block.type === "footer") {
      onChange({ ...block, text: block.text + tag });
    }
  }

  return (
    <Card className="border-border/50 group">
      <div
        className="flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-accent/30 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <span className="text-muted-foreground">{blockIcon}</span>
        <span className="text-sm font-medium flex-1">{blockLabel}</span>
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            disabled={isFirst}
            onClick={(e) => { e.stopPropagation(); onMoveUp(); }}
          >
            <ChevronUp className="h-3 w-3" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            disabled={isLast}
            onClick={(e) => { e.stopPropagation(); onMoveDown(); }}
          >
            <ChevronDown className="h-3 w-3" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 text-destructive hover:text-destructive"
            onClick={(e) => { e.stopPropagation(); onDelete(); }}
          >
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
      </div>

      {expanded && (
        <CardContent className="pt-0 pb-3 px-3 space-y-3">
          {/* Merge tag inserter for text-based blocks */}
          {(block.type === "header" || block.type === "text" || block.type === "footer") && (
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <Tag className="h-3 w-3" /> Merge tags:
              </span>
              {MERGE_TAGS.map((mt) => (
                <button
                  key={mt.tag}
                  type="button"
                  className="text-xs px-2 py-0.5 rounded bg-accent/50 hover:bg-accent text-accent-foreground transition-colors"
                  onClick={() => insertMergeTag(mt.tag)}
                >
                  {mt.label}
                </button>
              ))}
            </div>
          )}

          {block.type === "header" && (
            <>
              <div className="space-y-1">
                <Label className="text-xs">Heading Text</Label>
                <Input
                  value={block.text}
                  onChange={(e) => onChange({ ...block, text: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div className="space-y-1">
                  <Label className="text-xs">Level</Label>
                  <select
                    className="w-full h-9 rounded-md border border-input bg-background px-2 text-sm"
                    value={block.level}
                    onChange={(e) => onChange({ ...block, level: parseInt(e.target.value) as 1 | 2 | 3 })}
                  >
                    <option value={1}>H1</option>
                    <option value={2}>H2</option>
                    <option value={3}>H3</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Align</Label>
                  <select
                    className="w-full h-9 rounded-md border border-input bg-background px-2 text-sm"
                    value={block.align}
                    onChange={(e) => onChange({ ...block, align: e.target.value as "left" | "center" | "right" })}
                  >
                    <option value="left">Left</option>
                    <option value="center">Center</option>
                    <option value="right">Right</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Color</Label>
                  <input
                    type="color"
                    className="w-full h-9 rounded-md border border-input bg-background cursor-pointer"
                    value={block.color}
                    onChange={(e) => onChange({ ...block, color: e.target.value })}
                  />
                </div>
              </div>
            </>
          )}

          {block.type === "text" && (
            <>
              <div className="space-y-1">
                <Label className="text-xs">Content</Label>
                <textarea
                  className="w-full min-h-[80px] rounded-md border border-input bg-background px-3 py-2 text-sm resize-y"
                  value={block.content}
                  onChange={(e) => onChange({ ...block, content: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div className="space-y-1">
                  <Label className="text-xs">Font Size</Label>
                  <Input
                    type="number"
                    min={10}
                    max={32}
                    value={block.fontSize}
                    onChange={(e) => onChange({ ...block, fontSize: parseInt(e.target.value) || 16 })}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Align</Label>
                  <select
                    className="w-full h-9 rounded-md border border-input bg-background px-2 text-sm"
                    value={block.align}
                    onChange={(e) => onChange({ ...block, align: e.target.value as "left" | "center" | "right" })}
                  >
                    <option value="left">Left</option>
                    <option value="center">Center</option>
                    <option value="right">Right</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Color</Label>
                  <input
                    type="color"
                    className="w-full h-9 rounded-md border border-input bg-background cursor-pointer"
                    value={block.color}
                    onChange={(e) => onChange({ ...block, color: e.target.value })}
                  />
                </div>
              </div>
            </>
          )}

          {block.type === "button" && (
            <>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label className="text-xs">Button Text</Label>
                  <Input
                    value={block.text}
                    onChange={(e) => onChange({ ...block, text: e.target.value })}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">URL</Label>
                  <Input
                    value={block.url}
                    onChange={(e) => onChange({ ...block, url: e.target.value })}
                    placeholder="https://..."
                  />
                </div>
              </div>
              <div className="grid grid-cols-4 gap-2">
                <div className="space-y-1">
                  <Label className="text-xs">BG Color</Label>
                  <input
                    type="color"
                    className="w-full h-9 rounded-md border border-input bg-background cursor-pointer"
                    value={block.bgColor}
                    onChange={(e) => onChange({ ...block, bgColor: e.target.value })}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Text Color</Label>
                  <input
                    type="color"
                    className="w-full h-9 rounded-md border border-input bg-background cursor-pointer"
                    value={block.textColor}
                    onChange={(e) => onChange({ ...block, textColor: e.target.value })}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Align</Label>
                  <select
                    className="w-full h-9 rounded-md border border-input bg-background px-2 text-sm"
                    value={block.align}
                    onChange={(e) => onChange({ ...block, align: e.target.value as "left" | "center" | "right" })}
                  >
                    <option value="left">Left</option>
                    <option value="center">Center</option>
                    <option value="right">Right</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Radius</Label>
                  <Input
                    type="number"
                    min={0}
                    max={50}
                    value={block.borderRadius}
                    onChange={(e) => onChange({ ...block, borderRadius: parseInt(e.target.value) || 0 })}
                  />
                </div>
              </div>
            </>
          )}

          {block.type === "image" && (
            <>
              <div className="space-y-1">
                <Label className="text-xs">Image URL</Label>
                <Input
                  value={block.src}
                  onChange={(e) => onChange({ ...block, src: e.target.value })}
                  placeholder="https://example.com/image.png"
                />
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div className="space-y-1">
                  <Label className="text-xs">Alt Text</Label>
                  <Input
                    value={block.alt}
                    onChange={(e) => onChange({ ...block, alt: e.target.value })}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Width</Label>
                  <Input
                    value={block.width}
                    onChange={(e) => onChange({ ...block, width: e.target.value })}
                    placeholder="100% or 400px"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Align</Label>
                  <select
                    className="w-full h-9 rounded-md border border-input bg-background px-2 text-sm"
                    value={block.align}
                    onChange={(e) => onChange({ ...block, align: e.target.value as "left" | "center" | "right" })}
                  >
                    <option value="left">Left</option>
                    <option value="center">Center</option>
                    <option value="right">Right</option>
                  </select>
                </div>
              </div>
            </>
          )}

          {block.type === "divider" && (
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-xs">Color</Label>
                <input
                  type="color"
                  className="w-full h-9 rounded-md border border-input bg-background cursor-pointer"
                  value={block.color}
                  onChange={(e) => onChange({ ...block, color: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Thickness</Label>
                <Input
                  type="number"
                  min={1}
                  max={5}
                  value={block.thickness}
                  onChange={(e) => onChange({ ...block, thickness: parseInt(e.target.value) || 1 })}
                />
              </div>
            </div>
          )}

          {block.type === "footer" && (
            <>
              <div className="space-y-1">
                <Label className="text-xs">Footer Text</Label>
                <textarea
                  className="w-full min-h-[60px] rounded-md border border-input bg-background px-3 py-2 text-sm resize-y"
                  value={block.text}
                  onChange={(e) => onChange({ ...block, text: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div className="space-y-1">
                  <Label className="text-xs">Font Size</Label>
                  <Input
                    type="number"
                    min={8}
                    max={18}
                    value={block.fontSize}
                    onChange={(e) => onChange({ ...block, fontSize: parseInt(e.target.value) || 12 })}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Align</Label>
                  <select
                    className="w-full h-9 rounded-md border border-input bg-background px-2 text-sm"
                    value={block.align}
                    onChange={(e) => onChange({ ...block, align: e.target.value as "left" | "center" | "right" })}
                  >
                    <option value="left">Left</option>
                    <option value="center">Center</option>
                    <option value="right">Right</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Color</Label>
                  <input
                    type="color"
                    className="w-full h-9 rounded-md border border-input bg-background cursor-pointer"
                    value={block.color}
                    onChange={(e) => onChange({ ...block, color: e.target.value })}
                  />
                </div>
              </div>
            </>
          )}
        </CardContent>
      )}
    </Card>
  );
}

// ─────────────────────────────────────────────
// Main Editor Page
// ─────────────────────────────────────────────

export default function EmailTemplateEditor({ id }: { id: number }) {
  const [, navigate] = useLocation();
  const [name, setName] = useState("");
  const [subject, setSubject] = useState("");
  const [blocks, setBlocks] = useState<EmailBlock[]>([]);
  const [showPreview, setShowPreview] = useState(true);
  const [hasChanges, setHasChanges] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const { data: template, isLoading } = trpc.emailTemplates.get.useQuery(
    { id },
    { enabled: !!id }
  );

  const updateMutation = trpc.emailTemplates.update.useMutation({
    onSuccess: () => {
      toast.success("Template saved");
      setHasChanges(false);
    },
    onError: (err) => toast.error(err.message),
  });

  // Load template data
  useEffect(() => {
    if (template && !loaded) {
      setName(template.name);
      setSubject(template.subject || "");
      if (template.jsonBlocks) {
        try {
          const parsed = typeof template.jsonBlocks === "string"
            ? JSON.parse(template.jsonBlocks)
            : template.jsonBlocks;
          if (Array.isArray(parsed) && parsed.length > 0) {
            setBlocks(parsed);
          } else {
            // Default starter blocks
            setBlocks([
              defaultBlock("header"),
              defaultBlock("text"),
              defaultBlock("button"),
              defaultBlock("footer"),
            ]);
          }
        } catch {
          setBlocks([
            defaultBlock("header"),
            defaultBlock("text"),
            defaultBlock("button"),
            defaultBlock("footer"),
          ]);
        }
      } else {
        setBlocks([
          defaultBlock("header"),
          defaultBlock("text"),
          defaultBlock("button"),
          defaultBlock("footer"),
        ]);
      }
      setLoaded(true);
    }
  }, [template, loaded]);

  // Generate HTML from blocks
  const htmlContent = useMemo(() => blocksToHtml(blocks), [blocks]);

  // Block operations
  const updateBlock = useCallback((index: number, updated: EmailBlock) => {
    setBlocks((prev) => {
      const next = [...prev];
      next[index] = updated;
      return next;
    });
    setHasChanges(true);
  }, []);

  const removeBlock = useCallback((index: number) => {
    setBlocks((prev) => prev.filter((_, i) => i !== index));
    setHasChanges(true);
  }, []);

  const moveBlock = useCallback((index: number, direction: -1 | 1) => {
    setBlocks((prev) => {
      const next = [...prev];
      const target = index + direction;
      if (target < 0 || target >= next.length) return prev;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
    setHasChanges(true);
  }, []);

  const addBlock = useCallback((type: EmailBlock["type"]) => {
    setBlocks((prev) => [...prev, defaultBlock(type)]);
    setHasChanges(true);
  }, []);

  function handleSave() {
    updateMutation.mutate({
      id,
      name: name.trim(),
      subject: subject.trim(),
      htmlContent,
      jsonBlocks: JSON.stringify(blocks),
    });
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-apex-gold" />
      </div>
    );
  }

  if (!template) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <p className="text-muted-foreground">Template not found</p>
        <Button variant="outline" onClick={() => navigate("/email-templates")}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Templates
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Top bar */}
      <div className="flex items-center gap-3 flex-wrap">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate("/email-templates")}
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1 min-w-[200px]">
          <Input
            value={name}
            onChange={(e) => { setName(e.target.value); setHasChanges(true); }}
            className="text-lg font-semibold border-none bg-transparent px-0 focus-visible:ring-0 focus-visible:ring-offset-0"
            placeholder="Template name..."
          />
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowPreview(!showPreview)}
            className="gap-1.5"
          >
            {showPreview ? <Pencil className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
            {showPreview ? "Editor Only" : "Show Preview"}
          </Button>
          <Button
            size="sm"
            onClick={handleSave}
            disabled={updateMutation.isPending || !hasChanges}
            className="gap-1.5"
          >
            <Save className="h-3.5 w-3.5" />
            {updateMutation.isPending ? "Saving..." : "Save"}
          </Button>
        </div>
      </div>

      {/* Subject line */}
      <div className="space-y-1">
        <Label className="text-xs text-muted-foreground">Subject Line</Label>
        <Input
          value={subject}
          onChange={(e) => { setSubject(e.target.value); setHasChanges(true); }}
          placeholder="Email subject line (supports merge tags like {{contact.firstName}})"
        />
      </div>

      {/* Editor + Preview */}
      <div className={`grid gap-4 ${showPreview ? "grid-cols-1 lg:grid-cols-2" : "grid-cols-1 max-w-2xl"}`}>
        {/* Block Editor Panel */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
              Blocks
            </h3>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="gap-1.5">
                  <Plus className="h-3.5 w-3.5" />
                  Add Block
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => addBlock("header")}>
                  <Heading className="h-4 w-4 mr-2" /> Header
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => addBlock("text")}>
                  <Type className="h-4 w-4 mr-2" /> Text
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => addBlock("button")}>
                  <MousePointerClick className="h-4 w-4 mr-2" /> Button
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => addBlock("image")}>
                  <Image className="h-4 w-4 mr-2" /> Image
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => addBlock("divider")}>
                  <Minus className="h-4 w-4 mr-2" /> Divider
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => addBlock("footer")}>
                  <AlignLeft className="h-4 w-4 mr-2" /> Footer
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {blocks.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                <p className="text-muted-foreground text-sm mb-3">
                  No blocks yet. Add blocks to build your email template.
                </p>
                <Button variant="outline" size="sm" onClick={() => addBlock("text")}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add First Block
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {blocks.map((block, index) => (
                <BlockEditor
                  key={block.id}
                  block={block}
                  onChange={(updated) => updateBlock(index, updated)}
                  onDelete={() => removeBlock(index)}
                  onMoveUp={() => moveBlock(index, -1)}
                  onMoveDown={() => moveBlock(index, 1)}
                  isFirst={index === 0}
                  isLast={index === blocks.length - 1}
                />
              ))}
            </div>
          )}
        </div>

        {/* Live Preview Panel */}
        {showPreview && (
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
              Preview
            </h3>
            <Card className="overflow-hidden">
              <div className="bg-[#1a1a2e] p-4">
                <iframe
                  srcDoc={htmlContent}
                  className="w-full border-0 rounded"
                  style={{ minHeight: "500px", background: "#1a1a2e" }}
                  title="Email Preview"
                  sandbox="allow-same-origin"
                />
              </div>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
