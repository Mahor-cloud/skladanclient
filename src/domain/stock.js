/**
 * Copyright 2026 Lord_mahor
 * Licensed under Apache 2.0
 */

// Товар с сервера: quantity — доступно (физический остаток минус незавершённые заказы, бывает < 0), totalQuantity — физический остаток.
export const LOW = 5
export const available = (p) => Number(p?.quantity) || 0
export const physical = (p) => Number(p?.totalQuantity ?? p?.quantity) || 0
export const reserved = (p) => physical(p) - available(p)

/** Уровень остатка: deficit (в заказах больше, чем есть физически) · out · low · ok */
export const stockLevel = (p) => {
    const a = available(p)
    const res = reserved(p)
    const level = res > physical(p) ? "deficit" : a <= 0 ? "out" : a <= LOW ? "low" : "ok"
    return { level, a, reserved: res }
}

export const pid = (item) => String(item?.product?._id ?? item?.product ?? "")

/** Сколько едет в созданных непроведённых закупках: { [productId]: штук } */
export const incomingMap = (purchases = []) => {
    const m = {}
    for (const pu of purchases) {
        if (!pu.isCreated || pu.isCompleted) continue
        for (const it of pu.items || []) {
            const left = (it.quantity || 0) - (it.confirmedQuantity || 0)
            if (left > 0) m[pid(it)] = (m[pid(it)] || 0) + left
        }
    }
    return m
}

/** Дефицит: товары, которых в незавершённых заказах больше, чем на складе, и заказы, которые из-за этого нельзя завершить. */
export const deficit = (products = [], orders = []) => {
    const out = { products: [], orders: {} }
    for (const p of products) {
        if (reserved(p) <= physical(p)) continue
        const row = { p, need: reserved(p), have: physical(p), orders: [] }
        for (const o of orders) {
            if (o.isCompleted || !(o.items || []).some((it) => pid(it) === String(p._id))) continue
            row.orders.push(o.orderNumber)
            ;(out.orders[o._id] = out.orders[o._id] || []).push(row)
        }
        out.products.push(row)
    }
    return out
}

/** Быстрый поиск по любому полю: название, вид, цена, наличие. */
export const searchProducts = (products, q, incoming = {}) => {
    const norm = (s) =>
        String(s)
            .toLowerCase()
            .replace(/ё/g, "е")
            .replace(/ip\s*#\s*/g, "ip#")
    const terms = norm(q || "")
        .trim()
        .split(/\s+/)
        .filter(Boolean)
    if (!terms.length) return products
    return products.filter((p) => {
        const a = available(p)
        const hay = norm(`${p.name} ${p.category} ${p.price} ₽ ${a > 0 ? "в наличии есть " + (a <= LOW ? "мало" : "") : incoming[p._id] ? "ждет поставку" : "нет в наличии"}`)
        return terms.every((t) => hay.includes(t))
    })
}

/* Инвентаризация и открытые документы. Пока инвентаризация не завершена: выдача заказов и приёмка закупок заморожены всегда;
   создавать заказы и закупки можно, только если включена настройка местности allowInventoryWithOpenDocs. Товары менять нельзя. */
export const invFrozen = (inventory) => !!inventory
// Настройки не загружены (нет права view-messages, запрос упал) — запрет неизвестен: решает сервер (ACTIVE_INVENTORY), как раньше.
export const invLock = (inventory, msgs) => !!inventory && !!msgs && msgs.allowInventoryWithOpenDocs !== true
