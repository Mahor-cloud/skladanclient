<script setup>
/**
 * Copyright 2026 Lord_mahor
 * Licensed under Apache 2.0
 */
import UiIcon from "./UiIcon.vue"

defineProps({
    modelValue: Boolean,
    label: { type: String, default: "" },
    hint: { type: String, default: "" },
    count: { type: Number, default: null },
    disabled: Boolean
})
defineEmits(["update:modelValue"])
</script>

<template>
    <label class="check" :class="{ 'is-disabled': disabled }">
        <input type="checkbox" :checked="modelValue" :disabled="disabled" @change="$emit('update:modelValue', $event.target.checked)" />
        <span class="check__box" aria-hidden="true"><UiIcon name="check" :size="16" /></span>
        <span class="check__text"
            ><slot>{{ label }}</slot
            ><small v-if="hint">{{ hint }}</small></span
        >
        <span v-if="count != null" class="check__count">{{ count }}</span>
    </label>
</template>
