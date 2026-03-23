import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  ArrowLeft,
  Building2,
  Clock,
  Mail,
  MoreVertical,
  Phone,
  Shield,
  Trash2,
  UserMinus,
  UserPlus,
  Users,
} from "lucide-react";
import { useState } from "react";
import { useLocation } from "wouter";
import { toast } from "sonner";

const roleColors: Record<string, string> = {
  owner: "border-primary/30 text-primary bg-primary/10",
  manager: "border-blue-500/30 text-blue-400 bg-blue-500/10",
  employee: "border-muted-foreground/30 text-muted-foreground bg-muted",
};

export default function AccountDetail({ id }: { id: number }) {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"owner" | "manager" | "employee">("employee");
  const [inviteMessage, setInviteMessage] = useState("");
  const [removeUserId, setRemoveUserId] = useState<number | null>(null);

  const isAdmin = user?.role === "admin";

  const { data: account, isLoading: accountLoading } =
    trpc.accounts.get.useQuery({ id });
  const { data: members, isLoading: membersLoading } =
    trpc.members.list.useQuery({ accountId: id });
  const { data: pendingInvites } = trpc.invitations.list.useQuery({
    accountId: id,
  });

  const utils = trpc.useUtils();

  const inviteMutation = trpc.invitations.create.useMutation({
    onSuccess: (data) => {
      utils.invitations.list.invalidate({ accountId: id });
      setInviteOpen(false);
      setInviteEmail("");
      setInviteRole("employee");
      setInviteMessage("");
      toast.success("Invitation sent", {
        description: "An invitation email has been sent to the user.",
      });
    },
    onError: (err) => {
      toast.error("Failed to send invitation", { description: err.message });
    },
  });

  const updateRoleMutation = trpc.members.updateRole.useMutation({
    onSuccess: () => {
      utils.members.list.invalidate({ accountId: id });
      toast.success("Role updated");
    },
    onError: (err) => {
      toast.error("Failed to update role", { description: err.message });
    },
  });

  const removeMutation = trpc.members.remove.useMutation({
    onSuccess: () => {
      utils.members.list.invalidate({ accountId: id });
      utils.accounts.get.invalidate({ id });
      setRemoveUserId(null);
      toast.success("Member removed");
    },
    onError: (err) => {
      toast.error("Failed to remove member", { description: err.message });
    },
  });

  const revokeMutation = trpc.invitations.revoke.useMutation({
    onSuccess: () => {
      utils.invitations.list.invalidate({ accountId: id });
      toast.success("Invitation revoked");
    },
    onError: (err) => {
      toast.error("Failed to revoke invitation", { description: err.message });
    },
  });

  if (accountLoading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-48 bg-muted animate-pulse rounded" />
        <div className="h-32 bg-muted animate-pulse rounded-lg" />
      </div>
    );
  }

  if (!account) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] text-center">
        <Building2 className="h-12 w-12 text-muted-foreground/30 mb-4" />
        <h2 className="text-lg font-medium">Account not found</h2>
        <Button
          variant="outline"
          className="mt-4"
          onClick={() => setLocation("/accounts")}
        >
          Back to Accounts
        </Button>
      </div>
    );
  }

  const pendingCount =
    pendingInvites?.filter((i) => i.status === "pending").length ?? 0;

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={() => setLocation(isAdmin ? "/accounts" : "/")}
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold tracking-tight">
              {account.name}
            </h1>
            <Badge
              variant={account.status === "active" ? "default" : "secondary"}
              className="text-[10px] h-5"
            >
              {account.status}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-0.5 capitalize">
            {account.industry?.replace("_", " ") || "Mortgage"} &middot;
            Created{" "}
            {new Date(account.createdAt).toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
              year: "numeric",
            })}
          </p>
        </div>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card className="border-border/50 bg-card">
          <CardContent className="pt-4 pb-3 px-4">
            <p className="text-xs text-muted-foreground mb-1">Team Members</p>
            <p className="text-xl font-semibold">{account.members ?? 0}</p>
          </CardContent>
        </Card>
        <Card className="border-border/50 bg-card">
          <CardContent className="pt-4 pb-3 px-4">
            <p className="text-xs text-muted-foreground mb-1">
              Pending Invites
            </p>
            <p className="text-xl font-semibold">{pendingCount}</p>
          </CardContent>
        </Card>
        <Card className="border-border/50 bg-card">
          <CardContent className="pt-4 pb-3 px-4">
            <p className="text-xs text-muted-foreground mb-1">Contacts</p>
            <p className="text-xl font-semibold text-muted-foreground">--</p>
          </CardContent>
        </Card>
        <Card className="border-border/50 bg-card">
          <CardContent className="pt-4 pb-3 px-4">
            <p className="text-xs text-muted-foreground mb-1">Campaigns</p>
            <p className="text-xl font-semibold text-muted-foreground">--</p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="team" className="space-y-4">
        <TabsList className="bg-muted/50">
          <TabsTrigger value="team" className="gap-2 text-xs">
            <Users className="h-3.5 w-3.5" />
            Team ({members?.length ?? 0})
          </TabsTrigger>
          <TabsTrigger value="invitations" className="gap-2 text-xs">
            <Mail className="h-3.5 w-3.5" />
            Invitations ({pendingCount})
          </TabsTrigger>
          <TabsTrigger value="details" className="gap-2 text-xs">
            <Building2 className="h-3.5 w-3.5" />
            Details
          </TabsTrigger>
        </TabsList>

        {/* Team Tab */}
        <TabsContent value="team" className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              Manage team members and their roles.
            </p>
            <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
              <DialogTrigger asChild>
                <Button size="sm" className="gap-2">
                  <UserPlus className="h-3.5 w-3.5" />
                  Invite Member
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle>Invite Team Member</DialogTitle>
                  <DialogDescription>
                    Send an invitation to join {account.name}.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-2">
                  <div className="space-y-2">
                    <Label>Email Address</Label>
                    <Input
                      type="email"
                      placeholder="colleague@example.com"
                      value={inviteEmail}
                      onChange={(e) => setInviteEmail(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Role</Label>
                    <Select
                      value={inviteRole}
                      onValueChange={(v) =>
                        setInviteRole(v as "owner" | "manager" | "employee")
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="owner">Owner</SelectItem>
                        <SelectItem value="manager">Manager</SelectItem>
                        <SelectItem value="employee">Employee</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      {inviteRole === "owner" &&
                        "Full control over the account."}
                      {inviteRole === "manager" &&
                        "Can manage contacts, campaigns, and employees."}
                      {inviteRole === "employee" &&
                        "Restricted access within the account."}
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label>Personal Message (optional)</Label>
                    <Input
                      placeholder="Welcome to the team!"
                      value={inviteMessage}
                      onChange={(e) => setInviteMessage(e.target.value)}
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button
                    variant="outline"
                    onClick={() => setInviteOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={() => {
                      inviteMutation.mutate({
                        accountId: id,
                        email: inviteEmail,
                        role: inviteRole,
                        message: inviteMessage || undefined,
                      });
                    }}
                    disabled={!inviteEmail.trim() || inviteMutation.isPending}
                  >
                    {inviteMutation.isPending
                      ? "Sending..."
                      : "Send Invitation"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>

          {membersLoading ? (
            <div className="space-y-3">
              {[1, 2].map((i) => (
                <div
                  key={i}
                  className="h-16 bg-muted animate-pulse rounded-lg"
                />
              ))}
            </div>
          ) : members && members.length > 0 ? (
            <div className="space-y-2">
              {members.map((member) => (
                <Card
                  key={member.memberId}
                  className="border-border/50 bg-card"
                >
                  <CardContent className="py-3 px-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Avatar className="h-9 w-9 border border-border/50">
                          <AvatarFallback className="text-xs font-semibold bg-primary/10 text-primary">
                            {member.userName?.charAt(0).toUpperCase() || "U"}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-medium">
                              {member.userName || "Unknown"}
                            </p>
                            <Badge
                              variant="outline"
                              className={`text-[10px] h-4 px-1.5 ${roleColors[member.role] || ""}`}
                            >
                              {member.role}
                            </Badge>
                            {!member.isActive && (
                              <Badge
                                variant="outline"
                                className="text-[10px] h-4 px-1.5 border-destructive/30 text-destructive"
                              >
                                Inactive
                              </Badge>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {member.userEmail || "No email"}
                          </p>
                        </div>
                      </div>

                      {member.userId !== user?.id && (isAdmin || true) && (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                            >
                              <MoreVertical className="h-3.5 w-3.5" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              onClick={() =>
                                updateRoleMutation.mutate({
                                  accountId: id,
                                  userId: member.userId,
                                  role: "owner",
                                })
                              }
                            >
                              <Shield className="mr-2 h-3.5 w-3.5" />
                              Make Owner
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() =>
                                updateRoleMutation.mutate({
                                  accountId: id,
                                  userId: member.userId,
                                  role: "manager",
                                })
                              }
                            >
                              <Shield className="mr-2 h-3.5 w-3.5" />
                              Make Manager
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() =>
                                updateRoleMutation.mutate({
                                  accountId: id,
                                  userId: member.userId,
                                  role: "employee",
                                })
                              }
                            >
                              <Shield className="mr-2 h-3.5 w-3.5" />
                              Make Employee
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              className="text-destructive focus:text-destructive"
                              onClick={() =>
                                setRemoveUserId(member.userId)
                              }
                            >
                              <UserMinus className="mr-2 h-3.5 w-3.5" />
                              Remove
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <Users className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">
                No team members yet. Send an invitation to get started.
              </p>
            </div>
          )}
        </TabsContent>

        {/* Invitations Tab */}
        <TabsContent value="invitations" className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Track and manage pending invitations.
          </p>

          {pendingInvites && pendingInvites.length > 0 ? (
            <div className="space-y-2">
              {pendingInvites.map((invite) => (
                <Card
                  key={invite.id}
                  className="border-border/50 bg-card"
                >
                  <CardContent className="py-3 px-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="h-9 w-9 rounded-lg bg-muted flex items-center justify-center">
                          <Mail className="h-4 w-4 text-muted-foreground" />
                        </div>
                        <div>
                          <p className="text-sm font-medium">{invite.email}</p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <Badge
                              variant="outline"
                              className={`text-[10px] h-4 px-1.5 ${roleColors[invite.role] || ""}`}
                            >
                              {invite.role}
                            </Badge>
                            <Badge
                              variant={
                                invite.status === "pending"
                                  ? "outline"
                                  : invite.status === "accepted"
                                    ? "default"
                                    : "secondary"
                              }
                              className="text-[10px] h-4 px-1.5"
                            >
                              {invite.status}
                            </Badge>
                            <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              Expires{" "}
                              {new Date(invite.expiresAt).toLocaleDateString()}
                            </span>
                          </div>
                        </div>
                      </div>

                      {invite.status === "pending" && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-destructive hover:text-destructive h-7 text-xs"
                          onClick={() =>
                            revokeMutation.mutate({
                              accountId: id,
                              invitationId: invite.id,
                            })
                          }
                        >
                          Revoke
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <Mail className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">
                No invitations sent yet.
              </p>
            </div>
          )}
        </TabsContent>

        {/* Details Tab */}
        <TabsContent value="details" className="space-y-4">
          <Card className="border-border/50 bg-card">
            <CardHeader>
              <CardTitle className="text-sm font-medium">
                Account Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-muted-foreground mb-1">
                    Account Name
                  </p>
                  <p className="text-sm font-medium">{account.name}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Industry</p>
                  <p className="text-sm font-medium capitalize">
                    {account.industry?.replace("_", " ") || "Mortgage"}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Email</p>
                  <p className="text-sm">{account.email || "Not set"}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Phone</p>
                  <p className="text-sm">{account.phone || "Not set"}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Website</p>
                  <p className="text-sm">{account.website || "Not set"}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Status</p>
                  <Badge
                    variant={
                      account.status === "active" ? "default" : "secondary"
                    }
                  >
                    {account.status}
                  </Badge>
                </div>
              </div>
              {account.address && (
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Address</p>
                  <p className="text-sm">{account.address}</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Remove Member Confirmation */}
      <AlertDialog
        open={removeUserId !== null}
        onOpenChange={(open) => !open && setRemoveUserId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Team Member</AlertDialogTitle>
            <AlertDialogDescription>
              This member will lose access to this account immediately. They can
              be re-invited later.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (removeUserId)
                  removeMutation.mutate({
                    accountId: id,
                    userId: removeUserId,
                  });
              }}
            >
              Remove Member
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
