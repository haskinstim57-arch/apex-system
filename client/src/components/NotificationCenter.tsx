import { trpc } from "@/lib/trpc";
import { useAccount } from "@/contexts/AccountContext";
import { useState, useRef, useEffect } from "react";
import { useLocation } from "wouter";
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
  Check,
  CheckCheck,
  X,
} from "lucide-react";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { cn } from "@/lib/utils";

const NOTIFICATION_ICONS: Record<string, React.ElementType> = {
  inbound_message: MessageSquare,
  appointment_booked: CalendarDays,
  appointment_cancelled: CalendarX2,
  ai_call_completed: Phone,
  campaign_finished: Send,
  workflow_failed: Zap,
  new_contact_facebook: UserPlus,
  new_contact_booking: UserPlus,
  missed_call: PhoneMissed,
};

const NOTIFICATION_COLORS: Record<string, string> = {
  inbound_message: "text-blue-500 bg-blue-500/10",
  appointment_booked: "text-green-500 bg-green-500/10",
  appointment_cancelled: "text-red-500 bg-red-500/10",
  ai_call_completed: "text-purple-500 bg-purple-500/10",
  campaign_finished: "text-emerald-500 bg-emerald-500/10",
  workflow_failed: "text-orange-500 bg-orange-500/10",
  new_contact_facebook: "text-sky-500 bg-sky-500/10",
  new_contact_booking: "text-teal-500 bg-teal-500/10",
  missed_call: "text-rose-500 bg-rose-500/10",
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

export function NotificationCenter() {
  const { currentAccountId } = useAccount();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [, navigate] = useLocation();

  // Poll unread count every 15 seconds
  const { data: unreadData } = trpc.notifications.unreadCount.useQuery(
    { accountId: currentAccountId! },
    { enabled: !!currentAccountId, refetchInterval: 15000 }
  );
  const unreadCount = unreadData?.count ?? 0;

  // Fetch notifications when dropdown is open
  const { data: notifications, refetch } = trpc.notifications.list.useQuery(
    { accountId: currentAccountId!, limit: 20 },
    { enabled: !!currentAccountId && isOpen, refetchInterval: isOpen ? 15000 : false }
  );

  const utils = trpc.useUtils();

  const markAsReadMutation = trpc.notifications.markAsRead.useMutation({
    onSuccess: () => {
      utils.notifications.list.invalidate();
      utils.notifications.unreadCount.invalidate();
    },
  });

  const markAllAsReadMutation = trpc.notifications.markAllAsRead.useMutation({
    onSuccess: () => {
      utils.notifications.list.invalidate();
      utils.notifications.unreadCount.invalidate();
    },
  });

  const dismissMutation = trpc.notifications.dismiss.useMutation({
    onSuccess: () => {
      utils.notifications.list.invalidate();
      utils.notifications.unreadCount.invalidate();
    },
  });

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  const handleNotificationClick = (notif: { id: number; link: string | null; isRead: boolean }) => {
    if (!notif.isRead && currentAccountId) {
      markAsReadMutation.mutate({ id: notif.id, accountId: currentAccountId });
    }
    if (notif.link) {
      navigate(notif.link);
      setIsOpen(false);
    }
  };

  const handleMarkAllAsRead = () => {
    if (currentAccountId) {
      markAllAsReadMutation.mutate({ accountId: currentAccountId });
    }
  };

  const handleDismiss = (e: React.MouseEvent, id: number) => {
    e.stopPropagation();
    if (currentAccountId) {
      dismissMutation.mutate({ id, accountId: currentAccountId });
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Bell button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative h-9 w-9 flex items-center justify-center rounded-lg hover:bg-accent transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        aria-label="Notifications"
      >
        <Bell className="h-[18px] w-[18px] text-muted-foreground" />
        {unreadCount > 0 && (
          <Badge
            className="absolute -top-0.5 -right-0.5 h-[18px] min-w-[18px] px-1 text-[10px] font-bold rounded-full bg-destructive text-destructive-foreground border-2 border-background flex items-center justify-center pointer-events-none"
          >
            {unreadCount > 99 ? "99+" : unreadCount}
          </Badge>
        )}
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-[380px] max-w-[calc(100vw-2rem)] bg-popover text-popover-foreground border border-border rounded-xl shadow-xl z-50 overflow-hidden animate-in fade-in-0 slide-in-from-top-2 duration-200">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-border/50">
            <h3 className="text-sm font-semibold">Notifications</h3>
            {unreadCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs text-muted-foreground hover:text-foreground gap-1"
                onClick={handleMarkAllAsRead}
                disabled={markAllAsReadMutation.isPending}
              >
                <CheckCheck className="h-3.5 w-3.5" />
                Mark all read
              </Button>
            )}
          </div>

          {/* Notification list */}
          <div className="max-h-[400px] overflow-y-auto">
            {!notifications || notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
                <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center mb-3">
                  <Bell className="h-5 w-5 text-muted-foreground" />
                </div>
                <p className="text-sm text-muted-foreground">No notifications yet</p>
                <p className="text-xs text-muted-foreground/70 mt-1">
                  You'll see updates here when things happen
                </p>
              </div>
            ) : (
              notifications.map((notif) => {
                const IconComponent = NOTIFICATION_ICONS[notif.type] || Bell;
                const colorClass = NOTIFICATION_COLORS[notif.type] || "text-muted-foreground bg-muted";
                return (
                  <div
                    key={notif.id}
                    onClick={() => handleNotificationClick(notif)}
                    className={cn(
                      "flex items-start gap-3 px-4 py-3 cursor-pointer transition-colors hover:bg-accent/50 border-b border-border/30 last:border-b-0 group",
                      !notif.isRead && "bg-primary/[0.03]"
                    )}
                  >
                    {/* Icon */}
                    <div className={cn("h-8 w-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5", colorClass)}>
                      <IconComponent className="h-4 w-4" />
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <p className={cn("text-sm leading-snug", !notif.isRead ? "font-semibold" : "font-medium text-foreground/80")}>
                          {notif.title}
                        </p>
                        <div className="flex items-center gap-1 shrink-0">
                          {!notif.isRead && (
                            <div className="h-2 w-2 rounded-full bg-primary shrink-0" />
                          )}
                          <button
                            onClick={(e) => handleDismiss(e, notif.id)}
                            className="h-6 w-6 rounded flex items-center justify-center opacity-0 group-hover:opacity-100 hover:bg-accent transition-all"
                            aria-label="Dismiss"
                          >
                            <X className="h-3.5 w-3.5 text-muted-foreground" />
                          </button>
                        </div>
                      </div>
                      {notif.body && (
                        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                          {notif.body}
                        </p>
                      )}
                      <p className="text-[11px] text-muted-foreground/60 mt-1">
                        {timeAgo(notif.createdAt)}
                      </p>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
