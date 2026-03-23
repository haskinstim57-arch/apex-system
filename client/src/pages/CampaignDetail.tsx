import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  ArrowLeft,
  BarChart3,
  Calendar,
  CheckCircle2,
  Clock,
  Loader2,
  Mail,
  MessageSquare,
  Pause,
  Play,
  Send,
  Trash2,
  Users,
  XCircle,
  AlertTriangle,
} from "lucide-react";
import { useLocation, useSearch } from "wouter";
import { toast } from "sonner";

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-zinc-500/15 text-zinc-400 border-zinc-500/30",
  scheduled: "bg-blue-50 text-blue-600 border-blue-200",
  sending: "bg-amber-50 text-amber-600 border-amber-200",
  sent: "bg-emerald-50 text-emerald-600 border-emerald-200",
  paused: "bg-orange-50 text-orange-600 border-orange-200",
  cancelled: "bg-red-50 text-red-500 border-red-200",
};

const RECIPIENT_STATUS_COLORS: Record<string, string> = {
  pending: "bg-zinc-500/15 text-zinc-400 border-zinc-500/30",
  sent: "bg-blue-50 text-blue-600 border-blue-200",
  delivered: "bg-emerald-50 text-emerald-600 border-emerald-200",
  opened: "bg-purple-50 text-purple-600 border-purple-200",
  clicked: "bg-cyan-50 text-cyan-600 border-cyan-200",
  bounced: "bg-orange-50 text-orange-600 border-orange-200",
  failed: "bg-red-50 text-red-500 border-red-200",
  unsubscribed: "bg-zinc-500/15 text-zinc-400 border-zinc-500/30",
};

export default function CampaignDetail({ params }: { params: { id: string } }) {
  const [, navigate] = useLocation();
  const searchString = useSearch();
  const searchParams = new URLSearchParams(searchString);
  const accountId = Number(searchParams.get("accountId"));
  const campaignId = Number(params.id);
  const utils = trpc.useUtils();

  // Campaign data
  const { data: campaign, isLoading } = trpc.campaigns.get.useQuery(
    { id: campaignId, accountId },
    { enabled: !!accountId && !!campaignId }
  );

  // Recipient stats
  const { data: recipientStats } = trpc.campaigns.recipientStats.useQuery(
    { campaignId, accountId },
    { enabled: !!accountId && !!campaignId }
  );

  // Recipients list
  const { data: recipientsData } = trpc.campaigns.recipients.useQuery(
    { campaignId, accountId, limit: 100 },
    { enabled: !!accountId && !!campaignId }
  );

  // Mutations
  const sendMutation = trpc.campaigns.send.useMutation({
    onSuccess: (data) => {
      utils.campaigns.get.invalidate();
      utils.campaigns.recipientStats.invalidate();
      utils.campaigns.recipients.invalidate();
      toast.success(
        `Campaign sent! ${data.sentCount} delivered, ${data.failedCount} failed`
      );
    },
    onError: (e) => toast.error(e.message),
  });

  const pauseMutation = trpc.campaigns.pause.useMutation({
    onSuccess: () => {
      utils.campaigns.get.invalidate();
      toast.success("Campaign paused");
    },
    onError: (e) => toast.error(e.message),
  });

  const cancelMutation = trpc.campaigns.cancel.useMutation({
    onSuccess: () => {
      utils.campaigns.get.invalidate();
      toast.success("Campaign cancelled");
    },
    onError: (e) => toast.error(e.message),
  });

  const deleteMutation = trpc.campaigns.delete.useMutation({
    onSuccess: () => {
      toast.success("Campaign deleted");
      navigate("/campaigns");
    },
    onError: (e) => toast.error(e.message),
  });

  const removeRecipientMutation = trpc.campaigns.removeRecipient.useMutation({
    onSuccess: () => {
      utils.campaigns.recipients.invalidate();
      utils.campaigns.recipientStats.invalidate();
      toast.success("Recipient removed");
    },
    onError: (e) => toast.error(e.message),
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!campaign) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3">
        <AlertTriangle className="h-10 w-10 text-muted-foreground/50" />
        <p className="text-muted-foreground">Campaign not found.</p>
        <Button variant="outline" size="sm" onClick={() => navigate("/campaigns")}>
          Back to Campaigns
        </Button>
      </div>
    );
  }

  const recipients = recipientsData?.data || [];
  const stats = recipientStats || {
    total: 0,
    pending: 0,
    sent: 0,
    delivered: 0,
    opened: 0,
    clicked: 0,
    bounced: 0,
    failed: 0,
    unsubscribed: 0,
  };

  const deliveryRate =
    stats.total > 0
      ? Math.round(((stats.delivered + stats.opened + stats.clicked) / stats.total) * 100)
      : 0;
  const failureRate =
    stats.total > 0
      ? Math.round(((stats.failed + stats.bounced) / stats.total) * 100)
      : 0;

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="sm"
          className="h-8 w-8 p-0"
          onClick={() => navigate("/campaigns")}
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight">
              {campaign.name}
            </h1>
            <Badge
              variant="outline"
              className={`text-[10px] capitalize ${STATUS_COLORS[campaign.status] || ""}`}
            >
              {campaign.status}
            </Badge>
            <Badge
              variant="outline"
              className={`text-[10px] ${
                campaign.type === "email"
                  ? "bg-blue-500/10 text-blue-600 border-blue-200"
                  : "bg-purple-500/10 text-purple-600 border-purple-200"
              }`}
            >
              {campaign.type === "email" ? (
                <Mail className="h-2.5 w-2.5 mr-0.5" />
              ) : (
                <MessageSquare className="h-2.5 w-2.5 mr-0.5" />
              )}
              {campaign.type.toUpperCase()}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-0.5">
            Created {new Date(campaign.createdAt).toLocaleDateString()}
            {campaign.sentAt &&
              ` · Sent ${new Date(campaign.sentAt).toLocaleString()}`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {campaign.status === "draft" && (
            <Button
              size="sm"
              className="gap-1.5 h-8"
              disabled={sendMutation.isPending || stats.total === 0}
              onClick={() =>
                sendMutation.mutate({ id: campaignId, accountId })
              }
            >
              {sendMutation.isPending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Play className="h-3.5 w-3.5" />
              )}
              Send Now
            </Button>
          )}
          {(campaign.status === "sending" || campaign.status === "scheduled") && (
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 h-8"
              onClick={() =>
                pauseMutation.mutate({ id: campaignId, accountId })
              }
            >
              <Pause className="h-3.5 w-3.5" />
              Pause
            </Button>
          )}
          {campaign.status !== "cancelled" && campaign.status !== "sent" && (
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 h-8"
              onClick={() =>
                cancelMutation.mutate({ id: campaignId, accountId })
              }
            >
              <XCircle className="h-3.5 w-3.5" />
              Cancel
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0 text-destructive hover:text-destructive"
            onClick={() => {
              if (confirm("Delete this campaign? This cannot be undone.")) {
                deleteMutation.mutate({ id: campaignId, accountId });
              }
            }}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* Performance Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3">
        <Card className="bg-white border-0 card-shadow">
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-muted-foreground" />
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                Recipients
              </p>
            </div>
            <p className="text-2xl font-semibold mt-1">{stats.total}</p>
          </CardContent>
        </Card>
        <Card className="bg-white border-0 card-shadow">
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2">
              <Send className="h-4 w-4 text-blue-600" />
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                Sent
              </p>
            </div>
            <p className="text-2xl font-semibold mt-1 text-blue-600">
              {stats.sent + stats.delivered + stats.opened + stats.clicked}
            </p>
          </CardContent>
        </Card>
        <Card className="bg-white border-0 card-shadow">
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                Delivery Rate
              </p>
            </div>
            <p className="text-2xl font-semibold mt-1 text-emerald-600">
              {deliveryRate}%
            </p>
          </CardContent>
        </Card>
        <Card className="bg-white border-0 card-shadow">
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2">
              <XCircle className="h-4 w-4 text-red-500" />
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                Failed
              </p>
            </div>
            <p className="text-2xl font-semibold mt-1 text-red-500">
              {stats.failed + stats.bounced}
            </p>
          </CardContent>
        </Card>
        <Card className="bg-white border-0 card-shadow">
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-amber-600" />
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                Pending
              </p>
            </div>
            <p className="text-2xl font-semibold mt-1 text-amber-600">
              {stats.pending}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Campaign Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Message Content */}
        <Card className="bg-white border-0 card-shadow lg:col-span-2">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Message Content</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {campaign.type === "email" && campaign.subject && (
              <div>
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
                  Subject
                </p>
                <p className="text-sm font-medium">{campaign.subject}</p>
              </div>
            )}
            <div>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
                Body
              </p>
              <div className="p-3 rounded-lg border border-border/30 bg-muted/10 text-sm whitespace-pre-wrap max-h-[250px] overflow-y-auto">
                {campaign.body}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Campaign Details */}
        <Card className="bg-white border-0 card-shadow">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                From
              </p>
              <p className="text-sm">{campaign.fromAddress || "Default"}</p>
            </div>
            {campaign.scheduledAt && (
              <div>
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  Scheduled For
                </p>
                <p className="text-sm">
                  {new Date(campaign.scheduledAt).toLocaleString()}
                </p>
              </div>
            )}
            {campaign.sentAt && (
              <div>
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  Sent At
                </p>
                <p className="text-sm">
                  {new Date(campaign.sentAt).toLocaleString()}
                </p>
              </div>
            )}
            {campaign.completedAt && (
              <div>
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  Completed At
                </p>
                <p className="text-sm">
                  {new Date(campaign.completedAt).toLocaleString()}
                </p>
              </div>
            )}
            <div>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                Total Recipients
              </p>
              <p className="text-sm">{campaign.totalRecipients}</p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                Sent Count
              </p>
              <p className="text-sm text-emerald-600">{campaign.sentCount}</p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                Failed Count
              </p>
              <p className="text-sm text-red-500">{campaign.failedCount}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recipients Table */}
      <Card className="bg-white border-0 card-shadow overflow-x-auto">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-medium">
              Recipients ({stats.total})
            </CardTitle>
          </div>
        </CardHeader>
        <Table>
          <TableHeader>
            <TableRow className="border-border/30 hover:bg-transparent">
              <TableHead className="text-xs">Contact</TableHead>
              <TableHead className="text-xs">Address</TableHead>
              <TableHead className="text-xs">Status</TableHead>
              <TableHead className="text-xs">Sent At</TableHead>
              <TableHead className="text-xs">Delivered At</TableHead>
              <TableHead className="text-xs">Error</TableHead>
              {campaign.status === "draft" && (
                <TableHead className="text-xs w-[50px]"></TableHead>
              )}
            </TableRow>
          </TableHeader>
          <TableBody>
            {recipients.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={campaign.status === "draft" ? 7 : 6}
                  className="text-center py-8 text-muted-foreground"
                >
                  No recipients added yet.
                </TableCell>
              </TableRow>
            ) : (
              recipients.map((r: any) => (
                <TableRow key={r.id} className="border-border/20">
                  <TableCell className="text-sm">
                    {r.contactFirstName || r.contactLastName
                      ? `${r.contactFirstName || ""} ${r.contactLastName || ""}`.trim()
                      : "Unknown"}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {r.toAddress}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={`text-[10px] capitalize ${RECIPIENT_STATUS_COLORS[r.status] || ""}`}
                    >
                      {r.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {r.sentAt
                      ? new Date(r.sentAt).toLocaleString()
                      : "—"}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {r.deliveredAt
                      ? new Date(r.deliveredAt).toLocaleString()
                      : "—"}
                  </TableCell>
                  <TableCell className="text-xs text-red-500 max-w-[150px] truncate">
                    {r.errorMessage || "—"}
                  </TableCell>
                  {campaign.status === "draft" && (
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                        onClick={() =>
                          removeRecipientMutation.mutate({
                            recipientId: r.id,
                            campaignId,
                            accountId,
                          })
                        }
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </TableCell>
                  )}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
