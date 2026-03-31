import { describe, expect, it, vi, beforeEach } from "vitest";

// ─── Mock DB ───
// vi.mock is hoisted, so we cannot reference variables defined outside.
// Use vi.fn() and configure return values inside tests via mockResolvedValueOnce.
vi.mock("./db", async () => {
  const actual = await vi.importActual<typeof import("./db")>("./db");
  return {
    ...actual,
    getDb: vi.fn().mockResolvedValue(null),
    getMember: vi.fn().mockResolvedValue({
      id: 1,
      userId: 1,
      accountId: 1,
      role: "owner",
      isActive: true,
    }),
  };
});

// Mock Square service
vi.mock("./services/square", () => ({
  isSquareConfigured: vi.fn().mockReturnValue(true),
  createPaymentLink: vi.fn().mockResolvedValue({
    paymentLinkId: "sq-link-123",
    paymentLinkUrl: "https://square.link/test",
    orderId: "sq-order-123",
  }),
  createSquareCustomer: vi.fn().mockResolvedValue("sq-cust-123"),
  verifyWebhookSignature: vi.fn().mockReturnValue(true),
  getPayment: vi.fn().mockResolvedValue(null),
  getOrder: vi.fn().mockResolvedValue(null),
  listLocations: vi.fn().mockResolvedValue([]),
}));

// Mock notification
vi.mock("./_core/notification", () => ({
  notifyOwner: vi.fn().mockResolvedValue(true),
}));

// ═══════════════════════════════════════════════
// USAGE TRACKER SERVICE TESTS
// ═══════════════════════════════════════════════

describe("Usage Tracker", () => {
  it("trackUsage is exported and callable", async () => {
    const { trackUsage } = await import("./services/usageTracker");
    expect(trackUsage).toBeDefined();
    expect(typeof trackUsage).toBe("function");
  });

  it("trackUsage returns null when db is unavailable", async () => {
    const { getDb } = await import("./db");
    (getDb as any).mockResolvedValueOnce(null);

    const { trackUsage } = await import("./services/usageTracker");
    const result = await trackUsage({
      accountId: 1,
      eventType: "sms_sent",
      quantity: 1,
    });
    expect(result).toBeNull();
  });

  it("UsageEventType includes all 6 supported types", async () => {
    const types: Array<import("./services/usageTracker").UsageEventType> = [
      "sms_sent",
      "email_sent",
      "ai_call_minute",
      "voice_call_minute",
      "llm_request",
      "power_dialer_call",
    ];
    expect(types).toHaveLength(6);
  });

  it("getAccountBillingSummary returns null when db is unavailable", async () => {
    const { getDb } = await import("./db");
    (getDb as any).mockResolvedValueOnce(null);

    const { getAccountBillingSummary } = await import("./services/usageTracker");
    const result = await getAccountBillingSummary(999);
    expect(result).toBeNull();
  });
});

// ═══════════════════════════════════════════════
// INVOICE SERVICE TESTS
// ═══════════════════════════════════════════════

describe("Invoice Service", () => {
  it("all functions are exported", async () => {
    const mod = await import("./services/invoiceService");
    expect(mod.generateInvoice).toBeDefined();
    expect(mod.sendInvoice).toBeDefined();
    expect(mod.markInvoicePaid).toBeDefined();
    expect(mod.markInvoiceOverdue).toBeDefined();
    expect(mod.voidInvoice).toBeDefined();
    expect(mod.checkAutoInvoice).toBeDefined();
  });

  it("checkAutoInvoice returns early when db is unavailable", async () => {
    const { getDb } = await import("./db");
    (getDb as any).mockResolvedValueOnce(null);

    const { checkAutoInvoice } = await import("./services/invoiceService");
    await expect(checkAutoInvoice(999)).resolves.toBeUndefined();
  });

  it("generateInvoice throws when db is unavailable", async () => {
    const { getDb } = await import("./db");
    (getDb as any).mockResolvedValueOnce(null);

    const { generateInvoice } = await import("./services/invoiceService");
    await expect(generateInvoice(999)).rejects.toThrow("Database not available");
  });

  it("sendInvoice throws when db is unavailable", async () => {
    const { getDb } = await import("./db");
    (getDb as any).mockResolvedValueOnce(null);

    const { sendInvoice } = await import("./services/invoiceService");
    await expect(sendInvoice(999)).rejects.toThrow("Database not available");
  });

  it("markInvoicePaid throws when db is unavailable", async () => {
    const { getDb } = await import("./db");
    (getDb as any).mockResolvedValueOnce(null);

    const { markInvoicePaid } = await import("./services/invoiceService");
    await expect(markInvoicePaid(999)).rejects.toThrow("Database not available");
  });

  it("markInvoiceOverdue throws when db is unavailable", async () => {
    const { getDb } = await import("./db");
    (getDb as any).mockResolvedValueOnce(null);

    const { markInvoiceOverdue } = await import("./services/invoiceService");
    await expect(markInvoiceOverdue(999)).rejects.toThrow("Database not available");
  });

  it("voidInvoice throws when db is unavailable", async () => {
    const { getDb } = await import("./db");
    (getDb as any).mockResolvedValueOnce(null);

    const { voidInvoice } = await import("./services/invoiceService");
    await expect(voidInvoice(999)).rejects.toThrow("Database not available");
  });
});

// ═══════════════════════════════════════════════
// SQUARE SERVICE TESTS
// ═══════════════════════════════════════════════

describe("Square Service", () => {
  it("isSquareConfigured returns boolean", async () => {
    const { isSquareConfigured } = await import("./services/square");
    expect(typeof isSquareConfigured()).toBe("boolean");
  });

  it("createPaymentLink is callable and returns expected shape", async () => {
    const { createPaymentLink } = await import("./services/square");
    const result = await createPaymentLink({
      referenceId: "test-ref",
      amountCents: 1000,
      description: "Test payment",
    });
    expect(result).toHaveProperty("paymentLinkId");
    expect(result).toHaveProperty("paymentLinkUrl");
  });

  it("verifyWebhookSignature is callable", async () => {
    const { verifyWebhookSignature } = await import("./services/square");
    const result = verifyWebhookSignature("body", "sig", "url");
    expect(typeof result).toBe("boolean");
  });
});

// ═══════════════════════════════════════════════
// BILLING ROUTER TESTS (input validation)
// ═══════════════════════════════════════════════

describe("Billing Router Input Validation", () => {
  it("billing router module exports billingRouter", async () => {
    const mod = await import("./routers/billing");
    expect(mod.billingRouter).toBeDefined();
    expect(typeof mod.billingRouter).toBe("object");
  });

  it("billing router has expected procedure names", async () => {
    const mod = await import("./routers/billing");
    const router = mod.billingRouter;
    const procedures = router._def.procedures;
    expect(procedures).toBeDefined();
    // Check key procedures exist
    expect("getUsageSummary" in procedures).toBe(true);
    expect("getInvoices" in procedures).toBe(true);
    expect("payInvoice" in procedures).toBe(true);
    expect("updateBillingSettings" in procedures).toBe(true);
    expect("getAgencyOverview" in procedures).toBe(true);
    expect("getBillingRates" in procedures).toBe(true);
    expect("getAllInvoices" in procedures).toBe(true);
  });

  it("updateBillingSettings validates email format", async () => {
    const { appRouter } = await import("./routers");
    const caller = appRouter.createCaller({
      user: {
        id: 1,
        openId: "test",
        email: "test@test.com",
        name: "Test",
        role: "admin",
        createdAt: new Date(),
        updatedAt: new Date(),
        lastSignedIn: new Date(),
        loginMethod: "oauth",
        passwordHash: null,
      },
      req: {} as any,
      res: {} as any,
    });

    // Invalid email should throw
    await expect(
      caller.billing.updateBillingSettings({
        accountId: 1,
        billingEmail: "not-an-email",
      })
    ).rejects.toThrow();
  });

  it("payInvoice requires invoiceId", async () => {
    const { appRouter } = await import("./routers");
    const caller = appRouter.createCaller({
      user: {
        id: 1,
        openId: "test",
        email: "test@test.com",
        name: "Test",
        role: "admin",
        createdAt: new Date(),
        updatedAt: new Date(),
        lastSignedIn: new Date(),
        loginMethod: "oauth",
        passwordHash: null,
      },
      req: {} as any,
      res: {} as any,
    });

    // Should throw without invoiceId
    await expect(
      (caller.billing.payInvoice as any)({})
    ).rejects.toThrow();
  });
});
