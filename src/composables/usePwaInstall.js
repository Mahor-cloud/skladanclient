/**
 * Copyright 2026 Lord_mahor
 * Licensed under Apache 2.0
 */

import { ref } from "vue"

// Браузер присылает beforeinstallprompt один раз и рано — ловим при загрузке приложения, а не когда откроют профиль.
let deferredPrompt = null
const canInstall = ref(false)
const hidden = ref(false) // строку установки скрыли в профиле — до перезагрузки приложения
const isInstalled = ref((window.matchMedia && window.matchMedia("(display-mode: standalone)").matches) || window.navigator.standalone === true || document.referrer.startsWith("android-app://"))
const isIOS = ref(/iPad|iPhone|iPod/.test(window.navigator.userAgent || "") && !window.MSStream && !isInstalled.value)

window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault()
    deferredPrompt = e
    canInstall.value = true
})
window.addEventListener("appinstalled", () => {
    isInstalled.value = true
    canInstall.value = false
    deferredPrompt = null
})

async function promptInstall() {
    const ev = deferredPrompt
    if (!ev) return
    ev.prompt()
    try {
        await ev.userChoice
    } catch {
        // пользователь закрыл системное окно — ничего не меняется
    }
    deferredPrompt = null
    canInstall.value = false
}

/** { canInstall, isInstalled, isIOS, hidden, promptInstall } — на iPhone установки кнопкой нет, только подсказка. */
export function usePwaInstall() {
    return { canInstall, isInstalled, isIOS, hidden, promptInstall }
}
