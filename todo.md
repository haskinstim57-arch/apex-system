# Apex System — Project TODO

## Module 1: Multi-Tenant Authentication & Account Management

- [x] Database schema: accounts table (parent-child hierarchy)
- [x] Database schema: account_members table (user ↔ account with roles)
- [x] Database schema: invitations table (email-based invite tokens)
- [x] Database schema: audit_logs table
- [x] DB migration pushed successfully
- [x] Backend: account CRUD helpers in server/db.ts
- [x] Backend: member + invitation helpers in server/db.ts
- [x] Backend: tRPC router — accounts (create, list, get, update, delete)
- [x] Backend: tRPC router — members (list, update role, remove)
- [x] Backend: tRPC router — invitations (create, accept, list, revoke)
- [x] Backend: admin guard + tenant isolation on all queries
- [x] Frontend: elegant dark theme + design tokens in index.css
- [x] Frontend: DashboardLayout sidebar with all nav items
- [x] Frontend: Login / landing page
- [x] Frontend: Dashboard home page with stats shell
- [x] Frontend: Sub-accounts management page (admin)
- [x] Frontend: Account members / team page
- [x] Frontend: Invite employee modal
- [x] Frontend: Account settings page
- [x] Vitest tests for RBAC, account isolation, invitation flow
- [x] Final checkpoint saved

## Module 2: Contact Management System

- [x] Schema: contacts table (name, email, phone, source, status, assigned user, accountId)
- [x] Schema: contact_tags table (many-to-many tags)
- [x] Schema: contact_notes table (timestamped notes per contact)
- [x] DB migration pushed
- [x] Backend: contact CRUD helpers in server/db.ts
- [x] Backend: tRPC router — contacts (create, list, get, update, delete)
- [x] Backend: contact search and filter (by status, source, assigned user, tags)
- [x] Backend: contact assignment to team member
- [x] Backend: contact notes CRUD
- [x] Backend: contact tags management
- [x] Backend: tenant isolation — contacts scoped to sub-account
- [x] Frontend: Contact list view with table, search, and filters
- [x] Frontend: Create new contact dialog
- [x] Frontend: Edit contact dialog
- [x] Frontend: Delete contact confirmation
- [x] Frontend: Contact profile page with details, notes, tags, assignment
- [x] Frontend: Assign contact to team member UI
- [x] Frontend: Wire Contacts sidebar nav item (no longer placeholder)
- [x] Vitest tests for contacts CRUD, validation, and auth
- [x] Checkpoint saved
