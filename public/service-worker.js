/* eslint-disable */
// Skladan custom push handler — injected into the Workbox-generated sw.js via vite-plugin-pwa workbox.importScripts.
// Plain JS — no bundler/transpiler.

self.addEventListener("push", function (event) {
    var data = { title: "Уведомление", body: "" }
    try {
        data = event.data ? event.data.json() : data
    } catch (e) {
        try {
            var text = event.data ? event.data.text() : ""
            data = { title: "Уведомление", body: text }
        } catch (_) {}
    }
    event.waitUntil(
        self.registration.showNotification(data.title, {
            body: data.body,
            icon: "/pwa-icon.png",
            badge: "/favicon.ico",
            tag: data.tag || "skladan",
            data: { url: data.url || "/" }
        })
    )
})

self.addEventListener("notificationclick", function (event) {
    event.notification.close()
    var targetUrl = (event.notification.data && event.notification.data.url) || "/"
    event.waitUntil(
        clients
            .matchAll({ type: "window", includeUncontrolled: true })
            .then(function (windowClients) {
                for (var i = 0; i < windowClients.length; i++) {
                    var c = windowClients[i]
                    if (c.url && c.url.indexOf(self.location.origin) === 0 && "focus" in c) {
                        return c.focus()
                    }
                }
                if (clients.openWindow) {
                    return clients.openWindow(targetUrl)
                }
                return null
            })
    )
})

self.addEventListener("message", function (event) {
    if (event.data && event.data.type === "SKIP_WAITING") {
        self.skipWaiting()
    }
})
