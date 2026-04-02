/**
 * Fix migration gap: migrations 0067-0076 need to be applied but some tables
 * (like jarvis_sessions) already exist in the DB. This script:
 * 1. For each pending migration, tries to execute the SQL
 * 2. If a table already exists, catches the error and continues
 * 3. Records the migration as applied in __drizzle_migrations
 */
import mysql from "mysql2/promise";
import fs from "fs";
import path from "path";
import crypto from "crypto";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("DATABASE_URL not set");
  process.exit(1);
}

const MIGRATIONS_DIR = path.resolve(import.meta.dirname, "../drizzle");

// Read the journal to get pending migrations
const journal = JSON.parse(
  fs.readFileSync(path.join(MIGRATIONS_DIR, "meta/_journal.json"), "utf-8")
);

async function main() {
  const conn = await mysql.createConnection(DATABASE_URL);

  // Get already-applied migration count
  const [applied] = await conn.query(
    "SELECT hash FROM __drizzle_migrations ORDER BY created_at"
  );
  const appliedCount = applied.length;
  console.log(`Already applied: ${appliedCount} migrations`);

  const pendingEntries = journal.entries.filter((e) => e.idx >= appliedCount);
  console.log(`Pending: ${pendingEntries.length} migrations`);

  for (const entry of pendingEntries) {
    const sqlFile = path.join(MIGRATIONS_DIR, `${entry.tag}.sql`);
    if (!fs.existsSync(sqlFile)) {
      console.error(`Migration file not found: ${sqlFile}`);
      continue;
    }

    const sql = fs.readFileSync(sqlFile, "utf-8").trim();
    const hash = crypto.createHash("sha256").update(sql).digest("hex");

    console.log(`\nApplying migration ${entry.idx}: ${entry.tag}`);

    // Split by statement (drizzle uses single statements per migration usually)
    const statements = sql
      .split(/;\s*\n/)
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    let allSuccess = true;
    for (const stmt of statements) {
      try {
        await conn.query(stmt);
        console.log(`  ✓ Executed: ${stmt.substring(0, 80)}...`);
      } catch (err) {
        if (err.code === "ER_TABLE_EXISTS_ERROR") {
          console.log(`  ⚠ Table already exists, skipping: ${stmt.substring(0, 60)}...`);
        } else if (err.code === "ER_DUP_FIELDNAME") {
          console.log(`  ⚠ Column already exists, skipping: ${stmt.substring(0, 60)}...`);
        } else if (err.code === "ER_DUP_KEYNAME") {
          console.log(`  ⚠ Index already exists, skipping: ${stmt.substring(0, 60)}...`);
        } else {
          console.error(`  ✗ Error: ${err.message}`);
          allSuccess = false;
        }
      }
    }

    // Record migration as applied
    await conn.query(
      "INSERT INTO __drizzle_migrations (hash, created_at) VALUES (?, ?)",
      [hash, Date.now()]
    );
    console.log(`  ✓ Recorded migration ${entry.idx} as applied`);
  }

  // Verify final count
  const [finalApplied] = await conn.query(
    "SELECT COUNT(*) as cnt FROM __drizzle_migrations"
  );
  console.log(`\nTotal applied migrations: ${finalApplied[0].cnt}`);

  await conn.end();
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
