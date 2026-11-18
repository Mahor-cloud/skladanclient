<script setup>
/**
 * Copyright 2026 Lord_mahor
 * Licensed under Apache 2.0
 */
import { useSession } from "@/composables/useSession"
import { plural, time } from "@/domain/format"
import { pid } from "@/domain/stock"
import axiosInstance from "@/service/axios"
import { useOrderList, useProducts, usePurchases } from "@/service/queries"
import { paneSel, peek, UiAvatar, UiBtn, UiChip, UiCoverStack, UiEmpty, UiError, UiField, UiIcon, UiPage, UiSeg, UiSk } from "@/ui"
import { useInfiniteQuery } from "@tanstack/vue-query"
import { computed, ref, watch, watchEffect } from "vue"
import { RouterLink } from "vue-router"
import { byDay, eventGroup, eventKind, eventLabel, GROUPS, hist as h, histFilter, histRange, PERIODS, refNumber, STEP } from "./feed"

const { can } = useSession()
const allowed = computed(() => can("view_change_history"))

// Весь период страницами по 500 (больше сервер не отдаёт): тип событий, поиск и счётчики считаются по всей ленте периода.
const range = computed(() => histRange(h))
const { data, isPending, isError, isFetching, hasNextPage, fetchNextPage, refetch } = useInfiniteQuery({
    queryKey: computed(() => ["history", range.value.from ?? "", range.value.to ?? ""]),
    queryFn: ({ pageParam }) => axiosInstance.get("/change-history", { params: { page: pageParam, limit: 500, ...range.value } }),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.data.page < last.data.pages ? last.data.page + 1 : undefined),
    staleTime: 1000 * 60 * 5,
    enabled: allowed
})
watchEffect(() => {
    if (hasNextPage.value && !isFetching.value && !isError.value) fetchNextPage()
})
const ready = ref(!!data.value)
watch(data, (d) => d && (ready.value = true))

const items = computed(() => data.value?.pages.flatMap((p) => p.data.items) ?? [])
const total = computed(() => data.value?.pages[0]?.data.total ?? 0)
const counts = computed(() => {
    const c = { "": total.value }
    for (const i of items.value) c[eventGroup(i.changeType)] = (c[eventGroup(i.changeType)] || 0) + 1
    return c
})
const list = computed(() => histFilter(items.value, h))
const shown = computed(() => list.value.slice(0, h.limit))
const of = computed(() => (!h.g && !h.q.trim() ? Math.max(total.value, list.value.length) : list.value.length))
const loading = computed(() => isPending.value || (!list.value.length && hasNextPage.value))
watch(
    () => [h.p, h.g, h.q, h.from, h.to],
    () => (h.limit = STEP)
)
const reset = () => Object.assign(h, { g: "", p: "month", q: "", from: "", to: "", limit: STEP })
const RECENT_PERIODS = ["day", "week", "month"]

// Заказ и закупка из записи: номер есть только в тексте, поэтому сверяемся со списками заказов раздела «Заказы»:
// за день, неделю и месяц хватает последних 90 дней, полный список — только для «Всё время» и своего периода.
const { data: orders } = useOrderList(
    computed(() => !RECENT_PERIODS.includes(h.p)),
    allowed
)
const { data: purchases } = usePurchases()
const { data: products } = useProducts()
const UNKNOWN = { _id: "x", name: "?", category: "" }
const maps = computed(() => ({
    o: new Map((orders.value || []).map((o) => [String(o.orderNumber), o])),
    pu: new Map((purchases.value || []).map((p) => [String(p.purchaseNumber), p])),
    p: new Map((products.value || []).map((p) => [String(p._id), p]))
}))
const days = computed(() =>
    byDay(shown.value).map((d) => ({
        ...d,
        items: d.items.map((e) => {
            const n = refNumber(e)
            const o = n.order && maps.value.o.get(n.order)
            const pu = n.purchase && maps.value.pu.get(n.purchase)
            // Заказ открывается справа (на телефоне — листом), не уводя из истории: адрес и фильтры остаются. Закупка — своей страницей.
            const tag = o ? "button" : pu ? RouterLink : "div"
            return { e, o, tag, to: pu ? { name: "purchase", params: { id: pu._id } } : undefined, kind: eventKind(e.changeType), label: eventLabel(e.changeType), stack: (o || pu)?.items?.map((it) => maps.value.p.get(pid(it)) || UNKNOWN) }
        })
    }))
)
</script>

<template>
    <UiPage v-if="!allowed" title="История">
        <div class="card card--pad"><UiEmpty art="box" title="Сюда нельзя" text="У вашей роли нет доступа к этому разделу" /></div>
    </UiPage>
    <UiPage v-else-if="isError && !data" title="История">
        <div class="card card--pad"><UiError title="Не удалось загрузить «История»" @retry="refetch()" /></div>
    </UiPage>
    <UiPage v-else title="История" :sub="ready ? '' : 'Загружаем…'">
        <div v-if="ready" class="htools">
            <div class="htools__row">
                <UiSeg v-model="h.p" :options="PERIODS" label="Период" />
                <form class="msearch__f lsearch" role="search" @submit.prevent="$event.target.querySelector('input').blur()">
                    <UiIcon name="search" /><input v-model="h.q" type="search" name="q" placeholder="Поиск: номер, товар, имя" aria-label="Поиск: номер, товар, имя" autocomplete="off" />
                    <button v-if="h.q" type="button" class="msearch__x" aria-label="Очистить поиск" @click="h.q = ''"><UiIcon name="x" :size="18" /></button>
                </form>
            </div>
            <div v-if="h.p === 'custom'" class="hdates"><UiField v-model="h.from" label="С" type="date" /><UiField v-model="h.to" label="По" type="date" /></div>
            <div class="filterbar" role="group" aria-label="Тип событий">
                <UiChip v-for="(label, g) in GROUPS" :key="g" :label="label" :count="isPending ? null : counts[g] || 0" :active="h.g === g" @click="h.g = g" />
            </div>
        </div>
        <div v-else class="htools">
            <div class="htools__row"><UiSk :h="44" :r="12" /><UiSk :h="48" :r="14" /></div>
            <div class="filterbar"><UiSk v-for="(w, i) in [120, 90, 150, 90, 140, 90]" :key="i" :w="w + 'px'" :h="40" :r="99" /></div>
        </div>

        <div id="h-feed">
            <template v-if="loading">
                <p class="loading-note" role="status"><span class="spin"></span>Загружаем историю…</p>
                <section v-for="i in 2" :key="i" class="hday" aria-hidden="true">
                    <h3 class="hday__h"><UiSk w="110px" :h="16" /></h3>
                    <div class="card hday__list">
                        <div v-for="j in 4" :key="j" class="hit">
                            <UiSk w="40px" :h="14" /><span class="hit__dot"></span><span class="hit__b"><UiSk w="46%" :h="14" /><UiSk w="86%" :h="12" /></span>
                        </div>
                    </div>
                </section>
            </template>
            <div v-else-if="!items.length && h.p === 'all'" class="card"><UiEmpty art="box" title="Нет записей" /></div>
            <div v-else-if="!list.length" class="card">
                <UiEmpty art="search" title="Нет записей"
                    ><UiBtn v-if="!h.g && !h.q.trim() && h.p === 'month'" label="Всё время" kind="secondary" @click="h.p = 'all'" /><UiBtn v-else label="Сбросить фильтры" kind="secondary" @click="reset"
                /></UiEmpty>
            </div>
            <template v-else>
                <section v-for="d in days" :key="d.title" class="hday">
                    <h3 class="hday__h">
                        <span>{{ d.title }}</span
                        ><small>{{ d.items.length }} {{ plural(d.items.length, ["событие", "события", "событий"]) }}</small>
                    </h3>
                    <div class="card hday__list">
                        <component
                            :is="r.tag"
                            v-for="r in d.items"
                            :key="r.e._id"
                            :type="r.o ? 'button' : undefined"
                            :to="r.to"
                            class="hit"
                            :class="['hit--' + r.kind, { 'is-sel': r.o && paneSel('/shop/order/' + r.o._id) }]"
                            @click="r.o && peek({ name: 'order', params: { id: r.o._id } })"
                        >
                            <time :datetime="new Date(r.e.changeDate).toISOString()">{{ time(r.e.changeDate) }}</time
                            ><span class="hit__dot" aria-hidden="true"></span>
                            <span class="hit__b">
                                <span class="hit__top"
                                    ><UiAvatar :user="r.e.user" size="sm" /><b>{{ r.e.user?.name || "Система" }}</b
                                    ><span class="htype" :class="'htype--' + r.kind">{{ r.label }}</span></span
                                >
                                <span class="hit__d">{{ r.e.description }}</span>
                            </span>
                            <span v-if="r.stack" class="hit__thumb"><UiCoverStack :products="r.stack" :max="3" /></span>
                            <UiIcon v-if="r.tag !== 'div'" name="right" :size="18" class="hit__chev" />
                        </component>
                    </div>
                </section>
                <div class="hmore">
                    <span>Показано {{ shown.length }} из {{ of }} {{ plural(of, ["записи", "записей", "записей"]) }}</span>
                    <UiBtn v-if="shown.length < list.length" :label="`Показать ещё ${Math.min(STEP, list.length - shown.length)}`" icon="down" kind="secondary" @click="h.limit += STEP" />
                </div>
            </template>
        </div>
    </UiPage>
</template>
