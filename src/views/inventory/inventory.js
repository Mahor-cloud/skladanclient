/**
 * Copyright 2026 Lord_mahor
 * Licensed under Apache 2.0
 */

import { money } from "@/domain/format"
import { pid } from "@/domain/stock"

export const MINUS = "−"
export const sgnMoney = (n) => (n > 0 ? "+" : n < 0 ? MINUS : "") + money(Math.abs(n))
export const diffTone = (n) => (n < 0 ? "neg" : n > 0 ? "warn" : "pos")

/** Факт позиции: из черновика (facts по id товара), иначе сохранённый newQuantity. */
export const factOf = (it, facts) => Number(facts?.[pid(it)] ?? it.newQuantity) || 0

/**
 * Цена позиции: записанная в ней (сервер пишет её при завершении инвентаризации, смена цены товара её не меняет),
 * у открытой инвентаризации и у старых завершённых без цены в строке — текущая цена товара.
 */
export const invPrice = (it) => Number(typeof it.price === "number" ? it.price : it.product?.price) || 0

/** Итоги инвентаризации по ценам позиций (invPrice). Позиции без товара (не нашёлся) не считаются. */
export function invStats(items = [], facts) {
    const s = { short: 0, plus: 0, shortSum: 0, plusSum: 0, devN: 0, shortN: 0, plusN: 0, factValue: 0, startValue: 0, diff: 0 }
    for (const it of items) {
        if (!it.product?._id) continue
        const price = invPrice(it)
        const start = Number(it.quantity) || 0
        const f = factOf(it, facts)
        const dv = f - start
        s.factValue += f * price
        s.startValue += start * price
        if (dv) s.devN++
        if (dv < 0) {
            s.shortN++
            s.short -= dv
            s.shortSum -= dv * price
        }
        if (dv > 0) {
            s.plusN++
            s.plus += dv
            s.plusSum += dv * price
        }
    }
    s.diff = s.factValue - s.startValue
    return s
}

/** Сохранённый факт по позициям: { [id товара]: newQuantity } — и из GET (товар объектом), и из ответа PUT (товар id). */
export const factsOf = (items = []) => Object.fromEntries(items.map((it) => [pid(it), Number(it.newQuantity) || 0]))

/**
 * Свежие данные сервера поверх черновика { base, facts, comment, baseComment }. Сервер заменяет позиции целиком,
 * поэтому строки, которые пользователь не трогал (значение = прежней базе), берут свежее значение — иначе сохранение
 * затёрло бы чужой факт; тронутые остаются его (при сохранении победит он). Комментарий — по тому же правилу.
 */
export function mergeFresh(d, fresh, freshComment = "") {
    const touched = (k) => !!d.facts && k in d.facts && d.facts[k] !== d.base?.[k]
    const facts = {}
    for (const k in fresh) facts[k] = touched(k) ? d.facts[k] : fresh[k]
    const comment = d.facts && d.comment !== d.baseComment ? d.comment : freshComment
    return { base: { ...fresh }, facts, baseComment: freshComment, comment }
}

/** Самая поздняя по дате начала — править можно только её (сервер проверяет то же). */
export const latestId = (list = []) => list.reduce((a, b) => ((b.startDate || 0) > (a?.startDate || 0) ? b : a), null)?._id ?? null
