import mysql from "mysql2/promise";

async function run() {
  const conn = await mysql.createConnection(process.env.DATABASE_URL as string);
  await conn.execute(`
    CREATE TABLE IF NOT EXISTS lead_routing_rules (
      id INT AUTO_INCREMENT PRIMARY KEY,
      accountId INT NOT NULL,
      name VARCHAR(255) NOT NULL,
      strategy ENUM('round_robin', 'capacity_based', 'specific_user') NOT NULL DEFAULT 'round_robin',
      assigneeIds TEXT NOT NULL,
      isActive BOOLEAN NOT NULL DEFAULT TRUE,
      priority INT NOT NULL DEFAULT 0,
      conditions TEXT,
      roundRobinIndex INT NOT NULL DEFAULT 0,
      maxLeadsPerUser INT NOT NULL DEFAULT 0,
      applyToCsvImport BOOLEAN NOT NULL DEFAULT TRUE,
      applyToFacebookLeads BOOLEAN NOT NULL DEFAULT TRUE,
      applyToManualCreate BOOLEAN NOT NULL DEFAULT FALSE,
      createdById INT NOT NULL,
      createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_routing_account (accountId),
      INDEX idx_routing_active (accountId, isActive)
    )
  `);
  console.log("lead_routing_rules table created successfully");
  await conn.end();
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
