import crypto from "crypto";
import { getDb } from "../db";
import { outboundWebhooks } from "../../drizzle/schema";
import { eq, and } from "drizzle-orm";

// ─── Types ────────────────────────────────────────────────────
export type WebhookEvent =
  | "contact_created"
  | "contact_updated"
  | "tag_added"
  | "pipeline_stage_changed"
  | "facebook_lead_received"
  | "inbound_message_received"
  | "appointment_booked"
  | "appointment_cancelled"
  | "call_completed"
  | "missed_call"
  | "form_submitted"
  | "review_received"
  | "workflow_completed";

export interface WebhookPayload {
  event: WebhookEvent;
  timestamp: string;
  accountId: number;
  data: Record<string, unknown>;
}

// ─── HMAC Signing ─────────────────────────────────────────────
/**
 * Compute HMAC-SHA256 hex digest of a JSON body using the webhook secret.
 * Recipients verify: hmac_sha256(secret, rawBody) === X-Webhook-Signature header.
 */
export function computeHmacSignature(secret: string, body: string): string {
  return crypto.createHmac("sha256", secret).update(body, "utf8").digest("hex");
}

// ─── Auto-disable threshold ───────────────────────────────────
const MAX_CONSECUTIVE_FAILURES = 10;

// ─── Dispatch to a single webhook ─────────────────────────────
async function deliverWebhook(
  webhook: { id: number; url: string; secret: string },
  payload: WebhookPayload
): Promise<boolean> {
  const body = JSON.stringify(payload);
  const signature = computeHmacSignature(webhook.secret, body);

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000); // 10s timeout

    const response = await fetch(webhook.url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Webhook-Signature": signature,
        "X-Webhook-Event": payload.event,
        "X-Webhook-Timestamp": payload.timestamp,
        "User-Agent": "ApexSystem-Webhooks/1.0",
      },
      body,
      signal: controller.signal,
    });

    clearTimeout(timeout);

    // Consider 2xx as success
    return response.ok;
  } catch (err) {
    console.error(`[WebhookDispatcher] Delivery failed for webhook ${webhook.id}:`, err);
    return false;
  }
}

// ─── Main dispatch function ───────────────────────────────────
/**
 * Dispatch an event to all active outbound webhooks for the given account
 * that are subscribed to this event type.
 *
 * Runs asynchronously (fire-and-forget) so it never blocks the caller.
 */
export async function dispatchWebhookEvent(
  accountId: number,
  event: WebhookEvent,
  data: Record<string, unknown>
): Promise<void> {
  try {
    const db = await getDb();
    if (!db) return;

    // Find all active webhooks for this account + event
    const webhooks = await db
      .select()
      .from(outboundWebhooks)
      .where(
        and(
          eq(outboundWebhooks.accountId, accountId),
          eq(outboundWebhooks.triggerEvent, event),
          eq(outboundWebhooks.isActive, true)
        )
      );

    if (webhooks.length === 0) return;

    const payload: WebhookPayload = {
      event,
      timestamp: new Date().toISOString(),
      accountId,
      data,
    };

    // Dispatch all webhooks concurrently (fire-and-forget per webhook)
    await Promise.allSettled(
      webhooks.map(async (wh) => {
        const success = await deliverWebhook(wh, payload);

        if (success) {
          // Reset fail count and update lastTriggeredAt
          await db
            .update(outboundWebhooks)
            .set({
              lastTriggeredAt: new Date(),
              failCount: 0,
            })
            .where(eq(outboundWebhooks.id, wh.id));
        } else {
          // Increment fail count
          const newFailCount = (wh.failCount || 0) + 1;
          const updates: Record<string, unknown> = { failCount: newFailCount };

          // Auto-disable after too many consecutive failures
          if (newFailCount >= MAX_CONSECUTIVE_FAILURES) {
            updates.isActive = false;
            console.warn(
              `[WebhookDispatcher] Auto-disabled webhook ${wh.id} after ${newFailCount} consecutive failures`
            );
          }

          await db
            .update(outboundWebhooks)
            .set(updates)
            .where(eq(outboundWebhooks.id, wh.id));
        }
      })
    );
  } catch (err) {
    // Never throw — webhook dispatch must not break the caller
    console.error("[WebhookDispatcher] Dispatch error:", err);
  }
}

// ─── Test / ping a webhook URL ────────────────────────────────
/**
 * Send a test ping to a webhook URL to verify connectivity.
 * Returns { success, statusCode, error? }.
 */
export async function testWebhook(
  url: string,
  secret: string
): Promise<{ success: boolean; statusCode?: number; error?: string }> {
  const payload: WebhookPayload = {
    event: "contact_created",
    timestamp: new Date().toISOString(),
    accountId: 0,
    data: {
      _test: true,
      message: "This is a test webhook from Apex System. If you received this, your webhook is configured correctly.",
    },
  };

  const body = JSON.stringify(payload);
  const signature = computeHmacSignature(secret, body);

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000);

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Webhook-Signature": signature,
        "X-Webhook-Event": "contact_created",
        "X-Webhook-Timestamp": payload.timestamp,
        "User-Agent": "ApexSystem-Webhooks/1.0",
      },
      body,
      signal: controller.signal,
    });

    clearTimeout(timeout);

    return {
      success: response.ok,
      statusCode: response.status,
    };
  } catch (err: any) {
    return {
      success: false,
      error: err.name === "AbortError" ? "Request timed out (10s)" : err.message,
    };
  }
}

// ─── Generate a cryptographically secure signing secret ───────
export function generateWebhookSecret(): string {
  return crypto.randomBytes(32).toString("hex");
}
