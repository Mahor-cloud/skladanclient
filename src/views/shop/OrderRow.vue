<script setup>
/**
 * Copyright 2026 Lord_mahor
 * Licensed under Apache 2.0
 */
import { money, rel } from "@/domain/format"
import { paneSel, UiAvatar, UiIcon, UiStatus } from "@/ui"
import { computed } from "vue"

// Строка заказа в списке служащих. Кнопка следующего шага ведёт в заказ: деньги и выдача подтверждаются там, где виден состав.
const props = defineProps({ row: { type: Object, required: true } })
const next = computed(() => {
    const { pm, turn } = props.row
    return pm.confirm ? "Подтвердить" : pm.complete && !pm.blocked && !pm.frozen && turn.mine ? "Выдать" : pm.pay && pm.own ? "Оплатить" : ""
})
</script>

<template>
    <RouterLink class="orw" :class="{ 'orw--deficit': row.def, 'orw--mine': row.pm.own, 'is-sel': paneSel('/shop/order/' + row._id) }" :to="{ name: 'order', params: { id: row._id } }">
        <UiAvatar :user="row.o.user" size="sm" />
        <span class="orw__main">
            <b>№{{ row.o.orderNumber }} · {{ row.o.user?.name || "—" }} <span v-if="row.pm.own" class="tag tag--primary">мой</span></b>
            <span class="orw__meta">
                <UiStatus :st="row.st" size="sm" />
                <span v-if="!next || row.diff" class="turn" :class="{ 'turn--mine': row.turn.mine, 'turn--warn': row.turn.warn }"><UiIcon v-if="row.turn.warn" name="alert" :size="16" />{{ row.turn.short }}</span>
            </span>
        </span>
        <span class="orw__end">
            <b>{{ money(row.total) }}</b>
            <small>{{ row.o.items.length }} поз. · {{ rel(row.o.orderDate).replace(/, \d\d:\d\d$/, "") }}</small>
        </span>
        <span v-if="next" class="btn btn--sm orw__go" :class="row.pm.pay ? 'btn--primary' : 'btn--success'">{{ next }}</span>
        <UiIcon v-else name="right" class="orw__chev" />
    </RouterLink>
</template>
