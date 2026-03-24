#!/usr/bin/env node
/**
 * Run Historical Import
 *
 * Reads the leads from /tmp/historical-leads.json and imports them
 * into the CRM via the running server's tRPC endpoint.
 *
 * Since we can't easily import the server modules from an .mjs script,
 * we'll call the server's API directly to create contacts.
 *
 * Actually, the simplest approach is to use the Facebook Lead Poller's
 * pollAllPages() but with a wider time window. Let's create a dedicated
 * server endpoint for this.
 *
 * Instead, we'll directly insert into the database using mysql2.
 */

import { readFileSync } from "fs";

const data = JSON.parse(readFileSync("/tmp/historical-leads.json", "utf-8"));
const leads = data.leads;

console.log(`=== Importing ${leads.length} leads into CRM ===\n`);

// We'll call the running server to create contacts
const BASE_URL = "http://localhost:3000";

// First, check which leads already exist by querying the server
let created = 0;
let skipped = 0;
let errors = 0;

for (let i = 0; i < leads.length; i++) {
  const lead = leads[i];
  const progress = `[${i + 1}/${leads.length}]`;

  try {
    // Call internal API to create contact (bypassing auth for server-to-server)
    const res = await fetch(`${BASE_URL}/api/internal/import-lead`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        accountId: 420001,
        firstName: lead.firstName,
        lastName: lead.lastName,
        email: lead.email,
        phone: lead.phone,
        leadSource: lead.leadSource,
        customFields: lead.customFields,
        formName: lead.formName,
        fbLeadId: lead.fbLeadId,
      }),
    });

    const result = await res.json();
    if (result.created) {
      created++;
      console.log(`${progress} ✓ Created: ${lead.firstName} ${lead.lastName} (${lead.email || "no email"})`);
    } else if (result.skipped) {
      skipped++;
      if (i < 15) console.log(`${progress} ○ Skipped (exists): ${lead.firstName} ${lead.lastName}`);
    } else {
      errors++;
      console.log(`${progress} ✗ Error: ${lead.firstName} ${lead.lastName} — ${result.error || "unknown"}`);
    }
  } catch (err) {
    errors++;
    console.log(`${progress} ✗ Network error: ${lead.firstName} ${lead.lastName} — ${err.message}`);
  }

  // Small delay to avoid overwhelming the server
  if (i % 10 === 9) await new Promise((r) => setTimeout(r, 200));
}

console.log(`\n=== Import Complete ===`);
console.log(`Created: ${created}`);
console.log(`Skipped (already exist): ${skipped}`);
console.log(`Errors: ${errors}`);
console.log(`Total processed: ${leads.length}`);
