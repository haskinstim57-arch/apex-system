/**
 * One-time backfill: Promote contacts from new/uncontacted → contacted
 * if they have at least one outbound message in the messages table.
 *
 * Safe to run multiple times — the WHERE clause ensures only
 * new/uncontacted contacts are updated.
 */
import mysql from "mysql2/promise";

const DB_URL = process.env.DATABASE_URL;
if (!DB_URL) {
  console.error("DATABASE_URL not set");
  process.exit(1);
}

const conn = await mysql.createConnection(DB_URL);

// Count before
const [before] = await conn.execute(
  `SELECT status, COUNT(*) as cnt FROM contacts WHERE status IN ('new', 'uncontacted') GROUP BY status`
);
console.log("=== BEFORE backfill ===");
console.log("Contacts still in new/uncontacted:", JSON.stringify(before));

// Run the backfill
const [result] = await conn.execute(`
  UPDATE contacts c
  INNER JOIN (
    SELECT DISTINCT contactId FROM messages WHERE direction = 'outbound'
  ) m ON c.id = m.contactId
  SET c.status = 'contacted'
  WHERE c.status IN ('new', 'uncontacted')
`);

console.log(`\n=== BACKFILL RESULT ===`);
console.log(`Rows updated: ${result.affectedRows}`);
console.log(`Changed rows: ${result.changedRows}`);

// Count after
const [after] = await conn.execute(
  `SELECT status, COUNT(*) as cnt FROM contacts WHERE status IN ('new', 'uncontacted') GROUP BY status`
);
console.log(`\n=== AFTER backfill ===`);
console.log("Contacts still in new/uncontacted:", JSON.stringify(after));

// Show how many are now contacted
const [contacted] = await conn.execute(
  `SELECT COUNT(*) as cnt FROM contacts WHERE status = 'contacted'`
);
console.log("Total contacts with 'contacted' status:", contacted[0].cnt);

await conn.end();
console.log("\nBackfill complete.");
