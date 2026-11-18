/**
 * Copyright 2026 Lord_mahor
 * Licensed under Apache 2.0
 */

// Админка: пользователи, роли, настройки. Карточки пользователя и роли — окна поверх своего списка (дочерние адреса).
const meta = { nav: "admin" }
export default [
    {
        path: "admin",
        name: "admin",
        component: () => import("@/views/admin/AdminUsers.vue"),
        meta: { ...meta, title: "Админка" },
        children: [
            { path: "user/new", name: "admin-user-new", component: () => import("@/views/admin/UserForm.vue") },
            { path: "user/:id", name: "admin-user", component: () => import("@/views/admin/UserForm.vue"), props: true }
        ]
    },
    {
        path: "admin/roles",
        name: "admin-roles",
        component: () => import("@/views/admin/AdminRoles.vue"),
        meta: { ...meta, title: "Роли и права" },
        children: [
            { path: "/admin/role/new", name: "admin-role-new", component: () => import("@/views/admin/RoleForm.vue") },
            { path: "/admin/role/:id/info", name: "admin-role-info", component: () => import("@/views/admin/RoleInfo.vue"), props: true },
            { path: "/admin/role/:id", name: "admin-role", component: () => import("@/views/admin/RoleForm.vue"), props: true }
        ]
    },
    { path: "admin/settings", name: "admin-settings", component: () => import("@/views/admin/AdminSettings.vue"), meta: { ...meta, title: "Настройки" } }
]
