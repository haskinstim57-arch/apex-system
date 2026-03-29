/**
 * Vitest tests for VAPI appointment booking tool-calling
 * Tests: bookAppointment, checkAvailability, double-booking,
 *        timezone conversion, missing contact fallback,
 *        VAPI response format, error handling
 */
import { describe, expect, it, vi, beforeEach } from "vitest";

// ─── Mock all DB functions before importing the module ───
vi.mock("./db", () => ({
  getAICallById: vi.fn(),
  getAICallByExternalId: vi.fn(),
  updateAICall: vi.fn(),
  createAICall: vi.fn(),
  createNotification: vi.fn().mockResolvedValue(true),
  createAppointment: vi.fn(),
  getAvailableSlots: vi.fn(),
  getCalendars: vi.fn(),
  getCalendar: vi.fn(),
  getAppointments: vi.fn(),
  getAccountMessagingSettings: vi.fn(),
  findContactByPhone: vi.fn(),
  logContactActivity: vi.fn(),
}));

vi.mock("./services/vapi", () => ({
  mapVapiStatus: vi.fn((s: string) => s),
  mapVapiEndedReason: vi.fn((s: string) => s),
}));

vi.mock("./services/workflowTriggers", () => ({
  onAppointmentBooked: vi.fn().mockResolvedValue(undefined),
}));

import {
  getAICallByExternalId,
  createNotification,
  createAppointment,
  getAvailableSlots,
  getCalendars,
  getCalendar,
  getAppointments,
  getAccountMessagingSettings,
  findContactByPhone,
  logContactActivity,
} from "./db";

import { vapiWebhookRouter, clearCalendarCache } from "./webhooks/vapi";
import express from "express";
import request from "supertest";

const mockGetCalendars = getCalendars as ReturnType<typeof vi.fn>;
const mockGetCalendar = getCalendar as ReturnType<typeof vi.fn>;
const mockGetAppointments = getAppointments as ReturnType<typeof vi.fn>;
const mockGetAvailableSlots = getAvailableSlots as ReturnType<typeof vi.fn>;
const mockGetAccountMessagingSettings = getAccountMessagingSettings as ReturnType<typeof vi.fn>;
const mockCreateAppointment = createAppointment as ReturnType<typeof vi.fn>;
const mockCreateNotification = createNotification as ReturnType<typeof vi.fn>;
const mockGetAICallByExternalId = getAICallByExternalId as ReturnType<typeof vi.fn>;
const mockFindContactByPhone = findContactByPhone as ReturnType<typeof vi.fn>;
const mockLogContactActivity = logContactActivity as ReturnType<typeof vi.fn>;

function createTestApp() {
  const app = express();
  app.use(express.json());
  app.use(vapiWebhookRouter);
  return app;
}

function buildToolCallBody(
  toolCalls: Array<{ id: string; name: string; arguments: Record<string, any> }>,
  metadata: Record<string, any> = {}
) {
  return {
    message: {
      type: "tool-calls",
      call: {
        id: "vapi-call-123",
        metadata: { apex_account_id: "1", ...metadata },
      },
      toolCallList: toolCalls.map((tc) => ({
        id: tc.id,
        function: {
          name: tc.name,
          arguments: JSON.stringify(tc.arguments),
        },
      })),
    },
  };
}

// Default mock setup
function setupDefaultMocks() {
  mockGetCalendars.mockResolvedValue([{ id: 10, name: "Main Calendar" }]);
  mockGetCalendar.mockResolvedValue({
    id: 10,
    accountId: 1,
    name: "Main Calendar",
    timezone: "America/New_York",
    slotDurationMinutes: 30,
    bufferMinutes: 15,
    isActive: true,
  });
  mockGetAccountMessagingSettings.mockResolvedValue({
    businessHours: JSON.stringify({
      enabled: true,
      timezone: "America/New_York",
      schedule: {
        monday: { open: true, start: "07:00", end: "22:00" },
        tuesday: { open: true, start: "07:00", end: "22:00" },
        wednesday: { open: true, start: "07:00", end: "22:00" },
        thursday: { open: true, start: "07:00", end: "22:00" },
        friday: { open: true, start: "07:00", end: "22:00" },
        saturday: { open: true, start: "08:00", end: "20:00" },
        sunday: { open: false },
      },
    }),
  });
  mockGetAppointments.mockResolvedValue([]);
  mockGetAvailableSlots.mockResolvedValue([]);
  mockCreateAppointment.mockResolvedValue({ id: 100 });
  mockCreateNotification.mockResolvedValue(true);
  mockLogContactActivity.mockReturnValue(undefined);
}

describe("VAPI Booking Tool Handlers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearCalendarCache(); // Clear the module-level cache between tests
    setupDefaultMocks();
  });

  // ─── VAPI Response Format ───
  describe("VAPI Response Format", () => {
    it("returns { results: [{ toolCallId, result }] } format", async () => {
      const app = createTestApp();
      const futureDate = getNextMonday();
      const body = buildToolCallBody([
        {
          id: "tc-1",
          name: "bookAppointment",
          arguments: {
            guestName: "John Doe",
            guestPhone: "+15551234567",
            date: futureDate,
            time: "14:00",
          },
        },
      ]);

      const res = await request(app).post("/api/webhooks/vapi").send(body);
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("results");
      expect(Array.isArray(res.body.results)).toBe(true);
      expect(res.body.results[0]).toHaveProperty("toolCallId", "tc-1");
      expect(res.body.results[0]).toHaveProperty("result");
      // Result should be a parseable JSON string
      const parsed = JSON.parse(res.body.results[0].result);
      expect(parsed).toHaveProperty("success");
    });

    it("handles multiple tool calls in one request", async () => {
      const app = createTestApp();
      const futureDate = getNextMonday();
      mockGetAvailableSlots.mockResolvedValue([
        { start: "09:00", end: "09:30" },
        { start: "10:00", end: "10:30" },
      ]);

      const body = buildToolCallBody([
        {
          id: "tc-1",
          name: "checkAvailability",
          arguments: { date: futureDate },
        },
        {
          id: "tc-2",
          name: "bookAppointment",
          arguments: {
            guestName: "Jane Smith",
            guestPhone: "+15559876543",
            date: futureDate,
            time: "10:00",
          },
        },
      ]);

      const res = await request(app).post("/api/webhooks/vapi").send(body);
      expect(res.status).toBe(200);
      expect(res.body.results).toHaveLength(2);
      expect(res.body.results[0].toolCallId).toBe("tc-1");
      expect(res.body.results[1].toolCallId).toBe("tc-2");
    });
  });

  // ─── bookAppointment ───
  describe("bookAppointment", () => {
    it("successfully books an appointment with correct data", async () => {
      const app = createTestApp();
      const futureDate = getNextMonday();

      const body = buildToolCallBody([
        {
          id: "tc-book-1",
          name: "bookAppointment",
          arguments: {
            guestName: "Alice Johnson",
            guestEmail: "alice@example.com",
            guestPhone: "+15551112222",
            date: futureDate,
            time: "10:00",
            notes: "First consultation",
          },
        },
      ]);

      const res = await request(app).post("/api/webhooks/vapi").send(body);
      expect(res.status).toBe(200);

      const result = JSON.parse(res.body.results[0].result);
      expect(result.success).toBe(true);
      expect(result.appointmentId).toBe(100);
      expect(result.message).toContain("Alice Johnson");

      // Verify createAppointment was called with correct params
      expect(mockCreateAppointment).toHaveBeenCalledTimes(1);
      const apptArg = mockCreateAppointment.mock.calls[0][0];
      expect(apptArg.calendarId).toBe(10);
      expect(apptArg.accountId).toBe(1);
      expect(apptArg.guestName).toBe("Alice Johnson");
      expect(apptArg.guestEmail).toBe("alice@example.com");
      expect(apptArg.status).toBe("confirmed");

      // Verify notification was created
      expect(mockCreateNotification).toHaveBeenCalledTimes(1);

      // Verify activity was logged
      expect(mockLogContactActivity).toHaveBeenCalledTimes(1);
    });

    it("returns validation error when missing required fields", async () => {
      const app = createTestApp();
      const body = buildToolCallBody([
        {
          id: "tc-val-1",
          name: "bookAppointment",
          arguments: {
            guestName: "Bob",
            // missing date and time
          },
        },
      ]);

      const res = await request(app).post("/api/webhooks/vapi").send(body);
      const result = JSON.parse(res.body.results[0].result);
      expect(result.success).toBe(false);
      expect(result.reason).toContain("date");
    });

    it("detects double-booking and returns conflict message", async () => {
      const app = createTestApp();
      const futureDate = getNextMonday();

      // Existing appointment at 10:00-10:30 ET
      // In EDT (UTC-4): 10:00 ET = 14:00 UTC
      mockGetAppointments.mockResolvedValue([
        {
          id: 50,
          calendarId: 10,
          accountId: 1,
          guestName: "Existing Guest",
          startTime: new Date(`${futureDate}T14:00:00Z`),
          endTime: new Date(`${futureDate}T14:30:00Z`),
          status: "confirmed",
        },
      ]);

      // Available slots after the conflict
      mockGetAvailableSlots.mockResolvedValue([
        { start: "09:00", end: "09:30" },
        { start: "10:30", end: "11:00" },
        { start: "11:00", end: "11:30" },
        { start: "14:00", end: "14:30" },
      ]);

      const body = buildToolCallBody([
        {
          id: "tc-double-1",
          name: "bookAppointment",
          arguments: {
            guestName: "Double Booker",
            guestPhone: "+15553334444",
            date: futureDate,
            time: "10:00",
          },
        },
      ]);

      const res = await request(app).post("/api/webhooks/vapi").send(body);
      const result = JSON.parse(res.body.results[0].result);
      expect(result.success).toBe(false);
      expect(result.reason).toContain("already booked");

      // Should NOT have created an appointment
      expect(mockCreateAppointment).not.toHaveBeenCalled();
    });

    it("ignores cancelled appointments when checking for conflicts", async () => {
      const app = createTestApp();
      const futureDate = getNextMonday();

      // Cancelled appointment at the same time — should not conflict
      mockGetAppointments.mockResolvedValue([
        {
          id: 51,
          calendarId: 10,
          accountId: 1,
          guestName: "Cancelled Guest",
          startTime: new Date(`${futureDate}T14:00:00Z`),
          endTime: new Date(`${futureDate}T14:30:00Z`),
          status: "cancelled",
        },
      ]);

      const body = buildToolCallBody([
        {
          id: "tc-cancel-1",
          name: "bookAppointment",
          arguments: {
            guestName: "New Guest",
            guestPhone: "+15555556666",
            date: futureDate,
            time: "10:00",
          },
        },
      ]);

      const res = await request(app).post("/api/webhooks/vapi").send(body);
      const result = JSON.parse(res.body.results[0].result);
      expect(result.success).toBe(true);
      expect(mockCreateAppointment).toHaveBeenCalledTimes(1);
    });

    it("links contact from AI call session via vapiCallId", async () => {
      const app = createTestApp();
      const futureDate = getNextMonday();

      mockGetAICallByExternalId.mockResolvedValue({
        id: 5,
        contactId: 42,
        accountId: 1,
      });

      const body = buildToolCallBody([
        {
          id: "tc-contact-1",
          name: "bookAppointment",
          arguments: {
            guestName: "Linked Contact",
            guestPhone: "+15557778888",
            date: futureDate,
            time: "11:00",
          },
        },
      ]);

      const res = await request(app).post("/api/webhooks/vapi").send(body);
      const result = JSON.parse(res.body.results[0].result);
      expect(result.success).toBe(true);

      const apptArg = mockCreateAppointment.mock.calls[0][0];
      expect(apptArg.contactId).toBe(42);
    });

    it("falls back to phone lookup when AI call has no contact", async () => {
      const app = createTestApp();
      const futureDate = getNextMonday();

      // AI call exists but has no contactId
      mockGetAICallByExternalId.mockResolvedValue({
        id: 6,
        contactId: 0,
        accountId: 1,
      });

      // Phone lookup finds the contact
      mockFindContactByPhone.mockResolvedValue({
        id: 99,
        phone: "+15559990000",
        accountId: 1,
      });

      const body = buildToolCallBody([
        {
          id: "tc-phone-1",
          name: "bookAppointment",
          arguments: {
            guestName: "Phone Lookup",
            guestPhone: "+15559990000",
            date: futureDate,
            time: "13:00",
          },
        },
      ]);

      const res = await request(app).post("/api/webhooks/vapi").send(body);
      const result = JSON.parse(res.body.results[0].result);
      expect(result.success).toBe(true);

      const apptArg = mockCreateAppointment.mock.calls[0][0];
      expect(apptArg.contactId).toBe(99);
    });

    it("handles missing contact gracefully (null contactId)", async () => {
      const app = createTestApp();
      const futureDate = getNextMonday();

      mockGetAICallByExternalId.mockResolvedValue(null);
      mockFindContactByPhone.mockResolvedValue(null);

      const body = buildToolCallBody([
        {
          id: "tc-nocontact-1",
          name: "bookAppointment",
          arguments: {
            guestName: "Unknown Contact",
            guestPhone: "+15550000000",
            date: futureDate,
            time: "15:00",
          },
        },
      ]);

      const res = await request(app).post("/api/webhooks/vapi").send(body);
      const result = JSON.parse(res.body.results[0].result);
      expect(result.success).toBe(true);

      const apptArg = mockCreateAppointment.mock.calls[0][0];
      expect(apptArg.contactId).toBeNull();
    });

    it("returns graceful error when createAppointment throws", async () => {
      const app = createTestApp();
      const futureDate = getNextMonday();

      mockCreateAppointment.mockRejectedValue(new Error("DB connection lost"));

      const body = buildToolCallBody([
        {
          id: "tc-err-1",
          name: "bookAppointment",
          arguments: {
            guestName: "Error Test",
            guestPhone: "+15551111111",
            date: futureDate,
            time: "10:00",
          },
        },
      ]);

      const res = await request(app).post("/api/webhooks/vapi").send(body);
      const result = JSON.parse(res.body.results[0].result);
      expect(result.success).toBe(false);
      expect(result.reason).toBe("System error, please try again");
    });

    it("rejects past time slots", async () => {
      const app = createTestApp();
      const pastDate = "2020-01-15";

      const body = buildToolCallBody([
        {
          id: "tc-past-1",
          name: "bookAppointment",
          arguments: {
            guestName: "Past Booker",
            guestPhone: "+15552222222",
            date: pastDate,
            time: "10:00",
          },
        },
      ]);

      const res = await request(app).post("/api/webhooks/vapi").send(body);
      const result = JSON.parse(res.body.results[0].result);
      expect(result.success).toBe(false);
      expect(result.reason).toContain("already passed");
    });

    it("returns no-calendar error when account has no calendar", async () => {
      const app = createTestApp();
      const futureDate = getNextMonday();

      mockGetCalendars.mockResolvedValue([]); // No calendars

      const body = buildToolCallBody([
        {
          id: "tc-nocal",
          name: "bookAppointment",
          arguments: {
            guestName: "No Calendar",
            guestPhone: "+15551234567",
            date: futureDate,
            time: "10:00",
          },
        },
      ]);

      const res = await request(app).post("/api/webhooks/vapi").send(body);
      const result = JSON.parse(res.body.results[0].result);
      expect(result.success).toBe(false);
      expect(result.reason).toContain("scheduling system");
    });
  });

  // ─── Timezone Conversion ───
  describe("Timezone Conversion", () => {
    it("converts Eastern Time to UTC correctly (EDT)", async () => {
      const app = createTestApp();
      // Use a date in EDT (April = EDT, UTC-4)
      const futureDate = getNextMondayInMonth(4);

      mockGetCalendar.mockResolvedValue({
        id: 10,
        accountId: 1,
        timezone: "America/New_York",
        slotDurationMinutes: 30,
        bufferMinutes: 15,
        isActive: true,
      });

      const body = buildToolCallBody([
        {
          id: "tc-tz-edt",
          name: "bookAppointment",
          arguments: {
            guestName: "EDT Test",
            guestPhone: "+15551234567",
            date: futureDate,
            time: "14:00",
          },
        },
      ]);

      const res = await request(app).post("/api/webhooks/vapi").send(body);
      const result = JSON.parse(res.body.results[0].result);
      expect(result.success).toBe(true);

      // 2 PM EDT = 6 PM UTC (UTC-4)
      const apptArg = mockCreateAppointment.mock.calls[0][0];
      const startUTC = new Date(apptArg.startTime);
      expect(startUTC.getUTCHours()).toBe(18);
    });

    it("uses Central Time when account is configured for it", async () => {
      const app = createTestApp();
      const futureDate = getNextMondayInMonth(7); // July Monday (CDT, UTC-5)

      mockGetCalendar.mockResolvedValue({
        id: 10,
        accountId: 1,
        timezone: "America/Chicago",
        slotDurationMinutes: 30,
        bufferMinutes: 15,
        isActive: true,
      });

      const body = buildToolCallBody([
        {
          id: "tc-tz-cdt",
          name: "bookAppointment",
          arguments: {
            guestName: "CDT Test",
            guestPhone: "+15551234567",
            date: futureDate,
            time: "10:00",
          },
        },
      ]);

      const res = await request(app).post("/api/webhooks/vapi").send(body);
      const result = JSON.parse(res.body.results[0].result);
      expect(result.success).toBe(true);

      // 10 AM CDT = 3 PM UTC (UTC-5)
      const apptArg = mockCreateAppointment.mock.calls[0][0];
      const startUTC = new Date(apptArg.startTime);
      expect(startUTC.getUTCHours()).toBe(15);
    });

    it("uses Pacific Time when account is configured for it", async () => {
      const app = createTestApp();
      const futureDate = getNextMondayInMonth(7); // July Monday (PDT, UTC-7)

      mockGetCalendar.mockResolvedValue({
        id: 10,
        accountId: 1,
        timezone: "America/Los_Angeles",
        slotDurationMinutes: 30,
        bufferMinutes: 15,
        isActive: true,
      });

      const body = buildToolCallBody([
        {
          id: "tc-tz-pdt",
          name: "bookAppointment",
          arguments: {
            guestName: "PDT Test",
            guestPhone: "+15551234567",
            date: futureDate,
            time: "09:00",
          },
        },
      ]);

      const res = await request(app).post("/api/webhooks/vapi").send(body);
      const result = JSON.parse(res.body.results[0].result);
      expect(result.success).toBe(true);

      // 9 AM PDT = 4 PM UTC (UTC-7)
      const apptArg = mockCreateAppointment.mock.calls[0][0];
      const startUTC = new Date(apptArg.startTime);
      expect(startUTC.getUTCHours()).toBe(16);
    });

    it("falls back to business hours timezone when calendar has no timezone", async () => {
      const app = createTestApp();
      const futureDate = getNextMonday();

      mockGetCalendar.mockResolvedValue({
        id: 10,
        accountId: 1,
        timezone: null,
        slotDurationMinutes: 30,
        bufferMinutes: 15,
        isActive: true,
      });

      mockGetAccountMessagingSettings.mockResolvedValue({
        businessHours: JSON.stringify({
          enabled: true,
          timezone: "America/Denver",
          schedule: {
            monday: { open: true, start: "07:00", end: "22:00" },
            tuesday: { open: true, start: "07:00", end: "22:00" },
            wednesday: { open: true, start: "07:00", end: "22:00" },
            thursday: { open: true, start: "07:00", end: "22:00" },
            friday: { open: true, start: "07:00", end: "22:00" },
            saturday: { open: true, start: "08:00", end: "20:00" },
            sunday: { open: false },
          },
        }),
      });

      const body = buildToolCallBody([
        {
          id: "tc-tz-fallback",
          name: "bookAppointment",
          arguments: {
            guestName: "Fallback TZ",
            guestPhone: "+15551234567",
            date: futureDate,
            time: "12:00",
          },
        },
      ]);

      const res = await request(app).post("/api/webhooks/vapi").send(body);
      const result = JSON.parse(res.body.results[0].result);
      expect(result.success).toBe(true);
      expect(mockCreateAppointment).toHaveBeenCalledTimes(1);
    });
  });

  // ─── checkAvailability ───
  describe("checkAvailability", () => {
    it("returns available slots for a date", async () => {
      const app = createTestApp();
      const futureDate = getNextMonday();

      mockGetAvailableSlots.mockResolvedValue([
        { start: "09:00", end: "09:30" },
        { start: "09:45", end: "10:15" },
        { start: "10:30", end: "11:00" },
        { start: "11:15", end: "11:45" },
        { start: "13:00", end: "13:30" },
        { start: "14:00", end: "14:30" },
      ]);

      const body = buildToolCallBody([
        {
          id: "tc-avail-1",
          name: "checkAvailability",
          arguments: { date: futureDate },
        },
      ]);

      const res = await request(app).post("/api/webhooks/vapi").send(body);
      const result = JSON.parse(res.body.results[0].result);
      expect(result.success).toBe(true);
      expect(result.available).toBe(true);
      expect(result.slots.length).toBeLessThanOrEqual(5);
      expect(result.timezone).toBe("America/New_York");
    });

    it("filters slots outside business hours", async () => {
      const app = createTestApp();
      const futureDate = getNextMonday();

      // Business hours default: 07:00-22:00 for weekdays
      // Override to narrow hours for this test
      mockGetAccountMessagingSettings.mockResolvedValue({
        businessHours: JSON.stringify({
          enabled: true,
          timezone: "America/New_York",
          schedule: {
            monday: { open: true, start: "09:00", end: "17:00" },
            tuesday: { open: true, start: "09:00", end: "17:00" },
            wednesday: { open: true, start: "09:00", end: "17:00" },
            thursday: { open: true, start: "09:00", end: "17:00" },
            friday: { open: true, start: "09:00", end: "17:00" },
            saturday: { open: false },
            sunday: { open: false },
          },
        }),
      });

      mockGetAvailableSlots.mockResolvedValue([
        { start: "07:00", end: "07:30" }, // before BH
        { start: "08:00", end: "08:30" }, // before BH
        { start: "09:00", end: "09:30" }, // within
        { start: "16:30", end: "17:00" }, // within
        { start: "17:00", end: "17:30" }, // at/after closing
        { start: "18:00", end: "18:30" }, // after BH
      ]);

      const body = buildToolCallBody([
        {
          id: "tc-bh-filter",
          name: "checkAvailability",
          arguments: { date: futureDate },
        },
      ]);

      const res = await request(app).post("/api/webhooks/vapi").send(body);
      const result = JSON.parse(res.body.results[0].result);
      expect(result.success).toBe(true);
      expect(result.available).toBe(true);
      // Only 09:00 and 16:30 should pass
      expect(result.slots).toHaveLength(2);
      expect(result.slots[0]).toContain("9:00");
      expect(result.slots[1]).toContain("4:30");
    });

    it("returns no availability on closed days and suggests alternatives", async () => {
      const app = createTestApp();
      const futureSunday = getNextSunday(); // Sunday is closed in default config

      // Calendar has slots but business hours will filter them out
      mockGetAvailableSlots.mockImplementation(async (_calId: number, date: string) => {
        return [
          { start: "09:00", end: "09:30" },
          { start: "10:00", end: "10:30" },
          { start: "11:00", end: "11:30" },
        ];
      });

      const body = buildToolCallBody([
        {
          id: "tc-closed",
          name: "checkAvailability",
          arguments: { date: futureSunday },
        },
      ]);

      const res = await request(app).post("/api/webhooks/vapi").send(body);
      const result = JSON.parse(res.body.results[0].result);
      expect(result.success).toBe(true);
      expect(result.available).toBe(false);
      // Should contain alternative suggestions
      expect(result.message).toContain("no available slots");
    });

    it("returns validation error when date is missing", async () => {
      const app = createTestApp();
      const body = buildToolCallBody([
        {
          id: "tc-nodate",
          name: "checkAvailability",
          arguments: {},
        },
      ]);

      const res = await request(app).post("/api/webhooks/vapi").send(body);
      const result = JSON.parse(res.body.results[0].result);
      expect(result.success).toBe(false);
      expect(result.reason).toContain("date");
    });

    it("returns graceful error when getCalendars throws", async () => {
      const app = createTestApp();
      const futureDate = getNextMonday();

      // getCalendars throws, but the try/catch in checkAvailability should catch it
      mockGetCalendars.mockRejectedValue(new Error("DB timeout"));

      const body = buildToolCallBody([
        {
          id: "tc-avail-err",
          name: "checkAvailability",
          arguments: { date: futureDate },
        },
      ]);

      const res = await request(app).post("/api/webhooks/vapi").send(body);
      const result = JSON.parse(res.body.results[0].result);
      expect(result.success).toBe(false);
      // The error is caught by the try/catch in handleCheckAvailability
      expect(result.reason).toBe("System error, please try again");
    });
  });

  // ─── Unknown tool calls ───
  describe("Unknown tool calls", () => {
    it("returns error for unknown function names", async () => {
      const app = createTestApp();
      const body = buildToolCallBody([
        {
          id: "tc-unknown",
          name: "transferCall",
          arguments: { to: "+15551234567" },
        },
      ]);

      const res = await request(app).post("/api/webhooks/vapi").send(body);
      expect(res.body.results[0].toolCallId).toBe("tc-unknown");
      expect(res.body.results[0].result).toContain("Unknown function");
    });
  });
});

// ─── Helper functions ───

function getNextMonday(): string {
  const now = new Date();
  now.setDate(now.getDate() + 30);
  const day = now.getDay();
  const diff = day === 0 ? 1 : day === 1 ? 7 : 8 - day;
  now.setDate(now.getDate() + diff);
  return now.toISOString().split("T")[0];
}

function getNextSunday(): string {
  const now = new Date();
  now.setDate(now.getDate() + 30);
  const day = now.getDay();
  const diff = day === 0 ? 7 : 7 - day;
  now.setDate(now.getDate() + diff);
  return now.toISOString().split("T")[0];
}

function getNextMondayInMonth(month: number): string {
  const year = new Date().getFullYear() + 1;
  const date = new Date(year, month - 1, 1);
  while (date.getDay() !== 1) {
    date.setDate(date.getDate() + 1);
  }
  date.setDate(date.getDate() + 7);
  return date.toISOString().split("T")[0];
}
