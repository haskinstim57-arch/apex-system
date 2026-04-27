import mysql from "mysql2/promise";

const DB_URL = process.env.DATABASE_URL;
if (!DB_URL) {
  console.error("DATABASE_URL not set");
  process.exit(1);
}

const conn = await mysql.createConnection(DB_URL);

// Find PMR account
const [accounts] = await conn.execute(
  `SELECT id, name, billingEnabled FROM accounts WHERE name LIKE '%Premier%' OR name LIKE '%PMR%'`
);
console.log("=== PMR Accounts BEFORE ===");
console.log(JSON.stringify(accounts, null, 2));

if (accounts.length === 0) {
  console.log("No PMR account found");
  await conn.end();
  process.exit(0);
}

const pmrId = accounts[0].id;

// Set billingEnabled = false
const [result] = await conn.execute(
  `UPDATE accounts SET billingEnabled = false WHERE id = ?`, [pmrId]
);
console.log(`\n=== UPDATE result ===`);
console.log(`Rows affected: ${result.affectedRows}`);

// Verify
const [after] = await conn.execute(
  `SELECT id, name, billingEnabled FROM accounts WHERE id = ?`, [pmrId]
);
console.log(`\n=== PMR Account AFTER ===`);
console.log(JSON.stringify(after, null, 2));

// Also verify balance is still $0.00
const [billing] = await conn.execute(
  `SELECT current_balance FROM account_billing WHERE account_id = ?`, [pmrId]
);
console.log(`\n=== PMR Balance ===`);
console.log(JSON.stringify(billing, null, 2));

await conn.end();
