/**
 * Copy assigned leads from Kyle's account (390025) into
 * Alfonso's account (390024) and Evol's account (390023).
 */
import { ENV } from '../server/_core/env';
import mysql from 'mysql2/promise';

const KYLE_ACCOUNT_ID = 390025;
const ASSIGNMENTS = [
  { userId: 901752, targetAccountId: 390024, name: "Alfonso" },
  { userId: 902504, targetAccountId: 390023, name: "Evol" },
];

const DB_URL = ENV.databaseUrl;
if (!DB_URL) { console.error("DATABASE_URL not set"); process.exit(1); }

const url = new URL(DB_URL);
const dbConfig = {
  host: url.hostname,
  port: parseInt(url.port || '3306'),
  user: url.username,
  password: url.password,
  database: url.pathname.slice(1),
  ssl: { rejectUnauthorized: true },
};

async function main() {
  const conn = await mysql.createConnection(dbConfig);
  console.log("Connected to database");

  for (const assign of ASSIGNMENTS) {
    console.log(`\n=== Copying leads for ${assign.name} ===`);

    // 1. Get all contacts assigned to this user in Kyle's account
    const [sourceRows] = await conn.execute(
      `SELECT id, firstName, lastName, email, phone, leadSource, status,
              company, title, address, city, state, zip, dateOfBirth, customFields
       FROM contacts
       WHERE accountId = ? AND assignedUserId = ?`,
      [KYLE_ACCOUNT_ID, assign.userId]
    ) as any[];

    console.log(`Found ${sourceRows.length} contacts assigned to ${assign.name} in Kyle's account`);
    if (sourceRows.length === 0) continue;

    // 2. Get all tags for these contacts
    const sourceIds = sourceRows.map((r: any) => r.id);
    const [tagRows] = await conn.query(
      `SELECT contactId, tag FROM contact_tags WHERE contactId IN (?)`,
      [sourceIds]
    ) as any[];

    const tagMap = new Map<number, string[]>();
    for (const t of tagRows) {
      if (!tagMap.has(t.contactId)) tagMap.set(t.contactId, []);
      tagMap.get(t.contactId)!.push(t.tag);
    }
    console.log(`Found ${tagRows.length} tags across ${tagMap.size} contacts`);

    // 3. Insert contacts in batches
    const BATCH_SIZE = 100;
    let copiedCount = 0;
    let tagsCopied = 0;

    for (let i = 0; i < sourceRows.length; i += BATCH_SIZE) {
      const batch = sourceRows.slice(i, i + BATCH_SIZE);

      for (const c of batch) {
        // Insert the contact into the target account
        const [insertResult] = await conn.execute(
          `INSERT INTO contacts (accountId, firstName, lastName, email, phone, leadSource, status,
                                 assignedUserId, company, title, address, city, state, zip, dateOfBirth, customFields)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            assign.targetAccountId, c.firstName, c.lastName, c.email, c.phone,
            c.leadSource, c.status, assign.userId, c.company, c.title,
            c.address, c.city, c.state, c.zip, c.dateOfBirth, c.customFields,
          ]
        ) as any;

        const newContactId = insertResult.insertId;

        // Copy tags
        const tags = tagMap.get(c.id) || [];
        if (tags.length > 0) {
          const tagValues = tags.map((tag) => [newContactId, tag]);
          await conn.query(
            `INSERT INTO contact_tags (contactId, tag) VALUES ?`,
            [tagValues]
          );
          tagsCopied += tags.length;
        }

        copiedCount++;
      }

      if (copiedCount % 200 === 0 || copiedCount === sourceRows.length) {
        console.log(`  Copied ${copiedCount}/${sourceRows.length} contacts, ${tagsCopied} tags`);
      }
    }

    console.log(`✓ ${assign.name}: ${copiedCount} contacts copied to account ${assign.targetAccountId}, ${tagsCopied} tags`);
  }

  await conn.end();
  console.log("\n=== Done! ===");
  process.exit(0);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
