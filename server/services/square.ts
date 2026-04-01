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
      // All Square credentials are production
      environment: SquareEnvironment.Production,
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
// CARD ON FILE
// ─────────────────────────────────────────────

interface SaveCardOnFileParams {
  customerId: string;
  sourceId: string; // nonce from Web Payments SDK
  cardholderName?: string;
}

export interface SavedCard {
  cardId: string;
  brand: string;
  last4: string;
  expMonth: number;
  expYear: number;
  cardholderName?: string;
}

/**
 * Save a card on file for a Square customer.
 * The sourceId is the nonce obtained from the Square Web Payments SDK.
 */
export async function saveCardOnFile(
  params: SaveCardOnFileParams
): Promise<SavedCard> {
  const client = getSquareClient();

  const response = await client.cards.create({
    idempotencyKey: crypto.randomUUID(),
    sourceId: params.sourceId,
    card: {
      customerId: params.customerId,
      cardholderName: params.cardholderName,
    },
  });

  const card = response.card;
  if (!card || !card.id) {
    throw new Error("[Square] Failed to save card on file");
  }

  return {
    cardId: card.id,
    brand: card.cardBrand || "UNKNOWN",
    last4: card.last4 || "0000",
    expMonth: Number(card.expMonth) || 0,
    expYear: Number(card.expYear) || 0,
    cardholderName: card.cardholderName || undefined,
  };
}

interface ChargeCardParams {
  cardId: string;
  customerId: string;
  amountCents: number;
  referenceId: string;
  note?: string;
}

interface ChargeCardResult {
  paymentId: string;
  receiptUrl?: string;
}

/**
 * Charge a saved card on file.
 */
export async function chargeCard(
  params: ChargeCardParams
): Promise<ChargeCardResult> {
  const client = getSquareClient();

  const response = await client.payments.create({
    idempotencyKey: crypto.randomUUID(),
    sourceId: params.cardId,
    customerId: params.customerId,
    amountMoney: {
      amount: BigInt(params.amountCents),
      currency: "USD",
    },
    locationId: ENV.squareLocationId,
    referenceId: params.referenceId,
    note: params.note,
    autocomplete: true,
  });

  const payment = response.payment;
  if (!payment || !payment.id) {
    throw new Error("[Square] Payment failed — no payment returned");
  }

  return {
    paymentId: payment.id,
    receiptUrl: payment.receiptUrl || undefined,
  };
}

/**
 * Disable (remove) a saved card from Square.
 */
export async function removeCard(cardId: string): Promise<void> {
  const client = getSquareClient();
  await client.cards.disable({ cardId });
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
