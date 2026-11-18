/**
 * Copyright 2026 Lord_mahor
 * Licensed under Apache 2.0
 */

// Категории push — как на сервере (subscription.preferences); показываются только доступные по правам. s — сессия простыми значениями.
export const PUSH_CATS = [
    ["orders", "Заказы", (s) => s.can("view_orders")],
    ["payment", "Оплата", (s) => s.can("approve-payment")],
    ["purchases", "Закупки", (s) => s.can("view_purchases")],
    ["inventory", "Инвентаризация", (s) => s.can("view_inventory") || s.can("create_orders")],
    ["products", "Товары", (s) => s.can("view_products")],
    ["users", "Пользователи", (s) => s.can("view_users") && s.isStaff],
    ["roles", "Роли", (s) => s.can("view_roles") && s.isStaff]
]
export const pushCats = (s) => PUSH_CATS.filter((c) => c[2](s))
/** «заказы (только мои), оплата, закупки» — строка в профиле и в уведомлении после сохранения. */
export const pushSummary = (s, prefs) =>
    pushCats(s)
        .filter(([k]) => prefs[k])
        .map(([k, l]) => (k === "orders" && prefs.ordersOwnOnly ? "заказы (только мои)" : l.toLowerCase()))
        .join(", ")
