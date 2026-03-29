import { useEffect, useRef, useState, useCallback } from "react";
import { trpc } from "@/lib/trpc";
import { useAccount } from "@/contexts/AccountContext";
import { toast } from "sonner";
import { useLocation, useParams } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft,
  Save,
  Globe,
  Eye,
  Settings,
  ArrowUpFromLine,
  ArrowDownToLine,
  Loader2,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import grapesjs, { Editor } from "grapesjs";
import "grapesjs/dist/css/grapes.min.css";

export default function PageEditor() {
  const { id } = useParams<{ id: string }>();
  const pageId = parseInt(id || "0");
  const { currentAccountId: accountId } = useAccount();
  const [, navigate] = useLocation();
  const editorRef = useRef<Editor | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [saving, setSaving] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [settingsTitle, setSettingsTitle] = useState("");
  const [settingsSlug, setSettingsSlug] = useState("");
  const [settingsDescription, setSettingsDescription] = useState("");
  const [settingsHeaderCode, setSettingsHeaderCode] = useState("");
  const [settingsFooterCode, setSettingsFooterCode] = useState("");
  const [editorReady, setEditorReady] = useState(false);

  const { data: page, isLoading } = trpc.landingPages.get.useQuery(
    { id: pageId, accountId: accountId! },
    { enabled: !!accountId && !!pageId }
  );

  const saveMutation = trpc.landingPages.saveContent.useMutation({
    onSuccess: () => toast.success("Page saved"),
    onError: (err) => toast.error(err.message),
  });

  const updateMutation = trpc.landingPages.update.useMutation({
    onSuccess: () => {
      toast.success("Settings updated");
      setShowSettings(false);
    },
    onError: (err) => toast.error(err.message),
  });

  const publishMutation = trpc.landingPages.publish.useMutation({
    onSuccess: () => toast.success("Page published!"),
    onError: (err) => toast.error(err.message),
  });

  const unpublishMutation = trpc.landingPages.unpublish.useMutation({
    onSuccess: () => toast.success("Page unpublished"),
    onError: (err) => toast.error(err.message),
  });

  const utils = trpc.useUtils();

  // Initialize GrapesJS
  useEffect(() => {
    if (!containerRef.current || !page || editorRef.current) return;

    const editor = grapesjs.init({
      container: containerRef.current,
      height: "100%",
      width: "auto",
      storageManager: false,
      fromElement: false,
      panels: { defaults: [] },
      canvas: {
        styles: [
          "https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap",
        ],
      },
      deviceManager: {
        devices: [
          { name: "Desktop", width: "" },
          { name: "Tablet", width: "768px", widthMedia: "992px" },
          { name: "Mobile", width: "375px", widthMedia: "480px" },
        ],
      },
      blockManager: {
        blocks: [
          // Layout
          {
            id: "section",
            label: "Section",
            category: "Layout",
            content: `<section style="padding: 60px 20px; max-width: 1200px; margin: 0 auto;"><div>Content here</div></section>`,
          },
          {
            id: "columns-2",
            label: "2 Columns",
            category: "Layout",
            content: `<div style="display: flex; gap: 20px; padding: 20px; flex-wrap: wrap;"><div style="flex: 1; min-width: 250px; padding: 20px;">Column 1</div><div style="flex: 1; min-width: 250px; padding: 20px;">Column 2</div></div>`,
          },
          {
            id: "columns-3",
            label: "3 Columns",
            category: "Layout",
            content: `<div style="display: flex; gap: 20px; padding: 20px; flex-wrap: wrap;"><div style="flex: 1; min-width: 200px; padding: 20px;">Column 1</div><div style="flex: 1; min-width: 200px; padding: 20px;">Column 2</div><div style="flex: 1; min-width: 200px; padding: 20px;">Column 3</div></div>`,
          },
          // Typography
          {
            id: "heading",
            label: "Heading",
            category: "Typography",
            content: `<h1 style="font-size: 2.5rem; font-weight: 700; color: #111; margin-bottom: 16px;">Your Heading Here</h1>`,
          },
          {
            id: "subheading",
            label: "Subheading",
            category: "Typography",
            content: `<h2 style="font-size: 1.5rem; font-weight: 600; color: #333; margin-bottom: 12px;">Subheading Text</h2>`,
          },
          {
            id: "paragraph",
            label: "Paragraph",
            category: "Typography",
            content: `<p style="font-size: 1rem; line-height: 1.7; color: #555; margin-bottom: 16px;">Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.</p>`,
          },
          // Media
          {
            id: "image",
            label: "Image",
            category: "Media",
            content: { type: "image", style: { width: "100%", "border-radius": "8px" } },
          },
          {
            id: "video",
            label: "Video",
            category: "Media",
            content: {
              type: "video",
              src: "https://www.youtube.com/embed/dQw4w9WgXcQ",
              style: { width: "100%", height: "400px" },
            },
          },
          // Components
          {
            id: "button",
            label: "Button",
            category: "Components",
            content: `<a href="#" style="display: inline-block; padding: 14px 32px; background: #2563eb; color: white; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 1rem; transition: background 0.2s;">Get Started</a>`,
          },
          {
            id: "divider",
            label: "Divider",
            category: "Components",
            content: `<hr style="border: none; border-top: 1px solid #e5e7eb; margin: 32px 0;" />`,
          },
          {
            id: "spacer",
            label: "Spacer",
            category: "Components",
            content: `<div style="height: 40px;"></div>`,
          },
          // Hero Sections
          {
            id: "hero-centered",
            label: "Hero (Centered)",
            category: "Sections",
            content: `<section style="padding: 80px 20px; text-align: center; background: linear-gradient(135deg, #1e3a5f 0%, #2563eb 100%); color: white;">
              <div style="max-width: 800px; margin: 0 auto;">
                <h1 style="font-size: 3rem; font-weight: 800; margin-bottom: 20px; color: white;">Your Dream Home Starts Here</h1>
                <p style="font-size: 1.25rem; opacity: 0.9; margin-bottom: 32px; line-height: 1.6; color: white;">Expert mortgage guidance tailored to your needs. Get pre-approved in minutes.</p>
                <a href="#" style="display: inline-block; padding: 16px 40px; background: white; color: #1e3a5f; text-decoration: none; border-radius: 8px; font-weight: 700; font-size: 1.1rem;">Apply Now</a>
              </div>
            </section>`,
          },
          {
            id: "hero-split",
            label: "Hero (Split)",
            category: "Sections",
            content: `<section style="display: flex; align-items: center; gap: 40px; padding: 60px 40px; max-width: 1200px; margin: 0 auto; flex-wrap: wrap;">
              <div style="flex: 1; min-width: 300px;">
                <h1 style="font-size: 2.5rem; font-weight: 800; color: #111; margin-bottom: 16px;">Lower Rates, Better Service</h1>
                <p style="font-size: 1.1rem; color: #555; line-height: 1.7; margin-bottom: 24px;">We help you find the perfect mortgage with competitive rates and personalized support every step of the way.</p>
                <a href="#" style="display: inline-block; padding: 14px 32px; background: #2563eb; color: white; text-decoration: none; border-radius: 8px; font-weight: 600;">Get Pre-Approved</a>
              </div>
              <div style="flex: 1; min-width: 300px;">
                <img src="https://placehold.co/600x400/e2e8f0/475569?text=Your+Image" style="width: 100%; border-radius: 12px;" />
              </div>
            </section>`,
          },
          // Forms
          {
            id: "lead-form",
            label: "Lead Capture Form",
            category: "Forms",
            content: `<form style="max-width: 500px; margin: 0 auto; padding: 40px; background: white; border-radius: 12px; box-shadow: 0 4px 24px rgba(0,0,0,0.08);">
              <h3 style="font-size: 1.5rem; font-weight: 700; margin-bottom: 8px; text-align: center;">Get a Free Quote</h3>
              <p style="color: #666; text-align: center; margin-bottom: 24px;">Fill out the form and we'll get back to you within 24 hours.</p>
              <div style="margin-bottom: 16px;">
                <label style="display: block; font-weight: 500; margin-bottom: 6px; font-size: 0.875rem;">Full Name</label>
                <input type="text" name="name" placeholder="John Doe" style="width: 100%; padding: 12px 16px; border: 1px solid #d1d5db; border-radius: 8px; font-size: 1rem; box-sizing: border-box;" />
              </div>
              <div style="margin-bottom: 16px;">
                <label style="display: block; font-weight: 500; margin-bottom: 6px; font-size: 0.875rem;">Email</label>
                <input type="email" name="email" placeholder="john@example.com" style="width: 100%; padding: 12px 16px; border: 1px solid #d1d5db; border-radius: 8px; font-size: 1rem; box-sizing: border-box;" />
              </div>
              <div style="margin-bottom: 16px;">
                <label style="display: block; font-weight: 500; margin-bottom: 6px; font-size: 0.875rem;">Phone</label>
                <input type="tel" name="phone" placeholder="(555) 123-4567" style="width: 100%; padding: 12px 16px; border: 1px solid #d1d5db; border-radius: 8px; font-size: 1rem; box-sizing: border-box;" />
              </div>
              <button type="submit" style="width: 100%; padding: 14px; background: #2563eb; color: white; border: none; border-radius: 8px; font-size: 1rem; font-weight: 600; cursor: pointer;">Submit</button>
            </form>`,
          },
          // Testimonials
          {
            id: "testimonial",
            label: "Testimonial",
            category: "Sections",
            content: `<div style="max-width: 600px; margin: 0 auto; padding: 40px; text-align: center;">
              <p style="font-size: 1.25rem; font-style: italic; color: #333; line-height: 1.7; margin-bottom: 20px;">"Working with this team was the best decision we made. They found us an amazing rate and made the whole process seamless."</p>
              <p style="font-weight: 600; color: #111;">— Sarah Johnson</p>
              <p style="color: #666; font-size: 0.875rem;">First-time Homebuyer</p>
            </div>`,
          },
          // CTA
          {
            id: "cta-banner",
            label: "CTA Banner",
            category: "Sections",
            content: `<section style="padding: 60px 20px; background: #f8fafc; text-align: center;">
              <h2 style="font-size: 2rem; font-weight: 700; margin-bottom: 12px;">Ready to Get Started?</h2>
              <p style="color: #555; font-size: 1.1rem; margin-bottom: 24px;">Schedule a free consultation today and take the first step.</p>
              <a href="#" style="display: inline-block; padding: 14px 40px; background: #2563eb; color: white; text-decoration: none; border-radius: 8px; font-weight: 600;">Book Consultation</a>
            </section>`,
          },
        ],
      },
      styleManager: {
        sectors: [
          {
            name: "General",
            open: true,
            properties: [
              "display",
              "float",
              "position",
              "top",
              "right",
              "left",
              "bottom",
            ],
          },
          {
            name: "Dimension",
            open: false,
            properties: [
              "width",
              "height",
              "max-width",
              "min-height",
              "margin",
              "padding",
            ],
          },
          {
            name: "Typography",
            open: false,
            properties: [
              "font-family",
              "font-size",
              "font-weight",
              "letter-spacing",
              "color",
              "line-height",
              "text-align",
              "text-decoration",
              "text-shadow",
            ],
          },
          {
            name: "Decorations",
            open: false,
            properties: [
              "background-color",
              "background",
              "border-radius",
              "border",
              "box-shadow",
              "opacity",
            ],
          },
          {
            name: "Extra",
            open: false,
            properties: ["transition", "perspective", "transform"],
          },
        ],
      },
    });

    // Add custom panels for device switching
    editor.Panels.addPanel({
      id: "devices",
      el: ".panel__devices",
      buttons: [
        {
          id: "device-desktop",
          label: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>',
          command: "set-device-desktop",
          active: true,
          togglable: false,
        },
        {
          id: "device-tablet",
          label: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><rect x="4" y="2" width="16" height="20" rx="2"/><line x1="12" y1="18" x2="12" y2="18"/></svg>',
          command: "set-device-tablet",
          togglable: false,
        },
        {
          id: "device-mobile",
          label: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><rect x="5" y="2" width="14" height="20" rx="2"/><line x1="12" y1="18" x2="12" y2="18"/></svg>',
          command: "set-device-mobile",
          togglable: false,
        },
      ],
    });

    editor.Commands.add("set-device-desktop", {
      run: (ed) => ed.setDevice("Desktop"),
    });
    editor.Commands.add("set-device-tablet", {
      run: (ed) => ed.setDevice("Tablet"),
    });
    editor.Commands.add("set-device-mobile", {
      run: (ed) => ed.setDevice("Mobile"),
    });

    // Load existing content
    if (page.gjsData && typeof page.gjsData === "object" && Object.keys(page.gjsData as object).length > 0) {
      editor.loadProjectData(page.gjsData as any);
    } else if (page.htmlContent) {
      editor.setComponents(page.htmlContent);
      if (page.cssContent) {
        editor.setStyle(page.cssContent);
      }
    }

    editorRef.current = editor;
    setEditorReady(true);

    return () => {
      editor.destroy();
      editorRef.current = null;
      setEditorReady(false);
    };
  }, [page]);

  const handleSave = useCallback(async () => {
    if (!editorRef.current || !accountId) return;
    setSaving(true);
    try {
      const editor = editorRef.current;
      const htmlContent = editor.getHtml();
      const cssContent = editor.getCss() || "";
      const gjsData = editor.getProjectData();

      await saveMutation.mutateAsync({
        id: pageId,
        accountId,
        htmlContent,
        cssContent,
        gjsData,
      });
      utils.landingPages.get.invalidate({ id: pageId, accountId });
      utils.landingPages.list.invalidate();
    } catch {
      // error handled by mutation
    } finally {
      setSaving(false);
    }
  }, [accountId, pageId, saveMutation, utils]);

  // Keyboard shortcut: Ctrl+S
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault();
        handleSave();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [handleSave]);

  if (!accountId) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        Select a sub-account first
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!page) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <p className="text-muted-foreground">Page not found</p>
        <Button variant="outline" onClick={() => navigate("/pages")}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Pages
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[calc(100vh-64px)]">
      {/* Top toolbar */}
      <div className="flex items-center justify-between px-4 py-2 border-b bg-background shrink-0">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate("/pages")}>
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back
          </Button>
          <div className="h-5 w-px bg-border" />
          <h2 className="font-semibold text-sm truncate max-w-[200px]">
            {page.title}
          </h2>
          <Badge
            variant={page.status === "published" ? "default" : "secondary"}
            className={
              page.status === "published"
                ? "bg-green-500/90 text-white text-xs"
                : "text-xs"
            }
          >
            {page.status}
          </Badge>
        </div>

        <div className="flex items-center gap-2">
          {/* Device switcher placeholder */}
          <div className="panel__devices" />

          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setSettingsTitle(page.title);
              setSettingsSlug(page.slug);
              setSettingsDescription(page.metaDescription || "");
              setSettingsHeaderCode(page.headerCode || "");
              setSettingsFooterCode(page.footerCode || "");
              setShowSettings(true);
            }}
          >
            <Settings className="h-4 w-4 mr-1" />
            Settings
          </Button>

          {page.status === "published" && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => window.open(`/p/${page.slug}`, "_blank")}
            >
              <Eye className="h-4 w-4 mr-1" />
              Preview
            </Button>
          )}

          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              if (page.status === "published") {
                unpublishMutation.mutate(
                  { id: pageId, accountId: accountId! },
                  {
                    onSuccess: () =>
                      utils.landingPages.get.invalidate({
                        id: pageId,
                        accountId: accountId!,
                      }),
                  }
                );
              } else {
                publishMutation.mutate(
                  { id: pageId, accountId: accountId! },
                  {
                    onSuccess: () =>
                      utils.landingPages.get.invalidate({
                        id: pageId,
                        accountId: accountId!,
                      }),
                  }
                );
              }
            }}
          >
            {page.status === "published" ? (
              <>
                <ArrowDownToLine className="h-4 w-4 mr-1" />
                Unpublish
              </>
            ) : (
              <>
                <ArrowUpFromLine className="h-4 w-4 mr-1" />
                Publish
              </>
            )}
          </Button>

          <Button size="sm" onClick={handleSave} disabled={saving}>
            {saving ? (
              <Loader2 className="h-4 w-4 mr-1 animate-spin" />
            ) : (
              <Save className="h-4 w-4 mr-1" />
            )}
            {saving ? "Saving..." : "Save"}
          </Button>
        </div>
      </div>

      {/* GrapesJS Editor */}
      <div ref={containerRef} className="flex-1 overflow-hidden" />

      {/* Settings Dialog */}
      <Dialog open={showSettings} onOpenChange={setShowSettings}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Page Settings</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Page Title</Label>
              <Input
                value={settingsTitle}
                onChange={(e) => setSettingsTitle(e.target.value)}
              />
            </div>
            <div>
              <Label>URL Slug</Label>
              <Input
                value={settingsSlug}
                onChange={(e) =>
                  setSettingsSlug(
                    e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "")
                  )
                }
              />
            </div>
            <div>
              <Label>Meta Description</Label>
              <Textarea
                value={settingsDescription}
                onChange={(e) => setSettingsDescription(e.target.value)}
                rows={2}
              />
            </div>
            <div>
              <Label>Header Code Injection</Label>
              <Textarea
                value={settingsHeaderCode}
                onChange={(e) => setSettingsHeaderCode(e.target.value)}
                rows={3}
                placeholder="<script>...</script> or <link ...>"
                className="font-mono text-xs"
              />
            </div>
            <div>
              <Label>Footer Code Injection</Label>
              <Textarea
                value={settingsFooterCode}
                onChange={(e) => setSettingsFooterCode(e.target.value)}
                rows={3}
                placeholder="<script>...</script>"
                className="font-mono text-xs"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSettings(false)}>
              Cancel
            </Button>
            <Button
              onClick={() =>
                updateMutation.mutate({
                  id: pageId,
                  accountId: accountId!,
                  title: settingsTitle,
                  slug: settingsSlug,
                  metaDescription: settingsDescription,
                  headerCode: settingsHeaderCode,
                  footerCode: settingsFooterCode,
                })
              }
              disabled={updateMutation.isPending}
            >
              {updateMutation.isPending ? "Saving..." : "Save Settings"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
