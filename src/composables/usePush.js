/**
 * Copyright 2026 Lord_mahor
 * Licensed under Apache 2.0
 */

import axiosInstance from "@/service/axios"
import { toast } from "@/ui/overlay"
import { reactive, ref } from "vue"

// Push-подписка браузера и её категории на сервере (subscription.preferences). Состояние одно на приложение:
// строка в профиле и окно «О чём сообщать» читают одно и то же.
const supported = typeof navigator !== "undefined" && "serviceWorker" in navigator && "PushManager" in window
const subscribed = ref(false)
const prefs = reactive({ orders: true, purchases: true, inventory: true, products: true, users: true, roles: true, payment: true, ordersOwnOnly: false })

const urlBase64ToUint8Array = (base64String) => {
    const padding = "=".repeat((4 - (base64String.length % 4)) % 4)
    const raw = window.atob((base64String + padding).replace(/-/g, "+").replace(/_/g, "/"))
    return Uint8Array.from(raw, (c) => c.charCodeAt(0))
}

/** Есть ли подписка в этом браузере; если есть — подтянуть категории с сервера. */
async function refresh() {
    if (!supported) return
    try {
        const registration = await navigator.serviceWorker.getRegistration()
        const sub = registration ? await registration.pushManager.getSubscription() : null
        subscribed.value = !!sub
        if (sub) Object.assign(prefs, (await axiosInstance.get("/change-history/subscription/me")).data?.preferences || {})
    } catch (error) {
        console.error("Error checking subscription:", error)
    }
}

/** Подписать браузер и сохранить категории. Возвращает true при успехе; причины отказа показывает сам. */
async function subscribe(next) {
    if (!supported) return !toast({ type: "warning", title: "Не поддерживается", text: "Браузер не поддерживает push-уведомления.", timeout: 5000 })
    if (typeof Notification !== "undefined" && Notification.permission === "denied") return !toast({ type: "warning", title: "Заблокировано", text: "Уведомления отключены в настройках браузера. Разрешите их и попробуйте снова.", timeout: 6000 })
    try {
        if (typeof Notification !== "undefined" && Notification.permission !== "granted" && (await Notification.requestPermission()) !== "granted")
            return !toast({ type: "warning", title: "Без разрешения", text: "Без разрешения на уведомления подписка невозможна.", timeout: 5000 })

        const { data: vapid } = await axiosInstance.get("/change-history/vapid-public-key")
        if (!vapid?.publicKey) return !toast({ type: "error", title: "Ошибка конфигурации", text: "VAPID-ключ не настроен на сервере.", timeout: 6000 })
        const appKey = urlBase64ToUint8Array(vapid.publicKey)

        if (!(await navigator.serviceWorker.getRegistration())) {
            try {
                await navigator.serviceWorker.register("/service-worker.js")
            } catch (e) {
                throw new Error("Не удалось зарегистрировать Service Worker: " + (e?.message || e))
            }
        }
        const registration = await Promise.race([navigator.serviceWorker.ready, new Promise((_, reject) => setTimeout(() => reject(new Error("Service Worker не активирован за 10 сек")), 10000))])

        let subscription = await registration.pushManager.getSubscription()
        // Подписка со старым ключом сервера уведомлений не получает — пересоздаём.
        const currentKey = subscription?.options?.applicationServerKey
        if (subscription && (!currentKey || new Uint8Array(currentKey).join() !== appKey.join())) {
            await subscription.unsubscribe()
            subscription = null
        }
        if (!subscription) subscription = await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: appKey })
        await axiosInstance.post("/change-history/subscribe", { ...subscription.toJSON(), preferences: next })
        Object.assign(prefs, next)
        subscribed.value = true
        return true
    } catch (error) {
        console.error("Error subscribing to push notifications:", error)
        return !toast({ type: "error", title: "Ошибка подписки", text: error?.response?.data?.message || error?.message || "Не удалось подписаться на уведомления", timeout: 6000 })
    }
}

/** Сохранить категории уже подписанного браузера (и обновить саму подписку, как раньше делала «Сохранить настройки»). */
async function save(next) {
    try {
        await axiosInstance.put("/change-history/subscription/preferences", next)
    } catch (error) {
        return !toast({ type: "error", title: "Ошибка", text: error?.response?.data?.message || error?.message || "Не удалось сохранить настройки", timeout: 4000 })
    }
    return subscribe(next)
}

/** Отключить на этом устройстве: подписка браузера снимается (сервер удалит её при первой же неудачной отправке); другие устройства не затронуты. */
async function disable() {
    try {
        const registration = await navigator.serviceWorker.getRegistration()
        const sub = registration ? await registration.pushManager.getSubscription() : null
        if (sub) await sub.unsubscribe()
        subscribed.value = false
        return true
    } catch (error) {
        return !toast({ type: "error", title: "Ошибка", text: error?.message || "Не удалось отключить уведомления", timeout: 5000 })
    }
}

export function usePush() {
    return { supported, subscribed, prefs, refresh, subscribe, save, disable }
}
