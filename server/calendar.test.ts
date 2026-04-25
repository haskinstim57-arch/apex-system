import { describe, expect, it, vi, beforeEach } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";
import * as db from "./db";

// ─── Helpers ───
type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createAuthContext(overrides?: Partial<AuthenticatedUser>): TrpcContext {
  const user: AuthenticatedUser = {
    id: 1,
    openId: "test-user-calendar",
    email: "loan-officer@example.com",
    name: "Test LO",
    loginMethod: "email",
    role: "user",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
    ...overrides,
  };

  return {
    user,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: vi.fn() } as unknown as TrpcContext["res"],
  };
}

function createPublicContext(): TrpcContext {
  return {
    user: null,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: vi.fn() } as unknown as TrpcContext["res"],
  };
}

// ─── Mocks ───
vi.mock("./db", async () => {
  const actual = await vi.importActual<typeof db>("./db");
  return {
    ...actual,
    getMember: vi.fn(),
    getCalendars: vi.fn(),
    getCalendar: vi.fn(),
    getCalendarBySlug: vi.fn(),
    createCalendar: vi.fn(),
    updateCalendar: vi.fn(),
    deleteCalendar: vi.fn(),
    getAppointments: vi.fn(),
    getAppointment: vi.fn(),
    createAppointment: vi.fn(),
    updateAppointment: vi.fn(),
    cancelAppointment: vi.fn(),
    getAvailableSlots: vi.fn(),
    getAppointmentsByContact: vi.fn(),
    createAuditLog: vi.fn(),
    createCalendarBlock: vi.fn(),
    deleteCalendarBlock: vi.fn(),
    listCalendarBlocks: vi.fn(),
    getAccountById: vi.fn(),
    getActiveCalendarIntegrations: vi.fn(),
    getCalendarIntegrations: vi.fn(),
    decryptCalendarTokens: vi.fn(),
    updateCalendarIntegration: vi.fn(),
    logContactActivity: vi.fn(),
    createNotification: vi.fn(),
    getExternalCalendarEventsByAccount: vi.fn(),
  };
});

vi.mock("./services/messaging", () => ({
  dispatchEmail: vi.fn().mockResolvedValue({ success: true }),
  dispatchSMS: vi.fn().mockResolvedValue({ success: true }),
}));

vi.mock("./services/googleCalendar", () => ({
  getGoogleBusyTimes: vi.fn().mockResolvedValue([]),
  refreshGoogleToken: vi.fn(),
  createGoogleEvent: vi.fn(),
}));

vi.mock("./services/outlookCalendar", () => ({
  getOutlookBusyTimes: vi.fn().mockResolvedValue([]),
  refreshOutlookToken: vi.fn(),
  createOutlookEvent: vi.fn(),
}));

vi.mock("./utils/icsGenerator", () => ({
  generateICSBase64: vi.fn().mockReturnValue("base64ics"),
}));

const mockDb = db as unknown as {
  getMember: ReturnType<typeof vi.fn>;
  getCalendars: ReturnType<typeof vi.fn>;
  getCalendar: ReturnType<typeof vi.fn>;
  getCalendarBySlug: ReturnType<typeof vi.fn>;
  createCalendar: ReturnType<typeof vi.fn>;
  updateCalendar: ReturnType<typeof vi.fn>;
  deleteCalendar: ReturnType<typeof vi.fn>;
  getAppointments: ReturnType<typeof vi.fn>;
  getAppointment: ReturnType<typeof vi.fn>;
  createAppointment: ReturnType<typeof vi.fn>;
  updateAppointment: ReturnType<typeof vi.fn>;
  cancelAppointment: ReturnType<typeof vi.fn>;
  getAvailableSlots: ReturnType<typeof vi.fn>;
  getAppointmentsByContact: ReturnType<typeof vi.fn>;
  createAuditLog: ReturnType<typeof vi.fn>;
  createCalendarBlock: ReturnType<typeof vi.fn>;
  deleteCalendarBlock: ReturnType<typeof vi.fn>;
  listCalendarBlocks: ReturnType<typeof vi.fn>;
  getAccountById: ReturnType<typeof vi.fn>;
  getActiveCalendarIntegrations: ReturnType<typeof vi.fn>;
  getCalendarIntegrations: ReturnType<typeof vi.fn>;
  decryptCalendarTokens: ReturnType<typeof vi.fn>;
  updateCalendarIntegration: ReturnType<typeof vi.fn>;
  logContactActivity: ReturnType<typeof vi.fn>;
  createNotification: ReturnType<typeof vi.fn>;
  getExternalCalendarEventsByAccount: ReturnType<typeof vi.fn>;
};

const ACCOUNT_ID = 10;
const CALENDAR_ID = 1;

const mockCalendar = {
  id: CALENDAR_ID,
  accountId: ACCOUNT_ID,
  name: "30-Min Consultation",
  slug: "30-min-consult",
  description: "Quick loan consultation",
  timezone: "America/New_York",
  bufferMinutes: 15,
  minNoticeHours: 24,
  maxDaysAhead: 30,
  slotDurationMinutes: 30,
  availabilityJson: JSON.stringify({
    monday: [{ start: "09:00", end: "17:00" }],
    tuesday: [{ start: "09:00", end: "17:00" }],
    wednesday: [{ start: "09:00", end: "17:00" }],
    thursday: [{ start: "09:00", end: "17:00" }],
    friday: [{ start: "09:00", end: "17:00" }],
    saturday: [],
    sunday: [],
  }),
  isActive: true,
  createdAt: new Date(),
};

const mockAppointment = {
  id: 1,
  calendarId: CALENDAR_ID,
  accountId: ACCOUNT_ID,
  contactId: null,
  guestName: "John Doe",
  guestEmail: "john@example.com",
  guestPhone: "555-1234",
  startTime: new Date("2026-03-25T14:00:00Z"),
  endTime: new Date("2026-03-25T14:30:00Z"),
  status: "pending",
  notes: null,
  createdAt: new Date(),
};

beforeEach(() => {
  vi.clearAllMocks();
  // Default: user is a member
  mockDb.getMember.mockResolvedValue({
    userId: 1,
    accountId: ACCOUNT_ID,
    role: "owner",
    isActive: true,
  });
  mockDb.createAuditLog.mockResolvedValue(undefined);
  // Default: no external calendar integrations, no manual blocks, no cached events
  mockDb.getActiveCalendarIntegrations.mockResolvedValue([]);
  mockDb.getExternalCalendarEventsByAccount.mockResolvedValue([]);
  mockDb.listCalendarBlocks.mockResolvedValue([]);
  mockDb.logContactActivity.mockResolvedValue(undefined);
  mockDb.createNotification.mockResolvedValue(undefined);
  mockDb.getAccountById.mockResolvedValue({ id: ACCOUNT_ID, name: "Test Account" });
});

// ═══════════════════════════════════════════
// PROTECTED PROCEDURES
// ═══════════════════════════════════════════

describe("calendar.list", () => {
  it("returns calendars for the account", async () => {
    mockDb.getCalendars.mockResolvedValue([mockCalendar]);
    const caller = appRouter.createCaller(createAuthContext());
    const result = await caller.calendar.list({ accountId: ACCOUNT_ID });
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("30-Min Consultation");
    expect(mockDb.getCalendars).toHaveBeenCalledWith(ACCOUNT_ID);
  });

  it("rejects non-members", async () => {
    mockDb.getMember.mockResolvedValue(null);
    const caller = appRouter.createCaller(createAuthContext());
    await expect(caller.calendar.list({ accountId: ACCOUNT_ID })).rejects.toThrow(
      "You do not have access to this account"
    );
  });
});

describe("calendar.get", () => {
  it("returns a single calendar", async () => {
    mockDb.getCalendar.mockResolvedValue(mockCalendar);
    const caller = appRouter.createCaller(createAuthContext());
    const result = await caller.calendar.get({ id: CALENDAR_ID, accountId: ACCOUNT_ID });
    expect(result.slug).toBe("30-min-consult");
  });

  it("throws NOT_FOUND for missing calendar", async () => {
    mockDb.getCalendar.mockResolvedValue(null);
    const caller = appRouter.createCaller(createAuthContext());
    await expect(
      caller.calendar.get({ id: 999, accountId: ACCOUNT_ID })
    ).rejects.toThrow("Calendar not found");
  });
});

describe("calendar.create", () => {
  it("creates a calendar and logs audit", async () => {
    mockDb.getCalendarBySlug.mockResolvedValue(null);
    mockDb.createCalendar.mockResolvedValue({ id: 2, ...mockCalendar, name: "New Calendar", slug: "new-calendar" });
    const caller = appRouter.createCaller(createAuthContext());

    const result = await caller.calendar.create({
      accountId: ACCOUNT_ID,
      name: "New Calendar",
      slug: "new-calendar",
    });

    expect(result).toBeDefined();
    expect(result.id).toBeDefined();
    expect(mockDb.createCalendar).toHaveBeenCalledWith(
      expect.objectContaining({
        accountId: ACCOUNT_ID,
        name: "New Calendar",
        slug: "new-calendar",
      })
    );
    expect(mockDb.createAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "calendar.created",
        resourceType: "calendar",
      })
    );
  });

  it("rejects duplicate slugs", async () => {
    mockDb.getCalendarBySlug.mockResolvedValue(mockCalendar);
    const caller = appRouter.createCaller(createAuthContext());
    await expect(
      caller.calendar.create({
        accountId: ACCOUNT_ID,
        name: "Dup",
        slug: "30-min-consult",
      })
    ).rejects.toThrow("A calendar with this slug already exists");
  });

  it("rejects employees from creating calendars", async () => {
    mockDb.getMember.mockResolvedValue({
      userId: 1,
      accountId: ACCOUNT_ID,
      role: "employee",
      isActive: true,
    });
    const caller = appRouter.createCaller(createAuthContext());
    await expect(
      caller.calendar.create({
        accountId: ACCOUNT_ID,
        name: "Test",
        slug: "test",
      })
    ).rejects.toThrow("Employees cannot create calendars");
  });

  it("validates slug format", async () => {
    const caller = appRouter.createCaller(createAuthContext());
    await expect(
      caller.calendar.create({
        accountId: ACCOUNT_ID,
        name: "Test",
        slug: "INVALID SLUG!",
      })
    ).rejects.toThrow();
  });
});

describe("calendar.update", () => {
  it("updates a calendar", async () => {
    mockDb.getCalendar.mockResolvedValue(mockCalendar);
    mockDb.updateCalendar.mockResolvedValue(undefined);
    const caller = appRouter.createCaller(createAuthContext());

    const result = await caller.calendar.update({
      id: CALENDAR_ID,
      accountId: ACCOUNT_ID,
      name: "Updated Name",
    });

    expect(result.success).toBe(true);
    expect(mockDb.updateCalendar).toHaveBeenCalled();
  });

  it("checks slug uniqueness on change", async () => {
    mockDb.getCalendar.mockResolvedValue(mockCalendar);
    mockDb.getCalendarBySlug.mockResolvedValue({ id: 99, slug: "taken-slug" });
    const caller = appRouter.createCaller(createAuthContext());

    await expect(
      caller.calendar.update({
        id: CALENDAR_ID,
        accountId: ACCOUNT_ID,
        slug: "taken-slug",
      })
    ).rejects.toThrow("A calendar with this slug already exists");
  });
});

describe("calendar.delete", () => {
  it("deletes a calendar and logs audit", async () => {
    mockDb.getCalendar.mockResolvedValue(mockCalendar);
    mockDb.deleteCalendar.mockResolvedValue(undefined);
    const caller = appRouter.createCaller(createAuthContext());

    const result = await caller.calendar.delete({ id: CALENDAR_ID, accountId: ACCOUNT_ID });
    expect(result.success).toBe(true);
    expect(mockDb.deleteCalendar).toHaveBeenCalledWith(CALENDAR_ID, ACCOUNT_ID);
    expect(mockDb.createAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({ action: "calendar.deleted" })
    );
  });

  it("throws NOT_FOUND for missing calendar", async () => {
    mockDb.getCalendar.mockResolvedValue(null);
    const caller = appRouter.createCaller(createAuthContext());
    await expect(
      caller.calendar.delete({ id: 999, accountId: ACCOUNT_ID })
    ).rejects.toThrow("Calendar not found");
  });
});

describe("calendar.listAppointments", () => {
  it("returns appointments for the account", async () => {
    mockDb.getAppointments.mockResolvedValue([mockAppointment]);
    const caller = appRouter.createCaller(createAuthContext());
    const result = await caller.calendar.listAppointments({ accountId: ACCOUNT_ID });
    expect(result).toHaveLength(1);
    expect(result[0].guestName).toBe("John Doe");
  });

  it("filters by calendarId and status", async () => {
    mockDb.getAppointments.mockResolvedValue([]);
    const caller = appRouter.createCaller(createAuthContext());
    await caller.calendar.listAppointments({
      accountId: ACCOUNT_ID,
      calendarId: CALENDAR_ID,
      status: "confirmed",
    });
    expect(mockDb.getAppointments).toHaveBeenCalledWith(ACCOUNT_ID, {
      calendarId: CALENDAR_ID,
      status: "confirmed",
      limit: undefined,
      offset: undefined,
    });
  });
});

describe("calendar.updateAppointment", () => {
  it("confirms a pending appointment", async () => {
    mockDb.getAppointment.mockResolvedValue(mockAppointment);
    mockDb.updateAppointment.mockResolvedValue(undefined);
    const caller = appRouter.createCaller(createAuthContext());

    const result = await caller.calendar.updateAppointment({
      id: 1,
      accountId: ACCOUNT_ID,
      status: "confirmed",
    });
    expect(result.success).toBe(true);
    expect(mockDb.updateAppointment).toHaveBeenCalled();
  });

  it("throws NOT_FOUND for missing appointment", async () => {
    mockDb.getAppointment.mockResolvedValue(null);
    const caller = appRouter.createCaller(createAuthContext());
    await expect(
      caller.calendar.updateAppointment({ id: 999, accountId: ACCOUNT_ID, status: "confirmed" })
    ).rejects.toThrow("Appointment not found");
  });
});

describe("calendar.cancelAppointment", () => {
  it("cancels an appointment and logs audit", async () => {
    mockDb.getAppointment.mockResolvedValue(mockAppointment);
    mockDb.cancelAppointment.mockResolvedValue(undefined);
    const caller = appRouter.createCaller(createAuthContext());

    const result = await caller.calendar.cancelAppointment({ id: 1, accountId: ACCOUNT_ID });
    expect(result.success).toBe(true);
    expect(mockDb.cancelAppointment).toHaveBeenCalledWith(1, ACCOUNT_ID);
    expect(mockDb.createAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({ action: "appointment.cancelled" })
    );
  });
});

describe("calendar.appointmentsByContact", () => {
  it("returns appointments for a contact", async () => {
    mockDb.getAppointmentsByContact.mockResolvedValue([mockAppointment]);
    const caller = appRouter.createCaller(createAuthContext());
    const result = await caller.calendar.appointmentsByContact({
      contactId: 5,
      accountId: ACCOUNT_ID,
    });
    expect(result).toHaveLength(1);
    expect(mockDb.getAppointmentsByContact).toHaveBeenCalledWith(5, ACCOUNT_ID);
  });
});

// ═══════════════════════════════════════════
// PUBLIC PROCEDURES
// ═══════════════════════════════════════════

describe("calendar.getPublicCalendar", () => {
  it("returns public-safe calendar fields", async () => {
    mockDb.getCalendarBySlug.mockResolvedValue(mockCalendar);
    const caller = appRouter.createCaller(createPublicContext());
    const result = await caller.calendar.getPublicCalendar({ slug: "30-min-consult" });

    expect(result.name).toBe("30-Min Consultation");
    expect(result.slug).toBe("30-min-consult");
    expect(result.slotDurationMinutes).toBe(30);
    // Should NOT expose accountId
    expect((result as any).accountId).toBeUndefined();
  });

  it("throws NOT_FOUND for invalid slug", async () => {
    mockDb.getCalendarBySlug.mockResolvedValue(null);
    const caller = appRouter.createCaller(createPublicContext());
    await expect(
      caller.calendar.getPublicCalendar({ slug: "nonexistent" })
    ).rejects.toThrow("Calendar not found");
  });
});

describe("calendar.getPublicSlots", () => {
  it("returns available slots for a date", async () => {
    mockDb.getCalendarBySlug.mockResolvedValue(mockCalendar);
    // Return slots far in the future so minNotice doesn't filter them out
    mockDb.getAvailableSlots.mockResolvedValue([
      { start: "09:00", end: "09:30" },
      { start: "09:30", end: "10:00" },
      { start: "10:00", end: "10:30" },
    ]);
    const caller = appRouter.createCaller(createPublicContext());

    // Use a date 5 days from now to be safe
    const futureDate = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000);
    const dateStr = futureDate.toISOString().split("T")[0];

    const result = await caller.calendar.getPublicSlots({
      slug: "30-min-consult",
      date: dateStr,
    });

    expect(Array.isArray(result)).toBe(true);
    expect(mockDb.getAvailableSlots).toHaveBeenCalledWith(CALENDAR_ID, dateStr);
  });

  it("returns empty for past dates", async () => {
    mockDb.getCalendarBySlug.mockResolvedValue(mockCalendar);
    const caller = appRouter.createCaller(createPublicContext());
    const result = await caller.calendar.getPublicSlots({
      slug: "30-min-consult",
      date: "2020-01-01",
    });
    expect(result).toEqual([]);
  });

  it("returns empty for dates beyond maxDaysAhead", async () => {
    mockDb.getCalendarBySlug.mockResolvedValue(mockCalendar);
    const caller = appRouter.createCaller(createPublicContext());
    const farFuture = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);
    const result = await caller.calendar.getPublicSlots({
      slug: "30-min-consult",
      date: farFuture.toISOString().split("T")[0],
    });
    expect(result).toEqual([]);
  });
});

describe("calendar.bookAppointment", () => {
  it("books an appointment successfully", async () => {
    mockDb.getCalendarBySlug.mockResolvedValue({
      ...mockCalendar,
      minNoticeHours: 0, // No notice required for test
    });
    mockDb.getAvailableSlots.mockResolvedValue([
      { start: "14:00", end: "14:30" },
    ]);
    mockDb.createAppointment.mockResolvedValue({ id: 5 });

    const caller = appRouter.createCaller(createPublicContext());
    const futureDate = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
    const dateStr = futureDate.toISOString().split("T")[0];

    const result = await caller.calendar.bookAppointment({
      slug: "30-min-consult",
      date: dateStr,
      startTime: "14:00",
      guestName: "Jane Smith",
      guestEmail: "jane@example.com",
      guestPhone: "555-9876",
    });

    expect(result.id).toBe(5);
    expect(result.calendarName).toBe("30-Min Consultation");
    expect(mockDb.createAppointment).toHaveBeenCalledWith(
      expect.objectContaining({
        calendarId: CALENDAR_ID,
        accountId: ACCOUNT_ID,
        guestName: "Jane Smith",
        guestEmail: "jane@example.com",
        status: "pending",
      })
    );
  });

  it("rejects booking for unavailable slot", async () => {
    mockDb.getCalendarBySlug.mockResolvedValue(mockCalendar);
    mockDb.getAvailableSlots.mockResolvedValue([
      { start: "09:00", end: "09:30" },
    ]);
    const caller = appRouter.createCaller(createPublicContext());
    const futureDate = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);

    await expect(
      caller.calendar.bookAppointment({
        slug: "30-min-consult",
        date: futureDate.toISOString().split("T")[0],
        startTime: "15:00", // Not in available slots
        guestName: "Test",
        guestEmail: "test@example.com",
      })
    ).rejects.toThrow("This time slot is already booked. Please choose a different time.");
  });

  it("rejects booking for nonexistent calendar", async () => {
    mockDb.getCalendarBySlug.mockResolvedValue(null);
    const caller = appRouter.createCaller(createPublicContext());
    await expect(
      caller.calendar.bookAppointment({
        slug: "nonexistent",
        date: "2026-04-01",
        startTime: "10:00",
        guestName: "Test",
        guestEmail: "test@example.com",
      })
    ).rejects.toThrow("Calendar not found");
  });

  it("validates email format", async () => {
    const caller = appRouter.createCaller(createPublicContext());
    await expect(
      caller.calendar.bookAppointment({
        slug: "30-min-consult",
        date: "2026-04-01",
        startTime: "10:00",
        guestName: "Test",
        guestEmail: "not-an-email",
      })
    ).rejects.toThrow();
  });

  it("validates date format", async () => {
    const caller = appRouter.createCaller(createPublicContext());
    await expect(
      caller.calendar.bookAppointment({
        slug: "30-min-consult",
        date: "invalid-date",
        startTime: "10:00",
        guestName: "Test",
        guestEmail: "test@example.com",
      })
    ).rejects.toThrow();
  });
});

// ─── Admin access ───
describe("calendar admin access", () => {
  it("allows admin to list calendars without membership", async () => {
    mockDb.getMember.mockResolvedValue(null); // No membership
    mockDb.getCalendars.mockResolvedValue([mockCalendar]);
    const caller = appRouter.createCaller(createAuthContext({ role: "admin" }));
    const result = await caller.calendar.list({ accountId: ACCOUNT_ID });
    expect(result).toHaveLength(1);
  });

  it("allows admin to create calendars without membership", async () => {
    mockDb.getMember.mockResolvedValue(null);
    mockDb.getCalendarBySlug.mockResolvedValue(null);
    mockDb.createCalendar.mockResolvedValue({ id: 3 });
    const caller = appRouter.createCaller(createAuthContext({ role: "admin" }));
    const result = await caller.calendar.create({
      accountId: ACCOUNT_ID,
      name: "Admin Calendar",
      slug: "admin-cal",
    });
    expect(result.id).toBe(3);
  });
});

// ═══════════════════════════════════════════
// CALENDAR BLOCKS
// ═══════════════════════════════════════════

describe("calendar.addBlock", () => {
  it("creates a calendar block for an owner", async () => {
    mockDb.getCalendar.mockResolvedValue(mockCalendar);
    mockDb.createCalendarBlock.mockResolvedValue({ id: 1 });
    const caller = appRouter.createCaller(createAuthContext());

    const start = new Date("2026-04-10T13:00:00Z");
    const end = new Date("2026-04-10T14:00:00Z");

    const result = await caller.calendar.addBlock({
      calendarId: CALENDAR_ID,
      accountId: ACCOUNT_ID,
      startTime: start,
      endTime: end,
      reason: "Lunch break",
    });

    expect(result.id).toBe(1);
    expect(mockDb.createCalendarBlock).toHaveBeenCalledWith(
      expect.objectContaining({
        calendarId: CALENDAR_ID,
        accountId: ACCOUNT_ID,
        reason: "Lunch break",
      })
    );
  });

  it("rejects non-members", async () => {
    mockDb.getMember.mockResolvedValue(null);
    const caller = appRouter.createCaller(createAuthContext());
    await expect(
      caller.calendar.addBlock({
        calendarId: CALENDAR_ID,
        accountId: ACCOUNT_ID,
        startTime: new Date("2026-04-10T13:00:00Z"),
        endTime: new Date("2026-04-10T14:00:00Z"),
      })
    ).rejects.toThrow();
  });
});

describe("calendar.removeBlock", () => {
  it("deletes a calendar block", async () => {
    mockDb.deleteCalendarBlock.mockResolvedValue(true);
    const caller = appRouter.createCaller(createAuthContext());

    await caller.calendar.removeBlock({ id: 5, accountId: ACCOUNT_ID });
    expect(mockDb.deleteCalendarBlock).toHaveBeenCalledWith(5, ACCOUNT_ID);
  });
});

describe("calendar.listBlocks", () => {
  it("returns blocks for a date range", async () => {
    const blocks = [
      {
        id: 1,
        calendarId: CALENDAR_ID,
        accountId: ACCOUNT_ID,
        startTime: new Date("2026-04-10T13:00:00Z"),
        endTime: new Date("2026-04-10T14:00:00Z"),
        reason: "Lunch",
        createdByUserId: 1,
        createdAt: new Date(),
      },
    ];
    mockDb.listCalendarBlocks.mockResolvedValue(blocks);
    const caller = appRouter.createCaller(createAuthContext());

    const result = await caller.calendar.listBlocks({
      calendarId: CALENDAR_ID,
      accountId: ACCOUNT_ID,
      startDate: "2026-04-10",
      endDate: "2026-04-10",
    });

    expect(result).toHaveLength(1);
    expect(result[0].reason).toBe("Lunch");
  });
});

describe("calendar blocks + booking conflict", () => {
  // Use a date 3 days in the future to pass minNoticeHours and maxDaysAhead checks
  function getFutureDate(): string {
    const d = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
    return d.toISOString().split("T")[0];
  }

  it("booking that overlaps a manual block gets rejected", async () => {
    const dateStr = getFutureDate();
    // Calendar is available 9-17 on weekdays
    mockDb.getCalendarBySlug.mockResolvedValue({
      ...mockCalendar,
      minNoticeHours: 0,
    });
    // The slot 14:00-14:30 is available per weekly schedule
    mockDb.getAvailableSlots.mockResolvedValue([
      { start: "14:00", end: "14:30" },
    ]);
    // But there's a manual block from 13:30-15:00 that day
    mockDb.listCalendarBlocks.mockResolvedValue([
      {
        id: 1,
        calendarId: CALENDAR_ID,
        accountId: ACCOUNT_ID,
        startTime: new Date(`${dateStr}T13:30:00Z`),
        endTime: new Date(`${dateStr}T15:00:00Z`),
        reason: "Team meeting",
        createdByUserId: 1,
        createdAt: new Date(),
      },
    ]);

    const caller = appRouter.createCaller(createPublicContext());

    // The public booking should be rejected because the slot overlaps the manual block
    const result = await caller.calendar.getPublicSlots({
      slug: "30-min-consult",
      date: dateStr,
    });

    // The 14:00 slot should be filtered out because it overlaps the 13:30-15:00 block
    const has14 = result.some((s: any) => s.start === "14:00");
    expect(has14).toBe(false);
  });

  it("blocks merge correctly with external busy times", async () => {
    const dateStr = getFutureDate();
    mockDb.getCalendarBySlug.mockResolvedValue({
      ...mockCalendar,
      minNoticeHours: 0,
      bufferMinutes: 0,
    });
    // Available slots: 09:00-09:30, 10:00-10:30, 14:00-14:30
    mockDb.getAvailableSlots.mockResolvedValue([
      { start: "09:00", end: "09:30" },
      { start: "10:00", end: "10:30" },
      { start: "14:00", end: "14:30" },
    ]);
    // Manual block covers 09:00-09:30
    mockDb.listCalendarBlocks.mockResolvedValue([
      {
        id: 2,
        calendarId: CALENDAR_ID,
        accountId: ACCOUNT_ID,
        startTime: new Date(`${dateStr}T09:00:00Z`),
        endTime: new Date(`${dateStr}T09:30:00Z`),
        reason: "Morning standup",
        createdByUserId: 1,
        createdAt: new Date(),
      },
    ]);

    const caller = appRouter.createCaller(createPublicContext());
    const result = await caller.calendar.getPublicSlots({
      slug: "30-min-consult",
      date: dateStr,
    });

    // 09:00 should be blocked, but 10:00 and 14:00 should remain
    const starts = result.map((s: any) => s.start);
    expect(starts).not.toContain("09:00");
    expect(starts).toContain("10:00");
    expect(starts).toContain("14:00");
  });
});
