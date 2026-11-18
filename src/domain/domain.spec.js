/**
 * Copyright 2026 Lord_mahor
 * Licensed under Apache 2.0
 */

import { describe, expect, it } from "vitest"
import { cartFix, cartLines, cartTotal } from "./cart"
import { coverColor, coverSVG, coverType, kindCover, stockCover } from "./covers"
import { date, money, plural, positions, rel } from "./format"
import { homePath, tabsFor, visibleNav } from "./nav"
import { ALL } from "./perms"
import { orderDiff, orderPerms, orderPieces, orderStatus, orderSteps, orderTotal, orderTurn } from "./orders"
import { deficit, incomingMap, invFrozen, invLock, searchProducts, stockLevel } from "./stock"

const session = (over = {}) => {
    const perms = over.perms || []
    return { user: { _id: "u1", isAdmin: false, ...over.user }, can: (p) => perms.includes(p), isSys: !!over.isSys, isStaff: !!over.isStaff }
}
const order = (over = {}) => ({
    _id: "o1",
    orderNumber: 7,
    user: { _id: "u1", name: "Штаб" },
    items: [{ product: "p1", quantity: 2 }],
    isPaid: false,
    confirmedPaid: false,
    isCompleted: false,
    totalAmount: 500,
    orderDate: 1,
    paymentEvents: [],
    ...over
})

describe("format", () => {
    it("деньги и склонения", () => {
        expect(money(1250)).toBe("1 250 ₽")
        expect(money(null)).toBe("0 ₽")
        expect([1, 2, 5, 11, 21, 104].map((n) => plural(n, ["товар", "товара", "товаров"]))).toEqual(["товар", "товара", "товаров", "товаров", "товар", "товара"])
        expect(positions(3)).toBe("3 позиции")
    })
    it("даты", () => {
        const now = new Date(2026, 10, 17, 12, 0)
        expect(date(new Date(2026, 10, 3, 9, 5))).toBe("03.11.2026")
        expect(rel(new Date(2026, 10, 17, 9, 5), now)).toBe("сегодня, 09:05")
        expect(rel(new Date(2026, 10, 16, 23, 59), now)).toBe("вчера, 23:59")
        expect(rel(new Date(2026, 10, 3, 18, 45), now)).toBe("3 ноября, 18:45")
    })
})

describe("остатки", () => {
    it("уровень остатка: quantity — доступно, totalQuantity — физически", () => {
        expect(stockLevel({ quantity: 12, totalQuantity: 15 })).toEqual({ level: "ok", a: 12, reserved: 3 })
        expect(stockLevel({ quantity: 5, totalQuantity: 5 }).level).toBe("low")
        expect(stockLevel({ quantity: 0, totalQuantity: 4 }).level).toBe("out")
        expect(stockLevel({ quantity: -2, totalQuantity: 3 })).toEqual({ level: "deficit", a: -2, reserved: 5 })
    })
    it("в пути — только созданные непроведённые закупки, за вычетом принятого", () => {
        const m = incomingMap([
            {
                isCreated: true,
                isCompleted: false,
                items: [
                    { product: "p1", quantity: 10, confirmedQuantity: 4 },
                    { product: "p2", quantity: 3, confirmedQuantity: 3 }
                ]
            },
            { isCreated: false, isCompleted: false, items: [{ product: "p1", quantity: 99 }] },
            { isCreated: true, isCompleted: true, items: [{ product: "p1", quantity: 99 }] }
        ])
        expect(m).toEqual({ p1: 6 })
    })
    it("дефицит называет товары и заказы", () => {
        const d = deficit(
            [
                { _id: "p1", quantity: -1, totalQuantity: 2 },
                { _id: "p2", quantity: 3, totalQuantity: 3 }
            ],
            [order({ _id: "o1", orderNumber: 7 }), order({ _id: "o2", orderNumber: 8, items: [{ product: { _id: "p2" }, quantity: 1 }] }), order({ _id: "o3", isCompleted: true })]
        )
        expect(d.products.map((x) => [x.p._id, x.need, x.have, x.orders])).toEqual([["p1", 3, 2, [7]]])
        expect(Object.keys(d.orders)).toEqual(["o1"])
    })
    it("поиск по названию, виду, цене и наличию", () => {
        const ps = [
            { _id: "a", name: "Ёлка IP #16", category: "ИП", price: 30, quantity: 2 },
            { _id: "b", name: "Брелок", category: "Брелок", price: 50, quantity: 0 }
        ]
        expect(searchProducts(ps, "елка ip#16").map((p) => p._id)).toEqual(["a"])
        expect(searchProducts(ps, "мало").map((p) => p._id)).toEqual(["a"])
        expect(searchProducts(ps, "ждет поставку", { b: 5 }).map((p) => p._id)).toEqual(["b"])
        expect(searchProducts(ps, "  ")).toBe(ps)
    })
    it("инвентаризация: выдача заморожена всегда, создание — по настройке местности", () => {
        const inv = { _id: "i2", isCompleted: false }
        expect(invFrozen(inv)).toBe(true)
        expect(invLock(inv, { allowInventoryWithOpenDocs: false })).toBe(true)
        expect(invLock(inv, { allowInventoryWithOpenDocs: true })).toBe(false)
        expect(invLock(inv, undefined)).toBe(false)
        expect(invLock(inv, {})).toBe(true)
        expect(invLock(null, { allowInventoryWithOpenDocs: false })).toBe(false)
    })
})

describe("корзина", () => {
    const products = [
        { _id: "a", name: "Книга", price: 400, quantity: 3 },
        { _id: "b", name: "Брелок", price: 30, quantity: 0 },
        { _id: "c", name: "Буклет", price: 50, quantity: 10 }
    ]
    it("строки и сумма: только товары каталога, лишнее помечено", () => {
        const lines = cartLines({ a: 5, c: 2, нет: 1, b: 0 }, products)
        expect(lines.map((x) => [x.p._id, x.qty, x.max, x.bad])).toEqual([
            ["a", 5, 3, true],
            ["c", 2, 10, false]
        ])
        expect(cartTotal(lines)).toBe(2100)
    })
    it("сверка с остатками: уменьшает, убирает и называет исправления", () => {
        const r = cartFix({ a: 5, b: 2, c: 2, нет: 1 }, products)
        expect(r.cart).toEqual({ a: 3, c: 2 })
        expect(r.corrections).toEqual(["Книга: 5 → 3 (доступно)", "Брелок — нет на складе, убран из корзины", "Товар — нет на складе, убран из корзины"])
        expect(cartFix({ c: 2 }, products).corrections).toEqual([])
    })
})

describe("заказы", () => {
    it("статус, штуки, сумма", () => {
        expect(orderStatus(order())).toBe("new")
        expect(orderStatus(order({ isPaid: true }))).toBe("paid")
        expect(orderStatus(order({ isPaid: true, confirmedPaid: true }))).toBe("ready")
        expect(orderStatus(order({ isCompleted: true }))).toBe("done")
        expect(orderPieces(order({ items: [{ quantity: 2 }, { quantity: 5 }] }))).toBe(7)
        expect(orderTotal(order())).toBe(500)
        expect(orderTotal(order({ totalAmount: 0 }), () => 120)).toBe(240)
        expect(orderTotal(order({ totalAmount: 0, items: [{ product: { _id: "p1", price: 30 }, quantity: 3 }] }))).toBe(90)
    })
    it("доплата и возврат — по последнему событию после подтверждения оплаты", () => {
        const ev = (type, amount) => ({ type, amount })
        expect(orderDiff(order({ isPaid: true, paymentEvents: [ev("paid", 500), ev("payment-confirmed", 500), ev("items-changed", 100), ev("surcharge-pending", 100)] }))).toBe(100)
        expect(orderDiff(order({ isPaid: true, paymentEvents: [ev("refund-pending", -80)] }))).toBe(-80)
        expect(orderDiff(order({ isPaid: true, paymentEvents: [ev("surcharge-pending", 100), ev("payment-confirmed", 600)] }))).toBe(0)
        expect(orderDiff(order({ isPaid: true, confirmedPaid: true, paymentEvents: [ev("surcharge-pending", 100)] }))).toBe(0)
        expect(orderDiff(order({ paymentEvents: [ev("surcharge-pending", 100)] }))).toBe(0)
        // оплачено 60 → правка до 90 (доплата 30) → правка обратно до 60: разницы нет, старая плашка не висит
        expect(orderDiff(order({ isPaid: true, paymentEvents: [ev("paid", 60), ev("items-changed", 30), ev("surcharge-pending", 30), ev("items-changed", -30)] }))).toBe(0)
    })
    it("права: заказчик, служащий с правом, казначей, системная роль", () => {
        const rep = session()
        const keeper = session({ user: { _id: "k", isAdmin: true }, perms: ["edit_orders"] })
        const noFlag = session({ user: { _id: "k", isAdmin: false }, perms: ["edit_orders", "approve-payment"] })
        const tre = session({ user: { _id: "t", isAdmin: true }, perms: ["approve-payment"] })
        const sys = session({ user: { _id: "a", isAdmin: true }, isSys: true })
        expect(orderPerms(order(), rep)).toMatchObject({ own: true, pay: true, edit: true, cancel: true, confirm: false })
        expect(orderPerms(order(), noFlag)).toMatchObject({ view: false, pay: false, edit: false, cancel: false })
        expect(orderPerms(order({ isPaid: true }), rep)).toMatchObject({ waiting: true, edit: true, confirm: false })
        expect(orderPerms(order({ isPaid: true }), tre)).toMatchObject({ confirm: true, edit: false, cancel: false })
        expect(orderPerms(order({ isPaid: true, confirmedPaid: true }), rep)).toMatchObject({ complete: true, edit: false })
        expect(orderPerms(order({ isPaid: true, confirmedPaid: true }), keeper)).toMatchObject({ complete: true, edit: true })
        expect(orderPerms(order({ isCompleted: true }), keeper)).toMatchObject({ edit: false, remove: false, cancel: false })
        expect(orderPerms(order({ isCompleted: true }), sys)).toMatchObject({ edit: true, remove: true })
    })
    it("дефицит блокирует завершение, инвентаризация замораживает", () => {
        const ready = order({ isPaid: true, confirmedPaid: true })
        expect(orderPerms(ready, session(), { deficit: true, frozen: true })).toMatchObject({ blocked: true, frozen: false })
        expect(orderPerms(ready, session(), { frozen: true })).toMatchObject({ blocked: false, frozen: true })
        expect(orderPerms(order(), session(), { deficit: true, frozen: true })).toMatchObject({ blocked: false, frozen: false })
    })
    it("что дальше", () => {
        const tre = session({ user: { _id: "t", isAdmin: true }, perms: ["approve-payment"] })
        const keeper = session({ user: { _id: "k", isAdmin: true }, perms: ["edit_orders"] })
        expect(orderTurn(order(), session())).toMatchObject({ mine: true, short: "Оплатите" })
        expect(orderTurn(order(), tre)).toMatchObject({ mine: false, short: "Ждёт оплаты", text: "Ждёт оплаты от группы «Штаб»" })
        expect(orderTurn(order({ isPaid: true }), tre).short).toBe("Подтвердите")
        expect(orderTurn(order({ isPaid: true }), session()).short).toBe("Ждёт казначея")
        expect(orderTurn(order({ isPaid: true, paymentEvents: [{ type: "surcharge-pending", amount: 100 }] }), session())).toMatchObject({ mine: true, short: "Доплата 100 ₽" })
        expect(orderTurn(order({ isPaid: true, paymentEvents: [{ type: "refund-pending", amount: -80 }] }), tre)).toMatchObject({ mine: true, short: "Возврат 80 ₽" })
        const ready = order({ isPaid: true, confirmedPaid: true })
        expect(orderTurn(ready, session()).short).toBe("Можно забирать")
        expect(orderTurn(ready, keeper)).toMatchObject({ mine: true, short: "Выдайте" })
        expect(orderTurn(ready, tre)).toMatchObject({ mine: false, short: "Ждёт выдачи" })
        expect(orderTurn(ready, keeper, { deficit: true })).toMatchObject({ warn: true, short: "Дефицит на складе" })
        expect(orderTurn(ready, session(), { frozen: true })).toMatchObject({ frozen: true, short: "Выдача после инвентаризации" })
        expect(orderTurn(order({ isCompleted: true }), session()).short).toBe("Получен")
    })
    it("шаги трекера берут время из платёжных событий", () => {
        const s = orderSteps(
            order({
                isPaid: true,
                confirmedPaid: true,
                orderDate: 10,
                paymentEvents: [
                    { type: "paid", at: 20 },
                    { type: "payment-confirmed", at: 30 },
                    { type: "payment-confirmed", at: 40 }
                ]
            })
        )
        expect(s.map((x) => [x.key, x.done, x.at])).toEqual([
            ["new", true, 10],
            ["paid", true, 20],
            ["ready", true, 40],
            ["done", false, null]
        ])
    })
})

describe("каталог прав", () => {
    it("38 прав без повторов, совпадает с серверным списком", () => {
        expect(ALL).toHaveLength(38)
        expect(new Set(ALL).size).toBe(38)
    })
})

describe("обложки", () => {
    const book = { _id: "67d1", name: 'Базовый <b>"Текст"</b> Твердая обложка', category: "Книга" }
    it("тип: по виду, настройке местности и названию", () => {
        expect(coverType(book)).toBe("hardbook")
        expect(coverType({ ...book, name: "Спонсорство" })).toBe("book")
        expect(coverType(book, { Книга: "mug" })).toBe("mug")
        expect(coverType({ name: "Карточки для чтения", category: "Прочее" })).toBe("cards")
        expect(coverType(book, {}, "нет такого")).toBe("box")
        expect(kindCover("Новый вид")).toBe("box")
        expect(kindCover("Книга", { Книга: "нет такого" })).toBe("book")
    })
    it("название в SVG экранируется", () => {
        const svg = coverSVG(book)
        expect(svg).not.toContain("<b>")
        expect(svg).toContain("&lt;B&gt;")
    })
    it("цвет товара принимается только как #RRGGBB", () => {
        expect(coverColor({ ...book, coverColor: "#7A2140" })).toBe("#7A2140")
        expect(coverColor({ ...book, coverColor: 'red" onload="x' })).toMatch(/^#[0-9A-F]{6}$/i)
        expect(coverSVG({ ...book, coverColor: '"><script>' })).not.toContain("<script>")
        expect(coverColor({ _id: "x", name: "Только Сегодня Брелок", category: "Брелок" })).toBe("#8A8F9E")
    })
    it("настоящая обложка находится по названию", () => {
        expect(stockCover({ name: 'Только Сегодня "Ежедневник"' })).toBe("/covers/p003.webp")
        expect(stockCover({ name: "Такого товара нет" })).toBe(null)
    })
    it("вид, тип и название вроде constructor не находят свойств прототипа", () => {
        const odd = { _id: "x", name: "constructor", category: "toString" }
        expect(kindCover("constructor")).toBe("box")
        expect(kindCover("toString", { toString: "book" })).toBe("book")
        expect(kindCover("Книга", { Книга: "constructor" })).toBe("book")
        expect(coverType(odd, {}, "__proto__")).toBe("box")
        expect(coverSVG(odd)).toContain("<svg")
        expect(stockCover(odd)).toBe(null)
    })
})

describe("разделы", () => {
    const s = (perms, over = {}) => ({ user: { role: {} }, can: (p) => perms.includes(p), isSuper: false, isSys: false, isStaff: false, ...over })
    const ids = (list) => list.map((n) => n.id)
    it("видны по правам; супер-админ не видит рабочих разделов", () => {
        expect(ids(visibleNav(s(["view_orders", "cabinet_access"])))).toEqual(["storage", "orders", "cabinet"])
        expect(ids(visibleNav(s([], { isSuper: true })))).toEqual(["companies", "seeds", "metrics"])
        expect(ids(visibleNav(s([], { isStaff: true })))).toEqual(["storage", "admin"])
    })
    it("нижнее меню: авто по приоритету или набор роли, не больше четырёх и только доступное", () => {
        const all = ["view_orders", "cabinet_access", "view_purchases", "view_inventory", "view_statistics"]
        expect(ids(tabsFor(s(all)))).toEqual(["storage", "orders", "cabinet", "purchases"])
        expect(ids(tabsFor(s(all), ["statistics", "admin", "orders", "нет"]))).toEqual(["statistics", "orders"])
        expect(ids(tabsFor(s(all, { user: { role: { mobileTabs: ["inventory", "storage"] } } })))).toEqual(["inventory", "storage"])
        expect(ids(tabsFor(s(all), []))).toEqual(["storage", "orders", "cabinet", "purchases"])
    })
    it("домашний раздел", () => {
        expect(homePath(s([], { isSuper: true }))).toBe("/companies")
        expect(homePath(s(["create_orders", "view_orders"], { isStaff: true }))).toBe("/")
        expect(homePath(s([], { isSys: true, isStaff: true }))).toBe("/")
        expect(homePath(s(["view_orders"], { isStaff: true }))).toBe("/shop")
        expect(homePath(s(["view_orders"]))).toBe("/")
        expect(homePath(s([], { isStaff: true }))).toBe("/")
    })
})
