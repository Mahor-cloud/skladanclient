/**
 * Copyright 2026 Lord_mahor
 * Licensed under Apache 2.0
 */

import { money } from "./format"
import { pid } from "./stock"

export const STATUS = {
    new: { label: "Новый", step: 0 },
    paid: { label: "Оплачен", step: 1 },
    ready: { label: "К выдаче", step: 2 },
    done: { label: "Завершён", step: 3 }
}
export const orderStatus = (o) => (o.isCompleted ? "done" : o.confirmedPaid ? "ready" : o.isPaid ? "paid" : "new")

export const ownerId = (o) => String(o?.user?._id ?? o?.user ?? "")
export const orderPieces = (o) => (o.items || []).reduce((s, it) => s + (Number(it.quantity) || 0), 0)

/** Сумма заказа: серверная totalAmount; у старых заказов без неё — по текущим ценам товаров (priceOf(productId)). */
export const orderTotal = (o, priceOf = () => 0) => o.totalAmount || (o.items || []).reduce((s, it) => s + (Number(it.product?.price ?? priceOf(pid(it))) || 0) * (Number(it.quantity) || 0), 0)

/**
 * Доплата (> 0) или возврат (< 0), ждущие подтверждения: событие «требуется доплата / возврат» последней правки позиций.
 * Правка пишет «позиции изменены» и следом разницу; нет разницы после неё — заказ вернулся к внесённой сумме, прежняя плашка снимается.
 */
export const orderDiff = (o) => {
    if (!o.isPaid || o.confirmedPaid) return 0
    const ev = o.paymentEvents || []
    for (let i = ev.length - 1; i >= 0; i--) {
        if (ev[i].type === "surcharge-pending" || ev[i].type === "refund-pending") return ev[i].amount || 0
        if (ev[i].type === "payment-confirmed" || ev[i].type === "items-changed") return 0
    }
    return 0
}

/**
 * Права на действия с заказом. s — сессия ({ user, can, isSys }), env — { deficit: заказ задет дефицитом, frozen: идёт инвентаризация }.
 * «Служащий» (user.isAdmin) нужен вместе с правом для чужих заказов и подтверждения оплаты; системная роль может всё.
 */
export const orderPerms = (o, s, { deficit = false, frozen = false } = {}) => {
    const own = ownerId(o) === String(s.user?._id)
    const staffEdit = s.isSys || (!!s.user?.isAdmin && s.can("edit_orders"))
    const approver = s.isSys || (!!s.user?.isAdmin && s.can("approve-payment"))
    const st = orderStatus(o)
    const view = own || staffEdit || approver
    const p = {
        own,
        staffEdit,
        approver,
        view,
        pay: st === "new" && (own || staffEdit),
        confirm: st === "paid" && approver,
        waiting: st === "paid" && !approver && (own || staffEdit),
        complete: st === "ready" && (own || staffEdit),
        edit: st === "done" ? !!s.isSys : staffEdit || (own && !o.confirmedPaid),
        cancel: st !== "done" && (own || staffEdit),
        remove: st === "done" && !!s.isSys,
        invoice: view
    }
    p.blocked = p.complete && deficit
    p.frozen = p.complete && !p.blocked && frozen
    return p
}

/** Что дальше — одна фраза для списков и карточки заказа: действие или «ждёт …». */
export const orderTurn = (o, s, { deficit = false, frozen = false } = {}) => {
    const st = orderStatus(o)
    const own = ownerId(o) === String(s.user?._id)
    const who = o.user?.name || "заказчик"
    const diff = orderDiff(o)
    if (st === "new") return own ? { mine: true, short: "Оплатите", text: "Переведите сумму по реквизитам и нажмите «Я оплатил»" } : { mine: false, short: "Ждёт оплаты", text: `Ждёт оплаты от группы «${who}»` }
    if (st === "paid") {
        const tre = orderPerms(o, s).approver
        if (diff > 0)
            return tre
                ? { mine: true, short: `Доплата ${money(diff)}`, text: `Состав изменили — проверьте доплату ${money(diff)} и подтвердите` }
                : { mine: own, short: `Доплата ${money(diff)}`, text: own ? `Переведите доплату ${money(diff)} и ждите подтверждения` : `Ждёт доплаты ${money(diff)} и подтверждения` }
        if (diff < 0) return tre ? { mine: true, short: `Возврат ${money(-diff)}`, text: `Сумма уменьшилась — верните ${money(-diff)} и подтвердите возврат` } : { mine: false, short: `Возврат ${money(-diff)}`, text: `Ждёт возврата ${money(-diff)}` }
        return tre ? { mine: true, short: "Подтвердите", text: "Проверьте поступление и подтвердите оплату" } : { mine: false, short: "Ждёт подтверждения", text: "Ждёт подтверждения оплаты" }
    }
    if (st === "ready") {
        if (deficit) return { mine: false, warn: true, short: "Дефицит на складе", text: "Не хватает товара на складе — выдача и завершение заблокированы" }
        if (frozen)
            return own
                ? { mine: false, frozen: true, short: "Выдача после инвентаризации", text: "Идёт инвентаризация — заказ выдадут после её завершения" }
                : { mine: false, frozen: true, short: "Выдача заморожена", text: "Идёт инвентаризация — выдача заморожена до её завершения" }
        if (own) return { mine: true, short: "Можно забирать", text: "Заберите заказ и нажмите «Заказ получен»" }
        if (orderPerms(o, s).staffEdit) return { mine: true, short: "Выдайте", text: "Выдайте заказ и завершите его" }
        return { mine: false, short: "Ждёт выдачи", text: "Оплата подтверждена, заказ ждёт выдачи" }
    }
    return { mine: false, short: "Получен", text: "Заказ получен" }
}

/** Шаги трекера: done — шаг пройден, at — когда (из платёжных событий; времени завершения сервер не хранит). */
export const orderSteps = (o) => {
    const ev = o.paymentEvents || []
    const last = (t) => [...ev].reverse().find((e) => e.type === t)
    return [
        { key: "new", label: "Новый", sub: "Заказ оформлен", done: true, at: o.orderDate },
        { key: "paid", label: "Оплачен", sub: "Заказчик отметил оплату", done: !!o.isPaid, at: o.isPaid ? last("paid")?.at || null : null },
        { key: "ready", label: "К выдаче", sub: "Оплата подтверждена", done: !!o.confirmedPaid, at: o.confirmedPaid ? last("payment-confirmed")?.at || null : null },
        { key: "done", label: "Завершён", sub: "Заказ получен", done: !!o.isCompleted, at: null }
    ]
}
