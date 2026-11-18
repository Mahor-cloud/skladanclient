/**
 * Copyright 2026 Lord_mahor
 * Licensed under Apache 2.0
 */

import { ref } from "vue"

const store = {
    get: (k) => {
        try {
            return localStorage.getItem(k)
        } catch {
            return null
        }
    },
    set: (k, v) => {
        try {
            v == null ? localStorage.removeItem(k) : localStorage.setItem(k, v)
        } catch {
            // хранилище недоступно — настройка действует до перезагрузки
        }
    }
}
const stored = store.get("skladan-theme")
const theme = ref(stored === "light" || stored === "dark" ? stored : "system")
const scale = ref(store.get("skladan-scale") === "large" ? "large" : "normal")
const sys = window.matchMedia("(prefers-color-scheme: dark)")

function apply() {
    const dark = theme.value === "dark" || (theme.value === "system" && sys.matches)
    document.documentElement.dataset.theme = dark ? "dark" : "light"
    const m = document.querySelector('meta[name="theme-color"]')
    if (m) m.content = dark ? "#0D1A30" : "#EEF1F6"
}
sys.addEventListener("change", apply)

/** Тема: system | light | dark — запоминается; смена мягким перетеканием, где браузер умеет. */
function setTheme(pref) {
    theme.value = pref
    store.set("skladan-theme", pref === "system" ? null : pref)
    if (document.startViewTransition && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) document.startViewTransition(apply)
    else apply()
}
/** Размер текста: normal | large — переопределяет шкалу токенов через <html data-scale>. */
function setScale(v) {
    scale.value = v === "large" ? "large" : "normal"
    store.set("skladan-scale", v === "large" ? "large" : null)
    if (v === "large") document.documentElement.dataset.scale = "large"
    else delete document.documentElement.dataset.scale
}

export function useTheme() {
    return { theme, setTheme, scale, setScale }
}
