import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getLoginUrl } from "@/const";
import {
  Building2,
  CheckCircle2,
  Clock,
  Loader2,
  Mail,
  XCircle,
  Zap,
} from "lucide-react";
import { useState } from "react";
import { useLocation, useParams } from "wouter";
import { toast } from "sonner";

export default function InviteAccept() {
  const params = useParams<{ token: string }>();
  const token = params.token || "";
  const { user, loading: authLoading } = useAuth();
  const [, setLocation] = useLocation();
  const [accepted, setAccepted] = useState(false);

  const {
    data: invitation,
    isLoading,
    error,
  } = trpc.invitations.getByToken.useQuery(
    { token },
    { enabled: !!token }
  );

  const acceptMutation = trpc.invitations.accept.useMutation({
    onSuccess: (data) => {
      setAccepted(true);
      toast.success("Invitation accepted! Welcome to the team.");
    },
    onError: (err) => {
      toast.error("Failed to accept invitation", {
        description: err.message,
      });
    },
  });

  if (isLoading || authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !invitation) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Card className="max-w-md w-full border-border/50 bg-card">
          <CardContent className="pt-8 pb-6 px-6 text-center">
            <XCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
            <h2 className="text-lg font-semibold mb-2">Invalid Invitation</h2>
            <p className="text-sm text-muted-foreground mb-6">
              This invitation link is invalid or has expired.
            </p>
            <Button onClick={() => setLocation("/")} variant="outline">
              Go to Dashboard
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (accepted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Card className="max-w-md w-full border-border/50 bg-card">
          <CardContent className="pt-8 pb-6 px-6 text-center">
            <CheckCircle2 className="h-12 w-12 text-success mx-auto mb-4" />
            <h2 className="text-lg font-semibold mb-2">Welcome Aboard!</h2>
            <p className="text-sm text-muted-foreground mb-6">
              You have successfully joined{" "}
              <strong>{invitation.accountName}</strong> as a{" "}
              <Badge variant="outline" className="text-xs">
                {invitation.role}
              </Badge>
              .
            </p>
            <Button onClick={() => setLocation("/")}>Go to Dashboard</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const isExpired =
    invitation.status !== "pending" ||
    new Date() > new Date(invitation.expiresAt);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="max-w-md w-full border-border/50 bg-card">
        <CardHeader className="text-center pb-2">
          <div className="flex items-center justify-center gap-2 mb-4">
            <div className="h-10 w-10 rounded-lg bg-primary flex items-center justify-center">
              <Zap className="h-5 w-5 text-primary-foreground" />
            </div>
          </div>
          <CardTitle className="text-lg">Team Invitation</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6 px-6 pb-6">
          <div className="space-y-3">
            <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
              <Building2 className="h-5 w-5 text-muted-foreground shrink-0" />
              <div>
                <p className="text-sm font-medium">{invitation.accountName}</p>
                <p className="text-xs text-muted-foreground">Account</p>
              </div>
            </div>

            <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
              <Mail className="h-5 w-5 text-muted-foreground shrink-0" />
              <div>
                <p className="text-sm font-medium">{invitation.email}</p>
                <p className="text-xs text-muted-foreground">Invited as</p>
              </div>
              <Badge variant="outline" className="ml-auto text-xs capitalize">
                {invitation.role}
              </Badge>
            </div>

            <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
              <Clock className="h-5 w-5 text-muted-foreground shrink-0" />
              <div>
                <p className="text-sm font-medium">
                  {new Date(invitation.expiresAt).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })}
                </p>
                <p className="text-xs text-muted-foreground">Expires</p>
              </div>
            </div>
          </div>

          {invitation.message && (
            <div className="p-3 rounded-lg border border-border/50 bg-muted/30">
              <p className="text-xs text-muted-foreground mb-1">
                Personal message:
              </p>
              <p className="text-sm italic">&ldquo;{invitation.message}&rdquo;</p>
            </div>
          )}

          {isExpired ? (
            <div className="text-center">
              <XCircle className="h-8 w-8 text-destructive mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">
                This invitation has{" "}
                {invitation.status === "pending" ? "expired" : invitation.status}
                .
              </p>
            </div>
          ) : !user ? (
            <Button
              className="w-full"
              onClick={() => {
                window.location.href = getLoginUrl(`/invite/${token}`);
              }}
            >
              Sign in to Accept
            </Button>
          ) : (
            <Button
              className="w-full"
              onClick={() => acceptMutation.mutate({ token })}
              disabled={acceptMutation.isPending}
            >
              {acceptMutation.isPending
                ? "Accepting..."
                : "Accept Invitation"}
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
