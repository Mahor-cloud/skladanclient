/**
 * Copyright 2026 Lord_mahor
 * Licensed under Apache 2.0
 */

import { money, num, pcs } from "@/domain/format"
import { describe, expect, it } from "vitest"
import {
    accountBody,
    catalogSummary,
    deliveryBody,
    deliveryRows,
    docName,
    LINK_F,
    linkMap,
    linkRows,
    litnaCancelled,
    litnaStart,
    litnaState,
    litnaTag,
    litnaTitle,
    orderFailure,
    orderLines,
    origin,
    payFormOk,
    pollDelay,
    priceGap,
    priceGaps,
    quoteProblems,
    quoteRows,
    samePrice,
    search,
    siteLeft,
    siteStock,
    unlinkedRows,
    withKind
} from "./litna"

describe("lit-na.ru", () => {
    it("проблемы расчёта: общее сверху, строки — с текстом по причине; строчные коды из общего списка не дублируются", () => {
        const q = {
            goods: 1200,
            notice: "Минимальная сумма заказа — 3 000 ₽",
            problems: ["site", "unlinked", "stock", "point"],
            lines: [
                { product: "a", name: "Брелок", quantity: 3, problem: "unlinked" },
                { product: "b", name: "Книга", quantity: 10, stock: 4, problem: "stock" },
                { product: "c", name: "Буклет", quantity: 1, problem: "gone" },
                { product: "d", name: "Ручка", quantity: 2 }
            ]
        }
        expect(quoteProblems(q)).toEqual([
            { name: "Минимальная сумма заказа — 3 000 ₽" },
            { name: "Не выбран пункт выдачи" },
            { product: "a", name: "Брелок", text: "нет привязки", q: 3 },
            { product: "b", name: "Книга", text: `на сайте ${pcs(4)}`, q: 10 },
            { product: "c", name: "Буклет", text: "нет на сайте", q: 1 }
        ])
        // неизвестный код показывается как есть, а не теряется
        expect(quoteProblems({ problems: ["new_code"] })).toEqual([{ name: "new_code" }])
        expect(quoteProblems({ problems: ["account"] })).toEqual([{ name: "Заполните получателя и доставку" }])
    })

    it("сводка каталога для новой местности: товары и виды", () => {
        expect(
            catalogSummary({
                count: 214,
                categories: [
                    { name: "Книги", count: 200 },
                    { name: "Брелоки", count: 14 }
                ]
            })
        ).toBe(`${num(214)} товаров · 2 вида`)
        expect(catalogSummary({ items: [{ id: 1 }], categories: [] })).toBe("1 товар · 0 видов")
    })

    it("отказ заказа: новый расчёт, вход на сайт или прочее", () => {
        expect(orderFailure(409, { lines: [], total: 1 })).toBe("again")
        expect(orderFailure(409, { message: "Заказ отменён на сайте" })).toBe("fail")
        expect(orderFailure(400, { code: "LOGIN_FAILED", message: "Не удалось войти на lit-na.ru — зайдите заново" })).toBe("login")
        expect(orderFailure(undefined, undefined)).toBe("fail")
    })

    it("окно привязки: только строки без привязки", () => {
        const q = {
            lines: [
                { product: "a", name: "Брелок", quantity: 3, problem: "unlinked" },
                { product: "b", name: "Книга", quantity: 1, problem: "stock" },
                { product: "c", name: "Буклет", quantity: 2 }
            ]
        }
        expect(unlinkedRows(q)).toEqual([{ product: "a", name: "Брелок", quantity: 3, siteId: null }])
        expect(unlinkedRows({})).toEqual([])
    })

    it("подтверждение заказа: товары, способ, пункт, доставка или «бесплатно», итог", () => {
        const q = { goods: 16000, shipping: 0, free: true, total: 16000, delivery: { kind: "cdek_pvz", title: "CDEK — пункт выдачи", point: "Саратов, ул. Ленина, 5" } }
        expect(quoteRows(q)).toEqual([
            ["Товары", money(16000)],
            ["Способ", "CDEK — пункт выдачи"],
            ["Пункт", "Саратов, ул. Ленина, 5"],
            ["Доставка", "бесплатно"],
            ["Итого", money(16000)]
        ])
        // до двери — без пункта; название способа по коду, если сервер его не прислал
        expect(deliveryRows({ shipping: 450, delivery: { kind: "yandex_door" } })).toEqual([
            ["Способ", "Яндекс — до двери"],
            ["Доставка", money(450)]
        ])
    })

    it("способ доставки: пункт ↔ до двери и смена службы у пункта сбрасывают пункт и адрес; до двери ↔ до двери адрес оставляет", () => {
        const dl = { kind: "cdek_pvz", code: "SRT1", title: "СДЭК Саратов 1", city: "Саратов" }
        const addr = "Саратов, ул. Ленина, 5"
        expect(withKind(dl, addr, "cdek_pvz")).toEqual({ delivery: dl, address: addr })
        expect(withKind(dl, addr, "cdek_door")).toEqual({ delivery: { kind: "cdek_door", city: "Саратов" }, address: "" })
        expect(withKind(dl, addr, "yandex_pvz")).toEqual({ delivery: { kind: "yandex_pvz", city: "Саратов" }, address: "" })
        expect(withKind({ kind: "cdek_door" }, "ул. Московская, 1", "yandex_door")).toEqual({ delivery: { kind: "yandex_door", city: undefined }, address: "ул. Московская, 1" })
        expect(withKind({ kind: "" }, "ул. Московская, 1", "cdek_pvz").address).toBe("")
        expect(deliveryBody(dl)).toEqual(dl)
        expect(deliveryBody({ kind: "cdek_door", city: "Саратов" })).toEqual({ kind: "cdek_door" })
        // адрес при пункте вписан руками: признак уходит только у пункта выдачи
        expect(deliveryBody({ ...dl, manual: true })).toEqual({ ...dl, manual: true })
        expect(deliveryBody({ ...dl, manual: false })).toEqual(dl)
        expect(deliveryBody({ kind: "cdek_door", manual: true })).toEqual({ kind: "cdek_door" })
        expect(deliveryRows({ free: true, delivery: { kind: "cdek_pvz", point: "Саратов, ул. Ручная, 7", manual: true } })[1]).toEqual(["Адрес", "Саратов, ул. Ручная, 7"])
        expect(deliveryRows({ free: true, delivery: { kind: "cdek_pvz", point: "SAR6" } })[1]).toEqual(["Пункт", "SAR6"])
    })

    it("наличие на сайте", () => {
        expect(siteStock({ inStock: false, stock: 0 })).toBe("нет в наличии")
        expect(siteStock({ inStock: true, stock: 12 })).toBe(`в наличии ${pcs(12)}`)
        expect(siteStock({ inStock: true, stock: null })).toBe("в наличии")
    })

    it("поиск по словам в любом порядке, без учёта регистра и «ё»", () => {
        const list = [{ t: "ул. Лёнина, д. 5" }, { t: "пр. Кирова, 12" }]
        expect(search(list, "ленина 5", (x) => x.t)).toEqual([list[0]])
        expect(search(list, "5 ЛЕНИНА", (x) => x.t)).toEqual([list[0]])
        expect(search(list, "  ", (x) => x.t)).toBe(list)
        expect(search(list, "садовая", (x) => x.t)).toEqual([])
    })

    it("привязка из товаров: litnaId важнее подсказки, null — намеренно без привязки; отборы", () => {
        const products = [{ _id: "a", litnaId: 10 }, { _id: "b" }, { _id: "c", litnaId: null }, { _id: "d" }, { _id: "e", litnaId: 30 }]
        const map = linkMap(products, { a: 99, b: 20, c: 21 })
        expect(map).toEqual({ a: { siteId: 10, guess: false }, b: { siteId: 20, guess: true }, c: { siteId: null, guess: false }, e: { siteId: 30, guess: false } })
        const site = new Map([["10", { id: 10, name: "Книга" }]])
        const rows = linkRows(products, map, site)
        expect(rows.map((r) => [r._id, r.siteId, r.guess, r.site?.name ?? null])).toEqual([
            ["a", 10, false, "Книга"],
            ["b", 20, true, null], // подсказан товар, которого уже нет в каталоге сайта
            ["c", null, false, null],
            ["d", null, false, null],
            ["e", 30, false, null]
        ])
        expect(rows.filter(LINK_F.free).map((r) => r._id)).toEqual(["c", "d"])
        expect(rows.filter(LINK_F.guess).map((r) => r._id)).toEqual(["b"])
    })

    it("сохранённое «Без привязки» подсказку не возвращает, даже если старая подсказка ещё в кэше", () => {
        const again = linkMap([{ _id: "a", litnaId: null }], { a: 7 })
        expect(again.a).toEqual({ siteId: null, guess: false })
        expect(linkRows([{ _id: "a" }], again, new Map()).filter(LINK_F.guess)).toEqual([])
    })

    it("поле формы: подсказка только там, где не решали", () => {
        expect(litnaStart(undefined, 7)).toEqual({ id: 7, guess: true })
        expect(litnaStart(null, 7)).toEqual({ id: null, guess: false })
        expect(litnaStart(5, 7)).toEqual({ id: 5, guess: false })
        expect(litnaStart(undefined, undefined)).toEqual({ id: undefined, guess: false })
    })

    it("остаток lit-na.ru в строке закупки: число, «есть», «нет»; непривязанный — пусто", () => {
        const site = new Map([
            ["1", { id: 1, inStock: true, stock: 649 }],
            ["2", { id: 2, inStock: false, stock: 0 }],
            ["3", { id: 3, inStock: true, stock: null }]
        ])
        expect(siteLeft({ litnaId: 1 }, site)).toBe(num(649))
        expect(siteLeft({ litnaId: 2 }, site)).toBe("нет")
        expect(siteLeft({ litnaId: 3 }, site)).toBe("есть")
        expect(siteLeft({ litnaId: 4 }, site)).toBe("нет") // пропал с сайта
        expect(siteLeft({ litnaId: null }, site)).toBe("")
        expect(siteLeft({}, site)).toBe("")
    })

    it("цены сайта и каталога сравниваются в копейках; нет цены каталога — не расхождение", () => {
        expect(samePrice(350, "350.00")).toBe(true)
        expect(samePrice(350.004, 350)).toBe(true)
        expect(samePrice(350.01, 350)).toBe(false)
        expect(priceGap(350, 420)).toBe(`${money(350)} · в каталоге ${money(420)}`)
        expect(priceGap(350, 350)).toBe("")
        expect(priceGap(350, undefined)).toBe("")
        expect(
            priceGaps([
                { name: "Книга", site: 350, our: 420 },
                { name: "Брелок", site: 100, our: 100.0 },
                { name: "Удалённый", site: 50, our: undefined }
            ])
        ).toEqual([["Книга", `lit-na.ru ${money(350)} · каталог ${money(420)}`]])
    })

    it("происхождение закупки: у черновика метки нет", () => {
        expect(origin({ isCreated: true, litna: { orderId: 1 } })).toBe("lit-na.ru")
        expect(origin({ isCreated: true, isCompleted: true })).toBe("Вручную")
        expect(origin({ isCreated: false, litna: { status: "placing" } })).toBe("")
    })

    it("имя файла документа: из ответа сервера или по номеру заказа", () => {
        expect(docName("invoice", 58213, 'attachment; filename="invoice-58213.pdf"')).toBe("invoice-58213.pdf")
        expect(docName("invoice", 58213, undefined)).toBe("schet-58213.pdf")
        expect(docName("packing", 58213, "attachment")).toBe("nakladnaya-58213.pdf")
    })

    it("статус заказа: оплачен, отменён на сайте, ожидает оплаты", () => {
        expect(litnaState({ isPaid: false, litna: { status: "pending" } })).toBe("Ожидает оплаты")
        expect(litnaState({ isPaid: false, litna: { status: "processing" } })).toBe("Оплачен")
        expect(litnaState({ isPaid: true, litna: { status: "completed" } })).toBe("Оплачен")
        expect(litnaState({ isPaid: false, litna: { status: "cancelled" } })).toBe("Отменён на сайте")
        // после оплаты сервер следит за заказом: «Доставка» магазина — «Отправлен»; отменён после оплаты — виден как отменённый
        expect(litnaState({ isPaid: true, litna: { status: "delivery" } })).toBe("Отправлен")
        expect(litnaState({ isPaid: true, litna: { status: "cancelled", cancelledAt: 1 } })).toBe("Отменён на сайте")
        expect(litnaState({ isPaid: true, litna: { status: "processing" } })).toBe("Оплачен")
        // метка в списке — только у оплаченной закупки с заказом сайта, пока она ждёт приёмки
        expect(litnaTag({ isPaid: true, litna: { status: "processing" } })).toBe("в обработке")
        expect(litnaTag({ isPaid: true, litna: { status: "delivery" } })).toBe("отправлен")
        expect(litnaTag({ isPaid: true, isCompleted: true, litna: { status: "delivery" } })).toBe("")
        expect(litnaTag({ isPaid: false, litna: { status: "pending" } })).toBe("")
        expect(litnaTag({ isPaid: true })).toBe("")
        // оплата дошла после отмены — сервер отметил закупку оплаченной
        expect(litnaState({ isPaid: true, litna: { status: "cancelled" } })).toBe("Оплачен")
    })

    it("аккаунт: только получатель, адрес и доставка — без входа, области, города и индекса; без пустой доставки", () => {
        const d = { login: " rzf ", address: "Саратов, ул. Ленина, 5", state: "x", city: "Саратов", postcode: "410000", configured: true, hasPassword: true, password: "x", delivery: { kind: "" } }
        const body = accountBody(d)
        expect(Object.keys(body)).toEqual(["firstName", "lastName", "phone", "email", "address"])
        // у пункта выдачи адрес — адрес пункта, уходит как есть вместе с пунктом и его городом
        expect(accountBody({ ...d, delivery: { kind: "cdek_pvz", code: "X", title: "Y", city: "Саратов" } })).toMatchObject({ address: "Саратов, ул. Ленина, 5", delivery: { kind: "cdek_pvz", code: "X", title: "Y", city: "Саратов" } })
        expect(accountBody({ ...d, delivery: { kind: "cdek_door", code: "X", title: "Y" } }).delivery).toEqual({ kind: "cdek_door" })
    })

    it("строки подтверждения заказа: наш товар → товар сайта, количество × цена", () => {
        const q = {
            lines: [
                { product: "a", name: "Брелок", siteName: "Брелок (сайт)", quantity: 3, price: 125 },
                { product: "b", name: "Пусто", quantity: 0, price: 1 }
            ]
        }
        expect(orderLines(q)).toEqual([{ product: "a", name: "Брелок", site: "Брелок (сайт)", sum: `3 × ${money(125)}`, gap: "" }])
        expect(orderLines(q, () => 150)[0].gap).toBe(`${money(125)} · в каталоге ${money(150)}`)
        // название сайта то же, что наше (кавычки, регистр, ё — не в счёт) — второй раз не показываем
        expect(orderLines({ lines: [{ product: "a", name: "«Жить чистыми»", siteName: "жить Чистыми", price: 1, quantity: 1 }] })[0].site).toBe("")
        expect(orderLines(q, () => "125.00")[0].gap).toBe("")
    })

    it("форма оплаты — только https://auth.robokassa.ru", () => {
        expect(payFormOk("https://auth.robokassa.ru/Merchant/Index.aspx")).toBe(true)
        expect(payFormOk("http://auth.robokassa.ru/Merchant/Index.aspx")).toBe(false)
        expect(payFormOk("https://auth.robokassa.ru.evil.example/pay")).toBe(false)
        expect(payFormOk("javascript:alert(1)")).toBe(false)
        expect(payFormOk("https://auth.robokassa.ru:8443/pay")).toBe(false)
        expect(payFormOk(undefined)).toBe(false)
    })

    it("опрос оплаты: 2 минуты раз в 5 с, до 20 минут раз в 15 с, потом только вручную", () => {
        expect(pollDelay(0)).toBe(5000)
        expect(pollDelay(119_000)).toBe(5000)
        expect(pollDelay(121_000)).toBe(15000)
        expect(pollDelay(20 * 60_000)).toBe(0)
    })

    it("заказ отменён, возвращён или в корзине сайта; «failed» — не отмена, оплатить можно", () => {
        expect(litnaCancelled({ litna: { status: "cancelled" } })).toBe(true)
        expect(litnaCancelled({ litna: { status: "refunded" } })).toBe(true)
        expect(litnaCancelled({ litna: { status: "trash" } })).toBe(true)
        expect(litnaCancelled({ litna: { status: "failed" } })).toBe(false)
        expect(litnaCancelled({ litna: { status: "pending" } })).toBe(false)
        expect(litnaCancelled({})).toBe(false)
    })

    it("подпись заказа: без номера у оформляемого", () => {
        expect(litnaTitle({ status: "placing" })).toBe("Заказ оформляется")
        expect(litnaTitle({ status: "pending", orderId: 58213 })).toBe("Заказ lit-na.ru №58213")
        expect(litnaTitle({ status: "pending" })).toBe("Заказ lit-na.ru")
    })
})
