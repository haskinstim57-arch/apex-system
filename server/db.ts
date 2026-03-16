import { and, eq, desc, sql, inArray } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import {
  InsertUser,
  users,
  accounts,
  accountMembers,
  invitations,
  auditLogs,
  type InsertAccount,
  type InsertAccountMember,
  type InsertInvitation,
  type InsertAuditLog,
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
