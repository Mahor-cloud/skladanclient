/**
 * Copyright 2026 Lord_mahor
 * Licensed under Apache 2.0
 */

import Cookies from "js-cookie"
import { queryClient } from "../queryClient"
import { axiosClassic } from "../axios"
import { useCart } from "@/composables/useCart"
import { useSession } from "@/composables/useSession"
import { homePath } from "@/domain/nav"
import { notifyUserChanged, removeTokensStorage, saveToStorage } from "./auth.helper"
export const authService = {
    logout(redirect = "/auth/login") {
        // Push-подписка браузера — от вышедшего пользователя: на общем телефоне следующему не должны приходить его уведомления.
        const unsubscribed = Promise.resolve(navigator.serviceWorker?.getRegistration())
            .then((r) => r?.pushManager?.getSubscription())
            .then((s) => s?.unsubscribe())
            .catch(() => {})
        // Сервер забывает сессию: без этого скопированные ключи работали бы и после выхода. Выходим по ключу обновления —
        // ключ доступа живёт час и после простоя уже не годится. keepalive — запрос переживает перезагрузку ниже.
        const refreshToken = Cookies.get("refreshToken")
        if (refreshToken) fetch("/api/auth/logout", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ refreshToken }), keepalive: true }).catch(() => {})
        removeTokensStorage()
        localStorage.removeItem("user")
        useCart().clear()
        queryClient.clear()
        notifyUserChanged()
        try {
            window.location.replace(window.location.origin + "/#" + redirect)
        } catch {
            window.location.hash = "#" + redirect
        }
        // Перезагрузка оборвала бы снятие подписки — ждём его, но не дольше секунды.
        Promise.race([unsubscribed, new Promise((r) => setTimeout(r, 1000))]).finally(() => {
            try {
                window.location.reload()
            } catch {
                // перезагрузка недоступна — адрес входа уже выставлен
            }
        })
    },

    async login(login, password) {
        const response = await axiosClassic.post("/auth/login", { login, password })
        if (response.data.accessToken) {
            queryClient.clear()
            useCart().clear()
            saveToStorage(response.data)
        }
        return response
    },

    getNewTokens: async function () {
        const refreshToken = Cookies.get("refreshToken")
        const response = await axiosClassic.post(
            "/auth/login/access-token",
            { refreshToken },
            {
                headers: {
                    "Content-Type": "application/json"
                }
            }
        )
        if (response.data.accessToken) {
            saveToStorage(response.data)
        }
        return response
    },

    /** Домашний раздел по правам вошедшего пользователя. */
    landingRoute() {
        return homePath(useSession().plain.value)
    }
}
