<script setup>
/**
 * Copyright 2026 Lord_mahor
 * Licensed under Apache 2.0
 */
import UiIcon from "./UiIcon.vue"

// Чип-кнопка: нажатие — обычный @click. tone: accent; размер и вид — классами (chip--sm, chip--filter).
defineProps({
    label: { type: String, default: "" },
    count: { type: Number, default: null },
    active: Boolean,
    icon: { type: String, default: "" },
    tone: { type: String, default: "" }
})
</script>

<template>
    <button type="button" class="chip" :class="[{ 'is-on': active }, tone && 'chip--' + tone]" :aria-pressed="active">
        <UiIcon v-if="icon" :name="icon" :size="18" /><span
            ><slot>{{ label }}</slot></span
        ><b v-if="count != null">{{ count }}</b>
    </button>
</template>
