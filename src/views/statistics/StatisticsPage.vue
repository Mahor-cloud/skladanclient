<script setup>
/**
 * Copyright 2026 Lord_mahor
 * Licensed under Apache 2.0
 */
import { useSession } from "@/composables/useSession"
import { money, pcs, plural } from "@/domain/format"
import axiosInstance from "@/service/axios"
import { toast, UiAside, UiAvatar, UiBtn, UiCover, UiEmpty, UiError, UiField, UiIcon, UiIconBtn, UiLazy, UiPage, UiSeg, UiSheet, UiSk } from "@/ui"
import { useQuery } from "@tanstack/vue-query"
import { computed, ref, watch } from "vue"
import StatCols from "./StatCols.vue"
import StatOrow from "./StatOrow.vue"
import { axisNum, daySeries, dayKey, flowRows, flowSeries, flowTotals, PERIODS, rangeText, st, statQuery, statRange, zeroFill } from "./statistics"

const { can } = useSession()
const allowed = computed(() => can("view_statistics"))

/* ---------- Период и запросы ---------- */
const needBounds = computed(() => st.p === "all" || (st.p === "custom" && !st.from))
// Начало «Всего времени» — самый ранний заказ или закупка; не узнали — с 2020 года, как раньше.
const bounds = useQuery({
    queryKey: ["statistics", "period-bounds"],
    queryFn: () => axiosInstance.get("/statistics/period-bounds"),
    select: (res) => res.data?.from ?? undefined,
    staleTime: 1000 * 60 * 5,
    retry: false,
    enabled: computed(() => allowed.value && needBounds.value)
})
const range = computed(() => statRange(st, { bounds: bounds.data.value }))
const qs = computed(() => statQuery(range.value, st))
const { data, isPending, isError, isPlaceholderData, refetch } = useQuery({
    queryKey: computed(() => ["statistics", "dashboard", qs.value]),
    queryFn: async () => (await axiosInstance.get(`/statistics/dashboard?${qs.value}`)).data,
    staleTime: 1000 * 60 * 5,
    placeholderData: (previous) => previous,
    retry: (failureCount, error) => {
        const status = error?.response?.status
        if (status && status >= 400 && status < 500) return false
        return failureCount < 1
    },
    enabled: computed(() => allowed.value && (!needBounds.value || bounds.isSuccess.value || bounds.isError.value))
})
const { data: users } = useQuery({
    queryKey: ["users-for-statistics"],
    queryFn: async () => (await axiosInstance.get("/auth/users")).data,
    staleTime: 60_000,
    enabled: computed(() => allowed.value && can("view_users"))
})
const { data: products } = useQuery({
    queryKey: ["products-for-statistics"],
    queryFn: async () => (await axiosInstance.get("/products?includeDeleted=true")).data,
    staleTime: 60_000,
    enabled: computed(() => allowed.value && can("view_products"))
})

watch(
    () => [st.p, st.from, st.to],
    () => Object.assign(st, { olimit: 12, day: null })
)
function setPeriod(p) {
    // «Период» начинается с того, что было выбрано: «С» — начало текущего периода, «По» пусто — до сегодня.
    if (p === "custom" && !st.from) st.from = dayKey(range.value.from)
    st.p = p
}

/* ---------- Показатели ---------- */
const charts = computed(() => data.value?.charts || {})
const created = computed(() => data.value?.summary.ordersCount.created || 0)
const days = computed(() => daySeries(range.value, charts.value.ordersByDay))
const flows = computed(() => flowSeries(range.value, charts.value.ordersByDay, charts.value.purchasesByDay))
const totals = computed(() => flowTotals(charts.value.ordersByDay, charts.value.purchasesByDay))
// Выбраны группы — поступления к ним не относятся: «Продажи и поступления» и «Расхождения» скрыты, как раньше.
const hideFlow = computed(() => st.groups.length > 0)
const byId = computed(() => new Map((products.value || []).map((p) => [String(p._id), p])))
const prod = (row) => byId.value.get(String(row.productId)) || row
const more = (k, list, n = 8) => (st.more[k] ? list : list.slice(0, n))
const toggle = (k) => (st.more[k] = !st.more[k])
const bar = (v, list, key) => Math.max(1.5, (v / Math.max(1, ...list.map((x) => x[key] || 0))) * 100) + "%"

const prodRows = computed(() => (st.mode === "sum" ? zeroFill(charts.value.topProducts, products.value, st.products, "amount") : zeroFill(charts.value.topProductsByQuantity, products.value, st.products, "quantity")))
const userRows = computed(() => charts.value.topUsers || [])
const disc = computed(() => flowRows(charts.value.flowByProduct, products.value, st.products))
const CATC = { Книга: "var(--c-book)", Буклет: "var(--c-booklet)", ИП: "var(--c-ip)", Брелок: "var(--c-keytag)", БУ: "var(--c-bu)", СП: "var(--c-sp)", Тетрадь: "var(--c-notebook)", Прочее: "var(--c-other)" }
const donut = computed(() => {
    const rows = charts.value.categoryDistribution || []
    const total = rows.reduce((s, c) => s + c.amount, 0)
    let off = 25
    const segs = rows.map((c) => {
        const len = (c.amount / (total || 1)) * 100
        const dash = Math.max(0, len - 0.6)
        const seg = { name: c.category, v: c.amount, pct: Math.round(len), color: CATC[c.category] || "var(--c-other)", dash: `${dash.toFixed(2)} ${(100 - dash).toFixed(2)}`, off: off.toFixed(2) }
        off -= len
        return seg
    })
    return { total, segs }
})
const orders = computed(() => data.value?.ordersList || [])
// Заказы выбранного дня — под графиком; день считается по UTC, как столбики сервера.
const dayPanel = computed(() => {
    if (!st.day || days.value.byWeek) return null
    const row = (charts.value.ordersByDay || []).find((r) => r.date === st.day)
    const n = row?.ordersCount || 0
    return {
        title: new Date(st.day + "T12:00").toLocaleDateString("ru-RU", { day: "numeric", month: "long" }),
        text: n ? `${n} ${plural(n, ["заказ", "заказа", "заказов"])} · ${money(row.amount)}` : "заказов не оформляли",
        list: orders.value.filter((o) => dayKey(o.orderDate) === st.day)
    }
})

/* ---------- Окно выбора групп и товаров ---------- */
const pick = ref(null)
const picked = ref([])
const pickQ = ref("")
function openPick(key) {
    pick.value = key
    picked.value = [...st[key]]
    pickQ.value = ""
}
const pickAll = computed(() =>
    pick.value === "groups"
        ? (users.value || []).filter((u) => Array.isArray(u.role?.permissions) && u.role.permissions.includes("create_orders")).map((u) => ({ _id: u._id, name: u.name || u.login, user: u }))
        : (products.value || []).map((p) => ({ _id: p._id, name: p.name, sub: `${p.category} · ${money(p.price)}`, product: p }))
)
const pickList = computed(() => {
    const q = pickQ.value.trim().toLowerCase()
    return pickAll.value.filter((x) => !q || x.name.toLowerCase().includes(q))
})
function applyPick(close) {
    st[pick.value] = [...picked.value]
    close("ok")
}

/* ---------- CSV ---------- */
const csvBusy = ref(false)
async function exportCsv() {
    csvBusy.value = true
    try {
        const res = await axiosInstance.get(`/statistics/export?${qs.value}`, { responseType: "blob" })
        const name = `skladan-statistics-${new Date().toISOString().slice(0, 10)}.csv`
        const url = URL.createObjectURL(new Blob([res.data], { type: "text/csv;charset=utf-8;" }))
        const link = document.createElement("a")
        link.href = url
        link.download = name
        document.body.appendChild(link)
        link.click()
        link.remove()
        URL.revokeObjectURL(url)
        toast({ type: "success", title: "Файл сохранён", text: `${name} — в загрузках` })
    } catch {
        toast({ type: "error", title: "Не удалось скачать CSV" })
    } finally {
        csvBusy.value = false
    }
}
</script>

<template>
    <UiPage v-if="!allowed" title="Статистика">
        <div class="card card--pad"><UiEmpty art="box" title="Сюда нельзя" text="У вашей роли нет доступа к этому разделу" /></div>
    </UiPage>
    <UiPage v-else-if="isError && !data" title="Статистика">
        <div class="card card--pad"><UiError title="Не удалось загрузить «Статистика»" @retry="refetch()" /></div>
    </UiPage>

    <UiPage v-else-if="isPending" title="Статистика" sub="Загружаем…">
        <div class="stools" aria-hidden="true">
            <UiSk :h="44" :r="12" />
            <div class="stools__f"><UiSk w="140px" :h="44" :r="12" /><UiSk w="140px" :h="44" :r="12" /></div>
        </div>
        <div class="kpis kpis--3 skpis" aria-hidden="true">
            <div v-for="i in 3" :key="i" class="card kpi kpi--bar"><UiSk w="40%" :h="12" /><UiSk w="60%" :h="30" :r="8" /><UiSk w="50%" :h="12" /></div>
        </div>
        <p class="loading-note" role="status"><span class="spin"></span>Считаем статистику…</p>
        <div class="sgrid" aria-hidden="true">
            <section class="card sblk sblk--wide">
                <UiSk w="30%" :h="18" />
                <div class="sk-chart"><span v-for="(hh, i) in [40, 62, 35, 80, 55, 70, 45, 90, 60, 75, 50, 66]" :key="i" class="sk sk-col" :style="{ height: hh + '%', borderRadius: '6px' }"></span></div>
            </section>
            <section v-for="i in 4" :key="i" class="card sblk">
                <UiSk w="44%" :h="18" />
                <div v-for="j in 5" :key="j" style="display: flex; gap: 12px; align-items: center; margin-top: 14px">
                    <UiSk w="36px" :h="42" :r="6" />
                    <div style="flex: 1; display: grid; gap: 8px"><UiSk :w="78 - j * 8 + '%'" :h="12" /><UiSk :w="102 - j * 12 + '%'" :h="8" :r="99" /></div>
                </div>
            </section>
        </div>
    </UiPage>

    <UiPage v-else title="Статистика" :sub="rangeText(range)">
        <template #actions><UiIconBtn v-if="can('export_statistics')" icon="download" label="Скачать CSV" @click="exportCsv" /></template>
        <template #deskActions><UiBtn v-if="can('export_statistics')" label="Скачать CSV" icon="download" kind="secondary" :loading="csvBusy" @click="exportCsv" /></template>

        <div class="stools">
            <UiSeg :model-value="st.p" :options="PERIODS" label="Период" @update:model-value="setPeriod" />
            <div class="stools__f">
                <button type="button" class="fbtn" :class="{ 'is-on': st.groups.length }" @click="openPick('groups')">
                    <UiIcon name="users" :size="18" /><span>Группы</span><b>{{ st.groups.length || "все" }}</b
                    ><UiIcon name="down" :size="16" />
                </button>
                <button type="button" class="fbtn" :class="{ 'is-on': st.products.length }" @click="openPick('products')">
                    <UiIcon name="grid" :size="18" /><span>Товары</span><b>{{ st.products.length || "все" }}</b
                    ><UiIcon name="down" :size="16" />
                </button>
                <UiBtn v-if="st.groups.length || st.products.length" label="Сбросить" icon="x" kind="ghost" size="sm" @click="(st.groups = []), (st.products = [])" />
            </div>
            <div v-if="st.p === 'custom'" class="hdates"><UiField v-model="st.from" label="С" type="date" /><UiField v-model="st.to" label="По" type="date" /></div>
        </div>
        <p v-if="isPlaceholderData" class="loading-note" role="status"><span class="spin"></span>Считаем статистику…</p>
        <div class="kpis kpis--3 skpis">
            <div class="card kpi kpi--bar kpi--p">
                <small>Оборот</small><b>{{ money(data.summary.turnover) }}</b
                ><span>{{ created }} {{ plural(created, ["заказ", "заказа", "заказов"]) }} за период</span>
            </div>
            <div class="card kpi kpi--bar kpi--t">
                <small>Средний чек</small><b>{{ money(data.summary.avgOrderValue) }}</b
                ><span>на заказ группы</span>
            </div>
            <div class="card kpi kpi--bar kpi--s">
                <small>Завершаемость</small><b>{{ data.summary.completionRate }}%</b><span>{{ data.summary.ordersCount.completed }} из {{ created }} получены</span>
            </div>
        </div>

        <div v-if="!created" class="card">
            <UiEmpty art="search" title="За период заказов нет"><UiBtn label="Всё время" kind="secondary" @click="setPeriod('all')" /></UiEmpty>
        </div>
        <template v-else>
            <p v-if="hideFlow" class="listnote listnote--top"><UiIcon name="info" :size="16" class="inl" /> Выбраны группы: «Продажи и поступления» и «Расхождения» скрыты</p>
            <div class="sgrid">
                <section class="card sblk sblk--wide">
                    <header class="sblk__h">
                        <h3>{{ days.byWeek ? "Оборот по неделям" : "Оборот по дням" }}</h3>
                    </header>
                    <StatCols
                        :groups="days.groups"
                        :series="[{ name: 'Оборот', tone: 'primary' }]"
                        sparse
                        :pickable="!days.byWeek"
                        :sel="st.day"
                        cls="cols--days"
                        :label="days.byWeek ? 'Оборот по неделям' : 'Оборот по дням'"
                        @pick="st.day = $event"
                    />
                    <div v-if="!days.byWeek" class="clegend">
                        <span><i class="sw sw--primary"></i>Заказано за день</span>
                    </div>
                    <div v-if="dayPanel" class="calday">
                        <header>
                            <b>{{ dayPanel.title }}</b
                            ><span>{{ dayPanel.text }}</span>
                            <UiBtn label="Скрыть" icon="x" kind="ghost" size="sm" @click="st.day = null" />
                        </header>
                        <StatOrow v-for="o in dayPanel.list" :key="o._id" :o="o" />
                    </div>
                </section>

                <section v-if="!hideFlow" class="card sblk">
                    <header class="sblk__h">
                        <h3>Продажи и поступления</h3>
                        <div class="sblk__s">
                            <span class="pillsum pillsum--s"><UiIcon name="right" :size="14" />Продажи {{ money(totals.s) }}</span
                            ><span class="pillsum pillsum--r"><UiIcon name="left" :size="14" />Поступления {{ money(totals.r) }}</span
                            ><span v-if="totals.d" class="muted">в т. ч. доставка {{ money(totals.d) }}</span>
                        </div>
                    </header>
                    <StatCols
                        :groups="flows"
                        :series="[
                            { name: 'Продажи', tone: 'primary' },
                            { name: 'Поступления', tone: 'success' }
                        ]"
                        label="Продажи и поступления по неделям"
                    />
                    <div class="clegend">
                        <span><i class="sw sw--primary"></i>Продажи</span><span><i class="sw sw--success"></i>Поступления (принято по закупкам)</span>
                    </div>
                </section>

                <section v-if="!hideFlow" class="card sblk">
                    <header class="sblk__h">
                        <h3>Расхождения: получено и продано</h3>
                        <div class="sblk__s"><span class="muted">по убыванию |Δ|</span></div>
                    </header>
                    <div class="disc">
                        <div class="disc__h" aria-hidden="true"><span>Товар</span><span>Получено</span><span>Продано</span><span>Δ</span></div>
                        <div v-for="x in more('d', disc)" :key="x.productId" class="disc__r">
                            <span class="disc__c"><UiCover :product="prod(x)" size="xs" /></span
                            ><span class="disc__n"
                                ><span>{{ x.name }}</span></span
                            ><span class="disc__v"><small>Получено</small>{{ x.received }}</span
                            ><span class="disc__v"><small>Продано</small>{{ x.sold }}</span
                            ><b :class="x.gap > 0 ? 'info' : x.gap < 0 ? 'neg' : 'pos'">{{ x.gap > 0 ? "+" : x.gap < 0 ? "−" : "" }}{{ Math.abs(x.gap) }}</b>
                        </div>
                        <p v-if="!disc.length" class="muted">Нет движения товара за период.</p>
                    </div>
                    <button v-if="disc.length > 8" type="button" class="morebtn" @click="toggle('d')">{{ st.more.d ? "Свернуть" : `Показать все ${disc.length}` }}<UiIcon :name="st.more.d ? 'down' : 'right'" :size="16" /></button>
                </section>

                <section class="card sblk">
                    <header class="sblk__h">
                        <h3>Товары</h3>
                        <div class="sblk__s">
                            <UiSeg
                                v-model="st.mode"
                                :options="[
                                    { value: 'sum', label: '₽' },
                                    { value: 'qty', label: 'шт.' }
                                ]"
                                size="sm"
                                label="Показатель: рубли или штуки"
                            />
                        </div>
                    </header>
                    <ol class="hbars">
                        <li v-for="(x, i) in more('p', prodRows)" :key="x.productId" class="hbar">
                            <span class="hbar__r">{{ i + 1 }}</span
                            ><UiCover :product="prod(x)" size="xs" />
                            <span class="hbar__t"
                                ><span class="hbar__n">{{ x.name || "—" }}</span
                                ><span class="hbar__track"><i class="hbar__f hbar__f--primary" :style="{ width: bar(st.mode === 'sum' ? x.amount : x.quantity, prodRows, st.mode === 'sum' ? 'amount' : 'quantity') }"></i></span
                            ></span>
                            <b class="hbar__v"
                                >{{ st.mode === "sum" ? money(x.amount) : pcs(x.quantity) }}<small>{{ st.mode === "sum" ? pcs(x.quantity) : money(x.amount) }}</small></b
                            >
                        </li>
                    </ol>
                    <button v-if="prodRows.length > 8" type="button" class="morebtn" @click="toggle('p')">{{ st.more.p ? "Свернуть" : `Показать все ${prodRows.length}` }}<UiIcon :name="st.more.p ? 'down' : 'right'" :size="16" /></button>
                </section>

                <section class="card sblk">
                    <header class="sblk__h">
                        <h3>Группы-заказчики</h3>
                        <div class="sblk__s"><span class="muted">по сумме заказов</span></div>
                    </header>
                    <ol class="hbars">
                        <li v-for="(x, i) in more('u', userRows)" :key="x.userId" class="hbar">
                            <span class="hbar__r">{{ i + 1 }}</span
                            ><UiAvatar :user="{ _id: x.userId, name: x.name }" size="sm" />
                            <span class="hbar__t"
                                ><span class="hbar__n">{{ x.name || "—" }}</span
                                ><span class="hbar__track"><i class="hbar__f hbar__f--teal" :style="{ width: bar(x.amount, userRows, 'amount') }"></i></span
                            ></span>
                            <b class="hbar__v"
                                >{{ money(x.amount) }}<small>{{ x.ordersCount }} {{ plural(x.ordersCount, ["заказ", "заказа", "заказов"]) }}</small></b
                            >
                        </li>
                    </ol>
                    <button v-if="userRows.length > 8" type="button" class="morebtn" @click="toggle('u')">{{ st.more.u ? "Свернуть" : `Показать все ${userRows.length}` }}<UiIcon :name="st.more.u ? 'down' : 'right'" :size="16" /></button>
                </section>

                <section class="card sblk sblk--donut sblk--wide">
                    <header class="sblk__h">
                        <h3>Категории</h3>
                        <div class="sblk__s"><span class="muted">доля оборота</span></div>
                    </header>
                    <div class="donut">
                        <svg viewBox="0 0 42 42" class="donut__svg" role="img" aria-label="Распределение по категориям">
                            <circle cx="21" cy="21" r="15.915" fill="none" stroke="var(--surface-2)" stroke-width="5.2" />
                            <circle v-for="s in donut.segs" :key="s.name" cx="21" cy="21" r="15.915" fill="none" :stroke="s.color" stroke-width="5.2" :stroke-dasharray="s.dash" :stroke-dashoffset="s.off">
                                <title>{{ s.name }}: {{ money(s.v) }}</title>
                            </circle>
                        </svg>
                        <div class="donut__c">
                            <b>{{ axisNum(donut.total) }}</b
                            ><small>₽ оборот</small>
                        </div>
                    </div>
                    <ul class="legend">
                        <li v-for="s in donut.segs" :key="s.name">
                            <i :style="{ background: s.color }"></i><span>{{ s.name }}</span
                            ><b>{{ money(s.v) }}</b
                            ><small>{{ s.pct }}%</small>
                        </li>
                    </ul>
                </section>
            </div>

            <section class="card sblk sorders">
                <header class="sblk__h">
                    <h3>
                        Заказы за период<small>{{ orders.length }}</small>
                    </h3>
                </header>
                <div class="sorow sorow--h" aria-hidden="true"><span>№</span><span>Группа</span><span>Дата</span><span>Сумма</span><span>Статус</span><span></span></div>
                <StatOrow v-for="o in orders.slice(0, st.olimit)" :key="o._id" :o="o" />
                <div v-if="orders.length > st.olimit" class="hmore"><UiBtn :label="`Показать ещё ${Math.min(20, orders.length - st.olimit)}`" icon="down" kind="secondary" @click="st.olimit += 20" /></div>
            </section>
        </template>

        <UiSheet v-if="pick" :title="pick === 'groups' ? 'Группы-заказчики' : 'Товары'" size="lg" @close="pick = null">
            <label class="msearch__f" style="margin-bottom: var(--sp-5)"
                ><UiIcon name="search" /><input v-model="pickQ" type="search" name="q" :placeholder="pick === 'groups' ? 'Найти группу' : 'Найти товар'" aria-label="Поиск" autocomplete="off"
            /></label>
            <div class="picks" :data-track="pick === 'groups' ? 'Группа в отборе' : 'Товар в отборе'">
                <UiLazy v-slot="{ item: x }" :items="pickList" :size="30" :reset-key="pick + pickQ">
                    <label class="pick"
                        ><input v-model="picked" type="checkbox" :value="x._id" /><span class="check__box" aria-hidden="true"><UiIcon name="check" :size="16" /></span><UiAvatar v-if="x.user" :user="x.user" size="sm" /><UiCover
                            v-else
                            :product="x.product"
                            size="xs"
                        /><span class="pick__t"
                            >{{ x.name }}<small v-if="x.sub">{{ x.sub }}</small></span
                        ></label
                    >
                </UiLazy>
                <p v-if="!pickList.length" class="muted">Ничего не нашли</p>
            </div>
            <template #footer="{ close }">
                <UiBtn label="Сбросить" kind="secondary" size="lg" @click="picked = []" />
                <UiBtn :label="picked.length ? `Показать: ${picked.length}` : 'Показать все'" icon="check" size="lg" @click="applyPick(close)" />
            </template>
        </UiSheet>
    </UiPage>

    <UiAside v-if="allowed && !isPending" name="hint" title="Заказ из статистики">
        <div class="cartempty">
            <svg class="lineart" viewBox="0 0 220 150" aria-hidden="true">
                <g class="draw">
                    <path pathLength="1" d="M30 124V34M30 124h164" />
                    <path pathLength="1" d="M50 108V84h22v24M86 108V58h22v50M122 108V72h22v36M158 108V46h22v62" />
                    <path pathLength="1" class="thin" d="M30 64h164M30 94h164" />
                    <path pathLength="1" class="gold" d="M169 22l9 9-9 9-9-9z" />
                </g>
            </svg>
            <b>Нажмите на заказ</b>
        </div>
    </UiAside>
</template>
