import React, { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { useAccount } from "@/contexts/AccountContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Bell,
  MessageSquare,
  CalendarDays,
  CalendarX2,
  Phone,
  Send,
  Zap,
  UserPlus,
  PhoneMissed,
  FileText,
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Filter,
  X,
  CheckCircle2,
  Circle,
  Eye,
  Loader2,
} from "lucide-react";
import { useLocation } from "wouter";
import { cn } from "@/lib/utils";

const NOTIFICATION_TYPE_CONFIG: Record<string, { label: string; icon: React.ElementType; color: string; bg: string }> = {
  inbound_message: { label: "Inbound Message", icon: MessageSquare, color: "text-blue-500", bg: "bg-blue-500/10" },
  appointment_booked: { label: "Appointment Booked", icon: CalendarDays, color: "text-green-500", bg: "bg-green-500/10" },
  appointment_cancelled: { label: "Appointment Cancelled", icon: CalendarX2, color: "text-red-500", bg: "bg-red-500/10" },
  ai_call_completed: { label: "AI Call Completed", icon: Phone, color: "text-purple-500", bg: "bg-purple-500/10" },
  campaign_finished: { label: "Campaign Finished", icon: Send, color: "text-emerald-500", bg: "bg-emerald-500/10" },
  workflow_failed: { label: "Workflow Failed", icon: Zap, color: "text-orange-500", bg: "bg-orange-500/10" },
  new_contact_facebook: { label: "Facebook Lead", icon: UserPlus, color: "text-sky-500", bg: "bg-sky-500/10" },
  new_contact_booking: { label: "New Booking Contact", icon: UserPlus, color: "text-teal-500", bg: "bg-teal-500/10" },
  missed_call: { label: "Missed Call", icon: PhoneMissed, color: "text-rose-500", bg: "bg-rose-500/10" },
  report_sent: { label: "Report Sent", icon: FileText, color: "text-indigo-500", bg: "bg-indigo-500/10" },
};

function timeAgo(date: Date | string): string {
  const now = new Date();
  const d = typeof date === "string" ? new Date(date) : date;
  const diffMs = now.getTime() - d.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  if (diffSec < 60) return "just now";
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 7) return `${diffDay}d ago`;
  return d.toLocaleDateString();
}

function formatDate(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function NotificationLog() {
  const { currentAccountId } = useAccount();
  const [, navigate] = useLocation();
  const [page, setPage] = useState(1);
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [readFilter, setReadFilter] = useState<string>("all");
  const [showFilters, setShowFilters] = useState(false);
  const pageSize = 25;

  const queryInput = useMemo(() => ({
    accountId: currentAccountId!,
    page,
    pageSize,
    ...(typeFilter !== "all" ? { type: typeFilter } : {}),
    ...(readFilter === "read" ? { isRead: true } : readFilter === "unread" ? { isRead: false } : {}),
  }), [currentAccountId, page, typeFilter, readFilter]);

  const { data, isLoading } = trpc.notifications.log.useQuery(queryInput, {
    enabled: !!currentAccountId,
    refetchInterval: 30000,
  });

  const utils = trpc.useUtils();

  const markAsReadMutation = trpc.notifications.markAsRead.useMutation({
    onSuccess: () => {
      utils.notifications.log.invalidate();
      utils.notifications.unreadCount.invalidate();
    },
  });

  const markAllAsReadMutation = trpc.notifications.markAllAsRead.useMutation({
    onSuccess: () => {
      utils.notifications.log.invalidate();
      utils.notifications.unreadCount.invalidate();
    },
  });

  const hasActiveFilters = typeFilter !== "all" || readFilter !== "all";

  const clearFilters = () => {
    setTypeFilter("all");
    setReadFilter("all");
    setPage(1);
  };

  const handleNotificationClick = (notif: { id: number; link: string | null; isRead: boolean }) => {
    if (!notif.isRead && currentAccountId) {
      markAsReadMutation.mutate({ id: notif.id, accountId: currentAccountId });
    }
    if (notif.link) {
      navigate(notif.link);
    }
  };

  const handleMarkAllRead = () => {
    if (currentAccountId) {
      markAllAsReadMutation.mutate({ accountId: currentAccountId });
    }
  };

  if (!currentAccountId) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        <Card className="border-0 card-shadow">
          <CardContent className="py-12 text-center">
            <Bell className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground">Select a sub-account to view notification history.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
      {/* Header */}
      <div className="flex items-start gap-3">
        <Button
          variant="ghost"
          size="icon"
          className="h-9 w-9 shrink-0 mt-0.5"
          onClick={() => navigate("/settings")}
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold tracking-tight">Notification Log</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Full history of all notifications for this account.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5"
          onClick={() => setShowFilters(!showFilters)}
        >
          <Filter className="h-3.5 w-3.5" />
          Filters
          {hasActiveFilters && (
            <Badge variant="secondary" className="h-4 min-w-[16px] px-1 text-[10px] rounded-full">
              {(typeFilter !== "all" ? 1 : 0) + (readFilter !== "all" ? 1 : 0)}
            </Badge>
          )}
        </Button>
      </div>

      {/* Filters */}
      {showFilters && (
        <Card className="border-0 card-shadow">
          <CardContent className="pt-4 pb-4">
            <div className="flex flex-wrap items-end gap-3">
              <div className="space-y-1.5 min-w-[180px]">
                <label className="text-xs font-medium text-muted-foreground">Type</label>
                <Select value={typeFilter} onValueChange={(v) => { setTypeFilter(v); setPage(1); }}>
                  <SelectTrigger className="h-9 text-sm">
                    <SelectValue placeholder="All types" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All types</SelectItem>
                    {Object.entries(NOTIFICATION_TYPE_CONFIG).map(([key, cfg]) => (
                      <SelectItem key={key} value={key}>{cfg.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5 min-w-[140px]">
                <label className="text-xs font-medium text-muted-foreground">Status</label>
                <Select value={readFilter} onValueChange={(v) => { setReadFilter(v); setPage(1); }}>
                  <SelectTrigger className="h-9 text-sm">
                    <SelectValue placeholder="All" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                    <SelectItem value="unread">Unread</SelectItem>
                    <SelectItem value="read">Read</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {hasActiveFilters && (
                <Button variant="ghost" size="sm" className="h-9 text-xs gap-1" onClick={clearFilters}>
                  <X className="h-3 w-3" />
                  Clear filters
                </Button>
              )}

              <div className="ml-auto">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-9 text-xs gap-1.5"
                  onClick={handleMarkAllRead}
                  disabled={markAllAsReadMutation.isPending}
                >
                  <Eye className="h-3.5 w-3.5" />
                  Mark all read
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Summary bar */}
      {data && (
        <div className="flex items-center justify-between text-xs text-muted-foreground px-1">
          <span>
            {data.total} notification{data.total !== 1 ? "s" : ""}
            {hasActiveFilters && " (filtered)"}
          </span>
          <span>
            Page {data.page} of {data.totalPages || 1}
          </span>
        </div>
      )}

      {/* Notification list */}
      <Card className="border-0 card-shadow overflow-hidden">
        {isLoading ? (
          <CardContent className="py-16 text-center">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">Loading notifications...</p>
          </CardContent>
        ) : !data || data.items.length === 0 ? (
          <CardContent className="py-16 text-center">
            <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center mx-auto mb-3">
              <Bell className="h-5 w-5 text-muted-foreground" />
            </div>
            <p className="text-sm text-muted-foreground font-medium">
              {hasActiveFilters ? "No notifications match your filters" : "No notifications yet"}
            </p>
            <p className="text-xs text-muted-foreground/70 mt-1">
              {hasActiveFilters ? "Try adjusting your filters" : "Notifications will appear here as events occur"}
            </p>
            {hasActiveFilters && (
              <Button variant="ghost" size="sm" className="mt-3 text-xs" onClick={clearFilters}>
                Clear filters
              </Button>
            )}
          </CardContent>
        ) : (
          <div className="divide-y divide-border/40">
            {data.items.map((notif) => {
              const config = NOTIFICATION_TYPE_CONFIG[notif.type] || {
                label: notif.type,
                icon: Bell,
                color: "text-muted-foreground",
                bg: "bg-muted",
              };
              const IconComponent = config.icon;

              return (
                <div
                  key={notif.id}
                  onClick={() => handleNotificationClick(notif)}
                  className={cn(
                    "flex items-start gap-3 px-4 py-3.5 cursor-pointer transition-colors hover:bg-accent/50 group",
                    !notif.isRead && "bg-primary/[0.03]"
                  )}
                >
                  {/* Icon */}
                  <div className={cn("h-9 w-9 rounded-lg flex items-center justify-center shrink-0 mt-0.5", config.bg)}>
                    <IconComponent className={cn("h-4 w-4", config.color)} />
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className={cn(
                          "text-sm leading-snug",
                          !notif.isRead ? "font-semibold" : "font-medium text-foreground/80"
                        )}>
                          {notif.title}
                        </p>
                        {notif.body && (
                          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                            {notif.body}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {!notif.isRead && (
                          <div className="h-2 w-2 rounded-full bg-primary shrink-0" />
                        )}
                        <Badge variant="outline" className="text-[10px] h-5 font-normal hidden sm:inline-flex">
                          {config.label}
                        </Badge>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 mt-1.5">
                      <p className="text-[11px] text-muted-foreground/60">
                        {formatDate(notif.createdAt)}
                      </p>
                      <span className="text-[11px] text-muted-foreground/40">
                        ({timeAgo(notif.createdAt)})
                      </span>
                      {notif.dismissed && (
                        <Badge variant="outline" className="text-[10px] h-4 font-normal text-muted-foreground/50">
                          dismissed
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {/* Pagination */}
      {data && data.totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="h-8 gap-1"
            disabled={page <= 1}
            onClick={() => setPage(page - 1)}
          >
            <ChevronLeft className="h-3.5 w-3.5" />
            Previous
          </Button>
          <div className="flex items-center gap-1">
            {Array.from({ length: Math.min(data.totalPages, 5) }, (_, i) => {
              let pageNum: number;
              if (data.totalPages <= 5) {
                pageNum = i + 1;
              } else if (page <= 3) {
                pageNum = i + 1;
              } else if (page >= data.totalPages - 2) {
                pageNum = data.totalPages - 4 + i;
              } else {
                pageNum = page - 2 + i;
              }
              return (
                <Button
                  key={pageNum}
                  variant={pageNum === page ? "default" : "ghost"}
                  size="sm"
                  className="h-8 w-8 p-0 text-xs"
                  onClick={() => setPage(pageNum)}
                >
                  {pageNum}
                </Button>
              );
            })}
          </div>
          <Button
            variant="outline"
            size="sm"
            className="h-8 gap-1"
            disabled={page >= (data?.totalPages ?? 1)}
            onClick={() => setPage(page + 1)}
          >
            Next
            <ChevronRight className="h-3.5 w-3.5" />
          </Button>
        </div>
      )}
    </div>
  );
}
