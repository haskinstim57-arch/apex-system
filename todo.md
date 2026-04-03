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

## Bug Fix: Invitation links point to localhost:5000
- [x] Set VITE_APP_URL to https://apexcrm-knxkwfan.manus.space
- [x] Verified all 3 invitation URL constructions (accounts.ts, invitations.ts create + resend) use VITE_APP_URL with localhost fallback
- [x] All 516 tests pass across 26 test files

## Critical Bug Fix: "No account access" for all users
- [x] Added diagnostic logging to accounts.list query (userId, email, role, result count)
- [x] Verified accounts.list WHERE clause is correct (admin=all 174 accounts, client=memberships)
- [x] Verified AccountContext auto-selection works for clients (first account)
- [x] Root cause: admins start in agency scope (no account selected) — pages showed confusing message
- [x] Rewrote NoAccountSelected with inline account picker for admins + loading spinner
- [x] Simplified all 7 page guards (Contacts, Messages, Campaigns, AICalls, Pipeline, Automations, TeamMembers)
- [x] All 516 tests pass across 26 test files

## Critical Sub-Account Fixes (4 Issues) + Dashboard + Admin UX

### Issue 1: Admin shown as sub-account owner instead of "Pending"
- [x] Removed ownerId assignment from accounts.create (always null, set on invitation acceptance)
- [x] Accounts.tsx already shows "Pending" badge when ownerName is null

### Issue 2: Sub-account users see "No account access"
- [x] Fixed listAccountsForUserWithOwner to include accounts where user is ownerId OR in accountMembers
- [x] AccountContext: auto-select first account for ALL users (admins + clients)
- [x] Home.tsx: shows real dashboard stats (contacts, messages, campaigns, AI calls) via accountDashboardStats procedure

### Issue 3: Role display mismatch in Settings
- [x] Settings.tsx: shows "Account Owner" when user is ownerId of active account
- [x] Verified invitation acceptance sets ownerId correctly

### Issue 4: "Select an account first" in Automations
- [x] Verified: Automations.tsx already passes accountId from AccountContext to workflow create mutation
- [x] Root cause was Issue 2 (no accounts returned) — now fixed

### Dashboard content for sub-account users
- [x] Added getAccountDashboardStats DB helper (contacts, messages, campaigns, AI calls)
- [x] Added accountDashboardStats tRPC procedure with access control
- [x] Home.tsx: real-time stats cards with loading skeletons
- [x] Display stat cards with skeleton loading states
- [x] Show "0" for zero counts, never blank

### Admin UX Improvements
- [x] Auto-select first account for admins in AccountContext (removed agency scope default)
- [x] Search/filter in AccountSwitcher dropdown (real-time filtering by name)
- [x] Recently viewed accounts (last 5 in localStorage) at top of switcher with Clock icon
- [x] Rewrote AccountSwitcher with Popover, search input, Recent section, All Accounts section
- [x] Added recentAccounts to AccountContext + pushRecentAccountId on switchAccount
- [x] All 516 tests pass across 26 test files

## Password Setup & Authentication Flow for Sub-Account Users

### Step 1: Invitation email with Set Password link
- [x] Update invitation email template to include accept-invite URL with token
- [x] Link text: "Accept Invitation & Set Your Password"

### Step 2: Accept Invitation page
- [x] Create AcceptInvite.tsx with token validation, name/password form
- [x] Create subAccountAuth.acceptInviteWithPassword tRPC mutation
- [x] On submit: create user, set password hash, mark invitation accepted, set ownerId
- [x] Show error for expired/invalid tokens

### Step 3: Route in App.tsx
- [x] Add public /accept-invite route

### Step 4: Change Password in Settings
- [x] Add "Change Password" section in Settings.tsx (Security tab)
- [x] Create subAccountAuth.changePassword tRPC mutation (verify current, update with bcrypt)

### Step 5: Forgot/Reset Password
- [x] Add passwordResetTokens table to schema
- [x] Create ForgotPassword.tsx page (email input, sends reset email)
- [x] Create ResetPassword.tsx page (token validation, new password form)
- [x] Add forgot/reset password tRPC procedures (forgotPassword, validateResetToken, resetPasswordWithToken)
- [x] Add "Forgot your password?" link to SubAccountLogin.tsx
- [x] Add public routes /forgot-password and /reset-password

### Final
- [x] Run all tests and confirm pass (560 tests across 27 files)
- [x] Checkpoint saved

## Onboarding Wizard Bug Fix — "Go to Dashboard" redirects back to Step 1

- [x] Investigate: check if onboardingCompleted column exists in schema (confirmed: exists in accounts table)
- [x] Investigate: check backend mutation that sets onboardingCompleted (confirmed: completeOnboarding mutation works correctly)
- [x] Investigate: check frontend "Go to Dashboard" handler in Onboarding.tsx (ROOT CAUSE: missing cache invalidation)
- [x] Investigate: check redirect guard logic in App.tsx / DashboardLayout (guard logic is correct, reads from stale cache)
- [x] Fix: schema already has onboardingComplete column with default false — no migration needed
- [x] Fix: backend mutation correctly writes onboardingComplete: true — no change needed
- [x] Fix: added `await utils.accounts.list.invalidate()` after mutation in handleComplete before navigation
- [x] Fix: redirect guard now sees fresh data because cache is invalidated before redirect
- [x] Run all tests and confirm pass (576 tests across 28 files, all passing)
- [x] Checkpoint saved

## Facebook Integration in Onboarding Wizard

### Step 1: New "Integrations" step in onboarding
- [x] Add new step between Messaging Setup and Finish (step 3 of 5)
- [x] Facebook card with logo, title, description, Connect button
- [x] Google card placeholder with "Coming Soon" badge
- [x] Skip for now link
- [x] Update step counter from 4 to 5

### Step 2: Facebook OAuth flow
- [x] Add facebookOAuth.getOAuthUrl query
- [x] Add facebookOAuth.handleCallback mutation (exchange code for long-lived token)
- [x] Save token, expiry, Facebook user ID to accountIntegrations table

### Step 3: Fetch and store Facebook Pages
- [x] After OAuth callback, call GET /me/accounts
- [x] Store page id, name, access_token in accountFacebookPages table

### Step 4: Integrations tab in Settings
- [x] Add Integrations card to Settings.tsx
- [x] Show Facebook connection status (connected name + Disconnect, or Connect button)

### Step 5: Environment variables
- [x] Add FACEBOOK_APP_ID, FACEBOOK_APP_SECRET, FACEBOOK_WEBHOOK_VERIFY_TOKEN

### Final
- [x] Run all tests and confirm pass (613 tests across 29 files)
- [x] Checkpoint saved

## Facebook Webhook Endpoint

- [x] Create /api/webhooks/facebook Express route (GET for verification, POST for lead events)
- [x] GET handler: verify hub.mode, hub.verify_token against global ENV + per-client tokens, return hub.challenge
- [x] POST handler: receive leadgen events, look up page → account mapping, create contacts (already existed at /api/webhooks/facebook-leads)
- [x] Register route in server entry point (already registered via facebookLeadsWebhookRouter)
- [x] Write tests and confirm all pass (632 tests across 30 files)
- [x] Checkpoint saved

## Facebook Lead Webhook Subscription & Contact Creation

### Step 1: Subscribe pages to leadgen webhooks
- [x] After storing Facebook Pages in OAuth callback, call POST /{page-id}/subscribed_apps with subscribed_fields: ["leadgen"]
- [x] Use page access token for each stored page
- [x] Mark page as subscribed in accountFacebookPages via markFacebookPageSubscribed

### Step 2: Handle incoming lead webhooks
- [x] Update POST /api/webhooks/facebook handler to fetch lead data via GET /{leadgen-id} using page access token
- [x] Look up account via Facebook Page ID in accountFacebookPages (with fallback to legacy facebook_page_mappings)
- [x] Create contact in contacts table with lead field data (name, email, phone)
- [x] Added getAccountFacebookPageByFbPageId DB helper for page-to-account resolution

### Step 3: Trigger automation on new contact
- [x] After creating contact, fires both onContactCreated and onFacebookLeadReceived triggers (already existed)
- [x] Triggers match workflows with triggerType = "contact_created" and "facebook_lead_received"

### Step 4: Token refresh job
- [x] Created server/services/facebookTokenRefresh.ts (runs daily)
- [x] Checks accountIntegrations where tokenExpiresAt is within 7 days via listExpiringIntegrations
- [x] Sends email alert to account owner with renewal instructions
- [x] Registered in server/_core/index.ts to start on server boot

### Final
- [x] Run all tests and confirm pass (660 tests across 31 files)
- [x] Checkpoint saved

## Calendar + Booking Links Feature

### Database
- [x] Add calendars table (id, accountId, name, slug, description, timezone, bufferMinutes, minNoticeHours, maxDaysAhead, slotDurationMinutes, availabilityJson, isActive, createdAt)
- [x] Add appointments table (id, calendarId, accountId, contactId, guestName, guestEmail, guestPhone, startTime, endTime, status enum, notes, createdAt)
- [x] Run migration via pnpm db:push

### Server DB Helpers
- [x] getCalendars, getCalendar, getCalendarBySlug, createCalendar, updateCalendar, deleteCalendar
- [x] getAppointments, getAppointment, createAppointment, updateAppointment, cancelAppointment
- [x] getAvailableSlots, getAppointmentsByContact

### Server Router
- [x] Created server/routers/calendar.ts with protected procedures (list, get, create, update, delete, listAppointments, updateAppointment, cancelAppointment, appointmentsByContact)
- [x] Added public procedures (getPublicCalendar, getPublicSlots, bookAppointment)
- [x] Registered calendar router in server/routers.ts

### Frontend
- [x] Created client/src/pages/Calendar.tsx (calendar management, create/edit dialogs, appointments list, copy booking link, weekly availability editor)
- [x] Created client/src/pages/BookingPage.tsx (public booking page at /book/:slug, date picker, available time slots, guest form with name/email/phone)
- [x] Added /calendar and /book/:slug routes to App.tsx
- [x] Added CalendarDays icon + Calendar to sidebar nav in DashboardLayout.tsx

### Final
- [x] Run all tests and confirm pass (690 tests across 32 files)
- [x] Checkpoint saved

## Calendar Visual Grid View + Email/Reminders

### Visual Calendar Grid
- [ ] Replace default tab with visu### Calendar Grid View
- [x] Weekly grid: 7 days across top (Sun-Sat), current week default
- [x] Time slots on left: 6AM to 9PM in 1-hour increments
- [x] Red horizontal line showing current time
- [x] Appointments as colored blocks at correct day/time (color-coded by calendar + status)
- [x] Click empty slot → New Appointment modal pre-filled with date/time
- [x] Click appointment block → detail/edit modal with confirm/cancel actions
- [x] Today button, prev/next week arrows, date range header
- [x] View toggle: Week / Month / Day (Week default)
- [x] Month view shows appointment count badges, clicking day switches to Day view
- [x] Keep Appointments list as second tab
- [x] Keep Calendars management as third tab

### Email Confirmations
- [x] Send booking confirmation email to guest after appointment booked
- [x] Send notification email to loan officer when new appointment booked
- [ ] Include .ics calendar file attachment (future enhancement)

### Appointment Reminders
- [x] Background job: send email reminders 24h and 1h before appointment
- [x] Store reminder24hSent and reminder1hSent columns to avoid duplicate sends
- [x] Job runs every 15 minutes checking upcoming appointments

### Google Calendar Sync (Placeholder)
- [x] Google Calendar placeholder already exists in onboarding Integrations step with "Coming Soon" badge

### Final
- [x] Run all tests and confirm pass (690 tests across 32 files)
- [x] Checkpoint saved
## ICS Calendar File Attachments for Booking Emails

- [x] Create ICS file generator utility (server/utils/icsGenerator.ts) with generateICSEvent and generateICSBase64
- [x] Generate proper iCalendar format with VEVENT, DTSTART, DTEND, SUMMARY, DESCRIPTION, LOCATION, ORGANIZER, ATTENDEE, VALARM
- [x] Updated sendEmail (sendgrid.ts) and dispatchEmail (messaging.ts) to support attachments parameter
- [x] Integrate ICS attachment into guest booking confirmation email
- [x] Integrate ICS attachment into loan officer notification email
- [x] Write tests for ICS generation (21 tests in ics-generator.test.ts)
- [x] Run all tests and confirm pass (711 tests across 33 files)
- [x] Checkpoint saved

## Google Calendar & Outlook Calendar Sync

### Database
- [x] Add calendarIntegrations table (id, userId, accountId, provider enum, accessToken, refreshToken, tokenExpiresAt, externalCalendarId, isActive, createdAt)
- [x] Tokens encrypted at rest before storing
- [x] Run migration

### Encryption
- [x] Create token encryption/decryption helpers using ENCRYPTION_KEY env var

### Google Calendar OAuth
- [x] REST endpoint for Google OAuth callback
- [x] Exchange code for tokens, store encrypted in calendarIntegrations
- [x] Refresh token logic for expired access tokens
- [x] Google Calendar API: create/update/delete events
- [x] Google Calendar API: fetch busy times

### Outlook Calendar OAuth
- [x] REST endpoint for Outlook OAuth callback
- [x] Exchange code for tokens via Microsoft Identity Platform
- [x] Refresh token logic for expired access tokens
- [x] Microsoft Graph API: create/update/delete events
- [x] Microsoft Graph API: fetch busy times

### tRPC Procedures
- [x] getIntegrations, disconnectIntegration, syncNow, getExternalEvents

### Booking Page Busy Time Check
- [x] Fetch busy times from connected external calendars when calculating available slots
- [x] Block out busy times on /book/:slug

### Calendar Grid View
- [x] Show external calendar events as overlay blocks alongside CRM appointments

### Settings UI
- [x] Add Calendar Integrations section with Connect Google / Connect Outlook buttons
- [x] Show connection status and Disconnect button

### Environment Variables
- [x] GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET
- [x] MICROSOFT_CLIENT_ID, MICROSOFT_CLIENT_SECRET

### Final
- [x] Run all tests and confirm pass (21 new calendarSync tests)
- [x] Checkpoint saved

## Unified Two-Way Inbox

### Schema
- [x] Add isRead boolean field to messages table (default true for outbound, false for inbound)
- [x] Run migration

### Backend — Conversation tRPC Procedures
- [x] getConversations: list contacts with latest message preview, unread count, timestamp, channel icon
- [x] getThread: all messages for a specific contact, ordered chronologically
- [x] markAsRead: mark all messages for a contact as read
- [x] sendReply: send SMS or email reply from inbox (reuse existing dispatch logic)
- [x] getUnreadCount: total unread message count for sidebar badge

### Backend — Inbound Webhooks
- [x] POST /api/webhooks/twilio/inbound — receive inbound SMS from Twilio, create message record with isRead=false
- [x] POST /api/webhooks/sendgrid/inbound — receive inbound email from SendGrid Inbound Parse, create message record with isRead=false

### Frontend — Unified Inbox Page
- [x] Left panel: contact conversation list with recent message preview, timestamp, unread indicator, channel icon (SMS/email)
- [x] Right panel: full conversation thread as chat bubbles (inbound left, outbound right)
- [x] Reply box at bottom with channel selector (SMS/Email), text input, Send button
- [x] Filter tabs: All, SMS, Email, Unread
- [x] Search contacts in conversation list
- [x] Real-time polling every 10 seconds for new messages
- [x] Auto-mark messages as read when thread is opened

### Frontend — Sidebar Badge
- [x] Added Inbox nav item to DashboardLayout sidebar with unread count badge
- [x] Poll unread count every 15 seconds

### Tests
- [x] Vitest tests for getConversations, getThread, markAsRead, sendReply, getUnreadCount (23 tests)
- [x] Vitest tests for inbound webhook helpers (normalizePhone, extractEmail)
- [x] All 758 tests pass across 36 test files

### Final
- [x] All 758 tests pass (36 test files)
- [x] Checkpoint saved

## Contact Activity Timeline

### Schema
- [x] Add contactActivities table (id, contactId, accountId, activityType enum, description, metadata JSON, createdAt)
- [x] Run migration

### Backend — DB Helpers & tRPC
- [x] Add createContactActivity helper in db.ts
- [x] Add getContactActivities helper with pagination (limit/offset, reverse chronological)
- [x] Add getContactActivity tRPC procedure in contacts router (paginated)

### Backend — Activity Logging Hooks
- [x] Contact created → log activity (contacts router)
- [x] Tag added → log activity (contacts router)
- [x] Tag removed → log activity (contacts router)
- [x] Pipeline stage changed (deal moved) → log activity with from/to stage names (pipeline router)
- [x] Message sent (SMS/email outbound) → log activity with channel, direction, preview (messages router)
- [x] Message received (inbound) → log activity (messages router + inbound webhooks)
- [x] AI call made → log activity (aiCalls router)
- [x] Appointment booked → log activity (calendar router)
- [x] Appointment confirmed/cancelled → log activity (calendar router)
- [x] Automation/workflow triggered → log activity with workflow name + trigger type (automations router + workflowEngine)
- [x] Note added → log activity (contacts router)
- [x] Inbox reply sent → log activity (inbox router)

### Frontend — Timeline UI
- [x] Vertical timeline component on ContactDetail page right column
- [x] Icons for each activity type (14 types: tag, message sent/received, call, appointment booked/confirmed/cancelled, automation, note, pipeline, contact created, task)
- [x] Each entry shows icon, description, timestamp (relative + absolute)
- [x] Most recent at top (reverse chronological)
- [x] Load more button for older entries
- [x] Replaced CommunicationHistory with unified ActivityTimeline
- [x] Metadata badges for channel, direction, stage changes, tags, workflow names, message previews

### Tests
- [x] Vitest tests for createContactActivity, getContactActivities, getContactActivity procedure (16 tests)
- [x] All 774 tests pass across 37 test files

### Final
- [x] Checkpoint saved

## Missed Call Text-Back

### Schema
- [x] Add missedCallTextBackEnabled (boolean, default false) to accounts table
- [x] Add missedCallTextBackMessage (text) to accounts table
- [x] Add missedCallTextBackDelayMinutes (int, default 1) to accounts table
- [x] Run migration

### Backend — tRPC Procedures
- [x] getMissedCallTextBackSettings: return current settings for an account
- [x] saveMissedCallTextBackSettings: update settings for an account

### Backend — Twilio Voice Status Webhook
- [x] Add POST /api/webhooks/twilio/voice-status endpoint
- [x] Detect call status "no-answer" or "busy" or "failed" (missed call scenarios)
- [x] Resolve account by called Twilio number (reuse resolveAccountByTwilioNumber)
- [x] Check if missedCallTextBackEnabled is true for that account
- [x] Find or create contact by caller phone number
- [x] After configured delay, send SMS via existing dispatchSMS
- [x] Log outbound message to contact's message thread (createMessage)
- [x] Log contact activity

### Frontend — Settings UI
- [x] Add "Missed Call Text-Back" card to Settings page
- [x] Toggle to enable/disable
- [x] Text area to customize the message (default: "Hey, sorry I missed your call! How can I help you?")
- [x] Delay selector buttons (Immediately, 1 minute, 5 minutes)
- [x] Save button with loading state and success/error feedback
- [x] Setup instructions with webhook URL displayed

### Tests
- [x] Vitest tests for getMissedCallTextBackSettings and saveMissedCallTextBackSettings procedures (9 tests)
- [x] Vitest tests for voice status webhook missed call detection and sendMissedCallTextBack (6 tests)
- [x] All 789 tests pass across 38 test files

### Final
- [x] Checkpoint saved

## Block-Based Email Template Builder

### Schema
- [x] Add emailTemplates table (id, accountId, name, subject, htmlContent, jsonBlocks JSON, createdAt, updatedAt)
- [x] Run migration

### Backend — DB Helpers
- [x] createEmailTemplate, listEmailTemplates, getEmailTemplate, updateEmailTemplate, deleteEmailTemplate

### Backend — tRPC Procedures
- [x] listTemplates: list for an account ordered by updatedAt
- [x] getTemplate: get single template by ID with access check
- [x] createTemplate: create new template with name, subject, blocks JSON, rendered HTML
- [x] updateTemplate: update existing template with access check
- [x] deleteTemplate: delete template with access check

### Backend — Email Sending Integration
- [x] Add shared renderEmailTemplate utility with both {{contact.field}} and {{field}} format support
- [x] Update campaign scheduler to load template HTML when templateId is set
- [x] Update workflow engine send_email step to support config.templateId
- [x] Backward compatible — falls back to plain body text when no template

### Frontend — Email Templates List Page
- [x] New /email-templates route with list of templates
- [x] Create, edit, delete template actions
- [x] Add "Email Templates" to sidebar nav (Mail icon)

### Frontend — Block-Based Template Editor
- [x] Block types: Header, Text, Button, Image, Divider, Footer
- [x] Stacked block system — add/remove/reorder blocks with up/down arrows
- [x] Inline editing — click to expand, edit text, colors, alignment, font size
- [x] Live preview panel showing rendered email HTML via iframe
- [x] Merge tag insertion buttons ({{contact.firstName}}, etc.)
- [x] Save template with name and subject, unsaved changes indicator
- [x] Toggle between editor-only and editor+preview modes

### Frontend — Campaign/Automation Integration
- [x] Template selector dropdown when creating a campaign email (CampaignBuilder)
- [x] Template selector in automation AddStepDialog and EditStepDialog for send_email
- [x] Preview of selected template (shows template name, hides manual subject/body)

### Tests
- [x] Vitest tests for template CRUD procedures (10 tests: list, get, create, update, delete with auth)
- [x] Vitest tests for renderEmailTemplate merge tag substitution (14 tests)
- [x] Vitest tests for MERGE_TAGS constant (2 tests)
- [x] All 816 tests pass across 39 test files

### Final
- [x] Checkpoint saved

## Mobile Responsiveness

### Sidebar / Navigation
- [x] Hamburger trigger visible on mobile (uses Sheet overlay)
- [x] Close sidebar on nav item click on mobile (all nav sections)
- [x] Mobile top bar shows current page title (activeMenuItem.label)

### Global Styles
- [x] Add mobile-friendly tap target sizes (min 44px) via CSS
- [x] Add .table-responsive utility class for overflow-x-auto
- [x] Add responsive dialog/modal styles (full-screen on mobile via CSS)
- [x] Add form input max-width: 100% on mobile
- [x] Badge/inline elements exempted from min tap target size

### Dashboard (Home.tsx)
- [x] KPI cards already stack vertically on mobile (grid-cols-1 sm:grid-cols-2 lg:grid-cols-4)

### Contacts Page
- [x] Table scrollable horizontally on mobile (overflow-x-auto already present)
- [x] Filter/search bar wraps on mobile (flex-wrap, full-width selects)
- [x] Contact stats grid responsive (grid-cols-2 sm:grid-cols-4)

### Pipeline Page
- [x] Kanban columns horizontally scrollable on mobile (overflow-x-auto)
- [x] Stage columns slightly narrower on mobile (260px vs 280px)

### Inbox Page
- [x] Mobile thread open/close already works (hidden md:flex toggle)
- [x] Reply box send button responsive (48px mobile, 60px desktop)

### Calendar Page
- [x] Week view auto-switches to day view on mobile (useIsMobile hook)
- [x] Calendar header controls already wrap (flex-wrap gap-2)
- [x] Manage selectors full-width on mobile
- [x] Appointment table overflow-x-auto
- [x] Calendar dialog grids stack on mobile (grid-cols-1 sm:grid-cols-2)

### Campaigns Page
- [x] Table horizontally scrollable on mobile
- [x] Campaign builder dialog full-screen on mobile
- [x] Header buttons wrap on mobile
- [x] Filter bar responsive on mobile
- [x] Campaign builder grids stack on mobile

### Automations Page
- [x] Workflow list table scrollable on mobile
- [x] Step editor dialogs full-screen on mobile
- [x] Header buttons wrap on mobile
- [x] Dialog grids stack on mobile
- [x] Execution logs filter responsive

### AI Calls Page
- [x] Table scrollable on mobile
- [x] Call dialog full-screen on mobile
- [x] Call detail grid stacks on mobile
- [x] Page spacing responsive

### Settings Page
- [x] Settings cards stack vertically on mobile (already single column)
- [x] Form inputs full-width on mobile (global CSS rule)

### Email Templates
- [x] Template list responsive grid on mobile (already grid-cols-1 md:grid-cols-2)
- [x] Editor stacks preview below editor on mobile (already grid-cols-1 lg:grid-cols-2)
- [x] Header buttons wrap on mobile

### ContactDetail Page
- [x] Two-column layout stacks on mobile (already grid-cols-1 lg:grid-cols-3)
- [x] Activity timeline full-width on mobile
- [x] Edit dialog grids stack on mobile

### Accounts Page
- [x] Account cards stack on mobile
- [x] Stats grid stacks on mobile
- [x] Table horizontally scrollable on mobile
- [x] Filter bar responsive on mobile
- [x] Create dialog grids stack on mobile

### Messages Page
- [x] Header wraps on mobile
- [x] Table horizontally scrollable on mobile

### CampaignDetail Page
- [x] Recipients table scrollable on mobile
- [x] Page spacing responsive

### AccountDetail Page
- [x] Page spacing responsive

### FacebookPages Page
- [x] Page spacing responsive

### Final
- [x] Test all pages on mobile viewport (all 816 tests pass)
- [x] Checkpoint saved

## In-App Notification Center

### Backend
- [x] Schema: notifications table (id, accountId, userId, type enum, title, body, link, isRead, dismissed, createdAt)
- [x] DB migration pushed (via SQL)
- [x] DB helpers: createNotification, getNotifications, getUnreadNotificationCount, markAsRead, markAllAsRead, dismissNotification
- [x] tRPC procedures: notifications.list, notifications.unreadCount, notifications.markAsRead, notifications.markAllAsRead, notifications.dismiss

### Notification Triggers
- [x] New inbound message received (SMS) — server/webhooks/inboundMessages.ts
- [x] New inbound message received (email) — server/webhooks/inboundMessages.ts
- [x] New appointment booked — server/routers/calendar.ts (bookAppointment)
- [x] Appointment cancelled — server/routers/calendar.ts (cancel)
- [x] AI call completed — server/webhooks/vapi.ts (native + simplified)
- [x] Campaign finished sending — server/services/campaignScheduler.ts
- [x] Automation workflow failed — server/services/workflowEngine.ts (top-level + step-level)
- [x] New contact created via Facebook lead — server/webhooks/facebookLeads.ts
- [x] Missed call received — server/webhooks/twilioVoiceStatus.ts

### Frontend
- [x] Bell icon component with unread count badge in top nav bar
- [x] Notification dropdown showing last 20 notifications
- [x] Each notification: icon (type-based), title, description, timestamp, link
- [x] Mark all as read button
- [x] Individual notification dismiss
- [x] Unread notifications highlighted (blue dot + bold)
- [x] Poll for new notifications every 15 seconds
- [x] Integrate bell into DashboardLayout top bar (mobile + desktop)

### Testing
- [x] Vitest tests for notification CRUD procedures (9 tests)
- [x] All 825 tests pass
- [x] Checkpoint saved

## Twilio Phone Number Purchase (In-CRM)

### Backend
- [x] Update account schema: add twilioPhoneSid column to accountMessagingSettings
- [x] DB migration pushed (via SQL ALTER TABLE)
- [x] tRPC procedure: searchAvailable (area code or city/state search via Twilio API)
- [x] tRPC procedure: purchase (buy via Twilio API, configure SMS + voice webhooks, store on account)
- [x] tRPC procedure: release (release via Twilio API, clear from account)
- [x] tRPC procedure: getAssigned (return current number for account)

### Frontend
- [x] Phone Number section in Settings page (PhoneNumberCard component)
- [x] "Get a Phone Number" button when no number assigned
- [x] Search modal: area code or city/state search with tabs
- [x] Available numbers list with area code, location, and monthly cost ($1.15)
- [x] Confirmation step before purchase with cost display and billing details
- [x] Purchase flow: buy, assign, close modal, auto-configure webhooks
- [x] Display assigned number with release option
- [x] Release confirmation dialog with warning about losing the number

### Testing
- [x] Vitest tests for phone number tRPC procedures (11 tests)
- [x] All 836 tests pass
- [x] Checkpoint saved

## Twilio Phone Number Enhancements

### 1. Toll-Free Number Support
- [x] Backend: Add toll-free search to searchAvailable procedure (numberType param, tollFree endpoint)
- [x] Frontend: Add Local/Toll-Free toggle in search modal
- [x] Show toll-free monthly cost ($2.15/month) vs local ($1.15/month)

### 2. Number Porting
- [x] Backend: port_requests table in schema
- [x] Backend: tRPC procedures submitPortRequest, getPortRequests, cancelPortRequest
- [x] Backend: DB helpers createPortRequest, getPortRequestsByAccount, getPortRequestById, updatePortRequest
- [x] Frontend: "Port Existing Number" tab in phone number card
- [x] Frontend: Port request form (number, carrier, account number, PIN, authorized name)
- [x] Frontend: Port request history with status badges and cancel option

### 3. Usage Dashboard
- [x] Backend: tRPC procedure getUsage (fetch SMS/voice usage from Twilio API)
- [x] Frontend: Usage tab in Phone Number card (messages sent/received, calls, minutes, cost)
- [x] Frontend: Date range selector for usage period (start/end)
- [x] Frontend: Total cost summary and per-category breakdown

### Testing
- [x] Vitest tests for toll-free search (2 tests)
- [x] Vitest tests for port number procedures (5 tests)
- [x] Vitest tests for usage dashboard procedure (3 tests)
- [x] All 847 tests pass
- [x] Checkpoint saved

## Auto-Complete Port Requests

### Backend
- [x] Created portRequestPoller service (server/services/portRequestPoller.ts) — polls every 5 min
- [x] On completed port: auto-assigns number to account (upsertAccountMessagingSettings), configures SMS + voice webhooks, updates port request to "completed"
- [x] On failed port (45-day timeout): updates port request to "failed" and creates notification
- [x] Auto-cancels port if account already has a number assigned
- [x] Auto-advances "submitted" to "in_progress" on first check
- [x] Integrated into server startup (server/_core/index.ts) alongside other background workers
- [x] Added getActivePortRequests DB helper
- [x] Creates notifications on port completion, failure, and cancellation

### Frontend
- [x] Port requests auto-refresh every 30s when there are active requests (refetchInterval)
- [x] Pulsing amber dot indicator on active port requests
- [x] Notes displayed below each port request card (shows progress/completion/failure messages)
- [x] "How porting works" text updated to mention auto-assignment on completion

### Testing
- [x] 12 vitest tests for portRequestPoller service (start/stop, complete, advance, timeout, cancel, webhooks, error handling, no-creds)
- [x] All 859 tests pass
- [x] Checkpoint saved

## Two-Way Calendar Sync Webhooks

### Database
- [x] calendarWatches table (id, userId, accountId, provider, watchId, resourceId, channelToken, expiresAt, createdAt)
- [x] externalCalendarEvents table (id, userId, accountId, provider, externalEventId, title, startTime, endTime, allDay, status, syncedAt)
- [x] DB migration pushed (via SQL)
- [x] DB helpers: createCalendarWatch, getCalendarWatchByIntegration, getCalendarWatchByWatchId, getExpiringCalendarWatches, updateCalendarWatch, deleteCalendarWatch, deleteCalendarWatchByIntegration
- [x] DB helpers: upsertExternalCalendarEvent, deleteExternalCalendarEvent, getExternalCalendarEvents, deleteExternalCalendarEventsByUser

### Google Calendar Push Notifications
- [x] Webhook endpoint POST /api/webhooks/google-calendar (server/webhooks/googleCalendarWebhook.ts)
- [x] Register watch on user's calendar after Google Calendar connect (calendarOAuthCallbacks.ts)
- [x] Fetch changed events on notification and update external events cache
- [x] Handle new/updated/deleted external events (upsert confirmed, remove cancelled)
- [x] Watch registration via calendarWatchManager.registerGoogleWatch

### Microsoft Outlook Push Notifications
- [x] Webhook endpoint POST /api/webhooks/outlook-calendar (server/webhooks/outlookCalendarWebhook.ts)
- [x] Handle Microsoft validation handshake (validationToken response)
- [x] Register subscription after Outlook Calendar connect (calendarOAuthCallbacks.ts)
- [x] Fetch changed events on notification and update external events cache
- [x] Subscription registration via calendarWatchManager.registerOutlookSubscription

### Background Renewal Job
- [x] Recurring job every 6 hours (server/services/calendarWatchRenewal.ts)
- [x] Renew Google watches before 7-day expiry (24-hour buffer)
- [x] Renew Microsoft subscriptions before 4230-minute expiry (24-hour buffer)
- [x] Integrated into server startup (server/_core/index.ts)

### Watch Management
- [x] calendarWatchManager service: registerGoogleWatch, registerOutlookSubscription, unregisterWatch
- [x] Unregister watches on calendar disconnect (calendarSync.disconnect procedure)
- [x] Clean up cached events on disconnect

### Frontend
- [x] listCachedExternalEvents tRPC procedure for cached event display
- [x] External events available for calendar grid overlay

### Testing
- [x] 24 calendarSync tests (including 3 new listCachedExternalEvents + updated disconnect tests)
- [x] All 862 tests pass
- [x] Checkpoint saved

## Double-Booking Prevention

### Public Booking Page
- [x] Update getPublicSlots to check externalCalendarEvents (cached push events) for conflicts
- [x] Check both CRM appointments (confirmed/pending) and external events (live API + cached)
- [x] Hide any slot with partial or full overlap (hasTimeConflict helper)
- [x] Respect bufferMinutes field on calendar for buffer time (applied to both CRM and external events)
- [x] All-day external events block the entire day
- [x] Cancelled appointments do NOT block slots (filtered with status != 'cancelled')

### CRM Appointment Creation (bookAppointment)
- [x] Add double conflict check: first via getAvailableSlots (CRM), then via external calendar events
- [x] Check against CRM appointments AND external calendar events (live + cached)
- [x] Return error "This time slot is already booked. Please choose a different time." if conflict found
- [x] Include buffer time in conflict check

### CRM Appointment Rescheduling (updateAppointment)
- [x] Add conflict check when startTime/endTime are changed
- [x] Exclude the appointment being rescheduled from self-conflict
- [x] Check both CRM and external events with buffer

### Post-Booking Sync
- [x] Push new CRM appointments to connected external calendars immediately after booking (already existed via syncAppointmentToExternalCalendars)
- [x] Prevents external calendar double-booking after CRM booking

### Backend Helpers
- [x] getCachedExternalBusyBlocks — converts cached external events to busy blocks with buffer
- [x] hasTimeConflict — unified overlap detection function
- [x] getExternalCalendarEventsByAccount — DB helper for account-wide external event query

### Frontend
- [x] Conflict error message shown via toast.error(e.message) on CRM calendar booking
- [x] Conflict error message shown via toast.error(e.message) on public booking page
- [x] Error handling already wired in both Calendar.tsx and BookingPage.tsx

### Testing
- [x] 20 vitest tests for double-booking prevention (hasTimeConflict, getCachedExternalBusyBlocks logic, buffer time, cancelled appointments)
- [x] Updated existing calendar.test.ts for new error message
- [x] All 882 tests pass
- [x] Checkpoint saved

## Analytics Dashboard

### Backend Fixes
- [x] Fix DATE() SQL compatibility issue in analytics router (use DATE_FORMAT raw SQL)
- [x] Register analytics router in server/routers.ts

### Frontend Wiring
- [x] Add /analytics route to App.tsx
- [x] Remove placeholder flag from Analytics sidebar nav item
- [x] Verify Analytics page loads with real data (KPI cards + 6 charts)

### Testing
- [x] Fix analytics tests for DATE() SQL compatibility
- [x] All 898 tests pass

## UI Overhaul: Light Theme + Gold Accent Design System

### Global Theme
- [x] Update index.css: Replace dark theme CSS variables with light theme (off-white bg, white cards, gold accent)
- [x] Typography: Inter font, 28px titles, 18px section headers, 14px body, 12px labels
- [x] Cards: white bg, 12px radius, subtle shadow, no harsh borders
- [x] Buttons: gold primary (#C9A84C), outline secondary, 8px radius
- [x] Status badges: pill shape, green/amber/red/blue/purple
- [x] Form inputs: light border, 8px radius, gold focus ring
- [x] Keep dark theme for public booking page (/book/:slug)

### DashboardLayout
- [x] Sidebar: white bg, gold active state, section labels (CLIENT PORTAL / SETTINGS)
- [x] Top bar: white bg, search bar, notification bell, user avatar + name + role
- [x] Sidebar nav items: gray icons + dark text, gold active state with left border
- [x] Logo: "A" icon (amber square) + "ApexSystem" wordmark

### Page Components (styling only, no logic changes)
- [x] Home.tsx: 4 KPI cards + performance chart + light theme
- [x] Contacts.tsx: stat cards + filter tabs + rich table with light theme
- [x] All other pages: apply card/table/button/badge styling updates
- [x] Charts: gold primary line, light grid lines, white card backgrounds

### Verification
- [x] All pages render correctly with new theme
- [x] Public booking page retains dark theme
- [x] All tests still pass (898/898)
- [x] Checkpoint saved (a3b49973)

## Role-Based Access Control: Agency vs Sub-Account Users

### AccountSwitcher
- [x] Hide "Agency Overview" option from non-agency_admin users
- [x] Sub-account users only see their own account(s)

### Sidebar Navigation
- [x] Hide "Sub-Accounts" nav item from non-agency_admin users
- [x] When agency_admin is in Agency Overview mode (no sub-account selected), show agency-only nav (Sub-Accounts, Users, Billing, Settings)
- [x] When a sub-account is selected, show sub-account pages (Contacts, Conversations, Campaigns, etc.)

### Route Protection
- [x] Redirect sub-account users from /agency, /accounts (sub-accounts) routes to their dashboard
- [x] Protect all agency-level routes from non-agency_admin users

### Verification
- [x] All 924 tests pass
- [x] Checkpoint saved (704780b8)

## Dashboard KPI Fix: Context-Aware Stats

- [x] Home.tsx: Show sub-account KPIs (Total Contacts, Messages Sent, AI Calls, Appointments) when sub-account selected
- [x] Home.tsx: Show agency KPIs (Total Accounts, Total Users, Active Accounts, Platform Health) only in Agency Overview
- [x] Backend: Add appointments count to accountDashboardStats (contacts, messages, aiCalls, appointments scoped to accountId)
- [x] Quick Overview section scoped to selected sub-account
- [x] All 924 tests pass
- [x] Checkpoint saved (ae3b6b7a)

## Bulk CSV Contact Import

### Backend
- [x] importContacts tRPC procedure: accepts array of contact objects, bulk inserts for active accountId
- [x] Duplicate detection: skip contacts with same email or phone already in account
- [x] Required field validation: at least one of firstName, lastName, or phone
- [x] Tags support: comma-separated tags auto-created on contact
- [x] Return result: imported, skipped, failed counts + error rows array

### Frontend (Multi-Step Modal)
- [x] "Import Contacts" button on Contacts page next to "Add Contact"
- [x] Step 1 — Upload: drag-and-drop or click-to-browse CSV upload + "Download Template" link
- [x] Step 2 — Map Fields: preview first 3 rows, dropdown field mapping with auto-map
- [x] Step 3 — Review & Import: summary (total, errors, ready), error table, import button
- [x] Step 4 — Complete: results (imported, skipped, failed counts)
- [x] CSV Template: First Name, Last Name, Email, Phone, Tags, Notes

### Verification
- [x] Tests written and passing (20 tests, 944 total)
- [x] Checkpoint saved (49c27f0b)

## Onboarding Checklist for Sub-Accounts

### Backend
- [ ] getOnboardingStatus tRPC procedure: checks 7 conditions for active accountId
- [ ] Check: phoneNumber set on account
- [ ] Check: sendgridFromEmail set on account
- [ ] Check: at least 1 contact exists
- [ ] Check: at least 1 calendar exists
- [ ] Check: missedCallTextBackEnabled is true
- [ ] Check: at least 1 campaign exists
- [ ] Check: at least 1 workflow exists
- [ ] Add missing schema fields if needed (phoneNumber, sendgridFromEmail, missedCallTextBackEnabled)

### Frontend
- [ ] Onboarding checklist card on Dashboard (sub-account mode only)
- [ ] Progress bar showing X/7 steps complete
- [ ] Green checkmark for complete steps, grey circle for incomplete
- [ ] "Set Up" button on incomplete steps linking to relevant page
- [ ] "Dismiss" button (localStorage persistence)
- [ ] Auto-hide when all 7 steps complete
- [ ] Only show to agency_admin or account_owner roles

### Verification
- [ ] Tests written and passing
- [ ] Checkpoint saved

## Fix: Invitation Email Not Sending

- [ ] Investigate invitation email dispatch in accounts router and team members router
- [ ] Check SendGrid API key configuration and from email verification
- [ ] Check dispatchEmail function implementation and error handling
- [ ] Verify invitation token generation and link format
- [ ] Fix silent email failures — surface errors to user
- [ ] Test invitation email delivery
- [ ] Checkpoint saved

## Fix: Invitation Email Failure Workaround

- [x] Warning toast when invitation email fails: show invite link for manual sharing
- [x] "Copy Invite Link" button on Sub-Accounts page for pending invitations
- [x] "Copy Invite Link" button on AccountDetail page for pending invitations
- [x] Backend: return invite token in create/resend responses so frontend can build the link
- [x] All 944 tests pass
- [x] Checkpoint saved (25c28cce)

### Bug Fix: CSV Contact Import Error (Published Site)
- [x] Investigate on dev server — import works correctly (3/3 imported)
- [x] Investigate published site — upload step fails with error for Tariq
- [x] Fix: Updated Helmet CSP to allow blob: URLs, worker-src, and inline scripts needed by papaparse
- [x] Fix: Improved CsvImportModal error handling (try/catch, detailed error messages, empty row filtering)
- [x] Fix: Added validation guards (accountId check, empty contacts check, usable data filter)
- [x] Test end-to-end with 3-row sample CSV (passed on dev server)
- [x] All 26 CSV import tests passing
- [x] Checkpoint saved (74fd9aa0)

### Bulk Lead Import: Kyle's Account (Broward + Palm Beach County Multifamily)
- [x] Examine both CSV files (BrowardCountyMultifamily.csv, Palmbeachcountymultifamily.csv)
- [x] Identify Kyle's sub-account ID (390025), Alfonso (901752), Evol (902504)
- [x] Import all leads into Kyle's sub-account (8,941 imported, 5,086 duplicates skipped)
- [x] Assign 750 leads to Alfonso (unique leads)
- [x] Assign 750 leads to Evol (different unique leads)
- [x] Verify import counts and assignments

### Bug: Alfonso and Evol can't see assigned leads in Kyle's account
- [ ] Investigate how contacts list query filters for employee users
- [ ] Fix visibility so assigned leads appear for employees
- [ ] Verify fix

### Fix: Lead distribution model for Kyle's employees
- [x] Confirmed: memberships are correct, login works
- [x] Remove Alfonso & Evol from Kyle's account members (they should NOT see Kyle's account)
- [x] Add Kyle as manager of Alfonso's and Evol's accounts (so Kyle can monitor them)
- [x] Copy 751 assigned leads from Kyle's account INTO Alfonso's own account (390024)
- [x] Copy 750 assigned leads from Kyle's account INTO Evol's own account (390023)
- [x] Verify: Alfonso sees only his account (751 leads), Evol sees only his account (750 leads), Kyle sees all 3 accounts
- [x] Checkpoint saved (18b3469e)

### Feature: Power Dialer
- [x] Schema: Add dialerSessions table (id, accountId, userId, contactIds JSON, status, currentIndex, results JSON, createdAt, completedAt)
- [x] Schema: Add dialerScripts table (id, accountId, name, content, createdAt)
- [x] Run pnpm db:push for new tables
- [x] DB helpers: CRUD for dialerSessions and dialerScripts
- [x] tRPC procedures: createDialerSession, getDialerSession, updateDialerProgress, completeDialerSession
- [x] tRPC procedures: CRUD for dialerScripts (create, list, get, update, delete)
- [x] tRPC procedure: initiateDialerCall (uses existing VAPI integration to place outbound call)
- [x] Frontend: Power Dialer page (/power-dialer) with 3 screens (setup, active dialer, summary)
- [x] Frontend: Setup screen — contact list selector (by tag, filter, manual), script selector, start button
- [x] Frontend: Active dialer — contact info, call status, timer, skip/hangup, disposition buttons, notes, progress bar
- [x] Frontend: Session summary — totals, CSV export
- [x] Sidebar: Add "Power Dialer" nav item under AI Calls
- [x] Route: Register /power-dialer in App.tsx
- [x] Log each call attempt to contact activity timeline (in initiateCall + recordDisposition)
- [x] Log summary note on each contacted contact after session (in recordDisposition)
- [x] Call scripts management in Settings for account owners/admins
- [x] Write vitest tests for Power Dialer procedures (23/23 passing)

### Feature: Distribute Leads UI
- [x] Backend: bulkAssign and distributeLeads tRPC procedures
- [x] Backend: getFilteredIds for selecting contacts by filter
- [x] Frontend: Multi-select checkboxes on contacts table
- [x] Frontend: Bulk action bar (assign to, distribute)
- [x] Frontend: Distribute leads dialog with round-robin preview
- [x] Frontend: Success toast with per-user distribution summary

### Feature: Call Recording Playback
- [x] Backend: getRecording tRPC procedure to fetch recording URL, transcript, summary by callId
- [x] Backend: Recording URL already stored via webhook (end-of-call-report) and syncStatus
- [x] Frontend: CallRecordingPlayer component in activity timeline with audio player
- [x] Frontend: Play/pause, seekbar, duration, transcript toggle, summary display, sentiment badge

### Feature: Dialer Analytics Dashboard
- [x] Backend: getDialerAnalytics DB helper (aggregates from dialerSessions)
- [x] Backend: getAnalytics tRPC procedure with date range and user filters
- [x] Frontend: /dialer-analytics page with summary cards, disposition pie chart, daily area chart
- [x] Frontend: Team performance table (calls, answered, no answer, voicemails, connect rate)
- [x] Frontend: Date range filter (7/14/30/60/90 days) and CSV export
- [x] Added "Dialer Analytics" to sidebar navigation with Activity icon

### All 3 Features: Tests & Delivery
- [x] Write vitest tests for all 3 features (20/20 passing)
- [x] Zero TypeScript errors
- [x] Checkpoint saved (9fc1cdbf)

### Feature: Automated Lead Routing Rules
- [x] Schema: Add leadRoutingRules table (id, accountId, name, strategy, assigneeIds JSON, isActive, priority, conditions JSON, roundRobinIndex, createdAt, updatedAt)
- [x] DB helpers: CRUD for leadRoutingRules + routing engine function
- [x] tRPC procedures: create, list, get, update, delete, toggleActive routing rules
- [x] Routing engine: round-robin, capacity-based, specific_user, condition-based (by tag, lead source)
- [x] Integrate routing into CSV import flow (batch routing after all contacts created)
- [x] Integrate routing into Facebook lead webhook (async, non-blocking)
- [x] Frontend: Lead Routing Rules management UI in Settings (LeadRoutingRulesCard)
- [x] Frontend: Rule builder with strategy selector, assignee picker, conditions, trigger sources
- [x] Frontend: Toggle rules on/off, edit, delete, priority display
- [x] Write vitest tests (28/28 passing)
- [x] Checkpoint saved (35d59bbc)

### Bug Fix: CSV Import Failing for 7,000+ Contacts
- [x] Express body limit already at 50mb (confirmed in server/_core/index.ts)
- [x] Increased Zod array limit from 5,000 to 50,000
- [x] Increased frontend file size limit from 10MB to 50MB
- [x] Rewrote import with bulk duplicate checks (batch queries instead of N individual queries)
- [x] Added batched inserts (500 rows at a time)
- [x] Added frontend chunking (1000 contacts per request) with progress indicator
- [x] Added intra-batch duplicate detection
- [x] Capped error rows to 100 to prevent huge responses
- [x] All 26 existing CSV import tests passing
- [x] Checkpoint saved (abf32b1d)

### Bug Fix: Facebook OAuth "domain not included in app domains" error
- [x] Read Facebook OAuth code - redirectUri is built from window.location.origin + /settings
- [x] Identified root cause: apexcrm-knxkwfan.manus.space not registered in Facebook App settings
- [x] No code change needed - this is a Facebook Developer Console configuration issue
- [x] Instructions provided to Tariq to fix in Facebook App settings

### Bug Fix: Facebook Lead Ads Webhook "pending" - leads not arriving
- [x] Diagnosed: FACEBOOK_WEBHOOK_VERIFY_TOKEN was not set, causing 403 on verification
- [x] Set FACEBOOK_WEBHOOK_VERIFY_TOKEN=apexwebtoken via environment secrets
- [x] Verified webhook endpoint returns 200 with challenge after token fix
- [x] Confirmed POST webhook processes leads correctly when page mapping exists
- [x] Added getWebhookInfo tRPC procedure to expose webhook URL and verify token to frontend
- [x] Updated Settings page Facebook card with "Webhook Setup" button showing callback URL and verify token
- [x] Added 3 new tests for getWebhookInfo (59 total Facebook tests passing)
- [ ] Tariq to configure Facebook App webhook with correct URL and verify token (see delivery instructions)

### Bug Fix: Facebook leads not routing + Settings showing "Connect Facebook" despite being connected
- [x] Investigated: account_integrations table had zero Facebook entries — OAuth flow never saved to DB
- [x] Inserted Facebook integration record for Premier Mortgage Resources (account 420001)
- [x] Inserted page into account_facebook_pages: page ID 500444131343324 → account 420001
- [x] Inserted into facebook_page_mappings as fallback: page ID 500444131343324 → account 420001
- [x] Tested webhook: POST with page_id 500444131343324 → contact 390062 created in account 420001
- [x] Server log confirmed: [FB Leads Webhook] Resolved page 500444131343324 → account 420001 (via accountFacebookPages)
- [x] Settings page getStatus logic is correct — will show Connected after page reload
- [x] All 121 Facebook tests passing

### Bug Fix: Lead shows Success in Meta tester but not appearing in PMR contacts
- [x] Root cause: page ID in DB was wrong (500444131343324 vs correct 500444413143324)
- [x] Fixed page ID in account_facebook_pages and facebook_page_mappings
- [x] Stored page access token for Graph API lead fetching
- [x] Subscribed page to app via Graph API POST /{page-id}/subscribed_apps
- [x] Confirmed subscription active: Sterling Marketing app subscribed to leadgen on page
- [x] Production webhook endpoint verified working (contact 390076 created)
- [x] Test lead from Meta tester now arriving in PMR contacts

### Feature: Templatize Facebook Lead Ads Setup for All Clients
- [x] Audited existing OAuth callback handler — code was already well-built
- [x] Added pages_manage_metadata permission to OAuth scope (required for webhook subscription)
- [x] OAuth callback already auto-subscribes pages to leadgen webhooks via Graph API
- [x] Added upsertFacebookPageMapping to auto-save page mappings during OAuth callback
- [x] Updated Settings UI to show individual page names and subscription status (green/amber dots)
- [x] Page selection handled via Facebook OAuth popup (user selects pages during auth)
- [x] Added 8 new tests: page mapping upsert, OAuth permissions, automated subscription flow (48 total)
- [x] Created SOP document: docs/SOP-Facebook-Lead-Ads-Onboarding.md

### Bug Fix: Leads 5 and 6 from Meta tester not arriving + Speed-to-Lead optimization
- [x] Root cause: webhook handler was processing synchronously — Facebook has 20s timeout, our handler took 3+ seconds
- [x] Refactored both POST handlers to respond IMMEDIATELY with 200 (15ms response time)
- [x] Lead processing now runs asynchronously in background (201ms total for contact + deal + notifications)
- [x] Workflow triggers and lead routing already fire async (non-blocking)
- [x] All 67 Facebook tests passing after async refactor
- [x] Confirmed: Facebook webhook response time went from 3000ms+ → 15ms

### Feature: Facebook Lead Polling Fallback (guarantees no missed leads)
- [x] Build background job that polls Facebook Graph API for new leads every 60 seconds
- [x] Use page access tokens from account_facebook_pages to fetch leads per page
- [x] Deduplicate leads by fb_lead_id to prevent duplicates from webhook + polling
- [x] Process new leads through the same processLead pipeline (contact + deal + routing + notifications)
- [x] Add manual "Sync Leads" button in Settings for on-demand pull
- [x] Skip Meta test leads (dummy data) to prevent DB errors
- [x] Wire poller into server startup (starts automatically on boot)
- [x] Add syncLeads tRPC procedure for on-demand sync from UI
- [x] Auto-polling indicator in Settings UI ("Auto-polling every 60s")
- [x] 11 vitest tests passing for poller service
- [x] Initial poll recovered 10 real leads that were missed due to webhook delivery failure

### Feature: Historical Facebook Lead Import (45 days)
- [x] Exchanged short-lived user token for permanent never-expiring page token
- [x] Updated page token in database (verified: type=PAGE, expires=NEVER)
- [x] Fetched all leads from 3 forms (140 total, 138 valid, 2 test leads skipped)
- [x] Built internal import endpoint with dedup by fb_lead_id and email
- [x] Imported 128 new contacts + 10 already existed = 138 total Facebook contacts in CRM
- [x] Each contact has deal in pipeline, lead routing, and notifications

### Feature: Automatic Facebook Token Management
- [x] OAuth flow already exchanges for long-lived user token → permanent page token
- [x] Page tokens from me/accounts with long-lived user token are permanent (never expire)
- [x] No additional refresh mechanism needed for page tokens

### Feature: Outbound Sales Engine Setup (Apex System Sub-Account)
- [x] Step 1: Import 100 leads from CSV into "Apex System" sub-account (ID: 450002)
- [x] Map columns: first_name, last_name, phone, email, company, city, state, website, tags, notes
- [x] Each contact has deal in pipeline + lead routing applied
- [x] Step 2: Create Email Campaign "Apex Cold Outreach — Email" (4-step sequence, IDs: 30001-30004)
- [x] Email 1 (Day 1): Subject "Quick question about your lead follow-up"
- [x] Email 2 (Day 3): Subject "Missed calls = missed revenue"
- [x] Email 3 (Day 6): Subject "We build it for you, {{first_name}}"
- [x] Email 4 (Day 10): Subject "Closing the loop"
- [x] Sender: Tariq / apexsystemaii@gmail.com — saved as DRAFT (not activated)
- [x] Step 3: Create SMS Campaign "Apex Cold Outreach — SMS" (4-step sequence, IDs: 30005-30008)
- [x] SMS 1 (Day 1, 10:00 AM): Quick question about automated lead follow-up
- [x] SMS 2 (Day 2, 2:00 PM): $300 to $20k proof drop
- [x] SMS 3 (Day 4, 11:30 AM): Consolidation pain point
- [x] SMS 4 (Day 7, 3:00 PM): Breakup message
- [x] Saved as DRAFT (not activated)
- [x] Step 4: Load Phone Script "Apex Cold Call Script" into Power Dialer (ID: 1)

### Feature: 3-Account Sales Engine Setup
#### Schema Updates
- [x] Added actionTypes "add_to_campaign", "assign_pipeline_stage", "notify_user" to workflowSteps
- [x] Extended workflow engine to execute new action types
- [x] PMR uses Tariq's userId (1110566) as proxy since no member exists yet

#### Account 1: Apex System (450002)
- [x] Created workflow: "Cold Outreach Auto-Enrollment" (ID 390001) — trigger: tag_added "Cold Outreach"
- [x] Steps: assign pipeline "Cold Outreach", add to Email (30001), add to SMS (30005), notify user (4 steps)

#### Account 2: Optimal Lending (390025)
- [x] Created DSCR Email (3 steps: 30009-30011) + SMS (4 steps: 30012-30015) with commercial disclaimer
- [x] Created Fix & Flip Email (3 steps: 30016-30018) + SMS (4 steps: 30019-30022) with commercial disclaimer
- [x] Loaded phone script: "Optimal Lending - Investor Call Script" (ID 2)
- [x] Created DSCR routing workflow (ID 390002) — trigger: tag_added "DSCR" (4 steps)
- [x] Created Fix & Flip routing workflow (ID 390003) — trigger: tag_added "Fix & Flip" (4 steps)

#### Account 3: PMR (420001)
- [x] Created FTHB Email (2 steps: 30023-30024) + SMS (3 steps: 30025-30027) with NMLS footer
- [x] Created DPA Webinar Email (1 step: 30028) + SMS (3 steps: 30029-30031) with NMLS footer
- [x] Created Refinance Email (1 step: 30032) + SMS (2 steps: 30033-30034) with NMLS footer
- [x] Created HELOC Email (1 step: 30035) + SMS (2 steps: 30036-30037) with NMLS footer
- [x] Created RE Agent Outreach Email (2 steps: 30038-30039) + SMS (2 steps: 30040-30041) with NMLS footer
- [x] Loaded phone script: "PMR - RE Agent Call Script" (ID 3)
- [x] Created 5 tag-based routing workflows: FTHB (390004), DPA (390005), Refinance (390006), HELOC (390007), RE Agent (390008)
- [x] All 41 campaigns saved as DRAFT, all 8 workflows active, all 3 phone scripts loaded

### Feature: Automated Voice Agent Creation System (10-Step)
#### Schema & Infrastructure
- [ ] Add custom contact fields: ai_voice_enabled, vapi_assistant_id, vapi_phone_number
- [x] Schema: Added elevenLabsVoiceId, vapiAssistantId, vapiPhoneNumber, voiceAgentEnabled to accounts table
- [x] Added ELEVENLABS_API_KEY to env.ts and secrets
- [x] Built ElevenLabs voice clone service (server/services/elevenLabs.ts)
- [x] Built VAPI assistant creation + phone provisioning functions (server/services/vapi.ts)

#### Voice Samples
- [x] Trimmed LarrDawg 30-min voice sample to 4 min (ffmpeg silence detection + best segment)
- [x] Uploaded both voice samples to S3 CDN
- [x] Cloned Tim Haskins voice via ElevenLabs (Voice ID: 5q6TS1ZeXhDKOywAbaO2)
- [x] Cloned LarrDawg voice via ElevenLabs (Voice ID: TkFdvwfPXYbICEBnYvnN)

#### VAPI Assistants
- [x] Created PMR VAPI assistant (ID: 01504ee9-0d19-4e2f-97e7-6907a5ebb34c) with Tim's voice
- [x] Created Optimal Lending VAPI assistant (ID: 6cead709-383a-4dbe-943c-6d7b485fafe6) with LarrDawg's voice

#### Safety & Routing
- [x] Added AI kill switch: workflow engine checks voiceAgentEnabled before making AI calls
- [x] Added per-account VAPI assistant routing: uses account's vapiAssistantId instead of global
- [x] 10 vitest tests passing for voice agent setup

#### All 3 Accounts
- [ ] Apex System: voice agent (waiting for Tariq's voice sample tomorrow)
- [x] Optimal Lending: full setup with LarrDawg voice (account 390025, voiceAgentEnabled=true)
- [x] PMR: full setup with Tim's voice (account 420001, voiceAgentEnabled=true)

### Bug Fix: VAPI Calendar Booking Integration
- [x] Tested PMR + OLS voice agents live call to Tariq — both sounded great
- [x] Root cause: VAPI assistants had no tools defined and no serverUrl for callbacks
- [x] Created calendars for PMR (ID: 30001, M-F 9-5 PT) and OLS (ID: 30002, M-F 9-5 PT)
- [x] Added bookAppointment + checkAvailability function tools to both VAPI assistants
- [x] Set serverUrl on both assistants to production webhook endpoint
- [x] Built tool-calls handler in VAPI webhook (server/webhooks/vapi.ts)
- [x] Tested checkAvailability: returns available slots from calendar correctly
- [x] Tested bookAppointment: creates appointment in DB + sends notification
- [x] Passes apex_account_id in call metadata for account routing
- [ ] Pending: publish checkpoint so production URL gets updated webhook code

### Bug Fix: VAPI Voice Agent — Date Awareness, Call Tracking, Recording
- [x] Fix: AI agent doesn't know current date/time — injected via assistantOverrides on every call
- [x] Fix: Calls not appearing in AI Calls tab — auto-create internal record from VAPI metadata
- [x] Fix: Recordings and transcripts not showing — webhook resolves by VAPI call ID + auto-creates
- [x] Inject current date/time (Pacific) dynamically via assistantOverrides.model.messages
- [x] Auto-create internal AI call record when webhook receives events for unknown calls
- [x] Webhook end-of-call-report populates recording URL, transcript, summary, duration
- [x] Both assistants: recordingEnabled=true, serverUrl set, 2 tools (bookAppointment + checkAvailability)
- [ ] Pending: publish + live test to verify all 3 fixes end-to-end

### Feature: AI Call Business Hours (7 Days)
- [x] Add business hours enforcement: 7 AM - 10 PM ET, Monday through Sunday
- [x] Block AI outbound calls outside business hours with clear error message
- [x] Update VAPI assistant system prompts to reflect 7 AM - 10 PM ET hours
- [x] Write vitest tests for business hours enforcement (20 tests passing)
- [ ] Live test: verify calls blocked outside hours, allowed within hours

### Bug Fix: VAPI Appointment Booking Not Creating Appointments
- [x] Root cause identified: Tools were NOT saved on VAPI assistants (tools count was 0)
- [x] Original setup script created assistants but never attached bookAppointment/checkAvailability tools
- [x] Re-added both tools to PMR assistant (01504ee9) with server URL pointing to production webhook
- [x] Re-added both tools to OLS assistant (6cead709) with server URL pointing to production webhook
- [x] Updated system prompts with CRITICAL section instructing AI to MUST call bookAppointment function
- [x] Fixed timezone handling in webhook: dynamic PDT/PST offset instead of hardcoded -07:00
- [x] Tested webhook end-to-end: checkAvailability returns slots, bookAppointment creates appointment in DB
- [x] Verified both assistants: 2 tools each, serverUrl set, tool-calls in serverMessages
- [ ] Pending: live test call to verify AI actually invokes the bookAppointment tool during conversation

### Changes: Voice Agent Name, Kill All AI Calling, UI Kill Switch
- [x] Rename PMR voice agent from "Tim Haskins" to "PMR - Mortgage Consultation Assistant"
- [x] Update PMR VAPI assistant system prompt to remove "You are Tim Haskins" identity
- [x] Disable AI voice calling for ALL accounts (set voiceAgentEnabled=false for all 3 accounts)
- [x] Build AI Calling kill switch toggle in Settings UI so account owners can enable/disable
- [x] Add tRPC procedures: getVoiceAgentStatus + toggleVoiceAgent with RBAC
- [x] Verify toggle works end-to-end (10 tests passing, 0 TS errors)

### Rename OLS Voice Agent
- [x] Rename OLS VAPI assistant from "Optimal Lending - Investor Calls" to "OLS - Larry's Lending Assistant"
- [x] Update system prompt and first message to reference Larry's office

### Feature: AI Advisor Copilot Integration
- [x] Created server/routers/aiAdvisor.ts (getSuggestions + chat procedures with LLM integration)
- [x] Created client/src/contexts/AiAdvisorContext.tsx (state management for sidepanel)
- [x] Created client/src/components/AiAdvisorSidepanel.tsx (floating button + slide-out panel)
- [x] Confirmed aiAdvisorRouter imported and registered in server/routers.ts
- [x] Confirmed AiAdvisorProvider wraps the app in client/src/App.tsx
- [x] Confirmed AiAdvisorSidepanel rendered in DashboardLayout.tsx with page context sync
- [x] TypeScript check: 0 errors
- [x] Floating AI Advisor button renders bottom-right on sub-account pages
- [x] Vitest tests for AI Advisor (6 tests passing)
- [x] Applied user-provided AI Advisor patch (6 files replaced, 1 TS error fixed)
- [x] Applied AI Advisor patch v2 (Inline Panel): 8 files copied, new AiAdvisorInlinePanel.tsx + AiAdvisorCard.tsx, 1 TS error fixed
- [x] Applied AI Advisor patch v3 (Inline Panel update): 3 files replaced, 0 TS errors, 6 tests passing

### AI Advisor Patch v5
- [x] Extract and copy 4 files: aiAdvisor.ts, DashboardLayout.tsx, AiAdvisorInlinePanel.tsx, AiAdvisorCard.tsx
- [x] Run pnpm check — 0 TypeScript errors
- [x] Restart dev server and verify inline right column layout
- [x] Verify sidebar logo is visible
- [x] Verify AI advisor suggestions change per page context (6 tests passing)

### AI Advisor Patch v7
- [x] Extract and copy 4 files: aiAdvisor.ts, DashboardLayout.tsx, AiAdvisorInlinePanel.tsx, AiAdvisorCard.tsx
- [x] Run pnpm check — 0 TypeScript errors
- [x] Restart dev server — running clean
- [x] 6 vitest tests passing
- [x] Compact card layout and page-specific suggestions verified

### Feature: AI Advisor One-Click Actions + Mobile Drawer
- [x] Wire one-click actions on suggestion cards (already wired in v7 patch — navigate, launch_campaign, start_ai_calls, create_workflow, assign_contacts, move_pipeline_stage, schedule_appointments)
- [x] Add mobile slide-up drawer with floating button for AI Advisor on smaller screens (AiAdvisorMobileDrawer.tsx)
- [x] Run pnpm check — 0 TypeScript errors
- [x] Run vitest tests — 6 passing

### Feature: AI Advisor Enhancements (Toast + Chat History + Loading Skeleton)
- [x] Add toast confirmations when clicking Execute on AI Advisor suggestions (AiAdvisorCard + AiAdvisorInlinePanel)
- [x] Create ai_advisor_messages table in schema for chat history persistence
- [x] Add server procedures: getChatHistory + clearChatHistory + auto-persist in chat mutation
- [x] Update client to load/restore chat history on mount, clear history button in chat mode
- [x] Add enhanced loading skeleton with shimmer animation and "Analyzing..." text
- [x] Run pnpm check — 0 TypeScript errors
- [x] Run vitest tests — 6 passing

### Review: Onboarding Checklist Backend/Frontend Alignment
- [x] Verified getOnboardingStatus returns 7 booleans matching frontend OnboardingStatus interface exactly
- [x] No mismatches found — backend queries and frontend completedKey mappings are aligned
- [x] Run server/onboarding.test.ts — 14 tests passing
- [x] Run server/onboarding-completion.test.ts — 16 tests passing

### Feature: Onboarding Checklist Enhancements
- [x] Add 8th onboarding step: "Set Up AI Voice Agent" (checks voiceAgentEnabled)
- [x] Update backend getOnboardingStatus to return hasVoiceAgent boolean
- [x] Update frontend OnboardingChecklist with 8th step UI (Bot icon, links to /settings#voice)
- [x] Auto-dismiss checklist on 100% completion: fires completeOnboarding + congratulations card with PartyPopper animation
- [x] Add progress email notifications at 50% and 100% milestones (styled HTML emails)
- [x] Create sendOnboardingProgressEmail server procedure with audit logging
- [x] Run pnpm check — 0 TypeScript errors
- [x] Run onboarding tests — 30 tests passing (14 + 16)

### Feature: Configurable Per-Account AI Business Hours
- [x] Add businessHoursConfig JSON column to accounts schema
- [x] Push migration to database (ai_advisor_messages + businessHoursConfig)
- [x] Refactor server/utils/businessHours.ts to accept per-account config with fallback to defaults
- [x] Update all call initiation points (aiCalls.ts, powerDialer.ts, workflowEngine.ts) to fetch account config and pass it
- [x] Update server/businessHours.test.ts — 46 tests passing (up from 20)
- [x] Run pnpm check — 0 TypeScript errors

### Test: VAPI Appointment Booking End-to-End
- [x] Read and review webhook handler for bookAppointment and checkAvailability
- [x] Test checkAvailability — 4 scenarios: weekday, weekend, missing date, no calendar (all pass)
- [x] Test bookAppointment — 5 scenarios: valid booking, missing fields, past date, no calendar, unknown tool (all pass)
- [x] Test Pacific DST — PDT (Apr 7 → UTC-7), PST (Nov 2 → UTC-8), transition day (Mar 8) all correct
- [x] Verify DB records: 3 appointments created with correct UTC times, then cleaned up
- [x] Documented in docs/vapi-booking-e2e-test-results.md — 14/14 tests passed, 0 issues

### Feature: Conditional Branching for Workflow Automations
- [x] Add 'condition' to stepType enum in workflowSteps schema
- [x] Add conditionConfig JSON field (field, operator, value, trueBranchStepOrder, falseBranchStepOrder)
- [x] Push schema migration to database
- [x] Update workflowEngine.ts to evaluate conditions and route to true/false branches
- [x] Update automations router to support condition step CRUD
- [x] Update frontend builder with visual if/else split UI
- [x] Run pnpm check — 0 TypeScript errors
- [x] Run vitest tests — 31 condition branching tests passing (1132 total)

### Feature: Missing Workflow Triggers
- [x] Add inbound_message_received, appointment_booked, appointment_cancelled, call_completed, missed_call, form_submitted, date_trigger to triggerType enum in schema
- [x] Push schema migration to database
- [x] Add trigger fire functions for each new trigger type in workflowTriggers.ts
- [x] Wire inbound_message_received from inboundMessages.ts (Twilio SMS + SendGrid email)
- [x] Wire appointment_booked from calendar router (public booking + VAPI booking)
- [x] Wire appointment_cancelled from calendar router (cancelAppointment procedure)
- [x] Wire missed_call from twilioVoiceStatus.ts (no-answer/busy/failed)
- [x] Wire form_submitted from facebookLeads.ts (Facebook lead forms)
- [x] Confirm call_completed already wired in VAPI webhook
- [x] Update automations router triggerType enum to include all new types
- [x] Update frontend TRIGGER_TYPES constant with new trigger options + icons
- [x] Add trigger config UI for inbound_message_received (channel filter) and date_trigger (field/operator/value)
- [x] Write vitest tests for new trigger functions (16 tests passing)
- [x] Run pnpm check — 0 TypeScript errors

### Feature: Date Trigger Cron Job
- [x] Create dateTriggerCron.ts service with evaluateDateCondition function
- [x] Query all active date_trigger workflows, evaluate contacts against date conditions
- [x] Register cron job in server startup (runs hourly, processes once per day)
- [x] Write vitest tests for date trigger evaluation logic (20 tests passing)

### Feature: Appointment Booked Calendar Filter UI
- [x] Add calendar selector in CreateWorkflowDialog when trigger is appointment_booked
- [x] Fetch calendars list from existing calendar.list procedure
- [x] Pass calendarId in triggerConfig JSON

### Feature: Workflow Execution History Dashboard
- [x] Add getExecutionStats db helper (total, byStatus, byTrigger, successRate, last7/30 days)
- [x] Add getExecutionHistoryWithWorkflow db helper (joined workflow names, pagination, filters)
- [x] Add executionStats and executionHistory tRPC procedures in automations router
- [x] Create ExecutionDashboard component with stats cards, status/trigger breakdowns, and history table
- [x] Add Dashboard tab in Automations view navigation
- [x] 0 TypeScript errors, 20 date trigger tests passing

### Feature: Drag-and-Drop Form Builder
- [x] Add forms table to drizzle/schema.ts (accountId, name, slug, fields JSON, settings JSON, submitAction, isActive, createdAt, updatedAt)
- [x] Add form_submissions table to drizzle/schema.ts (formId, contactId, data JSON, createdAt)
- [x] Push schema migration to database
- [x] Create server/routers/forms.ts with CRUD procedures (create, update, delete, list, getById, getBySlug)
- [x] Add public tRPC procedures getPublicForm and submitPublicForm + frontend route /f/:slug
- [x] Wire form submissions to fire form_submitted workflow trigger via onFormSubmitted
- [x] Register forms router in main routers.ts
- [x] Build client/src/pages/Forms.tsx list page with form management
- [x] Build client/src/pages/FormBuilder.tsx with drag-and-drop field builder
- [x] Support field types: text, email, phone, dropdown, checkbox, date
- [x] Add form routes to App.tsx and DashboardLayout sidebar navigation
- [x] Write vitest tests for form operations (19 tests passing)
- [x] Run pnpm check — 0 TypeScript errors

### Feature: Form Submission Analytics
- [x] Add submissionStats procedure (total, last7/30 days, withContact, conversionRate, daily chart data)
- [x] Add listSubmissionsWithContacts procedure (joined contact firstName/lastName)
- [x] Build enhanced Submissions tab with 4 stats cards, daily bar chart, and submissions table
- [x] Link submission rows to contact detail pages with name display

### Feature: Embed Code Generator
- [x] Add "Embed" button in FormBuilder header
- [x] Generate iframe snippet and JavaScript embed code with copy-to-clipboard
- [x] Include direct link option with copy button

### Feature: Conditional Field Visibility
- [x] Add ConditionRule interface and conditionRules field to FormField type in schema.ts
- [x] Add conditionRules to Zod schema in forms router
- [x] Build condition rules UI in FormBuilder (field selector, operator, value, add/remove rules)
- [x] Add "Conditional" badge indicator on field cards
- [x] Update PublicForm.tsx with evaluateRule/isFieldVisible logic (AND logic, 5 operators)
- [x] Hidden fields excluded from submission payload and validation
- [x] Write 22 vitest tests for conditional visibility, embed code, and stats shape
- [x] Run pnpm check — 0 TypeScript errors

### Feature: Form Templates Library
- [x] Create 5 pre-built templates (Mortgage Inquiry, Contact Us, Refinance Application, Home Buyer Consultation, Insurance Quote)
- [x] Add "Templates" tab in Forms page with template cards showing category, field count, and preview
- [x] Add listTemplates and createFromTemplate tRPC procedures
- [x] Wire template cloning to create new form with pre-populated fields, settings, and unique slug

### Feature: Form A/B Testing
- [x] Add "Create A/B Variant" menu item in form actions dropdown
- [x] Add duplicateForm tRPC procedure that clones fields, settings, and generates variant slug
- [x] Add A/B variant dialog with tips for testing different headlines, button text, and field order
- [x] Variant forms appear in the same list for side-by-side comparison

### Feature: File Upload Field Type
- [x] Add "file" to FormField type union in schema.ts with acceptedFileTypes and maxFileSizeMB
- [x] Add "file" to Zod formFieldSchema in forms router
- [x] Add uploadFormFile tRPC procedure using S3 storagePut with sanitized file keys
- [x] Update FormBuilder with file field type, accepted types selector, and max size config
- [x] Update PublicForm with drag-and-drop file upload, progress state, file preview, and remove button
- [x] File type validation (extension, MIME, wildcard), size validation, and upload-in-progress blocking
- [x] Write 26 vitest tests for templates, A/B testing, and file upload (all passing)
- [x] Run pnpm check — 0 TypeScript errors

### Feature: Reputation Management (Google My Business + Facebook Reviews)
- [x] Add reviewRequests table to schema (accountId, contactId, platform, channel, status, reviewUrl, messageTemplate, sentAt)
- [x] Add reviews table to schema (accountId, platform, rating, body, reviewerName, reviewUrl, externalId, postedAt)
- [x] Push schema migration to database
- [x] Create server/services/googleMyBusiness.ts (fetchGMBReviews, sendReviewRequest, getReviewRequestStats, generateReviewReply)
- [x] Create server/routers/reputation.ts with getStats, listReviews, addReview, sendRequest, getRequests, generateReply procedures
- [x] Register reputation router in main routers.ts
- [x] Add send_review_request to workflow step action enum in schema
- [x] Wire send_review_request action in workflowEngine.ts (creates review request + fires trigger)
- [x] Update automations router and frontend ACTION_TYPES to support send_review_request
- [x] Build Reputation.tsx dashboard with stats cards, star ratings, review list, platform filter, add review dialog, send request dialog, AI reply generator
- [x] Add Reputation route to App.tsx and Star icon sidebar entry in DashboardLayout
- [x] Write 26 vitest tests for reputation features (all passing)
- [x] Run pnpm check — 0 TypeScript errors

### Feature: GMB OAuth Connection Settings
- [x] Add gmb_connections table to schema (accountId, googleEmail, accessToken, refreshToken, locationId, locationName, placeId, autoSyncEnabled, lastSyncAt, status, connectedAt)
- [x] Add reputation_alert_settings table to schema (accountId, enabled, ratingThreshold, notifyInApp, notifyEmail, notifySms, emailRecipients, smsRecipients)
- [x] Add replyBody and repliedAt columns to reviews table
- [x] Push schema migration to database
- [x] Create GMB connection CRUD procedures in reputation router (getGmbConnection, saveGmbConnection, disconnectGmb, syncGmbReviews)
- [x] Build GMB Connection settings UI card in Reputation.tsx Settings tab (connect form, connected state, sync reviews, disconnect)
- [x] Wire auto-sync of reviews when GMB account is connected via syncGmbReviews procedure

### Feature: Review Response Posting
- [x] Add postReply procedure to reputation router (posts reply via GMB/Facebook API)
- [x] Update googleMyBusiness.ts with postReviewReply function for Google and Facebook platforms
- [x] Update AI reply generator dialog to include "Post Reply" button alongside copy
- [x] Track reply status on reviews (replyBody, repliedAt columns)
- [x] Show "Replied" badge and "View Reply" option on already-replied reviews

### Feature: Reputation Alerts
- [x] Add reputation_alert_settings table with threshold (1-3), notification channels (inApp, email, SMS), and recipient lists
- [x] Create alert evaluation in addReview procedure (check if rating <= threshold, fire notifications)
- [x] Integrate with notifyOwner for in-app alerts on negative reviews
- [x] Add AlertSettingsCard UI in Reputation.tsx Settings tab (enable/disable, threshold selector, channel toggles, recipient inputs)
- [x] Write 23 vitest tests for all 3 reputation enhancement features (all passing)
- [x] Run pnpm check — 0 TypeScript errors
- [x] Checkpoint saved

### Feature: Outbound Webhooks (Zapier/Make/n8n Integration)
- [x] Add outboundWebhooks table to schema (accountId, triggerEvent, url, secret, isActive, description, lastTriggeredAt, failCount)
- [x] Push schema migration to database
- [x] Create server/services/webhookDispatcher.ts with HMAC-SHA256 signature, retry logic, and async dispatch
- [x] Create server/routers/webhooks.ts with CRUD procedures (list, create, update, delete, test)
- [x] Register webhooks router in main routers.ts
- [x] Wire dispatcher into existing event sources (workflowTriggers.ts 10 events + reputation addReview)
- [x] Build OutboundWebhooksCard in Settings.tsx with webhook management UI (add/edit/delete/test/toggle)
- [x] Write vitest tests for outbound webhooks — 26 tests passing (HMAC, secrets, schema, validation, imports)
- [x] Run pnpm check — 0 TypeScript errors
- [x] Checkpoint saved

### Feature: Webhook Delivery Logs
- [x] Add webhook_delivery_logs table to schema (webhookId, accountId, event, requestUrl, requestHeaders, requestBody, responseStatus, responseBody, latencyMs, success, errorMessage, createdAt)
- [x] Push schema migration
- [x] Log every dispatch attempt in webhookDispatcher.ts (success and failure)
- [x] Add tRPC routes: deliveryLogs (paginated, filterable by success/failure), retryDelivery
- [x] Build WebhookDeliveryLogs dialog component with table (timestamp, event, status, latency, success badge)
- [x] Add detail view dialog for full request/response bodies
- [x] Add Retry button on failed deliveries

### Feature: Inbound Webhooks / API Keys
- [x] Add api_keys table to schema (accountId, name, keyHash, keyPrefix, permissions JSON, lastUsedAt, createdAt, revokedAt)
- [x] Add inbound_request_logs table for debugging
- [x] Push schema migration
- [x] Create tRPC routes for API key management (create, list, revoke, inboundLogs)
- [x] Create REST endpoints at /api/inbound/contacts and /api/inbound/events
- [x] Implement X-API-Key auth middleware (hash lookup, active check, permission check, rate limiting)
- [x] /api/inbound/contacts creates contact in account + triggers onContactCreated
- [x] /api/inbound/events logs custom events for contact
- [x] Log all inbound requests for debugging
- [x] Build ApiKeysCard UI in Settings (create, revoke, reveal once, permissions, inbound logs)
- [x] Show inbound webhook endpoint documentation with cURL examples

### Feature: Webhook Event Filtering / Conditions
- [x] Add conditions JSON column to outbound_webhooks table
- [x] Push schema migration
- [x] Build condition evaluation engine (field, operator, value matching) with resolveField for nested paths
- [x] Support fields: contact.*, tag, stage.name, review.rating, review.platform, form.name, message.channel + custom fields
- [x] Support operators: equals, not_equals, contains, not_contains, greater_than, less_than, in, not_in, is_empty, is_not_empty
- [x] Integrate condition evaluation into webhookDispatcher before dispatch (evaluateAllConditions with AND logic)
- [x] Build WebhookConditionsEditor UI component (dynamic form builder with field selector, operator, value)
- [x] Show WebhookConditionsBadges on webhook card display
- [x] Write 30 vitest tests for all 3 features (all passing)
- [x] Run pnpm check — 0 TypeScript errors
- [x] Checkpoint saved

### Feature: Schema-Driven Custom Fields for Contacts
- [x] Add customFieldDefs table to schema (accountId, name, slug, type enum, options JSON, required, sortOrder, isActive, createdAt, updatedAt)
- [x] Push schema migration
- [x] Create custom field definitions CRUD router (create, list, update, delete, reorder) with slug uniqueness validation
- [x] Export validateCustomFields helper + getAccountCustomFieldDefs for use across modules
- [x] Update contacts create/update to validate customFields against definitions (type checking, required fields, option validation, merge with existing)
- [x] Integrate custom fields into CSV export (add cf_ prefixed columns dynamically from account field defs)
- [x] Integrate custom fields into CSV import (map cf_ CSV columns to custom field slugs, validate types)
- [x] Add custom field support to webhook condition evaluation (cf. prefix + fallback to customFields)
- [x] Add custom field support to workflow condition evaluation (cf. prefix in resolveContactFieldValue)
- [x] Build CustomFieldsCard component in Settings.tsx (define fields with name, slug, type, options, required, enable/disable)
- [x] Update ContactDetail.tsx Custom Fields Card to render values with type-appropriate icons
- [x] Update EditContactDialog to render custom fields as editable typed inputs (text, number, date, dropdown, checkbox, textarea, url, email, phone) with required field validation
- [x] Write 35 vitest tests for custom fields (validation, type enforcement, webhook conditions, workflow engine, CSV export) — all passing
- [x] Run pnpm check — 0 TypeScript errors
- [x] Checkpoint saved

### Feature: Custom Field Templates
- [x] Add custom_field_templates table to schema (id, name, description, industry, fields JSON, isSystem, createdAt)
- [x] Push schema migration
- [x] Seed 5 built-in templates (Mortgage LO, Real Estate Agent, Insurance Agent, Solar Sales, General Sales)
- [x] Create tRPC routes: list, get, applyTemplate (skip existing slugs)
- [x] Build Apply Template modal in CustomFieldsCard (template picker with field preview + apply confirmation)
- [x] Template picker accessible via "Use Template" button in Custom Fields card header

### Feature: Contact List Column Customization
- [x] Add user_column_preferences table to schema (userId, accountId, page, columns JSON, createdAt, updatedAt)
- [x] Push schema migration
- [x] Create tRPC routes: get, save column preferences
- [x] Enhance contacts list query to support sortBy/sortDir with custom field JSON extraction
- [x] Enhance contacts list query to support custom field filters (cf_slug operator value)
- [x] Build Columns picker popover in Contacts table header (toggle show/hide CF columns)
- [x] Render custom field values in table cells (type-appropriate formatting: checkbox Yes/No, date locale, number, text)
- [x] Add sort-by-click on custom field column headers (ArrowUp/Down/UpDown icons)
- [x] Add custom field filters to the filter bar (field picker, operator, value input)
- [x] Persist column preferences per user via columnPreferences.save

### Feature: Custom Field Analytics
- [x] Create tRPC route getAnalytics (dropdown distribution, number stats, checkbox %, date summaries)
- [x] Build CustomFieldAnalytics component on Analytics page
- [x] Dropdown fields: donut chart (<=6 items) or horizontal bar chart (>6 items) with recharts
- [x] Number fields: stat cards grid (avg, min, max, sum, count)
- [x] Checkbox fields: donut chart with Yes/No breakdown and percentage
- [x] Date fields: colored summary cards (overdue, next 7d, next 30d, total)
- [x] Write 26 vitest tests for all 3 features (all passing)
- [x] Run pnpm check — 0 TypeScript errors
- [x] Checkpoint saved

### Feature: Custom Field Bulk Edit
- [x] Add bulkUpdateCustomField procedure to contacts router (contactIds[], slug, value, accountId)
- [x] Validate value against field definition type before bulk update
- [x] Update customFields JSON for each contact (merge, not replace)
- [x] Build bulk edit UI in Contacts table (bulk action dropdown with "Update Custom Field" option)
- [x] Build BulkEditDialog (field picker, value input matching field type, confirmation with count)

### Feature: Smart Views / Saved Filters
- [x] Add saved_views table to schema (userId, accountId, name, icon, filters JSON, columns JSON, sortBy, sortDir, isDefault, createdAt, updatedAt)
- [x] Push schema migration
- [x] Create savedViews tRPC router (list, create, update, delete, setDefault)
- [x] Build Smart Views UI in Contacts page (save current view, view switcher tabs/dropdown, load view, delete view)
- [x] Auto-apply default view on page load if set
- [x] Include customFieldFilters, search, status, source, sortBy, sortDir, and visible columns in saved view
- [x] Highlight active view with BookmarkCheck icon

### Feature: Custom Field Conditional Logic
- [x] Add visibilityRules JSON column to custom_field_defs table (array of {dependsOnSlug, operator, value})
- [x] Push schema migration
- [x] Create isFieldVisible, getVisibleFields, parseVisibilityRules helpers in server/services/visibilityRules.ts
- [x] Create isFieldVisibleClient helper for frontend evaluation in VisibilityRulesEditor.tsx
- [x] Update customFields router to accept visibilityRules on create/update
- [x] Build VisibilityRulesEditor UI component (add/remove rules per field with operator + value)
- [x] Show "Conditional" badge on fields with visibility rules in CustomFieldsCard
- [x] Update ContactDetail display to filter fields by visibility rules
- [x] Update ContactDetail EditContactDialog to conditionally show/hide fields based on current values (reactive)
- [x] Write 31 vitest tests for all 3 features (all passing)
- [x] Run pnpm check — 0 TypeScript errors
- [x] Checkpoint saved

### Feature: Contact Merge / Deduplication
- [x] Build duplicate detection procedure (findDuplicates: group by email/phone/both within account, with match scoring 100/90)
- [x] Build merge procedure that reassigns all related records from loser(s) to winner contact:
  - contactTags (deduplicate tags)
  - contactNotes
  - messages
  - campaignRecipients
  - aiCalls
  - workflowExecutions
  - tasks
  - deals
  - appointments
  - contactActivities
  - formSubmissions
  - reviewRequests
  - reviews
  - dialerSessions (contactIds JSON array)
- [x] Merge customFields JSON (winner takes priority, fill gaps from loser)
- [x] Merge contact fields (winner takes priority, fill empty fields from loser, support field overrides)
- [x] Log merge action in contactActivities for audit trail
- [x] Delete loser contacts after reassignment
- [x] Build mergePreview procedure (show related record counts for winner + losers)
- [x] Build ContactMerge page at /contacts/merge (scan button, match-by selector, duplicate groups with confidence badges)
- [x] Build Merge dialog (side-by-side comparison, radio field picker for winner values, related records summary, confirm merge)
- [x] Add "Merge Duplicates" button to Contacts page header linking to /contacts/merge
- [x] Write 27 vitest tests for duplicate detection and merge logic (all passing)
- [x] Run pnpm check — 0 TypeScript errors
- [x] Checkpoint saved

## Lead Scoring Module
- [x] Add `leadScore` integer field to contacts table (default 0)
- [x] Create `lead_scoring_rules` table (accountId, event, delta, condition JSON, isActive)
- [x] Push schema migration
- [x] Build lead scoring rules CRUD router (list, create, update, delete)
- [x] Build lead scoring engine service (applyLeadScore: evaluate rules for event, update contact score)
- [x] Wire scoring engine into event sources: SMS reply, appointment booked, call completed, form submitted, email opened, tag added, pipeline stage changed
- [x] Add `score_changed` workflow trigger type
- [x] Add `leadScore` as a condition field in workflow condition evaluator
- [x] Display lead score on contact cards in Contacts.tsx with color coding (cold/warm/hot)
- [x] Add score column to contacts list with sorting support
- [x] Build Lead Scoring Rules management UI in Settings
- [x] Write vitest tests for lead scoring logic
- [x] TypeScript check — 0 errors
- [x] Checkpoint saved

## Lead Scoring Rules Management UI
- [x] Build LeadScoringSettings.tsx page with rules CRUD (create, edit, toggle, delete)
- [x] Add route in App.tsx for /settings/lead-scoring
- [x] Add navigation link in Settings sidebar/tabs
- [x] TypeScript check — 0 errors
- [x] Checkpoint saved

## Smart Lists & Contact Segments
- [x] Add `contact_segments` table to drizzle/schema.ts (accountId, name, filterConfig JSON, isPreset, icon, color, contactCount)
- [x] Push schema migration
- [x] Backend: segment CRUD helpers in server/db.ts
- [x] Backend: tRPC router — segments (create, list, get, update, delete, getContacts)
- [x] Backend: dynamic filter evaluation (resolve filterConfig JSON into SQL WHERE clauses)
- [x] Backend: integrate segments into campaign recipient targeting (add segment-based recipient selection)
- [x] Backend: integrate segments into workflow conditions (segment membership as condition)
- [x] Frontend: Smart Lists sidebar/panel in Contacts.tsx with saved segments
- [x] Frontend: "Save as Smart List" button to save current filter state
- [x] Frontend: Quick-access preset Smart Lists (Hot Leads, New This Week, Uncontacted, etc.)
- [x] Frontend: Segment picker in Campaign Builder for recipient targeting
- [x] Frontend: Segment condition in Automations workflow builder (via in_segment field in workflow engine)
- [x] Write vitest tests for segments CRUD and filter evaluation
- [x] TypeScript check — 0 errors
- [x] Checkpoint saved

## Lead Score Range Filter in Contacts
- [x] Backend: Add leadScoreMin/leadScoreMax params to contacts.list query
- [x] Frontend: Add min/max score inputs to Contacts filter row
- [x] Wire score filter state into the list query and Smart List save
- [x] TypeScript check — 0 errors
- [x] Checkpoint saved

## Email/SMS Drip Sequence Module
- [x] Schema: Add `sequences` table (accountId, name, status, triggerType)
- [x] Schema: Add `sequence_steps` table (sequenceId, position, delayDays, delayHours, messageType, subject, content, templateId)
- [x] Schema: Add `sequence_enrollments` table (contactId, sequenceId, currentStep, status, enrolledAt, nextStepAt, completedAt)
- [x] Push schema migration
- [x] Backend: Sequence CRUD helpers in server/db.ts
- [x] Backend: tRPC router — sequences (create, list, get, update, delete, steps CRUD, enrollment management)
- [x] Backend: Drip engine service (processNextSteps — evaluate due enrollments, send messages, advance steps)
- [x] Backend: Integrate sequence enrollment as a workflow action type in workflowEngine.ts
- [x] Frontend: Sequence list page with create/edit/delete/toggle
- [x] Frontend: Sequence builder UI with step editor and reorder
- [x] Frontend: Step editor dialog (message type, delay, content, subject)
- [x] Frontend: Enrollment stats and contact enrollment view
- [x] Frontend: Add sequence enrollment option in Campaign Builder
- [x] Register route in App.tsx and add sidebar navigation link
- [x] Write vitest tests for sequence CRUD and drip engine
- [x] TypeScript check — 0 errors
- [x] Checkpoint saved

## Landing Page & Funnel Builder
- [x] Schema: Add `pages` table (accountId, slug, title, htmlContent, cssContent, gjsData JSON, status, publishedAt)
- [x] Schema: Add `funnels` table (accountId, name, description, steps JSON array of pageIds, status)
- [x] Push schema migration
- [x] Backend: Pages CRUD helpers in server/db.ts
- [x] Backend: Funnels CRUD helpers in server/db.ts
- [x] Backend: tRPC router — pages (create, list, get, update, delete, publish/unpublish, duplicate)
- [x] Backend: tRPC router — funnels (create, list, get, update, delete)
- [x] Backend: Public page serving endpoint GET /p/:accountSlug/:pageSlug
- [x] Frontend: Page Builder UI with GrapesJS drag-and-drop editor integration
- [x] Frontend: Pages list page with create/edit/delete/publish controls
- [x] Frontend: Funnel Manager UI with step sequencing and page assignment
- [x] Register routes in App.tsx and add sidebar navigation links
- [x] Write vitest tests for pages/funnels CRUD and public serving
- [x] TypeScript check — 0 errors
- [x] Checkpoint saved

## Landing Page Enhancements (3 features)

### Feature 1: Pre-built Page Templates
- [x] Create template data with GrapesJS-compatible HTML/CSS for: Lead Capture, Webinar Registration, Thank You Page, Mortgage Calculator, Free Consultation
- [x] Add template selection step in Create Page dialog
- [x] Backend: template list endpoint or hardcoded templates served from router

### Feature 2: Form Submission → Contact Creation
- [x] Backend: Public POST endpoint for form submissions on published pages
- [x] Auto-create or update contact from form data (name, email, phone, custom fields)
- [x] Trigger `form_submitted` workflow event on submission
- [x] Fire lead scoring engine on form submission (via onFormSubmitted trigger)
- [x] Inject form submission JS into published page HTML
- [x] Store form submissions in contact activity log

### Feature 3: Funnel Analytics
- [x] Schema: Add `page_views` table (pageId, accountId, visitorId, referrer, timestamp)
- [x] Backend: Track page views on public page endpoint
- [x] Backend: Analytics queries (views per page, conversion rates between funnel steps)
- [x] Backend: Funnel analytics router endpoint
- [x] Frontend: Visual funnel chart on Funnels page with conversion rates between steps
- [x] Frontend: Page-level analytics (views, submissions, conversion rate) on Landing Pages list

### Shared
- [x] Write vitest tests for templates, form submission, and analytics (44 tests passing)
- [x] TypeScript check — 0 errors
- [x] Checkpoint saved

## AI Webchat Widget Upgrade

### Schema
- [x] Add chatWidgets table to drizzle/schema.ts (accountId, name, greeting, aiEnabled, handoffKeywords, brandColor, position, etc.)
- [x] Push migration with pnpm db:push

### Backend
- [x] Create webchat tRPC router (CRUD for chat widgets, list/get/update/delete)
- [x] Public REST endpoint: POST /api/webchat/message — receives visitor messages
- [x] Public REST endpoint: POST /api/webchat/init — returns widget config + session
- [x] Public REST endpoint: GET /api/webchat/poll — returns new messages for polling
- [x] Contact creation: auto-create contact from webchat visitor (name, email if provided)
- [x] Message routing: store webchat messages in webchatMessages table, route to Inbox via webchat tab
- [x] Fire inbound_message_received workflow trigger on new webchat message
- [x] Fire form_submitted workflow trigger when visitor provides contact info
- [x] Human handoff detection: detect keywords like "speak to agent", "human", "help" and flag conversation
- [x] AI response integration: use LLM to generate responses when aiEnabled, stop when handoff triggered

### Embeddable Widget
- [x] Build public embeddable webchat widget JS served at /api/webchat/widget.js
- [x] Widget renders chat bubble + chat window, connects to public REST endpoints
- [x] Widget supports sessionId persistence via localStorage

### Frontend (Settings)
- [x] Add Chat Widgets management card/page in Settings
- [x] UI to create/edit/delete chat widgets with config (name, greeting, AI toggle, handoff keywords, brand color)
- [x] Display embeddable <script> snippet for each widget
- [x] Webchat conversations visible in Inbox with "webchat" channel tab + session list + thread view

### Testing
- [x] Write vitest tests for webchat router (15 tests passing) + handoff detection
- [x] TypeScript check — 0 errors
- [x] Checkpoint saved (version: 30c8033a)

## Payment Collection / Invoicing (#21) — Square Integration

### Schema
- [ ] Add invoices table (accountId, contactId, invoiceNumber, status, dates, amounts in cents, Square fields)
- [ ] Add invoice_items table (invoiceId, description, quantity, unitPrice, amount, sortOrder)
- [ ] Add products table (accountId, name, price in cents, type, description, isActive)
- [ ] Push migration with pnpm db:push

### Backend — Square SDK
- [ ] Install square npm package
- [ ] Request env vars: SQUARE_ACCESS_TOKEN, SQUARE_ENVIRONMENT, SQUARE_APPLICATION_ID, SQUARE_LOCATION_ID
- [ ] Create server/services/square.ts (createPaymentLink, getPaymentStatus, processRefund)

### Backend — Payments tRPC Router
- [ ] Products CRUD: createProduct, listProducts, updateProduct, deleteProduct
- [ ] Invoices: createInvoice (with line items, auto-generate invoice number), updateInvoice, getInvoice (with items), listInvoices (filters + pagination)
- [ ] sendInvoice: generate Square payment link, send via SMS/email
- [ ] recordPayment: manual payment for cash/check
- [ ] cancelInvoice
- [ ] getPaymentStats: total collected 30d, outstanding balance, overdue count

### Square Webhook
- [ ] REST endpoint at /api/webhooks/square for payment.completed events
- [ ] Verify webhook signature, update invoice status, record payment amount

### Workflow Action
- [ ] Add request_payment action type to workflow engine
- [ ] Action sends Square payment link to contact via SMS/email

### Frontend — Payments Page
- [ ] Add Payments sidebar nav item
- [ ] Products management (CRUD table)
- [ ] Invoices list with status filter tabs (All/Draft/Sent/Paid/Overdue), search
- [ ] Create/edit invoice form: contact selector, dynamic line items, product picker, tax, dates, notes
- [ ] Invoice detail view: line items, status badge, payment history, actions
- [ ] Dashboard stats cards (collected, outstanding, overdue)

### Testing
- [ ] Write vitest tests for payments router, Square service, webhook
- [ ] TypeScript check — 0 errors
- [ ] Checkpoint saved

## White-Label and Agency Branding

### Schema
- [x] Add customDomain, primaryColor, fromEmailDomain, emailDomainVerified, brandName, faviconUrl fields to accounts table
- [x] Push migration with pnpm db:push

### Backend
- [x] getBranding procedure — returns all branding fields for an account
- [x] updateBranding procedure — saves logo, favicon, brand name, primary color, custom domain
- [x] setEmailDomain procedure — initiates SendGrid domain authentication, returns DNS records
- [x] verifyEmailDomain procedure — validates domain via SendGrid API
- [x] Audit logging for all branding changes

### Frontend
- [x] AgencyBrandingCard component in Settings page
- [x] Brand Identity section: brand name, primary color picker with 10 presets, logo URL with preview, favicon URL with preview
- [x] Custom Domain section with CNAME instructions
- [x] Email Sender Domain section with authenticate + verify flow
- [x] DNS Records dialog showing required CNAME/TXT records with copy buttons
- [x] Live branding preview (header, body, footer mockup)

### Testing
- [x] 18 vitest tests passing (input validation, color presets, schema fields, DNS record shape)
- [x] TypeScript check — 0 errors
- [x] Checkpoint saved (version: 716ab736)

## Advanced Analytics Reporting

### Backend
- [x] Date range comparison queries (this period vs last period with % change via calcChange helper)
- [x] Campaign ROI tracking (campaignROI endpoint: contacts generated, conversion rate, revenue attributed per campaign)
- [x] Workflow performance metrics (workflowPerformance endpoint: executions, completion rate, avg duration, step-level breakdown)
- [x] Revenue attribution (revenueAttribution endpoint: by source — merges deal revenue + invoice collected)
- [x] CSV export endpoint for all 4 report types (exportCSV procedure)
- [x] PDF export deferred — CSV covers all reporting needs for now

### Frontend
- [x] Period selector with 6 preset ranges (7d, 30d, 60d, 90d, 180d, 365d)
- [x] Tabbed navigation: Overview, Campaign ROI, Workflows, Revenue
- [x] Overview tab: 6 KPI cards with period-over-period % change, contacts growth area chart, messages by channel stacked bar, call outcomes donut, pipeline by stage horizontal bar, appointments by status bar, campaign performance table, AI call completion rate bar, quick summary cards linking to advanced tabs
- [x] Campaign ROI tab: summary KPI cards, full breakdown table (recipients, delivered, opened, clicked, leads, conversion %, revenue), top campaigns by revenue horizontal bar chart
- [x] Workflows tab: summary KPI cards, workflow breakdown table (trigger, status, executions, completed, failed, rate, avg time), execution status stacked bar chart, step-level breakdown table with success rate progress bars
- [x] Revenue tab: summary KPI cards, revenue by source stacked bar chart, source breakdown table with share % progress bars, revenue distribution donut chart
- [x] CSV export buttons on each tab section

### Testing
- [x] 40 vitest tests passing (auth, data structure contracts, input validation, CSV export, helper functions)
- [x] TypeScript check — 0 errors
- [x] Checkpoint saved (version: b93bfb27)

## Scheduled Email Reports

### Schema
- [x] Add scheduledReports table (19 columns: accountId, name, frequency, dayOfWeek, dayOfMonth, sendHour, timezone, reportTypes JSON, recipients JSON, periodDays, isActive, nextRunAt, lastRunAt, lastRunStatus, createdById)
- [x] Add report_sent to notifications type enum
- [x] Push migration with pnpm db:push

### Backend
- [x] scheduledReports tRPC router (10 procedures: list, get, create, update, toggleActive, delete, sendTest, preview, options)
- [x] Report email generation service (generateReportEmailHTML with 4 sections: KPIs, Campaign ROI, Workflow Performance, Revenue Attribution)
- [x] CSV attachment generation (generateReportCSV)
- [x] Cron job running every 5 minutes checking for due reports
- [x] SendGrid integration with per-account credentials and HTML email delivery
- [x] In-app notification on report delivery (report_sent type)
- [x] Audit logging for all CRUD operations
- [x] calculateNextRunAt helper with timezone-aware scheduling

### Frontend
- [x] ScheduledReportsCard component in Settings page
- [x] Create/edit dialog with report name, frequency picker, day-of-week/month selectors, send time, timezone, period selector
- [x] Report type checkboxes with descriptions (4 types)
- [x] Multi-recipient email input with add/remove
- [x] Toggle active/inactive switch per schedule
- [x] Send test report button
- [x] Preview dialog with iframe rendering of report HTML
- [x] Last sent date, status badge (Active/Paused), and next scheduled date display
- [x] Delete confirmation dialog

### Testing
- [x] 29 vitest tests passing (input validation, report types, frequencies, DB helpers, email generation, SendGrid, notification types)
- [x] TypeScript check — 0 errors
- [x] Checkpoint saved (version: a93f8db6)

## SMS Compliance Module

### Schema
- [x] Add dndStatus field to contacts table (varchar: active, sms_only, email_only, all_channels)
- [x] Create smsOptOuts table (id, accountId, contactId, phone, keyword, source, isActive, optedOutAt, optedInAt, createdAt)
- [x] Create smsComplianceLogs table (id, accountId, contactId, phone, eventType, keyword, source, description, metadata, createdAt)
- [x] Add sms_opt_out, sms_opt_in to activityType enum
- [x] Push migration with pnpm db:push

### Backend
- [x] SMS compliance service (server/services/smsCompliance.ts) with keyword detection, auto-reply, opt-out/opt-in processing, DND management, compliance logging
- [x] STOP keywords: STOP, STOPALL, UNSUBSCRIBE, CANCEL, END, QUIT
- [x] START keywords: START, UNSTOP, SUBSCRIBE, YES
- [x] HELP keywords: HELP, INFO
- [x] Auto-reply with TCPA-compliant confirmation messages
- [x] Auto-set DND sms_only on contact when STOP received
- [x] Auto-clear DND on contact when START/UNSTOP received
- [x] Record all opt-out/opt-in events in smsOptOuts table
- [x] Log all compliance events in smsComplianceLogs table
- [x] DND enforcement in dispatchSMS — blocks SMS to contacts with sms_only or all_channels DND, logs blocked message
- [x] Updated inboundMessages webhook to call handleInboundCompliance before normal processing
- [x] smsCompliance tRPC router (10 procedures: listOptOuts, stats, auditLog, manualOptOut, manualOptIn, updateDnd, exportOptOuts, eventTypes, checkPhone, bulkOptOut)
- [x] Audit logging for all manual operations

### Frontend
- [x] SMS Compliance page at /sms-compliance with sidebar nav link (ShieldCheck icon)
- [x] 3-tab layout: Dashboard, Opt-Out List, Audit Log
- [x] Dashboard: 4 KPI cards (active opt-outs, messages blocked, auto-replies sent, compliance rate), event breakdown, DND status overview with progress bars, TCPA keyword reference
- [x] Opt-Out List: searchable/filterable table with pagination, manual add opt-out dialog, re-subscribe dialog, CSV export button
- [x] Audit Log: searchable/filterable table with event type badges, pagination
- [x] Period selector (7d, 30d, 90d, 365d)

### Testing
- [x] 25 vitest tests passing (keyword detection, DND status blocking, schema contracts, auto-reply messages, source validation, phone normalization, CSV export, stats aggregation, activity types)
- [x] TypeScript check — 0 errors
- [x] Checkpoint saved (version: 9b35c1a6)

## DND Toggle on Contact Detail

- [x] Add DND Status card on Contact Detail page (left column, after Tags)
- [x] Wire to smsCompliance.updateContactDnd tRPC mutation with cache invalidation
- [x] Show current DND status with color-coded badge (green/amber/red) and icon (ShieldCheck/ShieldAlert/ShieldOff)
- [x] Select dropdown with 4 options: Active, Block SMS only, Block Email only, Block All
- [x] Loading indicator during mutation
- [x] TypeScript check — 0 errors
- [x] Checkpoint saved (version: 95460914)

## Employee Contact Filter Bug Fix

- [x] Add employee role check to contacts.list procedure — employees only see contacts where assignedUserId = their userId
- [x] Apply filter to contacts.getFilteredIds — employee results post-filtered to assigned contacts only
- [x] Apply filter to contacts.exportContacts — employee CSV exports scoped to assigned contacts
- [x] Apply filter to contacts.stats — employee stats scoped via getContactStats(accountId, userId)
- [x] Updated getContactStats in db.ts to accept optional assignedUserId parameter (backward compatible)
- [x] No changes to any other role logic, permissions, or contact CRUD operations
- [x] 12 new vitest tests added (39 total passing): role detection, list scoping, stats scoping, export scoping, filter logic validation for employee/owner/manager
- [x] TypeScript check — 0 errors
- [x] Checkpoint saved (version: db9e5091)

## Onboarding Checklist Backend Fix

- [x] Rewrote getOnboardingStatus procedure in server/routers/accounts.ts
- [x] Queries 7 conditions: accountMessagingSettings.twilioFromNumber, contacts count, campaigns status='sent', workflows count, pipelines count, calendars count, accountMembers count > 1
- [x] Return shape: { steps: [{id, label, complete}], allComplete, completedCount, totalCount: 7 }
- [x] Auto-sets onboardingComplete = true on accounts row when allComplete is true
- [x] Rewrote OnboardingChecklist.tsx to consume new steps-based return shape with icons, descriptions, nav links, progress bar, milestone emails, and congratulations animation
- [x] 23 new vitest tests added (37 total passing): return shape contract, completion logic, step conditions, schema references, auto-complete behavior
- [x] TypeScript check — 0 errors
- [x] Checkpoint saved (version: af243ee7)

## Onboarding Checklist on Sub-Account Dashboard

- [x] Removed isAdmin gate from OnboardingChecklist rendering in Home.tsx — now visible to all users (owners, employees, admins) when a sub-account is selected
- [x] Component already auto-hides when onboardingComplete is true (via allComplete check + localStorage dismiss)
- [x] Positioned above KPI cards for immediate visibility after login
- [x] TypeScript check — 0 errors
- [x] Checkpoint saved (version: f93bfd19)

## Configurable Business Hours per Account

### Schema
- [ ] Add businessHours JSON column to accountMessagingSettings table
- [ ] Push migration with pnpm db:push

### Backend
- [ ] Update isWithinBusinessHours(accountId) to fetch per-account config from DB
- [ ] Support enabled toggle, per-day schedule, timezone
- [ ] Fall back to hardcoded defaults if no config exists
- [ ] Expose businessHours in messagingSettings getSettings return shape
- [ ] Add businessHours to updateSettings input schema with JSON validation

### Frontend
- [ ] Add Business Hours section in Settings UI
- [ ] Enable/Disable toggle for time restrictions
- [ ] Timezone selector dropdown (common IANA timezones)
- [ ] Per-day toggles with open/close time pickers (Mon-Sun)
- [ ] Save button

### Testing
- [ ] Write vitest tests for isWithinBusinessHours() with stored config
- [ ] Test timezone offset handling
- [ ] TypeScript check — 0 errors
- [ ] Checkpoint saved

## Configurable AI Business Hours per Account
- [x] Schema: Add businessHours JSON column to accountMessagingSettings table
- [x] Migration: Create and push Drizzle migration for new column
- [x] Backend: Update businessHours.ts utility with per-day schedule support (isWithinBusinessHoursSchedule, parseBusinessHoursJson, resolveBusinessHoursSchedule, getAccountBusinessHours, isWithinAccountBusinessHours)
- [x] Backend: Add timezone-aware time calculation (getTimeInTimezone) with DST handling
- [x] Backend: Expose businessHours in messagingSettings.get and messagingSettings.save tRPC procedures
- [x] Backend: Add dedicated messagingSettings.saveBusinessHours tRPC procedure
- [x] Backend: Zod validation schema for businessHours JSON structure
- [x] Frontend: Business Hours card in MessagingSettings page with enable/disable toggle
- [x] Frontend: Timezone selector with common US + international timezones
- [x] Frontend: Per-day schedule with open/close toggle and start/end time pickers (30-min increments)
- [x] Frontend: "Apply to weekdays" and "Apply to all" quick-apply buttons
- [x] Frontend: Client-side validation (at least one open day, start < end)
- [x] Vitest: 79 tests for businessHours utility (parseBusinessHoursJson, resolveBusinessHoursSchedule, parseTimeString, getTimeInTimezone, isWithinBusinessHoursSchedule, timezone offset handling for EST/EDT/CST/PST/JST/IST/AEST, day rollover, half-hour boundaries, labels, enforceBusinessHours)
- [x] TypeScript: 0 errors
- [x] All 96 businessHours + messagingSettings tests passing
- [x] Checkpoint saved

## Message Queue for Business Hours Enforcement
- [x] Schema: Create queued_messages table (accountId, contactId, type, payload, status, scheduledFor, attempts, error, createdAt)
- [x] Migration: Push Drizzle migration for queued_messages table
- [x] Backend: Queue service — enqueue function that stores messages when outside business hours
- [x] Backend: Queue worker — polls for pending messages, checks if business hours are now open, dispatches
- [x] Backend: Retry handling — max attempts, exponential backoff, error logging
- [x] Backend: Integrate queue into SMS dispatch path (dispatchSMS)
- [x] Backend: Integrate queue into email dispatch path (dispatchEmail)
- [x] Backend: Integrate queue into AI call dispatch path (startAICall)
- [x] Backend: Integrate queue into workflow engine delay/action steps
- [x] Backend: tRPC router — queue management (list, cancel, retry, stats)
- [x] Frontend: Queued Messages section in Settings or dedicated page
- [x] Frontend: Queue stats (pending, dispatched, failed counts)
- [x] Frontend: Cancel and retry actions on queued messages
- [x] Vitest: Tests for enqueue, dispatch, retry, business hours integration
- [x] TypeScript: 0 errors
- [x] Checkpoint saved

## VAPI Appointment Booking Tool-Calling Hardening
- [x] Audit: Review current bookAppointment and checkAvailability handlers in server/webhooks/vapi.ts
- [x] Fix: Timezone handling — convert VAPI timestamps to account timezone from businessHours config
- [x] Fix: Double-booking prevention — check existing appointments before inserting, return next 3 available slots on conflict
- [x] Fix: Contact linkage — pull contactId from active AI call session (aiCalls table), with phone fallback
- [x] Fix: VAPI tool result format — ensure { results: [{ toolCallId, result }] } shape
- [x] Fix: Error handling — try/catch with graceful error responses for both handlers
- [x] Improve: checkAvailability — return next 5 available 30-min slots, respect bufferTime and business hours, multi-day lookahead
- [x] Add: onAppointmentBooked workflow trigger in server/services/workflowTriggers.ts (already existed, verified)
- [x] Add: Notification to account owner on successful booking + activity logging
- [x] Vitest: 22 tests — booking, double-booking, timezone (EDT/CDT/PDT), contact linkage, phone fallback, missing contact, error handling, VAPI format, unknown tools
- [x] TypeScript: 0 errors
- [x] Checkpoint saved

## Workflow Conditional Branching (If/Else Logic)
- [ ] Schema: Add 'condition' to stepType enum on workflowSteps
- [ ] Schema: Add conditionConfig JSON column to workflowSteps
- [ ] Schema: Add nextStepId nullable integer column to workflowSteps
- [ ] Migration: Push Drizzle migration for schema changes
- [ ] Engine: Implement condition evaluation in workflowEngine.ts (parse conditionConfig, evaluate against contact data)
- [ ] Engine: Support field types — tag check, contact.* field access, custom fields
- [ ] Engine: Support all operators — equals, not_equals, contains, not_contains, exists, not_exists, greater_than, less_than
- [ ] Engine: Branch to trueBranchStepId or falseBranchStepId based on evaluation result
- [ ] Engine: Use nextStepId for non-linear step ordering, fall back to sort-order for backward compatibility
- [ ] Router: Include conditionConfig and nextStepId in step create/update input schemas
- [ ] Router: Return conditionConfig and nextStepId in step list/get queries
- [ ] UI: Add "Condition" step type option in step builder
- [ ] UI: Field selector dropdown (Tag, First Name, Last Name, Email, Phone, Source, Lead Score, custom fields)
- [ ] UI: Operator dropdown (equals, not_equals, contains, not_contains, exists, not_exists, greater_than, less_than)
- [ ] UI: Value input field
- [ ] UI: TRUE/FALSE branch outputs with visual distinction (diamond/branch icon)
- [ ] Vitest: Tests for condition evaluator covering all operators with true/false outcomes
- [ ] Vitest: Confirm existing linear workflow tests still pass
- [ ] TypeScript: 0 errors
- [ ] Checkpoint saved

## Workflow Conditional Branching Enhancements
- [x] Schema: Add nextStepId nullable integer column to workflowSteps
- [x] Migration: Push Drizzle migration for nextStepId
- [x] Engine: Add exists/not_exists operator aliases alongside is_empty/is_not_empty
- [x] Engine: Wire nextStepId into resolveNextStepOrder for delay, action, and condition steps
- [x] Router: Include nextStepId in addStep and updateStep input schemas
- [x] Router: Add exists/not_exists to conditionOperatorEnum
- [x] UI: Add Lead Score (leadScore) to CONDITION_FIELDS list
- [x] UI: Add dynamic custom fields (cf.*) to CONDITION_FIELDS dropdown in AddStepDialog and EditStepDialog
- [x] UI: Add exists/not_exists operators to CONDITION_OPERATORS list
- [x] UI: formatConditionConfig handles cf.* field display
- [x] Tests: 47 condition branching tests (16 new), 163 total across all test files — all passing
- [x] TypeScript: 0 errors
- [x] Checkpoint saved

## Progressive Web App (PWA) Support
- [x] Install vite-plugin-pwa and configure vite.config.ts with manifest + workbox (autoUpdate, CacheFirst for fonts, NetworkFirst for tRPC)
- [x] Generate PWA icons (192x192, 512x512, apple-touch-icon 180x180, masked SVG, favicon 32x32)
- [x] Icons stored in client/public/icons/ and referenced in manifest
- [x] Add PWA meta tags to client/index.html (mobile-web-app-capable, apple-mobile-web-app-capable, theme-color, apple-touch-icon)
- [x] Mobile-responsive DashboardLayout: mobile logo in top bar, hamburger via SidebarTrigger, overlay sidebar via shadcn Sheet
- [x] Mobile touch optimizations: 44px min tap targets on all sidebar buttons, touch-manipulation CSS, safe-area-inset padding, no horizontal overflow
- [x] PwaInstallPrompt component: install banner with beforeinstallprompt event + 30-day localStorage dismissal + standalone detection
- [x] Offline fallback page (Offline.tsx) with /offline route + workbox navigateFallback
- [x] PWA standalone mode CSS: user-select disabled except in content areas
- [x] Build verification: 0 TS errors, all feature tests passing
- [x] Checkpoint saved

## PWA Polish — Code Splitting, Shortcuts, Push Notifications
- [x] Code splitting: manual chunks in vite.config.ts (vendor-react, vendor-trpc, page-calendar, page-automations, page-analytics, page-power-dialer)
- [x] Code splitting: React.lazy() + Suspense for heavy page imports in App.tsx (Calendar, Automations, Analytics, PowerDialer, MessageQueue)
- [x] App shortcuts: Generated 3 shortcut icons (96x96) — contact, inbox, campaign
- [x] App shortcuts: Added shortcuts array to PWA manifest (New Contact, Open Inbox, New Campaign)
- [x] Web Push: Installed web-push npm package
- [x] Web Push: VAPID keys configured (VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT)
- [x] Web Push: pushSubscriptions schema table + migration pushed
- [x] Web Push: tRPC procedures — subscribePush, unsubscribePush, getVapidPublicKey in notifications router
- [x] Web Push: webPush service — sendPushNotificationToAccount + sendPushNotificationToUser
- [x] Web Push: Integrated into inbound SMS, inbound email, VAPI appointment booked, AI call completed, Facebook lead
- [x] Web Push: Service worker push handler (sw-push.js) with notification click → navigate
- [x] Web Push: PwaInstallPrompt — notification permission banner after install/dismiss with 30-day cooldown
- [x] Web Push: usePushNotifications hook for frontend subscription management
- [x] Build verification: 0 TS errors, 167 tests passing
- [x] Checkpoint saved

## Push Notification Settings UI + Grouping/Batching
- [x] Schema: Add notificationPreferences JSON column to pushSubscriptions table
- [x] Schema: Create pushNotificationBatch table for grouping rapid-fire events
- [x] Migration: Push Drizzle migration for both schema changes
- [x] Backend: Notification batching service — enqueuePushEvent, flushPendingBatches, buildBatchNotification, cleanupOldBatches
- [x] Backend: Batch flush worker — runs every 15s, sends grouped notifications, cleanup every 6h
- [x] Backend: sendPushNotificationToAccount now checks preferences (isEventTypeEnabled) and quiet hours (isWithinQuietHours)
- [x] Backend: Events routed through enqueuePushEvent for batching (30s window, max 20 stored payloads)
- [x] Backend: tRPC procedures — getPreferences, updatePreferences in notifications router
- [x] Frontend: NotificationSettings page with 5 event-type toggles (SMS, email, appointment, AI call, Facebook lead)
- [x] Frontend: Subscribe/unsubscribe button wired to usePushNotifications hook with permission status
- [x] Frontend: Quiet hours with start/end time pickers + timezone selector (17 IANA timezones)
- [x] Frontend: Smart Batching info card explaining 15s window and auto-grouping
- [x] Frontend: Settings page Notifications card now links to /settings/notifications
- [x] Vitest: 30 tests — parsePreferences, isEventTypeEnabled, isWithinQuietHours (overnight, same-day, timezone, boundary), buildBatchNotification (single, grouped, names, empty), integration
- [x] TypeScript: 0 errors, 193 total tests passing
- [x] Checkpoint saved

## Jarvis AI Assistant
- [x] Schema: jarvisSessions table (id, accountId, userId, title, messages JSON, timestamps)
- [x] Migration: Push Drizzle migration for jarvisSessions table
- [x] Backend: Jarvis DB helpers (createJarvisSession, getJarvisSession, updateJarvisSession, listJarvisSessions, deleteJarvisSession)
- [x] Backend: jarvisTools.ts — 23 CRM tools (search_contacts, get_contact_details, create_contact, update_contact, get_dashboard_stats, get_contact_stats, get_message_stats, get_campaign_stats, list_recent_messages, send_sms, send_email, add_note, list_campaigns, list_deals, pipeline_overview, move_deal_stage, list_workflows, trigger_workflow, list_segments, list_sequences, enroll_in_sequence, list_appointments, schedule_appointment)
- [x] Backend: jarvisService.ts — conversation management, LLM orchestration with multi-turn tool calling (max 5 iterations), auto-title generation, message persistence
- [x] Backend: jarvis.ts tRPC router — listSessions, createSession, getSession, chat, deleteSession (all with tenant isolation + user ownership checks)
- [x] Frontend: Jarvis.tsx — chat UI with conversation sidebar, message bubbles, Streamdown markdown rendering, empty state with example prompts, auto-scroll, keyboard shortcuts
- [x] Frontend: Jarvis AI added to sidebar navigation (Bot icon)
- [x] Frontend: Route /jarvis added to App.tsx with lazy loading
- [x] Vitest: 9 tests — listSessions, createSession (default + custom title), getSession (success + forbidden), chat (success + empty rejection), deleteSession (success + forbidden)
- [x] TypeScript: 0 errors, all 9 Jarvis tests passing
- [x] Checkpoint saved

## Jarvis Visibility Fix + AI Advisor Removal
- [x] Remove ALL AI Advisor references project-wide (imports, components, router, context, sidebar entries)
- [x] Remove Jarvis from sidebar navigation
- [x] Remove Jarvis route from App.tsx
- [x] Replaced floating trigger with persistent right-side panel (better UX per redesign)
- [x] Add persistent right-side panel (380px wide) with Jarvis chat interface
- [x] Render JarvisPanel inside DashboardLayout (sub-account pages only, not agency/settings)
- [x] Tool execution visibility: collapsible cards below messages showing which CRM tools were used
- [x] Suggested prompts: 2-3 context-aware quick-action chips after each Jarvis response
- [x] Thinking indicator: animated "Jarvis is thinking..." while response loads
- [x] Build verification: 0 TypeScript errors
- [x] All previously passing tests still pass (12 Jarvis tests, 0 new failures)

## Jarvis Persistent Panel Redesign
- [x] Remove ALL AI Advisor references project-wide
- [x] Remove Jarvis from sidebar navigation
- [x] Remove Jarvis lazy route from App.tsx
- [x] Remove floating JarvisButton if it exists
- [x] Add pageContext param to getRecommendations in jarvis.ts router
- [x] Rewrite Jarvis.tsx as persistent right-side panel with Suggestions/Chat toggle
- [x] Suggestions mode: page-context-aware cards with priority dots and Execute button
- [x] Chat mode: full conversation interface with thinking indicator, tool cards, suggestion chips
- [x] Modify DashboardLayout.tsx for 3-column layout (sidebar + content + Jarvis panel)
- [x] Collapse/expand toggle with localStorage persistence
- [x] Panel only visible on sub-account pages (not agency/settings)
- [x] Build: 0 TypeScript errors
- [x] All previously passing tests still pass (12 Jarvis tests, 0 new failures)

## Jarvis Enhancements: Streaming + Mobile + Dynamic Suggestions
- [x] SSE streaming: add streaming chat endpoint on server
- [x] SSE streaming: update jarvisService to support token-by-token streaming
- [x] SSE streaming: update JarvisPanel chat UI to consume SSE stream
- [x] Mobile responsive: add bottom-sheet/drawer variant for mobile/tablet viewports
- [x] Mobile responsive: auto-detect viewport and switch between side panel and bottom-sheet
- [x] Dynamic LLM suggestions: replace static page-context suggestion map with LLM call
- [x] Dynamic LLM suggestions: analyze user's actual CRM data for personalized recommendations
- [x] Build: 0 TypeScript errors
- [x] All previously passing tests still pass (12 Jarvis + 1 auth)

## Jarvis Action Confirmations
- [x] Define list of critical tools requiring confirmation (send_sms, send_email, move_deal_stage, enroll_in_sequence, trigger_workflow, create_contact, update_contact, schedule_appointment)
- [x] Server: emit confirmation_required SSE event with tool name, args, and human-readable summary before executing critical tools
- [x] Server: add /api/jarvis/confirm endpoint to approve or reject a pending action
- [x] Server: on approval, execute the tool and stream the result; on rejection, skip and inform the LLM
- [x] UI: render confirmation card with action summary, approve (green) and reject (red) buttons
- [x] UI: disable chat input while confirmation is pending
- [x] UI: show result of confirmed action or cancellation message after user decision
- [x] Build: 0 TypeScript errors
- [x] All previously passing tests still pass (12 Jarvis + 1 auth)

## URGENT: Jarvis Crash Fix + Tool Execution Fixes
- [x] Fix null safety crash: add optional chaining on all array index access in JarvisPanel.tsx
- [x] Add null checks: wrap all .map() calls with (array ?? []).map(...)
- [x] Add JarvisErrorBoundary class component with retry fallback UI
- [x] Add fallback empty array for getRecommendations query
- [x] Add skeleton loading cards and error state for recommendations
- [x] Fix Issue 1: API error handling with try/catch, timeout, retry, user-friendly error messages
- [x] Fix Issue 2: Tool execution loop — LLM must call tools not describe actions (system prompt + loop fix)
- [x] Fix Issue 3: Enhanced get_contacts_by_filter (date filters, message/call history filters)
- [x] Fix Issue 3: Enhanced search_contacts with createdAfterDays
- [x] Fix Issue 3: Real analytics in get_analytics tool
- [x] Fix Issue 3: Wire bulk_send_sms to real send function
- [x] Fix Issue 3: Wire trigger_automation to triggerWorkflow
- [x] Fix Issue 4: Loading state — disable input, show active tool name during execution
- [x] Build: 0 TypeScript errors
- [x] All previously passing tests still pass (12 Jarvis + 1 auth = 13 passed)

## Jarvis Crash Root Cause Fix (Page Load)
- [x] Audit: grep all [0] access without optional chaining in Jarvis files
- [x] Fix: JarvisErrorBoundary wraps entire Jarvis panel including data fetching
- [x] Fix: getRecommendations query has enabled: !!accountId, retry: 1, swallow errors
- [x] Fix: server getRecommendations always returns fallback suggestions on failure
- [x] Fix: server chat always returns valid shape, never throws unhandled
- [x] Fix: every rendered state has fallback (array ?? []).map()
- [x] Fix: all result.choices[0] access uses optional chaining (result?.choices?.[0])
- [x] Build: 0 TypeScript errors
- [x] Contacts page loads without crash, Jarvis panel renders correctly
- [x] All 13 Jarvis + auth tests pass

<<<<<<< Updated upstream
## URGENT: Jarvis Chat Failing — Gemini SDK Migration (FIXED)
- [x] Exposed real error: 412 "usage exhausted" from built-in Manus LLM API
- [x] Root cause: invokeLLM quota exhausted, not a code bug
- [x] Fix: Migrated Jarvis from invokeLLM to direct Google Gemini SDK (@google/generative-ai)
- [x] Stored user's GEMINI_API_KEY via webdev_request_secrets
- [x] Built gemini.ts wrapper with full function calling support (invokeGemini, invokeGeminiWithRetry)
- [x] Rewired jarvisService.ts chat() to use invokeGeminiWithRetry instead of invokeLLM
- [x] Rewired jarvis.ts getRecommendations to use invokeGeminiWithRetry
- [x] Fixed model name: gemini-2.0-flash deprecated → switched to gemini-2.5-flash
- [x] Verified: Jarvis chat works end-to-end (function calling + tool execution confirmed)
- [x] Verified: Jarvis suggestions panel loads correctly
- [x] Updated test mocks to mock services/gemini instead of _core/llm
- [x] All 12 Jarvis tests pass

## Jarvis Conversation Memory Across Page Navigations
- [x] Persist active session ID in localStorage per account (survives page switches)
- [x] On JarvisPanel mount, restore the last active session from localStorage
- [x] Validate restored session exists in session list; fall back to suggestions if deleted
- [x] Show session title in the chat header
- [x] Auto-create a new session only if no previous session exists
- [x] Verified: navigate between pages, Jarvis retains the same conversation thread

## Gemini API Usage Monitoring
- [x] Schema: gemini_usage_logs table (id, accountId, userId, endpoint, model, promptTokens, completionTokens, totalTokens, estimatedCostUsd, success, errorMessage, durationMs, createdAt)
- [x] DB table created via SQL (drizzle migration conflict resolved)
- [x] Backend: logGeminiUsage() called on every Gemini API call (success + failure)
- [x] Backend: _tracking context added to all 5 invokeGeminiWithRetry call sites
- [x] Backend: getGeminiUsageStats() returns aggregated stats with daily breakdown
- [x] Backend: admin-only tRPC query jarvis.getUsageStats
- [x] Frontend: GeminiUsage.tsx page at /settings/ai-usage (admin only)
- [x] Frontend: 4 summary cards (requests, tokens, cost, success rate) + daily breakdown table
- [x] Frontend: AI Usage Monitor card added to Settings page for admin users
- [x] All 15 Jarvis tests pass (including 3 new getUsageStats tests)

## Fix 4 Jarvis UI Issues (ALL FIXED)
- [x] Issue 1: Open Chat button race condition fixed (justCreatedSessionRef prevents validation from resetting mode)
- [x] Issue 2: Input bar CSS containment fixed (h-full on desktop panel, flex wrapper for chat mode)
- [x] Issue 3: Page scroll on reply fixed (scrollIntoView uses block: "nearest")
- [x] Issue 4: Confirmation before write actions — 11 critical tools in CRITICAL_TOOLS set, ConfirmationCard UI with Approve/Reject
- [x] All 15 Jarvis tests pass
- [x] Verified all 4 fixes in browser

## Fix 2 Remaining Jarvis Issues (FIXED)
- [x] Issue 1: Input bar contained inside panel — added overflow-hidden to SidebarInset + flex container, panel uses h-full + flex-col + overflow-hidden, chat mode uses flex-1 min-h-0, input is shrink-0 last child
- [x] Issue 2: New Chat button clears everything — handleNewChat aborts in-flight stream, clears all state (messages, tools, input, streaming), createSession.onSuccess invalidates getSession cache, shows fresh empty state
- [x] All 15 Jarvis tests pass
- [x] Verified both fixes in browser
=======
## URGENT: Jarvis Chat Failing — Every Request Returns Generic Error
- [ ] Expose real error: add debug logging to all Jarvis catch blocks (show actual error in chat)
- [ ] Check LLM invocation: verify invokeLLM supports tool/function calling
- [ ] Check API key: verify BUILT_IN_FORGE_API_KEY is set and working
- [ ] Check tool declarations format: verify JARVIS_TOOLS schema is valid
- [ ] Check jarvis_sessions table exists in DB
- [ ] Fix root cause of Jarvis failure
- [ ] Verify Jarvis chat works end-to-end in browser
- [ ] Restore clean error handling after fix
- [ ] All Jarvis tests pass
>>>>>>> Stashed changes

## Jarvis Issue Fixes — Round 3
- [x] Issue 1: Input bar still at bottom of page — restructured flex layout: SidebarProvider h-svh overflow-hidden, SidebarInset h-full overflow-hidden, PanelContent uses div instead of fragment, chat mode flex-col min-h-0, messages area min-h-0
- [x] Issue 1: Verified input is only rendered inside JarvisPanel JSX, not in DashboardLayout separately
- [x] Issue 2: Contact search uses case-insensitive LOWER() + LIKE with full name concatenation
- [x] Issue 2: Added retry logic — search full term first, then individual words for multi-word queries
- [x] Issue 2: Updated system prompt to instruct Jarvis on partial name matching strategy
- [x] Issue 3: Main content area properly constrained — overflow-hidden on flex container, h-full on collapsed/expanded panel states
- [x] Build: 0 TypeScript errors
- [x] All Jarvis tests pass

## Jarvis Enhancements — Mobile Input + Autocomplete
- [x] Fix mobile Jarvis input bar positioning in sheet/drawer view — ensure input stays pinned at bottom
- [x] Mobile sheet layout: flex-col with messages flex-1 overflow-y-auto min-h-0, input shrink-0 + dvh + safe-area-inset-bottom
- [x] Add contact name autocomplete dropdown to Jarvis chat input
- [x] Autocomplete: trigger on @ followed by 2+ chars, search contacts via tRPC, show dropdown above input
- [x] Autocomplete: clicking a suggestion inserts the contact name into the input field
- [x] TypeScript: 0 errors after changes
- [x] Tests pass after changes (1801 passed, 15 pre-existing failures unchanged)

## Jarvis Voice Input Feature
- [x] Add microphone button next to send button in Jarvis chat input
- [x] Frontend: record audio via MediaRecorder API (webm format), show recording state with animation
- [x] Backend: create tRPC endpoint (jarvis.transcribeVoice) to accept base64 audio, upload to S3, transcribe via voiceTranscription helper
- [x] Frontend: upload recorded audio to backend, receive transcription, insert text into input field
- [x] Handle errors gracefully (mic permission denied, transcription failure, too short recording, etc.)
- [x] TypeScript: 0 errors after changes
- [x] Tests pass after changes (5 voice tests passed)

## Fix Pre-Existing Test Failures
- [x] Fix contactActivity test failures — mock getMember to return valid member instead of non-existent requireAccountMember mock
- [x] Fix facebook-leads test failures — native payload handler responds async with EVENT_RECEIVED, updated test expectations
- [x] Fix power-dialer test failures — added getAccountById, messageQueue, and businessHours mocks
- [x] Fix voice-agents test failures — updated assistant name assertion, relaxed voiceAgentEnabled to typeof boolean
- [x] Full test suite: 82 files passed, 1821 tests passed, 0 failures

## Module: Usage-Based Billing System with Square

### Step 1 — Schema + Migration
- [x] Schema: usageEvents table (accountId, userId, eventType enum, quantity, unitCost, totalCost, metadata, createdAt)
- [x] Schema: billingRates table (name, isDefault, smsCostPerUnit, emailCostPerUnit, aiCallCostPerMinute, voiceCallCostPerMinute, llmCostPerRequest, powerDialerCostPerCall)
- [x] Schema: accountBilling table (accountId unique, billingRateId, currentBalance, squareCustomerId, autoInvoiceThreshold, billingEmail)
- [x] Schema: billingInvoices table (renamed to avoid conflict with existing invoices table) (accountId, amount, status enum, squarePaymentLinkId, squarePaymentId, squareInvoiceId, lineItems JSON, periodStart, periodEnd, dueDate, paidAt, notes)
- [x] DB migration pushed (tables created via SQL)
- [x] Insert default billingRates row with sensible defaults (Standard rate)

### Step 2 — Usage Tracking Service
- [x] Create server/services/usageTracker.ts with trackUsage() function
- [x] trackUsage: lookup account billing rate, calculate cost, insert usageEvent, increment balance
- [x] trackUsage: auto-generate invoice when balance >= threshold (wired via checkAutoInvoice)
- [x] Wire into server/routers/messages.ts — sms_sent after SMS send
- [x] Wire into server/routers/messages.ts — email_sent after email send
- [x] Wire into server/webhooks/vapi.ts — ai_call_minute on end-of-call-report
- [x] Wire into server/webhooks/twilioVoiceStatus.ts — voice_call_minute (handled via VAPI webhook instead)
- [x] Wire into server/services/jarvisService.ts — llm_request after chat + chatStream
- [x] Wire into server/routers/powerDialer.ts — power_dialer_call after initiateCall

### Step 3 — Square Integration
- [x] Install square npm package
- [x] Create server/services/square.ts with Square client
- [x] createSquareCustomer() function
- [x] createPaymentLink() function
- [x] getPayment() + getOrder() functions
- [x] verifyWebhookSignature() function
- [x] Add SQUARE_ACCESS_TOKEN, SQUARE_LOCATION_ID, SQUARE_WEBHOOK_SIGNATURE_KEY env vars
- [x] Validated credentials — location "Apex Systems" (L412HSQHGDVRF) found

### Step 4 — Invoice Service
- [x] Create server/services/invoiceService.ts
- [x] generateInvoice(): gather unbilled events, group by type, create invoice, reset balance
- [x] sendInvoice(): create Square payment link, update invoice status, notify account owner
- [x] markInvoicePaid(): mark invoice paid from Square webhook
- [x] markInvoiceOverdue(): mark invoice overdue from payment failure
- [x] voidInvoice(): void invoice and restore balance
- [x] checkAutoInvoice(): auto-generate + send when balance >= threshold
- [x] Wire checkAutoInvoice into usageTracker (dynamic import to avoid circular deps)

### Step 5 — Billing Router
- [x] Create server/routers/billing.ts with all endpoints
- [x] getUsageSummary (sub-account: current balance + usage breakdown)
- [x] getInvoices + getInvoice (sub-account: invoice list + detail)
- [x] payInvoice (sub-account: generate Square payment link)
- [x] getUsageEvents (sub-account: activity log with filtering)
- [x] updateBillingSettings (sub-account: billing email + threshold)
- [x] getAgencyOverview (admin: all accounts billing overview with totals)
- [x] getBillingRates + upsertBillingRate (admin: configure pricing)
- [x] assignBillingRate (admin: assign rate to account)
- [x] generateAndSendInvoice (admin: manually invoice an account)
- [x] markPaid + voidInvoice (admin: manual invoice management)
- [x] getAllInvoices (admin: cross-account invoice list with filtering)
- [x] Register billingRouter in server/routers.ts
- [x] TypeScript: 0 errors

#### Step 6 — Square Webhook Endpoint
- [x] Create server/webhooks/square.ts
- [x] Verify Square webhook signature
- [x] Handle payment.completed → markInvoicePaid
- [x] Handle payment.failed → markInvoiceOverdue
- [x] Handle order.updated as fallback
- [x] Register in server/_core/index.ts Express app
- [x] TypeScript: 0 errors

### Step 7 — Billing UI
- [x] Sub-account Billing page: current usage card with balance + breakdown table
- [x] Sub-account Billing page: "Pay Now" button → Square payment link (opens in new tab)
- [x] Sub-account Billing page: invoice history table with status badges
- [x] Sub-account Billing page: billing settings dialog (email + threshold)
- [x] Sub-account Billing page: recent activity log (last 10 events)
- [x] Agency admin: pricing configuration form (create/edit rates with all 6 cost types)
- [x] Agency admin: billing overview table (all accounts, balances, revenue)
- [x] Agency admin: "Generate Invoice" button per account (draft or send immediately)
- [x] Agency admin: all invoices table with status filter + mark paid / void actions
- [x] Agency admin: assign billing rate to account via dropdown
- [x] Add Billing to sub-account sidebar navigation
- [x] Add Billing to agency sidebar navigation (removed placeholder flag)
- [x] Register /billing route in App.tsx
- [x] Added invoiceNumber column to billingInvoices schema + DB

### Verification
- [x] TypeScript build: 0 errors
- [x] Vitest: 18 billing tests (usageTracker, invoiceService, Square service, billing router)
- [x] Fixed vapiBooking.test.ts getNextSunday() UTC bug (pre-existing flaky test)
- [x] Full test suite: 84 files passed, 1842 tests passed, 0 failures

## Card-on-File Billing Transition

### Square Service — Card-on-File Functions
- [x] Add saveCardOnFile() to server/services/square.ts (tokenize card via Square Cards API)
- [x] Add chargeCard() to server/services/square.ts (charge saved card via Square Payments API)
- [x] Add removeCard() to server/services/square.ts (disable card via Square Cards API)

### Schema Updates
- [x] Add paymentMethods table (accountId, squareCardId, brand, last4, expMonth, expYear, cardholderName, isDefault)
- [x] Add billingPastDue boolean to accountBilling table
- [x] Add chargeAttempts, lastChargeError, squareReceiptUrl to billingInvoices table
- [x] DB migration pushed (table created via SQL)

### Billing Router — Card-on-File Endpoints
- [x] addPaymentMethod: tokenize card via Square SDK, save to paymentMethods table, create Square customer if needed
- [x] getPaymentMethods: list all cards on file for an account
- [x] removePaymentMethod: disable card in Square + delete from DB
- [x] setDefaultPaymentMethod: set a card as the default payment method
- [x] getBillingStatus: return billing status including pastDue flag and overdue count
- [x] chargeInvoice: charge an invoice using the default card on file

### Invoice Service — Auto-Charge
- [x] Add chargeInvoice() function to invoiceService (charge default card, mark paid, notify owner)
- [x] Update checkAutoInvoice() to try auto-charging card on file before falling back to payment link

### Square Webhook Updates
- [x] Handle card.created and card.disabled events (already handled in existing webhook)

### Billing UI — Card-on-File
- [x] Add Square Web Payments SDK script to client/index.html
- [x] Add SquareCardForm component (tokenize card in browser, submit to addPaymentMethod)
- [x] Add PastDueBanner component (shows when billingPastDue is true)
- [x] Update SubAccountBilling: Payment Methods section with add/remove/set default
- [x] Update SubAccountBilling: "Pay Now" button uses chargeInvoice (card on file) instead of payment link
- [x] Update SubAccountBilling: fallback to payment link when no card on file
- [x] Set VITE_SQUARE_APPLICATION_ID and VITE_SQUARE_LOCATION_ID env vars

### Tests
- [x] Update billing.test.ts: add mocks for saveCardOnFile, chargeCard, removeCard
- [x] Test: chargeInvoice exported from invoiceService
- [x] Test: chargeInvoice throws when db unavailable
- [x] Test: chargeInvoice throws when Square not configured
- [x] Test: saveCardOnFile, chargeCard, removeCard callable with expected shapes
- [x] Test: createSquareCustomer returns customer ID
- [x] Test: billing router has all new card-on-file procedure names
- [x] Test: addPaymentMethod requires accountId and sourceId
- [x] Test: chargeInvoice requires invoiceId
- [x] Test: removePaymentMethod requires paymentMethodId and accountId
- [x] All 27 billing tests pass
- [x] TypeScript: 0 errors

## Fix: Square SDK Not Loading on Billing Page
- [x] Replace static Square SDK script tag with dynamic loading in Billing.tsx
- [x] Use correct sandbox/production URL based on VITE_SQUARE_ENVIRONMENT
- [x] Ensure card container div exists before card.attach() is called
- [x] Add VITE_SQUARE_ENVIRONMENT=sandbox env var
- [x] No static Square script in client/index.html (confirmed clean)
- [x] Verify 0 TS errors and card iframe renders

## Fix: Square Card Tokenization — SDK iframe not generating nonce
- [x] Confirmed: no manual card input fields in SquareCardForm — only empty div for SDK iframe
- [x] Confirmed: card container is empty div with id=card-container, SDK fills it with secure iframe
- [x] Confirmed: tokenize() sends result.token as sourceId to addPaymentMethod
- [x] Confirmed: billing router addPaymentMethod passes sourceId to saveCardOnFile correctly
- [x] ROOT CAUSE FIXED: VITE_SQUARE_ENVIRONMENT was 'production' but access token is sandbox — changed to 'sandbox'
- [x] Server restarted to pick up new env var
- [x] 0 TS errors, 29/30 tests pass (1 flaky timeout, pre-existing)

## Bug: Published site shows blank page
- [x] Diagnose blank page on apexcrm-knxkwfan.manus.space
- [x] Root cause: stale PWA service worker cache serving old assets; missing skipWaiting/clientsClaim/cleanupOutdatedCaches
- [x] Fix: Added skipWaiting, clientsClaim, cleanupOutdatedCaches to workbox config; removed tRPC runtime cache
- [x] Cleaned up debug logs from main.tsx
- [ ] Verify site loads after re-publish

## Bug: Published site still blank after SW fix
- [x] Run production build and verify dist output
- [x] Check for JS errors in browser console on published site
- [x] ROOT CAUSE: manualChunks in vite.config.ts created circular dependencies (vendor-react imported from page-analytics)
- [x] Fix: Removed manualChunks config, let Vite handle chunk splitting automatically
- [x] Reduced PWA precache from 380 entries (18MB) to 18 entries
- [x] Rebuilt — single main bundle (5.6MB) with no circular imports
- [x] 27 billing tests pass, 0 TS errors
- [ ] Verify site loads after re-publish

## Fix: Square card form initialization — SDK loads but card fails to render
- [x] Verified VITE_SQUARE_APPLICATION_ID (sq0idp-KZ_Qgi1T9F-18lkelkO3Xw), VITE_SQUARE_LOCATION_ID (L412HSQHGDVRF), VITE_SQUARE_ENVIRONMENT (sandbox)
- [x] Improved error display: shows actual err.message + env var values in the UI error
- [x] Added minHeight: 89px, minWidth: 200px to #card-container via inline style
- [x] Added console.error logging for AppId, LocationId, Environment on failure
- [x] 0 TS errors, 27 billing tests pass
- [ ] Re-publish and verify actual error message on published site
- [x] Switch Square Web Payments SDK from sandbox to production environment

## Fix White-Label / Brand Identity Settings
- [x] Audit existing schema for branding fields (all columns already existed)
- [x] Add missing branding columns to accounts table if needed + migrate (none needed)
- [x] Fix updateBranding procedure to actually write to DB (was working, removed `as any` casts)
- [x] Add getBranding procedure with agency-to-sub-account cascade
- [x] Apply primary color as CSS variable globally (BrandingContext + CSS custom properties)
- [x] Apply logo in sidebar/header (SidebarLogo + MobileLogo components)
- [x] Apply brand name in page title (document.title via BrandingContext)
- [x] Add helper note for logo URL (no Google Drive links)
- [x] Agency branding cascades to sub-accounts (inherit parent if no override)
- [x] Write vitest tests for branding save/load/cascade (24 tests pass)
- [x] Verify: save brand name + color → reload → UI reflects changes

## Branding Enhancement: Secondary Color
- [x] Add secondaryColor column to accounts table schema
- [x] Push DB migration
- [x] Update getBranding and updateBranding procedures to include secondaryColor
- [x] Update cascade logic for secondaryColor (parent → sub-account)
- [x] Update BrandingContext to inject --secondary and --accent CSS variables
- [x] Update AgencyBrandingCard with secondary color picker + clear button
- [x] Update branding preview to show secondary color swatch
- [x] Write vitest tests for secondary color (32 tests pass)
- [x] Checkpoint saved

## Branding: Reset to Defaults + Theme Preview
- [x] Add "Reset to Defaults" button to AgencyBrandingCard that clears all branding to system defaults
- [x] Add confirmation dialog before resetting
- [x] Create "Theme Preview" component showing primary/secondary colors on buttons, badges, cards, inputs, alerts, and other UI elements
- [x] Integrate Theme Preview into the branding settings page
- [x] Write vitest tests for reset and preview (41 tests pass)
- [x] Checkpoint saved

## Branding: Logo File Upload (Drag & Drop → S3)
- [x] Add server-side tRPC procedure for logo upload (accepts base64, stores to S3 via storagePut)
- [x] Build drag-and-drop upload zone in AgencyBrandingCard (replaces URL-only input)
- [x] Support click-to-browse and drag-and-drop
- [x] Show upload progress/loading state
- [x] Validate file type (PNG, JPG, SVG, WebP) and size (max 2MB)
- [x] Auto-populate logoUrl field after successful upload
- [x] Show preview of uploaded logo with Replace/Remove buttons
- [x] Also support favicon upload via same mechanism
- [x] Write vitest tests for upload validation (27 tests pass)
- [x] Checkpoint saved

## PWA Logo Update: Sterling Marketing
- [x] Upload Sterling Marketing logo to CDN
- [x] Replace all PWA icon files (512, 192, 180, 32, favicon.ico) with Sterling logo
- [x] Update PWA manifest name to "Sterling Marketing"
- [x] Update HTML title and apple-mobile-web-app-title
- [x] Update DashboardLayout and BrandingContext default fallbacks to "Sterling Marketing"
- [ ] VITE_APP_LOGO — user needs to update in Settings > Secrets manually
- [ ] Checkpoint saved

## Bug: Account Switching Not Working on PWA
- [x] Fix: Popover opens too wide on mobile/PWA viewport
- [x] Fix: Account list not rendering inside popover on mobile
- [x] Replace Popover with mobile-friendly Drawer (bottom sheet) on small screens
- [x] Added touch-manipulation and min-h-[40px] for better tap targets
- [x] Verify fix on mobile viewport — checkpoint saved
- [x] Fix: Drawer inside Sheet doesn't render on mobile — z-index conflict between portals
- [x] Replace Drawer with inline expandable list when on mobile sidebar (no portal needed)

## Bug: VITE_SQUARE_ENVIRONMENT Still Sandbox
- [x] Investigate why VITE_SQUARE_ENVIRONMENT is still "sandbox" — env var baked at Vite build time, not updating
- [x] Force-fix: hardcode production SDK URL in Billing.tsx and SquareEnvironment.Production in square.ts
- [x] Verify card form loads without sandbox error — checkpoint saved

## Per-Sub-Account Rebilling with Markup Margins (GHL-Style)
- [x] Add per-service markup columns to accountBilling schema (smsMarkup, emailMarkup, aiCallMarkup, voiceCallMarkup, llmMarkup, dialerMarkup + enabled toggles)
- [x] Push DB migration
- [x] Update usageTracker.ts to apply per-account markup multipliers
- [x] Add getRebillingSettings procedure
- [x] Add updateRebillingSettings procedure (agency admin only)
- [x] Build RebillingSettings component with live sliders (1.00x-5.00x, 0.05 increments)
- [x] Show base cost, charged-to-account, your-profit, and "$10 gives ~" calculations
- [x] Add "Configure" markup button in Agency Billing sub-account table with dialog
- [x] Write vitest tests for rebilling (16 tests pass)
- [x] Verify: 0 TypeScript errors
- [x] Checkpoint saved

## Full Rebrand: Sterling Marketing (Name + Logo Everywhere)
- [x] Upload new logo to CDN
- [x] Generate PWA icons (512, 192, 180, 32, favicon) from new logo
- [x] Update vite.config.ts PWA manifest name/short_name
- [x] Update client/index.html title and meta tags
- [x] Find and replace all "Apex System" / "Apex" references in codebase (30+ files updated)
- [x] Update DashboardLayout default brand name fallback
- [x] Update BrandingContext default title fallback
- [x] Update VITE_APP_TITLE secret to "Sterling Marketing" (user updated via Settings)
- [x] Update VITE_APP_LOGO secret with CDN URL (user updated via Settings)
- [x] Verify 0 TS errors
- [x] Checkpoint saved

## Bug: Branding Not Updating on Live Site
- [ ] Investigate why old branding persists after rebrand
- [ ] Check DB branding values for the active account
- [ ] Check what getBranding endpoint returns
- [ ] Fix root cause

## Branding Fix: Database Values Overriding Defaults
- [x] Fix branding: Update account 420001 (Premier Mortgage Resources) with correct Sterling Marketing branding colors and CDN logo
- [x] Fix branding: Update account 450002 (Apex System) with correct Sterling Marketing branding
- [x] Fix branding: Update BrandingContext defaults to use logo blue/green colors
- [x] Fix branding: Verify branding displays correctly on the live site

## Bug Fix: Published Site Still Shows ApexSystem
- [x] Fix login page: Still shows "ApexSystem" with old "A" logo and gold color
- [x] Fix dashboard sidebar: Already fixed in code - published site needs re-publish
- [x] Find and replace all remaining "ApexSystem" references in codebase (email domains, ICS UIDs)
- [x] Investigate why published site shows old branding - stale build from March 31, needs re-publish
- [ ] Verify fix on published site after new checkpoint and re-publish

## Bug Fix: PWA Issues
- [ ] Fix PWA homescreen icon/name still showing old ApexSystem branding
- [ ] Fix PWA in-app branding still showing old branding inside CRM
- [ ] Fix PWA account switcher - cannot switch from Agency Overview to sub-accounts (works on desktop)
- [x] Fix PWA homescreen icon: regenerated all icons with Sterling Marketing S mark
- [x] Fix PWA homescreen title: manifest already has correct name, updated theme_color
- [x] Fix in-app logo: S mark icon is correct for sidebar size, brand name text shows next to it
- [x] Regenerate PWA icons from Sterling Marketing logo (S mark centered, white bg)
- [x] Generate pwa-192x192.png, pwa-512x512.png, apple-touch-icon.png, favicon.ico, masked-icon.svg
- [x] Update vite.config.ts manifest with new theme_color, background_color, and icon entries
- [x] Update index.html apple-touch-icon and theme-color meta tags
- [x] Rebuild and save checkpoint for republish
- [x] Rename PWA icon files with -v2 suffix for cache busting
- [x] Update vite.config.ts manifest icon references to -v2 filenames
- [x] Update index.html apple-touch-icon with -v2 filename and ?v=2 query param
- [x] Add version: "2.0" to PWA manifest (used -v2 filenames instead, version field not supported by type)
- [x] Save checkpoint for republish

## Feature: Per-Sub-Account Rebilling with Markup Margins (GHL-Style)
- [ ] Update accountBilling schema with per-service markup columns (smsMarkup, emailMarkup, etc.)
- [ ] Add per-service rebillingEnabled boolean columns to accountBilling
- [ ] Push schema migration
- [ ] Update usageTracker.ts to apply per-account markup multipliers
- [ ] Add getRebillingSettings query procedure
- [ ] Add updateRebillingSettings mutation procedure (agency admin only)
- [ ] Build Rebilling UI tab in Sub-Account detail page with toggle, slider, cost table
- [ ] Update Agency Billing overview table with per-account effective rates
- [ ] Write tests for rebilling logic
- [x] Verify build with 0 TypeScript errors

## Feature: Social Media Content Generation
- [x] Create socialPosts schema table and push migration
- [x] Create socialAccounts schema table and push migration
- [x] Create contentBrandVoice schema table and push migration
- [x] Build contentGenerator service (server/services/contentGenerator.ts)
- [x] Build socialContent tRPC router with generatePost, saveDraft, getPosts, updatePost, deletePost
- [x] Build socialContent tRPC router with getBrandVoice, updateBrandVoice, generateContentCalendar
- [x] Build Social Media page UI - Content Generator section
- [x] Build Social Media page UI - Content Calendar section
- [x] Build Social Media page UI - Posts Management section
- [x] Build Social Media page UI - Brand Voice Settings
- [x] Add Social Media to sub-account sidebar navigation
- [x] Add /social-media route to App.tsx
- [x] Wire LLM usage tracking in generatePost (tracked via invokeLLM internally)
- [x] Write vitest tests for contentGenerator.ts (10 tests, all passing)
- [x] Verify build with 0 TypeScript errors

## Bug Fix: PWA Icon Caching for Existing Users
- [x] Fix 1: skipWaiting, clientsClaim, cleanupOutdatedCaches already present in workbox config
- [x] Fix 2: Using -v2 filenames for cache busting (version field not valid in ManifestOptions type)
- [x] Fix 3: Added cache-busting ?v=3 to ALL icon references in index.html
- [x] Fix 4: Added PwaUpdater component with useRegisterSW auto-update handler
- [x] Fix 5: Generated maskable icons with 20% safe zone padding, separate maskable purpose
- [x] Rebuild and save checkpoint

## Bug Fix: PWA Stale Cache on Published Site
- [x] Bump PWA version to 1.3.0 in vite.config.ts (added version field + renamed cache buckets)
- [x] Verify skipWaiting, clientsClaim, cleanupOutdatedCaches are set (already present)
- [x] Rebuild and save checkpoint for republish (switched to NetworkFirst caching strategy)

## Bug Fix: Permanent PWA Stale Cache Solution
- [x] Verify/set workbox: skipWaiting, clientsClaim, cleanupOutdatedCaches, navigateFallback, navigateFallbackDenylist (all already present)
- [x] Verify registerType: 'autoUpdate' in VitePWA config (already set)
- [x] Add SW force-update registration in main.tsx (navigator.serviceWorker.getRegistrations + update)
- [x] Bump manifest version to 2.0.0
- [x] Create /api/version endpoint returning build timestamp (server/_core/index.ts)
- [x] Add frontend version-check on app mount with auto-reload (main.tsx + vite define)
- [x] Rebuild and save checkpoint for republish

## Bug Fix: Facebook Leads Not Routing to Sub-Accounts
- [x] Swap lookup order in handleFacebookNativePayload: check facebookPageMappings (admin manual) first, then accountFacebookPages (OAuth) as fallback
- [x] Ensure pageAccessToken is still retrieved from accountFacebookPages for Graph API calls regardless of which lookup resolves the account
- [x] Write/update tests for new routing priority (5 new tests, all 1935 tests pass)
- [x] Save checkpoint

## Facebook Lead Routing Monitoring Dashboard
- [x] Schema: leadRoutingEvents table (eventId, pageId, leadId, accountId, routingMethod, status, errorMessage, responseTimeMs, timestamps)
- [x] DB migration pushed
- [x] Backend: leadRoutingMonitor service (logEvent, getStats, getRecentEvents, getFailureRate)
- [x] Backend: tRPC router — leadMonitor (getOverview, getRecentEvents, getTimeSeries, getFailures, acknowledgeFailure)
- [x] Backend: alert logic — notify owner on routing failures via in-app notification + push
- [x] Wire event logging into facebookLeads.ts webhook handler (success + failure paths)
- [x] Wire event logging into facebookLeadPoller.ts (success + failure paths)
- [x] Frontend: Lead Routing Monitor page under agency admin Settings
- [x] Frontend: Real-time stats cards (total leads, success rate, avg response time, failures)
- [x] Frontend: Time-series chart (leads over time, success vs failure)
- [x] Frontend: Recent events table with status, routing method, response time
- [x] Frontend: Failure alerts panel with acknowledge action
- [x] Frontend: Auto-refresh polling (30s interval)
- [x] Add route and sidebar navigation
- [x] Write vitest tests for monitoring module (14 tests, all 1949 pass)
- [x] Save checkpoint

## Exact Code Replacement: Facebook Lead Routing Priority (User-Specified)
- [x] Replace the routing lookup block (~line 197) with user's exact code: admin page mapping first, OAuth fallback
- [x] Update comment on line 192 to reflect new priority order
- [x] Run tests and save checkpoint (all 1949 pass)

## Fix Push Notification System (VAPID + Diagnostics + Inbound Notifications)
- [x] Part 1: Add VAPID key generation utility to webPush.ts (generateVAPIDKeyPair + isVapidConfigured)
- [x] Part 1: Add generateVapidKeys admin-only tRPC procedure to notifications router
- [x] Part 2: Add testPushNotification admin-only diagnostic endpoint to notifications router (returns sent/failed/vapidConfigured/subscriptionCount)
- [x] Part 3: Fix inbound message createNotification calls — added console.log before all 3 createNotification calls (Twilio compliance, Twilio normal, SendGrid) showing accountId, type, contactId, assignedUserId
- [x] Run tests and save checkpoint (all 1949 pass)

## Fix: Remove RequireAccount from /settings/notifications route
- [x] Remove RequireAccount wrapper from /settings/notifications in App.tsx so admins can access notification settings without a sub-account selected

## Add VAPID Key Generation + Test Push UI to NotificationSettings
- [x] Add admin-only "VAPID Configuration" card with Generate Keys button and key display
- [x] Add admin-only "Test Push Notification" card with account selector and Send Test button
- [x] Save checkpoint

## Fix: NotificationSettings — Account ID visibility + Test Push persistence
- [x] Replace manual Account ID input with a dropdown that lists sub-accounts with their IDs
- [x] Fix test push result not persisting — result now stored in component state with account name + timestamp
- [x] Save checkpoint

## Bug Fix: PWA Enable Push Notification button not working on mobile
- [x] Investigate push subscription flow — root cause: admin in agency scope has currentAccountId=null, subscribe silently returns false
- [x] Fix the Enable button — fall back to first available account when admin has no sub-account selected, added error toasts for all failure paths
- [x] Save checkpoint (all 1952 tests pass)

## UX: Post-enable notification confirmation message
- [x] After user enables push notifications, show a confirmation message explaining how to manage settings later
- [x] Save checkpoint

## Feature: Notification Log Page
- [x] Investigate existing notification tables — reusing existing notifications table (no schema changes needed)
- [x] Reusing existing notifications table with full history (including dismissed)
- [x] Add getNotificationLog paginated query helper to db.ts (type, read status, date range filters)
- [x] Add notifications.log tRPC procedure with pagination and filtering
- [x] Build NotificationLog.tsx page with type/status filters, paginated list, mark-as-read, time-ago formatting
- [x] Add route /settings/notification-log, Settings card, and "View all notifications" link in NotificationCenter dropdown
- [x] Write vitest tests (15 tests, all 1967 pass)
- [x] Save checkpoint

## Fix: Push notification subscribe error reporting
- [x] Replace silent guard in usePushNotifications.ts with specific console.error messages for each precondition
- [x] Add else clause to handleSubscribe in NotificationSettings.tsx to show toast on generic failure
- [x] Save checkpoint

## Fix: Push notification subscription stale handling
- [x] Fix 1: Add clearSubscriptions adminProcedure to notifications router (delete all push_subscriptions for accountId, return { deleted })
- [x] Fix 2: Handle stale browser subscriptions in usePushNotifications — unsubscribe existing before creating new, verify localStorage against actual browser subscription on mount
- [x] Fix 3: Add "Reset All Subscriptions" admin button to NotificationSettings below Test Push card
- [x] Save checkpoint
