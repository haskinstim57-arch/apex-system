import { and, eq, desc, asc, sql, inArray, count } from "drizzle-orm";
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

  // Auto-add the owner as a member with "owner" role
  await db.insert(accountMembers).values({
    accountId: insertId,
    userId: data.ownerId,
    role: "owner",
    isActive: true,
  });

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

  const memberships = await db
    .select({ accountId: accountMembers.accountId })
    .from(accountMembers)
    .where(
      and(eq(accountMembers.userId, userId), eq(accountMembers.isActive, true))
    );

  if (memberships.length === 0) return [];

  const accountIds = memberships.map((m) => m.accountId);
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
    .where(inArray(accounts.id, accountIds))
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

const DEFAULT_STAGES = [
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
