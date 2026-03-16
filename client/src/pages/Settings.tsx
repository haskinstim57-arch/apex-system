import { useAuth } from "@/_core/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import {
  Shield,
  User,
  Bell,
  Key,
  Palette,
  Facebook,
  ChevronRight,
} from "lucide-react";
import { useLocation } from "wouter";

function IntegrationLink({
  icon: Icon,
  label,
  description,
  href,
  iconColor = "text-muted-foreground",
}: {
  icon: React.ElementType;
  label: string;
  description: string;
  href: string;
  iconColor?: string;
}) {
  const [, setLocation] = useLocation();
  return (
    <button
      onClick={() => setLocation(href)}
      className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg hover:bg-accent transition-colors text-left group"
    >
      <div className="h-8 w-8 rounded-lg bg-muted flex items-center justify-center shrink-0">
        <Icon className={`h-4 w-4 ${iconColor}`} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium">{label}</p>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
    </button>
  );
}

export default function SettingsPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Manage your profile and account preferences.
        </p>
      </div>

      {/* Profile Section */}
      <Card className="border-border/50 bg-card">
        <CardHeader>
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <User className="h-4 w-4 text-muted-foreground" />
            Profile
          </CardTitle>
          <CardDescription className="text-xs">
            Your personal information and login details.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4">
            <Avatar className="h-16 w-16 border-2 border-border/50">
              <AvatarFallback className="text-lg font-semibold bg-primary/10 text-primary">
                {user?.name?.charAt(0).toUpperCase() || "U"}
              </AvatarFallback>
            </Avatar>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-medium">{user?.name || "User"}</h3>
                {isAdmin && (
                  <Badge
                    variant="outline"
                    className="text-[10px] px-1.5 h-4 border-primary/30 text-primary"
                  >
                    Admin
                  </Badge>
                )}
              </div>
              <p className="text-sm text-muted-foreground">{user?.email || "No email"}</p>
              <p className="text-xs text-muted-foreground mt-1">
                Member since{" "}
                {user?.createdAt
                  ? new Date(user.createdAt).toLocaleDateString("en-US", {
                      month: "long",
                      year: "numeric",
                    })
                  : "Unknown"}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Security Section */}
      <Card className="border-border/50 bg-card">
        <CardHeader>
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Shield className="h-4 w-4 text-muted-foreground" />
            Security
          </CardTitle>
          <CardDescription className="text-xs">
            Authentication and access control settings.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between py-2">
            <div>
              <p className="text-sm font-medium">Authentication Method</p>
              <p className="text-xs text-muted-foreground">
                {user?.loginMethod || "OAuth"} authentication
              </p>
            </div>
            <Badge variant="outline" className="text-xs">
              Active
            </Badge>
          </div>
          <Separator className="bg-border/50" />
          <div className="flex items-center justify-between py-2">
            <div>
              <p className="text-sm font-medium">Platform Role</p>
              <p className="text-xs text-muted-foreground">
                {isAdmin
                  ? "Full platform access as administrator"
                  : "Standard user access"}
              </p>
            </div>
            <Badge
              variant={isAdmin ? "default" : "secondary"}
              className="text-xs capitalize"
            >
              {user?.role || "user"}
            </Badge>
          </div>
          <Separator className="bg-border/50" />
          <div className="flex items-center justify-between py-2">
            <div>
              <p className="text-sm font-medium">Last Sign In</p>
              <p className="text-xs text-muted-foreground">
                {user?.lastSignedIn
                  ? new Date(user.lastSignedIn).toLocaleString()
                  : "Unknown"}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Admin Integrations */}
      {isAdmin && (
        <Card className="border-border/50 bg-card">
          <CardHeader>
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Palette className="h-4 w-4 text-muted-foreground" />
              Integrations
            </CardTitle>
            <CardDescription className="text-xs">
              Manage external service connections and integrations.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-1 -mt-2">
            <IntegrationLink
              icon={Facebook}
              label="Facebook Pages"
              description="Map Facebook pages to sub-accounts for lead routing"
              href="/settings/facebook-pages"
              iconColor="text-blue-500"
            />
          </CardContent>
        </Card>
      )}

      {/* Placeholder sections for future modules */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Card className="border-border/50 bg-card opacity-60">
          <CardContent className="pt-5 pb-4 px-5">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-lg bg-muted flex items-center justify-center">
                <Bell className="h-4 w-4 text-muted-foreground" />
              </div>
              <div>
                <p className="text-sm font-medium">Notifications</p>
                <p className="text-xs text-muted-foreground">Coming soon</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-border/50 bg-card opacity-60">
          <CardContent className="pt-5 pb-4 px-5">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-lg bg-muted flex items-center justify-center">
                <Key className="h-4 w-4 text-muted-foreground" />
              </div>
              <div>
                <p className="text-sm font-medium">API Keys</p>
                <p className="text-xs text-muted-foreground">Coming soon</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
