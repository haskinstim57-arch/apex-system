/**
 * Drip Engine — processes due sequence enrollments, sends messages, advances steps.
 * Called periodically by a cron/interval job.
 */
import {
  getDueEnrollments,
  advanceEnrollment,
  getContactById,
  createMessage,
  listSequenceSteps,
} from "../db";
import { logContactActivity } from "../db";

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
  errors: Array<{ enrollmentId: number; error: string }>;
}

/**
 * Process all due enrollments — evaluate, send messages, advance steps.
 * Returns a summary of what happened.
 */
export async function processNextSteps(batchSize: number = 100): Promise<DripResult> {
  const result: DripResult = { processed: 0, sent: 0, failed: 0, completed: 0, errors: [] };

  const dueRows = await getDueEnrollments(batchSize);
  if (dueRows.length === 0) return result;

  for (const row of dueRows) {
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
      const subject = step.subject ? interpolate(step.subject, contact as Record<string, unknown>) : undefined;

      if (step.messageType === "sms") {
        if (!contact.phone) {
          result.errors.push({ enrollmentId: enrollment.id, error: "Contact has no phone" });
          result.failed++;
          continue;
        }
        await createMessage({
          accountId: enrollment.accountId,
          contactId: enrollment.contactId,
          userId: 0,
          type: "sms",
          direction: "outbound",
          status: "pending",
          body,
          toAddress: contact.phone,
        });
      } else if (step.messageType === "email") {
        if (!contact.email) {
          result.errors.push({ enrollmentId: enrollment.id, error: "Contact has no email" });
          result.failed++;
          continue;
        }
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
        });
      }

      result.sent++;

      // Log activity
      await logContactActivity({
        contactId: enrollment.contactId,
        accountId: enrollment.accountId,
        activityType: "automation_triggered",
        description: `Sequence "${sequence.name}" — Step ${step.position}: ${step.messageType.toUpperCase()} sent`,
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

  return result;
}

/**
 * Compute the nextStepAt timestamp for a newly enrolled contact.
 * Based on the first step's delay settings.
 */
export function computeFirstStepAt(firstStepDelayDays: number, firstStepDelayHours: number): Date {
  const delayMs = (firstStepDelayDays * 86400000) + (firstStepDelayHours * 3600000);
  return new Date(Date.now() + (delayMs || 60000)); // Default 1 minute if no delay
}
