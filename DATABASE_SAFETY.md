# Database Safety & Persistence Policy

## Core Principle

All data must persist across deployments. No build script, migration, or deployment hook may drop, truncate, or reset any table.

## Migration Strategy

Apex System uses **Drizzle ORM** with an **additive-only migration** workflow:

| Command | What It Does | Safe? |
|---|---|---|
| `pnpm db:push` | Runs `drizzle-kit generate && drizzle-kit migrate` — generates a new SQL migration file from schema diff, then applies only unapplied migrations | Yes |
| `drizzle-kit generate` | Compares `drizzle/schema.ts` to the last snapshot and creates a new `.sql` migration file | Yes |
| `drizzle-kit migrate` | Applies only new/unapplied migration files to the database | Yes |
| `drizzle-kit push` | Directly syncs schema to DB, may DROP columns/tables | **NEVER USE** |
| `drizzle-kit drop` | Drops migration history | **NEVER USE** |

## Protected Tables

The following tables must never be dropped, truncated, or bulk-deleted without a WHERE clause:

- `users` — Platform user accounts
- `accounts` — Client sub-accounts
- `contacts` — Core CRM contact records
- `contact_tags` — Contact tag associations
- `contact_notes` — Contact notes and activity
- `messages` — SMS and email message history
- `campaigns` — Email/SMS campaign records
- `campaign_contacts` — Campaign enrollment records
- `ai_calls` — VAPI AI call history
- `websites` — Website builder records
- `workflows` — Automation workflow definitions
- `workflow_steps` — Workflow step configurations
- `workflow_executions` — Workflow execution history
- `workflow_execution_steps` — Individual step execution records
- `pipelines` — Pipeline definitions
- `pipeline_stages` — Pipeline stage definitions
- `deals` — Deal/opportunity records

## Build Scripts Audit

| Script | Command | Destructive? |
|---|---|---|
| `dev` | `tsx watch server/_core/index.ts` | No |
| `build` | `vite build && esbuild ...` | No |
| `start` | `node dist/index.js` | No |
| `db:push` | `drizzle-kit generate && drizzle-kit migrate` | No |
| `test` | `vitest run` | No |

There are no `prestart`, `prebuild`, `postinstall`, or `predeploy` hooks that touch the database.

## Server Startup

The server (`server/_core/index.ts`) does **not** run any automatic migrations, schema syncs, or table creation on boot. Database schema changes are applied manually via `pnpm db:push` only.

## Rules for Future Development

1. **Schema changes** must be made in `drizzle/schema.ts` and applied via `pnpm db:push`.
2. **Never** use `drizzle-kit push` (without generate) — it can drop columns.
3. **Never** add `DROP TABLE` or `TRUNCATE` to migration files.
4. **Never** add database reset logic to build scripts or server startup.
5. **Always** test migrations on a development branch before applying to production.
6. **Import `validateSQLSafety`** from `server/db-safety.ts` when writing any raw SQL execution logic.
