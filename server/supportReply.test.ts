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
  notifyClientReply,
  notifyStaffReply,
} from "./services/supportNotifications";

describe("Support Reply Notifications", () => {
  beforeEach(() => {
    mockSendEmail.mockClear();
  });

  // ─── Staff Reply → Email to Client ──────────────────────────────────

  describe("notifyStaffReply (staff reply → email to client)", () => {
    it("sends email to the ticket submitter with correct subject and body", async () => {
      await notifyStaffReply({
        ticketId: 42,
        ticketSubject: "Login not working",
        replyBody: "We've identified the issue and deployed a fix. Please try again.",
        staffName: "Admin Sarah",
        clientEmail: "john@premier.com",
        clientName: "John Doe",
      });

      expect(mockSendEmail).toHaveBeenCalledTimes(1);

      const call = mockSendEmail.mock.calls[0][0];
      expect(call.to).toBe("john@premier.com");
      expect(call.subject).toBe(
        "[Apex Support] Reply on your ticket #42: Login not working"
      );
      expect(call.body).toContain("Admin Sarah");
      expect(call.body).toContain("Login not working");
      expect(call.body).toContain("We've identified the issue");
      expect(call.body).toContain("John Doe");
    });

    it("does NOT send to admin list — only to the client", async () => {
      await notifyStaffReply({
        ticketId: 10,
        ticketSubject: "Billing question",
        replyBody: "Your invoice has been corrected.",
        staffName: "Support Bot",
        clientEmail: "client@example.com",
        clientName: "Client User",
      });

      // Only 1 email to the client, not 2 to admin list
      expect(mockSendEmail).toHaveBeenCalledTimes(1);
      expect(mockSendEmail.mock.calls[0][0].to).toBe("client@example.com");
    });

    it("skips sending if clientEmail is empty", async () => {
      await notifyStaffReply({
        ticketId: 5,
        ticketSubject: "Test",
        replyBody: "Reply body",
        staffName: "Staff",
        clientEmail: "",
        clientName: "No Email User",
      });

      expect(mockSendEmail).not.toHaveBeenCalled();
    });

    it("does not throw if sendEmail fails", async () => {
      mockSendEmail.mockRejectedValueOnce(new Error("SMTP error"));

      await expect(
        notifyStaffReply({
          ticketId: 1,
          ticketSubject: "Test",
          replyBody: "Test reply",
          staffName: "Staff",
          clientEmail: "client@test.com",
          clientName: "Client",
        })
      ).resolves.toBeUndefined();
    });

    it("includes ticket link in email body when appUrl is set", async () => {
      await notifyStaffReply({
        ticketId: 99,
        ticketSubject: "Feature request",
        replyBody: "We'll add this to our roadmap.",
        staffName: "Product Team",
        clientEmail: "user@example.com",
        clientName: "User",
      });

      const body = mockSendEmail.mock.calls[0][0].body;
      expect(body).toContain("https://apexcrm.example.com/support");
    });
  });

  // ─── Client Reply → Email to Admin List ─────────────────────────────

  describe("notifyClientReply (client reply → email to admin list)", () => {
    it("sends email to all configured admins, not to the client", async () => {
      await notifyClientReply({
        ticketId: 42,
        ticketSubject: "Login not working",
        replyBody: "I tried clearing cookies but it still doesn't work.",
        accountName: "Premier Mortgage",
        replierName: "John Doe",
      });

      // Should send to both admin emails
      expect(mockSendEmail).toHaveBeenCalledTimes(2);
      expect(mockSendEmail.mock.calls[0][0].to).toBe("admin1@test.com");
      expect(mockSendEmail.mock.calls[1][0].to).toBe("admin2@test.com");
    });

    it("contains the reply body and replier name in the email", async () => {
      await notifyClientReply({
        ticketId: 42,
        ticketSubject: "Login not working",
        replyBody: "Still broken after clearing cache.",
        accountName: "Premier Mortgage",
        replierName: "John Doe",
      });

      const body = mockSendEmail.mock.calls[0][0].body;
      expect(body).toContain("Still broken after clearing cache.");
      expect(body).toContain("John Doe");
      expect(body).toContain("Premier Mortgage");
    });
  });

  // ─── Thread Order ───────────────────────────────────────────────────

  describe("Thread order correctness", () => {
    it("staff and client replies are independent notification channels — no messages lost", async () => {
      // Simulate a conversation: client → staff → client → staff
      // Each call should succeed independently

      // 1. Client reply
      mockSendEmail.mockClear();
      await notifyClientReply({
        ticketId: 1,
        ticketSubject: "Help",
        replyBody: "First client message",
        accountName: "Acme",
        replierName: "Client A",
      });
      expect(mockSendEmail).toHaveBeenCalledTimes(2); // 2 admins

      // 2. Staff reply
      mockSendEmail.mockClear();
      await notifyStaffReply({
        ticketId: 1,
        ticketSubject: "Help",
        replyBody: "Staff response 1",
        staffName: "Agent B",
        clientEmail: "clienta@acme.com",
        clientName: "Client A",
      });
      expect(mockSendEmail).toHaveBeenCalledTimes(1); // 1 client

      // 3. Client reply again
      mockSendEmail.mockClear();
      await notifyClientReply({
        ticketId: 1,
        ticketSubject: "Help",
        replyBody: "Second client message",
        accountName: "Acme",
        replierName: "Client A",
      });
      expect(mockSendEmail).toHaveBeenCalledTimes(2); // 2 admins

      // 4. Staff reply again
      mockSendEmail.mockClear();
      await notifyStaffReply({
        ticketId: 1,
        ticketSubject: "Help",
        replyBody: "Staff response 2",
        staffName: "Agent B",
        clientEmail: "clienta@acme.com",
        clientName: "Client A",
      });
      expect(mockSendEmail).toHaveBeenCalledTimes(1); // 1 client

      // Total: all 4 notification rounds completed without errors
    });

    it("each notification contains the correct reply body for its turn", async () => {
      mockSendEmail.mockClear();

      await notifyStaffReply({
        ticketId: 7,
        ticketSubject: "Bug",
        replyBody: "We deployed fix v2.1",
        staffName: "DevOps",
        clientEmail: "user@test.com",
        clientName: "User",
      });

      const staffBody = mockSendEmail.mock.calls[0][0].body;
      expect(staffBody).toContain("We deployed fix v2.1");
      expect(staffBody).not.toContain("Some other message");

      mockSendEmail.mockClear();

      await notifyClientReply({
        ticketId: 7,
        ticketSubject: "Bug",
        replyBody: "Confirmed working now, thanks!",
        accountName: "Test Co",
        replierName: "User",
      });

      const clientBody = mockSendEmail.mock.calls[0][0].body;
      expect(clientBody).toContain("Confirmed working now, thanks!");
      expect(clientBody).not.toContain("We deployed fix v2.1");
    });
  });
});
