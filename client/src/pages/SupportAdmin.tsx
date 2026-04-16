import { useState } from "react";
import { trpc } from "../lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { format } from "date-fns";
import { Loader2, MessageSquare, ExternalLink, LifeBuoy } from "lucide-react";

export default function SupportAdmin() {
  const [statusFilter, setStatusFilter] = useState<string>("all");

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
        <div className="grid gap-4">
          {tickets.map((ticket) => (
            <Card key={ticket.id} className="bg-card border-0 card-shadow">
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
              </CardHeader>
              <CardContent>
                <div className="bg-muted/30 p-4 rounded-md text-sm whitespace-pre-wrap">
                  {ticket.message}
                </div>
                {ticket.screenshotUrl && (
                  <div className="mt-4">
                    <a
                      href={ticket.screenshotUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs text-blue-600 hover:underline flex items-center gap-1"
                    >
                      <ExternalLink className="h-3 w-3" /> View attached screenshot
                    </a>
                  </div>
                )}
                {ticket.adminNotes && (
                  <div className="mt-3 pt-3 border-t border-border/30">
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-0.5">
                      Admin Notes
                    </p>
                    <p className="text-xs text-foreground">{ticket.adminNotes}</p>
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
