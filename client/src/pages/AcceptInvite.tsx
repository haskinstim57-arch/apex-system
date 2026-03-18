import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Zap,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Eye,
  EyeOff,
} from "lucide-react";

const SELECTED_ACCOUNT_KEY = "apex-selected-account";

export default function AcceptInvite() {
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState<{
    accountId: number;
    accountName: string;
  } | null>(null);

  // Extract token from URL
  const params = new URLSearchParams(window.location.search);
  const token = params.get("token") || "";

  // Validate the invitation token
  const {
    data: invitation,
    isLoading: invitationLoading,
    error: invitationError,
  } = trpc.invitations.getByToken.useQuery(
    { token },
    { enabled: !!token, retry: false }
  );

  const acceptMutation = trpc.subAccountAuth.acceptInviteWithPassword.useMutation({
    onSuccess: (data) => {
      setSuccess({ accountId: data.accountId, accountName: data.accountName });
      // Store the account ID so they land on the right account
      localStorage.setItem(SELECTED_ACCOUNT_KEY, data.accountId.toString());
    },
    onError: (err) => {
      setError(err.message || "Failed to accept invitation");
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!name.trim()) {
      setError("Please enter your full name");
      return;
    }

    if (password.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    acceptMutation.mutate({ token, name: name.trim(), password });
  };

  // No token provided
  if (!token) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <Card className="max-w-md w-full mx-4 border-border/50 shadow-xl">
          <CardContent className="pt-8 pb-6 text-center">
            <AlertCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
            <h2 className="text-lg font-semibold mb-2">Invalid Link</h2>
            <p className="text-sm text-muted-foreground mb-4">
              This invitation link is missing required information. Please check
              your email for the correct link.
            </p>
            <Button
              variant="outline"
              onClick={() => (window.location.href = "/sub-login")}
            >
              Go to Login
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Loading invitation
  if (invitationLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">
            Verifying invitation...
          </p>
        </div>
      </div>
    );
  }

  // Invalid or expired invitation
  if (invitationError || !invitation) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <Card className="max-w-md w-full mx-4 border-border/50 shadow-xl">
          <CardContent className="pt-8 pb-6 text-center">
            <AlertCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
            <h2 className="text-lg font-semibold mb-2">
              Invalid Invitation
            </h2>
            <p className="text-sm text-muted-foreground mb-4">
              {invitationError?.message ||
                "This invitation link is invalid or has expired. Please contact your administrator."}
            </p>
            <Button
              variant="outline"
              onClick={() => (window.location.href = "/sub-login")}
            >
              Go to Login
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Invitation already used
  if (invitation.status !== "pending") {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <Card className="max-w-md w-full mx-4 border-border/50 shadow-xl">
          <CardContent className="pt-8 pb-6 text-center">
            <AlertCircle className="h-12 w-12 text-yellow-500 mx-auto mb-4" />
            <h2 className="text-lg font-semibold mb-2">
              Invitation Already {invitation.status === "accepted" ? "Accepted" : "Expired"}
            </h2>
            <p className="text-sm text-muted-foreground mb-4">
              {invitation.status === "accepted"
                ? "This invitation has already been accepted. You can sign in with your credentials."
                : "This invitation has expired. Please contact your administrator to resend it."}
            </p>
            <Button
              variant="outline"
              onClick={() => (window.location.href = "/sub-login")}
            >
              Go to Login
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Invitation expired by date
  if (new Date() > new Date(invitation.expiresAt)) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <Card className="max-w-md w-full mx-4 border-border/50 shadow-xl">
          <CardContent className="pt-8 pb-6 text-center">
            <AlertCircle className="h-12 w-12 text-yellow-500 mx-auto mb-4" />
            <h2 className="text-lg font-semibold mb-2">Invitation Expired</h2>
            <p className="text-sm text-muted-foreground mb-4">
              This invitation has expired. Please contact your administrator to
              resend it.
            </p>
            <Button
              variant="outline"
              onClick={() => (window.location.href = "/sub-login")}
            >
              Go to Login
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Success state
  if (success) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <Card className="max-w-md w-full mx-4 border-border/50 shadow-xl">
          <CardContent className="pt-8 pb-6 text-center">
            <CheckCircle2 className="h-12 w-12 text-green-500 mx-auto mb-4" />
            <h2 className="text-lg font-semibold mb-2">Welcome Aboard!</h2>
            <p className="text-sm text-muted-foreground mb-4">
              Your account has been set up successfully. You now have access to{" "}
              <strong>{success.accountName}</strong>.
            </p>
            <Button
              className="w-full"
              size="lg"
              onClick={() => (window.location.href = "/")}
            >
              Go to Dashboard
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ─── Accept Invitation Form ───
  return (
    <div className="flex items-center justify-center min-h-screen bg-background">
      <div className="flex flex-col items-center gap-6 p-4 max-w-md w-full">
        {/* Logo */}
        <div className="flex items-center gap-2 mb-2">
          <div className="h-10 w-10 rounded-lg bg-primary flex items-center justify-center">
            <Zap className="h-5 w-5 text-primary-foreground" />
          </div>
          <span className="text-2xl font-bold tracking-tight">Apex System</span>
        </div>

        <Card className="w-full border-border/50 shadow-xl">
          <CardHeader className="text-center pb-4">
            <CardTitle className="text-xl">Accept Invitation</CardTitle>
            <CardDescription>
              You've been invited to join{" "}
              <strong className="text-foreground">{invitation.accountName}</strong>{" "}
              as {invitation.role === "owner" ? "an" : "a"}{" "}
              <strong className="text-foreground capitalize">{invitation.role}</strong>.
              Set up your password to get started.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <Alert variant="destructive" className="py-2">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription className="text-sm">{error}</AlertDescription>
                </Alert>
              )}

              {/* Email (read-only) */}
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={invitation.email}
                  disabled
                  className="bg-muted/50"
                />
              </div>

              {/* Full Name */}
              <div className="space-y-2">
                <Label htmlFor="name">Full Name</Label>
                <Input
                  id="name"
                  type="text"
                  placeholder="Enter your full name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  autoComplete="name"
                  autoFocus
                  disabled={acceptMutation.isPending}
                />
              </div>

              {/* Password */}
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="Min. 8 characters"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="new-password"
                    disabled={acceptMutation.isPending}
                  />
                  <button
                    type="button"
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                    onClick={() => setShowPassword(!showPassword)}
                    tabIndex={-1}
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Must be at least 8 characters
                </p>
              </div>

              {/* Confirm Password */}
              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirm Password</Label>
                <Input
                  id="confirmPassword"
                  type={showPassword ? "text" : "password"}
                  placeholder="Re-enter your password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  autoComplete="new-password"
                  disabled={acceptMutation.isPending}
                />
              </div>

              <Button
                type="submit"
                className="w-full"
                size="lg"
                disabled={acceptMutation.isPending}
              >
                {acceptMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Setting up your account...
                  </>
                ) : (
                  "Accept & Create Account"
                )}
              </Button>
            </form>

            {invitation.message && (
              <div className="mt-4 p-3 rounded-lg bg-muted/50 border border-border/50">
                <p className="text-xs text-muted-foreground mb-1">
                  Message from your administrator:
                </p>
                <p className="text-sm italic">"{invitation.message}"</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
