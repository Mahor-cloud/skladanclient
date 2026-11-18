/**
 * Copyright 2026 Lord_mahor
 * Licensed under Apache 2.0
 */

// Заказы. Деталь заказа — именованный маршрут "order": на него ведёт корзина после оформления, его же открывает peek() из истории и статистики.
// ?ask=pay|complete в адресе заказа сразу открывает подтверждение оплаты / получения.
export default [
    {
        path: "shop",
        name: "shop",
        component: () => import("@/views/shop/OrdersPage.vue"),
        meta: { nav: "orders", title: "Заказы" },
        children: [{ path: "order/:id", name: "order", component: () => import("@/views/shop/OrderPane.vue"), props: true }]
    },
    { path: "shop/order/:id/edit", name: "order-edit", component: () => import("@/views/shop/OrderEdit.vue"), props: true, meta: { nav: "orders", title: "Правка заказа" } }
]
