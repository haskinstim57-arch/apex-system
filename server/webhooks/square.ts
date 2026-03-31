/**
 * Square Webhook Handler
 *
 * Handles payment.completed and payment.failed events from Square
 * to automatically update billing invoice statuses.
 *
 * Webhook URL: POST /api/webhooks/square
 */
import { Router, Request, Response } from "express";
import { verifyWebhookSignature } from "../services/square";
import { markInvoicePaid, markInvoiceOverdue } from "../services/invoiceService";
import { getDb } from "../db";
import { billingInvoices } from "../../drizzle/schema";
import { eq } from "drizzle-orm";

export const squareWebhookRouter = Router();

squareWebhookRouter.post(
  "/api/webhooks/square",
  async (req: Request, res: Response) => {
    try {
      const signature = req.headers["x-square-hmacsha256-signature"] as string;
      const body = JSON.stringify(req.body);

      // Build the notification URL from the request
      const protocol = req.headers["x-forwarded-proto"] || req.protocol;
      const host = req.headers["x-forwarded-host"] || req.headers.host;
      const notificationUrl = `${protocol}://${host}${req.originalUrl}`;

      // Verify signature
      if (signature && !verifyWebhookSignature(body, signature, notificationUrl)) {
        console.warn("[Square Webhook] Invalid signature — rejecting");
        res.status(401).json({ error: "Invalid signature" });
        return;
      }

      const event = req.body;
      const eventType = event?.type;

      console.log(`[Square Webhook] Received event: ${eventType}`);

      if (!eventType) {
        res.status(200).json({ success: true, message: "No event type" });
        return;
      }

      // ── Handle payment events ──────────────────────────────────────
      if (eventType === "payment.completed" || eventType === "payment.updated") {
        const payment = event?.data?.object?.payment;
        if (!payment) {
          res.status(200).json({ success: true, message: "No payment data" });
          return;
        }

        const paymentId = payment.id;
        const orderId = payment.order_id;
        const note = payment.note || "";
        const status = payment.status; // COMPLETED, FAILED, CANCELED

        // Extract invoice ID from the payment note (format: "billing-invoice-{id}")
        const invoiceMatch = note.match(/billing-invoice-(\d+)/);
        let invoiceId: number | null = invoiceMatch ? parseInt(invoiceMatch[1], 10) : null;

        // If no match from note, try to find by Square payment link
        if (!invoiceId && orderId) {
          const db = await getDb();
          if (db) {
            // Look up invoice by order ID (stored in squarePaymentLinkId or similar)
            const rows = await db
              .select()
              .from(billingInvoices)
              .where(eq(billingInvoices.squarePaymentLinkId, orderId));
            if (rows[0]) {
              invoiceId = rows[0].id;
            }
          }
        }

        if (!invoiceId) {
          console.log(`[Square Webhook] No matching invoice found for payment ${paymentId}`);
          res.status(200).json({ success: true, message: "No matching invoice" });
          return;
        }

        if (status === "COMPLETED") {
          await markInvoicePaid(invoiceId, paymentId);
          console.log(`[Square Webhook] Invoice #${invoiceId} marked as paid (payment: ${paymentId})`);
        } else if (status === "FAILED" || status === "CANCELED") {
          await markInvoiceOverdue(invoiceId);
          console.log(`[Square Webhook] Invoice #${invoiceId} marked as overdue (payment ${status})`);
        }
      }

      // ── Handle order events (payment link orders) ──────────────────
      if (eventType === "order.updated") {
        const order = event?.data?.object?.order;
        if (order?.state === "COMPLETED") {
          // Find invoice by checking tenders/payments
          const tenders = order.tenders || [];
          for (const tender of tenders) {
            if (tender.payment_id) {
              // The payment.completed event should handle this,
              // but this is a fallback
              console.log(`[Square Webhook] Order completed with payment ${tender.payment_id}`);
            }
          }
        }
      }

      res.status(200).json({ success: true, message: "EVENT_RECEIVED" });
    } catch (error) {
      console.error("[Square Webhook] Error processing webhook:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  }
);
