import { describe, expect, it } from "vitest";
import { normalizeToE164, isValidE164 } from "../shared/phone";
import { getContactById, getDealByContactId, getOrCreateDefaultPipeline, listPipelineStages } from "./db";

// ─────────────────────────────────────────────
// Facebook Lead Ads Webhook Tests
// ─────────────────────────────────────────────

// We test the webhook via HTTP requests to the running server
const BASE_URL = "http://localhost:3000";

async function postWebhook(body: any) {
  const res = await fetch(`${BASE_URL}/api/webhooks/facebook-leads`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return { status: res.status, data: await res.json() };
}

async function getVerification(params: Record<string, string>) {
  const qs = new URLSearchParams(params).toString();
  const res = await fetch(`${BASE_URL}/api/webhooks/facebook-leads?${qs}`);
  return { status: res.status, text: await res.text() };
}

// ─── Verification Challenge ───
describe("Facebook Webhook Verification", () => {
  it("returns challenge when verify token matches a page mapping", async () => {
    // First, create a facebook page mapping with a known verify token
    const { createFacebookPageMapping, deleteFacebookPageMapping } = await import("./db");
    const mapping = await createFacebookPageMapping({
      facebookPageId: `test_page_verify_${Date.now()}`,
      accountId: 1,
      pageName: "Test Page",
      verifyToken: "apex_verify",
    });

    try {
      const { status, text } = await getVerification({
        "hub.mode": "subscribe",
        "hub.challenge": "challenge_abc_123",
        "hub.verify_token": "apex_verify",
      });
      expect(status).toBe(200);
      expect(text).toBe("challenge_abc_123");
    } finally {
      // Clean up
      await deleteFacebookPageMapping(mapping.id);
    }
  });

  it("returns 403 when verify token is wrong", async () => {
    const { status } = await getVerification({
      "hub.mode": "subscribe",
      "hub.challenge": "test",
      "hub.verify_token": "wrong_token",
    });
    expect(status).toBe(403);
  });

  it("returns 403 when hub.mode is not subscribe", async () => {
    const { status } = await getVerification({
      "hub.mode": "unsubscribe",
      "hub.challenge": "test",
      "hub.verify_token": "apex_verify",
    });
    expect(status).toBe(403);
  });
});

// ─── Simplified Payload ───
describe("Facebook Webhook - Simplified Payload", { timeout: 15000 }, () => {
  it("creates a contact with all fields", async () => {
    const { status, data } = await postWebhook({
      accountId: 1,
      firstName: "FBTest",
      lastName: "SimpleLead",
      email: "fbtest-simple@example.com",
      phone: "5551112222",
      leadId: "fb_test_simple_001",
      campaignId: "camp_simple_001",
      adId: "ad_simple_001",
    });
    expect(status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.contactId).toBeGreaterThan(0);
    expect(data.dealId).toBeGreaterThan(0);

    // Verify contact was created with correct data
    const contact = await getContactById(data.contactId, 1);
    expect(contact).toBeTruthy();
    expect(contact!.firstName).toBe("FBTest");
    expect(contact!.lastName).toBe("SimpleLead");
    expect(contact!.email).toBe("fbtest-simple@example.com");
    expect(contact!.phone).toBe("+15551112222"); // Normalized to E.164
    expect(contact!.leadSource).toBe("facebook");
    expect(contact!.status).toBe("new");
  });

  it("normalizes US phone numbers to E.164", async () => {
    const { data } = await postWebhook({
      accountId: 1,
      firstName: "PhoneTest",
      lastName: "Normalize",
      phone: "(555) 333-4444",
    });
    expect(data.success).toBe(true);
    const contact = await getContactById(data.contactId, 1);
    expect(contact!.phone).toBe("+15553334444");
  });

  it("stores Facebook metadata in customFields", async () => {
    const { data } = await postWebhook({
      accountId: 1,
      firstName: "Meta",
      lastName: "Data",
      leadId: "fb_meta_001",
      campaignId: "camp_meta_001",
      adId: "ad_meta_001",
      formId: "form_meta_001",
    });
    expect(data.success).toBe(true);
    const contact = await getContactById(data.contactId, 1);
    const custom = JSON.parse(contact!.customFields || "{}");
    expect(custom.fb_lead_id).toBe("fb_meta_001");
    expect(custom.fb_campaign_id).toBe("camp_meta_001");
    expect(custom.fb_ad_id).toBe("ad_meta_001");
    expect(custom.fb_form_id).toBe("form_meta_001");
  });

  it("assigns contact to New Lead pipeline stage", async () => {
    const { data } = await postWebhook({
      accountId: 1,
      firstName: "Pipeline",
      lastName: "Test",
    });
    expect(data.success).toBe(true);
    expect(data.dealId).toBeGreaterThan(0);

    // Verify the deal is in "New Lead" stage
    const pipeline = await getOrCreateDefaultPipeline(1);
    const stages = await listPipelineStages(pipeline.id, 1);
    const newLeadStage = stages.find((s) => s.name === "New Lead");
    expect(newLeadStage).toBeTruthy();

    const deal = await getDealByContactId(data.contactId, pipeline.id, 1);
    expect(deal).toBeTruthy();
    expect(deal!.stageId).toBe(newLeadStage!.id);
  });

  it("rejects payload without accountId", async () => {
    const { status, data } = await postWebhook({
      firstName: "NoAccount",
      lastName: "Test",
    });
    expect(status).toBe(200); // Returns 200 with error in body
    expect(data.success).toBe(false);
    expect(data.error).toBe("accountId is required");
  });

  it("handles missing optional fields gracefully", async () => {
    const { data } = await postWebhook({
      accountId: 1,
      firstName: "Minimal",
      lastName: "Lead",
    });
    expect(data.success).toBe(true);
    expect(data.contactId).toBeGreaterThan(0);
    const contact = await getContactById(data.contactId, 1);
    expect(contact!.email).toBeNull();
    expect(contact!.phone).toBeNull();
    expect(contact!.leadSource).toBe("facebook");
  });

  it("accepts alternative field names (snake_case)", async () => {
    const { data } = await postWebhook({
      account_id: 1,
      first_name: "Snake",
      last_name: "Case",
      phone_number: "+15557778888",
      lead_id: "fb_snake_001",
      campaign_id: "camp_snake_001",
      ad_id: "ad_snake_001",
    });
    expect(data.success).toBe(true);
    const contact = await getContactById(data.contactId, 1);
    expect(contact!.firstName).toBe("Snake");
    expect(contact!.lastName).toBe("Case");
    expect(contact!.phone).toBe("+15557778888");
  });

  it("parses full name when first/last not provided", async () => {
    const { data } = await postWebhook({
      accountId: 1,
      name: "John Michael Doe",
    });
    expect(data.success).toBe(true);
    const contact = await getContactById(data.contactId, 1);
    expect(contact!.firstName).toBe("John");
    expect(contact!.lastName).toBe("Michael Doe");
  });
});

// ─── Facebook Native Payload ───
// NOTE: The native Facebook webhook handler responds IMMEDIATELY with
// { success: true, message: "EVENT_RECEIVED" } and processes leads
// asynchronously in the background. Tests verify the immediate response.
describe("Facebook Webhook - Native Payload", () => {
  it("responds immediately with EVENT_RECEIVED for a standard leadgen webhook", async () => {
    const { status, data } = await postWebhook({
      object: "page",
      entry: [
        {
          id: "page_test_001",
          time: Date.now(),
          changes: [
            {
              field: "leadgen",
              value: {
                leadgen_id: "fb_native_test_001",
                campaign_id: "camp_native_test",
                ad_id: "ad_native_test",
                form_id: "form_native_test",
                accountId: 1,
                field_data: [
                  { name: "full_name", values: ["Alice Johnson"] },
                  { name: "email", values: ["alice@example.com"] },
                  { name: "phone_number", values: ["+15551239999"] },
                ],
              },
            },
          ],
        },
      ],
    });
    // Native payloads get an immediate 200 with EVENT_RECEIVED
    // Actual lead processing happens asynchronously in the background
    expect(status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.message).toBe("EVENT_RECEIVED");
  });

  it("responds immediately for multiple leads in a single webhook", async () => {
    const { status, data } = await postWebhook({
      object: "page",
      entry: [
        {
          id: "page_multi",
          time: Date.now(),
          changes: [
            {
              field: "leadgen",
              value: {
                leadgen_id: "fb_multi_001",
                accountId: 1,
                field_data: [
                  { name: "first_name", values: ["Bob"] },
                  { name: "last_name", values: ["Multi1"] },
                ],
              },
            },
            {
              field: "leadgen",
              value: {
                leadgen_id: "fb_multi_002",
                accountId: 1,
                field_data: [
                  { name: "first_name", values: ["Carol"] },
                  { name: "last_name", values: ["Multi2"] },
                ],
              },
            },
          ],
        },
      ],
    });
    expect(status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.message).toBe("EVENT_RECEIVED");
  });

  it("responds immediately even for non-leadgen changes", async () => {
    const { status, data } = await postWebhook({
      object: "page",
      entry: [
        {
          id: "page_skip",
          time: Date.now(),
          changes: [
            {
              field: "feed",
              value: { some: "data" },
            },
          ],
        },
      ],
    });
    // Even non-leadgen payloads get immediate 200 (Facebook expects fast response)
    expect(status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.message).toBe("EVENT_RECEIVED");
  });

  it("accepts native payload with first_name and last_name in field_data", async () => {
    const { status, data } = await postWebhook({
      object: "page",
      entry: [
        {
          id: "page_names",
          time: Date.now(),
          changes: [
            {
              field: "leadgen",
              value: {
                leadgen_id: "fb_names_001",
                accountId: 1,
                field_data: [
                  { name: "first_name", values: ["David"] },
                  { name: "last_name", values: ["Williams"] },
                  { name: "email", values: ["david@example.com"] },
                ],
              },
            },
          ],
        },
      ],
    });
    // Immediate response — lead processing happens in background
    expect(status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.message).toBe("EVENT_RECEIVED");
  });
});

// ─── Error Handling ───
describe("Facebook Webhook - Error Handling", () => {
  it("handles empty body gracefully", async () => {
    const res = await fetch(`${BASE_URL}/api/webhooks/facebook-leads`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    });
    const data = await res.json();
    // Empty object treated as simplified format without accountId
    expect(data.success).toBe(false);
    expect(data.error).toBe("accountId is required");
  });

  it("returns error for invalid accountId", async () => {
    const { data } = await postWebhook({
      accountId: -1,
      firstName: "Invalid",
      lastName: "Account",
    });
    expect(data.success).toBe(false);
  });

  it("returns error for zero accountId", async () => {
    const { data } = await postWebhook({
      accountId: 0,
      firstName: "Zero",
      lastName: "Account",
    });
    expect(data.success).toBe(false);
    expect(data.error).toBe("accountId is required");
  });
});

// ─── Phone Normalization (unit tests) ───
describe("Phone Normalization for Facebook Leads", () => {
  it("normalizes 10-digit US number", () => {
    expect(normalizeToE164("5551234567")).toBe("+15551234567");
  });

  it("normalizes formatted US number", () => {
    expect(normalizeToE164("(555) 123-4567")).toBe("+15551234567");
  });

  it("normalizes US number with country code", () => {
    expect(normalizeToE164("1-555-123-4567")).toBe("+15551234567");
  });

  it("preserves valid E.164", () => {
    expect(normalizeToE164("+15551234567")).toBe("+15551234567");
  });

  it("validates E.164 format", () => {
    expect(isValidE164("+15551234567")).toBe(true);
    expect(isValidE164("5551234567")).toBe(false);
    expect(isValidE164("+1")).toBe(false);
  });
});
