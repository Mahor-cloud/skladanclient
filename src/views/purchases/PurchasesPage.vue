<script setup>
/**
 * Copyright 2026 Lord_mahor
 * Licensed under Apache 2.0
 */
import { useSession } from "@/composables/useSession"
import { date, money, num, pcs, plural, positions, short } from "@/domain/format"
import { pid } from "@/domain/stock"
import axiosInstance from "@/service/axios"
import { track } from "@/service/usage"
import { checkLitna, useInventoryLock, useProducts, usePurchases } from "@/service/queries"
import { toast, UiAvatar, UiBanner, UiBtn, UiChip, UiCoverStack, UiEmpty, UiError, UiIcon, UiIconBtn, UiLazy, UiPage, UiSk, UiStatus } from "@/ui"
import { useQueryClient } from "@tanstack/vue-query"
import { computed, ref, watch } from "vue"
import { useRouter } from "vue-router"
import AskSheet from "./AskSheet.vue"
import { litnaCancelled, litnaShipped, litnaTag, origin } from "./litna"
import { listState as ls, PST, pst, puFixed, puGot, puItems, puPayTotal, puPerm, puPieces, puTotal, puTurn, STEP, sum } from "./purchase"

// Список закупок: сводка, фильтры по статусу, поиск по номеру и товару; закупка открывается отдельной страницей.
const router = useRouter()
const qc = useQueryClient()
const { can, plain } = useSession()
const pm = computed(() => puPerm(plain.value))
const { data: purchases, isPending, isError, refetch } = usePurchases()
const { data: products } = useProducts()
const { lock } = useInventoryLock()

// Неоплаченные заказы lit-na.ru (и отменённые на сайте — оплата может дойти позже): при открытии списка один раз спросить сайт.
const asked = new Set()
watch(
    purchases,
    (list) => {
        for (const pu of list || []) {
            if (!pu.litna || !pu.isCreated || pu.isPaid || asked.has(pu._id)) continue
            asked.add(pu._id)
            checkLitna(pu._id).then((r) => {
                if (r.paid || r.reverted) qc.invalidateQueries({ queryKey: ["purchases"] })
                // Заказ отменён на сайте — закупка снова черновик: текст сервера (проверка — одна на закупку за открытие списка).
                // gone (записи заказа нет — перенос местности) — не отмена: молча.
                if (!r.reverted) return
                track("error", "Заказ отменён на lit-na.ru")
                toast({ type: "warning", title: r.message || "Заказ отменён на lit-na.ru", timeout: 15000 })
            })
        }
    },
    { immediate: true }
)

const byId = computed(() => new Map((products.value || []).map((p) => [String(p._id), p])))
const priceOf = (id) => byId.value.get(id)?.price
const all = computed(() =>
    (purchases.value || [])
        .map((pu) => {
            const st = pst(pu)
            const items = puItems(pu)
            const total = puTotal(pu, priceOf)
            const pieces = puPieces(pu)
            const got = puGot(pu)
            // pay — к оплате (с доставкой заказа сайта), как на странице закупки; total — сумма самой закупки
            const pay = puPayTotal(pu, total)
            return { _id: pu._id, pu, st, items, total, pay, pieces, got, covers: items.map((i) => byId.value.get(pid(i)) || { _id: pid(i), name: "" }), turn: litnaCancelled(pu) && st === "unpaid" ? { short: "Заказ отменён", text: "Заказ отменён на сайте" } : puTurn(st, puPerm(plain.value, pu), { total: pay, left: pieces - got, got }) }
        })
        .sort((a, b) => b.pu.purchaseNumber - a.pu.purchaseNumber)
)

const PF = {
    all: { label: "Все", fn: () => true },
    active: { label: "В работе", fn: (x) => x.st !== "done" },
    draft: { label: "Черновики", fn: (x) => x.st === "draft" },
    unpaid: { label: "Ждут оплаты", fn: (x) => x.st === "unpaid" },
    receiving: { label: "Ждут приёмки", fn: (x) => x.st === "receiving" || x.st === "partial" },
    done: { label: "Завершённые", fn: (x) => x.st === "done" }
}
// Тот, кто только платит, по умолчанию видит неоплаченные.
const f = computed(() => ls.f || (can("approve-payment") && !can("create_purchases") && all.value.some(PF.unpaid.fn) ? "unpaid" : "active"))
const list = computed(() => {
    const q = ls.q.trim().toLowerCase()
    const no = q.replace(/[№#]/g, "")
    // Поиск идёт по всем закупкам, какой бы фильтр ни стоял
    let l = q ? all.value : all.value.filter(PF[f.value].fn)
    // Как в прежнем списке, ищется и по создателю и дате.
    if (q) l = l.filter((x) => String(x.pu.purchaseNumber).includes(no) || `${x.pu.user?.name || ""} ${date(x.pu.purchaseDate)}`.toLowerCase().includes(q) || x.covers.some((p) => (p.name || "").toLowerCase().includes(q)))
    return l
})

const act = computed(() => all.value.filter((x) => x.st !== "done"))
const unpaid = computed(() => all.value.filter(PF.unpaid.fn))
const onWay = computed(() => {
    const way = act.value.filter((x) => x.pu.isCreated)
    const ids = new Set(way.flatMap((x) => x.items.filter((i) => i.quantity > (i.confirmedQuantity || 0)).map(pid)))
    return { pcs: sum(way, (x) => x.pieces - x.got), n: ids.size }
})
const HEAD = ["№", "Создал", "Состав", "Сумма", "Статус", "Что дальше", "Приёмка", "Дата", ""]
const pct = (x) => (x.pieces ? Math.round((x.got / x.pieces) * 100) : 0)

/* Новая закупка: подтверждение (с напоминанием о незаконченном черновике) → черновик со всеми товарами склада. */
const asking = ref(false)
const busy = ref(false) // запрос создания в пути: повторное «Новая закупка» не создаёт второй черновик
const ask = () => !busy.value && (asking.value = true)
const lastDraft = computed(() => all.value.find((x) => x.st === "draft")?.pu)
async function create(yes) {
    asking.value = false
    if (!yes || busy.value) return
    busy.value = true
    try {
        const { data } = await axiosInstance.post("/purchases")
        qc.invalidateQueries({ queryKey: ["purchases"] })
        toast({ type: "success", title: `Черновик закупки №${data.purchaseNumber}` })
        router.push({ name: "purchase", params: { id: data._id } })
    } catch (err) {
        const payload = err?.response?.data
        toast({ type: "error", title: payload?.code === "ACTIVE_INVENTORY" ? "Закупка невозможна" : "Ошибка", text: payload?.message || err?.message || "Не удалось создать закупку" })
    } finally {
        busy.value = false
    }
}
</script>

<template>
    <UiPage v-if="!can('view_purchases')" title="Закупки">
        <div class="card"><UiEmpty art="error" title="Нет доступа" /></div>
    </UiPage>
    <UiPage v-else-if="isError && !purchases" title="Закупки">
        <div class="card card--pad"><UiError title="Не удалось загрузить «Закупки»" @retry="refetch()" /></div>
    </UiPage>
    <UiPage v-else-if="isPending" title="Закупки" sub="Загружаем…">
        <div class="kpis kpis--3">
            <div v-for="i in 3" :key="i" class="card kpi"><UiSk w="52%" :h="12" /><UiSk w="74%" :h="26" :r="8" /><UiSk w="60%" :h="12" /></div>
        </div>
        <div class="listtools">
            <div class="filterbar"><UiSk v-for="w in [110, 120, 130, 140, 130]" :key="w" :w="w + 'px'" :h="40" :r="99" /></div>
            <UiSk :h="48" :r="14" />
        </div>
        <p class="loading-note" role="status"><span class="spin"></span>Загружаем закупки…</p>
        <div class="card ptable">
            <div v-for="i in 5" :key="i" class="purow purow--sk">
                <UiSk w="40%" :h="18" /><UiSk w="96px" :h="26" :r="99" /><UiSk :h="6" :r="99" /><UiSk w="70%" :h="12" />
                <span style="display: flex; justify-content: space-between"><UiSk w="120px" :h="32" :r="8" /><UiSk w="80px" :h="20" /></span>
            </div>
        </div>
    </UiPage>
    <UiPage v-else title="Закупки" :sub="`${act.length} в работе · ${all.length} всего`">
        <template #actions><UiIconBtn v-if="pm.create && !lock" icon="plus" label="Новая закупка" kind="primary" @click="ask" /></template>
        <template #deskActions>
            <UiBtn v-if="pm.create" label="Новая закупка" :icon="lock ? 'lock' : 'plus'" :disabled="lock" :title="lock ? 'Идёт инвентаризация — создание закупок невозможно' : null" :loading="busy" @click="ask" />
        </template>
        <div v-if="all.length" class="kpis kpis--3">
            <div class="card kpi">
                <small>В работе</small><b>{{ act.length }} {{ plural(act.length, ["закупка", "закупки", "закупок"]) }}</b
                ><span>{{ money(sum(act, (x) => x.total)) }}{{ act.some((x) => !puFixed(x.pu)) ? " по текущим ценам" : "" }}</span>
            </div>
            <div class="card kpi">
                <small>Ждут оплаты</small><b :class="{ acc: unpaid.length }">{{ money(sum(unpaid, (x) => x.pay)) }}</b
                ><span>{{ unpaid.length }} {{ plural(unpaid.length, ["закупка", "закупки", "закупок"]) }}</span>
            </div>
            <div class="card kpi">
                <small>Едет на склад</small><b>{{ pcs(onWay.pcs) }}</b
                ><span>{{ positions(onWay.n) }} · «Ждёт поставку» в каталоге</span>
            </div>
        </div>
        <div class="listtools">
            <div class="filterbar" role="group" aria-label="Фильтр закупок">
                <UiChip v-for="(v, k) in PF" :key="k" :label="v.label" :count="all.filter(v.fn).length" :active="(ls.q.trim() ? 'all' : f) === k" :tone="k === 'unpaid' && can('approve-payment') ? 'accent' : ''" @click="(ls.f = k), (ls.q = '')" />
            </div>
            <form class="msearch__f lsearch" role="search" @submit.prevent="$event.target.querySelector('input').blur()">
                <UiIcon name="search" />
                <input v-model="ls.q" type="search" name="q" placeholder="Номер закупки или товар" aria-label="Номер закупки или товар" autocomplete="off" />
                <button v-if="ls.q" type="button" class="msearch__x" aria-label="Очистить поиск" @click="ls.q = ''"><UiIcon name="x" :size="18" /></button>
            </form>
        </div>
        <div v-if="!all.length" class="card">
            <UiEmpty art="box" title="Закупок пока нет"><UiBtn v-if="pm.create" label="Новая закупка" icon="plus" @click="ask" /></UiEmpty>
        </div>
        <div v-else-if="!list.length" class="card">
            <UiEmpty art="search" :title="ls.q.trim() ? 'Ничего не нашли' : 'Здесь пусто'"><UiBtn label="Все в работе" kind="secondary" @click="(ls.f = 'active'), (ls.q = '')" /></UiEmpty>
        </div>
        <div v-else class="card ptable">
            <div class="ptable__h" aria-hidden="true">
                <span v-for="(h, i) in HEAD" :key="i">{{ h }}</span>
            </div>
            <UiLazy :items="list" :size="20" :reset-key="f + '~' + ls.q">
                <template #default="{ item: x }">
                    <RouterLink class="purow" :to="{ name: 'purchase', params: { id: x.pu._id } }" :data-st="x.st">
                        <span class="purow__no"
                            ><b
                                >Закупка №{{ x.pu.purchaseNumber
                                }}<template v-if="origin(x.pu)">
                                    <span class="tag" :class="x.pu.litna ? 'tag--teal' : 'tag--neutral'" style="margin-left: var(--sp-3)">{{ origin(x.pu) }}</span></template
                                ></b
                            ><small>{{ date(x.pu.purchaseDate) }} · {{ x.pu.user?.name || "" }}</small></span
                        >
                        <span class="purow__who"
                            ><UiAvatar :user="x.pu.user" size="sm" /><b>{{ x.pu.user?.name || "—" }}</b></span
                        >
                        <span class="purow__items"
                            ><UiCoverStack :products="x.covers" /><small>{{ positions(x.items.length) }}</small></span
                        >
                        <span class="purow__sum"
                            ><b>{{ money(x.total) }}</b
                            ><small>{{ pcs(x.pieces) }}</small></span
                        >
                        <span class="purow__st"
                            ><UiStatus :st="PST[x.st].st" :label="PST[x.st].label" size="sm" /><span v-if="litnaTag(x.pu)" class="tag" :class="litnaShipped(x.pu) ? 'tag--teal' : 'tag--neutral'">{{ litnaTag(x.pu) }}</span></span
                        >
                        <span class="purow__turn turn" :class="{ 'turn--mine': x.turn.mine }">{{ x.turn.text }}</span>
                        <span class="purow__got">
                            <small v-if="x.st === 'draft' || x.st === 'unpaid'" class="muted">—</small>
                            <span v-else class="gbar" :class="{ 'gbar--full': pct(x) === 100 }"
                                ><span class="gbar__t">Принято {{ num(x.got) }} из {{ pcs(x.pieces) }}</span
                                ><span class="bar"><i :style="{ width: pct(x) + '%' }"></i></span
                            ></span>
                        </span>
                        <span class="purow__d">{{ short(x.pu.purchaseDate) }}</span>
                        <span class="purow__track">
                            <div class="mtrack" :class="{ 'mtrack--done': x.st === 'done' }" :aria-label="`Этап ${STEP[x.st] + 1} из 4`">
                                <i v-for="i in 4" :key="i" :class="i - 1 < STEP[x.st] || x.st === 'done' ? 'is-done' : i - 1 === STEP[x.st] ? 'is-cur' : ''"></i>
                            </div>
                        </span>
                        <UiIcon name="right" :size="20" class="purow__chev" />
                    </RouterLink>
                </template>
                <template #sk>
                    <div v-for="i in 2" :key="i" class="purow purow--sk"><UiSk w="40%" :h="18" /><UiSk w="96px" :h="26" :r="99" /><UiSk :h="6" :r="99" /><UiSk w="70%" :h="12" /></div>
                </template>
            </UiLazy>
        </div>
    </UiPage>

    <AskSheet v-if="asking" title="Начать новую закупку?" icon="truck" ok="Создать черновик" ok-icon="plus" cancel="Не сейчас" @done="create">
        <div v-if="lastDraft" style="margin-top: var(--sp-6)">
            <UiBanner tone="info" :title="`Уже есть черновик №${lastDraft.purchaseNumber}`">
                <template #action><UiBtn label="Открыть" kind="secondary" size="sm" :to="{ name: 'purchase', params: { id: lastDraft._id } }" /></template>
            </UiBanner>
        </div>
    </AskSheet>
</template>
