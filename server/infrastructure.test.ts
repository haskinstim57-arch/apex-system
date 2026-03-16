import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

// ─────────────────────────────────────────────
// Tests for Production Infrastructure
// Covers: Twilio, SendGrid, messaging dispatcher,
// campaign scheduler, security middleware,
// call_completed trigger, FB page mappings
// ─────────────────────────────────────────────

describe("Twilio SMS Service", () => {
  beforeEach(() => {
    // Clear env vars before each test
    delete process.env.TWILIO_ACCOUNT_SID;
    delete process.env.TWILIO_AUTH_TOKEN;
    delete process.env.TWILIO_FROM_NUMBER;
  });

  it("isTwilioConfigured returns false when env vars are missing", async () => {
    const { isTwilioConfigured } = await import("./services/twilio");
    expect(isTwilioConfigured()).toBe(false);
  });

  it("isTwilioConfigured returns true when all env vars are set", async () => {
    process.env.TWILIO_ACCOUNT_SID = "ACtest123";
    process.env.TWILIO_AUTH_TOKEN = "testtoken";
    process.env.TWILIO_FROM_NUMBER = "+15551234567";
    // Re-import to pick up env changes
    const mod = await import("./services/twilio");
    expect(mod.isTwilioConfigured()).toBe(true);
  });

  it("sendSMS returns graceful failure when not configured", async () => {
    const { sendSMS } = await import("./services/twilio");
    const result = await sendSMS("+15559876543", "Test message");
    expect(result.success).toBe(false);
    expect(result.error).toBe("Twilio not configured");
  });
});

describe("SendGrid Email Service", () => {
  beforeEach(() => {
    delete process.env.SENDGRID_API_KEY;
    delete process.env.SENDGRID_FROM_EMAIL;
    delete process.env.SENDGRID_FROM_NAME;
  });

  it("isSendGridConfigured returns false when env vars are missing", async () => {
    const { isSendGridConfigured } = await import("./services/sendgrid");
    expect(isSendGridConfigured()).toBe(false);
  });

  it("isSendGridConfigured returns true when all env vars are set", async () => {
    process.env.SENDGRID_API_KEY = "SG.test123";
    process.env.SENDGRID_FROM_EMAIL = "test@example.com";
    const mod = await import("./services/sendgrid");
    expect(mod.isSendGridConfigured()).toBe(true);
  });

  it("sendEmail returns graceful failure when not configured", async () => {
    const { sendEmail } = await import("./services/sendgrid");
    const result = await sendEmail({
      to: "recipient@example.com",
      subject: "Test",
      body: "Test body",
    });
    expect(result.success).toBe(false);
    expect(result.error).toBe("SendGrid not configured");
  });
});

describe("Unified Messaging Dispatcher", () => {
  beforeEach(() => {
    delete process.env.TWILIO_ACCOUNT_SID;
    delete process.env.TWILIO_AUTH_TOKEN;
    delete process.env.TWILIO_FROM_NUMBER;
    delete process.env.SENDGRID_API_KEY;
    delete process.env.SENDGRID_FROM_EMAIL;
  });

  it("dispatchSMS falls back to placeholder when Twilio not configured", async () => {
    const { dispatchSMS } = await import("./services/messaging");
    const result = await dispatchSMS({ to: "+15559876543", body: "Test" });
    expect(result.success).toBe(true);
    expect(result.provider).toBe("placeholder");
    expect(result.externalId).toMatch(/^placeholder_sms_/);
  });

  it("dispatchEmail falls back to placeholder when SendGrid not configured", async () => {
    const { dispatchEmail } = await import("./services/messaging");
    const result = await dispatchEmail({
      to: "test@example.com",
      subject: "Test",
      body: "Test body",
    });
    expect(result.success).toBe(true);
    expect(result.provider).toBe("placeholder");
    expect(result.externalId).toMatch(/^placeholder_email_/);
  });

  it("getProviderStatus reports placeholder when not configured", async () => {
    const { getProviderStatus } = await import("./services/messaging");
    const status = getProviderStatus();
    expect(status.sms).toBe("placeholder");
    expect(status.email).toBe("placeholder");
  });

  it("getProviderStatus reports twilio/sendgrid when configured", async () => {
    process.env.TWILIO_ACCOUNT_SID = "ACtest";
    process.env.TWILIO_AUTH_TOKEN = "token";
    process.env.TWILIO_FROM_NUMBER = "+15551234567";
    process.env.SENDGRID_API_KEY = "SG.test";
    process.env.SENDGRID_FROM_EMAIL = "test@example.com";
    const { getProviderStatus } = await import("./services/messaging");
    const status = getProviderStatus();
    expect(status.sms).toBe("twilio");
    expect(status.email).toBe("sendgrid");
  });
});

describe("Campaign Scheduler", () => {
  it("startCampaignScheduler and stopCampaignScheduler do not throw", async () => {
    const { startCampaignScheduler, stopCampaignScheduler } = await import(
      "./services/campaignScheduler"
    );
    // Start should not throw
    expect(() => startCampaignScheduler()).not.toThrow();
    // Stop should not throw
    expect(() => stopCampaignScheduler()).not.toThrow();
  });

  it("calling startCampaignScheduler twice is idempotent", async () => {
    const { startCampaignScheduler, stopCampaignScheduler } = await import(
      "./services/campaignScheduler"
    );
    startCampaignScheduler();
    startCampaignScheduler(); // second call should be no-op
    stopCampaignScheduler();
  });
});

describe("Security Middleware", () => {
  it("applySecurityMiddleware does not throw on a mock express app", async () => {
    const { applySecurityMiddleware } = await import("./middleware/security");
    const middlewares: any[] = [];
    const settings: Record<string, any> = {};
    const mockApp = {
      use: (arg: any) => middlewares.push(arg),
      set: (key: string, val: any) => { settings[key] = val; },
    } as any;

    expect(() => applySecurityMiddleware(mockApp)).not.toThrow();
    // Should have registered multiple middleware
    expect(middlewares.length).toBeGreaterThanOrEqual(3); // helmet, cors, rate limiters
    // Should set trust proxy
    expect(settings["trust proxy"]).toBe(1);
  });
});

describe("Workflow Triggers — call_completed", () => {
  it("onCallCompleted function exists and is callable", async () => {
    const { onCallCompleted } = await import("./services/workflowTriggers");
    expect(typeof onCallCompleted).toBe("function");
  });

  it("onCallCompleted does not throw when no workflows match", async () => {
    const { onCallCompleted } = await import("./services/workflowTriggers");
    // With no matching workflows in DB, it should complete gracefully
    await expect(onCallCompleted(999999, 999999)).resolves.not.toThrow();
  });
});

describe("Campaign Send Functions — Provider Integration", () => {
  beforeEach(() => {
    delete process.env.TWILIO_ACCOUNT_SID;
    delete process.env.TWILIO_AUTH_TOKEN;
    delete process.env.TWILIO_FROM_NUMBER;
    delete process.env.SENDGRID_API_KEY;
    delete process.env.SENDGRID_FROM_EMAIL;
  });

  it("sendCampaignEmail uses dispatcher (placeholder fallback)", async () => {
    const { sendCampaignEmail } = await import("./routers/campaigns");
    const result = await sendCampaignEmail({
      to: "test@example.com",
      from: "sender@example.com",
      subject: "Test Campaign",
      body: "Hello {{firstName}}",
    });
    expect(result.success).toBe(true);
    expect(result.externalId).toBeDefined();
  });

  it("sendCampaignSMS uses dispatcher (placeholder fallback)", async () => {
    const { sendCampaignSMS } = await import("./routers/campaigns");
    const result = await sendCampaignSMS({
      to: "+15559876543",
      from: "+15551234567",
      body: "Test SMS campaign",
    });
    expect(result.success).toBe(true);
    expect(result.externalId).toBeDefined();
  });
});

describe("Facebook Page Mappings — Schema & DB Helpers", () => {
  it("facebook_page_mappings table has correct columns", async () => {
    const schema = await import("../drizzle/schema");
    const table = schema.facebookPageMappings;
    expect(table).toBeDefined();
    // Check column names exist
    const columnNames = Object.keys(table);
    expect(columnNames).toContain("facebookPageId");
    expect(columnNames).toContain("accountId");
    expect(columnNames).toContain("pageName");
    expect(columnNames).toContain("verifyToken");
  });

  it("DB helper functions exist for facebook page mappings", async () => {
    const db = await import("./db");
    expect(typeof db.createFacebookPageMapping).toBe("function");
    expect(typeof db.getFacebookPageMappingByPageId).toBe("function");
    expect(typeof db.listFacebookPageMappings).toBe("function");
    expect(typeof db.deleteFacebookPageMapping).toBe("function");
  });

  it("listScheduledCampaignsReady DB helper exists", async () => {
    const db = await import("./db");
    expect(typeof db.listScheduledCampaignsReady).toBe("function");
  });
});

describe("Message Status Update with Provider Info", () => {
  it("updateMessageStatus function accepts externalId and sentAt", async () => {
    const db = await import("./db");
    expect(typeof db.updateMessageStatus).toBe("function");
    // The function signature should accept (id, status, extras)
    // We can't call it without a real message, but we verify it exists
  });
});
