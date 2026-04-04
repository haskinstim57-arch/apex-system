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
import { pushSubscriptions, users } from "../../drizzle/schema";
import { eq, and, count, sql } from "drizzle-orm";
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

  /** Admin-only: Test SMS notification delivery for a specific account */
  testSmsNotification: protectedProcedure
    .input(z.object({ accountId: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin") {
        throw new TRPCError({ code: "FORBIDDEN", message: "Admin access required" });
      }

      const { dispatchSMS } = await import("../services/messaging");

      // Get the account phone number
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

      const { accounts } = await import("../../drizzle/schema");
      const [account] = await db
        .select({ phone: accounts.phone, name: accounts.name })
        .from(accounts)
        .where(eq(accounts.id, input.accountId))
        .limit(1);

      if (!account?.phone) {
        return {
          success: false,
          message: `No phone number configured for account "${account?.name || input.accountId}". Set a phone number in the account settings first.`,
        };
      }

      try {
        const result = await dispatchSMS({
          to: account.phone,
          body: `\uD83D\uDD14 SMS Notification Test\nIf you receive this, SMS notifications are working correctly for ${account.name || "your account"}!\n\nSent from Apex System`,
          accountId: input.accountId,
          skipDndCheck: true,
        });

        console.log(`[WebPush] Test SMS for account ${input.accountId}: success=${result.success} provider=${result.provider}`);

        if (result.success) {
          return {
            success: true,
            message: `Test SMS sent successfully to ${account.phone} via ${result.provider}.`,
            phone: account.phone,
            provider: result.provider,
          };
        } else {
          return {
            success: false,
            message: `Failed to send test SMS to ${account.phone}: ${result.error}`,
            phone: account.phone,
            provider: result.provider,
          };
        }
      } catch (err: any) {
        console.error(`[WebPush] Test SMS error for account ${input.accountId}:`, err);
        return {
          success: false,
          message: `Error sending test SMS: ${err.message || "Unknown error"}`,
        };
      }
    }),

  /** Admin-only: Test email notification delivery for a specific account */
  testEmailNotification: protectedProcedure
    .input(z.object({ accountId: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin") {
        throw new TRPCError({ code: "FORBIDDEN", message: "Admin access required" });
      }

      const { dispatchEmail } = await import("../services/messaging");

      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

      const { accounts } = await import("../../drizzle/schema");
      const [account] = await db
        .select({ email: accounts.email, name: accounts.name })
        .from(accounts)
        .where(eq(accounts.id, input.accountId))
        .limit(1);

      if (!account?.email) {
        return {
          success: false,
          message: `No email address configured for account "${account?.name || input.accountId}". Set an email address in the account settings first.`,
        };
      }

      try {
        const result = await dispatchEmail({
          to: account.email,
          subject: "\uD83D\uDD14 Email Notification Test — Apex System",
          body: `<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
            <div style="background: linear-gradient(135deg, #3B82F6, #8B5CF6); border-radius: 12px; padding: 24px; text-align: center; margin-bottom: 16px;">
              <h1 style="color: white; margin: 0; font-size: 20px;">\uD83D\uDD14 Email Notification Test</h1>
            </div>
            <div style="background: #F9FAFB; border-radius: 8px; padding: 16px; border: 1px solid #E5E7EB;">
              <p style="margin: 0 0 8px 0; color: #374151;">If you receive this email, email notifications are working correctly for <strong>${account.name || "your account"}</strong>.</p>
              <p style="margin: 0; color: #6B7280; font-size: 13px;">Sent from Apex System</p>
            </div>
          </div>`,
          accountId: input.accountId,
        });

        console.log(`[Notifications] Test email for account ${input.accountId}: success=${result.success} provider=${result.provider}`);

        if (result.success) {
          return {
            success: true,
            message: `Test email sent successfully to ${account.email} via ${result.provider}.`,
            email: account.email,
            provider: result.provider,
          };
        } else {
          return {
            success: false,
            message: `Failed to send test email to ${account.email}: ${result.error}`,
            email: account.email,
            provider: result.provider,
          };
        }
      } catch (err: any) {
        console.error(`[Notifications] Test email error for account ${input.accountId}:`, err);
        return {
          success: false,
          message: `Error sending test email: ${err.message || "Unknown error"}`,
        };
      }
    }),

  /** Admin-only: Clear all push subscriptions for a specific account */
  clearSubscriptions: protectedProcedure
    .input(z.object({ accountId: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin") {
        throw new TRPCError({ code: "FORBIDDEN", message: "Admin access required" });
      }

      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

      const result = await db
        .delete(pushSubscriptions)
        .where(eq(pushSubscriptions.accountId, input.accountId));

      const deleted = (result as any)[0]?.affectedRows ?? 0;
      console.log(`[WebPush] Admin ${ctx.user.id} cleared ${deleted} subscriptions for account ${input.accountId}`);

      return { deleted };
    }),

  /** Admin-only: Get recent notification delivery logs for a specific account */
  deliveryLogs: protectedProcedure
    .input(
      z.object({
        accountId: z.number().int().positive(),
        limit: z.number().int().min(1).max(100).optional().default(50),
        channel: z.enum(["push", "email", "sms"]).optional(),
        status: z.enum(["sent", "failed", "skipped"]).optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin") {
        throw new TRPCError({ code: "FORBIDDEN", message: "Admin access required" });
      }
      const { getRecentNotificationLogs } = await import("../services/notificationLogger");
      const logs = await getRecentNotificationLogs(input.accountId, {
        limit: input.limit,
        channel: input.channel,
        status: input.status,
      });
      return logs;
    }),

  /** Admin-only: Get notification delivery stats for a specific account */
  deliveryStats: protectedProcedure
    .input(z.object({ accountId: z.number().int().positive() }))
    .query(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin") {
        throw new TRPCError({ code: "FORBIDDEN", message: "Admin access required" });
      }
      const { getNotificationDeliveryStats } = await import("../services/notificationLogger");
      const stats = await getNotificationDeliveryStats(input.accountId);
      return stats;
    }),

  /** Admin-only: Get active push subscription count for a specific account */
  subscriptionCount: protectedProcedure
    .input(z.object({ accountId: z.number().int().positive() }))
    .query(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin") {
        throw new TRPCError({ code: "FORBIDDEN", message: "Admin access required" });
      }

      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

      const result = await db
        .select({ total: count() })
        .from(pushSubscriptions)
        .where(eq(pushSubscriptions.accountId, input.accountId));

      return { count: result[0]?.total ?? 0 };
    }),

  /** Update notification preferences for all of the current user's push subscriptions in an account */
  updatePreferences: protectedProcedure
    .input(
      z.object({
        accountId: z.number().int().positive(),
        preferences: z.object({
          inbound_sms: z.object({ push: z.boolean(), sms: z.boolean(), email: z.boolean() }),
          inbound_email: z.object({ push: z.boolean(), sms: z.boolean(), email: z.boolean() }),
          appointment_booked: z.object({ push: z.boolean(), sms: z.boolean(), email: z.boolean() }),
          ai_call_completed: z.object({ push: z.boolean(), sms: z.boolean(), email: z.boolean() }),
          facebook_lead: z.object({ push: z.boolean(), sms: z.boolean(), email: z.boolean() }),
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

  /** Get the current user's personal phone number */
  getUserPhone: protectedProcedure
    .query(async ({ ctx }) => {
      const db = await getDb();
      if (!db) return { phone: null };

      const [user] = await db
        .select({ phone: users.phone })
        .from(users)
        .where(eq(users.id, ctx.user.id))
        .limit(1);

      return { phone: user?.phone || null };
    }),

  /** Send a test push notification to the current user */
  testPush: protectedProcedure
    .input(z.object({ accountId: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      await requireAccountMember(ctx.user.id, input.accountId, ctx.user.role);
      const { sendPushNotification } = await import("../services/webPush");
      const result = await sendPushNotification(ctx.user.id, {
        title: "Test Push Notification",
        body: "Push notifications are working! \uD83C\uDF89",
        url: "/settings/notifications",
        tag: "test-push",
      });
      if (result.sent === 0) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: result.failed > 0
            ? "Failed to deliver \u2014 try disabling and re-enabling push notifications."
            : "No active push subscriptions found. Enable push notifications first.",
        });
      }
      return { success: true, sent: result.sent, failed: result.failed };
    }),

  /** Send a test SMS to verify Blooio configuration */
  testSms: protectedProcedure
    .input(
      z.object({
        accountId: z.number().int().positive(),
        phoneNumber: z.string().min(10),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await requireAccountMember(ctx.user.id, input.accountId, ctx.user.role);
      const { dispatchSMS } = await import("../services/messaging");
      const result = await dispatchSMS({
        to: input.phoneNumber,
        body: "Test notification from Apex Systems CRM \u2014 your SMS channel is working!",
        accountId: input.accountId,
      });
      if (!result.success) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: result.error || "Failed to send test SMS",
        });
      }
      return { success: true, provider: result.provider };
    }),

  /** Send a test email to verify SendGrid configuration */
  testEmail: protectedProcedure
    .input(
      z.object({
        accountId: z.number().int().positive(),
        emailAddress: z.string().email(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await requireAccountMember(ctx.user.id, input.accountId, ctx.user.role);
      const { dispatchEmail } = await import("../services/messaging");
      const result = await dispatchEmail({
        to: input.emailAddress,
        subject: "Test Notification \u2014 Apex Systems CRM",
        body: "<h2>Test Notification</h2><p>Your email notifications are configured correctly.</p><p style='color:#666;margin-top:16px;'>\u2014 Apex Systems CRM</p>",
        accountId: input.accountId,
      });
      if (!result.success) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: result.error || "Failed to send test email",
        });
      }
      return { success: true, provider: result.provider };
    }),

  /** Update the current user's personal phone number for SMS notifications */
  updateUserPhone: protectedProcedure
    .input(
      z.object({
        phone: z.string().regex(/^\+?[1-9]\d{6,14}$/, "Invalid phone number format. Use E.164 format (e.g., +12125551234)").nullable(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

      // Normalize to E.164 format before saving
      let normalizedPhone = input.phone;
      if (normalizedPhone) {
        const digits = normalizedPhone.replace(/\D/g, "");
        if (!normalizedPhone.startsWith("+")) {
          if (digits.length === 10) {
            normalizedPhone = "+1" + digits; // US number without country code
          } else if (digits.length === 11 && digits.startsWith("1")) {
            normalizedPhone = "+" + digits; // US number with country code but no +
          } else {
            normalizedPhone = "+" + digits;
          }
        }
      }

      await db
        .update(users)
        .set({ phone: normalizedPhone })
        .where(eq(users.id, ctx.user.id));

      return { success: true, phone: normalizedPhone };
    }),
});
