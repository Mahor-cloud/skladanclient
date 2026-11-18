/**
 * Copyright 2026 Lord_mahor
 * Licensed under Apache 2.0
 */

import { shallowReactive } from "vue"
import { pane } from "./pane"

/* Открытые окна (UiSheet регистрирует себя сам): Esc закрывает верхнее, <html class="has-ov"> запирает прокрутку страницы. */
const layers = []
// Фокус не уходит под верхнее окно: всё под ним inert; #toasts не трогаем — «Вернуть» в уведомлении должно нажиматься.
function syncInert() {
    document.getElementById("app")?.toggleAttribute("inert", layers.length > 0)
    layers.forEach((l, i) => l.root?.value?.toggleAttribute("inert", i < layers.length - 1))
}
export const layerOpen = (layer) => {
    layers.push(layer)
    document.documentElement.classList.add("has-ov")
    syncInert()
}
export const layerClose = (layer) => {
    const i = layers.indexOf(layer)
    if (i >= 0) layers.splice(i, 1)
    if (!layers.length) document.documentElement.classList.remove("has-ov")
    syncInert()
}
export const hasLayers = () => layers.length > 0

if (typeof document !== "undefined") {
    document.addEventListener("keydown", (ev) => {
        if (ev.key !== "Escape") return
        const top = layers[layers.length - 1]
        if (top) top.close("esc")
        else pane.close?.()
    })
    // Никакого перетаскивания: строки-ссылки и картинки нельзя «потянуть» мышью.
    document.addEventListener("dragstart", (ev) => ev.preventDefault())
}

/* Уведомления и подтверждения рисует UiHost (стоит в App.vue). Тексты — обычные строки, не HTML. */
export const toasts = shallowReactive([])
export const confirms = shallowReactive([])
let seq = 0

/** toast({ type: success|warning|error|info, title, text, action: { label, fn }, timeout }) → { close } */
export function toast({ type = "success", title, text, action, timeout } = {}) {
    const t = shallowReactive({ id: ++seq, type, title, text, action, shown: false })
    t.close = () => {
        clearTimeout(t.timer)
        t.shown = false
        setTimeout(() => {
            const i = toasts.indexOf(t)
            if (i >= 0) toasts.splice(i, 1)
        }, 260)
    }
    toasts.push(t)
    while (toasts.length > 3) toasts.shift()
    requestAnimationFrame(() => requestAnimationFrame(() => (t.shown = true)))
    t.timer = setTimeout(t.close, timeout || (action ? 6500 : type === "error" ? 6000 : 3200))
    return t
}

/**
 * confirm({ title, text, ok, cancel, tone: primary|danger|success, icon, okIcon, reason: { label, required, placeholder, error } })
 * → Promise<false | { reason }>. На телефоне — лист снизу, на компьютере — окно по центру средней колонки.
 */
export function confirm(o) {
    return new Promise((resolve) => {
        const c = shallowReactive({
            id: ++seq,
            o,
            reason: "",
            invalid: false,
            result: false,
            done() {
                const i = confirms.indexOf(c)
                if (i >= 0) confirms.splice(i, 1)
                resolve(c.result)
            }
        })
        confirms.push(c)
    })
}

/** Скопировать в буфер и сообщить: copyText("2200 …", "Номер карты") */
export async function copyText(value, label) {
    const v = String(value)
    try {
        await navigator.clipboard.writeText(v)
    } catch {
        const t = document.createElement("textarea")
        t.value = v
        document.body.appendChild(t)
        t.select()
        try {
            document.execCommand("copy")
        } catch {
            return toast({ type: "error", title: "Не получилось скопировать" })
        } finally {
            t.remove()
        }
    }
    toast({ type: "success", title: "Скопировано", text: `${label ? label + ": " : ""}${v}`, timeout: 2200 })
}
