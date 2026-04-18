import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  GripVertical,
  Loader2,
  MoreHorizontal,
  Plus,
  Trash2,
  User,
  UserCircle,
  UserX,
  DollarSign,
  Phone,
  Mail,
  Search,
  Settings2,
  ArrowUp,
  ArrowDown,
  Check,
} from "lucide-react";
import { useMemo, useState, useCallback } from "react";
import { useAccount } from "@/contexts/AccountContext";
import { NoAccountSelected } from "@/components/NoAccountSelected";
import { useLocation } from "wouter";
import { toast } from "sonner";

// ─── Types ───
interface PipelineStage {
  id: number;
  pipelineId: number;
  accountId: number;
  name: string;
  color: string;
  sortOrder: number;
  isWon: boolean;
  isLost: boolean;
}

interface DealContact {
  id: number;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  status: string | null;
  leadSource: string | null;
  company: string | null;
}

interface AssignedUser {
  id: number | null;
  name: string | null;
}

interface TeamMember {
  userId: number;
  name: string;
  email: string | null;
  role: string;
}

interface DealWithContact {
  deal: {
    id: number;
    accountId: number;
    pipelineId: number;
    stageId: number;
    contactId: number;
    assignedUserId: number | null;
    title: string | null;
    value: number | null;
    sortOrder: number;
    createdAt: Date;
    updatedAt: Date;
  };
  contact: DealContact;
  assignedUser: AssignedUser | null;
}

// ─── Helper: get initials from name ───
function getInitials(name: string | null | undefined): string {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
}

// ─── Deterministic avatar color from userId ───
const AVATAR_COLORS = [
  "bg-blue-500", "bg-emerald-500", "bg-violet-500", "bg-amber-500",
  "bg-rose-500", "bg-cyan-500", "bg-indigo-500", "bg-orange-500",
  "bg-teal-500", "bg-pink-500",
];
function avatarColor(userId: number | null): string {
  if (!userId) return "bg-muted";
  return AVATAR_COLORS[userId % AVATAR_COLORS.length];
}

export default function Pipeline() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const utils = trpc.useUtils();
  const { currentAccountId: accountId, isLoading: accountsLoading, isAdmin } = useAccount();

  // Pipeline data
  const { data: pipelineData, isLoading: pipelineLoading } =
    trpc.pipeline.getDefault.useQuery(
      { accountId: accountId! },
      { enabled: !!accountId, staleTime: 30000 }
    );

  const { data: dealsData, isLoading: dealsLoading } =
    trpc.pipeline.listDeals.useQuery(
      { pipelineId: pipelineData?.pipeline?.id!, accountId: accountId! },
      { enabled: !!accountId && !!pipelineData?.pipeline?.id, staleTime: 30000, placeholderData: (prev: any) => prev }
    );

  // Team members for assignment
  const { data: teamMembers } = trpc.pipeline.listTeamMembers.useQuery(
    { accountId: accountId! },
    { enabled: !!accountId }
  );

  // Contacts for adding deals — higher limit to cover large accounts
  const [contactSearch, setContactSearch] = useState("");
  const { data: contactsData } = trpc.contacts.list.useQuery(
    { accountId: accountId!, limit: 500, search: contactSearch || undefined },
    { enabled: !!accountId }
  );

  // Mutations
  const createDealMutation = trpc.pipeline.createDeal.useMutation({
    onSuccess: () => {
      utils.pipeline.listDeals.invalidate();
      toast.success("Deal added to pipeline");
      setShowAddDeal(false);
      setNewDealContactId(null);
      setNewDealStageId(null);
      setNewDealTitle("");
      setNewDealValue("");
    },
    onError: (err) => toast.error(err.message),
  });

  const moveDealMutation = trpc.pipeline.moveDeal.useMutation({
    onSuccess: () => {
      utils.pipeline.listDeals.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  const deleteDealMutation = trpc.pipeline.deleteDeal.useMutation({
    onSuccess: () => {
      utils.pipeline.listDeals.invalidate();
      toast.success("Deal removed from pipeline");
    },
    onError: (err) => toast.error(err.message),
  });

  const assignDealMutation = trpc.pipeline.assignDeal.useMutation({
    onSuccess: () => {
      utils.pipeline.listDeals.invalidate();
      toast.success("Deal assignment updated");
    },
    onError: (err) => toast.error(err.message),
  });

  const updateDealMutation = trpc.pipeline.updateDeal.useMutation({
    onSuccess: () => {
      utils.pipeline.listDeals.invalidate();
      toast.success("Deal updated");
    },
    onError: (err) => toast.error(err.message),
  });

  // Stage management mutations
  const addStageMut = trpc.pipeline.addStage.useMutation({
    onSuccess: () => {
      utils.pipeline.getDefault.invalidate({ accountId: accountId! });
      utils.pipeline.listDeals.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });
  const deleteStageMut = trpc.pipeline.deleteStage.useMutation({
    onSuccess: () => {
      utils.pipeline.getDefault.invalidate({ accountId: accountId! });
      utils.pipeline.listDeals.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });
  const reorderStagesMut = trpc.pipeline.reorderStages.useMutation({
    onSuccess: () => {
      utils.pipeline.getDefault.invalidate({ accountId: accountId! });
    },
    onError: (err) => toast.error(err.message),
  });
  const renameStagesMut = trpc.pipeline.renameStages.useMutation({
    onSuccess: () => {
      utils.pipeline.getDefault.invalidate({ accountId: accountId! });
    },
    onError: (err) => toast.error(err.message),
  });

  // UI state
  const [dealSearch, setDealSearch] = useState("");
  const [showStageSettings, setShowStageSettings] = useState(false);
  const [editStages, setEditStages] = useState<{ id: number; name: string; color: string; isNew?: boolean }[]>([]);
  const [isSavingStages, setIsSavingStages] = useState(false);
  const [showAddDeal, setShowAddDeal] = useState(false);
  const [newDealContactId, setNewDealContactId] = useState<number | null>(null);
  const [newDealStageId, setNewDealStageId] = useState<number | null>(null);
  const [newDealTitle, setNewDealTitle] = useState("");
  const [newDealValue, setNewDealValue] = useState("");

  // Deal detail modal
  const [selectedDeal, setSelectedDeal] = useState<DealWithContact | null>(null);
  const [detailTitle, setDetailTitle] = useState("");
  const [detailValue, setDetailValue] = useState("");
  const [detailAssignedUserId, setDetailAssignedUserId] = useState<string>("unassigned");

  // Drag state
  const [draggedDealId, setDraggedDealId] = useState<number | null>(null);
  const [dragOverStageId, setDragOverStageId] = useState<number | null>(null);

  // Group deals by stage with search filter
  const dealsByStage = useMemo(() => {
    const map: Record<number, DealWithContact[]> = {};
    if (pipelineData?.stages) {
      for (const stage of pipelineData.stages) {
        map[stage.id] = [];
      }
    }
    if (dealsData) {
      const q = dealSearch.toLowerCase().trim();
      for (const item of dealsData) {
        if (map[item.deal.stageId]) {
          if (q) {
            const c = item.contact;
            const match =
              `${c.firstName} ${c.lastName}`.toLowerCase().includes(q) ||
              (c.email && c.email.toLowerCase().includes(q)) ||
              (c.phone && c.phone.includes(q)) ||
              (c.company && c.company.toLowerCase().includes(q)) ||
              (item.deal.title && item.deal.title.toLowerCase().includes(q));
            if (!match) continue;
          }
          map[item.deal.stageId].push(item as DealWithContact);
        }
      }
    }
    return map;
  }, [dealsData, pipelineData?.stages, dealSearch]);

  // Contacts not already in pipeline
  const availableContacts = useMemo(() => {
    if (!contactsData?.data || !dealsData) return [];
    const dealContactIds = new Set(dealsData.map((d) => d.deal.contactId));
    return contactsData.data.filter((c: { id: number; firstName: string; lastName: string; company: string | null }) => !dealContactIds.has(c.id));
  }, [contactsData, dealsData]);

  // ─── Drag handlers ───
  const handleDragStart = useCallback(
    (e: React.DragEvent, dealId: number) => {
      setDraggedDealId(dealId);
      e.dataTransfer.effectAllowed = "move";
      e.dataTransfer.setData("text/plain", String(dealId));
    },
    []
  );

  const handleDragOver = useCallback(
    (e: React.DragEvent, stageId: number) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
      setDragOverStageId(stageId);
    },
    []
  );

  const handleDragLeave = useCallback(() => {
    setDragOverStageId(null);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent, targetStageId: number) => {
      e.preventDefault();
      setDragOverStageId(null);
      const dealId = parseInt(e.dataTransfer.getData("text/plain"));
      if (!dealId || !accountId) return;

      // Find the deal to check if stage actually changed
      const deal = dealsData?.find((d) => d.deal.id === dealId);
      if (!deal || deal.deal.stageId === targetStageId) {
        setDraggedDealId(null);
        return;
      }

      moveDealMutation.mutate({
        dealId,
        accountId,
        stageId: targetStageId,
      });
      setDraggedDealId(null);
    },
    [accountId, dealsData, moveDealMutation]
  );

  const handleDragEnd = useCallback(() => {
    setDraggedDealId(null);
    setDragOverStageId(null);
  }, []);

  // ─── Deal detail handlers ───
  const openDealDetail = useCallback((item: DealWithContact) => {
    setSelectedDeal(item);
    setDetailTitle(item.deal.title || "");
    setDetailValue(String(item.deal.value || 0));
    setDetailAssignedUserId(
      item.deal.assignedUserId ? String(item.deal.assignedUserId) : "unassigned"
    );
  }, []);

  const saveDealDetail = useCallback(() => {
    if (!selectedDeal || !accountId) return;

    // Save title/value changes
    const titleChanged = detailTitle !== (selectedDeal.deal.title || "");
    const valueChanged = detailValue !== String(selectedDeal.deal.value || 0);
    if (titleChanged || valueChanged) {
      updateDealMutation.mutate({
        dealId: selectedDeal.deal.id,
        accountId,
        ...(titleChanged ? { title: detailTitle } : {}),
        ...(valueChanged ? { value: parseInt(detailValue) || 0 } : {}),
      });
    }

    // Save assignment change
    const newAssigned = detailAssignedUserId === "unassigned" ? null : parseInt(detailAssignedUserId);
    if (newAssigned !== selectedDeal.deal.assignedUserId) {
      assignDealMutation.mutate({
        dealId: selectedDeal.deal.id,
        accountId,
        assignedUserId: newAssigned,
      });
    }

    setSelectedDeal(null);
  }, [selectedDeal, accountId, detailTitle, detailValue, detailAssignedUserId, updateDealMutation, assignDealMutation]);

  // ─── Render ───
  if (!accountId) {
    return <NoAccountSelected />;
  }

  const stages = pipelineData?.stages || [];

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 p-4 pb-2 shrink-0">
        <div className="flex items-center gap-2 sm:gap-3">
          <h1 className="text-xl font-semibold">Pipeline</h1>
          {pipelineData?.pipeline && (
            <Badge variant="outline" className="text-xs">
              {pipelineData.pipeline.name}
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Search deals..."
              value={dealSearch}
              onChange={(e) => setDealSearch(e.target.value)}
              className="h-8 w-[180px] sm:w-[220px] pl-8 text-xs"
            />
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setEditStages(
                stages.map((s) => ({ id: s.id, name: s.name, color: s.color }))
              );
              setShowStageSettings(true);
            }}
          >
            <Settings2 className="h-4 w-4 mr-1" />
            Stages
          </Button>
          <Button
            size="sm"
            onClick={() => {
              if (stages.length > 0) {
                setNewDealStageId(stages[0].id);
              }
              setShowAddDeal(true);
            }}
          >
            <Plus className="h-4 w-4 mr-1" />
            Add Deal
          </Button>
        </div>
      </div>

      {/* Kanban Board */}
      {pipelineLoading || dealsLoading ? (
        <div className="flex gap-4 p-4 overflow-hidden">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="flex-shrink-0 w-72 space-y-3">
              <Skeleton className="h-6 w-32" />
              <Skeleton className="h-28 w-full rounded-lg" />
              <Skeleton className="h-28 w-full rounded-lg" />
              <Skeleton className="h-28 w-full rounded-lg opacity-50" />
            </div>
          ))}
        </div>
      ) : (
        <div className="flex-1 overflow-x-auto p-2 sm:p-4 pt-2">
          <div className="flex gap-2 sm:gap-3 h-full min-h-[400px] sm:min-h-[500px] pb-4">
            {stages.map((stage) => (
              <StageColumn
                key={stage.id}
                stage={stage}
                deals={dealsByStage[stage.id] || []}
                isDragOver={dragOverStageId === stage.id}
                draggedDealId={draggedDealId}
                accountId={accountId!}
                teamMembers={teamMembers || []}
                onDragStart={handleDragStart}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onDragEnd={handleDragEnd}
                onDeleteDeal={(dealId) =>
                  deleteDealMutation.mutate({ dealId, accountId: accountId! })
                }
                onNavigateContact={(contactId) =>
                  navigate(`/contacts/${contactId}?account=${accountId}`)
                }
                onAssignDeal={(dealId, userId) =>
                  assignDealMutation.mutate({ dealId, accountId: accountId!, assignedUserId: userId })
                }
                onOpenDetail={openDealDetail}
              />
            ))}
          </div>
        </div>
      )}

      {/* Add Deal Dialog */}
      <Dialog open={showAddDeal} onOpenChange={setShowAddDeal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add Deal to Pipeline</DialogTitle>
            <DialogDescription>
              Select a contact to add to the pipeline.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Contact</Label>
              <Input
                placeholder="Search contacts..."
                value={contactSearch}
                onChange={(e) => setContactSearch(e.target.value)}
                className="mb-2"
              />
              <Select
                value={newDealContactId?.toString() || ""}
                onValueChange={(v) => setNewDealContactId(parseInt(v))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a contact" />
                </SelectTrigger>
                <SelectContent>
                  {availableContacts.length === 0 ? (
                    <div className="px-2 py-4 text-sm text-muted-foreground text-center">
                      All contacts are already in the pipeline
                    </div>
                  ) : (
                    availableContacts.map((c: { id: number; firstName: string; lastName: string; company: string | null }) => (
                      <SelectItem key={c.id} value={c.id.toString()}>
                        {c.firstName} {c.lastName}
                        {c.company ? ` — ${c.company}` : ""}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Stage</Label>
              <Select
                value={newDealStageId?.toString() || ""}
                onValueChange={(v) => setNewDealStageId(parseInt(v))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select stage" />
                </SelectTrigger>
                <SelectContent>
                  {stages.map((s) => (
                    <SelectItem key={s.id} value={s.id.toString()}>
                      <span className="flex items-center gap-2">
                        <span
                          className="w-2 h-2 rounded-full"
                          style={{ backgroundColor: s.color }}
                        />
                        {s.name}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Deal Title (optional)</Label>
              <Input
                value={newDealTitle}
                onChange={(e) => setNewDealTitle(e.target.value)}
                placeholder="e.g., Mortgage Refinance"
              />
            </div>

            <div className="space-y-2">
              <Label>Deal Value ($)</Label>
              <Input
                type="number"
                value={newDealValue}
                onChange={(e) => setNewDealValue(e.target.value)}
                placeholder="0"
                min="0"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddDeal(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (!newDealContactId || !newDealStageId || !accountId || !pipelineData?.pipeline)
                  return;
                createDealMutation.mutate({
                  accountId,
                  pipelineId: pipelineData.pipeline.id,
                  stageId: newDealStageId,
                  contactId: newDealContactId,
                  title: newDealTitle || undefined,
                  value: newDealValue ? parseInt(newDealValue) : undefined,
                });
              }}
              disabled={
                !newDealContactId ||
                !newDealStageId ||
                createDealMutation.isPending
              }
            >
              {createDealMutation.isPending && (
                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
              )}
              Add Deal
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Deal Detail Modal */}
      <Dialog open={!!selectedDeal} onOpenChange={(open) => !open && setSelectedDeal(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Deal Details</DialogTitle>
            <DialogDescription>
              {selectedDeal && (
                <span>
                  {selectedDeal.contact.firstName} {selectedDeal.contact.lastName}
                  {selectedDeal.contact.company ? ` — ${selectedDeal.contact.company}` : ""}
                </span>
              )}
            </DialogDescription>
          </DialogHeader>
          {selectedDeal && (
            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label>Deal Title</Label>
                <Input
                  value={detailTitle}
                  onChange={(e) => setDetailTitle(e.target.value)}
                  placeholder="Deal title"
                />
              </div>

              <div className="space-y-2">
                <Label>Deal Value ($)</Label>
                <Input
                  type="number"
                  value={detailValue}
                  onChange={(e) => setDetailValue(e.target.value)}
                  placeholder="0"
                  min="0"
                />
              </div>

              <div className="space-y-2">
                <Label>Assigned To</Label>
                <Select
                  value={detailAssignedUserId}
                  onValueChange={setDetailAssignedUserId}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select team member" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="unassigned">
                      <span className="flex items-center gap-2 text-muted-foreground">
                        <UserX className="h-4 w-4" />
                        Unassigned
                      </span>
                    </SelectItem>
                    {(teamMembers || []).map((m) => (
                      <SelectItem key={m.userId} value={String(m.userId)}>
                        <span className="flex items-center gap-2">
                          <span className={`inline-flex items-center justify-center h-5 w-5 rounded-full text-[10px] font-medium text-white ${avatarColor(m.userId)}`}>
                            {getInitials(m.name)}
                          </span>
                          {m.name}
                          <span className="text-muted-foreground text-xs">({m.role})</span>
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Contact info summary */}
              <div className="rounded-md bg-muted/50 p-3 space-y-1.5">
                <p className="text-xs font-medium text-muted-foreground">Contact Info</p>
                {selectedDeal.contact.email && (
                  <div className="flex items-center gap-1.5 text-xs">
                    <Mail className="h-3 w-3 text-muted-foreground" />
                    {selectedDeal.contact.email}
                  </div>
                )}
                {selectedDeal.contact.phone && (
                  <div className="flex items-center gap-1.5 text-xs">
                    <Phone className="h-3 w-3 text-muted-foreground" />
                    {selectedDeal.contact.phone}
                  </div>
                )}
                {selectedDeal.contact.leadSource && (
                  <div className="flex items-center gap-1.5 text-xs">
                    <Badge variant="outline" className="text-[10px] h-4 px-1.5">
                      {selectedDeal.contact.leadSource}
                    </Badge>
                  </div>
                )}
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedDeal(null)}>
              Cancel
            </Button>
            <Button
              onClick={saveDealDetail}
              disabled={updateDealMutation.isPending || assignDealMutation.isPending}
            >
              {(updateDealMutation.isPending || assignDealMutation.isPending) && (
                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
              )}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Stage Management Dialog */}
      <Dialog open={showStageSettings} onOpenChange={setShowStageSettings}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Manage Pipeline Stages</DialogTitle>
            <DialogDescription>
              Add, rename, reorder, or remove stages. Stages with active deals cannot be deleted.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2 max-h-[400px] overflow-y-auto">
            {editStages.map((stage, idx) => (
              <div key={stage.id} className="flex items-center gap-2">
                <div className="flex flex-col gap-0.5">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-5 w-5"
                    disabled={idx === 0}
                    onClick={() => {
                      const arr = [...editStages];
                      [arr[idx - 1], arr[idx]] = [arr[idx], arr[idx - 1]];
                      setEditStages(arr);
                    }}
                  >
                    <ArrowUp className="h-3 w-3" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-5 w-5"
                    disabled={idx === editStages.length - 1}
                    onClick={() => {
                      const arr = [...editStages];
                      [arr[idx], arr[idx + 1]] = [arr[idx + 1], arr[idx]];
                      setEditStages(arr);
                    }}
                  >
                    <ArrowDown className="h-3 w-3" />
                  </Button>
                </div>
                <input
                  type="color"
                  value={stage.color}
                  onChange={(e) => {
                    const arr = [...editStages];
                    arr[idx] = { ...arr[idx], color: e.target.value };
                    setEditStages(arr);
                  }}
                  className="h-8 w-8 rounded cursor-pointer border-0 p-0"
                />
                <Input
                  value={stage.name}
                  onChange={(e) => {
                    const arr = [...editStages];
                    arr[idx] = { ...arr[idx], name: e.target.value };
                    setEditStages(arr);
                  }}
                  className="text-sm h-9 flex-1"
                />
                {editStages.length > 1 && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground hover:text-destructive shrink-0"
                    onClick={() => setEditStages(prev => prev.filter((_, i) => i !== idx))}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
            ))}
            <Button
              variant="outline"
              size="sm"
              className="w-full text-xs"
              onClick={() => {
                const colors = ["#3b82f6", "#8b5cf6", "#f59e0b", "#10b981", "#ef4444", "#ec4899", "#06b6d4", "#f97316"];
                const color = colors[editStages.length % colors.length];
                setEditStages(prev => [...prev, { id: -(prev.length + 1), name: "New Stage", color, isNew: true }]);
              }}
            >
              <Plus className="h-3.5 w-3.5 mr-1" />
              Add Stage
            </Button>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowStageSettings(false)}>
              Cancel
            </Button>
            <Button
              disabled={isSavingStages}
              onClick={async () => {
                if (!accountId || !pipelineData?.pipeline) return;
                setIsSavingStages(true);
                try {
                  const origIds = new Set(stages.map(s => s.id));
                  const currentIds = new Set(editStages.filter(s => !s.isNew).map(s => s.id));

                  // Delete removed stages
                  for (const origId of origIds) {
                    if (!currentIds.has(origId)) {
                      await deleteStageMut.mutateAsync({ accountId, stageId: origId });
                    }
                  }

                  // Add new stages
                  for (const stage of editStages) {
                    if (stage.isNew) {
                      await addStageMut.mutateAsync({
                        accountId,
                        pipelineId: pipelineData.pipeline.id,
                        name: stage.name,
                        color: stage.color,
                      });
                    }
                  }

                  // Rename existing stages
                  const existingChanged = editStages.filter(s => !s.isNew && origIds.has(s.id));
                  if (existingChanged.length > 0) {
                    await renameStagesMut.mutateAsync({
                      accountId,
                      stages: existingChanged.map(s => ({ id: s.id, name: s.name })),
                    });
                  }

                  // Reorder all stages
                  const finalOrder = editStages
                    .filter(s => !s.isNew)
                    .map(s => s.id);
                  if (finalOrder.length > 0) {
                    await reorderStagesMut.mutateAsync({
                      accountId,
                      stageIds: finalOrder,
                    });
                  }

                  toast.success("Pipeline stages updated");
                  setShowStageSettings(false);
                } catch (err: any) {
                  toast.error(err.message || "Failed to update stages");
                } finally {
                  setIsSavingStages(false);
                }
              }}
            >
              {isSavingStages ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Saving...
                </span>
              ) : (
                "Save Changes"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Stage Column Component ───
interface StageColumnProps {
  stage: PipelineStage;
  deals: DealWithContact[];
  isDragOver: boolean;
  draggedDealId: number | null;
  accountId: number;
  teamMembers: TeamMember[];
  onDragStart: (e: React.DragEvent, dealId: number) => void;
  onDragOver: (e: React.DragEvent, stageId: number) => void;
  onDragLeave: () => void;
  onDrop: (e: React.DragEvent, stageId: number) => void;
  onDragEnd: () => void;
  onDeleteDeal: (dealId: number) => void;
  onNavigateContact: (contactId: number) => void;
  onAssignDeal: (dealId: number, userId: number | null) => void;
  onOpenDetail: (item: DealWithContact) => void;
}

function StageColumn({
  stage,
  deals,
  isDragOver,
  draggedDealId,
  teamMembers,
  onDragStart,
  onDragOver,
  onDragLeave,
  onDrop,
  onDragEnd,
  onDeleteDeal,
  onNavigateContact,
  onAssignDeal,
  onOpenDetail,
}: StageColumnProps) {
  const totalValue = deals.reduce((sum, d) => sum + (d.deal.value || 0), 0);

  return (
    <div
      className={`flex flex-col w-[260px] min-w-[260px] sm:w-[280px] sm:min-w-[280px] rounded-lg transition-colors ${
        isDragOver
          ? "bg-accent/30 ring-2 ring-primary/40"
          : "bg-muted/20"
      }`}
      onDragOver={(e) => onDragOver(e, stage.id)}
      onDragLeave={onDragLeave}
      onDrop={(e) => onDrop(e, stage.id)}
    >
      {/* Stage Header */}
      <div className="p-3 pb-2 shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span
              className="w-3 h-3 rounded-full shrink-0"
              style={{ backgroundColor: stage.color }}
            />
            <span className="text-sm font-medium truncate">{stage.name}</span>
            <Badge
              variant="secondary"
              className="text-[10px] h-5 px-1.5 min-w-[20px] justify-center"
            >
              {deals.length}
            </Badge>
          </div>
        </div>
        {totalValue > 0 && (
          <div className="text-[11px] text-muted-foreground mt-1 flex items-center gap-1">
            <DollarSign className="h-3 w-3" />
            {totalValue.toLocaleString()}
          </div>
        )}
      </div>

      {/* Deal Cards */}
      <div className="flex-1 overflow-y-auto px-2 pb-2 space-y-2">
        {deals.map((item) => (
          <DealCard
            key={item.deal.id}
            item={item}
            isDragging={draggedDealId === item.deal.id}
            teamMembers={teamMembers}
            onDragStart={onDragStart}
            onDragEnd={onDragEnd}
            onDelete={onDeleteDeal}
            onNavigateContact={onNavigateContact}
            onAssignDeal={onAssignDeal}
            onOpenDetail={onOpenDetail}
          />
        ))}

        {deals.length === 0 && (
          <div className="flex items-center justify-center h-20 text-xs text-muted-foreground border border-dashed border-border/50 rounded-md">
            {isDragOver ? "Drop here" : "No deals"}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Deal Card Component ───
interface DealCardProps {
  item: DealWithContact;
  isDragging: boolean;
  teamMembers: TeamMember[];
  onDragStart: (e: React.DragEvent, dealId: number) => void;
  onDragEnd: () => void;
  onDelete: (dealId: number) => void;
  onNavigateContact: (contactId: number) => void;
  onAssignDeal: (dealId: number, userId: number | null) => void;
  onOpenDetail: (item: DealWithContact) => void;
}

function DealCard({
  item,
  isDragging,
  teamMembers,
  onDragStart,
  onDragEnd,
  onDelete,
  onNavigateContact,
  onAssignDeal,
  onOpenDetail,
}: DealCardProps) {
  const { deal, contact, assignedUser } = item;

  return (
    <Card
      draggable
      onDragStart={(e) => onDragStart(e, deal.id)}
      onDragEnd={onDragEnd}
      className={`cursor-grab active:cursor-grabbing transition-all ${
        isDragging
          ? "opacity-40 scale-95 rotate-1"
          : "hover:ring-1 hover:ring-primary/30"
      }`}
    >
      <CardContent className="p-3">
        <div className="flex items-start justify-between gap-1">
          <div
            className="flex-1 min-w-0 cursor-pointer"
            onClick={() => onOpenDetail(item)}
          >
            <div className="flex items-center gap-1.5">
              <GripVertical className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              <p className="text-sm font-medium truncate">
                {contact.firstName} {contact.lastName}
              </p>
            </div>
            {deal.title && deal.title !== `${contact.firstName} ${contact.lastName}` && (
              <p className="text-xs text-muted-foreground mt-0.5 ml-5 truncate">
                {deal.title}
              </p>
            )}
          </div>

          {/* Assigned user avatar + actions */}
          <div className="flex items-center gap-0.5 shrink-0">
            {/* Assignment avatar with popover */}
            <Popover>
              <PopoverTrigger asChild>
                <button
                  className="focus:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-full"
                  onClick={(e) => e.stopPropagation()}
                >
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span>
                        {deal.assignedUserId && assignedUser?.name ? (
                          <Avatar className="h-6 w-6">
                            <AvatarFallback
                              className={`text-[10px] font-medium text-white ${avatarColor(deal.assignedUserId)}`}
                            >
                              {getInitials(assignedUser.name)}
                            </AvatarFallback>
                          </Avatar>
                        ) : (
                          <span className="inline-flex items-center justify-center h-6 w-6 rounded-full border border-dashed border-muted-foreground/40 text-muted-foreground/60">
                            <UserCircle className="h-3.5 w-3.5" />
                          </span>
                        )}
                      </span>
                    </TooltipTrigger>
                    <TooltipContent side="top" className="text-xs">
                      {deal.assignedUserId && assignedUser?.name
                        ? assignedUser.name
                        : "Unassigned"}
                    </TooltipContent>
                  </Tooltip>
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-48 p-1" align="end">
                <div className="text-xs font-medium text-muted-foreground px-2 py-1.5">
                  Assign to
                </div>
                <button
                  className="flex items-center gap-2 w-full px-2 py-1.5 text-xs rounded-sm hover:bg-accent transition-colors text-left"
                  onClick={() => onAssignDeal(deal.id, null)}
                >
                  <UserX className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-muted-foreground">Unassigned</span>
                  {!deal.assignedUserId && <Check className="h-3 w-3 ml-auto text-primary" />}
                </button>
                {teamMembers.map((m) => (
                  <button
                    key={m.userId}
                    className="flex items-center gap-2 w-full px-2 py-1.5 text-xs rounded-sm hover:bg-accent transition-colors text-left"
                    onClick={() => onAssignDeal(deal.id, m.userId)}
                  >
                    <span className={`inline-flex items-center justify-center h-5 w-5 rounded-full text-[9px] font-medium text-white ${avatarColor(m.userId)}`}>
                      {getInitials(m.name)}
                    </span>
                    <span className="truncate">{m.name}</span>
                    {deal.assignedUserId === m.userId && <Check className="h-3 w-3 ml-auto text-primary" />}
                  </button>
                ))}
              </PopoverContent>
            </Popover>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0">
                  <MoreHorizontal className="h-3.5 w-3.5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => onOpenDetail(item)}>
                  <Settings2 className="h-4 w-4 mr-2" />
                  Deal Details
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onNavigateContact(contact.id)}>
                  <User className="h-4 w-4 mr-2" />
                  View Contact
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="text-destructive"
                  onClick={() => onDelete(deal.id)}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Remove Deal
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Contact info */}
        <div className="mt-2 ml-5 space-y-1">
          {contact.company && (
            <p className="text-[11px] text-muted-foreground truncate">
              {contact.company}
            </p>
          )}
          <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
            {contact.phone && (
              <span className="flex items-center gap-0.5">
                <Phone className="h-3 w-3" />
                {contact.phone}
              </span>
            )}
            {contact.email && (
              <span className="flex items-center gap-0.5 truncate">
                <Mail className="h-3 w-3 shrink-0" />
                <span className="truncate">{contact.email}</span>
              </span>
            )}
          </div>
          {(deal.value ?? 0) > 0 && (
            <div className="flex items-center gap-1 text-xs font-medium text-emerald-600">
              <DollarSign className="h-3 w-3" />
              {(deal.value ?? 0).toLocaleString()}
            </div>
          )}
        </div>

        {/* Lead source badge */}
        {contact.leadSource && (
          <div className="mt-2 ml-5">
            <Badge variant="outline" className="text-[10px] h-4 px-1.5">
              {contact.leadSource}
            </Badge>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
