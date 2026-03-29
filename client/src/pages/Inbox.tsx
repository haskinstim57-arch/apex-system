import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ArrowLeft,
  Loader2,
  Mail,
  MessageCircle,
  MessageSquare,
  Phone,
  Search,
  Send,
  User,
  UserCheck,
  XCircle,
  Inbox as InboxIcon,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { useAccount } from "@/contexts/AccountContext";
import { NoAccountSelected } from "@/components/NoAccountSelected";

type FilterTab = "all" | "sms" | "email" | "webchat" | "unread";

export default function Inbox() {
  const { user } = useAuth();
  const utils = trpc.useUtils();
  const { currentAccountId: accountId, isLoading: accountsLoading } = useAccount();

  // State
  const [activeFilter, setActiveFilter] = useState<FilterTab>("all");
  const [search, setSearch] = useState("");
  const [selectedContactId, setSelectedContactId] = useState<number | null>(null);
  const [replyChannel, setReplyChannel] = useState<"sms" | "email">("sms");
  const [replyBody, setReplyBody] = useState("");
  const [replySubject, setReplySubject] = useState("");
  const [isMobileThreadOpen, setIsMobileThreadOpen] = useState(false);
  const threadEndRef = useRef<HTMLDivElement>(null);

  // Stabilize search for query
  const [debouncedSearch, setDebouncedSearch] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  // Conversations query with polling
  const { data: conversationsData, isLoading: convsLoading } =
    trpc.inbox.getConversations.useQuery(
      {
        accountId: accountId!,
        type: activeFilter === "sms" || activeFilter === "email" ? activeFilter : undefined,
        unreadOnly: activeFilter === "unread" ? true : undefined,
        search: debouncedSearch || undefined,
        limit: 100,
      },
      {
        enabled: !!accountId,
        refetchInterval: 10000,
      }
    );

  // Thread query with polling
  const { data: threadMessages, isLoading: threadLoading } =
    trpc.inbox.getThread.useQuery(
      {
        accountId: accountId!,
        contactId: selectedContactId!,
      },
      {
        enabled: !!accountId && !!selectedContactId,
        refetchInterval: 10000,
      }
    );

  // Mark as read mutation
  const markAsRead = trpc.inbox.markAsRead.useMutation({
    onSuccess: () => {
      utils.inbox.getConversations.invalidate();
      utils.inbox.getUnreadCount.invalidate();
    },
  });

  // Send reply mutation
  const sendReply = trpc.inbox.sendReply.useMutation({
    onSuccess: () => {
      toast.success("Reply sent");
      setReplyBody("");
      setReplySubject("");
      utils.inbox.getThread.invalidate();
      utils.inbox.getConversations.invalidate();
    },
    onError: (err) => {
      toast.error(err.message || "Failed to send reply");
    },
  });

  // Auto-scroll to bottom when thread updates
  useEffect(() => {
    if (threadMessages && threadEndRef.current) {
      threadEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [threadMessages]);

  // Mark as read when opening a thread
  useEffect(() => {
    if (selectedContactId && accountId) {
      const conv = conversations.find((c) => c.contactId === selectedContactId);
      if (conv && conv.unreadCount > 0) {
        markAsRead.mutate({ accountId, contactId: selectedContactId });
      }
    }
  }, [selectedContactId, accountId]);

  const conversations = conversationsData?.conversations ?? [];
  const selectedConversation = conversations.find(
    (c) => c.contactId === selectedContactId
  );

  function handleSelectContact(contactId: number) {
    setSelectedContactId(contactId);
    setIsMobileThreadOpen(true);
    // Set default reply channel based on contact info
    const conv = conversations.find((c) => c.contactId === contactId);
    if (conv?.latestMessage) {
      setReplyChannel(conv.latestMessage.type as "sms" | "email");
    }
  }

  function handleSendReply() {
    if (!accountId || !selectedContactId || !replyBody.trim()) {
      toast.error("Please enter a message");
      return;
    }
    if (replyChannel === "email" && !replySubject.trim()) {
      toast.error("Email replies require a subject");
      return;
    }
    sendReply.mutate({
      accountId,
      contactId: selectedContactId,
      type: replyChannel,
      subject: replyChannel === "email" ? replySubject : undefined,
      body: replyBody.trim(),
    });
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendReply();
    }
  }

  if (!accountId) {
    return <NoAccountSelected />;
  }

  // ─── Webchat sessions query ───
  const { data: webchatSessionsData, isLoading: webchatLoading } =
    trpc.webchat.listSessions.useQuery(
      { accountId: accountId!, limit: 50 },
      { enabled: !!accountId && activeFilter === "webchat", refetchInterval: 5000 }
    );
  const { data: webchatUnread } = trpc.webchat.getUnreadCount.useQuery(
    { accountId: accountId! },
    { enabled: !!accountId, refetchInterval: 10000 }
  );
  const webchatSessions = webchatSessionsData?.sessions || [];

  // Webchat session detail state
  const [selectedSessionId, setSelectedSessionId] = useState<number | null>(null);
  const { data: webchatDetail, isLoading: webchatDetailLoading } =
    trpc.webchat.getSessionMessages.useQuery(
      { accountId: accountId!, sessionId: selectedSessionId! },
      { enabled: !!accountId && !!selectedSessionId, refetchInterval: 3000 }
    );

  const takeOverMutation = trpc.webchat.takeOverSession.useMutation({
    onSuccess: () => {
      toast.success("You've taken over this conversation");
      utils.webchat.listSessions.invalidate({ accountId: accountId! });
    },
    onError: (err) => toast.error(err.message),
  });

  const closeSessionMutation = trpc.webchat.closeSession.useMutation({
    onSuccess: () => {
      toast.success("Session closed");
      utils.webchat.listSessions.invalidate({ accountId: accountId! });
    },
    onError: (err) => toast.error(err.message),
  });

  const [webchatReply, setWebchatReply] = useState("");
  const sendAgentReply = trpc.webchat.sendAgentReply.useMutation({
    onSuccess: () => {
      setWebchatReply("");
      utils.webchat.getSessionMessages.invalidate({ accountId: accountId!, sessionId: selectedSessionId! });
    },
    onError: (err) => toast.error(err.message),
  });

  const filterTabs: { key: FilterTab; label: string; icon?: React.ReactNode; badge?: number }[] = [
    { key: "all", label: "All" },
    { key: "sms", label: "SMS", icon: <Phone className="h-3 w-3" /> },
    { key: "email", label: "Email", icon: <Mail className="h-3 w-3" /> },
    { key: "webchat", label: "Webchat", icon: <MessageCircle className="h-3 w-3" />, badge: webchatUnread?.count },
    { key: "unread", label: "Unread" },
  ];

  return (
    <div className="h-[calc(100vh-4rem)] flex overflow-hidden">
      {/* Left Panel — Conversation List */}
      <div
        className={`w-full md:w-[380px] lg:w-[420px] border-r border-border/50 flex flex-col shrink-0 ${
          isMobileThreadOpen ? "hidden md:flex" : "flex"
        }`}
      >
        {/* Header */}
        <div className="p-4 border-b border-border/50 space-y-3">
          <div className="flex items-center justify-between">
            <h1 className="text-lg font-semibold tracking-tight">Inbox</h1>
            {conversationsData && (
              <span className="text-xs text-muted-foreground">
                {conversationsData.total} conversation
                {conversationsData.total !== 1 ? "s" : ""}
              </span>
            )}
          </div>

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search contacts..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 h-9 bg-muted/30 border-border/50"
            />
          </div>

          {/* Filter tabs */}
          <div className="flex gap-1">
            {filterTabs.map((tab) => (
              <button
                key={tab.key}
                onClick={() => {
                  setActiveFilter(tab.key);
                  setSelectedContactId(null);
                  setIsMobileThreadOpen(false);
                }}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors flex items-center gap-1.5 ${
                  activeFilter === tab.key
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted/30 text-muted-foreground hover:bg-accent"
                }`}
              >
                {tab.icon}
                {tab.label}
                {tab.badge && tab.badge > 0 ? (
                  <span className="ml-1 bg-red-500 text-white text-[10px] font-bold rounded-full h-4 min-w-[16px] px-1 flex items-center justify-center">
                    {tab.badge}
                  </span>
                ) : null}
              </button>
            ))}
          </div>
        </div>

        {/* Conversation list */}
        <div className="flex-1 overflow-y-auto">
          {activeFilter === "webchat" ? (
            /* Webchat sessions list */
            webchatLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : webchatSessions.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
                <MessageCircle className="h-10 w-10 text-muted-foreground/40 mb-3" />
                <p className="text-sm text-muted-foreground">No webchat sessions</p>
                <p className="text-xs text-muted-foreground/60 mt-1">
                  Webchat conversations will appear here when visitors use your chat widget
                </p>
              </div>
            ) : (
              webchatSessions.map((session: any) => (
                <button
                  key={session.id}
                  onClick={() => {
                    setSelectedSessionId(session.id);
                    setSelectedContactId(null);
                    setIsMobileThreadOpen(true);
                  }}
                  className={`w-full text-left px-4 py-3 border-b border-border/30 transition-colors hover:bg-accent ${
                    selectedSessionId === session.id ? "bg-muted/40" : ""
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className="relative shrink-0">
                      <div className="h-10 w-10 rounded-full bg-indigo-100 flex items-center justify-center">
                        <MessageCircle className="h-4 w-4 text-indigo-600" />
                      </div>
                      {session.handoffRequested && !session.agentTakenOver && (
                        <div className="absolute -top-0.5 -right-0.5 h-3 w-3 rounded-full bg-orange-500 border-2 border-background" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-medium truncate">
                          {session.visitorName || session.visitorEmail || `Visitor #${session.id}`}
                        </span>
                        <span className="text-[11px] text-muted-foreground shrink-0">
                          {session.createdAt ? formatRelativeTime(new Date(session.createdAt)) : ""}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        {session.handoffRequested && (
                          <Badge variant="outline" className="text-[10px] px-1 py-0 text-orange-600 border-orange-200">
                            {session.agentTakenOver ? "Agent Active" : "Handoff Requested"}
                          </Badge>
                        )}
                        {session.status === "closed" && (
                          <Badge variant="secondary" className="text-[10px] px-1 py-0">Closed</Badge>
                        )}
                        <span className="text-xs text-muted-foreground truncate">
                          {session.visitorEmail || session.pageUrl || ""}
                        </span>
                      </div>
                    </div>
                  </div>
                </button>
              ))
            )
          ) : (
            /* Regular conversations list */
            convsLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : conversations.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
                <InboxIcon className="h-10 w-10 text-muted-foreground/40 mb-3" />
                <p className="text-sm text-muted-foreground">No conversations yet</p>
                <p className="text-xs text-muted-foreground/60 mt-1">
                  Messages will appear here when you send or receive them
                </p>
              </div>
            ) : (
              conversations.map((conv) => (
                <ConversationRow
                  key={conv.contactId}
                  conversation={conv}
                  isSelected={selectedContactId === conv.contactId}
                  onClick={() => handleSelectContact(conv.contactId)}
                />
              ))
            )
          )}
        </div>
      </div>

      {/* Right Panel — Thread View */}
      <div
        className={`flex-1 flex flex-col min-w-0 ${
          !isMobileThreadOpen ? "hidden md:flex" : "flex"
        }`}
      >
        {/* Webchat thread view */}
        {activeFilter === "webchat" && selectedSessionId && webchatDetail ? (
          <>
            {/* Webchat thread header */}
            <div className="h-14 px-4 border-b border-border/50 flex items-center gap-3 shrink-0">
              <button
                onClick={() => { setIsMobileThreadOpen(false); setSelectedSessionId(null); }}
                className="md:hidden p-1 rounded-md hover:bg-accent"
              >
                <ArrowLeft className="h-5 w-5" />
              </button>
              <div className="h-9 w-9 rounded-full bg-indigo-100 flex items-center justify-center shrink-0">
                <MessageCircle className="h-4 w-4 text-indigo-600" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium truncate">
                  {webchatDetail.session.visitorName || webchatDetail.session.visitorEmail || `Visitor #${webchatDetail.session.id}`}
                </p>
                <p className="text-xs text-muted-foreground truncate">
                  {webchatDetail.session.visitorEmail || ""}
                  {webchatDetail.session.pageUrl ? ` · ${webchatDetail.session.pageUrl}` : ""}
                </p>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                {!webchatDetail.session.agentTakenOver && webchatDetail.session.status === "active" && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-xs h-8"
                    onClick={() => takeOverMutation.mutate({ accountId: accountId!, sessionId: selectedSessionId })}
                    disabled={takeOverMutation.isPending}
                  >
                    <UserCheck className="h-3.5 w-3.5 mr-1" />
                    Take Over
                  </Button>
                )}
                {webchatDetail.session.agentTakenOver && (
                  <Badge variant="default" className="text-[10px] bg-green-600">You're Active</Badge>
                )}
                {webchatDetail.session.status === "active" && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-xs h-8 text-destructive"
                    onClick={() => closeSessionMutation.mutate({ accountId: accountId!, sessionId: selectedSessionId })}
                    disabled={closeSessionMutation.isPending}
                  >
                    <XCircle className="h-3.5 w-3.5 mr-1" />
                    Close
                  </Button>
                )}
              </div>
            </div>

            {/* Webchat messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {webchatDetailLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : webchatDetail.messages.length > 0 ? (
                <>
                  {webchatDetail.messages.map((msg: any) => (
                    <div key={msg.id} className={`flex ${msg.sender === "visitor" ? "justify-start" : "justify-end"}`}>
                      <div
                        className={`max-w-[75%] rounded-2xl px-4 py-2.5 ${
                          msg.sender === "visitor"
                            ? "bg-muted/50 text-foreground rounded-bl-md"
                            : msg.sender === "agent"
                              ? "bg-green-600 text-white rounded-br-md"
                              : "bg-primary text-primary-foreground rounded-br-md"
                        }`}
                      >
                        <div className="flex items-center gap-1.5 mb-1">
                          <span className="text-[10px] uppercase tracking-wider opacity-60">
                            {msg.sender === "visitor" ? "Visitor" : msg.sender === "agent" ? "Agent" : "AI"}
                          </span>
                        </div>
                        <p className="text-sm whitespace-pre-wrap break-words leading-relaxed">{msg.content}</p>
                        <div className="flex items-center justify-end mt-1">
                          <span className="text-[10px] opacity-50">
                            {new Date(msg.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                  <div ref={threadEndRef} />
                </>
              ) : (
                <div className="flex items-center justify-center py-12">
                  <p className="text-sm text-muted-foreground">No messages in this session</p>
                </div>
              )}
            </div>

            {/* Agent reply box (only when taken over and session active) */}
            {webchatDetail.session.agentTakenOver && webchatDetail.session.status === "active" && (
              <div className="border-t border-border/50 p-3 shrink-0">
                <div className="flex gap-2">
                  <Textarea
                    placeholder="Type your reply..."
                    value={webchatReply}
                    onChange={(e) => setWebchatReply(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        if (webchatReply.trim()) {
                          sendAgentReply.mutate({ accountId: accountId!, sessionId: selectedSessionId, content: webchatReply.trim() });
                        }
                      }
                    }}
                    className="min-h-[60px] max-h-[120px] resize-none text-sm"
                    rows={2}
                  />
                  <Button
                    onClick={() => {
                      if (webchatReply.trim()) {
                        sendAgentReply.mutate({ accountId: accountId!, sessionId: selectedSessionId, content: webchatReply.trim() });
                      }
                    }}
                    disabled={sendAgentReply.isPending || !webchatReply.trim()}
                    size="icon"
                    className="h-[48px] w-[48px] sm:h-[60px] sm:w-[60px] bg-green-600 hover:bg-green-700 shrink-0"
                  >
                    {sendAgentReply.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Send className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>
            )}
          </>
        ) : selectedContactId && selectedConversation ? (
          <>
            {/* Thread header */}
            <div className="h-14 px-4 border-b border-border/50 flex items-center gap-3 shrink-0">
              <button
                onClick={() => {
                  setIsMobileThreadOpen(false);
                  setSelectedContactId(null);
                }}
                className="md:hidden p-1 rounded-md hover:bg-accent"
              >
                <ArrowLeft className="h-5 w-5" />
              </button>
              <div className="h-9 w-9 rounded-full bg-primary/15 flex items-center justify-center shrink-0">
                <User className="h-4 w-4 text-primary" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium truncate">
                  {selectedConversation.contactName}
                </p>
                <p className="text-xs text-muted-foreground truncate">
                  {selectedConversation.contactEmail || selectedConversation.contactPhone || ""}
                </p>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {threadLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : threadMessages && threadMessages.length > 0 ? (
                <>
                  {threadMessages.map((msg) => (
                    <MessageBubble key={msg.id} message={msg} />
                  ))}
                  <div ref={threadEndRef} />
                </>
              ) : (
                <div className="flex items-center justify-center py-12">
                  <p className="text-sm text-muted-foreground">No messages in this thread</p>
                </div>
              )}
            </div>

            {/* Reply box */}
            <div className="border-t border-border/50 p-3 space-y-2 shrink-0">
              <div className="flex items-center gap-2">
                <Select
                  value={replyChannel}
                  onValueChange={(v) => setReplyChannel(v as "sms" | "email")}
                >
                  <SelectTrigger className="w-[110px] h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="sms">
                      <span className="flex items-center gap-1.5">
                        <Phone className="h-3 w-3" /> SMS
                      </span>
                    </SelectItem>
                    <SelectItem value="email">
                      <span className="flex items-center gap-1.5">
                        <Mail className="h-3 w-3" /> Email
                      </span>
                    </SelectItem>
                  </SelectContent>
                </Select>
                {replyChannel === "email" && (
                  <Input
                    placeholder="Subject..."
                    value={replySubject}
                    onChange={(e) => setReplySubject(e.target.value)}
                    className="h-8 text-xs flex-1"
                  />
                )}
              </div>
              <div className="flex gap-2">
                <Textarea
                  placeholder={`Type your ${replyChannel === "sms" ? "SMS" : "email"} reply...`}
                  value={replyBody}
                  onChange={(e) => setReplyBody(e.target.value)}
                  onKeyDown={handleKeyDown}
                  className="min-h-[60px] max-h-[120px] resize-none text-sm"
                  rows={2}
                />
                <Button
                  onClick={handleSendReply}
                  disabled={sendReply.isPending || !replyBody.trim()}
                  size="icon"
                  className="h-[48px] w-[48px] sm:h-[60px] sm:w-[60px] bg-primary hover:bg-primary/90 shrink-0"
                >
                  {sendReply.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>
          </>
        ) : (
          /* Empty state — no conversation selected */
          <div className="flex-1 flex flex-col items-center justify-center text-center px-8">
            <div className="h-16 w-16 rounded-2xl bg-muted/30 flex items-center justify-center mb-4">
              <MessageSquare className="h-8 w-8 text-muted-foreground/40" />
            </div>
            <h3 className="text-base font-medium text-muted-foreground mb-1">
              Select a conversation
            </h3>
            <p className="text-sm text-muted-foreground/60 max-w-xs">
              Choose a contact from the list to view their message history and reply
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Conversation Row Component ───

function ConversationRow({
  conversation,
  isSelected,
  onClick,
}: {
  conversation: {
    contactId: number;
    contactName: string;
    contactEmail: string | null;
    contactPhone: string | null;
    unreadCount: number;
    lastMessageAt: Date | null;
    latestMessage: {
      id: number;
      type: string;
      direction: string;
      subject: string | null;
      body: string;
      isRead: boolean;
      createdAt: Date;
    } | null;
  };
  isSelected: boolean;
  onClick: () => void;
}) {
  const { latestMessage } = conversation;
  const hasUnread = conversation.unreadCount > 0;

  // Format time
  const timeStr = latestMessage
    ? formatRelativeTime(new Date(latestMessage.createdAt))
    : "";

  // Preview text
  const preview = latestMessage
    ? latestMessage.type === "email" && latestMessage.subject
      ? latestMessage.subject
      : latestMessage.body
    : "No messages";

  // Direction prefix
  const dirPrefix =
    latestMessage?.direction === "outbound" ? "You: " : "";

  return (
    <button
      onClick={onClick}
      className={`w-full text-left px-4 py-3 border-b border-border/30 transition-colors hover:bg-accent ${
        isSelected ? "bg-muted/40" : ""
      } ${hasUnread ? "bg-primary/5" : ""}`}
    >
      <div className="flex items-start gap-3">
        {/* Avatar */}
        <div className="relative shrink-0">
          <div className="h-10 w-10 rounded-full bg-muted/50 flex items-center justify-center">
            <User className="h-4 w-4 text-muted-foreground" />
          </div>
          {hasUnread && (
            <div className="absolute -top-0.5 -right-0.5 h-3 w-3 rounded-full bg-primary border-2 border-background" />
          )}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <span
              className={`text-sm truncate ${
                hasUnread ? "font-semibold text-foreground" : "font-medium text-foreground/80"
              }`}
            >
              {conversation.contactName}
            </span>
            <span className="text-[11px] text-muted-foreground shrink-0">
              {timeStr}
            </span>
          </div>
          <div className="flex items-center gap-1.5 mt-0.5">
            {/* Channel icon */}
            {latestMessage?.type === "sms" ? (
              <Phone className="h-3 w-3 text-muted-foreground/60 shrink-0" />
            ) : latestMessage?.type === "email" ? (
              <Mail className="h-3 w-3 text-muted-foreground/60 shrink-0" />
            ) : null}
            <span
              className={`text-xs truncate ${
                hasUnread
                  ? "text-foreground/70 font-medium"
                  : "text-muted-foreground"
              }`}
            >
              {dirPrefix}
              {preview}
            </span>
          </div>
        </div>

        {/* Unread badge */}
        {hasUnread && (
          <Badge
            variant="default"
            className="h-5 min-w-[20px] px-1.5 text-[10px] font-bold rounded-full shrink-0"
          >
            {conversation.unreadCount}
          </Badge>
        )}
      </div>
    </button>
  );
}

// ─── Message Bubble Component ───

function MessageBubble({
  message,
}: {
  message: {
    id: number;
    type: string;
    direction: string;
    status: string;
    subject: string | null;
    body: string;
    fromAddress: string | null;
    toAddress: string;
    createdAt: Date;
  };
}) {
  const isOutbound = message.direction === "outbound";
  const time = new Date(message.createdAt).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div className={`flex ${isOutbound ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[75%] rounded-2xl px-4 py-2.5 ${
          isOutbound
            ? "bg-primary text-primary-foreground rounded-br-md"
            : "bg-muted/50 text-foreground rounded-bl-md"
        }`}
      >
        {/* Channel badge */}
        <div className="flex items-center gap-1.5 mb-1">
          {message.type === "sms" ? (
            <Phone className="h-2.5 w-2.5 opacity-60" />
          ) : (
            <Mail className="h-2.5 w-2.5 opacity-60" />
          )}
          <span className="text-[10px] uppercase tracking-wider opacity-60">
            {message.type}
          </span>
        </div>

        {/* Subject for emails */}
        {message.type === "email" && message.subject && (
          <p className="text-xs font-semibold mb-1 opacity-80">
            {message.subject}
          </p>
        )}

        {/* Body */}
        <p className="text-sm whitespace-pre-wrap break-words leading-relaxed">
          {message.body}
        </p>

        {/* Time + status */}
        <div className="flex items-center justify-end gap-1.5 mt-1">
          <span className="text-[10px] opacity-50">{time}</span>
          {isOutbound && (
            <span className="text-[10px] opacity-50 capitalize">
              {message.status}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Helpers ───

function formatRelativeTime(date: Date): string {
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (mins < 1) return "now";
  if (mins < 60) return `${mins}m`;
  if (hours < 24) return `${hours}h`;
  if (days < 7) return `${days}d`;
  return date.toLocaleDateString([], { month: "short", day: "numeric" });
}
