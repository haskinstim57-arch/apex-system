import { trpc } from "@/lib/trpc";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock,
  Copy,
  ExternalLink,
  LayoutGrid,
  Link2,
  List,
  Loader2,
  MoreHorizontal,
  Pencil,
  Plus,
  Settings2,
  Trash2,
  X,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { toast } from "sonner";
import { useAccount } from "@/contexts/AccountContext";
import { NoAccountSelected } from "@/components/NoAccountSelected";

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-amber-500/15 text-amber-400 border-amber-500/30",
  confirmed: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  cancelled: "bg-red-500/15 text-red-400 border-red-500/30",
};

const APPOINTMENT_BG: Record<string, string> = {
  pending: "bg-amber-500/20 border-amber-500/40 hover:bg-amber-500/30",
  confirmed: "bg-emerald-500/20 border-emerald-500/40 hover:bg-emerald-500/30",
  cancelled: "bg-red-500/20 border-red-500/40 hover:bg-red-500/30 opacity-50",
};

const TIMEZONES = [
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "America/Phoenix",
  "America/Anchorage",
  "Pacific/Honolulu",
  "UTC",
];

const DAY_NAMES = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"] as const;
const DAY_LABELS: Record<string, string> = {
  monday: "Mon",
  tuesday: "Tue",
  wednesday: "Wed",
  thursday: "Thu",
  friday: "Fri",
  saturday: "Sat",
  sunday: "Sun",
};

type AvailabilityBlock = { start: string; end: string };
type WeeklyAvailability = {
  monday: AvailabilityBlock[];
  tuesday: AvailabilityBlock[];
  wednesday: AvailabilityBlock[];
  thursday: AvailabilityBlock[];
  friday: AvailabilityBlock[];
  saturday: AvailabilityBlock[];
  sunday: AvailabilityBlock[];
};

const DEFAULT_AVAILABILITY: WeeklyAvailability = {
  monday: [{ start: "09:00", end: "17:00" }],
  tuesday: [{ start: "09:00", end: "17:00" }],
  wednesday: [{ start: "09:00", end: "17:00" }],
  thursday: [{ start: "09:00", end: "17:00" }],
  friday: [{ start: "09:00", end: "17:00" }],
  saturday: [],
  sunday: [],
};

// ─── Date helpers ───
function getWeekStart(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay(); // 0=Sun
  d.setDate(d.getDate() - day);
  d.setHours(0, 0, 0, 0);
  return d;
}

function getWeekEnd(date: Date): Date {
  const start = getWeekStart(date);
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  end.setHours(23, 59, 59, 999);
  return end;
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function formatDateRange(start: Date, end: Date): string {
  const opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" };
  const startStr = start.toLocaleDateString("en-US", opts);
  const endStr = end.toLocaleDateString("en-US", { ...opts, year: "numeric" });
  return `${startStr} – ${endStr}`;
}

const GRID_START_HOUR = 6;
const GRID_END_HOUR = 21; // 9PM
const HOURS = Array.from({ length: GRID_END_HOUR - GRID_START_HOUR }, (_, i) => GRID_START_HOUR + i);
const WEEK_DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

// ═══════════════════════════════════════════════
// MAIN PAGE
// ═══════════════════════════════════════════════
export default function CalendarPage() {
  const { currentAccountId } = useAccount();
  const [activeTab, setActiveTab] = useState("grid");
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [editingCalendar, setEditingCalendar] = useState<any>(null);
  const [selectedCalendarId, setSelectedCalendarId] = useState<number | null>(null);

  if (!currentAccountId) return <NoAccountSelected />;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Calendar</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Manage booking calendars and appointments
          </p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="grid">
            <LayoutGrid className="h-4 w-4 mr-1.5" />
            Calendar View
          </TabsTrigger>
          <TabsTrigger value="appointments">
            <List className="h-4 w-4 mr-1.5" />
            Appointments
          </TabsTrigger>
          <TabsTrigger value="calendars">
            <Settings2 className="h-4 w-4 mr-1.5" />
            Calendars
          </TabsTrigger>
        </TabsList>

        <TabsContent value="grid" className="mt-4">
          <CalendarGridView accountId={currentAccountId} />
        </TabsContent>

        <TabsContent value="appointments" className="mt-4">
          <AppointmentsList
            accountId={currentAccountId}
            calendarId={selectedCalendarId}
            onCalendarFilter={setSelectedCalendarId}
          />
        </TabsContent>

        <TabsContent value="calendars" className="mt-4">
          <CalendarsList
            accountId={currentAccountId}
            onCreateNew={() => setShowCreateDialog(true)}
            onEdit={(cal: any) => setEditingCalendar(cal)}
          />
        </TabsContent>
      </Tabs>

      {showCreateDialog && (
        <CalendarFormDialog
          accountId={currentAccountId}
          onClose={() => setShowCreateDialog(false)}
        />
      )}

      {editingCalendar && (
        <CalendarFormDialog
          accountId={currentAccountId}
          calendar={editingCalendar}
          onClose={() => setEditingCalendar(null)}
        />
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════
// CALENDAR GRID VIEW (Week/Day/Month)
// ═══════════════════════════════════════════════
type ViewMode = "week" | "day" | "month";

function CalendarGridView({ accountId }: { accountId: number }) {
  const utils = trpc.useUtils();
  const [currentDate, setCurrentDate] = useState(() => new Date());
  const [viewMode, setViewMode] = useState<ViewMode>("week");
  const [selectedAppt, setSelectedAppt] = useState<any>(null);
  const [newApptSlot, setNewApptSlot] = useState<{ date: Date; hour: number } | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const weekStart = useMemo(() => getWeekStart(currentDate), [currentDate]);
  const weekEnd = useMemo(() => getWeekEnd(currentDate), [currentDate]);

  // Fetch appointments for the visible range
  const { data: appointments = [], isLoading } = trpc.calendar.listAppointments.useQuery(
    {
      accountId,
      startDate: weekStart,
      endDate: weekEnd,
      limit: 200,
    },
    { refetchInterval: 30000 }
  );

  // Fetch external calendar events for overlay
  const timeMinStr = useMemo(() => weekStart.toISOString(), [weekStart]);
  const timeMaxStr = useMemo(() => weekEnd.toISOString(), [weekEnd]);
  const { data: externalEvents = [] } = trpc.calendarSync.listExternalEvents.useQuery(
    {
      accountId,
      timeMin: timeMinStr,
      timeMax: timeMaxStr,
    },
    { refetchInterval: 60000 }
  );

  // Map external events to grid positions
  const externalByDayHour = useMemo(() => {
    const map: Record<string, typeof externalEvents> = {};
    externalEvents.forEach((evt) => {
      const start = new Date(evt.start);
      const dayIdx = start.getDay();
      const hour = start.getHours();
      const key = `${dayIdx}-${hour}`;
      if (!map[key]) map[key] = [];
      map[key].push(evt);
    });
    return map;
  }, [externalEvents]);

  const { data: calendars = [] } = trpc.calendar.list.useQuery({ accountId });
  const calendarMap = useMemo(() => {
    const map: Record<number, { name: string; color: string }> = {};
    const colors = [
      "border-l-amber-400",
      "border-l-emerald-400",
      "border-l-blue-400",
      "border-l-purple-400",
      "border-l-pink-400",
      "border-l-cyan-400",
    ];
    calendars.forEach((c, i) => {
      map[c.id] = { name: c.name, color: colors[i % colors.length] };
    });
    return map;
  }, [calendars]);

  // Scroll to current time on mount
  useEffect(() => {
    if (scrollRef.current) {
      const now = new Date();
      const hourOffset = now.getHours() - GRID_START_HOUR;
      if (hourOffset > 0) {
        scrollRef.current.scrollTop = Math.max(0, hourOffset * 64 - 100);
      }
    }
  }, []);

  const goToday = () => setCurrentDate(new Date());
  const goPrev = () => setCurrentDate((d) => addDays(d, viewMode === "day" ? -1 : -7));
  const goNext = () => setCurrentDate((d) => addDays(d, viewMode === "day" ? 1 : 7));

  const headerLabel = useMemo(() => {
    if (viewMode === "day") {
      return currentDate.toLocaleDateString("en-US", {
        weekday: "long",
        month: "long",
        day: "numeric",
        year: "numeric",
      });
    }
    return formatDateRange(weekStart, weekEnd);
  }, [currentDate, weekStart, weekEnd, viewMode]);

  // Map appointments to grid positions
  const apptsByDayHour = useMemo(() => {
    const map: Record<string, any[]> = {};
    appointments.forEach((appt) => {
      const start = new Date(appt.startTime);
      const dayIdx = start.getDay(); // 0-6
      const hour = start.getHours();
      const key = `${dayIdx}-${hour}`;
      if (!map[key]) map[key] = [];
      map[key].push(appt);
    });
    return map;
  }, [appointments]);

  const visibleDays = useMemo(() => {
    if (viewMode === "day") {
      return [currentDate];
    }
    return Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  }, [viewMode, currentDate, weekStart]);

  const handleSlotClick = (date: Date, hour: number) => {
    setNewApptSlot({ date, hour });
  };

  return (
    <div className="space-y-3">
      {/* Toolbar */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={goToday}>
            Today
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={goPrev}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={goNext}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          <span className="text-sm font-medium ml-1">{headerLabel}</span>
        </div>

        <div className="flex items-center gap-2">
          {isLoading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
          <div className="flex border border-border rounded-md overflow-hidden">
            {(["day", "week", "month"] as ViewMode[]).map((mode) => (
              <button
                key={mode}
                onClick={() => setViewMode(mode)}
                className={`px-3 py-1.5 text-xs font-medium capitalize transition-colors ${
                  viewMode === mode
                    ? "bg-apex-gold text-black"
                    : "bg-card text-muted-foreground hover:text-foreground"
                }`}
              >
                {mode}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Grid */}
      {viewMode === "month" ? (
        <MonthView
          currentDate={currentDate}
          appointments={appointments}
          onDayClick={(d) => {
            setCurrentDate(d);
            setViewMode("day");
          }}
        />
      ) : (
        <Card className="overflow-hidden">
          {/* Day headers */}
          <div
            className="grid border-b border-border"
            style={{
              gridTemplateColumns: `60px repeat(${visibleDays.length}, 1fr)`,
            }}
          >
            <div className="p-2 border-r border-border" />
            {visibleDays.map((day, i) => {
              const isToday = isSameDay(day, new Date());
              return (
                <div
                  key={i}
                  className={`p-2 text-center border-r border-border last:border-r-0 ${
                    isToday ? "bg-apex-gold/5" : ""
                  }`}
                >
                  <div className="text-xs text-muted-foreground">
                    {WEEK_DAYS[day.getDay()]}
                  </div>
                  <div
                    className={`text-lg font-semibold ${
                      isToday
                        ? "text-apex-gold"
                        : "text-foreground"
                    }`}
                  >
                    {day.getDate()}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Time grid */}
          <div
            ref={scrollRef}
            className="overflow-y-auto relative"
            style={{ maxHeight: "calc(100vh - 280px)" }}
          >
            <CurrentTimeLine visibleDays={visibleDays} />
            <div
              className="grid"
              style={{
                gridTemplateColumns: `60px repeat(${visibleDays.length}, 1fr)`,
              }}
            >
              {HOURS.map((hour) => (
                <HourRow
                  key={hour}
                  hour={hour}
                  visibleDays={visibleDays}
                  apptsByDayHour={apptsByDayHour}
                  externalByDayHour={externalByDayHour}
                  calendarMap={calendarMap}
                  onSlotClick={handleSlotClick}
                  onApptClick={setSelectedAppt}
                />
              ))}
            </div>
          </div>
        </Card>
      )}

      {/* Appointment detail dialog */}
      {selectedAppt && (
        <AppointmentDetailDialog
          appointment={selectedAppt}
          accountId={accountId}
          calendarName={calendarMap[selectedAppt.calendarId]?.name || "Calendar"}
          onClose={() => setSelectedAppt(null)}
        />
      )}

      {/* New appointment from slot click */}
      {newApptSlot && (
        <NewAppointmentFromSlotDialog
          accountId={accountId}
          date={newApptSlot.date}
          hour={newApptSlot.hour}
          calendars={calendars}
          onClose={() => setNewApptSlot(null)}
        />
      )}
    </div>
  );
}

// ─── Current time red line ───
function CurrentTimeLine({ visibleDays }: { visibleDays: Date[] }) {
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(interval);
  }, []);

  const isVisible = visibleDays.some((d) => isSameDay(d, now));
  if (!isVisible) return null;

  const dayIndex = visibleDays.findIndex((d) => isSameDay(d, now));
  const minutesSinceGridStart = (now.getHours() - GRID_START_HOUR) * 60 + now.getMinutes();
  const topPx = (minutesSinceGridStart / 60) * 64;

  if (topPx < 0 || topPx > (GRID_END_HOUR - GRID_START_HOUR) * 64) return null;

  const colCount = visibleDays.length;
  const leftPercent = ((dayIndex + 1) / (colCount + 1)) * 100; // +1 for time column offset

  return (
    <div
      className="absolute z-20 pointer-events-none"
      style={{
        top: `${topPx}px`,
        left: "60px",
        right: 0,
      }}
    >
      <div className="relative w-full">
        {/* Red dot */}
        <div
          className="absolute w-2.5 h-2.5 bg-red-500 rounded-full -translate-y-1/2"
          style={{
            left: `calc(${(dayIndex / colCount) * 100}% + 0px)`,
          }}
        />
        {/* Red line */}
        <div className="w-full h-[2px] bg-red-500/70" />
      </div>
    </div>
  );
}

// ─── Hour Row ───
type ExternalEvent = { provider: string; id: string; title: string; start: string; end: string; allDay: boolean };

function HourRow({
  hour,
  visibleDays,
  apptsByDayHour,
  externalByDayHour,
  calendarMap,
  onSlotClick,
  onApptClick,
}: {
  hour: number;
  visibleDays: Date[];
  apptsByDayHour: Record<string, any[]>;
  externalByDayHour?: Record<string, ExternalEvent[]>;
  calendarMap: Record<number, { name: string; color: string }>;
  onSlotClick: (date: Date, hour: number) => void;
  onApptClick: (appt: any) => void;
}) {
  const timeLabel =
    hour === 0
      ? "12 AM"
      : hour < 12
      ? `${hour} AM`
      : hour === 12
      ? "12 PM"
      : `${hour - 12} PM`;

  return (
    <>
      {/* Time label */}
      <div className="h-16 border-b border-r border-border px-2 flex items-start pt-0.5">
        <span className="text-[11px] text-muted-foreground -mt-1.5">{timeLabel}</span>
      </div>

      {/* Day cells */}
      {visibleDays.map((day, dayIdx) => {
        const dayOfWeek = day.getDay();
        const key = `${dayOfWeek}-${hour}`;
        const appts = apptsByDayHour[key] || [];
        const isToday = isSameDay(day, new Date());

        return (
          <div
            key={dayIdx}
            className={`h-16 border-b border-r border-border last:border-r-0 relative cursor-pointer transition-colors hover:bg-card/80 ${
              isToday ? "bg-apex-gold/[0.02]" : ""
            }`}
            onClick={() => onSlotClick(day, hour)}
          >
            {appts
              .filter((a) => a.status !== "cancelled")
              .map((appt) => {
                const start = new Date(appt.startTime);
                const end = new Date(appt.endTime);
                const startMin = start.getMinutes();
                const durationMin = (end.getTime() - start.getTime()) / 60000;
                const topOffset = (startMin / 60) * 100;
                const heightPct = Math.min((durationMin / 60) * 100, 200);
                const calInfo = calendarMap[appt.calendarId];

                return (
                  <div
                    key={appt.id}
                    className={`absolute left-0.5 right-0.5 rounded-sm border-l-[3px] px-1.5 py-0.5 text-[11px] leading-tight overflow-hidden cursor-pointer z-10 ${
                      APPOINTMENT_BG[appt.status] || ""
                    } ${calInfo?.color || "border-l-amber-400"}`}
                    style={{
                      top: `${topOffset}%`,
                      height: `${heightPct}%`,
                      minHeight: "20px",
                    }}
                    onClick={(e) => {
                      e.stopPropagation();
                      onApptClick(appt);
                    }}
                  >
                    <div className="font-medium truncate text-foreground">
                      {appt.guestName}
                    </div>
                    {durationMin >= 30 && (
                      <div className="text-muted-foreground truncate">
                        {start.toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </div>
                    )}
                  </div>
                );
              })}

            {/* External calendar events overlay */}
            {(externalByDayHour?.[key] || []).map((evt) => {
              const evtStart = new Date(evt.start);
              const evtEnd = new Date(evt.end);
              const startMin = evtStart.getMinutes();
              const durationMin = (evtEnd.getTime() - evtStart.getTime()) / 60000;
              const topOffset = (startMin / 60) * 100;
              const heightPct = Math.min((durationMin / 60) * 100, 200);
              const providerColor = evt.provider === "google"
                ? "border-l-blue-400 bg-blue-500/10"
                : "border-l-sky-400 bg-sky-500/10";

              return (
                <div
                  key={`ext-${evt.id}`}
                  className={`absolute left-0.5 right-0.5 rounded-sm border-l-[3px] px-1.5 py-0.5 text-[11px] leading-tight overflow-hidden z-[5] pointer-events-none opacity-70 ${providerColor}`}
                  style={{
                    top: `${topOffset}%`,
                    height: `${heightPct}%`,
                    minHeight: "18px",
                  }}
                  title={`${evt.provider === "google" ? "Google" : "Outlook"}: ${evt.title}`}
                >
                  <div className="font-medium truncate text-muted-foreground">
                    {evt.title || "Busy"}
                  </div>
                  {durationMin >= 30 && (
                    <div className="text-muted-foreground/70 truncate text-[10px]">
                      {evt.provider === "google" ? "Google" : "Outlook"}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        );
      })}
    </>
  );
}

// ─── Month View ───
function MonthView({
  currentDate,
  appointments,
  onDayClick,
}: {
  currentDate: Date;
  appointments: any[];
  onDayClick: (date: Date) => void;
}) {
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const startDow = firstDay.getDay();
  const daysInMonth = lastDay.getDate();

  const apptsByDate = useMemo(() => {
    const map: Record<string, number> = {};
    appointments.forEach((a) => {
      const d = new Date(a.startTime);
      const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
      map[key] = (map[key] || 0) + 1;
    });
    return map;
  }, [appointments]);

  const cells: (number | null)[] = [];
  for (let i = 0; i < startDow; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);

  const today = new Date();

  return (
    <Card className="overflow-hidden">
      <div className="grid grid-cols-7 border-b border-border">
        {WEEK_DAYS.map((d) => (
          <div key={d} className="p-2 text-center text-xs font-medium text-muted-foreground border-r border-border last:border-r-0">
            {d}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {cells.map((day, i) => {
          if (day === null) {
            return <div key={i} className="h-20 border-b border-r border-border last:border-r-0 bg-card/30" />;
          }
          const date = new Date(year, month, day);
          const isToday = isSameDay(date, today);
          const key = `${year}-${month}-${day}`;
          const count = apptsByDate[key] || 0;

          return (
            <div
              key={i}
              className={`h-20 border-b border-r border-border last:border-r-0 p-1.5 cursor-pointer transition-colors hover:bg-card/80 ${
                isToday ? "bg-apex-gold/5" : ""
              }`}
              onClick={() => onDayClick(date)}
            >
              <div
                className={`text-sm font-medium ${
                  isToday ? "text-apex-gold" : "text-foreground"
                }`}
              >
                {day}
              </div>
              {count > 0 && (
                <div className="mt-1">
                  <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-apex-gold/10 text-apex-gold border-apex-gold/30">
                    {count} appt{count > 1 ? "s" : ""}
                  </Badge>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </Card>
  );
}

// ─── Appointment Detail Dialog ───
function AppointmentDetailDialog({
  appointment,
  accountId,
  calendarName,
  onClose,
}: {
  appointment: any;
  accountId: number;
  calendarName: string;
  onClose: () => void;
}) {
  const utils = trpc.useUtils();

  const updateMut = trpc.calendar.updateAppointment.useMutation({
    onSuccess: () => {
      utils.calendar.listAppointments.invalidate();
      toast.success("Appointment updated");
      onClose();
    },
    onError: (e) => toast.error(e.message),
  });

  const cancelMut = trpc.calendar.cancelAppointment.useMutation({
    onSuccess: () => {
      utils.calendar.listAppointments.invalidate();
      toast.success("Appointment cancelled");
      onClose();
    },
    onError: (e) => toast.error(e.message),
  });

  const start = new Date(appointment.startTime);
  const end = new Date(appointment.endTime);

  return (
    <Dialog open onOpenChange={() => onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Appointment Details</DialogTitle>
          <DialogDescription>{calendarName}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-apex-gold/15 flex items-center justify-center text-apex-gold font-semibold text-sm">
              {appointment.guestName.charAt(0).toUpperCase()}
            </div>
            <div>
              <div className="font-medium">{appointment.guestName}</div>
              <div className="text-sm text-muted-foreground">{appointment.guestEmail}</div>
              {appointment.guestPhone && (
                <div className="text-sm text-muted-foreground">{appointment.guestPhone}</div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="space-y-1">
              <div className="text-muted-foreground text-xs">Date</div>
              <div className="font-medium">
                {start.toLocaleDateString("en-US", {
                  weekday: "short",
                  month: "short",
                  day: "numeric",
                })}
              </div>
            </div>
            <div className="space-y-1">
              <div className="text-muted-foreground text-xs">Time</div>
              <div className="font-medium">
                {start.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} –{" "}
                {end.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              </div>
            </div>
            <div className="space-y-1">
              <div className="text-muted-foreground text-xs">Status</div>
              <Badge variant="outline" className={STATUS_COLORS[appointment.status] || ""}>
                {appointment.status}
              </Badge>
            </div>
          </div>

          {appointment.notes && (
            <div className="space-y-1">
              <div className="text-muted-foreground text-xs">Notes</div>
              <p className="text-sm bg-card/50 rounded-md p-2 border border-border/50">
                {appointment.notes}
              </p>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          {appointment.status === "pending" && (
            <Button
              size="sm"
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
              onClick={() =>
                updateMut.mutate({
                  id: appointment.id,
                  accountId,
                  status: "confirmed",
                })
              }
              disabled={updateMut.isPending}
            >
              <Check className="h-3.5 w-3.5 mr-1.5" />
              Confirm
            </Button>
          )}
          {appointment.status !== "cancelled" && (
            <Button
              size="sm"
              variant="destructive"
              onClick={() => cancelMut.mutate({ id: appointment.id, accountId })}
              disabled={cancelMut.isPending}
            >
              <X className="h-3.5 w-3.5 mr-1.5" />
              Cancel Appointment
            </Button>
          )}
          <Button size="sm" variant="outline" onClick={onClose}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── New Appointment from Slot Click ───
function NewAppointmentFromSlotDialog({
  accountId,
  date,
  hour,
  calendars,
  onClose,
}: {
  accountId: number;
  date: Date;
  hour: number;
  calendars: any[];
  onClose: () => void;
}) {
  const utils = trpc.useUtils();
  const [calendarId, setCalendarId] = useState(calendars[0]?.id?.toString() || "");
  const [guestName, setGuestName] = useState("");
  const [guestEmail, setGuestEmail] = useState("");
  const [guestPhone, setGuestPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [startHour, setStartHour] = useState(hour.toString().padStart(2, "0") + ":00");
  const [duration, setDuration] = useState("30");

  const bookMut = trpc.calendar.bookAppointment.useMutation({
    onSuccess: () => {
      utils.calendar.listAppointments.invalidate();
      toast.success("Appointment created");
      onClose();
    },
    onError: (e) => toast.error(e.message),
  });

  const handleSubmit = () => {
    if (!calendarId || !guestName.trim() || !guestEmail.trim()) {
      toast.error("Calendar, name, and email are required");
      return;
    }

    const selectedCal = calendars.find((c) => c.id === parseInt(calendarId));
    const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

    bookMut.mutate({
      slug: selectedCal?.slug || "",
      date: dateStr,
      startTime: startHour,
      guestName: guestName.trim(),
      guestEmail: guestEmail.trim(),
      guestPhone: guestPhone.trim() || undefined,
      notes: notes.trim() || undefined,
    });
  };

  const dateLabel = date.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  return (
    <Dialog open onOpenChange={() => onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>New Appointment</DialogTitle>
          <DialogDescription>{dateLabel}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Calendar</Label>
            <Select value={calendarId} onValueChange={setCalendarId}>
              <SelectTrigger>
                <SelectValue placeholder="Select calendar" />
              </SelectTrigger>
              <SelectContent>
                {calendars.map((c) => (
                  <SelectItem key={c.id} value={c.id.toString()}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Start Time</Label>
              <Input type="time" value={startHour} onChange={(e) => setStartHour(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Duration</Label>
              <Select value={duration} onValueChange={setDuration}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {["15", "30", "45", "60", "90"].map((v) => (
                    <SelectItem key={v} value={v}>
                      {v} min
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Guest Name</Label>
            <Input value={guestName} onChange={(e) => setGuestName(e.target.value)} placeholder="John Doe" />
          </div>

          <div className="space-y-1.5">
            <Label>Guest Email</Label>
            <Input type="email" value={guestEmail} onChange={(e) => setGuestEmail(e.target.value)} placeholder="john@example.com" />
          </div>

          <div className="space-y-1.5">
            <Label>Guest Phone (optional)</Label>
            <Input value={guestPhone} onChange={(e) => setGuestPhone(e.target.value)} placeholder="+1 555 123 4567" />
          </div>

          <div className="space-y-1.5">
            <Label>Notes (optional)</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="Any additional notes..." />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={bookMut.isPending}
            className="bg-apex-gold hover:bg-apex-gold-dim text-black"
          >
            {bookMut.isPending && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}
            Create Appointment
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ═══════════════════════════════════════════════
// CALENDARS LIST (existing, preserved)
// ═══════════════════════════════════════════════
function CalendarsList({
  accountId,
  onCreateNew,
  onEdit,
}: {
  accountId: number;
  onCreateNew: () => void;
  onEdit: (cal: any) => void;
}) {
  const utils = trpc.useUtils();
  const { data: calendars, isLoading } = trpc.calendar.list.useQuery({ accountId });
  const deleteMut = trpc.calendar.delete.useMutation({
    onSuccess: () => {
      utils.calendar.list.invalidate();
      toast.success("Calendar deleted");
    },
    onError: (e) => toast.error(e.message),
  });

  const bookingBaseUrl = window.location.origin + "/book/";

  const copyLink = (slug: string) => {
    navigator.clipboard.writeText(bookingBaseUrl + slug);
    toast.success("Booking link copied to clipboard");
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!calendars || calendars.length === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center justify-center py-16 text-center">
          <CalendarDays className="h-12 w-12 text-muted-foreground/50 mb-4" />
          <h3 className="text-lg font-semibold mb-1">No calendars yet</h3>
          <p className="text-muted-foreground text-sm mb-4 max-w-sm">
            Create a booking calendar to let leads and clients schedule appointments with you.
          </p>
          <Button onClick={onCreateNew} className="bg-apex-gold hover:bg-apex-gold-dim text-black">
            <Plus className="h-4 w-4 mr-1.5" />
            Create Calendar
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={onCreateNew} className="bg-apex-gold hover:bg-apex-gold-dim text-black">
          <Plus className="h-4 w-4 mr-1.5" />
          Create Calendar
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {calendars.map((cal) => (
          <Card key={cal.id} className="relative group">
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <CardTitle className="text-base truncate">{cal.name}</CardTitle>
                  {cal.description && (
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                      {cal.description}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-1.5 ml-2">
                  <Badge
                    variant="outline"
                    className={
                      cal.isActive
                        ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30"
                        : "bg-zinc-500/15 text-zinc-400 border-zinc-500/30"
                    }
                  >
                    {cal.isActive ? "Active" : "Inactive"}
                  </Badge>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-7 w-7">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => onEdit(cal)}>
                        <Pencil className="h-3.5 w-3.5 mr-2" />
                        Edit
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => copyLink(cal.slug)}>
                        <Copy className="h-3.5 w-3.5 mr-2" />
                        Copy Booking Link
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => window.open(bookingBaseUrl + cal.slug, "_blank")}
                      >
                        <ExternalLink className="h-3.5 w-3.5 mr-2" />
                        Preview Booking Page
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        className="text-red-400"
                        onClick={() => {
                          if (confirm("Delete this calendar? All appointments will also be removed.")) {
                            deleteMut.mutate({ id: cal.id, accountId });
                          }
                        }}
                      >
                        <Trash2 className="h-3.5 w-3.5 mr-2" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="space-y-2 text-xs text-muted-foreground">
                <div className="flex items-center gap-2">
                  <Clock className="h-3.5 w-3.5" />
                  <span>{cal.slotDurationMinutes} min slots &middot; {cal.bufferMinutes} min buffer</span>
                </div>
                <div className="flex items-center gap-2">
                  <Link2 className="h-3.5 w-3.5" />
                  <span className="truncate font-mono text-[11px]">/book/{cal.slug}</span>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="w-full mt-3"
                onClick={() => copyLink(cal.slug)}
              >
                <Copy className="h-3.5 w-3.5 mr-1.5" />
                Copy Booking Link
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════
// APPOINTMENTS LIST (existing, preserved)
// ═══════════════════════════════════════════════
function AppointmentsList({
  accountId,
  calendarId,
  onCalendarFilter,
}: {
  accountId: number;
  calendarId: number | null;
  onCalendarFilter: (id: number | null) => void;
}) {
  const utils = trpc.useUtils();
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const { data: calendars } = trpc.calendar.list.useQuery({ accountId });
  const { data: appointments, isLoading } = trpc.calendar.listAppointments.useQuery({
    accountId,
    calendarId: calendarId ?? undefined,
    status: statusFilter !== "all" ? (statusFilter as any) : undefined,
  });

  const updateMut = trpc.calendar.updateAppointment.useMutation({
    onSuccess: () => {
      utils.calendar.listAppointments.invalidate();
      toast.success("Appointment updated");
    },
    onError: (e) => toast.error(e.message),
  });

  const cancelMut = trpc.calendar.cancelAppointment.useMutation({
    onSuccess: () => {
      utils.calendar.listAppointments.invalidate();
      toast.success("Appointment cancelled");
    },
    onError: (e) => toast.error(e.message),
  });

  const calendarMap = useMemo(() => {
    const map: Record<number, string> = {};
    calendars?.forEach((c) => (map[c.id] = c.name));
    return map;
  }, [calendars]);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <Select
          value={calendarId?.toString() || "all"}
          onValueChange={(v) => onCalendarFilter(v === "all" ? null : parseInt(v))}
        >
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="All Calendars" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Calendars</SelectItem>
            {calendars?.map((c) => (
              <SelectItem key={c.id} value={c.id.toString()}>
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="All Statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="confirmed">Confirmed</SelectItem>
            <SelectItem value="cancelled">Cancelled</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : !appointments || appointments.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <Clock className="h-12 w-12 text-muted-foreground/50 mb-4" />
            <h3 className="text-lg font-semibold mb-1">No appointments</h3>
            <p className="text-muted-foreground text-sm">
              Appointments will appear here when guests book through your calendar links.
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Guest</TableHead>
                <TableHead>Calendar</TableHead>
                <TableHead>Date & Time</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-[80px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {appointments.map((appt) => (
                <TableRow key={appt.id}>
                  <TableCell>
                    <div>
                      <div className="font-medium text-sm">{appt.guestName}</div>
                      <div className="text-xs text-muted-foreground">{appt.guestEmail}</div>
                      {appt.guestPhone && (
                        <div className="text-xs text-muted-foreground">{appt.guestPhone}</div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-sm">
                    {calendarMap[appt.calendarId] || "—"}
                  </TableCell>
                  <TableCell>
                    <div className="text-sm">
                      {new Date(appt.startTime).toLocaleDateString()}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {new Date(appt.startTime).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}{" "}
                      –{" "}
                      {new Date(appt.endTime).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={STATUS_COLORS[appt.status] || ""}
                    >
                      {appt.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-7 w-7">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {appt.status === "pending" && (
                          <DropdownMenuItem
                            onClick={() =>
                              updateMut.mutate({
                                id: appt.id,
                                accountId,
                                status: "confirmed",
                              })
                            }
                          >
                            <Check className="h-3.5 w-3.5 mr-2" />
                            Confirm
                          </DropdownMenuItem>
                        )}
                        {appt.status !== "cancelled" && (
                          <DropdownMenuItem
                            className="text-red-400"
                            onClick={() =>
                              cancelMut.mutate({ id: appt.id, accountId })
                            }
                          >
                            <X className="h-3.5 w-3.5 mr-2" />
                            Cancel
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════
// CALENDAR CREATE/EDIT DIALOG (existing, preserved)
// ═══════════════════════════════════════════════
function CalendarFormDialog({
  accountId,
  calendar,
  onClose,
}: {
  accountId: number;
  calendar?: any;
  onClose: () => void;
}) {
  const utils = trpc.useUtils();
  const isEditing = !!calendar;

  const [name, setName] = useState(calendar?.name || "");
  const [slug, setSlug] = useState(calendar?.slug || "");
  const [description, setDescription] = useState(calendar?.description || "");
  const [timezone, setTimezone] = useState(calendar?.timezone || "America/New_York");
  const [slotDuration, setSlotDuration] = useState(calendar?.slotDurationMinutes?.toString() || "30");
  const [bufferMinutes, setBufferMinutes] = useState(calendar?.bufferMinutes?.toString() || "15");
  const [minNoticeHours, setMinNoticeHours] = useState(calendar?.minNoticeHours?.toString() || "24");
  const [maxDaysAhead, setMaxDaysAhead] = useState(calendar?.maxDaysAhead?.toString() || "30");
  const [isActive, setIsActive] = useState(calendar?.isActive ?? true);
  const [availability, setAvailability] = useState<WeeklyAvailability>(() => {
    if (calendar?.availabilityJson) {
      try {
        return JSON.parse(calendar.availabilityJson);
      } catch {
        return DEFAULT_AVAILABILITY;
      }
    }
    return DEFAULT_AVAILABILITY;
  });

  const createMut = trpc.calendar.create.useMutation({
    onSuccess: () => {
      utils.calendar.list.invalidate();
      toast.success("Calendar created");
      onClose();
    },
    onError: (e) => toast.error(e.message),
  });

  const updateMut = trpc.calendar.update.useMutation({
    onSuccess: () => {
      utils.calendar.list.invalidate();
      toast.success("Calendar updated");
      onClose();
    },
    onError: (e) => toast.error(e.message),
  });

  const autoSlug = (val: string) => {
    if (!isEditing) {
      setSlug(
        val
          .toLowerCase()
          .replace(/[^a-z0-9\s-]/g, "")
          .replace(/\s+/g, "-")
          .replace(/-+/g, "-")
      );
    }
  };

  const handleSubmit = () => {
    if (!name.trim() || !slug.trim()) {
      toast.error("Name and slug are required");
      return;
    }

    const payload = {
      accountId,
      name: name.trim(),
      slug: slug.trim(),
      description: description.trim() || undefined,
      timezone,
      slotDurationMinutes: parseInt(slotDuration),
      bufferMinutes: parseInt(bufferMinutes),
      minNoticeHours: parseInt(minNoticeHours),
      maxDaysAhead: parseInt(maxDaysAhead),
      availability,
      isActive,
    };

    if (isEditing) {
      updateMut.mutate({ id: calendar.id, ...payload });
    } else {
      createMut.mutate(payload);
    }
  };

  const isPending = createMut.isPending || updateMut.isPending;

  const toggleDay = (day: keyof WeeklyAvailability) => {
    setAvailability((prev) => ({
      ...prev,
      [day]:
        prev[day].length > 0 ? [] : [{ start: "09:00", end: "17:00" }],
    }));
  };

  const updateDayTime = (day: keyof WeeklyAvailability, index: number, field: "start" | "end", value: string) => {
    setAvailability((prev) => ({
      ...prev,
      [day]: prev[day].map((block: AvailabilityBlock, i: number) =>
        i === index ? { ...block, [field]: value } : block
      ),
    }));
  };

  return (
    <Dialog open onOpenChange={() => onClose()}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Edit Calendar" : "Create Calendar"}</DialogTitle>
          <DialogDescription>
            {isEditing
              ? "Update your booking calendar settings."
              : "Set up a new booking calendar for your clients."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          {/* Name & Slug */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Calendar Name</Label>
              <Input
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  autoSlug(e.target.value);
                }}
                placeholder="e.g. 15-Minute Consultation"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Slug (URL)</Label>
              <Input
                value={slug}
                onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))}
                placeholder="e.g. 15-min-consult"
              />
              <p className="text-[11px] text-muted-foreground">/book/{slug || "..."}</p>
            </div>
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <Label>Description</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief description shown on the booking page..."
              rows={2}
            />
          </div>

          {/* Settings row */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Timezone</Label>
              <Select value={timezone} onValueChange={setTimezone}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TIMEZONES.map((tz) => (
                    <SelectItem key={tz} value={tz}>
                      {tz}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Slot Duration (minutes)</Label>
              <Select value={slotDuration} onValueChange={setSlotDuration}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {["15", "30", "45", "60", "90", "120"].map((v) => (
                    <SelectItem key={v} value={v}>
                      {v} min
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <Label>Buffer (min)</Label>
              <Input
                type="number"
                value={bufferMinutes}
                onChange={(e) => setBufferMinutes(e.target.value)}
                min={0}
                max={120}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Min Notice (hrs)</Label>
              <Input
                type="number"
                value={minNoticeHours}
                onChange={(e) => setMinNoticeHours(e.target.value)}
                min={0}
                max={168}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Max Days Ahead</Label>
              <Input
                type="number"
                value={maxDaysAhead}
                onChange={(e) => setMaxDaysAhead(e.target.value)}
                min={1}
                max={365}
              />
            </div>
          </div>

          {/* Weekly Availability */}
          <div className="space-y-2">
            <Label>Weekly Availability</Label>
            <div className="space-y-2">
              {DAY_NAMES.map((day) => (
                <div
                  key={day}
                  className="flex items-center gap-3 py-1.5 px-3 rounded-md bg-card/50 border border-border/50"
                >
                  <div className="w-10">
                    <Switch
                      checked={availability[day].length > 0}
                      onCheckedChange={() => toggleDay(day)}
                    />
                  </div>
                  <span className="w-10 text-sm font-medium">{DAY_LABELS[day]}</span>
                  {availability[day].length > 0 ? (
                    <div className="flex items-center gap-2">
                      <Input
                        type="time"
                        value={availability[day][0].start}
                        onChange={(e) => updateDayTime(day, 0, "start", e.target.value)}
                        className="w-[120px] h-8 text-sm"
                      />
                      <span className="text-muted-foreground text-sm">to</span>
                      <Input
                        type="time"
                        value={availability[day][0].end}
                        onChange={(e) => updateDayTime(day, 0, "end", e.target.value)}
                        className="w-[120px] h-8 text-sm"
                      />
                    </div>
                  ) : (
                    <span className="text-xs text-muted-foreground">Unavailable</span>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Active toggle */}
          {isEditing && (
            <div className="flex items-center justify-between py-2 px-3 rounded-md bg-card/50 border border-border/50">
              <div>
                <p className="text-sm font-medium">Active</p>
                <p className="text-xs text-muted-foreground">
                  Inactive calendars won't accept new bookings
                </p>
              </div>
              <Switch checked={isActive} onCheckedChange={setIsActive} />
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isPending}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isPending}
            className="bg-apex-gold hover:bg-apex-gold-dim text-black"
          >
            {isPending && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}
            {isEditing ? "Save Changes" : "Create Calendar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
