<script setup>
/**
 * Copyright 2026 Lord_mahor
 * Licensed under Apache 2.0
 */
import { isDesk } from "@/composables/useBreakpoint"
import { useSession } from "@/composables/useSession"
import { money, plural, positions } from "@/domain/format"
import { orderPerms, orderStatus, orderTotal, orderTurn, ownerId, STATUS } from "@/domain/orders"
import { available, deficit, pid, searchProducts, stockLevel } from "@/domain/stock"
import { useActiveOrders, useIncoming, useInventoryLock, useMsgs, useOrderList, useProducts, usePurchases } from "@/service/queries"
import { paneSel, UiBadge, UiBtn, UiCheck, UiChip, UiEmpty, UiError, UiField, UiIcon, UiIconBtn, UiLazy, UiLogo, UiSeg, UiSheet, UiSk, UiSkRow, UiStatus } from "@/ui"
import { computed, onBeforeUnmount, onMounted, ref, watchEffect } from "vue"
import { useRouter } from "vue-router"
import { filters as f, filtersActive, resetFilters } from "./catalog"
import CartAside from "./CartAside.vue"
import ProductCard from "./ProductCard.vue"
import ProductRow from "./ProductRow.vue"
import SearchSuggest from "./SearchSuggest.vue"
import SkCard from "./SkCard.vue"

const router = useRouter()
const { user, can, isStaff, plain } = useSession()
const { data: products, isPending, isError, refetch } = useProducts({ always: true })
const { data: orders, isLoading: ordersLoading } = useActiveOrders()
const { data: purchases } = usePurchases()
const { data: msgs } = useMsgs()
const { frozen } = useInventoryLock()
const incoming = useIncoming()

const canBuy = computed(() => can("create_orders"))
// Товары правит служащий с правом; «Новый товар» открывает ту же форму, поэтому нужно и право правки.
const canEdit = computed(() => isStaff.value && can("edit_products"))
const canCreate = computed(() => canEdit.value && can("create_product"))
const all = computed(() => products.value || [])
const byId = computed(() => new Map(all.value.map((p) => [String(p._id), p])))

/* ---------- Список: поиск, виды, наличие, цена, сортировка ---------- */
const kinds = computed(() => {
    const m = new Map()
    for (const p of all.value) if (p.category) m.set(p.category, (m.get(p.category) || 0) + 1)
    return [...m].map(([key, count]) => ({ key, count }))
})
const found = computed(() => searchProducts(all.value, f.q, incoming.value))
const list = computed(() => {
    let l = found.value
    if (f.kinds.length) l = l.filter((p) => f.kinds.includes(p.category))
    if (f.avail) l = l.filter((p) => available(p) > 0)
    if (f.incoming) l = l.filter((p) => incoming.value[p._id] > 0)
    if (f.min !== "") l = l.filter((p) => p.price >= +f.min)
    if (f.max !== "") l = l.filter((p) => p.price <= +f.max)
    // Без выбранной сортировки: у служащих порядок склада, у остальных — сначала то, что есть в наличии.
    const sort = f.sort === "default" ? (isStaff.value ? "base" : "stock") : f.sort
    const by = {
        stock: (a, b) => (available(b) > 0) - (available(a) > 0),
        cheap: (a, b) => a.price - b.price,
        expensive: (a, b) => b.price - a.price,
        name: (a, b) => a.name.localeCompare(b.name, "ru"),
        low: (a, b) => available(a) - available(b)
    }[sort]
    return by ? [...l].sort(by) : l
})
const total = computed(() => list.value.length)
const totalText = computed(() => `${total.value} ${plural(total.value, ["товар", "товара", "товаров"])}`)
const nFilters = computed(filtersActive)
// «В наличии» включено и без выбора пользователя: само по себе оно список «суженным» не делает («Мои заказы» и «Вы часто берёте» остаются)
const narrowed = computed(() => !!f.q || nFilters.value - (f.avail ? 1 : 0) > 0)
const view = computed(() => f.view || (canEdit.value ? "list" : "grid"))
const resetKey = computed(() => [f.q, f.kinds.join("|"), f.avail, f.incoming, f.min, f.max, f.sort, view.value].join("~"))
const SORTS = computed(() => [["cheap", "Дешевле"], ["expensive", "Дороже"], ["name", "По названию"], ...(isStaff.value ? [["low", "Меньше осталось"]] : [])])
const VIEWS = [
    { value: "grid", icon: "grid", title: "Плитки" },
    { value: "list", icon: "list", title: "Список" }
]

function toggleKind(k) {
    f.kinds = !k ? [] : f.kinds.includes(k) ? f.kinds.filter((x) => x !== k) : [...f.kinds, k]
}
const digits = (v) => String(v).replace(/\D/g, "")
const PRICES = [
    ["", "50", "до 50"],
    ["50", "200", "50–200"],
    ["200", "", "от 200"]
]
function quickPrice(a, b) {
    const on = f.min === a && f.max === b
    f.min = on ? "" : a
    f.max = on ? "" : b
}
const priceRange = computed(() => {
    const ps = all.value.map((p) => p.price).filter((x) => x > 0)
    return ps.length ? [Math.min(...ps), Math.max(...ps)] : [0, 0]
})
const filtersOpen = ref(false)

/* ---------- Подсказки поиска: что искали, виды, первые совпадения ---------- */
const sugg = ref(false)
const history = ref([])
const hits = computed(() => (f.q.trim() ? found.value.slice(0, 6) : []))
function applySearch(q) {
    f.q = (q || "").trim()
    const low = f.q.toLowerCase()
    if (low && !history.value.includes(low)) history.value = [low, ...history.value].slice(0, 6)
    sugg.value = false
    if (!isDesk.value) document.activeElement?.blur() // спрятать клавиатуру телефона
}
function pickKind(k) {
    f.kinds = [k]
    applySearch("")
}
function openProduct(p) {
    sugg.value = false
    router.push({ name: "product", params: { id: p._id } })
}
const desk = ref(null)
function onDocClick(ev) {
    if (!ev.target.closest(".hsearch, .msearch")) sugg.value = false
}
function onKey(ev) {
    if (ev.key === "/" && isDesk.value && !/input|textarea|select/i.test(document.activeElement.tagName)) {
        ev.preventDefault()
        desk.value?.focus()
    }
}
onMounted(() => {
    document.addEventListener("click", onDocClick)
    document.addEventListener("keydown", onKey)
})
onBeforeUnmount(() => {
    document.removeEventListener("click", onDocClick)
    document.removeEventListener("keydown", onKey)
})

/* ---------- Сводка склада (служащие) ---------- */
const kpi = computed(() => {
    const price = (it) => byId.value.get(pid(it))?.price || 0
    // У оплаченного заказа и закупки сумма зафиксирована сервером; до оплаты — по текущим ценам.
    const sum = (docs) => docs.reduce((s, d) => s + (d.isPaid && d.totalAmount ? d.totalAmount : (d.items || []).reduce((a, it) => a + price(it) * (it.quantity || 0), 0)), 0)
    const act = (orders.value || []).filter((o) => !o.isCompleted)
    const pur = (purchases.value || []).filter((p) => p.isCreated && !p.isCompleted)
    const stock = all.value.reduce((s, p) => s + p.price * available(p), 0)
    const target = can("view-messages") ? Number(msgs.value?.targetWarehouseValue) || 0 : 0
    const levels = all.value.map((p) => stockLevel(p).level)
    return {
        stock,
        target,
        diff: stock - target,
        fill: target ? Math.min(100, Math.max(0, Math.round((stock / target) * 100))) : 0,
        ordersSum: sum(act),
        ordersN: act.length,
        purSum: sum(pur),
        purN: pur.length,
        outN: all.value.filter((p) => available(p) <= 0).length,
        lowN: levels.filter((l) => l === "low").length,
        defN: levels.filter((l) => l === "deficit").length
    }
})

/* ---------- «Мои заказы» и «Вы часто берёте» (те, кто заказывает) ---------- */
const personal = computed(() => !isStaff.value && canBuy.value)
const myId = computed(() => String(user.value?._id))
const myOrders = computed(() => {
    if (!personal.value) return []
    const act = (orders.value || []).filter((o) => !o.isCompleted)
    const def = deficit(all.value, act).orders
    return act
        .filter((o) => ownerId(o) === myId.value)
        .map((o) => {
            const env = { deficit: !!def[o._id], frozen: frozen.value }
            return { o, st: orderStatus(o), turn: orderTurn(o, plain.value, env), pm: orderPerms(o, plain.value, env) }
        })
        .sort((a, b) => b.turn.mine - a.turn.mine || b.o.orderNumber - a.o.orderNumber)
})
// Заказы за 90 дней — тот же запрос и ключ, что у раздела «Заказы».
const { data: recent, isLoading: recentLoading } = useOrderList(false, personal)
// Блоки стоят над списком товаров: показываем экран, когда пришли и заказы, иначе список прыгает вниз на высоту блока.
// Показанный каталог в скелетон не возвращается (повтор упавшего запроса снова «грузится»); дольше 3 с заказы не ждём.
const shown = ref(false)
const blocksLoading = computed(() => !shown.value && personal.value && (ordersLoading.value || recentLoading.value))
watchEffect(() => {
    if (!isPending.value && !blocksLoading.value) shown.value = true
})
const shownTimer = setTimeout(() => (shown.value = true), 3000)
onBeforeUnmount(() => clearTimeout(shownTimer))
const frequent = computed(() => {
    if (!personal.value || narrowed.value) return []
    const freq = {}
    for (const o of recent.value || []) if (ownerId(o) === myId.value) for (const it of o.items || []) freq[pid(it)] = (freq[pid(it)] || 0) + 1
    return Object.entries(freq)
        .map(([id, n]) => ({ p: byId.value.get(id), n }))
        .filter((x) => x.p)
        .sort((a, b) => (available(b.p) > 0) - (available(a.p) > 0) || b.n - a.n)
        .slice(0, 10)
        .map((x) => x.p)
})
</script>

<template>
    <!-- Нет права видеть товары -->
    <div v-if="!can('view_products')" class="page">
        <div class="card card--pad"><UiEmpty art="box" title="Сюда нельзя" text="У вашей роли нет доступа к этому разделу" /></div>
    </div>

    <!-- Ошибка загрузки -->
    <div v-else-if="isError && !products" class="page">
        <div class="page-head">
            <div class="page-head__row"><h1>Каталог</h1></div>
        </div>
        <div class="card card--pad"><UiError title="Не удалось загрузить «Каталог»" @retry="refetch()" /></div>
    </div>

    <!-- Загрузка: скелетоны -->
    <template v-else-if="isPending || blocksLoading">
        <div class="msearch">
            <UiLogo class="logo__m" />
            <label class="msearch__f"><UiIcon name="search" /><input type="search" name="q" placeholder="Поиск по каталогу" aria-label="Поиск по каталогу" disabled /></label>
            <UiIconBtn icon="sliders" label="Фильтры" kind="soft" />
        </div>
        <div class="page" aria-busy="true">
            <div class="cat">
                <section class="cat__main">
                    <div v-if="isStaff" class="kpis">
                        <div v-for="i in 4" :key="i" class="card kpi"><UiSk w="50%" :h="12" /><UiSk w="70%" :h="26" :r="8" /><UiSk w="60%" :h="12" /></div>
                    </div>
                    <div class="cat__bar"><UiSk w="260px" :h="38" :r="10" /></div>
                    <div class="cat__find"><UiSk w="min(620px, 100%)" :h="44" :r="12" /></div>
                    <div class="chips"><UiSk v-for="w in [56, 104, 84, 92, 70, 96, 60]" :key="w" :w="w + 'px'" :h="40" :r="99" /></div>
                    <p class="loading-note" role="status"><span class="spin"></span>{{ isStaff ? "Загружаем склад и остатки…" : "Загружаем каталог и остатки…" }}</p>
                    <div v-if="personal" class="myorders"><UiSk :h="64" :r="16" /></div>
                    <div v-if="view === 'list'" class="card plist"><UiSkRow v-for="i in 9" :key="i" /></div>
                    <div v-else class="pgrid"><SkCard v-for="i in 8" :key="i" /></div>
                </section>
            </div>
        </div>
    </template>

    <template v-else>
        <div class="msearch">
            <UiLogo class="logo__m" />
            <form class="msearch__f" role="search" @submit.prevent="applySearch(f.q)">
                <UiIcon name="search" />
                <input v-model="f.q" type="search" name="q" enterkeyhint="search" placeholder="Поиск по каталогу" autocomplete="off" aria-label="Поиск по каталогу" @focus="sugg = 'm'" @input="sugg = 'm'" @keydown.esc.stop="sugg = false" />
                <button v-if="f.q" type="button" class="msearch__x" aria-label="Очистить поиск" @click="applySearch('')"><UiIcon name="x" :size="18" /></button>
                <SearchSuggest v-if="sugg === 'm'" :q="f.q" :history="history" :kinds="kinds" :hits="hits" :incoming="incoming" @search="applySearch" @kind="pickKind" @product="openProduct" />
            </form>
            <UiIconBtn icon="sliders" label="Фильтры" :kind="nFilters ? 'primary' : 'soft'" @click="filtersOpen = true"><UiBadge :n="nFilters" /></UiIconBtn>
        </div>
        <div class="page">
            <div class="cat">
                <section class="cat__main" aria-label="Товары">
                    <div v-if="isStaff" class="kpis">
                        <div class="card kpi kpi--wide">
                            <small>Сумма склада</small><b>{{ money(kpi.stock) }}</b>
                            <template v-if="kpi.target">
                                <span
                                    >Цель {{ money(kpi.target) }} · <span :class="kpi.diff < 0 ? 'neg' : 'pos'">{{ kpi.diff < 0 ? "дефицит" : "профицит" }} {{ money(Math.abs(kpi.diff)) }}</span></span
                                >
                                <div class="bar" aria-hidden="true"><i :style="{ width: kpi.fill + '%' }"></i></div>
                            </template>
                        </div>
                        <div v-if="can('view_orders')" class="card kpi">
                            <small>В текущих заказах</small><b>{{ money(kpi.ordersSum) }}</b
                            ><span>{{ kpi.ordersN }} {{ plural(kpi.ordersN, ["заказ", "заказа", "заказов"]) }} в работе</span>
                        </div>
                        <div v-if="can('view_purchases')" class="card kpi">
                            <small>Едет в закупках</small><b>{{ kpi.purSum ? money(kpi.purSum) : "—" }}</b
                            ><span>{{ kpi.purN }} {{ plural(kpi.purN, ["закупка", "закупки", "закупок"]) }}</span>
                        </div>
                        <div class="card kpi">
                            <small>Требует внимания</small
                            ><b
                                ><span class="neg">{{ kpi.outN }}</span> нет</b
                            ><span
                                >ещё {{ kpi.lowN }} мало · <span v-if="kpi.defN" class="neg">дефицит по {{ kpi.defN }} {{ plural(kpi.defN, ["товару", "товарам", "товарам"]) }}</span
                                ><template v-else>дефицита нет</template></span
                            >
                        </div>
                    </div>
                    <div class="cat__bar">
                        <h1>
                            Каталог<small>{{ totalText }}</small>
                        </h1>
                        <div class="cat__tools">
                            <UiSeg :model-value="view" :options="VIEWS" label="Вид списка" @update:model-value="f.view = $event" />
                            <UiBtn v-if="canCreate" label="Новый товар" icon="plus" :to="{ name: 'product-new' }" />
                        </div>
                    </div>
                    <div class="cat__find">
                        <form class="hsearch" role="search" @submit.prevent="applySearch(f.q)">
                            <UiIcon name="search" :size="22" class="hsearch__i" />
                            <input
                                ref="desk"
                                v-model="f.q"
                                type="search"
                                name="q"
                                autocomplete="off"
                                placeholder="Быстрый поиск: название, вид, цена"
                                aria-label="Поиск по каталогу"
                                @focus="sugg = 'd'"
                                @input="sugg = 'd'"
                                @keydown.esc.stop="sugg = false"
                            />
                            <kbd class="hsearch__k" aria-hidden="true">/</kbd>
                            <SearchSuggest v-if="sugg === 'd'" :q="f.q" :history="history" :kinds="kinds" :hits="hits" :incoming="incoming" @search="applySearch" @kind="pickKind" @product="openProduct" />
                        </form>
                        <UiIconBtn icon="sliders" label="Фильтры" :kind="nFilters ? 'primary' : 'soft'" @click="filtersOpen = true"><UiBadge :n="nFilters" /></UiIconBtn>
                    </div>
                    <div class="chips" role="group" aria-label="Виды">
                        <UiChip label="Все" :count="all.length" :active="!f.kinds.length" @click="toggleKind('')" />
                        <UiChip label="В наличии" icon="check" tone="accent" :active="f.avail" @click="f.avail = !f.avail" />
                        <span class="chip-sep" aria-hidden="true"></span>
                        <UiChip v-for="k in kinds" :key="k.key" :label="k.key" :count="k.count" :active="f.kinds.includes(k.key)" @click="toggleKind(k.key)" />
                    </div>
                    <div class="sortrow" role="group" aria-label="Сортировка">
                        <span class="sortrow__l">Сортировка</span>
                        <button v-for="[v, l] in SORTS" :key="v" type="button" class="sortrow__o" :class="{ 'is-on': f.sort === v }" :aria-pressed="f.sort === v" @click="f.sort = f.sort === v ? 'default' : v">{{ l }}</button>
                    </div>
                    <section v-if="myOrders.length && !narrowed" class="myorders" aria-label="Мои заказы">
                        <div class="sec-h">
                            <h2>
                                Мои заказы<small>{{ myOrders.length }}</small>
                            </h2>
                            <RouterLink to="/shop">Все заказы <UiIcon name="right" :size="16" /></RouterLink>
                        </div>
                        <div class="myorders__l">
                            <RouterLink v-for="{ o, st, turn, pm } in myOrders.slice(0, 3)" :key="o._id" class="myo" :class="{ 'myo--mine': turn.mine, 'is-sel': paneSel('/shop/order/' + o._id) }" :to="{ name: 'order', params: { id: o._id } }">
                                <UiStatus :st="st" bare />
                                <span class="myo__t"
                                    ><b>№{{ o.orderNumber }} · {{ STATUS[st].label }}</b
                                    ><small>{{ money(orderTotal(o, (id) => byId.get(id)?.price)) }} · {{ positions(o.items.length) }}</small></span
                                >
                                <span v-if="pm.pay" class="btn btn--primary btn--sm">Оплатить</span>
                                <span v-else-if="pm.confirm" class="btn btn--success btn--sm">Подтвердить</span>
                                <span v-else-if="pm.complete && !pm.blocked && !pm.frozen" class="btn btn--success btn--sm">{{ pm.own ? "Получил" : "Выдать" }}</span>
                                <span v-else class="myo__wait" :class="{ 'is-warn': turn.warn }">{{ turn.short }}</span>
                            </RouterLink>
                        </div>
                    </section>
                    <div v-if="narrowed" class="fquick" style="margin: 0 0 var(--sp-6)">
                        <UiChip v-if="f.q" class="chip--sm chip--filter" icon="x" :label="`«${f.q}»`" @click="applySearch('')" />
                        <UiChip v-for="k in f.kinds" :key="k" class="chip--sm chip--filter" icon="x" :label="k" @click="toggleKind(k)" />
                        <UiChip v-if="f.avail" class="chip--sm chip--filter" icon="x" label="В наличии" @click="f.avail = false" />
                        <UiChip v-if="f.incoming" class="chip--sm chip--filter" icon="x" label="Ждёт поставку" @click="f.incoming = false" />
                        <UiChip v-if="f.min !== '' || f.max !== ''" class="chip--sm chip--filter" icon="x" :label="`${f.min || 0}–${f.max || '∞'} ₽`" @click="(f.min = ''), (f.max = '')" />
                    </div>
                    <div v-if="frequent.length">
                        <div class="sec-h">
                            <h2>Вы часто берёте</h2>
                            <RouterLink :to="{ path: '/shop', query: { f: 'done' } }">История заказов <UiIcon name="right" :size="16" /></RouterLink>
                        </div>
                        <div class="rail"><ProductCard v-for="(p, i) in frequent" :key="p._id" :p="p" :index="i" :incoming="incoming[p._id]" :can-edit="canEdit" eager /></div>
                    </div>
                    <div class="sec-h toolbar-m">
                        <h2>
                            <span>{{ f.q ? "Результаты" : "Все товары" }}</span
                            ><small>{{ total }}</small>
                        </h2>
                        <span class="mobonly"><UiSeg :model-value="view" :options="VIEWS" label="Вид списка" @update:model-value="f.view = $event" /></span>
                        <span v-if="canCreate" class="mobonly"><UiBtn label="Новый" icon="plus" size="sm" :to="{ name: 'product-new' }" /></span>
                    </div>
                    <div id="cat-res">
                        <div v-if="!all.length" class="card">
                            <UiEmpty art="box" title="В каталоге пока нет товаров"><UiBtn v-if="canCreate" label="Новый товар" icon="plus" :to="{ name: 'product-new' }" /></UiEmpty>
                        </div>
                        <div v-else-if="!total" class="card">
                            <UiEmpty art="search" title="Ничего не нашли"><UiBtn label="Сбросить поиск и фильтры" icon="x" kind="secondary" @click="resetFilters(true)" /></UiEmpty>
                        </div>
                        <div v-else-if="view === 'list'" class="card plist">
                            <div class="plist__h"><span></span><span>Товар</span><span>Цена</span><span>Доступно</span><span>На складе</span><span>Цель</span><span></span></div>
                            <UiLazy v-slot="{ item }" :items="list" :size="24" :reset-key="resetKey"><ProductRow :p="item" :incoming="incoming[item._id]" :can-edit="canEdit" /></UiLazy>
                        </div>
                        <div v-else class="pgrid">
                            <UiLazy :items="list" :size="24" :reset-key="resetKey">
                                <template #default="{ item, index }"><ProductCard :p="item" :index="index" :incoming="incoming[item._id]" :can-edit="canEdit" /></template>
                                <template #sk><SkCard /><SkCard /></template>
                            </UiLazy>
                        </div>
                    </div>
                </section>
            </div>
        </div>

        <UiSheet v-if="filtersOpen" title="Фильтры" @close="filtersOpen = false">
            <div class="filters">
                <div class="fgroup">
                    <h4>Вид</h4>
                    <UiCheck v-for="k in kinds" :key="k.key" :label="k.key" :model-value="f.kinds.includes(k.key)" :count="found.filter((p) => p.category === k.key).length" @update:model-value="toggleKind(k.key)" />
                </div>
                <div class="fgroup">
                    <h4>Наличие</h4>
                    <UiCheck v-model="f.avail" label="Только в наличии" :count="found.filter((p) => available(p) > 0).length" />
                    <UiCheck v-model="f.incoming" label="Ждёт поставку" :count="found.filter((p) => incoming[p._id] > 0).length" />
                </div>
                <div class="fgroup">
                    <h4>Цена, ₽</h4>
                    <div class="fprice">
                        <UiField :model-value="f.min" :placeholder="'от ' + priceRange[0]" inputmode="numeric" aria-label="Цена от" @update:model-value="f.min = digits($event)" />
                        <UiField :model-value="f.max" :placeholder="'до ' + priceRange[1]" inputmode="numeric" aria-label="Цена до" @update:model-value="f.max = digits($event)" />
                    </div>
                    <div class="fquick"><UiChip v-for="[a, b, l] in PRICES" :key="l" class="chip--sm" :label="l" :active="f.min === a && f.max === b" @click="quickPrice(a, b)" /></div>
                </div>
                <UiBtn v-if="nFilters" label="Сбросить фильтры" icon="x" kind="ghost" size="sm" class="freset" @click="resetFilters()" />
            </div>
            <template #footer="{ close }">
                <UiBtn label="Сбросить" kind="secondary" size="lg" @click="resetFilters()" />
                <UiBtn :label="`Показать ${totalText}`" size="lg" @click="close()" />
            </template>
        </UiSheet>
    </template>

    <CartAside />
    <!-- Формы «новый» и «правка» — один компонент: ключ пересоздаёт его при смене адреса, иначе форма осталась бы в прежнем режиме -->
    <RouterView v-slot="{ Component, route: r }"><component :is="Component" :key="r.name === 'product' ? 'pane' : r.path" /></RouterView>
</template>
