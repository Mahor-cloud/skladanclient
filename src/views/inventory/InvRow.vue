<script setup>
/**
 * Copyright 2026 Lord_mahor
 * Licensed under Apache 2.0
 */
import { num } from "@/domain/format"
import { pid } from "@/domain/stock"
import { UiCover, UiStepper } from "@/ui"
import { computed } from "vue"
import { diffTone, factOf, invPrice, MINUS, sgnMoney } from "./inventory"

// Строка факта. facts — общий черновик: строка сама читает своё значение, поэтому ввод перерисовывает только её.
const props = defineProps({
    it: { type: Object, required: true },
    facts: { type: Object, required: true },
    edit: Boolean
})
defineEmits(["fact"])
const p = computed(() => props.it.product)
const f = computed(() => factOf(props.it, props.facts))
const dv = computed(() => f.value - (Number(props.it.quantity) || 0))
const dev = computed(() => (dv.value > 0 ? "+" + dv.value : dv.value < 0 ? MINUS + -dv.value : "0"))
</script>

<template>
    <div class="trow trow--inv" :class="{ 'is-plus': dv > 0, 'is-minus': dv < 0 }" :data-row="pid(it)">
        <span class="trow__cov"><UiCover :product="p" size="sm" /></span>
        <div class="trow__main">
            <span class="trow__n">{{ p.name }}</span
            ><span class="trow__m"
                >{{ p.category }}<span class="mob"> · на старте {{ it.quantity }}</span></span
            >
        </div>
        <span class="trow__c">{{ num(it.quantity) }}</span>
        <div class="trow__ctl">
            <UiStepper v-if="edit" :model-value="f" :min="-999" :max="99999" :trash="false" :label="'Факт: ' + p.name" @update:model-value="$emit('fact', pid(it), $event)" />
            <b v-else class="qty">{{ num(f) }}</b>
        </div>
        <span class="trow__c"
            ><span class="dev" :class="{ 'dev--plus': dv > 0, 'dev--minus': dv < 0 }">{{ dev }}</span></span
        >
        <span class="trow__side">
            <template v-if="dv"
                ><span class="mob-dev"
                    ><span class="dev" :class="dv > 0 ? 'dev--plus' : 'dev--minus'">{{ dev }}</span></span
                ><span :class="diffTone(dv)">{{ sgnMoney(dv * invPrice(it)) }}</span></template
            >
            <template v-else><span class="mob-dev muted">сходится</span><span class="muted desk-only">—</span></template>
        </span>
    </div>
</template>
