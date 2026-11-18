/**
 * Copyright 2026 Lord_mahor
 * Licensed under Apache 2.0
 */

import { describe, expect, it } from "vitest"
import { createApp, h } from "vue"
import UiField from "./UiField.vue"
import UiSelect from "./UiSelect.vue"

const render = (comp, props) => {
    const root = document.createElement("div")
    createApp({ render: () => h(comp, props) }).mount(root)
    return root
}

describe("подписи для чтения с экрана", () => {
    it("многострочное поле с ошибкой связано с ней, как однострочное", () => {
        const root = render(UiField, { rows: 3, error: "Укажите причину", modelValue: "" })
        const ta = root.querySelector("textarea")
        expect(ta.getAttribute("aria-invalid")).toBe("true")
        expect(root.querySelector("#" + ta.getAttribute("aria-describedby")).textContent).toContain("Укажите причину")
    })
    it("aria-label у UiSelect — у самого <select>, класс — у обёртки", () => {
        const root = render(UiSelect, { "aria-label": "Сортировка", class: "x", options: [{ value: "a", label: "А" }] })
        expect(root.querySelector("select").getAttribute("aria-label")).toBe("Сортировка")
        expect(root.querySelector("label").classList.contains("x")).toBe(true)
        expect(root.querySelector("label").hasAttribute("aria-label")).toBe(false)
    })
})
