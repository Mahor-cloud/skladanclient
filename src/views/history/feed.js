/**
 * Copyright 2026 Lord_mahor
 * Licensed under Apache 2.0
 */

import { reactive } from "vue"

// Фильтры и число показанных живут, пока открыто приложение: вернулся из закупки — лента та же.
// По умолчанию — месяц: вся лента за всё время — тысячи записей, перекачиваемых при каждом открытии и событии realtime.
export const hist = reactive({ g: "", p: "month", q: "", from: "", to: "", limit: 40 })
export const STEP = 40

export const EVENT_LABELS_RU = {
    "order-created": "Заказ создан",
    "order-updated": "Заказ обновлён",
    "order-deleted": "Заказ удалён",
    "order-surcharge-pending": "Требуется доплата",
    "order-refund-pending": "Требуется возврат",
    "purchase-created": "Закупка создана",
    "purchase-updated": "Закупка обновлена",
    "purchase-deleted": "Закупка удалена",
    "inventory-created": "Инвентаризация начата",
    "inventory-updated": "Инвентаризация обновлена",
    "inventory-edited-after-completion": "Завершённая инвентаризация переписана",
    "inventory-deleted": "Инвентаризация удалена",
    "inventory-deleted-after-completion": "Завершённая инвентаризация удалена",
    "product-created": "Товар создан",
    "product-updated": "Товар обновлён",
    "product-deleted": "Товар удалён",
    "user-created": "Пользователь создан",
    "user-updated": "Пользователь обновлён",
    "user-deleted": "Пользователь удалён",
    "role-created": "Роль создана",
    "role-updated": "Роль обновлена",
    "role-deleted": "Роль удалена"
}
export const eventLabel = (type) => EVENT_LABELS_RU[type] || type

/** Цвет записи по смыслу: create | update | delete | other (доплаты, возвраты и всё незнакомое). */
export function eventKind(type) {
    const t = String(type || "").toLowerCase()
    if (t.includes("delete") || t.includes("удал")) return "delete"
    if (t.includes("create") || t.includes("созда")) return "create"
    if (t.includes("update") || t.includes("edited") || t.includes("измен")) return "update"
    return "other"
}

export const GROUPS = { "": "Все события", orders: "Заказы", pay: "Доплаты и возвраты", purchases: "Закупки", inventory: "Инвентаризация", products: "Товары", people: "Люди и роли" }
export function eventGroup(type) {
    const t = String(type || "")
    if (/surcharge|refund/.test(t)) return "pay"
    const prefix = { order: "orders", purchase: "purchases", inventory: "inventory", product: "products", user: "people", role: "people" }
    return prefix[t.split("-")[0]] || ""
}

export const PERIODS = [
    { value: "all", label: "Всё время" },
    { value: "day", label: "День" },
    { value: "week", label: "Неделя" },
    { value: "month", label: "Месяц" },
    { value: "custom", label: "Период" }
]
const DAY = 864e5
/** Границы запроса: «С» и «По» — местные даты, «По» включительно; у готовых периодов верхней границы нет — новые записи видны сразу. */
export function histRange({ p, from, to }, now = Date.now()) {
    const span = { day: 1, week: 7, month: 30 }[p]
    if (span) return { from: now - span * DAY }
    if (p !== "custom") return {}
    return { from: from ? new Date(from + "T00:00").getTime() : undefined, to: to ? new Date(to + "T00:00").getTime() + DAY : undefined }
}

/** Тип событий и поиск (имя, тип, текст записи). */
export function histFilter(items, { g, q }) {
    const s = q.trim().toLowerCase()
    return items.filter((i) => {
        if (g && eventGroup(i.changeType) !== g) return false
        if (!s) return true
        return `${i.user?.name || ""} ${i.changeType || ""} ${eventLabel(i.changeType)} ${i.description || ""}`.toLowerCase().includes(s)
    })
}

const dayStart = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
export function dayTitle(ts, now = new Date()) {
    const d = new Date(ts)
    const diff = Math.round((dayStart(now) - dayStart(d)) / DAY)
    return diff === 0 ? "Сегодня" : diff === 1 ? "Вчера" : d.toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric" })
}
/** Подряд идущие записи одного местного дня: [{ title, items }]. */
export function byDay(list, now = new Date()) {
    const days = []
    for (const e of list) {
        const title = dayTitle(e.changeDate, now)
        if (days[days.length - 1]?.title !== title) days.push({ title, items: [] })
        days[days.length - 1].items.push(e)
    }
    return days
}

/** Номер заказа или закупки из записи — сервер пишет его только в описании. */
export function refNumber({ changeType, description }) {
    const g = eventGroup(changeType)
    const m = g === "orders" || g === "pay" ? String(description || "").match(/заказ[а-яё]*\s+(\d+)/i) : g === "purchases" ? String(description || "").match(/закупк[а-яё]*\s+(\d+)/i) : null
    return m ? { [g === "purchases" ? "purchase" : "order"]: m[1] } : {}
}
