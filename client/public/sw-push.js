/**
 * Push notification handler for the service worker.
 * This file is imported by the VitePWA-generated service worker via importScripts.
 */

// Handle incoming push notifications
self.addEventListener("push", (event) => {
  if (!event.data) return;

  let payload;
  try {
    payload = event.data.json();
  } catch {
    payload = {
      title: "Sterling Marketing",
      body: event.data.text(),
    };
  }

  const options = {
    body: payload.body || "",
    icon: payload.icon || "/icons/pwa-192x192.png",
    badge: payload.badge || "/icons/pwa-192x192.png",
    tag: payload.tag || "apex-notification",
    data: {
      url: payload.url || "/",
    },
    vibrate: [200, 100, 200],
    requireInteraction: false,
    actions: [
      { action: "open", title: "Open" },
      { action: "dismiss", title: "Dismiss" },
    ],
  };

  event.waitUntil(self.registration.showNotification(payload.title || "Sterling Marketing", options));
});

// Handle notification click
self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  if (event.action === "dismiss") return;

  const urlToOpen = event.notification.data?.url || "/";

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      // Focus existing window if available
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && "focus" in client) {
          client.navigate(urlToOpen);
          return client.focus();
        }
      }
      // Open new window
      return self.clients.openWindow(urlToOpen);
    })
  );
});

// Handle notification close
self.addEventListener("notificationclose", (event) => {
  // Analytics or cleanup if needed
});
