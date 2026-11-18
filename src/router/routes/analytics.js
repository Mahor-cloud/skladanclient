/**
 * Copyright 2026 Lord_mahor
 * Licensed under Apache 2.0
 */

// История и статистика.
export default [
    { path: "history", name: "History", component: () => import("@/views/history/HistoryPage.vue"), meta: { nav: "history", title: "История", permission: "view_change_history" } },
    { path: "statistics", name: "statistics", component: () => import("@/views/statistics/StatisticsPage.vue"), meta: { nav: "statistics", title: "Статистика", permission: "view_statistics" } }
]
