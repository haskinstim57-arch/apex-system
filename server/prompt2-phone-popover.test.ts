import { describe, expect, it, vi } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

// ─── Helpers ───────────────────────────────────────────
type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createAuthContext(overrides: Partial<AuthenticatedUser> = {}): TrpcContext {
  const user: AuthenticatedUser = {
    id: 1,
    openId: "test-user",
    email: "test@example.com",
    name: "Test User",
    loginMethod: "manus",
    role: "user",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
    ...overrides,
  };
  return {
    user,
    req: {
      headers: {},
      cookies: {},
    } as any,
    res: {
      clearCookie: vi.fn(),
      cookie: vi.fn(),
    } as any,
  };
}

function createAnonContext(): TrpcContext {
  return {
    user: null,
    req: { headers: {}, cookies: {} } as any,
    res: { clearCookie: vi.fn(), cookie: vi.fn() } as any,
  };
}

const caller = (ctx: TrpcContext) => appRouter.createCaller(ctx);

// ─── SMS Templates Router ──────────────────────────────
describe("smsTemplates router", () => {
  it("requires authentication for list", async () => {
    const ctx = createAnonContext();
    await expect(
      caller(ctx).smsTemplates.list({ accountId: 1 })
    ).rejects.toThrow();
  });

  it("requires authentication for create", async () => {
    const ctx = createAnonContext();
    await expect(
      caller(ctx).smsTemplates.create({ accountId: 1, name: "Test", body: "Hello" })
    ).rejects.toThrow();
  });

  it("requires authentication for update", async () => {
    const ctx = createAnonContext();
    await expect(
      caller(ctx).smsTemplates.update({ id: 1, name: "Updated" })
    ).rejects.toThrow();
  });

  it("requires authentication for delete", async () => {
    const ctx = createAnonContext();
    await expect(
      caller(ctx).smsTemplates.delete({ id: 1 })
    ).rejects.toThrow();
  });

  it("validates create input — name is required", async () => {
    const ctx = createAuthContext({ role: "admin" });
    await expect(
      caller(ctx).smsTemplates.create({ accountId: 1, name: "", body: "Hello" })
    ).rejects.toThrow();
  });

  it("validates create input — body is required", async () => {
    const ctx = createAuthContext({ role: "admin" });
    await expect(
      caller(ctx).smsTemplates.create({ accountId: 1, name: "Test", body: "" })
    ).rejects.toThrow();
  });

  it("validates update input — name cannot be empty string", async () => {
    const ctx = createAuthContext({ role: "admin" });
    await expect(
      caller(ctx).smsTemplates.update({ id: 1, name: "" })
    ).rejects.toThrow();
  });
});

// ─── Twilio Calls Router ───────────────────────────────
describe("twilioCalls router", () => {
  it("requires authentication for clickToCall", async () => {
    const ctx = createAnonContext();
    await expect(
      caller(ctx).twilioCalls.clickToCall({ contactId: 1, accountId: 1 })
    ).rejects.toThrow();
  });

  it("validates clickToCall input — contactId is required", async () => {
    const ctx = createAuthContext({ role: "admin" });
    await expect(
      caller(ctx).twilioCalls.clickToCall({ contactId: undefined as any, accountId: 1 })
    ).rejects.toThrow();
  });

  it("validates clickToCall input — accountId is required", async () => {
    const ctx = createAuthContext({ role: "admin" });
    await expect(
      caller(ctx).twilioCalls.clickToCall({ contactId: 1, accountId: undefined as any })
    ).rejects.toThrow();
  });
});

// ─── Twilio SMS Provider Service ───────────────────────
describe("twilioSms service", () => {
  it("exports sendSMSViaTwilio function", async () => {
    const { sendSMSViaTwilio } = await import("./services/twilioSms");
    expect(typeof sendSMSViaTwilio).toBe("function");
  });

  it("returns error when Twilio is not configured", async () => {
    const { sendSMSViaTwilio } = await import("./services/twilioSms");
    // Account 999999 won't have Twilio settings
    const result = await sendSMSViaTwilio("+15551234567", "Test", 999999);
    expect(result.success).toBe(false);
    expect(result.error).toContain("Twilio not configured");
  });
});

// ─── Messaging Provider Routing ────────────────────────
describe("messaging dispatchSMS provider routing", () => {
  it("exports dispatchSMS with provider param", async () => {
    const { dispatchSMS } = await import("./services/messaging");
    expect(typeof dispatchSMS).toBe("function");
  });

  it("dispatchSMS returns result with provider field", async () => {
    const { dispatchSMS } = await import("./services/messaging");
    // Call with twilio provider on unconfigured account — returns immediately without network call
    const result = await dispatchSMS({
      to: "+15551234567",
      body: "Test message",
      accountId: 999999,
      contactId: 1,
      provider: "twilio",
    });
    expect(result).toHaveProperty("provider");
  });

  it("dispatchSMS accepts twilio provider", async () => {
    const { dispatchSMS } = await import("./services/messaging");
    const result = await dispatchSMS({
      to: "+15551234567",
      body: "Test message",
      accountId: 999999,
      contactId: 1,
      provider: "twilio",
    });
    expect(result).toHaveProperty("provider");
    // Should be twilio even if it fails (unconfigured)
    expect(result.provider).toBe("twilio");
  });
});

// ─── Inbox sendReply Provider Extension ────────────────
describe("inbox.sendReply provider param", () => {
  it("requires authentication", async () => {
    const ctx = createAnonContext();
    await expect(
      caller(ctx).inbox.sendReply({
        accountId: 1,
        contactId: 1,
        type: "sms",
        body: "Hello",
        provider: "twilio",
      })
    ).rejects.toThrow();
  });

  it("accepts provider param in input schema", async () => {
    const ctx = createAuthContext({ role: "admin" });
    // This should fail with account access error, not input validation error
    try {
      await caller(ctx).inbox.sendReply({
        accountId: 999999,
        contactId: 1,
        type: "sms",
        body: "Hello",
        provider: "twilio",
      });
    } catch (err: any) {
      // Should be a runtime error (account access), not a Zod validation error
      expect(err.code).not.toBe("BAD_REQUEST");
    }
  });
});

// ─── Schema Validation ─────────────────────────────────
describe("smsTemplates schema", () => {
  it("sms_templates table exists in schema", async () => {
    const schema = await import("../drizzle/schema");
    expect(schema.smsTemplates).toBeDefined();
  });

  it("sms_templates has required columns", async () => {
    const schema = await import("../drizzle/schema");
    const table = schema.smsTemplates;
    // Check that the table config has the expected column names
    const columnNames = Object.keys(table);
    expect(columnNames).toContain("id");
    expect(columnNames).toContain("accountId");
    expect(columnNames).toContain("name");
    expect(columnNames).toContain("body");
  });
});
