/**
 * Facebook Lead Polling Service
 *
 * Polls the Facebook Graph API every 60 seconds for new leads across all
 * connected Facebook pages. This serves as a **reliable fallback** to the
 * webhook-based approach — if Facebook fails to deliver a webhook (due to
 * timeouts, backoff, or network issues), the poller will catch it.
 *
 * Deduplication: Each lead is identified by its Facebook leadgen_id. Before
 * processing, we check if a contact with that fb_lead_id already exists in
 * the account. If so, we skip it.
 *
 * Flow:
 * 1. List all account_facebook_pages with a valid page_access_token
 * 2. For each page, list its leadgen_forms
 * 3. For each form, fetch recent leads (last 24h window)
 * 4. Deduplicate against existing contacts by fb_lead_id
 * 5. Process new leads through the standard pipeline (contact + deal + routing + notifications)
 */

import {
  createContact,
  getOrCreateDefaultPipeline,
  listPipelineStages,
  createDeal,
  createNotification,
} from "../db";
import { getDb } from "../db";
import { accountFacebookPages } from "../../drizzle/schema";
import { isNotNull, and, sql } from "drizzle-orm";
import { normalizeToE164 } from "../../shared/phone";
import { routeLead } from "./leadRoutingEngine";

const FACEBOOK_GRAPH_API = "https://graph.facebook.com/v19.0";
const POLL_INTERVAL_MS = 60_000; // 60 seconds
const LEAD_LOOKBACK_SECONDS = 86_400; // 24 hours — wide window to catch any missed leads

let pollTimer: ReturnType<typeof setInterval> | null = null;

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

  // Run once on startup (delayed 15s to let DB connect and other services start)
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
 * This is the main entry point — can also be called on-demand from a tRPC procedure.
 */
export async function pollAllPages(): Promise<{
  pagesChecked: number;
  formsChecked: number;
  leadsFound: number;
  leadsCreated: number;
}> {
  const db = await getDb();
  if (!db) return { pagesChecked: 0, formsChecked: 0, leadsFound: 0, leadsCreated: 0 };

  // Get all pages with a valid access token
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
    // No pages with tokens — nothing to poll
    return { pagesChecked: 0, formsChecked: 0, leadsFound: 0, leadsCreated: 0 };
  }

  let totalFormsChecked = 0;
  let totalLeadsFound = 0;
  let totalLeadsCreated = 0;

  for (const page of pages) {
    try {
      const result = await pollPage(page);
      totalFormsChecked += result.formsChecked;
      totalLeadsFound += result.leadsFound;
      totalLeadsCreated += result.leadsCreated;
    } catch (err) {
      console.error(
        `[FacebookLeadPoller] Error polling page ${page.facebookPageId} (${page.pageName}):`,
        err
      );
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
        } catch (err) {
          console.error(
            `[FacebookLeadPoller] Error processing lead ${lead.id}:`,
            err
          );
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
 */
async function fetchPageForms(
  pageId: string,
  accessToken: string
): Promise<Array<{ id: string; name: string; status: string }>> {
  try {
    const url = `${FACEBOOK_GRAPH_API}/${pageId}/leadgen_forms?access_token=${accessToken}`;
    const res = await fetch(url);
    const data = await res.json();
    if (data.error) {
      console.error(
        `[FacebookLeadPoller] Error fetching forms for page ${pageId}:`,
        data.error
      );
      return [];
    }
    return data.data || [];
  } catch (err) {
    console.error(`[FacebookLeadPoller] Network error fetching forms for page ${pageId}:`, err);
    return [];
  }
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
    // Use filtering to only get leads from the last 24 hours
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
 * Process a single polled lead — deduplicate and create contact if new.
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

  // Normalize phone — skip invalid/test data from Meta
  let phone: string | undefined;
  if (rawPhone && !rawPhone.includes("<") && rawPhone.length <= 20) {
    const normalized = normalizeToE164(rawPhone);
    phone = normalized || rawPhone;
  }

  // Skip test leads with dummy data (Meta test tool sends "<test lead: dummy data>")
  const isTestLead = firstName.includes("<test") || lastName.includes("dummy data") ||
    (email && email.includes("test@meta.com") && rawPhone.includes("<test"));
  if (isTestLead) {
    console.log(`[FacebookLeadPoller] Skipping Meta test lead ${lead.id}`);
    return false;
  }

  // Build custom fields
  const customFields: Record<string, string> = { fb_lead_id: lead.id };
  // Store any extra form fields
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

  // Create notification
  createNotification({
    accountId: page.accountId,
    userId: null,
    type: "new_contact_facebook",
    title: "New Facebook lead",
    body: `${firstName} ${lastName}${email ? ` (${email})` : ""}`,
    link: `/contacts/${contactId}`,
  }).catch((err) =>
    console.error(`[FacebookLeadPoller] Notification error:`, err)
  );

  return true;
}
