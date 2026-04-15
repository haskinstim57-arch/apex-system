/**
 * Sequence Auto-Stop Service
 *
 * Automatically unenrolls contacts from nurture sequences when they engage:
 *   1. Inbound SMS reply
 *   2. Inbound email reply
 *   3. Appointment booked
 *   4. Call answered/completed (AI or manual)
 *   5. Pipeline stage change
 *
 * Each trigger calls `unenrollContactOnEngagement()` which finds all active
 * enrollments for the contact and unenrolls them, logging the reason.
 *
 * This is wired into the existing workflow trigger hooks so it fires
 * automatically without modifying the webhook handlers.
 */

import { getDb, unenrollContact } from "../db";
import { sequenceEnrollments, sequences, systemEvents } from "../../drizzle/schema";
import { and, eq } from "drizzle-orm";

export type EngagementReason =
  | "inbound_sms"
  | "inbound_email"
  | "appointment_booked"
  | "call_completed"
  | "pipeline_stage_changed";

/**
 * Unenroll a contact from ALL active nurture sequences when they engage.
 * Returns the number of enrollments that were stopped.
 */
export async function unenrollContactOnEngagement(
  contactId: number,
  accountId: number,
  reason: EngagementReason,
  metadata?: Record<string, any>
): Promise<number> {
  const db = await getDb();
  if (!db) return 0;

  try {
    // Find all active enrollments for this contact in this account
    const activeEnrollments = await db
      .select({
        id: sequenceEnrollments.id,
        sequenceId: sequenceEnrollments.sequenceId,
        sequenceName: sequences.name,
        currentStep: sequenceEnrollments.currentStep,
        enrolledAt: sequenceEnrollments.enrolledAt,
      })
      .from(sequenceEnrollments)
      .innerJoin(sequences, eq(sequenceEnrollments.sequenceId, sequences.id))
      .where(
        and(
          eq(sequenceEnrollments.contactId, contactId),
          eq(sequenceEnrollments.accountId, accountId),
          eq(sequenceEnrollments.status, "active")
        )
      );

    if (activeEnrollments.length === 0) {
      return 0;
    }

    // Unenroll from each sequence
    let unenrolledCount = 0;
    for (const enrollment of activeEnrollments) {
      try {
        await unenrollContact(enrollment.id, accountId);
        unenrolledCount++;

        console.log(
          `[SequenceAutoStop] Unenrolled contact ${contactId} from "${enrollment.sequenceName}" ` +
          `(enrollment ${enrollment.id}, step ${enrollment.currentStep}) — reason: ${reason}`
        );
      } catch (err: any) {
        console.error(
          `[SequenceAutoStop] Failed to unenroll enrollment ${enrollment.id}:`,
          err.message
        );
      }
    }

    // Log to system_events for Jarvis
    if (unenrolledCount > 0) {
      try {
        await db.insert(systemEvents).values({
          accountId,
          eventType: "sequence_auto_stop",
          severity: "info",
          title: `Auto-stopped ${unenrolledCount} sequence(s) for contact ${contactId}`,
          details: JSON.stringify({
            contactId,
            reason,
            unenrolledCount,
            sequences: activeEnrollments.map((e) => ({
              enrollmentId: e.id,
              sequenceId: e.sequenceId,
              sequenceName: e.sequenceName,
              stoppedAtStep: e.currentStep,
            })),
            metadata,
          }),
        });
      } catch (e: any) {
        console.error("[SequenceAutoStop] Failed to log system event:", e.message);
      }
    }

    return unenrolledCount;
  } catch (err: any) {
    console.error(`[SequenceAutoStop] Error for contact ${contactId}:`, err);
    return 0;
  }
}

/**
 * Hook: Called when an inbound SMS is received for a contact.
 */
export async function onInboundSmsAutoStop(accountId: number, contactId: number): Promise<void> {
  const count = await unenrollContactOnEngagement(contactId, accountId, "inbound_sms");
  if (count > 0) {
    console.log(`[SequenceAutoStop] Inbound SMS → stopped ${count} sequence(s) for contact ${contactId}`);
  }
}

/**
 * Hook: Called when an inbound email is received for a contact.
 */
export async function onInboundEmailAutoStop(accountId: number, contactId: number): Promise<void> {
  const count = await unenrollContactOnEngagement(contactId, accountId, "inbound_email");
  if (count > 0) {
    console.log(`[SequenceAutoStop] Inbound email → stopped ${count} sequence(s) for contact ${contactId}`);
  }
}

/**
 * Hook: Called when an appointment is booked for a contact.
 */
export async function onAppointmentBookedAutoStop(
  accountId: number,
  contactId: number,
  appointmentId?: number
): Promise<void> {
  const count = await unenrollContactOnEngagement(contactId, accountId, "appointment_booked", {
    appointmentId,
  });
  if (count > 0) {
    console.log(`[SequenceAutoStop] Appointment booked → stopped ${count} sequence(s) for contact ${contactId}`);
  }
}

/**
 * Hook: Called when a call is completed (AI or manual) for a contact.
 */
export async function onCallCompletedAutoStop(
  accountId: number,
  contactId: number,
  callId?: number
): Promise<void> {
  const count = await unenrollContactOnEngagement(contactId, accountId, "call_completed", {
    callId,
  });
  if (count > 0) {
    console.log(`[SequenceAutoStop] Call completed → stopped ${count} sequence(s) for contact ${contactId}`);
  }
}

/**
 * Hook: Called when a contact's pipeline stage changes.
 */
export async function onPipelineStageChangedAutoStop(
  accountId: number,
  contactId: number,
  fromStage?: string,
  toStage?: string
): Promise<void> {
  const count = await unenrollContactOnEngagement(contactId, accountId, "pipeline_stage_changed", {
    fromStage,
    toStage,
  });
  if (count > 0) {
    console.log(`[SequenceAutoStop] Pipeline stage changed → stopped ${count} sequence(s) for contact ${contactId}`);
  }
}
