import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Monitor,
  Smartphone,
  Star,
  Reply,
  Forward,
  MoreHorizontal,
  Paperclip,
  Archive,
  Trash2,
  ChevronLeft,
  Copy,
} from "lucide-react";
import { toast } from "sonner";

interface EmailPreviewProps {
  subject: string;
  previewText?: string;
  body: string;
  senderName?: string;
  senderEmail?: string;
  recipientName?: string;
  recipientEmail?: string;
  date?: Date;
  /** Show copy/source actions */
  showActions?: boolean;
  /** Compact mode for inline use (no outer card) */
  compact?: boolean;
}

export function EmailPreview({
  subject,
  previewText,
  body,
  senderName = "You",
  senderEmail = "you@company.com",
  recipientName = "Recipient",
  recipientEmail = "recipient@email.com",
  date = new Date(),
  showActions = true,
  compact = false,
}: EmailPreviewProps) {
  const [viewMode, setViewMode] = useState<"desktop" | "mobile">("desktop");
  const [showSource, setShowSource] = useState(false);

  const formattedDate = date.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });

  const shortDate = date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });

  const senderInitial = (senderName || "Y")[0].toUpperCase();

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copied to clipboard`);
  };

  // ─── Desktop Email Client View ─────────────────────────────────────
  const DesktopView = () => (
    <div className="rounded-lg border bg-card dark:bg-zinc-950 shadow-sm overflow-hidden">
      {/* Email client toolbar */}
      <div className="flex items-center gap-1 px-3 py-2 border-b bg-muted/50 dark:bg-zinc-900">
        <button className="p-1.5 rounded hover:bg-gray-200 dark:hover:bg-zinc-800 text-muted-foreground">
          <ChevronLeft className="h-4 w-4" />
        </button>
        <button className="p-1.5 rounded hover:bg-gray-200 dark:hover:bg-zinc-800 text-muted-foreground">
          <Archive className="h-4 w-4" />
        </button>
        <button className="p-1.5 rounded hover:bg-gray-200 dark:hover:bg-zinc-800 text-muted-foreground">
          <Trash2 className="h-4 w-4" />
        </button>
        <div className="h-4 w-px bg-border mx-1" />
        <button className="p-1.5 rounded hover:bg-gray-200 dark:hover:bg-zinc-800 text-muted-foreground">
          <Reply className="h-4 w-4" />
        </button>
        <button className="p-1.5 rounded hover:bg-gray-200 dark:hover:bg-zinc-800 text-muted-foreground">
          <Forward className="h-4 w-4" />
        </button>
        <div className="flex-1" />
        <button className="p-1.5 rounded hover:bg-gray-200 dark:hover:bg-zinc-800 text-muted-foreground">
          <MoreHorizontal className="h-4 w-4" />
        </button>
      </div>

      {/* Subject line */}
      <div className="px-5 pt-4 pb-2">
        <h2 className="text-xl font-semibold text-foreground leading-tight">{subject}</h2>
        {previewText && (
          <p className="text-sm text-muted-foreground mt-1 italic">{previewText}</p>
        )}
      </div>

      {/* Sender info row */}
      <div className="px-5 py-3 flex items-start gap-3 border-b">
        <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold text-sm shrink-0">
          {senderInitial}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-medium text-sm text-foreground">{senderName}</span>
            <span className="text-xs text-muted-foreground">&lt;{senderEmail}&gt;</span>
          </div>
          <div className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5">
            <span>to {recipientName}</span>
            <span>&lt;{recipientEmail}&gt;</span>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-xs text-muted-foreground">{formattedDate}</span>
          <button className="p-1 rounded hover:bg-muted dark:hover:bg-zinc-800 text-muted-foreground">
            <Star className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Email body */}
      <div className="px-5 py-5">
        {showSource ? (
          <pre className="text-sm whitespace-pre-wrap font-mono text-muted-foreground bg-muted/30 p-4 rounded-md overflow-x-auto">
            {body}
          </pre>
        ) : (
          <div
            className="prose prose-sm dark:prose-invert max-w-none text-foreground [&_p]:mb-3 [&_h3]:mt-4 [&_h3]:mb-2 [&_a]:text-primary [&_a]:underline"
            dangerouslySetInnerHTML={{ __html: body }}
          />
        )}
      </div>

      {/* Bottom bar */}
      <div className="px-5 py-3 border-t bg-muted/50 dark:bg-zinc-900 flex items-center gap-2">
        <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-md border text-sm text-muted-foreground hover:bg-muted dark:hover:bg-zinc-800">
          <Reply className="h-3.5 w-3.5" /> Reply
        </button>
        <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-md border text-sm text-muted-foreground hover:bg-muted dark:hover:bg-zinc-800">
          <Forward className="h-3.5 w-3.5" /> Forward
        </button>
      </div>
    </div>
  );

  // ─── Mobile Phone View ─────────────────────────────────────────────
  const MobileView = () => (
    <div className="mx-auto" style={{ maxWidth: "375px" }}>
      {/* Phone frame */}
      <div className="rounded-[2rem] border-4 border-gray-800 dark:border-gray-600 bg-card dark:bg-zinc-950 shadow-xl overflow-hidden">
        {/* Status bar */}
        <div className="flex items-center justify-between px-6 py-1.5 bg-gray-800 dark:bg-gray-700 text-white text-xs">
          <span className="font-medium">9:41</span>
          <div className="flex items-center gap-1">
            <div className="flex gap-0.5">
              <div className="w-1 h-2 bg-card rounded-sm" />
              <div className="w-1 h-2.5 bg-card rounded-sm" />
              <div className="w-1 h-3 bg-card rounded-sm" />
              <div className="w-1 h-3.5 bg-card rounded-sm" />
            </div>
            <span className="ml-1">100%</span>
          </div>
        </div>

        {/* Mail app header */}
        <div className="flex items-center gap-2 px-4 py-2.5 border-b bg-muted/50 dark:bg-zinc-900">
          <ChevronLeft className="h-5 w-5 text-primary" />
          <div className="flex-1 text-center">
            <span className="text-xs text-muted-foreground">Inbox</span>
          </div>
          <Archive className="h-4 w-4 text-muted-foreground" />
        </div>

        {/* Inbox list item (how it appears in inbox) */}
        <div className="px-4 py-3 border-b bg-primary/5">
          <div className="flex items-center gap-2 mb-1">
            <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold text-xs shrink-0">
              {senderInitial}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-sm text-foreground truncate">{senderName}</span>
                <span className="text-xs text-muted-foreground shrink-0 ml-2">{shortDate}</span>
              </div>
              <p className="text-sm font-medium text-foreground truncate">{subject}</p>
              {previewText && (
                <p className="text-xs text-muted-foreground truncate">{previewText}</p>
              )}
            </div>
          </div>
        </div>

        {/* Divider */}
        <div className="px-4 py-1.5 bg-muted/50 dark:bg-zinc-900 border-b">
          <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">Email Content</span>
        </div>

        {/* Email body on mobile */}
        <div className="px-4 py-4" style={{ maxHeight: "380px", overflowY: "auto" }}>
          {/* Sender row */}
          <div className="flex items-center gap-2 mb-3 pb-3 border-b">
            <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold text-xs shrink-0">
              {senderInitial}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground">{senderName}</p>
              <p className="text-xs text-muted-foreground">to {recipientName}</p>
            </div>
            <span className="text-[10px] text-muted-foreground">{shortDate}</span>
          </div>

          {/* Subject */}
          <h3 className="text-base font-semibold text-foreground mb-3">{subject}</h3>

          {/* Body */}
          {showSource ? (
            <pre className="text-xs whitespace-pre-wrap font-mono text-muted-foreground bg-muted/30 p-3 rounded-md overflow-x-auto">
              {body}
            </pre>
          ) : (
            <div
              className="prose prose-sm dark:prose-invert max-w-none text-foreground text-sm [&_p]:mb-2.5 [&_h3]:mt-3 [&_h3]:mb-1.5 [&_h3]:text-sm [&_a]:text-primary [&_a]:underline"
              dangerouslySetInnerHTML={{ __html: body }}
            />
          )}
        </div>

        {/* Mobile action bar */}
        <div className="flex items-center justify-around py-2.5 border-t bg-muted/50 dark:bg-zinc-900">
          <button className="flex flex-col items-center gap-0.5 text-primary">
            <Reply className="h-4 w-4" />
            <span className="text-[10px]">Reply</span>
          </button>
          <button className="flex flex-col items-center gap-0.5 text-muted-foreground">
            <Forward className="h-4 w-4" />
            <span className="text-[10px]">Forward</span>
          </button>
          <button className="flex flex-col items-center gap-0.5 text-muted-foreground">
            <Paperclip className="h-4 w-4" />
            <span className="text-[10px]">Attach</span>
          </button>
          <button className="flex flex-col items-center gap-0.5 text-muted-foreground">
            <Trash2 className="h-4 w-4" />
            <span className="text-[10px]">Delete</span>
          </button>
        </div>

        {/* Home indicator */}
        <div className="flex justify-center py-2 bg-muted/50 dark:bg-zinc-900">
          <div className="w-32 h-1 bg-gray-300 dark:bg-gray-600 rounded-full" />
        </div>
      </div>
    </div>
  );

  return (
    <div className={compact ? "" : "space-y-3"}>
      {/* Controls bar */}
      <div className="flex items-center justify-between gap-2">
        {/* View toggle */}
        <div className="inline-flex items-center rounded-lg border p-0.5 bg-muted/50">
          <button
            onClick={() => setViewMode("desktop")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
              viewMode === "desktop"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Monitor className="h-4 w-4" />
            Desktop
          </button>
          <button
            onClick={() => setViewMode("mobile")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
              viewMode === "mobile"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Smartphone className="h-4 w-4" />
            Mobile
          </button>
        </div>

        {/* Actions */}
        {showActions && (
          <div className="flex items-center gap-1">
            <button
              onClick={() => setShowSource(!showSource)}
              className="text-xs text-muted-foreground hover:text-foreground px-2 py-1 rounded border"
            >
              {showSource ? "Rendered" : "Source"}
            </button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => copyToClipboard(subject, "Subject")}
              title="Copy subject"
            >
              <Copy className="h-3.5 w-3.5" />
            </Button>
          </div>
        )}
      </div>

      {/* Preview */}
      <div className={viewMode === "mobile" ? "py-4 bg-muted/20 rounded-lg" : ""}>
        {viewMode === "desktop" ? <DesktopView /> : <MobileView />}
      </div>
    </div>
  );
}
