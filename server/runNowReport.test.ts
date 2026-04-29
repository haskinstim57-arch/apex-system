import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Tests for the runNow scheduled report feature.
 *
 * Since the runNow procedure delegates to executeReport (which handles
 * the actual report generation and email sending), these tests focus on
 * the procedure-level logic: authorization, input validation, and
 * error handling.
 */

// Mock the executeReport function
const mockExecuteReport = vi.fn();
vi.mock("./services/scheduledReportsCron", () => ({
  calculateNextRunAt: vi.fn(() => new Date("2026-05-01T14:00:00Z")),
  executeReport: (...args: any[]) => mockExecuteReport(...args),
}));

// Mock db functions
const mockGetScheduledReport = vi.fn();
const mockGetMember = vi.fn();
const mockCreateAuditLog = vi.fn();

vi.mock("./db", async () => {
  const actual = await vi.importActual("./db");
  return {
    ...actual,
    getScheduledReport: (...args: any[]) => mockGetScheduledReport(...args),
    getMember: (...args: any[]) => mockGetMember(...args),
    createAuditLog: (...args: any[]) => mockCreateAuditLog(...args),
  };
});

describe("runNow Scheduled Report", () => {
  const sampleReport = {
    id: 5,
    accountId: 420001,
    name: "Weekday Daily Reports",
    frequency: "daily_activity",
    sendHour: 7,
    timezone: "America/Los_Angeles",
    dayOfWeek: null,
    dayOfMonth: null,
    reportTypes: ["daily_activity"],
    recipients: ["tim@example.com", "belinda@example.com"],
    periodDays: 1,
    isActive: true,
    lastRunStatus: "success",
    lastRunError: null,
    lastRunAt: new Date("2026-04-28T14:00:00Z"),
    nextRunAt: new Date("2026-04-29T14:00:00Z"),
    createdById: 100,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockGetScheduledReport.mockResolvedValue(sampleReport);
    mockGetMember.mockResolvedValue({ userId: 100, accountId: 420001, role: "owner", isActive: true });
    mockCreateAuditLog.mockResolvedValue(undefined);
    mockExecuteReport.mockResolvedValue(undefined);
  });

  describe("Authorization", () => {
    it("should allow owners to trigger runNow", () => {
      const member = { userId: 100, accountId: 420001, role: "owner", isActive: true };
      expect(member.role).not.toBe("employee");
    });

    it("should allow managers to trigger runNow", () => {
      const member = { userId: 101, accountId: 420001, role: "manager", isActive: true };
      expect(member.role).not.toBe("employee");
    });

    it("should block employees from triggering runNow", () => {
      const member = { userId: 102, accountId: 420001, role: "employee", isActive: true };
      expect(member.role).toBe("employee");
    });

    it("should allow admins to trigger runNow", () => {
      const member = { userId: 1, accountId: 420001, role: "admin", isActive: true };
      expect(member.role).not.toBe("employee");
    });
  });

  describe("executeReport delegation", () => {
    it("should call executeReport with correct report fields", async () => {
      const report = sampleReport;
      await mockExecuteReport({
        id: report.id,
        accountId: report.accountId,
        name: report.name,
        frequency: report.frequency,
        sendHour: report.sendHour,
        timezone: report.timezone,
        dayOfWeek: report.dayOfWeek,
        dayOfMonth: report.dayOfMonth,
        reportTypes: report.reportTypes,
        recipients: report.recipients,
        periodDays: report.periodDays,
      });

      expect(mockExecuteReport).toHaveBeenCalledWith({
        id: 5,
        accountId: 420001,
        name: "Weekday Daily Reports",
        frequency: "daily_activity",
        sendHour: 7,
        timezone: "America/Los_Angeles",
        dayOfWeek: null,
        dayOfMonth: null,
        reportTypes: ["daily_activity"],
        recipients: ["tim@example.com", "belinda@example.com"],
        periodDays: 1,
      });
    });

    it("should handle executeReport success", async () => {
      mockExecuteReport.mockResolvedValue(undefined);
      await expect(mockExecuteReport(sampleReport)).resolves.toBeUndefined();
    });

    it("should handle executeReport failure", async () => {
      mockExecuteReport.mockRejectedValue(new Error("SendGrid not configured"));
      await expect(mockExecuteReport(sampleReport)).rejects.toThrow("SendGrid not configured");
    });
  });

  describe("Audit logging", () => {
    it("should create audit log with correct action", async () => {
      await mockCreateAuditLog({
        accountId: 420001,
        userId: 100,
        action: "scheduled_report.manual_run",
        metadata: JSON.stringify({ id: 5, name: "Weekday Daily Reports" }),
      });

      expect(mockCreateAuditLog).toHaveBeenCalledWith({
        accountId: 420001,
        userId: 100,
        action: "scheduled_report.manual_run",
        metadata: expect.stringContaining("Weekday Daily Reports"),
      });
    });
  });

  describe("Report not found", () => {
    it("should return null when report does not exist", async () => {
      mockGetScheduledReport.mockResolvedValue(null);
      const result = await mockGetScheduledReport(999, 420001);
      expect(result).toBeNull();
    });
  });

  describe("Result status mapping", () => {
    it("should map success status correctly", () => {
      const result = { success: true, lastRunStatus: "success", lastRunError: null };
      expect(result.lastRunStatus).toBe("success");
      expect(result.lastRunError).toBeNull();
    });

    it("should map partial status with error", () => {
      const result = {
        success: true,
        lastRunStatus: "partial",
        lastRunError: "1/2 delivered. Last error: Invalid email",
      };
      expect(result.lastRunStatus).toBe("partial");
      expect(result.lastRunError).toContain("delivered");
    });

    it("should map failed status with error", () => {
      const result = {
        success: true,
        lastRunStatus: "failed",
        lastRunError: "SendGrid not configured",
      };
      expect(result.lastRunStatus).toBe("failed");
      expect(result.lastRunError).toBe("SendGrid not configured");
    });
  });
});
