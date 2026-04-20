/**
 * Facebook Lead Polling Service — with Circuit Breaker & Lead Notifications
 *
 * Polls the Facebook Graph API every 60 seconds for new leads across all
 * connected Facebook pages. Serves as a reliable fallback to webhooks.
 *
 * Circuit Breaker: After 3 consecutive failures for a page (e.g., dead token),
 * polling is disabled for that page and multi-channel alerts are fired.
 * Automatically re-enables when the token is refreshed via reconnection.
 *
 * Lead Notifications: On every new lead, sends SMS (Blooio) + email (SendGrid)
 * to all active account members with contact info on file.
 *
 * Auto-Enrollment: Every new lead is auto-enrolled into the "Purchase Lead -
 * Didn't Book Nurture" sequence.
 */

import {
  createContact,
  getOrCreateDefaultPipeline,
  listPipelineStages,
  createDeal,
  createNotification,
  enrollContactInSequence,
  getDb,
} from "../db";
import { accountFacebookPages, systemEvents, sequences } from "../../drizzle/schema";
import { isNotNull, and, sql, eq } from "drizzle-orm";
import { normalizeToE164 } from "../../shared/phone";
import { routeLead } from "./leadRoutingEngine";
import { logRoutingEvent } from "./leadRoutingMonitor";
import { notifyLeadRecipients } from "./leadNotification";
import { notifyOwner } from "../_core/notification";
import { sendPushNotificationToAccount } from "./webPush";

const FACEBOOK_GRAPH_API = "https://graph.facebook.com/v19.0";
const POLL_INTERVAL_MS = 60_000; // 60 seconds
const LEAD_LOOKBACK_SECONDS = 86_400; // 24 hours

let pollTimer: ReturnType<typeof setInterval> | null = null;

// ─── Circuit Breaker State ───
const MAX_CONSECUTIVE_FAILURES = 3;
const pageFailureCounts = new Map<string, number>(); // pageId → consecutive failure count
const disabledPages = new Set<string>(); // pages with tripped circuit breaker

/**
 * Reset the circuit breaker for a specific page (call after token refresh/reconnection).
 */
export function resetPageCircuitBreaker(pageId: string) {
  const wasDisabled = disabledPages.has(pageId);
  pageFailureCounts.delete(pageId);
  disabledPages.delete(pageId);
  if (wasDisabled) {
    console.log(`[FacebookLeadPoller] Circuit breaker RESET for page ${pageId} — polling re-enabled`);
  }
}

/**
 * Start the Facebook lead polling background job.
 */
export function startFacebookLeadPoller() {
  console.log(
    `[FacebookLeadPoller] Starting background worker (${POLL_INTERVAL_MS / 1000}s interval)`
  );

  pollTimer = setInterval(async () => {
    try {
      await pollAllPages();
    } catch (err) {
      console.error("[FacebookLeadPoller] Worker error:", err);
    }
  }, POLL_INTERVAL_MS);

  // Run once on startup (delayed 15s to let DB connect)
  setTimeout(() => {
    pollAllPages().catch((err) =>
      console.error("[FacebookLeadPoller] Initial run error:", err)
    );
  }, 15_000);
}

/**
 * Stop the Facebook lead polling background job.
 */
export function stopFacebookLeadPoller() {
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
    console.log("[FacebookLeadPoller] Stopped background worker");
  }
}

/**
 * Poll all connected Facebook pages for new leads.
 */
export async function pollAllPages(): Promise<{
  pagesChecked: number;
  formsChecked: number;
  leadsFound: number;
  leadsCreated: number;
}> {
  const db = await getDb();
  if (!db) return { pagesChecked: 0, formsChecked: 0, leadsFound: 0, leadsCreated: 0 };

  const pages = await db
    .select()
    .from(accountFacebookPages)
    .where(
      and(
        isNotNull(accountFacebookPages.pageAccessToken),
        sql`${accountFacebookPages.pageAccessToken} != ''`
      )
    );

  if (pages.length === 0) {
    return { pagesChecked: 0, formsChecked: 0, leadsFound: 0, leadsCreated: 0 };
  }

  let totalFormsChecked = 0;
  let totalLeadsFound = 0;
  let totalLeadsCreated = 0;

  for (const page of pages) {
    // ─── Circuit Breaker Check ───
    if (disabledPages.has(page.facebookPageId)) {
      // Skip this page — circuit breaker is tripped
      continue;
    }

    try {
      const result = await pollPage(page);
      totalFormsChecked += result.formsChecked;
      totalLeadsFound += result.leadsFound;
      totalLeadsCreated += result.leadsCreated;

      // Success — reset failure counter
      if (pageFailureCounts.has(page.facebookPageId)) {
        pageFailureCounts.set(page.facebookPageId, 0);
      }
    } catch (err: any) {
      const failCount = (pageFailureCounts.get(page.facebookPageId) || 0) + 1;
      pageFailureCounts.set(page.facebookPageId, failCount);

      console.error(
        `[FacebookLeadPoller] Error polling page ${page.facebookPageId} (${page.pageName}) — failure ${failCount}/${MAX_CONSECUTIVE_FAILURES}:`,
        err?.message || err
      );

      // Check if this is a token error (error codes 190, 460, etc.)
      const isTokenError = err?.message?.includes("validating access token") ||
        err?.message?.includes("OAuthException") ||
        err?.message?.includes("Error code: 190") ||
        err?.errorSubcode === 460 ||
        err?.errorCode === 190;

      if (failCount >= MAX_CONSECUTIVE_FAILURES || isTokenError) {
        // ─── TRIP CIRCUIT BREAKER ───
        disabledPages.add(page.facebookPageId);
        console.error(
          `[FacebookLeadPoller] CIRCUIT BREAKER TRIPPED for page ${page.facebookPageId} (${page.pageName}) — polling DISABLED`
        );

        // Fire multi-channel alerts
        await fireTokenDeathAlerts(page, err?.message || "Unknown error").catch((alertErr) => {
          console.error("[FacebookLeadPoller] Alert dispatch error:", alertErr);
        });
      }
    }
  }

  if (totalLeadsCreated > 0) {
    console.log(
      `[FacebookLeadPoller] Polled ${pages.length} pages, ${totalFormsChecked} forms — found ${totalLeadsFound} leads, created ${totalLeadsCreated} new contacts`
    );
  }

  return {
    pagesChecked: pages.length,
    formsChecked: totalFormsChecked,
    leadsFound: totalLeadsFound,
    leadsCreated: totalLeadsCreated,
  };
}

/**
 * Fire multi-channel alerts when a token dies.
 */
async function fireTokenDeathAlerts(
  page: { accountId: number; facebookPageId: string; pageName: string | null },
  errorMessage: string
): Promise<void> {
  const alertTitle = `CRITICAL: Facebook lead ingestion STOPPED for ${page.pageName || page.facebookPageId}`;
  const alertBody = `The Facebook access token for page "${page.pageName}" is invalid or expired. ` +
    `Lead ingestion has been automatically paused to prevent further errors. ` +
    `Go to Settings → Integrations → Facebook → Disconnect & Reconnect to fix this. ` +
    `Error: ${errorMessage}`;

  const promises: Promise<any>[] = [];

  // 1. Notify platform owner
  promises.push(
    notifyOwner({ title: alertTitle, content: alertBody }).catch((e) =>
      console.error("[CircuitBreaker] notifyOwner failed:", e.message)
    )
  );

  // 2. In-app notification for the account
  promises.push(
    createNotification({
      accountId: page.accountId,
      type: "system_alert",
      title: alertTitle,
      body: alertBody,
      link: "/settings",
    }).catch((e) =>
      console.error("[CircuitBreaker] createNotification failed:", e.message)
    )
  );

  // 3. Push notification to account
  promises.push(
    sendPushNotificationToAccount(page.accountId, {
      title: "Facebook Lead Ingestion STOPPED",
      body: `Token expired for ${page.pageName}. Go to Settings to reconnect.`,
      url: "/settings",
      eventType: "system_alert",
    }).catch((e) =>
      console.error("[CircuitBreaker] push notification failed:", e.message)
    )
  );

  // 4. Log system event for Jarvis
  try {
    const db = await getDb();
    if (db) {
      await db.insert(systemEvents).values({
        accountId: page.accountId,
        eventType: "facebook_token_death",
        severity: "critical",
        title: alertTitle,
        details: JSON.stringify({
          pageId: page.facebookPageId,
          pageName: page.pageName,
          error: errorMessage,
          action: "Reconnect Facebook in Settings → Integrations",
        }),
      });
    }
  } catch (e: any) {
    console.error("[CircuitBreaker] system event log failed:", e.message);
  }

  await Promise.allSettled(promises);
  console.log(`[CircuitBreaker] All alerts dispatched for page ${page.facebookPageId}`);
}

/**
 * Poll a single Facebook page for new leads across all its forms.
 */
async function pollPage(page: {
  id: number;
  accountId: number;
  facebookPageId: string;
  pageName: string | null;
  pageAccessToken: string | null;
}): Promise<{ formsChecked: number; leadsFound: number; leadsCreated: number }> {
  if (!page.pageAccessToken) {
    return { formsChecked: 0, leadsFound: 0, leadsCreated: 0 };
  }

  // 1. Fetch all leadgen forms for this page
  const forms = await fetchPageForms(page.facebookPageId, page.pageAccessToken);
  if (forms.length === 0) {
    return { formsChecked: 0, leadsFound: 0, leadsCreated: 0 };
  }

  let totalLeadsFound = 0;
  let totalLeadsCreated = 0;

  // 2. For each form, fetch recent leads
  for (const form of forms) {
    try {
      const leads = await fetchFormLeads(form.id, page.pageAccessToken);
      totalLeadsFound += leads.length;

      // 3. Process each lead (with dedup)
      for (const lead of leads) {
        try {
          const created = await processPolledLead(lead, page);
          if (created) totalLeadsCreated++;
        } catch (err: any) {
          console.error(
            `[FacebookLeadPoller] Error processing lead ${lead.id}:`,
            err
          );
          logRoutingEvent({
            pageId: page.facebookPageId,
            leadId: lead.id,
            accountId: page.accountId,
            contactId: null, dealId: null,
            routingMethod: "poller",
            status: "failure",
            errorMessage: err?.message?.substring(0, 500) || "Poller processing error",
            responseTimeMs: null,
            source: "poller",
            payloadSnippet: JSON.stringify(lead).substring(0, 500),
          }).catch(() => {});
        }
      }
    } catch (err) {
      console.error(
        `[FacebookLeadPoller] Error fetching leads from form ${form.id} (${form.name}):`,
        err
      );
    }
  }

  return { formsChecked: forms.length, leadsFound: totalLeadsFound, leadsCreated: totalLeadsCreated };
}

/**
 * Fetch all leadgen forms for a Facebook page.
 * Throws on token errors so the circuit breaker can catch them.
 */
async function fetchPageForms(
  pageId: string,
  accessToken: string
): Promise<Array<{ id: string; name: string; status: string }>> {
  const url = `${FACEBOOK_GRAPH_API}/${pageId}/leadgen_forms?access_token=${accessToken}`;
  const res = await fetch(url);
  const data = await res.json();
  if (data.error) {
    // Throw on token errors so circuit breaker can catch them
    const errMsg = `Facebook API error: ${data.error.message} (code: ${data.error.code}, subcode: ${data.error.error_subcode || "none"})`;
    if (data.error.code === 190 || data.error.error_subcode === 460 || data.error.error_subcode === 463) {
      const tokenError = new Error(errMsg) as any;
      tokenError.errorCode = data.error.code;
      tokenError.errorSubcode = data.error.error_subcode;
      throw tokenError;
    }
    console.error(`[FacebookLeadPoller] Error fetching forms for page ${pageId}:`, data.error);
    return [];
  }
  return data.data || [];
}

/**
 * Fetch recent leads from a specific form (last 24 hours).
 */
async function fetchFormLeads(
  formId: string,
  accessToken: string
): Promise<
  Array<{
    id: string;
    created_time: string;
    field_data: Array<{ name: string; values: string[] }>;
  }>
> {
  try {
    const sinceTimestamp = Math.floor(Date.now() / 1000) - LEAD_LOOKBACK_SECONDS;
    const url = `${FACEBOOK_GRAPH_API}/${formId}/leads?access_token=${accessToken}&filtering=[{"field":"time_created","operator":"GREATER_THAN","value":${sinceTimestamp}}]&limit=50`;
    const res = await fetch(url);
    const data = await res.json();
    if (data.error) {
      console.error(
        `[FacebookLeadPoller] Error fetching leads for form ${formId}:`,
        data.error
      );
      return [];
    }
    return data.data || [];
  } catch (err) {
    console.error(`[FacebookLeadPoller] Network error fetching leads for form ${formId}:`, err);
    return [];
  }
}

/**
 * Process a single polled lead — deduplicate, create contact, notify, and auto-enroll.
 */
async function processPolledLead(
  lead: {
    id: string;
    created_time: string;
    field_data: Array<{ name: string; values: string[] }>;
  },
  page: {
    id: number;
    accountId: number;
    facebookPageId: string;
    pageName: string | null;
  }
): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;

  // Check if this lead already exists (dedup by fb_lead_id in customFields)
  const existingCheck = await db.execute(
    sql`SELECT id FROM contacts WHERE accountId = ${page.accountId} AND customFields LIKE ${`%"fb_lead_id":"${lead.id}"%`} LIMIT 1`
  );
  const existingRows = existingCheck[0] as unknown as any[];
  if (existingRows && existingRows.length > 0) {
    return false; // Already processed
  }

  // Parse field data
  const fields: Record<string, string> = {};
  if (Array.isArray(lead.field_data)) {
    for (const field of lead.field_data) {
      const name = (field.name || "").toLowerCase();
      const val = Array.isArray(field.values) ? field.values[0] : "";
      if (val) fields[name] = String(val);
    }
  }

  // Extract name, email, phone
  const fullName = fields.full_name || fields.name || "";
  const nameParts = fullName.trim().split(/\s+/);
  const firstName = nameParts[0] || "Facebook";
  const lastName = nameParts.slice(1).join(" ") || "Lead";
  const email = fields.email || "";
  const rawPhone = fields.phone_number || fields.phone || "";

  // Normalize phone
  let phone: string | undefined;
  if (rawPhone && !rawPhone.includes("<") && rawPhone.length <= 20) {
    const normalized = normalizeToE164(rawPhone);
    phone = normalized || rawPhone;
  }

  // Skip test leads
  const isTestLead = firstName.includes("<test") || lastName.includes("dummy data") ||
    (email && email.includes("test@meta.com") && rawPhone.includes("<test"));
  if (isTestLead) {
    console.log(`[FacebookLeadPoller] Skipping Meta test lead ${lead.id}`);
    return false;
  }

  // Build custom fields
  const customFields: Record<string, string> = { fb_lead_id: lead.id };
  for (const [key, val] of Object.entries(fields)) {
    if (!["full_name", "name", "email", "phone_number", "phone"].includes(key)) {
      customFields[`fb_${key.replace(/[^a-z0-9_]/g, "_")}`] = val;
    }
  }

  // Create contact
  const { id: contactId } = await createContact({
    accountId: page.accountId,
    firstName,
    lastName,
    email: email || null,
    phone: phone || null,
    leadSource: "facebook",
    status: "new",
    customFields: JSON.stringify(customFields),
  });

  const _pollerStartTime = Date.now();
  console.log(
    `[FacebookLeadPoller] Created contact ${contactId} for account ${page.accountId}: ${firstName} ${lastName} (lead ${lead.id})`
  );

  // Create deal in pipeline
  let dealId: number | null = null;
  try {
    const pipeline = await getOrCreateDefaultPipeline(page.accountId);
    const stages = await listPipelineStages(pipeline.id, page.accountId);
    const newLeadStage = stages.find((s) => s.name === "New Lead");
    if (newLeadStage) {
      const { id } = await createDeal({
        accountId: page.accountId,
        pipelineId: pipeline.id,
        stageId: newLeadStage.id,
        contactId,
        title: `${firstName} ${lastName}`,
      });
      dealId = id;
    }
  } catch (err) {
    console.error(`[FacebookLeadPoller] Error creating deal for contact ${contactId}:`, err);
  }

  // Route lead (async)
  routeLead({
    contactId,
    accountId: page.accountId,
    leadSource: "facebook",
    source: "facebook_lead",
  }).catch((err: any) => {
    console.error(`[FacebookLeadPoller] Lead routing failed for contact ${contactId}:`, err);
  });

  // Log routing event
  logRoutingEvent({
    pageId: page.facebookPageId,
    leadId: lead.id,
    accountId: page.accountId,
    contactId,
    dealId,
    routingMethod: "poller",
    status: "success",
    errorMessage: null,
    responseTimeMs: Date.now() - _pollerStartTime,
    source: "poller",
    payloadSnippet: JSON.stringify(lead.field_data || []).substring(0, 500),
  }).catch(() => {});

  // ─── NEW: Send lead notifications (SMS + email to Tim & Belinda) ───
  notifyLeadRecipients({
    contactId,
    name: `${firstName} ${lastName}`,
    email: email || "",
    phone: phone || rawPhone || "",
    accountId: page.accountId,
    source: `Facebook - ${page.pageName || "Unknown Page"}`,
    timestamp: lead.created_time ? new Date(lead.created_time) : new Date(),
  }).catch((err) => {
    console.error(`[FacebookLeadPoller] Lead notification error for contact ${contactId}:`, err);
  });

  // ─── NEW: Auto-enroll in "Purchase Lead - Didn't Book Nurture" sequence ───
  autoEnrollInPurchaseSequence(contactId, page.accountId).catch((err) => {
    console.error(`[FacebookLeadPoller] Auto-enrollment error for contact ${contactId}:`, err);
  });

  // In-app notification removed — notifyLeadRecipients already creates in-app + push + email + SMS.
  // Duplicate createNotification() was causing 2x in-app notifications (fixed 2026-04-20).

  return true;
}

/**
 * Auto-enroll a contact in the "Purchase Lead - Didn't Book Nurture" sequence.
 */
async function autoEnrollInPurchaseSequence(contactId: number, accountId: number): Promise<void> {
  const db = await getDb();
  if (!db) return;

  // Find the purchase sequence for this account
  const purchaseSequences = await db
    .select({ id: sequences.id, name: sequences.name })
    .from(sequences)
    .where(
      and(
        eq(sequences.accountId, accountId),
        sql`${sequences.name} LIKE '%Purchase Lead%'`
      )
    )
    .limit(1);

  if (purchaseSequences.length === 0) {
    console.warn(`[FacebookLeadPoller] No "Purchase Lead" sequence found for account ${accountId} — skipping auto-enrollment`);
    return;
  }

  const seq = purchaseSequences[0];
  await enrollContactInSequence({
    sequenceId: seq.id,
    contactId,
    accountId,
    currentStep: 0,
    status: "active",
    enrollmentSource: "facebook_lead_auto",
  });

  console.log(`[FacebookLeadPoller] Auto-enrolled contact ${contactId} in sequence "${seq.name}" (id ${seq.id})`);
}
