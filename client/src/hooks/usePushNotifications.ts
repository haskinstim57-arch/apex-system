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

/**
 * Wait for a service worker registration to become ready.
 * If navigator.serviceWorker.ready doesn't resolve within `timeoutMs`,
 * attempt to manually register a service worker and wait again.
 */
async function getServiceWorkerRegistration(timeoutMs = 5000): Promise<ServiceWorkerRegistration> {
  // First try: wait for an existing registration
  const existing = await Promise.race([
    navigator.serviceWorker.ready,
    new Promise<null>((resolve) => setTimeout(() => resolve(null), timeoutMs)),
  ]);

  if (existing) {
    console.log("[Push] SW ready (existing):", existing.scope);
    return existing;
  }

  // No SW ready — try to register one manually
  console.log("[Push] No SW ready within timeout — attempting manual registration");
  const registrations = await navigator.serviceWorker.getRegistrations();
  if (registrations.length === 0) {
    // Register the VitePWA service worker path (production uses /sw.js)
    try {
      await navigator.serviceWorker.register("/sw.js", { scope: "/" });
      console.log("[Push] Manually registered /sw.js");
    } catch {
      // In dev mode, VitePWA uses /dev-sw.js?dev-sw
      try {
        await navigator.serviceWorker.register("/dev-sw.js?dev-sw", { scope: "/", type: "module" as any });
        console.log("[Push] Manually registered /dev-sw.js (dev mode)");
      } catch (err2) {
        console.error("[Push] Failed to register service worker:", err2);
        throw new Error("Could not register a service worker. Push notifications require HTTPS and a valid service worker.");
      }
    }
  }

  // Wait for the registration to activate
  const reg = await Promise.race([
    navigator.serviceWorker.ready,
    new Promise<null>((resolve) => setTimeout(() => resolve(null), 8000)),
  ]);

  if (!reg) {
    throw new Error("Service worker failed to activate. Try refreshing the page and enabling notifications again.");
  }

  console.log("[Push] SW ready (after manual registration):", reg.scope);
  return reg;
}

export function usePushNotifications(accountId?: number) {
  const { user } = useAuth();
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isSupported, setIsSupported] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission>("default");

  // Bug 3 fix: always fetch fresh VAPID key, never use stale cached empty string
  const { data: vapidData } = trpc.notifications.getVapidPublicKey.useQuery(undefined, {
    enabled: !!user,
    staleTime: 0,
    refetchOnMount: true,
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
          // Log SW scope and state for diagnostics
          console.log("[Push] SW scope:", registration.scope, "| active state:", registration.active?.state);

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

  // iOS/Safari fix: requestPermission() MUST be the first await in the call stack
  // triggered by user interaction. Any prior async work breaks the user-gesture chain.
  const subscribe = useCallback(async () => {
    if (!isSupported) {
      throw new Error("Push notifications are not supported in this browser. Try Chrome, Edge, or Firefox.");
    }

    // 1. Request permission IMMEDIATELY — must be the first await (iOS/Safari requirement)
    const perm = await Notification.requestPermission();
    setPermission(perm);

    if (perm !== "granted") {
      throw new Error("Notification permission was denied. Enable notifications in your browser/device settings.");
    }

    // 2. Now validate the rest (after permission is secured)
    if (!vapidData?.publicKey) {
      throw new Error("VAPID public key not configured. Ask your admin to set VAPID_PUBLIC_KEY and restart the server.");
    }
    if (!accountId) {
      throw new Error("No account selected. Please switch to a sub-account first.");
    }
    if (!user) {
      throw new Error("You must be logged in to enable push notifications.");
    }

    // 3. Get service worker registration with fallback and timeout
    const registration = await getServiceWorkerRegistration();

    // Log SW scope and state for diagnostics
    console.log("[Push] SW scope:", registration.scope, "| active state:", registration.active?.state);

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
      throw new Error("Invalid push subscription — browser returned incomplete subscription data.");
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
    isVapidReady: !!vapidData?.publicKey,
  };
}
