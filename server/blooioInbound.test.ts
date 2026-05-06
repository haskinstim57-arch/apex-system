import { describe, it, expect, vi, beforeEach } from "vitest";
import express from "express";
import request from "supertest";

// Mock the db module
vi.mock("../server/db", () => ({
  createMessage: vi.fn().mockResolvedValue({ id: 42 }),
  findContactByPhone: vi.fn().mockResolvedValue(null),
  findContactByEmail: vi.fn().mockResolvedValue(null),
  getAccountById: vi.fn().mockResolvedValue(null),
  getAccountMessagingSettings: vi.fn().mockResolvedValue(null),
  logContactActivity: vi.fn().mockResolvedValue(undefined),
  createNotification: vi.fn().mockResolvedValue(undefined),
  getDb: vi.fn().mockResolvedValue(null),
}));

vi.mock("../server/services/webPush", () => ({
  sendPushNotificationToAccount: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../server/services/smsCompliance", () => ({
  detectComplianceKeyword: vi.fn().mockReturnValue({ action: "none" }),
  processOptOut: vi.fn(),
  processOptIn: vi.fn(),
  processHelpRequest: vi.fn(),
  logAutoReplySent: vi.fn(),
}));

vi.mock("../server/services/billedDispatch", () => ({
  billedDispatchSMS: vi.fn(),
}));

vi.mock("../server/services/messaging", () => ({
  dispatchSMS: vi.fn(),
}));

vi.mock("../../drizzle/schema", () => ({
  accountMessagingSettings: {},
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn(),
  isNotNull: vi.fn(),
}));

vi.mock("../server/services/workflowTriggers", () => ({
  onInboundMessageReceived: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../server/services/sequenceAutoStop", () => ({
  onInboundSmsAutoStop: vi.fn().mockResolvedValue(undefined),
  onInboundEmailAutoStop: vi.fn().mockResolvedValue(undefined),
}));

import {
  createMessage,
  findContactByPhone,
  getAccountById,
  logContactActivity,
  createNotification,
} from "../server/db";
import { sendPushNotificationToAccount } from "../server/services/webPush";

// We need to import the router after mocks are set up
import { inboundMessageRouter } from "../server/webhooks/inboundMessages";

function createApp() {
  const app = express();
  app.use(express.json());
  app.use(inboundMessageRouter);
  return app;
}

describe("Blooio Inbound Webhook - POST /api/webhooks/blooio/inbound/:accountId", () => {
  let app: express.Express;

  beforeEach(() => {
    vi.clearAllMocks();
    app = createApp();
  });

  it("returns 400 for invalid accountId (non-numeric)", async () => {
    const res = await request(app)
      .post("/api/webhooks/blooio/inbound/abc")
      .send({ from: "+15551234567", body: "Hello" });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe("Invalid accountId");
  });

  it("returns 200 with missing fields reason when from is missing", async () => {
    const res = await request(app)
      .post("/api/webhooks/blooio/inbound/1")
      .send({ body: "Hello" });

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(false);
    expect(res.body.reason).toBe("missing fields");
  });

  it("returns 200 with missing fields reason when body is missing", async () => {
    const res = await request(app)
      .post("/api/webhooks/blooio/inbound/1")
      .send({ from: "+15551234567" });

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(false);
    expect(res.body.reason).toBe("missing fields");
  });

  it("returns 404 when account does not exist", async () => {
    vi.mocked(getAccountById).mockResolvedValueOnce(null);

    const res = await request(app)
      .post("/api/webhooks/blooio/inbound/999")
      .send({ from: "+15551234567", body: "Hello" });

    expect(res.status).toBe(404);
    expect(res.body.error).toBe("Account not found");
    expect(getAccountById).toHaveBeenCalledWith(999);
  });

  it("returns 200 with contactFound=false when no matching contact", async () => {
    vi.mocked(getAccountById).mockResolvedValueOnce({ id: 1, name: "Test" } as any);
    vi.mocked(findContactByPhone).mockResolvedValueOnce(null);

    const res = await request(app)
      .post("/api/webhooks/blooio/inbound/1")
      .send({ from: "+15551234567", body: "Hello" });

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.contactFound).toBe(false);
  });

  it("creates message, logs activity, and sends notification on successful match", async () => {
    const mockContact = {
      id: 10,
      firstName: "John",
      lastName: "Doe",
      assignedUserId: 5,
    };

    vi.mocked(getAccountById).mockResolvedValueOnce({ id: 1, name: "Test" } as any);
    vi.mocked(findContactByPhone).mockResolvedValueOnce(mockContact as any);
    vi.mocked(createMessage).mockResolvedValueOnce({ id: 42 } as any);

    const res = await request(app)
      .post("/api/webhooks/blooio/inbound/1")
      .send({
        from: "+15551234567",
        to: "+15559876543",
        body: "I'm interested in refinancing",
        id: "blooio-msg-123",
        type: "sms",
      });

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.messageId).toBe(42);

    // Verify createMessage was called with correct params
    expect(createMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        accountId: 1,
        contactId: 10,
        type: "sms",
        direction: "inbound",
        status: "delivered",
        body: "I'm interested in refinancing",
        fromAddress: "+15551234567",
        toAddress: "+15559876543",
        externalId: "blooio-msg-123",
        isRead: false,
      })
    );

    // Verify activity logged
    expect(logContactActivity).toHaveBeenCalledWith(
      expect.objectContaining({
        contactId: 10,
        accountId: 1,
        activityType: "message_received",
      })
    );

    // Verify notification created
    expect(createNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        accountId: 1,
        userId: 5,
        type: "inbound_message",
      })
    );

    // Verify push notification sent
    expect(sendPushNotificationToAccount).toHaveBeenCalledWith(
      1,
      expect.objectContaining({
        title: "New SMS from John",
        eventType: "inbound_sms",
      })
    );
  });

  it("handles iMessage type correctly", async () => {
    const mockContact = {
      id: 10,
      firstName: "Jane",
      lastName: "Smith",
      assignedUserId: 3,
    };

    vi.mocked(getAccountById).mockResolvedValueOnce({ id: 2, name: "Test" } as any);
    vi.mocked(findContactByPhone).mockResolvedValueOnce(mockContact as any);
    vi.mocked(createMessage).mockResolvedValueOnce({ id: 55 } as any);

    const res = await request(app)
      .post("/api/webhooks/blooio/inbound/2")
      .send({
        from: "+15551234567",
        to: "+15559876543",
        body: "Got it, thanks!",
        id: "blooio-imsg-456",
        type: "imessage",
      });

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);

    // Verify metadata includes imessage channel
    expect(createMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: JSON.stringify({ provider: "blooio", channel: "imessage" }),
      })
    );

    // Verify notification title uses IMESSAGE
    expect(createNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "New IMESSAGE from Jane",
      })
    );
  });

  it("handles alternative payload field names (sender/text/messageId)", async () => {
    const mockContact = {
      id: 15,
      firstName: "Bob",
      lastName: "Jones",
      assignedUserId: null,
    };

    vi.mocked(getAccountById).mockResolvedValueOnce({ id: 3, name: "Test" } as any);
    vi.mocked(findContactByPhone).mockResolvedValueOnce(mockContact as any);
    vi.mocked(createMessage).mockResolvedValueOnce({ id: 77 } as any);

    const res = await request(app)
      .post("/api/webhooks/blooio/inbound/3")
      .send({
        sender: "+15551234567",
        recipient: "+15559876543",
        text: "Alternative field names",
        messageId: "alt-msg-789",
      });

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.messageId).toBe(77);

    expect(createMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        body: "Alternative field names",
        fromAddress: "+15551234567",
        externalId: "alt-msg-789",
      })
    );
  });

  it("returns 200 even on internal errors (prevents Blooio retries)", async () => {
    vi.mocked(getAccountById).mockRejectedValueOnce(new Error("DB connection failed"));

    const res = await request(app)
      .post("/api/webhooks/blooio/inbound/1")
      .send({ from: "+15551234567", body: "Hello" });

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(false);
    expect(res.body.error).toBe("DB connection failed");
  });

  it("handles notification failure gracefully without crashing", async () => {
    const mockContact = {
      id: 10,
      firstName: "John",
      lastName: "Doe",
      assignedUserId: 5,
    };

    vi.mocked(getAccountById).mockResolvedValueOnce({ id: 1, name: "Test" } as any);
    vi.mocked(findContactByPhone).mockResolvedValueOnce(mockContact as any);
    vi.mocked(createMessage).mockResolvedValueOnce({ id: 42 } as any);
    vi.mocked(createNotification).mockRejectedValueOnce(new Error("Notification service down"));

    const res = await request(app)
      .post("/api/webhooks/blooio/inbound/1")
      .send({ from: "+15551234567", body: "Hello" });

    // Should still return success since notification is non-blocking
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });
});
