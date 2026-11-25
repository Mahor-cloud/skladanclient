<script setup>
/**
 * Copyright 2026 Lord_mahor
 * Licensed under Apache 2.0
 */
import { useSession } from "@/composables/useSession"
import { date, money, pcs, positions, rel } from "@/domain/format"
import { orderDiff, orderPerms, orderPieces, orderStatus, orderSteps, orderTurn, STATUS } from "@/domain/orders"
import axiosInstance from "@/service/axios"
import { queryClient } from "@/service/queryClient"
import { useInventoryLock, useMsgs, useProducts } from "@/service/queries"
import { backTo, confirm, PEEK, toast, UiBanner, UiBtn, UiEmpty, UiIcon, UiLines, UiPane, UiPayBlock, UiSheet, UiStamp, UiStatus } from "@/ui"
import { computed, inject, onBeforeUnmount, ref, shallowRef, toRef, watch } from "vue"
import { useRoute, useRouter } from "vue-router"
import { orderError, refreshOrders, repeatOrder, useOrder, useShortages } from "./api"
import { ASK_FLAGS, askAllowed, askStale, committed, diffText, EVENT, linesPayload, linesTotal, orderLines, orderShortages, orderSum } from "./orders"

// Заказ — деталь: правая колонка / окно / лист снизу. Открывается по адресу и через peek() из истории и статистики,
// поэтому данные — по props.id, а адрес читается только когда заказ открыт по нему.
// readonly — только просмотр (так заказ открывает «Статистика», как раньше).
const props = defineProps({ id: { type: String, required: true }, readonly: Boolean })
const route = useRoute()
const router = useRouter()
const { can, plain } = useSession()
const peeked = inject(PEEK, null)
const close = () => (peeked ? peeked.close() : backTo({ name: "shop" }))

const live = ref(true)
const { data: order, isPending, error, refetch } = useOrder(toRef(props, "id"), live)
// isLoading, а не isPending: выключенный или ждущий сети запрос не должен прятать выдачу навсегда
const { data: shortages, isLoading: shortWait } = useShortages()
const { data: msgs } = useMsgs()
const { data: products } = useProducts()
const { frozen } = useInventoryLock()
// Удалённый заказ не должен остаться в кэше: его адрес может открыться снова.
onBeforeUnmount(() => live.value || queryClient.removeQueries({ queryKey: ["order", props.id] }))

const loading = computed(() => isPending.value && can("view_orders"))
// Заказ удалили, пока он был открыт: в кэше он ещё есть, но действовать с ним уже нельзя.
const missing = computed(() => !order.value || error.value?.response?.status === 404)
const def = computed(() => (order.value && !order.value.isCompleted ? orderShortages(shortages.value, props.id) : []))
const lines = computed(() => orderLines(order.value, def.value))
const sum = computed(() => orderSum(order.value, lines.value))
const st = computed(() => (order.value ? orderStatus(order.value) : ""))
const envOf = (o) => ({ deficit: !o.isCompleted && orderShortages(shortages.value, props.id).length > 0, frozen: frozen.value })
const env = computed(() => envOf(order.value))
const pm = computed(() => orderPerms(order.value, plain.value, env.value))
// То, по чему сверяются окна заказа: открытый заказ, права на действия, сумма и ожидаемая разница. Считается и по заказу
// на экране, и по свежему ответу сервера перед отправкой.
const stateOf = (o) => ({ id: props.id, pm: orderPerms(o, plain.value, envOf(o)), sum: orderSum(o, orderLines(o)), diff: orderDiff(o) })
const turn = computed(() => orderTurn(order.value, plain.value, env.value))
const diff = computed(() => orderDiff(order.value))
const steps = computed(() => orderSteps(order.value))
const cur = computed(() => STATUS[st.value].step)
const events = computed(() => [...(order.value.paymentEvents || [])].reverse())
const stepNote = (s, i) => (i <= cur.value ? s.sub + (s.at ? " · " + rel(s.at) : "") : i === cur.value + 1 ? turn.value.short : " ")
const money2 = (n) => new Intl.NumberFormat("ru-RU", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n)

// Штамп «ударяет», только когда статус сменился при открытом заказе; при открытии штампы просто стоят.
const hit = ref("")
watch(
    () => [props.id, st.value],
    ([id, now], [was, old]) => (hit.value = id === was && old ? now : "")
)

/* ---------- Окна заказа: подтверждения с составом (оплата, подтверждение оплаты, получение), накладная, «ещё» ---------- */
// ask — снимок на момент открытия: { kind, id }, у подтверждений ещё суммы и тексты вопроса. Окно живёт, пока снимок верен.
const ask = shallowRef(null)
const sheet = ref(null)
const busy = ref(false)
function drop() {
    ask.value = null
    busy.value = false
}
// Открыт другой заказ — окно прежнего закрывается сразу. Заказ изменился (статус, сумма, дефицит) — тоже, если только
// это не наш же запрос в пути: тогда окно закроет act().
watch(
    () => !!ask.value && (ask.value.id !== props.id || (!busy.value && (missing.value || askStale(ask.value, stateOf(order.value))))),
    (stale) => stale && drop()
)
const confirmText = (d) => (d > 0 ? "Подтвердить доплату" : d < 0 ? "Подтвердить возврат" : "Подтвердить оплату")
function open(kind, o = order.value) {
    const { id, pm: p, sum: total, diff: d } = stateOf(o)
    const n = o.orderNumber
    const own = p.own
    const texts = {
        pay: { title: own ? `Вы перевели ${money(total)}?` : `Отметить заказ №${n} оплаченным?`, ok: own ? "Да, оплатил" : "Отметить оплату", tone: "primary", icon: "wallet", kv: "Заказ №" + n, done: { title: "Оплата отмечена" } },
        confirm: {
            title: `Подтвердить ${d > 0 ? "доплату " + money(d) : d < 0 ? "возврат " + money(-d) : "оплату " + money(total)}?`,
            ok: confirmText(d),
            tone: "success",
            icon: "check",
            kv: "Итого",
            done: { title: d > 0 ? "Доплата подтверждена" : d < 0 ? "Возврат подтверждён" : "Оплата подтверждена", text: `Заказ №${n} — к выдаче` }
        },
        complete: {
            title: own ? `Заказ №${n} получен?` : `Выдать и завершить заказ №${n}?`,
            ok: own ? "Да, получен" : "Выдан, завершить",
            tone: "success",
            icon: "package",
            kv: "Итого",
            done: { title: `Заказ №${n} завершён`, text: !own ? "Склад списан" : can("cabinet_access") ? "Полученное добавлено в «Мой склад»" : "", action: own && can("create_orders") ? { label: "Заказать снова", fn: repeat } : null }
        }
    }
    ask.value = { kind, id, sum: total, diff: d, ...texts[kind] }
}
async function act() {
    if (busy.value) return
    const a = ask.value
    if (missing.value || askStale(a, stateOf(order.value))) return drop()
    busy.value = true
    try {
        // Сверка со свежим заказом: запросу со старым статусом сервер не откажет, а снимет уже сделанное подтверждение оплаты.
        const { data: fresh } = await refetch({ throwOnError: true })
        if (ask.value !== a) return
        if (askStale(a, stateOf(fresh))) {
            drop()
            return toast({ type: "warning", title: "Заказ изменился" })
        }
        const [isPaid, confirmedPaid, isCompleted] = ASK_FLAGS[a.kind]
        const payload = { isPaid, confirmedPaid, isCompleted, items: linesPayload(orderLines(fresh)) }
        if (typeof fresh.comment === "string") payload.comment = fresh.comment
        await axiosInstance.put(`/orders/${a.id}`, payload)
        refreshOrders(a.id)
        // busy снимется, когда окно закроется: повторное касание за время закрытия ничего не отправит
        sheet.value?.close("ok")
        toast({ type: "success", ...a.done })
    } catch (e) {
        // Дефицит и заморозка от повтора не исчезнут — окно закрывается; при прочих отказах остаётся открытым, как раньше.
        if (["STOCK_SHORTAGE", "ACTIVE_INVENTORY"].includes(orderError(e, "Не удалось обновить заказ"))) sheet.value?.close("fail")
        else busy.value = false
    }
}
// ?ask=pay|complete в адресе заказа (кнопка «Заказ получен» в списке) — открыть подтверждение. Решает свежий ответ сервера:
// в кэше заказ может быть ещё в прежнем статусе.
watch(
    () => [props.id, !peeked && !props.readonly && route.query.ask],
    async ([id, want]) => {
        if (!["pay", "complete"].includes(want) || !can("view_orders")) return
        const { data: o, isError } = await refetch({ cancelRefetch: false })
        if (id !== props.id || route.query.ask !== want) return
        router.replace({ query: { ...route.query, ask: undefined } })
        if (!isError && o && askAllowed(want, stateOf(o).pm)) open(want, o)
    },
    { immediate: true }
)

/* ---------- Отмена и удаление, накладная, повтор ---------- */
async function remove() {
    const o = order.value
    const n = o.orderNumber
    const refund = committed(o)
    const ok = await confirm(
        o.isCompleted
            ? { title: `Удалить завершённый заказ №${n}?`, text: "Все товары из заказа вернутся на склад.", ok: "Удалить заказ", tone: "danger" }
            : { title: `Отменить заказ №${n}?`, text: o.isPaid && refund > 0 ? `Заказ оплачен — потребуется возврат ${money(refund)}` : "", ok: "Отменить заказ", cancel: "Не отменять", tone: "danger" }
    )
    if (!ok) return
    try {
        await axiosInstance.delete(`/orders/${props.id}`)
        live.value = false
        refreshOrders()
        close()
        toast(o.isCompleted ? { type: "success", title: `Заказ №${n} удалён` } : { type: "info", title: `Заказ №${n} отменён` })
    } catch (e) {
        orderError(e, "Не удалось удалить заказ")
    }
}
async function download() {
    if (busy.value) return
    busy.value = true
    try {
        const { generateInvoice } = await import("./invoice")
        await generateInvoice({ ...order.value, items: lines.value.map((x) => ({ ...x.p, buyQuantity: x.qty })), orderDate: date(order.value.orderDate) })
        sheet.value?.close("ok")
        toast({ type: "success", title: "Накладная сохранена", text: `invoice${order.value.orderNumber}.pdf` })
    } catch {
        busy.value = false
        toast({ type: "error", title: "Не удалось создать накладную" })
    }
}
function repeat() {
    repeatOrder(order.value, products.value)
}

/* ---------- Кнопки подвала: главное действие и «ещё» ---------- */
const primary = computed(() => {
    const p = pm.value
    if (p.pay) return { label: p.own ? "Я оплатил" : "Отметить оплату", icon: "wallet", run: () => open("pay") }
    if (p.confirm) return { label: confirmText(diff.value), icon: "check", kind: "success", run: () => open("confirm") }
    if (p.waiting) return { label: diff.value > 0 ? "Ждём доплату" : "Ждём подтверждения", icon: "clock", kind: "secondary", disabled: true }
    // Нехватка ещё не пришла: выдачу не показываем — заказ может оказаться заблокирован дефицитом. Место за ней держим, «ещё» не перескакивают.
    if (p.complete && shortWait.value) return { hidden: true }
    if (p.blocked) return { label: "Заблокировано", icon: "lock", kind: "secondary", disabled: true, title: "Дефицит по складу — завершение заблокировано до пополнения или правки заказов" }
    if (p.frozen)
        return {
            label: p.own ? "Выдача после инвентаризации" : "Выдать заказ",
            icon: "clipboard",
            kind: "secondary",
            disabled: true,
            note: p.own ? "Идёт инвентаризация — заказ выдадут после её завершения" : "Выдача заморожена до завершения инвентаризации"
        }
    if (p.complete) return { label: p.own ? "Заказ получен" : "Выдать заказ", icon: "check", kind: "success", run: () => open("complete") }
    if (st.value === "done" && p.own && can("create_orders")) return { label: "Повторить заказ", icon: "repeat", kind: "secondary", run: repeat }
    return null
})
const more = computed(() => {
    const p = pm.value
    // Удаление сервер разрешает только с правом delete_orders — без него кнопки нет.
    const del = can("delete_orders")
    return [
        p.invoice && { label: "Накладная", icon: "doc", kind: "outline", run: () => (ask.value = { kind: "invoice", id: props.id }) },
        p.edit && { label: "Изменить позиции", icon: "edit", kind: "outline", run: () => router.push({ name: "order-edit", params: { id: props.id } }) },
        p.cancel && del && { label: "Отменить заказ", icon: "x", kind: "danger-ghost", run: remove },
        p.remove && del && { label: "Удалить заказ", icon: "trash", kind: "danger-ghost", run: remove }
    ].filter(Boolean)
})
// Без главного действия первые «ещё» стоят в подвале сами; остальные — за кнопкой с точками.
const direct = computed(() => (primary.value ? [] : more.value.slice(0, more.value.length > 2 ? 1 : 2)))
const dots = computed(() => more.value.length > direct.value.length)
function pick(m) {
    ask.value = null
    m.run()
}
</script>

<template>
    <UiPane :title="missing ? 'Заказ' : `Заказ №${order.orderNumber}`" :sub="missing ? '' : `${order.user?.name || ''} · ${date(order.orderDate)}`" :back="{ name: 'shop' }" :loading="loading">
        <UiEmpty v-if="missing" art="search" title="Заказ не найден"><UiBtn label="Все заказы" icon="receipt" :to="{ name: 'shop' }" /></UiEmpty>
        <div v-else class="opane" :data-order="order.orderNumber">
            <section class="card ohero o-hero" aria-live="polite">
                <div class="ohero__top">
                    <UiStatus :st="st" size="lg" /><b class="ohero__sum">{{ money(sum) }}</b>
                    <UiStamp v-if="order.isCompleted" class="stamp--top" tone="done" text="ВЫДАН" :rot="-9" :fresh="hit === 'done'" />
                </div>
                <div v-if="order.isPaid" class="stamps" aria-label="Отметки заказа">
                    <UiStamp tone="paid" text="ОПЛАЧЕНО" :date="steps[1].at ? date(steps[1].at) : ''" :rot="-7" :fresh="hit === 'paid'" />
                    <UiStamp v-if="order.confirmedPaid" tone="ready" :date="steps[2].at ? date(steps[2].at) : ''" :rot="5" :fresh="hit === 'ready'">ОПЛАТА<br />ПОДТВЕРЖДЕНА</UiStamp>
                </div>
                <div v-if="st !== 'done'" class="ohero__who" :class="{ 'ohero__who--mine': turn.mine, 'ohero__who--ice': turn.frozen }">
                    <UiIcon :name="turn.mine ? 'bolt' : turn.frozen ? 'clipboard' : 'clock'" /><span>{{ turn.short }}</span>
                </div>
            </section>
            <div v-if="diff || def.length || readonly || !pm.view" class="banners">
                <UiBanner v-if="diff > 0" tone="warning" icon="wallet" :title="`Требуется доплата ${money(diff)}`" :text="diffText(order, diff)" />
                <UiBanner v-else-if="diff < 0" tone="teal" :title="`Требуется возврат ${money(-diff)}`" :text="diffText(order, diff)" />
                <UiBanner
                    v-if="def.length"
                    tone="danger"
                    title="Заказ нельзя завершить — дефицит на складе"
                    :text="def.map((d) => `«${d.productName}»: требуется ${d.required}, на складе ${d.inStock}`).join('; ') + '. Пополните склад или скорректируйте заказы.'"
                />
                <UiBanner v-if="readonly || !pm.view" tone="neutral" icon="eye" title="Только просмотр" />
            </div>
            <UiPayBlock v-if="st === 'new' && (pm.own || pm.staffEdit)" :amount="sum" :pay="msgs || {}" />
            <UiPayBlock v-else-if="st === 'paid' && diff > 0 && pm.own" :amount="diff" title="Как доплатить" :pay="msgs || {}" />
            <section v-else-if="st === 'ready' && msgs?.receivedMessage" class="card blk o-pay">
                <h3>Где забрать</h3>
                <div class="pickup">
                    <span class="copyrow__i"><UiIcon name="pin" :size="22" /></span>
                    <p>{{ msgs.receivedMessage }}</p>
                </div>
            </section>
            <section class="card blk o-items">
                <h3>
                    Состав заказа<small>{{ positions(lines.length) }} · {{ pcs(orderPieces(order)) }}</small>
                </h3>
                <UiLines :items="lines" :head="false" :link="false" />
                <div class="itotal">
                    <span>Итого</span><b>{{ money(sum) }}</b>
                </div>
            </section>
            <div v-if="order.comment" class="comment o-comment">
                <UiIcon name="receipt" /><span>{{ order.comment }}</span>
            </div>
            <section class="card blk o-track">
                <h3>Путь заказа</h3>
                <ol class="track">
                    <li v-for="(s, i) in steps" :key="s.key" class="track__s" :class="{ 'is-done': i < cur || cur === 3, 'is-cur': i === cur && cur !== 3, 'is-next': i === cur + 1, 'is-blocked': i === 3 && cur === 2 && def.length }">
                        <span class="track__dot"><UiIcon v-if="i < cur || cur === 3" name="check" :size="16" /><i v-else-if="i === cur"></i></span>
                        <div class="track__c">
                            <b>{{ s.label }}</b
                            ><small>{{ stepNote(s, i) }}</small>
                        </div>
                    </li>
                </ol>
            </section>
            <section v-if="events.length" class="card blk o-events">
                <h3>История оплаты</h3>
                <ul class="events">
                    <li v-for="(e, i) in events" :key="i">
                        <span class="tag" :class="'tag--' + (EVENT[e.type]?.[1] || 'neutral')">{{ EVENT[e.type]?.[0] || e.type }}</span>
                        <time :datetime="new Date(e.at).toISOString()">{{ rel(e.at) }}</time>
                        <p v-if="e.note">{{ e.note }}</p>
                        <p v-if="e.reason">Причина: {{ e.reason }}</p>
                    </li>
                </ul>
            </section>
        </div>
        <template v-if="!missing && !readonly && (primary || more.length)" #footer>
            <p v-if="primary?.note" class="foot-note"><UiIcon name="clipboard" :size="16" class="inl" /> {{ primary.note }}</p>
            <UiBtn v-if="primary && !primary.hidden" :label="primary.label" :icon="primary.icon" :kind="primary.kind" :disabled="primary.disabled" :title="primary.title" size="lg" @click="primary.run()" />
            <UiBtn v-for="m in direct" :key="m.label" :label="m.label" :icon="m.icon" :kind="m.kind" size="lg" @click="m.run()" />
            <UiBtn v-if="dots" icon="dots" title="Ещё действия" kind="secondary" size="lg" @click="ask = { kind: 'more', id }" />
        </template>
    </UiPane>

    <UiSheet v-if="ask?.kind === 'more'" :title="`Заказ №${order.orderNumber}`" size="sm" @close="drop">
        <div style="display: grid; gap: var(--sp-3)">
            <UiBtn v-for="m in more" :key="m.label" :label="m.label" :icon="m.icon" :kind="m.kind" size="lg" block @click="pick(m)" />
        </div>
    </UiSheet>
    <UiSheet v-else-if="ask?.kind === 'invoice'" ref="sheet" :title="`Накладная №${order.orderNumber}`" :sub="`invoice${order.orderNumber}.pdf · A4`" size="lg" @close="drop">
        <div class="paper" role="document" aria-label="Расходная накладная">
            <div class="paper__band">
                <span>РАСХОДНАЯ НАКЛАДНАЯ</span><span>№ {{ order.orderNumber }}</span>
            </div>
            <div>
                <div class="kv">
                    <span>Дата</span><b>{{ date(order.orderDate) }}</b>
                </div>
                <div class="kv">
                    <span>Покупатель</span><b>{{ order.user?.name || "—" }}</b>
                </div>
                <div class="kv">
                    <span>Статус</span><b>{{ STATUS[st].label }}</b>
                </div>
            </div>
            <table>
                <thead>
                    <tr>
                        <th>№</th>
                        <th>Наименование</th>
                        <th>Цена</th>
                        <th>Кол-во</th>
                        <th>Сумма</th>
                    </tr>
                </thead>
                <tbody>
                    <tr v-for="(x, i) in lines" :key="x.p._id">
                        <td>{{ i + 1 }}</td>
                        <td>{{ x.p.name }}</td>
                        <td>{{ money2(x.p.price) }}</td>
                        <td>{{ x.qty }}</td>
                        <td>{{ money2(x.p.price * x.qty) }}</td>
                    </tr>
                </tbody>
            </table>
            <div class="paper__total">ИТОГО: {{ money2(linesTotal(lines)) }} руб.</div>
        </div>
        <template #footer="{ close: shut }">
            <UiBtn label="Закрыть" kind="secondary" size="lg" @click="shut()" />
            <UiBtn label="Скачать PDF" icon="download" size="lg" :loading="busy" @click="download" />
        </template>
    </UiSheet>
    <UiSheet v-else-if="ask" ref="sheet" :label="ask.title" size="sm" cls="ov--confirm" @close="drop">
        <div class="confirm" :class="'confirm--' + ask.tone">
            <span class="confirm__i"><UiIcon :name="ask.icon" :size="26" /></span>
            <div class="confirm__t">
                <h3>{{ ask.title }}</h3>
            </div>
        </div>
        <div class="confirm-extra">
            <UiLines class="lines--sm" :items="lines" :head="false" :link="false" />
            <div class="kv kv--total">
                <span>{{ ask.kv }}</span
                ><b>{{ money(sum) }}</b>
            </div>
        </div>
        <template #footer="{ close: shut }">
            <UiBtn label="Отмена" kind="secondary" size="lg" @click="shut('cancel')" />
            <UiBtn :label="ask.ok" :kind="ask.tone === 'success' ? 'success' : 'primary'" icon="check" size="lg" :loading="busy" @click="act" />
        </template>
    </UiSheet>
</template>
