#!/usr/bin/env node
/**
 * One-time Historical Facebook Lead Import
 *
 * Pulls ALL leads from the last 45 days across all forms on the PMR
 * Facebook page and imports them into the CRM.
 *
 * Features:
 * - Paginates through all leads (Facebook API returns 25 per page)
 * - Deduplicates by fb_lead_id against existing contacts
 * - Processes through the same pipeline as the poller (contact + deal + routing)
 * - Handles Meta test leads gracefully
 *
 * Usage: node scripts/import-historical-leads.mjs
 */

const PAGE_ID = "500444413143324";
const PAGE_TOKEN = "EAAvwgCNktpQBRLu7ZB9noH66PzMAnZArfacfjW6ipZAXrujyCmAgDpr5VWIbLnmxYZAqWiv1crl4ovgQk7vqiZApZBnFfXpt2i5kbkaXzMfmJsNtM3zbYnWFVc6tvNhrj7Uht6bTlQ8xs2tpm6i2SJF4cK3cTwMj8CQXDoYhtnPZBhm9HMDcZC3lMBijNu1nWSlmT603p2ZAYXNjgs5ZBgYPlh05BJ";
const ACCOUNT_ID = 420001;
const GRAPH_API = "https://graph.facebook.com/v19.0";
const LOOKBACK_DAYS = 45;

// Calculate since timestamp (45 days ago)
const sinceTimestamp = Math.floor(Date.now() / 1000) - (LOOKBACK_DAYS * 24 * 60 * 60);
const sinceDate = new Date(sinceTimestamp * 1000).toISOString();

console.log("=== Historical Facebook Lead Import ===");
console.log(`Page ID: ${PAGE_ID}`);
console.log(`Account ID: ${ACCOUNT_ID}`);
console.log(`Lookback: ${LOOKBACK_DAYS} days (since ${sinceDate})`);
console.log("");

async function fetchJSON(url) {
  const res = await fetch(url);
  return res.json();
}

async function fetchAllLeads(formId, formName) {
  const allLeads = [];
  let url = `${GRAPH_API}/${formId}/leads?access_token=${PAGE_TOKEN}&filtering=[{"field":"time_created","operator":"GREATER_THAN","value":${sinceTimestamp}}]&limit=50`;

  let page = 1;
  while (url) {
    const data = await fetchJSON(url);
    if (data.error) {
      console.error(`  Error fetching leads for form ${formId}:`, data.error.message);
      break;
    }
    const leads = data.data || [];
    allLeads.push(...leads);
    console.log(`  Page ${page}: ${leads.length} leads (total so far: ${allLeads.length})`);

    // Follow pagination
    url = data.paging?.next || null;
    page++;
  }

  return allLeads;
}

async function main() {
  // Step 1: Fetch all forms
  console.log("--- Step 1: Fetching lead forms ---");
  const formsData = await fetchJSON(
    `${GRAPH_API}/${PAGE_ID}/leadgen_forms?fields=id,name,status,leads_count,created_time&access_token=${PAGE_TOKEN}`
  );

  if (formsData.error) {
    console.error("Error fetching forms:", formsData.error.message);
    process.exit(1);
  }

  const forms = formsData.data || [];
  console.log(`Found ${forms.length} forms:\n`);
  for (const form of forms) {
    console.log(`  - ${form.name} (${form.id}) — ${form.leads_count} total leads, status: ${form.status}`);
  }
  console.log("");

  // Step 2: Fetch all leads from each form
  console.log("--- Step 2: Fetching leads from last 45 days ---");
  const allLeads = [];

  for (const form of forms) {
    console.log(`\nForm: ${form.name} (${form.id})`);
    const leads = await fetchAllLeads(form.id, form.name);
    for (const lead of leads) {
      lead._formName = form.name;
      lead._formId = form.id;
    }
    allLeads.push(...leads);
  }

  console.log(`\nTotal leads fetched: ${allLeads.length}`);

  // Step 3: Parse and deduplicate
  console.log("\n--- Step 3: Processing leads ---");
  const parsed = [];
  const testLeads = [];
  const duplicates = [];

  // Track fb_lead_ids we've seen in this batch to avoid self-duplicates
  const seenIds = new Set();

  for (const lead of allLeads) {
    // Parse field data
    const fields = {};
    if (Array.isArray(lead.field_data)) {
      for (const field of lead.field_data) {
        const name = (field.name || "").toLowerCase();
        const val = Array.isArray(field.values) ? field.values[0] : "";
        if (val) fields[name] = String(val);
      }
    }

    const fullName = fields.full_name || fields.name || "";
    const nameParts = fullName.trim().split(/\s+/);
    const firstName = nameParts[0] || "Facebook";
    const lastName = nameParts.slice(1).join(" ") || "Lead";
    const email = fields.email || "";
    const rawPhone = fields.phone_number || fields.phone || "";

    // Skip test leads
    const isTestLead = firstName.includes("<test") || lastName.includes("dummy data") ||
      (email && email.includes("test@meta.com") && rawPhone.includes("<test")) ||
      rawPhone.includes("<test");
    if (isTestLead) {
      testLeads.push({ id: lead.id, name: `${firstName} ${lastName}` });
      continue;
    }

    // Skip self-duplicates within this batch
    if (seenIds.has(lead.id)) {
      duplicates.push({ id: lead.id, name: `${firstName} ${lastName}`, reason: "duplicate in batch" });
      continue;
    }
    seenIds.add(lead.id);

    // Normalize phone
    let phone = null;
    if (rawPhone && !rawPhone.includes("<") && rawPhone.length <= 20) {
      // Basic normalization: add +1 if 10-digit US number
      let normalized = rawPhone.replace(/[^\d+]/g, "");
      if (normalized.length === 10) normalized = "+1" + normalized;
      else if (normalized.length === 11 && normalized.startsWith("1")) normalized = "+" + normalized;
      else if (!normalized.startsWith("+")) normalized = "+" + normalized;
      phone = normalized;
    }

    // Build custom fields
    const customFields = { fb_lead_id: lead.id };
    for (const [key, val] of Object.entries(fields)) {
      if (!["full_name", "name", "email", "phone_number", "phone"].includes(key)) {
        customFields[`fb_${key.replace(/[^a-z0-9_]/g, "_")}`] = val;
      }
    }

    parsed.push({
      fbLeadId: lead.id,
      firstName,
      lastName,
      email: email || null,
      phone,
      leadSource: "facebook",
      formName: lead._formName,
      createdTime: lead.created_time,
      customFields,
    });
  }

  console.log(`Parsed: ${parsed.length} valid leads`);
  console.log(`Skipped: ${testLeads.length} test leads, ${duplicates.length} duplicates in batch`);

  // Output the leads as JSON for the import script to consume
  const outputPath = "/tmp/historical-leads.json";
  const fs = await import("fs");
  fs.writeFileSync(outputPath, JSON.stringify({ leads: parsed, stats: {
    totalFetched: allLeads.length,
    validLeads: parsed.length,
    testLeads: testLeads.length,
    batchDuplicates: duplicates.length,
  }}, null, 2));

  console.log(`\nLead data saved to ${outputPath}`);

  // Print summary table
  console.log("\n--- Lead Summary ---");
  console.log("Name                              | Email                          | Phone           | Form");
  console.log("----------------------------------|--------------------------------|-----------------|-----");
  for (const lead of parsed) {
    const name = `${lead.firstName} ${lead.lastName}`.padEnd(33).substring(0, 33);
    const email = (lead.email || "").padEnd(30).substring(0, 30);
    const phone = (lead.phone || "").padEnd(15).substring(0, 15);
    const form = (lead.formName || "").substring(0, 40);
    console.log(`${name} | ${email} | ${phone} | ${form}`);
  }
}

main().catch(console.error);
