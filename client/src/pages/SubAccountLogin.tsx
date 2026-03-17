import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Zap, Loader2, AlertCircle, ArrowLeft, Building2, ChevronRight } from "lucide-react";
import { getLoginUrl } from "@/const";

/** Must match the key in AccountContext.tsx */
const SELECTED_ACCOUNT_KEY = "apex-selected-account";

type Membership = {
  accountId: number;
  accountName: string;
  accountSlug: string | null;
  memberRole: "owner" | "manager" | "employee";
};

export default function SubAccountLogin() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [memberships, setMemberships] = useState<Membership[] | null>(null);

  const loginMutation = trpc.subAccountAuth.login.useMutation({
    onSuccess: (data) => {
      if (data.memberships.length === 1) {
        // Single account — store accountId and redirect immediately
        localStorage.setItem(SELECTED_ACCOUNT_KEY, data.memberships[0].accountId.toString());
        window.location.href = "/";
      } else {
        // Multiple accounts — show account selection screen
        setMemberships(data.memberships);
      }
    },
    onError: (err) => {
      setError(err.message || "Invalid email or password");
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!email.trim() || !password.trim()) {
      setError("Please enter both email and password");
      return;
    }

    loginMutation.mutate({ email, password });
  };

  const handleAccountSelect = (membership: Membership) => {
    localStorage.setItem(SELECTED_ACCOUNT_KEY, membership.accountId.toString());
    window.location.href = "/";
  };

  // ─── Account Selection Screen ───
  if (memberships && memberships.length > 1) {
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
              <CardTitle className="text-xl">Select Account</CardTitle>
              <CardDescription>
                You have access to multiple accounts. Choose one to continue.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {memberships.map((m) => (
                <button
                  key={m.accountId}
                  onClick={() => handleAccountSelect(m)}
                  className="w-full flex items-center gap-3 p-3 rounded-lg border border-border/50 hover:bg-accent hover:border-accent transition-colors text-left group"
                >
                  <div className="h-10 w-10 rounded-md bg-muted flex items-center justify-center shrink-0">
                    <Building2 className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{m.accountName}</p>
                    <p className="text-xs text-muted-foreground capitalize">{m.memberRole}</p>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors shrink-0" />
                </button>
              ))}

              <div className="pt-3 mt-2 border-t border-border/50">
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full text-muted-foreground hover:text-foreground"
                  onClick={() => {
                    setMemberships(null);
                    setEmail("");
                    setPassword("");
                  }}
                >
                  <ArrowLeft className="h-3.5 w-3.5 mr-2" />
                  Sign in with a different account
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // ─── Login Form ───
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
            <CardTitle className="text-xl">Sub-Account Login</CardTitle>
            <CardDescription>
              Sign in with your email and password to access your account.
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

              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                  autoFocus
                  disabled={loginMutation.isPending}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  disabled={loginMutation.isPending}
                />
              </div>

              <Button
                type="submit"
                className="w-full"
                size="lg"
                disabled={loginMutation.isPending}
              >
                {loginMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Signing in...
                  </>
                ) : (
                  "Sign In"
                )}
              </Button>
            </form>

            <div className="mt-6 pt-4 border-t border-border/50">
              <p className="text-xs text-muted-foreground text-center mb-3">
                Agency administrators can sign in with their main account.
              </p>
              <Button
                variant="ghost"
                size="sm"
                className="w-full text-muted-foreground hover:text-foreground"
                onClick={() => {
                  window.location.href = getLoginUrl();
                }}
              >
                <ArrowLeft className="h-3.5 w-3.5 mr-2" />
                Admin Sign In
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
