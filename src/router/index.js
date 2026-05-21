/**
 * Copyright 2026 Lord_mahor
 * Licensed under Apache 2.0
 */

import AppLayout from "@/layout/AppLayout.vue"
import { createRouter, createWebHashHistory } from "vue-router"

const router = createRouter({
    history: createWebHashHistory(),
    routes: [
        {
            path: "/",
            component: AppLayout,
            children: [
                {
                    path: "/",
                    name: "dashboard",
                    component: () => import("@/views/storage/Storage.vue"),
                    meta: { requiresAuth: true }
                },
                {
                    path: "admin/",
                    name: "admin",
                    component: () => import("@/views/admin/Admin.vue"),
                    meta: { requiresAuth: true }
                },
                {
                    path: "storage/inventory",
                    name: "inventory",
                    component: () => import("@/views/admin/Inventory.vue"),
                    meta: { requiresAuth: true }
                },
                {
                    path: "shop/",
                    name: "shop",
                    component: () => import("@/views/shop/Orders.vue"),
                    meta: { requiresAuth: true }
                },
                {
                    path: "purchase/",
                    name: "purchaseShop",
                    component: () => import("@/views/admin/Purchase.vue"),
                    meta: { requiresAuth: true }
                },
                {
                    path: "history/",
                    name: "History",
                    component: () => import("@/views/history/History.vue"),
                    meta: { requiresAuth: true, permission: "view_change_history" }
                },
                {
                    path: "cabinet/",
                    name: "cabinet",
                    component: () => import("@/views/cabinet/Cabinet.vue"),
                    meta: { requiresAuth: true, permission: "cabinet_access" }
                },
                {
                    path: "cabinet-summary/",
                    name: "cabinet-summary",
                    component: () => import("@/views/cabinet/CabinetSummary.vue"),
                    meta: { requiresAuth: true, permission: ["view_cabinet_summary", "view_all_cabinets"] }
                },
                {
                    path: "statistics/",
                    name: "statistics",
                    component: () => import("@/views/statistics/Statistics.vue"),
                    meta: { requiresAuth: true, permission: "view_statistics" }
                },
                {
                    path: "companies/",
                    name: "companies",
                    component: () => import("@/views/admin/Companies.vue"),
                    meta: { requiresAuth: true, superAdmin: true }
                },
                {
                    path: "seeds/",
                    name: "seeds",
                    component: () => import("@/views/admin/Seeds.vue"),
                    meta: { requiresAuth: true, superAdmin: true }
                },
                {
                    path: "observability/",
                    name: "observability",
                    component: () => import("@/views/admin/Observability.vue"),
                    meta: { requiresAuth: true, superAdmin: true }
                }
            ]
        },
        {
            path: "/auth/login",
            name: "login",
            component: () => import("@/views/pages/auth/Login.vue")
        },
        {
            path: "/auth/access",
            name: "accessDenied",
            component: () => import("@/views/pages/auth/Access.vue")
        },
        {
            path: "/auth/error",
            name: "error",
            component: () => import("@/views/pages/auth/Error.vue")
        },
        {
            path: "/:catchAll(.*)",
            name: "notfound",
            component: () => import("@/views/pages/NotFound.vue")
        }
    ]
})

export default router
