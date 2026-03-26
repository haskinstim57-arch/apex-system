/**
 * Setup Outbound Sales Engine for "Apex System" sub-account (ID: 450002)
 */
import fs from "fs";

const BASE_URL = "http://localhost:3000";
const ACCOUNT_ID = 450002;
const OWNER_USER_ID = 1110566;

function normalizePhone(phone) {
  if (!phone) return null;
  let cleaned = phone.replace(/[^0-9+]/g, "");
  if (cleaned.startsWith("+1")) return cleaned;
  if (cleaned.startsWith("1") && cleaned.length === 11) return "+" + cleaned;
  if (cleaned.length === 10) return "+1" + cleaned;
  if (cleaned.startsWith("+")) return cleaned;
  return null;
}

function parseCSVFile(filePath) {
  const content = fs.readFileSync(filePath, "utf-8");
  const lines = content.split("\n").filter(l => l.trim());
  if (lines.length === 0) return [];
  
  function parseLine(line) {
    const fields = [];
    let current = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuotes && line[i + 1] === '"') { current += '"'; i++; }
        else inQuotes = !inQuotes;
      } else if (ch === ',' && !inQuotes) {
        fields.push(current); current = "";
      } else {
        current += ch;
      }
    }
    fields.push(current);
    return fields.map(f => f.trim());
  }

  const headers = parseLine(lines[0]);
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const fields = parseLine(lines[i]);
    const obj = {};
    for (let j = 0; j < headers.length; j++) {
      obj[headers[j]] = fields[j] || "";
    }
    rows.push(obj);
  }
  return rows;
}

async function callEndpoint(action, data) {
  const res = await fetch(`${BASE_URL}/api/internal/setup-outbound`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action, ...data }),
  });
  return res.json();
}

// ═══ STEP 1: Import Leads ═══
async function importLeads() {
  console.log("\n═══ STEP 1: Importing 100 Leads from CSV ═══\n");
  const records = parseCSVFile("/home/ubuntu/upload/Apex_System_100_Leads_Import_Ready.csv");
  console.log(`Found ${records.length} rows in CSV\n`);

  let created = 0, skipped = 0, errors = 0;
  for (let i = 0; i < records.length; i++) {
    const row = records[i];
    const phone = normalizePhone(row.phone);
    const email = row.email?.trim() || null;
    const firstName = row.first_name?.trim() || "Business";
    const lastName = row.last_name?.trim() || "Owner";
    try {
      const result = await callEndpoint("import_contact", {
        accountId: ACCOUNT_ID, userId: OWNER_USER_ID,
        firstName, lastName,
        email: email || undefined, phone: phone || undefined,
        company: row.company?.trim() || undefined,
        city: row.city?.trim() || undefined,
        state: row.state?.trim() || undefined,
        website: row.website?.trim() || undefined,
        leadSource: "csv_import",
        tags: row.tags?.trim() || undefined,
        notes: row.notes?.trim() || undefined,
      });
      if (result.created) {
        created++;
        console.log(`[${i+1}/${records.length}] ✓ ${firstName} ${lastName} | ${email || "no email"} | ${phone || "no phone"}`);
      } else if (result.skipped) {
        skipped++;
        console.log(`[${i+1}/${records.length}] ○ Skipped: ${firstName} ${lastName} - ${result.reason}`);
      } else {
        errors++;
        console.log(`[${i+1}/${records.length}] ✗ ${firstName} ${lastName} - ${JSON.stringify(result)}`);
      }
    } catch (err) {
      errors++;
      console.log(`[${i+1}/${records.length}] ✗ ${firstName} ${lastName} - ${err.message}`);
    }
    if (i % 10 === 9) await new Promise(r => setTimeout(r, 300));
  }
  console.log(`\n=== Step 1 Done: Created ${created} | Skipped ${skipped} | Errors ${errors} ===`);
  return { created, skipped, errors, total: records.length };
}

// ═══ STEP 2: Email Campaign ═══
async function createEmailCampaign() {
  console.log("\n═══ STEP 2: Creating Email Campaign (4 steps) ═══\n");
  const steps = [
    { stepNum: 1, dayOffset: 1, subject: "Quick question about your lead follow-up",
      body: `Hi {{first_name}},\n\nI was looking at {{company_name}} today and noticed you are actively running ads to generate leads.\n\nQuick question: Are you currently using an automated system to text and call those leads within the first 5 minutes of them opting in?\n\nThe reason I ask is that we built a system specifically for businesses like yours that automates immediate follow-up (SMS, Email, and AI Voice) and includes a built-in Power Dialer for your team.\n\nMost of our clients were paying for 5 different tools before switching to us, and they are seeing their contact rates double just by automating the first 5 minutes.\n\nAre you open to a quick 10-minute walkthrough this week to see how it works?\n\nBest,\nTariq\nFounder, Apex System` },
    { stepNum: 2, dayOffset: 3, subject: "Missed calls = missed revenue",
      body: `Hi {{first_name}},\n\nFollowing up on my last note. One of the biggest complaints I hear from business owners in your industry is that they are paying for a CRM, a separate dialer, an email sender, and a calendar tool—and none of them talk to each other perfectly.\n\nWhen leads fall through the cracks, it is usually because the software stack is too complicated or the team is too busy to manually dial.\n\nApex System replaces all of that. We give you:\n\n• A built-in Power Dialer (no more manual dialing)\n• Automated missed-call text-back (never lose a lead who calls while you are busy)\n• A unified inbox for SMS, Email, and Facebook messages\n\nIf you have 10 minutes tomorrow, I would love to show you the Power Dialer in action. Let me know if you are free.\n\nBest,\nTariq` },
    { stepNum: 3, dayOffset: 6, subject: "We build it for you, {{first_name}}",
      body: `Hi {{first_name}},\n\nI know you are busy running {{company_name}}, so I will keep this brief.\n\nThe main reason people hesitate to switch CRMs is the setup time. Nobody wants to spend 40 hours importing contacts and building email templates.\n\nThat is why we offer a completely "Done-For-You" package. For a flat monthly rate, my team will:\n\n1. Import all your contacts.\n2. Build your sales pipelines.\n3. Set up your automated text and email sequences.\n4. Integrate your lead sources.\n\nYou just log in and start calling leads from the Power Dialer.\n\nDo you have time on Thursday for a quick demo to see if this makes sense for your team?\n\nBest,\nTariq` },
    { stepNum: 4, dayOffset: 10, subject: "Closing the loop",
      body: `Hi {{first_name}},\n\nI have reached out a few times about automating your lead follow-up with Apex System, but I have not heard back.\n\nUsually, this means one of two things:\n\n1. You are already closing 100% of your leads and your current software stack is perfect.\n2. You are just swamped right now.\n\nIf it is the latter, no worries at all. I will stop clogging up your inbox.\n\nIf you ever want to stop manually dialing leads and consolidate your software into one platform, feel free to reach out.\n\nWishing you the best with {{company_name}}!\n\nBest,\nTariq` },
  ];
  const result = await callEndpoint("create_email_campaign", {
    accountId: ACCOUNT_ID, userId: OWNER_USER_ID,
    campaignName: "Apex Cold Outreach — Email",
    fromAddress: "apexsystemaii@gmail.com",
    steps,
  });
  console.log("Email campaign:", JSON.stringify(result, null, 2));
  return result;
}

// ═══ STEP 3: SMS Campaign ═══
async function createSmsCampaign() {
  console.log("\n═══ STEP 3: Creating SMS Campaign (4 steps) ═══\n");
  const steps = [
    { stepNum: 1, dayOffset: 1, sendTime: "10:00",
      body: `Hey {{first_name}}, it's Tariq. Quick question about {{company_name}} — are you guys currently using an automated system to text your new leads within the first 5 minutes of them opting in?` },
    { stepNum: 2, dayOffset: 2, sendTime: "14:00",
      body: `Hey {{first_name}}, following up on my text yesterday. We just had a client put $300 into ads, and because our system texted their leads instantly, they closed $20k in profit. Are you open to a quick 10-min walkthrough this week to see how it works?` },
    { stepNum: 3, dayOffset: 4, sendTime: "11:30",
      body: `Most of the owners I talk to are paying for 4 different tools (CRM, dialer, email, calendar) and none of them talk to each other perfectly. We built an all-in-one system that replaces all of that. Do you have 10 mins tomorrow to see the Power Dialer in action?` },
    { stepNum: 4, dayOffset: 7, sendTime: "15:00",
      body: `Hey {{first_name}}, I'll stop bugging you after this! If you ever want to stop manually dialing leads and consolidate your software into one platform, let me know. Have a great week!` },
  ];
  const result = await callEndpoint("create_sms_campaign", {
    accountId: ACCOUNT_ID, userId: OWNER_USER_ID,
    campaignName: "Apex Cold Outreach — SMS",
    steps,
  });
  console.log("SMS campaign:", JSON.stringify(result, null, 2));
  return result;
}

// ═══ STEP 4: Phone Script ═══
async function loadPhoneScript() {
  console.log("\n═══ STEP 4: Loading Phone Script ═══\n");
  const content = fs.readFileSync("/home/ubuntu/upload/phone_script_extracted.txt", "utf-8");
  const result = await callEndpoint("create_dialer_script", {
    accountId: ACCOUNT_ID, userId: OWNER_USER_ID,
    name: "Apex Cold Call Script",
    content,
  });
  console.log("Phone script:", JSON.stringify(result, null, 2));
  return result;
}

// ═══ MAIN ═══
async function main() {
  console.log("╔══════════════════════════════════════════════════╗");
  console.log("║  APEX SYSTEM — Outbound Sales Engine Setup      ║");
  console.log("╚══════════════════════════════════════════════════╝");

  const s1 = await importLeads();
  const s2 = await createEmailCampaign();
  const s3 = await createSmsCampaign();
  const s4 = await loadPhoneScript();

  console.log("\n╔══════════════════════════════════════════════════╗");
  console.log("║  SETUP COMPLETE                                 ║");
  console.log("╚══════════════════════════════════════════════════╝");
  console.log(`1. Contacts: ${s1.created} created, ${s1.skipped} skipped, ${s1.errors} errors`);
  console.log(`2. Email: ${s2.success ? "✓" : "✗"} — 4 steps (DRAFT)`);
  console.log(`3. SMS: ${s3.success ? "✓" : "✗"} — 4 steps (DRAFT)`);
  console.log(`4. Script: ${s4.success ? "✓" : "✗"} — "Apex Cold Call Script"`);
}

main().catch(console.error);
