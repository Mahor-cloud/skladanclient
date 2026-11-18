<script setup>
/**
 * Copyright 2026 Lord_mahor
 * Licensed under Apache 2.0
 */
import { RouterLink } from "vue-router"
import UiIcon from "./UiIcon.vue"

// Кнопка-значок 44×44: label — подпись для чтения с экрана и подсказка. kind: ghost | soft | primary | danger. Слот — бейдж.
defineProps({
    icon: { type: String, required: true },
    label: { type: String, required: true },
    kind: { type: String, default: "ghost" },
    to: { type: [String, Object], default: null },
    size: { type: Number, default: 22 }
})
</script>

<template>
    <component :is="to ? RouterLink : 'button'" :to="to || undefined" :type="to ? undefined : 'button'" class="ibtn" :class="'ibtn--' + kind" :aria-label="label" :title="label"> <UiIcon :name="icon" :size="size" /><slot /> </component>
</template>
