import { useState, useRef, useEffect } from "react";
import { trpc } from "../lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { format } from "date-fns";
import {
  Loader2,
  MessageSquare,
  ExternalLink,
  LifeBuoy,
  ArrowLeft,
  Send,
  User,
  ShieldCheck,
} from "lucide-react";
import { toast } from "sonner";

export default function SupportAdmin() {
  const { user } = useAuth();
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selectedTicketId, setSelectedTicketId] = useState<number | null>(null);

  const { data: tickets, isLoading, refetch } = trpc.support.listAll.useQuery(
    statusFilter === "all" ? undefined : { status: statusFilter as any }
  );

  const updateStatusMut = trpc.support.updateStatus.useMutation({
    onSuccess: () => refetch(),
  });

  const handleStatusChange = (ticketId: number, newStatus: string) => {
    updateStatusMut.mutate({ ticketId, status: newStatus as any });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "open":
        return "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400";
      case "in_progress":
        return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400";
      case "resolved":
        return "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400";
      case "closed":
        return "bg-gray-100 text-gray-800 dark:bg-gray-800/50 dark:text-gray-400";
      default:
        return "bg-gray-100 text-gray-800 dark:bg-gray-800/50 dark:text-gray-400";
    }
  };

  const getCategoryLabel = (cat: string) => {
    const labels: Record<string, string> = {
      bug: "Bug Report",
      feature: "Feature Request",
      billing: "Billing",
      general: "General",
    };
    return labels[cat] || cat;
  };

  const openCount = tickets?.filter((t) => t.status === "open").length || 0;
  const inProgressCount = tickets?.filter((t) => t.status === "in_progress").length || 0;

  // If a ticket is selected, show the detail/thread view
  if (selectedTicketId) {
    return (
      <TicketDetail
        ticketId={selectedTicketId}
        onBack={() => setSelectedTicketId(null)}
        getStatusColor={getStatusColor}
        getCategoryLabel={getCategoryLabel}
        onStatusChange={handleStatusChange}
        isUpdatingStatus={updateStatusMut.isPending}
        userName={user?.name || "Staff"}
        refetchList={refetch}
      />
    );
  }

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Support Tickets</h1>
          <p className="text-muted-foreground text-sm">
            Manage issues reported by sub-accounts.
          </p>
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Tickets</SelectItem>
            <SelectItem value="open">Open</SelectItem>
            <SelectItem value="in_progress">In Progress</SelectItem>
            <SelectItem value="resolved">Resolved</SelectItem>
            <SelectItem value="closed">Closed</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-3">
        <Card className="bg-card border-0 card-shadow">
          <CardContent className="pt-4 pb-3">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Total</p>
            <p className="text-xl font-semibold mt-0.5">{tickets?.length || 0}</p>
          </CardContent>
        </Card>
        <Card className="bg-card border-0 card-shadow">
          <CardContent className="pt-4 pb-3">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Open</p>
            <p className="text-xl font-semibold mt-0.5 text-red-600">{openCount}</p>
          </CardContent>
        </Card>
        <Card className="bg-card border-0 card-shadow">
          <CardContent className="pt-4 pb-3">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">In Progress</p>
            <p className="text-xl font-semibold mt-0.5 text-amber-600">{inProgressCount}</p>
          </CardContent>
        </Card>
      </div>

      {isLoading ? (
        <div className="flex justify-center p-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : !tickets || tickets.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <LifeBuoy className="h-12 w-12 text-muted-foreground mb-4 opacity-20" />
            <h3 className="text-lg font-medium">No tickets found</h3>
            <p className="text-sm text-muted-foreground mt-1">
              No support tickets match the current filter.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3">
          {tickets.map((ticket) => (
            <Card
              key={ticket.id}
              className="bg-card border-0 card-shadow cursor-pointer hover:ring-2 hover:ring-primary/20 transition-all"
              onClick={() => setSelectedTicketId(ticket.id)}
            >
              <CardHeader className="pb-3">
                <div className="flex justify-between items-start">
                  <div>
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <Badge variant="outline" className="uppercase text-[10px]">
                        {getCategoryLabel(ticket.category)}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        Account #{ticket.accountId} &middot; User #{ticket.userId}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        &middot; {format(new Date(ticket.createdAt), "MMM d, yyyy h:mm a")}
                      </span>
                    </div>
                    <CardTitle className="text-lg">
                      #{ticket.id} &mdash; {ticket.subject}
                    </CardTitle>
                  </div>
                  <div
                    onClick={(e) => e.stopPropagation()}
                  >
                    <Select
                      value={ticket.status}
                      onValueChange={(val) => handleStatusChange(ticket.id, val)}
                      disabled={updateStatusMut.isPending}
                    >
                      <SelectTrigger
                        className={`w-[140px] h-8 text-xs font-medium ${getStatusColor(ticket.status)} border-0`}
                      >
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="open">Open</SelectItem>
                        <SelectItem value="in_progress">In Progress</SelectItem>
                        <SelectItem value="resolved">Resolved</SelectItem>
                        <SelectItem value="closed">Closed</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground line-clamp-2">{ticket.message}</p>
                {ticket.screenshotUrl && (
                  <div className="mt-2">
                    <span className="text-xs text-blue-600 flex items-center gap-1">
                      <ExternalLink className="h-3 w-3" /> Has attachment
                    </span>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Ticket Detail with Thread View ─────────────────────────────────────

function TicketDetail({
  ticketId,
  onBack,
  getStatusColor,
  getCategoryLabel,
  onStatusChange,
  isUpdatingStatus,
  userName,
  refetchList,
}: {
  ticketId: number;
  onBack: () => void;
  getStatusColor: (s: string) => string;
  getCategoryLabel: (c: string) => string;
  onStatusChange: (id: number, status: string) => void;
  isUpdatingStatus: boolean;
  userName: string;
  refetchList: () => void;
}) {
  const [replyText, setReplyText] = useState("");
  const threadEndRef = useRef<HTMLDivElement>(null);
  const utils = trpc.useUtils();

  const { data: ticket, isLoading } = trpc.support.getById.useQuery(
    { ticketId },
    { enabled: !!ticketId }
  );

  const replyMut = trpc.support.reply.useMutation({
    onSuccess: () => {
      setReplyText("");
      utils.support.getById.invalidate({ ticketId });
      refetchList();
      toast.success("Reply sent successfully");
    },
    onError: (err) => toast.error(err.message),
  });

  // Scroll to bottom of thread when new messages arrive
  useEffect(() => {
    if (ticket?.replies) {
      threadEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [ticket?.replies?.length]);

  const handleSendReply = () => {
    if (!replyText.trim()) return;
    replyMut.mutate({
      ticketId,
      body: replyText.trim(),
      authorType: "apex_staff",
    });
  };

  if (isLoading) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <div className="flex justify-center p-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  if (!ticket) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <Button variant="ghost" onClick={onBack} className="gap-1.5 mb-4">
          <ArrowLeft className="h-4 w-4" /> Back to tickets
        </Button>
        <p className="text-muted-foreground">Ticket not found.</p>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={onBack} className="gap-1.5">
          <ArrowLeft className="h-4 w-4" /> Back
        </Button>
      </div>

      {/* Ticket metadata */}
      <Card className="bg-card border-0 card-shadow">
        <CardHeader className="pb-3">
          <div className="flex justify-between items-start">
            <div>
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <Badge variant="outline" className="uppercase text-[10px]">
                  {getCategoryLabel(ticket.category)}
                </Badge>
                <span className="text-xs text-muted-foreground">
                  Account #{ticket.accountId}
                </span>
                <span className="text-xs text-muted-foreground">
                  &middot; {format(new Date(ticket.createdAt), "MMM d, yyyy h:mm a")}
                </span>
              </div>
              <CardTitle className="text-xl">
                #{ticket.id} &mdash; {ticket.subject}
              </CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                Submitted by <span className="font-medium text-foreground">{ticket.submitterName}</span>
                {ticket.submitterEmail && (
                  <span className="text-xs"> ({ticket.submitterEmail})</span>
                )}
              </p>
            </div>
            <Select
              value={ticket.status}
              onValueChange={(val) => onStatusChange(ticket.id, val)}
              disabled={isUpdatingStatus}
            >
              <SelectTrigger
                className={`w-[140px] h-8 text-xs font-medium ${getStatusColor(ticket.status)} border-0`}
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="open">Open</SelectItem>
                <SelectItem value="in_progress">In Progress</SelectItem>
                <SelectItem value="resolved">Resolved</SelectItem>
                <SelectItem value="closed">Closed</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
      </Card>

      {/* Thread view */}
      <Card className="bg-card border-0 card-shadow">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <MessageSquare className="h-4 w-4 text-muted-foreground" />
            Conversation
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1">
            {/* Original message */}
            <div className="flex justify-start">
              <div className="max-w-[80%]">
                <div className="flex items-center gap-1.5 mb-1">
                  <User className="h-3 w-3 text-muted-foreground" />
                  <span className="text-xs font-medium">{ticket.submitterName}</span>
                  <span className="text-[10px] text-muted-foreground">
                    {format(new Date(ticket.createdAt), "MMM d, h:mm a")}
                  </span>
                </div>
                <div className="bg-muted/50 rounded-lg rounded-tl-sm px-3.5 py-2.5 text-sm whitespace-pre-wrap">
                  {ticket.message}
                </div>
                {ticket.screenshotUrl && (
                  <a
                    href={ticket.screenshotUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-[10px] text-blue-600 hover:underline flex items-center gap-1 mt-1"
                  >
                    <ExternalLink className="h-2.5 w-2.5" /> View attachment
                  </a>
                )}
              </div>
            </div>

            {/* Replies */}
            {ticket.replies?.map((reply: any) => {
              const isStaff = reply.authorType === "apex_staff";
              return (
                <div
                  key={reply.id}
                  className={`flex ${isStaff ? "justify-end" : "justify-start"}`}
                >
                  <div className="max-w-[80%]">
                    <div className={`flex items-center gap-1.5 mb-1 ${isStaff ? "justify-end" : ""}`}>
                      {isStaff ? (
                        <ShieldCheck className="h-3 w-3 text-primary" />
                      ) : (
                        <User className="h-3 w-3 text-muted-foreground" />
                      )}
                      <span className="text-xs font-medium">
                        {isStaff ? "Apex Staff" : ticket.submitterName}
                      </span>
                      <span className="text-[10px] text-muted-foreground">
                        {format(new Date(reply.createdAt), "MMM d, h:mm a")}
                      </span>
                    </div>
                    <div
                      className={`rounded-lg px-3.5 py-2.5 text-sm whitespace-pre-wrap ${
                        isStaff
                          ? "bg-primary text-primary-foreground rounded-tr-sm"
                          : "bg-muted/50 rounded-tl-sm"
                      }`}
                    >
                      {reply.body}
                    </div>
                  </div>
                </div>
              );
            })}
            <div ref={threadEndRef} />
          </div>

          {/* Reply input */}
          <div className="mt-4 pt-4 border-t border-border/30">
            <div className="flex gap-2">
              <Textarea
                placeholder="Type your reply..."
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                rows={3}
                className="resize-none"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                    handleSendReply();
                  }
                }}
              />
            </div>
            <div className="flex justify-between items-center mt-2">
              <p className="text-[10px] text-muted-foreground">
                Ctrl+Enter to send &middot; Reply will email the client
              </p>
              <Button
                size="sm"
                onClick={handleSendReply}
                disabled={!replyText.trim() || replyMut.isPending}
                className="gap-1.5"
              >
                {replyMut.isPending ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Send className="h-3.5 w-3.5" />
                )}
                Send Reply
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
