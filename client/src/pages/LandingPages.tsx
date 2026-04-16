import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { useAccount } from "@/contexts/AccountContext";
import { toast } from "sonner";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Plus,
  FileText,
  Globe,
  Eye,
  MoreVertical,
  Pencil,
  Copy,
  Trash2,
  ExternalLink,
  Search,
  LayoutTemplate,
  ArrowUpFromLine,
  ArrowDownToLine,
  BarChart3,
} from "lucide-react";

export default function LandingPages() {
  const { currentAccountId: accountId } = useAccount();
  const [, navigate] = useLocation();
  const [showCreate, setShowCreate] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newSlug, setNewSlug] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [search, setSearch] = useState("");

  const { data: pages = [], isLoading } = trpc.landingPages.list.useQuery(
    { accountId: accountId! },
    { enabled: !!accountId }
  );

  const utils = trpc.useUtils();

  const createMutation = trpc.landingPages.create.useMutation({
    onSuccess: (result) => {
      utils.landingPages.list.invalidate();
      setShowCreate(false);
      setNewTitle("");
      setNewSlug("");
      setNewDescription("");
      toast.success("Page created — open the editor to start building.");
      navigate(`/pages/${result.id}/editor`);
    },
    onError: (err) => toast.error(err.message),
  });

  const publishMutation = trpc.landingPages.publish.useMutation({
    onSuccess: () => {
      utils.landingPages.list.invalidate();
      toast.success("Page published!");
    },
    onError: (err) => toast.error(err.message),
  });

  const unpublishMutation = trpc.landingPages.unpublish.useMutation({
    onSuccess: () => {
      utils.landingPages.list.invalidate();
      toast.success("Page unpublished");
    },
    onError: (err) => toast.error(err.message),
  });

  const duplicateMutation = trpc.landingPages.duplicate.useMutation({
    onSuccess: () => {
      utils.landingPages.list.invalidate();
      toast.success("Page duplicated");
    },
    onError: (err) => toast.error(err.message),
  });

  const deleteMutation = trpc.landingPages.delete.useMutation({
    onSuccess: () => {
      utils.landingPages.list.invalidate();
      toast.success("Page deleted");
    },
    onError: (err) => toast.error(err.message),
  });

  const filteredPages = useMemo(() => {
    if (!search) return pages;
    const q = search.toLowerCase();
    return pages.filter(
      (p: any) =>
        p.title.toLowerCase().includes(q) || p.slug.toLowerCase().includes(q)
    );
  }, [pages, search]);

  const stats = useMemo(() => {
    const total = pages.length;
    const published = pages.filter((p: any) => p.status === "published").length;
    const drafts = pages.filter((p: any) => p.status === "draft").length;
    const totalViews = pages.reduce((sum: number, p: any) => sum + (p.viewCount || 0), 0);
    return { total, published, drafts, totalViews };
  }, [pages]);

  function autoSlug(title: string) {
    return title
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, "")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-")
      .slice(0, 100);
  }

  if (!accountId) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        Select a sub-account to manage landing pages
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Landing Pages</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Build and publish drag-and-drop landing pages for lead capture
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => navigate("/funnels")}>
            <LayoutTemplate className="h-4 w-4 mr-2" />
            Funnels
          </Button>
          <Button onClick={() => setShowCreate(true)}>
            <Plus className="h-4 w-4 mr-2" />
            New Page
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-500/10">
                <FileText className="h-4 w-4 text-blue-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.total}</p>
                <p className="text-xs text-muted-foreground">Total Pages</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-500/10">
                <Globe className="h-4 w-4 text-green-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.published}</p>
                <p className="text-xs text-muted-foreground">Published</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-yellow-500/10">
                <Pencil className="h-4 w-4 text-yellow-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.drafts}</p>
                <p className="text-xs text-muted-foreground">Drafts</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-purple-500/10">
                <BarChart3 className="h-4 w-4 text-purple-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.totalViews.toLocaleString()}</p>
                <p className="text-xs text-muted-foreground">Total Views</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search pages..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Pages Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="p-6">
                <div className="h-32 bg-muted rounded-lg mb-4" />
                <div className="h-4 bg-muted rounded w-3/4 mb-2" />
                <div className="h-3 bg-muted rounded w-1/2" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : filteredPages.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <FileText className="h-12 w-12 text-muted-foreground/30 mb-4" />
            <h3 className="text-lg font-semibold mb-1">
              {search ? "No pages match your search" : "No landing pages yet"}
            </h3>
            <p className="text-muted-foreground text-sm mb-4">
              {search
                ? "Try a different search term"
                : "Create your first landing page with the drag-and-drop builder"}
            </p>
            {!search && (
              <Button onClick={() => setShowCreate(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Create Your First Page
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredPages.map((page: any) => (
            <Card
              key={page.id}
              className="group hover:shadow-md transition-shadow cursor-pointer"
              onClick={() => navigate(`/pages/${page.id}/editor`)}
            >
              <CardContent className="p-0">
                {/* Preview thumbnail */}
                <div className="relative h-40 bg-gradient-to-br from-muted/50 to-muted rounded-t-lg overflow-hidden">
                  {page.htmlContent ? (
                    <div
                      className="absolute inset-0 scale-[0.25] origin-top-left w-[400%] h-[400%] pointer-events-none overflow-hidden"
                      dangerouslySetInnerHTML={{
                        __html: `<style>${page.cssContent || ""}</style>${page.htmlContent}`,
                      }}
                    />
                  ) : (
                    <div className="flex items-center justify-center h-full">
                      <FileText className="h-8 w-8 text-muted-foreground/30" />
                    </div>
                  )}
                  {/* Status badge */}
                  <div className="absolute top-2 left-2">
                    <Badge
                      variant={page.status === "published" ? "default" : "secondary"}
                      className={
                        page.status === "published"
                          ? "bg-green-500/90 text-white"
                          : ""
                      }
                    >
                      {page.status === "published" ? (
                        <>
                          <Globe className="h-3 w-3 mr-1" />
                          Published
                        </>
                      ) : (
                        "Draft"
                      )}
                    </Badge>
                  </div>
                  {/* Actions */}
                  <div
                    className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="secondary" size="icon" className="h-7 w-7">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onClick={() => navigate(`/pages/${page.id}/editor`)}
                        >
                          <Pencil className="h-4 w-4 mr-2" />
                          Edit in Builder
                        </DropdownMenuItem>
                        {page.status === "draft" ? (
                          <DropdownMenuItem
                            onClick={() =>
                              publishMutation.mutate({
                                id: page.id,
                                accountId: accountId!,
                              })
                            }
                          >
                            <ArrowUpFromLine className="h-4 w-4 mr-2" />
                            Publish
                          </DropdownMenuItem>
                        ) : (
                          <DropdownMenuItem
                            onClick={() =>
                              unpublishMutation.mutate({
                                id: page.id,
                                accountId: accountId!,
                              })
                            }
                          >
                            <ArrowDownToLine className="h-4 w-4 mr-2" />
                            Unpublish
                          </DropdownMenuItem>
                        )}
                        {page.status === "published" && (
                          <DropdownMenuItem
                            onClick={() =>
                              window.open(
                                `/p/${page.slug}`,
                                "_blank"
                              )
                            }
                          >
                            <ExternalLink className="h-4 w-4 mr-2" />
                            View Live Page
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuItem
                          onClick={() =>
                            duplicateMutation.mutate({
                              id: page.id,
                              accountId: accountId!,
                            })
                          }
                        >
                          <Copy className="h-4 w-4 mr-2" />
                          Duplicate
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-destructive"
                          onClick={() => {
                            if (
                              confirm("Delete this page? This cannot be undone.")
                            )
                              deleteMutation.mutate({
                                id: page.id,
                                accountId: accountId!,
                              });
                          }}
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
                {/* Info */}
                <div className="p-4">
                  <h3 className="font-semibold truncate">{page.title}</h3>
                  <p className="text-xs text-muted-foreground mt-1 truncate">
                    /{page.slug}
                  </p>
                  <div className="flex items-center gap-3 mt-3 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Eye className="h-3 w-3" />
                      {(page.viewCount || 0).toLocaleString()} views
                    </span>
                    <span>
                      Updated{" "}
                      {new Date(page.updatedAt).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create Dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Landing Page</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Page Title</Label>
              <Input
                placeholder="e.g., Free Mortgage Consultation"
                value={newTitle}
                onChange={(e) => {
                  setNewTitle(e.target.value);
                  if (!newSlug || newSlug === autoSlug(newTitle)) {
                    setNewSlug(autoSlug(e.target.value));
                  }
                }}
              />
            </div>
            <div>
              <Label>URL Slug</Label>
              <Input
                placeholder="e.g., free-consultation"
                value={newSlug}
                onChange={(e) =>
                  setNewSlug(
                    e.target.value
                      .toLowerCase()
                      .replace(/[^a-z0-9-]/g, "")
                  )
                }
              />
              <p className="text-xs text-muted-foreground mt-1">
                Public URL: /p/your-account/{newSlug || "page-slug"}
              </p>
            </div>
            <div>
              <Label>Meta Description (optional)</Label>
              <Textarea
                placeholder="Brief description for search engines..."
                value={newDescription}
                onChange={(e) => setNewDescription(e.target.value)}
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>
              Cancel
            </Button>
            <Button
              onClick={() =>
                createMutation.mutate({
                  accountId: accountId!,
                  title: newTitle,
                  slug: newSlug,
                  metaDescription: newDescription || undefined,
                })
              }
              disabled={!newTitle.trim() || !newSlug.trim() || createMutation.isPending}
            >
              {createMutation.isPending ? "Creating..." : "Create & Open Editor"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
