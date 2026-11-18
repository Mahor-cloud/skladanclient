/**
 * Copyright 2026 Lord_mahor
 * Licensed under Apache 2.0
 */

import { useCart } from "@/composables/useCart"
import { useSession } from "@/composables/useSession"
import { cartFix, cartLines } from "@/domain/cart"
import { available } from "@/domain/stock"
import axiosInstance from "@/service/axios"
import { useInventoryLock, useProducts } from "@/service/queries"
import { toast } from "@/ui/overlay"
import { useQueryClient } from "@tanstack/vue-query"
import { ref } from "vue"
import { useRouter } from "vue-router"

/** Изменение количества в корзине с теми же сообщениями везде: карточка товара, лист товара, корзина справа и экран корзины. */
export function useCartQty() {
    const { get, set } = useCart()
    function setQty(p, next) {
        const max = Math.max(0, available(p))
        // Уменьшать можно всегда: товара могло стать меньше, чем уже лежит в корзине.
        if (next > max && next > get(p._id)) return toast({ type: "warning", title: "Больше нет на складе", text: `«${p.name}»: доступно ${max} шт.` })
        if (next <= 0) {
            const prev = get(p._id)
            set(p._id, 0)
            return toast({ type: "info", title: "Убрано из корзины", text: p.name, action: { label: "Вернуть", fn: () => set(p._id, prev) } })
        }
        set(p._id, next)
    }
    const clamped = (p, max) => toast({ type: "warning", title: "Количество уменьшено", text: `«${p.name}»: доступно максимум ${max} шт.` })
    return { setQty, clamped }
}

/**
 * Оформление заказа: сверка корзины со свежими остатками сервера (чего нет — убрать, чего мало — уменьшить и показать корзину заново),
 * затем заказ «Новый» и сразу его экран. pending — идёт оформление; lock — заказы нельзя создавать из-за инвентаризации;
 * sent — отправка без ответа: нехватку товара мог создать сам этот заказ, поэтому экраны корзины не помечают строки и не запрещают повторить.
 */
// Одно оформление на всё приложение: кнопка есть и на экране корзины, и в корзине справа.
const pending = ref(false)
export function useCheckout() {
    const router = useRouter()
    const queryClient = useQueryClient()
    const { can } = useSession()
    const { cart, replace, clear, orderKey, sent, markSent } = useCart()
    const { data: products } = useProducts()
    const { lock } = useInventoryLock()

    async function checkout() {
        // Число, набранное в степпере, применяется при потере фокуса — до сверки и отправки.
        document.activeElement?.blur?.()
        if (pending.value) return
        if (lock.value) return toast({ type: "error", title: "Заказ невозможен", text: "Идёт инвентаризация — создание заказов невозможно. Свяжитесь с администратором.", timeout: 8000 })
        pending.value = true
        try {
            // Эта корзина уже уходила на сервер, а ответа не было: заказ мог создаться и занять товар. Сверка с остатками
            // тогда уменьшила бы корзину и сменила ключ — получился бы второй заказ. Поэтому сразу отправка: сервер
            // сначала ищет заказ по ключу и только потом проверяет остатки.
            let fresh = null
            try {
                if (!sent.value) fresh = (await axiosInstance.get("/products")).data || []
            } catch {
                // сверка не удалась — остатки проверит сервер при создании заказа
            }
            if (fresh) {
                const fix = cartFix(cart, fresh)
                if (fix.corrections.length) {
                    replace(fix.cart)
                    queryClient.invalidateQueries({ queryKey: ["products"] })
                    return toast({ type: "warning", title: "Корзина скорректирована по остаткам", text: fix.corrections.slice(0, 6).join("; "), timeout: 9000 })
                }
            }
            // Повтор неподтверждённой отправки — прямо из корзины: каталог после перезапуска без сети может быть не загружен.
            const payload = sent.value ? Object.entries(cart).map(([product, quantity]) => ({ product, quantity })) : cartLines(cart, fresh || products.value).map((x) => ({ product: x.p._id, quantity: x.qty }))
            if (!payload.length) return toast({ type: "error", title: "Ошибка", text: "Корзина пуста или содержит некорректные данные" })
            const key = orderKey()
            markSent(true)
            const { data: order } = await axiosInstance.post("/orders", payload, { params: { key } })
            queryClient.invalidateQueries({ queryKey: ["orders"] })
            queryClient.invalidateQueries({ queryKey: ["order", order._id] })
            queryClient.invalidateQueries({ queryKey: ["products"] })
            const saved = { ...cart }
            clear()
            router.push({ name: "order", params: { id: order._id } })
            toast({ type: "success", title: `Заказ №${order.orderNumber} оформлен`, action: can("delete_orders") ? { label: "Отменить", fn: () => undo(order, saved) } : null })
        } catch (err) {
            const payload = err?.response?.data
            // Отказ самого оформления (400: остатки, инвентаризация, состав) — заказа с этим ключом точно нет:
            // следующая попытка снова сверит корзину с остатками. Прочие ответы (403, 429, 5xx) этого не гарантируют.
            if (err?.response?.status === 400) markSent(false)
            if (payload?.code === "ACTIVE_INVENTORY") toast({ type: "error", title: "Заказ невозможен", text: payload.message || "Идёт инвентаризация — создание заказов невозможно. Свяжитесь с администратором.", timeout: 8000 })
            else toast({ type: "error", title: "Ошибка", text: payload?.message || (err?.response ? err.message : "Нет связи с сервером"), timeout: 5000 })
            queryClient.invalidateQueries({ queryKey: ["products"] })
        } finally {
            pending.value = false
        }
    }

    // «Отменить» в уведомлении об оформлении: заказ удаляется, корзина возвращается.
    async function undo(order, saved) {
        try {
            await axiosInstance.delete(`/orders/${order._id}`)
            replace(saved)
            queryClient.invalidateQueries({ queryKey: ["orders"] })
            queryClient.invalidateQueries({ queryKey: ["products"] })
            router.push("/cart")
            toast({ type: "info", title: `Заказ №${order.orderNumber} отменён` })
        } catch (err) {
            toast({ type: "error", title: "Ошибка", text: err?.response?.data?.message || err.message, timeout: 5000 })
        }
    }

    return { checkout, pending, lock, sent }
}
