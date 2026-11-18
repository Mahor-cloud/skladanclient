<script setup>
/**
 * Copyright 2026 Lord_mahor
 * Licensed under Apache 2.0
 */
import UiIcon from "./UiIcon.vue"

// Переключатель-сегменты. options: [{ value, label, icon, count }]; label — подпись группы для чтения с экрана.
defineProps({
    modelValue: { type: [String, Number], default: "" },
    options: { type: Array, required: true },
    label: { type: String, default: null },
    size: { type: String, default: "md" }
})
defineEmits(["update:modelValue"])
</script>

<template>
    <div class="seg" :class="'seg--' + size" role="group" :aria-label="label">
        <button
            v-for="o in options"
            :key="o.value"
            type="button"
            class="seg__btn"
            :class="{ 'is-on': o.value === modelValue }"
            :aria-pressed="o.value === modelValue"
            :aria-label="o.label ? null : o.title"
            :title="o.title"
            @click="$emit('update:modelValue', o.value)"
        >
            <UiIcon v-if="o.icon" :name="o.icon" :size="18" /><span v-if="o.label">{{ o.label }}</span
            ><b v-if="o.count != null">{{ o.count }}</b>
        </button>
    </div>
</template>
