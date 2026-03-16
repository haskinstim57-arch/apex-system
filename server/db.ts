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

    const textFields = ["name", "email", "loginMethod"] as const;
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
