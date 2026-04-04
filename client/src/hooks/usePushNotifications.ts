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
 * Get a ready service worker registration.
 * Strategy:
 *  1. Check if there's already an active SW via getRegistrations()
 *  2. If not, attempt to manually register /sw.js (force re-fetch from server)
 *  3. Wait for the SW to activate with polling + timeout
 */
async function getServiceWorkerRegistration(timeoutMs = 20000): Promise<ServiceWorkerRegistration> {
  // First, try to get an existing active registration quickly
  const registrations = await navigator.serviceWorker.getRegistrations();
  for (const reg of registrations) {
    if (reg.active) {
      console.log("[Push] Found active SW from getRegistrations()");
      // Trigger update check in background (non-blocking)
      reg.update().catch(() => {});
      return reg;
    }
  }

  console.log("[Push] No active SW found. Attempting manual registration...");

  // No active SW — try to manually register (or re-register) the service worker
  // Use updateViaCache: "none" to force the browser to fetch fresh sw.js
  try {
    const reg = await navigator.serviceWorker.register("/sw.js", {
      scope: "/",
      updateViaCache: "none",
    });
    console.log("[Push] Manual SW registration initiated, state:", reg.installing?.state || reg.waiting?.state || reg.active?.state);

    // If we got an active SW immediately, use it
    if (reg.active) {
      return reg;
    }

    // Wait for the SW to activate
    const pendingSW = reg.installing || reg.waiting;
    if (pendingSW) {
      await new Promise<void>((resolve, reject) => {
        const timer = setTimeout(() => {
          reject(new Error("Service worker took too long to activate. Please close and reopen the app, then try again."));
        }, timeoutMs);

        pendingSW.addEventListener("statechange", () => {
          console.log("[Push] SW state changed to:", pendingSW.state);
          if (pendingSW.state === "activated") {
            clearTimeout(timer);
            resolve();
          } else if (pendingSW.state === "redundant") {
            clearTimeout(timer);
            reject(new Error("Service worker became redundant. Please refresh the page and try again."));
          }
        });
      });

      // Re-fetch the registration after activation
      const freshReg = await navigator.serviceWorker.getRegistration("/");
      if (freshReg?.active) return freshReg;
    }
  } catch (regErr: any) {
    console.error("[Push] Manual SW registration failed:", regErr);
    // Fall through to the ready-based approach
  }

  // Last resort: wait for navigator.serviceWorker.ready with timeout
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(
        "Service worker could not activate. Try these steps:\n" +
        "1. Close and reopen the app\n" +
        "2. If that doesn't work, uninstall the app from your home screen, clear browser cache, and reinstall"
      ));
    }, timeoutMs);

    navigator.serviceWorker.ready
      .then((reg) => {
        clearTimeout(timer);
        resolve(reg);
      })
      .catch((err) => {
        clearTimeout(timer);
        reject(err);
      });
  });
}

export type SubscribeResult = {
  success: boolean;
  error?: string;
};

export function usePushNotifications(accountId?: number) {
  const { user } = useAuth();
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isSupported, setIsSupported] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission>("default");

  const { data: vapidData, isLoading: vapidLoading } = trpc.notifications.getVapidPublicKey.useQuery(
    undefined,
    {
      enabled: !!user,
      staleTime: 0,
      retry: 2,
    }
  );

  const subscribeMutation = trpc.notifications.subscribePush.useMutation();
  const unsubscribeMutation = trpc.notifications.unsubscribePush.useMutation();

  useEffect(() => {
    const supported =
      "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
    setIsSupported(supported);

    if (supported) {
      setPermission(Notification.permission);
      const subscribed = localStorage.getItem(PUSH_SUBSCRIBED_KEY);
      if (subscribed === "true") {
        setIsSubscribed(true);
      }
    }
  }, []);

  const subscribe = useCallback(async (): Promise<SubscribeResult> => {
    console.log("[Push] Subscribe called", {
      isSupported,
      vapidKey: !!vapidData?.publicKey,
      accountId,
      user: !!user,
      vapidLoading,
    });

    if (!isSupported) {
      return { success: false, error: "Push notifications are not supported in this browser." };
    }
    if (vapidLoading) {
      return {
        success: false,
        error: "Still loading configuration. Please wait a moment and try again.",
      };
    }
    if (!vapidData?.publicKey) {
      return {
        success: false,
        error: "Push server key not configured. Contact your administrator to set VAPID keys.",
      };
    }
    if (!accountId) {
      return { success: false, error: "No account selected. Please select an account first." };
    }
    if (!user) {
      return { success: false, error: "You must be logged in to enable push notifications." };
    }

    try {
      // Step 1: Request permission
      console.log("[Push] Requesting notification permission...");
      const perm = await Notification.requestPermission();
      setPermission(perm);
      console.log("[Push] Permission result:", perm);

      if (perm !== "granted") {
        if (perm === "denied") {
          return {
            success: false,
            error:
              "Notifications are blocked by your browser. Open browser settings and allow notifications for this site.",
          };
        }
        return {
          success: false,
          error:
            "Notification permission was dismissed. Click Enable again and select Allow when prompted.",
        };
      }

      // Step 2: Get service worker registration (with generous timeout + polling)
      console.log("[Push] Getting service worker registration...");
      let registration: ServiceWorkerRegistration;
      try {
        registration = await getServiceWorkerRegistration(20000);
        console.log("[Push] Service worker ready, state:", registration.active?.state);
      } catch (swErr: any) {
        console.error("[Push] Service worker error:", swErr);
        return {
          success: false,
          error: swErr?.message || "Service worker failed to activate. Please refresh the page and try again.",
        };
      }

      // Step 3: Clean up any stale subscription
      const existingSub = await registration.pushManager.getSubscription();
      if (existingSub) {
        console.log("[Push] Cleaning up existing subscription...");
        try {
          await existingSub.unsubscribe();
        } catch (e) {
          console.warn("[Push] Failed to clean up old subscription:", e);
        }
      }

      // Step 4: Create new push subscription
      console.log("[Push] Creating push subscription...");
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidData.publicKey),
      });

      const json = subscription.toJSON();
      if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) {
        throw new Error("Browser returned an invalid push subscription. Try again.");
      }

      // Step 5: Save to server
      console.log("[Push] Sending subscription to server...");
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
      console.log("[Push] Successfully subscribed!");
      return { success: true };
    } catch (err: any) {
      console.error("[Push] Subscribe error:", err);
      return {
        success: false,
        error: err?.message || "An unexpected error occurred while enabling notifications.",
      };
    }
  }, [isSupported, vapidData, vapidLoading, accountId, user, subscribeMutation]);

  const unsubscribe = useCallback(async (): Promise<SubscribeResult> => {
    if (!isSupported) return { success: false, error: "Push not supported." };

    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();

      if (subscription) {
        await unsubscribeMutation.mutateAsync({ endpoint: subscription.endpoint });
        await subscription.unsubscribe();
      }

      setIsSubscribed(false);
      localStorage.removeItem(PUSH_SUBSCRIBED_KEY);
      return { success: true };
    } catch (err: any) {
      console.error("[Push] Unsubscribe error:", err);
      return { success: false, error: err?.message || "Failed to disable notifications." };
    }
  }, [isSupported, unsubscribeMutation]);

  return {
    isSupported,
    isSubscribed,
    permission,
    subscribe,
    unsubscribe,
    isLoading: subscribeMutation.isPending || unsubscribeMutation.isPending || vapidLoading,
  };
}
