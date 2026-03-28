import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { requireAccountMember } from "./contacts";
import { getDb } from "../db";
import { outboundWebhooks } from "../../drizzle/schema";
import { eq, and, desc } from "drizzle-orm";
import {
  generateWebhookSecret,
  testWebhook,
} from "../services/webhookDispatcher";

const triggerEventEnum = z.enum([
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
]);

export const webhooksRouter = router({
  // ─── List all outbound webhooks for an account ──────────────
  list: protectedProcedure
    .input(z.object({ accountId: z.number() }))
    .query(async ({ ctx, input }) => {
      await requireAccountMember(ctx.user.id, input.accountId, ctx.user.role);
      const db = await getDb();
      if (!db) return [];
      const rows = await db
        .select({
          id: outboundWebhooks.id,
          accountId: outboundWebhooks.accountId,
          name: outboundWebhooks.name,
          triggerEvent: outboundWebhooks.triggerEvent,
          url: outboundWebhooks.url,
          secret: outboundWebhooks.secret,
          isActive: outboundWebhooks.isActive,
          description: outboundWebhooks.description,
          lastTriggeredAt: outboundWebhooks.lastTriggeredAt,
          failCount: outboundWebhooks.failCount,
          createdAt: outboundWebhooks.createdAt,
          updatedAt: outboundWebhooks.updatedAt,
        })
        .from(outboundWebhooks)
        .where(eq(outboundWebhooks.accountId, input.accountId))
        .orderBy(desc(outboundWebhooks.createdAt));
      return rows;
    }),

  // ─── Create a new outbound webhook ──────────────────────────
  create: protectedProcedure
    .input(
      z.object({
        accountId: z.number(),
        name: z.string().min(1).max(255),
        triggerEvent: triggerEventEnum,
        url: z.string().url(),
        description: z.string().max(500).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await requireAccountMember(ctx.user.id, input.accountId, ctx.user.role);
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");
      const secret = generateWebhookSecret();
      const [result] = await db.insert(outboundWebhooks).values({
        accountId: input.accountId,
        name: input.name,
        triggerEvent: input.triggerEvent,
        url: input.url,
        secret,
        description: input.description || null,
        isActive: true,
        failCount: 0,
      });
      return { id: result.insertId, secret };
    }),

  // ─── Update an existing webhook ─────────────────────────────
  update: protectedProcedure
    .input(
      z.object({
        accountId: z.number(),
        webhookId: z.number(),
        name: z.string().min(1).max(255).optional(),
        triggerEvent: triggerEventEnum.optional(),
        url: z.string().url().optional(),
        description: z.string().max(500).optional(),
        isActive: z.boolean().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await requireAccountMember(ctx.user.id, input.accountId, ctx.user.role);
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");

      const updates: Record<string, unknown> = {};
      if (input.name !== undefined) updates.name = input.name;
      if (input.triggerEvent !== undefined) updates.triggerEvent = input.triggerEvent;
      if (input.url !== undefined) updates.url = input.url;
      if (input.description !== undefined) updates.description = input.description;
      if (input.isActive !== undefined) {
        updates.isActive = input.isActive;
        // Reset fail count when re-enabling
        if (input.isActive) updates.failCount = 0;
      }

      if (Object.keys(updates).length === 0) return { success: true };

      await db
        .update(outboundWebhooks)
        .set(updates)
        .where(
          and(
            eq(outboundWebhooks.id, input.webhookId),
            eq(outboundWebhooks.accountId, input.accountId)
          )
        );
      return { success: true };
    }),

  // ─── Delete a webhook ───────────────────────────────────────
  delete: protectedProcedure
    .input(
      z.object({
        accountId: z.number(),
        webhookId: z.number(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await requireAccountMember(ctx.user.id, input.accountId, ctx.user.role);
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");
      await db
        .delete(outboundWebhooks)
        .where(
          and(
            eq(outboundWebhooks.id, input.webhookId),
            eq(outboundWebhooks.accountId, input.accountId)
          )
        );
      return { success: true };
    }),

  // ─── Regenerate the signing secret ──────────────────────────
  regenerateSecret: protectedProcedure
    .input(
      z.object({
        accountId: z.number(),
        webhookId: z.number(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await requireAccountMember(ctx.user.id, input.accountId, ctx.user.role);
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");
      const newSecret = generateWebhookSecret();
      await db
        .update(outboundWebhooks)
        .set({ secret: newSecret })
        .where(
          and(
            eq(outboundWebhooks.id, input.webhookId),
            eq(outboundWebhooks.accountId, input.accountId)
          )
        );
      return { secret: newSecret };
    }),

  // ─── Test / ping a webhook ──────────────────────────────────
  test: protectedProcedure
    .input(
      z.object({
        accountId: z.number(),
        webhookId: z.number(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await requireAccountMember(ctx.user.id, input.accountId, ctx.user.role);
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");
      const [webhook] = await db
        .select()
        .from(outboundWebhooks)
        .where(
          and(
            eq(outboundWebhooks.id, input.webhookId),
            eq(outboundWebhooks.accountId, input.accountId)
          )
        );
      if (!webhook) throw new Error("Webhook not found");
      const result = await testWebhook(webhook.url, webhook.secret);
      return result;
    }),
});
