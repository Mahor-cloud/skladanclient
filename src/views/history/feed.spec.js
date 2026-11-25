/**
 * Copyright 2026 Lord_mahor
 * Licensed under Apache 2.0
 */

import { describe, expect, it } from "vitest"
import { byDay, EVENT_LABELS_RU, eventGroup, eventKind, eventLabel, histFilter, histRange, refNumber } from "./feed"

const rec = (changeType, description, name = "Кладовщик", changeDate = 0) => ({ changeType, description, user: { name }, changeDate })

describe("подписи и цвета записей", () => {
    it("подпись по типу, незнакомый тип — как есть", () => {
        expect(eventLabel("order-created")).toBe("Заказ создан")
        expect(eventLabel("inventory-edited-after-completion")).toBe("Завершённая инвентаризация переписана")
        expect(eventLabel("unknown-custom-type")).toBe("unknown-custom-type")
        expect(eventLabel("")).toBe("")
        for (const label of Object.values(EVENT_LABELS_RU)) expect(label).toMatch(/[а-яё]/i)
    })
    it("цвет по смыслу", () => {
        expect(eventKind("order-created")).toBe("create")
        expect(eventKind("purchase-updated")).toBe("update")
        expect(eventKind("inventory-edited-after-completion")).toBe("update")
        expect(eventKind("inventory-deleted-after-completion")).toBe("delete")
        expect(eventKind("order-surcharge-pending")).toBe("other")
        expect(eventKind(undefined)).toBe("other")
    })
    it("группы для фильтра", () => {
        expect(eventGroup("order-updated")).toBe("orders")
        // события lit-na.ru — в группе «Закупки»
        expect(eventGroup("litna-links-updated")).toBe("purchases")
        expect(eventGroup("litna-detached")).toBe("purchases")
        expect(eventLabel("litna-links-updated")).toBe("Привязка к lit-na.ru изменена")
        expect(eventGroup("order-refund-pending")).toBe("pay")
        expect(eventGroup("inventory-deleted-after-completion")).toBe("inventory")
        expect(eventGroup("role-created")).toBe("people")
        expect(eventGroup("user-deleted")).toBe("people")
        expect(eventGroup("strange")).toBe("")
    })
})

describe("период и фильтры", () => {
    const now = new Date(2026, 10, 17, 12).getTime()
    it("готовые периоды без верхней границы, свой — «По» включительно", () => {
        expect(histRange({ p: "all" }, now)).toEqual({})
        expect(histRange({ p: "week" }, now)).toEqual({ from: now - 7 * 864e5 })
        expect(histRange({ p: "custom", from: "2026-11-01", to: "2026-11-03" }, now)).toEqual({ from: new Date(2026, 10, 1).getTime(), to: new Date(2026, 10, 4).getTime() })
        expect(histRange({ p: "custom", from: "", to: "" }, now)).toEqual({ from: undefined, to: undefined })
    })
    it("тип и поиск по имени, типу и тексту", () => {
        const list = [rec("order-created", "Заказ 5 создан.", "Рассвет"), rec("purchase-created", "Закупка 3 создана."), rec("order-refund-pending", "Заказ 5: возврат 100 руб.")]
        expect(histFilter(list, { g: "orders", q: "" })).toHaveLength(1)
        expect(histFilter(list, { g: "pay", q: "" })).toHaveLength(1)
        expect(histFilter(list, { g: "", q: "рассвет" })).toHaveLength(1)
        expect(histFilter(list, { g: "", q: "закупка создана" })).toHaveLength(1)
        expect(histFilter(list, { g: "", q: "purchase" })).toHaveLength(1)
        expect(histFilter(list, { g: "purchases", q: "рассвет" })).toHaveLength(0)
    })
    it("дни по местному времени", () => {
        const today = new Date(2026, 10, 17, 9).getTime()
        const late = new Date(2026, 10, 16, 23, 30).getTime()
        const old = new Date(2026, 10, 3, 1).getTime()
        const days = byDay([rec("a", "", "", today), rec("b", "", "", late), rec("c", "", "", late), rec("d", "", "", old)], new Date(now))
        expect(days.map((d) => [d.title, d.items.length])).toEqual([
            ["Сегодня", 1],
            ["Вчера", 2],
            ["3 ноября 2026 г.", 1]
        ])
    })
})

describe("ссылка на заказ или закупку", () => {
    it("номер из описания по типу записи", () => {
        expect(refNumber(rec("order-created", "Рассвет Заказ 401 создан."))).toEqual({ order: "401" })
        expect(refNumber(rec("order-updated", "Председатель: Завершённый заказ 77 изменён админом."))).toEqual({ order: "77" })
        expect(refNumber(rec("order-surcharge-pending", "Заказ 12: всего к оплате 500 руб."))).toEqual({ order: "12" })
        expect(refNumber(rec("purchase-updated", "Закупка 31 обновлена. Изменения: заказано 5"))).toEqual({ purchase: "31" })
        expect(refNumber(rec("product-updated", "Товар Заказ 5 обновлен"))).toEqual({})
        expect(refNumber(rec("order-deleted", ""))).toEqual({})
    })
})
