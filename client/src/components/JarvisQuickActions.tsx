import { useState, useCallback } from "react";
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import {
  BarChart3,
  UserSearch,
  ListTodo,
  PenLine,
  Calendar,
  TrendingUp,
  Zap,
  ChevronRight,
} from "lucide-react";
import { toast } from "sonner";

interface QuickActionProps {
  onSubmitPrompt: (prompt: string) => void;
  disabled?: boolean;
}

// ── Report option definitions ──

interface ReportSubOption {
  label: string;
  prompt: string;
}

interface ReportOption {
  id: string;
  label: string;
  icon: typeof Calendar;
  description: string;
  subOptions?: ReportSubOption[];
  /** If no subOptions, clicking fires this prompt directly */
  directPrompt?: string;
}

const REPORT_OPTIONS: ReportOption[] = [
  {
    id: "daily_activity",
    label: "Daily Activity",
    icon: Calendar,
    description: "Yesterday's activity (Fri–Sun on Monday)",
    directPrompt: "Show me the daily activity report",
  },
  {
    id: "pipeline_summary",
    label: "Pipeline Summary",
    icon: TrendingUp,
    description: "Deals, stages, velocity & at-risk",
    subOptions: [
      { label: "Last 7 days", prompt: "Show me a pipeline summary for the last 7 days" },
      { label: "Last 30 days", prompt: "Show me a pipeline summary for the last 30 days" },
      { label: "This month", prompt: "Show me a pipeline summary for this month" },
      { label: "This quarter", prompt: "Show me a pipeline summary for this quarter" },
    ],
  },
  {
    id: "usage_report",
    label: "Usage Report",
    icon: Zap,
    description: "Billing & usage breakdown",
    subOptions: [
      { label: "Today", prompt: "Show me my usage report for today" },
      { label: "This week", prompt: "Show me my usage report for this week" },
      { label: "This month", prompt: "Show me my usage report for this month" },
    ],
  },
];

// ── Stub chips ──

interface ChipDef {
  id: string;
  label: string;
  icon: typeof BarChart3;
  enabled: boolean;
}

const QUICK_CHIPS: ChipDef[] = [
  { id: "reports", label: "Reports", icon: BarChart3, enabled: true },
  { id: "ask_contact", label: "Ask about a contact", icon: UserSearch, enabled: false },
  { id: "create_task", label: "Create a task", icon: ListTodo, enabled: false },
  { id: "draft_message", label: "Draft a message", icon: PenLine, enabled: false },
];

export default function JarvisQuickActions({ onSubmitPrompt, disabled }: QuickActionProps) {
  const [reportsOpen, setReportsOpen] = useState(false);
  const [expandedOption, setExpandedOption] = useState<string | null>(null);

  const handleReportSelect = useCallback(
    (prompt: string) => {
      setReportsOpen(false);
      setExpandedOption(null);
      onSubmitPrompt(prompt);
    },
    [onSubmitPrompt]
  );

  const handleStubClick = useCallback(() => {
    toast.info("Feature coming soon");
  }, []);

  return (
    <div
      className="flex flex-wrap gap-1.5 mt-2"
      data-testid="jarvis-quick-actions"
    >
      {QUICK_CHIPS.map((chip) => {
        if (chip.id === "reports") {
          return (
            <Popover
              key={chip.id}
              open={reportsOpen}
              onOpenChange={(open) => {
                setReportsOpen(open);
                if (!open) setExpandedOption(null);
              }}
            >
              <PopoverTrigger asChild>
                <button
                  type="button"
                  disabled={disabled}
                  data-testid="chip-reports"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-full border border-border bg-background text-foreground hover:bg-muted/60 hover:border-primary/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <chip.icon className="h-3.5 w-3.5" />
                  {chip.label}
                </button>
              </PopoverTrigger>
              <PopoverContent
                align="start"
                sideOffset={6}
                className="w-72 p-0"
                data-testid="reports-picker"
              >
                <div className="p-2">
                  <p className="text-xs font-semibold text-muted-foreground px-2 py-1.5 uppercase tracking-wide">
                    Generate Report
                  </p>
                  {REPORT_OPTIONS.map((opt) => (
                    <div key={opt.id}>
                      <button
                        type="button"
                        data-testid={`report-option-${opt.id}`}
                        className="w-full flex items-center gap-2.5 px-2 py-2 rounded-md hover:bg-muted/60 transition-colors text-left group"
                        onClick={() => {
                          if (opt.directPrompt) {
                            handleReportSelect(opt.directPrompt);
                          } else {
                            setExpandedOption(
                              expandedOption === opt.id ? null : opt.id
                            );
                          }
                        }}
                      >
                        <div className="h-7 w-7 rounded-md bg-primary/10 flex items-center justify-center flex-shrink-0">
                          <opt.icon className="h-3.5 w-3.5 text-primary" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-foreground">
                            {opt.label}
                          </p>
                          <p className="text-xs text-muted-foreground truncate">
                            {opt.description}
                          </p>
                        </div>
                        {opt.subOptions && (
                          <ChevronRight
                            className={`h-3.5 w-3.5 text-muted-foreground transition-transform ${
                              expandedOption === opt.id ? "rotate-90" : ""
                            }`}
                          />
                        )}
                      </button>

                      {/* Sub-options */}
                      {opt.subOptions && expandedOption === opt.id && (
                        <div className="ml-9 mb-1 space-y-0.5" data-testid={`suboptions-${opt.id}`}>
                          {opt.subOptions.map((sub) => (
                            <button
                              key={sub.label}
                              type="button"
                              data-testid={`suboption-${opt.id}-${sub.label.toLowerCase().replace(/\s+/g, "-")}`}
                              className="w-full text-left px-2.5 py-1.5 text-xs rounded-md hover:bg-muted/60 text-foreground transition-colors"
                              onClick={() => handleReportSelect(sub.prompt)}
                            >
                              {sub.label}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </PopoverContent>
            </Popover>
          );
        }

        // Stub chips — disabled with coming-soon toast
        return (
          <button
            key={chip.id}
            type="button"
            data-testid={`chip-${chip.id}`}
            onClick={handleStubClick}
            disabled={disabled}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-full border border-border bg-background text-muted-foreground opacity-60 hover:opacity-80 cursor-default transition-opacity disabled:opacity-40"
          >
            <chip.icon className="h-3.5 w-3.5" />
            {chip.label}
          </button>
        );
      })}
    </div>
  );
}

// Export for testing
export { REPORT_OPTIONS, QUICK_CHIPS };
