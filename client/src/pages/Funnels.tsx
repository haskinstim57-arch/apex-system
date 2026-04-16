import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { useAccount } from "@/contexts/AccountContext";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Plus, ArrowLeft, Search, ChevronUp, ChevronDown,
  FileText, Trash2, Pencil, ExternalLink, LayoutTemplate, Globe,
} from "lucide-react";
import { useLocation } from "wouter";

type FunnelStep = { pageId: number; label: string; order: number };

function StepCard({
  step, index, total, pages, onRemove, onMove, onEdit,
}: {
  step: FunnelStep; index: number; total: number; pages: any[];
  onRemove: () => void; onMove: (d: "up" | "down") => void; onEdit: (pid: number) => void;
}) {
  const page = pages.find((p: any) => p.id === step.pageId);
  return (
    <div className="flex items-center gap-3 p-3 rounded-lg border bg-card">
      <div className="flex flex-col gap-0.5">
        <Button variant="ghost" size="icon" className="h-5 w-5" disabled={index === 0} onClick={() => onMove("up")}>
          <ChevronUp className="h-3 w-3" />
        </Button>
        <Button variant="ghost" size="icon" className="h-5 w-5" disabled={index === total - 1} onClick={() => onMove("down")}>
          <ChevronDown className="h-3 w-3" />
        </Button>
      </div>
      <div className="flex items-center justify-center h-8 w-8 rounded-full bg-primary/10 text-primary text-sm font-bold shrink-0">
        {index + 1}
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-medium text-sm truncate">{step.label}</p>
        <p className="text-xs text-muted-foreground truncate">/{page?.slug || "unknown"}</p>
      </div>
      <Badge variant={page?.status === "published" ? "default" : "secondary"} className={page?.status === "published" ? "bg-green-500/90 text-white text-xs" : "text-xs"}>
        {page?.status || "unknown"}
      </Badge>
      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onEdit(step.pageId)}>
        <Pencil className="h-3.5 w-3.5" />
      </Button>
      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={onRemove}>
        <Trash2 className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}

export default function Funnels() {
  const { currentAccountId: accountId } = useAccount();
  const [, navigate] = useLocation();
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [search, setSearch] = useState("");
  const [editId, setEditId] = useState<number | null>(null);
  const [editSteps, setEditSteps] = useState<FunnelStep[]>([]);
  const [editName, setEditName] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [addPageId, setAddPageId] = useState<string>("");

  const { data: funnelsList = [], isLoading } = trpc.funnels.list.useQuery(
    { accountId: accountId! }, { enabled: !!accountId }
  );
  const { data: pages = [] } = trpc.landingPages.list.useQuery(
    { accountId: accountId! }, { enabled: !!accountId }
  );
  const utils = trpc.useUtils();

  const createMut = trpc.funnels.create.useMutation({
    onSuccess: (r) => {
      utils.funnels.list.invalidate();
      setShowCreate(false);
      toast.success("Funnel created — add steps now.");
      setEditId(r.id); setEditName(newName); setEditDesc(newDescription); setEditSteps([]);
      setNewName(""); setNewDescription("");
    },
    onError: (e) => toast.error(e.message),
  });
  const updateMut = trpc.funnels.update.useMutation({
    onSuccess: () => { utils.funnels.list.invalidate(); toast.success("Funnel saved"); },
    onError: (e) => toast.error(e.message),
  });
  const deleteMut = trpc.funnels.delete.useMutation({
    onSuccess: () => { utils.funnels.list.invalidate(); setEditId(null); toast.success("Funnel deleted"); },
    onError: (e) => toast.error(e.message),
  });

  const filtered = useMemo(() => {
    if (!search) return funnelsList;
    const q = search.toLowerCase();
    return funnelsList.filter((f: any) => f.name.toLowerCase().includes(q));
  }, [funnelsList, search]);

  function openEditor(f: any) {
    setEditId(f.id); setEditName(f.name); setEditDesc(f.description || "");
    setEditSteps(Array.isArray(f.steps) ? f.steps : []); setAddPageId("");
  }

  function addStep() {
    if (!addPageId) return;
    const pid = parseInt(addPageId);
    const pg = pages.find((p: any) => p.id === pid);
    if (!pg) return;
    setEditSteps([...editSteps, { pageId: pid, label: (pg as any).title, order: editSteps.length + 1 }]);
    setAddPageId("");
  }

  function removeStep(i: number) {
    setEditSteps(editSteps.filter((_, idx) => idx !== i).map((s, idx) => ({ ...s, order: idx + 1 })));
  }

  function moveStep(i: number, d: "up" | "down") {
    const arr = [...editSteps];
    const j = d === "up" ? i - 1 : i + 1;
    if (j < 0 || j >= arr.length) return;
    [arr[i], arr[j]] = [arr[j], arr[i]];
    setEditSteps(arr.map((s, idx) => ({ ...s, order: idx + 1 })));
  }

  function saveFunnel() {
    if (!editId || !accountId) return;
    updateMut.mutate({ id: editId, accountId, name: editName, description: editDesc, steps: editSteps });
  }

  if (!accountId) return <div className="flex items-center justify-center h-64 text-muted-foreground">Select a sub-account to manage funnels</div>;

  // ── Editor View ──
  if (editId) {
    const available = pages.filter((p: any) => !editSteps.some((s) => s.pageId === p.id));
    return (
      <div className="flex-1 overflow-auto p-6 space-y-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => setEditId(null)}>
            <ArrowLeft className="h-4 w-4 mr-1" /> Back
          </Button>
          <div className="h-5 w-px bg-border" />
          <h1 className="text-xl font-bold">Edit Funnel</h1>
        </div>
        <Card>
          <CardContent className="p-6 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div><Label>Funnel Name</Label><Input value={editName} onChange={(e) => setEditName(e.target.value)} /></div>
              <div><Label>Description</Label><Input value={editDesc} onChange={(e) => setEditDesc(e.target.value)} placeholder="Optional description" /></div>
            </div>
          </CardContent>
        </Card>

        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">Funnel Steps</h2>
            <p className="text-sm text-muted-foreground">{editSteps.length} step{editSteps.length !== 1 ? "s" : ""}</p>
          </div>

          {editSteps.length === 0 ? (
            <Card><CardContent className="flex flex-col items-center py-12 text-center">
              <LayoutTemplate className="h-10 w-10 text-muted-foreground/30 mb-3" />
              <p className="text-muted-foreground text-sm">No steps yet. Add landing pages to build your funnel flow.</p>
            </CardContent></Card>
          ) : (
            <div className="space-y-2">
              {editSteps.map((step, i) => (
                <StepCard key={`${step.pageId}-${i}`} step={step} index={i} total={editSteps.length} pages={pages}
                  onRemove={() => removeStep(i)} onMove={(d) => moveStep(i, d)} onEdit={(pid) => navigate(`/pages/${pid}/editor`)} />
              ))}
            </div>
          )}

          <div className="flex items-center gap-2 mt-4">
            <Select value={addPageId} onValueChange={setAddPageId}>
              <SelectTrigger className="w-[280px]"><SelectValue placeholder="Select a page to add..." /></SelectTrigger>
              <SelectContent>
                {available.length === 0 ? (
                  <div className="p-3 text-sm text-muted-foreground text-center">No available pages</div>
                ) : (
                  available.map((p: any) => (
                    <SelectItem key={p.id} value={String(p.id)}>
                      <span className="flex items-center gap-2">
                        {p.status === "published" ? <Globe className="h-3 w-3 text-green-500" /> : <FileText className="h-3 w-3 text-muted-foreground" />}
                        {p.title}
                      </span>
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
            <Button variant="outline" onClick={addStep} disabled={!addPageId}><Plus className="h-4 w-4 mr-1" /> Add Step</Button>
          </div>
        </div>

        <div className="flex items-center gap-2 pt-4 border-t">
          <Button onClick={saveFunnel} disabled={updateMut.isPending}>{updateMut.isPending ? "Saving..." : "Save Funnel"}</Button>
          <Button variant="outline" onClick={() => setEditId(null)}>Cancel</Button>
          <div className="flex-1" />
          <Button variant="destructive" size="sm" onClick={() => { if (confirm("Delete this funnel?")) deleteMut.mutate({ id: editId, accountId: accountId! }); }}>
            <Trash2 className="h-4 w-4 mr-1" /> Delete
          </Button>
        </div>
      </div>
    );
  }

  // ── List View ──
  return (
    <div className="flex-1 overflow-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Funnels</h1>
          <p className="text-muted-foreground text-sm mt-1">Create multi-step funnels by chaining landing pages together</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => navigate("/pages")}><FileText className="h-4 w-4 mr-2" /> Pages</Button>
          <Button onClick={() => setShowCreate(true)}><Plus className="h-4 w-4 mr-2" /> New Funnel</Button>
        </div>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Search funnels..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => <Card key={i} className="animate-pulse"><CardContent className="p-6"><div className="h-20 bg-muted rounded mb-3" /><div className="h-4 bg-muted rounded w-3/4" /></CardContent></Card>)}
        </div>
      ) : filtered.length === 0 ? (
        <Card><CardContent className="flex flex-col items-center py-16 text-center">
          <LayoutTemplate className="h-12 w-12 text-muted-foreground/30 mb-4" />
          <h3 className="text-lg font-semibold mb-1">{search ? "No funnels match" : "No funnels yet"}</h3>
          <p className="text-muted-foreground text-sm mb-4">{search ? "Try different terms" : "Create your first funnel to guide leads through a multi-step journey"}</p>
          {!search && <Button onClick={() => setShowCreate(true)}><Plus className="h-4 w-4 mr-2" /> Create First Funnel</Button>}
        </CardContent></Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((f: any) => {
            const steps: FunnelStep[] = Array.isArray(f.steps) ? f.steps : [];
            return (
              <Card key={f.id} className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => openEditor(f)}>
                <CardContent className="p-5">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div className="p-2 rounded-lg bg-primary/10"><LayoutTemplate className="h-4 w-4 text-primary" /></div>
                      <div>
                        <h3 className="font-semibold text-sm">{f.name}</h3>
                        {f.description && <p className="text-xs text-muted-foreground truncate max-w-[180px]">{f.description}</p>}
                      </div>
                    </div>
                    <Badge variant={f.status === "active" ? "default" : "secondary"} className={f.status === "active" ? "bg-green-500/90 text-white text-xs" : "text-xs"}>
                      {f.status}
                    </Badge>
                  </div>
                  {steps.length > 0 ? (
                    <div className="space-y-1.5">
                      {steps.slice(0, 4).map((s, i) => (
                        <div key={i} className="flex items-center gap-2 text-xs">
                          <span className="flex items-center justify-center h-5 w-5 rounded-full bg-muted text-muted-foreground font-medium text-[10px]">{i + 1}</span>
                          <span className="truncate">{s.label}</span>
                        </div>
                      ))}
                      {steps.length > 4 && <p className="text-xs text-muted-foreground pl-7">+{steps.length - 4} more steps</p>}
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground italic">No steps configured</p>
                  )}
                  <p className="text-xs text-muted-foreground mt-3">Updated {new Date(f.updatedAt).toLocaleDateString()}</p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent>
          <DialogHeader><DialogTitle>Create Funnel</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>Funnel Name</Label><Input placeholder="e.g., Mortgage Lead Funnel" value={newName} onChange={(e) => setNewName(e.target.value)} /></div>
            <div><Label>Description (optional)</Label><Input placeholder="Brief description..." value={newDescription} onChange={(e) => setNewDescription(e.target.value)} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
            <Button onClick={() => createMut.mutate({ accountId: accountId!, name: newName, description: newDescription })} disabled={!newName.trim() || createMut.isPending}>
              {createMut.isPending ? "Creating..." : "Create Funnel"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
