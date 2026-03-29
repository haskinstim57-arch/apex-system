/**
 * Web Push Notification Service
 * Uses the Web Push API (VAPID) to send push notifications to subscribed users.
 */
import webpush from "web-push";
import { ENV } from "../_core/env";
import { getDb } from "../db";
import { pushSubscriptions } from "../../drizzle/schema";
import { eq, and } from "drizzle-orm";

// Configure web-push with VAPID keys
let vapidConfigured = false;

function ensureVapidConfigured() {
  if (vapidConfigured) return;
  if (!ENV.vapidPublicKey || !ENV.vapidPrivateKey || !ENV.vapidSubject) {
    console.warn("[WebPush] VAPID keys not configured — push notifications disabled");
    return;
  }
  webpush.setVapidDetails(ENV.vapidSubject, ENV.vapidPublicKey, ENV.vapidPrivateKey);
  vapidConfigured = true;
}

export interface PushPayload {
  title: string;
  body: string;
  url?: string;
  icon?: string;
  badge?: string;
  tag?: string;
}

/**
 * Save a push subscription for a user
 */
export async function savePushSubscription(
  userId: number,
  accountId: number,
  subscription: { endpoint: string; keys: { p256dh: string; auth: string } },
  userAgent?: string
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // Check if this endpoint already exists for this user
  const existing = await db
    .select()
    .from(pushSubscriptions)
    .where(
      and(
        eq(pushSubscriptions.userId, userId),
        eq(pushSubscriptions.endpoint, subscription.endpoint)
      )
    )
    .limit(1);

  if (existing.length > 0) {
    // Update existing subscription (keys may have changed)
    await db
      .update(pushSubscriptions)
      .set({
        p256dh: subscription.keys.p256dh,
        auth: subscription.keys.auth,
        userAgent: userAgent || null,
      })
      .where(eq(pushSubscriptions.id, existing[0].id));
    return existing[0].id;
  }

  // Insert new subscription
  const [result] = await db.insert(pushSubscriptions).values({
    userId,
    accountId,
    endpoint: subscription.endpoint,
    p256dh: subscription.keys.p256dh,
    auth: subscription.keys.auth,
    userAgent: userAgent || null,
  });

  return result.insertId;
}

/**
 * Remove a push subscription by endpoint
 */
export async function removePushSubscription(userId: number, endpoint: string) {
  const db = await getDb();
  if (!db) return;

  await db
    .delete(pushSubscriptions)
    .where(
      and(eq(pushSubscriptions.userId, userId), eq(pushSubscriptions.endpoint, endpoint))
    );
}

/**
 * Send a push notification to all subscriptions for a given user
 */
export async function sendPushNotification(
  userId: number,
  payload: PushPayload
): Promise<{ sent: number; failed: number }> {
  ensureVapidConfigured();
  if (!vapidConfigured) {
    return { sent: 0, failed: 0 };
  }

  const db = await getDb();
  if (!db) return { sent: 0, failed: 0 };

  const subscriptions = await db
    .select()
    .from(pushSubscriptions)
    .where(eq(pushSubscriptions.userId, userId));

  if (subscriptions.length === 0) {
    return { sent: 0, failed: 0 };
  }

  const notificationPayload = JSON.stringify({
    title: payload.title,
    body: payload.body,
    url: payload.url || "/",
    icon: payload.icon || "/icons/pwa-192x192.png",
    badge: payload.badge || "/icons/pwa-192x192.png",
    tag: payload.tag,
  });

  let sent = 0;
  let failed = 0;

  for (const sub of subscriptions) {
    try {
      await webpush.sendNotification(
        {
          endpoint: sub.endpoint,
          keys: {
            p256dh: sub.p256dh,
            auth: sub.auth,
          },
        },
        notificationPayload,
        { TTL: 60 * 60 } // 1 hour TTL
      );
      sent++;
    } catch (err: any) {
      failed++;
      // If subscription is expired or invalid (410 Gone, 404 Not Found), remove it
      if (err.statusCode === 410 || err.statusCode === 404) {
        console.log(`[WebPush] Removing expired subscription for user ${userId}: ${sub.endpoint.slice(0, 50)}...`);
        await db.delete(pushSubscriptions).where(eq(pushSubscriptions.id, sub.id)).catch(() => {});
      } else {
        console.error(`[WebPush] Failed to send to user ${userId}:`, err.statusCode || err.message);
      }
    }
  }

  return { sent, failed };
}

/**
 * Send push notification to all users in an account (e.g., for account-wide events)
 */
export async function sendPushNotificationToAccount(
  accountId: number,
  payload: PushPayload
): Promise<{ sent: number; failed: number }> {
  ensureVapidConfigured();
  if (!vapidConfigured) return { sent: 0, failed: 0 };

  const db = await getDb();
  if (!db) return { sent: 0, failed: 0 };

  const subscriptions = await db
    .select()
    .from(pushSubscriptions)
    .where(eq(pushSubscriptions.accountId, accountId));

  if (subscriptions.length === 0) return { sent: 0, failed: 0 };

  const notificationPayload = JSON.stringify({
    title: payload.title,
    body: payload.body,
    url: payload.url || "/",
    icon: payload.icon || "/icons/pwa-192x192.png",
    badge: payload.badge || "/icons/pwa-192x192.png",
    tag: payload.tag,
  });

  let sent = 0;
  let failed = 0;

  for (const sub of subscriptions) {
    try {
      await webpush.sendNotification(
        {
          endpoint: sub.endpoint,
          keys: { p256dh: sub.p256dh, auth: sub.auth },
        },
        notificationPayload,
        { TTL: 60 * 60 }
      );
      sent++;
    } catch (err: any) {
      failed++;
      if (err.statusCode === 410 || err.statusCode === 404) {
        await db.delete(pushSubscriptions).where(eq(pushSubscriptions.id, sub.id)).catch(() => {});
      }
    }
  }

  return { sent, failed };
}
