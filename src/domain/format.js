/**
 * Copyright 2026 Lord_mahor
 * Licensed under Apache 2.0
 */

const nf = new Intl.NumberFormat("ru-RU")
const NB = " "
const MONTHS = ["января", "февраля", "марта", "апреля", "мая", "июня", "июля", "августа", "сентября", "октября", "ноября", "декабря"]
const pad = (n) => String(n).padStart(2, "0")
const day = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()

export const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c])

/** Постоянное число по строке — цвет аватара и обложки не меняется между запусками. */
export const hash = (s) => {
    let h = 0
    for (const c of String(s)) h = (h * 31 + c.charCodeAt(0)) | 0
    return Math.abs(h)
}

export const num = (n) => nf.format(Math.round(n || 0))
export const money = (n) => num(n) + NB + "₽"
export const date = (ts) => {
    const d = new Date(ts)
    return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()}`
}
export const time = (ts) => {
    const d = new Date(ts)
    return `${pad(d.getHours())}:${pad(d.getMinutes())}`
}
export const dateTime = (ts) => date(ts) + ", " + time(ts)
/** «сегодня, 14:20» · «вчера, 09:05» · «3 ноября, 18:45» */
export const rel = (ts, now = new Date()) => {
    const d = new Date(ts)
    const diff = Math.round((day(now) - day(d)) / 864e5)
    if (diff === 0) return "сегодня, " + time(ts)
    if (diff === 1) return "вчера, " + time(ts)
    return `${d.getDate()} ${MONTHS[d.getMonth()]}, ${time(ts)}`
}
export const short = (ts) => {
    const d = new Date(ts)
    return `${d.getDate()} ${MONTHS[d.getMonth()].slice(0, 3)}`
}
/** plural(3, ["товар", "товара", "товаров"]) → «товара» */
export const plural = (n, f) => {
    const a = Math.abs(n) % 100
    const b = a % 10
    return a > 10 && a < 20 ? f[2] : b > 1 && b < 5 ? f[1] : b === 1 ? f[0] : f[2]
}
export const pcs = (n) => num(n) + NB + "шт."
export const positions = (n) => n + NB + plural(n, ["позиция", "позиции", "позиций"])
