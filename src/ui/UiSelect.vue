<script setup>
/**
 * Copyright 2026 Lord_mahor
 * Licensed under Apache 2.0
 */
import UiIcon from "./UiIcon.vue"

// options: [{ value, label }]. aria-label и прочие атрибуты — самому <select>, class — обёртке.
defineOptions({ inheritAttrs: false })
defineProps({
    modelValue: { type: [String, Number], default: "" },
    label: { type: String, default: "" },
    options: { type: Array, default: () => [] }
})
defineEmits(["update:modelValue"])
</script>

<template>
    <label class="field field--select" :class="$attrs.class">
        <span v-if="label" class="field__label">{{ label }}</span>
        <span class="field__box">
            <select class="field__input" :value="modelValue" v-bind="{ ...$attrs, class: undefined }" @change="$emit('update:modelValue', $event.target.value)">
                <option v-for="o in options" :key="o.value" :value="o.value">{{ o.label }}</option>
            </select>
            <UiIcon name="down" :size="18" class="field__chev" />
        </span>
    </label>
</template>
