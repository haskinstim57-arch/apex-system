import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import CampaignBuilder from "@/components/CampaignBuilder";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ChevronLeft,
  ChevronRight,
  Clock,
  Filter,
  Loader2,
  Mail,
  MessageSquare,
  MoreHorizontal,
  Pause,
  Play,
  Plus,
  Search,
  Send,
  Trash2,
  X,
  FileText,
  Users,
  BarChart3,
  Calendar,
  XCircle,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useState } from "react";
import { useLocation } from "wouter";
import { toast } from "sonner";
import { useAccount } from "@/contexts/AccountContext";
import { NoAccountSelected } from "@/components/NoAccountSelected";

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-zinc-500/15 text-zinc-400 border-zinc-500/30",
  scheduled: "bg-blue-500/15 text-blue-400 border-blue-500/30",
  sending: "bg-amber-500/15 text-amber-400 border-amber-500/30",
  sent: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  paused: "bg-orange-500/15 text-orange-400 border-orange-500/30",
  cancelled: "bg-red-500/15 text-red-400 border-red-500/30",
};

const MERGE_TAGS = [
  { tag: "{{firstName}}", label: "First Name" },
  { tag: "{{lastName}}", label: "Last Name" },
  { tag: "{{email}}", label: "Email" },
  { tag: "{{phone}}", label: "Phone" },
  { tag: "{{company}}", label: "Company" },
];

export default function Campaigns() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const utils = trpc.useUtils();
  const { currentAccountId: accountId, isLoading: accountsLoading } = useAccount();

  // Tab state
  const [activeTab, setActiveTab] = useState("campaigns");

  // Filters
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [typeFilter, setTypeFilter] = useState<string>("");
  const [page, setPage] = useState(0);
  const pageSize = 25;

  // Campaigns query
  const { data: campaignsData, isLoading: campaignsLoading } =
    trpc.campaigns.list.useQuery(
      {
        accountId: accountId!,
        search: search || undefined,
        status: statusFilter || undefined,
        type: (typeFilter as "email" | "sms") || undefined,
        limit: pageSize,
        offset: page * pageSize,
      },
      { enabled: !!accountId }
    );

  // Campaign stats
  const { data: stats } = trpc.campaigns.stats.useQuery(
    { accountId: accountId! },
    { enabled: !!accountId }
  );

  // Templates query
  const { data: templates } = trpc.campaigns.templates.list.useQuery(
    { accountId: accountId! },
    { enabled: !!accountId }
  );

  // Dialogs
  const [createOpen, setCreateOpen] = useState(false);
  const [templateOpen, setTemplateOpen] = useState(false);

  // Mutations
  const deleteMutation = trpc.campaigns.delete.useMutation({
    onSuccess: () => {
      utils.campaigns.list.invalidate();
      utils.campaigns.stats.invalidate();
      toast.success("Campaign deleted");
    },
    onError: (e) => toast.error(e.message),
  });

  const sendMutation = trpc.campaigns.send.useMutation({
    onSuccess: (data) => {
      utils.campaigns.list.invalidate();
      utils.campaigns.stats.invalidate();
      toast.success(
        `Campaign sent! ${data.sentCount} delivered, ${data.failedCount} failed`
      );
    },
    onError: (e) => toast.error(e.message),
  });

  const pauseMutation = trpc.campaigns.pause.useMutation({
    onSuccess: () => {
      utils.campaigns.list.invalidate();
      utils.campaigns.stats.invalidate();
      toast.success("Campaign paused");
    },
    onError: (e) => toast.error(e.message),
  });

  const cancelMutation = trpc.campaigns.cancel.useMutation({
    onSuccess: () => {
      utils.campaigns.list.invalidate();
      utils.campaigns.stats.invalidate();
      toast.success("Campaign cancelled");
    },
    onError: (e) => toast.error(e.message),
  });

  const deleteTemplateMutation = trpc.campaigns.templates.delete.useMutation({
    onSuccess: () => {
      utils.campaigns.templates.list.invalidate();
      toast.success("Template deleted");
    },
    onError: (e) => toast.error(e.message),
  });

  const campaigns = campaignsData?.data || [];
  const totalCampaigns = campaignsData?.total || 0;
  const totalPages = Math.ceil(totalCampaigns / pageSize);

  if (!accountId) {
    return <NoAccountSelected />;
  }


  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Campaigns</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Create and manage email & SMS campaigns
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Account selector removed — use sidebar AccountSwitcher */}
        </div>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
          <Card className="border-border/50 bg-card">
            <CardContent className="pt-4 pb-3">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                Total
              </p>
              <p className="text-xl font-semibold mt-0.5">{stats.total}</p>
            </CardContent>
          </Card>
          <Card className="border-border/50 bg-card">
            <CardContent className="pt-4 pb-3">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                Draft
              </p>
              <p className="text-xl font-semibold mt-0.5">{stats.draft}</p>
            </CardContent>
          </Card>
          <Card className="border-border/50 bg-card">
            <CardContent className="pt-4 pb-3">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                Scheduled
              </p>
              <p className="text-xl font-semibold mt-0.5 text-blue-400">
                {stats.scheduled}
              </p>
            </CardContent>
          </Card>
          <Card className="border-border/50 bg-card">
            <CardContent className="pt-4 pb-3">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                Sent
              </p>
              <p className="text-xl font-semibold mt-0.5 text-emerald-400">
                {stats.sent}
              </p>
            </CardContent>
          </Card>
          <Card className="border-border/50 bg-card">
            <CardContent className="pt-4 pb-3">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                Paused
              </p>
              <p className="text-xl font-semibold mt-0.5 text-orange-400">
                {stats.paused}
              </p>
            </CardContent>
          </Card>
          <Card className="border-border/50 bg-card">
            <CardContent className="pt-4 pb-3">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                Cancelled
              </p>
              <p className="text-xl font-semibold mt-0.5 text-red-400">
                {stats.cancelled}
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Tabs: Campaigns / Templates */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <div className="flex items-center justify-between">
          <TabsList className="bg-muted/30">
            <TabsTrigger value="campaigns" className="gap-1.5 text-xs">
              <Send className="h-3.5 w-3.5" />
              Campaigns
            </TabsTrigger>
            <TabsTrigger value="templates" className="gap-1.5 text-xs">
              <FileText className="h-3.5 w-3.5" />
              Templates
            </TabsTrigger>
          </TabsList>
          <div className="flex gap-2">
            {activeTab === "campaigns" && (
              <Button
                size="sm"
                className="gap-1.5 h-8"
                onClick={() => setCreateOpen(true)}
              >
                <Plus className="h-3.5 w-3.5" />
                New Campaign
              </Button>
            )}
            {activeTab === "templates" && (
              <Button
                size="sm"
                className="gap-1.5 h-8"
                onClick={() => setTemplateOpen(true)}
              >
                <Plus className="h-3.5 w-3.5" />
                New Template
              </Button>
            )}
          </div>
        </div>

        {/* Campaigns Tab */}
        <TabsContent value="campaigns" className="mt-4 space-y-4">
          {/* Search & Filters */}
          <div className="flex items-center gap-2">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Search campaigns..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(0);
                }}
                className="pl-8 h-9 text-sm border-border/50"
              />
            </div>
            <Select
              value={statusFilter || "all"}
              onValueChange={(v) => {
                setStatusFilter(v === "all" ? "" : v);
                setPage(0);
              }}
            >
              <SelectTrigger className="w-[140px] h-9 text-sm border-border/50">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="scheduled">Scheduled</SelectItem>
                <SelectItem value="sending">Sending</SelectItem>
                <SelectItem value="sent">Sent</SelectItem>
                <SelectItem value="paused">Paused</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
              </SelectContent>
            </Select>
            <Select
              value={typeFilter || "all"}
              onValueChange={(v) => {
                setTypeFilter(v === "all" ? "" : v);
                setPage(0);
              }}
            >
              <SelectTrigger className="w-[120px] h-9 text-sm border-border/50">
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="email">Email</SelectItem>
                <SelectItem value="sms">SMS</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Campaigns Table */}
          <Card className="border-border/50 bg-card">
            <Table>
              <TableHeader>
                <TableRow className="border-border/30 hover:bg-transparent">
                  <TableHead className="text-xs">Name</TableHead>
                  <TableHead className="text-xs">Type</TableHead>
                  <TableHead className="text-xs">Status</TableHead>
                  <TableHead className="text-xs">Recipients</TableHead>
                  <TableHead className="text-xs">Sent</TableHead>
                  <TableHead className="text-xs">Delivered</TableHead>
                  <TableHead className="text-xs">Created</TableHead>
                  <TableHead className="text-xs w-[50px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {campaignsLoading ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8">
                      <Loader2 className="h-5 w-5 animate-spin mx-auto text-muted-foreground" />
                    </TableCell>
                  </TableRow>
                ) : campaigns.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={8}
                      className="text-center py-8 text-muted-foreground"
                    >
                      No campaigns found. Create one to get started.
                    </TableCell>
                  </TableRow>
                ) : (
                  campaigns.map((c: any) => (
                    <TableRow
                      key={c.id}
                      className="border-border/20 cursor-pointer hover:bg-muted/20"
                      onClick={() =>
                        navigate(`/campaigns/${c.id}?accountId=${accountId}`)
                      }
                    >
                      <TableCell className="font-medium text-sm">
                        {c.name}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={`text-[10px] ${
                            c.type === "email"
                              ? "bg-blue-500/10 text-blue-400 border-blue-500/30"
                              : "bg-purple-500/10 text-purple-400 border-purple-500/30"
                          }`}
                        >
                          {c.type === "email" ? (
                            <Mail className="h-2.5 w-2.5 mr-0.5" />
                          ) : (
                            <MessageSquare className="h-2.5 w-2.5 mr-0.5" />
                          )}
                          {c.type.toUpperCase()}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={`text-[10px] capitalize ${STATUS_COLORS[c.status] || ""}`}
                        >
                          {c.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {c.totalRecipients}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {c.sentCount}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {c.deliveredCount}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {new Date(c.createdAt).toLocaleDateString()}
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 w-7 p-0"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <MoreHorizontal className="h-3.5 w-3.5" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            {c.status === "draft" && (
                              <DropdownMenuItem
                                onClick={(e) => {
                                  e.stopPropagation();
                                  sendMutation.mutate({
                                    id: c.id,
                                    accountId: accountId!,
                                  });
                                }}
                              >
                                <Play className="h-3.5 w-3.5 mr-2" />
                                Send Now
                              </DropdownMenuItem>
                            )}
                            {(c.status === "sending" ||
                              c.status === "scheduled") && (
                              <DropdownMenuItem
                                onClick={(e) => {
                                  e.stopPropagation();
                                  pauseMutation.mutate({
                                    id: c.id,
                                    accountId: accountId!,
                                  });
                                }}
                              >
                                <Pause className="h-3.5 w-3.5 mr-2" />
                                Pause
                              </DropdownMenuItem>
                            )}
                            {c.status !== "cancelled" &&
                              c.status !== "sent" && (
                                <DropdownMenuItem
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    cancelMutation.mutate({
                                      id: c.id,
                                      accountId: accountId!,
                                    });
                                  }}
                                >
                                  <XCircle className="h-3.5 w-3.5 mr-2" />
                                  Cancel
                                </DropdownMenuItem>
                              )}
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              className="text-destructive"
                              onClick={(e) => {
                                e.stopPropagation();
                                if (
                                  confirm(
                                    "Delete this campaign? This cannot be undone."
                                  )
                                ) {
                                  deleteMutation.mutate({
                                    id: c.id,
                                    accountId: accountId!,
                                  });
                                }
                              }}
                            >
                              <Trash2 className="h-3.5 w-3.5 mr-2" />
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
          </Card>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">
                Showing {page * pageSize + 1}–
                {Math.min((page + 1) * pageSize, totalCampaigns)} of{" "}
                {totalCampaigns}
              </p>
              <div className="flex gap-1">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 w-7 p-0 border-border/50"
                  disabled={page === 0}
                  onClick={() => setPage((p) => p - 1)}
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 w-7 p-0 border-border/50"
                  disabled={page >= totalPages - 1}
                  onClick={() => setPage((p) => p + 1)}
                >
                  <ChevronRight className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          )}
        </TabsContent>

        {/* Templates Tab */}
        <TabsContent value="templates" className="mt-4 space-y-4">
          <Card className="border-border/50 bg-card">
            <Table>
              <TableHeader>
                <TableRow className="border-border/30 hover:bg-transparent">
                  <TableHead className="text-xs">Name</TableHead>
                  <TableHead className="text-xs">Type</TableHead>
                  <TableHead className="text-xs">Subject</TableHead>
                  <TableHead className="text-xs">Preview</TableHead>
                  <TableHead className="text-xs">Updated</TableHead>
                  <TableHead className="text-xs w-[50px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {!templates || templates.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={6}
                      className="text-center py-8 text-muted-foreground"
                    >
                      No templates yet. Create one to speed up campaign
                      creation.
                    </TableCell>
                  </TableRow>
                ) : (
                  templates.map((t: any) => (
                    <TableRow
                      key={t.id}
                      className="border-border/20 hover:bg-muted/20"
                    >
                      <TableCell className="font-medium text-sm">
                        {t.name}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={`text-[10px] ${
                            t.type === "email"
                              ? "bg-blue-500/10 text-blue-400 border-blue-500/30"
                              : "bg-purple-500/10 text-purple-400 border-purple-500/30"
                          }`}
                        >
                          {t.type.toUpperCase()}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {t.subject || "—"}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground max-w-[200px] truncate">
                        {t.body.slice(0, 60)}
                        {t.body.length > 60 ? "..." : ""}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {new Date(t.updatedAt).toLocaleDateString()}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                          onClick={() => {
                            if (
                              confirm("Delete this template?")
                            ) {
                              deleteTemplateMutation.mutate({
                                id: t.id,
                                accountId: accountId!,
                              });
                            }
                          }}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Campaign Builder Wizard */}
      {accountId && (
        <CampaignBuilder
          open={createOpen}
          onOpenChange={setCreateOpen}
          accountId={accountId}
        />
      )}

      {/* Create Template Dialog */}
      {accountId && (
        <CreateTemplateDialog
          open={templateOpen}
          onOpenChange={setTemplateOpen}
          accountId={accountId}
        />
      )}
    </div>
  );
}

// ─────────────────────────────────────────────
// CREATE TEMPLATE DIALOG
// ─────────────────────────────────────────────

function CreateTemplateDialog({
  open,
  onOpenChange,
  accountId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  accountId: number;
}) {
  const utils = trpc.useUtils();
  const [name, setName] = useState("");
  const [type, setType] = useState<"email" | "sms">("email");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");

  const createMutation = trpc.campaigns.templates.create.useMutation({
    onSuccess: () => {
      utils.campaigns.templates.list.invalidate();
      toast.success("Template created");
      setName("");
      setType("email");
      setSubject("");
      setBody("");
      onOpenChange(false);
    },
    onError: (e) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Create Template</DialogTitle>
          <DialogDescription>
            Save a reusable message template for campaigns.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs">Template Name *</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Welcome Email"
                className="h-9 text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Type *</Label>
              <Select
                value={type}
                onValueChange={(v) => setType(v as "email" | "sms")}
              >
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="email">Email</SelectItem>
                  <SelectItem value="sms">SMS</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          {type === "email" && (
            <div className="space-y-1.5">
              <Label className="text-xs">Subject</Label>
              <Input
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Email subject line"
                className="h-9 text-sm"
              />
            </div>
          )}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label className="text-xs">Body *</Label>
              <div className="flex gap-1">
                {MERGE_TAGS.map((mt) => (
                  <Button
                    key={mt.tag}
                    variant="outline"
                    size="sm"
                    className="h-6 text-[10px] px-1.5 border-border/50"
                    onClick={() => setBody((b) => b + mt.tag)}
                  >
                    {mt.label}
                  </Button>
                ))}
              </div>
            </div>
            <Textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Write your template content... Use merge tags for personalization."
              className="min-h-[120px] text-sm resize-none"
            />
          </div>
        </div>
        <DialogFooter>
          <Button
            size="sm"
            className="gap-1.5"
            disabled={!name.trim() || !body.trim() || createMutation.isPending}
            onClick={() =>
              createMutation.mutate({
                accountId,
                name,
                type,
                subject: type === "email" ? subject : undefined,
                body,
              })
            }
          >
            {createMutation.isPending && (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            )}
            Create Template
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
