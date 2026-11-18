/**
 * Copyright 2026 Lord_mahor
 * Licensed under Apache 2.0
 */

import { homePath, tabsFor, visibleNav } from "@/domain/nav"
import { orderTurn, ownerId } from "@/domain/orders"
import { deficit } from "@/domain/stock"
import { useActiveOrders, useInventoryLock, useProducts, usePurchases } from "@/service/queries"
import { computed } from "vue"
import { useCart } from "./useCart"
import { useSession } from "./useSession"

/**
 * Разделы по правам, нижнее меню телефона, домашний раздел и значки: badges.value = { [id раздела]: { n, tone } }.
 * Значок «Заказы» — сколько заказов ждёт действия пользователя (золотой), иначе сколько в работе (серый);
 * «Закупка» — неоплаченные для того, кто платит, иначе созданные незавершённые; «Каталог» — штук в корзине.
 */
export function useNav() {
    const { plain, can, user } = useSession()
    const { count } = useCart()
    const { data: products } = useProducts()
    const { data: orders } = useActiveOrders()
    const { data: purchases } = usePurchases()
    const { frozen } = useInventoryLock()

    const items = computed(() => visibleNav(plain.value))
    const tabs = computed(() => tabsFor(plain.value))
    const home = computed(() => homePath(plain.value))

    const ordersBadge = computed(() => {
        const s = plain.value
        const act = (orders.value || []).filter((o) => !o.isCompleted)
        const def = deficit(products.value, act).orders
        const mine = (list) => list.filter((o) => orderTurn(o, s, { deficit: !!def[o._id], frozen: frozen.value }).mine).length
        const staff = s.isSys || (!!s.user?.isAdmin && (can("edit_orders") || can("approve-payment")))
        const pool = staff ? act : act.filter((o) => ownerId(o) === String(user.value?._id))
        const n = mine(pool)
        return n ? { n, tone: "accent" } : { n: pool.length, tone: "neutral" }
    })
    const purchasesBadge = computed(() => {
        const act = (purchases.value || []).filter((p) => p.isCreated && !p.isCompleted)
        const unpaid = act.filter((p) => !p.isPaid).length
        return can("approve-payment") && unpaid ? { n: unpaid, tone: "accent" } : { n: act.length, tone: "neutral" }
    })
    const badges = computed(() => ({
        storage: can("create_orders") ? { n: count.value, tone: "accent" } : null,
        orders: ordersBadge.value,
        purchases: purchasesBadge.value
    }))
    return { items, tabs, home, badges }
}
