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
 * Send push notification to all users in an account — DIRECT (bypasses preferences/batching).
 * Used by the batch flush worker to actually deliver grouped notifications.
 */
export async function sendPushNotificationToAccountDirect(
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

/**
 * Generate a new VAPID key pair for push notification configuration.
 * Returns { publicKey, privateKey } that must be set as environment variables.
 */
export function generateVAPIDKeyPair(): { publicKey: string; privateKey: string } {
  const keys = webpush.generateVAPIDKeys();
  console.log("[WebPush] Generated new VAPID key pair.");
  console.log("[WebPush] Set these as environment variables:");
  console.log(`  VAPID_PUBLIC_KEY=${keys.publicKey}`);
  console.log(`  VAPID_PRIVATE_KEY=${keys.privateKey}`);
  console.log(`  VAPID_SUBJECT=mailto:admin@yourdomain.com`);
  return keys;
}

/**
 * Check whether VAPID is currently configured and ready to send.
 */
export function isVapidConfigured(): boolean {
  ensureVapidConfigured();
  return vapidConfigured;
}

/**
 * Send push notification to all users in an account — SMART version.
 * Checks per-subscription notification preferences and quiet hours,
 * then routes through the batching service for grouping.
 *
 * This is the function that event handlers should call.
 */
export async function sendPushNotificationToAccount(
  accountId: number,
  payload: PushPayload & { eventType?: string; contactName?: string }
): Promise<void> {
  // Lazy import to avoid circular dependency
  const { enqueuePushEvent, parseNotificationPreferences, isEventTypeEnabled, isWithinQuietHours } = await import("./pushBatcher");
  type PushEventType = import("./pushBatcher").PushEventType;

  const eventType = (payload.eventType || deriveEventType(payload.tag || "")) as PushEventType | null;
  if (!eventType) {
    // Unknown event type — send directly without batching
    await sendPushNotificationToAccountDirect(accountId, payload);
    return;
  }

  const { isChannelEnabled: isChEnabled } = await import("./pushBatcher");

  // Check if ANY subscription for this account has any channel enabled for this event type
  const db = await getDb();
  if (!db) return;

  const subs = await db
    .select({ notificationPreferences: pushSubscriptions.notificationPreferences })
    .from(pushSubscriptions)
    .where(eq(pushSubscriptions.accountId, accountId));

  if (subs.length === 0) return;

  // Check preferences — if ALL subscriptions have ALL channels disabled for this event, skip
  const anyPushEnabled = subs.some((sub) => {
    const prefs = parseNotificationPreferences(sub.notificationPreferences);
    return isEventTypeEnabled(prefs, eventType);
  });

  const anyEmailEnabled = subs.some((sub) => {
    const prefs = parseNotificationPreferences(sub.notificationPreferences);
    return isChEnabled(prefs, eventType, "email");
  });

  const anySmsEnabled = subs.some((sub) => {
    const prefs = parseNotificationPreferences(sub.notificationPreferences);
    return isChEnabled(prefs, eventType, "sms");
  });

  if (!anyPushEnabled && !anyEmailEnabled && !anySmsEnabled) return;

  // Check quiet hours — if ALL subscriptions are in quiet hours, skip
  const anyAwake = subs.some((sub) => {
    const prefs = parseNotificationPreferences(sub.notificationPreferences);
    return !isWithinQuietHours(prefs);
  });

  if (!anyAwake) return;

  // ─── Dedup check: prevent duplicate sends within 60s window ───
  const { checkAndRecordNotification } = await import("./notificationDedup");
  const dedupeKey = payload.tag || `${eventType}-${Date.now()}`;
  const allowed = await checkAndRecordNotification({
    accountId,
    eventType,
    channel: "push",
    dedupeKey,
    metadata: { title: payload.title, body: payload.body?.substring(0, 100) },
  });
  if (!allowed) {
    console.log(`[WebPush] Dedup blocked push for account ${accountId}: ${eventType}/${dedupeKey}`);
    return;
  }

  // Route through batcher (handles push + email + SMS dispatch on flush)
  await enqueuePushEvent(accountId, eventType, {
    title: payload.title,
    body: payload.body,
    url: payload.url,
    contactName: payload.contactName,
  });
}

/**
 * Derive event type from the notification tag
 */
function deriveEventType(tag: string): string | null {
  if (tag.startsWith("inbound-sms")) return "inbound_sms";
  if (tag.startsWith("inbound-email")) return "inbound_email";
  if (tag.startsWith("appointment")) return "appointment_booked";
  if (tag.startsWith("call-")) return "ai_call_completed";
  if (tag.startsWith("fb-lead")) return "facebook_lead";
  return null;
}
