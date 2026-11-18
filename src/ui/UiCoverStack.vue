<script setup>
/**
 * Copyright 2026 Lord_mahor
 * Licensed under Apache 2.0
 */
import UiCover from "./UiCover.vue"

// Стопка мелких обложек (состав заказа, закупки): products — товары по порядку, лишние сворачиваются в «+N».
defineProps({
    products: { type: Array, required: true },
    max: { type: Number, default: 4 }
})
</script>

<template>
    <span class="cstack">
        <UiCover v-for="(p, i) in products.slice(0, max)" :key="p._id ?? i" :product="p" size="xs" />
        <span v-if="products.length > max" class="cstack__more">+{{ products.length - max }}</span>
    </span>
</template>
