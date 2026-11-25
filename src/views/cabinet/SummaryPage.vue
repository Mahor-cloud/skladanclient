<script setup>
/**
 * Copyright 2026 Lord_mahor
 * Licensed under Apache 2.0
 */
import { isDesk, isRoomy } from "@/composables/useBreakpoint"
import { useSession } from "@/composables/useSession"
import { money, plural, positions } from "@/domain/format"
import axiosInstance from "@/service/axios"
import { useProducts } from "@/service/queries"
import { UiAvatar, UiChip, UiCover, UiEmpty, UiError, UiIcon, UiLazy, UiPage, UiSelect, UiSk, UiSkRow } from "@/ui"
import { useQuery } from "@tanstack/vue-query"
import { computed, onBeforeUnmount, reactive, ref } from "vue"
import { useRoute } from "vue-router"
import { cabinetGroups, sumBar } from "./cabinet"

// Сводка складов групп: «По товарам» — право view_cabinet_summary, «По группам» — view_all_cabinets. Только просмотр.
const route = useRoute()
const { can } = useSession()
const canP = computed(() => can("view_cabinet_summary"))
const canG = computed(() => can("view_all_cabinets"))
const tab = computed(() => ((route.query.tab === "groups" && canG.value) || !canP.value ? "groups" : "products"))
const narrow = computed(() => isDesk.value && !isRoomy.value)
const { data: products } = useProducts()
const byId = computed(() => new Map((products.value || []).map((p) => [String(p._id), p])))

// Ключи и форма кэша прежние: «Цели представителей» в форме товара читают тот же ["cabinet-summary"] — сам массив.
const sumQ = useQuery({ queryKey: ["cabinet-summary"], queryFn: async () => (await axiosInstance.get("/cabinet/summary")).data, staleTime: 30_000, enabled: canP })
const allQ = useQuery({ queryKey: ["cabinet-all"], queryFn: async () => (await axiosInstance.get("/cabinet/all")).data, staleTime: 30_000, enabled: canG })
const summary = computed(() => sumQ.data.value || [])
const groups = computed(() => cabinetGroups(allQ.data.value))
const loading = computed(() => (canP.value && sumQ.isPending.value) || (tab.value === "groups" && allQ.isPending.value))
const failed = computed(() => (canP.value && sumQ.isError.value && !sumQ.data.value) || (tab.value === "groups" && allQ.isError.value && !allQ.data.value))
function retry() {
    if (canP.value) sumQ.refetch()
    if (canG.value) allQ.refetch()
}

const defSum = computed(() => summary.value.reduce((s, r) => s + Math.max(0, r.totalDeficit || 0) * (r.price || 0), 0))
const defN = computed(() => summary.value.filter((r) => r.totalDeficit > 0).length)
const headText = computed(() => {
    const t = `${defN.value} ${plural(defN.value, ["товар", "товара", "товаров"])}`
    const n = groups.value.length
    return allQ.data.value ? `${t} · ${n} ${plural(n, ["группа ведёт", "группы ведут", "групп ведут"])} «Мой склад»` : t
})

const qIn = ref("")
const q = ref("")
let qTimer = 0
function onQ(v, now) {
    qIn.value = v
    clearTimeout(qTimer)
    if (now) q.value = v
    else qTimer = setTimeout(() => (q.value = v), 250)
}
onBeforeUnmount(() => clearTimeout(qTimer))

/* ---------- По товарам ---------- */
const sort = ref("def")
const SORTS = [
    { value: "def", label: "Сначала дефицит" },
    { value: "goal", label: "Больше целей" },
    { value: "n", label: "Больше групп" },
    { value: "name", label: "По названию" },
    { value: "kind", label: "По виду" },
    { value: "price", label: "Дороже" },
    { value: "stock", label: "Больше на складе" },
    { value: "target", label: "Больше цель товара" },
    { value: "have", label: "Больше есть у групп" },
    { value: "ord", label: "Больше в заказах" }
]
const prodList = computed(() => {
    const s = q.value.trim().toLowerCase()
    const l = []
    for (const r of summary.value) {
        if (!r.totalBaseQty && !r.totalCurrentQty && !r.totalInOrders) continue
        if (s && !`${r.name || ""} ${r.category || ""}`.toLowerCase().includes(s)) continue
        const p = byId.value.get(String(r.productId))
        l.push({
            _id: String(r.productId),
            r,
            p: p || { _id: String(r.productId), name: r.name || "", category: r.category },
            stock: r.stockQty || 0,
            bar: sumBar(r.totalBaseQty, r.totalCurrentQty, r.totalInOrders, r.totalDeficit)
        })
    }
    const by = {
        def: (a, b) => b.r.totalDeficit - a.r.totalDeficit || b.r.totalBaseQty - a.r.totalBaseQty,
        goal: (a, b) => b.r.totalBaseQty - a.r.totalBaseQty,
        n: (a, b) => b.r.usersCount - a.r.usersCount,
        name: (a, b) => a.p.name.localeCompare(b.p.name, "ru"),
        kind: (a, b) => String(a.r.category || "").localeCompare(String(b.r.category || ""), "ru"),
        price: (a, b) => (b.r.price || 0) - (a.r.price || 0),
        stock: (a, b) => b.stock - a.stock,
        target: (a, b) => (b.r.productTargetQty || 0) - (a.r.productTargetQty || 0),
        have: (a, b) => b.r.totalCurrentQty - a.r.totalCurrentQty,
        ord: (a, b) => (b.r.totalInOrders || 0) - (a.r.totalInOrders || 0)
    }[sort.value]
    return l.sort(by)
})
const SCOLS = "52px minmax(0,2.2fr) 82px 84px 76px 84px 84px 96px 96px 64px"
const SHEAD = ["", "Товар", "Цена", "На складе", "Цель товара", "Σ целей", "Σ есть", "Σ в заказах", "Σ дефицит", "Групп"]
// В средней колонке: цена и число групп уходят в подпись.
const SCOLS_N = "48px minmax(0,1fr) 72px 64px 92px 92px"
const SHEAD_N = ["", "Товар", "Σ целей", "Σ есть", "Σ в заказах", "Σ дефицит"]

/* ---------- По группам ---------- */
const sel = ref([])
const opened = reactive(new Set())
const filtered = computed(() => sel.value.length > 0 || !!q.value.trim())
function pick(id) {
    sel.value = !id ? [] : sel.value.includes(id) ? sel.value.filter((x) => x !== id) : [...sel.value, id]
}
// Раскрытые вручную — запоминаем; раскрытие фильтром или поиском не считается.
function onToggle(id, ev) {
    if (filtered.value) return
    if (ev.target.open) opened.add(id)
    else opened.delete(id)
}
const cards = computed(() => {
    const s = q.value.trim().toLowerCase()
    const out = []
    for (const g of groups.value) {
        if (sel.value.length && !sel.value.includes(g.user._id)) continue
        let items = g.items
        if (s) {
            const hitUser = `${g.user.name} ${g.user.login}`.toLowerCase().includes(s)
            items = items.filter((i) => hitUser || `${i.name} ${i.x.product?.category || ""} ${i.x.note || ""}`.toLowerCase().includes(s))
            if (!items.length) continue
        }
        const def = items.filter((i) => i.def)
        out.push({ ...g, items, defN: def.length, defS: def.reduce((a, i) => a + (i.x.product ? i.def * (i.x.product.price || 0) : 0), 0) })
    }
    return out
})
const GCOLS = "40px minmax(0,2.4fr) 80px 80px 96px minmax(0,1fr)"
</script>

<template>
    <UiPage v-if="!canP && !canG" title="Сводка складов">
        <div class="card card--pad"><UiEmpty art="box" title="Сюда нельзя" text="У вашей роли нет доступа к этому разделу" /></div>
    </UiPage>
    <UiPage v-else-if="failed" title="Сводка складов">
        <div class="card card--pad"><UiError title="Не удалось загрузить «Сводку складов»" @retry="retry" /></div>
    </UiPage>
    <UiPage v-else-if="loading" title="Сводка складов" sub="Загружаем…">
        <div class="sumhead" aria-busy="true">
            <div class="card sumhead__def"><UiSk w="50%" :h="12" /><UiSk w="40%" :h="30" :r="8" /><UiSk w="70%" :h="12" /></div>
            <div class="card sumhead__legend"><UiSk w="90%" :h="14" /></div>
        </div>
        <div class="ptabs"><UiSk w="130px" :h="44" :r="12" /><UiSk w="130px" :h="44" :r="12" /></div>
        <p class="loading-note" role="status"><span class="spin"></span>Собираем склады групп…</p>
        <div class="card tbl tbl--sk"><UiSkRow v-for="i in 8" :key="i" /></div>
    </UiPage>
    <UiPage v-else title="Сводка складов">
        <div v-if="canP" class="sumhead">
            <div class="card sumhead__def">
                <small>Общий дефицит групп</small><b>{{ money(defSum) }}</b
                ><span>{{ headText }}</span>
            </div>
            <div class="card sumhead__legend">
                <span><i class="lg lg--have"></i>есть у групп</span><span><i class="lg lg--ord"></i>в заказах</span><span><i class="lg lg--def"></i>дефицит</span><small>Полоса = сумма целей групп</small>
            </div>
        </div>
        <nav class="ptabs" aria-label="Разделы страницы">
            <RouterLink v-if="canP" class="ptab" :class="{ 'is-on': tab === 'products' }" :aria-current="tab === 'products' ? 'page' : null" :to="{ query: { ...route.query, tab: undefined } }"
                ><UiIcon name="grid" :size="18" /><span>По товарам</span></RouterLink
            >
            <RouterLink v-if="canG" class="ptab" :class="{ 'is-on': tab === 'groups' }" :aria-current="tab === 'groups' ? 'page' : null" :to="{ query: { ...route.query, tab: 'groups' } }"
                ><UiIcon name="users" :size="18" /><span>По группам</span><b v-if="allQ.data.value">{{ groups.length }}</b></RouterLink
            >
        </nav>

        <template v-if="tab === 'products'">
            <div class="listtools listtools--sum">
                <UiSelect v-model="sort" :options="SORTS" />
                <form class="msearch__f lsearch" role="search" @submit.prevent="$event.target.querySelector('input').blur()">
                    <UiIcon name="search" :size="20" />
                    <input type="search" name="q" placeholder="Найти товар" aria-label="Найти товар" :value="qIn" autocomplete="off" @input="onQ($event.target.value)" />
                    <button v-if="qIn" type="button" class="msearch__x" aria-label="Очистить поиск" @click="onQ('', true)"><UiIcon name="x" :size="18" /></button>
                </form>
            </div>
            <div v-if="prodList.length" class="card tbl tbl--sum" :style="{ '--cols': narrow ? SCOLS_N : SCOLS }">
                <div class="tbl__h" aria-hidden="true">
                    <span v-for="(h, i) in narrow ? SHEAD_N : SHEAD" :key="i">{{ h }}</span>
                </div>
                <UiLazy v-slot="{ item: { r, p, stock, bar } }" :items="prodList" :size="24" :reset-key="`${q}~${sort}`">
                    <div class="trow trow--sum">
                        <span class="trow__cov"><UiCover :product="p" size="sm" /></span>
                        <div class="trow__main">
                            <span class="trow__n">{{ r.name }}</span>
                            <span class="trow__m"
                                >{{ r.category }} · {{ money(r.price) }}<span :class="{ mob: !narrow }"> · {{ r.usersCount }} {{ plural(r.usersCount, ["группа", "группы", "групп"]) }}</span></span
                            >
                            <span class="sbar" role="img" :aria-label="`Целей ${r.totalBaseQty}, есть ${r.totalCurrentQty}, в заказах ${r.totalInOrders}, дефицит ${r.totalDeficit}`"
                                ><i class="lg--have" :style="{ width: bar.hv + '%' }"></i><i class="lg--ord" :style="{ width: bar.od + '%' }"></i><i class="lg--def" :style="{ width: bar.df + '%' }"></i></span
                            ><span class="mob sbar__n">цели {{ r.totalBaseQty }} · есть {{ r.totalCurrentQty }} · в заказах {{ r.totalInOrders }}</span>
                        </div>
                        <template v-if="!narrow">
                            <span class="trow__c">{{ money(r.price) }}</span>
                            <span class="trow__c"
                                ><template v-if="stock > 0">{{ stock }}</template
                                ><span v-else class="muted">0</span></span
                            >
                            <span class="trow__c">{{ r.productTargetQty || "—" }}</span>
                        </template>
                        <span class="trow__c"
                            ><b>{{ r.totalBaseQty }}</b></span
                        >
                        <span class="trow__c">{{ r.totalCurrentQty }}</span>
                        <span class="trow__c">{{ r.totalInOrders || "—" }}</span>
                        <div class="trow__ctl"></div>
                        <span class="trow__c"
                            ><span v-if="r.totalDeficit > 0" class="tag tag--warning">{{ r.totalDeficit }}</span
                            ><span v-else class="muted">—</span></span
                        >
                        <span v-if="!narrow" class="trow__c">{{ r.usersCount }}</span>
                        <span class="trow__side"
                            ><span class="mob"
                                ><span v-if="r.totalDeficit > 0" class="tag tag--warning">дефицит {{ r.totalDeficit }}</span
                                ><span v-else class="okmark"><UiIcon name="check" :size="16" />ок</span></span
                            ></span
                        >
                    </div>
                </UiLazy>
            </div>
            <div v-else class="card"><UiEmpty art="search" title="Ничего не нашли" /></div>
        </template>

        <template v-else>
            <div class="listtools listtools--sum">
                <div class="filterbar" role="group" aria-label="Группы">
                    <UiChip label="Все группы" :active="!sel.length" @click="pick('')" />
                    <UiChip v-for="g in groups" :key="g.user._id" :label="g.user.name" :active="sel.includes(g.user._id)" data-track="Группа" @click="pick(g.user._id)" />
                </div>
                <form class="msearch__f lsearch" role="search" @submit.prevent="$event.target.querySelector('input').blur()">
                    <UiIcon name="search" :size="20" />
                    <input type="search" name="q" placeholder="Товар или группа" aria-label="Товар или группа" :value="qIn" autocomplete="off" @input="onQ($event.target.value)" />
                    <button v-if="qIn" type="button" class="msearch__x" aria-label="Очистить поиск" @click="onQ('', true)"><UiIcon name="x" :size="18" /></button>
                </form>
            </div>
            <div class="grps">
                <details v-for="g in cards" :key="g.user._id" class="card grp" :open="filtered || opened.has(g.user._id)" @toggle="onToggle(g.user._id, $event)">
                    <summary data-track="Карточка группы">
                        <UiAvatar :user="g.user" />
                        <span class="grp__t"
                            ><b>{{ g.user.name }}</b
                            ><small
                                >{{ positions(g.items.length) }} · <span v-if="g.defN" class="acc">дефицит {{ g.defN }} · {{ money(g.defS) }}</span
                                ><template v-else>всего хватает</template></small
                            ></span
                        >
                        <UiIcon name="down" :size="20" class="grp__chev" />
                    </summary>
                    <!-- Тело рисуется только у раскрытой группы: закрытые не держат сотни строк в документе. -->
                    <div v-if="filtered || opened.has(g.user._id)" class="grp__b">
                        <div class="card tbl tbl--grp" :style="{ '--cols': GCOLS }">
                            <div class="tbl__h" aria-hidden="true"><span></span><span>Товар</span><span>Цель</span><span>У них</span><span>Дефицит</span><span>Заметка</span></div>
                            <UiLazy v-slot="{ item: i }" :items="g.items" :size="24">
                                <div class="trow">
                                    <span class="trow__cov"
                                        ><UiCover v-if="i.cov" :product="i.cov" size="xs" /><span v-else class="cover cover--sm cover--own"><UiIcon name="tag" :size="22" /></span
                                    ></span>
                                    <div class="trow__main">
                                        <span class="trow__n"
                                            ><template v-if="i.own"
                                                ><i>{{ i.name }}</i> <span class="muted">(своя)</span></template
                                            ><template v-else>{{ i.name }}</template></span
                                        >
                                        <span class="trow__m"
                                            ><span class="mob">цель {{ i.x.baseQty || 0 }} · у них {{ i.x.currentQty || 0 }}</span></span
                                        >
                                    </div>
                                    <span class="trow__c">{{ i.x.baseQty || 0 }}</span>
                                    <span class="trow__c">{{ i.x.currentQty || 0 }}</span>
                                    <div class="trow__ctl"></div>
                                    <span class="trow__c"
                                        ><span v-if="i.def" class="tag tag--warning">{{ i.def }}</span
                                        ><template v-else>—</template></span
                                    >
                                    <span class="trow__c">{{ i.x.note || "" }}</span>
                                    <span class="trow__side"
                                        ><span class="mob"
                                            ><span v-if="i.def" class="tag tag--warning">−{{ i.def }}</span></span
                                        ></span
                                    >
                                </div>
                            </UiLazy>
                        </div>
                    </div>
                </details>
                <div v-if="!cards.length" class="card"><UiEmpty art="search" title="Ничего не нашли" /></div>
            </div>
        </template>
    </UiPage>
</template>
