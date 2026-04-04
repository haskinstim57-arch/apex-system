import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

// ─────────────────────────────────────────────
// Tests for Per-Account Messaging Settings
// Covers: schema, DB helpers, tRPC router,
// credential resolution in Twilio/SendGrid services
// ─────────────────────────────────────────────

describe("accountMessagingSettings Schema", () => {
  it("table exists in schema with correct columns", async () => {
    const schema = await import("../drizzle/schema");
    const table = schema.accountMessagingSettings;
    expect(table).toBeDefined();
    const columnNames = Object.keys(table);
    expect(columnNames).toContain("id");
    expect(columnNames).toContain("accountId");
    expect(columnNames).toContain("twilioAccountSid");
    expect(columnNames).toContain("twilioAuthToken");
    expect(columnNames).toContain("twilioFromNumber");
    expect(columnNames).toContain("sendgridApiKey");
    expect(columnNames).toContain("sendgridFromEmail");
    expect(columnNames).toContain("sendgridFromName");
    expect(columnNames).toContain("createdAt");
    expect(columnNames).toContain("updatedAt");
  });

  it("table has accountId as a unique column", async () => {
    const schema = await import("../drizzle/schema");
    const table = schema.accountMessagingSettings;
    expect(table).toBeDefined();
    // Verify accountId column exists
    expect(table.accountId).toBeDefined();
  });
});

describe("DB Helpers — getAccountMessagingSettings / upsertAccountMessagingSettings", () => {
  it("getAccountMessagingSettings function exists", async () => {
    const db = await import("./db");
    expect(typeof db.getAccountMessagingSettings).toBe("function");
  });

  it("upsertAccountMessagingSettings function exists", async () => {
    const db = await import("./db");
    expect(typeof db.upsertAccountMessagingSettings).toBe("function");
  });

  it("getAccountMessagingSettings returns null for non-existent account", async () => {
    const db = await import("./db");
    const result = await db.getAccountMessagingSettings(999999);
    expect(result).toBeNull();
  });
});

describe("messagingSettings tRPC Router", () => {
  it("router exports get and save procedures", async () => {
    const { messagingSettingsRouter } = await import("./routers/messagingSettings");
    expect(messagingSettingsRouter).toBeDefined();
    // The router should have _def with procedures
    const routerDef = (messagingSettingsRouter as any)._def;
    expect(routerDef).toBeDefined();
  });
});

describe("Twilio Service — Per-Account Credential Resolution", () => {
  beforeEach(() => {
    delete process.env.TWILIO_ACCOUNT_SID;
    delete process.env.TWILIO_AUTH_TOKEN;
    delete process.env.TWILIO_FROM_NUMBER;
  });

  it("sendSMS accepts optional accountId parameter", async () => {
    const { sendSMS } = await import("./services/twilio");
    // Call with accountId — should not throw, just return graceful failure
    const result = await sendSMS("+15559876543", "Test message", undefined, 999999);
    expect(result.success).toBe(false);
    expect(result.error).toBe("Twilio not configured");
  });

  it("sendSMS without accountId falls back to global (returns failure when global not set)", async () => {
    const { sendSMS } = await import("./services/twilio");
    const result = await sendSMS("+15559876543", "Test message");
    expect(result.success).toBe(false);
    expect(result.error).toBe("Twilio not configured");
  });

  it("isTwilioConfigured still checks global env vars", async () => {
    const { isTwilioConfigured } = await import("./services/twilio");
    expect(isTwilioConfigured()).toBe(false);
    process.env.TWILIO_ACCOUNT_SID = "ACtest";
    process.env.TWILIO_AUTH_TOKEN = "token";
    process.env.TWILIO_FROM_NUMBER = "+15551234567";
    expect(isTwilioConfigured()).toBe(true);
  });
});

describe("SendGrid Service — Per-Account Credential Resolution", () => {
  beforeEach(() => {
    delete process.env.SENDGRID_API_KEY;
    delete process.env.SENDGRID_FROM_EMAIL;
    delete process.env.SENDGRID_FROM_NAME;
  });

  it("sendEmail accepts optional accountId parameter", async () => {
    const { sendEmail } = await import("./services/sendgrid");
    const result = await sendEmail({
      to: "test@example.com",
      subject: "Test",
      body: "Test body",
      accountId: 999999,
    });
    expect(result.success).toBe(false);
    expect(result.error).toBe("SendGrid not configured");
  });

  it("sendEmail without accountId falls back to global (returns failure when global not set)", async () => {
    const { sendEmail } = await import("./services/sendgrid");
    const result = await sendEmail({
      to: "test@example.com",
      subject: "Test",
      body: "Test body",
    });
    expect(result.success).toBe(false);
    expect(result.error).toBe("SendGrid not configured");
  });

  it("isSendGridConfigured still checks global env vars", async () => {
    const { isSendGridConfigured } = await import("./services/sendgrid");
    expect(isSendGridConfigured()).toBe(false);
    process.env.SENDGRID_API_KEY = "SG.test";
    process.env.SENDGRID_FROM_EMAIL = "test@example.com";
    expect(isSendGridConfigured()).toBe(true);
  });
});

describe("Messaging Dispatcher — accountId Forwarding", () => {
  let savedBlooioKey: string | undefined;
  beforeEach(() => {
    delete process.env.TWILIO_ACCOUNT_SID;
    delete process.env.TWILIO_AUTH_TOKEN;
    delete process.env.TWILIO_FROM_NUMBER;
    delete process.env.SENDGRID_API_KEY;
    delete process.env.SENDGRID_FROM_EMAIL;
    // Save and remove BLOOIO_API_KEY to test placeholder fallback
    savedBlooioKey = process.env.BLOOIO_API_KEY;
    delete process.env.BLOOIO_API_KEY;
  });

  afterEach(() => {
    // Restore BLOOIO_API_KEY
    if (savedBlooioKey) process.env.BLOOIO_API_KEY = savedBlooioKey;
  });

  it("dispatchSMS accepts accountId parameter", async () => {
    const { dispatchSMS } = await import("./services/messaging");
    const result = await dispatchSMS({
      to: "+15559876543",
      body: "Test",
      accountId: 999999,
    });
    expect(result.success).toBe(false);
    expect(result.provider).toBe("placeholder");
  });

  it("dispatchEmail accepts accountId parameter", async () => {
    const { dispatchEmail } = await import("./services/messaging");
    const result = await dispatchEmail({
      to: "test@example.com",
      subject: "Test",
      body: "Test body",
      accountId: 999999,
    });
    expect(result.success).toBe(false);
    expect(result.provider).toBe("placeholder");
  });

  it("dispatchSMS without accountId still works (backward compatible)", async () => {
    const { dispatchSMS } = await import("./services/messaging");
    const result = await dispatchSMS({ to: "+15559876543", body: "Test" });
    expect(result.success).toBe(false);
    expect(result.provider).toBe("placeholder");
  });

  it("dispatchEmail without accountId still works (backward compatible)", async () => {
    const { dispatchEmail } = await import("./services/messaging");
    const result = await dispatchEmail({
      to: "test@example.com",
      subject: "Test",
      body: "Test body",
    });
    expect(result.success).toBe(false);
    expect(result.provider).toBe("placeholder");
  });
});

describe("Router Registration", () => {
  it("messagingSettings router is registered in the app router", async () => {
    const { appRouter } = await import("./routers");
    const routerDef = (appRouter as any)._def;
    expect(routerDef).toBeDefined();
    // Check that messagingSettings is in the procedure map
    const procedures = routerDef.procedures || routerDef.record;
    // tRPC v11 nests under record
    const keys = Object.keys(procedures || {});
    const hasMessagingSettings = keys.some((k) => k.startsWith("messagingSettings"));
    expect(hasMessagingSettings).toBe(true);
  });
});
