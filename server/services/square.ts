/**
 * Square Integration Service
 *
 * Handles:
 * - Creating payment links for billing invoices
 * - Retrieving payment status
 * - Creating/managing Square customers
 * - Verifying webhook signatures
 */
import { SquareClient, SquareEnvironment } from "square";
import { ENV } from "../_core/env";
import crypto from "crypto";

// ─────────────────────────────────────────────
// SQUARE CLIENT
// ─────────────────────────────────────────────

let _client: SquareClient | null = null;

function getSquareClient(): SquareClient {
  if (!_client) {
    if (!ENV.squareAccessToken) {
      throw new Error("[Square] SQUARE_ACCESS_TOKEN is not configured");
    }
    _client = new SquareClient({
      token: ENV.squareAccessToken,
      environment: ENV.squareAccessToken.startsWith("sandbox-")
        ? SquareEnvironment.Sandbox
        : SquareEnvironment.Production,
    });
  }
  return _client;
}

/**
 * Check if Square is configured (has access token).
 */
export function isSquareConfigured(): boolean {
  return !!ENV.squareAccessToken;
}

// ─────────────────────────────────────────────
// PAYMENT LINKS
// ─────────────────────────────────────────────

interface CreatePaymentLinkParams {
  /** Unique reference for this invoice (e.g. "billing-invoice-42") */
  referenceId: string;
  /** Invoice amount in cents (e.g. 5000 = $50.00) */
  amountCents: number;
  /** Description shown on the payment page */
  description: string;
  /** Customer email for receipt */
  customerEmail?: string;
  /** Redirect URL after payment */
  redirectUrl?: string;
}

interface PaymentLinkResult {
  paymentLinkId: string;
  paymentLinkUrl: string;
  orderId: string;
}

/**
 * Create a Square payment link for a billing invoice.
 */
export async function createPaymentLink(
  params: CreatePaymentLinkParams
): Promise<PaymentLinkResult> {
  const client = getSquareClient();

  const idempotencyKey = crypto.randomUUID();

  const response = await client.checkout.paymentLinks.create({
    idempotencyKey,
    quickPay: {
      name: params.description,
      priceMoney: {
        amount: BigInt(params.amountCents),
        currency: "USD",
      },
      locationId: ENV.squareLocationId,
    },
    paymentNote: params.referenceId,
    checkoutOptions: {
      redirectUrl: params.redirectUrl,
      askForShippingAddress: false,
    },
  });

  const link = response.paymentLink;
  if (!link || !link.id || !link.url) {
    throw new Error("[Square] Failed to create payment link — no link returned");
  }

  return {
    paymentLinkId: link.id,
    paymentLinkUrl: link.url,
    orderId: link.orderId ?? "",
  };
}

// ─────────────────────────────────────────────
// CUSTOMERS
// ─────────────────────────────────────────────

interface CreateCustomerParams {
  email: string;
  companyName?: string;
  referenceId: string; // accountId as string
}

/**
 * Create a Square customer record for a sub-account.
 */
export async function createSquareCustomer(
  params: CreateCustomerParams
): Promise<string> {
  const client = getSquareClient();

  const response = await client.customers.create({
    idempotencyKey: crypto.randomUUID(),
    emailAddress: params.email,
    companyName: params.companyName,
    referenceId: params.referenceId,
  });

  const customer = response.customer;
  if (!customer || !customer.id) {
    throw new Error("[Square] Failed to create customer");
  }

  return customer.id;
}

// ─────────────────────────────────────────────
// PAYMENTS
// ─────────────────────────────────────────────

/**
 * Retrieve a payment by ID.
 */
export async function getPayment(paymentId: string) {
  const client = getSquareClient();
  const response = await client.payments.get({ paymentId });
  return response.payment;
}

/**
 * Retrieve an order by ID (used to check payment link order status).
 */
export async function getOrder(orderId: string) {
  const client = getSquareClient();
  const response = await client.orders.get({
    orderId,
  });
  return response.order;
}

// ─────────────────────────────────────────────
// WEBHOOK VERIFICATION
// ─────────────────────────────────────────────

/**
 * Verify a Square webhook signature.
 * Returns true if the signature is valid.
 */
export function verifyWebhookSignature(
  body: string,
  signature: string,
  notificationUrl: string
): boolean {
  if (!ENV.squareWebhookSignatureKey) {
    console.warn("[Square] No webhook signature key configured — skipping verification");
    return true; // Allow in dev if not configured
  }

  const hmac = crypto.createHmac("sha256", ENV.squareWebhookSignatureKey);
  hmac.update(notificationUrl + body);
  const expectedSignature = hmac.digest("base64");

  return signature === expectedSignature;
}

// ─────────────────────────────────────────────
// LOCATION INFO
// ─────────────────────────────────────────────

/**
 * List locations to verify the access token works.
 */
export async function listLocations() {
  const client = getSquareClient();
  const response = await client.locations.list();
  return response.locations ?? [];
}
