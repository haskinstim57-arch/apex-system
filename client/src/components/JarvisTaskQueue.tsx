import { useAuth } from "@/lib/trpc";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Bot,
  CheckCircle2,
  X,
  ExternalLink,
  Phone,
  Mail,
  FileText,
  Link2,
  Clock,
  AlertTriangle,
  Loader2,
} from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Link } from "wouter";

const TASK_TYPE_CONFIG: Record<
  string,
  {
    icon: React.ComponentType<{ className?: string }>;
    color: string;
    bgColor: string;
    label: string;
  }
> = {
  follow_up_call: {
    icon: Phone,
    color: "text-blue-500",
    bgColor: "bg-blue-500/10",
    label: "Follow-up Call",
  },
  send_email: {
    icon: Mail,
    color: "text-emerald-500",
    bgColor: "bg-emerald-500/10",
    label: "Send Email",
  },
  send_application: {
    icon: Link2,
    color: "text-purple-500",
    bgColor: "bg-purple-500/10",
    label: "Send Application",
  },
  review_notes: {
    icon: FileText,
    color: "text-amber-500",
    bgColor: "bg-amber-500/10",
    label: "Review Notes",
  },
  urgent_callback: {
    icon: AlertTriangle,
    color: "text-red-500",
    bgColor: "bg-red-500/10",
    label: "Urgent Callback",
  },
};

const PRIORITY_COLORS: Record<string, string> = {
  high: "border-red-500/30 text-red-400 bg-red-500/5",
  medium: "border-amber-500/30 text-amber-400 bg-amber-500/5",
  low: "border-muted-foreground/30 text-muted-foreground bg-muted/30",
};

function parsePayload(payload: string | null): Record<string, any> {
  if (!payload) return {};
  try { return JSON.parse(payload); } catch { return {}; }
}

function deriveTaskMeta(task: { taskType: string; payload: string | null; contactFirstName?: string | null; contactLastName?: string | null }) {
  const p = parsePayload(task.payload);
  const contactName = [task.contactFirstName, task.contactLastName].filter(Boolean).join(" ") || "Contact";
  const config = TASK_TYPE_CONFIG[task.taskType];
  const label = config?.label || task.taskType.replace(/_/g, " ");
  return {
    title: p.title || `${label}: ${contactName}`,
    description: p.description || p.reason || `${label} suggested for ${contactName}`,
    priority: (p.priority as string) || "medium",
  };
}

export default function JarvisTaskQueue({ accountId }: { accountId: number }) {

  const utils = trpc.useUtils();

  const { data: rawTasks, isLoading } = trpc.jarvis.listPendingTasks.useQuery(
    { accountId },
    { refetchInterval: 30000, staleTime: 15000 }
  );

  const tasks = useMemo(() => {
    if (!rawTasks) return null;
    return rawTasks.map((t) => {
      const meta = deriveTaskMeta(t);
      return { ...t, title: meta.title, description: meta.description, priority: meta.priority };
    });
  }, [rawTasks]);

  const executeMutation = trpc.jarvis.executeTask.useMutation({
    onSuccess: () => {
      utils.jarvis.listPendingTasks.invalidate({ accountId });
      toast.success("Task executed", { description: "The task has been completed." });
    },
    onError: (err) => {
      toast.error("Error", { description: err.message });
    },
  });

  const dismissMutation = trpc.jarvis.dismissTask.useMutation({
    onSuccess: () => {
      utils.jarvis.listPendingTasks.invalidate({ accountId });
      toast.success("Task dismissed");
    },
    onError: (err) => {
      toast.error("Error", { description: err.message });
    },
  });

  const [executingId, setExecutingId] = useState<number | null>(null);
  const [dismissingId, setDismissingId] = useState<number | null>(null);

  if (isLoading) {
    return (
      <Card className="bg-card border-0 card-shadow">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Bot className="h-4 w-4 text-primary" />
            Jarvis Suggestions
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="flex items-start gap-3">
                <Skeleton className="h-8 w-8 rounded-lg shrink-0" />
                <div className="flex-1 space-y-1.5">
                  <Skeleton className="h-3.5 w-3/4" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!tasks || tasks.length === 0) {
    return null; // Don't render anything if no pending tasks
  }

  const relativeTime = (date: Date | string | null) => {
    if (!date) return "";
    const now = Date.now();
    const then = new Date(date).getTime();
    const diffMs = now - then;
    const diffMin = Math.floor(diffMs / 60000);
    if (diffMin < 1) return "just now";
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHr = Math.floor(diffMin / 60);
    if (diffHr < 24) return `${diffHr}h ago`;
    const diffDay = Math.floor(diffHr / 24);
    return `${diffDay}d ago`;
  };

  return (
    <Card className="bg-card border-0 card-shadow">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Bot className="h-4 w-4 text-primary" />
            Jarvis Suggestions
          </CardTitle>
          <Badge variant="outline" className="text-[10px] font-medium">
            {tasks.length} pending
          </Badge>
        </div>
        <p className="text-xs text-muted-foreground mt-1">
          AI-generated action items based on contact activity
        </p>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {tasks.slice(0, 5).map((task) => {
            const config = TASK_TYPE_CONFIG[task.taskType] || {
              icon: Bot,
              color: "text-muted-foreground",
              bgColor: "bg-muted/30",
              label: task.taskType.replace(/_/g, " "),
            };
            const Icon = config.icon;
            const isExecuting = executingId === task.id;
            const isDismissing = dismissingId === task.id;

            return (
              <div
                key={task.id}
                className="flex items-start gap-3 p-3 rounded-lg border border-border/50 hover:border-primary/20 transition-colors"
              >
                <div
                  className={`h-8 w-8 rounded-lg flex items-center justify-center shrink-0 ${config.bgColor}`}
                >
                  <Icon className={`h-4 w-4 ${config.color}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <span className="text-sm font-medium text-foreground truncate">
                      {task.title}
                    </span>
                    <Badge
                      variant="outline"
                      className={`text-[9px] shrink-0 ${PRIORITY_COLORS[task.priority] || PRIORITY_COLORS.low}`}
                    >
                      {task.priority}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground line-clamp-2">
                    {task.description}
                  </p>
                  {task.contactId && (
                    <Link href={`/contacts/${task.contactId}`}>
                      <span className="text-[10px] text-primary hover:underline cursor-pointer inline-flex items-center gap-0.5 mt-1">
                        <ExternalLink className="h-2.5 w-2.5" />
                        View Contact
                      </span>
                    </Link>
                  )}
                  <div className="flex items-center gap-1 mt-1.5">
                    <Clock className="h-2.5 w-2.5 text-muted-foreground" />
                    <span className="text-[10px] text-muted-foreground">
                      {relativeTime(task.createdAt)}
                    </span>
                  </div>
                </div>
                <div className="flex flex-col gap-1.5 shrink-0">
                  <Button
                    size="sm"
                    className="h-7 px-2.5 text-[11px] gap-1"
                    disabled={isExecuting || isDismissing}
                    onClick={() => {
                      setExecutingId(task.id);
                      executeMutation.mutate(
                        { taskId: task.id, accountId },
                        { onSettled: () => setExecutingId(null) }
                      );
                    }}
                  >
                    {isExecuting ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <CheckCircle2 className="h-3 w-3" />
                    )}
                    Execute
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2.5 text-[11px] gap-1 text-muted-foreground hover:text-destructive"
                    disabled={isExecuting || isDismissing}
                    onClick={() => {
                      setDismissingId(task.id);
                      dismissMutation.mutate(
                        { taskId: task.id, accountId },
                        { onSettled: () => setDismissingId(null) }
                      );
                    }}
                  >
                    {isDismissing ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <X className="h-3 w-3" />
                    )}
                    Dismiss
                  </Button>
                </div>
              </div>
            );
          })}
          {tasks.length > 5 && (
            <p className="text-xs text-center text-muted-foreground pt-1">
              + {tasks.length - 5} more suggestions
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
