/**
 * Copyright 2026 Lord_mahor
 * Licensed under Apache 2.0
 */

import { computed, reactive, ref } from "vue"

// Корзина живёт на устройстве: localStorage.cart = { [productId]: штук }. Очищается при входе, выходе и оформлении заказа.
// cart — реактивный словарь: кнопка товара зависит только от своего ключа и не перерисовывается из-за чужих.
function read() {
    try {
        const c = JSON.parse(localStorage.getItem("cart") || "{}")
        return c && typeof c === "object" && !Array.isArray(c) ? c : {}
    } catch {
        return {}
    }
}
const cart = reactive({})
function load(map) {
    for (const id of Object.keys(cart)) if (!(Number(map[id]) > 0)) delete cart[id]
    for (const [id, q] of Object.entries(map)) if (Number(q) > 0) cart[id] = Math.round(Number(q))
}
load(read())
window.addEventListener("storage", (e) => {
    if (!e || e.key === "cart" || e.key === null) load(read())
    // Отметку отправки без ответа видят все вкладки: иначе вторая сверит корзину с остатками и сменит общий ключ.
    if (!e || e.key === "cartKeySent" || e.key === null) sent.value = readSent()
})
function save() {
    memKey = ""
    sent.value = false
    try {
        Object.keys(cart).length ? localStorage.setItem("cart", JSON.stringify(cart)) : localStorage.removeItem("cart")
        localStorage.removeItem("cartKey")
        localStorage.removeItem("cartKeySent")
    } catch {
        // хранилище недоступно — корзина живёт до перезагрузки
    }
}

// Ключ попытки оформления: один на содержимое корзины, любая её правка даёт новый. Если ответ сервера не дошёл
// и ту же корзину отправили ещё раз (в том числе после перезапуска приложения) — сервер вернёт уже созданный заказ.
let memKey = ""
const newKey = () => crypto.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`
function orderKey() {
    try {
        let key = localStorage.getItem("cartKey")
        if (!key) localStorage.setItem("cartKey", (key = newKey()))
        return key
    } catch {
        return (memKey ||= newKey())
    }
}
// sent — корзина с этим ключом уже уходила на сервер, а ответа не было: заказ мог создаться. Переживает перезапуск приложения.
function readSent() {
    try {
        return localStorage.getItem("cartKeySent") === "1"
    } catch {
        return false // хранилище недоступно — отметка живёт до перезагрузки
    }
}
const sent = ref(readSent())
function markSent(on) {
    sent.value = on
    try {
        on ? localStorage.setItem("cartKeySent", "1") : localStorage.removeItem("cartKeySent")
    } catch {
        // см. выше
    }
}

const get = (id) => cart[id] || 0
/** Количество перезаписывается; 0 убирает позицию. */
function set(id, qty) {
    qty = Math.max(0, Math.round(Number(qty) || 0))
    if (qty) cart[id] = qty
    else delete cart[id]
    save()
}
const add = (id, n = 1) => set(id, get(id) + n)
/** Заменить корзину целиком: { [productId]: штук } (исправление по остаткам, «Вернуть», автозаполнение). */
function replace(map) {
    load(map || {})
    save()
}
const clear = () => replace({})
/** Сумма штук — она же счётчик у «Каталога» и на полосе корзины. */
const count = computed(() => Object.values(cart).reduce((a, b) => a + b, 0))
const kinds = computed(() => Object.keys(cart).length)

const api = { cart, get, set, add, replace, clear, count, kinds, orderKey, sent, markSent }
/** { cart, get(id), set(id, n), add(id, n), replace(map), clear(), count, kinds, orderKey(), sent, markSent(on) } */
export function useCart() {
    return api
}
