<script setup>
/**
 * Copyright 2026 Lord_mahor
 * Licensed under Apache 2.0
 */
import { useSession } from "@/composables/useSession"
import { date, pcs, plural, short } from "@/domain/format"
import { homePath } from "@/domain/nav"
import { useInventories } from "@/service/queries"
import { UiAvatar, UiBtn, UiEmpty, UiError, UiIcon, UiIconBtn, UiPage, UiSk, UiSkRow, UiStatus } from "@/ui"
import { computed } from "vue"
import { diffTone, invStats, latestId, MINUS, sgnMoney } from "./inventory"

const { can, plain } = useSession()
const { data, isPending, isError, refetch } = useInventories()

const list = computed(() => {
    const lid = latestId(data.value)
    return [...(data.value || [])]
        .sort((a, b) => (b.startDate || 0) - (a.startDate || 0))
        .map((inv) => {
            const [day, mon] = short(inv.startDate).split(" ")
            return { inv, day, mon, year: new Date(inv.startDate).getFullYear(), s: invStats(inv.items), u: inv.createdBy?.name ? inv.createdBy : null, editable: can("edit_inventory") && inv._id === lid }
        })
})
const open = computed(() => list.value.find((x) => !x.inv.isCompleted) || null)
const rest = computed(() => list.value.filter((x) => x !== open.value))
const sub = computed(() => (open.value ? "Идёт инвентаризация" : list.value.length ? `Последняя — ${date(list.value[0].inv.startDate)}` : "Сверка остатков с фактом"))
const to = (inv) => ({ name: "inventory-edit", params: { id: inv._id } })
</script>

<template>
    <UiPage v-if="!can('view_inventory')" title="Инвентаризация">
        <div class="card">
            <UiEmpty art="error" title="Нет доступа"><UiBtn label="На главную" icon="home" :to="homePath(plain)" /></UiEmpty>
        </div>
    </UiPage>

    <UiPage v-else-if="isError && !data" title="Инвентаризация">
        <div class="card card--pad"><UiError title="Не удалось загрузить «Инвентаризацию»" @retry="refetch()" /></div>
    </UiPage>

    <UiPage v-else-if="isPending" title="Инвентаризация" sub="Загружаем…">
        <section class="card invhero" aria-busy="true">
            <UiSk w="130px" :h="32" :r="99" /><UiSk w="60%" :h="28" /><UiSk w="90%" />
            <div class="invhero__nums">
                <span v-for="i in 4" :key="i"><UiSk w="70%" :h="12" /><UiSk w="50%" :h="22" /></span>
            </div>
            <UiSk :h="52" :r="12" />
        </section>
        <p class="loading-note" role="status"><span class="spin"></span>Загружаем инвентаризации…</p>
        <div class="card tbl tbl--sk"><UiSkRow v-for="i in 4" :key="i" /></div>
    </UiPage>

    <UiPage v-else title="Инвентаризация" :sub="sub">
        <template #actions><UiIconBtn v-if="can('create_inventory')" icon="plus" label="Новая инвентаризация" :to="{ name: 'inventory-new' }" :kind="open ? 'soft' : 'primary'" /></template>
        <template #deskActions><UiBtn v-if="can('create_inventory')" label="Новая инвентаризация" icon="plus" :to="{ name: 'inventory-new' }" :kind="open ? 'secondary' : 'primary'" /></template>

        <div v-if="!list.length" class="card">
            <UiEmpty art="box" title="Инвентаризаций ещё не было"><UiBtn v-if="can('create_inventory')" label="Новая инвентаризация" icon="plus" :to="{ name: 'inventory-new' }" /></UiEmpty>
        </div>
        <template v-else>
            <RouterLink v-if="open" class="card invhero" :to="to(open.inv)">
                <div class="invhero__top">
                    <UiStatus st="partial" label="В процессе" size="lg" /><span class="muted">от {{ date(open.inv.startDate) }}{{ open.u ? ` · начал(а) ${open.u.name}` : "" }}</span>
                </div>
                <h2>Идёт инвентаризация</h2>
                <div class="invhero__nums">
                    <span
                        ><small>Расхождений</small><b>{{ open.s.devN }}</b></span
                    >
                    <span
                        ><small>Недостача</small><b class="neg">{{ open.s.short ? MINUS + pcs(open.s.short) : "—" }}</b></span
                    >
                    <span
                        ><small>Излишек</small><b class="warn">{{ open.s.plus ? "+" + pcs(open.s.plus) : "—" }}</b></span
                    >
                    <span
                        ><small>Разница</small><b :class="diffTone(open.s.diff)">{{ sgnMoney(open.s.diff) }}</b></span
                    >
                </div>
                <span class="btn btn--primary btn--lg invhero__go"
                    ><UiIcon :name="can('edit_inventory') ? 'edit' : 'eye'" /><span class="btn__l">{{ can("edit_inventory") ? "Продолжить ввод" : "Открыть" }}</span></span
                >
            </RouterLink>
            <p v-if="open && can('create_inventory')" class="listnote"><UiIcon name="info" :size="16" class="inl" /> Новую можно начать после завершения текущей.</p>

            <div class="sec-h">
                <h2>
                    История<small>{{ rest.length }}</small>
                </h2>
                <span class="muted" style="font-size: var(--fs-13); font-weight: 600"><UiIcon name="lock" :size="14" class="inl" /> Исправить можно только последнюю</span>
            </div>
            <div class="card itable">
                <div class="itable__h" aria-hidden="true"><span>Дата</span><span>Кто проводил</span><span>Расхождений</span><span>Недостача</span><span>Излишек</span><span>Разница</span><span>Статус</span><span></span></div>
                <RouterLink v-for="x in rest" :key="x.inv._id" class="irow2" :to="to(x.inv)">
                    <span class="datebox"
                        ><b>{{ x.day }}</b
                        ><small>{{ x.mon }} {{ x.year }}</small></span
                    >
                    <span class="irow2__t"
                        ><b>Инвентаризация от {{ date(x.inv.startDate) }}</b
                        ><small><UiAvatar v-if="x.u" :user="x.u" size="sm" />{{ [x.u?.name, x.inv.comment].filter(Boolean).join(" · ") }}</small></span
                    >
                    <span class="irow2__n"
                        ><b>{{ x.s.devN }}</b
                        ><small>{{ plural(x.s.devN, ["расхождение", "расхождения", "расхождений"]) }}</small></span
                    >
                    <span class="irow2__n"
                        ><b class="neg">{{ x.s.short ? MINUS + x.s.short : "—" }}</b
                        ><small>недостача, шт.</small></span
                    >
                    <span class="irow2__n"
                        ><b class="warn">{{ x.s.plus ? "+" + x.s.plus : "—" }}</b
                        ><small>излишек, шт.</small></span
                    >
                    <span class="irow2__sum" :class="diffTone(x.s.diff)">{{ sgnMoney(x.s.diff) }}</span>
                    <span class="irow2__st">
                        <UiStatus :st="x.inv.isCompleted ? 'done' : 'partial'" :label="x.inv.isCompleted ? 'Завершена' : 'В процессе'" size="sm" />
                        <span v-if="x.editable" class="tag tag--primary"><UiIcon name="edit" :size="14" />можно исправить</span>
                        <span v-else class="tag tag--neutral"><UiIcon name="lock" :size="14" />только просмотр</span>
                    </span>
                    <UiIcon name="right" class="irow2__chev" />
                </RouterLink>
            </div>
        </template>
    </UiPage>

    <RouterView />
</template>
