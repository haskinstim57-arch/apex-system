/**
 * Lead Routing Engine
 *
 * Determines which user a new lead should be assigned to based on
 * the account's active routing rules. Supports three strategies:
 *
 * - round_robin: Cycles through assignees in order
 * - capacity_based: Assigns to the user with the fewest current leads
 * - specific_user: Always assigns to a single specified user
 *
 * Rules are evaluated in priority order. The first matching rule wins.
 * Conditions can filter by lead source, tags, etc.
 */

import {
  getActiveRoutingRules,
  incrementRoundRobinIndex,
  getAssignedContactCount,
  assignContact,
  logContactActivity,
} from "../db";

export type LeadSource = "csv_import" | "facebook_lead" | "manual_create";

interface LeadContext {
  contactId: number;
  accountId: number;
  leadSource?: string | null;
  tags?: string[];
  source: LeadSource;
}

interface RoutingResult {
  assigned: boolean;
  assignedUserId: number | null;
  ruleName: string | null;
  strategy: string | null;
}

/**
 * Route a single lead to the appropriate user based on active routing rules.
 * Returns the routing result with assignment details.
 */
export async function routeLead(ctx: LeadContext): Promise<RoutingResult> {
  try {
    const rules = await getActiveRoutingRules(ctx.accountId, ctx.source);

    if (rules.length === 0) {
      return { assigned: false, assignedUserId: null, ruleName: null, strategy: null };
    }

    for (const rule of rules) {
      // Check conditions
      if (!matchesConditions(rule, ctx)) {
        continue;
      }

      // Parse assignee IDs
      let assigneeIds: number[];
      try {
        assigneeIds = JSON.parse(rule.assigneeIds);
      } catch {
        console.error(`[LeadRouting] Invalid assigneeIds JSON for rule ${rule.id}`);
        continue;
      }

      if (!assigneeIds || assigneeIds.length === 0) {
        continue;
      }

      // Apply strategy
      let selectedUserId: number | null = null;

      switch (rule.strategy) {
        case "round_robin":
          selectedUserId = await applyRoundRobin(rule.id, assigneeIds, rule.roundRobinIndex);
          break;

        case "capacity_based":
          selectedUserId = await applyCapacityBased(
            ctx.accountId,
            assigneeIds,
            rule.maxLeadsPerUser
          );
          break;

        case "specific_user":
          selectedUserId = assigneeIds[0] || null;
          break;
      }

      if (selectedUserId) {
        // Assign the contact
        await assignContact(ctx.contactId, ctx.accountId, selectedUserId);

        // Log the routing activity
        logContactActivity({
          contactId: ctx.contactId,
          accountId: ctx.accountId,
          activityType: "lead_routed",
          description: `Auto-assigned to user ${selectedUserId} via "${rule.name}" (${rule.strategy})`,
          metadata: JSON.stringify({
            ruleId: rule.id,
            ruleName: rule.name,
            strategy: rule.strategy,
            assignedUserId: selectedUserId,
          }),
        });

        return {
          assigned: true,
          assignedUserId: selectedUserId,
          ruleName: rule.name,
          strategy: rule.strategy,
        };
      }
    }

    return { assigned: false, assignedUserId: null, ruleName: null, strategy: null };
  } catch (err) {
    console.error("[LeadRouting] Error routing lead:", err);
    return { assigned: false, assignedUserId: null, ruleName: null, strategy: null };
  }
}

/**
 * Route multiple leads (batch) — used after CSV import.
 * Returns summary of routing results.
 */
export async function routeLeadsBatch(
  leads: Array<{ contactId: number; tags?: string[]; leadSource?: string | null }>,
  accountId: number,
  source: LeadSource
): Promise<{
  totalRouted: number;
  totalUnrouted: number;
  routingDetails: Array<{ contactId: number; assignedUserId: number | null; ruleName: string | null }>;
}> {
  let totalRouted = 0;
  let totalUnrouted = 0;
  const routingDetails: Array<{
    contactId: number;
    assignedUserId: number | null;
    ruleName: string | null;
  }> = [];

  for (const lead of leads) {
    const result = await routeLead({
      contactId: lead.contactId,
      accountId,
      leadSource: lead.leadSource,
      tags: lead.tags,
      source,
    });

    if (result.assigned) {
      totalRouted++;
    } else {
      totalUnrouted++;
    }

    routingDetails.push({
      contactId: lead.contactId,
      assignedUserId: result.assignedUserId,
      ruleName: result.ruleName,
    });
  }

  return { totalRouted, totalUnrouted, routingDetails };
}

// ─── Strategy implementations ───

async function applyRoundRobin(
  ruleId: number,
  assigneeIds: number[],
  currentIndex: number
): Promise<number | null> {
  if (assigneeIds.length === 0) return null;

  const idx = currentIndex % assigneeIds.length;
  const selectedUserId = assigneeIds[idx];

  // Advance the index for next time
  const nextIndex = (idx + 1) % assigneeIds.length;
  await incrementRoundRobinIndex(ruleId, nextIndex);

  return selectedUserId;
}

async function applyCapacityBased(
  accountId: number,
  assigneeIds: number[],
  maxLeadsPerUser: number
): Promise<number | null> {
  // Get current counts for each assignee
  const counts: Array<{ userId: number; count: number }> = [];

  for (const userId of assigneeIds) {
    const count = await getAssignedContactCount(accountId, userId);
    counts.push({ userId, count });
  }

  // If max is set, filter out users at capacity
  let eligible = counts;
  if (maxLeadsPerUser > 0) {
    eligible = counts.filter((c) => c.count < maxLeadsPerUser);
  }

  if (eligible.length === 0) return null;

  // Pick the user with the fewest leads
  eligible.sort((a, b) => a.count - b.count);
  return eligible[0].userId;
}

// ─── Condition matching ───

function matchesConditions(
  rule: { conditions: string | null },
  ctx: LeadContext
): boolean {
  if (!rule.conditions) return true; // No conditions = always match

  let conditions: {
    leadSource?: string[];
    tags?: string[];
  };

  try {
    conditions = JSON.parse(rule.conditions);
  } catch {
    return true; // Invalid JSON = treat as no conditions
  }

  // Check lead source condition
  if (conditions.leadSource && conditions.leadSource.length > 0) {
    const normalizedLeadSource = (ctx.leadSource || "").toLowerCase();
    const matches = conditions.leadSource.some(
      (s) => s.toLowerCase() === normalizedLeadSource
    );
    if (!matches) return false;
  }

  // Check tags condition (at least one tag must match)
  if (conditions.tags && conditions.tags.length > 0) {
    if (!ctx.tags || ctx.tags.length === 0) return false;
    const normalizedCtxTags = ctx.tags.map((t) => t.toLowerCase());
    const matches = conditions.tags.some((t) =>
      normalizedCtxTags.includes(t.toLowerCase())
    );
    if (!matches) return false;
  }

  return true;
}
