<script setup>
/**
 * Copyright 2026 Lord_mahor
 * Licensed under Apache 2.0
 */
import { useSession } from "@/composables/useSession"
import { date, money, num, pcs, plural, positions } from "@/domain/format"
import { homePath } from "@/domain/nav"
import { available, physical, pid, searchProducts } from "@/domain/stock"
import axiosInstance from "@/service/axios"
import { track } from "@/service/usage"
import { checkLitna, putLitnaAccount, useInventoryLock, useLitnaAccount, useLitnaCatalog, useProducts } from "@/service/queries"
import { confirm, toast, UiBanner, UiBtn, UiCover, UiChip, UiEmpty, UiError, UiIcon, UiIconBtn, UiLazy, UiPage, UiSelect, UiSheet, UiSk, UiSkRow, UiStamp, UiStatus } from "@/ui"
import { useQuery, useQueryClient } from "@tanstack/vue-query"
import { computed, nextTick, reactive, ref, shallowRef, toRef, watch } from "vue"
import { onBeforeRouteLeave, useRouter } from "vue-router"
import AskSheet from "./AskSheet.vue"
import { deliveryRows, docName, orderFailure, unlinkedRows, litnaCancelled, litnaState, litnaTitle, orderLines, origin, priceGap, priceGaps, quoteProblems, quoteRows, siteLeft } from "./litna"
import LitnaLogin from "./LitnaLogin.vue"
import LitnaPay from "./LitnaPay.vue"
import StepBar from "./StepBar.vue"
import LitnaSiteSheet from "./LitnaSiteSheet.vue"
import { draftOf, dropEdits, needOf, overBy, PST, pst, puFixed, puLineProduct, puPayTotal, puPayload, puPerm, puTurn, qtyIn, rcvIn, STEP, sum, syncDraft } from "./purchase"
import PurchaseRow from "./PurchaseRow.vue"

// Закупка отдельной страницей: позиции слева, итоги и действия — в правой колонке (на телефоне — панель действий снизу).
const props = defineProps({ id: { type: String, required: true } })
const router = useRouter()
const qc = useQueryClient()
const { can, plain } = useSession()
const pm = computed(() => puPerm(plain.value, pu.value))
const { data: products } = useProducts()
const { frozen } = useInventoryLock()
// Остатки lit-na.ru в строках: каталог сайта — один раз на страницу (работает и без аккаунта).
const { data: litCat } = useLitnaCatalog()
const siteById = computed(() => new Map((litCat.value?.items || []).map((s) => [String(s.id), s])))
const {
    data: pu,
    isPending,
    isError,
    error,
    refetch
} = useQuery({
    queryKey: ["purchaseOrder", toRef(props, "id")],
    queryFn: () => axiosInstance.get(`/purchases/${props.id}`),
    select: (res) => res.data,
    refetchOnMount: "always",
    staleTime: 0,
    retry: (n, err) => !(err?.response?.status < 500) && n < 3,
    enabled: computed(() => can("view_purchases"))
})
const missing = computed(() => [400, 404].includes(error.value?.response?.status))

/* ---------- Позиции: товар берётся из каталога (там «доступно»), иначе — из самой закупки ---------- */
const byId = computed(() => new Map((products.value || []).map((p) => [String(p._id), p])))
const gone = (id) => ({ _id: id, name: "Удалённый товар", price: 0, category: "" })
const lines = computed(() =>
    (pu.value?.items || []).map((it) => {
        const id = pid(it)
        const own = it.product && typeof it.product === "object" ? { ...it.product, totalQuantity: it.product.quantity } : null
        // our — нынешняя цена каталога: у закупки с lit-na.ru строки по ценам сайта, и расхождение показывается.
        return { _id: id, p: puLineProduct(pu.value, it, byId.value.get(id) || own || gone(id)), q0: it.quantity || 0, conf: it.confirmedQuantity || 0, our: byId.value.get(id)?.price }
    })
)
const d = computed(() => draftOf(props.id))
const addedLines = computed(() => Object.keys(d.value.added).map((id) => ({ _id: id, p: byId.value.get(id) || gone(id), q0: 0, conf: 0, added: true })))
const st = computed(() => (pu.value ? pst(pu.value) : "draft"))
const mode = computed(() => ({ draft: "draft", unpaid: "unpaid", done: "done" })[st.value] || "receive")
const qOf = (l) => qtyIn(d.value, l, mode.value)
const rcvOf = (l) => rcvIn(d.value, l)
watch(
    () => pu.value && props.id + ":" + pst(pu.value),
    (v) => v && syncDraft(d.value, pst(pu.value)),
    { immediate: true }
)
const rows = computed(() => {
    if (mode.value === "draft") return lines.value
    const placed = lines.value.filter((l) => l.q0 > 0)
    return mode.value === "unpaid" ? [...placed, ...addedLines.value] : placed
})

/* ---------- Подборка, вид, поиск. Состав списка пересчитывается при смене подборки, а не на каждое нажатие степпера ---------- */
const tick = ref(0)
const view = computed(() => d.value.view || (mode.value === "draft" ? (lines.value.some((l) => l.q0 > 0) ? "in" : "below") : ""))
const norm = (s) => String(s).toLowerCase().replace(/ё/g, "е")
const visible = shallowRef([])
watch(
    [rows, view, () => d.value.kind, () => d.value.q, tick],
    () => {
        let list = rows.value
        if (mode.value === "draft") {
            if (view.value === "in") list = list.filter((l) => qOf(l) > 0 || d.value.touched[l._id])
            if (view.value === "below") list = list.filter((l) => needOf(l.p) > 0 || qOf(l) > 0)
            if (d.value.kind) list = list.filter((l) => l.p.category === d.value.kind)
        }
        if (mode.value === "receive" && view.value) list = list.filter((l) => (view.value === "short" ? rcvOf(l) < l.q0 : rcvOf(l) >= l.q0))
        const s = norm(d.value.q.trim())
        // Как в прежнем окне, ищется и по виду и цене.
        visible.value = s ? list.filter((l) => norm(`${l.p.name} ${l.p.category} ${l.p.price}`).includes(s)) : list
    },
    { immediate: true }
)
const resetKey = computed(() => [mode.value, view.value, d.value.kind, d.value.q].join("~"))
function setView(v) {
    d.value.view = v || null
    if (v === "all") d.value.kind = ""
}
function setKind(k) {
    d.value.kind = k
    if (k && view.value === "in") d.value.view = "all"
}
const kinds = computed(() => [{ value: "", label: "Все виды" }, ...[...new Set(lines.value.map((l) => l.p.category).filter(Boolean))].map((k) => ({ value: k, label: k }))])
const COLS = { draft: "48px minmax(0,1fr) 60px 76px 52px 140px 92px", unpaid: "48px minmax(0,1fr) 88px 140px 104px", receive: "48px minmax(0,1fr) 76px 80px 176px 124px", done: "48px minmax(0,1fr) 88px 100px 104px" }
const HEAD = {
    draft: ["", "Товар", "Склад", "Доступно", "Цель", "В закупку", "Сумма"],
    unpaid: ["", "Товар", "Цена", "Количество", "Сумма"],
    receive: ["", "Товар", "Заказано", "Принято", "Принимаем сейчас", "Статус"],
    done: ["", "Товар", "Заказано", "Принято", "Сумма"]
}

/* ---------- Итоги ---------- */
const eff = computed(() => rows.value.map((l) => ({ l, q: qOf(l), rcv: rcvOf(l) })))
const inn = computed(() => eff.value.filter((x) => x.q > 0))
// После оплаты сумма закупки — записанная сервером (как в списке): у старой закупки без цен в строках сумма строк по текущим ценам с ней расходится.
// У заказа lit-na.ru цены сайта закреплены сразу — тоже сумма сервера.
const total = computed(() => (puFixed(pu.value) && pu.value.totalAmount ? pu.value.totalAmount : sum(inn.value, (x) => x.l.p.price * x.q)))
// К оплате у заказа lit-na.ru — с доставкой: в сумму закупки она не входит.
const payTotal = computed(() => puPayTotal(pu.value, total.value))
const pieces = computed(() => sum(inn.value, (x) => x.q))
const got = computed(() => sum(eff.value, (x) => (mode.value === "done" ? x.l.conf : x.rcv)))
const was = computed(() => sum(eff.value, (x) => x.l.conf))
const pct = computed(() => (pieces.value ? Math.round((got.value / pieces.value) * 100) : 0))
const left = computed(() => pieces.value - was.value)
const overList = computed(() => inn.value.filter((x) => overBy(x.l.p, x.q, x.l.q0, pm.value.exceed)))
const below = computed(() => lines.value.filter((l) => needOf(l.p) > 0 && !(qOf(l) > 0)))
const turn = computed(() => puTurn(st.value, pm.value, { total: payTotal.value, left: left.value, got: was.value }))
// Строка «чей ход» под заголовком; совпала с заголовком — не показывается
const who = computed(() => (turn.value.mine ? turn.value.short : { draft: "Ждёт создания", unpaid: "Ждёт оплаты" }[st.value] || "Ждёт приёмки"))
const dirty = computed(() => {
    const dd = d.value
    if (mode.value === "draft") return lines.value.some((l) => l._id in dd.qty && dd.qty[l._id] !== l.q0)
    if (mode.value === "unpaid") return Object.values(dd.added).some((n) => n > 0)
    if (mode.value === "receive") return lines.value.some((l) => rcvOf(l) !== l.conf)
    return false
})
const heroTitle = computed(
    () =>
        ({
            draft: pm.value.edit ? "Соберите закупку" : "Черновик закупки",
            unpaid: cancelled.value ? "Заказ отменён на сайте" : !pm.value.pay ? "Ждёт оплаты" : pu.value?.litna ? "Оплатите заказ" : `Оплатите ${money(payTotal.value)}`,
            receiving: pm.value.edit ? "Примите товар" : "Ждёт приёмки",
            partial: pm.value.edit ? `Довезли не всё: ждём ${pcs(left.value)}` : `Не довезли ${pcs(left.value)}`
        })[st.value]
)
const TRACK = computed(() => [
    ["Черновик", "Сбор позиций"],
    ["Оплата", "Оплата поставщику"],
    ["Получение", st.value === "partial" ? "Пришла часть — ждём остальное" : "Приёмка товара"],
    ["Завершена", "Склад пополнен"]
])

/* ---------- Правки ---------- */
function set(field, id, n) {
    const dd = d.value
    if (field === "added" && !n) delete dd.added[id]
    else dd[field][id] = n
    if (field === "qty") dd.touched[id] = true
}
const clamped = (l) => toast({ type: "warning", title: "Больше, чем заказано", text: `Можно от ${l.conf} до ${l.q0} шт.` })
function revert() {
    dropEdits(d.value)
    tick.value++
    toast({ type: "info", title: "Изменения отменены" })
}

/* ---------- Запросы ---------- */
const busy = ref("")
const ask = ref(null)
const askFor = (o) => new Promise((res) => (ask.value = { ...o, res }))
function answered(yes) {
    const a = ask.value
    ask.value = null
    a.res(yes)
}
const exceed = ref(null)
const paidHit = ref("") // id закупки, оплату которой увидели на этой странице: штамп «ОПЛАЧЕНО» ложится «ударом»
watch(
    () => [pu.value?._id, pu.value?.isPaid],
    ([id, paid], [was, wasPaid] = []) => id && id === was && paid && wasPaid === false && (paidHit.value = id)
)
const fresh = ref("") // id закупки, которую только что завершили здесь: её штамп ложится «ударом»

/** PUT с позициями как в прежнем коде; all — принять всё (принято = заказано). true — успех. */
async function update(flags, label, { creating = false, all = false, quiet = false } = {}) {
    const dd = d.value
    const list = mode.value === "unpaid" ? [...lines.value.filter((l) => !(l._id in dd.added)), ...addedLines.value] : lines.value
    const body = puPayload(
        list.map((l) => ({ product: l._id, quantity: qOf(l), confirmedQuantity: all ? qOf(l) : rcvOf(l) })),
        flags,
        creating
    )
    if (!body) {
        toast({ type: "warning", title: "Закупка пустая" })
        return false
    }
    // quiet — фоновое сохранение (расчёт заранее): кнопку не занимает и чужую занятость не снимает
    if (!quiet) busy.value = label
    try {
        await axiosInstance.put(`/purchases/${props.id}`, body)
        qc.invalidateQueries({ queryKey: ["purchases"] })
        qc.invalidateQueries({ queryKey: ["products"] })
        await qc.invalidateQueries({ queryKey: ["purchaseOrder", props.id] })
        dropEdits(dd)
        tick.value++
        return true
    } catch (err) {
        const data = err?.response?.data
        const msg = data?.message
        if (msg === "TARGET_EXCEEDED") exceed.value = overList.value
        else if (data?.code === "ACTIVE_INVENTORY") toast({ type: "warning", title: "Приёмка заморожена", text: msg })
        else toast({ type: "error", title: "Не удалось обновить закупку", text: Array.isArray(msg) ? msg.join(", ") : msg || err?.message })
        qc.invalidateQueries({ queryKey: ["purchaseOrder", props.id] })
        qc.invalidateQueries({ queryKey: ["purchases"] })
        return false
    } finally {
        busy.value = ""
    }
}
const FLAGS = (isCreated, isPaid, partialCompleted, isCompleted) => ({ isCreated, isPaid, partialCompleted, isCompleted })
// Без права превышения закупку с позициями сверх цели сервер не примет — окно сразу, без запроса.
const overBlocked = () => !pm.value.exceed && overList.value.length && ((exceed.value = overList.value), true)

async function saveDraft(label) {
    if (await update(FLAGS(false, false, false, false), label)) toast({ type: "success", title: "Черновик сохранён", text: `${positions(inn.value.length)} · ${money(total.value)}` })
}
async function create(label) {
    if (!inn.value.length) return toast({ type: "warning", title: "Закупка пустая" })
    if (overBlocked()) return
    if (pm.value.create) {
        // Сайт сейчас не отвечает (признак — из входа заранее или каталога): кнопка сайта серая, «Вручную» — как обычно.
        // Вход заранее свежее каталога (тот помнится полчаса); «недоступен» перепроверяется — сайт мог уже ожить.
        const siteDown = () => (litnaAcc.value?.up ?? litCat.value?.up) === false
        if (siteDown()) {
            busy.value = label
            await warmNow()
            busy.value = ""
        }
        const down = siteDown()
        if (!down) quoteEarly(label)
        const way = await askFor({ title: "Как создать закупку?", icon: "truck", cancel: "Вручную", ok: down ? "lit-na.ru недоступен" : "lit-na.ru", okIcon: "globe", okDisabled: down })
        if (way) return startLitna(label)
        // «Вручную» или закрыли: расчёт заранее не нужен; создавать — только после фонового сохранения черновика
        const saving = early?.saved
        early = null
        if (way === null) return
        await saving
    }
    if (await update(FLAGS(true, false, false, false), label, { creating: true })) toast({ type: "success", title: `Закупка №${pu.value.purchaseNumber} создана` })
}

/* ---------- lit-na.ru: расчёт → подтверждение → заказ; оплата — формой сайта ---------- */
const refresh = () => {
    qc.invalidateQueries({ queryKey: ["purchases"] })
    qc.invalidateQueries({ queryKey: ["products"] })
    return qc.invalidateQueries({ queryKey: ["purchaseOrder", props.id] })
}
const errMsg = (err) => err?.response?.data?.message || err?.message
const trouble = ref(null) // расчёт, по которому заказать нельзя: окно со списком причин
const offer = ref(null) // расчёт к подтверждению заказа
const ordering = ref(false)
// Что сервер сейчас делает на сайте (расчёт, заказ) — подпись на крутящейся кнопке: видно, что работа идёт, а не зависла.
const step = ref("")
const bar = ref(null) // { at, of } — полоска шагов над кнопкой: идёт шаг at из of
const working = ref(false) // сервер считает или заказывает по сохранённому черновику: строки на это время не правятся
// of — сколько шагов у операции (расчёт: 4 вместе с проверкой входа, заказ: 6); base — сколько прошло до сервера.
async function stepped(run, of, base = 0) {
    let on = true
    working.value = true
    // до первого ответа сервера подпись и полоска остаются на прежнем шаге («Проверяем вход»)
    bar.value = { at: Math.max(base, 1), of }
    ;(async () => {
        while (on) {
            const s = await axiosInstance.get(`/litna/purchases/${props.id}/step`).then(
                (r) => r.data,
                () => null
            )
            if (on && s?.step) {
                step.value = s.step
                bar.value = { at: Math.min(of, base + (s.at || 1)), of }
            }
            await new Promise((r) => setTimeout(r, 700))
        }
    })()
    try {
        return await run()
    } finally {
        on = false
        working.value = false
        idle()
    }
}
const idle = () => ((step.value = ""), (bar.value = null))
const stepLabel = (a, text) => (busy.value === a.label && step.value ? step.value + "…" : text)
const offerLines = computed(() => (offer.value ? orderLines(offer.value, (id) => byId.value.get(String(id))?.price) : []))
const asGuest = ref(false) // этот заказ — гостем, хотя вход сохранён (вход не работает, выбрали «Заказать как гость»)
const offerRows = computed(() => {
    const rows = quoteRows(offer.value)
    if (asGuest.value || !litnaAcc.value?.login) rows.splice(1, 0, ["Аккаунт", "Гость"])
    return rows
})
// «Войти» из подтверждения: окно входа — после его закрытия, затем расчёт заново (уже под аккаунтом).
const offerSheet = ref(null)
function offerLogin() {
    loginLater = { label: orderLabel, guest: true, form: true }
    offerSheet.value?.close()
}
let later = null // новый расчёт, по которому заказать уже нельзя: окно причин — после закрытия подтверждения
// bindFirst — товары без привязки сначала привязать тут же (окно привязки), потом пересчёт уже без него.
/* Расчёт заранее: пока человек выбирает «Вручную / lit-na.ru», черновик сохраняется и расчёт уже идёт. Сервер помнит расчёт 30 с:
   старше или состав закупки с тех пор изменился — считаем заново. Ошибки фонового расчёта — молча, обычный путь посчитает сам. */
let early = null // { saved: Promise<bool>, quote: Promise<расчёт | null>, at, key }
const draftKey = () => JSON.stringify((pu.value?.items || []).map((i) => [pid(i), i.quantity]))
function quoteEarly(label) {
    const e = { at: 0, key: "" }
    e.saved = dirty.value ? update(FLAGS(false, false, false, false), label, { quiet: true }) : Promise.resolve(true)
    e.quote = e.saved.then((ok) => {
        if (!ok) return null
        e.key = draftKey()
        // Отсчёт 30 с — с момента, когда сервер посчитал (ответ пришёл), а не с запроса.
        return axiosInstance.post(`/litna/purchases/${props.id}/quote`, {}).then(
            (r) => ((e.at = Date.now()), r.data),
            () => null
        )
    })
    early = e
}
async function orderLitna(label, bindFirst = true) {
    const e = early
    early = null
    await e?.saved
    // Сервер считает по сохранённому черновику.
    if (dirty.value && !(await update(FLAGS(false, false, false, false), label))) return idle()
    busy.value = label
    try {
        const q = await stepped(
            async () => {
                const got = e && e.key === draftKey() ? await e.quote : null
                return !got || Date.now() - e.at > 30_000 || e.key !== draftKey() ? (await axiosInstance.post(`/litna/purchases/${props.id}/quote`, {})).data : got
            },
            4,
            1
        )
        const rows = bindFirst ? unlinkedRows(q) : []
        if (rows.length) bind.value = { label, rows }
        else if (q.canOrder) offer.value = q
        else trouble.value = q
    } catch (err) {
        toast({ type: "error", title: "Не удалось рассчитать заказ", text: errMsg(err) })
    } finally {
        busy.value = ""
    }
}
/* Привязка товаров прямо из закупки: выбор товара сайта сразу сохраняется; все привязаны или «Продолжить» — пересчёт. */
const bind = ref(null) // { label, rows }
const bindSheet = ref(null)
const bindPick = ref(null) // строка, для которой открыт выбор товара сайта
const binding = reactive(new Set()) // товары, чья привязка сохраняется: две подряд не мешают друг другу
async function bindTo(siteId) {
    const row = bindPick.value
    // «Без привязки» у строки без пары — менять нечего; у только что привязанной — пара снимается
    if (siteId == null && row.siteId == null) return
    binding.add(row.product)
    try {
        await axiosInstance.put("/litna/links", { links: [{ product: row.product, siteId }] })
        row.siteId = siteId
        qc.invalidateQueries({ queryKey: ["products"] })
    } catch (err) {
        return toast({ type: "error", title: "Не удалось привязать", text: errMsg(err) })
    } finally {
        binding.delete(row.product)
    }
    if (!binding.size && bind.value?.rows.every((r) => r.siteId != null)) bindSheet.value?.close("go")
}
function bindClosed(why) {
    const label = bind.value?.label
    bind.value = null
    if (why === "go") orderLitna(label, false)
}
/** Заказ по подтверждённой сумме: { ok } | { again: новый расчёт } | { login: текст отказа входа } | { fail }. Закупка перечитывается всегда: ответ мог оборваться, а заказ — создаться. */
let sending = false
onBeforeRouteLeave(() => !(sending || detaching.value))
async function sendOrder(total) {
    let r = { ok: true }
    sending = true
    try {
        await axiosInstance.post(`/litna/purchases/${props.id}/order`, { total, ...(asGuest.value ? { guest: true } : {}) })
    } catch (err) {
        const data = err?.response?.data
        r = { again: { again: data }, login: { login: errMsg(err) }, fail: { fail: err } }[orderFailure(err?.response?.status, data)]
    }
    sending = false
    await refresh()
    return r
}
// Успех — только созданная закупка; «placing» — сервер ещё оформляет заказ; текст сервера показывается всегда (бывает «проверьте заказы в кабинете сайта»).
function orderDone({ fail }) {
    if (fail && !pu.value?.isCreated) return toast({ ...(pu.value?.litna?.status === "placing" ? { type: "warning", title: "Заказ оформляется" } : { type: "error", title: "Заказ не создан" }), text: errMsg(fail), timeout: 15000 })
    toast({ type: "success", title: `Закупка №${pu.value.purchaseNumber} создана`, text: `Заказ lit-na.ru №${pu.value.litna?.orderId ?? ""}` })
}
function priceMoved(again) {
    track("error", "Сумма на сайте изменилась")
    toast({ type: "warning", title: "Сумма на сайте изменилась", text: again.message })
}
let loginLater = null // отказ входа при заказе: окно входа — после закрытия подтверждения
async function placeOrder(close) {
    if (ordering.value) return
    ordering.value = true
    const total = offer.value.total
    const r = await stepped(() => sendOrder(total), 6)
    ordering.value = false
    if (r.again) {
        priceMoved(r.again)
        if (r.again.canOrder) return (offer.value = r.again)
        later = r.again
        return close()
    }
    if (r.login) loginLater = { err: r.login, total }
    close()
    if (!r.login) orderDone(r)
}
function offerClosed() {
    offer.value = null
    trouble.value = later
    later = null
    relogin.value = loginLater
    loginLater = null
}

/* ---------- Вход на сайт: заранее фоном при открытии черновика; не работает — окно входа до расчёта или после отказа заказа ---------- */
const { data: litnaAcc } = useLitnaAccount()
let warmed = false
watch(
    [pu, litnaAcc],
    ([p, a]) => {
        if (warmed || !p || p.isCreated || !a || !pm.value.create) return
        warmed = true
        axiosInstance.post("/litna/account/warm", {}).then(
            ({ data }) => putLitnaAccount({ login: data.login, loginFailed: data.loginFailed, up: data.up }),
            () => {} // сеть — молча: проверит сам заказ
        )
    },
    { immediate: true }
)
const warmNow = () =>
    axiosInstance.post("/litna/account/warm", {}).then(
        ({ data }) => (putLitnaAccount({ login: data.login, loginFailed: data.loginFailed, up: data.up }), data),
        () => litnaAcc.value || {}
    )
const relogin = ref(null) // { label } — до расчёта; { err, total } — после отказа заказа (повтор той же суммы)
const reloginSheet = ref(null)
let orderLabel = ""
// Состояние входа — свежим запросом на момент нажатия, не из кэша: вход не работает — окно «Не удалось войти…»;
// гость (вход не выполнен) — предупреждение «Заказ от гостя» (войти или продолжить гостем). Начатый заказ доводится как есть.
async function startLitna(label) {
    orderLabel = label
    asGuest.value = false
    busy.value = label
    step.value = "Проверяем вход"
    bar.value = { at: 1, of: 4 }
    const acc = await warmNow()
    const ask = acc.loginFailed ? { label } : !acc.login && !litDraft.value && !guestOk() ? { label, guest: true, form: false } : null
    // идём дальше без окна — подпись и полоска не гаснут до расчёта
    if (!ask) return litnaGo(label)
    idle()
    busy.value = ""
    relogin.value = ask
}
// «Заказ от гостя» спрашиваем один раз на устройство: дальше гость виден в подтверждении заказа, там же «Войти».
const GUEST_OK = "litna-guest-ok"
function guestOk(set) {
    try {
        if (set) localStorage.setItem(GUEST_OK, "1")
        return !!localStorage.getItem(GUEST_OK)
    } catch {
        return false
    }
}
// Начатый заказ доводится сразу, без расчёта: остаток мог зарезервировать наш же ожидающий заказ, а сервер умеет его найти и привязать
// (сумму при существующей записи не сверяет). Расчёт и подтверждение — только если он ответит новым расчётом.
const litnaGo = (label) => (litDraft.value ? orderAgain(pu.value.litna.total ?? total.value) : orderLitna(label))
function reloginGo(guest) {
    if (guest && relogin.value?.guest) guestOk(true)
    asGuest.value = guest
    reloginSheet.value?.close("go")
}
function reloginClosed(why) {
    const r = relogin.value
    relogin.value = null
    if (why !== "go") return
    if (r.total == null) return litnaGo(r.label)
    orderAgain(r.total)
}
// Повтор заказа после входа или выбора гостя — та же сумма; изменилась — сервер ответит новым расчётом (подтверждение заново).
async function orderAgain(total) {
    busy.value = orderLabel
    const r = await stepped(() => sendOrder(total), 6)
    busy.value = ""
    if (r.again) {
        priceMoved(r.again)
        if (r.again.canOrder) offer.value = r.again
        else trouble.value = r.again
        return
    }
    if (r.login) return (relogin.value = { err: r.login, total })
    orderDone(r)
}
const cancelled = computed(() => litnaCancelled(pu.value))
// Созданная закупка с заказом сайта; litnaPay — ещё не оплачена: блок заказа (разбивка, итог) и действия — одним блоком.
const litnaOrder = computed(() => !!pu.value?.litna && pu.value.isCreated)
const litnaPay = computed(() => litnaOrder.value && mode.value === "unpaid")
const litnaRows = computed(() => {
    const r = [["Статус", litnaState(pu.value)], ...deliveryRows(pu.value.litna)]
    r.splice(r.length - 1, 0, ["Товары", money(total.value)])
    return r
})
// Окна сбоев lit-na.ru — в «Ошибки» счётчика использования постоянными подписями (без текста сервера).
watch(trouble, (v) => v && track("error", "Нельзя заказать на lit-na.ru"))
watch(bind, (v) => v && track("error", "Товары не привязаны к lit-na.ru"))
watch(relogin, (v) => v && !v.guest && track("error", "Не удалось войти на lit-na.ru")) // заказ от гостя — не сбой
// Черновик с начатым заказом сайта (оформляется или привязан, но закупка ещё не создана).
const litDraft = computed(() => !!pu.value?.litna && !pu.value.isCreated)
const payOpen = ref(false) // окно оплаты lit-na.ru: форму запрашивает и отправляет оно само
const noOrder = ref("") // закупка, у которой на сервере нет записи заказа (перенос местности): оплата отмечается вручную
/* Ручной выход: человек с правом редактировать закупки отвязывает созданную неоплаченную закупку от заказа — она становится обычной, а заказ на сайте
   сервер отменяет (сайт недоступен — отвязано без отмены). Идёт до ~15 с — подтверждение остаётся открытым с ожиданием. */
const detachAsk = ref(false)
const detaching = ref(false)
const detach = () => (detachAsk.value = true)
async function doDetach(close) {
    if (detaching.value) return
    detaching.value = true
    let data = null
    let fail = null
    try {
        data = (await axiosInstance.post(`/litna/purchases/${props.id}/detach`, {})).data
    } catch (err) {
        fail = err
    }
    // И после отказа: «уже оплачен» значит, что закупка на сервере уже другая.
    await refresh()
    detaching.value = false
    close()
    if (fail) return toast({ type: "error", title: "Не удалось отвязать", text: errMsg(fail) })
    toast(data?.cancelled === false ? { type: "warning", title: "Закупка отвязана. Заказ на lit-na.ru не отменён — сайт недоступен", timeout: 15000 } : { type: "success", title: "Закупка отвязана, заказ на lit-na.ru отменён" })
}
// Созданную вручную неоплаченную закупку — обратно в черновик (снова «Создать» и выбор «Вручную / lit-na.ru»).
async function toDraft(label) {
    if (!(await confirm({ title: "Вернуть закупку в черновик?", ok: "В черновик" }))) return
    busy.value = label
    try {
        await axiosInstance.post(`/purchases/${props.id}/draft`, {})
        await refresh()
        toast({ type: "info", title: "Закупка снова черновик" })
    } catch (err) {
        toast({ type: "error", title: "Не удалось вернуть в черновик", text: errMsg(err) })
    } finally {
        busy.value = ""
    }
}
async function release(label) {
    if (!(await confirm({ title: "Снять оформление?", ok: "Снять" }))) return
    busy.value = label
    try {
        await axiosInstance.post(`/litna/purchases/${props.id}/release`, {})
        await refresh()
        toast({ type: "info", title: "Оформление снято" })
    } catch (err) {
        toast({ type: "error", title: "Не удалось снять оформление", text: errMsg(err) })
    } finally {
        busy.value = ""
    }
}
// Окно оплаты сразу (способ человек выбирает уже на странице Robokassa); повторное нажатие, пока оно открыто, ничего не делает.
const openPay = () => (payOpen.value = true)
/** Окно оплаты закрылось: why — paid | already (оплачена раньше) | reverted (заказа больше нет) | manual (404: записи заказа нет —
 *  ручная отметка) | failed (отказ сервера, msg — его текст) | закрыли сами. */
async function payClosed(why, msg) {
    payOpen.value = false
    if (why === "already") {
        await refresh()
        return toast({ type: "success", title: `Закупка №${pu.value.purchaseNumber} уже оплачена` })
    }
    if (why === "manual") {
        noOrder.value = props.id
        return run({ label: `Оплатить ${money(payTotal.value)}`, track: "Оплатить", fn: pay })
    }
    if (why === "detached") return toast({ type: "info", title: "Закупка отвязана от lit-na.ru" })
    if (why === "failed") {
        // 400 (заказ отменён на сайте), 409 (сумма разошлась): сервер записал статус — закупка перечитывается.
        refresh()
        return toast({ type: "error", title: "Не удалось начать оплату", text: msg })
    }
    // Закрыли окно сами — ещё раз спросить сайт (могли оплатить в отдельной вкладке); идущая проверка не дублируется.
    const r = why === "paid" ? { paid: true } : why === "reverted" ? { reverted: true, message: msg } : await checkLitna(props.id)
    if (r.reverted) return reverted(r.message)
    if (!r.paid) return
    await refresh()
    toast({ type: "success", title: "Оплата прошла", text: `Закупка №${pu.value.purchaseNumber}` })
}
// Заказ отменён или пропал на сайте — сервер вернул закупку в черновик: его текст (один раз на закупку за открытие страницы) и перечитать.
const revertShown = new Set()
function reverted(msg) {
    refresh()
    if (revertShown.has(props.id)) return
    revertShown.add(props.id)
    track("error", "Заказ отменён на lit-na.ru")
    toast({ type: "warning", title: msg || "Заказ отменён на lit-na.ru", timeout: 15000 })
}
// Счёт и накладная заказа сайта — PDF через наш сервер, файлом (как бэкап в «Компаниях»).
const docBusy = ref("")
const DOCS = [
    ["invoice", "Счёт"],
    ["packing", "Накладная"]
]
async function litnaDoc(type) {
    docBusy.value = type
    try {
        const res = await axiosInstance.get(`/litna/purchases/${props.id}/doc`, { params: { type }, responseType: "blob" })
        const url = URL.createObjectURL(res.data)
        const a = document.createElement("a")
        a.href = url
        a.download = docName(type, pu.value.litna.orderId, res.headers?.["content-disposition"])
        document.body.appendChild(a)
        a.click()
        a.remove()
        URL.revokeObjectURL(url)
    } catch (e) {
        // При таком запросе и отказ сервера приходит файлом — текст читается из него
        let text = errMsg(e)
        try {
            if (e?.response?.data instanceof Blob) text = JSON.parse(await e.response.data.text()).message || text
        } catch {
            // не JSON — остаётся общий текст
        }
        toast({ type: "error", title: e?.response?.status === 404 ? "Документа на сайте нет" : "Не удалось скачать", text })
    } finally {
        docBusy.value = ""
    }
}
let asked = "" // закупка, о которой сайт уже спросили при открытии; отменённые на сайте — тоже: оплата может дойти позже
watch(
    pu,
    (p) => {
        if (!p?.litna || !p.isCreated || p.isPaid || asked === props.id) return
        asked = props.id
        // gone — записи заказа на сервере нет (перенос местности): это не отмена, оплата отмечается вручную
        checkLitna(props.id).then((r) => (r.reverted ? reverted(r.message) : r.gone ? (noOrder.value = props.id) : r.paid && refresh()))
    },
    { immediate: true }
)
async function saveAdded(label) {
    const n = Object.values(d.value.added).filter((x) => x > 0).length
    if (!n || overBlocked()) return
    if (await update(FLAGS(true, false, false, false), label)) toast({ type: "success", title: "Закупка обновлена", text: `Добавлено: ${positions(n)}` })
}
async function pay(label) {
    const n = pu.value.purchaseNumber
    const yes = await askFor({
        title: `Оплатить закупку №${n}?`,
        ok: "Оплатил",
        okIcon: "check",
        tone: "success",
        icon: "wallet",
        kv: [
            ["Сумма", money(payTotal.value)],
            ["Позиций", `${inn.value.length} · ${pcs(pieces.value)}`]
        ]
    })
    if (yes && (await update(FLAGS(true, true, false, false), label))) toast({ type: "success", title: `Закупка №${n} оплачена` })
}
// Закупка с lit-na.ru: цена строки (сайт) не равна цене каталога — спросить перед приёмкой; «Отмена» — ждут, пока цены сравняют.
async function pricesOk(list) {
    const gaps = pu.value?.litna ? priceGaps(list.map((l) => ({ name: l.p.name, site: l.p.price, our: l.our }))) : []
    return !gaps.length || !!(await askFor({ title: "Цены в каталоге и на lit-na.ru отличаются", icon: "alert", tone: "warning", ok: "Продолжить", cancel: "Отмена", kv: gaps }))
}
async function receive(label) {
    if (!dirty.value) return // набранное вернуло всё к принятому на сервере — принимать нечего
    if (!(await pricesOk(eff.value.filter((x) => x.rcv > x.l.conf).map((x) => x.l)))) return
    const now = got.value - was.value
    const short = pieces.value - got.value
    const yes = await askFor({
        title: short ? "Принять частично?" : "Завершить приёмку?",
        icon: "package",
        tone: short ? "primary" : "success",
        ok: short ? "Да, частично" : "Завершить",
        okIcon: "check",
        text: `На склад добавится ${pcs(now)}`,
        kv: [
            ["Принимаем сейчас", "+" + pcs(now)],
            ["Не хватает", short ? pcs(short) : "—"]
        ]
    })
    if (!yes) return
    const n = pu.value.purchaseNumber
    if (await update(FLAGS(true, true, short > 0, !short), label)) {
        if (!short) fresh.value = props.id
        toast({ type: "success", title: short ? "Принято частично" : `Закупка №${n} завершена`, text: `Склад пополнен: +${pcs(now)}${short ? ` · ждём ещё ${pcs(short)}` : ""}` })
    }
}
async function acceptAll(label) {
    if (!(await pricesOk(lines.value.filter((l) => l.q0 > l.conf)))) return
    if (!(await askFor({ title: "Всё пришло полностью?", icon: "check", tone: "success", ok: "Да, принять всё", okIcon: "check", rich: true }))) return
    const n = pu.value.purchaseNumber
    const added = left.value
    if (await update(FLAGS(true, true, false, true), label, { all: true })) {
        fresh.value = props.id
        toast({ type: "success", title: `Закупка №${n} завершена`, text: `Склад пополнен: +${pcs(added)}` })
    }
}
async function remove(label) {
    const n = pu.value.purchaseNumber
    const lit = !!pu.value.litna
    if (!(await confirm({ title: `Удалить закупку №${n}?`, text: lit ? "Заказ на lit-na.ru отменится" : "", ok: "Удалить закупку", tone: "danger" }))) return
    busy.value = label
    try {
        await axiosInstance.delete(lit ? `/litna/purchases/${props.id}` : `/purchases/${props.id}`)
        qc.invalidateQueries({ queryKey: ["purchases"] })
        qc.invalidateQueries({ queryKey: ["products"] })
        await router.push({ name: "purchaseShop" })
        qc.removeQueries({ queryKey: ["purchaseOrder", props.id] })
        toast({ type: "info", title: `Закупка №${n} удалена` })
    } catch (err) {
        toast({ type: "error", title: "Не удалось удалить закупку", text: err?.response?.data?.message || err?.message })
        qc.invalidateQueries({ queryKey: ["purchaseOrder", props.id] })
    } finally {
        busy.value = ""
    }
}

/* ---------- Действия: главное, второе, остальные — одни и те же в колонке итогов, панели телефона и листе «Ещё» ---------- */
const acts = computed(() => {
    const s = st.value
    const p = pm.value
    const out = { primary: null, second: null, more: [] }
    if (s === "draft" && p.edit) {
        out.primary = { label: "Создать закупку", short: "Создать", icon: "check", fn: create }
        out.second = { label: dirty.value ? "Сохранить черновик" : "Черновик сохранён", icon: dirty.value ? "" : "check", kind: "secondary", disabled: !dirty.value, fn: saveDraft }
        out.more.push({ label: "Заполнить до целей", icon: "bolt", kind: "outline", fn: openAutofill })
        // Заказ уже оформлялся: повтор на сайт — сервер доведёт его или откажет.
        if (litDraft.value && p.create) out.primary = { label: "lit-na.ru", track: "Продолжить заказ lit-na.ru", icon: "globe", fn: startLitna }
        // Без права создавать закупки начатый заказ не довести, а «вручную» сервер не даст, пока оформление не снято.
        else if (litDraft.value) out.primary = { label: "Заказ оформляется", icon: "clock", kind: "secondary", disabled: true }
    }
    // Снять можно не всегда (заказ уже оформлен) — тогда сервер ответит своим текстом.
    if (litDraft.value && (p.create || p.edit)) out.more.push({ label: "Снять оформление", icon: "x", kind: "outline", fn: release })
    if (s === "unpaid") {
        // Заказ lit-na.ru оплачивают формой сайта, отметку ставит проверка оплаты; состав уже не меняется.
        const lit = !!pu.value.litna
        const fn = lit && noOrder.value !== props.id ? openPay : pay
        if (cancelled.value)
            out.primary = p.del ? { label: "Удалить закупку", short: "Удалить", icon: "trash", kind: "danger", fn: remove } : { label: "Заказ отменён на сайте", short: "Заказ отменён", icon: "alert", kind: "secondary", disabled: true }
        else
            out.primary = p.pay
                ? { label: `Оплатить ${money(payTotal.value)}`, short: "Оплатить", track: lit ? "Оплатить на lit-na.ru" : "Оплатить", icon: "wallet", kind: "success", fn }
                : { label: "Ждём оплату", short: "Ждём оплату", icon: "clock", kind: "secondary", disabled: true }
        if (lit && p.edit) out.more.push({ label: "Отвязать", track: "Отвязать от lit-na.ru", icon: "x", kind: "outline", fn: detach })
        if (p.edit && !lit) out.second = { label: dirty.value ? "Сохранить новые позиции" : "Новых позиций нет", kind: "secondary", disabled: !dirty.value, fn: saveAdded }
    }
    if (mode.value === "receive") {
        // Пока идёт инвентаризация, провести приёмку нельзя: остатки склада сейчас пересчитывают.
        if (p.edit && frozen.value) {
            out.primary = { label: "Принять товар", icon: "clipboard", kind: "secondary", disabled: true }
            out.second = { note: "Приёмка заморожена до завершения инвентаризации" }
        } else if (p.edit) {
            const all = { label: "Всё пришло — принять", short: "Принять всё", icon: "package", kind: "success", fn: acceptAll }
            const short = eff.value.some((x) => x.rcv < x.l.q0)
            // Пока ничего не отмечено, главный путь — «всё пришло»; после ввода по строкам — частичная приёмка.
            if (!dirty.value) out.primary = all
            else {
                out.primary = { label: short ? "Частично получить" : "Завершить приёмку", short: short ? "Принять" : "Завершить", icon: "check", kind: short ? "primary" : "success", fn: receive }
                out.second = { ...all, kind: "outline" }
            }
        } else out.primary = { label: "Ждём приёмку на складе", short: "Ждём приёмку", icon: "clock", kind: "secondary", disabled: true }
    }
    if ((s === "draft" || s === "unpaid") && p.del && out.primary?.fn !== remove) out.more.push({ label: "Удалить закупку", icon: "trash", kind: "danger-ghost", fn: remove })
    // Созданная вручную, без принятого товара — правее «Удалить закупку», в той же строке.
    if (s === "unpaid" && !pu.value.litna && !was.value && (p.create || p.edit)) out.more.push({ label: "В черновик", track: "Вернуть в черновик", icon: "repeat", kind: "outline", fn: toDraft })
    return out
})
// Пока на главной кнопке подпись шага, на телефоне она занимает всю полосу: подпись длиннее обычной надписи.
const stepping = computed(() => !!step.value && busy.value === acts.value.primary?.label)
const hasMore = computed(() => !!(acts.value.second || acts.value.more.length))
// track — постоянная подпись для счётчика использования, когда в надписи сумма или она совпадает с другой кнопкой.
const btn = (a) => ({ label: stepLabel(a, a.label), icon: a.icon || "", kind: a.kind || "primary", disabled: !!a.disabled || (!!busy.value && busy.value !== a.label), loading: busy.value === a.label, "data-track": a.track })
// Одно действие за раз: повторное нажатие, пока идёт подтверждение или запрос, ничего не шлёт.
let running = false
async function run(a) {
    if (!a.fn || running) return
    running = true
    try {
        // Набранное в степпере применяется при потере фокуса — до расчёта флагов и тела запроса (касание в Safari фокус не забирает).
        document.activeElement?.blur?.()
        await nextTick()
        await a.fn(a.label)
    } finally {
        running = false
    }
}
// Действие из листа «Ещё» запускается после его закрытия: иначе новое окно легло бы поверх уходящего.
const more = ref(false)
let after = null
function pickMore(a, close) {
    after = a
    close("act")
}
function moreClosed() {
    more.value = false
    if (after) run(after)
    after = null
}

/* ---------- Автозаполнение до целей: окно-предпросмотр; в новом черновике всплывает само один раз ---------- */
const afOpen = ref(false)
const afList = computed(() =>
    lines.value
        .filter((l) => needOf(l.p) > 0)
        .map((l) => ({ l, need: needOf(l.p), cur: qOf(l) }))
        .sort((a, b) => b.need - a.need)
)
function openAutofill() {
    if (!afList.value.length) return toast({ type: "info", title: "Нечего заполнять", text: "Все товары с целью уже на нужном уровне или цель не задана." })
    afOpen.value = true
}
function fill(close) {
    for (const x of afList.value) d.value.qty[x.l._id] = x.need
    d.value.view = "in"
    tick.value++
    close()
    toast({ type: "success", title: "Автозаполнено", text: `Заполнено позиций до цели: ${afList.value.length}` })
}
let prompted = "" // id закупки, где окно уже предлагали: страница не размонтируется при переходе закупка → закупка
watch(
    [pu, products, () => pm.value.edit],
    () => {
        const key = `purchase-autofill-prompted-${props.id}`
        if (prompted === props.id) return
        // открыли уже созданной: вернётся в черновик — окно само не всплывёт
        if (pu.value?.isCreated) return (prompted = props.id)
        if (!pm.value.edit || !pu.value || !products.value) return
        if (localStorage.getItem(key)) return (prompted = props.id)
        if (afList.value.length) {
            prompted = props.id
            localStorage.setItem(key, "1")
            afOpen.value = true
        }
    },
    { immediate: true }
)

/* ---------- Превышение цели ---------- */
function fit(close) {
    for (const x of exceed.value) set(x.l.added ? "added" : "qty", x.l._id, Math.max(Number(x.l.p.targetQty) || 0, x.l.q0))
    const n = exceed.value.length
    close()
    toast({ type: "success", title: "Количества уменьшены до цели", text: `${positions(n)} исправлено` })
}

/* ---------- Добавить позицию (ждёт оплаты) ---------- */
const addQ = ref("")
const have = computed(() => new Set([...lines.value.filter((l) => l.q0 > 0).map((l) => l._id), ...Object.keys(d.value.added)]))
const hits = computed(() => (addQ.value.trim() ? searchProducts(products.value || [], addQ.value).slice(0, 6) : []))
function pick(p) {
    d.value.added[p._id] = 1
    addQ.value = ""
    toast({ type: "info", title: "Позиция добавлена" })
}
</script>

<template>
    <UiPage v-if="!can('view_purchases')" title="Закупка">
        <div class="card">
            <UiEmpty art="error" title="Нет доступа"><UiBtn label="На главную" icon="home" :to="homePath(plain)" /></UiEmpty>
        </div>
    </UiPage>
    <UiPage v-else-if="isError && missing" title="Закупка не найдена" :back="{ name: 'purchaseShop' }">
        <div class="card">
            <UiEmpty art="search" title="Такой закупки нет"><UiBtn label="Все закупки" icon="truck" :to="{ name: 'purchaseShop' }" /></UiEmpty>
        </div>
    </UiPage>
    <UiPage v-else-if="isError && !pu" title="Закупка" :back="{ name: 'purchaseShop' }">
        <div class="card card--pad"><UiError title="Не удалось загрузить «Закупка»" @retry="refetch()" /></div>
    </UiPage>
    <UiPage v-else-if="isPending" title="Закупка" sub="Загружаем…" :back="{ name: 'purchaseShop' }">
        <div class="work">
            <div class="work__main">
                <div class="listtools">
                    <div class="filterbar"><UiSk v-for="w in [120, 120, 130]" :key="w" :w="w + 'px'" :h="40" :r="99" /></div>
                    <UiSk :h="48" :r="14" />
                </div>
                <p class="loading-note" role="status"><span class="spin"></span>Загружаем позиции закупки…</p>
                <div class="card tbl tbl--sk"><UiSkRow v-for="i in 8" :key="i" /></div>
            </div>
            <aside class="work__side">
                <section class="card ohero"><UiSk w="140px" :h="32" :r="99" /><UiSk w="80%" :h="26" /><UiSk w="94%" /><UiSk w="70%" /></section>
                <section class="card blk">
                    <UiSk w="40%" :h="18" />
                    <div style="height: 12px"></div>
                    <UiSk />
                    <div style="height: 8px"></div>
                    <UiSk />
                    <div style="height: 16px"></div>
                    <UiSk :h="52" :r="12" />
                </section>
            </aside>
        </div>
    </UiPage>
    <UiPage v-else :title="`Закупка №${pu.purchaseNumber}`" :sub="`${PST[st].label} · ${pu.user?.name || ''} · ${date(pu.purchaseDate)}`" :back="{ name: 'purchaseShop' }" :cls="acts.primary ? 'has-abar' : ''">
        <template #crumbs
            ><RouterLink :to="{ name: 'purchaseShop' }">Закупки</RouterLink><UiIcon name="right" :size="14" /><span>№{{ pu.purchaseNumber }}</span></template
        >
        <template #actions><UiIconBtn v-if="hasMore" icon="dots" label="Ещё действия" @click="more = true" /></template>
        <template #deskActions><span></span></template>
        <div class="work">
            <div class="work__main">
                <div v-if="(mode === 'draft' && pm.edit && below.length) || dirty || (mode === 'draft' && !pm.edit)" class="banners">
                    <UiBanner v-if="mode === 'draft' && pm.edit && below.length" tone="primary" icon="bolt" :title="`Ниже цели ${below.length} ${plural(below.length, ['товар', 'товара', 'товаров'])}`">
                        <template #action><UiBtn label="Заполнить" icon="bolt" size="sm" @click="openAutofill" /></template>
                    </UiBanner>
                    <UiBanner v-if="dirty" tone="warning" icon="edit" title="Есть несохранённые изменения">
                        <template #action><UiBtn label="Отменить" kind="secondary" size="sm" @click="revert" /></template>
                    </UiBanner>
                    <UiBanner v-if="mode === 'draft' && !pm.edit" tone="neutral" icon="eye" title="Только просмотр" />
                </div>
                <div class="listtools" :class="{ 'listtools--3': mode === 'draft' }">
                    <template v-if="mode === 'draft'">
                        <div class="filterbar" role="group" aria-label="Подборка товаров">
                            <UiChip label="В закупке" :count="inn.length" :active="view === 'in'" @click="setView('in')" />
                            <UiChip label="Ниже цели" icon="bolt" :count="lines.filter((l) => needOf(l.p) > 0).length" :active="view === 'below'" @click="setView('below')" />
                            <UiChip label="Весь каталог" :count="lines.length" :active="view === 'all'" @click="setView('all')" />
                        </div>
                        <UiSelect :model-value="d.kind" :options="kinds" @update:model-value="setKind" />
                    </template>
                    <div v-else-if="mode === 'receive'" class="filterbar" role="group" aria-label="Фильтр позиций">
                        <UiChip label="Все позиции" :count="rows.length" :active="!view" @click="setView('')" />
                        <UiChip label="Не хватает" tone="accent" :count="eff.filter((x) => x.rcv < x.l.q0).length" :active="view === 'short'" @click="setView('short')" />
                        <UiChip label="Приняты" :count="eff.filter((x) => x.rcv >= x.l.q0).length" :active="view === 'full'" @click="setView('full')" />
                    </div>
                    <span v-else class="listtools__t">{{ positions(rows.length) }} · {{ pcs(pieces) }}</span>
                    <form class="msearch__f lsearch" role="search" @submit.prevent="$event.target.querySelector('input').blur()">
                        <UiIcon name="search" />
                        <input v-model="d.q" type="search" name="q" :placeholder="mode === 'draft' ? 'Найти товар в каталоге' : 'Найти позицию'" :aria-label="mode === 'draft' ? 'Найти товар в каталоге' : 'Найти позицию'" autocomplete="off" />
                        <button v-if="d.q" type="button" class="msearch__x" aria-label="Очистить поиск" @click="d.q = ''"><UiIcon name="x" :size="18" /></button>
                    </form>
                </div>
                <div id="pu-list">
                    <div v-if="!visible.length" class="card">
                        <UiEmpty art="search" title="Ничего не нашли"><UiBtn label="Показать все" kind="secondary" @click="(d.q = ''), setView(mode === 'draft' ? 'all' : '')" /></UiEmpty>
                    </div>
                    <div v-else class="card tbl" :class="'tbl--' + mode" :style="{ '--cols': COLS[mode] }" :inert="working || null">
                        <div class="tbl__h" aria-hidden="true">
                            <span v-for="(h, i) in HEAD[mode]" :key="i">{{ h }}</span>
                        </div>
                        <UiLazy v-slot="{ item }" :items="visible" :size="24" :reset-key="resetKey"
                            ><PurchaseRow
                                :line="item"
                                :mode="mode"
                                :d="d"
                                :pm="pm"
                                :site="mode === 'draft' || mode === 'unpaid' ? siteLeft(item.p, siteById) : ''"
                                :gap="pu.litna && pu.isCreated ? priceGap(item.p.price, item.our) : ''"
                                @set="set"
                                @clamped="clamped"
                        /></UiLazy>
                    </div>
                </div>
                <div v-if="st === 'unpaid' && pm.edit && !pu.litna" class="addrow">
                    <span class="field__label">Добавить позицию</span>
                    <label class="msearch__f"><UiIcon name="plus" /><input v-model="addQ" type="search" name="q" placeholder="Начните вводить название" aria-label="Добавить позицию" autocomplete="off" /></label>
                    <div>
                        <div v-if="hits.length" class="sugg sugg--inline">
                            <button v-for="p in hits" :key="p._id" type="button" class="sugg__p" data-track="Товар из подсказки" :disabled="have.has(p._id)" @click="pick(p)">
                                <UiCover :product="p" size="xs" /><span class="sugg__n"
                                    >{{ p.name }}<small>{{ have.has(p._id) ? "уже в закупке" : `склад ${physical(p)} · цель ${p.targetQty || "—"}` }}</small></span
                                ><b>{{ money(p.price) }}</b>
                            </button>
                        </div>
                        <p v-else-if="addQ.trim()" class="muted">Ничего не нашли</p>
                    </div>
                </div>
            </div>
            <aside class="work__side">
                <section class="card ohero">
                    <UiStamp v-if="st === 'done'" tone="done" :date="date(pu.purchaseDate)" :rot="-6" :fresh="fresh === id">ЗАКУПКА<br />ПРИНЯТА</UiStamp>
                    <UiStamp v-else-if="pu.isPaid" tone="paid" text="ОПЛАЧЕНО" :date="pu.litna?.paidAt ? date(pu.litna.paidAt) : ''" :rot="-7" :fresh="paidHit === id" />
                    <div class="ohero__top">
                        <UiStatus :st="PST[st].st" :label="PST[st].label" size="lg" /><span v-if="!litnaOrder" class="muted" style="font-size: var(--fs-14); font-weight: 700">{{ money(total) }}</span
                        ><span v-if="origin(pu)" class="tag" :class="pu.litna ? 'tag--teal' : 'tag--neutral'">{{ origin(pu) }}</span>
                    </div>
                    <template v-if="st === 'done'">
                        <div class="ohero__done">
                            <span class="confirm__i" style="background: var(--success-soft); color: var(--success-text)"><UiIcon name="check" :size="26" /></span>
                            <h2>Закупка принята</h2>
                        </div>
                        <p>Склад пополнен на {{ pcs(was) }}</p>
                    </template>
                    <template v-else>
                        <h2>{{ heroTitle }}</h2>
                        <div v-if="!cancelled && who !== heroTitle" class="ohero__who" :class="{ 'ohero__who--mine': turn.mine }">
                            <UiIcon :name="turn.mine ? 'bolt' : 'clock'" /><span>{{ who }}</span>
                        </div>
                    </template>
                    <p v-if="pu.litna">{{ litnaTitle(pu.litna) }}</p>
                </section>
                <section class="card blk" :class="{ 'blk--top': litnaPay }">
                    <h3 v-if="litnaPay">
                        Заказ lit-na.ru<small v-if="pu.litna.orderId">№{{ pu.litna.orderId }}</small>
                    </h3>
                    <h3 v-else>{{ mode === "receive" || mode === "done" ? "Приёмка" : "Итог закупки" }}</h3>
                    <div class="sumgrid">
                        <template v-if="litnaPay">
                            <div v-for="[k, v] in litnaRows" :key="k" class="kv">
                                <span>{{ k }}</span
                                ><b>{{ v }}</b>
                            </div>
                            <div class="sumcard__total">
                                <span>Итого</span><b>{{ money(pu.litna.total) }}</b>
                            </div>
                        </template>
                        <template v-else-if="mode === 'receive' || mode === 'done'">
                            <div class="rsum">
                                <div class="ring" :style="{ '--p': pct }" role="img" :aria-label="`Принято ${pct}%`">
                                    <b>{{ pct }}%</b>
                                </div>
                                <div class="rsum__t">
                                    <div class="kv">
                                        <span>Заказано</span><b>{{ pcs(pieces) }}</b>
                                    </div>
                                    <div class="kv">
                                        <span>Принято</span><b>{{ pcs(got) }}</b>
                                    </div>
                                    <div v-if="mode === 'receive' && got - was > 0" class="kv">
                                        <span>Сейчас добавится</span
                                        ><b
                                            ><span class="pos">+{{ pcs(got - was) }}</span></b
                                        >
                                    </div>
                                    <div class="kv">
                                        <span>Не хватает</span
                                        ><b
                                            ><span v-if="pieces - got" class="acc">{{ pcs(pieces - got) }}</span
                                            ><template v-else>—</template></b
                                        >
                                    </div>
                                </div>
                            </div>
                            <div v-if="!litnaOrder" class="sumcard__total">
                                <span>Сумма закупки</span><b>{{ money(total) }}</b>
                            </div>
                        </template>
                        <template v-else>
                            <div class="kv">
                                <span>Позиций</span><b>{{ inn.length }}</b>
                            </div>
                            <div class="kv">
                                <span>Штук</span><b>{{ num(pieces) }}</b>
                            </div>
                            <div v-if="overList.length" class="kv">
                                <span>Сверх цели</span
                                ><b
                                    ><span :class="{ neg: !pm.exceed }">{{ positions(overList.length) }}</span></b
                                >
                            </div>
                            <div class="sumcard__total">
                                <span>Итого</span><b>{{ money(total) }}</b>
                            </div>
                        </template>
                    </div>
                    <div class="work__acts">
                        <div v-if="acts.primary" class="stepbtn">
                            <StepBar v-if="stepping" :bar="bar" />
                            <UiBtn v-bind="btn(acts.primary)" size="lg" block @click="run(acts.primary)" />
                        </div>
                        <p v-if="acts.second?.note" class="foot-note"><UiIcon name="clipboard" :size="16" class="inl" /> {{ acts.second.note }}</p>
                        <UiBtn v-else-if="acts.second" v-bind="btn(acts.second)" size="lg" block @click="run(acts.second)" />
                        <div v-if="litnaPay" class="co__acts">
                            <UiBtn v-for="[t, l] in DOCS" :key="t" :label="l" icon="doc" kind="secondary" :loading="docBusy === t" :disabled="!!docBusy" @click="litnaDoc(t)" />
                        </div>
                        <!-- Остальные действия — строкой по два одной высоты; без значков, чтобы «Удалить закупку» помещалась целиком. -->
                        <div v-if="acts.more.length" class="work__more" :style="acts.more.length > 1 ? 'display: grid; grid-template-columns: 1fr 1fr' : ''">
                            <UiBtn v-for="a in acts.more" :key="a.label" v-bind="btn(a)" :icon="acts.more.length > 1 ? '' : btn(a).icon" size="md" @click="run(a)" />
                        </div>
                    </div>
                    <!-- На телефоне колонки действий нет (главное — на нижней панели, остальное — в «Ещё»), документы — здесь. -->
                    <div v-if="litnaPay" class="mobonly" style="width: 100%; margin-top: var(--sp-5)">
                        <div class="co__acts" style="flex: 1">
                            <UiBtn v-for="[t, l] in DOCS" :key="t" :label="l" icon="doc" kind="secondary" :loading="docBusy === t" :disabled="!!docBusy" @click="litnaDoc(t)" />
                        </div>
                    </div>
                </section>
                <section v-if="litnaOrder && !litnaPay" class="card blk">
                    <h3>
                        Заказ lit-na.ru<small v-if="pu.litna.orderId">№{{ pu.litna.orderId }}</small>
                    </h3>
                    <div class="sumgrid">
                        <div v-for="[k, v] in litnaRows" :key="k" class="kv">
                            <span>{{ k }}</span
                            ><b>{{ v }}</b>
                        </div>
                        <div class="sumcard__total">
                            <span>{{ pu.isPaid ? "Оплачено" : "Итого" }}</span
                            ><b>{{ money(pu.litna.total) }}</b>
                        </div>
                    </div>
                    <div class="co__acts" style="margin-top: var(--sp-5)">
                        <UiBtn v-for="[t, l] in DOCS" :key="t" :label="l" icon="doc" kind="secondary" :loading="docBusy === t" :disabled="!!docBusy" @click="litnaDoc(t)" />
                    </div>
                </section>
                <section class="card blk w-track">
                    <h3>Путь закупки</h3>
                    <ol class="track">
                        <li v-for="([l, s], i) in TRACK" :key="l" class="track__s" :class="{ 'is-done': i < STEP[st] || st === 'done', 'is-cur': i === STEP[st] && st !== 'done' }">
                            <span class="track__dot"><UiIcon v-if="i < STEP[st] || st === 'done'" name="check" :size="16" /><i v-else-if="i === STEP[st]"></i></span>
                            <div class="track__c">
                                <b>{{ l }}</b
                                ><small>{{ s }}</small>
                            </div>
                        </li>
                    </ol>
                </section>
            </aside>
            <div v-if="acts.primary" class="abar">
                <span v-if="!stepping" class="abar__sum">
                    <template v-if="mode === 'receive'"
                        ><small>{{ num(got) }} из {{ pcs(pieces) }}</small
                        ><b>{{ pct }}%</b></template
                    >
                    <template v-else
                        ><small>{{ positions(inn.length) }} · {{ pcs(pieces) }}</small
                        ><b>{{ money(payTotal) }}</b></template
                    >
                </span>
                <div class="stepbtn" :class="{ 'is-on': stepping }">
                    <StepBar v-if="stepping" :bar="bar" />
                    <UiBtn v-bind="btn(acts.primary)" :label="stepLabel(acts.primary, acts.primary.short || acts.primary.label)" size="lg" @click="run(acts.primary)" />
                </div>
                <UiBtn v-if="hasMore && !stepping" icon="dots" title="Ещё действия" kind="secondary" size="lg" @click="more = true" />
            </div>
        </div>
    </UiPage>

    <UiSheet v-if="more" :title="`Закупка №${pu?.purchaseNumber ?? ''}`" size="sm" @close="moreClosed">
        <template #default="{ close }">
            <div style="display: grid; gap: var(--sp-3)">
                <p v-if="acts.second?.note" class="foot-note"><UiIcon name="clipboard" :size="16" class="inl" /> {{ acts.second.note }}</p>
                <UiBtn v-else-if="acts.second" v-bind="btn(acts.second)" size="lg" block @click="pickMore(acts.second, close)" />
                <div v-if="acts.more.length" :style="acts.more.length > 1 ? 'display: grid; grid-template-columns: 1fr 1fr; gap: var(--sp-3)' : 'display: grid'">
                    <UiBtn v-for="a in acts.more" :key="a.label" v-bind="btn(a)" :icon="acts.more.length > 1 ? '' : btn(a).icon" :size="acts.more.length > 1 ? 'md' : 'lg'" block @click="pickMore(a, close)" />
                </div>
            </div>
        </template>
    </UiSheet>

    <UiSheet v-if="afOpen" title="Заполнить до целей" :sub="`${afList.length} ${plural(afList.length, ['товар', 'товара', 'товаров'])} ниже цели с учётом активных заказов`" size="lg" @close="afOpen = false">
        <p class="muted" style="margin-bottom: var(--sp-5)">Заполнить количество к закупке автоматически (цель − доступно)?</p>
        <div class="aflist">
            <div v-for="x in afList" :key="x.l._id" class="afrow">
                <UiCover :product="x.l.p" size="xs" /><span class="afrow__n"
                    >{{ x.l.p.name
                    }}<small
                        >цель {{ x.l.p.targetQty }} · доступно {{ available(x.l.p) }}<template v-if="x.cur"> · сейчас {{ x.cur }}</template></small
                    ></span
                ><span class="tag tag--warning">+{{ x.need }}</span>
            </div>
        </div>
        <template #footer="{ close }">
            <UiBtn label="Не сейчас" kind="secondary" size="lg" @click="close()" />
            <UiBtn :label="`Заполнить · ${money(sum(afList, (x) => x.need * x.l.p.price))}`" icon="bolt" size="lg" @click="fill(close)" />
        </template>
    </UiSheet>

    <UiSheet v-if="exceed" label="Превышение цели" size="sm" cls="ov--confirm" @close="exceed = null">
        <div class="confirm confirm--warning">
            <span class="confirm__i"><UiIcon name="alert" :size="26" /></span>
            <div class="confirm__t">
                <h3>Превышение цели</h3>
                <p>
                    Количество превышает цель по товару, а у вас нет права подтверждать превышение. Для превышения цели обратитесь к администратору за повышением прав или подтверждением превышения — закупку с превышением цели создаёт администратор.
                </p>
            </div>
        </div>
        <ul v-if="exceed.length" class="exlist">
            <li v-for="x in exceed" :key="x.l._id">
                <UiCover :product="x.l.p" size="xs" /><span
                    >{{ x.l.p.name }}<small>цель {{ x.l.p.targetQty }}, в закупке {{ x.q }}</small></span
                ><b class="neg">+{{ x.q - x.l.p.targetQty }}</b>
            </li>
        </ul>
        <template #footer="{ close }">
            <UiBtn label="Понятно" kind="secondary" size="lg" @click="close()" />
            <UiBtn v-if="exceed.length" label="Уменьшить до цели" icon="check" size="lg" @click="fit(close)" />
        </template>
    </UiSheet>

    <AskSheet v-if="ask" :title="ask.title" :text="ask.text" :tone="ask.tone" :icon="ask.icon" :ok="ask.ok" :ok-icon="ask.okIcon" :cancel="ask.cancel" :ok-disabled="ask.okDisabled" @done="answered">
        <template v-if="ask.rich" #text
            >Подтвердите, что <b>все позиции получены полностью</b> и соответствуют закупке — расхождений нет. Принятое количество по каждому товару будет приравнено к заказанному, и закупка <b>завершится</b>. Остатки склада пополнятся.</template
        >
        <div v-if="ask.kv" class="confirm-extra">
            <div v-for="[k, v] in ask.kv" :key="k" class="kv">
                <span>{{ k }}</span
                ><b>{{ v }}</b>
            </div>
        </div>
    </AskSheet>

    <UiSheet v-if="trouble" title="Нельзя заказать на lit-na.ru" size="sm" @close="trouble = null">
        <ul class="exlist" style="margin-top: 0">
            <li v-for="x in quoteProblems(trouble)" :key="x.product || x.name">
                <UiCover v-if="x.product" :product="byId.get(String(x.product)) || { _id: x.product, name: x.name }" size="xs" /><UiIcon v-else name="alert" :size="22" class="neg" /><span
                    >{{ x.name }}<small v-if="x.text">{{ x.text }}</small></span
                ><b v-if="x.q">{{ pcs(x.q) }}</b>
            </li>
        </ul>
        <template #footer="{ close }"
            ><UiBtn label="Понятно" kind="secondary" size="lg" data-track="Понятно — нельзя заказать" @click="close()" /><UiBtn
                v-if="trouble.problems?.includes('account')"
                label="Аккаунт lit-na.ru"
                icon="right"
                size="lg"
                :to="{ name: 'admin-litna' }"
        /></template>
    </UiSheet>

    <UiSheet v-if="offer" ref="offerSheet" label="Заказ на lit-na.ru" size="sm" cls="ov--confirm" :before-close="() => !ordering" @close="offerClosed">
        <div class="confirm">
            <span class="confirm__i"><UiIcon name="globe" :size="26" /></span>
            <div class="confirm__t">
                <h3>Заказать на lit-na.ru на {{ money(offer.total) }}?</h3>
            </div>
        </div>
        <div class="confirm-extra">
            <div v-for="[k, v] in offerRows" :key="k" class="kv">
                <span>{{ k }}</span
                ><b
                    >{{ v
                    }}<UiBtn
                        v-if="k === 'Аккаунт' && !litnaAcc?.login && !ordering"
                        label="Войти"
                        kind="ghost"
                        size="sm"
                        data-track="Войти в аккаунт lit-na.ru"
                        style="margin: calc(var(--sp-3) * -1) 0 calc(var(--sp-3) * -1) var(--sp-4); padding: 0; color: var(--primary-text)"
                        @click="offerLogin"
                /></b>
            </div>
        </div>
        <div v-if="offer.addressDiffers" style="margin-top: var(--sp-6)">
            <UiBanner tone="warning" title="Адрес в приложении и на сайте отличается" />
        </div>
        <div v-if="offerLines.some((l) => l.gap)" style="margin-top: var(--sp-6)">
            <UiBanner tone="warning" :title="`Цены отличаются от каталога: ${offerLines.filter((l) => l.gap).length}`" />
        </div>
        <ul class="exlist">
            <li v-for="l in offerLines" :key="l.product">
                <UiCover :product="byId.get(String(l.product)) || { _id: l.product, name: l.name }" size="xs" /><span
                    >{{ l.name }}<small v-if="l.site">→ {{ l.site }}</small
                    ><small v-if="l.gap"
                        ><span class="tag tag--warning">{{ l.gap }}</span></small
                    ></span
                ><b>{{ l.sum }}</b>
            </li>
        </ul>
        <template #footer="{ close }">
            <UiBtn label="Отмена" kind="secondary" size="lg" data-track="Отмена — заказ lit-na.ru" :disabled="ordering" @click="close()" />
            <div class="stepbtn">
                <StepBar v-if="ordering" :bar="bar" />
                <UiBtn :label="ordering ? (step || 'Заказываем') + '…' : `Заказать ${money(offer.total)}`" size="lg" data-track="Заказать на lit-na.ru" :loading="ordering" @click="placeOrder(close)" />
            </div>
        </template>
    </UiSheet>
    <UiSheet v-if="detachAsk" label="Отвязать от lit-na.ru" size="sm" cls="ov--confirm" :before-close="() => !detaching" @close="detachAsk = false">
        <div class="confirm confirm--warning">
            <span class="confirm__i"><UiIcon name="alert" :size="26" /></span>
            <div class="confirm__t">
                <h3>Вы точно хотите отвязать закупку от lit-na.ru?</h3>
            </div>
        </div>
        <template #footer="{ close }">
            <UiBtn label="Отмена" kind="secondary" size="lg" data-track="Отмена — отвязать от lit-na.ru" :disabled="detaching" @click="close()" />
            <UiBtn label="Отвязать" size="lg" :loading="detaching" @click="doDetach(close)" />
        </template>
    </UiSheet>

    <LitnaPay v-if="payOpen" :id="id" :end="pu?.isPaid ? 'paid' : !pu?.isCreated ? 'reverted' : !pu?.litna ? 'detached' : ''" @close="payClosed" />
    <span class="sr" role="status">{{ step }}</span>

    <UiSheet v-if="relogin" ref="reloginSheet" :title="relogin.guest ? 'Заказ от гостя' : 'Не удалось войти на lit-na.ru'" size="sm" @close="reloginClosed">
        <div v-if="!relogin.guest" style="margin-bottom: var(--sp-6)"><UiBanner tone="danger" title="Зайдите заново" :text="relogin.err || ''" /></div>
        <!-- Заказ от гостя: сначала два пути строками на всю ширину; «Войти в аккаунт» — форма входа в том же окне. -->
        <div v-if="relogin.guest && !relogin.form" style="display: grid; gap: var(--sp-3)">
            <UiBtn label="Продолжить как гость" size="lg" block data-track="Продолжить как гость" @click="reloginGo(true)" />
            <UiBtn label="Войти в аккаунт" kind="secondary" size="lg" block data-track="Войти в аккаунт lit-na.ru" @click="relogin.form = true" />
        </div>
        <LitnaLogin v-else :login="typeof litnaAcc?.login === 'string' ? litnaAcc.login : ''" @done="reloginGo(false)" />
        <template v-if="!relogin.guest || relogin.form" #footer="{ close }">
            <UiBtn v-if="relogin.guest" label="Продолжить как гость" kind="secondary" size="lg" data-track="Продолжить как гость" @click="reloginGo(true)" />
            <template v-else>
                <UiBtn label="Отмена" kind="secondary" size="lg" data-track="Отмена — вход lit-na.ru" @click="close()" />
                <UiBtn label="Заказать как гость" kind="secondary" size="lg" @click="reloginGo(true)" />
            </template>
        </template>
    </UiSheet>

    <UiSheet v-if="bind" ref="bindSheet" title="Товары не привязаны к lit-na.ru" size="sm" @close="bindClosed">
        <ul class="exlist" style="margin-top: 0">
            <li v-for="r in bind.rows" :key="r.product">
                <UiCover :product="byId.get(String(r.product)) || { _id: r.product, name: r.name }" size="xs" /><span
                    >{{ r.name }}<small v-if="r.siteId != null"><UiIcon name="check" :size="14" class="inl" /> {{ siteById.get(String(r.siteId))?.name || "привязан" }}</small
                    ><small v-else class="neg">нет привязки</small></span
                ><UiBtn :label="r.siteId != null ? 'Изменить' : 'Привязать'" kind="secondary" size="sm" data-track="Привязать товар" :loading="binding.has(r.product)" @click="bindPick = r" />
            </li>
        </ul>
        <template #footer="{ close }">
            <UiBtn label="Отмена" kind="secondary" size="lg" data-track="Отмена — привязка товаров" @click="close()" />
            <UiBtn label="Продолжить" size="lg" data-track="Продолжить без привязки" :disabled="binding.size > 0" @click="close('go')" />
        </template>
    </UiSheet>
    <LitnaSiteSheet v-if="bindPick" :title="bindPick.name" :items="litCat?.items || []" :current="bindPick.siteId ?? litCat?.suggest?.[bindPick.product]" @pick="bindTo" @close="bindPick = null" />
</template>
