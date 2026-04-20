/**
 * Billing Router
 *
 * Endpoints for:
 * - Sub-account: view usage summary, invoices, pay invoice, update billing settings
 * - Agency admin: overview of all accounts, manage rates, generate/send invoices
 */
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import {
  protectedProcedure,
  adminProcedure,
  router,
} from "../_core/trpc";
import { getDb } from "../db";
import {
  usageEvents,
  billingInvoices,
  billingRates,
  accountBilling,
  accounts,
  paymentMethods,
  type BillingRate,
  type BillingInvoice,
  type AccountBillingRow,
} from "../../drizzle/schema";
import { eq, desc, sql, and, gte, lte } from "drizzle-orm";
import { getAccountBillingSummary } from "../services/usageTracker";
import { accountMembers } from "../../drizzle/schema";
import {
  generateInvoice,
  sendInvoice,
  markInvoicePaid,
  voidInvoice,
} from "../services/invoiceService";
import { isSquareConfigured, saveCardOnFile, chargeCard, removeCard } from "../services/square";

// ─────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────

const EVENT_LABELS: Record<string, string> = {
  sms_sent: "SMS Messages",
  email_sent: "Emails Sent",
  ai_call_minute: "AI Call Minutes",
  voice_call_minute: "Voice Call Minutes",
  llm_request: "AI Assistant Requests",
  power_dialer_call: "Power Dialer Calls",
};

// ─────────────────────────────────────────────
// ROUTER
// ─────────────────────────────────────────────

export const billingRouter = router({
  // ═══════════════════════════════════════════
  // SUB-ACCOUNT ENDPOINTS
  // ═══════════════════════════════════════════

  /**
   * Get current usage summary for a sub-account.
   * Returns: current balance, billing rate, usage breakdown by type.
   */
  getUsageSummary: protectedProcedure
    .input(z.object({ accountId: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

      const summary = await getAccountBillingSummary(input.accountId);

      // Get usage breakdown by type for current unbilled period
      const usageBreakdown = await db
        .select({
          eventType: usageEvents.eventType,
          totalQuantity: sql<string>`SUM(${usageEvents.quantity})`,
          totalCost: sql<string>`SUM(${usageEvents.totalCost})`,
          eventCount: sql<number>`COUNT(*)`,
        })
        .from(usageEvents)
        .where(
          and(
            eq(usageEvents.accountId, input.accountId),
            eq(usageEvents.invoiced, false)
          )
        )
        .groupBy(usageEvents.eventType);

      const breakdown = usageBreakdown.map((row) => ({
        eventType: row.eventType,
        label: EVENT_LABELS[row.eventType] || row.eventType,
        quantity: Number(row.totalQuantity || 0),
        cost: Number(row.totalCost || 0),
        count: Number(row.eventCount || 0),
      }));

      return {
        currentBalance: summary ? Number(summary.billing.currentBalance) : 0,
        autoInvoiceThreshold: summary ? Number(summary.billing.autoInvoiceThreshold) : 50,
        billingEmail: summary?.billing.billingEmail || null,
        squareCustomerId: summary?.billing.squareCustomerId || null,
        rateName: summary?.rate?.name || "Standard",
        rates: summary?.rate
          ? {
              sms: Number(summary.rate.smsCostPerUnit),
              email: Number(summary.rate.emailCostPerUnit),
              aiCall: Number(summary.rate.aiCallCostPerMinute),
              voiceCall: Number(summary.rate.voiceCallCostPerMinute),
              llm: Number(summary.rate.llmCostPerRequest),
              powerDialer: Number(summary.rate.powerDialerCostPerCall),
            }
          : null,
        breakdown,
        squareConfigured: isSquareConfigured(),
      };
    }),

  /**
   * Get invoices for a sub-account.
   */
  getInvoices: protectedProcedure
    .input(
      z.object({
        accountId: z.number(),
        limit: z.number().min(1).max(100).default(50),
        offset: z.number().min(0).default(0),
      })
    )
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

      const invoiceRows: BillingInvoice[] = await db
        .select()
        .from(billingInvoices)
        .where(eq(billingInvoices.accountId, input.accountId))
        .orderBy(desc(billingInvoices.createdAt))
        .limit(input.limit)
        .offset(input.offset);

      const countResult = await db
        .select({ count: sql<number>`COUNT(*)` })
        .from(billingInvoices)
        .where(eq(billingInvoices.accountId, input.accountId));

      return {
        invoices: invoiceRows.map((inv) => ({
          ...inv,
          amount: Number(inv.amount),
          lineItems: inv.lineItems ? JSON.parse(inv.lineItems) : [],
        })),
        total: Number(countResult[0]?.count || 0),
      };
    }),

  /**
   * Get a single invoice by ID.
   */
  getInvoice: protectedProcedure
    .input(z.object({ invoiceId: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

      const rows: BillingInvoice[] = await db
        .select()
        .from(billingInvoices)
        .where(eq(billingInvoices.id, input.invoiceId));
      const invoice = rows[0];

      if (!invoice) throw new TRPCError({ code: "NOT_FOUND", message: "Invoice not found" });

      return {
        ...invoice,
        amount: Number(invoice.amount),
        lineItems: invoice.lineItems ? JSON.parse(invoice.lineItems) : [],
      };
    }),

  /**
   * Pay an invoice — generates a Square payment link.
   */
  payInvoice: protectedProcedure
    .input(
      z.object({
        invoiceId: z.number(),
        redirectUrl: z.string().url().optional(),
      })
    )
    .mutation(async ({ input }) => {
      if (!isSquareConfigured()) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "Square payments are not configured",
        });
      }

      const result = await sendInvoice(input.invoiceId, input.redirectUrl);
      return result;
    }),

  /**
   * Update billing settings for a sub-account.
   */
  updateBillingSettings: protectedProcedure
    .input(
      z.object({
        accountId: z.number(),
        billingEmail: z.string().email().optional(),
        autoInvoiceThreshold: z.number().min(0).optional(),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

      const updateData: Record<string, unknown> = {};
      if (input.billingEmail !== undefined) updateData.billingEmail = input.billingEmail;
      if (input.autoInvoiceThreshold !== undefined)
        updateData.autoInvoiceThreshold = input.autoInvoiceThreshold.toFixed(4);

      if (Object.keys(updateData).length === 0) {
        return { success: true };
      }

      await db
        .update(accountBilling)
        .set(updateData)
        .where(eq(accountBilling.accountId, input.accountId));

      return { success: true };
    }),

  /**
   * Get recent usage events for a sub-account (activity log).
   */
  getUsageEvents: protectedProcedure
    .input(
      z.object({
        accountId: z.number(),
        limit: z.number().min(1).max(200).default(50),
        offset: z.number().min(0).default(0),
        eventType: z.string().optional(),
      })
    )
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

      const conditions = [eq(usageEvents.accountId, input.accountId)];
      if (input.eventType) {
        conditions.push(eq(usageEvents.eventType, input.eventType as any));
      }

      const events = await db
        .select()
        .from(usageEvents)
        .where(and(...conditions))
        .orderBy(desc(usageEvents.createdAt))
        .limit(input.limit)
        .offset(input.offset);

      return events.map((e) => ({
        ...e,
        quantity: Number(e.quantity),
        unitCost: Number(e.unitCost),
        totalCost: Number(e.totalCost),
        label: EVENT_LABELS[e.eventType] || e.eventType,
        metadata: e.metadata ? JSON.parse(e.metadata) : null,
      }));
    }),

  // ═══════════════════════════════════════════
  // AGENCY ADMIN ENDPOINTS
  // ═══════════════════════════════════════════

  /**
   * Get billing overview for all sub-accounts (admin only).
   */
  getAgencyOverview: adminProcedure.query(async () => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

    // Get all accounts with their billing info
    const rows = await db
      .select({
        accountId: accounts.id,
        accountName: accounts.name,
        currentBalance: accountBilling.currentBalance,
        autoInvoiceThreshold: accountBilling.autoInvoiceThreshold,
        billingEmail: accountBilling.billingEmail,
        billingRateId: accountBilling.billingRateId,
      })
      .from(accounts)
      .leftJoin(accountBilling, eq(accounts.id, accountBilling.accountId));

    // Get total invoiced and paid amounts per account
    const invoiceSummary = await db
      .select({
        accountId: billingInvoices.accountId,
        totalInvoiced: sql<string>`SUM(CASE WHEN ${billingInvoices.status} != 'void' THEN ${billingInvoices.amount} ELSE 0 END)`,
        totalPaid: sql<string>`SUM(CASE WHEN ${billingInvoices.status} = 'paid' THEN ${billingInvoices.amount} ELSE 0 END)`,
        totalOutstanding: sql<string>`SUM(CASE WHEN ${billingInvoices.status} IN ('sent', 'overdue') THEN ${billingInvoices.amount} ELSE 0 END)`,
        invoiceCount: sql<number>`COUNT(*)`,
      })
      .from(billingInvoices)
      .groupBy(billingInvoices.accountId);

    const invoiceMap = new Map(invoiceSummary.map((s) => [s.accountId, s]));

    const overview = rows.map((row) => {
      const inv = invoiceMap.get(row.accountId);
      return {
        accountId: row.accountId,
        accountName: row.accountName,
        currentBalance: Number(row.currentBalance || 0),
        autoInvoiceThreshold: Number(row.autoInvoiceThreshold || 50),
        billingEmail: row.billingEmail,
        billingRateId: row.billingRateId,
        totalInvoiced: Number(inv?.totalInvoiced || 0),
        totalPaid: Number(inv?.totalPaid || 0),
        totalOutstanding: Number(inv?.totalOutstanding || 0),
        invoiceCount: Number(inv?.invoiceCount || 0),
      };
    });

    // Aggregate totals
    const totals = {
      totalAccounts: overview.length,
      totalUnbilledBalance: overview.reduce((sum, a) => sum + a.currentBalance, 0),
      totalInvoiced: overview.reduce((sum, a) => sum + a.totalInvoiced, 0),
      totalPaid: overview.reduce((sum, a) => sum + a.totalPaid, 0),
      totalOutstanding: overview.reduce((sum, a) => sum + a.totalOutstanding, 0),
    };

    return { accounts: overview, totals, squareConfigured: isSquareConfigured() };
  }),

  /**
   * Get all billing rates (admin only).
   */
  getBillingRates: adminProcedure.query(async () => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

    const rates: BillingRate[] = await db.select().from(billingRates);
    return rates.map((r) => ({
      ...r,
      smsCostPerUnit: Number(r.smsCostPerUnit),
      emailCostPerUnit: Number(r.emailCostPerUnit),
      aiCallCostPerMinute: Number(r.aiCallCostPerMinute),
      voiceCallCostPerMinute: Number(r.voiceCallCostPerMinute),
      llmCostPerRequest: Number(r.llmCostPerRequest),
      powerDialerCostPerCall: Number(r.powerDialerCostPerCall),
    }));
  }),

  /**
   * Create or update a billing rate (admin only).
   */
  upsertBillingRate: adminProcedure
    .input(
      z.object({
        id: z.number().optional(),
        name: z.string().min(1).max(100),
        isDefault: z.boolean().optional(),
        smsCostPerUnit: z.number().min(0),
        emailCostPerUnit: z.number().min(0),
        aiCallCostPerMinute: z.number().min(0),
        voiceCallCostPerMinute: z.number().min(0),
        llmCostPerRequest: z.number().min(0),
        powerDialerCostPerCall: z.number().min(0),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

      const rateData = {
        name: input.name,
        isDefault: input.isDefault ?? false,
        smsCostPerUnit: input.smsCostPerUnit.toFixed(6),
        emailCostPerUnit: input.emailCostPerUnit.toFixed(6),
        aiCallCostPerMinute: input.aiCallCostPerMinute.toFixed(6),
        voiceCallCostPerMinute: input.voiceCallCostPerMinute.toFixed(6),
        llmCostPerRequest: input.llmCostPerRequest.toFixed(6),
        powerDialerCostPerCall: input.powerDialerCostPerCall.toFixed(6),
      };

      if (input.isDefault) {
        // Unset other defaults
        await db.update(billingRates).set({ isDefault: false });
      }

      if (input.id) {
        await db.update(billingRates).set(rateData).where(eq(billingRates.id, input.id));
        return { id: input.id };
      } else {
        const [result] = await db.insert(billingRates).values(rateData) as any;
        return { id: result.insertId };
      }
    }),

  /**
   * Assign a billing rate to a sub-account (admin only).
   */
  assignBillingRate: adminProcedure
    .input(
      z.object({
        accountId: z.number(),
        billingRateId: z.number(),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

      const existing = await db
        .select()
        .from(accountBilling)
        .where(eq(accountBilling.accountId, input.accountId));

      if (existing.length > 0) {
        await db
          .update(accountBilling)
          .set({ billingRateId: input.billingRateId })
          .where(eq(accountBilling.accountId, input.accountId));
      } else {
        await db.insert(accountBilling).values({
          accountId: input.accountId,
          billingRateId: input.billingRateId,
          currentBalance: "0.0000",
          autoInvoiceThreshold: "50.0000",
        });
      }

      return { success: true };
    }),

  /**
   * Generate and optionally send an invoice for a sub-account (admin only).
   */
  generateAndSendInvoice: adminProcedure
    .input(
      z.object({
        accountId: z.number(),
        sendImmediately: z.boolean().default(false),
        notes: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const result = await generateInvoice(input.accountId, input.notes);

      if (!result) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "No unbilled usage events found for this account",
        });
      }

      let paymentLinkUrl: string | null = null;

      if (input.sendImmediately && isSquareConfigured()) {
        const sendResult = await sendInvoice(result.invoice.id);
        paymentLinkUrl = sendResult.paymentLinkUrl;
      }

      return {
        invoiceId: result.invoice.id,
        amount: Number(result.invoice.amount),
        lineItems: result.lineItems,
        eventCount: result.eventCount,
        paymentLinkUrl,
        status: input.sendImmediately ? "sent" : "draft",
      };
    }),

  /**
   * Mark an invoice as paid manually (admin only).
   */
  markPaid: adminProcedure
    .input(z.object({ invoiceId: z.number() }))
    .mutation(async ({ input }) => {
      await markInvoicePaid(input.invoiceId, "manual");
      return { success: true };
    }),

  /**
   * Void an invoice (admin only).
   */
  voidInvoice: adminProcedure
    .input(z.object({ invoiceId: z.number() }))
    .mutation(async ({ input }) => {
      await voidInvoice(input.invoiceId);
      return { success: true };
    }),

  /**
   * Get all invoices across all accounts (admin only).
   */
  getAllInvoices: adminProcedure
    .input(
      z.object({
        limit: z.number().min(1).max(200).default(50),
        offset: z.number().min(0).default(0),
        status: z.enum(["draft", "sent", "paid", "overdue", "void"]).optional(),
      })
    )
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

      const conditions = [];
      if (input.status) {
        conditions.push(eq(billingInvoices.status, input.status));
      }

      const query = db
        .select({
          invoice: billingInvoices,
          accountName: accounts.name,
        })
        .from(billingInvoices)
        .leftJoin(accounts, eq(billingInvoices.accountId, accounts.id))
        .orderBy(desc(billingInvoices.createdAt))
        .limit(input.limit)
        .offset(input.offset);

      const rows = conditions.length > 0
        ? await query.where(and(...conditions))
        : await query;

      return rows.map((row) => ({
        ...row.invoice,
        amount: Number(row.invoice.amount),
        lineItems: row.invoice.lineItems ? JSON.parse(row.invoice.lineItems) : [],
        accountName: row.accountName,
      }));
    }),

  // ═══════════════════════════════════════════
  // CARD-ON-FILE ENDPOINTS
  // ═══════════════════════════════════════════

  /**
   * Add a payment method (card on file) for a sub-account.
   * Accepts a Square Web Payments SDK nonce.
   */
  addPaymentMethod: protectedProcedure
    .input(
      z.object({
        accountId: z.number(),
        sourceId: z.string().min(1),
        cardholderName: z.string().optional(),
        setAsDefault: z.boolean().default(true),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

      if (!isSquareConfigured()) {
        throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Square payments are not configured" });
      }

      // Ensure the account has a Square customer ID
      const billingRows: AccountBillingRow[] = await db
        .select()
        .from(accountBilling)
        .where(eq(accountBilling.accountId, input.accountId));

      let billing = billingRows[0];
      let squareCustomerId = billing?.squareCustomerId;

      if (!squareCustomerId) {
        // Get account info to create Square customer
        const acctRows = await db
          .select({ name: accounts.name, email: accounts.email })
          .from(accounts)
          .where(eq(accounts.id, input.accountId));
        const acct = acctRows[0];

        const { createSquareCustomer } = await import("../services/square");
        squareCustomerId = await createSquareCustomer({
          email: acct?.email || "billing@sterlingmarketing.com",
          companyName: acct?.name || undefined,
          referenceId: String(input.accountId),
        });

        if (billing) {
          await db
            .update(accountBilling)
            .set({ squareCustomerId })
            .where(eq(accountBilling.accountId, input.accountId));
        } else {
          // Create billing record with default rate
          const defaultRates: import("../../drizzle/schema").BillingRate[] = await db
            .select()
            .from(billingRates)
            .limit(1);
          const rateId = defaultRates[0]?.id || 1;

          await db.insert(accountBilling).values({
            accountId: input.accountId,
            billingRateId: rateId,
            squareCustomerId,
          });
        }
      }

      // Save card on file via Square
      const card = await saveCardOnFile({
        customerId: squareCustomerId,
        sourceId: input.sourceId,
        cardholderName: input.cardholderName,
      });

      // If setAsDefault, unset other defaults first
      if (input.setAsDefault) {
        await db
          .update(paymentMethods)
          .set({ isDefault: false })
          .where(eq(paymentMethods.accountId, input.accountId));
      }

      // Save to our DB
      const [inserted] = await db.insert(paymentMethods).values({
        accountId: input.accountId,
        squareCardId: card.cardId,
        brand: card.brand,
        last4: card.last4,
        expMonth: card.expMonth,
        expYear: card.expYear,
        cardholderName: card.cardholderName || null,
        isDefault: input.setAsDefault,
      });

      return {
        id: inserted.insertId,
        squareCardId: card.cardId,
        brand: card.brand,
        last4: card.last4,
        expMonth: card.expMonth,
        expYear: card.expYear,
        isDefault: input.setAsDefault,
      };
    }),

  /**
   * Get all payment methods for a sub-account.
   */
  getPaymentMethods: protectedProcedure
    .input(z.object({ accountId: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

      const rows = await db
        .select()
        .from(paymentMethods)
        .where(eq(paymentMethods.accountId, input.accountId))
        .orderBy(desc(paymentMethods.createdAt));

      return rows;
    }),

  /**
   * Remove a payment method.
   */
  removePaymentMethod: protectedProcedure
    .input(z.object({ paymentMethodId: z.number(), accountId: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

      // Get the payment method
      const rows = await db
        .select()
        .from(paymentMethods)
        .where(
          and(
            eq(paymentMethods.id, input.paymentMethodId),
            eq(paymentMethods.accountId, input.accountId)
          )
        );
      const pm = rows[0];
      if (!pm) throw new TRPCError({ code: "NOT_FOUND", message: "Payment method not found" });

      // Disable in Square
      try {
        await removeCard(pm.squareCardId);
      } catch (err) {
        console.warn("[Billing] Failed to disable card in Square:", err);
      }

      // Delete from our DB
      await db
        .delete(paymentMethods)
        .where(eq(paymentMethods.id, input.paymentMethodId));

      // If this was the default, promote the next card
      if (pm.isDefault) {
        const remaining = await db
          .select()
          .from(paymentMethods)
          .where(eq(paymentMethods.accountId, input.accountId))
          .orderBy(desc(paymentMethods.createdAt))
          .limit(1);
        if (remaining[0]) {
          await db
            .update(paymentMethods)
            .set({ isDefault: true })
            .where(eq(paymentMethods.id, remaining[0].id));
        }
      }

      return { success: true };
    }),

  /**
   * Set a payment method as the default.
   */
  setDefaultPaymentMethod: protectedProcedure
    .input(z.object({ paymentMethodId: z.number(), accountId: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

      // Verify the payment method belongs to this account
      const rows = await db
        .select()
        .from(paymentMethods)
        .where(
          and(
            eq(paymentMethods.id, input.paymentMethodId),
            eq(paymentMethods.accountId, input.accountId)
          )
        );
      if (!rows[0]) throw new TRPCError({ code: "NOT_FOUND", message: "Payment method not found" });

      // Unset all defaults for this account
      await db
        .update(paymentMethods)
        .set({ isDefault: false })
        .where(eq(paymentMethods.accountId, input.accountId));

      // Set the new default
      await db
        .update(paymentMethods)
        .set({ isDefault: true })
        .where(eq(paymentMethods.id, input.paymentMethodId));

      return { success: true };
    }),

  /**
   * Get billing status for a sub-account (balance, past due, card on file).
   */
  getBillingStatus: protectedProcedure
    .input(z.object({ accountId: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

      const billingRows: AccountBillingRow[] = await db
        .select()
        .from(accountBilling)
        .where(eq(accountBilling.accountId, input.accountId));
      const billing = billingRows[0];

      // Check for overdue invoices
      const overdueRows = await db
        .select({ count: sql<number>`COUNT(*)` })
        .from(billingInvoices)
        .where(
          and(
            eq(billingInvoices.accountId, input.accountId),
            eq(billingInvoices.status, "overdue")
          )
        );
      const overdueCount = Number(overdueRows[0]?.count || 0);

      // Check for cards on file
      const cardRows = await db
        .select({ count: sql<number>`COUNT(*)` })
        .from(paymentMethods)
        .where(eq(paymentMethods.accountId, input.accountId));
      const cardCount = Number(cardRows[0]?.count || 0);

      return {
        hasCardOnFile: cardCount > 0,
        cardCount,
        billingPastDue: overdueCount > 0,
        overdueCount,
        currentBalance: billing ? Number(billing.currentBalance) : 0,
        squareCustomerId: billing?.squareCustomerId || null,
      };
    }),

  /**
   * Charge an invoice using the account's default card on file.
   */
  chargeInvoice: protectedProcedure
    .input(z.object({ invoiceId: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

      if (!isSquareConfigured()) {
        throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Square payments are not configured" });
      }

      // Get the invoice
      const invoiceRows: BillingInvoice[] = await db
        .select()
        .from(billingInvoices)
        .where(eq(billingInvoices.id, input.invoiceId));
      const invoice = invoiceRows[0];
      if (!invoice) throw new TRPCError({ code: "NOT_FOUND", message: "Invoice not found" });
      if (invoice.status === "paid") throw new TRPCError({ code: "BAD_REQUEST", message: "Invoice is already paid" });
      if (invoice.status === "void") throw new TRPCError({ code: "BAD_REQUEST", message: "Invoice has been voided" });

      // Get default card
      const cardRows = await db
        .select()
        .from(paymentMethods)
        .where(
          and(
            eq(paymentMethods.accountId, invoice.accountId),
            eq(paymentMethods.isDefault, true)
          )
        )
        .limit(1);
      const card = cardRows[0];
      if (!card) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "No default payment method on file" });

      // Get Square customer ID
      const billingRows: AccountBillingRow[] = await db
        .select()
        .from(accountBilling)
        .where(eq(accountBilling.accountId, invoice.accountId));
      const billing = billingRows[0];
      if (!billing?.squareCustomerId) {
        throw new TRPCError({ code: "PRECONDITION_FAILED", message: "No Square customer ID" });
      }

      const amountCents = Math.round(Number(invoice.amount) * 100);

      const result = await chargeCard({
        cardId: card.squareCardId,
        customerId: billing.squareCustomerId,
        amountCents,
        referenceId: `billing-invoice-${invoice.id}`,
        note: `Sterling Marketing Invoice #${invoice.id}`,
      });

      // Mark invoice as paid
      await markInvoicePaid(invoice.id, result.paymentId);

      return {
        success: true,
        paymentId: result.paymentId,
        receiptUrl: result.receiptUrl,
      };
    }),

  // ─────────────────────────────────────────────
  // REBILLING SETTINGS (Agency Admin)
  // ─────────────────────────────────────────────

  /**
   * Get rebilling (markup) settings for a sub-account.
   */
  getRebillingSettings: adminProcedure
    .input(z.object({ accountId: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });

      const rows: AccountBillingRow[] = await db
        .select()
        .from(accountBilling)
        .where(eq(accountBilling.accountId, input.accountId));
      const billing = rows[0];

      if (!billing) {
        // Return defaults if no billing row exists yet
        return {
          smsMarkup: 1.1,
          emailMarkup: 1.1,
          aiCallMarkup: 1.1,
          voiceCallMarkup: 1.1,
          llmMarkup: 1.1,
          dialerMarkup: 1.1,
          smsRebillingEnabled: true,
          emailRebillingEnabled: true,
          aiCallRebillingEnabled: true,
          voiceCallRebillingEnabled: true,
          llmRebillingEnabled: true,
          dialerRebillingEnabled: true,
        };
      }

      return {
        smsMarkup: Number(billing.smsMarkup),
        emailMarkup: Number(billing.emailMarkup),
        aiCallMarkup: Number(billing.aiCallMarkup),
        voiceCallMarkup: Number(billing.voiceCallMarkup),
        llmMarkup: Number(billing.llmMarkup),
        dialerMarkup: Number(billing.dialerMarkup),
        smsRebillingEnabled: !!billing.smsRebillingEnabled,
        emailRebillingEnabled: !!billing.emailRebillingEnabled,
        aiCallRebillingEnabled: !!billing.aiCallRebillingEnabled,
        voiceCallRebillingEnabled: !!billing.voiceCallRebillingEnabled,
        llmRebillingEnabled: !!billing.llmRebillingEnabled,
        dialerRebillingEnabled: !!billing.dialerRebillingEnabled,
      };
    }),

  /**
   * Update rebilling (markup) settings for a sub-account.
   * Agency admin only.
   */
  updateRebillingSettings: adminProcedure
    .input(
      z.object({
        accountId: z.number(),
        smsMarkup: z.number().min(1).max(10).optional(),
        emailMarkup: z.number().min(1).max(10).optional(),
        aiCallMarkup: z.number().min(1).max(10).optional(),
        voiceCallMarkup: z.number().min(1).max(10).optional(),
        llmMarkup: z.number().min(1).max(10).optional(),
        dialerMarkup: z.number().min(1).max(10).optional(),
        smsRebillingEnabled: z.boolean().optional(),
        emailRebillingEnabled: z.boolean().optional(),
        aiCallRebillingEnabled: z.boolean().optional(),
        voiceCallRebillingEnabled: z.boolean().optional(),
        llmRebillingEnabled: z.boolean().optional(),
        dialerRebillingEnabled: z.boolean().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });

      const { accountId, ...settings } = input;

      // Build update object with only provided fields
      const updateData: Record<string, unknown> = {};
      if (settings.smsMarkup !== undefined) updateData.smsMarkup = settings.smsMarkup.toFixed(3);
      if (settings.emailMarkup !== undefined) updateData.emailMarkup = settings.emailMarkup.toFixed(3);
      if (settings.aiCallMarkup !== undefined) updateData.aiCallMarkup = settings.aiCallMarkup.toFixed(3);
      if (settings.voiceCallMarkup !== undefined) updateData.voiceCallMarkup = settings.voiceCallMarkup.toFixed(3);
      if (settings.llmMarkup !== undefined) updateData.llmMarkup = settings.llmMarkup.toFixed(3);
      if (settings.dialerMarkup !== undefined) updateData.dialerMarkup = settings.dialerMarkup.toFixed(3);
      if (settings.smsRebillingEnabled !== undefined) updateData.smsRebillingEnabled = settings.smsRebillingEnabled;
      if (settings.emailRebillingEnabled !== undefined) updateData.emailRebillingEnabled = settings.emailRebillingEnabled;
      if (settings.aiCallRebillingEnabled !== undefined) updateData.aiCallRebillingEnabled = settings.aiCallRebillingEnabled;
      if (settings.voiceCallRebillingEnabled !== undefined) updateData.voiceCallRebillingEnabled = settings.voiceCallRebillingEnabled;
      if (settings.llmRebillingEnabled !== undefined) updateData.llmRebillingEnabled = settings.llmRebillingEnabled;
      if (settings.dialerRebillingEnabled !== undefined) updateData.dialerRebillingEnabled = settings.dialerRebillingEnabled;

      if (Object.keys(updateData).length === 0) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "No settings to update" });
      }

      // Ensure billing row exists
      const existing: AccountBillingRow[] = await db
        .select()
        .from(accountBilling)
        .where(eq(accountBilling.accountId, accountId));

      if (!existing[0]) {
        // Auto-create with defaults
        const defaultRateRows: BillingRate[] = await db
          .select()
          .from(billingRates)
          .where(eq(billingRates.isDefault, true));
        const defaultRate = defaultRateRows[0];
        if (!defaultRate) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "No default billing rate" });

        await db.insert(accountBilling).values({
          accountId,
          billingRateId: defaultRate.id,
          currentBalance: "0.0000",
          autoInvoiceThreshold: "50.0000",
          ...updateData,
        });
      } else {
        await db
          .update(accountBilling)
          .set(updateData)
          .where(eq(accountBilling.accountId, accountId));
      }

      return { success: true };
    }),

  /**
   * Process initial deposit for a new sub-account during onboarding.
   * Charges $10.00 via Square and adds it to the account balance.
   */
  initialDeposit: protectedProcedure
    .input(z.object({ accountId: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

      if (!isSquareConfigured()) {
        throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Square payments are not configured" });
      }

      // Get billing record
      const billingRows: AccountBillingRow[] = await db
        .select()
        .from(accountBilling)
        .where(eq(accountBilling.accountId, input.accountId));
      const billing = billingRows[0];

      if (!billing?.squareCustomerId) {
        throw new TRPCError({ code: "PRECONDITION_FAILED", message: "No payment method on file. Please add a card first." });
      }

      // Get default payment method
      const defaultCards = await db
        .select()
        .from(paymentMethods)
        .where(
          and(
            eq(paymentMethods.accountId, input.accountId),
            eq(paymentMethods.isDefault, true)
          )
        )
        .limit(1);

      const card = defaultCards[0];
      if (!card) {
        throw new TRPCError({ code: "PRECONDITION_FAILED", message: "No default payment method found." });
      }

      // Charge $10.00 via Square
      const depositAmountCents = 1000; // $10.00
      try {
        const { chargeCard } = await import("../services/square");
        await chargeCard({
          customerId: billing.squareCustomerId,
          cardId: card.squareCardId,
          amountCents: depositAmountCents,
          referenceId: `initial-deposit-${input.accountId}`,
          note: "Initial account deposit",
        });
      } catch (err: any) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: `Payment failed: ${err.message || "Unknown error"}`,
        });
      }

      // Add $10.00 to account balance
      const currentBalance = Number(billing.currentBalance || 0);
      const newBalance = currentBalance + 10;
      await db
        .update(accountBilling)
        .set({ currentBalance: String(newBalance.toFixed(4)) })
        .where(eq(accountBilling.accountId, input.accountId));

      return { success: true, newBalance };
    }),

  // ═══════════════════════════════════════════
  // AUTO-RECHARGE SETTINGS
  // ═══════════════════════════════════════════

  /**
   * Get auto-recharge settings for a sub-account.
   */
  getAutoRechargeSettings: protectedProcedure
    .input(z.object({ accountId: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

      const rows: AccountBillingRow[] = await db
        .select()
        .from(accountBilling)
        .where(eq(accountBilling.accountId, input.accountId));
      const billing = rows[0];

      return {
        autoRechargeEnabled: billing?.autoRechargeEnabled ?? false,
        autoRechargeAmountCents: billing?.autoRechargeAmountCents ?? 1000,
        autoRechargeThreshold: billing?.autoRechargeThreshold ? Number(billing.autoRechargeThreshold) : 10.0,
        rechargeAttemptsToday: billing?.rechargeAttemptsToday ?? 0,
      };
    }),

  /**
   * Update auto-recharge settings for a sub-account.
   */
  updateAutoRechargeSettings: protectedProcedure
    .input(
      z.object({
        accountId: z.number(),
        autoRechargeEnabled: z.boolean().optional(),
        autoRechargeAmountCents: z.number().min(500).max(100000).optional(), // $5 to $1000
        autoRechargeThreshold: z.number().min(1).max(500).optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      // Role enforcement: owner/manager only, employees cannot edit
      if (ctx.user.role !== "admin") {
        const db2 = await getDb();
        if (db2) {
          const memberRows = await db2
            .select({ role: accountMembers.role })
            .from(accountMembers)
            .where(and(eq(accountMembers.accountId, input.accountId), eq(accountMembers.userId, ctx.user.id)));
          const memberRole = memberRows[0]?.role;
          if (memberRole === "employee") {
            throw new TRPCError({ code: "FORBIDDEN", message: "Only account owners and managers can edit billing settings" });
          }
        }
      }
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

      const updateData: Record<string, unknown> = {};
      if (input.autoRechargeEnabled !== undefined) updateData.autoRechargeEnabled = input.autoRechargeEnabled;
      if (input.autoRechargeAmountCents !== undefined) updateData.autoRechargeAmountCents = input.autoRechargeAmountCents;
      if (input.autoRechargeThreshold !== undefined) updateData.autoRechargeThreshold = input.autoRechargeThreshold.toFixed(4);

      if (Object.keys(updateData).length === 0) {
        return { success: true };
      }

      // Ensure billing row exists
      const existing: AccountBillingRow[] = await db
        .select()
        .from(accountBilling)
        .where(eq(accountBilling.accountId, input.accountId));

      if (!existing[0]) {
        const defaultRateRows = await db.select().from(billingRates).limit(1);
        const rateId = defaultRateRows[0]?.id || 1;
        await db.insert(accountBilling).values({
          accountId: input.accountId,
          billingRateId: rateId,
          currentBalance: "0.0000",
          autoInvoiceThreshold: "50.0000",
          ...updateData,
        });
      } else {
        await db
          .update(accountBilling)
          .set(updateData)
          .where(eq(accountBilling.accountId, input.accountId));
      }

      return { success: true };
    }),

  /**
   * Lightweight balance check for the header pill.
   * Returns just the balance and status flags.
   */
  /**
   * Add funds manually — charges the default card and credits the balance.
   * Owner/manager only.
   */
  addFunds: protectedProcedure
    .input(
      z.object({
        accountId: z.number(),
        amountCents: z.number().min(500).max(100000), // $5 to $1000
      })
    )
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

      // Role enforcement: owner/manager only
      if (ctx.user.role !== "admin") {
        const memberRows = await db
          .select({ role: accountMembers.role })
          .from(accountMembers)
          .where(and(eq(accountMembers.accountId, input.accountId), eq(accountMembers.userId, ctx.user.id)));
        const memberRole = memberRows[0]?.role;
        if (memberRole === "employee") {
          throw new TRPCError({ code: "FORBIDDEN", message: "Only account owners and managers can add funds" });
        }
      }

      // Get default payment method
      const cardRows = await db
        .select()
        .from(paymentMethods)
        .where(and(eq(paymentMethods.accountId, input.accountId), eq(paymentMethods.isDefault, true)))
        .limit(1);
      let card = cardRows[0];
      if (!card) {
        // Fall back to any card
        const anyCard = await db.select().from(paymentMethods).where(eq(paymentMethods.accountId, input.accountId)).limit(1);
        card = anyCard[0];
      }
      if (!card) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "No payment method on file. Please add a card first." });
      }

      // Get Square customer ID
      const billingRows: AccountBillingRow[] = await db
        .select()
        .from(accountBilling)
        .where(eq(accountBilling.accountId, input.accountId));
      const billing = billingRows[0];
      if (!billing?.squareCustomerId) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "No billing profile found. Please contact support." });
      }

      // Charge the card
      const invoiceNumber = `FUND-${input.accountId}-${Date.now().toString(36).toUpperCase()}`;
      const chargeResult = await chargeCard({
        cardId: card.squareCardId,
        customerId: billing.squareCustomerId,
        amountCents: input.amountCents,
        referenceId: invoiceNumber,
        note: `Manual funds deposit — $${(input.amountCents / 100).toFixed(2)}`,
      });

      // Record the invoice
      await db.insert(billingInvoices).values({
        accountId: input.accountId,
        invoiceNumber,
        amount: (input.amountCents / 100).toFixed(4),
        status: "paid",
        squarePaymentId: chargeResult.paymentId,
        lineItems: JSON.stringify([{
          description: "Manual funds deposit",
          quantity: 1,
          unitCost: (input.amountCents / 100).toFixed(2),
          total: (input.amountCents / 100).toFixed(2),
        }]),
        paidAt: new Date(),
        notes: `Manual add funds by user ${ctx.user.id}`,
      });

      // Credit the balance
      const amountDecimal = (input.amountCents / 100).toFixed(4);
      await db
        .update(accountBilling)
        .set({
          currentBalance: sql`${accountBilling.currentBalance} + ${amountDecimal}`,
        })
        .where(eq(accountBilling.accountId, input.accountId));

      // If account was billing_locked, unlock it
      const acctRows = await db.select({ status: accounts.status }).from(accounts).where(eq(accounts.id, input.accountId));
      if (acctRows[0]?.status === "billing_locked") {
        await db.update(accounts).set({ status: "active" }).where(eq(accounts.id, input.accountId));
        // Reset recharge attempts
        await db.update(accountBilling).set({ rechargeAttemptsToday: 0 }).where(eq(accountBilling.accountId, input.accountId));
      }

      return {
        success: true,
        newBalance: Number(billing.currentBalance) + (input.amountCents / 100),
        invoiceNumber,
        receiptUrl: chargeResult.receiptUrl,
      };
    }),

  getBalancePill: protectedProcedure
    .input(z.object({ accountId: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return { balance: 0, hasCard: false, isLocked: false };

      const billingRows: AccountBillingRow[] = await db
        .select()
        .from(accountBilling)
        .where(eq(accountBilling.accountId, input.accountId));
      const billing = billingRows[0];

      const cardRows = await db
        .select({ count: sql<number>`COUNT(*)` })
        .from(paymentMethods)
        .where(eq(paymentMethods.accountId, input.accountId));
      const hasCard = Number(cardRows[0]?.count || 0) > 0;

      // Check if account is billing_locked
      const acctRows = await db
        .select({ status: accounts.status })
        .from(accounts)
        .where(eq(accounts.id, input.accountId));
      const isLocked = acctRows[0]?.status === "billing_locked";

      return {
        balance: billing ? Number(billing.currentBalance) : 0,
        hasCard,
        isLocked,
        autoRechargeEnabled: billing?.autoRechargeEnabled ?? false,
      };
    }),
});
