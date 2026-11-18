/**
 * Copyright 2026 Lord_mahor
 * Licensed under Apache 2.0
 */

import { defineAsyncComponent, markRaw, reactive, shallowRef } from "vue"

/* Правая колонка — одна на все разделы. Деталь (UiPane) занимает её на ширине от 1180 px, колонка раздела по умолчанию
   (UiAside: корзина, «Сейчас важно») стоит там, пока детали нет. Уже 1180 px деталь — окно по центру / лист снизу. */
export const paneTarget = shallowRef(null) // <aside id="pane"> каркаса
export const pane = reactive({
    details: 0, // сколько UiPane сейчас открыто
    key: "", // адрес открытой детали — для подсветки строки списка (paneSel)
    aside: "", // имя колонки раздела по умолчанию ("cart", "summary"…), даже когда её вытеснила деталь
    asideShown: false,
    close: null, // закрыть открытую деталь (Esc, полоса корзины)
    peek: null // деталь, открытая без смены адреса: { component, props, key }
})
export const PEEK = Symbol("peek")

/** Подсветка строки списка: :class="{ 'is-sel': paneSel('/product/' + p._id) }" */
export const paneSel = (path) => !!path && pane.key === path

let router = null
export const bindPaneRouter = (r) => {
    router = r
    r.afterEach((to, from) => {
        if (to.path !== from.path) pane.peek = null
    })
}

/**
 * Открыть деталь в правой колонке (на телефоне — листом), не меняя адреса: peek({ name: "order", params: { id } }).
 * Берётся компонент последнего совпавшего маршрута; параметры маршрута приходят ему свойствами (у маршрута детали — props: true),
 * props — дополнительные свойства детали: peek({ name: "order", params: { id } }, { readonly: true }).
 */
export function peek(to, props = {}) {
    const r = router.resolve(to)
    const rec = r.matched[r.matched.length - 1]
    const comp = rec?.components?.default
    if (!comp) return router.push(to)
    pane.peek = { component: markRaw(typeof comp === "function" ? defineAsyncComponent(comp) : comp), props: { ...r.params, ...props }, key: r.path }
}
export const peekClose = () => (pane.peek = null)

/**
 * Закрыть экран, открытый поверх раздела (деталь, окно по адресу), вернувшись на to. Если предыдущая запись истории — этот самый
 * адрес, делается шаг «назад»: кнопка «Назад» телефона потом не вернёт в закрытое окно. Иначе адрес заменяется.
 */
export function backTo(to) {
    if (window.history.state?.back === router.resolve(to).fullPath) router.back()
    else router.replace(to)
}
