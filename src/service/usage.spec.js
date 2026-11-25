/**
 * Copyright 2026 Lord_mahor
 * Licensed under Apache 2.0
 */

import { describe, expect, it } from "vitest"
import { activeUntil, add, cleanLabel, enter, labelOf, overScreen, pending, screenOf } from "./usage"

const el = (html) => {
    const box = document.createElement("div")
    box.innerHTML = html
    return box
}

describe("cleanLabel", () => {
    it("убирает переменные части: номера, суммы, счётчики, текст в кавычках, имя после двоеточия", () => {
        expect(cleanLabel("Все 53")).toBe("Все …")
        expect(cleanLabel("Оплатить 1 250 ₽")).toBe("Оплатить … ₽")
        expect(cleanLabel("Закупка №31")).toBe("Закупка №…")
        expect(cleanLabel("«книга про шаги»")).toBe("«…»")
        expect(cleanLabel("Профиль: Доверие, Представитель")).toBe("Профиль")
    })
    it("кнопки периода различаются числом — оно остаётся", () => {
        expect(cleanLabel("7 дней")).toBe("7 дней")
        expect(cleanLabel("30 дней")).toBe("30 дней")
        expect(cleanLabel("24 ч")).toBe("24 ч")
    })
})

describe("labelOf", () => {
    it("чип: подпись без счётчика", () => {
        const box = el('<button class="chip"><span>К выдаче</span><b>12</b></button>')
        expect(labelOf(box.querySelector("span")).label).toBe("К выдаче")
    })
    it("выключенная кнопка нажатием не считается", () => {
        expect(labelOf(el("<button disabled><span>Собираем корзину…</span></button>").querySelector("span"))).toBeNull()
    })
    it("кнопка-значок: aria-label; поле ввода: его название, но не введённый текст", () => {
        expect(labelOf(el('<button aria-label="Фильтры"><svg></svg></button>').querySelector("svg")).label).toBe("Фильтры")
        const input = el('<input type="search" aria-label="Поиск заказов" value="секретный запрос" />').querySelector("input")
        expect(labelOf(input).label).toBe("Поиск заказов")
    })
    it("многострочное поле (обратная связь): введённый текст не попадает ни с поля, ни с подписи вокруг него", () => {
        const box = el('<label class="field"><span>Сообщение</span><textarea aria-label="Сообщение"></textarea></label>')
        const area = box.querySelector("textarea")
        area.value = "секретный отзыв"
        expect(labelOf(area).label).toBe("Сообщение")
        expect(labelOf(box.querySelector("span")).label).toBe("Сообщение")
    })
    it("ссылка на карточку записывается названием экрана, а не названием товара", () => {
        const a = el('<a href="#/product/64a1"><b>IP#1 Кто, что, как и почему</b></a>').querySelector("a")
        expect(labelOf(a, (href) => (href === "#/product/64a1" ? "Товар" : "")).label).toBe("→ Товар")
    })
    it("аватар с инициалами и обложка в подпись не попадают; кнопка-ссылка называется своей надписью", () => {
        const box = el('<button><span class="avatar">НЛ</span><span>Открыть</span></button><a class="btn" href="#/shop/order/1"><span>Оплатить</span><b>1 250 ₽</b></a>')
        expect(labelOf(box.querySelector("button")).label).toBe("Открыть")
        expect(labelOf(box.querySelector("a"), () => "Заказ").label).toBe("Оплатить")
    })
    it("надпись важнее всплывающей подсказки; если весь текст в <b> — он и есть надпись", () => {
        expect(labelOf(el('<button title="Сначала завершите инвентаризацию"><span>Завершить</span></button>').querySelector("span")).label).toBe("Завершить")
        expect(labelOf(el("<button><b>Готово</b></button>").querySelector("b")).label).toBe("Готово")
        expect(labelOf(el('<button title="Назад"><svg></svg></button>').querySelector("button")).label).toBe("Назад")
    })
    it("подпись поля с ошибкой или подсказкой — только название поля", () => {
        const box = el('<label class="field"><span class="field__label">Пароль</span><span class="field__box"><input type="password" /></span><span class="field__msg field__msg--err">Не удалось войти</span></label>')
        expect(labelOf(box.querySelector(".field__label")).label).toBe("Пароль")
        const hint = el('<label class="field"><span class="field__label">Адрес</span><span class="field__msg">Пример: 410019, Россия</span></label>')
        expect(labelOf(hint.querySelector(".field__label")).label).toBe("Адрес")
    })
    it("флажок внутри подписи — один элемент; data-track задаёт подпись сам; нажатие мимо — null", () => {
        const box = el('<label><input type="checkbox" /><span>Только в наличии</span><b>47</b></label><div data-track="Обложка"><button>x</button></div><p>текст</p>')
        expect(labelOf(box.querySelector("input")).el).toBe(box.querySelector("label"))
        expect(labelOf(box.querySelector("input")).label).toBe("Только в наличии")
        expect(labelOf(box.querySelector("button")).label).toBe("Обложка")
        expect(labelOf(box.querySelector("p"))).toBeNull()
    })
})

describe("время и очередь", () => {
    it("время идёт не дольше 30 секунд после последнего действия: забытая вкладка его не набирает", () => {
        expect(activeUntil(6000, 1000)).toBe(6000)
        expect(activeUntil(10 * 60_000, 1000)).toBe(31_000)
    })
    it("одинаковые строки складываются, самое долгое посещение — наибольшее", () => {
        add("view", "Каталог", "", 1)
        add("view", "Каталог", "", 0, 4000, 4000)
        add("view", "Каталог", "", 0, 6000, 10000)
        add("click", "Каталог", "В корзину", 1)
        add("click", "Каталог", "В корзину", 1)
        expect(pending()).toEqual([
            { k: "view", s: "Каталог", l: "", n: 1, ms: 10000, max: 10000 },
            { k: "click", s: "Каталог", l: "В корзину", n: 2, ms: 0, max: 0 }
        ])
    })
})

describe("экран поверх экрана", () => {
    it("окно оплаты — свой экран; закрыли — посещение закупки продолжается, а не новый заход", () => {
        const views = (name) => pending().find((r) => r.k === "view" && r.s === name)?.n
        enter("Закупка")
        const back = overScreen("Оплата lit-na.ru")
        expect(views("Оплата lit-na.ru")).toBe(1)
        back()
        expect(views("Закупка")).toBe(1)
        // повторный «назад» после ухода на другой экран ничего не трогает
        enter("Закупки")
        back()
        expect(views("Закупка")).toBe(1)
    })
})

describe("screenOf", () => {
    it("экран называется по-русски; окно профиля и карточка — своими именами; вход и ошибки не учитываются", () => {
        expect(screenOf({ name: "shop", meta: { title: "Заказы" }, query: {} })).toBe("Заказы")
        expect(screenOf({ name: "order", meta: { title: "Заказы" }, query: {} })).toBe("Заказ")
        expect(screenOf({ name: "catalog", meta: { title: "Каталог" }, query: { sheet: "profile" } })).toBe("Профиль")
        expect(screenOf({ name: "login", meta: { bare: true, title: "Вход" }, query: {} })).toBe("")
    })
})
