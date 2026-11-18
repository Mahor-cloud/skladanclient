/**
 * Copyright 2026 Lord_mahor
 * Licensed under Apache 2.0
 */

// Основа: каталог (с товаром-деталью и формой товара) и корзина. meta.nav — какой раздел подсветить в меню.
export default [
    {
        path: "",
        name: "catalog",
        component: () => import("@/views/core/Catalog.vue"),
        meta: { nav: "storage", title: "Каталог" },
        children: [
            { path: "product/new", name: "product-new", component: () => import("@/views/core/ProductForm.vue") },
            { path: "product/:id", name: "product", component: () => import("@/views/core/ProductPane.vue"), props: true },
            { path: "product/:id/edit", name: "product-edit", component: () => import("@/views/core/ProductForm.vue"), props: true }
        ]
    },
    { path: "cart", name: "cart", component: () => import("@/views/core/Cart.vue"), meta: { nav: "storage", title: "Корзина" } }
]
