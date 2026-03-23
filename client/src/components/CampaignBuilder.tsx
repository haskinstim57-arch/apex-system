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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Calendar,
  Check,
  ChevronRight,
  Clock,
  Eye,
  FileText,
  Loader2,
  Mail,
  MessageSquare,
  Play,
  Search,
  Send,
  Users,
  X,
  Palette,
} from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

// ─── Merge tags for template variables ───
const MERGE_TAGS = [
  { tag: "{{first_name}}", label: "First Name" },
  { tag: "{{last_name}}", label: "Last Name" },
  { tag: "{{agent_name}}", label: "Agent Name" },
  { tag: "{{company_name}}", label: "Company" },
  { tag: "{{email}}", label: "Email" },
  { tag: "{{phone}}", label: "Phone" },
];

const STEP_LABELS = [
  "Campaign Type",
  "Select Template",
  "Select Recipients",
  "Review Campaign",
  "Send Options",
];

// ─── Contact status options for filtering ───
const CONTACT_STATUSES = [
  "new",
  "contacted",
  "qualified",
  "proposal",
  "negotiation",
  "won",
  "lost",
  "nurture",
];

interface CampaignBuilderProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  accountId: number;
}

export default function CampaignBuilder({
  open,
  onOpenChange,
  accountId,
}: CampaignBuilderProps) {
  const utils = trpc.useUtils();

  // ─── Wizard state ───
  const [step, setStep] = useState(1);

  // Step 1: Type
  const [campaignType, setCampaignType] = useState<"email" | "sms" | null>(null);

  // Step 2: Template
  const [selectedTemplateId, setSelectedTemplateId] = useState<number | null>(null);
  const [campaignName, setCampaignName] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [fromAddress, setFromAddress] = useState("");
  const [customMessage, setCustomMessage] = useState(false);

  // Step 3: Recipients
  const [selectedContacts, setSelectedContacts] = useState<
    Array<{ id: number; firstName: string; lastName: string; email: string; phone: string; status: string }>
  >([]);
  const [contactSearch, setContactSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [tagFilter, setTagFilter] = useState<string>("");
  const [selectAll, setSelectAll] = useState(false);

  // Step 5: Schedule
  const [sendOption, setSendOption] = useState<"now" | "scheduled">("now");
  const [scheduledDate, setScheduledDate] = useState("");
  const [scheduledTime, setScheduledTime] = useState("");

  // ─── State for email template selection ───
  const [useEmailTemplate, setUseEmailTemplate] = useState(false);
  const [selectedEmailTemplateId, setSelectedEmailTemplateId] = useState<number | null>(null);

  // ─── Queries ───
  const { data: templates } = trpc.campaigns.templates.list.useQuery(
    { accountId, type: campaignType || undefined },
    { enabled: !!accountId && !!campaignType }
  );

  const { data: emailTemplates } = trpc.emailTemplates.list.useQuery(
    { accountId },
    { enabled: !!accountId && campaignType === "email" }
  );

  const { data: contactsData, isLoading: contactsLoading } = trpc.contacts.list.useQuery(
    {
      accountId,
      search: contactSearch || undefined,
      status: (statusFilter as any) || undefined,
      tag: tagFilter || undefined,
      limit: 100,
    },
    { enabled: !!accountId && step === 3 }
  );

  const { data: allTags } = trpc.contacts.allTags.useQuery(
    { accountId },
    { enabled: !!accountId && step === 3 }
  );

  // ─── Mutations ───
  const createMutation = trpc.campaigns.create.useMutation();
  const addRecipientsMutation = trpc.campaigns.addRecipients.useMutation();
  const sendMutation = trpc.campaigns.send.useMutation();
  const scheduleMutation = trpc.campaigns.schedule.useMutation();

  // ─── Derived ───
  const contacts = contactsData?.data || [];
  const filteredTemplates = useMemo(() => {
    if (!templates) return [];
    return templates.filter((t: any) => t.type === campaignType);
  }, [templates, campaignType]);

  const selectedTemplate = useMemo(() => {
    if (!selectedTemplateId || !templates) return null;
    return templates.find((t: any) => t.id === selectedTemplateId) || null;
  }, [selectedTemplateId, templates]);

  // ─── Handlers ───
  const resetForm = () => {
    setStep(1);
    setCampaignType(null);
    setSelectedTemplateId(null);
    setCampaignName("");
    setSubject("");
    setBody("");
    setFromAddress("");
    setCustomMessage(false);
    setUseEmailTemplate(false);
    setSelectedEmailTemplateId(null);
    setSelectedContacts([]);
    setContactSearch("");
    setStatusFilter("");
    setTagFilter("");
    setSelectAll(false);
    setSendOption("now");
    setScheduledDate("");
    setScheduledTime("");
  };

  const handleEmailTemplateSelect = (et: any) => {
    setSelectedEmailTemplateId(et.id);
    setSelectedTemplateId(null);
    setCustomMessage(false);
    setUseEmailTemplate(true);
    setCampaignName(campaignName || et.name);
    setSubject(et.subject || "");
    setBody(et.name); // placeholder body for validation
  };

  const handleTemplateSelect = (template: any) => {
    setSelectedTemplateId(template.id);
    setCampaignName(template.name);
    setBody(template.body);
    if (template.subject) setSubject(template.subject);
    setCustomMessage(false);
    setUseEmailTemplate(false);
    setSelectedEmailTemplateId(null);
  };

  const handleCustomMessage = () => {
    setSelectedTemplateId(null);
    setCustomMessage(true);
    setUseEmailTemplate(false);
    setSelectedEmailTemplateId(null);
    setBody("");
    setSubject("");
  };

  const toggleContact = (contact: any) => {
    setSelectedContacts((prev) => {
      const exists = prev.find((c) => c.id === contact.id);
      if (exists) return prev.filter((c) => c.id !== contact.id);
      return [
        ...prev,
        {
          id: contact.id,
          firstName: contact.firstName,
          lastName: contact.lastName,
          email: contact.email || "",
          phone: contact.phone || "",
          status: contact.status,
        },
      ];
    });
  };

  const handleSelectAll = () => {
    if (selectAll) {
      setSelectedContacts([]);
      setSelectAll(false);
    } else {
      const eligible = contacts.filter((c: any) =>
        campaignType === "email" ? !!c.email : !!c.phone
      );
      setSelectedContacts(
        eligible.map((c: any) => ({
          id: c.id,
          firstName: c.firstName,
          lastName: c.lastName,
          email: c.email || "",
          phone: c.phone || "",
          status: c.status,
        }))
      );
      setSelectAll(true);
    }
  };

  const canProceed = () => {
    switch (step) {
      case 1:
        return !!campaignType;
      case 2:
        return (
          (!!selectedTemplateId || customMessage || useEmailTemplate) &&
          !!campaignName.trim() &&
          (useEmailTemplate || !!body.trim()) &&
          (campaignType === "sms" || !!subject.trim() || useEmailTemplate)
        );
      case 3:
        return selectedContacts.length > 0;
      case 4:
        return true;
      case 5:
        return sendOption === "now" || (!!scheduledDate && !!scheduledTime);
      default:
        return false;
    }
  };

  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleLaunch = async () => {
    if (!campaignType || !accountId) return;
    setIsSubmitting(true);

    try {
      // 1. Create the campaign as draft
      const campaign = await createMutation.mutateAsync({
        accountId,
        name: campaignName,
        type: campaignType,
        subject: campaignType === "email" ? subject : undefined,
        body,
        fromAddress: fromAddress || undefined,
        templateId: selectedEmailTemplateId || selectedTemplateId || undefined,
      });

      // 2. Add recipients
      if (selectedContacts.length > 0) {
        const recipients = selectedContacts.map((c) => ({
          contactId: c.id,
          toAddress: campaignType === "email" ? c.email : c.phone,
        }));
        await addRecipientsMutation.mutateAsync({
          campaignId: campaign.id,
          accountId,
          recipients,
        });
      }

      // 3. Send or schedule
      if (sendOption === "now") {
        const result = await sendMutation.mutateAsync({
          id: campaign.id,
          accountId,
        });
        toast.success(
          `Campaign sent! ${result.sentCount} delivered, ${result.failedCount} failed`
        );
      } else {
        const scheduledAt = new Date(`${scheduledDate}T${scheduledTime}`);
        await scheduleMutation.mutateAsync({
          id: campaign.id,
          accountId,
          scheduledAt,
        });
        toast.success(
          `Campaign scheduled for ${scheduledAt.toLocaleString()}`
        );
      }

      // 4. Invalidate and close
      utils.campaigns.list.invalidate();
      utils.campaigns.stats.invalidate();
      resetForm();
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e.message || "Failed to launch campaign");
    } finally {
      setIsSubmitting(false);
    }
  };

  // ─── Preview: replace merge tags with sample data ───
  const previewBody = useMemo(() => {
    let text = body;
    text = text.replace(/\{\{first_name\}\}/g, "John");
    text = text.replace(/\{\{last_name\}\}/g, "Smith");
    text = text.replace(/\{\{agent_name\}\}/g, "Your Name");
    text = text.replace(/\{\{company_name\}\}/g, "Your Company");
    text = text.replace(/\{\{email\}\}/g, "john@example.com");
    text = text.replace(/\{\{phone\}\}/g, "(555) 123-4567");
    // Also handle camelCase variants from old merge tags
    text = text.replace(/\{\{firstName\}\}/g, "John");
    text = text.replace(/\{\{lastName\}\}/g, "Smith");
    text = text.replace(/\{\{company\}\}/g, "Your Company");
    return text;
  }, [body]);

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) resetForm();
        onOpenChange(v);
      }}
    >
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Send className="h-5 w-5 text-primary" />
            Campaign Builder
          </DialogTitle>
          <DialogDescription>
            {STEP_LABELS[step - 1]}
          </DialogDescription>
        </DialogHeader>

        {/* ─── Step Indicator ─── */}
        <div className="flex items-center gap-1 px-1 py-2">
          {STEP_LABELS.map((label, i) => {
            const stepNum = i + 1;
            const isActive = step === stepNum;
            const isComplete = step > stepNum;
            return (
              <div key={label} className="flex items-center gap-1 flex-1">
                <div
                  className={`flex items-center justify-center h-7 w-7 rounded-full text-xs font-medium shrink-0 transition-colors ${
                    isActive
                      ? "bg-primary text-primary-foreground"
                      : isComplete
                        ? "bg-emerald-500/20 text-emerald-400 border border-emerald-200"
                        : "bg-muted/30 text-muted-foreground border border-border/30"
                  }`}
                >
                  {isComplete ? <Check className="h-3.5 w-3.5" /> : stepNum}
                </div>
                <span
                  className={`text-[10px] hidden sm:block truncate ${
                    isActive ? "text-foreground font-medium" : "text-muted-foreground"
                  }`}
                >
                  {label}
                </span>
                {i < STEP_LABELS.length - 1 && (
                  <ChevronRight className="h-3 w-3 text-muted-foreground/40 shrink-0" />
                )}
              </div>
            );
          })}
        </div>

        {/* ─── Step Content ─── */}
        <div className="flex-1 overflow-y-auto px-1 py-2 min-h-0">
          {/* ═══ STEP 1: Campaign Type ═══ */}
          {step === 1 && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Choose the type of campaign you want to create.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Card
                  className={`cursor-pointer transition-all hover:border-primary/50 ${
                    campaignType === "email"
                      ? "border-primary bg-primary/5 ring-1 ring-primary/20"
                      : "border-border/50"
                  }`}
                  onClick={() => setCampaignType("email")}
                >
                  <CardContent className="pt-6 pb-6 flex flex-col items-center gap-3">
                    <div
                      className={`h-14 w-14 rounded-xl flex items-center justify-center ${
                        campaignType === "email"
                          ? "bg-primary/15 text-primary"
                          : "bg-muted/30 text-muted-foreground"
                      }`}
                    >
                      <Mail className="h-7 w-7" />
                    </div>
                    <div className="text-center">
                      <p className="font-semibold">Email Campaign</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Send personalized emails with subject lines, rich content, and merge tags.
                      </p>
                    </div>
                    {campaignType === "email" && (
                      <Badge className="bg-primary/15 text-primary border-primary/30 text-[10px]">
                        <Check className="h-2.5 w-2.5 mr-0.5" /> Selected
                      </Badge>
                    )}
                  </CardContent>
                </Card>

                <Card
                  className={`cursor-pointer transition-all hover:border-primary/50 ${
                    campaignType === "sms"
                      ? "border-primary bg-primary/5 ring-1 ring-primary/20"
                      : "border-border/50"
                  }`}
                  onClick={() => setCampaignType("sms")}
                >
                  <CardContent className="pt-6 pb-6 flex flex-col items-center gap-3">
                    <div
                      className={`h-14 w-14 rounded-xl flex items-center justify-center ${
                        campaignType === "sms"
                          ? "bg-primary/15 text-primary"
                          : "bg-muted/30 text-muted-foreground"
                      }`}
                    >
                      <MessageSquare className="h-7 w-7" />
                    </div>
                    <div className="text-center">
                      <p className="font-semibold">SMS Campaign</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Send text messages to contacts with personalized merge tags.
                      </p>
                    </div>
                    {campaignType === "sms" && (
                      <Badge className="bg-primary/15 text-primary border-primary/30 text-[10px]">
                        <Check className="h-2.5 w-2.5 mr-0.5" /> Selected
                      </Badge>
                    )}
                  </CardContent>
                </Card>
              </div>
            </div>
          )}

          {/* ═══ STEP 2: Select Template ═══ */}
          {step === 2 && (
            <div className="space-y-4">
              {/* Campaign name */}
              <div className="space-y-1.5">
                <Label className="text-xs">Campaign Name *</Label>
                <Input
                  value={campaignName}
                  onChange={(e) => setCampaignName(e.target.value)}
                  placeholder="e.g. Spring Mortgage Promo"
                  className="h-9 text-sm"
                />
              </div>

              {/* Email Template Builder templates (for email campaigns) */}
              {campaignType === "email" && emailTemplates && emailTemplates.length > 0 && (
                <div className="space-y-2">
                  <Label className="text-xs">Use a Designed Email Template</Label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[140px] overflow-y-auto pr-1">
                    {emailTemplates.map((et: any) => (
                      <Card
                        key={`et-${et.id}`}
                        className={`cursor-pointer transition-all hover:border-primary/50 ${
                          selectedEmailTemplateId === et.id
                            ? "border-primary bg-primary/5 ring-1 ring-primary/20"
                            : "border-border/50"
                        }`}
                        onClick={() => handleEmailTemplateSelect(et)}
                      >
                        <CardContent className="pt-3 pb-3">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-1.5">
                                <Palette className="h-3.5 w-3.5 text-primary shrink-0" />
                                <p className="text-sm font-medium truncate">{et.name}</p>
                              </div>
                              {et.subject && (
                                <p className="text-[10px] text-muted-foreground mt-0.5 truncate">
                                  {et.subject}
                                </p>
                              )}
                              <Badge variant="outline" className="text-[9px] mt-1.5 bg-primary/10 text-primary border-primary/30">
                                Rich HTML Template
                              </Badge>
                            </div>
                            {selectedEmailTemplateId === et.id && (
                              <Check className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              )}

              {/* Template grid */}
              <div className="space-y-2">
                <Label className="text-xs">{campaignType === "email" && emailTemplates && emailTemplates.length > 0 ? "Or Choose a Quick Template" : "Choose a Template"}</Label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[200px] overflow-y-auto pr-1">
                  {filteredTemplates.map((t: any) => (
                    <Card
                      key={t.id}
                      className={`cursor-pointer transition-all hover:border-primary/50 ${
                        selectedTemplateId === t.id
                          ? "border-primary bg-primary/5 ring-1 ring-primary/20"
                          : "border-border/50"
                      }`}
                      onClick={() => handleTemplateSelect(t)}
                    >
                      <CardContent className="pt-3 pb-3">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium truncate">{t.name}</p>
                            {t.subject && (
                              <p className="text-[10px] text-muted-foreground mt-0.5 truncate">
                                {t.subject}
                              </p>
                            )}
                            <p className="text-[10px] text-muted-foreground mt-1 line-clamp-2">
                              {t.body.slice(0, 100)}...
                            </p>
                          </div>
                          {selectedTemplateId === t.id && (
                            <Check className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                          )}
                        </div>
                        {t.accountId === 0 && (
                          <Badge variant="outline" className="text-[9px] mt-2 bg-amber-500/10 text-amber-600 border-amber-200">
                            Prebuilt
                          </Badge>
                        )}
                      </CardContent>
                    </Card>
                  ))}

                  {/* Custom message card */}
                  <Card
                    className={`cursor-pointer transition-all hover:border-primary/50 ${
                      customMessage
                        ? "border-primary bg-primary/5 ring-1 ring-primary/20"
                        : "border-border/50 border-dashed"
                    }`}
                    onClick={handleCustomMessage}
                  >
                    <CardContent className="pt-3 pb-3 flex flex-col items-center justify-center h-full gap-2">
                      <FileText className="h-6 w-6 text-muted-foreground" />
                      <p className="text-sm font-medium">Write Custom</p>
                      <p className="text-[10px] text-muted-foreground text-center">
                        Create your own message from scratch
                      </p>
                      {customMessage && (
                        <Check className="h-4 w-4 text-primary" />
                      )}
                    </CardContent>
                  </Card>
                </div>
              </div>

              {/* Email template preview when selected */}
              {useEmailTemplate && selectedEmailTemplateId && (
                <div className="space-y-3 border-t border-border/20 pt-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Palette className="h-4 w-4 text-primary" />
                      <span className="text-sm font-medium">Rich HTML Template Selected</span>
                    </div>
                    <Badge variant="outline" className="text-[9px] bg-emerald-500/10 text-emerald-400 border-emerald-200">
                      Template will render with contact data
                    </Badge>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs">Subject Line (optional override)</Label>
                      <Input
                        value={subject}
                        onChange={(e) => setSubject(e.target.value)}
                        placeholder="Leave empty to use template subject"
                        className="h-9 text-sm"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">From Address</Label>
                      <Input
                        value={fromAddress}
                        onChange={(e) => setFromAddress(e.target.value)}
                        placeholder="team@company.com"
                        className="h-9 text-sm"
                      />
                    </div>
                  </div>
                  <p className="text-[10px] text-muted-foreground">
                    Merge tags like {"{{contact.firstName}}"} in the template will be replaced with each contact's data when sent.
                  </p>
                </div>
              )}

              {/* Template preview / editor */}
              {(selectedTemplateId || customMessage) && !useEmailTemplate && (
                <div className="space-y-3 border-t border-border/20 pt-3">
                  {campaignType === "email" && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <Label className="text-xs">Subject Line *</Label>
                        <Input
                          value={subject}
                          onChange={(e) => setSubject(e.target.value)}
                          placeholder="Email subject"
                          className="h-9 text-sm"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs">From Address</Label>
                        <Input
                          value={fromAddress}
                          onChange={(e) => setFromAddress(e.target.value)}
                          placeholder="team@company.com"
                          className="h-9 text-sm"
                        />
                      </div>
                    </div>
                  )}

                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs">Message Body *</Label>
                      <div className="flex gap-1 flex-wrap">
                        {MERGE_TAGS.map((mt) => (
                          <Button
                            key={mt.tag}
                            variant="outline"
                            size="sm"
                            className="h-5 text-[9px] px-1.5 border-border/50"
                            onClick={() => setBody((b) => b + mt.tag)}
                          >
                            {mt.label}
                          </Button>
                        ))}
                      </div>
                    </div>
                    <Textarea
                      value={body}
                      onChange={(e) => setBody(e.target.value)}
                      placeholder="Write your message content..."
                      className="min-h-[120px] text-sm resize-none"
                    />
                    {campaignType === "sms" && (
                      <p className="text-[10px] text-muted-foreground">
                        {body.length}/160 characters
                        {body.length > 160 ? " (multi-segment)" : ""}
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ═══ STEP 3: Select Recipients ═══ */}
          {step === 3 && (
            <div className="space-y-3">
              {/* Filters row */}
              <div className="flex items-center gap-2 flex-wrap">
                <div className="relative flex-1 min-w-[180px]">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    placeholder="Search contacts..."
                    value={contactSearch}
                    onChange={(e) => setContactSearch(e.target.value)}
                    className="pl-8 h-8 text-sm"
                  />
                </div>
                <Select
                  value={statusFilter || "all"}
                  onValueChange={(v) => setStatusFilter(v === "all" ? "" : v)}
                >
                  <SelectTrigger className="w-[130px] h-8 text-xs border-border/50">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    {CONTACT_STATUSES.map((s) => (
                      <SelectItem key={s} value={s}>
                        {s.charAt(0).toUpperCase() + s.slice(1)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {allTags && allTags.length > 0 && (
                  <Select
                    value={tagFilter || "all"}
                    onValueChange={(v) => setTagFilter(v === "all" ? "" : v)}
                  >
                    <SelectTrigger className="w-[130px] h-8 text-xs border-border/50">
                      <SelectValue placeholder="Tag" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Tags</SelectItem>
                      {allTags.map((tag: any) => (
                        <SelectItem key={tag.tag} value={tag.tag}>
                          {tag.tag} ({tag.count})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
                <Badge variant="secondary" className="text-xs h-8 px-3 flex items-center">
                  <Users className="h-3 w-3 mr-1" />
                  {selectedContacts.length} selected
                </Badge>
              </div>

              {/* Select all / deselect */}
              <div className="flex items-center justify-between">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs gap-1.5"
                  onClick={handleSelectAll}
                >
                  <Checkbox
                    checked={selectAll}
                    className="data-[state=checked]:bg-primary h-3.5 w-3.5"
                  />
                  {selectAll ? "Deselect All" : "Select All Eligible"}
                </Button>
                {selectedContacts.length > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs text-muted-foreground"
                    onClick={() => {
                      setSelectedContacts([]);
                      setSelectAll(false);
                    }}
                  >
                    Clear Selection
                  </Button>
                )}
              </div>

              {/* Selected contacts chips */}
              {selectedContacts.length > 0 && selectedContacts.length <= 10 && (
                <div className="flex flex-wrap gap-1.5">
                  {selectedContacts.map((c) => (
                    <Badge
                      key={c.id}
                      variant="secondary"
                      className="text-[10px] gap-1 pr-1"
                    >
                      {c.firstName} {c.lastName}
                      <button
                        onClick={() => toggleContact(c)}
                        className="ml-0.5 hover:text-destructive"
                      >
                        <X className="h-2.5 w-2.5" />
                      </button>
                    </Badge>
                  ))}
                </div>
              )}
              {selectedContacts.length > 10 && (
                <p className="text-xs text-muted-foreground">
                  {selectedContacts.length} contacts selected
                </p>
              )}

              {/* Contact list */}
              <div className="border border-border/30 rounded-lg max-h-[280px] overflow-y-auto">
                {contactsLoading ? (
                  <div className="p-8 text-center">
                    <Loader2 className="h-5 w-5 animate-spin mx-auto text-muted-foreground" />
                  </div>
                ) : contacts.length === 0 ? (
                  <div className="p-8 text-center text-sm text-muted-foreground">
                    No contacts found matching your filters.
                  </div>
                ) : (
                  contacts.map((contact: any) => {
                    const isSelected = selectedContacts.some((c) => c.id === contact.id);
                    const hasAddress =
                      campaignType === "email" ? !!contact.email : !!contact.phone;
                    return (
                      <div
                        key={contact.id}
                        className={`flex items-center gap-3 px-3 py-2.5 border-b border-border/20 last:border-0 transition-colors ${
                          isSelected
                            ? "bg-primary/5"
                            : "hover:bg-muted/20"
                        } ${!hasAddress ? "opacity-40" : "cursor-pointer"}`}
                        onClick={() => hasAddress && toggleContact(contact)}
                      >
                        <Checkbox
                          checked={isSelected}
                          disabled={!hasAddress}
                          className="data-[state=checked]:bg-primary h-4 w-4"
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium">
                            {contact.firstName} {contact.lastName}
                          </p>
                          <p className="text-[11px] text-muted-foreground">
                            {campaignType === "email"
                              ? contact.email || "No email address"
                              : contact.phone || "No phone number"}
                          </p>
                        </div>
                        <Badge
                          variant="outline"
                          className="text-[9px] capitalize shrink-0"
                        >
                          {contact.status}
                        </Badge>
                        {!hasAddress && (
                          <span className="text-[9px] text-destructive shrink-0">
                            Missing {campaignType === "email" ? "email" : "phone"}
                          </span>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}

          {/* ═══ STEP 4: Review Campaign ═══ */}
          {step === 4 && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Review your campaign details before proceeding.
              </p>

              {/* Campaign summary */}
              <Card className="border-border/50">
                <CardContent className="pt-4 pb-4 space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                        Campaign Name
                      </p>
                      <p className="text-sm font-medium mt-0.5">{campaignName}</p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                        Type
                      </p>
                      <Badge
                        variant="outline"
                        className={`mt-1 text-[10px] ${
                          campaignType === "email"
                            ? "bg-blue-500/10 text-blue-600 border-blue-200"
                            : "bg-purple-500/10 text-purple-600 border-purple-200"
                        }`}
                      >
                        {campaignType === "email" ? (
                          <Mail className="h-2.5 w-2.5 mr-0.5" />
                        ) : (
                          <MessageSquare className="h-2.5 w-2.5 mr-0.5" />
                        )}
                        {campaignType?.toUpperCase()}
                      </Badge>
                    </div>
                    {campaignType === "email" && subject && (
                      <div className="col-span-2">
                        <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                          Subject Line
                        </p>
                        <p className="text-sm mt-0.5">{subject}</p>
                      </div>
                    )}
                    <div>
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                        Recipients
                      </p>
                      <p className="text-sm font-medium mt-0.5 flex items-center gap-1">
                        <Users className="h-3.5 w-3.5 text-muted-foreground" />
                        {selectedContacts.length} contacts
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                        Template
                      </p>
                      <p className="text-sm mt-0.5">
                        {selectedTemplate ? selectedTemplate.name : "Custom Message"}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Message preview */}
              <div className="space-y-1.5">
                <div className="flex items-center gap-1.5">
                  <Eye className="h-3.5 w-3.5 text-muted-foreground" />
                  <Label className="text-xs">Message Preview</Label>
                  <span className="text-[10px] text-muted-foreground">(with sample data)</span>
                </div>
                <div className="p-4 rounded-lg border border-border/30 bg-muted/10">
                  {campaignType === "email" && subject && (
                    <div className="mb-3 pb-3 border-b border-border/20">
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                        Subject
                      </p>
                      <p className="text-sm font-medium mt-0.5">{subject}</p>
                    </div>
                  )}
                  <div className="text-sm whitespace-pre-wrap leading-relaxed max-h-[200px] overflow-y-auto">
                    {previewBody || "No message content"}
                  </div>
                </div>
              </div>

              {/* Recipient preview */}
              <div className="space-y-1.5">
                <Label className="text-xs">Recipients ({selectedContacts.length})</Label>
                <div className="flex flex-wrap gap-1.5 max-h-[80px] overflow-y-auto">
                  {selectedContacts.slice(0, 20).map((c) => (
                    <Badge key={c.id} variant="outline" className="text-[10px]">
                      {c.firstName} {c.lastName}
                    </Badge>
                  ))}
                  {selectedContacts.length > 20 && (
                    <Badge variant="secondary" className="text-[10px]">
                      +{selectedContacts.length - 20} more
                    </Badge>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ═══ STEP 5: Send Options ═══ */}
          {step === 5 && (
            <div className="space-y-5">
              <p className="text-sm text-muted-foreground">
                Choose when to send your campaign.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Card
                  className={`cursor-pointer transition-all hover:border-primary/50 ${
                    sendOption === "now"
                      ? "border-primary bg-primary/5 ring-1 ring-primary/20"
                      : "border-border/50"
                  }`}
                  onClick={() => setSendOption("now")}
                >
                  <CardContent className="pt-6 pb-6 flex flex-col items-center gap-3">
                    <div
                      className={`h-12 w-12 rounded-xl flex items-center justify-center ${
                        sendOption === "now"
                          ? "bg-primary/15 text-primary"
                          : "bg-muted/30 text-muted-foreground"
                      }`}
                    >
                      <Play className="h-6 w-6" />
                    </div>
                    <div className="text-center">
                      <p className="font-semibold text-sm">Send Immediately</p>
                      <p className="text-[11px] text-muted-foreground mt-1">
                        Campaign will be sent to all {selectedContacts.length} recipients right now.
                      </p>
                    </div>
                    {sendOption === "now" && (
                      <Badge className="bg-primary/15 text-primary border-primary/30 text-[10px]">
                        <Check className="h-2.5 w-2.5 mr-0.5" /> Selected
                      </Badge>
                    )}
                  </CardContent>
                </Card>

                <Card
                  className={`cursor-pointer transition-all hover:border-primary/50 ${
                    sendOption === "scheduled"
                      ? "border-primary bg-primary/5 ring-1 ring-primary/20"
                      : "border-border/50"
                  }`}
                  onClick={() => setSendOption("scheduled")}
                >
                  <CardContent className="pt-6 pb-6 flex flex-col items-center gap-3">
                    <div
                      className={`h-12 w-12 rounded-xl flex items-center justify-center ${
                        sendOption === "scheduled"
                          ? "bg-primary/15 text-primary"
                          : "bg-muted/30 text-muted-foreground"
                      }`}
                    >
                      <Calendar className="h-6 w-6" />
                    </div>
                    <div className="text-center">
                      <p className="font-semibold text-sm">Schedule for Later</p>
                      <p className="text-[11px] text-muted-foreground mt-1">
                        Pick a date and time to send the campaign automatically.
                      </p>
                    </div>
                    {sendOption === "scheduled" && (
                      <Badge className="bg-primary/15 text-primary border-primary/30 text-[10px]">
                        <Check className="h-2.5 w-2.5 mr-0.5" /> Selected
                      </Badge>
                    )}
                  </CardContent>
                </Card>
              </div>

              {sendOption === "scheduled" && (
                <Card className="border-border/50">
                  <CardContent className="pt-4 pb-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <Label className="text-xs flex items-center gap-1">
                          <Calendar className="h-3 w-3" /> Date *
                        </Label>
                        <Input
                          type="date"
                          value={scheduledDate}
                          onChange={(e) => setScheduledDate(e.target.value)}
                          className="h-9 text-sm"
                          min={new Date().toISOString().split("T")[0]}
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs flex items-center gap-1">
                          <Clock className="h-3 w-3" /> Time *
                        </Label>
                        <Input
                          type="time"
                          value={scheduledTime}
                          onChange={(e) => setScheduledTime(e.target.value)}
                          className="h-9 text-sm"
                        />
                      </div>
                    </div>
                    {scheduledDate && scheduledTime && (
                      <p className="text-xs text-muted-foreground mt-3">
                        Campaign will be sent on{" "}
                        <span className="text-foreground font-medium">
                          {new Date(`${scheduledDate}T${scheduledTime}`).toLocaleString()}
                        </span>
                      </p>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* Final summary */}
              <Card className="border-amber-500/20 bg-amber-500/5">
                <CardContent className="pt-3 pb-3">
                  <div className="flex items-start gap-2">
                    <Send className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
                    <div className="text-xs">
                      <p className="font-medium text-amber-600">Ready to launch</p>
                      <p className="text-muted-foreground mt-0.5">
                        {campaignType === "email" ? "Email" : "SMS"} campaign "{campaignName}" will be{" "}
                        {sendOption === "now" ? "sent immediately" : "scheduled"} to{" "}
                        <span className="text-foreground font-medium">
                          {selectedContacts.length} recipients
                        </span>
                        .
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </div>

        {/* ─── Footer Navigation ─── */}
        <DialogFooter className="gap-2 pt-2 border-t border-border/20">
          <div className="flex items-center justify-between w-full">
            <div>
              {step > 1 && (
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5"
                  onClick={() => setStep((s) => s - 1)}
                  disabled={isSubmitting}
                >
                  Back
                </Button>
              )}
            </div>
            <div className="flex gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  resetForm();
                  onOpenChange(false);
                }}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              {step < 5 ? (
                <Button
                  size="sm"
                  className="gap-1.5"
                  disabled={!canProceed()}
                  onClick={() => setStep((s) => s + 1)}
                >
                  Next
                  <ChevronRight className="h-3.5 w-3.5" />
                </Button>
              ) : (
                <Button
                  size="sm"
                  className="gap-1.5"
                  disabled={!canProceed() || isSubmitting}
                  onClick={handleLaunch}
                >
                  {isSubmitting ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : sendOption === "now" ? (
                    <Send className="h-3.5 w-3.5" />
                  ) : (
                    <Calendar className="h-3.5 w-3.5" />
                  )}
                  {isSubmitting
                    ? "Launching..."
                    : sendOption === "now"
                      ? "Send Campaign"
                      : "Schedule Campaign"}
                </Button>
              )}
            </div>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
