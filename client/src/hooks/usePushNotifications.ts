import { useEffect, useState, useCallback } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";

const PUSH_SUBSCRIBED_KEY = "push-notification-subscribed";

function urlBase64ToUint8Array(base64String: string): BufferSource {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray.buffer as ArrayBuffer;
}

export function usePushNotifications(accountId?: number) {
  const { user } = useAuth();
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isSupported, setIsSupported] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission>("default");

  const { data: vapidData } = trpc.notifications.getVapidPublicKey.useQuery(undefined, {
    enabled: !!user,
  });

  const subscribeMutation = trpc.notifications.subscribePush.useMutation();
  const unsubscribeMutation = trpc.notifications.unsubscribePush.useMutation();

  useEffect(() => {
    const supported = "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
    setIsSupported(supported);

    if (supported) {
      setPermission(Notification.permission);

      // Check localStorage first, then verify against actual browser subscription
      const storedSubscribed = localStorage.getItem(PUSH_SUBSCRIBED_KEY) === "true";

      if (storedSubscribed) {
        // Verify the subscription is still valid in the browser
        navigator.serviceWorker.ready.then((registration) => {
          registration.pushManager.getSubscription().then((subscription) => {
            if (subscription) {
              // Browser has an active subscription — localStorage is correct
              setIsSubscribed(true);
            } else {
              // localStorage says subscribed but browser has no active subscription — stale
              console.warn("[Push] localStorage says subscribed but no active browser subscription found — resetting state");
              setIsSubscribed(false);
              localStorage.removeItem(PUSH_SUBSCRIBED_KEY);
            }
          }).catch((err) => {
            console.error("[Push] Error checking browser subscription:", err);
            // Fall back to localStorage value
            setIsSubscribed(true);
          });
        }).catch((err) => {
          console.error("[Push] Service worker not ready:", err);
          setIsSubscribed(true);
        });
      } else {
        setIsSubscribed(false);
      }
    }
  }, []);

  const subscribe = useCallback(async () => {
    if (!isSupported) { console.error("[Push] Browser does not support push notifications"); return false; }
    if (!vapidData?.publicKey) { console.error("[Push] VAPID public key not configured — set VAPID_PUBLIC_KEY env var and restart"); return false; }
    if (!accountId) { console.error("[Push] No account selected — switch to a sub-account first"); return false; }
    if (!user) { console.error("[Push] User not authenticated"); return false; }

    try {
      // Request notification permission
      const perm = await Notification.requestPermission();
      setPermission(perm);

      if (perm !== "granted") return false;

      // Get service worker registration
      const registration = await navigator.serviceWorker.ready;

      // Check for an existing stale subscription and unsubscribe it first
      const existingSub = await registration.pushManager.getSubscription();
      if (existingSub) {
        console.log("[Push] Found existing browser subscription — unsubscribing before creating fresh one");
        try {
          await existingSub.unsubscribe();
        } catch (err) {
          console.warn("[Push] Failed to unsubscribe existing subscription:", err);
        }
      }

      // Create a fresh subscription with the current VAPID key
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidData.publicKey),
      });

      const json = subscription.toJSON();
      if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) {
        throw new Error("Invalid push subscription");
      }

      // Send subscription to server
      await subscribeMutation.mutateAsync({
        accountId,
        subscription: {
          endpoint: json.endpoint,
          keys: {
            p256dh: json.keys.p256dh,
            auth: json.keys.auth,
          },
        },
        userAgent: navigator.userAgent,
      });

      setIsSubscribed(true);
      localStorage.setItem(PUSH_SUBSCRIBED_KEY, "true");
      return true;
    } catch (err) {
      console.error("[Push] Subscribe error:", err);
      return false;
    }
  }, [isSupported, vapidData, accountId, user, subscribeMutation]);

  const unsubscribe = useCallback(async () => {
    if (!isSupported) return false;

    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();

      if (subscription) {
        await unsubscribeMutation.mutateAsync({
          endpoint: subscription.endpoint,
        });
        await subscription.unsubscribe();
      }

      setIsSubscribed(false);
      localStorage.removeItem(PUSH_SUBSCRIBED_KEY);
      return true;
    } catch (err) {
      console.error("[Push] Unsubscribe error:", err);
      return false;
    }
  }, [isSupported, unsubscribeMutation]);

  return {
    isSupported,
    isSubscribed,
    permission,
    subscribe,
    unsubscribe,
    isLoading: subscribeMutation.isPending || unsubscribeMutation.isPending,
  };
}
