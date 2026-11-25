/**
 * Copyright 2026 Lord_mahor
 * Licensed under Apache 2.0
 */

// Разделы приложения. s — сессия: { user, can(право), isSuper, isSys, isStaff } (значения, не ref).
// Адреса прежние: на них ссылаются установленные PWA и push.
export const NAV = [
    { id: "storage", label: "Каталог", icon: "grid", path: "/", group: "Склад", show: (s) => !s.isSuper },
    { id: "orders", label: "Заказы", icon: "receipt", path: "/shop", group: "Склад", show: (s) => s.can("view_orders") },
    { id: "cabinet", label: "Мой склад", icon: "box", path: "/cabinet", group: "Склад", show: (s) => s.can("cabinet_access") },
    { id: "cabinet-summary", label: "Сводка складов", icon: "layers", path: "/cabinet-summary", group: "Склад", show: (s) => s.can("view_cabinet_summary") || s.can("view_all_cabinets") },
    { id: "purchases", label: "Закупки", icon: "truck", path: "/purchase", group: "Служебное", show: (s) => s.can("view_purchases") },
    { id: "inventory", label: "Инвентаризация", icon: "clipboard", path: "/storage/inventory", group: "Служебное", show: (s) => s.can("view_inventory") },
    { id: "admin", label: "Админка", icon: "shield", path: "/admin", group: "Служебное", show: (s) => !s.isSuper && (s.isStaff || s.can("view_users") || s.can("view_roles") || s.can("create_purchases") || s.can("edit_purchases")) },
    { id: "statistics", label: "Статистика", icon: "chart", path: "/statistics", group: "Аналитика", show: (s) => s.can("view_statistics") },
    { id: "history", label: "История", icon: "history", path: "/history", group: "Аналитика", show: (s) => s.can("view_change_history") },
    { id: "companies", label: "Компании", icon: "globe", path: "/companies", group: "Платформа", show: (s) => s.isSuper },
    { id: "seeds", label: "Семена", icon: "sprout", path: "/seeds", group: "Платформа", show: (s) => s.isSuper },
    { id: "metrics", label: "Метрики", icon: "pulse", path: "/observability", group: "Платформа", show: (s) => s.isSuper },
    { id: "usage", label: "Использование", icon: "eye", path: "/usage", group: "Платформа", show: (s) => s.isSuper },
    { id: "feedback", label: "Обратная связь", icon: "chat", path: "/feedback", group: "Платформа", show: (s) => s.isSuper }
]
export const visibleNav = (s) => NAV.filter((n) => n.show(s))

// Нижнее меню телефона: до 4 разделов + «Профиль». «Авто» — первые 4 доступных по приоритету; у роли может быть свой набор
// (role.mobileTabs — id разделов). Убрали право — раздел исчез, его место занял следующий.
export const TAB_PRIORITY = ["storage", "orders", "cabinet", "purchases", "inventory", "cabinet-summary", "statistics", "history", "admin"]
export const tabsFor = (s, custom = s.user?.role?.mobileTabs) => {
    const vis = visibleNav(s)
    if (s.isSuper) return vis.slice(0, 4)
    const order = Array.isArray(custom) && custom.length ? custom : TAB_PRIORITY
    return order
        .map((id) => vis.find((n) => n.id === id))
        .filter(Boolean)
        .slice(0, 4)
}

/** Домашний раздел после входа: супер-админ → компании; заказывает или системная роль → каталог; иначе служащий → заказы; иначе каталог. */
export const homePath = (s) => (s.isSuper ? "/companies" : s.can("create_orders") || s.isSys ? "/" : s.isStaff && s.can("view_orders") ? "/shop" : "/")
