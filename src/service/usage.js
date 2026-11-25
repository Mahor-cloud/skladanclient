/**
 * Copyright 2026 Lord_mahor
 * Licensed under Apache 2.0
 */

import Cookies from "js-cookie"

/*
 * Счётчик использования: что нажимают и сколько активного времени проводят на экранах — чтобы менять интерфейс по делу.
 * Работает фоном и ни на что не влияет: слушает, копит числа и раз в полминуты отправляет их пачкой на /api/usage;
 * любая ошибка проглатывается, неудачная отправка никому не видна. Введённый текст не читается.
 */
const IDLE = 30_000 // пауза между действиями засчитывается не дольше этого: открытая и забытая вкладка время не набирает
const FLUSH = 30_000
const MAX_KEYS = 300 // столько строк уходит одной пачкой; лишнее (при долгой работе без связи) отбрасывается

/* ---------- Названия экранов ---------- */
// Окна поверх списка (дочерние маршруты) своего заголовка не имеют
const PANES = {
    product: "Товар",
    "product-new": "Новый товар",
    "product-edit": "Правка товара",
    order: "Заказ",
    "inventory-new": "Новая инвентаризация",
    "cabinet-item": "Позиция «Моего склада»",
    "cabinet-item-new": "Позиция «Моего склада»",
    "admin-user": "Пользователь",
    "admin-user-new": "Пользователь",
    "admin-role": "Роль",
    "admin-role-new": "Роль",
    "admin-role-info": "Роль"
}
const SHEETS = { profile: "Профиль", push: "Уведомления" }
/** Название экрана по маршруту; у страниц вне каркаса (вход, ошибки) — пусто: они не учитываются. */
export const screenOf = (r) => (r?.meta?.bare ? "" : SHEETS[r?.query?.sheet] || PANES[r?.name] || (typeof r?.meta?.title === "string" ? r.meta.title : String(r?.name || "")))

/* ---------- Подпись элемента ---------- */
const PERIOD = /^\d+\s(дн|ч|мин|нед|мес)/ // «7 дней», «30 дней», «24 ч» — разные кнопки
/** Подпись без переменных частей: имени после двоеточия, текста в кавычках, номеров, сумм и счётчиков. */
export const cleanLabel = (raw) => {
    let s = String(raw || "")
        .split(": ")[0]
        .replace(/«[^»]*»/g, "«…»")
    if (!PERIOD.test(s.trim())) s = s.replace(/\d[\d\s.,]*/g, "… ")
    return s.replace(/\s+/g, " ").trim().slice(0, 60)
}

const PICK = "button, a[href], [role=button], input, select, textarea, summary, label"
/**
 * Что нажали: { el, label } или null, если нажали мимо. Подпись — data-track (своя или ближайшего предка), иначе у ссылки
 * на карточку (маршрут с параметром) — «→ экран», иначе aria-label или текст без счётчиков (<b>, <small>), аватаров и обложек;
 * у поля ввода — его название, никогда не значение.
 * Правило для разметки: если текст кнопки состоит из данных (имя, название, прошлый запрос) — ей ставится data-track.
 */
export function labelOf(target, linkTitle = () => "") {
    let el = target?.closest?.(PICK)
    // выключенная кнопка (идёт работа, на ней подпись шага) нажатием не считается, даже если браузер отдал клик по её тексту
    if (!el || el.matches(":disabled") || el.closest("[data-track-off]")) return null
    if (el.matches("input[type=checkbox], input[type=radio]") && el.closest("label")) el = el.closest("label")
    const own = el.closest("[data-track]")?.dataset.track
    if (own) return { el, label: own.slice(0, 60) }
    // Кнопка-ссылка (UiBtn с адресом) называется своей надписью: «Оплатить» — не то же, что открыть заказ
    const to = el.matches("a[href]:not(.btn)") && linkTitle(el.getAttribute("href"))
    if (to) return { el, label: "→ " + to }
    const field = el.matches("input, select, textarea")
    let text = el.getAttribute("aria-label") || (field ? el.getAttribute("placeholder") || el.getAttribute("name") : "")
    if (!text && !field) {
        const copy = el.cloneNode(true)
        // .field__msg — ошибка и подсказка поля: лежат внутри его подписи, но надписью не являются
        copy.querySelectorAll("small, svg, input, select, textarea, .avatar, .cover, .field__msg").forEach((n) => n.remove())
        const whole = copy.textContent
        copy.querySelectorAll("b").forEach((n) => n.remove())
        // <b> — обычно счётчик рядом с надписью; если кроме него текста нет, он и есть надпись
        text = copy.textContent.trim() ? copy.textContent : whole
    }
    const label = cleanLabel(text || el.getAttribute("title"))
    return label ? { el, label } : null
}

/* ---------- Очередь ---------- */
const queue = new Map()
/** k — вид (open, view, click, error, empty), s — экран, l — элемент, n — сколько раз, ms — активное время, max — самое долгое посещение. */
export function add(k, s, l, n, ms = 0, max = 0) {
    const key = k + "\n" + s + "\n" + l
    const row = queue.get(key)
    if (row) {
        row.n += n
        row.ms += ms
        row.max = Math.max(row.max, max)
    } else if (queue.size < MAX_KEYS) queue.set(key, { k, s, l, n, ms, max })
}
export const pending = () => [...queue.values()]

/* ---------- Время на экране ---------- */
/** До какого момента время считается активным: не дальше IDLE после последнего действия пользователя. */
export const activeUntil = (now, lastAct) => Math.min(now, lastAct + IDLE)
let screen = ""
let last = 0 // момент, до которого время уже учтено
let lastAct = 0 // последнее действие пользователя
let unsent = 0 // учтённое, но ещё не положенное в очередь время текущего экрана
let visit = 0 // всё время текущего посещения
let away = false // вкладка скрыта: время не идёт

/** Учесть активное время до now. Вызывается и по таймеру отправки — сам вызов действием не считается. */
function account(now) {
    const until = activeUntil(now, lastAct)
    if (away || !screen || until <= last) return
    unsent += until - last
    visit += until - last
    last = until
}
/** Действие пользователя: нажатие, клавиша, прокрутка. */
function touch() {
    const now = Date.now()
    account(now)
    last = lastAct = now
}
/** Положить накопленное время экрана в очередь, посещение продолжается. */
function settle() {
    account(Date.now())
    if (screen && unsent) add("view", screen, "", 0, unsent, visit)
    unsent = 0
}
/** Перейти на экран. resume — время посещения, которое продолжается (вернулись из окна поверх экрана): заход повторно не считается. */
export function enter(name, resume = null) {
    settle()
    screen = name
    visit = resume ?? 0
    last = lastAct = Date.now()
    if (name && resume == null) add("view", name, "", 1)
}
/** Время текущего посещения — чтобы продолжить его после окна поверх экрана. */
export const visitTime = () => visit
/**
 * Окно со своим именем поверх экрана (окно оплаты): пока оно открыто, время идёт на него. Возвращает «назад» —
 * посещение экрана под ним продолжается, а не считается новым заходом.
 */
export function overScreen(name) {
    const under = screen
    const was = visitTime()
    enter(name)
    return () => screen === name && enter(under, was)
}
/** Отметить активность без нажатия: нажатия внутри чужого фрейма (оплата) до счётчика не доходят. */
export const markActive = () => touch()

/** Событие текущего экрана: показанная ошибка (error) или пустой результат (empty). */
export const track = (kind, label) => {
    try {
        const l = cleanLabel(label)
        if (screen && l) add(kind, screen, l, 1)
    } catch {
        // счётчик не должен мешать приложению
    }
}

/* ---------- Отправка ---------- */
const user = () => {
    try {
        return JSON.parse(localStorage.getItem("user") || "null")
    } catch {
        return null
    }
}
const alive = (token) => {
    try {
        return JSON.parse(atob(token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/"))).exp * 1000 > Date.now() + 5000
    } catch {
        return false
    }
}
let opened = false
let sending = false
let owner = "" // чьи числа лежат в очереди
let hiddenAt = 0
const idOf = (u) => (u ? String(u._id || "") : "")
/** final — страница уходит: запрос должен пережить закрытие вкладки. */
async function flush(final) {
    const u = user()
    // Пользователь сменился (выход и вход, «войти под председателем»): чужие числа новому не приписываются
    // (owner пуст, пока никто не вошёл: первый вход очередь не трогает)
    if (owner && owner !== idOf(u)) queue.clear()
    owner = idOf(u)
    // Не вошёл или супер-админ (у него нет местности): учитывать нечего
    if (!u || u.isSuperAdmin) return queue.clear()
    settle()
    if (!opened) {
        opened = true
        add("open", "", "", 1)
    }
    const token = Cookies.get("accessToken")
    // Просроченный ключ приложение обновит своим следующим запросом — до тех пор числа ждут в очереди
    if (!queue.size || sending || !token || !alive(token)) return
    const events = pending()
    queue.clear()
    sending = true
    try {
        const res = await fetch("/api/usage", {
            method: "POST",
            keepalive: !!final,
            headers: { "Content-Type": "application/json", Authorization: "Bearer " + token },
            body: JSON.stringify({ device: window.innerWidth < 900 ? "phone" : "desktop", events })
        })
        // Временный отказ — попробовать со следующей пачкой; остальное (например, негодная строка) отбрасывается
        if (res.status === 401 || res.status === 429 || res.status >= 500) events.forEach((e) => add(e.k, e.s, e.l, e.n, e.ms, e.max))
    } catch {
        events.forEach((e) => add(e.k, e.s, e.l, e.n, e.ms, e.max))
    } finally {
        sending = false
    }
}

/** Включить счётчик: один раз при запуске приложения. */
export function startUsage(router) {
    try {
        const linkTitle = (href) => {
            if (!href?.startsWith("#/")) return ""
            const r = router.resolve(href.slice(1))
            return Object.keys(r.params).length ? screenOf(r) : ""
        }
        owner = idOf(user())
        let lastEl = null
        let lastAt = 0
        window.addEventListener(
            "click",
            (e) => {
                try {
                    if (!screen) return
                    const hit = labelOf(e.target, linkTitle)
                    // Нажатие на подпись поля или флажка браузер повторяет на самом поле — это одно нажатие
                    if (!hit || ((hit.el === lastEl || lastEl?.control === hit.el || lastEl?.contains?.(hit.el)) && e.timeStamp - lastAt < 80)) return
                    lastEl = hit.el
                    lastAt = e.timeStamp
                    add("click", screen, hit.label, 1)
                } catch {
                    // счётчик не должен мешать приложению
                }
            },
            true
        )
        for (const ev of ["pointerdown", "keydown", "scroll", "touchstart"]) window.addEventListener(ev, touch, { capture: true, passive: true })
        // Окно поверх экрана: карточка (дочерний маршрут) или профиль (?sheet=). Пока оно открыто, посещение экрана под ним
        // стоит на паузе; закрыли — оно продолжается, а не считается новым заходом.
        const over = (r) => !!r.query?.sheet || r.matched?.length > 2
        const base = (r) => r.matched?.[1]?.name
        let entered = false
        let paused = null
        router.afterEach((to, from, failure) => {
            try {
                // Несостоявшийся переход экраном не считается; первый — всегда новый экран (стартовый адрес совпадает с каталогом)
                if (failure || (entered && to.path === from.path && to.query.sheet === from.query.sheet)) return
                if (entered && over(to) && !over(from)) paused = { base: base(from), visit: visitTime() }
                const back = entered && !over(to) && over(from) && paused?.base === base(to)
                entered = true
                enter(screenOf(to), back ? paused.visit : null)
                if (!over(to)) paused = null
            } catch {
                // счётчик не должен мешать приложению
            }
        })
        document.addEventListener("visibilitychange", () => {
            if (document.hidden) {
                settle()
                away = true
                hiddenAt = Date.now()
                flush(true).catch(() => {})
            } else {
                // Установленное приложение живёт в памяти сутками: возвращение после получаса — новый заход
                if (hiddenAt && Date.now() - hiddenAt > 30 * 60_000) opened = false
                away = false
                last = lastAct = Date.now()
            }
        })
        window.addEventListener("pagehide", () => flush(true).catch(() => {}))
        setInterval(() => flush().catch(() => {}), FLUSH)
    } catch {
        // счётчик не должен мешать приложению
    }
}
