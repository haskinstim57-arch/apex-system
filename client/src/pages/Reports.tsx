import { useState, useMemo } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { useAccount } from "@/contexts/AccountContext";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  FileBarChart,
  Play,
  Download,
  Loader2,
  CalendarDays,
  BarChart3,
  Clock,
  X,
} from "lucide-react";
import { ScheduledReportsCard } from "@/components/ScheduledReportsCard";
import { toast } from "sonner";

export default function Reports() {
  const { user } = useAuth();
  const { currentAccountId, currentAccount } = useAccount();
  const isAdmin = user?.role === "admin";


  // On-demand report state
  const [selectedReportType, setSelectedReportType] = useState<string>("");
  const [selectedPeriod, setSelectedPeriod] = useState<string>("7");
  const [previewHtml, setPreviewHtml] = useState<string>("");
  const [isGenerating, setIsGenerating] = useState(false);

  // Fetch report options
  const { data: options } = trpc.scheduledReports.options.useQuery();

  // Preview query (manual trigger)
  const previewQuery = trpc.scheduledReports.preview.useQuery(
    {
      accountId: currentAccountId!,
      reportTypes: [selectedReportType],
      periodDays: parseInt(selectedPeriod),
    },
    { enabled: false }
  );

  async function handleGenerate() {
    if (!currentAccountId || !selectedReportType) {
      toast.error("Select a report type");
      return;
    }
    setIsGenerating(true);
    setPreviewHtml("");
    try {
      const result = await previewQuery.refetch();
      if (result.data?.html) {
        setPreviewHtml(result.data.html);
      }
    } catch (err: any) {
      toast.error("Failed to generate report: " + err.message);
    } finally {
      setIsGenerating(false);
    }
  }

  function handleDownloadCSV() {
    if (!previewHtml) return;
    // Create a simple text extraction from the HTML for CSV download
    const blob = new Blob([previewHtml], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const reportLabel = options?.reportTypes.find((r) => r.value === selectedReportType)?.label || selectedReportType;
    a.download = `${reportLabel.replace(/\s+/g, "_")}_${selectedPeriod}d_${new Date().toISOString().slice(0, 10)}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success("Report downloaded");
  }

  if (!currentAccountId) {
    return (
      <div className="p-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold tracking-tight">Reports</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Scheduled reports and activity summaries.
          </p>
        </div>
        <Card className="bg-card border-0 card-shadow">
          <CardContent className="py-12 text-center">
            <BarChart3 className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">
              Select a sub-account to view and manage reports.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-8">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Reports</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Scheduled reports and activity summaries.
        </p>
      </div>

      {/* Section 1: Run a Report (on-demand) */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <Play className="h-4 w-4 text-primary" />
          <h2 className="text-lg font-semibold">Run a Report</h2>
        </div>
        <Card className="bg-card border-0 card-shadow">
          <CardContent className="pt-5 pb-5">
            <div className="flex flex-col sm:flex-row gap-3 items-end">
              {/* Report Type */}
              <div className="flex-1 min-w-[200px]">
                <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
                  Report Type
                </label>
                <Select value={selectedReportType} onValueChange={setSelectedReportType}>
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="Choose report type..." />
                  </SelectTrigger>
                  <SelectContent>
                    {options?.reportTypes.map((rt) => (
                      <SelectItem key={rt.value} value={rt.value}>
                        <div className="flex flex-col">
                          <span>{rt.label}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Date Range */}
              {selectedReportType !== "daily_activity" && (
                <div className="min-w-[160px]">
                  <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
                    Date Range
                  </label>
                  <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
                    <SelectTrigger className="h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {options?.periodOptions.map((p) => (
                        <SelectItem key={p.value} value={String(p.value)}>
                          {p.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Generate Button */}
              <Button
                onClick={handleGenerate}
                disabled={!selectedReportType || isGenerating}
                className="h-9 gap-1.5"
              >
                {isGenerating ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Play className="h-3.5 w-3.5" />
                )}
                Generate
              </Button>
            </div>

            {/* Description hint */}
            {selectedReportType && options && (
              <p className="text-xs text-muted-foreground mt-2">
                {options.reportTypes.find((r) => r.value === selectedReportType)?.description}
              </p>
            )}
          </CardContent>
        </Card>

        {/* Preview Area */}
        {previewHtml && (
          <Card className="bg-card border-0 card-shadow mt-4">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FileBarChart className="h-4 w-4 text-primary" />
                  <CardTitle className="text-sm">Report Preview</CardTitle>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs gap-1"
                    onClick={handleDownloadCSV}
                  >
                    <Download className="h-3 w-3" />
                    Download HTML
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0"
                    onClick={() => setPreviewHtml("")}
                  >
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div
                className="border rounded-lg overflow-auto max-h-[600px] bg-white"
                dangerouslySetInnerHTML={{ __html: previewHtml }}
              />
            </CardContent>
          </Card>
        )}
      </div>

      <Separator />

      {/* Section 2: Scheduled Reports */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <Clock className="h-4 w-4 text-primary" />
          <h2 className="text-lg font-semibold">Scheduled Reports</h2>
        </div>
        <ScheduledReportsCard accountId={currentAccountId} />
      </div>
    </div>
  );
}
