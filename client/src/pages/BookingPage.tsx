import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock,
  Loader2,
  Mail,
  Phone,
  User,
} from "lucide-react";
import { useState, useMemo } from "react";
import { toast } from "sonner";

export default function BookingPage({ slug }: { slug: string }) {
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [step, setStep] = useState<"date" | "time" | "form" | "success">("date");
  const [guestName, setGuestName] = useState("");
  const [guestEmail, setGuestEmail] = useState("");
  const [guestPhone, setGuestPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [bookingResult, setBookingResult] = useState<any>(null);

  // Current month for calendar navigation
  const [viewMonth, setViewMonth] = useState(() => {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() };
  });

  const { data: calendar, isLoading, error } = trpc.calendar.getPublicCalendar.useQuery({ slug });

  const { data: slots, isLoading: slotsLoading } = trpc.calendar.getPublicSlots.useQuery(
    { slug, date: selectedDate! },
    { enabled: !!selectedDate }
  );

  const bookMut = trpc.calendar.bookAppointment.useMutation({
    onSuccess: (data) => {
      setBookingResult(data);
      setStep("success");
    },
    onError: (e) => toast.error(e.message),
  });

  // Parse availability to know which days have slots
  const availableDays = useMemo(() => {
    if (!calendar?.availabilityJson) return new Set<number>();
    try {
      const avail = JSON.parse(calendar.availabilityJson);
      const dayMap: Record<string, number> = {
        sunday: 0, monday: 1, tuesday: 2, wednesday: 3,
        thursday: 4, friday: 5, saturday: 6,
      };
      const days = new Set<number>();
      for (const [day, blocks] of Object.entries(avail)) {
        if (Array.isArray(blocks) && blocks.length > 0) {
          days.add(dayMap[day]);
        }
      }
      return days;
    } catch {
      return new Set<number>();
    }
  }, [calendar?.availabilityJson]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !calendar) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <CalendarDays className="h-12 w-12 text-muted-foreground/50 mb-4" />
            <h2 className="text-xl font-semibold mb-2">Calendar Not Found</h2>
            <p className="text-muted-foreground text-sm">
              This booking link is invalid or the calendar is no longer active.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const handleBook = () => {
    if (!selectedDate || !selectedSlot) return;
    if (!guestName.trim()) { toast.error("Please enter your name"); return; }
    if (!guestEmail.trim()) { toast.error("Please enter your email"); return; }

    bookMut.mutate({
      slug,
      date: selectedDate,
      startTime: selectedSlot,
      guestName: guestName.trim(),
      guestEmail: guestEmail.trim(),
      guestPhone: guestPhone.trim() || undefined,
      notes: notes.trim() || undefined,
    });
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-lg">
        {/* Header */}
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold tracking-tight">{calendar.name}</h1>
          {calendar.description && (
            <p className="text-muted-foreground text-sm mt-1">{calendar.description}</p>
          )}
          <div className="flex items-center justify-center gap-3 mt-2 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <Clock className="h-3.5 w-3.5" />
              {calendar.slotDurationMinutes} min
            </span>
            <span className="flex items-center gap-1">
              <CalendarDays className="h-3.5 w-3.5" />
              {calendar.timezone}
            </span>
          </div>
        </div>

        {/* Step: Date Selection */}
        {step === "date" && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Select a Date</CardTitle>
            </CardHeader>
            <CardContent>
              <MiniCalendar
                viewMonth={viewMonth}
                onViewMonthChange={setViewMonth}
                availableDays={availableDays}
                maxDaysAhead={calendar.maxDaysAhead}
                selectedDate={selectedDate}
                onSelectDate={(d) => {
                  setSelectedDate(d);
                  setSelectedSlot(null);
                  setStep("time");
                }}
              />
            </CardContent>
          </Card>
        )}

        {/* Step: Time Selection */}
        {step === "time" && selectedDate && (
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">
                  {new Date(selectedDate + "T12:00:00").toLocaleDateString(undefined, {
                    weekday: "long",
                    month: "long",
                    day: "numeric",
                  })}
                </CardTitle>
                <Button variant="ghost" size="sm" onClick={() => { setStep("date"); setSelectedSlot(null); }}>
                  <ChevronLeft className="h-4 w-4 mr-1" />
                  Back
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {slotsLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : !slots || slots.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-muted-foreground text-sm">No available times on this date.</p>
                  <Button variant="link" size="sm" onClick={() => setStep("date")} className="mt-2">
                    Choose another date
                  </Button>
                </div>
              ) : (
                <div className="grid grid-cols-3 gap-2 max-h-[300px] overflow-y-auto">
                  {slots.map((slot) => (
                    <Button
                      key={slot.start}
                      variant={selectedSlot === slot.start ? "default" : "outline"}
                      size="sm"
                      className={
                        selectedSlot === slot.start
                          ? "bg-apex-gold hover:bg-apex-gold-dim text-black"
                          : ""
                      }
                      onClick={() => setSelectedSlot(slot.start)}
                    >
                      {slot.start}
                    </Button>
                  ))}
                </div>
              )}
              {selectedSlot && (
                <Button
                  className="w-full mt-4 bg-apex-gold hover:bg-apex-gold-dim text-black"
                  onClick={() => setStep("form")}
                >
                  Continue
                  <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              )}
            </CardContent>
          </Card>
        )}

        {/* Step: Guest Form */}
        {step === "form" && (
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Your Details</CardTitle>
                <Button variant="ghost" size="sm" onClick={() => setStep("time")}>
                  <ChevronLeft className="h-4 w-4 mr-1" />
                  Back
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                {selectedDate && new Date(selectedDate + "T12:00:00").toLocaleDateString(undefined, {
                  weekday: "long",
                  month: "long",
                  day: "numeric",
                })}{" "}
                at {selectedSlot} &middot; {calendar.slotDurationMinutes} min
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <Label className="flex items-center gap-1.5">
                  <User className="h-3.5 w-3.5" />
                  Name <span className="text-red-400">*</span>
                </Label>
                <Input
                  value={guestName}
                  onChange={(e) => setGuestName(e.target.value)}
                  placeholder="Your full name"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="flex items-center gap-1.5">
                  <Mail className="h-3.5 w-3.5" />
                  Email <span className="text-red-400">*</span>
                </Label>
                <Input
                  type="email"
                  value={guestEmail}
                  onChange={(e) => setGuestEmail(e.target.value)}
                  placeholder="you@example.com"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="flex items-center gap-1.5">
                  <Phone className="h-3.5 w-3.5" />
                  Phone (optional)
                </Label>
                <Input
                  type="tel"
                  value={guestPhone}
                  onChange={(e) => setGuestPhone(e.target.value)}
                  placeholder="(555) 123-4567"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Notes (optional)</Label>
                <Textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Anything you'd like us to know..."
                  rows={3}
                />
              </div>
              <Button
                className="w-full bg-apex-gold hover:bg-apex-gold-dim text-black"
                onClick={handleBook}
                disabled={bookMut.isPending}
              >
                {bookMut.isPending ? (
                  <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                ) : (
                  <Check className="h-4 w-4 mr-1.5" />
                )}
                Confirm Booking
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Step: Success */}
        {step === "success" && bookingResult && (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12 text-center">
              <div className="h-16 w-16 rounded-full bg-emerald-500/15 flex items-center justify-center mb-4">
                <Check className="h-8 w-8 text-emerald-400" />
              </div>
              <h2 className="text-xl font-semibold mb-1">Booking Confirmed!</h2>
              <p className="text-muted-foreground text-sm mb-4">
                Your appointment has been scheduled.
              </p>
              <div className="bg-card/50 border border-border/50 rounded-lg p-4 w-full max-w-xs text-sm space-y-1">
                <p><span className="text-muted-foreground">Calendar:</span> {bookingResult.calendarName}</p>
                <p>
                  <span className="text-muted-foreground">Date:</span>{" "}
                  {new Date(bookingResult.startTime).toLocaleDateString(undefined, {
                    weekday: "long",
                    month: "long",
                    day: "numeric",
                  })}
                </p>
                <p>
                  <span className="text-muted-foreground">Time:</span>{" "}
                  {new Date(bookingResult.startTime).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}{" "}
                  –{" "}
                  {new Date(bookingResult.endTime).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Footer */}
        <p className="text-center text-[11px] text-muted-foreground/50 mt-6">
          Powered by Sterling Marketing
        </p>
      </div>
    </div>
  );
}

// ─── Mini Calendar Component ───
function MiniCalendar({
  viewMonth,
  onViewMonthChange,
  availableDays,
  maxDaysAhead,
  selectedDate,
  onSelectDate,
}: {
  viewMonth: { year: number; month: number };
  onViewMonthChange: (m: { year: number; month: number }) => void;
  availableDays: Set<number>;
  maxDaysAhead: number;
  selectedDate: string | null;
  onSelectDate: (date: string) => void;
}) {
  const today = useMemo(() => new Date(), []);
  const maxDate = useMemo(
    () => new Date(today.getTime() + maxDaysAhead * 24 * 60 * 60 * 1000),
    [today, maxDaysAhead]
  );

  const firstDay = new Date(viewMonth.year, viewMonth.month, 1);
  const lastDay = new Date(viewMonth.year, viewMonth.month + 1, 0);
  const startPad = firstDay.getDay(); // 0=Sun

  const days: (Date | null)[] = [];
  for (let i = 0; i < startPad; i++) days.push(null);
  for (let d = 1; d <= lastDay.getDate(); d++) {
    days.push(new Date(viewMonth.year, viewMonth.month, d));
  }

  const prevMonth = () => {
    const m = viewMonth.month === 0 ? 11 : viewMonth.month - 1;
    const y = viewMonth.month === 0 ? viewMonth.year - 1 : viewMonth.year;
    onViewMonthChange({ year: y, month: m });
  };

  const nextMonth = () => {
    const m = viewMonth.month === 11 ? 0 : viewMonth.month + 1;
    const y = viewMonth.month === 11 ? viewMonth.year + 1 : viewMonth.year;
    onViewMonthChange({ year: y, month: m });
  };

  const canGoPrev = () => {
    const prevFirst = new Date(
      viewMonth.month === 0 ? viewMonth.year - 1 : viewMonth.year,
      viewMonth.month === 0 ? 11 : viewMonth.month - 1,
      1
    );
    return prevFirst >= new Date(today.getFullYear(), today.getMonth(), 1);
  };

  const isDateAvailable = (d: Date) => {
    if (d < today && d.toDateString() !== today.toDateString()) return false;
    if (d > maxDate) return false;
    return availableDays.has(d.getDay());
  };

  const formatDateStr = (d: Date) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  };

  const monthLabel = firstDay.toLocaleDateString(undefined, {
    month: "long",
    year: "numeric",
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={prevMonth} disabled={!canGoPrev()}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <span className="text-sm font-medium">{monthLabel}</span>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={nextMonth}>
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center">
        {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((d) => (
          <div key={d} className="text-[11px] text-muted-foreground font-medium py-1">
            {d}
          </div>
        ))}
        {days.map((d, i) => {
          if (!d) return <div key={`pad-${i}`} />;
          const dateStr = formatDateStr(d);
          const available = isDateAvailable(d);
          const isSelected = selectedDate === dateStr;
          const isToday = d.toDateString() === today.toDateString();

          return (
            <button
              key={dateStr}
              disabled={!available}
              onClick={() => onSelectDate(dateStr)}
              className={`
                h-9 w-full rounded-md text-sm transition-colors
                ${available
                  ? "hover:bg-accent cursor-pointer"
                  : "text-muted-foreground/30 cursor-not-allowed"
                }
                ${isSelected ? "bg-apex-gold text-black font-semibold" : ""}
                ${isToday && !isSelected ? "ring-1 ring-apex-gold/50" : ""}
              `}
            >
              {d.getDate()}
            </button>
          );
        })}
      </div>
    </div>
  );
}
