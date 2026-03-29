/**
 * Message Queue Service
 *
 * Holds outbound messages (SMS, email, AI calls) sent outside business hours
 * and auto-dispatches them when the next business hours window opens.
 *
 * Architecture:
 * 1. enqueueMessage() — called when a dispatch is attempted outside business hours
 * 2. processQueue() — background worker that polls every 30s, checks business hours, dispatches
 * 3. Retry with exponential backoff — up to maxAttempts per message
 */

import {
  createQueuedMessage,
  listAllPendingQueuedMessages,
  updateQueuedMessage,
} from "../db";
import { isWithinAccountBusinessHours } from "../utils/businessHours";
import { dispatchSMS, dispatchEmail, type MessageSendResult } from "./messaging";

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

export interface QueuedSMSPayload {
  to: string;
  body: string;
  from?: string;
  contactId?: number;
  skipDndCheck?: boolean;
}

export interface QueuedEmailPayload {
  to: string;
  subject: string;
  body: string;
  from?: string;
  fromName?: string;
}

export interface QueuedAICallPayload {
  contactId: number;
  phoneNumber: string;
  customerName: string;
  assistantId: string;
  initiatedById: number;
  metadata?: Record<string, unknown>;
}

export type QueuePayload = QueuedSMSPayload | QueuedEmailPayload | QueuedAICallPayload;

// ─────────────────────────────────────────────
// Enqueue
// ─────────────────────────────────────────────

/**
 * Add a message to the queue for later dispatch when business hours resume.
 * Returns the queued message ID.
 */
export async function enqueueMessage(params: {
  accountId: number;
  contactId?: number | null;
  type: "sms" | "email" | "ai_call";
  payload: QueuePayload;
  source?: string;
  initiatedById?: number | null;
  maxAttempts?: number;
}): Promise<{ id: number; queued: true }> {
  const { id } = await createQueuedMessage({
    accountId: params.accountId,
    contactId: params.contactId,
    type: params.type,
    payload: JSON.stringify(params.payload),
    source: params.source ?? "business_hours_queue",
    initiatedById: params.initiatedById,
    maxAttempts: params.maxAttempts ?? 3,
  });

  console.log(
    `[MessageQueue] Enqueued ${params.type} for account ${params.accountId} (id=${id})`
  );

  return { id, queued: true };
}

// ─────────────────────────────────────────────
// Dispatch Logic
// ─────────────────────────────────────────────

/**
 * Attempt to dispatch a single queued message.
 * Returns success/failure result.
 */
async function dispatchQueuedMessage(
  msg: { id: number; accountId: number; type: string; payload: string; attempts: number; maxAttempts: number }
): Promise<{ success: boolean; error?: string }> {
  let payload: QueuePayload;
  try {
    payload = JSON.parse(msg.payload);
  } catch {
    return { success: false, error: "Invalid payload JSON" };
  }

  try {
    let result: MessageSendResult;

    switch (msg.type) {
      case "sms": {
        const smsPayload = payload as QueuedSMSPayload;
        result = await dispatchSMS({
          to: smsPayload.to,
          body: smsPayload.body,
          from: smsPayload.from,
          accountId: msg.accountId,
          contactId: smsPayload.contactId,
          skipDndCheck: smsPayload.skipDndCheck,
        });
        break;
      }
      case "email": {
        const emailPayload = payload as QueuedEmailPayload;
        result = await dispatchEmail({
          to: emailPayload.to,
          subject: emailPayload.subject,
          body: emailPayload.body,
          from: emailPayload.from,
          fromName: emailPayload.fromName,
          accountId: msg.accountId,
        });
        break;
      }
      case "ai_call": {
        // AI calls are dispatched through the VAPI service
        const callPayload = payload as QueuedAICallPayload;
        const { createVapiCall } = await import("./vapi");
        const { createAICall, updateAICall } = await import("../db");

        // Create the AI call record
        const { id: callId } = await createAICall({
          accountId: msg.accountId,
          contactId: callPayload.contactId,
          initiatedById: callPayload.initiatedById,
          phoneNumber: callPayload.phoneNumber,
          status: "queued",
          direction: "outbound",
          assistantId: callPayload.assistantId,
        });

        try {
          const vapiResponse = await createVapiCall({
            phoneNumber: callPayload.phoneNumber,
            customerName: callPayload.customerName,
            assistantId: callPayload.assistantId,
            metadata: {
              apexAccountId: msg.accountId,
              apexContactId: callPayload.contactId,
              apexCallId: callId,
              leadSource: (callPayload.metadata?.leadSource as string) ?? undefined,
            },
          });

          await updateAICall(callId, {
            externalCallId: vapiResponse.id,
            status: "calling",
          });

          return { success: true };
        } catch (err: any) {
          await updateAICall(callId, {
            status: "failed",
            errorMessage: err?.message || String(err),
          });
          return { success: false, error: err?.message || String(err) };
        }
      }
      default:
        return { success: false, error: `Unknown message type: ${msg.type}` };
    }

    return { success: result.success, error: result.error };
  } catch (err: any) {
    return { success: false, error: err?.message || String(err) };
  }
}

/**
 * Calculate exponential backoff delay for retry.
 * Base: 60 seconds, multiplied by 2^attempt (1min, 2min, 4min, ...)
 */
function getBackoffDelay(attempt: number): number {
  const baseMs = 60_000; // 1 minute
  return baseMs * Math.pow(2, attempt);
}

// ─────────────────────────────────────────────
// Background Worker
// ─────────────────────────────────────────────

const WORKER_INTERVAL_MS = 30_000; // 30 seconds
let workerTimer: ReturnType<typeof setInterval> | null = null;

/**
 * Process all pending queued messages.
 * For each message:
 *   1. Check if the account's business hours are now open
 *   2. If open, attempt dispatch
 *   3. On success, mark as dispatched
 *   4. On failure, increment attempts and schedule retry (or mark as failed if max reached)
 */
export async function processQueue(): Promise<{
  processed: number;
  dispatched: number;
  failed: number;
  skipped: number;
}> {
  const stats = { processed: 0, dispatched: 0, failed: 0, skipped: 0 };

  let pending;
  try {
    pending = await listAllPendingQueuedMessages(100);
  } catch (err) {
    console.error("[MessageQueue] Failed to fetch pending messages:", err);
    return stats;
  }

  if (pending.length === 0) return stats;

  // Group by accountId to batch business hours checks
  const byAccount = new Map<number, typeof pending>();
  for (const msg of pending) {
    const list = byAccount.get(msg.accountId) ?? [];
    list.push(msg);
    byAccount.set(msg.accountId, list);
  }

  // Check business hours per account (cache results)
  const accountBHOpen = new Map<number, boolean>();

  for (const [accountId, messages] of Array.from(byAccount.entries())) {
    // Check business hours for this account
    if (!accountBHOpen.has(accountId)) {
      try {
        const isOpen = await isWithinAccountBusinessHours(accountId);
        accountBHOpen.set(accountId, isOpen);
      } catch {
        accountBHOpen.set(accountId, false);
      }
    }

    const isOpen = accountBHOpen.get(accountId) ?? false;

    if (!isOpen) {
      // Business hours still closed — skip all messages for this account
      stats.skipped += messages.length;
      continue;
    }

    // Business hours are open — dispatch messages
    for (const msg of messages) {
      stats.processed++;
      const newAttempts = msg.attempts + 1;

      const result = await dispatchQueuedMessage(msg);

      if (result.success) {
        stats.dispatched++;
        await updateQueuedMessage(msg.id, {
          status: "dispatched",
          attempts: newAttempts,
          dispatchedAt: new Date(),
          lastError: null,
        });
        console.log(
          `[MessageQueue] Dispatched ${msg.type} id=${msg.id} for account ${msg.accountId}`
        );
      } else {
        if (newAttempts >= msg.maxAttempts) {
          stats.failed++;
          await updateQueuedMessage(msg.id, {
            status: "failed",
            attempts: newAttempts,
            lastError: result.error ?? "Unknown error",
          });
          console.warn(
            `[MessageQueue] Failed ${msg.type} id=${msg.id} after ${newAttempts} attempts: ${result.error}`
          );
        } else {
          // Schedule retry with exponential backoff
          const backoffMs = getBackoffDelay(newAttempts);
          const nextAttempt = new Date(Date.now() + backoffMs);
          await updateQueuedMessage(msg.id, {
            attempts: newAttempts,
            lastError: result.error ?? "Unknown error",
            nextAttemptAt: nextAttempt,
          });
          console.log(
            `[MessageQueue] Retry ${msg.type} id=${msg.id} (attempt ${newAttempts}/${msg.maxAttempts}) in ${backoffMs / 1000}s`
          );
        }
      }
    }
  }

  if (stats.processed > 0) {
    console.log(
      `[MessageQueue] Processed ${stats.processed}: ${stats.dispatched} dispatched, ${stats.failed} failed, ${stats.skipped} skipped (outside hours)`
    );
  }

  return stats;
}

/** Start the message queue background worker */
export function startMessageQueueWorker() {
  if (workerTimer) return;
  console.log("[MessageQueue] Starting background worker (30s interval)");
  workerTimer = setInterval(async () => {
    try {
      await processQueue();
    } catch (err) {
      console.error("[MessageQueue] Worker error:", err);
    }
  }, WORKER_INTERVAL_MS);

  // Run once immediately
  processQueue().catch((err) =>
    console.error("[MessageQueue] Initial run error:", err)
  );
}

/** Stop the message queue background worker */
export function stopMessageQueueWorker() {
  if (workerTimer) {
    clearInterval(workerTimer);
    workerTimer = null;
    console.log("[MessageQueue] Stopped background worker");
  }
}
