/**
 * Copyright 2026 Lord_mahor
 * Licensed under Apache 2.0
 */

import AppShell from "@/layout/AppShell.vue"
import { createRouter, createWebHashHistory } from "vue-router"
import admin from "./routes/admin"
import analytics from "./routes/analytics"
import cabinet from "./routes/cabinet"
import core from "./routes/core"
import inventory from "./routes/inventory"
import orders from "./routes/orders"
import platform from "./routes/platform"
import purchases from "./routes/purchases"

// Экраны разделов — дочерние маршруты каркаса; у каждого раздела свой файл в ./routes. Адреса разделов прежние.
// Страницы вне каркаса (вход, ошибки) помечены meta.bare.
const router = createRouter({
    history: createWebHashHistory(),
    routes: [
        { path: "/", component: AppShell, meta: { requiresAuth: true }, children: [...core, ...orders, ...purchases, ...inventory, ...cabinet, ...analytics, ...admin, ...platform] },
        { path: "/auth/login", name: "login", component: () => import("@/views/core/Login.vue"), meta: { bare: true, title: "Вход" } },
        {
            path: "/auth/access",
            name: "accessDenied",
            component: () => import("@/views/core/ErrorPage.vue"),
            props: (r) => ({ code: r.query.reason === "session" ? "session" : "403" }),
            meta: { bare: true, title: (r) => (r.query.reason === "session" ? "Сессия завершена" : "Сюда нельзя") }
        },
        { path: "/auth/error", name: "error", component: () => import("@/views/core/ErrorPage.vue"), props: { code: "500" }, meta: { bare: true, title: "Что-то сломалось" } },
        { path: "/:catchAll(.*)", name: "notfound", component: () => import("@/views/core/ErrorPage.vue"), props: { code: "404" }, meta: { bare: true, title: "Такой страницы нет" } }
    ],
    // Деталь открывается и закрывается внутри того же раздела — список остаётся на месте; между разделами — наверх.
    scrollBehavior: (to, from, saved) => saved || (to.matched[1] && to.matched[1] === from.matched[1] ? false : { top: 0 })
})

router.afterEach((to) => {
    const title = typeof to.meta.title === "function" ? to.meta.title(to) : to.meta.title
    document.title = `${title || "СкладАН"} — СкладАН`
})

export default router
