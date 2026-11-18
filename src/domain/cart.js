/**
 * Copyright 2026 Lord_mahor
 * Licensed under Apache 2.0
 */

import { available } from "./stock"

/** Строки корзины: [{ p, qty, max, bad }] — только товары, которые есть в каталоге; bad — в корзине больше, чем доступно. */
export const cartLines = (cart, products = []) => {
    const byId = new Map(products.map((p) => [String(p._id), p]))
    return Object.entries(cart || {})
        .map(([id, qty]) => ({ p: byId.get(String(id)), qty: Number(qty) || 0 }))
        .filter((x) => x.p && x.qty > 0)
        .map((x) => ({ ...x, max: Math.max(0, available(x.p)), bad: x.qty > Math.max(0, available(x.p)) }))
}
export const cartTotal = (lines) => lines.reduce((s, x) => s + (Number(x.p.price) || 0) * x.qty, 0)

/**
 * Сверка корзины со свежими остатками перед оформлением: чего нет — убрать, чего мало — уменьшить.
 * → { cart, corrections: ["Название: 5 → 3 (доступно)", "Название — нет на складе, убран из корзины"] }
 */
export const cartFix = (cart, fresh = []) => {
    const byId = new Map(fresh.map((p) => [String(p._id), p]))
    const next = {}
    const corrections = []
    for (const [id, qty] of Object.entries(cart || {})) {
        const p = byId.get(String(id))
        const avail = p ? available(p) : 0
        const want = Number(qty) || 0
        if (!p || avail <= 0) corrections.push(`${p?.name || "Товар"} — нет на складе, убран из корзины`)
        else if (want > avail) {
            next[id] = avail
            corrections.push(`${p.name}: ${want} → ${avail} (доступно)`)
        } else if (want > 0) next[id] = want
    }
    return { cart: next, corrections }
}
