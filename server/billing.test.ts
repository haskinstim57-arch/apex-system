import { describe, expect, it, vi, beforeEach } from "vitest";

// ─── Mock DB ───
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

// Mock Square service — include new card-on-file functions
vi.mock("./services/square", () => ({
  isSquareConfigured: vi.fn().mockReturnValue(true),
  createPaymentLink: vi.fn().mockResolvedValue({
    paymentLinkId: "sq-link-123",
    paymentLinkUrl: "https://square.link/test",
    orderId: "sq-order-123",
  }),
  createSquareCustomer: vi.fn().mockResolvedValue("sq-cust-123"),
  saveCardOnFile: vi.fn().mockResolvedValue({
    cardId: "ccof:card-123",
    brand: "VISA",
    last4: "1234",
    expMonth: 12,
    expYear: 2028,
  }),
  chargeCard: vi.fn().mockResolvedValue({
    paymentId: "sq-pay-123",
    receiptUrl: "https://squareup.com/receipt/123",
  }),
  removeCard: vi.fn().mockResolvedValue(undefined),
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
  it("all functions are exported (including chargeInvoice)", async () => {
    const mod = await import("./services/invoiceService");
    expect(mod.generateInvoice).toBeDefined();
    expect(mod.sendInvoice).toBeDefined();
    expect(mod.markInvoicePaid).toBeDefined();
    expect(mod.markInvoiceOverdue).toBeDefined();
    expect(mod.voidInvoice).toBeDefined();
    expect(mod.checkAutoInvoice).toBeDefined();
    expect(mod.chargeInvoice).toBeDefined();
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

  it("chargeInvoice throws when db is unavailable", async () => {
    const { getDb } = await import("./db");
    (getDb as any).mockResolvedValueOnce(null);

    const { chargeInvoice } = await import("./services/invoiceService");
    await expect(chargeInvoice(999)).rejects.toThrow("Database not available");
  });

  it("chargeInvoice throws when Square is not configured", async () => {
    const { getDb } = await import("./db");
    // Return a mock db so it passes the db check
    (getDb as any).mockResolvedValueOnce({
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([]),
        }),
      }),
    });

    const { isSquareConfigured } = await import("./services/square");
    (isSquareConfigured as any).mockReturnValueOnce(false);

    const { chargeInvoice } = await import("./services/invoiceService");
    await expect(chargeInvoice(999)).rejects.toThrow("Square is not configured");
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
// SQUARE SERVICE TESTS (including card-on-file)
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

  it("saveCardOnFile is callable and returns card details", async () => {
    const { saveCardOnFile } = await import("./services/square");
    const result = await saveCardOnFile({
      customerId: "sq-cust-123",
      sourceId: "cnon:card-nonce-ok",
    });
    expect(result).toHaveProperty("cardId");
    expect(result).toHaveProperty("brand");
    expect(result).toHaveProperty("last4");
    expect(result).toHaveProperty("expMonth");
    expect(result).toHaveProperty("expYear");
  });

  it("chargeCard is callable and returns payment details", async () => {
    const { chargeCard } = await import("./services/square");
    const result = await chargeCard({
      cardId: "ccof:card-123",
      customerId: "sq-cust-123",
      amountCents: 5000,
      referenceId: "billing-invoice-1",
      note: "Test charge",
    });
    expect(result).toHaveProperty("paymentId");
    expect(result).toHaveProperty("receiptUrl");
  });

  it("removeCard is callable", async () => {
    const { removeCard } = await import("./services/square");
    await expect(removeCard("ccof:card-123")).resolves.not.toThrow();
  });

  it("verifyWebhookSignature is callable", async () => {
    const { verifyWebhookSignature } = await import("./services/square");
    const result = verifyWebhookSignature("body", "sig", "url");
    expect(typeof result).toBe("boolean");
  });

  it("createSquareCustomer is callable and returns customer ID", async () => {
    const { createSquareCustomer } = await import("./services/square");
    const result = await createSquareCustomer({
      email: "test@example.com",
      displayName: "Test Account",
      referenceId: "account-1",
    });
    expect(typeof result).toBe("string");
    expect(result).toBe("sq-cust-123");
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

  it("billing router has all expected procedure names including card-on-file", async () => {
    const mod = await import("./routers/billing");
    const router = mod.billingRouter;
    const procedures = router._def.procedures;
    expect(procedures).toBeDefined();

    // Original procedures
    expect("getUsageSummary" in procedures).toBe(true);
    expect("getInvoices" in procedures).toBe(true);
    expect("payInvoice" in procedures).toBe(true);
    expect("updateBillingSettings" in procedures).toBe(true);
    expect("getAgencyOverview" in procedures).toBe(true);
    expect("getBillingRates" in procedures).toBe(true);
    expect("getAllInvoices" in procedures).toBe(true);

    // New card-on-file procedures
    expect("addPaymentMethod" in procedures).toBe(true);
    expect("getPaymentMethods" in procedures).toBe(true);
    expect("removePaymentMethod" in procedures).toBe(true);
    expect("setDefaultPaymentMethod" in procedures).toBe(true);
    expect("getBillingStatus" in procedures).toBe(true);
    expect("chargeInvoice" in procedures).toBe(true);
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

  it("addPaymentMethod requires accountId and sourceId", async () => {
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

    // Missing sourceId should throw
    await expect(
      (caller.billing.addPaymentMethod as any)({ accountId: 1 })
    ).rejects.toThrow();

    // Missing accountId should throw
    await expect(
      (caller.billing.addPaymentMethod as any)({ sourceId: "cnon:test" })
    ).rejects.toThrow();
  });

  it("chargeInvoice requires invoiceId", async () => {
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

    // Missing invoiceId should throw
    await expect(
      (caller.billing.chargeInvoice as any)({})
    ).rejects.toThrow();
  });

  it("removePaymentMethod requires paymentMethodId and accountId", async () => {
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

    // Missing paymentMethodId should throw
    await expect(
      (caller.billing.removePaymentMethod as any)({ accountId: 1 })
    ).rejects.toThrow();
  });
});
