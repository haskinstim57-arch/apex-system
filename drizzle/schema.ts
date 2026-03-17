import {
  boolean,
  int,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  varchar,
} from "drizzle-orm/mysql-core";

// ─────────────────────────────────────────────
// USERS — Core auth table
// ─────────────────────────────────────────────
export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  /** bcrypt hash for email/password login (sub-account users) */
  passwordHash: varchar("passwordHash", { length: 255 }),
  /** Platform-level role: admin = agency owner, user = normal user */
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

// ─────────────────────────────────────────────
// ACCOUNTS — Multi-tenant sub-accounts
// parentId = null → top-level agency account
// parentId = N   → client sub-account under agency
// ─────────────────────────────────────────────
export const accounts = mysqlTable("accounts", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  slug: varchar("slug", { length: 100 }).unique(),
  /** null = agency root; non-null = client sub-account */
  parentId: int("parentId"),
  /** User ID of the account owner (null until invitation is accepted) */
  ownerId: int("ownerId"),
  industry: varchar("industry", { length: 100 }).default("mortgage"),
  website: varchar("website", { length: 500 }),
  phone: varchar("phone", { length: 30 }),
  email: varchar("email", { length: 320 }),
  address: text("address"),
  logoUrl: text("logoUrl"),
  status: mysqlEnum("status", ["active", "suspended", "pending"])
    .default("active")
    .notNull(),
  onboardingComplete: boolean("onboardingComplete").default(false).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Account = typeof accounts.$inferSelect;
export type InsertAccount = typeof accounts.$inferInsert;

// ─────────────────────────────────────────────
// ACCOUNT MEMBERS — user ↔ account junction
// Roles within a sub-account:
//   owner    → full control
//   manager  → manage contacts, campaigns, employees
//   employee → restricted access
// ─────────────────────────────────────────────
export const accountMembers = mysqlTable("account_members", {
  id: int("id").autoincrement().primaryKey(),
  accountId: int("accountId").notNull(),
  userId: int("userId").notNull(),
  role: mysqlEnum("role", ["owner", "manager", "employee"])
    .default("employee")
    .notNull(),
  isActive: boolean("isActive").default(true).notNull(),
  /** JSON blob for granular permissions */
  permissions: text("permissions"),
  joinedAt: timestamp("joinedAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type AccountMember = typeof accountMembers.$inferSelect;
export type InsertAccountMember = typeof accountMembers.$inferInsert;

// ─────────────────────────────────────────────
// INVITATIONS — email-based invite tokens
// ─────────────────────────────────────────────
export const invitations = mysqlTable("invitations", {
  id: int("id").autoincrement().primaryKey(),
  accountId: int("accountId").notNull(),
  invitedById: int("invitedById").notNull(),
  email: varchar("email", { length: 320 }).notNull(),
  role: mysqlEnum("role", ["owner", "manager", "employee"])
    .default("employee")
    .notNull(),
  token: varchar("token", { length: 64 }).notNull().unique(),
  status: mysqlEnum("status", ["pending", "accepted", "expired", "revoked"])
    .default("pending")
    .notNull(),
  message: text("message"),
  expiresAt: timestamp("expiresAt").notNull(),
  acceptedAt: timestamp("acceptedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Invitation = typeof invitations.$inferSelect;
export type InsertInvitation = typeof invitations.$inferInsert;

// ─────────────────────────────────────────────
// AUDIT LOGS — action tracking for compliance
// ─────────────────────────────────────────────
export const auditLogs = mysqlTable("audit_logs", {
  id: int("id").autoincrement().primaryKey(),
  accountId: int("accountId"),
  userId: int("userId"),
  action: varchar("action", { length: 100 }).notNull(),
  resourceType: varchar("resourceType", { length: 50 }),
  resourceId: int("resourceId"),
  metadata: text("metadata"),
  ipAddress: varchar("ipAddress", { length: 45 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type AuditLog = typeof auditLogs.$inferSelect;
export type InsertAuditLog = typeof auditLogs.$inferInsert;

// ─────────────────────────────────────────────
// CONTACTS — core CRM entity, scoped to sub-account
// ─────────────────────────────────────────────
export const contacts = mysqlTable("contacts", {
  id: int("id").autoincrement().primaryKey(),
  /** Sub-account this contact belongs to */
  accountId: int("accountId").notNull(),
  firstName: varchar("firstName", { length: 100 }).notNull(),
  lastName: varchar("lastName", { length: 100 }).notNull(),
  email: varchar("email", { length: 320 }),
  phone: varchar("phone", { length: 30 }),
  /** Where the lead came from */
  leadSource: varchar("leadSource", { length: 100 }),
  /** Pipeline status */
  status: mysqlEnum("status", [
    "new",
    "contacted",
    "qualified",
    "proposal",
    "negotiation",
    "won",
    "lost",
    "nurture",
  ])
    .default("new")
    .notNull(),
  /** User ID of the assigned team member */
  assignedUserId: int("assignedUserId"),
  /** Company / organization */
  company: varchar("company", { length: 255 }),
  /** Job title / position */
  title: varchar("title", { length: 255 }),
  /** Full address */
  address: text("address"),
  /** City */
  city: varchar("city", { length: 100 }),
  /** State / province */
  state: varchar("state", { length: 100 }),
  /** ZIP / postal code */
  zip: varchar("zip", { length: 20 }),
  /** Date of birth */
  dateOfBirth: timestamp("dateOfBirth"),
  /** Custom fields JSON */
  customFields: text("customFields"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Contact = typeof contacts.$inferSelect;
export type InsertContact = typeof contacts.$inferInsert;

// ─────────────────────────────────────────────
// CONTACT TAGS — many-to-many tagging system
// ─────────────────────────────────────────────
export const contactTags = mysqlTable("contact_tags", {
  id: int("id").autoincrement().primaryKey(),
  contactId: int("contactId").notNull(),
  tag: varchar("tag", { length: 100 }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type ContactTag = typeof contactTags.$inferSelect;
export type InsertContactTag = typeof contactTags.$inferInsert;

// ─────────────────────────────────────────────
// CONTACT NOTES — timestamped notes per contact
// ─────────────────────────────────────────────
export const contactNotes = mysqlTable("contact_notes", {
  id: int("id").autoincrement().primaryKey(),
  contactId: int("contactId").notNull(),
  /** User who wrote the note */
  authorId: int("authorId").notNull(),
  content: text("content").notNull(),
  /** pinned notes float to top */
  isPinned: boolean("isPinned").default(false).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type ContactNote = typeof contactNotes.$inferSelect;
export type InsertContactNote = typeof contactNotes.$inferInsert;

// ─────────────────────────────────────────────
// MESSAGES — email & SMS communication history
// ─────────────────────────────────────────────
export const messages = mysqlTable("messages", {
  id: int("id").autoincrement().primaryKey(),
  /** Sub-account this message belongs to */
  accountId: int("accountId").notNull(),
  /** Contact this message is associated with */
  contactId: int("contactId").notNull(),
  /** User who sent/received the message */
  userId: int("userId").notNull(),
  /** email or sms */
  type: mysqlEnum("type", ["email", "sms"]).notNull(),
  /** outbound = sent by user, inbound = received from contact */
  direction: mysqlEnum("direction", ["outbound", "inbound"])
    .default("outbound")
    .notNull(),
  /** Delivery status */
  status: mysqlEnum("status", ["pending", "sent", "delivered", "failed", "bounced"])
    .default("pending")
    .notNull(),
  /** Email subject (null for SMS) */
  subject: varchar("subject", { length: 500 }),
  /** Message body — plain text or HTML for email */
  body: text("body").notNull(),
  /** Recipient address (email or phone) */
  toAddress: varchar("toAddress", { length: 320 }).notNull(),
  /** Sender address (email or phone) */
  fromAddress: varchar("fromAddress", { length: 320 }),
  /** External provider message ID (for tracking) */
  externalId: varchar("externalId", { length: 255 }),
  /** Error message if delivery failed */
  errorMessage: text("errorMessage"),
  /** When the message was actually sent */
  sentAt: timestamp("sentAt"),
  /** When the message was delivered */
  deliveredAt: timestamp("deliveredAt"),
  /** When the message was read/opened */
  readAt: timestamp("readAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Message = typeof messages.$inferSelect;
export type InsertMessage = typeof messages.$inferInsert;

// ─────────────────────────────────────────────
// CAMPAIGN TEMPLATES — reusable message templates
// ─────────────────────────────────────────────
export const campaignTemplates = mysqlTable("campaign_templates", {
  id: int("id").autoincrement().primaryKey(),
  /** Sub-account this template belongs to */
  accountId: int("accountId").notNull(),
  /** Template name for internal reference */
  name: varchar("name", { length: 255 }).notNull(),
  /** email or sms */
  type: mysqlEnum("type", ["email", "sms"]).notNull(),
  /** Email subject line (null for SMS) */
  subject: varchar("subject", { length: 500 }),
  /** Template body — supports {{firstName}}, {{lastName}}, etc. */
  body: text("body").notNull(),
  /** User who created the template */
  createdById: int("createdById").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type CampaignTemplate = typeof campaignTemplates.$inferSelect;
export type InsertCampaignTemplate = typeof campaignTemplates.$inferInsert;

// ─────────────────────────────────────────────
// CAMPAIGNS — email & SMS campaign management
// ─────────────────────────────────────────────
export const campaigns = mysqlTable("campaigns", {
  id: int("id").autoincrement().primaryKey(),
  /** Sub-account this campaign belongs to */
  accountId: int("accountId").notNull(),
  /** Campaign display name */
  name: varchar("name", { length: 255 }).notNull(),
  /** email or sms */
  type: mysqlEnum("type", ["email", "sms"]).notNull(),
  /** Campaign lifecycle status */
  status: mysqlEnum("status", ["draft", "scheduled", "sending", "sent", "paused", "cancelled"])
    .default("draft")
    .notNull(),
  /** Optional template reference */
  templateId: int("templateId"),
  /** Email subject (can override template) */
  subject: varchar("subject", { length: 500 }),
  /** Message body (can override template) */
  body: text("body").notNull(),
  /** Sender address / from name */
  fromAddress: varchar("fromAddress", { length: 320 }),
  /** When to send (null = send immediately) */
  scheduledAt: timestamp("scheduledAt"),
  /** When campaign actually started sending */
  sentAt: timestamp("sentAt"),
  /** When campaign finished sending to all recipients */
  completedAt: timestamp("completedAt"),
  /** Total recipients count (denormalized for performance) */
  totalRecipients: int("totalRecipients").default(0).notNull(),
  /** Successfully sent count */
  sentCount: int("sentCount").default(0).notNull(),
  /** Delivered count */
  deliveredCount: int("deliveredCount").default(0).notNull(),
  /** Failed count */
  failedCount: int("failedCount").default(0).notNull(),
  /** Opened count (email only) */
  openedCount: int("openedCount").default(0).notNull(),
  /** Clicked count (email only) */
  clickedCount: int("clickedCount").default(0).notNull(),
  /** User who created the campaign */
  createdById: int("createdById").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Campaign = typeof campaigns.$inferSelect;
export type InsertCampaign = typeof campaigns.$inferInsert;

// ─────────────────────────────────────────────
// CAMPAIGN RECIPIENTS — per-contact delivery tracking
// ─────────────────────────────────────────────
export const campaignRecipients = mysqlTable("campaign_recipients", {
  id: int("id").autoincrement().primaryKey(),
  campaignId: int("campaignId").notNull(),
  contactId: int("contactId").notNull(),
  /** Delivery status for this recipient */
  status: mysqlEnum("status", ["pending", "sent", "delivered", "failed", "bounced", "opened", "clicked"])
    .default("pending")
    .notNull(),
  /** Address used for delivery */
  toAddress: varchar("toAddress", { length: 320 }).notNull(),
  /** External provider message ID */
  externalId: varchar("externalId", { length: 255 }),
  /** Error message if delivery failed */
  errorMessage: text("errorMessage"),
  sentAt: timestamp("sentAt"),
  deliveredAt: timestamp("deliveredAt"),
  openedAt: timestamp("openedAt"),
  clickedAt: timestamp("clickedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type CampaignRecipient = typeof campaignRecipients.$inferSelect;
export type InsertCampaignRecipient = typeof campaignRecipients.$inferInsert;

// ─────────────────────────────────────────────
// AI CALLS — AI voice agent call logs
// ─────────────────────────────────────────────
export const aiCalls = mysqlTable("ai_calls", {
  id: int("id").autoincrement().primaryKey(),
  /** Sub-account this call belongs to */
  accountId: int("accountId").notNull(),
  /** Contact being called */
  contactId: int("contactId").notNull(),
  /** User who initiated the call */
  initiatedById: int("initiatedById").notNull(),
  /** Phone number dialed */
  phoneNumber: varchar("phoneNumber", { length: 30 }).notNull(),
  /** Call status */
  status: mysqlEnum("status", ["queued", "calling", "completed", "failed", "no_answer", "busy", "cancelled"])
    .default("queued")
    .notNull(),
  /** Call direction */
  direction: mysqlEnum("direction", ["outbound", "inbound"])
    .default("outbound")
    .notNull(),
  /** Duration in seconds */
  durationSeconds: int("durationSeconds").default(0).notNull(),
  /** Call start time */
  startedAt: timestamp("startedAt"),
  /** Call end time */
  endedAt: timestamp("endedAt"),
  /** AI transcript of the call (placeholder for VAPI) */
  transcript: text("transcript"),
  /** Summary generated by AI */
  summary: text("summary"),
  /** Recording URL (placeholder for VAPI) */
  recordingUrl: text("recordingUrl"),
  /** External provider call ID (e.g., VAPI call ID) */
  externalCallId: varchar("externalCallId", { length: 255 }),
  /** Sentiment analysis result */
  sentiment: mysqlEnum("sentiment", ["positive", "neutral", "negative"]),
  /** Error message if call failed */
  errorMessage: text("errorMessage"),
  /** Which VAPI assistant was used (based on lead source) */
  assistantId: varchar("assistantId", { length: 255 }),
  /** JSON metadata from VAPI */
  metadata: text("metadata"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type AICall = typeof aiCalls.$inferSelect;
export type InsertAICall = typeof aiCalls.$inferInsert;

// ─────────────────────────────────────────────
// WORKFLOWS — automation workflow definitions
// ─────────────────────────────────────────────
export const workflows = mysqlTable("workflows", {
  id: int("id").autoincrement().primaryKey(),
  /** Sub-account this workflow belongs to */
  accountId: int("accountId").notNull(),
  /** Workflow display name */
  name: varchar("name", { length: 255 }).notNull(),
  /** Optional description */
  description: text("description"),
  /** Trigger type that starts this workflow */
  triggerType: mysqlEnum("triggerType", [
    "contact_created",
    "tag_added",
    "pipeline_stage_changed",
    "facebook_lead_received",
    "manual",
  ]).notNull(),
  /** JSON config for trigger (e.g., which tag, which stage) */
  triggerConfig: text("triggerConfig"),
  /** Whether the workflow is active */
  isActive: boolean("isActive").default(false).notNull(),
  /** User who created the workflow */
  createdById: int("createdById").notNull(),
  /** Total times this workflow has been executed */
  executionCount: int("executionCount").default(0).notNull(),
  /** Last time this workflow was executed */
  lastExecutedAt: timestamp("lastExecutedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Workflow = typeof workflows.$inferSelect;
export type InsertWorkflow = typeof workflows.$inferInsert;

// ─────────────────────────────────────────────
// WORKFLOW STEPS — ordered actions/delays in a workflow
// ─────────────────────────────────────────────
export const workflowSteps = mysqlTable("workflow_steps", {
  id: int("id").autoincrement().primaryKey(),
  /** Parent workflow */
  workflowId: int("workflowId").notNull(),
  /** Step order (1-based) */
  stepOrder: int("stepOrder").notNull(),
  /** Step type: action or delay */
  stepType: mysqlEnum("stepType", ["action", "delay"]).notNull(),
  /** Action type (null for delay steps) */
  actionType: mysqlEnum("actionType", [
    "send_sms",
    "send_email",
    "start_ai_call",
    "add_tag",
    "remove_tag",
    "update_contact_field",
    "create_task",
  ]),
  /** Delay type (null for action steps) */
  delayType: mysqlEnum("delayType", ["minutes", "hours", "days"]),
  /** Delay value (null for action steps) */
  delayValue: int("delayValue"),
  /** JSON config for the step (template, field values, tag name, etc.) */
  config: text("config"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type WorkflowStep = typeof workflowSteps.$inferSelect;
export type InsertWorkflowStep = typeof workflowSteps.$inferInsert;

// ─────────────────────────────────────────────
// WORKFLOW EXECUTIONS — per-contact workflow run
// ─────────────────────────────────────────────
export const workflowExecutions = mysqlTable("workflow_executions", {
  id: int("id").autoincrement().primaryKey(),
  /** Parent workflow */
  workflowId: int("workflowId").notNull(),
  /** Sub-account for isolation */
  accountId: int("accountId").notNull(),
  /** Contact being processed */
  contactId: int("contactId").notNull(),
  /** Overall execution status */
  status: mysqlEnum("status", ["running", "completed", "failed", "paused", "cancelled"])
    .default("running")
    .notNull(),
  /** Which step is currently being executed (step order) */
  currentStep: int("currentStep").default(1).notNull(),
  /** Total steps in the workflow at time of execution */
  totalSteps: int("totalSteps").default(0).notNull(),
  /** When the next step should execute (for delays) */
  nextStepAt: timestamp("nextStepAt"),
  /** Error message if execution failed */
  errorMessage: text("errorMessage"),
  /** What triggered this execution */
  triggeredBy: varchar("triggeredBy", { length: 100 }),
  startedAt: timestamp("startedAt").defaultNow().notNull(),
  completedAt: timestamp("completedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type WorkflowExecution = typeof workflowExecutions.$inferSelect;
export type InsertWorkflowExecution = typeof workflowExecutions.$inferInsert;

// ─────────────────────────────────────────────
// WORKFLOW EXECUTION STEPS — per-step execution log
// ─────────────────────────────────────────────
export const workflowExecutionSteps = mysqlTable("workflow_execution_steps", {
  id: int("id").autoincrement().primaryKey(),
  /** Parent execution */
  executionId: int("executionId").notNull(),
  /** Reference to the workflow step */
  stepId: int("stepId").notNull(),
  /** Step order at time of execution */
  stepOrder: int("stepOrder").notNull(),
  /** Step type snapshot */
  stepType: mysqlEnum("stepType", ["action", "delay"]).notNull(),
  /** Action type snapshot */
  actionType: varchar("actionType", { length: 50 }),
  /** Step execution status */
  status: mysqlEnum("status", ["pending", "running", "completed", "failed", "skipped"])
    .default("pending")
    .notNull(),
  /** JSON result/output from the step */
  result: text("result"),
  /** Error message if step failed */
  errorMessage: text("errorMessage"),
  /** When this step started executing */
  startedAt: timestamp("startedAt"),
  /** When this step finished */
  completedAt: timestamp("completedAt"),
  /** When this step is scheduled to execute (for delays) */
  scheduledAt: timestamp("scheduledAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type WorkflowExecutionStep = typeof workflowExecutionSteps.$inferSelect;
export type InsertWorkflowExecutionStep = typeof workflowExecutionSteps.$inferInsert;

// ─────────────────────────────────────────────
// TASKS — task management for workflow actions
// ─────────────────────────────────────────────
export const tasks = mysqlTable("tasks", {
  id: int("id").autoincrement().primaryKey(),
  /** Sub-account this task belongs to */
  accountId: int("accountId").notNull(),
  /** Contact this task is related to */
  contactId: int("contactId"),
  /** User assigned to this task */
  assignedUserId: int("assignedUserId"),
  /** Task title */
  title: varchar("title", { length: 500 }).notNull(),
  /** Task description */
  description: text("description"),
  /** Task status */
  status: mysqlEnum("status", ["pending", "in_progress", "completed", "cancelled"])
    .default("pending")
    .notNull(),
  /** Priority level */
  priority: mysqlEnum("priority", ["low", "medium", "high", "urgent"])
    .default("medium")
    .notNull(),
  /** Due date */
  dueAt: timestamp("dueAt"),
  /** Completed date */
  completedAt: timestamp("completedAt"),
  /** Source of the task (manual, workflow, etc.) */
  source: varchar("source", { length: 50 }).default("manual"),
  /** Reference to workflow execution that created this task */
  workflowExecutionId: int("workflowExecutionId"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Task = typeof tasks.$inferSelect;
export type InsertTask = typeof tasks.$inferInsert;

// ─────────────────────────────────────────────
// PIPELINES — Pipeline definitions per account
// ─────────────────────────────────────────────
export const pipelines = mysqlTable("pipelines", {
  id: int("id").autoincrement().primaryKey(),
  accountId: int("account_id").notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  isDefault: boolean("is_default").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});

export type Pipeline = typeof pipelines.$inferSelect;
export type InsertPipeline = typeof pipelines.$inferInsert;

// ─────────────────────────────────────────────
// PIPELINE STAGES — Ordered stages within a pipeline
// ─────────────────────────────────────────────
export const pipelineStages = mysqlTable("pipeline_stages", {
  id: int("id").autoincrement().primaryKey(),
  pipelineId: int("pipeline_id").notNull(),
  accountId: int("account_id").notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  color: varchar("color", { length: 20 }).default("#6b7280").notNull(),
  sortOrder: int("sort_order").default(0).notNull(),
  isWon: boolean("is_won").default(false).notNull(),
  isLost: boolean("is_lost").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type PipelineStage = typeof pipelineStages.$inferSelect;
export type InsertPipelineStage = typeof pipelineStages.$inferInsert;

// ─────────────────────────────────────────────
// DEALS — Contacts placed in pipeline stages
// ─────────────────────────────────────────────
export const deals = mysqlTable("deals", {
  id: int("id").autoincrement().primaryKey(),
  accountId: int("account_id").notNull(),
  pipelineId: int("pipeline_id").notNull(),
  stageId: int("stage_id").notNull(),
  contactId: int("contact_id").notNull(),
  title: varchar("title", { length: 500 }),
  value: int("value").default(0),
  sortOrder: int("sort_order").default(0).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});

export type Deal = typeof deals.$inferSelect;
export type InsertDeal = typeof deals.$inferInsert;

// ─────────────────────────────────────────────
// FACEBOOK PAGE MAPPINGS — route FB page_id → sub-account
// ─────────────────────────────────────────────
export const facebookPageMappings = mysqlTable("facebook_page_mappings", {
  id: int("id").autoincrement().primaryKey(),
  /** The Facebook Page ID (from webhook payload entry.id or value.page_id) */
  facebookPageId: varchar("facebook_page_id", { length: 100 }).notNull().unique(),
  /** The sub-account this page maps to */
  accountId: int("account_id").notNull(),
  /** Human-readable page name for admin reference */
  pageName: varchar("page_name", { length: 255 }),
  /** Per-client Facebook webhook verify token (each client has their own FB Ads Manager) */
  verifyToken: varchar("verify_token", { length: 255 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});

export type FacebookPageMapping = typeof facebookPageMappings.$inferSelect;
export type InsertFacebookPageMapping = typeof facebookPageMappings.$inferInsert;

// ─────────────────────────────────────────────
// IMPERSONATION AUDIT LOGS — track admin impersonation sessions
// ─────────────────────────────────────────────
export const impersonationAuditLogs = mysqlTable("impersonation_audit_logs", {
  id: int("id").autoincrement().primaryKey(),
  /** The admin user who initiated impersonation */
  adminId: int("admin_id").notNull(),
  /** The admin user's name (for quick reference) */
  adminName: varchar("admin_name", { length: 255 }),
  /** The target sub-account being impersonated */
  targetAccountId: int("target_account_id").notNull(),
  /** The target account name (for quick reference) */
  targetAccountName: varchar("target_account_name", { length: 255 }),
  /** 'start' or 'stop' */
  action: varchar("action", { length: 20 }).notNull(),
  /** When the action occurred */
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type ImpersonationAuditLog = typeof impersonationAuditLogs.$inferSelect;
export type InsertImpersonationAuditLog = typeof impersonationAuditLogs.$inferInsert;

// ─────────────────────────────────────────────
// ACCOUNT MESSAGING SETTINGS — per-account Twilio/SendGrid credentials
// ─────────────────────────────────────────────
export const accountMessagingSettings = mysqlTable("account_messaging_settings", {
  id: int("id").autoincrement().primaryKey(),
  /** The sub-account these settings belong to (unique per account) */
  accountId: int("account_id").notNull().unique(),
  /** Twilio credentials */
  twilioAccountSid: varchar("twilio_account_sid", { length: 255 }),
  twilioAuthToken: varchar("twilio_auth_token", { length: 255 }),
  twilioFromNumber: varchar("twilio_from_number", { length: 50 }),
  /** SendGrid credentials */
  sendgridApiKey: varchar("sendgrid_api_key", { length: 255 }),
  sendgridFromEmail: varchar("sendgrid_from_email", { length: 255 }),
  sendgridFromName: varchar("sendgrid_from_name", { length: 255 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});

export type AccountMessagingSettings = typeof accountMessagingSettings.$inferSelect;
export type InsertAccountMessagingSettings = typeof accountMessagingSettings.$inferInsert;
