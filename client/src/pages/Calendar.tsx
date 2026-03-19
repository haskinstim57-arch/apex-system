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
  Clock,
  Copy,
  ExternalLink,
  Link2,
  Loader2,
  MoreHorizontal,
  Pencil,
  Plus,
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
import { useState, useMemo } from "react";
import { toast } from "sonner";
import { useAccount } from "@/contexts/AccountContext";
import { NoAccountSelected } from "@/components/NoAccountSelected";

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-amber-500/15 text-amber-400 border-amber-500/30",
  confirmed: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  cancelled: "bg-red-500/15 text-red-400 border-red-500/30",
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

export default function CalendarPage() {
  const { currentAccountId } = useAccount();
  const [activeTab, setActiveTab] = useState("calendars");
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [editingCalendar, setEditingCalendar] = useState<any>(null);
  const [selectedCalendarId, setSelectedCalendarId] = useState<number | null>(null);

  if (!currentAccountId) return <NoAccountSelected />;

  return (
    <div className="space-y-6">
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
          <TabsTrigger value="calendars">
            <CalendarDays className="h-4 w-4 mr-1.5" />
            Calendars
          </TabsTrigger>
          <TabsTrigger value="appointments">
            <Clock className="h-4 w-4 mr-1.5" />
            Appointments
          </TabsTrigger>
        </TabsList>

        <TabsContent value="calendars" className="mt-4">
          <CalendarsList
            accountId={currentAccountId}
            onCreateNew={() => setShowCreateDialog(true)}
            onEdit={(cal: any) => setEditingCalendar(cal)}
          />
        </TabsContent>

        <TabsContent value="appointments" className="mt-4">
          <AppointmentsList
            accountId={currentAccountId}
            calendarId={selectedCalendarId}
            onCalendarFilter={setSelectedCalendarId}
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

// ─── Calendars List ───
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

// ─── Appointments List ───
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

// ─── Calendar Create/Edit Dialog ───
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
