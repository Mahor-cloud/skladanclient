<script setup>
/**
 * Copyright 2026 Lord_mahor
 * Licensed under Apache 2.0
 */
import { money } from "@/domain/format"
import UiCover from "./UiCover.vue"
import UiStepper from "./UiStepper.vue"

// Список товаров строками: обложка · название · количество · цена · сумма. items: [{ p, qty, max, note, bad }].
// step — количество правится на месте: события qty(p, n) и clamped(p, max). link — название ведёт на товар.
defineProps({
    items: { type: Array, required: true },
    step: Boolean,
    head: { type: Boolean, default: true },
    link: { type: Boolean, default: true }
})
defineEmits(["qty", "clamped"])
</script>

<template>
    <div class="lines" :class="{ 'lines--edit': step }">
        <div v-if="head" class="lines__h" aria-hidden="true"><span></span><span>Товар</span><span>Кол-во</span><span>Цена</span><span>Сумма</span></div>
        <div v-for="x in items" :key="x.p._id" class="line" :class="{ 'line--bad': x.bad }" :data-pid="x.p._id">
            <UiCover :product="x.p" size="xs" />
            <span class="line__n">
                <RouterLink v-if="link" :to="{ name: 'product', params: { id: x.p._id } }">{{ x.p.name }}</RouterLink>
                <template v-else>{{ x.p.name }}</template>
                <small v-if="x.note">{{ x.note }}</small>
            </span>
            <span class="line__q">
                <UiStepper v-if="step" :model-value="x.qty" :max="x.max ?? Infinity" size="sm" :label="'Количество: ' + x.p.name" @update:model-value="$emit('qty', x.p, $event)" @clamped="$emit('clamped', x.p, $event)" />
                <template v-else>{{ x.qty }}&nbsp;шт.</template>
            </span>
            <span class="line__p">{{ money(x.p.price) }}</span>
            <b class="line__s">{{ money(x.p.price * x.qty) }}</b>
        </div>
    </div>
</template>
