import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { TRPCError } from "@trpc/server";
import {
  getNotifications,
  getUnreadNotificationCount,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  dismissNotification,
  getMember,
} from "../db";
import { savePushSubscription, removePushSubscription } from "../services/webPush";
import { ENV } from "../_core/env";

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
});
