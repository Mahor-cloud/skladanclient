/**
 * Copyright 2026 Lord_mahor
 * Licensed under Apache 2.0
 */

import { money } from "@/domain/format"
import { orderStatus } from "@/domain/orders"
import { available } from "@/domain/stock"
import { reactive } from "vue"

// Фильтр, поиск и «Показать все» живут, пока открыта вкладка: открытие заказа и возврат к списку их не сбрасывают.
export const view = reactive({ f: "", q: "", all: false })

export const FILTERS = {
    all: { label: "Все", fn: () => true },
    active: { label: "Все активные", fn: (o) => !o.isCompleted },
    new: { label: "Новые", fn: (o) => orderStatus(o) === "new" },
    paid: { label: "Ждут подтверждения", fn: (o) => orderStatus(o) === "paid" },
    ready: { label: "К выдаче", fn: (o) => orderStatus(o) === "ready" },
    done: { label: "Завершённые", fn: (o) => !!o.isCompleted }
}

export const EVENT = {
    paid: ["Заказчик отметил оплату", "success"],
    "payment-confirmed": ["Оплата подтверждена", "success"],
    "items-changed": ["Изменены позиции", "neutral"],
    "surcharge-pending": ["Требуется доплата", "warning"],
    "refund-pending": ["Требуется возврат", "teal"],
    "surcharge-confirmed": ["Доплата подтверждена", "success"],
    "refund-confirmed": ["Возврат подтверждён", "success"]
}

/** Дефицит, задевший заказ: строки GET /orders/shortages с его id. */
export const orderShortages = (shortages, id) => (shortages || []).filter((s) => s.orderIds.includes(String(id)))

/**
 * Строки заказа из GET /orders/:id (товар позиции подставлен сервером): { p, qty, bad, note }.
 * Цена строки (p.price): у оплаченного (и любого завершённого) заказа — записанная в самом заказе, сервер фиксирует её вместе с суммой, и смена цены
 * товара её не меняет; у неоплаченного — текущая цена товара, по ней сервер посчитает сумму при оплате.
 * У старых заказов без цены в строке — текущая цена товара.
 */
export const orderLines = (o, shortages = []) =>
    (o?.items || []).map((it, i) => {
        const product = it.product || { _id: "gone-" + i, name: "Удалённый товар", price: 0, category: "" }
        const p = (o.isPaid || o.isCompleted) && typeof it.price === "number" ? { ...product, price: it.price } : product
        const d = shortages.find((s) => s.product === String(p._id))
        return { p, qty: Number(it.quantity) || 0, bad: !!d, note: d ? `Дефицит: нужно ${d.required}, на складе ${d.inStock}` : p.deletedAt ? "удалён из каталога" : "" }
    })
export const linesTotal = (lines) => lines.reduce((s, x) => s + (Number(x.p.price) || 0) * (Number(x.qty) || 0), 0)
/** Позиции для PUT /orders/:id. */
export const linesPayload = (lines) => lines.map((x) => ({ product: x.p._id, quantity: Number(x.qty) || 1 }))

/** Флаги PUT /orders/:id по виду подтверждения: [isPaid, confirmedPaid, isCompleted]. */
export const ASK_FLAGS = { pay: [true, false, false], confirm: [true, true, false], complete: [true, true, true] }

/** Подтверждение ещё доступно по живым правам заказа (orderPerms). */
export const askAllowed = (kind, pm) => !!(kind === "pay" ? pm.pay : kind === "confirm" ? pm.confirm : kind === "complete" && pm.complete && !pm.blocked && !pm.frozen)

/**
 * Окно заказа устарело. ask — снимок при открытии { kind, id, sum, diff }, now — то же по заказу сейчас { id, pm, sum, diff }.
 * Любое окно — если открыт уже другой заказ; подтверждение — ещё и если действие стало недоступно или изменились суммы, названные в вопросе.
 */
export const askStale = (ask, now) => ask.id !== now.id || (ask.kind in ASK_FLAGS && (!askAllowed(ask.kind, now.pm) || ask.sum !== now.sum || ask.diff !== now.diff))

/**
 * Текст плашки доплаты (diff > 0) или возврата (diff < 0). «Оплачено» называется, только когда сумму сообщил сервер:
 * paidAmount он пишет при подтверждении оплаты, а до первого подтверждения достоверны лишь разница и новая сумма заказа.
 */
export const diffText = (o, diff) => {
    const confirmed = o.paidAmount > 0
    const todo = diff < 0 ? "подтвердить возврат" : confirmed ? "повторно подтвердить оплату" : "подтвердить оплату"
    return `Всего к оплате ${money(o.totalAmount)}${confirmed ? `, оплачено ${money(o.paidAmount)}` : ""}. Нужно ${todo}.`
}

/** Сколько можно поставить в заказ: свободный остаток плюс то, что уже в этом заказе (оно в резерве). Товара нет в каталоге — предел проверит сервер. */
export const maxQty = (product, inOrder = 0) => (product ? Math.max(0, available(product) + inOrder) : 9999)

/** Сумма заказа на экране: у оплаченного — записанная сервером (после отметки оплаты смена цены её не меняет), у неоплаченного — по ценам строк (текущим). */
export const orderSum = (o, lines) => ((o?.isPaid || o?.isCompleted) && o.totalAmount ? o.totalAmount : linesTotal(lines))

/**
 * Сколько заказчик реально внёс — как считает сервер: подтверждённая сумма (может быть и нулём: признак подтверждения — событие);
 * до подтверждения — сумма, на которую он отметил оплату (событие paid); у старых заказов без событий — сумма заказа.
 */
export const committed = (o) => {
    const ev = o.paymentEvents || []
    if (o.paidAmount > 0 || ev.some((e) => e.type === "payment-confirmed")) return o.paidAmount || 0
    return ev.find((e) => e.type === "paid")?.amount ?? (o.totalAmount || 0)
}

/**
 * Доплата (> 0) или возврат (< 0) после правки заказа — как у сервера: у оплаченного новая сумма минус внесённое (committed);
 * у завершённого — минус прежняя сумма заказа (подтверждения там нет, каждая правка рассчитывается отдельно).
 */
export const editDiff = (o, total) => (o.isCompleted ? total - (o.totalAmount || 0) : o.isPaid ? total - committed(o) : 0)

/** Состав не изменился: те же товары в тех же количествах (порядок не важен) — так же сравнивает сервер. */
export const sameItems = (a, b) => {
    const norm = (lines) =>
        lines
            .map((x) => `${x.p._id}:${x.qty}`)
            .sort()
            .join("|")
    return norm(a) === norm(b)
}
