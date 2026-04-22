/**
 * Drip Engine — processes due sequence enrollments, sends messages, advances steps.
 * Called periodically by the drip worker (every 60 seconds).
 *
 * Flow:
 * 1. getDueEnrollments() finds enrollments where nextStepAt <= NOW()
 * 2. For each: interpolate content, create a message record (timeline), enqueue for dispatch
 * 3. Advance the enrollment to the next step or mark completed
 *
 * Per-account email warming: groups enrollments by accountId,
 * applies daily send limits with gradual ramp-up, and skips emails that
 * exceed the current warming limit.
 */
import {
  getDueEnrollments,
  advanceEnrollment,
  getContactById,
  createMessage,
  listSequenceSteps,
  getOrCreateWarmingConfig,
  resetDailySendCount,
  updateCurrentDailyLimit,
  incrementDailySendCount,
} from "../db";
import { logContactActivity } from "../db";
import { enqueueMessage } from "./messageQueue";

/** Simple merge-tag interpolation: replaces {{fieldName}} with contact values */
function interpolate(template: string, contact: Record<string, unknown>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => {
    const val = contact[key as keyof typeof contact];
    return val != null ? String(val) : "";
  });
}

export interface DripResult {
  processed: number;
  sent: number;
  failed: number;
  completed: number;
  skippedWarming: number;
  errors: Array<{ enrollmentId: number; error: string }>;
}

/**
 * Process all due enrollments — evaluate, send messages, advance steps.
 * Groups enrollments by accountId and applies per-account email warming limits.
 * Returns a summary of what happened.
 */
export async function processNextSteps(batchSize: number = 100): Promise<DripResult> {
  const result: DripResult = { processed: 0, sent: 0, failed: 0, completed: 0, skippedWarming: 0, errors: [] };

  const dueRows = await getDueEnrollments(batchSize);
  console.log(`[DripEngine] tick, candidates: ${dueRows.length}`);
  if (dueRows.length === 0) return result;

  // Group due enrollments by accountId for per-account warming
  const byAccount = new Map<number, typeof dueRows>();
  for (const row of dueRows) {
    const aid = row.enrollment.accountId;
    if (!byAccount.has(aid)) byAccount.set(aid, []);
    byAccount.get(aid)!.push(row);
  }

  // Process each account with its own warming config
  for (const [accountId, rows] of Array.from(byAccount)) {
    // Get or create warming config for this account
    const warmingConfig = await getOrCreateWarmingConfig(accountId);

    // Reset daily counter if it's a new day
    const today = new Date().toISOString().split("T")[0];
    if (String(warmingConfig.lastResetDate ?? "") !== today) {
      await resetDailySendCount(warmingConfig.id, today);
      // Recalculate currentDailyLimit based on days since warming started
      const daysSinceStart = Math.floor(
        (Date.now() - warmingConfig.warmingStartDate.getTime()) / 86400000
      );
      const newLimit = Math.min(
        warmingConfig.startDailyLimit + daysSinceStart * warmingConfig.rampUpPerDay,
        warmingConfig.maxDailyLimit
      );
      await updateCurrentDailyLimit(warmingConfig.id, newLimit);
      warmingConfig.currentDailyLimit = newLimit;
      warmingConfig.todaySendCount = 0;
    }

    for (const row of rows) {
      result.processed++;
      const { enrollment, step, sequence } = row;

      try {
        // Fetch the contact
        const contact = await getContactById(enrollment.contactId, enrollment.accountId);
        if (!contact) {
          result.errors.push({ enrollmentId: enrollment.id, error: "Contact not found" });
          result.failed++;
          continue;
        }

        // Interpolate content
        const body = interpolate(step.content, contact as Record<string, unknown>);
        const subject = step.subject
          ? interpolate(step.subject, contact as Record<string, unknown>)
          : undefined;

        if (step.messageType === "sms") {
          if (!contact.phone) {
            result.errors.push({ enrollmentId: enrollment.id, error: "Contact has no phone" });
            result.failed++;
            continue;
          }

          console.log(`[DripEngine] Processing enrollment=${enrollment.id} contact=${enrollment.contactId} step=${step.position} type=sms to=${contact.phone}`);

          // 1. Create message record for contact timeline
          await createMessage({
            accountId: enrollment.accountId,
            contactId: enrollment.contactId,
            userId: 0,
            type: "sms",
            direction: "outbound",
            status: "pending",
            body,
            toAddress: contact.phone,
            sequenceStepId: step.id,
            sequenceStepPosition: step.position,
          });
          console.log(`[DripEngine] Message record created for enrollment=${enrollment.id}`);

          // 2. Enqueue for actual dispatch via message queue worker (handles billing, DND, retries)
          await enqueueMessage({
            accountId: enrollment.accountId,
            contactId: enrollment.contactId,
            type: "sms",
            payload: {
              to: contact.phone,
              body,
              contactId: enrollment.contactId,
            },
            source: "sequence_drip",
          });
          console.log(`[DripEngine] SMS enqueued for enrollment=${enrollment.id} contact=${enrollment.contactId}`);
        } else if (step.messageType === "email") {
          // Check warming limit before sending email
          if (warmingConfig.enabled) {
            if (warmingConfig.todaySendCount >= warmingConfig.currentDailyLimit) {
              // Skip this enrollment — will be retried next cycle
              result.errors.push({
                enrollmentId: enrollment.id,
                error: `Daily email limit reached (${warmingConfig.currentDailyLimit}). Will retry tomorrow.`,
              });
              result.skippedWarming++;
              continue;
            }
          }

          if (!contact.email) {
            result.errors.push({ enrollmentId: enrollment.id, error: "Contact has no email" });
            result.failed++;
            continue;
          }

          console.log(`[DripEngine] Processing enrollment=${enrollment.id} contact=${enrollment.contactId} step=${step.position} type=email to=${contact.email}`);

          // 1. Create message record for contact timeline
          await createMessage({
            accountId: enrollment.accountId,
            contactId: enrollment.contactId,
            userId: 0,
            type: "email",
            direction: "outbound",
            status: "pending",
            body,
            subject: subject || "(No subject)",
            toAddress: contact.email,
            sequenceStepId: step.id,
            sequenceStepPosition: step.position,
          });
          console.log(`[DripEngine] Email message record created for enrollment=${enrollment.id}`);

          // 2. Enqueue for actual dispatch via message queue worker (handles billing, retries)
          await enqueueMessage({
            accountId: enrollment.accountId,
            contactId: enrollment.contactId,
            type: "email",
            payload: {
              to: contact.email,
              subject: subject || "(No subject)",
              body,
            },
            source: "sequence_drip",
          });

          // Increment warming counter after successful email enqueue
          warmingConfig.todaySendCount++;
          await incrementDailySendCount(warmingConfig.id);
        }

        result.sent++;

        // Log activity
        await logContactActivity({
          contactId: enrollment.contactId,
          accountId: enrollment.accountId,
          activityType: "automation_triggered",
          description: `Sequence "${sequence.name}" — Step ${step.position}: ${step.messageType.toUpperCase()} queued for delivery`,
          metadata: JSON.stringify({
            sequenceId: sequence.id,
            sequenceName: sequence.name,
            stepId: step.id,
            stepPosition: step.position,
            messageType: step.messageType,
          }),
        });

        // Get total steps to determine if sequence is complete
        const allSteps = await listSequenceSteps(sequence.id);
        const totalSteps = allSteps.length;

        // Advance the enrollment
        await advanceEnrollment(enrollment.id, step.position, totalSteps);

        if (step.position >= totalSteps) {
          result.completed++;
        }
      } catch (err: any) {
        result.errors.push({ enrollmentId: enrollment.id, error: err.message || "Unknown error" });
        result.failed++;
      }
    }
  }

  return result;
}

/**
 * Compute the nextStepAt timestamp for a newly enrolled contact.
 * Based on the first step's delay settings.
 */
export function computeFirstStepAt(firstStepDelayDays: number, firstStepDelayHours: number): Date {
  const delayMs = firstStepDelayDays * 86400000 + firstStepDelayHours * 3600000;
  return new Date(Date.now() + (delayMs || 60000)); // Default 1 minute if no delay
}

// ─────────────────────────────────────────────
// Drip Worker — periodic runner
// ─────────────────────────────────────────────

const DRIP_INTERVAL_MS = 60_000; // 60 seconds
let dripTimer: ReturnType<typeof setInterval> | null = null;

async function runDripCycle(): Promise<void> {
  try {
    const result = await processNextSteps(100);
    if (result.processed > 0) {
      console.log(
        `[DripEngine] Cycle complete: processed=${result.processed} sent=${result.sent} ` +
        `failed=${result.failed} completed=${result.completed} skippedWarming=${result.skippedWarming}`
      );
      if (result.errors.length > 0) {
        for (const err of result.errors.slice(0, 5)) {
          console.warn(`[DripEngine]   enrollment=${err.enrollmentId}: ${err.error}`);
        }
      }
    }
  } catch (err: any) {
    console.error("[DripEngine] Cycle error:", err.message || err);
  }
}

export function startDripWorker(): void {
  if (dripTimer) {
    clearInterval(dripTimer);
  }
  dripTimer = setInterval(runDripCycle, DRIP_INTERVAL_MS);
  // Run immediately on startup
  runDripCycle();
  console.log(`[DripEngine] Worker started (interval: ${DRIP_INTERVAL_MS / 1000}s)`);
}

export function stopDripWorker(): void {
  if (dripTimer) {
    clearInterval(dripTimer);
    dripTimer = null;
    console.log("[DripEngine] Worker stopped");
  }
}
