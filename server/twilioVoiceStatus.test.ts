import { describe, expect, it, vi, beforeEach } from "vitest";
import type { Request, Response } from "express";

// ─── Mock DB helpers ───
vi.mock("./db", async () => {
  const actual = await vi.importActual("./db");
  return {
    ...actual,
    getAccountById: vi.fn(),
    findContactByPhone: vi.fn(),
    createMessage: vi.fn().mockResolvedValue({ id: 1 }),
    logContactActivity: vi.fn(),
    createNotification: vi.fn().mockResolvedValue(undefined),
    getMessageByCallSid: vi.fn(),
    updateMessage: vi.fn().mockResolvedValue(undefined),
    getAccountMessagingSettings: vi.fn(),
  };
});

// ─── Mock usageTracker ───
vi.mock("./services/usageTracker", () => ({
  chargeBeforeSend: vi.fn().mockResolvedValue({
    usageEventId: 500,
    unitCost: 0.05,
    totalCost: 0.20,
    newBalance: 4.80,
  }),
  reverseCharge: vi.fn().mockResolvedValue(undefined),
}));

// ─── Mock billedDispatch ───
vi.mock("./services/billedDispatch", () => ({
  billedDispatchSMS: vi.fn().mockResolvedValue({ success: true, externalId: "sms-abc" }),
}));

// ─── Mock inboundMessages helpers ───
vi.mock("./webhooks/inboundMessages", () => ({
  resolveAccountByTwilioNumber: vi.fn().mockResolvedValue(null),
  normalizePhone: vi.fn((p: string) => p),
}));

// ─── Mock twilio validateRequest ───
vi.mock("twilio", () => {
  const mockValidate = vi.fn().mockReturnValue(true);
  const mockDefault = Object.assign(vi.fn(), {
    validateRequest: mockValidate,
  });
  return { default: mockDefault, __mockValidateRequest: mockValidate };
});

// ─── Mock workflow triggers ───
vi.mock("./services/workflowTriggers", () => ({
  onCallCompleted: vi.fn().mockResolvedValue(undefined),
  onMissedCall: vi.fn().mockResolvedValue(undefined),
}));

// ─── Mock ENV ───
vi.mock("./_core/env", () => ({
  ENV: { appUrl: "https://app.example.com" },
}));

import {
  getMessageByCallSid,
  updateMessage,
  getAccountMessagingSettings,
} from "./db";
import { chargeBeforeSend, reverseCharge } from "./services/usageTracker";
import * as twilioModule from "twilio";
import {
  handleClickToCallStatus,
  verifyTwilioSignature,
} from "./webhooks/twilioVoiceStatus";

const mockValidateRequest = (twilioModule as any).__mockValidateRequest as ReturnType<typeof vi.fn>;

// ─── Helpers ───

function createMockReq(body: Record<string, any>, headers?: Record<string, string>): Request {
  return {
    body,
    headers: {
      host: "app.example.com",
      "x-twilio-signature": "valid-sig",
      ...headers,
    },
    protocol: "https",
    originalUrl: "/api/webhooks/twilio/voice-status",
  } as unknown as Request;
}

function createMockRes() {
  const res = {
    statusCode: 200,
    body: null as any,
    status(code: number) {
      res.statusCode = code;
      return res;
    },
    json(data: any) {
      res.body = data;
      return res;
    },
  };
  return res as unknown as Response & { statusCode: number; body: any };
}

const BASE_MESSAGE = {
  id: 42,
  accountId: 10,
  contactId: 100,
  userId: 5,
  type: "call" as const,
  direction: "outbound" as const,
  status: "pending" as const,
  subject: "Click-to-call",
  body: "Outbound call initiated via Twilio bridge. Call SID: CA123",
  toAddress: "+15551234567",
  fromAddress: "+15559876543",
  callSid: "CA123",
  externalId: null,
  errorMessage: null,
  sentAt: null,
  deliveredAt: null,
  isRead: true,
  readAt: null,
  metadata: JSON.stringify({ usageEventId: 777 }),
  sequenceStepId: null,
  sequenceStepPosition: null,
  retryCount: 0,
  retryAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

beforeEach(() => {
  vi.clearAllMocks();
  // Default: message found, settings found with auth token, signature valid
  (getMessageByCallSid as any).mockResolvedValue({ ...BASE_MESSAGE });
  (getAccountMessagingSettings as any).mockResolvedValue({
    twilioAuthToken: "test-auth-token",
    twilioFromNumber: "+15559876543",
    twilioAccountSid: "AC123",
  });
  mockValidateRequest?.mockReturnValue(true);
});

// ─────────────────────────────────────────────
// Signature Verification
// ─────────────────────────────────────────────

describe("Twilio Voice Status — Signature Verification", () => {
  it("rejects requests with invalid Twilio signature", async () => {
    mockValidateRequest.mockReturnValue(false);

    const req = createMockReq({
      CallSid: "CA123",
      CallStatus: "completed",
      CallDuration: "60",
      From: "+15559876543",
      To: "+15551234567",
      Direction: "outbound-api",
    });
    const res = createMockRes();

    await handleClickToCallStatus(req, res, {
      CallSid: "CA123",
      CallStatus: "completed",
      CallDuration: 60,
      From: "+15559876543",
      To: "+15551234567",
    });

    expect(res.statusCode).toBe(403);
    expect(res.body).toEqual({ error: "Invalid Twilio signature" });
    // Should NOT update the message or charge
    expect(updateMessage).not.toHaveBeenCalled();
    expect(chargeBeforeSend).not.toHaveBeenCalled();
    expect(reverseCharge).not.toHaveBeenCalled();
  });

  it("accepts requests with valid Twilio signature", async () => {
    const req = createMockReq({
      CallSid: "CA123",
      CallStatus: "completed",
      CallDuration: "60",
      From: "+15559876543",
      To: "+15551234567",
      Direction: "outbound-api",
    });
    const res = createMockRes();

    await handleClickToCallStatus(req, res, {
      CallSid: "CA123",
      CallStatus: "completed",
      CallDuration: 60,
      From: "+15559876543",
      To: "+15551234567",
    });

    expect(res.statusCode).toBe(200);
    expect(res.body.action).toBe("reconciled");
  });

  it("skips signature check when no auth token configured", async () => {
    (getAccountMessagingSettings as any).mockResolvedValue({
      twilioAuthToken: null,
      twilioFromNumber: "+15559876543",
    });

    const req = createMockReq({
      CallSid: "CA123",
      CallStatus: "completed",
      CallDuration: "30",
    });
    const res = createMockRes();

    await handleClickToCallStatus(req, res, {
      CallSid: "CA123",
      CallStatus: "completed",
      CallDuration: 30,
      From: "+15559876543",
      To: "+15551234567",
    });

    expect(mockValidateRequest).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(200);
  });

  it("returns 200 with no-message when callSid not found", async () => {
    (getMessageByCallSid as any).mockResolvedValue(undefined);

    const req = createMockReq({ CallSid: "CA-unknown" });
    const res = createMockRes();

    await handleClickToCallStatus(req, res, {
      CallSid: "CA-unknown",
      CallStatus: "completed",
      CallDuration: 60,
      From: "+15559876543",
      To: "+15551234567",
    });

    expect(res.statusCode).toBe(200);
    expect(res.body.action).toBe("no-message");
    expect(updateMessage).not.toHaveBeenCalled();
  });
});

// ─────────────────────────────────────────────
// Duration Reconciliation
// ─────────────────────────────────────────────

describe("Twilio Voice Status — Duration Reconciliation", () => {
  it("reverses 1-min deposit when call duration is 0 seconds (never connected)", async () => {
    const req = createMockReq({
      CallSid: "CA123",
      CallStatus: "completed",
      CallDuration: "0",
    });
    const res = createMockRes();

    await handleClickToCallStatus(req, res, {
      CallSid: "CA123",
      CallStatus: "completed",
      CallDuration: 0,
      From: "+15559876543",
      To: "+15551234567",
    });

    expect(res.statusCode).toBe(200);
    expect(res.body.action).toBe("reconciled");
    expect(res.body.actualMinutes).toBe(0);
    // Should reverse the 1-min deposit
    expect(reverseCharge).toHaveBeenCalledWith(777);
    // Should NOT charge extra
    expect(chargeBeforeSend).not.toHaveBeenCalled();
    // Should update message to "sent"
    expect(updateMessage).toHaveBeenCalledWith(42, expect.objectContaining({
      status: "sent",
    }));
  });

  it("does nothing extra when call duration is exactly 1 minute (deposit covers it)", async () => {
    const req = createMockReq({
      CallSid: "CA123",
      CallStatus: "completed",
      CallDuration: "60",
    });
    const res = createMockRes();

    await handleClickToCallStatus(req, res, {
      CallSid: "CA123",
      CallStatus: "completed",
      CallDuration: 60,
      From: "+15559876543",
      To: "+15551234567",
    });

    expect(res.statusCode).toBe(200);
    expect(res.body.actualMinutes).toBe(1);
    // No reverse, no extra charge
    expect(reverseCharge).not.toHaveBeenCalled();
    expect(chargeBeforeSend).not.toHaveBeenCalled();
    // Message updated to "sent"
    expect(updateMessage).toHaveBeenCalledWith(42, expect.objectContaining({
      status: "sent",
    }));
  });

  it("charges 4 extra minutes for a 5-minute call (ceil(300/60)=5, minus 1 deposit)", async () => {
    const req = createMockReq({
      CallSid: "CA123",
      CallStatus: "completed",
      CallDuration: "300",
    });
    const res = createMockRes();

    await handleClickToCallStatus(req, res, {
      CallSid: "CA123",
      CallStatus: "completed",
      CallDuration: 300,
      From: "+15559876543",
      To: "+15551234567",
    });

    expect(res.statusCode).toBe(200);
    expect(res.body.actualMinutes).toBe(5);
    // Should charge 4 extra minutes
    expect(chargeBeforeSend).toHaveBeenCalledWith(
      10, // accountId
      "voice_call_minute",
      4, // extra minutes
      expect.objectContaining({ contactId: 100, callSid: "CA123", reconciliation: true }),
      5 // userId
    );
    // No reversal
    expect(reverseCharge).not.toHaveBeenCalled();
  });

  it("charges 1 extra minute for a 61-second call (ceil(61/60)=2, minus 1 deposit)", async () => {
    const req = createMockReq({
      CallSid: "CA123",
      CallStatus: "completed",
      CallDuration: "61",
    });
    const res = createMockRes();

    await handleClickToCallStatus(req, res, {
      CallSid: "CA123",
      CallStatus: "completed",
      CallDuration: 61,
      From: "+15559876543",
      To: "+15551234567",
    });

    expect(res.statusCode).toBe(200);
    expect(res.body.actualMinutes).toBe(2);
    expect(chargeBeforeSend).toHaveBeenCalledWith(
      10,
      "voice_call_minute",
      1, // 2 - 1 = 1 extra minute
      expect.objectContaining({ contactId: 100 }),
      5
    );
    expect(reverseCharge).not.toHaveBeenCalled();
  });

  it("stores RecordingUrl and RecordingSid in message metadata", async () => {
    const req = createMockReq({
      CallSid: "CA123",
      CallStatus: "completed",
      CallDuration: "60",
    });
    const res = createMockRes();

    await handleClickToCallStatus(req, res, {
      CallSid: "CA123",
      CallStatus: "completed",
      CallDuration: 60,
      From: "+15559876543",
      To: "+15551234567",
      RecordingUrl: "https://api.twilio.com/recordings/RE123",
      RecordingSid: "RE123",
    });

    expect(updateMessage).toHaveBeenCalledWith(42, expect.objectContaining({
      metadata: expect.stringContaining("RE123"),
    }));

    // Parse the metadata to verify structure
    const call = (updateMessage as any).mock.calls[0];
    const meta = JSON.parse(call[1].metadata);
    expect(meta.recordingUrl).toBe("https://api.twilio.com/recordings/RE123");
    expect(meta.recordingSid).toBe("RE123");
    expect(meta.callDurationSeconds).toBe(60);
    expect(meta.callDurationMinutes).toBe(1);
    expect(meta.usageEventId).toBe(777); // preserved from original
  });
});

// ─────────────────────────────────────────────
// Status Paths: completed / failed / busy / no-answer / canceled
// ─────────────────────────────────────────────

describe("Twilio Voice Status — Status Paths", () => {
  it("marks message as 'sent' on completed status", async () => {
    const req = createMockReq({
      CallSid: "CA123",
      CallStatus: "completed",
      CallDuration: "45",
    });
    const res = createMockRes();

    await handleClickToCallStatus(req, res, {
      CallSid: "CA123",
      CallStatus: "completed",
      CallDuration: 45,
      From: "+15559876543",
      To: "+15551234567",
    });

    expect(res.statusCode).toBe(200);
    expect(res.body.action).toBe("reconciled");
    expect(updateMessage).toHaveBeenCalledWith(42, expect.objectContaining({
      status: "sent",
      sentAt: expect.any(Date),
    }));
  });

  it("reverses deposit and marks 'failed' on failed status", async () => {
    const req = createMockReq({
      CallSid: "CA123",
      CallStatus: "failed",
    });
    const res = createMockRes();

    await handleClickToCallStatus(req, res, {
      CallSid: "CA123",
      CallStatus: "failed",
      CallDuration: 0,
      From: "+15559876543",
      To: "+15551234567",
    });

    expect(res.statusCode).toBe(200);
    expect(res.body.action).toBe("failed");
    expect(res.body.callStatus).toBe("failed");
    expect(reverseCharge).toHaveBeenCalledWith(777);
    expect(updateMessage).toHaveBeenCalledWith(42, expect.objectContaining({
      status: "failed",
      errorMessage: "Call failed",
    }));
  });

  it("reverses deposit and marks 'failed' on no-answer status", async () => {
    const req = createMockReq({
      CallSid: "CA123",
      CallStatus: "no-answer",
    });
    const res = createMockRes();

    await handleClickToCallStatus(req, res, {
      CallSid: "CA123",
      CallStatus: "no-answer",
      CallDuration: 0,
      From: "+15559876543",
      To: "+15551234567",
    });

    expect(res.statusCode).toBe(200);
    expect(res.body.action).toBe("failed");
    expect(reverseCharge).toHaveBeenCalledWith(777);
    expect(updateMessage).toHaveBeenCalledWith(42, expect.objectContaining({
      status: "failed",
      errorMessage: "Call no-answer",
    }));
  });

  it("reverses deposit and marks 'failed' on busy status", async () => {
    const req = createMockReq({
      CallSid: "CA123",
      CallStatus: "busy",
    });
    const res = createMockRes();

    await handleClickToCallStatus(req, res, {
      CallSid: "CA123",
      CallStatus: "busy",
      CallDuration: 0,
      From: "+15559876543",
      To: "+15551234567",
    });

    expect(res.statusCode).toBe(200);
    expect(res.body.action).toBe("failed");
    expect(reverseCharge).toHaveBeenCalledWith(777);
    expect(updateMessage).toHaveBeenCalledWith(42, expect.objectContaining({
      status: "failed",
      errorMessage: "Call busy",
    }));
  });

  it("reverses deposit and marks 'failed' on canceled status", async () => {
    const req = createMockReq({
      CallSid: "CA123",
      CallStatus: "canceled",
    });
    const res = createMockRes();

    await handleClickToCallStatus(req, res, {
      CallSid: "CA123",
      CallStatus: "canceled",
      CallDuration: 0,
      From: "+15559876543",
      To: "+15551234567",
    });

    expect(res.statusCode).toBe(200);
    expect(res.body.action).toBe("failed");
    expect(reverseCharge).toHaveBeenCalledWith(777);
    expect(updateMessage).toHaveBeenCalledWith(42, expect.objectContaining({
      status: "failed",
      errorMessage: "Call canceled",
    }));
  });

  it("acknowledges intermediate statuses without updating message", async () => {
    const req = createMockReq({
      CallSid: "CA123",
      CallStatus: "ringing",
    });
    const res = createMockRes();

    await handleClickToCallStatus(req, res, {
      CallSid: "CA123",
      CallStatus: "ringing",
      CallDuration: 0,
      From: "+15559876543",
      To: "+15551234567",
    });

    expect(res.statusCode).toBe(200);
    expect(res.body.action).toBe("intermediate");
    expect(updateMessage).not.toHaveBeenCalled();
    expect(chargeBeforeSend).not.toHaveBeenCalled();
    expect(reverseCharge).not.toHaveBeenCalled();
  });

  it("handles message with no usageEventId in metadata gracefully", async () => {
    (getMessageByCallSid as any).mockResolvedValue({
      ...BASE_MESSAGE,
      metadata: JSON.stringify({}), // no usageEventId
    });

    const req = createMockReq({
      CallSid: "CA123",
      CallStatus: "failed",
    });
    const res = createMockRes();

    await handleClickToCallStatus(req, res, {
      CallSid: "CA123",
      CallStatus: "failed",
      CallDuration: 0,
      From: "+15559876543",
      To: "+15551234567",
    });

    expect(res.statusCode).toBe(200);
    expect(res.body.action).toBe("failed");
    // reverseCharge should NOT be called since there's no usageEventId
    expect(reverseCharge).not.toHaveBeenCalled();
    // Message should still be updated to failed
    expect(updateMessage).toHaveBeenCalledWith(42, expect.objectContaining({
      status: "failed",
    }));
  });

  it("handles message with null metadata gracefully", async () => {
    (getMessageByCallSid as any).mockResolvedValue({
      ...BASE_MESSAGE,
      metadata: null,
    });

    const req = createMockReq({
      CallSid: "CA123",
      CallStatus: "completed",
      CallDuration: "120",
    });
    const res = createMockRes();

    await handleClickToCallStatus(req, res, {
      CallSid: "CA123",
      CallStatus: "completed",
      CallDuration: 120,
      From: "+15559876543",
      To: "+15551234567",
    });

    expect(res.statusCode).toBe(200);
    expect(res.body.actualMinutes).toBe(2);
    // No usageEventId → no extra charge, no reversal
    expect(chargeBeforeSend).not.toHaveBeenCalled();
    expect(reverseCharge).not.toHaveBeenCalled();
    // Message still updated
    expect(updateMessage).toHaveBeenCalledWith(42, expect.objectContaining({
      status: "sent",
    }));
  });
});

// ─────────────────────────────────────────────
// verifyTwilioSignature unit test
// ─────────────────────────────────────────────

describe("verifyTwilioSignature", () => {
  it("returns false when X-Twilio-Signature header is missing", async () => {
    const req = createMockReq({}, {});
    delete (req.headers as any)["x-twilio-signature"];

    const result = await verifyTwilioSignature(req, "auth-token");
    expect(result).toBe(false);
    expect(mockValidateRequest).not.toHaveBeenCalled();
  });

  it("calls twilio.validateRequest with correct params", async () => {
    const req = createMockReq({}, { "x-twilio-signature": "sig123" });

    await verifyTwilioSignature(req, "my-auth-token");

    expect(mockValidateRequest).toHaveBeenCalledWith(
      "my-auth-token",
      "sig123",
      expect.stringContaining("/api/webhooks/twilio/voice-status"),
      req.body
    );
  });
});
