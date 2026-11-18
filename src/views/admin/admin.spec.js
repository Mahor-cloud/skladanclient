/**
 * Copyright 2026 Lord_mahor
 * Licensed under Apache 2.0
 */

import { tabsFor } from "@/domain/nav"
import { describe, expect, it } from "vitest"
import { menuCtx, menuRows, moveTab, orderedPerms, pruneMenu, roleBrief, strength, toggleTab } from "./admin"

describe("roleBrief", () => {
    it("системная роль — свои три метки", () => expect(roleBrief({ isSystem: true, permissions: [] })).toEqual(["Всё в компании", "Правка завершённых заказов", "Цели закупки"]))
    it("по правам, не больше трёх", () => expect(roleBrief({ permissions: ["cabinet_access", "create_orders", "edit_products", "approve-payment"] })).toEqual(["Подтверждает оплату", "Правит товары", "Заказывает"]))
    it("без рабочих прав — только просмотр", () => expect(roleBrief({ permissions: ["view_orders"] })).toEqual(["Только просмотр"]))
})

describe("orderedPerms", () => {
    it("прежние в прежнем порядке, новые — по каталогу, снятые убраны", () => {
        const sel = new Set(["view_orders", "view_users", "create_orders", "approve-payment"])
        expect(orderedPerms(["view_orders", "view_products", "view_users"], sel)).toEqual(["view_orders", "view_users", "create_orders", "approve-payment"])
    })
})

describe("strength", () => {
    it("пусто / коротко / слабый / средний / надёжный", () => {
        expect(strength("")).toBe(null)
        expect(strength("abc")).toBe(0)
        expect(strength("abcd")).toBe(1)
        expect(strength("abcd1234")).toBe(2)
        expect(strength("Abcd1234!")).toBe(3)
    })
})

describe("нижнее меню роли", () => {
    const has = (list) => (p) => list.includes(p)
    const ctx = menuCtx(false, has(["view_orders", "view_statistics", "view_users"]))
    it("недоступные по правам разделы помечены, «Админка» — по праву на пользователей", () => {
        const rows = menuRows(ctx, ["statistics"])
        expect(rows[0].n.id).toBe("statistics")
        expect(rows.find((x) => x.n.id === "purchases").ok).toBe(false)
        expect(rows.find((x) => x.n.id === "admin").ok).toBe(true)
    })
    it("предпросмотр: свой порядок, без недоступных", () => expect(tabsFor(ctx, ["statistics", "purchases", "storage"]).map((n) => n.id)).toEqual(["statistics", "storage"]))
    it("снятые права убирают разделы из набора", () => expect(pruneMenu(["orders", "statistics"], menuCtx(false, has(["view_orders"])))).toEqual(["orders"]))
    it("авто остаётся авто", () => expect(pruneMenu(null, ctx)).toBe(null))
    it("не больше четырёх, без повторов", () => expect(toggleTab(["a", "b", "c", "d"], "e", true)).toEqual(["a", "b", "c", "d"]))
    it("порядок стрелками, края не выходят", () => {
        expect(moveTab(["a", "b", "c"], "c", -1)).toEqual(["a", "c", "b"])
        expect(moveTab(["a", "b"], "a", -1)).toEqual(["a", "b"])
    })
    it("системной роли доступно всё", () =>
        expect(
            menuRows(
                menuCtx(true, () => false),
                []
            ).every((x) => x.ok)
        ).toBe(true))
})
