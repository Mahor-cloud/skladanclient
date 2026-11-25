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
import { queryClient } from "./queryClient"

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

/** Аккаунт местности на lit-na.ru: { configured, login (почта или null — гость), loginFailed, получатель, address, delivery }. Меняется только своим сохранением. */
export const useLitnaAccount = () =>
    useQuery({
        ...shared,
        refetchInterval: false,
        queryKey: ["litna", "account"],
        queryFn: () => axiosInstance.get("/litna/account"),
        enabled: computed(() => isAuthenticated() && !isSuper.value && (can("create_purchases") || can("edit_purchases") || can("view_purchases")))
    })
/**
 * Каталог lit-na.ru: { items:[{ id, sku, name, price, stock, inStock, image }], suggest:{ [товар]: id } } — один раз на полчаса.
 * seeds — для шаблона «Семян» (супер-админ), подсказки по названию; on — дополнительное условие (значение или ref).
 */
export const useLitnaCatalog = ({ seeds = false, on = true } = {}) =>
    useQuery({
        ...shared,
        staleTime: 1000 * 60 * 30,
        refetchInterval: false,
        refetchOnWindowFocus: false,
        // Сайт лежит — без повторов: не стучаться трижды и не засорять счётчик ошибок сервера.
        retry: false,
        queryKey: ["litna", "catalog", seeds ? "seeds" : "own"],
        queryFn: () => axiosInstance.get("/litna/catalog", { params: seeds ? { seeds: 1 } : {} }),
        enabled: computed(() => isAuthenticated() && isSuper.value === seeds && !!toValue(on))
    })
/** Свежие сведения об аккаунте lit-na.ru (вход, выход, вход заранее) — в кэш, без запроса; кэша ещё нет — ничего: неполный аккаунт туда не попадёт. */
export const putLitnaAccount = (patch) => queryClient.setQueryData(["litna", "account"], (old) => (old ? { ...old, data: { ...old.data, ...patch } } : old))
const checking = {}
/**
 * Спросить lit-na.ru об оплате закупки: { paid, status, reverted, message } — paid: сервер уже отметил оплату; reverted: заказ отменён
 * или пропал на сайте, закупка снова черновик (message — текст сервера); gone — записи заказа нет (404). Сбой сети или сайта — {}.
 * Пока проверка закупки идёт, повторный вызов ждёт её же: две проверки одной закупки сразу на сайт не уходят.
 */
export function checkLitna(id) {
    if (!checking[id])
        checking[id] = axiosInstance
            .post(`/litna/purchases/${id}/check`, {})
            .then(
                (r) => r.data || {},
                // 404 — записи заказа больше нет: для окна оплаты это «заказа больше нет», как отмена
                (e) => (e?.response?.status === 404 ? { gone: true } : {})
            )
            .finally(() => delete checking[id])
    return checking[id]
}

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
