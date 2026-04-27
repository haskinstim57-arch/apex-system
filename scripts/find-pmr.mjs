import { sql } from "drizzle-orm";

const DB_URL = process.env.DATABASE_URL;
if (!DB_URL) {
  console.error("DATABASE_URL not set");
  process.exit(1);
}

import mysql from "mysql2/promise";

const conn = await mysql.createConnection(DB_URL);

const [accounts] = await conn.execute(
  `SELECT id, name FROM accounts WHERE name LIKE '%Premier%' OR name LIKE '%PMR%'`
);
console.log("=== PMR Accounts ===");
console.log(JSON.stringify(accounts, null, 2));

if (accounts.length > 0) {
  const ids = accounts.map(a => a.id);
  for (const id of ids) {
    const [billing] = await conn.execute(
      `SELECT * FROM accountBilling WHERE accountId = ?`, [id]
    );
    console.log(`\n=== Billing for accountId=${id} ===`);
    console.log(JSON.stringify(billing, null, 2));
  }
}

await conn.end();
