/**
 * Copyright 2026 Lord_mahor
 * Licensed under Apache 2.0
 */

const HOUR = 3600 * 1000
const DAY = 24 * HOUR
const MSK = 3 * HOUR

/** День по Москве, ГГГГ-ММ-ДД — так же считает сервер. back — сколько дней назад. */
export const mskDay = (back = 0, now = Date.now()) => new Date(now + MSK - back * DAY).toISOString().slice(0, 10)

/** Первое число месяца на back месяцев раньше нынешнего (по Москве): длинный период считается целыми месяцами. */
export const monthStart = (back = 0, now = Date.now()) => {
    const d = mskDay(0, now)
    const total = +d.slice(0, 4) * 12 + (+d.slice(5, 7) - 1) - back
    return Math.floor(total / 12) + "-" + String((total % 12) + 1).padStart(2, "0") + "-01"
}

/** Длительность: «45 с», «12 мин», «3 ч 20 мин». */
export const dur = (ms) => {
    const s = Math.round((ms || 0) / 1000)
    if (s < 60) return s + " с"
    const m = Math.round(s / 60)
    if (m < 60) return m + " мин"
    return Math.floor(m / 60) + " ч" + (m % 60 ? " " + (m % 60) + " мин" : "")
}

/** «19.11» из ГГГГ-ММ-ДД. */
export const dm = (day) => (day ? day.slice(8, 10) + "." + day.slice(5, 7) : "")

/** Все дни периода подряд (и те, в которые никто не заходил): [{ day, users, opens, clicks, ms }]. */
export function fillDays(from, to, rows = []) {
    const by = new Map(rows.map((r) => [r.day, r]))
    const out = []
    for (let t = Date.parse(from + "T00:00:00Z"); t <= Date.parse(to + "T00:00:00Z"); t += DAY) {
        const day = new Date(t).toISOString().slice(0, 10)
        out.push(by.get(day) || { day, users: 0, opens: 0, clicks: 0, ms: 0 })
    }
    return out
}

/** «14:00» из ГГГГ-ММ-ДДTЧЧ (час по Москве). */
export const hh = (hour) => (hour ? hour.slice(11, 13) + ":00" : "")

/** Все часы периода подряд (и пустые): [{ hour, users, opens, clicks, ms }]. from и to — часы ГГГГ-ММ-ДДTЧЧ по Москве. */
export function fillHours(from, to, rows = []) {
    const by = new Map(rows.map((r) => [r.hour, r]))
    const out = []
    for (let t = Date.parse(from + ":00:00Z"); t <= Date.parse(to + ":00:00Z"); t += HOUR) {
        const hour = new Date(t).toISOString().slice(0, 13)
        out.push(by.get(hour) || { hour, users: 0, opens: 0, clicks: 0, ms: 0 })
    }
    return out
}

const MONTHS = ["янв", "фев", "мар", "апр", "май", "июн", "июл", "авг", "сен", "окт", "ноя", "дек"]
/** «ноя 26» из ГГГГ-ММ. */
export const my = (month) => (month ? MONTHS[+month.slice(5, 7) - 1] + " " + month.slice(2, 4) : "")

/** Все месяцы периода подряд (и пустые): [{ month, users, opens, clicks, ms }]. from и to — дни ГГГГ-ММ-ДД. */
export function fillMonths(from, to, rows = []) {
    const by = new Map(rows.map((r) => [r.month, r]))
    const out = []
    let [y, m] = [+from.slice(0, 4), +from.slice(5, 7)]
    for (; y * 12 + m <= +to.slice(0, 4) * 12 + +to.slice(5, 7); m === 12 ? (y++, (m = 1)) : m++) {
        const month = y + "-" + String(m).padStart(2, "0")
        out.push(by.get(month) || { month, users: 0, opens: 0, clicks: 0, ms: 0 })
    }
    return out
}

/** Роли элемента одной строкой: «Кладовщик 380 · Казначей 20». */
export const rolesLine = (roles = []) =>
    [...roles]
        .sort((a, b) => b.clicks - a.clicks)
        .slice(0, 4)
        .map((r) => `${r.role || "без роли"} ${r.clicks}`)
        .join(" · ")
