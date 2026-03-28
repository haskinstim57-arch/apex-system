import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useAccount } from "@/contexts/AccountContext";
import {
  Star,
  Send,
  Plus,
  Loader2,
  MessageSquare,
  ThumbsUp,
  ThumbsDown,
  TrendingUp,
  BarChart3,
  ExternalLink,
  Sparkles,
  Copy,
  Check,
  MousePointerClick,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";

// ─── Star Rating Component ────────────────────────────────────
function StarRating({ rating, size = 16 }: { rating: number; size?: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          size={size}
          className={
            i <= rating
              ? "fill-yellow-400 text-yellow-400"
              : i <= Math.ceil(rating) && rating % 1 > 0
              ? "fill-yellow-400/50 text-yellow-400"
              : "text-muted-foreground/30"
          }
        />
      ))}
    </div>
  );
}

// ─── Platform Badge ───────────────────────────────────────────
function PlatformBadge({ platform }: { platform: string }) {
  const colors: Record<string, string> = {
    google: "bg-blue-500/10 text-blue-600 border-blue-500/20",
    facebook: "bg-indigo-500/10 text-indigo-600 border-indigo-500/20",
    yelp: "bg-red-500/10 text-red-600 border-red-500/20",
    zillow: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
  };
  return (
    <Badge variant="outline" className={colors[platform] || ""}>
      {platform.charAt(0).toUpperCase() + platform.slice(1)}
    </Badge>
  );
}

// ─── Status Badge ─────────────────────────────────────────────
function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    pending: "bg-yellow-500/10 text-yellow-600 border-yellow-500/20",
    sent: "bg-blue-500/10 text-blue-600 border-blue-500/20",
    clicked: "bg-purple-500/10 text-purple-600 border-purple-500/20",
    completed: "bg-green-500/10 text-green-600 border-green-500/20",
    failed: "bg-red-500/10 text-red-600 border-red-500/20",
  };
  return (
    <Badge variant="outline" className={styles[status] || ""}>
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </Badge>
  );
}

// ─── Add Review Dialog ────────────────────────────────────────
function AddReviewDialog({
  accountId,
  onSuccess,
}: {
  accountId: number;
  onSuccess: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [platform, setPlatform] = useState<string>("google");
  const [rating, setRating] = useState(5);
  const [body, setBody] = useState("");
  const [reviewerName, setReviewerName] = useState("");
  const [reviewUrl, setReviewUrl] = useState("");
  const addReview = trpc.reputation.addReview.useMutation({
    onSuccess: () => {
      toast.success("Review added successfully");
      setOpen(false);
      setBody("");
      setReviewerName("");
      setReviewUrl("");
      setRating(5);
      onSuccess();
    },
    onError: (err) => toast.error(err.message),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="h-4 w-4 mr-1" /> Add Review
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add Review Manually</DialogTitle>
          <DialogDescription>
            Import a review from an external platform or add it manually.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Platform</Label>
              <Select value={platform} onValueChange={setPlatform}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="google">Google</SelectItem>
                  <SelectItem value="facebook">Facebook</SelectItem>
                  <SelectItem value="yelp">Yelp</SelectItem>
                  <SelectItem value="zillow">Zillow</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Rating</Label>
              <div className="flex items-center gap-1 mt-2">
                {[1, 2, 3, 4, 5].map((i) => (
                  <button key={i} onClick={() => setRating(i)} className="focus:outline-none">
                    <Star
                      size={24}
                      className={
                        i <= rating
                          ? "fill-yellow-400 text-yellow-400 cursor-pointer"
                          : "text-muted-foreground/30 cursor-pointer hover:text-yellow-400/50"
                      }
                    />
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div>
            <Label>Reviewer Name</Label>
            <Input
              value={reviewerName}
              onChange={(e) => setReviewerName(e.target.value)}
              placeholder="John Smith"
            />
          </div>
          <div>
            <Label>Review Text</Label>
            <Textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Great experience working with..."
              rows={3}
            />
          </div>
          <div>
            <Label>Review URL (optional)</Label>
            <Input
              value={reviewUrl}
              onChange={(e) => setReviewUrl(e.target.value)}
              placeholder="https://..."
            />
          </div>
          <Button
            className="w-full"
            onClick={() =>
              addReview.mutate({
                accountId,
                platform: platform as "google" | "facebook" | "yelp" | "zillow",
                rating,
                body: body || undefined,
                reviewerName: reviewerName || undefined,
                reviewUrl: reviewUrl || undefined,
              })
            }
            disabled={addReview.isPending}
          >
            {addReview.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
            Add Review
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Send Review Request Dialog ───────────────────────────────
function SendRequestDialog({
  accountId,
  onSuccess,
}: {
  accountId: number;
  onSuccess: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [contactSearch, setContactSearch] = useState("");
  const [selectedContactId, setSelectedContactId] = useState<number | null>(null);
  const [platform, setPlatform] = useState<string>("google");
  const [channel, setChannel] = useState<string>("sms");
  const [businessId, setBusinessId] = useState("");
  const [messageTemplate, setMessageTemplate] = useState("");
  const contacts = trpc.contacts.list.useQuery(
    { accountId, search: contactSearch, limit: 10, offset: 0 },
    { enabled: open && contactSearch.length > 0 }
  );

  const sendRequest = trpc.reputation.sendRequest.useMutation({
    onSuccess: () => {
      toast.success("Review request sent!");
      setOpen(false);
      setSelectedContactId(null);
      setContactSearch("");
      setBusinessId("");
      setMessageTemplate("");
      onSuccess();
    },
    onError: (err) => toast.error(err.message),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          <Send className="h-4 w-4 mr-1" /> Send Request
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Send Review Request</DialogTitle>
          <DialogDescription>
            Send a personalized review request to a contact via SMS or email.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          {/* Contact Search */}
          <div>
            <Label>Search Contact</Label>
            <Input
              value={contactSearch}
              onChange={(e) => {
                setContactSearch(e.target.value);
                setSelectedContactId(null);
              }}
              placeholder="Search by name, email, or phone..."
            />
            {contacts.data && contacts.data.data && contacts.data.data.length > 0 && !selectedContactId && (
              <div className="mt-1 border rounded-md max-h-40 overflow-y-auto">
                {contacts.data.data.map((c: { id: number; firstName: string; lastName: string; email: string | null; phone: string | null }) => (
                  <button
                    key={c.id}
                    className="w-full text-left px-3 py-2 hover:bg-accent text-sm flex justify-between"
                    onClick={() => {
                      setSelectedContactId(c.id);
                      setContactSearch(`${c.firstName} ${c.lastName}`);
                    }}
                  >
                    <span className="font-medium">{c.firstName} {c.lastName}</span>
                    <span className="text-muted-foreground">{c.email || c.phone}</span>
                  </button>
                ))}
              </div>
            )}
            {selectedContactId && (
              <p className="text-xs text-green-600 mt-1">Contact selected (ID: {selectedContactId})</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Platform</Label>
              <Select value={platform} onValueChange={setPlatform}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="google">Google</SelectItem>
                  <SelectItem value="facebook">Facebook</SelectItem>
                  <SelectItem value="yelp">Yelp</SelectItem>
                  <SelectItem value="zillow">Zillow</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Channel</Label>
              <Select value={channel} onValueChange={setChannel}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="sms">SMS</SelectItem>
                  <SelectItem value="email">Email</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label>Business ID</Label>
            <Input
              value={businessId}
              onChange={(e) => setBusinessId(e.target.value)}
              placeholder={
                platform === "google"
                  ? "Google Place ID"
                  : platform === "facebook"
                  ? "Facebook Page ID"
                  : platform === "yelp"
                  ? "Yelp Business ID"
                  : "Zillow Screen Name"
              }
            />
            <p className="text-xs text-muted-foreground mt-1">
              {platform === "google"
                ? "Find your Place ID at developers.google.com/maps/documentation/places"
                : platform === "facebook"
                ? "Your Facebook Page ID from Page Settings"
                : platform === "yelp"
                ? "The business ID from your Yelp URL"
                : "Your Zillow screen name from your profile URL"}
            </p>
          </div>

          <div>
            <Label>Custom Message (optional)</Label>
            <Textarea
              value={messageTemplate}
              onChange={(e) => setMessageTemplate(e.target.value)}
              placeholder="Hi {{firstName}}, we'd love to hear about your experience! Please leave us a review: {{reviewUrl}}"
              rows={3}
            />
            <p className="text-xs text-muted-foreground mt-1">
              Use {"{{firstName}}"} and {"{{reviewUrl}}"} as placeholders
            </p>
          </div>

          <Button
            className="w-full"
            onClick={() => {
              if (!selectedContactId) {
                toast.error("Please select a contact");
                return;
              }
              if (!businessId) {
                toast.error("Please enter a Business ID");
                return;
              }
              sendRequest.mutate({
                accountId,
                contactId: selectedContactId,
                platform: platform as "google" | "facebook" | "yelp" | "zillow",
                channel: channel as "sms" | "email",
                businessId,
                messageTemplate: messageTemplate || undefined,
              });
            }}
            disabled={sendRequest.isPending || !selectedContactId || !businessId}
          >
            {sendRequest.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Send className="h-4 w-4 mr-1" />}
            Send Review Request
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── AI Reply Dialog ──────────────────────────────────────────
function AIReplyDialog({
  accountId,
  review,
}: {
  accountId: number;
  review: {
    body: string | null;
    rating: number;
    reviewerName: string | null;
  };
}) {
  const [open, setOpen] = useState(false);
  const [businessName, setBusinessName] = useState("");
  const [reply, setReply] = useState("");
  const [copied, setCopied] = useState(false);
  const generateReply = trpc.reputation.generateReply.useMutation({
    onSuccess: (data) => setReply(data.reply),
    onError: (err) => toast.error(err.message),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="ghost" className="h-7 text-xs">
          <Sparkles className="h-3 w-3 mr-1" /> AI Reply
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Generate AI Reply</DialogTitle>
          <DialogDescription>
            Generate a professional reply suggestion for this review.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="p-3 bg-muted rounded-lg">
            <div className="flex items-center gap-2 mb-1">
              <span className="font-medium text-sm">{review.reviewerName || "Anonymous"}</span>
              <StarRating rating={review.rating} size={12} />
            </div>
            <p className="text-sm text-muted-foreground">{review.body || "No review text"}</p>
          </div>

          <div>
            <Label>Your Business Name</Label>
            <Input
              value={businessName}
              onChange={(e) => setBusinessName(e.target.value)}
              placeholder="Premier Mortgage Resources"
            />
          </div>

          <Button
            className="w-full"
            onClick={() =>
              generateReply.mutate({
                accountId,
                reviewBody: review.body || "",
                rating: review.rating,
                reviewerName: review.reviewerName || "Customer",
                businessName: businessName || "Our Company",
              })
            }
            disabled={generateReply.isPending}
          >
            {generateReply.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin mr-1" />
            ) : (
              <Sparkles className="h-4 w-4 mr-1" />
            )}
            Generate Reply
          </Button>

          {reply && (
            <div className="space-y-2">
              <Label>Suggested Reply</Label>
              <div className="p-3 bg-muted rounded-lg text-sm">{reply}</div>
              <Button
                size="sm"
                variant="outline"
                className="w-full"
                onClick={() => {
                  navigator.clipboard.writeText(reply);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 2000);
                }}
              >
                {copied ? <Check className="h-4 w-4 mr-1" /> : <Copy className="h-4 w-4 mr-1" />}
                {copied ? "Copied!" : "Copy Reply"}
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main Reputation Dashboard ────────────────────────────────
export default function Reputation() {
  const { currentAccount, currentAccountId } = useAccount();
  const accountId = currentAccountId;

  const stats = trpc.reputation.getStats.useQuery(
    { accountId: accountId! },
    { enabled: !!accountId }
  );

  const reviewsList = trpc.reputation.listReviews.useQuery(
    { accountId: accountId!, limit: 50, offset: 0 },
    { enabled: !!accountId }
  );

  const requestsList = trpc.reputation.listRequests.useQuery(
    { accountId: accountId!, limit: 50, offset: 0 },
    { enabled: !!accountId }
  );

  const utils = trpc.useUtils();
  const handleRefresh = () => {
    if (accountId) {
      utils.reputation.getStats.invalidate({ accountId });
      utils.reputation.listReviews.invalidate({ accountId });
      utils.reputation.listRequests.invalidate({ accountId });
    }
  };

  if (!accountId) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">Please select an account to view reputation data.</p>
      </div>
    );
  }

  const reviewStats = stats.data?.reviewStats;
  const requestStats = stats.data?.requestStats;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Reputation Management</h1>
          <p className="text-muted-foreground">
            Monitor reviews, send requests, and manage your online reputation.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <SendRequestDialog accountId={accountId} onSuccess={handleRefresh} />
          <AddReviewDialog accountId={accountId} onSuccess={handleRefresh} />
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Average Rating</p>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-3xl font-bold">{reviewStats?.avgRating || "0.0"}</span>
                  <StarRating rating={reviewStats?.avgRating || 0} size={14} />
                </div>
              </div>
              <Star className="h-8 w-8 text-yellow-400 fill-yellow-400/20" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Reviews</p>
                <p className="text-3xl font-bold mt-1">{reviewStats?.total || 0}</p>
              </div>
              <MessageSquare className="h-8 w-8 text-blue-500/50" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Requests Sent</p>
                <p className="text-3xl font-bold mt-1">{requestStats?.sent || 0}</p>
              </div>
              <Send className="h-8 w-8 text-purple-500/50" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Completion Rate</p>
                <p className="text-3xl font-bold mt-1">{requestStats?.completionRate || 0}%</p>
              </div>
              <TrendingUp className="h-8 w-8 text-green-500/50" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Platform Breakdown + Rating Distribution */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Platform Breakdown */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Reviews by Platform</CardTitle>
          </CardHeader>
          <CardContent>
            {reviewStats?.byPlatform && Object.keys(reviewStats.byPlatform).length > 0 ? (
              <div className="space-y-3">
                {Object.entries(reviewStats.byPlatform).map(([platform, data]) => (
                  <div key={platform} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <PlatformBadge platform={platform} />
                      <span className="text-sm">{(data as { count: number; avgRating: number }).count} reviews</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <StarRating rating={(data as { count: number; avgRating: number }).avgRating} size={12} />
                      <span className="text-sm font-medium">{(data as { count: number; avgRating: number }).avgRating}</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4">
                No reviews yet. Add reviews manually or connect your platforms.
              </p>
            )}
          </CardContent>
        </Card>

        {/* Rating Distribution */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Rating Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            {reviewStats?.byRating ? (
              <div className="space-y-2">
                {[5, 4, 3, 2, 1].map((rating) => {
                  const count = (reviewStats.byRating as Record<number, number>)[rating] || 0;
                  const total = reviewStats.total || 1;
                  const pct = Math.round((count / total) * 100);
                  return (
                    <div key={rating} className="flex items-center gap-2">
                      <span className="text-sm w-3 text-right">{rating}</span>
                      <Star size={12} className="fill-yellow-400 text-yellow-400" />
                      <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full bg-yellow-400 rounded-full transition-all"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <span className="text-xs text-muted-foreground w-12 text-right">
                        {count} ({pct}%)
                      </span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4">No data available</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Request Funnel */}
      {requestStats && requestStats.total > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Review Request Funnel</CardTitle>
            <CardDescription>Track how review requests convert to completed reviews</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-5 gap-4 text-center">
              <div>
                <div className="flex items-center justify-center mb-2">
                  <Send className="h-5 w-5 text-muted-foreground" />
                </div>
                <p className="text-2xl font-bold">{requestStats.total}</p>
                <p className="text-xs text-muted-foreground">Total Sent</p>
              </div>
              <div>
                <div className="flex items-center justify-center mb-2">
                  <CheckCircle2 className="h-5 w-5 text-blue-500" />
                </div>
                <p className="text-2xl font-bold">{requestStats.sent}</p>
                <p className="text-xs text-muted-foreground">Delivered</p>
              </div>
              <div>
                <div className="flex items-center justify-center mb-2">
                  <MousePointerClick className="h-5 w-5 text-purple-500" />
                </div>
                <p className="text-2xl font-bold">{requestStats.clicked}</p>
                <p className="text-xs text-muted-foreground">Clicked ({requestStats.clickRate}%)</p>
              </div>
              <div>
                <div className="flex items-center justify-center mb-2">
                  <ThumbsUp className="h-5 w-5 text-green-500" />
                </div>
                <p className="text-2xl font-bold">{requestStats.completed}</p>
                <p className="text-xs text-muted-foreground">Completed ({requestStats.completionRate}%)</p>
              </div>
              <div>
                <div className="flex items-center justify-center mb-2">
                  <XCircle className="h-5 w-5 text-red-500" />
                </div>
                <p className="text-2xl font-bold">{requestStats.failed}</p>
                <p className="text-xs text-muted-foreground">Failed</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tabs: Reviews & Requests */}
      <Tabs defaultValue="reviews">
        <TabsList>
          <TabsTrigger value="reviews">
            <Star className="h-4 w-4 mr-1" /> Reviews
          </TabsTrigger>
          <TabsTrigger value="requests">
            <Send className="h-4 w-4 mr-1" /> Requests
          </TabsTrigger>
        </TabsList>

        {/* Reviews Tab */}
        <TabsContent value="reviews">
          <Card>
            <CardContent className="pt-6">
              {reviewsList.isLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : reviewsList.data && reviewsList.data.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Platform</TableHead>
                      <TableHead>Reviewer</TableHead>
                      <TableHead>Rating</TableHead>
                      <TableHead className="max-w-xs">Review</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {reviewsList.data.map((review) => (
                      <TableRow key={review.id}>
                        <TableCell>
                          <PlatformBadge platform={review.platform} />
                        </TableCell>
                        <TableCell className="font-medium">
                          {review.reviewerName || "Anonymous"}
                        </TableCell>
                        <TableCell>
                          <StarRating rating={review.rating} size={14} />
                        </TableCell>
                        <TableCell className="max-w-xs truncate text-sm text-muted-foreground">
                          {review.body || "—"}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {review.postedAt
                            ? new Date(review.postedAt).toLocaleDateString()
                            : "—"}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            {review.body && (
                              <AIReplyDialog
                                accountId={accountId}
                                review={{
                                  body: review.body,
                                  rating: review.rating,
                                  reviewerName: review.reviewerName,
                                }}
                              />
                            )}
                            {review.reviewUrl && (
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 text-xs"
                                onClick={() => window.open(review.reviewUrl!, "_blank")}
                              >
                                <ExternalLink className="h-3 w-3" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="text-center py-8">
                  <BarChart3 className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
                  <p className="text-muted-foreground">No reviews yet</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Add reviews manually or send review requests to your contacts.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Requests Tab */}
        <TabsContent value="requests">
          <Card>
            <CardContent className="pt-6">
              {requestsList.isLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : requestsList.data && requestsList.data.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Platform</TableHead>
                      <TableHead>Channel</TableHead>
                      <TableHead>Contact ID</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Sent At</TableHead>
                      <TableHead>Review URL</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {requestsList.data.map((req) => (
                      <TableRow key={req.id}>
                        <TableCell>
                          <PlatformBadge platform={req.platform} />
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">
                            {req.channel === "sms" ? "SMS" : "Email"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm">#{req.contactId}</TableCell>
                        <TableCell>
                          <StatusBadge status={req.status} />
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {req.sentAt
                            ? new Date(req.sentAt).toLocaleDateString()
                            : "—"}
                        </TableCell>
                        <TableCell>
                          {req.reviewUrl && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 text-xs"
                              onClick={() => window.open(req.reviewUrl!, "_blank")}
                            >
                              <ExternalLink className="h-3 w-3 mr-1" /> View
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="text-center py-8">
                  <Send className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
                  <p className="text-muted-foreground">No review requests sent yet</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Send your first review request to start building your reputation.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
