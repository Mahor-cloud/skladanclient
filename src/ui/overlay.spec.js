/**
 * Copyright 2026 Lord_mahor
 * Licensed under Apache 2.0
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { ref } from "vue"
import { layerClose, layerLeave, layerOpen } from "./overlay"

const sheet = () => ({ close() {}, root: ref(null), closing: ref(false) })
const dimOn = () => document.querySelector("#layer .ov-dim").classList.contains("is-on")
// Как UiSheet: закрыть (жестом или действием), через 360 мс экран убирает окно.
function shut(l, gesture) {
    l.closing.value = true
    layerLeave(!gesture)
    vi.advanceTimersByTime(360)
    layerClose(l)
}

beforeEach(() => {
    document.body.innerHTML = '<div id="app"></div><div id="layer"></div>'
    vi.useFakeTimers()
})
afterEach(() => vi.useRealTimers())

describe("затемнение под окнами", () => {
    it("окно сменилось другим — затемнение не гаснет; одно закрытое действием гаснет после паузы", () => {
        const a = sheet()
        expect(layerOpen(a)).toBe(true)
        expect(dimOn()).toBe(true)
        shut(a, false)
        expect(dimOn()).toBe(true)
        // экран открывает следующее окно в том же проходе, что убрал прежнее
        const b = sheet()
        expect(layerOpen(b)).toBe(true) // следующее окно тоже нижнее: своё затемнение не рисует
        vi.advanceTimersByTime(1000)
        expect(dimOn()).toBe(true)
        shut(b, false)
        expect(dimOn()).toBe(true)
        // следом ничего не открылось — через кадр затемнение отпущено, без ожидания всей паузы
        vi.advanceTimersByTime(40)
        expect(dimOn()).toBe(false)
    })
    it("закрытое жестом уходит сразу; окно поверх окна — со своим затемнением", () => {
        const a = sheet()
        layerOpen(a)
        const top = sheet()
        expect(layerOpen(top)).toBe(false)
        shut(top, false)
        expect(dimOn()).toBe(true)
        a.closing.value = true
        layerLeave(false)
        expect(dimOn()).toBe(false)
        layerClose(a)
    })
    it("нижнее окно убрали раньше верхнего — общее затемнение гаснет (верхнее затемняет само); прозрачность от прерванного свайпа не остаётся", () => {
        const a = sheet()
        layerOpen(a)
        const top = sheet()
        layerOpen(top)
        document.querySelector("#layer .ov-dim").style.opacity = "0.6"
        layerClose(a)
        expect(dimOn()).toBe(false)
        expect(document.querySelector("#layer .ov-dim").style.opacity).toBe("")
        layerClose(top)
    })
})
