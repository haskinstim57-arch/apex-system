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
  type BillingRate,
  type BillingInvoice,
  type AccountBillingRow,
} from "../../drizzle/schema";
import { eq, desc, sql, and, gte, lte } from "drizzle-orm";
import { getAccountBillingSummary } from "../services/usageTracker";
import {
  generateInvoice,
  sendInvoice,
  markInvoicePaid,
  voidInvoice,
} from "../services/invoiceService";
import { isSquareConfigured } from "../services/square";

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
});
