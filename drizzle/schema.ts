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
  /** User ID of the account owner */
  ownerId: int("ownerId").notNull(),
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
