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
import { useInventoryLock, useProducts } from "@/service/queries"
import { confirm, toast, UiBanner, UiBtn, UiCover, UiChip, UiEmpty, UiError, UiIcon, UiIconBtn, UiLazy, UiPage, UiSelect, UiSheet, UiSk, UiSkRow, UiStamp, UiStatus } from "@/ui"
import { useQuery, useQueryClient } from "@tanstack/vue-query"
import { computed, nextTick, ref, shallowRef, toRef, watch } from "vue"
import { useRouter } from "vue-router"
import AskSheet from "./AskSheet.vue"
import { draftOf, dropEdits, needOf, overBy, PST, pst, puLineProduct, puPayload, puPerm, puTurn, qtyIn, rcvIn, STEP, sum, syncDraft } from "./purchase"
import PurchaseRow from "./PurchaseRow.vue"

// Закупка отдельной страницей: позиции слева, итоги и действия — в правой колонке (на телефоне — панель действий снизу).
const props = defineProps({ id: { type: String, required: true } })
const router = useRouter()
const qc = useQueryClient()
const { can, plain } = useSession()
const pm = computed(() => puPerm(plain.value))
const { data: products } = useProducts()
const { frozen } = useInventoryLock()
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
        return { _id: id, p: puLineProduct(pu.value, it, byId.value.get(id) || own || gone(id)), q0: it.quantity || 0, conf: it.confirmedQuantity || 0 }
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
    receive: ["", "Товар", "Заказано", "Было принято", "Принимаем сейчас", "Статус"],
    done: ["", "Товар", "Заказано", "Принято", "Сумма"]
}

/* ---------- Итоги ---------- */
const eff = computed(() => rows.value.map((l) => ({ l, q: qOf(l), rcv: rcvOf(l) })))
const inn = computed(() => eff.value.filter((x) => x.q > 0))
// После оплаты сумма закупки — записанная сервером (как в списке): у старой закупки без цен в строках сумма строк по текущим ценам с ней расходится.
const total = computed(() => (pu.value?.isPaid && pu.value.totalAmount ? pu.value.totalAmount : sum(inn.value, (x) => x.l.p.price * x.q)))
const pieces = computed(() => sum(inn.value, (x) => x.q))
const got = computed(() => sum(eff.value, (x) => (mode.value === "done" ? x.l.conf : x.rcv)))
const was = computed(() => sum(eff.value, (x) => x.l.conf))
const pct = computed(() => (pieces.value ? Math.round((got.value / pieces.value) * 100) : 0))
const left = computed(() => pieces.value - was.value)
const overList = computed(() => inn.value.filter((x) => overBy(x.l.p, x.q, x.l.q0, pm.value.exceed)))
const below = computed(() => lines.value.filter((l) => needOf(l.p) > 0 && !(qOf(l) > 0)))
const turn = computed(() => puTurn(st.value, pm.value, { total: total.value, left: left.value, got: was.value }))
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
            unpaid: pm.value.pay ? `Оплатите ${money(total.value)}` : "Ждёт оплаты казначеем",
            receiving: pm.value.edit ? "Примите товар" : "Ждёт приёмки",
            partial: pm.value.edit ? `Довезли не всё: ждём ${pcs(left.value)}` : `Не довезли ${pcs(left.value)}`
        })[st.value]
)
const TRACK = computed(() => [
    ["Черновик", "Кладовщик собирает позиции"],
    ["Оплата", "Казначей оплачивает поставщику"],
    ["Получение", st.value === "partial" ? "Пришла часть — ждём остальное" : "Кладовщик принимает товар"],
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
const fresh = ref("") // id закупки, которую только что завершили здесь: её штамп ложится «ударом»

/** PUT с позициями как в прежнем коде; all — принять всё (принято = заказано). true — успех. */
async function update(flags, label, { creating = false, all = false } = {}) {
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
    busy.value = label
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
    if (await update(FLAGS(true, false, false, false), label, { creating: true })) toast({ type: "success", title: `Закупка №${pu.value.purchaseNumber} создана` })
}
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
            ["Сумма", money(total.value)],
            ["Позиций", `${inn.value.length} · ${pcs(pieces.value)}`]
        ]
    })
    if (yes && (await update(FLAGS(true, true, false, false), label))) toast({ type: "success", title: `Закупка №${n} оплачена` })
}
async function receive(label) {
    if (!dirty.value) return // набранное вернуло всё к принятому на сервере — принимать нечего
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
    if (!(await confirm({ title: `Удалить закупку №${n}?`, ok: "Удалить закупку", tone: "danger" }))) return
    busy.value = label
    try {
        await axiosInstance.delete(`/purchases/${props.id}`)
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
    }
    if (s === "unpaid") {
        out.primary = p.pay ? { label: `Оплатить ${money(total.value)}`, short: "Оплатить", icon: "wallet", kind: "success", fn: pay } : { label: "Ждём оплату казначеем", short: "Ждём казначея", icon: "clock", kind: "secondary", disabled: true }
        if (p.edit) out.second = { label: dirty.value ? "Сохранить новые позиции" : "Новых позиций нет", kind: "secondary", disabled: !dirty.value, fn: saveAdded }
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
    if ((s === "draft" || s === "unpaid") && p.del) out.more.push({ label: "Удалить закупку", icon: "trash", kind: "danger-ghost", fn: remove })
    return out
})
const hasMore = computed(() => !!(acts.value.second || acts.value.more.length))
const btn = (a) => ({ label: a.label, icon: a.icon || "", kind: a.kind || "primary", disabled: !!a.disabled || (!!busy.value && busy.value !== a.label), loading: busy.value === a.label })
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
        if (prompted === props.id || !pm.value.edit || !pu.value || !products.value || pu.value.isCreated) return
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
                    <div v-else class="card tbl" :class="'tbl--' + mode" :style="{ '--cols': COLS[mode] }">
                        <div class="tbl__h" aria-hidden="true">
                            <span v-for="(h, i) in HEAD[mode]" :key="i">{{ h }}</span>
                        </div>
                        <UiLazy v-slot="{ item }" :items="visible" :size="24" :reset-key="resetKey"><PurchaseRow :line="item" :mode="mode" :d="d" :pm="pm" @set="set" @clamped="clamped" /></UiLazy>
                    </div>
                </div>
                <div v-if="st === 'unpaid' && pm.edit" class="addrow">
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
                    <div class="ohero__top">
                        <UiStatus :st="PST[st].st" :label="PST[st].label" size="lg" /><span class="muted" style="font-size: var(--fs-14); font-weight: 700">{{ money(total) }}</span>
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
                        <div class="ohero__who" :class="{ 'ohero__who--mine': turn.mine }">
                            <UiIcon :name="turn.mine ? 'bolt' : 'clock'" /><span>{{ turn.mine ? turn.short : "Ждёт: " + (st === "unpaid" ? "казначей" : "кладовщик") }}</span>
                        </div>
                    </template>
                </section>
                <section class="card blk">
                    <h3>{{ mode === "receive" || mode === "done" ? "Приёмка" : "Итог закупки" }}</h3>
                    <div class="sumgrid">
                        <template v-if="mode === 'receive' || mode === 'done'">
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
                            <div class="sumcard__total">
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
                        <UiBtn v-if="acts.primary" v-bind="btn(acts.primary)" size="lg" block @click="run(acts.primary)" />
                        <p v-if="acts.second?.note" class="foot-note"><UiIcon name="clipboard" :size="16" class="inl" /> {{ acts.second.note }}</p>
                        <UiBtn v-else-if="acts.second" v-bind="btn(acts.second)" size="lg" block @click="run(acts.second)" />
                        <div v-if="acts.more.length" class="work__more"><UiBtn v-for="a in acts.more" :key="a.label" v-bind="btn(a)" size="md" @click="run(a)" /></div>
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
                <span class="abar__sum">
                    <template v-if="mode === 'receive'"
                        ><small>{{ num(got) }} из {{ pcs(pieces) }}</small
                        ><b>{{ pct }}%</b></template
                    >
                    <template v-else
                        ><small>{{ positions(inn.length) }} · {{ pcs(pieces) }}</small
                        ><b>{{ money(total) }}</b></template
                    >
                </span>
                <UiBtn v-bind="btn(acts.primary)" :label="acts.primary.short || acts.primary.label" size="lg" @click="run(acts.primary)" />
                <UiBtn v-if="hasMore" icon="dots" title="Ещё действия" kind="secondary" size="lg" @click="more = true" />
            </div>
        </div>
    </UiPage>

    <UiSheet v-if="more" :title="`Закупка №${pu?.purchaseNumber ?? ''}`" size="sm" @close="moreClosed">
        <template #default="{ close }">
            <div style="display: grid; gap: var(--sp-3)">
                <template v-for="a in [acts.second, ...acts.more].filter(Boolean)" :key="a.label || a.note">
                    <p v-if="a.note" class="foot-note"><UiIcon name="clipboard" :size="16" class="inl" /> {{ a.note }}</p>
                    <UiBtn v-else v-bind="btn(a)" size="lg" block @click="pickMore(a, close)" />
                </template>
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

    <AskSheet v-if="ask" :title="ask.title" :text="ask.text" :tone="ask.tone" :icon="ask.icon" :ok="ask.ok" :ok-icon="ask.okIcon" @done="answered">
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
</template>
