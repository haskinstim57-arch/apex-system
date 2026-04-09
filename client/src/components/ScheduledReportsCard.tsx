import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  CalendarClock,
  Plus,
  Pencil,
  Trash2,
  Send,
  Eye,
  Clock,
  Mail,
  CheckCircle2,
  XCircle,
  Loader2,
  X,
} from "lucide-react";
import { toast } from "sonner";

interface Props {
  accountId: number;
}

const REPORT_TYPE_LABELS: Record<string, { label: string; description: string }> = {
  kpis: { label: "Key Performance Indicators", description: "Contacts, messages, calls, pipeline, appointments" },
  campaignROI: { label: "Campaign ROI", description: "Campaign delivery rates and performance" },
  workflowPerformance: { label: "Workflow Performance", description: "Execution counts, completion rates, failures" },
  revenueAttribution: { label: "Revenue Attribution", description: "Revenue by source, deal and invoice totals" },
};

const FREQUENCY_LABELS: Record<string, string> = {
  daily: "Daily",
  weekly: "Weekly",
  monthly: "Monthly",
};

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

const PERIOD_OPTIONS = [
  { value: 7, label: "Last 7 days" },
  { value: 14, label: "Last 14 days" },
  { value: 30, label: "Last 30 days" },
  { value: 60, label: "Last 60 days" },
  { value: 90, label: "Last 90 days" },
];

const TIMEZONE_OPTIONS = [
  "America/New_York", "America/Chicago", "America/Denver", "America/Los_Angeles",
  "America/Phoenix", "America/Anchorage", "Pacific/Honolulu", "UTC",
  "Europe/London", "Europe/Paris", "Asia/Tokyo", "Australia/Sydney",
];

function formatHour(hour: number): string {
  if (hour === 0) return "12:00 AM";
  if (hour === 12) return "12:00 PM";
  if (hour < 12) return `${hour}:00 AM`;
  return `${hour - 12}:00 PM`;
}

export function ScheduledReportsCard({ accountId }: Props) {
  const utils = trpc.useUtils();
  const { data: reports, isLoading } = trpc.scheduledReports.list.useQuery({ accountId });

  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [editingReport, setEditingReport] = useState<any>(null);
  const [deletingReport, setDeletingReport] = useState<any>(null);
  const [previewReport, setPreviewReport] = useState<any>(null);

  // Form state
  const [formName, setFormName] = useState("");
  const [formFrequency, setFormFrequency] = useState<"daily" | "weekly" | "monthly">("weekly");
  const [formDayOfWeek, setFormDayOfWeek] = useState(1);
  const [formDayOfMonth, setFormDayOfMonth] = useState(1);
  const [formSendHour, setFormSendHour] = useState(8);
  const [formTimezone, setFormTimezone] = useState("America/New_York");
  const [formReportTypes, setFormReportTypes] = useState<string[]>(["kpis"]);
  const [formRecipients, setFormRecipients] = useState<string[]>([""]);
  const [formPeriodDays, setFormPeriodDays] = useState(30);

  const createMutation = trpc.scheduledReports.create.useMutation({
    onSuccess: () => {
      utils.scheduledReports.list.invalidate({ accountId });
      setShowCreateDialog(false);
      resetForm();
      toast.success("Report schedule created");
    },
    onError: (err) => toast.error(err.message),
  });

  const updateMutation = trpc.scheduledReports.update.useMutation({
    onSuccess: () => {
      utils.scheduledReports.list.invalidate({ accountId });
      setEditingReport(null);
      resetForm();
      toast.success("Report schedule updated");
    },
    onError: (err) => toast.error(err.message),
  });

  const toggleMutation = trpc.scheduledReports.toggleActive.useMutation({
    onSuccess: () => {
      utils.scheduledReports.list.invalidate({ accountId });
    },
    onError: (err) => toast.error(err.message),
  });

  const deleteMutation = trpc.scheduledReports.delete.useMutation({
    onSuccess: () => {
      utils.scheduledReports.list.invalidate({ accountId });
      setDeletingReport(null);
      toast.success("Report schedule deleted");
    },
    onError: (err) => toast.error(err.message),
  });

  const sendTestMutation = trpc.scheduledReports.sendTest.useMutation({
    onSuccess: (data) => {
      toast.success(`Test report sent to ${data.sentTo}`);
    },
    onError: (err) => toast.error(err.message),
  });

  const { data: previewData, isLoading: previewLoading } = trpc.scheduledReports.preview.useQuery(
    {
      accountId,
      reportTypes: previewReport?.reportTypes ?? ["kpis"],
      periodDays: previewReport?.periodDays ?? 30,
    },
    { enabled: !!previewReport }
  );

  function resetForm() {
    setFormName("");
    setFormFrequency("weekly");
    setFormDayOfWeek(1);
    setFormDayOfMonth(1);
    setFormSendHour(8);
    setFormTimezone("America/New_York");
    setFormReportTypes(["kpis"]);
    setFormRecipients([""]);
    setFormPeriodDays(30);
  }

  function openEdit(report: any) {
    setFormName(report.name);
    setFormFrequency(report.frequency);
    setFormDayOfWeek(report.dayOfWeek ?? 1);
    setFormDayOfMonth(report.dayOfMonth ?? 1);
    setFormSendHour(report.sendHour);
    setFormTimezone(report.timezone);
    setFormReportTypes(report.reportTypes ?? ["kpis"]);
    setFormRecipients(report.recipients?.length ? report.recipients : [""]);
    setFormPeriodDays(report.periodDays);
    setEditingReport(report);
  }

  function toggleReportType(type: string) {
    setFormReportTypes((prev) =>
      prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]
    );
  }

  function addRecipient() {
    setFormRecipients((prev) => [...prev, ""]);
  }

  function removeRecipient(index: number) {
    setFormRecipients((prev) => prev.filter((_, i) => i !== index));
  }

  function updateRecipient(index: number, value: string) {
    setFormRecipients((prev) => prev.map((r, i) => (i === index ? value : r)));
  }

  const validRecipients = useMemo(
    () => formRecipients.filter((r) => r.trim() && r.includes("@")),
    [formRecipients]
  );

  function handleSubmit() {
    if (!formName.trim()) return toast.error("Report name is required");
    if (formReportTypes.length === 0) return toast.error("Select at least one report type");
    if (validRecipients.length === 0) return toast.error("Add at least one valid recipient email");

    const payload = {
      accountId,
      name: formName.trim(),
      frequency: formFrequency,
      dayOfWeek: formFrequency === "weekly" ? formDayOfWeek : undefined,
      dayOfMonth: formFrequency === "monthly" ? formDayOfMonth : undefined,
      sendHour: formSendHour,
      timezone: formTimezone,
      reportTypes: formReportTypes,
      recipients: validRecipients,
      periodDays: formPeriodDays,
    };

    if (editingReport) {
      updateMutation.mutate({ ...payload, id: editingReport.id });
    } else {
      createMutation.mutate(payload);
    }
  }

  const isSubmitting = createMutation.isPending || updateMutation.isPending;

  // ─── Form Dialog Content ───
  const formContent = (
    <div className="space-y-5 max-h-[70vh] overflow-y-auto pr-1">
      {/* Name */}
      <div className="space-y-1.5">
        <Label className="text-xs font-medium">Report Name</Label>
        <Input
          value={formName}
          onChange={(e) => setFormName(e.target.value)}
          placeholder="Weekly Performance Summary"
          className="h-9"
        />
      </div>

      {/* Report Types */}
      <div className="space-y-2">
        <Label className="text-xs font-medium">Report Sections</Label>
        <div className="grid grid-cols-1 gap-2">
          {Object.entries(REPORT_TYPE_LABELS).map(([key, { label, description }]) => (
            <button
              key={key}
              type="button"
              onClick={() => toggleReportType(key)}
              className={`flex items-start gap-3 p-3 rounded-lg border text-left transition-colors ${
                formReportTypes.includes(key)
                  ? "border-[#c9a84c] bg-[#c9a84c]/5"
                  : "border-border hover:border-gray-300"
              }`}
            >
              <div
                className={`mt-0.5 w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 ${
                  formReportTypes.includes(key)
                    ? "bg-[#c9a84c] border-[#c9a84c]"
                    : "border-gray-300"
                }`}
              >
                {formReportTypes.includes(key) && (
                  <CheckCircle2 className="h-3 w-3 text-white" />
                )}
              </div>
              <div>
                <div className="text-sm font-medium">{label}</div>
                <div className="text-xs text-muted-foreground">{description}</div>
              </div>
            </button>
          ))}
        </div>
      </div>

      <Separator />

      {/* Schedule */}
      <div className="space-y-3">
        <Label className="text-xs font-medium">Schedule</Label>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-[11px] text-muted-foreground">Frequency</Label>
            <Select value={formFrequency} onValueChange={(v) => setFormFrequency(v as any)}>
              <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="daily">Daily</SelectItem>
                <SelectItem value="weekly">Weekly</SelectItem>
                <SelectItem value="monthly">Monthly</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {formFrequency === "weekly" && (
            <div className="space-y-1.5">
              <Label className="text-[11px] text-muted-foreground">Day of Week</Label>
              <Select value={String(formDayOfWeek)} onValueChange={(v) => setFormDayOfWeek(Number(v))}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {DAY_NAMES.map((name, i) => (
                    <SelectItem key={i} value={String(i)}>{name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {formFrequency === "monthly" && (
            <div className="space-y-1.5">
              <Label className="text-[11px] text-muted-foreground">Day of Month</Label>
              <Select value={String(formDayOfMonth)} onValueChange={(v) => setFormDayOfMonth(Number(v))}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Array.from({ length: 28 }, (_, i) => (
                    <SelectItem key={i + 1} value={String(i + 1)}>{i + 1}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-1.5">
            <Label className="text-[11px] text-muted-foreground">Send Time</Label>
            <Select value={String(formSendHour)} onValueChange={(v) => setFormSendHour(Number(v))}>
              <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                {Array.from({ length: 24 }, (_, i) => (
                  <SelectItem key={i} value={String(i)}>{formatHour(i)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-[11px] text-muted-foreground">Timezone</Label>
            <Select value={formTimezone} onValueChange={setFormTimezone}>
              <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                {TIMEZONE_OPTIONS.map((tz) => (
                  <SelectItem key={tz} value={tz}>{tz.replace(/_/g, " ")}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Period */}
      <div className="space-y-1.5">
        <Label className="text-xs font-medium">Reporting Period</Label>
        <Select value={String(formPeriodDays)} onValueChange={(v) => setFormPeriodDays(Number(v))}>
          <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
          <SelectContent>
            {PERIOD_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={String(opt.value)}>{opt.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Separator />

      {/* Recipients */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className="text-xs font-medium">Recipients</Label>
          <Button variant="ghost" size="sm" onClick={addRecipient} className="h-7 text-xs">
            <Plus className="h-3 w-3 mr-1" /> Add
          </Button>
        </div>
        <div className="space-y-2">
          {formRecipients.map((email, index) => (
            <div key={index} className="flex items-center gap-2">
              <Input
                value={email}
                onChange={(e) => updateRecipient(index, e.target.value)}
                placeholder="admin@example.com"
                type="email"
                className="h-9 flex-1"
              />
              {formRecipients.length > 1 && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => removeRecipient(index)}
                  className="h-9 w-9 text-muted-foreground hover:text-red-500"
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
          ))}
        </div>
        <p className="text-[11px] text-muted-foreground">Up to 10 recipients per schedule.</p>
      </div>
    </div>
  );

  return (
    <>
      <Card className="bg-card border-0 card-shadow">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <CalendarClock className="h-4 w-4 text-muted-foreground" />
                Scheduled Reports
              </CardTitle>
              <CardDescription className="text-xs mt-1">
                Automatically send analytics summaries to your team on a schedule.
              </CardDescription>
            </div>
            <Button
              size="sm"
              onClick={() => { resetForm(); setShowCreateDialog(true); }}
              className="bg-[#c9a84c] hover:bg-[#b8973f] text-white h-8 text-xs"
            >
              <Plus className="h-3.5 w-3.5 mr-1" /> New Schedule
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin mr-2" /> Loading schedules...
            </div>
          ) : !reports || reports.length === 0 ? (
            <div className="text-center py-8">
              <CalendarClock className="h-8 w-8 text-muted-foreground mx-auto mb-2 opacity-40" />
              <p className="text-sm text-muted-foreground">No scheduled reports yet.</p>
              <p className="text-xs text-muted-foreground mt-1">Create one to automatically receive analytics summaries.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {reports.map((report) => (
                <div
                  key={report.id}
                  className="border rounded-lg p-4 hover:border-gray-300 transition-colors"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium text-sm truncate">{report.name}</span>
                        <Badge
                          variant={report.isActive ? "default" : "secondary"}
                          className={`text-[10px] h-5 ${report.isActive ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-100" : ""}`}
                        >
                          {report.isActive ? "Active" : "Paused"}
                        </Badge>
                      </div>

                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground mt-1.5">
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {FREQUENCY_LABELS[report.frequency]}
                          {report.frequency === "weekly" && report.dayOfWeek != null && ` on ${DAY_NAMES[report.dayOfWeek]}`}
                          {report.frequency === "monthly" && report.dayOfMonth != null && ` on the ${report.dayOfMonth}${["st","nd","rd"][report.dayOfMonth-1] || "th"}`}
                          {` at ${formatHour(report.sendHour)}`}
                        </span>
                        <span className="flex items-center gap-1">
                          <Mail className="h-3 w-3" />
                          {(report.recipients as string[])?.length ?? 0} recipient{((report.recipients as string[])?.length ?? 0) !== 1 ? "s" : ""}
                        </span>
                        <span>
                          {(report.reportTypes as string[])?.length ?? 0} section{((report.reportTypes as string[])?.length ?? 0) !== 1 ? "s" : ""}
                        </span>
                      </div>

                      {/* Last run status */}
                      {report.lastRunAt && (
                        <div className="flex items-center gap-1.5 mt-2 text-xs">
                          {report.lastRunStatus === "success" ? (
                            <CheckCircle2 className="h-3 w-3 text-emerald-500" />
                          ) : (
                            <XCircle className="h-3 w-3 text-red-500" />
                          )}
                          <span className="text-muted-foreground">
                            Last sent {new Date(report.lastRunAt).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
                          </span>
                        </div>
                      )}

                      {report.nextRunAt && report.isActive && (
                        <div className="text-[11px] text-muted-foreground mt-1">
                          Next: {new Date(report.nextRunAt).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-1 flex-shrink-0">
                      <Switch
                        checked={report.isActive}
                        onCheckedChange={(checked) =>
                          toggleMutation.mutate({ accountId, id: report.id, isActive: checked })
                        }
                        className="mr-1"
                      />
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        title="Preview"
                        onClick={() => setPreviewReport(report)}
                      >
                        <Eye className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        title="Send test"
                        disabled={sendTestMutation.isPending}
                        onClick={() => sendTestMutation.mutate({ accountId, id: report.id })}
                      >
                        {sendTestMutation.isPending ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Send className="h-3.5 w-3.5" />
                        )}
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        title="Edit"
                        onClick={() => openEdit(report)}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-red-500 hover:text-red-600"
                        title="Delete"
                        onClick={() => setDeletingReport(report)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>

                  {/* Report type badges */}
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {(report.reportTypes as string[])?.map((type) => (
                      <Badge key={type} variant="outline" className="text-[10px] h-5 font-normal">
                        {REPORT_TYPE_LABELS[type]?.label ?? type}
                      </Badge>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Create Report Schedule</DialogTitle>
            <DialogDescription>
              Configure an automated analytics report to be emailed on a recurring schedule.
            </DialogDescription>
          </DialogHeader>
          {formContent}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>Cancel</Button>
            <Button
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="bg-[#c9a84c] hover:bg-[#b8973f] text-white"
            >
              {isSubmitting && <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />}
              Create Schedule
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={!!editingReport} onOpenChange={(open) => { if (!open) setEditingReport(null); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit Report Schedule</DialogTitle>
            <DialogDescription>
              Update the configuration for this scheduled report.
            </DialogDescription>
          </DialogHeader>
          {formContent}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingReport(null)}>Cancel</Button>
            <Button
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="bg-[#c9a84c] hover:bg-[#b8973f] text-white"
            >
              {isSubmitting && <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deletingReport} onOpenChange={(open) => { if (!open) setDeletingReport(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Report Schedule</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{deletingReport?.name}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteMutation.mutate({ accountId, id: deletingReport.id })}
              className="bg-red-600 hover:bg-red-700"
            >
              {deleteMutation.isPending && <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Preview Dialog */}
      <Dialog open={!!previewReport} onOpenChange={(open) => { if (!open) setPreviewReport(null); }}>
        <DialogContent className="max-w-2xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>Report Preview</DialogTitle>
            <DialogDescription>
              Preview of "{previewReport?.name}" with current data.
            </DialogDescription>
          </DialogHeader>
          <div className="overflow-y-auto max-h-[60vh] border rounded-lg">
            {previewLoading ? (
              <div className="flex items-center justify-center py-12 text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin mr-2" /> Generating preview...
              </div>
            ) : previewData?.html ? (
              <iframe
                srcDoc={previewData.html}
                className="w-full h-[500px] border-0"
                title="Report Preview"
              />
            ) : (
              <div className="text-center py-12 text-muted-foreground">
                No preview available.
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPreviewReport(null)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
