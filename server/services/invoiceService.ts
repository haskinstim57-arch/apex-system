/**
 * Invoice Service
 *
 * Handles:
 * - Generating invoices from unbilled usage events
 * - Sending invoices with Square payment links
 * - Marking invoices as paid
 * - Auto-invoicing when balance exceeds threshold
 */
import { getDb } from "../db";
import {
  usageEvents,
  billingInvoices,
  accountBilling,
  accounts,
  type BillingInvoice,
  type InsertBillingInvoice,
  type UsageEvent,
} from "../../drizzle/schema";
import { eq, and, sql } from "drizzle-orm";
import { createPaymentLink, isSquareConfigured } from "./square";
import { notifyOwner } from "../_core/notification";

// ─────────────────────────────────────────────
// LINE ITEM TYPE
// ─────────────────────────────────────────────

interface LineItem {
  description: string;
  eventType: string;
  quantity: number;
  unitCost: number;
  total: number;
}

// ─────────────────────────────────────────────
// EVENT TYPE LABELS
// ─────────────────────────────────────────────

const EVENT_LABELS: Record<string, string> = {
  sms_sent: "SMS Messages",
  email_sent: "Emails Sent",
  ai_call_minute: "AI Call Minutes",
  voice_call_minute: "Voice Call Minutes",
  llm_request: "AI Assistant (Jarvis) Requests",
  power_dialer_call: "Power Dialer Calls",
};

// ─────────────────────────────────────────────
// GENERATE INVOICE
// ─────────────────────────────────────────────

interface GenerateInvoiceResult {
  invoice: BillingInvoice;
  lineItems: LineItem[];
  eventCount: number;
}

/**
 * Generate an invoice from all unbilled usage events for an account.
 *
 * 1. Gather all uninvoiced usage_events for the account.
 * 2. Group by event_type and sum quantities + costs.
 * 3. Create a billing_invoices row with line items.
 * 4. Mark all usage events as invoiced.
 * 5. Reset the account's running balance to 0.
 */
export async function generateInvoice(
  accountId: number,
  notes?: string
): Promise<GenerateInvoiceResult | null> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // 1. Gather unbilled events
  const unbilledEvents: UsageEvent[] = await db
    .select()
    .from(usageEvents)
    .where(
      and(
        eq(usageEvents.accountId, accountId),
        eq(usageEvents.invoiced, false)
      )
    );

  if (unbilledEvents.length === 0) {
    return null; // Nothing to invoice
  }

  // 2. Group by event type
  const grouped: Record<string, { quantity: number; totalCost: number; unitCost: number; count: number }> = {};
  let grandTotal = 0;
  let periodStart: Date | null = null;
  let periodEnd: Date | null = null;

  for (const evt of unbilledEvents) {
    const type = evt.eventType;
    if (!grouped[type]) {
      grouped[type] = { quantity: 0, totalCost: 0, unitCost: Number(evt.unitCost), count: 0 };
    }
    grouped[type].quantity += Number(evt.quantity);
    grouped[type].totalCost += Number(evt.totalCost);
    grouped[type].count += 1;
    grandTotal += Number(evt.totalCost);

    const evtDate = evt.createdAt;
    if (!periodStart || evtDate < periodStart) periodStart = evtDate;
    if (!periodEnd || evtDate > periodEnd) periodEnd = evtDate;
  }

  // 3. Build line items
  const lineItems: LineItem[] = Object.entries(grouped).map(([type, data]) => ({
    description: EVENT_LABELS[type] || type,
    eventType: type,
    quantity: Math.round(data.quantity * 10000) / 10000,
    unitCost: data.unitCost,
    total: Math.round(data.totalCost * 10000) / 10000,
  }));

  grandTotal = Math.round(grandTotal * 100) / 100; // Round to cents

  // 4. Create invoice
  const dueDate = new Date();
  dueDate.setDate(dueDate.getDate() + 30); // Net 30

  // Generate invoice number: APEX-YYYYMMDD-XXXXX (random suffix)
  const now = new Date();
  const dateStr = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}`;
  const suffix = String(Math.floor(Math.random() * 99999)).padStart(5, "0");
  const invoiceNumber = `APEX-${dateStr}-${suffix}`;

  const invoiceData: InsertBillingInvoice = {
    accountId,
    invoiceNumber,
    amount: grandTotal.toFixed(4),
    status: "draft",
    lineItems: JSON.stringify(lineItems),
    periodStart: periodStart!,
    periodEnd: periodEnd!,
    dueDate,
    notes: notes || null,
  };

  const [insertResult] = await db.insert(billingInvoices).values(invoiceData) as any;
  const invoiceId = insertResult.insertId;

  // 5. Mark events as invoiced
  const eventIds = unbilledEvents.map((e) => e.id);
  // Update in batches of 100 to avoid query size limits
  for (let i = 0; i < eventIds.length; i += 100) {
    const batch = eventIds.slice(i, i + 100);
    await db
      .update(usageEvents)
      .set({ invoiced: true, invoiceId })
      .where(
        and(
          eq(usageEvents.accountId, accountId),
          eq(usageEvents.invoiced, false),
          sql`${usageEvents.id} IN (${sql.raw(batch.join(","))})`
        )
      );
  }

  // 6. Reset running balance
  await db
    .update(accountBilling)
    .set({ currentBalance: "0.0000" })
    .where(eq(accountBilling.accountId, accountId));

  // Fetch the created invoice
  const invoiceRows: BillingInvoice[] = await db
    .select()
    .from(billingInvoices)
    .where(eq(billingInvoices.id, invoiceId));
  const invoice = invoiceRows[0];

  console.log(
    `[InvoiceService] Generated invoice #${invoiceId} for account ${accountId}: $${grandTotal} (${unbilledEvents.length} events)`
  );

  return { invoice, lineItems, eventCount: unbilledEvents.length };
}

// ─────────────────────────────────────────────
// SEND INVOICE (create Square payment link)
// ─────────────────────────────────────────────

interface SendInvoiceResult {
  paymentLinkUrl: string;
  paymentLinkId: string;
}

/**
 * Send an invoice by creating a Square payment link and updating the invoice status.
 */
export async function sendInvoice(
  invoiceId: number,
  redirectUrl?: string
): Promise<SendInvoiceResult> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  if (!isSquareConfigured()) {
    throw new Error("Square is not configured — cannot create payment link");
  }

  const invoiceRows: BillingInvoice[] = await db
    .select()
    .from(billingInvoices)
    .where(eq(billingInvoices.id, invoiceId));
  const invoice = invoiceRows[0];

  if (!invoice) throw new Error(`Invoice ${invoiceId} not found`);
  if (invoice.status === "paid") throw new Error("Invoice is already paid");
  if (invoice.status === "void") throw new Error("Invoice has been voided");

  const amountCents = Math.round(Number(invoice.amount) * 100);

  // Get account name for the description
  const accountRows = await db
    .select({ name: accounts.name })
    .from(accounts)
    .where(eq(accounts.id, invoice.accountId));
  const accountName = accountRows[0]?.name || `Account #${invoice.accountId}`;

  // Get billing email
  const billingRows = await db
    .select({ billingEmail: accountBilling.billingEmail })
    .from(accountBilling)
    .where(eq(accountBilling.accountId, invoice.accountId));
  const billingEmail = billingRows[0]?.billingEmail;

  const lineItems: LineItem[] = invoice.lineItems ? JSON.parse(invoice.lineItems) : [];
  const description = `Apex System Invoice #${invoiceId} — ${accountName} (${lineItems.map((l) => l.description).join(", ")})`;

  const paymentLink = await createPaymentLink({
    referenceId: `billing-invoice-${invoiceId}`,
    amountCents,
    description,
    customerEmail: billingEmail || undefined,
    redirectUrl,
  });

  // Update invoice with payment link info
  await db
    .update(billingInvoices)
    .set({
      status: "sent",
      squarePaymentLinkId: paymentLink.paymentLinkId,
      squarePaymentLinkUrl: paymentLink.paymentLinkUrl,
    })
    .where(eq(billingInvoices.id, invoiceId));

  // Notify the agency admin
  notifyOwner({
    title: `Invoice #${invoiceId} sent to ${accountName}`,
    content: `Amount: $${Number(invoice.amount).toFixed(2)}\nPayment link: ${paymentLink.paymentLinkUrl}`,
  }).catch(() => {});

  console.log(
    `[InvoiceService] Sent invoice #${invoiceId} — payment link: ${paymentLink.paymentLinkUrl}`
  );

  return {
    paymentLinkUrl: paymentLink.paymentLinkUrl,
    paymentLinkId: paymentLink.paymentLinkId,
  };
}

// ─────────────────────────────────────────────
// MARK INVOICE PAID
// ─────────────────────────────────────────────

/**
 * Mark an invoice as paid (called from Square webhook or manually).
 */
export async function markInvoicePaid(
  invoiceId: number,
  squarePaymentId?: string
): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const updateData: Partial<BillingInvoice> = {
    status: "paid",
    paidAt: new Date(),
  };
  if (squarePaymentId) {
    updateData.squarePaymentId = squarePaymentId;
  }

  await db
    .update(billingInvoices)
    .set(updateData as any)
    .where(eq(billingInvoices.id, invoiceId));

  // Get invoice details for notification
  const invoiceRows: BillingInvoice[] = await db
    .select()
    .from(billingInvoices)
    .where(eq(billingInvoices.id, invoiceId));
  const invoice = invoiceRows[0];

  if (invoice) {
    const accountRows = await db
      .select({ name: accounts.name })
      .from(accounts)
      .where(eq(accounts.id, invoice.accountId));
    const accountName = accountRows[0]?.name || `Account #${invoice.accountId}`;

    notifyOwner({
      title: `Payment received — Invoice #${invoiceId}`,
      content: `${accountName} paid $${Number(invoice.amount).toFixed(2)}`,
    }).catch(() => {});
  }

  console.log(`[InvoiceService] Invoice #${invoiceId} marked as paid`);
}

// ─────────────────────────────────────────────
// MARK INVOICE OVERDUE
// ─────────────────────────────────────────────

/**
 * Mark an invoice as overdue (called from Square webhook on payment failure).
 */
export async function markInvoiceOverdue(invoiceId: number): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db
    .update(billingInvoices)
    .set({ status: "overdue" } as any)
    .where(eq(billingInvoices.id, invoiceId));

  console.log(`[InvoiceService] Invoice #${invoiceId} marked as overdue`);
}

// ─────────────────────────────────────────────
// VOID INVOICE
// ─────────────────────────────────────────────

/**
 * Void an invoice and restore the balance.
 */
export async function voidInvoice(invoiceId: number): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const invoiceRows: BillingInvoice[] = await db
    .select()
    .from(billingInvoices)
    .where(eq(billingInvoices.id, invoiceId));
  const invoice = invoiceRows[0];

  if (!invoice) throw new Error(`Invoice ${invoiceId} not found`);
  if (invoice.status === "paid") throw new Error("Cannot void a paid invoice");

  // Restore the balance
  await db
    .update(accountBilling)
    .set({
      currentBalance: sql`${accountBilling.currentBalance} + ${invoice.amount}`,
    })
    .where(eq(accountBilling.accountId, invoice.accountId));

  // Un-invoice the events
  await db
    .update(usageEvents)
    .set({ invoiced: false, invoiceId: null })
    .where(eq(usageEvents.invoiceId, invoiceId));

  // Void the invoice
  await db
    .update(billingInvoices)
    .set({ status: "void" } as any)
    .where(eq(billingInvoices.id, invoiceId));

  console.log(`[InvoiceService] Invoice #${invoiceId} voided — balance restored`);
}

// ─────────────────────────────────────────────
// AUTO-INVOICE CHECK
// ─────────────────────────────────────────────

/**
 * Check if an account's balance exceeds its auto-invoice threshold.
 * If so, generate and optionally send an invoice.
 * Called after trackUsage() increments the balance.
 */
export async function checkAutoInvoice(accountId: number): Promise<void> {
  const db = await getDb();
  if (!db) return;

  const billingRows = await db
    .select()
    .from(accountBilling)
    .where(eq(accountBilling.accountId, accountId));
  const billing = billingRows[0];

  if (!billing) return;

  const balance = Number(billing.currentBalance);
  const threshold = Number(billing.autoInvoiceThreshold);

  if (threshold > 0 && balance >= threshold) {
    console.log(
      `[InvoiceService] Auto-invoice triggered for account ${accountId}: balance $${balance} >= threshold $${threshold}`
    );

    const result = await generateInvoice(accountId, "Auto-generated invoice — balance threshold reached");
    if (result && isSquareConfigured()) {
      try {
        await sendInvoice(result.invoice.id);
      } catch (err) {
        console.error(`[InvoiceService] Auto-send failed for invoice #${result.invoice.id}:`, err);
      }
    }
  }
}
