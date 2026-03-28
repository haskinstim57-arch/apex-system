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
  Settings,
  Bell,
  Link2,
  Shield,
  RefreshCw,
  Reply,
  AlertTriangle,
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
import { Switch } from "@/components/ui/switch";
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

// ─── AI Reply Dialog (with Post Reply support) ──────────────
function AIReplyDialog({
  accountId,
  review,
  onReplyPosted,
}: {
  accountId: number;
  review: {
    id: number;
    body: string | null;
    rating: number;
    reviewerName: string | null;
    platform: string;
    replyBody: string | null;
  };
  onReplyPosted?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [businessName, setBusinessName] = useState("");
  const [reply, setReply] = useState("");
  const [copied, setCopied] = useState(false);
  const generateReply = trpc.reputation.generateReply.useMutation({
    onSuccess: (data) => setReply(data.reply),
    onError: (err) => toast.error(err.message),
  });
  const postReply = trpc.reputation.postReply.useMutation({
    onSuccess: () => {
      toast.success("Reply posted successfully!");
      setOpen(false);
      setReply("");
      onReplyPosted?.();
    },
    onError: (err) => toast.error(err.message),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="ghost" className="h-7 text-xs">
          {review.replyBody ? (
            <><Reply className="h-3 w-3 mr-1" /> View Reply</>
          ) : (
            <><Sparkles className="h-3 w-3 mr-1" /> AI Reply</>
          )}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{review.replyBody ? "Review Reply" : "Generate & Post Reply"}</DialogTitle>
          <DialogDescription>
            {review.replyBody
              ? "Your reply to this review."
              : "Generate an AI reply and post it to the platform."}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          {/* Original Review */}
          <div className="p-3 bg-muted rounded-lg">
            <div className="flex items-center gap-2 mb-1">
              <span className="font-medium text-sm">{review.reviewerName || "Anonymous"}</span>
              <StarRating rating={review.rating} size={12} />
              <PlatformBadge platform={review.platform} />
            </div>
            <p className="text-sm text-muted-foreground">{review.body || "No review text"}</p>
          </div>

          {/* Existing Reply */}
          {review.replyBody && (
            <div className="p-3 bg-green-500/5 border border-green-500/20 rounded-lg">
              <div className="flex items-center gap-1 mb-1">
                <Reply className="h-3 w-3 text-green-600" />
                <span className="text-xs font-medium text-green-600">Your Reply</span>
              </div>
              <p className="text-sm">{review.replyBody}</p>
            </div>
          )}

          {/* Generate New Reply */}
          {!review.replyBody && (
            <>
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
                variant="outline"
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
                Generate AI Reply
              </Button>

              {reply && (
                <div className="space-y-2">
                  <Label>Suggested Reply</Label>
                  <Textarea
                    value={reply}
                    onChange={(e) => setReply(e.target.value)}
                    rows={4}
                    className="text-sm"
                  />
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="flex-1"
                      onClick={() => {
                        navigator.clipboard.writeText(reply);
                        setCopied(true);
                        setTimeout(() => setCopied(false), 2000);
                      }}
                    >
                      {copied ? <Check className="h-4 w-4 mr-1" /> : <Copy className="h-4 w-4 mr-1" />}
                      {copied ? "Copied!" : "Copy"}
                    </Button>
                    <Button
                      size="sm"
                      className="flex-1"
                      onClick={() =>
                        postReply.mutate({
                          accountId,
                          reviewId: review.id,
                          replyBody: reply,
                        })
                      }
                      disabled={postReply.isPending}
                    >
                      {postReply.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin mr-1" />
                      ) : (
                        <Reply className="h-4 w-4 mr-1" />
                      )}
                      Post Reply
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── GMB Connection Card ───────────────────────────────────
function GMBConnectionCard({ accountId }: { accountId: number }) {
  const connection = trpc.reputation.getGmbConnection.useQuery(
    { accountId },
    { enabled: !!accountId }
  );
  const utils = trpc.useUtils();

  const [googleEmail, setGoogleEmail] = useState("");
  const [accessToken, setAccessToken] = useState("");
  const [refreshToken, setRefreshToken] = useState("");
  const [locationId, setLocationId] = useState("");
  const [locationName, setLocationName] = useState("");
  const [placeId, setPlaceId] = useState("");

  const saveConnection = trpc.reputation.saveGmbConnection.useMutation({
    onSuccess: () => {
      toast.success("Connection saved!");
      utils.reputation.getGmbConnection.invalidate({ accountId });
    },
    onError: (err: any) => toast.error(err.message),
  });

  const syncReviews = trpc.reputation.syncGmbReviews.useMutation({
    onSuccess: (data: any) => {
      toast.success(`Synced ${data.synced} new reviews`);
      utils.reputation.getStats.invalidate({ accountId });
      utils.reputation.listReviews.invalidate({ accountId });
    },
    onError: (err: any) => toast.error(err.message),
  });

  const disconnectGMB = trpc.reputation.disconnectGmb.useMutation({
    onSuccess: () => {
      toast.success("Disconnected successfully");
      utils.reputation.getGmbConnection.invalidate({ accountId });
    },
    onError: (err: any) => toast.error(err.message),
  });

  const conn = connection.data;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Link2 className="h-4 w-4" /> Platform Connections
        </CardTitle>
        <CardDescription>
          Connect your Google My Business and Facebook accounts to sync reviews automatically.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {conn ? (
          <>
            {/* Connected State */}
            <div className="p-3 bg-green-500/5 border border-green-500/20 rounded-lg">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Shield className="h-4 w-4 text-green-600" />
                  <span className="text-sm font-medium text-green-600">Connected</span>
                </div>
                <Badge variant="outline" className="text-xs">
                  {conn.locationName || conn.googleEmail || "Business"}
                </Badge>
              </div>
              {conn.lastSyncAt && (
                <p className="text-xs text-muted-foreground mt-2">
                  Last synced: {new Date(conn.lastSyncAt).toLocaleString()}
                </p>
              )}
            </div>

            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                className="flex-1"
                onClick={() => syncReviews.mutate({ accountId })}
                disabled={syncReviews.isPending}
              >
                {syncReviews.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-1" />
                ) : (
                  <RefreshCw className="h-4 w-4 mr-1" />
                )}
                Sync Reviews
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="text-red-600 hover:text-red-700"
                onClick={() => disconnectGMB.mutate({ accountId })}
                disabled={disconnectGMB.isPending}
              >
                Disconnect
              </Button>
            </div>

            {conn.placeId && (
              <div className="text-xs text-muted-foreground">
                <span className="font-medium">Google Place ID:</span> {conn.placeId}
              </div>
            )}
            {conn.locationName && (
              <div className="text-xs text-muted-foreground">
                <span className="font-medium">Location:</span> {conn.locationName}
              </div>
            )}
            <div className="text-xs text-muted-foreground">
              <span className="font-medium">Account:</span> {conn.googleEmail}
            </div>
          </>
        ) : (
          <>
            {/* Setup Form */}
            <div>
              <Label>Google Account Email</Label>
              <Input
                value={googleEmail}
                onChange={(e) => setGoogleEmail(e.target.value)}
                placeholder="your@gmail.com"
              />
            </div>

            <div>
              <Label>Access Token</Label>
              <Input
                value={accessToken}
                onChange={(e) => setAccessToken(e.target.value)}
                placeholder="ya29..."
                type="password"
              />
              <p className="text-xs text-muted-foreground mt-1">
                OAuth access token from Google My Business API
              </p>
            </div>

            <div>
              <Label>Refresh Token (optional)</Label>
              <Input
                value={refreshToken}
                onChange={(e) => setRefreshToken(e.target.value)}
                placeholder="1//..."
                type="password"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Location Name (optional)</Label>
                <Input
                  value={locationName}
                  onChange={(e) => setLocationName(e.target.value)}
                  placeholder="My Business"
                />
              </div>
              <div>
                <Label>Location ID (optional)</Label>
                <Input
                  value={locationId}
                  onChange={(e) => setLocationId(e.target.value)}
                  placeholder="locations/123"
                />
              </div>
            </div>

            <div>
              <Label>Google Place ID (optional)</Label>
              <Input
                value={placeId}
                onChange={(e) => setPlaceId(e.target.value)}
                placeholder="ChIJ..."
              />
              <p className="text-xs text-muted-foreground mt-1">
                Find at Google Place ID Finder
              </p>
            </div>

            <Button
              className="w-full"
              onClick={() =>
                saveConnection.mutate({
                  accountId,
                  googleEmail,
                  accessToken,
                  refreshToken: refreshToken || undefined,
                  locationId: locationId || undefined,
                  locationName: locationName || undefined,
                  placeId: placeId || undefined,
                })
              }
              disabled={saveConnection.isPending || !googleEmail || !accessToken}
            >
              {saveConnection.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-1" />
              ) : (
                <Link2 className="h-4 w-4 mr-1" />
              )}
              Connect Platforms
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Alert Settings Card ───────────────────────────────────
function AlertSettingsCard({ accountId }: { accountId: number }) {
  const settings = trpc.reputation.getAlertSettings.useQuery(
    { accountId },
    { enabled: !!accountId }
  );
  const utils = trpc.useUtils();

  const [enabled, setEnabled] = useState(true);
  const [ratingThreshold, setRatingThreshold] = useState(2);
  const [notifyInApp, setNotifyInApp] = useState(true);
  const [notifyEmail, setNotifyEmail] = useState(true);
  const [notifySms, setNotifySms] = useState(false);
  const [emailRecipients, setEmailRecipients] = useState("");
  const [smsRecipients, setSmsRecipients] = useState("");
  const [initialized, setInitialized] = useState(false);

  // Populate form when settings load
  if (settings.data && !initialized) {
    setEnabled(settings.data.enabled);
    setRatingThreshold(settings.data.ratingThreshold);
    setNotifyInApp(settings.data.notifyInApp);
    setNotifyEmail(settings.data.notifyEmail);
    setNotifySms(settings.data.notifySms);
    setEmailRecipients(settings.data.emailRecipients || "");
    setSmsRecipients(settings.data.smsRecipients || "");
    setInitialized(true);
  }

  const saveSettings = trpc.reputation.saveAlertSettings.useMutation({
    onSuccess: () => {
      toast.success("Alert settings saved!");
      utils.reputation.getAlertSettings.invalidate({ accountId });
    },
    onError: (err) => toast.error(err.message),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Bell className="h-4 w-4" /> Reputation Alerts
        </CardTitle>
        <CardDescription>
          Get notified when negative reviews are posted so you can respond quickly.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Enable/Disable */}
        <div className="flex items-center justify-between">
          <div>
            <Label>Enable Alerts</Label>
            <p className="text-xs text-muted-foreground">Receive notifications for low-rated reviews</p>
          </div>
          <Switch checked={enabled} onCheckedChange={setEnabled} />
        </div>

        {enabled && (
          <>
            {/* Rating Threshold */}
            <div>
              <Label>Rating Threshold</Label>
              <p className="text-xs text-muted-foreground mb-2">
                Alert when a review is at or below this rating
              </p>
              <div className="flex items-center gap-2">
                {[1, 2, 3].map((r) => (
                  <button
                    key={r}
                    onClick={() => setRatingThreshold(r)}
                    className={`flex items-center gap-1 px-3 py-1.5 rounded-md border text-sm transition-colors ${
                      ratingThreshold === r
                        ? "border-yellow-400 bg-yellow-400/10 text-yellow-600"
                        : "border-border hover:border-yellow-400/50"
                    }`}
                  >
                    {r} <Star size={12} className="fill-yellow-400 text-yellow-400" />
                    {r === 1 ? " & below" : " & below"}
                  </button>
                ))}
              </div>
            </div>

            {/* Notification Channels */}
            <div className="space-y-3">
              <Label>Notification Channels</Label>

              <div className="flex items-center justify-between p-3 border rounded-lg">
                <div className="flex items-center gap-2">
                  <Bell className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">In-App Notification</span>
                </div>
                <Switch checked={notifyInApp} onCheckedChange={setNotifyInApp} />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex items-center gap-2">
                    <Send className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">Email Notification</span>
                  </div>
                  <Switch checked={notifyEmail} onCheckedChange={setNotifyEmail} />
                </div>
                {notifyEmail && (
                  <Input
                    value={emailRecipients}
                    onChange={(e) => setEmailRecipients(e.target.value)}
                    placeholder="email1@example.com, email2@example.com"
                    className="text-sm"
                  />
                )}
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex items-center gap-2">
                    <MessageSquare className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">SMS Notification</span>
                  </div>
                  <Switch checked={notifySms} onCheckedChange={setNotifySms} />
                </div>
                {notifySms && (
                  <Input
                    value={smsRecipients}
                    onChange={(e) => setSmsRecipients(e.target.value)}
                    placeholder="+1234567890, +0987654321"
                    className="text-sm"
                  />
                )}
              </div>
            </div>

            {/* Warning for negative reviews */}
            <div className="p-3 bg-yellow-500/5 border border-yellow-500/20 rounded-lg">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-yellow-600" />
                <span className="text-sm text-yellow-600 font-medium">Quick Response Matters</span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Responding to negative reviews within 24 hours can improve customer perception by up to 33%.
              </p>
            </div>
          </>
        )}

        <Button
          className="w-full"
          onClick={() =>
            saveSettings.mutate({
              accountId,
              enabled,
              ratingThreshold,
              notifyInApp,
              notifyEmail,
              notifySms,
              emailRecipients: emailRecipients || undefined,
              smsRecipients: smsRecipients || undefined,
            })
          }
          disabled={saveSettings.isPending}
        >
          {saveSettings.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin mr-1" />
          ) : (
            <Check className="h-4 w-4 mr-1" />
          )}
          Save Alert Settings
        </Button>
      </CardContent>
    </Card>
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

      {/* Tabs: Reviews, Requests, Settings */}
      <Tabs defaultValue="reviews">
        <TabsList>
          <TabsTrigger value="reviews">
            <Star className="h-4 w-4 mr-1" /> Reviews
          </TabsTrigger>
          <TabsTrigger value="requests">
            <Send className="h-4 w-4 mr-1" /> Requests
          </TabsTrigger>
          <TabsTrigger value="settings">
            <Settings className="h-4 w-4 mr-1" /> Settings
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
                            {(review as any).replyBody ? (
                              <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-500/20 text-xs">
                                <Reply className="h-3 w-3 mr-1" /> Replied
                              </Badge>
                            ) : null}
                            <AIReplyDialog
                              accountId={accountId}
                              review={{
                                id: review.id,
                                body: review.body,
                                rating: review.rating,
                                reviewerName: review.reviewerName,
                                platform: review.platform,
                                replyBody: (review as any).replyBody || null,
                              }}
                              onReplyPosted={handleRefresh}
                            />
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
        {/* Settings Tab */}
        <TabsContent value="settings">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* GMB Connection */}
            <GMBConnectionCard accountId={accountId} />

            {/* Alert Settings */}
            <AlertSettingsCard accountId={accountId} />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
