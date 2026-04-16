import { useState } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { useAccount } from "@/contexts/AccountContext";
import { NoAccountSelected } from "@/components/NoAccountSelected";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  LifeBuoy,
  Send,
  Loader2,
  Clock,
  CheckCircle2,
  AlertCircle,
  XCircle,
  MessageSquare,
} from "lucide-react";
import { toast } from "sonner";

const statusConfig: Record<string, { label: string; color: string; icon: typeof Clock }> = {
  open: { label: "Open", color: "bg-blue-500/10 text-blue-600 border-blue-200", icon: Clock },
  in_progress: { label: "In Progress", color: "bg-amber-500/10 text-amber-600 border-amber-200", icon: AlertCircle },
  resolved: { label: "Resolved", color: "bg-emerald-500/10 text-emerald-600 border-emerald-200", icon: CheckCircle2 },
  closed: { label: "Closed", color: "bg-muted text-muted-foreground border-border", icon: XCircle },
};

const categoryLabels: Record<string, string> = {
  bug: "Bug Report",
  feature: "Feature Request",
  billing: "Billing Question",
  general: "General",
};

export default function Support() {
  const { user } = useAuth();
  const { currentAccountId: accountId, isLoading: accountsLoading } = useAccount();
  const utils = trpc.useUtils();

  const [subject, setSubject] = useState("");
  const [category, setCategory] = useState<"bug" | "feature" | "billing" | "general">("general");
  const [message, setMessage] = useState("");
  const [showForm, setShowForm] = useState(false);

  const { data: tickets, isLoading: ticketsLoading } = trpc.support.list.useQuery(
    { accountId: accountId! },
    { enabled: !!accountId }
  );

  const submitMutation = trpc.support.submit.useMutation({
    onSuccess: (data) => {
      toast.success(`Ticket #${data.ticketId} submitted successfully!`);
      setSubject("");
      setCategory("general");
      setMessage("");
      setShowForm(false);
      utils.support.list.invalidate({ accountId: accountId! });
    },
    onError: (err) => toast.error(err.message),
  });

  if (!accountId) return <NoAccountSelected />;

  if (accountsLoading || ticketsLoading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-48 bg-muted animate-pulse rounded" />
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-20 bg-muted animate-pulse rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  const openCount = tickets?.filter((t) => t.status === "open").length || 0;
  const inProgressCount = tickets?.filter((t) => t.status === "in_progress").length || 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Support</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Submit a ticket and our team will get back to you.
          </p>
        </div>
        <Button
          size="sm"
          className="gap-1.5"
          onClick={() => setShowForm(!showForm)}
        >
          <MessageSquare className="h-3.5 w-3.5" />
          {showForm ? "Cancel" : "New Ticket"}
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <Card className="bg-card border-0 card-shadow">
          <CardContent className="pt-4 pb-3">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Total Tickets</p>
            <p className="text-xl font-semibold mt-0.5">{tickets?.length || 0}</p>
          </CardContent>
        </Card>
        <Card className="bg-card border-0 card-shadow">
          <CardContent className="pt-4 pb-3">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Open</p>
            <p className="text-xl font-semibold mt-0.5 text-blue-600">{openCount}</p>
          </CardContent>
        </Card>
        <Card className="bg-card border-0 card-shadow">
          <CardContent className="pt-4 pb-3">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">In Progress</p>
            <p className="text-xl font-semibold mt-0.5 text-amber-600">{inProgressCount}</p>
          </CardContent>
        </Card>
      </div>

      {/* New Ticket Form */}
      {showForm && (
        <Card className="bg-card border-0 card-shadow">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <LifeBuoy className="h-4 w-4 text-primary" />
              Submit a Support Ticket
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Subject</label>
                <Input
                  placeholder="Brief description of your issue"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  maxLength={500}
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Category</label>
                <Select value={category} onValueChange={(v: any) => setCategory(v)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="general">General</SelectItem>
                    <SelectItem value="bug">Bug Report</SelectItem>
                    <SelectItem value="feature">Feature Request</SelectItem>
                    <SelectItem value="billing">Billing Question</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Message</label>
              <Textarea
                placeholder="Describe your issue in detail..."
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={5}
                maxLength={5000}
              />
              <p className="text-[10px] text-muted-foreground text-right">
                {message.length}/5000
              </p>
            </div>
            <div className="flex justify-end">
              <Button
                onClick={() => {
                  if (!subject.trim() || !message.trim()) {
                    toast.error("Please fill in the subject and message.");
                    return;
                  }
                  submitMutation.mutate({
                    accountId: accountId!,
                    subject: subject.trim(),
                    category,
                    message: message.trim(),
                  });
                }}
                disabled={!subject.trim() || !message.trim() || submitMutation.isPending}
                className="gap-1.5"
              >
                {submitMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
                Submit Ticket
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tickets List */}
      <Card className="bg-card border-0 card-shadow">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <LifeBuoy className="h-4 w-4 text-muted-foreground" />
            Your Tickets
          </CardTitle>
        </CardHeader>
        <CardContent>
          {tickets && tickets.length > 0 ? (
            <div className="space-y-2">
              {tickets.map((ticket) => {
                const status = statusConfig[ticket.status] || statusConfig.open;
                const StatusIcon = status.icon;
                return (
                  <div
                    key={ticket.id}
                    className="p-3 rounded-lg border border-border/30 hover:bg-muted/30 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-medium truncate">
                            #{ticket.id} — {ticket.subject}
                          </p>
                          <Badge
                            variant="outline"
                            className={`text-[10px] h-4 px-1.5 shrink-0 ${status.color}`}
                          >
                            <StatusIcon className="h-2.5 w-2.5 mr-0.5" />
                            {status.label}
                          </Badge>
                          <Badge
                            variant="outline"
                            className="text-[10px] h-4 px-1.5 shrink-0"
                          >
                            {categoryLabels[ticket.category] || ticket.category}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                          {ticket.message}
                        </p>
                        <p className="text-[10px] text-muted-foreground mt-1.5">
                          Submitted {new Date(ticket.createdAt).toLocaleDateString()} at{" "}
                          {new Date(ticket.createdAt).toLocaleTimeString()}
                        </p>
                      </div>
                    </div>
                    {ticket.adminNotes && (
                      <div className="mt-2 pt-2 border-t border-border/30">
                        <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-0.5">
                          Admin Response
                        </p>
                        <p className="text-xs text-foreground">{ticket.adminNotes}</p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-8">
              <LifeBuoy className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">
                No support tickets yet.
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Click "New Ticket" to submit your first request.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
