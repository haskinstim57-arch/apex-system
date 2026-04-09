import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { trpc } from "@/lib/trpc";
import { useAccount } from "@/contexts/AccountContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Phone,
  PhoneOff,
  SkipForward,
  Play,
  Pause,
  CheckCircle2,
  XCircle,
  Voicemail,
  PhoneMissed,
  Clock,
  User,
  Building2,
  FileText,
  Download,
  ArrowLeft,
  Loader2,
  PhoneCall,
  Timer,
  AlertCircle,
  RotateCcw,
} from "lucide-react";
import { toast } from "sonner";

// ─── Types ───
type Disposition =
  | "answered"
  | "no_answer"
  | "left_voicemail"
  | "not_interested"
  | "callback_requested"
  | "skipped"
  | "failed";

interface SessionResult {
  contactId: number;
  disposition: string;
  notes: string;
  callId?: number;
  calledAt?: string;
}

type Screen = "setup" | "dialing" | "summary";

// ─── Disposition config ───
const dispositions: Array<{
  value: Disposition;
  label: string;
  icon: React.ElementType;
  color: string;
}> = [
  { value: "answered", label: "Answered", icon: CheckCircle2, color: "bg-emerald-500/10 text-emerald-600 border-emerald-200 hover:bg-emerald-500/20" },
  { value: "no_answer", label: "No Answer", icon: PhoneMissed, color: "bg-amber-500/10 text-amber-600 border-amber-200 hover:bg-amber-500/20" },
  { value: "left_voicemail", label: "Left Voicemail", icon: Voicemail, color: "bg-blue-500/10 text-blue-600 border-blue-200 hover:bg-blue-500/20" },
  { value: "not_interested", label: "Not Interested", icon: XCircle, color: "bg-red-500/10 text-red-600 border-red-200 hover:bg-red-500/20" },
  { value: "callback_requested", label: "Callback Requested", icon: Clock, color: "bg-purple-500/10 text-purple-600 border-purple-200 hover:bg-purple-500/20" },
];

export default function PowerDialer() {
  const { currentAccountId: accountId } = useAccount();

  // ─── Screen state ───
  const [screen, setScreen] = useState<Screen>("setup");
  const [sessionId, setSessionId] = useState<number | null>(null);

  // ─── Setup state ───
  const [selectionMode, setSelectionMode] = useState<"tag" | "all">("tag");
  const [selectedTag, setSelectedTag] = useState<string>("");
  const [selectedScriptId, setSelectedScriptId] = useState<string>("none");
  const [selectedContactIds, setSelectedContactIds] = useState<number[]>([]);

  // ─── Active dialer state ───
  const [callStatus, setCallStatus] = useState<"idle" | "calling" | "connected" | "ended">("idle");
  const [currentCallId, setCurrentCallId] = useState<number | null>(null);
  const [selectedDisposition, setSelectedDisposition] = useState<Disposition | null>(null);
  const [callNotes, setCallNotes] = useState("");
  const [callTimer, setCallTimer] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ─── Queries ───
  const contactsQuery = trpc.contacts.list.useQuery(
    { accountId: accountId!, limit: 100, offset: 0 },
    { enabled: !!accountId }
  );

  // Get unique tags from contacts
  const tagsQuery = trpc.contacts.list.useQuery(
    { accountId: accountId!, limit: 1, offset: 0 },
    { enabled: !!accountId }
  );

  // Fetch contacts by tag when a tag is selected
  const tagContactsQuery = trpc.powerDialer.getContactsByTag.useQuery(
    { accountId: accountId!, tag: selectedTag, limit: 500 },
    { enabled: !!accountId && selectionMode === "tag" && !!selectedTag }
  );

  const scriptsQuery = trpc.powerDialer.listScripts.useQuery(
    { accountId: accountId! },
    { enabled: !!accountId }
  );

  const sessionQuery = trpc.powerDialer.getSession.useQuery(
    { id: sessionId!, accountId: accountId! },
    { enabled: !!sessionId && !!accountId, refetchInterval: screen === "dialing" ? 5000 : false }
  );

  const currentContactQuery = trpc.powerDialer.getCurrentContact.useQuery(
    { sessionId: sessionId!, accountId: accountId! },
    { enabled: !!sessionId && !!accountId && screen === "dialing" }
  );

  const sessionsListQuery = trpc.powerDialer.listSessions.useQuery(
    { accountId: accountId!, limit: 10 },
    { enabled: !!accountId && screen === "setup" }
  );

  // ─── Mutations ───
  const createSessionMutation = trpc.powerDialer.createSession.useMutation();
  const initiateCallMutation = trpc.powerDialer.initiateCall.useMutation();
  const recordDispositionMutation = trpc.powerDialer.recordDisposition.useMutation();
  const completeSessionMutation = trpc.powerDialer.completeSession.useMutation();
  const pauseSessionMutation = trpc.powerDialer.pauseSession.useMutation();

  // ─── Unique tags from all contacts ───
  const uniqueTags = useMemo(() => {
    if (!contactsQuery.data?.data) return [];
    const tagSet = new Set<string>();
    contactsQuery.data.data.forEach((c: any) => {
      if (c.tags) {
        (Array.isArray(c.tags) ? c.tags : [c.tags]).forEach((t: any) => {
          if (typeof t === "string") tagSet.add(t);
          else if (t?.tag) tagSet.add(t.tag);
        });
      }
    });
    return Array.from(tagSet).sort();
  }, [contactsQuery.data]);

  // ─── Timer logic ───
  useEffect(() => {
    if (callStatus === "calling" || callStatus === "connected") {
      timerRef.current = setInterval(() => {
        setCallTimer((prev) => prev + 1);
      }, 1000);
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [callStatus]);

  const formatTimer = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  // ─── Start session ───
  const handleStartSession = async () => {
    if (!accountId) return;

    let contactIds: number[] = [];

    if (selectionMode === "tag" && tagContactsQuery.data) {
      contactIds = tagContactsQuery.data.contacts.map((c: any) => c.id);
    } else if (selectionMode === "all" && contactsQuery.data) {
      contactIds = contactsQuery.data.data
        .filter((c: any) => c.phone)
        .map((c: any) => c.id);
    }

    if (contactIds.length === 0) {
      toast.error("No contacts with phone numbers found for the selected criteria.");
      return;
    }

    try {
      const result = await createSessionMutation.mutateAsync({
        accountId,
        contactIds,
        scriptId: selectedScriptId !== "none" ? parseInt(selectedScriptId) : undefined,
      });
      setSessionId(result.id);
      setScreen("dialing");
      setCallStatus("idle");
      toast.success(`Session started with ${result.totalContacts} contacts`);
    } catch (err: any) {
      toast.error(err.message || "Failed to start session");
    }
  };

  // ─── Resume a paused session ───
  const handleResumeSession = async (id: number) => {
    setSessionId(id);
    setScreen("dialing");
    setCallStatus("idle");
    setSelectedDisposition(null);
    setCallNotes("");
  };

  // ─── Initiate call ───
  const handleCall = async () => {
    if (!accountId || !sessionId || !currentContactQuery.data?.contact) return;

    const contact = currentContactQuery.data.contact;
    setCallStatus("calling");
    setCallTimer(0);

    try {
      const result = await initiateCallMutation.mutateAsync({
        sessionId,
        accountId,
        contactId: contact.id,
      });

      if (result.success) {
        setCurrentCallId(result.callId);
        setCallStatus("connected");
      } else {
        setCallStatus("ended");
        toast.error(result.error || "Call failed");
      }
    } catch (err: any) {
      setCallStatus("ended");
      toast.error(err.message || "Failed to initiate call");
    }
  };

  // ─── Skip contact ───
  const handleSkip = async () => {
    if (!accountId || !sessionId || !currentContactQuery.data?.contact) return;

    try {
      const result = await recordDispositionMutation.mutateAsync({
        sessionId,
        accountId,
        contactId: currentContactQuery.data.contact.id,
        disposition: "skipped",
        notes: callNotes || undefined,
      });

      if (result.isComplete) {
        setScreen("summary");
      } else {
        // Reset for next contact
        setCallStatus("idle");
        setSelectedDisposition(null);
        setCallNotes("");
        setCurrentCallId(null);
        setCallTimer(0);
        currentContactQuery.refetch();
        sessionQuery.refetch();
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to skip contact");
    }
  };

  // ─── End call (mark as ended) ───
  const handleHangUp = () => {
    setCallStatus("ended");
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  // ─── Record disposition and advance ───
  const handleNextContact = async () => {
    if (!accountId || !sessionId || !currentContactQuery.data?.contact || !selectedDisposition)
      return;

    try {
      const result = await recordDispositionMutation.mutateAsync({
        sessionId,
        accountId,
        contactId: currentContactQuery.data.contact.id,
        disposition: selectedDisposition,
        notes: callNotes || undefined,
        callId: currentCallId || undefined,
      });

      if (result.isComplete) {
        setScreen("summary");
        sessionQuery.refetch();
      } else {
        // Reset for next contact
        setCallStatus("idle");
        setSelectedDisposition(null);
        setCallNotes("");
        setCurrentCallId(null);
        setCallTimer(0);
        currentContactQuery.refetch();
        sessionQuery.refetch();
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to record disposition");
    }
  };

  // ─── End session early ───
  const handleEndSession = async () => {
    if (!accountId || !sessionId) return;

    try {
      await completeSessionMutation.mutateAsync({ sessionId, accountId });
      setScreen("summary");
      sessionQuery.refetch();
    } catch (err: any) {
      toast.error(err.message || "Failed to end session");
    }
  };

  // ─── Pause session ───
  const handlePauseSession = async () => {
    if (!accountId || !sessionId) return;

    try {
      await pauseSessionMutation.mutateAsync({ sessionId, accountId });
      setScreen("setup");
      sessionsListQuery.refetch();
      toast.success("Session paused");
    } catch (err: any) {
      toast.error(err.message || "Failed to pause session");
    }
  };

  // ─── Export CSV ───
  const handleExportCSV = () => {
    if (!sessionQuery.data) return;

    const results = sessionQuery.data.results;
    const headers = ["Contact ID", "Disposition", "Notes", "Call ID", "Called At"];
    const rows = results.map((r: SessionResult) => [
      r.contactId,
      r.disposition,
      `"${(r.notes || "").replace(/"/g, '""')}"`,
      r.callId || "",
      r.calledAt || "",
    ]);

    const csv = [headers.join(","), ...rows.map((r: any) => r.join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `dialer-session-${sessionId}-results.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (!accountId) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <p className="text-muted-foreground">Please select a sub-account first.</p>
      </div>
    );
  }

  // ═══════════════════════════════════════════
  // SETUP SCREEN
  // ═══════════════════════════════════════════
  if (screen === "setup") {
    return (
      <div className="space-y-6 max-w-4xl mx-auto">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Power Dialer</h1>
          <p className="text-muted-foreground mt-1">
            Call through a list of contacts automatically, one at a time.
          </p>
        </div>

        {/* Resume paused sessions */}
        {sessionsListQuery.data && sessionsListQuery.data.data.filter((s: any) => s.status === "active" || s.status === "paused").length > 0 && (
          <Card className="border-amber-200 bg-amber-50/50">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <RotateCcw className="h-4 w-4 text-amber-600" />
                Resume Session
              </CardTitle>
              <CardDescription>You have active or paused sessions.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {sessionsListQuery.data.data
                .filter((s: any) => s.status === "active" || s.status === "paused")
                .map((s: any) => (
                  <div
                    key={s.id}
                    className="flex items-center justify-between p-3 bg-card rounded-lg border"
                  >
                    <div>
                      <p className="text-sm font-medium">
                        Session #{s.id} — {s.currentIndex} of {s.totalContacts} completed
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(s.createdAt).toLocaleString()} · Status: {s.status}
                      </p>
                    </div>
                    <Button
                      size="sm"
                      onClick={() => handleResumeSession(s.id)}
                    >
                      Resume
                    </Button>
                  </div>
                ))}
            </CardContent>
          </Card>
        )}

        {/* New session setup */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Start New Session</CardTitle>
            <CardDescription>
              Select contacts to call and optionally choose a call script.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            {/* Contact selection mode */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Contact Selection</label>
              <Select
                value={selectionMode}
                onValueChange={(v) => setSelectionMode(v as "tag" | "all")}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="tag">By Tag</SelectItem>
                  <SelectItem value="all">All Contacts with Phone</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Tag selector */}
            {selectionMode === "tag" && (
              <div className="space-y-2">
                <label className="text-sm font-medium">Select Tag</label>
                <Select value={selectedTag} onValueChange={setSelectedTag}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose a tag..." />
                  </SelectTrigger>
                  <SelectContent>
                    {uniqueTags.map((tag) => (
                      <SelectItem key={tag} value={tag}>
                        {tag}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {selectedTag && tagContactsQuery.data && (
                  <p className="text-sm text-muted-foreground">
                    {tagContactsQuery.data.total} contacts with phone numbers found
                  </p>
                )}
              </div>
            )}

            {selectionMode === "all" && contactsQuery.data && (
              <p className="text-sm text-muted-foreground">
                {contactsQuery.data.data.filter((c: any) => c.phone).length} contacts with phone numbers
              </p>
            )}

            {/* Script selector */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Call Script (Optional)</label>
              <Select value={selectedScriptId} onValueChange={setSelectedScriptId}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No Script</SelectItem>
                  {scriptsQuery.data?.map((script: any) => (
                    <SelectItem key={script.id} value={String(script.id)}>
                      {script.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Start button */}
            <Button
              className="w-full"
              size="lg"
              onClick={handleStartSession}
              disabled={
                createSessionMutation.isPending ||
                (selectionMode === "tag" && !selectedTag) ||
                (selectionMode === "tag" && tagContactsQuery.isLoading)
              }
            >
              {createSessionMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Play className="h-4 w-4 mr-2" />
              )}
              Start Dialer Session
            </Button>
          </CardContent>
        </Card>

        {/* Recent sessions */}
        {sessionsListQuery.data && sessionsListQuery.data.data.filter((s: any) => s.status === "completed").length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Recent Sessions</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {sessionsListQuery.data.data
                  .filter((s: any) => s.status === "completed")
                  .slice(0, 5)
                  .map((s: any) => (
                    <div
                      key={s.id}
                      className="flex items-center justify-between p-3 rounded-lg border cursor-pointer hover:bg-muted/50 transition-colors"
                      onClick={() => {
                        setSessionId(s.id);
                        setScreen("summary");
                      }}
                    >
                      <div>
                        <p className="text-sm font-medium">
                          Session #{s.id} — {s.totalContacts} contacts
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(s.createdAt).toLocaleString()}
                        </p>
                      </div>
                      <Badge variant="outline" className="bg-emerald-50 text-emerald-600 border-emerald-200">
                        Completed
                      </Badge>
                    </div>
                  ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    );
  }

  // ═══════════════════════════════════════════
  // ACTIVE DIALER SCREEN
  // ═══════════════════════════════════════════
  if (screen === "dialing") {
    const contact = currentContactQuery.data?.contact;
    const currentIndex = currentContactQuery.data?.currentIndex ?? 0;
    const totalContacts = currentContactQuery.data?.totalContacts ?? 0;
    const progressPercent = totalContacts > 0 ? (currentIndex / totalContacts) * 100 : 0;

    // If no more contacts, show summary
    if (currentContactQuery.data === null) {
      setScreen("summary");
      return null;
    }

    // Get the script content if one was selected
    const scriptId = sessionQuery.data?.scriptId;

    return (
      <div className="space-y-4 max-w-5xl mx-auto">
        {/* Header with progress */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold tracking-tight flex items-center gap-2">
              <PhoneCall className="h-5 w-5 text-primary" />
              Power Dialer
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Contact {currentIndex + 1} of {totalContacts}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handlePauseSession}>
              <Pause className="h-3.5 w-3.5 mr-1.5" />
              Pause
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="text-red-600 hover:text-red-700"
              onClick={handleEndSession}
            >
              End Session
            </Button>
          </div>
        </div>

        {/* Progress bar */}
        <div className="space-y-1">
          <Progress value={progressPercent} className="h-2" />
          <p className="text-xs text-muted-foreground text-right">
            {Math.round(progressPercent)}% complete
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Left: Contact info + call controls */}
          <div className="lg:col-span-2 space-y-4">
            {/* Contact card */}
            <Card>
              <CardContent className="pt-5">
                {currentContactQuery.isLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : contact ? (
                  <div className="space-y-4">
                    <div className="flex items-start justify-between">
                      <div>
                        <h2 className="text-lg font-semibold flex items-center gap-2">
                          <User className="h-4 w-4 text-muted-foreground" />
                          {contact.firstName} {contact.lastName}
                        </h2>
                        {contact.company && (
                          <p className="text-sm text-muted-foreground flex items-center gap-1.5 mt-0.5">
                            <Building2 className="h-3.5 w-3.5" />
                            {contact.company}
                          </p>
                        )}
                      </div>
                      {/* Call status badge */}
                      <Badge
                        variant="outline"
                        className={
                          callStatus === "idle"
                            ? "bg-zinc-100 text-zinc-600"
                            : callStatus === "calling"
                            ? "bg-amber-100 text-amber-700 animate-pulse"
                            : callStatus === "connected"
                            ? "bg-emerald-100 text-emerald-700"
                            : "bg-zinc-100 text-zinc-600"
                        }
                      >
                        {callStatus === "idle"
                          ? "Ready"
                          : callStatus === "calling"
                          ? "Calling..."
                          : callStatus === "connected"
                          ? "Connected"
                          : "Call Ended"}
                      </Badge>
                    </div>

                    {/* Contact details */}
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div>
                        <p className="text-xs text-muted-foreground">Phone</p>
                        <p className="font-medium">{contact.phone || "—"}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Email</p>
                        <p className="font-medium truncate">{contact.email || "—"}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Lead Source</p>
                        <p className="font-medium">{contact.leadSource || "—"}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Status</p>
                        <p className="font-medium capitalize">{contact.status || "—"}</p>
                      </div>
                    </div>

                    {/* Call timer */}
                    {(callStatus === "calling" || callStatus === "connected") && (
                      <div className="flex items-center justify-center py-3">
                        <div className="flex items-center gap-2 text-2xl font-mono font-bold">
                          <Timer className="h-5 w-5 text-primary" />
                          {formatTimer(callTimer)}
                        </div>
                      </div>
                    )}

                    {/* Call action buttons */}
                    <div className="flex items-center gap-3">
                      {callStatus === "idle" && (
                        <>
                          <Button
                            className="flex-1"
                            size="lg"
                            onClick={handleCall}
                            disabled={initiateCallMutation.isPending || !contact.phone}
                          >
                            {initiateCallMutation.isPending ? (
                              <Loader2 className="h-4 w-4 animate-spin mr-2" />
                            ) : (
                              <Phone className="h-4 w-4 mr-2" />
                            )}
                            Call {contact.firstName}
                          </Button>
                          <Button variant="outline" size="lg" onClick={handleSkip}>
                            <SkipForward className="h-4 w-4 mr-2" />
                            Skip
                          </Button>
                        </>
                      )}
                      {(callStatus === "calling" || callStatus === "connected") && (
                        <Button
                          variant="destructive"
                          size="lg"
                          className="flex-1"
                          onClick={handleHangUp}
                        >
                          <PhoneOff className="h-4 w-4 mr-2" />
                          Hang Up
                        </Button>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <AlertCircle className="h-8 w-8 mx-auto mb-2" />
                    <p>Contact not found</p>
                    <Button variant="outline" size="sm" className="mt-3" onClick={handleSkip}>
                      Skip to Next
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Disposition + Notes (shown after call ends) */}
            {callStatus === "ended" && (
              <Card className="border-primary/30">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Call Disposition</CardTitle>
                  <CardDescription>Select the outcome and add notes before moving to the next contact.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Disposition buttons */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {dispositions.map((d) => {
                      const Icon = d.icon;
                      const isSelected = selectedDisposition === d.value;
                      return (
                        <button
                          key={d.value}
                          onClick={() => setSelectedDisposition(d.value)}
                          className={`flex items-center gap-2 px-3 py-2.5 rounded-lg border text-sm font-medium transition-all ${
                            isSelected
                              ? d.color + " ring-2 ring-offset-1 ring-primary/30"
                              : "bg-background hover:bg-muted/50 text-foreground border-border"
                          }`}
                        >
                          <Icon className="h-4 w-4 shrink-0" />
                          {d.label}
                        </button>
                      );
                    })}
                  </div>

                  {/* Notes */}
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium">Notes</label>
                    <Textarea
                      placeholder="Add quick notes about this call..."
                      value={callNotes}
                      onChange={(e) => setCallNotes(e.target.value)}
                      rows={3}
                    />
                  </div>

                  {/* Next contact button */}
                  <Button
                    className="w-full"
                    size="lg"
                    onClick={handleNextContact}
                    disabled={!selectedDisposition || recordDispositionMutation.isPending}
                  >
                    {recordDispositionMutation.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : (
                      <SkipForward className="h-4 w-4 mr-2" />
                    )}
                    Next Contact
                  </Button>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Right: Script panel */}
          <div className="space-y-4">
            {scriptId && (
              <ScriptPanel scriptId={scriptId} accountId={accountId} />
            )}

            {/* Session stats */}
            {sessionQuery.data && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Session Progress</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Completed</span>
                      <span className="font-medium">{sessionQuery.data.results.length}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Remaining</span>
                      <span className="font-medium">
                        {sessionQuery.data.totalContacts - sessionQuery.data.currentIndex}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Answered</span>
                      <span className="font-medium text-emerald-600">
                        {sessionQuery.data.results.filter((r: SessionResult) => r.disposition === "answered").length}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">No Answer</span>
                      <span className="font-medium text-amber-600">
                        {sessionQuery.data.results.filter((r: SessionResult) => r.disposition === "no_answer").length}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Skipped</span>
                      <span className="font-medium text-zinc-500">
                        {sessionQuery.data.results.filter((r: SessionResult) => r.disposition === "skipped").length}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ═══════════════════════════════════════════
  // SUMMARY SCREEN
  // ═══════════════════════════════════════════
  if (screen === "summary") {
    const results = sessionQuery.data?.results ?? [];
    const totalCalled = results.length;
    const answered = results.filter((r: SessionResult) => r.disposition === "answered").length;
    const noAnswer = results.filter((r: SessionResult) => r.disposition === "no_answer").length;
    const voicemail = results.filter((r: SessionResult) => r.disposition === "left_voicemail").length;
    const notInterested = results.filter((r: SessionResult) => r.disposition === "not_interested").length;
    const callbacks = results.filter((r: SessionResult) => r.disposition === "callback_requested").length;
    const skipped = results.filter((r: SessionResult) => r.disposition === "skipped").length;

    return (
      <div className="space-y-6 max-w-3xl mx-auto">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setScreen("setup");
              setSessionId(null);
              sessionsListQuery.refetch();
            }}
          >
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back
          </Button>
          <div>
            <h1 className="text-xl font-bold tracking-tight">Session Summary</h1>
            <p className="text-sm text-muted-foreground">
              Session #{sessionId} — {sessionQuery.data?.totalContacts ?? 0} total contacts
            </p>
          </div>
        </div>

        {/* Stats grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Card>
            <CardContent className="pt-4 pb-3 text-center">
              <p className="text-2xl font-bold">{totalCalled}</p>
              <p className="text-xs text-muted-foreground">Total Processed</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-3 text-center">
              <p className="text-2xl font-bold text-emerald-600">{answered}</p>
              <p className="text-xs text-muted-foreground">Answered</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-3 text-center">
              <p className="text-2xl font-bold text-amber-600">{noAnswer}</p>
              <p className="text-xs text-muted-foreground">No Answer</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-3 text-center">
              <p className="text-2xl font-bold text-blue-600">{voicemail}</p>
              <p className="text-xs text-muted-foreground">Voicemail</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-3 text-center">
              <p className="text-2xl font-bold text-red-600">{notInterested}</p>
              <p className="text-xs text-muted-foreground">Not Interested</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-3 text-center">
              <p className="text-2xl font-bold text-purple-600">{callbacks}</p>
              <p className="text-xs text-muted-foreground">Callbacks</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-3 text-center">
              <p className="text-2xl font-bold text-zinc-500">{skipped}</p>
              <p className="text-xs text-muted-foreground">Skipped</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-3 text-center">
              <p className="text-2xl font-bold">
                {totalCalled > 0 ? Math.round((answered / totalCalled) * 100) : 0}%
              </p>
              <p className="text-xs text-muted-foreground">Answer Rate</p>
            </CardContent>
          </Card>
        </div>

        {/* Results table */}
        {results.length > 0 && (
          <Card>
            <CardHeader className="pb-3 flex flex-row items-center justify-between">
              <CardTitle className="text-base">Call Results</CardTitle>
              <Button variant="outline" size="sm" onClick={handleExportCSV}>
                <Download className="h-3.5 w-3.5 mr-1.5" />
                Export CSV
              </Button>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2 px-2 font-medium text-muted-foreground">#</th>
                      <th className="text-left py-2 px-2 font-medium text-muted-foreground">Contact</th>
                      <th className="text-left py-2 px-2 font-medium text-muted-foreground">Disposition</th>
                      <th className="text-left py-2 px-2 font-medium text-muted-foreground">Notes</th>
                      <th className="text-left py-2 px-2 font-medium text-muted-foreground">Time</th>
                    </tr>
                  </thead>
                  <tbody>
                    {results.map((r: SessionResult, i: number) => (
                      <tr key={i} className="border-b last:border-0">
                        <td className="py-2 px-2 text-muted-foreground">{i + 1}</td>
                        <td className="py-2 px-2">ID: {r.contactId}</td>
                        <td className="py-2 px-2">
                          <Badge
                            variant="outline"
                            className={
                              r.disposition === "answered"
                                ? "bg-emerald-50 text-emerald-600 border-emerald-200"
                                : r.disposition === "no_answer"
                                ? "bg-amber-50 text-amber-600 border-amber-200"
                                : r.disposition === "left_voicemail"
                                ? "bg-blue-50 text-blue-600 border-blue-200"
                                : r.disposition === "not_interested"
                                ? "bg-red-50 text-red-600 border-red-200"
                                : r.disposition === "callback_requested"
                                ? "bg-purple-50 text-purple-600 border-purple-200"
                                : "bg-zinc-50 text-zinc-500 border-zinc-200"
                            }
                          >
                            {r.disposition.replace(/_/g, " ")}
                          </Badge>
                        </td>
                        <td className="py-2 px-2 max-w-[200px] truncate">
                          {r.notes || "—"}
                        </td>
                        <td className="py-2 px-2 text-muted-foreground text-xs">
                          {r.calledAt ? new Date(r.calledAt).toLocaleTimeString() : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Actions */}
        <div className="flex gap-3">
          <Button
            onClick={() => {
              setScreen("setup");
              setSessionId(null);
              setCallStatus("idle");
              setSelectedDisposition(null);
              setCallNotes("");
              setCurrentCallId(null);
              setCallTimer(0);
              sessionsListQuery.refetch();
            }}
          >
            <Play className="h-4 w-4 mr-2" />
            Start New Session
          </Button>
        </div>
      </div>
    );
  }

  return null;
}

// ─── Script Panel Component ───
function ScriptPanel({ scriptId, accountId }: { scriptId: number; accountId: number }) {
  const scriptQuery = trpc.powerDialer.getScript.useQuery(
    { id: scriptId, accountId },
    { enabled: !!scriptId && !!accountId }
  );

  if (!scriptQuery.data) return null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <FileText className="h-4 w-4 text-primary" />
          {scriptQuery.data.name}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-sm whitespace-pre-wrap leading-relaxed bg-muted/30 rounded-lg p-3 max-h-[400px] overflow-y-auto">
          {scriptQuery.data.content}
        </div>
      </CardContent>
    </Card>
  );
}
