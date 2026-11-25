<script setup>
/**
 * Copyright 2026 Lord_mahor
 * Licensed under Apache 2.0
 */
import { isDesk } from "@/composables/useBreakpoint"
import { useSession } from "@/composables/useSession"
import { date, money, pcs, plural, positions } from "@/domain/format"
import { homePath } from "@/domain/nav"
import { pid } from "@/domain/stock"
import axiosInstance from "@/service/axios"
import { useInventories } from "@/service/queries"
import { backTo, confirm, toast, UiBanner, UiBtn, UiChip, UiEmpty, UiError, UiField, UiIcon, UiIconBtn, UiLazy, UiPage, UiSelect, UiSheet, UiSk, UiSkRow, UiStamp, UiStatus } from "@/ui"
import { useQuery, useQueryClient } from "@tanstack/vue-query"
import { computed, reactive, ref, toRaw, watch } from "vue"
import InvRow from "./InvRow.vue"
import { diffTone, factOf, factsOf, invPrice, invStats, mergeFresh, MINUS, sgnMoney } from "./inventory"

const props = defineProps({ id: { type: String, required: true } })
const queryClient = useQueryClient()
const { can, plain } = useSession()
const COLS = "52px minmax(0,2fr) 80px 168px 96px 112px"

const {
    data: inv,
    isPending,
    isSuccess,
    isError,
    error,
    refetch
} = useQuery({
    queryKey: computed(() => ["inventorization", props.id]),
    queryFn: () => axiosInstance.get(`/inventory/${props.id}`),
    select: (res) => res.data,
    refetchOnMount: "always",
    staleTime: 0,
    refetchInterval: 1000 * 60 * 5,
    enabled: computed(() => can("view_inventory"))
})
const { data: list, isPending: listPending } = useInventories()
// Сервер отвечает пустым телом, если инвентаризации нет, и 400 на неверный id.
const notFound = computed(() => error.value?.response?.status === 400 || (isSuccess.value && !inv.value))

// Как на сервере: править можно, пока нет более поздней (только что начатой может ещё не быть в кэше списка).
const isLatest = computed(() => !!inv.value && !(list.value || []).some((i) => i._id !== props.id && (i.startDate || 0) > (inv.value.startDate || 0)))
const edit = computed(() => can("edit_inventory") && isLatest.value)
// Удаление сервер пускает только с правом delete_inventory.
const canDel = computed(() => edit.value && can("delete_inventory"))
const done = computed(() => !!inv.value?.isCompleted)
const items = computed(() => (inv.value?.items || []).filter((it) => it.product?._id))

/* ---------- Черновик ввода: факт по товарам, комментарий, фильтры ---------- */
const draft = computed(() => (drafts[props.id] ||= reactive({ facts: null, base: {}, comment: "", baseComment: "", view: "", kind: "", q: "", sort: false })))
function reset() {
    const d = draft.value
    d.base = factsOf(inv.value?.items)
    d.facts = { ...d.base }
    d.comment = d.baseComment = inv.value?.comment || ""
}
const dirty = computed(() => {
    const d = draft.value
    return !!d.facts && (Object.keys(d.base).some((k) => d.facts[k] !== d.base[k]) || d.comment !== d.baseComment)
})
const merge = (v) => Object.assign(draft.value, mergeFresh(draft.value, factsOf(v.items), v.comment || ""))
// Свежие данные (realtime, чужое сохранение) всегда становятся базой; поверх остаются только свои правленые строки.
watch(inv, (v) => v && merge(v), { immediate: true })
const setFact = (id, n) => (draft.value.facts[id] = n)

const s = computed(() => invStats(inv.value?.items, draft.value.facts))
const kindOptions = computed(() => [{ value: "", label: "Все виды" }, ...[...new Set(items.value.map((it) => it.product.category).filter(Boolean))].map((k) => ({ value: k, label: k }))])
const visible = computed(() => {
    const d = draft.value
    // Факт читается без слежения: ввод не пересобирает список, фильтр и сортировка применяются при их смене.
    const facts = toRaw(d.facts)
    const dv = (it) => factOf(it, facts) - (Number(it.quantity) || 0)
    const q = d.q.trim().toLowerCase()
    let l = items.value
    if (d.view === "dev") l = l.filter((it) => dv(it) !== 0)
    if (d.view === "minus") l = l.filter((it) => dv(it) < 0)
    if (d.view === "plus") l = l.filter((it) => dv(it) > 0)
    if (d.kind) l = l.filter((it) => it.product.category === d.kind)
    if (q) l = l.filter((it) => [it.product.name, it.product.category, invPrice(it)].join(" ").toLowerCase().includes(q))
    if (d.sort) l = [...l].sort((a, b) => Math.abs(dv(b)) - Math.abs(dv(a)))
    return l
})
const resetKey = computed(() => [draft.value.view, draft.value.kind, draft.value.q, draft.value.sort].join("~"))
let qTimer = 0
const onQ = (ev) => {
    clearTimeout(qTimer)
    qTimer = setTimeout(() => (draft.value.q = ev.target.value), 200)
}
function showAll() {
    Object.assign(draft.value, { view: "", kind: "", q: "" })
}

/* ---------- Сохранить, завершить, удалить ---------- */
const busy = ref("")
const moreOpen = ref(false)
const finishOpen = ref(false)
const fresh = ref(false)
// Каркас не пересоздаёт страницу при смене id: окна и «занято» прежней инвентаризации не переносим.
watch(
    () => props.id,
    () => {
        finishOpen.value = moreOpen.value = fresh.value = false
        busy.value = ""
    }
)
const blur = () => document.activeElement?.blur?.() // набранное в поле число применяется при уходе фокуса

async function put(extra, kind) {
    if (busy.value) return false
    busy.value = kind
    let ok = false
    try {
        // Сервер заменяет позиции целиком: сначала свежие данные, чтобы старый снимок не затёр чужой сохранённый факт.
        const r = await refetch()
        if (r.error) throw r.error
        if (r.data) merge(r.data) // нет данных — инвентаризацию удалили; ответ сервера скажет «не найдена»
        const d = draft.value
        const { data: saved } = await axiosInstance.put(`/inventory/${props.id}`, {
            items: (r.data || inv.value).items.map((it) => ({ product: pid(it), newQuantity: factOf(it, d.facts), quantity: Number(it.quantity) || 0 })),
            comment: d.comment,
            ...extra
        })
        // База — то, что записал сервер: набранное во время запроса остаётся несохранённым.
        d.base = factsOf(saved.items)
        d.baseComment = saved.comment || ""
        queryClient.setQueryData(["inventorization", props.id], (old) =>
            old?.data ? { ...old, data: { ...old.data, comment: saved.comment, isCompleted: saved.isCompleted, items: old.data.items.map((it) => ({ ...it, newQuantity: d.base[pid(it)] ?? it.newQuantity })) } } : old
        )
        queryClient.invalidateQueries({ queryKey: ["inventorizations"] })
        queryClient.invalidateQueries({ queryKey: ["inventorization", props.id] })
        queryClient.invalidateQueries({ queryKey: ["products"] })
        ok = true
    } catch (e) {
        toast({ type: "error", title: "Ошибка", text: e?.response?.data?.message || e.message })
    } finally {
        // После завершения busy держится до закрытия окна: повторное касание за время анимации не шлёт второй запрос.
        if (!ok || kind !== "done") busy.value = ""
    }
    return ok
}
async function save() {
    if (busy.value) return
    blur()
    if (done.value) {
        const r = await confirm({
            title: "Изменить завершённую инвентаризацию?",
            text: "Остатки склада будут пересчитаны на разницу новых значений. Причина сохранится в истории изменений.",
            ok: "Сохранить",
            tone: "primary",
            icon: "edit",
            reason: { label: "Причина изменения", required: true, error: "Укажите причину изменения завершённой инвентаризации" }
        })
        if (r && (await put({ isCompleted: true, editReason: r.reason }, "save"))) toast({ type: "success", title: "Изменения сохранены" })
        return
    }
    if (await put({ isCompleted: false }, "save")) toast({ type: "success", title: "Сохранено" })
}
function openFinish() {
    blur()
    finishOpen.value = true
}
async function complete(close) {
    if (!(await put({ isCompleted: true }, "done"))) return
    close("ok")
    fresh.value = true
    const n = s.value.devN
    toast({ type: "success", title: "Инвентаризация завершена", text: n ? `Остатки ${n} ${plural(n, ["товара", "товаров", "товаров"])} обновлены` : "Остатки не изменились" })
}
function closeFinish() {
    finishOpen.value = false
    busy.value = ""
}
async function remove() {
    if (busy.value) return
    const wasDone = done.value
    const r = await confirm(
        wasDone
            ? {
                  title: "Удалить завершённую инвентаризацию?",
                  text: "Её эффект на остатки будет откачен. Причина сохранится в истории.",
                  ok: "Удалить",
                  tone: "danger",
                  reason: { label: "Причина удаления", required: true, error: "Укажите причину удаления завершённой инвентаризации" }
              }
            : { title: "Удалить инвентаризацию?", text: "Введённый факт пропадёт", ok: "Удалить", tone: "danger" }
    )
    if (!r) return
    busy.value = "del"
    try {
        await axiosInstance.delete(`/inventory/${props.id}`, { data: wasDone ? { editReason: r.reason } : undefined })
        delete drafts[props.id]
        queryClient.invalidateQueries({ queryKey: ["inventorizations"] })
        queryClient.invalidateQueries({ queryKey: ["products"] })
        toast({ type: "info", title: "Инвентаризация удалена", text: wasDone ? "Остатки откатаны" : undefined })
        backTo({ name: "inventory" })
    } catch (e) {
        toast({ type: "error", title: "Ошибка", text: e?.response?.data?.message || e.message })
    } finally {
        busy.value = ""
    }
}
function revert() {
    reset()
    toast({ type: "info", title: "Изменения отменены" })
}
</script>

<script>
// Несохранённый ввод живёт, пока открыто приложение: можно уйти со страницы и вернуться к нему.
const drafts = {}
</script>

<template>
    <UiPage v-if="!can('view_inventory')" title="Инвентаризация">
        <div class="card">
            <UiEmpty art="error" title="Нет доступа"><UiBtn label="На главную" icon="home" :to="homePath(plain)" /></UiEmpty>
        </div>
    </UiPage>

    <UiPage v-else-if="notFound" title="Инвентаризация не найдена" :back="{ name: 'inventory' }">
        <div class="card">
            <UiEmpty art="search" title="Такой инвентаризации нет"><UiBtn label="Все инвентаризации" :to="{ name: 'inventory' }" /></UiEmpty>
        </div>
    </UiPage>

    <UiPage v-else-if="isError && !inv" title="Инвентаризация" :back="{ name: 'inventory' }">
        <div class="card card--pad"><UiError title="Не удалось загрузить инвентаризацию" @retry="refetch()" /></div>
    </UiPage>

    <UiPage v-else-if="isPending || listPending" title="Инвентаризация" sub="Загружаем…">
        <div class="work" aria-busy="true">
            <div class="work__main">
                <div class="listtools">
                    <div class="filterbar"><UiSk v-for="w in [60, 140, 120, 110]" :key="w" :w="w + 'px'" :h="40" :r="99" /></div>
                    <UiSk :h="48" :r="14" />
                </div>
                <p class="loading-note" role="status"><span class="spin"></span>Загружаем позиции…</p>
                <div class="card tbl tbl--sk"><UiSkRow v-for="i in 9" :key="i" /></div>
            </div>
            <aside class="work__side">
                <section class="card ohero"><UiSk w="130px" :h="32" :r="99" /><UiSk w="60%" :h="26" /><UiSk w="90%" /></section>
                <section class="card blk">
                    <UiSk w="40%" :h="18" />
                    <div style="height: 14px"></div>
                    <UiSk :h="80" :r="12" />
                </section>
            </aside>
        </div>
    </UiPage>

    <UiPage
        v-else
        :title="`Инвентаризация от ${date(inv.startDate)}`"
        :mtitle="`Инвентаризация ${date(inv.startDate).slice(0, 5)}`"
        :sub="[done ? 'Завершена' : 'В процессе', inv.createdBy?.name].filter(Boolean).join(' · ')"
        :back="{ name: 'inventory' }"
        :cls="edit ? 'has-abar' : ''"
    >
        <template #crumbs
            ><RouterLink :to="{ name: 'inventory' }">Инвентаризация</RouterLink><UiIcon name="right" :size="14" /><span>{{ date(inv.startDate) }}</span></template
        >
        <template #actions><UiIconBtn v-if="!isDesk && canDel" icon="dots" label="Ещё действия" @click="moreOpen = true" /></template>

        <div class="work">
            <div class="work__main">
                <div v-if="!edit || done || dirty" class="banners">
                    <UiBanner v-if="!edit && !isLatest" tone="neutral" icon="lock" title="Только просмотр" text="Исправить можно только последнюю инвентаризацию" />
                    <UiBanner v-else-if="!edit" tone="neutral" icon="eye" title="Только просмотр" />
                    <UiBanner v-if="edit && done" tone="info" title="Инвентаризация завершена" text="Любое изменение или удаление потребует указать причину и пересчитает остатки склада." />
                    <UiBanner v-if="edit && dirty" tone="warning" icon="edit" title="Есть несохранённые изменения">
                        <template #action><UiBtn label="Отменить" kind="secondary" size="sm" @click="revert" /></template>
                    </UiBanner>
                </div>
                <div class="invm">
                    <div class="invm__t invm__t--minus" :class="{ 'is-on': s.short }">
                        <small>Недостача</small><b>{{ s.short ? MINUS + pcs(s.short) : "—" }}</b
                        ><span>{{ s.short ? MINUS + money(s.shortSum) : "не найдено" }}</span>
                    </div>
                    <div class="invm__t invm__t--plus" :class="{ 'is-on': s.plus }">
                        <small>Излишек</small><b>{{ s.plus ? "+" + pcs(s.plus) : "—" }}</b
                        ><span>{{ s.plus ? "+" + money(s.plusSum) : "не найдено" }}</span>
                    </div>
                </div>
                <div class="listtools listtools--3">
                    <div class="filterbar" role="group" aria-label="Фильтр позиций">
                        <UiChip label="Все" :count="items.length" :active="draft.view === ''" @click="draft.view = ''" />
                        <UiChip label="Расхождения" tone="accent" :count="s.devN" :active="draft.view === 'dev'" @click="draft.view = 'dev'" />
                        <UiChip label="Недостача" :count="s.shortN" :active="draft.view === 'minus'" @click="draft.view = 'minus'" />
                        <UiChip label="Излишек" :count="s.plusN" :active="draft.view === 'plus'" @click="draft.view = 'plus'" />
                        <span class="chip-sep" aria-hidden="true"></span>
                        <UiChip label="По величине Σ" icon="sort" :active="draft.sort" @click="draft.sort = !draft.sort" />
                    </div>
                    <UiSelect v-model="draft.kind" :options="kindOptions" aria-label="Вид" />
                    <form class="msearch__f lsearch" role="search" @submit.prevent="blur">
                        <UiIcon name="search" /><input type="search" name="q" placeholder="Найти товар" aria-label="Найти товар" :value="draft.q" autocomplete="off" @input="onQ" />
                        <button v-if="draft.q" type="button" class="msearch__x" aria-label="Очистить поиск" @click="draft.q = ''"><UiIcon name="x" :size="18" /></button>
                    </form>
                </div>
                <div id="inv-list">
                    <div v-if="!visible.length" class="card">
                        <UiEmpty art="search" title="Ничего не нашли"><UiBtn label="Все позиции" kind="secondary" @click="showAll" /></UiEmpty>
                    </div>
                    <div v-else class="card tbl tbl--inv" :style="{ '--cols': COLS }">
                        <div class="tbl__h" aria-hidden="true">
                            <span></span><span>Товар</span><span>На старте</span><span>{{ edit ? "Факт" : "Итог" }}</span
                            ><span>Отклонение</span><span>Сумма</span>
                        </div>
                        <UiLazy v-slot="{ item }" :items="visible" :size="24" :reset-key="resetKey"><InvRow :it="item" :facts="draft.facts" :edit="edit" @fact="setFact" /></UiLazy>
                    </div>
                </div>
            </div>

            <aside class="work__side">
                <section class="card ohero">
                    <UiStamp v-if="done" tone="done" :date="date(inv.startDate)" :rot="5" :fresh="fresh">ИНВЕНТАРИЗАЦИЯ<br />ЗАВЕРШЕНА</UiStamp>
                    <div class="ohero__top">
                        <UiStatus :st="done ? 'done' : 'partial'" :label="done ? 'Завершена' : 'В процессе'" size="lg" /><span class="muted" style="font-size: var(--fs-14); font-weight: 700">{{ positions(inv.items.length) }}</span>
                    </div>
                    <template v-if="done">
                        <div class="ohero__done">
                            <span class="confirm__i" style="background: var(--success-soft); color: var(--success-text)"><UiIcon name="check" :size="26" /></span>
                            <h2>Остатки сверены</h2>
                        </div>
                        <p>Склад приведён к факту {{ date(inv.startDate) }}.</p>
                    </template>
                    <template v-else>
                        <h2>{{ edit ? "Впишите факт" : "Идёт подсчёт" }}</h2>
                        <p>{{ edit ? "Меняйте только те товары, где пересчёт не сошёлся с остатком. Сохраняйте по ходу — завершение перепишет остатки склада." : "Вносятся фактические остатки." }}</p>
                    </template>
                </section>
                <section class="card blk">
                    <h3>Итог</h3>
                    <div class="invsum">
                        <div class="invsum__big" :class="diffTone(s.diff)">
                            <small>Разница по сумме</small><b>{{ sgnMoney(s.diff) }}</b
                            ><span>{{ s.diff === 0 ? "Сходится в ноль" : s.diff < 0 ? "Недостача" : "Излишек" }}</span>
                        </div>
                        <div class="kv">
                            <span>Сумма склада на старте</span><b>{{ money(s.startValue) }}</b>
                        </div>
                        <div class="kv">
                            <span>Сумма по факту</span><b>{{ money(s.factValue) }}</b>
                        </div>
                        <div class="kv">
                            <span>Расхождений</span><b>{{ s.devN }} {{ plural(s.devN, ["позиция", "позиции", "позиций"]) }}</b>
                        </div>
                        <div class="kv">
                            <span>Недостача</span
                            ><b
                                ><span v-if="s.short" class="neg">{{ MINUS + pcs(s.short) }} · {{ MINUS + money(s.shortSum) }}</span
                                ><template v-else>—</template></b
                            >
                        </div>
                        <div class="kv">
                            <span>Излишек</span
                            ><b
                                ><span v-if="s.plus" class="warn">+{{ pcs(s.plus) }} · +{{ money(s.plusSum) }}</span
                                ><template v-else>—</template></b
                            >
                        </div>
                    </div>
                    <div v-if="edit" style="margin-top: var(--sp-6)"><UiField v-model="draft.comment" label="Комментарий" :rows="2" maxlength="1000" /></div>
                    <div v-else-if="inv.comment" class="comment" style="margin-top: var(--sp-5)">
                        <UiIcon name="receipt" /><span>{{ inv.comment }}</span>
                    </div>
                    <div v-if="edit" class="work__acts">
                        <UiBtn v-if="done" label="Сохранить с причиной" icon="edit" class="btn--warn" size="lg" block :disabled="!dirty" :loading="busy === 'save'" @click="save" />
                        <template v-else>
                            <UiBtn label="Завершить инвентаризацию" icon="check" kind="success" size="lg" block :disabled="!!busy" @click="openFinish" />
                            <UiBtn :label="dirty ? 'Сохранить промежуточно' : 'Всё сохранено'" :icon="dirty ? '' : 'check'" kind="secondary" size="lg" block :disabled="!dirty" :loading="busy === 'save'" @click="save" />
                        </template>
                        <div v-if="canDel" class="work__more">
                            <UiBtn :label="done ? 'Удалить и откатить' : 'Удалить инвентаризацию'" icon="trash" kind="danger-ghost" :loading="busy === 'del'" @click="remove" />
                        </div>
                    </div>
                </section>
            </aside>

            <div v-if="edit" class="abar">
                <span class="abar__sum"
                    ><small>{{ s.devN }} {{ plural(s.devN, ["расхождение", "расхождения", "расхождений"]) }}</small
                    ><b :class="diffTone(s.diff)">{{ sgnMoney(s.diff) }}</b></span
                >
                <!-- Короткие подписи, как «Завершить»: полная не оставляет места сумме на 390 px. -->
                <UiBtn v-if="done" label="Сохранить" icon="edit" class="btn--warn" size="lg" :disabled="!dirty" :loading="busy === 'save'" @click="save" />
                <UiBtn v-else label="Завершить" icon="check" kind="success" size="lg" :disabled="!!busy" @click="openFinish" />
                <UiBtn v-if="!done || canDel" icon="dots" title="Ещё действия" kind="secondary" size="lg" @click="moreOpen = true" />
            </div>
        </div>

        <UiSheet v-if="moreOpen" v-slot="{ close }" :title="`Инвентаризация от ${date(inv.startDate)}`" size="sm" @close="moreOpen = false">
            <div style="display: grid; gap: var(--sp-3)">
                <UiBtn v-if="!done" :label="dirty ? 'Сохранить промежуточно' : 'Всё сохранено'" :icon="dirty ? '' : 'check'" kind="secondary" size="lg" block :disabled="!dirty" @click="close('act'), save()" />
                <UiBtn v-if="canDel" :label="done ? 'Удалить и откатить' : 'Удалить инвентаризацию'" icon="trash" kind="danger-ghost" size="lg" block @click="close('act'), remove()" />
            </div>
        </UiSheet>

        <UiSheet v-if="finishOpen" label="Завершить инвентаризацию?" size="sm" cls="ov--confirm" :before-close="(why) => why === 'ok' || !busy" @close="closeFinish">
            <div class="confirm confirm--success">
                <span class="confirm__i"><UiIcon name="clipboard" :size="26" /></span>
                <div class="confirm__t">
                    <h3>Завершить инвентаризацию?</h3>
                    <p>{{ s.devN ? `Остатки ${s.devN} ${plural(s.devN, ["товара", "товаров", "товаров"])} станут равны факту` : "Расхождений нет" }}</p>
                </div>
            </div>
            <div class="confirm-extra">
                <div class="kv">
                    <span>Недостача</span
                    ><b
                        ><span v-if="s.short" class="neg">{{ MINUS + pcs(s.short) }}</span
                        ><template v-else>—</template></b
                    >
                </div>
                <div class="kv">
                    <span>Излишек</span
                    ><b
                        ><span v-if="s.plus" class="warn">+{{ pcs(s.plus) }}</span
                        ><template v-else>—</template></b
                    >
                </div>
                <div class="kv">
                    <span>Разница</span
                    ><b
                        ><span :class="diffTone(s.diff)">{{ sgnMoney(s.diff) }}</span></b
                    >
                </div>
            </div>
            <template #footer="{ close }">
                <UiBtn label="Отмена" kind="secondary" size="lg" @click="close('cancel')" />
                <UiBtn label="Завершить" kind="success" icon="check" size="lg" :loading="busy === 'done'" @click="complete(close)" />
            </template>
        </UiSheet>
    </UiPage>
</template>
