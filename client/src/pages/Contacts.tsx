import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import {
  ChevronLeft,
  ChevronRight,
  Filter,
  Loader2,
  MoreHorizontal,
  Plus,
  Search,
  Trash2,
  UserPlus,
  Eye,
  Pencil,
  PhoneForwarded,
  X,
  Users,
  Share2,
  Columns3,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Download,
  SlidersHorizontal,
  Bookmark,
  BookmarkCheck,
  GitMerge,
  Zap,
  TrendingUp,
  ListFilter,
  FolderOpen,
  RefreshCw,
  LayoutList,
  Sparkles,
} from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useState, useMemo } from "react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useLocation } from "wouter";
import { toast } from "sonner";
import { useAccount } from "@/contexts/AccountContext";
import { NoAccountSelected } from "@/components/NoAccountSelected";
import { CsvImportModal } from "@/components/CsvImportModal";

const STATUSES = [
  "new",
  "contacted",
  "qualified",
  "proposal",
  "negotiation",
  "won",
  "lost",
  "nurture",
] as const;

// ─── Lead Score Tier Helpers ───
function getScoreTier(score: number) {
  if (score >= 80) return { label: "On Fire", color: "text-red-600", bg: "bg-red-50 border-red-200", icon: "🔥" };
  if (score >= 50) return { label: "Hot", color: "text-orange-600", bg: "bg-orange-50 border-orange-200", icon: "🟠" };
  if (score >= 20) return { label: "Warm", color: "text-amber-600", bg: "bg-amber-50 border-amber-200", icon: "🟡" };
  return { label: "Cold", color: "text-slate-500", bg: "bg-slate-50 border-slate-200", icon: "🔵" };
}

function LeadScoreBadge({ score }: { score: number }) {
  const tier = getScoreTier(score);
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold border ${tier.bg} ${tier.color}`}>
            <Zap className="h-3 w-3" />
            {score}
          </div>
        </TooltipTrigger>
        <TooltipContent side="top">
          <p className="text-xs">{tier.label} Lead ({score} pts)</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

const STATUS_COLORS: Record<string, string> = {
  new: "bg-blue-50 text-blue-700 border-blue-200",
  contacted: "bg-amber-50 text-amber-700 border-amber-200",
  qualified: "bg-emerald-50 text-emerald-700 border-emerald-200",
  proposal: "bg-purple-50 text-purple-700 border-purple-200",
  negotiation: "bg-orange-50 text-orange-700 border-orange-200",
  won: "bg-green-50 text-green-700 border-green-200",
  lost: "bg-red-50 text-red-700 border-red-200",
  nurture: "bg-cyan-50 text-cyan-700 border-cyan-200",
};

const LEAD_SOURCES = [
  "Facebook",
  "Instagram",
  "Google Ads",
  "TikTok",
  "Website",
  "Referral",
  "Social Media",
  "Cold Call",
  "Email Campaign",
  "Advertisement",
  "Walk-in",
  "Partner",
  "Event",
  "Other",
];

export default function Contacts() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const utils = trpc.useUtils();
  const { currentAccountId: accountId, isLoading: accountsLoading, accounts: userAccounts } = useAccount();

  // Filters
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [sourceFilter, setSourceFilter] = useState<string>("");
  const [showFilters, setShowFilters] = useState(false);
  const [scoreMin, setScoreMin] = useState<string>("");
  const [scoreMax, setScoreMax] = useState<string>("");
  const [page, setPage] = useState(0);
  const pageSize = 25;

  // Selection state
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

  // Distribute leads dialog
  const [distributeOpen, setDistributeOpen] = useState(false);
  const [bulkAssignOpen, setBulkAssignOpen] = useState(false);
  const [bulkAssignUserId, setBulkAssignUserId] = useState<string>("");

  // Bulk edit custom field
  const [bulkEditCfOpen, setBulkEditCfOpen] = useState(false);
  const [bulkEditSlug, setBulkEditSlug] = useState("");
  const [bulkEditValue, setBulkEditValue] = useState<string>("");
  // Enroll in sequence
  const [enrollDialogOpen, setEnrollDialogOpen] = useState(false);
  const [enrollSequenceId, setEnrollSequenceId] = useState<string>("");

  // Smart Views
  const [saveViewOpen, setSaveViewOpen] = useState(false);
  const [saveViewName, setSaveViewName] = useState("");
  const [activeViewId, setActiveViewId] = useState<number | null>(null);
  const [viewsOpen, setViewsOpen] = useState(false);

  // Smart Lists (Segments)
  const [segmentsOpen, setSegmentsOpen] = useState(false);
  const [activeSegmentId, setActiveSegmentId] = useState<number | null>(null);
  const [saveSegmentOpen, setSaveSegmentOpen] = useState(false);
  const [saveSegmentName, setSaveSegmentName] = useState("");
  const [saveSegmentDesc, setSaveSegmentDesc] = useState("");
  const [saveSegmentColor, setSaveSegmentColor] = useState("blue");
  const [editSegmentId, setEditSegmentId] = useState<number | null>(null);
  const [editSegmentName, setEditSegmentName] = useState("");
  const [deleteSegmentConfirm, setDeleteSegmentConfirm] = useState<number | null>(null);

  // Column customization
  const [sortBy, setSortBy] = useState<string>("");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [cfFilters, setCfFilters] = useState<Array<{ slug: string; operator: string; value: string }>>([]);
  const [columnsOpen, setColumnsOpen] = useState(false);
  const [cfFilterSlug, setCfFilterSlug] = useState("");
  const [cfFilterOp, setCfFilterOp] = useState("equals");
  const [cfFilterVal, setCfFilterVal] = useState("");

  // Custom field definitions for this account
  const { data: fieldDefs = [] } = trpc.customFields.list.useQuery(
    { accountId: accountId! },
    { enabled: !!accountId }
  );
  const activeFieldDefs = useMemo(() => fieldDefs.filter((f) => f.isActive), [fieldDefs]);

  // Column preferences
  const { data: colPrefs } = trpc.columnPreferences.get.useQuery(
    { accountId: accountId!, page: "contacts" },
    { enabled: !!accountId }
  );
  const saveColPrefsMut = trpc.columnPreferences.save.useMutation({
    onSuccess: () => utils.columnPreferences.get.invalidate({ accountId: accountId!, page: "contacts" }),
  });

  // Visible custom field columns (stored as column objects with key/visible)
  const visibleCfColumns = useMemo(() => {
    if (!colPrefs?.columns || !Array.isArray(colPrefs.columns)) {
      return activeFieldDefs.slice(0, 3).map((f) => f.slug);
    }
    // Extract cf_ keys that are visible
    const cfCols = colPrefs.columns
      .filter((c: any) => c.key?.startsWith("cf_") && c.visible)
      .map((c: any) => c.key.slice(3));
    return cfCols.length > 0 ? cfCols : activeFieldDefs.slice(0, 3).map((f) => f.slug);
  }, [colPrefs, activeFieldDefs]);

  function toggleCfColumn(slug: string) {
    const currentCols = Array.isArray(colPrefs?.columns) ? colPrefs.columns : [];
    const cfKey = `cf_${slug}`;
    const exists = currentCols.find((c: any) => c.key === cfKey);
    let nextCols;
    if (exists) {
      nextCols = currentCols.map((c: any) =>
        c.key === cfKey ? { ...c, visible: !c.visible } : c
      );
    } else {
      nextCols = [...currentCols, { key: cfKey, visible: true, sortOrder: currentCols.length }];
    }
    saveColPrefsMut.mutate({ accountId: accountId!, page: "contacts", columns: nextCols });
  }

  // Stable cfFilters for query
  const stableCfFilters = useMemo(() => {
    if (cfFilters.length === 0) return undefined;
    return cfFilters.map((f) => ({
      slug: f.slug,
      operator: f.operator as "equals" | "not_equals" | "contains" | "greater_than" | "less_than" | "is_empty" | "is_not_empty",
      value: f.value || undefined,
    }));
  }, [cfFilters]);

  // Contacts query
  const { data: contactsData, isLoading: contactsLoading } =
    trpc.contacts.list.useQuery(
      {
        accountId: accountId!,
        search: search || undefined,
        status: (statusFilter as any) || undefined,
        leadSource: sourceFilter || undefined,
        limit: pageSize,
        offset: page * pageSize,
        sortBy: sortBy || undefined,
        sortDir: sortBy ? sortDir : undefined,
        customFieldFilters: stableCfFilters,
        leadScoreMin: scoreMin ? parseInt(scoreMin, 10) : undefined,
        leadScoreMax: scoreMax ? parseInt(scoreMax, 10) : undefined,
      },
      { enabled: !!accountId }
    );

  // CSV export
  const [exportTriggered, setExportTriggered] = useState(false);
  const { data: exportData, isFetching: exportLoading } = trpc.contacts.exportContacts.useQuery(
    { accountId: accountId! },
    { enabled: !!accountId && exportTriggered, refetchOnWindowFocus: false }
  );

  // Handle export data when it arrives
  useMemo(() => {
    if (exportData && exportTriggered) {
      const headers = exportData.headers || [];
      const rows = exportData.rows || [];
      if (headers.length > 0) {
        const csvLines = [headers.join(",")];
        for (const row of rows) {
          csvLines.push(row.map((cell: string) => `"${(cell || "").replace(/"/g, '""')}"`).join(","));
        }
        const blob = new Blob([csvLines.join("\n")], { type: "text/csv" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `contacts_export_${new Date().toISOString().slice(0, 10)}.csv`;
        a.click();
        URL.revokeObjectURL(url);
        toast.success(`Exported ${rows.length} contacts`);
      }
      setExportTriggered(false);
    }
  }, [exportData, exportTriggered]);

  // Members for assignment
  const { data: members } = trpc.members.list.useQuery(
    { accountId: accountId! },
    { enabled: !!accountId }
  );

  // Dialogs
  const [createOpen, setCreateOpen] = useState(false);
  const [editContact, setEditContact] = useState<any>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<any>(null);
  const [importOpen, setImportOpen] = useState(false);

  // Create mutation
  const createMutation = trpc.contacts.create.useMutation({
    onSuccess: () => {
      toast.success("Contact created");
      utils.contacts.list.invalidate();
      utils.contacts.stats.invalidate();
      setCreateOpen(false);
    },
    onError: (err) => toast.error(err.message),
  });

  // Update mutation
  const updateMutation = trpc.contacts.update.useMutation({
    onSuccess: () => {
      toast.success("Contact updated");
      utils.contacts.list.invalidate();
      setEditContact(null);
    },
    onError: (err) => toast.error(err.message),
  });

  // Delete mutation
  const deleteMutation = trpc.contacts.delete.useMutation({
    onSuccess: () => {
      toast.success("Contact deleted");
      utils.contacts.list.invalidate();
      utils.contacts.stats.invalidate();
      setDeleteConfirm(null);
    },
    onError: (err) => toast.error(err.message),
  });

  // Assign mutation
  const assignMutation = trpc.contacts.assign.useMutation({
    onSuccess: () => {
      toast.success("Contact assigned");
      utils.contacts.list.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  const startAICallMutation = trpc.aiCalls.start.useMutation({
    onSuccess: () => {
      toast.success("AI call initiated successfully");
    },
    onError: (err) => toast.error(err.message),
  });

  // Smart Views queries
  const { data: savedViews = [] } = trpc.savedViews.list.useQuery(
    { accountId: accountId! },
    { enabled: !!accountId }
  );
  const saveViewMut = trpc.savedViews.create.useMutation({
    onSuccess: (data) => {
      toast.success(`View "${saveViewName}" saved`);
      utils.savedViews.list.invalidate();
      setSaveViewOpen(false);
      setSaveViewName("");
      setActiveViewId(data.id);
    },
    onError: (err) => toast.error(err.message),
  });
  const deleteViewMut = trpc.savedViews.delete.useMutation({
    onSuccess: () => {
      toast.success("View deleted");
      utils.savedViews.list.invalidate();
      setActiveViewId(null);
    },
    onError: (err) => toast.error(err.message),
  });

  function applyView(view: typeof savedViews[0]) {
    const filters = view.filters as any;
    setSearch(filters?.search || "");
    setStatusFilter(filters?.status || "");
    setSourceFilter(filters?.source || "");
    setCfFilters(filters?.customFieldFilters || []);
    setScoreMin(filters?.leadScoreMin !== undefined ? String(filters.leadScoreMin) : "");
    setScoreMax(filters?.leadScoreMax !== undefined ? String(filters.leadScoreMax) : "");
    setSortBy(view.sortBy || "");
    setSortDir((view.sortDir as "asc" | "desc") || "desc");
    setActiveViewId(view.id);
    setPage(0);
  }

  function clearView() {
    setSearch("");
    setStatusFilter("");
    setSourceFilter("");
    setCfFilters([]);
    setScoreMin("");
    setScoreMax("");
    setSortBy("");
    setSortDir("desc");
    setActiveViewId(null);
    setPage(0);
  }

  // ─── Smart Lists (Segments) ───
  const { data: segments = [], isLoading: segmentsLoading } = trpc.segments.list.useQuery(
    { accountId: accountId! },
    { enabled: !!accountId }
  );

  const createSegmentMut = trpc.segments.create.useMutation({
    onSuccess: (data) => {
      toast.success(`Smart List "${saveSegmentName}" created with ${data.contactCount} contacts`);
      utils.segments.list.invalidate();
      setSaveSegmentOpen(false);
      setSaveSegmentName("");
      setSaveSegmentDesc("");
      setSaveSegmentColor("blue");
    },
    onError: (err) => toast.error(err.message),
  });

  const updateSegmentMut = trpc.segments.update.useMutation({
    onSuccess: () => {
      toast.success("Smart List updated");
      utils.segments.list.invalidate();
      setEditSegmentId(null);
      setEditSegmentName("");
    },
    onError: (err) => toast.error(err.message),
  });

  const deleteSegmentMut = trpc.segments.delete.useMutation({
    onSuccess: () => {
      toast.success("Smart List deleted");
      utils.segments.list.invalidate();
      if (activeSegmentId === deleteSegmentConfirm) {
        clearSegment();
      }
      setDeleteSegmentConfirm(null);
    },
    onError: (err) => toast.error(err.message),
  });

  const refreshSegmentMut = trpc.segments.refreshCount.useMutation({
    onSuccess: () => {
      utils.segments.list.invalidate();
      toast.success("Count refreshed");
    },
  });

  function applySegment(segment: typeof segments[0]) {
    const fc = segment.filterConfig as any;
    setSearch(fc?.search || "");
    setStatusFilter(fc?.status || "");
    setSourceFilter(fc?.leadSource || "");
    setCfFilters(fc?.customFieldFilters || []);
    setScoreMin(fc?.leadScoreMin !== undefined ? String(fc.leadScoreMin) : "");
    setScoreMax(fc?.leadScoreMax !== undefined ? String(fc.leadScoreMax) : "");
    setSortBy("");
    setSortDir("desc");
    setActiveSegmentId(segment.id);
    setActiveViewId(null);
    setPage(0);
  }

  function clearSegment() {
    setSearch("");
    setStatusFilter("");
    setSourceFilter("");
    setCfFilters([]);
    setScoreMin("");
    setScoreMax("");
    setSortBy("");
    setSortDir("desc");
    setActiveSegmentId(null);
    setPage(0);
  }

  function buildCurrentFilterConfig() {
    const config: Record<string, unknown> = {};
    if (statusFilter) config.status = statusFilter;
    if (sourceFilter) config.leadSource = sourceFilter;
    if (search) config.search = search;
    if (cfFilters.length > 0) {
      config.customFieldFilters = cfFilters.map((f) => ({
        slug: f.slug,
        operator: f.operator,
        value: f.value,
      }));
    }
    if (scoreMin) config.leadScoreMin = parseInt(scoreMin, 10);
    if (scoreMax) config.leadScoreMax = parseInt(scoreMax, 10);
    return config;
  }

  const SEGMENT_COLORS = [
    { value: "blue", label: "Blue", class: "bg-blue-500" },
    { value: "green", label: "Green", class: "bg-green-500" },
    { value: "orange", label: "Orange", class: "bg-orange-500" },
    { value: "red", label: "Red", class: "bg-red-500" },
    { value: "purple", label: "Purple", class: "bg-purple-500" },
    { value: "pink", label: "Pink", class: "bg-pink-500" },
    { value: "cyan", label: "Cyan", class: "bg-cyan-500" },
    { value: "amber", label: "Amber", class: "bg-amber-500" },
  ];

  function getSegmentColorClass(color: string | null) {
    return SEGMENT_COLORS.find((c) => c.value === color)?.class || "bg-blue-500";
  }

  // Bulk edit custom field mutation
  const bulkEditCfMutation = trpc.contacts.bulkUpdateCustomField.useMutation({
    onSuccess: (data) => {
      toast.success(`Updated ${data.updatedCount} contacts`);
      utils.contacts.list.invalidate();
      setBulkEditCfOpen(false);
      setBulkEditSlug("");
      setBulkEditValue("");
      setSelectedIds(new Set());
    },
    onError: (err) => toast.error(err.message),
  });

  // Bulk assign mutation
  const bulkAssignMutation = trpc.contacts.bulkAssign.useMutation({
    onSuccess: (data) => {
      toast.success(`${data.updated} contacts assigned`);
      utils.contacts.list.invalidate();
      setSelectedIds(new Set());
      setBulkAssignOpen(false);
      setBulkAssignUserId("");
    },
    onError: (err) => toast.error(err.message),
  });

  // Distribute leads mutation
  const distributeMutation = trpc.contacts.distributeLeads.useMutation({
    onSuccess: (data) => {
      const summary = data.distribution.map((d) => {
        const member = members?.find((m) => m.userId === d.userId);
        return `${member?.userName || "User"}: ${d.count}`;
      }).join(", ");
      toast.success(`Leads distributed: ${summary}`);
      utils.contacts.list.invalidate();
      setSelectedIds(new Set());
      setDistributeOpen(false);
    },
    onError: (err) => toast.error(err.message),
  });

  // Stats
  const { data: stats } = trpc.contacts.stats.useQuery(
    { accountId: accountId! },
    { enabled: !!accountId }
  );

  const contacts = contactsData?.data ?? [];
  const total = contactsData?.total ?? 0;
  const totalPages = Math.ceil(total / pageSize);

  // Selection helpers
  const currentPageIds = useMemo(() => contacts.map((c) => c.id), [contacts]);
  const allOnPageSelected = currentPageIds.length > 0 && currentPageIds.every((id) => selectedIds.has(id));
  const someOnPageSelected = currentPageIds.some((id) => selectedIds.has(id));

  const toggleSelectAll = () => {
    if (allOnPageSelected) {
      const next = new Set(selectedIds);
      currentPageIds.forEach((id) => next.delete(id));
      setSelectedIds(next);
    } else {
      const next = new Set(selectedIds);
      currentPageIds.forEach((id) => next.add(id));
      setSelectedIds(next);
    }
  };

  const toggleSelect = (id: number) => {
    const next = new Set(selectedIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setSelectedIds(next);
  };

  if (!accountId) {
    return <NoAccountSelected />;
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-[28px] font-bold tracking-tight text-foreground">Contacts</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {total} contact{total !== 1 ? "s" : ""} in this account
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto justify-start sm:justify-end">
          <a href="/contacts/merge">
            <Button variant="outline" size="sm" className="h-9 gap-1.5">
              <GitMerge className="h-3.5 w-3.5" />
              Merge Duplicates
            </Button>
          </a>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setExportTriggered(true)}
            disabled={exportLoading}
            className="h-9 gap-1.5"
          >
            <Download className="h-3.5 w-3.5" />
            {exportLoading ? "Exporting..." : "Export CSV"}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setImportOpen(true)}
            className="h-9 gap-1.5"
          >
            <UserPlus className="h-3.5 w-3.5" />
            Import CSV
          </Button>
          <Button
            size="sm"
            onClick={() => setCreateOpen(true)}
            className="h-9 gap-1.5"
          >
            <Plus className="h-3.5 w-3.5" />
            Add Contact
          </Button>
        </div>
      </div>

      {/* Stats Row */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-2 sm:grid-cols-4 gap-3">
          <MiniStat label="Total" value={stats.total} />
          <MiniStat label="New" value={stats.new} color="text-blue-600" />
          <MiniStat
            label="Qualified"
            value={stats.qualified}
            color="text-emerald-600"
          />
          <MiniStat label="Won" value={stats.won} color="text-green-600" />
        </div>
      )}

      {/* Bulk Action Bar */}
      {selectedIds.size > 0 && (
        <div className="flex items-center gap-3 p-3 rounded-lg bg-primary/5 border border-primary/20">
          <Badge variant="secondary" className="text-sm font-medium">
            {selectedIds.size} selected
          </Badge>
          <div className="flex items-center gap-2 ml-auto">
            <Button
              variant="outline"
              size="sm"
              className="h-8 gap-1.5"
              onClick={() => setBulkAssignOpen(true)}
            >
              <Users className="h-3.5 w-3.5" />
              Assign To
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-8 gap-1.5"
              onClick={() => setDistributeOpen(true)}
            >
              <Share2 className="h-3.5 w-3.5" />
              Distribute
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-8 gap-1.5"
              onClick={() => setEnrollDialogOpen(true)}
            >
              <ListFilter className="h-3.5 w-3.5" />
              Enroll in Sequence
            </Button>
            {activeFieldDefs.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                className="h-8 gap-1.5"
                onClick={() => setBulkEditCfOpen(true)}
              >
                <Pencil className="h-3.5 w-3.5" />
                Edit Field
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              className="h-8 text-xs"
              onClick={() => setSelectedIds(new Set())}
            >
              Clear
            </Button>
          </div>
        </div>
      )}

      {/* Smart Views Bar */}
      {savedViews.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-medium text-muted-foreground">Views:</span>
          {savedViews.map((v) => (
            <div key={v.id} className="flex items-center gap-0.5">
              <Button
                variant={activeViewId === v.id ? "secondary" : "ghost"}
                size="sm"
                className={`h-7 text-xs gap-1 ${activeViewId === v.id ? "bg-primary/10 text-primary" : ""}`}
                onClick={() => applyView(v)}
              >
                {activeViewId === v.id ? <BookmarkCheck className="h-3 w-3" /> : <Bookmark className="h-3 w-3" />}
                {v.name}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
                onClick={() => {
                  if (confirm(`Delete view "${v.name}"?`)) {
                    deleteViewMut.mutate({ id: v.id, accountId: accountId! });
                  }
                }}
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
          ))}
          {activeViewId && (
            <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={clearView}>
              Clear View
            </Button>
          )}
        </div>
      )}

      {/* Smart Lists Bar */}
      <div className="flex items-center gap-2 flex-wrap">
        <Button
          variant={segmentsOpen ? "secondary" : "outline"}
          size="sm"
          className="h-8 gap-1.5 text-xs"
          onClick={() => setSegmentsOpen(!segmentsOpen)}
        >
          <LayoutList className="h-3.5 w-3.5" />
          Smart Lists
          {segments.length > 0 && (
            <Badge variant="secondary" className="h-4 px-1.5 text-[10px] ml-0.5">
              {segments.length}
            </Badge>
          )}
        </Button>
        {activeSegmentId && (
          <>
            <Badge variant="outline" className="h-7 gap-1 text-xs font-medium bg-primary/5 border-primary/20 text-primary">
              <ListFilter className="h-3 w-3" />
              {segments.find((s) => s.id === activeSegmentId)?.name || "Segment"}
            </Badge>
            <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={clearSegment}>
              <X className="h-3 w-3 mr-1" /> Clear
            </Button>
          </>
        )}
        {segments.filter((s) => !s.isPreset).slice(0, 5).map((seg) => (
          <Button
            key={seg.id}
            variant={activeSegmentId === seg.id ? "secondary" : "ghost"}
            size="sm"
            className={`h-7 text-xs gap-1.5 ${activeSegmentId === seg.id ? "bg-primary/10 text-primary" : ""}`}
            onClick={() => applySegment(seg)}
          >
            <div className={`h-2 w-2 rounded-full ${getSegmentColorClass(seg.color)}`} />
            {seg.name}
            <span className="text-muted-foreground">({seg.contactCount})</span>
          </Button>
        ))}
      </div>

      {/* Smart Lists Expanded Panel */}
      {segmentsOpen && (
        <Card className="border-border/50">
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <LayoutList className="h-4 w-4 text-primary" />
                <h3 className="text-sm font-semibold">Smart Lists</h3>
                <span className="text-xs text-muted-foreground">({segments.length})</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs gap-1"
                  onClick={() => setSaveSegmentOpen(true)}
                >
                  <Plus className="h-3 w-3" />
                  Save Current Filters
                </Button>
              </div>
            </div>

            {segmentsLoading ? (
              <div className="flex items-center justify-center py-6">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : segments.length === 0 ? (
              <div className="text-center py-6">
                <FolderOpen className="h-8 w-8 text-muted-foreground/50 mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">No Smart Lists yet</p>
                <p className="text-xs text-muted-foreground/70 mt-1">Apply filters and save them as a Smart List for quick access</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                {segments.map((seg) => (
                  <div
                    key={seg.id}
                    className={`group relative flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all hover:bg-muted/50 ${
                      activeSegmentId === seg.id ? "border-primary/40 bg-primary/5" : "border-border/50"
                    }`}
                    onClick={() => applySegment(seg)}
                  >
                    <div className={`h-8 w-8 rounded-lg flex items-center justify-center text-white text-xs font-bold ${getSegmentColorClass(seg.color)}`}>
                      {seg.contactCount}
                    </div>
                    <div className="flex-1 min-w-0">
                      {editSegmentId === seg.id ? (
                        <Input
                          value={editSegmentName}
                          onChange={(e) => setEditSegmentName(e.target.value)}
                          className="h-6 text-xs px-1"
                          autoFocus
                          onClick={(e) => e.stopPropagation()}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" && editSegmentName.trim()) {
                              updateSegmentMut.mutate({
                                id: seg.id,
                                accountId: accountId!,
                                name: editSegmentName.trim(),
                              });
                            }
                            if (e.key === "Escape") {
                              setEditSegmentId(null);
                            }
                          }}
                        />
                      ) : (
                        <p className="text-sm font-medium truncate">{seg.name}</p>
                      )}
                      {seg.description && (
                        <p className="text-[11px] text-muted-foreground truncate">{seg.description}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0"
                        onClick={(e) => {
                          e.stopPropagation();
                          refreshSegmentMut.mutate({ id: seg.id, accountId: accountId! });
                        }}
                      >
                        <RefreshCw className={`h-3 w-3 ${refreshSegmentMut.isPending ? "animate-spin" : ""}`} />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0"
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditSegmentId(seg.id);
                          setEditSegmentName(seg.name);
                        }}
                      >
                        <Pencil className="h-3 w-3" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0 text-destructive"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (confirm(`Delete Smart List "${seg.name}"?`)) {
                            deleteSegmentMut.mutate({ id: seg.id, accountId: accountId! });
                          }
                        }}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Search & Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Search contacts..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(0);
            }}
            className="pl-9 h-9 text-sm bg-card border-border/50"
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="absolute right-3 top-1/2 -translate-y-1/2"
            >
              <X className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground" />
            </button>
          )}
        </div>
        <Button
          variant="outline"
          size="sm"
          className="h-9 gap-1.5 border-border/50"
          onClick={() => setShowFilters(!showFilters)}
        >
          <Filter className="h-3.5 w-3.5" />
          Filters
          {(statusFilter || sourceFilter || scoreMin || scoreMax || cfFilters.length > 0) && (
            <Badge
              variant="secondary"
              className="h-4 w-4 p-0 flex items-center justify-center text-[10px] ml-1"
            >
              {(statusFilter ? 1 : 0) + (sourceFilter ? 1 : 0) + (scoreMin || scoreMax ? 1 : 0) + cfFilters.length}
            </Badge>
          )}
        </Button>

        {/* Save View */}
        <Popover open={saveViewOpen} onOpenChange={setSaveViewOpen}>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="h-9 gap-1.5 border-border/50">
              <Bookmark className="h-3.5 w-3.5" />
              Save View
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-64 p-3" align="end">
            <div className="space-y-2">
              <Label className="text-xs font-medium">View Name</Label>
              <Input
                placeholder="e.g. Hot FHA Leads"
                value={saveViewName}
                onChange={(e) => setSaveViewName(e.target.value)}
                className="h-8 text-sm"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && saveViewName.trim()) {
                    saveViewMut.mutate({
                      accountId: accountId!,
                      name: saveViewName.trim(),
                      filters: {
                        search: search || undefined,
                        status: statusFilter || undefined,
                        source: sourceFilter || undefined,
                        customFieldFilters: cfFilters.length > 0
                          ? cfFilters.map((f) => ({ slug: f.slug, operator: f.operator as any, value: f.value }))
                          : undefined,
                        leadScoreMin: scoreMin ? parseInt(scoreMin, 10) : undefined,
                        leadScoreMax: scoreMax ? parseInt(scoreMax, 10) : undefined,
                      },
                      sortBy: sortBy || undefined,
                      sortDir: sortBy ? sortDir : undefined,
                      columns: visibleCfColumns,
                    });
                  }
                }}
              />
              <Button
                size="sm"
                className="w-full h-8 text-xs"
                disabled={!saveViewName.trim() || saveViewMut.isPending}
                onClick={() => {
                  saveViewMut.mutate({
                    accountId: accountId!,
                    name: saveViewName.trim(),
                    filters: {
                      search: search || undefined,
                      status: statusFilter || undefined,
                      source: sourceFilter || undefined,
                      customFieldFilters: cfFilters.length > 0
                        ? cfFilters.map((f) => ({ slug: f.slug, operator: f.operator as any, value: f.value }))
                        : undefined,
                      leadScoreMin: scoreMin ? parseInt(scoreMin, 10) : undefined,
                      leadScoreMax: scoreMax ? parseInt(scoreMax, 10) : undefined,
                    },
                    sortBy: sortBy || undefined,
                    sortDir: sortBy ? sortDir : undefined,
                    columns: visibleCfColumns,
                  });
                }}
              >
                {saveViewMut.isPending ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : null}
                Save Current View
              </Button>
            </div>
          </PopoverContent>
        </Popover>

        {/* Save as Smart List */}
        <Popover open={saveSegmentOpen} onOpenChange={setSaveSegmentOpen}>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="h-9 gap-1.5 border-border/50">
              <Sparkles className="h-3.5 w-3.5" />
              Save Smart List
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-72 p-3" align="end">
            <div className="space-y-3">
              <div className="space-y-1">
                <Label className="text-xs font-medium">Smart List Name</Label>
                <Input
                  placeholder="e.g. Hot Leads, FHA Borrowers"
                  value={saveSegmentName}
                  onChange={(e) => setSaveSegmentName(e.target.value)}
                  className="h-8 text-sm"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-medium">Description (optional)</Label>
                <Input
                  placeholder="Brief description..."
                  value={saveSegmentDesc}
                  onChange={(e) => setSaveSegmentDesc(e.target.value)}
                  className="h-8 text-sm"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-medium">Color</Label>
                <div className="flex items-center gap-1.5">
                  {SEGMENT_COLORS.map((c) => (
                    <button
                      key={c.value}
                      className={`h-6 w-6 rounded-full ${c.class} transition-all ${
                        saveSegmentColor === c.value ? "ring-2 ring-offset-2 ring-primary" : "opacity-60 hover:opacity-100"
                      }`}
                      onClick={() => setSaveSegmentColor(c.value)}
                    />
                  ))}
                </div>
              </div>
              <div className="p-2 rounded bg-muted/50 text-[11px] text-muted-foreground">
                <p className="font-medium mb-1">Current filters will be saved:</p>
                <ul className="space-y-0.5">
                  {statusFilter && <li>Status: {statusFilter}</li>}
                  {sourceFilter && <li>Source: {sourceFilter}</li>}
                  {search && <li>Search: "{search}"</li>}
                  {cfFilters.length > 0 && <li>{cfFilters.length} custom field filter(s)</li>}
                  {(scoreMin || scoreMax) && <li>Score: {scoreMin || '0'} – {scoreMax || '∞'}</li>}
                  {!statusFilter && !sourceFilter && !search && !scoreMin && !scoreMax && cfFilters.length === 0 && (
                    <li className="italic">No filters applied — will match all contacts</li>
                  )}
                </ul>
              </div>
              <Button
                size="sm"
                className="w-full h-8 text-xs"
                disabled={!saveSegmentName.trim() || createSegmentMut.isPending}
                onClick={() => {
                  createSegmentMut.mutate({
                    accountId: accountId!,
                    name: saveSegmentName.trim(),
                    description: saveSegmentDesc.trim() || undefined,
                    filterConfig: buildCurrentFilterConfig(),
                    color: saveSegmentColor,
                  });
                }}
              >
                {createSegmentMut.isPending ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : null}
                Create Smart List
              </Button>
            </div>
          </PopoverContent>
        </Popover>

        {/* Column Picker */}
        {activeFieldDefs.length > 0 && (
          <Popover open={columnsOpen} onOpenChange={setColumnsOpen}>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="h-9 gap-1.5 border-border/50">
                <Columns3 className="h-3.5 w-3.5" />
                Columns
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-56 p-2" align="end">
              <p className="text-xs font-medium text-muted-foreground px-2 py-1.5">Custom Field Columns</p>
              {activeFieldDefs.map((fd) => (
                <label
                  key={fd.slug}
                  className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-muted/50 cursor-pointer text-sm"
                >
                  <Checkbox
                    checked={visibleCfColumns.includes(fd.slug)}
                    onCheckedChange={() => toggleCfColumn(fd.slug)}
                  />
                  <span className="truncate">{fd.name}</span>
                </label>
              ))}
            </PopoverContent>
          </Popover>
        )}
      </div>

      {/* Filter Row */}
      {showFilters && (
        <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-3 p-3 rounded-lg bg-card border border-border/50">
          <Select
            value={statusFilter || "all"}
            onValueChange={(v) => {
              setStatusFilter(v === "all" ? "" : v);
              setPage(0);
            }}
          >
            <SelectTrigger className="w-full sm:w-[150px] h-8 text-xs">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              {STATUSES.map((s) => (
                <SelectItem key={s} value={s}>
                  {s.charAt(0).toUpperCase() + s.slice(1)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={sourceFilter || "all"}
            onValueChange={(v) => {
              setSourceFilter(v === "all" ? "" : v);
              setPage(0);
            }}
          >
            <SelectTrigger className="w-full sm:w-[150px] h-8 text-xs">
              <SelectValue placeholder="Lead Source" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Sources</SelectItem>
              {LEAD_SOURCES.map((s) => (
                <SelectItem key={s} value={s}>
                  {s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {/* Lead Score Range */}
          <div className="h-6 w-px bg-border/50" />
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] font-medium text-muted-foreground whitespace-nowrap">Score:</span>
            <Input
              type="number"
              placeholder="Min"
              value={scoreMin}
              onChange={(e) => { setScoreMin(e.target.value); setPage(0); }}
              className="w-[70px] h-8 text-xs"
              min={0}
            />
            <span className="text-xs text-muted-foreground">–</span>
            <Input
              type="number"
              placeholder="Max"
              value={scoreMax}
              onChange={(e) => { setScoreMax(e.target.value); setPage(0); }}
              className="w-[70px] h-8 text-xs"
              min={0}
            />
          </div>

          {activeFieldDefs.length > 0 && (
            <>
              <div className="h-6 w-px bg-border/50" />
              <Select value={cfFilterSlug || "pick"} onValueChange={(v) => { setCfFilterSlug(v === "pick" ? "" : v); }}>
                <SelectTrigger className="w-full sm:w-[140px] h-8 text-xs">
                  <SelectValue placeholder="Custom Field" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pick">Custom Field...</SelectItem>
                  {activeFieldDefs.map((fd) => (
                    <SelectItem key={fd.slug} value={fd.slug}>{fd.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {cfFilterSlug && (
                <>
                  <Select value={cfFilterOp} onValueChange={setCfFilterOp}>
                    <SelectTrigger className="w-full sm:w-[120px] h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="equals">Equals</SelectItem>
                      <SelectItem value="not_equals">Not Equals</SelectItem>
                      <SelectItem value="contains">Contains</SelectItem>
                      <SelectItem value="greater_than">Greater Than</SelectItem>
                      <SelectItem value="less_than">Less Than</SelectItem>
                      <SelectItem value="is_empty">Is Empty</SelectItem>
                      <SelectItem value="is_not_empty">Is Not Empty</SelectItem>
                    </SelectContent>
                  </Select>
                  {cfFilterOp !== "is_empty" && cfFilterOp !== "is_not_empty" && (
                    <Input
                      placeholder="Value"
                      value={cfFilterVal}
                      onChange={(e) => setCfFilterVal(e.target.value)}
                      className="w-full sm:w-[120px] h-8 text-xs"
                    />
                  )}
                  <Button
                    variant="secondary"
                    size="sm"
                    className="h-8 text-xs"
                    onClick={() => {
                      setCfFilters([...cfFilters, { slug: cfFilterSlug, operator: cfFilterOp, value: cfFilterVal }]);
                      setCfFilterSlug("");
                      setCfFilterOp("equals");
                      setCfFilterVal("");
                      setPage(0);
                    }}
                  >
                    Add Filter
                  </Button>
                </>
              )}
            </>
          )}
          {(statusFilter || sourceFilter || scoreMin || scoreMax || cfFilters.length > 0) && (
            <Button
              variant="ghost"
              size="sm"
              className="h-8 text-xs"
              onClick={() => {
                setStatusFilter("");
                setSourceFilter("");
                setScoreMin("");
                setScoreMax("");
                setCfFilters([]);
                setPage(0);
              }}
            >
              Clear All
            </Button>
          )}
        </div>
        {cfFilters.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {cfFilters.map((f, i) => {
              const fd = activeFieldDefs.find((d) => d.slug === f.slug);
              return (
                <Badge key={i} variant="secondary" className="text-xs gap-1 pr-1">
                  <SlidersHorizontal className="h-2.5 w-2.5" />
                  {fd?.name || f.slug} {f.operator.replace("_", " ")} {f.value || ""}
                  <button
                    onClick={() => { setCfFilters(cfFilters.filter((_, j) => j !== i)); setPage(0); }}
                    className="ml-1 rounded-full hover:bg-muted p-0.5"
                  >
                    <X className="h-2.5 w-2.5" />
                  </button>
                </Badge>
              );
            })}
          </div>
        )}
        </div>
      )}

      {/* Table */}
      <Card className="bg-card border-0 card-shadow overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-secondary hover:bg-secondary border-b border-border">
                <TableHead className="w-[40px]">
                  <Checkbox
                    checked={allOnPageSelected}
                    onCheckedChange={toggleSelectAll}
                    aria-label="Select all contacts on this page"
                  />
                </TableHead>
                <TableHead className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                  Name
                </TableHead>
                <TableHead className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                  Email
                </TableHead>
                <TableHead className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                  Phone
                </TableHead>
                <TableHead className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                  Status
                </TableHead>
                <TableHead className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                  Source
                </TableHead>
                <TableHead
                  className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider cursor-pointer select-none"
                  onClick={() => {
                    if (sortBy === "leadScore") {
                      setSortDir(sortDir === "asc" ? "desc" : "asc");
                    } else {
                      setSortBy("leadScore");
                      setSortDir("desc");
                    }
                  }}
                >
                  <span className="flex items-center gap-1">
                    <Zap className="h-3 w-3" />
                    Score
                    {sortBy === "leadScore" ? (
                      sortDir === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
                    ) : (
                      <ArrowUpDown className="h-3 w-3 opacity-30" />
                    )}
                  </span>
                </TableHead>
                <TableHead className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                  Assigned To
                </TableHead>
                {visibleCfColumns.map((slug) => {
                  const fd = activeFieldDefs.find((d) => d.slug === slug);
                  if (!fd) return null;
                  const isSorted = sortBy === `cf_${slug}`;
                  return (
                    <TableHead
                      key={slug}
                      className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider cursor-pointer select-none"
                      onClick={() => {
                        if (isSorted) {
                          setSortDir(sortDir === "asc" ? "desc" : "asc");
                        } else {
                          setSortBy(`cf_${slug}`);
                          setSortDir("asc");
                        }
                      }}
                    >
                      <span className="flex items-center gap-1">
                        {fd.name}
                        {isSorted ? (
                          sortDir === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
                        ) : (
                          <ArrowUpDown className="h-3 w-3 opacity-30" />
                        )}
                      </span>
                    </TableHead>
                  );
                })}
                <TableHead className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider w-[50px]">
                  Actions
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {contactsLoading ? (
                <TableRow>
                  <TableCell colSpan={9 + visibleCfColumns.length} className="text-center py-12">
                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground mx-auto" />
                  </TableCell>
                </TableRow>
              ) : contacts.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={9 + visibleCfColumns.length}
                    className="text-center py-12 text-muted-foreground text-sm"
                  >
                    {search || statusFilter || sourceFilter
                      ? "No contacts match your filters."
                      : "No contacts yet. Add your first contact to get started."}
                  </TableCell>
                </TableRow>
              ) : (
                contacts.map((contact) => {
                  const assignedMember = members?.find(
                    (m) => m.userId === contact.assignedUserId
                  );
                  const isSelected = selectedIds.has(contact.id);
                  return (
                    <TableRow
                      key={contact.id}
                      className={`border-b border-border/50 cursor-pointer hover:bg-accent h-14 ${isSelected ? "bg-primary/5" : ""}`}
                      onClick={() =>
                        navigate(
                          `/contacts/${contact.id}?account=${accountId}`
                        )
                      }
                    >
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={() => toggleSelect(contact.id)}
                          aria-label={`Select ${contact.firstName} ${contact.lastName}`}
                        />
                      </TableCell>
                      <TableCell className="font-medium text-sm">
                        {contact.firstName} {contact.lastName}
                        {contact.company && (
                          <span className="block text-xs text-muted-foreground">
                            {contact.company}
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {contact.email || "—"}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {contact.phone || "—"}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={`text-[10px] font-medium ${STATUS_COLORS[contact.status] || ""}`}
                        >
                          {contact.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {contact.leadSource || "—"}
                      </TableCell>
                      <TableCell>
                        <LeadScoreBadge score={(contact as any).leadScore ?? 0} />
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {assignedMember?.userName || "Unassigned"}
                      </TableCell>
                      {visibleCfColumns.map((slug) => {
                        const cfData = contact.customFields as Record<string, any> | null;
                        const val = cfData?.[slug];
                        const fd = activeFieldDefs.find((d) => d.slug === slug);
                        let display = "—";
                        if (val !== undefined && val !== null && val !== "") {
                          if (fd?.type === "checkbox") display = val ? "Yes" : "No";
                          else if (fd?.type === "date" && val) display = new Date(val).toLocaleDateString();
                          else if (fd?.type === "number") display = String(val);
                          else display = String(val);
                        }
                        return (
                          <TableCell key={slug} className="text-sm text-muted-foreground max-w-[150px] truncate">
                            {display}
                          </TableCell>
                        );
                      })}
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger
                            asChild
                            onClick={(e) => e.stopPropagation()}
                          >
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 w-7 p-0"
                            >
                              <MoreHorizontal className="h-3.5 w-3.5" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              onClick={(e) => {
                                e.stopPropagation();
                                navigate(
                                  `/contacts/${contact.id}?account=${accountId}`
                                );
                              }}
                            >
                              <Eye className="h-3.5 w-3.5 mr-2" />
                              View
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={(e) => {
                                e.stopPropagation();
                                setEditContact(contact);
                              }}
                            >
                              <Pencil className="h-3.5 w-3.5 mr-2" />
                              Edit
                            </DropdownMenuItem>
                            {contact.phone && (
                              <DropdownMenuItem
                                onClick={(e) => {
                                  e.stopPropagation();
                                  startAICallMutation.mutate({ accountId: accountId!, contactId: contact.id });
                                }}
                              >
                                <PhoneForwarded className="h-3.5 w-3.5 mr-2" />
                                Start AI Call
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              onClick={(e) => {
                                e.stopPropagation();
                                setDeleteConfirm(contact);
                              }}
                              className="text-destructive focus:text-destructive"
                            >
                              <Trash2 className="h-3.5 w-3.5 mr-2" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-border/50">
            <p className="text-xs text-muted-foreground">
              Showing {page * pageSize + 1}–
              {Math.min((page + 1) * pageSize, total)} of {total}
            </p>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0"
                disabled={page === 0}
                onClick={() => setPage(page - 1)}
              >
                <ChevronLeft className="h-3.5 w-3.5" />
              </Button>
              <span className="text-xs text-muted-foreground px-2">
                {page + 1} / {totalPages}
              </span>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0"
                disabled={page >= totalPages - 1}
                onClick={() => setPage(page + 1)}
              >
                <ChevronRight className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        )}
      </Card>

      {/* Create Contact Dialog */}
      <ContactFormDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        title="New Contact"
        description="Add a new contact to this account."
        accountId={accountId!}
        members={members ?? []}
        onSubmit={(data) => createMutation.mutate(data)}
        loading={createMutation.isPending}
      />

      {/* Edit Contact Dialog */}
      {editContact && (
        <ContactFormDialog
          open={!!editContact}
          onOpenChange={(open) => !open && setEditContact(null)}
          title="Edit Contact"
          description="Update contact information."
          accountId={accountId!}
          members={members ?? []}
          defaultValues={editContact}
          onSubmit={(data) =>
            updateMutation.mutate({
              id: editContact.id,
              accountId: accountId!,
              ...data,
            })
          }
          loading={updateMutation.isPending}
        />
      )}

      {/* Delete Confirmation */}
      <Dialog
        open={!!deleteConfirm}
        onOpenChange={(open) => !open && setDeleteConfirm(null)}
      >
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Delete Contact</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete{" "}
              <strong>
                {deleteConfirm?.firstName} {deleteConfirm?.lastName}
              </strong>
              ? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteConfirm(null)}
              className="border-border/50"
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() =>
                deleteMutation.mutate({
                  id: deleteConfirm.id,
                  accountId: accountId!,
                })
              }
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
              ) : (
                <Trash2 className="h-3.5 w-3.5 mr-1.5" />
              )}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* CSV Import Modal */}
      <CsvImportModal
        open={importOpen}
        onOpenChange={setImportOpen}
        accountId={accountId}
      />

      {/* Bulk Assign Dialog */}
      <Dialog open={bulkAssignOpen} onOpenChange={setBulkAssignOpen}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle>Assign {selectedIds.size} Contacts</DialogTitle>
            <DialogDescription>
              Choose a team member to assign all selected contacts to.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <Label className="text-xs">Assign To</Label>
            <Select value={bulkAssignUserId || "unassigned"} onValueChange={(v) => setBulkAssignUserId(v === "unassigned" ? "" : v)}>
              <SelectTrigger className="h-9 text-sm">
                <SelectValue placeholder="Select team member" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="unassigned">Unassigned (remove assignment)</SelectItem>
                {members?.filter((m) => m.isActive).map((m) => (
                  <SelectItem key={m.userId} value={String(m.userId)}>
                    {m.userName || m.userEmail} ({m.role})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBulkAssignOpen(false)} className="border-border/50">
              Cancel
            </Button>
            <Button
              onClick={() => {
                bulkAssignMutation.mutate({
                  accountId: accountId!,
                  contactIds: Array.from(selectedIds),
                  assignedUserId: bulkAssignUserId ? parseInt(bulkAssignUserId) : null,
                });
              }}
              disabled={bulkAssignMutation.isPending}
            >
              {bulkAssignMutation.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />}
              Assign {selectedIds.size} Contacts
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Distribute Leads Dialog */}
      <DistributeLeadsDialog
        open={distributeOpen}
        onOpenChange={setDistributeOpen}
        accountId={accountId!}
        selectedIds={Array.from(selectedIds)}
        members={members?.filter((m) => m.isActive) ?? []}
        onDistribute={(userIds) => {
          distributeMutation.mutate({
            accountId: accountId!,
            contactIds: Array.from(selectedIds),
            userIds,
          });
        }}
        loading={distributeMutation.isPending}
      />

      {/* Enroll in Sequence Dialog */}
      <EnrollInSequenceDialog
        open={enrollDialogOpen}
        onOpenChange={setEnrollDialogOpen}
        accountId={accountId!}
        selectedIds={selectedIds}
        onSuccess={() => setSelectedIds(new Set())}
      />

      {/* Bulk Edit Custom Field Dialog */}
      <Dialog open={bulkEditCfOpen} onOpenChange={setBulkEditCfOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Bulk Edit Custom Field</DialogTitle>
            <DialogDescription>
              Update a custom field value for {selectedIds.size} selected contacts.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Field</Label>
              <Select value={bulkEditSlug} onValueChange={(v) => { setBulkEditSlug(v); setBulkEditValue(""); }}>
                <SelectTrigger><SelectValue placeholder="Select a field" /></SelectTrigger>
                <SelectContent>
                  {activeFieldDefs.map((f) => (
                    <SelectItem key={f.slug} value={f.slug}>{f.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {bulkEditSlug && (() => {
              const def = activeFieldDefs.find((f) => f.slug === bulkEditSlug);
              if (!def) return null;
              if (def.type === "checkbox") {
                return (
                  <div className="space-y-2">
                    <Label>Value</Label>
                    <Select value={bulkEditValue} onValueChange={setBulkEditValue}>
                      <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="true">Yes</SelectItem>
                        <SelectItem value="false">No</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                );
              }
              if (def.type === "dropdown") {
                const opts: string[] = def.options ? (typeof def.options === "string" ? JSON.parse(def.options) : def.options) : [];
                return (
                  <div className="space-y-2">
                    <Label>Value</Label>
                    <Select value={bulkEditValue} onValueChange={setBulkEditValue}>
                      <SelectTrigger><SelectValue placeholder="Select option" /></SelectTrigger>
                      <SelectContent>
                        {opts.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                );
              }
              return (
                <div className="space-y-2">
                  <Label>Value</Label>
                  <Input
                    type={def.type === "number" ? "number" : def.type === "date" ? "date" : "text"}
                    value={bulkEditValue}
                    onChange={(e) => setBulkEditValue(e.target.value)}
                    placeholder={`Enter ${def.name.toLowerCase()}`}
                  />
                </div>
              );
            })()}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBulkEditCfOpen(false)}>Cancel</Button>
            <Button
              disabled={!bulkEditSlug || bulkEditCfMutation.isPending}
              onClick={() => {
                const def = activeFieldDefs.find((f) => f.slug === bulkEditSlug);
                let val: string | number | boolean | null = bulkEditValue;
                if (def?.type === "checkbox") val = bulkEditValue === "true";
                else if (def?.type === "number" && bulkEditValue) val = Number(bulkEditValue);
                else if (!bulkEditValue) val = null;
                bulkEditCfMutation.mutate({
                  accountId: accountId!,
                  contactIds: Array.from(selectedIds),
                  fieldSlug: bulkEditSlug,
                  value: val,
                });
              }}
            >
              {bulkEditCfMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Update {selectedIds.size} Contacts
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Enroll in Sequence Dialog ───
function EnrollInSequenceDialog({
  open,
  onOpenChange,
  accountId,
  selectedIds,
  onSuccess,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  accountId: number;
  selectedIds: Set<number>;
  onSuccess: () => void;
}) {
  const [enrollSequenceId, setEnrollSequenceId] = useState<string>("");
  const { data: allSequences } = trpc.sequences.list.useQuery(
    { accountId },
    { enabled: open && !!accountId }
  );
  const activeSequences = (allSequences ?? []).filter((s: any) => s.status === "active");
  const bulkEnrollMutation = trpc.sequences.bulkEnroll.useMutation({
    onSuccess: (result) => {
      toast.success(`Enrolled ${result.enrolled} contacts — ${result.skipped} already enrolled`);
      onOpenChange(false);
      setEnrollSequenceId("");
      onSuccess();
    },
    onError: (err) => toast.error(err.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Enroll {selectedIds.size} Contacts in Sequence</DialogTitle>
          <DialogDescription>
            Select a sequence to enroll the selected contacts into. Contacts already enrolled will be skipped.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label>Sequence</Label>
            <Select value={enrollSequenceId} onValueChange={setEnrollSequenceId}>
              <SelectTrigger>
                <SelectValue placeholder="Select an active sequence" />
              </SelectTrigger>
              <SelectContent>
                {activeSequences.map((s: any) => (
                  <SelectItem key={s.id} value={String(s.id)}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {activeSequences.length === 0 && (
              <p className="text-xs text-muted-foreground">No active sequences found. Activate a sequence first.</p>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            disabled={!enrollSequenceId || bulkEnrollMutation.isPending}
            onClick={() => {
              bulkEnrollMutation.mutate({
                sequenceId: Number(enrollSequenceId),
                contactIds: Array.from(selectedIds),
                accountId,
                source: "manual",
              });
            }}
          >
            {bulkEnrollMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            Enroll Contacts
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Mini stat card ───
function MiniStat({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color?: string;
}) {
  return (
    <Card className="bg-card border-0 card-shadow">
      <CardContent className="py-3 px-4">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{label}</p>
        <p className={`text-lg font-bold ${color || "text-foreground"}`}>{value}</p>
      </CardContent>
    </Card>
  );
}

// ─── Distribute Leads Dialog ───
function DistributeLeadsDialog({
  open,
  onOpenChange,
  accountId,
  selectedIds,
  members,
  onDistribute,
  loading,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  accountId: number;
  selectedIds: number[];
  members: any[];
  onDistribute: (userIds: number[]) => void;
  loading: boolean;
}) {
  const [selectedUserIds, setSelectedUserIds] = useState<Set<number>>(new Set());

  const toggleUser = (userId: number) => {
    const next = new Set(selectedUserIds);
    if (next.has(userId)) {
      next.delete(userId);
    } else {
      next.add(userId);
    }
    setSelectedUserIds(next);
  };

  const perUser = selectedUserIds.size > 0
    ? Math.floor(selectedIds.length / selectedUserIds.size)
    : 0;
  const remainder = selectedUserIds.size > 0
    ? selectedIds.length % selectedUserIds.size
    : 0;

  return (
    <Dialog open={open} onOpenChange={(o) => { onOpenChange(o); if (!o) setSelectedUserIds(new Set()); }}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Share2 className="h-4 w-4" />
            Distribute {selectedIds.length} Leads
          </DialogTitle>
          <DialogDescription>
            Select team members to distribute leads evenly among them using round-robin assignment.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label className="text-xs font-medium">Select Team Members</Label>
            <div className="space-y-2 max-h-[250px] overflow-y-auto rounded-lg border border-border/50 p-2">
              {members.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No team members found. Invite members first.
                </p>
              ) : (
                members.map((m) => (
                  <div
                    key={m.userId}
                    className={`flex items-center gap-3 p-2.5 rounded-md cursor-pointer transition-colors ${
                      selectedUserIds.has(m.userId)
                        ? "bg-primary/10 border border-primary/30"
                        : "hover:bg-accent border border-transparent"
                    }`}
                    onClick={() => toggleUser(m.userId)}
                  >
                    <Checkbox
                      checked={selectedUserIds.has(m.userId)}
                      onCheckedChange={() => toggleUser(m.userId)}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">
                        {m.userName || m.userEmail}
                      </p>
                      <p className="text-[10px] text-muted-foreground capitalize">
                        {m.role}
                      </p>
                    </div>
                    {selectedUserIds.has(m.userId) && (
                      <Badge variant="secondary" className="text-[10px] shrink-0">
                        ~{perUser + (Array.from(selectedUserIds).indexOf(m.userId) < remainder ? 1 : 0)} leads
                      </Badge>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>

          {selectedUserIds.size > 0 && (
            <div className="rounded-lg bg-secondary/50 p-3 space-y-1">
              <p className="text-xs font-medium">Distribution Preview</p>
              <p className="text-xs text-muted-foreground">
                {selectedIds.length} leads will be distributed evenly among {selectedUserIds.size} team member{selectedUserIds.size > 1 ? "s" : ""}.
                Each will receive approximately <strong>{perUser}</strong> leads
                {remainder > 0 ? ` (${remainder} member${remainder > 1 ? "s" : ""} will get 1 extra)` : ""}.
              </p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} className="border-border/50">
            Cancel
          </Button>
          <Button
            onClick={() => onDistribute(Array.from(selectedUserIds))}
            disabled={loading || selectedUserIds.size === 0}
          >
            {loading && <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />}
            <Share2 className="h-3.5 w-3.5 mr-1.5" />
            Distribute Leads
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Contact Form Dialog (Create + Edit) ───
function ContactFormDialog({
  open,
  onOpenChange,
  title,
  description,
  accountId,
  members,
  defaultValues,
  onSubmit,
  loading,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  accountId: number;
  members: any[];
  defaultValues?: any;
  onSubmit: (data: any) => void;
  loading: boolean;
}) {
  const [firstName, setFirstName] = useState(
    defaultValues?.firstName || ""
  );
  const [lastName, setLastName] = useState(defaultValues?.lastName || "");
  const [email, setEmail] = useState(defaultValues?.email || "");
  const [phone, setPhone] = useState(defaultValues?.phone || "");
  const [phoneError, setPhoneError] = useState("");
  const [company, setCompany] = useState(defaultValues?.company || "");
  const [jobTitle, setJobTitle] = useState(defaultValues?.title || "");
  const [leadSource, setLeadSource] = useState(
    defaultValues?.leadSource || ""
  );
  const [status, setStatus] = useState(defaultValues?.status || "new");
  const [assignedUserId, setAssignedUserId] = useState(
    defaultValues?.assignedUserId ? String(defaultValues.assignedUserId) : ""
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!firstName.trim() || !lastName.trim()) {
      toast.error("First name and last name are required");
      return;
    }
    // Validate phone if provided
    const trimmedPhone = phone.trim();
    if (trimmedPhone) {
      const e164Regex = /^\+[1-9]\d{1,14}$/;
      // Try to auto-normalize US numbers
      let normalized = trimmedPhone;
      if (!e164Regex.test(normalized)) {
        const digits = normalized.replace(/\D/g, "");
        if (digits.length === 10) normalized = `+1${digits}`;
        else if (digits.length === 11 && digits.startsWith("1")) normalized = `+${digits}`;
        else if (digits.length >= 7 && digits.length <= 15) normalized = `+${digits}`;
      }
      if (!e164Regex.test(normalized)) {
        setPhoneError("Phone must be E.164 format (e.g., +15551234567)");
        toast.error("Phone must be in E.164 format (e.g., +15551234567)");
        return;
      }
      setPhone(normalized);
    }
    setPhoneError("");
    const data: any = {
      accountId,
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      email: email.trim() || undefined,
      phone: trimmedPhone ? phone.trim() : undefined,
      company: company.trim() || undefined,
      title: jobTitle.trim() || undefined,
      leadSource: leadSource || undefined,
      status: status as any,
    };
    if (assignedUserId) {
      data.assignedUserId = parseInt(assignedUserId);
    }
    onSubmit(data);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">First Name *</Label>
              <Input
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder="John"
                className="h-9 text-sm"
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Last Name *</Label>
              <Input
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                placeholder="Doe"
                className="h-9 text-sm"
                required
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Email</Label>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="john@example.com"
                className="h-9 text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Phone</Label>
              <Input
                value={phone}
                onChange={(e) => {
                  setPhone(e.target.value);
                  setPhoneError("");
                }}
                placeholder="+15551234567"
                className={`h-9 text-sm ${phoneError ? "border-red-500" : ""}`}
              />
              {phoneError && (
                <p className="text-xs text-red-500">{phoneError}</p>
              )}
              <p className="text-xs text-muted-foreground">E.164 format: +1 followed by 10 digits</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Company</Label>
              <Input
                value={company}
                onChange={(e) => setCompany(e.target.value)}
                placeholder="Acme Corp"
                className="h-9 text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Job Title</Label>
              <Input
                value={jobTitle}
                onChange={(e) => setJobTitle(e.target.value)}
                placeholder="Loan Officer"
                className="h-9 text-sm"
              />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Status</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUSES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s.charAt(0).toUpperCase() + s.slice(1)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Lead Source</Label>
              <Select
                value={leadSource || "none"}
                onValueChange={(v) => setLeadSource(v === "none" ? "" : v)}
              >
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue placeholder="Select" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {LEAD_SOURCES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Assign To</Label>
              <Select
                value={assignedUserId || "unassigned"}
                onValueChange={(v) =>
                  setAssignedUserId(v === "unassigned" ? "" : v)
                }
              >
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue placeholder="Unassigned" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="unassigned">Unassigned</SelectItem>
                  {members.map((m) => (
                    <SelectItem key={m.userId} value={String(m.userId)}>
                      {m.userName || m.userEmail}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="border-border/50"
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading && (
                <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
              )}
              {defaultValues ? "Save Changes" : "Create Contact"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
