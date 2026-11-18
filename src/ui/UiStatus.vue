<script setup>
/**
 * Copyright 2026 Lord_mahor
 * Licensed under Apache 2.0
 */
import { computed } from "vue"
import { STATUS } from "@/domain/orders"

// Статус формой и цветом: кольцо «Новый», половина «Оплачен», круг «К выдаче», квадрат «Завершен» (+ partial).
// label — своя подпись (закупки, инвентаризация); bare — только метка в плашке 36×36.
const props = defineProps({
    st: { type: String, required: true },
    label: { type: String, default: "" },
    size: { type: String, default: "md" },
    bare: Boolean
})
const text = computed(() => props.label || STATUS[props.st]?.label || "")
</script>

<template>
    <span v-if="bare" class="st st--bare" :class="'st--' + st" :title="text"><i class="st-mark" aria-hidden="true"></i></span>
    <span v-else class="status st" :class="['st--' + st, 'status--' + st, 'status--' + size]"><i class="st-mark" aria-hidden="true"></i>{{ text }}</span>
</template>
