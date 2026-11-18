/**
 * Copyright 2026 Lord_mahor
 * Licensed under Apache 2.0
 */

import { useSession } from "@/composables/useSession"
import { incomingMap, invFrozen, invLock } from "@/domain/stock"
import { useQuery } from "@tanstack/vue-query"
import { computed, toValue } from "vue"
import { isAuthenticated } from "./auth/auth.helper"
import axiosInstance from "./axios"

/* Общие запросы каркаса и разделов — с прежними ключами vue-query, чтобы кэш был один и realtime обновлял всех разом.
   В кэше лежит ответ axios целиком (как раньше), наружу select отдаёт data. Запрос включается только при нужном праве. */
const FIVE_MIN = 1000 * 60 * 5
const { can, isSuper } = useSession()
const allowed = (perm) => computed(() => isAuthenticated() && !isSuper.value && can(perm))
const shared = { select: (res) => res.data, staleTime: FIVE_MIN, refetchInterval: FIVE_MIN, refetchOnWindowFocus: true }

/** Товары местности: quantity — доступно, totalQuantity — физически. always — перечитать при каждом открытии экрана (каталог). */
export const useProducts = ({ always = false } = {}) =>
    useQuery({
        ...shared,
        queryKey: ["products"],
        queryFn: () => axiosInstance.get("/products"),
        refetchOnReconnect: true,
        refetchOnMount: always ? "always" : true,
        retry: (failureCount, err) => {
            const status = err?.response?.status
            if (status && status >= 400 && status < 500) return false
            return failureCount < 5
        },
        retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 8000),
        enabled: allowed("view_products")
    })

/** Незавершённые заказы местности (значок меню, сводка каталога, «Мои заказы»). */
export const useActiveOrders = () => useQuery({ ...shared, queryKey: ["orders", "active"], queryFn: () => axiosInstance.get("/orders", { params: { active: 1 } }), enabled: allowed("view_orders") })

const RECENT_MS = 90 * 24 * 60 * 60 * 1000
/**
 * Заказы для списков: незавершённые и за 90 дней (["orders", "recent"]) или все (["orders", "all"]) — «Показать все» в «Заказах»,
 * история за всё время. all и on — значения или ref; on — дополнительное условие включения. Прежний список виден, пока грузится новый.
 */
export const useOrderList = (all = false, on = true) =>
    useQuery({
        ...shared,
        queryKey: ["orders", computed(() => (toValue(all) ? "all" : "recent"))],
        queryFn: ({ queryKey }) => axiosInstance.get("/orders", { params: queryKey[1] === "all" ? {} : { since: Date.now() - RECENT_MS } }),
        placeholderData: (prev) => prev,
        enabled: computed(() => isAuthenticated() && !isSuper.value && can("view_orders") && !!toValue(on))
    })

/** Все закупки местности (значок меню, «Едет в закупках», «Ждёт поставку»). */
export const usePurchases = () => useQuery({ ...shared, queryKey: ["purchases"], queryFn: () => axiosInstance.get("/purchases"), enabled: allowed("view_purchases") })

/** Настройки местности: реквизиты, текст «Получение», цель склада, allowInventoryWithOpenDocs. */
export const useMsgs = () => useQuery({ ...shared, queryKey: ["msgs"], queryFn: () => axiosInstance.get("/database/msg"), select: (res) => res.data || {}, enabled: allowed("view-messages") })

/** Инвентаризации местности — для раздела «Инвентаризация». Ответ тяжёлый (все товары каждой инвентаризации),
 *  поэтому по таймеру не перечитывается: изменения приходят через realtime, а при возврате в приложение — если данные старше 5 минут. */
export const useInventories = () => useQuery({ ...shared, refetchInterval: false, queryKey: ["inventorizations"], queryFn: () => axiosInstance.get("/inventory"), enabled: allowed("view_inventory") })

/** Открытая инвентаризация без позиций (или null) — лёгкий ответ для полосы и запретов; полный список грузит только раздел. */
export const useActiveInventory = () => useQuery({ ...shared, queryKey: ["inventorizations", "active"], queryFn: () => axiosInstance.get("/inventory/active"), enabled: allowed("view_inventory") })

/** Типы обложек видов: { [вид]: тип }. */
export const useKindCovers = () =>
    useQuery({ ...shared, queryKey: ["product-kinds"], queryFn: () => axiosInstance.get("/products/kinds"), select: (res) => res.data?.covers || {}, refetchInterval: false, refetchOnWindowFocus: false, enabled: allowed("view_products") })

/** Сколько едет в созданных непроведённых закупках: { [productId]: штук }. */
export function useIncoming() {
    const { data } = usePurchases()
    return computed(() => incomingMap(data.value))
}

/**
 * Открытая инвентаризация и её запреты: open — она сама (или null), frozen — выдача заказов и приёмка закупок заморожены,
 * lock — создавать заказы и закупки нельзя (настройка местности выключена). Товары менять нельзя, пока open.
 */
export function useInventoryLock() {
    const inv = useActiveInventory()
    const msgs = useMsgs()
    const open = computed(() => inv.data.value || null)
    return { open, frozen: computed(() => invFrozen(open.value)), lock: computed(() => invLock(open.value, msgs.data.value)) }
}
