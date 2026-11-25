/**
 * Copyright 2026 Lord_mahor
 * Licensed under Apache 2.0
 */

import { coverType } from "@/domain/covers"
import { describe, expect, it } from "vitest"
import { autofill, cabinetGroups, cabStats, ownCover, rowKey, sumBar } from "./cabinet"

const row = (o) => ({ productId: null, cabinetItemId: null, price: 0, baseQty: 0, currentQty: 0, inOrderQty: 0, isCustom: false, ...o })

describe("cabStats", () => {
    const rows = [
        row({ productId: "a", price: 100, baseQty: 5, currentQty: 1, inOrderQty: 1 }), // нужно 3, на складе 2
        row({ productId: "b", price: 50, baseQty: 2, currentQty: 4 }), // сверх цели +2
        row({ productId: "c", price: 10 }), // не отслеживается
        row({ productId: "d", price: 20, inOrderQty: 2 }), // в заказе — отслеживается
        row({ cabinetItemId: "own1", isCustom: true, price: 999, baseQty: 3 }) // своя: нужно 3, но не в деньги
    ]
    const avail = { a: 2, b: 9, c: 0, d: 0 }
    const val = (r, f) => r[f] || 0

    it("считает отслеживаемые, нужно, деньги дефицита и «сверх цели»", () => {
        const s = cabStats(rows, val, (r) => avail[r.productId])
        expect(s.tracked).toBe(4)
        expect(s.own).toBe(1)
        expect(s.needN).toBe(2)
        expect(s.needPcs).toBe(6)
        expect(s.defSum).toBe(300)
        expect(s.stock.map(rowKey)).toEqual(["a"])
        expect(s.availN).toBe(1)
        expect(s.availSum).toBe(200) // min(3, 2) × 100
        expect([s.overN, s.overPcs]).toEqual([1, 2])
    })

    it("берёт несохранённые значения через val", () => {
        const edits = { "a-currentQty": 5 }
        const s = cabStats(
            rows,
            (r, f) => edits[`${rowKey(r)}-${f}`] ?? (r[f] || 0),
            (r) => avail[r.productId]
        )
        expect(s.stock).toEqual([])
        expect(s.defSum).toBe(0)
        expect(s.overN).toBe(1) // у «a» теперь 5 из 5 — не сверх цели; у «b» по-прежнему 4 из 2
    })
})

describe("autofill", () => {
    it("кладёт нужное, не уменьшает корзину, недоступное — сколько есть и в перечень", () => {
        const r = autofill({ a: 5, x: 1 }, [
            { product: "a", productName: "А", neededQty: 3, availableQty: 10, isMissing: false },
            { product: "b", productName: "Б", neededQty: 4, availableQty: 10, isMissing: false },
            { product: "c", productName: "В", neededQty: 6, availableQty: 2, isMissing: true },
            { product: "d", productName: "Г", neededQty: 2, availableQty: 0, isMissing: true },
            { product: "", productName: "Своё", neededQty: 1, availableQty: 0, isMissing: true },
            { product: "e", productName: "Д", neededQty: 0, availableQty: 5, isMissing: false }
        ])
        expect(r.cart).toEqual({ a: 5, x: 1, b: 4, c: 2 })
        expect(r.added).toBe(2)
        expect(r.miss).toEqual(["В — нужно 6, доступно 2", "Г — нужно 2, доступно 0", "Своё (своя позиция)"])
    })
})

describe("sumBar", () => {
    it("доли от суммы целей, вместе не больше 100", () => {
        expect(sumBar(30, 17, 0, 13)).toEqual({ hv: 57, od: 0, df: 43 })
        expect(sumBar(10, 15, 5, 0)).toEqual({ hv: 100, od: 0, df: 0 })
        expect(sumBar(0, 0, 0, 0)).toEqual({ hv: 0, od: 0, df: 0 })
    })
})

describe("cabinetGroups", () => {
    it("группы по имени, позиции с целью или запасом, сначала дефицит", () => {
        const g = cabinetGroups([
            { user: { _id: "2", name: "Маяк" }, product: { name: "Книга", price: 100 }, baseQty: 1, currentQty: 1 },
            { user: { _id: "1", name: "Атмосфера" }, product: null, customName: "Своё", baseQty: 3, currentQty: 0 },
            { user: { _id: "2", name: "Маяк" }, product: { name: "Буклет", price: 10 }, baseQty: 5, currentQty: 2 },
            { user: { _id: "2", name: "Маяк" }, product: { name: "Пусто", price: 10 }, baseQty: 0, currentQty: 0 },
            { user: null, product: { name: "Чужое" }, baseQty: 1, currentQty: 0 }
        ])
        expect(g.map((x) => x.user.name)).toEqual(["Атмосфера", "Маяк"])
        expect(g[0].items[0]).toMatchObject({ name: "Своё", own: true, def: 3 })
        expect(g[1].items.map((i) => [i.name, i.def])).toEqual([
            ["Буклет", 3],
            ["Книга", 0]
        ])
    })

    it("обложка: у товара — сам товар, у своей — выбранная, без выбора — значок (null)", () => {
        const book = { name: "Книга", price: 100 }
        const g = cabinetGroups([
            { _id: "c1", user: { _id: "1", name: "А" }, product: book, baseQty: 1 },
            { _id: "c2", user: { _id: "1", name: "А" }, product: null, customName: "Фото", baseQty: 3, photo: "ab".repeat(16) },
            { _id: "c3", user: { _id: "1", name: "А" }, product: null, customName: "Без", baseQty: 2 }
        ])
        const cov = Object.fromEntries(g[0].items.map((i) => [i._id, i.cov]))
        expect(cov.c1).toBe(book)
        expect(cov.c2).toMatchObject({ _id: "c2", name: "Фото", photo: "ab".repeat(16) })
        expect(cov.c3).toBeNull()
    })
})

describe("ownCover", () => {
    it("как предпросмотр формы: вид «Прочее», цвет и фото позиции", () => {
        expect(ownCover("c1", "Своё", { coverColor: "#0147B9" })).toEqual({ _id: "c1", name: "Своё", category: "Прочее", coverColor: "#0147B9", photo: undefined })
        expect(ownCover("c1", "Своё", { photo: "f".repeat(32) })).toMatchObject({ photo: "f".repeat(32) })
    })

    it("без цвета и фото — null (значок), если нет настоящей обложки по названию", () => {
        expect(ownCover("c1", "Домашние записи", {})).toBeNull()
        expect(ownCover("c1", "Домашние записи", { cover: null, coverColor: null, photo: null })).toBeNull()
    })

    it("выбранный тип рисует этим типом; неизвестный — как без выбора, а выбор в предпросмотре (type) главнее", () => {
        const p = ownCover("c1", "Домашние записи", { cover: "medal" })
        expect(p).toMatchObject({ cover: "medal" })
        expect(coverType(p)).toBe("medal")
        expect(coverType({ ...p, cover: "hardbook", name: "Блокнот" })).toBe("hardbook")
        expect(coverType({ ...p, cover: "constructor" })).toBe("box") // вид «Прочее»
        expect(coverType({ ...p, cover: "nope" }, { Прочее: "book" })).toBe("book")
        expect(coverType(p, {}, "keytag")).toBe("keytag")
        // выбранная «Книга» остаётся книгой, даже если в названии «твёрдая»
        expect(coverType({ ...p, cover: "book", name: "Твёрдая папка" })).toBe("book")
    })
})
