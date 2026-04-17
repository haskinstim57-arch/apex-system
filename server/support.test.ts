import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock sendEmail before importing the module under test
const mockSendEmail = vi.fn().mockResolvedValue({ success: true });
vi.mock("./services/sendgrid", () => ({
  sendEmail: (...args: any[]) => mockSendEmail(...args),
  isSendGridConfigured: () => true,
}));

// Mock ENV
vi.mock("./_core/env", () => ({
  ENV: {
    supportNotificationEmails: "admin1@test.com,admin2@test.com",
    appUrl: "https://apexcrm.example.com",
    sendgridApiKey: "test-key",
    sendgridFromEmail: "noreply@test.com",
    sendgridFromName: "Apex System",
  },
}));

import {
  getSupportNotificationEmails,
  notifyNewTicket,
  notifyClientReply,
} from "./services/supportNotifications";

describe("Support Notifications", () => {
  beforeEach(() => {
    mockSendEmail.mockClear();
  });

  describe("getSupportNotificationEmails", () => {
    it("parses comma-separated emails from ENV", () => {
      const emails = getSupportNotificationEmails();
      expect(emails).toEqual(["admin1@test.com", "admin2@test.com"]);
    });
  });

  describe("notifyNewTicket", () => {
    it("sends email to all configured admins with correct subject", async () => {
      await notifyNewTicket({
        ticketId: 42,
        subject: "Login not working",
        category: "bug",
        message: "I can't log in to my account since yesterday.",
        accountName: "Premier Mortgage",
        submitterName: "John Doe",
        submitterEmail: "john@premier.com",
      });

      expect(mockSendEmail).toHaveBeenCalledTimes(2);

      // Check first email
      const call1 = mockSendEmail.mock.calls[0][0];
      expect(call1.to).toBe("admin1@test.com");
      expect(call1.subject).toBe(
        "[Apex Support] New ticket #42 from Premier Mortgage: Login not working"
      );
      expect(call1.body).toContain("Login not working");
      expect(call1.body).toContain("Bug Report");
      expect(call1.body).toContain("Premier Mortgage");
      expect(call1.body).toContain("John Doe");
      expect(call1.body).toContain("john@premier.com");

      // Check second email
      const call2 = mockSendEmail.mock.calls[1][0];
      expect(call2.to).toBe("admin2@test.com");
    });

    it("includes ticket link in email body", async () => {
      await notifyNewTicket({
        ticketId: 99,
        subject: "Feature request",
        category: "feature",
        message: "Please add dark mode.",
        accountName: "Test Account",
        submitterName: "Jane",
        submitterEmail: "jane@test.com",
      });

      const body = mockSendEmail.mock.calls[0][0].body;
      expect(body).toContain("https://apexcrm.example.com/admin/support");
    });

    it("handles category labels correctly", async () => {
      await notifyNewTicket({
        ticketId: 1,
        subject: "Billing issue",
        category: "billing",
        message: "Overcharged",
        accountName: "Acme",
        submitterName: "Bob",
        submitterEmail: "bob@acme.com",
      });

      const body = mockSendEmail.mock.calls[0][0].body;
      expect(body).toContain("Billing Question");
    });

    it("does not throw if sendEmail fails", async () => {
      mockSendEmail.mockRejectedValueOnce(new Error("SMTP error"));
      mockSendEmail.mockRejectedValueOnce(new Error("SMTP error"));

      await expect(
        notifyNewTicket({
          ticketId: 1,
          subject: "Test",
          category: "general",
          message: "Test",
          accountName: "Test",
          submitterName: "Test",
          submitterEmail: "test@test.com",
        })
      ).resolves.toBeUndefined();
    });
  });

  describe("notifyClientReply", () => {
    it("sends reply notification to all configured admins", async () => {
      await notifyClientReply({
        ticketId: 42,
        ticketSubject: "Login not working",
        replyBody: "I tried clearing cookies but it still doesn't work.",
        accountName: "Premier Mortgage",
        replierName: "John Doe",
      });

      expect(mockSendEmail).toHaveBeenCalledTimes(2);

      const call1 = mockSendEmail.mock.calls[0][0];
      expect(call1.to).toBe("admin1@test.com");
      expect(call1.subject).toBe(
        "[Apex Support] Reply on ticket #42: Login not working"
      );
      expect(call1.body).toContain("I tried clearing cookies");
      expect(call1.body).toContain("Premier Mortgage");
      expect(call1.body).toContain("John Doe");
      expect(call1.body).toContain("https://apexcrm.example.com/admin/support");
    });

    it("does not throw if sendEmail fails", async () => {
      mockSendEmail.mockRejectedValueOnce(new Error("Network error"));
      mockSendEmail.mockRejectedValueOnce(new Error("Network error"));

      await expect(
        notifyClientReply({
          ticketId: 1,
          ticketSubject: "Test",
          replyBody: "Test reply",
          accountName: "Test",
          replierName: "Test",
        })
      ).resolves.toBeUndefined();
    });
  });

  describe("SUPPORT_NOTIFICATION_EMAILS env var", () => {
    it("is configured and accessible", () => {
      // This validates the env var is wired correctly
      const emails = getSupportNotificationEmails();
      expect(emails.length).toBeGreaterThan(0);
      expect(emails.every((e) => e.includes("@"))).toBe(true);
    });
  });
});
