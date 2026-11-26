/**
 * Copyright 2026 Lord_mahor
 * Licensed under Apache 2.0
 */

import { money, num, pcs, plural } from "@/domain/format"

/* Закупка через lit-na.ru: способы доставки и оплаты, тексты расчёта, привязка товаров. Запросы — на страницах. */
export const DELIVERY = [
    { value: "cdek_pvz", label: "CDEK — пункт выдачи", svc: "cdek", pvz: true },
    { value: "yandex_pvz", label: "Яндекс — пункт выдачи", svc: "yandex", pvz: true },
    { value: "cdek_door", label: "CDEK — до двери", svc: "cdek" },
    { value: "yandex_door", label: "Яндекс — до двери", svc: "yandex" }
]
export const KIND = Object.fromEntries(DELIVERY.map((x) => [x.value, x]))
/** Смена способа доставки: выбранный пункт сбрасывается, город пункта остаётся для окна выбора. Адрес получателя от способа не зависит. */
export const withKind = (dl, kind) => (dl.kind === kind ? dl : { kind, city: dl.city })
/** Доставка к сохранению: пункт, его адрес и город — только у способов «пункт выдачи». */
export const deliveryBody = (dl) => (KIND[dl.kind]?.pvz ? { kind: dl.kind, code: dl.code, title: dl.title, city: dl.city, address: dl.address } : { kind: dl.kind })
export const ACCOUNT_FIELDS = ["firstName", "lastName", "phone", "email", "street", "city", "state", "postcode", "comment"]
/** Тело PUT /litna/account: получатель, его адрес полями сайта, комментарий к заказам и доставка (вход — отдельно, лишние поля сервер отклоняет); способ не выбран — доставки в теле нет. */
export function accountBody(d) {
    const b = Object.fromEntries(ACCOUNT_FIELDS.map((k) => [k, (d[k] || "").trim()]))
    return d.delivery?.kind ? { ...b, delivery: deliveryBody(d.delivery) } : b
}

/** Форму оплаты отправляем только на Robokassa. */
export function payFormOk(action) {
    try {
        return new URL(action).origin === "https://auth.robokassa.ru"
    } catch {
        return false
    }
}
/** Пауза до следующей проверки оплаты по времени с открытия окна: 2 минуты — раз в 5 с, до 20 минут — раз в 15 с, дальше 0 — только вручную. */
export const pollDelay = (age) => (age < 2 * 60e3 ? 5000 : age < 20 * 60e3 ? 15000 : 0)
/** Заказ на сайте отменён, возвращён или в корзине сайта: оплачивать нечего, закупку остаётся удалить. */
export const litnaCancelled = (pu) => ["cancelled", "refunded", "trash"].includes(pu?.litna?.status)
/** Заказ отправлен: статус магазина «Доставка» (его ставит фоновая проверка сервера после оплаты). */
export const litnaShipped = (pu) => pu?.litna?.status === "delivery"
/** Строка статуса заказа: оплату ставит сервер, отмена на сайте не окончательна — оплата могла дойти позже. */
export const litnaState = (pu) =>
    litnaShipped(pu)
        ? "Отправлен"
        : // отмена ПОСЛЕ оплаты (её увидела фоновая проверка); оплата, дошедшая после отмены, — по-прежнему «Оплачен»
          pu.litna?.cancelledAt
          ? "Отменён на сайте"
          : pu.isPaid || ["processing", "completed"].includes(pu.litna?.status)
            ? "Оплачен"
            : litnaCancelled(pu)
              ? "Отменён на сайте"
              : "Ожидает оплаты"
/** Короткая метка заказа сайта для списка закупок, пока закупка ждёт приёмки: «отправлен» или «в обработке»; иначе пусто. */
export const litnaTag = (pu) => (!pu?.litna || !pu.isPaid || pu.isCompleted || litnaCancelled(pu) ? "" : litnaShipped(pu) ? "отправлен" : "в обработке")
/** Как создана закупка: «lit-na.ru» (есть заказ сайта) или «Вручную»; у черновика — пусто. */
export const origin = (pu) => (!pu.isCreated ? "" : pu.litna ? "lit-na.ru" : "Вручную")
/** Имя файла документа заказа: из ответа сервера, иначе schet-<№>.pdf / nakladnaya-<№>.pdf. */
export const docName = (type, orderId, disposition = "") => /filename="([^"]+)"/.exec(disposition)?.[1] || `${type === "invoice" ? "schet" : "nakladnaya"}-${orderId}.pdf`
/** Подпись заказа: номера у оформляемого заказа ещё нет. */
export const litnaTitle = (l) => (l.status === "placing" ? "Заказ оформляется" : l.orderId ? `Заказ lit-na.ru №${l.orderId}` : "Заказ lit-na.ru")

const LINE = { unlinked: "нет привязки", gone: "нет на сайте" }
// site — отказ самого сайта: его текст (notice) показывается как есть.
const QUOTE = { site: (q) => q.notice || "Сайт не принял заказ", account: () => "Заполните получателя и доставку", point: () => "Не выбран пункт выдачи", delivery: () => "Доставка недоступна" }
/** Почему нельзя заказать: сначала общее, затем строки. [{ product?, name, text?, q? }] */
export function quoteProblems(q) {
    const common = (q.problems || []).filter((p) => !(p in LINE) && p !== "stock").map((p) => ({ name: QUOTE[p] ? QUOTE[p](q) : p }))
    const lines = (q.lines || []).filter((l) => l.problem).map((l) => ({ product: l.product, name: l.name, text: l.problem === "stock" ? `на сайте ${pcs(l.stock)}` : LINE[l.problem] || l.problem, q: l.quantity }))
    return [...common, ...lines]
}
/** Сколько всего на сайте для новой местности: «214 товаров · 12 видов» (count и categories каталога, без них — по items). */
export function catalogSummary(c) {
    const n = c?.count ?? c?.items?.length ?? 0
    const k = c?.categories?.length ?? 0
    return `${num(n)} ${plural(n, ["товар", "товара", "товаров"])} · ${k} ${plural(k, ["вид", "вида", "видов"])}`
}
/** Почему не прошёл заказ: again — 409 с новым расчётом, login — вход на сайт не удался (заказать после входа или гостем), fail — прочее. */
export const orderFailure = (status, data) => (status === 409 && data?.lines ? "again" : data?.code === "LOGIN_FAILED" ? "login" : "fail")
/** Строки расчёта без привязки — для окна «привязать сейчас»: { product, name, quantity, siteId: null }. */
export const unlinkedRows = (q) => (q.lines || []).filter((l) => l.problem === "unlinked").map((l) => ({ product: l.product, name: l.name, quantity: l.quantity, siteId: null }))
/** Доставка расчёта или заказа: способ, пункт, стоимость. */
export const deliveryRows = (x) => [["Способ", x.delivery?.title || KIND[x.delivery?.kind]?.label || "—"], x.delivery?.point && ["Пункт", x.delivery.point], ["Доставка", x.free || !x.shipping ? "бесплатно" : money(x.shipping)]].filter(Boolean)
/** Подтверждение заказа: товары, доставка, итог. */
export const quoteRows = (q) => [["Товары", money(q.goods)], ...deliveryRows(q), ["Итого", money(q.total)]]
/** Цены равны с точностью до копейки: 350 и 350.00 — одно и то же. */
export const samePrice = (a, b) => Math.round(Number(a) * 100) === Math.round(Number(b) * 100)
/** Цена сайта не та, что в каталоге: «350 ₽ · в каталоге 420 ₽»; равны или цены каталога нет (товар удалён) — "". */
export const priceGap = (site, our) => (our == null || samePrice(site, our) ? "" : `${money(site)} · в каталоге ${money(our)}`)
/** Что уйдёт в заказ: наш товар, товар сайта, «количество × цена» и расхождение с ценой каталога (priceOf(товар)). */
const plainName = (s) =>
    String(s || "")
        .toLowerCase()
        .replace(/ё/g, "е")
        .replace(/[^a-zа-я0-9]+/g, "")
/** site — название на сайте, только если оно отличается от нашего (регистр, кавычки и пробелы не в счёт). */
export const orderLines = (q, priceOf = () => null) =>
    (q.lines || [])
        .filter((l) => l.quantity > 0)
        .map((l) => ({ product: l.product, name: l.name, site: plainName(l.siteName) === plainName(l.name) ? "" : l.siteName, sum: `${l.quantity} × ${money(l.price)}`, gap: priceGap(l.price, priceOf(l.product)) }))
/** Позиции приёмки, где цена строки (сайт) не равна нынешней цене каталога: [[название, «lit-na.ru 350 ₽ · каталог 420 ₽»]]. */
export const priceGaps = (rows) => rows.filter((r) => r.our != null && !samePrice(r.site, r.our)).map((r) => [r.name, `lit-na.ru ${money(r.site)} · каталог ${money(r.our)}`])

/** Наличие на сайте. stock бывает пустым — сайт не ведёт остаток. */
export const siteStock = (s) => (!s.inStock ? "нет в наличии" : s.stock != null ? `в наличии ${pcs(s.stock)}` : "в наличии")
/** Остаток привязанного товара на сайте для строки закупки: число, «есть» (остаток не ведётся), «нет»; у непривязанного — "". */
export function siteLeft(p, siteById) {
    if (p?.litnaId == null) return ""
    const s = siteById.get(String(p.litnaId))
    return !s?.inStock ? "нет" : s.stock != null ? num(s.stock) : "есть"
}

const norm = (s) => String(s).toLowerCase().replace(/ё/g, "е")
/** Поиск по словам в любом порядке: «ленина 5» находит «ул. Ленина, д. 5». */
export function search(list, q, text) {
    const words = norm(q).split(/\s+/).filter(Boolean)
    if (!words.length) return list
    return list.filter((x) => {
        const t = norm(text(x))
        return words.every((w) => t.includes(w))
    })
}

/**
 * Привязка товара в форме: litnaId товара (null — намеренно без привязки, нет поля — не решали);
 * не решали и есть подсказка сайта — подсказка, guess до сохранения.
 */
export const litnaStart = (own, sug) => (own === undefined && sug != null ? { id: sug, guess: true } : { id: own, guess: false })
/** Привязки { [товар]: { siteId, guess } } из товаров (litnaId) и подсказок сайта для тех, где не решали. */
export function linkMap(products, suggest) {
    const m = {}
    for (const p of products || []) {
        const l = litnaStart(p.litnaId, suggest?.[p._id])
        if (l.id !== undefined) m[p._id] = { siteId: l.id, guess: l.guess }
    }
    return m
}
/** Строки привязки: { _id, p, siteId, guess, site }; site — товар сайта или null (не привязан или пропал с сайта). */
export const linkRows = (products, map, siteById) =>
    products.map((p) => {
        const l = map[p._id]
        const siteId = l?.siteId ?? null
        return { _id: p._id, p, siteId, guess: !!l?.guess && siteId != null, site: siteId == null ? null : siteById.get(String(siteId)) || null }
    })
export const LINK_F = { all: () => true, free: (r) => r.siteId == null, guess: (r) => r.guess }
