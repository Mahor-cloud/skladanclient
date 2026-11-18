/**
 * Copyright 2026 Lord_mahor
 * Licensed under Apache 2.0
 */

// Закупки: список и закупка отдельной страницей (id — _id закупки).
export default [
    { path: "purchase", name: "purchaseShop", component: () => import("@/views/purchases/PurchasesPage.vue"), meta: { nav: "purchases", title: "Закупки" } },
    { path: "purchase/:id", name: "purchase", component: () => import("@/views/purchases/PurchasePage.vue"), props: true, meta: { nav: "purchases", title: "Закупка" } }
]
