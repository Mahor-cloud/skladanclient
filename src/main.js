/**
 * Copyright 2026 Lord_mahor
 * Licensed under Apache 2.0
 */

import "@/assets/ui/fonts.css"
import "@/assets/ui/tokens.css"
import "@/assets/ui/app.css"
import "@/assets/ui/ops.css"
import "@/assets/ui/final.css"
// Слушатель beforeinstallprompt должен стоять до прихода события, а профиль грузится лениво.
import "@/composables/usePwaInstall"

import { queryClient } from "@/service/queryClient"
import { installTilt } from "@/ui/fx"
import { confirm } from "@/ui/overlay"
import { bindPaneRouter } from "@/ui/pane"
import { VueQueryPlugin } from "@tanstack/vue-query"
import { registerSW } from "virtual:pwa-register"
import { createApp } from "vue"
import App from "./App.vue"
import router from "./router"
import "./router/guard"

const app = createApp(App)
app.use(router)
app.use(VueQueryPlugin, { queryClient })
bindPaneRouter(router)
installTilt()

registerSW({
    immediate: true,
    async onNeedRefresh() {
        if (await confirm({ title: "Новая версия приложения доступна.", ok: "Обновить", cancel: "Позже", icon: "download" })) window.location.reload()
    }
})

// Заставка из index.html уходит, когда первый экран готов: линии знака собираются, затем она растворяется.
function splashDone() {
    const el = document.getElementById("splash")
    if (!el) return
    el.querySelector(".lgo")?.classList.add("is-ready")
    setTimeout(
        () => {
            el.classList.add("is-done")
            setTimeout(() => el.remove(), 440)
        },
        window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 160
    )
}

router.isReady().finally(() => {
    app.mount("#app")
    splashDone()
})
