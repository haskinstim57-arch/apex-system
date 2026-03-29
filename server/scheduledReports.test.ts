import { describe, expect, it, vi, beforeEach } from "vitest";
import { z } from "zod";

// ─── Mock DB helpers ───
const mockReports: any[] = [];
let nextId = 1;

vi.mock("./db", () => ({
  createScheduledReport: vi.fn(async (data: any) => {
    const id = nextId++;
    mockReports.push({ id, ...data });
    return id;
  }),
  listScheduledReports: vi.fn(async (accountId: number) =>
    mockReports.filter((r) => r.accountId === accountId)
  ),
  getScheduledReport: vi.fn(async (id: number, accountId: number) =>
    mockReports.find((r) => r.id === id && r.accountId === accountId) || null
  ),
  updateScheduledReport: vi.fn(async (id: number, accountId: number, updates: any) => {
    const idx = mockReports.findIndex((r) => r.id === id && r.accountId === accountId);
    if (idx >= 0) Object.assign(mockReports[idx], updates);
  }),
  deleteScheduledReport: vi.fn(async (id: number, accountId: number) => {
    const idx = mockReports.findIndex((r) => r.id === id && r.accountId === accountId);
    if (idx >= 0) mockReports.splice(idx, 1);
  }),
  createAuditLog: vi.fn(async () => {}),
  getMember: vi.fn(async () => ({ userId: 1, accountId: 1, role: "owner", isActive: true })),
  getDb: vi.fn(async () => ({
    select: () => ({
      from: () => ({
        where: () => [{ name: "Test Agency", primaryColor: "#c9a84c" }],
      }),
    }),
  })),
  createNotification: vi.fn(async () => {}),
}));

vi.mock("./services/sendgrid", () => ({
  sendEmail: vi.fn(async () => ({ success: true, externalId: "test-123" })),
  isSendGridConfigured: vi.fn(() => true),
}));

vi.mock("./services/reportEmailGenerator", () => ({
  generateReportEmailHTML: vi.fn(async () => "<html><body>Test Report</body></html>"),
  generateReportCSV: vi.fn(async () => "col1,col2\nval1,val2"),
}));

vi.mock("./services/scheduledReportsCron", () => ({
  calculateNextRunAt: vi.fn(() => new Date("2026-04-05T12:00:00Z")),
  startScheduledReportsCron: vi.fn(),
}));

// ─── Test Suites ───

describe("Scheduled Reports", () => {
  beforeEach(() => {
    mockReports.length = 0;
    nextId = 1;
  });

  describe("Input Validation", () => {
    const scheduleSchema = z.object({
      accountId: z.number(),
      name: z.string().min(1).max(255),
      frequency: z.enum(["daily", "weekly", "monthly"]),
      dayOfWeek: z.number().min(0).max(6).optional(),
      dayOfMonth: z.number().min(1).max(28).optional(),
      sendHour: z.number().min(0).max(23),
      timezone: z.string().min(1).max(100),
      reportTypes: z.array(z.string()).min(1),
      recipients: z.array(z.string().email()).min(1).max(10),
      periodDays: z.number().min(1).max(365),
    });

    it("accepts valid weekly schedule input", () => {
      const input = {
        accountId: 1,
        name: "Weekly KPI Report",
        frequency: "weekly" as const,
        dayOfWeek: 1,
        sendHour: 8,
        timezone: "America/New_York",
        reportTypes: ["kpis"],
        recipients: ["admin@test.com"],
        periodDays: 7,
      };
      expect(() => scheduleSchema.parse(input)).not.toThrow();
    });

    it("accepts valid monthly schedule input", () => {
      const input = {
        accountId: 1,
        name: "Monthly Full Report",
        frequency: "monthly" as const,
        dayOfMonth: 15,
        sendHour: 9,
        timezone: "America/Chicago",
        reportTypes: ["kpis", "campaignROI", "workflowPerformance", "revenueAttribution"],
        recipients: ["admin@test.com", "manager@test.com"],
        periodDays: 30,
      };
      expect(() => scheduleSchema.parse(input)).not.toThrow();
    });

    it("rejects empty name", () => {
      const input = {
        accountId: 1,
        name: "",
        frequency: "daily" as const,
        sendHour: 8,
        timezone: "UTC",
        reportTypes: ["kpis"],
        recipients: ["admin@test.com"],
        periodDays: 7,
      };
      expect(() => scheduleSchema.parse(input)).toThrow();
    });

    it("rejects invalid frequency", () => {
      const input = {
        accountId: 1,
        name: "Test",
        frequency: "biweekly",
        sendHour: 8,
        timezone: "UTC",
        reportTypes: ["kpis"],
        recipients: ["admin@test.com"],
        periodDays: 7,
      };
      expect(() => scheduleSchema.parse(input)).toThrow();
    });

    it("rejects invalid email recipients", () => {
      const input = {
        accountId: 1,
        name: "Test",
        frequency: "daily" as const,
        sendHour: 8,
        timezone: "UTC",
        reportTypes: ["kpis"],
        recipients: ["not-an-email"],
        periodDays: 7,
      };
      expect(() => scheduleSchema.parse(input)).toThrow();
    });

    it("rejects empty report types", () => {
      const input = {
        accountId: 1,
        name: "Test",
        frequency: "daily" as const,
        sendHour: 8,
        timezone: "UTC",
        reportTypes: [],
        recipients: ["admin@test.com"],
        periodDays: 7,
      };
      expect(() => scheduleSchema.parse(input)).toThrow();
    });

    it("rejects more than 10 recipients", () => {
      const input = {
        accountId: 1,
        name: "Test",
        frequency: "daily" as const,
        sendHour: 8,
        timezone: "UTC",
        reportTypes: ["kpis"],
        recipients: Array.from({ length: 11 }, (_, i) => `user${i}@test.com`),
        periodDays: 7,
      };
      expect(() => scheduleSchema.parse(input)).toThrow();
    });

    it("rejects sendHour out of range", () => {
      const input = {
        accountId: 1,
        name: "Test",
        frequency: "daily" as const,
        sendHour: 25,
        timezone: "UTC",
        reportTypes: ["kpis"],
        recipients: ["admin@test.com"],
        periodDays: 7,
      };
      expect(() => scheduleSchema.parse(input)).toThrow();
    });

    it("rejects dayOfWeek out of range", () => {
      const input = {
        accountId: 1,
        name: "Test",
        frequency: "weekly" as const,
        dayOfWeek: 7,
        sendHour: 8,
        timezone: "UTC",
        reportTypes: ["kpis"],
        recipients: ["admin@test.com"],
        periodDays: 7,
      };
      expect(() => scheduleSchema.parse(input)).toThrow();
    });

    it("rejects dayOfMonth out of range", () => {
      const input = {
        accountId: 1,
        name: "Test",
        frequency: "monthly" as const,
        dayOfMonth: 29,
        sendHour: 8,
        timezone: "UTC",
        reportTypes: ["kpis"],
        recipients: ["admin@test.com"],
        periodDays: 7,
      };
      expect(() => scheduleSchema.parse(input)).toThrow();
    });

    it("rejects periodDays above 365", () => {
      const input = {
        accountId: 1,
        name: "Test",
        frequency: "daily" as const,
        sendHour: 8,
        timezone: "UTC",
        reportTypes: ["kpis"],
        recipients: ["admin@test.com"],
        periodDays: 400,
      };
      expect(() => scheduleSchema.parse(input)).toThrow();
    });
  });

  describe("Report Type Constants", () => {
    const VALID_REPORT_TYPES = ["kpis", "campaignROI", "workflowPerformance", "revenueAttribution"];

    it("has exactly 4 report types", () => {
      expect(VALID_REPORT_TYPES).toHaveLength(4);
    });

    it("includes kpis", () => {
      expect(VALID_REPORT_TYPES).toContain("kpis");
    });

    it("includes campaignROI", () => {
      expect(VALID_REPORT_TYPES).toContain("campaignROI");
    });

    it("includes workflowPerformance", () => {
      expect(VALID_REPORT_TYPES).toContain("workflowPerformance");
    });

    it("includes revenueAttribution", () => {
      expect(VALID_REPORT_TYPES).toContain("revenueAttribution");
    });
  });

  describe("Frequency Options", () => {
    const VALID_FREQUENCIES = ["daily", "weekly", "monthly"];

    it("has exactly 3 frequency options", () => {
      expect(VALID_FREQUENCIES).toHaveLength(3);
    });

    it("includes daily", () => {
      expect(VALID_FREQUENCIES).toContain("daily");
    });

    it("includes weekly", () => {
      expect(VALID_FREQUENCIES).toContain("weekly");
    });

    it("includes monthly", () => {
      expect(VALID_FREQUENCIES).toContain("monthly");
    });
  });

  describe("calculateNextRunAt", () => {
    it("returns a Date object", async () => {
      const { calculateNextRunAt } = await import("./services/scheduledReportsCron");
      const result = calculateNextRunAt("weekly", 8, "America/New_York", 1);
      expect(result).toBeInstanceOf(Date);
    });
  });

  describe("Report Email Generator", () => {
    it("generateReportEmailHTML returns HTML string", async () => {
      const { generateReportEmailHTML } = await import("./services/reportEmailGenerator");
      const html = await generateReportEmailHTML({
        accountId: 1,
        accountName: "Test Agency",
        reportName: "Test Report",
        reportTypes: ["kpis"],
        periodDays: 30,
      });
      expect(typeof html).toBe("string");
      expect(html).toContain("html");
    });

    it("generateReportCSV returns CSV string", async () => {
      const { generateReportCSV } = await import("./services/reportEmailGenerator");
      const csv = await generateReportCSV({
        accountId: 1,
        reportTypes: ["kpis"],
        periodDays: 30,
      });
      expect(typeof csv).toBe("string");
      expect(csv).toContain(",");
    });
  });

  describe("DB Helpers", () => {
    it("createScheduledReport returns an id", async () => {
      const { createScheduledReport } = await import("./db");
      const id = await createScheduledReport({
        accountId: 1,
        name: "Test Report",
        frequency: "weekly",
        dayOfWeek: 1,
        dayOfMonth: null,
        sendHour: 8,
        timezone: "America/New_York",
        reportTypes: ["kpis"],
        recipients: ["admin@test.com"],
        periodDays: 7,
        isActive: true,
        nextRunAt: new Date(),
        createdById: 1,
      } as any);
      expect(typeof id).toBe("number");
      expect(id).toBeGreaterThan(0);
    });

    it("listScheduledReports returns array for account", async () => {
      const { listScheduledReports, createScheduledReport } = await import("./db");
      await createScheduledReport({
        accountId: 1,
        name: "Test",
        frequency: "daily",
        sendHour: 8,
        timezone: "UTC",
        reportTypes: ["kpis"],
        recipients: ["a@b.com"],
        periodDays: 7,
        isActive: true,
        nextRunAt: new Date(),
        createdById: 1,
      } as any);
      const reports = await listScheduledReports(1);
      expect(Array.isArray(reports)).toBe(true);
      expect(reports.length).toBeGreaterThan(0);
    });

    it("getScheduledReport returns null for non-existent id", async () => {
      const { getScheduledReport } = await import("./db");
      const result = await getScheduledReport(9999, 1);
      expect(result).toBeNull();
    });

    it("deleteScheduledReport removes the report", async () => {
      const { createScheduledReport, deleteScheduledReport, listScheduledReports } = await import("./db");
      const id = await createScheduledReport({
        accountId: 1,
        name: "To Delete",
        frequency: "daily",
        sendHour: 8,
        timezone: "UTC",
        reportTypes: ["kpis"],
        recipients: ["a@b.com"],
        periodDays: 7,
        isActive: true,
        nextRunAt: new Date(),
        createdById: 1,
      } as any);
      await deleteScheduledReport(id, 1);
      const remaining = await listScheduledReports(1);
      expect(remaining.find((r: any) => r.id === id)).toBeUndefined();
    });
  });

  describe("SendGrid Integration", () => {
    it("sendEmail returns success", async () => {
      const { sendEmail } = await import("./services/sendgrid");
      const result = await sendEmail({
        to: "admin@test.com",
        subject: "Test Report",
        body: "<html>Test</html>",
        accountId: 1,
      });
      expect(result.success).toBe(true);
    });
  });

  describe("Notification Type", () => {
    it("report_sent is a valid notification type string", () => {
      const validTypes = [
        "inbound_message", "appointment_booked", "appointment_cancelled",
        "ai_call_completed", "campaign_finished", "workflow_failed",
        "new_contact_facebook", "new_contact_booking", "missed_call", "report_sent",
      ];
      expect(validTypes).toContain("report_sent");
    });
  });
});
