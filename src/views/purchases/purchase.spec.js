/**
 * Copyright 2026 Lord_mahor
 * Licensed under Apache 2.0
 */

import { money, pcs } from "@/domain/format"
import { describe, expect, it } from "vitest"
import { needOf, overBy, pst, puGot, puLineProduct, puPayload, puPerm, puPieces, puTotal, puTurn, qtyIn, rcvIn, syncDraft } from "./purchase"

describe("закупка", () => {
    it("статус по флагам сервера", () => {
        expect(pst({})).toBe("draft")
        expect(pst({ isCreated: true })).toBe("unpaid")
        expect(pst({ isCreated: true, isPaid: true })).toBe("receiving")
        expect(pst({ isCreated: true, isPaid: true, partialCompleted: true })).toBe("partial")
        expect(pst({ isCreated: true, isPaid: true, partialCompleted: true, isCompleted: true })).toBe("done")
    })

    it("после оплаты сумма и цены строк — записанные в закупке, смена цены товара их не меняет", () => {
        const pu = {
            isPaid: true,
            isCompleted: true,
            totalAmount: 70,
            items: [
                { product: "a", quantity: 3, confirmedQuantity: 3, price: 20 },
                { product: "c", quantity: 2, price: 5 }
            ]
        }
        const now = { a: 30, c: 5 }
        expect(puTotal(pu, (id) => now[id])).toBe(70)
        const a = { _id: "a", name: "Брелок", price: 30 }
        expect(puLineProduct(pu, pu.items[0], a)).toEqual({ _id: "a", name: "Брелок", price: 20 })
        expect(a.price).toBe(30)
        // цена не менялась — тот же объект товара; до оплаты и без цены в строке — текущая цена
        const c = { _id: "c", price: 5 }
        expect(puLineProduct(pu, pu.items[1], c)).toBe(c)
        expect(puLineProduct({ isPaid: false }, { price: 20 }, a)).toBe(a)
        expect(puLineProduct({ isPaid: true }, { quantity: 1 }, a)).toBe(a)
        expect(puTotal({ ...pu, isPaid: false }, (id) => now[id])).toBe(100)
    })

    it("суммы и штуки — только позиции с количеством, по текущим ценам", () => {
        const pu = {
            items: [
                { product: "a", quantity: 3, confirmedQuantity: 1 },
                { product: "b", quantity: 0 },
                { product: { _id: "c" }, quantity: 2, confirmedQuantity: 2 }
            ]
        }
        const price = { a: 10, b: 99, c: 5 }
        expect(puTotal(pu, (id) => price[id])).toBe(40)
        expect(puPieces(pu)).toBe(5)
        expect(puGot(pu)).toBe(3)
    })

    it("права: превышение — право или системная роль; удаление — только право удаления, как на сервере", () => {
        const s = (perms, isSys = false) => ({ isSys, can: (p) => perms.includes(p) })
        expect(puPerm(s(["approve_target_exceed"])).exceed).toBe(true)
        expect(puPerm(s([], true)).exceed).toBe(true)
        expect(puPerm(s(["edit_purchases"])).exceed).toBe(false)
        expect(puPerm(s(["delete_purchases"])).del).toBe(true)
        expect(puPerm(s(["edit_purchases"])).del).toBe(false)
        expect(puPerm(s(["view_purchases"])).del).toBe(false)
    })

    it("ход: чей шаг и сколько не довезли", () => {
        expect(puTurn("unpaid", { pay: true }, { total: 1250 }).text).toBe(`Оплатите ${money(1250)} поставщику`)
        expect(puTurn("unpaid", { pay: false }).mine).toBeUndefined()
        expect(puTurn("partial", { edit: true }, { left: 7 }).short).toBe(`Довнесите ${pcs(7)}`)
    })

    it("до цели: цель − доступно, доступно бывает отрицательным", () => {
        expect(needOf({ targetQty: 10, quantity: 4 })).toBe(6)
        expect(needOf({ targetQty: 10, quantity: -2 })).toBe(12)
        expect(needOf({ targetQty: 10, quantity: 15 })).toBe(0)
        expect(needOf({ quantity: 0 })).toBe(0)
    })

    it("превышение цели как на сервере: потолок — большее из цели и прежнего количества", () => {
        const p = { targetQty: 10 }
        expect(overBy(p, 12, 0, false)).toBe(2)
        expect(overBy(p, 12, 15, false)).toBe(0)
        expect(overBy(p, 16, 15, false)).toBe(6)
        expect(overBy(p, 12, 15, true)).toBe(2)
        expect(overBy({ targetQty: 0 }, 99, 0, false)).toBe(0)
    })

    it("сумма: товара нет в каталоге — сумма сервера", () => {
        const pu = {
            totalAmount: 60,
            items: [
                { product: "a", quantity: 2 },
                { product: "gone", quantity: 1 }
            ]
        }
        expect(puTotal(pu, (id) => ({ a: 10 })[id])).toBe(60)
        expect(puTotal({ items: [{ product: "gone", quantity: 1 }] }, () => undefined)).toBe(0)
    })

    it("несохранённые количества черновика действуют только в черновике", () => {
        const d = { qty: { x: 5 }, added: { y: 3 }, rcv: {} }
        const x = { _id: "x", q0: 10, conf: 0 }
        const y = { _id: "y", q0: 0, conf: 0, added: true }
        expect(qtyIn(d, x, "draft")).toBe(5)
        expect(qtyIn(d, x, "unpaid")).toBe(10)
        expect(qtyIn(d, x, "receive")).toBe(10)
        expect(qtyIn(d, y, "unpaid")).toBe(3)
        expect(qtyIn(d, y, "receive")).toBe(0)
    })

    it("принято: не меньше принятого на сервере и не больше заказанного", () => {
        const l = { _id: "x", q0: 10, conf: 10 }
        expect(rcvIn({ rcv: { x: 5 } }, l)).toBe(10)
        expect(rcvIn({ rcv: { x: 7 } }, { _id: "x", q0: 10, conf: 4 })).toBe(7)
        expect(rcvIn({ rcv: { x: 15 } }, { _id: "x", q0: 10, conf: 4 })).toBe(10)
        expect(rcvIn({ rcv: {} }, { _id: "x", q0: 10, conf: 4 })).toBe(4)
        // заказано меньше уже принятого (испорченные данные) — принятое всё равно не уменьшается
        expect(rcvIn({ rcv: {} }, { _id: "x", q0: 5, conf: 10 })).toBe(10)
    })

    it("смена статуса сбрасывает несохранённый ввод и подборку, первый показ — нет", () => {
        const d = { qty: { x: 5 }, rcv: {}, added: {}, touched: { x: true }, view: "in", kind: "IP", q: "брелок" }
        syncDraft(d, "draft")
        expect(d.qty).toEqual({ x: 5 })
        syncDraft(d, "draft")
        expect(d.qty).toEqual({ x: 5 })
        syncDraft(d, "receiving")
        expect(d).toMatchObject({ qty: {}, touched: {}, view: null, kind: "", q: "брелок", st: "receiving" })
    })

    it("тело запроса: при создании — только позиции с количеством", () => {
        const rows = [
            { product: "a", quantity: 2, confirmedQuantity: 0 },
            { product: "b", quantity: 0, confirmedQuantity: 0 }
        ]
        const flags = { isCreated: true, isPaid: false, partialCompleted: false, isCompleted: false }
        expect(puPayload(rows, flags, true)).toEqual({ ...flags, items: [{ product: "a", quantity: 2, confirmedQuantity: 0 }] })
        expect(puPayload(rows, flags).items).toHaveLength(2)
        expect(puPayload([rows[1]], flags, true)).toBeNull()
    })
})
