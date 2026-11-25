<script setup>
/**
 * Copyright 2026 Lord_mahor
 * Licensed under Apache 2.0
 */
import { isDesk, isRoomy } from "@/composables/useBreakpoint"
import { useCart } from "@/composables/useCart"
import { useSession } from "@/composables/useSession"
import { cartLines, cartTotal } from "@/domain/cart"
import { money, pcs, plural, positions, time } from "@/domain/format"
import { available } from "@/domain/stock"
import axiosInstance from "@/service/axios"
import { useProducts } from "@/service/queries"
import { confirm, fly, toast, UiBtn, UiChip, UiCoverStack, UiEmpty, UiError, UiIcon, UiIconBtn, UiLazy, UiPage, UiSk, UiSkRow } from "@/ui"
import CartAside from "@/views/core/CartAside.vue"
import { useQuery, useQueryClient } from "@tanstack/vue-query"
import { computed, onBeforeUnmount, onUnmounted, provide, ref, toRaw } from "vue"
import { useRouter } from "vue-router"
import { autofill, CAB, cabStats, rowKey } from "./cabinet"
import CabinetRow from "./CabinetRow.vue"
import { drop, edits, ek, flushPending, savedAt, saveState, setValue, toNum, val, waitSaved } from "./edits"

const router = useRouter()
const queryClient = useQueryClient()
const { user, can } = useSession()
const { cart, count, replace } = useCart()
const allowed = computed(() => can("cabinet_access"))
const { data: products } = useProducts()
const byId = computed(() => new Map((products.value || []).map((p) => [String(p._id), p])))
const narrow = computed(() => isDesk.value && !isRoomy.value)

const { data: status, isPending: statusPending } = useQuery({ queryKey: ["cabinet-status"], queryFn: async () => (await axiosInstance.get("/cabinet/status")).data, staleTime: Infinity, enabled: allowed })
// В кэше — сам массив строк (его же читает строка «Мой склад» в товаре). shallow: строки не оборачиваются, правки живут в словаре edits.
const { data: rows, isPending, isError, refetch } = useQuery({ queryKey: ["cabinet-merged"], queryFn: async () => (await axiosInstance.get("/cabinet/merged")).data, staleTime: 30_000, enabled: allowed, shallow: true })
const { data: ordersSummary } = useQuery({ queryKey: ["cabinet-orders-summary"], queryFn: async () => (await axiosInstance.get("/cabinet/orders-summary")).data, staleTime: 30_000, enabled: allowed })
const all = computed(() => rows.value || [])
const errText = (e) => e?.response?.data?.message || e?.message

/* ---------- Правки «Цель» / «У меня»: сохраняются сами, во время ввода (состояние — в ./edits, оно переживает уход со страницы) ---------- */
const touched = new Set() // тронутые строки не уходят из подборки, пока её не сменили
function set(r, f, v) {
    touched.add(rowKey(r))
    setValue(r, f, v)
}
// После размонтирования строк: их степперы при уходе успевают применить набранное число.
onUnmounted(flushPending)
onBeforeUnmount(() => clearTimeout(qTimer))

/* ---------- Свои позиции ---------- */
function edit(r) {
    if (r.cabinetItemId && r.isCustom) router.push({ name: "cabinet-item", params: { id: r.cabinetItemId } })
}
async function remove(r) {
    if (!r?.cabinetItemId) return
    if (!(await confirm({ title: "Удалить позицию?", ok: "Удалить", tone: "danger" }))) return
    // Фото удаляется вместе с позицией — «Вернуть» восстанавливает её с цветом обложки, но без фото.
    const back = { customName: r.productName, baseQty: toNum(val(r, "baseQty")), currentQty: toNum(val(r, "currentQty")), customPrice: r.price || 0, note: r.note || "", cover: r.cover || null, coverColor: r.coverColor || null }
    try {
        await axiosInstance.delete(`/cabinet/${r.cabinetItemId}`)
    } catch (e) {
        return toast({ type: "error", title: "Ошибка", text: errText(e) })
    }
    drop(r)
    queryClient.invalidateQueries({ queryKey: ["cabinet-merged"] })
    let restored = false // повторное нажатие «Вернуть» не создаёт вторую позицию
    toast({ type: "info", title: "Позиция удалена", text: r.productName, action: { label: "Вернуть", fn: () => restored || ((restored = true), restore(back)) } })
}
async function restore(body) {
    try {
        await axiosInstance.post("/cabinet", body)
    } catch (e) {
        return toast({ type: "error", title: "Ошибка", text: errText(e) })
    }
    queryClient.invalidateQueries({ queryKey: ["cabinet-merged"] })
}
provide(CAB, { val, set, edit, remove, drop })

/* ---------- Первый визит ---------- */
const initPending = ref(false)
// «Создать» заводит «Мой склад». «Позже» сервер не зовёт, только уводит в каталог: в следующий раз экран первого визита появится снова.
async function init() {
    initPending.value = true
    try {
        await axiosInstance.post("/cabinet/init")
    } catch (e) {
        initPending.value = false
        return toast({ type: "error", title: "Ошибка", text: errText(e) })
    }
    queryClient.setQueryData(["cabinet-status"], { initialized: true })
    initPending.value = false
    toast({ type: "success", title: "«Мой склад» создан" })
}

/* ---------- Итоги, подборка, поиск, сортировка ---------- */
const availOf = (r) => {
    const p = byId.value.get(r.productId)
    return p ? available(p) : r.stockQty || 0
}
const stats = computed(() => cabStats(all.value, val, availOf))
const ctaCovers = computed(() => stats.value.stock.map((r) => byId.value.get(r.productId) || { _id: r.productId, name: r.productName, category: r.category }))

const view = ref("track")
const qIn = ref("")
const q = ref("")
const sort = ref("")
let qTimer = 0
function onQ(v, now) {
    qIn.value = v
    clearTimeout(qTimer)
    if (now) q.value = v
    else qTimer = setTimeout(() => (q.value = v), 200)
}
function setView(v, clearQ) {
    view.value = v
    touched.clear()
    if (clearQ) onQ("", true)
}
const SORTS = [
    ["need", "Сначала нужно"],
    ["name", "По названию"],
    ["kind", "По виду"],
    ["price", "Дороже"],
    ["base", "Больше цель"],
    ["have", "Больше у меня"],
    ["ord", "Больше в заказе"]
]
// Состав и порядок — по значениям на момент смены подборки, поиска или сортировки (без слежения за правками):
// нажатие не пересобирает список, и строка не прыгает и не исчезает под пальцем.
const list = computed(() => {
    const raw = toRaw(edits)
    const v = (r, f) => (raw.has(ek(r, f)) ? raw.get(ek(r, f)) : r[f] || 0)
    const need = (r) => Math.max(0, v(r, "baseQty") - v(r, "currentQty") - (r.inOrderQty || 0))
    let l = all.value
    if (view.value === "need") l = l.filter((r) => need(r) > 0 || touched.has(rowKey(r)))
    else if (view.value === "own") l = l.filter((r) => r.isCustom)
    else if (view.value === "track") l = l.filter((r) => r.isCustom || v(r, "baseQty") > 0 || v(r, "currentQty") > 0 || r.inOrderQty > 0 || touched.has(rowKey(r)))
    const s = q.value.trim().toLowerCase()
    if (s) l = l.filter((r) => `${r.productName} ${r.category || ""} ${r.note || ""}`.toLowerCase().includes(s))
    const by = {
        need: (a, b) => need(b) - need(a),
        name: (a, b) => a.productName.localeCompare(b.productName, "ru"),
        kind: (a, b) => (a.category || "").localeCompare(b.category || "", "ru"),
        price: (a, b) => (b.price || 0) - (a.price || 0),
        base: (a, b) => v(b, "baseQty") - v(a, "baseQty"),
        have: (a, b) => v(b, "currentQty") - v(a, "currentQty"),
        ord: (a, b) => (b.inOrderQty || 0) - (a.inOrderQty || 0)
    }[sort.value]
    if (by) l = [...l].sort(by)
    return l.map((r) => ({ _id: rowKey(r), r }))
})
const resetKey = computed(() => `${view.value}~${q.value}~${sort.value}`)
const CCOLS = "52px minmax(0,2.2fr) 74px 82px 148px 148px 84px 92px 96px"
const HEAD = ["", "Позиция", "Цена", "На складе", "Цель", "У меня", "В заказе", "Нужно", ""]
// Рядом с корзиной справа таблица уже: цена и остаток уходят в подпись под названием.
const CCOLS_N = "48px minmax(0,1fr) 120px 120px 88px 44px"
const HEAD_N = ["", "Позиция", "Цель", "У меня", "Нужно", ""]

/* ---------- Автозаполнение корзины ---------- */
const filling = ref(false)
const cta = ref(null)
async function fill() {
    if (filling.value) return
    filling.value = true
    try {
        // Сервер считает по сохранённому: снимаем фокус (степпер применит набранное число) и досылаем ожидающее.
        document.activeElement?.blur?.()
        await waitSaved()
        const r = autofill(cart, (await axiosInstance.post("/cabinet/autofill")).data)
        replace(r.cart)
        fly(cta.value?.querySelector("[data-cover]"))
        const action = r.added ? { label: "Открыть корзину", fn: () => router.push({ name: "cart" }) } : null
        if (r.miss.length) toast({ type: "warning", title: `Корзина: +${positions(r.added)}. Часть недоступна`, text: r.miss.slice(0, 4).join("; ") + (r.miss.length > 4 ? ` и ещё ${r.miss.length - 4}` : ""), action, timeout: 9000 })
        else toast({ type: "success", title: `Корзина обновлена: +${positions(r.added)}`, text: `В корзине ${pcs(count.value)} на ${money(cartTotal(cartLines(cart, products.value)))}`, action, timeout: 6500 })
    } catch (e) {
        toast({ type: "error", title: "Ошибка", text: errText(e) })
    } finally {
        filling.value = false
    }
}
</script>

<template>
    <UiPage v-if="!allowed" title="Мой склад">
        <div class="card card--pad"><UiEmpty art="box" title="Сюда нельзя" text="У вашей роли нет доступа к этому разделу" /></div>
    </UiPage>
    <UiPage v-else-if="isError && !rows" title="Мой склад">
        <div class="card card--pad"><UiError title="Не удалось загрузить «Мой склад»" @retry="refetch()" /></div>
    </UiPage>
    <UiPage v-else-if="isPending || statusPending" title="Мой склад" sub="Загружаем…">
        <div class="kpis kpis--4" aria-busy="true">
            <div v-for="i in 4" :key="i" class="card kpi"><UiSk w="52%" :h="12" /><UiSk w="74%" :h="26" :r="8" /><UiSk w="60%" :h="12" /></div>
        </div>
        <div class="card cabcta"><UiSk w="120px" :h="36" :r="8" /><UiSk w="60%" :h="18" /><UiSk w="160px" :h="52" :r="12" /></div>
        <div class="listtools">
            <div class="filterbar"><UiSk v-for="w in [130, 160, 80, 140]" :key="w" :w="w + 'px'" :h="40" :r="99" /></div>
            <UiSk w="100%" :h="48" :r="14" />
        </div>
        <p class="loading-note" role="status"><span class="spin"></span>Загружаем ваш склад…</p>
        <div class="card tbl tbl--sk"><UiSkRow v-for="i in 8" :key="i" /></div>
    </UiPage>
    <UiPage v-else-if="status?.initialized === false" title="Мой склад">
        <div class="card welcome">
            <svg class="welcome__art" viewBox="0 0 220 120" aria-hidden="true">
                <ellipse cx="110" cy="112" rx="86" ry="6" fill="currentColor" opacity=".07" />
                <rect x="34" y="40" width="152" height="66" rx="10" fill="var(--surface-2)" stroke="var(--line-strong)" stroke-width="2" />
                <path d="M34 58h152" stroke="var(--line-strong)" stroke-width="2" />
                <rect x="48" y="20" width="26" height="48" rx="3" fill="#2C3E9E" transform="rotate(-6 61 44)" />
                <rect x="80" y="16" width="24" height="52" rx="3" fill="#0E8F80" />
                <rect x="110" y="22" width="22" height="46" rx="3" fill="#E8902B" transform="rotate(5 121 45)" />
                <rect x="142" y="26" width="16" height="30" rx="7" fill="#FF7A1A" />
                <rect x="162" y="30" width="14" height="27" rx="6" fill="#1FA463" />
                <circle cx="150" cy="22" r="5" fill="none" stroke="#B7BCC7" stroke-width="2" />
                <rect x="88" y="74" width="44" height="20" rx="10" fill="var(--primary)" />
                <path d="m100 84 5 5 9-9" fill="none" stroke="#fff" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" />
            </svg>
            <h2>Создать личный склад?</h2>
            <p>
                «Личный склад» — это твой персональный список позиций с целевым и текущим количеством. Когда чего-то не хватает, ты в один клик автозаполняешь корзину тем что нужно докупить. После того как заказ подтверждён, твой склад автоматически
                пополняется.
            </p>
            <div class="welcome__acts">
                <UiBtn label="Создать мой склад" icon="check" size="lg" :loading="initPending" @click="init" />
                <UiBtn label="Позже" kind="ghost" size="lg" :disabled="initPending" :to="{ name: 'catalog' }" />
            </div>
        </div>
    </UiPage>
    <UiPage v-else title="Мой склад" :sub="`Группа «${user?.name || ''}» · цели и запас на руках`">
        <template #actions>
            <span class="saved" :class="'saved--' + saveState" role="status" aria-live="polite"
                ><template v-if="saveState === 'saving'"><span class="spin" aria-hidden="true"></span>Сохраняем…</template><template v-else-if="saveState === 'error'"><UiIcon name="alert" :size="16" />Не сохранилось</template
                ><template v-else><UiIcon name="check" :size="16" />{{ saveState === "saved" ? `Сохранено · ${time(savedAt)}` : "Всё сохранено" }}</template></span
            >
            <UiIconBtn icon="plus" label="Добавить свою позицию" :to="{ name: 'cabinet-item-new' }" />
        </template>
        <template #deskActions>
            <span class="saved" :class="'saved--' + saveState" role="status" aria-live="polite"
                ><template v-if="saveState === 'saving'"><span class="spin" aria-hidden="true"></span>Сохраняем…</template><template v-else-if="saveState === 'error'"><UiIcon name="alert" :size="16" />Не сохранилось</template
                ><template v-else><UiIcon name="check" :size="16" />{{ saveState === "saved" ? `Сохранено · ${time(savedAt)}` : "Всё сохранено" }}</template></span
            >
            <UiBtn label="Своя позиция" icon="plus" kind="secondary" :to="{ name: 'cabinet-item-new' }" />
        </template>

        <!-- v-memo: нажатие «+» перерисовывает только блоки, чьи числа изменились, — так ввод остаётся быстрым на телефоне. -->
        <div v-memo="[all.length, stats.tracked, stats.own, stats.needN, stats.needPcs, stats.defSum, ordersSummary]" class="kpis kpis--compact">
            <div class="card kpi">
                <small>Позиций</small><b>{{ all.length }}</b
                ><span>{{ stats.tracked }} отслеживаете · {{ stats.own }} {{ plural(stats.own, ["своя", "своих", "своих"]) }}</span>
            </div>
            <div class="card kpi" :class="{ 'kpi--acc': stats.needN }">
                <small>Нужно докупить</small
                ><b
                    ><span v-if="stats.needN" class="acc">{{ stats.needN }}</span
                    ><template v-else>0</template></b
                ><span>{{ stats.needN ? pcs(stats.needPcs) : "Всего хватает" }}</span>
            </div>
            <div class="card kpi">
                <small>Сумма дефицита</small><b>{{ money(stats.defSum) }}</b
                ><span>только товары склада</span>
            </div>
            <div class="card kpi">
                <small>В активных заказах</small>
                <template v-if="ordersSummary"
                    ><b>{{ money(ordersSummary.ordersTotal) }}</b
                    ><span>{{ ordersSummary.ordersCount }} {{ plural(ordersSummary.ordersCount, ["заказ", "заказа", "заказов"]) }}</span></template
                >
                <template v-else><UiSk w="74%" :h="26" :r="8" /><UiSk w="60%" :h="12" /></template>
            </div>
        </div>

        <div v-if="!stats.stock.length" class="card cabcta cabcta--ok">
            <UiIcon name="check" :size="24" />
            <div><b>Всего хватает</b></div>
        </div>
        <div v-else ref="cta" class="card cabcta">
            <div class="cabcta__covers"><UiCoverStack :products="ctaCovers" :max="5" /></div>
            <div class="cabcta__t">
                <b>Не хватает {{ positions(stats.stock.length) }} со склада</b
                ><small>{{ stats.availN === stats.stock.length ? "Всё есть на складе" : `На складе есть ${stats.availN} из ${stats.stock.length}` }} · примерно {{ money(stats.availSum) }}</small>
            </div>
            <UiBtn label="Собрать корзину" icon="cart" size="lg" class="cabcta__b" :loading="filling" @click="fill" />
        </div>

        <div class="listtools">
            <div v-memo="[all.length, stats.tracked, stats.needN, stats.own, view]" class="filterbar" role="group" aria-label="Подборка">
                <UiChip label="Отслеживаю" :count="stats.tracked" :active="view === 'track'" @click="setView('track')" />
                <UiChip label="Нужно докупить" :count="stats.needN" tone="accent" :active="view === 'need'" @click="setView('need')" />
                <UiChip label="Свои" :count="stats.own" :active="view === 'own'" @click="setView('own')" />
                <UiChip label="Весь каталог" :count="all.length" :active="view === 'all'" @click="setView('all')" />
            </div>
            <form v-memo="[qIn]" class="msearch__f lsearch" role="search" @submit.prevent="$event.target.querySelector('input').blur()">
                <UiIcon name="search" :size="20" />
                <input type="search" name="q" placeholder="Найти позицию" aria-label="Найти позицию" :value="qIn" autocomplete="off" @input="onQ($event.target.value)" />
                <button v-if="qIn" type="button" class="msearch__x" aria-label="Очистить поиск" @click="onQ('', true)"><UiIcon name="x" :size="18" /></button>
            </form>
        </div>
        <div v-memo="[sort]" class="sortrow" role="group" aria-label="Сортировка">
            <span class="sortrow__l">Сортировка</span>
            <button v-for="[v, l] in SORTS" :key="v" type="button" class="sortrow__o" :class="{ 'is-on': sort === v }" :aria-pressed="sort === v" @click="sort = sort === v ? '' : v">{{ l }}</button>
        </div>
        <p v-once class="listnote listnote--top"><UiIcon name="info" :size="16" class="inl" /> «Нужно» = цель − у меня − в заказе.</p>

        <div v-if="list.length" v-memo="[list, narrow]" class="card tbl tbl--cab" :style="{ '--cols': narrow ? CCOLS_N : CCOLS }">
            <div class="tbl__h" aria-hidden="true">
                <span v-for="(h, i) in narrow ? HEAD_N : HEAD" :key="i">{{ h }}</span>
            </div>
            <UiLazy v-slot="{ item }" :items="list" :size="24" :reset-key="resetKey"><CabinetRow :r="item.r" :p="byId.get(item.r.productId)" :narrow="narrow" /></UiLazy>
        </div>
        <div v-else class="card">
            <UiEmpty v-if="view === 'track' && !q" art="box" title="Позиций нет"><UiBtn label="Открыть весь каталог" icon="grid" @click="setView('all')" /></UiEmpty>
            <UiEmpty v-else art="search" title="Ничего не нашли"><UiBtn label="Весь каталог" kind="secondary" @click="setView('all', true)" /></UiEmpty>
        </div>

        <section v-memo="[stats.needN, stats.needPcs, stats.defSum, stats.overN, stats.overPcs]" class="cabfoot" aria-label="Итог по моему складу">
            <div class="cabfoot__c cabfoot__c--need" :class="{ 'is-on': stats.needN }">
                <small>Нужно докупить</small><b>{{ stats.needN ? pcs(stats.needPcs) : "—" }}</b
                ><span>{{ stats.needN ? `${positions(stats.needN)} · примерно ${money(stats.defSum)}` : "всего хватает" }}</span>
            </div>
            <div class="cabfoot__c cabfoot__c--over" :class="{ 'is-on': stats.overN }">
                <small>Сверх цели</small><b>{{ stats.overN ? "+" + pcs(stats.overPcs) : "—" }}</b
                ><span>{{ stats.overN ? `${positions(stats.overN)} — можно не заказывать` : "лишнего нет" }}</span>
            </div>
        </section>
    </UiPage>

    <CartAside v-if="allowed" />
    <!-- Формы «новый» и «правка» — один компонент: ключ пересоздаёт его при смене адреса, иначе форма осталась бы в прежнем режиме -->
    <RouterView v-slot="{ Component, route: r }"><component :is="Component" :key="r.path" /></RouterView>
</template>
