/**
 * Copyright 2026 Lord_mahor
 * Licensed under Apache 2.0
 */

import { ref } from "vue"

// Точки ширины каркаса: телефон < 900 ≤ компьютер; от 1180 — правая колонка; от 1800 — плотные таблицы целиком.
const mq = (query) => {
    const m = window.matchMedia(query)
    const r = ref(m.matches)
    m.addEventListener("change", (e) => (r.value = e.matches))
    return r
}
export const isDesk = mq("(min-width: 900px)")
export const isWide = mq("(min-width: 1180px)")
export const isRoomy = mq("(min-width: 1800px)")
export const reducedMotion = mq("(prefers-reduced-motion: reduce)")

export function useBreakpoint() {
    return { isDesk, isWide, isRoomy }
}
