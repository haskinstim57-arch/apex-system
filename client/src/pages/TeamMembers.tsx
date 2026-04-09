import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Users, Building2 } from "lucide-react";
import { NoAccountSelected } from "@/components/NoAccountSelected";
import { useLocation } from "wouter";

const roleColors: Record<string, string> = {
  owner: "border-primary/30 text-primary bg-primary/10",
  manager: "border-blue-200 text-blue-600 bg-blue-500/10",
  employee: "border-muted-foreground/30 text-muted-foreground bg-muted",
};

export default function TeamMembers() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();

  const { data: accounts, isLoading } = trpc.accounts.list.useQuery();

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-48 bg-muted animate-pulse rounded" />
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 bg-muted animate-pulse rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  if (!accounts || accounts.length === 0) {
    return <NoAccountSelected />;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Team</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Your accounts and team members.
        </p>
      </div>

      <div className="space-y-6">
        {accounts.map((account) => (
          <AccountTeamSection
            key={account.id}
            accountId={account.id}
            accountName={account.name}
            onNavigate={() => setLocation(`/accounts/${account.id}`)}
          />
        ))}
      </div>
    </div>
  );
}

function AccountTeamSection({
  accountId,
  accountName,
  onNavigate,
}: {
  accountId: number;
  accountName: string;
  onNavigate: () => void;
}) {
  const { data: members } = trpc.members.list.useQuery({ accountId });

  return (
    <div className="space-y-3">
      <div
        className="flex items-center gap-2 cursor-pointer group"
        onClick={onNavigate}
      >
        <Building2 className="h-4 w-4 text-muted-foreground" />
        <h3 className="text-sm font-medium group-hover:text-primary transition-colors">
          {accountName}
        </h3>
        <Badge variant="outline" className="text-[10px] h-4 px-1.5">
          {members?.length ?? 0} members
        </Badge>
      </div>

      {members && members.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {members.map((member) => (
            <Card key={member.memberId} className="bg-card border-0 card-shadow">
              <CardContent className="py-3 px-4">
                <div className="flex items-center gap-3">
                  <Avatar className="h-8 w-8 border border-border/50">
                    <AvatarFallback className="text-xs font-semibold bg-primary/10 text-primary">
                      {member.userName?.charAt(0).toUpperCase() || "U"}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium truncate">
                        {member.userName || "Unknown"}
                      </p>
                      <Badge
                        variant="outline"
                        className={`text-[10px] h-4 px-1.5 shrink-0 ${roleColors[member.role] || ""}`}
                      >
                        {member.role}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground truncate">
                      {member.userEmail || "No email"}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground pl-6">
          No members in this account.
        </p>
      )}
    </div>
  );
}
