import { useState } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { useAccount } from "@/contexts/AccountContext";
import { NoAccountSelected } from "@/components/NoAccountSelected";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Users,
  UserPlus,
  MoreHorizontal,
  Shield,
  ShieldCheck,
  UserX,
  UserCheck,
  Loader2,
  Mail,
  Phone,
  Clock,
} from "lucide-react";
import { toast } from "sonner";

const roleColors: Record<string, string> = {
  owner: "border-primary/30 text-primary bg-primary/10",
  manager: "border-blue-200 text-blue-600 bg-blue-500/10",
  employee: "border-muted-foreground/30 text-muted-foreground bg-muted",
};

const roleIcons: Record<string, typeof Shield> = {
  owner: ShieldCheck,
  manager: Shield,
  employee: Users,
};

export default function SubAccountTeamMembers() {
  const { user } = useAuth();
  const { currentAccountId: accountId, isLoading: accountsLoading } = useAccount();
  const utils = trpc.useUtils();

  // Invite dialog
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"owner" | "manager" | "employee">("employee");
  const [inviteMessage, setInviteMessage] = useState("");

  // Role change dialog
  const [roleChangeOpen, setRoleChangeOpen] = useState(false);
  const [roleChangeMember, setRoleChangeMember] = useState<any>(null);
  const [newRole, setNewRole] = useState<"owner" | "manager" | "employee">("employee");

  // Current user's membership
  const { data: myMembership } = trpc.members.myMembership.useQuery(
    { accountId: accountId! },
    { enabled: !!accountId }
  );

  // Members list
  const { data: members, isLoading: membersLoading } = trpc.members.list.useQuery(
    { accountId: accountId! },
    { enabled: !!accountId }
  );

  // Pending invitations
  const { data: invitations } = trpc.invitations.list.useQuery(
    { accountId: accountId! },
    { enabled: !!accountId }
  );

  const pendingInvitations = invitations?.filter(
    (inv: any) => inv.status === "pending"
  ) || [];

  // Can the current user manage members?
  const canManage =
    user?.role === "admin" ||
    myMembership?.role === "owner" ||
    myMembership?.role === "manager";

  // Mutations
  const inviteMutation = trpc.invitations.create.useMutation({
    onSuccess: () => {
      toast.success("Invitation sent!");
      setInviteOpen(false);
      setInviteEmail("");
      setInviteRole("employee");
      setInviteMessage("");
      utils.invitations.list.invalidate({ accountId: accountId! });
    },
    onError: (err) => toast.error(err.message),
  });

  const updateRoleMutation = trpc.members.updateRole.useMutation({
    onSuccess: () => {
      toast.success("Role updated");
      setRoleChangeOpen(false);
      utils.members.list.invalidate({ accountId: accountId! });
    },
    onError: (err) => toast.error(err.message),
  });

  const toggleStatusMutation = trpc.members.toggleStatus.useMutation({
    onSuccess: (_, vars) => {
      toast.success(vars.isActive ? "Member activated" : "Member deactivated");
      utils.members.list.invalidate({ accountId: accountId! });
    },
    onError: (err) => toast.error(err.message),
  });

  const removeMutation = trpc.members.remove.useMutation({
    onSuccess: () => {
      toast.success("Member removed");
      utils.members.list.invalidate({ accountId: accountId! });
    },
    onError: (err) => toast.error(err.message),
  });

  const revokeInviteMutation = trpc.invitations.revoke.useMutation({
    onSuccess: () => {
      toast.success("Invitation revoked");
      utils.invitations.list.invalidate({ accountId: accountId! });
    },
    onError: (err) => toast.error(err.message),
  });

  if (!accountId) return <NoAccountSelected />;

  if (membersLoading || accountsLoading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-48 bg-muted animate-pulse rounded" />
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-20 bg-muted animate-pulse rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Team Members</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Manage your team and invite new members.
          </p>
        </div>
        {canManage && (
          <Button size="sm" className="gap-1.5" onClick={() => setInviteOpen(true)}>
            <UserPlus className="h-3.5 w-3.5" />
            Invite Member
          </Button>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="bg-card border-0 card-shadow">
          <CardContent className="pt-4 pb-3">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Total</p>
            <p className="text-xl font-semibold mt-0.5">{members?.length || 0}</p>
          </CardContent>
        </Card>
        <Card className="bg-card border-0 card-shadow">
          <CardContent className="pt-4 pb-3">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Active</p>
            <p className="text-xl font-semibold mt-0.5 text-emerald-600">
              {members?.filter((m: any) => m.isActive).length || 0}
            </p>
          </CardContent>
        </Card>
        <Card className="bg-card border-0 card-shadow">
          <CardContent className="pt-4 pb-3">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Owners</p>
            <p className="text-xl font-semibold mt-0.5 text-primary">
              {members?.filter((m: any) => m.role === "owner").length || 0}
            </p>
          </CardContent>
        </Card>
        <Card className="bg-card border-0 card-shadow">
          <CardContent className="pt-4 pb-3">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Pending Invites</p>
            <p className="text-xl font-semibold mt-0.5 text-amber-600">
              {pendingInvitations.length}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Members List */}
      <Card className="bg-card border-0 card-shadow">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Users className="h-4 w-4 text-muted-foreground" />
            Members ({members?.length || 0})
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {members && members.length > 0 ? (
            members.map((member: any) => {
              const RoleIcon = roleIcons[member.role] || Users;
              const isCurrentUser = member.userId === user?.id;
              return (
                <div
                  key={member.memberId}
                  className={`flex items-center gap-3 p-3 rounded-lg border border-border/30 transition-colors ${
                    !member.isActive ? "opacity-50" : "hover:bg-muted/30"
                  }`}
                >
                  <Avatar className="h-10 w-10 border border-border/50">
                    <AvatarFallback className="text-sm font-semibold bg-primary/10 text-primary">
                      {member.userName?.charAt(0).toUpperCase() || "U"}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium truncate">
                        {member.userName || "Unknown"}
                        {isCurrentUser && (
                          <span className="text-xs text-muted-foreground ml-1">(you)</span>
                        )}
                      </p>
                      <Badge
                        variant="outline"
                        className={`text-[10px] h-4 px-1.5 shrink-0 ${roleColors[member.role] || ""}`}
                      >
                        <RoleIcon className="h-2.5 w-2.5 mr-0.5" />
                        {member.role}
                      </Badge>
                      {!member.isActive && (
                        <Badge variant="outline" className="text-[10px] h-4 px-1.5 text-red-500 border-red-200">
                          Inactive
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-3 mt-0.5">
                      {member.userEmail && (
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <Mail className="h-3 w-3" />
                          {member.userEmail}
                        </span>
                      )}
                      {member.userPhone && (
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <Phone className="h-3 w-3" />
                          {member.userPhone}
                        </span>
                      )}
                    </div>
                  </div>
                  {canManage && !isCurrentUser && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onClick={() => {
                            setRoleChangeMember(member);
                            setNewRole(member.role);
                            setRoleChangeOpen(true);
                          }}
                        >
                          <Shield className="h-3.5 w-3.5 mr-2" />
                          Change Role
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() =>
                            toggleStatusMutation.mutate({
                              accountId: accountId!,
                              userId: member.userId,
                              isActive: !member.isActive,
                            })
                          }
                        >
                          {member.isActive ? (
                            <>
                              <UserX className="h-3.5 w-3.5 mr-2" />
                              Deactivate
                            </>
                          ) : (
                            <>
                              <UserCheck className="h-3.5 w-3.5 mr-2" />
                              Activate
                            </>
                          )}
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          className="text-destructive"
                          onClick={() => {
                            if (confirm(`Remove ${member.userName || "this member"} from the team?`)) {
                              removeMutation.mutate({
                                accountId: accountId!,
                                userId: member.userId,
                              });
                            }
                          }}
                        >
                          <UserX className="h-3.5 w-3.5 mr-2" />
                          Remove
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </div>
              );
            })
          ) : (
            <p className="text-sm text-muted-foreground text-center py-6">
              No team members yet. Invite someone to get started.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Pending Invitations */}
      {pendingInvitations.length > 0 && (
        <Card className="bg-card border-0 card-shadow">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Clock className="h-4 w-4 text-amber-500" />
              Pending Invitations ({pendingInvitations.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {pendingInvitations.map((inv: any) => (
              <div
                key={inv.id}
                className="flex items-center justify-between p-3 rounded-lg border border-border/30"
              >
                <div>
                  <p className="text-sm font-medium">{inv.email}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <Badge variant="outline" className={`text-[10px] h-4 px-1.5 ${roleColors[inv.role] || ""}`}>
                      {inv.role}
                    </Badge>
                    <span className="text-[10px] text-muted-foreground">
                      Sent {new Date(inv.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                </div>
                {canManage && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-destructive text-xs"
                    onClick={() => revokeInviteMutation.mutate({ accountId: accountId!, invitationId: inv.id })}
                  >
                    Revoke
                  </Button>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Invite Dialog */}
      <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Invite Team Member</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Email Address</label>
              <Input
                placeholder="colleague@example.com"
                type="email"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Role</label>
              <Select value={inviteRole} onValueChange={(v: any) => setInviteRole(v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="employee">Employee</SelectItem>
                  <SelectItem value="manager">Manager</SelectItem>
                  <SelectItem value="owner">Owner</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-[10px] text-muted-foreground">
                {inviteRole === "owner"
                  ? "Full access to all account features and team management."
                  : inviteRole === "manager"
                  ? "Can manage team members and access all CRM features."
                  : "Standard access to CRM features within this account."}
              </p>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Message (optional)</label>
              <Input
                placeholder="Welcome to the team!"
                value={inviteMessage}
                onChange={(e) => setInviteMessage(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setInviteOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (!inviteEmail) return;
                inviteMutation.mutate({
                  accountId: accountId!,
                  email: inviteEmail,
                  role: inviteRole,
                  message: inviteMessage || undefined,
                });
              }}
              disabled={!inviteEmail || inviteMutation.isPending}
            >
              {inviteMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Mail className="h-4 w-4 mr-2" />
              )}
              Send Invitation
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Role Change Dialog */}
      <Dialog open={roleChangeOpen} onOpenChange={setRoleChangeOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Change Role</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-sm text-muted-foreground">
              Change role for <strong>{roleChangeMember?.userName || "this member"}</strong>
            </p>
            <Select value={newRole} onValueChange={(v: any) => setNewRole(v)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="employee">Employee</SelectItem>
                <SelectItem value="manager">Manager</SelectItem>
                <SelectItem value="owner">Owner</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRoleChangeOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (!roleChangeMember) return;
                updateRoleMutation.mutate({
                  accountId: accountId!,
                  userId: roleChangeMember.userId,
                  role: newRole,
                });
              }}
              disabled={updateRoleMutation.isPending}
            >
              {updateRoleMutation.isPending && (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              )}
              Update Role
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
