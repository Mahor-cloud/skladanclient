/**
 * Copyright 2026 Lord_mahor
 * Licensed under Apache 2.0
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { createApp, nextTick } from "vue"
import { confirm, toast } from "./overlay"
import UiHost from "./UiHost.vue"

let app = null
beforeEach(() => {
    document.body.innerHTML = '<div id="app"></div><div id="layer"></div><div id="toasts"></div>'
    app = createApp(UiHost)
    app.mount("#app")
})
afterEach(() => app.unmount())
const wait = (ms) => new Promise((r) => setTimeout(r, ms))

describe("UiHost", () => {
    it("«Да» во время закрытия по «Отмена» не меняет ответ", async () => {
        const answer = confirm({ title: "Отменить заказ?", ok: "Отменить заказ", tone: "danger" })
        await nextTick()
        await wait(20)
        const [cancel, ok] = document.querySelectorAll("#layer .ov__foot button")
        cancel.click()
        await wait(10)
        // Пока окно закрывается, его кнопки недоступны (inert) — и в подтверждениях, и в окнах разделов.
        expect(document.querySelector("#layer .ov__panel").hasAttribute("inert")).toBe(true)
        ok.click()
        expect(await answer).toBe(false)
    })
    it("«Да» дважды — один ответ, окно закрывается один раз", async () => {
        const answer = confirm({ title: "Удалить?" })
        await nextTick()
        await wait(20)
        const ok = document.querySelectorAll("#layer .ov__foot button")[1]
        ok.click()
        await wait(10)
        ok.click()
        expect(await answer).toEqual({ reason: "" })
    })
    it("действие уведомления вызывается один раз при двойном нажатии", async () => {
        const fn = vi.fn()
        toast({ type: "info", title: "Убрано из корзины", action: { label: "Вернуть", fn } })
        await nextTick()
        const btn = document.querySelector("#toasts .toast__a")
        btn.click()
        btn.click()
        expect(fn).toHaveBeenCalledTimes(1)
    })
})
