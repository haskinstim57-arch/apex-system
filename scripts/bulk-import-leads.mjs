import fs from 'fs';
import { parse } from 'csv-parse/sync';
import mysql from 'mysql2/promise';

// ─── Config ───
const ACCOUNT_ID = 390025; // Kyle's account
const ALFONSO_USER_ID = 901752;
const EVOL_USER_ID = 902504;
const LEADS_PER_EMPLOYEE = 750;

const DB_URL = process.env.DATABASE_URL;
if (!DB_URL) {
  console.error("DATABASE_URL not set");
  process.exit(1);
}

// Parse DATABASE_URL
const url = new URL(DB_URL);
const dbConfig = {
  host: url.hostname,
  port: parseInt(url.port) || 3306,
  user: url.username,
  password: url.password,
  database: url.pathname.slice(1),
  ssl: { rejectUnauthorized: true },
  connectTimeout: 30000,
};

// ─── Parse CSV ───
function parseCSV(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  return parse(content, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
    relax_column_count: true,
  });
}

// ─── Normalize phone to E.164 ───
function normalizePhone(raw) {
  if (!raw) return null;
  const first = raw.split(',')[0].trim();
  const digits = first.replace(/\D/g, '');
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`;
  if (digits.length > 10) return `+${digits}`;
  return null;
}

// ─── Main ───
async function main() {
  console.log("Connecting to database...");
  const conn = await mysql.createConnection(dbConfig);
  console.log("Connected.");

  // Parse both CSV files
  console.log("\nParsing Broward County CSV...");
  const broward = parseCSV('/home/ubuntu/upload/BrowardCountyMultifamily.csv');
  console.log(`  → ${broward.length} rows`);

  console.log("Parsing Palm Beach County CSV...");
  const palmBeach = parseCSV('/home/ubuntu/upload/Palmbeachcountymultifamily.csv');
  console.log(`  → ${palmBeach.length} rows`);

  const allRows = [...broward, ...palmBeach];
  console.log(`\nTotal rows to import: ${allRows.length}`);

  // Check existing contacts to avoid duplicates
  const [existingContacts] = await conn.execute(
    'SELECT email, phone FROM contacts WHERE accountId = ?',
    [ACCOUNT_ID]
  );
  const existingEmails = new Set();
  const existingPhones = new Set();
  for (const c of existingContacts) {
    if (c.email) existingEmails.add(c.email.toLowerCase());
    if (c.phone) existingPhones.add(c.phone);
  }
  console.log(`Existing contacts in Kyle's account: ${existingContacts.length}`);

  // Prepare contacts
  let imported = 0;
  let skipped = 0;
  let failed = 0;
  const importedIds = [];
  const importedSources = []; // Track county for tagging
  const BATCH_SIZE = 100;
  let batch = [];
  let batchSources = [];

  async function flushBatch() {
    if (batch.length === 0) return;
    const placeholders = batch.map(() => '(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').join(',');
    const values = batch.flat();
    try {
      const [result] = await conn.execute(
        `INSERT INTO contacts (accountId, firstName, lastName, email, phone, leadSource, status, address, city, state, zip) VALUES ${placeholders}`,
        values
      );
      const firstId = result.insertId;
      for (let i = 0; i < batch.length; i++) {
        importedIds.push(firstId + i);
        importedSources.push(batchSources[i]);
      }
      imported += batch.length;
    } catch (err) {
      console.error(`Batch insert error: ${err.message}`);
      failed += batch.length;
    }
    batch = [];
    batchSources = [];
  }

  // Track within-import duplicates by email
  const seenEmails = new Set();
  const seenPhones = new Set();

  for (let i = 0; i < allRows.length; i++) {
    const row = allRows[i];
    const firstName = (row['Owner 1 First Name'] || '').trim();
    const lastName = (row['Owner 1 Last Name'] || '').trim();
    const rawEmail = (row['Email'] || '').split(',')[0].trim().toLowerCase();
    const email = rawEmail || null;
    const mobile = (row['Mobile'] || '').trim();
    const landline = (row['Landline'] || '').trim();
    const phone = normalizePhone(mobile) || normalizePhone(landline);
    const address = (row['Address'] || '').trim();
    const city = (row['City'] || '').trim();
    const state = (row['State'] || '').trim();
    const zip = (row['Zip'] || '').trim();
    const county = (row['County'] || '').trim();

    // Skip if no identifying info
    if (!firstName && !lastName && !phone && !email) {
      skipped++;
      continue;
    }

    // Skip duplicates by email (existing + within-import)
    if (email && (existingEmails.has(email) || seenEmails.has(email))) {
      skipped++;
      continue;
    }
    // Skip duplicates by phone (existing + within-import)
    if (phone && (existingPhones.has(phone) || seenPhones.has(phone))) {
      skipped++;
      continue;
    }

    if (email) seenEmails.add(email);
    if (phone) seenPhones.add(phone);

    const leadSource = county ? `${county} County Multifamily` : 'CSV Import';

    batch.push([
      ACCOUNT_ID,
      firstName || 'Unknown',
      lastName || '',
      email,
      phone,
      leadSource,
      'new',
      address || null,
      city || null,
      state || null,
      zip || null,
    ]);
    batchSources.push(county || 'Unknown');

    if (batch.length >= BATCH_SIZE) {
      await flushBatch();
      if (imported % 1000 === 0 && imported > 0) {
        console.log(`  Progress: ${imported} imported, ${skipped} skipped, ${failed} failed`);
      }
    }
  }
  await flushBatch();

  console.log(`\n=== Import Complete ===`);
  console.log(`  Imported: ${imported}`);
  console.log(`  Skipped: ${skipped}`);
  console.log(`  Failed: ${failed}`);
  console.log(`  Total IDs: ${importedIds.length}`);

  // ─── Add tags ───
  console.log("\nAdding tags...");
  let tagCount = 0;
  const TAG_BATCH = 200;
  let tagValues = [];

  async function flushTags() {
    if (tagValues.length === 0) return;
    const ph = tagValues.map(() => '(?, ?)').join(',');
    await conn.execute(`INSERT INTO contact_tags (contactId, tag) VALUES ${ph}`, tagValues.flat());
    tagCount += tagValues.length;
    tagValues = [];
  }

  for (let i = 0; i < importedIds.length; i++) {
    const id = importedIds[i];
    const county = importedSources[i];
    
    // County tag
    tagValues.push([id, county === 'Broward' ? 'Broward County' : 'Palm Beach County']);
    // Property type tag
    tagValues.push([id, 'multifamily']);

    if (tagValues.length >= TAG_BATCH) {
      await flushTags();
    }
  }
  await flushTags();
  console.log(`  Tagged: ${tagCount} tag entries`);

  // ─── Assign 750 to Alfonso and 750 to Evol ───
  console.log("\nAssigning leads...");

  // First 750 to Alfonso
  const alfonsoIds = importedIds.slice(0, LEADS_PER_EMPLOYEE);
  for (let i = 0; i < alfonsoIds.length; i += 500) {
    const chunk = alfonsoIds.slice(i, i + 500);
    const ph = chunk.map(() => '?').join(',');
    await conn.execute(
      `UPDATE contacts SET assignedUserId = ? WHERE id IN (${ph}) AND accountId = ?`,
      [ALFONSO_USER_ID, ...chunk, ACCOUNT_ID]
    );
  }
  console.log(`  Alfonso: ${alfonsoIds.length} leads assigned`);

  // Next 750 to Evol
  const evolIds = importedIds.slice(LEADS_PER_EMPLOYEE, LEADS_PER_EMPLOYEE * 2);
  for (let i = 0; i < evolIds.length; i += 500) {
    const chunk = evolIds.slice(i, i + 500);
    const ph = chunk.map(() => '?').join(',');
    await conn.execute(
      `UPDATE contacts SET assignedUserId = ? WHERE id IN (${ph}) AND accountId = ?`,
      [EVOL_USER_ID, ...chunk, ACCOUNT_ID]
    );
  }
  console.log(`  Evol: ${evolIds.length} leads assigned`);

  const unassigned = importedIds.length - alfonsoIds.length - evolIds.length;
  console.log(`  Unassigned: ${unassigned}`);

  // ─── Final Summary ───
  console.log("\n════════════════════════════════════");
  console.log("  FINAL SUMMARY");
  console.log("════════════════════════════════════");
  console.log(`  Account: Kyle (ID: ${ACCOUNT_ID})`);
  console.log(`  Total imported: ${imported}`);
  console.log(`  Alfonso Parra Lenis: ${alfonsoIds.length} leads`);
  console.log(`  Evol Hosang: ${evolIds.length} leads`);
  console.log(`  Unassigned: ${unassigned}`);
  console.log("════════════════════════════════════");

  await conn.end();
  console.log("\nDone!");
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
