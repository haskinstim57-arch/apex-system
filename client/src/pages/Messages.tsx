import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ChevronLeft,
  ChevronRight,
  Filter,
  Loader2,
  Mail,
  MessageSquare,
  MoreHorizontal,
  Plus,
  Search,
  Send,
  Trash2,
  Eye,
  Phone,
  ArrowUpRight,
  ArrowDownLeft,
  X,
} from "lucide-react";
import { useMemo, useState } from "react";
import { useLocation } from "wouter";
import { toast } from "sonner";

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-amber-500/15 text-amber-400 border-amber-500/30",
  sent: "bg-blue-500/15 text-blue-400 border-blue-500/30",
  delivered: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  failed: "bg-red-500/15 text-red-400 border-red-500/30",
  bounced: "bg-orange-500/15 text-orange-400 border-orange-500/30",
};

export default function Messages() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const utils = trpc.useUtils();

  // Account selection
  const { data: userAccounts, isLoading: accountsLoading } =
    trpc.accounts.list.useQuery();
  const [selectedAccountId, setSelectedAccountId] = useState<number | null>(
    null
  );

  const accountId = useMemo(() => {
    if (selectedAccountId) return selectedAccountId;
    if (userAccounts && userAccounts.length > 0) return userAccounts[0].id;
    return null;
  }, [selectedAccountId, userAccounts]);

  // Filters
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("");
  const [directionFilter, setDirectionFilter] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [showFilters, setShowFilters] = useState(false);
  const [page, setPage] = useState(0);
  const pageSize = 25;
  const [activeTab, setActiveTab] = useState("all");

  // Messages query
  const { data: messagesData, isLoading: messagesLoading } =
    trpc.messages.list.useQuery(
      {
        accountId: accountId!,
        search: search || undefined,
        type: (typeFilter as "email" | "sms") || undefined,
        direction:
          activeTab === "sent"
            ? "outbound"
            : activeTab === "received"
              ? "inbound"
              : (directionFilter as "outbound" | "inbound") || undefined,
        status:
          (statusFilter as
            | "pending"
            | "sent"
            | "delivered"
            | "failed"
            | "bounced") || undefined,
        limit: pageSize,
        offset: page * pageSize,
      },
      { enabled: !!accountId }
    );

  // Stats
  const { data: stats } = trpc.messages.stats.useQuery(
    { accountId: accountId! },
    { enabled: !!accountId }
  );

  // Contacts for compose dialog
  const { data: contactsData } = trpc.contacts.list.useQuery(
    { accountId: accountId!, limit: 100 },
    { enabled: !!accountId }
  );

  // Compose dialog state
  const [composeOpen, setComposeOpen] = useState(false);
  const [composeType, setComposeType] = useState<"email" | "sms">("email");
  const [composeContactId, setComposeContactId] = useState<string>("");
  const [composeSubject, setComposeSubject] = useState("");
  const [composeBody, setComposeBody] = useState("");
  const [composeToAddress, setComposeToAddress] = useState("");

  // View message dialog
  const [viewMessage, setViewMessage] = useState<any>(null);

  // Send mutation
  const sendMutation = trpc.messages.send.useMutation({
    onSuccess: () => {
      toast.success("Message sent successfully");
      utils.messages.list.invalidate();
      utils.messages.stats.invalidate();
      resetCompose();
    },
    onError: (err) => {
      toast.error(err.message || "Failed to send message");
    },
  });

  // Delete mutation
  const deleteMutation = trpc.messages.delete.useMutation({
    onSuccess: () => {
      toast.success("Message deleted");
      utils.messages.list.invalidate();
      utils.messages.stats.invalidate();
    },
    onError: (err) => {
      toast.error(err.message || "Failed to delete message");
    },
  });

  function resetCompose() {
    setComposeOpen(false);
    setComposeType("email");
    setComposeContactId("");
    setComposeSubject("");
    setComposeBody("");
    setComposeToAddress("");
  }

  function handleSend() {
    if (!accountId || !composeContactId || !composeBody || !composeToAddress) {
      toast.error("Please fill in all required fields");
      return;
    }
    sendMutation.mutate({
      accountId,
      contactId: parseInt(composeContactId),
      type: composeType,
      subject: composeType === "email" ? composeSubject : undefined,
      body: composeBody,
      toAddress: composeToAddress,
    });
  }

  // When contact is selected, auto-fill the toAddress
  function handleContactSelect(contactIdStr: string) {
    setComposeContactId(contactIdStr);
    const contact = contactsData?.data?.find(
      (c: any) => c.id === parseInt(contactIdStr)
    );
    if (contact) {
      if (composeType === "email" && contact.email) {
        setComposeToAddress(contact.email);
      } else if (composeType === "sms" && contact.phone) {
        setComposeToAddress(contact.phone);
      }
    }
  }

  // When type changes, update toAddress from selected contact
  function handleTypeChange(type: "email" | "sms") {
    setComposeType(type);
    if (composeContactId) {
      const contact = contactsData?.data?.find(
        (c: any) => c.id === parseInt(composeContactId)
      );
      if (contact) {
        if (type === "email" && contact.email) {
          setComposeToAddress(contact.email);
        } else if (type === "sms" && contact.phone) {
          setComposeToAddress(contact.phone);
        }
      }
    }
  }

  const totalMessages = messagesData?.total ?? 0;
  const totalPages = Math.ceil(totalMessages / pageSize);
  const messagesList = messagesData?.messages ?? [];

  if (accountsLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Messages</h1>
          <p className="text-sm text-muted-foreground">
            {totalMessages} message{totalMessages !== 1 ? "s" : ""} in this
            account
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* Account selector */}
          {userAccounts && userAccounts.length > 1 && (
            <Select
              value={accountId?.toString() || ""}
              onValueChange={(v) => {
                setSelectedAccountId(parseInt(v));
                setPage(0);
              }}
            >
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Select account" />
              </SelectTrigger>
              <SelectContent>
                {userAccounts.map((acc: any) => (
                  <SelectItem key={acc.id} value={acc.id.toString()}>
                    {acc.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <Button
            onClick={() => setComposeOpen(true)}
            disabled={!accountId}
            className="bg-amber-600 hover:bg-amber-700 text-white"
          >
            <Plus className="h-4 w-4 mr-2" />
            Compose
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="bg-card/50 border-border/50">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-blue-500/10">
                  <Send className="h-4 w-4 text-blue-400" />
                </div>
                <div>
                  <p className="text-2xl font-semibold">{stats.total}</p>
                  <p className="text-xs text-muted-foreground">Total</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-card/50 border-border/50">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-emerald-500/10">
                  <Mail className="h-4 w-4 text-emerald-400" />
                </div>
                <div>
                  <p className="text-2xl font-semibold">{stats.emails}</p>
                  <p className="text-xs text-muted-foreground">Emails</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-card/50 border-border/50">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-purple-500/10">
                  <Phone className="h-4 w-4 text-purple-400" />
                </div>
                <div>
                  <p className="text-2xl font-semibold">{stats.sms}</p>
                  <p className="text-xs text-muted-foreground">SMS</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-card/50 border-border/50">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-red-500/10">
                  <MessageSquare className="h-4 w-4 text-red-400" />
                </div>
                <div>
                  <p className="text-2xl font-semibold">{stats.failed}</p>
                  <p className="text-xs text-muted-foreground">Failed</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Tabs + Search + Filters */}
      <Tabs
        value={activeTab}
        onValueChange={(v) => {
          setActiveTab(v);
          setPage(0);
        }}
      >
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <TabsList className="bg-muted/50">
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="sent">Sent</TabsTrigger>
            <TabsTrigger value="received">Received</TabsTrigger>
          </TabsList>

          <div className="flex items-center gap-2 flex-1 max-w-md">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search messages..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(0);
                }}
                className="pl-9"
              />
            </div>
            <Button
              variant="outline"
              size="icon"
              onClick={() => setShowFilters(!showFilters)}
              className={showFilters ? "bg-accent" : ""}
            >
              <Filter className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Filter bar */}
        {showFilters && (
          <div className="flex items-center gap-3 mt-3 flex-wrap">
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all_types">All Types</SelectItem>
                <SelectItem value="email">Email</SelectItem>
                <SelectItem value="sms">SMS</SelectItem>
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all_statuses">All Statuses</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="sent">Sent</SelectItem>
                <SelectItem value="delivered">Delivered</SelectItem>
                <SelectItem value="failed">Failed</SelectItem>
                <SelectItem value="bounced">Bounced</SelectItem>
              </SelectContent>
            </Select>
            {activeTab === "all" && (
              <Select value={directionFilter} onValueChange={setDirectionFilter}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="Direction" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all_directions">All</SelectItem>
                  <SelectItem value="outbound">Outbound</SelectItem>
                  <SelectItem value="inbound">Inbound</SelectItem>
                </SelectContent>
              </Select>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setTypeFilter("");
                setStatusFilter("");
                setDirectionFilter("");
              }}
            >
              <X className="h-3 w-3 mr-1" />
              Clear
            </Button>
          </div>
        )}

        {/* Messages Table */}
        <TabsContent value={activeTab} className="mt-4">
          <Card className="border-border/50">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent border-border/50">
                  <TableHead className="w-[40px]"></TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>To / From</TableHead>
                  <TableHead>Subject / Preview</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {messagesLoading ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-12">
                      <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
                    </TableCell>
                  </TableRow>
                ) : messagesList.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={7}
                      className="text-center py-12 text-muted-foreground"
                    >
                      <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      <p>No messages yet. Send your first message to get started.</p>
                    </TableCell>
                  </TableRow>
                ) : (
                  messagesList.map((msg: any) => (
                    <TableRow
                      key={msg.id}
                      className="cursor-pointer hover:bg-muted/30 border-border/30"
                      onClick={() => setViewMessage(msg)}
                    >
                      <TableCell>
                        {msg.direction === "outbound" ? (
                          <ArrowUpRight className="h-4 w-4 text-blue-400" />
                        ) : (
                          <ArrowDownLeft className="h-4 w-4 text-emerald-400" />
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={
                            msg.type === "email"
                              ? "bg-blue-500/10 text-blue-400 border-blue-500/30"
                              : "bg-purple-500/10 text-purple-400 border-purple-500/30"
                          }
                        >
                          {msg.type === "email" ? (
                            <Mail className="h-3 w-3 mr-1" />
                          ) : (
                            <Phone className="h-3 w-3 mr-1" />
                          )}
                          {msg.type.toUpperCase()}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-medium max-w-[180px] truncate">
                        {msg.direction === "outbound"
                          ? msg.toAddress
                          : msg.fromAddress || "Unknown"}
                      </TableCell>
                      <TableCell className="max-w-[300px] truncate text-muted-foreground">
                        {msg.subject ? (
                          <span>
                            <span className="text-foreground font-medium">
                              {msg.subject}
                            </span>
                            {" — "}
                            {msg.body.substring(0, 80)}
                          </span>
                        ) : (
                          msg.body.substring(0, 120)
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={STATUS_COLORS[msg.status] || ""}
                        >
                          {msg.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {new Date(msg.createdAt).toLocaleDateString(undefined, {
                          month: "short",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              onClick={(e) => {
                                e.stopPropagation();
                                setViewMessage(msg);
                              }}
                            >
                              <Eye className="h-4 w-4 mr-2" />
                              View
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              className="text-red-400"
                              onClick={(e) => {
                                e.stopPropagation();
                                if (
                                  confirm(
                                    "Are you sure you want to delete this message?"
                                  )
                                ) {
                                  deleteMutation.mutate({
                                    id: msg.id,
                                    accountId: accountId!,
                                  });
                                }
                              }}
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </Card>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-4">
              <p className="text-sm text-muted-foreground">
                Showing {page * pageSize + 1}–
                {Math.min((page + 1) * pageSize, totalMessages)} of{" "}
                {totalMessages}
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page === 0}
                  onClick={() => setPage(page - 1)}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-sm text-muted-foreground">
                  Page {page + 1} of {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= totalPages - 1}
                  onClick={() => setPage(page + 1)}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* ─── Compose Dialog ─── */}
      <Dialog open={composeOpen} onOpenChange={setComposeOpen}>
        <DialogContent className="sm:max-w-[550px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Send className="h-5 w-5 text-amber-500" />
              Compose Message
            </DialogTitle>
            <DialogDescription>
              Send an email or SMS to a contact.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Message Type */}
            <div className="flex gap-2">
              <Button
                type="button"
                variant={composeType === "email" ? "default" : "outline"}
                size="sm"
                onClick={() => handleTypeChange("email")}
                className={
                  composeType === "email"
                    ? "bg-amber-600 hover:bg-amber-700 text-white"
                    : ""
                }
              >
                <Mail className="h-4 w-4 mr-1" />
                Email
              </Button>
              <Button
                type="button"
                variant={composeType === "sms" ? "default" : "outline"}
                size="sm"
                onClick={() => handleTypeChange("sms")}
                className={
                  composeType === "sms"
                    ? "bg-amber-600 hover:bg-amber-700 text-white"
                    : ""
                }
              >
                <Phone className="h-4 w-4 mr-1" />
                SMS
              </Button>
            </div>

            {/* Contact selector */}
            <div className="space-y-2">
              <Label>Contact *</Label>
              <Select
                value={composeContactId}
                onValueChange={handleContactSelect}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a contact" />
                </SelectTrigger>
                <SelectContent>
                  {contactsData?.data?.map((c: any) => (
                    <SelectItem key={c.id} value={c.id.toString()}>
                      {c.firstName} {c.lastName}
                      {c.email ? ` — ${c.email}` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* To Address */}
            <div className="space-y-2">
              <Label>
                {composeType === "email" ? "To (Email)" : "To (Phone)"} *
              </Label>
              <Input
                value={composeToAddress}
                onChange={(e) => setComposeToAddress(e.target.value)}
                placeholder={
                  composeType === "email"
                    ? "recipient@example.com"
                    : "+1234567890"
                }
              />
            </div>

            {/* Subject (email only) */}
            {composeType === "email" && (
              <div className="space-y-2">
                <Label>Subject *</Label>
                <Input
                  value={composeSubject}
                  onChange={(e) => setComposeSubject(e.target.value)}
                  placeholder="Email subject"
                />
              </div>
            )}

            {/* Body */}
            <div className="space-y-2">
              <Label>Message *</Label>
              <Textarea
                value={composeBody}
                onChange={(e) => setComposeBody(e.target.value)}
                placeholder={
                  composeType === "email"
                    ? "Write your email message..."
                    : "Write your SMS message..."
                }
                rows={composeType === "email" ? 8 : 4}
                className="resize-none"
              />
              {composeType === "sms" && (
                <p className="text-xs text-muted-foreground">
                  {composeBody.length}/160 characters
                </p>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={resetCompose}>
              Cancel
            </Button>
            <Button
              onClick={handleSend}
              disabled={sendMutation.isPending}
              className="bg-amber-600 hover:bg-amber-700 text-white"
            >
              {sendMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Send className="h-4 w-4 mr-2" />
              )}
              Send {composeType === "email" ? "Email" : "SMS"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── View Message Dialog ─── */}
      <Dialog
        open={!!viewMessage}
        onOpenChange={() => setViewMessage(null)}
      >
        <DialogContent className="sm:max-w-[600px]">
          {viewMessage && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  {viewMessage.type === "email" ? (
                    <Mail className="h-5 w-5 text-blue-400" />
                  ) : (
                    <Phone className="h-5 w-5 text-purple-400" />
                  )}
                  {viewMessage.subject || `${viewMessage.type.toUpperCase()} Message`}
                </DialogTitle>
                <DialogDescription>
                  {viewMessage.direction === "outbound" ? "Sent to" : "Received from"}{" "}
                  {viewMessage.direction === "outbound"
                    ? viewMessage.toAddress
                    : viewMessage.fromAddress}
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4">
                {/* Meta info */}
                <div className="flex items-center gap-3 flex-wrap">
                  <Badge
                    variant="outline"
                    className={STATUS_COLORS[viewMessage.status] || ""}
                  >
                    {viewMessage.status}
                  </Badge>
                  <Badge
                    variant="outline"
                    className={
                      viewMessage.direction === "outbound"
                        ? "bg-blue-500/10 text-blue-400 border-blue-500/30"
                        : "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                    }
                  >
                    {viewMessage.direction === "outbound" ? (
                      <ArrowUpRight className="h-3 w-3 mr-1" />
                    ) : (
                      <ArrowDownLeft className="h-3 w-3 mr-1" />
                    )}
                    {viewMessage.direction}
                  </Badge>
                  <span className="text-sm text-muted-foreground">
                    {new Date(viewMessage.createdAt).toLocaleString()}
                  </span>
                </div>

                {/* Message body */}
                <div className="rounded-lg border border-border/50 bg-muted/30 p-4">
                  <p className="whitespace-pre-wrap text-sm leading-relaxed">
                    {viewMessage.body}
                  </p>
                </div>

                {/* Error message if failed */}
                {viewMessage.errorMessage && (
                  <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3">
                    <p className="text-sm text-red-400">
                      <strong>Error:</strong> {viewMessage.errorMessage}
                    </p>
                  </div>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
