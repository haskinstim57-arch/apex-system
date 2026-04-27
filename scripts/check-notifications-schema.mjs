import mysql from "mysql2/promise";
import dotenv from "dotenv";
dotenv.config();

const conn = await mysql.createConnection(process.env.DATABASE_URL);
const [rows] = await conn.execute("DESCRIBE notifications");
console.log("=== notifications table columns ===");
for (const row of rows) {
  console.log(`${row.Field}: type=${row.Type}, null=${row.Null}, key=${row.Key}, default=${row.Default}`);
}
await conn.end();
