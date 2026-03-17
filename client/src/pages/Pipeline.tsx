import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  GripVertical,
  Loader2,
  MoreHorizontal,
  Plus,
  Trash2,
  User,
  DollarSign,
  Phone,
  Mail,
} from "lucide-react";
import { useMemo, useState, useRef, useCallback } from "react";
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

interface DealWithContact {
  deal: {
    id: number;
    accountId: number;
    pipelineId: number;
    stageId: number;
    contactId: number;
    title: string | null;
    value: number | null;
    sortOrder: number;
    createdAt: Date;
    updatedAt: Date;
  };
  contact: DealContact;
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
      { enabled: !!accountId }
    );

  const { data: dealsData, isLoading: dealsLoading } =
    trpc.pipeline.listDeals.useQuery(
      { pipelineId: pipelineData?.pipeline?.id!, accountId: accountId! },
      { enabled: !!accountId && !!pipelineData?.pipeline?.id }
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

  // UI state
  const [showAddDeal, setShowAddDeal] = useState(false);
  const [newDealContactId, setNewDealContactId] = useState<number | null>(null);
  const [newDealStageId, setNewDealStageId] = useState<number | null>(null);
  const [newDealTitle, setNewDealTitle] = useState("");
  const [newDealValue, setNewDealValue] = useState("");

  // Drag state
  const [draggedDealId, setDraggedDealId] = useState<number | null>(null);
  const [dragOverStageId, setDragOverStageId] = useState<number | null>(null);

  // Group deals by stage
  const dealsByStage = useMemo(() => {
    const map: Record<number, DealWithContact[]> = {};
    if (pipelineData?.stages) {
      for (const stage of pipelineData.stages) {
        map[stage.id] = [];
      }
    }
    if (dealsData) {
      for (const item of dealsData) {
        if (map[item.deal.stageId]) {
          map[item.deal.stageId].push(item as DealWithContact);
        }
      }
    }
    return map;
  }, [dealsData, pipelineData?.stages]);

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

  // ─── Render ───
  if (accountsLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!accountId && !accountsLoading) {
    return <NoAccountSelected />;
  }

  const stages = pipelineData?.stages || [];

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between p-4 pb-2 shrink-0">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-semibold">Pipeline</h1>
          {pipelineData?.pipeline && (
            <Badge variant="outline" className="text-xs">
              {pipelineData.pipeline.name}
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          {/* Account selector removed — use sidebar AccountSwitcher */}
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
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="flex-1 overflow-x-auto p-4 pt-2">
          <div className="flex gap-3 h-full min-h-[500px]">
            {stages.map((stage) => (
              <StageColumn
                key={stage.id}
                stage={stage}
                deals={dealsByStage[stage.id] || []}
                isDragOver={dragOverStageId === stage.id}
                draggedDealId={draggedDealId}
                accountId={accountId!}
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
  onDragStart: (e: React.DragEvent, dealId: number) => void;
  onDragOver: (e: React.DragEvent, stageId: number) => void;
  onDragLeave: () => void;
  onDrop: (e: React.DragEvent, stageId: number) => void;
  onDragEnd: () => void;
  onDeleteDeal: (dealId: number) => void;
  onNavigateContact: (contactId: number) => void;
}

function StageColumn({
  stage,
  deals,
  isDragOver,
  draggedDealId,
  onDragStart,
  onDragOver,
  onDragLeave,
  onDrop,
  onDragEnd,
  onDeleteDeal,
  onNavigateContact,
}: StageColumnProps) {
  const totalValue = deals.reduce((sum, d) => sum + (d.deal.value || 0), 0);

  return (
    <div
      className={`flex flex-col w-[280px] min-w-[280px] rounded-lg transition-colors ${
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
            onDragStart={onDragStart}
            onDragEnd={onDragEnd}
            onDelete={onDeleteDeal}
            onNavigateContact={onNavigateContact}
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
  onDragStart: (e: React.DragEvent, dealId: number) => void;
  onDragEnd: () => void;
  onDelete: (dealId: number) => void;
  onNavigateContact: (contactId: number) => void;
}

function DealCard({
  item,
  isDragging,
  onDragStart,
  onDragEnd,
  onDelete,
  onNavigateContact,
}: DealCardProps) {
  const { deal, contact } = item;

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
          <div className="flex-1 min-w-0">
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
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0">
                <MoreHorizontal className="h-3.5 w-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => onNavigateContact(contact.id)}>
                <User className="h-4 w-4 mr-2" />
                View Contact
              </DropdownMenuItem>
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
            <div className="flex items-center gap-1 text-xs font-medium text-emerald-400">
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
