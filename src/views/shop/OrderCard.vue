<script setup>
/**
 * Copyright 2026 Lord_mahor
 * Licensed under Apache 2.0
 */
import { useSession } from "@/composables/useSession"
import { money, pcs, positions, rel } from "@/domain/format"
import { orderPieces, STATUS } from "@/domain/orders"
import { paneSel, UiBtn, UiCoverStack, UiIcon, UiStatus } from "@/ui"
import { computed } from "vue"

// Карточка своего заказа: статус и действие сразу. covers — товары позиций по порядку (для стопки обложек).
const props = defineProps({
    row: { type: Object, required: true },
    covers: { type: Array, required: true }
})
defineEmits(["repeat"])
const { can } = useSession()
const to = computed(() => ({ name: "order", params: { id: props.row._id } }))
const cur = computed(() => STATUS[props.row.st].step)
// Что стоит в подвале карточки: кнопка шага, плашка ожидания или ничего.
const act = computed(() => {
    const { pm, st } = props.row
    if (pm.pay && pm.own) return "pay"
    if (pm.waiting) return "wait"
    if (pm.complete && pm.own) return pm.frozen ? "ice" : pm.blocked ? "blocked" : "complete"
    return st === "done" && can("create_orders") ? "repeat" : ""
})
</script>

<template>
    <article class="ocard" :class="{ 'ocard--deficit': row.def, 'is-sel': paneSel('/shop/order/' + row._id) }" :data-st="row.st" data-tilt>
        <RouterLink class="ocard__link" :to="to" :aria-label="`Заказ №${row.o.orderNumber}, ${STATUS[row.st].label}`" />
        <div class="ocard__top">
            <div class="ocard__n">
                Заказ №{{ row.o.orderNumber }}<small>{{ rel(row.o.orderDate) }}</small>
            </div>
            <UiStatus :st="row.st" />
        </div>
        <div class="mtrack" :aria-label="`Этап ${cur + 1} из 4`"><i v-for="i in 4" :key="i" :class="{ 'is-done': i - 1 < cur || cur === 3, 'is-cur': i - 1 === cur && cur !== 3 }"></i></div>
        <div v-if="row.diff || (!act && row.st !== 'done')" class="turn" :class="{ 'turn--mine': row.turn.mine, 'turn--warn': row.turn.warn }"><UiIcon v-if="row.turn.warn" name="alert" :size="18" />{{ row.turn.text }}</div>
        <div class="ocard__foot">
            <UiCoverStack :products="covers" :max="5" />
            <div class="ocard__sum">
                <b>{{ money(row.total) }}</b
                ><small>{{ positions(row.o.items.length) }} · {{ pcs(orderPieces(row.o)) }}</small>
            </div>
        </div>
        <div v-if="act" class="ocard__acts">
            <UiBtn v-if="act === 'pay'" :label="`Оплатить ${money(row.total)}`" icon="wallet" :to="to" />
            <span v-else-if="act === 'wait'" class="ocard__wait"><UiIcon name="clock" :size="18" />Оплачен, ждёт подтверждения</span>
            <span v-else-if="act === 'ice'" class="ocard__wait ocard__wait--ice"><UiIcon name="clipboard" :size="18" />Выдача после инвентаризации</span>
            <UiBtn v-else-if="act === 'blocked'" label="Заблокировано дефицитом" icon="lock" kind="secondary" disabled />
            <UiBtn v-else-if="act === 'complete'" label="Заказ получен" icon="check" kind="success" :to="{ ...to, query: { ask: 'complete' } }" />
            <UiBtn v-else label="Повторить заказ" icon="repeat" kind="secondary" @click="$emit('repeat', row.o)" />
        </div>
    </article>
</template>
