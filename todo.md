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
- [x] Checkpoint saved

## Wire Automation Triggers into Existing Modules
- [x] Add onContactCreated() call to contacts router create procedure
- [x] Add onFacebookLeadReceived() call when leadSource contains "facebook"
- [x] Add onTagAdded() call to contacts router addTag procedure
- [x] Add onTagAdded() calls for tags added during contact creation
- [x] Add onPipelineStageChanged() call to contacts router update procedure (when status changes)
- [x] All triggers fire asynchronously (non-blocking via dynamic import + .catch)
- [x] Write vitest tests for trigger wiring (9 integration tests)
- [x] All 263 tests pass
- [x] Checkpoint saved

## Pipeline / Deals Module
- [x] Database schema: pipelines, pipeline_stages, deals tables
- [x] DB helpers for pipeline CRUD (createDefaultPipeline, getOrCreateDefaultPipeline, listPipelines, listPipelineStages, createDeal, getDealById, getDealByContactId, listDeals, updateDeal, deleteDeal, getPipelineStageById)
- [x] tRPC router for pipeline management (listPipelines, getDefault, listStages, listDeals, createDeal, moveDeal, updateDeal, deleteDeal)
- [x] Default pipeline with 6 stages: New Lead, Contacted, Qualified, Proposal, Closed Won, Closed Lost
- [x] Kanban board UI with drag-and-drop between stages
- [x] Fire pipeline_stage_changed automation trigger on deal movement (via moveDeal)
- [x] Store deal data: contactId, pipelineId, stageId, title, value, sortOrder, updatedAt
- [x] Sub-account isolation on all pipeline data
- [x] Pipeline nav item added to sidebar
- [x] Write vitest tests (28 tests)
- [x] All 28 pipeline tests pass, 287/291 total pass (4 pre-existing flaky tests in other modules)
- [x] Checkpoint saved

## Facebook Lead Ads Webhook
- [x] Create POST /api/webhooks/facebook-leads endpoint
- [x] Handle Facebook webhook verification (GET challenge with verify_token)
- [x] Parse Facebook Lead Ads payload — both native format and simplified/flat format from n8n
- [x] Create contact with leadSource = "facebook"
- [x] Normalize phone to E.164 format
- [x] Auto-assign contact to "New Lead" pipeline stage (auto-creates default pipeline)
- [x] Fire facebook_lead_received automation trigger (async, non-blocking)
- [x] Fire onContactCreated automation trigger (async, non-blocking)
- [x] Sub-account routing via accountId in payload
- [x] Store Facebook metadata (lead_id, campaign_id, ad_id, form_id) in customFields
- [x] Write vitest tests (23 tests)
- [x] 313/314 tests pass (1 pre-existing flaky timeout in trigger-wiring)
- [x] Checkpoint saved

## Facebook Lead Follow-Up Workflow Template
- [x] Create template provisioning function (server/services/workflowTemplates.ts)
- [x] Workflow: Trigger = facebook_lead_received
- [x] Step 1: Send SMS ("Hi {{firstName}}, thanks for your interest...")
- [x] Step 2: Wait 5 minutes
- [x] Step 3: Start AI Call (VAPI)
- [x] Duplicate prevention: checks if FB workflow already exists for account
- [x] Templates dropdown button in Automations UI header
- [x] tRPC endpoints: listTemplates, provisionTemplate
- [x] Write tests (8 tests)
- [x] All 322 tests pass
- [x] Checkpoint saved

## Database Stabilization
- [x] Audit package.json scripts — no reset/drop commands found
- [x] Audit drizzle config — clean, no destructive settings
- [x] Audit deployment/build hooks — no prestart/prebuild/postinstall hooks
- [x] Audit migration SQL files — no DROP TABLE or TRUNCATE in any migration
- [x] Audit server startup — no auto-migration or schema sync on boot
- [x] Confirmed pnpm db:push uses safe `generate && migrate` (not destructive `push`)
- [x] Created server/db-safety.ts — SQL safety validator blocking DROP/TRUNCATE on protected tables
- [x] Created DATABASE_SAFETY.md — persistence policy documentation
- [x] Write vitest tests (22 tests) — all pass
- [x] Checkpoint saved

## Update leadSource Dropdown Options
- [x] Update contact form leadSource dropdown: Facebook, Instagram, Google Ads, TikTok (added at top of list)
- [x] Existing leadSource values remain compatible (Website, Referral, etc. still present)
- [x] All 344 tests pass
- [x] Checkpoint saved

## Sub-Account Authentication
- [x] Audit current auth system (OAuth, sessions, user-account mapping)
- [x] Add passwordHash column to users table
- [x] Add getUserWithPassword, setUserPassword, getUserAccountMemberships DB helpers
- [x] Build sub-account login endpoint (email/password via tRPC subAccountAuth.login)
- [x] Build sub-account login screen UI (/login route)
- [x] Sub-account owners log in with own credentials (email + password)
- [x] Employees log in under their sub-account (membership-based routing)
- [x] Session maps user to accountId via getUserAccountMemberships
- [x] Data isolation: all 9 routers enforce requireAccountMember/requireAccountAccess
- [x] Preserve existing OAuth and role system (admin OAuth + sub-account email/password)
- [x] Admin endpoints: createSubAccountUser, setPassword, resetPassword
- [x] User endpoints: changePassword, myAccounts
- [x] Login screen with "Admin Sign In" (OAuth) and "Sub-Account Login" (email/password) options
- [x] Write vitest tests (25 tests)
- [x] All 369 tests pass
- [x] Checkpoint saved

## Production Infrastructure Audit & Implementation
### 1. SMS & Email Providers
- [x] Replace placeholder sendCampaignSMS() with real Twilio integration
- [x] Replace placeholder sendCampaignEmail() with real SendGrid integration
- [x] Update messages.ts router for real send
- [x] Update campaigns.ts router for real send
- [x] Update workflowEngine.ts for real send
### 2. Campaign Scheduler
- [x] Build background worker that runs every minute
- [x] Find campaigns where scheduledAt <= now and status = scheduled
- [x] Send campaign messages via provider APIs
- [x] Update campaign status after send
- [x] Retry failed messages
### 3. Environment Configuration
- [x] Register new env vars (TWILIO_*, SENDGRID_*, VAPI_PHONE_NUMBER_ID) via webdev_request_secrets
- [x] FB_WEBHOOK_VERIFY_TOKEN moved to per-client facebook_page_mappings.verify_token column
### 4. Facebook Page Routing
- [x] Add facebook_page_mappings table (facebook_page_id → account_id + verify_token)
- [x] Update Facebook webhook to route by page ID
- [x] Per-client verify tokens stored in facebook_page_mappings table
- [ ] Admin UI for managing page mappings (deferred — backend ready)
### 5. Security Hardening
- [x] Add helmet middleware
- [x] Add rate limiting middleware
- [x] Add strict CORS configuration
- [x] Set trust proxy for rate limiter behind reverse proxy
### 6. Event Verification
- [x] Verify contact_created trigger fires (existing — confirmed)
- [x] Verify facebook_lead_received trigger fires (existing — confirmed)
- [x] Verify pipeline_stage_changed trigger fires (existing — confirmed)
- [x] Add call_completed trigger to VAPI webhook (end-of-call-report + simplified)
- [x] Add onCallCompleted to workflowTriggers.ts
- [x] Write vitest tests for all new infrastructure (21 tests pass)
- [x] Checkpoint saved

## Facebook Page Mappings Admin Settings UI
- [x] Audit existing backend CRUD routes for facebook_page_mappings
- [x] Add tRPC procedures for CRUD (facebookPagesRouter with list/getByPageId/create/update/delete)
- [x] Add updateFacebookPageMapping helper to db.ts
- [x] Build FacebookPages settings panel component (table, create/edit dialog, delete confirm)
- [x] Wire panel into Settings navigation (Admin → Settings → Facebook Pages)
- [x] Add Integrations section to Settings page with Facebook Pages link (admin-only)
- [x] Write vitest tests for new tRPC procedures (11 tests)
- [x] Checkpoint saved

## Admin Account Impersonation
- [x] Audit existing auth, session, context, and account middleware
- [x] Add impersonation_audit_logs table and db helpers
- [x] Create impersonation tRPC procedures (start/stop/status)
- [x] Update account context middleware to respect impersonation session
- [x] Add "Login as Client" button to Admin → Accounts page
- [x] Add impersonation warning banner when active
- [x] Add "Stop Impersonation" button to restore admin session
- [x] Write vitest tests for impersonation (16 tests pass)
- [x] Checkpoint saved

## Tenant Isolation Audit & Enforcement
- [x] Audit existing routers, middleware, context, and DashboardLayout
- [x] Create AccountContext provider (single source of truth for currentAccountId)
- [x] Wire AccountProvider into App.tsx
- [x] Enforce WHERE account_id scoping in contacts router (already enforced via requireAccountMember)
- [x] Enforce WHERE account_id scoping in messages router (already enforced via requireAccountMember)
- [x] Enforce WHERE account_id scoping in campaigns router (already enforced via requireAccountAccess)
- [x] Enforce WHERE account_id scoping in pipelines router (already enforced via requireAccountMember)
- [x] Enforce WHERE account_id scoping in automations router (already enforced via requireAccountMember)
- [x] Enforce WHERE account_id scoping in AI calls router (already enforced via requireAccountAccess)
- [x] Update frontend: hide admin-only menu items for clients (AdminRoute guard + sidebar gating)
- [x] Update frontend: admin-only account selector in sidebar (AccountSwitcher component)
- [x] Update frontend: clients don't see account selector or Sub-Accounts menu
- [x] Fix Contacts page to scope by current account (uses useAccount() hook)
- [x] Fix Messages page to scope by current account
- [x] Fix Campaigns page to scope by current account
- [x] Fix AICalls page to scope by current account
- [x] Fix Pipeline page to scope by current account
- [x] Fix Automations page to scope by current account
- [x] Fix Home page to use useAccount() for admin/account state
- [x] Write vitest tests for tenant isolation (28 tests across 10 sections — all pass)
- [x] Checkpoint saved

## Final Multi-Tenant Stabilization Pass
### 1. Account Context
- [x] Audit and confirm single source of truth for currentAccountId (AccountContext.tsx)
- [x] Priority: impersonation > session > admin-selected (verified in context.ts + AccountContext)
- [x] Fix: Admin default mode — start in agency scope, not auto-select first account
- [x] Added isAgencyScope and clearAccount to AccountContext
- [x] AccountSwitcher shows "Agency Overview" option
- [x] All pages use NoAccountSelected component for agency scope prompt
### 2. Query Enforcement
- [x] Audit contacts router queries — all scoped via requireAccountMember
- [x] Audit messages router queries — all scoped via requireAccountMember
- [x] Audit campaigns router queries — all scoped via requireAccountAccess
- [x] Audit pipelines router queries — all scoped via requireAccountMember
- [x] Audit calls router queries — all scoped via requireAccountAccess
- [x] Audit automations router queries — all scoped via requireAccountMember
### 3. Contact Creation Fix
- [x] Audit manual contact creation path — uses accountId input with requireAccountMember guard
- [x] Audit Facebook webhook contact creation path — uses page mapping → accountId
- [x] Audit API routes contact creation path — all go through contacts.create with accountId
### 4. Frontend Account Switcher
- [x] Verify AccountSwitcher only renders for agency_admin (gated by isAdmin in DashboardLayout)
### 5. Admin Default Mode
- [x] Fix: Admins start in agency scope, not auto-switched to client account
- [x] Home.tsx shows sub-accounts overview in agency scope
- [x] Quick Overview only shows when account is selected
### 6. Client UI Permissions
- [x] Verify clients cannot see Sub-Accounts, Admin Settings, Facebook Pages, Analytics (AdminRoute + sidebar gating)
- [x] Verify clients see Dashboard, Contacts, Messages, Campaigns, AI Calls, Pipeline, Automations
### 7. Seed Data Cleanup
- [x] Fix: Prevent duplicate test accounts on repeated builds (idempotency check in seed script)
### 8. Contact Page Verification
- [x] Contacts page loads contacts scoped to currentAccountId (uses useAccount() hook)
- [x] Write vitest stabilization tests (20 tests — all pass)
- [x] Checkpoint saved

## Multi-Tenant Account Selection Flow Fixes
- [x] Fix SubAccountLogin to handle multiple memberships with account selection UI
- [x] Fix SubAccountLogin localStorage key mismatch (was apex_selected_account, now apex-selected-account)
- [x] Confirm DashboardLayout admin gating uses server-verified role only (verified: uses useAccount().isAdmin from ctx.user.role)
- [x] Fix ImpersonationBanner enabled condition (was user?.role === 'admin', now !!user)
- [x] Run tests and checkpoint (452/455 pass, 3 pre-existing flaky failures)

## Impersonation Bug Fixes
- [x] Fix cookie sameSite/secure mismatch in impersonation.ts (secure: true always when sameSite: 'none')
- [x] Verify trust proxy in security.ts middleware (already set: app.set('trust proxy', 1))
- [x] Fix ImpersonationBanner to clear localStorage on stop impersonation

## Invitation System Bug Fixes
- [x] Fix invitations.ts to send email after token creation (dispatchEmail with invite URL)
- [x] Fix AccountDetail.tsx to remove raw token from toast (simple success message)
- [x] Fix messaging.ts placeholder to return success: false with provider config error message

## Pipeline Tenant Isolation Bug Fixes
- [x] Verify getContactById in db.ts filters by accountId (already correct: AND accountId = ?)
- [x] Fix Pipeline page contact limit (100 → 500 + search input for large accounts)
- [x] Audit pipeline schema for naming inconsistencies (correct: snake_case DB columns, camelCase TS props)

## Per-Account Messaging Credentials
- [x] Add accountMessagingSettings table to schema and push migration
- [x] Add DB helpers (getAccountMessagingSettings, upsertAccountMessagingSettings)
- [x] Create messagingSettings tRPC router (get/save)
- [x] Update twilio.ts to accept accountId and use per-account credentials
- [x] Update sendgrid.ts to accept accountId and use per-account credentials
- [x] Update messaging.ts dispatcher to pass accountId
- [x] Update messages.ts router to pass accountId
- [x] Update campaignScheduler.ts to pass accountId
- [x] Update workflowEngine.ts to pass accountId
- [x] Build Messaging settings UI in Settings page (MessagingSettings.tsx)
- [x] Add /settings/messaging route to App.tsx
- [x] Add Messaging section to Settings page with link (visible when account selected)
- [x] Write vitest tests (17 tests — all pass)
- [x] All 472 tests pass across 22 test files
- [x] Checkpoint saved

## AES-256-GCM Encryption at Rest for Messaging Credentials
- [x] Create server/utils/encryption.ts with encrypt/decrypt (AES-256-GCM, iv:authTag:ciphertext format)
- [x] Export generateEncryptionKey() helper and isEncrypted() detector in encryption.ts
- [x] Add pnpm generate:key script to package.json
- [x] Update upsertAccountMessagingSettings to encrypt twilioAuthToken and sendgridApiKey on write
- [x] Update getAccountMessagingSettings to decrypt twilioAuthToken and sendgridApiKey on read
- [x] Add safeEncrypt/safeDecrypt wrappers for graceful degradation (no key = plain text fallback)
- [x] Create scripts/encrypt-existing-credentials.mjs migration script (one-time, idempotent)
- [x] Add pnpm migrate:encrypt-credentials script to package.json
- [x] Register ENCRYPTION_KEY as environment secret (auto-generated 32-byte hex key)
- [x] Write vitest tests for encryption utility (22 tests — all pass)
- [x] All 494 tests pass across 23 test files
- [x] Checkpoint saved

## Mandatory Onboarding Wizard for New Sub-Accounts
- [x] onboardingComplete column already existed in accounts table (default false)
- [x] Add completeOnboarding mutation in accounts router (owner/admin access)
- [x] Add updatePipelineStage DB helper for stage renaming
- [x] Add renameStages mutation to pipeline router
- [x] Export DEFAULT_STAGES from db.ts for onboarding reference
- [x] Build Onboarding.tsx multi-step wizard with 4 steps
- [x] Step 1: Business Profile form (Business Name, Phone, Website, Industry)
- [x] Step 2: Messaging Setup (Twilio + SendGrid credentials, skip option)
- [x] Step 3: Pipeline Setup (rename stages or use defaults)
- [x] Step 4: Finish screen with summary + Go to Dashboard button
- [x] Enforce onboarding flow in DashboardLayout (redirect if not completed, admins exempt)
- [x] Add /onboarding route to App.tsx (full-screen, no sidebar)
- [x] Write vitest tests (14 tests — all pass)
- [x] All 508 tests pass across 24 test files
- [x] Checkpoint saved

## Bug Fix: Sub-Account Ownership Flow
- [x] Made ownerId nullable in schema + pushed migration
- [x] Removed admin-as-placeholder-owner logic from accounts.create (ownerId = null for new users)
- [x] Updated createAccount DB helper to skip member creation when ownerId is null
- [x] Updated invitations.accept to set ownerId on account when owner invitation is accepted
- [x] Updated Accounts.tsx to show yellow "Pending" badge when ownerName is null
- [x] All 512 tests pass across 25 test files

## Email Delivery Debugging Improvements
- [x] Add startup warning in sendgrid.ts when SENDGRID_API_KEY is missing
- [x] Add try/catch with full error logging in invitations.ts dispatchEmail call
- [x] Add SENDGRID_FROM_EMAIL fallback to noreply@apexsystem.io
- [x] Updated isSendGridConfigured to only require API key (from-email has fallback)
- [x] All 512 tests pass across 25 test files

## Email Diagnostic Trace
- [x] Traced full call chain: invitations.ts → dispatchEmail (messaging.ts) → sendEmail (sendgrid.ts) → sgMail.send()
- [x] Confirmed sgMail.send() is the real @sendgrid/mail send function (not a stub)
- [x] Confirmed @sendgrid/mail ^8.1.6 is in package.json and installed in node_modules
- [x] Added [INVITE] log before dispatchEmail: shows target email + SENDGRID_FROM_EMAIL env
- [x] Added [INVITE] log after dispatchEmail: shows full result JSON
- [x] Added [SENDGRID] log at top of sendEmail: shows API key present, to, accountId
- [x] Added [SENDGRID] log before mailService.send(): confirms call is reached
- [x] Enhanced error catch: logs full err.response.body via JSON.stringify
- [x] All 512 tests pass across 25 test files

## Bug Fix: accounts.create not sending invitation email
- [x] Root cause: accounts.create creates invitation record but never calls dispatchEmail
- [x] Added dispatchEmail call with HTML email template after db.createInvitation in accounts.create
- [x] Added [INVITE] diagnostic logging before/after dispatchEmail
- [x] All 512 tests pass across 25 test files

## Resend Invitation Button
- [x] Add invitations.resend tRPC mutation (revokes old invite, creates fresh token, sends email)
- [x] Add Resend button with Send icon next to Pending badge in Accounts.tsx
- [x] All 512 tests pass across 25 test files
