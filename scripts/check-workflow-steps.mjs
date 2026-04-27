import mysql from "mysql2/promise";
import dotenv from "dotenv";
dotenv.config();

const conn = await mysql.createConnection(process.env.DATABASE_URL);
const [rows] = await conn.execute("SELECT * FROM workflow_steps WHERE workflowId = 870045 ORDER BY stepOrder");
for (const r of rows) {
  console.log(`Step ${r.step_order}: action=${r.action_type}, config=${r.config}`);
}
await conn.end();
