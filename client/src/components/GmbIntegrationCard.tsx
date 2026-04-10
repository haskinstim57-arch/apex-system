import { useState, useEffect, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  MapPin,
  CheckCircle2,
  Loader2,
  ExternalLink,
  Unlink,
  Star,
  RefreshCw,
  Send,
  MessageSquare,
  FileText,
  ChevronDown,
  ChevronUp,
  AlertCircle,
} from "lucide-react";
import { toast } from "sonner";

// ─── Star Rating Display ──────────────────────────────────────
function StarRating({ rating }: { rating: string }) {
  const map: Record<string, number> = { ONE: 1, TWO: 2, THREE: 3, FOUR: 4, FIVE: 5 };
  const count = map[rating] || 0;
  return (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: 5 }, (_, i) => (
        <Star
          key={i}
          className={`h-3.5 w-3.5 ${i < count ? "fill-amber-400 text-amber-400" : "text-muted-foreground/30"}`}
        />
      ))}
    </div>
  );
}

// ─── Google "G" Logo SVG ──────────────────────────────────────
function GoogleGLogo({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24">
      <path
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
        fill="#4285F4"
      />
      <path
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        fill="#34A853"
      />
      <path
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
        fill="#FBBC05"
      />
      <path
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
        fill="#EA4335"
      />
    </svg>
  );
}

// ─── CTA Type Options ─────────────────────────────────────────
const CTA_TYPES = [
  { value: "NONE", label: "None" },
  { value: "LEARN_MORE", label: "Learn More" },
  { value: "BOOK", label: "Book" },
  { value: "CALL", label: "Call" },
  { value: "ORDER", label: "Order" },
  { value: "SHOP", label: "Shop" },
  { value: "SIGN_UP", label: "Sign Up" },
];

// ─── Time Ago Helper ──────────────────────────────────────────
function timeAgo(date: Date | string | null | undefined): string {
  if (!date) return "";
  const d = typeof date === "string" ? new Date(date) : date;
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  const weeks = Math.floor(days / 7);
  if (weeks < 4) return `${weeks}w ago`;
  return d.toLocaleDateString();
}

export function GmbIntegrationCard({ accountId }: { accountId: number }) {
  const utils = trpc.useUtils();

  // ─── State ──────────────────────────────────────────────────
  const [activeSubTab, setActiveSubTab] = useState<"reviews" | "post">("reviews");
  const [selectedLocationId, setSelectedLocationId] = useState("");
  const [selectedLocationName, setSelectedLocationName] = useState("");
  const [replyingTo, setReplyingTo] = useState<number | null>(null);
  const [replyText, setReplyText] = useState("");
  const [postSummary, setPostSummary] = useState("");
  const [ctaType, setCtaType] = useState("NONE");
  const [ctaUrl, setCtaUrl] = useState("");

  // ─── Queries ────────────────────────────────────────────────
  const { data: connection, isLoading: isLoadingConn } =
    trpc.reputation.getGmbConnection.useQuery(
      { accountId },
      { enabled: !!accountId }
    );

  const isConnected = connection && connection.status === "active";
  const hasLocation = isConnected && !!connection.locationId;

  const { data: locations, isLoading: isLoadingLocations } =
    trpc.reputation.getGmbLocations.useQuery(
      { accountId },
      { enabled: !!accountId && isConnected === true && !hasLocation }
    );

  const { data: gmbReviews, isLoading: isLoadingReviews } =
    trpc.reputation.getGmbReviews.useQuery(
      { accountId },
      { enabled: !!accountId && hasLocation === true }
    );

  // ─── Mutations ──────────────────────────────────────────────
  const getAuthUrlMutation = trpc.reputation.getGmbAuthUrl.useMutation({
    onSuccess: (data) => {
      window.location.href = data.url;
    },
    onError: (err) => {
      toast.error(err.message || "Failed to generate Google auth URL");
    },
  });

  const disconnectMutation = trpc.reputation.disconnectGmb.useMutation({
    onSuccess: () => {
      toast.success("Google Business Profile disconnected");
      utils.reputation.getGmbConnection.invalidate({ accountId });
    },
    onError: (err) => {
      toast.error(err.message || "Failed to disconnect");
    },
  });

  const selectLocationMutation = trpc.reputation.selectGmbLocation.useMutation({
    onSuccess: () => {
      toast.success("Location saved");
      utils.reputation.getGmbConnection.invalidate({ accountId });
    },
    onError: (err) => {
      toast.error(err.message || "Failed to save location");
    },
  });

  const syncReviewsMutation = trpc.reputation.syncGmbReviews.useMutation({
    onSuccess: (result) => {
      if (result.success) {
        toast.success(`Synced ${result.synced} review${result.synced !== 1 ? "s" : ""} from Google`);
      } else {
        toast.error(result.message || "Sync failed");
      }
      utils.reputation.getGmbReviews.invalidate({ accountId });
      utils.reputation.getGmbConnection.invalidate({ accountId });
    },
    onError: (err) => {
      toast.error(err.message || "Failed to sync reviews");
    },
  });

  const replyMutation = trpc.reputation.replyToGmbReview.useMutation({
    onSuccess: () => {
      toast.success("Reply posted");
      setReplyingTo(null);
      setReplyText("");
      utils.reputation.getGmbReviews.invalidate({ accountId });
    },
    onError: (err) => {
      toast.error(err.message || "Failed to post reply");
    },
  });

  const createPostMutation = trpc.reputation.createGmbPost.useMutation({
    onSuccess: () => {
      toast.success("Post published to Google Business Profile!");
      setPostSummary("");
      setCtaType("NONE");
      setCtaUrl("");
    },
    onError: (err) => {
      toast.error(err.message || "Failed to create post");
    },
  });

  // ─── Handle OAuth redirect ──────────────────────────────────
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const gmbStatus = params.get("gmb");
    if (gmbStatus === "connected") {
      toast.success("Google Business Profile connected successfully!");
      utils.reputation.getGmbConnection.invalidate({ accountId });
      // Clean URL
      const url = new URL(window.location.href);
      url.searchParams.delete("gmb");
      url.searchParams.delete("account");
      window.history.replaceState({}, "", url.pathname + url.search);
    } else if (gmbStatus === "error") {
      const reason = params.get("reason") || "unknown";
      toast.error(`Google connection failed: ${reason}`);
      const url = new URL(window.location.href);
      url.searchParams.delete("gmb");
      url.searchParams.delete("reason");
      window.history.replaceState({}, "", url.pathname + url.search);
    }
  }, [accountId, utils]);

  // ─── Handlers ───────────────────────────────────────────────
  const handleConnect = () => {
    getAuthUrlMutation.mutate({ accountId, origin: window.location.origin });
  };

  const handleDisconnect = () => {
    if (window.confirm("Disconnect Google Business Profile? This will remove the connection but keep synced reviews.")) {
      disconnectMutation.mutate({ accountId });
    }
  };

  const handleSaveLocation = () => {
    if (!selectedLocationId || !selectedLocationName) {
      toast.error("Please select a location");
      return;
    }
    selectLocationMutation.mutate({
      accountId,
      locationId: selectedLocationId,
      locationName: selectedLocationName,
    });
  };

  const handleReply = (reviewDbId: number) => {
    if (!replyText.trim()) return;
    replyMutation.mutate({
      accountId,
      gmbReviewId: reviewDbId,
      replyText: replyText.trim(),
    });
  };

  const handleCreatePost = () => {
    if (!postSummary.trim()) {
      toast.error("Please enter post content");
      return;
    }
    createPostMutation.mutate({
      accountId,
      summary: postSummary.trim(),
      ctaType: ctaType !== "NONE" ? ctaType : undefined,
      ctaUrl: ctaType !== "NONE" && ctaUrl ? ctaUrl : undefined,
    });
  };

  // ─── Render ─────────────────────────────────────────────────
  return (
    <Card className="bg-card border-0 card-shadow">
      <CardHeader>
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <MapPin className="h-4 w-4 text-muted-foreground" />
          Google Business Profile
        </CardTitle>
        <CardDescription className="text-xs">
          Manage reviews and post updates to your Google Business listing.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoadingConn ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Checking connection...
          </div>
        ) : !isConnected ? (
          /* ═══ Not Connected ═══ */
          <div className="flex items-start gap-4 p-4 rounded-lg border border-border/50">
            <div className="h-10 w-10 rounded-lg bg-white flex items-center justify-center shrink-0 border border-border/50">
              <GoogleGLogo className="h-5 w-5" />
            </div>
            <div className="flex-1 min-w-0 space-y-2">
              <h4 className="text-sm font-medium">Google My Business</h4>
              <p className="text-xs text-muted-foreground">
                Connect your Google Business Profile to manage reviews, respond to customers, and post updates directly from Apex.
              </p>
              <Button
                variant="outline"
                size="sm"
                className="text-xs border-blue-200 text-blue-600 hover:bg-blue-500/10"
                onClick={handleConnect}
                disabled={getAuthUrlMutation.isPending}
              >
                {getAuthUrlMutation.isPending ? (
                  <>
                    <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                    Connecting...
                  </>
                ) : (
                  <>
                    <ExternalLink className="h-3 w-3 mr-1" />
                    Connect Google Business
                  </>
                )}
              </Button>
            </div>
          </div>
        ) : !hasLocation ? (
          /* ═══ Connected, No Location Selected ═══ */
          <div className="space-y-4">
            {/* Connection header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-[10px] bg-green-500/10 text-green-500 border-green-200">
                  <CheckCircle2 className="h-3 w-3 mr-1" />
                  Connected
                </Badge>
                <span className="text-xs text-muted-foreground">
                  {connection.googleEmail}
                </span>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="text-xs text-destructive border-destructive/30 hover:bg-destructive/10"
                onClick={handleDisconnect}
                disabled={disconnectMutation.isPending}
              >
                {disconnectMutation.isPending ? (
                  <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                ) : (
                  <Unlink className="h-3 w-3 mr-1" />
                )}
                Disconnect
              </Button>
            </div>

            {/* Location selector */}
            <div className="p-4 rounded-lg border border-border/50 bg-muted/20 space-y-3">
              <p className="text-sm font-medium">Select your business location</p>
              {isLoadingLocations ? (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Loading locations...
                </div>
              ) : locations && locations.length > 0 ? (
                <div className="flex gap-2">
                  <Select
                    value={selectedLocationId}
                    onValueChange={(val) => {
                      setSelectedLocationId(val);
                      const loc = locations.find((l: any) => l.name === val);
                      setSelectedLocationName(loc ? `${loc.title}${loc.address ? ` - ${loc.address}` : ""}` : "");
                    }}
                  >
                    <SelectTrigger className="flex-1 text-xs h-9">
                      <SelectValue placeholder="Choose a location..." />
                    </SelectTrigger>
                    <SelectContent>
                      {locations.map((loc: any) => (
                        <SelectItem key={loc.name} value={loc.name}>
                          {loc.title}{loc.address ? ` — ${loc.address}` : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    size="sm"
                    className="text-xs"
                    onClick={handleSaveLocation}
                    disabled={!selectedLocationId || selectLocationMutation.isPending}
                  >
                    {selectLocationMutation.isPending ? (
                      <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                    ) : null}
                    Save Location
                  </Button>
                </div>
              ) : (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <AlertCircle className="h-3.5 w-3.5" />
                  No locations found. Make sure your Google account has a Business Profile.
                </div>
              )}
            </div>
          </div>
        ) : (
          /* ═══ Connected + Location Selected — Full Management UI ═══ */
          <div className="space-y-4">
            {/* Connection header */}
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant="outline" className="text-[10px] bg-green-500/10 text-green-500 border-green-200">
                  <CheckCircle2 className="h-3 w-3 mr-1" />
                  Connected
                </Badge>
                <span className="text-xs text-muted-foreground truncate max-w-[200px]">
                  {connection.locationName || connection.googleEmail}
                </span>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="text-xs"
                  onClick={() => {
                    // Reset location to allow re-selection
                    selectLocationMutation.mutate({
                      accountId,
                      locationId: "",
                      locationName: "",
                    });
                  }}
                >
                  Change Location
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="text-xs text-destructive border-destructive/30 hover:bg-destructive/10"
                  onClick={handleDisconnect}
                  disabled={disconnectMutation.isPending}
                >
                  {disconnectMutation.isPending ? (
                    <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                  ) : (
                    <Unlink className="h-3 w-3 mr-1" />
                  )}
                  Disconnect
                </Button>
              </div>
            </div>

            {/* Sub-tabs: Reviews | Create Post */}
            <div className="flex gap-1 border-b border-border">
              <button
                onClick={() => setActiveSubTab("reviews")}
                className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium border-b-2 transition-colors ${
                  activeSubTab === "reviews"
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                <MessageSquare className="h-3.5 w-3.5" />
                Reviews
              </button>
              <button
                onClick={() => setActiveSubTab("post")}
                className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium border-b-2 transition-colors ${
                  activeSubTab === "post"
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                <FileText className="h-3.5 w-3.5" />
                Create Post
              </button>
            </div>

            {/* ─── Reviews Tab ─── */}
            {activeSubTab === "reviews" && (
              <div className="space-y-3">
                {/* Sync button */}
                <div className="flex items-center justify-between">
                  <p className="text-xs text-muted-foreground">
                    {connection.lastSyncAt
                      ? `Last synced ${timeAgo(connection.lastSyncAt)}`
                      : "Not synced yet"}
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-xs"
                    onClick={() => syncReviewsMutation.mutate({ accountId })}
                    disabled={syncReviewsMutation.isPending}
                  >
                    {syncReviewsMutation.isPending ? (
                      <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                    ) : (
                      <RefreshCw className="h-3 w-3 mr-1" />
                    )}
                    {syncReviewsMutation.isPending ? "Syncing..." : "Sync Reviews"}
                  </Button>
                </div>

                {/* Reviews list */}
                {isLoadingReviews ? (
                  <div className="flex items-center gap-2 py-6 justify-center text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Loading reviews...
                  </div>
                ) : gmbReviews && gmbReviews.length > 0 ? (
                  <div className="space-y-2">
                    {gmbReviews.map((review) => (
                      <div
                        key={review.id}
                        className="p-3 rounded-lg border border-border/50 space-y-2"
                      >
                        {/* Review header */}
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <StarRating rating={review.starRating} />
                            <span className="text-xs font-medium">
                              {review.reviewerName || "Anonymous"}
                            </span>
                          </div>
                          <span className="text-[11px] text-muted-foreground">
                            {timeAgo(review.reviewPublishedAt)}
                          </span>
                        </div>

                        {/* Review body */}
                        {review.comment && (
                          <p className="text-xs text-muted-foreground leading-relaxed">
                            &ldquo;{review.comment}&rdquo;
                          </p>
                        )}

                        {/* Existing reply */}
                        {review.replyText && (
                          <div className="ml-4 p-2 rounded bg-muted/50 border-l-2 border-primary/30">
                            <p className="text-[11px] font-medium text-muted-foreground mb-0.5">
                              Your reply
                            </p>
                            <p className="text-xs text-foreground">
                              {review.replyText}
                            </p>
                          </div>
                        )}

                        {/* Reply button / form */}
                        {replyingTo === review.id ? (
                          <div className="space-y-2 ml-4">
                            <Textarea
                              value={replyText}
                              onChange={(e) => setReplyText(e.target.value)}
                              placeholder="Write your reply..."
                              className="text-xs min-h-[60px] resize-none"
                              maxLength={4096}
                            />
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                className="text-xs"
                                onClick={() => handleReply(review.id)}
                                disabled={!replyText.trim() || replyMutation.isPending}
                              >
                                {replyMutation.isPending ? (
                                  <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                                ) : (
                                  <Send className="h-3 w-3 mr-1" />
                                )}
                                {replyMutation.isPending ? "Posting..." : "Post Reply"}
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-xs"
                                onClick={() => {
                                  setReplyingTo(null);
                                  setReplyText("");
                                }}
                              >
                                Cancel
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-xs text-muted-foreground hover:text-foreground"
                            onClick={() => {
                              setReplyingTo(review.id);
                              setReplyText(review.replyText || "");
                            }}
                          >
                            <MessageSquare className="h-3 w-3 mr-1" />
                            {review.replyText ? "Edit Reply" : "Reply"}
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-sm text-muted-foreground">
                    <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-30" />
                    <p>No reviews synced yet.</p>
                    <p className="text-xs mt-1">Click "Sync Reviews" to pull reviews from Google.</p>
                  </div>
                )}
              </div>
            )}

            {/* ─── Create Post Tab ─── */}
            {activeSubTab === "post" && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-xs font-medium">
                    What&apos;s your update?
                  </Label>
                  <Textarea
                    value={postSummary}
                    onChange={(e) => setPostSummary(e.target.value)}
                    placeholder="Share a business update, promotion, or news with your customers..."
                    className="text-xs min-h-[100px] resize-none"
                    maxLength={1500}
                  />
                  <p className="text-[11px] text-muted-foreground text-right">
                    {postSummary.length}/1500
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium">CTA Type</Label>
                    <Select value={ctaType} onValueChange={setCtaType}>
                      <SelectTrigger className="text-xs h-9">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {CTA_TYPES.map((cta) => (
                          <SelectItem key={cta.value} value={cta.value}>
                            {cta.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  {ctaType !== "NONE" && (
                    <div className="space-y-1.5">
                      <Label className="text-xs font-medium">CTA URL</Label>
                      <input
                        type="url"
                        value={ctaUrl}
                        onChange={(e) => setCtaUrl(e.target.value)}
                        placeholder="https://..."
                        className="w-full h-9 px-3 rounded-md border border-input bg-background text-xs focus:outline-none focus:ring-2 focus:ring-primary/50"
                      />
                    </div>
                  )}
                </div>

                <Button
                  className="text-xs w-full"
                  onClick={handleCreatePost}
                  disabled={!postSummary.trim() || createPostMutation.isPending}
                >
                  {createPostMutation.isPending ? (
                    <>
                      <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                      Publishing...
                    </>
                  ) : (
                    <>
                      <Send className="h-3 w-3 mr-1" />
                      Post to Google Business
                    </>
                  )}
                </Button>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
