import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Phone,
  PhoneCall,
  PhoneForwarded,
  MessageCircle,
  Mail,
  ChevronDown,
  Loader2,
  Send,
} from "lucide-react";

interface ContactQuickActionsProps {
  contact: {
    id: number;
    phone?: string | null;
    email?: string | null;
    firstName?: string | null;
    lastName?: string | null;
  };
  accountId: number;
  size?: "sm" | "md";
  onStopPropagation?: boolean;
}

export function ContactQuickActions({
  contact,
  accountId,
  size = "sm",
  onStopPropagation = true,
}: ContactQuickActionsProps) {
  // ── State ──
  const [phonePopoverOpen, setPhonePopoverOpen] = useState(false);
  const [callSubmenuOpen, setCallSubmenuOpen] = useState(false);
  const [smsDialogOpen, setSmsDialogOpen] = useState(false);
  const [emailDialogOpen, setEmailDialogOpen] = useState(false);
  const [smsBody, setSmsBody] = useState("");
  const [smsProvider, setSmsProvider] = useState<"blooio" | "twilio">("blooio");
  const [emailSubject, setEmailSubject] = useState("");
  const [emailBody, setEmailBody] = useState("");
  const [selectedSmsTemplateId, setSelectedSmsTemplateId] = useState<string>("");
  const [selectedEmailTemplateId, setSelectedEmailTemplateId] = useState<string>("");

  // ── Queries ──
  const { data: smsTemplates = [] } = trpc.smsTemplates.list.useQuery(
    { accountId },
    { enabled: smsDialogOpen }
  );
  const { data: emailTemplates = [] } = trpc.emailTemplates.list.useQuery(
    { accountId },
    { enabled: emailDialogOpen }
  );

  // ── Mutations ──
  const startAICallMutation = trpc.aiCalls.start.useMutation({
    onSuccess: (data) => {
      if (!data.success) {
        toast.error(data.error || "AI call failed. Check VAPI configuration.");
      } else if (data.queued) {
        toast.info("Call queued — will be dispatched when business hours resume.");
      } else {
        toast.success("AI call initiated successfully");
      }
    },
    onError: (err) => toast.error(err.message),
  });

  const clickToCallMutation = trpc.twilioCalls.clickToCall.useMutation({
    onSuccess: () => {
      toast.success("Call initiated — your phone will ring shortly");
      setPhonePopoverOpen(false);
    },
    onError: (err) => toast.error(err.message),
  });

  const sendReplyMutation = trpc.inbox.sendReply.useMutation({
    onSuccess: (_, vars) => {
      toast.success(vars.type === "sms" ? "SMS sent" : "Email sent");
      setSmsDialogOpen(false);
      setEmailDialogOpen(false);
      setSmsBody("");
      setEmailSubject("");
      setEmailBody("");
      setSelectedSmsTemplateId("");
      setSelectedEmailTemplateId("");
    },
    onError: (err) => toast.error(err.message),
  });

  // ── Helpers ──
  const stop = (e: React.MouseEvent) => {
    if (onStopPropagation) e.stopPropagation();
  };

  const hasPhone = !!contact.phone;
  const hasEmail = !!contact.email;
  const iconSize = size === "sm" ? "h-3.5 w-3.5" : "h-4 w-4";
  const btnSize = size === "sm" ? "h-7 w-7" : "h-8 w-8";

  return (
    <TooltipProvider delayDuration={300}>
      <div className="flex items-center gap-1" onClick={stop}>
        {/* ── Phone Button ── */}
        {hasPhone ? (
          <Popover
            open={phonePopoverOpen}
            onOpenChange={(open) => {
              setPhonePopoverOpen(open);
              if (!open) setCallSubmenuOpen(false);
            }}
          >
            <PopoverTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className={`${btnSize} p-0 text-green-600 hover:text-green-700 hover:bg-green-50 dark:hover:bg-green-950/30`}
              >
                <Phone className={iconSize} />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-56 p-2" align="end">
              <div className="space-y-1">
                {/* Call section */}
                <button
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm rounded-md hover:bg-accent transition-colors text-left"
                  onClick={() => setCallSubmenuOpen(!callSubmenuOpen)}
                >
                  <PhoneCall className="h-4 w-4 text-green-500" />
                  <span className="flex-1">Call</span>
                  <ChevronDown
                    className={`h-3 w-3 text-muted-foreground transition-transform ${callSubmenuOpen ? "rotate-180" : ""}`}
                  />
                </button>
                {callSubmenuOpen && (
                  <div className="ml-6 space-y-1 border-l border-border/50 pl-2">
                    <button
                      className="w-full flex items-center gap-2 px-2 py-1.5 text-xs rounded-md hover:bg-accent transition-colors text-left"
                      disabled={startAICallMutation.isPending}
                      onClick={() => {
                        startAICallMutation.mutate({
                          accountId,
                          contactId: contact.id,
                        });
                        setPhonePopoverOpen(false);
                      }}
                    >
                      {startAICallMutation.isPending ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <PhoneForwarded className="h-3 w-3 text-blue-500" />
                      )}
                      AI Call (Vappy)
                    </button>
                    <button
                      className="w-full flex items-center gap-2 px-2 py-1.5 text-xs rounded-md hover:bg-accent transition-colors text-left"
                      disabled={clickToCallMutation.isPending}
                      onClick={() => {
                        clickToCallMutation.mutate({
                          accountId,
                          contactId: contact.id,
                        });
                      }}
                    >
                      {clickToCallMutation.isPending ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <Phone className="h-3 w-3 text-emerald-500" />
                      )}
                      Call My Phone (Twilio)
                    </button>
                  </div>
                )}
                {/* SMS */}
                <button
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm rounded-md hover:bg-accent transition-colors text-left"
                  onClick={() => {
                    setSmsDialogOpen(true);
                    setPhonePopoverOpen(false);
                  }}
                >
                  <MessageCircle className="h-4 w-4 text-blue-500" />
                  <span>SMS</span>
                </button>
                {/* Email */}
                <button
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm rounded-md hover:bg-accent transition-colors text-left"
                  onClick={() => {
                    setEmailDialogOpen(true);
                    setPhonePopoverOpen(false);
                  }}
                >
                  <Mail className="h-4 w-4 text-purple-500" />
                  <span>Email</span>
                </button>
              </div>
            </PopoverContent>
          </Popover>
        ) : (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className={`${btnSize} p-0 text-muted-foreground/40 cursor-not-allowed`}
                disabled
              >
                <Phone className={iconSize} />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p className="text-xs">No phone number</p>
            </TooltipContent>
          </Tooltip>
        )}

        {/* ── SMS Button ── */}
        {hasPhone ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className={`${btnSize} p-0 text-blue-600 hover:text-blue-700 hover:bg-blue-50 dark:hover:bg-blue-950/30`}
                onClick={() => setSmsDialogOpen(true)}
              >
                <MessageCircle className={iconSize} />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p className="text-xs">Send SMS</p>
            </TooltipContent>
          </Tooltip>
        ) : (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className={`${btnSize} p-0 text-muted-foreground/40 cursor-not-allowed`}
                disabled
              >
                <MessageCircle className={iconSize} />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p className="text-xs">No phone number</p>
            </TooltipContent>
          </Tooltip>
        )}

        {/* ── Email Button ── */}
        {hasEmail ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className={`${btnSize} p-0 text-purple-600 hover:text-purple-700 hover:bg-purple-50 dark:hover:bg-purple-950/30`}
                onClick={() => setEmailDialogOpen(true)}
              >
                <Mail className={iconSize} />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p className="text-xs">Send Email</p>
            </TooltipContent>
          </Tooltip>
        ) : (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className={`${btnSize} p-0 text-muted-foreground/40 cursor-not-allowed`}
                disabled
              >
                <Mail className={iconSize} />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p className="text-xs">No email address</p>
            </TooltipContent>
          </Tooltip>
        )}

        {/* ── SMS Dialog ── */}
        <Dialog
          open={smsDialogOpen}
          onOpenChange={(open) => {
            setSmsDialogOpen(open);
            if (!open) {
              setSmsBody("");
              setSelectedSmsTemplateId("");
            }
          }}
        >
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <MessageCircle className="h-4 w-4 text-blue-500" />
                Send SMS to {contact.firstName}
              </DialogTitle>
              <DialogDescription>{contact.phone}</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              {/* Provider */}
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Provider</Label>
                <RadioGroup
                  value={smsProvider}
                  onValueChange={(v) => setSmsProvider(v as "blooio" | "twilio")}
                  className="flex gap-4"
                >
                  <div className="flex items-center gap-2">
                    <RadioGroupItem value="blooio" id={`sms-blooio-${contact.id}`} />
                    <Label htmlFor={`sms-blooio-${contact.id}`} className="text-sm cursor-pointer">
                      Blooio
                    </Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <RadioGroupItem value="twilio" id={`sms-twilio-${contact.id}`} />
                    <Label htmlFor={`sms-twilio-${contact.id}`} className="text-sm cursor-pointer">
                      Twilio
                    </Label>
                  </div>
                </RadioGroup>
              </div>
              {/* Template */}
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Template (optional)</Label>
                <Select
                  value={selectedSmsTemplateId}
                  onValueChange={(v) => {
                    setSelectedSmsTemplateId(v);
                    const tpl = smsTemplates.find((t: any) => String(t.id) === v);
                    if (tpl) setSmsBody((tpl as any).body);
                  }}
                >
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="Select a template..." />
                  </SelectTrigger>
                  <SelectContent>
                    {smsTemplates.map((t: any) => (
                      <SelectItem key={t.id} value={String(t.id)}>
                        {t.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {/* Body */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-xs text-muted-foreground">Message</Label>
                  <span
                    className={`text-[10px] ${smsBody.length > 160 ? "text-orange-400" : "text-muted-foreground"}`}
                  >
                    {smsBody.length}/160
                  </span>
                </div>
                <Textarea
                  value={smsBody}
                  onChange={(e) => setSmsBody(e.target.value)}
                  placeholder="Type your message..."
                  rows={4}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" size="sm" onClick={() => setSmsDialogOpen(false)}>
                Cancel
              </Button>
              <Button
                size="sm"
                disabled={!smsBody.trim() || sendReplyMutation.isPending}
                onClick={() => {
                  sendReplyMutation.mutate({
                    accountId,
                    contactId: contact.id,
                    type: "sms",
                    body: smsBody.trim(),
                    provider: smsProvider,
                  });
                }}
              >
                {sendReplyMutation.isPending ? (
                  <Loader2 className="h-3 w-3 animate-spin mr-1.5" />
                ) : (
                  <Send className="h-3 w-3 mr-1.5" />
                )}
                Send SMS
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* ── Email Dialog ── */}
        <Dialog
          open={emailDialogOpen}
          onOpenChange={(open) => {
            setEmailDialogOpen(open);
            if (!open) {
              setEmailSubject("");
              setEmailBody("");
              setSelectedEmailTemplateId("");
            }
          }}
        >
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Mail className="h-4 w-4 text-purple-500" />
                Send Email to {contact.firstName}
              </DialogTitle>
              <DialogDescription>
                {contact.email || "No email on file"}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              {/* Template */}
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Template (optional)</Label>
                <Select
                  value={selectedEmailTemplateId}
                  onValueChange={(v) => {
                    setSelectedEmailTemplateId(v);
                    const tpl = emailTemplates.find((t: any) => String(t.id) === v);
                    if (tpl) {
                      setEmailSubject((tpl as any).subject || "");
                      setEmailBody((tpl as any).body || "");
                    }
                  }}
                >
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="Select a template..." />
                  </SelectTrigger>
                  <SelectContent>
                    {emailTemplates.map((t: any) => (
                      <SelectItem key={t.id} value={String(t.id)}>
                        {t.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {/* Subject */}
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Subject</Label>
                <Input
                  value={emailSubject}
                  onChange={(e) => setEmailSubject(e.target.value)}
                  placeholder="Email subject..."
                />
              </div>
              {/* Body */}
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Body</Label>
                <Textarea
                  value={emailBody}
                  onChange={(e) => setEmailBody(e.target.value)}
                  placeholder="Type your email..."
                  rows={6}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" size="sm" onClick={() => setEmailDialogOpen(false)}>
                Cancel
              </Button>
              <Button
                size="sm"
                disabled={
                  !emailSubject.trim() ||
                  !emailBody.trim() ||
                  !contact.email ||
                  sendReplyMutation.isPending
                }
                onClick={() => {
                  sendReplyMutation.mutate({
                    accountId,
                    contactId: contact.id,
                    type: "email",
                    subject: emailSubject.trim(),
                    body: emailBody.trim(),
                  });
                }}
              >
                {sendReplyMutation.isPending ? (
                  <Loader2 className="h-3 w-3 animate-spin mr-1.5" />
                ) : (
                  <Send className="h-3 w-3 mr-1.5" />
                )}
                Send Email
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </TooltipProvider>
  );
}
