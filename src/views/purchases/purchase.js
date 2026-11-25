/**
 * Copyright 2026 Lord_mahor
 * Licensed under Apache 2.0
 */

import { money, pcs } from "@/domain/format"
import { ownerId } from "@/domain/orders"
import { available, pid } from "@/domain/stock"
import { reactive } from "vue"

/* Закупка: статусы, права, ход, цель. Флаги сервера: isCreated (создана) → isPaid (оплачена) → partialCompleted / isCompleted (приёмка). */
export const PST = {
    draft: { label: "Черновик", st: "new" },
    unpaid: { label: "Ожидание оплаты", st: "paid" },
    receiving: { label: "Ожидание получения", st: "ready" },
    partial: { label: "Частично получена", st: "partial" },
    done: { label: "Завершена", st: "done" }
}
export const pst = (pu) => (pu.isCompleted ? "done" : !pu.isCreated ? "draft" : !pu.isPaid ? "unpaid" : pu.partialCompleted ? "partial" : "receiving")
export const STEP = { draft: 0, unpaid: 1, receiving: 2, partial: 2, done: 3 }

/** Права на закупку pu (без неё — право начать новую). Без галочки «Служащий» человек меняет только закупки, которые создал сам, — как на сервере. */
export const puPerm = (s, pu) => {
    const mine = !pu || s.isStaff || ownerId(pu) === String(s.user?._id)
    return {
        create: mine && s.can("create_purchases"),
        edit: mine && s.can("edit_purchases"),
        pay: mine && s.can("approve-payment"),
        exceed: s.isSys || s.can("approve_target_exceed"),
        del: mine && s.can("delete_purchases")
    }
}

export const sum = (arr, fn) => arr.reduce((s, x) => s + (fn(x) || 0), 0)
/** Позиции с количеством: черновик сервер создаёт со всеми товарами по 0. */
export const puItems = (pu) => (pu.items || []).filter((i) => i.quantity > 0)
/** Цены строк закреплены: после оплаты или в созданной закупке с заказом lit-na.ru (там цены сайта). Черновик с оформляемым заказом — по текущим. */
export const puFixed = (pu) => !!(pu?.isPaid || (pu?.litna && pu.isCreated))
/**
 * Сумма закупки: при закреплённых ценах — записанная сервером (смена цены товара её не меняет);
 * иначе — по текущим ценам; если цены товара нет (его нет в каталоге) — тоже сумма, сохранённая сервером.
 */
export function puTotal(pu, priceOf) {
    if (puFixed(pu) && pu.totalAmount) return pu.totalAmount
    let s = 0
    for (const i of puItems(pu)) {
        const price = priceOf(pid(i))
        if (price == null) return pu.totalAmount || 0
        s += price * i.quantity
    }
    return s
}
/** Товар строки с её ценой: при закреплённых ценах — записанная в закупке (у старых закупок её может не быть), иначе — текущая. */
export const puLineProduct = (pu, it, p) => (puFixed(pu) && typeof it.price === "number" && it.price !== p.price ? { ...p, price: it.price } : p)
/** К оплате: у созданной закупки с заказом lit-na.ru — сумма заказа с доставкой (в сумму закупки доставка не входит), иначе — сумма закупки. */
export const puPayTotal = (pu, total) => (pu?.isCreated && pu.litna?.total) || total
export const puPieces = (pu) => sum(puItems(pu), (i) => i.quantity)
export const puGot = (pu) => sum(puItems(pu), (i) => i.confirmedQuantity || 0)

/** Чей ход: { mine, short, text }. total — сумма, left — сколько не довезли, got — сколько принято. */
export function puTurn(st, pm, { total = 0, left = 0, got = 0 } = {}) {
    if (st === "draft") return pm.edit ? { mine: true, short: "Заполните и создайте", text: "Заполните количества и создайте закупку" } : { short: "Собирается", text: "Закупка собирается" }
    if (st === "unpaid") return pm.pay ? { mine: true, short: "Оплатите", text: `Оплатите ${money(total)} поставщику` } : { short: "Ждёт оплаты", text: "Ждёт оплаты" }
    if (st === "receiving") return pm.edit ? { mine: true, short: "Примите товар", text: "Примите товар на склад" } : { short: "Ждёт приёмки", text: "Оплачена, ждёт приёмки на складе" }
    if (st === "partial") return pm.edit ? { mine: true, short: `Довнесите ${pcs(left)}`, text: `Довнесите ${pcs(left)}, когда довезут` } : { short: `Не довезли ${pcs(left)}`, text: `Не довезли ${pcs(left)}` }
    return { short: "Принята", text: `Принята полностью, склад пополнен на ${pcs(got)}` }
}

/** Сколько не хватает до цели с учётом активных заказов (цель − доступно). */
export const needOf = (p) => {
    const t = Number(p?.targetQty) || 0
    return t > 0 ? Math.max(0, t - available(p)) : 0
}
/**
 * Превышение цели: на сколько штук больше цели (0 — нет). Как на сервере: без права потолок — большее из цели и прежнего
 * количества позиции (base); с правом превышение только показывается.
 */
export const overBy = (p, q, base, exceed) => {
    const t = Number(p?.targetQty) || 0
    if (t <= 0) return 0
    return q > (exceed ? t : Math.max(t, base || 0)) ? q - t : 0
}

/** Тело PUT /purchases/:id: при создании уходят только позиции с количеством, иначе все (состав сверяет сервер). null — нечего отправлять. */
export function puPayload(rows, flags, creating = false) {
    const list = creating ? rows.filter((r) => r.quantity > 0 && !r.confirmedQuantity) : rows
    if (!list.length) return null
    return { ...flags, items: list.map((r) => ({ product: r.product, quantity: Number(r.quantity) || 0, confirmedQuantity: Number(r.confirmedQuantity) || 0 })) }
}

/* Несохранённые правки закупок живут, пока открыто приложение: переход к товару и обратно их не теряет.
   qty — количества черновика, added — новые позиции неоплаченной, rcv — принятое; хранятся только изменённые. */
const drafts = reactive({})
export function draftOf(id) {
    if (!drafts[id]) drafts[id] = { qty: {}, rcv: {}, added: {}, touched: {}, view: null, kind: "", q: "" }
    return drafts[id]
}
export function dropEdits(d) {
    d.qty = {}
    d.rcv = {}
    d.added = {}
    d.touched = {}
}
/** Статус закупки сменился (в том числе на другом устройстве) — несохранённый ввод прежнего этапа и его подборка сбрасываются. */
export function syncDraft(d, st) {
    if (d.st && d.st !== st) {
        dropEdits(d)
        d.view = null
        d.kind = ""
    }
    d.st = st
}
/** Количество позиции l с учётом несохранённого: правки черновика действуют только в черновике, новые позиции — только в неоплаченной. */
export const qtyIn = (d, l, mode) => (l.added ? (mode === "unpaid" ? d.added[l._id] : 0) : mode === "draft" ? (d.qty[l._id] ?? l.q0) : l.q0) || 0
/** Принято с учётом ввода: не больше заказанного и не меньше уже принятого на сервере — ввод мог устареть, пока принимали с другого устройства. */
export const rcvIn = (d, l) => Math.max(l.conf, Math.min(l.q0, d.rcv[l._id] ?? l.conf))

/** Фильтр и поиск списка закупок — сохраняются при возврате из закупки. */
export const listState = reactive({ f: null, q: "" })
