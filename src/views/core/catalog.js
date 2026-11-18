/**
 * Copyright 2026 Lord_mahor
 * Licensed under Apache 2.0
 */

import { pcs } from "@/domain/format"
import { physical, stockLevel } from "@/domain/stock"
import { reactive } from "vue"

// Поиск и фильтры каталога живут, пока открыто приложение: вернулся из заказа — список тот же.
export const filters = reactive({ q: "", kinds: [], avail: false, incoming: false, min: "", max: "", sort: "default", view: null })
export const filtersActive = () => filters.kinds.length + (filters.avail ? 1 : 0) + (filters.incoming ? 1 : 0) + (filters.min !== "" || filters.max !== "" ? 1 : 0)
export const resetFilters = (withSearch) => Object.assign(filters, { kinds: [], avail: false, incoming: false, min: "", max: "" }, withSearch ? { q: "" } : {})

/** Строка остатка под названием товара: { cls, text }. Служащий видит дефицит и сколько едет. */
export function stockLine(p, incoming, staff) {
    const st = stockLevel(p)
    if (st.level === "deficit" && staff) return { cls: "stock stock--deficit", text: `Дефицит: в заказах ${st.reserved}, на складе ${physical(p)}` }
    if (st.level === "out" || st.level === "deficit") return incoming ? { cls: "stock stock--incoming", text: `Ждёт поставку${staff ? ` · +${incoming}` : ""}` } : { cls: "stock stock--out", text: "Нет в наличии" }
    if (st.level === "low") return { cls: "stock stock--low", text: `Осталось ${pcs(st.a)}` }
    return { cls: "stock", text: `В наличии ${pcs(st.a)}` }
}
