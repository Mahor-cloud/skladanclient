/**
 * Copyright 2026 Lord_mahor
 * Licensed under Apache 2.0
 */

// Мой склад (своя позиция — окно по адресу поверх списка) и сводка складов. meta.permission — право (или любое из списка), без которого адрес закрыт.
export default [
    {
        path: "cabinet",
        name: "cabinet",
        component: () => import("@/views/cabinet/CabinetPage.vue"),
        meta: { nav: "cabinet", title: "Мой склад", permission: "cabinet_access" },
        children: [
            { path: "item/new", name: "cabinet-item-new", component: () => import("@/views/cabinet/CabinetItem.vue") },
            { path: "item/:id", name: "cabinet-item", component: () => import("@/views/cabinet/CabinetItem.vue"), props: true }
        ]
    },
    { path: "cabinet-summary", name: "cabinet-summary", component: () => import("@/views/cabinet/SummaryPage.vue"), meta: { nav: "cabinet-summary", title: "Сводка складов", permission: ["view_cabinet_summary", "view_all_cabinets"] } }
]
