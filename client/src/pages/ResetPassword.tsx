import { useState } from "react";
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

export default function ResetPassword() {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  // Extract token from URL
  const params = new URLSearchParams(window.location.search);
  const token = params.get("token") || "";

  // Validate the reset token
  const {
    data: tokenInfo,
    isLoading: tokenLoading,
    error: tokenError,
  } = trpc.subAccountAuth.validateResetToken.useQuery(
    { token },
    { enabled: !!token, retry: false }
  );

  const resetMutation =
    trpc.subAccountAuth.resetPasswordWithToken.useMutation({
      onSuccess: () => {
        setSuccess(true);
      },
      onError: (err) => {
        setError(err.message || "Failed to reset password. Please try again.");
      },
    });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (password.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    resetMutation.mutate({ token, newPassword: password });
  };

  // No token
  if (!token) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <Card className="max-w-md w-full mx-4 border-border/50 shadow-xl">
          <CardContent className="pt-8 pb-6 text-center">
            <AlertCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
            <h2 className="text-lg font-semibold mb-2">Invalid Link</h2>
            <p className="text-sm text-muted-foreground mb-4">
              This password reset link is missing required information. Please
              request a new one.
            </p>
            <Button
              variant="outline"
              onClick={() => (window.location.href = "/forgot-password")}
            >
              Request New Link
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Loading
  if (tokenLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">
            Verifying reset link...
          </p>
        </div>
      </div>
    );
  }

  // Invalid or expired token
  if (tokenError || !tokenInfo?.valid) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <Card className="max-w-md w-full mx-4 border-border/50 shadow-xl">
          <CardContent className="pt-8 pb-6 text-center">
            <AlertCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
            <h2 className="text-lg font-semibold mb-2">
              Invalid or Expired Link
            </h2>
            <p className="text-sm text-muted-foreground mb-4">
              This password reset link is invalid or has expired. Please request
              a new one.
            </p>
            <Button
              variant="outline"
              onClick={() => (window.location.href = "/forgot-password")}
            >
              Request New Link
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Success
  if (success) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <Card className="max-w-md w-full mx-4 border-border/50 shadow-xl">
          <CardContent className="pt-8 pb-6 text-center">
            <CheckCircle2 className="h-12 w-12 text-green-500 mx-auto mb-4" />
            <h2 className="text-lg font-semibold mb-2">
              Password Reset Successfully
            </h2>
            <p className="text-sm text-muted-foreground mb-4">
              Your password has been updated. You can now sign in with your new
              password.
            </p>
            <Button
              className="w-full"
              size="lg"
              onClick={() => (window.location.href = "/sub-login")}
            >
              Go to Login
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ─── Reset Password Form ───
  return (
    <div className="flex items-center justify-center min-h-screen bg-background">
      <div className="flex flex-col items-center gap-6 p-4 max-w-md w-full">
        {/* Logo */}
        <div className="flex items-center gap-2 mb-2">
          <div className="h-10 w-10 rounded-lg bg-primary flex items-center justify-center">
            <Zap className="h-5 w-5 text-primary-foreground" />
          </div>
          <span className="text-2xl font-bold tracking-tight">
            Sterling Marketing
          </span>
        </div>

        <Card className="w-full border-border/50 shadow-xl">
          <CardHeader className="text-center pb-4">
            <CardTitle className="text-xl">Set New Password</CardTitle>
            <CardDescription>
              {tokenInfo.email && (
                <>
                  Resetting password for{" "}
                  <strong className="text-foreground">{tokenInfo.email}</strong>
                </>
              )}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <Alert variant="destructive" className="py-2">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription className="text-sm">
                    {error}
                  </AlertDescription>
                </Alert>
              )}

              {/* New Password */}
              <div className="space-y-2">
                <Label htmlFor="password">New Password</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="Min. 8 characters"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="new-password"
                    autoFocus
                    disabled={resetMutation.isPending}
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
                  disabled={resetMutation.isPending}
                />
              </div>

              <Button
                type="submit"
                className="w-full"
                size="lg"
                disabled={resetMutation.isPending}
              >
                {resetMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Resetting...
                  </>
                ) : (
                  "Reset Password"
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
