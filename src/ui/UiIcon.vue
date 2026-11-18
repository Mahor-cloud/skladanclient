<script setup>
/**
 * Copyright 2026 Lord_mahor
 * Licensed under Apache 2.0
 */
import { IC } from "./icons"

defineProps({
    name: { type: String, required: true },
    size: { type: [Number, String], default: 20 }
})
</script>

<template>
    <svg class="i" :width="size" :height="size" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" v-html="IC[name] || ''"></svg>
</template>
