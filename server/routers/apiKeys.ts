import { z } from "zod";
import crypto from "crypto";
import { protectedProcedure, router } from "../_core/trpc";
import { requireAccountMember } from "./contacts";
import { getDb } from "../db";
import { apiKeys, inboundRequestLogs } from "../../drizzle/schema";
import { eq, and, desc, isNull } from "drizzle-orm";

/**
 * Generate a random API key with prefix "ak_" + 40 hex chars.
 * Returns { fullKey, keyHash, keyPrefix }.
 */
export function generateApiKey(): { fullKey: string; keyHash: string; keyPrefix: string } {
  const rawKey = crypto.randomBytes(20).toString("hex"); // 40 hex chars
  const fullKey = `ak_${rawKey}`;
  const keyHash = crypto.createHash("sha256").update(fullKey).digest("hex");
  const keyPrefix = fullKey.slice(0, 11); // "ak_" + first 8 hex chars
  return { fullKey, keyHash, keyPrefix };
}

/**
 * Hash an API key for lookup.
 */
export function hashApiKey(key: string): string {
  return crypto.createHash("sha256").update(key).digest("hex");
}

export const apiKeysRouter = router({
  // ─── List all API keys for an account ──────────────────────
  list: protectedProcedure
    .input(z.object({ accountId: z.number() }))
    .query(async ({ ctx, input }) => {
      await requireAccountMember(ctx.user.id, input.accountId, ctx.user.role);
      const db = await getDb();
      if (!db) return [];
      return db
        .select({
          id: apiKeys.id,
          accountId: apiKeys.accountId,
          name: apiKeys.name,
          keyPrefix: apiKeys.keyPrefix,
          permissions: apiKeys.permissions,
          lastUsedAt: apiKeys.lastUsedAt,
          createdAt: apiKeys.createdAt,
          revokedAt: apiKeys.revokedAt,
        })
        .from(apiKeys)
        .where(eq(apiKeys.accountId, input.accountId))
        .orderBy(desc(apiKeys.createdAt));
    }),

  // ─── Create a new API key ──────────────────────────────────
  create: protectedProcedure
    .input(
      z.object({
        accountId: z.number(),
        name: z.string().min(1).max(255),
        permissions: z.array(z.string()).min(1),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await requireAccountMember(ctx.user.id, input.accountId, ctx.user.role);
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");

      const { fullKey, keyHash, keyPrefix } = generateApiKey();

      const [result] = await db.insert(apiKeys).values({
        accountId: input.accountId,
        name: input.name,
        keyHash,
        keyPrefix,
        permissions: input.permissions,
      });

      // Return the full key ONCE — it will never be shown again
      return {
        id: result.insertId,
        fullKey,
        keyPrefix,
        name: input.name,
        permissions: input.permissions,
      };
    }),

  // ─── Revoke an API key ─────────────────────────────────────
  revoke: protectedProcedure
    .input(
      z.object({
        accountId: z.number(),
        keyId: z.number(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await requireAccountMember(ctx.user.id, input.accountId, ctx.user.role);
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");

      await db
        .update(apiKeys)
        .set({ revokedAt: new Date() })
        .where(
          and(
            eq(apiKeys.id, input.keyId),
            eq(apiKeys.accountId, input.accountId)
          )
        );
      return { success: true };
    }),

  // ─── List inbound request logs ─────────────────────────────
  inboundLogs: protectedProcedure
    .input(
      z.object({
        accountId: z.number(),
        page: z.number().min(1).default(1),
        limit: z.number().min(1).max(100).default(20),
      })
    )
    .query(async ({ ctx, input }) => {
      await requireAccountMember(ctx.user.id, input.accountId, ctx.user.role);
      const db = await getDb();
      if (!db) return { logs: [], total: 0 };

      const logs = await db
        .select()
        .from(inboundRequestLogs)
        .where(eq(inboundRequestLogs.accountId, input.accountId))
        .orderBy(desc(inboundRequestLogs.createdAt))
        .limit(input.limit)
        .offset((input.page - 1) * input.limit);

      const allForCount = await db
        .select({ id: inboundRequestLogs.id })
        .from(inboundRequestLogs)
        .where(eq(inboundRequestLogs.accountId, input.accountId));

      return { logs, total: allForCount.length };
    }),
});
