/**
 * Copyright 2026 Lord_mahor
 * Licensed under Apache 2.0
 */

import { describe, expect, it } from "vitest"
import { money } from "@/domain/format"
import { axisNum, daySeries, flowRows, flowSeries, flowTotals, niceMax, rangeText, statQuery, statRange, zeroFill } from "./statistics"

const now = Date.UTC(2026, 10, 17, 9, 30)

describe("период", () => {
    it("готовые периоды от полуночи UTC, «Всё время» — от первого документа", () => {
        expect(statRange({ p: "7" }, { now })).toEqual({ from: Date.UTC(2026, 10, 11), to: now, open: true })
        expect(statRange({ p: "30" }, { now })).toEqual({ from: Date.UTC(2026, 9, 19), to: now, open: true })
        expect(statRange({ p: "all" }, { now, bounds: Date.UTC(2025, 2, 13, 10) })).toEqual({ from: Date.UTC(2025, 2, 13), to: now, open: true })
        expect(statRange({ p: "all" }, { now })).toEqual({ from: Date.UTC(2020, 0, 1), to: now, open: true })
    })
    it("свой период: «По» включительно, не позже сейчас", () => {
        expect(statRange({ p: "custom", from: "2026-11-01", to: "2026-11-03" }, { now })).toEqual({ from: Date.UTC(2026, 10, 1), to: Date.UTC(2026, 10, 4), open: false })
        expect(statRange({ p: "custom", from: "2026-11-01", to: "2026-12-31" }, { now })).toMatchObject({ to: now, open: true })
        expect(statRange({ p: "custom", from: "", to: "" }, { now, bounds: Date.UTC(2025, 0, 2) })).toEqual({ from: Date.UTC(2025, 0, 2), to: now, open: true })
    })
    it("запрос: верхняя граница только у закрытого периода; подпись периода", () => {
        const closed = statRange({ p: "custom", from: "2026-11-01", to: "2026-11-03" }, { now })
        expect(statQuery(closed, { groups: ["u1", "u2"], products: [] })).toBe(`from=${Date.UTC(2026, 10, 1)}&to=${Date.UTC(2026, 10, 4)}&users=u1%2Cu2`)
        expect(statQuery(statRange({ p: "7" }, { now }), { groups: [], products: ["p1"] })).toBe(`from=${Date.UTC(2026, 10, 11)}&products=p1`)
        expect(rangeText(closed)).toBe("01.11.2026 — 03.11.2026")
    })
})

describe("столбики", () => {
    const orders = [
        { date: "2026-11-11", amount: 500, ordersCount: 2 },
        { date: "2026-11-13", amount: 300, ordersCount: 1 },
        { date: "2026-11-17", amount: 200, ordersCount: 1 }
    ]
    it("по дням: день без заказов — ноль, сумма сходится с данными", () => {
        const { byWeek, groups } = daySeries(statRange({ p: "7" }, { now }), orders)
        expect(byWeek).toBe(false)
        expect(groups.map((g) => g.key)).toEqual(["2026-11-11", "2026-11-12", "2026-11-13", "2026-11-14", "2026-11-15", "2026-11-16", "2026-11-17"])
        expect(groups.map((g) => g.v[0])).toEqual([500, 0, 300, 0, 0, 0, 200])
        expect(groups[0].tip).toBe(`11 ноября: 2 заказа на ${money(500)}`)
        expect(groups[1].tip).toBe("12 ноября: заказов нет")
        expect(groups[0].l).toBe("11 ноя")
    })
    it("длиннее 100 дней — по неделям", () => {
        const range = { from: Date.UTC(2026, 6, 1), to: now }
        const { byWeek, groups } = daySeries(range, orders)
        expect(byWeek).toBe(true)
        expect(groups.reduce((s, g) => s + g.v[0], 0)).toBe(1000)
        expect(groups[0].tip.startsWith("Неделя с 1 июля")).toBe(true)
    })
    it("продажи и поступления по неделям, дольше полугода — по месяцам", () => {
        const range = statRange({ p: "30" }, { now })
        const weeks = flowSeries(range, orders, [{ date: "2026-11-14", amount: 120 }])
        expect(weeks).toHaveLength(5)
        expect(weeks.reduce((s, w) => s + w.v[0], 0)).toBe(1000)
        expect(weeks.reduce((s, w) => s + w.v[1], 0)).toBe(120)
        expect(weeks[0].tip).toBe(`Неделя с 19.10.2026: Продажи ${money(0)} · Поступления ${money(0)}`)
        const months = flowSeries({ from: Date.UTC(2025, 2, 13), to: now }, orders)
        expect(months).toHaveLength(21)
        expect(months.at(-1).v[0]).toBe(1000)
        expect(months[1].key).toBe("2025-04-01")
    })
    it("доставка заказов lit-na.ru входит в поступления и называется отдельно; нет доставки — подсказка прежняя", () => {
        const range = statRange({ p: "30" }, { now })
        const buys = [
            { date: "2026-11-14", amount: 120, shipping: 30 },
            { date: "2026-11-16", amount: 50 }
        ]
        const weeks = flowSeries(range, orders, buys)
        expect(weeks.reduce((s, w) => s + w.v[1], 0)).toBe(200)
        const w = weeks.find((x) => x.v[1])
        expect(weeks.at(-1).tip).toBe(`Неделя с 16.11.2026: Продажи ${money(200)} · Поступления ${money(50)}`)
        expect(w.tip).toBe(`Неделя с 09.11.2026: Продажи ${money(800)} · Поступления ${money(150)}, в т. ч. доставка ${money(30)}`)
        expect(flowTotals(orders, buys)).toEqual({ s: 1000, r: 200, d: 30 })
        // отбор по товарам: сервер доставку не шлёт
        expect(flowTotals(orders, [{ date: "2026-11-14", amount: 120 }])).toEqual({ s: 1000, r: 120, d: 0 })
        expect(flowTotals()).toEqual({ s: 0, r: 0, d: 0 })
    })
    it("шкала", () => {
        expect(niceMax(0)).toBe(1)
        expect(niceMax(4770)).toBe(5000)
        expect(niceMax(13718)).toBe(15000)
        expect(axisNum(1500)).toBe("1,5 тыс")
        expect(axisNum(2_000_000)).toBe("2 млн")
        expect(axisNum(250)).toBe("250")
    })
})

describe("товары с нулями", () => {
    const products = [
        { _id: "a", name: "Б-товар", category: "Книга" },
        { _id: "b", name: "А-товар", category: "ИП" },
        { _id: "c", name: "В-товар", category: "ИП" }
    ]
    it("непроданные — нулём, выбранные — только они", () => {
        const rows = zeroFill([{ productId: "c", name: "В-товар", amount: 90, quantity: 3 }], products, [], "amount")
        expect(rows.map((r) => [r.productId, r.amount])).toEqual([
            ["c", 90],
            ["a", 0],
            ["b", 0]
        ])
        expect(zeroFill([], products, ["b"], "quantity").map((r) => r.productId)).toEqual(["b"])
    })
    it("расхождения: по |Δ|, при равенстве — по названию", () => {
        const rows = flowRows([{ productId: "a", name: "Б-товар", received: 0, sold: 5, gap: -5 }], products)
        expect(rows.map((r) => [r.name, r.gap])).toEqual([
            ["Б-товар", -5],
            ["А-товар", 0],
            ["В-товар", 0]
        ])
    })
})
