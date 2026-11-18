/**
 * Copyright 2026 Lord_mahor
 * Licensed under Apache 2.0
 */

// Инвентаризация: список (с окном «Новая инвентаризация» по адресу) и одна инвентаризация отдельной страницей.
export default [
    {
        path: "storage/inventory",
        name: "inventory",
        component: () => import("@/views/inventory/InventoryPage.vue"),
        meta: { nav: "inventory", title: "Инвентаризация" },
        children: [{ path: "new", name: "inventory-new", component: () => import("@/views/inventory/InventoryNew.vue") }]
    },
    { path: "storage/inventory/:id", name: "inventory-edit", component: () => import("@/views/inventory/InventoryEdit.vue"), props: true, meta: { nav: "inventory", title: "Инвентаризация" } }
]
