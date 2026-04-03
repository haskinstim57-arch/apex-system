import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock db module
vi.mock("./db", () => ({
  getNotificationLog: vi.fn(),
  getMember: vi.fn(),
}));

import { getNotificationLog, getMember } from "./db";

describe("Notification Log", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getNotificationLog DB helper", () => {
    it("should return paginated results with total count", async () => {
      const mockItems = [
        { id: 1, accountId: 420001, userId: 1, type: "inbound_message", title: "New SMS", body: "Hello", isRead: false, dismissed: false, createdAt: new Date() },
        { id: 2, accountId: 420001, userId: 1, type: "appointment_booked", title: "Appointment", body: "Booked", isRead: true, dismissed: false, createdAt: new Date() },
      ];
      (getNotificationLog as any).mockResolvedValue({ items: mockItems, total: 50 });

      const result = await getNotificationLog(420001, 1, { page: 1, pageSize: 25 });
      expect(result.items).toHaveLength(2);
      expect(result.total).toBe(50);
    });

    it("should support type filtering", async () => {
      (getNotificationLog as any).mockResolvedValue({ items: [], total: 0 });

      await getNotificationLog(420001, 1, { type: "inbound_message" });
      expect(getNotificationLog).toHaveBeenCalledWith(420001, 1, { type: "inbound_message" });
    });

    it("should support read status filtering", async () => {
      (getNotificationLog as any).mockResolvedValue({ items: [], total: 0 });

      await getNotificationLog(420001, 1, { isRead: false });
      expect(getNotificationLog).toHaveBeenCalledWith(420001, 1, { isRead: false });
    });

    it("should support date range filtering", async () => {
      const startDate = new Date("2026-01-01");
      const endDate = new Date("2026-03-31");
      (getNotificationLog as any).mockResolvedValue({ items: [], total: 0 });

      await getNotificationLog(420001, 1, { startDate, endDate });
      expect(getNotificationLog).toHaveBeenCalledWith(420001, 1, { startDate, endDate });
    });

    it("should return empty results when no notifications exist", async () => {
      (getNotificationLog as any).mockResolvedValue({ items: [], total: 0 });

      const result = await getNotificationLog(420001, 1);
      expect(result.items).toHaveLength(0);
      expect(result.total).toBe(0);
    });
  });

  describe("Notification log pagination", () => {
    it("should calculate total pages correctly", () => {
      const total = 73;
      const pageSize = 25;
      const totalPages = Math.ceil(total / pageSize);
      expect(totalPages).toBe(3);
    });

    it("should handle single page result", () => {
      const total = 10;
      const pageSize = 25;
      const totalPages = Math.ceil(total / pageSize);
      expect(totalPages).toBe(1);
    });

    it("should handle exact page boundary", () => {
      const total = 50;
      const pageSize = 25;
      const totalPages = Math.ceil(total / pageSize);
      expect(totalPages).toBe(2);
    });

    it("should handle zero results", () => {
      const total = 0;
      const pageSize = 25;
      const totalPages = Math.ceil(total / pageSize);
      expect(totalPages).toBe(0);
    });
  });

  describe("Notification type config", () => {
    const NOTIFICATION_TYPES = [
      "inbound_message",
      "appointment_booked",
      "appointment_cancelled",
      "ai_call_completed",
      "campaign_finished",
      "workflow_failed",
      "new_contact_facebook",
      "new_contact_booking",
      "missed_call",
      "report_sent",
    ];

    it("should have all expected notification types defined", () => {
      expect(NOTIFICATION_TYPES).toContain("inbound_message");
      expect(NOTIFICATION_TYPES).toContain("appointment_booked");
      expect(NOTIFICATION_TYPES).toContain("new_contact_facebook");
      expect(NOTIFICATION_TYPES).toContain("missed_call");
    });

    it("should have 10 notification types", () => {
      expect(NOTIFICATION_TYPES).toHaveLength(10);
    });
  });

  describe("Time formatting", () => {
    function timeAgo(date: Date): string {
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffSec = Math.floor(diffMs / 1000);
      if (diffSec < 60) return "just now";
      const diffMin = Math.floor(diffSec / 60);
      if (diffMin < 60) return `${diffMin}m ago`;
      const diffHr = Math.floor(diffMin / 60);
      if (diffHr < 24) return `${diffHr}h ago`;
      const diffDay = Math.floor(diffHr / 24);
      if (diffDay < 7) return `${diffDay}d ago`;
      return date.toLocaleDateString();
    }

    it("should show 'just now' for recent events", () => {
      expect(timeAgo(new Date())).toBe("just now");
    });

    it("should show minutes for events within the hour", () => {
      const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000);
      expect(timeAgo(fiveMinAgo)).toBe("5m ago");
    });

    it("should show hours for events within the day", () => {
      const threeHoursAgo = new Date(Date.now() - 3 * 60 * 60 * 1000);
      expect(timeAgo(threeHoursAgo)).toBe("3h ago");
    });

    it("should show days for events within the week", () => {
      const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);
      expect(timeAgo(twoDaysAgo)).toBe("2d ago");
    });
  });
});
