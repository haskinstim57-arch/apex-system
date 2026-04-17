import {
  boolean,
  date,
  decimal,
  int,
  json,
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
  /** User's personal phone number for SMS notifications */
  phone: varchar("phone", { length: 30 }),
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
  /** Missed Call Text-Back settings */
  missedCallTextBackEnabled: boolean("missedCallTextBackEnabled").default(false).notNull(),
  missedCallTextBackMessage: text("missedCallTextBackMessage"),
  missedCallTextBackDelayMinutes: int("missedCallTextBackDelayMinutes").default(1).notNull(),
  /** Voice Agent Configuration */
  elevenLabsVoiceId: varchar("elevenLabsVoiceId", { length: 100 }),
  vapiAssistantId: varchar("vapiAssistantId", { length: 100 }),
  vapiPhoneNumber: varchar("vapiPhoneNumber", { length: 30 }),
  voiceAgentEnabled: boolean("voiceAgentEnabled").default(false).notNull(),
  /** Per-account AI calling business hours (JSON). null = use system defaults (7 AM - 10 PM ET, 7 days) */
  businessHoursConfig: json("businessHoursConfig").$type<{
    timezone: string;
    startHour: number;
    endHour: number;
    daysOfWeek: number[];
  }>(),
  /** White-label / Agency Branding */
  customDomain: varchar("customDomain", { length: 255 }),
  primaryColor: varchar("primaryColor", { length: 20 }).default("#0c5ab0"),
  /** Secondary accent color for white-label UI (badges, secondary buttons, highlights) */
  secondaryColor: varchar("secondaryColor", { length: 20 }),
  fromEmailDomain: varchar("fromEmailDomain", { length: 255 }),
  /** Verified flag for the custom email sender domain */
  emailDomainVerified: boolean("emailDomainVerified").default(false).notNull(),
  /** Branding text shown in emails / portal footer */
  brandName: varchar("brandName", { length: 255 }),
  /** Favicon URL for white-label portal */
  faviconUrl: text("faviconUrl"),
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
  /** Lead score (0-100+, higher = hotter lead) */
  leadScore: int("leadScore").default(0).notNull(),
  /** Do Not Disturb status: controls which channels are blocked */
  dndStatus: mysqlEnum("dnd_status", ["active", "dnd_sms", "dnd_email", "dnd_all"]).default("active").notNull(),
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
export const DISPOSITION_VALUES = [
  "voicemail_full",
  "left_voicemail",
  "no_answer",
  "answered",
  "callback_requested",
  "wrong_number",
  "do_not_call",
  "appointment_set",
  "not_interested",
  "other",
] as const;

export type DispositionType = (typeof DISPOSITION_VALUES)[number];

export const contactNotes = mysqlTable("contact_notes", {
  id: int("id").autoincrement().primaryKey(),
  contactId: int("contactId").notNull(),
  /** User who wrote the note */
  authorId: int("authorId").notNull(),
  content: text("content").notNull(),
  /** Call/contact disposition */
  disposition: varchar("disposition", { length: 50 }),
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
  /** Whether the message has been read in the inbox (outbound defaults true, inbound defaults false) */
  isRead: boolean("isRead").default(true).notNull(),
  /** When the message was read/opened */
  readAt: timestamp("readAt"),
  /** Sequence step that generated this message (nullable — only set for drip-engine messages) */
  sequenceStepId: int("sequence_step_id"),
  /** Position of the step within the sequence (nullable) */
  sequenceStepPosition: int("sequence_step_position"),
  /** Number of retry attempts made (0 = original send) */
  retryCount: int("retry_count").default(0).notNull(),
  /** When the next retry should fire (null = no retry scheduled) */
  retryAt: timestamp("retry_at"),
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
    "inbound_message_received",
    "appointment_booked",
    "appointment_cancelled",
    "call_completed",
    "missed_call",
    "form_submitted",
    "date_trigger",
    "score_changed",
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
  /** Step type: action, delay, or condition (if/else branch) */
  stepType: mysqlEnum("stepType", ["action", "delay", "condition"]).notNull(),
  /** Action type (null for delay steps) */
  actionType: mysqlEnum("actionType", [
    "send_sms",
    "send_email",
    "start_ai_call",
    "add_tag",
    "remove_tag",
    "update_contact_field",
    "create_task",
    "add_to_campaign",
    "assign_pipeline_stage",
    "notify_user",
    "send_review_request",
    "enroll_in_sequence",
    "unenroll_from_sequence",
    "request_payment",
  ]),
  /** Delay type (null for action steps) */
  delayType: mysqlEnum("delayType", ["minutes", "hours", "days"]),
  /** Delay value (null for action steps) */
  delayValue: int("delayValue"),
  /** JSON config for the step (template, field values, tag name, etc.) */
  config: text("config"),
  /** JSON config for condition steps: { field, operator, value, trueBranchStepOrder, falseBranchStepOrder } */
  conditionConfig: text("conditionConfig"),
  /** Explicit next step ID for non-linear step ordering. If set, overrides sort-order traversal. Null = follow sequential order. */
  nextStepId: int("nextStepId"),
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
  stepType: mysqlEnum("stepType", ["action", "delay", "condition"]).notNull(),
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
  /** Twilio purchased phone number SID (for releasing) */
  twilioPhoneSid: varchar("twilio_phone_sid", { length: 64 }),
  /** SendGrid credentials */
  sendgridApiKey: varchar("sendgrid_api_key", { length: 255 }),
  sendgridFromEmail: varchar("sendgrid_from_email", { length: 255 }),
  sendgridFromName: varchar("sendgrid_from_name", { length: 255 }),
  /** Blooio credentials (SMS/iMessage provider) */
  blooioApiKey: varchar("blooio_api_key", { length: 255 }),
  /** Business hours configuration (JSON) — per-day schedule with timezone */
  businessHours: text("business_hours"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});

export type AccountMessagingSettings = typeof accountMessagingSettings.$inferSelect;
export type InsertAccountMessagingSettings = typeof accountMessagingSettings.$inferInsert;

/** Business hours JSON shape stored in accountMessagingSettings.businessHours */
export interface BusinessHoursSchedule {
  enabled: boolean;
  timezone: string;
  schedule: {
    [day: string]: {
      open: boolean;
      start?: string; // "HH:MM" format
      end?: string;   // "HH:MM" format
    };
  };
}

// ─────────────────────────────────────────────
// PASSWORD RESET TOKENS — For forgot password flow
// ─────────────────────────────────────────────
export const passwordResetTokens = mysqlTable("password_reset_tokens", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  token: varchar("token", { length: 64 }).notNull().unique(),
  expiresAt: timestamp("expiresAt").notNull(),
  usedAt: timestamp("usedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type PasswordResetToken = typeof passwordResetTokens.$inferSelect;
export type InsertPasswordResetToken = typeof passwordResetTokens.$inferInsert;

// ─────────────────────────────────────────────
// ACCOUNT INTEGRATIONS — OAuth tokens for external services (Facebook, Google, etc.)
// ─────────────────────────────────────────────
export const accountIntegrations = mysqlTable("account_integrations", {
  id: int("id").autoincrement().primaryKey(),
  /** The sub-account this integration belongs to */
  accountId: int("account_id").notNull(),
  /** The provider name (e.g., "facebook", "google") */
  provider: varchar("provider", { length: 50 }).notNull(),
  /** The provider-specific user ID (e.g., Facebook user ID) */
  providerUserId: varchar("provider_user_id", { length: 255 }),
  /** The provider-specific user name / display name */
  providerUserName: varchar("provider_user_name", { length: 255 }),
  /** The OAuth access token */
  accessToken: text("access_token"),
  /** The OAuth refresh token (if applicable) */
  refreshToken: text("refresh_token"),
  /** When the access token expires */
  tokenExpiresAt: timestamp("token_expires_at"),
  /** Whether this integration is currently active */
  isActive: boolean("is_active").default(true).notNull(),
  /** The user who connected this integration */
  connectedById: int("connected_by_id"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});

export type AccountIntegration = typeof accountIntegrations.$inferSelect;
export type InsertAccountIntegration = typeof accountIntegrations.$inferInsert;

// ─────────────────────────────────────────────
// ACCOUNT FACEBOOK PAGES — Pages fetched after Facebook OAuth
// ─────────────────────────────────────────────
export const accountFacebookPages = mysqlTable("account_facebook_pages", {
  id: int("id").autoincrement().primaryKey(),
  /** The sub-account this page belongs to */
  accountId: int("account_id").notNull(),
  /** The integration ID that fetched this page */
  integrationId: int("integration_id").notNull(),
  /** The Facebook Page ID */
  facebookPageId: varchar("facebook_page_id", { length: 100 }).notNull(),
  /** The Facebook Page name */
  pageName: varchar("page_name", { length: 255 }),
  /** The page-specific access token (for subscribing to webhooks) */
  pageAccessToken: text("page_access_token"),
  /** Whether lead webhook subscription is active for this page */
  isSubscribed: boolean("is_subscribed").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});

export type AccountFacebookPage = typeof accountFacebookPages.$inferSelect;
export type InsertAccountFacebookPage = typeof accountFacebookPages.$inferInsert;

// ─────────────────────────────────────────────
// CALENDARS — Booking calendars per sub-account
// ─────────────────────────────────────────────
export const calendars = mysqlTable("calendars", {
  id: int("id").autoincrement().primaryKey(),
  /** Sub-account this calendar belongs to */
  accountId: int("accountId").notNull(),
  /** Display name for the calendar */
  name: varchar("name", { length: 255 }).notNull(),
  /** Unique slug for public booking URL (/book/:slug) */
  slug: varchar("slug", { length: 100 }).notNull().unique(),
  /** Optional description shown on the booking page */
  description: text("description"),
  /** IANA timezone (e.g., "America/New_York") */
  timezone: varchar("timezone", { length: 100 }).default("America/New_York").notNull(),
  /** Buffer time in minutes between appointments */
  bufferMinutes: int("bufferMinutes").default(15).notNull(),
  /** Minimum notice in hours before an appointment can be booked */
  minNoticeHours: int("minNoticeHours").default(24).notNull(),
  /** Maximum days ahead that can be booked */
  maxDaysAhead: int("maxDaysAhead").default(30).notNull(),
  /** Duration of each appointment slot in minutes */
  slotDurationMinutes: int("slotDurationMinutes").default(30).notNull(),
  /** Weekly availability as JSON: { "monday": [{ start: "09:00", end: "17:00" }], ... } */
  availabilityJson: text("availabilityJson"),
  /** Whether this calendar is active and accepting bookings */
  isActive: boolean("isActive").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Calendar = typeof calendars.$inferSelect;
export type InsertCalendar = typeof calendars.$inferInsert;

// ─────────────────────────────────────────────
// APPOINTMENTS — Bookings on a calendar
// ─────────────────────────────────────────────
export const appointments = mysqlTable("appointments", {
  id: int("id").autoincrement().primaryKey(),
  /** Calendar this appointment belongs to */
  calendarId: int("calendarId").notNull(),
  /** Sub-account this appointment belongs to (denormalized for fast queries) */
  accountId: int("accountId").notNull(),
  /** Optional FK to contacts table (linked after matching) */
  contactId: int("contactId"),
  /** Guest name from booking form */
  guestName: varchar("guestName", { length: 255 }).notNull(),
  /** Guest email from booking form */
  guestEmail: varchar("guestEmail", { length: 320 }).notNull(),
  /** Guest phone from booking form */
  guestPhone: varchar("guestPhone", { length: 30 }),
  /** Appointment start time (UTC) */
  startTime: timestamp("startTime").notNull(),
  /** Appointment end time (UTC) */
  endTime: timestamp("endTime").notNull(),
  /** Appointment status */
  status: mysqlEnum("status", ["pending", "confirmed", "cancelled"])
    .default("pending")
    .notNull(),
  /** Optional notes from guest or admin */
  notes: text("notes"),
  /** Whether 24h reminder has been sent */
  reminder24hSent: boolean("reminder24hSent").default(false).notNull(),
  /** Whether 1h reminder has been sent */
  reminder1hSent: boolean("reminder1hSent").default(false).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Appointment = typeof appointments.$inferSelect;
export type InsertAppointment = typeof appointments.$inferInsert;

// ─────────────────────────────────────────────
// CALENDAR INTEGRATIONS — Google/Outlook calendar sync per user
// ─────────────────────────────────────────────
export const calendarIntegrations = mysqlTable("calendar_integrations", {
  id: int("id").autoincrement().primaryKey(),
  /** User who connected this calendar */
  userId: int("user_id").notNull(),
  /** Sub-account this integration belongs to */
  accountId: int("account_id").notNull(),
  /** Provider: google or outlook */
  provider: mysqlEnum("provider", ["google", "outlook"]).notNull(),
  /** OAuth access token (encrypted at rest) */
  accessToken: text("access_token").notNull(),
  /** OAuth refresh token (encrypted at rest) */
  refreshToken: text("refresh_token"),
  /** When the access token expires */
  tokenExpiresAt: timestamp("token_expires_at"),
  /** External calendar ID (e.g., "primary" for Google, or specific calendar ID) */
  externalCalendarId: varchar("external_calendar_id", { length: 500 }).default("primary").notNull(),
  /** External user email / display name */
  externalEmail: varchar("external_email", { length: 320 }),
  /** Whether this integration is active */
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});

export type CalendarIntegration = typeof calendarIntegrations.$inferSelect;
export type InsertCalendarIntegration = typeof calendarIntegrations.$inferInsert;

// ─────────────────────────────────────────────
// CONTACT ACTIVITIES — Timeline events per contact
// ─────────────────────────────────────────────
export const contactActivities = mysqlTable("contact_activities", {
  id: int("id").autoincrement().primaryKey(),
  contactId: int("contact_id").notNull(),
  accountId: int("account_id").notNull(),
  /** Activity type enum covering all trackable events */
  activityType: mysqlEnum("activity_type", [
    "contact_created",
    "tag_added",
    "tag_removed",
    "pipeline_stage_changed",
    "message_sent",
    "message_received",
    "ai_call_made",
    "appointment_booked",
    "appointment_confirmed",
    "appointment_cancelled",
    "automation_triggered",
    "note_added",
    "task_created",
    "task_completed",
    "lead_routed",
    "lead_score_changed",
    "webchat_started",
    "webchat_handoff",
    "webchat_message",
    "sms_opt_out",
    "sms_opt_in",
  ]).notNull(),
  /** Human-readable description of the activity */
  description: text("description").notNull(),
  /** JSON metadata for extra context (e.g., fromStage/toStage, channel, duration) */
  metadata: text("metadata"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type ContactActivity = typeof contactActivities.$inferSelect;
export type InsertContactActivity = typeof contactActivities.$inferInsert;


// ─────────────────────────────────────────────
// Email Templates
// ─────────────────────────────────────────────
export const emailTemplates = mysqlTable("email_templates", {
  id: int("id").autoincrement().primaryKey(),
  accountId: int("account_id").notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  subject: varchar("subject", { length: 500 }).notNull().default(""),
  /** Pre-rendered HTML for sending / preview */
  htmlContent: text("html_content"),
  /** JSON block structure for re-editing in the builder */
  jsonBlocks: text("json_blocks"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type EmailTemplate = typeof emailTemplates.$inferSelect;
export type InsertEmailTemplate = typeof emailTemplates.$inferInsert;


// ─────────────────────────────────────────────
// NOTIFICATIONS — In-app notification center
// ─────────────────────────────────────────────
export const notifications = mysqlTable("notifications", {
  id: int("id").autoincrement().primaryKey(),
  accountId: int("account_id").notNull(),
  /** null = account-wide notification visible to all members */
  userId: int("user_id"),
  type: mysqlEnum("type", [
    "inbound_message",
    "appointment_booked",
    "appointment_cancelled",
    "ai_call_completed",
    "campaign_finished",
    "workflow_failed",
    "new_contact_facebook",
    "new_contact_booking",
    "missed_call",
    "report_sent",
    "system_alert",
    "new_lead",
  ]).notNull(),
  title: varchar("title", { length: 500 }).notNull(),
  body: text("body"),
  /** Relative link to the relevant page, e.g. /contacts/123 */
  link: varchar("link", { length: 500 }),
  isRead: boolean("is_read").default(false).notNull(),
  dismissed: boolean("dismissed").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type Notification = typeof notifications.$inferSelect;
export type InsertNotification = typeof notifications.$inferInsert;


// ─────────────────────────────────────────────
// PORT REQUESTS — Track Twilio number porting
// ─────────────────────────────────────────────
export const portRequests = mysqlTable("port_requests", {
  id: int("id").autoincrement().primaryKey(),
  accountId: int("account_id").notNull(),
  /** The phone number being ported in E.164 format */
  phoneNumber: varchar("phone_number", { length: 20 }).notNull(),
  /** Current carrier name */
  currentCarrier: varchar("current_carrier", { length: 255 }),
  /** Account number with current carrier */
  carrierAccountNumber: varchar("carrier_account_number", { length: 255 }),
  /** PIN/passcode for the carrier account */
  carrierPin: varchar("carrier_pin", { length: 100 }),
  /** Authorized contact name */
  authorizedName: varchar("authorized_name", { length: 255 }),
  /** Twilio porting SID once submitted */
  portingSid: varchar("porting_sid", { length: 100 }),
  /** Status of the port request */
  status: mysqlEnum("status", [
    "draft",
    "submitted",
    "in_progress",
    "completed",
    "failed",
    "cancelled",
  ]).default("draft").notNull(),
  /** Notes or error messages */
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});

export type PortRequest = typeof portRequests.$inferSelect;
export type InsertPortRequest = typeof portRequests.$inferInsert;


// ─────────────────────────────────────────────
// CALENDAR WATCHES — Push notification subscriptions for Google/Outlook
// ─────────────────────────────────────────────

export const calendarWatches = mysqlTable("calendar_watches", {
  id: int("id").autoincrement().primaryKey(),
  /** User who owns this watch */
  userId: int("user_id").notNull(),
  /** Sub-account this watch belongs to */
  accountId: int("account_id").notNull(),
  /** Calendar integration ID this watch is for */
  integrationId: int("integration_id").notNull(),
  /** Provider: google or outlook */
  provider: mysqlEnum("provider", ["google", "outlook"]).notNull(),
  /** Google: channel ID / Outlook: subscription ID */
  watchId: varchar("watch_id", { length: 500 }).notNull(),
  /** Google: resource ID / Outlook: not used */
  resourceId: varchar("resource_id", { length: 500 }),
  /** Channel token for verifying Google push notifications */
  channelToken: varchar("channel_token", { length: 500 }),
  /** When this watch/subscription expires */
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type CalendarWatch = typeof calendarWatches.$inferSelect;
export type InsertCalendarWatch = typeof calendarWatches.$inferInsert;

// ─────────────────────────────────────────────
// EXTERNAL CALENDAR EVENTS — Cached events from Google/Outlook
// ─────────────────────────────────────────────

export const externalCalendarEvents = mysqlTable("external_calendar_events", {
  id: int("id").autoincrement().primaryKey(),
  /** User who owns this event */
  userId: int("user_id").notNull(),
  /** Sub-account this event belongs to */
  accountId: int("account_id").notNull(),
  /** Provider: google or outlook */
  provider: mysqlEnum("provider", ["google", "outlook"]).notNull(),
  /** External event ID from Google/Outlook */
  externalEventId: varchar("external_event_id", { length: 500 }).notNull(),
  /** Event title */
  title: varchar("title", { length: 500 }).notNull(),
  /** Event start time */
  startTime: timestamp("start_time").notNull(),
  /** Event end time */
  endTime: timestamp("end_time").notNull(),
  /** Whether this is an all-day event */
  allDay: boolean("all_day").default(false).notNull(),
  /** Event status: confirmed, tentative, cancelled */
  status: varchar("status", { length: 50 }).default("confirmed").notNull(),
  /** When this event was last synced */
  syncedAt: timestamp("synced_at").defaultNow().notNull(),
});

export type ExternalCalendarEvent = typeof externalCalendarEvents.$inferSelect;
export type InsertExternalCalendarEvent = typeof externalCalendarEvents.$inferInsert;

// ─────────────────────────────────────────────
// DIALER SESSIONS — Power dialer session tracking
// ─────────────────────────────────────────────
export const dialerSessions = mysqlTable("dialer_sessions", {
  id: int("id").autoincrement().primaryKey(),
  /** Sub-account this session belongs to */
  accountId: int("accountId").notNull(),
  /** User who started the session */
  userId: int("userId").notNull(),
  /** JSON array of contact IDs to call */
  contactIds: text("contactIds").notNull(),
  /** Session status */
  status: mysqlEnum("status", ["active", "paused", "completed"])
    .default("active")
    .notNull(),
  /** Current index in the contactIds array (0-based) */
  currentIndex: int("currentIndex").default(0).notNull(),
  /** JSON array of per-contact results */
  results: text("results"),
  /** Optional script ID used during this session */
  scriptId: int("scriptId"),
  /** Total contacts in the session */
  totalContacts: int("totalContacts").default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  completedAt: timestamp("completedAt"),
});

export type DialerSession = typeof dialerSessions.$inferSelect;
export type InsertDialerSession = typeof dialerSessions.$inferInsert;

// ─────────────────────────────────────────────
// DIALER SCRIPTS — Call scripts for power dialer
// ─────────────────────────────────────────────
export const dialerScripts = mysqlTable("dialer_scripts", {
  id: int("id").autoincrement().primaryKey(),
  /** Sub-account this script belongs to */
  accountId: int("accountId").notNull(),
  /** Script display name */
  name: varchar("name", { length: 255 }).notNull(),
  /** Script content (markdown/plain text) */
  content: text("content").notNull(),
  /** Whether this script is active */
  isActive: boolean("isActive").default(true).notNull(),
  /** User who created the script */
  createdById: int("createdById").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type DialerScript = typeof dialerScripts.$inferSelect;
export type InsertDialerScript = typeof dialerScripts.$inferInsert;


// ─── Lead Routing Rules ───
export const leadRoutingRules = mysqlTable("lead_routing_rules", {
  id: int("id").autoincrement().primaryKey(),
  /** Sub-account this rule belongs to */
  accountId: int("accountId").notNull(),
  /** Human-readable rule name */
  name: varchar("name", { length: 255 }).notNull(),
  /** Routing strategy: round_robin, capacity_based, or specific_user */
  strategy: mysqlEnum("strategy", ["round_robin", "capacity_based", "specific_user"]).notNull().default("round_robin"),
  /** JSON array of user IDs to route leads to */
  assigneeIds: text("assigneeIds").notNull(), // JSON: number[]
  /** Whether this rule is active */
  isActive: boolean("isActive").default(true).notNull(),
  /** Priority order (lower = higher priority) */
  priority: int("priority").notNull().default(0),
  /** JSON conditions for when this rule applies (lead source, tags, etc.) */
  conditions: text("conditions"), // JSON: { leadSource?: string[], tags?: string[], source?: string[] }
  /** Current index for round-robin rotation */
  roundRobinIndex: int("roundRobinIndex").notNull().default(0),
  /** Max leads per user for capacity-based routing (0 = unlimited) */
  maxLeadsPerUser: int("maxLeadsPerUser").notNull().default(0),
  /** Apply to CSV imports */
  applyToCsvImport: boolean("applyToCsvImport").default(true).notNull(),
  /** Apply to Facebook lead capture */
  applyToFacebookLeads: boolean("applyToFacebookLeads").default(true).notNull(),
  /** Apply to manual contact creation */
  applyToManualCreate: boolean("applyToManualCreate").default(false).notNull(),
  /** User who created the rule */
  createdById: int("createdById").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type LeadRoutingRule = typeof leadRoutingRules.$inferSelect;
export type InsertLeadRoutingRule = typeof leadRoutingRules.$inferInsert;

// ─────────────────────────────────────────────
// AI ADVISOR CHAT HISTORY
// Persists chat conversations per user+account so
// they survive page refreshes and session changes.
// ─────────────────────────────────────────────
export const aiAdvisorMessages = mysqlTable("ai_advisor_messages", {
  id: int("id").autoincrement().primaryKey(),
  accountId: int("accountId").notNull(),
  userId: int("userId").notNull(),
  role: mysqlEnum("role", ["user", "assistant"]).notNull(),
  content: text("content").notNull(),
  pageContext: varchar("pageContext", { length: 100 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type AiAdvisorMessage = typeof aiAdvisorMessages.$inferSelect;
export type InsertAiAdvisorMessage = typeof aiAdvisorMessages.$inferInsert;

// ─────────────────────────────────────────────
// FORMS — Drag-and-drop form builder
// Each form belongs to an account and has a unique slug
// for public access at /f/:slug
// ─────────────────────────────────────────────
export const forms = mysqlTable("forms", {
  id: int("id").autoincrement().primaryKey(),
  accountId: int("accountId").notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  slug: varchar("slug", { length: 100 }).notNull().unique(),
  /** JSON array of field definitions: [{id, type, label, required, placeholder, options}] */
  fields: json("fields").$type<FormField[]>().notNull(),
  /** JSON settings: {submitButtonText, successMessage, redirectUrl, headerText, description, styling} */
  settings: json("settings").$type<FormSettings>(),
  /** What happens on submit: create_contact, update_contact, notify_only */
  submitAction: mysqlEnum("submitAction", [
    "create_contact",
    "update_contact",
    "notify_only",
  ])
    .default("create_contact")
    .notNull(),
  isActive: boolean("isActive").default(true).notNull(),
  createdById: int("createdById").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type Form = typeof forms.$inferSelect;
export type InsertForm = typeof forms.$inferInsert;

/** Field definition for form builder */
/** Condition rule for conditional field visibility */
export interface ConditionRule {
  fieldId: string;
  operator: "equals" | "not_equals" | "contains" | "is_empty" | "is_not_empty";
  value?: string;
}

export interface FormField {
  id: string;
  type: "text" | "email" | "phone" | "dropdown" | "checkbox" | "date" | "file";
  label: string;
  required: boolean;
  placeholder?: string;
  /** For dropdown: array of option strings */
  options?: string[];
  /** Map to contact field for auto-population */
  contactFieldMapping?: string;
  /** Conditional visibility: field is shown only when ALL rules pass */
  conditionRules?: ConditionRule[];
  /** For file fields: accepted MIME types (e.g., "image/*,.pdf") */
  acceptedFileTypes?: string;
  /** For file fields: max file size in MB (default 10) */
  maxFileSizeMB?: number;
}

/** Form settings */
export interface FormSettings {
  submitButtonText?: string;
  successMessage?: string;
  redirectUrl?: string;
  headerText?: string;
  description?: string;
  styling?: {
    primaryColor?: string;
    backgroundColor?: string;
    fontFamily?: string;
  };
}

// ─────────────────────────────────────────────
// FORM SUBMISSIONS — Captured form data
// ─────────────────────────────────────────────
export const formSubmissions = mysqlTable("form_submissions", {
  id: int("id").autoincrement().primaryKey(),
  formId: int("formId").notNull(),
  accountId: int("accountId").notNull(),
  /** Contact created/matched from this submission (nullable if notify_only) */
  contactId: int("contactId"),
  /** Raw submitted data as JSON */
  data: json("data").$type<Record<string, unknown>>().notNull(),
  /** IP address of submitter */
  ipAddress: varchar("ipAddress", { length: 45 }),
  /** User agent string */
  userAgent: text("userAgent"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type FormSubmission = typeof formSubmissions.$inferSelect;
export type InsertFormSubmission = typeof formSubmissions.$inferInsert;

// ─────────────────────────────────────────────
// REVIEW REQUESTS — Outbound review solicitations
// ─────────────────────────────────────────────
export const reviewRequests = mysqlTable("review_requests", {
  id: int("id").autoincrement().primaryKey(),
  accountId: int("accountId").notNull(),
  contactId: int("contactId").notNull(),
  /** Platform the review was requested on */
  platform: mysqlEnum("platform", ["google", "facebook", "yelp", "zillow"]).notNull(),
  /** How the request was sent */
  channel: mysqlEnum("channel", ["sms", "email"]).default("sms").notNull(),
  /** Direct URL to the review page */
  reviewUrl: text("reviewUrl"),
  /** Current status of the request */
  status: mysqlEnum("status", ["pending", "sent", "clicked", "completed", "failed"]).default("pending").notNull(),
  sentAt: timestamp("sentAt"),
  clickedAt: timestamp("clickedAt"),
  completedAt: timestamp("completedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type ReviewRequest = typeof reviewRequests.$inferSelect;
export type InsertReviewRequest = typeof reviewRequests.$inferInsert;

// ─────────────────────────────────────────────
// REVIEWS — Collected reviews from external platforms
// ─────────────────────────────────────────────
export const reviews = mysqlTable("reviews", {
  id: int("id").autoincrement().primaryKey(),
  accountId: int("accountId").notNull(),
  /** Platform the review was posted on */
  platform: mysqlEnum("platform", ["google", "facebook", "yelp", "zillow"]).notNull(),
  /** Star rating (1-5) */
  rating: int("rating").notNull(),
  /** Review body text */
  body: text("body"),
  /** Name of the reviewer */
  reviewerName: varchar("reviewerName", { length: 255 }),
  /** URL to the reviewer's profile or the review itself */
  reviewUrl: text("reviewUrl"),
  /** External platform ID to prevent duplicates */
  externalId: varchar("externalId", { length: 255 }),
  /** When the review was originally posted */
  postedAt: timestamp("postedAt"),
  /** Optional link to a contact in the system */
  contactId: int("contactId"),
  /** AI-generated reply suggestion */
  suggestedReply: text("suggestedReply"),
  /** Whether a reply has been sent */
  replySent: boolean("replySent").default(false).notNull(),
  /** The actual reply body that was posted */
  replyBody: text("replyBody"),
  /** When the reply was posted */
  repliedAt: timestamp("repliedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type Review = typeof reviews.$inferSelect;
export type InsertReview = typeof reviews.$inferInsert;

// ─────────────────────────────────────────────
// GMB CONNECTIONS — Google My Business OAuth connections per account
// ─────────────────────────────────────────────
export const gmbConnections = mysqlTable("gmb_connections", {
  id: int("id").autoincrement().primaryKey(),
  accountId: int("account_id").notNull(),
  /** Google account email used for authentication */
  googleEmail: varchar("google_email", { length: 255 }).notNull(),
  /** OAuth2 access token (encrypted at rest) */
  accessToken: text("access_token").notNull(),
  /** OAuth2 refresh token (encrypted at rest) */
  refreshToken: text("refresh_token"),
  /** Token expiry timestamp */
  tokenExpiresAt: timestamp("token_expires_at"),
  /** Google Business Profile location ID */
  locationId: varchar("location_id", { length: 255 }),
  /** Human-readable location/business name */
  locationName: varchar("location_name", { length: 255 }),
  /** Google Place ID for review URL generation */
  placeId: varchar("place_id", { length: 255 }),
  /** Whether auto-sync is enabled */
  autoSyncEnabled: boolean("auto_sync_enabled").default(true).notNull(),
  /** Last time reviews were synced */
  lastSyncAt: timestamp("last_sync_at"),
  /** Connection status */
  status: mysqlEnum("status", ["active", "expired", "disconnected"]).default("active").notNull(),
  connectedAt: timestamp("connected_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});
export type GmbConnection = typeof gmbConnections.$inferSelect;
export type InsertGmbConnection = typeof gmbConnections.$inferInsert;

// ─────────────────────────────────────────────
// GMB REVIEWS — Synced Google Business Profile reviews
// ─────────────────────────────────────────────
export const gmbReviews = mysqlTable("gmb_reviews", {
  id: int("id").autoincrement().primaryKey(),
  accountId: int("account_id").notNull(),
  /** Google's unique review ID */
  reviewId: varchar("review_id", { length: 255 }).notNull(),
  /** Reviewer display name */
  reviewerName: varchar("reviewer_name", { length: 255 }),
  /** Reviewer profile photo URL */
  reviewerPhotoUrl: text("reviewer_photo_url"),
  /** Star rating */
  starRating: mysqlEnum("star_rating", ["ONE", "TWO", "THREE", "FOUR", "FIVE"]).notNull(),
  /** Review text body */
  comment: text("comment"),
  /** Owner's reply text */
  replyText: text("reply_text"),
  /** When the reply was last updated */
  replyUpdatedAt: timestamp("reply_updated_at"),
  /** When the review was originally published on Google */
  reviewPublishedAt: timestamp("review_published_at"),
  /** When we last synced this review */
  syncedAt: timestamp("synced_at").defaultNow(),
});
export type GmbReview = typeof gmbReviews.$inferSelect;
export type InsertGmbReview = typeof gmbReviews.$inferInsert;

// ─────────────────────────────────────────────
// REPUTATION ALERT SETTINGS — Per-account alert configuration
// ─────────────────────────────────────────────
export const reputationAlertSettings = mysqlTable("reputation_alert_settings", {
  id: int("id").autoincrement().primaryKey(),
  accountId: int("account_id").notNull().unique(),
  /** Enable/disable alerts */
  enabled: boolean("enabled").default(true).notNull(),
  /** Rating threshold (alert when rating <= this value) */
  ratingThreshold: int("rating_threshold").default(2).notNull(),
  /** Notification channels */
  notifyEmail: boolean("notify_email").default(true).notNull(),
  notifySms: boolean("notify_sms").default(false).notNull(),
  notifyInApp: boolean("notify_in_app").default(true).notNull(),
  /** Email recipients (comma-separated) */
  emailRecipients: text("email_recipients"),
  /** SMS recipients (comma-separated phone numbers) */
  smsRecipients: text("sms_recipients"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});
export type ReputationAlertSetting = typeof reputationAlertSettings.$inferSelect;
export type InsertReputationAlertSetting = typeof reputationAlertSettings.$inferInsert;

// ─────────────────────────────────────────────
// OUTBOUND WEBHOOKS — Zapier / Make / n8n integration
// Dispatches CRM events to external URLs with HMAC-SHA256 signatures
// ─────────────────────────────────────────────
export const outboundWebhooks = mysqlTable("outbound_webhooks", {
  id: int("id").autoincrement().primaryKey(),
  accountId: int("account_id").notNull(),
  /** Human-readable label for the webhook */
  name: varchar("name", { length: 255 }).notNull(),
  /** The CRM event that triggers this webhook */
  triggerEvent: mysqlEnum("trigger_event", [
    "contact_created",
    "contact_updated",
    "tag_added",
    "pipeline_stage_changed",
    "facebook_lead_received",
    "inbound_message_received",
    "appointment_booked",
    "appointment_cancelled",
    "call_completed",
    "missed_call",
    "form_submitted",
    "review_received",
    "workflow_completed",
    "score_changed",
  ]).notNull(),
  /** The destination URL to POST event payloads to */
  url: text("url").notNull(),
  /** HMAC-SHA256 signing secret (generated on creation, used to verify payloads) */
  secret: varchar("secret", { length: 128 }).notNull(),
  /** Whether this webhook is currently active */
  isActive: boolean("is_active").default(true).notNull(),
  /** Optional description */
  description: text("description"),
  /** Timestamp of last successful dispatch */
  lastTriggeredAt: timestamp("last_triggered_at"),
  /** Consecutive failure count (resets on success) */
  failCount: int("fail_count").default(0).notNull(),
  /** JSON array of conditions that must ALL pass before dispatching (AND logic) */
  conditions: json("conditions").$type<WebhookCondition[]>(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});

/** A single condition rule for webhook event filtering */
export interface WebhookCondition {
  field: string;   // e.g. "contact.source", "contact.tags", "deal.value"
  operator: "equals" | "not_equals" | "contains" | "not_contains" | "greater_than" | "less_than" | "in" | "not_in" | "is_empty" | "is_not_empty";
  value: string;   // stringified value (parsed at evaluation time)
}

export type OutboundWebhook = typeof outboundWebhooks.$inferSelect;
export type InsertOutboundWebhook = typeof outboundWebhooks.$inferInsert;

// ─────────────────────────────────────────────
// WEBHOOK DELIVERY LOGS — Track every outbound webhook dispatch attempt
// ─────────────────────────────────────────────
export const webhookDeliveryLogs = mysqlTable("webhook_delivery_logs", {
  id: int("id").autoincrement().primaryKey(),
  webhookId: int("webhook_id").notNull(),
  accountId: int("account_id").notNull(),
  /** The event that triggered this delivery */
  event: varchar("event", { length: 100 }).notNull(),
  /** The endpoint URL we POSTed to */
  requestUrl: text("request_url").notNull(),
  /** Request headers sent (JSON) */
  requestHeaders: json("request_headers"),
  /** Request body / payload sent (JSON) */
  requestBody: json("request_body"),
  /** HTTP response status code */
  responseStatus: int("response_status"),
  /** Truncated response body */
  responseBody: text("response_body"),
  /** Round-trip latency in milliseconds */
  latencyMs: int("latency_ms"),
  /** Whether the delivery was successful (2xx) */
  success: boolean("success").default(false).notNull(),
  /** Error message for network errors, timeouts, etc. */
  errorMessage: text("error_message"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
export type WebhookDeliveryLog = typeof webhookDeliveryLogs.$inferSelect;
export type InsertWebhookDeliveryLog = typeof webhookDeliveryLogs.$inferInsert;

// ─────────────────────────────────────────────
// API KEYS — For inbound webhook authentication
// External services use these to push data INTO Sterling Marketing
// ─────────────────────────────────────────────
export const apiKeys = mysqlTable("api_keys", {
  id: int("id").autoincrement().primaryKey(),
  accountId: int("account_id").notNull(),
  /** User-friendly label */
  name: varchar("name", { length: 255 }).notNull(),
  /** SHA-256 hash of the full API key (for lookup/verification) */
  keyHash: varchar("key_hash", { length: 128 }).notNull(),
  /** First 8 chars of the key for display (e.g. "ak_1a2b3c4d...") */
  keyPrefix: varchar("key_prefix", { length: 20 }).notNull(),
  /** JSON array of allowed actions, e.g. ["contacts:create","events:create"] */
  permissions: json("permissions").$type<string[]>().notNull(),
  lastUsedAt: timestamp("last_used_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  /** Null = active; set timestamp = revoked */
  revokedAt: timestamp("revoked_at"),
});
export type ApiKey = typeof apiKeys.$inferSelect;
export type InsertApiKey = typeof apiKeys.$inferInsert;

// ─────────────────────────────────────────────
// INBOUND REQUEST LOGS — Debug log for all inbound API requests
// ─────────────────────────────────────────────
export const inboundRequestLogs = mysqlTable("inbound_request_logs", {
  id: int("id").autoincrement().primaryKey(),
  accountId: int("account_id"),
  apiKeyId: int("api_key_id"),
  /** The endpoint path hit */
  endpoint: varchar("endpoint", { length: 255 }).notNull(),
  /** HTTP method */
  method: varchar("method", { length: 10 }).notNull(),
  /** Request body (JSON) */
  requestBody: json("request_body"),
  /** Response status code */
  responseStatus: int("response_status"),
  /** Whether the request was successful */
  success: boolean("success").default(false).notNull(),
  /** Error message if failed */
  errorMessage: text("error_message"),
  /** IP address of the requester */
  ipAddress: varchar("ip_address", { length: 45 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
export type InboundRequestLog = typeof inboundRequestLogs.$inferSelect;
export type InsertInboundRequestLog = typeof inboundRequestLogs.$inferInsert;


// ─────────────────────────────────────────────
// CUSTOM FIELD DEFINITIONS — schema-driven custom fields for contacts
// ─────────────────────────────────────────────
export const customFieldDefs = mysqlTable("custom_field_defs", {
  id: int("id").autoincrement().primaryKey(),
  /** Sub-account this field definition belongs to */
  accountId: int("account_id").notNull(),
  /** Human-readable label */
  name: varchar("name", { length: 100 }).notNull(),
  /** Machine-friendly slug (e.g. "loan_amount", "property_type") */
  slug: varchar("slug", { length: 100 }).notNull(),
  /** Field data type */
  type: mysqlEnum("type", [
    "text",
    "number",
    "date",
    "dropdown",
    "checkbox",
    "textarea",
    "url",
    "email",
    "phone",
  ]).notNull(),
  /** JSON array of options for dropdown type, e.g. ["Option A","Option B"] */
  options: text("options"),
  /** Whether this field is required when creating/updating contacts */
  required: boolean("required").default(false).notNull(),
  /** Display order in forms */
  sortOrder: int("sort_order").default(0).notNull(),
  /** Soft-disable without deleting */
  isActive: boolean("is_active").default(true).notNull(),
  /** JSON: visibility rules [{dependsOnSlug, operator, value}] — field is visible only when ALL rules pass */
  visibilityRules: text("visibility_rules"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});
export type CustomFieldDef = typeof customFieldDefs.$inferSelect;
export type InsertCustomFieldDef = typeof customFieldDefs.$inferInsert;

// ─── Custom Field Templates ─────────────────────────────────
export const customFieldTemplates = mysqlTable("custom_field_templates", {
  id: int("id").autoincrement().primaryKey(),
  /** Template name, e.g. "Mortgage LO", "Real Estate Agent" */
  name: varchar("name", { length: 200 }).notNull(),
  /** Short description of the template */
  description: text("description"),
  /** Industry category */
  industry: varchar("industry", { length: 100 }).notNull(),
  /** JSON array of field definitions: [{label, slug, type, options?, required, sortOrder}] */
  fields: text("fields").notNull(),
  /** true for built-in system templates, false for user-created */
  isSystem: boolean("is_system").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
export type CustomFieldTemplate = typeof customFieldTemplates.$inferSelect;
export type InsertCustomFieldTemplate = typeof customFieldTemplates.$inferInsert;

// ─── User Column Preferences ────────────────────────────────
export const userColumnPreferences = mysqlTable("user_column_preferences", {
  id: int("id").autoincrement().primaryKey(),
  /** User who owns this preference */
  userId: int("user_id").notNull(),
  /** Sub-account context */
  accountId: int("account_id").notNull(),
  /** Page identifier, e.g. "contacts" */
  page: varchar("page", { length: 50 }).notNull(),
  /** JSON array of column configs: [{key, visible, width?, sortOrder}] */
  columns: text("columns").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});
export type UserColumnPreference = typeof userColumnPreferences.$inferSelect;
export type InsertUserColumnPreference = typeof userColumnPreferences.$inferInsert;

// ─── Saved Views (Smart Views / Saved Filters) ───

export const savedViews = mysqlTable("saved_views", {
  id: int("id").autoincrement().primaryKey(),
  /** User who created this view */
  userId: int("user_id").notNull(),
  /** Sub-account this view belongs to */
  accountId: int("account_id").notNull(),
  /** Display name, e.g. "Hot FHA Leads" */
  name: varchar("name", { length: 100 }).notNull(),
  /** Optional icon identifier */
  icon: varchar("icon", { length: 50 }),
  /** JSON: { search, status, source, customFieldFilters: [{slug, operator, value}] } */
  filters: text("filters"),
  /** JSON: array of visible column keys (including cf_ prefixed) */
  columns: text("columns"),
  /** Sort field */
  sortBy: varchar("sort_by", { length: 100 }),
  /** Sort direction */
  sortDir: mysqlEnum("sort_dir", ["asc", "desc"]).default("desc"),
  /** Whether this is the default view for this user+account */
  isDefault: boolean("is_default").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});
export type SavedView = typeof savedViews.$inferSelect;
export type InsertSavedView = typeof savedViews.$inferInsert;

// ─────────────────────────────────────────────
// LEAD SCORING RULES — configurable scoring rules per account
// Each rule awards/deducts points when a specific event occurs,
// optionally filtered by a JSON condition.
// ─────────────────────────────────────────────
export const leadScoringRules = mysqlTable("lead_scoring_rules", {
  id: int("id").autoincrement().primaryKey(),
  /** Sub-account this rule belongs to */
  accountId: int("account_id").notNull(),
  /** Human-readable rule name */
  name: varchar("name", { length: 255 }).notNull(),
  /** The event that triggers this scoring rule */
  event: mysqlEnum("event", [
    "contact_created",
    "tag_added",
    "pipeline_stage_changed",
    "inbound_message_received",
    "appointment_booked",
    "appointment_cancelled",
    "call_completed",
    "missed_call",
    "form_submitted",
    "email_opened",
    "link_clicked",
    "facebook_lead_received",
  ]).notNull(),
  /** Points to add (positive) or subtract (negative) */
  delta: int("delta").notNull(),
  /** Optional JSON condition that must match for the rule to fire.
   *  e.g. { "field": "leadSource", "operator": "equals", "value": "Facebook" }
   *  or { "tag": "VIP" } for tag_added events */
  condition: json("condition").$type<LeadScoringCondition | null>(),
  /** Whether this rule is active */
  isActive: boolean("is_active").default(true).notNull(),
  /** Display order */
  sortOrder: int("sort_order").default(0).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});

/** Condition for lead scoring rule */
export interface LeadScoringCondition {
  field?: string;
  operator?: "equals" | "not_equals" | "contains" | "greater_than" | "less_than";
  value?: string;
  /** For tag_added events: only fire when this specific tag is added */
  tag?: string;
  /** For pipeline_stage_changed: only fire when moving to this status */
  toStatus?: string;
  /** For inbound_message_received: only fire for this channel */
  channel?: "sms" | "email";
}

export type LeadScoringRule = typeof leadScoringRules.$inferSelect;
export type InsertLeadScoringRule = typeof leadScoringRules.$inferInsert;

// ─────────────────────────────────────────────
// LEAD SCORE HISTORY — audit trail for score changes
// ─────────────────────────────────────────────
export const leadScoreHistory = mysqlTable("lead_score_history", {
  id: int("id").autoincrement().primaryKey(),
  contactId: int("contact_id").notNull(),
  accountId: int("account_id").notNull(),
  /** The rule that triggered this change (null for manual adjustments) */
  ruleId: int("rule_id"),
  /** The event that caused the score change */
  event: varchar("event", { length: 100 }).notNull(),
  /** Points added/subtracted */
  delta: int("delta").notNull(),
  /** Score before the change */
  scoreBefore: int("score_before").notNull(),
  /** Score after the change */
  scoreAfter: int("score_after").notNull(),
  /** Human-readable reason */
  reason: varchar("reason", { length: 500 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
export type LeadScoreHistoryEntry = typeof leadScoreHistory.$inferSelect;
export type InsertLeadScoreHistoryEntry = typeof leadScoreHistory.$inferInsert;

// ─────────────────────────────────────────────
// CONTACT SEGMENTS — account-level smart lists with dynamic filter configs
// ─────────────────────────────────────────────
export const contactSegments = mysqlTable("contact_segments", {
  id: int("id").autoincrement().primaryKey(),
  /** Sub-account this segment belongs to */
  accountId: int("account_id").notNull(),
  /** Display name, e.g. "Hot Leads", "New This Week" */
  name: varchar("name", { length: 150 }).notNull(),
  /** Optional description */
  description: varchar("description", { length: 500 }),
  /** Optional icon identifier (lucide icon name) */
  icon: varchar("icon", { length: 50 }),
  /** Optional color for the segment badge */
  color: varchar("color", { length: 30 }),
  /**
   * JSON filter configuration. Structure:
   * {
   *   status?: string,
   *   leadSource?: string,
   *   tags?: string[],             // contact must have ALL these tags
   *   tagsAny?: string[],          // contact must have ANY of these tags
   *   assignedUserId?: number,
   *   search?: string,
   *   scoreMin?: number,           // leadScore >= scoreMin
   *   scoreMax?: number,           // leadScore <= scoreMax
   *   createdAfter?: string,       // ISO date string
   *   createdBefore?: string,      // ISO date string
   *   hasEmail?: boolean,          // contact has non-null email
   *   hasPhone?: boolean,          // contact has non-null phone
   *   customFieldFilters?: Array<{ slug: string, operator: string, value?: string }>
   * }
   */
  filterConfig: text("filter_config").notNull(),
  /** Whether this is a system-generated preset (cannot be deleted by users) */
  isPreset: boolean("is_preset").default(false).notNull(),
  /** Cached contact count (updated periodically or on demand) */
  contactCount: int("contact_count").default(0).notNull(),
  /** Last time the contact count was refreshed */
  countRefreshedAt: timestamp("count_refreshed_at"),
  /** User who created this segment */
  createdById: int("created_by_id"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});
export type ContactSegment = typeof contactSegments.$inferSelect;
export type InsertContactSegment = typeof contactSegments.$inferInsert;


// ─────────────────────────────────────────────
// SEQUENCES — Email/SMS Drip Sequences
// ─────────────────────────────────────────────
export const sequences = mysqlTable("sequences", {
  id: int("id").autoincrement().primaryKey(),
  accountId: int("account_id").notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  /** active | paused | draft | archived */
  status: mysqlEnum("status", ["active", "paused", "draft", "archived"]).default("draft").notNull(),
  /** Total number of steps in this sequence (denormalized for quick display) */
  stepCount: int("step_count").default(0).notNull(),
  /** Total number of currently active enrollments */
  activeEnrollments: int("active_enrollments").default(0).notNull(),
  /** Total number of contacts that completed the full sequence */
  completedCount: int("completed_count").default(0).notNull(),
  createdById: int("created_by_id"),
  /** Scheduled activation time — when set, the sequence will auto-activate at this time */
  activateAt: timestamp("activate_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});
export type Sequence = typeof sequences.$inferSelect;
export type InsertSequence = typeof sequences.$inferInsert;

// ─────────────────────────────────────────────
// SEQUENCE STEPS — Individual drip steps
// ─────────────────────────────────────────────
export const sequenceSteps = mysqlTable("sequence_steps", {
  id: int("id").autoincrement().primaryKey(),
  sequenceId: int("sequence_id").notNull(),
  /** 1-based position within the sequence */
  position: int("position").notNull(),
  /** Delay before this step fires (from previous step or enrollment) */
  delayDays: int("delay_days").default(0).notNull(),
  delayHours: int("delay_hours").default(0).notNull(),
  /** sms | email */
  messageType: mysqlEnum("message_type", ["sms", "email"]).notNull(),
  /** Email subject line (null for SMS) */
  subject: varchar("subject", { length: 500 }),
  /** Message body — supports {{firstName}}, {{lastName}}, etc. merge tags */
  content: text("content").notNull(),
  /** Optional reference to an email template */
  templateId: int("template_id"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});
export type SequenceStep = typeof sequenceSteps.$inferSelect;
export type InsertSequenceStep = typeof sequenceSteps.$inferInsert;

// ─────────────────────────────────────────────
// SEQUENCE ENROLLMENTS — Contact enrollment tracking
// ─────────────────────────────────────────────
export const sequenceEnrollments = mysqlTable("sequence_enrollments", {
  id: int("id").autoincrement().primaryKey(),
  sequenceId: int("sequence_id").notNull(),
  contactId: int("contact_id").notNull(),
  accountId: int("account_id").notNull(),
  /** Current step position (0 = enrolled but hasn't started, 1+ = on that step) */
  currentStep: int("current_step").default(0).notNull(),
  /** active | completed | paused | failed | unenrolled */
  status: mysqlEnum("status", ["active", "completed", "paused", "failed", "unenrolled"]).default("active").notNull(),
  /** When the next step should fire */
  nextStepAt: timestamp("next_step_at"),
  /** Last step that was successfully executed */
  lastStepAt: timestamp("last_step_at"),
  enrolledAt: timestamp("enrolled_at").defaultNow().notNull(),
  completedAt: timestamp("completed_at"),
  /** Source of enrollment: manual | workflow | campaign | api */
  enrollmentSource: varchar("enrollment_source", { length: 50 }).default("manual"),
  /** Optional reference to the workflow/campaign that enrolled this contact */
  sourceId: int("source_id"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});
export type SequenceEnrollment = typeof sequenceEnrollments.$inferSelect;
export type InsertSequenceEnrollment = typeof sequenceEnrollments.$inferInsert;

// ─────────────────────────────────────────────
// EMAIL WARMING — Per-account daily send limits with gradual ramp-up
// ─────────────────────────────────────────────
export const emailWarmingConfig = mysqlTable("email_warming_config", {
  id: int("id").autoincrement().primaryKey(),
  accountId: int("account_id").notNull(),
  /** Whether warming mode is active */
  enabled: boolean("enabled").default(true).notNull(),
  /** Starting daily email limit */
  startDailyLimit: int("start_daily_limit").default(5).notNull(),
  /** Maximum daily email limit (target after warming completes) */
  maxDailyLimit: int("max_daily_limit").default(200).notNull(),
  /** How many additional emails to allow per day during ramp-up */
  rampUpPerDay: int("ramp_up_per_day").default(5).notNull(),
  /** Current calculated daily limit (updated daily by the warming engine) */
  currentDailyLimit: int("current_daily_limit").default(5).notNull(),
  /** When warming started */
  warmingStartDate: timestamp("warming_start_date").defaultNow().notNull(),
  /** Today's send count (reset daily) */
  todaySendCount: int("today_send_count").default(0).notNull(),
  /** Date of the last send count reset (to detect day rollover) */
  lastResetDate: date("last_reset_date"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});
export type EmailWarmingConfig = typeof emailWarmingConfig.$inferSelect;
export type InsertEmailWarmingConfig = typeof emailWarmingConfig.$inferInsert;


// ─────────────────────────────────────────────
// LANDING PAGES — Drag-and-drop page builder
// ─────────────────────────────────────────────
export const landingPages = mysqlTable("landing_pages", {
  id: int("id").autoincrement().primaryKey(),
  accountId: int("account_id").notNull(),
  /** URL-friendly slug for public access: /p/:accountSlug/:pageSlug */
  slug: varchar("slug", { length: 200 }).notNull(),
  title: varchar("title", { length: 500 }).notNull(),
  /** Optional meta description for SEO */
  metaDescription: text("meta_description"),
  /** The rendered HTML content of the page */
  htmlContent: text("html_content"),
  /** CSS styles for the page */
  cssContent: text("css_content"),
  /** GrapesJS project data (JSON) — components + styles for the editor */
  gjsData: json("gjs_data"),
  /** draft | published | archived */
  status: mysqlEnum("status", ["draft", "published", "archived"]).default("draft").notNull(),
  /** When the page was first published */
  publishedAt: timestamp("published_at"),
  /** Optional custom favicon URL */
  faviconUrl: varchar("favicon_url", { length: 1000 }),
  /** Optional custom header/footer code injection */
  headerCode: text("header_code"),
  footerCode: text("footer_code"),
  /** Page visit count */
  viewCount: int("view_count").default(0).notNull(),
  /** Form submission count (for pages with embedded forms) */
  submissionCount: int("submission_count").default(0).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});
export type LandingPage = typeof landingPages.$inferSelect;
export type InsertLandingPage = typeof landingPages.$inferInsert;

// ─────────────────────────────────────────────
// FUNNELS — Multi-step page sequences
// ─────────────────────────────────────────────
export const funnels = mysqlTable("funnels", {
  id: int("id").autoincrement().primaryKey(),
  accountId: int("account_id").notNull(),
  name: varchar("name", { length: 500 }).notNull(),
  description: text("description"),
  /**
   * JSON array of funnel steps:
   * [{ pageId: number, label: string, order: number }]
   */
  steps: json("steps"),
  /** draft | active | archived */
  status: mysqlEnum("status", ["draft", "active", "archived"]).default("draft").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});
export type Funnel = typeof funnels.$inferSelect;
export type InsertFunnel = typeof funnels.$inferInsert;


// ─────────────────────────────────────────────
// CHAT WIDGETS — Embeddable webchat widget configuration
// Each widget belongs to a sub-account and can be embedded
// on external websites via a <script> tag.
// ─────────────────────────────────────────────
export const chatWidgets = mysqlTable("chat_widgets", {
  id: int("id").autoincrement().primaryKey(),
  /** Sub-account this widget belongs to */
  accountId: int("account_id").notNull(),
  /** Human-readable widget name */
  name: varchar("name", { length: 255 }).notNull(),
  /** Public unique identifier used in embed snippet */
  widgetKey: varchar("widget_key", { length: 64 }).notNull().unique(),
  /** Greeting message shown when chat opens */
  greeting: text("greeting"),
  /** Whether AI auto-responses are enabled */
  aiEnabled: boolean("ai_enabled").default(true).notNull(),
  /** Optional system prompt for the AI assistant */
  aiSystemPrompt: text("ai_system_prompt"),
  /** Comma-separated keywords that trigger human handoff (e.g. "agent,human,help,speak to someone") */
  handoffKeywords: text("handoff_keywords"),
  /** Brand color for the widget bubble (hex) */
  brandColor: varchar("brand_color", { length: 20 }).default("#6366f1").notNull(),
  /** Widget position on the page */
  position: mysqlEnum("position", ["bottom-right", "bottom-left"]).default("bottom-right").notNull(),
  /** Allowed domains (comma-separated). Empty = allow all */
  allowedDomains: text("allowed_domains"),
  /** Whether to collect visitor info (name, email) before chat */
  collectVisitorInfo: boolean("collect_visitor_info").default(true).notNull(),
  /** Whether the widget is active */
  isActive: boolean("is_active").default(true).notNull(),
  /** User who created the widget */
  createdById: int("created_by_id").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});
export type ChatWidget = typeof chatWidgets.$inferSelect;
export type InsertChatWidget = typeof chatWidgets.$inferInsert;

// ─────────────────────────────────────────────
// WEBCHAT SESSIONS — Tracks individual chat sessions from visitors
// ─────────────────────────────────────────────
export const webchatSessions = mysqlTable("webchat_sessions", {
  id: int("id").autoincrement().primaryKey(),
  /** The widget this session belongs to */
  widgetId: int("widget_id").notNull(),
  /** Sub-account (denormalized for fast queries) */
  accountId: int("account_id").notNull(),
  /** Unique session ID generated client-side (stored in localStorage) */
  sessionKey: varchar("session_key", { length: 64 }).notNull().unique(),
  /** Linked contact (created after visitor provides info or matched by email) */
  contactId: int("contact_id"),
  /** Visitor name (if collected) */
  visitorName: varchar("visitor_name", { length: 255 }),
  /** Visitor email (if collected) */
  visitorEmail: varchar("visitor_email", { length: 320 }),
  /** Whether human handoff has been requested */
  handoffRequested: boolean("handoff_requested").default(false).notNull(),
  /** Whether a human agent has taken over this conversation */
  agentTakenOver: boolean("agent_taken_over").default(false).notNull(),
  /** User ID of the agent who took over (null if AI-only) */
  agentUserId: int("agent_user_id"),
  /** Session status */
  status: mysqlEnum("status", ["active", "closed"]).default("active").notNull(),
  /** Page URL where the chat was initiated */
  pageUrl: text("page_url"),
  /** IP address of the visitor */
  ipAddress: varchar("ip_address", { length: 45 }),
  /** User agent string */
  userAgent: text("user_agent"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});
export type WebchatSession = typeof webchatSessions.$inferSelect;
export type InsertWebchatSession = typeof webchatSessions.$inferInsert;

// ─────────────────────────────────────────────
// WEBCHAT MESSAGES — Individual messages within a webchat session
// ─────────────────────────────────────────────
export const webchatMessages = mysqlTable("webchat_messages", {
  id: int("id").autoincrement().primaryKey(),
  /** The session this message belongs to */
  sessionId: int("session_id").notNull(),
  /** Sub-account (denormalized for fast queries) */
  accountId: int("account_id").notNull(),
  /** Who sent the message */
  sender: mysqlEnum("sender", ["visitor", "ai", "agent"]).notNull(),
  /** Message content */
  content: text("content").notNull(),
  /** Whether this message has been read by an agent */
  isRead: boolean("is_read").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
export type WebchatMessage = typeof webchatMessages.$inferSelect;
export type InsertWebchatMessage = typeof webchatMessages.$inferInsert;

// ─────────────────────────────────────────────
// PRODUCTS — Reusable line items for invoices
// ─────────────────────────────────────────────
export const products = mysqlTable("products", {
  id: int("id").autoincrement().primaryKey(),
  accountId: int("account_id").notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  /** Price in cents (e.g. 5000 = $50.00) */
  price: int("price").notNull(),
  type: mysqlEnum("type", ["one_time", "recurring"]).default("one_time").notNull(),
  description: text("description"),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});
export type Product = typeof products.$inferSelect;
export type InsertProduct = typeof products.$inferInsert;

// ─────────────────────────────────────────────
// INVOICES — Payment collection for contacts
// ─────────────────────────────────────────────
export const invoices = mysqlTable("invoices", {
  id: int("id").autoincrement().primaryKey(),
  accountId: int("account_id").notNull(),
  contactId: int("contact_id").notNull(),
  /** Auto-generated unique per account, e.g. "INV-0001" */
  invoiceNumber: varchar("invoice_number", { length: 20 }).notNull(),
  status: mysqlEnum("status", [
    "draft",
    "sent",
    "paid",
    "partially_paid",
    "overdue",
    "cancelled",
  ]).default("draft").notNull(),
  issueDate: timestamp("issue_date").defaultNow().notNull(),
  dueDate: timestamp("due_date"),
  /** All monetary values in cents */
  subtotal: int("subtotal").default(0).notNull(),
  taxRate: decimal("tax_rate", { precision: 5, scale: 2 }),
  taxAmount: int("tax_amount").default(0).notNull(),
  total: int("total").default(0).notNull(),
  amountPaid: int("amount_paid").default(0).notNull(),
  balanceDue: int("balance_due").default(0).notNull(),
  currency: varchar("currency", { length: 3 }).default("USD").notNull(),
  notes: text("notes"),
  /** Square integration fields */
  squarePaymentId: varchar("square_payment_id", { length: 255 }),
  squarePaymentLink: text("square_payment_link"),
  squareOrderId: varchar("square_order_id", { length: 255 }),
  sentAt: timestamp("sent_at"),
  paidAt: timestamp("paid_at"),
  /** Who created this invoice */
  createdById: int("created_by_id"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});
export type Invoice = typeof invoices.$inferSelect;
export type InsertInvoice = typeof invoices.$inferInsert;

// ─────────────────────────────────────────────
// INVOICE ITEMS — Line items on an invoice
// ─────────────────────────────────────────────
export const invoiceItems = mysqlTable("invoice_items", {
  id: int("id").autoincrement().primaryKey(),
  invoiceId: int("invoice_id").notNull(),
  description: varchar("description", { length: 500 }).notNull(),
  /** Quantity as decimal (e.g. 1.5 hours) */
  quantity: decimal("quantity", { precision: 10, scale: 2 }).default("1").notNull(),
  /** Unit price in cents */
  unitPrice: int("unit_price").notNull(),
  /** Computed: quantity * unitPrice (in cents) */
  amount: int("amount").notNull(),
  sortOrder: int("sort_order").default(0).notNull(),
});
export type InvoiceItem = typeof invoiceItems.$inferSelect;
export type InsertInvoiceItem = typeof invoiceItems.$inferInsert;


// ─────────────────────────────────────────────
// SCHEDULED REPORTS — Automated analytics email delivery
// ─────────────────────────────────────────────
export const scheduledReports = mysqlTable("scheduled_reports", {
  id: int("id").autoincrement().primaryKey(),
  accountId: int("account_id").notNull(),
  /** Display name for this report schedule */
  name: varchar("name", { length: 255 }).notNull(),
  /** Frequency: daily | weekly | monthly */
  frequency: mysqlEnum("frequency", ["daily", "weekly", "monthly"]).default("weekly").notNull(),
  /** Day of week for weekly reports (0=Sun, 1=Mon, ..., 6=Sat) */
  dayOfWeek: int("day_of_week").default(1),
  /** Day of month for monthly reports (1-28) */
  dayOfMonth: int("day_of_month").default(1),
  /** Hour to send (0-23, in account timezone) */
  sendHour: int("send_hour").default(8).notNull(),
  /** Timezone for scheduling (IANA format, e.g. "America/New_York") */
  timezone: varchar("timezone", { length: 100 }).default("America/New_York").notNull(),
  /**
   * JSON array of report types to include:
   * ["kpis", "campaignROI", "workflowPerformance", "revenueAttribution"]
   */
  reportTypes: json("report_types").$type<string[]>().notNull(),
  /**
   * JSON array of recipient email addresses
   */
  recipients: json("recipients").$type<string[]>().notNull(),
  /** Number of days for the analytics period (e.g. 7, 30, 90) */
  periodDays: int("period_days").default(30).notNull(),
  /** Whether this schedule is active */
  isActive: boolean("is_active").default(true).notNull(),
  /** When the next report should be sent */
  nextRunAt: timestamp("next_run_at"),
  /** When the last report was successfully sent */
  lastRunAt: timestamp("last_run_at"),
  /** Result of the last run: success | failed | null */
  lastRunStatus: varchar("last_run_status", { length: 50 }),
  /** Error message from last failed run */
  lastRunError: text("last_run_error"),
  /** Who created this schedule */
  createdById: int("created_by_id"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});
export type ScheduledReport = typeof scheduledReports.$inferSelect;
export type InsertScheduledReport = typeof scheduledReports.$inferInsert;


// ─────────────────────────────────────────────
// SMS OPT-OUTS — Tracks STOP/unsubscribe events per phone
// ─────────────────────────────────────────────
export const smsOptOuts = mysqlTable("sms_opt_outs", {
  id: int("id").autoincrement().primaryKey(),
  accountId: int("account_id").notNull(),
  /** Linked contact (if resolved) */
  contactId: int("contact_id"),
  /** Phone number in E.164 format */
  phone: varchar("phone", { length: 30 }).notNull(),
  /** The keyword that triggered the opt-out (STOP, CANCEL, etc.) */
  keyword: varchar("keyword", { length: 50 }).notNull(),
  /** Source of the opt-out event */
  source: mysqlEnum("source", ["inbound_sms", "manual", "import", "api"]).default("inbound_sms").notNull(),
  /** Whether this opt-out is currently active (false = re-opted-in via START/UNSTOP) */
  isActive: boolean("is_active").default(true).notNull(),
  /** When the contact opted back in (null if still opted out) */
  optedInAt: timestamp("opted_in_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
export type SmsOptOut = typeof smsOptOuts.$inferSelect;
export type InsertSmsOptOut = typeof smsOptOuts.$inferInsert;

// ─────────────────────────────────────────────
// SMS COMPLIANCE LOGS — Audit trail for all compliance events
// ─────────────────────────────────────────────
export const smsComplianceLogs = mysqlTable("sms_compliance_logs", {
  id: int("id").autoincrement().primaryKey(),
  accountId: int("account_id").notNull(),
  contactId: int("contact_id"),
  phone: varchar("phone", { length: 30 }).notNull(),
  /** Event type */
  eventType: mysqlEnum("event_type", [
    "opt_out",
    "opt_in",
    "help_request",
    "dnd_set",
    "dnd_cleared",
    "message_blocked",
    "auto_reply_sent",
    "manual_opt_out",
    "manual_opt_in",
  ]).notNull(),
  /** The keyword or action that triggered this event */
  keyword: varchar("keyword", { length: 50 }),
  /** Human-readable description */
  description: text("description"),
  /** Additional metadata (JSON) */
  metadata: text("metadata"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
export type SmsComplianceLog = typeof smsComplianceLogs.$inferSelect;
export type InsertSmsComplianceLog = typeof smsComplianceLogs.$inferInsert;


// ─────────────────────────────────────────────
// QUEUED MESSAGES — Holds outbound messages when outside business hours
// Auto-dispatched when business hours resume
// ─────────────────────────────────────────────
export const queuedMessages = mysqlTable("queued_messages", {
  id: int("id").autoincrement().primaryKey(),
  /** The sub-account this message belongs to */
  accountId: int("account_id").notNull(),
  /** Optional contact this message is for */
  contactId: int("contact_id"),
  /** Message type: sms, email, ai_call */
  type: mysqlEnum("type", ["sms", "email", "ai_call"]).notNull(),
  /** Queue status */
  status: mysqlEnum("status", ["pending", "dispatched", "failed", "cancelled"])
    .default("pending")
    .notNull(),
  /** Full payload needed to dispatch (JSON) — includes to, body, subject, etc. */
  payload: text("payload").notNull(),
  /** Number of dispatch attempts so far */
  attempts: int("attempts").default(0).notNull(),
  /** Max number of dispatch attempts before marking as failed */
  maxAttempts: int("max_attempts").default(3).notNull(),
  /** Error message from last failed dispatch attempt */
  lastError: text("last_error"),
  /** When the message was originally requested */
  createdAt: timestamp("created_at").defaultNow().notNull(),
  /** When the message was actually dispatched (null if still pending) */
  dispatchedAt: timestamp("dispatched_at"),
  /** When the next dispatch attempt should happen (null = ASAP when business hours open) */
  nextAttemptAt: timestamp("next_attempt_at"),
  /** Who or what created this queued message */
  source: varchar("source", { length: 100 }).default("business_hours_queue"),
  /** Optional: user who initiated the original action */
  initiatedById: int("initiated_by_id"),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});

export type QueuedMessage = typeof queuedMessages.$inferSelect;
export type InsertQueuedMessage = typeof queuedMessages.$inferInsert;

// ═══════════════════════════════════════════════
// PUSH SUBSCRIPTIONS TABLE
// ═══════════════════════════════════════════════
export const pushSubscriptions = mysqlTable("push_subscriptions", {
  id: int("id").primaryKey().autoincrement(),
  userId: int("user_id").notNull(),
  accountId: int("account_id").notNull(),
  /** The push subscription endpoint URL */
  endpoint: text("endpoint").notNull(),
  /** The p256dh key from the subscription */
  p256dh: text("p256dh").notNull(),
  /** The auth key from the subscription */
  auth: text("auth").notNull(),
  /** User agent string for identifying the device */
  userAgent: varchar("user_agent", { length: 500 }),
  /**
   * JSON: per-event-type notification preferences.
   * Shape: { inbound_sms: boolean, inbound_email: boolean, appointment_booked: boolean,
   *          ai_call_completed: boolean, facebook_lead: boolean, quiet_hours_enabled: boolean,
   *          quiet_hours_start: string ("22:00"), quiet_hours_end: string ("07:00"),
   *          quiet_hours_timezone: string ("America/New_York") }
   * null = all enabled (default)
   */
  notificationPreferences: text("notification_preferences"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});

export type PushSubscription = typeof pushSubscriptions.$inferSelect;
export type InsertPushSubscription = typeof pushSubscriptions.$inferInsert;

// ═══════════════════════════════════════════════
// PUSH NOTIFICATION BATCH TABLE
// Groups rapid-fire events into single notifications
// ═══════════════════════════════════════════════
export const pushNotificationBatch = mysqlTable("push_notification_batch", {
  id: int("id").primaryKey().autoincrement(),
  /** Account receiving the notifications */
  accountId: int("account_id").notNull(),
  /** Event type for grouping: inbound_sms, inbound_email, appointment_booked, ai_call_completed, facebook_lead */
  eventType: varchar("event_type", { length: 50 }).notNull(),
  /** Number of events in this batch */
  eventCount: int("event_count").default(1).notNull(),
  /** JSON array of individual event payloads for context */
  eventPayloads: text("event_payloads"),
  /** pending = accumulating, sent = flushed, expired = TTL exceeded */
  status: mysqlEnum("status", ["pending", "sent", "expired"]).default("pending").notNull(),
  /** When this batch window opened */
  windowStart: timestamp("window_start").defaultNow().notNull(),
  /** When this batch should be flushed (windowStart + batchWindowMs) */
  flushAt: timestamp("flush_at").notNull(),
  /** When the batch was actually sent */
  sentAt: timestamp("sent_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type PushNotificationBatch = typeof pushNotificationBatch.$inferSelect;
export type InsertPushNotificationBatch = typeof pushNotificationBatch.$inferInsert;

// ═══════════════════════════════════════════════
// JARVIS AI SESSIONS — conversation history
// ═══════════════════════════════════════════════
export const jarvisSessions = mysqlTable("jarvis_sessions", {
  id: int("id").primaryKey().autoincrement(),
  accountId: int("account_id").notNull(),
  userId: int("user_id").notNull(),
  title: varchar("title", { length: 255 }).default("New conversation").notNull(),
  /** JSON-serialized array of JarvisMessage objects */
  messages: text("messages").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});
export type JarvisSessionRow = typeof jarvisSessions.$inferSelect;
export type InsertJarvisSession = typeof jarvisSessions.$inferInsert;

// ─────────────────────────────────────────────
// JARVIS TOOL USAGE — Track tool usage per account
// ─────────────────────────────────────────────
export const jarvisToolUsage = mysqlTable("jarvis_tool_usage", {
  id: int("id").primaryKey().autoincrement(),
  accountId: int("account_id").notNull(),
  toolName: varchar("tool_name", { length: 100 }).notNull(),
  usageCount: int("usage_count").default(0).notNull(),
  lastUsedAt: timestamp("last_used_at").defaultNow().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
export type JarvisToolUsageRow = typeof jarvisToolUsage.$inferSelect;

// ─────────────────────────────────────────────
// JARVIS SCHEDULED TASKS — Recurring tasks configured by Jarvis
// ─────────────────────────────────────────────
export const jarvisScheduledTasks = mysqlTable("jarvis_scheduled_tasks", {
  id: int("id").primaryKey().autoincrement(),
  accountId: int("account_id").notNull(),
  userId: int("user_id").notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  prompt: text("prompt").notNull(),
  scheduleDescription: varchar("schedule_description", { length: 255 }).notNull(),
  cronExpression: varchar("cron_expression", { length: 100 }).notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  lastRunAt: timestamp("last_run_at"),
  nextRunAt: timestamp("next_run_at"),
  lastRunResult: text("last_run_result"),
  runCount: int("run_count").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});
export type JarvisScheduledTaskRow = typeof jarvisScheduledTasks.$inferSelect;
export type InsertJarvisScheduledTask = typeof jarvisScheduledTasks.$inferInsert;

// ─────────────────────────────────────────────
// GEMINI USAGE LOGS — Track API token usage and costs
// ─────────────────────────────────────────────
export const geminiUsageLogs = mysqlTable("gemini_usage_logs", {
  id: int("id").primaryKey().autoincrement(),
  accountId: int("account_id"),
  userId: int("user_id"),
  /** Which endpoint triggered this call: 'chat', 'recommendations', 'chat_stream' */
  endpoint: varchar("endpoint", { length: 100 }).notNull(),
  model: varchar("model", { length: 100 }).notNull().default("gemini-2.5-flash"),
  promptTokens: int("prompt_tokens").notNull().default(0),
  completionTokens: int("completion_tokens").notNull().default(0),
  totalTokens: int("total_tokens").notNull().default(0),
  /** Estimated cost in USD (Gemini 2.5 Flash: $0.15/1M input, $0.60/1M output) */
  estimatedCostUsd: decimal("estimated_cost_usd", { precision: 10, scale: 6 }).notNull().default("0"),
  /** Whether the call succeeded or failed */
  success: boolean("success").notNull().default(true),
  /** Error message if failed */
  errorMessage: text("error_message"),
  /** Duration in milliseconds */
  durationMs: int("duration_ms"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
export type GeminiUsageLog = typeof geminiUsageLogs.$inferSelect;
export type InsertGeminiUsageLog = typeof geminiUsageLogs.$inferInsert;

// ═══════════════════════════════════════════════
// BILLING — Usage-based billing system
// ═══════════════════════════════════════════════

// Agency-configurable pricing per unit type
export const billingRates = mysqlTable("billing_rates", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 100 }).notNull(),
  isDefault: boolean("is_default").default(false).notNull(),
  smsCostPerUnit: decimal("sms_cost_per_unit", { precision: 10, scale: 6 }).notNull().default("0.015000"),
  emailCostPerUnit: decimal("email_cost_per_unit", { precision: 10, scale: 6 }).notNull().default("0.003000"),
  aiCallCostPerMinute: decimal("ai_call_cost_per_minute", { precision: 10, scale: 6 }).notNull().default("0.150000"),
  voiceCallCostPerMinute: decimal("voice_call_cost_per_minute", { precision: 10, scale: 6 }).notNull().default("0.050000"),
  llmCostPerRequest: decimal("llm_cost_per_request", { precision: 10, scale: 6 }).notNull().default("0.020000"),
  powerDialerCostPerCall: decimal("power_dialer_cost_per_call", { precision: 10, scale: 6 }).notNull().default("0.030000"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
export type BillingRate = typeof billingRates.$inferSelect;
export type InsertBillingRate = typeof billingRates.$inferInsert;

// Per-account billing configuration
export const accountBilling = mysqlTable("account_billing", {
  id: int("id").autoincrement().primaryKey(),
  accountId: int("account_id").notNull().unique(),
  billingRateId: int("billing_rate_id").notNull(),
  currentBalance: decimal("current_balance", { precision: 10, scale: 4 }).notNull().default("0.0000"),
  squareCustomerId: varchar("square_customer_id", { length: 255 }),
  autoInvoiceThreshold: decimal("auto_invoice_threshold", { precision: 10, scale: 4 }).notNull().default("50.0000"),
  billingEmail: varchar("billing_email", { length: 255 }),

  // Per-service markup multipliers (1.00 = no markup, 1.10 = 10% markup)
  smsMarkup: decimal("sms_markup", { precision: 5, scale: 3 }).notNull().default("1.100"),
  emailMarkup: decimal("email_markup", { precision: 5, scale: 3 }).notNull().default("1.100"),
  aiCallMarkup: decimal("ai_call_markup", { precision: 5, scale: 3 }).notNull().default("1.100"),
  voiceCallMarkup: decimal("voice_call_markup", { precision: 5, scale: 3 }).notNull().default("1.100"),
  llmMarkup: decimal("llm_markup", { precision: 5, scale: 3 }).notNull().default("1.100"),
  dialerMarkup: decimal("dialer_markup", { precision: 5, scale: 3 }).notNull().default("1.100"),

  // Per-service rebilling toggles
  smsRebillingEnabled: boolean("sms_rebilling_enabled").notNull().default(true),
  emailRebillingEnabled: boolean("email_rebilling_enabled").notNull().default(true),
  aiCallRebillingEnabled: boolean("ai_call_rebilling_enabled").notNull().default(true),
  voiceCallRebillingEnabled: boolean("voice_call_rebilling_enabled").notNull().default(true),
  llmRebillingEnabled: boolean("llm_rebilling_enabled").notNull().default(true),
  dialerRebillingEnabled: boolean("dialer_rebilling_enabled").notNull().default(true),

  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});
export type AccountBillingRow = typeof accountBilling.$inferSelect;
export type InsertAccountBilling = typeof accountBilling.$inferInsert;

// Tracks every billable action
export const usageEvents = mysqlTable("usage_events", {
  id: int("id").autoincrement().primaryKey(),
  accountId: int("account_id").notNull(),
  userId: int("user_id"),
  eventType: mysqlEnum("event_type", [
    "sms_sent",
    "email_sent",
    "ai_call_minute",
    "voice_call_minute",
    "llm_request",
    "power_dialer_call",
  ]).notNull(),
  quantity: decimal("quantity", { precision: 10, scale: 4 }).notNull(),
  unitCost: decimal("unit_cost", { precision: 10, scale: 6 }).notNull(),
  totalCost: decimal("total_cost", { precision: 10, scale: 4 }).notNull(),
  /** JSON metadata — contactId, messageId, callId, etc. */
  metadata: text("metadata"),
  /** Whether this event has been included in an invoice */
  invoiced: boolean("invoiced").default(false).notNull(),
  invoiceId: int("invoice_id"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
export type UsageEvent = typeof usageEvents.$inferSelect;
export type InsertUsageEvent = typeof usageEvents.$inferInsert;

// Billing invoices sent to sub-accounts for platform usage
export const billingInvoices = mysqlTable("billing_invoices", {
  id: int("id").autoincrement().primaryKey(),
  accountId: int("account_id").notNull(),
  invoiceNumber: varchar("invoice_number", { length: 30 }),
  amount: decimal("amount", { precision: 10, scale: 4 }).notNull(),
  status: mysqlEnum("status", ["draft", "sent", "paid", "overdue", "void"]).default("draft").notNull(),
  squarePaymentLinkId: varchar("square_payment_link_id", { length: 255 }),
  squarePaymentLinkUrl: varchar("square_payment_link_url", { length: 1000 }),
  squarePaymentId: varchar("square_payment_id", { length: 255 }),
  squareInvoiceId: varchar("square_invoice_id", { length: 255 }),
  /** JSON array of { description, quantity, unitCost, total } */
  lineItems: text("line_items"),
  periodStart: timestamp("period_start"),
  periodEnd: timestamp("period_end"),
  dueDate: timestamp("due_date"),
  paidAt: timestamp("paid_at"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
export type BillingInvoice = typeof billingInvoices.$inferSelect;
export type InsertBillingInvoice = typeof billingInvoices.$inferInsert;


// ─── Payment Methods (cards on file) ───
export const paymentMethods = mysqlTable("payment_methods", {
  id: int("id").autoincrement().primaryKey(),
  accountId: int("account_id").notNull(),
  squareCardId: varchar("square_card_id", { length: 255 }).notNull(),
  brand: varchar("brand", { length: 50 }).notNull(),
  last4: varchar("last4", { length: 4 }).notNull(),
  expMonth: int("exp_month").notNull(),
  expYear: int("exp_year").notNull(),
  cardholderName: varchar("cardholder_name", { length: 255 }),
  isDefault: boolean("is_default").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
export type PaymentMethod = typeof paymentMethods.$inferSelect;
export type InsertPaymentMethod = typeof paymentMethods.$inferInsert;

// ─────────────────────────────────────────────
// SOCIAL MEDIA — Content Generation & Scheduling
// ─────────────────────────────────────────────

export const socialPosts = mysqlTable("social_posts", {
  id: int("id").autoincrement().primaryKey(),
  accountId: int("account_id").notNull(),
  createdByUserId: int("created_by_user_id").notNull(),
  platform: mysqlEnum("platform", ["facebook", "instagram", "linkedin", "twitter"]).notNull(),
  content: text("content").notNull(),
  hashtags: text("hashtags"), // JSON array of hashtags
  imageUrl: text("image_url"),
  imagePrompt: text("image_prompt"),
  status: mysqlEnum("status", ["draft", "scheduled", "published", "failed"]).notNull().default("draft"),
  scheduledAt: timestamp("scheduled_at"),
  publishedAt: timestamp("published_at"),
  externalPostId: varchar("external_post_id", { length: 255 }),
  generationPrompt: text("generation_prompt"),
  tone: varchar("tone", { length: 50 }),
  topic: text("topic"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});
export type SocialPost = typeof socialPosts.$inferSelect;
export type InsertSocialPost = typeof socialPosts.$inferInsert;


export const contentBrandVoice = mysqlTable("content_brand_voice", {
  id: int("id").autoincrement().primaryKey(),
  accountId: int("account_id").notNull().unique(),
  industry: varchar("industry", { length: 100 }),
  targetAudience: varchar("target_audience", { length: 255 }),
  brandPersonality: varchar("brand_personality", { length: 255 }),
  keyMessages: text("key_messages"), // JSON array of key selling points
  avoidTopics: text("avoid_topics"), // JSON array of topics to avoid
  preferredTone: varchar("preferred_tone", { length: 50 }).default("professional"),
  examplePosts: text("example_posts"), // JSON array of example good posts
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});
export type ContentBrandVoice = typeof contentBrandVoice.$inferSelect;
export type InsertContentBrandVoice = typeof contentBrandVoice.$inferInsert;

// ─────────────────────────────────────────────
// LEAD ROUTING EVENTS — Monitoring & alerting for Facebook lead routing
// Tracks every lead routing attempt (success + failure) for real-time dashboards
// ─────────────────────────────────────────────
export const leadRoutingEvents = mysqlTable("lead_routing_events", {
  id: int("id").autoincrement().primaryKey(),
  /** Facebook page ID that received the lead */
  pageId: varchar("page_id", { length: 100 }),
  /** Facebook leadgen_id */
  leadId: varchar("lead_id", { length: 100 }),
  /** Resolved target account ID (null if routing failed) */
  accountId: int("account_id"),
  /** Contact ID created from this lead (null if creation failed) */
  contactId: int("contact_id"),
  /** Deal ID created from this lead (null if not created) */
  dealId: int("deal_id"),
  /** How the account was resolved */
  routingMethod: mysqlEnum("routing_method", [
    "manual_mapping",    // facebookPageMappings (admin-controlled)
    "oauth_page",        // accountFacebookPages (OAuth default)
    "payload_explicit",  // accountId provided in webhook payload
    "poller",            // facebookLeadPoller background job
    "unknown",
  ]).default("unknown").notNull(),
  /** Outcome of the routing attempt */
  status: mysqlEnum("status", [
    "success",           // Lead routed and contact created
    "failure",           // Routing failed (no mapping, DB error, etc.)
    "partial",           // Routed but downstream step failed (e.g. deal creation)
  ]).default("success").notNull(),
  /** Error message if status is failure or partial */
  errorMessage: text("error_message"),
  /** Time in milliseconds from webhook receipt to contact creation */
  responseTimeMs: int("response_time_ms"),
  /** Source of the lead event */
  source: mysqlEnum("source", [
    "webhook_native",    // Facebook native webhook POST
    "webhook_simplified",// n8n / simplified payload
    "poller",            // Background poller
  ]).default("webhook_native").notNull(),
  /** Whether a failure alert has been acknowledged by an admin */
  acknowledged: boolean("acknowledged").default(false).notNull(),
  /** Raw payload snippet for debugging (first 500 chars) */
  payloadSnippet: text("payload_snippet"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
export type LeadRoutingEvent = typeof leadRoutingEvents.$inferSelect;
export type InsertLeadRoutingEvent = typeof leadRoutingEvents.$inferInsert;

// ─────────────────────────────────────────────
// NOTIFICATION LOG — Audit trail for all notification deliveries
// Tracks every push/email/SMS notification sent for monitoring and debugging
// ─────────────────────────────────────────────
export const notificationLog = mysqlTable("notification_log", {
  id: int("id").autoincrement().primaryKey(),
  /** Which channel was used */
  channel: mysqlEnum("channel", ["push", "email", "sms"]).notNull(),
  /** Event type that triggered this notification */
  eventType: varchar("event_type", { length: 50 }).notNull(),
  /** Account this notification belongs to */
  accountId: int("account_id").notNull(),
  /** User who received this notification (null for account-level SMS) */
  userId: int("user_id"),
  /** Recipient address (email, phone, or push endpoint prefix) */
  recipient: varchar("recipient", { length: 320 }),
  /** Delivery status */
  status: mysqlEnum("status", ["sent", "failed", "skipped"]).default("sent").notNull(),
  /** Error message if delivery failed */
  errorMessage: text("error_message"),
  /** Provider used (sendgrid, twilio, web-push, etc.) */
  provider: varchar("provider", { length: 50 }),
  /** Notification title/subject for reference */
  title: varchar("title", { length: 500 }),
  /** External message ID from provider (SendGrid x-message-id, Twilio SID) for webhook matching */
  externalMessageId: varchar("external_message_id", { length: 255 }),
  /** Final delivery status from provider webhook (delivered, bounced, dropped, deferred, undelivered, failed, etc.) */
  deliveryStatus: varchar("delivery_status", { length: 50 }),
  /** Timestamp when delivery status was last updated by webhook */
  deliveryStatusUpdatedAt: timestamp("delivery_status_updated_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
export type NotificationLog = typeof notificationLog.$inferSelect;
export type InsertNotificationLog = typeof notificationLog.$inferInsert;



// ─────────────────────────────────────────────
// LONG-FORM CONTENT — AI-generated blog posts & articles
// ─────────────────────────────────────────────
export const longFormContent = mysqlTable("long_form_content", {
  id: int("id").autoincrement().primaryKey(),
  accountId: int("account_id").notNull(),
  createdByUserId: int("created_by_user_id").notNull(),
  title: varchar("title", { length: 500 }).notNull(),
  topic: text("topic").notNull(),
  content: text("content").notNull(),
  imageUrl: text("image_url"),
  imagePrompt: text("image_prompt"),
  status: mysqlEnum("status", ["draft", "published"]).notNull().default("draft"),
  aiModel: varchar("ai_model", { length: 100 }),
  customPrompt: text("custom_prompt"),
  inputTokens: int("input_tokens"),
  outputTokens: int("output_tokens"),
  totalTokens: int("total_tokens"),
  urlsFetched: int("urls_fetched").default(0),
  urlsFailed: int("urls_failed").default(0),
  webSearches: int("web_searches").default(0),
  wordCount: int("word_count"),
  generationTimeMs: int("generation_time_ms"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});
export type LongFormContent = typeof longFormContent.$inferSelect;
export type InsertLongFormContent = typeof longFormContent.$inferInsert;

// ─────────────────────────────────────────────
// CONTENT TEMPLATES — Reusable generation templates
// ─────────────────────────────────────────────
export const contentTemplates = mysqlTable("content_templates", {
  id: int("id").autoincrement().primaryKey(),
  accountId: int("account_id"),  // nullable for global templates
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  category: varchar("category", { length: 100 }),
  prompt: text("prompt"),
  structure: json("structure"),
  isPublic: boolean("is_public").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});
export type ContentTemplate = typeof contentTemplates.$inferSelect;
export type InsertContentTemplate = typeof contentTemplates.$inferInsert;

// ─────────────────────────────────────────────
// REPURPOSED CONTENT — Derivative content from long-form articles
// ─────────────────────────────────────────────
export const repurposedContent = mysqlTable("repurposed_content", {
  id: int("id").autoincrement().primaryKey(),
  accountId: int("account_id").notNull(),
  originalContentId: int("original_content_id").notNull(),
  format: mysqlEnum("format", [
    "social-snippet",
    "email-summary",
    "short-form",
    "infographic-script",
    "video-script",
  ]).notNull(),
  content: text("content").notNull(),
  platform: varchar("platform", { length: 50 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
export type RepurposedContent = typeof repurposedContent.$inferSelect;
export type InsertRepurposedContent = typeof repurposedContent.$inferInsert;


// ─────────────────────────────────────────────
// EMAIL DRAFTS — AI-generated email content
// ─────────────────────────────────────────────
export const emailDrafts = mysqlTable("email_drafts", {
  id: int("id").autoincrement().primaryKey(),
  accountId: int("account_id").notNull(),
  createdByUserId: int("created_by_user_id"),
  contactId: int("contact_id"),
  subject: varchar("subject", { length: 500 }).notNull(),
  body: text("body").notNull(),
  previewText: varchar("preview_text", { length: 255 }),
  templateType: varchar("template_type", { length: 50 }).notNull(),
  tone: varchar("tone", { length: 50 }),
  topic: varchar("topic", { length: 500 }),
  aiModel: varchar("ai_model", { length: 100 }),
  status: varchar("status", { length: 20 }).default("draft").notNull(),
  sentAt: timestamp("sent_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});
export type EmailDraft = typeof emailDrafts.$inferSelect;
export type InsertEmailDraft = typeof emailDrafts.$inferInsert;


// ─────────────────────────────────────────────
// EMAIL SIGNATURES — Reusable HTML email signatures per account
// ─────────────────────────────────────────────
export const emailSignatures = mysqlTable("email_signatures", {
  id: int("id").autoincrement().primaryKey(),
  accountId: int("account_id").notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  html: text("html").notNull(),
  isDefault: boolean("is_default").default(false).notNull(),
  /** Number of times this signature has been used in sent emails */
  usageCount: int("usage_count").default(0).notNull(),
  /** Last time this signature was used */
  lastUsedAt: timestamp("last_used_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});
export type EmailSignature = typeof emailSignatures.$inferSelect;
export type InsertEmailSignature = typeof emailSignatures.$inferInsert;

// ─── Recurring Content Plans ─────────────────────────────────────────────────
export const recurringContentPlans = mysqlTable("recurring_content_plans", {
  id: int("id").autoincrement().primaryKey(),
  accountId: int("account_id").notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  contentType: mysqlEnum("content_type", ["blog", "social"]).notNull().default("blog"),
  platform: varchar("platform", { length: 50 }),
  frequency: mysqlEnum("frequency", ["daily", "weekly", "biweekly", "monthly"]).notNull(),
  postsPerCycle: int("posts_per_cycle").notNull().default(1),
  topicTemplate: text("topic_template").notNull(),
  customPrompt: text("custom_prompt"),
  aiModel: varchar("ai_model", { length: 100 }).default("gemini-2.5-flash"),
  enableWebResearch: boolean("enable_web_research").default(false),
  enableImageGeneration: boolean("enable_image_generation").default(false),
  tone: varchar("tone", { length: 50 }).default("professional"),
  isActive: boolean("is_active").notNull().default(true),
  lastRunAt: timestamp("last_run_at"),
  nextRunAt: timestamp("next_run_at"),
  runCount: int("run_count").notNull().default(0),
  lastRunResult: text("last_run_result"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow(),
});
export type RecurringContentPlan = typeof recurringContentPlans.$inferSelect;
export type InsertRecurringContentPlan = typeof recurringContentPlans.$inferInsert;


// ─────────────────────────────────────────────
// System Events (Jarvis-ready event queue)
// ─────────────────────────────────────────────
export const systemEvents = mysqlTable("system_events", {
  id: int("id").primaryKey().autoincrement(),
  accountId: int("account_id"),
  eventType: varchar("event_type", { length: 100 }).notNull(),
  severity: mysqlEnum("severity", ["info", "warning", "critical"]).notNull().default("info"),
  title: varchar("title", { length: 500 }).notNull(),
  details: text("details"),
  resolved: boolean("resolved").notNull().default(false),
  resolvedAt: timestamp("resolved_at"),
  resolvedBy: varchar("resolved_by", { length: 100 }),
  createdAt: timestamp("created_at").defaultNow(),
});
export type SystemEvent = typeof systemEvents.$inferSelect;
export type InsertSystemEvent = typeof systemEvents.$inferInsert;

// ── Support Tickets ──────────────────────────────────────────────────
export const supportTickets = mysqlTable("support_tickets", {
  id: int("id").autoincrement().primaryKey(),
  accountId: int("account_id").notNull(),
  userId: int("user_id").notNull(),
  subject: varchar("subject", { length: 500 }).notNull(),
  category: mysqlEnum("category", ["bug", "feature", "billing", "general"]).default("general").notNull(),
  message: text("message").notNull(),
  screenshotUrl: text("screenshot_url"),
  status: mysqlEnum("status", ["open", "in_progress", "resolved", "closed"]).default("open").notNull(),
  adminNotes: text("admin_notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});
export type SupportTicket = typeof supportTickets.$inferSelect;
export type InsertSupportTicket = typeof supportTickets.$inferInsert;

// ─── Support Ticket Replies ──────────────────────────────────────────────
export const supportTicketReplies = mysqlTable("support_ticket_replies", {
  id: int("id").autoincrement().primaryKey(),
  ticketId: int("ticket_id").notNull(),
  userId: int("user_id").notNull(),
  authorType: mysqlEnum("author_type", ["client", "apex_staff"]).notNull(),
  body: text("body").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
export type SupportTicketReply = typeof supportTicketReplies.$inferSelect;
export type InsertSupportTicketReply = typeof supportTicketReplies.$inferInsert;
