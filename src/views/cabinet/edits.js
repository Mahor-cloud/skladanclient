/**
 * Copyright 2026 Lord_mahor
 * Licensed under Apache 2.0
 */

import axiosInstance from "@/service/axios"
import { queryClient } from "@/service/queryClient"
import { toast } from "@/ui"
import { reactive, ref } from "vue"
import { rowKey } from "./cabinet"

// Правки «Цель» / «У меня» и идущие сохранения живут дольше страницы: ушли до ответа сервера и вернулись — строка покажет
// ожидающее значение, а следующее «+» продолжит с него. Выход из учётной записи перезагружает приложение и сбрасывает всё.
// Реактивный словарь: строка перерисовывается только от своих ключей, итоги — от всех. Строки таблицы — ответ сервера как есть.
export const edits = reactive(new Map())
export const saveState = ref("idle") // idle | saving | saved | error
export const savedAt = ref(0)
const FIELDS = ["baseQty", "currentQty"]
const timers = new Map()
const saving = new Set()
const inflight = new Set()
const BLUR_DEBOUNCE_MS = 350
// Изменения уходят на сервер через столько после последнего нажатия, не дожидаясь ухода с поля.
const TYPE_DEBOUNCE_MS = 800
// Зависший запрос (телефон сменил сеть) должен упасть, иначе следующие сохранения строки ждали бы его вечно.
const SAVE_TIMEOUT_MS = 15_000
const KEY = ["cabinet-merged"]
const cached = (key) => queryClient.getQueryData(KEY)?.find((r) => rowKey(r) === key)

export const ek = (r, f) => `${rowKey(r)}-${f}`
export const val = (r, f) => (edits.has(ek(r, f)) ? edits.get(ek(r, f)) : r[f] || 0)
export const toNum = (v) => {
    const n = parseInt(String(v).replace(/\D+/g, ""), 10)
    return Number.isFinite(n) ? Math.max(0, n) : 0
}

export function setValue(r, f, v) {
    edits.set(ek(r, f), Math.max(0, v))
    saveState.value = "saving"
    schedule(rowKey(r), TYPE_DEBOUNCE_MS)
}
function schedule(key, delay) {
    clearTimeout(timers.get(key))
    timers.set(
        key,
        setTimeout(() => {
            timers.delete(key)
            flushSave(key)
        }, delay)
    )
}
function settle(ok) {
    if (ok === false) saveState.value = "error"
    else if (!timers.size && !saving.size && saveState.value === "saving") saveState.value = savedAt.value ? "saved" : "idle"
}
function flushSave(key) {
    const row = cached(key)
    if (!row) return settle()
    // Один запрос на строку за раз: два POST новой строки упрутся в уникальный индекс, два PUT могут прийти не по порядку.
    if (saving.has(key)) return schedule(key, BLUR_DEBOUNCE_MS)
    const changed = {}
    for (const f of FIELDS) {
        const k = `${key}-${f}`
        if (!edits.has(k)) continue
        const v = toNum(edits.get(k))
        if (v !== (row[f] || 0)) changed[f] = v
        // Например, «+» и сразу «−»: остаток, равный серверу, скрыл бы следующие изменения с сервера.
        else edits.delete(k)
    }
    if (!Object.keys(changed).length) return settle()
    saving.add(key)
    const p = send(row, changed)
    inflight.add(p)
    p.finally(() => inflight.delete(p))
}
async function send(row, changed) {
    const key = rowKey(row)
    try {
        // Только то, что изменил пользователь: другое поле могло измениться на сервере (выдача заказа пополняет «У меня»).
        // Позиции ещё нет — сервер требует оба количества.
        const res = row.cabinetItemId
            ? await axiosInstance.put(`/cabinet/${row.cabinetItemId}`, changed, { timeout: SAVE_TIMEOUT_MS })
            : await axiosInstance.post("/cabinet", { product: row.productId || undefined, customName: row.isCustom ? row.productName : undefined, baseQty: row.baseQty || 0, currentQty: row.currentQty || 0, ...changed }, { timeout: SAVE_TIMEOUT_MS })
        // Запрос списка, ушедший до записи, вернул бы старое значение — перезапускаем его.
        if (queryClient.isFetching({ queryKey: KEY })) queryClient.invalidateQueries({ queryKey: KEY })
        // Сохранённое — в строку кэша на месте, а не новым списком: новый список перерисовал бы всю таблицу. Эхо realtime тогда равно кэшу.
        const saved = res.data
        const cur = cached(key)
        const moved = cur ? FIELDS.filter((f) => (cur[f] || 0) !== saved[f]) : []
        if (cur) Object.assign(cur, { cabinetItemId: String(saved._id), baseQty: saved.baseQty, currentQty: saved.currentQty })
        for (const f of FIELDS) {
            const k = `${key}-${f}`
            // То, что сервер уже хранит, убираем из правок: иначе не будет видно пополнения после заказа или правки с другого устройства.
            if (edits.has(k)) {
                if (String(edits.get(k)) === String(saved[f])) edits.delete(k)
            } else if (moved.includes(f)) {
                // Непоправленное поле сервер вернул другим, а строка кэша изменена на месте и сама не перерисуется — «трогаем» её ключ.
                edits.set(k, saved[f])
                edits.delete(k)
            }
        }
        savedAt.value = Date.now()
        saving.delete(key)
        settle(true)
    } catch (err) {
        // Откатываем только то, что нёс этот запрос; набранное после остаётся и уйдёт снова.
        for (const f of Object.keys(changed)) if (edits.has(`${key}-${f}`) && toNum(edits.get(`${key}-${f}`)) === changed[f]) edits.delete(`${key}-${f}`)
        saving.delete(key)
        settle(false)
        toast({ type: "error", title: "Не удалось сохранить", text: err?.response?.data?.message || (err?.code === "ECONNABORTED" ? "Сервер не ответил, попробуйте ещё раз" : err?.message), timeout: 4000 })
    }
}
// Уход со страницы или приложение в фоне — отправляем ожидающее, а не теряем (таймеры скрытой страницы могут не сработать).
export function flushPending() {
    for (const [key, t] of [...timers]) {
        clearTimeout(t)
        timers.delete(key)
        flushSave(key)
    }
}
document.addEventListener("visibilitychange", () => document.visibilityState === "hidden" && flushPending())
/** Дослать ожидающее и дождаться ответов (сервер считает автозаполнение по сохранённому). */
export async function waitSaved() {
    while (timers.size || inflight.size) {
        flushPending()
        await Promise.allSettled([...inflight])
    }
}
/** Строку изменили или удалили окном: её несохранённые значения больше не верны. */
export function drop(r) {
    const key = rowKey(r)
    clearTimeout(timers.get(key))
    timers.delete(key)
    for (const f of FIELDS) edits.delete(`${key}-${f}`)
    settle()
}
