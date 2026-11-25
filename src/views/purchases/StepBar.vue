<script setup>
/**
 * Copyright 2026 Lord_mahor
 * Licensed under Apache 2.0
 */
// Полоска шагов над кнопкой, пока сервер работает на lit-na.ru: bar = { at, of } — идёт шаг at из of.
defineProps({ bar: { type: Object, default: null } })
</script>

<template>
    <div v-if="bar" class="mtrack mtrack--steps" :style="{ '--n': bar.of }" aria-hidden="true">
        <i v-for="n in bar.of" :key="n" :class="{ 'is-done': n < bar.at, 'is-cur': n === bar.at }"></i>
    </div>
</template>
