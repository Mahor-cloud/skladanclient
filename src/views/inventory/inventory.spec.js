/**
 * Copyright 2026 Lord_mahor
 * Licensed under Apache 2.0
 */

import { money } from "@/domain/format"
import { describe, expect, it } from "vitest"
import { diffTone, factOf, factsOf, invPrice, invStats, latestId, mergeFresh, sgnMoney } from "./inventory"

const item = (id, price, quantity, newQuantity) => ({ product: { _id: id, price }, quantity, newQuantity })

describe("inventory", () => {
    it("недостача и излишек считаются отдельно, разница — по сумме", () => {
        const items = [item("a", 100, 5, 3), item("b", 50, 2, 6), item("c", 10, 4, 4), { product: null, quantity: 9, newQuantity: 0 }]
        expect(invStats(items)).toEqual({ short: 2, plus: 4, shortSum: 200, plusSum: 200, devN: 2, shortN: 1, plusN: 1, factValue: 640, startValue: 640, diff: 0 })
    })
    it("завершённая инвентаризация: оценка по цене, записанной в позиции, а не по текущей цене товара", () => {
        const done = [
            { ...item("a", 300, 5, 3), price: 100 },
            { ...item("b", 50, 2, 6), price: 0 }
        ]
        expect(done.map(invPrice)).toEqual([100, 0])
        expect(invStats(done)).toMatchObject({ shortSum: 200, plusSum: 0, startValue: 500, factValue: 300, diff: -200 })
        // открытая и старая завершённая без цены в позиции — по текущей цене товара; товара нет — 0
        expect(invPrice(item("a", 300, 5, 3))).toBe(300)
        expect(invPrice({ product: null, quantity: 1, newQuantity: 1 })).toBe(0)
    })
    it("черновик перекрывает сохранённый факт, отрицательный факт допустим", () => {
        const items = [item("a", 100, 5, 5)]
        expect(factOf(items[0], { a: -1 })).toBe(-1)
        expect(invStats(items, { a: 7 })).toMatchObject({ plus: 2, plusSum: 200, diff: 200, devN: 1 })
        expect(invStats(items, {})).toMatchObject({ devN: 0, diff: 0 })
    })
    it("знак и тон разницы", () => {
        expect(sgnMoney(-1150)).toBe("−" + money(1150))
        expect(sgnMoney(35)).toBe("+" + money(35))
        expect(sgnMoney(0)).toBe(money(0))
        expect([diffTone(-1), diffTone(0), diffTone(2)]).toEqual(["neg", "pos", "warn"])
    })
    it("факт из ответа сервера: товар и объектом, и id", () => {
        expect(factsOf([item("a", 1, 5, 3), { product: "b", quantity: 2, newQuantity: 6 }])).toEqual({ a: 3, b: 6 })
    })
    it("свежие данные: нетронутые строки берут чужой сохранённый факт, свои правки остаются", () => {
        const d = { base: { a: 5, b: 2, c: 4 }, facts: { a: 5, b: 9, c: 4 }, baseComment: "", comment: "" }
        // с другого устройства сохранили a = 1 и c = 7; у нас тронута только b
        expect(mergeFresh(d, { a: 1, b: 2, c: 7 }, "пересчёт")).toEqual({ base: { a: 1, b: 2, c: 7 }, facts: { a: 1, b: 9, c: 7 }, baseComment: "пересчёт", comment: "пересчёт" })
    })
    it("оба изменили одну строку — остаётся своё (при сохранении побеждает сохраняющий), свой комментарий тоже", () => {
        const d = { base: { a: 5 }, facts: { a: 8 }, baseComment: "", comment: "мой" }
        expect(mergeFresh(d, { a: 3 }, "чужой")).toEqual({ base: { a: 3 }, facts: { a: 8 }, baseComment: "чужой", comment: "мой" })
    })
    it("первая загрузка и черновик без правок — просто серверные значения", () => {
        expect(mergeFresh({ facts: null, base: {}, comment: "", baseComment: "" }, { a: 2 }, "к")).toEqual({ base: { a: 2 }, facts: { a: 2 }, baseComment: "к", comment: "к" })
        expect(mergeFresh({ base: { a: 2 }, facts: { a: 2 }, comment: "к", baseComment: "к" }, { a: 4 }, "к2").facts).toEqual({ a: 4 })
    })
    it("самая поздняя — по дате начала", () => {
        expect(
            latestId([
                { _id: "1", startDate: 5 },
                { _id: "2", startDate: 9 },
                { _id: "3", startDate: 7 }
            ])
        ).toBe("2")
        expect(latestId([])).toBe(null)
    })
})
