/**
 * Copyright 2026 Lord_mahor
 * Licensed under Apache 2.0
 */

import { afterEach, describe, expect, it, vi } from "vitest"
import { createApp, h } from "vue"
import UiStepper from "./UiStepper.vue"

let app = null
function mount(props) {
    const got = []
    const root = document.createElement("div")
    document.body.appendChild(root)
    app = createApp({ render: () => h(UiStepper, { ...props, "onUpdate:modelValue": (v) => got.push(v) }) })
    app.mount(root)
    const input = root.querySelector("input")
    const type = (s) => {
        input.value = s
        input.dispatchEvent(new Event("input"))
    }
    return { got, input, type }
}
afterEach(() => {
    app?.unmount()
    app = null
    vi.useRealTimers()
})

describe("UiStepper: ввод с клавиатуры", () => {
    it("потеря фокуса применяет набранное сразу, в том же обработчике", () => {
        const { got, input, type } = mount({ modelValue: 2 })
        type("7")
        input.dispatchEvent(new Event("blur"))
        expect(got).toEqual([7])
        input.dispatchEvent(new Event("change"))
        expect(got).toEqual([7])
    })
    it("при размонтировании ожидающее значение применяется", () => {
        const { got, type } = mount({ modelValue: 2 })
        type("9")
        app.unmount()
        app = null
        expect(got).toEqual([9])
    })
    it("пустое поле — это min, но только окончательно, не по таймеру", () => {
        vi.useFakeTimers()
        const { got, input, type } = mount({ modelValue: 4, min: 1 })
        type("")
        vi.advanceTimersByTime(800)
        expect(got).toEqual([])
        input.dispatchEvent(new Event("blur"))
        expect(got).toEqual([1])
    })
    it("знак: при min < 0 минус разбирается, при min >= 0 отбрасывается; больше max урезается", () => {
        const neg = mount({ modelValue: 0, min: -999, max: 99 })
        neg.type("-5")
        neg.input.dispatchEvent(new Event("blur"))
        neg.type("1-2")
        neg.input.dispatchEvent(new Event("blur"))
        neg.type("150")
        neg.input.dispatchEvent(new Event("blur"))
        expect(neg.got).toEqual([-5, 12, 99])
        app.unmount()
        const pos = mount({ modelValue: 0 })
        pos.type("-5")
        pos.input.dispatchEvent(new Event("blur"))
        expect(pos.got).toEqual([5])
    })
    it("по таймеру набранное применяется через 0,7 с", () => {
        vi.useFakeTimers()
        const { got, type } = mount({ modelValue: 1 })
        type("3")
        vi.advanceTimersByTime(600)
        expect(got).toEqual([])
        vi.advanceTimersByTime(200)
        expect(got).toEqual([3])
    })
})
