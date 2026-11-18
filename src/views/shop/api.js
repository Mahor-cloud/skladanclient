/**
 * Copyright 2026 Lord_mahor
 * Licensed under Apache 2.0
 */

import { useCart } from "@/composables/useCart"
import { useSession } from "@/composables/useSession"
import { plural } from "@/domain/format"
import { available, pid } from "@/domain/stock"
import router from "@/router"
import axiosInstance from "@/service/axios"
import { queryClient } from "@/service/queryClient"
import { toast } from "@/ui/overlay"
import { useQuery } from "@tanstack/vue-query"
import { computed } from "vue"

const { can } = useSession()
const allowed = computed(() => can("view_orders"))

/** Дефицит по незавершённым заказам: [{ product, productName, required, inStock, orderNumbers, orderIds }]. В кэше — сам массив, как раньше. */
export const useShortages = (opts = {}) => useQuery({ queryKey: ["orderShortages"], queryFn: async () => (await axiosInstance.get("/orders/shortages")).data, staleTime: 30_000, enabled: allowed, ...opts })

/** Заказ с товарами позиций; id — ref. В кэше — ответ axios, как раньше. on — ref: выключить запрос (заказ удалён). */
export const useOrder = (id, on) =>
    useQuery({
        queryKey: ["order", id],
        queryFn: () => axiosInstance.get(`/orders/${id.value}`),
        select: (res) => res.data,
        refetchOnWindowFocus: true,
        refetchOnMount: "always",
        staleTime: 0,
        refetchInterval: 1000 * 60 * 5,
        enabled: computed(() => allowed.value && (!on || on.value))
    })

/** После любого изменения заказа: сам заказ, списки (и значок меню), остатки товаров, дефицит. */
export function refreshOrders(id) {
    if (id) queryClient.invalidateQueries({ queryKey: ["order", id] })
    for (const key of ["orders", "products", "orderShortages"]) queryClient.invalidateQueries({ queryKey: [key] })
}

/** Отказ сервера по заказу — его же текстом. Возвращает код отказа (STOCK_SHORTAGE, ACTIVE_INVENTORY, INSUFFICIENT_STOCK…). */
export function orderError(e, fallback) {
    const data = e?.response?.data
    const text = (typeof data?.message === "string" ? data.message : null) || e?.message || fallback
    if (data?.code === "STOCK_SHORTAGE") {
        queryClient.invalidateQueries({ queryKey: ["orderShortages"] })
        toast({ type: "warning", title: "Дефицит по складу", text, timeout: 8000 })
    } else if (data?.code === "ACTIVE_INVENTORY") toast({ type: "warning", title: "Идёт инвентаризация", text, timeout: 8000 })
    else toast({ type: "error", title: "Ошибка", text, timeout: 6000 })
    return data?.code
}

/** «Повторить заказ»: позиции заказа — в корзину, не больше свободного остатка. products — товары каталога. */
export function repeatOrder(o, products) {
    const { get, add } = useCart()
    const items = o.items || []
    const missing = []
    let added = 0
    for (const it of items) {
        const p = (products || []).find((x) => String(x._id) === pid(it))
        const a = p && !p.deletedAt ? Math.max(0, available(p) - get(p._id)) : 0
        if (a <= 0) {
            missing.push(p?.name || it.product?.name || "товар")
            continue
        }
        add(p._id, Math.min(a, Number(it.quantity) || 0))
        added++
    }
    toast({
        type: added ? (missing.length ? "warning" : "success") : "error",
        title: added ? `В корзине ${added} из ${items.length} ${plural(items.length, ["позиции", "позиций", "позиций"])}` : "Ничего не добавлено",
        text: missing.length ? `Нет в наличии: ${missing.join(", ")}` : "Количества как в заказе №" + o.orderNumber,
        action: added ? { label: "В корзину", fn: () => router.push("/cart") } : null
    })
}
