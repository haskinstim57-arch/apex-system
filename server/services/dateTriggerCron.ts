import { getDb } from "../db";
import { workflows, contacts } from "../../drizzle/schema";
import { eq, and, sql, gte, lte } from "drizzle-orm";
import { onDateTriggerCheck } from "./workflowTriggers";

// ─────────────────────────────────────────────
// Date Trigger Cron Job
// Runs once per day, scans all active date_trigger workflows,
// evaluates contacts against their date conditions, and fires
// matching workflows.
// ─────────────────────────────────────────────

const CRON_INTERVAL_MS = 60 * 60 * 1000; // 1 hour (checks hourly, but only processes once per day)
let cronTimer: ReturnType<typeof setInterval> | null = null;
let lastRunDate: string | null = null; // Track last run date to avoid duplicate runs

/**
 * Evaluate a date condition against a contact's field value.
 * Returns true if the contact matches the trigger condition.
 */
export function evaluateDateCondition(
  fieldValue: Date | null | undefined,
  operator: string,
  value?: string
): boolean {
  if (!fieldValue) return false;

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const fieldDate = new Date(fieldValue.getFullYear(), fieldValue.getMonth(), fieldValue.getDate());

  switch (operator) {
    case "is_today": {
      return fieldDate.getTime() === today.getTime();
    }
    case "days_before": {
      // Contact's date is X days from now (upcoming)
      const days = parseInt(value || "0", 10);
      if (isNaN(days) || days <= 0) return false;
      const targetDate = new Date(today);
      targetDate.setDate(targetDate.getDate() + days);
      return fieldDate.getTime() === targetDate.getTime();
    }
    case "days_after": {
      // Contact's date was X days ago
      const days = parseInt(value || "0", 10);
      if (isNaN(days) || days <= 0) return false;
      const targetDate = new Date(today);
      targetDate.setDate(targetDate.getDate() - days);
      return fieldDate.getTime() === targetDate.getTime();
    }
    default:
      return false;
  }
}

/**
 * Process all active date_trigger workflows across all accounts.
 * For each workflow, scan contacts in the account and fire the trigger
 * for any contacts whose date field matches the condition.
 */
export async function processDateTriggers(): Promise<{
  workflowsChecked: number;
  triggersFired: number;
}> {
  const db = await getDb();
  if (!db) return { workflowsChecked: 0, triggersFired: 0 };

  let workflowsChecked = 0;
  let triggersFired = 0;

  try {
    // Get all active date_trigger workflows
    const dateTriggerWorkflows = await db
      .select()
      .from(workflows)
      .where(
        and(
          eq(workflows.triggerType, "date_trigger" as any),
          eq(workflows.isActive, true)
        )
      );

    workflowsChecked = dateTriggerWorkflows.length;

    for (const wf of dateTriggerWorkflows) {
      try {
        const config = wf.triggerConfig ? JSON.parse(wf.triggerConfig) : {};
        const { field, operator, value } = config;

        if (!field || !operator) {
          console.warn(
            `[DateTriggerCron] Workflow ${wf.id} has incomplete triggerConfig, skipping`
          );
          continue;
        }

        // Validate that the field is a known date field on contacts
        const validFields = ["createdAt", "updatedAt", "dateOfBirth"];
        if (!validFields.includes(field)) {
          console.warn(
            `[DateTriggerCron] Workflow ${wf.id} has unknown field "${field}", skipping`
          );
          continue;
        }

        // Get all contacts for this account
        const accountContacts = await db
          .select({
            id: contacts.id,
            createdAt: contacts.createdAt,
            updatedAt: contacts.updatedAt,
            dateOfBirth: contacts.dateOfBirth,
          })
          .from(contacts)
          .where(eq(contacts.accountId, wf.accountId));

        for (const contact of accountContacts) {
          const fieldValue = contact[field as keyof typeof contact] as Date | null;
          if (evaluateDateCondition(fieldValue, operator, value)) {
            await onDateTriggerCheck(wf.accountId, contact.id, field);
            triggersFired++;
          }
        }
      } catch (err) {
        console.error(
          `[DateTriggerCron] Error processing workflow ${wf.id}:`,
          err
        );
      }
    }

    if (workflowsChecked > 0) {
      console.log(
        `[DateTriggerCron] Processed ${workflowsChecked} workflow(s), fired ${triggersFired} trigger(s)`
      );
    }
  } catch (err) {
    console.error("[DateTriggerCron] Fatal error:", err);
  }

  return { workflowsChecked, triggersFired };
}

/** Start the date trigger cron job (runs hourly, processes once per day) */
export function startDateTriggerCron() {
  if (cronTimer) return;
  console.log("[DateTriggerCron] Starting daily date trigger scanner");

  cronTimer = setInterval(async () => {
    const todayStr = new Date().toISOString().split("T")[0];
    if (lastRunDate === todayStr) return; // Already ran today

    try {
      lastRunDate = todayStr;
      await processDateTriggers();
    } catch (err) {
      console.error("[DateTriggerCron] Cron error:", err);
      lastRunDate = null; // Allow retry on error
    }
  }, CRON_INTERVAL_MS);

  // Run once on startup if we haven't run today
  const todayStr = new Date().toISOString().split("T")[0];
  if (lastRunDate !== todayStr) {
    lastRunDate = todayStr;
    processDateTriggers().catch((err) => {
      console.error("[DateTriggerCron] Initial run error:", err);
      lastRunDate = null;
    });
  }
}

/** Stop the date trigger cron job */
export function stopDateTriggerCron() {
  if (cronTimer) {
    clearInterval(cronTimer);
    cronTimer = null;
    console.log("[DateTriggerCron] Stopped date trigger scanner");
  }
}
