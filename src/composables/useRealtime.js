/**
 * Copyright 2026 Lord_mahor
 * Licensed under Apache 2.0
 */

import axiosInstance from "@/service/axios"
import { queryClient } from "@/service/queryClient"
import Cookies from "js-cookie"
import { onBeforeUnmount, onMounted } from "vue"

const KEY_MAP = [
    { prefix: "order", keys: ["orders", "order", "orderShortages", "products", "cabinet-merged", "cabinet-orders-summary", "cabinet-summary", "cabinet-all"] },

    { prefix: "purchase", keys: ["purchases", "products"] },
    { prefix: "inventory", keys: ["inventory", "products"] },
    { prefix: "product", keys: ["products"] },
    { prefix: "user", keys: ["users"] },
    { prefix: "role", keys: ["roles"] },

    { prefix: "message", keys: ["msgs"] },

    { prefix: "cabinet", keys: ["cabinet-merged", "cabinet-orders-summary", "cabinet-summary", "cabinet-all"] }
]

const FLUSH_DELAY = 400
const MIN_FLUSH_INTERVAL = 3000
let pendingTypes = new Set()
let flushTimer = null
let lastFlushAt = 0

function doFlush() {
    flushTimer = null
    lastFlushAt = Date.now()
    const types = pendingTypes
    pendingTypes = new Set()
    const toInvalidate = new Set(["history"])
    let needsSelfRefresh = false
    for (const type of types) {
        for (const m of KEY_MAP) {
            if (type.startsWith(m.prefix)) m.keys.forEach((k) => toInvalidate.add(k))
        }
        if (type === "user-updated" || type === "user-deleted" || type.startsWith("role-")) {
            needsSelfRefresh = true
        }
    }
    for (const key of toInvalidate) {
        queryClient.invalidateQueries({ queryKey: [key] })
    }
    if (needsSelfRefresh) refreshCurrentUser()
}

async function refreshCurrentUser() {
    let cur = null
    try {
        cur = JSON.parse(localStorage.getItem("user") || "null")
    } catch {
        cur = null
    }
    if (!cur || !cur._id || cur.isSuperAdmin) return
    try {
        const res = await axiosInstance.get("/auth/me")
        const fresh = res?.data
        if (!fresh) return
        const merged = {
            ...cur,
            role: fresh.role,
            name: fresh.name,
            isAdmin: !!fresh.isAdmin
        }
        const watchedKeys = ["role", "name", "isAdmin"]
        const changed = watchedKeys.some((k) => JSON.stringify(cur[k]) !== JSON.stringify(merged[k]))
        if (!changed) return
        localStorage.setItem("user", JSON.stringify(merged))
        try {
            window.dispatchEvent(new StorageEvent("storage", { key: "user" }))
        } catch {

            const ev = new Event("storage")
            ev.key = "user"
            window.dispatchEvent(ev)
        }
    } catch (e) {
        const status = e?.response?.status

        if (status === 404) {
            try {
                window.location.replace("/#/auth/access?reason=session")
            } catch {

            }
        }
    }
}

function enqueueInvalidation(type) {
    pendingTypes.add(type)
    if (flushTimer) return
    const sinceLast = Date.now() - lastFlushAt

    const wait = Math.max(FLUSH_DELAY, MIN_FLUSH_INTERVAL - sinceLast)
    flushTimer = setTimeout(doFlush, wait)
}

export function useRealtime() {
    let es = null
    let retryTimer = null
    let stopped = false

    function scheduleReconnect() {
        if (stopped || retryTimer) return
        retryTimer = setTimeout(() => {
            retryTimer = null
            connect()
        }, 7000)
    }

    function connect() {
        if (stopped) return
        let user = null
        try {
            user = JSON.parse(localStorage.getItem("user") || "null")
        } catch {
            user = null
        }

        if (!user || user.isSuperAdmin) return
        const token = Cookies.get("accessToken")
        if (!token) {
            scheduleReconnect()
            return
        }
        try {
            es = new EventSource(`/api/change-history/stream?t=${encodeURIComponent(token)}`)
        } catch {
            scheduleReconnect()
            return
        }
        es.onmessage = (e) => {
            try {
                const payload = JSON.parse(e.data)
                const type = payload && payload.type
                if (!type || type === "ping" || type === "noop") return
                enqueueInvalidation(type)
            } catch {

            }
        }
        es.onerror = () => {

            try {
                es && es.close()
            } catch {

            }
            es = null
            scheduleReconnect()
        }
    }

    onMounted(connect)
    onBeforeUnmount(() => {
        stopped = true
        if (retryTimer) clearTimeout(retryTimer)
        if (flushTimer) {
            clearTimeout(flushTimer)
            flushTimer = null
        }
        pendingTypes = new Set()
        try {
            es && es.close()
        } catch {

        }
        es = null
    })
}
