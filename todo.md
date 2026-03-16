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

## Module Fix: Sub-Accounts Management

- [x] Audit existing backend accounts router for gaps
- [x] Backend: account creation must auto-assign owner by email
- [x] Backend: ensure admin-only RBAC on account CRUD
- [x] Backend: verify data isolation (contacts scoped to sub-account)
- [x] Frontend: Sub-Accounts list page with name, status, owner, created date
- [x] Frontend: Create Sub-Account dialog with name, industry, owner email, status
- [x] Frontend: Account detail page with members and settings
- [x] Frontend: Sidebar nav shows Sub-Accounts for admin only
- [x] Vitest tests for sub-account creation and owner assignment
- [x] Checkpoint saved

## Bug Fixes
- [x] Fix: Admins should bypass account membership check for contacts access
- [x] Fix: Ensure admin users can create/view/edit contacts in any sub-account

## Module 3: Manual Communication (Email & SMS)
- [x] Schema: messages table (type, direction, status, contactId, accountId, subject, body, etc.)
- [x] DB migration pushed
- [x] Backend: message CRUD helpers in server/db.ts
- [x] Backend: tRPC router — messages (send email, send SMS, list history, get by contact)
- [x] Backend: admin bypass on message tenant isolation
- [x] Frontend: Messages page with inbox/sent view and compose dialog
- [x] Frontend: Contact detail — communication history tab
- [x] Frontend: Compose email/SMS dialog with contact selector
- [x] Frontend: Message status badges (sent, delivered, failed, pending)
- [x] Vitest tests for messages CRUD, validation, and auth
- [x] Checkpoint saved

## Module 4: Campaign Management System
- [x] Schema: campaign_templates table (name, type, subject, body, accountId)
- [x] Schema: campaigns table (name, type, status, scheduledAt, sentAt, accountId, templateId)
- [x] Schema: campaign_recipients table (campaignId, contactId, status, sentAt, deliveredAt, error)
- [x] DB migration pushed
- [x] Backend: placeholder sendCampaignEmail() and sendCampaignSMS() functions
- [x] Backend: campaign template CRUD helpers in server/db.ts
- [x] Backend: campaign CRUD + scheduling helpers in server/db.ts
- [x] Backend: campaign recipients management helpers in server/db.ts
- [x] Backend: tRPC router — templates (create, list, get, update, delete)
- [x] Backend: tRPC router — campaigns (create, list, get, update, delete, send, schedule)
- [x] Backend: tRPC router — campaign recipients (add contacts, list, stats)
- [x] Backend: admin bypass on campaign tenant isolation
- [x] Frontend: Campaign list page with status filters
- [x] Frontend: Create campaign dialog/page with type selection
- [x] Frontend: Template editor (create/edit message templates)
- [x] Frontend: Contact targeting (select contacts or filter by segment)
- [x] Frontend: Schedule or send immediately option
- [x] Frontend: Campaign detail page with performance stats
- [x] Frontend: Recipient list with delivery status
- [x] Vitest tests for campaigns CRUD, validation, and auth
- [x] Checkpoint saved

## Seed Data: Prebuilt Campaign Templates
- [x] Create seed script with 4 email templates for mortgage/loan officers
- [x] Create seed script with 4 SMS templates for mortgage/loan officers
- [x] Templates support variables: {{first_name}}, {{last_name}}, {{agent_name}}, {{company_name}}
- [x] Run seed script and verify templates in database
- [x] Checkpoint saved

## Campaign Builder UI
- [x] Step 1: Campaign type selection (Email / SMS)
- [x] Step 2: Template picker with preview
- [x] Step 3: Recipient selection with status/tag filters and multi-select
- [x] Step 4: Review campaign (message preview + recipient count)
- [x] Step 5: Send options (send immediately / schedule for later)
- [x] Wire up to existing backend (create campaign, add recipients, send/schedule)
- [x] Integrate builder into existing Campaigns page via "+ New Campaign" button
- [x] Checkpoint saved
