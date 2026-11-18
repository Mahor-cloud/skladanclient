/**
 * Copyright 2026 Lord_mahor
 * Licensed under Apache 2.0
 */

import { beforeEach, describe, expect, it } from "vitest"
import { useCart } from "./useCart"

// Ключ попытки оформления: тот же, пока корзина не менялась; любая правка корзины даёт новый и снимает отметку «уходил».
describe("useCart: ключ попытки оформления", () => {
    const { set, replace, clear, orderKey, sent, markSent } = useCart()
    beforeEach(() => clear())

    it("ключ один на содержимое корзины и лежит рядом с ней", () => {
        set("p1", 2)
        const key = orderKey()
        expect(key).toMatch(/^[A-Za-z0-9-]{8,64}$/)
        expect(orderKey()).toBe(key)
        expect(localStorage.getItem("cartKey")).toBe(key)
    })

    it("правка корзины даёт новый ключ и снимает отметку отправки", () => {
        set("p1", 2)
        const key = orderKey()
        markSent(true)
        expect(sent.value).toBe(true)
        set("p1", 3)
        expect(sent.value).toBe(false)
        expect(orderKey()).not.toBe(key)
        const next = orderKey()
        markSent(true)
        replace({ p2: 1 })
        expect(sent.value).toBe(false)
        expect(orderKey()).not.toBe(next)
    })

    it("отметку отправки, поставленную в другой вкладке, видит и эта", () => {
        set("p1", 1)
        expect(sent.value).toBe(false)
        localStorage.setItem("cartKeySent", "1")
        window.dispatchEvent(Object.assign(new Event("storage"), { key: "cartKeySent" }))
        expect(sent.value).toBe(true)
        localStorage.removeItem("cartKeySent")
        window.dispatchEvent(Object.assign(new Event("storage"), { key: "cartKeySent" }))
        expect(sent.value).toBe(false)
    })

    it("отметка отправки переживает повторное чтение и снимается явно", () => {
        set("p1", 1)
        orderKey()
        markSent(true)
        expect(localStorage.getItem("cartKeySent")).toBe("1")
        markSent(false)
        expect(sent.value).toBe(false)
    })
})
