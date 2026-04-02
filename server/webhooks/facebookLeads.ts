import { Router, Request, Response } from "express";
import { normalizeToE164 } from "../../shared/phone";
import {
  createContact,
  getOrCreateDefaultPipeline,
  listPipelineStages,
  createDeal,
  getAccountFacebookPageByFbPageId,
  createNotification,
} from "../db";
import { ENV } from "../_core/env";
import { routeLead } from "../services/leadRoutingEngine";
import { sendPushNotificationToAccount } from "../services/webPush";
import { logRoutingEvent } from "../services/leadRoutingMonitor";

const FACEBOOK_GRAPH_API = "https://graph.facebook.com/v19.0";

// ─────────────────────────────────────────────
// Facebook Lead Ads Webhook
// POST /api/webhooks/facebook-leads
// GET  /api/webhooks/facebook-leads (verification challenge)
//
// CRITICAL: Facebook requires a 200 response within 20 seconds.
// We respond IMMEDIATELY with 200 and process leads asynchronously
// in the background. This ensures:
// 1. Facebook never times out → no missed leads
// 2. Speed-to-lead is optimized → leads appear in CRM within seconds
// ─────────────────────────────────────────────

export const facebookLeadsWebhookRouter = Router();

/**
 * GET — Facebook webhook verification challenge
 * Facebook sends: ?hub.mode=subscribe&hub.challenge=CHALLENGE&hub.verify_token=TOKEN
 */
facebookLeadsWebhookRouter.get(
  "/api/webhooks/facebook-leads",
  async (req: Request, res: Response) => {
    const mode = req.query["hub.mode"];
    const challenge = req.query["hub.challenge"];
    const verifyToken = String(req.query["hub.verify_token"] || "");

    if (mode !== "subscribe" || !verifyToken) {
      console.warn("[FB Leads Webhook] Verification failed — missing mode or token");
      return res.status(403).send("Forbidden");
    }

    // 1. Check global FACEBOOK_WEBHOOK_VERIFY_TOKEN first
    if (ENV.facebookWebhookVerifyToken && verifyToken === ENV.facebookWebhookVerifyToken) {
      console.log(`[FB Leads Webhook] Verification challenge accepted (global token)`);
      return res.status(200).send(challenge);
    }

    // 2. Check per-client verify tokens from the facebook_page_mappings table.
    try {
      const { listFacebookPageMappings } = await import("../db");
      const mappings = await listFacebookPageMappings();
      const matched = mappings.some((m) => m.verifyToken === verifyToken);

      if (matched) {
        console.log(`[FB Leads Webhook] Verification challenge accepted (per-client token)`);
        return res.status(200).send(challenge);
      }
    } catch (err) {
      console.error("[FB Leads Webhook] Error checking per-client verify tokens:", err);
    }

    console.warn("[FB Leads Webhook] Verification failed — no matching verify token", { verifyToken });
    return res.status(403).send("Forbidden");
  }
);

/**
 * POST — Receive Facebook Lead Ads data
 *
 * IMPORTANT: For Facebook native webhooks, we respond with 200 IMMEDIATELY
 * and process the lead data asynchronously. Facebook will retry if we don't
 * respond within 20 seconds, which can cause duplicate leads.
 *
 * For simplified/n8n payloads, we process synchronously since they're not
 * subject to Facebook's timeout requirements.
 */
facebookLeadsWebhookRouter.post(
  "/api/webhooks/facebook-leads",
  async (req: Request, res: Response) => {
    const startTime = Date.now();
    console.log(`[FB Leads Webhook] Incoming POST /api/webhooks/facebook-leads from ${req.ip} | Content-Type: ${req.headers['content-type']} | Body keys: ${Object.keys(req.body || {}).join(',')}`);
    try {
      const body = req.body;

      if (!body || typeof body !== "object") {
        console.warn("[FB Leads Webhook] Empty or invalid body");
        return res.status(400).json({ success: false, error: "Invalid payload" });
      }

      // Detect format: Facebook native (has "object" + "entry") vs simplified
      if (body.object === "page" && Array.isArray(body.entry)) {
        // *** CRITICAL: Respond to Facebook IMMEDIATELY ***
        // Facebook requires 200 within 20 seconds or it retries/drops the webhook
        res.status(200).json({ success: true, message: "EVENT_RECEIVED" });
        console.log(`[FB Leads Webhook] Responded 200 to Facebook in ${Date.now() - startTime}ms — processing ${body.entry.length} entries in background`);

        // Process leads asynchronously in the background
        handleFacebookNativePayload(body).then((results) => {
          const elapsed = Date.now() - startTime;
          console.log(`[FB Leads Webhook] Background processing complete in ${elapsed}ms — ${results.length} leads processed`);
          for (const r of results) {
            if (r.success) {
              console.log(`[FB Leads Webhook] ✓ Lead ${r.leadId} → contact ${r.contactId}, deal ${r.dealId}`);
            } else {
              console.error(`[FB Leads Webhook] ✗ Lead ${r.leadId} failed: ${r.error}`);
            }
          }
        }).catch((err) => {
          console.error(`[FB Leads Webhook] Background processing error:`, err);
        });

        return; // Response already sent
      } else {
        // Simplified/n8n payloads — process synchronously (no Facebook timeout concern)
        const result = await handleSimplifiedPayload(body);
        return res.json(result);
      }
    } catch (err) {
      console.error("[FB Leads Webhook] Error processing webhook:", err);
      return res.status(500).json({ success: false, error: "Internal server error" });
    }
  }
);

// ─────────────────────────────────────────────
// Handle Facebook native webhook payload
// ─────────────────────────────────────────────
interface LeadResult {
  leadId: string;
  contactId: number;
  dealId: number | null;
  success: boolean;
  error?: string;
}

/**
 * Fetch full lead data from Facebook Graph API using the leadgen_id.
 * Returns parsed field data (name, email, phone) or null on failure.
 */
async function fetchLeadDataFromGraph(
  leadgenId: string,
  pageAccessToken: string
): Promise<Record<string, string> | null> {
  try {
    const url = `${FACEBOOK_GRAPH_API}/${leadgenId}?access_token=${pageAccessToken}`;
    const res = await fetch(url);
    const data = await res.json();

    if (data.error) {
      console.error(`[FB Leads Webhook] Graph API error fetching lead ${leadgenId}:`, data.error);
      return null;
    }

    const fields: Record<string, string> = {};
    if (Array.isArray(data.field_data)) {
      for (const field of data.field_data) {
        const name = (field.name || "").toLowerCase();
        const val = Array.isArray(field.values) ? field.values[0] : field.value;
        if (val) fields[name] = String(val);
      }
    }

    console.log(`[FB Leads Webhook] Fetched lead ${leadgenId} from Graph API:`, Object.keys(fields));
    return fields;
  } catch (err) {
    console.error(`[FB Leads Webhook] Error fetching lead ${leadgenId} from Graph API:`, err);
    return null;
  }
}

async function handleFacebookNativePayload(body: any): Promise<LeadResult[]> {
  const results: LeadResult[] = [];
  const payloadSnippet = JSON.stringify(body).substring(0, 500);

  for (const entry of body.entry) {
    const changes = entry.changes || [];
    for (const change of changes) {
      if (change.field !== "leadgen") continue;

      const value = change.value;
      if (!value) continue;

      const leadId = String(value.leadgen_id || value.lead_id || "");
      const campaignId = String(value.campaign_id || "");
      const adId = String(value.ad_id || "");
      const formId = String(value.form_id || "");

      // Determine target account: check facebookPageMappings (admin-controlled explicit routing) FIRST,
      // then fall back to accountFacebookPages (OAuth default).
      // pageAccessToken is always retrieved from accountFacebookPages for Graph API calls.
      const pageId = String(value.page_id || entry.id || "");
      let accountId = parseInt(String(value.accountId || entry.accountId || "0"), 10);
      let pageAccessToken: string | null = null;
      type RoutingMethodType = "manual_mapping" | "oauth_page" | "payload_explicit" | "poller" | "unknown";
      let _routingMethod: RoutingMethodType = "payload_explicit";

      if ((!accountId || accountId <= 0) && pageId) {
        // 1. Check facebookPageMappings first (admin manual routing takes priority)
        const { getFacebookPageMappingByPageId } = await import("../db");
        const mapping = await getFacebookPageMappingByPageId(pageId);

        if (mapping) {
          accountId = mapping.accountId;
          _routingMethod = "manual_mapping";
          console.log(`[FB Leads Webhook] Resolved page ${pageId} → account ${accountId} (via admin facebookPageMappings)`);

          // Still look up accountFacebookPages to retrieve pageAccessToken for Graph API calls
          const fbPage = await getAccountFacebookPageByFbPageId(pageId);
          if (fbPage) {
            pageAccessToken = fbPage.pageAccessToken;
            console.log(`[FB Leads Webhook] Retrieved pageAccessToken from accountFacebookPages for page ${pageId}`);
          }
        } else {
          // 2. Fall back to accountFacebookPages (OAuth default)
          const fbPage = await getAccountFacebookPageByFbPageId(pageId);
          if (fbPage) {
            accountId = fbPage.accountId;
            pageAccessToken = fbPage.pageAccessToken;
            _routingMethod = "oauth_page";
            console.log(`[FB Leads Webhook] Resolved page ${pageId} → account ${accountId} (via accountFacebookPages OAuth fallback)`);
          } else {
            console.warn(`[FB Leads Webhook] No mapping found for page_id=${pageId}, skipping lead`);
            logRoutingEvent({
              pageId, leadId, accountId: null, contactId: null, dealId: null,
              routingMethod: "unknown", status: "failure",
              errorMessage: `No account mapping for page ${pageId}`,
              responseTimeMs: null, source: "webhook_native",
              payloadSnippet,
            }).catch(() => {});
            results.push({ leadId, contactId: 0, dealId: null, success: false, error: `No account mapping for page ${pageId}` });
            continue;
          }
        }
      }
      if (!accountId || accountId <= 0) {
        console.warn(`[FB Leads Webhook] Could not determine accountId for lead ${leadId}, skipping`);
        logRoutingEvent({
          pageId, leadId, accountId: null, contactId: null, dealId: null,
          routingMethod: "unknown", status: "failure",
          errorMessage: "Could not determine account",
          responseTimeMs: null, source: "webhook_native",
          payloadSnippet,
        }).catch(() => {});
        results.push({ leadId, contactId: 0, dealId: null, success: false, error: "Could not determine account" });
        continue;
      }

      const _routeStartTime = Date.now();

      // Try to fetch full lead data from Graph API using the leadgen_id
      let fieldData: Record<string, string> = {};
      if (leadId && pageAccessToken) {
        const graphData = await fetchLeadDataFromGraph(leadId, pageAccessToken);
        if (graphData) {
          fieldData = graphData;
        }
      }

      // If Graph API fetch failed or no page token, fall back to field_data in the webhook payload
      if (Object.keys(fieldData).length === 0 && Array.isArray(value.field_data)) {
        for (const field of value.field_data) {
          const name = (field.name || "").toLowerCase();
          const val = Array.isArray(field.values) ? field.values[0] : field.value;
          if (val) fieldData[name] = String(val);
        }
      }

      // Parse name
      let firstName = fieldData.first_name || fieldData.firstname || "";
      let lastName = fieldData.last_name || fieldData.lastname || "";
      if (!firstName && !lastName && fieldData.full_name) {
        const parts = fieldData.full_name.trim().split(/\s+/);
        firstName = parts[0] || "";
        lastName = parts.slice(1).join(" ") || "";
      }
      if (!firstName && !lastName && fieldData.name) {
        const parts = fieldData.name.trim().split(/\s+/);
        firstName = parts[0] || "";
        lastName = parts.slice(1).join(" ") || "";
      }

      const email = fieldData.email || fieldData.email_address || "";
      const phone = fieldData.phone_number || fieldData.phone || "";

      try {
        const result = await processLead({
          accountId,
          firstName: firstName || "Facebook",
          lastName: lastName || "Lead",
          email: email || undefined,
          phone: phone || undefined,
          leadId,
          campaignId,
          adId,
          formId,
        });
        // Log successful routing event
        logRoutingEvent({
          pageId, leadId, accountId,
          contactId: result.contactId, dealId: result.dealId,
          routingMethod: _routingMethod,
          status: "success",
          errorMessage: null,
          responseTimeMs: Date.now() - _routeStartTime,
          source: "webhook_native",
          payloadSnippet,
        }).catch(() => {});
        results.push({ leadId, ...result, success: true });
      } catch (err: any) {
        console.error(`[FB Leads Webhook] Error processing lead ${leadId}:`, err);
        // Log failure routing event
        logRoutingEvent({
          pageId, leadId, accountId,
          contactId: null, dealId: null,
          routingMethod: _routingMethod,
          status: "failure",
          errorMessage: err.message?.substring(0, 500) || "Unknown processing error",
          responseTimeMs: Date.now() - _routeStartTime,
          source: "webhook_native",
          payloadSnippet,
        }).catch(() => {});
        results.push({ leadId, contactId: 0, dealId: null, success: false, error: err.message });
      }
    }
  }

  return results;
}

// ─────────────────────────────────────────────
// Handle simplified/flat payload (from n8n)
// ─────────────────────────────────────────────
async function handleSimplifiedPayload(body: any) {
  const simplifiedStartTime = Date.now();
  const simplifiedSnippet = JSON.stringify(body).substring(0, 500);
  const accountId = parseInt(String(body.accountId || body.account_id || "0"), 10);
  if (!accountId || accountId <= 0) {
    logRoutingEvent({
      pageId: null, leadId: body.leadId || body.lead_id || null,
      accountId: null, contactId: null, dealId: null,
      routingMethod: "unknown", status: "failure",
      errorMessage: "accountId is required (simplified payload)",
      responseTimeMs: null, source: "webhook_simplified",
      payloadSnippet: simplifiedSnippet,
    }).catch(() => {});
    return { success: false, error: "accountId is required" };
  }

  const firstName = body.firstName || body.first_name || body.name?.split(" ")[0] || "Facebook";
  const lastName = body.lastName || body.last_name || body.name?.split(" ").slice(1).join(" ") || "Lead";
  const email = body.email || undefined;
  const phone = body.phone || body.phone_number || undefined;
  const leadId = body.leadId || body.lead_id || body.leadgen_id || "";
  const campaignId = body.campaignId || body.campaign_id || "";
  const adId = body.adId || body.ad_id || "";
  const formId = body.formId || body.form_id || "";

  try {
    const result = await processLead({
      accountId,
      firstName,
      lastName,
      email,
      phone,
      leadId,
      campaignId,
      adId,
      formId,
    });
    logRoutingEvent({
      pageId: null, leadId: leadId || null,
      accountId, contactId: result.contactId, dealId: result.dealId,
      routingMethod: "payload_explicit", status: "success",
      errorMessage: null,
      responseTimeMs: Date.now() - simplifiedStartTime,
      source: "webhook_simplified",
      payloadSnippet: simplifiedSnippet,
    }).catch(() => {});
    return { success: true, ...result };
  } catch (err: any) {
    console.error("[FB Leads Webhook] Error processing simplified lead:", err);
    logRoutingEvent({
      pageId: null, leadId: leadId || null,
      accountId, contactId: null, dealId: null,
      routingMethod: "payload_explicit", status: "failure",
      errorMessage: err.message?.substring(0, 500) || "Unknown error",
      responseTimeMs: Date.now() - simplifiedStartTime,
      source: "webhook_simplified",
      payloadSnippet: simplifiedSnippet,
    }).catch(() => {});
    return { success: false, error: err.message };
  }
}

// ─────────────────────────────────────────────
// Core lead processing logic
// ─────────────────────────────────────────────
interface LeadData {
  accountId: number;
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  leadId: string;
  campaignId: string;
  adId: string;
  formId: string;
}

async function processLead(
  data: LeadData
): Promise<{ contactId: number; dealId: number | null }> {
  // Normalize phone to E.164
  let normalizedPhone: string | undefined;
  if (data.phone) {
    const normalized = normalizeToE164(data.phone);
    if (normalized) {
      normalizedPhone = normalized;
    } else {
      // Store raw phone if normalization fails — don't lose the data
      normalizedPhone = data.phone;
      console.warn(
        `[FB Leads Webhook] Could not normalize phone "${data.phone}" to E.164, storing raw`
      );
    }
  }

  // Build custom fields with Facebook metadata
  const customFields: Record<string, string> = {};
  if (data.leadId) customFields.fb_lead_id = data.leadId;
  if (data.campaignId) customFields.fb_campaign_id = data.campaignId;
  if (data.adId) customFields.fb_ad_id = data.adId;
  if (data.formId) customFields.fb_form_id = data.formId;

  // 1. Create contact
  const { id: contactId } = await createContact({
    accountId: data.accountId,
    firstName: data.firstName,
    lastName: data.lastName,
    email: data.email || null,
    phone: normalizedPhone || null,
    leadSource: "facebook",
    status: "new",
    customFields: Object.keys(customFields).length > 0 ? JSON.stringify(customFields) : null,
  });

  console.log(
    `[FB Leads Webhook] Created contact ${contactId} for account ${data.accountId}: ${data.firstName} ${data.lastName}`
  );

  // 2. Assign to "New Lead" pipeline stage
  let dealId: number | null = null;
  try {
    const pipeline = await getOrCreateDefaultPipeline(data.accountId);
    const stages = await listPipelineStages(pipeline.id, data.accountId);
    const newLeadStage = stages.find((s) => s.name === "New Lead");

    if (newLeadStage) {
      const { id } = await createDeal({
        accountId: data.accountId,
        pipelineId: pipeline.id,
        stageId: newLeadStage.id,
        contactId,
        title: `${data.firstName} ${data.lastName}`,
      });
      dealId = id;
      console.log(
        `[FB Leads Webhook] Created deal ${dealId} in "New Lead" stage for contact ${contactId}`
      );
    }
  } catch (err) {
    console.error(`[FB Leads Webhook] Error creating deal for contact ${contactId}:`, err);
    // Don't fail the whole webhook — contact was already created
  }

  // 3. Auto-route lead via routing rules (async, non-blocking)
  routeLead({
    contactId,
    accountId: data.accountId,
    leadSource: "facebook",
    source: "facebook_lead",
  }).catch((err: any) => {
    console.error(`[FB Leads Webhook] Lead routing failed for contact ${contactId}:`, err);
  });

  // 4. Fire automation triggers (async, non-blocking)
  fireTriggers(data.accountId, contactId).catch((err) => {
    console.error(`[FB Leads Webhook] Error firing triggers for contact ${contactId}:`, err);
  });

  // 5. Create in-app notification
  createNotification({
    accountId: data.accountId,
    userId: null,
    type: "new_contact_facebook",
    title: `New Facebook lead`,
    body: `${data.firstName} ${data.lastName}${data.email ? ` (${data.email})` : ""}`,
    link: `/contacts/${contactId}`,
  }).catch((err) => console.error(`[FB Leads Webhook] Notification error:`, err));

  // Send push notification
  sendPushNotificationToAccount(data.accountId, {
    title: "New Facebook Lead",
    body: `${data.firstName} ${data.lastName}${data.email ? ` (${data.email})` : ""}`,
    url: `/contacts/${contactId}`,
    tag: `fb-lead-${contactId}`,
  }).catch((err) => console.error(`[FB Leads Webhook] Push notification error:`, err));

  return { contactId, dealId };
}

// ─────────────────────────────────────────────
// Fire automation triggers (non-blocking)
// ─────────────────────────────────────────────
async function fireTriggers(accountId: number, contactId: number) {
  const { onContactCreated, onFacebookLeadReceived, onFormSubmitted } = await import(
    "../services/workflowTriggers"
  );

  // Fire all applicable triggers
  await onContactCreated(accountId, contactId);
  await onFacebookLeadReceived(accountId, contactId);
  // Facebook lead forms count as form submissions
  await onFormSubmitted(accountId, contactId, "facebook_lead_form");
}

// ─────────────────────────────────────────────
// Alias routes at /api/webhooks/facebook
// Facebook Developer Console uses this shorter path.
// ─────────────────────────────────────────────
facebookLeadsWebhookRouter.get(
  "/api/webhooks/facebook",
  (req: Request, res: Response) => {
    // Reuse the same verification handler
    const mode = req.query["hub.mode"];
    const challenge = req.query["hub.challenge"];
    const verifyToken = String(req.query["hub.verify_token"] || "");

    if (mode !== "subscribe" || !verifyToken) {
      return res.status(403).send("Forbidden");
    }

    // Check global token
    if (ENV.facebookWebhookVerifyToken && verifyToken === ENV.facebookWebhookVerifyToken) {
      console.log(`[FB Webhook] Verification challenge accepted (global token)`);
      return res.status(200).send(challenge);
    }

    return res.status(403).send("Forbidden");
  }
);

facebookLeadsWebhookRouter.post(
  "/api/webhooks/facebook",
  async (req: Request, res: Response) => {
    const startTime = Date.now();
    console.log(`[FB Webhook] Incoming POST /api/webhooks/facebook from ${req.ip} | Content-Type: ${req.headers['content-type']} | Body keys: ${Object.keys(req.body || {}).join(',')}`);
    try {
      const body = req.body;

      if (!body || typeof body !== "object") {
        return res.status(400).json({ success: false, error: "Invalid payload" });
      }

      if (body.object === "page" && Array.isArray(body.entry)) {
        // *** CRITICAL: Respond to Facebook IMMEDIATELY ***
        res.status(200).json({ success: true, message: "EVENT_RECEIVED" });
        console.log(`[FB Webhook] Responded 200 to Facebook in ${Date.now() - startTime}ms — processing in background`);

        // Process leads asynchronously in the background
        handleFacebookNativePayload(body).then((results) => {
          const elapsed = Date.now() - startTime;
          console.log(`[FB Webhook] Background processing complete in ${elapsed}ms — ${results.length} leads processed`);
          for (const r of results) {
            if (r.success) {
              console.log(`[FB Webhook] ✓ Lead ${r.leadId} → contact ${r.contactId}, deal ${r.dealId}`);
            } else {
              console.error(`[FB Webhook] ✗ Lead ${r.leadId} failed: ${r.error}`);
            }
          }
        }).catch((err) => {
          console.error(`[FB Webhook] Background processing error:`, err);
        });

        return; // Response already sent
      } else {
        const result = await handleSimplifiedPayload(body);
        return res.json(result);
      }
    } catch (err) {
      console.error("[FB Webhook] Error processing webhook:", err);
      return res.status(500).json({ success: false, error: "Internal server error" });
    }
  }
);
