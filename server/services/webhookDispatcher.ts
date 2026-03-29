import crypto from "crypto";
import { getDb } from "../db";
import { outboundWebhooks, webhookDeliveryLogs } from "../../drizzle/schema";
import type { WebhookCondition } from "../../drizzle/schema";
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
  | "workflow_completed"
  | "score_changed";

export interface WebhookPayload {
  event: WebhookEvent;
  timestamp: string;
  accountId: number;
  data: Record<string, unknown>;
}

// ─── HMAC Signing ─────────────────────────────────────────────
export function computeHmacSignature(secret: string, body: string): string {
  return crypto.createHmac("sha256", secret).update(body, "utf8").digest("hex");
}

// ─── Auto-disable threshold ───────────────────────────────────
const MAX_CONSECUTIVE_FAILURES = 10;

// ─── Condition Evaluation Engine ──────────────────────────────
/**
 * Evaluate a single condition against the event data.
 * Returns true if the condition passes.
 */
export function evaluateCondition(
  condition: WebhookCondition,
  data: Record<string, unknown>
): boolean {
  // Resolve nested field path (e.g. "contact.source" → data.contact.source)
  const fieldValue = resolveFieldValue(condition.field, data);
  const condValue = condition.value;

  switch (condition.operator) {
    case "equals":
      return String(fieldValue ?? "") === condValue;
    case "not_equals":
      return String(fieldValue ?? "") !== condValue;
    case "contains":
      if (Array.isArray(fieldValue)) {
        return fieldValue.some((v) => String(v) === condValue);
      }
      return String(fieldValue ?? "").toLowerCase().includes(condValue.toLowerCase());
    case "not_contains":
      if (Array.isArray(fieldValue)) {
        return !fieldValue.some((v) => String(v) === condValue);
      }
      return !String(fieldValue ?? "").toLowerCase().includes(condValue.toLowerCase());
    case "greater_than":
      return Number(fieldValue) > Number(condValue);
    case "less_than":
      return Number(fieldValue) < Number(condValue);
    case "in": {
      const allowedValues = condValue.split(",").map((v) => v.trim());
      return allowedValues.includes(String(fieldValue ?? ""));
    }
    case "not_in": {
      const disallowedValues = condValue.split(",").map((v) => v.trim());
      return !disallowedValues.includes(String(fieldValue ?? ""));
    }
    case "is_empty":
      return fieldValue === null || fieldValue === undefined || fieldValue === "" ||
        (Array.isArray(fieldValue) && fieldValue.length === 0);
    case "is_not_empty":
      return fieldValue !== null && fieldValue !== undefined && fieldValue !== "" &&
        !(Array.isArray(fieldValue) && fieldValue.length === 0);
    default:
      return true; // Unknown operator → pass
  }
}

/**
 * Resolve a dot-notation field path against a data object.
 * e.g. "contact.source" with data { contact: { source: "Facebook" } } → "Facebook"
 */
function resolveFieldValue(fieldPath: string, data: Record<string, unknown>): unknown {
  // Support custom fields via cf.slug_name prefix
  if (fieldPath.startsWith("cf.")) {
    const slug = fieldPath.slice(3);
    // Look for customFields in the data payload (contact data)
    const customFields = data.customFields
      ? (typeof data.customFields === "string" ? JSON.parse(data.customFields as string) : data.customFields)
      : {};
    return (customFields as Record<string, unknown>)[slug];
  }

  const parts = fieldPath.split(".");
  let current: unknown = data;
  for (const part of parts) {
    if (current === null || current === undefined || typeof current !== "object") return undefined;
    current = (current as Record<string, unknown>)[part];
  }

  // Fallback: if field not found in standard data, check customFields
  if (current === undefined && data.customFields) {
    const customFields = typeof data.customFields === "string"
      ? JSON.parse(data.customFields as string)
      : data.customFields;
    if (customFields && typeof customFields === "object") {
      const cfVal = (customFields as Record<string, unknown>)[fieldPath];
      if (cfVal !== undefined) return cfVal;
    }
  }

  return current;
}

/**
 * Evaluate all conditions (AND logic). Returns true if ALL conditions pass.
 * If no conditions are set, returns true (always dispatch).
 */
export function evaluateAllConditions(
  conditions: WebhookCondition[] | null | undefined,
  data: Record<string, unknown>
): boolean {
  if (!conditions || conditions.length === 0) return true;
  return conditions.every((cond) => evaluateCondition(cond, data));
}

// ─── Deliver to a single webhook with logging ────────────────
async function deliverWebhook(
  webhook: { id: number; url: string; secret: string; accountId: number },
  payload: WebhookPayload
): Promise<{ success: boolean; statusCode?: number; responseBody?: string; latencyMs: number; errorMessage?: string }> {
  const body = JSON.stringify(payload);
  const signature = computeHmacSignature(webhook.secret, body);
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "X-Webhook-Signature": signature,
    "X-Webhook-Event": payload.event,
    "X-Webhook-Timestamp": payload.timestamp,
    "User-Agent": "ApexSystem-Webhooks/1.0",
  };

  const startTime = Date.now();

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000);

    const response = await fetch(webhook.url, {
      method: "POST",
      headers,
      body,
      signal: controller.signal,
    });

    clearTimeout(timeout);
    const latencyMs = Date.now() - startTime;

    let responseBody = "";
    try {
      responseBody = await response.text();
      // Truncate to 2KB
      if (responseBody.length > 2048) responseBody = responseBody.slice(0, 2048) + "...(truncated)";
    } catch {
      // ignore
    }

    return {
      success: response.ok,
      statusCode: response.status,
      responseBody,
      latencyMs,
      errorMessage: response.ok ? undefined : `HTTP ${response.status}`,
    };
  } catch (err: any) {
    const latencyMs = Date.now() - startTime;
    const errorMessage = err.name === "AbortError" ? "Request timed out (10s)" : err.message;
    console.error(`[WebhookDispatcher] Delivery failed for webhook ${webhook.id}:`, errorMessage);
    return {
      success: false,
      latencyMs,
      errorMessage,
    };
  }
}

// ─── Log delivery attempt ────────────────────────────────────
async function logDelivery(
  db: NonNullable<Awaited<ReturnType<typeof getDb>>>,
  webhookId: number,
  accountId: number,
  event: string,
  requestUrl: string,
  requestHeaders: Record<string, string>,
  requestBody: Record<string, unknown>,
  result: { success: boolean; statusCode?: number; responseBody?: string; latencyMs: number; errorMessage?: string }
) {
  try {
    await db.insert(webhookDeliveryLogs).values({
      webhookId,
      accountId,
      event,
      requestUrl,
      requestHeaders,
      requestBody,
      responseStatus: result.statusCode ?? null,
      responseBody: result.responseBody ?? null,
      latencyMs: result.latencyMs,
      success: result.success,
      errorMessage: result.errorMessage ?? null,
    });
  } catch (err) {
    console.error("[WebhookDispatcher] Failed to log delivery:", err);
  }
}

// ─── Main dispatch function ───────────────────────────────────
export async function dispatchWebhookEvent(
  accountId: number,
  event: WebhookEvent,
  data: Record<string, unknown>
): Promise<void> {
  try {
    const db = await getDb();
    if (!db) return;

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

    await Promise.allSettled(
      webhooks.map(async (wh) => {
        // Evaluate conditions before dispatching
        if (!evaluateAllConditions(wh.conditions as WebhookCondition[] | null, data)) {
          return; // Conditions not met — skip this webhook
        }

        const result = await deliverWebhook(
          { id: wh.id, url: wh.url, secret: wh.secret, accountId: wh.accountId },
          payload
        );

        // Log the delivery attempt
        const headers = {
          "Content-Type": "application/json",
          "X-Webhook-Signature": "(redacted)",
          "X-Webhook-Event": payload.event,
          "X-Webhook-Timestamp": payload.timestamp,
          "User-Agent": "ApexSystem-Webhooks/1.0",
        };
        await logDelivery(db, wh.id, wh.accountId, event, wh.url, headers, payload as any, result);

        if (result.success) {
          await db
            .update(outboundWebhooks)
            .set({ lastTriggeredAt: new Date(), failCount: 0 })
            .where(eq(outboundWebhooks.id, wh.id));
        } else {
          const newFailCount = (wh.failCount || 0) + 1;
          const updates: Record<string, unknown> = { failCount: newFailCount };
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
    console.error("[WebhookDispatcher] Dispatch error:", err);
  }
}

// ─── Retry a specific delivery log ───────────────────────────
export async function retryDelivery(logId: number, accountId: number): Promise<{ success: boolean; statusCode?: number; error?: string }> {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");

  const [log] = await db
    .select()
    .from(webhookDeliveryLogs)
    .where(
      and(
        eq(webhookDeliveryLogs.id, logId),
        eq(webhookDeliveryLogs.accountId, accountId)
      )
    );
  if (!log) throw new Error("Delivery log not found");

  // Get the webhook to get the current secret
  const [webhook] = await db
    .select()
    .from(outboundWebhooks)
    .where(eq(outboundWebhooks.id, log.webhookId));
  if (!webhook) throw new Error("Webhook not found");

  const payload = log.requestBody as WebhookPayload;
  const result = await deliverWebhook(
    { id: webhook.id, url: webhook.url, secret: webhook.secret, accountId: webhook.accountId },
    payload
  );

  // Log the retry
  const headers = {
    "Content-Type": "application/json",
    "X-Webhook-Signature": "(redacted)",
    "X-Webhook-Event": payload.event,
    "X-Webhook-Timestamp": payload.timestamp,
    "User-Agent": "ApexSystem-Webhooks/1.0",
  };
  await logDelivery(db, webhook.id, webhook.accountId, log.event, webhook.url, headers, payload as any, result);

  return {
    success: result.success,
    statusCode: result.statusCode,
    error: result.errorMessage,
  };
}

// ─── Test / ping a webhook URL ────────────────────────────────
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
    return { success: response.ok, statusCode: response.status };
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
