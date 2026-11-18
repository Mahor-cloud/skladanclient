<script setup>
/**
 * Copyright 2026 Lord_mahor
 * Licensed under Apache 2.0
 */
import { computed } from "vue"
import { RouterLink } from "vue-router"
import UiIcon from "./UiIcon.vue"

// kind: primary | secondary | ghost | outline | danger | success | danger-ghost | soldout; с to — ссылка-маршрут.
const props = defineProps({
    label: { type: String, default: "" },
    icon: { type: String, default: "" },
    iconRight: { type: String, default: "" },
    kind: { type: String, default: "primary" },
    size: { type: String, default: "md" },
    block: Boolean,
    disabled: Boolean,
    loading: Boolean,
    to: { type: [String, Object], default: null },
    type: { type: String, default: "button" },
    title: { type: String, default: null }
})
const link = computed(() => props.to && !props.disabled && !props.loading)
</script>

<template>
    <component
        :is="link ? RouterLink : 'button'"
        :to="link ? to : undefined"
        :type="link ? undefined : type"
        class="btn"
        :class="['btn--' + kind, 'btn--' + size, { 'btn--block': block, 'btn--icon': !label && !$slots.default }]"
        :title="title"
        :aria-label="!label && !$slots.default ? title : null"
        :disabled="link ? undefined : disabled || loading"
        :aria-busy="loading ? 'true' : null"
    >
        <span v-if="loading" class="spin" aria-hidden="true"></span>
        <UiIcon v-else-if="icon" :name="icon" :size="size === 'sm' ? 18 : 20" />
        <span v-if="label || $slots.default" class="btn__l"
            ><slot>{{ label }}</slot></span
        >
        <UiIcon v-if="iconRight" :name="iconRight" :size="18" />
    </component>
</template>
