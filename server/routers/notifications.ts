import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { TRPCError } from "@trpc/server";
import {
  getNotifications,
  getNotificationLog,
  getUnreadNotificationCount,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  dismissNotification,
  getMember,
} from "../db";
import { savePushSubscription, removePushSubscription, generateVAPIDKeyPair, isVapidConfigured, sendPushNotificationToAccountDirect } from "../services/webPush";
import { ENV } from "../_core/env";
import { pushSubscriptions } from "../../drizzle/schema";
import { eq, and } from "drizzle-orm";
import { getDb } from "../db";
import { parseNotificationPreferences, DEFAULT_NOTIFICATION_PREFERENCES } from "../services/pushBatcher";

async function requireAccountMember(userId: number, accountId: number, userRole?: string) {
  if (userRole === "admin") {
    const member = await getMember(accountId, userId);
    if (member) return member;
    return { userId, accountId, role: "owner" as const, isActive: true };
  }
  const member = await getMember(accountId, userId);
  if (!member || !member.isActive) {
    throw new TRPCError({ code: "FORBIDDEN", message: "You do not have access to this account" });
  }
  return member;
}

export const notificationsRouter = router({
  /** Paginated notification log with filtering */
  log: protectedProcedure
    .input(
      z.object({
        accountId: z.number().int().positive(),
        page: z.number().int().min(1).optional().default(1),
        pageSize: z.number().int().min(1).max(100).optional().default(25),
        type: z.string().optional(),
        isRead: z.boolean().optional(),
        startDate: z.string().optional(),
        endDate: z.string().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      await requireAccountMember(ctx.user.id, input.accountId, ctx.user.role);
      const result = await getNotificationLog(input.accountId, ctx.user.id, {
        page: input.page,
        pageSize: input.pageSize,
        type: input.type,
        isRead: input.isRead,
        startDate: input.startDate ? new Date(input.startDate) : undefined,
        endDate: input.endDate ? new Date(input.endDate) : undefined,
      });
      return {
        items: result.items,
        total: result.total,
        page: input.page,
        pageSize: input.pageSize,
        totalPages: Math.ceil(result.total / input.pageSize),
      };
    }),

  /** List the last N notifications for the current user in an account */
  list: protectedProcedure
    .input(
      z.object({
        accountId: z.number().int().positive(),
        limit: z.number().int().min(1).max(50).optional().default(20),
      })
    )
    .query(async ({ ctx, input }) => {
      await requireAccountMember(ctx.user.id, input.accountId, ctx.user.role);
      const items = await getNotifications(input.accountId, ctx.user.id, input.limit);
      return items;
    }),

  /** Get unread notification count */
  unreadCount: protectedProcedure
    .input(z.object({ accountId: z.number().int().positive() }))
    .query(async ({ ctx, input }) => {
      await requireAccountMember(ctx.user.id, input.accountId, ctx.user.role);
      const count = await getUnreadNotificationCount(input.accountId, ctx.user.id);
      return { count };
    }),

  /** Mark a single notification as read */
  markAsRead: protectedProcedure
    .input(
      z.object({
        id: z.number().int().positive(),
        accountId: z.number().int().positive(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await requireAccountMember(ctx.user.id, input.accountId, ctx.user.role);
      await markNotificationAsRead(input.id, input.accountId);
      return { success: true };
    }),

  /** Mark all notifications as read for the current user in an account */
  markAllAsRead: protectedProcedure
    .input(z.object({ accountId: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      await requireAccountMember(ctx.user.id, input.accountId, ctx.user.role);
      await markAllNotificationsAsRead(input.accountId, ctx.user.id);
      return { success: true };
    }),

  /** Dismiss (hide) a single notification */
  dismiss: protectedProcedure
    .input(
      z.object({
        id: z.number().int().positive(),
        accountId: z.number().int().positive(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await requireAccountMember(ctx.user.id, input.accountId, ctx.user.role);
      await dismissNotification(input.id, input.accountId);
      return { success: true };
    }),

  /** Get the VAPID public key for push subscription */
  getVapidPublicKey: protectedProcedure.query(() => {
    return { publicKey: ENV.vapidPublicKey };
  }),

  /** Subscribe to push notifications */
  subscribePush: protectedProcedure
    .input(
      z.object({
        accountId: z.number().int().positive(),
        subscription: z.object({
          endpoint: z.string().url(),
          keys: z.object({
            p256dh: z.string().min(1),
            auth: z.string().min(1),
          }),
        }),
        userAgent: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await requireAccountMember(ctx.user.id, input.accountId, ctx.user.role);
      const id = await savePushSubscription(
        ctx.user.id,
        input.accountId,
        input.subscription,
        input.userAgent
      );
      return { success: true, subscriptionId: id };
    }),

  /** Unsubscribe from push notifications */
  unsubscribePush: protectedProcedure
    .input(
      z.object({
        endpoint: z.string().url(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await removePushSubscription(ctx.user.id, input.endpoint);
      return { success: true };
    }),

  /** Get notification preferences for the current user's push subscriptions in an account */
  getPreferences: protectedProcedure
    .input(z.object({ accountId: z.number().int().positive() }))
    .query(async ({ ctx, input }) => {
      await requireAccountMember(ctx.user.id, input.accountId, ctx.user.role);
      const db = await getDb();
      if (!db) return { preferences: DEFAULT_NOTIFICATION_PREFERENCES, hasSubscription: false };

      const subs = await db
        .select()
        .from(pushSubscriptions)
        .where(
          and(
            eq(pushSubscriptions.userId, ctx.user.id),
            eq(pushSubscriptions.accountId, input.accountId)
          )
        )
        .limit(1);

      if (subs.length === 0) {
        return { preferences: DEFAULT_NOTIFICATION_PREFERENCES, hasSubscription: false };
      }

      return {
        preferences: parseNotificationPreferences(subs[0].notificationPreferences),
        hasSubscription: true,
      };
    }),

  /** Admin-only: Generate a new VAPID key pair for push notification configuration */
  generateVapidKeys: protectedProcedure
    .mutation(async ({ ctx }) => {
      if (ctx.user.role !== "admin") {
        throw new TRPCError({ code: "FORBIDDEN", message: "Admin access required" });
      }
      const keys = generateVAPIDKeyPair();
      return {
        publicKey: keys.publicKey,
        privateKey: keys.privateKey,
        instructions: [
          "Set these as environment variables in your deployment:",
          `VAPID_PUBLIC_KEY=${keys.publicKey}`,
          `VAPID_PRIVATE_KEY=${keys.privateKey}`,
          "VAPID_SUBJECT=mailto:admin@yourdomain.com",
          "",
          "After setting these, restart the server for push notifications to work.",
        ].join("\n"),
      };
    }),

  /** Admin-only: Test push notification delivery for a specific account */
  testPushNotification: protectedProcedure
    .input(z.object({ accountId: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin") {
        throw new TRPCError({ code: "FORBIDDEN", message: "Admin access required" });
      }

      const vapidReady = isVapidConfigured();

      // Count subscriptions for this account
      const db = await getDb();
      let subscriptionCount = 0;
      if (db) {
        const subs = await db
          .select()
          .from(pushSubscriptions)
          .where(eq(pushSubscriptions.accountId, input.accountId));
        subscriptionCount = subs.length;
      }

      if (!vapidReady) {
        return {
          sent: 0,
          failed: 0,
          vapidConfigured: false,
          subscriptionCount,
          message: "VAPID keys are not configured. Push notifications are disabled. Use generateVapidKeys to create a key pair, then set VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, and VAPID_SUBJECT as environment variables.",
        };
      }

      if (subscriptionCount === 0) {
        return {
          sent: 0,
          failed: 0,
          vapidConfigured: true,
          subscriptionCount: 0,
          message: "No push subscriptions found for this account. Users need to enable push notifications in their browser first.",
        };
      }

      // Send a test push notification
      const result = await sendPushNotificationToAccountDirect(input.accountId, {
        title: "\uD83D\uDD14 Push Notification Test",
        body: "If you see this, push notifications are working correctly!",
        url: "/settings",
        tag: "test-push",
      });

      console.log(`[WebPush] Test push for account ${input.accountId}: sent=${result.sent} failed=${result.failed} subscriptions=${subscriptionCount}`);

      return {
        sent: result.sent,
        failed: result.failed,
        vapidConfigured: true,
        subscriptionCount,
        message: result.sent > 0
          ? `Successfully sent test push to ${result.sent} subscription(s).`
          : `Failed to deliver to any of ${subscriptionCount} subscription(s). Check if subscriptions are still valid.`,
      };
    }),

  /** Update notification preferences for all of the current user's push subscriptions in an account */
  updatePreferences: protectedProcedure
    .input(
      z.object({
        accountId: z.number().int().positive(),
        preferences: z.object({
          inbound_sms: z.boolean(),
          inbound_email: z.boolean(),
          appointment_booked: z.boolean(),
          ai_call_completed: z.boolean(),
          facebook_lead: z.boolean(),
          quiet_hours_enabled: z.boolean(),
          quiet_hours_start: z.string().regex(/^\d{2}:\d{2}$/),
          quiet_hours_end: z.string().regex(/^\d{2}:\d{2}$/),
          quiet_hours_timezone: z.string().min(1),
        }),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await requireAccountMember(ctx.user.id, input.accountId, ctx.user.role);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

      const prefsJson = JSON.stringify(input.preferences);

      // Update all subscriptions for this user in this account
      await db
        .update(pushSubscriptions)
        .set({ notificationPreferences: prefsJson })
        .where(
          and(
            eq(pushSubscriptions.userId, ctx.user.id),
            eq(pushSubscriptions.accountId, input.accountId)
          )
        );

      return { success: true };
    }),
});
