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
