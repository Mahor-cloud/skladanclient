/**
 * Copyright 2026 Lord_mahor
 * Licensed under Apache 2.0
 */

import { money } from "@/domain/format"
import { orderDiff, orderPerms } from "@/domain/orders"
import { describe, expect, it } from "vitest"
import { ASK_FLAGS, askAllowed, askStale, committed, diffText, editDiff, FILTERS, linesPayload, linesTotal, maxQty, orderLines, orderShortages, orderSum, sameItems } from "./orders"

const order = (over = {}) => ({
    _id: "o1",
    orderNumber: 7,
    items: [
        { product: { _id: "p1", name: "Брелок", price: 30 }, quantity: 5 },
        { product: { _id: "p2", name: "Книга", price: 400 }, quantity: 2 }
    ],
    isPaid: false,
    confirmedPaid: false,
    isCompleted: false,
    totalAmount: 950,
    paidAmount: 0,
    ...over
})
const shortages = [{ product: "p2", productName: "Книга", required: 7, inStock: 3, orderNumbers: [7, 9], orderIds: ["o1", "o9"] }]

describe("строки заказа", () => {
    it("оплаченный заказ: цена строки — записанная в заказе, а не текущая цена товара", () => {
        const o = order({ isPaid: true, isCompleted: true, totalAmount: 900 })
        o.items[0].price = 20 // брелок потом подорожал до 30
        o.items[1].price = 400
        const lines = orderLines(o)
        expect(lines.map((x) => x.p.price)).toEqual([20, 400])
        expect(lines[0].p.name).toBe("Брелок")
        expect(linesTotal(lines)).toBe(900)
        expect(o.items[0].product.price).toBe(30) // товар из ответа сервера не трогается
    })

    it("неоплаченный заказ и старый заказ без цены в строке — по текущей цене товара", () => {
        const unpaid = order()
        unpaid.items[0].price = 20
        expect(orderLines(unpaid)[0].p.price).toBe(30)
        expect(orderLines(order({ isPaid: true })).map((x) => x.p.price)).toEqual([30, 400])
        // завершённый заказ без отметки оплаты (наследие): цена и сумма — тоже из заказа
        const legacy = order({ isCompleted: true, totalAmount: 900 })
        legacy.items[0].price = 20
        expect(orderLines(legacy)[0].p.price).toBe(20)
        expect(orderSum(legacy, orderLines(legacy))).toBe(900)
        // товара уже нет в базе, а цена в строке записана
        const gone = orderLines({ isPaid: true, items: [{ product: null, quantity: 2, price: 15 }] })
        expect([gone[0].p.name, gone[0].p.price]).toEqual(["Удалённый товар", 15])
    })

    it("сумма — по текущим ценам товаров, а не по сохранённой totalAmount", () => {
        const lines = orderLines(order({ totalAmount: 1 }))
        expect(lines.map((x) => [x.p._id, x.qty])).toEqual([
            ["p1", 5],
            ["p2", 2]
        ])
        expect(linesTotal(lines)).toBe(950)
        expect(linesPayload(lines)).toEqual([
            { product: "p1", quantity: 5 },
            { product: "p2", quantity: 2 }
        ])
    })
    it("дефицит помечает только свою позицию и только в задетом заказе", () => {
        expect(orderShortages(shortages, "o1")).toHaveLength(1)
        expect(orderShortages(shortages, "o2")).toEqual([])
        expect(orderShortages(undefined, "o1")).toEqual([])
        const lines = orderLines(order(), orderShortages(shortages, "o1"))
        expect(lines.map((x) => x.bad)).toEqual([false, true])
        expect(lines[1].note).toBe("Дефицит: нужно 7, на складе 3")
    })
    it("товар, которого больше нет, не ломает сумму", () => {
        const lines = orderLines(
            order({
                items: [
                    { product: null, quantity: 3 },
                    { product: { _id: "p3", name: "Старый_удален", price: 10, deletedAt: 5 }, quantity: 1 }
                ]
            })
        )
        expect(lines[0].p.name).toBe("Удалённый товар")
        expect(lines[1].note).toBe("удалён из каталога")
        expect(linesTotal(lines)).toBe(10)
    })
})

describe("правка позиций", () => {
    it("предел количества: свободный остаток плюс уже стоящее в этом заказе", () => {
        expect(maxQty({ quantity: 4 }, 5)).toBe(9)
        expect(maxQty({ quantity: -2 }, 5)).toBe(3)
        expect(maxQty({ quantity: -7 }, 5)).toBe(0)
        expect(maxQty({ quantity: 4 })).toBe(4)
        expect(maxQty(undefined, 5)).toBe(9999)
    })
    it("неоплаченный заказ: ни доплаты, ни возврата", () => {
        expect(editDiff(order(), 2000)).toBe(0)
    })
    it("оплата подтверждалась: разница с подтверждённой суммой", () => {
        const o = order({ isPaid: true, paidAmount: 950, totalAmount: 1200 })
        expect(editDiff(o, 1500)).toBe(550)
        expect(editDiff(o, 800)).toBe(-150)
        expect(editDiff(o, 950)).toBe(0)
    })
    it("оплачен, но ещё не подтверждён: разница с суммой, на которую заказчик отметил оплату", () => {
        // оплачено 60 → правка до 90 (доплата 30) → вторая правка до 30: возврат 30, а не 60 от суммы после первой правки
        const o = order({
            isPaid: true,
            paidAmount: 0,
            totalAmount: 90,
            paymentEvents: [
                { type: "paid", amount: 60 },
                { type: "surcharge-pending", amount: 30 }
            ]
        })
        expect(committed(o)).toBe(60)
        expect(editDiff(o, 30)).toBe(-30)
        expect(editDiff(o, 90)).toBe(30)
    })
    it("старый заказ без события paid: разница с прежней суммой заказа, а не со всей суммой", () => {
        const o = order({ isPaid: true, paidAmount: 0, totalAmount: 950, paymentEvents: [{ type: "items-changed" }] })
        expect(committed(o)).toBe(950)
        expect(editDiff(o, 1150)).toBe(200)
        expect(editDiff(o, 900)).toBe(-50)
        expect(committed(order({ isPaid: true, totalAmount: 0 }))).toBe(0)
    })
    it("подтверждённая сумма важнее отметки об оплате", () => {
        expect(committed(order({ isPaid: true, paidAmount: 90, totalAmount: 30, paymentEvents: [{ type: "paid", amount: 60 }] }))).toBe(90)
    })
    it("сумма на экране: у оплаченного — записанная сервером, у неоплаченного — по текущим ценам строк", () => {
        const lines = [{ p: { price: 35 }, qty: 2 }]
        expect(orderSum(order({ isPaid: true, totalAmount: 60 }), lines)).toBe(60)
        expect(orderSum(order({ isPaid: false, totalAmount: 60 }), lines)).toBe(linesTotal(lines))
        expect(orderSum(order({ isPaid: true, totalAmount: 0 }), lines)).toBe(linesTotal(lines))
    })
    it("подтверждённый ноль — это ноль, а не прежняя отметка об оплате", () => {
        const o = order({
            isPaid: true,
            paidAmount: 0,
            totalAmount: 0,
            paymentEvents: [
                { type: "paid", amount: 60 },
                { type: "refund-pending", amount: -60 },
                { type: "payment-confirmed", amount: 0 }
            ]
        })
        expect(committed(o)).toBe(0)
        expect(editDiff(o, 50)).toBe(50)
    })
    it("завершённый заказ: разница с прежней суммой заказа — правки рассчитываются по отдельности", () => {
        // подтверждено 100, первая правка до 80 (возврат 20 уже записан), вторая до 90 — доплата 10, а не возврат 10
        const o = order({ isPaid: true, confirmedPaid: true, isCompleted: true, paidAmount: 100, totalAmount: 80 })
        expect(editDiff(o, 90)).toBe(10)
        expect(editDiff(o, 60)).toBe(-20)
    })
    it("тот же состав в другом порядке — не изменение", () => {
        const a = orderLines(order())
        expect(sameItems(a, [...a].reverse())).toBe(true)
        expect(sameItems(a, [{ ...a[0], qty: 6 }, a[1]])).toBe(false)
        expect(sameItems(a, [a[0]])).toBe(false)
    })
})

describe("окно подтверждения — снимок, который живёт, пока верен", () => {
    const session = (over = {}) => ({ user: { _id: "u1", isAdmin: false, ...over.user }, can: (p) => (over.perms || []).includes(p), isSys: !!over.isSys })
    const owner = session()
    const keeper = session({ user: { _id: "k1", isAdmin: true }, perms: ["edit_orders"] })
    const mine = (over = {}) => order({ user: { _id: "u1" }, ...over })
    // то же состояние, что собирает экран заказа: права по живому заказу, сумма по текущим ценам, ожидаемая разница
    const now = (o, s, env, id = o._id) => ({ id, pm: orderPerms(o, s, env), sum: linesTotal(orderLines(o)), diff: orderDiff(o) })
    const snap = (kind, o, s) => {
        const { id, sum, diff } = now(o, s)
        return { kind, id, sum, diff }
    }

    it("флаги запроса по виду действия", () => {
        expect(ASK_FLAGS).toEqual({ pay: [true, false, false], confirm: [true, true, false], complete: [true, true, true] })
    })
    it("действие доступно только в своём статусе; выдача — ещё и без дефицита и заморозки", () => {
        const ready = mine({ isPaid: true, confirmedPaid: true })
        expect(askAllowed("pay", orderPerms(mine(), owner))).toBe(true)
        expect(askAllowed("pay", orderPerms(ready, owner))).toBe(false)
        expect(askAllowed("confirm", orderPerms(mine({ isPaid: true }), owner))).toBe(false)
        expect(askAllowed("complete", orderPerms(ready, owner))).toBe(true)
        expect(askAllowed("complete", orderPerms(ready, owner, { deficit: true }))).toBe(false)
        expect(askAllowed("complete", orderPerms(ready, owner, { frozen: true }))).toBe(false)
        expect(askAllowed("invoice", orderPerms(ready, owner))).toBe(false)
    })
    it("заказчик открыл «Вы перевели…?», а заказ тем временем оплатили и подтвердили — окно устарело", () => {
        const ask = snap("pay", mine(), owner)
        expect(askStale(ask, now(mine(), owner))).toBe(false)
        expect(askStale(ask, now(mine({ isPaid: true }), owner))).toBe(true)
        expect(askStale(ask, now(mine({ isPaid: true, confirmedPaid: true }), owner))).toBe(true)
    })
    it("открыт уже другой заказ — устарело любое окно, даже если то же действие там доступно", () => {
        const a = mine({ _id: "A", isPaid: true, confirmedPaid: true })
        const b = mine({ _id: "B", isPaid: true, confirmedPaid: true })
        expect(askStale(snap("complete", b, keeper), now(a, keeper))).toBe(true)
        expect(askStale({ kind: "invoice", id: "B" }, now(a, keeper))).toBe(true)
        expect(askStale({ kind: "more", id: "A" }, now(a, keeper))).toBe(false)
    })
    it("изменилась сумма или ожидаемая разница — вопрос с прежними числами устарел", () => {
        const o = mine()
        const ask = snap("pay", o, owner)
        const dearer = mine({ items: [{ product: { _id: "p1", name: "Брелок", price: 35 }, quantity: 5 }, o.items[1]] })
        expect(askStale(ask, now(dearer, owner))).toBe(true)
        const treasurer = session({ user: { _id: "t1", isAdmin: true }, perms: ["approve-payment"] })
        const paid = (amount) => mine({ isPaid: true, paymentEvents: [{ type: "surcharge-pending", amount }] })
        expect(askStale(snap("confirm", paid(200), treasurer), now(paid(200), treasurer))).toBe(false)
        expect(askStale(snap("confirm", paid(200), treasurer), now(paid(100), treasurer))).toBe(true)
    })
    it("выдача: появился дефицит или началась инвентаризация — окно устарело", () => {
        const ready = mine({ isPaid: true, confirmedPaid: true })
        const ask = snap("complete", ready, keeper)
        expect(askStale(ask, now(ready, keeper))).toBe(false)
        expect(askStale(ask, now(ready, keeper, { deficit: true }))).toBe(true)
        expect(askStale(ask, now(ready, keeper, { frozen: true }))).toBe(true)
    })
})

describe("плашка доплаты и возврата", () => {
    // money() ставит между числом и знаком рубля неразрывный пробел — ожидаемые строки собираются ею же
    it("оплата подтверждалась: «оплачено» — сумма с сервера", () => {
        expect(diffText(order({ totalAmount: 700, paidAmount: 500 }), 200)).toBe(`Всего к оплате ${money(700)}, оплачено ${money(500)}. Казначей должен повторно подтвердить оплату.`)
        expect(diffText(order({ totalAmount: 400, paidAmount: 500 }), -100)).toBe(`Всего к оплате ${money(400)}, оплачено ${money(500)}. Казначей должен подтвердить возврат.`)
    })
    it("подтверждений ещё не было: сумма оплаченного не утверждается", () => {
        expect(diffText(order({ totalAmount: 600, paidAmount: 0 }), -100)).toBe(`Всего к оплате ${money(600)}. Казначей должен подтвердить возврат.`)
        expect(diffText(order({ totalAmount: 700, paidAmount: 0 }), 200)).toBe(`Всего к оплате ${money(700)}. Казначей должен подтвердить оплату.`)
        expect(diffText(order({ totalAmount: 700, paidAmount: 0 }), 200)).not.toMatch(/оплачено/)
    })
})

describe("фильтры списка", () => {
    it("каждый заказ попадает в свой статус; активные — все незавершённые", () => {
        const list = [order(), order({ isPaid: true }), order({ isPaid: true, confirmedPaid: true }), order({ isPaid: true, confirmedPaid: true, isCompleted: true })]
        const count = (k) => list.filter(FILTERS[k].fn).length
        expect(["new", "paid", "ready", "done", "active"].map(count)).toEqual([1, 1, 1, 1, 3])
    })
})
