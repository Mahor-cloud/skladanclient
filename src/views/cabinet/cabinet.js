/**
 * Copyright 2026 Lord_mahor
 * Licensed under Apache 2.0
 */

// Строка «Моего склада» с сервера (GET /cabinet/merged): товар — по productId, своя позиция — по cabinetItemId.
export const rowKey = (r) => r.productId || r.cabinetItemId
export const CAB = Symbol("cabinet")

/** Итоги «Моего склада» по текущим (в том числе ещё не сохранённым) значениям: val(r, поле) → число, availOf(r) → доступно на складе. */
export function cabStats(rows, val, availOf) {
    const s = { tracked: 0, own: 0, needN: 0, needPcs: 0, defSum: 0, stock: [], availN: 0, availSum: 0, overN: 0, overPcs: 0 }
    for (const r of rows) {
        const base = val(r, "baseQty")
        const have = val(r, "currentQty")
        const ord = r.inOrderQty || 0
        const need = Math.max(0, base - have - ord)
        if (r.isCustom) s.own++
        if (r.isCustom || base > 0 || have > 0 || ord > 0) s.tracked++
        if (base > 0 && have > base) {
            s.overN++
            s.overPcs += have - base
        }
        if (!need) continue
        s.needN++
        s.needPcs += need
        // Своя позиция не со склада: в деньги дефицита и в корзину не идёт.
        if (r.isCustom) continue
        s.defSum += need * (r.price || 0)
        s.stock.push(r)
        const a = availOf(r)
        if (a > 0) {
            s.availN++
            s.availSum += Math.min(need, a) * (r.price || 0)
        }
    }
    return s
}

/**
 * Автозаполнение корзины по ответу POST /cabinet/autofill: недостающее кладётся в корзину, но не меньше уже лежащего.
 * Чего на складе не хватает — кладётся сколько есть и попадает в перечень; своя позиция — только в перечень.
 * → { cart: новая корзина, added: сколько позиций увеличено, miss: строки перечня }
 */
export function autofill(cart, suggestions) {
    const next = { ...cart }
    let added = 0
    const miss = []
    for (const s of suggestions || []) {
        if (!(s.neededQty > 0)) continue
        if (!s.product) {
            miss.push(`${s.productName} (своя позиция)`)
            continue
        }
        let want = s.neededQty
        if (s.isMissing) {
            miss.push(`${s.productName} — нужно ${s.neededQty}, доступно ${s.availableQty}`)
            if (!(s.availableQty > 0)) continue
            want = s.availableQty
        }
        if ((next[s.product] || 0) < want) {
            next[s.product] = want
            added++
        }
    }
    return { cart: next, added, miss }
}

/** Полоса сводки: доли «есть у групп», «в заказах», «дефицит» от суммы целей, в процентах, вместе не больше 100. */
export function sumBar(goal, have, ord, def) {
    const g = Math.max(goal, 1)
    const seg = (v) => Math.round((Math.min(v, g) / g) * 100)
    const hv = seg(have)
    const od = Math.min(seg(ord), 100 - hv)
    return { hv, od, df: Math.min(seg(def), 100 - hv - od) }
}

/**
 * Склады по группам из GET /cabinet/all: группы по имени (А→Я), в каждой — позиции с целью или запасом, сначала больший дефицит
 * (цель − у них). → [{ user, items: [{ _id, x, name, own, def }] }]
 */
export function cabinetGroups(all) {
    const by = new Map()
    for (const x of all || []) {
        const u = x.user
        if (!u?._id) continue
        const id = String(u._id)
        if (!by.has(id)) by.set(id, { user: { _id: id, name: u.name || u.login || "—", login: u.login || "" }, items: [] })
        if (!x.baseQty && !x.currentQty) continue
        by.get(id).items.push({ _id: String(x._id), x, name: x.product ? x.product.name : x.customName, own: !x.product, def: Math.max(0, (x.baseQty || 0) - (x.currentQty || 0)) })
    }
    const groups = [...by.values()].sort((a, b) => a.user.name.localeCompare(b.user.name, "ru"))
    for (const g of groups) g.items.sort((a, b) => b.def - a.def)
    return groups
}
