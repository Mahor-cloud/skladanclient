/**
 * Copyright 2026 Lord_mahor
 * Licensed under Apache 2.0
 */

import { describe, expect, it } from "vitest"
import { dm, dur, fillDays, fillMonths, monthStart, mskDay, my, rolesLine } from "./usage"

describe("страница «Использование»", () => {
    it("длительность читается по-человечески", () => {
        expect([dur(0), dur(45_400), dur(12 * 60_000), dur(200 * 60_000), dur(120 * 60_000)]).toEqual(["0 с", "45 с", "12 мин", "3 ч 20 мин", "2 ч"])
    })
    it("день считается по Москве, как на сервере", () => {
        const now = Date.parse("2026-11-19T21:30:00Z")
        expect([mskDay(0, now), mskDay(29, now), dm("2026-11-20")]).toEqual(["2026-11-20", "2026-10-22", "20.11"])
    })
    it("длинный период начинается с первого числа: три месяца — нынешний и два предыдущих, год переходит через январь", () => {
        const now = Date.parse("2026-11-19T10:00:00Z")
        expect([monthStart(2, now), monthStart(11, now), monthStart(0, now), monthStart(11, Date.parse("2027-01-05T10:00:00Z"))]).toEqual(["2026-09-01", "2025-12-01", "2026-11-01", "2026-02-01"])
    })
    it("пустые дни периода остаются на графике нулями", () => {
        const days = fillDays("2026-11-17", "2026-11-19", [{ day: "2026-11-18", users: 3, opens: 4, clicks: 20, ms: 1000 }])
        expect(days.map((d) => [d.day, d.users])).toEqual([
            ["2026-11-17", 0],
            ["2026-11-18", 3],
            ["2026-11-19", 0]
        ])
    })
    it("длинный период идёт по месяцам, пустые месяцы остаются нулями, год переходит через январь", () => {
        const months = fillMonths("2026-11-19", "2027-02-03", [{ month: "2027-01", users: 5, opens: 9, clicks: 40, ms: 1000 }])
        expect(months.map((m) => [m.month, m.users])).toEqual([
            ["2026-11", 0],
            ["2026-12", 0],
            ["2027-01", 5],
            ["2027-02", 0]
        ])
        expect([my("2026-11"), my("2027-01")]).toEqual(["ноя 26", "янв 27"])
    })
    it("роли элемента — по убыванию нажатий", () => {
        expect(
            rolesLine([
                { role: "Казначей", clicks: 20 },
                { role: "Кладовщик", clicks: 380 },
                { role: "", clicks: 1 }
            ])
        ).toBe("Кладовщик 380 · Казначей 20 · без роли 1")
    })
})
