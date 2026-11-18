/**
 * Copyright 2026 Lord_mahor
 * Licensed under Apache 2.0
 */

// Разделы супер-админа: компании, семена, метрики. meta.superAdmin — остальным «Сюда нельзя».
export default [
    {
        path: "companies",
        name: "companies",
        component: () => import("@/views/platform/Companies.vue"),
        meta: { nav: "companies", title: "Компании", superAdmin: true },
        children: [
            { path: "new", name: "company-new", component: () => import("@/views/platform/CompanyNew.vue") },
            { path: ":id/delete", name: "company-delete", component: () => import("@/views/platform/CompanyDelete.vue"), props: true }
        ]
    },
    { path: "seeds", name: "seeds", component: () => import("@/views/platform/Seeds.vue"), meta: { nav: "seeds", title: "Семена", superAdmin: true } },
    {
        path: "observability",
        name: "observability",
        component: () => import("@/views/platform/Metrics.vue"),
        meta: { nav: "metrics", title: "Метрики", superAdmin: true },
        children: [{ path: "help/:k", name: "metrics-help", component: () => import("@/views/platform/MetricHelp.vue"), props: true }]
    }
]
