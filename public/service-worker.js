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
