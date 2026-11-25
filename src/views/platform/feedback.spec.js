/**
 * Copyright 2026 Lord_mahor
 * Licensed under Apache 2.0
 */

import { describe, expect, it } from "vitest"
import { toMark, who } from "./feedback"

describe("обратная связь", () => {
    it("автор одной строкой; пустые части не показываются", () => {
        expect(who({ name: "Иван", login: "ivan", role: "Представитель" })).toBe("Иван (@ivan), Представитель")
        expect(who({ name: "Главный", login: "", role: "Супер-админ" })).toBe("Главный, Супер-админ")
        expect(who(null)).toBe("—")
    })
    it("на отметку «прочитано» — только новые и только один раз", () => {
        const items = [
            { _id: "a", readAt: null },
            { _id: "b", readAt: "2026-11-24T10:00:00Z" },
            { _id: "c", readAt: null }
        ]
        expect(toMark(items, new Set())).toEqual(["a", "c"])
        expect(toMark(items, new Set(["a"]))).toEqual(["c"])
        expect(toMark(undefined, new Set())).toEqual([])
    })
})
