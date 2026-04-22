import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { useAccount } from "@/contexts/AccountContext";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Separator } from "@/components/ui/separator";
import {
  Search,
  Users,
  Mail,
  Phone,
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Loader2,
  GitMerge,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  FileText,
  MessageSquare,
  PhoneCall,
  Calendar,
  Briefcase,
  ClipboardList,
  Star,
  Zap,
} from "lucide-react";

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

interface DuplicateContact {
  id: number;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  leadSource: string | null;
  status: string;
  company: string | null;
  createdAt: Date;
  updatedAt: Date;
}

interface DuplicateGroup {
  key: string;
  matchType: "email" | "phone";
  matchValue: string;
  contacts: DuplicateContact[];
  score: number;
}

// ─────────────────────────────────────────────
// Merge fields definition
// ─────────────────────────────────────────────

const MERGE_FIELDS = [
  { key: "firstName", label: "First Name", required: true },
  { key: "lastName", label: "Last Name", required: true },
  { key: "email", label: "Email" },
  { key: "phone", label: "Phone" },
  { key: "leadSource", label: "Lead Source" },
  { key: "status", label: "Status" },
  { key: "company", label: "Company" },
  { key: "title", label: "Title" },
  { key: "address", label: "Address" },
  { key: "city", label: "City" },
  { key: "state", label: "State" },
  { key: "zip", label: "ZIP" },
  { key: "assignedUserId", label: "Assigned User" },
] as const;

// ─────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────

export default function ContactMerge() {
  const { currentAccountId: accountId } = useAccount();
  const [matchBy, setMatchBy] = useState<"email" | "phone" | "both">("both");
  const [mergeGroup, setMergeGroup] = useState<DuplicateGroup | null>(null);
  const [expandedGroup, setExpandedGroup] = useState<string | null>(null);

  const duplicatesQuery = trpc.contactMerge.findDuplicates.useQuery(
    { matchBy },
    { enabled: !!accountId }
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Contact Merge Tool</h1>
          <p className="text-muted-foreground mt-1">
            Detect and merge duplicate contacts to keep your database clean
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Select value={matchBy} onValueChange={(v: string) => setMatchBy(v as any)}>
            <SelectTrigger className="w-[160px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="both">Email & Phone</SelectItem>
              <SelectItem value="email">Email Only</SelectItem>
              <SelectItem value="phone">Phone Only</SelectItem>
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            size="sm"
            onClick={() => duplicatesQuery.refetch()}
            disabled={duplicatesQuery.isFetching}
          >
            {duplicatesQuery.isFetching ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <RefreshCw className="h-4 w-4 mr-2" />
            )}
            Scan
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      {duplicatesQuery.data && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-amber-500/10">
                  <AlertTriangle className="h-5 w-5 text-amber-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{duplicatesQuery.data.totalGroups}</p>
                  <p className="text-sm text-muted-foreground">Duplicate Groups</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-red-500/10">
                  <Users className="h-5 w-5 text-red-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{duplicatesQuery.data.totalDuplicates}</p>
                  <p className="text-sm text-muted-foreground">Extra Contacts</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-green-500/10">
                  <CheckCircle2 className="h-5 w-5 text-green-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">
                    {duplicatesQuery.data.totalGroups === 0 ? "Clean" : "Action Needed"}
                  </p>
                  <p className="text-sm text-muted-foreground">Database Status</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Loading State */}
      {duplicatesQuery.isLoading && (
        <Card>
          <CardContent className="py-12 flex flex-col items-center gap-3">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            <p className="text-muted-foreground">Scanning for duplicates...</p>
          </CardContent>
        </Card>
      )}

      {/* Empty State */}
      {duplicatesQuery.data && duplicatesQuery.data.totalGroups === 0 && (
        <Card>
          <CardContent className="py-12 flex flex-col items-center gap-3">
            <CheckCircle2 className="h-12 w-12 text-green-500" />
            <h3 className="text-lg font-semibold">No Duplicates Found</h3>
            <p className="text-muted-foreground text-center max-w-md">
              Your contact database is clean. No duplicate contacts were detected
              based on {matchBy === "both" ? "email or phone" : matchBy} matching.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Duplicate Groups */}
      {duplicatesQuery.data && duplicatesQuery.data.groups.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-lg font-semibold">
            Duplicate Groups ({duplicatesQuery.data.groups.length})
          </h2>
          {duplicatesQuery.data.groups.map((group: DuplicateGroup) => (
            <DuplicateGroupCard
              key={group.key}
              group={group}
              isExpanded={expandedGroup === group.key}
              onToggle={() =>
                setExpandedGroup(expandedGroup === group.key ? null : group.key)
              }
              onMerge={() => setMergeGroup(group)}
            />
          ))}
        </div>
      )}

      {/* Merge Dialog */}
      {mergeGroup && (
        <MergeDialog
          group={mergeGroup}
          open={!!mergeGroup}
          onClose={() => setMergeGroup(null)}
          onMerged={() => {
            setMergeGroup(null);
            duplicatesQuery.refetch();
          }}
        />
      )}
    </div>
  );
}

// ─────────────────────────────────────────────
// Duplicate Group Card
// ─────────────────────────────────────────────

function DuplicateGroupCard({
  group,
  isExpanded,
  onToggle,
  onMerge,
}: {
  group: DuplicateGroup;
  isExpanded: boolean;
  onToggle: () => void;
  onMerge: () => void;
}) {
  return (
    <Card className="overflow-hidden">
      <div
        className="flex items-center justify-between p-4 cursor-pointer hover:bg-muted/50 transition-colors"
        onClick={onToggle}
      >
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-muted">
            {group.matchType === "email" ? (
              <Mail className="h-4 w-4 text-blue-500" />
            ) : (
              <Phone className="h-4 w-4 text-green-500" />
            )}
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-medium">{group.matchValue}</span>
              <Badge variant={group.score >= 100 ? "destructive" : "secondary"} className="text-xs">
                {group.score}% match
              </Badge>
              <Badge variant="outline" className="text-xs">
                {group.matchType}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              {group.contacts.length} contacts share this {group.matchType}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" onClick={(e) => { e.stopPropagation(); onMerge(); }}>
            <GitMerge className="h-4 w-4 mr-1" />
            Merge
          </Button>
          {isExpanded ? (
            <ChevronUp className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          )}
        </div>
      </div>

      {isExpanded && (
        <div className="border-t">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/30">
                  <th className="text-left p-3 font-medium">Name</th>
                  <th className="text-left p-3 font-medium">Email</th>
                  <th className="text-left p-3 font-medium">Phone</th>
                  <th className="text-left p-3 font-medium">Source</th>
                  <th className="text-left p-3 font-medium">Status</th>
                  <th className="text-left p-3 font-medium">Created</th>
                </tr>
              </thead>
              <tbody>
                {group.contacts.map((c: DuplicateContact) => (
                  <tr key={c.id} className="border-b last:border-0 hover:bg-muted/20">
                    <td className="p-3 font-medium">
                      {c.firstName} {c.lastName}
                      <span className="text-muted-foreground ml-1">#{c.id}</span>
                    </td>
                    <td className="p-3 text-muted-foreground">{c.email || "—"}</td>
                    <td className="p-3 text-muted-foreground">{c.phone || "—"}</td>
                    <td className="p-3">
                      {c.leadSource ? (
                        <Badge variant="outline" className="text-xs">{c.leadSource}</Badge>
                      ) : "—"}
                    </td>
                    <td className="p-3">
                      <Badge variant="secondary" className="text-xs capitalize">{c.status}</Badge>
                    </td>
                    <td className="p-3 text-muted-foreground">
                      {new Date(c.createdAt).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </Card>
  );
}

// ─────────────────────────────────────────────
// Merge Dialog
// ─────────────────────────────────────────────

function MergeDialog({
  group,
  open,
  onClose,
  onMerged,
}: {
  group: DuplicateGroup;
  open: boolean;
  onClose: () => void;
  onMerged: () => void;
}) {
  const [winnerId, setWinnerId] = useState<number>(group.contacts[0]?.id ?? 0);
  const [fieldOverrides, setFieldOverrides] = useState<Record<string, any>>({});
  const [step, setStep] = useState<"select" | "review">("select");

  const contactIds = useMemo(() => group.contacts.map((c: DuplicateContact) => c.id), [group]);

  const previewQuery = trpc.contactMerge.mergePreview.useQuery(
    { contactIds },
    { enabled: open && contactIds.length >= 2 }
  );

  const mergeMut = trpc.contactMerge.merge.useMutation({
    onSuccess: (data) => {
      toast.success(data.message);
      onMerged();
    },
    onError: (err) => {
      toast.error(err.message);
    },
  });

  const loserIds = contactIds.filter((id: number) => id !== winnerId);
  const winnerContact = group.contacts.find((c: DuplicateContact) => c.id === winnerId);
  const loserContacts = group.contacts.filter((c: DuplicateContact) => c.id !== winnerId);

  // Get the preview data for each contact
  const getPreview = (id: number) =>
    previewQuery.data?.previews?.find((p: any) => p.contact.id === id);

  const totalRelatedFromLosers = loserIds.reduce((sum: number, id: number) => {
    const p = getPreview(id);
    return sum + (p?.totalRelated ?? 0);
  }, 0);

  const handleMerge = () => {
    mergeMut.mutate({
      winnerId,
      loserIds,
      fieldOverrides: Object.keys(fieldOverrides).length > 0 ? fieldOverrides : undefined,
    });
  };

  const getFieldValue = (contact: DuplicateContact, key: string) => {
    return (contact as any)[key] ?? null;
  };

  const getResolvedValue = (key: string) => {
    if (fieldOverrides[key] !== undefined) return fieldOverrides[key];
    return getFieldValue(winnerContact!, key);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <GitMerge className="h-5 w-5" />
            Merge {group.contacts.length} Contacts
          </DialogTitle>
          <DialogDescription>
            {step === "select"
              ? "Choose the primary contact (winner) and customize which field values to keep."
              : "Review the merge and confirm. This action cannot be undone."}
          </DialogDescription>
        </DialogHeader>

        {step === "select" && (
          <div className="space-y-6">
            {/* Winner Selection */}
            <div>
              <Label className="text-sm font-semibold mb-3 block">
                Select Primary Contact (Winner)
              </Label>
              <RadioGroup
                value={String(winnerId)}
                onValueChange={(v: string) => setWinnerId(Number(v))}
                className="space-y-2"
              >
                {group.contacts.map((c: DuplicateContact) => {
                  const preview = getPreview(c.id);
                  return (
                    <label
                      key={c.id}
                      className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                        winnerId === c.id
                          ? "border-primary bg-primary/5"
                          : "border-border hover:bg-muted/50"
                      }`}
                    >
                      <RadioGroupItem value={String(c.id)} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">
                            {c.firstName} {c.lastName}
                          </span>
                          <span className="text-muted-foreground text-xs">#{c.id}</span>
                          {winnerId === c.id && (
                            <Badge className="text-xs">Winner</Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
                          {c.email && (
                            <span className="flex items-center gap-1">
                              <Mail className="h-3 w-3" /> {c.email}
                            </span>
                          )}
                          {c.phone && (
                            <span className="flex items-center gap-1">
                              <Phone className="h-3 w-3" /> {c.phone}
                            </span>
                          )}
                          <span>
                            Created {new Date(c.createdAt).toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                      {preview && (
                        <Badge variant="outline" className="text-xs shrink-0">
                          {preview.totalRelated} records
                        </Badge>
                      )}
                    </label>
                  );
                })}
              </RadioGroup>
            </div>

            <Separator />

            {/* Field-by-Field Picker */}
            <div>
              <Label className="text-sm font-semibold mb-3 block">
                Choose Field Values
              </Label>
              <p className="text-xs text-muted-foreground mb-3">
                By default, the winner's values are used. Override specific fields by selecting from other contacts.
              </p>
              <div className="space-y-2">
                {MERGE_FIELDS.map((field) => {
                  const values = group.contacts.map((c: DuplicateContact) => ({
                    id: c.id,
                    name: `${c.firstName} ${c.lastName}`,
                    value: getFieldValue(c, field.key),
                  }));
                  // Only show fields where contacts have different values
                  const uniqueValues = new Set(
                    values.map((v: any) => String(v.value ?? ""))
                  );
                  if (uniqueValues.size <= 1) return null;

                  return (
                    <div
                      key={field.key}
                      className="flex items-center gap-3 p-2 rounded-lg border bg-muted/20"
                    >
                      <span className="text-sm font-medium w-28 shrink-0">
                        {field.label}
                      </span>
                      <div className="flex-1 flex flex-wrap gap-1">
                        {values.map((v: any) => {
                          if (!v.value && v.value !== 0) return null;
                          const isSelected =
                            fieldOverrides[field.key] !== undefined
                              ? fieldOverrides[field.key] === v.value
                              : v.id === winnerId;
                          return (
                            <button
                              key={v.id}
                              onClick={() => {
                                if (v.id === winnerId) {
                                  // Remove override to use winner's value
                                  const next = { ...fieldOverrides };
                                  delete next[field.key];
                                  setFieldOverrides(next);
                                } else {
                                  setFieldOverrides({
                                    ...fieldOverrides,
                                    [field.key]: v.value,
                                  });
                                }
                              }}
                              className={`text-xs px-2 py-1 rounded-md border transition-colors ${
                                isSelected
                                  ? "border-primary bg-primary/10 text-primary font-medium"
                                  : "border-border hover:border-primary/50"
                              }`}
                            >
                              {String(v.value)}
                              <span className="text-muted-foreground ml-1">
                                (#{v.id})
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="flex justify-end">
              <Button onClick={() => setStep("review")}>
                Review Merge <ArrowRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          </div>
        )}

        {step === "review" && (
          <div className="space-y-6">
            {/* Winner Summary */}
            <Card className="border-primary">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                  Keeping: {winnerContact?.firstName} {winnerContact?.lastName} #{winnerId}
                </CardTitle>
                <CardDescription>
                  This contact will be preserved with all records merged into it.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  {MERGE_FIELDS.map((field) => {
                    const val = getResolvedValue(field.key);
                    if (!val && val !== 0) return null;
                    return (
                      <div key={field.key} className="flex gap-2">
                        <span className="text-muted-foreground">{field.label}:</span>
                        <span className="font-medium">{String(val)}</span>
                        {fieldOverrides[field.key] !== undefined && (
                          <Badge variant="outline" className="text-xs">overridden</Badge>
                        )}
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            {/* Losers Summary */}
            <Card className="border-destructive/30">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-amber-500" />
                  Merging & Removing: {loserContacts.length} contact(s)
                </CardTitle>
                <CardDescription>
                  These contacts will be archived (soft-deleted) after all their records are reassigned.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {loserContacts.map((c: DuplicateContact) => {
                    const preview = getPreview(c.id);
                    return (
                      <div key={c.id} className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between p-2 rounded-lg bg-muted/30">
                        <div>
                          <span className="font-medium">
                            {c.firstName} {c.lastName}
                          </span>
                          <span className="text-muted-foreground ml-1">#{c.id}</span>
                        </div>
                        {preview && (
                          <div className="flex flex-wrap gap-1">
                            {preview.relatedCounts.notes > 0 && (
                              <Badge variant="outline" className="text-xs">
                                <FileText className="h-3 w-3 mr-1" />
                                {preview.relatedCounts.notes} notes
                              </Badge>
                            )}
                            {preview.relatedCounts.messages > 0 && (
                              <Badge variant="outline" className="text-xs">
                                <MessageSquare className="h-3 w-3 mr-1" />
                                {preview.relatedCounts.messages} msgs
                              </Badge>
                            )}
                            {preview.relatedCounts.calls > 0 && (
                              <Badge variant="outline" className="text-xs">
                                <PhoneCall className="h-3 w-3 mr-1" />
                                {preview.relatedCounts.calls} calls
                              </Badge>
                            )}
                            {preview.relatedCounts.deals > 0 && (
                              <Badge variant="outline" className="text-xs">
                                <Briefcase className="h-3 w-3 mr-1" />
                                {preview.relatedCounts.deals} deals
                              </Badge>
                            )}
                            {preview.relatedCounts.tasks > 0 && (
                              <Badge variant="outline" className="text-xs">
                                <ClipboardList className="h-3 w-3 mr-1" />
                                {preview.relatedCounts.tasks} tasks
                              </Badge>
                            )}
                            {preview.relatedCounts.appointments > 0 && (
                              <Badge variant="outline" className="text-xs">
                                <Calendar className="h-3 w-3 mr-1" />
                                {preview.relatedCounts.appointments} appts
                              </Badge>
                            )}
                            {preview.relatedCounts.workflows > 0 && (
                              <Badge variant="outline" className="text-xs">
                                <Zap className="h-3 w-3 mr-1" />
                                {preview.relatedCounts.workflows} workflows
                              </Badge>
                            )}
                            {preview.relatedCounts.reviews > 0 && (
                              <Badge variant="outline" className="text-xs">
                                <Star className="h-3 w-3 mr-1" />
                                {preview.relatedCounts.reviews} reviews
                              </Badge>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            {/* Merge Summary */}
            <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
                <div className="text-sm">
                  <p className="font-semibold text-amber-700 dark:text-amber-400">
                    This action cannot be undone
                  </p>
                  <p className="text-muted-foreground mt-1">
                    {totalRelatedFromLosers} related record(s) will be reassigned to the winner contact.
                    {loserContacts.length} contact(s) will be archived (soft-deleted).
                    Custom fields will be merged (winner values take priority).
                  </p>
                </div>
              </div>
            </div>

            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={() => setStep("select")}>
                Back
              </Button>
              <Button
                variant="destructive"
                onClick={handleMerge}
                disabled={mergeMut.isPending}
              >
                {mergeMut.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <GitMerge className="h-4 w-4 mr-2" />
                )}
                Confirm Merge
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
