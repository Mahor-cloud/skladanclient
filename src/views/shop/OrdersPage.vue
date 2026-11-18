<script setup>
/**
 * Copyright 2026 Lord_mahor
 * Licensed under Apache 2.0
 */
import { useSession } from "@/composables/useSession"
import { date, money, plural } from "@/domain/format"
import { orderDiff, orderPerms, orderStatus, orderTotal, orderTurn, ownerId, STATUS } from "@/domain/orders"
import { pid } from "@/domain/stock"
import { useInventoryLock, useOrderList, useProducts } from "@/service/queries"
import { UiAside, UiBtn, UiChip, UiCover, UiEmpty, UiError, UiIcon, UiIconBtn, UiLazy, UiPage, UiSk, UiSkRow } from "@/ui"
import { computed, watch } from "vue"
import { useRoute, useRouter } from "vue-router"
import { repeatOrder, useShortages } from "./api"
import OrderCard from "./OrderCard.vue"
import OrderRow from "./OrderRow.vue"
import { FILTERS, view } from "./orders"
import OrdersSummary from "./OrdersSummary.vue"
import SkOrder from "./SkOrder.vue"

// Список заказов: у заказчика — карточки своих заказов, у служащих — строки всех заказов местности и сводка «Сейчас важно».
const route = useRoute()
const router = useRouter()
const { user, can, isStaff, roleTitle, plain } = useSession()
const { data: products } = useProducts()
const { frozen } = useInventoryLock()

// По умолчанию — незавершённые и за 90 дней; «Показать все» грузит весь список (прежний остаётся на экране, пока грузится).
// Ключи и форма кэша прежние: их читает и каталог.
const { data, isPending, isError, refetch } = useOrderList(computed(() => view.all))
const { data: shortageData } = useShortages({ refetchInterval: 60_000 })
const shortages = computed(() => shortageData.value || [])
const blocked = computed(() => new Set(shortages.value.flatMap((s) => s.orderIds.map(String))))
const blockedOrders = computed(() => blocked.value.size)

const byId = computed(() => new Map((products.value || []).map((p) => [String(p._id), p])))
const priceOf = (id) => byId.value.get(id)?.price
const coversOf = (o) => o.items.map((it) => byId.value.get(pid(it)) || { _id: pid(it), name: "?", category: "" })
const myId = computed(() => String(user.value?._id))

const rows = computed(() => {
    const s = plain.value
    // Заказчик видит свои заказы; наблюдатель без права заказывать своих не имеет — видит все, только для просмотра, как раньше.
    return (data.value || [])
        .filter((o) => isStaff.value || !can("create_orders") || ownerId(o) === myId.value)
        .map((o) => {
            const env = { deficit: !o.isCompleted && blocked.value.has(String(o._id)), frozen: frozen.value }
            return { _id: o._id, o, st: orderStatus(o), def: env.deficit, diff: orderDiff(o), total: orderTotal(o, priceOf), turn: orderTurn(o, s, env), pm: orderPerms(o, s, env) }
        })
})

/* ---------- Фильтр по статусу, поиск ---------- */
const pay = computed(() => isStaff.value && can("approve-payment"))
const stock = computed(() => isStaff.value && can("edit_products"))
const keys = computed(() => (isStaff.value ? ["paid", "ready", "new", "active", "done"] : ["active", "done"]))
watch(
    () => route.query.f,
    (f) => FILTERS[f] && (view.f = f),
    { immediate: true }
)
// Без выбора: казначею — оплаты к подтверждению, кладовщику — выдача, остальным — все активные.
const filter = computed(() => (keys.value.includes(view.f) ? view.f : !isStaff.value ? "active" : pay.value && !stock.value ? "paid" : stock.value && !pay.value ? "ready" : "active"))
function setFilter(f) {
    view.f = f
    if (route.query.f) router.replace({ query: { ...route.query, f: undefined } })
}
const counts = computed(() => Object.fromEntries(keys.value.map((k) => [k, rows.value.filter((r) => FILTERS[k].fn(r.o)).length])))
const found = computed(() => {
    const terms = view.q
        .trim()
        .toLowerCase()
        .split(/\s+/)
        .filter(Boolean)
        .map((t) => t.replace(/^#/, "№"))
    let list = rows.value.filter((r) => FILTERS[filter.value].fn(r.o))
    if (terms.length)
        list = list.filter((r) => {
            const names = r.o.items.map((it) => byId.value.get(pid(it))?.name || "")
            const hay = [r.o.orderNumber, "№" + r.o.orderNumber, r.o.user?.name || "", STATUS[r.st].label, r.turn.short, r.total, money(r.total), date(r.o.orderDate), ...names].join(" ").toLowerCase()
            return terms.every((t) => hay.includes(t))
        })
    const mineFirst = isStaff.value && filter.value !== "done"
    return list.sort((a, b) => (mineFirst ? b.turn.mine - a.turn.mine : 0) || b.o.orderDate - a.o.orderDate)
})
const resetKey = computed(() => filter.value + "~" + view.q)
const sub = computed(() => {
    if (!isStaff.value) return `Группа «${user.value?.name}»`
    const act = rows.value.filter((r) => !r.o.isCompleted)
    const mine = act.filter((r) => r.turn.mine).length
    return `${act.length} ${plural(act.length, ["активный", "активных", "активных"])} · ${mine} ${plural(mine, ["ждёт", "ждут", "ждут"])} вашего действия`
})
</script>

<template>
    <UiPage v-if="!can('view_orders')" title="Заказы">
        <div class="card card--pad"><UiEmpty art="box" title="Сюда нельзя" text="У вашей роли нет доступа к этому разделу" /></div>
    </UiPage>
    <UiPage v-else-if="isError && !data" title="Заказы">
        <div class="card card--pad"><UiError title="Не удалось загрузить «Заказы»" @retry="refetch()" /></div>
    </UiPage>
    <UiPage v-else-if="isPending" title="Заказы" sub="Загружаем…">
        <div class="listtools">
            <div class="filterbar"><UiSk v-for="w in [150, 110, 96, 120]" :key="w" :w="w + 'px'" :h="40" :r="99" /></div>
            <UiSk :h="48" :r="14" />
        </div>
        <p class="loading-note" role="status"><span class="spin"></span>Загружаем заказы…</p>
        <div v-if="isStaff" class="card olines" aria-busy="true"><UiSkRow v-for="i in 8" :key="i" /></div>
        <div v-else class="olist olist--cards" aria-busy="true"><SkOrder v-for="i in 4" :key="i" /></div>
    </UiPage>
    <template v-else>
        <UiPage title="Заказы" :sub="sub">
            <template v-if="can('create_orders')" #actions><UiIconBtn icon="grid" label="В каталог" :to="{ name: 'catalog' }" /></template>
            <template v-if="can('create_orders')" #deskActions><UiBtn label="В каталог" icon="grid" kind="secondary" :to="{ name: 'catalog' }" /></template>
            <template v-if="rows.length">
                <OrdersSummary inline :rows="rows" :shortages="shortages" :products="byId" @filter="setFilter" />
                <div v-if="isStaff && shortages.length" class="deficits">
                    <details>
                        <summary>
                            <UiIcon name="alert" :size="22" />
                            <b>Дефицит по {{ shortages.length }} {{ plural(shortages.length, ["товару", "товарам", "товарам"]) }}: {{ blockedOrders }} {{ plural(blockedOrders, ["заказ нельзя", "заказа нельзя", "заказов нельзя"]) }} завершить</b>
                            <UiIcon name="down" />
                        </summary>
                        <ul>
                            <li v-for="s in shortages" :key="s.product">
                                <UiCover :product="byId.get(s.product) || { _id: s.product, name: s.productName, category: '' }" size="xs" />
                                <span
                                    ><b>{{ s.productName }}</b
                                    ><small>Требуется {{ s.required }}, на складе {{ s.inStock }} · заказы {{ s.orderNumbers.map((n) => "№" + n).join(", ") }}. Пополните склад или скорректируйте заказы.</small></span
                                >
                            </li>
                        </ul>
                    </details>
                </div>
            </template>
            <div class="listtools">
                <div class="filterbar" role="group" aria-label="Фильтр по статусу">
                    <UiChip v-for="k in keys" :key="k" :label="FILTERS[k].label" :count="counts[k]" :active="filter === k" :tone="k === 'paid' && pay && !stock ? 'accent' : ''" @click="setFilter(k)" />
                </div>
                <form class="msearch__f" role="search" style="height: 48px" @submit.prevent="$event.target.querySelector('input').blur()">
                    <UiIcon name="search" />
                    <input v-model="view.q" type="search" name="oq" :placeholder="isStaff ? 'Номер, группа, статус, сумма, товар' : 'Номер, статус, сумма или товар'" aria-label="Поиск заказов" autocomplete="off" />
                </form>
            </div>
            <div id="orders-res">
                <div v-if="!rows.length" class="card">
                    <UiEmpty art="box" title="Заказов пока нет">
                        <UiBtn label="Перейти в каталог" icon="grid" :to="{ name: 'catalog' }" />
                        <UiBtn v-if="can('cabinet_access')" label="Заполнить из «Моего склада»" icon="box" kind="secondary" :to="{ name: 'cabinet' }" />
                    </UiEmpty>
                </div>
                <div v-else-if="!found.length && view.q.trim()" class="card">
                    <UiEmpty art="search" title="Ничего не нашли"><UiBtn label="Сбросить поиск" kind="secondary" @click="view.q = ''" /></UiEmpty>
                </div>
                <div v-else-if="!found.length" class="card">
                    <UiEmpty art="box" :title="filter === 'paid' ? 'Подтверждать нечего' : filter === 'ready' ? 'Выдавать нечего' : 'Здесь пусто'">
                        <UiBtn v-if="filter !== 'active'" label="Все активные" kind="secondary" @click="setFilter('active')" />
                    </UiEmpty>
                </div>
                <div v-else-if="isStaff" class="card olines">
                    <UiLazy v-slot="{ item }" :items="found" :size="14" :reset-key="resetKey"><OrderRow :row="item" /></UiLazy>
                </div>
                <div v-else class="olist olist--cards">
                    <UiLazy :items="found" :size="8" :reset-key="resetKey">
                        <template #default="{ item }"><OrderCard :row="item" :covers="coversOf(item.o)" @repeat="repeatOrder($event, products)" /></template>
                        <template #sk><SkOrder /><SkOrder /></template>
                    </UiLazy>
                </div>
            </div>
            <p v-if="!view.all && (filter === 'done' || !rows.length)" class="listnote">
                <span>Показаны завершённые за 3 месяца.</span>
                <UiBtn label="Показать все" icon="history" kind="ghost" size="sm" @click="view.all = true" />
            </p>
        </UiPage>
        <UiAside v-if="rows.length" name="summary" title="Сейчас важно" :sub="`${roleTitle} · ${user?.name}`">
            <OrdersSummary :rows="rows" :shortages="shortages" :products="byId" @filter="setFilter" />
        </UiAside>
    </template>
    <RouterView />
</template>
