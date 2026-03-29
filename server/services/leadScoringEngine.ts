import {
  getActiveLeadScoringRulesByEvent,
  getContactById,
  updateContactLeadScore,
  createLeadScoreHistoryEntry,
  logContactActivity,
} from "../db";
import type { LeadScoringCondition, LeadScoringRule } from "../../drizzle/schema";

// ─────────────────────────────────────────────
// Lead Scoring Engine
// Evaluates scoring rules when events occur and
// updates the contact's leadScore accordingly.
// ─────────────────────────────────────────────

export interface ScoringEventContext {
  /** The event that occurred */
  event: string;
  /** Contact ID */
  contactId: number;
  /** Account ID */
  accountId: number;
  /** Optional: tag that was added (for tag_added events) */
  tag?: string;
  /** Optional: new pipeline status (for pipeline_stage_changed events) */
  toStatus?: string;
  /** Optional: channel (for inbound_message_received events) */
  channel?: "sms" | "email";
}

/**
 * Process a scoring event: fetch matching rules, evaluate conditions,
 * apply score deltas, and log history.
 * Returns the new score.
 */
export async function processLeadScoringEvent(
  ctx: ScoringEventContext
): Promise<{ newScore: number; rulesApplied: number }> {
  try {
    const rules = await getActiveLeadScoringRulesByEvent(ctx.accountId, ctx.event);
    if (rules.length === 0) {
      return { newScore: -1, rulesApplied: 0 };
    }

    const contact = await getContactById(ctx.contactId, ctx.accountId);
    if (!contact) {
      console.warn(`[LeadScoring] Contact ${ctx.contactId} not found in account ${ctx.accountId}`);
      return { newScore: -1, rulesApplied: 0 };
    }

    let currentScore = contact.leadScore ?? 0;
    let rulesApplied = 0;

    for (const rule of rules) {
      const conditionMatch = evaluateRuleCondition(rule, ctx, contact);
      if (!conditionMatch) continue;

      const scoreBefore = currentScore;
      currentScore = Math.max(0, currentScore + rule.delta); // Floor at 0
      rulesApplied++;

      // Log the score change
      await createLeadScoreHistoryEntry({
        contactId: ctx.contactId,
        accountId: ctx.accountId,
        ruleId: rule.id,
        event: ctx.event,
        delta: rule.delta,
        scoreBefore,
        scoreAfter: currentScore,
        reason: `Rule "${rule.name}": ${rule.delta > 0 ? "+" : ""}${rule.delta} points`,
      });
    }

    if (rulesApplied > 0) {
      // Update the contact's score
      await updateContactLeadScore(ctx.contactId, ctx.accountId, currentScore);

      // Log activity
      logContactActivity({
        contactId: ctx.contactId,
        accountId: ctx.accountId,
        activityType: "lead_score_changed",
        description: `Lead score updated to ${currentScore} (${rulesApplied} rule${rulesApplied > 1 ? "s" : ""} applied)`,
        metadata: JSON.stringify({
          newScore: currentScore,
          rulesApplied,
          event: ctx.event,
        }),
      });

      // Fire the score_changed workflow trigger (async, non-blocking)
      import("./workflowTriggers").then(({ onLeadScoreChanged }) => {
        onLeadScoreChanged(ctx.accountId, ctx.contactId, currentScore).catch(
          (err: unknown) => console.error("[LeadScoring] onLeadScoreChanged trigger error:", err)
        );
      });

      console.log(
        `[LeadScoring] Contact ${ctx.contactId}: score ${contact.leadScore ?? 0} → ${currentScore} (${rulesApplied} rules, event: ${ctx.event})`
      );
    }

    return { newScore: currentScore, rulesApplied };
  } catch (err) {
    console.error("[LeadScoring] processLeadScoringEvent error:", err);
    return { newScore: -1, rulesApplied: 0 };
  }
}

/**
 * Manually adjust a contact's lead score (e.g., from the UI).
 */
export async function manuallyAdjustLeadScore(
  contactId: number,
  accountId: number,
  delta: number,
  reason?: string
): Promise<number> {
  const contact = await getContactById(contactId, accountId);
  if (!contact) throw new Error("Contact not found");

  const scoreBefore = contact.leadScore ?? 0;
  const newScore = Math.max(0, scoreBefore + delta);

  await updateContactLeadScore(contactId, accountId, newScore);

  await createLeadScoreHistoryEntry({
    contactId,
    accountId,
    ruleId: null,
    event: "manual_adjustment",
    delta,
    scoreBefore,
    scoreAfter: newScore,
    reason: reason || `Manual adjustment: ${delta > 0 ? "+" : ""}${delta} points`,
  });

  logContactActivity({
    contactId,
    accountId,
    activityType: "lead_score_changed",
    description: `Lead score manually adjusted to ${newScore} (${delta > 0 ? "+" : ""}${delta})`,
    metadata: JSON.stringify({ newScore, delta, reason }),
  });

  return newScore;
}

/**
 * Evaluate whether a rule's condition matches the current event context.
 */
function evaluateRuleCondition(
  rule: LeadScoringRule,
  ctx: ScoringEventContext,
  contact: Record<string, unknown>
): boolean {
  const condition = rule.condition as LeadScoringCondition | null;

  // No condition means the rule always fires for its event
  if (!condition || Object.keys(condition).length === 0) {
    return true;
  }

  // Check tag-specific condition (for tag_added events)
  if (condition.tag && ctx.tag) {
    if (condition.tag.toLowerCase() !== ctx.tag.toLowerCase()) {
      return false;
    }
  } else if (condition.tag && !ctx.tag) {
    return false;
  }

  // Check toStatus condition (for pipeline_stage_changed events)
  if (condition.toStatus && ctx.toStatus) {
    if (condition.toStatus.toLowerCase() !== ctx.toStatus.toLowerCase()) {
      return false;
    }
  } else if (condition.toStatus && !ctx.toStatus) {
    return false;
  }

  // Check channel condition (for inbound_message_received events)
  if (condition.channel && ctx.channel) {
    if (condition.channel !== ctx.channel) {
      return false;
    }
  } else if (condition.channel && !ctx.channel) {
    return false;
  }

  // Check field-based condition
  if (condition.field && condition.operator && condition.value !== undefined) {
    const fieldValue = String(contact[condition.field] ?? "");
    const compareValue = condition.value;

    switch (condition.operator) {
      case "equals":
        if (fieldValue.toLowerCase() !== compareValue.toLowerCase()) return false;
        break;
      case "not_equals":
        if (fieldValue.toLowerCase() === compareValue.toLowerCase()) return false;
        break;
      case "contains":
        if (!fieldValue.toLowerCase().includes(compareValue.toLowerCase())) return false;
        break;
      case "greater_than": {
        const a = parseFloat(fieldValue);
        const b = parseFloat(compareValue);
        if (isNaN(a) || isNaN(b) || a <= b) return false;
        break;
      }
      case "less_than": {
        const a = parseFloat(fieldValue);
        const b = parseFloat(compareValue);
        if (isNaN(a) || isNaN(b) || a >= b) return false;
        break;
      }
    }
  }

  return true;
}

/**
 * Get the score tier label and color for a given score.
 */
export function getScoreTier(score: number): {
  label: string;
  color: "cold" | "warm" | "hot" | "on_fire";
} {
  if (score >= 80) return { label: "On Fire", color: "on_fire" };
  if (score >= 50) return { label: "Hot", color: "hot" };
  if (score >= 20) return { label: "Warm", color: "warm" };
  return { label: "Cold", color: "cold" };
}
