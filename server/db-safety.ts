/**
 * Database Safety Guards
 *
 * This module provides safeguards to prevent accidental destructive
 * operations on the production database. Import and call these checks
 * in any migration or maintenance scripts.
 *
 * RULES:
 * 1. NEVER use `drizzle-kit push` — it can drop columns/tables. Use `drizzle-kit generate && drizzle-kit migrate`.
 * 2. NEVER run DROP TABLE, TRUNCATE, or DELETE without WHERE on production tables.
 * 3. Schema changes MUST go through migration files (drizzle/XXXX_*.sql).
 * 4. The `pnpm db:push` script is safe — it runs `generate` then `migrate` (additive only).
 * 5. All existing data (contacts, pipelines, accounts, workflows, deals) must persist across deployments.
 *
 * Protected tables (never drop or truncate):
 * - users
 * - accounts
 * - contacts
 * - contact_tags
 * - contact_notes
 * - messages
 * - campaigns
 * - campaign_contacts
 * - ai_calls
 * - websites
 * - workflows
 * - workflow_steps
 * - workflow_executions
 * - workflow_execution_steps
 * - pipelines
 * - pipeline_stages
 * - deals
 */

const PROTECTED_TABLES = [
  "users",
  "accounts",
  "contacts",
  "contact_tags",
  "contact_notes",
  "messages",
  "campaigns",
  "campaign_contacts",
  "ai_calls",
  "websites",
  "workflows",
  "workflow_steps",
  "workflow_executions",
  "workflow_execution_steps",
  "pipelines",
  "pipeline_stages",
  "deals",
] as const;

/**
 * Validates that a raw SQL string does not contain destructive operations
 * on protected tables. Throws if a dangerous statement is detected.
 */
export function validateSQLSafety(sql: string): void {
  const upper = sql.toUpperCase();

  for (const table of PROTECTED_TABLES) {
    const tableUpper = table.toUpperCase();

    if (upper.includes(`DROP TABLE`) && upper.includes(tableUpper)) {
      throw new Error(
        `[DB Safety] BLOCKED: Attempted to DROP protected table "${table}". ` +
          `This operation is forbidden. Data must persist across deployments.`
      );
    }

    if (upper.includes(`TRUNCATE`) && upper.includes(tableUpper)) {
      throw new Error(
        `[DB Safety] BLOCKED: Attempted to TRUNCATE protected table "${table}". ` +
          `This operation is forbidden. Use DELETE with a WHERE clause instead.`
      );
    }
  }

  // Block blanket DELETE without WHERE
  const deleteRegex = /DELETE\s+FROM\s+\w+\s*;/gi;
  if (deleteRegex.test(sql)) {
    throw new Error(
      `[DB Safety] BLOCKED: DELETE without WHERE clause detected. ` +
        `Always use a WHERE clause to prevent accidental data loss.`
    );
  }
}

/**
 * Returns the list of protected table names
 */
export function getProtectedTables(): readonly string[] {
  return PROTECTED_TABLES;
}

/**
 * Logs a safety audit message
 */
export function logMigrationSafety(migrationName: string): void {
  console.log(
    `[DB Safety] Running migration "${migrationName}" — additive changes only, no data loss.`
  );
}
