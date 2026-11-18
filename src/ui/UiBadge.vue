<script setup>
/**
 * Copyright 2026 Lord_mahor
 * Licensed under Apache 2.0
 */
// Счётчик: при нуле скрыт, больше 99 — «99+». tone: accent | neutral.
defineProps({
    n: { type: Number, default: 0 },
    tone: { type: String, default: "accent" }
})
</script>

<template>
    <span class="badge" :class="'badge--' + tone" :hidden="!n">{{ n > 99 ? "99+" : n || 0 }}</span>
</template>
