import mysql from "mysql2/promise";

const DB_URL = process.env.DATABASE_URL;
if (!DB_URL) {
  console.error("DATABASE_URL not set");
  process.exit(1);
}

const conn = await mysql.createConnection(DB_URL);

// Find PMR account
const [accounts] = await conn.execute(
  `SELECT id, name FROM accounts WHERE name LIKE '%Premier%' OR name LIKE '%PMR%'`
);
console.log("=== PMR Accounts ===");
console.log(JSON.stringify(accounts, null, 2));

if (accounts.length === 0) {
  console.log("No PMR account found");
  await conn.end();
  process.exit(0);
}

const pmrId = accounts[0].id;

// Show current billing
const [billingBefore] = await conn.execute(
  `SELECT id, account_id, current_balance FROM account_billing WHERE account_id = ?`, [pmrId]
);
console.log(`\n=== Billing BEFORE (accountId=${pmrId}) ===`);
console.log(JSON.stringify(billingBefore, null, 2));

// Clear balance to $0.00
const [result] = await conn.execute(
  `UPDATE account_billing SET current_balance = 0.0000 WHERE account_id = ?`, [pmrId]
);
console.log(`\n=== UPDATE result ===`);
console.log(`Rows affected: ${result.affectedRows}`);

// Verify
const [billingAfter] = await conn.execute(
  `SELECT id, account_id, current_balance FROM account_billing WHERE account_id = ?`, [pmrId]
);
console.log(`\n=== Billing AFTER ===`);
console.log(JSON.stringify(billingAfter, null, 2));

await conn.end();
