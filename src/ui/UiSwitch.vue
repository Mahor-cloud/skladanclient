<script setup>
/**
 * Copyright 2026 Lord_mahor
 * Licensed under Apache 2.0
 */
defineProps({
    modelValue: Boolean,
    label: { type: String, default: "" },
    hint: { type: String, default: "" },
    disabled: Boolean
})
defineEmits(["update:modelValue"])
</script>

<template>
    <label class="switch" :class="{ 'is-disabled': disabled }">
        <span class="switch__text"
            ><slot>{{ label }}</slot
            ><small v-if="hint">{{ hint }}</small></span
        >
        <input type="checkbox" role="switch" :checked="modelValue" :disabled="disabled" @change="$emit('update:modelValue', $event.target.checked)" />
        <span class="switch__track" aria-hidden="true"><span class="switch__thumb"></span></span>
    </label>
</template>
