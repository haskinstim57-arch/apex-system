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

## Module: AI Calls
- [x] Schema: ai_calls table (contactId, accountId, status, startTime, endTime, transcript, recordingUrl, etc.)
- [x] DB migration pushed
- [x] Backend: ai_calls CRUD helpers in server/db.ts
- [x] Backend: placeholder startAICall(contactId) function for future VAPI integration
- [x] Backend: tRPC router — ai_calls (start, bulkStart, list, get, updateStatus)
- [x] Backend: admin bypass on ai_calls tenant isolation
- [x] Frontend: AI Calls dashboard with call history list
- [x] Frontend: Call status badges (queued, calling, completed, failed)
- [x] Frontend: Start AI Call from contact profile
- [x] Frontend: Start AI Call from contact list
- [x] Frontend: Bulk AI Calls — select multiple contacts and launch
- [x] Frontend: Wire AI Calls sidebar nav item (remove placeholder)
- [x] Vitest tests for ai_calls CRUD, validation, and auth
- [x] Checkpoint saved

## AI Calls Module Verification
- [x] Fix: contacts.list query limit exceeded (200 > max 100) in AI Calls page — changed to limit: 100
- [x] Verified: Start AI Call dialog shows contacts with phone numbers
- [x] Verified: Start Call creates call record with correct contact linking
- [x] Verified: AI Call button on contact profile page works
- [x] Verified: Call history logs correctly (contact name, phone, status, timestamp)
- [x] Verified: Stats cards update in real-time (Total Calls, In Progress)
- [x] Verified: Database records have correct accountId, contactId, phoneNumber
- [x] Verified: All 152 tests pass after fix

## VAPI API Integration
- [x] Request VAPI_API_KEY, VAPI_AGENT_ID, VAPI_AGENT_ID_REALTOR, VAPI_AGENT_ID_INSTAGRAM environment variables
- [x] Build VAPI service layer (server/services/vapi.ts) with real API call
- [x] Add webhook endpoint for VAPI call status updates
- [x] Update schema: add assistantId column to ai_calls table
- [x] Update startAICall() to call VAPI API with contact phone, name, sub-account ID, agent config
- [x] Store call data: call id, contact id, sub-account id, start/end time, status, transcript, recording url
- [x] Update router to handle VAPI webhook callbacks (status, transcript, recording)
- [x] Add syncStatus endpoint to poll VAPI for latest call data
- [x] Frontend: display transcript and recording in call detail view
- [x] Frontend: Sync from VAPI button in call detail dialog
- [x] Frontend: auto-refresh for active calls (10s polling)
- [x] Frontend: in-progress call indicator with pulse animation
- [x] Lead source → assistant routing: Facebook → VAPI_AGENT_ID, Realtor/Referral → VAPI_AGENT_ID_REALTOR, Instagram → VAPI_AGENT_ID_INSTAGRAM
- [x] Ensure sub-account isolation on all VAPI call data
- [x] Write vitest tests for VAPI service layer (30 tests)
- [x] All 182 tests pass
- [x] Checkpoint saved

## VAPI phoneNumberId Update
- [x] Add phoneNumberId (c9eaefc4-9227-439d-bb16-a79c2797ab58) to createVapiCall() request payload
- [x] Ensure customer.number and customer.name are correctly structured
- [x] Verify AI Calls module works with updated payload
- [x] All 182 tests pass
- [x] Checkpoint saved

## n8n Webhook Payload Processing + E.164 Validation
- [x] Audit current webhook handler for incoming payload compatibility
- [x] Ensure webhook endpoint accepts n8n forwarded payloads (status, transcript, recording)
- [x] Add public REST endpoint POST /api/webhooks/vapi for n8n (accepts native + simplified formats)
- [x] Add getAICallByExternalId() DB helper for webhook call resolution
- [x] Add E.164 phone validation on contact creation and update (backend)
- [x] Add E.164 phone validation on contact creation and update (frontend)
- [x] Auto-normalize US phone numbers (10-digit → +1XXXXXXXXXX)
- [x] Write tests for webhook payload processing and E.164 validation (33 tests)
- [x] All 215 tests pass
- [x] Checkpoint saved

## Automations Module
- [x] Database schema: workflows, workflow_steps, workflow_executions, workflow_execution_steps
- [x] DB helpers for workflow CRUD (create, list, get, update, delete, reorder steps)
- [x] tRPC router for workflow management (create, list, get, update, delete, toggle, addStep, updateStep, deleteStep, reorderSteps, triggerManual, listExecutions, listAllExecutions, getExecution, cancelExecution)
- [x] Execution engine: background worker polling every 15s for pending executions
- [x] Trigger system: event hooks that fire matching workflows (workflowTriggers.ts)
- [x] Triggers: Contact Created, Tag Added, Pipeline Stage Changed, Facebook Lead Received, Manual Trigger
- [x] Actions: Send SMS, Send Email, Start AI Call (VAPI), Add Tag, Remove Tag, Update Contact Field, Create Task
- [x] Delay blocks: Wait Minutes, Wait Hours, Wait Days
- [x] Workflow Builder UI: create, edit, trigger/action/delay steps, activate/deactivate
- [x] Execution Logs tab: workflowId, contactId, step status, errors, timestamps
- [x] Integrations: SMS → Messages module, Email → Campaigns module, AI Call → VAPI integration
- [x] Sub-account isolation on all workflow data
- [x] Template interpolation: {{firstName}}, {{lastName}}, {{email}}, {{phone}}, {{fullName}}
- [x] Write vitest tests (39 tests)
- [x] All 254 tests pass
- [ ] Checkpoint saved
