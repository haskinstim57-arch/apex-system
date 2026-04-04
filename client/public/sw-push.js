/**
 * Push notification handler for the service worker.
 * Imported by VitePWA-generated service worker via importScripts.
 * Uses ES5-compatible syntax for maximum mobile PWA compatibility.
 */
try {
  self.addEventListener("push", function(event) {
    if (!event.data) return;

    var payload;
    try {
      payload = event.data.json();
    } catch (e) {
      payload = {
        title: "Apex System",
        body: event.data.text(),
      };
    }

    var options = {
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

    event.waitUntil(
      self.registration.showNotification(payload.title || "Apex System", options)
    );
  });

  self.addEventListener("notificationclick", function(event) {
    event.notification.close();

    if (event.action === "dismiss") return;

    var urlToOpen = (event.notification.data && event.notification.data.url)
      ? event.notification.data.url
      : "/";

    event.waitUntil(
      self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(function(clientList) {
        for (var i = 0; i < clientList.length; i++) {
          var client = clientList[i];
          if (client.url.indexOf(self.location.origin) !== -1 && "focus" in client) {
            client.navigate(urlToOpen);
            return client.focus();
          }
        }
        return self.clients.openWindow(urlToOpen);
      })
    );
  });

  self.addEventListener("notificationclose", function(event) {
    // Reserved for analytics
  });
} catch (err) {
  console.error("[sw-push] Init error:", err);
}
