/**
 * Copyright 2026 Lord_mahor
 * Licensed under Apache 2.0
 */

import { date, money, plural, short } from "@/domain/format"
import { reactive } from "vue"

// Фильтры и раскрытые блоки живут, пока открыто приложение: вернулся из заказа — статистика та же.
export const st = reactive({ p: "30", from: "", to: "", groups: [], products: [], mode: "sum", more: {}, olimit: 12, day: null })

export const PERIODS = [
    { value: "7", label: "7 дней" },
    { value: "30", label: "30 дней" },
    { value: "90", label: "Квартал" },
    { value: "all", label: "Всё время" },
    // Своих дат в прототипе нет (в старом экране были только они); значком — иначе фильтры не помещаются в строку на 1440 px.
    { value: "custom", icon: "calendar", title: "Период" }
]
const DAY = 864e5
const FALLBACK = Date.UTC(2020, 0, 1) // как раньше, если начало данных не узнать
const utcDay = (ts) => Math.floor(ts / DAY) * DAY
export const dayKey = (ts) => new Date(ts).toISOString().slice(0, 10)

/**
 * Период запроса. Сервер группирует дни по UTC, поэтому границы — полночь UTC: столбики дней сходятся с суммами показателей.
 * «С» и «По» — даты из поля (UTC-полночь), «По» включительно; начало «Всего времени» — первый документ (period-bounds).
 * open — период до «сейчас»: верхнюю границу не шлём, сервер берёт текущий момент, и обновление по realtime видит новые заказы.
 */
export function statRange({ p, from, to }, { now = Date.now(), bounds } = {}) {
    const start = utcDay(bounds ?? FALLBACK)
    if (p === "all") return { from: start, to: now, open: true }
    if (p === "custom") {
        const end = to ? Date.parse(to) + DAY : now
        return { from: from ? Date.parse(from) : start, to: Math.min(now, end), open: end >= now }
    }
    return { from: utcDay(now) - (Number(p) - 1) * DAY, to: now, open: true }
}
/** Параметры запроса показателей и CSV — как раньше: from, to, users, products. */
export function statQuery(range, { groups, products }) {
    const q = new URLSearchParams({ from: String(range.from) })
    if (!range.open) q.set("to", String(range.to))
    if (groups.length) q.set("users", groups.join(","))
    if (products.length) q.set("products", products.join(","))
    return q.toString()
}

/** Отметки столбиков от начала периода: шаг "day" | "week" | "month". */
function buckets(range, unit) {
    const out = []
    for (let t = range.from; t < range.to; ) {
        const d = new Date(t)
        const next = unit === "month" ? Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1) : t + (unit === "week" ? 7 : 1) * DAY
        out.push({ from: t, to: next })
        t = next
    }
    return out
}
const sumIn = (rows, b) => rows.reduce((s, r) => (r.date >= dayKey(b.from) && r.date < dayKey(b.to) ? s + (r.amount || 0) : s), 0)
const dayName = (ts) => new Date(ts).toLocaleDateString("ru-RU", { day: "numeric", month: "long", timeZone: "UTC" })
const noon = (ts) => dayKey(ts) + "T12:00" // местный полдень того же дня — подписи не съезжают из-за пояса
const label = (ts) => short(noon(ts))
/** «15.10.2026 — 13.11.2026» */
export const rangeText = (range) => `${date(noon(range.from))} — ${date(range.open ? range.to : noon(range.to - 1))}`

/** «Оборот по дням»: столбик на день; длиннее 100 дней — на неделю (такие не нажимаются). */
export function daySeries(range, ordersByDay = []) {
    const byWeek = (range.to - range.from) / DAY > 100
    const byKey = new Map(ordersByDay.map((r) => [r.date, r]))
    const groups = buckets(range, byWeek ? "week" : "day").map((b) => {
        const v = byWeek ? sumIn(ordersByDay, b) : byKey.get(dayKey(b.from))?.amount || 0
        if (byWeek) return { key: dayKey(b.from), l: label(b.from), v: [v], tip: `Неделя с ${dayName(b.from)}: ${v ? money(v) : "заказов нет"}` }
        const n = byKey.get(dayKey(b.from))?.ordersCount || 0
        return { key: dayKey(b.from), l: label(b.from), v: [v], n, tip: `${dayName(b.from)}: ${n ? `${n} ${plural(n, ["заказ", "заказа", "заказов"])} на ${money(v)}` : "заказов нет"}` }
    })
    return { byWeek, groups }
}

/** «Продажи и поступления» по неделям; дольше полугода — по месяцам, иначе столбики не помещаются на телефоне. */
export function flowSeries(range, ordersByDay = [], purchasesByDay = []) {
    const monthly = (range.to - range.from) / DAY > 26 * 7
    const ship = purchasesByDay.map((r) => ({ date: r.date, amount: r.shipping }))
    return buckets(range, monthly ? "month" : "week").map((b) => {
        const d = sumIn(ship, b)
        const v = [sumIn(ordersByDay, b), sumIn(purchasesByDay, b) + d]
        const t = monthly ? new Date(b.from).toLocaleDateString("ru-RU", { month: "long", year: "numeric", timeZone: "UTC" }) : "Неделя с " + date(noon(b.from))
        return { key: dayKey(b.from), l: label(b.from), v, tip: `${t}: Продажи ${money(v[0])} · Поступления ${money(v[1])}${d ? `, в т. ч. доставка ${money(d)}` : ""}` }
    })
}
/** Итоги «Продаж и поступлений»: s — продажи, r — поступления вместе с доставкой заказов lit-na.ru (сервер шлёт её отдельно, shipping), d — доставка. */
export function flowTotals(ordersByDay = [], purchasesByDay = []) {
    const add = (rows, k) => rows.reduce((a, r) => a + (r[k] || 0), 0)
    const d = add(purchasesByDay, "shipping")
    return { s: add(ordersByDay, "amount"), r: add(purchasesByDay, "amount") + d, d }
}

/** Верх шкалы — «круглое» число не меньше максимума. */
export const niceMax = (v) => {
    if (v <= 0) return 1
    const p = Math.pow(10, Math.floor(Math.log10(v)))
    return [1, 1.2, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10].map((m) => m * p).find((m) => m >= v)
}
/** Подпись шкалы с одной десятичной: «1,5 тыс», «2 млн». */
export const axisNum = (v) => (v >= 1e6 ? (v / 1e6).toFixed(v % 1e6 ? 1 : 0).replace(".", ",") + " млн" : v >= 1000 ? String(Math.round(v / 100) / 10).replace(".", ",") + " тыс" : String(Math.round(v)))

/** Товары с нулями: все товары (или выбранные), у кого не было продаж — 0; по убыванию sortKey. */
export function zeroFill(rows = [], products = [], selected = [], sortKey) {
    const sold = new Map(rows.map((r) => [String(r.productId), r]))
    return products
        .filter((p) => !selected.length || selected.includes(String(p._id)))
        .map((p) => sold.get(String(p._id)) || { productId: String(p._id), name: p.name, category: p.category, amount: 0, quantity: 0 })
        .sort((a, b) => (b[sortKey] || 0) - (a[sortKey] || 0))
}

/** Расхождения «получено − продано» с нулями, по убыванию |Δ|, при равенстве — по названию. */
export function flowRows(flow = [], products = [], selected = []) {
    const byId = new Map(flow.map((r) => [String(r.productId), r]))
    return products
        .filter((p) => !selected.length || selected.includes(String(p._id)))
        .map((p) => byId.get(String(p._id)) || { productId: String(p._id), name: p.name, category: p.category, received: 0, sold: 0, gap: 0 })
        .sort((a, b) => Math.abs(b.gap || 0) - Math.abs(a.gap || 0) || (a.name || "").localeCompare(b.name || "", "ru"))
}
