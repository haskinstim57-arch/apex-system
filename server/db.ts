import { and, eq, desc, asc, sql, inArray, count, lte, gte } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { like, or } from "drizzle-orm";
import {
  InsertUser,
  users,
  accounts,
  accountMembers,
  invitations,
  auditLogs,
  contacts,
  contactTags,
  contactNotes,
  type InsertAccount,
  type InsertAccountMember,
  type InsertInvitation,
  type InsertAuditLog,
  type InsertContact,
  type InsertContactNote,
  messages,
  type InsertMessage,
  campaigns,
  campaignTemplates,
  campaignRecipients,
  type InsertCampaign,
  type InsertCampaignTemplate,
  type InsertCampaignRecipient,
  aiCalls,
  type InsertAICall,
  workflows,
  workflowSteps,
  workflowExecutions,
  workflowExecutionSteps,
  tasks,
  type InsertWorkflow,
  type InsertWorkflowStep,
  type InsertWorkflowExecution,
  type InsertWorkflowExecutionStep,
  type InsertTask,
  pipelines,
  pipelineStages,
  deals,
  type InsertPipeline,
  type InsertPipelineStage,
  type InsertDeal,
  facebookPageMappings,
  type InsertFacebookPageMapping,
  impersonationAuditLogs,
  type InsertImpersonationAuditLog,
  accountMessagingSettings,
  type InsertAccountMessagingSettings,
  passwordResetTokens,
  type InsertPasswordResetToken,
  accountIntegrations,
  type InsertAccountIntegration,
  accountFacebookPages,
  type InsertAccountFacebookPage,
  calendars,
  type InsertCalendar,
  appointments,
  type InsertAppointment,
  calendarIntegrations,
  type InsertCalendarIntegration,
  contactActivities,
  type InsertContactActivity,
  emailTemplates,
  type InsertEmailTemplate,
  notifications,
  type InsertNotification,
  portRequests,
  type InsertPortRequest,
  calendarWatches,
  type InsertCalendarWatch,
  externalCalendarEvents,
  type InsertExternalCalendarEvent,
} from "../drizzle/schema";
import { ENV } from "./_core/env";

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

// ─────────────────────────────────────────────
// USER HELPERS
// ─────────────────────────────────────────────

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = { openId: user.openId };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod", "passwordHash"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = "admin";
      updateSet.role = "admin";
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db
    .select()
    .from(users)
    .where(eq(users.openId, openId))
    .limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getUserById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db
    .select()
    .from(users)
    .where(eq(users.id, id))
    .limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getUserByEmail(email: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db
    .select()
    .from(users)
    .where(eq(users.email, email))
    .limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function setUserPassword(userId: number, passwordHash: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db
    .update(users)
    .set({ passwordHash })
    .where(eq(users.id, userId));
}

export async function updateUser(
  userId: number,
  data: { name?: string; email?: string }
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db
    .update(users)
    .set(data)
    .where(eq(users.id, userId));
}

// ─────────────────────────────────────────────
// PASSWORD RESET TOKEN HELPERS
// ─────────────────────────────────────────────
export async function createPasswordResetToken(data: { userId: number; token: string; expiresAt: Date }) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(passwordResetTokens).values(data);
  return { id: Number(result[0].insertId) };
}

export async function getPasswordResetToken(token: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db
    .select()
    .from(passwordResetTokens)
    .where(eq(passwordResetTokens.token, token))
    .limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function markPasswordResetTokenUsed(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db
    .update(passwordResetTokens)
    .set({ usedAt: new Date() })
    .where(eq(passwordResetTokens.id, id));
}

export async function getUserAccountMemberships(userId: number) {
  const db = await getDb();
  if (!db) return [];
  const result = await db
    .select({
      memberId: accountMembers.id,
      accountId: accountMembers.accountId,
      accountName: accounts.name,
      accountSlug: accounts.slug,
      accountStatus: accounts.status,
      memberRole: accountMembers.role,
      isActive: accountMembers.isActive,
    })
    .from(accountMembers)
    .innerJoin(accounts, eq(accountMembers.accountId, accounts.id))
    .where(and(eq(accountMembers.userId, userId), eq(accountMembers.isActive, true)))
    .orderBy(desc(accountMembers.joinedAt));
  return result;
}

export async function listAllUsers() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(users).orderBy(desc(users.createdAt));
}

// ─────────────────────────────────────────────
// ACCOUNT HELPERS
// ─────────────────────────────────────────────

export async function createAccount(data: InsertAccount) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const result = await db.insert(accounts).values(data);
  const insertId = result[0].insertId;

  // Auto-add the owner as a member with "owner" role (only if ownerId is set)
  if (data.ownerId) {
    await db.insert(accountMembers).values({
      accountId: insertId,
      userId: data.ownerId,
      role: "owner",
      isActive: true,
    });
  }

  return { id: insertId };
}

export async function getAccountById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db
    .select()
    .from(accounts)
    .where(eq(accounts.id, id))
    .limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getAccountBySlug(slug: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db
    .select()
    .from(accounts)
    .where(eq(accounts.slug, slug))
    .limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function listAccounts(parentId?: number | null) {
  const db = await getDb();
  if (!db) return [];

  if (parentId === null || parentId === undefined) {
    // List all accounts (admin view)
    return db.select().from(accounts).orderBy(desc(accounts.createdAt));
  }
  // List sub-accounts under a parent
  return db
    .select()
    .from(accounts)
    .where(eq(accounts.parentId, parentId))
    .orderBy(desc(accounts.createdAt));
}

/** List all accounts with owner name/email joined (admin view) */
export async function listAccountsWithOwner() {
  const db = await getDb();
  if (!db) return [];

  return db
    .select({
      id: accounts.id,
      name: accounts.name,
      slug: accounts.slug,
      parentId: accounts.parentId,
      ownerId: accounts.ownerId,
      industry: accounts.industry,
      website: accounts.website,
      phone: accounts.phone,
      email: accounts.email,
      address: accounts.address,
      logoUrl: accounts.logoUrl,
      status: accounts.status,
      onboardingComplete: accounts.onboardingComplete,
      createdAt: accounts.createdAt,
      updatedAt: accounts.updatedAt,
      ownerName: users.name,
      ownerEmail: users.email,
    })
    .from(accounts)
    .leftJoin(users, eq(accounts.ownerId, users.id))
    .orderBy(desc(accounts.createdAt));
}

/** List accounts for a specific user with owner info joined */
export async function listAccountsForUserWithOwner(userId: number) {
  const db = await getDb();
  if (!db) return [];

  // Get accounts where user is a member
  const memberships = await db
    .select({ accountId: accountMembers.accountId })
    .from(accountMembers)
    .where(
      and(eq(accountMembers.userId, userId), eq(accountMembers.isActive, true))
    );

  const memberAccountIds = memberships.map((m) => m.accountId);

  // Also get accounts where user is the owner (even if not in accountMembers)
  const ownedAccounts = await db
    .select({ id: accounts.id })
    .from(accounts)
    .where(eq(accounts.ownerId, userId));

  const ownedAccountIds = ownedAccounts.map((a) => a.id);

  // Merge and deduplicate
  const allAccountIds = Array.from(new Set([...memberAccountIds, ...ownedAccountIds]));
  if (allAccountIds.length === 0) return [];

  return db
    .select({
      id: accounts.id,
      name: accounts.name,
      slug: accounts.slug,
      parentId: accounts.parentId,
      ownerId: accounts.ownerId,
      industry: accounts.industry,
      website: accounts.website,
      phone: accounts.phone,
      email: accounts.email,
      address: accounts.address,
      logoUrl: accounts.logoUrl,
      status: accounts.status,
      onboardingComplete: accounts.onboardingComplete,
      createdAt: accounts.createdAt,
      updatedAt: accounts.updatedAt,
      ownerName: users.name,
      ownerEmail: users.email,
    })
    .from(accounts)
    .leftJoin(users, eq(accounts.ownerId, users.id))
    .where(inArray(accounts.id, allAccountIds))
    .orderBy(desc(accounts.createdAt));
}

export async function listAccountsForUser(userId: number) {
  const db = await getDb();
  if (!db) return [];

  const memberships = await db
    .select({ accountId: accountMembers.accountId })
    .from(accountMembers)
    .where(
      and(eq(accountMembers.userId, userId), eq(accountMembers.isActive, true))
    );

  if (memberships.length === 0) return [];

  const accountIds = memberships.map((m) => m.accountId);
  return db
    .select()
    .from(accounts)
    .where(inArray(accounts.id, accountIds))
    .orderBy(desc(accounts.createdAt));
}

export async function updateAccount(
  id: number,
  data: Partial<InsertAccount>
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(accounts).set(data).where(eq(accounts.id, id));
}

export async function deleteAccount(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  // Delete members and invitations first
  await db
    .delete(accountMembers)
    .where(eq(accountMembers.accountId, id));
  await db
    .delete(invitations)
    .where(eq(invitations.accountId, id));
  await db.delete(accounts).where(eq(accounts.id, id));
}

// ─────────────────────────────────────────────
// ACCOUNT MEMBER HELPERS
// ─────────────────────────────────────────────

export async function addMember(data: InsertAccountMember) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(accountMembers).values(data);
  return { id: result[0].insertId };
}

export async function getMember(accountId: number, userId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db
    .select()
    .from(accountMembers)
    .where(
      and(
        eq(accountMembers.accountId, accountId),
        eq(accountMembers.userId, userId)
      )
    )
    .limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function listMembers(accountId: number) {
  const db = await getDb();
  if (!db) return [];

  // Join with users to get name/email
  const result = await db
    .select({
      memberId: accountMembers.id,
      accountId: accountMembers.accountId,
      userId: accountMembers.userId,
      role: accountMembers.role,
      isActive: accountMembers.isActive,
      permissions: accountMembers.permissions,
      joinedAt: accountMembers.joinedAt,
      userName: users.name,
      userEmail: users.email,
      userOpenId: users.openId,
      lastSignedIn: users.lastSignedIn,
    })
    .from(accountMembers)
    .innerJoin(users, eq(accountMembers.userId, users.id))
    .where(eq(accountMembers.accountId, accountId))
    .orderBy(desc(accountMembers.joinedAt));

  return result;
}

export async function updateMemberRole(
  accountId: number,
  userId: number,
  role: "owner" | "manager" | "employee"
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db
    .update(accountMembers)
    .set({ role })
    .where(
      and(
        eq(accountMembers.accountId, accountId),
        eq(accountMembers.userId, userId)
      )
    );
}

export async function updateMemberStatus(
  accountId: number,
  userId: number,
  isActive: boolean
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db
    .update(accountMembers)
    .set({ isActive })
    .where(
      and(
        eq(accountMembers.accountId, accountId),
        eq(accountMembers.userId, userId)
      )
    );
}

export async function removeMember(accountId: number, userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db
    .delete(accountMembers)
    .where(
      and(
        eq(accountMembers.accountId, accountId),
        eq(accountMembers.userId, userId)
      )
    );
}

// ─────────────────────────────────────────────
// INVITATION HELPERS
// ─────────────────────────────────────────────

export async function createInvitation(data: InsertInvitation) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(invitations).values(data);
  return { id: result[0].insertId };
}

export async function getInvitationByToken(token: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db
    .select()
    .from(invitations)
    .where(eq(invitations.token, token))
    .limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function listInvitations(accountId: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(invitations)
    .where(eq(invitations.accountId, accountId))
    .orderBy(desc(invitations.createdAt));
}

export async function updateInvitationStatus(
  id: number,
  status: "pending" | "accepted" | "expired" | "revoked",
  acceptedAt?: Date
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const updateData: Record<string, unknown> = { status };
  if (acceptedAt) updateData.acceptedAt = acceptedAt;
  await db.update(invitations).set(updateData).where(eq(invitations.id, id));
}

// ─────────────────────────────────────────────
// AUDIT LOG HELPERS
// ─────────────────────────────────────────────

export async function createAuditLog(data: InsertAuditLog) {
  const db = await getDb();
  if (!db) return;
  await db.insert(auditLogs).values(data);
}

export async function listAuditLogs(accountId: number, limit = 50) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(auditLogs)
    .where(eq(auditLogs.accountId, accountId))
    .orderBy(desc(auditLogs.createdAt))
    .limit(limit);
}

// ─────────────────────────────────────────────
// STATS HELPERS
// ─────────────────────────────────────────────

export async function getAccountStats(accountId: number) {
  const db = await getDb();
  if (!db) return { members: 0, pendingInvites: 0 };

  const [memberResult] = await db
    .select({ count: sql<number>`count(*)` })
    .from(accountMembers)
    .where(
      and(
        eq(accountMembers.accountId, accountId),
        eq(accountMembers.isActive, true)
      )
    );

  const [inviteResult] = await db
    .select({ count: sql<number>`count(*)` })
    .from(invitations)
    .where(
      and(
        eq(invitations.accountId, accountId),
        eq(invitations.status, "pending")
      )
    );

  return {
    members: memberResult?.count ?? 0,
    pendingInvites: inviteResult?.count ?? 0,
  };
}

export async function getAdminStats() {
  const db = await getDb();
  if (!db) return { totalAccounts: 0, totalUsers: 0, activeAccounts: 0 };

  const [accountResult] = await db
    .select({ count: sql<number>`count(*)` })
    .from(accounts);

  const [userResult] = await db
    .select({ count: sql<number>`count(*)` })
    .from(users);

  const [activeResult] = await db
    .select({ count: sql<number>`count(*)` })
    .from(accounts)
    .where(eq(accounts.status, "active"));

  return {
    totalAccounts: accountResult?.count ?? 0,
    totalUsers: userResult?.count ?? 0,
    activeAccounts: activeResult?.count ?? 0,
  };
}

export async function getAccountDashboardStats(accountId: number) {
  const db = await getDb();
  if (!db) return { totalContacts: 0, totalMessages: 0, activeCampaigns: 0, totalCalls: 0, totalAppointments: 0 };

  const [contactResult] = await db
    .select({ count: sql<number>`count(*)` })
    .from(contacts)
    .where(eq(contacts.accountId, accountId));

  const [messageResult] = await db
    .select({ count: sql<number>`count(*)` })
    .from(messages)
    .where(eq(messages.accountId, accountId));

  const [campaignResult] = await db
    .select({ count: sql<number>`count(*)` })
    .from(campaigns)
    .where(sql`${campaigns.accountId} = ${accountId} AND ${campaigns.status} = 'active'`);

  const [callResult] = await db
    .select({ count: sql<number>`count(*)` })
    .from(aiCalls)
    .where(eq(aiCalls.accountId, accountId));

  const [appointmentResult] = await db
    .select({ count: sql<number>`count(*)` })
    .from(appointments)
    .where(eq(appointments.accountId, accountId));

  return {
    totalContacts: contactResult?.count ?? 0,
    totalMessages: messageResult?.count ?? 0,
    activeCampaigns: campaignResult?.count ?? 0,
    totalCalls: callResult?.count ?? 0,
    totalAppointments: appointmentResult?.count ?? 0,
  };
}

// ─────────────────────────────────────────────
// CONTACT HELPERS
// ─────────────────────────────────────────────

export interface ContactListFilters {
  accountId: number;
  search?: string;
  status?: string;
  leadSource?: string;
  assignedUserId?: number;
  tag?: string;
  limit?: number;
  offset?: number;
}

export async function createContact(data: InsertContact) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(contacts).values(data);
  return { id: result[0].insertId };
}

export async function getContactById(id: number, accountId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db
    .select()
    .from(contacts)
    .where(and(eq(contacts.id, id), eq(contacts.accountId, accountId)))
    .limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function listContacts(filters: ContactListFilters) {
  const db = await getDb();
  if (!db) return { data: [], total: 0 };

  const conditions = [eq(contacts.accountId, filters.accountId)];

  if (filters.status) {
    conditions.push(eq(contacts.status, filters.status as any));
  }
  if (filters.leadSource) {
    conditions.push(eq(contacts.leadSource, filters.leadSource));
  }
  if (filters.assignedUserId) {
    conditions.push(eq(contacts.assignedUserId, filters.assignedUserId));
  }
  if (filters.search) {
    const term = `%${filters.search}%`;
    conditions.push(
      or(
        like(contacts.firstName, term),
        like(contacts.lastName, term),
        like(contacts.email, term),
        like(contacts.phone, term),
        like(contacts.company, term)
      )!
    );
  }

  // If filtering by tag, get matching contact IDs first
  let tagContactIds: number[] | undefined;
  if (filters.tag) {
    const tagResults = await db
      .select({ contactId: contactTags.contactId })
      .from(contactTags)
      .where(eq(contactTags.tag, filters.tag));
    tagContactIds = tagResults.map((r) => r.contactId);
    if (tagContactIds.length === 0) return { data: [], total: 0 };
    conditions.push(inArray(contacts.id, tagContactIds));
  }

  const whereClause = and(...conditions);

  const [countResult] = await db
    .select({ total: sql<number>`count(*)` })
    .from(contacts)
    .where(whereClause);

  const limit = filters.limit ?? 50;
  const offset = filters.offset ?? 0;

  const data = await db
    .select()
    .from(contacts)
    .where(whereClause)
    .orderBy(desc(contacts.createdAt))
    .limit(limit)
    .offset(offset);

  return { data, total: countResult?.total ?? 0 };
}

export async function updateContact(
  id: number,
  accountId: number,
  data: Partial<InsertContact>
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db
    .update(contacts)
    .set(data)
    .where(and(eq(contacts.id, id), eq(contacts.accountId, accountId)));
}

export async function deleteContact(id: number, accountId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  // Delete related data first
  await db.delete(contactTags).where(eq(contactTags.contactId, id));
  await db.delete(contactNotes).where(eq(contactNotes.contactId, id));
  await db
    .delete(contacts)
    .where(and(eq(contacts.id, id), eq(contacts.accountId, accountId)));
}

export async function assignContact(
  id: number,
  accountId: number,
  assignedUserId: number | null
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db
    .update(contacts)
    .set({ assignedUserId })
    .where(and(eq(contacts.id, id), eq(contacts.accountId, accountId)));
}

export async function getContactStats(accountId: number) {
  const db = await getDb();
  if (!db) return { total: 0, new: 0, qualified: 0, won: 0 };

  const [totalResult] = await db
    .select({ count: sql<number>`count(*)` })
    .from(contacts)
    .where(eq(contacts.accountId, accountId));

  const [newResult] = await db
    .select({ count: sql<number>`count(*)` })
    .from(contacts)
    .where(
      and(eq(contacts.accountId, accountId), eq(contacts.status, "new"))
    );

  const [qualifiedResult] = await db
    .select({ count: sql<number>`count(*)` })
    .from(contacts)
    .where(
      and(
        eq(contacts.accountId, accountId),
        eq(contacts.status, "qualified")
      )
    );

  const [wonResult] = await db
    .select({ count: sql<number>`count(*)` })
    .from(contacts)
    .where(
      and(eq(contacts.accountId, accountId), eq(contacts.status, "won"))
    );

  return {
    total: totalResult?.count ?? 0,
    new: newResult?.count ?? 0,
    qualified: qualifiedResult?.count ?? 0,
    won: wonResult?.count ?? 0,
  };
}

// ─────────────────────────────────────────────
// CONTACT TAG HELPERS
// ─────────────────────────────────────────────

export async function getContactTags(contactId: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(contactTags)
    .where(eq(contactTags.contactId, contactId))
    .orderBy(asc(contactTags.tag));
}

export async function addContactTag(contactId: number, tag: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  // Prevent duplicates
  const existing = await db
    .select()
    .from(contactTags)
    .where(
      and(eq(contactTags.contactId, contactId), eq(contactTags.tag, tag))
    )
    .limit(1);
  if (existing.length > 0) return existing[0];
  const result = await db
    .insert(contactTags)
    .values({ contactId, tag });
  return { id: result[0].insertId, contactId, tag };
}

export async function removeContactTag(contactId: number, tag: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db
    .delete(contactTags)
    .where(
      and(eq(contactTags.contactId, contactId), eq(contactTags.tag, tag))
    );
}

export async function listAllTagsForAccount(accountId: number) {
  const db = await getDb();
  if (!db) return [];
  // Get distinct tags used across all contacts in this account
  const result = await db
    .selectDistinct({ tag: contactTags.tag })
    .from(contactTags)
    .innerJoin(contacts, eq(contactTags.contactId, contacts.id))
    .where(eq(contacts.accountId, accountId))
    .orderBy(asc(contactTags.tag));
  return result.map((r) => r.tag);
}

// ─────────────────────────────────────────────
// CONTACT NOTE HELPERS
// ─────────────────────────────────────────────

export async function createContactNote(data: InsertContactNote) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(contactNotes).values(data);
  return { id: result[0].insertId };
}

export async function listContactNotes(contactId: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select({
      id: contactNotes.id,
      contactId: contactNotes.contactId,
      authorId: contactNotes.authorId,
      content: contactNotes.content,
      isPinned: contactNotes.isPinned,
      createdAt: contactNotes.createdAt,
      updatedAt: contactNotes.updatedAt,
      authorName: users.name,
      authorEmail: users.email,
    })
    .from(contactNotes)
    .leftJoin(users, eq(contactNotes.authorId, users.id))
    .where(eq(contactNotes.contactId, contactId))
    .orderBy(desc(contactNotes.isPinned), desc(contactNotes.createdAt));
}

export async function updateContactNote(
  id: number,
  data: { content?: string; isPinned?: boolean }
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(contactNotes).set(data).where(eq(contactNotes.id, id));
}

export async function deleteContactNote(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(contactNotes).where(eq(contactNotes.id, id));
}

export async function getContactNoteById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db
    .select()
    .from(contactNotes)
    .where(eq(contactNotes.id, id))
    .limit(1);
  return result.length > 0 ? result[0] : undefined;
}

// ────────────────────────────────────────────────────────────
// MESSAGES — email & SMS communication history
// ────────────────────────────────────────────────────────────

export async function createMessage(data: InsertMessage) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(messages).values(data);
  return { id: Number(result[0].insertId) };
}

export async function getMessageById(id: number, accountId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db
    .select()
    .from(messages)
    .where(and(eq(messages.id, id), eq(messages.accountId, accountId)))
    .limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function listMessages(params: {
  accountId: number;
  contactId?: number;
  type?: "email" | "sms";
  direction?: "outbound" | "inbound";
  status?: "pending" | "sent" | "delivered" | "failed" | "bounced";
  search?: string;
  limit?: number;
  offset?: number;
}) {
  const db = await getDb();
  if (!db) return { messages: [], total: 0 };

  const conditions = [eq(messages.accountId, params.accountId)];

  if (params.contactId) {
    conditions.push(eq(messages.contactId, params.contactId));
  }
  if (params.type) {
    conditions.push(eq(messages.type, params.type));
  }
  if (params.direction) {
    conditions.push(eq(messages.direction, params.direction));
  }
  if (params.status) {
    conditions.push(eq(messages.status, params.status));
  }
  if (params.search) {
    conditions.push(
      or(
        like(messages.subject, `%${params.search}%`),
        like(messages.body, `%${params.search}%`),
        like(messages.toAddress, `%${params.search}%`)
      )!
    );
  }

  const whereClause = and(...conditions);
  const limit = params.limit ?? 50;
  const offset = params.offset ?? 0;

  const [rows, countResult] = await Promise.all([
    db
      .select()
      .from(messages)
      .where(whereClause)
      .orderBy(desc(messages.createdAt))
      .limit(limit)
      .offset(offset),
    db
      .select({ count: count() })
      .from(messages)
      .where(whereClause),
  ]);

  return { messages: rows, total: countResult[0]?.count ?? 0 };
}

export async function listMessagesByContact(contactId: number, accountId: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(messages)
    .where(and(eq(messages.contactId, contactId), eq(messages.accountId, accountId)))
    .orderBy(desc(messages.createdAt));
}

export async function updateMessageStatus(
  id: number,
  status: "pending" | "sent" | "delivered" | "failed" | "bounced",
  extra?: { externalId?: string; errorMessage?: string; sentAt?: Date; deliveredAt?: Date }
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db
    .update(messages)
    .set({ status, ...extra })
    .where(eq(messages.id, id));
}

export async function deleteMessage(id: number, accountId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db
    .delete(messages)
    .where(and(eq(messages.id, id), eq(messages.accountId, accountId)));
}

export async function getMessageStats(accountId: number) {
  const db = await getDb();
  if (!db) return { total: 0, sent: 0, delivered: 0, failed: 0, emails: 0, sms: 0 };

  const allMsgs = await db
    .select()
    .from(messages)
    .where(eq(messages.accountId, accountId));

  return {
    total: allMsgs.length,
    sent: allMsgs.filter((m) => m.status === "sent" || m.status === "delivered").length,
    delivered: allMsgs.filter((m) => m.status === "delivered").length,
    failed: allMsgs.filter((m) => m.status === "failed" || m.status === "bounced").length,
    emails: allMsgs.filter((m) => m.type === "email").length,
    sms: allMsgs.filter((m) => m.type === "sms").length,
  };
}

// ─────────────────────────────────────────────
// CONVERSATIONS — inbox-oriented queries
// ─────────────────────────────────────────────

/**
 * Get conversations: one row per contact who has messages,
 * with latest message preview, unread count, and contact info.
 */
export async function getConversations(params: {
  accountId: number;
  type?: "email" | "sms";
  unreadOnly?: boolean;
  search?: string;
  limit?: number;
  offset?: number;
}) {
  const db = await getDb();
  if (!db) return { conversations: [], total: 0 };

  const limit = params.limit ?? 50;
  const offset = params.offset ?? 0;

  // Build WHERE conditions for the messages
  const conditions = [eq(messages.accountId, params.accountId)];
  if (params.type) {
    conditions.push(eq(messages.type, params.type));
  }

  const whereClause = and(...conditions);

  // Get all contacts that have messages matching the filter
  // Use a subquery approach: get contactIds with their latest message + unread count
  const rawConversations = await db
    .select({
      contactId: messages.contactId,
      lastMessageAt: sql<Date>`MAX(${messages.createdAt})`.as("lastMessageAt"),
      unreadCount: sql<number>`SUM(CASE WHEN ${messages.isRead} = false THEN 1 ELSE 0 END)`.as("unreadCount"),
      totalMessages: count().as("totalMessages"),
    })
    .from(messages)
    .where(whereClause)
    .groupBy(messages.contactId)
    .orderBy(sql`MAX(${messages.createdAt}) DESC`);

  // Filter for unread only if requested
  let filtered = rawConversations;
  if (params.unreadOnly) {
    filtered = filtered.filter((c) => Number(c.unreadCount) > 0);
  }

  // Now fetch contact info + latest message for each conversation
  const contactIds = filtered.map((c) => c.contactId);
  if (contactIds.length === 0) return { conversations: [], total: 0 };

  // Get contact details
  const contactRows = await db
    .select()
    .from(contacts)
    .where(
      and(
        inArray(contacts.id, contactIds),
        eq(contacts.accountId, params.accountId)
      )
    );

  // Apply search filter on contact name/email/phone
  let contactMap = new Map(contactRows.map((c) => [c.id, c]));
  if (params.search) {
    const s = params.search.toLowerCase();
    const filtered2 = Array.from(contactMap.entries()).filter(([, c]) => {
      const fullName = `${c.firstName} ${c.lastName}`.toLowerCase();
      return (
        fullName.includes(s) ||
        c.email?.toLowerCase().includes(s) ||
        c.phone?.includes(s)
      );
    });
    contactMap = new Map(filtered2);
  }

  // Re-filter conversations to only those with matching contacts
  const matchedConversations = filtered.filter((c) => contactMap.has(c.contactId));
  const total = matchedConversations.length;
  const paged = matchedConversations.slice(offset, offset + limit);

  // Get the latest message for each contact in the page
  const result = await Promise.all(
    paged.map(async (conv) => {
      const contact = contactMap.get(conv.contactId)!;
      // Get the latest message
      const latestMsgs = await db
        .select()
        .from(messages)
        .where(
          and(
            eq(messages.contactId, conv.contactId),
            eq(messages.accountId, params.accountId),
            ...(params.type ? [eq(messages.type, params.type)] : [])
          )
        )
        .orderBy(desc(messages.createdAt))
        .limit(1);
      const latestMessage = latestMsgs[0] ?? null;
      return {
        contactId: conv.contactId,
        contactName: `${contact.firstName} ${contact.lastName}`,
        contactEmail: contact.email,
        contactPhone: contact.phone,
        contactAvatar: null as string | null,
        unreadCount: Number(conv.unreadCount),
        lastMessageAt: conv.lastMessageAt,
        latestMessage: latestMessage
          ? {
              id: latestMessage.id,
              type: latestMessage.type,
              direction: latestMessage.direction,
              subject: latestMessage.subject,
              body: latestMessage.body.substring(0, 150),
              isRead: latestMessage.isRead,
              createdAt: latestMessage.createdAt,
            }
          : null,
      };
    })
  );

  return { conversations: result, total };
}

/**
 * Get full message thread for a contact, ordered chronologically (oldest first).
 */
export async function getThread(contactId: number, accountId: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(messages)
    .where(and(eq(messages.contactId, contactId), eq(messages.accountId, accountId)))
    .orderBy(asc(messages.createdAt));
}

/**
 * Mark all messages for a contact as read.
 */
export async function markMessagesAsRead(contactId: number, accountId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db
    .update(messages)
    .set({ isRead: true, readAt: new Date() })
    .where(
      and(
        eq(messages.contactId, contactId),
        eq(messages.accountId, accountId),
        eq(messages.isRead, false)
      )
    );
}

/**
 * Get total unread message count for an account.
 */
export async function getUnreadMessageCount(accountId: number) {
  const db = await getDb();
  if (!db) return 0;
  const result = await db
    .select({ count: count() })
    .from(messages)
    .where(
      and(
        eq(messages.accountId, accountId),
        eq(messages.isRead, false)
      )
    );
  return result[0]?.count ?? 0;
}

/**
 * Find a contact by phone number within an account.
 */
export async function findContactByPhone(phone: string, accountId: number) {
  const db = await getDb();
  if (!db) return null;
  const rows = await db
    .select()
    .from(contacts)
    .where(and(eq(contacts.phone, phone), eq(contacts.accountId, accountId)))
    .limit(1);
  return rows[0] ?? null;
}

/**
 * Find a contact by email within an account.
 */
export async function findContactByEmail(email: string, accountId: number) {
  const db = await getDb();
  if (!db) return null;
  const rows = await db
    .select()
    .from(contacts)
    .where(and(eq(contacts.email, email), eq(contacts.accountId, accountId)))
    .limit(1);
  return rows[0] ?? null;
}

// ─────────────────────────────────────────────
// CAMPAIGN TEMPLATES
// ─────────────────────────────────────────────

export async function createCampaignTemplate(data: InsertCampaignTemplate) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(campaignTemplates).values(data);
  return { id: result[0].insertId };
}

export async function listCampaignTemplates(
  accountId: number,
  opts: { type?: "email" | "sms" } = {}
) {
  const db = await getDb();
  if (!db) return [];
  const accountCondition = or(
    eq(campaignTemplates.accountId, accountId),
    eq(campaignTemplates.accountId, 0) // include global prebuilt templates
  );
  const conditions = [accountCondition];
  if (opts.type) conditions.push(eq(campaignTemplates.type, opts.type));
  return db
    .select()
    .from(campaignTemplates)
    .where(and(...conditions))
    .orderBy(desc(campaignTemplates.updatedAt));
}

export async function getCampaignTemplate(id: number, accountId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const rows = await db
    .select()
    .from(campaignTemplates)
    .where(
      and(
        eq(campaignTemplates.id, id),
        or(eq(campaignTemplates.accountId, accountId), eq(campaignTemplates.accountId, 0))
      )
    )
    .limit(1);
  return rows[0];
}

export async function updateCampaignTemplate(
  id: number,
  accountId: number,
  data: Partial<Pick<InsertCampaignTemplate, "name" | "subject" | "body" | "type">>
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db
    .update(campaignTemplates)
    .set(data)
    .where(
      and(eq(campaignTemplates.id, id), eq(campaignTemplates.accountId, accountId))
    );
}

export async function deleteCampaignTemplate(id: number, accountId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db
    .delete(campaignTemplates)
    .where(
      and(eq(campaignTemplates.id, id), eq(campaignTemplates.accountId, accountId))
    );
}

// ─────────────────────────────────────────────
// CAMPAIGNS
// ─────────────────────────────────────────────

export async function createCampaign(data: InsertCampaign) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(campaigns).values(data);
  return { id: result[0].insertId };
}

export async function listCampaigns(
  accountId: number,
  opts: {
    status?: string;
    type?: "email" | "sms";
    search?: string;
    limit?: number;
    offset?: number;
  } = {}
) {
  const db = await getDb();
  if (!db) return { data: [], total: 0 };
  const conditions = [eq(campaigns.accountId, accountId)];
  if (opts.status) conditions.push(eq(campaigns.status, opts.status as any));
  if (opts.type) conditions.push(eq(campaigns.type, opts.type));
  if (opts.search) {
    conditions.push(like(campaigns.name, `%${opts.search}%`));
  }
  const whereClause = and(...conditions);
  const [data, countResult] = await Promise.all([
    db
      .select()
      .from(campaigns)
      .where(whereClause)
      .orderBy(desc(campaigns.updatedAt))
      .limit(opts.limit || 50)
      .offset(opts.offset || 0),
    db
      .select({ count: count() })
      .from(campaigns)
      .where(whereClause),
  ]);
  return { data, total: countResult[0]?.count || 0 };
}

export async function getCampaign(id: number, accountId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const rows = await db
    .select()
    .from(campaigns)
    .where(and(eq(campaigns.id, id), eq(campaigns.accountId, accountId)))
    .limit(1);
  return rows[0];
}

export async function updateCampaign(
  id: number,
  accountId: number,
  data: Partial<
    Pick<
      InsertCampaign,
      | "name"
      | "type"
      | "status"
      | "subject"
      | "body"
      | "fromAddress"
      | "scheduledAt"
      | "sentAt"
      | "completedAt"
      | "totalRecipients"
      | "sentCount"
      | "deliveredCount"
      | "failedCount"
      | "openedCount"
      | "clickedCount"
    >
  >
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db
    .update(campaigns)
    .set(data)
    .where(and(eq(campaigns.id, id), eq(campaigns.accountId, accountId)));
}

export async function deleteCampaign(id: number, accountId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  // Delete recipients first, then the campaign
  await db.delete(campaignRecipients).where(eq(campaignRecipients.campaignId, id));
  await db
    .delete(campaigns)
    .where(and(eq(campaigns.id, id), eq(campaigns.accountId, accountId)));
}

// ─────────────────────────────────────────────
// CAMPAIGN RECIPIENTS
// ─────────────────────────────────────────────

export async function addCampaignRecipients(
  campaignId: number,
  recipients: Array<{ contactId: number; toAddress: string }>
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  if (recipients.length === 0) return;
  const values = recipients.map((r) => ({
    campaignId,
    contactId: r.contactId,
    toAddress: r.toAddress,
    status: "pending" as const,
  }));
  await db.insert(campaignRecipients).values(values);
}

export async function listCampaignRecipients(
  campaignId: number,
  opts: { status?: string; limit?: number; offset?: number } = {}
) {
  const db = await getDb();
  if (!db) return { data: [], total: 0 };
  const conditions = [eq(campaignRecipients.campaignId, campaignId)];
  if (opts.status) conditions.push(eq(campaignRecipients.status, opts.status as any));
  const whereClause = and(...conditions);
  const [data, countResult] = await Promise.all([
    db
      .select({
        id: campaignRecipients.id,
        campaignId: campaignRecipients.campaignId,
        contactId: campaignRecipients.contactId,
        status: campaignRecipients.status,
        toAddress: campaignRecipients.toAddress,
        errorMessage: campaignRecipients.errorMessage,
        sentAt: campaignRecipients.sentAt,
        deliveredAt: campaignRecipients.deliveredAt,
        openedAt: campaignRecipients.openedAt,
        clickedAt: campaignRecipients.clickedAt,
        createdAt: campaignRecipients.createdAt,
        contactFirstName: contacts.firstName,
        contactLastName: contacts.lastName,
        contactEmail: contacts.email,
        contactPhone: contacts.phone,
      })
      .from(campaignRecipients)
      .leftJoin(contacts, eq(campaignRecipients.contactId, contacts.id))
      .where(whereClause)
      .orderBy(desc(campaignRecipients.createdAt))
      .limit(opts.limit || 50)
      .offset(opts.offset || 0),
    db
      .select({ count: count() })
      .from(campaignRecipients)
      .where(whereClause),
  ]);
  return { data, total: countResult[0]?.count || 0 };
}

export async function updateCampaignRecipientStatus(
  id: number,
  status: string,
  extra: { sentAt?: Date; deliveredAt?: Date; openedAt?: Date; clickedAt?: Date; errorMessage?: string } = {}
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db
    .update(campaignRecipients)
    .set({ status: status as any, ...extra })
    .where(eq(campaignRecipients.id, id));
}

export async function getCampaignRecipientStats(campaignId: number) {
  const db = await getDb();
  if (!db) return { total: 0, pending: 0, sent: 0, delivered: 0, failed: 0, bounced: 0, opened: 0, clicked: 0 };
  const rows = await db
    .select({
      status: campaignRecipients.status,
      count: count(),
    })
    .from(campaignRecipients)
    .where(eq(campaignRecipients.campaignId, campaignId))
    .groupBy(campaignRecipients.status);
  const stats: Record<string, number> = { total: 0, pending: 0, sent: 0, delivered: 0, failed: 0, bounced: 0, opened: 0, clicked: 0 };
  for (const row of rows) {
    stats[row.status] = row.count;
    stats.total += row.count;
  }
  return stats;
}

export async function removeCampaignRecipient(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(campaignRecipients).where(eq(campaignRecipients.id, id));
}

export async function getCampaignStats(accountId: number) {
  const db = await getDb();
  if (!db) return { total: 0, draft: 0, scheduled: 0, sending: 0, sent: 0, paused: 0, cancelled: 0 };
  const rows = await db
    .select({
      status: campaigns.status,
      count: count(),
    })
    .from(campaigns)
    .where(eq(campaigns.accountId, accountId))
    .groupBy(campaigns.status);
  const stats: Record<string, number> = { total: 0, draft: 0, scheduled: 0, sending: 0, sent: 0, paused: 0, cancelled: 0 };
  for (const row of rows) {
    stats[row.status] = row.count;
    stats.total += row.count;
  }
  return stats;
}

// ─────────────────────────────────────────────
// AI CALLS — CRUD helpers
// ─────────────────────────────────────────────

/** Create a new AI call record */
export async function createAICall(data: InsertAICall) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(aiCalls).values(data);
  return { id: result[0].insertId };
}

/** Get a single AI call by ID */
export async function getAICallById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(aiCalls).where(eq(aiCalls.id, id)).limit(1);
  return result[0];
}

/** List AI calls for an account with pagination and filters */
export async function listAICalls(params: {
  accountId: number;
  page?: number;
  limit?: number;
  status?: string;
  contactId?: number;
  search?: string;
}) {
  const db = await getDb();
  if (!db) return { data: [], total: 0 };

  const page = params.page ?? 1;
  const limit = params.limit ?? 20;
  const offset = (page - 1) * limit;

  const conditions = [eq(aiCalls.accountId, params.accountId)];

  if (params.status) {
    conditions.push(eq(aiCalls.status, params.status as any));
  }
  if (params.contactId) {
    conditions.push(eq(aiCalls.contactId, params.contactId));
  }

  const whereClause = and(...conditions);

  const [data, totalResult] = await Promise.all([
    db
      .select()
      .from(aiCalls)
      .where(whereClause)
      .orderBy(desc(aiCalls.createdAt))
      .limit(limit)
      .offset(offset),
    db
      .select({ count: count() })
      .from(aiCalls)
      .where(whereClause),
  ]);

  return { data, total: totalResult[0]?.count ?? 0 };
}

/** Update AI call status and related fields */
export async function updateAICall(
  id: number,
  data: Partial<{
    status: string;
    startedAt: Date;
    endedAt: Date;
    durationSeconds: number;
    transcript: string;
    summary: string;
    recordingUrl: string;
    externalCallId: string;
    sentiment: string;
    errorMessage: string;
    assistantId: string;
    metadata: string;
  }>
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(aiCalls).set(data as any).where(eq(aiCalls.id, id));
}

/** Get a single AI call by external (VAPI) call ID */
export async function getAICallByExternalId(externalCallId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db
    .select()
    .from(aiCalls)
    .where(eq(aiCalls.externalCallId, externalCallId))
    .limit(1);
  return result[0];
}

/** Delete an AI call record */
export async function deleteAICall(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(aiCalls).where(eq(aiCalls.id, id));
}

/** Get AI call stats for an account */
export async function getAICallStats(accountId: number) {
  const db = await getDb();
  if (!db) return { total: 0, queued: 0, calling: 0, completed: 0, failed: 0 };

  const result = await db
    .select({
      total: count(),
      queued: sql<number>`SUM(CASE WHEN ${aiCalls.status} = 'queued' THEN 1 ELSE 0 END)`,
      calling: sql<number>`SUM(CASE WHEN ${aiCalls.status} = 'calling' THEN 1 ELSE 0 END)`,
      completed: sql<number>`SUM(CASE WHEN ${aiCalls.status} = 'completed' THEN 1 ELSE 0 END)`,
      failed: sql<number>`SUM(CASE WHEN ${aiCalls.status} = 'failed' THEN 1 ELSE 0 END)`,
      noAnswer: sql<number>`SUM(CASE WHEN ${aiCalls.status} = 'no_answer' THEN 1 ELSE 0 END)`,
      busy: sql<number>`SUM(CASE WHEN ${aiCalls.status} = 'busy' THEN 1 ELSE 0 END)`,
      avgDuration: sql<number>`AVG(CASE WHEN ${aiCalls.durationSeconds} > 0 THEN ${aiCalls.durationSeconds} ELSE NULL END)`,
    })
    .from(aiCalls)
    .where(eq(aiCalls.accountId, accountId));

  const row = result[0];
  return {
    total: row?.total ?? 0,
    queued: Number(row?.queued ?? 0),
    calling: Number(row?.calling ?? 0),
    completed: Number(row?.completed ?? 0),
    failed: Number(row?.failed ?? 0),
    noAnswer: Number(row?.noAnswer ?? 0),
    busy: Number(row?.busy ?? 0),
    avgDuration: Math.round(Number(row?.avgDuration ?? 0)),
  };
}

/** Get AI calls for a specific contact */
export async function getAICallsByContact(contactId: number, accountId: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(aiCalls)
    .where(and(eq(aiCalls.contactId, contactId), eq(aiCalls.accountId, accountId)))
    .orderBy(desc(aiCalls.createdAt));
}

// ═══════════════════════════════════════════════
// WORKFLOWS — Automation workflow helpers
// ═══════════════════════════════════════════════

/** Create a new workflow */
export async function createWorkflow(data: InsertWorkflow) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(workflows).values(data);
  return { id: Number(result[0].insertId) };
}

/** List workflows for an account */
export async function listWorkflows(accountId: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(workflows)
    .where(eq(workflows.accountId, accountId))
    .orderBy(desc(workflows.updatedAt));
}

/** Get a single workflow by ID */
export async function getWorkflowById(id: number, accountId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db
    .select()
    .from(workflows)
    .where(and(eq(workflows.id, id), eq(workflows.accountId, accountId)))
    .limit(1);
  return result[0];
}

/** Update a workflow */
export async function updateWorkflow(
  id: number,
  accountId: number,
  data: Partial<{
    name: string;
    description: string | null;
    triggerType: string;
    triggerConfig: string | null;
    isActive: boolean;
    executionCount: number;
    lastExecutedAt: Date;
  }>
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db
    .update(workflows)
    .set(data as any)
    .where(and(eq(workflows.id, id), eq(workflows.accountId, accountId)));
}

/** Delete a workflow and its steps */
export async function deleteWorkflow(id: number, accountId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  // Delete steps first
  await db.delete(workflowSteps).where(eq(workflowSteps.workflowId, id));
  // Delete the workflow
  await db
    .delete(workflows)
    .where(and(eq(workflows.id, id), eq(workflows.accountId, accountId)));
}

/** Get active workflows matching a trigger type for an account */
export async function getActiveWorkflowsByTrigger(
  accountId: number,
  triggerType: string
) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(workflows)
    .where(
      and(
        eq(workflows.accountId, accountId),
        eq(workflows.triggerType, triggerType as any),
        eq(workflows.isActive, true)
      )
    );
}

// ═══════════════════════════════════════════════
// WORKFLOW STEPS
// ═══════════════════════════════════════════════

/** Create a workflow step */
export async function createWorkflowStep(data: InsertWorkflowStep) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(workflowSteps).values(data);
  return { id: Number(result[0].insertId) };
}

/** List steps for a workflow (ordered) */
export async function listWorkflowSteps(workflowId: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(workflowSteps)
    .where(eq(workflowSteps.workflowId, workflowId))
    .orderBy(workflowSteps.stepOrder);
}

/** Update a workflow step */
export async function updateWorkflowStep(
  id: number,
  data: Partial<{
    stepOrder: number;
    stepType: string;
    actionType: string | null;
    delayType: string | null;
    delayValue: number | null;
    config: string | null;
  }>
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(workflowSteps).set(data as any).where(eq(workflowSteps.id, id));
}

/** Delete a workflow step */
export async function deleteWorkflowStep(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(workflowSteps).where(eq(workflowSteps.id, id));
}

/** Get a single workflow step */
export async function getWorkflowStepById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db
    .select()
    .from(workflowSteps)
    .where(eq(workflowSteps.id, id))
    .limit(1);
  return result[0];
}

// ═══════════════════════════════════════════════
// WORKFLOW EXECUTIONS
// ═══════════════════════════════════════════════

/** Create a workflow execution */
export async function createWorkflowExecution(data: InsertWorkflowExecution) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(workflowExecutions).values(data);
  return { id: Number(result[0].insertId) };
}

/** List executions for a workflow */
export async function listWorkflowExecutions(
  workflowId: number,
  accountId: number,
  opts?: { limit?: number; offset?: number }
) {
  const db = await getDb();
  if (!db) return { executions: [], total: 0 };
  const limit = opts?.limit ?? 50;
  const offset = opts?.offset ?? 0;

  const [rows, countResult] = await Promise.all([
    db
      .select()
      .from(workflowExecutions)
      .where(
        and(
          eq(workflowExecutions.workflowId, workflowId),
          eq(workflowExecutions.accountId, accountId)
        )
      )
      .orderBy(desc(workflowExecutions.createdAt))
      .limit(limit)
      .offset(offset),
    db
      .select({ total: count() })
      .from(workflowExecutions)
      .where(
        and(
          eq(workflowExecutions.workflowId, workflowId),
          eq(workflowExecutions.accountId, accountId)
        )
      ),
  ]);

  return { executions: rows, total: countResult[0]?.total ?? 0 };
}

/** List all executions for an account (across all workflows) */
export async function listAccountExecutions(
  accountId: number,
  opts?: { limit?: number; offset?: number; status?: string }
) {
  const db = await getDb();
  if (!db) return { executions: [], total: 0 };
  const limit = opts?.limit ?? 50;
  const offset = opts?.offset ?? 0;

  const conditions = [eq(workflowExecutions.accountId, accountId)];
  if (opts?.status) {
    conditions.push(eq(workflowExecutions.status, opts.status as any));
  }

  const [rows, countResult] = await Promise.all([
    db
      .select()
      .from(workflowExecutions)
      .where(and(...conditions))
      .orderBy(desc(workflowExecutions.createdAt))
      .limit(limit)
      .offset(offset),
    db
      .select({ total: count() })
      .from(workflowExecutions)
      .where(and(...conditions)),
  ]);

  return { executions: rows, total: countResult[0]?.total ?? 0 };
}

/** Get a single execution by ID */
export async function getWorkflowExecutionById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db
    .select()
    .from(workflowExecutions)
    .where(eq(workflowExecutions.id, id))
    .limit(1);
  return result[0];
}

/** Update a workflow execution */
export async function updateWorkflowExecution(
  id: number,
  data: Partial<{
    status: string;
    currentStep: number;
    nextStepAt: Date | null;
    errorMessage: string | null;
    completedAt: Date;
  }>
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db
    .update(workflowExecutions)
    .set(data as any)
    .where(eq(workflowExecutions.id, id));
}

/** Get pending executions that are ready to process (nextStepAt <= now) */
export async function getPendingExecutions() {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(workflowExecutions)
    .where(
      and(
        eq(workflowExecutions.status, "running"),
        or(
          sql`${workflowExecutions.nextStepAt} IS NULL`,
          sql`${workflowExecutions.nextStepAt} <= NOW()`
        )
      )
    )
    .orderBy(workflowExecutions.createdAt)
    .limit(50);
}

// ═══════════════════════════════════════════════
// WORKFLOW EXECUTION STEPS
// ═══════════════════════════════════════════════

/** Create an execution step log */
export async function createWorkflowExecutionStep(data: InsertWorkflowExecutionStep) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(workflowExecutionSteps).values(data);
  return { id: Number(result[0].insertId) };
}

/** Update an execution step */
export async function updateWorkflowExecutionStep(
  id: number,
  data: Partial<{
    status: string;
    result: string | null;
    errorMessage: string | null;
    startedAt: Date;
    completedAt: Date;
  }>
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db
    .update(workflowExecutionSteps)
    .set(data as any)
    .where(eq(workflowExecutionSteps.id, id));
}

/** List execution steps for an execution */
export async function listWorkflowExecutionSteps(executionId: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(workflowExecutionSteps)
    .where(eq(workflowExecutionSteps.executionId, executionId))
    .orderBy(workflowExecutionSteps.stepOrder);
}

// ═══════════════════════════════════════════════
// TASKS
// ═══════════════════════════════════════════════

/** Create a task */
export async function createTask(data: InsertTask) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(tasks).values(data);
  return { id: Number(result[0].insertId) };
}

/** List tasks for an account */
export async function listTasks(
  accountId: number,
  opts?: { contactId?: number; status?: string; limit?: number; offset?: number }
) {
  const db = await getDb();
  if (!db) return [];
  const conditions = [eq(tasks.accountId, accountId)];
  if (opts?.contactId) conditions.push(eq(tasks.contactId, opts.contactId));
  if (opts?.status) conditions.push(eq(tasks.status, opts.status as any));

  return db
    .select()
    .from(tasks)
    .where(and(...conditions))
    .orderBy(desc(tasks.createdAt))
    .limit(opts?.limit ?? 50)
    .offset(opts?.offset ?? 0);
}

/** Update a task */
export async function updateTask(
  id: number,
  data: Partial<{
    title: string;
    description: string | null;
    status: string;
    priority: string;
    assignedUserId: number | null;
    dueAt: Date | null;
    completedAt: Date | null;
  }>
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(tasks).set(data as any).where(eq(tasks.id, id));
}

// ─────────────────────────────────────────────
// PIPELINE HELPERS
// ─────────────────────────────────────────────

export const DEFAULT_STAGES = [
  { name: "New Lead", color: "#3b82f6", sortOrder: 0, isWon: false, isLost: false },
  { name: "Contacted", color: "#8b5cf6", sortOrder: 1, isWon: false, isLost: false },
  { name: "Qualified", color: "#f59e0b", sortOrder: 2, isWon: false, isLost: false },
  { name: "Proposal", color: "#ec4899", sortOrder: 3, isWon: false, isLost: false },
  { name: "Closed Won", color: "#10b981", sortOrder: 4, isWon: true, isLost: false },
  { name: "Closed Lost", color: "#ef4444", sortOrder: 5, isWon: false, isLost: true },
];

export async function createPipeline(data: InsertPipeline) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const [result] = await db.insert(pipelines).values(data);
  return { id: result.insertId };
}

export async function createDefaultPipeline(accountId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // Create the pipeline
  const [pipelineResult] = await db.insert(pipelines).values({
    accountId,
    name: "Sales Pipeline",
    isDefault: true,
  });
  const pipelineId = pipelineResult.insertId;

  // Create default stages
  for (const stage of DEFAULT_STAGES) {
    await db.insert(pipelineStages).values({
      pipelineId,
      accountId,
      ...stage,
    });
  }

  return { id: pipelineId };
}

export async function listPipelines(accountId: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(pipelines)
    .where(eq(pipelines.accountId, accountId))
    .orderBy(desc(pipelines.isDefault), asc(pipelines.createdAt));
}

export async function getPipelineById(id: number, accountId: number) {
  const db = await getDb();
  if (!db) return null;
  const rows = await db
    .select()
    .from(pipelines)
    .where(and(eq(pipelines.id, id), eq(pipelines.accountId, accountId)));
  return rows[0] || null;
}

export async function listPipelineStages(pipelineId: number, accountId: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(pipelineStages)
    .where(
      and(
        eq(pipelineStages.pipelineId, pipelineId),
        eq(pipelineStages.accountId, accountId)
      )
    )
    .orderBy(asc(pipelineStages.sortOrder));
}

export async function createDeal(data: InsertDeal) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const [result] = await db.insert(deals).values(data);
  return { id: result.insertId };
}

export async function getDealById(id: number, accountId: number) {
  const db = await getDb();
  if (!db) return null;
  const rows = await db
    .select()
    .from(deals)
    .where(and(eq(deals.id, id), eq(deals.accountId, accountId)));
  return rows[0] || null;
}

export async function getDealByContactId(contactId: number, pipelineId: number, accountId: number) {
  const db = await getDb();
  if (!db) return null;
  const rows = await db
    .select()
    .from(deals)
    .where(
      and(
        eq(deals.contactId, contactId),
        eq(deals.pipelineId, pipelineId),
        eq(deals.accountId, accountId)
      )
    );
  return rows[0] || null;
}

export async function listDeals(pipelineId: number, accountId: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select({
      deal: deals,
      contact: {
        id: contacts.id,
        firstName: contacts.firstName,
        lastName: contacts.lastName,
        email: contacts.email,
        phone: contacts.phone,
        status: contacts.status,
        leadSource: contacts.leadSource,
        company: contacts.company,
      },
    })
    .from(deals)
    .innerJoin(contacts, eq(deals.contactId, contacts.id))
    .where(
      and(
        eq(deals.pipelineId, pipelineId),
        eq(deals.accountId, accountId)
      )
    )
    .orderBy(asc(deals.sortOrder));
}

export async function updateDeal(
  id: number,
  accountId: number,
  data: Partial<Pick<InsertDeal, "stageId" | "title" | "value" | "sortOrder">>
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db
    .update(deals)
    .set(data)
    .where(and(eq(deals.id, id), eq(deals.accountId, accountId)));
}

export async function deleteDeal(id: number, accountId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db
    .delete(deals)
    .where(and(eq(deals.id, id), eq(deals.accountId, accountId)));
}

export async function getDefaultPipeline(accountId: number) {
  const db = await getDb();
  if (!db) return null;
  const rows = await db
    .select()
    .from(pipelines)
    .where(
      and(eq(pipelines.accountId, accountId), eq(pipelines.isDefault, true))
    );
  return rows[0] || null;
}

export async function getOrCreateDefaultPipeline(accountId: number) {
  let pipeline = await getDefaultPipeline(accountId);
  if (!pipeline) {
    const { id } = await createDefaultPipeline(accountId);
    pipeline = await getPipelineById(id, accountId);
  }
  return pipeline!;
}

export async function getPipelineStageById(id: number, accountId: number) {
  const db = await getDb();
  if (!db) return null;
  const rows = await db
    .select()
    .from(pipelineStages)
    .where(and(eq(pipelineStages.id, id), eq(pipelineStages.accountId, accountId)));
  return rows[0] || null;
}

export async function updatePipelineStage(
  id: number,
  accountId: number,
  data: Partial<{ name: string; color: string; sortOrder: number }>
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db
    .update(pipelineStages)
    .set(data)
    .where(and(eq(pipelineStages.id, id), eq(pipelineStages.accountId, accountId)));
}

// ─────────────────────────────────────────────
// Campaign Scheduler Helpers
// ─────────────────────────────────────────────

/**
 * Find all campaigns where status = "scheduled" and scheduledAt <= now.
 * Used by the campaign scheduler background worker.
 */
export async function listScheduledCampaignsReady() {
  const db = await getDb();
  if (!db) return [];
  const rows = await db
    .select()
    .from(campaigns)
    .where(
      and(
        eq(campaigns.status, "scheduled" as any),
        sql`${campaigns.scheduledAt} <= NOW()`
      )
    )
    .orderBy(asc(campaigns.scheduledAt))
    .limit(50);
  return rows;
}

// ─────────────────────────────────────────────
// Facebook Page Mapping Helpers
// ─────────────────────────────────────────────

export async function createFacebookPageMapping(data: InsertFacebookPageMapping) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const [row] = await db.insert(facebookPageMappings).values(data).$returningId();
  return row;
}

export async function getFacebookPageMappingByPageId(facebookPageId: string) {
  const db = await getDb();
  if (!db) return null;
  const rows = await db
    .select()
    .from(facebookPageMappings)
    .where(eq(facebookPageMappings.facebookPageId, facebookPageId))
    .limit(1);
  return rows[0] || null;
}

export async function listFacebookPageMappings(accountId?: number) {
  const db = await getDb();
  if (!db) return [];
  if (accountId) {
    return db
      .select()
      .from(facebookPageMappings)
      .where(eq(facebookPageMappings.accountId, accountId))
      .orderBy(desc(facebookPageMappings.createdAt));
  }
  return db
    .select()
    .from(facebookPageMappings)
    .orderBy(desc(facebookPageMappings.createdAt));
}

export async function deleteFacebookPageMapping(id: number) {
  const db = await getDb();
  if (!db) return;
  await db.delete(facebookPageMappings).where(eq(facebookPageMappings.id, id));
}

export async function updateFacebookPageMapping(
  id: number,
  data: Partial<Omit<InsertFacebookPageMapping, "id">>
) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db
    .update(facebookPageMappings)
    .set(data)
    .where(eq(facebookPageMappings.id, id));
}

// ─────────────────────────────────────────────
// IMPERSONATION AUDIT LOG HELPERS
// ─────────────────────────────────────────────

export async function logImpersonationAction(data: InsertImpersonationAuditLog) {
  const db = await getDb();
  if (!db) return null;
  const [result] = await db.insert(impersonationAuditLogs).values(data).$returningId();
  return result;
}

export async function listImpersonationLogs(limit = 50) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(impersonationAuditLogs)
    .orderBy(desc(impersonationAuditLogs.createdAt))
    .limit(limit);
}

// ─────────────────────────────────────────────
// ACCOUNT MESSAGING SETTINGS HELPERS
// ─────────────────────────────────────────────

import { encrypt, decrypt } from "./utils/encryption";

/** Fields that are encrypted at rest */
const ENCRYPTED_FIELDS = ["twilioAuthToken", "sendgridApiKey"] as const;

/**
 * Safely encrypt a value. Returns the original value if ENCRYPTION_KEY
 * is not set (dev/test environments) so the app degrades gracefully.
 */
function safeEncrypt(value: string | null | undefined): string | null {
  if (!value) return value as null;
  try {
    return encrypt(value);
  } catch (err: any) {
    if (err.message?.includes("ENCRYPTION_KEY")) {
      console.warn("[Encryption] ENCRYPTION_KEY not set — storing value as plain text");
      return value;
    }
    throw err;
  }
}

/**
 * Safely decrypt a value. Returns the original value if ENCRYPTION_KEY
 * is not set or the value doesn't look encrypted (plain-text fallback).
 */
function safeDecrypt(value: string | null | undefined): string | null {
  if (!value) return value as null;
  try {
    return decrypt(value);
  } catch (err: any) {
    if (err.message?.includes("ENCRYPTION_KEY")) {
      console.warn("[Encryption] ENCRYPTION_KEY not set — returning raw value");
      return value;
    }
    // If decryption fails (e.g. value is plain text from before encryption was enabled),
    // return the raw value so existing unencrypted rows still work.
    console.warn("[Encryption] Decryption failed — returning raw value (may be unencrypted)");
    return value;
  }
}

export async function getAccountMessagingSettings(accountId: number) {
  const db = await getDb();
  if (!db) return null;
  const rows = await db
    .select()
    .from(accountMessagingSettings)
    .where(eq(accountMessagingSettings.accountId, accountId))
    .limit(1);
  const row = rows[0] || null;
  if (!row) return null;

  // Decrypt sensitive fields before returning
  return {
    ...row,
    twilioAuthToken: safeDecrypt(row.twilioAuthToken),
    sendgridApiKey: safeDecrypt(row.sendgridApiKey),
  };
}

export async function upsertAccountMessagingSettings(
  accountId: number,
  data: Partial<Omit<InsertAccountMessagingSettings, "id" | "accountId" | "createdAt" | "updatedAt">>
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // Encrypt sensitive fields before writing to DB
  const encryptedData = { ...data };
  if (encryptedData.twilioAuthToken !== undefined) {
    encryptedData.twilioAuthToken = safeEncrypt(encryptedData.twilioAuthToken);
  }
  if (encryptedData.sendgridApiKey !== undefined) {
    encryptedData.sendgridApiKey = safeEncrypt(encryptedData.sendgridApiKey);
  }

  // Use raw getDb query to avoid double-decrypt in the existing check
  const existingRows = await db
    .select({ id: accountMessagingSettings.id })
    .from(accountMessagingSettings)
    .where(eq(accountMessagingSettings.accountId, accountId))
    .limit(1);
  const existing = existingRows[0] || null;

  if (existing) {
    await db
      .update(accountMessagingSettings)
      .set(encryptedData)
      .where(eq(accountMessagingSettings.accountId, accountId));
    return { id: existing.id };
  } else {
    const [result] = await db
      .insert(accountMessagingSettings)
      .values({ accountId, ...encryptedData })
      .$returningId();
    return result;
  }
}

// ─────────────────────────────────────────────
// ACCOUNT INTEGRATIONS HELPERS
// ─────────────────────────────────────────────

export async function getAccountIntegration(accountId: number, provider: string) {
  const db = await getDb();
  if (!db) return null;
  const rows = await db
    .select()
    .from(accountIntegrations)
    .where(
      and(
        eq(accountIntegrations.accountId, accountId),
        eq(accountIntegrations.provider, provider)
      )
    )
    .limit(1);
  return rows[0] || null;
}

export async function upsertAccountIntegration(
  accountId: number,
  provider: string,
  data: Partial<Omit<InsertAccountIntegration, "id" | "accountId" | "provider" | "createdAt" | "updatedAt">>
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const existing = await getAccountIntegration(accountId, provider);
  if (existing) {
    await db
      .update(accountIntegrations)
      .set(data)
      .where(eq(accountIntegrations.id, existing.id));
    return { id: existing.id };
  } else {
    const [result] = await db
      .insert(accountIntegrations)
      .values({ accountId, provider, ...data })
      .$returningId();
    return result;
  }
}

export async function deleteAccountIntegration(accountId: number, provider: string) {
  const db = await getDb();
  if (!db) return;
  await db
    .delete(accountIntegrations)
    .where(
      and(
        eq(accountIntegrations.accountId, accountId),
        eq(accountIntegrations.provider, provider)
      )
    );
}

// ─────────────────────────────────────────────
// ACCOUNT FACEBOOK PAGES HELPERS
// ─────────────────────────────────────────────

export async function listAccountFacebookPages(accountId: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(accountFacebookPages)
    .where(eq(accountFacebookPages.accountId, accountId))
    .orderBy(accountFacebookPages.pageName);
}

export async function upsertAccountFacebookPage(
  accountId: number,
  integrationId: number,
  data: { facebookPageId: string; pageName: string | null; pageAccessToken: string | null }
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const existing = await db
    .select()
    .from(accountFacebookPages)
    .where(
      and(
        eq(accountFacebookPages.accountId, accountId),
        eq(accountFacebookPages.facebookPageId, data.facebookPageId)
      )
    )
    .limit(1);

  if (existing[0]) {
    await db
      .update(accountFacebookPages)
      .set({ pageName: data.pageName, pageAccessToken: data.pageAccessToken })
      .where(eq(accountFacebookPages.id, existing[0].id));
    return { id: existing[0].id };
  } else {
    const [result] = await db
      .insert(accountFacebookPages)
      .values({
        accountId,
        integrationId,
        facebookPageId: data.facebookPageId,
        pageName: data.pageName,
        pageAccessToken: data.pageAccessToken,
      })
      .$returningId();
    return result;
  }
}

export async function deleteAccountFacebookPages(accountId: number) {
  const db = await getDb();
  if (!db) return;
  await db
    .delete(accountFacebookPages)
    .where(eq(accountFacebookPages.accountId, accountId));
}

// ─────────────────────────────────────────────
// Facebook Page lookup by Facebook Page ID (for webhook resolution)
// ─────────────────────────────────────────────

/**
 * Look up an accountFacebookPage row by its Facebook Page ID.
 * Used by the webhook handler to resolve which account a lead belongs to.
 */
export async function getAccountFacebookPageByFbPageId(facebookPageId: string) {
  const db = await getDb();
  if (!db) return null;
  const rows = await db
    .select()
    .from(accountFacebookPages)
    .where(eq(accountFacebookPages.facebookPageId, facebookPageId))
    .limit(1);
  return rows[0] || null;
}

/**
 * Mark a Facebook page as subscribed to leadgen webhooks.
 */
export async function markFacebookPageSubscribed(pageId: number, subscribed: boolean) {
  const db = await getDb();
  if (!db) return;
  await db
    .update(accountFacebookPages)
    .set({ isSubscribed: subscribed })
    .where(eq(accountFacebookPages.id, pageId));
}

// ─────────────────────────────────────────────
// Integration token expiry helpers
// ─────────────────────────────────────────────

/**
 * List all active integrations where the token expires within the given number of days.
 * Used by the token refresh job to send renewal alerts.
 */
export async function listExpiringIntegrations(withinDays: number) {
  const db = await getDb();
  if (!db) return [];
  const cutoff = new Date(Date.now() + withinDays * 24 * 60 * 60 * 1000);
  return db
    .select()
    .from(accountIntegrations)
    .where(
      and(
        eq(accountIntegrations.isActive, true),
        lte(accountIntegrations.tokenExpiresAt, cutoff)
      )
    );
}

// ═══════════════════════════════════════════════
// CALENDAR HELPERS
// ═══════════════════════════════════════════════

/** List all calendars for an account */
export async function getCalendars(accountId: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(calendars)
    .where(eq(calendars.accountId, accountId))
    .orderBy(desc(calendars.createdAt));
}

/** Get a single calendar by ID (scoped to account) */
export async function getCalendar(id: number, accountId: number) {
  const db = await getDb();
  if (!db) return null;
  const rows = await db
    .select()
    .from(calendars)
    .where(and(eq(calendars.id, id), eq(calendars.accountId, accountId)))
    .limit(1);
  return rows[0] || null;
}

/** Get a calendar by its public slug (for booking page) */
export async function getCalendarBySlug(slug: string) {
  const db = await getDb();
  if (!db) return null;
  const rows = await db
    .select()
    .from(calendars)
    .where(and(eq(calendars.slug, slug), eq(calendars.isActive, true)))
    .limit(1);
  return rows[0] || null;
}

/** Create a new calendar */
export async function createCalendar(data: InsertCalendar) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const [result] = await db.insert(calendars).values(data).$returningId();
  return result;
}

/** Update a calendar */
export async function updateCalendar(
  id: number,
  accountId: number,
  data: Partial<Omit<InsertCalendar, "id" | "accountId" | "createdAt" | "updatedAt">>
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db
    .update(calendars)
    .set(data)
    .where(and(eq(calendars.id, id), eq(calendars.accountId, accountId)));
}

/** Delete a calendar */
export async function deleteCalendar(id: number, accountId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db
    .delete(calendars)
    .where(and(eq(calendars.id, id), eq(calendars.accountId, accountId)));
}

// ═══════════════════════════════════════════════
// APPOINTMENT HELPERS
// ═══════════════════════════════════════════════

/** List appointments for an account with optional filters */
export async function getAppointments(
  accountId: number,
  opts?: { calendarId?: number; status?: string; limit?: number; offset?: number; startDate?: Date; endDate?: Date }
) {
  const db = await getDb();
  if (!db) return [];
  const conditions = [eq(appointments.accountId, accountId)];
  if (opts?.calendarId) conditions.push(eq(appointments.calendarId, opts.calendarId));
  if (opts?.status) conditions.push(eq(appointments.status, opts.status as any));
  if (opts?.startDate) {
    conditions.push(gte(appointments.startTime, opts.startDate));
  }
  if (opts?.endDate) {
    conditions.push(lte(appointments.startTime, opts.endDate));
  }

  return db
    .select()
    .from(appointments)
    .where(and(...conditions))
    .orderBy(desc(appointments.startTime))
    .limit(opts?.limit ?? 200)
    .offset(opts?.offset ?? 0);
}

/** Get a single appointment by ID (scoped to account) */
export async function getAppointment(id: number, accountId: number) {
  const db = await getDb();
  if (!db) return null;
  const rows = await db
    .select()
    .from(appointments)
    .where(and(eq(appointments.id, id), eq(appointments.accountId, accountId)))
    .limit(1);
  return rows[0] || null;
}

/** Create a new appointment */
export async function createAppointment(data: InsertAppointment) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const [result] = await db.insert(appointments).values(data).$returningId();
  return result;
}

/** Update an appointment */
export async function updateAppointment(
  id: number,
  accountId: number,
  data: Partial<Omit<InsertAppointment, "id" | "accountId" | "calendarId" | "createdAt" | "updatedAt">>
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db
    .update(appointments)
    .set(data)
    .where(and(eq(appointments.id, id), eq(appointments.accountId, accountId)));
}

/** Cancel an appointment */
export async function cancelAppointment(id: number, accountId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db
    .update(appointments)
    .set({ status: "cancelled" })
    .where(and(eq(appointments.id, id), eq(appointments.accountId, accountId)));
}

/** Get appointments by contact ID */
export async function getAppointmentsByContact(contactId: number, accountId: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(appointments)
    .where(and(eq(appointments.contactId, contactId), eq(appointments.accountId, accountId)))
    .orderBy(desc(appointments.startTime));
}

/**
 * Get available time slots for a calendar on a given date.
 * Checks the calendar's weekly availability JSON and existing appointments.
 */
export async function getAvailableSlots(
  calendarId: number,
  date: string // ISO date string YYYY-MM-DD
) {
  const db = await getDb();
  if (!db) return [];

  // Get the calendar
  const calRows = await db
    .select()
    .from(calendars)
    .where(eq(calendars.id, calendarId))
    .limit(1);
  const calendar = calRows[0];
  if (!calendar || !calendar.isActive) return [];

  // Parse availability JSON
  const availability = calendar.availabilityJson
    ? JSON.parse(calendar.availabilityJson)
    : null;
  if (!availability) return [];

  // Determine day of week
  const dateObj = new Date(date + "T12:00:00Z"); // noon UTC to avoid timezone edge cases
  const dayNames = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
  const dayName = dayNames[dateObj.getUTCDay()];
  const daySlots = availability[dayName];
  if (!daySlots || !Array.isArray(daySlots) || daySlots.length === 0) return [];

  // Get existing appointments for this calendar on this date
  const dayStart = new Date(date + "T00:00:00Z");
  const dayEnd = new Date(date + "T23:59:59Z");
  const existingAppts = await db
    .select()
    .from(appointments)
    .where(
      and(
        eq(appointments.calendarId, calendarId),
        sql`${appointments.startTime} >= ${dayStart}`,
        sql`${appointments.startTime} <= ${dayEnd}`,
        sql`${appointments.status} != 'cancelled'`
      )
    );

  // Generate time slots
  const slotDuration = calendar.slotDurationMinutes;
  const bufferMinutes = calendar.bufferMinutes;
  const slots: { start: string; end: string }[] = [];

  for (const block of daySlots) {
    const [startH, startM] = block.start.split(":").map(Number);
    const [endH, endM] = block.end.split(":").map(Number);
    let currentMinutes = startH * 60 + startM;
    const blockEnd = endH * 60 + endM;

    while (currentMinutes + slotDuration <= blockEnd) {
      const slotStartH = Math.floor(currentMinutes / 60);
      const slotStartM = currentMinutes % 60;
      const slotEndMinutes = currentMinutes + slotDuration;
      const slotEndH = Math.floor(slotEndMinutes / 60);
      const slotEndM = slotEndMinutes % 60;

      const slotStart = `${String(slotStartH).padStart(2, "0")}:${String(slotStartM).padStart(2, "0")}`;
      const slotEnd = `${String(slotEndH).padStart(2, "0")}:${String(slotEndM).padStart(2, "0")}`;

      // Check for conflicts with existing appointments (including buffer)
      const slotStartDate = new Date(`${date}T${slotStart}:00Z`);
      const slotEndDate = new Date(`${date}T${slotEnd}:00Z`);

      const hasConflict = existingAppts.some((appt) => {
        const apptStart = new Date(appt.startTime).getTime() - bufferMinutes * 60 * 1000;
        const apptEnd = new Date(appt.endTime).getTime() + bufferMinutes * 60 * 1000;
        return slotStartDate.getTime() < apptEnd && slotEndDate.getTime() > apptStart;
      });

      if (!hasConflict) {
        slots.push({ start: slotStart, end: slotEnd });
      }

      currentMinutes += slotDuration + bufferMinutes;
    }
  }

  return slots;
}

// ═══════════════════════════════════════════════
// CALENDAR INTEGRATIONS HELPERS (Google/Outlook sync)
// ═══════════════════════════════════════════════

/** Get all calendar integrations for a user within an account */
export async function getCalendarIntegrations(userId: number, accountId: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(calendarIntegrations)
    .where(
      and(
        eq(calendarIntegrations.userId, userId),
        eq(calendarIntegrations.accountId, accountId)
      )
    );
}

/** Get all active calendar integrations for an account (all users) */
export async function getActiveCalendarIntegrations(accountId: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(calendarIntegrations)
    .where(
      and(
        eq(calendarIntegrations.accountId, accountId),
        eq(calendarIntegrations.isActive, true)
      )
    );
}

/** Get a specific calendar integration by ID */
export async function getCalendarIntegration(id: number, userId: number) {
  const db = await getDb();
  if (!db) return null;
  const rows = await db
    .select()
    .from(calendarIntegrations)
    .where(
      and(
        eq(calendarIntegrations.id, id),
        eq(calendarIntegrations.userId, userId)
      )
    )
    .limit(1);
  return rows[0] || null;
}

/** Get a calendar integration by provider for a user in an account */
export async function getCalendarIntegrationByProvider(
  userId: number,
  accountId: number,
  provider: "google" | "outlook"
) {
  const db = await getDb();
  if (!db) return null;
  const rows = await db
    .select()
    .from(calendarIntegrations)
    .where(
      and(
        eq(calendarIntegrations.userId, userId),
        eq(calendarIntegrations.accountId, accountId),
        eq(calendarIntegrations.provider, provider)
      )
    )
    .limit(1);
  return rows[0] || null;
}

/** Create a new calendar integration (tokens encrypted before storage) */
export async function createCalendarIntegration(data: InsertCalendarIntegration) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const encryptedData = {
    ...data,
    accessToken: safeEncrypt(data.accessToken) ?? data.accessToken,
    refreshToken: data.refreshToken ? (safeEncrypt(data.refreshToken) ?? data.refreshToken) : null,
  };
  const [result] = await db.insert(calendarIntegrations).values(encryptedData).$returningId();
  return result;
}

/** Update a calendar integration (re-encrypts tokens) */
export async function updateCalendarIntegration(
  id: number,
  userId: number,
  data: Partial<Pick<InsertCalendarIntegration, "accessToken" | "refreshToken" | "tokenExpiresAt" | "isActive" | "externalCalendarId" | "externalEmail">>
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const updateData: Record<string, unknown> = {};
  if (data.accessToken !== undefined) updateData.accessToken = safeEncrypt(data.accessToken) ?? data.accessToken;
  if (data.refreshToken !== undefined) updateData.refreshToken = data.refreshToken ? (safeEncrypt(data.refreshToken) ?? data.refreshToken) : null;
  if (data.tokenExpiresAt !== undefined) updateData.tokenExpiresAt = data.tokenExpiresAt;
  if (data.isActive !== undefined) updateData.isActive = data.isActive;
  if (data.externalCalendarId !== undefined) updateData.externalCalendarId = data.externalCalendarId;
  if (data.externalEmail !== undefined) updateData.externalEmail = data.externalEmail;
  await db
    .update(calendarIntegrations)
    .set(updateData)
    .where(
      and(
        eq(calendarIntegrations.id, id),
        eq(calendarIntegrations.userId, userId)
      )
    );
}

/** Delete a calendar integration */
export async function deleteCalendarIntegration(id: number, userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db
    .delete(calendarIntegrations)
    .where(
      and(
        eq(calendarIntegrations.id, id),
        eq(calendarIntegrations.userId, userId)
      )
    );
}

/** Decrypt tokens from a calendar integration row */
export function decryptCalendarTokens(integration: {
  accessToken: string;
  refreshToken: string | null;
}) {
  return {
    accessToken: safeDecrypt(integration.accessToken) ?? integration.accessToken,
    refreshToken: integration.refreshToken
      ? (safeDecrypt(integration.refreshToken) ?? integration.refreshToken)
      : null,
  };
}


// ═══════════════════════════════════════════
// CONTACT ACTIVITIES
// ═══════════════════════════════════════════

/** Create a contact activity record (non-blocking, fire-and-forget safe) */
export async function createContactActivity(data: InsertContactActivity) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const [result] = await db.insert(contactActivities).values(data).$returningId();
  return result;
}

/** Get paginated contact activities in reverse chronological order */
export async function getContactActivities(
  contactId: number,
  accountId: number,
  opts: { limit?: number; offset?: number } = {}
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const limit = opts.limit ?? 20;
  const offset = opts.offset ?? 0;

  const rows = await db
    .select()
    .from(contactActivities)
    .where(
      and(
        eq(contactActivities.contactId, contactId),
        eq(contactActivities.accountId, accountId)
      )
    )
    .orderBy(desc(contactActivities.createdAt))
    .limit(limit + 1)
    .offset(offset);

  const hasMore = rows.length > limit;
  const items = hasMore ? rows.slice(0, limit) : rows;

  return { items, hasMore };
}

/** Fire-and-forget activity logger — swallows errors to avoid breaking main flows */
export function logContactActivity(data: InsertContactActivity) {
  createContactActivity(data).catch((err) =>
    console.error("[Activity] Failed to log activity:", err)
  );
}


// ─────────────────────────────────────────────
// Email Templates
// ─────────────────────────────────────────────

export async function createEmailTemplate(data: InsertEmailTemplate) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const [result] = await db.insert(emailTemplates).values(data);
  return { id: (result as any).insertId as number };
}

export async function listEmailTemplates(accountId: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(emailTemplates)
    .where(eq(emailTemplates.accountId, accountId))
    .orderBy(desc(emailTemplates.updatedAt));
}

export async function getEmailTemplate(id: number) {
  const db = await getDb();
  if (!db) return null;
  const rows = await db
    .select()
    .from(emailTemplates)
    .where(eq(emailTemplates.id, id))
    .limit(1);
  return rows[0] ?? null;
}

export async function updateEmailTemplate(
  id: number,
  data: Partial<Omit<InsertEmailTemplate, "id" | "accountId" | "createdAt">>
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db
    .update(emailTemplates)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(emailTemplates.id, id));
}

export async function deleteEmailTemplate(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(emailTemplates).where(eq(emailTemplates.id, id));
}


// ─────────────────────────────────────────────
// NOTIFICATION HELPERS
// ─────────────────────────────────────────────

export async function createNotification(data: Omit<InsertNotification, "id" | "createdAt" | "isRead" | "dismissed">) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(notifications).values(data);
  return { id: Number(result[0].insertId) };
}

/**
 * Get notifications for a user within an account.
 * Returns notifications targeted to the specific user OR account-wide (userId=null).
 */
export async function getNotifications(accountId: number, userId: number, limit = 20) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(notifications)
    .where(
      and(
        eq(notifications.accountId, accountId),
        eq(notifications.dismissed, false),
        or(
          eq(notifications.userId, userId),
          sql`${notifications.userId} IS NULL`
        )
      )
    )
    .orderBy(desc(notifications.createdAt))
    .limit(limit);
}

/**
 * Get unread notification count for a user within an account.
 */
export async function getUnreadNotificationCount(accountId: number, userId: number) {
  const db = await getDb();
  if (!db) return 0;
  const result = await db
    .select({ count: count() })
    .from(notifications)
    .where(
      and(
        eq(notifications.accountId, accountId),
        eq(notifications.isRead, false),
        eq(notifications.dismissed, false),
        or(
          eq(notifications.userId, userId),
          sql`${notifications.userId} IS NULL`
        )
      )
    );
  return result[0]?.count ?? 0;
}

export async function markNotificationAsRead(id: number, accountId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db
    .update(notifications)
    .set({ isRead: true })
    .where(and(eq(notifications.id, id), eq(notifications.accountId, accountId)));
}

export async function markAllNotificationsAsRead(accountId: number, userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db
    .update(notifications)
    .set({ isRead: true })
    .where(
      and(
        eq(notifications.accountId, accountId),
        eq(notifications.isRead, false),
        or(
          eq(notifications.userId, userId),
          sql`${notifications.userId} IS NULL`
        )
      )
    );
}

export async function dismissNotification(id: number, accountId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db
    .update(notifications)
    .set({ dismissed: true })
    .where(and(eq(notifications.id, id), eq(notifications.accountId, accountId)));
}


// ─────────────────────────────────────────────
// Port Requests
// ─────────────────────────────────────────────

export async function createPortRequest(data: InsertPortRequest) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(portRequests).values(data);
  return { id: result[0].insertId };
}

export async function getPortRequestsByAccount(accountId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db
    .select()
    .from(portRequests)
    .where(eq(portRequests.accountId, accountId))
    .orderBy(desc(portRequests.createdAt));
}

export async function getPortRequestById(id: number, accountId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const rows = await db
    .select()
    .from(portRequests)
    .where(and(eq(portRequests.id, id), eq(portRequests.accountId, accountId)));
  return rows[0] ?? null;
}

export async function updatePortRequest(
  id: number,
  accountId: number,
  data: Partial<InsertPortRequest>
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db
    .update(portRequests)
    .set(data)
    .where(and(eq(portRequests.id, id), eq(portRequests.accountId, accountId)));
}

/**
 * Get all port requests that are still active (submitted or in_progress).
 * Used by the port request poller to check for status updates.
 */
export async function getActivePortRequests() {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db
    .select()
    .from(portRequests)
    .where(
      or(
        eq(portRequests.status, "submitted"),
        eq(portRequests.status, "in_progress")
      )
    )
    .orderBy(asc(portRequests.createdAt));
}


// ─────────────────────────────────────────────
// CALENDAR WATCHES
// ─────────────────────────────────────────────

export async function createCalendarWatch(data: InsertCalendarWatch) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const [result] = await db.insert(calendarWatches).values(data).$returningId();
  return { id: result.id, ...data };
}

export async function getCalendarWatchByIntegration(integrationId: number) {
  const db = await getDb();
  if (!db) return null;
  const rows = await db
    .select()
    .from(calendarWatches)
    .where(eq(calendarWatches.integrationId, integrationId))
    .limit(1);
  return rows[0] ?? null;
}

export async function getCalendarWatchByWatchId(watchId: string) {
  const db = await getDb();
  if (!db) return null;
  const rows = await db
    .select()
    .from(calendarWatches)
    .where(eq(calendarWatches.watchId, watchId))
    .limit(1);
  return rows[0] ?? null;
}

export async function getExpiringCalendarWatches(beforeDate: Date) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(calendarWatches)
    .where(lte(calendarWatches.expiresAt, beforeDate));
}

export async function updateCalendarWatch(
  id: number,
  data: Partial<Pick<InsertCalendarWatch, "watchId" | "resourceId" | "channelToken" | "expiresAt">>
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(calendarWatches).set(data).where(eq(calendarWatches.id, id));
}

export async function deleteCalendarWatch(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(calendarWatches).where(eq(calendarWatches.id, id));
}

export async function deleteCalendarWatchByIntegration(integrationId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(calendarWatches).where(eq(calendarWatches.integrationId, integrationId));
}

// ─────────────────────────────────────────────
// EXTERNAL CALENDAR EVENTS (cache)
// ─────────────────────────────────────────────

export async function upsertExternalCalendarEvent(data: InsertExternalCalendarEvent) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  // Check if event already exists
  const existing = await db
    .select()
    .from(externalCalendarEvents)
    .where(
      and(
        eq(externalCalendarEvents.userId, data.userId),
        eq(externalCalendarEvents.accountId, data.accountId),
        eq(externalCalendarEvents.provider, data.provider),
        eq(externalCalendarEvents.externalEventId, data.externalEventId)
      )
    )
    .limit(1);

  if (existing.length > 0) {
    // Update existing
    await db
      .update(externalCalendarEvents)
      .set({
        title: data.title,
        startTime: data.startTime,
        endTime: data.endTime,
        allDay: data.allDay,
        status: data.status,
        syncedAt: new Date(),
      })
      .where(eq(externalCalendarEvents.id, existing[0].id));
    return { id: existing[0].id, updated: true };
  } else {
    // Insert new
    const [result] = await db.insert(externalCalendarEvents).values(data).$returningId();
    return { id: result.id, updated: false };
  }
}

export async function deleteExternalCalendarEvent(
  userId: number,
  accountId: number,
  provider: "google" | "outlook",
  externalEventId: string
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db
    .delete(externalCalendarEvents)
    .where(
      and(
        eq(externalCalendarEvents.userId, userId),
        eq(externalCalendarEvents.accountId, accountId),
        eq(externalCalendarEvents.provider, provider),
        eq(externalCalendarEvents.externalEventId, externalEventId)
      )
    );
}

export async function getExternalCalendarEvents(
  userId: number,
  accountId: number,
  timeMin: Date,
  timeMax: Date
) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(externalCalendarEvents)
    .where(
      and(
        eq(externalCalendarEvents.userId, userId),
        eq(externalCalendarEvents.accountId, accountId),
        gte(externalCalendarEvents.startTime, timeMin),
        lte(externalCalendarEvents.endTime, timeMax),
        sql`${externalCalendarEvents.status} != 'cancelled'`
      )
    )
    .orderBy(asc(externalCalendarEvents.startTime));
}

export async function deleteExternalCalendarEventsByUser(userId: number, accountId: number, provider: "google" | "outlook") {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db
    .delete(externalCalendarEvents)
    .where(
      and(
        eq(externalCalendarEvents.userId, userId),
        eq(externalCalendarEvents.accountId, accountId),
        eq(externalCalendarEvents.provider, provider)
      )
    );
}

// Get external calendar events by account (all users) for conflict checking
export async function getExternalCalendarEventsByAccount(
  accountId: number,
  timeMin: Date,
  timeMax: Date
) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(externalCalendarEvents)
    .where(
      and(
        eq(externalCalendarEvents.accountId, accountId),
        sql`${externalCalendarEvents.status} != 'cancelled'`,
        // Include events that overlap with the time range (not just start within it)
        sql`${externalCalendarEvents.startTime} < ${timeMax}`,
        sql`${externalCalendarEvents.endTime} > ${timeMin}`
      )
    )
    .orderBy(asc(externalCalendarEvents.startTime));
}
