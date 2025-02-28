import { precacheAndRoute } from "workbox-precaching"

self.addEventListener("message", (event) => {
    if (event.data && event.data.type === "SKIP_WAITING") self.skipWaiting()
})
// self.__WB_MANIFEST is default injection point
precacheAndRoute(self.__WB_MANIFEST)

self.addEventListener("push", (event) => {
    const data = event.data.json()
    self.registration.showNotification(data.title, {
        body: data.body,
        icon: "/public/pwa-icon.png"
    })
})

self.addEventListener("notificationclick", (event) => {
    event.notification.close()
    event.waitUntil(clients.openWindow("https://funapp.space/"))
})
