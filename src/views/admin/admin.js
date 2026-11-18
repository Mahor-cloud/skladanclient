/**
 * Copyright 2026 Lord_mahor
 * Licensed under Apache 2.0
 */

import { useSession } from "@/composables/useSession"
import { NAV, TAB_PRIORITY } from "@/domain/nav"
import { ALL } from "@/domain/perms"
import axiosInstance from "@/service/axios"
import { useQuery } from "@tanstack/vue-query"
import { computed } from "vue"

export { ALL, PERMS } from "@/domain/perms"
const KNOWN = new Set(ALL)

export const roleId = (u) => (u?.role && typeof u.role === "object" ? u.role._id : u?.role)
/** Права роли из каталога (чужие строки, если вдруг есть в базе, не считаются). */
export const rolePerms = (r) => (r?.permissions || []).filter((p) => KNOWN.has(p))
/** Короткое «чем занимается» роли — до трёх меток, по правам. */
export function roleBrief(r) {
    if (r.isSystem) return ["Всё в компании", "Правка завершённых заказов", "Цели закупки"]
    const s = new Set(rolePerms(r))
    const out = [
        ["approve-payment", "Подтверждает оплату"],
        ["edit_purchases", "Ведёт закупки"],
        ["edit_products", "Правит товары"],
        ["edit_inventory", "Инвентаризация"],
        ["create_orders", "Заказывает"],
        ["cabinet_access", "Мой склад"]
    ]
        .filter(([p]) => s.has(p))
        .map(([, t]) => t)
    return (out.length ? out : ["Только просмотр"]).slice(0, 3)
}
/** Права к сохранению: прежние — в прежнем порядке, новые — в порядке каталога (лишняя запись «Права изменены» в истории не появляется). */
export const orderedPerms = (orig, sel) => [...orig.filter((p) => sel.has(p)), ...ALL.filter((p) => sel.has(p) && !orig.includes(p))]

/** Надёжность пароля: null — пусто, 0 — короче 4, 1…3 — слабый…надёжный. */
export function strength(p) {
    if (!p) return null
    const s = (p.length >= 8) + (/[A-ZА-Я]/.test(p) && /[a-zа-я]/.test(p)) + /\d/.test(p) + /[^\wа-яё]/i.test(p)
    return p.length < 4 ? 0 : s <= 1 ? 1 : s === 2 ? 2 : 3
}
export const STRENGTH = ["Слишком короткий", "Слабый", "Средний", "Надёжный"]

/* Нижнее меню роли. Сессия-заготовка для visibleNav/tabsFor: права — отмеченные в редакторе; «Служащий» — флаг человека, у роли его нет. */
export const menuCtx = (sys, has) => ({ user: null, can: (p) => sys || has(p), isSuper: false, isSys: sys, isStaff: sys })
/** Разделы по приоритету меню и доступность по правам: [{ n, ok }]. */
export const menuAvail = (ctx) => TAB_PRIORITY.map((id) => NAV.find((n) => n.id === id)).map((n) => ({ n, ok: n.show(ctx) }))
/** Строки редактора своего набора: выбранные по порядку, затем остальные по приоритету. */
export const menuRows = (ctx, menu) => {
    const av = menuAvail(ctx)
    return [...menu.map((id) => av.find((x) => x.n.id === id)).filter(Boolean), ...av.filter((x) => !menu.includes(x.n.id))]
}
/** Права сняли — разделы без права уходят из своего набора. */
export const pruneMenu = (menu, ctx) => menu && menu.filter((id) => NAV.find((n) => n.id === id)?.show(ctx))
export const toggleTab = (menu, id, on) => (on ? [...menu.filter((x) => x !== id), id].slice(0, 4) : menu.filter((x) => x !== id))
export function moveTab(menu, id, d) {
    const m = [...menu]
    const i = m.indexOf(id)
    const j = i + d
    if (i < 0 || j < 0 || j >= m.length) return m
    ;[m[i], m[j]] = [m[j], m[i]]
    return m
}

/** Текст ошибки сервера: строка или массив class-validator. */
export const errText = (e, fallback) => {
    const m = e?.response?.data?.message
    return (Array.isArray(m) ? m.join(", ") : m) || e?.message || fallback
}

/* Запросы раздела — прежние ключи и форма кэша (ответ axios целиком, наружу data). */
const FIVE_MIN = 1000 * 60 * 5
const { can } = useSession()
export const useUsers = () =>
    useQuery({
        queryKey: ["users"],
        queryFn: () => axiosInstance.get("/auth/users"),
        select: (res) => (res.data || []).filter((u) => !u.isSuperAdmin),
        staleTime: FIVE_MIN,
        refetchInterval: FIVE_MIN,
        enabled: computed(() => can("view_users"))
    })
export const useRoles = () => useQuery({ queryKey: ["roles"], queryFn: () => axiosInstance.get("/roles"), select: (res) => res.data || [], staleTime: FIVE_MIN, refetchInterval: FIVE_MIN, enabled: computed(() => can("view_roles")) })
