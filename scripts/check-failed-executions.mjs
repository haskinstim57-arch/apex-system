import mysql from "mysql2/promise";
import dotenv from "dotenv";
dotenv.config();

const conn = await mysql.createConnection(process.env.DATABASE_URL);

// Check executions #1230002 and #1230004
for (const id of [1230002, 1230004]) {
  const [rows] = await conn.execute("SELECT * FROM workflow_executions WHERE id = ?", [id]);
  if (rows.length > 0) {
    const exec = rows[0];
    console.log(`\n=== Execution #${id} ===`);
    console.log(`Status: ${exec.status}`);
    console.log(`Error: ${exec.error_message || exec.errorMessage}`);
    console.log(`Workflow ID: ${exec.workflow_id || exec.workflowId}`);
    console.log(`Contact ID: ${exec.contact_id || exec.contactId}`);
    console.log(`Account ID: ${exec.account_id || exec.accountId}`);
    
    // Check the execution steps
    const [steps] = await conn.execute(
      "SELECT * FROM workflow_execution_steps WHERE execution_id = ? ORDER BY step_order",
      [id]
    );
    for (const step of steps) {
      console.log(`  Step ${step.step_order}: status=${step.status}, action=${step.action_type || step.actionType}, error=${step.error_message || step.errorMessage || 'none'}`);
    }
  } else {
    console.log(`Execution #${id} not found`);
  }
}

// Also check the workflow steps for the workflow that failed
const [execs] = await conn.execute("SELECT DISTINCT workflow_id FROM workflow_executions WHERE id IN (1230002, 1230004)");
for (const exec of execs) {
  const wfId = exec.workflow_id || exec.workflowId;
  console.log(`\n=== Workflow #${wfId} Steps ===`);
  const [steps] = await conn.execute("SELECT * FROM workflow_steps WHERE workflow_id = ? ORDER BY step_order", [wfId]);
  for (const step of steps) {
    console.log(`  Step ${step.step_order}: type=${step.action_type || step.actionType}, config=${step.config}`);
  }
}

await conn.end();
