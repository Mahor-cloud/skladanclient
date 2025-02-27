import AppLayout from "@/layout/AppLayout.vue"
import { createRouter, createWebHistory } from "vue-router"

const router = createRouter({
    history: createWebHistory(),
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
                    meta: { requiresAuth: true }
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
